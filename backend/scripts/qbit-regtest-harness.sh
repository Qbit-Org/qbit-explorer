#!/usr/bin/env bash
#
# qbit regtest harness for the mempool backend.
#
#   qbit-regtest-harness.sh up     start and seed the stack, return once it has caught up
#   qbit-regtest-harness.sh down   stop every process that `up` started
#
# `up` starts qbitd on regtest with a fresh data directory, mines a mature
# chain, sends transactions to every address type the wallet offers, mines
# AuxPoW-lane blocks and leaves transactions in the mempool. It then starts
# qbit-electrs when QBIT_ELECTRS is set, and the built backend (backend/dist).
# Everything listens on 127.0.0.1 only. If any step fails, `up` prints the log
# tails and stops whatever it started. See "Regtest Harness" in
# docs/qbit-local-dev.md for the environment variables.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
CONFIG_TEMPLATE="$BACKEND_DIR/../production/mempool-config.regtest.json"
AUXPOW_HELPER="$SCRIPT_DIR/qbit-regtest-auxpow.py"

# Regtest ports from production/README.md; the qbit-electrs ports are its
# qbitregtest defaults.
RPC_PORT=18452
P2P_PORT=18460
ELECTRS_HTTP_PORT=3002
ELECTRUM_PORT=60401
ELECTRS_MONITORING_PORT=24224
BACKEND_PORT=8999

MATURE_HEIGHT=1100 # past qbit's 1,000-block coinbase maturity
# The witness program of a P2MR output with a single OP_TRUE leaf:
# TaggedHash("P2MRLeaf", leaf version 0xc0 || script length 1 || OP_TRUE 0x51)
P2MR_OP_TRUE_PROGRAM=5c4bb09e52c01be092fe020458a377ba81f004203e232a808f562e248827c7a0
WALLET=harness
MARKER=.qbit-regtest-harness
MEMPOOL_API_URL="http://127.0.0.1:$BACKEND_PORT/api/v1"
ESPLORA_URL="http://127.0.0.1:$ELECTRS_HTTP_PORT"

default_dir="${TMPDIR:-/tmp}"
# Per user, so another user can't prepare the directory in a shared /tmp.
HARNESS_DIR="${QBIT_REGTEST_DIR:-${default_dir%/}/qbit-regtest-$(id -u)}"
UP_OK=0
DEADLINE=0
WAIT_DETAIL=""

log() {
  printf '[qbit-regtest %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2
}

die() {
  log "error: $*"
  exit 1
}

pid_file() {
  printf '%s/run/%s.pid' "$HARNESS_DIR" "$1"
}

# True while PID is a live process; an exited child that has not been reaped
# yet (a zombie) counts as exited.
pid_alive() {
  local stat
  stat="$(ps -o stat= -p "$1" 2>/dev/null)" || return 1
  stat="${stat//[[:space:]]/}"
  [[ -n "$stat" && "$stat" != Z* ]]
}

component_alive() {
  local file
  file="$(pid_file "$1")"
  [[ -f "$file" ]] && pid_alive "$(cat "$file")"
}

# Print the recorded PID of a component while that process is alive and is
# ours: a child of this shell, even before it has exec'd its program, or a
# process whose command line holds this harness directory. A recycled PID is
# never signalled.
running_pid() {
  local file pid parent args
  file="$(pid_file "$1")"
  [[ -f "$file" ]] || return 1
  pid="$(cat "$file")"
  [[ "$pid" =~ ^[0-9]+$ ]] && pid_alive "$pid" || return 1
  parent="$(ps -o ppid= -p "$pid" 2>/dev/null)" || return 1
  if [[ "${parent//[[:space:]]/}" != "$$" ]]; then
    args="$(ps -ww -o args= -p "$pid" 2>/dev/null)" || return 1
    [[ "$args" == *"$HARNESS_DIR/"* ]] || return 1
  fi
  printf '%s\n' "$pid"
}

# start_component NAME COMMAND...: run COMMAND in the background, appending its
# output to logs/NAME.log, and record its PID before anything else happens.
start_component() {
  local name="$1"
  shift
  "$@" </dev/null >>"$HARNESS_DIR/logs/$name.log" 2>&1 &
  printf '%s\n' "$!" >"$(pid_file "$name")"
}

# unverified_pid NAME: print NAME's recorded PID when that process is alive but
# fails running_pid's ownership check, e.g. a child orphaned before its exec
# when `up` was killed. Such a PID may still be ours, so callers keep it rather
# than forget it. A pid file older than the last boot is stale (its PID may now
# belong to anything) and doesn't count; without /proc/stat every live PID does.
unverified_pid() {
  local file recorded btime
  file="$(pid_file "$1")"
  recorded="$(cat "$file" 2>/dev/null || true)"
  [[ "$recorded" =~ ^[0-9]+$ ]] && pid_alive "$recorded" || return 1
  btime="$(awk '/^btime / {print $2}' /proc/stat 2>/dev/null || true)"
  if [[ "$btime" =~ ^[0-9]+$ && "$(stat -c %Y "$file" 2>/dev/null || echo 0)" -lt "$btime" ]]; then
    return 1
  fi
  printf '%s\n' "$recorded"
}

