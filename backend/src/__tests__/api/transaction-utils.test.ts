import transactionUtils from '../../api/transaction-utils';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { decodeInputScripts, decodeScript, DecodedScript, getRedeemScript, getSigOpCount, isPushOnly } from '../../utils/bitcoin-script';
import { pushOnlyVectors, realTransactionSigopVectors, scriptSigopVectors, transactionSigopVectors } from '../fixtures/qbit-standardness-vectors';

const hex = (script: DecodedScript | null): string | null => (script ? script.hex : null);

// the vectors the frontend smoke runs too (src/__tests__/fixtures/qbit-standardness-vectors.ts)
describe('qbit sigops over decoded scripts', () => {
  test.each(scriptSigopVectors)('counts the sigops of %s', (_name, script, accurate, sigops) => {
    expect(getSigOpCount(decodeScript(script), accurate)).toBe(sigops);
  });

  test.each(pushOnlyVectors)('tells whether %s is push-only', (_name, script, pushOnly) => {
    expect(isPushOnly(decodeScript(script))).toBe(pushOnly);
  });

  test.each(transactionSigopVectors)('counts the sigop cost of %s', (_name, buildTransaction, cost) => {
    expect(transactionUtils.countSigops(buildTransaction() as unknown as IEsploraApi.Transaction)).toBe(cost);
  });

  test.each(realTransactionSigopVectors)('counts the sigop cost of %s transaction %s', (file, txid, cost) => {
    const transaction = require(`./test-data/${file}`).find((tx: IEsploraApi.Transaction) => tx.txid === txid);
    expect(transactionUtils.countSigops(transaction)).toBe(cost);
  });

  test('reads a P2SH redeem script as the last push of a push-only scriptsig', () => {
    expect(hex(getRedeemScript(decodeScript('0002aaaa03acacac')))).toBe('acacac');
    // a last instruction that pushes a number, OP_1, leaves no redeem script
    expect(hex(getRedeemScript(decodeScript('02aaaa51')))).toBe('');
    // nor does a scriptsig that isn't push-only
    expect(getRedeemScript(decodeScript('03acacac61'))).toBe(null);
  });

  test('decodes each script of an input once, and the redeem script only for a P2SH spend', () => {
    const scriptsig = `0f${'ac'.repeat(15)}`;
    const p2sh = decodeInputScripts({ scriptsig, prevout: { scriptpubkey: `a914${'11'.repeat(20)}87` } });
    expect(hex(p2sh.redeemScript)).toBe('ac'.repeat(15));
    expect(getSigOpCount(p2sh.redeemScript as DecodedScript, true)).toBe(15);
    expect(decodeInputScripts({ scriptsig, prevout: { scriptpubkey: `76a914${'11'.repeat(20)}88ac` } }).redeemScript).toBe(null);
    expect(decodeInputScripts({ scriptsig, prevout: null })).toMatchObject({ prevout: null, redeemScript: null });
  });
});

describe('transactionUtils.addInnerScriptsToVin', () => {
  test('decodes the leaf script of a P2MR script-path spend', () => {
    // Witness layout of a mainnet single-key P2MR spend (txid 99a80aa2be70e915...)
    const vin: any = {
      witness: [
        'ab'.repeat(3680),
        '20291d1c267a25f97d6f81749e06fa414969a333c1fde7a6130d17f33deeb1d9b7b3',
        'c1',
      ],
      prevout: { scriptpubkey_type: 'v2_p2mr' },
    };

    transactionUtils.addInnerScriptsToVin(vin);

    expect(vin.inner_witnessscript_asm).toBe(
      'OP_PUSHBYTES_32 291d1c267a25f97d6f81749e06fa414969a333c1fde7a6130d17f33deeb1d9b7 OP_CHECKSIGPQC'
    );
  });
});
