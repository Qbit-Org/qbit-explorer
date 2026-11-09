const mockGetHistory = jest.fn();
const mockMempool: Record<string, unknown> = {};

jest.mock('@mempool/electrum-client', () => jest.fn().mockImplementation(() => ({
  initElectrum: jest.fn().mockResolvedValue(undefined),
  blockchainScripthash_getHistory: mockGetHistory,
})));

jest.mock('../../api/memory-cache', () => ({
  __esModule: true,
  default: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
}));

jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: {
    getMempool: (): Record<string, unknown> => mockMempool,
  },
}));

// the paths tested here do not use blocks, whose dependency graph starts timers
jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: {},
}));

// load the factory first, as the backend does: BitcoinApi's imports lead back
// to it, and it constructs a BitcoinApi
import '../../api/bitcoin/bitcoin-api-factory';
import BitcoindElectrsApi from '../../api/bitcoin/electrum-api';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { getAddressLookupError } from '../../utils/api';

const ADDRESS = 'qb1zjrtrlj26qhlr0qze7x9fszx0aa8k268d48n3gmc097zjugk87qrsq9l22h';
const SCRIPTHASH = 'ab'.repeat(32);
const txid = (fill: string): string => fill.repeat(64);

// as an Electrum server lists it: the confirmed A and B, then the unconfirmed
// C (height 0) and D (height -1: it spends an unconfirmed output)
const HISTORY = [
  { tx_hash: txid('a'), height: 100 },
  { tx_hash: txid('b'), height: 200 },
  { tx_hash: txid('c'), height: 0, fee: 200 },
  { tx_hash: txid('d'), height: -1, fee: 300 },
];
// unconfirmed first, then by height, newest first, with the txid breaking ties
const NEWEST_FIRST = [txid('c'), txid('d'), txid('b'), txid('a')];
// a transaction the node has that is not in the history
const UNRELATED = txid('9');

// Core's getrawtransaction answers for a transaction it cannot return
const NOT_FOUND = 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.';
const TXINDEX_BUILDING = 'No such mempool transaction. Blockchain transactions are still in the process of being indexed. Use gettransaction for wallet transactions.';
const TXINDEX_DISABLED = 'No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries. Use gettransaction for wallet transactions.';

describe('electrum backend address history pages', () => {
  let api: BitcoindElectrsApi;
  let node: { validateAddress: jest.Mock, getRawTransaction: jest.Mock };
  let nodeError: Error | null;
  // the transactions the node has
  let known: Set<string>;

  beforeEach(() => {
    jest.clearAllMocks();
    nodeError = null;
    for (const id of Object.keys(mockMempool)) {
      delete mockMempool[id];
    }
    known = new Set([...HISTORY.map(entry => entry.tx_hash), UNRELATED]);
    node = {
      validateAddress: jest.fn().mockResolvedValue({ isvalid: true, address: ADDRESS, scriptPubKey: '5220' + '00'.repeat(32) }),
      getRawTransaction: jest.fn(async (id: string) => {
        if (nodeError) {
          throw nodeError;
        }
        if (!known.has(id)) {
          throw new Error(NOT_FOUND);
        }
        return '02000000';
      }),
    };
    api = new BitcoindElectrsApi(node);
    mockGetHistory.mockImplementation(async () => HISTORY.map(entry => ({ ...entry })));
    // a page's transactions, as the node returns them, without their decoding
    jest.spyOn(api, '$getRawTransaction').mockImplementation(async (id: string) => {
      await node.getRawTransaction(id, true);
      return { txid: id } as IEsploraApi.Transaction;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const lookups: [string, (after?: string) => Promise<IEsploraApi.Transaction[]>][] = [
    ['address', (after) => api.$getAddressTransactions(ADDRESS, after)],
    ['scripthash', (after) => api.$getScriptHashTransactions(SCRIPTHASH, after)],
  ];

  describe.each(lookups)('by %s', (_, lookup) => {
    const txids = async (after?: string): Promise<string[]> => (await lookup(after)).map(tx => tx.txid);

    test('starts with the unconfirmed transactions, then the newest confirmed one', async () => {
      await expect(txids()).resolves.toEqual(NEWEST_FIRST);
    });

    test('continues after the newest transaction without repeating it', async () => {
      await expect(txids(txid('c'))).resolves.toEqual(NEWEST_FIRST.slice(1));
    });

    test('continues after an older transaction', async () => {
      await expect(txids(txid('b'))).resolves.toEqual([txid('a')]);
      await expect(txids(txid('a'))).resolves.toEqual([]);
    });

    test('answers an empty page, as esplora does, for a transaction outside the history', async () => {
      await expect(txids(UNRELATED)).resolves.toEqual([]);
      // the hex is enough to tell the transaction exists
      expect(node.getRawTransaction).toHaveBeenCalledWith(UNRELATED, false);
      expect(node.getRawTransaction).not.toHaveBeenCalledWith(UNRELATED, true);
    });

    test('answers 422, as esplora does, for a transaction the node does not have', async () => {
      const error = await lookup(txid('e')).catch((e) => e);

      expect(getAddressLookupError(error)).toEqual({ status: 422, reason: 'after_txid not found' });
    });

    test.each([
      TXINDEX_BUILDING,
      TXINDEX_DISABLED,
      'connect ECONNREFUSED 127.0.0.1:8352',
    ])('does not answer 422 when the node answers %p', async (message) => {
      nodeError = new Error(message);

      const error = await lookup(txid('e')).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(message);
      expect(getAddressLookupError(error)).toBeUndefined();
    });
  });

  test('takes an after_txid in the mempool as known without asking the node', async () => {
    mockMempool[UNRELATED] = { txid: UNRELATED };

    await expect(api.$getAddressTransactions(ADDRESS, UNRELATED)).resolves.toEqual([]);

    expect(node.getRawTransaction).not.toHaveBeenCalled();
  });

  test('leaves the cached history in the order the server listed it', async () => {
    const listed = HISTORY.map(entry => ({ ...entry }));
    mockGetHistory.mockResolvedValue(listed);

    await api.$getAddressTransactions(ADDRESS);

    expect(listed).toEqual(HISTORY);
  });

  test('pages a history alike whatever order the server lists it in', async () => {
    // 12 transactions confirmed in the same block, listed in a different order each time
    const block = Array.from({ length: 12 }, (_, i) => ({ tx_hash: i.toString(16).repeat(64), height: 150 }));
    block.forEach(entry => known.add(entry.tx_hash));
    let listing = 0;
    mockGetHistory.mockImplementation(async () => {
      listing++;
      return listing % 2 ? [...block] : [...block].reverse();
    });

    const first = (await api.$getAddressTransactions(ADDRESS)).map(tx => tx.txid);
    const second = (await api.$getAddressTransactions(ADDRESS, first[first.length - 1])).map(tx => tx.txid);

    expect(first).toHaveLength(10);
    expect([...first, ...second].sort()).toEqual(block.map(entry => entry.tx_hash).sort());
  });
});
