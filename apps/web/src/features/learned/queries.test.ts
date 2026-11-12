import type { Learning, LearningMonth, LearningStats } from '@logbook/shared';
import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** What the server answers a read with, and what a write does: set per test. */
let reads: Record<string, unknown> = {};
let onWrite: (path: string, method: string, json: unknown) => Promise<unknown> = async () => null;
let queue: Array<{ path: string; method: string; json?: unknown; tmpId?: string; createdAt: string; sentAt?: string }> = [];
const written: Array<{ path: string; method: string; json: unknown; tmpId?: string }> = [];
vi.mock('@/api/client', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    api: async (path: string) => {
      const hit = Object.keys(reads).find((k) => path.startsWith(k));
      if (!hit) throw new ApiError('Not found', 404);
      return structuredClone(reads[hit]);
    },
  };
});
vi.mock('@/api/outbox', () => ({
  outbox: { peek: () => queue },
  write: async (path: string, method: string, json: unknown, _inv: unknown, opts: { tmpId?: string } = {}) => {
    written.push({ path, method, json, tmpId: opts.tmpId });
    return onWrite(path, method, json);
  },
}));
vi.mock('@/lib/haptics', () => ({ haptics: new Proxy({}, { get: () => () => undefined }) }));
vi.mock('@/ui/Toast', () => ({ useToast: () => () => undefined }));

import { fetchLearnings, keptOn, learnedKeys, learnedWrites, monthsOf, pageOf, rowsOf, statsOf } from './queries';

type Pages = InfiniteData<{ learnings: Learning[]; next: string | null }, string | null>;
const T = '2026-11-12';
const NOV = learnedKeys.list({ month: '2026-11' });
const line = (id: string, date: string, text: string): Learning => ({ id, date, text, createdAt: `${date}T20:00:00.000Z`, editedAt: null });
const pages = (...rows: Learning[]): Pages => ({ pages: [{ learnings: rows, next: null }], pageParams: [null] });
const client = (rows: Learning[] = [], stats: LearningStats = { days: 0, streak: 0, total: 0, recent: [] }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  qc.setQueryData(NOV, pages(...rows));
  qc.setQueryData(learnedKeys.stats, stats);
  qc.setQueryData<LearningMonth[]>(learnedKeys.months, []);
  return qc;
};
const shown = (qc: QueryClient) => rowsOf(qc.getQueryData<Pages>(NOV)).map((l) => l.text);
const refused = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

beforeEach(() => {
  reads = {};
  queue = [];
  written.length = 0;
  onWrite = async () => null;
});

describe('saving a line the server cannot take right now', () => {
  it('keeps the line on the page and asks the server for nothing: the outbox says when it has landed', async () => {
    const qc = client();
    // the write is queued (a 500, a 429, a timeout, a session that ran out): `write` answers null
    const out = await learnedWrites(qc, T).add({ date: T, text: 'The tide comes twice a day.' });
    expect(out.id).toMatch(/^tmp-/);
    expect(shown(qc)).toEqual(['The tide comes twice a day.']);
    // no refetch was asked for: a list fetched now would not have the line
    expect(qc.getQueryState(NOV)?.isInvalidated).toBe(false);
    expect(qc.getQueryState(learnedKeys.stats)?.isInvalidated).toBe(false);
  });

  it('a list fetched while the save waits still has the line', async () => {
    reads = { '/learnings?': { learnings: [line('l1', '2026-11-10', 'Older.')], next: null } };
    queue = [{ path: '/learnings', method: 'POST', json: { date: T, text: 'The tide comes twice a day.' }, tmpId: 'tmp-a', createdAt: `${T}T21:00:00.000Z` }];
    const page = await fetchLearnings({ month: '2026-11' }, null);
    expect(page.learnings.map((l) => l.text)).toEqual(['The tide comes twice a day.', 'Older.']);
    // a page further down does not repeat it
    expect((await fetchLearnings({ month: '2026-11' }, '2026-11-10|x|l1')).learnings.map((l) => l.id)).toEqual(['l1']);
  });

  it('swaps in the server’s line and refetches once the server has answered', async () => {
    const qc = client();
    onWrite = async () => line('l_real', T, 'The tide comes twice a day.');
    reads = { '/learnings': { learnings: [line('l_real', T, 'The tide comes twice a day.')], next: null } };
    const out = await learnedWrites(qc, T).add({ date: T, text: 'The tide comes twice a day.' });
    expect(out.id).toBe('l_real');
    expect(rowsOf(qc.getQueryData<Pages>(NOV)).map((l) => l.id)).toEqual(['l_real']);
    expect(qc.getQueryState(NOV)?.isInvalidated).toBe(true);
  });

  it('keeps an edit and a delete that are waiting too', async () => {
    const qc = client([line('l1', '2026-11-10', 'One.'), line('l2', '2026-11-11', 'Two.')], { days: 2, streak: 0, total: 2, recent: ['2026-11-10', '2026-11-11'] });
    const w = learnedWrites(qc, T);
    await w.edit({ item: line('l1', '2026-11-10', 'One.'), text: 'One, changed.' });
    await w.remove(line('l2', '2026-11-11', 'Two.'));
    expect(shown(qc)).toEqual(['One, changed.']);
    expect(qc.getQueryState(NOV)?.isInvalidated).toBe(false);
  });
});

