import { Pipe, PipeTransform } from '@angular/core';
import { formatScriptPubKeyType, getReservedWitnessVersion } from '@app/shared/scriptpubkey-type.utils';

export { formatScriptPubKeyType, getReservedWitnessVersion };

@Pipe({
  name: 'scriptpubkeyType',
  standalone: false,
})
export class ScriptpubkeyTypePipe implements PipeTransform {

  transform(value: string | null | undefined, scriptpubkey?: string | null): string {
    return formatScriptPubKeyType(value, scriptpubkey);
  }

}
