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

import config from '../../config';
import bitcoinApi, { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';

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
    // as the backend's index.ts parses request bodies
    app.use(express.text({ type: ['text/plain', 'application/base64'] }));
    app.use(express.json());
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
});
