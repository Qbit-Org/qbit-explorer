jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  // the configured backend, such as qbit-electrs under esplora, which can lag
  // the node
  default: {
    $getBlockHashTip: jest.fn(),
    $getBlockHeightTip: jest.fn(),
  },
  bitcoinCoreApi: {
    $getBlockHashTip: jest.fn(),
    $getBlockHeightTip: jest.fn(),
    $getBlockHash: jest.fn(),
    $getBlock: jest.fn(),
  },
}));

jest.mock('../../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: {
    getBlock: jest.fn(),
    getBlockchainInfo: jest.fn(),
  },
}));

jest.mock('../../api/websocket-handler', () => ({
  __esModule: true,
  default: {
    handleReorg: jest.fn(),
  },
}));

jest.mock('../../api/chain-tips', () => ({
  __esModule: true,
  default: {
    updateOrphanedBlocks: jest.fn(),
    clearOrphanCacheAboveHeight: jest.fn(),
  },
}));

jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: {
    getAccelerations: (): Record<string, never> => ({}),
    hasPriority: (): boolean => false,
  },
}));

jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {
    lock: jest.fn(),
    unlock: jest.fn(),
    $saveCacheToDisk: jest.fn(),
  },
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {
    $updateBlocks: jest.fn(),
    $updateBlockSummaries: jest.fn(),
    $removeTransactions: jest.fn(),
  },
}));

jest.mock('../../api/rbf-cache', () => ({
  __esModule: true,
  default: {
    updateCache: jest.fn(),
  },
}));

// Keep the pool updater and Rust GBT timers in Blocks' dependency graph from
// starting, as blocks-cache.test.ts does
jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/backend-info', () => ({
  __esModule: true,
  default: {},
}));

