#!/usr/bin/env node

const path = require('path');
const Module = require('module');

const frontendRoot = path.resolve(__dirname, '..');
// compile like the app: with ts-node's ES5 default, for...of over an iterator such as matchAll() never runs
require('ts-node').register({
  project: path.join(frontendRoot, 'tsconfig.base.json'),
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
});
const aliases = {
  '@app/': path.join(frontendRoot, 'src/app/'),
  '@components/': path.join(frontendRoot, 'src/app/components/'),
  '@environments/': path.join(frontendRoot, 'src/environments/'),
  '@interfaces/': path.join(frontendRoot, 'src/app/interfaces/'),
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  for (const [prefix, target] of Object.entries(aliases)) {
    if (request.startsWith(prefix)) {
      return originalResolveFilename.call(this, path.join(target, request.slice(prefix.length)), parent, isMain, options);
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

globalThis.window = { __env: {} };
globalThis.$localize = (strings, ...values) => String.raw({ raw: strings }, ...values);

const { TransactionFlags } = require('../src/app/shared/filters.utils.ts');
const {
  addressToScriptPubKey,
  countScriptSigops,
  decodeRawTransaction,
  getDustThreshold,
  getTransactionFlags,
  isNonStandard,
  scriptPubKeyToAddress,
} = require('../src/app/shared/transaction.utils.ts');
const { formatScriptPubKeyType, getReservedWitnessVersion } = require('../src/app/shared/scriptpubkey-type.utils.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const anchor = scriptPubKeyToAddress('51024e73', 'testnet4');
assert(anchor.type === 'anchor', `anchor type mismatch: ${JSON.stringify(anchor)}`);
assert(anchor.address === 'tq1pfeespgdghm', `anchor address mismatch: ${JSON.stringify(anchor)}`);
assert(
  JSON.stringify(addressToScriptPubKey(anchor.address, 'testnet4')) === JSON.stringify({ scriptPubKey: '51024e73', type: 'anchor' }),
  'anchor lowercase round-trip failed',
);
assert(
  JSON.stringify(addressToScriptPubKey(anchor.address.toUpperCase(), 'testnet4')) === JSON.stringify({ scriptPubKey: '51024e73', type: 'anchor' }),
  'anchor uppercase round-trip failed',
);

const tx = {
  txid: 'anchor-flags',
  version: 2,
  locktime: 0,
  size: 100,
  weight: 400,
  fee: 1000,
  vsize: 100,
  status: { confirmed: false },
  vin: [{
    txid: '00'.repeat(32),
    vout: 0,
    prevout: {
      scriptpubkey: '51024e73',
      scriptpubkey_asm: 'OP_1 OP_PUSHBYTES_2 4e73',
      scriptpubkey_type: 'anchor',
      scriptpubkey_address: anchor.address,
      value: 100000,
    },
    scriptsig: '',
    scriptsig_asm: '',
    witness: [],
    is_coinbase: false,
    sequence: 0xffffffff,
  }],
  vout: [{
    scriptpubkey: '51024e73',
    scriptpubkey_asm: 'OP_1 OP_PUSHBYTES_2 4e73',
    scriptpubkey_type: 'anchor',
    scriptpubkey_address: anchor.address,
    value: 90000,
  }],
};

const flags = getTransactionFlags(tx, undefined, false, undefined, 'testnet4');
assert((flags & TransactionFlags.anchor) === TransactionFlags.anchor, 'anchor flag missing');

assert(formatScriptPubKeyType('witness_v2_p2mr') === 'P2MR', 'wire P2MR label failed');
assert(formatScriptPubKeyType('anchor') === 'Anchor', 'anchor label failed');
assert(formatScriptPubKeyType('unknown', '5302abcd') === 'Reserved witness v3', 'reserved v3 label failed');
assert(formatScriptPubKeyType('witness_unknown', '6002abcd') === 'Reserved witness v16', 'reserved v16 label failed');
assert(formatScriptPubKeyType('nonstandard', '5402abcd') === 'Reserved witness v4', 'reserved nonstandard label failed');
assert(getReservedWitnessVersion('5302ab') === null, 'malformed reserved witness accepted');

const raw = '0200000001' + '00'.repeat(32) + 'ffffffff00ffffffff01000000000000000001b300000000';
const decoded = decodeRawTransaction(raw, 'testnet4').tx;
assert(decoded.vout[0].scriptpubkey_asm === 'OP_CHECKSIGPQC', `0xb3 ASM mismatch: ${decoded.vout[0].scriptpubkey_asm}`);

// qbit enforces its standardness policy from genesis, far below Bitcoin's activation heights.
// Keep these cases in sync with the backend 'qbit standardness policy' tests.
const p2mrOutput = (value) => ({
  scriptpubkey: `5220${'11'.repeat(32)}`,
  scriptpubkey_asm: `OP_PUSHNUM_2 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
  scriptpubkey_type: 'v2_p2mr',
  value,
});
const anchorOutput = (value) => ({
  scriptpubkey: '51024e73',
  scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_2 4e73',
  scriptpubkey_type: 'anchor',
  value,
});
const p2pkOutput = {
  scriptpubkey: `2102${'11'.repeat(32)}ac`,
  scriptpubkey_asm: `OP_PUSHBYTES_33 02${'11'.repeat(32)} OP_CHECKSIG`,
  scriptpubkey_type: 'p2pk',
  value: 100000,
};
const nonStandardOutput = {
  scriptpubkey: 'ff',
  scriptpubkey_asm: 'OP_INVALIDOPCODE',
  scriptpubkey_type: 'nonstandard',
  value: 100000,
};

// OP_RETURN followed by a single push of dataBytes bytes
function opReturnOutput(dataBytes) {
  const data = 'ab'.repeat(dataBytes);
  let push = dataBytes.toString(16).padStart(2, '0');
  if (dataBytes > 0xff) {
    push = `4d${(dataBytes & 0xff).toString(16).padStart(2, '0')}${(dataBytes >> 8).toString(16).padStart(2, '0')}`;
  } else if (dataBytes > 75) {
    push = `4c${push}`;
  }
  return { scriptpubkey: `6a${push}${data}`, scriptpubkey_asm: `OP_RETURN ${data}`, scriptpubkey_type: 'op_return', value: 0 };
}

const p2trOutput = {
  scriptpubkey: `5120${'11'.repeat(32)}`,
  scriptpubkey_asm: `OP_PUSHNUM_1 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
  scriptpubkey_type: 'v1_p2tr',
  value: 100000,
};
// a 2-byte witness program, which no witness version defines
const witnessOutput = (version, value = 100000) => ({
  scriptpubkey: `${(0x50 + version).toString(16)}020000`,
  scriptpubkey_asm: `OP_PUSHNUM_${version} OP_PUSHBYTES_2 0000`,
  scriptpubkey_type: 'unknown',
  value,
});
// control blocks for a single leaf: tapscript is leaf version 0xc0 with a 32-byte internal key,
// and a P2MR v1 leaf is the control byte 0xc0 with bit 0 set
const tapscriptControlBlock = `c0${'11'.repeat(32)}`;
const p2mrControlBlock = 'c1';
// leaf version 0xc2, which taproot and P2MR both reserve for upgrades
const otherLeafControlBlock = `c2${'11'.repeat(32)}`;
const otherP2mrLeafControlBlock = 'c3';
// a bare 1-of-1 multisig output, which counts 20 sigops
const multisigOutput = {
  scriptpubkey: `5121${'02' + '11'.repeat(32)}51ae`,
  scriptpubkey_asm: `OP_PUSHNUM_1 OP_PUSHBYTES_33 02${'11'.repeat(32)} OP_PUSHNUM_1 OP_CHECKMULTISIG`,
  scriptpubkey_type: 'multisig',
  value: 1000,
};
// a transaction whose sigop cost is not reported, as for a decoded raw transaction
const withoutSigops = (tx) => ({ ...tx, sigops: undefined });
// a single-key P2MR spend: a PQC signature with its sighash byte, then <pubkey> OP_CHECKSIGPQC
const p2mrLeafScript = `20${'11'.repeat(32)}b3`;
const bytes = (length) => '00'.repeat(length);

function standardnessInput(prevout, scriptsig = '', scriptsig_asm = '', witness = []) {
  return {
    txid: '22'.repeat(32),
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
const p2mrSpend = (...witness) => standardnessInput(p2mrOutput(100000), '', '', witness);
const p2trSpend = (...witness) => standardnessInput(p2trOutput, '', '', witness);
const singleKeyP2mrSpends = (inputs) => Array.from({ length: inputs }, () => p2mrSpend(bytes(3681), p2mrLeafScript, p2mrControlBlock));

const varIntLength = (n) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : 5);
const witnessSize = (witness) => varIntLength(witness.length) + witness.reduce((size, item) => size + varIntLength(item.length / 2) + item.length / 2, 0);

function standardnessTx({ version = 2, fee = 1000, vin = [standardnessInput(p2mrOutput(100000))], vout = [p2mrOutput(99000)] } = {}) {
  // qbit has no witness discount, so weight is the serialized size, with the witness marker and flag
  // and each input's witness when any input has one
  const witnesses = vin.filter((txin) => txin.witness.length);
  const weight = 10
    + vin.reduce((size, txin) => size + 41 + txin.scriptsig.length / 2, 0)
    + vout.reduce((size, txout) => size + 9 + txout.scriptpubkey.length / 2, 0)
    + (witnesses.length ? 2 + witnesses.reduce((size, txin) => size + witnessSize(txin.witness), 0) : 0);
  return { txid: 'qbit-standardness', version, locktime: 0, size: weight, weight, fee, sigops: 0, status: { confirmed: false }, vin, vout };
}

// each P2PK prevout carries one legacy sigop that the BIP54 limit counts at spend time
function legacySigopsTx(inputs) {
  const signature = '30'.repeat(71);
  return standardnessTx({
    vin: Array.from({ length: inputs }, () => standardnessInput(p2pkOutput, `47${signature}`, `OP_PUSHBYTES_71 ${signature}`)),
  });
}

const standardnessCases = [
  ['a v3 (TRUC) transaction', false, () => standardnessTx({ version: 3 })],
  ['an anchor spend', false, () => standardnessTx({ vin: [standardnessInput(anchorOutput(0)), standardnessInput(p2mrOutput(100000))] })],
  ['an OP_RETURN above 83 bytes', false, () => standardnessTx({ vout: [opReturnOutput(160), p2mrOutput(99000)] })],
  ['multiple OP_RETURN outputs', false, () => standardnessTx({ vout: [opReturnOutput(20), opReturnOutput(20), p2mrOutput(99000)] })],
  ['OP_RETURN outputs that fill the 200,000 byte budget', false, () => standardnessTx({ vout: [...Array(4)].map(() => opReturnOutput(49996)) })],
  ['ephemeral dust in a zero-fee transaction', false, () => standardnessTx({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(100000)] })],
  ['2,500 legacy sigops', false, () => legacySigopsTx(2500)],
  ['a v4 transaction', true, () => standardnessTx({ version: 4 })],
  ['OP_RETURN outputs over the 200,000 byte budget', true, () => standardnessTx({ vout: [...[...Array(3)].map(() => opReturnOutput(49996)), opReturnOutput(49997)] })],
  ['dust in a fee-paying transaction', true, () => standardnessTx({ version: 3, vout: [anchorOutput(0), p2mrOutput(99000)] })],
  ['two dust outputs in a zero-fee transaction', true, () => standardnessTx({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(1), p2mrOutput(99999)] })],
  ['ephemeral dust followed by a non-standard output', true, () => standardnessTx({ version: 3, fee: 0, vout: [anchorOutput(0), nonStandardOutput] })],
  ['2,501 legacy sigops', true, () => legacySigopsTx(2501)],
  ['a P2MR output at the 2,855 bit dust threshold', false, () => standardnessTx({ vout: [p2mrOutput(2855)] })],
  ['outputs to undefined witness v1 and v2 programs at the 121 bit dust threshold', false, () => standardnessTx({ vout: [witnessOutput(1, 121), witnessOutput(2, 121)] })],
  ['a v3 transaction of 50,000 vB', false, () => ({ ...standardnessTx({ version: 3 }), weight: 50000 })],
  ['a v3 transaction whose sigops adjust its vsize to 50,000 vB', false, () => ({ ...standardnessTx({ version: 3 }), sigops: 2500 })],
  ['a v3 transaction with unreported sigops whose outputs count 2,500', false, () => withoutSigops(standardnessTx({ version: 3, vout: Array(125).fill(multisigOutput) }))],
  ['a v3 transaction that spends 13 single-key P2MR inputs', false, () => standardnessTx({ version: 3, vin: singleKeyP2mrSpends(13) })],
  ['a v2 transaction that spends 14 single-key P2MR inputs', false, () => standardnessTx({ vin: singleKeyP2mrSpends(14) })],
  ['a P2MR leaf script argument of 16 KiB', false, () => standardnessTx({ vin: [p2mrSpend(bytes(16384), p2mrLeafScript, p2mrControlBlock)] })],
  ['P2MR leaf script arguments of 128 KiB in total', false, () => standardnessTx({ vin: [p2mrSpend(...Array(8).fill(bytes(16384)), p2mrLeafScript, p2mrControlBlock)] })],
  ['a tapscript argument of 80 bytes', false, () => standardnessTx({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock)] })],
  ['a P2MR output below the 2,855 bit dust threshold', true, () => standardnessTx({ vout: [p2mrOutput(2854)] })],
  ['an output to an undefined witness v1 program below the 121 bit dust threshold', true, () => standardnessTx({ vout: [witnessOutput(1, 120), p2mrOutput(99000)] })],
  ...[...Array(14)].map((_, i) => [`an output to reserved witness v${i + 3}`, true, () => standardnessTx({ vout: [p2mrOutput(99000), witnessOutput(i + 3)] })]),
  ['a v3 transaction over 50,000 vB', true, () => ({ ...standardnessTx({ version: 3 }), weight: 50001 })],
  ['a v3 transaction whose sigops adjust its vsize over 50,000 vB', true, () => ({ ...standardnessTx({ version: 3 }), sigops: 2501 })],
  ['a v3 transaction with unreported sigops whose outputs count 2,520', true, () => withoutSigops(standardnessTx({ version: 3, vout: Array(126).fill(multisigOutput) }))],
  ['a v3 transaction that spends 14 single-key P2MR inputs', true, () => standardnessTx({ version: 3, vin: singleKeyP2mrSpends(14) })],
  ['a P2MR spend with an annex', true, () => standardnessTx({ vin: [p2mrSpend(bytes(3681), p2mrLeafScript, p2mrControlBlock, '50')] })],
  ['a P2MR spend without a leaf script', true, () => standardnessTx({ vin: [p2mrSpend(p2mrControlBlock)] })],
  ['a P2MR spend with an empty control block', true, () => standardnessTx({ vin: [p2mrSpend(bytes(3681), p2mrLeafScript, '')] })],
  ['a P2MR leaf script argument over 16 KiB', true, () => standardnessTx({ vin: [p2mrSpend(bytes(16385), p2mrLeafScript, p2mrControlBlock)] })],
  ['P2MR leaf script arguments over 128 KiB in total', true, () => standardnessTx({ vin: [p2mrSpend(...Array(8).fill(bytes(16384)), bytes(1), p2mrLeafScript, p2mrControlBlock)] })],
  ['a tapscript argument over 80 bytes', true, () => standardnessTx({ vin: [p2trSpend(bytes(81), '51', tapscriptControlBlock)] })],
  ['a taproot script path spend with an empty control block', true, () => standardnessTx({ vin: [p2trSpend(bytes(1), '51', '')] })],
  ['a taproot script path spend of another leaf version', true, () => standardnessTx({ vin: [p2trSpend(bytes(1), '51', otherLeafControlBlock)] })],
  ['a P2MR spend of another leaf version', true, () => standardnessTx({ vin: [p2mrSpend(bytes(3681), p2mrLeafScript, otherP2mrLeafControlBlock)] })],
  ['a non-standard input after a tapscript spend', true, () => standardnessTx({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock), standardnessInput(witnessOutput(1))] })],
  ['a non-standard output after a tapscript spend', true, () => standardnessTx({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock)], vout: [p2mrOutput(99000), nonStandardOutput] })],
];

