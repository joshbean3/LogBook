import { mondayOf, shiftDays, today, zAssistantAsk } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { activities, planBlocks, trainingSessions } from '../db/schema.js';
import { fakeClaude, grantAll, makeApp, signUp, type Account, type App } from '../test/helpers.js';
import { writeConsent } from './consent.js';
import { blockInView, contextFor, kindOf, screenLine } from './assistant.js';

/**
 * The assistant inside a plan's summary (layout plan 2.4, server work): the plan in view goes as context, the session
 * window widens to hold it (one list, capped at 200), another user's block is ignored, nothing from Strava goes, and a
 * change applied from there joins the plan and marks it revised, with Undo putting it all back.
 */
const T = today();
let app: App;
let db: DB;
let me: Account;
let restore: (() => void) | null = null;

/** A plan from the plan builder's apply route, starting next Monday and running `weeks` weeks with `perWeek` runs a week. */
const makePlan = async (who: Account, weeks: number, perWeek = 3, name = 'Half marathon') => {
  const start = shiftDays(mondayOf(T), 7);
  const end = shiftDays(start, weeks * 7 - 1);
  const sessions = [];
  for (let w = 0; w < weeks; w++) for (let i = 0; i < perWeek; i++) sessions.push({ date: shiftDays(start, w * 7 + i), kind: 'run', type: 'Easy', title: `Easy ${w + 3}`, details: null, miles: w + 3, minutes: null });
  const r = await who.call('POST', '/api/plans/apply', { draft: { name, summary: 'Base, then build.', notes: [], start, end, sessions }, mode: 'add', source: 'describe' });
  expect(r.status).toBe(201);
  return r.body.block as { id: string; name: string; start: string; end: string };
};

beforeEach(async () => {
  ({ app, db } = makeApp());
  me = await signUp(app, 'plan-view@example.com');
  grantAll(db, me.id);
});
afterEach(() => {
  restore?.();
  restore = null;
});

describe('the plan in view', () => {
  it('names the plan in the SCREEN line, and reads the kind from the screen', async () => {
    const b = await makePlan(me, 2);
    const row = blockInView(db, me.id, { tab: 'plan', plan: b.id })!;
    expect(screenLine({ tab: 'plan', plan: b.id }, row)).toBe(`SCREEN: The user opened you from the summary of their plan Half marathon (${b.start} to ${b.end}). Read "this plan", "it" and "the plan" against it.`);
    // without the block (gone, or someone else's) it falls back to the screen's name alone
    expect(screenLine({ tab: 'plan', plan: b.id }, null)).toContain('Plan summary');
    expect(kindOf(undefined, { tab: 'plan', plan: b.id })).toBe('plan_change');
    expect(kindOf(undefined, { tab: 'plan', week: mondayOf(T) })).toBe('chat');
    expect(kindOf('chat', { tab: 'plan', plan: b.id })).toBe('chat');
    // the request's kind is a closed list a later mode joins; an unknown kind is refused
    const turns = [{ role: 'user', text: 'hi' }];
    expect(zAssistantAsk.safeParse({ date: T, kind: 'plan_change', turns }).success).toBe(true);
    expect(zAssistantAsk.safeParse({ date: T, kind: 'coach_research', turns }).success).toBe(false);
  });

  it('sends the plan, its weekly miles and the training answers, and widens the sessions to the whole plan', async () => {
    await me.call('PATCH', '/api/me/training', { goal: 'half', raceDate: shiftDays(T, 120), runDays: ['tue', 'thu', 'sat'], longRunDay: 'sat', weeklyMiles: 20 });
    const b = await makePlan(me, 10);
    const near = contextFor(db, me.id, T, T, { tab: 'plan', week: mondayOf(T) });
    const ctx = contextFor(db, me.id, T, T, { tab: 'plan', plan: b.id });
    expect(near).not.toContain('PLAN IN VIEW');
    expect(ctx).toContain(`PLAN IN VIEW: Half marathon, ${b.start} to ${b.end} (made by: describe).`);
    expect(ctx).toMatch(/PLANNED MILES BY WEEK: week 1 \(\d{4}-\d{2}-\d{2}\): 9 mi; week 2/);
    expect(ctx).toContain('TRAINING ANSWERS: goal half marathon');
    expect(ctx).toContain('runs on Tue, Thu, Sat; long run on Sat');
    // the plan's last week is past the usual four weeks ahead: in view, it is listed; otherwise not
    expect(ctx).toContain(`SESSIONS ${shiftDays(mondayOf(T), -7)} to ${b.end}`);
    expect(ctx.match(/Easy 12/g)?.length).toBe(3);
    expect(near).not.toContain('Easy 12');
    // one list: no session line is sent twice
    const lines = ctx.split('\n').filter((l) => l.startsWith('- p'));
    expect(new Set(lines).size).toBe(lines.length);
  });

  it('caps the session list at 200, keeping the rows nearest today, and says how many more there are', async () => {
    const b = await makePlan(me, 30, 7);
    const ctx = contextFor(db, me.id, T, T, { tab: 'plan', plan: b.id });
    const lines = ctx.split('\n').filter((l) => /^- \S+ \| \d{4}-/.test(l));
    expect(lines).toHaveLength(200);
    expect(ctx).toContain('(10 more not listed: use get_sessions for them)');
    // the nearest weeks stay; the plan's very last day is one of those left out
    expect(ctx).toContain(`| ${b.start} `);
    expect(lines.some((l) => l.includes(`| ${b.end} `))).toBe(false);
  });

  it('ignores a plan block that belongs to another user', async () => {
    const other = await signUp(app, 'someone-else@example.com');
    grantAll(db, other.id);
    const theirs = await makePlan(other, 2, 3, 'Their secret plan');
    expect(blockInView(db, me.id, { tab: 'plan', plan: theirs.id })).toBeNull();
    const ctx = contextFor(db, me.id, T, T, { tab: 'plan', plan: theirs.id });
    expect(ctx).not.toContain('PLAN IN VIEW');
    expect(ctx).not.toContain('Their secret plan');
    expect(ctx).not.toContain(theirs.id);
  });

  it('with training data off, sends no plan at all', async () => {
    const b = await makePlan(me, 2);
    writeConsent(db, me.id, { training: false });
    const ctx = contextFor(db, me.id, T, T, { tab: 'plan', plan: b.id });
    expect(ctx).toContain('turned off reading their training data');
    expect(ctx).not.toContain('PLAN IN VIEW');
    expect(ctx).not.toContain('Half marathon');
  });

  it('never carries Strava data, even for a user with synced runs inside the plan', async () => {
    const b = await makePlan(me, 2);
    const now = new Date().toISOString();
    for (let i = 0; i < 3; i++)
      db.insert(activities)
        .values({ id: `9911${i}`, userId: me.id, date: shiftDays(b.start, i), time: '07:00', name: `Morning Strava jog ${i}`, sportType: 'Run', kind: 'run', distanceM: 8123, movingSec: 2468, elapsedSec: 2500, elevM: 37, avgHr: 151, maxHr: 177, cadence: 171, polyline: 'zzpolyzz', lapsJson: '[[1609,480,150]]', deletedAt: null, updatedAt: now, perfAt: null, perfFailed: 0 })
        .run();
    const ctx = contextFor(db, me.id, T, T, { tab: 'plan', plan: b.id });
    for (const s of ['Morning Strava jog', '9911', 'zzpolyzz', '8123', '2468', 'sportType', 'avgHr', '151', '177']) expect(ctx).not.toContain(s);
  });
});

