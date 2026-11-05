import * as bitcoinjs from 'bitcoinjs-lib';
import * as crypto from 'crypto';
import { isAuxpowVersion } from './qbit-version';

/**
 * Parent-chain coinbase data recovered from a qbit AuxPoW block header.
 * qbit serializes AuxPoW blocks as the 80-byte child header followed by the
 * CAuxPow payload (see qbit core src/auxpow.h): the parent-chain coinbase
 * transaction, its merkle branch and index, the chain merkle branch and
 * index, and finally the 80-byte parent block header.
 */
export interface QbitAuxPowParentCoinbase {
  /** Parent-chain coinbase input scriptSig (hex); carries pool coinbase tags */
  scriptsig: string;
  /** Parent-chain (Bitcoin mainnet) payout addresses of the coinbase outputs */
  addresses: string[];
  /** Parent-chain block hash (display byte order) */
  parentBlockHash: string;
}

const PURE_HEADER_BYTES = 80;

class ByteReader {
  private offset: number;

  constructor(private buf: Buffer, start: number) {
    this.offset = start;
  }

  public read(length: number): Buffer {
    if (length < 0 || this.offset + length > this.buf.length) {
      throw new RangeError('read past end of AuxPoW payload');
    }
    const slice = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  public skip(length: number): void {
    if (length < 0 || this.offset + length > this.buf.length) {
      throw new RangeError('skip past end of AuxPoW payload');
    }
    this.offset += length;
  }

  public readCompactSize(): number {
    const first = this.read(1)[0];
    if (first < 0xfd) {
      return first;
    }
    if (first === 0xfd) {
      return this.read(2).readUInt16LE(0);
    }
    if (first === 0xfe) {
      return this.read(4).readUInt32LE(0);
    }
    return Number(this.read(8).readBigUInt64LE(0));
  }

  public remaining(): number {
    return this.buf.length - this.offset;
  }
}

interface ParsedParentCoinbase {
  scriptsig: string;
  outputScripts: Buffer[];
}

/**
 * Walk a Bitcoin-serialized transaction (optionally segwit) and return the
 * first input's scriptSig plus every output script. Throws on truncation.
 */
function readParentTransaction(reader: ByteReader): ParsedParentCoinbase {
  reader.skip(4); // version
  let inputCount = reader.readCompactSize();
  let hasWitness = false;
  if (inputCount === 0) {
    // BIP144 marker/flag prefix
    const flag = reader.read(1)[0];
    if (flag !== 0x01) {
      throw new RangeError('invalid segwit flag in AuxPoW parent coinbase');
    }
    hasWitness = true;
    inputCount = reader.readCompactSize();
  }

  let scriptsig = '';
  for (let i = 0; i < inputCount; i++) {
    reader.skip(36); // outpoint
    const script = reader.read(reader.readCompactSize());
    if (i === 0) {
      scriptsig = script.toString('hex');
    }
    reader.skip(4); // sequence
  }

  const outputCount = reader.readCompactSize();
  const outputScripts: Buffer[] = [];
  for (let i = 0; i < outputCount; i++) {
    reader.skip(8); // value
    outputScripts.push(reader.read(reader.readCompactSize()));
  }

  if (hasWitness) {
    for (let i = 0; i < inputCount; i++) {
      const itemCount = reader.readCompactSize();
      for (let y = 0; y < itemCount; y++) {
        reader.skip(reader.readCompactSize());
      }
    }
  }

  reader.skip(4); // locktime
  return { scriptsig, outputScripts };
}

function skipMerkleBranch(reader: ByteReader): void {
  const hashCount = reader.readCompactSize();
  reader.skip(hashCount * 32);
  reader.skip(4); // int32 branch index
}

/**
 * Extract the parent-chain coinbase data embedded in a raw qbit block header
 * (`getblockheader <hash> false`). Returns null for permissionless headers,
 * for headers whose AuxPoW payload does not deserialize to exactly the
 * CAuxPow layout, and for malformed hex, so callers can treat parent-chain
 * pool attribution as strictly best-effort.
 *
 * Output scripts are rendered as Bitcoin mainnet addresses: qbit AuxPoW work
 * is merge-mined against Bitcoin, and known pool payout addresses are Bitcoin
 * mainnet ones. Non-address outputs (e.g. OP_RETURN commitments) are skipped.
 */
/**
 * Explorer-facing shape of the parent-chain data, named after the qbit-side
 * coinbase fields it mirrors (coinbaseRaw / coinbaseAddresses).
 */
export interface QbitAuxPowSummary {
  parentBlockHash: string;
  parentCoinbaseRaw: string;
  parentCoinbaseAddresses: string[];
}

export function summarizeAuxPowHeader(headerHex: string | null | undefined): QbitAuxPowSummary | null {
  const parent = parseAuxPowParentCoinbase(headerHex);
  if (!parent) {
    return null;
  }
  return {
    parentBlockHash: parent.parentBlockHash,
    parentCoinbaseRaw: parent.scriptsig,
    parentCoinbaseAddresses: parent.addresses,
  };
}

export function parseAuxPowParentCoinbase(headerHex: string | null | undefined): QbitAuxPowParentCoinbase | null {
  if (!headerHex || headerHex.length % 2 !== 0 || headerHex.length <= PURE_HEADER_BYTES * 2) {
    return null;
  }
  const buf = Buffer.from(headerHex, 'hex');
  if (buf.length * 2 !== headerHex.length) { // non-hex input
    return null;
  }
  if (!isAuxpowVersion(buf.readUInt32LE(0))) {
    return null;
  }

  try {
    const reader = new ByteReader(buf, PURE_HEADER_BYTES);
    const coinbase = readParentTransaction(reader);
    skipMerkleBranch(reader); // coinbase merkle branch
    skipMerkleBranch(reader); // chain merkle branch
    const parentHeader = reader.read(PURE_HEADER_BYTES);
    if (reader.remaining() !== 0) {
      // not the CAuxPow layout we know; refuse to guess
      return null;
    }

    const addresses = new Set<string>();
    for (const script of coinbase.outputScripts) {
      try {
        addresses.add(bitcoinjs.address.fromOutputScript(script, bitcoinjs.networks.bitcoin));
      } catch (e) {
        // non-standard or data-carrier output
      }
    }

    const parentBlockHash = crypto.createHash('sha256')
      .update(crypto.createHash('sha256').update(parentHeader).digest())
      .digest().reverse().toString('hex');

    return {
      scriptsig: coinbase.scriptsig,
      addresses: [...addresses],
      parentBlockHash,
    };
  } catch (e) {
    return null;
  }
}
