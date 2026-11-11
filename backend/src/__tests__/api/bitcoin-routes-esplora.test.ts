import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getBlockStatus: jest.fn(),
    $getOutspend: jest.fn(),
    $getTransactionMerkleBlockProof: jest.fn(),
    $getOutspends: jest.fn(),
    $getTransactionMerkleProof: jest.fn(),
    $getBlockHeader: jest.fn(),
    $getTxIdsForBlock: jest.fn(),
    $getBlockHash: jest.fn(),
    $getBlock: jest.fn(),
    $getRawBlock: jest.fn(),
    $getRawTransaction: jest.fn(),
    $getTransactionHex: jest.fn(),
  },
  bitcoinCoreApi: {
    $getRawTransaction: jest.fn(),
  },
}));

// block/:hash looks for the block's transactions in the mempool
jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: { getMempool: (): Record<string, never> => ({}) },
}));

import config from '../../config';
import bitcoinApi, { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import BitcoinApi from '../../api/bitcoin/bitcoin-api';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import { TXINDEX_UNAVAILABLE } from '../../utils/api';

type EsploraLookup = '$getBlockStatus' | '$getOutspend' | '$getTransactionMerkleBlockProof' | '$getOutspends'
  | '$getTransactionMerkleProof' | '$getBlockHeader' | '$getTxIdsForBlock' | '$getBlockHash' | '$getBlock' | '$getRawBlock'
  | '$getRawTransaction' | '$getTransactionHex';
const mockedApi = bitcoinApi as unknown as Record<EsploraLookup, jest.Mock>;
const mockedCoreApi = bitcoinCoreApi as unknown as Record<'$getRawTransaction', jest.Mock>;

// qbit mainnet block 163,891 and the next block, and tx 053486…765b of block 161,388, whose output 2 tx e89dcf…56f4 spent
const BLOCK_HASH = '00000000000000008451c8a192642a138f7ec4b84376341d7a5003335a2e9401';
const NEXT_BLOCK_HASH = '00000000000000006356b8dd1b88535026cc0e48c5bd6d275a5803ac97cab0b9';
const TXID = '053486685773077b30fcfeddd15e8d3e325502615a2cc173121d24631f78765b';
// the coinbase of block 163,891
const COINBASE_TXID = '4a60e113576e895adf6e21011c47a21bf680a52321f4526d762d35316e4ecd64';
// block 163,891 as electrs describes it, and its coinbase, cut down to what indexing the block reads
const BLOCK = {
  id: BLOCK_HASH, height: 163891, version: 0x26df2000, timestamp: 1793837000, bits: 0, nonce: 0, difficulty: 1,
  merkle_root: TXID, tx_count: 5, size: 20000, weight: 20000, previousblockhash: NEXT_BLOCK_HASH, mediantime: 1793836900, stale: false,
};
const COINBASE = {
  txid: COINBASE_TXID, version: 2, locktime: 0, size: 300, weight: 300, fee: 0, sigops: 0,
  vin: [{ txid: '00'.repeat(32), vout: 0xffffffff, prevout: null, scriptsig: '0333800200', scriptsig_asm: '', witness: [], is_coinbase: true, sequence: 0xffffffff }],
  vout: [{ value: 21000000000, scriptpubkey: '5220' + 'ab'.repeat(32), scriptpubkey_asm: '', scriptpubkey_type: 'v2_p2mr' }],
  status: { confirmed: true, block_height: 163891, block_hash: BLOCK_HASH, block_time: 1793837000 },
};
// qbit mainnet's genesis block and its coinbase, which Core won't return as a transaction
const GENESIS_HASH = '0000000000004d60aa5d46013991d0a0e2995d89ee98e53068ae196d763e79f2';
const GENESIS_COINBASE_TXID = '584b62d357e3213ae27815d53b41efc869cc91fcf73d6a81dcab5e08508cb6f1';
const GENESIS_COINBASE_HEX = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff6404ffff001d08044c'
  + '0000000000004c54476f6f676c653a205365637572696e67204543432043727970746f63757272656e6369657320616761696e7374205175616e74'
  + '756d2056756c6e65726162696c6974696573203935383135373a33616261663835ffffffff010092b2e30400000023210000000000000000000000'
  + '00000000000000000000000000000000000000000000ac00000000';
const SPENDING_TXID = 'e89dcf8a7a5bce5810e54176b4af8ad06e871e11a54e4ad9c25d0d01a56056f4';
// The tx's merkle block: the 80-byte header of block 161,388, 76 transactions, 8 hashes and 2 bytes of flags
const MERKLE_BLOCK = '00800020ba9016ab02195c425e30aa50e6db018ca06a87780bf9b405b50a9e5e740989ff123473512996e63f1a3f101c7b729ee6f5dabb'
  + '1f4fbd1b217a059ed3344748507eb9eb6aad8c0119761169a14c0000000808ca8f38d105b10a49e7498106fc3593dd7a43b5e6f013c34db7e21f73'
  + 'bef132a32bdc64a7ab19ba773efb854bc3040c17fd2d5e2e7870cf32869c4de739e22d560c13acbd81b7847247e3d2e414af004771f06295fde68b'
  + 'a6d6f61ec2f801605b76781f63241d1273c12c5a610255323e8d5ed1ddfefc307b0773576886340546dd42754af016cece8bb158dcdb294fceaaef'
  + '23b5265bfa9a9eac75f3e1463934df09493e2bfedbd5e73b445fbb8e0c14bdceee95964cdc0aca319e2691e898d1e8916bfc714cfa3d3e6b72319f'
  + '6a77042a5e4350c7570c94b000d0add46dca35e8187ec30f7e15341c76ac83a14decfb7cee7d2d74aaf64e1497251721fbcc026f05';

// How the esplora backend surfaces an electrs error: axios rejects with electrs's status and plain-text reason
function electrsError(status: number, reason?: string): Error {
  return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data: reason } });
}

