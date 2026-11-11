import config from '../../config';
import {
  getAddressLookupError, isAddressSearchDisabledError, isBlockHeightNotFoundError, isBlockNotFoundError, isEsploraRequestError,
  isTxIndexUnavailableError, isTxNotFoundError,
} from '../../utils/api';

// How the esplora backend surfaces an electrs error: axios rejects with electrs's status, and its
// plain-text reason as the response body
function axiosError(status: number, data: unknown): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
}

// qbitd's getrawtransaction answers for a transaction outside its mempool
const TX_NOT_FOUND = 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.';
const TXINDEX_DISABLED = 'No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries. '
  + 'Use gettransaction for wallet transactions.';
const TXINDEX_BUILDING = 'No such mempool transaction. Blockchain transactions are still in the process of being indexed. '
  + 'Use gettransaction for wallet transactions.';

describe('isTxNotFoundError', () => {
  test('matches Bitcoin Core ruling a transaction out, with txindex synced', () => {
    expect(isTxNotFoundError(new Error(TX_NOT_FOUND))).toBe(true);
  });

  // the transaction may exist: Core only can't look outside its mempool
  test.each([
    ['txindex disabled', TXINDEX_DISABLED],
    ['txindex still building', TXINDEX_BUILDING],
  ])('does not match Bitcoin Core\'s answer with %s', (_label, message) => {
    expect(isTxNotFoundError(new Error(message))).toBe(false);
  });

  test('matches esplora/electrs axios-style 404 errors', () => {
    const axios404 = Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
    expect(isTxNotFoundError(axios404)).toBe(true);
  });

  test('does not match esplora errors with other statuses', () => {
    const axios503 = Object.assign(new Error('Request failed with status code 503'), { response: { status: 503 } });
    expect(isTxNotFoundError(axios503)).toBe(false);
  });

  test('does not match other errors', () => {
    expect(isTxNotFoundError(new Error('Failed to get transaction status'))).toBe(false);
    expect(isTxNotFoundError(new Error(''))).toBe(false);
    expect(isTxNotFoundError('No such mempool transaction')).toBe(false);
    expect(isTxNotFoundError(null)).toBe(false);
    expect(isTxNotFoundError(undefined)).toBe(false);
  });
});

describe('isTxIndexUnavailableError', () => {
  test.each([
    ['txindex disabled', TXINDEX_DISABLED],
    ['txindex still building', TXINDEX_BUILDING],
  ])('matches Bitcoin Core\'s answer with %s', (_label, message) => {
    expect(isTxIndexUnavailableError(new Error(message))).toBe(true);
  });

  test.each([
    ['Core ruling the transaction out', new Error(TX_NOT_FOUND)],
    // blocks.ts's report of a coinbase it couldn't fetch, which block/:hash answers with a 500
    ['a report that quotes it', new Error(`Cannot fetch coinbase tx ${'ab'.repeat(32)}. Reason: ${TXINDEX_DISABLED}`)],
    ['an esplora 404', axiosError(404, 'Transaction not found')],
    ['nothing', undefined],
  ])('does not match %s', (_label, error) => {
    expect(isTxIndexUnavailableError(error)).toBe(false);
  });
});

describe('isBlockNotFoundError', () => {
  const coreError = (code: number, message: string): Error => Object.assign(new Error(message), { code });

  test.each([
    ['Core RPC error -5', coreError(-5, 'Block not found')],
    ['an esplora 404', axiosError(404, 'Block not found')],
  ])('matches %s', (_label, error) => {
    expect(isBlockNotFoundError(error)).toBe(true);
  });

  test.each([
    // other RPCs answer -8 for other bad parameters
    ['Core RPC error -8', coreError(-8, 'Block height out of range')],
    ['another Core RPC error', coreError(-1, 'Block not available (pruned data)')],
    // blocks.ts's report of a coinbase it couldn't fetch, which carries no code
    ['a coinbase that could not be fetched',
      new Error('Cannot fetch coinbase tx 4a60e113576e895adf6e21011c47a21bf680a52321f4526d762d35316e4ecd64. Reason: No such mempool transaction. '
        + 'Use -txindex or provide a block hash to enable blockchain transaction queries.')],
    ['an esplora 503', axiosError(503, 'Service Unavailable')],
    ['a plain error', new Error('Block not found')],
    ['nothing', undefined],
  ])('does not match %s', (_label, error) => {
    expect(isBlockNotFoundError(error)).toBe(false);
  });
});

// In esplora mode only electrs's 404 says a block is missing: Core's -5 or -8 there means Core is behind electrs
describe('block not-found checks in esplora mode', () => {
  const coreError = (code: number, message: string): Error => Object.assign(new Error(message), { code });
  const backend = config.MEMPOOL.BACKEND;

  beforeAll(() => {
    config.MEMPOOL.BACKEND = 'esplora';
  });

  afterAll(() => {
    config.MEMPOOL.BACKEND = backend;
  });

  test('match electrs\'s 404', () => {
    expect(isBlockNotFoundError(axiosError(404, 'Block not found'))).toBe(true);
    expect(isBlockHeightNotFoundError(axiosError(404, 'Block not found'))).toBe(true);
  });

  test('do not match Core\'s -5 or -8', () => {
    expect(isBlockNotFoundError(coreError(-5, 'Block not found'))).toBe(false);
    expect(isBlockHeightNotFoundError(coreError(-5, 'Block not found'))).toBe(false);
    expect(isBlockHeightNotFoundError(coreError(-8, 'Block height out of range'))).toBe(false);
  });
});

