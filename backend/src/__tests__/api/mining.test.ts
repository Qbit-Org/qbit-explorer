import mining from '../../api/mining/mining';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
import BlocksRepository, { IncompleteHashrateWindowError } from '../../repositories/BlocksRepository';
import HashratesRepository from '../../repositories/HashratesRepository';

jest.mock('../../repositories/BlocksRepository', () => {
  class MockIncompleteHashrateWindowError extends Error {}

  return {
    __esModule: true,
    IncompleteHashrateWindowError: MockIncompleteHashrateWindowError,
    default: {
      $blockCount: jest.fn(),
      $blockCountBetweenTimestamp: jest.fn(),
      $getBlockTimes: jest.fn(),
      $getHashrateWindow: jest.fn(),
      $getOldestConsecutiveBlock: jest.fn(),
    },
  };
});

jest.mock('../../repositories/HashratesRepository', () => ({
  __esModule: true,
  default: {
    $getCompleteNetworkDailyHashrateTimestamps: jest.fn(),
    $saveHashrates: jest.fn(),
  },
}));

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getBlock: jest.fn(),
    $getBlockHash: jest.fn(),
  },
}));

describe('Mining block spacing', () => {
  test('should compute spacings between consecutive blocks and skip index gaps', async () => {
    (BlocksRepository.$getBlockTimes as jest.Mock).mockResolvedValue([
      { height: 100, timestamp: 1000 },
      { height: 101, timestamp: 1060 },
      { height: 102, timestamp: 1150 },
      { height: 104, timestamp: 1300 }, // block 103 is missing from the index
      { height: 105, timestamp: 1345 },
    ]);

    const spacings = await mining.$getBlockSpacing('24h');

    expect(spacings).toStrictEqual([
      { height: 101, timestamp: 1060, spacingSeconds: 60 },
      { height: 102, timestamp: 1150, spacingSeconds: 90 },
      { height: 105, timestamp: 1345, spacingSeconds: 45 },
    ]);
  });

  test('should clamp non-monotonic timestamp artifacts to zero', async () => {
    (BlocksRepository.$getBlockTimes as jest.Mock).mockResolvedValue([
      { height: 100, timestamp: 1000 },
      { height: 101, timestamp: 940 }, // miner clock skew: earlier than its parent
      { height: 102, timestamp: 1060 },
    ]);

    const spacings = await mining.$getBlockSpacing('24h');

    expect(spacings).toStrictEqual([
      { height: 101, timestamp: 940, spacingSeconds: 0 },
      { height: 102, timestamp: 1060, spacingSeconds: 120 },
    ]);
  });

  test('should average large windows into height buckets bounded by maxPoints', async () => {
    const rows: { height: number, timestamp: number }[] = [];
    for (let i = 0; i <= 6000; i++) {
      rows.push({ height: i, timestamp: i * 60 });
    }
    (BlocksRepository.$getBlockTimes as jest.Mock).mockResolvedValue(rows);

    const spacings = await mining.$getBlockSpacing('3m', 2000);

    expect(spacings.length).toBeLessThanOrEqual(2000);
    expect(spacings[0].spacingSeconds).toEqual(60);
    expect(spacings[spacings.length - 1].height).toEqual(6000);
  });

  test('should return an empty list when there are not enough blocks', async () => {
    (BlocksRepository.$getBlockTimes as jest.Mock).mockResolvedValue([
      { height: 0, timestamp: 1000 },
    ]);

    expect(await mining.$getBlockSpacing('24h')).toStrictEqual([]);
  });

  test('should preserve completed daily rows when the genesis anchor is missing', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-12T12:00:00Z'));
    const originalIndexingBlocksAmount = config.MEMPOOL.INDEXING_BLOCKS_AMOUNT;
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);

    config.MEMPOOL.INDEXING_BLOCKS_AMOUNT = -1;
    mining.lastHashrateIndexingDate = null;
    (BlocksRepository.$getOldestConsecutiveBlock as jest.Mock).mockResolvedValue({
      timestamp: (midnight.getTime() - 12 * 60 * 60 * 1000) / 1000,
    });
    (BlocksRepository.$blockCount as jest.Mock).mockResolvedValue(1);
    (BlocksRepository.$blockCountBetweenTimestamp as jest.Mock).mockResolvedValue({ blockCount: 0 });
    (BlocksRepository.$getHashrateWindow as jest.Mock).mockRejectedValue(
      new IncompleteHashrateWindowError('missing block zero'),
    );
    (HashratesRepository.$getCompleteNetworkDailyHashrateTimestamps as jest.Mock).mockResolvedValue([]);
    (bitcoinApi.$getBlockHash as jest.Mock).mockResolvedValue('genesis-hash');
    (bitcoinApi.$getBlock as jest.Mock).mockResolvedValue({
      timestamp: (midnight.getTime() - 2 * 24 * 60 * 60 * 1000) / 1000,
      bits: 0x1d00ffff,
      difficulty: 1,
    });

    try {
      await expect(mining.$generateNetworkHashrateHistory()).resolves.toBeUndefined();

      expect(BlocksRepository.$getHashrateWindow).toHaveBeenCalledWith(1, 1);
      expect(HashratesRepository.$saveHashrates).toHaveBeenCalledTimes(1);
      expect(HashratesRepository.$saveHashrates).toHaveBeenCalledWith([
        expect.objectContaining({
          hashrateTimestamp: midnight.getTime() / 1000,
          avgHashrate: 0,
          lane: 'aggregate',
        }),
        expect.objectContaining({
          hashrateTimestamp: midnight.getTime() / 1000,
          avgHashrate: 0,
          lane: 'permissionless',
        }),
        expect.objectContaining({
          hashrateTimestamp: midnight.getTime() / 1000,
          avgHashrate: 0,
          lane: 'auxpow',
        }),
      ]);
    } finally {
      config.MEMPOOL.INDEXING_BLOCKS_AMOUNT = originalIndexingBlocksAmount;
      mining.lastHashrateIndexingDate = null;
      jest.useRealTimers();
    }
  });
});
