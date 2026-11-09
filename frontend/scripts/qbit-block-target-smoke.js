#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { EMPTY, firstValueFrom, of } = require('rxjs');

const frontendRoot = path.resolve(__dirname, '..');
// compile like the app, as qbit-weight-smoke.js does
require('ts-node').register({
  project: path.join(frontendRoot, 'tsconfig.base.json'),
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
});
const aliases = {
  '@app/': path.join(frontendRoot, 'src/app/'),
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

// the browser state StorageService reads
const localStore = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (localStore.has(key) ? localStore.get(key) : null),
    setItem: (key, value) => { localStore.set(key, String(value)); },
    removeItem: (key) => { localStore.delete(key); },
  },
});
globalThis.window = { location: { pathname: '/', hash: '' } };

const { expectedBlocksForTimespan, shownTimespan, TIMESPAN_SECONDS } = require('../src/app/shared/block-target.utils.ts');
const { StorageService } = require('../src/app/services/storage.service.ts');
const { MiningService } = require('../src/app/services/mining.service.ts');
const { RewardStatsComponent } = require('../src/app/components/reward-stats/reward-stats.component.ts');

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

// A graph loads the requested range while it shows a button for it, and otherwise the widest range on
// show. mempool.qbit.org had indexed 168,378 mainnet blocks, about 117 days, on 2026-11-09: enough for
// 3M, but not for pools dominance's default 6M or the 1Y that the mining dashboard's "View more" link
// opens the hashrate chart at. The hashrate chart also takes #1m, which it has no button for.
const mainnetIndexedBlocks = 168378;
const hashrateButtons = ['3m', '6m', '1y', '2y', '3y', 'all'];
const dayButtons = ['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'];
const shown = (timespan, blocks, buttons = hashrateButtons, spacing = QBIT_TARGET_SPACING_SECONDS) => shownTimespan(timespan, buttons, blocks, spacing);
assert(shown('3m', mainnetIndexedBlocks) === '3m', 'a 117-day chain should keep the 3M range');
assert(shown('6m', mainnetIndexedBlocks) === 'all', 'a 117-day chain should load ALL for a 6M request');
assert(shown('1y', mainnetIndexedBlocks) === 'all', 'a 117-day chain should load ALL for a 1Y request');
assert(shown('6m', mainnetIndexedBlocks, hashrateButtons, BITCOIN_TARGET_SPACING_SECONDS) === '6m', 'at 600 s spacing the same blocks cover 6M');
assert(shown('1m', 43200, dayButtons) === '1m' && shown('1m', 43199, dayButtons) === 'all', 'a range should show once the indexed blocks cover it');
assert(shown('1m', 43200) === 'all', 'a range the graph has no button for should load the widest range on show');
assert(shown('1m', mainnetIndexedBlocks) === 'all', 'the hashrate chart has no 1M button, even with 3M on show');
assert(shown('24h', NaN, dayButtons) === 'all', 'without an indexed block count only ALL shows');
assert(shown('all', 0) === 'all', 'ALL always shows');
assert(shown('1w', 2000, ['24h', '1w']) === '24h', 'without ALL, the widest range on show is the widest gated one');
assert(shown('1w', 0, ['24h', '1w']) === '1w', 'with nothing on show, the requested range should load as requested');

