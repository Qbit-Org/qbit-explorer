# Changelog

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
