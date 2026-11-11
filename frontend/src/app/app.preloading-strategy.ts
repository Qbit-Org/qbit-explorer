import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, timer, mergeMap, of } from 'rxjs';

@Injectable()
export class AppPreloadingStrategy implements PreloadingStrategy {
  // the server renders one page and never navigates on, and the delay would
  // hold that render back
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  preload(route: Route, load: Function): Observable<any> {
      return this.isBrowser && route.data && route.data.preload
          ? timer(1500).pipe(mergeMap(() => load()))
          : of(null);
    }
}
