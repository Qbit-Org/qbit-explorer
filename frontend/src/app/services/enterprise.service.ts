import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EnterpriseService {
  exclusiveHostName = '';
  subdomain: string | null = null;
  statsUrl: string;
  siteId: number;
  info$: BehaviorSubject<object> = new BehaviorSubject(null);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private apiService: ApiService,
    private seoService: SeoService,
    private stateService: StateService,
    private activatedRoute: ActivatedRoute,
  ) {
    const hostSubdomain = this.exclusiveHostName && this.document.location.hostname.indexOf(this.exclusiveHostName) > -1
      && this.document.location.hostname.split(this.exclusiveHostName)[0] || false;
    const subdomain = this.stateService.env.customize?.enterprise || hostSubdomain;
    if (subdomain && subdomain.match(/^[A-z0-9-_]+$/)) {
      this.subdomain = subdomain;
      this.fetchSubdomainInfo();
      this.disableSubnetworks();
      this.stateService.env.ACCELERATOR = false;
    } else {
      this.insertMatomo();
    }
  }

  getSubdomain(): string {
    return this.subdomain;
  }

  disableSubnetworks(): void {
    this.stateService.env.TESTNET_ENABLED = false;
    this.stateService.env.TESTNET4_ENABLED = false;
    this.stateService.env.SIGNET_ENABLED = false;
    this.stateService.env.REGTEST_ENABLED = false;
    this.stateService.env.MAINNET_EXPLORER_URL = '';
    this.stateService.env.TESTNET4_EXPLORER_URL = '';
  }

  fetchSubdomainInfo(): void {
    if (this.stateService.env.customize?.branding) {
      const info = this.stateService.env.customize?.branding;
      this.insertMatomo(info.site_id);
      this.seoService.setEnterpriseTitle(info.title, true);
      this.info$.next(this.processEnterpriseInfo(info));
    } else {
      this.info$.next(null);
    }
  }

  private processEnterpriseInfo(info: any): any {
    const isCustomDashboard = this.stateService.env.customize?.dashboard?.widgets?.length > 0;
    const dualLogo = !isCustomDashboard || info.cobranded;
    const logoUrl = info.header_img ?? info.img ?? null;
    return {
      ...info,
      dualLogo,
      logoUrl,
    };
  }

  insertMatomo(_siteId?: number): void {
    return;
  }

  private getMatomo() {
    if (this.siteId != null) {
      return window['Matomo']?.getTracker(this.statsUrl+'m.php', this.siteId);
    }
  }

  goal(id: number) {
    // @ts-ignore
    this.getMatomo()?.trackGoal(id);
  }

  page() {
    const matomo = this.getMatomo();
    if (matomo) {
      matomo.setCustomUrl(this.getCustomUrl());
      matomo.trackPageView();
    }
  }

  private getCustomUrl(): string {
    let url = window.location.origin + '/';
    let route = this.activatedRoute;
    while (route) {
      const segment = route?.routeConfig?.path;
      if (segment && segment.length) {
        url += segment + '/';
      }
      route = route.firstChild;
    }
    return url;
  }
}
