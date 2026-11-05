import DB from '../database';
import { insertTestBlock, setupTestDatabase, waitForDatabase } from './test-helpers';

describe('Database Migration Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  test('should create state table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'state'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should have schema version in state table', async () => {
    const [result] = await DB.query<any>('SELECT number FROM state WHERE name = \'schema_version\'');
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(112);
  });

  test('should create blocks table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'blocks'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should create pools table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'pools'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should create hashrates table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'hashrates'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should create prices table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'mempool_test' 
       AND table_name = 'prices'`
    );
    expect(result[0].count).toBe(1);
  });

  test('blocks table should have required columns', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = 'mempool_test' 
       AND TABLE_NAME = 'blocks'`
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    expect(columnNames).toContain('height');
    expect(columnNames).toContain('hash');
    expect(columnNames).toContain('blockTimestamp');
    expect(columnNames).toContain('size');
    expect(columnNames).toContain('weight');
    expect(columnNames).toContain('tx_count');
    expect(columnNames).toContain('lane');
    expect(columnNames).toContain('coinbase_payouts');
  });

  test('lane columns should use the migration 108 enum defaults', async () => {
    const [columns] = await DB.query<any>(
      `SELECT TABLE_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'mempool_test'
       AND COLUMN_NAME = 'lane'
       AND TABLE_NAME IN ('blocks', 'hashrates')
       ORDER BY TABLE_NAME`
    );

    const byTable = new Map(columns.map((column: any) => [column.TABLE_NAME, column]));
    const blocksLane: any = byTable.get('blocks');
    const hashratesLane: any = byTable.get('hashrates');

    expect(blocksLane).toBeDefined();
    expect(blocksLane.COLUMN_TYPE).toBe('enum(\'permissionless\',\'auxpow\')');
    expect(blocksLane.IS_NULLABLE).toBe('NO');
    expect(String(blocksLane.COLUMN_DEFAULT).replace(/^'|'$/g, '')).toBe('permissionless');

    expect(hashratesLane).toBeDefined();
    expect(hashratesLane.COLUMN_TYPE).toBe('enum(\'aggregate\',\'permissionless\',\'auxpow\')');
    expect(hashratesLane.IS_NULLABLE).toBe('NO');
    expect(String(hashratesLane.COLUMN_DEFAULT).replace(/^'|'$/g, '')).toBe('aggregate');
  });

  test('lane columns should have the migration 108 indexes', async () => {
    const [indexes] = await DB.query<any>(
      `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = 'mempool_test'
       AND TABLE_NAME IN ('blocks', 'hashrates')
       ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
    );

    const blocksLaneIndex = indexes.some((index: any) =>
      index.TABLE_NAME === 'blocks' && index.COLUMN_NAME === 'lane'
    );
    expect(blocksLaneIndex).toBe(true);

    const hashratesUniqueIndexes = new Map<string, string[]>();
    for (const index of indexes) {
      if (index.TABLE_NAME === 'hashrates' && Number(index.NON_UNIQUE) === 0 && index.INDEX_NAME !== 'PRIMARY') {
        const columns = hashratesUniqueIndexes.get(index.INDEX_NAME) ?? [];
        columns.push(index.COLUMN_NAME);
        hashratesUniqueIndexes.set(index.INDEX_NAME, columns);
      }
    }

    expect(Array.from(hashratesUniqueIndexes.values())).toContainEqual([
      'hashrate_timestamp',
      'pool_id',
      'lane',
    ]);
    expect(Array.from(hashratesUniqueIndexes.values())).not.toContainEqual([
      'hashrate_timestamp',
      'pool_id',
    ]);
  });

  test('AuxPoW migration should widen headers and add parent pool identifiers', async () => {
    const [columns] = await DB.query<any>(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'mempool_test'
       AND ((TABLE_NAME = 'blocks' AND COLUMN_NAME = 'header')
         OR (TABLE_NAME = 'pools' AND COLUMN_NAME IN ('parent_addresses', 'parent_regexes')))
       ORDER BY TABLE_NAME, COLUMN_NAME`
    );

    expect(columns).toEqual([
      expect.objectContaining({
        TABLE_NAME: 'blocks',
        COLUMN_NAME: 'header',
        DATA_TYPE: 'mediumtext',
        IS_NULLABLE: 'NO',
      }),
      expect.objectContaining({
        TABLE_NAME: 'pools',
        COLUMN_NAME: 'parent_addresses',
        DATA_TYPE: 'text',
        IS_NULLABLE: 'YES',
      }),
      expect.objectContaining({
        TABLE_NAME: 'pools',
        COLUMN_NAME: 'parent_regexes',
        DATA_TYPE: 'text',
        IS_NULLABLE: 'YES',
      }),
    ]);
  });

  test('pool address match mode should default to any', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'mempool_test'
       AND TABLE_NAME = 'pools'
       AND COLUMN_NAME = 'address_match_mode'`
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].COLUMN_TYPE).toBe('enum(\'any\',\'full_reward\')');
    expect(columns[0].IS_NULLABLE).toBe('NO');
    expect(String(columns[0].COLUMN_DEFAULT).replace(/^'|'$/g, '')).toBe('any');
  });

  test('exact coinbase payout evidence should preserve the legacy NULL state', async () => {
    const [columns] = await DB.query<any>(
      `SELECT IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'mempool_test'
       AND TABLE_NAME = 'blocks'
       AND COLUMN_NAME = 'coinbase_payouts'`
    );

    expect(columns).toHaveLength(1);
    expect(columns[0].IS_NULLABLE).toBe('YES');
    expect([null, 'NULL']).toContain(columns[0].COLUMN_DEFAULT);
  });

  test('hashrate timestamps should remain fixed during migration 108 backfill upserts', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_DEFAULT, EXTRA
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'mempool_test'
       AND TABLE_NAME = 'hashrates'
       AND COLUMN_NAME = 'hashrate_timestamp'`
    );

    expect(columns).toHaveLength(1);
    const defaultValue = String(columns[0].COLUMN_DEFAULT).replace(/^'|'$/g, '');
    expect(['0', '0000-00-00 00:00:00']).toContain(defaultValue);
    expect(String(columns[0].EXTRA).toLowerCase()).not.toContain('on update');
  });

  test('migration 108 should resume safely and backfill populated block lanes', async () => {
    await DB.query('DELETE FROM blocks');
    await insertTestBlock({
      height: 100,
      hash: '0000000000000000000000000000000000000000000000000000000000000100',
      version: 0x2F58C000,
    });
    await insertTestBlock({
      height: 101,
      hash: '0000000000000000000000000000000000000000000000000000000000000101',
      version: 0x2F58C100,
    });

    // Emulate a process stopping after migration 108's idempotent DDL but
    // before its populated lane backfill and schema version were finalized.
    await DB.query(`UPDATE blocks SET lane = 'permissionless'`);
    await DB.query(`UPDATE state SET number = 107 WHERE name = 'schema_version'`);

    await setupTestDatabase();

    const [schemaRows] = await DB.query<any>(`SELECT number FROM state WHERE name = 'schema_version'`);
    expect(schemaRows[0].number).toBe(112);
    const [blocks] = await DB.query<any>('SELECT height, lane FROM blocks ORDER BY height');
    expect(blocks).toEqual([
      { height: 100, lane: 'permissionless' },
      { height: 101, lane: 'auxpow' },
    ]);

    await DB.query('DELETE FROM blocks');
  });

  test('migration 111 should preserve populated schema-110 blocks and rerun safely', async () => {
    await DB.query('DELETE FROM blocks');
    const hash = '110'.padStart(64, '0');
    await insertTestBlock({
      height: 110,
      hash,
      poolId: null,
    });

    // Emulate a deployed schema-110 database from the earlier PR revision.
    await DB.query('ALTER TABLE `blocks` DROP COLUMN `coinbase_payouts`');
    await DB.query(`UPDATE state SET number = 110 WHERE name = 'schema_version'`);

    await setupTestDatabase();

    const [schemaRows] = await DB.query<any>(`SELECT number FROM state WHERE name = 'schema_version'`);
    expect(schemaRows[0].number).toBe(112);
    const [blocks] = await DB.query<any>(
      'SELECT hash, coinbase_payouts FROM blocks WHERE hash = ?',
      [hash]
    );
    expect(blocks).toEqual([{ hash, coinbase_payouts: null }]);

    // A second startup must leave both the schema and legacy row unchanged.
    await setupTestDatabase();
    const [rerunBlocks] = await DB.query<any>(
      'SELECT hash, coinbase_payouts FROM blocks WHERE hash = ?',
      [hash]
    );
    expect(rerunBlocks).toEqual([{ hash, coinbase_payouts: null }]);

    await DB.query('DELETE FROM blocks');
  });

  test('pools table should have required columns', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = 'mempool_test' 
       AND TABLE_NAME = 'pools'`
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('slug');
  });
});
