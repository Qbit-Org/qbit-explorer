const mockDbQuery = jest.fn();
const mockGetBlockHeader = jest.fn();
const mockGetPools = jest.fn();
const mockGetUnknownPool = jest.fn();
const mockGetPoolByUniqueId = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('../../database', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    DATABASE: {
      ENABLED: true,
    },
    MEMPOOL: {
      NETWORK: 'testnet4',
    },
  },
}));

jest.mock('../../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: {
    getBlockHeader: mockGetBlockHeader,
  },
}));

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {},
  bitcoinCoreApi: {},
}));

jest.mock('../../api/common', () => ({
  __esModule: true,
  Common: {},
}));

jest.mock('../../repositories/PoolsRepository', () => ({
  __esModule: true,
  default: {
    $getPools: mockGetPools,
    $getUnknownPool: mockGetUnknownPool,
    $getPoolByUniqueId: mockGetPoolByUniqueId,
  },
}));

jest.mock('../../repositories/HashratesRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../repositories/BlocksSummariesRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../repositories/BlocksAuditsRepository', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/chain-tips', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/disk-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/redis-cache', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../api/mining/mining', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('../../tasks/pools-updater', () => ({
  __esModule: true,
  default: {
    currentSha: 'qbit-testsha',
  },
}));

jest.mock('../../api/transaction-utils', () => ({
  __esModule: true,
  default: {
    // faithful copy of TransactionUtils.hex2ascii so coinbase tag matching
    // behaves like production
    hex2ascii: jest.fn((hex: string) => {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return str;
    }),
  },
}));

jest.mock('../../logger', () => ({
  __esModule: true,
  default: {
    debug: jest.fn(),
    err: jest.fn(),
    info: jest.fn(),
    notice: jest.fn(),
    warn: mockLoggerWarn,
    tags: {
      mining: 'mining',
    },
  },
}));

import BlocksRepository from '../../repositories/BlocksRepository';
import { LUXOR_BLOCK_4214_HEADER } from '../fixtures/qbit-auxpow-headers';

describe('BlocksRepository lazy migration to v2 (truncated AuxPoW headers)', () => {
  const luxorAuxpowBlockHash = '196368e129d102606180225fe67baee0ede4f82fc192e0f71f3305ac0c36a9bf';
  const truncatedHeader = LUXOR_BLOCK_4214_HEADER.slice(0, 160);

  const pools = [
    { id: 5, uniqueId: 1, name: 'Prism Pool', slug: 'prismpool', addresses: '[]', regexes: '["/PRISM Pool/"]', parentAddresses: null, parentRegexes: null },
    {
      id: 6, uniqueId: 2, name: 'Luxor', slug: 'luxor',
      addresses: '["qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7"]', regexes: '[]',
      parentAddresses: '["1MkCDCzHpBsYQivp8MxjY5AkTGG1f2baoe","39bitUyBcUu3y3hRTtYprKbTp712t4ZWqK","32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6"]',
      parentRegexes: '["/LUXOR/","Luxor Tech"]',
    },
  ];

  const mockSelects = (corruptRows: any[]): void => {
    mockDbQuery.mockImplementation(async (sql: any) => {
      const text = typeof sql === 'string' ? sql : sql.sql;
      if (text.includes('index_version < 1')) {
        return [[]]; // v1 fee migration has nothing to do
      }
      if (text.includes('index_version < 2')) {
        return [corruptRows];
      }
      return [{}];
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPools.mockResolvedValue(pools);
    mockGetUnknownPool.mockResolvedValue({ id: 0, uniqueId: 0, name: 'Unknown', slug: 'unknown' });
  });

  test('repairs a truncated AuxPoW header and re-attributes the block to Luxor', async () => {
    mockSelects([{
      height: 4214,
      hash: luxorAuxpowBlockHash,
      coinbase_raw: '02761000',
      coinbase_addresses: '["qb1zgxwrmumwzvyk0jawp708eat70dzdrhyz80q83vypp9r8cj7e9ucqlwfe8r"]',
      header: truncatedHeader,
    }]);
    mockGetBlockHeader.mockResolvedValue(LUXOR_BLOCK_4214_HEADER);

    const migrated = await BlocksRepository.$migrateBlocks();

    expect(migrated).toBe(1);
    expect(mockGetBlockHeader).toHaveBeenCalledWith(luxorAuxpowBlockHash, false);
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET index_version = 2'),
      [LUXOR_BLOCK_4214_HEADER, 6, luxorAuxpowBlockHash]
    );
  });

  test('skips rows the node cannot serve yet and repairs the rest', async () => {
    const unavailableHash = 'deadbeef'.repeat(8);
    mockSelects([
      { height: 4300, hash: unavailableHash, coinbase_raw: '02cc1000', coinbase_addresses: null, header: truncatedHeader },
      { height: 4214, hash: luxorAuxpowBlockHash, coinbase_raw: '02761000', coinbase_addresses: null, header: truncatedHeader },
    ]);
    mockGetBlockHeader.mockImplementation(async (hash: string) => {
      if (hash === unavailableHash) {
        throw new Error('Block not found');
      }
      return LUXOR_BLOCK_4214_HEADER;
    });

    const migrated = await BlocksRepository.$migrateBlocks();

    expect(migrated).toBe(1);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockDbQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('SET index_version = 2'),
      expect.arrayContaining([expect.anything(), expect.anything(), unavailableHash])
    );
    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringContaining('SET index_version = 2'),
      [LUXOR_BLOCK_4214_HEADER, 6, luxorAuxpowBlockHash]
    );
  });

  test('keeps a row pending when the node still returns only a bare header', async () => {
    mockSelects([{
      height: 4214,
      hash: luxorAuxpowBlockHash,
      coinbase_raw: '02761000',
      coinbase_addresses: null,
      header: truncatedHeader,
    }]);
    mockGetBlockHeader.mockResolvedValue(truncatedHeader);

    const migrated = await BlocksRepository.$migrateBlocks();

    expect(migrated).toBe(0);
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('still misses its AuxPoW payload'));
    expect(mockDbQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('SET index_version = 2'),
      expect.anything()
    );
  });

  test('keeps a row pending when the replacement AuxPoW payload is malformed', async () => {
    mockSelects([{
      height: 4214,
      hash: luxorAuxpowBlockHash,
      coinbase_raw: '02761000',
      coinbase_addresses: null,
      header: truncatedHeader,
    }]);
    mockGetBlockHeader.mockResolvedValue(`${truncatedHeader}00`);

    const migrated = await BlocksRepository.$migrateBlocks();

    expect(migrated).toBe(0);
    expect(mockLoggerWarn).toHaveBeenCalledWith(expect.stringContaining('invalid AuxPoW payload'));
    expect(mockDbQuery).not.toHaveBeenCalledWith(
      expect.stringContaining('SET index_version = 2'),
      expect.anything()
    );
  });

  test('does nothing when no truncated AuxPoW rows remain', async () => {
    mockSelects([]);

    const migrated = await BlocksRepository.$migrateBlocks();

    expect(migrated).toBe(0);
    expect(mockGetBlockHeader).not.toHaveBeenCalled();
  });
});

