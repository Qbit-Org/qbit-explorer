import http from 'http';
import { AddressInfo } from 'net';
import EsploraApi from '../../api/bitcoin/esplora-api';
import logger from '../../logger';
import { getAddressLookupError, isTxNotFoundError } from '../../utils/api';

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

  describe('against an electrs HTTP server', () => {
    const RAW_BLOCK = Buffer.from('00e01332ce72108dd402ed0308506600ff', 'hex');
    // Valid JSON numbers: axios' JSON transform would turn these into numbers
    const NUMERIC_HEX = '1000000000000000000000';
    const LEADING_ZERO_HEX = '0200000001000000';
    const BITCOIN_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    const INVALID_ADDRESS_REASON = 'invalid qbit address HRP: expected qb, got bc';
    // P2MR output of mainnet block 161370
    const QBIT_ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';
    let server: http.Server;
    let api: EsploraApi;
    const requests: string[] = [];
    // What the server answers to /address-prefix/: status, content type, body
    let addressPrefixAnswer: [number, string, string];

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        requests.push(req.url || '');
        if (req.url?.startsWith('/address-prefix/')) {
          res.writeHead(addressPrefixAnswer[0], { 'content-type': addressPrefixAnswer[1] });
          res.end(addressPrefixAnswer[2]);
          return;
        }
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

    describe('address prefix search', () => {
      beforeEach(() => {
        requests.length = 0;
        api['failoverRouter'].activeHost.failures = 0;
        jest.mocked(logger.warn).mockClear();
      });

      test('returns the addresses qbit-electrs finds when it runs with --address-search', async () => {
        addressPrefixAnswer = [200, 'application/json', JSON.stringify([QBIT_ADDRESS])];

        await expect(api.$getAddressPrefix('qb1zjrt')).resolves.toStrictEqual([QBIT_ADDRESS]);
        expect(requests).toStrictEqual(['/address-prefix/qb1zjrt']);
      });

      test('returns no addresses, and counts no host failure, when qbit-electrs runs without --address-search', async () => {
        addressPrefixAnswer = [400, 'text/plain', 'address search disabled'];

        await expect(api.$getAddressPrefix('qb1zjrt')).resolves.toStrictEqual([]);
        expect(logger.warn).not.toHaveBeenCalled();
        expect(api['failoverRouter'].activeHost.failures).toBe(0);
      });

      // electrs answers 400 for its own failures too, so only that reason means no index
      test.each([
        [400, 'Database error'],
        [503, 'Service Unavailable'],
      ])('fails, and logs the failed request, when qbit-electrs answers %d %s', async (status, reason) => {
        addressPrefixAnswer = [status, 'text/plain', reason];

        const error = await api.$getAddressPrefix('qb1zjrt').catch((e) => e);
        expect(error?.response?.status).toBe(status);
        expect(logger.warn).toHaveBeenCalledWith(`esplora request failed ${status} ${api['failoverRouter'].activeHost.host}/address-prefix/qb1zjrt`);
      });

      test.each(['..', 'qb1/../../blocks/tip/height', 'Qbit Pool'])('returns no addresses for %p without asking qbit-electrs', async (prefix) => {
        await expect(api.$getAddressPrefix(prefix)).resolves.toStrictEqual([]);
        expect(requests).toStrictEqual([]);
      });
    });
  });
});
