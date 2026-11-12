const mockDbQuery = jest.fn();
const mockGetBlockHashTip = jest.fn();
const mockGetBlockHash = jest.fn();
const mockGetBlock = jest.fn();
const mockDeleteHashrates = jest.fn();
const mockRetryMissingHashrates = jest.fn();
const mockDeleteHashratesBetween = jest.fn();
const mockIndexBlock = jest.fn();
const mockDeleteClusters = jest.fn();
const mockDeleteClustersAt = jest.fn();
const mockEsploraTip = jest.fn();
const mockLoggerWarn = jest.fn();
let mockCpfpIndexing = true;
let mockIndexingBlocksAmount = 11000;

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
      get INDEXING_BLOCKS_AMOUNT(): number {
        return mockIndexingBlocksAmount;
      },
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
    retryMissingHashrates: mockRetryMissingHashrates,
    $deleteHashratesBetween: mockDeleteHashratesBetween,
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
  default: {
    $indexBlock: mockIndexBlock,
  },
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
  mockDbQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT')) {
      return [sql.includes('WHERE stale = 0') ? sorted.filter(stored => !stored.stale) : sorted];
    }
    return [{ affectedRows: 1 }];
  });
};

const updates = (): unknown[][] => mockDbQuery.mock.calls
  .filter(([sql]) => String(sql).includes('UPDATE blocks'))
  .map(([sql, params]) => [String(sql).replace(/\s+/g, ' ').trim(), params]);

const markedStaleAt = (height: number, except = ''): unknown[] => ['UPDATE blocks SET stale = 1 WHERE height = ? AND hash != ?', [height, except]];
const madeCanonical = (fill: string): unknown[] => ['UPDATE blocks SET stale = 0 WHERE hash = ?', [hash(fill)]];

// mocks the node's best chain and a blocks table that the flags written
// change, failing once on the first write failsOnce picks
const mockWritableChain = (rows: Row[], failsOnce: (sql: string, params: unknown[]) => boolean): Row[] => {
  const table = rows.map(stored => ({ ...stored }));
  mockChain(table);
  let failed = false;
  mockDbQuery.mockImplementation(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT')) {
      return [[...table].sort((a, b) => b.height - a.height).map(stored => ({ ...stored }))];
    }
    if (!failed && failsOnce(sql, params)) {
      failed = true;
      throw new Error('DB unavailable');
    }
    const statement = String(sql).replace(/\s+/g, ' ').trim();
    if (statement === 'UPDATE blocks SET stale = 0 WHERE hash = ?') {
      table.filter(stored => stored.hash === params[0]).forEach(stored => { stored.stale = 0; });
    } else if (statement === 'UPDATE blocks SET stale = 1 WHERE height = ? AND hash != ?') {
      table.filter(stored => stored.height === params[0] && stored.hash !== params[1]).forEach(stored => { stored.stale = 1; });
    }
    return [{ affectedRows: 1 }];
  });
  return table;
};

const canonicalAt = (table: Row[], height: number): string[] => table.filter(stored => stored.height === height && !stored.stale).map(stored => stored.hash);

// when the first canonical flag was written, in jest's call order
const firstUpdateOrder = (): number => mockDbQuery.mock.invocationCallOrder[
  mockDbQuery.mock.calls.findIndex(([sql]) => String(sql).includes('UPDATE blocks'))
];

