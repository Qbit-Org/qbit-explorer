import { Common } from '../api/common';
import mining from '../api/mining/mining';
import DB from '../database';
import logger from '../logger';
import PoolsRepository from './PoolsRepository';

export type HashrateLane = 'aggregate' | 'permissionless' | 'auxpow';

export interface HashrateRecord {
  hashrateTimestamp: number;
  avgHashrate: number;
  poolId: number;
  share: number;
  type: 'daily' | 'weekly';
  lane?: HashrateLane;
}

interface HashrateHistoryPoint {
  timestamp: number;
  avgHashrate: number;
}

export interface NetworkDailyHashrates {
  aggregate: HashrateHistoryPoint[];
  permissionless: HashrateHistoryPoint[];
  auxpow: HashrateHistoryPoint[];
}

class HashratesRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveHashrates(hashrates: HashrateRecord[]): Promise<void> {
    if (hashrates.length === 0) {
      return;
    }

    const values: Array<number | string> = [];
    const placeholders: string[] = [];
    for (const hashrate of hashrates) {
      placeholders.push('(FROM_UNIXTIME(?), ?, ?, ?, ?, ?)');
      values.push(
        hashrate.hashrateTimestamp,
        hashrate.avgHashrate,
        hashrate.poolId,
        hashrate.share,
        hashrate.type,
        hashrate.lane ?? 'aggregate',
      );
    }

    const query = `INSERT INTO hashrates
      (hashrate_timestamp, avg_hashrate, pool_id, share, type, lane)
      VALUES ${placeholders.join(', ')}
      ON DUPLICATE KEY UPDATE
        hashrate_timestamp = VALUES(hashrate_timestamp),
        avg_hashrate = VALUES(avg_hashrate),
        share = VALUES(share),
        type = VALUES(type)`;

