const mockGetCoinbaseTx = jest.fn();
const mockGetBlocksWithoutCoinbaseAddresses = jest.fn();
const mockSaveCoinbaseAddressesAndPool = jest.fn();
const mockGetPools = jest.fn();
const mockGetUnknownPool = jest.fn();
const mockMatchBlockMiner = jest.fn();
const mockMining = { reindexHashrateRequested: false };

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getCoinbaseTx: mockGetCoinbaseTx,
  },
  bitcoinCoreApi: {},
}));

jest.mock('../../repositories/BlocksRepository', () => ({
  __esModule: true,
  default: {
    $getBlocksWithoutCoinbaseAddresses: mockGetBlocksWithoutCoinbaseAddresses,
    $saveCoinbaseAddressesAndPool: mockSaveCoinbaseAddressesAndPool,
  },
}));

jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {
    $getPools: mockGetPools,
    $getUnknownPool: mockGetUnknownPool,
  },
}));

jest.mock('../../api/pools-parser', () => ({
  __esModule: true,
  default: {
    miningPools: [],
    unknownPool: { id: 0, uniqueId: 0, name: 'Unknown', slug: 'unknown' },
    matchBlockMiner: mockMatchBlockMiner,
  },
}));

jest.mock('../../api/mining/mining', () => ({
  __esModule: true,
  default: mockMining,
}));

// Keep this focused indexer test from starting services pulled in through
// Blocks' production dependency graph.
jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/websocket-handler', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/backend-info', () => ({
  __esModule: true,
  default: {},
}));

import blocks from '../../api/blocks';

