#!/usr/bin/env node

const path = require('path');
const Module = require('module');
const { EMPTY, Subject } = require('rxjs');

const frontendRoot = path.resolve(__dirname, '..');
// compile like the app, as qbit-weight-smoke.js does
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

// the browser state the services and components below read
globalThis.window = { __env: {}, document: { referrer: '' }, location: { pathname: '/' }, innerWidth: 1280 };
globalThis.document = { referrer: '', location: { hostname: 'localhost', protocol: 'http:', host: 'localhost' } };
// StateService imports @angular/common and @angular/router, which need the JIT compiler outside an Angular build
require('@angular/compiler');

const { StateService } = require('../src/app/services/state.service.ts');
const { WebsocketService } = require('../src/app/services/websocket.service.ts');
const { CacheService } = require('../src/app/services/cache.service.ts');
const { MempoolBlocksComponent } = require('../src/app/components/mempool-blocks/mempool-blocks.component.ts');
const { MempoolBlockOverviewComponent } = require('../src/app/components/mempool-block-overview/mempool-block-overview.component.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// the blocks from height `from` to `to` of chain `name`, in the ascending order the backend sends them
function chain(name, from, to) {
  const blocks = [];
  for (let height = from; height <= to; height++) {
    blocks.push({ id: `${name}${height}`, height });
  }
  return blocks;
}

const changeDetector = { markForCheck: () => undefined, detectChanges: () => undefined };

// A page's StateService, CacheService and WebsocketService. They start as the server renders a page,
// which opens no socket; handleResponse() is the same in the browser.
function openPage(apiService = { getInitData$: () => EMPTY, getBlocks$: () => EMPTY }) {
  const storage = { getValue: () => null, setValue: () => undefined, removeItem: () => undefined };
  const stateService = new StateService('server', 'en-US', { events: new Subject() }, storage);
  const cacheService = new CacheService(stateService, apiService);
  const websocketService = new WebsocketService(stateService, apiService, null, cacheService);
  const requests = [];
  websocketService.websocketSubject = { next: (message) => requests.push(message) };
  const tips = [];
  stateService.chainTip$.subscribe((height) => tips.push(height));
  // the tip the block list's subscribers see as each list goes out
  const listTips = [];
  stateService.blocks$.subscribe(() => listTips.push(stateService.latestBlockHeight));
  const confirmed = [];
  stateService.txConfirmed$.subscribe(([txid, block]) => confirmed.push(`${txid} in ${block.id}`));
  return {
    stateService,
    cacheService,
    websocketService,
    receive: (response) => websocketService.handleResponse(response),
    // the tip, and the blocks the page shows, newest first
    tip: () => stateService.latestBlockHeight,
    shown: () => stateService.blocksSubject$.getValue().map((block) => block.id).join(' '),
    requests,
    tips,
    listTips,
    confirmed,
  };
}

function checkTip() {
  // The node switches to a shorter chain with more work: B100 on A99 replaces A100 and A101. The
  // backend drops A100 and A101, syncs B100 and sends a block message for it, which the page ignores
  // as upstream does, because it isn't above the page's tip. The reorg message that follows replaces
  // the page's blocks.
  let page = openPage();
  page.receive({ blocks: chain('A', 94, 101) });
  assert(page.tip() === 101 && page.shown() === 'A101 A100 A99 A98 A97 A96 A95 A94', `the first block list should show A94 to A101: tip ${page.tip()}, ${page.shown()}`);
  page.receive({ block: { id: 'B100', height: 100 } });
  assert(page.tip() === 101 && page.shown().startsWith('A101 '), `a new block below the tip should be ignored: tip ${page.tip()}, ${page.shown()}`);
  page.receive({ blocks: [...chain('A', 93, 99), ...chain('B', 100, 100)], reorg: true });
  assert(page.shown() === 'B100 A99 A98 A97 A96 A95 A94 A93', `a reorg should replace the blocks shown: ${page.shown()}`);
  assert(page.tip() === 100, `a reorg to a shorter chain should lower the tip to 100, not leave it at ${page.tip()}`);
  assert(page.tips.join() === '101,100', `the tip's subscribers, such as the start page's block pages, should get 100: ${page.tips.join()}`);
  assert(page.listTips.join() === '101,100', `the block list's subscribers should see tip 100 with the reorg's list, not ${page.listTips.join()}`);
  // the node's next block, at the height of the replaced tip
  page.receive({ block: { id: 'B101', height: 101 }, txConfirmed: 'tx1' });
  assert(page.shown() === 'B101 B100 A99 A98 A97 A96 A95 A94', `the block after a reorg to a shorter chain should show: ${page.shown()}`);
  assert(page.tip() === 101 && page.tips.join() === '101,100,101', `the block after the reorg should raise the tip to 101: tip ${page.tip()}, ${page.tips.join()}`);
  assert(page.confirmed.join() === 'tx1 in B101', `a transaction the page tracks should show as confirmed in B101: ${page.confirmed.join()}`);
  page.receive({ block: { id: 'B102', height: 102 } });
  assert(page.tip() === 102 && page.shown().startsWith('B102 B101 B100 A99 ') && page.requests.length === 0, `the blocks after that should show as upstream: tip ${page.tip()}, ${page.shown()}`);

  // After a chain wipe, the backend drops the blocks the node doesn't have and sends the node's
  // recent blocks as a reorg, far below the page's tip
  page = openPage();
  page.receive({ blocks: chain('old', 993, 1000) });
  page.receive({ blocks: chain('new', 43, 50), reorg: true });
  assert(page.tip() === 50 && page.shown() === 'new50 new49 new48 new47 new46 new45 new44 new43', `a chain wipe should leave the node's blocks and tip 50: tip ${page.tip()}, ${page.shown()}`);
  page.receive({ block: { id: 'new51', height: 51 } });
  assert(page.tip() === 51 && page.shown().startsWith('new51 new50 ') && page.requests.length === 0, `the node's next block after a chain wipe should show: tip ${page.tip()}, ${page.shown()}`);

  // A page whose socket drops while the chain moves to a shorter one gets the new list, unmarked, when
  // it reconnects. The list replaces a block the page has, so the page takes it as the reorg.
  page = openPage();
  page.receive({ blocks: chain('A', 94, 101) });
  page.receive({ blocks: [...chain('A', 93, 99), ...chain('B', 100, 100)] });
  assert(page.tip() === 100 && page.shown() === 'B100 A99 A98 A97 A96 A95 A94 A93', `a list on reconnecting that replaces A100 should lower the tip to 100: tip ${page.tip()}, ${page.shown()}`);
  assert(page.cacheService.getCachedBlock(101) === undefined, 'a list on reconnecting that replaces A100 should drop A101 from the block cache');
  page.receive({ block: { id: 'B101', height: 101 } });
  assert(page.tip() === 101 && page.shown().startsWith('B101 B100 A99 '), `the block after a reorg missed while offline should show: tip ${page.tip()}, ${page.shown()}`);
  // The same when the list replaces only blocks the page cached for an older block page: the chain
  // fell back below the eight blocks it showed
  page = openPage();
  page.receive({ blocks: chain('A', 94, 101) });
  chain('A', 81, 93).forEach((block) => page.cacheService.addBlockToCache(block));
  page.receive({ blocks: chain('B', 83, 90) });
  assert(page.tip() === 90 && !page.cacheService.getCachedBlock(91) && !page.cacheService.getCachedBlock(101), `a list on reconnecting that replaces cached blocks should lower the tip to 90 and drop the blocks above: tip ${page.tip()}`);

  // Any other list below the tip leaves it, as upstream: here the page reconnects to the network's
  // other origin, which lags two blocks. Its list agrees with the page's on every height they share.
  // The page shows that origin's blocks, and adds its new blocks once they pass its tip.
  page = openPage();
  page.receive({ blocks: chain('A', 94, 101) });
  page.receive({ blocks: chain('A', 92, 99) });
  assert(page.tip() === 101 && page.tips.join() === '101', `a list from a lagging origin should leave tip 101, not lower it to ${page.tip()}`);
  assert(page.shown() === 'A99 A98 A97 A96 A95 A94 A93 A92', `a list from a lagging origin should show its blocks, as upstream: ${page.shown()}`);
  page.receive({ block: { id: 'A100', height: 100 } });
  page.receive({ block: { id: 'A101', height: 101 } });
  page.receive({ block: { id: 'A102', height: 102 } });
  assert(page.tip() === 102 && page.shown().startsWith('A102 A99 ') && page.requests.length === 0, `a lagging origin's blocks should show once they pass the tip, as upstream: tip ${page.tip()}, ${page.shown()}`);

  // A list on reconnecting that replaces blocks at the page's tip, or above it, replaces them
  page = openPage();
  page.receive({ blocks: chain('A', 94, 101) });
  page.receive({ blocks: [...chain('A', 94, 99), ...chain('B', 100, 101)] });
  assert(page.tip() === 101 && page.shown().startsWith('B101 B100 A99 ') && page.cacheService.getCachedBlock(100)?.id === 'B100', `a list on reconnecting that replaces A100 and A101 should show B100 and B101: tip ${page.tip()}, ${page.shown()}`);
  page.receive({ blocks: [...chain('A', 96, 99), ...chain('C', 100, 102)] });
  assert(page.tip() === 102 && page.shown().startsWith('C102 C101 C100 A99 '), `a longer list on reconnecting that replaces B100 and B101 should show C100 to C102: tip ${page.tip()}, ${page.shown()}`);

  // As upstream: a reorg to a longer chain, the only kind upstream's backend sends, raises the tip.
  // A block at or below the tip is ignored, and one more than one block above it asks the backend for
  // its blocks again.
  page = openPage();
  page.receive({ blocks: chain('A', 93, 100) });
  page.receive({ blocks: [...chain('A', 93, 99), ...chain('B', 100, 101)], reorg: true });
  assert(page.tip() === 101 && page.shown() === 'B101 B100 A99 A98 A97 A96 A95 A94 A93', `a reorg to a longer chain should show B100 and B101: tip ${page.tip()}, ${page.shown()}`);
  page.receive({ block: { id: 'B101', height: 101 } });
  assert(page.tip() === 101 && page.shown().startsWith('B101 B100 A99 '), `a repeated block should be ignored: tip ${page.tip()}, ${page.shown()}`);
  page.receive({ block: { id: 'B103', height: 103 } });
  assert(page.tip() === 101 && page.requests.map((request) => JSON.stringify(request)).join() === '{"refresh-blocks":true}', `a block that skips a height should ask for the blocks again: tip ${page.tip()}, ${JSON.stringify(page.requests)}`);
  page.receive({ blocks: [...chain('A', 96, 99), ...chain('B', 100, 103)] });
  assert(page.tip() === 103 && page.shown() === 'B103 B102 B101 B100 A99 A98 A97 A96', `the blocks sent again should show up to B103: tip ${page.tip()}, ${page.shown()}`);
  // A same-height replacement keeps the tip, and its subscribers aren't told it again: the mining
  // graphs fetch their data each time
  page.receive({ blocks: [...chain('A', 96, 99), ...chain('B', 100, 102), ...chain('C', 103, 103)], reorg: true });
  assert(page.tip() === 103 && page.shown().startsWith('C103 B102 '), `a same-height replacement should show C103 at tip 103: tip ${page.tip()}, ${page.shown()}`);
  assert(page.tips.join() === '100,101,103', `a same-height replacement should not repeat the tip to its subscribers: ${page.tips.join()}`);
}

function checkMempoolBlocks() {
  // The mempool blocks slide along when a block is mined. After a chain wipe, the first new block
  // should slide them too.
  const page = openPage();
  page.receive({ blocks: chain('old', 993, 1000) });
  const mempoolBlocks = new MempoolBlocksComponent({}, page.stateService, {}, { themeState$: EMPTY }, changeDetector, {}, {});
  mempoolBlocks.ngOnInit();
  const index = mempoolBlocks.blockIndex;
  page.receive({ blocks: chain('new', 43, 50), reorg: true });
  assert(mempoolBlocks.blockIndex === index && !mempoolBlocks.animateEntry, 'the mempool blocks should not slide for a reorg');
  page.receive({ block: { id: 'new51', height: 51 } });
  assert(mempoolBlocks.blockIndex === index + 1 && mempoolBlocks.animateEntry, `the mempool blocks should slide for the first block after a chain wipe: blockIndex ${mempoolBlocks.blockIndex}, was ${index}`);
  mempoolBlocks.ngOnDestroy();

  // A mempool block's overview shows the transactions a new block took out as mined. After a reorg
  // to a shorter chain, the next block's should be too.
  const otherPage = openPage();
  otherPage.receive({ blocks: chain('A', 94, 101) });
  const overview = new MempoolBlockOverviewComponent(otherPage.stateService, { stopTrackMempoolBlock: () => undefined }, {}, changeDetector);
  const drawn = [];
  overview.blockGraph = {
    enter: () => drawn.push('enter'),
    replace: () => drawn.push('replace'),
    update: (added, removed, changed, direction, blockMined) => drawn.push(blockMined ? 'mined' : 'update'),
    deferredUpdate: () => drawn.push('update'),
    destroy: () => undefined,
  };
  overview.index = 0;
  overview.ngOnInit();
  overview.ngAfterViewInit();
  const update = { block: 0, added: [], removed: [], changed: [] };
  otherPage.stateService.mempoolBlockUpdate$.next({ block: 0, transactions: [] });
  otherPage.stateService.mempoolBlockUpdate$.next(update);
  otherPage.receive({ blocks: [...chain('A', 93, 99), ...chain('B', 100, 100)], reorg: true });
  otherPage.receive({ block: { id: 'B101', height: 101 } });
  otherPage.stateService.mempoolBlockUpdate$.next(update);
  assert(drawn.join() === 'enter,update,mined', `the mempool block should show the block after a reorg to a shorter chain as mined: ${drawn.join()}`);
  overview.ngOnDestroy();
}

// The block cache keeps blocks by height for the start page's older block pages
async function checkCache() {
  const tick = () => new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  let nodeChain = chain('old', 900, 1000);
  const requested = [];
  const answers = [];
  // the API answers with the 10 blocks up to a height, as the node has them when it is asked
  const apiService = {
    getBlocks$: (height) => {
      requested.push(height);
      const blocks = nodeChain.filter((block) => block.height <= height).slice(-10).reverse();
      const answer = new Subject();
      answers.push(() => answer.next(blocks));
      return answer;
    },
    getInitData$: () => EMPTY,
  };
  const page = openPage(apiService);
  const cache = page.cacheService;
  page.receive({ blocks: chain('old', 993, 1000) });
  // the page loads an older block page, and starts loading another
  cache.loadBlock(985);
  answers.shift()();
  await tick();
  assert(cache.getCachedBlock(985)?.id === 'old985', 'the cache should hold the blocks the page loaded');
  cache.loadBlock(975);

  // the chain is wiped before that answer arrives
  nodeChain = chain('new', 0, 50);
  page.receive({ blocks: chain('new', 43, 50), reorg: true });
  answers.shift()();
  await tick();
  const oldBlocks = [1000, 993, 985, 975].map((height) => cache.getCachedBlock(height)?.id).filter((id) => id);
  assert(oldBlocks.length === 0, `a chain wipe should drop the old chain's blocks above the new tip, not keep ${oldBlocks.join(', ')}`);
  assert(cache.getCachedBlock(50)?.id === 'new50' && cache.getCachedBlock(43)?.id === 'new43', 'the cache should hold the new chain\'s blocks');
  cache.loadBlock(993);
  assert(requested.join() === '990,980,1000', `a block page above the old tip should load from the API, not the cache: ${requested.join()}`);
}

checkTip();
checkMempoolBlocks();
checkCache()
  .then(() => console.log('qbit reorg smoke passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
