import Anthropic from '@anthropic-ai/sdk';
import { applyPlanPatch, builderDates, builderInput, shareableSettings, shiftDays, today, zPlanAssistResult, type BuilderAnswers } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { planBlocks, trainingSessions } from '../db/schema.js';
import { env } from '../env.js';
import { AI_LIMITS, logUser, setUsageSink } from '../services/aiLimits.js';
import { SAFETY_BLOCK } from '../services/aiSafety.js';
import { setClaudeClient } from '../services/claude.js';
import { writeConsent } from '../services/consent.js';
import { SHAPE_SYSTEM, SHAPE_TIMEOUT_MS, shapePrompt } from '../services/planAssist.js';
import { fakeClaude, grantAll, makeApp, SHAPE_BLANK, signUp, type Account, type App, type FakeClaudeOptions } from '../test/helpers.js';

/**
 * The plan builder's assistant (`POST /plans/template/assist`): the person's words in, a checked patch to the builder's
 * settings out. Every test reads what the fake Claude client received and what the route answered.
 */
const T = today();
const RACE = shiftDays(T, 120);
const answers: BuilderAnswers = { goal: 'base', weeks: 8, runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 20, peakMiles: null, soon: false, startDate: null, race: true, raceDay: 'sun' };
const settings = shareableSettings(answers, T, { runDays: false, weeklyMiles: false });
const WORDS = '4 runs a week, long run Sunday, peak at 35 miles, two lifts';

let app: App;
let db: DB;
let me: Account;
let claude: ReturnType<typeof fakeClaude> | null = null;
const answerWith = (o: FakeClaudeOptions) => {
  claude?.restore();
  claude = fakeClaude(o);
  return claude;
};
const shape = (o: Record<string, unknown>) => ({ ...SHAPE_BLANK, ...o });
const ask = (body: Record<string, unknown> = {}, who: Account = me) => who.call('POST', '/api/plans/template/assist', { kind: 'shape', words: WORDS, settings, ...body });
/** The one user message of the request Claude received. */
const sentText = (c: ReturnType<typeof fakeClaude>) => String(c.calls.at(-1)!.params.messages[0].content);

beforeEach(async () => {
  ({ app, db } = makeApp());
  me = await signUp(app, 'shape@example.com');
  grantAll(db, me.id);
});
afterEach(() => {
  claude?.restore();
  claude = null;
  setUsageSink(null);
});

