import { isISODate, shiftDays, type Learning, type LearningEchoes, type LearningMonth, type LearningPage, type LearningStats } from '@logbook/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, ApiError } from '@/api/client';
import { outbox, write } from '@/api/outbox';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/ui/Toast';
import { withQueued } from './queued';

/**
 * What I learned: the list (paged newest first) and the stats line. Every write lands in the cache first (a provisional id
 * on a create), goes through the outbox (so it survives being offline) and is then reconciled with the server's answer.
 *
 * Three rules keep a line on the page whatever the server does:
 *  - A write the server could not take yet (`write` answers null: it is queued) asks for no refetch. The outbox
 *    invalidates these keys itself when the write lands; a list fetched before that would not have the line.
 *  - Every list the server answers has the queued writes laid over it (`withQueued`), so a refetch for any other reason
 *    (coming back to the app, the connection returning) cannot take a waiting line off the page either.
 *  - What the server answers is read through `pageOf`, `statsOf`, `monthsOf` and `echoesOf`: a line in a bad shape is
 *    dropped, an answer that is not the thing asked for is a failed load (the last good copy stays), never an empty one.
 */
/** One month ('2026-11'), the words searched for, or neither (everything). */
export interface LearnedFilter {
  month?: string | null;
  q?: string | null;
}
export const learnedKeys = {
  all: ['learnings'] as const,
  lists: ['learnings', 'list'] as const,
  list: (f: LearnedFilter = {}) => ['learnings', 'list', { month: f.month ?? null, q: f.q ?? null }] as const,
  months: ['learnings', 'months'] as const,
  stats: ['learnings', 'stats'] as const,
  echoes: ['learnings', 'echoes'] as const,
};
const PAGE = 60;
/**
 * Retry a failed read twice, but never an answer the server meant (a 4xx: a search over 100 characters, a bad month), and
 * not again on a remount: a failed read waits for Try again instead of looping.
 */
const reads = {
  retry: (n: number, e: unknown) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
  retryOnMount: false,
} as const;
type Pages = InfiniteData<LearningPage, string | null>;
type ListKey = ReturnType<typeof learnedKeys.list>;

// ---------- what an answer is read as ----------
const fail = (what: string): never => {
  throw new Error(`Unexpected answer for ${what}`);
};
const objectOf = (v: unknown, what: string): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(what));
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
/** One line, or null when it is not one: an id, a real day and words are the least a line is. */
const lineOf = (v: unknown): Learning | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id || typeof o.text !== 'string' || !isISODate(o.date)) return null;
  return { id: o.id, date: o.date, text: o.text, createdAt: typeof o.createdAt === 'string' ? o.createdAt : '', editedAt: typeof o.editedAt === 'string' ? o.editedAt : null };
};
/** A page of the list. Throws when the answer is not a list (the load failed); a line in a bad shape is left out. */
export const pageOf = (v: unknown): LearningPage => {
  const o = objectOf(v, 'the list');
  if (!Array.isArray(o.learnings)) return fail('the list');
  return { learnings: o.learnings.flatMap((x) => lineOf(x) ?? []), next: typeof o.next === 'string' && o.next ? o.next : null };
};
/** The stats, with counts that are whole and never negative. `recent` stays absent when the server did not send it. */
export const statsOf = (v: unknown): LearningStats => {
  const o = objectOf(v, 'the stats');
  const out: LearningStats = { days: count(o.days), streak: count(o.streak), total: count(o.total) };
  if (Array.isArray(o.recent)) out.recent = o.recent.filter(isISODate);
  return out;
};
/** The archive's months: only the ones that name a month and hold a line. */
export const monthsOf = (v: unknown): LearningMonth[] => {
  const list = objectOf(v, 'the months').months;
  if (!Array.isArray(list)) return fail('the months');
  return list.flatMap((x) => {
    const m = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    if (typeof m.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m.month) || count(m.count) < 1) return [];
    return [{ month: m.month, count: count(m.count), days: Math.max(1, count(m.days)), latest: typeof m.latest === 'string' ? m.latest : '' }];
  });
};
export const echoesOf = (v: unknown): LearningEchoes => {
  const o = objectOf(v, 'the archive');
  return { yearAgo: lineOf(o.yearAgo), monthAgo: lineOf(o.monthAgo), random: lineOf(o.random) };
};
/** Every line a list holds, from the cache as it is (a copy kept on the device by another build may be in any shape). */
export const rowsOf = (d: InfiniteData<LearningPage, unknown> | undefined): Learning[] => (Array.isArray(d?.pages) ? d.pages.flatMap((p) => (Array.isArray(p?.learnings) ? p.learnings : [])) : []);

