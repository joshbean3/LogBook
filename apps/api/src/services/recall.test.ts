import { shiftDays, today } from '@logbook/shared';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { recallItems, userSettings } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { chooseRecall, cleanSummary, eligibleFor, fallbackSummary, RECALL, recallWeight, resetRecallMemory, setRecallClient, type RecallCandidate } from './recall.js';
import { writeConsent } from './consent.js';

const T = '2026-11-04';
const cand = (id: string, daysAgo: number, over: Partial<RecallCandidate> = {}): RecallCandidate => ({
  kind: 'journal',
  id,
  date: shiftDays(T, -daysAgo),
  text: `Entry ${id}.`,
  editedAt: null,
  boost: false,
  hidden: false,
  lastShown: null,
  summary: null,
  summarizedAt: null,
  ...over,
});
/** A random that returns these values in turn. */
const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length]!;
};

describe('the pick', () => {
  it('takes only what is a week old, until fewer than ten are', () => {
    const many = Array.from({ length: 10 }, (_, i) => cand(`a${i}`, 8 + i));
    const young = cand('young', 3);
    expect(eligibleFor([...many, young], T).map((c) => c.id)).not.toContain('young');
    // nine a week old: anything two days old counts, but not yesterday's
    const few = [...many.slice(0, 9), young, cand('yday', 1)];
    expect(eligibleFor(few, T).map((c) => c.id)).toContain('young');
    expect(eligibleFor(few, T).map((c) => c.id)).not.toContain('yday');
    expect(chooseRecall([cand('yday', 1), cand('today', 0)], T)).toBeNull();
  });

  it('never picks a hidden one, and hidden ones do not count toward the ten', () => {
    const items = Array.from({ length: 10 }, (_, i) => cand(`a${i}`, 8 + i, { hidden: i === 0 }));
    const young = cand('young', 3);
    expect(eligibleFor([...items, young], T).map((c) => c.id)).toContain('young');
    for (const r of [0, 0.3, 0.6, 0.99]) expect(chooseRecall([cand('h', 30, { hidden: true }), cand('v', 30)], T, { rnd: () => r })?.id).toBe('v');
    expect(chooseRecall([cand('h', 30, { hidden: true })], T)).toBeNull();
  });

  it('weighs a boosted one four times, an old one one and a half', () => {
    expect(recallWeight(cand('x', 10), T)).toBe(1);
    expect(recallWeight(cand('x', 10, { boost: true }), T)).toBe(4);
    expect(recallWeight(cand('x', 91), T)).toBe(1.5);
    expect(recallWeight(cand('x', 200, { boost: true }), T)).toBe(6);
    // pool sorted by key: a (1), b (4): a takes [0, 0.2), b takes [0.2, 1)
    const items = [cand('b', 10, { boost: true }), cand('a', 10)];
    expect(chooseRecall(items, T, { rnd: () => 0.19 })?.id).toBe('a');
    expect(chooseRecall(items, T, { rnd: () => 0.21 })?.id).toBe('b');
    const n = 4000;
    let b = 0;
    let s = 1;
    const lcg = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) if (chooseRecall(items, T, { rnd: lcg })?.id === 'b') b++;
    expect(b / n).toBeGreaterThan(0.76);
    expect(b / n).toBeLessThan(0.84);
  });

  it('skips what was shown in the last two weeks, unless nothing else is left', () => {
    const shown = cand('shown', 30, { lastShown: shiftDays(T, -13) });
    const rested = cand('rested', 30, { lastShown: shiftDays(T, -RECALL.cooldownDays) });
    for (const r of [0, 0.5, 0.99]) expect(chooseRecall([shown, rested], T, { rnd: () => r })?.id).toBe('rested');
    expect(chooseRecall([shown], T)?.id).toBe('shown');
    // "Another": never the one showing, even when it is the only rested one
    expect(chooseRecall([shown, rested], T, { exclude: 'journal:rested' })?.id).toBe('shown');
    expect(chooseRecall([rested], T, { exclude: 'journal:rested' })).toBeNull();
  });
});

