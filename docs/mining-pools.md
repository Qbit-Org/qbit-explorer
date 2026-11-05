# qbit Mining Pools

The explorer ships a small vendored qbit pool definition set in
`backend/pools-qbit.json`. It deliberately does not reuse upstream mempool's
default pool database: that database matches Bitcoin coinbase signatures and
payout addresses, so using it on qbit can misattribute blocks to Bitcoin pools.
Blocks that match no vendored definition attribute to the built-in `Unknown`
pool.

## Vendored Definitions

| id | Name | Link | Coinbase addresses/tags | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Qbit Pool | https://qbit.org/pool | Tags: `/Qbit Pool/`, `/PRISM Pool/`; address: `qb1z7635znpv0ffehup3aq7dddzf6yuvvzwddad7aye7l64430rvq69q4zmcdh` (its 2% pool fee, paid by every coinbase it builds) | testnet4 block `0000000000001c1865d21ae41fa83d4b87934ea8af7e6460c2262efa2c3a759f` (height 36256, permissionless lane); coinbase scriptsig decodes to `…/PRISM Pool/…`, the tag the pool used as Prism Pool. `/mining/pool/prismpool` redirects to the new slug |
| 2 | Luxor | https://mining.luxor.tech | Address: `qb1zn9wxf7450m2gv70j5jje2sl68r3qm38ksjpfuhlppra2k02su0hqkgq8x7`; parent addresses: `1MkCDCzHpBsYQivp8MxjY5AkTGG1f2baoe`, `39bitUyBcUu3y3hRTtYprKbTp712t4ZWqK`, `32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6`; parent tags: `/LUXOR/`, `Luxor Tech` | reported qbit coinbase payout address; the `luxor` slug maps to the upstream `luxor.svg` mining-pool logo. Parent identifiers come from the upstream Bitcoin pool registry (`mempool/mining-pools`) and are confirmed by qbit block `196368e129d102606180225fe67baee0ede4f82fc192e0f71f3305ac0c36a9bf` (height 4214, AuxPoW lane), whose embedded Bitcoin coinbase decodes to `…Powered by Luxor Tech-…` and pays `32BfKjhByDSxx3BM5vUkQ3NQq9csZR6nt6` in Bitcoin block 958574 |
| 3 | LuckyPool.IO | https://qbit.luckypool.io/ | Tag: `/LuckyPool-Qbit/` | qbit block `0000000000000000019f24c27a0cef0567b8068f10251d86098365d3b414f066` (height 1526, permissionless lane); coinbase scriptsig decodes to `…/LuckyPool-Qbit/`, and the pool's official stats report it as LuckyPool.IO's first Qbit block |
| 4 | deezy | https://deezy.io | Address: `qb1zsgjp00kl4ghjkhsmernut7x5vpx4xsf0mf8eedjftdssf0hqneyqtcdeez` | qbit block `000000000000000064f7f50834e7cce35218dfc45f492a741a20081de89d866c` (height 7107, permissionless lane); its sole transaction is coinbase `e8833ae173450ec4923e3c2a6dfa0f1aacdc458ee95b3d631569333073e7839d`, which pays the address as P2MR; logo supplied by the operator |
| 5 | AntPool | https://www.antpool.com | Parent address: `39C7fxSzEACPjM78Z7xdPxhf7mKxJwvfMJ`; parent tag: `Mined by AntPool` | qbit block `373ffac217ec48755c908321909ebf8879963242802cbb386028aef4c8c4e542` (height 7883, AuxPoW lane); its embedded parent coinbase carries `Mined by AntPool906` and pays the registered address. The separate 546-sat marker output and shared qbit payout address are deliberately not registered as AntPool identifiers |
| 6 | WhitePool | https://whitebit.com/mining-pool | Parent address: `3QmwRxUVQSobeKnNWSjtYmRbU2uxYQzRrG`; parent tag: `WhitePool` | qbit block `bd3434ea9cc6f43e691a09b513139815db06a07a8ed865728d0c872716b90897` (height 7957, AuxPoW lane); its embedded parent coinbase carries `WhitePool` and pays the registered address. The same evidence recurs at qbit heights 7886 and 7913 |
| 7 | BTC.com | https://cloverpool.com | Parent address: `36cWgjEtxQSFgbHTJDw5AB96ZX7fJk1URd`; parent tag: `btccom` | qbit block `0754c76cb68966768c99783e8bc0f29a9b3b337113c654f87f75c1a15766cb8a` (height 7927, AuxPoW lane); its embedded parent coinbase carries `btccom956` and pays the registered address. This identifies the BTC.com lineage now branded CloverPool; the `BTC.com` name and `btccom` slug follow the upstream pool registry and logo |
| 8 | Binance Pool | https://pool.binance.com | Parent address: `3G7jcEELKh38L6kaSV8K35pTqsh5bgZW2D`; parent tag: `binance` | qbit block `c2e32d2f068de635b0db60809f24628c0cbd3132d4b06b808cba0c6a0729e8d4` (height 7924, AuxPoW lane); its embedded parent coinbase carries `binance/` and pays the registered address, which is also present in the upstream Bitcoin pool registry |
| 9 | ULTIMUSPOOL | https://www.ultimuspool.com | Parent address: `3C9sAKXrBVpJVe3b738yik4LPHpPmceBgd`; parent tag: `/ultimus/` | qbit block `fa32fc824a061faa135d1814b7c9b104d6ac4f67f888adda1d98158a5dbc9c8c` (height 7925, AuxPoW lane); its embedded parent coinbase carries `/ultimus/783` and pays the registered address, which is also present in the upstream Bitcoin pool registry |
| 10 | SECPOOL | https://www.secpool.com | Parent address: `3Awm3FNpmwrbvAFVThRUFqgpbVuqWisni9`; parent tag: `Mined by SecPool` | qbit block `f3a90f4e71e8c83d068e141762bb7ed46420136f05bf789c628ec7a1d1a9c686` (height 8204, AuxPoW lane); its embedded parent coinbase carries `Mined by Secpool` and pays 3.14286894 BTC to the registered address. The separate 546-sat marker and qbit payout address are deliberately excluded |
| 11 | Poolin | https://www.poolin.com | Parent address: `33TbzA5AMiTKUCmeVEdsnTj3GiVXuavCAH`; parent tag: `/poolin.com/` | qbit block `1fac0b53ac229c0ef724e7c7492b9bd7767f135003bf464950efee1bc9a157ee` (height 8388, AuxPoW lane); its embedded parent is accepted Bitcoin block 959019, whose coinbase carries `/poolin.com/fp/963` and pays 3.14888984 BTC to the registered address. The shared qbit payout remains excluded |
| 12 | cornswap | https://cornswap.com | Tag: `cornswap`; full-reward address: `qb1zskhyrmv4vnhha252y7vc9tp5vpenfelu4uxxjlqq8dnzrgy4atcskuvgv8` | qbit block `00000000000000005b53138d088360c18f5342ef3670373a973d7a3294bfa575` (height 8265, permissionless lane) ends `ckpool 🌽 cornswap.com`. Operator-confirmed pre-tag block `00000000000000004154fd1cdd040105bb621bbdd4b0c2589735f5846303aed9` (height 390) carries `/qbit-mining-bootstrap/` and pays its entire reward to the registered address |
| 13 | RedRock Pool | https://redrock.pro/ | Parent address: `3554kSaWNnP3B49Xyybert7gmxq2YSnfnx`; parent tag: `RedRock` | qbit block `8811335efc0fce401cb6483b65572444266515f911bda74aaf9b3b806c804e3f` (height 8770, AuxPoW lane); its unverified Bitcoin parent work carries `RedRock Pool` and pays 3.13772479 BTC to the registered address, matching the upstream Bitcoin pool registry. The separate 546-sat marker and shared qbit payout address are deliberately excluded |
| 14 | Himpool | https://himpool.com/ | Tag: `Himpool` | qbit block `000000000000000009606f0601274738864c4861837f260387acf6ba4edc3dc2` (height 18307, permissionless lane); coinbase transaction `362e19e8191cdee1c2b47712686e3ec4d226a4758b3f8bfc9acb57c2c0be7b9a` ends with the exact seven-byte ASCII marker `Himpool` and pays the pool's official Qbit address `qb1z0sq5a2d9grg7hd4g8tagzsk8ylmn7jd0hwdaefxu7pu3runqsdgs70eant` |
| 15 | F2Pool | https://www.f2pool.com | Address: `qb1zpyh3ygrlnrdzk5nrz0wh9usmeex2tfanq89p5yyvqj3pj4tuzlgs4hc5uh`; tag: `七彩神仙鱼`; parent address: `1AfCc4F9c4VTYSE31PUe2kUEKs6ZxiDjxm`; parent tags: `/F2Pool/`, `🐟` | eight AuxPoW blocks at heights 19624–19678 repeat all three fingerprints; the child and parent tags are canonical F2Pool identifiers in the upstream pool registry. The recurring 546-sat parent marker address is deliberately excluded |

