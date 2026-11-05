const mockDbQuery = jest.fn();
const mockLoggerErr = jest.fn();

jest.mock('../../api/common', () => ({
  __esModule: true,
  Common: {},
}));

jest.mock('../../api/pools-parser', () => ({
  __esModule: true,
  default: {
    $insertUnknownPool: jest.fn(),
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
    },
  },
}));

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('../../logger', () => ({
  __esModule: true,
  default: {
    err: mockLoggerErr,
    notice: jest.fn(),
    tags: {
      mining: 'mining',
    },
  },
}));

import PoolsRepository from '../../repositories/PoolsRepository';

describe('PoolsRepository qbit empty pool migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbQuery.mockResolvedValue([[], []]);
  });

  test('rewrites all block definitions and clears stale hashrates before deleting pools', async () => {
    await PoolsRepository.$replacePoolsWithUnknown(0, 'qbit-empty-v1');

    expect(mockDbQuery).toHaveBeenNthCalledWith(1, expect.stringContaining('UPDATE blocks'), [0, 'qbit-empty-v1']);
    expect(mockDbQuery).toHaveBeenNthCalledWith(2, 'DELETE FROM hashrates');
    expect(mockDbQuery).toHaveBeenNthCalledWith(3, expect.stringContaining('DELETE FROM pools'), [0]);
  });

  test('rethrows database errors so the updater can roll back', async () => {
    const error = new Error('db failed');
    mockDbQuery.mockRejectedValueOnce(error);

    await expect(PoolsRepository.$replacePoolsWithUnknown(0, 'qbit-empty-v1')).rejects.toThrow('db failed');

    expect(mockLoggerErr).toHaveBeenCalledWith(expect.stringContaining('Cannot replace mining pools with Unknown'));
  });
});

describe('PoolsRepository qbit pool lookups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('keeps raw stored addresses on non-mainnet networks with parse=false', async () => {
    // config mock runs NETWORK 'testnet4'; pools-qbit.json carries the
    // deployment network's own addresses so they must not be cleared
    mockDbQuery.mockResolvedValue([[
      {
        id: 5, unique_id: 1, name: 'Prism Pool', slug: 'prismpool',
        addresses: '["tq1stale"]', regexes: '["/PRISM Pool/"]', address_match_mode: 'full_reward',
      },
    ]]);

    const pool: any = await PoolsRepository.$getPoolByUniqueId(1, false);

    expect(pool.addresses).toBe('["tq1stale"]');
    expect(pool.regexes).toBe('["/PRISM Pool/"]');
    expect(pool.address_match_mode).toBe('full_reward');
  });

  test('parses stored addresses and regexes with parse=true', async () => {
    mockDbQuery.mockResolvedValue([[
      {
        id: 5, unique_id: 1, name: 'Prism Pool', slug: 'prismpool',
        addresses: '["tq1stale"]', regexes: '["/PRISM Pool/"]', address_match_mode: 'full_reward',
      },
    ]]);

    const pool: any = await PoolsRepository.$getPool('prismpool');

    expect(pool.addresses).toEqual(['tq1stale']);
    expect(pool.regexes).toEqual(['/PRISM Pool/']);
    expect(pool.addressMatchMode).toBe('full_reward');
    expect(pool.address_match_mode).toBeUndefined();
  });
});

describe('PoolsRepository qbit stale pool purge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reassigns blocks with the definition hash before deleting stale pools', async () => {
    mockDbQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, name')) {
        return [[{ id: 7, name: 'Stale Pool' }]];
      }
      return [[], []];
    });

    const removed = await PoolsRepository.$deleteStalePools([0, 1], 0, 'qbit-newsha');

    expect(removed).toBe(1);
    expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE blocks'), [0, 'qbit-newsha', 7]);
    expect(mockDbQuery).toHaveBeenCalledWith('DELETE FROM hashrates');
    expect(mockDbQuery).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM pools'), [7]);
  });

  test('is a no-op when every pool is in the keep list', async () => {
    mockDbQuery.mockResolvedValue([[], []]);

    const removed = await PoolsRepository.$deleteStalePools([0, 1], 0, 'qbit-newsha');

    expect(removed).toBe(0);
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
  });
});
