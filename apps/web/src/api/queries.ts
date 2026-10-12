import { addMonths, mondayOf, monthOf, monthsBetween, shiftDays, today, type Activity, type Habit, type HabitCheck, type JournalEntry, type LiftSet, type MorningDayOverride, type MorningSettings, type PlanBlock, type Quote, type Session, type SessionInput, type SessionMark, type Todo } from '@logbook/shared';
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './client';
import { write } from './outbox';
import type { Bootstrap, Daily, MonthBundle, QuotePage } from './types';

export const keys = {
  bootstrap: ['bootstrap'] as const,
  month: (m: string) => ['month', m] as const,
  todos: ['todos'] as const,
  daily: ['daily'] as const,
  lifts: ['lifts'] as const,
  activities: ['activities'] as const,
  journal: (q: string, fav: boolean) => ['journal', q, fav] as const,
  quotes: (p: Record<string, string | number>) => ['quotes', p] as const,
};

// ---------- reads ----------
export const useBootstrap = () => useQuery({ queryKey: keys.bootstrap, queryFn: () => api<Bootstrap>('/bootstrap'), staleTime: 60_000 });

export const fetchMonth = (m: string) => api<MonthBundle>(`/months/${m}`);
export const useMonth = (m: string) => useQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 });

/** Several months at once; the result map only has the ones that have loaded. */
export const useMonths = (months: string[]) => {
  const results = useQueries({ queries: months.map((m) => ({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 })) });
  // identity only changes when a month's data actually changes, so downstream memos stay cheap
  const sig = results.map((r) => r.dataUpdatedAt).join('|') + '#' + months.join(',');
  const bundles = useMemo(() => {
    const out: Record<string, MonthBundle> = {};
    results.forEach((r, i) => {
      if (r.data) out[months[i]!] = r.data;
    });
    return out;
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = months.every((m) => bundles[m]);
  return { bundles, ready, loading: results.some((r) => r.isPending), error: results.find((r) => r.error)?.error ?? null };
};

export const monthsAround = (date: string, before = 1, after = 1) => monthsBetween(addMonths(date, -before), addMonths(date, after));

export const useTodos = () => useQuery({ queryKey: keys.todos, queryFn: () => api<Todo[]>('/todos'), staleTime: 30_000 });
export const useDaily = () => useQuery({ queryKey: keys.daily, queryFn: () => api<Daily>('/journal/daily'), staleTime: 5 * 60_000 });
export const useAllLifts = () => useQuery({ queryKey: keys.lifts, queryFn: () => api<LiftSet[]>('/lifts'), staleTime: 60_000 });
export const useActivities = () => useQuery({ queryKey: keys.activities, queryFn: () => api<Activity[]>(`/activities?from=${shiftDays(today(), -120)}&to=${shiftDays(today(), 7)}`), staleTime: 60_000 });
export const useJournalList = (q: string, fav: boolean) =>
  useQuery({ queryKey: keys.journal(q, fav), queryFn: () => api<{ entries: JournalEntry[]; more: boolean }>(`/journal?q=${encodeURIComponent(q)}&fav=${fav ? 1 : 0}&limit=200`), staleTime: 30_000 });
export const useQuotes = (p: { theme?: string; q?: string; fav?: boolean; limit?: number; offset?: number }) => {
  const params: Record<string, string | number> = { theme: p.theme ?? 'All', q: p.q ?? '', fav: p.fav ? 1 : 0, limit: p.limit ?? 40, offset: p.offset ?? 0 };
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return useQuery({ queryKey: keys.quotes(params), queryFn: () => api<QuotePage>(`/quotes?${qs}`), staleTime: 5 * 60_000, placeholderData: (prev) => prev });
};

/** After bootstrap: pull what each tab asks for first, so a tab switch never waits on the network. */
export const prefetchAll = (qc: QueryClient) => {
  const t = today();
  const from = shiftDays(mondayOf(t), -7 * 12);
  const to = shiftDays(mondayOf(t), 7 * 4 + 6);
  const quoteParams = { theme: 'All', q: '', fav: 0, limit: 40, offset: 0 };
  const qs = new URLSearchParams(Object.entries(quoteParams).map(([k, v]) => [k, String(v)])).toString();
  const jobs: Array<Promise<unknown>> = [
    ...monthsBetween(from, to).map((m) => qc.prefetchQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 })),
    qc.prefetchQuery({ queryKey: keys.todos, queryFn: () => api<Todo[]>('/todos'), staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: keys.daily, queryFn: () => api<Daily>('/journal/daily'), staleTime: 5 * 60_000 }),
    qc.prefetchQuery({ queryKey: keys.lifts, queryFn: () => api<LiftSet[]>('/lifts'), staleTime: 60_000 }),
    qc.prefetchQuery({ queryKey: keys.journal('', false), queryFn: () => api<{ entries: JournalEntry[]; more: boolean }>('/journal?q=&fav=0&limit=200'), staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: keys.quotes(quoteParams), queryFn: () => api<QuotePage>(`/quotes?${qs}`), staleTime: 5 * 60_000 }),
  ];
  return Promise.allSettled(jobs);
};

