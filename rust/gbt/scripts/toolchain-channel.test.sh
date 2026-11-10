#!/bin/sh
# Tests for toolchain-channel.sh: sh rust/gbt/scripts/toolchain-channel.test.sh

set -eu

script="$(dirname "$0")/toolchain-channel.sh"
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
failures=0

# expect CHANNEL CONTENT: the script prints CHANNEL for a file holding CONTENT
expect() {
  printf '%b' "$2" >"$dir/rust-toolchain"
  if got="$(sh "$script" "$dir/rust-toolchain" 2>/dev/null)" && [ "$got" = "$1" ]; then
    return 0
  fi
  echo "FAIL: expected '$1' for $(printf '%s' "$2")" >&2
  failures=$((failures + 1))
}

# reject CONTENT: the script exits 1 with a message, and prints nothing
reject() {
  printf '%b' "$1" >"$dir/rust-toolchain"
  status=0
  out="$(sh "$script" "$dir/rust-toolchain" 2>"$dir/stderr")" || status=$?
  if [ "$status" -eq 1 ] && [ -z "$out" ] && grep -q 'found no channel' "$dir/stderr"; then
    return 0
  fi
  echo "FAIL: accepted, or failed without its message, for $(printf '%s' "$1")" >&2
  failures=$((failures + 1))
}

expect 1.84 '[toolchain]\nchannel = "1.84"\n'
expect 1.84 '[toolchain]\nchannel="1.84"\n'
expect 1.84 "[toolchain]\nchannel = '1.84'\n"
expect 1.84 '[toolchain]\nchannel = "1.84" # rust:1.84 in docker/backend/Dockerfile\n'
expect 1.84 '[toolchain]\r\nchannel = "1.84"\r\n'
expect 1.84 '# Rust for rust/gbt\n[ toolchain ] # pinned\nprofile = "minimal"\n  "channel" = "1.84"\n'
expect 1.84 'toolchain.channel = "1.84"\n'
expect 1.84.1 '[toolchain]\nchannel = "1.84.1"\ncomponents = ["clippy"]\n'
expect nightly-2025-01-01 '[toolchain]\nchannel = "nightly-2025-01-01"\n'

reject '1.84\n'
reject '[toolchain]\nprofile = "minimal"\n'
reject '[other]\nchannel = "1.84"\n'
reject '[toolchain]\n# channel = "1.84"\n'
reject '[toolchain]\nchannel = ""\n'
reject '[toolchain]\nchannel = 1.84\n'
reject '[toolchain]\nchannel = "1.84\n'
reject '[toolchain]\nchannel = "1.84; rm -rf /"\n'
reject ''

# The default path is the rust-toolchain next to the scripts directory
if ! sh "$script" >/dev/null; then
  echo "FAIL: can't read $(dirname "$0")/../rust-toolchain" >&2
  failures=$((failures + 1))
fi
status=0
sh "$script" "$dir/missing" 2>/dev/null || status=$?
if [ "$status" -ne 1 ]; then
  echo "FAIL: a missing file should exit 1, got $status" >&2
  failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
  echo "$failures toolchain-channel tests failed" >&2
  exit 1
fi
echo "toolchain-channel: all tests passed"
