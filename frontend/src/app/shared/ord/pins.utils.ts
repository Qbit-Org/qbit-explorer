import { Inscription, OP_0, OP_1NEGATE, OP_ENDIF, OP_IF, OP_PUSHDATA1, OP_PUSHDATA2, OP_PUSHDATA4, OP_PUSHNUM_1, OP_PUSHNUM_16, OP_RESERVED, bytesToHex, bytesToUnicodeString, concatUint8Arrays, hexToBytes } from '@app/shared/ord/inscription.utils';

// P2MR Inscriptions (PINS-1, https://github.com/P2MR-Inscriptions/pins): an envelope in a P2MR leaf script,
// OP_FALSE OP_IF <"pins"> (<tag> <value>)* [OP_0 <body>...] OP_ENDIF.
// The leaf script is decoded into instructions first, and envelopes are read from that list (PINS-1 section 4.3),
// so marker bytes inside a push are data, never an envelope, and every instruction is read once.

const PINS_MARKER = [0x70, 0x69, 0x6e, 0x73];
const PINS_LEAF_VERSION = 0xc0;
const PINS_CONTENT_TYPE = 1;
const PINS_POINTER = 2;
const PINS_METADATA = 5;
const PINS_CONTENT_ENCODING = 9;
const PINS_DELEGATE = 11;
// Bodies are kept up to this size for the panel, as decodeInscriptions does
const PINS_BODY_LIMIT = 100_000;

export interface PinsInstruction {
  opcode: number;
  /** The bytes a push places, including the one-byte values of OP_1NEGATE and OP_1 to OP_16; null for any other opcode. */
  data: Uint8Array | null;
}

export type PinsEnvelopeFlag = 'no_body' | 'incomplete_field' | 'opaque' | 'duplicate_field';

export interface PinsEnvelope {
  /** Fields with a one-byte tag, in order. A repeated field keeps its first value, except metadata (5), whose values are joined. */
  fields: { tag: number; value: Uint8Array }[];
  body: Uint8Array;
  flags: PinsEnvelopeFlag[];
}

/**
 * Decodes a leaf script into instructions (PINS-1 section 4.3). Push lengths are read unsigned, and a push whose
 * length bytes or data run past the end of the script is a truncated push: the script then holds no envelope.
 *
 * @returns The instructions, or null for a script that cannot be fully decoded.
 */
export function decodePinsLeafScript(script: Uint8Array): PinsInstruction[] | null {
  const instructions: PinsInstruction[] = [];
  let i = 0;
  while (i < script.length) {
    const opcode = script[i];
    if (opcode === OP_0) {
      instructions.push({ opcode, data: new Uint8Array() });
      i += 1;
    } else if (opcode <= 75) {
      if (i + 1 + opcode > script.length) {
        return null;
      }
      instructions.push({ opcode, data: script.subarray(i + 1, i + 1 + opcode) });
      i += 1 + opcode;
    } else if (opcode === OP_PUSHDATA1 || opcode === OP_PUSHDATA2 || opcode === OP_PUSHDATA4) {
      const width = opcode === OP_PUSHDATA1 ? 1 : opcode === OP_PUSHDATA2 ? 2 : 4;
      if (i + 1 + width > script.length) {
        return null;
      }
      let length = 0;
      for (let b = width - 1; b >= 0; b--) {
        length = length * 256 + script[i + 1 + b];
      }
      const start = i + 1 + width;
      if (start + length > script.length) {
        return null;
      }
      instructions.push({ opcode, data: script.subarray(start, start + length) });
      i = start + length;
    } else if (opcode === OP_1NEGATE) {
      instructions.push({ opcode, data: Uint8Array.of(0x81) });
      i += 1;
    } else if (opcode >= OP_PUSHNUM_1 && opcode <= OP_PUSHNUM_16) {
      instructions.push({ opcode, data: Uint8Array.of(opcode - OP_RESERVED) });
      i += 1;
    } else {
      instructions.push({ opcode, data: null });
      i += 1;
    }
  }
  return instructions;
}

function isPinsMarker(data: Uint8Array | null): boolean {
  return !!data && data.length === PINS_MARKER.length && PINS_MARKER.every((byte, i) => data[i] === byte);
}

/**
 * Walks the instructions and calls `found` with the pushes of each complete envelope (PINS-1 section 4.1, 4.3):
 * OP_FALSE OP_IF, a push of exactly "pins", only pushes, then OP_ENDIF. A complete envelope resumes the walk after
 * its OP_ENDIF; a failed candidate resumes it at the next instruction. `found` returns false to stop the walk.
 */
function walkPinsEnvelopes(instructions: PinsInstruction[], found: (pushes: Uint8Array[]) => boolean): void {
  for (let j = 0; j + 2 < instructions.length; j++) {
    if (instructions[j].opcode !== OP_0 || instructions[j + 1].opcode !== OP_IF || !isPinsMarker(instructions[j + 2].data)) {
      continue;
    }
    let end = j + 3;
    while (end < instructions.length && instructions[end].data !== null) {
      end++;
    }
    if (end === instructions.length || instructions[end].opcode !== OP_ENDIF) {
      continue;
    }
    if (!found(instructions.slice(j + 3, end).map((instruction) => instruction.data as Uint8Array))) {
      return;
    }
    j = end;
  }
}

/**
 * Reads the fields, body and flags of one envelope from the pushes between its marker and its OP_ENDIF
 * (PINS-1 sections 4.1, 5 and 7.2).
 */
