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

function standardnessInput(prevout, scriptsig = '', scriptsig_asm = '') {
  return {
    txid: '22'.repeat(32),
    vout: 0,
    prevout,
    scriptsig,
    scriptsig_asm,
    inner_redeemscript_asm: '',
    inner_witnessscript_asm: '',
    witness: [],
    is_coinbase: false,
    sequence: 0xfffffffd,
  };
}

function standardnessTx({ version = 2, fee = 1000, vin = [standardnessInput(p2mrOutput(100000))], vout = [p2mrOutput(99000)] } = {}) {
  // qbit has no witness discount, and these inputs carry no witness, so weight is the serialized size
  const weight = 10
    + vin.reduce((size, txin) => size + 41 + txin.scriptsig.length / 2, 0)
    + vout.reduce((size, txout) => size + 9 + txout.scriptpubkey.length / 2, 0);
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
];

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
  const { witnessToP2TRScript } = require('../src/app/shared/transaction.utils.ts');
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

console.log('qbit script smoke passed');
