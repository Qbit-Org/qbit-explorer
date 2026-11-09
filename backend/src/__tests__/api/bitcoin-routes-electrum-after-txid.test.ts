import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getAddressTransactions: jest.fn(),
    $getScriptHashTransactions: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

import config from '../../config';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';

type HistoryLookup = '$getAddressTransactions' | '$getScriptHashTransactions';
const mockedApi = bitcoinApi as unknown as Record<HistoryLookup, jest.Mock>;

const ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';
const SCRIPTHASH = 'ab'.repeat(32);
const TXID = '053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b';

// Each route that pages a history, the backend method it calls and the error of its 500
const routes: [string, HistoryLookup, string][] = [
  [`address/${ADDRESS}/txs`, '$getAddressTransactions', 'Failed to get address transactions'],
  [`scripthash/${SCRIPTHASH}/txs`, '$getScriptHashTransactions', 'Failed to get script hash transactions'],
];

describe('after_txid under the electrum backend', () => {
  const backend = config.MEMPOOL.BACKEND;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
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
    jest.resetAllMocks();
    config.MEMPOOL.BACKEND = 'electrum';
  });

  describe.each(routes)('GET %s', (path, lookup, failure) => {
    const url = (): string => baseUrl + path + `?after_txid=${TXID}`;

    test('responds 422 for an after_txid the node does not have, which makes the address page reload', async () => {
      mockedApi[lookup].mockRejectedValue(new Error('after_txid not found'));

      const res = await fetch(url());

      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: 'after_txid not found' });
    });

    test('responds 500 when the node cannot be asked', async () => {
      mockedApi[lookup].mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:8352'));

      const res = await fetch(url());

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: failure });
    });
  });
});
