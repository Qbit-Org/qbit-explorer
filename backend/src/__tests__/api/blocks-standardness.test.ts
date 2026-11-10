// Block summaries flag each transaction on its own. qbit's rules on a transaction's unconfirmed parents
// (TRUC and ephemeral dust) are checked only on /tx/preview, for a transaction qbitd hasn't seen, so a
// transaction's flags are the same wherever the explorer shows them.

jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {},
}));

// Keep this focused test from starting the pool updater and Rust GBT garbage-collection timers
// pulled in by Blocks' production dependency graph.
jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/websocket-handler', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/backend-info', () => ({
  __esModule: true,
  default: {},
}));

import blocks from '../../api/blocks';
import config from '../../config';
import { BlockSummary, TransactionExtended, TransactionFlags } from '../../mempool.interfaces';
import { anchorOutput, coinbaseTransaction, input, p2mrOutput, qbitTransaction, VectorTransaction } from '../fixtures/qbit-standardness-vectors';

const asTransaction = (tx: VectorTransaction): TransactionExtended => tx as unknown as TransactionExtended;
const nonStandard = (summary: BlockSummary): string[] => summary.transactions
  .filter(tx => BigInt(tx.flags || 0) & TransactionFlags.nonstandard)
  .map(tx => tx.txid);
const coinbase = (): TransactionExtended => asTransaction({ ...coinbaseTransaction([p2mrOutput(100_000)]), txid: 'cb'.repeat(32) });

describe('Block summaries', () => {
  const network = config.MEMPOOL.NETWORK;
  beforeEach(() => {
    config.MEMPOOL.NETWORK = 'mainnet';
  });
  afterEach(() => {
    config.MEMPOOL.NETWORK = network;
  });

  test('do not flag a zero-fee transaction whose ephemeral dust its block leaves unspent', () => {
    const parent = asTransaction({ ...qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(100_000)] }), txid: 'aa'.repeat(32) });

    expect(nonStandard(blocks.summarizeBlockTransactions('00'.repeat(32), 170_000, [coinbase(), parent]))).toStrictEqual([]);
  });

  test('do not flag a v3 transaction over 45,500 vB that spends one earlier in its block', () => {
    const parent = asTransaction({ ...qbitTransaction({ version: 3 }), txid: 'aa'.repeat(32) });
    const child = asTransaction({
      ...qbitTransaction({ version: 3, vin: [{ ...input(p2mrOutput(100_000)), txid: parent.txid }] }),
      txid: 'bb'.repeat(32),
      weight: 45_501,
    });

    expect(nonStandard(blocks.summarizeBlockTransactions('00'.repeat(32), 170_000, [coinbase(), parent, child]))).toStrictEqual([]);
  });
});
