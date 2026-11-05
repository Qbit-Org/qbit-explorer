import { Common } from '../api/common';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import logger from '../logger';
import { PoolAddressMatchMode, PoolInfo, PoolTag } from '../mempool.interfaces';

class PoolsRepository {
  /**
   * Get all pools tagging info
   * @asyncUnsafe
   */
  public async $getPools(): Promise<PoolTag[]> {
    const [rows] = await DB.query('SELECT id, unique_id as uniqueId, name, addresses, regexes, address_match_mode as addressMatchMode, parent_addresses as parentAddresses, parent_regexes as parentRegexes, slug FROM pools');
    return <PoolTag[]>rows;
  }

  /**
   * Get unknown pool tagging info
   * @asyncUnsafe
   */
  public async $getUnknownPool(): Promise<PoolTag> {
    let [rows]: any[] = await DB.query('SELECT id, unique_id as uniqueId, name, slug FROM pools where name = "Unknown"');
    if (rows && rows.length === 0 && config.DATABASE.ENABLED) {
      await poolsParser.$insertUnknownPool();
      [rows] = await DB.query('SELECT id, unique_id as uniqueId, name, slug FROM pools where name = "Unknown"');
    }
    return <PoolTag>rows[0];
  }

  /**
   * Get basic pool info and block count
   * @asyncSafe
   */
  public async $getPoolsInfo(interval: string | null = null): Promise<PoolInfo[]> {
    interval = Common.getSqlInterval(interval);

    let query = `
      SELECT
        COUNT(blocks.height) As blockCount,
          pool_id AS poolId,
          pools.name AS name,
          pools.link AS link,
          slug,
          AVG(blocks_audits.match_rate) AS avgMatchRate,
          AVG((CAST(blocks.fees as SIGNED) - CAST(blocks_audits.expected_fees as SIGNED)) / NULLIF(CAST(blocks_audits.expected_fees as SIGNED), 0)) AS avgFeeDelta,
          unique_id as poolUniqueId
      FROM blocks
      JOIN pools on pools.id = pool_id
      LEFT JOIN blocks_audits ON blocks_audits.height = blocks.height
      WHERE blocks.stale = 0
    `;

    if (interval) {
      query += ` AND blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY pool_id
      ORDER BY COUNT(blocks.height) DESC`;

    try {
      const [rows] = await DB.query(query);
      return <PoolInfo[]>rows;
    } catch (e) {
      logger.err(`Cannot generate pools stats. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get basic pool info and block count between two timestamp
   * @asyncSafe
   */
  public async $getPoolsInfoBetween(from: number, to: number): Promise<PoolInfo[]> {
    const query = `SELECT COUNT(height) as blockCount, pools.id as poolId, pools.name as poolName
      FROM pools
      LEFT JOIN blocks on pools.id = blocks.pool_id AND blocks.blockTimestamp BETWEEN FROM_UNIXTIME(?) AND FROM_UNIXTIME(?)
      WHERE blocks.stale = 0
      GROUP BY pools.id`;

    try {
      const [rows] = await DB.query(query, [from, to]);
      return <PoolInfo[]>rows;
    } catch (e) {
      logger.err('Cannot generate pools blocks count. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a mining pool info
   * @asyncSafe
   */
  public async $getPool(slug: string, parse: boolean = true): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.slug = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [slug]);

      if (rows.length < 1) {
        return null;
      }

      if (parse) {
        rows[0].regexes = JSON.parse(rows[0].regexes);
        // unlike upstream's pools-v2.json, pools-qbit.json carries the
        // addresses of whichever qbit network the instance runs on, so they
        // are never cleared for non-mainnet networks
        rows[0].addresses = JSON.parse(rows[0].addresses);
        // AuxPoW parent-chain identifiers (NULL until an import writes them),
        // exposed under the PoolTag field names like $getPools does
        rows[0].parentRegexes = JSON.parse(rows[0].parent_regexes ?? '[]');
        rows[0].parentAddresses = JSON.parse(rows[0].parent_addresses ?? '[]');
        rows[0].addressMatchMode = rows[0].address_match_mode ?? 'any';
        delete rows[0].parent_regexes;
        delete rows[0].parent_addresses;
        delete rows[0].address_match_mode;
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a mining pool info by its unique id
   * @asyncSafe
   */
  public async $getPoolByUniqueId(id: number, parse: boolean = true): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.unique_id = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [id]);

      if (rows.length < 1) {
        return null;
      }

      if (parse) {
        rows[0].regexes = JSON.parse(rows[0].regexes);
        // raw stored addresses are kept for parse=false callers such as
        // migratePoolsJson, whose change detection compares JSON strings
        rows[0].addresses = JSON.parse(rows[0].addresses);
        rows[0].parentRegexes = JSON.parse(rows[0].parent_regexes ?? '[]');
        rows[0].parentAddresses = JSON.parse(rows[0].parent_addresses ?? '[]');
        rows[0].addressMatchMode = rows[0].address_match_mode ?? 'any';
        delete rows[0].parent_regexes;
        delete rows[0].parent_addresses;
        delete rows[0].address_match_mode;
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Insert a new mining pool in the database
   *
   * @param pool
   * @asyncSafe
   */
  public async $insertNewMiningPool(pool: any, slug: string): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO pools
        SET name = ?, link = ?, addresses = ?, regexes = ?, address_match_mode = ?, parent_addresses = ?, parent_regexes = ?, slug = ?, unique_id = ?`,
        [pool.name, pool.link, JSON.stringify(pool.addresses), JSON.stringify(pool.regexes),
          pool.addressMatchMode ?? 'any', JSON.stringify(pool.parentAddresses ?? []),
          JSON.stringify(pool.parentRegexes ?? []), slug, pool.id]
      );
    } catch (e: any) {
      logger.err(`Cannot insert new mining pool into db. Reason: ` + (e instanceof Error ? e.message : e));
      // Let the caller roll back so the pools definition marker is not
      // committed without the pool row, which would never be retried.
      throw e;
    }
  }

  /**
   * Rename an existing mining pool
   *
   * @param dbId
   * @param newSlug
   * @param newName
   * @asyncSafe
   */
  public async $renameMiningPool(dbId: number, newSlug: string, newName: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET slug = ?, name = ?
        WHERE id = ?`,
        [newSlug, newName, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot rename mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Update an exisiting mining pool link
   *
   * @param dbId
   * @param newLink
   * @asyncSafe
   */
  public async $updateMiningPoolLink(dbId: number, newLink: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET link = ?
        WHERE id = ?`,
        [newLink, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot update link for mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }

  }

  /**
   * Update an existing mining pool addresses or coinbase tags
   *
   * @param dbId
   * @param addresses
   * @param regexes
   * @asyncSafe
   */
  public async $updateMiningPoolTags(
    dbId: number,
    addresses: string | string[],
    regexes: string | string[],
    parentAddresses: string | string[] = [],
    parentRegexes: string | string[] = [],
    addressMatchMode: PoolAddressMatchMode = 'any'
  ): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET addresses = ?, regexes = ?, parent_addresses = ?, parent_regexes = ?, address_match_mode = ?
        WHERE id = ?`,
        [JSON.stringify(addresses), JSON.stringify(regexes), JSON.stringify(parentAddresses),
          JSON.stringify(parentRegexes), addressMatchMode, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot update mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Delete pool definitions whose unique_id is not in the current definition
   * set, reassigning their blocks to the Unknown pool first.
   *
   * qbit imports its pool definitions from the vendored pools-qbit.json, so
   * stale definitions (e.g. Bitcoin pools left over in an upgraded database)
   * must not remain matchable. Returns the number of pools removed.
   *
   * @asyncUnsafe
   */
  public async $deleteStalePools(keepUniqueIds: number[], unknownPoolId: number, definitionHash: string | null): Promise<number> {
    try {
      const keepPlaceholders = keepUniqueIds.map(() => '?').join(',');
      const [stalePools]: any[] = await DB.query(`
        SELECT id, name
        FROM pools
        WHERE unique_id NOT IN (${keepPlaceholders})`,
        keepUniqueIds
      );
      if (stalePools.length === 0) {
        return 0;
      }

      const staleIds = stalePools.map((pool) => pool.id);
      const stalePlaceholders = staleIds.map(() => '?').join(',');
      logger.notice(`Removing ${stalePools.length} stale mining pool definitions: ${stalePools.map((pool) => pool.name).join(', ')}`, logger.tags.mining);
      await DB.query(`
        UPDATE blocks
        SET pool_id = ?, definition_hash = ?
        WHERE pool_id IN (${stalePlaceholders})`,
        [unknownPoolId, definitionHash, ...staleIds]
      );
      await DB.query('DELETE FROM hashrates');
      await DB.query(`
        DELETE FROM pools
        WHERE id IN (${stalePlaceholders})`,
        staleIds
      );
      return stalePools.length;
    } catch (e: any) {
      logger.err(`Cannot delete stale mining pools. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Replace all configured pool definitions with the Unknown pool.
   *
   * qbit starts with an empty pool definition file so stale Bitcoin pool regexes
   * from an upgraded database must not remain matchable.
   *
   * @asyncSafe
   */
  public async $replacePoolsWithUnknown(unknownPoolId: number, definitionHash: string | null): Promise<void> {
    try {
      await DB.query(`
        UPDATE blocks
        SET pool_id = ?, definition_hash = ?`,
        [unknownPoolId, definitionHash]
      );
      await DB.query('DELETE FROM hashrates');
      await DB.query(`
        DELETE FROM pools
        WHERE id <> ?`,
        [unknownPoolId]
      );
    } catch (e: any) {
      logger.err(`Cannot replace mining pools with Unknown. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

}

export default new PoolsRepository();
