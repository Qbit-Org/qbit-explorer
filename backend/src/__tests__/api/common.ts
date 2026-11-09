import { Common } from '../../api/common';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import config, { QbitNetwork } from '../../config';
import { MempoolTransactionExtended, TransactionExtended, TransactionFlags } from '../../mempool.interfaces';
import transactionUtils from '../../api/transaction-utils';
import { getVarIntLength } from '../../utils/bitcoin-script';

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

    // the thresholds qbit v1.0.0 pins in src/test/transaction_tests.cpp: every output but P2MR is priced
    // with the 148-byte legacy spend, as qbit has no witness discount, and the fee is rounded up
    test.each([
      ['compressed P2PK', `21${'02'.repeat(33)}ac`, 144],
      ['uncompressed P2PK', `41${'04'.repeat(65)}ac`, 168],
      ['P2PKH', p2pkhScript, 137],
      ['P2SH', `a914${'00'.repeat(20)}87`, 135],
      ['P2WPKH', p2wpkhScript, 135],
      ['P2WSH', `0020${'00'.repeat(32)}`, 144],
      ['P2TR', `5120${'00'.repeat(32)}`, 144],
      ['P2MR', `5220${'00'.repeat(32)}`, 2855],
      ['an unknown witness v1 program', '51020000', 121],
      ['an unknown witness v2 program', '52020000', 121],
      ['an anchor', '51024e73', 121],
      ['an OP_RETURN', `6a14${'00'.repeat(20)}`, 0],
    ])('calculates the qbit dust threshold of %s', (_name, scriptpubkey, threshold) => {
      expect(Common.getDustThreshold(scriptpubkey)).toBe(threshold);
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

    const p2trOutput: IEsploraApi.Vout = {
      scriptpubkey: `5120${'11'.repeat(32)}`,
      scriptpubkey_asm: `OP_PUSHNUM_1 OP_PUSHBYTES_32 ${'11'.repeat(32)}`,
      scriptpubkey_type: 'v1_p2tr',
      value: 100_000,
    };
    // a 2-byte witness program, which no witness version defines
    const witnessOutput = (version: number, value = 100_000): IEsploraApi.Vout => ({
      scriptpubkey: `${(0x50 + version).toString(16)}020000`,
      scriptpubkey_asm: `OP_PUSHNUM_${version} OP_PUSHBYTES_2 0000`,
      scriptpubkey_type: 'unknown',
      value,
    });
    // control blocks for a single leaf: tapscript is leaf version 0xc0 with a 32-byte internal key,
    // and a P2MR v1 leaf is the control byte 0xc0 with bit 0 set
    const tapscriptControlBlock = `c0${'11'.repeat(32)}`;
    const p2mrControlBlock = 'c1';
    const p2mrSpend = (...witness: string[]): IEsploraApi.Vin => input(p2mrOutput(100_000), '', '', witness);
    const p2trSpend = (...witness: string[]): IEsploraApi.Vin => input(p2trOutput, '', '', witness);
    const bytes = (length: number): string => '00'.repeat(length);

    function input(prevout: IEsploraApi.Vout, scriptsig = '', scriptsig_asm = '', witness: string[] = []): IEsploraApi.Vin {
      return {
        txid: '22'.repeat(32),
        vout: 0,
        prevout,
        scriptsig,
        scriptsig_asm,
        inner_redeemscript_asm: '',
        inner_witnessscript_asm: '',
        witness,
        is_coinbase: false,
        sequence: 0xfffffffd,
      };
    }

    function witnessSize(witness: string[]): number {
      return getVarIntLength(witness.length) + witness.reduce((size, item) => size + getVarIntLength(item.length / 2) + item.length / 2, 0);
    }

    function qbitTransaction({
      version = 2,
      fee = 1000,
      vin = [input(p2mrOutput(100_000))],
      vout = [p2mrOutput(99_000)],
    }: { version?: number, fee?: number, vin?: IEsploraApi.Vin[], vout?: IEsploraApi.Vout[] } = {}): TransactionExtended {
      // qbit has no witness discount, so weight is the serialized size, with the witness marker and flag
      // and each input's witness when any input has one
      const witnesses = vin.filter(txin => txin.witness.length);
      const weight = 10
        + vin.reduce((size, txin) => size + 41 + txin.scriptsig.length / 2, 0)
        + vout.reduce((size, txout) => size + 9 + txout.scriptpubkey.length / 2, 0)
        + (witnesses.length ? 2 + witnesses.reduce((size, txin) => size + witnessSize(txin.witness), 0) : 0);
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

    // a single-key P2MR spend: a PQC signature with its sighash byte, then <pubkey> OP_CHECKSIGPQC
    const p2mrLeafScript = `20${'11'.repeat(32)}b3`;
    const singleKeyP2mrSpends = (inputs: number): IEsploraApi.Vin[] => Array.from({ length: inputs }, () => p2mrSpend(bytes(3_681), p2mrLeafScript, p2mrControlBlock));
    // another taproot leaf version, which has no stack item limit
    const otherLeafControlBlock = `c2${'11'.repeat(32)}`;

    const standardCases: [string, () => TransactionExtended][] = [
      ['a v3 (TRUC) transaction', () => qbitTransaction({ version: 3 })],
      ['an anchor spend', () => qbitTransaction({ vin: [input(anchorOutput(0)), input(p2mrOutput(100_000))] })],
      ['an OP_RETURN above 83 bytes', () => qbitTransaction({ vout: [opReturnOutput(160), p2mrOutput(99_000)] })],
      ['multiple OP_RETURN outputs', () => qbitTransaction({ vout: [opReturnOutput(20), opReturnOutput(20), p2mrOutput(99_000)] })],
      ['OP_RETURN outputs that fill the 200,000 byte budget', () => qbitTransaction({ vout: [...Array(4)].map(() => opReturnOutput(49_996)) })],
      ['ephemeral dust in a zero-fee transaction', () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(100_000)] })],
      ['2,500 legacy sigops', () => legacySigopsTransaction(2_500)],
      ['a P2MR output at the 2,855 bit dust threshold', () => qbitTransaction({ vout: [p2mrOutput(2_855)] })],
      ['outputs to undefined witness v1 and v2 programs at the 121 bit dust threshold', () => qbitTransaction({ vout: [witnessOutput(1, 121), witnessOutput(2, 121)] })],
      ['a v3 transaction of 50,000 vB', () => ({ ...qbitTransaction({ version: 3 }), weight: 50_000 })],
      ['a v3 transaction whose sigops adjust its vsize to 50,000 vB', () => ({ ...qbitTransaction({ version: 3 }), sigops: 2_500 })],
      ['a v3 transaction that spends 13 single-key P2MR inputs', () => qbitTransaction({ version: 3, vin: singleKeyP2mrSpends(13) })],
      ['a v2 transaction that spends 14 single-key P2MR inputs', () => qbitTransaction({ vin: singleKeyP2mrSpends(14) })],
      ['a P2MR leaf script argument of 16 KiB', () => qbitTransaction({ vin: [p2mrSpend(bytes(16_384), p2mrLeafScript, p2mrControlBlock)] })],
      ['P2MR leaf script arguments of 128 KiB in total', () => qbitTransaction({ vin: [p2mrSpend(...Array(8).fill(bytes(16_384)), p2mrLeafScript, p2mrControlBlock)] })],
      ['a tapscript argument of 80 bytes', () => qbitTransaction({ vin: [p2trSpend(bytes(80), '51', tapscriptControlBlock)] })],
    ];

    const nonStandardCases: [string, () => TransactionExtended][] = [
      ['a v4 transaction', () => qbitTransaction({ version: 4 })],
      ['OP_RETURN outputs over the 200,000 byte budget', () => qbitTransaction({ vout: [...[...Array(3)].map(() => opReturnOutput(49_996)), opReturnOutput(49_997)] })],
      ['dust in a fee-paying transaction', () => qbitTransaction({ version: 3, vout: [anchorOutput(0), p2mrOutput(99_000)] })],
      ['two dust outputs in a zero-fee transaction', () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), p2mrOutput(1), p2mrOutput(99_999)] })],
      ['ephemeral dust followed by a non-standard output', () => qbitTransaction({ version: 3, fee: 0, vout: [anchorOutput(0), nonStandardOutput] })],
      ['2,501 legacy sigops', () => legacySigopsTransaction(2_501)],
      ['a P2MR output below the 2,855 bit dust threshold', () => qbitTransaction({ vout: [p2mrOutput(2_854)] })],
      ['an output to an undefined witness v1 program below the 121 bit dust threshold', () => qbitTransaction({ vout: [witnessOutput(1, 120), p2mrOutput(99_000)] })],
      ...[...Array(14)].map((_, i): [string, () => TransactionExtended] => [`an output to reserved witness v${i + 3}`, () => qbitTransaction({ vout: [p2mrOutput(99_000), witnessOutput(i + 3)] })]),
      ['a v3 transaction over 50,000 vB', () => ({ ...qbitTransaction({ version: 3 }), weight: 50_001 })],
      ['a v3 transaction whose sigops adjust its vsize over 50,000 vB', () => ({ ...qbitTransaction({ version: 3 }), sigops: 2_501 })],
      ['a v3 transaction that spends 14 single-key P2MR inputs', () => qbitTransaction({ version: 3, vin: singleKeyP2mrSpends(14) })],
      ['a P2MR spend with an annex', () => qbitTransaction({ vin: [p2mrSpend(bytes(3_681), p2mrLeafScript, p2mrControlBlock, '50')] })],
      ['a P2MR spend without a leaf script', () => qbitTransaction({ vin: [p2mrSpend(p2mrControlBlock)] })],
      ['a P2MR spend with an empty control block', () => qbitTransaction({ vin: [p2mrSpend(bytes(3_681), p2mrLeafScript, '')] })],
      ['a P2MR leaf script argument over 16 KiB', () => qbitTransaction({ vin: [p2mrSpend(bytes(16_385), p2mrLeafScript, p2mrControlBlock)] })],
      ['P2MR leaf script arguments over 128 KiB in total', () => qbitTransaction({ vin: [p2mrSpend(...Array(8).fill(bytes(16_384)), bytes(1), p2mrLeafScript, p2mrControlBlock)] })],
      ['a tapscript argument over 80 bytes', () => qbitTransaction({ vin: [p2trSpend(bytes(81), '51', tapscriptControlBlock)] })],
      ['a taproot script path spend with an empty control block', () => qbitTransaction({ vin: [p2trSpend(bytes(1), '51', '')] })],
      ['a non-standard input after a taproot spend of another leaf version', () => qbitTransaction({ vin: [p2trSpend(bytes(81), '51', otherLeafControlBlock), input(witnessOutput(1))] })],
      ['a non-standard output after a taproot spend of another leaf version', () => qbitTransaction({ vin: [p2trSpend(bytes(81), '51', otherLeafControlBlock)], vout: [p2mrOutput(99_000), nonStandardOutput] })],
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