// the thresholds qbit v1.0.0 pins in src/test/transaction_tests.cpp: every output but P2MR is priced
// with the 148-byte legacy spend, as qbit has no witness discount, and the fee is rounded up
for (const [name, scriptpubkey, threshold] of [
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
]) {
  assert(getDustThreshold(scriptpubkey) === threshold, `${name} dust threshold: ${getDustThreshold(scriptpubkey)}, expected ${threshold}`);
}

// qbitd's legacy sigop count includes OP_CHECKSIG and OP_CHECKSIGVERIFY, but not OP_CHECKSIGPQC or OP_CHECKSIGADD
assert(countScriptSigops('OP_CHECKSIG OP_CHECKSIGVERIFY', true, true) === 2, 'OP_CHECKSIG and OP_CHECKSIGVERIFY should each count as one sigop');
assert(countScriptSigops(`OP_PUSHBYTES_32 ${'11'.repeat(32)} OP_CHECKSIGPQC`, true, true) === 0, 'OP_CHECKSIGPQC should not count as a sigop');
assert(countScriptSigops('OP_CHECKSIGADD', true, true) === 0, 'OP_CHECKSIGADD should not count as a sigop');
// in redeem and witness scripts, OP_CHECKMULTISIG is worth N only after OP_1 to OP_16, and 20 otherwise
assert(countScriptSigops('OP_PUSHNUM_2 OP_CHECKMULTISIG', false, true) === 2, 'OP_PUSHNUM_2 OP_CHECKMULTISIG should count as 2 sigops');
assert(countScriptSigops('OP_0 OP_CHECKMULTISIG', false, true) === 20, 'OP_0 OP_CHECKMULTISIG should count as 20 sigops');
assert(countScriptSigops('OP_CHECKMULTISIG OP_CHECKMULTISIG', false, true) === 40, 'a leading OP_CHECKMULTISIG should count as 20 sigops');

