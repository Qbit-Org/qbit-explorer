import {
  calcBitsDifference,
  calcQbitDifficultyState,
  bitsToTargetHex,
  QbitDifficultyState,
} from '../../api/difficulty-adjustment';

const TARGET_SPACING_MS = 60_000;

describe('qbit Difficulty State (ASERT)', () => {
  test('should compute a steady-state difficulty payload', () => {
    const tipTimestamp = 1752192000;
    const result = calcQbitDifficultyState(
      { height: 10000, timestamp: tipTimestamp, bits: 0x1d00ffff, difficulty: 1.5 },
      { height: 9940, timestamp: tipTimestamp - 3600 }, // 60 blocks in exactly 1h
      { height: 8560, bits: 0x1d00ffff },               // same difficulty 24h ago
      TARGET_SPACING_MS,
    );

    expect(result).toStrictEqual({
      asertActive: true,
      currentBits: 0x1d00ffff,
      currentTarget: '00000000ffff0000000000000000000000000000000000000000000000000000',
      currentDifficulty: 1.5,
      timeAvgMs: 60_000,
      targetSpacingMs: 60_000,
      change24h: 0,
      previousTime: tipTimestamp * 1000,
      timeAvg: 60_000,
      adjustedTimeAvg: 60_000,
      timeOffset: 0,
      lanes: null,
    } as QbitDifficultyState);
  });

  test('should report fast blocks and a rising difficulty', () => {
    const tipTimestamp = 1752192000;
    const result = calcQbitDifficultyState(
      { height: 10000, timestamp: tipTimestamp, bits: 0x1d000100, difficulty: 100 },
      { height: 9940, timestamp: tipTimestamp - 2700 }, // 60 blocks in 45 minutes
      { height: 8560, bits: 0x1d000200 },               // target halved over 24h
      TARGET_SPACING_MS,
    );

    expect(result.timeAvgMs).toEqual(45_000);
    expect(result.timeAvg).toEqual(45_000);
    expect(result.adjustedTimeAvg).toEqual(45_000);
    expect(result.change24h).toEqual(100);
  });

  test('should average over the real anchor distance when the anchor lags', () => {
    const tipTimestamp = 1752192000;
    const result = calcQbitDifficultyState(
      { height: 10000, timestamp: tipTimestamp, bits: 0x1d00ffff, difficulty: 1 },
      { height: 9880, timestamp: tipTimestamp - 9600 }, // stale anchor: 120 blocks, 80s each
      { height: 8560, bits: 0x1d00ffff },
      TARGET_SPACING_MS,
    );

    expect(result.timeAvgMs).toEqual(80_000);
  });

  test('should fall back to the target spacing without a usable spacing anchor', () => {
    const tipTimestamp = 1752192000;
    const tip = { height: 0, timestamp: tipTimestamp, bits: 0x1d00ffff, difficulty: 1 };

    // no anchors at all (e.g. right after startup)
    const noAnchors = calcQbitDifficultyState(tip, null, null, TARGET_SPACING_MS);
    expect(noAnchors.timeAvgMs).toEqual(60_000);
    expect(noAnchors.change24h).toEqual(0);

    // genesis-only chain: both anchors point at the tip itself
    const genesisOnly = calcQbitDifficultyState(
      tip,
      { height: 0, timestamp: tipTimestamp },
      { height: 0, bits: 0x1d00ffff },
      TARGET_SPACING_MS,
    );
    expect(genesisOnly.timeAvgMs).toEqual(60_000);
    expect(genesisOnly.change24h).toEqual(0);

    // non-monotonic timestamps produce a nonsense window
    const skewed = calcQbitDifficultyState(
      { height: 10000, timestamp: tipTimestamp, bits: 0x1d00ffff, difficulty: 1 },
      { height: 9940, timestamp: tipTimestamp + 600 },
      null,
      TARGET_SPACING_MS,
    );
    expect(skewed.timeAvgMs).toEqual(60_000);
  });

  test('should report a flat 24h change on unparseable bits', () => {
    const result = calcQbitDifficultyState(
      { height: 10000, timestamp: 1752192000, bits: 0x1d00ffff, difficulty: 1 },
      null,
      { height: 8560, bits: 0x00800000 }, // invalid: sign bit set
      TARGET_SPACING_MS,
    );
    expect(result.change24h).toEqual(0);
  });

  test('should expand compact bits into the full 256-bit target', () => {
    expect(bitsToTargetHex(0x1d00ffff)).toEqual(
      '00000000ffff0000000000000000000000000000000000000000000000000000'
    );
    // exponent of exactly 3: target equals the mantissa
    expect(bitsToTargetHex(0x03000100)).toEqual(
      '0000000000000000000000000000000000000000000000000000000000000100'
    );
    // exponent below 3 shifts the mantissa down
    expect(bitsToTargetHex(0x02010000)).toEqual(
      '0000000000000000000000000000000000000000000000000000000000000100'
    );
  });

  test('should calculate Difficulty change from bits fields of two blocks', () => {
    // Same exponent, unclamped in both directions
    expect(calcBitsDifference(0x1d000200, 0x1d000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000400, 0x1d000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000800, 0x1d000100)).toEqual(700);
    expect(calcBitsDifference(0x1d000100, 0x1d000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000100, 0x1d000400)).toEqual(-75);
    expect(calcBitsDifference(0x1d000100, 0x1d000800)).toEqual(-87.5);
    // Check new higher exponent
    expect(calcBitsDifference(0x1c000200, 0x1d000001)).toEqual(100);
    expect(calcBitsDifference(0x1c000400, 0x1d000001)).toEqual(300);
    expect(calcBitsDifference(0x1c000100, 0x1d000002)).toEqual(-50);
    expect(calcBitsDifference(0x1c000100, 0x1d000004)).toEqual(-75);
    // Check new lower exponent
    expect(calcBitsDifference(0x1d000002, 0x1c000100)).toEqual(100);
    expect(calcBitsDifference(0x1d000004, 0x1c000100)).toEqual(300);
    expect(calcBitsDifference(0x1d000001, 0x1c000200)).toEqual(-50);
    expect(calcBitsDifference(0x1d000001, 0x1c000400)).toEqual(-75);
    // ASERT: exponents may drift arbitrarily far apart (e.g. after a long idle
    // gap); the difference must be computed instead of throwing
    expect(calcBitsDifference(0x1d000001, 0x1a000800)).toEqual(819100);
    expect(calcBitsDifference(0x1a000800, 0x1d000001)).toEqual(-99.98779296875);
    // Check invalid inputs
    expect(() => calcBitsDifference(0x7f000001, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0, 0x1a000800)).toThrow(/Invalid bits/);
    expect(() => calcBitsDifference(100.2783, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0x00800000, 0x1a000800)).toThrow(
      /Invalid bits/
    );
    expect(() => calcBitsDifference(0x1c000000, 0x1a000800)).toThrow(
      /Invalid bits/
    );
  });
});

