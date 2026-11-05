import { laneOf, QbitLane } from './qbit-version';

export interface BlockForHashrate {
  height: number;
  timestamp: number;
  bits: number;
  version: number;
  poolId?: number;
}

export interface QbitLaneHashrates {
  aggregate: number;
  permissionless: number;
  auxpow: number;
}

const TWO_TO_256 = 1n << 256n;

/**
 * Return the expected number of hashes represented by a block target. This is
 * the same integer block-proof calculation used for chainwork:
 *
 *   floor(2^256 / (target + 1))
 *
 * Invalid compact targets contribute no work, matching Core's defensive
 * GetBlockProof behavior.
 */
function blockProof(bits: number): bigint {
  if (!Number.isInteger(bits) || bits < 1 || bits > 0xffffffff || (bits & 0x00800000) !== 0) {
    return 0n;
  }

  const exponent = bits >>> 24;
  const mantissa = BigInt(bits & 0x007fffff);
  if (mantissa === 0n) {
    return 0n;
  }

  const target = exponent >= 3
    ? mantissa << (8n * BigInt(exponent - 3))
    : mantissa >> (8n * BigInt(3 - exponent));

  if (target <= 0n || target >= TWO_TO_256) {
    return 0n;
  }

  return TWO_TO_256 / (target + 1n);
}

/**
 * Calculate observed work per second for one Cadence lane over a wall-clock
 * window. Every block is decoded locally from its version; the network is
 * passed through to the shared cadence decoder so expected AuxPoW chain IDs
 * remain network-aware.
 */
export function calcLaneHashrate(
  blocks: BlockForHashrate[],
  lane: QbitLane,
  windowMs: number,
  network: string,
): number {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return 0;
  }

  let work = 0n;
  for (const block of blocks) {
    if (laneOf(block.version, network) === lane) {
      work += blockProof(block.bits);
    }
  }

  return Number(work) / (windowMs / 1000);
}

/**
 * Compute both independent lane rates and their aggregate from one block
 * batch. Defining aggregate as the sum makes the public invariant explicit
 * and avoids introducing rounding drift between independently computed
 * series.
 */
export function calcLaneHashrates(
  blocks: BlockForHashrate[],
  windowMs: number,
  network: string,
): QbitLaneHashrates {
  const permissionless = calcLaneHashrate(blocks, 'permissionless', windowMs, network);
  const auxpow = calcLaneHashrate(blocks, 'auxpow', windowMs, network);

  return {
    aggregate: permissionless + auxpow,
    permissionless,
    auxpow,
  };
}

/**
 * One pool's share weight per Cadence lane: summed block proofs (expected
 * hashes). Kept as bigints so share ratios can be formed without precision
 * loss — mainnet-scale proofs exceed Number.MAX_SAFE_INTEGER.
 */
export interface PoolLaneWork {
  poolId: number;
  permissionless: bigint;
  auxpow: bigint;
}

/**
 * Sum each pool's solved work per lane from raw (poolId, lane, bits) block
 * rows. Per-block ASERT means two same-lane blocks can carry substantially
 * different proofs, so hashrate attribution weighs each block's work rather
 * than counting blocks.
 */
export function sumPoolLaneWork(
  blocks: { poolId: number; lane: QbitLane | string; bits: number }[],
): PoolLaneWork[] {
  const byPool = new Map<number, { permissionless: bigint; auxpow: bigint }>();
  for (const block of blocks) {
    let work = byPool.get(block.poolId);
    if (!work) {
      work = { permissionless: 0n, auxpow: 0n };
      byPool.set(block.poolId, work);
    }
    if (block.lane === 'auxpow') {
      work.auxpow += blockProof(block.bits);
    } else {
      work.permissionless += blockProof(block.bits);
    }
  }

  return [...byPool.entries()].map(([poolId, work]) => ({
    poolId,
    permissionless: work.permissionless,
    auxpow: work.auxpow,
  }));
}

// share denominator for bigint work ratios: one double mantissa of resolution
const SHARE_SCALE = 1n << 53n;

function workShare(work: bigint, laneTotal: bigint): number {
  if (laneTotal <= 0n || work <= 0n) {
    return 0;
  }
  return Number((work * SHARE_SCALE) / laneTotal) / Number(SHARE_SCALE);
}

/**
 * Attribute network hashrate to pools lane by lane: a pool's share of each
 * lane's solved work earns it that share of that lane's rate, and its
 * estimate is the sum over both lanes. A pool's overall share must not be
 * scaled by the aggregate rate because the Cadence lanes run at very
 * different network hashrates: that would credit a permissionless-lane pool
 * with merge-mined Bitcoin-scale hashrate (and vice versa).
 */
export function attributePoolHashrates(
  laneWork: PoolLaneWork[],
  laneHashrates: Pick<QbitLaneHashrates, 'permissionless' | 'auxpow'>,
): Map<number, number> {
  let totalPermissionless = 0n;
  let totalAuxpow = 0n;
  for (const work of laneWork) {
    totalPermissionless += work.permissionless;
    totalAuxpow += work.auxpow;
  }

  const estimates = new Map<number, number>();
  for (const work of laneWork) {
    const permissionless = workShare(work.permissionless, totalPermissionless) * laneHashrates.permissionless;
    const auxpow = workShare(work.auxpow, totalAuxpow) * laneHashrates.auxpow;
    estimates.set(work.poolId, permissionless + auxpow);
  }
  return estimates;
}

/**
 * Calculate qbit's getnetworkhashps-style estimate from a height window. The
 * first (oldest) block is the timing/chainwork anchor; its proof is excluded.
 * All later blocks contribute work, while the denominator uses the minimum and
 * maximum timestamp across the complete common window to tolerate miner clock
 * skew exactly as qbit does.
 */
export function calcLaneHashratesForWindow(
  blocksWithAnchor: BlockForHashrate[],
  network: string,
): QbitLaneHashrates {
  if (blocksWithAnchor.length < 2) {
    return { aggregate: 0, permissionless: 0, auxpow: 0 };
  }

  for (let i = 1; i < blocksWithAnchor.length; ++i) {
    if (blocksWithAnchor[i].height !== blocksWithAnchor[i - 1].height + 1) {
      throw new Error('Hashrate calculation requires a consecutive ascending block window');
    }
  }

  let minTimestamp = blocksWithAnchor[0].timestamp;
  let maxTimestamp = blocksWithAnchor[0].timestamp;
  for (const block of blocksWithAnchor) {
    minTimestamp = Math.min(minTimestamp, block.timestamp);
    maxTimestamp = Math.max(maxTimestamp, block.timestamp);
  }

  return calcLaneHashrates(
    blocksWithAnchor.slice(1),
    (maxTimestamp - minTimestamp) * 1000,
    network,
  );
}
