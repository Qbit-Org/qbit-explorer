import { Inject, Injectable, PLATFORM_ID, LOCALE_ID } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject, fromEvent, Observable } from 'rxjs';
import { Transaction } from '@interfaces/electrs.interface';
import { HealthCheckHost, IBackendInfo, MempoolBlock, MempoolBlockUpdate, MempoolInfo, Recommendedfees, ReplacedTransaction, ReplacementInfo, StratumJob, isMempoolState } from '@interfaces/websocket.interface';
import { AccelerationPosition, BlockExtended, CpfpInfo, DifficultyAdjustment, MempoolPosition, OptimizedMempoolStats, RbfTree, TransactionStripped } from '@interfaces/node-api.interface';
import { Router, NavigationStart } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter, map, scan, share, shareReplay } from 'rxjs/operators';
import { StorageService } from '@app/services/storage.service';
import { hasTouchScreen } from '@app/shared/pipes/bytes-pipe/utils';
import { ActiveFilter } from '@app/shared/filters.utils';
import { weightToFractionalVsize } from '@app/shared/weight-units';

// A reorg: its blocks, newest first; the lowest height whose block it may have replaced or removed,
// below which the blocks the page had are on the new chain; and the ids of the blocks the page had that
// it replaced or removed
export interface Reorg {
  blocks: BlockExtended[];
  from: number;
  removed: string[];
}

export interface MarkBlockState {
  blockHeight?: number;
  txid?: string;
  mempoolBlockIndex?: number;
  txFeePerVSize?: number;
  mempoolPosition?: MempoolPosition;
  accelerationPositions?: AccelerationPosition[];
}

export interface ILoadingIndicators { [name: string]: number; }

export interface Customization {
  theme: string;
  enterprise?: string;
  branding: {
    name: string;
    site_id?: number;
    title: string;
    img?: string;
    header_img?: string;
    footer_img?: string;
    rounded_corner: boolean;
    cobranded?: boolean;
  },
  dashboard: {
    widgets: {
      component: string;
      mobileOrder?: number;
      props: { [key: string]: any };
    }[];
  };
}

export type SignaturesMode = 'all' | 'interesting' | 'none' | null;

export interface Env {
  MAINNET_ENABLED: boolean;
  TESTNET_ENABLED: boolean;
  TESTNET4_ENABLED: boolean;
  SIGNET_ENABLED: boolean;
  REGTEST_ENABLED: boolean;
  QBIT_SITE_CHROME: boolean;
  MAINNET_EXPLORER_URL: string;
  TESTNET4_EXPLORER_URL: string;
  ITEMS_PER_PAGE: number;
  KEEP_BLOCKS_AMOUNT: number;
  OFFICIAL_MEMPOOL_SPACE: boolean;
  BASE_MODULE: string;
  ROOT_NETWORK: string;
  NGINX_PROTOCOL?: string;
  NGINX_HOSTNAME?: string;
  NGINX_PORT?: string;
  BLOCK_WEIGHT_UNITS: number;
  BLOCK_TARGET_SPACING_SECONDS: number;
  MEMPOOL_BLOCKS_AMOUNT: number;
  GIT_COMMIT_HASH: string;
  PACKAGE_JSON_VERSION: string;
  MEMPOOL_WEBSITE_URL: string;
  MINING_DASHBOARD: boolean;
  AUDIT: boolean;
  MAINNET_BLOCK_AUDIT_START_HEIGHT: number;
  TESTNET_BLOCK_AUDIT_START_HEIGHT: number;
  TESTNET4_BLOCK_AUDIT_START_HEIGHT: number;
  SIGNET_BLOCK_AUDIT_START_HEIGHT: number;
  REGTEST_BLOCK_AUDIT_START_HEIGHT: number;
  MAINNET_TX_FIRST_SEEN_START_HEIGHT: number;
  TESTNET_TX_FIRST_SEEN_START_HEIGHT: number;
  TESTNET4_TX_FIRST_SEEN_START_HEIGHT: number;
  SIGNET_TX_FIRST_SEEN_START_HEIGHT: number;
  REGTEST_TX_FIRST_SEEN_START_HEIGHT: number;
  HISTORICAL_PRICE: boolean;
  ACCELERATOR: boolean;
  ACCELERATOR_BUTTON: boolean;
  PUBLIC_ACCELERATIONS: boolean;
  ADDITIONAL_CURRENCIES: boolean;
  GIT_COMMIT_HASH_MEMPOOL_SPACE?: string;
  PACKAGE_JSON_VERSION_MEMPOOL_SPACE?: string;
  STRATUM_ENABLED: boolean;
  SERVICES_API?: string;
  customize?: Customization;
  PROD_DOMAINS: string[];
}