### Himpool PPLNS and solo lanes

Himpool's public API exposes separate `qbit` PPLNS and `qbit-solo` pools, but
both are operated under the Himpool identity and use the same coinbase marker
and reward address. A 2026-07-28 census cross-checked all seven Qbit blocks then
reported by the operator, at heights 18291, 18294, 18295, 18296, 18300, 18305,
and 18307. Every coinbase ends with `0748696d706f6f6c` (a seven-byte push of
`Himpool`) and pays
`qb1z0sq5a2d9grg7hd4g8tagzsk8ylmn7jd0hwdaefxu7pu3runqsdgs70eant`.
The explorer therefore aggregates both reward schemes under one `himpool`
identity. The tag, rather than the shared payout address, is the registered
matching rule.

### F2Pool AuxPoW cluster

A 2026-07-29 observation found eight F2Pool-attributable AuxPoW blocks:

| qbit height | Block hash |
| ---: | --- |
| 19624 | `ed70c156473166409f63a3cd11bf31fc34361f7d23aeec0c7f00a3c3a160f671` |
| 19631 | `2486c5ae13cb375f1182fee2790546c00c99fb367b46cb632d609aa01299a317` |
| 19637 | `339ddd11ad57db9ecc35d4e13a1c71f51097cc6aca9df6471b5136e9788a8a78` |
| 19654 | `57250335ab5e0794d795c7caa27f309b6b32977a8514467620b465e86d228ce9` |
| 19670 | `090aa3c9203449f4332ab9529d6acd2a6e5438313afd8dea1e6313a489b5a74c` |
| 19671 | `0dbfa623a1220fa9309b2af95eb4f2b0414c0474cfe7ce38f02764df66e96e98` |
| 19673 | `c1da3b7da1e40a6f6a6843d1b2e5cb5347c95f710d0ace3d9c99d03cc8de24ee` |
| 19678 | `49d2e7a34500144c0d48e6ad3d4e14341ebdd42c25b17309cf6ea9587e24d149` |

