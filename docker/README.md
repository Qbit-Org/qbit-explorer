# Docker

This directory contains the Dockerfiles and start scripts for the qbit explorer
images, and a sample `docker-compose.yml` that runs them with MariaDB.

The images contain only the explorer frontend (nginx serving the Angular build)
and the backend (the Node.js API). You run the rest yourself:

- [`qbitd`](https://github.com/Qbit-Org/qbit), unpruned, with `txindex=1` and
  RPC enabled.
- Optionally [qbit-electrs](https://github.com/Qbit-Org/qbit-electrs), which
  adds address lookups through its REST API.
- A reverse proxy with TLS if the explorer is public.

Jump to a section:

- [Images](#images)
- [Run with Docker Compose](#run-with-docker-compose)
- [Configuration reference](#configuration-reference)

## Images

No images are published, so build them yourself as shown below.
[`.github/workflows/docker.yml`](../.github/workflows/docker.yml) runs the same
build on every pull request and on every `v*` tag. It then starts both images
with `docker-compose.yml` and checks that all three containers become healthy,
that nginx answers a missing bundle with an uncached 404, and that the API
answers through nginx, also after the `api` container is recreated, without
pushing the images anywhere.

### Build the images yourself

These steps mirror the `test-images` job in `docker.yml`:

```bash
git clone https://github.com/Qbit-Org/qbit-explorer.git
cd qbit-explorer
docker/init.sh
docker buildx build --load \
  --build-arg commitHash="$(git rev-parse --short=8 HEAD)" \
  --tag qbit-explorer-frontend:local ./frontend/
docker buildx build --load \
  --build-context rustgbt=./rust --build-context backend=./backend \
  --build-arg commitHash="$(git rev-parse --short=8 HEAD)" \
  --tag qbit-explorer-backend:local ./backend/
```

Run `docker/init.sh` from the repository root. It copies `docker/backend`,
`docker/frontend`, `nginx.conf` and `nginx-mempool.conf` into the build
contexts (the copies are git-ignored). The frontend image build needs
network access: it downloads mining pool logos from
[mempool/mining-pool-logos](https://github.com/mempool/mining-pool-logos),
which include the logos for the AuxPoW parent pools the explorer recognises.

The build lists those logos through the GitHub API, twice per build. GitHub
allows 60 unauthenticated API requests an hour per IP address, so a build on a
busy or shared address can fail with `API rate limit exceeded`. A token is
optional and raises that limit: set `GITHUB_TOKEN` and add
`--secret id=github_token,env=GITHUB_TOKEN` to the frontend build. Only the
build step that downloads the logos sees the token, and it isn't stored in the
image. `docker.yml` passes the job's read-only token this way.

Both images need BuildKit, Docker's default builder since Docker 23, which
`docker buildx build` always uses: the frontend image for that secret mount,
with or without a token, and the backend image for its `--build-context`
options.

The Dockerfiles pin each base image by digest, and the backend image checks
NodeSource's Node.js setup script against a SHA-256 before running it.
Dependabot proposes digest updates. NodeSource can republish `setup_26.x` at
the same URL, and the backend build then stops at that check: read the new
script, then put its checksum in both stages of `docker/backend/Dockerfile`.

## Run with Docker Compose

`docker-compose.yml` runs the frontend (`web`), the backend (`api`) and MariaDB
(`db`). It has no default images, so choose them in `docker/.env` first:

```bash
cd docker
cp .env.example .env
```

Then set `QBIT_EXPLORER_FRONTEND_IMAGE` and `QBIT_EXPLORER_BACKEND_IMAGE` in
`.env`: `qbit-explorer-frontend:local` and `qbit-explorer-backend:local` for
the images built above, or the names you gave them if you pushed them to your
own registry. Until both are set,
Compose stops with `required variable ... is missing a value`. Compose reads
`.env` from `docker/` on every command, so `docker compose ps`, `logs` and
`down` work in any shell without exporting anything. Variables exported in your shell take
precedence over `.env`, and `.env` is git-ignored.

Every container runs as UID/GID 1000. The backend cache lives in `docker/data` and the database in
`docker/mysql/data`, so UID 1000 must be able to write to both.

> **Always set `MEMPOOL_BACKEND`.** The backend image defaults to `electrum`, a
> value inherited from upstream mempool. The sample compose file sets `none`,
> and most qbit setups use `esplora` with qbit-electrs (see below).

### qbitd only

In this mode the explorer reads everything from qbitd RPC. Address lookups need
qbit-electrs, so they don't work here.

Configure `qbit.conf`:

```ini
server=1
txindex=1
# the RPC cookie, in a directory of its own for the backend container to mount
rpccookiefile=/var/lib/qbit/rpc/.cookie
rpccookieperms=group

# qbitd accepts RPC only on localhost unless both rpcbind and rpcallowip are
# set. Bind to the address the containers use (CORE_RPC_HOST below) and allow
# the Docker subnets. Never expose the RPC port to the internet.
rpcbind=127.0.0.1
rpcbind=172.17.0.1
rpcallowip=127.0.0.1
rpcallowip=172.16.0.0/12
```

With no `rpcpassword` set, qbitd writes an RPC cookie each time it starts. The
backend authenticates with it, so no RPC password goes into
`docker-compose.yml`. qbitd doesn't create the cookie's directory, so create it
for the user qbitd runs as, here the `qbit` user of qbit's systemd unit:

```bash
sudo install -d -o qbit -g qbit -m 0750 /var/lib/qbit/rpc
```

Set the RPC address and the cookie for the `api` service in
`docker-compose.yml`. `CORE_RPC_HOST` must be an address of the Docker host that
the containers can reach. The `172.27.0.1` in the file is a placeholder; the
host's `docker0` address, usually `172.17.0.1`, is a common choice. Mount the
cookie's directory read-only, not the cookie itself: qbitd replaces the file at
every start, and a file mount would keep showing the old one. The container
runs as UID 1000, so unless qbitd does too, add the GID of the group that owns
the cookie (`getent group qbit`) with `group_add`:

```yaml
  api:
    environment:
      MEMPOOL_BACKEND: "none"
      CORE_RPC_HOST: "172.17.0.1"
      CORE_RPC_PORT: "8352"
      CORE_RPC_COOKIE: "true"
      CORE_RPC_COOKIE_PATH: "/qbit-rpc/.cookie"
    group_add:
      - "999" # the qbit group's GID
    volumes:
      - ./data:/backend/cache
      - /var/lib/qbit/rpc:/qbit-rpc:ro
```

Set both cookie variables. The image leaves `CORE_RPC_COOKIE_PATH` empty, so
with `CORE_RPC_COOKIE` alone the backend has no cookie to read: it logs an error
at startup, and RPC calls fail. It doesn't fall back to `CORE_RPC_USERNAME` and
`CORE_RPC_PASSWORD`. To use a password, as the sample `docker-compose.yml`
does, add an `rpcauth` line to `qbit.conf` (qbit's
[`share/rpcauth/rpcauth.py`](https://github.com/Qbit-Org/qbit/blob/v1.0.0/share/rpcauth/rpcauth.py)
prints one) and set `CORE_RPC_USERNAME` and `CORE_RPC_PASSWORD` instead of the
cookie variables.

Once qbitd is running and synced, start the stack from `docker/`:

```bash
docker compose up -d
```

The explorer listens on port 80 of the host, at http://localhost.

### qbitd and qbit-electrs

[qbit-electrs](https://github.com/Qbit-Org/qbit-electrs) serves an
Esplora-compatible REST API, on port 3000 by default for mainnet. It must
listen (`--http-addr`) on an address the containers can reach. With the
`qbit.conf` above it uses the same cookie: start it with
`--daemon-dir /var/lib/qbit/rpc` and `--jsonrpc-import`, so that it reads
`.cookie` from that directory and fetches blocks over RPC. Run it as a user in
the `qbit` group, so that it can read the cookie. qbit-electrs uses an
explicit `--daemon-dir` as given on every chain, and adds the chain's
subdirectory, such as `testnet4/`, only to its default. Its `--cookie` option
takes the credentials themselves, which `ps` shows and which go stale when
qbitd restarts, so don't use it here. Point the backend at it:

```yaml
  api:
    environment:
      MEMPOOL_BACKEND: "esplora"
      ESPLORA_REST_API_URL: "http://172.17.0.1:3000"
```

`MEMPOOL_BACKEND` accepts `none` (qbitd only), `esplora` (the qbit-electrs REST
API) and `electrum` (an Electrum protocol server). qbit deployments normally use
`none` or `esplora`.

With `esplora`, search suggests addresses only when qbit-electrs runs with
`--address-search`, with an index rebuilt from an empty `--db-dir` if it was
built without the flag.

qbit-electrs also serves the Electrum protocol, over plain TCP, on port 50001
for mainnet, 40001 for testnet4 and 60401 for regtest. It listens on localhost
unless `--electrum-rpc-addr` says otherwise. The image's Electrum defaults
(`ELECTRUM_PORT` 50001, `ELECTRUM_TLS_ENABLED` false) match qbit-electrs on
mainnet. To use `MEMPOOL_BACKEND: "electrum"` on testnet4 or regtest, set
`ELECTRUM_PORT` to that network's port. Keep `ELECTRUM_TLS_ENABLED` false,
because qbit-electrs has no TLS:

```yaml
  api:
    environment:
      MEMPOOL_BACKEND: "electrum"
      ELECTRUM_HOST: "172.17.0.1"
      ELECTRUM_PORT: "50001" # 40001 on testnet4, 60401 on regtest
      ELECTRUM_TLS_ENABLED: "false"
```

### Networks

The bundled nginx configuration sends `/api` and `/ws` to a single backend, so
one stack serves one network. For testnet4 or regtest, set `ROOT_NETWORK` so the
frontend serves that network at `/`.

| Network | qbitd RPC | qbit-electrs REST | `api` environment | `web` environment |
| --- | --- | --- | --- | --- |
| mainnet | 8352 | 3000 | defaults | defaults |
| testnet4 | 48352 | 3004 | `MEMPOOL_NETWORK: "testnet4"`, `CORE_RPC_PORT: "48352"` | `MAINNET_ENABLED: "false"`, `TESTNET4_ENABLED: "true"`, `ROOT_NETWORK: "testnet4"` |
| regtest | 18452 | 3002 | `MEMPOOL_NETWORK: "regtest"`, `CORE_RPC_PORT: "18452"` | `MAINNET_ENABLED: "false"`, `REGTEST_ENABLED: "true"`, `ROOT_NETWORK: "regtest"` |

The block weight (2,000,000) and target spacing (60 seconds) defaults already
match qbit on every network. `MEMPOOL_RUST_GBT` defaults to `false` in the
container, so the backend projects blocks with its TypeScript builder. Set it
to `true` to use the faster Rust builder in `rust/gbt`, which the backend
defaults to outside the container.

## Configuration reference

### How settings reach the services

- **Backend:** at container start, `docker/backend/start.sh` reads the variables
  below, writes them into `/backend/mempool-config.json` and starts the API. An
  unset or empty variable takes the image default shown here. The built-in
  defaults in `backend/src/config.ts` apply only to keys missing from that file,
  so the image defaults are the ones that take effect. Some differ from the
  built-in defaults, for example `MEMPOOL_BACKEND`, `ESPLORA_REQUEST_TIMEOUT`
  and `SYSLOG_ENABLED`.
- **Frontend:** `docker/frontend/entrypoint.sh` writes `FRONTEND_HTTP_PORT` and
  the backend address into the nginx configuration, then renders the browser
  configuration (`config.js`) from the variables below. `MAINNET_EXPLORER_URL`
  and `TESTNET4_EXPLORER_URL` keep an explicitly empty value, which hides that
  link. Every other variable falls back to its default when unset or empty.

### Backend (`api`)

`MEMPOOL_NETWORK` is `mainnet`, `testnet4` or `regtest` for qbit.

**MEMPOOL**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `MEMPOOL_NETWORK` | `MEMPOOL.NETWORK` | `mainnet` |
| `MEMPOOL_BACKEND` | `MEMPOOL.BACKEND` | `electrum` |
| `MEMPOOL_ENABLED` | `MEMPOOL.ENABLED` | `true` |
| `MEMPOOL_OFFICIAL` | `MEMPOOL.OFFICIAL` | `false` |
| `BACKEND_HTTP_PORT` | `MEMPOOL.HTTP_PORT` | `8999` |
| `MEMPOOL_HTTP_HOST` | `MEMPOOL.HTTP_HOST` | (empty) |
| `MEMPOOL_SPAWN_CLUSTER_PROCS` | `MEMPOOL.SPAWN_CLUSTER_PROCS` | `0` |
| `MEMPOOL_UNIX_SOCKET_PATH` | `MEMPOOL.UNIX_SOCKET_PATH` | (empty) |
| `MEMPOOL_API_URL_PREFIX` | `MEMPOOL.API_URL_PREFIX` | `/api/v1/` |
| `MEMPOOL_POLL_RATE_MS` | `MEMPOOL.POLL_RATE_MS` | `2000` |
| `MEMPOOL_CACHE_DIR` | `MEMPOOL.CACHE_DIR` | `./cache` |
| `MEMPOOL_CACHE_ENABLED` | `MEMPOOL.CACHE_ENABLED` | `true` |
| `MEMPOOL_CLEAR_PROTECTION_MINUTES` | `MEMPOOL.CLEAR_PROTECTION_MINUTES` | `20` |
| `MEMPOOL_RECOMMENDED_FEE_PERCENTILE` | `MEMPOOL.RECOMMENDED_FEE_PERCENTILE` | `50` |
| `MEMPOOL_BLOCK_WEIGHT_UNITS` | `MEMPOOL.BLOCK_WEIGHT_UNITS` | `2000000` |
| `MEMPOOL_BLOCK_TARGET_SPACING_SECONDS` | `MEMPOOL.BLOCK_TARGET_SPACING_SECONDS` | `60` |
| `MEMPOOL_INITIAL_BLOCKS_AMOUNT` | `MEMPOOL.INITIAL_BLOCKS_AMOUNT` | `8` |
| `MEMPOOL_MEMPOOL_BLOCKS_AMOUNT` | `MEMPOOL.MEMPOOL_BLOCKS_AMOUNT` | `8` |
| `MEMPOOL_INDEXING_BLOCKS_AMOUNT` | `MEMPOOL.INDEXING_BLOCKS_AMOUNT` | `110000` |
| `MEMPOOL_BLOCKS_SUMMARIES_INDEXING` | `MEMPOOL.BLOCKS_SUMMARIES_INDEXING` | `false` |
| `MEMPOOL_GOGGLES_INDEXING` | `MEMPOOL.GOGGLES_INDEXING` | `false` |
| `MEMPOOL_USE_SECOND_NODE_FOR_MINFEE` | `MEMPOOL.USE_SECOND_NODE_FOR_MINFEE` | `false` |
| `MEMPOOL_EXTERNAL_ASSETS` | `MEMPOOL.EXTERNAL_ASSETS` | `[]` |
| `MEMPOOL_EXTERNAL_MAX_RETRY` | `MEMPOOL.EXTERNAL_MAX_RETRY` | `1` |
| `MEMPOOL_EXTERNAL_RETRY_INTERVAL` | `MEMPOOL.EXTERNAL_RETRY_INTERVAL` | `0` |
| `MEMPOOL_USER_AGENT` | `MEMPOOL.USER_AGENT` | `mempool` |
| `MEMPOOL_STDOUT_LOG_MIN_PRIORITY` | `MEMPOOL.STDOUT_LOG_MIN_PRIORITY` | `info` |
| `MEMPOOL_AUTOMATIC_POOLS_UPDATE` | `MEMPOOL.AUTOMATIC_POOLS_UPDATE` | `false` |
| `MEMPOOL_POOLS_JSON_URL` | `MEMPOOL.POOLS_JSON_URL` | (empty) |
| `MEMPOOL_POOLS_JSON_TREE_URL` | `MEMPOOL.POOLS_JSON_TREE_URL` | (empty) |
| `MEMPOOL_POOLS_UPDATE_DELAY` | `MEMPOOL.POOLS_UPDATE_DELAY` | `604800` |
| `MEMPOOL_AUDIT` | `MEMPOOL.AUDIT` | `false` |
| `MEMPOOL_RUST_GBT` | `MEMPOOL.RUST_GBT` | `false` |
| `MEMPOOL_LIMIT_GBT` | `MEMPOOL.LIMIT_GBT` | `false` |
| `MEMPOOL_CPFP_INDEXING` | `MEMPOOL.CPFP_INDEXING` | `false` |
| `MEMPOOL_MAX_BLOCKS_BULK_QUERY` | `MEMPOOL.MAX_BLOCKS_BULK_QUERY` | `0` |
| `MEMPOOL_DISK_CACHE_BLOCK_INTERVAL` | `MEMPOOL.DISK_CACHE_BLOCK_INTERVAL` | `6` |
| `MEMPOOL_MAX_PUSH_TX_SIZE_WEIGHT` | `MEMPOOL.MAX_PUSH_TX_SIZE_WEIGHT` | `400000` |
| `MEMPOOL_ALLOW_UNREACHABLE` | `MEMPOOL.ALLOW_UNREACHABLE` | `true` |
| `MEMPOOL_PRICE_UPDATES_PER_HOUR` | `MEMPOOL.PRICE_UPDATES_PER_HOUR` | `1` |
| `MEMPOOL_MAX_TRACKED_ADDRESSES` | `MEMPOOL.MAX_TRACKED_ADDRESSES` | `1` |

`MEMPOOL_HTTP_HOST` is the address the backend listens on: an IP address such
as `127.0.0.1` or `::1`, or empty for every interface. Under Compose, leave it
empty. The `web` container reaches the backend over the Compose network, and
with `127.0.0.1` the backend would only answer from inside its own container.

**CORE_RPC** (qbitd)

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `CORE_RPC_HOST` | `CORE_RPC.HOST` | `127.0.0.1` |
| `CORE_RPC_PORT` | `CORE_RPC.PORT` | `8352` |
| `CORE_RPC_USERNAME` | `CORE_RPC.USERNAME` | `mempool` |
| `CORE_RPC_PASSWORD` | `CORE_RPC.PASSWORD` | `mempool` |
| `CORE_RPC_TIMEOUT` | `CORE_RPC.TIMEOUT` | `60000` |
| `CORE_RPC_COOKIE` | `CORE_RPC.COOKIE` | `false` |
| `CORE_RPC_COOKIE_PATH` | `CORE_RPC.COOKIE_PATH` | (empty) |
| `CORE_RPC_DEBUG_LOG_PATH` | `CORE_RPC.DEBUG_LOG_PATH` | (empty) |

**ESPLORA** (qbit-electrs REST API)

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `ESPLORA_REST_API_URL` | `ESPLORA.REST_API_URL` | `http://127.0.0.1:3000` |
| `ESPLORA_UNIX_SOCKET_PATH` | `ESPLORA.UNIX_SOCKET_PATH` | (empty) |
| `ESPLORA_BATCH_QUERY_BASE_SIZE` | `ESPLORA.BATCH_QUERY_BASE_SIZE` | `1000` |
| `ESPLORA_RETRY_UNIX_SOCKET_AFTER` | `ESPLORA.RETRY_UNIX_SOCKET_AFTER` | `30000` |
| `ESPLORA_REQUEST_TIMEOUT` | `ESPLORA.REQUEST_TIMEOUT` | `5000` |
| `ESPLORA_FALLBACK_TIMEOUT` | `ESPLORA.FALLBACK_TIMEOUT` | `5000` |
| `ESPLORA_FALLBACK` | `ESPLORA.FALLBACK` | `[]` |
| `ESPLORA_MAX_BEHIND_TIP` | `ESPLORA.MAX_BEHIND_TIP` | `2` |

**ELECTRUM**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `ELECTRUM_HOST` | `ELECTRUM.HOST` | `127.0.0.1` |
| `ELECTRUM_PORT` | `ELECTRUM.PORT` | `50001` |
| `ELECTRUM_TLS_ENABLED` | `ELECTRUM.TLS_ENABLED` | `false` |

**SECOND_CORE_RPC** (optional second qbitd)

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `SECOND_CORE_RPC_HOST` | `SECOND_CORE_RPC.HOST` | `127.0.0.1` |
| `SECOND_CORE_RPC_PORT` | `SECOND_CORE_RPC.PORT` | `8352` |
| `SECOND_CORE_RPC_USERNAME` | `SECOND_CORE_RPC.USERNAME` | `mempool` |
| `SECOND_CORE_RPC_PASSWORD` | `SECOND_CORE_RPC.PASSWORD` | `mempool` |
| `SECOND_CORE_RPC_TIMEOUT` | `SECOND_CORE_RPC.TIMEOUT` | `60000` |
| `SECOND_CORE_RPC_COOKIE` | `SECOND_CORE_RPC.COOKIE` | `false` |
| `SECOND_CORE_RPC_COOKIE_PATH` | `SECOND_CORE_RPC.COOKIE_PATH` | (empty) |

**DATABASE**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `DATABASE_ENABLED` | `DATABASE.ENABLED` | `true` |
| `DATABASE_HOST` | `DATABASE.HOST` | `127.0.0.1` |
| `DATABASE_SOCKET` | `DATABASE.SOCKET` | (empty) |
| `DATABASE_PORT` | `DATABASE.PORT` | `3306` |
| `DATABASE_DATABASE` | `DATABASE.DATABASE` | `mempool` |
| `DATABASE_USERNAME` | `DATABASE.USERNAME` | `mempool` |
| `DATABASE_PASSWORD` | `DATABASE.PASSWORD` | `mempool` |
| `DATABASE_TIMEOUT` | `DATABASE.TIMEOUT` | `180000` |
| `DATABASE_PID_DIR` | `DATABASE.PID_DIR` | (empty) |
| `DATABASE_POOL_SIZE` | `DATABASE.POOL_SIZE` | `100` |

**SYSLOG**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `SYSLOG_ENABLED` | `SYSLOG.ENABLED` | `false` |
| `SYSLOG_HOST` | `SYSLOG.HOST` | `127.0.0.1` |
| `SYSLOG_PORT` | `SYSLOG.PORT` | `514` |
| `SYSLOG_MIN_PRIORITY` | `SYSLOG.MIN_PRIORITY` | `info` |
| `SYSLOG_FACILITY` | `SYSLOG.FACILITY` | `local7` |

**STATISTICS**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `STATISTICS_ENABLED` | `STATISTICS.ENABLED` | `true` |
| `STATISTICS_TX_PER_SECOND_SAMPLE_PERIOD` | `STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD` | `150` |

**SOCKS5PROXY**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `SOCKS5PROXY_ENABLED` | `SOCKS5PROXY.ENABLED` | `false` |
| `SOCKS5PROXY_USE_ONION` | `SOCKS5PROXY.USE_ONION` | `true` |
| `SOCKS5PROXY_HOST` | `SOCKS5PROXY.HOST` | `localhost` |
| `SOCKS5PROXY_PORT` | `SOCKS5PROXY.PORT` | `9050` |
| `SOCKS5PROXY_USERNAME` | `SOCKS5PROXY.USERNAME` | (empty) |
| `SOCKS5PROXY_PASSWORD` | `SOCKS5PROXY.PASSWORD` | (empty) |

**REDIS**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `REDIS_ENABLED` | `REDIS.ENABLED` | `false` |
| `REDIS_UNIX_SOCKET_PATH` | `REDIS.UNIX_SOCKET_PATH` | (empty) |
| `REDIS_BATCH_QUERY_BASE_SIZE` | `REDIS.BATCH_QUERY_BASE_SIZE` | `5000` |

**FIAT_PRICE**

| Variable | `mempool-config.json` key | Image default |
| --- | --- | --- |
| `FIAT_PRICE_ENABLED` | `FIAT_PRICE.ENABLED` | `true` |
| `FIAT_PRICE_PAID` | `FIAT_PRICE.PAID` | `false` |
| `FIAT_PRICE_API_KEY` | `FIAT_PRICE.API_KEY` | (empty) |

`start.sh` also reads upstream mempool settings that qbit doesn't use:
mempool.space services and replication (`MEMPOOL_SERVICES_*`,
`REPLICATION_*`, `EXTERNAL_DATA_SERVER_*`) and Stratum job tracking
(`STRATUM_*`). Their defaults disable them, so leave them unset.

### Frontend (`web`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `FRONTEND_HTTP_PORT` | `8080` | Port nginx listens on inside the container |
| `BACKEND_MAINNET_HTTP_HOST` | `127.0.0.1` | Backend host or IP address that nginx proxies `/api` and `/ws` to (`api` in the compose file). See [Backend host names](#backend-host-names) for how nginx looks a host name up |
| `BACKEND_MAINNET_HTTP_PORT` | `8999` | Backend port for that proxy |
| `MAINNET_ENABLED` | `true` | Serve qbit mainnet |
| `TESTNET4_ENABLED` | `false` | Serve qbit testnet4 |
| `REGTEST_ENABLED` | `false` | Serve regtest |
| `TESTNET_ENABLED`, `SIGNET_ENABLED` | `false` | Upstream Bitcoin networks; leave off |
| `ROOT_NETWORK` | (empty) | Network served at `/`; empty means mainnet |
| `QBIT_SITE_CHROME` | `true` | Shows qbit.org's header, banner and footer. Set it to `false` to remove them; the frontend then doesn't contact qbit.org |
| `MAINNET_EXPLORER_URL` | `https://mempool.qbit.org` | Mainnet link shown when this instance doesn't serve mainnet; set it empty to hide the link |
| `TESTNET4_EXPLORER_URL` | `https://mempool-testnet.qbit.org` | The same for testnet4 |
| `BLOCK_WEIGHT_UNITS` | `2000000` | qbit maximum block weight |
| `BLOCK_TARGET_SPACING_SECONDS` | `60` | qbit target block spacing |
| `MEMPOOL_BLOCKS_AMOUNT` | `8` | Projected mempool blocks to show |
| `KEEP_BLOCKS_AMOUNT` | `8` | Recent blocks to keep in the blockchain view |
| `ITEMS_PER_PAGE` | `10` | Page size for lists |
| `BASE_MODULE` | `mempool` | Frontend module; keep `mempool` |
| `MINING_DASHBOARD` | `true` | Mining dashboard and pool pages |
| `AUDIT` | `false` | Block audit views; needs `MEMPOOL_AUDIT=true` on the backend |
| `MAINNET_BLOCK_AUDIT_START_HEIGHT`, `TESTNET4_BLOCK_AUDIT_START_HEIGHT`, `REGTEST_BLOCK_AUDIT_START_HEIGHT`, `TESTNET_BLOCK_AUDIT_START_HEIGHT`, `SIGNET_BLOCK_AUDIT_START_HEIGHT` | `0` | First height with block audit data, per network |
| `MAINNET_TX_FIRST_SEEN_START_HEIGHT`, `TESTNET4_TX_FIRST_SEEN_START_HEIGHT`, `REGTEST_TX_FIRST_SEEN_START_HEIGHT`, `TESTNET_TX_FIRST_SEEN_START_HEIGHT`, `SIGNET_TX_FIRST_SEEN_START_HEIGHT` | `0` | First height from which confirmed transactions show a first-seen time, per network; `0` turns it off |
| `MEMPOOL_WEBSITE_URL` | (empty) | Base URL for links to addresses on other networks |
| `HISTORICAL_PRICE` | `false` | Historical fiat prices |
| `ADDITIONAL_CURRENCIES` | `false` | Extra fiat currencies |
| `NGINX_PROTOCOL`, `NGINX_HOSTNAME`, `NGINX_PORT` | `http`, `localhost`, `8999` | API address for server-side rendering only; the browser uses relative URLs |
| `ACCELERATOR`, `ACCELERATOR_BUTTON`, `PUBLIC_ACCELERATIONS`, `SERVICES_API`, `STRATUM_ENABLED` | off or empty | Upstream mempool.space services; leave them off |

### Backend host names

nginx looks up a `BACKEND_MAINNET_HTTP_HOST` host name when a request comes
in, and keeps the answer for 10 seconds, so it follows a recreated `api`
container to its new address. An IP address needs no lookup.

At every start, `entrypoint.sh` sets nginx's resolver to the first
`nameserver` in the container's `/etc/resolv.conf` that nginx can use, so a
restart after a network change picks up the new one:

- On a user-defined Docker network, such as Compose's, that is Docker's DNS
  server, `127.0.0.11`. Elsewhere, such as in Kubernetes, in Podman or on
  Docker's default bridge network, it's the DNS server the container gets
  there, and the log names it.
- It skips link-local IPv6 addresses with a zone, such as `fe80::1%eth0`,
  which nginx can't use. If no nameserver is left, it uses `127.0.0.11` and
  logs that.
- With an IPv6 nameserver, nginx asks for IPv4 and IPv6 addresses. With any
  other, `127.0.0.11` included, it asks for IPv4 addresses only.

nginx doesn't read `/etc/hosts` and doesn't add `search` domains, so some
names that resolved before don't. Set an IP address instead, with an IPv6
address in brackets, such as `[fd00::2]`:

- names that only `/etc/hosts` knows, from `extra_hosts`, `--add-host` or
  `--link`;
- short names that need a `search` domain, such as a Kubernetes service's
  `api`. Its full name, `api.<namespace>.svc.cluster.local`, also works;
- names with only an IPv6 address, when the nameserver is IPv4.
