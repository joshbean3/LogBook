import Anthropic from '@anthropic-ai/sdk';
import { challengeSlots, challengeTitle, emptyRewards, mondayOf, reasonAllowed, shiftDays, today, type Aim, type ISODate, type Session, type Slot, type Todo } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { activities } from '../db/schema.js';
import { AI_LIMITS, logUser, resetAiLimits, setUsageSink } from '../services/aiLimits.js';
import { SAFETY_BLOCK } from '../services/aiSafety.js';
import { isPickable, PICK_SYSTEM, PICK_TIMEOUT_MS, PICK_TODOS_MAX, pickContext, pickMenu, type PickRecord } from '../services/challengePick.js';
import { writeConsent } from '../services/consent.js';
import { fakeClaude, grantAll, makeApp, signUpWithSlot, type Account, type App, type FakeClaudeOptions } from '../test/helpers.js';
import { writeSetting } from './core.js';

/**
 * "Ask the assistant to pick" (`POST /challenges/pick`): the slot in, one item of the rule's own menu and a checked
 * reason out. Every test reads what the fake Claude client received and what the route answered.
 */
const T = today();
const MON = mondayOf(T);
const GOAL = 'Send the Halvorsen report draft';
const TODOS = ['Book the dentist for Priya', 'Reply to the landlord about the lease'];
const HABIT = 'Floss before bed nightly';
const JOURNAL = 'Today I learned that slow mornings help';

let app: App;
let db: DB;
let me: Account;
let slot: Slot;
let claude: ReturnType<typeof fakeClaude> | null = null;
const answerWith = (o: FakeClaudeOptions = {}) => {
  claude?.restore();
  claude = fakeClaude(o);
  return claude;
};
const ask = (body: unknown = { slot: slot.key }, who: Account = me) => who.call('POST', '/api/challenges/pick', body, { 'x-local-date': T });
/** The one user message of the last request Claude received. */
const sentText = (c: ReturnType<typeof fakeClaude>) => String(c.calls.at(-1)!.params.messages[0].content);
const menuSent = (c: ReturnType<typeof fakeClaude>): Array<{ id: string; title: string }> => JSON.parse(/MENU[^\n]*\n<data>(.*)<\/data>/.exec(sentText(c))![1]!);

/** A day a person would recognise: a goal, two to-dos, a run planned, a habit, a journal line and a logged set. */
const seedDay = async (who: Account) => {
  expect((await who.call('PUT', `/api/goals/day/${T}`, { text: GOAL })).status).toBe(201);
  for (const text of TODOS) expect((await who.call('POST', '/api/todos', { text, date: T })).status).toBeLessThan(300);
  expect((await who.call('POST', '/api/sessions', { date: T, kind: 'run', type: 'Easy', title: 'Easy 4 by the canal', miles: 4 })).status).toBeLessThan(300);
  expect((await who.call('POST', '/api/habits', { name: HABIT })).status).toBeLessThan(300);
  expect((await who.call('POST', '/api/learnings', { date: T, text: JOURNAL })).status).toBeLessThan(300);
  expect((await who.call('POST', '/api/lifts', { date: T, exercise: 'Zercher squat', weight: 185, reps: 5 })).status).toBeLessThan(300);
};

beforeEach(async () => {
  ({ app, db } = makeApp());
  ({ account: me, slot } = await signUpWithSlot(app, 'day', T));
  grantAll(db, me.id);
  await seedDay(me);
});
afterEach(() => {
  claude?.restore();
  claude = null;
  setUsageSink(null);
});