const defaultEnv: Env = {
  'MAINNET_ENABLED': true,
  'TESTNET_ENABLED': false,
  'TESTNET4_ENABLED': false,
  'SIGNET_ENABLED': false,
  'REGTEST_ENABLED': false,
  'QBIT_SITE_CHROME': true,
  'MAINNET_EXPLORER_URL': '',
  'TESTNET4_EXPLORER_URL': '',
  'BASE_MODULE': 'mempool',
  'ROOT_NETWORK': '',
  'ITEMS_PER_PAGE': 10,
  'KEEP_BLOCKS_AMOUNT': 8,
  'OFFICIAL_MEMPOOL_SPACE': false,
  'NGINX_PROTOCOL': 'http',
  'NGINX_HOSTNAME': '127.0.0.1',
  'NGINX_PORT': '80',
  'BLOCK_WEIGHT_UNITS': 2000000,
  'BLOCK_TARGET_SPACING_SECONDS': 60,
  'MEMPOOL_BLOCKS_AMOUNT': 8,
  'GIT_COMMIT_HASH': '',
  'PACKAGE_JSON_VERSION': '',
  'MEMPOOL_WEBSITE_URL': '',
  'MINING_DASHBOARD': true,
  'AUDIT': false,
  'MAINNET_BLOCK_AUDIT_START_HEIGHT': 0,
  'TESTNET_BLOCK_AUDIT_START_HEIGHT': 0,
  'TESTNET4_BLOCK_AUDIT_START_HEIGHT': 0,
  'SIGNET_BLOCK_AUDIT_START_HEIGHT': 0,
  'REGTEST_BLOCK_AUDIT_START_HEIGHT': 0,
  'MAINNET_TX_FIRST_SEEN_START_HEIGHT': 0,
  'TESTNET_TX_FIRST_SEEN_START_HEIGHT': 0,
  'TESTNET4_TX_FIRST_SEEN_START_HEIGHT': 0,
  'SIGNET_TX_FIRST_SEEN_START_HEIGHT': 0,
  'REGTEST_TX_FIRST_SEEN_START_HEIGHT': 0,
  'HISTORICAL_PRICE': false,
  'ACCELERATOR': false,
  'ACCELERATOR_BUTTON': false,
  'PUBLIC_ACCELERATIONS': false,
  'ADDITIONAL_CURRENCIES': false,
  'STRATUM_ENABLED': false,
  'SERVICES_API': '',
  'PROD_DOMAINS': [],
};

@Injectable({
  providedIn: 'root'
})
export class StateService {
  referrer: string = '';
  isBrowser: boolean = isPlatformBrowser(this.platformId);
  isMempoolSpaceBuild = window['isMempoolSpaceBuild'] ?? false;
  isProdDomain: boolean;
  backend: 'esplora' | 'electrum' | 'none' = 'esplora';
  network = '';
  blockVSize: number;
  env: Env;
  latestBlockHeight = -1;
  blocks: BlockExtended[] = [];
  mempoolSequence: number;
  mempoolBlockState: { block: number, transactions: { [txid: string]: TransactionStripped} };

