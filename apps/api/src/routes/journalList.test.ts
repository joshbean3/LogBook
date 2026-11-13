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

describe('GET /journal/months', () => {
  it('counts a day once whether it holds a line, an entry or both, and keeps each kind’s count', async () => {
    const month = T.slice(0, 7);
    const first = `${month}-01`;
    const days = [first, shiftDays(first, 1), shiftDays(first, 2)].filter((d) => d <= T);
    // day one: a line and two entries; day two (when it has come): a line only; day three: an entry only
    await me.call('POST', '/api/learnings', { date: days[0], text: 'A line.' });
    await me.call('POST', '/api/journal', { date: days[0], text: 'An entry.' });
    await me.call('POST', '/api/journal', { date: days[0], text: 'Another entry.' });
    if (days[1]) await me.call('POST', '/api/learnings', { date: days[1], text: 'A second line.' });
    if (days[2]) await me.call('POST', '/api/journal', { date: days[2], text: 'A third day.' });
    // an earlier month with one entry, and things deleted or someone else’s that must not count
    const before = shiftDays(first, -3);
    await me.call('POST', '/api/journal', { date: before, text: 'Last month.' });
    const gone = (await me.call('POST', '/api/journal', { date: shiftDays(first, -40), text: 'Deleted.' })).body.id;
    await me.call('DELETE', `/api/journal/${gone}`);
    const other = await signUp(app, 'months2@example.com');
    await other.call('POST', '/api/learnings', { date: days[0], text: 'Not mine.' });

    const { months } = (await me.call('GET', '/api/journal/months')).body;
    expect(months).toEqual([
      { month, days: days.length, lines: Math.min(2, days.length), entries: days[2] ? 3 : 2 },
      { month: before.slice(0, 7), days: 1, lines: 0, entries: 1 },
    ]);
    expect((await other.call('GET', '/api/journal/months')).body.months).toEqual([{ month, days: 1, lines: 1, entries: 0 }]);
  });

  it('is empty for an account with nothing written', async () => {
    expect((await me.call('GET', '/api/journal/months')).body).toEqual({ months: [] });
  });
});
