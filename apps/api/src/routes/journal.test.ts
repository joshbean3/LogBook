import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

const T = today();
let app: App;
let me: Account;
beforeEach(async () => {
  ({ app } = makeApp());
  me = await signUp(app, 'journal-offset@example.com');
});

describe('GET /journal offset', () => {
  it('pages by position in list order, so an entry written later for an older day still shows on page two', async () => {
    for (let i = 0; i < 4; i++) await me.call('POST', '/api/journal', { date: shiftDays(T, -i), text: `Day ${i}` });
    const page1 = (await me.call('GET', '/api/journal?limit=2')).body;
    expect(page1.entries.map((e: { text: string }) => e.text)).toEqual(['Day 0', 'Day 1']);
    // written now (latest createdAt) for a day older than page one's last day
    await new Promise((r) => setTimeout(r, 5));
    const late = (await me.call('POST', '/api/journal', { date: shiftDays(T, -10), text: 'Written late' })).body;

    const page2 = (await me.call('GET', '/api/journal?limit=2&offset=2')).body;
    expect(page2.entries.map((e: { text: string }) => e.text)).toEqual(['Day 2', 'Day 3']);
    expect(page2).toMatchObject({ more: true, total: 5 });
    const page3 = (await me.call('GET', '/api/journal?limit=2&offset=4')).body;
    expect(page3.entries.map((e: { id: string }) => e.id)).toEqual([late.id]);
    expect(page3).toMatchObject({ more: false, total: 5 });
    // offset wins over before: the cursor is ignored when both are sent
    const both = (await me.call('GET', `/api/journal?limit=2&offset=2&before=${encodeURIComponent(page1.entries.at(-1).createdAt)}`)).body;
    expect(both.entries.map((e: { text: string }) => e.text)).toEqual(['Day 2', 'Day 3']);
  });

  it('without offset keeps the createdAt cursor, which skips an entry written later', async () => {
    for (let i = 0; i < 3; i++) await me.call('POST', '/api/journal', { date: shiftDays(T, -i), text: `Day ${i}` });
    const page1 = (await me.call('GET', '/api/journal?limit=2')).body;
    await new Promise((r) => setTimeout(r, 5));
    await me.call('POST', '/api/journal', { date: shiftDays(T, -10), text: 'Written late' });
    const page2 = (await me.call('GET', `/api/journal?limit=2&before=${encodeURIComponent(page1.entries.at(-1).createdAt)}`)).body;
    // the old cursor: only entries created before page one's last one, so the late entry never shows
    expect(page2.entries.map((e: { text: string }) => e.text)).toEqual(['Day 0']);
    expect(page2.total).toBe(4);
  });

  it('rejects a negative offset', async () => {
    expect((await me.call('GET', '/api/journal?offset=-1')).status).toBe(422);
  });
});