describe('BlocksRepository coinbase recipient persistence', () => {
  test('stores exact positive payout evidence on newly indexed blocks', async () => {
    jest.clearAllMocks();
    const address = 'qb1qrecipient';
    const payouts = [
      { scriptpubkey_address: address, value: 20_000_000_000 },
      { value: 1_000_000_000 },
    ];
    mockGetPoolByUniqueId.mockResolvedValue({ id: 12 });
    mockDbQuery.mockResolvedValue([{}]);

    await BlocksRepository.$saveBlockInDatabase({
      id: '00'.repeat(32),
      height: 390,
      timestamp: 1_700_000_000,
      size: 200,
      weight: 200,
      tx_count: 1,
      difficulty: 1,
      version: 0,
      bits: 0,
      nonce: 0,
      merkle_root: '11'.repeat(32),
      previousblockhash: '22'.repeat(32),
      mediantime: 1_700_000_000,
      stale: false,
      extras: {
        pool: { id: 12 },
        coinbaseRaw: '02860100',
        coinbaseAddress: address,
        coinbaseAddresses: [address],
        coinbaseSignature: null,
        coinbaseSignatureAscii: null,
        feeRange: [],
        header: '00'.repeat(80),
        firstSeen: null,
      },
    } as any, payouts);

    const [query, params] = mockDbQuery.mock.calls[0];
    expect(query).toContain('coinbase_payouts');
    expect((query.match(/\?/g) || []).length).toBe(params.length);
    expect(params[24]).toBe(JSON.stringify(payouts));
  });

  test('atomically stores recipients, pool, and the active definition hash', async () => {
    jest.clearAllMocks();
    const hash = '00'.repeat(32);
    const addresses = ['qb1qrecipient'];
    const payouts = [{ scriptpubkey_address: addresses[0], value: 21_000_000_000 }];
    mockDbQuery.mockResolvedValue([{}]);

    await BlocksRepository.$saveCoinbaseAddressesAndPool(hash, addresses, payouts, 12);

    expect(mockDbQuery).toHaveBeenCalledWith(
      expect.stringMatching(/SET coinbase_addresses = \?, coinbase_payouts = \?, pool_id = \?, definition_hash = \?/),
      [JSON.stringify(addresses), JSON.stringify(payouts), 12, 'qbit-testsha', hash]
    );
  });
});
