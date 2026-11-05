import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { Env, StateService } from '@app/services/state.service';
import { QbitDesignService, QbitHeaderNav, QBIT_ORIGIN } from '@app/services/qbit-design.service';

@Component({
  selector: 'app-global-footer',
  templateUrl: './global-footer.component.html',
  styleUrls: ['./global-footer.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalFooterComponent implements OnInit {
  env: Env;
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;
  qbitOrigin = QBIT_ORIGIN;
  qbitNav$: Observable<QbitHeaderNav>;

  constructor(
    public stateService: StateService,
    private qbitDesignService: QbitDesignService,
  ) {}

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.qbitNav$ = this.qbitDesignService.headerNav$;
  }

  // same semantics as the header's Dashboard links: re-clicking while already
  // home must still snap the blockchain view back to the chain tip
  dashboardClick(): void {
    this.stateService.resetScroll$.next(true);
  }
}
