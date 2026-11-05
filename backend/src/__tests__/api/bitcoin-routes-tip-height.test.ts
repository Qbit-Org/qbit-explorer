import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {},
  bitcoinCoreApi: {
    $getBlockHeightTip: jest.fn(),
    $getBlockHash: jest.fn(),
    $getBlock: jest.fn(),
  },
}));

import { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import blocks from '../../api/blocks';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import { BlockExtended } from '../../mempool.interfaces';
import BlocksRepository from '../../repositories/BlocksRepository';

const coreApi = jest.mocked(bitcoinCoreApi);

describe('GET blocks/tip/height', () => {
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

  // The blocks module is a singleton, so start each test from its startup state.
  beforeEach(() => {
    const state = blocks as unknown as { initialSyncComplete: boolean, currentBlockHeight: number };
    state.initialSyncComplete = false;
    state.currentBlockHeight = 0;
    coreApi.$getBlockHeightTip.mockReset();
    coreApi.$getBlockHash.mockReset();
    coreApi.$getBlock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectNotReady = async (): Promise<void> => {
    const res = await fetch(baseUrl + 'blocks/tip/height');

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Initial block sync in progress' });
  };

  const expectTip = async (height: number): Promise<void> => {
    const res = await fetch(baseUrl + 'blocks/tip/height');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(await res.text()).toBe(String(height));
  };

  // A $updateBlocks run that finds the backend's cached blocks already at the
  // node's tip, so it only refreshes the difficulty anchors.
  const mockCaughtUpWithNode = (height: number): void => {
    blocks.setBlocks([{ height } as BlockExtended]);
    coreApi.$getBlockHeightTip.mockResolvedValue(height);
    coreApi.$getBlockHash.mockResolvedValue('00'.repeat(32));
    coreApi.$getBlock.mockResolvedValue({ height, timestamp: 0, bits: 0 } as IEsploraApi.Block);
    jest.spyOn(BlocksRepository, '$getAsertLaneAnchors').mockResolvedValue({
      permissionless: { latest: null, dayAgo: null },
      auxpow: { latest: null, dayAgo: null },
    });
  };

  test('answers 503 until a block sync run reaches the node tip', async () => {
    // before the first run the height is a placeholder
    expect(blocks.isInitialSyncComplete()).toBe(false);
    expect(blocks.getCurrentBlockHeight()).toBe(0);
    await expectNotReady();

    // a run that stops short of the tip: the cached blocks end one block
    // below it, and the node stops answering while that block is fetched
    blocks.setBlocks([{ height: 158366 } as BlockExtended]);
    coreApi.$getBlockHeightTip.mockResolvedValue(158367);
    coreApi.$getBlockHash.mockRejectedValue(new Error('RPC unavailable'));
    await expect(blocks.$updateBlocks()).rejects.toThrow('RPC unavailable');
    // the height already names the block that never arrived
    expect(blocks.getCurrentBlockHeight()).toBe(158367);
    expect(blocks.isInitialSyncComplete()).toBe(false);
    await expectNotReady();

    mockCaughtUpWithNode(158367);
    await expect(blocks.$updateBlocks()).resolves.toBe(0);
    expect(blocks.isInitialSyncComplete()).toBe(true);
    await expectTip(158367);
  });

  test('keeps answering when a later sync run fails', async () => {
    mockCaughtUpWithNode(158367);
    await blocks.$updateBlocks();

    coreApi.$getBlockHeightTip.mockRejectedValue(new Error('RPC unavailable'));
    await expect(blocks.$updateBlocks()).rejects.toThrow('RPC unavailable');

    await expectTip(158367);
  });

  // A chain whose tip is its genesis block is at height 0, which is not a
  // missing tip.
  test.each([0, 158367])('responds with a tip at height %d', async (height) => {
    jest.spyOn(blocks, 'isInitialSyncComplete').mockReturnValue(true);
    jest.spyOn(blocks, 'getCurrentBlockHeight').mockReturnValue(height);

    await expectTip(height);
  });
});