for (const [network, height] of [['', 158366], ['', undefined], ['testnet4', 10000], ['regtest', 101]]) {
  for (const [name, nonStandard, buildTx] of standardnessCases) {
    assert(
      isNonStandard(buildTx(), height, network) === nonStandard,
      `${name} should be ${nonStandard ? 'non-standard' : 'standard'} on ${network || 'mainnet'} at height ${height}`,
    );
  }
}

// qscriptions and qrunes: qbit's inscriptions and runes, which ride in P2MR leaf scripts and runestones
{
  const { of } = require('rxjs');
  const { addInnerScriptsToVin, witnessToP2TRScript } = require('../src/app/shared/transaction.utils.ts');
  const { decipherRunestone } = require('../src/app/shared/ord/rune.utils.ts');
  const { OrdApiService } = require('../src/app/services/ord-api.service.ts');
  // real qbit mainnet transactions, shared with the backend tests: `etching` qscribes POST•QUANTUM•GOODS's
  // 525-byte SVG logo in its P2MR leaf script and etches the qrune 163891:2, and `mint` mints it
  const { etching, mint } = require('../../backend/src/__tests__/api/test-data/qbit-p2mr-qscriptions.json');
  const MAINNET_163891 = '00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401';

  const qscriptionFlags = BigInt(getTransactionFlags(etching, undefined, false, undefined, ''));
  assert((qscriptionFlags & TransactionFlags.inscription) === TransactionFlags.inscription, 'P2MR qscription reveal not flagged as an inscription');
  const mintFlags = BigInt(getTransactionFlags(mint, undefined, false, undefined, ''));
  assert((mintFlags & TransactionFlags.inscription) === 0n, 'P2MR spend without an envelope flagged as an inscription');
  assert(!isNonStandard(etching, etching.status.block_height, '') && !isNonStandard(mint, mint.status.block_height, ''), 'real P2MR spends flagged as non-standard');
  assert((mintFlags & TransactionFlags.annex) === 0n, 'P2MR spend without an annex flagged as carrying one');
  // a P2MR spend can carry an annex, as a taproot spend can, but qbit does not relay one; the annex adds 2 bytes
  const withAnnex = { ...mint, weight: mint.weight + 2, vin: [{ ...mint.vin[0], witness: [...mint.vin[0].witness, '50'] }] };
  const annexFlags = BigInt(getTransactionFlags(withAnnex, undefined, false, mint.status.block_height, ''));
  assert((annexFlags & TransactionFlags.annex) === TransactionFlags.annex, 'P2MR annex not flagged');
  assert((annexFlags & TransactionFlags.nonstandard) === TransactionFlags.nonstandard, 'P2MR annex not flagged as non-standard');
  // a P2MR payment below qbit's P2MR dust threshold of 2,855 bits
  const withPayment = (value) => ({ ...mint, vout: mint.vout.map((vout, i) => (i === 1 ? { ...vout, value } : vout)) });
  assert(mint.vout[1].scriptpubkey_type === 'v2_p2mr', 'mint output 1 is not P2MR');
  assert(!isNonStandard(withPayment(2855), mint.status.block_height, ''), 'P2MR payment at the dust threshold flagged as non-standard');
  assert(isNonStandard(withPayment(2854), mint.status.block_height, ''), 'P2MR payment below the dust threshold not flagged as non-standard');
  // a P2MR spend of a leaf version reserved for upgrades
  const [mintSignature, mintLeafScript] = mint.vin[0].witness;
  const withReservedLeaf = { ...mint, vin: [{ ...mint.vin[0], witness: [mintSignature, mintLeafScript, 'c3'] }] };
  assert(isNonStandard(withReservedLeaf, mint.status.block_height, ''), 'P2MR spend of a reserved leaf version not flagged as non-standard');

  // A decoded transaction or PSBT has no leaf script until addInnerScriptsToVin reads it from the witness,
  // whichever name its prevout gives the P2MR type
  for (const scriptpubkey_type of ['v2_p2mr', 'witness_v2_p2mr']) {
    const decoded = JSON.parse(JSON.stringify(etching));
    for (const vin of decoded.vin) {
      delete vin.inner_witnessscript_asm;
      vin.prevout.scriptpubkey_type = scriptpubkey_type;
      addInnerScriptsToVin(vin);
    }
    assert(decoded.vin[0].inner_witnessscript_asm === etching.vin[0].inner_witnessscript_asm, `${scriptpubkey_type} prevout: leaf script not read from the witness`);
    const decodedFlags = BigInt(getTransactionFlags(decoded, undefined, false, undefined, ''));
    assert((decodedFlags & TransactionFlags.inscription) === TransactionFlags.inscription, `${scriptpubkey_type} prevout: qscription reveal not flagged as an inscription`);
  }

  const leafScript = witnessToP2TRScript(etching.vin[0].witness);
  assert(leafScript === etching.vin[0].witness[1], 'P2MR leaf script is not the second-to-last witness item');
  assert(leafScript.includes('0063036f7264'), 'P2MR leaf script lacks the inscription envelope');
  const ordApi = new OrdApiService({
    getBlockHashFromHeight$: (height) => of(height === 163891 ? MAINNET_163891 : '00'.repeat(32)),
    getBlockTxId$: (hash, index) => of(hash === MAINNET_163891 && index === 2 ? etching.txid : mint.txid),
    getTransaction$: (txid) => of(txid === etching.txid ? etching : mint),
  });
  const qscriptions = ordApi.decodeInscriptions(leafScript);
  assert(qscriptions.length === 1, `expected one qscription, got ${qscriptions.length}`);
  assert(qscriptions[0].content_type_str === 'image/svg+xml', `qscription content type: ${qscriptions[0].content_type_str}`);
  assert(qscriptions[0].body_length === 525, `qscription body length: ${qscriptions[0].body_length}`);

  const etched = decipherRunestone(etching)?.etching;
  assert(etched?.spacedName === 'POST•QUANTUM•GOODS' && etched.symbol === '⚛' && etched.supply === 21000000n, `etching: ${etched?.spacedName}`);
  assert(decipherRunestone(mint)?.mint?.toString() === '163891:2', 'mint does not name qrune 163891:2');

  // a mint names its qrune by ID only, so its etching is looked up through block/:hash/txid/:index
  let resolved;
  ordApi.getEtchingFromRuneId$('163891:2').subscribe((result) => resolved = result);
  assert(resolved?.etching?.spacedName === 'POST•QUANTUM•GOODS' && resolved.txid === etching.txid, `qrune 163891:2 resolved to ${resolved?.etching?.spacedName}`);
  // qbit has no hardcoded UNCOMMON•GOODS: 1:0 is looked up like any other ID, and a transaction without an etching names no qrune
  let uncommon = 'not resolved';
  ordApi.getEtchingFromRuneId$('1:0').subscribe((result) => uncommon = result);
  assert(uncommon === null, `qrune 1:0 resolved to ${uncommon?.etching?.spacedName}`);
}

