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
  breaksRestrictedOutputMode,
  countSigops,
  decodeRawTransaction,
  decodeScript,
  getDustThreshold,
  getPreviewTransactionFlags,
  getSigOpCount,
  getTransactionFlags,
  getUnconfirmedParents,
  getUnconfirmedParentTxids,
  isNonStandard,
  isNonStandardForParents,
  isPushOnly,
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

// qbit's standardness and sigop rules, on the vectors the backend tests run too, so that the backend's
// and the frontend's copies of these rules can't drift apart
{
  const vectors = require('../../backend/src/__tests__/fixtures/qbit-standardness-vectors.ts');
  const testData = (file) => require(`../../backend/src/__tests__/api/test-data/${file}`);
  const isFlagged = (flags) => (flags & TransactionFlags.nonstandard) === TransactionFlags.nonstandard;

  for (const [network, height] of vectors.qbitHeights) {
    // the frontend names mainnet ''
    const frontendNetwork = network === 'mainnet' ? '' : network;
    for (const { name, nonStandard, tx } of vectors.standardnessVectors) {
      assert(
        isNonStandard(tx(), height, frontendNetwork) === nonStandard,
        `${name} should be ${nonStandard ? 'non-standard' : 'standard'} on ${network} at height ${height}`,
      );
    }
    // restricted output mode, which /tx/preview checks on every network but regtest
    for (const [name, buildTx, allowed] of vectors.restrictedOutputVectors) {
      const tx = buildTx();
      assert(breaksRestrictedOutputMode(tx, frontendNetwork) === (!allowed && network !== 'regtest'), `${name}: restricted output mode on ${network}`);
      assert(!isNonStandard(tx, height, frontendNetwork), `${name} flagged as non-standard on its own on ${network}`);
    }
  }
  for (const [name, scriptpubkey, threshold] of vectors.dustThresholdVectors) {
    assert(getDustThreshold(scriptpubkey) === threshold, `${name} dust threshold: ${getDustThreshold(scriptpubkey)}, expected ${threshold}`);
  }
  for (const [name, script, accurate, sigops] of vectors.scriptSigopVectors) {
    const counted = getSigOpCount(decodeScript(script), accurate);
    assert(counted === sigops, `${name}: ${counted} sigops, expected ${sigops}`);
  }
  for (const [name, script, pushOnly] of vectors.pushOnlyVectors) {
    assert(isPushOnly(decodeScript(script)) === pushOnly, `${name} should ${pushOnly ? '' : 'not '}be push-only`);
  }
  for (const [name, buildTx, cost] of vectors.transactionSigopVectors) {
    assert(countSigops(buildTx()) === cost, `${name}: sigop cost ${countSigops(buildTx())}, expected ${cost}`);
  }
  for (const [file, txid, cost] of vectors.realTransactionSigopVectors) {
    const tx = testData(file).find((candidate) => candidate.txid === txid);
    assert(countSigops(tx) === cost, `${file} ${txid}: sigop cost ${countSigops(tx)}, expected ${cost}`);
  }

  // /tx/preview only: qbit's rules on unconfirmed parents, and its flags with the signatures a transaction lacks
  const parentMap = (parents) => new Map(parents.map((parent) => [parent.txid, parent]));
  for (const { name, nonStandard, tx, parents } of vectors.parentVectors) {
    assert(isNonStandardForParents(tx(), parentMap(parents())) === nonStandard, `${name} should be ${nonStandard ? 'non-standard' : 'standard'}`);
  }
  // the page learns which parents are unconfirmed from /api/v1/prevouts, and checks no rules on them while
  // any input's is unknown, as for a PSBT's own prevouts, rather than take that parent as confirmed
  const statuses = new Map([[`${'22'.repeat(32)}:0`, true], [`${'44'.repeat(32)}:1`, false]]);
  const parentTxids = getUnconfirmedParentTxids([{ txid: '22'.repeat(32), vout: 0 }, { txid: '44'.repeat(32), vout: 1 }], statuses);
  assert(JSON.stringify(parentTxids) === JSON.stringify(['22'.repeat(32)]), `unconfirmed parents: ${JSON.stringify(parentTxids)}`);
  assert(getUnconfirmedParentTxids([{ txid: '22'.repeat(32), vout: 0 }, { txid: '55'.repeat(32), vout: 0 }], statuses) === null, 'an input of unknown status taken as confirmed');
  // and keeps a parent only while it is unconfirmed, as one can confirm after /api/v1/prevouts reported it
  const parent = vectors.qbitTransaction({ version: 2 });
  const confirmed = { ...parent, txid: '44'.repeat(32), status: { confirmed: true, block_height: 170000 } };
  const kept = [...getUnconfirmedParents([parent, confirmed]).keys()];
  assert(JSON.stringify(kept) === JSON.stringify([parent.txid]), `parents kept as unconfirmed: ${JSON.stringify(kept)}`);
  for (const [name, buildTx, missing, parents, nonStandard] of vectors.previewVectors) {
    const flags = getPreviewTransactionFlags(buildTx(), missing, null, 170000, '', parents ? parentMap(parents()) : null);
    assert(isFlagged(flags) === nonStandard, `${name} should be ${nonStandard ? 'non-standard' : 'standard'} on /tx/preview`);
  }

  // qbit's weight, which with its witness scale factor of 1 is the serialized size, and qbit's opcode names
  const { addInnerScriptsToVin } = require('../src/app/shared/transaction.utils.ts');
  for (const [name, buildHex, weight] of vectors.weightVectors) {
    const decoded = decodeRawTransaction(buildHex(), 'testnet4').tx;
    assert(decoded.weight === weight, `${name}: weight ${decoded.weight}, expected ${weight}`);
  }
  for (const [name, script, asm] of vectors.asmVectors) {
    const hex = vectors.serializeTransaction(vectors.qbitTransaction({ vout: [{ ...vectors.p2mrOutput(0), scriptpubkey: script }] }));
    const decodedAsm = decodeRawTransaction(hex, 'testnet4').tx.vout[0].scriptpubkey_asm;
    assert(decodedAsm === asm, `${name}: ${decodedAsm}, expected ${asm}`);
  }
  for (const [file, key] of vectors.realTransactionVectors) {
    const tx = testData(file)[key];
    const decoded = decodeRawTransaction(vectors.serializeTransaction(tx), '').tx;
    assert(decoded.txid === tx.txid && decoded.weight === tx.weight, `${file} ${key}: decoded as ${decoded.txid} of weight ${decoded.weight}, expected weight ${tx.weight}`);
    for (const vin of tx.vin) {
      const leaf = { ...vin, inner_witnessscript_asm: undefined };
      addInnerScriptsToVin(leaf);
      assert(leaf.inner_witnessscript_asm === vin.inner_witnessscript_asm, `${file} ${key}: leaf script ${leaf.inner_witnessscript_asm}, expected ${vin.inner_witnessscript_asm}`);
    }
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

  // P2MR Inscriptions (PINS-1): an envelope with the marker `pins`, in P2MR leaf scripts.
  // Regtest reveals of a PINS reference tool, mined by qbit Core v1.0.1, with what its indexer reported for each.
  const pinsReveals = require('../../backend/src/__tests__/api/test-data/qbit-p2mr-pins-inscriptions.json');
  const { createHash } = require('crypto');
  const pinsScripts = {};
  for (const [name, { tx: revealTx, expected }] of Object.entries(pinsReveals)) {
    // the explorer API gives each input its leaf script as assembly; read it from the witness as for a decoded transaction
    const tx = JSON.parse(JSON.stringify(revealTx));
    tx.vin.forEach(addInnerScriptsToVin);
    const pinsFlags = BigInt(getTransactionFlags(tx, undefined, false, undefined, ''));
    assert((pinsFlags & TransactionFlags.inscription) === TransactionFlags.inscription, `${name}: P2MR Inscription reveal not flagged as an inscription`);
    assert(!isNonStandard(tx, tx.status.block_height, ''), `${name}: P2MR Inscription reveal flagged as non-standard`);
    const pinsLeaf = witnessToP2TRScript(tx.vin[0].witness);
    pinsScripts[name] = pinsLeaf;
    assert(pinsLeaf.includes('00630470696e73'), `${name}: P2MR Inscription mark`);
    const decodedPins = ordApi.decodePinsInscriptions(pinsLeaf);
    assert(decodedPins.length === expected.length, `${name}: expected ${expected.length} P2MR Inscriptions, got ${decodedPins.length}`);
    expected.forEach((inscription, i) => {
      const body = Buffer.from(decodedPins[i].body);
      assert(!decodedPins[i].opaque, `${name} #${i}: opaque`);
      assert(decodedPins[i].content_type_str === inscription.content_type, `${name} #${i}: content type ${decodedPins[i].content_type_str}`);
      assert(decodedPins[i].body_length === inscription.body_bytes && body.length === inscription.body_bytes, `${name} #${i}: body length ${decodedPins[i].body_length}`);
      assert(createHash('sha256').update(body).digest('hex') === inscription.body_sha256, `${name} #${i}: body hash`);
    });
  }
  // two envelopes of one leaf script are read in order
  assert(ordApi.decodePinsInscriptions(pinsScripts.three).length === pinsReveals.three.expected.length, 'envelopes of one leaf script');
  // a marker of other bytes is not read: "pint" (00 63 04 70 69 6e 74)
  assert(!ordApi.decodePinsInscriptions(pinsScripts.text.replace('00630470696e73', '00630470696e74')).length, 'a marker that is not pins was decoded');
  // an unknown even tag makes a P2MR Inscription opaque: it keeps its size and shows no content
  const opaqueScript = pinsScripts.text.replace('00630470696e73', '00630470696e73' + '0104' + '0101'); // tag 4, value 01
  const opaque = ordApi.decodePinsInscriptions(opaqueScript);
  assert(opaque.length === 1 && opaque[0].opaque === true && opaque[0].body.length === 0 && opaque[0].content_type_str === 'undefined' && opaque[0].body_length === 5, `opaque P2MR Inscription: ${JSON.stringify(opaque)}`);

  // The PINS-1 envelope vectors (P2MR-Inscriptions/pins v1.0.1, docs/specs/vectors/envelope.json, CC0-1.0, copied
  // verbatim): every leaf script gives exactly the envelopes the spec lists, and the button shows exactly when there
  // is at least one
  const { parsePinsEnvelopes, hasPinsEnvelope, pinsLeafScript, pinsDelegateTxid } = require('../src/app/shared/ord/pins.utils.ts');
  const { hexToBytes } = require('../src/app/shared/ord/inscription.utils.ts');
  const envelopeVectors = require('../../backend/src/__tests__/api/test-data/qbit-pins-envelope-vectors.json');
  assert(envelopeVectors.cases.length === 20, `PINS-1 envelope vectors: ${envelopeVectors.cases.length}`);
  for (const { name, script_hex: scriptHex, envelopes } of envelopeVectors.cases) {
    const read = parsePinsEnvelopes(hexToBytes(scriptHex)).map((envelope) => ({
      fields: envelope.fields.map(({ tag, value }) => ({ tag, value_hex: Buffer.from(value).toString('hex') })),
      body_hex: Buffer.from(envelope.body).toString('hex'),
      flags: envelope.flags,
    }));
    assert(JSON.stringify(read) === JSON.stringify(envelopes), `PINS-1 vector "${name}": ${JSON.stringify(read)}`);
    assert(hasPinsEnvelope(scriptHex) === envelopes.length > 0, `PINS-1 vector "${name}": button`);
    assert(ordApi.decodePinsInscriptions(scriptHex).length === envelopes.length, `PINS-1 vector "${name}": panel`);
  }

  // Crafted leaf scripts. Each starts with <32 bytes of 0x02> OP_CHECKSIGPQC, as the vectors do.
  const leaf = (rest) => '20' + '02'.repeat(32) + 'b3' + rest;
  const ascii = (text) => Buffer.from(text).toString('hex');
  const decodeOne = (scriptHex) => {
    const read = ordApi.decodePinsInscriptions(scriptHex);
    assert(read.length === 1, `expected one P2MR Inscription in ${scriptHex.slice(0, 80)}…, got ${read.length}`);
    return read[0];
  };
  // marker bytes inside a push are data: an image/png envelope whose body is one push of envelope bytes is one
  // P2MR Inscription, and the same push dropped by OP_DROP, with no envelope around it, is none
  const inner = '00630470696e73510a' + ascii('text/plain') + '0004' + ascii('FAKE') + '68';
  const outer = decodeOne(leaf('00630470696e735109' + ascii('image/png') + '001a' + inner + '68'));
  assert(outer.content_type_str === 'image/png' && Buffer.from(outer.body).toString('hex') === inner, `envelope bytes in a body push: ${JSON.stringify(outer)}`);
  assert(!ordApi.decodePinsInscriptions(leaf('1a' + inner + '75')).length && !hasPinsEnvelope(leaf('1a' + inner + '75')), 'envelope bytes in a dropped push were read');
  // the marker shifted by one nibble inside a push gives no button
  assert(!hasPinsEnvelope(leaf('08f00630470696e73075')), 'marker at a nibble offset gives a button');
  // a body separator written as OP_PUSHDATA1 with length 0 reads like OP_0 (PINS-1 section 4.3)
  const pushdataSeparator = decodeOne(leaf('00630470696e73510a' + ascii('text/plain') + '4c0005' + ascii('hello') + '68'));
  assert(pushdataSeparator.content_type_str === 'text/plain' && Buffer.from(pushdataSeparator.body).toString() === 'hello', `OP_PUSHDATA1 separator: ${JSON.stringify(pushdataSeparator)}`);
  // a tag of more than one byte is an unknown tag with the parity of its first byte (PINS-1 section 5.1): 0200 and
  // 0200000001 are even, so the P2MR Inscription is opaque; 0100 is odd and ignored, so it has no content type
  for (const tag of ['0200', '0200000001']) {
    const multiByte = decodeOne(leaf('00630470696e73510a' + ascii('text/plain') + (tag.length / 2).toString(16).padStart(2, '0') + tag + '010100' + '06' + ascii('secret') + '68'));
    assert(multiByte.opaque === true && multiByte.body.length === 0 && multiByte.body_length === 6, `even tag ${tag}: ${JSON.stringify(multiByte)}`);
  }
  const oddTag = decodeOne(leaf('00630470696e730201000' + '9' + ascii('text/html') + '0005' + ascii('hello') + '68'));
  assert(!oddTag.opaque && oddTag.content_type_str === 'undefined' && Buffer.from(oddTag.body).toString() === 'hello', `odd tag 0100: ${JSON.stringify(oddTag)}`);
  // a negative-looking OP_PUSHDATA4 length (fbffffff) is a push past the end of the script: the script cannot be
  // decoded and holds no envelope, alone or inside an ordinary data push
  for (const scriptHex of [leaf('00630470696e734efbffffff'), leaf('0c00630470696e734efbffffff75'), leaf('00630470696e734effffffff00')]) {
    assert(!ordApi.decodePinsInscriptions(scriptHex).length && !hasPinsEnvelope(scriptHex), `truncated OP_PUSHDATA4: ${scriptHex}`);
  }
  // a P2MR Inscription whose body is many pushes of envelope bytes is read once, in linear time
  {
    const pushes = 50_000;
    const big = leaf('00630470696e735109' + ascii('image/png') + '00' + '0800630470696e7300'.repeat(pushes) + '68');
    const started = Date.now();
    const read = decodeOne(big);
    const elapsed = Date.now() - started;
    assert(big.length / 2 > 400_000 && read.body_length === 8 * pushes && read.is_cropped, `large body: ${read.body_length}`);
    assert(hasPinsEnvelope(big) && elapsed < 2000, `large body read in ${elapsed} ms`);
  }
  // metadata (field 5) in many 1-byte chunks (OP_5 <01>) is joined once, in linear time
  {
    const chunks = 134_000;
    const big = leaf('00630470696e73510a' + ascii('text/plain') + '550101'.repeat(chunks) + '0005' + ascii('hello') + '68');
    const started = Date.now();
    const [envelope] = parsePinsEnvelopes(hexToBytes(big));
    const elapsed = Date.now() - started;
    const metadata = envelope.fields.find(({ tag }) => tag === 5).value;
    assert(big.length / 2 > 400_000 && metadata.length === chunks && metadata.every((byte) => byte === 1) && Buffer.from(envelope.body).toString() === 'hello', `large metadata: ${metadata.length}`);
    assert(decodeOne(big).content_type_str === 'text/plain' && elapsed < 2000, `large metadata read in ${elapsed} ms`);
  }
  // content_encoding (field 9) is kept, so the panel does not show an encoded body as text (PINS-1 section 8)
  const encoded = decodeOne(leaf('00630470696e73510a' + ascii('text/plain') + '5902' + ascii('br') + '0003' + '0b0280' + '68'));
  assert(encoded.content_encoding === 'br' && encoded.content_type_str === 'text/plain', `content_encoding: ${JSON.stringify(encoded)}`);
  // delegate (field 11): the txid of a binary P2MR Inscription ID, with or without an index (PINS-1 section 6.1)
  const txid = 'ab'.repeat(31) + '01';
  const internal = Buffer.from(txid, 'hex').reverse().toString('hex');
  assert(pinsDelegateTxid(hexToBytes(internal)) === txid && pinsDelegateTxid(hexToBytes(internal + '01')) === txid && pinsDelegateTxid(hexToBytes(internal + 'ffffffff')) === txid, 'delegate txid');
  for (const value of [internal.slice(2), internal + '00', internal + '0100', internal + '0102030405']) {
    assert(pinsDelegateTxid(hexToBytes(value)) === null, `delegate ${value.length / 2} bytes is not a binary ID`);
  }
  const delegating = decodeOne(leaf('00630470696e735b21' + internal + '0268'));
  assert(delegating.delegate_txid === txid, `delegate with index 2: ${delegating.delegate_txid}`);
  // envelopes are looked for in the leaf script of leaf version 0xc0 only, after an annex is removed (PINS-1 section 4.2)
  const pinsWitness = pinsReveals.text.tx.vin[0].witness;
  const [, revealLeafScript, revealControl] = pinsWitness;
  assert(pinsLeafScript(pinsWitness) === revealLeafScript && pinsLeafScript([...pinsWitness, '50']) === revealLeafScript, 'leaf script of a 0xc0 spend');
  assert(pinsLeafScript(['00', revealLeafScript, 'c1' + revealControl.slice(2)]) === revealLeafScript, 'leaf version 0xc0 with the parity bit');
  assert(pinsLeafScript(['00', revealLeafScript, 'c2' + revealControl.slice(2)]) === null && pinsLeafScript([revealLeafScript, '50']) === null && pinsLeafScript([revealControl]) === null, 'leaf script outside leaf version 0xc0');
  // push lengths are read unsigned, and a push past the end of the leaf script is a failed parse: an OP_PUSHDATA4
  // length of fbffffff (4294967291 bytes, -5 when read signed) returns at once, in a field or in the body, and a
  // truncated direct push gives no qscription
  const ordLeaf = (rest) => '20' + '02'.repeat(32) + 'b3' + '0063036f7264' + rest;
  const textField = '01010a' + Buffer.from('text/plain').toString('hex');
  for (const scriptHex of [ordLeaf('4efbffffff'), ordLeaf(textField + '00' + '4efbffffff' + '68'), ordLeaf(textField + '00' + '056869' + '68')]) {
    const started = Date.now();
    const read = ordApi.decodeInscriptions(scriptHex);
    assert(read.length === 0 && Date.now() - started < 1000, `push past the end of ${scriptHex.slice(68)}: ${JSON.stringify(read)}`);
  }
  // OP_PUSHDATA1, 2 and 4 bodies within the script are read as before
  for (const push of ['4c03', '4d0300', '4e03000000']) {
    const [read] = ordApi.decodeInscriptions(ordLeaf(textField + '00' + push + '616263' + '68'));
    assert(read?.content_type_str === 'text/plain' && Buffer.from(read.body).toString() === 'abc', `${push} body: ${JSON.stringify(read)}`);
  }
  // An envelope starts where an instruction starts: the bytes of a mark inside a data push are data. So a body of
  // 50,000 pushes that each hold a mark is one qscription, read in linear time, and it is none when the envelope
  // then cannot be read (0xff is no push), also when the pushes are in its fields.
  {
    const marks = '070063036f726400'.repeat(50_000);
    for (const [rest, count] of [[textField + '00' + marks + '68', 1], [textField + '00' + marks + 'ff', 0], [marks + 'ff', 0]]) {
      const big = ordLeaf(rest);
      const started = Date.now();
      const read = ordApi.decodeInscriptions(big);
      const elapsed = Date.now() - started;
      assert(big.length / 2 > 400_000 && read.length === count && elapsed < 2000, `50,000 marks in pushes, ending in ${rest.slice(-2)}: ${read.length} qscriptions in ${elapsed} ms`);
      assert(count === 0 || (read[0].body_length === 7 * 50_000 && read[0].is_cropped && read[0].content_type_str === 'text/plain'), `body of marks: ${read[0]?.body_length}`);
    }
    const hi = '0063036f7264' + textField + '00' + '026869' + '68';
    const pushOf = (hex) => (hex.length / 2).toString(16).padStart(2, '0') + hex;
    const outer = ordApi.decodeInscriptions(ordLeaf(textField + '00' + pushOf(hi) + '68'));
    assert(outer.length === 1 && Buffer.from(outer[0].body).toString('hex') === hi, `envelope bytes in a body push: ${JSON.stringify(outer)}`);
    // a mark in a push outside any envelope hides nothing: the envelope after it is read
    const afterData = ordApi.decodeInscriptions('20' + '02'.repeat(32) + 'b3' + pushOf('0063036f726418') + '75' + hi + 'ff');
    assert(afterData.length === 1 && Buffer.from(afterData[0].body).toString() === 'hi', `envelope after a mark in a dropped push: ${JSON.stringify(afterData)}`);
    // an envelope that cannot be read does not hide the one after it, whose OP_FALSE it read as an empty push
    const afterBroken = ordApi.decodeInscriptions(ordLeaf(textField + '00' + '0161') + hi);
    assert(afterBroken.length === 1 && Buffer.from(afterBroken[0].body).toString() === 'hi', `envelope after one without OP_ENDIF: ${JSON.stringify(afterBroken)}`);
    // nothing is read after a push that runs past the end of the script: where instructions start is not known there
    assert(ordApi.decodeInscriptions(ordLeaf('4efbffffff') + hi).length === 0, 'an envelope after a push past the end of the script was read');
  }

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
  const render = (componentClass, templateFile, args, imports, setup, inlineTemplate) => {
    class Rendered {
      constructor() {
        Object.assign(this, new componentClass(...args));
      }
    }
    for (const name of Object.getOwnPropertyNames(componentClass.prototype).filter((name) => name !== 'constructor')) {
      Rendered.prototype[name] = componentClass.prototype[name];
    }
    const template = inlineTemplate ?? fs.readFileSync(path.join(frontendRoot, templateFile), 'utf8');
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
  const { OrdApiService } = require('../src/app/services/ord-api.service.ts');
  const { witnessToP2TRScript } = require('../src/app/shared/transaction.utils.ts');
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
  // what the ord-data component shows for the P2MR Inscriptions of a leaf script
  const ordApi = new OrdApiService({});
  const inscriptionsShown = (leafScriptHex) => {
    const element = render(OrdDataComponent, 'src/app/components/ord-data/ord-data.component.html', [],
      [RouterLink, passthrough('relativeUrl'), passthrough('amountShortener'), passthrough('bytes')], (ord) => {
        Object.assign(ord, { inscriptions: ordApi.decodePinsInscriptions(leafScriptHex), type: 'vin' });
        ord.ngOnChanges({ inscriptions: {} });
      });
    return [...Array.from(element.querySelectorAll('.badge, pre'), (node) => node.textContent.trim())].join(' | ');
  };
  const pinsReveals = require('../../backend/src/__tests__/api/test-data/qbit-p2mr-pins-inscriptions.json');
  const pinsLeaf = (name) => witnessToP2TRScript(pinsReveals[name].tx.vin[0].witness);
  for (const [name, leafScriptHex, text] of [
    ['a P2MR Inscription with text', pinsLeaf('text'), 'text/plain;charset=utf-8 | 5 | hello'],
    ['a P2MR Inscription with a PNG', pinsLeaf('png'), 'image/png | 97'],
    ['an opaque P2MR Inscription', pinsLeaf('text').replace('00630470696e73', '00630470696e730104' + '0101'), 'Opaque | 5'],
    ['a P2MR Inscription without a content type', pinsLeaf('text').replace('00630470696e73' + '5118' + Buffer.from('text/plain;charset=utf-8').toString('hex'), '00630470696e73'), 'Unknown | 5'],
    ['an opaque one and one without a content type, apart', pinsLeaf('text').replace('00630470696e73', '00630470696e730104' + '0101') + '00630470696e7300026869' + '68', 'Unknown | 2 | Opaque | 5'],
    ['a P2MR Inscription with an encoded body', pinsLeaf('text').replace('00630470696e73', '00630470696e73' + '5902' + Buffer.from('br').toString('hex')), 'text/plain;charset=utf-8 | 5 | br'],
    // an encoded body is its own group: its encoding is never shown on a plain body of the same content type
    ['a plain and an encoded P2MR Inscription of one content type, apart', pinsLeaf('text') + '00630470696e73' + '5118' + Buffer.from('text/plain;charset=utf-8').toString('hex') + '5902' + Buffer.from('br').toString('hex') + '0003' + '0b0280' + '68', 'text/plain;charset=utf-8 | 5 | hello | text/plain;charset=utf-8 | 3 | br'],
  ]) {
    const shown = inscriptionsShown(leafScriptHex);
    assert(shown === text, `${name}: ${JSON.stringify(shown)}`);
  }

  // a content type "__proto__" is a group like any other and writes nothing to Object.prototype
  {
    const protoHex = Buffer.from('__proto__').toString('hex');
    const delegateHex = '20' + 'ab'.repeat(32);
    const shownProto = inscriptionsShown('20' + '02'.repeat(32) + 'b3' + '00630470696e735109' + protoHex + '5b' + delegateHex + '00017868');
    assert(shownProto === '__proto__ | 1', `__proto__ content type: ${JSON.stringify(shownProto)}`);
    const ordProto = new OrdApiService({}).decodeInscriptions('20' + '02'.repeat(32) + 'b3' + '0063036f7264' + '010109' + protoHex + '01' + '0b' + delegateHex + '00017868');
    assert(ordProto.length === 1 && ordProto[0].content_type_str === '__proto__', `ord __proto__ envelope: ${JSON.stringify(ordProto)}`);
    const element = render(OrdDataComponent, 'src/app/components/ord-data/ord-data.component.html', [],
      [RouterLink, passthrough('relativeUrl'), passthrough('amountShortener'), passthrough('bytes')], (ord) => {
        Object.assign(ord, { inscriptions: ordProto, type: 'vin' });
        ord.ngOnChanges({ inscriptions: {} });
      });
    assert(element.querySelector('.badge')?.textContent.trim() === '__proto__', 'ord __proto__ group');
    for (const name of ['count', 'totalSize', 'delegate']) {
      assert(!Object.prototype.hasOwnProperty.call(Object.prototype, name), `Object.prototype.${name} was written`);
    }
    assert(inscriptionsShown(pinsLeaf('png')) === 'image/png | 97', 'a later panel inherits a delegate');
  }

  // a delegate link reads "Source qscription" as before, and "Source inscription" next to a P2MR Inscription
  const delegateLink = (pins) => {
    const element = render(OrdDataComponent, 'src/app/components/ord-data/ord-data.component.html', [],
      [RouterLink, passthrough('relativeUrl'), passthrough('amountShortener'), passthrough('bytes')], (ord) => {
        const delegated = { content_type_str: 'text/plain', body: new Uint8Array(), is_cropped: false, body_length: 5, delegate_txid: '11'.repeat(32) };
        Object.assign(ord, pins ? { inscriptions: [delegated], type: 'vin', pins } : { inscriptions: [delegated], type: 'vin' });
        ord.ngOnChanges({ inscriptions: {} });
      });
    return element.querySelector('a')?.textContent.trim();
  };
  assert(delegateLink(false) === 'Source qscription' && delegateLink(true) === 'Source inscription', `delegate links: ${delegateLink(false)} / ${delegateLink(true)}`);

  // the input buttons of the transaction list, on the list component's own code and template: a P2MR Inscription
  // input gets the PINS button, an ord input the Qscription button as before, any other input none
  const { TransactionsListComponent } = require('../src/app/components/transactions-list/transactions-list.component.ts');
  const { addInnerScriptsToVin } = require('../src/app/shared/transaction.utils.ts');
  const listTemplate = fs.readFileSync(path.join(frontendRoot, 'src/app/components/transactions-list/transactions-list.component.html'), 'utf8');
  const buttonLines = listTemplate.split('\n').filter((line) => /<button \*ngIf="vin\.(isInscription|isPinsInscription)"/.test(line));
  assert(buttonLines.length === 2 && /Qscription<\/button>/.test(buttonLines[0]) && />PINS<\/button>/.test(buttonLines[1]), 'input buttons in the list template');
  const clone = (tx) => JSON.parse(JSON.stringify(tx));
  const listTx = (tx) => {
    const copy = clone(tx);
    copy.status = { confirmed: true, block_height: 10000, block_time: 1 };
    copy.vin.forEach(addInnerScriptsToVin);
    const list = Object.assign(Object.create(TransactionsListComponent.prototype), {
      transactions: [copy], txPreview: true, blockTime: 1, similarityMatches: new Map(), showOrdData: {},
      stateService: { network: '' }, ordApiService: ordApi, updateAddressSimilarities: () => {}, refreshOutspends$: { next: () => {} },
    });
    list.ngOnChanges({ transactions: {} });
    return { list, tx: copy };
  };
  const inputButtons = (vin) => {
    const template = buttonLines.join('\n');
    const element = render(class {}, null, [], [], (host) => { host.vin = vin; }, template);
    return Array.from(element.querySelectorAll('button'), (button) => button.textContent.trim());
  };
  const plainSpend = clone(mint);
  for (const [name, source, buttons] of [
    ['a P2MR Inscription reveal', pinsReveals.text.tx, ['PINS']],
    ['an ord qscription reveal', etching, ['Qscription']],
    ['a spend without an envelope', plainSpend, []],
  ]) {
    const { tx } = listTx(source);
    const shown = inputButtons(tx.vin[0]);
    assert(JSON.stringify(shown) === JSON.stringify(buttons), `${name}: buttons ${JSON.stringify(shown)}`);
  }
  // inputs past the first ones can come without a prevout (lazyPrevouts); the PINS button is set once
  // "show more inputs" has loaded them
  {
    const { of } = require('rxjs');
    const full = clone(pinsReveals.text.tx);
    full.vin = [...Array(13).fill(clone(mint).vin[0]), full.vin[0]];
    const lazy = clone(full);
    lazy.vin[13] = { ...lazy.vin[13], prevout: null, lazy: true };
    const { list, tx } = listTx(lazy);
    assert(!tx.vin[13].isPinsInscription, 'PINS button on an input without a prevout');
    Object.assign(list, { txPreview: false, electrsApiService: { getTransaction$: () => of(clone(full)) }, ref: { markForCheck: () => {} } });
    list.loadMoreInputs(tx);
    assert(tx.vin[13].isPinsInscription === true && tx.vin.slice(0, 13).every((vin) => !vin.isPinsInscription), 'PINS button after the inputs are loaded');
    assert(JSON.stringify(inputButtons(tx.vin[13])) === JSON.stringify(['PINS']), 'PINS button on a loaded input');
  }
  // the PINS panel row is highlighted with its input, as the Qscription panel row is
  {
    const rowClasses = (key) => listTemplate.match(new RegExp(`<tr \\*ngIf="showOrdData\\[tx\\.txid \\+ '-${key}-' \\+ vindex\\]\\?\\.show" (\\[ngClass\\]="[^"]*")`))?.[1];
    assert(rowClasses('vin') && rowClasses('pins') === rowClasses('vin'), 'PINS panel row classes');
  }
  // the PINS button opens the P2MR Inscriptions of its input in the panel; the Qscription button still opens the ord ones
  {
    const { list, tx } = listTx(pinsReveals.text.tx);
    list.togglePinsData(tx.txid, 0);
    const entry = list.showOrdData[`${tx.txid}-pins-0`];
    assert(entry.show && entry.inscriptions.length === 1 && entry.inscriptions[0].content_type_str === 'text/plain;charset=utf-8', `PINS panel: ${JSON.stringify(entry)}`);
    list.togglePinsData(tx.txid, 0);
    assert(entry.show === false, 'PINS button does not close its panel');
    assert(!Object.keys(list.showOrdData).some((key) => key.endsWith('-vin-0')), 'PINS button opened the Qscription panel');
    const ord = listTx(etching);
    ord.list.toggleOrdData(ord.tx.txid, 'vin', 0);
    const ordEntry = ord.list.showOrdData[`${ord.tx.txid}-vin-0`];
    assert(ordEntry.show && ordEntry.inscriptions.length === 1 && ordEntry.inscriptions[0].content_type_str === 'image/svg+xml', `Qscription panel: ${JSON.stringify(ordEntry)}`);
  }

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

  // "show more inputs" replaces tx.vin with the inputs of the full transaction. Inputs past the first ones can come
  // without a prevout (lazyPrevouts), so their qscription is only found once they are loaded, and every loaded
  // input gets its taprootInfo again, which the Qscription panel of a taproot input reads its leaf script from.
  {
    const { of } = require('rxjs');
    const { TransactionsListComponent } = require('../src/app/components/transactions-list/transactions-list.component.ts');
    const { OrdApiService } = require('../src/app/services/ord-api.service.ts');
    const clone = (tx) => JSON.parse(JSON.stringify(tx));
    const ordScript = '20' + '02'.repeat(32) + 'ac' + '0063036f7264' + '01010a' + Buffer.from('text/plain').toString('hex') + '00' + '05' + Buffer.from('hello').toString('hex') + '68';
    const taprootReveal = {
      ...clone(mint.vin[0]),
      prevout: { scriptpubkey: '5120' + '33'.repeat(32), scriptpubkey_type: 'v1_p2tr', value: 10000 },
      witness: ['11'.repeat(64), ordScript, 'c0' + '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0'],
    };
    const full = clone(mint);
    full.vin = [taprootReveal, ...Array(12).fill(clone(mint).vin[0]), clone(etching).vin[0]].map(clone);
    full.status = { confirmed: true, block_height: 10000, block_time: 1 };
    const lazy = clone(full);
    lazy.vin[13] = { ...lazy.vin[13], prevout: null, lazy: true };
    const list = Object.assign(Object.create(TransactionsListComponent.prototype), {
      transactions: [lazy], txPreview: true, blockTime: 1, similarityMatches: new Map(), showOrdData: {},
      stateService: { network: '' }, ordApiService: new OrdApiService({}), updateAddressSimilarities: () => {}, refreshOutspends$: { next: () => {} },
    });
    list.ngOnChanges({ transactions: {} });
    assert(lazy.vin[0].isInscription === true && lazy.vin[0].taprootInfo?.scriptPath?.script === ordScript, 'taproot qscription input before loading');
    assert(!lazy.vin[13].isInscription, 'Qscription button on an input without a prevout');
    Object.assign(list, { txPreview: false, electrsApiService: { getTransaction$: () => of(clone(full)) }, ref: { markForCheck: () => {} } });
    list.loadMoreInputs(lazy);
    assert(lazy.vin[13].isInscription === true && lazy.vin.slice(1, 13).every((vin) => !vin.isInscription), 'Qscription button after the inputs are loaded');
    assert(lazy.vin[0].isInscription === true && lazy.vin[0].taprootInfo?.scriptPath?.script === ordScript, 'taprootInfo after the inputs are loaded');
    for (const index of [0, 13]) {
      list.toggleOrdData(lazy.txid, 'vin', index);
      const entry = list.showOrdData[`${lazy.txid}-vin-${index}`];
      const expected = index === 0 ? 'text/plain' : 'image/svg+xml';
      assert(entry.show && entry.inscriptions.length === 1 && entry.inscriptions[0].content_type_str === expected, `Qscription panel of loaded input ${index}: ${JSON.stringify(entry.inscriptions)}`);
    }
  }

  // Inputs that came without a prevout are loaded only by "show more inputs". Its row is rendered while the list is
  // cut short, so it stays when one of the last few inputs still has no prevout; loading them reads their signatures
  // and sizes the amount column again.
  {
    const { of } = require('rxjs');
    const { TransactionsListComponent } = require('../src/app/components/transactions-list/transactions-list.component.ts');
    const { OrdApiService } = require('../src/app/services/ord-api.service.ts');
    const clone = (tx) => JSON.parse(JSON.stringify(tx));
    const withInputs = (count) => {
      const tx = clone(mint);
      tx.vin = Array.from({ length: count }, () => clone(mint.vin[0]));
      tx.status = { confirmed: true, block_height: 10000, block_time: 1 };
      return tx;
    };
    const listOf = (tx, signaturesMode = 'all') => {
      const list = Object.assign(Object.create(TransactionsListComponent.prototype), {
        transactions: [tx], txPreview: true, blockTime: 1, similarityMatches: new Map(), showOrdData: {},
        signaturesMode, rowLimit: 12, inputRowLimit: 12, showMoreIncrement: 1000,
        stateService: { network: '' }, ordApiService: new OrdApiService({}), updateAddressSimilarities: () => {}, refreshOutspends$: { next: () => {} },
      });
      list.ngOnChanges({ transactions: {} });
      return list;
    };
    assert(listTemplate.includes('<tr *ngIf="tx.vin.length > getVinLimit(tx)">'), 'the "show more inputs" row follows getVinLimit');
    // with every prevout there, up to 5 inputs past the first 12 are shown at once, as before
    for (const [count, limit] of [[12, 12], [14, 14], [17, 17], [18, 12]]) {
      const tx = withInputs(count);
      assert(listOf(tx).getVinLimit(tx) === limit, `${count} inputs with prevouts: ${listOf(tx).getVinLimit(tx)} shown`);
    }
    const full = withInputs(14);
    full.vin[13].prevout.value = 2_000_000_000;
    const lazy = clone(full);
    lazy.vin[13] = { ...lazy.vin[13], prevout: null, lazy: true };
    const list = listOf(lazy);
    assert(list.getVinLimit(lazy) === 12, `"show more inputs" row with an input left to load: ${list.getVinLimit(lazy)} of 14 shown`);
    assert(list.getVinLimit(lazy, true) === 14, `the row's label counts what the click will show: ${list.getVinLimit(lazy, true)}`);
    // 13 inputs all have their prevout, but the fee is only known once the transaction is loaded (-1 until then)
    const noFee = withInputs(13);
    noFee.fee = -1;
    assert(listOf(noFee).getVinLimit(noFee) === 12 && listOf(noFee).getVinLimit(noFee, true) === 13, `13 inputs without a fee: ${listOf(noFee).getVinLimit(noFee)} shown`);
    // past 1000 inputs the click shows 1000 and the last few with them, as before, whether or not they are loaded yet
    const many = withInputs(1003);
    many.fee = -1;
    many.vin.slice(13).forEach((vin) => Object.assign(vin, { prevout: null, lazy: true }));
    assert(listOf(many).getVinLimit(many) === 12 && listOf(many).getVinLimit(many, true) === 1003, `1003 inputs: ${listOf(many).getVinLimit(many, true)} after the click`);
    assert(lazy._sigs[0].length === 1 && lazy._sigs[13].length === 0 && !lazy.largeInput, 'an input without a prevout has no signature yet');
    Object.assign(list, { txPreview: false, electrsApiService: { getTransaction$: () => of(clone(full)) }, ref: { markForCheck: () => {} } });
    list.showMoreInputs(lazy);
    assert(lazy.vin.length === 14 && lazy.vin.every((vin) => !vin.lazy) && list.getVinLimit(lazy) === 14, `inputs shown after loading: ${list.getVinLimit(lazy)}`);
    assert(lazy._sigs.every((sigs) => sigs.length === 1) && lazy._showSignatures === true, `signatures after loading: ${JSON.stringify(lazy._sigs.map((sigs) => sigs.length))}`);
    assert(Object.values(lazy._sigmap).some(({ vindex }) => vindex === 13), 'signature map after loading');
    assert(lazy.largeInput === true, 'amount column after loading an input of 20 QBT');
    // in "interesting" mode the signature column follows the loaded inputs: with no readable signature before
    // loading the transaction counts as interesting, and with an ordinary one on every input afterwards it does not
    const plain = withInputs(14);
    const unread = clone(plain);
    unread.fee = -1;
    unread.vin.forEach((vin) => Object.assign(vin, { prevout: null, lazy: true }));
    const quiet = listOf(unread, 'interesting');
    Object.assign(quiet, { txPreview: false, electrsApiService: { getTransaction$: () => of(clone(plain)) }, ref: { markForCheck: () => {} } });
    assert(unread._interestingSignatures === true && unread._showSignatures === true, 'no readable signature counts as interesting');
    quiet.showMoreInputs(unread);
    assert(unread._interestingSignatures === false && unread._showSignatures === false, `signature column after loading ordinary signatures: ${unread._interestingSignatures}`);
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

// The transaction and tracker pages wait for a transaction, tracking it over the websocket, when the backend answers
// 404, and also 503: under the none and electrum backends, qbitd's txindex is disabled or still building
{
  const { TransactionComponent } = require('../src/app/components/transaction/transaction.component.ts');
  const { TrackerComponent } = require('../src/app/components/tracker/tracker.component.ts');
  for (const [page, componentClass] of [['transaction page', TransactionComponent], ['tracker page', TrackerComponent]]) {
    for (const [status, txId, waits] of [
      [404, 'ab'.repeat(32), true],
      [503, 'ab'.repeat(32), true],
      [500, 'ab'.repeat(32), false],
      [400, 'not-a-txid', false],
    ]) {
      const tracked = [];
      const state = { txId, websocketService: { startMultiTrackTransaction: (id) => tracked.push(id) }, seoService: { logSoft404() {} } };
      componentClass.prototype.handleLoadElectrsTransactionError.call(state, { status });
      assert(!!state.waitingForTransaction === waits && tracked.length === (waits ? 1 : 0),
        `${page} after a ${status}: waitingForTransaction ${state.waitingForTransaction}, tracked ${JSON.stringify(tracked)}`);
    }
  }
}

console.log('qbit script smoke passed');
