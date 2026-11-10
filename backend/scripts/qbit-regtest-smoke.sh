#!/usr/bin/env bash

set -uo pipefail

API_URL="${MEMPOOL_API_URL:-http://127.0.0.1:8999/api/v1}"
ESPLORA_URL="${ESPLORA_URL:-}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
QBIT_CLI="${QBIT_CLI:-}"
QBIT_CLI_ARGS="${QBIT_CLI_ARGS:-}"
MAX_QBIT_BLOCK_WEIGHT="${MAX_QBIT_BLOCK_WEIGHT:-2000000}"
SKIP_BACKEND="${SKIP_BACKEND:-0}"

TMP_DIR="$(mktemp -d)"
FETCH_OUT=""
PASSED=0
WARNED=0
FAILED=0

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ok() {
  PASSED=$((PASSED + 1))
  printf 'ok: %s\n' "$1"
}

warn() {
  WARNED=$((WARNED + 1))
  printf 'warn: %s\n' "$1" >&2
}

fail() {
  FAILED=$((FAILED + 1))
  printf 'fail: %s\n' "$1" >&2
}

safe_name() {
  printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'
}

# fetch LABEL URL [retry]: with "retry", curl retries transient answers such
# as the 503 the backend gives until its first block sync.
fetch() {
  local label="$1"
  local url="$2"
  local out="$TMP_DIR/$(safe_name "$label")"
  local retry=()
  [[ "${3:-}" == retry ]] && retry=(--retry 10 --retry-delay 1)

  if curl -fsS --max-time "$CURL_TIMEOUT" ${retry[@]+"${retry[@]}"} "$url" -o "$out"; then
    FETCH_OUT="$out"
    ok "$label"
    return 0
  fi

  fail "$label ($url)"
  return 1
}

fetch_optional() {
  local label="$1"
  local url="$2"
  local out="$TMP_DIR/$(safe_name "$label")"

  if curl -fsS --max-time "$CURL_TIMEOUT" "$url" -o "$out"; then
    FETCH_OUT="$out"
    ok "$label"
    return 0
  fi

  warn "$label unavailable ($url)"
  return 1
}

read_body() {
  tr -d '\n\r ' < "$1"
}

is_uint() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

is_hash() {
  [[ "$1" =~ ^[0-9a-fA-F]{64}$ ]]
}

require_json() {
  local label="$1"
  local file="$2"

  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" "$file" >/dev/null 2>&1; then
    ok "$label JSON"
  else
    fail "$label did not parse as JSON"
  fi
}

json_number_field() {
  local file="$1"
  local field="$2"

  node -e "
try {
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const value = process.argv[2].split('.').reduce((acc, key) => acc && acc[key], data);
if (typeof value === 'number') {
  console.log(value);
}
} catch (e) {
  process.exit(0);
}
" "$file" "$field"
}

validate_lane_rate_sum() {
  local label="$1"
  local aggregate="$2"
  local permissionless="$3"
  local auxpow="$4"
  local validation_error=""

  if validation_error="$(node -e '
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
const rawRates = process.argv.slice(1);
if (rawRates.some((rate) => rate.trim() === "")) {
  throw new Error("one or more lane hashrate values are empty");
}
const [aggregate, permissionless, auxpow] = rawRates.map(Number);
const rates = { aggregate, permissionless, auxpow };

for (const [name, rate] of Object.entries(rates)) {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`${name} rate is not a finite nonnegative number: ${rate}`);
  }
}

const laneSum = permissionless + auxpow;
const scale = Math.max(Math.abs(aggregate), Math.abs(laneSum));
const relativeError = scale === 0 ? 0 : Math.abs(aggregate - laneSum) / scale;
if (relativeError > 0.001) {
  throw new Error(`aggregate differs from lane sum by ${(relativeError * 100).toFixed(6)}%`);
}
' "$aggregate" "$permissionless" "$auxpow" 2>&1)"; then
    ok "$label"
  else
    fail "$label (${validation_error//$'\n'/ })"
  fi
}