    try {
      await DB.query(query, values);
    } catch (e: any) {
      logger.err('Cannot save indexed hashrate into db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  public async $getRawNetworkDailyHashrate(interval: string | null, lane: HashrateLane = 'aggregate'): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    let query = `SELECT
      UNIX_TIMESTAMP(hashrate_timestamp) as timestamp,
      avg_hashrate as avgHashrate,
      lane
      FROM hashrates
      WHERE hashrates.type = 'daily'
        AND pool_id = 0
        AND lane = ?`;

    if (interval) {
      query += ` AND hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` ORDER by hashrate_timestamp`;

    try {
      const [rows]: any[] = await DB.query(query, [lane]);
      return rows;
    } catch (e) {
      logger.err('Cannot fetch network hashrate history. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  public async $getNetworkDailyHashrate(interval: string | null, lane: HashrateLane = 'aggregate'): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    let query = `SELECT
      CAST(AVG(UNIX_TIMESTAMP(hashrate_timestamp)) as INT) as timestamp,
      CAST(AVG(avg_hashrate) as DOUBLE) as avgHashrate
      FROM hashrates
      WHERE hashrates.type = 'daily'
        AND pool_id = 0
        AND lane = ?`;

    if (interval) {
      query += ` AND hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY UNIX_TIMESTAMP(hashrate_timestamp) DIV ${86400}`;
    query += ` ORDER by hashrate_timestamp`;

    try {
      const [rows]: any[] = await DB.query(query, [lane]);
      return rows;
    } catch (e) {
      logger.err('Cannot fetch network hashrate history. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  /**
   * Return aggregate and lane history from timestamps where all three rows are
   * present. Reading the triplets in one query keeps the public series aligned
   * while migration backfill is still replacing legacy aggregate-only rows, or
   * when an incomplete anchored block window prevents a day from being
   * recalculated.
   */
  public async $getCompleteNetworkDailyHashrates(interval: string | null): Promise<NetworkDailyHashrates> {
    interval = Common.getSqlInterval(interval);

    let query = `SELECT
      CAST(AVG(UNIX_TIMESTAMP(hashrates.hashrate_timestamp)) as INT) as timestamp,
      CAST(AVG(CASE WHEN hashrates.lane = 'aggregate' THEN avg_hashrate END) as DOUBLE) as aggregateHashrate,
      CAST(AVG(CASE WHEN hashrates.lane = 'permissionless' THEN avg_hashrate END) as DOUBLE) as permissionlessHashrate,
      CAST(AVG(CASE WHEN hashrates.lane = 'auxpow' THEN avg_hashrate END) as DOUBLE) as auxpowHashrate
      FROM hashrates
      INNER JOIN (
        SELECT hashrate_timestamp
        FROM hashrates
        WHERE type = 'daily' AND pool_id = 0
        GROUP BY hashrate_timestamp
        HAVING COUNT(DISTINCT lane) = 3
      ) complete_hashrates USING (hashrate_timestamp)
      WHERE hashrates.type = 'daily'
        AND hashrates.pool_id = 0`;

    if (interval) {
      query += ` AND hashrates.hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY UNIX_TIMESTAMP(hashrates.hashrate_timestamp) DIV ${86400}`;
    query += ` ORDER BY hashrates.hashrate_timestamp`;

    try {
      const [rows]: any[] = await DB.query(query);
      const toSeries = (field: string): HashrateHistoryPoint[] => rows.map(row => ({
        timestamp: Number(row.timestamp),
        avgHashrate: Number(row[field]),
      }));
      return {
        aggregate: toSeries('aggregateHashrate'),
        permissionless: toSeries('permissionlessHashrate'),
        auxpow: toSeries('auxpowHashrate'),
      };
    } catch (e) {
      logger.err('Cannot fetch complete network hashrate history. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  /**
   * Return daily timestamps for which aggregate and both Cadence lane rows are
   * already present. Aggregate-only pre-migration history is intentionally not
   * considered complete so the normal indexer pass backfills both lane series.
   */
  public async $getCompleteNetworkDailyHashrateTimestamps(): Promise<number[]> {
    const query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp
      FROM hashrates
      WHERE type = 'daily' AND pool_id = 0
      GROUP BY hashrate_timestamp
      HAVING COUNT(DISTINCT lane) = 3`;

    try {
      const [rows]: any[] = await DB.query(query);
      return rows.map(row => Number(row.timestamp));
    } catch (e) {
      logger.err('Cannot retrieve complete network hashrate timestamps. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  public async $getWeeklyHashrateTimestamps(): Promise<number[]> {
    const query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp
      FROM hashrates
      WHERE type = 'weekly' AND lane = 'aggregate'
      GROUP BY hashrate_timestamp`;

    try {
      const [rows]: any[] = await DB.query(query);
      return rows.map(row => row.timestamp);
    } catch (e) {
      logger.err('Cannot retrieve indexed weekly hashrate timestamps. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  /**
   * Returns the current biggest pool hashrate history
   */
  public async $getPoolsWeeklyHashrate(interval: string | null): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    const topPoolsId = (await PoolsRepository.$getPoolsInfo('1w')).map((pool) => pool.poolId);
    if (topPoolsId.length === 0) {
      return [];
    }

    let query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate, share, pools.name as poolName
      FROM hashrates
      JOIN pools on pools.id = pool_id`;

    if (interval) {
      query += ` WHERE hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()
        AND hashrates.type = 'weekly'
        AND hashrates.lane = 'aggregate'
        AND pool_id IN (${topPoolsId})`;
    } else {
      query += ` WHERE hashrates.type = 'weekly'
        AND hashrates.lane = 'aggregate'
        AND pool_id IN (${topPoolsId})`;
    }

    query += ` ORDER by hashrate_timestamp, FIELD(pool_id, ${topPoolsId})`;

    try {
      const [rows]: any[] = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('Cannot fetch weekly pools hashrate history. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  /**
   * Returns a pool hashrate history
   */
  public async $getPoolWeeklyHashrate(slug: string): Promise<any[]> {
    const pool = await PoolsRepository.$getPool(slug);
    if (!pool) {
      throw new Error('This mining pool does not exist');
    }

    // Find hashrate boundaries
    let query = `SELECT MIN(hashrate_timestamp) as firstTimestamp, MAX(hashrate_timestamp) as lastTimestamp
      FROM hashrates
      JOIN pools on pools.id = pool_id
      WHERE hashrates.type = 'weekly' AND hashrates.lane = 'aggregate' AND pool_id = ? AND avg_hashrate != 0
      ORDER by hashrate_timestamp LIMIT 1`;

    let boundaries = {
      firstTimestamp: '1970-01-01',
      lastTimestamp: '9999-01-01'
    };

    try {
      const [rows]: any[] = await DB.query(query, [pool.id]);
      boundaries = rows[0];
    } catch (e) {
      logger.err('Cannot fetch hashrate start/end timestamps for this pool. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
    }

    // Get hashrates entries between boundaries
    query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate, share, pools.name as poolName
      FROM hashrates
      JOIN pools on pools.id = pool_id
      WHERE hashrates.type = 'weekly' AND hashrates.lane = 'aggregate' AND hashrate_timestamp BETWEEN ? AND ?
      AND pool_id = ?
      ORDER by hashrate_timestamp`;

    try {
      const [rows]: any[] = await DB.query(query, [boundaries.firstTimestamp, boundaries.lastTimestamp, pool.id]);
      return rows;
    } catch (e) {
      logger.err('Cannot fetch pool hashrate history for this pool. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  /**
   * Get latest run timestamp
   */
  public async $getLatestRun(key: string): Promise<number> {
    const query = `SELECT number FROM state WHERE name = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [key]);

      if (rows.length === 0) {
        return 0;
      }
      return rows[0]['number'];
    } catch (e) {
      logger.err(`Cannot retrieve last indexing run for ${key}. Reason: ` + (e instanceof Error ? e.message : e), logger.tags.mining);
      throw e;
    }
  }

  /**
   * Delete most recent data points for re-indexing
   */
  public async $deleteLastEntries() {
    logger.info(`Delete latest hashrates data points from the database`, logger.tags.mining);

    try {
      const [rows]: any[] = await DB.query(`SELECT MAX(hashrate_timestamp) as timestamp FROM hashrates GROUP BY type`);
      for (const row of rows) {
        await DB.query(`DELETE FROM hashrates WHERE hashrate_timestamp = ?`, [row.timestamp]);
      }
      // Re-run the hashrate indexing to fill up missing data
      mining.lastHashrateIndexingDate = null;
      mining.lastWeeklyHashrateIndexingDate = null;
    } catch (e) {
      logger.err('Cannot delete latest hashrates data points. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
    }
  }

  /**
   * Delete hashrates from the database from timestamp
   */
  public async $deleteHashratesFromTimestamp(timestamp: number) {
    logger.info(`Delete newer hashrates from timestamp ${new Date(timestamp * 1000).toUTCString()} from the database`, logger.tags.mining);

    try {
      await DB.query(`DELETE FROM hashrates WHERE hashrate_timestamp >= FROM_UNIXTIME(?)`, [timestamp]);
      // Re-run the hashrate indexing to fill up missing data
      mining.lastHashrateIndexingDate = null;
      mining.lastWeeklyHashrateIndexingDate = null;
    } catch (e) {
      logger.err('Cannot delete latest hashrates data points. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
    }
  }
}

export default new HashratesRepository();
