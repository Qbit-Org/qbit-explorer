import { Component, OnInit, ChangeDetectionStrategy, Input, ChangeDetectorRef, Inject, LOCALE_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, defer, merge, Observable, timer, of, Subscription } from 'rxjs';
import { debounceTime, delayWhen, filter, map, retryWhen, scan, skip, switchMap, takeWhile, tap, throttleTime } from 'rxjs/operators';
import { BlockExtended } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { compareBlocks } from '@app/shared/block-chain.utils';

// What changes the blocks a list shows: a page the API answered, from the height `from` down (for
// the first page, from the tip), the state's blocks, and a reorg.
type BlocksUpdate = { page: number, from: number, blocks: BlockExtended[] }
  | { live: BlockExtended[] }
  | { reorg: { blocks: BlockExtended[], from: number } };

// How often the list asks again, 10 seconds apart and past caches, for an answer from the API that
// doesn't fit the chain the websocket sent, before it shows what fits of it. A network's other origin
// can lag. Retries after an error don't count, and ask at the same URL, as upstream.
const RETRIES_FOR_STALE_ANSWER = 2;

@Component({
  selector: 'app-blocks-list',
  templateUrl: './blocks-list.component.html',
  styleUrls: ['./blocks-list.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlocksList implements OnInit {
  @Input() widget: boolean = false;

  blocks$: Observable<BlockExtended[]> = undefined;

  isMempoolModule = false;
  indexingAvailable = false;
  auditAvailable = false;
  isLoading = true;
  fromBlockHeight = undefined;
  lastBlockHeightFetched = -1;
  paginationMaxSize: number;
  page = 1;
  // the page of the blocks shown, and the height its request asked from
  shownPage = 1;
  shownFrom: number = undefined;
  // whether the next request asks past the copies the browser or a CDN keep
  freshRequest = false;
  // Whether the page shows what fits of an answer that kept not fitting the websocket's chain. Until the
  // next reorg, or another page, new blocks then fill it without asking the API again.
  showsWhatFits = false;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  blocksCount: number;
  fromHeightSubject: BehaviorSubject<number> = new BehaviorSubject(this.fromBlockHeight);
  skeletonLines: number[] = [];
  blocksCountInitialized$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  blocksCountInitializedSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  dir: 'rtl' | 'ltr' = 'ltr';

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    this.isMempoolModule = this.stateService.env.BASE_MODULE === 'mempool';
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.indexingAvailable = (this.stateService.env.BASE_MODULE === 'mempool' &&
      this.stateService.env.MINING_DASHBOARD === true);
    this.auditAvailable = this.indexingAvailable && this.stateService.env.AUDIT;

    if (!this.widget) {
      this.websocketService.want(['blocks']);

      this.seoService.setTitle($localize`:@@8a7b4bd44c0ac71b2e72de0398b303257f7d2f54:Blocks`);
      this.ogService.setManualOgImage('recent-blocks.jpg');
      if( this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet' ) {
        this.seoService.setDescription($localize`:@@meta.description.liquid.blocks:See the most recent Liquid${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block size, and more.`);
      } else {
        this.seoService.setDescription($localize`:@@meta.description.bitcoin.blocks:See the most recent qbit${seoDescriptionNetwork(this.stateService.network)} blocks along with basic stats such as block height, block reward, block size, and more.`);
      }

      this.blocksCountInitializedSubscription = combineLatest([this.blocksCountInitialized$, this.route.params]).pipe(
        filter(([blocksCountInitialized, _]) => blocksCountInitialized),
        tap(([_, params]) => {
          this.page = +params['page'] || 1;
          this.page === 1 ? this.fromHeightSubject.next(undefined) : this.fromHeightSubject.next((this.blocksCount - 1) - (this.page - 1) * 15);
        })
      ).subscribe();

      const prevKey = this.dir === 'ltr' ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.dir === 'ltr' ? 'ArrowRight' : 'ArrowLeft';

      this.keyNavigationSubscription = this.stateService.keyNavigation$
      .pipe(
        filter((event) => event.key === prevKey || event.key === nextKey),
        tap((event) => {
          if (event.key === prevKey && this.page > 1) {
            this.page--;
            this.isLoading = true;
            this.cd.markForCheck();
          }
          if (event.key === nextKey && this.page * 15 < this.blocksCount) {
            this.page++;
            this.isLoading = true;
            this.cd.markForCheck();
          }
        }),
        throttleTime(1000, undefined, { leading: true, trailing: true }),
      ).subscribe(() => {
        this.pageChange(this.page);
      });
    }

    this.skeletonLines = this.widget === true ? [...Array(6).keys()] : [...Array(15).keys()];
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;

    // qbit: upstream combined the page and the state's blocks with combineLatest, which can't tell
    // which of them changed, and only added a new block above the highest it showed. A reorg left the
    // blocks it replaced on the list until the page reloaded.
    this.blocks$ = merge(
      this.fromHeightSubject.pipe(
        filter(fromBlockHeight => fromBlockHeight !== this.lastBlockHeightFetched),
        switchMap((fromBlockHeight) => {
          this.isLoading = true;
          this.lastBlockHeightFetched = fromBlockHeight;
          const page = this.page;
          // A reload, a retry, and a request for a page the last reorg may have reached ask past the
          // copies the browser or a CDN keep: one from before the reorg can't always be told apart.
          const reorg = this.stateService.lastReorg;
          const fresh = this.freshRequest || (reorg !== null && reorg.from <= (page === 1 ? Infinity : fromBlockHeight));
          this.freshRequest = false;
          // The answers that didn't fit the websocket's chain, a reload's too: only after one does the
          // retry ask past caches. A retry after an error asks at the same URL.
          let staleAnswers = 0;
          let askFresh = fresh;
          return defer(() => {
            const asked = this.apiService.getBlocks$(page === 1 ? undefined : fromBlockHeight, askFresh);
            askFresh = false;
            return asked;
          })
            .pipe(
              // the answer can be from before a reorg, a copy the browser kept, or from an origin that lags
              map((blocks) => {
                const shown = this.followWebsocket(blocks, page, fromBlockHeight, staleAnswers >= RETRIES_FOR_STALE_ANSWER);
                if (shown === null) {
                  staleAnswers++;
                  askFresh = true;
                  throw new Error(`the API's blocks from ${blocks[0]?.height} down don't fit the chain the websocket sent`);
                }
                return shown;
              }),
              tap(blocks => {
                if (this.blocksCount === undefined) {
                  this.blocksCount = blocks[0].height + 1;
                  this.blocksCountInitialized$.next(true);
                  this.blocksCountInitialized$.complete();
                }
                this.isLoading = false;
              }),
              // the server renders once: retrying would keep its render from finishing
              retryWhen(errors => errors.pipe(takeWhile(() => this.stateService.isBrowser), delayWhen(() => timer(10000)))),
              map((blocks): BlocksUpdate => ({ page, from: fromBlockHeight, blocks })),
            );
        })
      ),
      this.stateService.blocks$.pipe(map((blocks): BlocksUpdate => ({ live: blocks }))),
      this.stateService.reorg$.pipe(map((reorg): BlocksUpdate => ({ reorg }))),
    )
      .pipe(
        // null until the first page comes, so that the template shows its skeleton until then, as upstream
        scan((acc: BlockExtended[] | null, update: BlocksUpdate) => this.applyUpdate(acc, update), null),
        filter((blocks) => blocks !== null),
        switchMap((blocks) => {
          if (this.isMempoolModule && this.auditAvailable) {
            blocks.forEach(block => {
              block.extras.feeDelta = block.extras.expectedFees ? (block.extras.totalFees - block.extras.expectedFees) / block.extras.expectedFees : 0;
            });
          }
          return of(blocks);
        })
      );
  }

  private applyUpdate(acc: BlockExtended[] | null, update: BlocksUpdate): BlockExtended[] | null {
    if ('page' in update) {
      this.shownPage = update.page;
      this.shownFrom = update.from;
      return update.blocks;
    }
    if (acc === null) {
      // no page yet: the API's answer follows what came before it (followWebsocket)
      return null;
    }
    if ('live' in update) {
      // as upstream, only the first page takes new blocks
      if (this.shownPage !== 1) {
        return acc;
      }
      const blocks = this.firstPage(this.followChain(acc, update.live, this.stateService.lastReorg?.from ?? 0), !this.showsWhatFits);
      this.blocksCount = Math.max(this.blocksCount, blocks[0].height + 1);
      return blocks;
    }
    const tip = Math.max(...update.reorg.blocks.map((block) => block.height));
    // a reorg can bring the API's answers back onto the websocket's chain
    this.showsWhatFits = false;
    // the page count follows the new chain, longer or shorter, whatever page is shown
    this.blocksCount = tip + 1;
    if (this.shownPage === 1) {
      return this.firstPage(this.followChain(acc, update.reorg.blocks, update.reorg.from, tip, true), true);
    }
    // An older page shows the heights from shownFrom down. It stays as it is, unless the reorg reached them.
    if (update.reorg.from > this.shownFrom) {
      return acc;
    }
    const blocks = this.withPoolLogos(this.olderPage(this.followChain(acc, update.reorg.blocks, update.reorg.from, tip, true), this.shownFrom));
    if (this.shownFrom > tip) {
      this.showPageOfNewChain();
    } else if (this.isShort(blocks, this.shownPage, this.shownFrom, tip)) {
      this.reload();
    }
    return blocks;
  }

  // the most blocks the list shows
  get pageSize(): number {
    return this.widget ? 6 : 15;
  }

  // The newest blocks, as many as the first page shows. With `reload`, the page asks the API for them
  // again if there are too few, as after a reorg that went deeper than the blocks it sent, or if a height
  // is missing, as after the tab missed more blocks than the websocket's list holds.
  private firstPage(blocks: BlockExtended[], reload = false): BlockExtended[] {
    const shown = this.withPoolLogos(blocks.slice(0, this.pageSize));
    const gap = shown.some((block, i) => block.height !== shown[0].height - i);
    if (reload && (this.isShort(shown, 1) || gap)) {
      this.reload();
    }
    return shown;
  }

  // the blocks of an older page, which shows the heights from `from` down
  private olderPage(blocks: BlockExtended[], from: number): BlockExtended[] {
    return blocks.filter((block) => block.height <= from && block.height > from - 15);
  }

  // Whether a page lacks blocks the chain has for it: the first page, if it shows fewer than it can and
  // not down to the genesis block; an older page, if it lacks one of its heights up to `tip`.
  private isShort(blocks: BlockExtended[], page: number, from?: number, tip?: number): boolean {
    if (page === 1) {
      return blocks.length < this.pageSize && blocks[blocks.length - 1]?.height !== 0;
    }
    return blocks.length < Math.min(from, tip) - Math.max(from - 14, 0) + 1;
  }

  // An answer from the API, on the chain the websocket sent: the state's blocks and the last reorg's win
  // at their heights. An answer that holds a block the last reorg replaced or removed is from before it,
  // and its blocks above the websocket's tip come from the websocket only. Any other answer keeps them:
  // they are newer than the websocket's, as when its socket has dropped without the page noticing yet.
  // An answer that holds blocks that don't fit that chain, and leaves the page short without them, is
  // from before a reorg that went deeper than the blocks the websocket sent, or from an origin on
  // another chain. Then it returns null, so that the answer is asked for again, up to
  // RETRIES_FOR_STALE_ANSWER times; on the `last` answer, the page shows the blocks that fit.
  private followWebsocket(blocks: BlockExtended[], page: number, from: number, last: boolean): BlockExtended[] | null {
    const reorg = this.stateService.lastReorg;
    const removed = new Set(reorg?.removed ?? []);
    const tip = blocks.some((block) => removed.has(block.id)) ? this.stateService.latestBlockHeight : Infinity;
    const followed = this.followChain(blocks, [...(reorg?.blocks ?? []), ...this.stateService.blocksSubject$.getValue()], reorg?.from ?? 0, tip);
    const shown = page === 1 ? this.firstPage(followed) : this.withPoolLogos(this.olderPage(followed, from));
    const heights = new Set(shown.map((block) => block.height));
    const answered = page === 1 ? blocks : this.olderPage(blocks, from);
    // Blocks above the tip don't fit either, but an answer that also holds blocks at or below it is
    // ahead of the websocket, which then sends them. One with none at or below it is from before a reorg
    // to a shorter chain.
    const misfits = answered.filter((block) => block.height <= tip && !heights.has(block.height));
    const stale = misfits.length > 0 || (answered.length > 0 && answered.every((block) => block.height > tip));
    const showsWhatFits = stale && this.isShort(shown, page, from, tip);
    if (showsWhatFits && !last) {
      return null;
    }
    this.showsWhatFits = showsWhatFits;
    return shown;
  }

  // The blocks of `shown`, newest first, on the chain of `chain`'s blocks, which win at their heights
  // (the later of two at the same height). `shown` keeps a block of its own up to `tip` if it is on that
  // chain: below the lowest height at which the two hold different blocks, and at or below a height at
  // which they hold the same block (a block's ancestors are on its chain), or below `unchangedBelow`,
  // the lowest height the last reorg may have changed. A list that differs from `chain` below that is
  // older than that reorg, which then vouches for none of its blocks. A list that differs from `chain`
  // nowhere keeps all its blocks, unless `chain` is a reorg's, which may have replaced blocks from
  // `unchangedBelow` up that it doesn't hold.
  private followChain(shown: BlockExtended[], chain: BlockExtended[], unchangedBelow: number, tip = Infinity, reorg = false): BlockExtended[] {
    const onChain = new Map<number, BlockExtended>();
    for (const block of chain) {
      if (block.height <= tip) {
        onChain.set(block.height, block);
      }
    }
    const { replaced, same } = compareBlocks(shown, (height) => onChain.get(height)?.id);
    const unchanged = replaced < unchangedBelow ? 0 : unchangedBelow;
    for (const block of shown) {
      const onSameChain = (replaced === Infinity && !reorg) || block.height <= same || block.height < unchanged;
      if (block.height <= tip && block.height < replaced && onSameChain && !onChain.has(block.height)) {
        onChain.set(block.height, block);
      }
    }
    return [...onChain.values()].sort((a, b) => b.height - a.height);
  }

  // Asks the API again, past the copies the browser or a CDN keep, for the page shown, or for its blocks
  // from `from` down, once the list has updated. A request in flight for the same blocks is left to
  // finish: its answer follows the chain the websocket sent by then.
  private reload(from = this.fromHeightSubject.getValue()): void {
    queueMicrotask(() => {
      if (this.page !== this.shownPage || (this.isLoading && from === this.fromHeightSubject.getValue())) {
        return;
      }
      this.lastBlockHeightFetched = NaN;
      this.freshRequest = true;
      this.fromHeightSubject.next(from);
    });
  }

  // After a reorg to a shorter chain took the top heights of the older page shown, the page shows its
  // page of the new chain, as a reload would, or the new chain's last page if it has no such page
  private showPageOfNewChain(): void {
    const from = (this.blocksCount - 1) - (this.page - 1) * 15;
    if (from >= 0) {
      this.reload(from);
    } else {
      queueMicrotask(() => {
        if (this.page === this.shownPage) {
          this.pageChange(Math.ceil(this.blocksCount / 15));
        }
      });
    }
  }

  private withPoolLogos(blocks: BlockExtended[]): BlockExtended[] {
    if (this.isMempoolModule) {
      for (const block of blocks) {
        // @ts-ignore: Need to add an extra field for the template
        block.extras.pool.logo = `/resources/mining-pools/` + block.extras.pool.slug + '.svg';
      }
    }
    return blocks;
  }

  pageChange(page: number): void {
    this.router.navigate([this.relativeUrlPipe.transform('/blocks/'), page]);
  }

  trackByBlock(index: number, block: BlockExtended): number {
    return block.height;
  }

  isEllipsisActive(e): boolean {
    return (e.offsetWidth < e.scrollWidth);
  }

  ngOnDestroy(): void {
    this.blocksCountInitializedSubscription?.unsubscribe();
    this.keyNavigationSubscription?.unsubscribe();
  }
}
