# qbit-explorer Agent Guide

Single source of truth for AI and human contributors working in this qbit
explorer fork. Keep this file stable; fast-changing execution state belongs in
issues and pull requests.

## Mission

Make the mempool explorer work end-to-end against qbit while staying close
enough to upstream `mempool/mempool` that security fixes and maintenance
changes can still be cherry-picked intentionally.

## Project Layout

- `main` is the integration branch. It started from upstream mempool v3.3.1
  (`mempool/mempool` commit `9332d9db97bcc7beed079acc8f79aa21c9b12a3b`) and
  carries the qbit changes on top.
- Do implementation work on short-lived topic branches off `main` and merge
  them back through pull requests. Do not rename branches unless a user
  explicitly asks for it.
- The history keeps upstream's commits up to v3.3.1, with the qbit changes in
  one commit on top. The README's [Upstream](README.md#upstream) section
  explains how to bring in upstream fixes.

## Related Repositories

- [Qbit-Org/qbit](https://github.com/Qbit-Org/qbit): the qbit node (`qbitd`,
  `qbit-cli`) and the source of the consensus values below.
- [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs): the
  qbit-aware Electrum and Esplora REST indexer. Its `doc/qbit-contract.md` is
  the indexer contract this explorer builds on.
- [mempool/mempool](https://github.com/mempool/mempool): the upstream explorer.

If this file conflicts with the qbit source, the qbit-electrs contract, or the
published qbit.org design contract (vendored under
`frontend/src/resources/qbit-design/`), trust the source or contract and
update this file in the same PR.

## Fast Start

Install the repo toolchains:

```bash
nvm use
cd backend && npm ci
cd ../frontend && npm ci
```

For a qbit local stack, use `docs/qbit-local-dev.md`. The short version is:

```bash
# In a checkout of https://github.com/Qbit-Org/qbit
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j"$(getconf _NPROCESSORS_ONLN)"
mkdir -p "$HOME/.qbit-regtest"
build/bin/qbitd -regtest -server -txindex \
  -rpcuser=mempool -rpcpassword=mempool \
  -rpcbind=127.0.0.1 -rpcallowip=127.0.0.1 -rpcport=18452 \
  -fallbackfee=0.0001 -datadir="$HOME/.qbit-regtest"

# In this repo, after creating backend/mempool-config.qbit-regtest.json as
# described in docs/qbit-local-dev.md
docker compose -f backend/docker-compose.test.yml up -d
cd backend
export MEMPOOL_CONFIG_FILE="$PWD/mempool-config.qbit-regtest.json"
npm run build
npm run start
cd ../frontend
npm run config:defaults:mempool
node update-config.js REGTEST_ENABLED=true TESTNET4_ENABLED=true BLOCK_WEIGHT_UNITS=2000000
npm run generate-config
npm run serve
```

Use `MEMPOOL.BLOCK_WEIGHT_UNITS=2000000`, `CORE_RPC.PORT=18452`, and either
`MEMPOOL.BACKEND=none` for qbitd-only work or `MEMPOOL.BACKEND=esplora` with
`ESPLORA.REST_API_URL` pointing at qbit-electrs (`http://127.0.0.1:3002` for a
local regtest instance).

## Local Validation Gates

Backend:

```bash
cd backend
npm run lint
npm run test:ci
npm run build
MEMPOOL_API_URL=http://127.0.0.1:8999/api/v1 npm run smoke:qbit-regtest

# Direct qbit-electrs REST smoke, useful for hosted testnet4 endpoints
SKIP_BACKEND=1 ESPLORA_URL=http://host-or-ip:3004 npm run smoke:qbit-regtest

# Regtest stack and smoke checks as CI runs them (qbitd, qbit-electrs and
# MariaDB): scripts/qbit-regtest-harness.sh up, then npm run smoke:qbit-regtest,
# then down. docs/qbit-local-dev.md "Regtest Harness" has the full sequence;
# without its database settings the mining checks fail.
```

Frontend:

```bash
cd frontend
npm run lint
npm run smoke:qbit-scripts
npm run smoke:qbit-weight
npm run smoke:qbit-block-target
npm run smoke:qbit-reorg
npm run build
```

Use narrower commands while iterating, but run the relevant full gate before
handing off a non-trivial change. CI runs the regtest stack on pull requests
and pushes to `main`; testnet4 validation is still manual, so document any
testnet4 qbitd or qbit-electrs evidence in the PR or issue comment.

## Test Mapping by Area

| Change area | Minimum local checks | Extra qbit evidence |
| --- | --- | --- |
| Backend config and network setup | `cd backend && npm run test:ci && npm run build` | Start backend against qbit regtest RPC on port 18452 |
| Electrs/esplora passthrough assumptions | `cd backend && npm run test:ci` | Curl qbit-electrs `/blocks/tip/height`, `/blocks/tip/hash`, `/block/{hash}` |
| Address or script rendering | backend unit tests plus frontend build | Sample `tq` or `qbrt` addresses, P2MR, anchor, and PQC transactions |
| Weight, vsize, or fee math | backend unit tests around the touched module | Fixture or curl evidence showing `vsize == weight` under WSF=1 |
| Difficulty, subsidy, or mining UI | backend tests and frontend build | qbit source citation plus regtest/testnet4 sample data |
| Liquid, accelerator, services | frontend/backend build | Confirm disabled or gracefully hidden for qbit |
| Block, transaction, address or mempool pages | `npm run cypress:run:regtest` against the regtest harness (`docs/qbit-local-dev.md`) | |

## qbit Consensus Quick Reference

Source references are from `Qbit-Org/qbit` at the `v1.0.0` mainnet release
(commit `7ebcddb622d6e639041f005a189b048ec2a221fe`), and the qbit-electrs
contract `doc/qbit-contract.md` at `Qbit-Org/qbit-electrs`
`53102e925713211ebf9ee8fe34b2f68534740fd9`. Where a row cites three
`chainparams.cpp` lines, they are the mainnet, testnet4, and regtest
parameters in that order.

| Parameter | Value | Source |
| --- | --- | --- |
| Target spacing | 60 seconds aggregate | `src/kernel/chainparams.cpp:152`, `:353`, `:564` |
| Cadence lanes | 75s permissionless, 300s AuxPoW | `src/kernel/chainparams.cpp:153-154`, `:354-355`, `:565-566` |
| Max serialized block size | 2,000,000 bytes | `src/consensus/consensus.h:12-13` |
| Max block weight | 2,000,000 | `src/consensus/consensus.h:14-15` |
| Witness scale factor | 1; no witness discount, so `vsize == weight` for explorer math | `src/consensus/consensus.h:21-22` |
| Coinbase maturity | 1,000 blocks | `src/consensus/consensus.h:18-19` |
| Initial subsidy | 210 QBT | `src/kernel/chainparams.cpp:132`, `:334`, `:545` |
| Subsidy step interval | 43,200 blocks on public networks; 150 on regtest | `src/kernel/chainparams.cpp:133`, `:335`, `:546` |
| Monthly stepdown | Compound floor `598 / 625` | `src/kernel/chainparams.cpp:134-135`, `:336-337`, `:547-548` |
| Difficulty algorithm | ASERT, 2 hour halflife; no Bitcoin 2016-block UI model. Regtest mines at fixed difficulty unless started with `-asert` | `src/kernel/chainparams.cpp:160-161`, `:361-362`, `:570-573`; `src/chainparamsbase.cpp:19` |
| AuxPoW chain ID | 47 on mainnet; 31430 for public testnet4 and test chains | `src/kernel/chainparams.cpp:40-46`, `:155`, `:356`, `:567` |
| Mainnet ports | P2P 8355, RPC 8352 | `src/kernel/chainparams.cpp:194`, `src/chainparamsbase.cpp:45-46` |
| Testnet4 ports | P2P 48355, RPC 48352 | `src/kernel/chainparams.cpp:391`, `src/chainparamsbase.cpp:49-50` |
| Regtest ports | P2P 18460, RPC 18452 | `src/kernel/chainparams.cpp:597`, `src/chainparamsbase.cpp:53-54` |
| Bech32 HRPs | Mainnet `qb`, testnet4 `tq`, regtest `qbrt` | `src/kernel/chainparams.cpp:219`, `:413`, `:657` |
| Base58 P2PKH | Mainnet 58 (`Q`), testnet4/regtest 120 (`q`) | `src/kernel/chainparams.cpp:213`, `:407`, `:651` |
| Base58 P2SH | Mainnet 63 (`S`), testnet4/regtest 125 (`s`) | `src/kernel/chainparams.cpp:214`, `:408`, `:652` |
| New script types | `witness_v2_p2mr`, `anchor` | `src/script/solver.cpp:28`, `:32`; qbit-electrs `doc/qbit-contract.md` P2MR section |
| qbit opcode | `OP_CHECKSIGPQC = 0xb3` | `src/script/script.h:306` |
| PQC signature size | 3,680 bytes | `src/libbitcoinpqc/include/libbitcoinpqc/slh_dsa.h:19-21` |
| PQC public key size | 32 bytes | `src/libbitcoinpqc/include/libbitcoinpqc/slh_dsa.h:19-21` |
| Dust relay fee | 750 bits/kvB, about 0.75 bits/vB | `src/policy/policy.h:66-71` |

Qbit mainnet has launched. Verify mainnet parameters against the released
qbit source and the deployed network rather than pre-launch planning text.

## CI Workflows

The qbit CI/CD workflows are:

- `.github/workflows/ci.yml` — backend and frontend lint and builds, backend
  unit tests, the frontend qbit script, weight, block target and reorg smokes,
  plus a check that `docker/backend/start.sh` renders valid JSON. As upstream,
  the frontend unit-test step is commented out, so frontend specs do not gate
  pull requests. Its Rust GBT job runs `cargo test --locked` in `rust/gbt` and
  fails on a RustSec vulnerability or unsound advisory against
  `rust/gbt/Cargo.lock`, with a `cargo-audit` release binary pinned by SHA-256.
- `.github/workflows/backend-integration.yml` — backend integration tests
  against MariaDB, on a host port Docker picks (`MEMPOOL_TEST_DB_HOST_PORT=0`).
- `.github/workflows/docker.yml` — on every pull request, builds both images
  from the pull request merged onto its base branch and checks that the
  `docker/docker-compose.yml` stack becomes healthy, and that the API and
  WebSocket answer through nginx, also after the `api` container is recreated
  at another address. It runs the same check on `v*` tags, and never pushes
  images anywhere. The frontend build gets the job's read-only
  `GITHUB_TOKEN` as a BuildKit secret, for the GitHub API calls that list the
  mining pool logos.
- `.github/workflows/qbit-design-check.yml` — drift gate for the vendored
  qbit.org design contract in `frontend/src/resources/qbit-design/`. Those
  vendored files are machine-managed by `frontend/scripts/sync-qbit-design.mjs`
  and must never be hand-edited. qbit.org publishes the contract at
  `/design/*` (since 2026-08-03) and it is authoritative for its own content
  (banner, nav entries, social links); validation is schema-only, and the
  check still skips with a warning if publishing regresses to HTTP 404.
- `.github/workflows/qbit-regtest.yml` — starts a regtest stack with
  `backend/scripts/qbit-regtest-harness.sh` and runs `npm run smoke:qbit-regtest`
  against it: qbitd from the `v1.0.0` release tarball, checked against a SHA256
  pinned in the workflow, qbit-electrs built at its pinned contract commit,
  MariaDB as a service container, and the backend with
  `MEMPOOL.BACKEND=esplora`. It then runs the Cypress specs in
  `frontend/cypress/e2e/regtest/` against that stack.

Keep the workflows safe for a public repository. Each one sets
`permissions: contents: read` and checks out with `persist-credentials: false`.
Third-party actions are pinned to a commit SHA; GitHub-owned `actions/*` stay
pinned to their major version tag (`@v4`). Only the Docker publish jobs read
secrets, and they skip pull requests from forks. The automatic `GITHUB_TOKEN`
isn't a repository secret, and under `contents: read` it can only read; pass
it only to the step that needs it, as `docker.yml` does. Do not add
`pull_request_target` or `workflow_run` triggers that run pull request code.

`ci.yml`'s Repository checks job fails a pull request with files under
`contributors/`, which are upstream's CLA signatures (README.md, Upstream).
It also runs `frontend/scripts/check-translations.mjs`, which fails on a unit
in a built translation file whose English text differs from `messages.xlf`, or
whose translation uses a placeholder `messages.xlf`'s English doesn't have
(CONTRIBUTING.md, Translations).

Dependabot reads `.github/dependabot.yml` only from `main`, so a change to it
takes effect when a release brings it there. The file on this branch opens
version updates, including `cargo` for `rust/gbt`, against `1.x.x`. Security
updates always open against `main`. Dependabot reads `rust/gbt/rust-toolchain`
only in TOML form, so keep that file TOML. Workflows and the npm build read its
channel with `rust/gbt/scripts/toolchain-channel.sh`, which fails when it finds
none.

Every checked-in GitHub Actions job runs on the pinned Blacksmith Ubuntu 24.04
runner `blacksmith-4vcpu-ubuntu-2404`. The Blacksmith GitHub App must retain
access to this repository or jobs using that label will remain queued.
Dependency cache actions work unchanged on Blacksmith; keep the existing
Docker Buildx/QEMU pipeline until a separately validated native
multi-architecture migration.

Continue to use local backend/frontend gates and record manual testnet4
validation separately; of the qbit networks, only regtest runs in these
workflows.

## PR Strategy

Keep each PR small and focused on one change, such as a chain compatibility
fix, a display correction, or one UI surface. Split unrelated cleanups into
their own PRs. Prefer changes that can be validated against qbit regtest or
testnet4, and record that evidence in the PR.

Contribution policy (licensing, commit subjects, merge method, upstream
cherry-picks) lives in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Review Expectations

- Verify constants against the qbit source or qbit-electrs contract, not old
  planning text.
- The pins in `docker/*/Dockerfile`, base image digests and the SHA-256 of
  NodeSource's `setup_26.x` (in both backend stages), are the ones the
  production image build uses. When NodeSource republishes the script at the
  same URL, the backend build fails that check: review the new script and
  update both stages. A PR that changes any of these pins, a Dependabot
  digest bump included, says so in its description, so that the production
  deployment moves with it.
- Check every weight/vsize change for the WSF=1 invariant.
- Qbit mainnet has launched; mainnet wording is no longer launch-gated. The
  qbit.org design contract (banner and nav) is authoritative for public
  launch messaging.
- Treat qbit-electrs as available for integration validation; do not leave docs
  saying it is a future dependency.
- Preserve upstream mempool behavior unless qbit requires a change.

## Prompt Hygiene

- Keep shared agent and validation workflow guidance in this file.
  Contributor policy lives in `CONTRIBUTING.md`; link to it instead of
  restating its rules here.
- `CLAUDE.md` redirects here; do not duplicate instructions there.
- Do not add per-agent prompt files that conflict with this guide.
- Consider subagents for independent codebase surveys, test work, and bounded
  implementation slices when the user or workspace permits parallel agent work.
- If workflow behavior changes, update this file in the same PR. If
  contributor policy changes, update `CONTRIBUTING.md` instead.
