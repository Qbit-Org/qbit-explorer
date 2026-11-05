import { Common } from '../../api/common';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import config, { QbitNetwork } from '../../config';
import { MempoolTransactionExtended, TransactionExtended, TransactionFlags } from '../../mempool.interfaces';
import transactionUtils from '../../api/transaction-utils';

const randomTransactions = require('./test-data/transactions-random.json');
const replacedTransactions = require('./test-data/transactions-replaced.json');
const rbfTransactions = require('./test-data/transactions-rbfs.json');
const nonStandardTransactions = require('./test-data/non-standard-txs.json');
const qbitStandardTransactions = require('./test-data/qbit-standard-txs.json');

describe('Common', () => {
  describe('qbit dust policy', () => {
    const p2wpkhScript = '00140000000000000000000000000000000000000000';
    const p2pkhScript = '76a914000000000000000000000000000000000000000088ac';

    function transactionWithOutput(value: number): TransactionExtended {
      return {
        txid: 'dust-borderline',
        version: 2,
        locktime: 0,
        size: 100,
        weight: 400,
        fee: 1000,
        vsize: 100,
        feePerVsize: 10,
        effectiveFeePerVsize: 10,
        status: { confirmed: false },
        vin: [{
          txid: '00'.repeat(32),
          vout: 0,
          prevout: {
            scriptpubkey: p2wpkhScript,
            scriptpubkey_asm: 'OP_0 OP_PUSHBYTES_20 0000000000000000000000000000000000000000',
            scriptpubkey_type: 'v0_p2wpkh',
            scriptpubkey_address: 'bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9e75rs',
            value: 1000,
          },
          scriptsig: '',
          scriptsig_asm: '',
          inner_redeemscript_asm: '',
          inner_witnessscript_asm: '',
          witness: [],
          is_coinbase: false,
          sequence: 0xffffffff,
        }],
        vout: [{
          scriptpubkey: p2wpkhScript,
          scriptpubkey_asm: 'OP_0 OP_PUSHBYTES_20 0000000000000000000000000000000000000000',
          scriptpubkey_type: 'v0_p2wpkh',
          scriptpubkey_address: 'bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9e75rs',
          value,
        }],
      } as TransactionExtended;
    }

    test('calculates qbit dust thresholds with Core sat/kvB rounding', () => {
      expect(Common.getDustThreshold(p2wpkhScript)).toBe(73);
      expect(Common.getDustThreshold(p2pkhScript)).toBe(136);
    });

    test('does not treat the exact qbit dust threshold as dust', () => {
      const threshold = Common.getDustThreshold(p2wpkhScript);

      expect(Common.isNonStandard(transactionWithOutput(threshold - 1))).toBe(true);
      expect(Common.isNonStandard(transactionWithOutput(threshold))).toBe(false);
    });
  });

  describe('qbit standardness policy', () => {
    // qbit enforces these rules from genesis, far below Bitcoin's activation heights
    const qbitHeights: [QbitNetwork, number | undefined][] = [
      ['mainnet', 158_366],
      ['mainnet', undefined],
      ['testnet4', 10_000],
      ['regtest', 101],
    ];
    const p2mrOutput = (value: number): IEsploraApi.Vout => ({
      scriptpubkey: `5220${'11'.repeat(32)}`,
      scriptpubkey_asm: `OP_PUSHNUM_2 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
      scriptpubkey_type: 'v2_p2mr',
      value,
    });
    const anchorOutput = (value: number): IEsploraApi.Vout => ({
      scriptpubkey: '51024e73',
      scriptpubkey_asm: 'OP_PUSHNUM_1 OP_PUSHBYTES_2 4e73',
      scriptpubkey_type: 'anchor',
      value,
    });
    const p2pkOutput: IEsploraApi.Vout = {
      scriptpubkey: `2102${'11'.repeat(32)}ac`,
      scriptpubkey_asm: `OP_PUSHBYTES_33 02${'11'.repeat(32)} OP_CHECKSIG`,
      scriptpubkey_type: 'p2pk',
      value: 100_000,
    };
    const nonStandardOutput: IEsploraApi.Vout = {
      scriptpubkey: 'ff',
      scriptpubkey_asm: 'OP_INVALIDOPCODE',
      scriptpubkey_type: 'nonstandard',
      value: 100_000,
    };

    // OP_RETURN followed by a single push of dataBytes bytes
    function opReturnOutput(dataBytes: number): IEsploraApi.Vout {
      const data = 'ab'.repeat(dataBytes);
      let push = dataBytes.toString(16).padStart(2, '0');
      if (dataBytes > 0xff) {
        push = `4d${(dataBytes & 0xff).toString(16).padStart(2, '0')}${(dataBytes >> 8).toString(16).padStart(2, '0')}`;
      } else if (dataBytes > 75) {
        push = `4c${push}`;
      }
      return { scriptpubkey: `6a${push}${data}`, scriptpubkey_asm: `OP_RETURN ${data}`, scriptpubkey_type: 'op_return', value: 0 };
    }

    function input(prevout: IEsploraApi.Vout, scriptsig = '', scriptsig_asm = ''): IEsploraApi.Vin {
      return {
        txid: '22'.repeat(32),
        vout: 0,
        prevout,
        scriptsig,
        scriptsig_asm,
        inner_redeemscript_asm: '',
        inner_witnessscript_asm: '',
        witness: [],
        is_coinbase: false,
        sequence: 0xfffffffd,
      };
    }

    function qbitTransaction({
      version = 2,
      fee = 1000,
      vin = [input(p2mrOutput(100_000))],
      vout = [p2mrOutput(99_000)],
    }: { version?: number, fee?: number, vin?: IEsploraApi.Vin[], vout?: IEsploraApi.Vout[] } = {}): TransactionExtended {
      // qbit has no witness discount, and these inputs carry no witness, so weight is the serialized size
      const weight = 10
        + vin.reduce((size, txin) => size + 41 + txin.scriptsig.length / 2, 0)
        + vout.reduce((size, txout) => size + 9 + txout.scriptpubkey.length / 2, 0);
      return {
        txid: 'qbit-standardness',
        version,
        locktime: 0,
        size: weight,
        weight,
        fee,
        vsize: weight,
        feePerVsize: fee / weight,
        effectiveFeePerVsize: fee / weight,
        sigops: 0,
        status: { confirmed: false },
        vin,
        vout,
      } as TransactionExtended;
    }

    // each P2PK prevout carries one legacy sigop that the BIP54 limit counts at spend time
    function legacySigopsTransaction(inputs: number): TransactionExtended {
      const signature = '30'.repeat(71);
      return qbitTransaction({
        vin: Array.from({ length: inputs }, () => input(p2pkOutput, `47${signature}`, `OP_PUSHBYTES_71 ${signature}`)),
      });
    }

    const standardCases: [string, () => TransactionExtended][] = [
      ['a v3 (TRUC) transaction', () => qbitTransaction({ version: 3 })],
      ['an anchor spend', () => qbitTransaction({ vin: [input(anchorOutput(0)), input(p2mrOutput(100_000))] })],
      ['an OP_RETURN above 83 bytes', () => qbitTransaction({ vout: [opReturnOutput(160), p2mrOutput(99_000)] })],
      ['multiple OP_RETURN outputs', () => qbitTransaction({ vout: [opReturnOutput(20), opReturnOutput(20), p2mrOutput(99_000)] })],
      ['OP_RETURN outputs that fill the 200,000 byte budget', () => qbitTransaction({ vout: [...Array(4)].map(() => opReturnOutput(49_996)) })],
      ['ephemeral dust in a zero-fee transaction', () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(100_000)] })],
      ['2,500 legacy sigops', () => legacySigopsTransaction(2_500)],
    ];

    const nonStandardCases: [string, () => TransactionExtended][] = [
      ['a v4 transaction', () => qbitTransaction({ version: 4 })],
      ['OP_RETURN outputs over the 200,000 byte budget', () => qbitTransaction({ vout: [...[...Array(3)].map(() => opReturnOutput(49_996)), opReturnOutput(49_997)] })],
      ['dust in a fee-paying transaction', () => qbitTransaction({ version: 3, vout: [anchorOutput(0), p2mrOutput(99_000)] })],
      ['two dust outputs in a zero-fee transaction', () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(1), p2mrOutput(99_999)] })],
      ['ephemeral dust followed by a non-standard output', () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), nonStandardOutput] })],
      ['2,501 legacy sigops', () => legacySigopsTransaction(2_501)],
    ];

    const originalNetwork = config.MEMPOOL.NETWORK;
    afterEach(() => {
      config.MEMPOOL.NETWORK = originalNetwork;
    });

    describe.each(qbitHeights)('on %s at height %p', (network, height) => {
      beforeEach(() => {
        config.MEMPOOL.NETWORK = network;
      });

      test.each(standardCases)('treats %s as standard', (_name, buildTransaction) => {
        expect(Common.isNonStandard(buildTransaction(), height)).toBe(false);
      });

      test.each(nonStandardCases)('flags %s as non-standard', (_name, buildTransaction) => {
        expect(Common.isNonStandard(buildTransaction(), height)).toBe(true);
      });
    });

    test('treats real qbit mainnet v3 transactions as standard at their mined height', () => {
      config.MEMPOOL.NETWORK = 'mainnet';
      qbitStandardTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx, tx.status.block_height)).toBe(false);
      });
    });
  });

  describe('qbit script type transaction classification', () => {
    const p2mrScript = '52200000000000000000000000000000000000000000000000000000000000000000';
    const p2mrAsm = 'OP_2 OP_PUSHBYTES_32 0000000000000000000000000000000000000000000000000000000000000000';
    const p2mrAddress = 'tq1zqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdagu6k';
    const anchorScript = '51024e73';
    const anchorAsm = 'OP_1 OP_PUSHBYTES_2 4e73';
    const anchorAddress = 'tq1pfeespgdghm';
    const p2pkhOutput = {
      scriptpubkey: '76a914000000000000000000000000000000000000000088ac',
      scriptpubkey_asm: 'OP_DUP OP_HASH160 OP_PUSHBYTES_20 0000000000000000000000000000000000000000 OP_EQUALVERIFY OP_CHECKSIG',
      scriptpubkey_type: 'p2pkh',
      scriptpubkey_address: 'qHZPA2maCec991jPwLyFC3fQXXvCQKGhkU',
      value: 100000,
    };

    function transactionWithScriptTypes(prevout = p2pkhOutput, vout = p2pkhOutput): TransactionExtended {
      return {
        txid: `${prevout.scriptpubkey_type}-to-${vout.scriptpubkey_type}-classification`,
        version: 2,
        locktime: 0,
        size: 100,
        weight: 100,
        fee: 1000,
        vsize: 100,
        feePerVsize: 10,
        effectiveFeePerVsize: 10,
        status: { confirmed: false },
        vin: [{
          txid: '00'.repeat(32),
          vout: 0,
          prevout: {
            ...prevout,
          },
          scriptsig: '',
          scriptsig_asm: '',
          inner_redeemscript_asm: '',
          inner_witnessscript_asm: '',
          witness: [],
          is_coinbase: false,
          sequence: 0xffffffff,
        }],
        vout: [{
          ...vout,
          value: 90000,
        }],
      } as TransactionExtended;
    }

    function scriptOutput(scriptpubkey_type: string, scriptpubkey: string, scriptpubkey_asm: string, scriptpubkey_address: string): typeof p2pkhOutput {
      return {
        scriptpubkey,
        scriptpubkey_asm,
        scriptpubkey_type,
        scriptpubkey_address,
        value: 100000,
      };
    }

    test.each(['v2_p2mr', 'witness_v2_p2mr'])('sets P2MR flags for %s inputs', (scriptpubkey_type) => {
      const tx = transactionWithScriptTypes(scriptOutput(scriptpubkey_type, p2mrScript, p2mrAsm, p2mrAddress));

      const flags = BigInt(Common.getTransactionFlags(tx));

      expect(flags & TransactionFlags.p2mr).toBe(TransactionFlags.p2mr);
      expect(flags & TransactionFlags.p2tr).toBe(0n);
    });

    test.each(['v2_p2mr', 'witness_v2_p2mr'])('sets P2MR flags for %s outputs', (scriptpubkey_type) => {
      const tx = transactionWithScriptTypes(p2pkhOutput, scriptOutput(scriptpubkey_type, p2mrScript, p2mrAsm, p2mrAddress));

      const flags = BigInt(Common.getTransactionFlags(tx));

      expect(flags & TransactionFlags.p2mr).toBe(TransactionFlags.p2mr);
      expect(flags & TransactionFlags.p2tr).toBe(0n);
    });

    test('sets anchor flags for anchor inputs', () => {
      const tx = transactionWithScriptTypes(scriptOutput('anchor', anchorScript, anchorAsm, anchorAddress));

      const flags = BigInt(Common.getTransactionFlags(tx));

      expect(flags & TransactionFlags.anchor).toBe(TransactionFlags.anchor);
      expect(flags & TransactionFlags.p2tr).toBe(0n);
    });

    test('sets anchor flags for anchor outputs', () => {
      const tx = transactionWithScriptTypes(p2pkhOutput, scriptOutput('anchor', anchorScript, anchorAsm, anchorAddress));

      const flags = BigInt(Common.getTransactionFlags(tx));

      expect(flags & TransactionFlags.anchor).toBe(TransactionFlags.anchor);
      expect(flags & TransactionFlags.p2tr).toBe(0n);
    });
  });

  describe('qbit script ASM', () => {
    test('renders opcode 0xb3 as OP_CHECKSIGPQC', () => {
      expect(transactionUtils.convertScriptSigAsm('b3')).toBe('OP_CHECKSIGPQC');
      expect(transactionUtils.convertScriptSigAsm('b3ac')).toBe('OP_CHECKSIGPQC OP_CHECKSIG');
    });
  });

  describe('qbit witness scale factor', () => {
    const tx = {
      txid: 'qbit-weight-vsize',
      version: 2,
      locktime: 0,
      size: 400,
      weight: 400,
      fee: 100,
      status: { confirmed: false },
      sigops: 0,
      vin: [],
      vout: [{ value: 1000 }],
    } as unknown as TransactionExtended;

    test('uses weight as transaction virtual size', () => {
      const extended = transactionUtils.extendMempoolTransaction({ ...tx });

      expect(extended.vsize).toBe(400);
      expect(extended.feePerVsize).toBe(0.25);
      expect(extended.adjustedVsize).toBe(400);
    });

    test('uses qbit bytes-per-sigop when adjusted virtual size is sigop-bound', () => {
      const extended = transactionUtils.extendMempoolTransaction({ ...tx, weight: 100, sigops: 30 });

      expect(extended.adjustedVsize).toBe(600);
      expect(extended.adjustedFeePerVsize).toBeCloseTo(100 / 600);
    });

    test('strips transaction summaries with qbit vsize', () => {
      expect(Common.stripTransaction(tx).vsize).toBe(400);
    });
  });

  describe('RBF', () => {
    const newTransactions = rbfTransactions.concat(randomTransactions);
    test('should detect RBF transactions with fast method', () => {
      const result: { [txid: string]: { replaced: MempoolTransactionExtended[], replacedBy: TransactionExtended }} = Common.findRbfTransactions(newTransactions, replacedTransactions);
      expect(Object.values(result).length).toEqual(2);
      expect(result).toHaveProperty('7219d95161f3718335991ac6d967d24eedec370908c9879bb1e192e6d797d0a6');
      expect(result).toHaveProperty('5387881d695d4564d397026dc5f740f816f8390b4b2c5ec8c20309122712a875');
    });

    test('should detect RBF transactions with scalable method', () => {
      const result: { [txid: string]: { replaced: MempoolTransactionExtended[], replacedBy: TransactionExtended }} = Common.findRbfTransactions(newTransactions, replacedTransactions, true);
      expect(Object.values(result).length).toEqual(2);
      expect(result).toHaveProperty('7219d95161f3718335991ac6d967d24eedec370908c9879bb1e192e6d797d0a6');
      expect(result).toHaveProperty('5387881d695d4564d397026dc5f740f816f8390b4b2c5ec8c20309122712a875');
    });
  });

  describe('Mempool Goggles', () => {
    test('should detect nonstandard transactions', () => {
      nonStandardTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(true);
      });
    });

    test('should not misclassify as nonstandard transactions', () => {
      randomTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx)).toEqual(false);
      });
    });
  });

  describe('Effective Fee Statistics', () => {
    test('returns safe defaults for blocks with only coinbase', () => {
      const coinbaseTx = { weight: 1000, fee: 0, txid: 'coinbase0' };
      const result = Common.calcEffectiveFeeStatistics([coinbaseTx]);

      expect(result.medianFee).toBe(0);
      expect(result.feeRange).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    test('excludes coinbase from fee stats when multiple txs', () => {
      const coinbaseTx = { weight: 1000, fee: 0, txid: 'coinbase0' };
      const tx1 = { weight: 400, fee: 100, txid: 'tx1' }; // qbit vsize 400, rate 0.25 sat/vB
      const tx2 = { weight: 400, fee: 250, txid: 'tx2' }; // qbit vsize 400, rate 0.625 sat/vB

      const result = Common.calcEffectiveFeeStatistics([coinbaseTx, tx1, tx2]);

      // Verify that coinbase (fee 0) was excluded from stats
      // Fee range min/max should be > 0 (not affected by coinbase's 0 fee)
      expect(result.feeRange[0]).toBeGreaterThan(0); // min fee
      expect(result.feeRange[6]).toBeGreaterThan(0); // max fee
    });
  });
});
