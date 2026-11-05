import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { CpfpInfo } from '@interfaces/node-api.interface';
import { Transaction } from '@interfaces/electrs.interface';
import { feeRatePerVsize } from '@app/shared/weight-units';

@Component({
  selector: 'app-cpfp-info',
  templateUrl: './cpfp-info.component.html',
  styleUrls: ['./cpfp-info.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CpfpInfoComponent implements OnInit {
  @Input() cpfpInfo: CpfpInfo;
  @Input() tx: Transaction;

  constructor() {}

  ngOnInit(): void {}

  roundToOneDecimal(cpfpTx: any): number {
    return +feeRatePerVsize(cpfpTx.fee, cpfpTx.weight).toFixed(1);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
