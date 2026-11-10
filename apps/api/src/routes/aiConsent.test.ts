import { mondayOf, shiftDays, today } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { TRAINING_OFF_TOOL } from '../services/assistant.js';
import { writeConsent } from '../services/consent.js';
import { fallbackSummary, resetRecallMemory } from '../services/recall.js';
import { fakeClaude, grantAll, makeApp, signUp, type Account, type App } from '../test/helpers.js';
import { REVISE_NEEDS_TRAINING } from './ai.js';

/**
 * The consent gate, proven at the wire: for each Claude call site, what the fake client received (or that it received
 * nothing) with the person's switch off, never asked, and on.
 */
const T = today();
let app: App;
let db: DB;
let me: Account;
let claude: ReturnType<typeof fakeClaude>;

/** Things only this account's data holds; none may reach Claude without a yes. */
const SECRET = { session: 'SECRET Tempo 6', goal: 'SECRET goal: break ninety', todo: 'SECRET errand', journal: 'SECRET journal line about the quiet mile', link: 'secret-link-title' };

const seedData = async () => {
  await me.call('POST', '/api/sessions', { date: shiftDays(T, 1), kind: 'run', type: 'Tempo', title: SECRET.session, miles: 6 });
  await me.call('PUT', `/api/goals/week/${mondayOf(T)}`, { text: SECRET.goal });
  await me.call('POST', '/api/todos', { text: SECRET.todo, date: T });
  for (let i = 0; i < 3; i++) await me.call('POST', '/api/journal', { date: shiftDays(T, -(10 + i * 7)), text: `${SECRET.journal} ${i}. More words.` });
};
const draft = (mode: string, extra: Record<string, unknown> = {}) => me.call('POST', '/api/plans/draft', { mode, start: shiftDays(T, 7), ...extra });
const draftFile = async () => {
  const form = new FormData();
  form.set('mode', 'file');
  form.set('start', shiftDays(T, 7));
  form.set('file', new Blob(['%PDF-1.4 a plan'], { type: 'application/pdf' }), 'plan.pdf');
  const res = await app.request('/api/plans/draft', { method: 'POST', headers: { cookie: me.cookie }, body: form });
  return { status: res.status, body: (await res.json()) as { code?: string } };
};
const ask = (text = 'What is on this week?') => me.call('POST', '/api/assistant', { date: T, turns: [{ role: 'user', text }] });
const refine = () => me.call('POST', '/api/goals/refine', { level: 'week', period: mondayOf(T), text: 'run more' });

beforeEach(async () => {
  ({ app, db } = makeApp());
  resetRecallMemory();
  me = await signUp(app, 'consent@example.com');
  await seedData();
  claude = fakeClaude({ pick: { url: 'https://logbook-test.invalid/essays/the-long-run', title: 'The long run', why: 'Close to what you saved.', tags: ['running'] } });
});
afterEach(() => claude.restore());

