import config from '../config';
import DB from '../database';
import BlocksRepository, { IncompleteHashrateWindowError } from '../repositories/BlocksRepository';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestPool, insertTestBlock } from './test-helpers';

describe('BlocksRepository Integration Tests', () => {
  let defaultPoolId: number;

  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanupTestData();
    // Create a default pool for all blocks
    defaultPoolId = await insertTestPool({
      name: 'Unknown',
      slug: 'unknown',
      addresses: '[]',
      regexes: '[]'
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('should insert and retrieve a block', async () => {
    const blockHash = '00000000000000000001a0e3e9b2e6d6e8a4b0e9b2e6d6e8a4b0e9b2e6d6e8a4';
    const height = 800000;

    await insertTestBlock({
      height: height,
      hash: blockHash,
      blockTimestamp: new Date('2023-07-16T00:00:00Z'),
      size: 1500000,
      weight: 3999000,
      tx_count: 3000,
      difficulty: 53911173001054.59,
      poolId: defaultPoolId
    });

    const block = await BlocksRepository.$getBlockByHeight(height);

    expect(block).toBeDefined();
    expect(block!.height).toBe(height);
    expect(block!.id).toBe(blockHash);
  });

  test('should get block by hash', async () => {
    const blockHash = '00000000000000000002b0e3e9b2e6d6e8a4b0e9b2e6d6e8a4b0e9b2e6d6e8a4';
    const height = 800001;

    await insertTestBlock({
      height: height,
      hash: blockHash,
      tx_count: 2500,
      poolId: defaultPoolId
    });

    const block = await BlocksRepository.$getBlockByHash(blockHash);

    expect(block).toBeDefined();
    expect(block!.id).toBe(blockHash);
    expect(block!.height).toBe(height);
  });

  test('should handle non-existent block', async () => {
    const block = await BlocksRepository.$getBlockByHeight(999999);
    expect(block).toBeNull();
  });

  test('should check for missing blocks in range', async () => {
    // Insert blocks with a gap
    await insertTestBlock({
      height: 800100,
      hash: '0000000000000000000100000000000000000000000000000000000000000001',
      poolId: defaultPoolId
    });
    await insertTestBlock({
      height: 800102,
      hash: '0000000000000000000100000000000000000000000000000000000000000003',
      poolId: defaultPoolId
    });

    const missingBlocks = await BlocksRepository.$getMissingBlocksBetweenHeights(800100, 800102);

    expect(missingBlocks).toContain(800101);
  });

  test('should get latest block height', async () => {
    await insertTestBlock({
      height: 800200,
      hash: '0000000000000000000200000000000000000000000000000000000000000001',
      poolId: defaultPoolId
    });
    await insertTestBlock({
      height: 800201,
      hash: '0000000000000000000200000000000000000000000000000000000000000002',
      poolId: defaultPoolId
    });

    const height = await BlocksRepository.$mostRecentBlockHeight();

    expect(height).toBe(800201);
  });

  test('should handle block with pool association', async () => {
    // Insert a pool and get its auto-generated ID
    const testPoolId = await insertTestPool({
      name: 'Test Pool',
      slug: 'test-pool',
      addresses: '[]',
      regexes: '[]'
    });

    const blockHash = '0000000000000000000300000000000000000000000000000000000000000001';
    await insertTestBlock({
      height: 800300,
      hash: blockHash,
      poolId: testPoolId
    });

    const block = await BlocksRepository.$getBlockByHash(blockHash);

    expect(block).toBeDefined();
    expect(block).not.toBeNull();
    // The pool should be populated with the test pool's data
    if (block && block.extras?.pool) {
      expect(block.extras.pool.name).toBe('Test Pool');
      expect(block.extras.pool.slug).toBe('test-pool');
    }
  });

  test('should return a complete anchored hashrate window', async () => {
    for (let height = 900000; height <= 900002; ++height) {
      await insertTestBlock({
        height,
        hash: height.toString(16).padStart(64, '0'),
        blockTimestamp: new Date((1_700_000_000 + (height - 900000) * 60) * 1000),
        poolId: defaultPoolId,
      });
    }

    const window = await BlocksRepository.$getHashrateWindow(2, 900002);

    expect(window.map(block => block.height)).toEqual([900000, 900001, 900002]);
  });

  test('should reject hashrate windows with a missing anchor or height gap', async () => {
    await insertTestBlock({
      height: 900001,
      hash: '900001'.padStart(64, '0'),
      poolId: defaultPoolId,
    });
    await insertTestBlock({
      height: 900002,
      hash: '900002'.padStart(64, '0'),
      poolId: defaultPoolId,
    });

    await expect(BlocksRepository.$getHashrateWindow(2, 900002)).rejects.toBeInstanceOf(IncompleteHashrateWindowError);
    await expect(BlocksRepository.$getHashrateWindow(2, 900002)).rejects.toThrow('expected 3 including its anchor');

    await insertTestBlock({
      height: 899999,
      hash: '899999'.padStart(64, '0'),
      poolId: defaultPoolId,
    });
    await expect(BlocksRepository.$getHashrateWindow(2, 900002)).rejects.toThrow('not consecutive');
  });

  // qbit has no QBT price feed, so no block is ever linked to a price
  test('should average block fees and rewards of blocks without a price', async () => {
    const fiatPrice = config.FIAT_PRICE.ENABLED;
    // As on qbit mainnet, which keeps upstream's default
    config.FIAT_PRICE.ENABLED = true;
    try {
      for (let height = 900100; height <= 900102; ++height) {
        await insertTestBlock({
          height,
          hash: height.toString(16).padStart(64, '0'),
          blockTimestamp: new Date((1_700_000_000 + (height - 900100) * 60) * 1000),
          poolId: defaultPoolId,
        });
      }
      // 210 QBT subsidy plus insertTestBlock's 0.5 QBT of fees
      await DB.query('UPDATE blocks SET reward = 21050000000 WHERE height BETWEEN 900100 AND 900102');

      const byHeight = (a: { avgHeight: number }, b: { avgHeight: number }): number => a.avgHeight - b.avgHeight;
      const fees = (await BlocksRepository.$getHistoricalBlockFees(1, null)).sort(byHeight);
      const rewards = (await BlocksRepository.$getHistoricalBlockRewards(1, null)).sort(byHeight);

      expect(fees).toEqual([900100, 900101, 900102].map(avgHeight => ({ avgHeight, timestamp: expect.any(Number), avgFees: 50000000 })));
      expect(rewards).toEqual([900100, 900101, 900102].map(avgHeight => ({ avgHeight, timestamp: expect.any(Number), avgRewards: 21050000000 })));
    } finally {
      config.FIAT_PRICE.ENABLED = fiatPrice;
    }
  });
});
