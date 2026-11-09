import { Injectable } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PoolsStats, SinglePoolStats } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';
import { shownTimespan } from '@app/shared/block-target.utils';

export interface MiningUnits {
  hashrateDivider: number;
  hashrateUnit: string;
}

export interface MiningStats {
  lastEstimatedHashrate: number;
  lastEstimatedHashrate3d: number;
  lastEstimatedHashrate1w: number;
  blockCount: number;
  totalEmptyBlock: number;
  totalEmptyBlockRatio: string;
  pools: SinglePoolStats[];
  miningUnits: MiningUnits;
  totalBlockCount: number;
  minersLuck?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MiningService {
  cache: {
    [interval: string]: {
      lastUpdated: number;
      data: MiningStats;
    }
  } = {};
  poolsData: SinglePoolStats[] = [];

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private storageService: StorageService,
  ) {
    this.stateService.networkChanged$.subscribe((network) => {
      this.clearCache();
    });
   }

  /**
   * Generate pool ranking stats
   */
  public getMiningStats(interval: string): Observable<MiningStats> {
    // returned cached data fetched within the last 5 minutes
    if (this.cache[interval] && this.cache[interval].lastUpdated > (Date.now() - (5 * 60000))) {
      return of(this.cache[interval].data);
    } else {
      return this.apiService.listPools$(interval).pipe(
        map(response => this.generateMiningStats(response)),
        tap(stats => {
          this.cache[interval] = {
            lastUpdated: Date.now(),
            data: stats,
          };
        })
      );
    }
  }

  /**
   * Get names and slugs of all pools
   */
  public getPools(): Observable<any[]> {
    return this.poolsData.length ? of(this.poolsData) : this.apiService.listPools$(undefined).pipe(
      map(response => {
        this.poolsData = response.body;
        return this.poolsData;
      })
    );
  }
  /**
   * Set the hashrate power of ten we want to display
   */
  public getMiningUnits(): MiningUnits {
    const powerTable = {
      0: 'H/s',
      3: 'kH/s',
      6: 'MH/s',
      9: 'GH/s',
      12: 'TH/s',
      15: 'PH/s',
      18: 'EH/s',
    };

    // I think it's fine to hardcode this since we don't have x1000 hashrate jump everyday
    // If we want to support the mining dashboard for testnet, we can hardcode it too
    let selectedPower = 18;
    if (this.stateService.network === 'testnet' || this.stateService.network === 'testnet4') {
      selectedPower = 12;
    }

    return {
      hashrateDivider: Math.pow(10, selectedPower),
      hashrateUnit: powerTable[selectedPower],
    };
  }

  /**
   * Get the default selection timespan, cap with `min`
   */
  public getDefaultTimespan(min: string): string {
    const timespans = [
      '24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'
    ];
    const preference = this.storageService.getValue('miningWindowPreference') ?? '1w';
    if (timespans.indexOf(preference) < timespans.indexOf(min)) {
      return min;
    }
    return preference;
  }

  /**
   * Range buttons show once the indexed blocks cover their timespan, so on a young chain a
   * graph's default, saved or linked range can be one whose button is hidden, and a link can name
   * a range the graph has no button for. Switches the graph to the widest range on show instead,
   * and returns whether it did, so the graph can drop what it loaded before anything renders.
   */
  public switchToShownRange(dateSpan: AbstractControl, rangeButtons: string[], indexedBlockCount: number): boolean {
    const requestedTimespan = dateSpan.value;
    const timespan = shownTimespan(requestedTimespan, rangeButtons, indexedBlockCount, this.stateService.env.BLOCK_TARGET_SPACING_SECONDS);
    if (timespan === requestedTimespan) {
      return false;
    }
    // stats can arrive synchronously, from a cache, before the graph listens for range changes
    queueMicrotask(() => {
      if (dateSpan.value !== requestedTimespan) {
        return;
      }
      // Every mining graph opens at this preference. Graphs save the range they load, and a link
      // to the pools pages saves its range, before anyone knows it's hidden; keep the visitor's.
      const preference = this.storageService.getValueBefore('miningWindowPreference', requestedTimespan);
      dateSpan.setValue(timespan);
      this.storageService.restoreValue('miningWindowPreference', preference);
    });
    return true;
  }

  private generateMiningStats(response): MiningStats {
    const stats: PoolsStats = response.body;
    const miningUnits = this.getMiningUnits();
    const hashrateDivider = miningUnits.hashrateDivider;

    const totalEmptyBlock = Object.values(stats.pools).reduce((prev, cur) => {
      return prev + cur.emptyBlocks;
    }, 0);
    const totalEmptyBlockRatio = (totalEmptyBlock / stats.blockCount * 100).toFixed(2);
    const poolsStats = stats.pools.map((poolStat) => {
      return {
        // spread first: the derived fields below must override the raw H/s
        // values the backend now ships under the same names
        ...poolStat,
        share: parseFloat((poolStat.blockCount / stats.blockCount * 100).toFixed(2)),
        // prefer the backend's lane-aware estimate: overall block share times
        // the aggregate rate misprices pools because the two Cadence lanes
        // run at very different network hashrates
        lastEstimatedHashrate: (poolStat.lastEstimatedHashrate ?? (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate)) / hashrateDivider,
        lastEstimatedHashrate3d: (poolStat.lastEstimatedHashrate3d ?? (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate3d)) / hashrateDivider,
        lastEstimatedHashrate1w: (poolStat.lastEstimatedHashrate1w ?? (poolStat.blockCount / stats.blockCount * stats.lastEstimatedHashrate1w)) / hashrateDivider,
        emptyBlockRatio: (poolStat.emptyBlocks / poolStat.blockCount * 100).toFixed(2),
        logo: `/resources/mining-pools/` + poolStat.slug + '.svg',
      };
    });

    return {
      lastEstimatedHashrate: stats.lastEstimatedHashrate / hashrateDivider,
      lastEstimatedHashrate3d: stats.lastEstimatedHashrate3d / hashrateDivider,
      lastEstimatedHashrate1w: stats.lastEstimatedHashrate1w / hashrateDivider,
      blockCount: stats.blockCount,
      totalEmptyBlock: totalEmptyBlock,
      totalEmptyBlockRatio: totalEmptyBlockRatio,
      pools: poolsStats,
      miningUnits: miningUnits,
      totalBlockCount: parseInt(response.headers.get('x-total-count'), 10),
    };
  }

  private clearCache(): void {
    this.cache = {};
    this.poolsData = [];
  }
}