validate_hashrate_response() {
  local file="$1"
  local tip_height="${2:-}"
  local validation_error=""

  if validation_error="$(node -e '
process.on("uncaughtException", (error) => {
  console.error(error.message);
  process.exit(1);
});
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const own = (name) => Object.prototype.hasOwnProperty.call(data, name);
const requireField = (name) => {
  if (!own(name)) throw new Error(`missing field ${name}`);
  return data[name];
};
const requireRate = (name) => {
  const value = requireField(name);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} is not a finite nonnegative number`);
  }
  return value;
};
const requireArray = (name) => {
  const value = requireField(name);
  if (!Array.isArray(value)) throw new Error(`${name} is not an array`);
  return value;
};
const readSeries = (name) => {
  const rows = requireArray(name);
  const byTimestamp = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new Error(`${name} contains a non-object row`);
    if (typeof row.timestamp !== "number" || !Number.isFinite(row.timestamp)) {
      throw new Error(`${name} contains an invalid timestamp`);
    }
    if (typeof row.avgHashrate !== "number" || !Number.isFinite(row.avgHashrate) || row.avgHashrate < 0) {
      throw new Error(`${name} contains an invalid avgHashrate`);
    }
    if (byTimestamp.has(row.timestamp)) throw new Error(`${name} contains duplicate timestamp ${row.timestamp}`);
    byTimestamp.set(row.timestamp, row.avgHashrate);
  }
  return byTimestamp;
};
const assertLaneSum = (label, aggregate, permissionless, auxpow) => {
  const laneSum = permissionless + auxpow;
  const scale = Math.max(Math.abs(aggregate), Math.abs(laneSum));
  const relativeError = scale === 0 ? 0 : Math.abs(aggregate - laneSum) / scale;
  if (relativeError > 0.001) {
    throw new Error(`${label} aggregate differs from lane sum by ${(relativeError * 100).toFixed(6)}%`);
  }
};

const currentHashrate = requireRate("currentHashrate");
const currentPermissionless = requireRate("currentHashratePermissionless");
const currentAuxpow = requireRate("currentHashrateAuxpow");
requireRate("currentDifficulty");
assertLaneSum("currentHashrate", currentHashrate, currentPermissionless, currentAuxpow);
const tipHeight = Number(process.argv[2]);
if (Number.isInteger(tipHeight) && tipHeight > 0 && currentHashrate <= 0) {
  throw new Error(`currentHashrate must be positive at backend tip height ${tipHeight}`);
}

const legacyAggregate = readSeries("hashrates");
const aggregate = readSeries("hashratesAggregate");
const permissionless = readSeries("hashratesPermissionless");
const auxpow = readSeries("hashratesAuxpow");
requireArray("difficulty");

if (aggregate.size !== permissionless.size || aggregate.size !== auxpow.size) {
  throw new Error(`historical series lengths differ (${aggregate.size}/${permissionless.size}/${auxpow.size})`);
}
for (const [timestamp, aggregateRate] of aggregate) {
  if (!legacyAggregate.has(timestamp) || legacyAggregate.get(timestamp) !== aggregateRate) {
    throw new Error(`aligned aggregate does not match legacy aggregate at timestamp ${timestamp}`);
  }
  if (!permissionless.has(timestamp) || !auxpow.has(timestamp)) {
    throw new Error(`historical lane series are missing timestamp ${timestamp}`);
  }
  assertLaneSum(
    `hashrates timestamp ${timestamp}`,
    aggregateRate,
    permissionless.get(timestamp),
    auxpow.get(timestamp),
  );
}
' "$file" "$tip_height" 2>&1)"; then
    ok "backend lane-aware hashrate API contract"
  else
    fail "backend lane-aware hashrate API contract (${validation_error//$'\n'/ })"
  fi
}

check_backend() {
  printf 'Checking mempool backend at %s\n' "$API_URL"

  if fetch "backend-info" "$API_URL/backend-info"; then
    require_json "backend-info" "$FETCH_OUT"
  fi

  local height=""
  if fetch "backend tip height" "$API_URL/blocks/tip/height" retry; then
    height="$(read_body "$FETCH_OUT")"
    if is_uint "$height"; then
      ok "backend tip height is numeric ($height)"
    else
      fail "backend tip height is not numeric: $height"
    fi
  fi

  local hash=""
  if fetch_optional "backend tip hash" "$API_URL/blocks/tip/hash"; then
    hash="$(read_body "$FETCH_OUT")"
    if is_hash "$hash"; then
      ok "backend tip hash is 64 hex chars"
    else
      fail "backend tip hash is not a block hash: $hash"
    fi
  fi

  if [[ -n "$height" ]] && is_uint "$height" && [[ "$height" -gt 0 ]]; then
    if fetch_optional "backend block-height round trip" "$API_URL/block-height/$height"; then
      local round_trip
      round_trip="$(read_body "$FETCH_OUT")"
      if is_hash "$round_trip"; then
        ok "backend block-height returned a hash"
        if [[ -n "$hash" && "$round_trip" != "$hash" ]]; then
          warn "backend tip hash and block-height hash differ"
        fi
      else
        fail "backend block-height did not return a block hash: $round_trip"
      fi
    fi
  else
    warn "backend tip height is zero or unavailable; skipping block-height round trip"
  fi

  if [[ -n "$hash" ]] && is_hash "$hash"; then
    if fetch_optional "backend block detail" "$API_URL/block/$hash"; then
      require_json "backend block detail" "$FETCH_OUT"
      local weight
      weight="$(json_number_field "$FETCH_OUT" "weight")"
      if [[ -n "$weight" ]] && is_uint "$weight" && [[ "$weight" -gt "$MAX_QBIT_BLOCK_WEIGHT" ]]; then
        fail "backend block weight $weight exceeds qbit max $MAX_QBIT_BLOCK_WEIGHT"
      elif [[ -n "$weight" ]] && is_uint "$weight"; then
        ok "backend block weight within qbit max"
      else
        warn "backend block detail did not expose a top-level weight field"
      fi
    fi
  else
    warn "backend tip hash unavailable; skipping backend block detail"
  fi

  if fetch_optional "backend mempool" "$API_URL/mempool"; then
    require_json "backend mempool" "$FETCH_OUT"
  fi

  if fetch_optional "backend fees recommended" "$API_URL/fees/recommended"; then
    require_json "backend fees recommended" "$FETCH_OUT"
  fi

  # Search suggestions: a list, empty in esplora mode, since the harness runs
  # qbit-electrs without --address-search
  if fetch "backend address-prefix" "$API_URL/address-prefix/qbrt1"; then
    if node -e "process.exit(Array.isArray(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))) ? 0 : 1)" "$FETCH_OUT" >/dev/null 2>&1; then
      ok "backend address-prefix list"
    else
      fail "backend address-prefix did not answer a JSON list"
    fi
  fi

  if fetch "backend mining hashrate" "$API_URL/mining/hashrate/1w"; then
    require_json "backend mining hashrate" "$FETCH_OUT"
    validate_hashrate_response "$FETCH_OUT" "$height"
  fi

  # The fee and reward graphs; qbit has no price feed, so no block has a price
  local history field
  for history in fees:avgFees rewards:avgRewards; do
    field="${history#*:}"
    history="${history%%:*}"
    if fetch "backend mining block $history" "$API_URL/mining/blocks/$history/1w"; then
      if [[ -n "$(json_number_field "$FETCH_OUT" "0.$field")" ]]; then
        ok "backend mining block $history include the indexed blocks"
      else
        fail "backend mining block $history are empty"
      fi
    fi
  done
}

check_esplora() {
  if [[ -z "$ESPLORA_URL" ]]; then
    warn "ESPLORA_URL is not set; skipping direct qbit-electrs checks"
    return
  fi

  local base="${ESPLORA_URL%/}"
  printf 'Checking qbit-electrs Esplora API at %s\n' "$base"

  local height=""
  if fetch "electrs tip height" "$base/blocks/tip/height"; then
    height="$(read_body "$FETCH_OUT")"
    if is_uint "$height"; then
      ok "electrs tip height is numeric ($height)"
    else
      fail "electrs tip height is not numeric: $height"
    fi
  fi

  local hash=""
  if fetch "electrs tip hash" "$base/blocks/tip/hash"; then
    hash="$(read_body "$FETCH_OUT")"
    if is_hash "$hash"; then
      ok "electrs tip hash is 64 hex chars"
    else
      fail "electrs tip hash is not a block hash: $hash"
    fi
  fi

  if [[ -n "$height" ]] && is_uint "$height"; then
    if fetch "electrs block-height round trip" "$base/block-height/$height"; then
      local round_trip
      round_trip="$(read_body "$FETCH_OUT")"
      if is_hash "$round_trip"; then
        ok "electrs block-height returned a hash"
        if [[ -n "$hash" && "$round_trip" != "$hash" ]]; then
          fail "electrs tip hash and block-height hash differ"
        fi
      else
        fail "electrs block-height did not return a block hash: $round_trip"
      fi
    fi
  fi

  if [[ -n "$hash" ]] && is_hash "$hash"; then
    if fetch "electrs block detail" "$base/block/$hash"; then
      require_json "electrs block detail" "$FETCH_OUT"
      local weight
      weight="$(json_number_field "$FETCH_OUT" "weight")"
      if [[ -n "$weight" ]] && is_uint "$weight" && [[ "$weight" -gt "$MAX_QBIT_BLOCK_WEIGHT" ]]; then
        fail "electrs block weight $weight exceeds qbit max $MAX_QBIT_BLOCK_WEIGHT"
      elif [[ -n "$weight" ]] && is_uint "$weight"; then
        ok "electrs block weight within qbit max"
      else
        warn "electrs block detail did not expose a top-level weight field"
      fi
    fi

    if fetch "electrs block txids" "$base/block/$hash/txids"; then
      require_json "electrs block txids" "$FETCH_OUT"
    fi
  fi
}

check_qbit_cli() {
  if [[ -z "$QBIT_CLI" ]]; then
    warn "QBIT_CLI is not set; skipping direct qbit-cli checks"
    return
  fi

  printf 'Checking qbitd through %s %s\n' "$QBIT_CLI" "$QBIT_CLI_ARGS"

  local height
  # shellcheck disable=SC2086
  if height="$("$QBIT_CLI" $QBIT_CLI_ARGS getblockcount 2>/dev/null)"; then
    if is_uint "$height"; then
      ok "qbit-cli getblockcount is numeric ($height)"
    else
      fail "qbit-cli getblockcount was not numeric: $height"
    fi
  else
    fail "qbit-cli getblockcount failed"
  fi

  local hash
  # shellcheck disable=SC2086
  if hash="$("$QBIT_CLI" $QBIT_CLI_ARGS getbestblockhash 2>/dev/null)"; then
    if is_hash "$hash"; then
      ok "qbit-cli getbestblockhash is 64 hex chars"
    else
      fail "qbit-cli getbestblockhash was not a block hash: $hash"
    fi
  else
    fail "qbit-cli getbestblockhash failed"
  fi

  if is_uint "$height" && [[ "$height" -gt 0 ]]; then
    local lookup=120
    if [[ "$height" -lt "$lookup" ]]; then
      lookup="$height"
    fi

    local window_hash_before=""
    local window_hash_after=""
    local aggregate_hashrate=""
    local permissionless_hashrate=""
    local auxpow_hashrate=""

    # Pin all three estimates to the same height. Checking that height's hash
    # before and after also avoids comparing values across a concurrent reorg.
    # shellcheck disable=SC2086
    if window_hash_before="$("$QBIT_CLI" $QBIT_CLI_ARGS getblockhash "$height" 2>/dev/null)" &&
      aggregate_hashrate="$("$QBIT_CLI" $QBIT_CLI_ARGS getnetworkhashps "$lookup" "$height" all 2>/dev/null)" &&
      permissionless_hashrate="$("$QBIT_CLI" $QBIT_CLI_ARGS getnetworkhashps "$lookup" "$height" permissionless 2>/dev/null)" &&
      auxpow_hashrate="$("$QBIT_CLI" $QBIT_CLI_ARGS getnetworkhashps "$lookup" "$height" auxpow 2>/dev/null)" &&
      window_hash_after="$("$QBIT_CLI" $QBIT_CLI_ARGS getblockhash "$height" 2>/dev/null)"; then
      if [[ "$window_hash_before" != "$window_hash_after" ]]; then
        warn "qbit-cli lane hashrate window changed during the check; skipping oracle"
      else
        validate_lane_rate_sum \
          "qbit-cli fixed-window lane hashrates sum to aggregate" \
          "$aggregate_hashrate" \
          "$permissionless_hashrate" \
          "$auxpow_hashrate"
      fi
    else
      warn "qbit-cli lane-aware getnetworkhashps unavailable; skipping oracle"
    fi
  else
    warn "qbit-cli height is zero or unavailable; skipping lane hashrate oracle"
  fi
}

if [[ "$SKIP_BACKEND" == "1" || "$SKIP_BACKEND" == "true" ]]; then
  warn "SKIP_BACKEND is set; skipping mempool backend checks"
else
  check_backend
fi
check_esplora
check_qbit_cli

printf '\nqbit regtest smoke summary: %s passed, %s warnings, %s failed\n' "$PASSED" "$WARNED" "$FAILED"

if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