/**
 * Is there a line on `day`? By the stats' days of the week when the server sends them, and by the lines on the device
 * either way: a server from before `recent` never names the day, and a line still waiting to sync is not in its answer.
 */
export const keptOn = (day: string, stats: LearningStats | undefined, rows: readonly Learning[]): boolean => (Array.isArray(stats?.recent) && stats.recent.includes(day)) || rows.some((l) => l.date === day);

/** One page of a list as the server has it, with the changes still waiting to sync laid over it (queued.ts). */
export const fetchLearnings = async (f: LearnedFilter, before: string | null): Promise<LearningPage> => {
  const qs = new URLSearchParams({ limit: String(f.month ? 200 : PAGE) });
  if (f.month) qs.set('month', f.month);
  if (f.q) qs.set('q', f.q);
  if (before) qs.set('before', before);
  const page = pageOf(await api<unknown>(`/learnings?${qs}`));
  const key = learnedKeys.list(f);
  return { ...page, learnings: withQueued(page.learnings, outbox.peek(), { fits: (l) => fits(key, l), first: !before }).sort(order) };
};

export const useLearnings = (f: LearnedFilter = {}, enabled = true) =>
  useInfiniteQuery({
    queryKey: learnedKeys.list(f),
    queryFn: ({ pageParam }) => fetchLearnings(f, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.next ?? null,
    staleTime: 30_000,
    enabled,
    ...reads,
  });

export const useLearningMonths = () => useQuery({ queryKey: learnedKeys.months, queryFn: async () => monthsOf(await api<unknown>('/learnings/months')), staleTime: 30_000, ...reads });

export const useLearningStats = () => useQuery({ queryKey: learnedKeys.stats, queryFn: async () => statsOf(await api<unknown>('/learnings/stats')), staleTime: 30_000, ...reads });

/** From your archive: a year ago, a month ago, one at random (the server keeps the random one for the day). */
export const useLearningEchoes = (enabled = true) => useQuery({ queryKey: learnedKeys.echoes, queryFn: async () => echoesOf(await api<unknown>('/learnings/echoes')), staleTime: 5 * 60_000, enabled, ...reads });

/** Newest day first, newest first within a day: the server's order. */
const order = (a: Learning, b: Learning) => (a.date === b.date ? (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1);

/** True when a learning belongs in a list kept by this filter. */
const fits = (key: ListKey, l: Learning) => {
  const f = key[2];
  return (!f.month || l.date.startsWith(`${f.month}-`)) && (!f.q || l.text.toLowerCase().includes(f.q.toLowerCase()));
};
/**
 * Patch every loaded list in place (everything, a month, a search); `l` is the learning being written, so a list it does
 * not belong in only loses it. A new row goes on a list's first page (it is newest, or near enough to sort in there).
 */
const patchList = (qc: QueryClient, l: Learning, fn: (rows: Learning[], first: boolean) => Learning[]) => {
  for (const [key, d] of qc.getQueriesData<Pages>({ queryKey: learnedKeys.lists })) {
    if (!d || !Array.isArray(d.pages)) continue;
    const keep = fits(key as ListKey, l);
    qc.setQueryData<Pages>(key, {
      ...d,
      pages: d.pages.map((p, i) => {
        const rows = Array.isArray(p?.learnings) ? p.learnings : [];
        return { ...p, learnings: (keep ? fn(rows, i === 0) : rows.filter((x) => x.id !== l.id)).sort(order) };
      }),
    });
  }
};
const loaded = (qc: QueryClient) => {
  const seen = new Map<string, Learning>();
  for (const [, d] of qc.getQueriesData<Pages>({ queryKey: learnedKeys.lists })) for (const x of rowsOf(d)) seen.set(x.id, x);
  return [...seen.values()];
};
/**
 * A line saved while its month's list could not load still has to show: the month starts from an empty page, which the
 * save then puts the line on (the rest of the month arrives with the next load that works).
 */
const seedMonth = (qc: QueryClient, date: string) => {
  const key = learnedKeys.list({ month: date.slice(0, 7) });
  const st = qc.getQueryState<Pages>(key);
  if (st && st.data === undefined && st.status === 'error') qc.setQueryData<Pages>(key, { pages: [{ learnings: [], next: null }], pageParams: [null] });
};
/** The archive's row for a learning's month, one more or one fewer (a month with none left goes). */
const patchMonths = (qc: QueryClient, l: Learning, by: 1 | -1, newDay: boolean) =>
  qc.setQueryData<LearningMonth[]>(learnedKeys.months, (ms) => {
    if (!Array.isArray(ms)) return ms;
    const m = l.date.slice(0, 7);
    const days = newDay ? by : 0;
    if (!ms.some((x) => x.month === m)) return by > 0 ? [{ month: m, count: 1, days: 1, latest: l.text }, ...ms].sort((a, b) => (a.month < b.month ? 1 : -1)) : ms;
    return ms.map((x) => (x.month === m ? { ...x, count: x.count + by, days: Math.max(0, x.days + days) } : x)).filter((x) => x.count > 0);
  });
/** From your archive follows an edit or a delete of a line it shows (`next` null: the line is gone). */
const patchEchoes = (qc: QueryClient, id: string, next: Learning | null) =>
  qc.setQueryData<LearningEchoes>(learnedKeys.echoes, (e) => {
    if (!e || typeof e !== 'object') return e;
    const slot = (l: Learning | null) => (l && l.id === id ? next : l);
    return { yearAgo: slot(e.yearAgo), monthAgo: slot(e.monthAgo), random: slot(e.random) };
  });
/**
 * The stats after one line more or fewer on `date`. `newDay`: the day gained its first line or lost its last. `recent`
 * (the days of the last seven with a line, which Today's row reads) moves with it when the server sent one.
 */
const patchStats = (qc: QueryClient, today: string, date: string, by: 1 | -1, newDay: boolean) =>
  qc.setQueryData<LearningStats>(learnedKeys.stats, (s) => {
    if (!s) return s;
    const day = newDay ? by : 0;
    const out: LearningStats = { ...s, total: Math.max(0, s.total + by), days: Math.max(0, s.days + day), streak: date === today ? Math.max(0, s.streak + day) : s.streak };
    if (Array.isArray(s.recent) && newDay && date <= today && date >= shiftDays(today, -6)) out.recent = by > 0 ? [...new Set([...s.recent, date])].sort() : s.recent.filter((d) => d !== date);
    return out;
  });

/** Lines deleted from this page and not brought back by Undo. */
const deleted = new Set<string>();

/**
 * The four writes, apart from React so they are tested on their own. Each changes the page first, then sends. `settle`
 * (a refetch of everything) runs only once the server has answered: a queued write is refetched by the outbox when it
 * lands. A save the server refuses for good is taken back off the page at once and thrown.
 */
export const learnedWrites = (qc: QueryClient, today: string) => {
  const settle = () => void qc.invalidateQueries({ queryKey: learnedKeys.all });
  const hasDay = (date: string, except?: string) => loaded(qc).some((x) => x.date === date && x.id !== except);
  const begin = () => void qc.cancelQueries({ queryKey: learnedKeys.all });
  return {
    settle,
    add: async ({ date, text }: { date: string; text: string }): Promise<Learning> => {
      const tmp: Learning = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, date, text, createdAt: new Date().toISOString(), editedAt: null };
      begin();
      seedMonth(qc, date);
      const newDay = !hasDay(date);
      patchList(qc, tmp, (rows, first) => (first ? [tmp, ...rows] : rows));
      patchMonths(qc, tmp, 1, newDay);
      // today's first one lengthens the run by one (it ended yesterday, or there was none)
      patchStats(qc, today, date, 1, newDay);
      let saved: Learning | null;
      try {
        saved = await write<Learning>('/learnings', 'POST', { date, text }, [learnedKeys.all], { tmpId: tmp.id });
      } catch (e) {
        // refused for good: the line is not kept, so it leaves the page now (the caller gives the words back)
        const lastOfDay = !hasDay(date, tmp.id);
        patchList(qc, tmp, (rows) => rows.filter((x) => x.id !== tmp.id));
        patchMonths(qc, tmp, -1, lastOfDay);
        patchStats(qc, today, date, -1, lastOfDay);
        throw e;
      }
      if (!saved) return tmp;
      const real = saved;
      patchList(qc, real, (rows) => rows.map((x) => (x.id === tmp.id ? real : x)));
      settle();
      return real;
    },
    edit: async ({ item, text }: { item: Learning; text: string }): Promise<void> => {
      begin();
      const next = { ...item, text, editedAt: new Date().toISOString() };
      // a search it no longer matches lets it go; one it now matches gets it at the next refetch
      patchList(qc, next, (rows) => rows.map((x) => (x.id === item.id ? next : x)));
      patchEchoes(qc, item.id, next);
      if (await write(`/learnings/${item.id}`, 'PATCH', { text }, [learnedKeys.all])) settle();
    },
    restore: async (item: Learning): Promise<void> => {
      deleted.delete(item.id);
      begin();
      const newDay = !hasDay(item.date);
      patchList(qc, item, (rows, first) => (first ? [item, ...rows.filter((x) => x.id !== item.id)] : rows.filter((x) => x.id !== item.id)));
      patchMonths(qc, item, 1, newDay);
      // today's only one coming back lengthens the run again, as a first save does
      patchStats(qc, today, item.date, 1, newDay);
      if (await write(`/learnings/${item.id}/restore`, 'POST', undefined, [learnedKeys.all])) settle();
    },
    remove: async (item: Learning): Promise<void> => {
      // a second Delete of the same line (a double tap) is the first one: nothing is counted out or sent twice
      if (deleted.has(item.id)) return;
      deleted.add(item.id);
      begin();
      const lastOfDay = !hasDay(item.date, item.id);
      patchList(qc, item, (rows) => rows.filter((x) => x.id !== item.id));
      patchEchoes(qc, item.id, null);
      patchMonths(qc, item, -1, lastOfDay);
      // today's last one going takes today out of the run at once (the server's count follows at the refetch)
      patchStats(qc, today, item.date, -1, lastOfDay);
      try {
        if (await write(`/learnings/${item.id}`, 'DELETE', undefined, [learnedKeys.all])) settle();
      } catch (e) {
        deleted.delete(item.id);
        throw e;
      }
    },
  };
};

export const useLearnedMutations = (today: string) => {
  const qc = useQueryClient();
  const toast = useToast();
  const w = useMemo(() => learnedWrites(qc, today), [qc, today]);
  const add = useMutation({ mutationFn: w.add, onError: w.settle });
  const edit = useMutation({ mutationFn: w.edit, onError: w.settle });
  const restore = useMutation({ mutationFn: w.restore, onError: w.settle });
  const remove = useMutation({ mutationFn: w.remove, onError: w.settle });

  /** Delete with an Undo toast: the one way a learning goes, from any surface. */
  const del = (item: Learning) => {
    haptics.delete();
    remove.mutate(item);
    toast('Deleted', { label: 'Undo', fn: () => restore.mutate(item) });
  };

  return { add, edit, remove, restore, del };
};
