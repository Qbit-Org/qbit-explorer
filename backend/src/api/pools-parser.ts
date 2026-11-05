import DB from '../database';
import logger from '../logger';
import config from '../config';
import PoolsRepository from '../repositories/PoolsRepository';
import { PoolMatchCoinbaseOutput, PoolTag } from '../mempool.interfaces';
import { parseAuxPowParentCoinbase, QbitAuxPowParentCoinbase } from '../utils/qbit-auxpow';
import { matchBlockMiner } from '../utils/pool-match';
import diskCache from './disk-cache';
import mining from './mining/mining';
import BlocksRepository from '../repositories/BlocksRepository';
import redisCache from './redis-cache';
import blocks from './blocks';

class PoolsParser {
  miningPools: any[] = [];
  unknownPool: any = {
    'id': 0,
    'name': 'Unknown',
    'link': 'https://learnmeabitcoin.com/technical/coinbase-transaction',
    'regexes': '[]',
    'addresses': '[]',
    'slug': 'unknown'
  };

  public setMiningPools(pools): void {
    const poolList = this.normalizeMiningPools(pools);
    for (const pool of poolList) {
      pool.addressMatchMode = pool.addressMatchMode || 'any';
      if (!['any', 'full_reward'].includes(pool.addressMatchMode)) {
        throw new Error(`Invalid addressMatchMode '${pool.addressMatchMode}' for mining pool ${pool.name}`);
      }
      pool.regexes = pool.tags;
      pool.parentRegexes = pool.parentTags || [];
      pool.parentAddresses = pool.parentAddresses || [];
      pool.slug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      delete(pool.tags);
      delete(pool.parentTags);
    }
    this.miningPools = poolList;
  }

  private normalizeMiningPools(pools): any[] {
    if (Array.isArray(pools)) {
      return pools;
    }
    if (pools && Array.isArray(pools.pools)) {
      return pools.pools;
    }
    throw new Error('Invalid mining pools JSON: expected an array or an object with a pools array');
  }