  backend$ = new BehaviorSubject<'esplora' | 'electrum' | 'none'>('esplora');
  networkChanged$ = new ReplaySubject<string>(1);
  signaturesMode$: BehaviorSubject<SignaturesMode>;
  blocksSubject$ = new BehaviorSubject<BlockExtended[]>([]);
  blocks$: Observable<BlockExtended[]>;
  // A reorg, just before its blocks go out on blocks$
  reorg$ = new Subject<Reorg>();
  // The last reorg on reorg$, for the components that start after it, while the state's blocks are on
  // its chain (keepLastReorg)
  lastReorg: Reorg = null;
  transactions$ = new BehaviorSubject<TransactionStripped[]>(null);
  conversions$ = new ReplaySubject<Record<string, number>>(1);
  bsqPrice$ = new ReplaySubject<number>(1);
  mempoolInfo$ = new ReplaySubject<MempoolInfo>(1);
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  mempoolBlockUpdate$ = new Subject<MempoolBlockUpdate>();
  liveMempoolBlockTransactions$: Observable<{ block: number, transactions: { [txid: string]: TransactionStripped} }>;
  stratumJobUpdate$ = new Subject<{ state: Record<string, StratumJob> } | { job: StratumJob }>();
  stratumJobs$ = new BehaviorSubject<Record<string, StratumJob>>({});
  txConfirmed$ = new Subject<[string, BlockExtended]>();
  txReplaced$ = new Subject<ReplacedTransaction>();
  txRbfInfo$ = new Subject<RbfTree>();
  rbfLatest$ = new Subject<RbfTree[]>();
  rbfLatestSummary$ = new Subject<ReplacementInfo[]>();
  utxoSpent$ = new Subject<object>();
  difficultyAdjustment$ = new ReplaySubject<DifficultyAdjustment>(1);
  mempoolTransactions$ = new Subject<Transaction>();
  mempoolTxPosition$ = new BehaviorSubject<{ txid: string, position: MempoolPosition, cpfp: CpfpInfo | null, accelerationPositions?: AccelerationPosition[] }>(null);
  mempoolRemovedTransactions$ = new Subject<Transaction>();
  multiAddressTransactions$ = new Subject<{ [address: string]: { mempool: Transaction[], confirmed: Transaction[], removed: Transaction[] }}>();
  blockTransactions$ = new Subject<Transaction>();
  isLoadingWebSocket$ = new ReplaySubject<boolean>(1);
  isLoadingMempool$ = new BehaviorSubject<boolean>(true);
  vbytesPerSecond$ = new ReplaySubject<number>(1);
  previousRetarget$ = new ReplaySubject<number>(1);
  backendInfo$ = new ReplaySubject<IBackendInfo>(1);
  servicesBackendInfo$ = new ReplaySubject<IBackendInfo>(1);
  loadingIndicators$ = new ReplaySubject<ILoadingIndicators>(1);
  recommendedFees$ = new ReplaySubject<Recommendedfees>(1);
  chainTip$ = new ReplaySubject<number>(-1);
  serverHealth$ = new Subject<HealthCheckHost[]>();

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewAmountMode$: BehaviorSubject<'qbt' | 'sats' | 'fiat'>;
  timezone$: BehaviorSubject<string>;
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);
  isTabHidden$: Observable<boolean>;

  markBlock$ = new BehaviorSubject<MarkBlockState>({});
  keyNavigation$ = new Subject<KeyboardEvent>();
  searchText$ = new BehaviorSubject<string>('');

  blockScrolling$: Subject<boolean> = new Subject<boolean>();
  resetScroll$: Subject<boolean> = new Subject<boolean>();
  timeLtr: BehaviorSubject<boolean>;
  hideFlow: BehaviorSubject<boolean>;
  hideAudit: BehaviorSubject<boolean>;
  fiatCurrency$: BehaviorSubject<string>;
  rateUnits$: BehaviorSubject<string>;
  blockDisplayMode$: BehaviorSubject<string>;

  searchFocus$: Subject<boolean> = new Subject<boolean>();
  menuOpen$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  activeGoggles$: BehaviorSubject<ActiveFilter> = new BehaviorSubject({ mode: 'and', filters: [], gradient: 'age' });

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    @Inject(LOCALE_ID) private locale: string,
    private router: Router,
    private storageService: StorageService,
  ) {
    this.referrer = window.document.referrer;

    const browserWindow = window || {};
    // @ts-ignore
    const browserWindowEnv = browserWindow.__env || {};
    if (typeof(browserWindowEnv.PROD_DOMAINS) === 'string') {
      browserWindowEnv.PROD_DOMAINS = browserWindowEnv.PROD_DOMAINS
        ? browserWindowEnv.PROD_DOMAINS.split(',').filter(Boolean)
        : [];
    }

    this.env = Object.assign(defaultEnv, browserWindowEnv);

    if (defaultEnv.BASE_MODULE !== 'mempool') {
      this.env.MINING_DASHBOARD = false;
    }

    if (this.isBrowser) {
      this.setNetworkBasedonUrl(window.location.pathname);
      this.isTabHidden$ = fromEvent(document, 'visibilitychange').pipe(map(() => this.isHidden()), shareReplay());
    } else {
      this.setNetworkBasedonUrl('/');
      this.isTabHidden$ = new BehaviorSubject(false);
    }

    this.isProdDomain = this.testIsProdDomain(this.env.PROD_DOMAINS);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.setNetworkBasedonUrl(event.url);
      }
    });

    this.liveMempoolBlockTransactions$ = this.mempoolBlockUpdate$.pipe(scan((acc: { block: number, transactions: { [txid: string]: TransactionStripped } }, change: MempoolBlockUpdate): { block: number, transactions: { [txid: string]: TransactionStripped } } => {
      if (isMempoolState(change)) {
        const txMap = {};
        change.transactions.forEach(tx => {
          txMap[tx.txid] = tx;
        });
        this.mempoolBlockState = {
          block: change.block,
          transactions: txMap
        };
        return this.mempoolBlockState;
      } else {
        change.added.forEach(tx => {
          acc.transactions[tx.txid] = tx;
        });
        change.removed.forEach(txid => {
          delete acc.transactions[txid];
        });
        change.changed.forEach(tx => {
          if (acc.transactions[tx.txid]) {
            acc.transactions[tx.txid].rate = tx.rate;
            acc.transactions[tx.txid].acc = tx.acc;
          }
        });
        this.mempoolBlockState = {
          block: change.block,
          transactions: acc.transactions
        };
        return this.mempoolBlockState;
      }
    }, {}),
    share()
    );
    this.liveMempoolBlockTransactions$.subscribe();

    this.stratumJobUpdate$.pipe(
      scan((acc: Record<string, StratumJob>, update: { state: Record<string, StratumJob> } | { job: StratumJob }) => {
        if ('state' in update) {
          // Replace the entire state
          return update.state;
        } else {
          // Update or create a single job entry
          return {
            ...acc,
            [update.job.pool]: update.job
          };
        }
      }, {}),
      shareReplay(1)
    ).subscribe(val => {
      this.stratumJobs$.next(val);
    });

    this.networkChanged$.subscribe((network) => {
      this.transactions$ = new BehaviorSubject<TransactionStripped[]>(null);
      this.stratumJobs$ = new BehaviorSubject<Record<string, StratumJob>>({});
      this.stratumJobUpdate$.next({ state: {} });
      this.blocksSubject$.next([]);
      this.lastReorg = null;
    });

    this.signaturesMode$ = new BehaviorSubject<SignaturesMode>(this.storageService.getValue('signatures-mode') as SignaturesMode || null);

    this.blockVSize = weightToFractionalVsize(this.env.BLOCK_WEIGHT_UNITS);

    this.blocks$ = this.blocksSubject$.pipe(filter(blocks => blocks != null && blocks.length > 0));

    const savedTimePreference = this.storageService.getValue('time-preference-ltr');
    const rtlLanguage = (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he'));
    // default time direction is right-to-left, unless locale is a RTL language
    this.timeLtr = new BehaviorSubject<boolean>(savedTimePreference === 'true' || (savedTimePreference == null && rtlLanguage));
    this.timeLtr.subscribe((ltr) => {
      this.storageService.setValue('time-preference-ltr', ltr ? 'true' : 'false');
    });

    const savedFlowPreference = this.storageService.getValue('flow-preference');
    this.hideFlow = new BehaviorSubject<boolean>(savedFlowPreference === 'hide');
    this.hideFlow.subscribe((hide) => {
      if (hide) {
        this.storageService.setValue('flow-preference', hide ? 'hide' : 'show');
      } else {
        this.storageService.removeItem('flow-preference');
      }
    });

    const savedAuditPreference = this.storageService.getValue('audit-preference');
    this.hideAudit = new BehaviorSubject<boolean>(savedAuditPreference === 'hide');
    this.hideAudit.subscribe((hide) => {
      this.storageService.setValue('audit-preference', hide ? 'hide' : 'show');
    });

    const fiatPreference = this.storageService.getValue('fiat-preference');
    this.fiatCurrency$ = new BehaviorSubject<string>(fiatPreference || 'USD');

    const rateUnitPreference = this.storageService.getValue('rate-unit-preference');
    this.rateUnits$ = new BehaviorSubject<string>(rateUnitPreference || 'vb');

    const blockDisplayModePreference = this.storageService.getValue('block-display-mode-preference');
    this.blockDisplayMode$ = new BehaviorSubject<string>(blockDisplayModePreference || 'fees');

    const viewAmountModePreference = this.storageService.getValue('view-amount-mode') as 'btc' | 'qbt' | 'sats' | 'fiat';
    const migratedViewAmountMode = viewAmountModePreference === 'sats' ? 'sats' : 'qbt';
    this.viewAmountMode$ = new BehaviorSubject<'qbt' | 'sats' | 'fiat'>(migratedViewAmountMode);

    const timezonePreference = this.storageService.getValue('timezone-preference');
    this.timezone$ = new BehaviorSubject<string>(timezonePreference || 'local');

    this.backend$.subscribe(backend => {
      this.backend = backend;
    });
  }

  setNetworkBasedonUrl(url: string) {
    if (this.env.BASE_MODULE !== 'mempool') {
      return;
    }
    // horrible network regex breakdown:
    // /^\/                                         starts with a forward slash...
    // (?:[a-z]{2}(?:-[A-Z]{2})?\/)?                optional locale prefix (non-capturing)
    // (?:preview\/)?                               optional "preview" prefix (non-capturing)
    // (testnet|signet)/                            network string (captured as networkMatches[1])
    // ($|\/)                                       network string must end or end with a slash
    let networkMatches: object = url.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:preview\/)?(testnet4?|signet|regtest)($|\/)/);

    if (!networkMatches && this.env.ROOT_NETWORK) {
      networkMatches = { 1: this.env.ROOT_NETWORK };
    }

    switch (networkMatches && networkMatches[1]) {
      case 'signet':
        if (this.network !== 'signet') {
          this.network = 'signet';
          this.networkChanged$.next('signet');
        }
        return;
      case 'testnet':
        if (this.network !== 'testnet') {
          this.network = 'testnet';
          this.networkChanged$.next('testnet');
        }
        return;
      case 'testnet4':
        if (this.network !== 'testnet4') {
          this.network = 'testnet4';
          this.networkChanged$.next('testnet4');
        }
        return;
      case 'regtest':
        if (this.network !== 'regtest') {
          this.network = 'regtest';
          this.networkChanged$.next('regtest');
        }
        return;
      default:
        if (this.env.BASE_MODULE !== 'mempool') {
          if (this.network !== this.env.BASE_MODULE) {
            this.network = this.env.BASE_MODULE;
            this.networkChanged$.next(this.env.BASE_MODULE);
          }
        } else if (this.network !== '') {
          this.network = '';
          this.networkChanged$.next('');
        }
    }
  }

  getHiddenProp(){
    const prefixes = ['webkit', 'moz', 'ms', 'o'];
    if ('hidden' in document) { return 'hidden'; }
    for (const prefix of prefixes) {
      if ((prefix + 'Hidden') in document) {
        return prefix + 'Hidden';
      }
    }
    return null;
  }

  isHidden() {
    const prop = this.getHiddenProp();
    if (!prop) { return false; }
    return document[prop];
  }

  setBlockScrollingInProgress(value: boolean) {
    this.blockScrolling$.next(value);
  }

  isLiquid() {
    return false;
  }

  isMainnet(): boolean {
    return this.env.ROOT_NETWORK === '' && this.network === '';
  }

  isAnyTestnet(): boolean {
    return ['testnet', 'testnet4', 'signet', 'regtest'].includes(this.network);
  }

  resetChainTip() {
    this.latestBlockHeight = -1;
    this.chainTip$.next(-1);
  }

  updateChainTip(height) {
    if (height > this.latestBlockHeight) {
      this.latestBlockHeight = height;
      this.chainTip$.next(height);
    }
  }

  // The list's highest block raises the tip. Only a reorg's list can lower it,
  // as to a shorter chain: any other list below the tip, as from a backend that
  // lags the one the page used before, leaves it until that backend passes it.
  // The tip changes first, so the list's subscribers see the tip that goes with
  // it, as they do for a new block. A reorg's list goes out on reorg$ before
  // blocks$, with `reorg`'s lowest height whose block it may have replaced and
  // the blocks it replaced or removed, so that a list that follows both sees
  // the reorg first.
  resetBlocks(blocks: BlockExtended[], reorg?: { from: number, removed: string[] }): void {
    const tip = blocks.reduce((max, block) => Math.max(max, block.height), -1);
    if (reorg && tip < this.latestBlockHeight) {
      this.latestBlockHeight = tip;
      this.chainTip$.next(tip);
    } else {
      this.updateChainTip(tip);
    }
    this.blocks = blocks.reverse();
    if (reorg) {
      // a copy: addBlock() changes this.blocks in place
      this.lastReorg = { blocks: [...blocks], ...reorg };
      this.reorg$.next(this.lastReorg);
    } else {
      this.keepLastReorg();
    }
    this.blocksSubject$.next(blocks);
  }

  addBlock(block: BlockExtended): void {
    this.blocks.unshift(block);
    this.blocks = this.blocks.slice(0, this.env.KEEP_BLOCKS_AMOUNT);
    this.keepLastReorg();
    this.blocksSubject$.next(this.blocks);
  }

  // The last reorg counts while the state's blocks are on its chain: they hold one of its blocks, and
  // none in place of one, or start right above them. Otherwise they moved on through a later reorg the
  // page didn't take as one, as after going offline, and its blocks no longer count.
  private keepLastReorg(): void {
    if (!this.lastReorg || !this.blocks.length) {
      return;
    }
    const ids = new Map(this.lastReorg.blocks.map((block) => [block.height, block.id]));
    const holds = this.blocks.some((block) => ids.get(block.height) === block.id);
    const replaces = this.blocks.some((block) => ids.has(block.height) && ids.get(block.height) !== block.id);
    const lowest = this.blocks.reduce((low, block) => block.height < low.height ? block : low);
    const parent = ids.get(lowest.height - 1);
    const above = parent !== undefined && parent === lowest.previousblockhash;
    if (replaces || !(holds || above)) {
      this.lastReorg = null;
    }
  }

  focusSearchInputDesktop() {
    if (!hasTouchScreen()) {
      this.searchFocus$.next(true);
    }
  }

  private testIsProdDomain(prodDomains: string[]): boolean {
    const hostname = document.location.hostname;
    return prodDomains.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );
  }
}
