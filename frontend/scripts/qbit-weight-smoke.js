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

const {
  feeRatePerVsize,
  DEFAULT_FEE_RATE_WEIGHT,
  sigopsToAdjustedVsize,
  vsizeToWeight,
  weightToFractionalVsize,
  weightToVsize,
  WITNESS_SCALE_FACTOR,
} = require('../src/app/shared/weight-units.ts');
const { countScriptSigops, getNonWitnessSize } = require('../src/app/shared/transaction.utils.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(WITNESS_SCALE_FACTOR === 1, `qbit WSF mismatch: ${WITNESS_SCALE_FACTOR}`);
assert(weightToVsize(400) === 400, 'qbit weight-to-vsize conversion divided by legacy WSF');
assert(weightToFractionalVsize(1_800_000) === 1_800_000, 'qbit fractional vsize should equal weight');
assert(vsizeToWeight(1_800_000) === 1_800_000, 'qbit vsize-to-weight should be identity');
assert(feeRatePerVsize(100, 400) === 0.25, 'qbit fee rate should use weight as vsize');
assert(countScriptSigops('OP_CHECKSIG') === 1, 'qbit legacy sigops should scale by WSF=1');
assert(sigopsToAdjustedVsize(30) === 600, 'qbit adjusted vsize should use 20 bytes per sigop with WSF=1');
assert(getNonWitnessSize({ weight: 400, vin: [] }) === 400, 'qbit non-witness size should not divide weight by 4');
assert(DEFAULT_FEE_RATE_WEIGHT === vsizeToWeight(1), 'fee-rate component should default to one qbit vbyte');
assert(feeRatePerVsize(10, DEFAULT_FEE_RATE_WEIGHT) === 10, 'already-normalized qbit rates should not be divided by legacy WSF');

console.log('qbit weight smoke passed');
