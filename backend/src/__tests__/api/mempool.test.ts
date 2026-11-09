import { Common } from '../../api/common';
import { MempoolTransactionExtended, TransactionFlags } from '../../mempool.interfaces';

// testSetup.ts mocks the mempool module for every suite
const memPool = jest.requireActual('../../api/mempool').default;

describe('Mempool', () => {
  describe('$setMempool', () => {
    // a P2MR qscription reveal, qbit mainnet 2de5d758…adac8 (see the qbit P2MR qscriptions tests in common.ts)
    const { etching } = require('./test-data/qbit-p2mr-qscriptions.json');

    test('reclassifies transactions restored with flags from an older release', async () => {
      const tx: MempoolTransactionExtended = JSON.parse(JSON.stringify(etching));
      // 1.0.0 had no P2MR qscription detection, and its disk cache kept the flags it computed
      tx.flags = Number(BigInt(Common.getTransactionFlags({ ...tx })) & ~TransactionFlags.inscription);

      await memPool.$setMempool({ [tx.txid]: tx });

      const flags = BigInt(memPool.getMempool()[tx.txid].flags);
      expect(flags & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
      expect(flags & TransactionFlags.p2mr).toBe(TransactionFlags.p2mr);
    });
  });
});