Every child coinbase contains the UTF-8 `七彩神仙鱼` tag and pays
`qb1zpyh3ygrlnrdzk5nrz0wh9usmeex2tfanq89p5yyvqj3pj4tuzlgs4hc5uh`.
Every embedded Bitcoin coinbase contains the `🐟` marker followed by
`/F2Pool/` and pays its substantive reward to
`1AfCc4F9c4VTYSE31PUe2kUEKs6ZxiDjxm`.
Those three tags are all present in the upstream F2Pool definition.

The parent transactions also pay exactly 546 sats to
`1K6KoYC69NnafWJ7YgtrpwJxBLiijWqwa6`. As with the other AuxPoW definitions,
that recurring marker output is retained in raw evidence but excluded from
the matching rules; only the substantive Bitcoin payout is registered.

### Cornswap payout-address collision

The operator-reported address is registered with
`addressMatchMode: "full_reward"`, which requires every positive-value
coinbase output to pay that address. Zero-value `OP_RETURN` outputs are
ignored. Explicit coinbase tags are evaluated before payout addresses,
independent of database row order, so Qbit Pool's `/Qbit Pool/` and
`/PRISM Pool/` tags always remain its evidence.

A full-chain census anchored at height 8698 found 1,461 coinbases paying the
address, plus 101 ordinary transactions. Exactly 772 coinbases pay the entire
reward to it: all 621 `/qbit-mining-bootstrap/` blocks at heights 341–7638 and
all 151 `CornSwap`/`cornswap.com` blocks. All 689 `/PRISM Pool/` coinbases are
split across 13 positive recipient outputs; none pays Cornswap's address the
full reward. The guarded address rule therefore backfills 621
operator-confirmed pre-tag blocks while excluding every Prism payout in the
snapshot.