describe('a save the server refuses', () => {
  it('takes the line off the page at once, without waiting for a refetch', async () => {
    const qc = client([line('l1', '2026-11-10', 'Older.')], { days: 1, streak: 0, total: 1, recent: ['2026-11-10'] });
    qc.setQueryData<LearningMonth[]>(learnedKeys.months, [{ month: '2026-11', count: 1, days: 1, latest: 'Older.' }]);
    onWrite = async () => {
      // while the request is out the line shows
      expect(shown(qc)).toEqual(['The tide comes twice a day.', 'Older.']);
      throw refused(422);
    };
    await expect(learnedWrites(qc, T).add({ date: T, text: 'The tide comes twice a day.' })).rejects.toMatchObject({ status: 422 });
    expect(shown(qc)).toEqual(['Older.']);
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toEqual({ days: 1, streak: 0, total: 1, recent: ['2026-11-10'] });
    expect(qc.getQueryData<LearningMonth[]>(learnedKeys.months)).toEqual([{ month: '2026-11', count: 1, days: 1, latest: 'Older.' }]);
  });
});

describe('the stats after a write', () => {
  it('keep the days that have a line, so Today’s row knows tonight’s line is kept before the server answers', async () => {
    const qc = client([], { days: 3, streak: 0, total: 3, recent: ['2026-11-08'] });
    const w = learnedWrites(qc, T);
    const kept = await w.add({ date: T, text: 'One.' });
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toEqual({ days: 4, streak: 1, total: 4, recent: ['2026-11-08', T] });
    // a second line the same day: one more line, the same days
    const second = await w.add({ date: T, text: 'Two.' });
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toMatchObject({ days: 4, total: 5, recent: ['2026-11-08', T] });
    await w.remove(second);
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toMatchObject({ days: 4, total: 4, recent: ['2026-11-08', T] });
    await w.remove(kept);
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toEqual({ days: 3, streak: 0, total: 3, recent: ['2026-11-08'] });
    await w.restore(kept);
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toMatchObject({ total: 4, recent: ['2026-11-08', T] });
  });

  it('leave an answer from a server without the days as it was', async () => {
    const qc = client([], { days: 0, streak: 0, total: 0 });
    await learnedWrites(qc, T).add({ date: T, text: 'One.' });
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toEqual({ days: 1, streak: 1, total: 1 });
  });
});

describe('saving while the list could not load', () => {
  it('still shows the line: the month starts from it', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await qc.fetchInfiniteQuery({ queryKey: NOV, queryFn: () => Promise.reject(new Error('down')), initialPageParam: null }).catch(() => undefined);
    expect(qc.getQueryState(NOV)?.status).toBe('error');
    await learnedWrites(qc, T).add({ date: T, text: 'The tide comes twice a day.' });
    expect(shown(qc)).toEqual(['The tide comes twice a day.']);
  });
});

