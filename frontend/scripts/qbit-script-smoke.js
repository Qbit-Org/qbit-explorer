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
