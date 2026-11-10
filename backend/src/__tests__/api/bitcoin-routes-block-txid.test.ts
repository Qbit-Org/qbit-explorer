import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getTxIdsForBlock: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';

const mockedApi = bitcoinApi as unknown as {
  $getTxIdsForBlock: jest.Mock;
};

// qbit mainnet block 163,891, whose transaction 2 etched POST•QUANTUM•GOODS (qrune 163891:2)
const BLOCK_HASH = '00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401';
const TXIDS = [
  '4a60e113576e895adf6e21011c47a21bf680a52321f4526d762d35316e4ecd64',
  'd776cf01dd7cc404a1a046aa09d535e5c8cce15d074c5369dcd5ebc3c4b16823',
  '2de5d75812774656cc1905cc40d6c40d35efe9555185037b5c065836415adac8',
];

function coreError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

function axiosError(status: number): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status } });
}

describe('GET block/:hash/txid/:index', () => {
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
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    mockedApi.$getTxIdsForBlock.mockReset();
  });

  const get = (hash: string, index: string): Promise<Response> => fetch(`${baseUrl}block/${hash}/txid/${index}`);

  test.each([
    ['the coinbase', '0', TXIDS[0]],
    ['a qrune etching', '2', TXIDS[2]],
    ['an index with leading zeros', '02', TXIDS[2]],
  ])('answers the txid of %s as text/plain, like esplora', async (_name, index, txid) => {
    mockedApi.$getTxIdsForBlock.mockResolvedValue(TXIDS);

    const res = await get(BLOCK_HASH, index);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    // a block hash's transactions never change, so the answer is cached as long as the block summary routes are
    expect(Date.parse(res.headers.get('expires') ?? '') - Date.now()).toBeGreaterThan(1000 * 3600 * 24 * 29);
    expect(await res.text()).toBe(txid);
    expect(mockedApi.$getTxIdsForBlock).toHaveBeenCalledWith(BLOCK_HASH);
  });

  test('answers 404 for the first index past the last transaction', async () => {
    mockedApi.$getTxIdsForBlock.mockResolvedValue(TXIDS);

    const res = await get(BLOCK_HASH, String(TXIDS.length));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Transaction index out of range' });
  });

  test.each(['abc', '-1', '1.5', '1e3', '0x1', '+1', '%201', '9007199254740993'])('answers 400 for the index %p without querying the node', async (index) => {
    const res = await get(BLOCK_HASH, index);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid transaction index' });
    expect(mockedApi.$getTxIdsForBlock).not.toHaveBeenCalled();
  });

  test('rejects a malformed block hash as the other block routes do', async () => {
    const res = await get('xyz', '0');

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid block hash' });
    expect(mockedApi.$getTxIdsForBlock).not.toHaveBeenCalled();
  });

  test.each([
    ['Core RPC error -5', coreError(-5, 'Block not found')],
    ['esplora HTTP 404', axiosError(404)],
  ])('answers 404 for an unknown block (%s)', async (_name, error) => {
    mockedApi.$getTxIdsForBlock.mockRejectedValue(error);

    const res = await get(BLOCK_HASH, '0');

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Block not found' });
  });

  test.each([
    ['a Core RPC error other than -5', coreError(-1, 'Block not available (pruned data)')],
    ['an esplora HTTP 500', axiosError(500)],
  ])('answers 500 for %s', async (_name, error) => {
    mockedApi.$getTxIdsForBlock.mockRejectedValue(error);

    const res = await get(BLOCK_HASH, '0');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to get txid for block index' });
  });
});
