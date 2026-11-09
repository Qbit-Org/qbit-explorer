import config from '../../config';
import { Common } from '../../api/common';
import redisCache from '../../api/redis-cache';
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
});
