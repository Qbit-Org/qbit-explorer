export const QBIT_SATS_PER_QBT = 100_000_000n;
export const QBIT_SUBSIDY_INITIAL_SAT = 21_000_000_000n;
export const QBIT_SUBSIDY_STEPDOWN_NUMERATOR = 598n;
export const QBIT_SUBSIDY_STEPDOWN_DENOMINATOR = 625n;
export const QBIT_SUBSIDY_STEP_INTERVAL = 43_200;
export const QBIT_SUBSIDY_STEP_INTERVAL_REGTEST = 150;
export const QBIT_MAX_SUPPLY_QBT = 210_000_000;
export const QBIT_MAX_SUPPLY_SAT = 21_000_000_000_000_000n;
export const QBIT_SUBSIDY_STEPDOWN_PERCENT =
  Number(QBIT_SUBSIDY_STEPDOWN_NUMERATOR - QBIT_SUBSIDY_STEPDOWN_DENOMINATOR) / Number(QBIT_SUBSIDY_STEPDOWN_DENOMINATOR) * 100;

export interface QbitSupplyPoint {
  height: number;
  subsidySat: bigint;
  cumulativeSupplySat: bigint;
}

function normalizedHeight(height: number): number {
  return Number.isFinite(height) ? Math.floor(height) : 0;
}

function normalizedStepInterval(stepInterval: number): number {
  return Number.isFinite(stepInterval) && stepInterval > 0 ? Math.floor(stepInterval) : QBIT_SUBSIDY_STEP_INTERVAL;
}

export function getStepdownIndex(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): number {
  const safeHeight = normalizedHeight(height);
  if (safeHeight < 0) {
    return 0;
  }
  return Math.floor(safeHeight / normalizedStepInterval(stepInterval));
}

export function getQbitSubsidyStepInterval(network = ''): number {
  return network === 'regtest' ? QBIT_SUBSIDY_STEP_INTERVAL_REGTEST : QBIT_SUBSIDY_STEP_INTERVAL;
}

export function getQbitSubsidySat(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): bigint {
  if (normalizedHeight(height) < 0) {
    return 0n;
  }

  let subsidy = QBIT_SUBSIDY_INITIAL_SAT;
  const stepdownIndex = getStepdownIndex(height, stepInterval);
  for (let step = 0; step < stepdownIndex && subsidy > 0n; step++) {
    subsidy = (subsidy * QBIT_SUBSIDY_STEPDOWN_NUMERATOR) / QBIT_SUBSIDY_STEPDOWN_DENOMINATOR;
  }
  return subsidy;
}

export function getNextStepdownHeight(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): number {
  return (getStepdownIndex(height, stepInterval) + 1) * normalizedStepInterval(stepInterval);
}

export function getBlocksUntilNextStepdown(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): number {
  const safeHeight = Math.max(0, normalizedHeight(height));
  return getNextStepdownHeight(safeHeight, stepInterval) - safeHeight;
}

export function getCumulativeSupplySat(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): bigint {
  let remainingBlocks = BigInt(Math.max(0, normalizedHeight(height)));
  const blocksPerStep = BigInt(normalizedStepInterval(stepInterval));
  let subsidy = QBIT_SUBSIDY_INITIAL_SAT;
  let cumulativeSupply = 0n;

  while (remainingBlocks > 0n && subsidy > 0n) {
    const blocksAtSubsidy = remainingBlocks > blocksPerStep ? blocksPerStep : remainingBlocks;
    cumulativeSupply += subsidy * blocksAtSubsidy;
    remainingBlocks -= blocksAtSubsidy;
    subsidy = (subsidy * QBIT_SUBSIDY_STEPDOWN_NUMERATOR) / QBIT_SUBSIDY_STEPDOWN_DENOMINATOR;
  }

  return cumulativeSupply > QBIT_MAX_SUPPLY_SAT ? QBIT_MAX_SUPPLY_SAT : cumulativeSupply;
}

export function getCumulativeSupplyThroughHeightSat(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): bigint {
  const safeHeight = normalizedHeight(height);
  if (safeHeight < 0) {
    return 0n;
  }
  return getCumulativeSupplySat(safeHeight + 1, stepInterval);
}

export function getFirstZeroSubsidyHeight(stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): number {
  const safeStepInterval = normalizedStepInterval(stepInterval);
  let subsidy = QBIT_SUBSIDY_INITIAL_SAT;
  let step = 0;
  while (subsidy > 0n) {
    subsidy = (subsidy * QBIT_SUBSIDY_STEPDOWN_NUMERATOR) / QBIT_SUBSIDY_STEPDOWN_DENOMINATOR;
    step++;
  }
  return step * safeStepInterval;
}

export function getTerminalSupplySat(stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): bigint {
  return getCumulativeSupplySat(getFirstZeroSubsidyHeight(stepInterval), stepInterval);
}

export function getRemainingScheduledSupplyThroughHeightSat(height: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): bigint {
  const remaining = getTerminalSupplySat(stepInterval) - getCumulativeSupplyThroughHeightSat(height, stepInterval);
  return remaining > 0n ? remaining : 0n;
}

export function buildSupplyCurve(maxHeight: number, stepInterval = QBIT_SUBSIDY_STEP_INTERVAL): QbitSupplyPoint[] {
  const safeMaxHeight = Math.max(0, normalizedHeight(maxHeight));
  const safeStepInterval = normalizedStepInterval(stepInterval);
  const points: QbitSupplyPoint[] = [];

  for (let height = 0; height <= safeMaxHeight; height += safeStepInterval) {
    points.push({
      height,
      subsidySat: getQbitSubsidySat(height, safeStepInterval),
      cumulativeSupplySat: getCumulativeSupplySat(height, safeStepInterval),
    });
  }

  if (points[points.length - 1]?.height !== safeMaxHeight) {
    points.push({
      height: safeMaxHeight,
      subsidySat: getQbitSubsidySat(safeMaxHeight, safeStepInterval),
      cumulativeSupplySat: getCumulativeSupplySat(safeMaxHeight, safeStepInterval),
    });
  }

  return points;
}
