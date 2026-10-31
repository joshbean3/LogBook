#!/bin/sh
# Put a backup in place of the live database. Takes a file (a nightly copy, or one brought over with `fly sftp put`)
# or an s3:// URL (the Litestream replica; the same env vars start.sh uses). The copy is checked first; the live
# file and its -wal/-shm move aside as logbook.db.before-restore-<stamp>; then RESTART THE APP so it opens the new
# file: `fly machine restart <id>` (or `docker compose restart`). Writes between the swap and the restart land in the
# moved-aside file, so do the two back to back.
#
#   fly ssh console -C "/app/scripts/restore.sh /data/backups/logbook-2026-10-30.db"
#   fly ssh console -C "/app/scripts/restore.sh s3://my-bucket/logbook"
#   fly machine restart <machine id>
set -eu
SRC="${1:-}"
[ -n "$SRC" ] || { echo "usage: restore.sh <backup.db | s3://bucket/path>" >&2; exit 2; }
DB="${DATABASE_PATH:-/data/logbook.db}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
STAGE="$DB.restoring"
rm -f "$STAGE"

case "$SRC" in
  s3://*)
    command -v litestream >/dev/null || { echo "litestream is not installed here" >&2; exit 1; }
    litestream restore -o "$STAGE" "$SRC"
    ;;
  *)
    [ -f "$SRC" ] || { echo "no such file: $SRC" >&2; exit 1; }
    cp "$SRC" "$STAGE"
    ;;
esac

APP="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
[ -d "$APP/node_modules/better-sqlite3" ] || APP="$APP/apps/api"
cd "$APP"
node -e '
  const Database = require("better-sqlite3");
  const db = new Database(process.argv[1], { readonly: true });
  const check = db.pragma("integrity_check", { simple: true });
  const users = db.prepare("SELECT count(*) AS n FROM users").get().n;
  db.close();
  if (check !== "ok") { console.error("integrity check failed:", check); process.exit(1); }
  console.log(JSON.stringify({ check, users }));
' "$STAGE"

if pgrep -f "node dist/index.js" >/dev/null 2>&1 || pgrep -f "node dist/worker.js" >/dev/null 2>&1; then
  echo "note: the app is running; restart it right after this (fly machine restart <id>)" >&2
fi
if [ -f "$DB" ]; then
  mv "$DB" "$DB.before-restore-$STAMP"
  [ -f "$DB-wal" ] && mv "$DB-wal" "$DB.before-restore-$STAMP-wal" || true
  [ -f "$DB-shm" ] && mv "$DB-shm" "$DB.before-restore-$STAMP-shm" || true
fi
mv "$STAGE" "$DB"
echo "{\"ok\":true,\"restored\":\"$DB\",\"previous\":\"$DB.before-restore-$STAMP\"}"
echo "now restart the app so it opens the restored file." >&2
