import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { bindRateLimitDb, checkLoginThrottle, checkRate, clearLoginThrottle, clientIp, failLogin, peekRate, purgeRateLimits, resetRateLimits } from './ratelimit.js';

let db: DB;
beforeEach(() => {
  db = openDatabase(':memory:').db;
  resetRateLimits(db);
  bindRateLimitDb(null);
});

describe('rate limits in the table', () => {
  it('counts per fixed window and refuses past the limit with the seconds left', () => {
    const t0 = 60_000 * 100;
    for (let i = 1; i <= 3; i++) expect(checkRate(db, 'k', 3, 60_000, t0 + i)).toMatchObject({ ok: true, count: i });
    const over = checkRate(db, 'k', 3, 60_000, t0 + 30_000);
    expect(over).toMatchObject({ ok: false, count: 3, retryAfterSec: 30 });
    // the next window starts clean
    expect(checkRate(db, 'k', 3, 60_000, t0 + 60_000)).toMatchObject({ ok: true, count: 1 });
  });

  it('survives a restart: the cache goes, the table remembers', () => {
    const t0 = 60_000 * 200;
    checkRate(db, 'r', 2, 60_000, t0);
    checkRate(db, 'r', 2, 60_000, t0 + 1);
    resetRateLimits(); // the in-memory cache only, as a restart would
    expect(checkRate(db, 'r', 2, 60_000, t0 + 2)).toMatchObject({ ok: false, count: 3 });
    // another process sees the same count without a cache of its own
    expect(peekRate(db, 'r', 2, 60_000, t0 + 3)).toMatchObject({ ok: false, count: 3 });
  });

  it('batches writes for a soft limit but still refuses at the limit', () => {
    const t0 = 60_000 * 300;
    for (let i = 1; i <= 25; i++) expect(checkRate(db, 's', 25, 60_000, t0 + i, { batch: 10 }).ok).toBe(true);
    // the table saw 1 + 10 + 10 = 21; the cache knows 25
    expect(peekRate(db, 's', 25, 60_000, t0 + 26).count).toBe(21);
    expect(checkRate(db, 's', 25, 60_000, t0 + 26, { batch: 10 }).ok).toBe(false);
  });

  it('the short form counts in the bound database', () => {
    bindRateLimitDb(db);
    const t0 = 60_000 * 400;
    checkRate('short', 5, 60_000, t0);
    expect(peekRate(db, 'short', 5, 60_000, t0 + 1).count).toBe(1);
  });

  it('the sign-in throttle: six failures close the minute, a success clears it', () => {
    for (let i = 0; i < 5; i++) failLogin(db, '1.2.3.4');
    expect(() => checkLoginThrottle(db, '1.2.3.4')).not.toThrow();
    failLogin(db, '1.2.3.4');
    expect(() => checkLoginThrottle(db, '1.2.3.4')).toThrow(/Too many attempts/);
    expect(() => checkLoginThrottle(db, '5.6.7.8')).not.toThrow();
    clearLoginThrottle(db, '1.2.3.4');
    expect(() => checkLoginThrottle(db, '1.2.3.4')).not.toThrow();
  });

  it('purges windows older than two days', () => {
    const now = Date.now();
    checkRate(db, 'old', 5, 60_000, now - 3 * 24 * 3600_000);
    checkRate(db, 'new', 5, 60_000, now);
    expect(purgeRateLimits(db, now)).toBe(1);
    resetRateLimits();
    expect(peekRate(db, 'new', 5, 60_000, now).count).toBe(1);
  });

  it('clientIp prefers Fly, then the first forwarded hop', () => {
    expect(clientIp(new Headers({ 'fly-client-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('9.9.9.9');
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1');
    expect(clientIp(new Headers({ 'cf-connecting-ip': '3.3.3.3' }))).toBe('3.3.3.3');
    expect(clientIp(new Headers())).toBe('local');
  });
});
