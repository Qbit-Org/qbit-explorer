#!/usr/bin/env python3
"""Build a regtest AuxPoW payload for a qbitd createauxblock template.

Reads the JSON printed by `qbit-cli createauxblock <p2mr-address>` on stdin and
prints the hex payload for `qbit-cli submitauxblock <hash> <payload>`.

This follows make_valid_auxpow_from_template() in Qbit-Org/qbit v1.0.0
test/functional/test_framework/auxpow.py, using only the standard library. The
parent chain block holds a single coinbase transaction whose scriptSig commits
to the qbit candidate hash, both merkle branches are empty, and the parent
header is ground against the candidate's own target. That grind is instant on
regtest's 0x207fffff target and hopeless on a real one, so this is for regtest
only.
"""

import hashlib
import json
import sys
import time

MERGED_MINING_HEADER = bytes.fromhex("fabe6d6d")
OP_TRUE = 0x51
MAX_NONCE = 0xFFFFFFFF


def hash256(data):
    return hashlib.sha256(hashlib.sha256(data).digest()).digest()


def compact_size(n):
    if n < 0xFD:
        return n.to_bytes(1, "little")
    if n <= 0xFFFF:
        return b"\xfd" + n.to_bytes(2, "little")
    if n <= 0xFFFFFFFF:
        return b"\xfe" + n.to_bytes(4, "little")
    return b"\xff" + n.to_bytes(8, "little")


def push_data(data):
    # CScript([data]) for the short pushes used here
    if len(data) >= 0x4C:
        raise ValueError("push too long for a direct push opcode")
    return bytes([len(data)]) + data


def target_from_bits(bits):
    exponent = bits >> 24
    mantissa = bits & 0x007FFFFF
    if exponent <= 3:
        return mantissa >> (8 * (3 - exponent))
    return mantissa << (8 * (exponent - 3))


def commitment_root(aux_hash_hex, order):
    # The display order is the RPC hex string as written; the internal order
    # is the uint256 little-endian serialization, i.e. the bytes reversed.
    display = bytes.fromhex(aux_hash_hex)
    if order == "display":
        return display
    if order == "internal":
        return display[::-1]
    raise ValueError(f"unknown commitmentorder {order!r}")


def parent_coinbase(commitment):
    # Version 1, one input spending the null outpoint, one zero-value OP_TRUE
    # output, nLockTime 0, serialized without witness.
    script_sig = push_data(commitment)
    tx_in = (
        bytes(32)
        + (0xFFFFFFFF).to_bytes(4, "little")
        + compact_size(len(script_sig))
        + script_sig
        + (0).to_bytes(4, "little")
    )
    tx_out = (0).to_bytes(8, "little") + compact_size(1) + bytes([OP_TRUE])
    return (
        (1).to_bytes(4, "little")
        + compact_size(1)
        + tx_in
        + compact_size(1)
        + tx_out
        + (0).to_bytes(4, "little")
    )


def solved_parent_header(merkle_root, ntime, bits):
    target = target_from_bits(bits)
    prefix = (
        (1).to_bytes(4, "little")
        + bytes(32)
        + merkle_root
        + ntime.to_bytes(4, "little")
        + bits.to_bytes(4, "little")
    )
    for nonce in range(MAX_NONCE + 1):
        header = prefix + nonce.to_bytes(4, "little")
        if int.from_bytes(hash256(header), "little") <= target:
            return header
    raise ValueError("no parent nonce meets the target")


def make_auxpow(template, parent_time):
    aux_hash = template["hash"]
    if not isinstance(aux_hash, str) or len(aux_hash) != 64:
        raise ValueError("template hash is not 32 bytes of hex")
    bits = int(template["bits"], 16)
    if target_from_bits(bits) < 1 << 240:
        raise ValueError(f"target for bits {template['bits']} is too hard; regtest only")
    order = template.get("commitmentorder", "display")

    # With an empty chain merkle branch the merkle size is 1, the expected
    # chain index is 0 for any chain ID and nonce, and the chain root is the
    # candidate hash itself.
    commitment = (
        MERGED_MINING_HEADER
        + commitment_root(aux_hash, order)
        + (1).to_bytes(4, "little")
        + (0).to_bytes(4, "little")
    )
    coinbase = parent_coinbase(commitment)
    # A one-transaction block's merkle root is the coinbase txid.
    header = solved_parent_header(hash256(coinbase), parent_time, bits)
    return (
        coinbase
        + compact_size(0)
        + (0).to_bytes(4, "little")
        + compact_size(0)
        + (0).to_bytes(4, "little")
        + header
    )


def main():
    try:
        template = json.load(sys.stdin)
        payload = make_auxpow(template, int(time.time()))
    except (KeyError, TypeError, ValueError) as error:
        print(f"qbit-regtest-auxpow: {error}", file=sys.stderr)
        return 1
    print(payload.hex())
    return 0


if __name__ == "__main__":
    sys.exit(main())