describe('the words', () => {
  it('falls back to the first sentence, trimmed', () => {
    expect(fallbackSummary({ kind: 'journal', date: '2026-10-12', text: 'Stop skipping the warm-up. Tempo felt awful.' }, T)).toBe('On Oct 12 you wrote: “Stop skipping the warm-up.”');
    expect(fallbackSummary({ kind: 'learning', date: '2025-10-12', text: 'Strides help' }, T)).toBe('On Oct 12, 2025 you learned: “Strides help”');
    const long = fallbackSummary({ kind: 'journal', date: '2026-10-12', text: `${'word '.repeat(60)}end.` }, T);
    const quoted = long.slice(long.indexOf('“') + 1, -1);
    expect(quoted.length).toBeLessThanOrEqual(140);
    expect(quoted.endsWith('…')).toBe(true);
  });

  it('keeps Claude to whole sentences under 35 words, without exclamation marks or wrapping quotes', () => {
    expect(cleanSummary('"Josh, on Oct 12 you wrote that you wanted to warm up first! Don\'t forget that."')).toBe("Josh, on Oct 12 you wrote that you wanted to warm up first. Don't forget that.");
    const two = `${'a '.repeat(30).trim()}. ${'b '.repeat(10).trim()}.`;
    expect(cleanSummary(two)).toBe(`${'a '.repeat(30).trim()}.`);
    expect(cleanSummary(`${'a '.repeat(40).trim()}.`)).toBeNull();
    expect(cleanSummary('  ')).toBeNull();
  });
});

// ---------- the routes ----------

let app: ReturnType<typeof buildApp>;
let db: DB;
let cookie = '';
let userId = '';
const call = async (method: string, url: string, body?: unknown) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const fakeClaude = (reply: string | (() => never), stop = 'end_turn') => {
  const create = vi.fn(async (_: unknown) => {
    if (typeof reply === 'function') reply();
    return { stop_reason: stop, content: [{ type: 'text', text: reply as string }] };
  });
  setRecallClient({ messages: { create } } as never);
  env.ANTHROPIC_MODEL = 'test-model';
  return create;
};
/** As if a new day had begun: today's one send to Claude is available again. */
const newDay = () => {
  resetRecallMemory();
  db.delete(userSettings).where(eq(userSettings.key, 'recallSent')).run();
};
const seed = async (n: number, from = 8) => {
  const t = today();
  for (let i = 0; i < n; i++) await call('POST', '/api/journal', { date: shiftDays(t, -(from + i * 7)), text: `Entry number ${i}. More words after.` });
};

beforeEach(async () => {
  resetRecallMemory();
  setRecallClient(null);
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'correct horse 42' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = ((await res.json()) as { id: string }).id;
  // the account has said yes to Remember when (the switch off is tested on its own below)
  writeConsent(db, userId, { recall: true });
});
afterEach(() => setRecallClient(null));

