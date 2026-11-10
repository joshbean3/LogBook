import { today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { assistantMayReadTraining } from '../services/consent.js';

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
  it('stores the privacy page’s choice with the new account, and Settings reads and changes it', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'a@example.com', password: 'password123', consent: { training: false } });
    expect(su.status).toBe(201);
    const got = await req('GET', '/api/me/consent', undefined, su.cookie);
    expect(got.body.consent).toMatchObject({ training: false, health: null });
    expect(typeof got.body.consent.at).toBe('string');
    expect(assistantMayReadTraining(db, su.body.id)).toBe(false);

    const put = await req('PUT', '/api/me/consent', { training: true }, su.cookie);
    expect(put.body.consent).toMatchObject({ training: true, health: null });
    expect(assistantMayReadTraining(db, su.body.id)).toBe(true);
    expect((await req('PUT', '/api/me/consent', { training: 'yes' }, su.cookie)).status).toBe(422);
  });

  it('reads as the default (training on, health not asked) for an account that never chose', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'b@example.com', password: 'password123' });
    expect(su.status).toBe(201);
    expect((await req('GET', '/api/me/consent', undefined, su.cookie)).body.consent).toEqual({ training: true, health: null, recall: false, reads: false, at: null, version: null });
  });

  it('needs a session', async () => {
    expect((await req('GET', '/api/me/consent')).status).toBe(401);
  });
});

describe('feature intros', () => {
  it('shows nothing to an account that is not enrolled, and each sheet once to one that is', async () => {
    const su = await req('POST', '/api/auth/signup', { email: 'c@example.com', password: 'password123' });
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