// ---------- cache helpers ----------
const patchMonth = (qc: QueryClient, month: string, fn: (b: MonthBundle) => MonthBundle) => {
  qc.setQueryData<MonthBundle>(keys.month(month), (b) => (b ? fn(b) : b));
};
const emptyBundle = (month: string): MonthBundle => ({ month, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] });
const ensureMonth = (qc: QueryClient, month: string) => {
  if (!qc.getQueryData(keys.month(month))) qc.setQueryData(keys.month(month), emptyBundle(month));
};
const invalidateMonth = (qc: QueryClient, ...months: string[]) => {
  for (const m of new Set(months)) void qc.invalidateQueries({ queryKey: keys.month(m) });
};

// ---------- sessions ----------
export const useSessionMutations = () => {
  const qc = useQueryClient();
  const upsert = useMutation({
    mutationFn: async (input: SessionInput & { prevDate?: string }) => {
      const month = monthOf(input.date);
      const id = input.id ?? `tmp-${Math.random().toString(36).slice(2, 10)}`;
      const optimistic: Session = {
        id,
        date: input.date,
        position: 999,
        kind: input.kind,
        type: input.type ?? null,
        title: input.title || null,
        details: input.details || null,
        miles: input.kind === 'run' ? input.miles ?? null : null,
        minutes: input.minutes ?? null,
        blockId: null,
        movedFrom: null,
        mark: null,
      };
      if (input.prevDate && monthOf(input.prevDate) !== month) patchMonth(qc, monthOf(input.prevDate), (b) => ({ ...b, sessions: b.sessions.filter((s) => s.id !== id) }));
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => {
        const cur = b.sessions.find((s) => s.id === id);
        const next = cur ? { ...cur, ...optimistic, position: cur.position, blockId: cur.blockId, mark: cur.mark, movedFrom: cur.movedFrom } : optimistic;
        return { ...b, sessions: [...b.sessions.filter((s) => s.id !== id), next].sort((a, b2) => (a.date === b2.date ? a.position - b2.position : a.date < b2.date ? -1 : 1)) };
      });
      const { prevDate, ...body } = input;
      const saved = await write<Session>('/sessions', 'POST', { ...body, id: input.id }, [keys.month(month), ...(prevDate ? [keys.month(monthOf(prevDate))] : [])]);
      if (saved) patchMonth(qc, month, (b) => ({ ...b, sessions: b.sessions.map((s) => (s.id === id ? saved : s)) }));
      return saved;
    },
    onError: (_e, input) => invalidateMonth(qc, monthOf(input.date), ...(input.prevDate ? [monthOf(input.prevDate)] : [])),
  });
  const remove = useMutation({
    mutationFn: async (s: Session) => {
      patchMonth(qc, monthOf(s.date), (b) => ({ ...b, sessions: b.sessions.filter((x) => x.id !== s.id) }));
      await write(`/sessions/${s.id}`, 'DELETE', undefined, [keys.month(monthOf(s.date))]);
    },
    onError: (_e, s) => invalidateMonth(qc, monthOf(s.date)),
  });
  const restore = useMutation({
    mutationFn: async (s: Session) => {
      patchMonth(qc, monthOf(s.date), (b) => ({ ...b, sessions: [...b.sessions.filter((x) => x.id !== s.id), s].sort((a, b2) => (a.date === b2.date ? a.position - b2.position : a.date < b2.date ? -1 : 1)) }));
      const saved = await write<Session>(`/sessions/${s.id}/restore`, 'POST', {}, [keys.month(monthOf(s.date))]);
      if (saved) patchMonth(qc, monthOf(s.date), (b) => ({ ...b, sessions: b.sessions.map((x) => (x.id === saved.id ? saved : x)) }));
    },
    onError: (_e, s) => invalidateMonth(qc, monthOf(s.date)),
  });
  const move = useMutation({
    mutationFn: async ({ session, to }: { session: Session; to: string }) => {
      const from = session.date;
      const moved: Session = { ...session, date: to, movedFrom: session.movedFrom === to ? null : session.movedFrom ?? from, position: 999 };
      patchMonth(qc, monthOf(from), (b) => ({ ...b, sessions: b.sessions.filter((x) => x.id !== session.id) }));
      ensureMonth(qc, monthOf(to));
      patchMonth(qc, monthOf(to), (b) => ({ ...b, sessions: [...b.sessions.filter((x) => x.id !== session.id), moved] }));
      const saved = await write<Session>(`/sessions/${session.id}/move`, 'POST', { to }, [keys.month(monthOf(from)), keys.month(monthOf(to))]);
      if (saved) patchMonth(qc, monthOf(to), (b) => ({ ...b, sessions: b.sessions.map((x) => (x.id === saved.id ? saved : x)) }));
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.session.date), monthOf(v.to)),
  });
  const mark = useMutation({
    mutationFn: async ({ session, mark: m }: { session: Session; mark: SessionMark | null }) => {
      patchMonth(qc, monthOf(session.date), (b) => ({ ...b, sessions: b.sessions.map((x) => (x.id === session.id ? { ...x, mark: m } : x)) }));
      await write(`/sessions/${session.id}/mark`, 'POST', { mark: m }, [keys.month(monthOf(session.date))]);
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.session.date)),
  });
  return { upsert, remove, restore, move, mark };
};

