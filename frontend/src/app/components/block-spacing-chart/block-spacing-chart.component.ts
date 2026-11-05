import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { BlockSpacingResponse } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-block-spacing-chart',
  templateUrl: './block-spacing-chart.component.html',
  styleUrls: ['./block-spacing-chart.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockSpacingChartComponent implements OnInit, OnDestroy {
  @Input() interval: '1h' | '24h' | '3d' | '1w' | '1m' | '3m' = '24h';
  @Input() height = 130;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  isLoading = true;
  isError = false;

  spacingSubscription: Subscription;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.spacingSubscription = this.apiService.getBlockSpacing$(this.interval)
      .pipe(
        catchError(() => {
          this.isError = true;
          return of(null);
        }),
      )
      .subscribe((response) => {
        if (response) {
          this.prepareChartOptions(response);
        }
        this.isLoading = false;
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.spacingSubscription?.unsubscribe();
  }

  prepareChartOptions(response: BlockSpacingResponse): void {
    const data = response.spacings.map((spacing) => ({
      value: [spacing.timestamp * 1000, spacing.spacingSeconds],
      height: spacing.height,
    }));

    this.chartOptions = {
      animation: false,
      grid: {
        top: 12,
        bottom: 20,
        right: 10,
        left: 5,
        containLabel: true,
      },
      title: data.length === 0 ? {
        textStyle: {
          color: 'grey',
          fontSize: 15,
        },
        text: $localize`No data to display yet. Try again later.`,
        left: 'center',
        top: 'center',
      } : undefined,
      tooltip: {
        show: true,
        trigger: 'axis',
        axisPointer: {
          type: 'line',
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks: any): string => {
          const tick = ticks[0];
          const date = new Date(tick.data.value[0]).toLocaleTimeString(this.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
          return `
            <b style="color: white;">${$localize`:@@block.height:Height`} ${tick.data.height}</b><br>
            ${date}<br>
            <b style="color: white;">${tick.data.value[1]} s</b>
          `;
        },
      },
      xAxis: data.length === 0 ? undefined : {
        type: 'time',
        splitNumber: 4,
        axisLabel: {
          color: 'var(--transparent-fg)',
          hideOverlap: true,
        },
        axisLine: {
          lineStyle: {
            color: 'var(--transparent-fg)',
          },
        },
      },
      yAxis: data.length === 0 ? undefined : {
        type: 'value',
        splitNumber: 3,
        axisLabel: {
          color: 'var(--transparent-fg)',
          formatter: (value: number): string => `${Math.round(value)}s`,
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          },
        },
      },
      series: data.length === 0 ? undefined : [
        {
          name: $localize`:@@mining.block-spacing:Block spacing`,
          type: 'line',
          symbol: 'none',
          data: data,
          lineStyle: {
            width: 2,
            color: '#2486eb',
          },
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            lineStyle: {
              type: 'dashed',
              color: '#FFB300',
              width: 1,
              opacity: 0.75,
            },
            label: {
              position: 'insideEndTop',
              color: 'var(--transparent-fg)',
              fontSize: 10,
              formatter: (): string => `${$localize`:@@difficulty-box.target:target`} ${response.targetSpacing}s`,
            },
            data: [{
              yAxis: response.targetSpacing,
            }],
          },
        },
      ],
    };
  }
}
