import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getAddress: jest.fn(),
    $getAddressTransactions: jest.fn(),
    $getAddressChainTransactions: jest.fn(),
    $getAddressMempoolTransactions: jest.fn(),
    $getAddressTransactionSummary: jest.fn(),
    $getAddressUtxos: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

import config from '../../config';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';

type AddressLookup = '$getAddress' | '$getAddressTransactions' | '$getAddressChainTransactions' | '$getAddressMempoolTransactions'
  | '$getAddressTransactionSummary' | '$getAddressUtxos';
const mockedApi = bitcoinApi as unknown as Record<AddressLookup, jest.Mock>;

// P2MR output of mainnet block 161370
const ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';

// How the esplora backend surfaces an electrs error: axios rejects with electrs's
// status, and its plain-text reason as the response body
function electrsError(status: number, reason?: string): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: reason } });
}

// Each route that looks an address up, the backend method it calls and the error of its 500
const routes: [string, AddressLookup, string][] = [
  ['address/:address', '$getAddress', 'Failed to get address'],
  ['address/:address/txs', '$getAddressTransactions', 'Failed to get address transactions'],
  ['address/:address/txs/chain', '$getAddressChainTransactions', 'Failed to get address chain transactions'],
  ['address/:address/txs/mempool', '$getAddressMempoolTransactions', 'Failed to get address mempool transactions'],
  ['address/:address/txs/summary', '$getAddressTransactionSummary', 'Failed to get address transaction summary'],
  ['address/:address/utxo', '$getAddressUtxos', 'Failed to get address'],
];

// Routes that only the esplora backend (qbit-electrs) can answer
const esploraOnly = ['address/:address/txs/summary', 'address/:address/txs/chain', 'address/:address/txs/mempool'];

