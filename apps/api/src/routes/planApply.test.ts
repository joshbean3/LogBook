import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

/** POST /plans/apply answers what it removed, and POST /plans/template/undo puts it back (finding plan-02). */
const T = today();
let app: App;
let me: Account;
const sessionsIn = async (from: string, to: string) => {
  const months = [...new Set([from.slice(0, 7), to.slice(0, 7)])];
  const all: Array<{ id: string; date: string; title: string; mark: string | null }> = [];
  for (const m of months) all.push(...(await me.call('GET', `/api/months/${m}`)).body.sessions);
  return all.filter((s) => s.date >= from && s.date <= to);
};
const draftFor = (start: string, end: string, titles: string[]) => ({
  name: 'New plan',
  summary: 'Two weeks.',
  notes: [],
  start,
  end,
  sessions: titles.map((title, i) => ({ date: shiftDays(start, i), kind: 'run', type: 'Easy', title, details: null, miles: 4, minutes: null })),
});

beforeEach(async () => {
  ({ app } = makeApp());
  me = await signUp(app, 'apply@example.com');
});

describe('POST /plans/apply', () => {
  it('replace returns replacedIds, and the restore call brings exactly those back', async () => {
    const start = shiftDays(T, 3);
    const end = shiftDays(T, 16);
    const planned: string[] = [];
    for (let i = 0; i < 6; i++) planned.push((await me.call('POST', '/api/sessions', { date: shiftDays(start, i * 2), kind: 'run', title: `Old ${i}`, miles: 3 })).body.id);
    // one of them is already marked: history, which replace keeps
    await me.call('POST', `/api/sessions/${planned[0]}/mark`, { mark: 'skip' });
    const outside = (await me.call('POST', '/api/sessions', { date: shiftDays(end, 5), kind: 'run', title: 'Outside', miles: 3 })).body.id;

    const applied = await me.call('POST', '/api/plans/apply', { draft: draftFor(start, end, ['New A', 'New B']), mode: 'replace', source: 'describe' });
    expect(applied.status).toBe(201);
    expect([...applied.body.replacedIds].sort()).toEqual(planned.slice(1).sort());
    expect(applied.body.removed).toBe(5);
    expect(applied.body.endedBlocks).toEqual([]);
    expect((await sessionsIn(start, end)).map((s) => s.title).sort()).toEqual(['New A', 'New B', 'Old 0']);

    const undo = await me.call('POST', '/api/plans/template/undo', { blockId: applied.body.block.id, replacedIds: applied.body.replacedIds, endedBlocks: applied.body.endedBlocks });
    expect(undo.status).toBe(200);
    expect(undo.body).toMatchObject({ ok: true, removed: 2, restored: 5 });
    expect((await sessionsIn(start, end)).map((s) => s.title).sort()).toEqual(['Old 0', 'Old 1', 'Old 2', 'Old 3', 'Old 4', 'Old 5']);
    expect((await sessionsIn(shiftDays(end, 5), shiftDays(end, 5))).map((s) => s.id)).toEqual([outside]);
    expect((await me.call('GET', '/api/bootstrap')).body.blocks).toEqual([]);
  });

  it('add removes nothing and says so', async () => {
    const start = shiftDays(T, 3);
    await me.call('POST', '/api/sessions', { date: start, kind: 'run', title: 'Old', miles: 3 });
    const applied = await me.call('POST', '/api/plans/apply', { draft: draftFor(start, shiftDays(start, 6), ['New A']), mode: 'add' });
    expect(applied.body).toMatchObject({ replacedIds: [], removed: 0, endedBlocks: [] });
    expect((await sessionsIn(start, shiftDays(start, 6))).map((s) => s.title).sort()).toEqual(['New A', 'Old']);
  });

  it('only: what it cleared after the plan and the blocks it ended come back too', async () => {
    const start = shiftDays(T, 7);
    const end = shiftDays(T, 20);
    const first = await me.call('POST', '/api/plans/apply', { draft: draftFor(T, shiftDays(T, 30), ['First A', 'First B']), mode: 'add' });
    const later = (await me.call('POST', '/api/sessions', { date: shiftDays(end, 3), kind: 'run', title: 'After the end', miles: 3 })).body.id;
    const applied = await me.call('POST', '/api/plans/apply', { draft: draftFor(start, end, ['New A']), mode: 'replace', only: true });
    expect(applied.body.replacedIds).toEqual([later]);
    expect(applied.body.endedBlocks).toEqual([{ id: first.body.block.id, prevEnd: shiftDays(T, 30) }]);
    const undo = await me.call('POST', '/api/plans/template/undo', { blockId: applied.body.block.id, replacedIds: applied.body.replacedIds, endedBlocks: applied.body.endedBlocks });
    expect(undo.body).toMatchObject({ restored: 1, blocks: [first.body.block.id] });
    const blocks = (await me.call('GET', '/api/bootstrap')).body.blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ id: first.body.block.id, end: shiftDays(T, 30) });
  });

  it('never touches another account', async () => {
    const other = await signUp(app, 'apply2@example.com');
    const start = shiftDays(T, 3);
    const theirs = (await other.call('POST', '/api/sessions', { date: start, kind: 'run', title: 'Theirs', miles: 3 })).body.id;
    const applied = await me.call('POST', '/api/plans/apply', { draft: draftFor(start, shiftDays(start, 6), ['Mine']), mode: 'replace' });
    expect(applied.body.replacedIds).toEqual([]);
    expect((await other.call('GET', `/api/months/${start.slice(0, 7)}`)).body.sessions.map((s: { id: string }) => s.id)).toEqual([theirs]);
  });
});
