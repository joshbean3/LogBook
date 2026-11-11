import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

/**
 * What Plan's Add sheet relies on in `POST /sessions` (no new route: the app makes the session's id itself, so the row it
 * shows at once is the row the server keeps). The id is honored, a replay of the same create is the same row, the done
 * mark of a day already past and Undo name that id, and an id that is someone else's is refused without touching theirs.
 */
let app: App;
let me: Account;
const T = today();
const ID = 'pA1b2C3d4E5f6';
const month = async (who: Account, d: string) => (await who.call('GET', `/api/months/${d.slice(0, 7)}`)).body.sessions as Array<{ id: string; date: string; mark: string | null; title: string | null; miles: number | null }>;

beforeEach(async () => {
  ({ app } = makeApp());
  me = await signUp(app, 'me@example.com');
});

describe('a session added with an id made on the phone', () => {
  it('is created under that id, in any week, with or without a plan', async () => {
    const res = await me.call('POST', '/api/sessions', { id: ID, date: shiftDays(T, 9), kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: ID, date: shiftDays(T, 9), kind: 'run', type: 'Easy', miles: 4, minutes: null, blockId: null, mark: null });
    expect((await month(me, shiftDays(T, 9))).filter((s) => s.id === ID)).toHaveLength(1);
  });

  it('sent again (a replay from the outbox) is the same row, not a second one', async () => {
    const body = { id: ID, date: T, kind: 'lift', type: null, title: 'Strength A', details: 'Squat, Bench', miles: null, minutes: 45 };
    expect((await me.call('POST', '/api/sessions', body)).status).toBe(201);
    const again = await me.call('POST', '/api/sessions', body);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: ID, title: 'Strength A', details: 'Squat, Bench', minutes: 45 });
    expect((await month(me, T)).filter((s) => s.date === T)).toHaveLength(1);
  });

  it('a day already past takes its done mark under the same id, and the miles count', async () => {
    const d = shiftDays(T, -2);
    await me.call('POST', '/api/sessions', { id: ID, date: d, kind: 'run', type: 'Easy', miles: 5 });
    const marked = await me.call('POST', `/api/sessions/${ID}/mark`, { mark: 'done' });
    expect(marked.status).toBe(200);
    expect((await month(me, d)).find((s) => s.id === ID)).toMatchObject({ mark: 'done', miles: 5 });
  });

  it('Undo deletes it by that id, and a second session on the same day stays', async () => {
    await me.call('POST', '/api/sessions', { id: ID, date: T, kind: 'run', type: 'Easy', miles: 4 });
    const other = (await me.call('POST', '/api/sessions', { id: 'pZ9y8X7w6V5u4', date: T, kind: 'lift', title: 'Core' })).body;
    expect((await me.call('DELETE', `/api/sessions/${ID}`)).status).toBe(200);
    expect((await month(me, T)).filter((s) => s.date === T).map((s) => s.id)).toEqual([other.id]);
    // and nothing is left to delete twice
    expect((await me.call('DELETE', `/api/sessions/${ID}`)).status).toBe(404);
  });

  it('refuses an id that is someone else’s, and leaves their session as it was', async () => {
    const them = await signUp(app, 'them@example.com');
    await them.call('POST', '/api/sessions', { id: ID, date: T, kind: 'run', type: 'Long', miles: 9 });
    const res = await me.call('POST', '/api/sessions', { id: ID, date: T, kind: 'run', type: 'Easy', miles: 4 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('id_taken');
    expect(await month(me, T)).toHaveLength(0);
    expect((await month(them, T)).find((s) => s.id === ID)).toMatchObject({ miles: 9 });
  });

  it('refuses an id or a session that is not well formed', async () => {
    expect((await me.call('POST', '/api/sessions', { id: 'x'.repeat(41), date: T, kind: 'run', miles: 4 })).status).toBe(422);
    expect((await me.call('POST', '/api/sessions', { id: ID, date: 'tomorrow', kind: 'run', miles: 4 })).status).toBe(422);
    expect((await me.call('POST', '/api/sessions', { id: ID, date: T, kind: 'swim' })).status).toBe(422);
    expect(await month(me, T)).toHaveLength(0);
  });
});
