import { BlockPrice, PoolInfo, PoolStats, RewardStats } from '../../mempool.interfaces';
import BlocksRepository, { IncompleteHashrateWindowError } from '../../repositories/BlocksRepository';
import PoolsRepository from '../../repositories/PoolsRepository';
import HashratesRepository, { HashrateRecord } from '../../repositories/HashratesRepository';
import bitcoinClient from '../bitcoin/bitcoin-client';
import logger from '../../logger';
import { Common } from '../common';
import loadingIndicators from '../loading-indicators';
import { escape } from 'mysql2';
import config from '../../config';
import BlocksAuditsRepository from '../../repositories/BlocksAuditsRepository';
import PricesRepository from '../../repositories/PricesRepository';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import { IEsploraApi } from '../bitcoin/esplora-api.interface';
import database from '../../database';
import { expectedBlocksForTimespan } from '../../utils/block-target';
import { attributePoolHashrates, calcLaneHashratesForWindow, PoolLaneWork, QbitLaneHashrates, sumPoolLaneWork } from '../../utils/qbit-lane-hashrate';
import { laneOf } from '../../utils/qbit-version';

interface HashrateWindowStats {
  laneHashrates: QbitLaneHashrates;
  poolLaneWork: PoolLaneWork[];
  poolBlockCounts: Map<number, number>;
}

class Mining {
  private blocksPriceIndexingRunning = false;
  public lastHashrateIndexingDate: number | null = null;
  public lastWeeklyHashrateIndexingDate: number | null = null;

  public reindexHashrateRequested = false;

  private genesisData: {
    timestamp: number,
    bits: number,
    difficulty: number,
  } | null = null;

