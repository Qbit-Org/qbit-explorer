export function formatScriptPubKeyType(value: string | null | undefined, scriptpubkey?: string | null): string {
  const reservedWitnessVersion = getReservedWitnessVersion(scriptpubkey);
  if (reservedWitnessVersion && ['unknown', 'witness_unknown', 'nonstandard'].includes(value || '')) {
    return `Reserved witness v${reservedWitnessVersion}`;
  }

  switch (value) {
    case 'fee':
      return $localize`Transaction fee`;
    case 'p2pk':
      return 'P2PK';
    case 'op_return':
      return 'OP_RETURN';
    case 'witness_v2_p2mr':
    case 'v2_p2mr':
      return 'P2MR';
    case 'anchor':
      return 'Anchor';
    case undefined:
    case null:
      return 'Unknown';
    default:
      return value.toUpperCase();
  }
}

export function getReservedWitnessVersion(scriptpubkey?: string | null): number | null {
  if (!scriptpubkey || scriptpubkey.length < 4 || !/^[0-9a-fA-F]+$/.test(scriptpubkey)) {
    return null;
  }

  const versionOpcode = parseInt(scriptpubkey.slice(0, 2), 16);
  const pushLength = parseInt(scriptpubkey.slice(2, 4), 16);
  if (versionOpcode < 0x53 || versionOpcode > 0x60 || pushLength < 2 || pushLength > 40) {
    return null;
  }

  if (scriptpubkey.length !== 4 + pushLength * 2) {
    return null;
  }

  return versionOpcode - 0x50;
}
