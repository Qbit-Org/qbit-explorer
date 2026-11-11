import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getOutspends: jest.fn(),
    $getBlockHeader: jest.fn(),
    $getScriptHashUtxos: jest.fn(),
    $getBatchedOutspends: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

import config from '../../config';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';

const mockedApi = bitcoinApi as unknown as Record<'$getOutspends' | '$getBlockHeader' | '$getScriptHashUtxos' | '$getBatchedOutspends', jest.Mock>;

// qbit mainnet block 163,891 and a transaction of block 161,388
const BLOCK_HASH = '00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401';
const TXID = '053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b';

const malformedHexIds: [string, string][] = [
  ['a non-hex value', 'not-a-txid'],
  ['63 hex characters', TXID.slice(1)],
  ['65 hex characters', TXID + '0'],
];

// Upstream master answers 400 for these, as the address routes here do. 501 means the server lacks the feature.
describe('routes that validate a txid, block hash or scripthash', () => {
  const backend = config.MEMPOOL.BACKEND;
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
    config.MEMPOOL.BACKEND = backend;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.resetAllMocks();
    config.MEMPOOL.BACKEND = 'esplora';
  });

  describe.each([
    'cpfp/:txid',
    'tx/:txid',
    'tx/:txid/hex',
    'tx/:txid/raw',
    'tx/:txid/status',
    'tx/:txid/rbf',
    'tx/:txid/cached',
    'tx/:txid/outspend/0',
    'tx/:txid/outspends',
    'tx/:txid/merkle-proof',
    'tx/:txid/merkleblock-proof',
    `block/${BLOCK_HASH}/tx/:txid/summary`,
    `block/${BLOCK_HASH}/tx/:txid/audit`,
  ])('GET %s', (route) => {
    test.each(malformedHexIds)('responds 400 for %s', async (_label, txid) => {
      const res = await fetch(baseUrl + route.replace(':txid', txid));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
    });
  });

  describe.each([
    'block/:hash',
    'block/:hash/summary',
    `block/:hash/tx/${TXID}/summary`,
    'block/:hash/audit-summary',
    `block/:hash/tx/${TXID}/audit`,
    'block/:hash/header',
    'block/:hash/status',
    'block/:hash/raw',
    'block/:hash/txids',
    'block/:hash/txid/0',
    'block/:hash/txs',
    'block/:hash/txs/10',
  ])('GET %s', (route) => {
    test.each(malformedHexIds)('responds 400 for %s', async (_label, hash) => {
      const res = await fetch(baseUrl + route.replace(':hash', hash));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid block hash' });
    });
  });

  describe.each([
    'scripthash/:scripthash',
    'scripthash/:scripthash/txs',
    'scripthash/:scripthash/utxo',
  ])('GET %s', (route) => {
    test.each([
      ['an odd number of hex characters', TXID.slice(1)],
      ['a non-hex value', 'zz'],
    ])('responds 400 for %s', async (_label, scripthash) => {
      const res = await fetch(baseUrl + route.replace(':scripthash', scripthash));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid scripthash' });
      expect(mockedApi.$getScriptHashUtxos).not.toHaveBeenCalled();
    });
  });

  test.each([
    ['without txId', ''],
    ['with a single txId instead of a list', `?txId=${TXID}`],
  ])('GET transaction-times responds 400 %s', async (_label, query) => {
    const res = await fetch(baseUrl + 'transaction-times' + query);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid txId format' });
  });

  test.each([
    ['without txids', ''],
    ['with empty txids', '?txids='],
    ['with a malformed txid', `?txids=${TXID},not-a-txid`],
  ])('GET txs/outspends responds 400 %s', async (_label, query) => {
    const res = await fetch(baseUrl + 'txs/outspends' + query);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid txids format' });
    expect(mockedApi.$getBatchedOutspends).not.toHaveBeenCalled();
  });

  describe('still accepts', () => {
    test('an upper-case txid', async () => {
      mockedApi.$getOutspends.mockResolvedValue([{ spent: false }]);

      const res = await fetch(baseUrl + `tx/${TXID.toUpperCase()}/outspends`);

      expect(res.status).toBe(200);
      expect(mockedApi.$getOutspends).toHaveBeenCalledWith(TXID.toUpperCase());
    });

    test('an upper-case block hash', async () => {
      mockedApi.$getBlockHeader.mockResolvedValue('00');

      const res = await fetch(baseUrl + `block/${BLOCK_HASH.toUpperCase()}/header`);

      expect(res.status).toBe(200);
      expect(mockedApi.$getBlockHeader).toHaveBeenCalledWith(BLOCK_HASH.toUpperCase());
    });

    test('a scripthash, reversed for electrum', async () => {
      mockedApi.$getScriptHashUtxos.mockResolvedValue([]);

      const res = await fetch(baseUrl + 'scripthash/0011ff/utxo');

      expect(res.status).toBe(200);
      expect(mockedApi.$getScriptHashUtxos).toHaveBeenCalledWith('ff1100');
    });

    test('a list of txids', async () => {
      mockedApi.$getBatchedOutspends.mockResolvedValue([[], []]);

      const res = await fetch(baseUrl + `txs/outspends?txids=${TXID},${TXID.toUpperCase()}`);

      expect(res.status).toBe(200);
      expect(mockedApi.$getBatchedOutspends).toHaveBeenCalledWith([TXID, TXID.toUpperCase()]);
    });
  });
});
