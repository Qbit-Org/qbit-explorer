import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getRawTransaction: jest.fn(),
    $getTransactionHex: jest.fn(),
    $getRawBlock: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

import config from '../../config';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';

const mockedApi = bitcoinApi as unknown as {
  $getRawTransaction: jest.Mock;
  $getTransactionHex: jest.Mock;
  $getRawBlock: jest.Mock;
};

const TXID = '3ffb184548cc3a1bf2eeba04dfa6b59484e1d2fc7d598b8c82934552f668b170';
const TX_HEX = '02000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0402e8030effffffff0100f2052a01000000015100000000';
const BLOCK_HASH = '0000000000000001f347b587d7ea3e72c5fd1dee42d48a2d7355e1842d08e315';

function axiosError(status: number): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
}

describe('raw transaction and raw block routes', () => {
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
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // electrs' /tx/:txid JSON has no `hex` field
    mockedApi.$getRawTransaction.mockResolvedValue({ txid: TXID, version: 2, locktime: 0, vin: [], vout: [] });
  });

  describe('GET tx/:txId/hex', () => {
    test('responds with the transaction hex as text/plain', async () => {
      mockedApi.$getTransactionHex.mockResolvedValue(TX_HEX);

      const res = await fetch(baseUrl + `tx/${TXID}/hex`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
      expect(await res.text()).toBe(TX_HEX);
      expect(mockedApi.$getTransactionHex).toHaveBeenCalledWith(TXID);
    });

    test('responds with the hex of a transaction larger than 3.4 MB', async () => {
      // A capturing group in the hex check overflows the stack from about 6.7M characters
      const largeHex = 'ab'.repeat(3_500_000);
      mockedApi.$getTransactionHex.mockResolvedValue(largeHex);

      const res = await fetch(baseUrl + `tx/${TXID}/hex`);

      expect(res.status).toBe(200);
      expect((await res.text()).length).toBe(largeHex.length);
    });

    test('responds 404 when the transaction is unknown', async () => {
      mockedApi.$getTransactionHex.mockRejectedValue(axiosError(404));

      const res = await fetch(baseUrl + `tx/${TXID}/hex`);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'No such mempool or blockchain transaction' });
    });

    test('responds 404 for Bitcoin Core not-found errors', async () => {
      mockedApi.$getTransactionHex.mockRejectedValue(new Error('No such mempool or blockchain transaction. Use gettransaction for wallet transactions.'));

      const res = await fetch(baseUrl + `tx/${TXID}/hex`);

      expect(res.status).toBe(404);
    });

    test('responds 500 when the backend fails', async () => {
      mockedApi.$getTransactionHex.mockRejectedValue(axiosError(503));

      const res = await fetch(baseUrl + `tx/${TXID}/hex`);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get raw transaction' });
    });

    test.each([
      ['undefined', undefined],
      ['an empty string', ''],
      ['a number', 1000],
      ['an object', { txid: TXID }],
      ['a non-hex string', 'not hex'],
      ['an odd-length hex string', '020'],
    ])('responds 500 instead of 200 when the backend returns %s', async (_label, value) => {
      mockedApi.$getTransactionHex.mockResolvedValue(value);

      const res = await fetch(baseUrl + `tx/${TXID}/hex`);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get raw transaction' });
    });

    test('rejects an invalid txid', async () => {
      const res = await fetch(baseUrl + 'tx/not-a-txid/hex');

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockedApi.$getTransactionHex).not.toHaveBeenCalled();
    });
  });

  // Esplora's tx/:txid/raw: the transaction tx/:txId/hex answers with, as bytes
  describe('GET tx/:txId/raw', () => {
    test('responds with the transaction bytes as application/octet-stream', async () => {
      mockedApi.$getTransactionHex.mockResolvedValue(TX_HEX);

      const res = await fetch(baseUrl + `tx/${TXID}/raw`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
      expect(Buffer.from(await res.arrayBuffer())).toStrictEqual(Buffer.from(TX_HEX, 'hex'));
      expect(mockedApi.$getTransactionHex).toHaveBeenCalledWith(TXID);
    });

    test('responds with the bytes of a transaction larger than 3.4 MB', async () => {
      mockedApi.$getTransactionHex.mockResolvedValue('ab'.repeat(3_500_000));

      const res = await fetch(baseUrl + `tx/${TXID}/raw`);

      expect(res.status).toBe(200);
      expect((await res.arrayBuffer()).byteLength).toBe(3_500_000);
    });

    test.each([
      ['an esplora 404', axiosError(404)],
      ['a Bitcoin Core not-found error', new Error('No such mempool or blockchain transaction. Use gettransaction for wallet transactions.')],
    ])('responds 404 for %s', async (_label, error) => {
      mockedApi.$getTransactionHex.mockRejectedValue(error);

      const res = await fetch(baseUrl + `tx/${TXID}/raw`);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'No such mempool or blockchain transaction' });
    });

    test.each([
      ['the backend fails', axiosError(503), undefined],
      ['the backend returns an empty string', undefined, ''],
      ['the backend returns an odd-length hex string', undefined, '020'],
    ])('responds 500 when %s', async (_label, error, value) => {
      if (error) {
        mockedApi.$getTransactionHex.mockRejectedValue(error);
      } else {
        mockedApi.$getTransactionHex.mockResolvedValue(value);
      }

      const res = await fetch(baseUrl + `tx/${TXID}/raw`);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get raw transaction' });
    });

    test('rejects an invalid txid', async () => {
      const res = await fetch(baseUrl + 'tx/not-a-txid/raw');

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockedApi.$getTransactionHex).not.toHaveBeenCalled();
    });

    // it reads the hex every backend serves for tx/:txId/hex
    test.each(['none', 'electrum', 'esplora'])('answers under the %s backend', async (backendName) => {
      const backend = config.MEMPOOL.BACKEND;
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
      mockedApi.$getTransactionHex.mockResolvedValue(TX_HEX);

      try {
        const res = await fetch(baseUrl + `tx/${TXID}/raw`);

        expect(res.status).toBe(200);
        expect(Buffer.from(await res.arrayBuffer())).toStrictEqual(Buffer.from(TX_HEX, 'hex'));
      } finally {
        config.MEMPOOL.BACKEND = backend;
      }
    });
  });

  describe('GET block/:hash/raw', () => {
    test('responds with the raw block bytes', async () => {
      const raw = Buffer.from('00e0133200ff10', 'hex');
      mockedApi.$getRawBlock.mockResolvedValue(raw);

      const res = await fetch(baseUrl + `block/${BLOCK_HASH}/raw`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
      expect(Buffer.from(await res.arrayBuffer())).toStrictEqual(raw);
    });

    test('responds 404 when the block is unknown', async () => {
      mockedApi.$getRawBlock.mockRejectedValue(axiosError(404));

      const res = await fetch(baseUrl + `block/${BLOCK_HASH}/raw`);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Failed to get raw block' });
    });

    test('responds 500 when the backend fails', async () => {
      mockedApi.$getRawBlock.mockRejectedValue(axiosError(503));

      const res = await fetch(baseUrl + `block/${BLOCK_HASH}/raw`);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get raw block' });
    });
  });
});
