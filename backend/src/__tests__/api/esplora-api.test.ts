import http from 'http';
import { AddressInfo } from 'net';
import config from '../../config';
import EsploraApi from '../../api/bitcoin/esplora-api';
import logger from '../../logger';
import { getAddressLookupError, isTxNotFoundError } from '../../utils/api';

const BITCOIN_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
const INVALID_ADDRESS_REASON = 'invalid qbit address HRP: expected qb, got bc';

describe('Esplora API', () => {
  test('should proxy batched outspends to the public Esplora endpoint', async () => {
    const api = new EsploraApi();
    const batchedOutspends = [
      [
        { spent: true, txid: 'spending-tx', vin: 0 },
        { spent: false },
      ],
      [
        { spent: false },
      ],
    ];
    const get = jest.spyOn(api['failoverRouter'], '$get')
      .mockResolvedValue(batchedOutspends);

    await expect(api.$getBatchedOutspends(['first-tx', 'second-tx']))
      .resolves.toStrictEqual(batchedOutspends);
    expect(get).toHaveBeenCalledWith('/txs/outspends', 'json', {
      txids: 'first-tx,second-tx',
    });
  });

  test.each([
    ['the first page of confirmed transactions', (api: EsploraApi) => api.$getAddressChainTransactions('qb1address'), '/address/qb1address/txs/chain'],
    ['the confirmed transactions after the last one seen', (api: EsploraApi) => api.$getAddressChainTransactions('qb1address', 'last-seen-tx'),
      '/address/qb1address/txs/chain/last-seen-tx'],
    ['the unconfirmed transactions', (api: EsploraApi) => api.$getAddressMempoolTransactions('qb1address'), '/address/qb1address/txs/mempool'],
  ])('should proxy %s of an address to electrs', async (_label, lookup, path) => {
    const api = new EsploraApi();
    const transactions = [{ txid: 'tx' }];
    const get = jest.spyOn(api['failoverRouter'], '$get').mockResolvedValue(transactions);

    await expect(lookup(api)).resolves.toStrictEqual(transactions);
    expect(get).toHaveBeenCalledWith(path);
  });

  describe('against an electrs HTTP server', () => {
    const RAW_BLOCK = Buffer.from('00e01332ce72108dd402ed0308506600ff', 'hex');
    // Valid JSON numbers: axios' JSON transform would turn these into numbers
    const NUMERIC_HEX = '1000000000000000000000';
    const LEADING_ZERO_HEX = '0200000001000000';
    let server: http.Server;
    let api: EsploraApi;

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        if (req.url === `/address/${BITCOIN_ADDRESS}`) {
          res.writeHead(400, { 'content-type': 'text/plain' });
          res.end(INVALID_ADDRESS_REASON);
          return;
        }
        const routes: Record<string, [string, string | Buffer]> = {
          '/tx/numeric/hex': ['text/plain', NUMERIC_HEX],
          '/tx/leading-zero/hex': ['text/plain', LEADING_ZERO_HEX],
          '/block/known/raw': ['application/octet-stream', RAW_BLOCK],
        };
        const route = routes[req.url || ''];
        if (!route) {
          res.writeHead(404, { 'content-type': 'text/plain' });
          res.end('Transaction not found');
          return;
        }
        res.writeHead(200, { 'content-type': route[0] });
        res.end(route[1]);
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      api = new EsploraApi();
      Object.assign(api['failoverRouter'].activeHost, {
        host: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        socket: false,
      });
    });

    afterAll(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });

    test.each([
      ['numeric', NUMERIC_HEX],
      ['leading-zero', LEADING_ZERO_HEX],
    ])('returns the %s text/plain transaction hex unaltered', async (txid, hex) => {
      await expect(api.$getTransactionHex(txid)).resolves.toBe(hex);
    });

    test('surfaces an electrs 404 for an unknown transaction hex as not found', async () => {
      const error = await api.$getTransactionHex('unknown').catch((e) => e);
      expect(error?.response?.status).toBe(404);
      expect(isTxNotFoundError(error)).toBe(true);
    });

    test('returns the raw block bytes', async () => {
      await expect(api.$getRawBlock('known')).resolves.toStrictEqual(RAW_BLOCK);
    });

    test('surfaces an electrs 404 for an unknown raw block', async () => {
      const error = await api.$getRawBlock('unknown').catch((e) => e);
      expect(error?.response?.status).toBe(404);
    });

    test('surfaces an electrs 400 for an invalid address with its plain-text reason', async () => {
      const error = await api.$getAddress(BITCOIN_ADDRESS).catch((e) => e);
      expect(error?.response?.status).toBe(400);
      expect(getAddressLookupError(error)).toEqual({ status: 400, reason: INVALID_ADDRESS_REASON });
    });
  });

  describe('failover between electrs hosts', () => {
    const esplora = { ...config.ESPLORA };
    const official = config.MEMPOOL.OFFICIAL;
    // the configured host, which answers every request with `answer`, and its
    // fallback, which answers 500
    let primary: http.Server;
    let fallback: http.Server;
    let primaryPort: number;
    let primaryUrl: string;
    let fallbackUrl: string;
    let answer: [number, string];
    let api: EsploraApi;

    const listen = (server: http.Server, port = 0): Promise<void> => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    const close = (server: http.Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));
    const activeHost = (): string | undefined => api.getHealthStatus().find((host) => host.active)?.host;
    const isUnreachable = (url: string): boolean | undefined => api.getHealthStatus().find((host) => host.host === url)?.unreachable;

    beforeAll(async () => {
      // closing each connection after answering lets a closed listener refuse the next request
      primary = http.createServer((req, res) => {
        res.writeHead(answer[0], { 'content-type': answer[0] === 200 ? 'application/json' : 'text/plain', connection: 'close' });
        res.end(answer[1]);
      });
      fallback = http.createServer((req, res) => {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('Internal Server Error');
      });
      await listen(primary);
      await listen(fallback);
      primaryPort = (primary.address() as AddressInfo).port;
      primaryUrl = `http://127.0.0.1:${primaryPort}`;
      fallbackUrl = `http://127.0.0.1:${(fallback.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      Object.assign(config.ESPLORA, esplora);
      config.MEMPOOL.OFFICIAL = official;
      for (const server of [primary, fallback]) {
        server.closeAllConnections();
        if (server.listening) {
          await close(server);
        }
      }
    });

    beforeEach(() => {
      jest.clearAllMocks();
      config.ESPLORA.REST_API_URL = primaryUrl;
      config.ESPLORA.FALLBACK = [fallbackUrl];
      // only official instances list their hosts in getHealthStatus
      config.MEMPOOL.OFFICIAL = true;
      api = new EsploraApi();
    });

    test.each([
      ['an unknown object', 404, 'Transaction not found'],
      ['an invalid address', 400, INVALID_ADDRESS_REASON],
      ['an address over the UTXO limit', 400, 'Too many unspent transaction outputs (>50000). Contact support to raise limits.'],
      ['an address over the history limit', 400, 'Too many history transactions (>10000). Contact support to raise limits.'],
      ['an after_txid it cannot find', 422, 'after_txid not found'],
    ])('keeps a host that rejects %s, logging it at debug', async (_, code, reason) => {
      answer = [code, reason];

      for (let i = 0; i < 10; i++) {
        await expect(api.$getAddress(BITCOIN_ADDRESS)).rejects.toMatchObject({ response: { status: code } });
      }

      expect(activeHost()).toBe(primaryUrl);
      expect(isUnreachable(primaryUrl)).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(`esplora request rejected ${code} ${primaryUrl}/address/${BITCOIN_ADDRESS}`);
    });

    test.each([
      ['electrs losing its node', 400, 'Connection error: disconnected from daemon while receiving'],
      ['an electrs node error', 400, 'getblock RPC error: connection refused'],
      ['an electrs database error', 400, 'Corruption: block checksum mismatch'],
      ['a 422 electrs does not send', 422, 'Unprocessable Entity'],
      ['a proxy refusing access', 403, 'Forbidden'],
      ['a proxy asking for credentials', 401, 'Unauthorized'],
      ['a proxy asking for proxy credentials', 407, 'Proxy Authentication Required'],
      ['a misdirected request', 421, 'Misdirected Request'],
      ['a proxy closing the request', 499, ''],
      ['a timeout', 408, 'Request Timeout'],
      ['a rate limit', 429, 'Too Many Requests'],
      ['an internal error', 500, 'Internal Server Error'],
      ['a bad gateway', 502, 'Bad Gateway'],
    ])('fails a host over for %s (%d)', async (_, code, reason) => {
      answer = [code, reason];

      for (let i = 0; i < 6; i++) {
        await expect(api.$getAddress(BITCOIN_ADDRESS)).rejects.toMatchObject({ response: { status: code } });
      }

      expect(activeHost()).toBe(fallbackUrl);
      expect(isUnreachable(primaryUrl)).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(`esplora request failed ${code} ${primaryUrl}/address/${BITCOIN_ADDRESS}`);
    });

    test('keeps the active host when the fallback it retries refused requests on fails', async () => {
      // The router picks its fallback in its minute-long health poll, which
      // also fetches each host's public web origin and re-arms its own timer,
      // so set the fallback that poll would pick instead of running it.
      const router = api['failoverRouter'];
      router.fallbackHost = router.hosts.find((host) => host.host === fallbackUrl)!;
      answer = [200, '{}'];

      // the primary refuses every other connection, and each refused request
      // is retried on the fallback, which fails it
      for (let i = 0; i < 6; i++) {
        await close(primary);
        await expect(api.$getAddress(BITCOIN_ADDRESS)).rejects.toMatchObject({ response: { status: 500 } });
        await listen(primary, primaryPort);
        await expect(api.$getAddress(BITCOIN_ADDRESS)).resolves.toEqual({});
      }

      expect(activeHost()).toBe(primaryUrl);
      expect(isUnreachable(primaryUrl)).toBe(false);
      expect(isUnreachable(fallbackUrl)).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Too many esplora failures on ${fallbackUrl},`));
    });
  });

  describe('address prefix search', () => {
    // P2MR output of mainnet block 161370
    const QBIT_ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';
    // qbit-electrs's answers, as status, content type and body
    const FOUND: [number, string, string] = [200, 'application/json', JSON.stringify([QBIT_ADDRESS])];
    const DISABLED: [number, string, string] = [400, 'text/plain', 'address search disabled'];
    // a qbit-electrs host's answer, and the requests it got, as "<host> <path>"
    const servers: http.Server[] = [];
    const urls: string[] = [];
    const answers: [number, string, string][] = [];
    const requests: string[] = [];
    let api: EsploraApi;

    beforeAll(async () => {
      for (const i of [0]) {
        const server = http.createServer((req, res) => {
          requests.push(`${i} ${req.url}`);
          res.writeHead(answers[i][0], { 'content-type': answers[i][1] });
          res.end(answers[i][2]);
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        servers.push(server);
        urls.push(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
      }
    });

    afterAll(async () => {
      for (const server of servers) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    });

    beforeEach(() => {
      jest.clearAllMocks();
      requests.length = 0;
      api = new EsploraApi();
      Object.assign(api['failoverRouter'].activeHost, { host: urls[0], socket: false });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns the addresses a host running with --address-search finds', async () => {
      answers[0] = FOUND;

      await expect(api.$getAddressPrefix('qb1zjrt')).resolves.toStrictEqual([QBIT_ADDRESS]);
      expect(requests).toStrictEqual(['0 /address-prefix/qb1zjrt']);
    });

    test('returns no addresses from a host without --address-search, without a warning or a counted failure', async () => {
      answers[0] = DISABLED;

      await expect(api.$getAddressPrefix('qb1zjrt')).resolves.toStrictEqual([]);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(`esplora request rejected 400 ${urls[0]}/address-prefix/qb1zjrt`);
      expect(api['failoverRouter'].activeHost.failures).toBe(0);
    });

    test('asks again on every search, so a host given its index answers at once', async () => {
      answers[0] = DISABLED;
      await expect(api.$getAddressPrefix('qb1')).resolves.toStrictEqual([]);

      answers[0] = FOUND;
      await expect(api.$getAddressPrefix('qb1z')).resolves.toStrictEqual([QBIT_ADDRESS]);
      expect(requests).toStrictEqual(['0 /address-prefix/qb1', '0 /address-prefix/qb1z']);
    });

    // electrs answers 400 for its own failures too, so only that reason means no index
    test.each([
      [400, 'Corruption: block checksum mismatch'],
      [503, 'Service Unavailable'],
    ])('fails on a %d %p, logging it, and asks again next time', async (status, reason) => {
      answers[0] = [status, 'text/plain', reason];

      await expect(api.$getAddressPrefix('qb1')).rejects.toMatchObject({ response: { status } });
      expect(logger.warn).toHaveBeenCalledWith(`esplora request failed ${status} ${urls[0]}/address-prefix/qb1`);
      await expect(api.$getAddressPrefix('qb1')).rejects.toMatchObject({ response: { status } });
      expect(requests).toStrictEqual(['0 /address-prefix/qb1', '0 /address-prefix/qb1']);
    });
  });
});
