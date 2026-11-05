# qbit-explorer

qbit-explorer is an open-source block explorer and mempool visualizer for
[qbit](https://qbit.org). It shows blocks, transactions, addresses, the
mempool, fees and mining in real time, and serves a REST and WebSocket API.
It runs at <https://mempool.qbit.org>.

It is a fork of [mempool/mempool](https://github.com/mempool/mempool) (see
[Upstream](#upstream)), adapted to qbit: 2,000,000 weight-unit blocks with no
witness discount (`vsize == weight`), qbit address formats, and P2MR and
post-quantum signatures.

## Networks

| Network | Public instance |
| --- | --- |
| mainnet | <https://mempool.qbit.org> |
| testnet4 | <https://mempool-testnet.qbit.org> |
| regtest | None. Run it locally with [docs/qbit-local-dev.md](docs/qbit-local-dev.md). |

## Architecture

- [`frontend/`](frontend/): the Angular web app.
- [`backend/`](backend/): a Node.js and TypeScript service that serves the
  REST and WebSocket API. It talks to `qbitd` over RPC and keeps its own data
  in MariaDB.
- [`rust/gbt/`](rust/gbt/): the block-template algorithm in Rust, built as a
  Node.js addon. It still applies Bitcoin's witness scale factor of 4, so the
  backend leaves it off (`MEMPOOL.RUST_GBT`) and projects the next blocks from
  the mempool with its TypeScript implementation.
- `qbitd`, the qbit node from [Qbit-Org/qbit](https://github.com/Qbit-Org/qbit).
  Required.
- [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs), an
  optional indexer. Its Esplora REST API (`MEMPOOL.BACKEND=esplora`) adds
  address pages and the Esplora-compatible API endpoints. Without it
  (`MEMPOOL.BACKEND=none`), the backend runs on `qbitd` RPC alone.

## Getting started

- [docs/qbit-local-dev.md](docs/qbit-local-dev.md): run the whole stack on
  your machine against a qbit regtest node.
- [backend/README.md](backend/README.md) and
  [frontend/README.md](frontend/README.md): set up, configure and build each
  part.
- [`docker/`](docker/): run the explorer with Docker.
- [production/README.md](production/README.md): run a production instance.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request.
[AGENTS.md](AGENTS.md) has the validation gates, the test mapping by area,
and the qbit consensus reference.

## Security

Do not report security problems in public issues. Follow
[SECURITY.md](SECURITY.md) instead.

## Upstream

qbit-explorer is based on [mempool/mempool](https://github.com/mempool/mempool)
[v3.3.1](https://github.com/mempool/mempool/releases/tag/v3.3.1), commit
[`9332d9db97bcc7beed079acc8f79aa21c9b12a3b`](https://github.com/mempool/mempool/commit/9332d9db97bcc7beed079acc8f79aa21c9b12a3b).
This repository does not include upstream's git history.

To bring in an upstream fix, add the upstream remote and cherry-pick the
commit:

```sh
git remote add upstream https://github.com/mempool/mempool.git
git fetch upstream
git cherry-pick -x <upstream-commit>
```

This works without shared history, because a cherry-pick applies the
difference between the upstream commit and its parent. Expect conflicts where
qbit has changed the same code. Upstream merges pull requests with merge
commits, so to pick a whole pull request at once, cherry-pick its merge commit
with `-m 1`. The `-x` flag records the upstream SHA in the commit message.

Upstream pull requests usually add or edit a `contributors/<name>.txt` file that
signs upstream's contributor license agreement. qbit-explorer has no CLA (see
[CONTRIBUTING.md](CONTRIBUTING.md#license)), so keep `contributors/` out of the
tree. If a pick conflicts on one of those files, resolve the conflict with
`git rm`. Before you push, check that `git ls-files contributors` prints
nothing, and remove anything it lists in another commit. CI's Repository checks
job fails a pull request that still has them. Pull requests are squash-merged,
so files removed in a later commit never reach `main`.

## License

qbit-explorer is licensed under the GNU Affero General Public License,
version 3. [LICENSE](LICENSE) holds the copyright and trademark notices and
the license grant, and [COPYING.md](COPYING.md) holds the full license text.

If you run a modified version as a network service, section 13 of the license
requires you to offer its source code to the users of that service.

## Trademarks

The Mempool Open Source Project®, mempool.space® and the other mempool names
and logos listed in [LICENSE](LICENSE) are trademarks of Mempool Space K.K.
qbit-explorer is not affiliated with or endorsed by Mempool Space K.K.

If you run your own instance, you may keep the Qbit name and logo that come with
this software, but don't present your instance as an official Qbit service. To
remove qbit.org's header and footer, see
[Frontend customization](production/README.md#frontend-customization).
