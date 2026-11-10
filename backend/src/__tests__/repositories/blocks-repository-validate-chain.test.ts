const mockDbQuery = jest.fn();
const mockGetBlockHashTip = jest.fn();
const mockGetBlockHash = jest.fn();
const mockGetBlock = jest.fn();
const mockDeleteHashrates = jest.fn();
const mockDeleteClusters = jest.fn();
const mockDeleteClustersAt = jest.fn();
const mockEsploraTip = jest.fn();
const mockLoggerWarn = jest.fn();
let mockCpfpIndexing = true;

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    DATABASE: {
      ENABLED: true,
    },
    MEMPOOL: {
      NETWORK: 'testnet4',
      INDEXING_BLOCKS_AMOUNT: 11000,
    },
  },
}));

jest.mock('../../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  // the esplora backend's view, which can lag the node around a reorg
  default: {
    $getBlockHashTip: mockEsploraTip,
  },
  bitcoinCoreApi: {
    $getBlockHashTip: mockGetBlockHashTip,
    $getBlockHash: mockGetBlockHash,
    $getBlock: mockGetBlock,
  },
}));

jest.mock('../../api/common', () => ({
  __esModule: true,
  Common: { cpfpIndexingEnabled: () => mockCpfpIndexing },
}));

jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../repositories/HashratesRepository', () => ({
  __esModule: true,
  default: {
    $deleteHashratesFromTimestamp: mockDeleteHashrates,
  },
}));

jest.mock('../../repositories/CpfpRepository', () => ({
  __esModule: true,
  default: {
    $deleteClustersFrom: mockDeleteClusters,
    $deleteClustersAt: mockDeleteClustersAt,
  },
}));

jest.mock('../../repositories/BlocksSummariesRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../repositories/BlocksAuditsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/chain-tips', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/mining/mining', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../tasks/pools-updater', () => ({
  __esModule: true,
  default: {
    currentSha: 'qbit-testsha',
  },
}));

jest.mock('../../api/transaction-utils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    err: jest.fn(),
    info: jest.fn(),
    notice: jest.fn(),
    warn: mockLoggerWarn,
    tags: {
      mining: 'mining',
    },
  },
}));

import BlocksRepository from '../../repositories/BlocksRepository';

interface Row {
  height: number,
  hash: string,
  previous_block_hash: string,
  timestamp: number,
  stale: number,
}

const hash = (fill: string): string => fill.repeat(64);

// a canonical row at the given height, a minute after the one below it
const row = (height: number, fill: string, previousFill: string): Row => ({
  height, hash: hash(fill), previous_block_hash: hash(previousFill), timestamp: 1700000000 + 60 * height, stale: 0,
});

const WEEK = 604800;

// the node's best chain is ...98 <- 99 <- ... <- 103, with ids made from
// these characters. The database has it up to 102, unless a test says so.
const best: Record<number, string> = { 98: 'h', 99: 'i', 100: 'j', 101: 'k', 102: 'l', 103: 'm' };
const bestRow = (height: number): Row => row(height, best[height], best[height - 1] ?? '0');

// mocks the node's best chain and the database's blocks table
const mockChain = (rows: Row[], tip = hash(best[102])): void => {
  mockGetBlockHashTip.mockResolvedValue(tip);
  mockGetBlockHash.mockImplementation(async (height: number) => {
    if (!best[height]) {
      throw Object.assign(new Error('Block height out of range'), { code: -8 });
    }
    return hash(best[height]);
  });
  mockGetBlock.mockImplementation(async (id: string) => {
    const height = Object.keys(best).map(Number).find(h => hash(best[h]) === id);
    return height === undefined ? undefined : { id, height };
  });
  const sorted = [...rows].sort((a, b) => b.height - a.height);
  mockDbQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT')) {
      return [sorted];
    }
    return [{ affectedRows: 1 }];
  });
};

const updates = (): unknown[][] => mockDbQuery.mock.calls
  .filter(([sql]) => String(sql).includes('UPDATE blocks'))
  .map(([sql, params]) => [String(sql).replace(/\s+/g, ' ').trim(), params]);

const markedStaleAt = (height: number, except = ''): unknown[] => ['UPDATE blocks SET stale = 1 WHERE height = ? AND hash != ?', [height, except]];
const madeCanonical = (fill: string): unknown[] => ['UPDATE blocks SET stale = 0 WHERE hash = ?', [hash(fill)]];

// when the first canonical flag was written, in jest's call order
const firstUpdateOrder = (): number => mockDbQuery.mock.invocationCallOrder[
  mockDbQuery.mock.calls.findIndex(([sql]) => String(sql).includes('UPDATE blocks'))
];

