# Changelog

## 1.2.0

### Fixed

- Under `MEMPOOL.BACKEND` `esplora`, `POST /api/tx` and `POST /api/txs/test`
  answered 400 for every transaction. Neither the Broadcast Transaction page
  nor clients of the esplora API's `POST /tx` could broadcast, and the Test
  Transactions page couldn't test. Both routes now go through qbitd, as
  `POST /api/tx/push` does. A broadcast answers the txid, and a transaction
  qbitd refuses gets 400 with qbitd's error code
  (`sendrawtransaction RPC error: {"code":N}`). The `none` and `electrum`
  backends already sent both to qbitd.
- `POST /api/tx` takes the hex as the whole body, whatever its content type,
  as qbit-electrs's `POST /tx` does. A form, which `curl -d` sends and the
  API docs show, an `application/octet-stream` body and one without a
  content type got 400 `sendrawtransaction RPC error: {"code":-1}` under
  every backend, without reaching qbitd, as the route only read a body sent
  as text.
- The backend follows `invalidateblock`, and a chain wiped while it runs,
  such as a regtest reset, without waiting for a new block. It took a qbitd
  tip below its cached blocks for a node catching up, and kept them.
  `GET /api/blocks/tip/height` and the block lists showed the invalidated
  blocks until qbitd's next block, and a wiped chain's blocks until the new
  chain reached their heights or the backend restarted. Now the backend asks
  qbitd whether it is still syncing. While qbitd is in initial block
  download, or has headers above its tip, the blocks stay, as before.
  Otherwise the backend drops them, as it drops blocks a reorg replaced, and
  sends pages one reorg.
- `/blocks` and the mining dashboard's block list follow a reorg without a
  reload. They used to keep the blocks a reorg replaced, and never showed a
  block replaced at the same height. After a reorg to a shorter chain, they
  skipped new blocks until the chain passed the old tip. Now the WebSocket's
  blocks win at their heights, a page the reorg reached takes the new
  chain's blocks, and the page count follows the new tip on every page.
  When the WebSocket's blocks would leave a gap on the first page, as after
  the tab missed more blocks than they hold, the page asks the API again.
  When an answer from `/api/v1/blocks` doesn't fit the WebSocket's chain,
  such as a browser's or CDN's copy from before the reorg, the list asks
  again 10 seconds later, past caches. From the third request of a page
  load on, failed ones included, it shows the blocks that fit instead.
- With indexing on, the chain check repairs heights below the indexing
  window that hold two or more canonical block rows, which releases before
  1.1.0 could leave. 1.1.0's check stopped above the window's lowest height.
  At each such height, it makes qbitd's block the only canonical row, and
  has the hashrate indexers index the daily and weekly periods they
  skipped. They logged
  `Hashrate window is not consecutive at heights <h> and <h>` and skipped
  the periods around such a height, and block lists showed either row. The
  period that begins right after it wasn't skipped: its block window starts
  at that height and took either row, so the check deletes its hashrates
  to have them computed again. The window's lowest height gets qbitd's
  block as its only canonical row, indexed first if no row is it. Below
  that height, a height where none of the rows is qbitd's block is left as
  it is, with one warning. If it holds two canonical rows, the hashrate
  periods around it stay skipped, and the one after it keeps hashrates
  computed with either row. Hashrates computed with a lone row from
  another chain that the check replaces are computed again.
- With CPFP indexing on, a repair at the window's lowest height deletes the
  CPFP clusters from there to the tip, as the chain check's repairs above
  it do, and the CPFP indexer rebuilds them, which can take a long time on
  a large window. Below that height, which the CPFP indexer doesn't cover,
  CPFP clusters stay as they are.
- A new block's coinbase that qbit-electrs hasn't indexed yet no longer
  logs an error. The backend fetches it as the block arrives, and logged
  `Cannot fetch tx <txid>. Reason: Request failed with status code 404`
  before it got the coinbase from qbitd. On testnet4 that was about one
  block in three. A first fetch that finds no such transaction now logs at
  debug level. Any other first failure, such as a refused connection, a
  timeout or a 5xx, still logs an error, even when qbitd then returns the
  transaction.

