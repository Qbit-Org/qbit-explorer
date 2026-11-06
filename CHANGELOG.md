# Changelog

## 1.0.1

### Added

- Qscriptions, qord's inscriptions, on P2MR inputs: the transaction badge,
  the decoded content and the inscription flag now read P2MR leaf scripts.
  The interface calls them qscriptions. API fields, flags and filter keys
  still say `inscription`.
- `GET /api/block/:hash/txid/:index`, which returns the txid at that index in
  a block as `text/plain`. A malformed index gets 400, and an unknown block or
  an index past the last transaction gets 404. A malformed block hash gets
  501, like the other block routes.

### Fixed

- Qrune mints and transfers no longer show "Error decoding data". The
  explorer now finds each qrune's etching through the route above.
- Without prevouts, the backend no longer throws while checking a two-item
  witness for an inscription.

### Changed

- Qrune `1:0` is no longer shown as upstream's UNCOMMON•GOODS, which qord
  doesn't have. It resolves like any other qrune ID.
- Charts run on echarts 6.1.0, with their legends kept above the plot.
- Frontend dependencies: `qs` 6.14.3 to 6.16.2, and `express` 4.22.1 to
  4.22.3.

### Documentation

- The README fetches upstream without its tags, whose names clash with ours,
  and shows how to fix a clone that already has them.
- SECURITY.md asks for reports through GitHub's private vulnerability
  reporting, with email as the alternative.

## 1.0.0

The first public release of qbit-explorer, based on
[mempool/mempool v3.3.1](https://github.com/mempool/mempool/releases/tag/v3.3.1).

### Added

- qbit mainnet, testnet4 and regtest networks, with qbit address formats,
  P2MR scripts and post-quantum signatures.
- qbit's block rules: 2,000,000 weight-unit blocks with no witness discount,
  so vsize equals weight, and fees in bits/vB.
- Mining views for qbit's 60-second block target and its permissionless and
  AuxPoW lanes, AuxPoW blocks attributed to their parent-chain pools, and
  graph ranges sized for qbit's block rate.
- qbit's standardness policy from genesis, with dust and sigops counted the
  way qbitd counts them.
- qbit.org's site header and footer, which operators can turn off with
  `QBIT_SITE_CHROME`.
- CI that runs the backend and browser tests against a qbit regtest stack of
  qbitd, qbit-electrs and MariaDB.

### Changed

- Invalid addresses get a 400 response instead of a 500.
- `GET /api/blocks/tip/height` answers 503 until the backend finishes its
  first block sync.

### Removed

- The Lightning explorer frontend, and mempool.space's branding, trademarks
  and operator configs. Upstream's paid, account and externally hosted
  services are off by default.
- Docker Hub publishing. `docker.yml` still builds and tests the images on
  every pull request and tag; [docker/README.md](docker/README.md) shows how to
  build them yourself.
