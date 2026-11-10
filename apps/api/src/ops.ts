import { eq } from 'drizzle-orm';
import { openDatabase } from './db/index.js';
import { authSessions, healthDevices, users } from './db/schema.js';
import { backupConfigFrom, listBackups, runBackup } from './services/backup.js';

/**
 * Operator commands, run on the server (apps/api/RUNBOOK.md):
 *   node dist/ops.js backup                      take a backup now and apply the retention window
 *   node dist/ops.js backups                     list the remote copies
 *   node dist/ops.js revoke-sessions             sign every account out everywhere
 *   node dist/ops.js revoke-sessions <email>     sign one account out everywhere
 *   node dist/ops.js revoke-health-tokens        make every phone reconnect Apple Health
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
  } else fail('Usage: node dist/ops.js backup | backups | revoke-sessions [email] | revoke-health-tokens');
} finally {
  sqlite.close();
}
