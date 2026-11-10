# Bare-Metal Production Deployment

These notes cover running qbit-explorer directly on a server instead of in the
containers built from [`docker/`](../docker/). Each instance runs this stack:

```
qbitd  ->  qbit-electrs  ->  backend (Node.js + MariaDB)  ->  nginx + frontend
```

Run one explorer instance per qbit network, each on its own host. The node's
systemd unit runs a single qbitd and the reference nginx configuration serves
a single network. The frontend links to the other network's explorer through
`MAINNET_EXPLORER_URL` and `TESTNET4_EXPLORER_URL`.

The examples use Debian/Ubuntu paths. Adjust them for other systems.

## Contents

| File | Purpose |
| --- | --- |
| `mempool-config.mainnet.json` | Backend config template for qbit mainnet |
| `mempool-config.testnet4.json` | Backend config template for qbit testnet4 |
| `mempool-config.regtest.json` | Backend config template for a private regtest chain |

The templates point the backend at a local qbitd and qbit-electrs. On every
network they index all blocks, block summaries, goggles and CPFP data. They
leave Redis off, so the backend uses its default disk cache: it saves the
mempool under `MEMPOOL.CACHE_DIR` (`./cache` in `backend/`) and reloads it
after a restart. They also leave `MEMPOOL.RUST_GBT` off, so the backend builds
projected blocks with its TypeScript implementation. Set it to `true`, the
backend's default, to use the faster Rust builder in [`rust/gbt`](../rust/gbt).
Values written as
`__PLACEHOLDER__` must be replaced with your own credentials. Keep
`MEMPOOL.OFFICIAL` set to `false`. That flag marks upstream's mempool.space
instances and adds internal qbitd RPC routes under `/api/v1/internal/`, which
the reference nginx configuration would expose.

## Ports

| Network | qbitd P2P | qbitd RPC | qbit-electrs `--network` | qbit-electrs REST | Database |
| --- | ---: | ---: | --- | ---: | --- |
| mainnet | 8355 | 8352 | `qbit` | 3000 | `mempool` |
| testnet4 | 48355 | 48352 | `qbittestnet4` | 3004 | `mempool_testnet4` |
| regtest | 18460 | 18452 | `qbitregtest` | 3002 | `mempool_regtest` |

The REST ports are qbit-electrs defaults. On every network the backend listens
on `127.0.0.1` port 8999, where the reference nginx configuration sends API
requests: the templates set `MEMPOOL.HTTP_HOST` to `127.0.0.1`. That setting
takes an IP address, such as `127.0.0.1` or `::1`, not a host name, and applies
to that TCP port only. `MEMPOOL.UNIX_SOCKET_PATH`, if set, opens a separate
listener on that socket, next to the TCP port. Without `HTTP_HOST`, or with
`""`, the backend listens on port 8999 on every interface, so block the port in
the host firewall and let only nginx reach it. Keep RPC, REST and MariaDB on
localhost too. Only nginx and, if you want to serve peers, the qbitd P2P port
should accept outside connections.

## Requirements

- Fast SSD or NVMe storage with room for an archive qbitd with `txindex` and
  the qbit-electrs index next to it
- git, a C/C++ toolchain, `clang` and `cmake`
- Node.js v26.12.1 (see [`.nvmrc`](../.nvmrc)) and npm
- Rust through rustup. Installing the backend dependencies compiles
  [`rust/gbt`](../rust/gbt) with the toolchain pinned in
  `rust/gbt/rust-toolchain`.
- MariaDB 10.5 or later
- nginx

## qbit node

