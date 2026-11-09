const mockGetHistory = jest.fn();

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

// newest first, as both backends page it: the unconfirmed C, then B and A
const HISTORY = [
  { tx_hash: txid('a'), height: 100 },
  { tx_hash: txid('c'), height: 0, fee: 200 },
  { tx_hash: txid('b'), height: 200 },
];
// a transaction the node has that is not in the address's history
const UNRELATED = txid('d');
// Core's answer for a transaction it does not have
const NOT_FOUND = 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.';

describe('electrum backend address history pages', () => {
  let api: BitcoindElectrsApi;
  let getRawTransaction: jest.SpyInstance;
  let nodeError: Error | null;

  beforeEach(() => {
    jest.clearAllMocks();
    nodeError = null;
    api = new BitcoindElectrsApi({
      validateAddress: jest.fn().mockResolvedValue({ isvalid: true, address: ADDRESS, scriptPubKey: '5220' + '00'.repeat(32) }),
    });
    mockGetHistory.mockImplementation(async () => HISTORY.map(entry => ({ ...entry })));
    const known = new Set([...HISTORY.map(entry => entry.tx_hash), UNRELATED]);
    getRawTransaction = jest.spyOn(api, '$getRawTransaction').mockImplementation(async (id: string) => {
      if (nodeError) {
        throw nodeError;
      }
      if (!known.has(id)) {
        throw new Error(NOT_FOUND);
      }
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

    test('starts with the newest transaction', async () => {
      await expect(txids()).resolves.toEqual([txid('c'), txid('b'), txid('a')]);
    });

    test('continues after the newest transaction without repeating it', async () => {
      await expect(txids(txid('c'))).resolves.toEqual([txid('b'), txid('a')]);
    });

    test('continues after an older transaction', async () => {
      await expect(txids(txid('b'))).resolves.toEqual([txid('a')]);
      await expect(txids(txid('a'))).resolves.toEqual([]);
    });

    test('answers an empty page, as esplora does, for a transaction outside the history', async () => {
      await expect(txids(UNRELATED)).resolves.toEqual([]);
    });

    test('answers 422, as esplora does, for a transaction the node does not have', async () => {
      const error = await lookup(txid('e')).catch((e) => e);

      expect(getAddressLookupError(error)).toEqual({ status: 422, reason: 'after_txid not found' });
    });

    test('does not answer 422 when the node cannot be asked', async () => {
      nodeError = new Error('connect ECONNREFUSED 127.0.0.1:8352');

      const error = await lookup(txid('e')).catch((e) => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('connect ECONNREFUSED 127.0.0.1:8352');
      expect(getAddressLookupError(error)).toBeUndefined();
    });
  });

  test('asks the node only for an after_txid outside the history', async () => {
    await api.$getAddressTransactions(ADDRESS, txid('c'));
    expect(getRawTransaction).not.toHaveBeenCalledWith(txid('c'), true);

    await api.$getAddressTransactions(ADDRESS, UNRELATED);
    expect(getRawTransaction).toHaveBeenCalledWith(UNRELATED, true);
  });
});