describe('GET /journal/recall', () => {
  it('is empty with nothing old enough', async () => {
    await call('POST', '/api/journal', { date: today(), text: 'Today.' });
    expect((await call('GET', '/api/journal/recall')).body).toEqual({ item: null, eligible: 0 });
  });

  it('keeps one for the day and asks Claude once, with the name', async () => {
    await call('PATCH', '/api/me', { name: 'Josh Smith' });
    await seed(5);
    const create = fakeClaude('Josh, on Oct 12 you wrote that you wanted to warm up. Don’t forget that.');
    const a = await call('GET', '/api/journal/recall');
    expect(a.status).toBe(200);
    expect(a.body.eligible).toBe(5);
    expect(a.body.item).toMatchObject({ kind: 'journal', summary: 'Josh, on Oct 12 you wrote that you wanted to warm up. Don’t forget that.', boosted: false });
    expect(a.body.item.excerpt).toMatch(/^Entry number \d\./);
    for (let i = 0; i < 4; i++) expect((await call('GET', '/api/journal/recall')).body.item.id).toBe(a.body.item.id);
    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0]![0] as { model: string; max_tokens: number; output_config: unknown; messages: Array<{ content: string }> };
    expect(params).toMatchObject({ model: env.ANTHROPIC_MODEL, max_tokens: 400, output_config: { effort: 'low' } });
    expect(params.messages[0]!.content).toContain('by his first name, Josh,');
    expect(params.messages[0]!.content).not.toContain('Smith');
  });

  it('falls back to plain words without a key, on an error or a refusal, and stores none of them', async () => {
    await seed(1);
    const plain = (await call('GET', '/api/journal/recall')).body.item;
    expect(plain.summary).toMatch(/^On [A-Z][a-z]{2} \d{1,2}(, \d{4})? you wrote: “Entry number 0\.”$/);
    fakeClaude(() => {
      throw new Error('overloaded');
    });
    expect((await call('GET', '/api/journal/recall')).body.item.summary).toBe(plain.summary);
    newDay();
    fakeClaude('I cannot help with that.', 'refusal');
    expect((await call('GET', '/api/journal/recall')).body.item.summary).toBe(plain.summary);
    expect(db.select().from(recallItems).all().every((r) => r.summary === null)).toBe(true);
    // with a working key, it is written once and kept
    newDay();
    fakeClaude('On that day you wrote about entry zero.');
    expect((await call('GET', '/api/journal/recall')).body.item.summary).toBe('On that day you wrote about entry zero.');
    expect(db.select().from(recallItems).all()[0]!.summary).toBe('On that day you wrote about entry zero.');
  });

  it('brings back another, boosts, hides with undo', async () => {
    await seed(3);
    const first = (await call('GET', '/api/journal/recall')).body.item;
    const other = (await call('POST', '/api/journal/recall/another')).body.item;
    expect(other.id).not.toBe(first.id);
    expect((await call('GET', '/api/journal/recall')).body.item.id).toBe(other.id);

    const boosted = await call('PUT', `/api/journal/recall/journal/${other.id}`, { boost: true });
    expect(boosted.body.item).toMatchObject({ id: other.id, boosted: true });

    const hidden = await call('PUT', `/api/journal/recall/journal/${other.id}`, { hidden: true });
    expect(hidden.body.item.id).not.toBe(other.id);
    expect(hidden.body.eligible).toBe(2);
    const undone = await call('PUT', `/api/journal/recall/journal/${other.id}`, { hidden: false });
    expect(undone.body.item).toMatchObject({ id: other.id, boosted: true });
    expect(undone.body.eligible).toBe(3);
    expect((await call('GET', '/api/journal/recall')).body.item.id).toBe(other.id);
  });

  it('keeps the same one when there is no other', async () => {
    await seed(1);
    const only = (await call('GET', '/api/journal/recall')).body.item;
    expect((await call('POST', '/api/journal/recall/another')).body.item.id).toBe(only.id);
  });

  it('moves on when today’s is deleted, and refuses what is not there', async () => {
    await seed(2);
    const first = (await call('GET', '/api/journal/recall')).body.item;
    await call('DELETE', `/api/journal/${first.id}`);
    expect((await call('GET', '/api/journal/recall')).body.item.id).not.toBe(first.id);
    expect((await call('PUT', `/api/journal/recall/journal/${first.id}`, { boost: true })).status).toBe(404);
    expect((await call('PUT', '/api/journal/recall/quote/x', { boost: true })).status).toBe(404);
    expect((await call('PUT', `/api/journal/recall/journal/x`, {})).status).toBe(422);
  });

  it('works without a learnings table', async () => {
    db.run(sql`DROP TABLE IF EXISTS learnings`);
    await seed(1);
    expect((await call('GET', '/api/journal/recall')).body).toMatchObject({ eligible: 1, item: { kind: 'journal' } });
  });

  it('reads learnings once that table exists', async () => {
    db.run(sql`CREATE TABLE IF NOT EXISTS learnings (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, date text NOT NULL, text text NOT NULL, created_at text NOT NULL, edited_at text, deleted_at text)`);
    const me = (await call('GET', '/api/me')).body;
    const userId = me.id ?? me.user?.id;
    db.run(sql`INSERT INTO learnings (id, user_id, date, text, created_at) VALUES ('l1', ${userId}, ${shiftDays(today(), -20)}, 'Strides before a race help.', '2026-01-01')`);
    const got = (await call('GET', '/api/journal/recall')).body;
    expect(got).toMatchObject({ eligible: 1, item: { kind: 'learning', id: 'l1' } });
    expect(got.item.summary).toMatch(/you learned: “Strides before a race help\.”$/);
    expect((await call('PUT', '/api/journal/recall/learning/l1', { boost: true })).body.item.boosted).toBe(true);
  });
});
