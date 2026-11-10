import config from '../../config';
import { Common } from '../../api/common';
import loadingIndicators from '../../api/loading-indicators';
import redisCache from '../../api/redis-cache';
import transactionUtils from '../../api/transaction-utils';
import logger from '../../logger';
import { MempoolTransactionExtended, TransactionFlags } from '../../mempool.interfaces';

// testSetup.ts mocks the mempool module for every suite
const memPool = jest.requireActual('../../api/mempool').default;

describe('Mempool', () => {
  describe('$setMempool', () => {
    // a P2MR qscription reveal, qbit mainnet 2de5d758…adac8 (see the qbit P2MR qscriptions tests in common.ts)
    const { etching } = require('./test-data/qbit-p2mr-qscriptions.json');
    const cacheEnabled = config.MEMPOOL.CACHE_ENABLED;
    const redisEnabled = config.REDIS.ENABLED;

    // 1.0.0 had no P2MR qscription detection, and its disk cache kept the flags it computed
    const fromOlderRelease = (txid?: string): MempoolTransactionExtended => {
      const tx: MempoolTransactionExtended = JSON.parse(JSON.stringify(etching));
      tx.flags = Number(BigInt(Common.getTransactionFlags({ ...tx })) & ~TransactionFlags.inscription);
      if (txid) {
        tx.txid = txid;
      }
      return tx;
    };

    afterEach(async () => {
      jest.restoreAllMocks();
      config.MEMPOOL.CACHE_ENABLED = cacheEnabled;
      config.REDIS.ENABLED = redisEnabled;
      await memPool.$setMempool({});
    });

    test('reclassifies transactions restored with flags from an older release', async () => {
      const tx = fromOlderRelease();

      await memPool.$setMempool({ [tx.txid]: tx });

      const flags = BigInt(memPool.getMempool()[tx.txid].flags);
      expect(flags & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
      expect(flags & TransactionFlags.p2mr).toBe(TransactionFlags.p2mr);
    });

    test('keeps the cached flags of a transaction it cannot reclassify, and restores the rest', async () => {
      const broken = fromOlderRelease('00'.repeat(32));
      const good = fromOlderRelease();
      const reclassify = Common.getTransactionFlags.bind(Common);
      jest.spyOn(Common, 'getTransactionFlags').mockImplementation((tx, height) => {
        if (tx.txid === broken.txid) {
          throw new Error('unreadable witness');
        }
        return reclassify(tx, height);
      });

      await memPool.$setMempool({ [broken.txid]: broken, [good.txid]: good });

      const restored = memPool.getMempool();
      expect(restored[broken.txid].flags).toBe(broken.flags);
      expect(BigInt(restored[good.txid].flags) & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
    });

    test('hands Redis the reclassified flags', async () => {
      config.MEMPOOL.CACHE_ENABLED = true;
      config.REDIS.ENABLED = true;
      const seen: number[] = [];
      jest.spyOn(redisCache, '$addTransaction').mockImplementation(async (tx: MempoolTransactionExtended) => {
        seen.push(tx.flags as number);
      });
      jest.spyOn(redisCache, '$flushTransactions').mockResolvedValue(undefined);
      const tx = fromOlderRelease();

      await memPool.$setMempool({ [tx.txid]: tx });

      expect(seen).toHaveLength(1);
      expect(BigInt(seen[0]) & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
    });
  });

  describe('$updateMempool stall warning', () => {
    // a transaction the mempool cache doesn't have, so the run fetches it
    const txid = 'ab'.repeat(32);
    const stallWarnings = (): unknown[][] => jest.mocked(logger.err).mock.calls.filter(([msg]) => String(msg).includes('$updateMempool stalled'));
    // what a run changes on the Mempool it runs on, and the loading indicator it sets
    const runState = (mempool): string => JSON.stringify({
      cache: mempool.getMempool(),
      latestTransactions: mempool.latestTransactions,
      recentlyDeleted: mempool.recentlyDeleted,
      mempoolCacheDelta: mempool.mempoolCacheDelta,
      inSync: mempool.inSync,
      missingTxCount: mempool.missingTxCount,
      timer: mempool.timer,
      mempoolProtection: mempool.mempoolProtection,
      loadingIndicators: loadingIndicators.getLoadingIndicators(),
    });
    let sharedState: string;
    let pool;

    beforeAll(() => {
      sharedState = runState(memPool);
    });

    beforeEach(() => {
      jest.mocked(logger.err).mockClear();
      jest.useFakeTimers();
      // a Mempool of its own, so the runs leave the shared one as it was. Its
      // transactions-per-second interval runs on the fake timers.
      pool = new memPool.constructor();
      jest.spyOn(loadingIndicators, 'setProgress').mockImplementation(() => undefined);
    });

    afterEach(() => {
      pool.destroy();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test('is not logged for a run that failed', async () => {
      // with MEMPOOL.BACKEND=esplora, the fetch throws while qbit-electrs is unavailable
      jest.spyOn(transactionUtils, '$getMempoolTransactionsExtended').mockRejectedValue(new Error('qbit-electrs unavailable'));

      await expect(pool.$updateMempool([txid], null, null, -1, 2000)).rejects.toThrow('qbit-electrs unavailable');
      jest.advanceTimersByTime(3 * 60 * 1000);

      expect(stallWarnings()).toEqual([]);
    });

    test('is logged for a run that has not ended after two minutes', async () => {
      let release: (txs: MempoolTransactionExtended[]) => void = () => undefined;
      jest.spyOn(transactionUtils, '$getMempoolTransactionsExtended').mockReturnValue(new Promise((resolve) => {
        release = resolve;
      }));

      const run = pool.$updateMempool([txid], null, null, -1, 2000);
      jest.advanceTimersByTime(2 * 60 * 1000 + 1);

      expect(stallWarnings()).toEqual([['$updateMempool stalled at "got raw mempool"']]);
      release([]);
      await run;
    });

    test('leaves the shared Mempool and the loading indicators as they were', () => {
      expect(runState(memPool)).toBe(sharedState);
    });
  });
});