// @angular/common ships partially compiled, so outside an Angular build it needs the JIT compiler,
// which also compiles the component templates rendered below
require('@angular/compiler');

// Components render their own templates in Node, on Angular's server testing platform
{
  const fs = require('fs');
  require('@angular/localize/init');
  const { Component, NO_ERRORS_SCHEMA, Pipe, provideZonelessChangeDetection } = require('@angular/core');
  const { CommonModule } = require('@angular/common');
  const { provideRouter, RouterLink } = require('@angular/router');
  const { TestBed } = require('@angular/core/testing');
  const { ServerTestingModule, platformServerTesting } = require('@angular/platform-server/testing');
  TestBed.initTestEnvironment(ServerTestingModule, platformServerTesting());

  // Renders a copy of componentClass without its constructor's dependency injection: the copy takes its
  // fields from new componentClass(...args) and its methods from the class
  const render = (componentClass, templateFile, args, imports, setup) => {
    class Rendered {
      constructor() {
        Object.assign(this, new componentClass(...args));
      }
    }
    for (const name of Object.getOwnPropertyNames(componentClass.prototype).filter((name) => name !== 'constructor')) {
      Rendered.prototype[name] = componentClass.prototype[name];
    }
    const template = fs.readFileSync(path.join(frontendRoot, templateFile), 'utf8');
    Component({ selector: 'qbit-smoke', template, imports: [CommonModule, ...imports], schemas: [NO_ERRORS_SCHEMA] })(Rendered);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(Rendered);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    return fixture.nativeElement;
  };
  const { etching, mint } = require('../../backend/src/__tests__/api/test-data/qbit-p2mr-qscriptions.json');

  // qbit's addresses are P2MR, so a transaction's features show no Taproot badge, struck through or not,
  // and no hint to save fees with Taproot. The RBF badge still shows.
  const { TxFeaturesComponent } = require('../src/app/components/tx-features/tx-features.component.ts');
  const p2pkhSpend = {
    ...etching,
    vin: [{
      ...etching.vin[0],
      prevout: { scriptpubkey: `76a914${'11'.repeat(20)}88ac`, scriptpubkey_asm: `OP_DUP OP_HASH160 OP_PUSHBYTES_20 ${'11'.repeat(20)} OP_EQUALVERIFY OP_CHECKSIG`, scriptpubkey_type: 'p2pkh', value: 100000 },
      scriptsig: `47${'30'.repeat(71)}2102${'11'.repeat(32)}`,
      scriptsig_asm: `OP_PUSHBYTES_71 ${'30'.repeat(71)} OP_PUSHBYTES_33 02${'11'.repeat(32)}`,
      witness: undefined,
      inner_witnessscript_asm: undefined,
    }],
  };
  for (const [name, network, tx] of [
    ['an unconfirmed mainnet P2MR spend', '', { ...etching, status: { confirmed: false } }],
    ['a confirmed testnet4 P2MR spend', 'testnet4', { ...etching, status: { confirmed: true, block_height: 10000 } }],
    ['a P2MR spend on the preview page', '', { ...etching, status: { confirmed: null } }],
    // upstream says this one could save fees by using Taproot
    ['an unconfirmed P2PKH spend', '', { ...p2pkhSpend, status: { confirmed: false } }],
  ]) {
    const element = render(TxFeaturesComponent, 'src/app/components/tx-features/tx-features.component.html', [{ network }], [], (features) => {
      features.tx = tx;
      features.ngOnChanges();
    });
    const badges = Array.from(element.querySelectorAll('.badge')).map((badge) => badge.textContent.trim());
    assert(!badges.includes('Taproot'), `${name} shows a Taproot badge: ${badges.join(', ')}`);
    assert(badges.includes('RBF'), `${name} shows no RBF badge: ${badges.join(', ')}`);
  }

  // A qrune's name links to its etching only when the etching's txid is known
  const { OrdDataComponent } = require('../src/app/components/ord-data/ord-data.component.ts');
  const { decipherRunestone } = require('../src/app/shared/ord/rune.utils.ts');
  const passthrough = (name) => Pipe({ name })(class { transform(value) { return value; } });
  const ordData = (runestone, runeInfo) => {
    const element = render(OrdDataComponent, 'src/app/components/ord-data/ord-data.component.html', [],
      [RouterLink, passthrough('relativeUrl'), passthrough('amountShortener'), passthrough('bytes')], (ord) => {
        Object.assign(ord, { runestone, runeInfo, type: 'vout' });
        ord.ngOnChanges({ runestone: {} });
      });
    return {
      text: element.textContent.replace(/\s+/g, ' ').trim(),
      links: Array.from(element.querySelectorAll('a')).map((link) => link.getAttribute('href')),
    };
  };
  const mintRunestone = decipherRunestone(mint);
  const etched = decipherRunestone(etching).etching;
  const transfer = { edicts: [{ id: { toString: () => '163891:2' }, amount: 1n, output: 1 }] };
  for (const [name, runestone, runeInfo, text, links] of [
    ['a mint of a qrune whose etching was found', mintRunestone, { '163891:2': { etching: etched, txid: etching.txid } }, 'Mint 1000 ⚛ POST•QUANTUM•GOODS', [`/tx/${etching.txid}`]],
    ['a mint of a qrune whose etching has no txid', mintRunestone, { '163891:2': { etching: etched } }, 'Mint 1000 ⚛ POST•QUANTUM•GOODS', []],
    ['a mint of a qrune with a txid but no etching', mintRunestone, { '163891:2': { txid: etching.txid } }, 'Error decoding data', []],
    ['a transfer of a qrune with a txid but no etching', transfer, { '163891:2': { txid: etching.txid } }, 'Transfer 163891:2', [`/tx/${etching.txid}`]],
  ]) {
    const shown = ordData(runestone, runeInfo);
    assert(shown.text === text && JSON.stringify(shown.links) === JSON.stringify(links), `${name}: ${JSON.stringify(shown)}`);
  }
}

