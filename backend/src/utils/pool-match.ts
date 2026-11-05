import { PoolMatchCoinbaseOutput, PoolTag } from '../mempool.interfaces';
import { QbitAuxPowParentCoinbase } from './qbit-auxpow';

/**
 * Dependency-free mining pool matcher, shared by the pool definition importer
 * (pools-parser) and the lazy block migrations (BlocksRepository) without
 * creating a repository <-> parser module cycle.
 */

// faithful copy of TransactionUtils.hex2ascii, duplicated here so this module
// stays free of the api/ import graph
function hex2ascii(hex: string): string {
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
}

function coinbaseTextEncodings(hex: string): string[] {
  const byteText = hex2ascii(hex);
  const utf8Text = Buffer.from(hex, 'hex').toString('utf8');
  return utf8Text === byteText ? [byteText] : [byteText, utf8Text];
}

/**
 * Pool identifier fields are JSON strings when they come from the database
 * and plain arrays in local qbit pool mode; parent-chain columns can also
 * be NULL on databases migrated before they existed.
 */
function definitionArray(value: string | string[] | null | undefined): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function matchesFullRewardAddress(
  poolAddresses: string[],
  addresses: string[],
  coinbaseOutputs?: PoolMatchCoinbaseOutput[]
): boolean {
  if (coinbaseOutputs) {
    const positiveOutputs = coinbaseOutputs.filter(output => output.value > 0);
    return positiveOutputs.length > 0 && poolAddresses.some(address =>
      positiveOutputs.every(output => output.scriptpubkey_address === address)
    );
  }

  // Historical block rows predate exact coinbase-output persistence. For a
  // census-verified definition, require its target to be the sole stored
  // recipient; any split payout with another addressed output is excluded.
  const uniqueAddresses = [...new Set(addresses)];
  return uniqueAddresses.length === 1 && poolAddresses.includes(uniqueAddresses[0]);
}

function matchPoolIdentifiers(
  scriptsig: string,
  addresses: string[],
  pools: PoolTag[],
  lane: 'qbit' | 'parent',
  coinbaseOutputs?: PoolMatchCoinbaseOutput[]
): PoolTag | undefined {
  // Keep the historical byte-oriented representation for compatibility while
  // also decoding valid UTF-8 pool tags such as F2Pool's Chinese name and fish
  // emoji.
  const scriptSigTexts = coinbaseTextEncodings(scriptsig);

  // An explicit coinbase tag is stronger evidence than a payout address and
  // must win independently of the database's row order. In particular, Prism
  // templates can include another operator's address as one split output.
  for (let i = 0; i < pools.length; ++i) {
    const regexes = definitionArray(lane === 'qbit' ? pools[i].regexes : pools[i].parentRegexes);
    for (let y = 0; y < regexes.length; ++y) {
      const regex = new RegExp(regexes[y], 'i');
      if (scriptSigTexts.some(scriptSigText => scriptSigText.match(regex) !== null)) {
        return pools[i];
      }
    }
  }

  if (!addresses.length) {
    return;
  }

  for (let i = 0; i < pools.length; ++i) {
    const poolAddresses = definitionArray(lane === 'qbit' ? pools[i].addresses : pools[i].parentAddresses);
    if (lane === 'qbit' && pools[i].addressMatchMode === 'full_reward') {
      if (matchesFullRewardAddress(poolAddresses, addresses, coinbaseOutputs)) {
        return pools[i];
      }
      continue;
    }

    for (let y = 0; y < poolAddresses.length; y++) {
      if (addresses.indexOf(poolAddresses[y]) !== -1) {
        return pools[i];
      }
    }
  }
}

export function matchBlockMiner(
  scriptsig: string,
  addresses: string[],
  pools: PoolTag[],
  auxpowParentCoinbase?: QbitAuxPowParentCoinbase | null,
  qbitCoinbaseOutputs?: PoolMatchCoinbaseOutput[]
): PoolTag | undefined {
  // qbit-side identifiers always win over parent-chain evidence: the AuxPoW
  // parent coinbase only proves which parent-chain pool built the Bitcoin
  // template, which is a weaker signal for the qbit-side operator than a
  // qbit payout address or a qbit coinbase tag.
  const qbitMatch = matchPoolIdentifiers(scriptsig, addresses, pools, 'qbit', qbitCoinbaseOutputs);
  if (qbitMatch) {
    return qbitMatch;
  }

  if (auxpowParentCoinbase) {
    return matchPoolIdentifiers(auxpowParentCoinbase.scriptsig, auxpowParentCoinbase.addresses, pools, 'parent');
  }
}