### Changed

- `docker/docker-compose.yml` takes qbitd's RPC login from
  `CORE_RPC_USERNAME` and `CORE_RPC_PASSWORD` in `docker/.env`, instead of
  setting `mempool` and `mempool`, so a copied compose file no longer
  carries a known password. `docker/.env.example` lists both. The compose
  file has no default for them: until both are set, every `docker compose`
  command in `docker/` stops, `down`, `ps` and `logs` included. This breaks
  existing Compose setups until `docker/.env` has the login (see
  Upgrading). The backend image's `start.sh` still defaults both to
  `mempool` for a container started without them.
- `POST /api/tx`, `/api/tx/push`, `/api/txs/test` and `/api/v1/txs/package`
  answer 503 `qbitd is unavailable, try again later` when qbitd can't take
  the call: it can't be reached or doesn't answer in time, is warming up
  (-28) or not ready (-10), turns the backend away with 401 or 403, or has
  a full work queue. They answered 400, which a wallet can take for a
  refused transaction. qbitd's refusals still get 400 with its code. A
  malformed body gets 400 with the reason, such as `Non-hex request body`,
  instead of an RPC error with a code the explorer made up.
- With `MEMPOOL.BACKEND` `electrum` and qbitd's txindex disabled or still
  building, `GET /api/address/:address/txs` and
  `GET /api/scripthash/:scripthash/txs` answer 503 and name qbitd's
  txindex, as the transaction routes have since 1.1.0. They answered 500.
  Both routes look up an `after_txid` outside the history, and the page's
  own transactions, in qbitd, so even a first page with a confirmed
  transaction answered 500. Their other answers keep their status.
- Node.js 26.12.1 to 26.13.1, the 26.x security release of 2026-11-10, in
  the backend image, the frontend image's build stage, `.nvmrc` and CI. The
  backend serves plain HTTP, so the release's high-severity `http2` and TLS
  fixes don't reach it, but its llhttp update and `https.Agent` fix do.
- The frontend image's `nginx:1.30.6-alpine` base is pinned to the digest
  Docker Hub rebuilt on Alpine 3.24.4, for its curl, expat and brotli
  security fixes. nginx stays 1.30.6.
- Backend dependencies: `bitcoinjs-lib` 6.1.8 to 6.1.10, for three high
  advisories in its PSBT fee calculation and `Block.checkProofOfWork()`,
  which the explorer doesn't use, and the test tools' `@babel/core` 7.28.5
  to 7.29.13, for a low one. Of the code 6.1.10 changes, the explorer calls
  only `Psbt.updateInput`, from `POST /api/v1/psbt/addparents`, which now
  also clears cached fee and transaction data the route doesn't read.
  Frontend dependencies: `domino` 2.1.6 to 2.1.9, which only the SSR server
  uses, for CVE-2026-101895 and 2.1.9's serialization XSS fixes.

### Documentation

- docker/README.md shows how to make qbitd's RPC login with qbit's
  `share/rpcauth/rpcauth.py` and put it in `docker/.env`, or to use qbitd's
  RPC cookie instead, and which characters to keep out of the password.
- docs/qbit-local-dev.md describes the regtest smoke script's new last
  check, which mines a block, runs `invalidateblock` on it and expects the
  backend's tip to follow. It runs only with the regtest harness's
  `smoke.env` and a node on `regtest`.
- .github/rulesets/README.md says how to rename a required check, as a Node
  update does to five of them, so that pull requests can still merge.

### Upgrading

