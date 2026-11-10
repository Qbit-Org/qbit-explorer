#!/bin/sh
# Print the Rust toolchain that rust/gbt/rust-toolchain pins, such as 1.84.
#
#   sh rust/gbt/scripts/toolchain-channel.sh [path/to/rust-toolchain]
#
# The file must be TOML, with the channel under [toolchain]. rustup also reads
# a file holding only a toolchain name, but Dependabot reads only TOML. Exits 1
# with a message when it finds no channel, so CI and the build stop there
# instead of going on with an empty version.

set -eu

file="${1:-$(dirname "$0")/../rust-toolchain}"
if [ ! -r "$file" ]; then
  echo "toolchain-channel: can't read $file" >&2
  exit 1
fi

# Takes a basic or literal string, with or without spaces around =, and
# ignores CR line ends and comments. Also takes a dotted toolchain.channel key
# before any table.
channel="$(awk '
  { sub(/\r$/, "") }
  /^[ \t]*\[/ {
    table = $0
    sub(/#.*/, "", table)
    gsub(/[ \t]/, "", table)
    next
  }
  (table == "[toolchain]" && /^[ \t]*("channel"|channel)[ \t]*=/) ||
  (table == "" && /^[ \t]*("toolchain"|toolchain)[ \t]*\.[ \t]*("channel"|channel)[ \t]*=/) {
    value = $0
    sub(/^[^=]*=[ \t]*/, "", value)
    quote = substr(value, 1, 1)
    if (quote != "\"" && quote != "\047") {
      exit
    }
    value = substr(value, 2)
    end = index(value, quote)
    if (end > 0) {
      print substr(value, 1, end - 1)
    }
    exit
  }
' "$file")"

case "$channel" in
  "" | *[!A-Za-z0-9._-]*)
    echo "toolchain-channel: found no channel = \"<toolchain>\" under [toolchain] in $file" >&2
    exit 1
    ;;
esac
printf '%s\n' "$channel"