describe('isBlockHeightNotFoundError', () => {
  const coreError = (code: number, message: string): Error => Object.assign(new Error(message), { code });

  test.each([
    ['Core RPC error -8, which getblockhash gives for a height above the tip', coreError(-8, 'Block height out of range')],
    ['Core RPC error -5', coreError(-5, 'Block not found')],
    ['an esplora 404', axiosError(404, 'Block not found')],
  ])('matches %s', (_label, error) => {
    expect(isBlockHeightNotFoundError(error)).toBe(true);
  });

  test.each([
    ['another Core RPC error', coreError(-1, 'Block not available (pruned data)')],
    ['an esplora 503', axiosError(503, 'Service Unavailable')],
  ])('does not match %s', (_label, error) => {
    expect(isBlockHeightNotFoundError(error)).toBe(false);
  });
});

describe('getAddressLookupError', () => {
  test('matches the node rejecting an address under the electrum backend', () => {
    expect(getAddressLookupError(new Error('Invalid Bitcoin address'))).toEqual({ status: 400, reason: 'Invalid Bitcoin address' });
  });

  test.each([
    'invalid qbit Bech32m address: invalid checksum',
    'invalid qbit address HRP: expected qb, got bc',
    'qbit P2MR address must use Bech32m, got Bech32',
    'qbit address is missing witness version',
  ])('answers 400 when electrs cannot parse the address: %s', (reason) => {
    expect(getAddressLookupError(axiosError(400, reason))).toEqual({ status: 400, reason });
  });

  test('answers 413 when an address has more unspent outputs than electrs serves', () => {
    const reason = 'Too many unspent transaction outputs (>500). Contact support to raise limits.';
    expect(getAddressLookupError(axiosError(400, reason))).toEqual({ status: 413, reason });
  });

  test('passes on the 422 for an after_txid that left the mempool', () => {
    expect(getAddressLookupError(axiosError(422, 'after_txid not found'))).toEqual({ status: 422, reason: 'after_txid not found' });
  });

  test('answers 422 for an after_txid the node does not have under the electrum backend', () => {
    expect(getAddressLookupError(new Error('after_txid not found'))).toEqual({ status: 422, reason: 'after_txid not found' });
  });

  test('does not blame the request for an electrs failure that also answers 400', () => {
    for (const data of [
      'getblock RPC error: connection refused',
      'qbit consensus decode error: unexpected end of data',
      'qbit addresses are not supported on Bitcoin',
      '',
      undefined,
      { error: 'invalid' },
    ]) {
      expect(getAddressLookupError(axiosError(400, data))).toBeUndefined();
    }
  });

  test('does not pass on a 422 for anything but an after_txid electrs cannot find', () => {
    expect(getAddressLookupError(axiosError(422, 'Unprocessable Entity'))).toBeUndefined();
  });

  test('does not match esplora errors with other statuses', () => {
    for (const status of [404, 413, 500, 503]) {
      expect(getAddressLookupError(axiosError(status, 'invalid qbit address HRP: expected qb, got bc'))).toBeUndefined();
    }
  });

  test('does not match other errors', () => {
    expect(getAddressLookupError(new Error('Failed to get address'))).toBeUndefined();
    expect(getAddressLookupError('Invalid Bitcoin address')).toBeUndefined();
    expect(getAddressLookupError(null)).toBeUndefined();
    expect(getAddressLookupError(undefined)).toBeUndefined();
  });
});

describe('isEsploraRequestError', () => {
  test.each([
    [404, 'Transaction not found'],
    [400, 'invalid qbit address HRP: expected qb, got bc'],
    [400, 'Too many unspent transaction outputs (>50000). Contact support to raise limits.'],
    [400, 'Too many history transactions (>10000). Contact support to raise limits.'],
    [422, 'after_txid not found'],
  ])('blames the request for a %d %p', (status, reason) => {
    expect(isEsploraRequestError(axiosError(status, reason))).toBe(true);
  });

  test.each([
    [400, 'getblock RPC error: connection refused'],
    [400, 'Connection error: disconnected from daemon while receiving'],
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [407, 'Proxy Authentication Required'],
    [421, 'Misdirected Request'],
    [422, 'Unprocessable Entity'],
    [499, ''],
    [500, 'Internal Server Error'],
  ])('blames the host for a %d %p', (status, reason) => {
    expect(isEsploraRequestError(axiosError(status, reason))).toBe(false);
  });

  test('blames the host when nothing answered', () => {
    expect(isEsploraRequestError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), { code: 'ECONNREFUSED' }))).toBe(false);
    expect(isEsploraRequestError(Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }))).toBe(false);
  });
});

describe('isAddressSearchDisabledError', () => {
  test.each([
    'address search disabled',
    'Address search disabled\n',
    '  ADDRESS SEARCH DISABLED  ',
    'error: address search disabled on this server',
  ])('matches qbit-electrs without --address-search answering 400 %p', (reason) => {
    expect(isAddressSearchDisabledError(axiosError(400, reason))).toBe(true);
    // no suggestions to give says nothing against the host
    expect(isEsploraRequestError(axiosError(400, reason))).toBe(true);
  });

  test.each([
    [400, 'Corruption: block checksum mismatch'],
    [400, ''],
    [403, 'address search disabled'],
    [500, 'address search disabled'],
  ])('does not match a %d %p', (status, reason) => {
    expect(isAddressSearchDisabledError(axiosError(status, reason))).toBe(false);
  });

  test('does not match an answer that is not text, or no answer', () => {
    expect(isAddressSearchDisabledError(axiosError(400, { error: 'address search disabled' }))).toBe(false);
    expect(isAddressSearchDisabledError(new Error('address search disabled'))).toBe(false);
    expect(isAddressSearchDisabledError(undefined)).toBe(false);
  });
});
