import axios, { AxiosResponse } from 'axios';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import backendInfo from '../api/backend-info';
import logger from '../logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as crypto from 'crypto';
import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Common } from '../api/common';

export const QBIT_POOLS_SHA_PREFIX = 'qbit-';
const LEGACY_BITCOIN_POOLS_SOURCE = 'mempool/mining-pools';

// Derive the definition hash from the vendored pool set content so that any
// change to pools-qbit.json invalidates the DB marker and triggers a re-import
// (and block re-indexing) on the next update run.
export function computeQbitPoolsSha(poolsJson: any): string {
  return QBIT_POOLS_SHA_PREFIX + crypto.createHash('sha256').update(JSON.stringify(poolsJson)).digest('hex');
}

/**
 * Maintain the most recent version of pools-v2.json
 */
class PoolsUpdater {
  tag = 'PoolsUpdater';

  lastRun: number = 0;
  currentSha: string | null = null;
  poolsUrl: string = config.MEMPOOL.POOLS_JSON_URL;
  treeUrl: string = config.MEMPOOL.POOLS_JSON_TREE_URL;

  /** @asyncSafe */
  public async $startService(): Promise<void> {
    while ('Bitcoin is still alive') {
      try {
        await this.updatePoolsJson();
      } catch (e: any) {
        logger.info(`Exception ${e} in PoolsUpdater::$startService. Code: ${e.code}. Message: ${e.message}`, this.tag);
      }
      await Common.sleep$(10000);
    }
  }

  /** @asyncSafe */
  public async updatePoolsJson(): Promise<void> {
    if (config.MEMPOOL.ENABLED === false) {
      return;
    }

    const now = new Date().getTime() / 1000;
    if (now - this.lastRun < config.MEMPOOL.POOLS_UPDATE_DELAY) { // Execute the PoolsUpdate only once a week, or upon restart
      return;
    }

    this.lastRun = now;

    try {
      if (config.DATABASE.ENABLED === true) {
        this.currentSha = await this.getShaFromDb();
      }

      if (this.isPoolSourceDisabled()) {
        let qbitPoolsJson;
        try {
          qbitPoolsJson = this.loadQbitPoolsJson();
        } catch (e) {
          // The vendored pool file is required: clear the sha loaded from the
          // db so the startup guard in index.ts aborts loudly instead of
          // running with an unloadable pool definition state. Runtime update
          // ticks re-read the db marker on the next run, so this stays a
          // startup-only abort.
          this.currentSha = null;
          throw e;
        }
        const qbitPoolsSha = computeQbitPoolsSha(qbitPoolsJson);
        if (this.currentSha === qbitPoolsSha) {
          poolsParser.setMiningPools(qbitPoolsJson);
          return;
        }

        if (this.isLegacyBitcoinPoolSource()) {
          logger.warn(`Legacy Bitcoin mining-pools URL configured; importing vendored qbit pool set instead`, this.tag);
        }
        logger.info(`Mining pools source is disabled; importing vendored qbit pool set (${qbitPoolsSha})`, this.tag);
        await this.importPoolsJson(qbitPoolsJson, qbitPoolsSha);
        return;
      }

      const githubSha = await this.fetchPoolsSha(); // Fetch pools-v2.json sha from github
      if (githubSha === null) {
        return;
      }

      logger.debug(`pools-v2.json sha | Current: ${this.currentSha} | Github: ${githubSha}`, this.tag);
      if (this.currentSha !== null && this.currentSha === githubSha) {
        return;
      }

      // See backend README for more details about the mining pools update process
      if (this.currentSha !== null && // If we don't have any mining pool, download it at least once
        config.MEMPOOL.AUTOMATIC_POOLS_UPDATE !== true && // Automatic pools update is disabled
        !process.env.npm_config_update_pools // We're not manually updating mining pool
      ) {
        logger.warn(`Updated mining pools data is available (${githubSha}) but AUTOMATIC_POOLS_UPDATE is disabled`, this.tag);
        logger.info(`You can update your mining pools using the --update-pools command flag. You may want to clear your nginx cache as well if applicable`, this.tag);
        return;
      }

      const network = config.SOCKS5PROXY.ENABLED ? 'tor' : 'clearnet';
      if (this.currentSha === null) {
        logger.info(`Downloading pools-v2.json for the first time from ${this.poolsUrl} over ${network}`, this.tag);
      } else {
        logger.warn(`pools-v2.json is outdated, fetching latest from ${this.poolsUrl} over ${network}`, this.tag);
      }
      const poolsJson = await this.query(this.poolsUrl);
      if (poolsJson === undefined) {
        return;
      }
      await this.importPoolsJson(poolsJson, githubSha);

    } catch (e) {
      // fast-forward lastRun to 10 minutes before the next scheduled update
      this.lastRun = now - Math.max(config.MEMPOOL.POOLS_UPDATE_DELAY - 600, 600);
      // JSON.stringify(e) renders Error objects as '{}', hiding the message
      logger.err(`PoolsUpdater failed. Will try again in 10 minutes. Exception: ${e instanceof Error ? e.message : JSON.stringify(e)}`, this.tag);
    }
  }

  private isPoolSourceDisabled(): boolean {
    return (!this.poolsUrl?.trim() && !this.treeUrl?.trim()) || this.isLegacyBitcoinPoolSource();
  }

  private isLegacyBitcoinPoolSource(): boolean {
    return [this.poolsUrl, this.treeUrl].some((configuredUrl) => configuredUrl?.includes(LEGACY_BITCOIN_POOLS_SOURCE));
  }