// ---------- habits ----------
export const useHabitMutations = () => {
  const qc = useQueryClient();
  const setHabits = (habits: Habit[]) => qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, habits } : b));
  const add = useMutation({
    mutationFn: async (name: string) => {
      const list = await write<Habit[]>('/habits', 'POST', { name }, [keys.bootstrap]);
      if (list) setHabits(list);
      else {
        const b = qc.getQueryData<Bootstrap>(keys.bootstrap);
        if (b) setHabits([...b.habits, { id: `tmp-${Date.now()}`, name, position: b.habits.length, createdOn: today(), archivedOn: null }]);
      }
    },
  });
  const patch = useMutation({
    mutationFn: async ({ id, name, archived }: { id: string; name?: string; archived?: boolean }) => {
      const b = qc.getQueryData<Bootstrap>(keys.bootstrap);
      if (b) setHabits(b.habits.map((h) => (h.id === id ? { ...h, name: name ?? h.name, archivedOn: archived === undefined ? h.archivedOn : archived ? today() : null } : h)));
      const list = await write<Habit[]>(`/habits/${id}`, 'PATCH', { name, archived }, [keys.bootstrap]);
      if (list) setHabits(list);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
  });
  const reorder = useMutation({
    mutationFn: async (order: string[]) => {
      const b = qc.getQueryData<Bootstrap>(keys.bootstrap);
      if (b) {
        const pos = new Map(order.map((id, i) => [id, i]));
        setHabits([...b.habits].map((h) => ({ ...h, position: pos.get(h.id) ?? h.position })).sort((x, y) => x.position - y.position));
      }
      const list = await write<Habit[]>('/habits/order', 'PUT', { order }, [keys.bootstrap]);
      if (list) setHabits(list);
    },
  });
  const check = useMutation({
    mutationFn: async ({ habitId, date, done, note }: { habitId: string; date: string; done?: boolean; note?: string | null }) => {
      const month = monthOf(date);
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => {
        const cur = b.checks.find((c) => c.habitId === habitId && c.date === date);
        const next: HabitCheck = { habitId, date, done: done ?? cur?.done ?? false, note: note === undefined ? cur?.note ?? null : note };
        return { ...b, checks: [...b.checks.filter((c) => !(c.habitId === habitId && c.date === date)), next] };
      });
      await write(`/habits/${habitId}/days/${date}`, 'PUT', { done, note }, [keys.month(month)]);
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.date)),
  });
  return { add, patch, reorder, check };
};

