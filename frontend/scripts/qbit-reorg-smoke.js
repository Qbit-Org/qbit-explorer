#!/usr/bin/env node

const path = require('path');
const Module = require('module');
const { BehaviorSubject, EMPTY, Observable, Subject } = require('rxjs');

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
globalThis.window = {
  __env: {},
  document: { referrer: '' },
  location: { pathname: '/' },
  innerWidth: 1280,
  matchMedia: () => ({ matches: false }),
};
globalThis.document = { referrer: '', location: { hostname: 'localhost', protocol: 'http:', host: 'localhost' } };
// for the page titles BlocksList sets
globalThis.$localize = (strings, ...values) => String.raw({ raw: strings }, ...values);
// StateService imports @angular/common and @angular/router, which need the JIT compiler outside an Angular build
require('@angular/compiler');

const { StateService } = require('../src/app/services/state.service.ts');
const { WebsocketService } = require('../src/app/services/websocket.service.ts');
const { CacheService } = require('../src/app/services/cache.service.ts');
const { MempoolBlocksComponent } = require('../src/app/components/mempool-blocks/mempool-blocks.component.ts');
const { MempoolBlockOverviewComponent } = require('../src/app/components/mempool-block-overview/mempool-block-overview.component.ts');
const { BlocksList } = require('../src/app/components/blocks-list/blocks-list.component.ts');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// the blocks from height `from` to `to` of chain `name`, in the ascending order the backend sends them
function chain(name, from, to) {
  const blocks = [];
  for (let height = from; height <= to; height++) {
    blocks.push({ id: `${name}${height}`, height, previousblockhash: `${name}${height - 1}`, extras: { pool: { slug: 'unknown' } } });
  }
  return blocks;
}