describe('a good update', () => {
  it('answers the patch as asked, with nothing dropped, and the app can apply it', async () => {
    const c = answerWith({ shape: shape({ goal: 'half', runsPerWeek: 4, longRunDay: 'sun', peakMiles: 35, raceDate: RACE, cannot: ['lifts'] }) });
    const r = await ask();
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ kind: 'shape', patch: { goal: 'half', runsPerWeek: 4, longRunDay: 'sun', peakMiles: 35, raceDate: RACE }, dropped: [], cannot: ['lifts'], note: null });
    expect(zPlanAssistResult.safeParse(r.body).success).toBe(true);
    expect(c.calls).toHaveLength(1);
    const applied = applyPlanPatch(answers, r.body.patch, T);
    expect(applied.next).toMatchObject({ goal: 'half', peakMiles: 35, longRunDay: 'sun', race: true });
    expect(builderDates(applied.next, T).raceDate).toBe(RACE);
  });

  it('sends Claude the words, the date and the settings, with the safety rules, and asks for the fixed shape', async () => {
    const c = answerWith({});
    expect((await ask()).status).toBe(200);
    const call = c.calls[0]!;
    expect(call.api).toBe('messages.create');
    expect(c.systemOf(call)).toBe(SHAPE_SYSTEM);
    expect(SHAPE_SYSTEM).toContain(SAFETY_BLOCK);
    expect(call.params.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
    expect(Object.keys(call.params.output_config.format.schema.properties)).toEqual(Object.keys(SHAPE_BLANK));
    // the API refuses a schema with more than 16 union-typed parameters or 24 optional ones: this one has neither kind
    const schema = call.params.output_config.format.schema;
    const unions: string[] = [];
    const walk = (node: unknown, at: string) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${at}[${i}]`));
      if (!node || typeof node !== 'object') return;
      const o = node as Record<string, unknown>;
      if ('anyOf' in o || 'oneOf' in o || Array.isArray(o.type)) unions.push(at);
      for (const [k, v] of Object.entries(o)) walk(v, `${at}.${k}`);
    };
    walk(schema, 'schema');
    expect(unions).toEqual([]);
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    expect(schema.additionalProperties).toBe(false);
    expect(call.params.messages).toHaveLength(1);
    const text = sentText(c);
    expect(text).toBe(shapePrompt({ words: WORDS, settings, today: T }));
    expect(text).toContain(`(${T}).`);
    expect(text).toContain(`REQUEST: ${WORDS}`);
    expect(text).toContain(`<data>${JSON.stringify(settings)}</data>`);
    // nothing about the account: no name, no email, no id
    expect(JSON.stringify(call.params)).not.toContain('shape@example.com');
    expect(JSON.stringify(call.params)).not.toContain(me.id);
    expect(SHAPE_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  it('leaves a setting out when the app did not share it (read from tracked runs)', async () => {
    const c = answerWith({});
    await ask({ settings: shareableSettings(answers, T, { runDays: true, weeklyMiles: true }) });
    const text = sentText(c);
    expect(text).toContain('"runDays":null');
    expect(text).toContain('"longRunDay":null');
    expect(text).toContain('"weeklyMiles":null');
    expect(text).not.toContain('"tue"');
    expect(text).toContain('"goal":"base"');
  });

  it('works with no settings in the request', async () => {
    const c = answerWith({});
    const r = await ask({ settings: undefined });
    expect(r.status).toBe(200);
    expect(sentText(c)).toContain('CURRENT SETTINGS: not shared.');
  });

  it('logs the tokens under the shape flow, with a hashed user and none of the words', async () => {
    const lines: string[] = [];
    setUsageSink((l) => lines.push(l));
    answerWith({});
    await ask();
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toMatchObject({ evt: 'ai_usage', flow: 'shape', user: logUser(me.id), in: 120, out: 30 });
    expect(lines[0]).not.toContain('long run Sunday');
  });
});

describe('a partial update', () => {
  it('clamps what is out of range, drops what is not a value, and says why for each', async () => {
    answerWith({ shape: shape({ weeks: 52, weeklyMiles: 400, longRunDay: 'someday', raceDate: shiftDays(T, -30), runsPerWeek: 4, cannot: ['lifts', 'paces'] }) });
    const r = await ask();
    expect(r.status).toBe(200);
    expect(r.body.patch).toEqual({ weeks: 30, weeklyMiles: 150, runsPerWeek: 4 });
    expect(r.body.dropped).toEqual([{ reason: 'weeks_max', value: 30 }, { reason: 'miles_max', value: 150 }, { reason: 'bad_value' }, { reason: 'race_past' }]);
    expect(r.body.cannot).toEqual(['lifts', 'paces']);
  });

  it('a request the builder cannot express at all changes nothing and says what it was', async () => {
    answerWith({ shape: shape({ cannot: ['lifts', 'workouts'] }) });
    const r = await ask({ words: 'Two lifts a week and hill sprints on Fridays' });
    expect(r.body).toEqual({ kind: 'shape', patch: {}, dropped: [], cannot: ['lifts', 'workouts'], note: null });
    expect(applyPlanPatch(answers, r.body.patch, T)).toMatchObject({ next: answers, changes: [], notes: [] });
  });

  it('passes on the assistant’s one sentence, as one plain line', async () => {
    answerWith({ shape: shape({ note: 'Chest pain is a reason to see a doctor — not to plan around.\nCall 911 if it is urgent.' }) });
    const r = await ask({ words: 'My chest hurts when I run, give me more miles' });
    expect(r.body).toEqual({ kind: 'shape', patch: {}, dropped: [], cannot: [], note: 'Chest pain is a reason to see a doctor, not to plan around. Call 911 if it is urgent.' });
  });

  it('an answer with fields left out is read as far as it goes', async () => {
    answerWith({ shape: { weeksChange: 2, extra: 'ignored' } });
    expect((await ask()).body).toEqual({ kind: 'shape', patch: { weeksChange: 2 }, dropped: [], cannot: [], note: null });
  });
});

describe('a refusal and an answer that is not usable', () => {
  it('a refusal answers 422 refused', async () => {
    answerWith({ shapeStop: 'refusal' });
    const r = await ask();
    expect(r.status).toBe(422);
    expect(r.body).toEqual({ error: 'The assistant declined this request. Say it another way and try again.', code: 'refused' });
  });

  it('words, a list, or a cut-off answer in place of the shape answer 502 invalid_answer, never a guess', async () => {
    for (const o of [{ shape: 'Sure, here is your plan.' }, { shape: '[{"weeks": 4}]' }, { shape: '"weeks"' }, { shape: '{"weeks": 4', shapeStop: 'max_tokens' }, { shapeStop: 'max_tokens' }] as FakeClaudeOptions[]) {
      answerWith(o);
      const r = await ask();
      expect(r.status).toBe(502);
      expect(r.body).toEqual({ error: 'The assistant’s answer didn’t come back usable. Try again.', code: 'invalid_answer' });
    }
  });
});

describe('consent', () => {
  it('an account that was never asked sends nothing: 403 consent_required and zero Claude calls', async () => {
    const fresh = await signUp(app, 'never-asked@example.com');
    const c = answerWith({});
    const r = await ask({}, fresh);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('consent_required');
    expect(c.calls).toHaveLength(0);
    // the same before the body is even read
    expect((await ask({ kind: 'nonsense' }, fresh)).status).toBe(403);
    // after the answer, it goes through
    expect((await fresh.call('PUT', '/api/me/consent', { training: true })).status).toBe(200);
    expect((await ask({}, fresh)).status).toBe(200);
    expect(c.calls).toHaveLength(1);
  });

  it('with the training switch off only the words go: no settings reach Claude', async () => {
    writeConsent(db, me.id, { training: false });
    const c = answerWith({ shape: shape({ runsPerWeek: 4 }) });
    const r = await ask({ settings: { ...settings, weeklyMiles: 37, weeks: 13 } });
    expect(r.status).toBe(200);
    expect(r.body.patch).toEqual({ runsPerWeek: 4 });
    // the person's turn: their words and nothing of the settings
    const turn = sentText(c);
    expect(turn).toContain(WORDS);
    expect(turn).toContain('CURRENT SETTINGS: not shared.');
    for (const secret of ['<data>', 'runDays', 'weeklyMiles', '37', '13', 'tue']) expect(turn).not.toContain(secret);
    // and nowhere else in the request
    for (const secret of ['"weeklyMiles":37', '"weeks":13']) expect(c.sent()).not.toContain(secret);
  });
});

describe('each error', () => {
  const apiError = (status: number, type: string) => Anthropic.APIError.generate(status, { type: 'error', error: { type, message: 'x' } }, 'x', new Headers());

  it('a rate limit, an overload, a server error or a dropped connection at Claude answers 503 claude_busy with Retry-After', async () => {
    for (const e of [apiError(429, 'rate_limit_error'), apiError(529, 'overloaded_error'), apiError(500, 'api_error'), new Anthropic.APIConnectionError({ message: 'socket hang up' })]) {
      answerWith({ fail: e });
      const r = await ask();
      expect(r.status).toBe(503);
      expect(r.body).toEqual({ error: 'The assistant is busy right now. Try again in a minute.', code: 'claude_busy' });
      expect(r.headers.get('retry-after')).toBe('60');
    }
  });

  it('a timeout answers 504 claude_timeout', async () => {
    answerWith({ fail: new Anthropic.APIConnectionTimeoutError() });
    const r = await ask();
    expect(r.status).toBe(504);
    expect(r.body.code).toBe('claude_timeout');
  });

  it('a hang-up (Stop) answers 409 cancelled, and frees the place for the next request', async () => {
    answerWith({ fail: new Anthropic.APIUserAbortError() });
    const r = await ask();
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('cancelled');
    answerWith({});
    expect((await ask()).status).toBe(200);
  });

  it('something unexpected answers 500 internal, with no detail', async () => {
    answerWith({ fail: new Error('boom: secret detail') });
    const r = await ask();
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: 'Something went wrong on the server.', code: 'internal' });
  });

  it('without a key it answers 503 claude_not_configured', async () => {
    const was = env.claudeConfigured;
    setClaudeClient(null);
    env.claudeConfigured = false;
    try {
      const r = await ask();
      expect(r.status).toBe(503);
      expect(r.body.code).toBe('claude_not_configured');
    } finally {
      env.claudeConfigured = was;
    }
  });

  it('a body that does not fit answers 422 validation and makes no Claude call', async () => {
    const c = answerWith({});
    for (const body of [{ kind: 'research' }, { words: ' ' }, { words: 'x'.repeat(601) }, { settings: { ...settings, goal: 'ultra' } }, { settings: 'all of them' }]) {
      const r = await ask(body);
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('validation');
    }
    expect(c.calls).toHaveLength(0);
  });

  it('signed out answers 401', async () => {
    answerWith({});
    const r = await app.request('/api/plans/template/assist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'shape', words: WORDS }) });
    expect(r.status).toBe(401);
  });

  it('has its own limit: ten in five minutes, then 429 rate_limited; one at a time', async () => {
    answerWith({});
    expect(AI_LIMITS.shape).toMatchObject({ window: 10, windowMs: 300_000 });
    for (let i = 0; i < AI_LIMITS.shape.window; i++) expect((await ask()).status).toBe(200);
    const over = await ask();
    expect(over.status).toBe(429);
    expect(over.body).toEqual({ error: 'That is a lot in a short time. Try again in a few minutes.', code: 'rate_limited' });
    expect(Number(over.headers.get('retry-after'))).toBeGreaterThan(0);
    // it says nothing about a plan draft, or about someone else
    expect((await me.call('POST', '/api/plans/draft', { mode: 'describe', start: shiftDays(T, 1), instructions: 'A gentle 10K plan over eight weeks' })).status).toBe(200);
    const other = await signUp(app, 'other-shape@example.com');
    grantAll(db, other.id);
    expect((await ask({}, other)).status).toBe(200);
  });

  it('a second request while one is running (a double tap) is refused, and the first still answers', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((r) => (finish = r));
    let calls = 0;
    setClaudeClient({
      messages: {
        create: async () => {
          calls++;
          await gate;
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(shape({ weeks: 10 })) }], usage: { input_tokens: 1, output_tokens: 1 } };
        },
      },
    });
    const was = { configured: env.claudeConfigured, model: env.ANTHROPIC_MODEL };
    env.claudeConfigured = true;
    env.ANTHROPIC_MODEL = 'test-model';
    try {
      const first = ask();
      await new Promise((r) => setTimeout(r, 20));
      const second = await ask();
      expect(second.status).toBe(429);
      expect(second.body).toEqual({ error: 'The last one is still running. Wait for it to finish.', code: 'rate_limited' });
      finish();
      const r = await first;
      expect(r.status).toBe(200);
      expect(r.body.patch).toEqual({ weeks: 10 });
      expect(calls).toBe(1);
    } finally {
      setClaudeClient(null);
      env.claudeConfigured = was.configured;
      env.ANTHROPIC_MODEL = was.model;
    }
  });
});

describe('the plan it leads to', () => {
  const half: BuilderAnswers = { ...answers, goal: 'half', weeks: 12 };
  it('records that the assistant shaped it in the plan’s source, and plain template when it did not', async () => {
    const shaped = await me.call('POST', '/api/plans/template', { ...builderInput(half, T), assisted: true });
    expect(shaped.status).toBe(201);
    expect(shaped.body.block.source).toBe('template-assisted');
    expect(db.select().from(planBlocks).where(eq(planBlocks.id, shaped.body.block.id)).get()!.source).toBe('template-assisted');
    const plain = await me.call('POST', '/api/plans/template', { ...builderInput({ ...half, startDate: shiftDays(T, 200) }, T) });
    expect(plain.body.block.source).toBe('template');
    const not = await me.call('POST', '/api/plans/template', { ...builderInput({ ...half, startDate: shiftDays(T, 400) }, T), assisted: false });
    expect(not.body.block.source).toBe('template');
    expect((await me.call('POST', '/api/plans/template', { ...builderInput(half, T), assisted: 'yes' })).status).toBe(422);
  });

  it('builds to the peak the assistant set, and a race on the weekday it set', async () => {
    const a: BuilderAnswers = { ...half, weeks: 20, peakMiles: 26, raceDay: 'sat' };
    const r = await me.call('POST', '/api/plans/template', { ...builderInput(a, T), assisted: true });
    expect(r.status).toBe(201);
    const rows = db.select().from(trainingSessions).where(eq(trainingSessions.blockId, r.body.block.id)).all();
    const byWeek = new Map<string, number>();
    const { firstMon, raceDate } = builderDates(a, T);
    for (const s of rows) {
      if (s.type === 'Race') continue;
      const wk = String(Math.floor((Date.parse(s.date) - Date.parse(firstMon)) / (7 * 864e5)));
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + (s.miles ?? 0));
    }
    expect(Math.max(...byWeek.values())).toBeLessThanOrEqual(26.5);
    expect(Math.max(...byWeek.values())).toBeGreaterThanOrEqual(25.5);
    expect(rows.find((s) => s.type === 'Race')!.date).toBe(raceDate);
    expect(r.body.block.end).toBe(raceDate);
    // undo takes it away again, as for any template plan
    const undo = await me.call('POST', '/api/plans/template/undo', { blockId: r.body.block.id, replacedIds: [] });
    expect(undo.status).toBe(200);
    expect(db.select().from(planBlocks).where(eq(planBlocks.id, r.body.block.id)).get()).toBeUndefined();
  });
});