describe('a change asked from the summary', () => {
  it('goes with the plan as context, joins the plan on Apply, marks it revised, and Undo puts every part back', async () => {
    const b = await makePlan(me, 2);
    const first = db.select().from(trainingSessions).where(eq(trainingSessions.blockId, b.id)).all()[0]!;
    const addOn = shiftDays(b.start, 4);
    const fake = fakeClaude({
      assistant: [
        [
          { type: 'text', text: 'Here is the change.' },
          { type: 'tool_use', id: 'tu1', name: 'propose_changes', input: { summary: 'Move the first run and add a strides day.', changes: [{ op: 'move_session', id: first.id, to: shiftDays(first.date, 1) }, { op: 'add_session', date: addOn, kind: 'run', type: 'Easy', title: 'Strides 3', miles: 3 }] } },
        ],
      ],
    });
    restore = fake.restore;
    const asked = await me.call('POST', '/api/assistant', { date: T, screen: { tab: 'plan', plan: b.id }, turns: [{ role: 'user', text: 'Add a strides day on Friday and move the first run a day later.' }] });
    expect(asked.status).toBe(200);
    expect(asked.body.proposal).toMatchObject({ status: 'proposed', summary: 'Move the first run and add a strides day.' });
    expect(fake.sent()).toContain('PLAN IN VIEW: Half marathon');
    expect(fake.sent()).toContain('summary of their plan Half marathon');

    const applied = await me.call('POST', `/api/assistant/${asked.body.proposal.id}/apply`);
    expect(applied.status).toBe(200);
    const added = db.select().from(trainingSessions).where(eq(trainingSessions.title, 'Strides 3')).get()!;
    expect(added.blockId).toBe(b.id);
    expect(db.select().from(planBlocks).where(eq(planBlocks.id, b.id)).get()!.source).toBe('revise');
    expect(db.select().from(trainingSessions).where(eq(trainingSessions.id, first.id)).get()!.date).toBe(shiftDays(first.date, 1));
    // the bootstrap the Plan tab reads says the same
    expect((await me.call('GET', '/api/bootstrap')).body.blocks.find((x: { id: string }) => x.id === b.id).source).toBe('revise');

    const undone = await me.call('POST', `/api/assistant/${asked.body.proposal.id}/undo`);
    expect(undone.status).toBe(200);
    expect(db.select().from(planBlocks).where(eq(planBlocks.id, b.id)).get()!.source).toBe('describe');
    expect(db.select().from(trainingSessions).where(eq(trainingSessions.id, added.id)).get()!.deletedAt).not.toBeNull();
    expect(db.select().from(trainingSessions).where(eq(trainingSessions.id, first.id)).get()!.date).toBe(first.date);
  });

  it('from the dock, an added session stays outside any plan (the plan is only remembered from its summary)', async () => {
    const b = await makePlan(me, 2);
    const fake = fakeClaude({ assistant: [[{ type: 'tool_use', id: 'tu1', name: 'propose_changes', input: { summary: 'Add a run.', changes: [{ op: 'add_session', date: shiftDays(b.start, 4), kind: 'run', title: 'Dock run 3', miles: 3 }] } }]] });
    restore = fake.restore;
    const asked = await me.call('POST', '/api/assistant', { date: T, turns: [{ role: 'user', text: 'Add a run on Friday next week.' }] });
    await me.call('POST', `/api/assistant/${asked.body.proposal.id}/apply`);
    expect(db.select().from(trainingSessions).where(eq(trainingSessions.title, 'Dock run 3')).get()!.blockId).toBeNull();
    expect(fake.sent()).not.toContain('PLAN IN VIEW');
  });
});
