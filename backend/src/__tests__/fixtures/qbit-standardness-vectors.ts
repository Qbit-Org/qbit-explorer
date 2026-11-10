// Vectors for qbit's standardness and sigop rules, which the backend and the frontend each implement:
// the backend in src/api/common.ts, src/api/transaction-utils.ts and src/utils/bitcoin-script.ts, the
// frontend in src/app/shared/transaction.utils.ts. Both run every vector here, the backend in
// src/__tests__/api/common.ts and transaction-utils.test.ts, the frontend in
// frontend/scripts/qbit-script-smoke.js, so a rule that changes in one copy only fails one of them.
//
// Keep this file free of imports: the frontend smoke compiles it with the frontend's TypeScript settings.
// Rules are from qbit v1.0.0 (Qbit-Org/qbit commit 7ebcddb622d6e639041f005a189b048ec2a221fe).

export interface VectorVout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  value: number;
}

export interface VectorVin {
  txid: string;
  vout: number;
  prevout: VectorVout | null;
  scriptsig: string;
  scriptsig_asm: string;
  inner_redeemscript_asm: string;
  inner_witnessscript_asm: string;
  witness: string[];
  is_coinbase: boolean;
  sequence: number;
}

export interface VectorTransaction {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  vsize: number;
  feePerVsize: number;
  effectiveFeePerVsize: number;
  sigops?: number;
  status: { confirmed: boolean };
  vin: VectorVin[];
  vout: VectorVout[];
}

export interface StandardnessVector {
  name: string;
  nonStandard: boolean;
  tx: () => VectorTransaction;
}

// qbit enforces its policy from genesis, far below Bitcoin's activation heights. The frontend names
// mainnet '' rather than 'mainnet'.
export const qbitHeights: [string, number | undefined][] = [
  ['mainnet', 158_366],
  ['mainnet', undefined],
  ['testnet4', 10_000],
  ['regtest', 101],
];

// every vector transaction has this txid, and its inputs spend outputs of PARENT_TXID
export const TXID = '33'.repeat(32);
export const PARENT_TXID = '22'.repeat(32);
const OTHER_PARENT_TXID = '44'.repeat(32);

export const bytes = (length: number): string => '00'.repeat(length);
const varIntLength = (n: number): number => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5);
export const witnessSize = (witness: string[]): number => varIntLength(witness.length)
  + witness.reduce((size, item) => size + varIntLength(item.length / 2) + item.length / 2, 0);

const KEY = `02${'11'.repeat(32)}`;
const SIGNATURE = '30'.repeat(71);