describe('an account that was never asked (consent.at is null)', () => {
  it('sends nothing: the assistant, every plan draft mode and the goal review answer 403 consent_required with zero Claude calls', async () => {
    const answers = [
      await ask(),
      await me.call('POST', '/api/assistant?async=1', { date: T, turns: [{ role: 'user', text: 'hello' }] }),
      await draft('text', { text: 'Week 1: Monday easy 4 miles. Tuesday rest. Wednesday tempo 5.' }),
      await draft('describe', { instructions: 'A gentle 10K plan over eight weeks' }),
      await draftFile(),
      await draft('revise', { start: T, instructions: 'Make next week lighter' }),
      await refine(),
    ];
    for (const a of answers) {
      expect(a.status).toBe(403);
      expect(a.body.code).toBe('consent_required');
    }
    expect(claude.calls).toHaveLength(0);
  });

  it('Remember when and the daily pick fall back with zero Claude calls', async () => {
    await me.call('POST', '/api/reads', { url: 'https://logbook-test.invalid/a-saved-piece', note: SECRET.link });
    const recall = (await me.call('GET', '/api/journal/recall')).body;
    expect(recall.item.summary).toBe(fallbackSummary({ kind: 'journal', date: recall.item.date, text: `${SECRET.journal} 0. More words.`.replace(' 0.', ` ${recall.item.excerpt.match(/mile (\d)/)![1]}.`) }, T));
    const pick = (await me.call('GET', '/api/reads/pick')).body;
    expect(pick).toMatchObject({ pick: null, reason: 'off' });
    expect(claude.calls).toHaveLength(0);
  });

  it('after PUT /me/consent the same calls go through', async () => {
    await me.call('POST', '/api/reads', { url: 'https://logbook-test.invalid/a-saved-piece' });
    expect((await me.call('PUT', '/api/me/consent', { training: true, recall: true, reads: true })).status).toBe(200);
    expect((await ask()).status).toBe(200);
    expect((await draft('text', { text: 'Week 1: Monday easy 4 miles. Tuesday rest. Wednesday tempo 5.' })).status).toBe(200);
    expect((await draft('describe', { instructions: 'A gentle 10K plan over eight weeks' })).status).toBe(200);
    expect((await draftFile()).status).toBe(200);
    expect((await draft('revise', { start: T, instructions: 'Make next week lighter' })).status).toBe(200);
    const refined = await refine();
    expect(refined.body).toMatchObject({ available: true, changed: true });
    expect((await me.call('GET', '/api/journal/recall')).body.item.summary).toBe('You wrote about it. Do not forget that.');
    expect((await me.call('GET', '/api/reads/pick')).body.pick).toMatchObject({ title: 'The long run', source: 'pick' });
    // one call each: ask, four drafts, review, recall, pick
    expect(claude.calls).toHaveLength(8);
  }, 20_000);

  it('a "Not now" that stores a no for everything still lets typed text through, with none of their data', async () => {
    await me.call('PUT', '/api/me/consent', { training: false, recall: false, reads: false });
    expect((await ask('How long should a long run be?')).status).toBe(200);
    expect(claude.calls).toHaveLength(1);
    const sent = claude.sent();
    expect(sent).toContain('How long should a long run be?');
    for (const secret of Object.values(SECRET)) expect(sent).not.toContain(secret);
  });
});

describe('with the training switch off', () => {
  beforeEach(() => {
    writeConsent(db, me.id, { training: false });
  });

  it('an ask sends no tools and none of the plan, sessions, goals or to-dos', async () => {
    const r = await ask();
    expect(r.status).toBe(200);
    expect(claude.calls).toHaveLength(1);
    const params = claude.calls[0]!.params;
    expect(params.tools).toBeUndefined();
    expect(params.tool_choice).toBeUndefined();
    const sent = claude.sent();
    expect(sent).toContain('turned off reading their training data');
    for (const secret of [SECRET.session, SECRET.goal, SECRET.todo]) expect(sent).not.toContain(secret);
  });

  it('get_sessions and propose_changes answer an error result, and nothing is saved', async () => {
    claude.restore();
    claude = fakeClaude({
      assistant: [
        [
          { type: 'tool_use', id: 'tu_1', name: 'get_sessions', input: { from: T, to: shiftDays(T, 7) } },
          { type: 'tool_use', id: 'tu_2', name: 'propose_changes', input: { summary: 'Add a to-do.', changes: [{ op: 'add_todo', text: 'Sneaky' }] } },
        ],
        [{ type: 'text', text: 'I cannot see your plan.' }],
      ],
    });
    const r = await ask();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ text: 'I cannot see your plan.', proposal: null });
    // the second request carries the two tool results, both errors, with no session line in them
    const results = claude.calls[1]!.params.messages.at(-1).content as Array<{ type: string; is_error?: boolean; content: string }>;
    expect(results).toHaveLength(2);
    for (const res of results) expect(res).toMatchObject({ type: 'tool_result', is_error: true, content: TRAINING_OFF_TOOL });
    expect(claude.sent()).not.toContain(SECRET.session);
    expect((await me.call('GET', '/api/assistant/log')).body).toEqual([]);
  });

  it('POST /plans/draft in revise mode answers 403 with the plain message and no Claude call; other modes send no training data', async () => {
    const r = await draft('revise', { start: T, instructions: 'Make next week lighter' });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ error: REVISE_NEEDS_TRAINING, code: 'training_off' });
    expect(REVISE_NEEDS_TRAINING).toBe("Turn on 'Let the assistant read my training data' in Settings, Privacy to revise your plan.");
    expect(claude.calls).toHaveLength(0);
    expect((await draft('describe', { instructions: 'A gentle 10K plan over eight weeks' })).status).toBe(200);
    expect(claude.sent()).not.toContain(SECRET.session);
    expect(claude.sent()).toContain('Recent running data is not available');
  });

  it('POST /goals/refine returns available:false and makes no Claude call', async () => {
    const r = await refine();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ text: 'run more', why: null, changed: false, steps: [], available: false });
    expect(claude.calls).toHaveLength(0);
  });
});