// ---------- lifts ----------
export const useLiftMutations = () => {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: async (input: { date: string; exercise: string; weight: number; reps: number }) => {
      const month = monthOf(input.date);
      const tmp: LiftSet = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, ...input, createdAt: new Date().toISOString() };
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => ({ ...b, lifts: [...b.lifts, tmp] }));
      qc.setQueryData<LiftSet[]>(keys.lifts, (l) => (l ? [...l, tmp] : l));
      const saved = await write<LiftSet>('/lifts', 'POST', input, [keys.month(month), keys.lifts]);
      if (saved) {
        patchMonth(qc, month, (b) => ({ ...b, lifts: b.lifts.map((x) => (x.id === tmp.id ? saved : x)) }));
        qc.setQueryData<LiftSet[]>(keys.lifts, (l) => (l ? l.map((x) => (x.id === tmp.id ? saved : x)) : l));
      }
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.date)),
  });
  const remove = useMutation({
    mutationFn: async (s: LiftSet) => {
      patchMonth(qc, monthOf(s.date), (b) => ({ ...b, lifts: b.lifts.filter((x) => x.id !== s.id) }));
      qc.setQueryData<LiftSet[]>(keys.lifts, (l) => (l ? l.filter((x) => x.id !== s.id) : l));
      await write(`/lifts/${s.id}`, 'DELETE', undefined, [keys.month(monthOf(s.date)), keys.lifts]);
    },
    onError: (_e, s) => invalidateMonth(qc, monthOf(s.date)),
  });
  return { add, remove };
};

// ---------- todos ----------
export const useTodoMutations = () => {
  const qc = useQueryClient();
  const setTodos = (fn: (t: Todo[]) => Todo[]) => qc.setQueryData<Todo[]>(keys.todos, (t) => fn(t ?? []));
  const add = useMutation({
    mutationFn: async ({ text, date }: { text: string; date: string }) => {
      const tmp: Todo = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, text, note: null, createdOn: date, doneOn: null, deletedOn: null, createdAt: new Date().toISOString() };
      setTodos((t) => [...t, tmp]);
      const saved = await write<Todo>('/todos', 'POST', { text, date }, [keys.todos]);
      if (saved) setTodos((t) => t.map((x) => (x.id === tmp.id ? saved : x)));
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.todos }),
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: string; text?: string; note?: string | null; doneOn?: string | null; deletedOn?: string | null }) => {
      setTodos((t) => t.map((x) => (x.id === id ? { ...x, ...p } : x)));
      await write(`/todos/${id}`, 'PATCH', p, [keys.todos]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.todos }),
  });
  return { add, patch };
};

// ---------- morning ----------
export const useMorningMutations = () => {
  const qc = useQueryClient();
  const settings = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const saved = await write<MorningSettings>('/morning/settings', 'PATCH', patch, [keys.bootstrap]);
      if (saved) qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: saved } : b));
      else qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: deepMerge(b.morningSettings, patch) as MorningSettings } : b));
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
  });
  const setDay = useMutation({
    mutationFn: async ({ date, day }: { date: string; day: MorningDayOverride | null }) => {
      const month = monthOf(date);
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => {
        const next = { ...b.morningDays };
        if (day) next[date] = day;
        else delete next[date];
        return { ...b, morningDays: next };
      });
      if (day) await write(`/morning/days/${date}`, 'PUT', day, [keys.month(month)]);
      else await write(`/morning/days/${date}`, 'DELETE', undefined, [keys.month(month)]);
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.date)),
  });
  return { settings, setDay };
};
const deepMerge = (a: any, b: any): any => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
};

