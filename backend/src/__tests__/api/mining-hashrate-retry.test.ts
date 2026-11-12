const mockDbQuery = jest.fn();
const mockGetHashrateWindow = jest.fn();
const mockBlockCountBetweenTimestamp = jest.fn();
const mockOldestConsecutiveBlock = jest.fn();

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('../../repositories/BlocksRepository', () => {
  class MockIncompleteHashrateWindowError extends Error {}

  return {
    __esModule: true,
    IncompleteHashrateWindowError: MockIncompleteHashrateWindowError,
    default: {
      $blockCount: jest.fn().mockResolvedValue(14400),
      $blockCountBetweenTimestamp: mockBlockCountBetweenTimestamp,
      $getHashrateWindow: mockGetHashrateWindow,
      $getOldestConsecutiveBlock: mockOldestConsecutiveBlock,
    },
  };
});

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getBlockHash: jest.fn().mockResolvedValue('genesis'),
    $getBlock: jest.fn().mockResolvedValue({ timestamp: 1600000000, bits: 0x1d00ffff, difficulty: 1 }),
  },
}));

jest.mock('../../logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    err: jest.fn(),
    info: jest.fn(),
    notice: jest.fn(),
    warn: jest.fn(),
    tags: {
      mining: 'mining',
    },
  },
}));

import mining from '../../api/mining/mining';
import HashratesRepository from '../../repositories/HashratesRepository';
import { IncompleteHashrateWindowError } from '../../repositories/BlocksRepository';

const DAY = 86400;
const at = (date: string): number => new Date(date).getTime() / 1000;

// the hashrates table, as the indexers write and read it
let saved: { timestamp: number, poolId: number, type: string, lane: string }[] = [];
const dailyTimestamps = (): number[] => [...new Set(saved.filter(row => row.type === 'daily' && row.poolId === 0).map(row => row.timestamp))]
  .filter(timestamp => new Set(saved.filter(row => row.type === 'daily' && row.timestamp === timestamp).map(row => row.lane)).size === 3)
  .sort((a, b) => a - b);
const weeklyTimestamps = (): number[] => [...new Set(saved.filter(row => row.type === 'weekly').map(row => row.timestamp))];

