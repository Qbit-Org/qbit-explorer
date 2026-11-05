import feeApi from '../../api/fee-api';
import { IBitcoinApi } from '../../api/bitcoin/bitcoin-api.interface';
const feeMempoolBlocks = require('./test-data/fee-mempool-blocks.json');


const subSatMempoolInfo: IBitcoinApi.MempoolInfo = {
  mempoolminfee: 0.000001, // 0.1 sat/vbyte
  loaded: true,
  size: 100,
  bytes: 10000,
  usage: 10000,
  total_fee: 10000,
  maxmempool: 10000,
  minrelaytxfee: 0.000001, // 0.1 sat/vbyte
};

const mempoolInfo: IBitcoinApi.MempoolInfo = {
  mempoolminfee: 0.00001,
  loaded: true,
  size: 100,
  bytes: 10000,
  usage: 10000,
  total_fee: 10000,
  maxmempool: 10000,
  minrelaytxfee: 0.00001,
};

describe('Fee API', () => {
  test('should calculate recommended fees properly for sub-sat mempool', () => {
    const fee = feeApi.calculateRecommendedFee(feeMempoolBlocks.subsat, subSatMempoolInfo);
    expect(fee.fastestFee).toBe(1);
    expect(fee.halfHourFee).toBe(1);
    expect(fee.hourFee).toBe(1);
    expect(fee.economyFee).toBe(1);
    expect(fee.minimumFee).toBe(1);
  });

  test('should calculate recommended fees properly for full but low fee mempool', () => {
    const fee = feeApi.calculateRecommendedFee(feeMempoolBlocks.lowfee, mempoolInfo);
    expect(fee.fastestFee).toBe(1);
    expect(fee.halfHourFee).toBe(1);
    expect(fee.hourFee).toBe(1);
    expect(fee.economyFee).toBe(1);
    expect(fee.minimumFee).toBe(1);
  });

  test('should calculate recommended fees properly for empty mempool', () => {
    const fee = feeApi.calculateRecommendedFee(feeMempoolBlocks.empty, mempoolInfo);
    expect(fee.fastestFee).toBe(1);
    expect(fee.halfHourFee).toBe(1);
    expect(fee.hourFee).toBe(1);
    expect(fee.economyFee).toBe(1);
    expect(fee.minimumFee).toBe(1);
  });

  test('should derive qbit fullness thresholds from 2M block capacity', () => {
    const block = {
      blockSize: 900000,
      blockVSize: 900000,
      nTx: 1000,
      totalFees: 100000,
      medianFee: 10,
      feeRange: [10, 10, 10, 10, 10, 10, 10],
    };

    const underHalfFull = feeApi.calculateRecommendedFee([block], mempoolInfo);
    expect(underHalfFull.fastestFee).toBe(1);

    const ninetyPercentFull = feeApi.calculateRecommendedFee([{ ...block, blockVSize: 1800000 }], mempoolInfo);
    expect(ninetyPercentFull.fastestFee).toBe(8);

    const justBelowNearFull = feeApi.calculateRecommendedFee([{ ...block, blockVSize: 1899999 }], mempoolInfo);
    expect(justBelowNearFull.fastestFee).toBe(9);

    const nearFull = feeApi.calculateRecommendedFee([{ ...block, blockVSize: 1900001 }], mempoolInfo);
    expect(nearFull.fastestFee).toBe(10);
  });
});
