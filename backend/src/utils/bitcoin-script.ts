/** extracts m and n from a multisig script (asm), returns nothing if it is not a multisig script */
export function parseMultisigScript(script: string): void | { m: number, n: number } {
  if (!script?.length) {
    return;
  }
  const ops = script.split(' ');
  if (ops.length < 3 || ops.pop() !== 'OP_CHECKMULTISIG') {
    return;
  }
  const opN = ops.pop();
  if (!opN) {
    return;
  }
  if (opN !== 'OP_0' && !opN.startsWith('OP_PUSHNUM_')) {
    return;
  }
  const n = parseInt(opN.match(/[0-9]+/)?.[0] || '', 10);
  if (ops.length < n * 2 + 1) {
    return;
  }
  // pop n public keys
  for (let i = 0; i < n; i++) {
    if (!/^0((2|3)\w{64}|4\w{128})$/.test(ops.pop() || '')) {
      return;
    }
    if (!/^OP_PUSHBYTES_(33|65)$/.test(ops.pop() || '')) {
      return;
    }
  }
  const opM = ops.pop();
  if (!opM) {
    return;
  }
  if (opM !== 'OP_0' && !opM.startsWith('OP_PUSHNUM_')) {
    return;
  }
  const m = parseInt(opM.match(/[0-9]+/)?.[0] || '', 10);

  if (ops.length) {
    return;
  }

  return { m, n };
}

export function getVarIntLength(n: number): number {
  if (n < 0xfd) {
    return 1;
  } else if (n <= 0xffff) {
    return 3;
  } else if (n <= 0xffffffff) {
    return 5;
  } else {
    return 9;
  }
}

// Script decoding as qbitd does it, for its sigop counts and push-only checks (qbit v1.0.0
// src/script/script.cpp). The frontend keeps a copy in src/app/shared/transaction.utils.ts.
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;
const OP_1 = 0x51;
const OP_16 = 0x60;
const OP_CHECKSIG = 0xac;
const OP_CHECKSIGVERIFY = 0xad;
const OP_CHECKMULTISIG = 0xae;
const OP_CHECKMULTISIGVERIFY = 0xaf;
const OP_INVALIDOPCODE = 0xff;
const MAX_PUBKEYS_PER_MULTISIG = 20;

export interface ScriptOp {
  opcode: number;
  // the bytes the instruction pushes, which end where the next instruction starts
  start: number;
  end: number;
}

// A script decoded once, as qbitd's GetScriptOp reads it: its instructions, up to a push that runs
// past the end of the script, where qbitd stops decoding
export interface DecodedScript {
  hex: string;
  ops: ScriptOp[];
  complete: boolean;
}

// An input's scripts, decoded once for the standardness and sigop checks that read them
export interface DecodedInputScripts {
  scriptsig: DecodedScript;
  // the scriptpubkey the input spends, when its prevout is known
  prevout: DecodedScript | null;
  // the redeem script of a P2SH spend whose scriptsig is push-only
  redeemScript: DecodedScript | null;
}

const hexDigit = (code: number): number => (code <= 0x39 ? code - 0x30 : (code | 0x20) - 0x57);
const byteAt = (hex: string, index: number): number => (hexDigit(hex.charCodeAt(2 * index)) << 4) | hexDigit(hex.charCodeAt(2 * index + 1));
const EMPTY_SCRIPT: DecodedScript = { hex: '', ops: [], complete: true };

export function decodeScript(hex: string): DecodedScript {
  if (!hex) {
    return EMPTY_SCRIPT;
  }
  const size = hex.length >> 1;
  const ops: ScriptOp[] = [];
  let pc = 0;
  while (pc < size) {
    const opcode = byteAt(hex, pc++);
    let push = 0;
    if (opcode < OP_PUSHDATA1) {
      push = opcode;
    } else if (opcode <= OP_PUSHDATA4) {
      // the push size follows in 1, 2 or 4 little-endian bytes
      const sizeBytes = opcode === OP_PUSHDATA1 ? 1 : (opcode === OP_PUSHDATA2 ? 2 : 4);
      if (size - pc < sizeBytes) {
        return { hex, ops, complete: false };
      }
      for (let i = sizeBytes - 1; i >= 0; i--) {
        push = push * 256 + byteAt(hex, pc + i);
      }
      pc += sizeBytes;
    }
    if (size - pc < push) {
      return { hex, ops, complete: false };
    }
    ops.push({ opcode, start: pc, end: pc + push });
    pc += push;
  }
  return { hex, ops, complete: true };
}

