import { mondayOf, shiftDays, today } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../test/helpers.js';
import { readConsent } from '../services/consent.js';
import { goals, habitChecks, habits, journalEntries, users } from './schema.js';
import { REVIEW_NAME, seedReviewAccount } from './seed-review.js';

/** The App Review demo account (gap-sub-48) and its health days surviving a real phone (critic-09). */
const T = today();
const EMAIL = 'review@logbook.test';
const PASSWORD = 'sample review 2026';

const login = async (app: ReturnType<typeof makeApp>['app']) => {
  const res = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  expect(res.status).toBe(200);
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  return async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: (await r.json()) as any };
  };
};

describe('seed:review', () => {
  it('builds an onboarded account with six weeks of plan, marks, habits, goals, journal lines and health days', async () => {
    const { app, db } = makeApp();
    const r = await seedReviewAccount(db, { email: EMAIL, password: PASSWORD });
    expect(r.marked).toBeGreaterThanOrEqual(9);
    expect(r.sessions).toBeGreaterThan(30);
    expect(r.healthDays).toBe(42);
    const call = await login(app);
    const boot = (await call('GET', '/api/bootstrap')).body;
    expect(boot.user).toMatchObject({ email: EMAIL, name: REVIEW_NAME, onboardedAt: expect.any(String) });
    expect(boot.blocks).toHaveLength(1);
    expect(boot.habits).toHaveLength(4);
    expect(db.select().from(habitChecks).where(eq(habitChecks.userId, r.userId)).all().length).toBeGreaterThan(100);
    expect(db.select().from(goals).where(eq(goals.userId, r.userId)).all().map((g) => g.period)).toContain(mondayOf(T));
    expect(db.select().from(journalEntries).where(eq(journalEntries.userId, r.userId)).all()).toHaveLength(8);
    const month = (await call('GET', `/api/months/${shiftDays(T, -10).slice(0, 7)}`)).body;
    expect(month.sessions.some((s: { mark: string | null }) => s.mark === 'done')).toBe(true);
    // consent was never answered: the permission step shows
    expect(readConsent(db, r.userId).at).toBeNull();
    expect(boot.consent.at).toBeNull();
  }, 30_000);

  it('can be run again: one account, rebuilt, nothing doubled', async () => {
    const { db } = makeApp();
    await seedReviewAccount(db, { email: EMAIL, password: PASSWORD });
    const again = await seedReviewAccount(db, { email: EMAIL, password: PASSWORD });
    expect(db.select().from(users).where(eq(users.email, EMAIL)).all()).toHaveLength(1);
    expect(db.select().from(habits).all()).toHaveLength(4);
    expect(db.select().from(habits).all().every((h) => h.userId === again.userId)).toBe(true);
    await expect(seedReviewAccount(db, { email: EMAIL, password: 'password123' })).rejects.toThrow(/too common/);
  }, 30_000);

  it('the seeded health days are read with no phone connected, and survive a connect, an empty sync and an empty reconcile (critic-09)', async () => {
    const { app, db } = makeApp();
    await seedReviewAccount(db, { email: EMAIL, password: PASSWORD });
    const call = await login(app);
    const from = shiftDays(T, -14);
    const to = shiftDays(T, -1);
    const read = async () => (await call('GET', `/api/apple-health/daily?from=${from}&to=${to}&tz=America/New_York`)).body.days as Array<{ date: string; sleepMin: number | null; hrvMs: number | null; restingHr: number | null }>;
    const before = await read();
    expect(before).toHaveLength(14);
    for (const d of before) {
      expect(d.sleepMin, d.date).toBeGreaterThan(380);
      expect(d.hrvMs, d.date).toBeGreaterThan(40);
      expect(d.restingHr, d.date).toBeGreaterThan(45);
    }
    // a reviewer connects a phone that holds no readings
    const { token } = (await call('POST', '/api/apple-health/connect', { deviceName: 'iPhone', historyDays: 90 })).body;
    const device = { authorization: `Bearer ${token}` };
    expect((await call('POST', '/api/apple-health/sync', { batchId: 'empty-batch-1', payloadVersion: 1 }, device)).status).toBe(200);
    for (const kind of ['sleep', 'hrv', 'resting_hr']) expect((await call('POST', '/api/apple-health/reconcile', { kind, from: `${shiftDays(T, -90)}T00:00:00Z`, to: `${T}T23:59:59Z`, uuids: [] }, device)).status).toBe(200);
    // and one that holds other readings: still the samples stay
    expect((await call('POST', '/api/apple-health/reconcile', { kind: 'hrv', from: `${shiftDays(T, -90)}T00:00:00Z`, to: `${T}T23:59:59Z`, uuids: ['11111111-1111-4111-8111-111111111111'] }, device)).status).toBe(200);
    expect(await read()).toEqual(before);
  }, 30_000);
});
