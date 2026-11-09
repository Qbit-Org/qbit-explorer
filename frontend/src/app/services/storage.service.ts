import { Injectable } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  // what each key held before this page last changed it
  private previousValues: { [key: string]: string | null } = {};

  constructor(private router: Router, private route: ActivatedRoute) {
    this.setDefaultValueIfNeeded('graphWindowPreference', '2h');
    this.setDefaultValueIfNeeded('miningWindowPreference', '1w');
  }

  setDefaultValueIfNeeded(key: string, defaultValue: string) {
    const graphWindowPreference: string = this.getValue(key);
    const fragment = window.location.hash.replace('#', '');

    if (graphWindowPreference === null) { // First visit to the explorer
      if (window.location.pathname.includes('graphs') && key === 'graphWindowPreference' ||
        window.location.pathname.includes('pools') && key === 'miningWindowPreference'
      ) {
        this.setValue(key, fragment ? fragment : defaultValue);
      } else {
        this.setValue(key, defaultValue);
      }
    } else if (window.location.pathname.includes('graphs') && key === 'graphWindowPreference' ||
      window.location.pathname.includes('pools') && key === 'miningWindowPreference'
    ) {
      // Visit a different graphs#fragment from last visit
      if (fragment !== null && graphWindowPreference !== fragment) {
        this.setValue(key, fragment);
      }
    }
  }

  getValue(key: string): string {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.log(e);
      return '';
    }
  }

  setValue(key: string, value: any): void {
    try {
      const previousValue = localStorage.getItem(key);
      if (previousValue !== String(value)) {
        this.previousValues[key] = previousValue;
      }
      localStorage.setItem(key, value);
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * What a key held before this page last set it to `value`: its current value if the page
   * didn't, or null if it was unset.
   */
  getValueBefore(key: string, value: string): string | null {
    const currentValue = this.getValue(key);
    if (currentValue === value && this.previousValues[key] !== undefined) {
      return this.previousValues[key];
    }
    return currentValue;
  }

  /**
   * Sets a key back to an earlier value, or removes it if that was unset, and forgets the changes
   * the earlier value replaces.
   */
  restoreValue(key: string, value: string | null): void {
    if (value === null) {
      this.removeItem(key);
    } else {
      this.setValue(key, value);
    }
    delete this.previousValues[key];
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.log(e);
    }
  }

  getAuth(): any | null {
    try {
      return JSON.parse(localStorage.getItem('auth'));
    } catch(e) {
      return null;
    }
  }
}
