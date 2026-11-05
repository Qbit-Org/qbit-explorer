#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
// compile like the app, as qbit-weight-smoke.js does
require('ts-node').register({
  project: path.join(frontendRoot, 'tsconfig.base.json'),
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
});

const { expectedBlocksForTimespan, TIMESPAN_SECONDS } = require('../src/app/shared/block-target.utils.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// qbit v1.0.0 targets 60 s blocks on every network, the aggregate of its 75 s permissionless
// and 300 s AuxPoW lanes (nPowTargetSpacing in src/kernel/chainparams.cpp)
const QBIT_TARGET_SPACING_SECONDS = 60;
const BITCOIN_TARGET_SPACING_SECONDS = 600;

// [timespan, qbit blocks, the Bitcoin 10-minute count that upstream's graph range buttons hardcode]
const ranges = [
  ['24h', 1440, 144],
  ['3d', 4320, 432],
  ['1w', 10080, 1008],
  ['1m', 43200, 4320],
  ['3m', 129600, 12960],
  ['6m', 259200, 25920],
  ['1y', 525600, 52560],
  ['2y', 1051200, 105120],
  ['3y', 1576800, 157680],
];
for (const [timespan, qbitBlocks, bitcoinBlocks] of ranges) {
  const blocks = expectedBlocksForTimespan(timespan, QBIT_TARGET_SPACING_SECONDS);
  assert(blocks === qbitBlocks, `${timespan} should span ${qbitBlocks} qbit blocks, not ${blocks}`);
  const bitcoinEquivalent = expectedBlocksForTimespan(timespan, BITCOIN_TARGET_SPACING_SECONDS);
  assert(bitcoinEquivalent === bitcoinBlocks, `${timespan} at 600 s spacing should match upstream's ${bitcoinBlocks} blocks, not ${bitcoinEquivalent}`);
}
assert(expectedBlocksForTimespan('1m', 0) === 43200, 'an invalid target spacing should fall back to qbit 60 s blocks');

// A graph range button shows once the indexed block count covers its timespan. Upstream hardcodes
// those gates for 144 blocks per day, so each one must go through expectedBlocksForTimespan() (or pool
// ranking's hasIndexedTimespan()) with its own timespan.
const appRoot = path.join(frontendRoot, 'src/app');
let gates = 0;
for (const file of fs.readdirSync(appRoot, { recursive: true })) {
  const template = file.split(path.sep).join('/');
  if (!template.endsWith('.html')) {
    continue;
  }
  const html = fs.readFileSync(path.join(appRoot, file), 'utf8');
  // opening label tags, stepping over quoted values such as "stats.blockCount >= ..."
  for (const [tag] of html.matchAll(/<label\b(?:[^>"]|"[^"]*")*>/g)) {
    const condition = tag.match(/\*ngIf="([^"]*)"/)?.[1];
    const timespan = tag.match(/radioGroupForm\.get\('dateSpan'\)\.value === '([^']+)'/)?.[1];
    if (!condition || !timespan || !/blockcount/i.test(condition)) {
      continue;
    }
    gates++;
    const gatedOn = [...condition.matchAll(/(?:expectedBlocksForTimespan|hasIndexedTimespan)\([^)]*'([^']+)'\)/g)].map((match) => match[1]);
    assert(!/\d{3,}/.test(condition), `${template}: the ${timespan} button is gated on a literal block count: ${condition}`);
    assert(gatedOn.length === 1 && TIMESPAN_SECONDS[gatedOn[0]] > 0, `${template}: the ${timespan} button should be gated on one known timespan: ${condition}`);
    assert(gatedOn[0] === timespan, `${template}: the ${timespan} button is gated on ${gatedOn[0]}`);
  }
}
assert(gates > 0, 'no gated graph range buttons found; update this smoke if the range buttons moved');

console.log('qbit block target smoke passed');