describe('BlocksRepository $validateChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCpfpIndexing = true;
    mockIndexingBlocksAmount = 11000;
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

  describe('below the walk', () => {
    // the indexing window is 100 to 102, and the walk checks 101 and 102
    beforeEach(() => {
      mockIndexingBlocksAmount = 3;
      (BlocksRepository as unknown as { heightsLeftBelowWalk: Map<number, string> }).heightsLeftBelowWalk.clear();
    });

    test('repairs a height below the indexing window with two canonical rows, asking qbitd which is its block', async () => {
      // 99 holds the best block and another chain's, both canonical, as an
      // older version left them
      mockChain([bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
      expect(mockGetBlockHash.mock.calls).toEqual([[99]]);
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
      expect(mockLoggerWarn).toHaveBeenCalledWith('Chain divergence detected below block #101: repairing 1 height, #99');
    });

    test('has the hashrate indexers retry the periods they skipped, without deleting every hashrate since or the CPFP clusters', async () => {
      // the hashrate indexers skipped the periods whose block window held
      // both rows at 99. Deleting the hashrates from a week before 99 would
      // re-index every one since, and the CPFP indexer never indexes 99 again.
      mockChain([bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockRetryMissingHashrates).toHaveBeenCalledTimes(1);
      expect(mockRetryMissingHashrates.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
      expect(mockDeleteHashrates).not.toHaveBeenCalled();
      expect(mockDeleteClusters).not.toHaveBeenCalled();
    });

    test('repairs the window\'s lowest height, which the walk stops above, and the heights below it', async () => {
      // another chain's o at 99 and p at 100 were left canonical
      mockChain([
        bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), row(100, 'p', 'o'), bestRow(101), bestRow(102),
      ]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(updates()).toEqual([
        madeCanonical(best[100]), markedStaleAt(100, hash(best[100])),
        madeCanonical(best[99]), markedStaleAt(99, hash(best[99])),
      ]);
      // the walk knows qbitd's block at 100, the one 101's row names
      expect(mockGetBlockHash.mock.calls).toEqual([[99]]);
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
      expect(mockLoggerWarn).toHaveBeenCalledWith('Chain divergence detected below block #101: repairing 2 heights, #99, #100');
    });

    test('asks qbitd at a height with two canonical rows even when the canonical row above names one of them', async () => {
      // 98 holds the best block h and an orphan p, both canonical. 99 holds
      // only q, p's child, also canonical: the best block i at 99 was never
      // indexed. q names p, but h is qbitd's block, and must stay canonical.
      // Then q is canonical on a stale parent, so qbitd is asked about 99
      // too. i isn't indexed there, so q is left, and that is said.
      mockChain([bestRow(98), row(98, 'p', 'g'), row(99, 'q', 'p'), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockGetBlockHash.mock.calls).toEqual([[98], [99]]);
      expect(updates()).toEqual([madeCanonical(best[98]), markedStaleAt(98, hash(best[98]))]);
      expect(mockLoggerWarn.mock.calls).toEqual([
        ['Chain divergence detected below block #101: repairing 1 height, #98'],
        ['Chain divergence detected below block #101: none of the canonical blocks at #99 is qbitd\'s, so they are left as they are'],
      ]);
    });

    test('asks qbitd about the lone canonical rows above a height it asked about, while they name another block below', async () => {
      // as above, but qbitd's i is indexed at 99, marked stale. Once h is the
      // only canonical row at 98, q, p's child, can't be qbitd's block: i
      // becomes canonical at 99. 100's row names i, so the check stops there.
      mockChain([
        bestRow(98), row(98, 'p', 'g'), row(99, 'q', 'p'), { ...bestRow(99), stale: 1 }, bestRow(100), bestRow(101), bestRow(102),
      ]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockGetBlockHash.mock.calls).toEqual([[98], [99]]);
      // written from the highest height down
      expect(updates()).toEqual([
        madeCanonical(best[99]), markedStaleAt(99, hash(best[99])),
        madeCanonical(best[98]), markedStaleAt(98, hash(best[98])),
      ]);
      expect(mockLoggerWarn).toHaveBeenCalledWith('Chain divergence detected below block #101: repairing 2 heights, #98, #99');
    });

    test('leaves a height where no canonical row is qbitd\'s block as it is, and says so once', async () => {
      // two other chains' blocks at 99, and qbitd's i isn't indexed. Marking
      // both stale would leave a gap that nothing below the window indexes,
      // where the hashrate indexers would stop.
      mockChain([bestRow(98), row(99, 'o', 'h'), row(99, 'p', 'h'), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);
      expect(mockGetBlockHash.mock.calls).toEqual([[99]]);
      expect(updates()).toEqual([]);
      expect(mockRetryMissingHashrates).not.toHaveBeenCalled();
      expect(mockLoggerWarn.mock.calls).toEqual([
        ['Chain divergence detected below block #101: none of the canonical blocks at #99 is qbitd\'s, so they are left as they are'],
      ]);

      // the next run doesn't ask or say it again
      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);
      expect(mockGetBlockHash).toHaveBeenCalledTimes(1);
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);

      // until its rows change: here, qbitd's block was indexed there since
      mockChain([bestRow(98), row(99, 'o', 'h'), row(99, 'p', 'h'), bestRow(99), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(mockGetBlockHash).toHaveBeenCalledTimes(2);
      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
    });

    test('makes a stale best block canonical once qbitd confirms it, and leaves a height that only holds an orphan without asking', async () => {
      // the best block at 99 is marked stale, and 100's row names it. 98
      // holds only an orphan, whose sibling h isn't indexed: asking qbitd
      // about every such height would repeat on every run.
      mockChain([{ ...row(98, 'o', 'g'), stale: 1 }, { ...bestRow(99), stale: 1 }, bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
      expect(mockGetBlockHash.mock.calls).toEqual([[99]]);
      expect(mockLoggerWarn).toHaveBeenCalledWith('Chain divergence detected below block #101: repairing 1 height, #99');
    });

    test('leaves a stale row stale when the canonical row above names it but qbitd\'s block is another', async () => {
      // 99's only row is r, another chain's block left canonical, and it
      // names q, stale at 98. qbitd's block at 98 is h, which isn't indexed.
      // So r isn't qbitd's block at 99 either: qbitd's i isn't indexed there,
      // so r is left, and that is said. 100's row names i.
      mockChain([{ ...row(98, 'q', 'g'), stale: 1 }, row(99, 'r', 'q'), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);
      expect(mockGetBlockHash.mock.calls).toEqual([[98], [99]]);
      expect(updates()).toEqual([]);
      expect(mockLoggerWarn.mock.calls).toEqual([
        ['Chain divergence detected below block #101: none of the canonical blocks at #99 is qbitd\'s, so they are left as they are'],
      ]);

      // nor asks about them again
      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);
      expect(mockGetBlockHash).toHaveBeenCalledTimes(2);
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    });

    test('repairs below the walk once the walked heights need no repair', async () => {
      // 101 and 99 each hold another canonical row. The first run repairs
      // 101 and deletes the derived data from there up, as before; the next
      // one repairs 99.
      const other101 = row(101, 'p', 'j');
      mockChain([bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), bestRow(101), other101, bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(updates()).toEqual([madeCanonical(best[101]), markedStaleAt(101, hash(best[101]))]);
      expect(mockDeleteHashrates).toHaveBeenCalledWith(other101.timestamp - WEEK);
      expect(mockDeleteClusters.mock.calls).toEqual([[101]]);
      expect(mockRetryMissingHashrates).not.toHaveBeenCalled();

      jest.clearAllMocks();
      mockChain([bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), bestRow(101), { ...other101, stale: 1 }, bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
      expect(mockDeleteHashrates).not.toHaveBeenCalled();
      expect(mockDeleteClusters).not.toHaveBeenCalled();
      expect(mockRetryMissingHashrates).toHaveBeenCalledTimes(1);
    });

    test('writes nothing, and lets the indexer go on, when qbitd fails before a write below the walk', async () => {
      // 100 is repaired with the block the walk knows, then qbitd doesn't
      // answer about 98. Nothing has changed, so the indexer goes on to the
      // hashrates and the rest, as after any failed check, instead of running
      // again every 10 seconds.
      mockChain([bestRow(98), row(98, 'o', 'g'), bestRow(100), row(100, 'p', 'i'), bestRow(101), bestRow(102)]);
      mockGetBlockHash.mockRejectedValueOnce(new Error('RPC unavailable'));

      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);
      expect(mockGetBlockHash.mock.calls).toEqual([[98]]);
      expect(updates()).toEqual([]);
      expect(mockDeleteClusters).not.toHaveBeenCalled();
      expect(mockRetryMissingHashrates).not.toHaveBeenCalled();

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(updates()).toEqual([
        madeCanonical(best[100]), markedStaleAt(100, hash(best[100])),
        madeCanonical(best[98]), markedStaleAt(98, hash(best[98])),
      ]);
    });

    test('has the indexer run again when a write below the walk fails', async () => {
      // the database fails on the second flag at 99
      mockChain([bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), bestRow(101), bestRow(102)]);
      const snapshot = mockDbQuery.getMockImplementation();
      let written = 0;
      mockDbQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('UPDATE') && ++written === 2) {
          throw new Error('DB unavailable');
        }
        return snapshot?.(sql);
      });

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
      expect(mockRetryMissingHashrates).toHaveBeenCalledTimes(1);
    });

    test('writes its repairs from the highest height down, so a failed write leaves the rest for the next run to find', async () => {
      // 98 holds qbitd's h and an orphan p, both canonical. 99 holds q, p's
      // child, canonical, and qbitd's i, stale. The check repairs 98, and from
      // there 99. Had it written 98 first, and then failed at 99, the next run
      // would find one canonical row at each, and q would stay canonical.
      const table = mockWritableChain([
        bestRow(98), row(98, 'p', 'g'), row(99, 'q', 'p'), { ...bestRow(99), stale: 1 }, bestRow(100), bestRow(101), bestRow(102),
      ], (sql, params) => sql.includes('stale = 0') && params[0] === hash(best[99]));

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);

      expect(canonicalAt(table, 98)).toEqual([hash(best[98])]);
      expect(canonicalAt(table, 99)).toEqual([hash(best[99])]);
    });

    test('remembers a height it leaves alone only once the repairs above it are written', async () => {
      // 98 holds two other chains' blocks, o and p, both canonical: qbitd's h
      // isn't indexed, so 98 is left alone. 99 holds q, p's child, canonical,
      // and qbitd's i, stale: from 98, the check repairs 99. Had it
      // remembered 98 before the write at 99 failed, the next run would skip
      // 98, and never get to 99.
      const table = mockWritableChain([
        row(98, 'o', 'g'), row(98, 'p', 'g'), row(99, 'q', 'p'), { ...bestRow(99), stale: 1 }, bestRow(100), bestRow(101), bestRow(102),
      ], (sql, params) => sql.includes('stale = 0') && params[0] === hash(best[99]));
      const leftAlone = 'Chain divergence detected below block #101: none of the canonical blocks at #98 is qbitd\'s, so they are left as they are';

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(leftAlone);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);

      expect(canonicalAt(table, 99)).toEqual([hash(best[99])]);
      expect(canonicalAt(table, 98)).toEqual([hash('o'), hash('p')]);
      expect(mockLoggerWarn.mock.calls.filter(([line]) => line === leftAlone)).toHaveLength(1);
    });

    test('indexes qbitd\'s block at the window\'s lowest height when none of its rows is it, and doesn\'t leave it', async () => {
      // 100 holds two other chains' blocks, both canonical, and qbitd's j
      // isn't indexed. The block indexer covers 100, but by its next run the
      // window may have moved past it; left as it is, 100 would keep the
      // wrong block
      mockChain([bestRow(98), bestRow(99), row(100, 'o', 'i'), row(100, 'p', 'i'), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockGetBlockHash).not.toHaveBeenCalled();
      expect(mockIndexBlock.mock.calls).toEqual([[hash(best[100])]]);
      expect(mockIndexBlock.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
      expect(updates()).toEqual([madeCanonical(best[100]), markedStaleAt(100, hash(best[100]))]);
      expect(mockLoggerWarn.mock.calls).toEqual([['Chain divergence detected below block #101: repairing 1 height, #100']]);
    });

    test('deletes the hashrates computed with a lone canonical row it replaces', async () => {
      // 99's only canonical row was q, so the periods around it were indexed
      // with q, and the indexers keep periods that have hashrates. 98's two
      // canonical rows made the windows that hold both fail, but not the
      // one that starts at 98, with either row. From a week before each row
      // to two weeks after, but only after 98: the hashrate indexers start
      // after the oldest block of the consecutive chain, here the lowest row.
      const q = row(99, 'q', 'p');
      mockChain([bestRow(98), row(98, 'p', 'g'), q, { ...bestRow(99), stale: 1 }, bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockDeleteHashratesBetween.mock.calls).toEqual([
        [bestRow(98).timestamp + 1, bestRow(98).timestamp + 2 * WEEK],
        [bestRow(98).timestamp + 1, q.timestamp + 2 * WEEK],
      ]);
      expect(mockDeleteHashratesBetween.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
      expect(mockDeleteHashrates).not.toHaveBeenCalled();
    });

    test('repairs a lone canonical row at the window\'s lowest height that isn\'t qbitd\'s block, with the block the walk knows', async () => {
      // 100's only canonical row is r, from another chain; qbitd's j is
      // there, stale. 101's row names j, so no qbitd call is needed.
      const r = row(100, 'r', 'i');
      mockChain([bestRow(98), bestRow(99), r, { ...bestRow(100), stale: 1 }, bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockGetBlockHash).not.toHaveBeenCalled();
      expect(mockIndexBlock).not.toHaveBeenCalled();
      expect(updates()).toEqual([madeCanonical(best[100]), markedStaleAt(100, hash(best[100]))]);
      expect(mockDeleteHashratesBetween.mock.calls).toEqual([[bestRow(98).timestamp + 1, r.timestamp + 2 * WEEK]]);
      expect(mockLoggerWarn.mock.calls).toEqual([['Chain divergence detected below block #101: repairing 1 height, #100']]);
    });

    test('deletes the hashrates around a replaced lone row even when the same repairs fill a gap above it', async () => {
      // the window is 101 and 102. 100 holds only qbitd's j, stale, which
      // 101's row names: a gap in the canonical chain, which the repair
      // fills. 98 holds qbitd's h and another chain's x, both canonical, and
      // 99 holds x's child q, canonical, and qbitd's i, stale: q is replaced.
      // The blocks above 100 came three weeks later. Read before the flags,
      // the hashrate indexers' oldest block was 101, after q's periods, so
      // none were deleted, though the indexers would go past 100 once the gap
      // was filled.
      mockIndexingBlocksAmount = 2;
      const later = (stored: Row): Row => ({ ...stored, timestamp: stored.timestamp + 3 * WEEK });
      const q = row(99, 'q', 'x');
      mockChain([
        bestRow(98), row(98, 'x', 'g'), q, { ...bestRow(99), stale: 1 }, { ...bestRow(100), stale: 1 },
        later(bestRow(101)), later(bestRow(102)),
      ]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockGetBlockHash.mock.calls).toEqual([[100], [98], [99]]);
      // and around 98's two rows, the anchors of the period after them
      expect(mockDeleteHashratesBetween.mock.calls).toEqual([
        [bestRow(98).timestamp + 1, bestRow(98).timestamp + 2 * WEEK],
        [bestRow(98).timestamp + 1, q.timestamp + 2 * WEEK],
      ]);
    });

    test('deletes the hashrates of the period that starts at a height with two canonical rows, whose window took either row', async () => {
      // a block window that holds both of 99's rows fails, but one whose
      // oldest block, its anchor, is at 99 reads only one of them, either
      // one: the period after 99 may have been computed with o. o is a day
      // later than i. From a week before each row to two weeks after, but
      // only after 98, as for a lone row.
      const o = { ...row(99, 'o', 'h'), timestamp: bestRow(99).timestamp + 86400 };
      mockChain([bestRow(98), bestRow(99), o, bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
      expect(mockDeleteHashratesBetween.mock.calls).toEqual([
        [bestRow(98).timestamp + 1, bestRow(99).timestamp + 2 * WEEK],
        [bestRow(98).timestamp + 1, o.timestamp + 2 * WEEK],
      ]);
      expect(mockDeleteHashratesBetween.mock.invocationCallOrder[1]).toBeLessThan(firstUpdateOrder());
      expect(mockRetryMissingHashrates).toHaveBeenCalledTimes(1);
      expect(mockDeleteHashrates).not.toHaveBeenCalled();
    });

    test('checks a height it left alone again once that is the window\'s lowest height, after the tip went down', async () => {
      // 99 holds two other chains' blocks, and qbitd's i isn't indexed: left
      // alone, and remembered. Then qbitd's tip goes down to 101, as after a
      // reorg to a shorter chain, and 99 is the window's lowest height, where
      // the block indexer counts it as indexed. qbitd's block is indexed there
      // and made canonical, and 99 is forgotten.
      const rows = [bestRow(98), row(99, 'o', 'h'), row(99, 'p', 'h'), bestRow(100), bestRow(101)];
      const remembered = (BlocksRepository as unknown as { heightsLeftBelowWalk: Map<number, string> }).heightsLeftBelowWalk;
      mockChain([...rows, bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(true);
      expect(remembered.has(99)).toBe(true);

      mockChain(rows, hash(best[101]));
      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);

      expect(mockIndexBlock.mock.calls).toEqual([[hash(best[99])]]);
      expect(updates()).toEqual([madeCanonical(best[99]), markedStaleAt(99, hash(best[99]))]);
      expect(remembered.has(99)).toBe(false);
    });

    test('deletes the CPFP clusters from the window\'s lowest height up when it repairs that height, as the walk\'s repairs do', async () => {
      // the CPFP indexer counts a height with clusters as indexed, and covers
      // 100, so it indexes the clusters from 100 up again. It never indexes
      // 99, which keeps its clusters. The deletion comes before any flag.
      const rows = [
        bestRow(98), bestRow(99), row(99, 'o', 'h'), bestRow(100), row(100, 'p', 'o'), bestRow(101), bestRow(102),
      ];
      mockChain(rows);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(mockDeleteClusters.mock.calls).toEqual([[100]]);
      expect(mockDeleteClusters.mock.invocationCallOrder[0]).toBeLessThan(firstUpdateOrder());
      expect(mockDeleteClustersAt).not.toHaveBeenCalled();

      // a failed deletion writes no flag, and the next run deletes again
      jest.clearAllMocks();
      mockChain(rows);
      mockDeleteClusters.mockRejectedValueOnce(new Error('DB unavailable'));

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(updates()).toEqual([]);
      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(mockDeleteClusters.mock.calls).toEqual([[100], [100]]);
      expect(updates()).toHaveLength(4);

      // nor when the CPFP indexer is off: nothing would index them again
      jest.clearAllMocks();
      mockCpfpIndexing = false;
      mockChain(rows);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(mockDeleteClusters).not.toHaveBeenCalled();
      expect(updates()).toHaveLength(4);

      // with INDEXING_BLOCKS_AMOUNT at -1, the CPFP indexer covers every
      // height, and the walk stops above the lowest indexed one, 98 here
      jest.clearAllMocks();
      mockCpfpIndexing = true;
      mockIndexingBlocksAmount = -1;
      mockChain([bestRow(98), row(98, 'p', 'g'), bestRow(99), bestRow(100), bestRow(101), bestRow(102)]);

      await expect(BlocksRepository.$validateChain()).resolves.toBe(false);
      expect(mockDeleteClusters.mock.calls).toEqual([[98]]);
      expect(updates()).toEqual([madeCanonical(best[98]), markedStaleAt(98, hash(best[98]))]);
    });
  });
});
