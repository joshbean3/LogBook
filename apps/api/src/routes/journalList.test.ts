import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

const T = today();
let app: App;
let me: Account;
beforeEach(async () => {
  ({ app } = makeApp());
  me = await signUp(app, 'journal@example.com');
});

describe('GET /journal', () => {
  it('returns total alongside the page: every entry that matches, whatever page this is', async () => {
    for (let i = 0; i < 7; i++) await me.call('POST', '/api/journal', { date: shiftDays(T, -i), text: i % 2 ? `Odd day ${i}` : `Even tempo day ${i}` });
    const gone = (await me.call('POST', '/api/journal', { date: T, text: 'Deleted tempo entry' })).body.id;
    await me.call('DELETE', `/api/journal/${gone}`);
    const other = await signUp(app, 'journal2@example.com');
    await other.call('POST', '/api/journal', { date: T, text: 'Someone else, tempo' });

    const page1 = (await me.call('GET', '/api/journal?limit=3')).body;
    expect(page1.entries).toHaveLength(3);
    expect(page1).toMatchObject({ more: true, total: 7 });
    // the next page (by the cursor) still reports the whole count, not what is left
    const page2 = (await me.call('GET', `/api/journal?limit=3&before=${encodeURIComponent(page1.entries.at(-1).createdAt)}`)).body;
    expect(page2.total).toBe(7);
    // a search counts its own matches
    expect((await me.call('GET', '/api/journal?q=tempo&limit=2')).body).toMatchObject({ total: 4, more: true });
    const fav = page1.entries[0].id;
    await me.call('PATCH', `/api/journal/${fav}`, { fav: true });
    expect((await me.call('GET', '/api/journal?fav=1')).body).toMatchObject({ total: 1, more: false });
    expect((await other.call('GET', '/api/journal')).body.total).toBe(1);
  });

  it('is zero for an empty journal', async () => {
    expect((await me.call('GET', '/api/journal')).body).toEqual({ entries: [], more: false, total: 0 });
  });
});