- Docker Compose: set `CORE_RPC_USERNAME` and `CORE_RPC_PASSWORD` in
  `docker/.env` before you run any `docker compose` command in `docker/`.
  If your qbitd still accepts the old sample's login, this line, run from
  the repository root, puts it there:

  ```bash
  printf '\nCORE_RPC_USERNAME=mempool\nCORE_RPC_PASSWORD=mempool\n' >> docker/.env
  ```

  That keeps a known password, so replace it next: give qbitd an `rpcauth`
  line in place of the old login, restart qbitd, and put the new login in
  `docker/.env`, as docker/README.md shows.
- No database migration and no config change: the schema stays at
  version 113. With indexing on, the first chain check may repair rows
  below the indexing window, as described under Fixed.
- With a full-history index (`MEMPOOL.INDEXING_BLOCKS_AMOUNT` at `-1`, as
  in the `production/` templates), duplicate canonical rows are inside the
  walk instead, which has repaired them since 1.1.0. With CPFP indexing on,
  as there too, its first repair deletes the CPFP clusters from the lowest
  repaired height to the tip, and the CPFP indexer rebuilds them, which can
  take hours on a long chain. A database that ran 1.1.0 with `-1` has had
  that repair already.
- Rebuild both images: the backend image and the frontend image's build
  stage use Node.js 26.13.1, and the frontend image serves from the new
  nginx digest. If you run the backend outside Docker, update Node.js to
  26.13.1 too.

### Known limits

- After a reorg deeper than the indexing window, which in practice only a
  regtest chain sees, the chain check doesn't look again at the heights
  below the window that it repaired or left alone.
- With CPFP indexing on, a block that arrives after a repair at the
  window's lowest height, before the CPFP indexer's next run, moves the
  window past that height, which then keeps no CPFP clusters: its
  transactions show no CPFP data rather than wrong data. A reorg that
  reaches the window's lowest height does the same.
- Block lists, in regtest or operator cases: nine or more blocks within a
  minute of a deep reorg end the protection against cached answers from
  before it early. After two deep rollbacks in a row, a lagging origin's
  answer from before the first can show blocks above the tip until a
  reload, or until the chain passes them.
- Block lists ask past caches more than they need. After a deep reorg,
  while the API's answers don't fit the WebSocket's chain, as from a
  backend left on the old chain, each new block can make an open list send
  up to three such requests, about three a minute. While the API fails,
  each retry, every 10 seconds, is one too. Answers to `?fresh=` requests
  carry the same 60-second `Expires` as others, so caches keep copies that
  nothing asks for again.
- A stale first answer, such as a browser's copy from before a reorg the
  tab didn't see, can leave the page count too high until the next reorg.
  Only the count is off.

## 1.1.0

### Added

- `GET /api/address/:address/txs/chain`, with an optional `/:last_seen_txid`,
  and `GET /api/address/:address/txs/mempool`, which the API docs listed but
  the backend didn't serve. They pass through to qbit-electrs, so they need
  `MEMPOOL.BACKEND` `esplora`. The other backends answer 405.
- `GET /api/block/:hash/status`, `GET /api/tx/:txid/raw`,
  `GET /api/tx/:txid/outspend/:vout` and
  `GET /api/tx/:txid/merkleblock-proof`, the other routes the API docs listed
  but the backend didn't serve. Block status and the merkleblock proof need
  `MEMPOOL.BACKEND` `esplora`, and the other backends answer 405. The raw
  transaction and the outspend work with every backend.
- `MEMPOOL.HTTP_HOST`, and the Docker image's `MEMPOOL_HTTP_HOST`: the IP
  address the backend's HTTP port listens on. It defaults to `""`, every
  interface, as before, and the `production/` templates set it to
  `127.0.0.1`. A host name such as `localhost` stops the backend at startup.
- The WebSocket `blocks` message sent after a reorg carries `"reorg": true`,
  so pages can follow a reorg to a shorter chain.
- An optional `github_token` build secret for the frontend Docker image. The
  build lists the mining pool logos through the GitHub API, and a token keeps
  it under GitHub's rate limit.