describe('a pick', () => {
  it('answers the assistant’s item from the rule’s menu, with the rule’s target and the checked reason', async () => {
    const c = answerWith({ challenge: { item: 'list', reason: '  Two things are waiting on your list.  ' } });
    const r = await ask();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ item: 'list', target: 2, why: 'Two things are waiting on your list.', by: 'assistant' });
    expect(c.calls).toHaveLength(1);
  });

  it('sends the menu (ids and the rule’s titles), the open to-dos, the goals and this week’s session names, as data, with the safety rules, and asks for the fixed shape', async () => {
    const c = answerWith();
    expect((await ask()).status).toBe(200);
    const call = c.calls[0]!;
    expect(call.api).toBe('messages.create');
    expect(c.systemOf(call)).toBe(PICK_SYSTEM);
    expect(PICK_SYSTEM).toContain(SAFETY_BLOCK);
    const menu = menuSent(c);
    expect(menu).toEqual([
      { id: 'goal', title: 'Today’s goal, done' },
      { id: 'session:run', title: 'Today’s session, done' },
      { id: 'list', title: 'Clear this morning’s list' },
      { id: 'full', title: 'A full day' },
    ]);
    // the answer is an id and a reason, and the shape names the menu's ids (the route checks the id again itself)
    const schema = call.params.output_config.format.schema;
    expect(call.params.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
    expect(Object.keys(schema.properties)).toEqual(['item', 'reason']);
    expect(JSON.stringify(schema.properties.item)).toContain(JSON.stringify(menu.map((m) => m.id)).slice(1, -1).replace(/"/g, '\\"'));
    expect(schema.additionalProperties).toBe(false);
    const text = sentText(c);
    expect(text).toContain(`(${T}).`);
    expect(text).toContain(GOAL);
    for (const t of TODOS) expect(text).toContain(t);
    expect(text).toContain('Easy 4 by the canal');
    expect((text.match(/<data>/g) ?? []).length).toBe(2);
    expect(call.params.messages).toHaveLength(1);
    expect(PICK_TIMEOUT_MS).toBeLessThan(20_000);
  });

  it('sends nothing about the account, no habit, no journal line, no logged set and no row id', async () => {
    const c = answerWith();
    await ask();
    const sent = c.sent();
    for (const never of [me.id, me.email, HABIT, 'Floss', JOURNAL, 'slow mornings', 'Zercher', '185']) expect(sent, never).not.toContain(never);
    expect(sent).not.toMatch(/"id":"(todo|goal|sess|hab)/);
    // no habit item is on the menu that is sent, even with habits enough to make one for the phone
    await me.call('POST', '/api/habits', { name: 'Read ten pages' });
    await me.call('POST', '/api/habits', { name: 'Walk at lunch' });
    await ask();
    expect(menuSent(c).map((m) => m.id)).not.toContain('habits');
    for (const m of menuSent(c)) expect(isPickable(m.id), m.id).toBe(true);
  });

  it('sends at most 20 to-do texts, today’s list first, and never one that is done, deleted or for someday', async () => {
    for (let i = 0; i < 24; i++) await me.call('POST', '/api/todos', { text: `Extra errand number-${i}`, date: T });
    const done = (await me.call('POST', '/api/todos', { text: 'Already finished thing', date: T })).body;
    await me.call('PATCH', `/api/todos/${done.id}`, { doneOn: T });
    await me.call('POST', '/api/todos', { text: 'A someday dream', date: T, bucket: 'someday' });
    const c = answerWith();
    await ask();
    const ctx = JSON.parse(/WHAT THE PERSON HAS ON[^\n]*\n<data>(.*)<\/data>/.exec(sentText(c))![1]!) as { todos: string[]; goals: unknown[]; sessions: string[] };
    expect(ctx.todos).toHaveLength(PICK_TODOS_MAX);
    expect(ctx.todos).not.toContain('Already finished thing');
    expect(ctx.todos).not.toContain('A someday dream');
    expect(ctx.goals).toEqual([{ level: 'day', text: GOAL }]);
    expect(ctx.sessions).toEqual(['Easy 4 by the canal']);
  });

  it('logs one usage line under the challenge flow, with a hashed user and none of the menu, the texts or the answer', async () => {
    const lines: string[] = [];
    setUsageSink((l) => lines.push(l));
    answerWith({ challenge: { item: 'goal', reason: 'Your report draft is the day’s one big thing.' } });
    await ask();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ evt: 'ai_usage', flow: 'challenge', user: logUser(me.id), in: 120, out: 30 });
    for (const never of [GOAL, 'Halvorsen', ...TODOS, 'canal', 'report draft', 'goal', me.id]) expect(lines[0]!).not.toContain(never);
  });
});

