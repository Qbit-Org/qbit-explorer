import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import qbitTokens from '../../resources/qbit-design/tokens.json';
import vendoredNav from '../../resources/qbit-design/nav.json';
import { StateService } from '@app/services/state.service';

export const QBIT_ORIGIN = 'https://qbit.org';

// The published contract's entry for this site, rendered as the explorer's
// own root link and marked active. Matching is by hostname so the contract
// stays free to relabel or restyle the entry.
const EXPLORER_CANONICAL_HOST = 'mempool.qbit.org';

// The published contract is re-fetched on this cadence so header content
// converges on qbit.org deploys without waiting for an explorer deploy.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export interface QbitNavLink {
  label: string;
  href: string;
  external: boolean;
  /** One of qbit.org's dropdown glyphs (see QBIT_NAV_ICON_PATHS); optional. */
  icon?: string;
}

/** A labelled dropdown in qbit.org's header (contract `items`). */
export interface QbitNavGroup {
  label: string;
  links: QbitNavLink[];
}

export type QbitNavItem = QbitNavLink | QbitNavGroup;

export interface QbitNavSocial {
  github: string;
  x: string;
  discord: string;
}

export interface QbitNav {
  version: number;
  banner: { text: string; href: string };
  links: QbitNavLink[];
  /**
   * Additive (still version 1): the header's structure, plain links plus
   * groups. Absent from older contracts, which render `links` flat.
   */
  items?: QbitNavItem[];
  social: QbitNavSocial;
}

export interface QbitHeaderLink extends QbitNavLink {
  absoluteHref: string;
  isExplorerRoot: boolean;
  newTab?: boolean;
}

export type QbitHeaderItem =
  | { kind: 'link'; link: QbitHeaderLink }
  | { kind: 'group'; label: string; links: QbitHeaderLink[]; active: boolean };

export interface QbitFooterGroup {
  label: string;
  links: QbitHeaderLink[];
}

export interface QbitHeaderNav {
  banner: { text: string; href: string };
  links: QbitHeaderLink[];
  /** What the header renders: the contract's `items`, else `links` as plain items. */
  items: QbitHeaderItem[];
  footerGroups: QbitFooterGroup[];
  social: QbitNavSocial;
}

/**
 * qbit.org's dropdown glyphs (24px outline paths, drawn with currentColor),
 * keyed by the contract's `icon` names. An unknown name renders no icon.
 */
export const QBIT_NAV_ICON_PATHS: Record<string, string[]> = {
  layers: ['m12 2 10 5-10 5L2 7z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
  ],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
  key: [
    'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z',
    'M16.5 7.5h.01',
  ],
  chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  blocks: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
};

/**
 * Serves the vendored qbit.org design contract (src/resources/qbit-design/)
 * to the header and footer. The vendored copy renders synchronously; the
 * published contract is fetched from the same-origin /qbit-design/ proxy at
 * runtime and patched in if its content changed.
 */
@Injectable({
  providedIn: 'root'
})
export class QbitDesignService {
  readonly tokens = qbitTokens;
  private nav$ = new BehaviorSubject<QbitNav>(vendoredNav as QbitNav);

  readonly headerNav$: Observable<QbitHeaderNav> = this.nav$.pipe(
    map((nav) => this.toHeaderNav(nav)),
    shareReplay(1),
  );