stop_component() {
  local name="$1" grace="$2" pid deadline
  if pid="$(running_pid "$name")"; then
    log "stopping $name (pid $pid)"
    kill -TERM "$pid" 2>/dev/null || true
    deadline=$(($(date +%s) + grace))
    while running_pid "$name" >/dev/null; do
      if (($(date +%s) >= deadline)); then
        log "$name did not exit within ${grace}s of SIGTERM; sending SIGKILL"
        kill -KILL "$pid" 2>/dev/null || true
        sleep 1
        if running_pid "$name" >/dev/null; then
          log "error: could not stop $name (pid $pid)"
          return 1
        fi
        break
      fi
      sleep 1
    done
  else
    local recorded
    if recorded="$(unverified_pid "$name")"; then
      log "error: $name's recorded pid $recorded is running but doesn't look like this harness's; not stopping it. Delete $(pid_file "$name") if it isn't."
      return 1
    fi
  fi
  rm -f "$(pid_file "$name")"
}

stop_all() {
  local status=0
  stop_component backend 30 || status=1
  stop_component electrs 60 || status=1
  stop_component qbitd 120 || status=1
  return "$status"
}

print_log_tails() {
  local file
  for file in "$HARNESS_DIR"/logs/*.log; do
    [[ -f "$file" ]] || continue
    printf '\n===== last 60 lines of %s =====\n' "$file" >&2
    tail -n 60 "$file" >&2 || true
  done
}

# wait_for DESCRIPTION CHECK [COMPONENT...]: poll the CHECK function once a
# second until it succeeds, failing when the harness deadline passes or one of
# the named components exits. CHECK may set WAIT_DETAIL to say what it saw. A
# check only starts while time is left, so the last detail is a real one.
wait_for() {
  local what="$1" check="$2" component
  shift 2
  WAIT_DETAIL=""
  log "waiting for $what"
  while (($(date +%s) < DEADLINE)); do
    "$check" && return 0
    for component in "$@"; do
      component_alive "$component" ||
        die "$component exited while waiting for $what; see $HARNESS_DIR/logs/$component.log"
    done
    sleep 1
  done
  die "timed out waiting for $what${WAIT_DETAIL:+ (last seen: $WAIT_DETAIL)}"
}

# json EXPR: evaluate a JavaScript expression over the JSON document on stdin,
# bound to `d`, and print the result. Fails on invalid JSON or a null result.
json() {
  # shellcheck disable=SC2016 # JavaScript, not shell
  node -e '
let v;
try {
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  v = new Function("d", `return (${process.argv[1]});`)(d);
} catch (error) {
  console.error(`json: ${error.message}`);
  process.exit(1);
}
if (v === undefined || v === null) process.exit(1);
process.stdout.write(typeof v === "object" ? JSON.stringify(v) : String(v));
' "$1"
}

http_get() {
  curl -fsS --max-time 10 "$1" 2>/dev/null
}

# Every RPC gets the time left before the harness deadline as its timeout.
qcli() {
  local left=$((DEADLINE - $(date +%s)))
  ((left > 0)) || die "timed out after ${TIMEOUT}s (QBIT_REGTEST_TIMEOUT)"
  "$QBIT_CLI" -datadir="$HARNESS_DIR/qbitd" -rpcclienttimeout="$left" "$@"
}

wcli() {
  qcli -rpcwallet="$WALLET" "$@"
}

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

require_executable() {
  local name="$1" path="${2:-}"
  [[ -n "$path" ]] || die "set $name to the path of the binary"
  [[ -x "$path" && ! -d "$path" ]] || die "$name=$path is not an executable file"
}

# smoke.env records QBIT_CLI, and the backend starts from another directory.
absolute_path() {
  printf '%s/%s\n' "$(cd "$(dirname "$1")" && pwd -P)" "$(basename "$1")"
}

# A bare command name is looked up on PATH; anything else is used as given.
resolve_command() {
  if [[ -n "$1" && "$1" != */* ]] && command -v -- "$1" >/dev/null; then
    command -v -- "$1"
  else
    printf '%s\n' "$1"
  fi
}