function readPinsEnvelope(pushes: Uint8Array[]): PinsEnvelope {
  const flags = new Set<PinsEnvelopeFlag>();
  // the body separator is the first empty push in a tag position
  let separator = pushes.findIndex((push, i) => i % 2 === 0 && push.length === 0);
  if (separator === -1) {
    flags.add('no_body');
    separator = pushes.length;
  }
  if (separator % 2 === 1) {
    // a tag with no value is ignored
    flags.add('incomplete_field');
  }
  const fields: { tag: number; value: Uint8Array }[] = [];
  const seen = new Set<number>();
  // metadata chunks are joined once after the loop, so many small chunks are still read in linear time
  const metadata: Uint8Array[] = [];
  for (let i = 0; i + 1 < separator; i += 2) {
    const tagBytes = pushes[i];
    const value = pushes[i + 1];
    // a tag of more than one byte is an unknown tag, with the parity of its first byte (PINS-1 section 5.1)
    if (tagBytes.length !== 1) {
      if (tagBytes[0] % 2 === 0) {
        flags.add('opaque');
      }
      continue;
    }
    const tag = tagBytes[0];
    // the only even tag PINS-1 defines is the pointer; any other makes the envelope opaque (PINS-1 section 5.4)
    if (tag % 2 === 0 && tag !== PINS_POINTER) {
      flags.add('opaque');
    }
    if (seen.has(tag) && tag !== PINS_METADATA) {
      flags.add('duplicate_field');
    }
    if (!seen.has(tag)) {
      fields.push({ tag, value });
    }
    seen.add(tag);
    if (tag === PINS_METADATA) {
      metadata.push(value);
    }
  }
  if (metadata.length > 1) {
    fields.find((field) => field.tag === PINS_METADATA).value = concatUint8Arrays(metadata);
  }
  return { fields, body: concatUint8Arrays(pushes.slice(separator + 1)), flags: Array.from(flags) };
}

/**
 * The envelopes of a leaf script, in order (PINS-1 section 4). A script that cannot be fully decoded holds none.
 */
export function parsePinsEnvelopes(script: Uint8Array): PinsEnvelope[] {
  const instructions = decodePinsLeafScript(script);
  const envelopes: PinsEnvelope[] = [];
  if (instructions) {
    walkPinsEnvelopes(instructions, (pushes) => {
      envelopes.push(readPinsEnvelope(pushes));
      return true;
    });
  }
  return envelopes;
}

/**
 * Whether a leaf script (hex) holds at least one envelope, by the same walk as parsePinsEnvelopes.
 */
export function hasPinsEnvelope(scriptHex: string | null | undefined): boolean {
  const instructions = scriptHex ? decodePinsLeafScript(hexToBytes(scriptHex)) : null;
  let found = false;
  if (instructions) {
    walkPinsEnvelopes(instructions, () => {
      found = true;
      return false;
    });
  }
  return found;
}

/**
 * The leaf script of a P2MR script-path witness, where envelopes are looked for (PINS-1 section 4.2): an optional
 * annex (a last item starting with 0x50, when there are at least two items) is removed, at least two items must be
 * left, and the control block's leaf version must be 0xc0.
 *
 * @returns The leaf script (hex), or null when the witness is not a script-path spend of leaf version 0xc0.
 */
export function pinsLeafScript(witness: string[] | null | undefined): string | null {
  if (!witness) {
    return null;
  }
  const items = witness.length >= 2 && witness[witness.length - 1].startsWith('50') ? witness.slice(0, -1) : witness;
  if (items.length < 2) {
    return null;
  }
  const controlBlock = items[items.length - 1];
  if (controlBlock.length < 2 || (parseInt(controlBlock.slice(0, 2), 16) & 0xfe) !== PINS_LEAF_VERSION) {
    return null;
  }
  return items[items.length - 2];
}

/**
 * The txid of a binary P2MR Inscription ID (PINS-1 section 6.1): the 32-byte txid in internal byte order, then the
 * envelope index as up to 4 little-endian bytes without trailing zero bytes.
 *
 * @returns The txid in display order, or null for a value that is not a binary ID (PINS-1 section 8: it is ignored).
 */
export function pinsDelegateTxid(value: Uint8Array | undefined): string | null {
  if (!value || value.length < 32 || value.length > 36 || (value.length > 32 && value[value.length - 1] === 0)) {
    return null;
  }
  return bytesToHex(value.slice(0, 32).reverse());
}

/**
 * What the ord-data panel shows for one envelope. An opaque envelope gives its size and nothing of its content
 * (PINS-1 section 5.4); an encoded body (content_encoding) is not decoded here, so it is not shown as text.
 */
export function pinsEnvelopeToInscription(envelope: PinsEnvelope): Inscription {
  const body = envelope.body;
  if (envelope.flags.includes('opaque')) {
    return { opaque: true, content_type_str: 'undefined', body: new Uint8Array(), is_cropped: false, body_length: body.length, delegate_txid: null };
  }
  const field = (tag: number): Uint8Array | undefined => envelope.fields.find((f) => f.tag === tag)?.value;
  const contentType = field(PINS_CONTENT_TYPE);
  const contentEncoding = field(PINS_CONTENT_ENCODING);
  const inscription: Inscription = {
    content_type_str: contentType ? bytesToUnicodeString(contentType) : 'undefined',
    body: body.slice(0, PINS_BODY_LIMIT),
    is_cropped: body.length > PINS_BODY_LIMIT,
    body_length: body.length,
    delegate_txid: pinsDelegateTxid(field(PINS_DELEGATE)),
  };
  if (contentEncoding) {
    inscription.content_encoding = bytesToUnicodeString(contentEncoding);
  }
  return inscription;
}
