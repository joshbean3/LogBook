#!/bin/sh
# A logical backup of the live database, safe while the app runs: `VACUUM INTO` through better-sqlite3 (no sqlite3
# binary needed), then an integrity check of the copy. The worker does the same every night at 03:00 UTC; this is
# the one you run by hand before a risky change.
#
#   fly ssh console -C "/app/scripts/backup.sh"            # writes /data/backups/logbook-<stamp>.db
#   fly sftp get /data/backups/logbook-<stamp>.db ./        # and bring it home
#   scripts/backup.sh ./backups                             # locally, against DATABASE_PATH (or ./data/logbook.db)
set -eu
DB="${DATABASE_PATH:-/data/logbook.db}"
[ -f "$DB" ] || DB="$(cd "$(dirname "$0")/.." && pwd)/apps/api/data/logbook.db"
OUT="${1:-${BACKUP_DIR:-$(dirname "$DB")/backups}}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="$OUT/logbook-$STAMP.db"
mkdir -p "$OUT"

# where better-sqlite3 is: /app in the image, apps/api in a checkout
APP="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
[ -d "$APP/node_modules/better-sqlite3" ] || APP="$APP/apps/api"
cd "$APP"
node -e '
  const Database = require("better-sqlite3");
  const [db, out] = process.argv.slice(1);
  const src = new Database(db, { readonly: true });
  src.prepare("VACUUM INTO ?").run(out + ".tmp");
  src.close();
  const copy = new Database(out + ".tmp", { readonly: true });
  const check = copy.pragma("integrity_check", { simple: true });
  copy.close();
  if (check !== "ok") { console.error("integrity check failed:", check); process.exit(1); }
  require("fs").renameSync(out + ".tmp", out);
  console.log(JSON.stringify({ ok: true, file: out, bytes: require("fs").statSync(out).size }));
' "$DB" "$FILE"
