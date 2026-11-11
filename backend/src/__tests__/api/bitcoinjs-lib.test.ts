// The backend's calls into bitcoinjs-lib, fed qbit and Bitcoin data. Run these
// when updating bitcoinjs-lib:
// - Common.getTransactionFromRequest (POST /api/v1/tx and /api/v1/tx/push)
//   and Common.getTransactionsFromRequest (POST /api/v1/txs/test), through
//   validateTransactionHex: Transaction.fromHex and the transaction's size,
//   and script.decompile and opcodes when ALLOW_UNREACHABLE is off
// - TransactionUtils: script.toASM, for opcode names and P2WSH sigops
// - parseAuxPowParentCoinbase: address.fromOutputScript, for AuxPoW pools
// - POST /api/v1/psbt/addparents: Psbt.fromBase64, fromHex, updateInput,
//   toBase64 and toHex, and bip174 underneath them
import express, { Request } from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import * as crypto from 'crypto';
import * as bitcoinjs from 'bitcoinjs-lib';

jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: {
    $getTransactionHex: jest.fn(),
  },
  bitcoinCoreApi: {},
}));

// The routes' imports would otherwise start backend-info's timer and load the
// Rust GBT addon, which keep jest from exiting. None of these tests uses them.
jest.mock('../../api/backend-info', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/mempool-blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/websocket-handler', () => ({ __esModule: true, default: {} }));

import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { Common } from '../../api/common';
import transactionUtils from '../../api/transaction-utils';
import config from '../../config';
import { parseAuxPowParentCoinbase } from '../../utils/qbit-auxpow';

const mockedApi = bitcoinApi as unknown as { $getTransactionHex: jest.Mock };

// qbit mainnet P2MR spends as mempool.qbit.org serves them: a 3,680-byte PQC
// signature, a leaf script and the control byte c1. The etching's leaf script
// carries a qscription envelope.
const { etching, mint } = require('./test-data/qbit-p2mr-qscriptions.json');
const randomTransactions = require('./test-data/transactions-random.json');

// The raw header of qbit mainnet block 169697
// f86741b59845cc193500bf522032f786ed3b4b6daec720579e332ee04de3a350, as qbitd's
// `getblockheader <hash> false` returns it and the backend stores it in the
// block's extras. Its parent coinbase, from F2Pool, pays two P2PKH outputs, one
// to the parent address pools-qbit.json lists for F2Pool, and carries five
// OP_RETURN commitments.
const F2POOL_BLOCK_169697_HEADER =
  '00e105201615bd197bca1645fa34c91853c09f78e7d1b1007d2d36d10100000000000000' +
  'cd5b283a096399f8352eb7703a188d95acb09898836564d0716d168cfe69254f7860f36a' +
  '08210b170000000001000000010000000000000000000000000000000000000000000000' +
  '000000000000000000ffffffff6403e4e10e2cfabe6d6deeaa38e617e030187e2fdc60ed' +
  '9c786f3beba993adc3851b07f812ee9342459610000000f09f909f092f4632506f6f6c2f' +
  '670000000000000000000000000000000000000000000000000000000000000000000000' +
  '050000423979000000000722020000000000001976a914c6740a12d0a7d556f89782bf5f' +
  'af0e12cf25a63988acd89eac12000000001976a91469f2a01f4ff9e6ac24df9062e98287' +
  '53474b348088ac00000000000000002f6a2d434f5245017c706ca44a28fdd25761250961' +
  '276bd61d5aa87be7ec323813c943336c579e238228a8ebd096a7e5000000000000000026' +
  '6a2448617468fdd1ea6df557419197465261f4b234a7b750dc7b08efb96d7e17db8e0021' +
  '2f3500000000000000002c6a4c2952534b424c4f434b3a2e4fd390a7f6019ecad2661e5f' +
  '9fb141075c329a10e1e7549d454528008f71dd0000000000000000296a277379732b2716' +
  '8f6b4f86dd12c454d541e2b999ad9342f22b79294237aa98453a048eb216b72300000000' +
  '0000000000266a24aa21a9ed7d84590a01e54594303d47b8bfb2ca394bf685dd441bd030' +
  '969ee3fe2f50ef2dfeede73c0d420d297a9029a48933206ffc2923bf4c05782f8f6b0e44' +
  '81f5b4d4fdbfdb2a321140305cd08d1f37b06f3a9573d0e0a32753bd4169fb9434bee701' +
  'd689c06dba1425706ced0b2af87ecede7ff3b69b702f1969ab7fc4814a5976288cf6b44f' +
  '9f0523671c57feeaafff6fbe7f3d0bd0d423331dd9cad0748d415a009db87fe1446fb334' +
  'df8091f6722e08125192ca5f30a1fd5c7d056f05411a5d2bcbf569ab7fe2d269eb067b99' +
  '3309ee195ab4d3d873015c6975d895b8fb91fe52de833d5715ab78f33891100c1d044987' +
  '75ba0ea1069efd7b2fa10bb20de373dfe77f48a6fb92be9670dd7dfe9ba33bc0d0a4b54b' +
  'f523a7de396a54fd13bef7b64e4d720a2c2a2f0824d57526b4f8045e881e12ac01865b7d' +
  '91f27e12b8285812791184eb7564d1edd06b07befb017373a6733e8a57fbe4de01a2a90b' +
  '5b5c6268e4bb955949dd4743cb64c11a9f4a9be88e2a81986c13273297e1a499f7f3e972' +
  'bb8dd2a0c3a4ca38857ee117354853a929c0a531edbb5f6cc05b1edcb79a995d0cc3e238' +
  '0f0044d956c9ed8868aed88686249b870444eac7eadc26429044ee951faf14fc49000000' +
  '000400000000000000000000000000000000000000000000000000000000000000003d41' +
  '8c6177658d0fd80f549c1860512f02d78733bb808f462df47392d9f396e8f565fa623d1d' +
  '6c041d0107c32c0d66dd9949ad308a01073c25046a2e1475efca4eedbfdc616e0fa7f26a' +
  '7edd1c09063d8834ab73001834a2dd5f5f00d8fe0dc6010000000000ff3f682bf5c41e3b' +
  'e41c9627fcade533f549b8007b5596fd0000000000000000000060e0742fd1dadf215d2e' +
  'd46d7d60216432de0e81883b8b585eb5bb637de09ec87c60f36aace50117003bed67';

interface SerializableTx {
  version: number;
  locktime: number;
  vin: { txid: string; vout: number; scriptsig: string; sequence: number; witness?: string[] }[];
  vout: { value: number; scriptpubkey: string }[];
}

function compactSize(n: number): Buffer {
  if (n < 0xfd) {
    return Buffer.from([n]);
  }
  const buf = Buffer.alloc(3);
  buf[0] = 0xfd;
  buf.writeUInt16LE(n, 1);
  return buf;
}

function withLength(data: Buffer): Buffer {
  return Buffer.concat([compactSize(data.length), data]);
}

function uint32(n: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n);
  return buf;
}