  private loadQbitPoolsJson(): any {
    const candidates = [
      path.resolve(process.cwd(), 'pools-qbit.json'),
      path.resolve(__dirname, '../pools-qbit.json'),
      path.resolve(__dirname, '../../pools-qbit.json'),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    // A silent empty fallback would import an empty pool set under a
    // valid-looking content sha and wipe all existing pool attributions.
    throw new Error(`Cannot find pools-qbit.json (checked: ${candidates.join(', ')})`);
  }

  /** @asyncSafe */
  private async importPoolsJson(poolsJson: any, githubSha: string): Promise<void> {
    poolsParser.setMiningPools(poolsJson);

    if (config.DATABASE.ENABLED === false) { // Don't run db operations
      this.currentSha = githubSha;
      logger.info(`Mining pools-v2.json (${githubSha}) import completed (no database)`, this.tag);
      return;
    }

    const previousSha = this.currentSha;
    try {
      await DB.query('START TRANSACTION;');
      this.currentSha = githubSha;
      // Write the definition marker only after the migration succeeded: the
      // pooled DB.query calls are not pinned to the transaction's connection,
      // so a marker written first could persist even when a later write fails,
      // permanently skipping re-imports. With the marker last, a failed import
      // keeps the old marker and the (idempotent) migration retries later.
      await poolsParser.migratePoolsJson(githubSha);
      await this.updateDBSha(githubSha);
      await DB.query('COMMIT;');
    } catch (e) {
      this.currentSha = githubSha.startsWith(QBIT_POOLS_SHA_PREFIX) ? null : previousSha;
      logger.err(`Could not migrate mining pools, rolling back. Exception: ${JSON.stringify(e)}`, this.tag);
      try {
        await DB.query('ROLLBACK;');
      } catch (rollbackError) {
        logger.err(`Could not roll back mining pools migration. Exception: ${JSON.stringify(rollbackError)}`, this.tag);
      }
      throw e;
    }
    logger.info(`Mining pools-v2.json (${githubSha}) import completed`, this.tag);
  }

  /**
   * Fetch our latest pools-v2.json sha from the db
   */
  /** @asyncSafe */
  private async updateDBSha(githubSha: string): Promise<void> {
    if (config.DATABASE.ENABLED === true) {
      try {
        await DB.query('DELETE FROM state where name="pools_json_sha"');
        await DB.query('INSERT INTO state VALUES(?, NULL, ?)', ['pools_json_sha', githubSha]);
      } catch (e) {
        logger.err('Cannot save github pools-v2.json sha into the db. Reason: ' + (e instanceof Error ? e.message : e), this.tag);
        throw e;
      }
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from the db
   */
  public async getShaFromDb(): Promise<string | null> {
    try {
      const [rows]: any[] = await DB.query('SELECT string FROM state WHERE name="pools_json_sha"');
      return (rows.length > 0 ? rows[0].string : null);
    } catch (e) {
      logger.err('Cannot fetch pools-v2.json sha from db. Reason: ' + (e instanceof Error ? e.message : e), this.tag);
      return null;
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from github
   * @asyncUnsafe
   */
  private async fetchPoolsSha(): Promise<string | null> {
    const response = await this.query(this.treeUrl);

    if (response !== undefined) {
      for (const file of response['tree']) {
        if (file['path'] === 'pools-v2.json') {
          return file['sha'];
        }
      }
    }

    logger.err(`Cannot find "pools-v2.json" in git tree (${this.treeUrl})`, this.tag);
    return null;
  }

  /**
   * Http request wrapper
   * @asyncUnsafe
   */
  private async query(path): Promise<any[] | undefined> {
    type axiosOptions = {
      headers: {
        'User-Agent': string
      };
      timeout: number;
      httpAgent?: http.Agent;
      httpsAgent?: https.Agent;
      proxy?: false;
    };
    const setDelay = (secs: number = 1): Promise<void> => new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
    const axiosOptions: axiosOptions = {
      headers: {
        'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000
    };
    let retry = 0;

    while (retry < config.MEMPOOL.EXTERNAL_MAX_RETRY) {
      try {
        if (config.SOCKS5PROXY.ENABLED) {
          const socksOptions: any = {
            agentOptions: {
              keepAlive: true,
            },
            hostname: config.SOCKS5PROXY.HOST,
            port: config.SOCKS5PROXY.PORT
          };

          if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
            socksOptions.username = config.SOCKS5PROXY.USERNAME;
            socksOptions.password = config.SOCKS5PROXY.PASSWORD;
          } else {
            // Retry with different tor circuits https://stackoverflow.com/a/64960234
            socksOptions.username = `circuit${retry}`;
          }

          axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
          // route http:// URLs and https->http redirects through SOCKS as well
          axiosOptions.httpAgent = axiosOptions.httpsAgent;
          // stop axios from swapping the SOCKS agent for a proxy from the environment (HTTPS_PROXY, ALL_PROXY)
          axiosOptions.proxy = false;
        }

        const data: AxiosResponse = await axios.get(path, axiosOptions);
        if (data.statusText === 'error' || !data.data) {
          throw new Error(`Could not fetch data from ${path}, Error: ${data.status}`);
        }
        return data.data;
      } catch (e) {
        logger.err('Could not connect to Github. Reason: ' + (e instanceof Error ? e.message : e), this.tag);
        retry++;
      }
      await setDelay(config.MEMPOOL.EXTERNAL_RETRY_INTERVAL);
    }
    return undefined;
  }
}

export default new PoolsUpdater();