import bitcoinApi, { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import blocks from '../../api/blocks';
import chainTips from '../../api/chain-tips';
import { Common } from '../../api/common';
import diskCache from '../../api/disk-cache';
import redisCache from '../../api/redis-cache';
import websocketHandler from '../../api/websocket-handler';
import config from '../../config';
import indexer from '../../indexer';
import logger from '../../logger';
import { BlockExtended } from '../../mempool.interfaces';
import blocksRepository from '../../repositories/BlocksRepository';
import cpfpRepository from '../../repositories/CpfpRepository';
import HashratesRepository from '../../repositories/HashratesRepository';
import PricesRepository from '../../repositories/PricesRepository';

const coreApi = jest.mocked(bitcoinCoreApi);
const backendApi = jest.mocked(bitcoinApi);
const getBlock = jest.mocked(bitcoinClient.getBlock);
const getBlockchainInfo = jest.mocked(bitcoinClient.getBlockchainInfo);
const handleReorg = jest.mocked(websocketHandler.handleReorg);

const hash = (fill: string): string => fill.repeat(64);

interface ChainBlock {
  height: number,
  id: string,
  previousblockhash: string,
}

// a chain of blocks from height 100 (or the given one) up, with ids made from
// the given characters, on top of the given parent
const chainOf = (fills: string[], start = 100, parentId = hash('0')): ChainBlock[] => fills.map((fill, i) => ({
  height: start + i,
  id: hash(fill),
  previousblockhash: i === 0 ? parentId : hash(fills[i - 1]),
}));

// the characters for a chain of the given length, all starting with prefix
const fillsOf = (prefix: string, length: number): string[] => Array.from({ length }, (_, i) => `${prefix}${i}`);

const cached = (block: ChainBlock): BlockExtended => ({ ...block, timestamp: 1700000000 + block.height, extras: {} } as BlockExtended);

// the node's best chain: what it answers for the tip, for a height and for a
// block. It reports itself synced.
const mockNode = (chain: ChainBlock[]): void => {
  const byHeight = new Map(chain.map(block => [block.height, block]));
  const byId = new Map(chain.map(block => [block.id, block]));
  coreApi.$getBlockHashTip.mockResolvedValue(chain[chain.length - 1].id);
  coreApi.$getBlockHeightTip.mockResolvedValue(chain[chain.length - 1].height);
  const tipHeight = chain[chain.length - 1].height;
  getBlockchainInfo.mockResolvedValue({ blocks: tipHeight, headers: tipHeight, initialblockdownload: false, bestblockhash: chain[chain.length - 1].id });
  coreApi.$getBlockHash.mockImplementation(async (height: number) => {
    const block = byHeight.get(height);
    if (!block) {
      // as Core: the anchor heights below the test chain are out of range too
      throw Object.assign(new Error('Block height out of range'), { code: -8 });
    }
    return block.id;
  });
  getBlock.mockImplementation(async (id: string) => {
    const block = byId.get(id);
    if (!block) {
      throw Object.assign(new Error('Block not found'), { code: -5 });
    }
    return {
      hash: block.id, height: block.height, previousblockhash: block.previousblockhash, version: 0x20000000,
      time: 1700000000 + block.height, mediantime: 1700000000 + block.height, bits: '1d00ffff', nonce: 0,
      difficulty: 1, merkleroot: hash('0'), nTx: 1, size: 100, weight: 400, confirmations: 1, tx: [],
    };
  });
};

const cachedIds = (): string[] => blocks.getBlocks().map(block => block.id);
const summaryIds = (): string[] => blocks.getBlockSummaries().map(summary => summary.id);

// indexing on, with the database calls of a sync run stubbed
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const mockIndexing = () => {
  jest.spyOn(Common, 'indexingEnabled').mockReturnValue(true);
  jest.spyOn(indexer, 'scheduleSingleTask').mockImplementation(() => undefined);
  jest.spyOn(PricesRepository, '$getLatestPriceId').mockResolvedValue(null);
  jest.spyOn(blocksRepository, '$getAsertLaneAnchors').mockResolvedValue({
    permissionless: { latest: null, dayAgo: null },
    auxpow: { latest: null, dayAgo: null },
  });
  return {
    getBlockByHeight: jest.spyOn(blocksRepository, '$getBlockByHeight').mockResolvedValue(null),
    getBlockByHash: jest.spyOn(blocksRepository, '$getBlockByHash').mockResolvedValue(null),
    setCanonical: jest.spyOn(blocksRepository, '$setCanonicalBlockAtHeight').mockResolvedValue(),
    saveBlock: jest.spyOn(blocksRepository, '$saveBlockInDatabase').mockResolvedValue(undefined),
    deleteHashrates: jest.spyOn(HashratesRepository, '$deleteHashratesFromTimestamp').mockResolvedValue(),
    deleteClusters: jest.spyOn(cpfpRepository, '$deleteClustersFrom').mockResolvedValue(),
    reindex: jest.spyOn(indexer, 'reindex').mockImplementation(() => undefined),
  };
};

describe('Blocks $updateBlocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const call of [coreApi.$getBlockHashTip, coreApi.$getBlockHeightTip, coreApi.$getBlockHash, coreApi.$getBlock, getBlock, getBlockchainInfo, backendApi.$getBlockHashTip, backendApi.$getBlockHeightTip]) {
      call.mockReset();
    }
    const state = blocks as unknown as { initialSyncComplete: boolean, reorgNotificationPending: boolean, currentBlockHeight: number, asertAnchorTip: number };
    state.initialSyncComplete = true;
    state.reorgNotificationPending = false;
    state.currentBlockHeight = 0;
    state.asertAnchorTip = -1;
    blocks.setBlockSummaries([]);
    jest.spyOn(Common, 'indexingEnabled').mockReturnValue(false);
    // the per-block work beyond fetching the block from the node
    jest.spyOn(blocks as any, '$getTransactionsExtended').mockResolvedValue([]);
    jest.spyOn(blocks as any, '$getBlockExtended').mockImplementation(async (block: any) => ({ ...block, extras: {} }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('a tip the node replaced at the same height', () => {
    // P <- A is cached, and the node switched to P <- B
    const [p, a] = chainOf(['p', 'a']);
    const [, b] = chainOf(['p', 'b']);

    test('is synced again, and reaches clients as a reorg once the replacement is cached', async () => {
      blocks.setBlocks([cached(p), cached(a)]);
      blocks.setBlockSummaries([{ id: p.id, transactions: [] }, { id: a.id, transactions: [] }]);
      mockNode([p, b]);
      let cachedAtReorg: string[] = [];
      handleReorg.mockImplementation(() => { cachedAtReorg = cachedIds(); });

      await expect(blocks.$updateBlocks()).resolves.toBe(1);

      expect(cachedIds()).toEqual([p.id, b.id]);
      expect(blocks.getBlockSummaries().map(summary => summary.id)).toEqual([p.id, b.id]);
      expect(blocks.getCurrentBlockHeight()).toBe(b.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
      expect(cachedAtReorg).toEqual([p.id, b.id]);
      expect(chainTips.clearOrphanCacheAboveHeight).toHaveBeenCalledWith(p.height);
    });

    test('leaves no replaced block canonical when blocks are indexed', async () => {
      const { getBlockByHeight, setCanonical, saveBlock, deleteHashrates, deleteClusters, reindex } = mockIndexing();
      getBlockByHeight.mockResolvedValue(cached(p));
      blocks.setBlocks([cached(p), cached(a)]);
      mockNode([p, b]);

      await expect(blocks.$updateBlocks()).resolves.toBe(1);

      // A's row stops being canonical before B's is saved as the block at that height
      expect(setCanonical).toHaveBeenCalledWith(null, a.height);
      expect(setCanonical.mock.invocationCallOrder[0]).toBeLessThan(saveBlock.mock.invocationCallOrder[0]);
      expect(saveBlock).toHaveBeenCalledWith(expect.objectContaining({ id: b.id }), expect.anything());
      expect(deleteHashrates).toHaveBeenCalledWith(cached(a).timestamp - 604800);
      expect(deleteClusters).toHaveBeenCalledWith(a.height);
      expect(reindex).toHaveBeenCalled();
      // B extends the indexed chain, so the reorg check finds no divergence of its own
      expect(getBlockByHeight).toHaveBeenCalledWith(p.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('still reaches clients when the run that dropped it fails', async () => {
      blocks.setBlocks([cached(p), cached(a)]);
      mockNode([p, b]);
      getBlock.mockRejectedValueOnce(new Error('RPC unavailable'));

      await expect(blocks.$updateBlocks()).rejects.toThrow('RPC unavailable');
      expect(cachedIds()).toEqual([p.id]);
      expect(handleReorg).not.toHaveBeenCalled();

      // the next run fetches B above the cached tip, as for any new block
      await expect(blocks.$updateBlocks()).resolves.toBe(1);
      expect(cachedIds()).toEqual([p.id, b.id]);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('is dropped from the Redis and disk caches and the orphan cache is refilled, though no block is synced', async () => {
      // the run fails while fetching B: a restart must not restore A
      jest.replaceProperty(config.REDIS, 'ENABLED', true);
      blocks.setBlocks([cached(p), cached(a)]);
      blocks.setBlockSummaries([p, a].map(block => ({ id: block.id, transactions: [] })));
      mockNode([p, b]);
      getBlock.mockRejectedValueOnce(new Error('RPC unavailable'));

      await expect(blocks.$updateBlocks()).rejects.toThrow('RPC unavailable');

      expect(jest.mocked(redisCache.$updateBlocks).mock.calls.map(([saved]) => saved.map(block => block.id))).toEqual([[p.id]]);
      expect(jest.mocked(redisCache.$updateBlockSummaries).mock.calls.map(([saved]) => saved.map(summary => summary.id))).toEqual([[p.id]]);
      expect(diskCache.$saveCacheToDisk).toHaveBeenCalled();
      // the orphan cache is cleared from A's height, then refilled
      const clearOrphans = jest.mocked(chainTips.clearOrphanCacheAboveHeight);
      const refillOrphans = jest.mocked(chainTips.updateOrphanedBlocks);
      expect(clearOrphans).toHaveBeenCalledWith(p.height);
      expect(refillOrphans).toHaveBeenCalledTimes(1);
      expect(refillOrphans.mock.invocationCallOrder[0]).toBeGreaterThan(clearOrphans.mock.invocationCallOrder[0]);
    });

    test('stays cached when the database fails partway through the drop, until a later run drops it', async () => {
      // A's height is marked stale, then the CPFP clusters can't be deleted
      const { setCanonical, deleteClusters } = mockIndexing();
      deleteClusters.mockRejectedValueOnce(new Error('DB unavailable'));
      blocks.setBlocks([cached(p), cached(a)]);
      mockNode([p, b]);

      await expect(blocks.$updateBlocks()).rejects.toThrow('DB unavailable');
      expect(cachedIds()).toEqual([p.id, a.id]);
      expect(handleReorg).not.toHaveBeenCalled();

      // the node then mines C on B, above the cached tip: the loop finds that
      // C doesn't extend A
      const [, , c] = chainOf(['p', 'b', 'c']);
      mockNode([p, b, c]);
      await expect(blocks.$updateBlocks()).resolves.toBe(2);

      expect(cachedIds()).toEqual([p.id, b.id, c.id]);
      expect(setCanonical).toHaveBeenNthCalledWith(2, null, a.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('has the indexer run when deleting the CPFP clusters fails, as the node may have it again by the next run', async () => {
      // A's height is marked stale, then the CPFP clusters can't be deleted,
      // so A stays cached. With the node back on A, the next run neither
      // drops A nor saves it: only the indexer makes A's row canonical again.
      const { setCanonical, deleteClusters, reindex } = mockIndexing();
      deleteClusters.mockRejectedValueOnce(new Error('DB unavailable'));
      blocks.setBlocks([cached(p), cached(a)]);
      mockNode([p, b]);

      await expect(blocks.$updateBlocks()).rejects.toThrow('DB unavailable');
      expect(setCanonical).toHaveBeenCalledWith(null, a.height);
      expect(reindex).toHaveBeenCalled();
      expect(reindex.mock.invocationCallOrder[0]).toBeLessThan(deleteClusters.mock.invocationCallOrder[0]);

      mockNode([p, a]);
      await expect(blocks.$updateBlocks()).resolves.toBe(0);
      expect(cachedIds()).toEqual([p.id, a.id]);
      expect(setCanonical).toHaveBeenCalledTimes(1);
    });

    test('has the indexer run when marking the dropped heights stale fails partway', async () => {
      // P <- A <- C is cached, and the node switched to P <- B <- D: A's
      // height is marked stale, then C's can't be
      const { setCanonical, reindex } = mockIndexing();
      const [, , c] = chainOf(['p', 'a', 'c']);
      const [, , d] = chainOf(['p', 'b', 'd']);
      setCanonical.mockResolvedValueOnce().mockRejectedValueOnce(new Error('DB unavailable'));
      blocks.setBlocks([cached(p), cached(a), cached(c)]);
      mockNode([p, b, d]);

      await expect(blocks.$updateBlocks()).rejects.toThrow('DB unavailable');

      expect(setCanonical).toHaveBeenCalledWith(null, a.height);
      expect(reindex).toHaveBeenCalled();
    });

    test('reaches clients as one reorg when the database diverges as well', async () => {
      // the database's canonical block at P's height is from another chain,
      // so $handleReorgs finds a divergence of its own once B is synced
      const { getBlockByHeight, getBlockByHash, setCanonical } = mockIndexing();
      const other = { height: p.height, id: hash('o'), previousblockhash: hash('0') };
      getBlockByHeight.mockImplementation(async (height: number) => height === p.height ? cached(other) : null);
      getBlockByHash.mockImplementation(async (id: string) => id === p.id ? cached(p) : null);
      jest.spyOn(blocks as any, '$getStrippedBlockTransactions').mockResolvedValue([]);
      blocks.setBlocks([cached(p), cached(a)]);
      mockNode([p, b]);
      let cachedAtReorg: string[] = [];
      handleReorg.mockImplementation(() => { cachedAtReorg = cachedIds(); });

      await expect(blocks.$updateBlocks()).resolves.toBe(1);

      // $handleReorgs walked back to P, and left the reorg to the end of the run
      expect(setCanonical).toHaveBeenCalledWith(p.id, p.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
      expect(cachedAtReorg).toEqual([p.id, b.id]);
    });
  });

  test('a longer chain that replaced the cached tip is synced from the fork, with indexing off', async () => {
    // P <- A is cached, and between two runs the node switched to P <- B <- C
    const [p, a] = chainOf(['p', 'a']);
    const node = chainOf(['p', 'b', 'c']);
    blocks.setBlocks([cached(p), cached(a)]);
    blocks.setBlockSummaries([{ id: p.id, transactions: [] }, { id: a.id, transactions: [] }]);
    mockNode(node);
    let cachedAtReorg: string[] = [];
    handleReorg.mockImplementation(() => { cachedAtReorg = cachedIds(); });

    await expect(blocks.$updateBlocks()).resolves.toBe(2);

    expect(cachedIds()).toEqual(node.map(block => block.id));
    expect(blocks.getBlockSummaries().map(summary => summary.id)).toEqual(node.map(block => block.id));
    expect(blocks.getCurrentBlockHeight()).toBe(102);
    expect(handleReorg).toHaveBeenCalledTimes(1);
    expect(cachedAtReorg).toEqual(node.map(block => block.id));
  });

  test.each([
    ['no higher', 20],
    ['a block higher', 21],
  ])('a fork deep in the cache, with the node %s, is synced from the fork without a gap', async (_, synced) => {
    // 70 to 101 are cached, and the node replaced 82 to 101, then, a block
    // higher, mined 102, so that the loop finds the fork. The 20 blocks
    // dropped are more than 2 * INITIAL_BLOCKS_AMOUNT, and the run syncs
    // them all rather than fast-forwarding.
    const old = chainOf(fillsOf('c', 32), 70);
    const node = [...old.slice(0, 12), ...chainOf(fillsOf('f', synced), 82, old[11].id)];
    blocks.setBlocks(old.map(cached));
    mockNode(node);

    await expect(blocks.$updateBlocks()).resolves.toBe(synced);

    expect(cachedIds()).toEqual(node.slice(-32).map(block => block.id));
    expect(handleReorg).toHaveBeenCalledTimes(1);
  });

  describe('a reorg below the gap a fast-forward left', () => {
    // 90 to 101 are cached, then 9993 to 10000, synced after a fast-forward.
    // The node replaced 9991 up, so every cached block above the gap.
    const common = chainOf(fillsOf('c', 9901), 90);
    const kept = common.slice(0, 12);
    const replaced = chainOf(fillsOf('o', 8), 9993, hash('x'));

    test.each([
      ['at the cached tip\'s height', 10000, 8],
      ['a block higher', 10001, 9],
    ])('with the node %s, fast-forwards rather than sync every height above 101', async (_, tip, fetched) => {
      // with the node a block higher, the loop finds the fork when it fetches
      // that block
      const node = [...common, ...chainOf(fillsOf('n', tip - 9990), 9991, common[common.length - 1].id)];
      blocks.setBlocks([...kept, ...replaced].map(cached));
      mockNode(node);
      const reindex = jest.spyOn(indexer, 'reindex').mockImplementation(() => undefined);

      await expect(blocks.$updateBlocks()).resolves.toBe(8);

      expect(getBlock).toHaveBeenCalledTimes(fetched);
      expect(cachedIds()).toEqual([...kept, ...node.slice(-8)].map(block => block.id));
      expect(logger.info).toHaveBeenCalledWith(`${tip - 101} blocks since tip. Fast forwarding to the 8 recent blocks`);
      expect(reindex).toHaveBeenCalled();
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });
  });

  test('a cached tip the node does not have is dropped before a fast-forward', async () => {
    // a chain wipe whose new chain is already more than 2 *
    // INITIAL_BLOCKS_AMOUNT blocks above the cached tip
    const old = chainOf(['p', 'a']);
    const wiped = chainOf(fillsOf('n', 19), 100);
    blocks.setBlocks(old.map(cached));
    blocks.setBlockSummaries(old.map(block => ({ id: block.id, transactions: [] })));
    mockNode(wiped);

    // as for an empty cache, the run syncs the node's last INITIAL_BLOCKS_AMOUNT (8) blocks
    await expect(blocks.$updateBlocks()).resolves.toBe(8);

    expect(cachedIds()).toEqual(wiped.slice(-8).map(block => block.id));
    expect(blocks.getBlockSummaries().map(summary => summary.id)).toEqual(wiped.slice(-8).map(block => block.id));
    expect(handleReorg).toHaveBeenCalledTimes(1);
  });

  test('a rollback to genesis syncs every height above it', async () => {
    // a short chain, as on regtest: 0 to 5 are cached, and the node replaced
    // 1 to 5 and mined 6
    const old = chainOf(['g', 'a', 'b', 'c', 'd', 'e'], 0);
    const node = chainOf(['g', 'h', 'i', 'j', 'k', 'l', 'm'], 0);
    blocks.setBlocks(old.map(cached));
    mockNode(node);

    await expect(blocks.$updateBlocks()).resolves.toBe(6);

    expect(cachedIds()).toEqual(node.map(block => block.id));
    expect(handleReorg).toHaveBeenCalledTimes(1);
  });

  test('a reorg found in the database drops the replaced blocks\' summaries too, and refills the orphan cache once', async () => {
    // a cache with C above orphan A, as the sync loop built with indexing off
    // before this PR, and a database whose block at C's height is from
    // another chain: when D arrives, $handleReorgs walks back to P
    jest.replaceProperty(config.REDIS, 'ENABLED', true);
    const { getBlockByHeight, getBlockByHash } = mockIndexing();
    const [p, a] = chainOf(['p', 'a']);
    const node = chainOf(['p', 'b', 'c', 'd']);
    const [, , c, d] = node;
    const indexed = new Map([p, a, { height: c.height, id: hash('x'), previousblockhash: a.id }].map(block => [block.height, block]));
    const nodeBlocks = new Map(node.map(block => [block.id, block]));
    getBlockByHeight.mockImplementation(async (height: number) => {
      const block = indexed.get(height);
      return block ? cached(block) : null;
    });
    getBlockByHash.mockImplementation(async (id: string) => {
      const block = nodeBlocks.get(id);
      return block ? cached(block) : null;
    });
    jest.spyOn(blocks as any, '$getStrippedBlockTransactions').mockResolvedValue([]);
    blocks.setBlocks([cached(p), cached(a), cached(c)]);
    blocks.setBlockSummaries([p, a, c].map(block => ({ id: block.id, transactions: [] })));
    mockNode(node);

    await expect(blocks.$updateBlocks()).resolves.toBe(1);

    expect(cachedIds()).toEqual(node.map(block => block.id));
    expect(blocks.getBlockSummaries().map(summary => summary.id)).toEqual([p.id, c.id, d.id]);
    const savedSummaries = jest.mocked(redisCache.$updateBlockSummaries).mock.calls;
    expect(savedSummaries[savedSummaries.length - 1][0].map(summary => summary.id)).toEqual([p.id, c.id, d.id]);
    expect(handleReorg).toHaveBeenCalledTimes(1);
    // the reorg's cleanup refilled the orphan cache, and D's sync doesn't again
    expect(chainTips.updateOrphanedBlocks).toHaveBeenCalledTimes(1);
  });

  test('a reorg found in the database has the indexer run when deleting the CPFP clusters fails', async () => {
    // P <- A is cached and on the node's chain, but the database's block at
    // A's height is from another chain: when B arrives, $handleReorgs walks
    // back to P, and its cleanup fails
    const { getBlockByHeight, getBlockByHash, deleteClusters, reindex } = mockIndexing();
    const [p, a, b] = chainOf(['p', 'a', 'b']);
    const other = { height: a.height, id: hash('x'), previousblockhash: p.id };
    getBlockByHeight.mockImplementation(async (height: number) => height === a.height ? cached(other) : height === p.height ? cached(p) : null);
    getBlockByHash.mockImplementation(async (id: string) => id === a.id ? cached(a) : null);
    jest.spyOn(blocks as any, '$getStrippedBlockTransactions').mockResolvedValue([]);
    deleteClusters.mockRejectedValueOnce(new Error('DB unavailable'));
    blocks.setBlocks([cached(p), cached(a)]);
    mockNode([p, a, b]);

    await expect(blocks.$updateBlocks()).rejects.toThrow('DB unavailable');

    expect(reindex).toHaveBeenCalled();
  });

  test('asks the node only for its best block while it is the cached tip, and sends no reorg', async () => {
    const chain = chainOf(['p', 'a']);
    blocks.setBlocks(chain.map(cached));
    mockNode(chain);
    // the difficulty anchors are up to date for the cached tip
    (blocks as unknown as { asertAnchorTip: number }).asertAnchorTip = 101;

    await expect(blocks.$updateBlocks()).resolves.toBe(0);

    expect(cachedIds()).toEqual(chain.map(block => block.id));
    expect(blocks.getCurrentBlockHeight()).toBe(101);
    expect(coreApi.$getBlockHashTip).toHaveBeenCalledTimes(1);
    expect(coreApi.$getBlockHeightTip).not.toHaveBeenCalled();
    expect(coreApi.$getBlockHash).not.toHaveBeenCalled();
    expect(coreApi.$getBlock).not.toHaveBeenCalled();
    expect(getBlock).not.toHaveBeenCalled();
    expect(getBlockchainInfo).not.toHaveBeenCalled();
    expect(handleReorg).not.toHaveBeenCalled();
  });

  test('takes the tip from the node, not from qbit-electrs, which can lag it', async () => {
    // qbit-electrs still answers A as its tip, while the node mined E on the
    // cached D
    const chain = chainOf(['p', 'a', 'c', 'd', 'e']);
    blocks.setBlocks(chain.slice(0, 4).map(cached));
    mockNode(chain);
    backendApi.$getBlockHeightTip.mockResolvedValue(chain[1].height);
    backendApi.$getBlockHashTip.mockResolvedValue(chain[1].id);

    await expect(blocks.$updateBlocks()).resolves.toBe(1);

    expect(cachedIds()).toEqual(chain.map(block => block.id));
    expect(handleReorg).not.toHaveBeenCalled();
    expect(backendApi.$getBlockHeightTip).not.toHaveBeenCalled();
    expect(backendApi.$getBlockHashTip).not.toHaveBeenCalled();
  });

  describe('cached blocks above the node tip, on its chain', () => {
    // P <- A <- C <- D is cached, and the node is at A
    const chain = chainOf(['p', 'a', 'c', 'd']);
    const [p, a, c, d] = chain;
    const ids = chain.map(block => block.id);

    beforeEach(() => {
      blocks.setBlocks(chain.map(cached));
      blocks.setBlockSummaries(chain.map(block => ({ id: block.id, transactions: [] })));
      mockNode([p, a]);
    });

    test.each([
      ['still connecting blocks it has the headers of', { headers: d.height }],
      ['in initial block download', { initialblockdownload: true }],
    ])('are kept while the node is %s, as after a restart', async (_, syncing) => {
      const { setCanonical, deleteHashrates, deleteClusters, reindex } = mockIndexing();
      jest.replaceProperty(config.REDIS, 'ENABLED', true);
      getBlockchainInfo.mockResolvedValue({ blocks: a.height, headers: a.height, initialblockdownload: false, bestblockhash: a.id, ...syncing });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(cachedIds()).toEqual(ids);
      expect(summaryIds()).toEqual(ids);
      expect(blocks.getCurrentBlockHeight()).toBe(d.height);
      expect(setCanonical).not.toHaveBeenCalled();
      expect(deleteHashrates).not.toHaveBeenCalled();
      expect(deleteClusters).not.toHaveBeenCalled();
      expect(reindex).not.toHaveBeenCalled();
      expect(chainTips.clearOrphanCacheAboveHeight).not.toHaveBeenCalled();
      expect(redisCache.$updateBlocks).not.toHaveBeenCalled();
      expect(diskCache.$saveCacheToDisk).not.toHaveBeenCalled();
      expect(handleReorg).not.toHaveBeenCalled();
    });

    test('are dropped once the node reports itself synced, as after invalidateblock, and reach clients as one reorg', async () => {
      jest.replaceProperty(config.REDIS, 'ENABLED', true);
      let cachedAtReorg: string[] = [];
      handleReorg.mockImplementation(() => { cachedAtReorg = cachedIds(); });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(cachedIds()).toEqual([p.id, a.id]);
      expect(summaryIds()).toEqual([p.id, a.id]);
      expect(blocks.getCurrentBlockHeight()).toBe(a.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
      expect(cachedAtReorg).toEqual([p.id, a.id]);
      // a restart must not restore C and D
      expect(jest.mocked(redisCache.$updateBlocks).mock.calls.map(([saved]) => saved.map(block => block.id))).toEqual([[p.id, a.id]]);
      expect(jest.mocked(redisCache.$updateBlockSummaries).mock.calls.map(([saved]) => saved.map(summary => summary.id))).toEqual([[p.id, a.id]]);
      expect(diskCache.$saveCacheToDisk).toHaveBeenCalled();
      // the orphan cache is cleared from C's height, then refilled
      const clearOrphans = jest.mocked(chainTips.clearOrphanCacheAboveHeight);
      const refillOrphans = jest.mocked(chainTips.updateOrphanedBlocks);
      expect(clearOrphans).toHaveBeenCalledWith(a.height);
      expect(refillOrphans).toHaveBeenCalledTimes(1);
      expect(refillOrphans.mock.invocationCallOrder[0]).toBeGreaterThan(clearOrphans.mock.invocationCallOrder[0]);

      // the node's next block extends A, so it arrives as a new block
      const [, , b] = chainOf(['p', 'a', 'b']);
      mockNode([p, a, b]);
      await expect(blocks.$updateBlocks()).resolves.toBe(1);
      expect(cachedIds()).toEqual([p.id, a.id, b.id]);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('leave no row canonical when blocks are indexed', async () => {
      const { setCanonical, deleteHashrates, deleteClusters, reindex } = mockIndexing();

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(setCanonical.mock.calls).toEqual([[null, c.height], [null, d.height]]);
      expect(reindex.mock.invocationCallOrder[0]).toBeLessThan(setCanonical.mock.invocationCallOrder[0]);
      expect(deleteHashrates).toHaveBeenCalledWith(cached(c).timestamp - 604800);
      expect(deleteClusters).toHaveBeenCalledWith(c.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('stay cached when the database fails partway through the drop, until the next run drops them', async () => {
      // C's height is marked stale, then D's can't be
      const { setCanonical, reindex } = mockIndexing();
      setCanonical.mockResolvedValueOnce().mockRejectedValueOnce(new Error('DB unavailable'));

      await expect(blocks.$updateBlocks()).rejects.toThrow('DB unavailable');
      expect(cachedIds()).toEqual(ids);
      expect(summaryIds()).toEqual(ids);
      expect(reindex).toHaveBeenCalled();
      expect(handleReorg).not.toHaveBeenCalled();

      await expect(blocks.$updateBlocks()).resolves.toBe(0);
      expect(cachedIds()).toEqual([p.id, a.id]);
      expect(setCanonical).toHaveBeenLastCalledWith(null, d.height);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('are kept when the node cannot say whether it is syncing', async () => {
      getBlockchainInfo.mockRejectedValue(new Error('RPC unavailable'));

      await expect(blocks.$updateBlocks()).rejects.toThrow('RPC unavailable');

      expect(cachedIds()).toEqual(ids);
      expect(handleReorg).not.toHaveBeenCalled();
    });

    test('are kept when the node connects them again while the run checks the cache', async () => {
      // the run reads tip A, and by the time it asks whether the node is
      // syncing, the node has reconnected C and D, as after reconsiderblock
      getBlockchainInfo.mockResolvedValue({ blocks: d.height, headers: d.height, initialblockdownload: false, bestblockhash: d.id });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(cachedIds()).toEqual(ids);
      expect(handleReorg).not.toHaveBeenCalled();
    });
  });

  describe('a chain wiped while the backend runs', () => {
    // the backend synced P <- A <- C <- D at 100 to 103, then the node started
    // a new chain, which is still below the cached blocks
    const old = chainOf(['p', 'a', 'c', 'd']);
    const wiped = chainOf(fillsOf('n', 51), 0);

    beforeEach(async () => {
      blocks.setBlocks(old.slice(0, 3).map(cached));
      mockNode(old);
      await expect(blocks.$updateBlocks()).resolves.toBe(1);
      expect(cachedIds()).toEqual(old.map(block => block.id));
    });

    test('is followed: the old blocks are dropped and the new chain synced, as for an empty cache', async () => {
      mockNode(wiped);

      // the node's last INITIAL_BLOCKS_AMOUNT (8) blocks
      await expect(blocks.$updateBlocks()).resolves.toBe(8);

      expect(cachedIds()).toEqual(wiped.slice(-8).map(block => block.id));
      expect(blocks.getCurrentBlockHeight()).toBe(50);
      expect(handleReorg).toHaveBeenCalledTimes(1);
      expect(chainTips.clearOrphanCacheAboveHeight).toHaveBeenCalledWith(old[0].height - 1);
    });

    test('is waited for while the new chain is in initial block download', async () => {
      // a regtest node started again from its genesis block
      mockNode(wiped.slice(0, 1));
      getBlockchainInfo.mockResolvedValue({ blocks: 0, headers: 0, initialblockdownload: true, bestblockhash: wiped[0].id });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(cachedIds()).toEqual(old.map(block => block.id));
      expect(handleReorg).not.toHaveBeenCalled();
    });
  });

  test('fails a run whose block does not extend a cached tip the node still has', async () => {
    // the node answers C, whose parent is B, above the cached A it still has
    // at 101: its chain changed while the run asked about it
    const [p, a] = chainOf(['p', 'a']);
    const [, , c] = chainOf(['p', 'b', 'c']);
    blocks.setBlocks([cached(p), cached(a)]);
    mockNode([p, a, c]);

    await expect(blocks.$updateBlocks()).rejects.toThrow(`does not extend the cached tip ${a.id}`);

    expect(cachedIds()).toEqual([p.id, a.id]);
    expect(handleReorg).not.toHaveBeenCalled();
  });

  describe('a cache loaded with blocks the node does not have', () => {
    beforeEach(() => {
      (blocks as unknown as { initialSyncComplete: boolean }).initialSyncComplete = false;
    });

    test.each([1, 2])('keeps blocks the node may still connect, %d above its tip, and the database and clients as they are', async (behind) => {
      // a restart while the node catches up: the cache ends at 103, and the
      // node has the cached blocks up to its tip, and the headers above it
      const { setCanonical, deleteHashrates, deleteClusters, reindex } = mockIndexing();
      jest.replaceProperty(config.REDIS, 'ENABLED', true);
      const chain = chainOf(['p', 'a', 'c', 'd']);
      const ids = chain.map(block => block.id);
      blocks.setBlocks(chain.map(cached));
      blocks.setBlockSummaries(chain.map(block => ({ id: block.id, transactions: [] })));
      const node = chain.slice(0, chain.length - behind);
      mockNode(node);
      getBlockchainInfo.mockResolvedValue({ blocks: node[node.length - 1].height, headers: 103, initialblockdownload: false, bestblockhash: node[node.length - 1].id });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(cachedIds()).toEqual(ids);
      expect(blocks.getBlockSummaries().map(summary => summary.id)).toEqual(ids);
      expect(blocks.getCurrentBlockHeight()).toBe(103);
      expect(setCanonical).not.toHaveBeenCalled();
      expect(deleteHashrates).not.toHaveBeenCalled();
      expect(deleteClusters).not.toHaveBeenCalled();
      expect(reindex).not.toHaveBeenCalled();
      expect(chainTips.clearOrphanCacheAboveHeight).not.toHaveBeenCalled();
      expect(redisCache.$updateBlocks).not.toHaveBeenCalled();
      expect(diskCache.$saveCacheToDisk).not.toHaveBeenCalled();
      expect(handleReorg).not.toHaveBeenCalled();
    });

    test('drops a cache that is all above the node tip, without asking the node for those heights', async () => {
      // no cached block is at or below the node's tip, so none can be
      // checked, and the cache may predate a chain wipe
      const old = chainOf(['c', 'd'], 102);
      const node = chainOf(['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 94);
      blocks.setBlocks(old.map(cached));
      mockNode(node);

      // as for an empty cache, the run syncs the node's last INITIAL_BLOCKS_AMOUNT (8) blocks
      await expect(blocks.$updateBlocks()).resolves.toBe(8);

      expect(cachedIds()).toEqual(node.map(block => block.id));
      expect(blocks.getCurrentBlockHeight()).toBe(101);
      expect(handleReorg).toHaveBeenCalledTimes(1);
      expect(coreApi.$getBlockHash).not.toHaveBeenCalledWith(102);
      expect(coreApi.$getBlockHash).not.toHaveBeenCalledWith(103);
      // the orphan cache is cleared from the first dropped height, then refilled
      const clearOrphans = jest.mocked(chainTips.clearOrphanCacheAboveHeight);
      const refillOrphans = jest.mocked(chainTips.updateOrphanedBlocks);
      expect(clearOrphans).toHaveBeenCalledWith(101);
      expect(refillOrphans.mock.invocationCallOrder[0]).toBeGreaterThan(clearOrphans.mock.invocationCallOrder[0]);
    });

    test.each([
      ['in initial block download', { initialblockdownload: true }],
      ['with headers it has not connected yet', { headers: 103 }],
    ])('waits for a node %s, 40 blocks below the cache, and leaves the database and clients as they are', async (_, syncing) => {
      // a restart while the node reindexes its chain state: no cached block
      // is at or below its tip, so none can be checked
      const { setCanonical, deleteHashrates, deleteClusters, reindex } = mockIndexing();
      jest.replaceProperty(config.REDIS, 'ENABLED', true);
      const chain = chainOf(fillsOf('c', 104), 0);
      const ids = chain.slice(-4).map(block => block.id);
      blocks.setBlocks(chain.slice(-4).map(cached));
      blocks.setBlockSummaries(ids.map(id => ({ id, transactions: [] })));
      mockNode(chain.slice(0, 64));
      getBlockchainInfo.mockResolvedValue({ blocks: 63, headers: 63, initialblockdownload: false, ...syncing });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);

      expect(cachedIds()).toEqual(ids);
      expect(blocks.getBlockSummaries().map(summary => summary.id)).toEqual(ids);
      expect(blocks.getCurrentBlockHeight()).toBe(103);
      expect(setCanonical).not.toHaveBeenCalled();
      expect(deleteHashrates).not.toHaveBeenCalled();
      expect(deleteClusters).not.toHaveBeenCalled();
      expect(reindex).not.toHaveBeenCalled();
      expect(chainTips.clearOrphanCacheAboveHeight).not.toHaveBeenCalled();
      expect(redisCache.$updateBlocks).not.toHaveBeenCalled();
      expect(diskCache.$saveCacheToDisk).not.toHaveBeenCalled();
      expect(handleReorg).not.toHaveBeenCalled();
    });

    test('drops a cache all above the node tip once the node reports itself synced, after a run that waited for it', async () => {
      // a chain wipe, with the node syncing the new chain, which ends below
      // the cache. The run that waits completes the first sync.
      const old = chainOf(['c', 'd'], 102);
      const wiped = chainOf(fillsOf('n', 8), 94);
      blocks.setBlocks(old.map(cached));
      mockNode(wiped);
      getBlockchainInfo.mockResolvedValueOnce({ blocks: 101, headers: 101, initialblockdownload: true });

      await expect(blocks.$updateBlocks()).resolves.toBe(0);
      expect(cachedIds()).toEqual(old.map(block => block.id));

      await expect(blocks.$updateBlocks()).resolves.toBe(8);
      expect(cachedIds()).toEqual(wiped.map(block => block.id));
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('syncs the node chain again when it shares no cached block', async () => {
      // a chain wipe: the node's new chain, at 90 to 101, is shorter than the
      // cache and has none of its blocks
      const old = chainOf(['p', 'a', 'c', 'd']);
      const wiped = chainOf(['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'q', 'r'], 90);
      blocks.setBlocks(old.map(cached));
      mockNode(wiped);

      // as for an empty cache, the run syncs the node's last INITIAL_BLOCKS_AMOUNT (8) blocks
      await expect(blocks.$updateBlocks()).resolves.toBe(8);

      expect(cachedIds()).toEqual(wiped.slice(-8).map(block => block.id));
      expect(blocks.getCurrentBlockHeight()).toBe(101);
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });

    test('replaces a cached tip below the node tip that the node does not have', async () => {
      // the node is a block ahead, on a chain that no longer has the cached tip
      const [p, a] = chainOf(['p', 'a']);
      const node = chainOf(['p', 'b', 'c']);
      blocks.setBlocks([cached(p), cached(a)]);
      mockNode(node);

      await expect(blocks.$updateBlocks()).resolves.toBe(2);

      expect(cachedIds()).toEqual(node.map(block => block.id));
      expect(handleReorg).toHaveBeenCalledTimes(1);
    });
  });

  describe('stall warning', () => {
    const stallWarnings = (): unknown[][] => jest.mocked(logger.err).mock.calls.filter(([msg]) => String(msg).includes('$updateBlocks stalled'));

    test('is not logged for a run that failed', async () => {
      jest.useFakeTimers();
      coreApi.$getBlockHashTip.mockRejectedValue(new Error('RPC unavailable'));

      await expect(blocks.$updateBlocks()).rejects.toThrow('RPC unavailable');
      jest.advanceTimersByTime(3 * 60 * 1000);

      expect(stallWarnings()).toEqual([]);
    });

    test('is logged for a run that has not ended after two minutes', async () => {
      jest.useFakeTimers();
      coreApi.$getBlockHashTip.mockReturnValue(new Promise<string>(() => undefined));

      void blocks.$updateBlocks();
      jest.advanceTimersByTime(2 * 60 * 1000 + 1);

      expect(stallWarnings()).toEqual([['$updateBlocks stalled at "begin $updateBlocks"']]);
    });
  });
});
