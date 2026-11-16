import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

// Every query of the pool statistics goes through here, so the tests count the SQL a request costs
jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import mining from '../../api/mining/mining';
import miningRoutes from '../../api/mining/mining-routes';
import config from '../../config';
import database from '../../database';
import BlocksRepository from '../../repositories/BlocksRepository';

const dbQuery = database.query as jest.Mock;

const MINUTE = 60_000;
const FAILURE_COOLDOWN = 5_000;
const INTERVALS = ['1h', '24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', '4y', 'all'];

// Blocks a trailing window holds at qbit's 60 second spacing, by the SQL interval that selects it
const WINDOW_BLOCKS: Record<string, number> = {
  '1 HOUR': 60,
  '1 DAY': 1440,
  '3 DAY': 4320,
  '1 WEEK': 10_080,
  '1 MONTH': 43_200,
};

describe('GET mining/pools', () => {
  let server: http.Server;
  let baseUrl: string;
  // The clock the cache and the Expires header read
  let now = Date.UTC(2026, 0, 1);
  // The blocks the mocked database has indexed, which a test changes to move the chain
  let indexedBlocks: number;
  // Rejects the next query that matches, as a database failure would
  let failQuery: ((sql: string) => boolean) | null;
  // Holds every query back until a test lets them go, to keep a computation in flight
  let gate: Promise<void> | null;
  // The blocks the hashrate windows read, newest first. None: the hashrates are zero.
  let hashrateWindow: { height: number, timestamp: number, bits: number, version: number, poolId: number }[];
  let queriesPerComputation: number;

  const isPoolsInfoQuery = (sql: string): boolean => sql.includes('AVG(blocks_audits.match_rate)');
  const isHashrateWindowQuery = (sql: string): boolean => sql.includes('ORDER BY height DESC LIMIT');
  // the count of all indexed blocks, which X-total-count carries
  const isTotalCountQuery = (sql: string): boolean => sql.includes('count(height) as blockCount') && !sql.includes('INTERVAL');

  const blocksInWindow = (sql: string): number => {
    const interval = /INTERVAL (\d+ \w+)\)/.exec(sql)?.[1];
    return Math.min(indexedBlocks, (interval && WINDOW_BLOCKS[interval]) || indexedBlocks);
  };

  const answer = (sql: string): unknown[] => {
    if (sql.includes('AVG(blocks_audits.match_rate)')) {
      const blocks = blocksInWindow(sql);
      const firstPoolBlocks = Math.ceil(blocks * 0.6);
      return [
        { blockCount: firstPoolBlocks, poolId: 1, name: 'Qbit Pool', link: 'https://pool.example', slug: 'qbit-pool', avgMatchRate: 99.456, avgFeeDelta: 0.01, poolUniqueId: 1 },
        { blockCount: blocks - firstPoolBlocks, poolId: 2, name: 'Unknown', link: 'https://learnmeabitcoin.com/technical/coinbase-transaction', slug: 'unknown', avgMatchRate: null, avgFeeDelta: null, poolUniqueId: 0 },
      ];
    }
    if (sql.includes('tx_count = 1')) {
      return [{ count: 3, poolId: 2 }];
    }
    if (sql.includes('count(height) as blockCount')) {
      return [{ blockCount: blocksInWindow(sql) }];
    }
    if (isHashrateWindowQuery(sql)) {
      return [...hashrateWindow];
    }
    if (sql.includes('FROM pools')) {
      return [
        { name: 'Qbit Pool', slug: 'qbit-pool', unique_id: 1 },
        { name: 'Unknown', slug: 'unknown', unique_id: 0 },
      ];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const queries = (matches: (sql: string) => boolean = (): boolean => true): string[] =>
    dbQuery.mock.calls.map(([sql]) => sql as string).filter(matches);

  const getPools = (interval: string): Promise<Response> => fetch(baseUrl + 'mining/pools/' + interval);

  // What the route answered before it cached: the statistics as the body, the indexed blocks as X-total-count
  const computeUncached = async (interval: string): Promise<{ body: unknown, totalCount: string }> => {
    const stats = await mining.$getPoolsStats(interval);
    const totalCount = await BlocksRepository.$blockCount(null, null);
    return { body: JSON.parse(JSON.stringify(stats)), totalCount: totalCount.toString() };
  };

  // Starts requests together and holds their queries at the gate until the route has taken every request
  const startTogether = async (count: number, interval: string): Promise<Response[]> => {
    let open!: () => void;
    gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const taken = jest.spyOn(mining, '$getPoolsStatsResponse');
    const responses = Array.from({ length: count }, () => getPools(interval));
    while (taken.mock.calls.length < count) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    gate = null;
    open();
    return Promise.all(responses);
  };

  beforeAll(async () => {
    const app = express();
    miningRoutes.initRoutes(app);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(async () => {
    // The mining module is a singleton, so each test starts an hour on: whatever the tests before
    // it cached, and the cooldowns of their failures, have expired.
    now += 60 * MINUTE;
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    indexedBlocks = 50_000;
    hashrateWindow = [];
    failQuery = null;
    gate = null;
    dbQuery.mockReset();
    dbQuery.mockImplementation(async (sql: string) => {
      if (gate) {
        await gate;
      }
      if (failQuery?.(sql)) {
        failQuery = null;
        throw new Error('database is down');
      }
      return [answer(sql), []];
    });

    await computeUncached('1w');
    queriesPerComputation = dbQuery.mock.calls.length;
    dbQuery.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('computes the statistics once for 100 simultaneous requests, total count included', async () => {
    const responses = await startTogether(100, '1w');

    expect(queries()).toHaveLength(queriesPerComputation);
    expect(queries(isPoolsInfoQuery)).toHaveLength(1);
    expect(queries(isTotalCountQuery)).toHaveLength(1);

    const expected = await computeUncached('1w');
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(response.headers.get('x-total-count')).toBe(expected.totalCount);
      expect(await response.json()).toEqual(expected.body);
    }
  });

  test('answers from memory, with no SQL, until the minute is up', async () => {
    const first = await getPools('1w');
    const body = await first.json();
    expect(queries()).toHaveLength(queriesPerComputation);
    dbQuery.mockClear();

    const computedAt = now;
    for (const elapsed of [1, 30_000, MINUTE - 1]) {
      now = computedAt + elapsed;
      const hit = await getPools('1w');
      expect(hit.status).toBe(200);
      expect(await hit.json()).toEqual(body);
      expect(hit.headers.get('x-total-count')).toBe(first.headers.get('x-total-count'));
    }
    expect(queries()).toHaveLength(0);
  });

  test('computes again once the minute is up', async () => {
    await getPools('1w');
    dbQuery.mockClear();

    now += MINUTE - 1;
    await getPools('1w');
    expect(queries()).toHaveLength(0);

    now += 1;
    expect((await getPools('1w')).status).toBe(200);
    expect(queries()).toHaveLength(queriesPerComputation);
    expect(queries(isTotalCountQuery)).toHaveLength(1);
  });

  test('keeps the body and the headers of the uncached answer, on a miss and on a hit', async () => {
    const expected = await computeUncached('1w');

    for (const elapsed of [0, 20_000]) {
      now += elapsed;
      const response = await getPools('1w');

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^application\/json/);
      expect(response.headers.get('pragma')).toBe('public');
      expect(response.headers.get('cache-control')).toBe('public');
      expect(response.headers.get('x-total-count')).toBe('50000');
      expect(response.headers.get('expires')).toBe(new Date(now + MINUTE).toUTCString());
      const body = await response.json();
      expect(body).toEqual(expected.body);
      expect(body).toMatchObject({
        blockCount: 10_080,
        lastEstimatedHashrate: 0,
        pools: [
          { poolId: 1, name: 'Qbit Pool', slug: 'qbit-pool', rank: 1, blockCount: 6048, emptyBlocks: 0, avgMatchRate: 99.46 },
          { poolId: 2, name: 'Unknown', slug: 'unknown', rank: 2, blockCount: 4032, emptyBlocks: 3, avgMatchRate: null },
        ],
      });
    }
  });

  test.each(INTERVALS)('answers for the %s interval', async (interval) => {
    const expected = await computeUncached(interval);
    dbQuery.mockClear();

    const response = await getPools(interval);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expected.body);
    expect(response.headers.get('x-total-count')).toBe('50000');
  });

  test('keeps each interval apart', async () => {
    const day = await (await getPools('24h')).json();
    expect(queries(isPoolsInfoQuery)).toEqual([expect.stringContaining('INTERVAL 1 DAY')]);

    // a cached day does not answer for a month or for the whole history
    const month = await (await getPools('1m')).json();
    const all = await (await getPools('all')).json();
    expect(queries(isPoolsInfoQuery)).toEqual([
      expect.stringContaining('INTERVAL 1 DAY'),
      expect.stringContaining('INTERVAL 1 MONTH'),
      expect.not.stringContaining('INTERVAL'),
    ]);
    expect([day.blockCount, month.blockCount, all.blockCount]).toEqual([1440, 43_200, 50_000]);

    dbQuery.mockClear();
    expect((await (await getPools('24h')).json())).toEqual(day);
    expect((await (await getPools('1m')).json())).toEqual(month);
    expect((await (await getPools('all')).json())).toEqual(all);
    expect(queries()).toHaveLength(0);
  });

  test('keeps the answers of another network apart', async () => {
    const network = config.MEMPOOL.NETWORK;
    try {
      await getPools('1w');
      dbQuery.mockClear();

      config.MEMPOOL.NETWORK = network === 'testnet4' ? 'mainnet' : 'testnet4';
      expect((await getPools('1w')).status).toBe(200);
      expect(queries()).toHaveLength(queriesPerComputation);
    } finally {
      config.MEMPOOL.NETWORK = network;
    }
  });

  test.each([
    ['foo'],
    ['1W'],
    ['ALL'],
    ['All'],
    ['1'],
    ['0'],
    ['1d'],
    ['5y'],
    ['24'],
    ['-1w'],
    ['1w '],
    [' '],
    ['null'],
    ['undefined'],
    ['constructor'],
    ['__proto__'],
    ['toString'],
    ['1w;DROP TABLE blocks'],
    ['1 WEEK'],
    ['4096 characters long', 'a'.repeat(4096)],
  ])('answers 400 for an unsupported interval, before any SQL: %j', async (label, interval = label) => {
    const response = await getPools(encodeURIComponent(interval));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid interval' });
    expect(response.headers.get('x-total-count')).toBeNull();
    expect(queries()).toHaveLength(0);
  });

  test('keeps one answer per supported interval, whatever else is asked for', async () => {
    const cache = (mining as unknown as { poolsStatsCache: { values: Map<string, unknown>, failures: Map<string, unknown> } }).poolsStatsCache;
    cache.values.clear();
    cache.failures.clear();

    for (const interval of INTERVALS) {
      expect((await getPools(interval)).status).toBe(200);
    }
    for (let i = 0; i < 50; i++) {
      expect((await getPools(`${i}w`)).status).toBe(i === 1 ? 200 : 400);
      // a query string does not make another answer
      expect((await getPools(`1w?cachebust=${i}`)).status).toBe(200);
    }

    expect(cache.values.size).toBe(INTERVALS.length);
    expect(cache.failures.size).toBe(0);
    expect(queries(isPoolsInfoQuery)).toHaveLength(INTERVALS.length);
  });

  test('still lists the pools when no interval is given', async () => {
    for (const path of ['mining/pools', 'mining/pools/']) {
      dbQuery.mockClear();
      const response = await fetch(baseUrl + path);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-total-count')).toBe('2');
      expect(response.headers.get('pragma')).toBe('public');
      expect(response.headers.get('cache-control')).toBe('public');
      expect(response.headers.get('expires')).toBe(new Date(now + MINUTE).toUTCString());
      expect(await response.json()).toEqual([
        { name: 'Qbit Pool', slug: 'qbit-pool', unique_id: 1 },
        { name: 'Unknown', slug: 'unknown', unique_id: 0 },
      ]);
      expect(queries()).toEqual([expect.stringContaining('FROM pools')]);
    }
  });

  test('answers 500 to every request of a failed computation, which ran once', async () => {
    failQuery = isPoolsInfoQuery;

    const responses = await startTogether(100, '1w');

    for (const response of responses) {
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to get pools' });
      expect(response.headers.get('x-total-count')).toBeNull();
    }
    expect(queries(isPoolsInfoQuery)).toHaveLength(1);
  });

  test('does not ask a failing database again during the cooldown, and recovers after it', async () => {
    failQuery = isPoolsInfoQuery;
    expect((await getPools('1w')).status).toBe(500);
    dbQuery.mockClear();

    // the database works again, but the interval keeps its failure for the cooldown
    now += FAILURE_COOLDOWN - 1;
    const coolingDown = await getPools('1w');
    expect(coolingDown.status).toBe(500);
    expect(await coolingDown.json()).toEqual({ error: 'Failed to get pools' });
    expect(queries()).toHaveLength(0);

    // another interval is not held up by it
    expect((await getPools('1m')).status).toBe(200);
    dbQuery.mockClear();

    now += 1;
    const recovered = await getPools('1w');
    expect(recovered.status).toBe(200);
    expect(queries()).toHaveLength(queriesPerComputation);
    expect(await recovered.json()).toEqual((await computeUncached('1w')).body);

    // and the recovered answer is cached like any other
    dbQuery.mockClear();
    now += MINUTE - 1;
    expect((await getPools('1w')).status).toBe(200);
    expect(queries()).toHaveLength(0);
  });

  test('caches nothing when only the total count fails', async () => {
    failQuery = isTotalCountQuery;

    expect((await getPools('1w')).status).toBe(500);
    expect(queries(isPoolsInfoQuery)).toHaveLength(1);
    dbQuery.mockClear();

    now += FAILURE_COOLDOWN;
    const response = await getPools('1w');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-total-count')).toBe('50000');
    expect(queries()).toHaveLength(queriesPerComputation);
  });

  // The statistics used to answer with zeroed hashrates when the queries behind them failed. Cached,
  // every request of the next minute would get those zeroes.
  test('caches nothing when only a hashrate window fails', async () => {
    failQuery = isHashrateWindowQuery;

    expect((await getPools('1w')).status).toBe(500);
    dbQuery.mockClear();

    now += FAILURE_COOLDOWN;
    const response = await getPools('1w');
    expect(response.status).toBe(200);
    expect(queries()).toHaveLength(queriesPerComputation);
  });

  test('answers with zeroed hashrates, and caches them, while the indexed blocks have a gap', async () => {
    // Each window covers two blocks and their anchor. The database has three, but not block 49,998:
    // the indexer hasn't reached it.
    indexedBlocks = 2;
    hashrateWindow = [
      { height: 50_000, timestamp: 1_700_000_180, bits: 0x207fffff, version: 0x20000000, poolId: 1 },
      { height: 49_999, timestamp: 1_700_000_120, bits: 0x207fffff, version: 0x20000000, poolId: 1 },
      { height: 49_997, timestamp: 1_700_000_000, bits: 0x207fffff, version: 0x20000000, poolId: 2 },
    ];

    const response = await getPools('1w');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ blockCount: 2, lastEstimatedHashrate: 0, lastEstimatedHashrate3d: 0, lastEstimatedHashrate1w: 0 });
    expect(body.pools).toHaveLength(2);

    dbQuery.mockClear();
    expect(await (await getPools('1w')).json()).toEqual(body);
    expect(queries()).toHaveLength(0);
  });

  test('answers 500, not the expired statistics, when a refresh fails', async () => {
    expect((await getPools('1w')).status).toBe(200);

    now += MINUTE;
    indexedBlocks += 1;
    failQuery = isPoolsInfoQuery;
    expect((await getPools('1w')).status).toBe(500);

    now += FAILURE_COOLDOWN;
    const response = await getPools('1w');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-total-count')).toBe('50001');
  });

  test('lags the chain by a minute at most, with the body and the total count from the same moment', async () => {
    const tip = async (): Promise<{ blockCount: number, totalCount: number }> => {
      const response = await getPools('all');
      return { blockCount: (await response.json()).blockCount, totalCount: Number(response.headers.get('x-total-count')) };
    };

    expect(await tip()).toEqual({ blockCount: 50_000, totalCount: 50_000 });

    // a block arrives right after the statistics were computed
    indexedBlocks = 50_001;
    now += MINUTE - 1;
    expect(await tip()).toEqual({ blockCount: 50_000, totalCount: 50_000 });
    now += 1;
    expect(await tip()).toEqual({ blockCount: 50_001, totalCount: 50_001 });

    // a reorg takes two blocks off the chain
    indexedBlocks = 49_999;
    now += MINUTE - 1;
    expect(await tip()).toEqual({ blockCount: 50_001, totalCount: 50_001 });
    now += 1;
    expect(await tip()).toEqual({ blockCount: 49_999, totalCount: 49_999 });
  });
});