- CI tests a fee bump (RBF) in the browser, checks the translations for
  stale English text, and runs the Rust block-template builder's tests and a
  RustSec audit of its crates.

### Fixed

- The Block Fees, Block Fees Vs Subsidy and Block Rewards graphs draw their
  QBT data. They were empty because their queries needed a USD price for
  each block, which qbit doesn't have.
  `GET /api/v1/mining/blocks/fees/:interval` and
  `GET /api/v1/mining/blocks/rewards/:interval` now return rows, without
  `USD`.
- Search suggests addresses when qbit-electrs runs with `--address-search`.
  In esplora mode, `GET /api/address-prefix/:prefix` used to answer 500 for
  every prefix. It now answers `[]` when qbit-electrs has address search off,
  or when the text can't begin an address.
- A mining graph opened at a range whose button is hidden opens at ALL.
  Examples are pools dominance's default 6M and the dashboard's link to the
  hashrate chart at 1Y. Such a graph used to load that range with no button
  highlighted. The visitor's saved range is kept.
- After an upgrade, transactions restored from the mempool cache are
  classified by the new release's rules. They used to keep the older
  release's flags, so after the v1.0.1 upgrade some qscriptions weren't
  highlighted in the block preview.
- Error messages over HTTP/2 show the status code alone, such as `400`,
  instead of `400 OK`.
- Enterprise mode (`customize.enterprise`) applies from the first page a
  visitor opens. It used to wait until a transaction, tracker or preview page
  loaded. A `branding` without a `title` keeps the default page title.
- With `ESPLORA.FALLBACK` hosts, a healthy qbit-electrs host is no longer
  failed over because it refused bad requests, such as invalid addresses.
  Only the host's own errors, timeouts and errors from a proxy in front of it
  count, and they count against the host that failed.
- With `MEMPOOL.BACKEND` `electrum`, address and scripthash histories page
  after an `after_txid` as they do in esplora mode. An `after_txid` missing
  from the history used to return the first page again, and the next page
  repeated the newest transaction. One that qbitd doesn't have gets 422, and
  a malformed one gets 400 on the scripthash route too.
- The backend catches reorgs with indexing off, and a block replaced at the
  same height reaches pages within one poll, instead of when the next block
  arrives. With indexing off, a reorg used to leave the replaced block cached
  below the new ones.
- At startup, cached blocks that qbitd doesn't have, as in a disk or Redis
  cache from before a chain wipe, are dropped and synced again from qbitd.
  The tip height and the block list used to show the old chain until qbitd
  passed it. Blocks above qbitd's tip stay cached while qbitd catches up on
  the same chain, or is still syncing.
- With indexing on, chain validation makes qbitd's block the only canonical
  one at each height it checks, and indexes hashrates and CPFP clusters again
  from the first block it repairs. A chain wipe used to leave the old chain's
  blocks canonical below the cached ones, in block lists and mining stats.
- On a chain of up to 8 blocks, such as a fresh regtest chain, the backend
  caches every block, not only genesis and the tip.
- After a reorg to a shorter chain, such as a chain wipe, pages lower their
  tip and show new blocks as they arrive. They used to ignore new blocks
  until the chain passed the old tip, so the mempool blocks stood still and a
  transaction confirmed in one of them still showed as unconfirmed.
- A failed block or mempool update, such as during a qbitd or qbit-electrs
  outage, no longer logs a false `stalled` error two minutes later.
- `/tx/preview` shows a transaction's weight and vsize as qbit counts them.
  It overstated both by three times the size without witnesses, and judged
  standardness by them.
- `POST /api/v1/tx`, `/api/v1/tx/push` and `/api/v1/txs/test` accept standard
  transactions with more than about 100 KB of non-witness data. Their size
  check used Bitcoin's weight.
- With `MEMPOOL.ALLOW_UNREACHABLE` `false`, pushed P2MR spends whose leaf
  script holds `OP_FALSE OP_IF` are refused, as that setting intends. The
  check let every P2MR spend through.
