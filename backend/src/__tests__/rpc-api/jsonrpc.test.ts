import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { AddressInfo } from 'net';
const { JsonRPC } = require('../../rpc-api/jsonrpc');

interface StandInNode {
  port: number;
  // the user:password of every request, in order
  auth: string[];
  // the methods qbitd ran, after accepting the credentials
  ran: string[];
  close: () => Promise<void>;
}

// Answers like qbitd: 401 with an empty body unless the request carries the
// credentials `accepts` returns, and the method name as the result otherwise.
function startNode(accepts: () => string | null): Promise<StandInNode> {
  const node = { auth: [] as string[], ran: [] as string[] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const auth = Buffer.from((req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString();
      node.auth.push(auth);
      if (auth !== accepts()) {
        res.writeHead(401);
        res.end();
        return;
      }
      const request = JSON.parse(body);
      node.ran.push(request.method);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: request.method, error: null, id: request.id }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      ...node,
      port: (server.address() as AddressInfo).port,
      close: () => new Promise((done) => server.close(() => done())),
    }));
  });
}

describe('JsonRPC cookie authentication', () => {
  let dir: string;
  let cookieFile: string;
  let node: StandInNode | undefined;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonrpc-cookie-'));
    cookieFile = path.join(dir, '.cookie');
  });

  afterEach(async () => {
    await node?.close();
    node = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const client = (opts: object) => new JsonRPC({ host: '127.0.0.1', port: node?.port, timeout: 5000, ...opts });

  test('retries a call once with the new cookie after qbitd restarts', async () => {
    fs.writeFileSync(cookieFile, '__cookie__:first');
    node = await startNode(() => fs.readFileSync(cookieFile, 'utf8'));
    const rpc = client({ cookie: cookieFile });

    await expect(rpc.call('getblockcount', [])).resolves.toBe('getblockcount');
    // qbitd restarted: it rejects the cached cookie before running the call
    fs.writeFileSync(cookieFile, '__cookie__:second');
    await expect(rpc.call('sendrawtransaction', ['00'])).resolves.toBe('sendrawtransaction');
    await expect(rpc.call('getblockcount', [])).resolves.toBe('getblockcount');

    expect(node.auth).toStrictEqual(['__cookie__:first', '__cookie__:first', '__cookie__:second', '__cookie__:second']);
    // the broadcast ran once
    expect(node.ran).toStrictEqual(['getblockcount', 'sendrawtransaction', 'getblockcount']);
  });

  test('retries only once, and not at all when the cookie file is unchanged', async () => {
    fs.writeFileSync(cookieFile, '__cookie__:first');
    node = await startNode(() => '__cookie__:other');
    const rpc = client({ cookie: cookieFile });

    await expect(rpc.call('getblockcount', [])).rejects.toThrow('response status code: 401');
    expect(node.auth).toStrictEqual(['__cookie__:first']);

    fs.writeFileSync(cookieFile, '__cookie__:second');
    await expect(rpc.call('getblockcount', [])).rejects.toThrow('response status code: 401');
    expect(node.auth).toStrictEqual(['__cookie__:first', '__cookie__:second']);
  });

  test('never falls back to the user name and password when the cookie can\'t be read', async () => {
    node = await startNode(() => 'mempool:mempool');
    for (const cookie of ['', path.join(dir, 'missing', '.cookie')]) {
      const rpc = client({ cookie, user: 'mempool', pass: 'mempool' });

      await expect(rpc.call('getblockcount', [])).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(node.auth).toStrictEqual([]);
  });

  test('uses the user name and password without a cookie', async () => {
    node = await startNode(() => 'mempool:secret');
    const rpc = client({ user: 'mempool', pass: 'secret' });

    await expect(rpc.call('getblockcount', [])).resolves.toBe('getblockcount');
    expect(node.auth).toStrictEqual(['mempool:secret']);
  });
});