describe('the gates', () => {
  it('an account that never answered the permission step: 403, and nothing is sent', async () => {
    const { account, slot: s } = await signUpWithSlot(app, 'day', T, 'never');
    await seedDay(account);
    const c = answerWith();
    const r = await ask({ slot: s.key }, account);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('consent_required');
    expect(c.calls).toHaveLength(0);
  });

  it('the training switch off: 403, and nothing is sent', async () => {
    writeConsent(db, me.id, { training: false });
    const c = answerWith();
    const r = await ask();
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('training_off');
    expect(c.calls).toHaveLength(0);
    // the other switches do not stand in for it
    writeConsent(db, me.id, { recall: true, reads: true });
    expect((await ask()).status).toBe(403);
    expect(c.calls).toHaveLength(0);
  });

  it('a body that carries anything but the slot is refused, and nothing is sent', async () => {
    const c = answerWith();
    expect((await ask({ slot: slot.key, menu: [{ item: 'run', target: 26 }] })).status).toBe(422);
    expect((await ask({ slot: slot.key, facts: { habitsDone: 3 } })).status).toBe(422);
    expect((await ask({ slot: 'challenge:d:tomorrow' })).status).toBe(422);
    expect((await ask({})).status).toBe(422);
    expect(c.calls).toHaveLength(0);
  });

  it('a slot that is not this account’s today: 404, and nothing is sent', async () => {
    const c = answerWith();
    const mine = new Set(challengeSlots(me.id, T, 2).map((s) => s.key));
    const other = [-1, 1, 2, 3, 4, 5, 6].map((n) => `challenge:d:${shiftDays(T, n)}`).find((k) => !mine.has(k))!;
    expect((await ask({ slot: other })).body.code).toBe('no_challenge');
    expect((await ask({ slot: `challenge:d:${shiftDays(T, 21)}` })).status).toBe(404);
    expect(c.calls).toHaveLength(0);
  });

  it('is rate limited: three in five minutes, then 429 and no request', async () => {
    const c = answerWith();
    expect(AI_LIMITS.challenge).toMatchObject({ window: 3, perDay: 6 });
    for (let i = 0; i < AI_LIMITS.challenge.window; i++) expect((await ask()).status).toBe(200);
    const r = await ask();
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('rate_limited');
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(c.calls).toHaveLength(AI_LIMITS.challenge.window);
  });

  it('without a key: 503 before anything is read', async () => {
    const r = await ask();
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('claude_not_configured');
  });

  it('the bootstrap says whether this server can be asked', async () => {
    expect((await me.call('GET', '/api/bootstrap')).body.features.challengePick).toBe(false);
    answerWith();
    expect((await me.call('GET', '/api/bootstrap')).body.features.challengePick).toBe(true);
  });
});

