import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-search-results',
  templateUrl: './search-results.component.html',
  styleUrls: ['./search-results.component.scss'],
  standalone: false,
})
export class SearchResultsComponent implements OnChanges {
  @Input() results: any = {};
  @Output() selectedResult = new EventEmitter();

  isMobile = (window.innerWidth <= 1150);
  resultsFlattened = [];
  activeIdx = 0;
  focusFirst = true;
  networkName = '';

  constructor(
    public stateService: StateService,
    ) { }

  ngOnInit() {
    this.networkName = this.getNetworkName(this.stateService.network);
  }

  private getNetworkName(network: string): string {
    switch (network) {
      case '':
        return 'qbit';
      case 'testnet':
        return 'qbit Testnet3';
      case 'testnet4':
        return 'qbit Testnet4';
      case 'signet':
        return 'qbit Signet';
      case 'regtest':
        return 'qbit Regtest';
      default:
        return network.charAt(0).toUpperCase() + network.slice(1);
    }
  }

  ngOnChanges() {
    this.activeIdx = 0;
    if (this.results) {
      this.resultsFlattened = [...(this.results.hashQuickMatch ? [this.results.searchText] : []), ...this.results.addresses, ...this.results.pools, ...this.results.otherNetworks];
    }
  }

  searchButtonClick() {
    if (this.resultsFlattened[this.activeIdx]) {
      this.selectedResult.emit(this.resultsFlattened[this.activeIdx]);
      this.results = null;
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.next();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.prev();
        break;
      case 'Enter':
        if (!this.results) {
          // no typeahead state yet (e.g. a form seeded by the responsive
          // mirror): let the native form submission handle the query
          return;
        }
        event.preventDefault();
        if (this.resultsFlattened[this.activeIdx]?.isNetworkAvailable === false) {
          return;
        }
        if (this.resultsFlattened[this.activeIdx]) {
          this.selectedResult.emit(this.resultsFlattened[this.activeIdx]);
        } else {
          this.selectedResult.emit(this.results.searchText);
        }
        this.results = null;
        break;
    }
  }

  clickItem(id: number) {
    this.selectedResult.emit(this.resultsFlattened[id]);
    this.results = null;
  }

  next() {
    if (this.activeIdx === this.resultsFlattened.length - 1) {
      this.activeIdx = this.focusFirst ? (this.activeIdx + 1) % this.resultsFlattened.length : -1;
    } else {
      this.activeIdx++;
    }
  }

  prev() {
    if (this.activeIdx < 0) {
      this.activeIdx = this.resultsFlattened.length - 1;
    } else if (this.activeIdx === 0) {
      this.activeIdx = this.focusFirst ? this.resultsFlattened.length - 1 : -1;
    } else {
      this.activeIdx--;
    }
  }

}