// the ids of chain `name`'s blocks from height `from` down to `to`, as a list shows them
function ids(name, from, to) {
  return chain(name, to, from).reverse().map((block) => block.id).join(' ');
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

// /blocks, or with `widget`, the mining dashboard's latest blocks, on a tab whose state has blocks A94
// to A101, and to which `before` sends anything else before the list opens. The API answers a request
// when the check calls answer() with the node's chain: for /api/v1/blocks/<from>, the 15 blocks from
// `from`, or the tip, down. As with HttpClient, each subscription sends a request, so a retry sends
// another. A request is `fresh` when it asks past the browser's and any CDN's copies.
function openBlocksList({ widget = false, page = 1, before = () => undefined } = {}) {
  const requests = [];
  const apiService = {
    getInitData$: () => EMPTY,
    getBlocks$: (from, fresh = false) => new Observable((subscriber) => {
      requests.push({
        from,
        fresh,
        answer: (nodeChain) => {
          subscriber.next(nodeChain.filter((block) => from === undefined || block.height <= from).slice(-15).reverse()
            .map((block) => ({ ...block, extras: { pool: { ...block.extras.pool } } })));
          subscriber.complete();
        },
      });
    }),
  };
  const tab = openPage(apiService);
  tab.receive({ blocks: chain('A', 94, 101) });
  before(tab);
  const params = new BehaviorSubject({ page: String(page) });
  const navigated = [];
  const list = new BlocksList(apiService, tab.websocketService, tab.stateService, changeDetector,
    { setTitle: () => undefined, setDescription: () => undefined }, { setManualOgImage: () => undefined },
    { params }, { navigate: (commands) => navigated.push(commands.join('')) }, { transform: (url) => url }, 'en-US');
  list.widget = widget;
  list.ngOnInit();
  let listed = [];
  let emissions = 0;
  const subscription = list.blocks$.subscribe((blocks) => {
    listed = blocks;
    emissions++;
  });
  return {
    ...tab,
    list,
    requests,
    navigated,
    // the API answers the latest request
    answer: (nodeChain) => requests[requests.length - 1].answer(nodeChain),
    goTo: (number) => params.next({ page: String(number) }),
    listed: () => listed.map((block) => block.id).join(' '),
    emissions: () => emissions,
    close: () => subscription.unsubscribe(),
  };
}

// runs `check` with rxjs's timers, such as the 10 seconds before the block list asks the API again,
// firing at once
async function withImmediateTimers(check) {
  const setInterval = globalThis.setInterval;
  globalThis.setInterval = (handler, timeout, ...args) => setInterval(handler, 0, ...args);
  try {
    await check();
  } finally {
    globalThis.setInterval = setInterval;
  }
}

// /blocks and the mining dashboard's latest blocks load a page from the API, then follow the state's
// blocks, and its reorgs
async function checkBlocksList() {
  const tick = () => new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  const nodeA = chain('A', 0, 101);
  // the node's chain after B100 on A99 replaces A100 and A101
  const nodeB = [...chain('A', 0, 99), ...chain('B', 100, 100)];
  // the backend's message for that reorg, with its cached blocks, 32 by default. A new one each time:
  // the page keeps and changes the list it gets, as it does the one it parses from each message.
  const reorgToB = () => ({ blocks: [...chain('A', 69, 99), ...chain('B', 100, 100)], reorg: true });

  // /blocks after a reorg to a shorter chain, and the next block
  let page = openBlocksList();
  page.answer(nodeA);
  assert(page.listed() === ids('A', 101, 87), `/blocks should show A101 to A87: ${page.listed()}`);
  page.receive(reorgToB());
  assert(page.listed() === `B100 ${ids('A', 99, 86)}` && page.list.blocksCount === 101, `/blocks should replace A100 and A101 with B100 after a reorg: ${page.listed()}, ${page.list.blocksCount} blocks`);
  page.receive({ block: chain('B', 101, 101)[0] });
  assert(page.listed() === `B101 B100 ${ids('A', 99, 87)}`, `/blocks should show the block after a reorg to a shorter chain: ${page.listed()}`);
  // a reorg that replaces the tip at the same height, then one to a longer chain
  page.receive({ blocks: [...chain('A', 70, 99), ...chain('B', 100, 100), ...chain('C', 101, 101)], reorg: true });
  assert(page.listed() === `C101 B100 ${ids('A', 99, 87)}`, `/blocks should replace the tip at the same height: ${page.listed()}`);
  page.receive({ blocks: [...chain('A', 71, 99), ...chain('D', 100, 102)], reorg: true });
  assert(page.listed() === `D102 D101 D100 ${ids('A', 99, 88)}` && page.list.blocksCount === 103, `/blocks should follow a reorg to a longer chain: ${page.listed()}, ${page.list.blocksCount} blocks`);
  assert(page.requests.length === 1, `the reorgs' lists hold the blocks /blocks shows, so it should not ask the API again: ${page.requests.length} requests`);
  page.close();

  // the mining dashboard's latest blocks, which show six
  page = openBlocksList({ widget: true });
  page.answer(nodeA);
  page.receive(reorgToB());
  assert(page.listed() === `B100 ${ids('A', 99, 95)}`, `the mining dashboard should replace A100 and A101 with B100 after a reorg: ${page.listed()}`);
  page.receive({ block: chain('B', 101, 101)[0] });
  assert(page.listed() === `B101 B100 ${ids('A', 99, 96)}`, `the mining dashboard should show the block after a reorg to a shorter chain: ${page.listed()}`);
  page.close();

  // a reorg to the chain below the tip, as after an invalidateblock that no block replaced yet
  page = openBlocksList();
  page.answer(nodeA);
  page.receive({ blocks: chain('A', 69, 100), reorg: true });
  assert(page.listed() === ids('A', 100, 86), `/blocks should drop A101 after a reorg to A100: ${page.listed()}`);
  page.receive({ block: chain('B', 101, 101)[0] });
  assert(page.listed() === `B101 ${ids('A', 100, 87)}`, `/blocks should show the block after A100: ${page.listed()}`);
  page.close();

  // A page whose socket dropped during the reorg gets the new list, unmarked and eight blocks long,
  // when it reconnects. /blocks then has 14 of its 15 blocks and asks the API for its page again.
  page = openBlocksList();
  page.answer(nodeA);
  page.receive({ blocks: [...chain('A', 93, 99), ...chain('B', 100, 100)] });
  await tick();
  assert(page.requests.length === 2 && page.requests[1].fresh, `/blocks should ask for its page again, past the browser's copy, after a reorg that left it 14 blocks: ${JSON.stringify(page.requests)}`);
  page.answer(nodeB);
  assert(page.listed() === `B100 ${ids('A', 99, 86)}`, `/blocks should follow a reorg it missed while offline: ${page.listed()}`);
  page.close();

  // A reorg to a longer chain that forked below the blocks the backend sent, which are all above those
  // /blocks shows: it can't tell which of them the reorg kept, and asks for its page again
  page = openBlocksList();
  page.answer(nodeA);
  page.receive({ blocks: chain('B', 102, 109), reorg: true });
  assert(page.listed() === ids('B', 109, 102), `/blocks should show only B109 to B102 after a reorg from below its blocks: ${page.listed()}`);
  await tick();
  page.answer(chain('B', 0, 109));
  assert(page.listed() === ids('B', 109, 95) && page.requests.length === 2, `/blocks should show B109 to B95: ${page.listed()}`);
  page.close();

  // As upstream, a list from an origin that lags leaves the blocks shown, and a new block shows on top
  page = openBlocksList();
  page.answer(nodeA);
  page.receive({ blocks: chain('A', 92, 99) });
  page.receive({ block: chain('A', 102, 102)[0] });
  assert(page.listed() === ids('A', 102, 88) && page.requests.length === 1, `a list from a lagging origin should leave /blocks as it was: ${page.listed()}`);
  page.close();

  // An older page that a reorg didn't reach stays as it is. Page 2 asks for the blocks from 86 down,
  // after page 1's answer counted them.
  page = openBlocksList({ page: 2 });
  page.answer(nodeA);
  page.answer(nodeA);
  assert(page.requests.map((request) => request.from).join() === ',86' && page.listed() === ids('A', 86, 72), `page 2 should show A86 to A72: ${page.listed()}`);
  page.receive(reorgToB());
  assert(page.listed() === ids('A', 86, 72) && page.requests.length === 2, `a reorg above page 2 should leave it as it was: ${page.listed()}, ${page.requests.length} requests`);
  // the same for one it gets when it reconnects, eight blocks long: the blocks the tab had locate it
  page.receive({ blocks: [...chain('A', 93, 99), ...chain('C', 100, 100)] });
  assert(page.listed() === ids('A', 86, 72) && page.requests.length === 2, `a reorg on reconnecting, above page 2, should leave it as it was: ${page.listed()}, ${page.requests.length} requests`);
  // One that a reorg reached takes the reorg's blocks: here B80 on A79 replaces A80 and up
  page.receive({ blocks: [...chain('A', 70, 79), ...chain('B', 80, 101)], reorg: true });
  assert(page.listed() === `${ids('B', 86, 80)} ${ids('A', 79, 72)}` && page.requests.length === 2, `a reorg from B80 should replace page 2's A86 to A80: ${page.listed()}, ${page.requests.length} requests`);
  page.close();
  // After a reorg deeper than the blocks the backend sent, it asks for its page again
  page = openBlocksList({ page: 2 });
  page.answer(nodeA);
  page.answer(nodeA);
  page.receive({ blocks: chain('B', 94, 101), reorg: true });
  await tick();
  assert(page.requests.length === 3 && page.requests[2].from === 86 && page.requests[2].fresh, `page 2 should ask for its blocks again, past the browser's copy, after a reorg deeper than the list: ${JSON.stringify(page.requests)}`);
  page.answer(chain('B', 0, 101));
  assert(page.listed() === ids('B', 86, 72), `page 2 should show B86 to B72: ${page.listed()}`);
  page.close();

  // An answer from before a reorg doesn't bring back the blocks the reorg replaced: here the reorg
  // comes while /blocks waits for its first answer
  page = openBlocksList();
  page.receive(reorgToB());
  page.answer(nodeA);
  assert(page.listed() === `B100 ${ids('A', 99, 86)}`, `an answer from before a reorg should not bring back A100 and A101: ${page.listed()}`);
  // Nor does the copy of page 1 that the browser kept, for up to 60 seconds, when the visitor goes to
  // page 2 and back
  page.goTo(2);
  page.answer(nodeB);
  assert(page.listed() === ids('A', 85, 71), `page 2 should show A85 to A71: ${page.listed()}`);
  page.goTo(1);
  page.answer(nodeA);
  assert(page.listed() === `B100 ${ids('A', 99, 86)}`, `a copy of page 1 from before a reorg should not bring back A100 and A101: ${page.listed()}`);
  page.close();

  // After a chain wipe, the reorg's eight blocks are too few for /blocks, which asks for its page
  // again. A copy the browser kept from before the wipe is not shown, and is asked for again after
  // the 10 seconds the list waits between requests (in the browser; the server renders once).
  page = openBlocksList();
  page.answer(nodeA);
  page.stateService.isBrowser = true;
  page.receive({ blocks: chain('new', 43, 50), reorg: true });
  assert(page.listed() === ids('new', 50, 43), `/blocks should show the new chain's blocks after a chain wipe: ${page.listed()}`);
  await tick();
  await withImmediateTimers(async () => {
    page.answer(nodeA);
    assert(page.listed() === ids('new', 50, 43), `a copy of page 1 from before a chain wipe should not show: ${page.listed()}`);
    await tick();
    assert(page.requests.length === 3 && page.requests[2].fresh, `/blocks should ask again, past the browser's copy, for an answer it could not follow: ${JSON.stringify(page.requests)}`);
    page.answer(chain('new', 0, 50));
    assert(page.listed() === ids('new', 50, 36), `/blocks should show new50 to new36: ${page.listed()}`);
  });
  page.close();

  // Until the API's first answer, the list sends nothing, so that the page shows its skeleton, not an
  // empty table: the tab's state has blocks already, as when the visitor comes from another page
  page = openBlocksList();
  assert(page.emissions() === 0, `/blocks should send no list before the API's first answer, not ${page.emissions()}: [${page.listed()}]`);
  page.answer(nodeA);
  assert(page.emissions() === 1 && page.listed() === ids('A', 101, 87), `/blocks should send the API's first answer: ${page.emissions()} lists, ${page.listed()}`);
  page.close();

  // A list that opens after a reorg to a shorter chain doesn't take the block that reorg removed from
  // a copy of /api/v1/blocks the browser kept, for up to 60 seconds
  page = openBlocksList({ before: (tab) => tab.receive({ blocks: chain('A', 69, 100), reorg: true }) });
  page.answer(nodeA);
  assert(page.listed() === ids('A', 100, 86), `a list that opens after a reorg to A100 should not show A101 from the browser's copy: ${page.listed()}`);
  page.close();

  // An API origin whose chain differs from the websocket's, as a network's other origin can: the list
  // asks it twice more, past caches and 10 seconds apart, then shows the blocks that fit. First, on a
  // tab that saw a chain wipe before /blocks opened, an origin that still has the old chain.
  page = openBlocksList({ before: (tab) => tab.receive({ blocks: chain('new', 43, 50), reorg: true }) });
  page.stateService.isBrowser = true;
  await withImmediateTimers(async () => {
    for (let answer = 0; answer < 3; answer++) {
      page.answer(nodeA);
      await tick();
    }
  });
  assert(page.listed() === ids('new', 50, 43) && !page.list.isLoading, `/blocks should show the blocks that fit after asking an origin on another chain three times, not stay on its skeleton: ${page.emissions()} lists, ${page.listed()}`);
  assert(page.requests.map((request) => request.fresh).join() === 'true,true,true', `/blocks should ask such an origin three times, past caches: the tab saw a reorg that may reach its page: ${JSON.stringify(page.requests)}`);
  page.close();
  // Then page 2, after a reorg to B101 that /blocks followed on page 1, from an origin still on A
  page = openBlocksList();
  page.answer(nodeA);
  page.receive({ blocks: chain('B', 80, 101), reorg: true });
  page.stateService.isBrowser = true;
  page.goTo(2);
  await withImmediateTimers(async () => {
    for (let answer = 0; answer < 3; answer++) {
      page.answer(nodeA);
      await tick();
    }
  });
  assert(page.list.shownPage === 2 && page.listed() === ids('B', 86, 80) && !page.list.isLoading && page.requests.length === 4, `page 2 should show the blocks that fit after asking an origin on another chain three times, not stay on page 1's: page ${page.list.shownPage}, ${page.listed()}, ${page.requests.length} requests`);
  page.close();
  // Right after a reorg, until the next block, the backend's list for a page that connects holds its
  // whole cache, 32 blocks by default. They cover /blocks, so an origin on another chain needs no retry:
  // the list shows the websocket's blocks at once.
  page = openBlocksList({ before: (tab) => tab.receive({ blocks: chain('B', 70, 101) }) });
  page.answer(nodeA);
  assert(page.listed() === ids('B', 101, 87) && page.requests.length === 1, `/blocks should show the websocket's B101 to B87 at once when its blocks cover the page: ${page.listed()}, ${page.requests.length} requests`);
  page.close();
  // Then a reload after a reorg the tab missed while offline, whose eight blocks replaced all of /blocks'
  // A94 to A101: the reload counts towards the retries too
  page = openBlocksList();
  page.answer(nodeA);
  page.stateService.isBrowser = true;
  page.receive({ blocks: chain('B', 94, 101) });
  await tick();
  assert(page.requests.length === 2 && page.requests[1].fresh, `/blocks should ask for its page again, past caches, after a reorg that left it eight blocks: ${JSON.stringify(page.requests)}`);
  await withImmediateTimers(async () => {
    for (let answer = 0; answer < 3; answer++) {
      page.answer(nodeA);
      await tick();
    }
  });
  assert(page.listed() === ids('B', 101, 94) && !page.list.isLoading && page.requests.length === 4, `/blocks should show the blocks that fit after asking again, and retrying twice, for an origin still on A: ${page.listed()}, loading ${page.list.isLoading}, ${page.requests.length} requests`);
  page.close();

  // A reorg to a shorter chain that takes all of page 2's heights: the list counts the new chain's
  // blocks, and page 2 shows its page of the new chain, as a reload would
  page = openBlocksList({ page: 2 });
  page.answer(nodeA);
  page.answer(nodeA);
  page.receive({ blocks: [...chain('A', 29, 55), ...chain('C', 56, 60)], reorg: true });
  assert(page.list.blocksCount === 61, `a reorg to C60 should count 61 blocks, not ${page.list.blocksCount}`);
  await tick();
  assert(page.requests.length === 3 && page.requests[2].from === 45 && page.requests[2].fresh, `page 2 should ask for the new chain's blocks from 45 down: ${JSON.stringify(page.requests)}`);
  page.answer([...chain('A', 0, 55), ...chain('C', 56, 60)]);
  assert(page.listed() === ids('A', 45, 31), `page 2 should show A45 to A31 after a reorg to C60: ${page.listed()}`);
  page.close();
  // and page 5, which a chain of 31 blocks doesn't have, goes to its last page, page 3
  page = openBlocksList({ page: 5 });
  page.answer(nodeA);
  page.answer(nodeA);
  assert(page.listed() === ids('A', 41, 27), `page 5 should show A41 to A27: ${page.listed()}`);
  page.receive({ blocks: [...chain('A', 0, 20), ...chain('D', 21, 30)], reorg: true });
  await tick();
  assert(page.list.blocksCount === 31 && page.navigated.join() === '/blocks/3', `page 5 should go to page 3 after a reorg to D30: ${page.list.blocksCount} blocks, ${JSON.stringify(page.navigated)}`);
  page.close();

  // The page count follows a reorg that doesn't reach the older page shown too, which stays as it is:
  // a reorg to A100, then one to B103
  page = openBlocksList({ page: 2 });
  page.answer(nodeA);
  page.answer(nodeA);
  page.receive({ blocks: chain('A', 69, 100), reorg: true });
  assert(page.listed() === ids('A', 86, 72) && page.list.blocksCount === 101, `page 2 should stay as it is and count 101 blocks after a reorg to A100: ${page.listed()}, ${page.list.blocksCount} blocks`);
  page.receive({ blocks: [...chain('A', 72, 99), ...chain('B', 100, 103)], reorg: true });
  assert(page.listed() === ids('A', 86, 72) && page.list.blocksCount === 104 && page.requests.length === 2, `page 2 should stay as it is and count 104 blocks after a reorg to B103: ${page.listed()}, ${page.list.blocksCount} blocks, ${page.requests.length} requests`);
  page.close();

  // After a reorg, the API's blocks above the websocket's tip show unless the answer holds a block the
  // reorg removed: here the tab's tip is still A100, after a reorg to it, as when its socket has
  // dropped without the page noticing yet, and the API is at A130
  page = openBlocksList({ before: (tab) => tab.receive({ blocks: chain('A', 69, 100), reorg: true }) });
  page.answer(chain('A', 0, 130));
  assert(page.listed() === ids('A', 130, 116) && page.list.blocksCount === 131, `/blocks should show the API's A130 to A116 above an old tip: ${page.listed()}, ${page.list.blocksCount} blocks`);
  page.close();

  // A later reorg the tab didn't take as one, as it was offline, leaves the last reorg's blocks behind:
  // here the chain forked at 91 again and grew to C130. The list on reconnecting holds none of the
  // tab's heights, so the last reorg no longer counts, and page 3, A100 to A86 on the old chain, shows
  // the API's C100 to C91 and A90 to A86.
  page = openBlocksList();
  page.answer(nodeA);
  page.receive(reorgToB());
  page.receive({ blocks: chain('C', 123, 130) });
  assert(page.stateService.lastReorg === null, 'the last reorg should no longer count once the tab\'s blocks have moved past it');
  page.goTo(3);
  page.answer([...chain('A', 0, 90), ...chain('C', 91, 130)]);
  assert(page.requests[page.requests.length - 1].from === 100 && page.listed() === `${ids('C', 100, 91)} ${ids('A', 90, 86)}`, `page 3 should show the API's C100 to C91 and A90 to A86, not the old reorg's blocks: ${page.listed()}`);
  page.close();

  // After a reorg that went deeper than the tab could tell, the request for a page it may have reached
  // asks past the browser's copy, which can be from before it. Here page 2 reloads, the visitor goes to
  // page 1 and back, and the browser would answer page 2 with its copy from before the reorg.
  const nodeBOnly = chain('B', 0, 101);
  page = openBlocksList({ page: 2 });
  page.answer(nodeA);
  page.answer(nodeA);
  page.receive({ blocks: chain('B', 94, 101) });
  await tick();
  page.answer(nodeBOnly);
  page.goTo(1);
  page.answer(nodeBOnly);
  page.goTo(2);
  const backToPage2 = page.requests[page.requests.length - 1];
  backToPage2.answer(backToPage2.fresh ? nodeBOnly : nodeA);
  assert(backToPage2.from === 86 && page.listed() === ids('B', 86, 72), `page 2 should ask past the browser's copy after a reorg that may reach it, and show B86 to B72: ${JSON.stringify(backToPage2)}, ${page.listed()}`);
  page.close();

  // A list that holds none of the tab's heights, as after the tab missed more blocks than a list holds,
  // leaves a gap on the first page, which then asks for its blocks again
  page = openBlocksList();
  page.answer(nodeA);
  page.receive({ blocks: chain('A', 103, 110) });
  await tick();
  assert(page.requests.length === 2 && page.requests[1].fresh, `/blocks should ask for its page again when a height is missing: ${page.listed()}, ${JSON.stringify(page.requests)}`);
  page.answer(chain('A', 0, 110));
  assert(page.listed() === ids('A', 110, 96), `/blocks should show A110 to A96: ${page.listed()}`);
  page.close();
}

checkTip();
checkMempoolBlocks();
checkCache()
  .then(checkBlocksList)
  .then(() => console.log('qbit reorg smoke passed'))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