describe('the switch turned off while an answer is being written', () => {
  it('the tool handlers check again, so a lookup that arrives after the change gets nothing', async () => {
    writeConsent(db, me.id, { training: true });
    claude.restore();
    await me.call('POST', '/api/sessions', { date: shiftDays(T, 35), kind: 'run', title: 'SECRET far run', miles: 9 });
    claude = fakeClaude({
      assistant: [[{ type: 'tool_use', id: 'tu_1', name: 'get_sessions', input: { from: shiftDays(T, 30), to: shiftDays(T, 40) } }], [{ type: 'text', text: 'Okay.' }]],
      // the first request went out with tools; the person turns the switch off before the lookup is answered
      onCall: (i) => {
        if (i === 0) writeConsent(db, me.id, { training: false });
      },
    });
    const r = await ask('What is on in a month?');
    expect(r.status).toBe(200);
    expect(claude.calls[0]!.params.tools).toHaveLength(2);
    const results = claude.calls[1]!.params.messages.at(-1).content as Array<{ is_error?: boolean; content: string }>;
    expect(results[0]).toMatchObject({ is_error: true, content: TRAINING_OFF_TOOL });
    expect(JSON.stringify(claude.calls[1]!.params.messages.at(-1))).not.toContain('SECRET far run');
  });
});

describe('Remember when (the recall switch)', () => {
  it('off: the card uses the plain line and no journal or learning text reaches Claude', async () => {
    writeConsent(db, me.id, { training: true, recall: false });
    await me.call('POST', '/api/learned', { date: shiftDays(T, -12), text: 'SECRET learning: fuel before the long run' });
    for (let i = 0; i < 4; i++) {
      const r = (await me.call(i ? 'POST' : 'GET', i ? '/api/journal/recall/another' : '/api/journal/recall')).body;
      expect(r.item.summary).toMatch(/^On .+ you (wrote|learned): “/);
    }
    expect(claude.calls).toHaveLength(0);
  });

  it('on: Another and Hide never send more than one entry a day; the rest show the plain line', async () => {
    grantAll(db, me.id);
    const first = (await me.call('GET', '/api/journal/recall')).body.item;
    expect(first.summary).toBe('You wrote about it. Do not forget that.');
    expect(claude.calls).toHaveLength(1);
    const second = (await me.call('POST', '/api/journal/recall/another')).body.item;
    expect(second.id).not.toBe(first.id);
    expect(second.summary).toMatch(/^On .+ you wrote: “/);
    const third = (await me.call('PUT', `/api/journal/recall/journal/${second.id}`, { hidden: true })).body.item;
    expect(third.id).not.toBe(second.id);
    await me.call('POST', '/api/journal/recall/another');
    await me.call('GET', '/api/journal/recall');
    expect(claude.calls).toHaveLength(1);
    // exactly one entry's text went out
    const sent = claude.sent();
    expect(sent.match(/SECRET journal line/g)).toHaveLength(1);
    // the one Claude wrote is stored and shown again without a new send
    const again = (await me.call('PUT', `/api/journal/recall/journal/${first.id}`, { hidden: false })).body.item;
    expect(again).toMatchObject({ id: first.id, summary: 'You wrote about it. Do not forget that.' });
    expect(claude.calls).toHaveLength(1);
  });
});

describe('the daily pick (the reads switch)', () => {
  it('off: no saved link reaches Claude and no pick is made, forced or not', async () => {
    writeConsent(db, me.id, { training: true, recall: true, reads: false });
    await me.call('POST', '/api/reads', { url: 'https://logbook-test.invalid/a-saved-piece', note: SECRET.link });
    for (const url of ['/api/reads/pick', '/api/reads/pick?force=1']) expect((await me.call('GET', url)).body).toMatchObject({ pick: null, reason: 'off', refreshesLeft: 0 });
    expect(claude.calls).toHaveLength(0);
    expect((await me.call('GET', '/api/reads')).body.links).toHaveLength(1);
  });
});