read_settings() {
  QBITD="$(resolve_command "${QBITD:-}")"
  QBIT_CLI="$(resolve_command "${QBIT_CLI:-}")"
  require_executable QBITD "$QBITD"
  require_executable QBIT_CLI "$QBIT_CLI"
  QBITD="$(absolute_path "$QBITD")"
  QBIT_CLI="$(absolute_path "$QBIT_CLI")"
  ELECTRS=0
  BACKEND_MODE=none
  if [[ -n "${QBIT_ELECTRS:-}" ]]; then
    QBIT_ELECTRS="$(resolve_command "$QBIT_ELECTRS")"
    require_executable QBIT_ELECTRS "$QBIT_ELECTRS"
    QBIT_ELECTRS="$(absolute_path "$QBIT_ELECTRS")"
    ELECTRS=1
    BACKEND_MODE=esplora
  fi

  TIMEOUT="${QBIT_REGTEST_TIMEOUT:-600}"
  [[ "$TIMEOUT" =~ ^[1-9][0-9]*$ ]] || die "QBIT_REGTEST_TIMEOUT must be a positive number of seconds"
  P2MRONLY="${QBIT_REGTEST_P2MRONLY:-0}"
  [[ "$P2MRONLY" == 0 || "$P2MRONLY" == 1 ]] || die "QBIT_REGTEST_P2MRONLY must be 0 or 1"

  local tool
  for tool in curl node python3; do
    command -v "$tool" >/dev/null || die "$tool is required"
  done
  [[ -f "$BACKEND_DIR/dist/index.js" ]] || die "build the backend first: cd backend && npm run build"
  [[ -f "$CONFIG_TEMPLATE" ]] || die "missing backend config template $CONFIG_TEMPLATE"

  DATABASE=0
  if [[ -n "${QBIT_REGTEST_DB_HOST:-}" ]]; then
    DATABASE=1
    [[ -n "${QBIT_REGTEST_DB_USER:-}" && -n "${QBIT_REGTEST_DB_PASSWORD:-}" ]] ||
      die "QBIT_REGTEST_DB_HOST is set; also set QBIT_REGTEST_DB_USER and QBIT_REGTEST_DB_PASSWORD"
    # The database check and the backend config read these same values.
    export QBIT_REGTEST_DB_PORT="${QBIT_REGTEST_DB_PORT:-3306}"
    [[ "$QBIT_REGTEST_DB_PORT" =~ ^[0-9]+$ ]] || die "QBIT_REGTEST_DB_PORT must be a port number"
    [[ "${QBIT_REGTEST_DB_RESET:-0}" == 0 || "$QBIT_REGTEST_DB_RESET" == 1 ]] ||
      die "QBIT_REGTEST_DB_RESET must be 0 or 1"
    local template_db
    template_db="$(json 'd.DATABASE.DATABASE' <"$CONFIG_TEMPLATE")" || template_db=""
    # Dropping tables needs a database of the harness's own: the reset only
    # touches databases named qbit_regtest_*, so never the template's or any
    # other shared database.
    if [[ "${QBIT_REGTEST_DB_RESET:-0}" == 1 ]]; then
      [[ "${QBIT_REGTEST_DB_NAME:-}" == qbit_regtest_* ]] ||
        die "QBIT_REGTEST_DB_RESET=1 drops every table in the database; set QBIT_REGTEST_DB_NAME to a harness-only database whose name starts with qbit_regtest_"
    fi
    if [[ -z "${QBIT_REGTEST_DB_NAME:-}" ]]; then
      [[ -n "$template_db" ]] || die "set QBIT_REGTEST_DB_NAME; the template names no database"
      QBIT_REGTEST_DB_NAME="$template_db"
    fi
    export QBIT_REGTEST_DB_NAME
  elif [[ -n "${QBIT_REGTEST_DB_PORT:-}${QBIT_REGTEST_DB_NAME:-}${QBIT_REGTEST_DB_USER:-}${QBIT_REGTEST_DB_PASSWORD:-}" ||
    "${QBIT_REGTEST_DB_RESET:-0}" != 0 ]]; then
    die "set QBIT_REGTEST_DB_HOST to enable the database, or unset the other QBIT_REGTEST_DB_* variables"
  fi
}

