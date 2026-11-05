import { makeBlockTemplate } from '../../api/mini-miner';
import { MempoolTransactionExtended } from '../../mempool.interfaces';
import { QBIT_BLOCK_WEIGHT_UNITS, QBIT_DEFAULT_BLOCK_RESERVED_WEIGHT } from '../../utils/weight-units';

describe('mini-miner qbit block weight policy', () => {
  function candidate(weight: number): MempoolTransactionExtended {
    return {
      txid: '00'.repeat(31) + weight.toString(16).padStart(2, '0').slice(-2),
      fee: weight,
      weight,
      sigops: 0,
      vin: [],
    } as unknown as MempoolTransactionExtended;
  }

  test('reserves qbit block weight before selecting transactions', () => {
    const fitsWithReserve = candidate(QBIT_BLOCK_WEIGHT_UNITS - QBIT_DEFAULT_BLOCK_RESERVED_WEIGHT - 1);
    const overfillsReserve = candidate(QBIT_BLOCK_WEIGHT_UNITS - QBIT_DEFAULT_BLOCK_RESERVED_WEIGHT + 1);

    expect(makeBlockTemplate([fitsWithReserve], [], 8).map(tx => tx.txid)).toEqual([fitsWithReserve.txid]);
    expect(makeBlockTemplate([overfillsReserve], [], 8)).toEqual([]);
  });
});
