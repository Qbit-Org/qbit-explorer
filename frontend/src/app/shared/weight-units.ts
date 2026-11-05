export const WITNESS_SCALE_FACTOR = 1;
export const QBIT_BLOCK_WEIGHT_UNITS = 2_000_000;
export const DEFAULT_BYTES_PER_SIGOP = 20;
export const DEFAULT_FEE_RATE_WEIGHT = vsizeToWeight(1);

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