  constructor(
    private stateService: StateService,
  ) {
    this.applyTokens();
    // With qbit.org's header and footer turned off, nothing here needs its
    // published contract, so this instance doesn't contact it at all
    if (!this.stateService.env.QBIT_SITE_CHROME) {
      return;
    }
    this.refreshFromPublished();
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      window.setInterval(() => this.refreshFromPublished(), REFRESH_INTERVAL_MS);
    }
  }

  resolveHref(href: string): string {
    try {
      return new URL(href, QBIT_ORIGIN).toString();
    } catch {
      return QBIT_ORIGIN;
    }
  }

  private toHeaderNav(nav: QbitNav): QbitHeaderNav {
    const toHeaderLink = (link: QbitNavLink): QbitHeaderLink => ({
      ...link,
      absoluteHref: this.resolveHref(link.href),
      isExplorerRoot: this.isExplorerHost(link.href),
    });
    const links = nav.links.map(toHeaderLink);
    const items: QbitHeaderItem[] = nav.items
      ? nav.items.map((item) => {
        if ('links' in item) {
          const groupLinks = item.links.map(toHeaderLink);
          return {
            kind: 'group' as const,
            label: item.label,
            links: groupLinks,
            // the group holding this site's own entry is the active one
            active: groupLinks.some((link) => link.isExplorerRoot),
          };
        }
        return { kind: 'link' as const, link: toHeaderLink(item) };
      })
      : links.map((link) => ({ kind: 'link' as const, link }));
    return {
      banner: { text: nav.banner.text, href: this.resolveHref(nav.banner.href) },
      links,
      items,
      footerGroups: this.toFooterGroups(items, toHeaderLink),
      social: nav.social,
    };
  }

  // qbit.org's footer columns, built the way its SiteFooter does: the header's
  // single links, bar Home, gather under Explore, its dropdowns keep their own
  // labels, and the footer-only pages join the column they belong to. The
  // contract doesn't carry those pages, so they are kept in sync by hand.
  private toFooterGroups(items: QbitHeaderItem[], toHeaderLink: (link: QbitNavLink) => QbitHeaderLink): QbitFooterGroup[] {
    const singleLinks: QbitHeaderLink[] = [];
    const groups: QbitFooterGroup[] = [];
    for (const item of items) {
      if (item.kind === 'group') {
        groups.push({ label: item.label, links: [...item.links] });
      } else if (item.link.absoluteHref !== this.resolveHref('/')) {
        singleLinks.push(item.link);
      }
    }
    const resources = {
      label: 'Resources',
      links: [
        toHeaderLink({ label: 'Changelog', href: '/changelog', external: false }),
        toHeaderLink({ label: 'Press', href: '/press', external: false }),
      ],
    };
    const rpcDocs = { ...toHeaderLink({ label: 'RPC Docs', href: 'https://docs.qbit.org', external: true }), newTab: true };
    (groups.find((group) => group.label === 'Docs') ?? resources).links.push(rpcDocs);
    return [{ label: 'Explore', links: singleLinks }, ...groups, resources];
  }

  // The contract entry pointing at this site's root (canonically
  // mempool.qbit.org, or whatever host is serving the explorer right now,
  // e.g. a self-hosted instance or a staging host) renders as the
  // explorer's own active root link. Deep links on the explorer host stay
  // ordinary anchors, so an editorial addition like /docs can never be
  // rewritten to the root.
  private isExplorerHost(href: string): boolean {
    let url: URL;
    try {
      url = new URL(href, QBIT_ORIGIN);
    } catch {
      return false;
    }
    const hostMatches = url.hostname === EXPLORER_CANONICAL_HOST
      || (typeof window !== 'undefined' && url.hostname === window.location.hostname);
    return hostMatches
      && (url.pathname === '/' || url.pathname === '')
      && url.search === ''
      && url.hash === '';
  }

  // expose the design tokens as CSS custom properties for the header/footer
  // stylesheets, so vendored contract values are never duplicated in SCSS
  private applyTokens(): void {
    if (typeof document === 'undefined') {
      return;
    }
    const style = document.documentElement.style;
    for (const [name, value] of Object.entries(this.tokens.color)) {
      style.setProperty(`--qbit-${name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}`, value);
    }
    style.setProperty('--qbit-font-sans', this.tokens.font.sans);
    style.setProperty('--qbit-font-mono', this.tokens.font.mono);
    style.setProperty('--qbit-font-display', this.tokens.font.display);
    style.setProperty('--qbit-banner-height', `${this.tokens.header.bannerHeightPx}px`);
    style.setProperty('--qbit-header-height', `${this.tokens.header.heightPx}px`);
    style.setProperty('--qbit-header-max-width', `${this.tokens.header.maxWidthPx}px`);
  }

  private async refreshFromPublished(): Promise<void> {
    if (typeof window === 'undefined' || typeof fetch !== 'function') {
      return;
    }
    try {
      // credentials: 'omit' so deployment session cookies never ride along
      // to the external design-contract origin behind the proxy
      const response = await fetch('/qbit-design/nav.json', { credentials: 'omit' });
      if (!response.ok) {
        return;
      }
      const published = await response.json();
      if (!this.isValidNav(published)) {
        return;
      }
      if (JSON.stringify(published) !== JSON.stringify(this.nav$.value)) {
        this.nav$.next(published);
      }
    } catch {
      // not reachable (dev server, offline, contract not published yet):
      // keep rendering the vendored copy
    }
  }

  private isValidNav(nav: any): nav is QbitNav {
    const isString = (value: any): boolean => typeof value === 'string' && value.length > 0;
    // Schema-only: the published contract is authoritative for content, so a
    // fetch is rejected (keeping the last-known-good copy) only when it is
    // structurally unusable, never for editorial choices.
    const isLink = (link: any): boolean => isString(link?.label) && isString(link?.href)
      && typeof link?.external === 'boolean' && (link.icon === undefined || isString(link.icon));
    // any item carrying `links` is a group, as toHeaderNav (and qbit.org)
    // discriminate, so a link-shaped item with a non-array `links` fails here
    const isItem = (item: any): boolean => item?.links !== undefined
      ? Array.isArray(item.links) && isString(item.label) && item.links.length > 0 && item.links.every(isLink)
      : isLink(item);
    return nav?.version === 1
      && isString(nav.banner?.text) && isString(nav.banner?.href)
      && Array.isArray(nav.links) && nav.links.length > 0
      && nav.links.every(isLink)
      && (nav.items === undefined || (Array.isArray(nav.items) && nav.items.length > 0 && nav.items.every(isItem)))
      && isString(nav.social?.github) && isString(nav.social?.x) && isString(nav.social?.discord);
  }
}