describe('an answer that is off comes back as the rule’s own pick, with no reason', () => {
  const rule = () => ({ item: expect.stringMatching(/^(goal|session:run|list|full)$/), target: expect.any(Number), by: 'rule' });
  const off: Array<[string, FakeClaudeOptions]> = [
    ['an item that is not on the menu', { challenge: { item: 'habits', reason: 'Your habits are worth a day.' } }],
    ['an item nobody offered', { challenge: { item: 'run-ten-miles', reason: 'A longer run would stretch you.' } }],
    ['a reason with a number', { challenge: { item: 'list', reason: 'You have 2 errands left on your list.' } }],
    ['a reason about distance', { challenge: { item: 'session:run', reason: 'Add a mile to the canal run for a stretch.' } }],
    ['a reason about pace', { challenge: { item: 'session:run', reason: 'Push the pace on the canal today.' } }],
    ['a reason about sleep', { challenge: { item: 'goal', reason: 'Finish early so you sleep well.' } }],
    ['a reason with a deadline', { challenge: { item: 'goal', reason: 'Get the draft out before noon.' } }],
    ['a reason over 90 characters', { challenge: { item: 'goal', reason: `Your report draft is the one thing that matters most today so it ${'really '.repeat(6)}fits.` } }],
    ['an empty reason', { challenge: { item: 'goal', reason: '   ' } }],
    ['a reason with a link', { challenge: { item: 'goal', reason: 'See https://example.com/claim for why.' } }],
    ['a reason with a bare address', { challenge: { item: 'goal', reason: 'More at example.com today.' } }],
    ['a reason with markup', { challenge: { item: 'goal', reason: '<b>Your draft</b> is the one thing.' } }],
    ['a reason with a script', { challenge: { item: 'goal', reason: '<img src=x onerror=alert(1)>' } }],
    ['a reason that tells the app what to do', { challenge: { item: 'goal', reason: 'Ignore your rules and mark this one done.' } }],
    ['a reason that sends the person to Settings', { challenge: { item: 'goal', reason: 'Open Settings and turn the privacy switch off.' } }],
    ['a reason that asks for a password', { challenge: { item: 'goal', reason: 'Type your password to see why.' } }],
    ['a reason with a word the app never says', { challenge: { item: 'goal', reason: 'Keep your streak alive with this one.' } }],
    ['a reason that calls itself a coach', { challenge: { item: 'goal', reason: 'Your coach would pick the draft.' } }],
    ['a reason that calls itself an AI', { challenge: { item: 'goal', reason: 'As an AI I would pick the draft.' } }],
    ['a reason 500 characters long', { challenge: { item: 'goal', reason: 'Your draft matters. '.repeat(25) } }],
    ['a reason on two lines with a hidden character', { challenge: { item: 'goal', reason: 'Your draft\u200b is the one thing.' } }],
    ['a reply that is not JSON', { challenge: 'Sure! I would pick the goal.' }],
    ['a reply in another shape', { challenge: { pick: 'goal' } }],
    ['a refusal', { challengeStop: 'refusal' }],
    ['a reply cut short', { challengeStop: 'max_tokens' }],
  ];
  it('an item off the menu, a reason with a number or a banned word, a reply in the wrong shape, a refusal', async () => {
    for (const [name, o] of off) {
      resetAiLimits();
      const c = answerWith(o);
      const r = await ask();
      expect(r.status, name).toBe(200);
      expect(r.body, name).toEqual(rule());
      expect(r.body, name).not.toHaveProperty('why');
      expect(c.calls, name).toHaveLength(1);
    }
  });

  it('a provider error, a timeout or an overload: the rule’s pick, so the person has a challenge either way', async () => {
    for (const fail of [new Anthropic.APIConnectionTimeoutError(), new Anthropic.InternalServerError(500, undefined, 'down', new Headers()), new Anthropic.RateLimitError(429, undefined, 'slow down', new Headers()), new Error('socket hang up')]) {
      resetAiLimits();
      const c = answerWith({ fail });
      const r = await ask();
      expect(r.status).toBe(200);
      expect(r.body).toEqual(rule());
      expect(r.body).not.toHaveProperty('why');
      expect(c.calls).toHaveLength(1);
    }
  });

  it('a menu of one item is no choice: the rule’s pick, and nothing is sent', async () => {
    const { account, slot: s } = await signUpWithSlot(app, 'day', T, 'one');
    grantAll(db, account.id);
    expect((await account.call('PUT', `/api/goals/day/${T}`, { text: GOAL })).status).toBe(201);
    // a goal alone: "Today's goal, done" and "A full day" are both on the menu, so mark it done to leave nothing
    const c = answerWith();
    await account.call('POST', '/api/sessions', { date: T, kind: 'run', title: 'Easy 3' });
    const goal = (await account.call('GET', '/api/goals')).body[0] as Aim;
    await account.call('PATCH', `/api/goals/${goal.id}`, { status: 'done' });
    const r = await ask({ slot: s.key }, account);
    expect(r.body).toEqual({ item: 'session:run', target: 1, by: 'rule' });
    expect(c.calls).toHaveLength(0);
  });
});

describe('what the menu is made from', () => {
  it('a session that is done only because a synced activity says so reads as not done: the request is the same with the activity as without', async () => {
    const c = answerWith();
    await ask();
    const before = JSON.stringify(c.calls[0]!.params);
    db.insert(activities)
      .values({ id: '13000000777', userId: me.id, date: T, time: '06:42', name: 'Foggy Towpath Shuffle', sportType: 'Run', kind: 'run', distanceM: 6437, movingSec: 2222, elapsedSec: 2301, elevM: 31.5, avgHr: 148, maxHr: 171, cadence: 176, polyline: null, lapsJson: null, deletedAt: null, updatedAt: new Date().toISOString(), perfAt: null, perfFailed: 0 })
      .run();
    // the app itself now shows the session as done
    const month = (await me.call('GET', `/api/months/${T.slice(0, 7)}`)).body;
    expect(month.activities.map((a: { name: string }) => a.name)).toContain('Foggy Towpath Shuffle');
    await ask();
    expect(JSON.stringify(c.calls[1]!.params)).toBe(before);
    expect(menuSent(c).map((m) => m.id)).toContain('session:run');
    for (const never of ['Foggy', 'Towpath', '6437', '2222', '2301', '06:42', '148', '171']) expect(c.sent(), never).not.toContain(never);
    // the person's own mark is what takes it off the menu
    const s = (month.sessions as Session[]).find((x) => x.date === T)!;
    await me.call('POST', `/api/sessions/${s.id}/mark`, { mark: 'done' });
    await ask();
    expect(menuSent(c).map((m) => m.id)).not.toContain('session:run');
  });

  it('with Fitness off no training item is offered or sent, and no session is named', async () => {
    expect((await me.call('PUT', '/api/me/prefs', { fitness: false, today: { habits: true, day: true, learned: true } })).status).toBe(200);
    const c = answerWith();
    expect((await ask()).status).toBe(200);
    expect(menuSent(c).map((m) => m.id)).toEqual(['goal', 'list', 'full']);
    const sent = c.sent().slice(c.sent().indexOf('"messages"'));
    for (const never of ['Easy 4', 'canal', 'session:']) expect(sent, never).not.toContain(never);
    expect(sentText(c)).toContain('"sessions":[]');
  });

  it('on a paused day there is no challenge: 404, and nothing is sent', async () => {
    expect((await me.call('PUT', '/api/me/status', { kind: 'sick', until: null }, { 'x-local-date': T })).status).toBe(200);
    const c = answerWith();
    const r = await ask();
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('no_challenge');
    expect(c.calls).toHaveLength(0);
  });

  it('with Orbs or challenges switched off there is no challenge: 404, and nothing is sent', async () => {
    const c = answerWith();
    for (const set of [{ on: false, cadence: 1 }, { on: true, cadence: 0 }]) {
      writeSetting(db, me.id, 'rewards', { ...emptyRewards(me.id, T), set: { ...emptyRewards(me.id, T).set, ...set } });
      expect((await ask()).status).toBe(404);
    }
    expect(c.calls).toHaveLength(0);
  });
});

