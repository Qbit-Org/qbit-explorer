import '@angular/localize/init';
import { getReservedWitnessVersion, ScriptpubkeyTypePipe } from './scriptpubkey-type.pipe';

describe('ScriptpubkeyTypePipe', () => {
  const pipe = new ScriptpubkeyTypePipe();

  it('renders qbit script types with friendly labels', () => {
    expect(pipe.transform('witness_v2_p2mr')).toBe('P2MR');
    expect(pipe.transform('v2_p2mr')).toBe('P2MR');
    expect(pipe.transform('anchor')).toBe('Anchor');
  });

  it('labels reserved witness v3 through v16 scripts', () => {
    expect(pipe.transform('unknown', '5302abcd')).toBe('Reserved witness v3');
    expect(pipe.transform('witness_unknown', '6002abcd')).toBe('Reserved witness v16');
    expect(pipe.transform('nonstandard', '5402abcd')).toBe('Reserved witness v4');
  });

  it('does not label non-reserved or malformed witness scripts as reserved', () => {
    expect(getReservedWitnessVersion('5220' + '00'.repeat(32))).toBeNull();
    expect(getReservedWitnessVersion('5302ab')).toBeNull();
    expect(getReservedWitnessVersion('6102abcd')).toBeNull();
    expect(pipe.transform('op_return', '5302abcd')).toBe('OP_RETURN');
  });
});
