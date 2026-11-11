# qbit Explorer Backend

These instructions are mostly intended for developers. 

If you choose to use these instructions for a production setup, be aware that you will still probably need to do additional configuration for your specific OS, environment, use-case, etc. We do our best here to provide a good starting point, but only proceed if you know what you're doing.

For a complete local qbit stack (qbitd regtest, optional qbit-electrs, MariaDB, backend, and frontend), see [`docs/qbit-local-dev.md`](../docs/qbit-local-dev.md).

Jump to a section in this doc:
- [Set Up the Backend](#setup)
- [Development Tips](#development-tips)

## Setup

### 1. Clone the Repository

Get the latest explorer code:

```
git clone https://github.com/Qbit-Org/qbit-explorer
cd qbit-explorer
```

`main` is the integration branch; build from it.

### 2. Configure qbitd

Turn on `txindex`, enable RPC, and set RPC credentials in `qbit.conf`:

```
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

qbitd serves RPC on port 8352 on mainnet, 48352 on testnet4, and 18452 on regtest.

### 3. Configure qbit-electrs

Run [Qbit-Org/qbit-electrs](https://github.com/Qbit-Org/qbit-electrs), the qbit-aware Electrum and Esplora REST indexer, configure it, and make sure it's synced.

**This step is optional.** You can run the backend without qbit-electrs, but address lookups will be disabled.

### 4. Configure MariaDB

_The backend needs MariaDB v10.5 or later. If you already have MySQL installed, make sure to migrate any existing databases **before** installing MariaDB._

Get MariaDB from your operating system's package manager:

```
# Debian, Ubuntu, etc.
apt-get install mariadb-server mariadb-client

# macOS
brew install mariadb
mysql.server start
```

Create a database and grant privileges:

```
MariaDB [(none)]> drop database mempool;
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> create database mempool;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
Query OK, 0 rows affected (0.00 sec)
```

### 5. Prepare the Backend

#### Build

_Use the Node.js version in the repository's `.nvmrc` and the npm that ships with it._

_The build process requires [Rust](https://www.rust-lang.org/tools/install) to be installed. `rust/gbt/rust-toolchain` pins the Rust version._

Install dependencies with `npm` and build the backend:

```
nvm use
cd backend
npm ci
npm run build
```

#### Configure

In the backend folder, make a copy of the sample config file:

```
cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` as needed. 

In particular, make sure:
- `NETWORK` in `MEMPOOL` matches the qbitd network, for example `mainnet`, `testnet4`, or `regtest`
- the correct qbitd RPC host, port, and credentials are specified in `CORE_RPC` (the sample uses mainnet port 8352): a user name and password, or `COOKIE` set to `true` and `COOKIE_PATH` to qbitd's RPC cookie file
- the correct `BACKEND` is specified in `MEMPOOL`:
  - "esplora" if you're using the qbit-electrs Esplora REST API (`ESPLORA.REST_API_URL`)
  - "electrum" if you're using the qbit-electrs Electrum RPC (`ELECTRUM.HOST`, `ELECTRUM.PORT`, `ELECTRUM.TLS_ENABLED`)
  - "none" if you're not using qbit-electrs

### 6. Run the Backend

Run the backend:

```
npm run start

```
You can also set env var `MEMPOOL_CONFIG_FILE` to specify a custom config file location:
```
MEMPOOL_CONFIG_FILE=/path/to/mempool-config.json npm run start
```
A relative path is resolved against `backend/`, the directory `npm run start` runs in. Earlier versions resolved it against `backend/dist/`: if no file exists at the new location but one does there, the backend reads that one and logs a deprecation warning.

When it's running, you should see it polling the mempool, with output like this:

```
Nov 12 13:35:02 [41552] DEBUG: Updating mempool...
Nov 12 13:35:02 [41552] DEBUG: Mempool updated in 0.012 seconds. New size: 3 (+1)
```

### 7. Set Up the Frontend
With the backend configured and running, proceed to set up the [frontend](../frontend#manual-setup).

## Development Tips

### Set Up Backend Watchers

The backend is static. TypeScript scripts are compiled into the `dist` folder and served through a Node.js web server.

As a result, for development purposes, you may find it helpful to set up backend watchers to avoid the manual shutdown/recompile/restart command-line cycle.

First, install `nodemon` and `ts-node`:

```
npm install -g ts-node nodemon
```

Then, run the watcher:

```
nodemon src/index.ts --ignore cache/
```

`nodemon` should be in npm's global binary folder. If needed, you can determine where that is with `npm -g bin`.

### Useful Regtest Commands

See [`docs/qbit-local-dev.md`](../docs/qbit-local-dev.md) for a full regtest setup, including the qbitd flags the backend expects.

Run qbitd on regtest:
   ```
   qbitd -regtest
   ```

Create a new wallet, if needed:
   ```
   qbit-cli -regtest createwallet test
   ```

Load wallet (this command may take a while if you have a lot of UTXOs):
   ```
   qbit-cli -regtest loadwallet test
   ```

Get a new address:
   ```
   address=$(qbit-cli -regtest getnewaddress)
   ```

Mine blocks to the previously generated address. qbit coinbase outputs mature after 1,000 blocks, so you need at least 1,001 blocks before you can spend:
   ```
   qbit-cli -regtest generatetoaddress 1001 $address
   ```

Send 0.1 QBT at 5 bits/vB to another address:
   ```
   qbit-cli -named -regtest sendtoaddress address=$(qbit-cli -regtest getnewaddress) amount=0.1 fee_rate=5
   ```

See more example of `sendtoaddress`:
   ```
   qbit-cli sendtoaddress # will print the help
   ```

Mini script to generate random network activity (random TX count with random tx fee-rate). It's slow so don't expect to use this to test mempool spam, except if you let it run for a long time, or maybe with multiple regtest nodes connected to each other.
   ```
   #!/bin/bash
   address=$(qbit-cli -regtest getnewaddress)
   qbit-cli -regtest generatetoaddress 1001 $address
   for i in {1..1000000}
   do
      for y in $(seq 1 "$(jot -r 1 1 1000)")
      do
         qbit-cli -regtest -named sendtoaddress address=$address amount=0.01 fee_rate=$(jot -r 1 1 100)
      done
      qbit-cli -regtest generatetoaddress 1 $address
      sleep 5
   done
   ```

Generate block at regular interval (every 10 seconds in this example):
   ```
   watch -n 10 "qbit-cli -regtest generatetoaddress 1 $address"
   ```

### Mining pools update

By default, mining pools will be not automatically updated regularly (`config.MEMPOOL.AUTOMATIC_POOLS_UPDATE` is set to `false`).

In the qbit fork, the default mining-pool source URLs are blank. Blank URLs make
the backend load the vendored `pools-qbit.json`, which holds the known qbit pool
definitions (see `docs/mining-pools.md`). Legacy `mempool/mining-pools` URLs from
upgraded configs are also treated as disabled so Bitcoin pool regexes are not
imported into qbit. The pool definition hash stored in the database is derived
from the vendored file content, so editing `pools-qbit.json` and restarting the
backend re-imports the definitions and re-indexes block pool assignments
automatically. Pool definitions dropped from the file are deleted from the
database on import and their blocks re-attributed. If the vendored pool set is
empty, all indexed blocks are assigned to `Unknown`, stale pool definition
hashes are replaced, old pool hashrates are cleared, and non-Unknown pool
definitions are removed.

To manually update your mining pools, you can use the `--update-pools` command line flag when you run the nodejs backend. For example `npm run start --update-pools`. This will trigger the mining pools update and automatically re-index appropriate blocks.

You can enable the automatic mining pools update by settings `config.MEMPOOL.AUTOMATIC_POOLS_UPDATE` to `true` in your `mempool-config.json`.

When a `coinbase tag` or `coinbase address` change is detected for a non-empty pool source, pool assignments for all relevant blocks (tagged to that pool or the `unknown` mining pool) are updated using the new criteria.

### Re-index tables

You can manually force the nodejs backend to drop its indexed block data so it is rebuilt from scratch. This is mostly useful for the mining dashboard.

Use the `--reindex-blocks` flag to truncate the `blocks` and `hashrates` tables at start. The same flag also deletes every row from `pools`, resets its `AUTO_INCREMENT`, and clears the stored pool definition hash (`pools_json_sha` in the `state` table). That forces a pool re-import at startup, before blocks are re-indexed: from `POOLS_JSON_URL` when a remote pool source is configured, otherwise from the vendored `pools-qbit.json` (see [Mining pools update](#mining-pools-update)). Note that a 5 seconds delay will be observed before truncating tables in order to give you a chance to cancel (CTRL+C) in case of misuse of the command.

Usage:
```
npm run start --reindex-blocks
```
Example output:
```
Nov 12 14:55:27 [63246] WARN: Truncating pools, blocks and hashrates tables for re-indexing (using '--reindex-blocks'). You can cancel this command within 5 seconds
```
