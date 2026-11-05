import config from '../config';
import { AsertAnchors, AsertLaneAnchor, AsertLaneAnchors } from '../mempool.interfaces';
import blocks from './blocks';
import { laneOf, QbitLane } from '../utils/qbit-version';

/**
 * Difficulty state of one Cadence lane. Each lane retargets independently and
 * their difficulties differ by orders of magnitude (AuxPoW tracks merge-mined
 * Bitcoin hashrate), so they must never be mixed in one number.
 */
export interface QbitLaneDifficultyState {
  difficulty: number;           // difficulty of the lane's most recent block
  bits: number;                 // nBits of the lane's most recent block
  target: string;               // 256-bit target of the lane's most recent block, hex encoded
  height: number;               // height of the lane's most recent block
  timestamp: number;            // unix seconds of the lane's most recent block
  change24h: number | null;     // vs the most recent same-lane block mined >= 24h ago; null while the lane is younger
}

/**
 * qbit adjusts difficulty on every block via aserti3-2d (2h halflife): there is
 * no epoch, no scheduled retarget and no "next adjustment in N blocks". This
 * state describes the continuous DAA instead of Bitcoin's 2016-block epoch.
 *
 * The headline current* /change24h fields are pinned to the permissionless
 * lane whenever lane anchors are available: the raw chain tip alternates
 * between lanes, and quoting "the latest block's difficulty" would flip-flop
 * by ~2000x depending on which lane mined last.
 */
export interface QbitDifficultyState {
  asertActive: true;            // sentinel for the frontend feature gate
  currentBits: number;          // nBits of the permissionless lane tip (chain tip when lane data is unavailable)
  currentTarget: string;        // 256-bit target, hex encoded, same source block as currentBits
  currentDifficulty: number;    // difficulty, same source block as currentBits
  timeAvgMs: number;            // rolling average block interval over the last ~60 blocks, both lanes combined
  targetSpacingMs: number;      // consensus target block interval
  change24h: number;            // difficulty delta in percent, same lane pinning as currentDifficulty
  previousTime: number;         // ms-epoch timestamp of the latest block on the chain (gates websocket pushes)
  timeAvg: number;              // legacy alias of timeAvgMs, consumed by ETA logic
  adjustedTimeAvg: number;      // legacy alias of timeAvgMs, consumed by ETA logic
  timeOffset: number;           // always 0 on qbit, consumed by ETA logic
  lanes: Record<QbitLane, QbitLaneDifficultyState | null> | null; // per-lane state; null without indexed lane anchors
}

/**
 * Calculate the difficulty increase/decrease by using the `bits` integer contained in two
 * block headers.
 *
 * With ASERT the difficulty moves every block and there is no protocol bound on how far
 * `bits` can drift between two arbitrary blocks (e.g. across a long idle gap), so any
 * exponent distance is legal here and the result is unclamped.
 *
 * @param {number} oldBits The 32 bit `bits` integer from an older block header.
 * @param {number} newBits The 32 bit `bits` integer from a newer block header.
 * @returns {number} A floating point decimal of the difficulty change from old to new.
 *          (ie. 21.3 means 21.3% increase in difficulty, -21.3 is a 21.3% decrease in difficulty)
 */
export function calcBitsDifference(oldBits: number, newBits: number): number {
  // Must be
  // - integer
  // - highest exponent is 0x20, so max value (as integer) is 0x207fffff
  // - min value is 1 (exponent = 0)
  // - highest bit of the number-part is +- sign, it must not be 1
  const verifyBits = (bits: number): void => {
    if (
      Math.floor(bits) !== bits ||
      bits > 0x207fffff ||
      bits < 1 ||
      (bits & 0x00800000) !== 0 ||
      (bits & 0x007fffff) === 0
    ) {
      throw new Error('Invalid bits');
    }
  };
  verifyBits(oldBits);
  verifyBits(newBits);

  const oldExp = oldBits >> 24;
  const newExp = newBits >> 24;
  const oldNum = oldBits & 0x007fffff;
  const newNum = newBits & 0x007fffff;

  // target = mantissa * 256^(exponent - 3), and difficulty is inversely
  // proportional to the target, so the change is the ratio of the targets.
  const targetRatio = (oldNum / newNum) * Math.pow(256, oldExp - newExp);
  return (targetRatio - 1) * 100;
}

/**
 * Expand a compact `bits` value into the full 256-bit target, hex encoded.
 */
export function bitsToTargetHex(bits: number): string {
  const exponent = bits >> 24;
  const mantissa = BigInt(bits & 0x007fffff);
  const target = exponent >= 3
    ? mantissa << (8n * BigInt(exponent - 3))
    : mantissa >> (8n * BigInt(3 - exponent));
  return target.toString(16).padStart(64, '0');
}

/**
 * Derive one lane's difficulty state from its anchors. change24h compares the
 * lane's latest block against the most recent same-lane block mined at least
 * 24h earlier; cross-lane bits are never compared.
 */