describe('qbit per-lane difficulty state', () => {
  const TIP_TIMESTAMP = 1752192000;
  const tip = { height: 10000, timestamp: TIP_TIMESTAMP, bits: 0x1d00ffff, difficulty: 1.5 };
  const spacingAnchor = { height: 9940, timestamp: TIP_TIMESTAMP - 3600 };
  const chainDayAnchor = { height: 8560, bits: 0x1d00ffff };

  const laneAnchors = {
    permissionless: {
      latest: { height: 10000, timestamp: TIP_TIMESTAMP, bits: 0x1d000100, difficulty: 5000 },
      dayAgo: { height: 8560, bits: 0x1d000200 },
    },
    auxpow: {
      latest: { height: 9999, timestamp: TIP_TIMESTAMP - 90, bits: 0x1a000400, difficulty: 4_000_000_000 },
      dayAgo: { height: 8559, bits: 0x1a000800 },
    },
  };

  test('should describe each lane from its own anchors and pin the headline to the permissionless lane', () => {
    const result = calcQbitDifficultyState(tip, spacingAnchor, chainDayAnchor, TARGET_SPACING_MS, laneAnchors);

    expect(result.lanes).not.toBeNull();
    expect(result.lanes?.permissionless).toStrictEqual({
      difficulty: 5000,
      bits: 0x1d000100,
      target: bitsToTargetHex(0x1d000100),
      height: 10000,
      timestamp: TIP_TIMESTAMP,
      change24h: 100, // target halved over 24h within the lane
    });
    expect(result.lanes?.auxpow).toStrictEqual({
      difficulty: 4_000_000_000,
      bits: 0x1a000400,
      target: bitsToTargetHex(0x1a000400),
      height: 9999,
      timestamp: TIP_TIMESTAMP - 90,
      change24h: 100,
    });

    // headline must not flip-flop with the tip block's lane
    expect(result.currentDifficulty).toEqual(5000);
    expect(result.currentBits).toEqual(0x1d000100);
    expect(result.currentTarget).toEqual(bitsToTargetHex(0x1d000100));
    expect(result.change24h).toEqual(100);
    // chain-wide fields keep describing the actual tip
    expect(result.previousTime).toEqual(TIP_TIMESTAMP * 1000);
    expect(result.timeAvgMs).toEqual(60_000);
  });

  test('should report null lane state and change24h while a lane lacks history', () => {
    const result = calcQbitDifficultyState(tip, spacingAnchor, chainDayAnchor, TARGET_SPACING_MS, {
      permissionless: {
        latest: { height: 10000, timestamp: TIP_TIMESTAMP, bits: 0x1d000100, difficulty: 5000 },
        dayAgo: null, // lane younger than 24h
      },
      auxpow: { latest: null, dayAgo: null }, // lane has not mined yet
    });

    expect(result.lanes?.permissionless?.change24h).toBeNull();
    expect(result.lanes?.auxpow).toBeNull();
    // legacy consumers still get a number
    expect(result.change24h).toEqual(0);
    expect(result.currentDifficulty).toEqual(5000);
  });

  test('should fall back to the tip block when only the auxpow lane exists', () => {
    const result = calcQbitDifficultyState(tip, spacingAnchor, chainDayAnchor, TARGET_SPACING_MS, {
      permissionless: { latest: null, dayAgo: null },
      auxpow: {
        latest: { height: 10000, timestamp: TIP_TIMESTAMP, bits: 0x1a000400, difficulty: 4_000_000_000 },
        dayAgo: null,
      },
    });

    // no permissionless lane to pin to: headline falls back to the raw tip
    expect(result.currentDifficulty).toEqual(1.5);
    expect(result.currentBits).toEqual(0x1d00ffff);
    expect(result.lanes?.auxpow?.difficulty).toEqual(4_000_000_000);
  });

  test('should report a zero lane change when the lane has been idle for over 24h', () => {
    const result = calcQbitDifficultyState(tip, spacingAnchor, chainDayAnchor, TARGET_SPACING_MS, {
      permissionless: {
        latest: { height: 9000, timestamp: TIP_TIMESTAMP - 90000, bits: 0x1d000100, difficulty: 5000 },
        dayAgo: { height: 9000, bits: 0x1d000100 }, // same block: nothing newer than 24h
      },
      auxpow: { latest: null, dayAgo: null },
    });

    expect(result.lanes?.permissionless?.change24h).toEqual(0);
  });
});