// Serializes an esplora transaction as qbitd does, with its witnesses unless
// withWitness is false
function serializeTx(tx: SerializableTx, withWitness = true): Buffer {
  const hasWitness = withWitness && tx.vin.some((vin) => vin.witness?.length);
  const parts: Buffer[] = [uint32(tx.version)];
  if (hasWitness) {
    parts.push(Buffer.from([0x00, 0x01]));
  }
  parts.push(compactSize(tx.vin.length));
  for (const vin of tx.vin) {
    parts.push(Buffer.from(vin.txid, 'hex').reverse(), uint32(vin.vout), withLength(Buffer.from(vin.scriptsig, 'hex')), uint32(vin.sequence));
  }
  parts.push(compactSize(tx.vout.length));
  for (const vout of tx.vout) {
    const value = Buffer.alloc(8);
    value.writeBigUInt64LE(BigInt(vout.value));
    parts.push(value, withLength(Buffer.from(vout.scriptpubkey, 'hex')));
  }
  if (hasWitness) {
    for (const vin of tx.vin) {
      const witness = vin.witness || [];
      parts.push(compactSize(witness.length), ...witness.map((item) => withLength(Buffer.from(item, 'hex'))));
    }
  }
  parts.push(uint32(tx.locktime));
  return Buffer.concat(parts);
}

function txid(tx: SerializableTx): string {
  const sha256 = (data: Buffer): Buffer => crypto.createHash('sha256').update(data).digest();
  return sha256(sha256(serializeTx(tx, false))).reverse().toString('hex');
}

function thrownBy(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected an error');
}

