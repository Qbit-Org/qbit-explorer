import transactionUtils from '../../api/transaction-utils';

describe('transactionUtils.countScriptSigops', () => {
  test('counts OP_CHECKSIG and OP_CHECKSIGVERIFY as one sigop each', () => {
    expect(transactionUtils.countScriptSigops('OP_CHECKSIG OP_CHECKSIGVERIFY', true, true)).toBe(2);
  });

  test('does not count OP_CHECKSIGPQC or OP_CHECKSIGADD, which qbitd GetSigOpCount skips', () => {
    expect(transactionUtils.countScriptSigops(`OP_PUSHBYTES_32 ${'11'.repeat(32)} OP_CHECKSIGPQC`, true, true)).toBe(0);
    expect(transactionUtils.countScriptSigops('OP_CHECKSIGADD', true, true)).toBe(0);
  });

  test('counts OP_CHECKMULTISIG as N only after OP_1 to OP_16 in redeem and witness scripts', () => {
    expect(transactionUtils.countScriptSigops('OP_PUSHNUM_2 OP_CHECKMULTISIG', false, true)).toBe(2);
    expect(transactionUtils.countScriptSigops('OP_PUSHNUM_16 OP_CHECKMULTISIGVERIFY', false, true)).toBe(16);
    expect(transactionUtils.countScriptSigops('OP_0 OP_CHECKMULTISIG', false, true)).toBe(20);
    expect(transactionUtils.countScriptSigops('OP_CHECKMULTISIG OP_CHECKMULTISIG', false, true)).toBe(40);
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