  /**
   * Populate our db with updated mining pool definition
   * @param pools
   * @asyncUnsafe
   */
  public async migratePoolsJson(definitionHash: string | null = null): Promise<void> {
    // We also need to wipe the backend cache to make sure we don't serve blocks with
    // the wrong mining pool (usually happen with unknown blocks)
    diskCache.setIgnoreBlocksCache();
    redisCache.setIgnoreBlocksCache();

    await this.$insertUnknownPool();

    if (this.miningPools.length === 0 && config.DATABASE.ENABLED === true) {
      const unknownPool = await PoolsRepository.$getUnknownPool();
      await PoolsRepository.$replacePoolsWithUnknown(unknownPool.id, definitionHash);
      mining.reindexHashrateRequested = true;
      for (const block of blocks.getBlocks()) {
        block.extras = block.extras || {};
        block.extras.pool = {
          id: unknownPool.uniqueId,
          name: unknownPool.name,
          slug: unknownPool.slug,
          minerNames: null,
        };
      }
      void diskCache.$saveCacheToDisk();
      void redisCache.$updateBlocks(blocks.getBlocks());
      logger.info(`Empty mining pool set imported; all blocks now attribute to Unknown`, logger.tags.mining);
      return;
    }

    let clearCache = false;
    const importedUniqueIds: number[] = [];

    for (const pool of this.miningPools) {
      if (!pool.id) {
        logger.info(`Mining pool ${pool.name} has no unique 'id' defined. Skipping.`);
        continue;
      }

      // One of the identifier fields ('addresses', 'regexes', or their
      // AuxPoW parent-chain counterparts) must be a non-empty array
      if (!pool.addresses && !pool.regexes && !pool.parentAddresses && !pool.parentRegexes) {
        logger.err(`Mining pool ${pool.name} must have at least one of the fields 'addresses', 'regexes', 'parentAddresses' or 'parentRegexes'. Skipping.`);
        continue;
      }

      pool.addresses = pool.addresses || [];
      pool.regexes = pool.regexes || [];
      pool.parentAddresses = pool.parentAddresses || [];
      pool.parentRegexes = pool.parentRegexes || [];

      if (pool.addresses.length === 0 && pool.regexes.length === 0 &&
        pool.parentAddresses.length === 0 && pool.parentRegexes.length === 0) {
        logger.err(`Mining pool ${pool.name} has no 'addresses', 'regexes', 'parentAddresses' nor 'parentRegexes' defined. Skipping.`);
        continue;
      }

      if (pool.addresses.length === 0) {
        logger.warn(`Mining pool ${pool.name} has no 'addresses' defined.`);
      }

      if (pool.regexes.length === 0) {
        logger.warn(`Mining pool ${pool.name} has no 'regexes' defined.`);
      }

      importedUniqueIds.push(pool.id);

      const poolDB = await PoolsRepository.$getPoolByUniqueId(pool.id, false);
      if (!poolDB) {
        // New mining pool
        const slug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
        logger.debug(`Inserting new mining pool ${pool.name}`);
        await PoolsRepository.$insertNewMiningPool(pool, slug);
        clearCache = true;
      } else {
        if (poolDB.name !== pool.name) {
          // Pool has been renamed
          const newSlug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
          logger.warn(`Renaming ${poolDB.name} mining pool to ${pool.name}. Slug has been updated. Maybe you want to make a redirection from '/mining/pool/${poolDB.slug}' to '/mining/pool/${newSlug}'`);
          await PoolsRepository.$renameMiningPool(poolDB.id, newSlug, pool.name);
          clearCache = true;
        }
        if (poolDB.link !== pool.link) {
          // Pool link has changed
          logger.debug(`Updating link for ${pool.name} mining pool`);
          await PoolsRepository.$updateMiningPoolLink(poolDB.id, pool.link);
          clearCache = true;
        }
        // $getPoolByUniqueId may return addresses/regexes as parsed arrays
        // instead of raw JSON strings; normalize both sides before comparing.
        // Parent-chain columns predating migration 109 can also be NULL.
        const poolDBAddresses = PoolsParser.rawDefinitionJson(poolDB.addresses);
        const poolDBRegexes = PoolsParser.rawDefinitionJson(poolDB.regexes);
        const poolDBParentAddresses = PoolsParser.rawDefinitionJson(poolDB['parent_addresses']);
        const poolDBParentRegexes = PoolsParser.rawDefinitionJson(poolDB['parent_regexes']);
        const poolDBAddressMatchMode = poolDB['address_match_mode'] ?? poolDB.addressMatchMode ?? 'any';
        if (JSON.stringify(pool.addresses) !== poolDBAddresses ||
          JSON.stringify(pool.regexes) !== poolDBRegexes ||
          JSON.stringify(pool.parentAddresses) !== poolDBParentAddresses ||
          JSON.stringify(pool.parentRegexes) !== poolDBParentRegexes ||
          pool.addressMatchMode !== poolDBAddressMatchMode) {
          // Pool addresses changed or coinbase tags changed
          logger.notice(`Updating addresses and/or coinbase tags for ${pool.name} mining pool.`);
          await PoolsRepository.$updateMiningPoolTags(
            poolDB.id,
            pool.addresses,
            pool.regexes,
            pool.parentAddresses,
            pool.parentRegexes,
            pool.addressMatchMode
          );
          clearCache = true;
          await this.$reindexBlocksForPool(poolDB.id);
        }
      }
    }

    // Pools dropped from the definition set (e.g. Bitcoin pools left over in an
    // upgraded database) must not remain matchable; reassign their blocks to
    // Unknown and re-match them against the current definitions below. Only
    // pools that actually made it through the import count as kept.
    if (config.DATABASE.ENABLED === true) {
      const keepUniqueIds = [0, ...importedUniqueIds];
      const unknownPool = await PoolsRepository.$getUnknownPool();
      const staleCount = await PoolsRepository.$deleteStalePools(keepUniqueIds, unknownPool.id, definitionHash);
      if (staleCount > 0) {
        clearCache = true;
      }
    }

    // Always re-match Unknown blocks when a migration runs: migrations only
    // run on definition changes, and a previous partial import may have
    // committed pool rows without completing this re-index, which would
    // otherwise never be retried once the rows look current.
    logger.notice(`Re-indexing blocks assigned to the unknown mining pool.`);
    let unknownPool;
    if (config.DATABASE.ENABLED === true) {
      unknownPool = await PoolsRepository.$getUnknownPool();
    } else {
      unknownPool = this.unknownPool;
    }
    const reassigned = await this.$reindexBlocksForPool(unknownPool.id);
    if (reassigned > 0) {
      clearCache = true;
    }

    // Every block's pool assignment is now consistent with the imported
    // definitions (changed attributions were re-indexed above and unchanged
    // ones still match), so stamp them all with the new definition hash —
    // including paths like name/link-only changes that re-index nothing.
    if (config.DATABASE.ENABLED === true) {
      await BlocksRepository.$updateDefinitionHash(definitionHash);
    }

    // refresh the in-memory block cache (and its disk/redis copies) with the
    // reindexed data
    if (clearCache) {
      await blocks.$refreshCachedBlocks();
    }
  }

