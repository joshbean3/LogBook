#!/bin/sh
# The container's entrypoint. With LITESTREAM_REPLICA_URL set (s3://bucket/path, plus LITESTREAM_ACCESS_KEY_ID and
# LITESTREAM_SECRET_ACCESS_KEY, and LITESTREAM_REPLICA_ENDPOINT for Tigris/R2/B2), a missing database file is restored
# from the replica first, and the server runs under `litestream replicate -exec`, which streams every change and
# forwards SIGTERM so the server still stops cleanly. Without it: plain node. (README: Backups)
set -eu
cd "$(dirname "$0")/.."
DB="${DATABASE_PATH:-/data/logbook.db}"
CONFIG="${LITESTREAM_CONFIG:-/app/litestream.yml}"
MAIN="${LOGBOOK_MAIN:-dist/index.js}"

if [ -n "${LITESTREAM_REPLICA_URL:-}" ]; then
  mkdir -p "$(dirname "$DB")"
  if [ ! -f "$DB" ]; then
    echo "{\"level\":\"info\",\"msg\":\"no database at $DB; restoring from the replica if there is one\"}"
    litestream restore -if-replica-exists -config "$CONFIG" "$DB"
  fi
  exec litestream replicate -config "$CONFIG" -exec "node $MAIN"
fi
exec node "$MAIN"