describe('Blocks coinbase-address indexing', () => {
  const blockHash = '00000000000000004154fd1cdd040105bb621bbdd4b0c2589735f5846303aed9';
  const coinbaseRaw =
    '02860100040162586a04bf9246180c5e61586ab6030000000000000a636b706f6f6c172f716269742d6d696e696e672d626f6f7473747261702f';
  const payoutAddress = 'qb1zskhyrmv4vnhha252y7vc9tp5vpenfelu4uxxjlqq8dnzrgy4atcskuvgv8';
  const zeroValueAddress = 'qb1z86n7h76d2aumdgmu9vslp87n40ptznwftywpswgky3x3huhqcezquuav77';
  const unknownPool = { id: 0, uniqueId: 0, name: 'Unknown', slug: 'unknown' };
  const cornswapPool = {
    id: 12,
    uniqueId: 12,
    name: 'cornswap',
    slug: 'cornswap',
    addresses: JSON.stringify([payoutAddress]),
    regexes: JSON.stringify(['cornswap']),
    addressMatchMode: 'full_reward',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMining.reindexHashrateRequested = false;
    mockGetBlocksWithoutCoinbaseAddresses.mockResolvedValue([{
      height: 390,
      hash: blockHash,
      header: '00'.repeat(80),
      pool_id: 0,
    }]);
    mockGetPools.mockResolvedValue([cornswapPool]);
    mockGetUnknownPool.mockResolvedValue(unknownPool);
    mockGetCoinbaseTx.mockResolvedValue({
      vin: [{ scriptsig: coinbaseRaw }],
      vout: [
        {
          scriptpubkey_address: payoutAddress,
          scriptpubkey_asm: 'OP_1',
          value: 21_000_000_000,
        },
        {
          scriptpubkey_asm: 'OP_RETURN',
          value: 0,
        },
      ],
    });
    mockMatchBlockMiner.mockReturnValue(cornswapPool);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('re-matches a legacy NULL row after indexing its complete recipients', async () => {
    const refreshCachedBlocks = jest.spyOn(blocks, '$refreshCachedBlocks').mockResolvedValue();

    await blocks.$indexCoinbaseAddresses();

    expect(mockSaveCoinbaseAddressesAndPool).toHaveBeenCalledWith(
      blockHash,
      [payoutAddress],
      [{
        scriptpubkey_address: payoutAddress,
        value: 21_000_000_000,
      }],
      cornswapPool.id
    );
    expect(mockMatchBlockMiner).toHaveBeenCalledWith(
      coinbaseRaw,
      [payoutAddress],
      [cornswapPool],
      null,
      [{
        scriptpubkey_address: payoutAddress,
        scriptpubkey_asm: 'OP_1',
        value: 21_000_000_000,
      }]
    );
    expect(mockMining.reindexHashrateRequested).toBe(true);
    expect(refreshCachedBlocks).toHaveBeenCalledTimes(1);
  });

  test('does not request a reindex when exact matching keeps the assignment', async () => {
    mockGetBlocksWithoutCoinbaseAddresses.mockResolvedValue([{
      height: 390,
      hash: blockHash,
      header: '00'.repeat(80),
      pool_id: cornswapPool.id,
    }]);
    const refreshCachedBlocks = jest.spyOn(blocks, '$refreshCachedBlocks').mockResolvedValue();

    await blocks.$indexCoinbaseAddresses();

    expect(mockSaveCoinbaseAddressesAndPool).toHaveBeenCalledWith(
      blockHash,
      [payoutAddress],
      [{
        scriptpubkey_address: payoutAddress,
        value: 21_000_000_000,
      }],
      cornswapPool.id
    );
    expect(mockMining.reindexHashrateRequested).toBe(false);
    expect(refreshCachedBlocks).not.toHaveBeenCalled();
  });

  test('persists an addressless positive payout as exact negative evidence', async () => {
    mockGetCoinbaseTx.mockResolvedValue({
      vin: [{ scriptsig: coinbaseRaw }],
      vout: [
        { scriptpubkey_address: payoutAddress, value: 20_000_000_000 },
        { scriptpubkey_asm: 'OP_PUSHBYTES_33', value: 1_000_000_000 },
      ],
    });
    mockMatchBlockMiner.mockReturnValue(undefined);
    jest.spyOn(blocks, '$refreshCachedBlocks').mockResolvedValue();

    await blocks.$indexCoinbaseAddresses();

    expect(mockSaveCoinbaseAddressesAndPool).toHaveBeenCalledWith(
      blockHash,
      [payoutAddress],
      [
        { scriptpubkey_address: payoutAddress, value: 20_000_000_000 },
        { scriptpubkey_address: undefined, value: 1_000_000_000 },
      ],
      unknownPool.id
    );
  });

  test('excludes zero-value addresses from persisted payout evidence', async () => {
    mockGetCoinbaseTx.mockResolvedValue({
      vin: [{ scriptsig: coinbaseRaw }],
      vout: [
        { scriptpubkey_address: payoutAddress, scriptpubkey_asm: 'OP_1', value: 21_000_000_000 },
        { scriptpubkey_address: zeroValueAddress, value: 0 },
      ],
    });
    jest.spyOn(blocks, '$refreshCachedBlocks').mockResolvedValue();

    await blocks.$indexCoinbaseAddresses();

    expect(mockMatchBlockMiner).toHaveBeenCalledWith(
      coinbaseRaw,
      [payoutAddress],
      [cornswapPool],
      null,
      [{ scriptpubkey_address: payoutAddress, scriptpubkey_asm: 'OP_1', value: 21_000_000_000 }]
    );
    expect(mockSaveCoinbaseAddressesAndPool).toHaveBeenCalledWith(
      blockHash,
      [payoutAddress],
      [{ scriptpubkey_address: payoutAddress, value: 21_000_000_000 }],
      cornswapPool.id
    );
  });

  test('retries a failed cache refresh after the atomic row update', async () => {
    const refreshCachedBlocks = jest.spyOn(blocks, '$refreshCachedBlocks')
      .mockRejectedValueOnce(new Error('cache unavailable'))
      .mockResolvedValueOnce();

    await blocks.$indexCoinbaseAddresses();
    expect(refreshCachedBlocks).toHaveBeenCalledTimes(1);

    // The row is no longer NULL after its atomic update, but the in-memory
    // retry flag still causes the next indexing pass to refresh the cache.
    mockGetBlocksWithoutCoinbaseAddresses.mockResolvedValue([]);
    await blocks.$indexCoinbaseAddresses();

    expect(refreshCachedBlocks).toHaveBeenCalledTimes(2);
  });
});