  public matchBlockMiner(
    scriptsig: string,
    addresses: string[],
    pools: PoolTag[],
    auxpowParentCoinbase?: QbitAuxPowParentCoinbase | null,
    qbitCoinbaseOutputs?: PoolMatchCoinbaseOutput[]
  ): PoolTag | undefined {
    return matchBlockMiner(scriptsig, addresses, pools, auxpowParentCoinbase, qbitCoinbaseOutputs);
  }

  private static rawDefinitionJson(value: string | string[] | null | undefined): string {
    if (value === null || value === undefined) {
      return '[]';
    }
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  /**
   * Manually add the 'unknown pool'
   * @asyncSafe
   */
  public async $insertUnknownPool(): Promise<void> {
    if (!config.DATABASE.ENABLED) {
      return;
    }

    try {
      const [rows]: any[] = await DB.query({ sql: 'SELECT name from pools where name="Unknown"', timeout: 120000 });
      if (rows.length === 0) {
        await DB.query({
          sql: `INSERT INTO pools(name, link, regexes, addresses, slug, unique_id)
          VALUES("${this.unknownPool.name}", "${this.unknownPool.link}", "[]", "[]", "${this.unknownPool.slug}", 0);
        `});
      } else {
        await DB.query(`UPDATE pools
          SET name='${this.unknownPool.name}', link='${this.unknownPool.link}',
          regexes='[]', addresses='[]',
          slug='${this.unknownPool.slug}',
          unique_id=0
          WHERE slug='${this.unknownPool.slug}'
        `);
      }
    } catch (e) {
      logger.err(`Unable to insert or update "Unknown" mining pool. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * re-index pool assignment for blocks previously associated with pool;
   * returns the number of blocks reassigned to a different pool
   *
   * @param pool local id of existing pool to reindex
   * @asyncUnsafe
   */
  private async $reindexBlocksForPool(poolId: number): Promise<number> {
    // qbit pools can be tagged from genesis on every network; the upstream
    // Bitcoin first-known-pool-block heights do not apply here.
    const firstKnownBlockPool = 0;

    const [blocks]: any[] = await DB.query(`
      SELECT height, hash, coinbase_raw, coinbase_addresses, coinbase_payouts, header
      FROM blocks
      WHERE pool_id = ?
      AND height >= ?
      ORDER BY height DESC
    `, [poolId, firstKnownBlockPool]);

    let pools: PoolTag[] = [];
    let unknownPool;
    if (config.DATABASE.ENABLED === true) {
      pools = await PoolsRepository.$getPools();
      unknownPool = await PoolsRepository.$getUnknownPool();
    } else {
      pools = this.miningPools;
      unknownPool = this.unknownPool;
    }

    let changed = 0;
    for (const block of blocks) {
      // Do not fall back to legacy coinbase_address here: it is only the
      // first output and cannot prove that one address received the full
      // reward. Rows without the complete address set remain conservatively
      // unmatched until the coinbase-address indexer fills them.
      const addresses = JSON.parse(block.coinbase_addresses) || [];
      // NULL marks rows indexed before exact positive payout evidence was
      // persisted. Only those legacy rows use the census-verified singleton
      // recipient fallback; all newly indexed rows replay the exact decision.
      const payouts: PoolMatchCoinbaseOutput[] | undefined =
        block.coinbase_payouts === null || block.coinbase_payouts === undefined
        ? undefined
        : JSON.parse(block.coinbase_payouts);
      // Blocks that no longer match any definition fall back to Unknown, so a
      // legacy pool row that collides with a vendored unique_id (and gets
      // renamed/retagged on import) cannot keep foreign blocks attributed to it
      const newPool = this.matchBlockMiner(
        block.coinbase_raw,
        addresses,
        pools,
        parseAuxPowParentCoinbase(block.header),
        payouts
      ) ?? unknownPool;
      if (newPool.id !== poolId) {
        changed++;
        await BlocksRepository.$savePool(block.hash, newPool.id);
      }
    }

    logger.info(`${changed} blocks assigned to a new pool`, logger.tags.mining);

    // Re-index hashrates and difficulty adjustments later
    mining.reindexHashrateRequested = true;

    return changed;
  }
}

export default new PoolsParser();
