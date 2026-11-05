import { Injectable } from '@angular/core';
import { MenuGroup } from '@interfaces/services.interface';
import { Observable, of, ReplaySubject } from 'rxjs';
import { IBackendInfo } from '@interfaces/websocket.interface';

export interface IUser {
  username: string;
  email: string | null;
  passwordIsSet: boolean;
  snsId: string;
  type: 'enterprise' | 'community' | 'mining_pool';
  subscription_tag: string;
  status: 'pending' | 'verified' | 'disabled';
  features: string | null;
  countryCode: string | null;
  imageMd5: string;
  ogRank: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ServicesApiServices {
  userSubject$ = new ReplaySubject<IUser | null>(1);
  currentAuth = null;

  constructor() {
    this.userSubject$.next(null);
  }

  getUserMenuGroups$(): Observable<MenuGroup[]> {
    return of([]);
  }

  logout$(): Observable<any> {
    localStorage.removeItem('auth');
    this.userSubject$.next(null);
    return of(null);
  }

  getJWT$() {
    return of(null);
  }

  getServicesBackendInfo$(): Observable<IBackendInfo> {
    return of(null);
  }

  getFaucetStatus$() {
    return of({ min: 0, max: 0, code: 'faucet_not_available' as const });
  }

  requestTestnet4Coins$(address: string, sats: number) {
    return of(null);
  }
}
