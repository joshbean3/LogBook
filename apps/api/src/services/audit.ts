import { lt } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import type { DB } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import { env } from '../env.js';
import { nowISO } from '../lib/util.js';

/**
 * The security log and the request log's account id.
 *
 * An account is never named in either: both carry `userHash`, a keyed hash of the account id (HMAC-SHA-256 under the
 * session secret, 16 hex characters). The same account always hashes to the same value, so an operator who knows an
 * account id can follow it (`node dist/ops.js audit <email>`), and a log line on its own names nobody.
 */
export const userHash = (userId: string): string => createHmac('sha256', env.SESSION_SECRET).update(`user:${userId}`).digest('hex').slice(0, 16);

/** What gets a row. `detail` is a few fixed words (which switch, which way), never anything a person typed. */
export type AuditEvent =
  | 'signup'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_reset_asked'
  | 'password_reset'
  | 'password_changed'
  | 'password_wrong'
  | 'email_verified'
  | 'consent'
  | 'account_deleted';

/** How long a row is kept. */
export const AUDIT_KEEP_DAYS = 365;

/** Write one row. Never throws: a full disk must not turn a sign-in into an error. */
export const audit = (db: DB, event: AuditEvent, userId: string | null, detail?: string | null): void => {
  try {
    db.insert(auditLog).values({ at: nowISO(), event, userHash: userId ? userHash(userId) : null, detail: detail ? detail.slice(0, 200) : null }).run();
  } catch (e) {
    console.error('[audit] could not write', event, e instanceof Error ? e.message : e);
  }
};

export const purgeAudit = (db: DB, now = Date.now()): number => db.delete(auditLog).where(lt(auditLog.at, new Date(now - AUDIT_KEEP_DAYS * 864e5).toISOString())).run().changes;
