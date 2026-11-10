import type { Learning, LearningEchoes, LearningMonth, LearningPage, LearningStats } from '@logbook/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import { write } from '@/api/outbox';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/ui/Toast';

/**
 * What I learned: the list (paged newest first) and the stats line. Every write lands in the cache first (a provisional id
 * on a create), goes through the outbox (so it survives being offline) and is then reconciled with the server's answer.
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

export const useLearnings = (f: LearnedFilter = {}, enabled = true) =>
  useInfiniteQuery({
    queryKey: learnedKeys.list(f),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(f.month ? 200 : PAGE) });
      if (f.month) qs.set('month', f.month);
      if (f.q) qs.set('q', f.q);
      if (pageParam) qs.set('before', pageParam);
      return api<LearningPage>(`/learnings?${qs}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    staleTime: 30_000,
    enabled,
    ...reads,
  });

export const useLearningMonths = () => useQuery({ queryKey: learnedKeys.months, queryFn: async () => (await api<{ months: LearningMonth[] }>('/learnings/months')).months, staleTime: 30_000, ...reads });

export const useLearningStats = () => useQuery({ queryKey: learnedKeys.stats, queryFn: () => api<LearningStats>('/learnings/stats'), staleTime: 30_000, ...reads });

/** From your archive: a year ago, a month ago, one at random (the server keeps the random one for the day). */
export const useLearningEchoes = (enabled = true) => useQuery({ queryKey: learnedKeys.echoes, queryFn: () => api<LearningEchoes>('/learnings/echoes'), staleTime: 5 * 60_000, enabled, ...reads });

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
    if (!d) continue;
    const keep = fits(key as ListKey, l);
    qc.setQueryData<Pages>(key, { ...d, pages: d.pages.map((p, i) => ({ ...p, learnings: (keep ? fn(p.learnings, i === 0) : p.learnings.filter((x) => x.id !== l.id)).sort(order) })) });
  }
};
const loaded = (qc: QueryClient) => {
  const seen = new Map<string, Learning>();
  for (const [, d] of qc.getQueriesData<Pages>({ queryKey: learnedKeys.lists })) for (const p of d?.pages ?? []) for (const x of p.learnings) seen.set(x.id, x);
  return [...seen.values()];
};
/** The archive's row for a learning's month, one more or one fewer (a month with none left goes). */
const patchMonths = (qc: QueryClient, l: Learning, by: 1 | -1, newDay: boolean) =>
  qc.setQueryData<LearningMonth[]>(learnedKeys.months, (ms) => {
    if (!ms) return ms;
    const m = l.date.slice(0, 7);
    const days = newDay ? by : 0;
    if (!ms.some((x) => x.month === m)) return by > 0 ? [{ month: m, count: 1, days: 1, latest: l.text }, ...ms].sort((a, b) => (a.month < b.month ? 1 : -1)) : ms;
    return ms.map((x) => (x.month === m ? { ...x, count: x.count + by, days: Math.max(0, x.days + days) } : x)).filter((x) => x.count > 0);
  });
const patchStats = (qc: QueryClient, fn: (s: LearningStats) => LearningStats) => qc.setQueryData<LearningStats>(learnedKeys.stats, (s) => (s ? fn(s) : s));

export const useLearnedMutations = (today: string) => {
  const qc = useQueryClient();
  const toast = useToast();
  const settle = () => void qc.invalidateQueries({ queryKey: learnedKeys.all });
  const hasDay = (date: string, except?: string) => loaded(qc).some((x) => x.date === date && x.id !== except);

  const add = useMutation({
    mutationFn: async ({ date, text }: { date: string; text: string }) => {
      const tmp: Learning = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, date, text, createdAt: new Date().toISOString(), editedAt: null };
      void qc.cancelQueries({ queryKey: learnedKeys.all });
      const newDay = !hasDay(date);
      patchList(qc, tmp, (rows, first) => (first ? [tmp, ...rows] : rows));
      patchMonths(qc, tmp, 1, newDay);
      // today's first one lengthens the run by one (it ended yesterday, or there was none)
      patchStats(qc, (s) => ({ total: s.total + 1, days: s.days + (newDay ? 1 : 0), streak: newDay && date === today ? s.streak + 1 : s.streak }));
      const saved = await write<Learning>('/learnings', 'POST', { date, text }, [learnedKeys.all], { tmpId: tmp.id });
      if (saved) patchList(qc, saved, (rows) => rows.map((x) => (x.id === tmp.id ? saved : x)));
      settle();
      return saved ?? tmp;
    },
    onError: settle,
  });

  const edit = useMutation({
    mutationFn: async ({ item, text }: { item: Learning; text: string }) => {
      void qc.cancelQueries({ queryKey: learnedKeys.all });
      const next = { ...item, text, editedAt: new Date().toISOString() };
      // a search it no longer matches lets it go; one it now matches gets it at the next refetch
      patchList(qc, next, (rows) => rows.map((x) => (x.id === item.id ? next : x)));
      await write(`/learnings/${item.id}`, 'PATCH', { text }, [learnedKeys.all]);
      settle();
    },
    onError: settle,
  });

  const restore = useMutation({
    mutationFn: async (item: Learning) => {
      void qc.cancelQueries({ queryKey: learnedKeys.all });
      const newDay = !hasDay(item.date);
      patchList(qc, item, (rows, first) => (first ? [item, ...rows.filter((x) => x.id !== item.id)] : rows.filter((x) => x.id !== item.id)));
      patchMonths(qc, item, 1, newDay);
      patchStats(qc, (s) => ({ total: s.total + 1, days: s.days + (newDay ? 1 : 0), streak: s.streak }));
      await write(`/learnings/${item.id}/restore`, 'POST', undefined, [learnedKeys.all]);
      settle();
    },
    onError: settle,
  });

  const remove = useMutation({
    mutationFn: async (item: Learning) => {
      void qc.cancelQueries({ queryKey: learnedKeys.all });
      const lastOfDay = !hasDay(item.date, item.id);
      patchList(qc, item, (rows) => rows.filter((x) => x.id !== item.id));
      patchMonths(qc, item, -1, lastOfDay);
      patchStats(qc, (s) => ({ total: Math.max(0, s.total - 1), days: Math.max(0, s.days - (lastOfDay ? 1 : 0)), streak: s.streak }));
      await write(`/learnings/${item.id}`, 'DELETE', undefined, [learnedKeys.all]);
      settle();
    },
    onError: settle,
  });

  /** Delete with an Undo toast: the one way a learning goes, from any surface. */
  const del = (item: Learning) => {
    haptics.delete();
    remove.mutate(item);
    toast('Deleted', { label: 'Undo', fn: () => restore.mutate(item) });
  };

  return { add, edit, remove, restore, del };
};
