import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

// The routes reach qbitd through the real RPC client, pointed at a stand-in for qbitd's RPC server, so they see the
// errors the client really raises: a refused connection, a timeout, an HTTP answer that isn't JSON-RPC, or qbitd's
// JSON-RPC error.
const mockRpc: { client?: Record<string, (...args: unknown[]) => Promise<unknown>> } = {};
jest.mock('../../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: {
    sendRawTransaction: (...args: unknown[]): Promise<unknown> => mockRpc.client!.sendRawTransaction(...args),
    testMempoolAccept: (...args: unknown[]): Promise<unknown> => mockRpc.client!.testMempoolAccept(...args),
    submitPackage: (...args: unknown[]): Promise<unknown> => mockRpc.client!.submitPackage(...args),
  },
}));

import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RpcClient = require('../../rpc-api/index').Client;

// One input with an empty scriptSig, paying 1,000 bits to a P2MR output
const TX_HEX = '02000000' + '01' + 'ab'.repeat(32) + '00000000' + '00' + 'ffffffff'
  + '01' + 'e803000000000000' + '22' + '5220' + 'cd'.repeat(32) + '00000000';
const UNAVAILABLE = { error: 'qbitd is unavailable, try again later' };

// Each route that sends transactions to qbitd, its request, and the RPC it calls
const routes: [string, string, RequestInit][] = [
  ['tx', 'sendrawtransaction', { headers: { 'Content-Type': 'text/plain' }, body: TX_HEX }],
  ['tx/push', 'sendrawtransaction', { headers: { 'Content-Type': 'text/plain' }, body: 'txHash=' + TX_HEX }],
  ['txs/test', 'testmempoolaccept', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([TX_HEX]) }],
  ['txs/package', 'submitpackage', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([TX_HEX]) }],
];

// How the stand-in answers a call: qbitd's JSON-RPC error, as qbitd sends it with HTTP 500, or a bare HTTP answer
type Answer = { rpcError: [number, string] } | { status: number, text: string } | 'never';
const rpcError = (code: number, message: string): Answer => ({ rpcError: [code, message] });

describe('broadcast routes when qbitd fails', () => {
  let qbitd: http.Server;
  let qbitdPort: number;
  let answer: Answer;
  let server: http.Server;
  let baseUrl: string;

  const useQbitd = (port: number, timeout = 2000): void => {
    mockRpc.client = new RpcClient({ host: '127.0.0.1', port, user: 'u', pass: 'p', timeout });
  };
  const post = (route: string, init: RequestInit): Promise<Response> => fetch(baseUrl + route,
    { ...init, method: 'POST', headers: { ...init.headers as Record<string, string>, 'Accept': 'application/json' } });

  beforeAll(async () => {
    qbitd = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => body += chunk);
      req.on('end', () => {
        if (answer === 'never') {
          return;
        }
        if ('rpcError' in answer) {
          const [code, message] = answer.rpcError;
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result: null, error: { code, message }, id: JSON.parse(body).id }));
          return;
        }
        res.writeHead(answer.status);
        res.end(answer.text);
      });
    });
    await new Promise<void>((resolve) => qbitd.listen(0, '127.0.0.1', resolve));
    qbitdPort = (qbitd.address() as AddressInfo).port;

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
    for (const s of [server, qbitd]) {
      s.closeAllConnections();
      await new Promise((resolve) => s.close(resolve));
    }
  });

  beforeEach(() => {
    useQbitd(qbitdPort);
  });

  describe.each(routes)('POST %s', (route, method, init) => {
    test('answers 503 when nothing listens on qbitd\'s RPC port', async () => {
      // a port that was free a moment ago
      const closed = http.createServer();
      await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
      const port = (closed.address() as AddressInfo).port;
      await new Promise((resolve) => closed.close(resolve));
      useQbitd(port);

      const res = await post(route, init);

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual(UNAVAILABLE);
    });

    test('answers 503 when qbitd doesn\'t answer in time', async () => {
      answer = 'never';
      useQbitd(qbitdPort, 200);

      const res = await post(route, init);

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual(UNAVAILABLE);
    });

    test.each([
      ['401, as for a wrong RPC login', { status: 401, text: '' }],
      ['403, as for an address rpcallowip doesn\'t allow', { status: 403, text: '' }],
      ['503 "Work queue depth exceeded"', { status: 503, text: 'Work queue depth exceeded' }],
      ['-28, while it warms up', rpcError(-28, 'Loading block index…')],
      // qbit v1.0.0 answers -10 only from importmempool, but it means the same
      ['-10, while it downloads the initial blocks', rpcError(-10, 'Still downloading initial blocks')],
    ])('answers 503 when qbitd answers %s', async (_answer, qbitdAnswer) => {
      answer = qbitdAnswer as Answer;

      const res = await post(route, init);

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual(UNAVAILABLE);
    });

    test('still answers 400 with the code when qbitd turns the transaction down', async () => {
      answer = rpcError(-26, 'min relay fee not met');

      const res = await post(route, init);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: `${method} RPC error: {"code":-26}` });
    });
  });

  test.each([
    [-25, 'bad-txns-inputs-missingorspent'],
    [-27, 'Transaction outputs already in utxo set'],
    [-22, 'TX decode failed'],
  ])('POST tx still answers 400 for qbitd\'s %d', async (code, message) => {
    answer = rpcError(code, message);

    const res = await post('tx', routes[0][2]);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: `sendrawtransaction RPC error: {"code":${code}}` });
  });

  test('POST tx answers the txid when qbitd takes the transaction', async () => {
    answer = { status: 200, text: JSON.stringify({ result: 'ab'.repeat(32), error: null, id: 1 }) };

    const res = await post('tx', routes[0][2]);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ab'.repeat(32));
  });
});
