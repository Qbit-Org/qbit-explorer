import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { QBIT_MAX_SUPPLY_QBT, QBIT_MAX_SUPPLY_SAT, QBIT_SATS_PER_QBT } from '@app/shared/qbit-subsidy';

const MAX_COIN_SUPPLY = QBIT_MAX_SUPPLY_QBT;
const MAX_COIN_SUPPLY_TEXT = MAX_COIN_SUPPLY.toString();
const MAX_SATOSHI_SUPPLY = QBIT_MAX_SUPPLY_SAT.toString();

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent implements OnInit {
  satoshis = 10000;
  form: FormGroup;
  isMaxSupply = false;

  constructor(
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      bitcoin: [0],
      satoshis: [0],
    });

    this.form.get('bitcoin').valueChanges.subscribe((value) => {
      const satoshisValue = this.coinsToSatoshis(value);
      const isMaxSupply = BigInt(satoshisValue) >= QBIT_MAX_SUPPLY_SAT;
      this.isMaxSupply = isMaxSupply;
      const cappedSatoshisValue = isMaxSupply ? MAX_SATOSHI_SUPPLY : satoshisValue;
      this.form.get('satoshis').setValue(cappedSatoshisValue, { emitEvent: false });
    });

    this.form.get('satoshis').valueChanges.subscribe((value) => {
      const satoshisValue = this.wholeSatoshis(value);
      if (satoshisValue === null) {
        return;
      }
      const isMaxSupply = BigInt(satoshisValue) >= QBIT_MAX_SUPPLY_SAT;
      this.isMaxSupply = isMaxSupply;
      let cappedSatoshisValue = satoshisValue;
      if (isMaxSupply) {
        cappedSatoshisValue = MAX_SATOSHI_SUPPLY;
        this.form.get('satoshis').setValue(cappedSatoshisValue, { emitEvent: false });
      }
      const bitcoinRate = isMaxSupply ? MAX_COIN_SUPPLY_TEXT : this.satoshisToCoins(cappedSatoshisValue);
      this.form.get('bitcoin').setValue(bitcoinRate, { emitEvent: false });
    });

    // Default form with 1 whole coin.
    this.form.get('bitcoin').setValue(1, { emitEvent: true });
  }

  transformInput(name: string): void {
    const formControl = this.form.get(name);
    if (!formControl.value) {
      return formControl.setValue('', {emitEvent: false});
    }
    let value = formControl.value.replace(',', '.').replace(/[^0-9.]/g, '');
    if (value === '.') {
      value = '0';
    }
    let sanitizedValue = this.removeExtraDots(value);
    if (name === 'bitcoin' && this.countDecimals(sanitizedValue) > 8) {
      sanitizedValue = this.toFixedWithoutRounding(sanitizedValue, 8);
    }
    if (sanitizedValue === '') {
      sanitizedValue = '0';
    }
    if (name === 'satoshis') {
      sanitizedValue = parseFloat(sanitizedValue).toFixed(0);
    }
    if (name === 'bitcoin' && BigInt(this.coinsToSatoshis(sanitizedValue)) > QBIT_MAX_SUPPLY_SAT) {
      sanitizedValue = MAX_COIN_SUPPLY_TEXT;
    }
    if (name === 'satoshis' && BigInt(sanitizedValue) > QBIT_MAX_SUPPLY_SAT) {
      sanitizedValue = MAX_SATOSHI_SUPPLY;
    }
    formControl.setValue(sanitizedValue, {emitEvent: true});
  }

  coinsToSatoshis(value: string | number): string {
    const normalizedValue = this.removeExtraDots(String(value).replace(',', '.').replace(/[^0-9.]/g, ''));
    const [wholeRaw, fractionalRaw = ''] = normalizedValue.split('.');
    const whole = BigInt(wholeRaw || '0');
    const fractional = BigInt((fractionalRaw + '00000000').slice(0, 8));
    return (whole * QBIT_SATS_PER_QBT + fractional).toString();
  }

  satoshisToCoins(value: string): string {
    const satoshis = BigInt(value);
    const whole = satoshis / QBIT_SATS_PER_QBT;
    const fractional = satoshis % QBIT_SATS_PER_QBT;
    return `${whole.toString()}.${fractional.toString().padStart(8, '0')}`;
  }

  wholeSatoshis(value: string | number): string | null {
    const [wholeRaw] = String(value).split('.');
    const whole = wholeRaw.replace(/[^0-9]/g, '');
    return whole ? whole : null;
  }

  removeExtraDots(str: string): string {
    const [beforeDot, afterDot] = str.split('.', 2);
    if (afterDot === undefined) {
      return str;
    }
    const afterDotReplaced = afterDot.replace(/\./g, '');
    return `${beforeDot}.${afterDotReplaced}`;
  }

  countDecimals(numberString: string): number {
    const decimalPos = numberString.indexOf('.');
    if (decimalPos === -1) {return 0;}
    return numberString.length - decimalPos - 1;
  }

  toFixedWithoutRounding(numStr: string, fixed: number): string {
    const re = new RegExp(`^-?\\d+(?:.\\d{0,${(fixed || -1)}})?`);
    const result = numStr.match(re);
    return result ? result[0] : numStr;
  }

  selectAll(event): void {
    event.target.select();
  }
}
