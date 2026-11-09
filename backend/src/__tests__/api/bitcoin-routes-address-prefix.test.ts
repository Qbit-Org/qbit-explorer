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

// The search box asks for address suggestions as the user types
describe('GET address-prefix/:prefix with the esplora backend', () => {
  let electrs: http.Server;
  let server: http.Server;
  let baseUrl: string;
  // What qbit-electrs answers: status, content type, body
  let electrsAnswer: [number, string, string];

  beforeAll(async () => {
    electrs = http.createServer((req, res) => {
      res.writeHead(electrsAnswer[0], { 'content-type': electrsAnswer[1] });
      res.end(electrsAnswer[2]);
    });
    await new Promise<void>((resolve) => electrs.listen(0, '127.0.0.1', resolve));
    const esplora = new EsploraApi();
    Object.assign(esplora['failoverRouter'].activeHost, {
      host: `http://127.0.0.1:${(electrs.address() as AddressInfo).port}`,
      socket: false,
    });
    jest.mocked(bitcoinApi.$getAddressPrefix).mockImplementation((prefix) => esplora.$getAddressPrefix(prefix));

    const app = express();
    bitcoinRoutes.initRoutes(app);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/`;
  });

  afterAll(async () => {
    for (const s of [server, electrs]) {
      s.closeAllConnections();
      await new Promise((resolve) => s.close(resolve));
    }
  });

  beforeEach(() => {
    jest.mocked(logger.warn).mockClear();
  });

  // The esplora client logs failed requests as warnings
  test('suggests no addresses, and logs no failed request, when qbit-electrs runs without --address-search', async () => {
    electrsAnswer = [400, 'text/plain', 'address search disabled'];

    const res = await fetch(baseUrl + 'address-prefix/qb1zjrt');

    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('suggests the addresses qbit-electrs finds when it runs with --address-search', async () => {
    electrsAnswer = [200, 'application/json', JSON.stringify([ADDRESS])];

    const res = await fetch(baseUrl + 'address-prefix/qb1zjrt');

    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual([ADDRESS]);
  });
});
