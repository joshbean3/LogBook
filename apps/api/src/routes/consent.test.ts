import { CONSENT_VERSION, DEFAULT_CONSENT, today } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { userSettings } from '../db/schema.js';
import { assistantMayReadTraining, mayPickReads, mayWriteRecall, readConsentLog } from '../services/consent.js';

let app: ReturnType<typeof buildApp>;
let db: DB;
const T = today();
const req = async (method: string, url: string, body?: unknown, cookie = '') => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, 'x-local-date': T }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0]! };
};

beforeEach(() => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  env.allowSignup = true;
});

describe('consent', () => {
  it('stores the choice made before the account existed, and Settings reads and changes it', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'a@example.com', password: 'correct horse 42', consent: { training: false } });
    expect(su.status).toBe(201);
    const got = await req('GET', '/api/me/consent', undefined, su.cookie);
    expect(got.body.consent).toMatchObject({ training: false, recall: false, reads: false, health: null, version: CONSENT_VERSION });
    expect(typeof got.body.consent.at).toBe('string');
    expect(assistantMayReadTraining(db, su.body.id)).toBe(false);

    const put = await req('PUT', '/api/me/consent', { training: true, version: '2026-11' }, su.cookie);
    expect(put.body.consent).toMatchObject({ training: true, recall: false, reads: false, health: null, version: '2026-11' });
    expect(assistantMayReadTraining(db, su.body.id)).toBe(true);
    expect((await req('PUT', '/api/me/consent', { training: 'yes' }, su.cookie)).status).toBe(422);
  });

  it('a new account has granted nothing and was never asked; sign-up with no choice stores nothing', async () => {
    expect(DEFAULT_CONSENT).toEqual({ training: false, recall: false, reads: false, health: null, at: null, version: null });
    const su = await req('POST', '/api/auth/signup', { email: 'b@example.com', password: 'correct horse 42' });
    expect(su.status).toBe(201);
    expect((await req('GET', '/api/me/consent', undefined, su.cookie)).body.consent).toEqual({ training: false, health: null, recall: false, reads: false, at: null, version: null });
    expect(db.select().from(userSettings).where(eq(userSettings.userId, su.body.id)).all().filter((r) => r.key === 'consent' || r.key === 'consentLog')).toEqual([]);
    expect(assistantMayReadTraining(db, su.body.id)).toBe(false);
    expect(mayWriteRecall(db, su.body.id)).toBe(false);
    expect(mayPickReads(db, su.body.id)).toBe(false);
  });

  it('takes any subset of the switches, keeps the rest, and a body with no switch is not an answer', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'c2@example.com', password: 'correct horse 42' });
    // version alone is not a choice: still never asked
    expect((await req('PUT', '/api/me/consent', { version: '2026-11' }, su.cookie)).body.consent.at).toBeNull();
    expect((await req('PUT', '/api/me/consent', {}, su.cookie)).body.consent.at).toBeNull();
    const one = await req('PUT', '/api/me/consent', { recall: true }, su.cookie);
    expect(one.body.consent).toMatchObject({ training: false, recall: true, reads: false, health: null });
    const two = await req('PUT', '/api/me/consent', { reads: true, health: false }, su.cookie);
    expect(two.body.consent).toMatchObject({ training: false, recall: true, reads: true, health: false });
    expect(mayWriteRecall(db, su.body.id)).toBe(true);
    expect(mayPickReads(db, su.body.id)).toBe(true);
    expect(assistantMayReadTraining(db, su.body.id)).toBe(false);
  });

  it('the bootstrap carries the same record as GET /me/consent', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'boot@example.com', password: 'correct horse 42' });
    const fresh = (await req('GET', '/api/bootstrap', undefined, su.cookie)).body.consent;
    expect(fresh).toEqual({ training: false, recall: false, reads: false, health: null, at: null, version: null });
    await req('PUT', '/api/me/consent', { training: true, reads: true }, su.cookie);
    const boot = (await req('GET', '/api/bootstrap', undefined, su.cookie)).body.consent;
    expect(boot).toEqual((await req('GET', '/api/me/consent', undefined, su.cookie)).body.consent);
    expect(boot).toMatchObject({ training: true, reads: true, recall: false });
  });

  it('appends every answer to the consent log: kind, value, when and the wording version', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'log@example.com', password: 'correct horse 42' });
    const id = su.body.id as string;
    expect(readConsentLog(db, id)).toEqual([]);
    // the first answer records each switch it carried, the ones declined too
    await req('PUT', '/api/me/consent', { training: true, recall: false, version: '2026-11' }, su.cookie);
    expect(readConsentLog(db, id).map(({ kind, value, version }) => ({ kind, value, version }))).toEqual([
      { kind: 'training', value: true, version: '2026-11' },
      { kind: 'recall', value: false, version: '2026-11' },
    ]);
    // after that only what changed is appended, and nothing earlier is touched
    await req('PUT', '/api/me/consent', { training: true }, su.cookie);
    expect(readConsentLog(db, id)).toHaveLength(2);
    await req('PUT', '/api/me/consent', { training: false, reads: true }, su.cookie);
    const log = readConsentLog(db, id);
    expect(log.map((e) => `${e.kind}:${e.value}`)).toEqual(['training:true', 'recall:false', 'training:false', 'reads:true']);
    for (const e of log) {
      expect(Number.isNaN(Date.parse(e.at))).toBe(false);
      expect(e.version).toBe(CONSENT_VERSION);
    }
  });

  it('needs a session', async () => {
    expect((await req('GET', '/api/me/consent')).status).toBe(401);
  });
});

describe('feature intros', () => {
  it('shows nothing to an account that is not enrolled, and each sheet once to one that is', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'c@example.com', password: 'correct horse 42' });
    const c = su.cookie;
    expect((await req('GET', '/api/me/intros', undefined, c)).body).toEqual({ seen: null });
    // marking a key on an account that is not enrolled enrolls nothing
    expect((await req('POST', '/api/me/intros/seen', { key: 'plan' }, c)).body).toEqual({ seen: null });
    expect((await req('POST', '/api/me/intros/enroll', undefined, c)).body).toEqual({ seen: [] });
    expect((await req('POST', '/api/me/intros/seen', { key: 'plan' }, c)).body).toEqual({ seen: ['plan'] });
    expect((await req('POST', '/api/me/intros/seen', { key: 'plan' }, c)).body).toEqual({ seen: ['plan'] });
    // enrolling again keeps what was seen
    expect((await req('POST', '/api/me/intros/enroll', undefined, c)).body).toEqual({ seen: ['plan'] });
    expect((await req('POST', '/api/me/intros/seen', { key: 'goals' }, c)).status).toBe(422);
  });
});
