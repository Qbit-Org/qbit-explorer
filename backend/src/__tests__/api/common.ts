import * as bitcoinjs from 'bitcoinjs-lib';
import { Request } from 'express';
import { Common } from '../../api/common';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import config, { QbitNetwork } from '../../config';
import { MempoolTransactionExtended, TransactionExtended, TransactionFlags } from '../../mempool.interfaces';
import transactionUtils from '../../api/transaction-utils';
import { getTransactionWeight } from '../../utils/weight-units';
import {
  asmVectors, bytes, dustThresholdVectors, input, p2trOutput, qbitHeights, qbitTransaction, realTransactionVectors, serializeTransaction,
  StandardnessVector, standardnessVectors, VectorTransaction, weightVectors, witnessSize,
} from '../fixtures/qbit-standardness-vectors';

const randomTransactions = require('./test-data/transactions-random.json');
const replacedTransactions = require('./test-data/transactions-replaced.json');
const rbfTransactions = require('./test-data/transactions-rbfs.json');
const nonStandardTransactions = require('./test-data/non-standard-txs.json');
const qbitStandardTransactions = require('./test-data/qbit-standard-txs.json');

describe('Common', () => {
  describe('qbit dust policy', () => {
    const p2wpkhScript = '00140000000000000000000000000000000000000000';

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

    // shared with the frontend smoke
    test.each(dustThresholdVectors)('calculates the qbit dust threshold of %s', (_name, scriptpubkey, threshold) => {
      expect(Common.getDustThreshold(scriptpubkey)).toBe(threshold);
    });

    test('does not treat the exact qbit dust threshold as dust', () => {
      const threshold = Common.getDustThreshold(p2wpkhScript);

      expect(Common.isNonStandard(transactionWithOutput(threshold - 1))).toBe(true);
      expect(Common.isNonStandard(transactionWithOutput(threshold))).toBe(false);
    });
  });

  describe('qbit standardness policy', () => {
    const originalNetwork = config.MEMPOOL.NETWORK;
    afterEach(() => {
      config.MEMPOOL.NETWORK = originalNetwork;
    });

    const asTransaction = (tx: VectorTransaction): TransactionExtended => tx as unknown as TransactionExtended;
    const named = (vectors: StandardnessVector[]): [string, StandardnessVector][] => vectors.map(vector => [vector.name, vector]);

    // the vectors the frontend smoke runs too (src/__tests__/fixtures/qbit-standardness-vectors.ts)
    describe.each(qbitHeights)('on %s at height %p', (network, height) => {
      beforeEach(() => {
        config.MEMPOOL.NETWORK = network as QbitNetwork;
      });

      test.each(named(standardnessVectors.filter(vector => !vector.nonStandard)))('treats %s as standard', (_name, vector) => {
        expect(Common.isNonStandard(asTransaction(vector.tx()), height)).toBe(false);
      });

      test.each(named(standardnessVectors.filter(vector => vector.nonStandard)))('flags %s as non-standard', (_name, vector) => {
        expect(Common.isNonStandard(asTransaction(vector.tx()), height)).toBe(true);
      });
    });

    test('treats real qbit mainnet v3 transactions as standard at their mined height', () => {
      config.MEMPOOL.NETWORK = 'mainnet';
      qbitStandardTransactions.forEach((tx) => {
        expect(Common.isNonStandard(tx, tx.status.block_height)).toBe(false);
      });
    });

    describe('with real qbit mainnet P2MR spends', () => {
      // etching and mint are single-key P2MR spends: a 3,680-byte PQC signature, a leaf script and the control byte c1
      const { etching, mint } = require('./test-data/qbit-p2mr-qscriptions.json');

      // replace the first input's witness, and keep the weight in step with the serialized size (WSF=1)
      function withWitness(tx: TransactionExtended, witness: string[]): TransactionExtended {
        return {
          ...tx,
          weight: tx.weight - witnessSize(tx.vin[0].witness) + witnessSize(witness),
          vin: [{ ...tx.vin[0], witness }, ...tx.vin.slice(1)],
        };
      }

      function withOutputValue(tx: TransactionExtended, index: number, value: number): TransactionExtended {
        return { ...tx, vout: tx.vout.map((vout, i) => (i === index ? { ...vout, value } : vout)) };
      }

      beforeEach(() => {
        config.MEMPOOL.NETWORK = 'mainnet';
      });

      test('treats them as standard at their mined height', () => {
        for (const tx of [etching, mint]) {
          expect(Common.isNonStandard(tx, tx.status.block_height)).toBe(false);
        }
      });

      test('flags a P2MR payment below the P2MR dust threshold', () => {
        expect(mint.vout[1].scriptpubkey_type).toBe('v2_p2mr');
        expect(Common.isNonStandard(withOutputValue(mint, 1, 2_855), mint.status.block_height)).toBe(false);
        expect(Common.isNonStandard(withOutputValue(mint, 1, 2_854), mint.status.block_height)).toBe(true);
      });

      test('flags a P2MR spend that carries an annex, and sets its annex flag', () => {
        const tx = withWitness(mint, [...mint.vin[0].witness, '50']);

        const flags = BigInt(Common.getTransactionFlags(tx, mint.status.block_height));

        expect(flags & TransactionFlags.annex).toBe(TransactionFlags.annex);
        expect(flags & TransactionFlags.nonstandard).toBe(TransactionFlags.nonstandard);
        expect(BigInt(Common.getTransactionFlags(mint, mint.status.block_height)) & TransactionFlags.annex).toBe(0n);
      });

      test('flags a P2MR spend of a leaf version reserved for upgrades', () => {
        const [signature, leafScript] = mint.vin[0].witness;

        expect(Common.isNonStandard(withWitness(mint, [signature, leafScript, 'c3']), mint.status.block_height)).toBe(true);
      });

      test('flags P2MR leaf script arguments over the stack item limit', () => {
        const [, leafScript, controlBlock] = mint.vin[0].witness;

        expect(Common.isNonStandard(withWitness(mint, [bytes(16_384), leafScript, controlBlock]), mint.status.block_height)).toBe(false);
        expect(Common.isNonStandard(withWitness(mint, [bytes(16_385), leafScript, controlBlock]), mint.status.block_height)).toBe(true);
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

  describe('qbit P2MR qscriptions', () => {
    // etching: qbit mainnet 2de5d758…adac8, which qscribes POST•QUANTUM•GOODS's logo (qscription 61, a
    // 525-byte SVG) in its P2MR leaf script and etches the qrune. mint: 4eced44e…5fc7, which mints it
    // from a P2MR input whose leaf script is a plain <pubkey> OP_CHECKSIGPQC, with no envelope.
    const { etching, mint } = require('./test-data/qbit-p2mr-qscriptions.json');

    // Non-esplora backends see block transactions without prevouts, so without inner scripts either.
    function withoutPrevouts(tx: TransactionExtended): TransactionExtended {
      return { ...tx, vin: tx.vin.map(({ prevout, inner_witnessscript_asm, ...vin }) => vin as IEsploraApi.Vin) };
    }

    test('flags a P2MR qscription reveal as an inscription', () => {
      const flags = BigInt(Common.getTransactionFlags(etching));

      expect(flags & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
      expect(flags & TransactionFlags.p2mr).toBe(TransactionFlags.p2mr);
    });

    test('flags a P2MR qscription reveal without prevouts', () => {
      const flags = BigInt(Common.getTransactionFlags(withoutPrevouts(etching)));

      expect(flags & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
    });

    test.each([
      ['with prevouts', (tx: TransactionExtended): TransactionExtended => tx],
      ['without prevouts', withoutPrevouts],
    ])('does not flag a P2MR spend without an envelope %s', (_name, prepare) => {
      const flags = BigInt(Common.getTransactionFlags(prepare(mint)));

      expect(flags & TransactionFlags.inscription).toBe(0n);
    });

    test('flags a P2MR leaf script that takes no arguments, without prevouts', () => {
      // a 65-byte leaf script as the first witness item makes the taproot heuristic read witness[2], which
      // does not exist, so the P2MR check must run first
      const leafScript = '0063036f7264' + '51'.repeat(58) + '68'; // OP_0 OP_IF "ord" ... OP_ENDIF, 65 bytes
      const tx = withoutPrevouts(etching);
      tx.vin = [{ ...tx.vin[0], witness: [leafScript, 'c1'] }];

      const flags = BigInt(Common.getTransactionFlags(tx));

      expect(flags & TransactionFlags.inscription).toBe(TransactionFlags.inscription);
    });

    test('does not throw on a two-item witness the taproot heuristic cannot parse, without prevouts', () => {
      // a 65-byte first item and an annex: the taproot heuristic reads the missing witness[2]
      const tx = withoutPrevouts(mint);
      tx.vin = [{ ...tx.vin[0], witness: ['00'.repeat(65), '50'] }];

      expect(() => Common.getTransactionFlags(tx)).not.toThrow();
    });

    test('recognises the witness shape of a signed P2MR script-path spend', () => {
      const vin: IEsploraApi.Vin = etching.vin[0];
      const [signature, leafScript, controlBlock] = vin.witness;
      const shape = (witness: string[], scriptsig = ''): boolean => Common.inputIsMaybeP2mrInscription({ ...vin, scriptsig, witness });

      expect(controlBlock).toBe('c1'); // a single-leaf tree: leaf version 0xc0, with bit 0 set
      expect(shape([signature, leafScript, controlBlock])).toBe(true);
      expect(shape([signature + '01', leafScript, controlBlock])).toBe(true); // sighash byte after the signature
      expect(shape(['', signature, leafScript, controlBlock])).toBe(true); // other leaf script arguments
      expect(shape([leafScript, controlBlock])).toBe(true); // a leaf script that takes no arguments
      expect(shape([signature, leafScript, controlBlock + '00'.repeat(32)])).toBe(true); // one merkle node
      expect(shape([signature, leafScript, controlBlock, '50'])).toBe(true); // annex

      expect(shape([signature, leafScript, controlBlock], '00')).toBe(false); // scriptsig
      expect(shape([signature, leafScript, 'c0'])).toBe(false); // control byte without bit 0
      expect(shape([signature, leafScript, controlBlock + '00'])).toBe(false); // control block of 2 bytes
      expect(shape([controlBlock])).toBe(false); // no leaf script
      expect(shape(['30'.repeat(71), '02' + '00'.repeat(32)])).toBe(false); // P2WPKH: signature, compressed pubkey
    });
  });

  describe('qbit script ASM', () => {
    test('renders opcode 0xb3 as OP_CHECKSIGPQC', () => {
      expect(transactionUtils.convertScriptSigAsm('b3')).toBe('OP_CHECKSIGPQC');
      expect(transactionUtils.convertScriptSigAsm('b3ac')).toBe('OP_CHECKSIGPQC OP_CHECKSIG');
    });

    // shared with the frontend smoke
    test.each(asmVectors)('renders %s as qbitd and qbit-electrs do', (_name, script, asm) => {
      expect(transactionUtils.convertScriptSigAsm(script)).toBe(asm);
    });

    test.each(realTransactionVectors)('reads the leaf scripts of %s %s as qbit-electrs printed them', (file, key) => {
      const tx: TransactionExtended = require(`./test-data/${file}`)[key];
      for (const vin of tx.vin) {
        const decoded = { ...vin, inner_witnessscript_asm: undefined } as unknown as IEsploraApi.Vin;
        transactionUtils.addInnerScriptsToVin(decoded);
        expect(decoded.inner_witnessscript_asm).toBe(vin.inner_witnessscript_asm);
      }
    });
  });

  describe('qbit transaction weight', () => {
    const push = (hex: string): string => Common.getTransactionFromRequest({ body: hex } as Request, false);
    const qbitWeight = (hex: string): number => {
      const tx = bitcoinjs.Transaction.fromHex(hex);
      return getTransactionWeight(tx.byteLength(false), tx.byteLength());
    };
    const { MAX_PUSH_TX_SIZE_WEIGHT, ALLOW_UNREACHABLE } = config.MEMPOOL;
    beforeEach(() => {
      config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = 400_000;
      // the etching's leaf script holds an OP_FALSE OP_IF envelope
      config.MEMPOOL.ALLOW_UNREACHABLE = true;
    });
    afterEach(() => {
      Object.assign(config.MEMPOOL, { MAX_PUSH_TX_SIZE_WEIGHT, ALLOW_UNREACHABLE });
    });

    test('pushes a transaction up to MAX_PUSH_TX_SIZE_WEIGHT of qbit weight, not Bitcoin weight', () => {
      // the etching is 4,431 bytes, its qbit weight, and 4,842 Bitcoin weight units
      const hex = serializeTransaction(require('./test-data/qbit-p2mr-qscriptions.json').etching);
      expect(bitcoinjs.Transaction.fromHex(hex).weight()).toBe(4_842);
      config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = 4_431;
      expect(push(hex)).toBe(hex);
      config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = 4_430;
      expect(() => push(hex)).toThrow('Transaction too large (max 4430 weight units)');
    });

    // shared with the frontend smoke
    test.each(weightVectors)('weighs %s as qbitd does, and pushes it only within MAX_PUSH_TX_SIZE_WEIGHT', (_name, buildHex, weight) => {
      const hex = buildHex();
      expect(qbitWeight(hex)).toBe(weight);
      if (weight <= config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT) {
        expect(push(hex)).toBe(hex);
      } else {
        expect(() => push(hex)).toThrow(`Transaction too large (max ${config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT} weight units)`);
      }
    });

    test.each(realTransactionVectors)('weighs %s %s as qbit-electrs reported it, and pushes it', (file, key) => {
      const tx: TransactionExtended = require(`./test-data/${file}`)[key];
      const hex = serializeTransaction(tx);
      expect(qbitWeight(hex)).toBe(tx.weight);
      expect(push(hex)).toBe(hex);
    });
  });

  describe('unreachable leaf scripts in pushed transactions', () => {
    const push = (hex: string): string => Common.getTransactionFromRequest({ body: hex } as Request, false);
    const pushError = (hex: string): unknown => {
      try {
        push(hex);
      } catch (e) {
        return e;
      }
    };
    const { etching, mint } = require('./test-data/qbit-p2mr-qscriptions.json');
    const { MAX_PUSH_TX_SIZE_WEIGHT, ALLOW_UNREACHABLE } = config.MEMPOOL;
    beforeEach(() => {
      config.MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT = 400_000;
    });
    afterEach(() => {
      Object.assign(config.MEMPOOL, { MAX_PUSH_TX_SIZE_WEIGHT, ALLOW_UNREACHABLE });
    });

    test('refuses a P2MR spend whose leaf script holds OP_FALSE OP_IF, unless ALLOW_UNREACHABLE', () => {
      // P2MR control bytes always set bit 0: the etching's is c1, for leaf version 0xc0
      expect(etching.vin[0].witness[2]).toBe('c1');
      const hex = serializeTransaction(etching);
      config.MEMPOOL.ALLOW_UNREACHABLE = false;
      expect(pushError(hex)).toMatchObject({ code: -5, message: 'Unreachable taproot scripts not allowed' });
      // the mint's leaf script holds no envelope
      expect(push(serializeTransaction(mint))).toBe(serializeTransaction(mint));
      config.MEMPOOL.ALLOW_UNREACHABLE = true;
      expect(push(hex)).toBe(hex);
    });

    test.each(['c0', 'c1'])('refuses a taproot spend with control byte %s, of either parity, whose script holds OP_FALSE OP_IF', (controlByte) => {
      // OP_FALSE OP_IF 'ord' OP_ENDIF OP_TRUE
      const tx = qbitTransaction({ vin: [input(p2trOutput, '', '', [bytes(64), '0063036f72646851', `${controlByte}${'11'.repeat(32)}`])] });
      config.MEMPOOL.ALLOW_UNREACHABLE = false;
      expect(pushError(serializeTransaction(tx))).toMatchObject({ code: -5 });
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
