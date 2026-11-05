import { detectAddressType } from './address-utils';
import { addressToScriptPubKey, fillUnsignedInput, processInputSignatures, scriptPubKeyToAddress, SighashFlag } from './transaction.utils';
import { Vin } from '@interfaces/electrs.interface';

describe('qbit address codecs', () => {
  const zeroHash20 = '0000000000000000000000000000000000000000';
  const zeroHash32 = '0000000000000000000000000000000000000000000000000000000000000000';

  const testnet4Vectors = [
    {
      type: 'p2pkh',
      scriptPubKey: `76a914${zeroHash20}88ac`,
      address: 'qHZPA2maCec991jPwLyFC3fQXXvCQKGhkU',
    },
    {
      type: 'p2sh',
      scriptPubKey: `a914${zeroHash20}87`,
      address: 'sJFQ5aG1kYvXEBRq4Sdqcg2Lg4CuwtaWNi',
    },
    {
      type: 'v0_p2wpkh',
      scriptPubKey: `0014${zeroHash20}`,
      address: 'tq1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqtuuxjv',
    },
    {
      type: 'v0_p2wsh',
      scriptPubKey: `0020${zeroHash32}`,
      address: 'tq1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0h36vp',
    },
    {
      type: 'v1_p2tr',
      scriptPubKey: `5120${zeroHash32}`,
      address: 'tq1pqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9q3n5a',
    },
    {
      type: 'v2_p2mr',
      scriptPubKey: `5220${zeroHash32}`,
      address: 'tq1zqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdagu6k',
    },
  ] as const;

  for (const vector of testnet4Vectors) {
    it(`converts ${vector.type} testnet4 addresses from qbit scriptPubKeys`, () => {
      expect(scriptPubKeyToAddress(vector.scriptPubKey, 'testnet4')).toEqual({
        address: vector.address,
        type: vector.type,
      });
      expect(detectAddressType(vector.address, 'testnet4')).toBe(vector.type);
      expect(addressToScriptPubKey(vector.address, 'testnet4')).toEqual({
        scriptPubKey: vector.scriptPubKey,
        type: vector.type,
      });
    });
  }

  it('round-trips qbit anchor outputs on testnet4', () => {
    const decoded = scriptPubKeyToAddress('51024e73', 'testnet4');

    expect(decoded).toEqual({
      address: 'tq1pfeespgdghm',
      type: 'anchor',
    });
    expect(addressToScriptPubKey(decoded.address, 'testnet4')).toEqual({
      scriptPubKey: '51024e73',
      type: 'anchor',
    });
    expect(addressToScriptPubKey(decoded.address.toUpperCase(), 'testnet4')).toEqual({
      scriptPubKey: '51024e73',
      type: 'anchor',
    });
  });

  it('round-trips qbit prefixes across networks', () => {
    const networks = [
      { network: 'mainnet', p2pkh: 'Q', p2sh: 'S', bech32: 'qb1' },
      { network: 'testnet', p2pkh: 'q', p2sh: 's', bech32: 'tq1' },
      { network: 'testnet4', p2pkh: 'q', p2sh: 's', bech32: 'tq1' },
      { network: 'signet', p2pkh: 'q', p2sh: 's', bech32: 'tq1' },
      { network: 'regtest', p2pkh: 'q', p2sh: 's', bech32: 'qbrt1' },
    ];

    for (const { network, p2pkh, p2sh, bech32 } of networks) {
      const p2pkhAddress = scriptPubKeyToAddress(`76a914${zeroHash20}88ac`, network).address;
      const p2shAddress = scriptPubKeyToAddress(`a914${zeroHash20}87`, network).address;
      const p2mrAddress = scriptPubKeyToAddress(`5220${zeroHash32}`, network).address;

      expect(p2pkhAddress.startsWith(p2pkh)).toBeTrue();
      expect(p2shAddress.startsWith(p2sh)).toBeTrue();
      expect(p2mrAddress.startsWith(bech32)).toBeTrue();
      expect(addressToScriptPubKey(p2pkhAddress, network).scriptPubKey).toBe(`76a914${zeroHash20}88ac`);
      expect(addressToScriptPubKey(p2shAddress, network).scriptPubKey).toBe(`a914${zeroHash20}87`);
      expect(addressToScriptPubKey(p2mrAddress, network).scriptPubKey).toBe(`5220${zeroHash32}`);
    }
  });

  it('rejects Bitcoin HRPs on qbit networks', () => {
    expect(detectAddressType('tb1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0l98cr', 'testnet4')).toBe('unknown');
    expect(addressToScriptPubKey('bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9e75rs', 'mainnet').scriptPubKey).toBeNull();
  });

  it('accepts uppercase bech32 but rejects mixed-case bech32', () => {
    const upper = 'TQ1ZQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQDAGU6K';
    const mixed = 'tQ1zqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqdagu6k';

    expect(detectAddressType(upper, 'testnet4')).toBe('v2_p2mr');
    expect(addressToScriptPubKey(upper, 'testnet4').scriptPubKey).toBe(`5220${zeroHash32}`);
    expect(detectAddressType(mixed, 'testnet4')).toBe('unknown');
    expect(addressToScriptPubKey(mixed, 'testnet4').scriptPubKey).toBeNull();
  });
});

describe('qbit P2MR input signatures', () => {
  // Witness layout of a mainnet single-key P2MR spend (txid 99a80aa2be70e915...)
  const pqcSig = 'ab'.repeat(3680);
  const leafScript = '20291d1c267a25f97d6f81749e06fa414969a333c1fde7a6130d17f33deeb1d9b7b3';
  const leafScriptAsm = 'OP_PUSHBYTES_32 291d1c267a25f97d6f81749e06fa414969a333c1fde7a6130d17f33deeb1d9b7 OP_CHECKSIGPQC';
  const controlBlock = 'c1';

  const p2mrVin = (witness: string[]): Vin => ({
    witness,
    inner_witnessscript_asm: leafScriptAsm,
    prevout: { scriptpubkey_type: 'v2_p2mr' },
  } as unknown as Vin);

  it('extracts a SIGHASH_DEFAULT PQC signature', () => {
    expect(processInputSignatures(p2mrVin([pqcSig, leafScript, controlBlock]))).toEqual([
      { signature: pqcSig, sighash: SighashFlag.DEFAULT },
    ]);
  });

  it('decodes an explicit sighash byte', () => {
    const sig = pqcSig + '83';
    expect(processInputSignatures(p2mrVin([sig, leafScript, controlBlock]))).toEqual([
      { signature: sig, sighash: 0x83 },
    ]);
  });

  it('ignores the annex, leaf script and control block', () => {
    expect(processInputSignatures(p2mrVin([pqcSig, leafScript, controlBlock, '50' + 'ab'.repeat(3680)])).length).toBe(1);
    expect(processInputSignatures(p2mrVin([leafScript, controlBlock]))).toEqual([]);
  });

  it('rejects stack items that are not PQC signature sized', () => {
    expect(processInputSignatures(p2mrVin(['ab'.repeat(64), 'ab'.repeat(3679), leafScript, controlBlock]))).toEqual([]);
    expect(processInputSignatures(p2mrVin([]))).toEqual([]);
  });

  it('estimates the missing signature for an unsigned single-key leaf', () => {
    expect(fillUnsignedInput(p2mrVin([leafScript, controlBlock]))).toEqual({ missingSigs: 1, bytes: 3683, addToWitness: true });
    expect(fillUnsignedInput(p2mrVin([pqcSig, leafScript, controlBlock])).missingSigs).toBe(0);
  });
});