Historical database rows store deduplicated coinbase recipient addresses but
not per-output values. For those rows, a sole recipient is the full-reward
proxy; the chain census verified it against every candidate block. Newly
indexed blocks persist exact positive coinbase output values, including
addressless payouts, so later pool-definition reindexes replay the same exact
decision instead of reverting to the historical proxy.

### Shared AuxPoW payout census

The qbit reward address
`qb1zkq6x308cjzhn8ke945yzm9cu4yft98rgkv6qg50ndrsdy4gdl02qzvytm3`
is a shared template-provider payout and is intentionally absent from every
pool definition. A paginated census of all 54 payments through qbit height
7979 (heights 7822–7979) found only AuxPoW blocks and decoded every embedded
parent coinbase:

| Parent pool | Blocks | Identifying qbit heights |
| --- | ---: | --- |
| AntPool | 42 | all remaining payments in the snapshot |
| BTC.com | 4 | 7827, 7832, 7918, 7927 |
| WhitePool | 3 | 7886, 7913, 7957 |
| Binance Pool | 3 | 7870, 7924, 7973 |
| ULTIMUSPOOL | 2 | 7920, 7925 |

The census fetched every address transaction with the explorer's
`after_txid` pagination, required the block to be in the AuxPoW lane, and
clustered the decoded `extras.auxpow` tag and Bitcoin outputs. AntPool,
BTC.com, Binance Pool, and ULTIMUSPOOL templates each also contain a recurring
546-sat marker output; those marker addresses remain visible in the raw parent
data but are excluded from matching. Only the substantive payout and the
pool-specific parent tag are registered.

### 48-hour AuxPoW census

A fresh chain-wide snapshot anchored at chain tip 9986 covered the exact 48
hours from 2026-07-20 17:48:52 UTC through 2026-07-22 17:48:52 UTC. It fetched
every consecutive qbit block in the window, heights 7032–9986, decoded all 652
AuxPoW parent coinbases, and matched them as follows:

| Parent pool | AuxPoW blocks |
| --- | ---: |
| AntPool | 312 |
| Luxor | 204 |
| SECPOOL | 54 |
| Binance Pool | 37 |
| BTC.com | 32 |
| WhitePool | 5 |
| ULTIMUSPOOL | 5 |
| Poolin | 2 |
| RedRock Pool | 1 |

The snapshot's only previously unmatched fingerprint was RedRock Pool at
height 8770. Its parent tag, substantive payout, and upstream registry entry
provide independent evidence for the definition above; after adding it, all
652 AuxPoW blocks match the vendored definitions. Cornswap's tagged blocks are
permissionless, so adding Cornswap does not change the AuxPoW census.

Pool logos resolve from each pool's generated slug. The frontend asset sync
downloads `luxor.svg`, `antpool.svg`, `whitepool.svg`, `btccom.svg`,
`binancepool.svg`, `ultimuspool.svg`, `secpool.svg`, and `poolin.svg` from
`mempool/mining-pool-logos`; F2Pool similarly resolves to the upstream
`f2pool.svg`. The qbit-specific `qbitpool.svg` is the Qbit mark. Because the upstream logo set has no LuckyPool.IO
entry, `luckypoolio.svg` is vendored from the pool's official
`safari-pinned-tab.svg`, using the mask color declared by its site so the mark
remains visible against the explorer's dark theme. The `deezy.svg` asset is a
transparent, small-icon redraw of the operator-provided logo. The
`cornswap.svg` asset is the transparent small-size icon supplied by the
operator for 16–32 px block-card use. The upstream logo set does not currently
provide `redrockpool.svg`, so RedRock Pool uses the frontend's default pool
icon. `himpool.svg` is vendored verbatim from the operator's official
`https://himpool.com/assets/brand/logo.svg` asset.

## Runtime Behavior

Fresh configs leave both remote pool URLs empty:

```json
{
  "MEMPOOL": {
    "POOLS_JSON_URL": "",
    "POOLS_JSON_TREE_URL": ""
  }
}
```

Empty URLs put the backend in local qbit pool mode: on startup or manual pool
update it imports the vendored `backend/pools-qbit.json`. Legacy
`mempool/mining-pools` URLs from upgraded configs are treated the same way so
Bitcoin pool regexes are never imported into qbit.