  /**
   * Get historical blocks health
   */
  public async $getBlocksHealthHistory(interval: string | null = null): Promise<any> {
    return await BlocksAuditsRepository.$getBlocksHealthHistory(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block total fee
   */
  public async $getHistoricalBlockFees(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockFees(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get timespan block total fees
   */
  public async $getBlockFeesTimespan(from: number, to: number): Promise<number> {
    return await BlocksRepository.$getHistoricalBlockFees(
      this.getTimeRangeFromTimespan(from, to),
      null,
      {from, to}
    );
  }

  /**
   * Get historical block rewards
   */
  public async $getHistoricalBlockRewards(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockRewards(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block fee rates percentiles
   */
  public async $getHistoricalBlockFeeRates(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockFeeRates(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block sizes
   */
  public async $getHistoricalBlockSizes(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockSizes(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block weights
   */
  public async $getHistoricalBlockWeights(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockWeights(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Generate high level overview of the pool ranks and general stats
   */
  public async $getPoolsStats(interval: string | null): Promise<object> {
    const poolsStatistics = {};

    const poolsInfo: PoolInfo[] = await PoolsRepository.$getPoolsInfo(interval);
    const emptyBlocks: any[] = await BlocksRepository.$countEmptyBlocks(null, interval);

    const poolsStats: PoolStats[] = [];
    let rank = 1;

    poolsInfo.forEach((poolInfo: PoolInfo) => {
      const emptyBlocksCount = emptyBlocks.filter((emptyCount) => emptyCount.poolId === poolInfo.poolId);
      const poolStat: PoolStats = {
        poolId: poolInfo.poolId, // mysql row id
        name: poolInfo.name,
        link: poolInfo.link,
        blockCount: poolInfo.blockCount,
        rank: rank++,
        emptyBlocks: emptyBlocksCount.length > 0 ? emptyBlocksCount[0]['count'] : 0,
        slug: poolInfo.slug,
        avgMatchRate: poolInfo.avgMatchRate !== null ? Math.round(100 * poolInfo.avgMatchRate) / 100 : null,
        avgFeeDelta: poolInfo.avgFeeDelta,
        poolUniqueId: poolInfo.poolUniqueId
      };
      poolsStats.push(poolStat);
    });

    poolsStatistics['pools'] = poolsStats;

    const blockCount: number = await BlocksRepository.$blockCount(null, interval);
    poolsStatistics['blockCount'] = blockCount;

    const totalBlock24h: number = await BlocksRepository.$blockCount(null, '24h');
    const totalBlock3d: number = await BlocksRepository.$blockCount(null, '3d');
    const totalBlock1w: number = await BlocksRepository.$blockCount(null, '1w');

    try {
      const [stats24h, stats3d, stats1w] = await Promise.all([
        this.$getHashrateWindowStats(totalBlock24h),
        this.$getHashrateWindowStats(totalBlock3d),
        this.$getHashrateWindowStats(totalBlock1w),
      ]);
      poolsStatistics['lastEstimatedHashrate'] = stats24h.laneHashrates.aggregate;
      poolsStatistics['lastEstimatedHashrate3d'] = stats3d.laneHashrates.aggregate;
      poolsStatistics['lastEstimatedHashrate1w'] = stats1w.laneHashrates.aggregate;

      const estimates24h = attributePoolHashrates(stats24h.poolLaneWork, stats24h.laneHashrates);
      const estimates3d = attributePoolHashrates(stats3d.poolLaneWork, stats3d.laneHashrates);
      const estimates1w = attributePoolHashrates(stats1w.poolLaneWork, stats1w.laneHashrates);
      for (const poolStat of poolsStats) {
        poolStat.lastEstimatedHashrate = estimates24h.get(poolStat.poolId) ?? 0;
        poolStat.lastEstimatedHashrate3d = estimates3d.get(poolStat.poolId) ?? 0;
        poolStat.lastEstimatedHashrate1w = estimates1w.get(poolStat.poolId) ?? 0;
      }
    } catch (e) {
      poolsStatistics['lastEstimatedHashrate'] = 0;
      poolsStatistics['lastEstimatedHashrate3d'] = 0;
      poolsStatistics['lastEstimatedHashrate1w'] = 0;
      logger.debug('Indexed blocks are not available, using zeroed values for current hashrate', logger.tags.mining);
    }

    return poolsStatistics;
  }

  /**
   * Get all mining pool stats for a pool
   */
  public async $getPoolStat(slug: string): Promise<object> {
    const pool = await PoolsRepository.$getPool(slug);
    if (!pool) {
      throw new Error('This mining pool does not exist');
    }

    const blockCount: number = await BlocksRepository.$blockCount(pool.id);
    const totalBlock: number = await BlocksRepository.$blockCount(null, null);

    const blockCount24h: number = await BlocksRepository.$blockCount(pool.id, '24h');
    const totalBlock24h: number = await BlocksRepository.$blockCount(null, '24h');

    const blockCount1w: number = await BlocksRepository.$blockCount(pool.id, '1w');
    const totalBlock1w: number = await BlocksRepository.$blockCount(null, '1w');

    const avgHealth = await BlocksRepository.$getAvgBlockHealthPerPoolId(pool.id);
    const totalReward = await BlocksRepository.$getTotalRewardForPoolId(pool.id);

    let estimatedHashrate = 0;
    try {
      const stats24h = await this.$getHashrateWindowStats(totalBlock24h);
      estimatedHashrate = attributePoolHashrates(stats24h.poolLaneWork, stats24h.laneHashrates).get(pool.id) ?? 0;
    } catch (e) {
      logger.debug('Indexed blocks are not available, using zeroed value for current hashrate', logger.tags.mining);
    }

    return {
      pool: pool,
      blockCount: {
        'all': blockCount,
        '24h': blockCount24h,
        '1w': blockCount1w,
      },
      blockShare: {
        'all': blockCount / totalBlock,
        '24h': blockCount24h / totalBlock24h,
        '1w': blockCount1w / totalBlock1w,
      },
      estimatedHashrate,
      reportedHashrate: null,
      avgBlockHealth: avgHealth,
      totalReward: totalReward,
    };
  }

  /**
   * Get miner reward stats
   */
  public async $getRewardStats(blockCount: number): Promise<RewardStats> {
    return await BlocksRepository.$getBlockStats(blockCount);
  }

  /**
   * Calculate aggregate and Cadence-lane network rates over one common active
   * chain window. The repository includes the extra oldest timing anchor and
   * the calculator mirrors qbit's getnetworkhashps work/window semantics.
   */
  public async $getNetworkHashrates(blockCount: number, endHeight?: number): Promise<QbitLaneHashrates> {
    return (await this.$getHashrateWindowStats(blockCount, endHeight)).laneHashrates;
  }

  /**
   * Calculate the lane network rates, each pool's per-lane solved work, and
   * each pool's block count from one shared block window, so pool attribution
   * divides exactly the work that produced the rates, estimates sum back to
   * the aggregate, and dominance shares describe the same block set.
   * @asyncSafe
   */
  public async $getHashrateWindowStats(blockCount: number, endHeight?: number): Promise<HashrateWindowStats> {
    const blocks = await BlocksRepository.$getHashrateWindow(blockCount, endHeight);
    // the oldest row is the window's timing/chainwork anchor: it contributes
    // no proof to the lane rates, so it earns no attribution weight either
    const contributingBlocks = blocks.slice(1);

    const poolBlockCounts = new Map<number, number>();
    for (const block of contributingBlocks) {
      const poolId = block.poolId ?? 0;
      poolBlockCounts.set(poolId, (poolBlockCounts.get(poolId) ?? 0) + 1);
    }

    return {
      laneHashrates: calcLaneHashratesForWindow(blocks, config.MEMPOOL.NETWORK),
      poolLaneWork: sumPoolLaneWork(contributingBlocks.map((block) => ({
        poolId: block.poolId ?? 0,
        lane: laneOf(block.version, config.MEMPOOL.NETWORK),
        bits: block.bits,
      }))),
      poolBlockCounts,
    };
  }

  /**
   * Return a trailing wall-clock interval expressed through the corresponding
   * canonical block window. This retains the endpoint's historical "1w"
   * meaning while producing aggregate and both lane values atomically.
   */
  public async $getCurrentHashrates(interval: string = '1w'): Promise<QbitLaneHashrates> {
    const blockCount = await BlocksRepository.$blockCount(null, interval);
    return this.$getNetworkHashrates(blockCount);
  }

  /**
   * Generate weekly mining pool hashrate history
   */
  public async $generatePoolHashrateHistory(): Promise<void> {
    const now = new Date();

    // Run only if:
    // * this.lastWeeklyHashrateIndexingDate is set to null (node backend restart, reorg, or re-indexing was requested after mining pools update)
    // * we started a new week (around Monday midnight)
    const runIndexing = this.lastWeeklyHashrateIndexingDate === null ||
      now.getUTCDay() === 1 && this.lastWeeklyHashrateIndexingDate !== now.getUTCDate();
    if (!runIndexing) {
      logger.debug(`Pool hashrate history indexing is up to date, nothing to do`, logger.tags.mining);
      return;
    }

    try {
      const oldestConsecutiveBlockTimestamp = 1000 * (await BlocksRepository.$getOldestConsecutiveBlock()).timestamp;

      const genesisData = await this.getGenesisData();
      const genesisTimestamp = genesisData.timestamp * 1000;

      const indexedTimestamp = await HashratesRepository.$getWeeklyHashrateTimestamps();
      const hashrates: any[] = [];

      const lastMonday = new Date(now.setDate(now.getDate() - (now.getDay() + 6) % 7));
      const lastMondayMidnight = this.getDateMidnight(lastMonday);
      let toTimestamp = lastMondayMidnight.getTime();

      const totalWeekIndexed = (await BlocksRepository.$blockCount(null, null)) / expectedBlocksForTimespan('1w', config.MEMPOOL.BLOCK_TARGET_SPACING_SECONDS);
      let indexedThisRun = 0;
      let totalIndexed = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      logger.debug(`Indexing weekly mining pool hashrate`, logger.tags.mining);
      loadingIndicators.setProgress('weekly-hashrate-indexing', 0);

      while (toTimestamp > genesisTimestamp && toTimestamp > oldestConsecutiveBlockTimestamp) {
        const fromTimestamp = toTimestamp - 604800000;

        // Skip already indexed weeks
        if (indexedTimestamp.includes(toTimestamp / 1000)) {
          toTimestamp -= 604800000;
          ++totalIndexed;
          continue;
        }

        const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, fromTimestamp / 1000, toTimestamp / 1000);

        if (blockStats.blockCount <= 0) {
          logger.debug(`No block found between ${fromTimestamp / 1000} and ${toTimestamp / 1000}, skipping hashrate indexing for this period`, logger.tags.mining);
        } else {
          let windowStats: HashrateWindowStats | null = null;
          try {
            windowStats = await this.$getHashrateWindowStats(
              blockStats.blockCount,
              blockStats.lastBlockHeight,
            );
          } catch (e) {
            if (e instanceof IncompleteHashrateWindowError) {
              logger.warn(`Skipping weekly hashrate period ending ${toTimestamp / 1000}: indexed blocks do not contain its complete anchored window`, logger.tags.mining);
            } else {
              throw e;
            }
          }

          if (windowStats !== null) {
            // pool rows, shares, and rates all derive from the same anchored
            // window: a separate timestamp-window selection can disagree with
            // it around week boundaries when block timestamps are skewed
            const estimates = attributePoolHashrates(windowStats.poolLaneWork, windowStats.laneHashrates);
            const totalBlocks = [...windowStats.poolBlockCounts.values()].reduce((sum, count) => sum + count, 0);
            if (totalBlocks > 0) {
              for (const [poolId, poolBlockCount] of windowStats.poolBlockCounts) {
                // blocks without pool attribution still weigh the totals, but
                // must never be persisted: pool_id 0 with the default
                // aggregate lane is the unique key of the daily network rows,
                // which an upsert would silently overwrite
                if (poolId === 0) {
                  continue;
                }
                hashrates.push({
                  hashrateTimestamp: toTimestamp / 1000,
                  avgHashrate: estimates.get(poolId) ?? 0,
                  poolId,
                  share: poolBlockCount / totalBlocks,
                  type: 'weekly',
                });
              }

              newlyIndexed += hashrates.length / Math.max(1, windowStats.poolBlockCounts.size);
              await HashratesRepository.$saveHashrates(hashrates);
              hashrates.length = 0;
            }
          }
        }

        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 1) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const weeksPerSeconds = Math.max(1, Math.round(indexedThisRun / elapsedSeconds));
          const progress = Math.round(totalIndexed / totalWeekIndexed * 10000) / 100;
          const formattedDate = new Date(fromTimestamp).toUTCString();
          logger.debug(`Getting weekly pool hashrate for ${formattedDate} | ~${weeksPerSeconds.toFixed(2)} weeks/sec | total: ~${totalIndexed}/${Math.round(totalWeekIndexed)} (${progress}%) | elapsed: ${runningFor} seconds`, logger.tags.mining);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
          loadingIndicators.setProgress('weekly-hashrate-indexing', progress, false);
        }

        toTimestamp -= 604800000;
        ++indexedThisRun;
        ++totalIndexed;
      }
      this.lastWeeklyHashrateIndexingDate = new Date().getUTCDate();
      if (newlyIndexed > 0) {
        logger.info(`Weekly mining pools hashrates indexing completed: indexed ${newlyIndexed} weeks`, logger.tags.mining);
      } else {
        logger.debug(`Weekly mining pools hashrates indexing completed: indexed ${newlyIndexed} weeks`, logger.tags.mining);
      }
      loadingIndicators.setProgress('weekly-hashrate-indexing', 100);
    } catch (e) {
      loadingIndicators.setProgress('weekly-hashrate-indexing', 100);
      logger.err(`Weekly mining pools hashrates indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
      throw e;
    }
  }

  /**
   * Generate daily hashrate data
   * @asyncUnsafe
   */
  public async $generateNetworkHashrateHistory(): Promise<void> {
    // If a re-index was requested, truncate first
    if (this.reindexHashrateRequested === true) {
      logger.notice(`hashrates will now be re-indexed`);
      await database.query(`TRUNCATE hashrates`);
      this.lastHashrateIndexingDate = 0;
      this.lastWeeklyHashrateIndexingDate = null;
      this.reindexHashrateRequested = false;
    }

    // We only run this once a day around midnight
    const today = new Date().getUTCDate();
    if (today === this.lastHashrateIndexingDate) {
      logger.debug(`Network hashrate history indexing is up to date, nothing to do`, logger.tags.mining);
      return;
    }

    const oldestConsecutiveBlockTimestamp = 1000 * (await BlocksRepository.$getOldestConsecutiveBlock()).timestamp;

    try {
      const genesisData = await this.getGenesisData();
      const genesisTimestamp = genesisData.timestamp * 1000;
      const indexedTimestamp = await HashratesRepository.$getCompleteNetworkDailyHashrateTimestamps();
      const lastMidnight = this.getDateMidnight(new Date());
      let toTimestamp = Math.round(lastMidnight.getTime());
      const hashrates: HashrateRecord[] = [];

      const totalDayIndexed = (await BlocksRepository.$blockCount(null, null)) / expectedBlocksForTimespan('24h', config.MEMPOOL.BLOCK_TARGET_SPACING_SECONDS);
      let indexedThisRun = 0;
      let totalIndexed = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      logger.debug(`Indexing daily network hashrate`, logger.tags.mining);
      loadingIndicators.setProgress('daily-hashrate-indexing', 0);

      while (toTimestamp > genesisTimestamp && toTimestamp > oldestConsecutiveBlockTimestamp) {
        const fromTimestamp = toTimestamp - 86400000;

        // Skip already indexed days
        if (indexedTimestamp.includes(toTimestamp / 1000)) {
          toTimestamp -= 86400000;
          ++totalIndexed;
          continue;
        }

        const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, fromTimestamp / 1000, toTimestamp / 1000);
        let laneHashrates: QbitLaneHashrates | null = null;
        if (blockStats.blockCount === 0) {
          laneHashrates = { aggregate: 0, permissionless: 0, auxpow: 0 };
        } else {
          try {
            laneHashrates = await this.$getNetworkHashrates(blockStats.blockCount, blockStats.lastBlockHeight);
          } catch (e) {
            if (e instanceof IncompleteHashrateWindowError) {
              logger.warn(`Skipping daily hashrate period ending ${toTimestamp / 1000}: indexed blocks do not contain its complete anchored window`, logger.tags.mining);
            } else {
              throw e;
            }
          }
        }
        if (laneHashrates !== null) {
          hashrates.push(...this.getNetworkHashrateRecords(toTimestamp / 1000, laneHashrates));
        }

        if (hashrates.length > 10) {
          newlyIndexed += hashrates.length / 3;
          await HashratesRepository.$saveHashrates(hashrates);
          hashrates.length = 0;
        }

        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 1) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const daysPerSeconds = Math.max(1, Math.round(indexedThisRun / elapsedSeconds));
          const progress = Math.round(totalIndexed / totalDayIndexed * 10000) / 100;
          const formattedDate = new Date(fromTimestamp).toUTCString();
          logger.debug(`Getting network daily hashrate for ${formattedDate} | ~${daysPerSeconds.toFixed(2)} days/sec | total: ~${totalIndexed}/${Math.round(totalDayIndexed)} (${progress}%) | elapsed: ${runningFor} seconds`, logger.tags.mining);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
          loadingIndicators.setProgress('daily-hashrate-indexing', progress);
        }

        toTimestamp -= 86400000;
        ++indexedThisRun;
        ++totalIndexed;
      }

      // Add genesis block manually
      if (config.MEMPOOL.INDEXING_BLOCKS_AMOUNT === -1 && !indexedTimestamp.includes(genesisTimestamp / 1000)) {
        try {
          const genesisHashrates = await this.$getNetworkHashrates(1, 1);
          hashrates.push(...this.getNetworkHashrateRecords(genesisTimestamp / 1000, genesisHashrates));
        } catch (e) {
          if (e instanceof IncompleteHashrateWindowError) {
            logger.warn('Skipping genesis hashrate: indexed blocks do not contain heights 0 and 1', logger.tags.mining);
          } else {
            throw e;
          }
        }
      }

      newlyIndexed += hashrates.length / 3;
      await HashratesRepository.$saveHashrates(hashrates);

      this.lastHashrateIndexingDate = new Date().getUTCDate();
      if (newlyIndexed > 0) {
        logger.info(`Daily network hashrate indexing completed: indexed ${newlyIndexed} days`, logger.tags.mining);
      } else {
        logger.debug(`Daily network hashrate indexing completed: indexed ${newlyIndexed} days`, logger.tags.mining);
      }
      loadingIndicators.setProgress('daily-hashrate-indexing', 100);
    } catch (e) {
      loadingIndicators.setProgress('daily-hashrate-indexing', 100);
      logger.err(`Daily network hashrate indexing failed. Trying again later. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
      throw e;
    }
  }

  /**
   * Get the observed spacing between consecutive blocks over an interval.
   * Large windows are averaged into fixed-size height buckets to bound the
   * response size.
   * @asyncSafe
   */
  public async $getBlockSpacing(interval: string | null, maxPoints: number = 2000): Promise<{ height: number, timestamp: number, spacingSeconds: number }[]> {
    const blocks = await BlocksRepository.$getBlockTimes(interval);

    const spacings: { height: number, timestamp: number, spacingSeconds: number }[] = [];
    for (let i = 1; i < blocks.length; i++) {
      // only measure consecutive heights: gaps in the index would show up as bogus spacings
      if (blocks[i].height === blocks[i - 1].height + 1) {
        spacings.push({
          height: blocks[i].height,
          timestamp: blocks[i].timestamp,
          // block timestamps are not strictly monotonic (miner clock skew); clamp
          // artifacts to zero instead of charting negative spacings
          spacingSeconds: Math.max(0, blocks[i].timestamp - blocks[i - 1].timestamp),
        });
      }
    }

    if (spacings.length <= maxPoints) {
      return spacings;
    }

    const bucketSize = Math.ceil(spacings.length / maxPoints);
    const bucketed: { height: number, timestamp: number, spacingSeconds: number }[] = [];
    for (let i = 0; i < spacings.length; i += bucketSize) {
      const bucket = spacings.slice(i, i + bucketSize);
      bucketed.push({
        height: bucket[bucket.length - 1].height,
        timestamp: bucket[bucket.length - 1].timestamp,
        spacingSeconds: Math.round((bucket.reduce((sum, spacing) => sum + spacing.spacingSeconds, 0) / bucket.length) * 100) / 100,
      });
    }
    return bucketed;
  }

  /**
   * Create a link between blocks and the latest price at when they were mined
   *
   * @asyncSafe
   */
  public async $indexBlockPrices(): Promise<void> {
    if (this.blocksPriceIndexingRunning === true) {
      return;
    }
    this.blocksPriceIndexingRunning = true;

    let totalInserted = 0;
    try {
      const prices: any[] = await PricesRepository.$getPricesTimesAndId();
      const blocksWithoutPrices: any[] = await BlocksRepository.$getBlocksWithoutPrice();

      const blocksPrices: BlockPrice[] = [];

      for (const block of blocksWithoutPrices) {
        // Quick optimisation, out mtgox feed only goes back to 2010-07-19 02:00:00, so skip the first 68951 blocks
        if (['mainnet', 'testnet'].includes(config.MEMPOOL.NETWORK) && block.height < 68951) {
          blocksPrices.push({
            height: block.height,
            priceId: prices[0].id,
          });
          continue;
        }
        for (const price of prices) {
          if (block.timestamp < price.time) {
            blocksPrices.push({
              height: block.height,
              priceId: price.id,
            });
            break;
          };
        }

        if (blocksPrices.length >= 100000) {
          totalInserted += blocksPrices.length;
          let logStr = `Linking ${blocksPrices.length} blocks to their closest price`;
          if (blocksWithoutPrices.length > 200000) {
            logStr += ` | Progress ${Math.round(totalInserted / blocksWithoutPrices.length * 100)}%`;
          }
          logger.debug(logStr, logger.tags.mining);
          await BlocksRepository.$saveBlockPrices(blocksPrices);
          blocksPrices.length = 0;
        }
      }

      if (blocksPrices.length > 0) {
        totalInserted += blocksPrices.length;
        let logStr = `Linking ${blocksPrices.length} blocks to their closest price`;
        if (blocksWithoutPrices.length > 200000) {
          logStr += ` | Progress ${Math.round(totalInserted / blocksWithoutPrices.length * 100)}%`;
        }
        logger.debug(logStr, logger.tags.mining);
        await BlocksRepository.$saveBlockPrices(blocksPrices);
      }
    } catch (e) {
      this.blocksPriceIndexingRunning = false;
      logger.err(`Cannot index block prices. ${e}`);
    }

    if (totalInserted > 0) {
      logger.info(`Indexing blocks prices completed. Indexed ${totalInserted}`, logger.tags.mining);
    } else {
      logger.debug(`Indexing blocks prices completed. Indexed 0.`, logger.tags.mining);
    }

    this.blocksPriceIndexingRunning = false;
  }

  /**
   * Index core coinstatsindex
   *
   * @asyncUnsafe
   */
  public async $indexCoinStatsIndex(): Promise<void> {
    let timer = new Date().getTime() / 1000;
    let totalIndexed = 0;

    const blockchainInfo = await bitcoinClient.getBlockchainInfo();
    let currentBlockHeight = blockchainInfo.blocks;

    while (currentBlockHeight > 0) {
      const indexedBlocks = await BlocksRepository.$getBlocksMissingCoinStatsIndex(
        currentBlockHeight, currentBlockHeight - 10000);

      for (const block of indexedBlocks) {
        const txoutset = await bitcoinClient.getTxoutSetinfo('none', block.height);
        await BlocksRepository.$updateCoinStatsIndexData(block.hash, txoutset.txouts,
          Math.round(txoutset.block_info.prevout_spent * 100000000));
        ++totalIndexed;

        const elapsedSeconds = Math.max(1, new Date().getTime() / 1000 - timer);
        if (elapsedSeconds > 5) {
          logger.info(`Indexing coinstatsindex data for block #${block.height}. Indexed ${totalIndexed} blocks.`, logger.tags.mining);
          timer = new Date().getTime() / 1000;
        }
      }

      currentBlockHeight -= 10000;
    }

    if (totalIndexed > 0) {
      logger.info(`Indexing missing coinstatsindex data completed. Indexed ${totalIndexed}`, logger.tags.mining);
    } else {
      logger.debug(`Indexing missing coinstatsindex data completed. Indexed 0.`, logger.tags.mining);
    }
  }

  /**
   * List existing mining pools
   * @asyncUnsafe
   */
  public async $listPools(): Promise<{name: string, slug: string, unique_id: number}[] | null> {
    const [rows] = await database.query(`
      SELECT
        name,
        slug,
        unique_id
      FROM pools`
    );
    return rows as {name: string, slug: string, unique_id: number}[];
  }

  private getDateMidnight(date: Date): Date {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);

    return date;
  }

  private getTimeRange(interval: string | null, scale = 1): number {
    switch (interval) {
      case '4y': return 43200 * scale; // 12h
      case '3y': return 43200 * scale; // 12h
      case '2y': return 28800 * scale; // 8h
      case '1y': return 28800 * scale; // 8h
      case '6m': return 10800 * scale; // 3h
      case '3m': return 7200 * scale; // 2h
      case '1m': return 1800 * scale; // 30min
      case '1w': return 300 * scale; // 5min
      case '3d': return 1 * scale;
      case '24h': return 1 * scale;
      default: return 86400 * scale;
    }
  }

  private getTimeRangeFromTimespan(from: number, to: number, scale = 1): number {
    const timespan = to - from;
    switch (true) {
      case timespan > 3600 * 24 * 365 * 4: return 86400 * scale; // 24h
      case timespan > 3600 * 24 * 365 * 3: return 43200 * scale; // 12h
      case timespan > 3600 * 24 * 365 * 2: return 43200 * scale; // 12h
      case timespan > 3600 * 24 * 365: return 28800 * scale; // 8h
      case timespan > 3600 * 24 * 30 * 6: return 28800 * scale; // 8h
      case timespan > 3600 * 24 * 30 * 3: return 10800 * scale; // 3h
      case timespan > 3600 * 24 * 30: return 7200 * scale; // 2h
      case timespan > 3600 * 24 * 7: return 1800 * scale; // 30min
      case timespan > 3600 * 24 * 3: return 300 * scale; // 5min
      case timespan > 3600 * 24: return 1 * scale;
      default: return 1 * scale;
    }
  }

  private getNetworkHashrateRecords(timestamp: number, hashrates: QbitLaneHashrates): HashrateRecord[] {
    const permissionlessShare = hashrates.aggregate > 0 ? hashrates.permissionless / hashrates.aggregate : 0;
    const auxpowShare = hashrates.aggregate > 0 ? hashrates.auxpow / hashrates.aggregate : 0;

    return [
      {
        hashrateTimestamp: timestamp,
        avgHashrate: hashrates.aggregate,
        poolId: 0,
        share: 1,
        type: 'daily',
        lane: 'aggregate',
      },
      {
        hashrateTimestamp: timestamp,
        avgHashrate: hashrates.permissionless,
        poolId: 0,
        share: permissionlessShare,
        type: 'daily',
        lane: 'permissionless',
      },
      {
        hashrateTimestamp: timestamp,
        avgHashrate: hashrates.auxpow,
        poolId: 0,
        share: auxpowShare,
        type: 'daily',
        lane: 'auxpow',
      },
    ];
  }


  /** @asyncUnsafe */
  private async getGenesisData(): Promise<{timestamp: number, bits: number, difficulty: number}> {
    if (this.genesisData == null) {
      const genesisBlock: IEsploraApi.Block = await bitcoinApi.$getBlock(await bitcoinApi.$getBlockHash(0));
      this.genesisData = {
        timestamp: genesisBlock.timestamp,
        bits: genesisBlock.bits,
        difficulty: genesisBlock.difficulty,
      };
    }
    return this.genesisData;
  }
}

export default new Mining();
