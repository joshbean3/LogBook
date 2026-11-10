import { desc, eq, getTableName } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { unknownTables } from './db/compat.js';
import { openDatabase } from './db/index.js';
import * as schema from './db/schema.js';
import { auditLog, authSessions, healthDevices, users } from './db/schema.js';
import { userHash } from './services/audit.js';
import { backupConfigFrom, listBackups, runBackup } from './services/backup.js';

/**
 * Operator commands, run on the server (apps/api/RUNBOOK.md):
 *   node dist/ops.js backup                      take a backup now and apply the retention window
 *   node dist/ops.js backups                     list the remote copies
 *   node dist/ops.js revoke-sessions             sign every account out everywhere
 *   node dist/ops.js revoke-sessions <email>     sign one account out everywhere
 *   node dist/ops.js revoke-health-tokens        make every phone reconnect Apple Health
 *   node dist/ops.js audit <email>               the last 200 security log rows for one account
 *   node dist/ops.js tables                      tables in the database that the schema does not know (should be none)
 */
const [cmd, arg] = process.argv.slice(2);
const { db, sqlite } = openDatabase();
const fail = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

try {
  if (cmd === 'backup' || cmd === 'backups') {
    const cfg = backupConfigFrom(process.env) ?? fail('Backups are not configured: set BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY.');
    if (cmd === 'backup') {
      const r = await runBackup(sqlite, cfg);
      console.log(`Saved ${r.key} (${Math.round(r.bytes / 1024)} KB). Deleted ${r.deleted.length} older than ${cfg.keepDays} days. ${r.kept} kept.`);
    } else {
      const all = (await listBackups(cfg)).sort((a, b) => (a.key < b.key ? 1 : -1));
      console.log(all.length ? all.map((o) => `${o.lastModified}  ${o.key}`).join('\n') : 'No backups yet.');
    }
  } else if (cmd === 'revoke-sessions') {
    if (arg) {
      const u = db.select({ id: users.id }).from(users).where(eq(users.email, arg.trim().toLowerCase())).get() ?? fail(`No account with the email ${arg}.`);
      console.log(`Ended ${db.delete(authSessions).where(eq(authSessions.userId, u.id)).run().changes} sessions for ${arg}.`);
    } else console.log(`Ended ${db.delete(authSessions).run().changes} sessions. Everyone signs in again.`);
  } else if (cmd === 'revoke-health-tokens') {
    console.log(`Revoked ${db.update(healthDevices).set({ revokedAt: new Date().toISOString() }).run().changes} Apple Health device tokens. Each phone reconnects in Settings.`);
  } else if (cmd === 'audit') {
    if (!arg) fail('Usage: node dist/ops.js audit <email>');
    const u = db.select({ id: users.id }).from(users).where(eq(users.email, arg!.trim().toLowerCase())).get() ?? fail(`No account with the email ${arg}.`);
    const rows = db.select().from(auditLog).where(eq(auditLog.userHash, userHash(u.id))).orderBy(desc(auditLog.at)).limit(200).all();
    console.log(rows.length ? rows.map((r) => `${r.at}  ${r.event}${r.detail ? `  ${r.detail}` : ''}`).join('\n') : 'No security log rows for that account.');
  } else if (cmd === 'tables') {
    const known = (Object.values(schema) as unknown[]).filter((t): t is SQLiteTable => t instanceof SQLiteTable).map((t) => getTableName(t));
    const extra = unknownTables(sqlite, known);
    console.log(extra.length ? `Tables the schema does not know: ${extra.join(', ')}` : 'Every table is one the schema knows.');
  } else fail('Usage: node dist/ops.js backup | backups | revoke-sessions [email] | revoke-health-tokens | audit <email> | tables');
} finally {
  sqlite.close();
}
