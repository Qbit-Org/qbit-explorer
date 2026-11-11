import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getAddressPrefix: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import EsploraApi from '../../api/bitcoin/esplora-api';
import logger from '../../logger';

// P2MR output of mainnet block 161370
const ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';

const getAddressPrefix = jest.mocked(bitcoinApi.$getAddressPrefix);

// The search box asks for address suggestions for whatever is typed
describe('GET address-prefix/:prefix', () => {
  let server: http.Server;
  let baseUrl: string;

  const suggest = async (prefix: string): Promise<{ status: number, body: unknown }> => {
    const res = await fetch(baseUrl + 'address-prefix/' + prefix);
    return { status: res.status, body: await res.json() };
  };

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
    jest.clearAllMocks();
    getAddressPrefix.mockReset();
    getAddressPrefix.mockResolvedValue([ADDRESS]);
  });

  test.each([
    ['a pool name', 'Qbit%20Pool'],
    ['a path', 'qb1%2F..%2Fblocks'],
    ['a single character', 'q'],
    ['more characters than an address has', 'q'.repeat(121)],
  ])('suggests nothing for %s, without asking the backend', async (_, prefix) => {
    await expect(suggest(prefix)).resolves.toEqual({ status: 200, body: [] });
    expect(getAddressPrefix).not.toHaveBeenCalled();
  });

  test.each([
    ['QB1ZJRT', 'qb1zjrt'],
    ['TQ1QXY', 'tq1qxy'],
    ['QBRT1QXY', 'qbrt1qxy'],
  ])('looks up the uppercase bech32 prefix %s in lowercase', async (prefix, lowercase) => {
    await expect(suggest(prefix)).resolves.toEqual({ status: 200, body: [ADDRESS] });
    expect(getAddressPrefix).toHaveBeenCalledWith(lowercase);
  });

  test.each([
    ['a lowercase bech32 prefix', 'qb1zjrt'],
    ['a mixed-case prefix, which only base58 has', 'Qb1Zj'],
    ['a base58 prefix', 'QhE2d'],
    ['an uppercase base58 prefix', 'QXH2'],
  ])('looks up %s as typed', async (_, prefix) => {
    await expect(suggest(prefix)).resolves.toEqual({ status: 200, body: [ADDRESS] });
    expect(getAddressPrefix).toHaveBeenCalledWith(prefix);
  });

  test('answers 500 when the lookup fails', async () => {
    getAddressPrefix.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3000'));

    await expect(suggest('qb1')).resolves.toEqual({ status: 500, body: { error: 'Failed to get address prefix' } });
  });

  describe('with the esplora backend', () => {
    let electrs: http.Server;
    let electrsUrl: string;
    // What qbit-electrs answers: status, content type, body
    let electrsAnswer: [number, string, string];
    const electrsRequests: string[] = [];

    beforeAll(async () => {
      electrs = http.createServer((req, res) => {
        electrsRequests.push(req.url || '');
        res.writeHead(electrsAnswer[0], { 'content-type': electrsAnswer[1] });
        res.end(electrsAnswer[2]);
      });
      await new Promise<void>((resolve) => electrs.listen(0, '127.0.0.1', resolve));
      electrsUrl = `http://127.0.0.1:${(electrs.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      electrs.closeAllConnections();
      await new Promise((resolve) => electrs.close(resolve));
    });

    beforeEach(() => {
      electrsRequests.length = 0;
      // a new client each time, so no test inherits another's cached answer
      const esplora = new EsploraApi();
      Object.assign(esplora['failoverRouter'].activeHost, { host: electrsUrl, socket: false });
      getAddressPrefix.mockImplementation((prefix) => esplora.$getAddressPrefix(prefix));
    });

    // The esplora client logs failed requests as warnings
    test('suggests nothing, and logs no failed request, when qbit-electrs runs without --address-search', async () => {
      electrsAnswer = [400, 'text/plain', 'address search disabled'];

      await expect(suggest('qb1zjrt')).resolves.toEqual({ status: 200, body: [] });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('suggests the addresses qbit-electrs finds when it runs with --address-search', async () => {
      electrsAnswer = [200, 'application/json', JSON.stringify([ADDRESS])];

      await expect(suggest('QB1ZJRT')).resolves.toEqual({ status: 200, body: [ADDRESS] });
      expect(electrsRequests).toStrictEqual(['/address-prefix/qb1zjrt']);
    });
  });
});
