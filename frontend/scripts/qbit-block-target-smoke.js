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

const { expectedBlocksForTimespan, shownTimespan, TIMESPAN_SECONDS } = require('../src/app/shared/block-target.utils.ts');

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

// A graph loads the requested range while its button shows, and ALL, the widest range on show, once
// the range is longer than the indexed chain. mempool.qbit.org had indexed 168,378 mainnet blocks, about
// 117 days, on 2026-11-09: enough for 3M, but not for pools dominance's default 6M or the 1Y that the
// mining dashboard's "View more" link opens the hashrate chart at.
const mainnetIndexedBlocks = 168378;
const shown = (timespan, blocks, spacing = QBIT_TARGET_SPACING_SECONDS) => shownTimespan(timespan, blocks, spacing);
assert(shown('3m', mainnetIndexedBlocks) === '3m', 'a 117-day chain should keep the 3M range');
assert(shown('6m', mainnetIndexedBlocks) === 'all', 'a 117-day chain should load ALL for a 6M request');
assert(shown('1y', mainnetIndexedBlocks) === 'all', 'a 117-day chain should load ALL for a 1Y request');
assert(shown('6m', mainnetIndexedBlocks, BITCOIN_TARGET_SPACING_SECONDS) === '6m', 'at 600 s spacing the same blocks cover 6M');
assert(shown('1m', 43200) === '1m' && shown('1m', 43199) === 'all', 'a range should show once the indexed blocks cover it');
assert(shown('24h', NaN) === 'all', 'without an indexed block count only ALL shows');
assert(shown('all', 0) === 'all', 'ALL always shows');
assert(shown('4y', 0) === '4y', 'a range no button gates should load as requested');

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
  const gatedOnCounts = new Set();
  let alwaysShowsAll = false;
  // opening label tags, stepping over quoted values such as "stats.blockCount >= ..."
  for (const [tag] of html.matchAll(/<label\b(?:[^>"]|"[^"]*")*>/g)) {
    const condition = tag.match(/\*ngIf="([^"]*)"/)?.[1];
    const timespan = tag.match(/radioGroupForm\.get\('dateSpan'\)\.value === '([^']+)'/)?.[1];
    alwaysShowsAll ||= timespan === 'all' && !condition;
    if (!condition || !timespan || !/blockcount/i.test(condition)) {
      continue;
    }
    gates++;
    gatedOnCounts.add(condition.match(/stats\.(\w+)/)?.[1]);
    const gatedOn = [...condition.matchAll(/(?:expectedBlocksForTimespan|hasIndexedTimespan)\([^)]*'([^']+)'\)/g)].map((match) => match[1]);
    assert(!/\d{3,}/.test(condition), `${template}: the ${timespan} button is gated on a literal block count: ${condition}`);
    assert(gatedOn.length === 1 && TIMESPAN_SECONDS[gatedOn[0]] > 0, `${template}: the ${timespan} button should be gated on one known timespan: ${condition}`);
    assert(gatedOn[0] === timespan, `${template}: the ${timespan} button is gated on ${gatedOn[0]}`);
  }
  if (gatedOnCounts.size === 0) {
    continue;
  }
  // A default, saved or linked range can be one whose button is hidden, so the graph must switch to the
  // widest range on show. shownTimespan() returns ALL for it, so ALL must always show.
  assert(alwaysShowsAll, `${template}: gates range buttons on the indexed block count but has no ALL button that always shows`);
  const component = fs.readFileSync(path.join(appRoot, file.replace(/\.html$/, '.ts')), 'utf8');
  const fallbackCounts = [...component.matchAll(/\.switchToShownRange\([^,]+,\s*stats\.(\w+)\)/g)].map((match) => match[1]);
  assert(fallbackCounts.length === 1, `${template}: its range buttons can hide the selected range; filter the graph's stats through MiningService.switchToShownRange()`);
  assert(gatedOnCounts.size === 1 && gatedOnCounts.has(fallbackCounts[0]),
    `${template}: switches ranges on stats.${fallbackCounts[0]} but gates its buttons on stats.${[...gatedOnCounts].join(', stats.')}`);
}
assert(gates > 0, 'no gated graph range buttons found; update this smoke if the range buttons moved');

// The mining dashboard's reward stats cover a day of blocks, as upstream's 144 does on Bitcoin, and
// their labels name the block count they cover.
const rewardStats = fs.readFileSync(path.join(appRoot, 'components/reward-stats/reward-stats.component.ts'), 'utf8');
const rewardBlocks = Number(rewardStats.match(/const REWARD_STATS_BLOCK_COUNT = (\d+);/)?.[1]);
assert(rewardBlocks === expectedBlocksForTimespan('24h', QBIT_TARGET_SPACING_SECONDS), `reward stats should cover a day of qbit blocks, not ${rewardBlocks}`);
assert(!/\b144\b/.test(rewardStats), 'reward stats should request and average REWARD_STATS_BLOCK_COUNT blocks, not 144');
const rewardLabel = `${rewardBlocks.toLocaleString('en-US')} blocks`;
const rewardLabels = [
  ...fs.readFileSync(path.join(appRoot, 'components/reward-stats/reward-stats.component.html'), 'utf8').matchAll(/ngbTooltip="[^"]* in the past ([\d,]+ blocks)"/g),
  ...fs.readFileSync(path.join(appRoot, 'components/mining-dashboard/mining-dashboard.component.html'), 'utf8').matchAll(/i18n="mining\.144-blocks">\(([\d,]+ blocks)\)/g),
].map((match) => match[1]);
assert(rewardLabels.length === 4 && rewardLabels.every((label) => label === rewardLabel), `reward stats labels should all say ${rewardLabel}: ${rewardLabels.join('; ')}`);

console.log('qbit block target smoke passed');