describe('Common.getTransactionFromRequest and getTransactionsFromRequest', () => {
  const { MAX_PUSH_TX_SIZE_WEIGHT, ALLOW_UNREACHABLE } = config.MEMPOOL;
  const push = (body: unknown): string => Common.getTransactionFromRequest({ body } as Request, false);
  const etchingHex = serializeTx(etching).toString('hex');
  const mintHex = serializeTx(mint).toString('hex');

  beforeEach(() => {
    // The etching's leaf script has an OP_FALSE OP_IF envelope, so these tests
    // set the unreachable-script check off rather than rely on the default.
    config.MEMPOOL.ALLOW_UNREACHABLE = true;
  });

  afterEach(() => {
    config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = MAX_PUSH_TX_SIZE_WEIGHT;
    config.MEMPOOL.ALLOW_UNREACHABLE = ALLOW_UNREACHABLE;
  });

  test('accepts qbit mainnet P2MR spends and returns their hex', () => {
    expect([txid(etching), txid(mint)]).toEqual([etching.txid, mint.txid]);
    expect([etchingHex.length / 2, mintHex.length / 2]).toEqual([etching.size, mint.size]);

    expect(push(etchingHex.toUpperCase())).toBe(etchingHex);
    expect(push(mintHex)).toBe(mintHex);
    expect(Common.getTransactionsFromRequest({ body: [etchingHex, mintHex] } as Request)).toEqual([etchingHex, mintHex]);
  });

  test('rejects data that does not parse as a transaction', () => {
    for (const body of ['00', etchingHex.slice(0, -2), etchingHex + '00']) {
      expect(thrownBy(() => push(body))).toMatchObject({ code: -4, message: 'Invalid transaction (could not parse)' });
    }
    expect(thrownBy(() => Common.getTransactionsFromRequest({ body: [mintHex, '00'] } as Request))).toMatchObject({ code: -4 });
  });

  test('checks the transaction\'s size against MAX_PUSH_TX_SIZE_WEIGHT', () => {
    // Both limits are far from the etching's 4,431 bytes, whichever weight is
    // used. The test of qbit's weight near the limit is in the standardness
    // fix (#20).
    config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = 1_000;
    expect(thrownBy(() => push(etchingHex))).toMatchObject({ code: -3 });
    config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = 400_000;
    expect(push(etchingHex)).toBe(etchingHex);
  });

  test('finds OP_FALSE OP_IF in a leaf script with script.decompile and opcodes', () => {
    // With ALLOW_UNREACHABLE off, validateTransactionHex reads a script-path
    // spend's leaf script this way. This checks only bitcoinjs-lib's part, on
    // qbit's leaf scripts. Which inputs the check reads, with qbit's control
    // byte c1, is tested in the standardness fix (#20).
    const hasEnvelope = (leafScript: string): boolean => {
      const chunks = bitcoinjs.script.decompile(Buffer.from(leafScript, 'hex')) || [];
      return chunks.some((chunk, i) => chunk === bitcoinjs.opcodes.OP_FALSE && chunks[i + 1] === bitcoinjs.opcodes.OP_IF);
    };

    expect(hasEnvelope(etching.vin[0].witness[1])).toBe(true);
    expect(hasEnvelope(mint.vin[0].witness[1])).toBe(false);
  });
});

describe('TransactionUtils', () => {
  // Every input whose inner scripts electrs named: Bitcoin P2SH, P2SH-P2WSH,
  // P2WSH and P2TR script-path spends, and the qbit P2MR spends
  const inputs = [...randomTransactions, etching, mint]
    .flatMap((tx) => tx.vin.map((vin: IEsploraApi.Vin, i: number): [string, IEsploraApi.Vin] => [`${tx.txid}:${i}`, vin]))
    .filter(([, vin]) => vin.inner_redeemscript_asm || vin.inner_witnessscript_asm);

  test('has electrs-named inner scripts of each script type to compare', () => {
    const types = inputs.map(([, vin]) => vin.prevout?.scriptpubkey_type);
    expect(types).toEqual(expect.arrayContaining(['p2sh', 'v0_p2wsh', 'v1_p2tr', 'v2_p2mr']));
  });

  test.each(inputs)('names the inner scripts of input %s as electrs does', (_input, vin) => {
    const copy = { ...vin, inner_redeemscript_asm: '', inner_witnessscript_asm: '' };

    transactionUtils.addInnerScriptsToVin(copy);

    expect(copy.inner_redeemscript_asm).toBe(vin.inner_redeemscript_asm || '');
    expect(copy.inner_witnessscript_asm).toBe(vin.inner_witnessscript_asm || '');
  });

  test('counts the sigops of P2WSH and P2SH-P2WSH multisig witness scripts', () => {
    const hash = (algorithm: string, hex: string): string => crypto.createHash(algorithm).update(Buffer.from(hex, 'hex')).digest('hex');
    const keys = ['02' + '11'.repeat(32), '03' + '22'.repeat(32), '02' + '33'.repeat(32)];
    const twoOfThree = '52' + keys.map((key) => '21' + key).join('') + '53ae';
    const oneOfTwo = '51' + keys.slice(0, 2).map((key) => '21' + key).join('') + '52ae';
    const nestedProgram = '0020' + hash('sha256', oneOfTwo);
    const signature = '30' + '44'.repeat(70);
    const p2pkh = '55'.repeat(20);
    // The inputs and outputs as electrs serves them, with both script hex and ASM
    const tx = {
      vin: [
        {
          prevout: { scriptpubkey: '0020' + hash('sha256', twoOfThree), scriptpubkey_type: 'v0_p2wsh' },
          scriptsig: '',
          scriptsig_asm: '',
          witness: ['', signature, signature, twoOfThree],
        },
        {
          prevout: { scriptpubkey: 'a914' + hash('ripemd160', hash('sha256', nestedProgram)) + '87', scriptpubkey_type: 'p2sh' },
          scriptsig: '22' + nestedProgram,
          scriptsig_asm: 'OP_PUSHBYTES_34 ' + nestedProgram,
          witness: ['', signature, oneOfTwo],
        },
      ],
      vout: [{
        scriptpubkey: `76a914${p2pkh}88ac`,
        scriptpubkey_asm: `OP_DUP OP_HASH160 OP_PUSHBYTES_20 ${p2pkh} OP_EQUALVERIFY OP_CHECKSIG`,
        scriptpubkey_type: 'p2pkh',
      }],
    } as unknown as IEsploraApi.Transaction;

    // 3 for the 2-of-3, 2 for the 1-of-2 and 1 for the P2PKH output, as qbitd
    // counts them with a witness scale factor of 1
    expect(transactionUtils.countSigops(tx)).toBe(6);
  });
});

