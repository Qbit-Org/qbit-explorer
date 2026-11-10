export const WITNESS_SCALE_FACTOR = 1;
export const QBIT_BLOCK_WEIGHT_UNITS = 2_000_000;
export const QBIT_MAX_STANDARD_TX_WEIGHT = 400_000;
export const QBIT_DEFAULT_BLOCK_RESERVED_WEIGHT = 4_000;
export const DEFAULT_BYTES_PER_SIGOP = 20;

// qbitd's GetTransactionWeight: the size without witnesses counts WITNESS_SCALE_FACTOR - 1 more times,
// so with qbit's factor of 1, a transaction's weight is its serialized size
export function getTransactionWeight(baseSize: number, totalSize: number): number {
  return baseSize * (WITNESS_SCALE_FACTOR - 1) + totalSize;
}

export function weightToVsize(weight: number): number {
  return Math.ceil(weightToFractionalVsize(weight));
}

export function weightToFractionalVsize(weight: number): number {
  return weight / WITNESS_SCALE_FACTOR;
}

export function vsizeToWeight(vsize: number): number {
  return vsize * WITNESS_SCALE_FACTOR;
}

export function feeRatePerVsize(fee: number | undefined, weight: number): number {
  const vsize = weightToFractionalVsize(weight);
  return vsize ? ((fee || 0) / vsize) : 0;
}

export function sigopsToAdjustedVsize(sigops: number): number {
  return weightToVsize(sigops * DEFAULT_BYTES_PER_SIGOP);
}
