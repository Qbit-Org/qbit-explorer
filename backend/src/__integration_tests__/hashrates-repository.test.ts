import DB from '../database';
import HashratesRepository from '../repositories/HashratesRepository';
import {
  cleanupTestData,
  setupTestDatabase,
  waitForDatabase,
} from './test-helpers';

describe('HashratesRepository lane integration', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('stores and queries aggregate plus both lane rows at one timestamp', async () => {
    const timestamp = 1_700_000_000;

    await HashratesRepository.$saveHashrates([
      {
        hashrateTimestamp: timestamp,
        avgHashrate: 600,
        poolId: 0,
        share: 1,
        type: 'daily',
        lane: 'aggregate',
      },
      {
        hashrateTimestamp: timestamp,
        avgHashrate: 480,
        poolId: 0,
        share: 0.8,
        type: 'daily',
        lane: 'permissionless',
      },
      {
        hashrateTimestamp: timestamp,
        avgHashrate: 120,
        poolId: 0,
        share: 0.2,
        type: 'daily',
        lane: 'auxpow',
      },
    ]);

    const [stored] = await DB.query<any>(
      `SELECT lane, avg_hashrate AS avgHashrate
       FROM hashrates
       WHERE hashrate_timestamp = FROM_UNIXTIME(?) AND pool_id = 0
       ORDER BY FIELD(lane, 'aggregate', 'permissionless', 'auxpow')`,
      [timestamp],
    );
    expect(stored).toEqual([
      { lane: 'aggregate', avgHashrate: 600 },
      { lane: 'permissionless', avgHashrate: 480 },
      { lane: 'auxpow', avgHashrate: 120 },
    ]);

    await expect(HashratesRepository.$getRawNetworkDailyHashrate(null, 'aggregate')).resolves.toEqual([
      { timestamp, avgHashrate: 600, lane: 'aggregate' },
    ]);
    await expect(HashratesRepository.$getRawNetworkDailyHashrate(null, 'permissionless')).resolves.toEqual([
      { timestamp, avgHashrate: 480, lane: 'permissionless' },
    ]);
    await expect(HashratesRepository.$getRawNetworkDailyHashrate(null, 'auxpow')).resolves.toEqual([
      { timestamp, avgHashrate: 120, lane: 'auxpow' },
    ]);
    await expect(HashratesRepository.$getCompleteNetworkDailyHashrateTimestamps()).resolves.toEqual([timestamp]);
  });

  test('defaults legacy writes to aggregate and upserts one lane without replacing its siblings', async () => {
    const timestamp = 1_700_086_400;

    await HashratesRepository.$saveHashrates([{
      hashrateTimestamp: timestamp,
      avgHashrate: 600,
      poolId: 0,
      share: 1,
      type: 'daily',
    }]);
    await expect(HashratesRepository.$getRawNetworkDailyHashrate(null, 'aggregate')).resolves.toEqual([
      { timestamp, avgHashrate: 600, lane: 'aggregate' },
    ]);
    expect(await HashratesRepository.$getCompleteNetworkDailyHashrateTimestamps()).toEqual([]);

    await HashratesRepository.$saveHashrates([
      {
        hashrateTimestamp: timestamp,
        avgHashrate: 650,
        poolId: 0,
        share: 1,
        type: 'daily',
        lane: 'aggregate',
      },
      {
        hashrateTimestamp: timestamp,
        avgHashrate: 500,
        poolId: 0,
        share: 1,
        type: 'daily',
        lane: 'permissionless',
      },
      {
        hashrateTimestamp: timestamp,
        avgHashrate: 150,
        poolId: 0,
        share: 1,
        type: 'daily',
        lane: 'auxpow',
      },
    ]);

    const [stored] = await DB.query<any>(
      `SELECT lane, avg_hashrate AS avgHashrate
       FROM hashrates
       WHERE hashrate_timestamp = FROM_UNIXTIME(?) AND pool_id = 0
       ORDER BY FIELD(lane, 'aggregate', 'permissionless', 'auxpow')`,
      [timestamp],
    );
    expect(stored).toEqual([
      { lane: 'aggregate', avgHashrate: 650 },
      { lane: 'permissionless', avgHashrate: 500 },
      { lane: 'auxpow', avgHashrate: 150 },
    ]);
    expect(await HashratesRepository.$getCompleteNetworkDailyHashrateTimestamps()).toEqual([timestamp]);
  });

  test('returns aligned history while aggregate-only rows await lane backfill', async () => {
    const completeTimestamp = 1_700_000_000;
    const legacyTimestamp = completeTimestamp + 86400;

    await HashratesRepository.$saveHashrates([
      {
        hashrateTimestamp: completeTimestamp,
        avgHashrate: 700,
        poolId: 0,
        share: 1,
        type: 'daily',
        lane: 'aggregate',
      },
      {
        hashrateTimestamp: completeTimestamp,
        avgHashrate: 560,
        poolId: 0,
        share: 0.8,
        type: 'daily',
        lane: 'permissionless',
      },
      {
        hashrateTimestamp: completeTimestamp,
        avgHashrate: 140,
        poolId: 0,
        share: 0.2,
        type: 'daily',
        lane: 'auxpow',
      },
      {
        hashrateTimestamp: legacyTimestamp,
        avgHashrate: 800,
        poolId: 0,
        share: 1,
        type: 'daily',
      },
    ]);

    await expect(HashratesRepository.$getCompleteNetworkDailyHashrates(null)).resolves.toEqual({
      aggregate: [{ timestamp: completeTimestamp, avgHashrate: 700 }],
      permissionless: [{ timestamp: completeTimestamp, avgHashrate: 560 }],
      auxpow: [{ timestamp: completeTimestamp, avgHashrate: 140 }],
    });

    // The legacy aggregate row remains stored, served by the legacy series,
    // and available for backfill; only the aligned trio withholds it.
    await expect(HashratesRepository.$getRawNetworkDailyHashrate(null, 'aggregate')).resolves.toEqual([
      { timestamp: completeTimestamp, avgHashrate: 700, lane: 'aggregate' },
      { timestamp: legacyTimestamp, avgHashrate: 800, lane: 'aggregate' },
    ]);
  });
});
