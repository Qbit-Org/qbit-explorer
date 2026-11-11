import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

const mockGetHistory = jest.fn();
const mockApi: { electrum?: any } = {};

jest.mock('@mempool/electrum-client', () => jest.fn().mockImplementation(() => ({
  initElectrum: jest.fn().mockResolvedValue(undefined),
  blockchainScripthash_getHistory: mockGetHistory,
})));

jest.mock('../../api/memory-cache', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
}));

jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: {
    getMempool: (): Record<string, unknown> => ({}),
  },
}));

// The routes call the real electrum API, which the tests build over a mocked
// Electrum server and node, so they see the errors it actually throws.
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getAddressTransactions: (...args: unknown[]) => mockApi.electrum.$getAddressTransactions(...args),
    $getScriptHashTransactions: (...args: unknown[]) => mockApi.electrum.$getScriptHashTransactions(...args),
  },
  bitcoinCoreApi: {},
}));

import config from '../../config';
import BitcoindElectrsApi from '../../api/bitcoin/electrum-api';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import { TXINDEX_UNAVAILABLE } from '../../utils/api';

const ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';
const SCRIPTHASH = 'ab'.repeat(32);
const TXID = '053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b';
const HISTORY = [
  { tx_hash: 'a'.repeat(64), height: 100 },
  { tx_hash: 'b'.repeat(64), height: 0, fee: 200 },
];

// Core's getrawtransaction answers for a transaction it cannot return
const NOT_FOUND = 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.';
const TXINDEX_BUILDING = 'No such mempool transaction. Blockchain transactions are still in the process of being indexed. Use gettransaction for wallet transactions.';
const TXINDEX_DISABLED = 'No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries. Use gettransaction for wallet transactions.';

// Each route that pages a history, and the error of its 500 for any other failure
const routes: [string, string][] = [
  [`address/${ADDRESS}/txs`, 'Failed to get address transactions'],
  [`scripthash/${SCRIPTHASH}/txs`, 'Failed to get script hash transactions'],
];

describe('after_txid under the electrum backend', () => {
  const backend = config.MEMPOOL.BACKEND;
  const node = {
    validateAddress: jest.fn(),
    getRawTransaction: jest.fn(),
  };
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    mockApi.electrum = new BitcoindElectrsApi(node);
    const app = express();
    bitcoinRoutes.initRoutes(app);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/`;
  });

  afterAll(async () => {
    config.MEMPOOL.BACKEND = backend;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    config.MEMPOOL.BACKEND = 'electrum';
    node.validateAddress.mockResolvedValue({ isvalid: true, address: ADDRESS, scriptPubKey: '5220' + '00'.repeat(32) });
    mockGetHistory.mockResolvedValue(HISTORY);
  });

  describe.each(routes)('GET %s', (path, failure) => {
    const url = (afterTxid: string): string => baseUrl + path + `?after_txid=${encodeURIComponent(afterTxid)}`;

    test('responds 422 for an after_txid the node does not have, which makes the address page reload', async () => {
      node.getRawTransaction.mockRejectedValue(new Error(NOT_FOUND));

      const res = await fetch(url(TXID));

      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: 'after_txid not found' });
      expect(node.getRawTransaction).toHaveBeenCalledWith(TXID, false);
    });

    test.each([TXINDEX_BUILDING, TXINDEX_DISABLED])('responds 503, not 422, when the node answers %p', async (message) => {
      node.getRawTransaction.mockRejectedValue(new Error(message));

      const res = await fetch(url(TXID));

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: TXINDEX_UNAVAILABLE });
    });

    // the page's transactions come from the node too, so the first page needs txindex as well
    test.each([TXINDEX_BUILDING, TXINDEX_DISABLED])('responds 503 when the node answers %p for a confirmed transaction of the page', async (message) => {
      mockGetHistory.mockResolvedValue([HISTORY[0]]);
      node.getRawTransaction.mockRejectedValue(new Error(message));

      const res = await fetch(baseUrl + path);

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: TXINDEX_UNAVAILABLE });
      expect(node.getRawTransaction).toHaveBeenCalledWith(HISTORY[0].tx_hash, true);
    });

    test('still responds 500 when the node fails otherwise', async () => {
      node.getRawTransaction.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8352'));

      const res = await fetch(url(TXID));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: failure });
    });

    test('responds with an empty page for a transaction the node has outside the history', async () => {
      node.getRawTransaction.mockResolvedValue('02000000');

      const res = await fetch(url(TXID));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    });

    test('responds 400 without a lookup for an after_txid that is not a txid', async () => {
      const res = await fetch(url('../../broadcast?tx=00'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockGetHistory).not.toHaveBeenCalled();
      expect(node.getRawTransaction).not.toHaveBeenCalled();
    });
  });
});