describe('what the server and the device’s copy are read as', () => {
  it('drops a line in a bad shape and keeps the rest', () => {
    const page = pageOf({ learnings: [line('l1', '2026-11-10', 'One.'), null, { id: 'l2' }, { id: 'l3', date: 'soon', text: 'x' }, { id: 'l4', date: '2026-11-09', text: 'Four.' }], next: 7 });
    expect(page.learnings.map((l) => l.id)).toEqual(['l1', 'l4']);
    expect(page.learnings[1]).toEqual({ id: 'l4', date: '2026-11-09', text: 'Four.', createdAt: '', editedAt: null });
    expect(page.next).toBeNull();
  });

  it('an answer that is not a list at all is a failed load, not an empty archive', () => {
    for (const bad of [null, 'ok', {}, { learnings: 'none' }]) expect(() => pageOf(bad)).toThrow();
    expect(() => statsOf(null)).toThrow();
    expect(() => monthsOf({ months: null })).toThrow();
  });

  it('reads the stats and the months with safe numbers', () => {
    expect(statsOf({ days: 2, streak: '3', total: 5 })).toEqual({ days: 2, streak: 0, total: 5 });
    expect(statsOf({ days: 2, streak: 1, total: 5, recent: ['2026-11-12', 4, 'x'] })).toEqual({ days: 2, streak: 1, total: 5, recent: ['2026-11-12'] });
    expect(monthsOf({ months: [{ month: '2026-11', count: 2, days: 1, latest: 'x' }, { month: 'Nov', count: 1 }, { month: '2026-10', count: -3, days: null }] })).toEqual([{ month: '2026-11', count: 2, days: 1, latest: 'x' }]);
  });

  it('reads a cached list in any shape without throwing', () => {
    expect(rowsOf(undefined)).toEqual([]);
    expect(rowsOf({ pages: null } as never)).toEqual([]);
    expect(rowsOf({ pages: [{ learnings: null }, null, { learnings: [line('l1', T, 'One.')] }] } as never).map((l) => l.id)).toEqual(['l1']);
  });
});

describe('Delete tapped twice', () => {
  it('is one delete: one request, one line counted out', async () => {
    const one = line('l1', T, 'One.');
    const qc = client([one, line('l2', T, 'Two.')], { days: 1, streak: 1, total: 2, recent: [T] });
    const w = learnedWrites(qc, T);
    await Promise.all([w.remove(one), w.remove(one)]);
    expect(written.filter((x) => x.method === 'DELETE')).toHaveLength(1);
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toEqual({ days: 1, streak: 1, total: 1, recent: [T] });
    // after Undo it can be deleted again
    await w.restore(one);
    await w.remove(one);
    expect(written.filter((x) => x.method === 'DELETE')).toHaveLength(2);
    expect(qc.getQueryData<LearningStats>(learnedKeys.stats)).toMatchObject({ total: 1 });
  });
});

describe('Today’s row: is tonight’s line kept?', () => {
  it('says so from the stats’ days, and from the lines on the device when the stats do not name the days', () => {
    expect(keptOn(T, { days: 1, streak: 1, total: 1, recent: [T] }, [])).toBe(true);
    expect(keptOn(T, { days: 1, streak: 0, total: 1, recent: ['2026-11-11'] }, [])).toBe(false);
    // an older server: no `recent` at all
    expect(keptOn(T, { days: 1, streak: 1, total: 1 }, [line('l1', T, 'One.')])).toBe(true);
    expect(keptOn(T, { days: 1, streak: 1, total: 1 }, [line('l1', '2026-11-11', 'One.')])).toBe(false);
    // a line still waiting to sync: the server's days do not have it, the device does
    expect(keptOn(T, { days: 0, streak: 0, total: 0, recent: [] }, [line('tmp-a', T, 'One.')])).toBe(true);
    expect(keptOn(T, undefined, [])).toBe(false);
  });
});
