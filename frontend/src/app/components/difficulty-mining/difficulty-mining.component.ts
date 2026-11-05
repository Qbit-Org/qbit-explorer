import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { DifficultyAdjustment, LaneDifficulty } from '@interfaces/node-api.interface';
import {
  QBIT_SUBSIDY_STEPDOWN_PERCENT,
  getBlocksUntilNextStepdown,
  getNextStepdownHeight,
  getQbitSubsidySat,
  getQbitSubsidyStepInterval,
  getStepdownIndex,
} from '@app/shared/qbit-subsidy';

interface LaneDifficultyView {
  label: string;
  difficulty: number;
  change24h: number | null;
  color24h: string;
}

interface MiningDifficultyState {
  currentDifficulty: number;
  timeAvg: number;              // ms
  adjustedTimeAvg: number;      // ms
  targetSpacingSeconds: number;
  change24h: number;
  color24h: string;
  lanes: LaneDifficultyView[] | null;
  blocksUntilStepdown: number;
  currentSubsidySat: number;
  nextSubsidySat: number;
  stepdownPercent: number;
  stepdownIndex: number;
  timeUntilStepdown: number;
}

@Component({
  selector: 'app-difficulty-mining',
  templateUrl: './difficulty-mining.component.html',
  styleUrls: ['./difficulty-mining.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyMiningComponent implements OnInit {
  isLoadingWebSocket$: Observable<boolean>;
  difficulty$: Observable<MiningDifficultyState>;
  now = new Date().getTime();

  @Input() showStepdown = false;
  @Input() showTitle = true;

  readonly permissionlessLabel = $localize`:cadence.permissionless|Permissionless mining lane label:Permissionless`;
  readonly auxpowLabel = $localize`:cadence.auxpow|AuxPoW mining lane label:AuxPoW`;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.difficulty$ = combineLatest([
      this.stateService.blocks$,
      this.stateService.difficultyAdjustment$,
    ])
    .pipe(
      map(([blocks, da]) => {
        const maxHeight = blocks.reduce((max, block) => Math.max(max, block.height), 0);

        const stepInterval = getQbitSubsidyStepInterval(this.stateService.network);
        const blocksUntilStepdown = getBlocksUntilNextStepdown(maxHeight, stepInterval);
        const timeUntilStepdown = new Date().getTime() + (blocksUntilStepdown * this.stateService.env.BLOCK_TARGET_SPACING_SECONDS * 1000);
        this.now = new Date().getTime();
        const stepdownHeight = getNextStepdownHeight(maxHeight, stepInterval);

        return {
          currentDifficulty: da.currentDifficulty,
          timeAvg: da.timeAvgMs,
          adjustedTimeAvg: da.adjustedTimeAvg,
          targetSpacingSeconds: da.targetSpacingMs / 1000,
          change24h: da.change24h,
          color24h: this.changeColor(da.change24h),
          lanes: this.buildLaneViews(da),
          blocksUntilStepdown,
          currentSubsidySat: Number(getQbitSubsidySat(maxHeight, stepInterval)),
          nextSubsidySat: Number(getQbitSubsidySat(stepdownHeight, stepInterval)),
          stepdownPercent: QBIT_SUBSIDY_STEPDOWN_PERCENT,
          stepdownIndex: getStepdownIndex(stepdownHeight, stepInterval),
          timeUntilStepdown,
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