// the arguments of the first call to `name` in `source`, split at its top-level commas
function callArguments(source, name) {
  const start = source.indexOf(`${name}(`);
  if (start < 0) {
    return null;
  }
  const args = [];
  let depth = 0;
  let argument = '';
  for (const char of source.slice(start + name.length + 1)) {
    if (depth === 0 && (char === ',' || char === ')')) {
      args.push(argument.trim());
      argument = '';
      if (char === ')') {
        return args;
      }
      continue;
    }
    depth += '(['.includes(char) ? 1 : ')]'.includes(char) ? -1 : 0;
    argument += char;
  }
  return null;
}

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
  const buttons = [];
  const gatedOnCounts = new Set();
  let alwaysShowsAll = false;
  // opening label tags, stepping over quoted values such as "stats.blockCount >= ..."
  for (const [tag] of html.matchAll(/<label\b(?:[^>"]|"[^"]*")*>/g)) {
    const condition = tag.match(/\*ngIf="([^"]*)"/)?.[1];
    const timespan = tag.match(/radioGroupForm\.get\('dateSpan'\)\.value === '([^']+)'/)?.[1];
    if (timespan) {
      buttons.push(timespan);
    }
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
  // A default, saved or linked range can be one the graph hides or has no button for, so the graph
  // switches to the widest range on show, which is ALL. It has to show whatever the chain's length.
  assert(alwaysShowsAll, `${template}: gates range buttons on the indexed block count but has no ALL button that always shows`);
  assert(gatedOnCounts.size === 1, `${template}: gates its buttons on more than one count: ${[...gatedOnCounts].join(', ')}`);
  const [gatedOnCount] = gatedOnCounts;
  const component = fs.readFileSync(path.join(appRoot, file.replace(/\.html$/, '.ts')), 'utf8');
  const rangeButtons = component.match(/readonly rangeButtons = \[([^\]]*)\];/)?.[1].match(/'[^']*'/g)?.map((button) => button.slice(1, -1));
  assert(rangeButtons?.join() === buttons.join(), `${template}: rangeButtons should list its buttons, ${buttons.join(', ')}, not ${rangeButtons?.join(', ')}`);
  assert(component.split('.switchToShownRange(').length === 2, `${template}: its range buttons can hide the selected range; filter what the graph loads through MiningService.switchToShownRange() once`);
  const [dateSpan, buttonsArgument, countArgument] = callArguments(component, '.switchToShownRange');
  assert(dateSpan === 'this.radioGroupForm.controls.dateSpan' && buttonsArgument === 'this.rangeButtons',
    `${template}: switchToShownRange() should take the graph's range control and rangeButtons, not ${dateSpan} and ${buttonsArgument}`);
  // the switch reads the count the buttons are gated on, or the response header the graph reads it from
  assert(new RegExp(`^\\w+\\.${gatedOnCount}$`).test(countArgument) || component.includes(`${gatedOnCount}: ${countArgument},`),
    `${template}: gates its buttons on stats.${gatedOnCount} but switches ranges on ${countArgument}`);
  // and drops what it loaded for a hidden range before the graph draws it or stops loading
  const init = component.search(/ngOnInit\(\): void \{/);
  const renders = ['this.prepareChartOptions(', 'this.applyHashrates()', 'this.isLoading = false'].map((call) => component.indexOf(call, init)).filter((at) => at >= 0);
  const switchesAt = component.indexOf('.switchToShownRange(');
  assert(init >= 0 && renders.length > 0 && switchesAt > init && switchesAt < Math.min(...renders),
    `${template}: filter through switchToShownRange() before the graph renders what it loaded`);
  // a chain-tip refresh started before the switch must not draw the range the graph switched from
  assert(!component.includes('chainTip$') || /chainTip\$[\s\S]*?filter\(\(\) => timespan === this\.\w+\)/.test(component),
    `${template}: drop a chain-tip refresh whose range the graph has since left`);
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

// Every mining graph opens at the saved miningWindowPreference. Most graphs save the range they load
// before the response shows it's hidden, and a link to the pools pages saves its range as the app
// starts. Once a graph switches to the widest range on show, the visitor's earlier preference must be
// back. `graphSaves` is the ranges the graph saves for its first load, before it switches.
function openGraph({ saved = null, pathname = '/graphs/mining/block-fees', hash = '' }) {
  localStore.clear();
  if (saved !== null) {
    localStore.set('miningWindowPreference', saved);
  }
  window.location = { pathname, hash };
  return new StorageService(null, null);
}
async function switchRange(storageService, requested, { graphSaves = true, buttons = dayButtons, blocks = mainnetIndexedBlocks } = {}) {
  const stateService = { env: { BLOCK_TARGET_SPACING_SECONDS: QBIT_TARGET_SPACING_SECONDS }, networkChanged$: { subscribe() {} } };
  const miningService = new MiningService(stateService, null, storageService);
  // like a graph's range control, which saves every range it loads after the first
  const dateSpan = { value: requested, setValue(value) { this.value = value; storageService.setValue('miningWindowPreference', value); } };
  if (graphSaves) {
    storageService.setValue('miningWindowPreference', requested);
  }
  const switched = miningService.switchToShownRange(dateSpan, buttons, blocks);
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  return { switched, selected: dateSpan.value, preference: localStore.get('miningWindowPreference') ?? null };
}

async function checkPreferences() {
  let result = await switchRange(openGraph({ saved: '1w', hash: '#1y' }), '1y');
  assert(result.switched && result.selected === 'all', `block fees at #1y on a 117-day chain should switch to ALL, not ${result.selected}`);
  assert(result.preference === '1w', `a link to a hidden range should leave the saved 1w preference, not ${result.preference}`);

  // pools dominance opened from the mining dashboard: upstream's StorageService saves an empty range when
  // the app starts at a pools URL without a fragment, which drops the preference before any graph runs
  result = await switchRange(openGraph({ saved: '1w', pathname: '/mining' }), '6m', { graphSaves: false, buttons: ['6m', '1y', '2y', '3y', 'all'] });
  assert(result.preference === '1w', `pools dominance's default 6M should leave the saved 1w preference, not ${result.preference}`);

  result = await switchRange(openGraph({ saved: '1w', pathname: '/graphs/mining/pools', hash: '#1y' }), '1y');
  assert(result.preference === '1w', `a pools link to a hidden range, which the app saves as it starts, should leave 1w, not ${result.preference}`);

  result = await switchRange(openGraph({ pathname: '/graphs/mining/pools', hash: '#1y' }), '1y');
  assert(result.preference === null, `a first visit through a pools link to a hidden range should save no preference, not ${result.preference}`);

  result = await switchRange(openGraph({ saved: '6m' }), '6m');
  assert(result.preference === '6m', `a preference saved on an earlier visit should stay, even when hidden, not ${result.preference}`);

  result = await switchRange(openGraph({ saved: '1w' }), '3m');
  assert(!result.switched && result.preference === '3m', `a range on show should load and save as upstream does, not ${result.selected} and ${result.preference}`);

  // a second switch in the same visit keeps the visitor's preference, not the ALL the first one loaded
  const storageService = openGraph({ saved: '6m', hash: '#1y' });
  await switchRange(storageService, '1y');
  result = await switchRange(storageService, '6m', { graphSaves: false, buttons: ['6m', '1y', '2y', '3y', 'all'] });
  assert(result.preference === '6m', `a second switch in one visit should keep the 6m preference, not ${result.preference}`);
}

// Reward stats request the window, and average fees over the blocks the response covers: fewer than
// the window while fewer are indexed. The API sends the totals as strings.
async function rewardFigures(response) {
  let requested;
  const apiService = { getRewardStats$: (blockCount) => { requested = blockCount; return of(response); } };
  const component = new RewardStatsComponent(apiService, { blocks$: EMPTY });
  component.ngOnInit();
  return { requested, ...(await firstValueFrom(component.$rewardStats)) };
}

async function checkRewardStats() {
  // mempool.qbit.org's /api/v1/mining/reward-stats/1440 on 2026-11-09
  let figures = await rewardFigures({ startBlock: 166946, endBlock: 168385, totalReward: '26489580035382', totalFee: '1816738902', totalTx: '26596' });
  assert(figures.requested === rewardBlocks, `reward stats should request ${rewardBlocks} blocks, not ${figures.requested}`);
  assert(figures.feePerBlock === 1816738902 / 1440 && figures.feePerTx === 1816738902 / 26596, `a full window should average fees over 1,440 blocks: ${JSON.stringify(figures)}`);
  // a regtest chain with 101 blocks
  figures = await rewardFigures({ startBlock: 0, endBlock: 100, totalReward: '2121000000000', totalFee: '5050', totalTx: '150' });
  assert(figures.feePerBlock === 50, `reward stats over 101 indexed blocks should average fees over those blocks, not give ${figures.feePerBlock}`);
}

checkPreferences()
  .then(checkRewardStats)
  .then(() => console.log('qbit block target smoke passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
