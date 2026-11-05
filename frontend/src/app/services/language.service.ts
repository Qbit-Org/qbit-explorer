import { DOCUMENT, getLocaleId } from '@angular/common';
import { LOCALE_ID, Inject, Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private language = 'en';
  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    this.language = getLocaleId(this.locale).substring(0, 2);
  }

  getLanguage(): string {
    return this.language;
  }

  stripLanguageFromUrl(urlPath: string) {
    let rawUrlPath = urlPath ? urlPath : this.document.location.pathname;
    const urlLanguage = rawUrlPath.split('/')[1];
    if (urlLanguage === this.language) {
      rawUrlPath = rawUrlPath.substring(urlLanguage.length + 1);
    }
    return rawUrlPath || '/';
  }

  getLanguageForUrl(): string {
    return this.language === 'en' ? '' : '/' + this.language;
  }

  setLanguage(language: string): void {
    try {
      document.cookie = `lang=${language}; expires=Thu, 18 Dec 2050 12:00:00 UTC; path=/`;
    } catch (e) { }
  }
}