The pool definition hash stored in the database is derived from the vendored
file content (`qbit-<sha256>`), so editing `pools-qbit.json` and restarting the
backend automatically re-imports the definitions and re-indexes block pool
assignments — no manual marker reset is required. Pool definitions no longer
present in the file (including stale Bitcoin pools left over in an upgraded
database) are deleted on import and their blocks re-attributed, so the `pools`
table always mirrors the definition set. If `pools-qbit.json` cannot be found
at all, the import fails loudly and retries later instead of importing an empty
set. If the vendored set is empty, the import keeps/inserts `Unknown`, rewrites
indexed block pool IDs to `Unknown`, clears stale pool hashrates, and removes
old non-Unknown pool definitions.

Operators who maintain their own qbit pool definition repository can point
`POOLS_JSON_URL` and `POOLS_JSON_TREE_URL` at it and run the normal pool update
flow instead of using the vendored file.

## AuxPoW Parent-Chain Attribution

AuxPoW-lane qbit blocks embed the full parent-chain (Bitcoin) coinbase
transaction in their serialized header, right after the 80-byte child header.
The backend decodes it (`backend/src/utils/qbit-auxpow.ts`) from the raw
header it stores for every block, and matches the parent coinbase
signature and its Bitcoin payout addresses against each pool's
`parentTags`/`parentAddresses` definitions.

The `blocks.header` column was originally sized for an 80-byte pure header,
which silently truncated stored AuxPoW payloads. Database migration 109
widens it, and the lazy block migration (`$migrateBlocksToV2`) repairs
affected AuxPoW-lane rows in place from the node — at any depth, stale rows
included — re-fetching the full header and re-running pool attribution with
the recovered parent coinbase. Permissionless rows were never truncated and
are untouched. After a repair pass, pool hashrate shares are re-indexed and
the cached tip blocks are re-synced from the repaired rows.

Parent-chain matching is strictly a fallback: qbit-side identifiers
(`addresses`/`tags`) always win, because the parent coinbase only proves which
parent-chain pool built the Bitcoin template. Parent identifiers are also
never matched against qbit coinbases (and vice versa), so a permissionless
block spoofing a Bitcoin pool tag does not attribute to that pool. Parent
payout scripts are rendered as Bitcoin mainnet addresses.

This is how Luxor blocks paying a fresh, unregistered qbit address still
attribute to Luxor: the embedded Bitcoin coinbase carries
`Powered by Luxor Tech-` and pays Luxor's registered Bitcoin reward addresses.

The decoded parent data is also exposed as `extras.auxpow`
(`parentBlockHash`, `parentCoinbaseRaw`, `parentCoinbaseAddresses`) on the
block APIs. The block page shows the unverified parent work hash plus the
parent coinbase tag for AuxPoW blocks, so attributions stay auditable from
the UI. A valid AuxPoW parent header need not be part of Bitcoin's accepted
chain, so the explorer does not present the hash as a confirmed Bitcoin block.

## Adding A qbit Pool

Pool entries must be evidence-backed. A qbit pool definition includes:

- `id`: stable numeric pool identifier (`0` is reserved for `Unknown`).
- `name`: display name (the slug is derived from it, e.g. `Qbit Pool` →
  `qbitpool`).
- `link`: operator website or public profile.
- `addresses`: qbit payout addresses observed in coinbase outputs.
- `tags`: case-insensitive regex strings that match coinbase signatures.
- `parentAddresses` (optional): parent-chain (Bitcoin) payout addresses
  observed in the AuxPoW parent coinbase outputs.
- `parentTags` (optional): case-insensitive regex strings that match the
  AuxPoW parent coinbase signature.

Submitters should include at least one mined qbit block hash, the matching
coinbase signature or payout address, and whether the evidence came from the
permissionless lane or AuxPoW lane. AuxPoW attribution may represent a
parent-chain pool, so parent-chain evidence belongs in
`parentAddresses`/`parentTags`, which are only ever matched against the
embedded parent coinbase of AuxPoW blocks.

The vendored definitions are covered by
`backend/src/__tests__/api/pools-parser.test.ts`, which validates the file
shape and asserts real coinbase scriptsigs match the expected pool — extend
those tests when adding a pool.
