jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getRawTransaction: jest.fn(),
    $getTxIdsForBlock: jest.fn(),
  },
  bitcoinCoreApi: {
    $getRawTransaction: jest.fn(),
  },
}));

// the block's other transactions would come from the mempool; the coinbase never does
jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: { getMempool: (): Record<string, never> => ({}) },
}));

// Keep the services in Blocks' dependency graph from starting, as blocks-update.test.ts does
jest.mock('../../api/disk-cache', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/redis-cache', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/websocket-handler', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/backend-info', () => ({ __esModule: true, default: {} }));
jest.mock('../../repositories/PoolsRepository', () => ({ __esModule: true, default: {} }));

import bitcoinApi, { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import blocks from '../../api/blocks';
import config from '../../config';
import logger from '../../logger';
import { TransactionExtended } from '../../mempool.interfaces';

const esploraApi = bitcoinApi as unknown as Record<'$getRawTransaction' | '$getTxIdsForBlock', jest.Mock>;
const coreApi = bitcoinCoreApi as unknown as Record<'$getRawTransaction', jest.Mock>;
const getTransactionsExtended = (blocks as unknown as {
  $getTransactionsExtended: (blockHash: string, blockHeight: number, blockTime: number, onlyCoinbase: boolean,
    txIds?: string[] | null, quiet?: boolean, addMempoolData?: boolean) => Promise<TransactionExtended[]>
}).$getTransactionsExtended.bind(blocks);

// qbit mainnet block 163,891 and its coinbase, cut down to what fetching it reads
const BLOCK_HASH = '00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401';
const HEIGHT = 163891;
const TIME = 1793837000;
const COINBASE_TXID = '4a60e113576e895adf6e21011c47a21bf680a52321f4526d762d35316e4ecd64';
const coinbase = (): unknown => ({
  txid: COINBASE_TXID, version: 2, locktime: 0, size: 300, weight: 300, fee: 0, sigops: 0,
  vin: [{ txid: '00'.repeat(32), vout: 0xffffffff, prevout: null, scriptsig: '0333800200', scriptsig_asm: '', witness: [], is_coinbase: true, sequence: 0xffffffff }],
  vout: [{ value: 21000000000, scriptpubkey: '5220' + 'ab'.repeat(32), scriptpubkey_asm: '', scriptpubkey_type: 'v2_p2mr' }],
  status: { confirmed: true, block_height: HEIGHT, block_hash: BLOCK_HASH, block_time: TIME },
});

// How the esplora backend surfaces an electrs error: axios rejects with electrs's status and plain-text reason
const electrsError = (status: number, reason?: string): Error =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: reason } });
// What qbit-electrs answers for a block's coinbase in the second after qbitd announces the block
const NOT_INDEXED_YET = 'Request failed with status code 404';
const notIndexedYet = (): Error => electrsError(404, 'Transaction not found');
const CORE_NOT_FOUND = 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.';
// What $getTransactionExtendedRetry logs before it asks qbitd. A caller words its own error differently.
const retrying = (reason: string): string => `Cannot fetch tx ${COINBASE_TXID} from the backend, retrying with qbitd. Reason: ${reason}`;

// The two ways blocks.ts fetches a block's transactions: the sync loop, for a new block, with its txids and the
// mempool, and indexing, for the coinbase alone. Each reports a failed fetch in its own words.
const callers: [string, () => Promise<TransactionExtended[]>, string][] = [
  ['a new block', () => getTransactionsExtended(BLOCK_HASH, HEIGHT, TIME, false, [COINBASE_TXID], false, true), 'Cannot fetch tx'],
  ['an indexed block', () => getTransactionsExtended(BLOCK_HASH, HEIGHT, TIME, true, null, true), 'Cannot fetch coinbase tx'],
];

describe.each(callers)('the coinbase of %s under the esplora backend', (_caller, fetchTransactions, failure) => {
  const backend = config.MEMPOOL.BACKEND;

  beforeEach(() => {
    jest.clearAllMocks();
    config.MEMPOOL.BACKEND = 'esplora';
    esploraApi.$getTxIdsForBlock.mockResolvedValue([COINBASE_TXID]);
    esploraApi.$getRawTransaction.mockRejectedValue(notIndexedYet());
  });

  afterAll(() => {
    config.MEMPOOL.BACKEND = backend;
  });

  test('comes from qbitd when qbit-electrs answers 404, and logs no error', async () => {
    coreApi.$getRawTransaction.mockResolvedValue(coinbase());

    const transactions = await fetchTransactions();

    expect(transactions.map(tx => tx.txid)).toEqual([COINBASE_TXID]);
    expect(coreApi.$getRawTransaction).toHaveBeenCalledWith(COINBASE_TXID, false, false, false);
    expect(logger.err).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(retrying(NOT_INDEXED_YET));
  });

  test('logs one error, with qbitd\'s reason, and throws when qbitd fails too', async () => {
    coreApi.$getRawTransaction.mockRejectedValue(new Error(CORE_NOT_FOUND));
    const message = `${failure} ${COINBASE_TXID}. Reason: ${CORE_NOT_FOUND}`;

    await expect(fetchTransactions()).rejects.toThrow(message);

    expect(jest.mocked(logger.err).mock.calls).toEqual([[message]]);
  });

  // Unlike a 404, these say qbit-electrs is down or failing, which must stay in the error log while qbitd covers it
  test.each([
    ['is unreachable', (): Error => Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), { code: 'ECONNREFUSED' })],
    ['times out', (): Error => Object.assign(new Error('timeout of 5000ms exceeded'), { code: 'ECONNABORTED' })],
    ['answers 503', (): Error => electrsError(503, 'Service Unavailable')],
    // electrs answers 400 for its own failures too
    ['has an internal error', (): Error => electrsError(400, 'getblock RPC error: connection refused')],
  ])('comes from qbitd when qbit-electrs %s, which logs an error', async (_failure, electrsFailure) => {
    esploraApi.$getRawTransaction.mockRejectedValue(electrsFailure());
    coreApi.$getRawTransaction.mockResolvedValue(coinbase());

    const transactions = await fetchTransactions();

    expect(transactions.map(tx => tx.txid)).toEqual([COINBASE_TXID]);
    expect(jest.mocked(logger.err).mock.calls).toEqual([[retrying(electrsFailure().message)]]);
  });
});
