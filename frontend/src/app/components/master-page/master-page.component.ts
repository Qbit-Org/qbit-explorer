import { Component, OnInit, OnDestroy, Input, HostListener, NgZone, ElementRef } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';
import { Observable, merge, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LanguageService } from '@app/services/language.service';
import { NavigationService } from '@app/services/navigation.service';
import { QbitDesignService, QbitHeaderNav, QBIT_NAV_ICON_PATHS, QBIT_ORIGIN } from '@app/services/qbit-design.service';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss'],
  standalone: false,
})
export class MasterPageComponent implements OnInit, OnDestroy {
  @Input() headerVisible = true;
  @Input() footerVisibleOverride: boolean | null = null;

  env: Env;
  network$: Observable<string>;
  connectionState$: Observable<number>;
  qbitNav$: Observable<QbitHeaderNav>;
  qbitOrigin = QBIT_ORIGIN;
  menuOpen = false;
  /**
   * Index in `items` of the open qbit.org dropdown, if any. Keyed by index,
   * not label: contract labels may repeat or hold spaces and quotes.
   */
  openNavGroup: number | null = null;
  readonly navIconPaths = QBIT_NAV_ICON_PATHS;
  urlLanguage: string;
  networkPaths: { [network: string]: string };
  networkPaths$: Observable<Record<string, string>>;
  footerVisible = true;
  isDropdownVisible: boolean;

  constructor(
    public stateService: StateService,
    private languageService: LanguageService,
    private navigationService: NavigationService,
    private qbitDesignService: QbitDesignService,
    private ngZone: NgZone,
    private elementRef: ElementRef<HTMLElement>,
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.connectionState$ = this.stateService.connectionState$;
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    // a new contract re-renders the header, and the open dropdown's index
    // would then name whatever item sits there now
    this.qbitNav$ = this.qbitDesignService.headerNav$.pipe(
      tap(() => { this.openNavGroup = null; }),
    );
    this.urlLanguage = this.languageService.getLanguageForUrl();
    this.navigationService.subnetPaths.subscribe((paths) => {
      this.networkPaths = paths;
      if (this.footerVisibleOverride === null) {
        if (paths.mainnet.indexOf('docs') > -1) {
          this.footerVisible = false;
        } else {
          this.footerVisible = true;
        }
      } else {
        this.footerVisible = this.footerVisibleOverride;
      }
    });

    this.setDropdownVisibility();
  }

  setDropdownVisibility(): void {
    if (this.env.customize?.enterprise) {
      this.isDropdownVisible = false;
      return;
    }
    // MAINNET_ENABLED and TESTNET4_ENABLED describe networks served by this
    // instance. A configured explorer URL still contributes a selector entry,
    // but that entry is rendered as a full-document navigation in the template.
    const networks = [
      this.env.MAINNET_ENABLED || !!this.env.MAINNET_EXPLORER_URL,
      this.env.TESTNET4_ENABLED || !!this.env.TESTNET4_EXPLORER_URL,
      this.env.TESTNET_ENABLED,
      this.env.SIGNET_ENABLED,
      this.env.REGTEST_ENABLED,
    ];
    const enabledNetworksCount = networks.filter((networkEnabled) => networkEnabled).length;
    this.isDropdownVisible = enabledNetworksCount > 1;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      // narrow non-touch layouts hide the bar search, so route the desktop
      // autofocus intent to the panel's search once it has rendered
      setTimeout(() => this.stateService.focusSearchInputDesktop());
      this.armMenuScrollDismissal();
    } else {
      this.disarmMenuScrollDismissal();
    }
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.disarmMenuScrollDismissal();
  }

  explorerNavClick(): void {
    this.stateService.resetScroll$.next(true);
    this.openNavGroup = null;
    this.closeMenu();
  }

  // qbit.org's header dropdowns. A mouse hovering opens a group and leaving
  // closes it; a click or tap always toggles what is shown, so clicking a
  // hover-opened list closes it; Escape, an outside press or focus moving to
  // another element also close it.
  toggleNavGroup(index: number): void {
    this.openNavGroup = this.openNavGroup === index ? null : index;
  }

  closeNavGroup(index?: number): void {
    if (index === undefined || this.openNavGroup === index) {
      this.openNavGroup = null;
    }
  }

  // mouse only: touch emulates enter/leave around a tap, which would open the
  // group just for the tap's own click to toggle it shut again
  onNavGroupPointerEnter(event: PointerEvent, index: number): void {
    if (event.pointerType === 'mouse') {
      this.openNavGroup = index;
    }
  }

  onNavGroupPointerLeave(event: PointerEvent, index: number): void {
    if (event.pointerType === 'mouse') {
      this.closeNavGroup(index);
    }
  }

  // closes when focus moves to an element outside the group. A null
  // relatedTarget (a press on something unfocusable, e.g. a link in Safari)
  // is left to the pointerdown handler, so a press inside still lands
  onNavGroupFocusOut(event: FocusEvent, index: number): void {
    const group = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (next && !group?.contains(next)) {
      this.closeNavGroup(index);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.openNavGroup === null) {
      return;
    }
    const index = this.openNavGroup;
    this.openNavGroup = null;
    // focus would otherwise stay on a link inside the now-hidden list
    const trigger = this.elementRef.nativeElement.querySelector(`[aria-controls="qbit-nav-${index}"]`) as HTMLElement | null;
    if (trigger && trigger.parentElement?.contains(document.activeElement)) {
      trigger.focus();
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.openNavGroup === null) {
      return;
    }
    const target = event.target as Element | null;
    if (!target?.closest('.qbit-group')) {
      this.openNavGroup = null;
    }
  }

  // tier-1 (and the panel anchored to it) scrolls away while the backdrop is
  // fixed — scrolling with the menu open would strand a dimmed screen with no
  // menu, so treat background scroll as dismissal. The listener exists ONLY
  // while the menu is open, is passive, and runs outside the zone: idle
  // scrolling (the common case on this scroll-heavy app) triggers no change
  // detection at all
  private armMenuScrollDismissal(): void {
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.menuScrollDismissal, { passive: true, once: true });
    });
  }

  private disarmMenuScrollDismissal(): void {
    window.removeEventListener('scroll', this.menuScrollDismissal);
  }

  private menuScrollDismissal = (): void => {
    this.ngZone.run(() => {
      this.menuOpen = false;
    });
  };

  ngOnDestroy(): void {
    this.disarmMenuScrollDismissal();
  }

  // the drop panel only exists below the hamburger breakpoint and the
  // dropdowns only above it; leaving either open across a resize would
  // restore it unexpectedly on return
  @HostListener('window:resize')
  onResize(): void {
    const desktop = window.innerWidth > this.qbitDesignService.tokens.header.mobileBreakpointPx;
    if (this.menuOpen && desktop) {
      this.closeMenu(); // also disarms the scroll-dismissal listener
    }
    if (!desktop) {
      this.openNavGroup = null;
    }
  }
}
