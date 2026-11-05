import {
  attributePoolHashrates,
  BlockForHashrate,
  calcLaneHashrate,
  calcLaneHashrates,
  calcLaneHashratesForWindow,
  sumPoolLaneWork,
} from '../../utils/qbit-lane-hashrate';

const NETWORK = 'testnet4';
const PERMISSIONLESS_VERSION = 0x2F58C000;
const AUXPOW_VERSION = 0x2F58C100;
const DIFFICULTY_ONE_BITS = 0x1d00ffff;
const DIFFICULTY_ONE_BLOCK_PROOF = 4_295_032_833;

function block(
  height: number,
  timestamp: number,
  version: number,
  bits: number = DIFFICULTY_ONE_BITS,
): BlockForHashrate {
  return { height, timestamp, version, bits };
}

describe('qbit lane hashrate', () => {
  test('converts compact target work into hashes per second for the requested lane', () => {
    const blocks = [
      block(1, 1_000, PERMISSIONLESS_VERSION),
      block(2, 1_001, AUXPOW_VERSION),
    ];

    expect(calcLaneHashrate(blocks, 'permissionless', 1_000, NETWORK)).toBe(DIFFICULTY_ONE_BLOCK_PROOF);
    expect(calcLaneHashrate(blocks, 'auxpow', 1_000, NETWORK)).toBe(DIFFICULTY_ONE_BLOCK_PROOF);
  });

  test('uses the oldest active-chain block only as an anchor and excludes its proof', () => {
    const rates = calcLaneHashratesForWindow([
      block(100, 1_000, PERMISSIONLESS_VERSION), // timing/chainwork anchor
      block(101, 1_060, PERMISSIONLESS_VERSION),
      block(102, 1_120, AUXPOW_VERSION),
    ], NETWORK);

    expect(rates.permissionless).toBe(DIFFICULTY_ONE_BLOCK_PROOF / 120);
    expect(rates.auxpow).toBe(DIFFICULTY_ONE_BLOCK_PROOF / 120);
    expect(rates.aggregate).toBe((2 * DIFFICULTY_ONE_BLOCK_PROOF) / 120);
  });

  test('uses the minimum and maximum timestamps across the common window despite clock skew', () => {
    const rates = calcLaneHashratesForWindow([
      block(200, 1_000, PERMISSIONLESS_VERSION), // excluded anchor and minimum timestamp
      block(201, 1_300, PERMISSIONLESS_VERSION), // maximum timestamp is not the last block
      block(202, 1_120, AUXPOW_VERSION),
    ], NETWORK);

    expect(rates.permissionless).toBe(DIFFICULTY_ONE_BLOCK_PROOF / 300);
    expect(rates.auxpow).toBe(DIFFICULTY_ONE_BLOCK_PROOF / 300);
  });

  test('keeps aggregate exactly additive for a synthetic 48/12 Cadence mix', () => {
    const blocks: BlockForHashrate[] = [
      block(0, 0, PERMISSIONLESS_VERSION), // excluded anchor
    ];

    for (let i = 1; i <= 60; ++i) {
      blocks.push(block(
        i,
        i * 60,
        i <= 48 ? PERMISSIONLESS_VERSION : AUXPOW_VERSION,
      ));
    }

    const rates = calcLaneHashratesForWindow(blocks, NETWORK);

    expect(rates.permissionless).toBe((48 * DIFFICULTY_ONE_BLOCK_PROOF) / 3_600);
    expect(rates.auxpow).toBe((12 * DIFFICULTY_ONE_BLOCK_PROOF) / 3_600);
    expect(rates.aggregate).toBe(rates.permissionless + rates.auxpow);
    expect(rates.permissionless / rates.auxpow).toBe(4);
  });

  test('keeps fixed-duration aggregate exactly additive across lanes', () => {
    const rates = calcLaneHashrates([
      block(1, 1_000, PERMISSIONLESS_VERSION),
      block(2, 1_100, AUXPOW_VERSION),
      block(3, 1_200, AUXPOW_VERSION),
    ], 60_000, NETWORK);

    expect(rates.aggregate).toBe(rates.permissionless + rates.auxpow);
  });

  test.each([
    0,
    0x1d000000, // zero mantissa
    0x1d80ffff, // negative compact target
    0x2200ffff, // target overflows 256 bits
    DIFFICULTY_ONE_BITS + 0.5,
  ])('treats invalid compact bits %s as zero work', (bits) => {
    const rates = calcLaneHashrates([
      block(1, 1_000, PERMISSIONLESS_VERSION, bits),
      block(2, 1_060, AUXPOW_VERSION, bits),
    ], 60_000, NETWORK);

    expect(rates).toEqual({ aggregate: 0, permissionless: 0, auxpow: 0 });
  });

  test('returns zero for empty, anchor-only, and zero-duration windows', () => {
    const zero = { aggregate: 0, permissionless: 0, auxpow: 0 };

    expect(calcLaneHashrates([], 60_000, NETWORK)).toEqual(zero);
    expect(calcLaneHashratesForWindow([], NETWORK)).toEqual(zero);
    expect(calcLaneHashratesForWindow([
      block(0, 1_000, PERMISSIONLESS_VERSION),
    ], NETWORK)).toEqual(zero);
    expect(calcLaneHashratesForWindow([
      block(0, 1_000, PERMISSIONLESS_VERSION),
      block(1, 1_000, AUXPOW_VERSION),
    ], NETWORK)).toEqual(zero);
  });

  test('rejects a block window with an indexed height gap', () => {
    expect(() => calcLaneHashratesForWindow([
      block(100, 1_000, PERMISSIONLESS_VERSION),
      block(102, 1_120, AUXPOW_VERSION),
    ], NETWORK)).toThrow('consecutive ascending block window');
  });
});

