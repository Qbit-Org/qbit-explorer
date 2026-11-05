import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { DifficultyAdjustment, LaneDifficulty } from '@interfaces/node-api.interface';

interface LaneDifficultyView {
  label: string;
  difficulty: number;
  change24h: number | null;
  color24h: string;
}

interface DifficultyState {
  currentDifficulty: number;
  currentBitsHex: string;
  timeAvg: number;              // ms
  targetSpacingSeconds: number;
  change24h: number;
  color24h: string;
  lanes: LaneDifficultyView[] | null;
}

@Component({
  selector: 'app-difficulty',
  templateUrl: './difficulty.component.html',
  styleUrls: ['./difficulty.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyComponent implements OnInit {
  @Input() showTitle = true;
  @Input() showChart = true;

  isLoadingWebSocket$: Observable<boolean>;
  difficulty$: Observable<DifficultyState>;

  readonly permissionlessLabel = $localize`:cadence.permissionless|Permissionless mining lane label:Permissionless`;
  readonly auxpowLabel = $localize`:cadence.auxpow|AuxPoW mining lane label:AuxPoW`;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.difficulty$ = this.stateService.difficultyAdjustment$.pipe(
      map((da) => {
        return {
          currentDifficulty: da.currentDifficulty,
          currentBitsHex: '0x' + da.currentBits.toString(16).padStart(8, '0'),
          timeAvg: da.timeAvgMs,
          targetSpacingSeconds: da.targetSpacingMs / 1000,
          change24h: da.change24h,
          color24h: this.changeColor(da.change24h),
          lanes: this.buildLaneViews(da),
        };
      })
    );
  }

  private buildLaneViews(da: DifficultyAdjustment): LaneDifficultyView[] | null {
    if (!da.lanes || (!da.lanes.permissionless && !da.lanes.auxpow)) {
      return null;
    }
    const views: LaneDifficultyView[] = [];
    if (da.lanes.permissionless) {
      views.push(this.buildLaneView(this.permissionlessLabel, da.lanes.permissionless));
    }
    if (da.lanes.auxpow) {
      views.push(this.buildLaneView(this.auxpowLabel, da.lanes.auxpow));
    }
    return views;
  }

  private buildLaneView(label: string, lane: LaneDifficulty): LaneDifficultyView {
    return {
      label,
      difficulty: lane.difficulty,
      change24h: lane.change24h,
      color24h: this.changeColor(lane.change24h),
    };
  }

  private changeColor(change24h: number | null): string {
    if (change24h > 0) {
      return 'var(--green)';
    }
    if (change24h < 0) {
      return 'var(--red)';
    }
    return 'var(--transparent-fg)';
  }
}