/**
 * qbitd's CScript::GetSigOpCount: OP_CHECKSIG and OP_CHECKSIGVERIFY count one sigop each, and
 * OP_CHECKMULTISIG and OP_CHECKMULTISIGVERIFY 20, or with accurate, as for redeem and witness
 * scripts, the key count that an OP_1 to OP_16 right before them gives. Counting stops where
 * decoding does. OP_CHECKSIGPQC and OP_CHECKSIGADD don't count.
 */
export function getSigOpCount(script: DecodedScript, accurate: boolean): number {
  let sigops = 0;
  let lastOpcode = OP_INVALIDOPCODE;
  for (const { opcode } of script.ops) {
    if (opcode === OP_CHECKSIG || opcode === OP_CHECKSIGVERIFY) {
      sigops++;
    } else if (opcode === OP_CHECKMULTISIG || opcode === OP_CHECKMULTISIGVERIFY) {
      sigops += (accurate && lastOpcode >= OP_1 && lastOpcode <= OP_16) ? lastOpcode - OP_1 + 1 : MAX_PUBKEYS_PER_MULTISIG;
    }
    lastOpcode = opcode;
  }
  return sigops;
}

// qbitd's CScript::IsPushOnly: every instruction decodes, and pushes data or a number
export function isPushOnly(script: DecodedScript): boolean {
  return script.complete && script.ops.every(op => op.opcode <= OP_16);
}

/**
 * The redeem script of a P2SH spend, as qbitd reads it from the scriptsig to count its sigops
 * (CScript::GetSigOpCount(scriptSig)): the data the last instruction pushes, which is empty when
 * that pushes a number, or null unless the scriptsig is push-only.
 */
export function getRedeemScript(scriptsig: DecodedScript): DecodedScript | null {
  if (!isPushOnly(scriptsig)) {
    return null;
  }
  const last = scriptsig.ops[scriptsig.ops.length - 1];
  return decodeScript(last ? scriptsig.hex.slice(last.start * 2, last.end * 2) : '');
}

// qbitd's CScript::IsPayToScriptHash
export function isP2shScript(script: DecodedScript): boolean {
  const hex = script.hex;
  return hex.length === 46 && byteAt(hex, 0) === 0xa9 && byteAt(hex, 1) === 0x14 && byteAt(hex, 22) === 0x87;
}

// Decodes an input's scriptsig, the scriptpubkey it spends, and for a P2SH spend, its redeem script
export function decodeInputScripts(vin: { scriptsig?: string, prevout?: { scriptpubkey: string } | null }): DecodedInputScripts {
  const scriptsig = decodeScript(vin.scriptsig || '');
  const prevout = vin.prevout ? decodeScript(vin.prevout.scriptpubkey) : null;
  return { scriptsig, prevout, redeemScript: prevout && isP2shScript(prevout) ? getRedeemScript(scriptsig) : null };
}

// qbitd's WitnessSigOps: a v0 key hash program costs one sigop, a v0 script hash program the sigops of
// its witness script, and any other program none
export function getWitnessSigOps(program: DecodedScript, witness: string[] | undefined): number {
  const hex = program.hex;
  if (hex.length === 44 && byteAt(hex, 0) === 0x00 && byteAt(hex, 1) === 0x14) {
    return 1;
  }
  if (hex.length === 68 && byteAt(hex, 0) === 0x00 && byteAt(hex, 1) === 0x20 && witness?.length) {
    return getSigOpCount(decodeScript(witness[witness.length - 1]), true);
  }
  return 0;
}

/** Extracts miner names from a DATUM coinbase transaction */
export function parseDATUMTemplateCreator(coinbaseRaw: string): string[] | null {
  const bytes: number[] = [];
  for (let c = 0; c < coinbaseRaw.length; c += 2) {
      bytes.push(parseInt(coinbaseRaw.slice(c, c + 2), 16));
  }

  // Skip block height
  let tagLengthByte = 1 + bytes[0];

  let tagsLength = bytes[tagLengthByte];
  if (tagsLength == 0x4c) {
    tagLengthByte += 1;
    tagsLength = bytes[tagLengthByte];
  }

  const tagStart = tagLengthByte + 1;
  const tags = bytes.slice(tagStart, tagStart + tagsLength);
  let tagString = String.fromCharCode(...tags);
  tagString = tagString.replace('\x00', '');

  return tagString.split('\x0f').map((name) => name.replace(/[^a-zA-Z0-9 ]/g, ''));
}
