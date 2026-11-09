import { getAddressLookupError, isEsploraRequestError, isTxNotFoundError } from '../../utils/api';

// How the esplora backend surfaces an electrs error: axios rejects with electrs's status, and its
// plain-text reason as the response body
function axiosError(status: number, data: unknown): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
}

describe('isTxNotFoundError', () => {
  test('matches all Bitcoin Core not-found message variants', () => {
    const variants = [
      'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.',
      'No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries.',
      'No such mempool transaction. Blockchain transactions are still in the process of being indexed.',
    ];
    for (const message of variants) {
      expect(isTxNotFoundError(new Error(message))).toBe(true);
    }
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
