import type { Learning, LearningPage, LearningStats } from '@logbook/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { write } from '@/api/outbox';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/ui/Toast';

/**
 * What I learned: the list (paged newest first) and the stats line. Every write lands in the cache first (a provisional id
 * on a create), goes through the outbox (so it survives being offline) and is then reconciled with the server's answer.
 */
export const learnedKeys = {
  all: ['learnings'] as const,
  list: ['learnings', 'list'] as const,
  stats: ['learnings', 'stats'] as const,
};
const PAGE = 60;
type Pages = InfiniteData<LearningPage, string | null>;

export const useLearnings = () =>
  useInfiniteQuery({
    queryKey: learnedKeys.list,
    queryFn: ({ pageParam }) => api<LearningPage>(`/learnings?limit=${PAGE}${pageParam ? `&before=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    staleTime: 30_000,
  });

export const useLearningStats = () => useQuery({ queryKey: learnedKeys.stats, queryFn: () => api<LearningStats>('/learnings/stats'), staleTime: 30_000 });

/** Newest day first, newest first within a day: the server's order. */
const order = (a: Learning, b: Learning) => (a.date === b.date ? (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1);

/** Patch every loaded page in place; a new row goes on the first page (it is newest, or near enough to sort in there). */
const patchList = (qc: QueryClient, fn: (rows: Learning[], first: boolean) => Learning[]) =>
  qc.setQueryData<Pages>(learnedKeys.list, (d) => (d ? { ...d, pages: d.pages.map((p, i) => ({ ...p, learnings: fn(p.learnings, i === 0).sort(order) })) } : d));
const loaded = (qc: QueryClient) => qc.getQueryData<Pages>(learnedKeys.list)?.pages.flatMap((p) => p.learnings) ?? [];
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
      patchList(qc, (rows, first) => (first ? [tmp, ...rows] : rows));
      // today's first one lengthens the run by one (it ended yesterday, or there was none)
      patchStats(qc, (s) => ({ total: s.total + 1, days: s.days + (newDay ? 1 : 0), streak: newDay && date === today ? s.streak + 1 : s.streak }));
      const saved = await write<Learning>('/learnings', 'POST', { date, text }, [learnedKeys.all], { tmpId: tmp.id });
      if (saved) patchList(qc, (rows) => rows.map((x) => (x.id === tmp.id ? saved : x)));
      settle();
      return saved ?? tmp;
    },
    onError: settle,
  });

  const edit = useMutation({
    mutationFn: async ({ item, text }: { item: Learning; text: string }) => {
      void qc.cancelQueries({ queryKey: learnedKeys.all });
      patchList(qc, (rows) => rows.map((x) => (x.id === item.id ? { ...x, text, editedAt: new Date().toISOString() } : x)));
      await write(`/learnings/${item.id}`, 'PATCH', { text }, [learnedKeys.all]);
      settle();
    },
    onError: settle,
  });

  const restore = useMutation({
    mutationFn: async (item: Learning) => {
      void qc.cancelQueries({ queryKey: learnedKeys.all });
      const newDay = !hasDay(item.date);
      patchList(qc, (rows, first) => (first ? [item, ...rows.filter((x) => x.id !== item.id)] : rows.filter((x) => x.id !== item.id)));
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
      patchList(qc, (rows) => rows.filter((x) => x.id !== item.id));
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