describe('BlocksRepository $validateChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCpfpIndexing = true;
  });

  test('accepts a chain whose best blocks are its only canonical rows', async () => {
    // an orphan at 101 that is already stale is left as it is
    mockChain([bestRow(98), bestRow(99), bestRow(100), bestRow(101), { ...row(101, 'o', 'j'), stale: 1 }, bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(true);

    expect(updates()).toEqual([]);
    expect(mockDeleteHashrates).not.toHaveBeenCalled();
    expect(mockDeleteClusters).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  test('marks another chain\'s row stale where the best block is not indexed, and has the indexer run again', async () => {
    // 99 holds only a row from another chain, as after a reorg deeper than
    // the block cache: it would keep 99 counted as indexed. The best block's
    // row is left canonical, though there is none in the snapshot: the sync
    // loop may save it after the snapshot is read.
    const other = row(99, 'o', 'h');
    mockChain([bestRow(98), other, bestRow(100), bestRow(101), bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
    expect(mockDeleteHashrates).toHaveBeenCalledWith(other.timestamp - WEEK);
    expect(mockDeleteClusters).toHaveBeenCalledWith(99);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith('Chain divergence detected at block 99: repairing 1 of the heights from #99 to #99');
  });

  test('marks another canonical row stale next to an indexed best block', async () => {
    const other = row(101, 'o', 'j');
    mockChain([bestRow(98), bestRow(99), bestRow(100), bestRow(101), other, bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(updates()).toEqual([madeCanonical(best[101]), markedStaleAt(101, hash(best[101]))]);
    expect(mockDeleteHashrates).toHaveBeenCalledWith(other.timestamp - WEEK);
    expect(mockDeleteClusters).toHaveBeenCalledWith(101);
  });

  test('makes a stale best block canonical, and deletes hashrates from a week before it and CPFP clusters at its height', async () => {
    // the hashrates were never deleted: the timestamp was looked up by height
    // in a map of blocks by hash, which threw
    const stale = { ...bestRow(101), stale: 1 };
    mockChain([bestRow(98), bestRow(99), bestRow(100), stale, bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(updates()).toEqual([madeCanonical(best[101]), markedStaleAt(101, hash(best[101]))]);
    expect(mockDeleteHashrates).toHaveBeenCalledWith(stale.timestamp - WEEK);
    expect(mockDeleteClusters).toHaveBeenCalledWith(101);
  });

  test('deletes hashrates from a week before the earliest block it changed and CPFP clusters at each repaired height, and warns once', async () => {
    // another chain's rows at 99 and at 101, next to a stale best block. The
    // one at 101 is timestamped before the one at 99, as block times only
    // roughly follow heights: the hashrates from its time on are re-indexed.
    const other99 = row(99, 'o', 'h');
    const other101 = { ...row(101, 'p', 'n'), timestamp: other99.timestamp - 3600 };
    mockChain([bestRow(98), other99, bestRow(100), { ...bestRow(101), stale: 1 }, other101, bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(updates()).toEqual([
      madeCanonical(best[101]), markedStaleAt(101, hash(best[101])),
      madeCanonical(best[99]), markedStaleAt(99, hash(best[99])),
    ]);
    expect(mockDeleteHashrates).toHaveBeenCalledTimes(1);
    expect(mockDeleteHashrates).toHaveBeenCalledWith(other101.timestamp - WEEK);
    // the CPFP clusters from 99 up are deleted once: the indexer counts a
    // height with any cluster row as indexed
    expect(mockDeleteClusters.mock.calls).toEqual([[99]]);
    expect(mockDeleteClustersAt).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith('Chain divergence detected at block 99: repairing 2 of the heights from #99 to #101');
  });

  test('deletes the CPFP clusters from the repaired height up, not only at it', async () => {
    // a transaction the old chain held at 99 and the node's chain mined at
    // 101 keeps its CPFP mapping only if 101 is indexed again: deleting at 99
    // alone removes the mapping, and 101 still counts as indexed
    mockChain([bestRow(98), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(mockDeleteClusters.mock.calls).toEqual([[99]]);
    expect(mockDeleteClustersAt).not.toHaveBeenCalled();
  });

  test('walks from the node\'s tip, not from an esplora backend that still serves the replaced chain', async () => {
    // the node has replaced 102's sibling, and the database already has its
    // block canonical: an esplora tip on the old chain would mark it stale
    mockChain([bestRow(98), bestRow(99), bestRow(100), bestRow(101), bestRow(102), { ...row(102, 'o', 'k'), stale: 1 }]);
    mockEsploraTip.mockResolvedValue(hash('o'));

    await expect(BlocksRepository.$validateChain()).resolves.toBe(true);

    expect(mockEsploraTip).not.toHaveBeenCalled();
    expect(updates()).toEqual([]);
  });

  test('keeps the CPFP clusters when the CPFP indexer is off, as nothing would index them again', async () => {
    // clusters then only come from indexing a block's summary, which skips
    // blocks that have one: deleting them from 99 up would lose every valid
    // block's above it for good
    mockCpfpIndexing = false;
    mockChain([bestRow(98), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(mockDeleteClusters).not.toHaveBeenCalled();
    expect(mockDeleteHashrates).toHaveBeenCalledTimes(1);
    expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
  });

  test('deletes the derived data before it writes any flag', async () => {
    mockChain([bestRow(98), row(99, 'o', 'h'), bestRow(100), { ...bestRow(101), stale: 1 }, bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(updates()).toHaveLength(4);
    expect(mockDeleteHashrates.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
    expect(mockDeleteClusters.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
  });

  test('writes no flag when deleting the CPFP clusters fails, and its next run repeats the repair and the deletion', async () => {
    // a lock timeout, say. With the flag written first, the next run found
    // nothing to repair, and the other chain's clusters at 99 stayed: the
    // CPFP indexer counts the height as indexed.
    mockChain([bestRow(98), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)]);
    mockDeleteClusters.mockRejectedValueOnce(new Error('DB unavailable'));

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
    expect(mockDeleteClusters).toHaveBeenCalledWith(99);
    expect(updates()).toEqual([]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
    expect(mockDeleteClusters).toHaveBeenCalledTimes(2);
    expect(mockDeleteClusters).toHaveBeenLastCalledWith(99);
    expect(mockDeleteHashrates).toHaveBeenCalledTimes(2);
    expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
  });

  test('leaves the flags it could not write to its next run, which deletes the derived data again from its own lowest repair', async () => {
    // repairs at 101 and 99, and the database fails on the first write at 99
    const other = row(99, 'o', 'h');
    mockChain([bestRow(98), other, bestRow(100), { ...bestRow(101), stale: 1 }, bestRow(102)]);
    const snapshot = mockDbQuery.getMockImplementation();
    let written = 0;
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('UPDATE') && ++written === 3) {
        throw new Error('DB unavailable');
      }
      return snapshot?.(sql);
    });

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
    expect(mockDeleteClusters).toHaveBeenCalledWith(99);
    expect(mockDeleteClusters.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
    expect(updates()).toEqual([madeCanonical(best[101]), markedStaleAt(101, hash(best[101])), madeCanonical(best[99])]);

    // the next run's snapshot has 101 repaired
    jest.clearAllMocks();
    mockChain([bestRow(98), other, bestRow(100), bestRow(101), bestRow(102)]);

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
    expect(mockDeleteClusters).toHaveBeenCalledWith(99);
    expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
  });

  test('writes nothing, and has the indexer run again, when the walk fails after finding a repair', async () => {
    // the node stops answering below a height to repair: the next run walks
    // again, and repairs it then
    const stale = { ...bestRow(101), stale: 1 };
    mockChain([bestRow(98), bestRow(100), stale, bestRow(102)]);
    mockGetBlockHash.mockRejectedValue(new Error('RPC unavailable'));

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(updates()).toEqual([]);
    expect(mockDeleteHashrates).not.toHaveBeenCalled();
    expect(mockDeleteClusters).not.toHaveBeenCalled();
  });

  test('changes nothing when it fails before a repair', async () => {
    mockChain([bestRow(98), bestRow(99), bestRow(100), bestRow(101), bestRow(102)]);
    mockGetBlockHashTip.mockRejectedValue(new Error('RPC unavailable'));

    await expect(BlocksRepository.$validateChain()).resolves.toBe(true);

    expect(updates()).toEqual([]);
    expect(mockDeleteHashrates).not.toHaveBeenCalled();
    expect(mockDeleteClusters).not.toHaveBeenCalled();
  });

  test('reads the node\'s tip after its snapshot, and so follows the chain the snapshot has', async () => {
    // the node switched from ...j <- o <- p to ...j <- k <- l as the
    // validation started, and the sync loop rolled o and p back and saved k
    // and l before the snapshot. From p, read first, the walk made o and p
    // canonical again and marked k and l stale, until the next run.
    mockChain([
      bestRow(98), bestRow(99), bestRow(100), bestRow(101), bestRow(102),
      { ...row(101, 'o', 'j'), stale: 1 }, { ...row(102, 'p', 'o'), stale: 1 },
    ], hash('p'));
    const snapshot = mockDbQuery.getMockImplementation();
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT')) {
        mockGetBlockHashTip.mockResolvedValue(hash(best[102]));
      }
      return snapshot?.(sql);
    });

    await expect(BlocksRepository.$validateChain()).resolves.toBe(true);

    expect(mockGetBlockHashTip.mock.invocationCallOrder[0]).toBeGreaterThan(mockDbQuery.mock.invocationCallOrder[0]);
    expect(updates()).toEqual([]);
    expect(mockDeleteHashrates).not.toHaveBeenCalled();
    expect(mockDeleteClusters).not.toHaveBeenCalled();
  });

  test('validates from the node\'s tip before it is indexed', async () => {
    // the node is a block ahead of the database, whose 99 is from another
    // chain. Looking the tip up among the indexed blocks threw, so nothing
    // was checked until a run found the tip indexed.
    mockChain([bestRow(98), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)], hash(best[103]));

    await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

    expect(mockGetBlock).toHaveBeenCalledWith(hash(best[103]));
    expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
  });
});
