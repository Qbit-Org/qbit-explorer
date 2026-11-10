import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption, LineSeriesOption } from '@app/graphs/echarts';
import { combineLatest, fromEvent, merge, Observable } from 'rxjs';
import { filter, map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { download } from '@app/shared/graphs.utils';
import { ActivatedRoute } from '@angular/router';
import { StateService } from '@app/services/state.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { HistoricalHashrateResponse } from '@interfaces/node-api.interface';
import { expectedBlocksForTimespan as getExpectedBlocksForTimespan } from '@app/shared/block-target.utils';

type ChartPoint = [number, number];
type NullableChartPoint = [number, number | null];

interface HashrateChartData {
  aggregate: ChartPoint[];
  permissionless?: ChartPoint[];
  auxpow?: ChartPoint[];
  difficulty: NullableChartPoint[];        // permissionless lane on a lane-aware backend, legacy otherwise
  difficultyAuxpow?: NullableChartPoint[];
}

interface HashrateWidgetStats {
  blockCount: number;
  currentDifficulty: number;
  currentDifficultyPermissionless?: number | null;
  currentDifficultyAuxpow?: number | null;
  currentHashrate: number;
  currentHashratePermissionless?: number;
  currentHashrateAuxpow?: number;
  hasLaneHashrateBreakdown: boolean;
  hasLaneDifficultyBreakdown: boolean;
}

interface HashrateLegendEntry {
  name: string;
  inactiveColor: string;
  textStyle: {
    color: string;
  };
  icon: string;
  itemStyle: {
    color: string;
  };
}

const SERIES_ID = {
  aggregate: 'hashrate-aggregate',
  permissionless: 'hashrate-permissionless',
  auxpow: 'hashrate-auxpow',
  difficulty: 'difficulty',
  difficultyAuxpow: 'difficulty-auxpow',
} as const;

const SERIES_COLOR = {
  aggregate: '#FFB300',
  permissionless: '#007cfa',
  auxpow: '#00ddff',
  difficulty: '#D81B60',
  difficultyAuxpow: '#9C27B0',
} as const;

@Component({
  selector: 'app-hashrate-chart',
  templateUrl: './hashrate-chart.component.html',
  styleUrls: ['./hashrate-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HashrateChartComponent implements OnInit {
  @Input() tableOnly = false;
  @Input() widget = false;
  @Input() height: number = 300;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;
  readonly rangeButtons = ['3m', '6m', '1y', '2y', '3y', 'all'];

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  hashrateObservable$: Observable<HashrateWidgetStats>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;
  network = '';

  readonly aggregateLabel = $localize`:mining.aggregate-hashrate|Aggregate network hashrate series:Aggregate`;
  readonly permissionlessLabel = $localize`:cadence.permissionless|Permissionless mining lane label:Permissionless`;
  readonly auxpowLabel = $localize`:cadence.auxpow|AuxPoW mining lane label:AuxPoW`;
  readonly difficultyLabel = $localize`:@@25148835d92465353fc5fe8897c27d5369978e5a:Difficulty`;
  readonly difficultyPermissionlessLabel = $localize`:mining.difficulty-permissionless|Permissionless lane difficulty series:Difficulty (Permissionless)`;
  readonly difficultyAuxpowLabel = $localize`:mining.difficulty-auxpow|AuxPoW lane difficulty series:Difficulty (AuxPoW)`;
  private readonly legacyHashrateLabel = $localize`:@@79a9dc5b1caca3cbeb1733a19515edacc5fc7920:Hashrate`;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    private amountShortenerPipe: AmountShortenerPipe,
    public stateService: StateService
  ) {
  }

  ngOnInit(): void {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '1y';
    } else {
      this.seoService.setTitle($localize`:@@3510fc6daa1d975f331e3a717bdf1a34efa06dff:Hashrate & Difficulty`);
      this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.hashrate:See aggregate, permissionless, and AuxPoW hashrate alongside difficulty for the qbit${seoDescriptionNetwork(this.network)} network visualized over time.`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('3m');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.hashrateObservable$ = combineLatest(
        merge(
        this.radioGroupForm.get('dateSpan').valueChanges
          .pipe(
            startWith(this.radioGroupForm.controls.dateSpan.value),
            switchMap((timespan) => {
              if (!this.widget && !firstRun) {
                this.storageService.setValue('miningWindowPreference', timespan);
              }
              this.timespan = timespan;
              firstRun = false;
              this.miningWindowPreference = timespan;
              this.isLoading = true;
              return this.apiService.getHistoricalHashrate$(this.timespan);
            })
          ),
          this.stateService.chainTip$
            .pipe(
              switchMap(() => {
                // drop a refresh for a range the graph has since left, such as one it switched from
                const timespan = this.timespan;
                return this.apiService.getHistoricalHashrate$(timespan).pipe(filter(() => timespan === this.timespan));
              })
            )
        ),
        fromEvent(window, 'resize').pipe(startWith(null)),
      ).pipe(
        map(([response]) => response),
        filter((response) => this.widget || !this.miningService.switchToShownRange(
          this.radioGroupForm.controls.dateSpan, this.rangeButtons, parseInt(response.headers.get('x-total-count') || '0', 10))),
        tap((response) => {
          const data = response.body;
          if (!data) {
            return;
          }

          const hasAlignedHistory = Array.isArray(data.hashratesAggregate)
            && data.hashratesAggregate.length > 0
            && Array.isArray(data.hashratesPermissionless)
            && data.hashratesPermissionless.length === data.hashratesAggregate.length
            && Array.isArray(data.hashratesAuxpow)
            && data.hashratesAuxpow.length === data.hashratesAggregate.length;
          // Preserve the complete legacy aggregate line while lane backfill is
          // still sparse. The aligned aggregate validates the lane subset; at
          // those timestamps its values match the legacy series.
          const aggregateHistory = data.hashrates;

          // the legacy difficulty field carries the permissionless series when
          // the backend is lane-aware; a lane-blind backend simply gets one
          // legacy-labelled difficulty line. A lane-aware backend always sends
          // difficultyAuxpow, so only treat the chart as dual-lane once that
          // lane actually has data.
          const hasLaneDifficulty = Array.isArray(data.difficultyAuxpow)
            && (data.difficultyAuxpow.length > 0 || data.currentDifficultyAuxpow != null);

          this.prepareChartOptions({
            aggregate: this.toChartPoints(aggregateHistory),
            permissionless: hasAlignedHistory
              ? this.toChartPoints(data.hashratesPermissionless)
              : undefined,
            auxpow: hasAlignedHistory
              ? this.toChartPoints(data.hashratesAuxpow)
              : undefined,
            difficulty: this.alignDifficultyToHashrate(
              data.difficultyPermissionless ?? data.difficulty,
              data.currentDifficultyPermissionless ?? data.currentDifficulty,
              aggregateHistory,
            ),
            difficultyAuxpow: hasLaneDifficulty
              ? this.alignDifficultyToHashrate(data.difficultyAuxpow, data.currentDifficultyAuxpow ?? null, aggregateHistory)
              : undefined,
          });
          this.isLoading = false;
        }),
        map((response) => {
          const data = response.body;
          if (!data) {
            return {
              blockCount: 0,
              currentDifficulty: 0,
              currentHashrate: 0,
              hasLaneHashrateBreakdown: false,
              hasLaneDifficultyBreakdown: false,
            };
          }
          return {
            blockCount: parseInt(response.headers.get('x-total-count') || '0', 10),
            currentDifficulty: data.currentDifficulty,
            currentDifficultyPermissionless: data.currentDifficultyPermissionless,
            currentDifficultyAuxpow: data.currentDifficultyAuxpow,
            currentHashrate: data.currentHashrate,
            currentHashratePermissionless: data.currentHashratePermissionless,
            currentHashrateAuxpow: data.currentHashrateAuxpow,
            hasLaneHashrateBreakdown: data.currentHashrate > 0
              && data.currentHashratePermissionless !== undefined
              && data.currentHashrateAuxpow !== undefined,
            hasLaneDifficultyBreakdown: data.currentDifficultyPermissionless != null
              && data.currentDifficultyAuxpow != null,
          };
        }),
        share()
      );
  }

  expectedBlocksForTimespan(timespan: string): number {
    return getExpectedBlocksForTimespan(timespan, this.stateService.env.BLOCK_TARGET_SPACING_SECONDS);
  }

  private toChartPoints(hashrates: HistoricalHashrateResponse['hashrates']): ChartPoint[] {
    return hashrates.map((hashrate) => [hashrate.timestamp * 1000, hashrate.avgHashrate]);
  }

  /**
   * Step one difficulty series along the hashrate timestamps (duplicating
   * points so the shared axis tooltip always finds a value) and append the
   * current difficulty as the newest point.
   */
  private alignDifficultyToHashrate(
    difficultyHistory: HistoricalHashrateResponse['difficulty'],
    currentDifficulty: number | null,
    hashrateHistory: HistoricalHashrateResponse['hashrates'],
  ): NullableChartPoint[] {
    const difficulty = [...difficultyHistory];

    // always include the latest difficulty — also when the lane has no block
    // inside the selected interval (e.g. idle AuxPoW), so a known current
    // difficulty still draws instead of an all-null series
    if (currentDifficulty !== null && (difficulty.length === 0 || difficulty[difficulty.length - 1].difficulty !== currentDifficulty)) {
      difficulty.push({
        time: Date.now() / 1000,
        difficulty: currentDifficulty
      });
    }

    // We generate duplicated data point so the tooltip works nicely
    const diffFixed = [];
    let diffIndex = 1;
    let hashIndex = 0;
    while (hashIndex < hashrateHistory.length) {
      if (diffIndex >= difficulty.length) {
        while (hashIndex < hashrateHistory.length) {
          diffFixed.push({
            timestamp: hashrateHistory[hashIndex].timestamp,
            difficulty: difficulty.length > 0 ? difficulty[difficulty.length - 1].difficulty : null
          });
          ++hashIndex;
        }
        diffIndex++;
        break;
      }

      while (hashIndex < hashrateHistory.length && diffIndex < difficulty.length &&
        hashrateHistory[hashIndex].timestamp <= difficulty[diffIndex].time
      ) {
        diffFixed.push({
          timestamp: hashrateHistory[hashIndex].timestamp,
          difficulty: difficulty[diffIndex - 1].difficulty
        });
        ++hashIndex;
      }
      ++diffIndex;
    }

    while (diffIndex <= difficulty.length) {
      diffFixed.push({
        timestamp: difficulty[diffIndex - 1].time,
        difficulty: difficulty[diffIndex - 1].difficulty
      });
      diffIndex++;
    }

    return diffFixed.map(val => [val.timestamp * 1000, val.difficulty] as NullableChartPoint);
  }

  prepareChartOptions(data: HashrateChartData): void {
    const hasData = data.aggregate.length > 0
      || (data.permissionless?.length ?? 0) > 0
      || (data.auxpow?.length ?? 0) > 0;
    let title: object;
    if (!hasData) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center'
      };
    }

    const storedLegend = this.getStoredLegendSelection();
    const legendData: HashrateLegendEntry[] = [
      this.getLegendEntry(this.aggregateLabel, SERIES_COLOR.aggregate),
    ];
    const series: LineSeriesOption[] = [
      {
        id: SERIES_ID.aggregate,
        zlevel: 2,
        yAxisIndex: 0,
        name: this.aggregateLabel,
        showSymbol: false,
        symbol: 'none',
        data: data.aggregate,
        type: 'line',
        lineStyle: {
          color: SERIES_COLOR.aggregate,
          width: 3,
        },
        itemStyle: {
          color: SERIES_COLOR.aggregate,
        },
      },
    ];

    if (data.permissionless !== undefined) {
      legendData.push(this.getLegendEntry(this.permissionlessLabel, SERIES_COLOR.permissionless));
      series.push({
        id: SERIES_ID.permissionless,
        zlevel: 1,
        yAxisIndex: 0,
        name: this.permissionlessLabel,
        showSymbol: false,
        symbol: 'none',
        data: data.permissionless,
        type: 'line',
        lineStyle: {
          color: SERIES_COLOR.permissionless,
          width: 2,
        },
        itemStyle: {
          color: SERIES_COLOR.permissionless,
        },
      });
    }

    if (data.auxpow !== undefined) {
      legendData.push(this.getLegendEntry(this.auxpowLabel, SERIES_COLOR.auxpow));
      series.push({
        id: SERIES_ID.auxpow,
        zlevel: 1,
        yAxisIndex: 0,
        name: this.auxpowLabel,
        showSymbol: false,
        symbol: 'none',
        data: data.auxpow,
        type: 'line',
        lineStyle: {
          color: SERIES_COLOR.auxpow,
          type: 'dashed',
          width: 2,
        },
        itemStyle: {
          color: SERIES_COLOR.auxpow,
        },
      });
    }

    // with a lane-aware backend the two lanes get their own difficulty lines;
    // otherwise a single legacy-labelled difficulty line remains
    const hasLaneDifficulty = data.difficultyAuxpow !== undefined;
    const difficultyName = hasLaneDifficulty ? this.difficultyPermissionlessLabel : this.difficultyLabel;
    legendData.push(this.getLegendEntry(difficultyName, SERIES_COLOR.difficulty));
    series.push({
      id: SERIES_ID.difficulty,
      zlevel: 0,
      yAxisIndex: 1,
      name: difficultyName,
      showSymbol: false,
      symbol: 'none',
      data: data.difficulty,
      type: 'line',
      lineStyle: {
        color: SERIES_COLOR.difficulty,
        width: 3,
      },
      itemStyle: {
        color: SERIES_COLOR.difficulty,
      },
    });

    if (data.difficultyAuxpow !== undefined) {
      legendData.push(this.getLegendEntry(this.difficultyAuxpowLabel, SERIES_COLOR.difficultyAuxpow));
      series.push({
        id: SERIES_ID.difficultyAuxpow,
        zlevel: 0,
        yAxisIndex: 1,
        name: this.difficultyAuxpowLabel,
        showSymbol: false,
        symbol: 'none',
        data: data.difficultyAuxpow,
        type: 'line',
        lineStyle: {
          color: SERIES_COLOR.difficultyAuxpow,
          type: 'dashed',
          width: 2,
        },
        itemStyle: {
          color: SERIES_COLOR.difficultyAuxpow,
        },
      });
    }

    this.chartOptions = {
      title: title,
      animation: false,
      grid: {
        height: (this.widget && this.height) ? this.height - 30 : undefined,
        top: this.widget ? 20 : (this.isMobile() ? 68 : 40),
        bottom: this.widget ? 30 : 70,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile() || !this.widget,
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks): string => {
          if (!ticks?.length) {
            return '';
          }

          const rows: Record<string, string> = {};

          for (const tick of ticks) {
            if ([SERIES_ID.difficulty, SERIES_ID.difficultyAuxpow].includes(tick.seriesId)) {
              const difficulty = tick.data[1];
              if (difficulty === null) {
                rows[tick.seriesId] = `${tick.marker} ${tick.seriesName}: No data<br>`;
              } else {
                rows[tick.seriesId] = `${tick.marker} ${tick.seriesName}: ${this.amountShortenerPipe.transform(tick.data[1], 2, '', false)}<br>`;
              }
            } else if ([SERIES_ID.aggregate, SERIES_ID.permissionless, SERIES_ID.auxpow].includes(tick.seriesId)) {
              rows[tick.seriesId] = `${tick.marker} ${tick.seriesName}: ${this.amountShortenerPipe.transform(tick.data[1], 3, 'H/s', false, true)}<br>`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          return `
            <b style="color: white; margin-left: 2px">${date}</b><br>
            <span>${rows[SERIES_ID.difficulty] || ''}</span>
            <span>${rows[SERIES_ID.difficultyAuxpow] || ''}</span>
            <span>${rows[SERIES_ID.aggregate] || ''}</span>
            <span>${rows[SERIES_ID.permissionless] || ''}</span>
            <span>${rows[SERIES_ID.auxpow] || ''}</span>
          `;
        }
      },
      xAxis: !hasData ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: (this.widget || !hasData) ? undefined : {
        top: 0,
        data: legendData,
        selected: {
          [this.aggregateLabel]: storedLegend[this.aggregateLabel]
            ?? storedLegend[this.legacyHashrateLabel]
            ?? true,
          [this.permissionlessLabel]: storedLegend[this.permissionlessLabel] ?? true,
          [this.auxpowLabel]: storedLegend[this.auxpowLabel] ?? true,
          [this.difficultyLabel]: storedLegend[this.difficultyLabel] ?? this.network === '',
          [this.difficultyPermissionlessLabel]: storedLegend[this.difficultyPermissionlessLabel]
            ?? storedLegend[this.difficultyLabel]
            ?? this.network === '',
          [this.difficultyAuxpowLabel]: storedLegend[this.difficultyAuxpowLabel]
            ?? storedLegend[this.difficultyLabel]
            ?? this.network === '',
        },
      },
      yAxis: !hasData ? undefined : [
        {
          min: (value) => {
            const selectedPowerOfTen: any = selectPowerOfTen(value.min);
            const newMin = Math.floor(value.min / selectedPowerOfTen.divider / 10);
            return newMin * selectedPowerOfTen.divider * 10;
          },
          max: (value) => {
            return value.max;
          },
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              return this.amountShortenerPipe.transform(val, 3, 'H/s', false, true).toString();
            },
            showMinLabel: false,
            showMaxLabel: false,
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
        },
        hasLaneDifficulty ? {
          // the two lanes' difficulties sit orders of magnitude apart
          // (AuxPoW tracks merge-mined Bitcoin), so a shared linear scale
          // would flatline the permissionless series; a log axis keeps both
          // trends readable
          type: 'log',
          logBase: 10,
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              return this.amountShortenerPipe.transform(val, 3, '', false, true).toString();
            },
            showMinLabel: false,
            showMaxLabel: false,
          },
          splitLine: {
            show: false,
          }
        } : {
          type: 'value',
          position: 'right',
          min: (value) => {
            const firstYAxisMin = this.chartInstance.getModel().getComponent('yAxis', 0).axis.scale.getExtent()[0];
            if (firstYAxisMin === Infinity) {
              return value.min;
            }
            const selectedPowerOfTen: any = selectPowerOfTen(firstYAxisMin);
            const newMin = Math.floor(firstYAxisMin / selectedPowerOfTen.divider / 10);
            return this.stateService.env.BLOCK_TARGET_SPACING_SECONDS / 2 ** 32 * newMin * selectedPowerOfTen.divider * 10;
          },
          max: (value) => {
            const firstYAxisMax = this.chartInstance.getModel().getComponent('yAxis', 0).axis.scale.getExtent()[1];
            const scaledMax = this.stateService.env.BLOCK_TARGET_SPACING_SECONDS / 2 ** 32 * firstYAxisMax;
            return Math.max(scaledMax, value.max);
          },
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              if (this.stateService.network === 'signet') {
                return `${val}`;
              }
              return this.amountShortenerPipe.transform(val, 3, '', false, true).toString();
            },
            showMinLabel: false,
            showMaxLabel: false,
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: hasData ? series : [],
      dataZoom: this.widget ? null : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 5,
        moveOnMouseMove: false,
      }, {
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        left: 20,
        right: 15,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          }
        },
      }],
    };
  }

  private getLegendEntry(name: string, color: string): HashrateLegendEntry {
    return {
      name,
      inactiveColor: 'rgb(110, 112, 121)',
      textStyle: {
        color: 'white',
      },
      icon: 'roundRect',
      itemStyle: {
        color,
      },
    };
  }

  private getStoredLegendSelection(): Record<string, boolean> {
    const value = this.storageService.getValue('hashrate_difficulty_legend');
    if (!value) {
      return {};
    }

    try {
      const selected = JSON.parse(value);
      return selected && typeof selected === 'object' ? selected : {};
    } catch {
      return {};
    }
  }

  onChartInit(ec) {
    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('hashrate_difficulty_legend', JSON.stringify(e.selected));
    });
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart() {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 30;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `hashrate-difficulty-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
