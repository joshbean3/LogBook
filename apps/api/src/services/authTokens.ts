import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type { DB } from '../db/index.js';
import { authTokens } from '../db/schema.js';
import { nowISO, uid } from '../lib/util.js';
import { RESET_MINUTES, VERIFY_DAYS } from './mail.js';

/**
 * The tokens in emailed links. A token is 32 random bytes; only its SHA-256 is stored, it works once, and it expires
 * (reset: 30 minutes, verify: 7 days). Asking for a new reset link cancels the earlier ones.
 */
export type TokenKind = 'reset' | 'verify';
const TTL_MS: Record<TokenKind, number> = { reset: RESET_MINUTES * 60_000, verify: VERIFY_DAYS * 864e5 };
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const issueToken = (db: DB, userId: string, kind: TokenKind, now = Date.now()): string => {
  const token = randomBytes(32).toString('base64url');
  db.transaction((tx) => {
    // one live link of a kind per account: the newest
    tx.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt))).run();
    tx.insert(authTokens).values({ id: uid('at'), userId, kind, tokenHash: hashToken(token), expiresAt: new Date(now + TTL_MS[kind]).toISOString(), usedAt: null, createdAt: new Date(now).toISOString() }).run();
  });
  return token;
};

/** Spend a token: the account it belongs to, or null when it is unknown, of another kind, used already or expired. */
export const consumeToken = (db: DB, token: string, kind: TokenKind, now = Date.now()): string | null => {
  if (!token || token.length > 200) return null;
  return db.transaction((tx) => {
    const row = tx.select().from(authTokens).where(eq(authTokens.tokenHash, hashToken(token))).get();
    if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date(now).toISOString()) return null;
    tx.update(authTokens).set({ usedAt: new Date(now).toISOString() }).where(eq(authTokens.id, row.id)).run();
    return row.userId;
  });
};

/** Drop tokens that can no longer be used (expired, or used more than a day ago). */
export const purgeTokens = (db: DB) => {
  const now = nowISO();
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  return db.delete(authTokens).where(or(lt(authTokens.expiresAt, now), lt(authTokens.usedAt, dayAgo))).run().changes;
};
