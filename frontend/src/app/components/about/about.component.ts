import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  frontendGitCommitHash = this.stateService.env.GIT_COMMIT_HASH;
  packetJsonVersion = this.stateService.env.PACKAGE_JSON_VERSION;

  constructor(
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle($localize`:@@004b222ff9ef9dd4771b777950ca1d0e4cd4348a:About`);
    this.seoService.setDescription($localize`:@@meta.description.qbit-about:Information about this qbit explorer fork, source code, licensing, and third-party notices.`);
    this.ogService.setManualOgImage('about.jpg');
  }
}