resolve_harness_dir() {
  [[ ! -e "$HARNESS_DIR" || -d "$HARNESS_DIR" ]] || die "$HARNESS_DIR exists and is not a directory"
  if [[ ! -e "$HARNESS_DIR" ]]; then
    # Only the harness directory itself needs to be private.
    mkdir -p "$(dirname "$HARNESS_DIR")"
    mkdir -m 700 "$HARNESS_DIR"
  fi
  HARNESS_DIR="$(cd "$HARNESS_DIR" && pwd -P)"
  # qbitd reads its config from here, so nobody else may own or write to it.
  local perms
  perms="$(ls -ld "$HARNESS_DIR")"
  [[ -O "$HARNESS_DIR" ]] || die "$HARNESS_DIR is not owned by you; set QBIT_REGTEST_DIR to a directory of your own"
  # The backend also loads backend/loopback.cjs from here with --require.
  [[ "${perms:5:1}" != w && "${perms:8:1}" != w ]] ||
    die "$HARNESS_DIR is writable by its group or other users; run chmod go-w on it, or use a new directory"
  # The smoke script word-splits QBIT_CLI_ARGS, which holds the datadir.
  [[ "$HARNESS_DIR" != *[[:space:]]* ]] || die "QBIT_REGTEST_DIR must not contain whitespace: $HARNESS_DIR"
  # The smoke script expands QBIT_CLI_ARGS, which holds this path, unquoted.
  [[ "$HARNESS_DIR" != *[\*\?\[]* ]] || die "QBIT_REGTEST_DIR must not contain *, ? or [: $HARNESS_DIR"
  if [[ -n "$(ls -A "$HARNESS_DIR")" && ! -f "$HARNESS_DIR/$MARKER" ]]; then
    die "$HARNESS_DIR is not empty and was not created by this harness; set QBIT_REGTEST_DIR to a new directory"
  fi

  local component pid
  for component in backend electrs qbitd; do
    if pid="$(running_pid "$component")"; then
      die "$component (pid $pid) from a previous run is still running; run '$0 down' first"
    elif pid="$(unverified_pid "$component")"; then
      die "$component's recorded pid $pid is running but doesn't look like this harness's; stop it, or delete $(pid_file "$component") if it isn't ours"
    fi
  done
}

# Each run starts from a new genesis.
reset_harness_dir() {
  rm -rf "$HARNESS_DIR/qbitd" "$HARNESS_DIR/electrs-db" "$HARNESS_DIR/backend" \
    "$HARNESS_DIR/logs" "$HARNESS_DIR/run" "$HARNESS_DIR/mempool-config.json" \
    "$HARNESS_DIR/seed.json" "$HARNESS_DIR/smoke.env"
  mkdir -p "$HARNESS_DIR/qbitd" "$HARNESS_DIR/electrs-db" "$HARNESS_DIR/backend/cache" \
    "$HARNESS_DIR/logs" "$HARNESS_DIR/run"
  touch "$HARNESS_DIR/$MARKER"
}

check_ports_free() {
  local port ports=("$RPC_PORT" "$P2P_PORT" "$BACKEND_PORT")
  if ((ELECTRS)); then
    ports+=("$ELECTRS_HTTP_PORT" "$ELECTRUM_PORT" "$ELECTRS_MONITORING_PORT")
  fi
  for port in "${ports[@]}"; do
    if port_in_use "$port"; then
      die "127.0.0.1:$port is already in use; stop whatever listens there before starting the harness"
    fi
  done
}

# db_tool MODE: run a database step with the backend's own mysql2, reading the
# QBIT_REGTEST_DB_* settings from the environment. "probe" only connects;
# "prepare" prints the number of tables in QBIT_REGTEST_DB_NAME, after first
# dropping them when QBIT_REGTEST_DB_RESET=1. Nothing outside that database is
# touched. Exits 2 when the server rejects the credentials, which no retry fixes.
db_tool() {
  local left=$((DEADLINE - $(date +%s)))
  ((left > 0)) || die "timed out after ${TIMEOUT}s (QBIT_REGTEST_TIMEOUT)"
  node - "$BACKEND_DIR" "$1" "$left" <<'JS'
const [backendDir, mode, secondsLeft] = process.argv.slice(2);
const mysql = require(require.resolve('mysql2/promise', { paths: [backendDir] }));
const env = process.env;
const name = env.QBIT_REGTEST_DB_NAME;
const timeout = Number(secondsLeft) * 1000;
const query = (connection, sql, values) => connection.query({ sql, timeout }, values);

(async () => {
  const connection = await mysql.createConnection({
    host: env.QBIT_REGTEST_DB_HOST,
    port: Number(env.QBIT_REGTEST_DB_PORT),
    user: env.QBIT_REGTEST_DB_USER,
    password: env.QBIT_REGTEST_DB_PASSWORD,
    connectTimeout: Math.min(timeout, 10000),
  });
  try {
    if (mode === 'probe') return;
    const [schemas] = await query(connection,
      'SELECT 1 FROM information_schema.schemata WHERE schema_name = ?', [name]);
    if (schemas.length === 0) {
      throw new Error(`database ${name} does not exist or ${env.QBIT_REGTEST_DB_USER} cannot use it`);
    }
    const listTables = async () => (await query(connection,
      'SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = ?',
      [name]))[0];
    let tables = await listTables();
    if (tables.length > 0 && env.QBIT_REGTEST_DB_RESET === '1') {
      await query(connection, 'SET SESSION foreign_key_checks = 0');
      for (const table of tables) {
        const kind = table.type === 'VIEW' ? 'VIEW' : 'TABLE';
        await query(connection, `DROP ${kind} ${mysql.escapeId(name)}.${mysql.escapeId(table.name)}`);
      }
      console.error(`dropped ${tables.length} tables from ${name}`);
      tables = await listTables();
    }
    console.log(tables.length);
  } finally {
    await connection.end();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(error.code === 'ER_ACCESS_DENIED_ERROR' ? 2 : 1);
});
JS
}

check_db_reachable() {
  local error status=0
  error="$(db_tool probe 2>&1)" || status=$?
  ((status != 2)) || die "MariaDB at $QBIT_REGTEST_DB_HOST:$QBIT_REGTEST_DB_PORT rejected the login: ${error//$'\n'/ }"
  if ((status != 0)); then
    WAIT_DETAIL="${error//$'\n'/ }"
    return 1
  fi
}

# Each run starts a new chain, so the backend needs an empty database: rows
# from an earlier chain at the same heights would otherwise survive.
check_database() {
  local where="$QBIT_REGTEST_DB_HOST:$QBIT_REGTEST_DB_PORT" tables
  wait_for "MariaDB at $where" check_db_reachable
  tables="$(db_tool prepare)" || die "could not check database $QBIT_REGTEST_DB_NAME at $where"
  if [[ "$tables" != 0 ]]; then
    die "database $QBIT_REGTEST_DB_NAME at $where already has $tables tables, probably from an earlier chain; use an empty database, or set QBIT_REGTEST_DB_RESET=1 to drop its tables first"
  fi
}

check_qbitd_rpc() {
  local info chain err="$HARNESS_DIR/logs/qbit-cli.stderr"
  # Keep stderr apart: a warning there must not break the JSON on stdout.
  if ! info="$(qcli getblockchaininfo 2>"$err")"; then
    WAIT_DETAIL="$(tr '\n' ' ' <"$err")"
    return 1
  fi
  chain="$(json 'd.chain' <<<"$info")" || return 1
  # Never seed anything but regtest.
  [[ "$chain" == regtest ]] || die "qbitd reports chain '$chain', expected regtest"
}

start_qbitd() {
  cat >"$HARNESS_DIR/qbitd/qbit.conf" <<EOF
# Written by qbit-regtest-harness.sh. Regtest only, loopback only, cookie auth.
regtest=1

[regtest]
server=1
txindex=1
fallbackfee=0.0001
p2mronly=$P2MRONLY
# Derive wallet keys on demand, as qbit's functional tests do: the default
# pool of 1,000 keys per address type takes about 30 seconds to create.
keypool=1
bind=127.0.0.1:$P2P_PORT
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=$RPC_PORT
dnsseed=0
fixedseeds=0
discover=0
natpmp=0
listenonion=0
printtoconsole=1
nodebuglogfile=1
EOF
  log "starting qbitd (-p2mronly=$P2MRONLY, RPC 127.0.0.1:$RPC_PORT, P2P 127.0.0.1:$P2P_PORT)"
  start_component qbitd "$QBITD" -datadir="$HARNESS_DIR/qbitd"
  wait_for "qbitd RPC" check_qbitd_rpc qbitd
}

mine_auxpow_block() {
  local payout="$1" template hash payload result tip version
  template="$(qcli createauxblock "$payout")"
  hash="$(json 'd.hash' <<<"$template")"
  payload="$(python3 -I "$AUXPOW_HELPER" <<<"$template")"
  result="$(qcli submitauxblock "$hash" "$payload")"
  [[ -z "$result" ]] || die "submitauxblock rejected $hash: $result"
  # Assign first, so a failed RPC stops the run instead of reading as a mismatch.
  tip="$(qcli getbestblockhash)"
  [[ "$tip" == "$hash" ]] || die "AuxPoW block $hash did not become the tip (tip is $tip)"
  version="$(qcli getblockheader "$hash" | json 'd.version')"
  (((version >> 8) & 1)) || die "block $hash does not carry the AuxPoW version bit"
  AUXPOW_BLOCKS+=("$hash")
}

# Seed outputs and spends of every address type the wallet offers: only p2mr
# when outputs are restricted (qbitd's regtest default, and the rule on mainnet
# and testnet4), and every getnewaddress type with -p2mronly=0.
seed_chain() {
  local types type entry addr txid miner p2a data vout dest spend mempool expected unconfirmed raw value
  if ((P2MRONLY)); then
    types=(p2mr)
  else
    types=(legacy p2sh-segwit bech32 bech32m p2mr)
  fi
  CONFIRMED=()
  UNCONFIRMED=()
  AUXPOW_BLOCKS=()
  PERMISSIONLESS_BLOCKS=()

  qcli -named createwallet wallet_name="$WALLET" load_on_startup=false >/dev/null
  # createauxblock only pays P2MR addresses, so mine every block to one.
  miner="$(wcli getnewaddress miner p2mr)"
  log "mining $MATURE_HEIGHT blocks"
  qcli generatetoaddress "$MATURE_HEIGHT" "$miner" >/dev/null

  for type in "${types[@]}"; do
    addr="$(wcli getnewaddress "seed-$type" "$type")"
    txid="$(wcli sendtoaddress "$addr" 2.5)"
    CONFIRMED+=("$type:$addr:$txid")
  done
  # OP_RETURN and pay-to-anchor are the other outputs restricted mode allows.
  p2a="$(qcli decodescript 51024e73 | json 'd.address')"
  data="$(printf 'qbit-explorer regtest harness' | od -An -tx1 | tr -d ' \n')"
  txid="$(wcli -named send outputs="[{\"data\":\"$data\"},{\"$p2a\":0.001}]" | json 'd.complete ? d.txid : null')"
  CONFIRMED+=("op_return+anchor:$p2a:$txid")

  # A script-path spend of a single OP_TRUE leaf, as in test_single_leaf_spend
  # in qbit's feature_p2mr.py. The witness is the leaf script and the control
  # block 0xc1, spliced into the unsigned transaction after its segwit marker.
  addr="$(qcli decodescript "5220$P2MR_OP_TRUE_PROGRAM" | json 'd.address')"
  txid="$(wcli sendtoaddress "$addr" 2.5)"
  CONFIRMED+=("p2mr_leaf:$addr:$txid")
  vout="$(qcli getrawtransaction "$txid" 1 | json "(d.vout.find((o) => o.scriptPubKey.address === '$addr') || {}).n")" ||
    die "no output to $addr in $txid"
  dest="$(wcli getnewaddress seed-p2mr-leaf-spend p2mr)"
  raw="$(qcli createrawtransaction "[{\"txid\":\"$txid\",\"vout\":$vout}]" "[{\"$dest\":2.4999}]")"
  spend="$(qcli sendrawtransaction "${raw:0:8}0001${raw:8:${#raw}-16}02015101c1${raw: -8}")"
  CONFIRMED+=("p2mr_leaf_spend:$dest:$spend")

  # Outputs only an unrestricted chain allows. The wallet has no P2WSH address
  # type, and relay policy refuses reserved witness versions, though consensus
  # doesn't, so mine that one directly.
  if ! ((P2MRONLY)); then
    addr="$(qcli decodescript 51 | json 'd.segwit.address')"
    txid="$(wcli sendtoaddress "$addr" 2.5)"
    CONFIRMED+=("p2wsh:$addr:$txid")

    addr="$(qcli decodescript "5320$P2MR_OP_TRUE_PROGRAM" | json 'd.address')"
    spend="$(wcli listunspent | json "(() => {
      const u = d.find((c) => c.spendable && c.amount > 1 && c.address === '$miner');
      return [u.txid, u.vout, (u.amount - 0.001).toFixed(8)].join(' ');
    })()")" || die "no mature coin to spend to a reserved witness output"
    read -r txid vout value <<<"$spend"
    raw="$(qcli createrawtransaction "[{\"txid\":\"$txid\",\"vout\":$vout}]" "[{\"$addr\":$value}]")"
    raw="$(wcli signrawtransactionwithwallet "$raw" | json 'd.complete ? d.hex : null')"
    qcli generateblock "$miner" "[\"$raw\"]" >/dev/null
    CONFIRMED+=("reserved_witness_v3:$addr:$(qcli decoderawtransaction "$raw" | json 'd.txid')")
  fi

  # The first AuxPoW block confirms the transactions above; then alternate the
  # lanes so both appear near the tip.
  log "mining AuxPoW and permissionless blocks"
  mine_auxpow_block "$miner"
  unconfirmed="$(qcli getmempoolinfo | json 'd.size')"
  [[ "$unconfirmed" == 0 ]] || die "the AuxPoW block left $unconfirmed seed transactions unconfirmed"
  PERMISSIONLESS_BLOCKS+=("$(qcli generatetoaddress 1 "$miner" | json 'd[0]')")
  mine_auxpow_block "$miner"
  PERMISSIONLESS_BLOCKS+=("$(qcli generatetoaddress 1 "$miner" | json 'd[0]')")
  mine_auxpow_block "$miner"

  # Leave spends of a legacy (when available) and a P2MR output unconfirmed.
  for type in legacy p2mr; do
    for entry in "${CONFIRMED[@]}"; do
      [[ "$entry" == "$type:"* ]] || continue
      IFS=: read -r _ addr txid <<<"$entry"
      vout="$(qcli getrawtransaction "$txid" 1 | json "(d.vout.find((o) => o.scriptPubKey.address === '$addr') || {}).n")" ||
        die "no output to $addr in $txid"
      dest="$(wcli getnewaddress "unconfirmed-from-$type" p2mr)"
      spend="$(wcli -named send outputs="[{\"$dest\":1}]" \
        options="{\"inputs\":[{\"txid\":\"$txid\",\"vout\":$vout}],\"add_inputs\":false}" | json 'd.complete ? d.txid : null')"
      UNCONFIRMED+=("$spend")
    done
  done
  mempool="$(qcli getrawmempool | json 'd.slice().sort().join(" ")')"
  expected="$(printf '%s\n' "${UNCONFIRMED[@]}" | LC_ALL=C sort | tr '\n' ' ')"
  [[ "$mempool" == "${expected% }" ]] || die "mempool holds [$mempool], expected [${expected% }]"

  TIP_HEIGHT="$(qcli getblockcount)"
  TIP_HASH="$(qcli getbestblockhash)"
  log "seeded to height $TIP_HEIGHT with ${#AUXPOW_BLOCKS[@]} AuxPoW blocks and ${#UNCONFIRMED[@]} mempool transactions"
}

# json_strings VALUE...: a JSON array of strings that need no escaping
# (hashes, txids, addresses).
json_strings() {
  local value out="" sep=""
  for value in "$@"; do
    out+="$sep\"$value\""
    sep=","
  done
  printf '[%s]' "$out"
}

# Record what the seed created, for later checks against the stack.
write_seed_summary() {
  local entry type addr txid confirmed="" sep=""
  for entry in "${CONFIRMED[@]}"; do
    IFS=: read -r type addr txid <<<"$entry"
    confirmed+="$sep{\"type\":\"$type\",\"address\":\"$addr\",\"txid\":\"$txid\"}"
    sep=","
  done
  printf '{"wallet":"%s","p2mronly":%s,"height":%s,"bestblockhash":"%s","auxpowBlocks":%s,"permissionlessBlocks":%s,"confirmed":[%s],"unconfirmed":%s}' \
    "$WALLET" "$P2MRONLY" "$TIP_HEIGHT" "$TIP_HASH" "$(json_strings "${AUXPOW_BLOCKS[@]}")" \
    "$(json_strings "${PERMISSIONLESS_BLOCKS[@]}")" "$confirmed" "$(json_strings "${UNCONFIRMED[@]}")" | json 'd' >"$HARNESS_DIR/seed.json"
}

# The tip and the mempool must both match the node, not just respond.
check_electrs_synced() {
  local hash node_hash body mempool node_mempool
  if ! hash="$(http_get "$ESPLORA_URL/blocks/tip/hash")"; then
    WAIT_DETAIL="REST API not answering"
    return 1
  fi
  node_hash="$(qcli getbestblockhash)" || { WAIT_DETAIL="qbit-cli getbestblockhash failed"; return 1; }
  if [[ "$hash" != "$node_hash" ]]; then
    WAIT_DETAIL="tip $hash, node tip $node_hash"
    return 1
  fi
  body="$(http_get "$ESPLORA_URL/mempool/txids")" || { WAIT_DETAIL="REST /mempool/txids failed"; return 1; }
  mempool="$(json 'd.slice().sort().join(" ")' <<<"$body")" || { WAIT_DETAIL="bad /mempool/txids response"; return 1; }
  node_mempool="$(qcli getrawmempool | json 'd.slice().sort().join(" ")')" ||
    { WAIT_DETAIL="qbit-cli getrawmempool failed"; return 1; }
  if [[ "$mempool" != "$node_mempool" ]]; then
    WAIT_DETAIL="mempool [$mempool], node mempool [$node_mempool]"
    return 1
  fi
}

start_electrs() {
  log "starting qbit-electrs (REST $ESPLORA_URL, Electrum 127.0.0.1:$ELECTRUM_PORT)"
  start_component electrs "$QBIT_ELECTRS" -vv --timestamp \
    --network qbitregtest \
    --daemon-dir "$HARNESS_DIR/qbitd/regtest" \
    --daemon-rpc-addr "127.0.0.1:$RPC_PORT" \
    --jsonrpc-import \
    --db-dir "$HARNESS_DIR/electrs-db" \
    --http-addr "127.0.0.1:$ELECTRS_HTTP_PORT" \
    --electrum-rpc-addr "127.0.0.1:$ELECTRUM_PORT" \
    --monitoring-addr "127.0.0.1:$ELECTRS_MONITORING_PORT"
  wait_for "qbit-electrs to reach the node tip and mempool" check_electrs_synced electrs qbitd
}

# Generate the backend config from the production regtest template, keeping
# its settings except credentials, file locations, the backend mode and the
# database switch.
write_backend_config() {
  # The database credentials stay in the environment, off the command line.
  node - "$CONFIG_TEMPLATE" "$HARNESS_DIR/mempool-config.json" "$HARNESS_DIR" "$BACKEND_MODE" \
    "$DATABASE" "$RPC_PORT" "$BACKEND_PORT" "$ESPLORA_URL" <<'JS'
const fs = require('fs');
const [template, output, harnessDir, backend, database, rpcPort, backendPort, esploraUrl] = process.argv.slice(2);
const env = process.env;
const config = JSON.parse(fs.readFileSync(template, 'utf8'));
const expect = (ok, message) => {
  if (!ok) throw new Error(`${template}: ${message}`);
};
// The harness starts every service on the template's regtest ports.
expect(config.MEMPOOL.NETWORK === 'regtest', 'MEMPOOL.NETWORK is not regtest');
expect(config.MEMPOOL.HTTP_PORT === Number(backendPort), `MEMPOOL.HTTP_PORT is not ${backendPort}`);
expect(config.CORE_RPC.PORT === Number(rpcPort), `CORE_RPC.PORT is not ${rpcPort}`);
expect(config.ESPLORA.REST_API_URL === esploraUrl, `ESPLORA.REST_API_URL is not ${esploraUrl}`);

config.MEMPOOL.BACKEND = backend;
config.MEMPOOL.CACHE_DIR = `${harnessDir}/backend/cache`;
// Database readiness waits for the indexer's debug-level completion line.
config.MEMPOOL.STDOUT_LOG_MIN_PRIORITY = 'debug';
config.SYSLOG = { ...config.SYSLOG, ENABLED: false };
// No outside price feeds: the indexer awaits them before it reports completion.
config.FIAT_PRICE = { ...config.FIAT_PRICE, ENABLED: false };
// Keep the template's other CORE_RPC settings; cookie auth replaces its
// credential placeholders.
const { USERNAME: _user, PASSWORD: _pass, ...coreRpc } = config.CORE_RPC;
config.CORE_RPC = {
  ...coreRpc,
  HOST: '127.0.0.1',
  PORT: Number(rpcPort),
  COOKIE: true,
  COOKIE_PATH: `${harnessDir}/qbitd/regtest/.cookie`,
};
if (database === '1') {
  config.DATABASE = {
    ...config.DATABASE,
    ENABLED: true,
    HOST: env.QBIT_REGTEST_DB_HOST,
    PORT: Number(env.QBIT_REGTEST_DB_PORT),
    DATABASE: env.QBIT_REGTEST_DB_NAME,
    USERNAME: env.QBIT_REGTEST_DB_USER,
    PASSWORD: env.QBIT_REGTEST_DB_PASSWORD,
    PID_DIR: `${harnessDir}/backend`,
  };
} else {
  config.DATABASE = { ENABLED: false };
}
const placeholder = JSON.stringify(config).match(/__[A-Z0-9_]+__/);
expect(placeholder === null, `placeholder ${placeholder} left unset`);
fs.writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
JS
}

# The backend has no bind-address setting and listens on every interface. This
# preload gives its port-only listen() calls the loopback host.
write_loopback_preload() {
  cat >"$HARNESS_DIR/backend/loopback.cjs" <<'JS'
'use strict';
const net = require('net');
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'number' && typeof args[1] !== 'string') {
    args.splice(1, 0, '127.0.0.1');
  }
  return listen.apply(this, args);
};
JS
}

# Caught up means the backend processed the node's tip and every mempool
# transaction into its projected blocks; with a database, also that the first
# indexer run finished, so database-backed endpoints are complete and stable.
check_backend_synced() {
  local height hash node_height node_hash body projected node_mempool
  if ! height="$(http_get "$MEMPOOL_API_URL/blocks/tip/height")"; then
    WAIT_DETAIL="API not answering"
    return 1
  fi
  node_height="$(qcli getblockcount)" || { WAIT_DETAIL="qbit-cli getblockcount failed"; return 1; }
  if [[ "$height" != "$node_height" ]]; then
    WAIT_DETAIL="tip height $height, node height $node_height"
    return 1
  fi
  # /blocks/tip/hash is proxied to qbit-electrs in esplora mode; the newest
  # block in /blocks is one the backend has processed itself.
  body="$(http_get "$MEMPOOL_API_URL/blocks")" || { WAIT_DETAIL="API /blocks failed"; return 1; }
  hash="$(json 'd[0].id' <<<"$body")" || { WAIT_DETAIL="no blocks in /blocks yet"; return 1; }
  node_hash="$(qcli getbestblockhash)" || { WAIT_DETAIL="qbit-cli getbestblockhash failed"; return 1; }
  if [[ "$hash" != "$node_hash" ]]; then
    WAIT_DETAIL="tip hash $hash, node tip $node_hash"
    return 1
  fi
  body="$(http_get "$MEMPOOL_API_URL/fees/mempool-blocks")" || { WAIT_DETAIL="API /fees/mempool-blocks failed"; return 1; }
  projected="$(json 'd.reduce((n, b) => n + b.nTx, 0)' <<<"$body")" ||
    { WAIT_DETAIL="bad /fees/mempool-blocks response"; return 1; }
  node_mempool="$(qcli getmempoolinfo | json 'd.size')" || { WAIT_DETAIL="qbit-cli getmempoolinfo failed"; return 1; }
  if [[ "$projected" != "$node_mempool" ]]; then
    WAIT_DETAIL="$projected of $node_mempool mempool transactions in projected blocks"
    return 1
  fi
  # Test-only signal: the indexer reports completion only in this debug log line.
  if ((DATABASE)) && ! grep -qF 'Indexing completed' "$HARNESS_DIR/logs/backend.log"; then
    WAIT_DETAIL="caught up; indexer still running"
    return 1
  fi
}

start_backend() {
  write_backend_config
  write_loopback_preload
  log "starting the backend ($MEMPOOL_API_URL, MEMPOOL.BACKEND=$BACKEND_MODE, database $( ((DATABASE)) && echo on || echo off))"
  # Start node itself, from a directory inside the harness, so the recorded
  # PID is node's from the start.
  export MEMPOOL_CONFIG_FILE="$HARNESS_DIR/mempool-config.json"
  cd "$HARNESS_DIR/backend"
  # Test-only preload: the backend has no bind-address setting; this keeps it on 127.0.0.1.
  start_component backend node --require "$HARNESS_DIR/backend/loopback.cjs" "$BACKEND_DIR/dist/index.js"
  cd - >/dev/null
  # In esplora mode the backend follows qbit-electrs, so stop early if it exits.
  local watch=(backend qbitd)
  if ((ELECTRS)); then
    watch+=(electrs)
  fi
  wait_for "the backend to catch up with the node" check_backend_synced "${watch[@]}"
}

write_smoke_env() {
  {
    printf '%s=%q\n' MEMPOOL_API_URL "$MEMPOOL_API_URL"
    ((ELECTRS)) && printf '%s=%q\n' ESPLORA_URL "$ESPLORA_URL"
    printf '%s=%q\n' QBIT_CLI "$QBIT_CLI"
    printf '%s=%q\n' QBIT_CLI_ARGS "-datadir=$HARNESS_DIR/qbitd -rpcclienttimeout=30"
    printf '%s=%q\n' QBIT_REGTEST_SEED "$HARNESS_DIR/seed.json"
  } >"$HARNESS_DIR/smoke.env"
}

on_up_exit() {
  local status=$?
  ((UP_OK)) && return
  log "up failed (exit $status)"
  print_log_tails
  log "stopping the stack"
  stop_all || true
}

cmd_up() {
  read_settings
  DEADLINE=$(($(date +%s) + TIMEOUT))
  resolve_harness_dir
  check_ports_free
  # if, not &&: a function on the left of && runs with set -e turned off.
  if ((DATABASE)); then
    check_database
  fi
  reset_harness_dir
  trap on_up_exit EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  start_qbitd
  seed_chain
  write_seed_summary
  if ((ELECTRS)); then
    start_electrs
  fi
  start_backend
  write_smoke_env
  UP_OK=1

  log "stack is up in $HARNESS_DIR: height $TIP_HEIGHT, ${#UNCONFIRMED[@]} transactions in the mempool"
  log "logs: $HARNESS_DIR/logs/, seed summary: $HARNESS_DIR/seed.json"
  log "smoke environment: $HARNESS_DIR/smoke.env"
  log "run the smoke checks: set -a; . $HARNESS_DIR/smoke.env; set +a; (cd $BACKEND_DIR && npm run smoke:qbit-regtest)"
  log "stop it with: $0 down"
}

cmd_down() {
  if [[ ! -d "$HARNESS_DIR/run" ]]; then
    log "nothing to stop: no harness run in $HARNESS_DIR. If \`up\` used another directory, set QBIT_REGTEST_DIR to it."
    return 0
  fi
  HARNESS_DIR="$(cd "$HARNESS_DIR" && pwd -P)"
  stop_all || die "some processes could not be stopped"
  log "stopped; logs stay in $HARNESS_DIR/logs"
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  *)
    printf 'usage: %s up|down\n' "$0" >&2
    exit 2
    ;;
esac