// HTTP/2 has no status text, so Angular's XHR backend fills in 'OK' and an error printed "400 OK"
{
  const { HttpRequest, HttpXhrBackend } = require('@angular/common/http');
  const { HttpErrorPipe } = require('../src/app/shared/pipes/http-error-pipe/http-error.pipe.ts');
  const { httpErrorStatus } = require('../src/app/shared/http-error.utils.ts');
  // mempool.qbit.org's answer to /api/address/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh
  const body = '{"error":"invalid qbit address HRP: expected qb, got bc"}';
  const httpError = (status, statusText, responseBody = body) => {
    const listeners = {};
    const xhr = {
      DONE: 4, readyState: 1, status: 0, statusText: '', responseText: '', responseURL: '',
      open() {}, setRequestHeader() {}, abort() {},
      getAllResponseHeaders: () => 'content-type: application/json\r\n',
      addEventListener: (event, listener) => listeners[event] = listener,
      removeEventListener: (event) => delete listeners[event],
      send() {
        Object.assign(xhr, { readyState: 4, status, statusText, responseText: responseBody, response: responseBody });
        listeners.load();
      },
    };
    let error;
    new HttpXhrBackend({ build: () => xhr }).handle(new HttpRequest('GET', '/api/address/bc1q'))
      .subscribe({ error: (e) => error = e });
    return error;
  };
  const pipe = new HttpErrorPipe();
  // The pipe prints the status and the reason, and the address graph and widgets print the status alone
  const http2 = httpError(400, '');
  assert(pipe.transform(http2) === '400: invalid qbit address HRP: expected qb, got bc', `HTTP/2 error text: ${pipe.transform(http2)}`);
  assert(httpErrorStatus(http2) === '400', `HTTP/2 error status: ${httpErrorStatus(http2)}`);
  const http1 = httpError(400, 'Bad Request');
  assert(pipe.transform(http1) === '400 Bad Request: invalid qbit address HRP: expected qb, got bc', `HTTP/1.1 error text: ${pipe.transform(http1)}`);
  assert(httpErrorStatus(http1) === '400 Bad Request', `HTTP/1.1 error status: ${httpErrorStatus(http1)}`);
  // a 200 whose body is not JSON is an error too, and there OK is the right status text
  const parseError = pipe.transform(httpError(200, '', 'not json'));
  assert(parseError.startsWith('200 OK: SyntaxError'), `parse error text: ${parseError}`);
  // no error prints nothing, and an error without a status leaves the widgets their 'unknown error'
  assert(pipe.transform(null) === '' && pipe.transform(undefined) === '', 'a missing error printed text');
  assert(httpErrorStatus(undefined) === '' && httpErrorStatus({}) === '', 'an error without a status printed one');
  // what HttpCacheInterceptor throws for a network failure
  assert(httpErrorStatus({ status: 0, statusText: 'Unknown error' }) === '0 Unknown error', 'network failure status');
}

console.log('qbit script smoke passed');
