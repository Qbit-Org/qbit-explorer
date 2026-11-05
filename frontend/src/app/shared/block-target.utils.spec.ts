import { expectedBlocksForTimespan } from './block-target.utils';

describe('block target utilities', () => {
  it('scales wall-clock windows by the qbit block target', () => {
    expect(expectedBlocksForTimespan('24h', 60)).toBe(1440);
    expect(expectedBlocksForTimespan('1w', 60)).toBe(10080);
  });

  it('preserves Bitcoin-equivalent counts when configured for 600 seconds', () => {
    expect(expectedBlocksForTimespan('24h', 600)).toBe(144);
    expect(expectedBlocksForTimespan('1w', 600)).toBe(1008);
  });

  it('falls back to qbit spacing for invalid targets', () => {
    expect(expectedBlocksForTimespan('1w', 0)).toBe(10080);
  });
});
