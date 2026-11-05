import { decodeQbitBlockVersion, laneOf } from '../../utils/qbit-version';

describe('qbit block version decoder', () => {
  test('flags an unexpected canonical AuxPoW chain ID without treating it as signalling bits', () => {
    expect(decodeQbitBlockVersion(0x2005E100, 'testnet4')).toEqual({
      topBits: 1,
      chainId: 47,
      isAuxpow: true,
      signalBits: 0,
      expectedChainId: 31430,
      chainIdMatchesExpected: false,
    });
  });

  test('does not treat bit 8 as AuxPoW outside the canonical top-bit shape', () => {
    expect(decodeQbitBlockVersion(0x6F58C100, 'testnet4')).toEqual({
      topBits: 3,
      chainId: 31430,
      isAuxpow: false,
      signalBits: 0,
      expectedChainId: 31430,
      chainIdMatchesExpected: null,
    });
  });

  test.each(['testnet', 'testnet4', 'signet', 'regtest'])(
    'matches the qbit test-chain AuxPoW chain ID on %s',
    (network) => expect(decodeQbitBlockVersion(0x2F58C100, network)).toEqual({
      topBits: 1,
      chainId: 31430,
      isAuxpow: true,
      signalBits: 0,
      expectedChainId: 31430,
      chainIdMatchesExpected: true,
    }),
  );

  test('keeps chain ID dynamic and isolates low signal bits', () => {
    const version = (0x20000000 | (31430 << 13) | 0x00000100 | 0x25) >>> 0;

    expect(decodeQbitBlockVersion(version, 'signet')).toEqual({
      topBits: 1,
      chainId: 31430,
      isAuxpow: true,
      signalBits: 0x25,
      expectedChainId: 31430,
      chainIdMatchesExpected: true,
    });
  });

  test('does not evaluate chain ID matches for permissionless blocks', () => {
    const version = (0x20000000 | (31430 << 13) | 0x04) >>> 0;

    expect(decodeQbitBlockVersion(version, 'regtest')).toEqual({
      topBits: 1,
      chainId: 31430,
      isAuxpow: false,
      signalBits: 0x04,
      expectedChainId: 31430,
      chainIdMatchesExpected: null,
    });
  });

  test('matches the mainnet AuxPoW chain ID', () => {
    expect(decodeQbitBlockVersion(0x2005E100, 'mainnet')).toEqual({
      topBits: 1,
      chainId: 47,
      isAuxpow: true,
      signalBits: 0,
      expectedChainId: 47,
      chainIdMatchesExpected: true,
    });
  });

  test('flags the test-chain AuxPoW chain ID on mainnet', () => {
    expect(decodeQbitBlockVersion(0x2F58C100, 'mainnet')).toEqual({
      topBits: 1,
      chainId: 31430,
      isAuxpow: true,
      signalBits: 0,
      expectedChainId: 47,
      chainIdMatchesExpected: false,
    });
  });

  test('has no expected chain ID on an unknown network', () => {
    expect(decodeQbitBlockVersion(0x2F58C100, 'unknown')).toEqual({
      topBits: 1,
      chainId: 31430,
      isAuxpow: true,
      signalBits: 0,
      expectedChainId: null,
      chainIdMatchesExpected: null,
    });
  });

  describe('laneOf', () => {
    test.each(['testnet', 'testnet4', 'signet', 'regtest'])(
      'classifies the network-aware test-chain AuxPoW version on %s',
      (network) => expect(laneOf(0x2F58C100, network)).toBe('auxpow'),
    );

    test('keeps a canonical AuxPoW block in its lane when its chain ID is unexpected', () => {
      expect(decodeQbitBlockVersion(0x2005E100, 'testnet4').chainIdMatchesExpected).toBe(false);
      expect(laneOf(0x2005E100, 'testnet4')).toBe('auxpow');
    });

    test('does not mistake a stray AuxPoW bit outside the canonical top-bit shape for the AuxPoW lane', () => {
      expect(laneOf(0x6F58C100, 'testnet4')).toBe('permissionless');
    });

    test('classifies mainnet blocks by canonical version bits whatever their chain ID', () => {
      expect(laneOf(0x2005E100, 'mainnet')).toBe('auxpow');
      expect(laneOf(0x2F58C100, 'mainnet')).toBe('auxpow');
      expect(laneOf(0x26ED4000, 'mainnet')).toBe('permissionless');
    });
  });
});
