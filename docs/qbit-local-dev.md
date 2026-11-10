# qbit Local Dev Loop

This guide brings up the qbit explorer stack on a development machine:

- qbitd regtest node
- optional [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs)
  indexer
- MariaDB for mempool backend state
- mempool backend on `http://127.0.0.1:8999`
- mempool frontend on `http://localhost:4200`

The first usable loop can run with `MEMPOOL.BACKEND=none` against qbitd RPC
only. Address pages and electrs passthrough endpoints require qbit-electrs.

## Source References

- qbit source ref: `Qbit-Org/qbit@v1.0.0`, the mainnet release
  (`7ebcddb622d6e639041f005a189b048ec2a221fe`)
- qbit-electrs contract: `Qbit-Org/qbit-electrs@53102e925713211ebf9ee8fe34b2f68534740fd9:doc/qbit-contract.md`
- qbit-electrs default ports: `Qbit-Org/qbit-electrs@53102e925713211ebf9ee8fe34b2f68534740fd9:src/config.rs`
- Backend defaults: `backend/src/config.ts`
- Backend sample config: `backend/mempool-config.sample.json`
- Frontend local proxy: `frontend/proxy.conf.local.js`
- Frontend local serve config: `frontend/angular.json`

## Prerequisites

- Node `v26.12.1` from `.nvmrc`
- npm from the Node install
- Rust `1.84` for `rust/gbt/rust-toolchain`
- Docker with Compose for the MariaDB test container
- A local [`Qbit-Org/qbit`](https://github.com/Qbit-Org/qbit) checkout, or
  [qbit release binaries](https://github.com/Qbit-Org/qbit/releases) that
  provide `qbitd` and `qbit-cli`
- Optional: a local
  [`Qbit-Org/qbit-electrs`](https://github.com/Qbit-Org/qbit-electrs) checkout
  or a hosted qbit-electrs endpoint

Clone this repo and install project dependencies:

```bash
git clone https://github.com/Qbit-Org/qbit-explorer
cd qbit-explorer
nvm use
cd backend
npm ci
cd ../frontend
npm ci
```

## Port Map

| Component | Default port | Required | Source |
| --- | ---: | --- | --- |
| qbitd regtest P2P | 18460 | Yes | `Qbit-Org/qbit:src/kernel/chainparams.cpp:597` |
| qbitd regtest RPC | 18452 | Yes | `Qbit-Org/qbit:src/chainparamsbase.cpp:53-54` |
| qbitd testnet4 P2P | 48355 | Testnet4 only | `Qbit-Org/qbit:src/kernel/chainparams.cpp:391` |
| qbitd testnet4 RPC | 48352 | Testnet4 only | `Qbit-Org/qbit:src/chainparamsbase.cpp:49-50` |
| qbit-electrs regtest Electrum | 60401 | Optional | `Qbit-Org/qbit-electrs:src/config.rs:143` |
| qbit-electrs regtest Esplora HTTP | 3002 | Optional | `Qbit-Org/qbit-electrs:src/config.rs:163` |
| qbit-electrs testnet4 Electrum | 40001 | Testnet4 only | `Qbit-Org/qbit-electrs:src/config.rs:141` |
| qbit-electrs testnet4 Esplora HTTP | 3004 | Testnet4 only | `Qbit-Org/qbit-electrs:src/config.rs:167` |
| MariaDB via repo compose | 33306 -> 3306 | Yes | `backend/docker-compose.test.yml:12-13` |
| Backend REST/WebSocket | 8999 | Yes | `backend/src/config.ts:211` |
| Frontend dev server | 4200 | Yes | Angular CLI default; `frontend/package.json` `serve` |

Common conflicts:

- Local MySQL or MariaDB may already use 3306. The repo test compose publishes
  MariaDB on host port 33306.
- If another service already uses a qbit-electrs port, start qbit-electrs with
  `--http-addr` or `--electrum-rpc-addr` and update `ESPLORA.REST_API_URL` or
  `ELECTRUM.PORT` to match.

## Required Config Keys

Backend config keys live in `backend/src/config.ts`; sample values live in
`backend/mempool-config.sample.json`.

| Key | qbit local value | Source |
| --- | --- | --- |
| `MEMPOOL_CONFIG_FILE` | Path to the local config file; a relative path is resolved against the backend's working directory | `backend/src/config.ts:27-28` |
| `MEMPOOL.NETWORK` | `regtest` for local qbitd | `backend/src/config.ts:38`, `:209` |
| `MEMPOOL.BACKEND` | `none`, `esplora`, or `electrum` | `backend/src/config.ts:39`, `:210` |
| `MEMPOOL.HTTP_PORT` | 8999 | `backend/src/config.ts:40`, `:211` |
| `MEMPOOL.API_URL_PREFIX` | `/api/v1/` | `backend/src/config.ts:44`, `:215` |
| `MEMPOOL.BLOCK_WEIGHT_UNITS` | 2000000 | `backend/src/config.ts:50`, `:221`; qbit `src/consensus/consensus.h:14-15` |
| `MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT` | 400000 | `backend/src/config.ts:244`; qbit `src/policy/policy.h:34-37` |
| `CORE_RPC.HOST` | `127.0.0.1` | `backend/src/config.ts:264-265` |
| `CORE_RPC.PORT` | 18452 for regtest | `backend/src/config.ts:266`; qbit `src/chainparamsbase.cpp:53-54` |
| `CORE_RPC.USERNAME` / `PASSWORD` | `mempool` / `mempool` in the examples | `backend/src/config.ts:267-268` |
| `CORE_RPC.COOKIE` | `false` for password-based local examples | `backend/src/config.ts:270-271` |
| `DATABASE.HOST` | `127.0.0.1` | `backend/src/config.ts:283-285` |
| `DATABASE.PORT` | 33306 with repo compose | `backend/docker-compose.test.yml:12-13` |
| `DATABASE.DATABASE` / `USERNAME` / `PASSWORD` | `mempool_test` / `mempool_test` / `mempool_test` with repo compose | `backend/docker-compose.test.yml:6-10` |
| `ESPLORA.REST_API_URL` | qbit-electrs HTTP base URL, `http://127.0.0.1:3002` for a local regtest instance | `backend/src/config.ts:249-250`; qbit-electrs `src/config.rs:163` |
| `ESPLORA.UNIX_SOCKET_PATH` | `null` for HTTP | `backend/src/config.ts:249-251` |
| `ELECTRUM.HOST` | qbit-electrs host | `backend/src/config.ts:259-260` |
| `ELECTRUM.PORT` | 60401 for a local regtest qbit-electrs | qbit-electrs `src/config.rs:143` |
| `ELECTRUM.TLS_ENABLED` | `false` for plaintext local Electrum; match your hosted endpoint | `backend/src/config.ts:259-262` |
| `LIGHTNING.ENABLED` | `false` | `backend/mempool-config.sample.json:106-107` |
| `REDIS.ENABLED` | `false` | `backend/mempool-config.sample.json:136-137` |
| `FIAT_PRICE.ENABLED` | `false` for qbit local work | `backend/src/config.ts:189-190`, `:360-361` |

Frontend config is generated from `frontend/update-config.js` into
`frontend/mempool-frontend-config.json`. The local Angular serve config uses
`frontend/proxy.conf.local.js`, where `/api/v1/**` and `/regtest/api/**` proxy
to `http://127.0.0.1:8999` (`frontend/proxy.conf.local.js:15-32`).

## Regtest Harness

`backend/scripts/qbit-regtest-harness.sh` runs the backend steps of this guide
in one command, as the `qbit Regtest Smoke` workflow does in CI. It needs
`qbitd` and `qbit-cli` (the v1.0.0 release binaries work), Python 3 and a built
backend:

```bash
cd backend
npm run build
export QBITD=/path/to/qbit-1.0.0/bin/qbitd QBIT_CLI=/path/to/qbit-1.0.0/bin/qbit-cli
export QBIT_REGTEST_DIR="$HOME/.qbit-regtest-harness"
# Optional: a qbit-electrs binary switches the backend to MEMPOOL.BACKEND=esplora
export QBIT_ELECTRS=/path/to/qbit-electrs/target/release/electrs
# Optional: MariaDB with a database of its own, as CI runs it
docker run -d --rm --name qbit-regtest-db -p 127.0.0.1:33307:3306 --tmpfs /var/lib/mysql \
  -e MYSQL_DATABASE=qbit_regtest_harness -e MYSQL_USER=qbit_regtest_harness \
  -e MYSQL_PASSWORD=qbit_regtest_harness -e MYSQL_ROOT_PASSWORD=admin mariadb:10.5.21
export QBIT_REGTEST_DB_HOST=127.0.0.1 QBIT_REGTEST_DB_PORT=33307 \
  QBIT_REGTEST_DB_NAME=qbit_regtest_harness QBIT_REGTEST_DB_USER=qbit_regtest_harness \
  QBIT_REGTEST_DB_PASSWORD=qbit_regtest_harness
scripts/qbit-regtest-harness.sh up
set -a; . "$QBIT_REGTEST_DIR/smoke.env"; set +a
npm run smoke:qbit-regtest
scripts/qbit-regtest-harness.sh down
```

`up` creates a new chain in `QBIT_REGTEST_DIR` (default
`${TMPDIR:-/tmp}/qbit-regtest-<uid>`, created private) and binds every service
to 127.0.0.1 on the ports above. It refuses a directory you don't own or that
its group or other users can write to. It:

- starts qbitd with cookie authentication, mines 1,100 blocks, sends to every
  address type the wallet offers plus an `OP_RETURN` and an anchor output, spends
  a P2MR output through its script path, and mines three AuxPoW-lane blocks with
  `createauxblock`, `submitauxblock` and `scripts/qbit-regtest-auxpow.py`. It also
  adds a P2WSH and a reserved witness output, unless `QBIT_REGTEST_P2MRONLY=1`.
  One or two spends stay in the mempool. `seed.json` lists what it created.
- starts qbit-electrs when `QBIT_ELECTRS` is set and waits until its tip and
  mempool match the node.
- writes `mempool-config.json` from `production/mempool-config.regtest.json`,
  enabling `DATABASE` only when `QBIT_REGTEST_DB_HOST` is set, starts
  `backend/dist/index.js` and waits until the backend has processed the node's
  tip and mempool, and with a database, finished its first indexing run.

Each run starts a new chain, so `up` refuses a database that already has
tables, such as one left by the previous run. Give the harness a database of its
own, not the integration tests' `mempool_test`. To reuse a database, for
example the container above across runs, set `QBIT_REGTEST_DB_RESET=1`, which
drops the tables of `QBIT_REGTEST_DB_NAME` before the run. The reset only
accepts a database whose name starts with `qbit_regtest_`.

To run the browser tests against the stack, source `smoke.env` and let the script
serve the frontend, which also sets its config to regtest:

```bash
set -a; . "$QBIT_REGTEST_DIR/smoke.env"; set +a
cd frontend
npm run cypress:run:regtest
```

Use `npm run cypress:open:regtest` to watch them. The specs are in
`frontend/cypress/e2e/regtest/` and read `seed.json`, so they expect the default
`QBIT_REGTEST_P2MRONLY=0`, a database and `QBIT_ELECTRS`. `reorg.spec.ts` moves
the tip, so each full run needs a new stack: `down`, then `up` with
`QBIT_REGTEST_DB_RESET=1`.

If a step fails or `QBIT_REGTEST_TIMEOUT` seconds (default 600) pass, `up`
prints the log tails from `logs/` and stops everything it started. `down`
stops a running stack and keeps the logs.

The wallet offers every `getnewaddress` type because the harness starts qbitd
with `-p2mronly=0`. Set `QBIT_REGTEST_P2MRONLY=1` for qbitd's regtest default,
which accepts only P2MR, `OP_RETURN` and anchor outputs, as mainnet and
testnet4 do. In that mode the wallet offers only `p2mr` addresses and rejects
sends to other script types. AuxPoW mining needs only a P2MR payout address in
either mode.

Without a database the backend serves no `/api/v1/mining/*` endpoints, so the
smoke script's `backend mining hashrate` check fails.

## Start qbitd Regtest

Build qbit, after installing the dependencies listed in its
[`doc/build/`](https://github.com/Qbit-Org/qbit/tree/v1.0.0/doc/build) guides:

```bash
cd /path/to/qbit
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build -j"$(getconf _NPROCESSORS_ONLN)"
```

Start regtest:

```bash
mkdir -p "$HOME/.qbit-regtest"
build/bin/qbitd \
  -regtest \
  -server \
  -txindex \
  -rpcuser=mempool \
  -rpcpassword=mempool \
  -rpcbind=127.0.0.1 \
  -rpcallowip=127.0.0.1 \
  -rpcport=18452 \
  -fallbackfee=0.0001 \
  -datadir="$HOME/.qbit-regtest"
```

Notes:

- qbitd refuses to start if the `-datadir` directory does not exist, so create
  it first.
- `-txindex` is required for arbitrary transaction lookup.
- `-fallbackfee` makes wallet-generated test transactions easier before fee
  estimation has history.
- Regtest-only flags worth knowing:
  - `-testactivationheight=p2mr@H` and `-testactivationheight=cadence@H` move
    the P2MR and Cadence activation heights.
  - `-asert` or `-legacyretarget` (not both) turns on difficulty adjustment;
    regtest otherwise mines at fixed difficulty.
  - `-p2mronly=0` allows unrestricted outputs; regtest otherwise accepts only
    P2MR, `OP_RETURN`, and anchor outputs.
  - `-test=disable_witness_pruning` disables witness pruning.

Mine enough blocks for mature coinbase funds:

```bash
QBIT_CLI=/path/to/qbit/build/bin/qbit-cli
"$QBIT_CLI" -regtest -rpcuser=mempool -rpcpassword=mempool -rpcport=18452 createwallet mempool-dev
ADDR="$("$QBIT_CLI" -regtest -rpcuser=mempool -rpcpassword=mempool -rpcport=18452 getnewaddress)"
"$QBIT_CLI" -regtest -rpcuser=mempool -rpcpassword=mempool -rpcport=18452 generatetoaddress 1100 "$ADDR"
```

qbit coinbase maturity is 1,000 blocks
(`Qbit-Org/qbit:src/consensus/consensus.h:18-19`).

## Start MariaDB

From this repo:

```bash
docker compose -f backend/docker-compose.test.yml up -d
```

The compose file creates database/user/password `mempool_test` on host port
33306.

## Configure Backend

Create a local backend config file. This file is intentionally not committed.

```bash
cp backend/mempool-config.sample.json backend/mempool-config.qbit-regtest.json
```

Use these minimum values for qbitd-only work:

```json
{
  "MEMPOOL": {
    "NETWORK": "regtest",
    "BACKEND": "none",
    "ENABLED": true,
    "HTTP_PORT": 8999,
    "API_URL_PREFIX": "/api/v1/",
    "BLOCK_WEIGHT_UNITS": 2000000,
    "MAX_PUSH_TX_SIZE_WEIGHT": 400000,
    "AUDIT": false,
    "AUTOMATIC_POOLS_UPDATE": false,
    "POOLS_JSON_URL": "",
    "POOLS_JSON_TREE_URL": "",
    "EXTERNAL_ASSETS": [],
    "USER_AGENT": "qbit-explorer-dev"
  },
  "CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 18452,
    "USERNAME": "mempool",
    "PASSWORD": "mempool",
    "TIMEOUT": 60000,
    "COOKIE": false,
    "COOKIE_PATH": "",
    "DEBUG_LOG_PATH": ""
  },
  "DATABASE": {
    "ENABLED": true,
    "HOST": "127.0.0.1",
    "PORT": 33306,
    "SOCKET": "",
    "DATABASE": "mempool_test",
    "USERNAME": "mempool_test",
    "PASSWORD": "mempool_test",
    "TIMEOUT": 180000,
    "PID_DIR": ""
  },
  "LIGHTNING": {
    "ENABLED": false
  },
  "REDIS": {
    "ENABLED": false
  },
  "FIAT_PRICE": {
    "ENABLED": false
  }
}
```

To use the qbit-electrs Esplora REST API, switch:

```json
{
  "MEMPOOL": {
    "BACKEND": "esplora"
  },
  "ESPLORA": {
    "REST_API_URL": "http://127.0.0.1:3002",
    "UNIX_SOCKET_PATH": null
  }
}
```

To use the qbit-electrs Electrum RPC instead, switch:

```json
{
  "MEMPOOL": {
    "BACKEND": "electrum"
  },
  "ELECTRUM": {
    "HOST": "127.0.0.1",
    "PORT": 60401,
    "TLS_ENABLED": false
  }
}
```

The checked-in backend defaults use qbit's 2,000,000 block-weight limit and
mainnet RPC port 8352. Override `CORE_RPC.PORT` with the matching qbit network
port for non-mainnet development; regtest uses 18452.

## Start Backend

```bash
cd backend
MEMPOOL_CONFIG_FILE="$PWD/mempool-config.qbit-regtest.json" npm run build
MEMPOOL_CONFIG_FILE="$PWD/mempool-config.qbit-regtest.json" npm run start
```

Smoke checks:

```bash
curl -fsS http://127.0.0.1:8999/api/v1/backend-info | jq .
curl -fsS http://127.0.0.1:8999/api/v1/blocks/tip/height
MEMPOOL_API_URL=http://127.0.0.1:8999/api/v1 npm run smoke:qbit-regtest
```

With `MEMPOOL.BACKEND=none`, block and mempool data comes from qbitd RPC-backed
paths only. Address pages and most Esplora-compatible endpoints need
qbit-electrs.

To include direct qbitd and qbit-electrs checks:

```bash
cd backend
QBIT_CLI=/path/to/qbit/build/bin/qbit-cli \
QBIT_CLI_ARGS="-regtest -rpcuser=mempool -rpcpassword=mempool -rpcport=18452" \
ESPLORA_URL=http://127.0.0.1:3002 \
npm run smoke:qbit-regtest
```

To validate a hosted testnet4 qbit-electrs REST endpoint before the mempool
backend is pointed at it:

```bash
cd backend
SKIP_BACKEND=1 ESPLORA_URL=http://host-or-ip:3004 npm run smoke:qbit-regtest
```

## Start Frontend

In another shell:

```bash
cd frontend
npm run config:defaults:mempool
npm run serve
```

Open `http://localhost:4200`.

The `local` Angular serve config uses `frontend/proxy.conf.local.js`, which
proxies `/api/v1/**` and `/regtest/api/**` to `http://127.0.0.1:8999`.

To enable regtest and testnet4 in the frontend and pin the qbit display
settings explicitly:

```bash
cd frontend
node update-config.js \
  REGTEST_ENABLED=true \
  TESTNET4_ENABLED=true \
  ACCELERATOR=false \
  HISTORICAL_PRICE=false \
  BASE_MODULE=mempool \
  BLOCK_WEIGHT_UNITS=2000000
npm run generate-config
npm run serve
```

## qbit-electrs Hookup

[Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs) is the
qbit-aware Electrum and Esplora REST indexer; its contract is
`doc/qbit-contract.md` in that repo. See its README for build prerequisites,
then run it against the regtest node above:

```bash
cd /path/to/qbit-electrs
cargo run --release --bin electrs -- \
  -vvvv \
  --network qbitregtest \
  --daemon-dir "$HOME/.qbit-regtest/regtest" \
  --daemon-rpc-addr 127.0.0.1:18452 \
  --jsonrpc-import \
  --cookie mempool:mempool
```

On regtest it serves Esplora HTTP on `127.0.0.1:3002` and Electrum on
`127.0.0.1:60401` by default. Configure mempool against one of its served APIs:

- Esplora HTTP: set `MEMPOOL.BACKEND=esplora` and `ESPLORA.REST_API_URL`.
- Electrum TCP/TLS: set `MEMPOOL.BACKEND=electrum`, `ELECTRUM.HOST`,
  `ELECTRUM.PORT`, and `ELECTRUM.TLS_ENABLED`.

For hosted validation, you need:

- Esplora base URL, if using HTTP.
- Electrum host, port, and TLS mode, if using Electrum.
- Matching qbitd RPC host, port, auth, and network, if backend RPC checks need
  the node directly.
- Whether the target is regtest, testnet4, or another temporary network.

Do not commit credentials or private endpoint details. Keep them in a local
config file or environment-specific secret store.

## Reset State

Stop processes first, then reset as needed:

```bash
# qbit regtest chain and wallet
rm -rf "$HOME/.qbit-regtest"

# MariaDB test container data is tmpfs; restart it to clear state
docker compose -f backend/docker-compose.test.yml down
docker compose -f backend/docker-compose.test.yml up -d

# mempool backend cache
rm -rf backend/cache
```

If using a non-tmpfs local MariaDB instead of the repo compose file:

```sql
DROP DATABASE mempool;
CREATE DATABASE mempool;
```

## Common Failure Modes

Backend cannot connect to RPC:

- Check qbitd is running with `-server`.
- Check `CORE_RPC.PORT=18452` for regtest, not Bitcoin's 8332.
- Check `CORE_RPC.USERNAME` and `CORE_RPC.PASSWORD` match qbitd flags.

Tip height answers 503 with `Initial block sync in progress`:

- The backend has not caught up with qbitd's tip since it started. It answers
  with the height once it has processed the newest blocks, which on regtest
  takes well under a second.
- If it stays 503, the backend log says why: usually it cannot reach qbitd (or
  qbit-electrs with `MEMPOOL.BACKEND=esplora`).

Backend starts but tip height is zero:

- Mine regtest blocks with `generatetoaddress`.
- Confirm `MEMPOOL.NETWORK=regtest`.

MariaDB connection fails:

- Check `docker compose -f backend/docker-compose.test.yml ps`.
- Use `DATABASE.PORT=33306` for the repo compose path.
- Use database/user/password `mempool_test`.

Address pages 404:

- `MEMPOOL.BACKEND=none` does not provide address history.
- Start qbit-electrs and use `BACKEND=esplora` or `BACKEND=electrum`.

Block or transaction sizes look four times off:

- Check backend and frontend `BLOCK_WEIGHT_UNITS=2000000`.
- qbit uses `WITNESS_SCALE_FACTOR=1`; explorer math should not divide weight by
  four.

Liquid, Lightning, accelerator, or price surfaces fail:

- These are upstream mempool surfaces that qbit does not use.
- Keep them disabled in the backend and frontend config, as in the examples
  above.

## Testnet4 Read-Only Validation

For testnet4, use qbit RPC port 48352 and a qbit-electrs instance indexed on
qbit testnet4 (`--network qbittestnet4`, Esplora HTTP on port 3004 by default).
DNS seeds are `coherence-testnet4.qbit.org` and `triplet-testnet4.qbit.org`
(`Qbit-Org/qbit:src/kernel/chainparams.cpp:404-405`).

Do not mine or broadcast during testnet4 validation. The smoke script behind
`npm run smoke:qbit-regtest` only reads, so the `SKIP_BACKEND=1`
hosted-endpoint check above is safe to run against testnet4.
