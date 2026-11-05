import { Component, Input } from '@angular/core';
import { QbitBlockCadence } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-cadence-lane-badge',
  templateUrl: './cadence-lane-badge.component.html',
  styleUrls: ['./cadence-lane-badge.component.scss'],
  standalone: false,
})
export class CadenceLaneBadgeComponent {
  @Input() cadence?: QbitBlockCadence;
  @Input() compact = false;
  @Input() showChainId = false;

  get auxpowAriaLabel(): string {
    if (!this.cadence?.isAuxpow || !this.showChainId) {
      return $localize`:cadence.auxpow|Accessible AuxPoW mining lane label:AuxPoW lane`;
    }

    const chainId = this.cadence.chainId;
    return $localize`:cadence.auxpow-chain-id|Accessible AuxPoW mining lane label with chain ID:AuxPoW lane, chain ID ${chainId}:CHAIN_ID:`;
  }
}