// ---------- journal & quotes ----------
export const useJournalMutations = () => {
  const qc = useQueryClient();
  const bump = () => {
    void qc.invalidateQueries({ queryKey: ['journal'] });
    void qc.invalidateQueries({ queryKey: keys.daily });
  };
  const add = useMutation({
    mutationFn: async ({ date, text }: { date: string; text: string }) => {
      const month = monthOf(date);
      const tmp: JournalEntry = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, date, text, createdAt: new Date().toISOString(), editedAt: null, fav: false };
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => ({ ...b, journal: [...b.journal, tmp] }));
      const saved = await write<JournalEntry>('/journal', 'POST', { date, text }, [keys.month(month), ['journal']]);
      if (saved) patchMonth(qc, month, (b) => ({ ...b, journal: b.journal.map((x) => (x.id === tmp.id ? saved : x)) }));
      bump();
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.date)),
  });
  const patch = useMutation({
    mutationFn: async ({ entry, text, fav }: { entry: JournalEntry; text?: string; fav?: boolean }) => {
      patchMonth(qc, monthOf(entry.date), (b) => ({ ...b, journal: b.journal.map((x) => (x.id === entry.id ? { ...x, text: text ?? x.text, fav: fav ?? x.fav, editedAt: text ? new Date().toISOString() : x.editedAt } : x)) }));
      await write(`/journal/${entry.id}`, 'PATCH', { text, fav }, [keys.month(monthOf(entry.date)), ['journal']]);
      bump();
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.entry.date)),
  });
  const remove = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      patchMonth(qc, monthOf(entry.date), (b) => ({ ...b, journal: b.journal.filter((x) => x.id !== entry.id) }));
      await write(`/journal/${entry.id}`, 'DELETE', undefined, [keys.month(monthOf(entry.date)), ['journal']]);
      bump();
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.date)),
  });
  const restore = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      patchMonth(qc, monthOf(entry.date), (b) => ({ ...b, journal: [...b.journal, entry] }));
      await write(`/journal/${entry.id}/restore`, 'POST', undefined, [keys.month(monthOf(entry.date)), ['journal']]);
      bump();
    },
  });
  const another = useMutation({
    mutationFn: async (kind: 'memory' | 'quote') => {
      const r = await api<{ kind: string; item: JournalEntry | Quote | null }>('/journal/daily/another', { method: 'POST', json: { kind } });
      qc.setQueryData<Daily>(keys.daily, (d) => (d ? { ...d, [kind]: r.item } : d));
    },
  });
  const quotePrefs = useMutation({
    mutationFn: async ({ id, fav, hidden }: { id: string; fav?: boolean; hidden?: boolean }) => {
      qc.setQueryData<Daily>(keys.daily, (d) => (d && d.quote?.id === id && fav !== undefined ? { ...d, quote: { ...d.quote, fav } } : d));
      qc.setQueriesData<QuotePage>({ queryKey: ['quotes'] }, (p) => (p ? { ...p, quotes: p.quotes.map((q) => (q.id === id ? { ...q, fav: fav ?? q.fav } : q)).filter((q) => !(hidden && q.id === id)) } : p));
      await write(`/quotes/${id}/prefs`, 'PUT', { fav, hidden }, [['quotes'], keys.daily]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['quotes'] }),
  });
  const addQuote = useMutation({
    mutationFn: async (input: { text: string; author: string }) => {
      const q = await api<Quote>('/quotes', { method: 'POST', json: input });
      void qc.invalidateQueries({ queryKey: ['quotes'] });
      return q;
    },
  });
  const removeQuote = useMutation({
    mutationFn: async (id: string) => {
      qc.setQueriesData<QuotePage>({ queryKey: ['quotes'] }, (p) => (p ? { ...p, quotes: p.quotes.filter((q) => q.id !== id), total: p.total - 1 } : p));
      await write(`/quotes/${id}`, 'DELETE', undefined, [['quotes']]);
    },
  });
  return { add, patch, remove, restore, another, quotePrefs, addQuote, removeQuote };
};

// ---------- blocks ----------
export const useBlockMutations = () => {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async (b: PlanBlock) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (bs) => (bs ? { ...bs, blocks: bs.blocks.filter((x) => x.id !== b.id) } : bs));
      await api(`/blocks/${b.id}`, { method: 'DELETE' });
      for (const m of monthsBetween(shiftDays(b.start, -14), shiftDays(b.end, 14))) void qc.invalidateQueries({ queryKey: keys.month(m) });
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
  });
  return { remove };
};