- Opcodes `0xbb` to `0xbd` show as `OP_CHECKTEMPLATEVERIFY`,
  `OP_CHECKDATASIGPQC` and `OP_CHECKDATASIGADDPQC`, as qbitd names them,
  where the explorer writes its own ASM: on `/tx/preview`, with
  `MEMPOOL.BACKEND` `none`, and for mempool transactions restored from the
  cache. They showed as `OP_RETURN_187` to `OP_RETURN_189`.
- With `MEMPOOL.BACKEND` `none` or `electrum`, `OP_RETURN` and other
  unspendable outputs show as unspent, as qbit-electrs has them. They showed
  as spent.
- `npm run build:ssr` builds the server-side rendering (SSR) server again, on
  Angular 20 and Express 5, and the server renders pages. It renders for the
  host names in `NG_ALLOWED_HOSTS`, by default `localhost`, `127.0.0.1` and
  the `PROD_DOMAINS` with their subdomains. Any other `Host`, or one that
  isn't a host name or IP address with an optional port, gets 400. A page
  that takes longer than `SSR_RENDER_TIMEOUT_MS`, 5 seconds by default, is
  sent for the browser to render. CI builds the server and renders a page.

### Changed

- The non-standard flag follows more of qbit's relay policy. Dust thresholds
  use qbit's spend sizes and round up, so a P2MR output is dust below 2,855
  bits instead of 82. TRUC transactions over 50,000 vB, outputs to witness
  versions 3 to 16, and P2MR spends with an annex or beyond qbit's witness
  limits are flagged. Taproot script-path spends no longer skip the remaining
  checks. Sigops are counted over decoded scripts, as qbitd counts them,
  instead of over ASM text.
- `/tx/preview` also checks the rules qbitd applies when a transaction enters
  its mempool: outputs only to P2MR, `OP_RETURN` or the anchor, except on
  regtest; TRUC's version inheritance, its one unconfirmed ancestor and its
  45,500 vB limit for a child; and spending all of an unconfirmed parent's
  dust. It loads the unconfirmed parents to do this, and says so when it
  can't. Elsewhere the flag still judges each transaction on its own.
- P2MR inputs with an annex get the annex flag, as Taproot inputs do.
- Transactions no longer show the struck-through Taproot badge or its hint
  to save fees with Taproot, which don't fit qbit's P2MR addresses.
- Reward stats on the mining dashboard cover the last 1,440 blocks, a day of
  qbit blocks, instead of 144. Translated pages show those labels in English
  until their translations catch up.
- `MEMPOOL.RUST_GBT` defaults to `true`, as it does upstream, so projected
  blocks come from the faster Rust block-template builder. The builder now
  uses qbit's weights. It used to overstate fee rates fourfold. The Docker
  image and the `production/` templates still set it to `false`.
- `MEMPOOL.INDEXING_BLOCKS_AMOUNT` defaults to 110,000 blocks, about 76 days
  of 60-second blocks, up from 11,000, in the Docker image too.
- Malformed txids, block hashes and scripthashes get 400 instead of 501, on
  every route, including `GET /api/block/:hash/txid/:index`.
  `GET /api/v1/transaction-times` without `txId[]` and
  `GET /api/v1/txs/outspends` without `txids` get 400 instead of 500.
- An unknown transaction or block gets 404 instead of 500 from eight more
  routes, such as `GET /api/tx/:txid/outspends` and
  `GET /api/block-height/:height`. A malformed height gets 400. With
  `MEMPOOL.BACKEND` `none`, `GET /api/tx/:txid/merkle-proof` answers 405.
- With `MEMPOOL.BACKEND` `none` or `electrum`, the transaction routes answer
  503 and name qbitd's txindex when it's disabled or still building. They
  answered 404, as for a transaction that doesn't exist.