describe('attributePoolHashrates', () => {
  // mainnet-shaped rates: the AuxPoW lane is ~450x the permissionless lane
  const laneHashrates = { permissionless: 500e15, auxpow: 228e18 };

  test('should scale each pool by its share of its own lane, not its overall block share', () => {
    const estimates = attributePoolHashrates([
      { poolId: 1, permissionless: 60n, auxpow: 0n },  // permissionless-only pool
      { poolId: 2, permissionless: 20n, auxpow: 0n },
      { poolId: 3, permissionless: 0n, auxpow: 15n },  // merge-mining pool
      { poolId: 4, permissionless: 0n, auxpow: 5n },
    ], laneHashrates);

    // pool 1 mines 60% of all blocks but only permissionless work: it must
    // earn 75% of the permissionless rate, never 60% of the aggregate
    expect(estimates.get(1)).toBeCloseTo(0.75 * 500e15, -6);
    expect(estimates.get(2)).toBeCloseTo(0.25 * 500e15, -6);
    expect(estimates.get(3)).toBeCloseTo(0.75 * 228e18, -6);
    expect(estimates.get(4)).toBeCloseTo(0.25 * 228e18, -6);
  });

  test('should sum both lanes for a pool mining in each', () => {
    const estimates = attributePoolHashrates([
      { poolId: 1, permissionless: 50n, auxpow: 50n },
      { poolId: 2, permissionless: 50n, auxpow: 50n },
    ], laneHashrates);

    expect(estimates.get(1)).toBeCloseTo(0.5 * 500e15 + 0.5 * 228e18, -6);
    expect(estimates.get(2)).toBeCloseTo(0.5 * 500e15 + 0.5 * 228e18, -6);
  });

  test('estimates should sum to the aggregate network rate', () => {
    const estimates = attributePoolHashrates([
      { poolId: 1, permissionless: 10n, auxpow: 3n },
      { poolId: 2, permissionless: 7n, auxpow: 0n },
      { poolId: 3, permissionless: 0n, auxpow: 9n },
    ], laneHashrates);

    const total = [...estimates.values()].reduce((sum, rate) => sum + rate, 0);
    expect(total).toBeCloseTo(laneHashrates.permissionless + laneHashrates.auxpow, -6);
  });

  test('should attribute nothing from an empty lane', () => {
    const estimates = attributePoolHashrates([
      { poolId: 1, permissionless: 10n, auxpow: 0n },
    ], laneHashrates);

    // no auxpow blocks at all: its rate cannot be attributed to anyone
    expect(estimates.get(1)).toBeCloseTo(laneHashrates.permissionless, -6);
  });

  test('should return zeroes when there are no blocks', () => {
    const estimates = attributePoolHashrates([
      { poolId: 1, permissionless: 0n, auxpow: 0n },
    ], laneHashrates);

    expect(estimates.get(1)).toEqual(0);
  });
});

describe('sumPoolLaneWork', () => {
  test('should weigh blocks by their solved work, not count them', () => {
    // ASERT moves difficulty every block: one block at a 256x harder target
    // must carry 256x the weight of a difficulty-one block in the same lane
    const work = sumPoolLaneWork([
      { poolId: 1, lane: 'permissionless', bits: 0x1c00ffff }, // 256x difficulty-one proof
      { poolId: 2, lane: 'permissionless', bits: DIFFICULTY_ONE_BITS },
      { poolId: 2, lane: 'auxpow', bits: DIFFICULTY_ONE_BITS },
    ]);

    const pool1 = work.find((w) => w.poolId === 1)!;
    const pool2 = work.find((w) => w.poolId === 2)!;
    expect(Number(pool1.permissionless) / Number(pool2.permissionless)).toBeCloseTo(256, 3);
    expect(pool1.auxpow).toEqual(0n);
    expect(Number(pool2.auxpow)).toBeCloseTo(DIFFICULTY_ONE_BLOCK_PROOF, -1);

    // equal block counts, unequal work: estimates must follow the work
    const estimates = attributePoolHashrates(work, { permissionless: 257e12, auxpow: 5e12 });
    expect(estimates.get(1)).toBeCloseTo(256e12, -11);
    expect(estimates.get(2)).toBeCloseTo(1e12 + 5e12, -11);
  });

  test('should keep exact shares for mainnet-scale work beyond MAX_SAFE_INTEGER', () => {
    // two pools whose lane work differs by 1 part in 2^60: a double cannot
    // represent these totals, but the shares must still split evenly enough
    // that the estimates stay exact to within one share-scale ulp
    const big = 1n << 90n;
    const estimates = attributePoolHashrates([
      { poolId: 1, permissionless: big, auxpow: 0n },
      { poolId: 2, permissionless: big + 1n, auxpow: 0n },
    ], { permissionless: 1e18, auxpow: 0 });

    expect(estimates.get(1)).toBeCloseTo(0.5e18, -8);
    expect(estimates.get(2)).toBeCloseTo(0.5e18, -8);
  });

  test('should ignore invalid bits like chainwork does', () => {
    const work = sumPoolLaneWork([
      { poolId: 1, lane: 'permissionless', bits: 0x00800000 }, // sign bit set: no work
      { poolId: 1, lane: 'permissionless', bits: DIFFICULTY_ONE_BITS },
    ]);
    expect(Number(work[0].permissionless)).toBeCloseTo(DIFFICULTY_ONE_BLOCK_PROOF, -1);
  });
});