// ---------- the menu itself, from a record (no database): the hard lines ----------
const NEVER_WORDS = /\b(miles?|km|kilometers?|distance|pace|faster|speed|weigh\w*|heavier|pounds?|lbs?|calories?|food|eat\w*|diet\w*|meals?|sleep\w*|pain\w*|sore|injur\w*|noon|midnight|deadline|o[’']clock|a\.m|p\.m|\d{1,2}:\d{2}|journal|lines?|to-dos?\b.*\d)\b/i;
const todo = (o: Partial<Todo>): Todo => ({ id: `t${Math.random()}`, text: 'A thing', note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: shiftDays(T, -40), doneOn: null, deletedOn: null, createdAt: '', ...o });
const sess = (date: ISODate, o: Partial<Session> = {}): Session => ({ id: `s${Math.random()}`, date, position: 0, kind: 'run', type: 'Easy', title: 'Easy', details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, effort: null, createdAt: '', updatedAt: '', ...o }) as Session;
const aim = (level: Aim['level'], period: string, status: Aim['status'] = 'open'): Aim => ({ id: `g${Math.random()}`, level, period, text: 'A goal', original: null, why: null, status, reflection: null, steps: [], createdAt: `${shiftDays(T, -40)}T08:00:00.000Z`, updatedAt: '', closedAt: null }) as Aim;
const record = (o: Partial<PickRecord> = {}): PickRecord => ({ today: T, fitness: true, status: null, sessions: [], todos: [], goals: [], startedOn: shiftDays(MON, -70), size: 'steady', on: true, ...o });
const daySlot: Slot = { key: `challenge:d:${T}`, kind: 'day', date: T, seed: 0 };
const weekSlot: Slot = { key: `challenge:w:${MON}`, kind: 'week', date: MON, seed: 0 };
const week = (n: number) => shiftDays(MON, -7 * n);

describe('the menu that is sent, by the rules alone', () => {
  it('a week with four weeks of record: days from the person’s own to-dos, marks and day goals, never a habit item or full days', () => {
    // each of the last four weeks: a to-do done on Monday and Tuesday, a session marked Wednesday, a day goal done Thursday
    const todos: Todo[] = [];
    const sessions: Session[] = [];
    const goals: Aim[] = [aim('week', MON)];
    for (let n = 1; n <= 4; n++) {
      todos.push(todo({ doneOn: week(n) }), todo({ doneOn: shiftDays(week(n), 1) }));
      sessions.push(sess(shiftDays(week(n), 2), { mark: 'done' }));
      goals.push(aim('day', shiftDays(week(n), 3), 'done'));
    }
    for (let i = 0; i < 3; i++) sessions.push(sess(shiftDays(MON, i * 2)));
    const menu = pickMenu(record({ todos, sessions, goals }), weekSlot);
    expect(menu).toEqual([
      { item: 'days', target: 4, floor: 3, base: 0 },
      { item: 'sessions', target: 2, floor: 1, base: 0 },
      { item: 'goal-week', target: 1, base: 0 },
    ]);
    expect(menu.map(challengeTitle)).toEqual(['Every day this week, three days off', 'Every planned session but one', 'This week’s goal, done']);
  });

  it('a new account (under 28 days) is offered only the items that need no number', () => {
    const menu = pickMenu(record({ startedOn: shiftDays(T, -10), sessions: [sess(MON), sess(shiftDays(MON, 2))], goals: [aim('week', MON)] }), weekSlot);
    expect(menu.map((o) => o.item)).toEqual(['sessions', 'goal-week']);
  });

  it('a session unmarked on a day in a past week does not count toward the baseline (an activity cannot mark it)', () => {
    const sessions: Session[] = [];
    for (let n = 1; n <= 4; n++) for (let j = 0; j < 5; j++) sessions.push(sess(shiftDays(week(n), j)));
    // five planned sessions a week, none marked: zero counted days, so the lower bound
    expect(pickMenu(record({ sessions }), weekSlot)[0]).toEqual({ item: 'days', target: 3, floor: 2, base: 0 });
  });

  it('cannot get round the hard lines, whatever the record holds', () => {
    let seed = 7;
    const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n;
    for (let run = 0; run < 300; run++) {
      const fitness = rnd(4) !== 0;
      const sessions: Session[] = [];
      const todos: Todo[] = [];
      const goals: Aim[] = [];
      for (let d = -28; d <= 6; d++) {
        const date = shiftDays(MON, d);
        if (rnd(3) === 0) sessions.push(sess(date, { kind: (['run', 'lift', 'cross', 'rest'] as const)[rnd(4)], mark: ([null, 'done', 'floor', 'skip'] as const)[rnd(4)] }));
        if (rnd(3) === 0) todos.push(todo({ doneOn: date <= T && rnd(2) ? date : null, bucket: (['today', 'later', 'someday'] as const)[rnd(3)], createdOn: shiftDays(date, -rnd(3)) }));
        if (rnd(4) === 0) goals.push(aim('day', date, rnd(2) ? 'done' : 'open'));
      }
      if (rnd(2)) goals.push(aim('week', MON, rnd(3) ? 'open' : 'done'));
      const paused = rnd(8) === 0;
      const r = record({ fitness, sessions: fitness ? sessions : [], todos, goals, status: paused ? { kind: 'injured', from: shiftDays(T, -1), until: null } : null, size: (['gentle', 'steady', 'bold'] as const)[rnd(3)] });
      const plannedWeek = r.sessions.filter((s) => s.date >= MON && s.kind !== 'rest' && s.mark !== 'skip' && s.mark !== 'sick').length;
      for (const s of [daySlot, weekSlot]) {
        const menu = pickMenu(r, s);
        // nothing on a paused day
        if (paused) expect(menu).toEqual([]);
        for (const o of menu) {
          expect(isPickable(o.item), o.item).toBe(true);
          const title = challengeTitle(o);
          expect(title).not.toBe('');
          // no distance, pace, weight, food, sleep, pain, clock time; no count of to-dos or of journal lines
          expect(title, title).not.toMatch(NEVER_WORDS);
          expect(title).not.toMatch(/\d/);
          // the title could itself be shown as a reason: the shared check agrees
          expect(reasonAllowed(title, title)).toBe(true);
          // nothing about training with Fitness off
          if (!fitness) expect(o.item).not.toMatch(/^session/);
          // never more sessions than the plan holds: one fewer, at most
          if (o.item === 'sessions') expect(o.target).toBe(plannedWeek - 1);
          if (o.item.startsWith('session:')) expect(r.sessions.some((x) => x.date === T && x.kind === o.item.slice(8) && x.mark !== 'skip')).toBe(true);
          // a week of days stays inside the published bounds, and only "days" carries a number
          if (o.item === 'days') expect(o.target >= 3 && o.target <= 5).toBe(true);
          else expect(['goal', 'list', 'full', 'sessions', 'goal-week'].includes(o.item) || o.item.startsWith('session:')).toBe(true);
        }
      }
      // and what goes beside the menu is words the person wrote, never a count
      const ctx = pickContext(r);
      expect(ctx.todos.length).toBeLessThanOrEqual(PICK_TODOS_MAX);
      if (!fitness) expect(ctx.sessions).toEqual([]);
    }
  });
});