describe('Hashrate indexers after a chain repair', () => {
  beforeEach(() => {
    saved = [];
    mining.lastHashrateIndexingDate = null;
    mining.lastWeeklyHashrateIndexingDate = null;
    mockDbQuery.mockImplementation(async (sql: string, params: number[] = []) => {
      if (sql.includes('DELETE FROM hashrates WHERE hashrate_timestamp BETWEEN')) {
        saved = saved.filter(stored => stored.timestamp < params[0] || stored.timestamp > params[1]);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('INSERT INTO hashrates')) {
        for (let i = 0; i < params.length; i += 6) {
          saved.push({ timestamp: params[i], poolId: params[i + 2], type: String(params[i + 4]), lane: String(params[i + 5]) });
        }
        return [{ affectedRows: params.length / 6 }];
      }
      if (sql.includes(`type = 'daily'`)) {
        return [dailyTimestamps().map(timestamp => ({ timestamp }))];
      }
      if (sql.includes(`type = 'weekly'`)) {
        return [weeklyTimestamps().map(timestamp => ({ timestamp }))];
      }
      throw new Error(`unexpected query ${sql}`);
    });
  });

  afterEach(() => {
    mining.lastHashrateIndexingDate = null;
    mining.lastWeeklyHashrateIndexingDate = null;
    jest.useRealTimers();
  });

  test('index the periods they skipped on the next run after retryMissingHashrates(), on any day', async () => {
    // a Wednesday: the weekly indexer only runs again by itself on Monday,
    // and the daily one tomorrow
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T12:00:00Z'));
    // a 60-second chain whose height is its timestamp / 60, indexed from a
    // second after midnight on Monday 2026-11-02
    mockOldestConsecutiveBlock.mockResolvedValue({ timestamp: at('2026-11-02T00:00:01Z') });
    mockBlockCountBetweenTimestamp.mockImplementation(async (poolId, from: number, to: number) => ({
      blockCount: (to - from) / 60,
      lastBlockHeight: to / 60,
    }));
    // two canonical rows at this height, until the chain check repairs them
    const repairedHeight = at('2026-11-07T12:00:00Z') / 60;
    let repaired = false;
    mockGetHashrateWindow.mockImplementation(async (blockCount: number, endHeight: number) => {
      if (!repaired && endHeight - blockCount <= repairedHeight && repairedHeight <= endHeight) {
        throw new IncompleteHashrateWindowError(`Hashrate window is not consecutive at heights ${repairedHeight} and ${repairedHeight}`);
      }
      return Array.from({ length: blockCount + 1 }, (_, i) => ({
        height: endHeight - blockCount + i,
        timestamp: (endHeight - blockCount + i) * 60,
        bits: 0x1d00ffff,
        version: 0x20000000,
        poolId: 1,
      }));
    });

    // the first run skips the day and the week that hold that height. (The
    // weekly indexer finds last Monday in local time, so the week's end is
    // read from its call.)
    await mining.$generateNetworkHashrateHistory();
    await mining.$generatePoolHashrateHistory();
    const indexedDays = [...Array(9).keys()].map(n => at('2026-11-03T00:00:00Z') + n * DAY);
    expect(dailyTimestamps()).toEqual(indexedDays.filter(timestamp => timestamp !== at('2026-11-08T00:00:00Z')));
    const skippedWeeks = mockGetHashrateWindow.mock.calls
      .filter(([blockCount]) => blockCount === 7 * DAY / 60)
      .map(([, endHeight]) => endHeight * 60);
    expect(skippedWeeks).toHaveLength(1);
    expect(weeklyTimestamps()).toEqual([]);

    // the same day, the next run doesn't look again
    mockGetHashrateWindow.mockClear();
    await mining.$generateNetworkHashrateHistory();
    await mining.$generatePoolHashrateHistory();
    expect(mockGetHashrateWindow).not.toHaveBeenCalled();

    // after the repair, it computes only the periods it skipped
    repaired = true;
    HashratesRepository.retryMissingHashrates();
    await mining.$generateNetworkHashrateHistory();
    await mining.$generatePoolHashrateHistory();
    expect(mockGetHashrateWindow).toHaveBeenCalledTimes(2);
    expect(dailyTimestamps()).toEqual(indexedDays);
    expect(weeklyTimestamps()).toEqual(skippedWeeks);
  });

  test('index again on the next run the periods whose hashrates $deleteHashratesBetween() deleted', async () => {
    // the periods around a lone canonical row the chain check replaced: they
    // were indexed with it, and the indexers skip periods that have hashrates
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T12:00:00Z'));
    mockOldestConsecutiveBlock.mockResolvedValue({ timestamp: at('2026-11-02T00:00:01Z') });
    mockBlockCountBetweenTimestamp.mockImplementation(async (poolId, from: number, to: number) => ({
      blockCount: (to - from) / 60,
      lastBlockHeight: to / 60,
    }));
    mockGetHashrateWindow.mockImplementation(async (blockCount: number, endHeight: number) => Array.from({ length: blockCount + 1 }, (_, i) => ({
      height: endHeight - blockCount + i,
      timestamp: (endHeight - blockCount + i) * 60,
      bits: 0x1d00ffff,
      version: 0x20000000,
      poolId: 1,
    })));

    await mining.$generateNetworkHashrateHistory();
    const indexedDays = [...Array(9).keys()].map(n => at('2026-11-03T00:00:00Z') + n * DAY);
    expect(dailyTimestamps()).toEqual(indexedDays);

    mockGetHashrateWindow.mockClear();
    await HashratesRepository.$deleteHashratesBetween(at('2026-11-06T00:00:00Z'), at('2026-11-07T00:00:00Z'));
    await mining.$generateNetworkHashrateHistory();

    expect(mockGetHashrateWindow.mock.calls.map(([, endHeight]) => endHeight * 60).sort()).toEqual([at('2026-11-06T00:00:00Z'), at('2026-11-07T00:00:00Z')]);
    expect(dailyTimestamps()).toEqual(indexedDays);
  });
});