// How the none and electrum backends surface a Core RPC error
function coreError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}

// Core's answer for a transaction it doesn't have
const CORE_TX_NOT_FOUND = coreError(-5, 'No such mempool or blockchain transaction. Use gettransaction for wallet transactions.');
// Core's answers for a transaction outside its mempool while txindex is disabled, or still building
const CORE_TXINDEX_DISABLED = coreError(-5, 'No such mempool transaction. Use -txindex or provide a block hash to enable blockchain '
  + 'transaction queries. Use gettransaction for wallet transactions.');
const CORE_TXINDEX_BUILDING = coreError(-5, 'No such mempool transaction. Blockchain transactions are still in the process of being '
  + 'indexed. Use gettransaction for wallet transactions.');

const electrsFailures: [string, Error][] = [
  ['electrs fails', electrsError(503, 'Service Unavailable')],
  ['electrs is unreachable', Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), { code: 'ECONNREFUSED' })],
];

describe('esplora routes served from qbit-electrs', () => {
  const backend = config.MEMPOOL.BACKEND;
  const database = config.DATABASE.ENABLED;
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // block/:hash reads indexed blocks from the database first
    config.DATABASE.ENABLED = false;
    const app = express();
    bitcoinRoutes.initRoutes(app);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/`;
  });

  afterAll(async () => {
    config.MEMPOOL.BACKEND = backend;
    config.DATABASE.ENABLED = database;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.resetAllMocks();
    config.MEMPOOL.BACKEND = 'esplora';
  });

  describe('GET block/:hash/status', () => {
    const url = (hash: string): string => baseUrl + `block/${hash}/status`;

    test.each([
      ['a block in the best chain', { in_best_chain: true, height: 163891, next_best: NEXT_BLOCK_HASH }],
      // electrs can't tell a block outside the best chain from one it doesn't know
      ['a block outside the best chain', { in_best_chain: false, height: null, next_best: null }],
    ])('passes electrs\'s answer for %s through', async (_label, status) => {
      mockedApi.$getBlockStatus.mockResolvedValue(status);

      const res = await fetch(url(BLOCK_HASH));

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^application\/json/);
      expect(await res.json()).toEqual(status);
      expect(mockedApi.$getBlockStatus).toHaveBeenCalledWith(BLOCK_HASH);
    });

    test('responds 400 without a lookup for a malformed hash', async () => {
      const res = await fetch(url(BLOCK_HASH.slice(1)));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid block hash' });
      expect(mockedApi.$getBlockStatus).not.toHaveBeenCalled();
    });

    test.each(electrsFailures)('responds 500 when %s', async (_label, error) => {
      mockedApi.$getBlockStatus.mockRejectedValue(error);

      const res = await fetch(url(BLOCK_HASH));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get block status' });
    });
  });

  describe('GET tx/:txid/outspend/:vout', () => {
    const url = (vout: string, txid = TXID): string => baseUrl + `tx/${txid}/outspend/${vout}`;

    test.each([
      ['a spent output', '2', 2, {
        spent: true,
        txid: SPENDING_TXID,
        vin: 0,
        status: {
          confirmed: true,
          block_height: 161395,
          block_hash: '0000000000000000f472b468a3d12b6db513adc3788a4a911e104795e360d77a',
          block_time: 1793833899,
        },
      }],
      ['an unspent output', '1', 1, { spent: false }],
      ['an index with leading zeros', '002', 2, { spent: false }],
      ['the largest index electrs reads', '4294967295', 4294967295, { spent: false }],
    ])('passes electrs\'s answer for %s through', async (_label, vout, index, outspend) => {
      mockedApi.$getOutspend.mockResolvedValue(outspend);

      const res = await fetch(url(vout));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(outspend);
      expect(mockedApi.$getOutspend).toHaveBeenCalledWith(TXID, index);
    });

    test.each(['abc', '-1', '1.5', '1e3', '0x1', '+1', '%201', '4294967296', '9'.repeat(400)])(
      'responds 400 without a lookup for the output index %p', async (vout) => {
        const res = await fetch(url(vout));

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'Invalid output index' });
        expect(mockedApi.$getOutspend).not.toHaveBeenCalled();
      });

    test('responds 400 without a lookup for a malformed txid', async () => {
      const res = await fetch(url('0', 'not-a-txid'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockedApi.$getOutspend).not.toHaveBeenCalled();
    });

    test.each(electrsFailures)('responds 500 when %s', async (_label, error) => {
      mockedApi.$getOutspend.mockRejectedValue(error);

      const res = await fetch(url('0'));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get transaction outspend' });
    });
  });

  describe('GET tx/:txid/merkleblock-proof', () => {
    const url = (txid = TXID): string => baseUrl + `tx/${txid}/merkleblock-proof`;

    test('passes electrs\'s hex through as text/plain', async () => {
      mockedApi.$getTransactionMerkleBlockProof.mockResolvedValue(MERKLE_BLOCK);

      const res = await fetch(url());

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
      expect(await res.text()).toBe(MERKLE_BLOCK);
      expect(mockedApi.$getTransactionMerkleBlockProof).toHaveBeenCalledWith(TXID);
    });

    // electrs answers 404 for a transaction it doesn't know and for one still in the mempool
    test('responds 404 when electrs has no confirmed transaction', async () => {
      mockedApi.$getTransactionMerkleBlockProof.mockRejectedValue(electrsError(404, 'Transaction not found or is unconfirmed'));

      const res = await fetch(url());

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Transaction not found or is unconfirmed' });
    });

    test('responds 400 without a lookup for a malformed txid', async () => {
      const res = await fetch(url(TXID + '0'));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid transaction ID' });
      expect(mockedApi.$getTransactionMerkleBlockProof).not.toHaveBeenCalled();
    });

    test.each(electrsFailures)('responds 500 when %s', async (_label, error) => {
      mockedApi.$getTransactionMerkleBlockProof.mockRejectedValue(error);

      const res = await fetch(url());

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get transaction merkleblock proof' });
    });

    test.each([
      ['undefined', undefined],
      ['an empty string', ''],
      ['a number', 1000],
      ['a non-hex string', 'not hex'],
      ['an odd-length hex string', MERKLE_BLOCK.slice(1)],
    ])('responds 500 instead of 200 when electrs returns %s', async (_label, value) => {
      mockedApi.$getTransactionMerkleBlockProof.mockResolvedValue(value);

      const res = await fetch(url());

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get transaction merkleblock proof' });
    });
  });

  // Routes that answered 500 when electrs, or Core, had no such transaction or block. Each not-found answer is
  // tried under the backend that gives it.
  describe.each([
    [`tx/${TXID}/outspends`, '$getOutspends', 'No such mempool or blockchain transaction', 'Failed to get transaction outspends', [
      ['esplora', electrsError(404, 'Transaction not found')],
      ['none', CORE_TX_NOT_FOUND],
    ]],
    [`tx/${TXID}/merkle-proof`, '$getTransactionMerkleProof', 'Transaction not found or is unconfirmed', 'Failed to get transaction merkle proof', [
      // for a transaction electrs doesn't know, and for one in the mempool
      ['esplora', electrsError(404, 'Transaction not found or is unconfirmed')],
      // the electrum backend looks the transaction up in Core before it asks its Electrum server
      ['electrum', CORE_TX_NOT_FOUND],
    ]],
    [`block/${BLOCK_HASH}`, '$getBlock', 'Failed to get block', 'Failed to get block', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-5, 'Block not found')],
    ]],
    [`block/${BLOCK_HASH}/raw`, '$getRawBlock', 'Failed to get raw block', 'Failed to get raw block', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-5, 'Block not found')],
    ]],
    [`block/${BLOCK_HASH}/header`, '$getBlockHeader', 'Block not found', 'Failed to get block header', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-5, 'Block not found')],
    ]],
    [`block/${BLOCK_HASH}/txids`, '$getTxIdsForBlock', 'Block not found', 'Failed to get txids for block', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-5, 'Block not found')],
    ]],
    [`block/${BLOCK_HASH}/txs`, '$getTxIdsForBlock', 'Block not found', 'Failed to get block transactions', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-5, 'Block not found')],
    ]],
    [`block/${BLOCK_HASH}/txs/10`, '$getTxIdsForBlock', 'Block not found', 'Failed to get block transactions', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-5, 'Block not found')],
    ]],
    // a height above the tip
    ['block-height/999999999', '$getBlockHash', 'Block not found', 'Failed to get block at height', [
      ['esplora', electrsError(404, 'Block not found')],
      ['none', coreError(-8, 'Block height out of range')],
    ]],
  ] as [string, EsploraLookup, string, string, [string, Error][]][])('GET %s', (route, lookup, notFound, failure, notFoundErrors) => {
    test.each(notFoundErrors)('responds 404 when the %s backend has no such object', async (backendName, error) => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
      mockedApi[lookup].mockRejectedValue(error);

      const res = await fetch(baseUrl + route);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: notFound });
    });

    test('still responds 500 when electrs fails', async () => {
      mockedApi[lookup].mockRejectedValue(electrsError(503, 'Service Unavailable'));

      const res = await fetch(baseUrl + route);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: failure });
    });
  });

  // A route answers 404 only when what it looks up is missing; any other failure along the way stays a 500
  describe('a failure of another lookup', () => {
    // With txindex off or still building, Core can't look a block's coinbase up without the block hash. blocks.ts
    // reports that as "Cannot fetch coinbase tx ... Reason: No such mempool transaction ...", but the block exists.
    test.each(['none', 'electrum'])('GET block/:hash responds 500, not 404, when the %s backend cannot fetch the coinbase', async (backendName) => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
      const txindexError = coreError(-5, 'No such mempool transaction. Use -txindex or provide a block hash to enable blockchain transaction queries.');
      mockedApi.$getBlock.mockResolvedValue(BLOCK);
      mockedApi.$getTxIdsForBlock.mockResolvedValue([COINBASE_TXID]);
      mockedApi.$getRawTransaction.mockRejectedValue(txindexError);
      mockedCoreApi.$getRawTransaction.mockRejectedValue(txindexError);

      const res = await fetch(baseUrl + `block/${BLOCK_HASH}`);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get block' });
      expect(mockedApi.$getRawTransaction).toHaveBeenCalledWith(COINBASE_TXID, false, false, false);
    });

    // In esplora mode, indexing a block also asks Core about the block electrs returned. A Core behind electrs, such
    // as the local node behind a fallback electrs, answers that with -5, but the block exists.
    test('GET block/:hash responds 500, not 404, when Core is behind electrs in esplora mode', async () => {
      config.MEMPOOL.BACKEND = 'esplora';
      mockedApi.$getBlock.mockResolvedValue(BLOCK);
      mockedApi.$getTxIdsForBlock.mockResolvedValue([COINBASE_TXID]);
      mockedApi.$getRawTransaction.mockResolvedValue(COINBASE);
      const getBlockStats = jest.spyOn(bitcoinClient, 'getBlockStats').mockRejectedValue(coreError(-5, 'Block not found'));

      try {
        const res = await fetch(baseUrl + `block/${BLOCK_HASH}`);

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Failed to get block' });
        expect(getBlockStats).toHaveBeenCalledWith(BLOCK_HASH);
      } finally {
        getBlockStats.mockRestore();
      }
    });

    test('GET tx/:txid/outspends responds 500, not 404, for a block-not-found error', async () => {
      config.MEMPOOL.BACKEND = 'none';
      mockedApi.$getOutspends.mockRejectedValue(coreError(-5, 'Block not found'));

      const res = await fetch(baseUrl + `tx/${TXID}/outspends`);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Failed to get transaction outspends' });
    });
  });

  // Core's txindex state, not the transaction, is missing, so these answer 503 and say what the node needs
  describe.each([
    ['txindex disabled', CORE_TXINDEX_DISABLED],
    ['txindex still building', CORE_TXINDEX_BUILDING],
  ])('with %s', (_state, txindexError) => {
    test.each([
      ['none', `tx/${TXID}`, '$getRawTransaction'],
      ['none', `tx/${TXID}/status`, '$getRawTransaction'],
      ['none', `tx/${TXID}/hex`, '$getTransactionHex'],
      ['none', `tx/${TXID}/raw`, '$getTransactionHex'],
      ['none', `tx/${TXID}/outspends`, '$getOutspends'],
      ['none', `tx/${TXID}/outspend/0`, '$getOutspends'],
      ['electrum', `tx/${TXID}/merkle-proof`, '$getTransactionMerkleProof'],
    ])('under the %s backend, GET %s responds 503, not 404', async (backendName, route, lookup) => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
      mockedApi[lookup as EsploraLookup].mockRejectedValue(txindexError);

      const res = await fetch(baseUrl + route);

      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: TXINDEX_UNAVAILABLE });
    });
  });

  // Core never adds an unspendable output to its UTXO set, so gettxout finds none of them, spent or not
  describe.each(['none', 'electrum'])('unspendable outputs under the %s backend', (backendName) => {
    const P2MR = '5220' + 'ab'.repeat(32);
    const outputs = [
      { value: 0.001, n: 0, scriptPubKey: { asm: '', hex: P2MR, type: 'witness_v2_p2mr' } },
      { value: 0, n: 1, scriptPubKey: { asm: '', hex: '6a0568656c6c6f', type: 'nulldata' } },
      // an OP_RETURN script Core doesn't call nulldata
      { value: 0, n: 2, scriptPubKey: { asm: '', hex: '6a' + '4d0004' + '00'.repeat(1024), type: 'nonstandard' } },
      // over the 10,000-byte script size limit
      { value: 0.0001, n: 3, scriptPubKey: { asm: '', hex: '51'.repeat(10001), type: 'nonstandard' } },
    ];
    let node: { getRawTransaction: jest.Mock, getTxOut: jest.Mock };

    beforeEach(() => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
      node = {
        getRawTransaction: jest.fn().mockResolvedValue({ txid: TXID, version: 2, locktime: 0, size: 3924, weight: 3924, vin: [], vout: outputs.map((o) => ({ ...o })) }),
        // as Core answers for a spent output, and for every unspendable one
        getTxOut: jest.fn().mockResolvedValue(null),
      };
      const nodeApi = new BitcoinApi(node);
      mockedApi.$getOutspends.mockImplementation((txid: string) => nodeApi.$getOutspends(txid));
    });

    test('GET tx/:txid/outspends answers spent false for them, and asks gettxout only about the others', async () => {
      const res = await fetch(baseUrl + `tx/${TXID}/outspends`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([{ spent: true }, { spent: false }, { spent: false }, { spent: false }]);
      expect(node.getTxOut.mock.calls).toEqual([[TXID, 0]]);
    });

    test.each([
      ['an OP_RETURN output', '1', { spent: false }],
      ['an OP_RETURN script Core calls nonstandard', '2', { spent: false }],
      ['a script over the size limit', '3', { spent: false }],
      ['a spent P2MR output', '0', { spent: true }],
    ])('GET tx/:txid/outspend/:vout answers %s', async (_label, vout, outspend) => {
      const res = await fetch(baseUrl + `tx/${TXID}/outspend/${vout}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(outspend);
    });
  });

  // Core won't return the genesis block's coinbase as a transaction, so the node backends read it from the block
  describe.each(['none', 'electrum'])('the genesis coinbase under the %s backend', (backendName) => {
    test.each(['hex', 'raw'])('GET tx/:txid/%s answers it from the genesis block', async (format) => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
      const node = {
        getRawTransaction: jest.fn().mockRejectedValue(
          coreError(-5, 'The genesis block coinbase is not considered an ordinary transaction and cannot be retrieved')),
        getBlockHash: jest.fn().mockResolvedValue(GENESIS_HASH),
        getBlock: jest.fn().mockResolvedValue({ hash: GENESIS_HASH, tx: [{ txid: GENESIS_COINBASE_TXID, hex: GENESIS_COINBASE_HEX }] }),
      };
      const nodeApi = new BitcoinApi(node);
      mockedApi.$getTransactionHex.mockImplementation((txid: string) => nodeApi.$getTransactionHex(txid));

      const res = await fetch(baseUrl + `tx/${GENESIS_COINBASE_TXID}/${format}`);

      expect(res.status).toBe(200);
      const body = format === 'hex' ? await res.text() : Buffer.from(await res.arrayBuffer()).toString('hex');
      expect(body).toBe(GENESIS_COINBASE_HEX);
      expect(node.getBlock).toHaveBeenCalledWith(GENESIS_HASH, 2);
    });
  });

  describe('GET block-height/:height', () => {
    test.each([
      ['the genesis block', '0', 0],
      ['a height with leading zeros', '00163891', 163891],
      ['the highest height Core reads', '2147483647', 2147483647],
    ])('passes %s through as a number', async (_label, height, number) => {
      mockedApi.$getBlockHash.mockResolvedValue(BLOCK_HASH);

      const res = await fetch(baseUrl + `block-height/${height}`);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe(BLOCK_HASH);
      expect(mockedApi.$getBlockHash).toHaveBeenCalledWith(number);
    });

    test.each(['abc', '-1', '1.5', '1e3', '0x1', '+1', '%201'])('responds 400 without a lookup for the height %p', async (height) => {
      const res = await fetch(baseUrl + `block-height/${height}`);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid block height' });
      expect(mockedApi.$getBlockHash).not.toHaveBeenCalled();
    });

    // Core's getblockhash takes a 32-bit height and fails on a larger one, where qbit-electrs answers 404
    test.each(['2147483648', '9999999999', '9'.repeat(400)])('responds 404 without a lookup for the height %p', async (height) => {
      const res = await fetch(baseUrl + `block-height/${height}`);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Block not found' });
      expect(mockedApi.$getBlockHash).not.toHaveBeenCalled();
    });
  });

  describe.each(['none', 'electrum'])('under the %s backend', (backendName) => {
    beforeEach(() => {
      config.MEMPOOL.BACKEND = backendName as typeof config.MEMPOOL.BACKEND;
    });

    // These need qbit-electrs, so they answer 405, as the address routes that need it do
    test.each([
      [`block/${BLOCK_HASH}/status`, '$getBlockStatus', 'Block status lookups require mempool/electrs backend.'],
      [`tx/${TXID}/merkleblock-proof`, '$getTransactionMerkleBlockProof', 'Merkle block proofs require mempool/electrs backend.'],
    ])('GET %s responds 405 without a lookup', async (route, lookup, error) => {
      const res = await fetch(baseUrl + route);

      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error });
      expect(mockedApi[lookup as EsploraLookup]).not.toHaveBeenCalled();
    });

    // the bitcoind backend's own $getOutspend reads only the confirmed UTXO set
    test.each([
      ['an unspent output', '0', { spent: false }],
      ['a spent output', '1', { spent: true }],
      ['an index past the last output', '2', { spent: false }],
    ])('GET tx/:txid/outspend/:vout answers %s as tx/:txid/outspends does', async (_label, vout, outspend) => {
      mockedApi.$getOutspends.mockResolvedValue([{ spent: false }, { spent: true }]);

      const res = await fetch(baseUrl + `tx/${TXID}/outspend/${vout}`);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(outspend);
      expect(mockedApi.$getOutspends).toHaveBeenCalledWith(TXID);
      expect(mockedApi.$getOutspend).not.toHaveBeenCalled();
    });

    test('GET tx/:txid/outspend/:vout responds 404 for a transaction the node does not have', async () => {
      mockedApi.$getOutspends.mockRejectedValue(CORE_TX_NOT_FOUND);

      const res = await fetch(baseUrl + `tx/${TXID}/outspend/0`);

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'No such mempool or blockchain transaction' });
    });
  });

  // The electrum backend gets merkle proofs from its Electrum server; bitcoind has none
  test('GET tx/:txid/merkle-proof responds 405 without a lookup under the none backend', async () => {
    config.MEMPOOL.BACKEND = 'none';

    const res = await fetch(baseUrl + `tx/${TXID}/merkle-proof`);

    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ error: 'Merkle proofs cannot be used with bitcoind as backend.' });
    expect(mockedApi.$getTransactionMerkleProof).not.toHaveBeenCalled();
  });

  test('GET tx/:txid/merkle-proof passes the proof through under the electrum backend', async () => {
    config.MEMPOOL.BACKEND = 'electrum';
    const proof = { block_height: 161388, merkle: [TXID], pos: 11 };
    mockedApi.$getTransactionMerkleProof.mockResolvedValue(proof);

    const res = await fetch(baseUrl + `tx/${TXID}/merkle-proof`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(proof);
  });
});