export const p2mrOutput = (value: number): VectorVout => ({
  scriptpubkey: `5220${'11'.repeat(32)}`,
  scriptpubkey_asm: `OP_PUSHNUM_2 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
  scriptpubkey_type: 'v2_p2mr',
  value,
});
export const anchorOutput = (value: number): VectorVout => ({
  scriptpubkey: '51024e73',
  scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_2 4e73',
  scriptpubkey_type: 'anchor',
  value,
});
const p2pkOutput: VectorVout = {
  scriptpubkey: `21${KEY}ac`,
  scriptpubkey_asm: `OP_PUSHBYTES_33 ${KEY} OP_CHECKSIG`,
  scriptpubkey_type: 'p2pk',
  value: 100_000,
};
const p2pkhOutput: VectorVout = {
  scriptpubkey: `76a914${'11'.repeat(20)}88ac`,
  scriptpubkey_asm: `OP_DUP OP_HASH160 OP_PUSHBYTES_20 ${'11'.repeat(20)} OP_EQUALVERIFY OP_CHECKSIG`,
  scriptpubkey_type: 'p2pkh',
  value: 100_000,
};
const p2shOutput: VectorVout = {
  scriptpubkey: `a914${'11'.repeat(20)}87`,
  scriptpubkey_asm: `OP_HASH160 OP_PUSHBYTES_20 ${'11'.repeat(20)} OP_EQUAL`,
  scriptpubkey_type: 'p2sh',
  value: 100_000,
};
const p2wpkhOutput: VectorVout = {
  scriptpubkey: `0014${'11'.repeat(20)}`,
  scriptpubkey_asm: `OP_0 OP_PUSHBYTES_20 ${'11'.repeat(20)}`,
  scriptpubkey_type: 'v0_p2wpkh',
  value: 100_000,
};
const p2wshOutput: VectorVout = {
  scriptpubkey: `0020${'11'.repeat(32)}`,
  scriptpubkey_asm: `OP_0 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
  scriptpubkey_type: 'v0_p2wsh',
  value: 100_000,
};
const nonStandardOutput: VectorVout = {
  scriptpubkey: 'ff',
  scriptpubkey_asm: 'OP_INVALIDOPCODE',
  scriptpubkey_type: 'nonstandard',
  value: 100_000,
};

// OP_RETURN followed by a single push of dataBytes bytes
function opReturnOutput(dataBytes: number): VectorVout {
  const data = 'ab'.repeat(dataBytes);
  let push = dataBytes.toString(16).padStart(2, '0');
  if (dataBytes > 0xff) {
    push = `4d${(dataBytes & 0xff).toString(16).padStart(2, '0')}${(dataBytes >> 8).toString(16).padStart(2, '0')}`;
  } else if (dataBytes > 75) {
    push = `4c${push}`;
  }
  return { scriptpubkey: `6a${push}${data}`, scriptpubkey_asm: `OP_RETURN ${data}`, scriptpubkey_type: 'op_return', value: 0 };
}

export const p2trOutput: VectorVout = {
  scriptpubkey: `5120${'11'.repeat(32)}`,
  scriptpubkey_asm: `OP_PUSHNUM_1 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
  scriptpubkey_type: 'v1_p2tr',
  value: 100_000,
};
// a 2-byte witness program, which no witness version defines
const witnessOutput = (version: number, value = 100_000): VectorVout => ({
  scriptpubkey: `${(0x50 + version).toString(16)}020000`,
  scriptpubkey_asm: `OP_PUSHNUM_${version} OP_PUSHBYTES_2 0000`,
  scriptpubkey_type: 'unknown',
  value,
});
// a bare 1-of-1 multisig output, which counts 20 sigops
const multisigOutput: VectorVout = {
  scriptpubkey: `5121${KEY}51ae`,
  scriptpubkey_asm: `OP_PUSHNUM_1 OP_PUSHBYTES_33 ${KEY} OP_PUSHNUM_1 OP_CHECKMULTISIG`,
  scriptpubkey_type: 'multisig',
  value: 1_000,
};

// control blocks for a single leaf: tapscript is leaf version 0xc0 with a 32-byte internal key,
// and a P2MR v1 leaf is the control byte 0xc0 with bit 0 set
const tapscriptControlBlock = `c0${'11'.repeat(32)}`;
const p2mrControlBlock = 'c1';
// leaf version 0xc2, which taproot and P2MR both reserve for upgrades
const otherLeafControlBlock = `c2${'11'.repeat(32)}`;
const otherP2mrLeafControlBlock = 'c3';
// a single-key P2MR spend: a PQC signature with its sighash byte, then <pubkey> OP_CHECKSIGPQC
const p2mrLeafScript = `20${'11'.repeat(32)}b3`;

export function input(prevout: VectorVout, scriptsig = '', scriptsig_asm = '', witness: string[] = []): VectorVin {
  return {
    txid: PARENT_TXID,
    vout: 0,
    prevout,
    scriptsig,
    scriptsig_asm,
    inner_redeemscript_asm: '',
    inner_witnessscript_asm: '',
    witness,
    is_coinbase: false,
    sequence: 0xfffffffd,
  };
}
const p2mrSpend = (...witness: string[]): VectorVin => input(p2mrOutput(100_000), '', '', witness);
const p2trSpend = (...witness: string[]): VectorVin => input(p2trOutput, '', '', witness);
const singleKeyP2mrSpends = (inputs: number): VectorVin[] => Array.from({ length: inputs }, () => p2mrSpend(bytes(3_681), p2mrLeafScript, p2mrControlBlock));

export function qbitTransaction({
  version = 2,
  fee = 1000,
  vin = [input(p2mrOutput(100_000))],
  vout = [p2mrOutput(99_000)],
}: { version?: number, fee?: number, vin?: VectorVin[], vout?: VectorVout[] } = {}): VectorTransaction {
  // qbit has no witness discount, so weight is the serialized size, with the witness marker and flag
  // and each input's witness when any input has one
  const witnesses = vin.filter(txin => txin.witness.length);
  const weight = 10
    + vin.reduce((size, txin) => size + 41 + txin.scriptsig.length / 2, 0)
    + vout.reduce((size, txout) => size + 9 + txout.scriptpubkey.length / 2, 0)
    + (witnesses.length ? 2 + witnesses.reduce((size, txin) => size + witnessSize(txin.witness), 0) : 0);
  return {
    txid: TXID,
    version,
    locktime: 0,
    size: weight,
    weight,
    fee,
    vsize: weight,
    feePerVsize: fee / weight,
    effectiveFeePerVsize: fee / weight,
    sigops: 0,
    status: { confirmed: false },
    vin,
    vout,
  };
}

// a transaction whose sigop cost is not reported, as for a decoded raw transaction, or a confirmed
// transaction from a non-esplora backend
const withoutSigops = (tx: VectorTransaction): VectorTransaction => ({ ...tx, sigops: undefined });

// each P2PK prevout carries one legacy sigop that the BIP54 limit counts at spend time
function legacySigopsTransaction(inputs: number): VectorTransaction {
  return qbitTransaction({
    vin: Array.from({ length: inputs }, () => input(p2pkOutput, `47${SIGNATURE}`, `OP_PUSHBYTES_71 ${SIGNATURE}`)),
  });
}

// A P2WSH spend of a 1-of-1 multisig whose key counts are pushed as data (OP_PUSHBYTES_1 01) rather
// than with OP_1, so qbitd counts its OP_CHECKMULTISIG as 20 sigops. bitcoinjs-lib decompiles a
// 1-byte push of 1 to 16 as OP_1 to OP_16, so the backend's regex over its ASM counted 1.
const nonMinimalMultisigScript = `0101${'21' + KEY}0101ae`;
const nonMinimalMultisigSpend = (): VectorVin => input(p2wshOutput, '', '', [nonMinimalMultisigScript]);

// A P2SH spend whose scriptsig pushes the redeem script, of up to 255 bytes, last
function p2shSpend(redeemScript: string, redeemScriptAsm: string): VectorVin {
  const size = redeemScript.length / 2;
  const push = size > 75 ? `4c${size.toString(16).padStart(2, '0')}` : size.toString(16).padStart(2, '0');
  const vin = input(p2shOutput, `${push}${redeemScript}`, `${size > 75 ? 'OP_PUSHDATA1' : `OP_PUSHBYTES_${size}`} ${redeemScript}`);
  return { ...vin, inner_redeemscript_asm: redeemScriptAsm };
}

// A P2PKH spend: a signature and a key, then whatever extra instructions it is given
function p2pkhSpend(extra = '', extraAsm = ''): VectorVin {
  return input(p2pkhOutput, `47${SIGNATURE}21${KEY}${extra}`, `OP_PUSHBYTES_71 ${SIGNATURE} OP_PUSHBYTES_33 ${KEY}${extraAsm ? ' ' + extraAsm : ''}`);
}

// a coinbase, whose outputs the standardness rules don't check
export function coinbaseTransaction(vout: VectorVout[]): VectorTransaction {
  const tx = qbitTransaction({ vout });
  return {
    ...tx,
    vin: [{ ...input(p2mrOutput(0), '0351a002', 'OP_PUSHBYTES_3 51a002'), txid: '00'.repeat(32), vout: 0xffffffff, prevout: null, is_coinbase: true }],
  };
}

export const standardnessVectors: StandardnessVector[] = [
  { name: 'a v3 (TRUC) transaction', nonStandard: false, tx: () => qbitTransaction({ version: 3 }) },
  { name: 'an anchor spend', nonStandard: false, tx: () => qbitTransaction({ vin: [input(anchorOutput(0)), input(p2mrOutput(100_000))] }) },
  { name: 'an OP_RETURN above 83 bytes', nonStandard: false, tx: () => qbitTransaction({ vout: [opReturnOutput(160), p2mrOutput(99_000)] }) },
  { name: 'multiple OP_RETURN outputs', nonStandard: false, tx: () => qbitTransaction({ vout: [opReturnOutput(20), opReturnOutput(20), p2mrOutput(99_000)] }) },
  { name: 'OP_RETURN outputs that fill the 200,000 byte budget', nonStandard: false, tx: () => qbitTransaction({ vout: [...Array(4)].map(() => opReturnOutput(49_996)) }) },
  { name: 'ephemeral dust in a zero-fee transaction', nonStandard: false, tx: () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(100_000)] }) },
  { name: '2,500 legacy sigops', nonStandard: false, tx: () => legacySigopsTransaction(2_500) },
  { name: 'a P2MR output at the 2,855 bit dust threshold', nonStandard: false, tx: () => qbitTransaction({ vout: [p2mrOutput(2_855)] }) },
  { name: 'outputs to undefined witness v1 and v2 programs at the 121 bit dust threshold', nonStandard: false, tx: () => qbitTransaction({ vout: [witnessOutput(1, 121), witnessOutput(2, 121)] }) },
  { name: 'a v3 transaction of 50,000 vB', nonStandard: false, tx: () => ({ ...qbitTransaction({ version: 3 }), weight: 50_000 }) },
  { name: 'a v3 transaction whose sigops adjust its vsize to 50,000 vB', nonStandard: false, tx: () => ({ ...qbitTransaction({ version: 3 }), sigops: 2_500 }) },
  { name: 'a v3 transaction with unreported sigops whose outputs count 2,500', nonStandard: false, tx: () => withoutSigops(qbitTransaction({ version: 3, vout: Array(125).fill(multisigOutput) })) },
  { name: 'a v3 transaction that spends 13 single-key P2MR inputs', nonStandard: false, tx: () => qbitTransaction({ version: 3, vin: singleKeyP2mrSpends(13) }) },
  { name: 'a v2 transaction that spends 14 single-key P2MR inputs', nonStandard: false, tx: () => qbitTransaction({ vin: singleKeyP2mrSpends(14) }) },
  { name: 'a P2MR leaf script argument of 16 KiB', nonStandard: false, tx: () => qbitTransaction({ vin: [p2mrSpend(bytes(16_384), p2mrLeafScript, p2mrControlBlock)] }) },
  { name: 'P2MR leaf script arguments of 128 KiB in total', nonStandard: false, tx: () => qbitTransaction({ vin: [p2mrSpend(...Array(8).fill(bytes(16_384)), p2mrLeafScript, p2mrControlBlock)] }) },
  { name: 'a tapscript argument of 80 bytes', nonStandard: false, tx: () => qbitTransaction({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock)] }) },

  { name: 'a v4 transaction', nonStandard: true, tx: () => qbitTransaction({ version: 4 }) },
  { name: 'OP_RETURN outputs over the 200,000 byte budget', nonStandard: true, tx: () => qbitTransaction({ vout: [...[...Array(3)].map(() => opReturnOutput(49_996)), opReturnOutput(49_997)] }) },
  { name: 'dust in a fee-paying transaction', nonStandard: true, tx: () => qbitTransaction({ version: 3, vout: [anchorOutput(0), p2mrOutput(99_000)] }) },
  { name: 'two dust outputs in a zero-fee transaction', nonStandard: true, tx: () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(1), p2mrOutput(99_999)] }) },
  { name: 'ephemeral dust followed by a non-standard output', nonStandard: true, tx: () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), nonStandardOutput] }) },
  { name: '2,501 legacy sigops', nonStandard: true, tx: () => legacySigopsTransaction(2_501) },
  { name: 'a P2MR output below the 2,855 bit dust threshold', nonStandard: true, tx: () => qbitTransaction({ vout: [p2mrOutput(2_854)] }) },
  { name: 'an output to an undefined witness v1 program below the 121 bit dust threshold', nonStandard: true, tx: () => qbitTransaction({ vout: [witnessOutput(1, 120), p2mrOutput(99_000)] }) },
  ...[...Array(14)].map((_, i): StandardnessVector => ({ name: `an output to reserved witness v${i + 3}`, nonStandard: true, tx: () => qbitTransaction({ vout: [p2mrOutput(99_000), witnessOutput(i + 3)] }) })),
  { name: 'a v3 transaction over 50,000 vB', nonStandard: true, tx: () => ({ ...qbitTransaction({ version: 3 }), weight: 50_001 }) },
  { name: 'a v3 transaction whose sigops adjust its vsize over 50,000 vB', nonStandard: true, tx: () => ({ ...qbitTransaction({ version: 3 }), sigops: 2_501 }) },
  { name: 'a v3 transaction with unreported sigops whose outputs count 2,520', nonStandard: true, tx: () => withoutSigops(qbitTransaction({ version: 3, vout: Array(126).fill(multisigOutput) })) },
  { name: 'a v3 transaction that spends 14 single-key P2MR inputs', nonStandard: true, tx: () => qbitTransaction({ version: 3, vin: singleKeyP2mrSpends(14) }) },
  { name: 'a P2MR spend with an annex', nonStandard: true, tx: () => qbitTransaction({ vin: [p2mrSpend(bytes(3_681), p2mrLeafScript, p2mrControlBlock, '50')] }) },
  { name: 'a P2MR spend without a leaf script', nonStandard: true, tx: () => qbitTransaction({ vin: [p2mrSpend(p2mrControlBlock)] }) },
  { name: 'a P2MR spend with an empty control block', nonStandard: true, tx: () => qbitTransaction({ vin: [p2mrSpend(bytes(3_681), p2mrLeafScript, '')] }) },
  { name: 'a P2MR leaf script argument over 16 KiB', nonStandard: true, tx: () => qbitTransaction({ vin: [p2mrSpend(bytes(16_385), p2mrLeafScript, p2mrControlBlock)] }) },
  { name: 'P2MR leaf script arguments over 128 KiB in total', nonStandard: true, tx: () => qbitTransaction({ vin: [p2mrSpend(...Array(8).fill(bytes(16_384)), bytes(1), p2mrLeafScript, p2mrControlBlock)] }) },
  { name: 'a tapscript argument over 80 bytes', nonStandard: true, tx: () => qbitTransaction({ vin: [p2trSpend(bytes(81), '51', tapscriptControlBlock)] }) },
  { name: 'a taproot script path spend with an empty control block', nonStandard: true, tx: () => qbitTransaction({ vin: [p2trSpend(bytes(1), '51', '')] }) },
  { name: 'a taproot script path spend of another leaf version', nonStandard: true, tx: () => qbitTransaction({ vin: [p2trSpend(bytes(1), '51', otherLeafControlBlock)] }) },
  { name: 'a P2MR spend of another leaf version', nonStandard: true, tx: () => qbitTransaction({ vin: [p2mrSpend(bytes(3_681), p2mrLeafScript, otherP2mrLeafControlBlock)] }) },
  { name: 'a non-standard input after a tapscript spend', nonStandard: true, tx: () => qbitTransaction({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock), input(witnessOutput(1))] }) },
  { name: 'a non-standard output after a tapscript spend', nonStandard: true, tx: () => qbitTransaction({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock)], vout: [p2mrOutput(99_000), nonStandardOutput] }) },

  // Sigops and push-only scriptsigs, read from the decoded scripts
  { name: 'a scriptsig of pushes', nonStandard: false, tx: () => qbitTransaction({ vin: [p2pkhSpend()] }) },
  { name: 'a scriptsig with an instruction other than a push', nonStandard: true, tx: () => qbitTransaction({ vin: [p2pkhSpend('61', 'OP_NOP')] }) },
  { name: 'a P2SH spend whose redeem script counts 15 sigops', nonStandard: false, tx: () => qbitTransaction({ vin: [p2shSpend('ac'.repeat(15), Array(15).fill('OP_CHECKSIG').join(' '))] }) },
  { name: 'a P2SH spend whose redeem script counts 16 sigops', nonStandard: true, tx: () => qbitTransaction({ vin: [p2shSpend('ac'.repeat(16), Array(16).fill('OP_CHECKSIG').join(' '))] }) },
  { name: 'a v3 transaction with unreported sigops whose P2WSH witness scripts count 2,500, with key counts pushed as data', nonStandard: false, tx: () => withoutSigops(qbitTransaction({ version: 3, vin: Array.from({ length: 125 }, nonMinimalMultisigSpend) })) },
  { name: 'a v3 transaction with unreported sigops whose P2WSH witness scripts count 2,520, with key counts pushed as data', nonStandard: true, tx: () => withoutSigops(qbitTransaction({ version: 3, vin: Array.from({ length: 126 }, nonMinimalMultisigSpend) })) },

];

// the thresholds qbit v1.0.0 pins in src/test/transaction_tests.cpp: every output but P2MR is priced
// with the 148-byte legacy spend, as qbit has no witness discount, and the fee is rounded up
export const dustThresholdVectors: [string, string, number][] = [
  ['compressed P2PK', `21${'02'.repeat(33)}ac`, 144],
  ['uncompressed P2PK', `41${'04'.repeat(65)}ac`, 168],
  ['P2PKH', `76a914${'00'.repeat(20)}88ac`, 137],
  ['P2SH', `a914${'00'.repeat(20)}87`, 135],
  ['P2WPKH', `0014${'00'.repeat(20)}`, 135],
  ['P2WSH', `0020${'00'.repeat(32)}`, 144],
  ['P2TR', `5120${'00'.repeat(32)}`, 144],
  ['P2MR', `5220${'00'.repeat(32)}`, 2855],
  ['an unknown witness v1 program', '51020000', 121],
  ['an unknown witness v2 program', '52020000', 121],
  ['an anchor', '51024e73', 121],
  ['an OP_RETURN', `6a14${'00'.repeat(20)}`, 0],
];

// qbitd's CScript::GetSigOpCount over hex scripts: [name, script, accurate, sigops]. Accurate counting is
// for redeem and witness scripts; scriptsigs and outputs count every OP_CHECKMULTISIG as 20.
export const scriptSigopVectors: [string, string, boolean, number][] = [
  ['OP_CHECKSIG and OP_CHECKSIGVERIFY', 'acad', false, 2],
  ['OP_CHECKSIGPQC after a 32-byte key', `20${'11'.repeat(32)}b3`, false, 0],
  ['OP_CHECKSIGADD', 'ba', true, 0],
  ['OP_2 OP_CHECKMULTISIG, counted accurately', '52ae', true, 2],
  ['OP_2 OP_CHECKMULTISIG, counted as in an output', '52ae', false, 20],
  ['OP_16 OP_CHECKMULTISIGVERIFY', '60af', true, 16],
  ['OP_0 OP_CHECKMULTISIG', '00ae', true, 20],
  ['OP_1NEGATE OP_CHECKMULTISIG', '4fae', true, 20],
  ['an OP_CHECKMULTISIG after another', 'aeae', true, 40],
  ['OP_CHECKMULTISIG after a key count pushed as data', '0102ae', true, 20],
  ['OP_CHECKSIG bytes inside a push', '03acacac', false, 0],
  ['OP_CHECKSIG after OP_PUSHDATA1, 2 and 4 pushes', `4c01aa4d0100aa4e01000000aaac`, false, 1],
  ['OP_CHECKSIG before a push that runs past the end', 'ac4c05aabb', false, 1],
  ['OP_CHECKSIG after a push that runs past the end', '4c05aabbac', false, 0],
  ['a push whose size runs past the end', '4d01', false, 0],
];

// qbitd's CScript::IsPushOnly over hex scripts: [name, script, push-only]
export const pushOnlyVectors: [string, string, boolean][] = [
  ['an empty script', '', true],
  ['pushes of data', `47${SIGNATURE}21${KEY}`, true],
  ['OP_0, OP_1NEGATE and OP_1 to OP_16', '004f5160', true],
  ['OP_RESERVED, which qbitd treats as a push', '50', true],
  ['OP_NOP', '61', false],
  ['OP_CHECKSIG after a push', '01aaac', false],
  ['a push that runs past the end', '05aabb', false],
];

// The sigop cost qbitd gives a transaction (GetTransactionSigOpCost): [name, transaction, cost]
export const transactionSigopVectors: [string, () => VectorTransaction, number][] = [
  ['a P2MR spend to P2MR', () => qbitTransaction(), 0],
  ['a P2PKH spend to P2PKH, whose output counts', () => qbitTransaction({ vin: [p2pkhSpend()], vout: [p2pkhOutput] }), 1],
  ['a bare 1-of-1 multisig output', () => qbitTransaction({ vout: [multisigOutput] }), 20],
  ['a P2WPKH spend', () => qbitTransaction({ vin: [input(p2wpkhOutput, '', '', [SIGNATURE, KEY])] }), 1],
  ['a P2SH-wrapped P2WPKH spend', () => qbitTransaction({ vin: [{ ...p2shSpend(`0014${'11'.repeat(20)}`, `OP_0 OP_PUSHBYTES_20 ${'11'.repeat(20)}`), witness: [SIGNATURE, KEY] }] }), 1],
  ['a P2WSH spend of a 2-of-3 multisig', () => qbitTransaction({ vin: [input(p2wshOutput, '', '', ['', SIGNATURE, SIGNATURE, `52${('21' + KEY).repeat(3)}53ae`])] }), 3],
  ['a P2SH-wrapped P2WSH spend of a 2-of-3 multisig', () => qbitTransaction({ vin: [{ ...p2shSpend(`0020${'11'.repeat(32)}`, `OP_0 OP_PUSHBYTES_32 ${'11'.repeat(32)}`), witness: ['', SIGNATURE, SIGNATURE, `52${('21' + KEY).repeat(3)}53ae`] }] }), 3],
  ['a P2SH spend of a 2-of-3 multisig', () => qbitTransaction({ vin: [p2shSpend(`52${('21' + KEY).repeat(3)}53ae`, `OP_PUSHNUM_2${` OP_PUSHBYTES_33 ${KEY}`.repeat(3)} OP_PUSHNUM_3 OP_CHECKMULTISIG`)] }), 3],
  ['a P2WSH spend whose witness script pushes its key counts as data', () => qbitTransaction({ vin: [nonMinimalMultisigSpend()] }), 20],
  ['a P2WSH spend whose witness script ends in a push that runs past the end', () => qbitTransaction({ vin: [input(p2wshOutput, '', '', ['ac4c05aabb'])] }), 1],
  ['a P2WSH spend without its prevout, whose sigops are unknown', () => qbitTransaction({ vin: [{ ...nonMinimalMultisigSpend(), prevout: null }] }), 0],
];

// Real transactions with the sigop cost esplora reported for them. b10c00... spends every input type on
// Bitcoin, where esplora reported 115: legacy and P2SH sigops cost 4 there, 4 * (22 + 5) + 7. qbit has no
// witness discount, so the same scripts cost 22 + 5 + 7. [test-data file, txid, cost]
export const realTransactionSigopVectors: [string, string, number][] = [
  ['transactions-random.json', 'b10c0000004da5a9d1d9b4ae32e09f0b3e62d21a5cce5428d4ad714fb444eb5d', 34],
];

// A transaction serialized as qbitd serializes it, with the witness marker and flag when any input has a witness
export function serializeTransaction(tx: { version: number, locktime: number, vin: { txid: string, vout: number, scriptsig: string, sequence: number, witness?: string[] }[], vout: { value: number, scriptpubkey: string }[] }): string {
  const le = (n: number, size: number): string => {
    let hex = '';
    for (let i = 0; i < size; i++) {
      hex += (Math.floor(n / 256 ** i) % 256).toString(16).padStart(2, '0');
    }
    return hex;
  };
  const varInt = (n: number): string => (n < 0xfd ? le(n, 1) : n <= 0xffff ? `fd${le(n, 2)}` : `fe${le(n, 4)}`);
  const hasWitness = tx.vin.some(vin => vin.witness?.length);
  let hex = le(tx.version, 4) + (hasWitness ? '0001' : '') + varInt(tx.vin.length);
  for (const vin of tx.vin) {
    hex += (vin.txid.match(/../g) || []).reverse().join('') + le(vin.vout, 4) + varInt(vin.scriptsig.length / 2) + vin.scriptsig + le(vin.sequence, 4);
  }
  hex += varInt(tx.vout.length);
  for (const vout of tx.vout) {
    hex += le(vout.value, 8) + varInt(vout.scriptpubkey.length / 2) + vout.scriptpubkey;
  }
  if (hasWitness) {
    for (const vin of tx.vin) {
      hex += varInt(vin.witness?.length || 0) + (vin.witness || []).map(item => varInt(item.length / 2) + item).join('');
    }
  }
  return hex + le(tx.locktime, 4);
}

// qbit's weight of raw transactions (qbitd's GetTransactionWeight), which with qbit's witness scale factor
// of 1 is their size, where Bitcoin's weight counts the size without witnesses 3 more times:
// [name, raw transaction, weight]. MAX_PUSH_TX_SIZE_WEIGHT, 400,000 by default, caps pushed transactions.
export const weightVectors: [string, () => string, number][] = [
  ['a P2MR spend', () => serializeTransaction(qbitTransaction({ vin: [p2mrSpend(bytes(3_681), p2mrLeafScript, p2mrControlBlock)] })), 3_818],
  ['a transaction of 200,095 bytes without witnesses', () => serializeTransaction(qbitTransaction({ vout: [...Array(4)].map(() => opReturnOutput(49_996)) })), 200_095],
  ['a transaction of 400,001 bytes without witnesses', () => serializeTransaction(qbitTransaction({ vout: [...[...Array(7)].map(() => opReturnOutput(57_000)), opReturnOutput(830)] })), 400_001],
];

// Script ASM as qbitd and qbit-electrs name qbit's opcodes (qbit v1.0.0 src/script/script.h:300-321):
// [name, script, ASM]
export const asmVectors: [string, string, string][] = [
  ['OP_CHECKSIGPQC', 'b3', 'OP_CHECKSIGPQC'],
  ['OP_CHECKSIGADD', 'ba', 'OP_CHECKSIGADD'],
  ['qbit\'s other P2MR opcodes', 'bbbcbd', 'OP_CHECKTEMPLATEVERIFY OP_CHECKDATASIGPQC OP_CHECKDATASIGADDPQC'],
  ['a CTV leaf script', `20${'ee'.repeat(32)}bb`, `OP_PUSHBYTES_32 ${'ee'.repeat(32)} OP_CHECKTEMPLATEVERIFY`],
  ['an opcode qbit leaves undefined', 'be', 'OP_RETURN_190'],
];

// Real P2MR spends whose leaf script ASM, as qbit-electrs printed it, the explorer must reproduce from the
// witness, and whose weight, as qbit-electrs reported it, the explorer must compute: [test-data file, key]
// (an index, or a key of a file that holds named transactions)
export const realTransactionVectors: [string, string | number][] = [
  ['qbit-p2mr-qscriptions.json', 'etching'],
  ['qbit-p2mr-qscriptions.json', 'mint'],
  ['qbit-standard-txs.json', 0],
];

// For /tx/preview only: rules qbitd applies when a transaction reaches its mempool, which a transaction in
// the mempool or a block has passed. The backend never classifies a transaction qbitd hasn't seen, so
// only the frontend implements them, and only the frontend smoke runs these vectors.

// an unconfirmed transaction the vector transactions spend: by default a v3 one with two P2MR outputs
const unconfirmedParent = ({ version = 3, vout = [p2mrOutput(100_000), p2mrOutput(100_000)], txid = PARENT_TXID }: { version?: number, vout?: VectorVout[], txid?: string } = {}): VectorTransaction => (
  { ...qbitTransaction({ version, vout }), txid }
);
// a transaction that spends the given outputs of PARENT_TXID
function spendsParent(vouts: number[], { version = 3, weight }: { version?: number, weight?: number } = {}): VectorTransaction {
  const tx = qbitTransaction({ version, vin: vouts.map(vout => ({ ...input(p2mrOutput(100_000)), vout })) });
  return weight ? { ...tx, weight } : tx;
}

export interface ParentVector {
  name: string;
  nonStandard: boolean;
  tx: () => VectorTransaction;
  // the unconfirmed transactions it spends; its other inputs spend confirmed ones
  parents: () => VectorTransaction[];
}

// qbitd's rules on a transaction's unconfirmed parents (qbit v1.0.0 src/policy/truc_policy.cpp:164-243
// SingleTRUCChecks, src/policy/ephemeral_policy.cpp:33-95 CheckEphemeralSpends)
export const parentVectors: ParentVector[] = [
  // a v3 transaction that spends an unconfirmed one must be within 45,500 sigop-adjusted vB
  // (truc_policy.h:33-40). qbit sized it to admit a 12-input P2MR child.
  { name: 'a v3 transaction of 45,500 vB that spends an unconfirmed v3 transaction', nonStandard: false, tx: () => spendsParent([0], { weight: 45_500 }), parents: () => [unconfirmedParent()] },
  { name: 'a v3 transaction over 45,500 vB that spends an unconfirmed v3 transaction', nonStandard: true, tx: () => spendsParent([0], { weight: 45_501 }), parents: () => [unconfirmedParent()] },
  { name: 'a v3 transaction whose sigops adjust its vsize over 45,500 vB, that spends an unconfirmed v3 transaction', nonStandard: true, tx: () => ({ ...spendsParent([0]), sigops: 2_276 }), parents: () => [unconfirmedParent()] },
  { name: 'a v3 transaction that spends 12 single-key P2MR inputs of an unconfirmed v3 transaction', nonStandard: false, tx: () => qbitTransaction({ version: 3, vin: singleKeyP2mrSpends(12) }), parents: () => [unconfirmedParent()] },
  { name: 'a v3 transaction that spends 13 single-key P2MR inputs of an unconfirmed v3 transaction', nonStandard: true, tx: () => qbitTransaction({ version: 3, vin: singleKeyP2mrSpends(13) }), parents: () => [unconfirmedParent()] },
  { name: 'a v3 transaction over 45,500 vB whose parent is confirmed', nonStandard: false, tx: () => spendsParent([0], { weight: 45_501 }), parents: () => [] },
  { name: 'a v2 transaction over 45,500 vB that spends an unconfirmed v2 transaction', nonStandard: false, tx: () => spendsParent([0], { version: 2, weight: 45_501 }), parents: () => [unconfirmedParent({ version: 2 })] },
  // while unconfirmed, a v3 transaction spends only v3 transactions, and other versions spend none
  { name: 'a v3 transaction that spends an unconfirmed v2 transaction', nonStandard: true, tx: () => spendsParent([0]), parents: () => [unconfirmedParent({ version: 2 })] },
  { name: 'a v2 transaction that spends an unconfirmed v3 transaction', nonStandard: true, tx: () => spendsParent([0], { version: 2 }), parents: () => [unconfirmedParent()] },
  { name: 'a v2 transaction that spends an unconfirmed v2 transaction', nonStandard: false, tx: () => spendsParent([0], { version: 2 }), parents: () => [unconfirmedParent({ version: 2 })] },
  { name: 'a v3 transaction that spends a confirmed v2 transaction', nonStandard: false, tx: () => spendsParent([0]), parents: () => [] },
  // a v3 transaction has at most one unconfirmed ancestor (TRUC_ANCESTOR_LIMIT)
  { name: 'a v3 transaction that spends two unconfirmed v3 transactions', nonStandard: true, tx: () => qbitTransaction({ version: 3, vin: [input(p2mrOutput(100_000)), { ...input(p2mrOutput(100_000)), txid: OTHER_PARENT_TXID }] }), parents: () => [unconfirmedParent(), unconfirmedParent({ txid: OTHER_PARENT_TXID })] },
  // a transaction that spends an unconfirmed parent must spend all of its dust
  { name: 'a transaction that spends an unconfirmed parent\'s ephemeral dust and its other output', nonStandard: false, tx: () => spendsParent([0, 1]), parents: () => [unconfirmedParent({ vout: [anchorOutput(0), p2mrOutput(100_000)] })] },
  { name: 'a transaction that spends an unconfirmed parent\'s ephemeral dust only', nonStandard: false, tx: () => spendsParent([0]), parents: () => [unconfirmedParent({ vout: [anchorOutput(0), p2mrOutput(100_000)] })] },
  { name: 'a transaction that spends an unconfirmed parent\'s other output but not its ephemeral dust', nonStandard: true, tx: () => spendsParent([1]), parents: () => [unconfirmedParent({ vout: [anchorOutput(0), p2mrOutput(100_000)] })] },
  { name: 'a transaction that spends a confirmed parent\'s output but not its dust', nonStandard: false, tx: () => spendsParent([1]), parents: () => [] },
];

// /tx/preview's flags for a transaction that may still lack signatures: [name, transaction, what its
// missing signatures add (weight, and size without witnesses), its unconfirmed parents or null when the
// page couldn't load them, non-standard]
const unsignedP2mrSpends = (inputs: number): VectorTransaction => qbitTransaction({ version: 3, vin: Array.from({ length: inputs }, () => input(p2mrOutput(100_000))) });
// a single-key P2MR spend's witness, and the witness marker and flag: weight, but no size without witnesses
const p2mrSignatures = (inputs: number): { weight: number, nonWitnessSize: number } => (
  { weight: 2 + inputs * witnessSize([bytes(3_681), p2mrLeafScript, p2mrControlBlock]), nonWitnessSize: 0 }
);
// a P2PKH spend's scriptsig, a signature and a key, which is outside the witness
const p2pkhScriptsig = { weight: 1 + 72 + 1 + 33, nonWitnessSize: 1 + 72 + 1 + 33 };
const signed = { weight: 0, nonWitnessSize: 0 };
export const previewVectors: [string, () => VectorTransaction, { weight: number, nonWitnessSize: number }, (() => VectorTransaction[]) | null, boolean][] = [
  ['an unsigned v3 spend of 12 P2MR inputs of an unconfirmed v3 transaction, within 45,500 vB once signed', () => unsignedP2mrSpends(12), p2mrSignatures(12), () => [unconfirmedParent()], false],
  ['an unsigned v3 spend of 13 P2MR inputs of an unconfirmed v3 transaction, over 45,500 vB once signed', () => unsignedP2mrSpends(13), p2mrSignatures(13), () => [unconfirmedParent()], true],
  ['an unsigned v3 spend of 13 P2MR inputs whose parents the page couldn\'t load', () => unsignedP2mrSpends(13), p2mrSignatures(13), null, false],
  ['an unsigned v3 spend of 14 P2MR inputs, over 50,000 vB once signed, whose parents the page couldn\'t load', () => unsignedP2mrSpends(14), p2mrSignatures(14), null, true],
  // tx-size-small: under 65 bytes without witnesses once signed, which a P2MR signature doesn't change
  ['an unsigned P2MR spend to a small OP_RETURN, 63 bytes without witnesses once signed', () => qbitTransaction({ vout: [opReturnOutput(1)] }), p2mrSignatures(1), () => [], true],
  ['an unsigned P2PKH spend to a small OP_RETURN, whose scriptsig makes it 170 bytes without witnesses', () => qbitTransaction({ vin: [input(p2pkhOutput)], vout: [opReturnOutput(1)] }), p2pkhScriptsig, () => [], false],
  ['a v3 transaction that spends an unconfirmed v2 transaction', () => spendsParent([0]), signed, () => [unconfirmedParent({ version: 2 })], true],
  ['a v3 transaction whose parents the page couldn\'t load', () => spendsParent([0]), signed, null, false],
  ['a transaction with a P2PKH output', () => qbitTransaction({ vout: [p2mrOutput(100_000), p2pkhOutput] }), signed, () => [], true],
];

// qbit's restricted output mode (consensus, qbit v1.0.0 src/consensus/restricted_outputs.h): only P2MR,
// OP_RETURN and anchor outputs, and witness v3 to v16, which policy rejects anyway. It is on from genesis
// on every network but regtest, where -p2mronly=0 turns it off, so the preview doesn't check it there.
// [name, transaction, whether its outputs are allowed]. Each transaction is standard otherwise.
// a transaction that pays a P2MR output and the given one, and is standard otherwise
const withP2mrOutput = (vout: VectorVout): VectorTransaction => qbitTransaction({ vout: [p2mrOutput(100_000), vout] });
export const restrictedOutputVectors: [string, () => VectorTransaction, boolean][] = [
  ['a P2MR output', () => withP2mrOutput(p2mrOutput(100_000)), true],
  ['an OP_RETURN output', () => withP2mrOutput(opReturnOutput(20)), true],
  ['an anchor output', () => withP2mrOutput(anchorOutput(100_000)), true],
  ['a P2PK output', () => withP2mrOutput(p2pkOutput), false],
  ['a P2PKH output', () => withP2mrOutput(p2pkhOutput), false],
  ['a P2SH output', () => withP2mrOutput(p2shOutput), false],
  ['a P2WPKH output', () => withP2mrOutput(p2wpkhOutput), false],
  ['a P2WSH output', () => withP2mrOutput(p2wshOutput), false],
  ['a P2TR output', () => withP2mrOutput(p2trOutput), false],
  ['a bare multisig output', () => withP2mrOutput(multisigOutput), false],
  ['an output to a 2-byte witness v1 program other than the anchor', () => withP2mrOutput(witnessOutput(1)), false],
  ['an output to a 2-byte witness v2 program', () => withP2mrOutput(witnessOutput(2)), false],
  ['a coinbase with a P2PKH output', () => coinbaseTransaction([p2mrOutput(100_000), p2pkhOutput]), false],
];
