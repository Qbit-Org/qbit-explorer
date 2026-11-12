import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $sendRawTransaction: jest.fn(),
    $testMempoolAccept: jest.fn(),
  },
  bitcoinCoreApi: {
    $sendRawTransaction: jest.fn(),
    $testMempoolAccept: jest.fn(),
  },
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import config from '../../config';
import bitcoinApi, { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';

type BroadcastMethod = '$sendRawTransaction' | '$testMempoolAccept';
const mockedApi = bitcoinApi as unknown as Record<BroadcastMethod, jest.Mock>;
const mockedCoreApi = bitcoinCoreApi as unknown as Record<BroadcastMethod, jest.Mock>;

// One input with an empty scriptSig, paying 1,000 bits to a P2MR output
const TX_HEX = '02000000' + '01' + 'ab'.repeat(32) + '00000000' + '00' + 'ffffffff'
  + '01' + 'e803000000000000' + '22' + '5220' + 'cd'.repeat(32) + '00000000';
const TXID = '0c3d3b4bd6a8c4a92da0a2c7e1b7c2e4b8f8b2a0e1d5c8f7a6b9c0d1e2f3a4b5';

// How qbitd's RPC client surfaces a refusal
function coreError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

describe('broadcast routes', () => {
  const backend = config.MEMPOOL.BACKEND;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    // index.ts's body parsers, with its options and order (index.ts lines 139-141). index.ts starts the server when
    // imported, so the tests set them up here, and bitcoin-routes-broadcast.test.ts checks they still match.
    app
      .use(express.urlencoded({ extended: true, limit: '10mb' }))
      .use(express.text({ type: ['text/plain', 'application/base64'], limit: '10mb' }))
      .use(express.json({ limit: '10mb' }))
      ;
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

  // The tests copy index.ts's body parsers: fail when a copy stops matching what index.ts installs
  test('index.ts still installs the body parsers the tests copy', () => {
    const parsers = (file: string): string[] => readFileSync(file, 'utf8').split('\n')
      .map((line) => line.trim()).filter((line) => line.startsWith('.use(express.'));
    const installed = parsers(join(__dirname, '../../index.ts'));
    expect(installed).toHaveLength(3);
    expect(parsers(__filename)).toEqual(installed);
    expect(parsers(join(__dirname, 'bitcoin-routes-broadcast-qbitd.test.ts'))).toEqual(installed);
  });

  describe('under the esplora backend', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      config.MEMPOOL.BACKEND = 'esplora';
      // as the esplora backend answers: it has no way to broadcast
      mockedApi.$sendRawTransaction.mockRejectedValue(new Error('Method not implemented.'));
      mockedApi.$testMempoolAccept.mockRejectedValue(new Error('Method not implemented.'));
    });

    test('POST tx broadcasts through qbitd and answers the txid', async () => {
      mockedCoreApi.$sendRawTransaction.mockResolvedValue(TXID);

      const res = await fetch(baseUrl + 'tx', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: TX_HEX });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
      expect(await res.text()).toBe(TXID);
      expect(mockedCoreApi.$sendRawTransaction).toHaveBeenCalledWith(TX_HEX);
      expect(mockedApi.$sendRawTransaction).not.toHaveBeenCalled();
    });

    test('POST tx passes qbitd\'s refusal code on', async () => {
      mockedCoreApi.$sendRawTransaction.mockRejectedValue(coreError(-25, 'bad-txns-inputs-missingorspent'));

      const res = await fetch(baseUrl + 'tx', {
        method: 'POST', headers: { 'Content-Type': 'text/plain', 'Accept': 'application/json' }, body: TX_HEX,
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'sendrawtransaction RPC error: {"code":-25}' });
    });

    test('POST txs/test asks qbitd', async () => {
      const result = [{ txid: TXID, wtxid: TXID, allowed: true, vsize: 94, fees: { base: 0.00001 } }];
      mockedCoreApi.$testMempoolAccept.mockResolvedValue(result);

      const res = await fetch(baseUrl + 'txs/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([TX_HEX]),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(result);
      expect(mockedCoreApi.$testMempoolAccept.mock.calls[0][0]).toEqual([TX_HEX]);
      expect(mockedApi.$testMempoolAccept).not.toHaveBeenCalled();
    });
  });

  // POST tx takes the hex as the whole body, whatever its content type, as electrs's POST /tx does
  describe('POST tx request bodies', () => {
    const post = (body: string | Uint8Array, headers: Record<string, string> = {}): Promise<Response> =>
      fetch(baseUrl + 'tx', { method: 'POST', headers: { 'Accept': 'application/json', ...headers }, body });

    beforeEach(() => {
      jest.resetAllMocks();
      mockedCoreApi.$sendRawTransaction.mockResolvedValue(TXID);
    });

    test.each([
      ['text/plain', { 'Content-Type': 'text/plain' }],
      // what `curl -d <hex>`, as the API docs show it, sends
      ['a form, as curl -d sends it', { 'Content-Type': 'application/x-www-form-urlencoded' }],
      ['application/octet-stream', { 'Content-Type': 'application/octet-stream' }],
    ])('broadcasts the hex sent as %s', async (_type, headers) => {
      const res = await post(TX_HEX, headers);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe(TXID);
      expect(mockedCoreApi.$sendRawTransaction).toHaveBeenCalledWith(TX_HEX);
    });

    test('broadcasts the hex sent with no content type', async () => {
      // fetch sends bytes without a Content-Type
      const res = await post(new TextEncoder().encode(TX_HEX));

      expect(res.status).toBe(200);
      expect(await res.text()).toBe(TXID);
      expect(mockedCoreApi.$sendRawTransaction).toHaveBeenCalledWith(TX_HEX);
    });

    // the request's fault, which never reaches qbitd: not an RPC error
    test.each([
      ['an empty text/plain body', '', { 'Content-Type': 'text/plain' }, 'Non-hex request body'],
      ['an empty form', '', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'Non-string request body'],
      ['a form with fields', 'txHash=' + TX_HEX + '&x=1', { 'Content-Type': 'application/x-www-form-urlencoded' }, 'Non-string request body'],
      ['text that isn\'t hex', 'hello', { 'Content-Type': 'text/plain' }, 'Non-hex request body'],
      ['octet-stream that isn\'t hex', 'hello', { 'Content-Type': 'application/octet-stream' }, 'Non-hex request body'],
      ['hex that isn\'t a transaction', 'abcd', { 'Content-Type': 'text/plain' }, 'Invalid transaction (could not parse)'],
    ])('answers 400 with the reason for %s', async (_body, body, headers, reason) => {
      const res = await post(body, headers);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: reason });
      expect(mockedCoreApi.$sendRawTransaction).not.toHaveBeenCalled();
    });
  });

  describe('the other broadcast routes\' request bodies', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    test('POST tx/push still takes a txHash= form sent as text', async () => {
      const sendRawTransaction = jest.spyOn(bitcoinClient, 'sendRawTransaction').mockResolvedValue(TXID);

      try {
        const res = await fetch(baseUrl + 'tx/push', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'txHash=' + TX_HEX });

        expect(res.status).toBe(200);
        expect(await res.text()).toBe(TXID);
        expect(sendRawTransaction).toHaveBeenCalledWith(TX_HEX);
      } finally {
        sendRawTransaction.mockRestore();
      }
    });

    test.each(['txs/test', 'txs/package'])('POST %s answers 400 with the reason for a body that isn\'t a list of hex', async (route) => {
      const res = await fetch(baseUrl + route, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ tx: TX_HEX }),
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid request body (should be an array of hexadecimal strings)' });
      expect(mockedCoreApi.$testMempoolAccept).not.toHaveBeenCalled();
    });
  });
});
