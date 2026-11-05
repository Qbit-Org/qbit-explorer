import { parseAuxPowParentCoinbase, summarizeAuxPowHeader } from '../../utils/qbit-auxpow';
import { LUXOR_BLOCK_4214_HEADER, SEGWIT_PARENT_AUXPOW_HEADER } from '../fixtures/qbit-auxpow-headers';

describe('qbit AuxPoW parent coinbase parser', () => {
  test('recovers the Luxor parent coinbase from qbit mainnet block 4214', () => {
    const parsed = parseAuxPowParentCoinbase(LUXOR_BLOCK_4214_HEADER);

    expect(parsed).not.toBeNull();
    expect(parsed?.scriptsig).toBe(
      '036ea00e1e506f7765726564206279204c75786f7220546563682d004b05153e728701' +
      'fabe6d6d293615a0a4f915fa42cd3059296f6b3cf66998ba1f64d198ed6aaff7976e6e' +
      'f61000000000000000000020660000000000000009'
    );
    expect(Buffer.from(parsed!.scriptsig, 'hex').toString('latin1')).toContain('Powered by Luxor Tech-');
    // OP_RETURN commitments (witness, CORE, sys, RSKBLOCK) carry no address
    expect(parsed?.addresses).toEqual([
      '3K9KZZPB8NRwZVP5wNKX4VYhnswrJxpgZ4',
      '32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6',
    ]);
    // Bitcoin mainnet block 958574, proving the payload walk stayed aligned
    expect(parsed?.parentBlockHash).toBe('00000000000000000001c942edeed03c29f5f524c2b1e141ed4adf63a8ecf5e0');
  });

  test('handles a segwit-serialized parent coinbase', () => {
    const parsed = parseAuxPowParentCoinbase(SEGWIT_PARENT_AUXPOW_HEADER);

    expect(parsed).not.toBeNull();
    expect(parsed?.scriptsig).toBe('036ea00e506f7765726564206279204c75786f7220546563682d');
    expect(parsed?.addresses).toEqual(['32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6']);
    expect(parsed?.parentBlockHash).toBe('14508459b221041eab257d2baaa7459775ba748246c8403609eb708f0e57e74b');
  });

  test('returns null for a bare 80-byte AuxPoW header', () => {
    expect(parseAuxPowParentCoinbase('00e10520' + '00'.repeat(76))).toBeNull();
  });

  test('returns null for a permissionless version even with trailing payload', () => {
    // canonical top bits but no AuxPoW flag
    expect(parseAuxPowParentCoinbase('00000020' + '00'.repeat(200))).toBeNull();
  });

  test('returns null for a truncated AuxPoW payload', () => {
    expect(parseAuxPowParentCoinbase(LUXOR_BLOCK_4214_HEADER.slice(0, -2))).toBeNull();
  });

  test('returns null when the payload has trailing bytes beyond the parent header', () => {
    expect(parseAuxPowParentCoinbase(LUXOR_BLOCK_4214_HEADER + 'ab')).toBeNull();
  });

  test('summarizes the parent data under explorer field names', () => {
    expect(summarizeAuxPowHeader(LUXOR_BLOCK_4214_HEADER)).toEqual({
      parentBlockHash: '00000000000000000001c942edeed03c29f5f524c2b1e141ed4adf63a8ecf5e0',
      // 'Powered by Luxor Tech-'
      parentCoinbaseRaw: expect.stringContaining('506f7765726564206279204c75786f7220546563682d'),
      parentCoinbaseAddresses: [
        '3K9KZZPB8NRwZVP5wNKX4VYhnswrJxpgZ4',
        '32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6',
      ],
    });
    expect(summarizeAuxPowHeader('00000020' + '00'.repeat(200))).toBeNull();
    expect(summarizeAuxPowHeader(null)).toBeNull();
  });

  test('returns null for missing or malformed hex', () => {
    expect(parseAuxPowParentCoinbase(null)).toBeNull();
    expect(parseAuxPowParentCoinbase(undefined)).toBeNull();
    expect(parseAuxPowParentCoinbase('')).toBeNull();
    expect(parseAuxPowParentCoinbase(LUXOR_BLOCK_4214_HEADER.slice(0, -1))).toBeNull(); // odd length
    expect(parseAuxPowParentCoinbase('zz'.repeat(120))).toBeNull();
  });
});