describe('parseAuxPowParentCoinbase', () => {
  test('names the P2PKH payouts of F2Pool\'s parent coinbase', () => {
    expect(parseAuxPowParentCoinbase(F2POOL_BLOCK_169697_HEADER)).toMatchObject({
      addresses: ['1K6KoYC69NnafWJ7YgtrpwJxBLiijWqwa6', '1AfCc4F9c4VTYSE31PUe2kUEKs6ZxiDjxm'],
      parentBlockHash: '000000000000000000064382ea6c04ae19b4387fc8c82e69427fdad65f5d3fe6',
    });
  });
});

describe('POST psbt/addparents', () => {
  let server: http.Server;
  let baseUrl: string;

  // BIP 174: the magic bytes, a global map holding the unsigned transaction,
  // then one map for each input and output. bitcoinjs-lib's Psbt reads and
  // writes the maps with bip174. The transaction spends the mint's 10,000-bit
  // P2MR output.
  const unsignedTx = serializeTx({
    version: 2,
    locktime: 0,
    vin: [{ txid: mint.txid, vout: 1, scriptsig: '', sequence: 0xfffffffd }],
    vout: [{ value: 9_000, scriptpubkey: mint.vout[1].scriptpubkey }],
  });
  const mintRaw = serializeTx(mint);
  const globalMap = Buffer.concat([Buffer.from('70736274ff0100', 'hex'), withLength(unsignedTx), Buffer.from('00', 'hex')]);
  const withoutParent = Buffer.concat([globalMap, Buffer.from('0000', 'hex')]);
  // input map: key 0x00 (PSBT_IN_NON_WITNESS_UTXO), the parent transaction
  const withParent = Buffer.concat([globalMap, Buffer.from('0100', 'hex'), withLength(mintRaw), Buffer.from('0000', 'hex')]);

  const post = (body: string): Promise<Response> => fetch(baseUrl + 'psbt/addparents', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body,
  });

  beforeAll(async () => {
    const app = express();
    app.use(express.text({ type: ['text/plain', 'application/base64'], limit: '10mb' }));
    bitcoinRoutes.initRoutes(app);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test.each(['base64', 'hex'] as const)('adds the parent transaction to an input without one, in %s', async (encoding) => {
    mockedApi.$getTransactionHex.mockResolvedValue(mintRaw.toString('hex'));

    const res = await post(withoutParent.toString(encoding));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(withParent.toString(encoding));
    expect(mockedApi.$getTransactionHex).toHaveBeenCalledWith(mint.txid);
  });

  test('answers 422 when no input lacks its parent, 404 when a parent is unknown, and 500 for a body that is not a PSBT', async () => {
    const complete = await post(withParent.toString('base64'));
    expect(complete.status).toBe(422);
    expect(await complete.json()).toEqual({ error: 'Psbt had no missing nonWitnessUtxos.' });

    mockedApi.$getTransactionHex.mockRejectedValue(new Error('Request failed with status code 404'));
    const unknown = await post(withoutParent.toString('base64'));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: `Couldn't get transaction hex for parent of input` });

    const garbage = await post('not a psbt');
    expect(garbage.status).toBe(500);
    expect(await garbage.json()).toEqual({ error: 'Failed to process PSBT' });
  });
});