- A relative `MEMPOOL_CONFIG_FILE` is resolved against the backend's working
  directory, not `backend/dist/`. A file found only at the old location is
  still read, with a deprecation warning.
- With `CORE_RPC.COOKIE` true, the backend authenticates only with qbitd's
  RPC cookie, even when `COOKIE_PATH` is empty. It no longer falls back to
  `USERNAME` and `PASSWORD`. It logs an error at startup when it can't read
  the cookie. When qbitd restarts with a new cookie and turns a call away,
  the backend retries that call once with the new cookie.
  `SECOND_CORE_RPC` works the same way.
- The `production/` templates read qbitd's RPC cookie at
  `/var/lib/qbit/.cookie` instead of taking an RPC user name and password.
- In the Docker image, nginx looks the backend's host name up when a request
  comes in, through DNS only, so recreating the `api` container no longer
  needs a `web` restart. A name that only `/etc/hosts` knows, or a Kubernetes
  short name, needs an IP address or a full name instead.
- `nginx-mempool.conf` keeps the backend's address in `$mempool_backend`, and
  passes `/api/v1` paths to the backend as the client sent them.
- A static file that doesn't exist, such as a script name from another
  build, answers a 404 that isn't cached, instead of the app page, so a CDN
  or browser never stores HTML under a script's name. Files that exist and
  app routes are unchanged.
- Building the Docker images needs BuildKit, Docker's default builder since
  Docker 23. The Dockerfiles pin their base images by digest, and the
  backend image checks NodeSource's setup script against a SHA-256 before
  running it.
- `rust/gbt/rust-toolchain` is in TOML form, which Dependabot can read. The
  backend's install stops when the file names no toolchain channel.
- The site header links to qbit.org's new Mine page.
- The frontend lists `express` 5 and `http-proxy-middleware` 2, which the
  SSR server needs, as runtime dependencies.
- Backend dependencies: `bitcoinjs-lib` 6.1.3 to 6.1.8 and `bip174` 2.1.0 to
  2.1.1, for a critical advisory in code the explorer doesn't call, and the
  test and lint tools' `handlebars`, `brace-expansion`, `browserslist` and
  `js-yaml`, for theirs.
- Rust block-template builder dependencies: `bytes` 1.9.0 to 1.12.1, `tokio`
  1.43.0 to 1.53.3, and `tracing-subscriber` 0.3.19 to 0.3.20, for four
  RustSec advisories.

### Removed

- The unused Lightning backend: its `/api/v1/lightning/` routes, the
  `LIGHTNING`, `LND`, `CLIGHTNING` and `MAXMIND` settings and their Docker
  variables, and its seven database tables, which the backend drops at
  startup (schema version 113). A config file that still has those settings
  loads, with a startup warning. `/api/v1/backend-info` keeps `lightning`,
  now always `false`. The Docker image no longer bundles MaxMind's GeoLite2
  databases.

### Documentation

- The API docs' examples use live qbit mainnet and testnet4 blocks,
  transactions and mining pools, with their real responses where the
  explorer has them. The WebSocket address-tracking examples subscribe to
  qbit addresses.
- The WebSocket `track-address`, `track-addresses` and `track-mempool`
  examples answer with messages captured on qbit mainnet, and on testnet4
  with a testnet4 payment. The block status and merkleblock proof examples
  use qbit blocks, and the docs say that the proof carries no AuxPoW data.
- production/README.md and docker/README.md show how to authenticate the
  backend and qbit-electrs with qbitd's RPC cookie, and how to get address
  suggestions from qbit-electrs. docker/README.md also says how nginx looks
  up the backend's host name, and which names need an IP address.
- frontend/README.md shows how to build and run the SSR server, and how to
  set its allowed hosts and render timeout.
- CONTRIBUTING.md says how a pull request lands: a maintainer squashes it
  into one signed commit and merges it with a merge commit. The branch
  rulesets are in `.github/rulesets/`. It also says how to fix a translation
  that CI reports as stale.

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