function calcLaneDifficultyState(anchor: AsertLaneAnchor): QbitLaneDifficultyState | null {
  if (!anchor.latest) {
    return null;
  }

  let change24h: number | null = null;
  if (anchor.dayAgo && anchor.dayAgo.height <= anchor.latest.height) {
    try {
      change24h = calcBitsDifference(anchor.dayAgo.bits, anchor.latest.bits);
    } catch (e) {
      change24h = null;
    }
  }

  return {
    difficulty: anchor.latest.difficulty,
    bits: anchor.latest.bits,
    target: bitsToTargetHex(anchor.latest.bits),
    height: anchor.latest.height,
    timestamp: anchor.latest.timestamp,
    change24h,
  };
}

/**
 * Derive the continuous-DAA difficulty state from the chain tip and the two
 * anchor blocks maintained by the blocks API: one ~60 blocks back (block
 * spacing average) and one ~1440 blocks back (24h difficulty delta). Anchors
 * may be missing right after startup or lag behind the tip after a transient
 * fetch failure; both metrics degrade gracefully in that case.
 *
 * When per-lane anchors are provided, the headline difficulty fields are
 * pinned to the permissionless lane so they stop flip-flopping with the lane
 * of whichever block happens to be the tip.
 */
export function calcQbitDifficultyState(
  latestBlock: { height: number; timestamp: number; bits: number; difficulty: number },
  spacingAnchor: { height: number; timestamp: number } | null,
  difficultyAnchor: { height: number; bits: number } | null,
  targetSpacingMs: number,
  laneAnchors: AsertLaneAnchors | null = null,
): QbitDifficultyState {
  let timeAvgMs = targetSpacingMs;
  if (spacingAnchor && latestBlock.height > spacingAnchor.height) {
    const avgMs = ((latestBlock.timestamp - spacingAnchor.timestamp) * 1000) / (latestBlock.height - spacingAnchor.height);
    // block timestamps are not strictly monotonic; fall back to the target on nonsense windows
    if (avgMs > 0) {
      timeAvgMs = Math.floor(avgMs);
    }
  }

  let change24h = 0;
  if (difficultyAnchor && difficultyAnchor.height < latestBlock.height) {
    try {
      change24h = calcBitsDifference(difficultyAnchor.bits, latestBlock.bits);
    } catch (e) {
      change24h = 0;
    }
  }

  const lanes = laneAnchors === null ? null : {
    permissionless: calcLaneDifficultyState(laneAnchors.permissionless),
    auxpow: calcLaneDifficultyState(laneAnchors.auxpow),
  };

  // the tip-block fallback only applies before lane anchors exist (or on the
  // degenerate all-AuxPoW chain); its cross-lane change24h is unavoidable there
  const headline = lanes?.permissionless ?? null;

  return {
    asertActive: true,
    currentBits: headline ? headline.bits : latestBlock.bits,
    currentTarget: headline ? headline.target : bitsToTargetHex(latestBlock.bits),
    currentDifficulty: headline ? headline.difficulty : latestBlock.difficulty,
    timeAvgMs,
    targetSpacingMs,
    change24h: headline ? (headline.change24h ?? 0) : change24h,
    previousTime: latestBlock.timestamp * 1000,
    timeAvg: timeAvgMs,
    adjustedTimeAvg: timeAvgMs,
    timeOffset: 0,
    lanes,
  };
}

class DifficultyAdjustmentApi {
  /**
   * @param tipBlock overrides the blocks-cache tail as the chain tip. Required
   * when handling a freshly mined block: the new-block websocket callbacks run
   * before the block is appended to the cache, so without the override the
   * payload would describe the previous block.
   */
  public getDifficultyAdjustment(
    tipBlock?: { height: number; timestamp: number; bits: number; difficulty: number; version?: number },
  ): QbitDifficultyState | null {
    const blocksCache = blocks.getBlocks();
    const latestBlock = tipBlock ?? blocksCache[blocksCache.length - 1];
    if (!latestBlock) {
      return null;
    }
    const anchors: AsertAnchors = blocks.getAsertAnchors();
    // the database lane anchors can lag the tip by a block (new-block
    // callbacks run before the row is written), so overlay the tip onto its
    // own lane to keep that lane's headline current. At equal height the tip
    // block still wins: a same-height reorg replaces the block behind the
    // cached anchor.
    let laneAnchors = blocks.getAsertLaneAnchors();
    if (laneAnchors && typeof latestBlock.version === 'number') {
      const tipLane = laneOf(latestBlock.version, config.MEMPOOL.NETWORK);
      const knownLatest = laneAnchors[tipLane].latest;
      if (!knownLatest || latestBlock.height >= knownLatest.height) {
        laneAnchors = {
          ...laneAnchors,
          [tipLane]: {
            ...laneAnchors[tipLane],
            latest: {
              height: latestBlock.height,
              timestamp: latestBlock.timestamp,
              bits: latestBlock.bits,
              difficulty: latestBlock.difficulty,
            },
          },
        };
      }
    }

    return calcQbitDifficultyState(
      {
        height: latestBlock.height,
        timestamp: latestBlock.timestamp,
        bits: latestBlock.bits,
        difficulty: latestBlock.difficulty,
      },
      anchors.hourAgo,
      anchors.dayAgo,
      config.MEMPOOL.BLOCK_TARGET_SPACING_SECONDS * 1000,
      laneAnchors,
    );
  }
}

export default new DifficultyAdjustmentApi();
