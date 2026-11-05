import http from 'http';
import { AddressInfo } from 'net';
import EsploraApi from '../../api/bitcoin/esplora-api';
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
});
