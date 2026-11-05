export const BLOCK_VERSION_TOP_BITS = 0x20000000;
export const BLOCK_VERSION_TOP_MASK = 0xE0000000;
export const BLOCK_VERSION_CHAIN_ID_MASK = 0x1FFFE000;
export const BLOCK_VERSION_AUXPOW = 0x00000100;
export const BLOCK_VERSION_SIGNAL_MASK = 0x000000FF;
export const QBIT_TEST_CHAIN_AUXPOW_CHAIN_ID = 31430;
export const QBIT_MAINNET_AUXPOW_CHAIN_ID = 47;

export type QbitLane = 'permissionless' | 'auxpow';

// Mainnet uses the finalized production AuxPoW chain ID.
const EXPECTED_AUXPOW_CHAIN_IDS: Readonly<Record<string, number>> = {
  mainnet: QBIT_MAINNET_AUXPOW_CHAIN_ID,
  testnet: QBIT_TEST_CHAIN_AUXPOW_CHAIN_ID,
  testnet4: QBIT_TEST_CHAIN_AUXPOW_CHAIN_ID,
  signet: QBIT_TEST_CHAIN_AUXPOW_CHAIN_ID,
  regtest: QBIT_TEST_CHAIN_AUXPOW_CHAIN_ID,
};

export interface QbitBlockVersion {
  topBits: number;
  chainId: number;
  isAuxpow: boolean;
  signalBits: number;
  expectedChainId: number | null;
  chainIdMatchesExpected: boolean | null;
}

/**
 * Mirror of qbit core's CPureBlockHeader::IsAuxpowVersion: canonical top bits
 * plus the AuxPoW flag. Network-independent, unlike the chain-ID diagnostics.
 */
export function isAuxpowVersion(version: number): boolean {
  const unsignedVersion = version >>> 0;
  return (unsignedVersion & BLOCK_VERSION_TOP_MASK) === BLOCK_VERSION_TOP_BITS
    && (unsignedVersion & BLOCK_VERSION_AUXPOW) !== 0;
}

export function decodeQbitBlockVersion(version: number, network: string): QbitBlockVersion {
  const unsignedVersion = version >>> 0;
  const chainId = (unsignedVersion & BLOCK_VERSION_CHAIN_ID_MASK) >>> 13;
  const isAuxpow = isAuxpowVersion(unsignedVersion);
  const expectedChainId = EXPECTED_AUXPOW_CHAIN_IDS[network] ?? null;

  return {
    topBits: (unsignedVersion >>> 29) & 0x7,
    chainId,
    isAuxpow,
    signalBits: unsignedVersion & BLOCK_VERSION_SIGNAL_MASK,
    expectedChainId,
    chainIdMatchesExpected: isAuxpow && expectedChainId !== null
      ? chainId === expectedChainId
      : null,
  };
}

/**
 * Classify a qbit block into its Cadence mining lane. Keep this as a thin
 * wrapper around the canonical version decoder so callers do not grow their
 * own (and potentially stale) AuxPoW bit or network-chain-ID handling.
 */
export function laneOf(version: number, network: string): QbitLane {
  return decodeQbitBlockVersion(version, network).isAuxpow ? 'auxpow' : 'permissionless';
}
