import {
  QBIT_MAX_SUPPLY_SAT,
  QBIT_SUBSIDY_INITIAL_SAT,
  QBIT_SUBSIDY_STEP_INTERVAL,
  QBIT_SUBSIDY_STEP_INTERVAL_REGTEST,
  buildSupplyCurve,
  getBlocksUntilNextStepdown,
  getCumulativeSupplySat,
  getCumulativeSupplyThroughHeightSat,
  getFirstZeroSubsidyHeight,
  getNextStepdownHeight,
  getQbitSubsidySat,
  getQbitSubsidyStepInterval,
  getRemainingScheduledSupplyThroughHeightSat,
  getStepdownIndex,
  getTerminalSupplySat,
} from './qbit-subsidy';

describe('qbit subsidy schedule', () => {
  it('matches qbit consensus subsidy stepdowns at representative heights', () => {
    expect(getQbitSubsidySat(-1)).toBe(0n);
    expect(getQbitSubsidySat(0)).toBe(QBIT_SUBSIDY_INITIAL_SAT);
    expect(getQbitSubsidySat(1)).toBe(QBIT_SUBSIDY_INITIAL_SAT);
    expect(getQbitSubsidySat(43_199)).toBe(QBIT_SUBSIDY_INITIAL_SAT);
    expect(getQbitSubsidySat(43_200)).toBe(20_092_800_000n);
    expect(getQbitSubsidySat(43_201)).toBe(20_092_800_000n);
    expect(getQbitSubsidySat(86_400)).toBe(19_224_791_040n);
    expect(getQbitSubsidySat(1_000_000)).toBe(7_605_120_982n);
  });

  it('reports stepdown indexes and next stepdown heights', () => {
    expect(getStepdownIndex(0)).toBe(0);
    expect(getStepdownIndex(43_199)).toBe(0);
    expect(getStepdownIndex(43_200)).toBe(1);
    expect(getNextStepdownHeight(0)).toBe(QBIT_SUBSIDY_STEP_INTERVAL);
    expect(getNextStepdownHeight(43_200)).toBe(86_400);
    expect(getBlocksUntilNextStepdown(43_199)).toBe(1);
    expect(getBlocksUntilNextStepdown(43_200)).toBe(QBIT_SUBSIDY_STEP_INTERVAL);
  });

  it('selects the regtest subsidy interval only on regtest', () => {
    expect(getQbitSubsidyStepInterval()).toBe(QBIT_SUBSIDY_STEP_INTERVAL);
    expect(getQbitSubsidyStepInterval('testnet4')).toBe(QBIT_SUBSIDY_STEP_INTERVAL);
    expect(getQbitSubsidyStepInterval('regtest')).toBe(QBIT_SUBSIDY_STEP_INTERVAL_REGTEST);
  });

  it('computes cumulative supply by completed step intervals', () => {
    expect(getCumulativeSupplySat(0)).toBe(0n);
    expect(getCumulativeSupplySat(43_200)).toBe(907_200_000_000_000n);
    expect(getCumulativeSupplySat(86_400)).toBe(1_775_208_960_000_000n);
    expect(getCumulativeSupplySat(10_000_000)).toBeLessThanOrEqual(QBIT_MAX_SUPPLY_SAT);
    expect(getCumulativeSupplySat(10_000_000)).toBeGreaterThan(getCumulativeSupplySat(1_000_000));
  });

  it('computes cumulative supply through an inclusive chain-tip height', () => {
    expect(getCumulativeSupplyThroughHeightSat(-1)).toBe(0n);
    expect(getCumulativeSupplyThroughHeightSat(0)).toBe(QBIT_SUBSIDY_INITIAL_SAT);
    expect(getCumulativeSupplyThroughHeightSat(43_199)).toBe(907_200_000_000_000n);
    expect(getCumulativeSupplyThroughHeightSat(43_200)).toBe(907_220_092_800_000n);
  });

  it('finds the first zero-subsidy step', () => {
    expect(getQbitSubsidySat(479 * QBIT_SUBSIDY_STEP_INTERVAL)).toBe(1n);
    expect(getQbitSubsidySat(480 * QBIT_SUBSIDY_STEP_INTERVAL)).toBe(0n);
    expect(getFirstZeroSubsidyHeight()).toBe(20_736_000);
  });

  it('tracks terminal scheduled supply separately from the max cap', () => {
    expect(getTerminalSupplySat()).toBe(20_999_999_761_876_800n);
    expect(getTerminalSupplySat()).toBeLessThan(QBIT_MAX_SUPPLY_SAT);
    expect(getRemainingScheduledSupplyThroughHeightSat(-1)).toBe(getTerminalSupplySat());
    expect(getRemainingScheduledSupplyThroughHeightSat(20_736_000)).toBe(0n);
  });

  it('builds a supply curve with step boundaries and a final point', () => {
    const curve = buildSupplyCurve(100_000);
    expect(curve.map(point => point.height)).toEqual([0, 43_200, 86_400, 100_000]);
    expect(curve[0].subsidySat).toBe(QBIT_SUBSIDY_INITIAL_SAT);
    expect(curve[1].subsidySat).toBe(20_092_800_000n);
    expect(curve[3].cumulativeSupplySat).toBe(getCumulativeSupplySat(100_000));
  });
});
