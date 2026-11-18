import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Runestone, Etching } from '@app/shared/ord/rune.utils';
import { Inscription } from '@app/shared/ord/inscription.utils';

@Component({
  selector: 'app-ord-data',
  templateUrl: './ord-data.component.html',
  styleUrls: ['./ord-data.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdDataComponent implements OnChanges {
  @Input() inscriptions: Inscription[];
  @Input() runestone: Runestone;
  @Input() runeInfo: { [id: string]: { etching: Etching; txid: string } };
  @Input() type: 'vin' | 'vout';
  @Input() pins = false;

  toNumber = (value: bigint): number => Number(value);

  // Inscriptions
  inscriptionsData: { [key: string]: { type: string; count: number, totalSize: number, text?: string; json?: JSON; tag?: string; delegate?: string; encoding?: string } };
  // P2MR Inscriptions with an unknown even tag (PINS-1 section 5.4): counted apart, their content is not read
  opaqueData: { count: number, totalSize: number } | null = null;
  // Rune mints
  minted: number;
  // Rune transfers
  transferredRunes: { key: string; etching: Etching; txid: string }[] = [];

  constructor() { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.runestone && this.runestone) {
      if (this.runestone.mint && this.runeInfo[this.runestone.mint.toString()]) {
        const mint = this.runestone.mint.toString();
        const terms = this.runeInfo[mint].etching?.terms;
        const amount = terms?.amount;
        const divisibility = this.runeInfo[mint].etching?.divisibility;
        if (amount) {
          this.minted = this.getAmount(amount, divisibility);
        }
      }

      this.runestone.edicts.forEach(edict => {
        if (this.runeInfo[edict.id.toString()]) {
          this.transferredRunes.push({ key: edict.id.toString(), ...this.runeInfo[edict.id.toString()] });
        }
      });
    }

    if (changes.inscriptions && this.inscriptions) {

      if (this.inscriptions?.length) {
        // one group for each content type and encoding; both are any string a transaction writes, "__proto__" included
        this.inscriptionsData = Object.create(null);
        this.opaqueData = null;
        this.inscriptions.forEach((inscription) => {
          if (inscription.opaque) {
            this.opaqueData = this.opaqueData || { count: 0, totalSize: 0 };
            this.opaqueData.count++;
            this.opaqueData.totalSize += inscription.body_length;
            return;
          }

          // General: count, total size, delegate
          const type = inscription.content_type_str || 'undefined';
          // a P2MR Inscription's encoded body (content_encoding, PINS-1 section 8) is not decoded here, so it is kept apart
          // from plain bodies of the same content type and is not shown as text
          const key = JSON.stringify([type, inscription.content_encoding || '']);
          if (!this.inscriptionsData[key]) {
            this.inscriptionsData[key] = { type, count: 0, totalSize: 0 };
          }
          this.inscriptionsData[key].count++;
          this.inscriptionsData[key].totalSize += inscription.body_length;
          if (inscription.delegate_txid && !this.inscriptionsData[key].delegate) {
            this.inscriptionsData[key].delegate = inscription.delegate_txid;
          }
          if (inscription.content_encoding) {
            this.inscriptionsData[key].encoding = inscription.content_encoding;
            return;
          }

          // Text / JSON data
          if ((type.includes('text') || type.includes('json')) && !inscription.is_cropped && !this.inscriptionsData[key].text && !this.inscriptionsData[key].json) {
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(inscription.body);
            try {
              this.inscriptionsData[key].json = JSON.parse(text);
              if (this.inscriptionsData[key].json['p']) {
                this.inscriptionsData[key].tag = this.inscriptionsData[key].json['p'].toUpperCase();
              }
            } catch (e) {
              this.inscriptionsData[key].text = text;
            }
          }
        });
      }
    }
  }

  getAmount(amount: bigint, divisibility: number): number {
    const divisor = BigInt(10) ** BigInt(divisibility);
    const result = amount / divisor;

    return result <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(result) : Number.MAX_SAFE_INTEGER;
  }
}
