import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { acquireLease, leaseOf, purgeExpiredLeases, releaseLease, renewLease, withLease } from './leases.js';

let db: DB;
beforeEach(() => {
  db = openDatabase(':memory:').db;
});

describe('leases', () => {
  it('one holder at a time; the holder re-acquires; others wait for the expiry', () => {
    const t0 = 1_000_000;
    expect(acquireLease(db, 'job:x', 1000, 'a', t0)).toBe(true);
    expect(acquireLease(db, 'job:x', 1000, 'b', t0 + 10)).toBe(false);
    // mine: always
    expect(acquireLease(db, 'job:x', 1000, 'a', t0 + 500)).toBe(true);
    expect(leaseOf(db, 'job:x')).toMatchObject({ holder: 'a', expiresAt: t0 + 1500 });
    // expired: anyone
    expect(acquireLease(db, 'job:x', 1000, 'b', t0 + 1500)).toBe(true);
    expect(leaseOf(db, 'job:x')?.holder).toBe('b');
    expect(acquireLease(db, 'job:x', 1000, 'a', t0 + 1600)).toBe(false);
  });

  it('renew extends only a live lease of mine; release frees it at once', () => {
    const t0 = 5_000;
    acquireLease(db, 'm', 1000, 'a', t0);
    expect(renewLease(db, 'm', 5000, 'a', t0 + 100)).toBe(true);
    expect(leaseOf(db, 'm')?.expiresAt).toBe(t0 + 5100);
    expect(renewLease(db, 'm', 5000, 'b', t0 + 100)).toBe(false);
    // expired: a renew is refused (someone may be about to take it)
    expect(renewLease(db, 'm', 5000, 'a', t0 + 6000)).toBe(false);
    expect(releaseLease(db, 'm', 'b')).toBe(false);
    expect(releaseLease(db, 'm', 'a')).toBe(true);
    expect(leaseOf(db, 'm')).toBeNull();
    expect(acquireLease(db, 'm', 1000, 'b', t0 + 200)).toBe(true);
  });

  it('withLease runs once and releases unless asked to keep', () => {
    const r1 = withLease(db, 'w', 60_000, () => 42, { holder: 'a' });
    expect(r1).toEqual({ ran: true, result: 42 });
    expect(leaseOf(db, 'w')).toBeNull();
    const r2 = withLease(db, 'w', 60_000, () => 1, { holder: 'a', keep: true });
    expect(r2.ran).toBe(true);
    expect(withLease(db, 'w', 60_000, () => 2, { holder: 'b' })).toEqual({ ran: false });
    expect(leaseOf(db, 'w')?.holder).toBe('a');
  });

  it('the purge drops rows expired for over a day', () => {
    const now = Date.now();
    acquireLease(db, 'old', 1000, 'a', now - 3 * 24 * 3600_000);
    acquireLease(db, 'fresh', 1000, 'a', now);
    expect(purgeExpiredLeases(db, 24 * 3600_000, now)).toBe(1);
    expect(leaseOf(db, 'old')).toBeNull();
    expect(leaseOf(db, 'fresh')).not.toBeNull();
  });
});