describe('address routes', () => {
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
    config.MEMPOOL.BACKEND = 'esplora';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each(routes)('GET %s', (route, lookup, failure) => {
    const url = (address: string): string => baseUrl + route.replace(':address', address);

    test('passes a valid address through', async () => {
      const data = lookup === '$getAddress' ? { address: ADDRESS, chain_stats: {}, mempool_stats: {} } : [];
      mockedApi[lookup].mockResolvedValue(data);

      const res = await fetch(url(ADDRESS));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(data);
      expect(mockedApi[lookup].mock.calls[0][0]).toBe(ADDRESS);
    });

    test('responds 400 with the reason electrs rejected the address for', async () => {
      const reason = 'invalid qbit address HRP: expected qb, got bc';
      mockedApi[lookup].mockRejectedValue(electrsError(400, reason));

      const res = await fetch(url('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: reason });
    });

    test('responds 413 when the address has more unspent outputs than electrs serves', async () => {
      const reason = 'Too many unspent transaction outputs (>500). Contact support to raise limits.';
      mockedApi[lookup].mockRejectedValue(electrsError(400, reason));

      const res = await fetch(url(ADDRESS));

      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: reason });
    });

    test('responds 400 without a lookup for characters no address contains', async () => {
      const res = await fetch(url('qb1-bad'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid address' });
      expect(mockedApi[lookup]).not.toHaveBeenCalled();
    });

    test.each([
      ['electrs fails', electrsError(503, 'Service Unavailable')],
      // electrs answers 400 for its own failures too
      ['electrs has an internal error', electrsError(400, 'getblock RPC error: connection refused')],
      ['electrs is unreachable', Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), { code: 'ECONNREFUSED' })],
    ])('responds 500 when %s', async (_label, error) => {
      mockedApi[lookup].mockRejectedValue(error);

      const res = await fetch(url(ADDRESS));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: failure });
    });
  });

  describe('GET address/:address', () => {
    // Reasons from qbit-electrs's qbit_address::Error
    test.each([
      ['a bad checksum', 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22j', 'invalid qbit Bech32m address: invalid checksum'],
      ['a testnet4 address', 'tq1zvhz4p5znyasyeu7z9u4uvm4c3w8a90n70p6msvlyhlsujaf9z7equg2g0m', 'invalid qbit address HRP: expected qb, got tq'],
      ['a witness program of the wrong length', 'qb1z94c3vs4hy6cygqtz0j5lhtpj7hy9xra33y588j', 'invalid qbit P2MR witness program length: expected 32 bytes, got 20'],
      ['a testnet4 Base58 address', 'qPDfMtPEnPokNLwir57fSiKs9qN1BS5LNf', 'invalid qbit Base58 address prefix: 120'],
    ])('responds 400 for %s', async (_label, address, reason) => {
      mockedApi.$getAddress.mockRejectedValue(electrsError(400, reason));

      const res = await fetch(baseUrl + `address/${address}`);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: reason });
      expect(mockedApi.$getAddress).toHaveBeenCalledWith(address);
    });

    test.each([
      ['fewer than 2 characters', 'q'],
      ['more than 120 characters', 'q'.repeat(121)],
    ])('responds 400 without a lookup for %s', async (_label, address) => {
      const res = await fetch(baseUrl + `address/${address}`);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid address' });
      expect(mockedApi.$getAddress).not.toHaveBeenCalled();
    });

    test('keeps 413 for an address history over the electrum server limit', async () => {
      config.MEMPOOL.BACKEND = 'electrum';
      mockedApi.$getAddress.mockRejectedValue(new Error('electrum history too long'));

      const res = await fetch(baseUrl + `address/${ADDRESS}`);

      expect(res.status).toBe(413);
      expect(await res.json()).toEqual({ error: 'electrum history too long' });
    });
  });

  // electrum mode checks addresses with the node's validateaddress RPC
  test.each(routes.filter(([route]) => !esploraOnly.includes(route)))('GET %s responds 400 when the node rejects the address under the electrum backend', async (route, lookup) => {
    config.MEMPOOL.BACKEND = 'electrum';
    mockedApi[lookup].mockRejectedValue(new Error('Invalid Bitcoin address'));

    const res = await fetch(baseUrl + route.replace(':address', 'notanaddress'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid Bitcoin address' });
  });

  describe.each(routes.filter(([route]) => route.endsWith('/txs') || route.endsWith('/txs/summary')))('GET %s?after_txid', (route, lookup) => {
    const txid = '053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b';
    const url = (afterTxid: string): string => baseUrl + route.replace(':address', ADDRESS) + `?after_txid=${encodeURIComponent(afterTxid)}`;

    test('passes a valid txid through', async () => {
      mockedApi[lookup].mockResolvedValue([]);

      const res = await fetch(url(txid));

      expect(res.status).toBe(200);
      expect(mockedApi[lookup]).toHaveBeenCalledWith(ADDRESS, txid);
    });

    // $getAddressTransactionSummary appends it to the electrs request path
    test('responds 400 without a lookup for anything else', async () => {
      const res = await fetch(url('../../../broadcast?tx=00'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockedApi[lookup]).not.toHaveBeenCalled();
    });

    test('responds 422 when electrs cannot find the txid, which makes the address page reload', async () => {
      mockedApi[lookup].mockRejectedValue(electrsError(422, 'after_txid not found'));

      const res = await fetch(url(txid));

      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: 'after_txid not found' });
    });
  });

  describe('GET address/:address/txs/chain/:last_seen_txid', () => {
    const txid = '053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b';
    const url = (lastSeenTxId: string): string => baseUrl + `address/${ADDRESS}/txs/chain/${lastSeenTxId}`;

    test('asks electrs for the first page without one', async () => {
      mockedApi.$getAddressChainTransactions.mockResolvedValue([]);

      const res = await fetch(baseUrl + `address/${ADDRESS}/txs/chain`);

      expect(res.status).toBe(200);
      expect(mockedApi.$getAddressChainTransactions).toHaveBeenCalledWith(ADDRESS, undefined);
    });

    test('passes a valid txid through', async () => {
      const data = [{ txid, status: { confirmed: true } }];
      mockedApi.$getAddressChainTransactions.mockResolvedValue(data);

      const res = await fetch(url(txid));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(data);
      expect(mockedApi.$getAddressChainTransactions).toHaveBeenCalledWith(ADDRESS, txid);
    });

    // $getAddressChainTransactions appends it to the electrs request path
    test.each([
      ['a path', encodeURIComponent('../../../broadcast?tx=00')],
      ['63 hex characters', txid.slice(1)],
      ['65 hex characters', txid + '0'],
      ['a non-hex character', 'g' + txid.slice(1)],
    ])('responds 400 without a lookup for %s', async (_label, lastSeenTxId) => {
      const res = await fetch(url(lastSeenTxId));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockedApi.$getAddressChainTransactions).not.toHaveBeenCalled();
    });
  });

  describe.each(['none', 'electrum'])('under the %s backend', (backendName) => {
    test.each(routes.filter(([route]) => esploraOnly.includes(route) && !route.endsWith('/summary')))('GET %s responds 405 without a lookup', async (route, lookup) => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;

      const res = await fetch(baseUrl + route.replace(':address', ADDRESS));

      expect(res.status).toBe(405);
      expect(mockedApi[lookup]).not.toHaveBeenCalled();
    });
  });

  describe('GET validate-address/:address', () => {
    test('passes the address to the node', async () => {
      const result = { isvalid: true, address: ADDRESS };
      const validateAddress = jest.spyOn(bitcoinClient, 'validateAddress').mockResolvedValue(result);

      const res = await fetch(baseUrl + `validate-address/${ADDRESS}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(result);
      expect(validateAddress).toHaveBeenCalledWith(ADDRESS);
    });

    test('responds 400 without asking the node for characters no address contains', async () => {
      const validateAddress = jest.spyOn(bitcoinClient, 'validateAddress');

      const res = await fetch(baseUrl + 'validate-address/qb1-bad');

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid address' });
      expect(validateAddress).not.toHaveBeenCalled();
    });
  });
});