Install `qbitd` and `qbit-cli` from [Qbit-Org/qbit](https://github.com/Qbit-Org/qbit)
and follow its [node guide](https://github.com/Qbit-Org/qbit/blob/main/doc/user/run-node.md).
The node's systemd unit, `contrib/init/qbitd.service`, reads
`/etc/qbit/qbit.conf` and keeps its data in `/var/lib/qbit`. It runs as a `qbit`
user and group. Create them if they don't exist yet (see qbit's
[init guide](https://github.com/Qbit-Org/qbit/blob/main/doc/deployment/init.md)):

```sh
sudo useradd --system --user-group --home-dir /var/lib/qbit --shell /usr/sbin/nologin qbit
```

The explorer needs an archive node, so leave block and witness pruning disabled,
which is the default. Add the following to `qbit.conf`:

```ini
server=1
txindex=1
rpccookiefile=/var/lib/qbit/.cookie
rpccookieperms=group

# on a testnet4 or regtest host, select the chain:
#chain=testnet4
#chain=regtest
```

Leave `rpcpassword` unset, so that qbitd writes an RPC cookie. The backend and
qbit-electrs both authenticate with it, so no RPC password is stored anywhere.
The two `rpccookie` settings put that cookie at a fixed path, whichever chain
the host runs, and let the `qbit` group read it. By default it would sit in the
chain's subdirectory, such as `testnet4/`, which qbitd creates owner-only. RPC
binds to localhost by default and uses the qbit port for the selected chain.

Run `qbit-cli` with `-conf=/etc/qbit/qbit.conf`, as root or as a member of the
`qbit` group, so that it uses the same chain and cookie. Group members also
need to read `qbit.conf`, so give it to the `qbit` user and group, as qbit's init
guide suggests. The settings above hold no password:

```sh
sudo chown qbit:qbit /etc/qbit/qbit.conf
sudo chmod 640 /etc/qbit/qbit.conf
```

## qbit-electrs

Build [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs) and run
one indexer for each network next to its qbitd:

```sh
git clone https://github.com/Qbit-Org/qbit-electrs
cd qbit-electrs
cargo build --release --bin electrs
sudo install -m 0755 target/release/electrs /usr/local/bin/qbit-electrs
sudo useradd --system --user-group --groups qbit --home-dir /var/lib/qbit-electrs \
  --shell /usr/sbin/nologin qbit-electrs
sudo install -d -o qbit-electrs -m 0700 /var/lib/qbit-electrs
sudo -u qbit-electrs /usr/local/bin/qbit-electrs -vv \
  --network qbit \
  --daemon-dir /var/lib/qbit \
  --daemon-rpc-addr 127.0.0.1:8352 \
  --db-dir /var/lib/qbit-electrs \
  --jsonrpc-import
```

qbit-electrs runs as its own user in the `qbit` group. That user can read the
node's RPC cookie, which gives full RPC access, but cannot write to the node's
data directory. Without `--cookie`,
qbit-electrs reads `.cookie` from the daemon directory, which here gives
`/var/lib/qbit/.cookie`. Don't pass `--cookie 'user:password'` instead: other
local users can read command-line arguments through `ps`. In production, run the
last command under your service manager, ordered after qbitd and restarted on
failure: qbitd writes a new cookie each time it starts and deletes it when it
stops.

For testnet4, use `--network qbittestnet4` and
`--daemon-rpc-addr 127.0.0.1:48352`. For regtest, use `--network qbitregtest`
and `--daemon-rpc-addr 127.0.0.1:18452`. Keep `--jsonrpc-import` on every
chain: qbitd creates its block files owner-only, so the `qbit-electrs` user
must fetch blocks over RPC instead of reading them. qbit-electrs then uses the
daemon directory only to find the cookie, so keep `--daemon-dir /var/lib/qbit`
on every chain too. Without `--http-addr`, the REST API listens on the port from
the table above, which is where the templates expect it.

For address suggestions in search, add `--address-search`, and rebuild an
existing index from an empty `--db-dir`, since qbit-electrs only indexes
addresses for search as it indexes blocks.

## MariaDB

Create a database and user for the instance. The backend connects over TCP to
`127.0.0.1`, so create the account for that host:

```sql
CREATE DATABASE mempool;
CREATE USER 'mempool'@'127.0.0.1' IDENTIFIED BY '<database password>';
GRANT ALL PRIVILEGES ON mempool.* TO 'mempool'@'127.0.0.1';
```

Use `mempool_testnet4` or `mempool_regtest` for the other templates.

## Backend

```sh
git clone https://github.com/Qbit-Org/qbit-explorer
cd qbit-explorer/backend
npm ci --omit=dev --omit=optional
npm run build
cp ../production/mempool-config.mainnet.json mempool-config.json
chmod 600 mempool-config.json
```

In `mempool-config.json`, replace the `__MEMPOOL_*_USER__` and
`__MEMPOOL_*_PASS__` placeholders with the MariaDB user and password. The file
holds that password, so keep it readable only by the user that runs the
backend. Clone, build and start the backend as that same user, because it
writes into its own checkout while it runs: its disk cache to `backend/cache`, a
PID file to `backend/dist` unless `DATABASE.PID_DIR` is set, and any
`MEMPOOL.EXTERNAL_ASSETS` downloads to `backend/`. The backend reads
`backend/mempool-config.json`, or the file named by `MEMPOOL_CONFIG_FILE` when
that variable is set. A relative `MEMPOOL_CONFIG_FILE` is resolved against the
directory the backend starts in, which is `backend/` for the npm scripts below.
Earlier versions resolved it against `backend/dist/`. If no file exists at the
new location but one does there, the backend reads that one and logs a
deprecation warning.

The backend authenticates to qbitd with the RPC cookie at
`/var/lib/qbit/.cookie` (`CORE_RPC.COOKIE` and `CORE_RPC.COOKIE_PATH`), so add
its user to the `qbit` group, as for qbit-electrs, and log in again for that to
take effect:

```sh
sudo usermod -aG qbit <backend user>
```

qbitd writes a new cookie each time it starts. When qbitd turns a call away
because it carries the old cookie, the backend reads the file again and sends
the call once more with the new one, so a qbitd restart needs no backend
restart.

With `CORE_RPC.COOKIE` true, the backend never falls back to
`CORE_RPC.USERNAME` and `CORE_RPC.PASSWORD`. If it can't read the cookie, it
logs an error at startup that names the path and the fix, and RPC calls fail
until it can.

**Upgrading from the earlier templates:** they authenticated with an `rpcauth`
user name and password, filled in through the `__QBIT_RPC_USER__` and
`__QBIT_RPC_PASS__` placeholders. The templates no longer have those
placeholders, so tooling that fills them in now does nothing. Either add the
backend's user to the `qbit` group as above, or keep the password: set
`CORE_RPC.COOKIE` to `false`, set `CORE_RPC.USERNAME` and `CORE_RPC.PASSWORD`,
and keep the `rpcauth` line in `qbit.conf`. qbit's
[`share/rpcauth/rpcauth.py`](https://github.com/Qbit-Org/qbit/blob/v1.0.0/share/rpcauth/rpcauth.py)
generates that line.

Start the backend with:

```sh
npm run start-production
```

`start-production` allows Node.js a 16 GB heap. Use `npm run start` (2 GB) on
smaller hosts. Run either command under your service manager so the backend
restarts after a failure or a reboot. See
[`backend/src/config.ts`](../backend/src/config.ts) for every setting and its
default.

## Frontend

```sh
cd ../frontend
cp mempool-frontend-config.sample.json mempool-frontend-config.json
npm ci --omit=dev --omit=optional
npm run build
sudo mkdir -p /var/www/mempool/browser
sudo rsync -av --delete dist/mempool/browser/ /var/www/mempool/browser/
```

The sample config builds a mainnet instance. For a testnet4 instance, set
`MAINNET_ENABLED` to `false`, `TESTNET4_ENABLED` to `true` and `ROOT_NETWORK`
to `"testnet4"`. For a regtest instance, set `MAINNET_ENABLED` to `false`,
`REGTEST_ENABLED` to `true` and `ROOT_NETWORK` to `"regtest"`. Point
`MAINNET_EXPLORER_URL` and `TESTNET4_EXPLORER_URL` at the explorers you want
the network selector to link to, or set them to `""` to hide those links.

## nginx

The top-level [`nginx.conf`](../nginx.conf) and
[`nginx-mempool.conf`](../nginx-mempool.conf) are the reference configuration
that the Docker frontend image is built from:

```sh
sudo cp ../nginx.conf /etc/nginx/nginx.conf
sudo cp ../nginx-mempool.conf /etc/nginx/nginx-mempool.conf
```

`nginx.conf` listens on `127.0.0.1:80` and runs as `nobody`. Change the
`listen` directive, add TLS for your domain (for example with
`certbot --nginx`) and set `user` if your system runs nginx under another
account.

`nginx-mempool.conf` needs no changes. It proxies the API and WebSocket to the
backend on `127.0.0.1:8999`, the port every template uses. Its `/qbit-design/`
location fetches the qbit.org design contract (banner, navigation and design
tokens) over HTTPS. If the host cannot reach qbit.org, the frontend keeps the
copy bundled at build time. With `QBIT_SITE_CHROME` set to `false` (see below),
the frontend doesn't use this location, and you can remove it.

The backend address is in `$mempool_backend`, near the top of
`nginx-mempool.conf`. The `resolver 127.0.0.11` line next to it is for the
Docker image, where the address is a container name that nginx looks up
through Docker's DNS server, `127.0.0.11`. nginx doesn't look up an IP address,
so the line has no effect here; keep an IP address in `$mempool_backend`. If
your `server` block has a `resolver` directive of its own, delete the one in
`nginx-mempool.conf`, because nginx refuses two in one block.

Run `sudo nginx -t` before reloading nginx.

## Frontend customization

By default every instance shows qbit.org's header, banner and footer, and the
banner and navigation follow what qbit.org publishes. To remove them, set
`QBIT_SITE_CHROME` to `false` in `mempool-frontend-config.json`. The explorer's
own section bar and sub-footer stay, and the frontend doesn't contact qbit.org.

The frontend can also load a customization file at build time. Set
`CUSTOMIZATION` in `mempool-frontend-config.json` to its path, relative to
`frontend/`, before `npm run build`. The file is JSON and supports these keys:

- `theme`: one of the bundled themes (`qbit`, `default`, `contrast` or
  `softsimon`), applied instead of the visitor's choice
- `dashboard.widgets`: a list of `{ "component", "mobileOrder", "props" }`
  entries that replaces the home dashboard. The components are `fees`,
  `difficulty`, `goggles`, `incoming`, `replacements`, `blocks`,
  `transactions`, and `balance`, `address` and `addressTransactions`, which take
  `props.address`.
- `enterprise` and `branding`: upstream's white-label mode. It applies when the
  frontend starts, whichever page a visitor opens first: it hides the network
  selector, sets the page title from `branding.title`, shows the logo on the
  preview and tracker pages, sets `ACCELERATOR`, `TESTNET_ENABLED`,
  `SIGNET_ENABLED`, `TESTNET4_ENABLED` and `REGTEST_ENABLED` to `false`, and
  clears `MAINNET_EXPLORER_URL` and `TESTNET4_EXPLORER_URL`. It does this even
  when one of those networks is the instance's own `ROOT_NETWORK`, so set
  `enterprise` only on a mainnet instance. With `enterprise` set to `<name>`,
  the build uses `src/index.mempool.<name>.html`, which you must add.
