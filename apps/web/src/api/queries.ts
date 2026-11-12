import { askAndWait, type JobAnswer } from '@/features/assistant/poll';
import { type Attachment, addMonths, mondayOf, monthOf, monthsBetween, shiftDays, today, type Activity, type Habit, type HabitCheck, type JournalEntry, type LiftSet, type Link, type LinkVerdict, type MorningDayOverride, type MorningSettings, type PickResult, type PlanBlock, type Quote, type Session, type SessionInput, type SessionMark, type Todo, type TodoBucket, type TodoColor, type TodoGroup, type TodoPriority, type Aim, type GoalEvent, type GoalLevel, type GoalStatus, type GoalStep, type AssistantApplied, type AssistantProposal, type AssistantReply, type TemplateInput, type DayBands, type DayPlan, cleanBands, emptyBands, type SavedTrainingProfile, type TrainingProfile, type TrainingStatus, type TrainingStatusKind, type ISODate } from '@logbook/shared';
import { useIsMutating, useMutation, useQueries, useQuery, useQueryClient, type QueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { STRAVA_BUILT } from '@/lib/features';
import { STRAVA_GAP_MS } from '@/lib/gesture';
import { BadShapeError, parseBootstrap } from './bootstrap';
import { api, ApiError, LONG_TIMEOUT_MS, NetworkError } from './client';
import { wholeMonth } from './monthShape';
import { outbox, write } from './outbox';
import type { Bootstrap, Daily, ExportBundle, MonthBundle, OnboardingAnswers, OnboardingResult, TemplateApplied } from './types';

// The blocks below are cut once (docs/feel.md build plan §0, contracts §E): each package edits only its own block.
// `keys` is shared: a package adds its own keys inside its block with Object.assign(keys, { … }), never edits another's.

// ── WP1 ──
// (an import inside the block, so the shared header above stays untouched)
import { useSyncExternalStore } from 'react';
export const keys = {
  bootstrap: ['bootstrap'] as const,
  month: (m: string) => ['month', m] as const,
  todos: ['todos'] as const,
  daily: ['daily'] as const,
  lifts: ['lifts'] as const,
  activities: ['activities'] as const,
  journal: (q: string, fav: boolean) => ['journal', q, fav] as const,
  reads: ['reads'] as const,
  pick: (date: string) => ['reads-pick', date] as const,
};

// ---------- reads ----------
/**
 * The server stamps the bootstrap with `serverTime`; it is dropped before caching, so a refetch that brings nothing new keeps
 * the cached object's identity (TanStack's structural sharing) and nothing downstream re-renders or re-runs (critic C1).
 * `enabled: false` holds the request (a cold open with nothing cached and no account on this device waits for GET /auth/status).
 */
export const fetchBootstrap = async (): Promise<Bootstrap> => {
  const raw = await api<unknown>('/bootstrap');
  if (!raw || typeof raw !== 'object') throw new BadShapeError('not an object');
  const { serverTime: _serverTime, ...b } = raw as Record<string, unknown>;
  // checked before it reaches the cache: an answer in a bad shape is an error, and the last good copy stays (api/bootstrap.ts)
  return parseBootstrap(b);
};
export const useBootstrap = (opts: { enabled?: boolean } = {}) => useQuery({ queryKey: keys.bootstrap, queryFn: fetchBootstrap, staleTime: 60_000, enabled: opts.enabled ?? true });

/** One month, made whole at the door (monthShape.ts): every reader may trust its lists and each session's fields. */
export const fetchMonth = (m: string) => api<unknown>(`/months/${m}`).then(wholeMonth);
export const useMonth = (m: string) => useQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 });

const versions = new WeakMap<object, number>();
let nextVersion = 1;
/** A stable number per data object, so a change is seen even when two updates share a timestamp. */
const dataVersion = (d: unknown) => {
  if (!d || typeof d !== 'object') return 0;
  let v = versions.get(d);
  if (!v) versions.set(d, (v = nextVersion++));
  return v;
};

/** Several months at once; the result map only has the ones that have loaded. */
export const useMonths = (months: string[]) => {
  const results = useQueries({ queries: months.map((m) => ({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 })) });
  // identity only changes when a month's data actually changes (a refetch that brings the same data keeps the object, so
  // its version is unchanged), so downstream memos stay cheap
  const sig = results.map((r) => dataVersion(r.data)).join('|') + '#' + months.join(',');
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

/**
 * After bootstrap, once per session: pull what each tab asks for first, so a tab switch never waits on the network. The
 * months cover the shown month ± 1, Plan's weeks around today and Progress's 7-month range (critic C11).
 */
export const prefetchAll = (qc: QueryClient) => {
  const t = today();
  const from = shiftDays(mondayOf(t), -7 * 12);
  const to = shiftDays(mondayOf(t), 7 * 4 + 6);
  const months = [...new Set([...monthsBetween(from, to), ...monthsBetween(addMonths(t, -7), addMonths(t, 1))])];
  const jobs: Array<Promise<unknown>> = [
    ...months.map((m) => qc.prefetchQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 })),
    qc.prefetchQuery({ queryKey: keys.todos, queryFn: () => api<Todo[]>('/todos'), staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: dayPlanKey(today()), queryFn: () => fetchDayPlan(today()), staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: keys.daily, queryFn: () => api<Daily>('/journal/daily'), staleTime: 5 * 60_000 }),
    qc.prefetchQuery({ queryKey: keys.lifts, queryFn: () => api<LiftSet[]>('/lifts'), staleTime: 60_000 }),
    qc.prefetchQuery({ queryKey: keys.journal('', false), queryFn: () => api<{ entries: JournalEntry[]; more: boolean }>('/journal?q=&fav=0&limit=200'), staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: keys.reads, queryFn: fetchReads, staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: ['goals'], queryFn: () => api<Aim[]>('/goals'), staleTime: 30_000 }),
    qc.prefetchQuery({ queryKey: ['todo-groups'], queryFn: () => api<TodoGroup[]>('/todo-groups'), staleTime: 60_000 }),
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

/** Real id → the provisional id a row was born with, so its React key never changes and a drag survives the naming. */
const keyAlias = new Map<string, string>();
export const clientKey = (id: string) => keyAlias.get(id) ?? id;

/**
 * The run connection (Strava) is built only when STRAVA_BUILT is true (lib/features.ts). The flag is a constant, so in a
 * build without it each export below is its short stand-in and the real code, with its request, is left out of the bundle.
 * The exports keep their names and shapes either way, so a screen that still imports one compiles and does nothing.
 *
 * With it: Today's pull to refresh is "check for a run now": ask the server to pull new activities, and when anything
 * changed, refetch the months and activities so the hero can draw the run. The bootstrap (which carries the last sync time)
 * is patched from the answer rather than refetched, so a check never sets off another one. The server joins a sync already
 * running, so the answer is always the real one. Called on a pull on Today (useStravaCheck) and once on every return to
 * the foreground while connected (main.tsx), decisions.md 7.
 */
export interface StravaSyncAnswer {
  changed?: number;
  joined?: boolean;
  status?: Bootstrap['strava'];
}
export const syncStrava: (qc: QueryClient) => Promise<StravaSyncAnswer> = STRAVA_BUILT
  ? async (qc) => {
      const r = await api<StravaSyncAnswer>('/strava/sync', { method: 'POST' });
      if (r.status) qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, strava: r.status! } : b));
      if (r.changed) {
        await qc.invalidateQueries({ queryKey: ['month'] });
        void qc.invalidateQueries({ queryKey: keys.activities });
      }
      return r;
    }
  : async () => ({});
export const STRAVA_SYNC_KEY = ['run-sync'] as const;
let lastSync: { at: number; promise: Promise<StravaSyncAnswer>; quiet: boolean; settled: boolean } | null = null;
/**
 * The same request through the mutation cache under STRAVA_SYNC_KEY, registered synchronously so useIsMutating sees it on
 * the calling frame (the open face's status line). At most once per STRAVA_GAP_MS: a call inside the gap returns the running
 * or last promise, unless `force` (the landing's one +8 s repeat, pull to refresh). `quiet` marks the mutation's meta so the
 * status line ignores it.
 */
export const stravaSyncNow: (qc: QueryClient, opts?: { force?: boolean; quiet?: boolean }) => Promise<StravaSyncAnswer> = STRAVA_BUILT
  ? (qc, opts = {}) => {
      const now = Date.now();
      // inside the gap the last sync answers, unless it was quiet and this one is not (the status line must see this one)
      if (!opts.force && lastSync && now - lastSync.at < STRAVA_GAP_MS) {
        if (opts.quiet || !lastSync.quiet) return lastSync.promise;
        // a quiet sync still in flight: this call rides its request and raises the status line until it settles, rather than
        // sending a second, concurrent one (consumer review 2 #6)
        if (!lastSync.settled) {
          const ride = lastSync;
          ride.quiet = false;
          setChecking(1);
          const done = () => setChecking(-1);
          ride.promise.then(done, done);
          return ride.promise;
        }
      }
      const m = qc.getMutationCache().build(qc, { mutationKey: STRAVA_SYNC_KEY, mutationFn: () => syncStrava(qc), meta: opts.quiet ? { quiet: true } : undefined });
      const promise = m.execute(undefined);
      const rec = { at: now, promise, quiet: !!opts.quiet, settled: false };
      lastSync = rec;
      promise.then(
        () => void (rec.settled = true),
        () => {
          rec.settled = true;
          // a sync that failed is not handed to the next caller: it tries again (consumer review 1 #10)
          if (lastSync === rec) lastSync = null;
        },
      );
      if (!opts.quiet) {
        setChecking(1);
        const done = () => setChecking(-1);
        promise.then(done, done);
      }
      return promise;
    }
  : () => Promise.resolve({});
/*
 * The status line must show on the first frame after the call (spec 53): the mutation cache notifies React a task later
 * (notifyManager batches on setTimeout 0), so non-quiet syncs started here are also counted in a store React reads with
 * useSyncExternalStore, whose updates render before the next frame.
 */
let checking = 0;
const checkingSubs = new Set<() => void>();
const setChecking = (d: number) => {
  checking += d;
  for (const f of checkingSubs) f();
};
const subscribeChecking = (f: () => void) => {
  checkingSubs.add(f);
  return () => void checkingSubs.delete(f);
};
const getChecking = () => checking > 0;
/** The open face's status line: a non-quiet sync is in flight. Always false in a build without the connection. */
export const useStravaChecking: () => boolean = STRAVA_BUILT
  ? () => {
      const started = useSyncExternalStore(subscribeChecking, getChecking, () => false);
      const mutating = useIsMutating({ mutationKey: STRAVA_SYNC_KEY, predicate: (m) => !m.meta?.quiet }) > 0;
      return started || mutating;
    }
  : () => false;
/** Pull to refresh's old path, kept: the same request and key. */
export const useStravaCheck = (): UseMutationResult<StravaSyncAnswer, Error, void> => {
  const qc = useQueryClient();
  return useMutation({ mutationKey: STRAVA_SYNC_KEY, mutationFn: () => syncStrava(qc) });
};
// ── end WP1 ──

// ── WP2 ──
export const useTodos = () => useQuery({ queryKey: keys.todos, queryFn: () => api<Todo[]>('/todos'), staleTime: 30_000 });
export const useDaily = () => useQuery({ queryKey: keys.daily, queryFn: () => api<Daily>('/journal/daily'), staleTime: 5 * 60_000 });
export const useAllLifts = () => useQuery({ queryKey: keys.lifts, queryFn: () => api<LiftSet[]>('/lifts'), staleTime: 60_000 });
export const useActivities = () => useQuery({ queryKey: keys.activities, queryFn: () => api<Activity[]>(`/activities?from=${shiftDays(today(), -120)}&to=${shiftDays(today(), 7)}`), staleTime: 60_000 });

// ---------- sessions ----------
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** An id for a session made on this device, in the shape the server makes its own (`p` and twelve letters or digits). */
export const newSessionId = (): string => {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = 'p';
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
};
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
  /**
   * A new session made in one step (Plan's Add sheet), through the same `POST /sessions`. Its id is made here
   * (`newSessionId`), not by the server, so the row keeps its identity from the first frame (no remount when the server
   * answers), and the create is registered with the outbox under that id: Undo, a mark or an edit that names it before
   * the server has answered waits behind the create, online or offline, and a replay of the create lands once (the same
   * id is an update, never a second row). `mark` (a past day is added as done) goes as its own write, queued behind the
   * create. The caller says what failed, with a way to try again (`meta.handlesError`: the app's own one-line toast stays
   * quiet); a create refused for good takes the writes that waited on it out of the queue.
   */
  const add = useMutation({
    meta: { handlesError: true },
    mutationFn: async (s: Session) => {
      const month = monthOf(s.date);
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => ({ ...b, sessions: [...b.sessions.filter((x) => x.id !== s.id), s].sort((a, b2) => (a.date === b2.date ? a.position - b2.position : a.date < b2.date ? -1 : 1)) }));
      const refetch = [keys.month(month)];
      const created = write<Session>('/sessions', 'POST', { id: s.id, date: s.date, kind: s.kind, type: s.type, title: s.title, details: s.details, miles: s.kind === 'run' ? s.miles : null, minutes: s.minutes }, refetch, { tmpId: s.id });
      // it names the id, so it waits behind the create and goes out in order once the create is answered (or replayed)
      const marked = s.mark ? write(`/sessions/${s.id}/mark`, 'POST', { mark: s.mark }, refetch) : null;
      let saved: Session | null;
      try {
        saved = await created;
        await marked;
      } catch (e) {
        await outbox.forget(s.id);
        throw e;
      }
      // The server's row takes the place of the one written here only when it says something else (it rounds, it trims;
      // a server that names the row itself), and only while the row is still as it was written: touched since (a mark,
      // an edit), its own write settles it. When both say the same, nothing is written: a write here renders every
      // mounted tab, right after the sheet that added the row has fallen away. The place in the day is not compared (the
      // row was written last in its day, where the server puts it too).
      if (saved) {
        const shows = (a: Session, b: Session) => a.id === b.id && a.date === b.date && a.kind === b.kind && (a.type ?? null) === (b.type ?? null) && (a.title ?? null) === (b.title ?? null) && (a.details ?? null) === (b.details ?? null) && (a.miles ?? null) === (b.miles ?? null) && (a.minutes ?? null) === (b.minutes ?? null);
        const cur = qc.getQueryData<MonthBundle>(keys.month(month))?.sessions.find((x) => x.id === s.id);
        if (cur && shows(cur, s) && !shows(s, saved)) patchMonth(qc, month, (b) => ({ ...b, sessions: b.sessions.map((x) => (x.id === s.id ? { ...saved, mark: x.mark } : x)) }));
      }
      return saved;
    },
    // the row leaves at once (the server has none), then the month is read again
    onError: (_e, s) => {
      patchMonth(qc, monthOf(s.date), (b) => ({ ...b, sessions: b.sessions.filter((x) => x.id !== s.id) }));
      invalidateMonth(qc, monthOf(s.date));
    },
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
  return { upsert, add, remove, restore, move, mark };
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
    // the order went into the bootstrap before the request: a refused save takes the server's back (WP6 request 20)
    onError: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
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
type TodoPatch = { text?: string; note?: string | null; priority?: TodoPriority; color?: TodoColor | null; groupId?: string | null; due?: string | null; bucket?: TodoBucket; position?: number; doneOn?: string | null; deletedOn?: string | null };
/** The server's answer to an order change carries positions only: anything edited meanwhile keeps its edit. */
const takePositions = (t: Todo[], list: Todo[]) => {
  const pos = new Map(list.map((x) => [x.id, x.position]));
  return t.map((x) => (pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x));
};
/** A to-do's provisional id, fixed length: the outbox matches it as a substring, so it must never be a prefix of another. */
export const newTodoId = () => `tmp-${Math.random().toString(36).slice(2, 9).padEnd(7, '0')}`;

export const useTodoMutations = () => {
  const qc = useQueryClient();
  const setTodos = (fn: (t: Todo[]) => Todo[]) => qc.setQueryData<Todo[]>(keys.todos, (t) => fn(t ?? []));
  const add = useMutation({
    mutationFn: async (input: { id?: string; text: string; date: string; priority?: TodoPriority; due?: string | null; bucket?: TodoBucket; color?: TodoColor | null; groupId?: string | null }) => {
      const { text, date } = input;
      const bucket: TodoBucket = input.bucket ?? (input.due && input.due > date ? 'later' : 'today');
      const cur = qc.getQueryData<Todo[]>(keys.todos) ?? [];
      const tmp: Todo = {
        id: input.id ?? newTodoId(),
        text,
        note: null,
        priority: input.priority ?? 0,
        color: input.color ?? null,
        groupId: input.groupId ?? null,
        due: bucket === 'later' ? input.due ?? null : null,
        bucket,
        position: cur.reduce((m, x) => Math.max(m, x.position), -1) + 1,
        createdOn: date,
        doneOn: null,
        deletedOn: null,
        createdAt: new Date().toISOString(),
      };
      setTodos((t) => [...t, tmp]);
      // anything edited or moved while the row was provisional is queued behind this create and sent with its real id
      const saved = await write<Todo>('/todos', 'POST', { text, date, priority: tmp.priority, due: tmp.due, bucket, color: tmp.color, groupId: tmp.groupId }, [keys.todos], { tmpId: tmp.id });
      if (!saved) return;
      keyAlias.set(saved.id, tmp.id);
      setTodos((t) => t.map((x) => (x.id === tmp.id ? { ...x, id: saved.id, createdAt: saved.createdAt } : x)));
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.todos }),
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: string } & TodoPatch) => {
      // a date only belongs to a Later item
      const fix: TodoPatch = p.bucket && p.bucket !== 'later' ? { ...p, due: null } : p;
      setTodos((t) => t.map((x) => (x.id === id ? { ...x, ...fix } : x)));
      await write(`/todos/${id}`, 'PATCH', fix, [keys.todos]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.todos }),
  });
  /** After a drag: these ids, in this order, take positions 0..n. */
  const reorder = useMutation({
    mutationFn: async (order: string[]) => {
      const pos = new Map(order.map((id, i) => [id, i]));
      setTodos((t) => t.map((x) => (pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x)));
      const list = await write<Todo[]>('/todos/order', 'PUT', { order }, [keys.todos]);
      if (list) setTodos((t) => takePositions(t, list));
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.todos }),
  });
  return { add, patch, reorder };
};
// ── end WP2 ──

// ── WP3 ──
// The Morning team's block. Settings PATCH (the routine editor's one save) and the per-day override (the alarm drag, the
// alarm sheet, the late note's wake chip), both optimistic. A day's override is its alarm alone (spec §4.3): the body is
// exactly `{ wake }`, whatever the caller holds, and the cache keeps the same shape.
export const useMorningMutations = () => {
  const qc = useQueryClient();
  const settings = useMutation({
    // the page answers at once (a dropped step stays where it landed); the server's copy replaces this when it comes back
    onMutate: (patch: Record<string, unknown>) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: deepMerge(b.morningSettings, patch) as MorningSettings } : b));
    },
    mutationFn: async (patch: Record<string, unknown>) => {
      const saved = await write<MorningSettings>('/morning/settings', 'PATCH', patch, [keys.bootstrap]);
      if (saved) qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: saved } : b));
      else qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: deepMerge(b.morningSettings, patch) as MorningSettings } : b));
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
  });
  const setDay = useMutation({
    mutationFn: async ({ date, day: given }: { date: string; day: MorningDayOverride | null }) => {
      const day: MorningDayOverride | null = given ? { wake: given.wake } : null;
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
  // Sent at the tap, shown later (code review 2 N3): a sheet's Save goes on the wire (or into the outbox) the moment it is
  // tapped, so the app going away during the close cannot lose it; the cache, which is what re-renders the pages, takes the
  // change (and the server's answer) only once `landed` resolves, when the sheet's close has completed (code review 1 F3)
  const settingsLanded = useMutation({
    mutationFn: async ({ patch, landed }: { patch: Record<string, unknown>; landed: Promise<void> }) => {
      const req = write<MorningSettings>('/morning/settings', 'PATCH', patch, [keys.bootstrap]);
      let answer: { saved: MorningSettings | null } | null = null;
      req.then((saved) => void (answer = { saved }), () => undefined);
      await landed;
      // the server answered during the close: its copy alone, one render
      const merged = (b: Bootstrap | undefined) => (b ? { ...b, morningSettings: deepMerge(b.morningSettings, patch) as MorningSettings } : b);
      const early = answer as { saved: MorningSettings | null } | null;
      if (early?.saved) {
        const saved = early.saved;
        qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: saved } : b));
        return;
      }
      qc.setQueryData<Bootstrap>(keys.bootstrap, merged);
      const saved = await req;
      if (saved) qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, morningSettings: saved } : b));
      else qc.setQueryData<Bootstrap>(keys.bootstrap, merged);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.bootstrap }),
  });
  const setDayLanded = useMutation({
    mutationFn: async ({ date, day: given, landed }: { date: string; day: MorningDayOverride | null; landed: Promise<void> }) => {
      const day: MorningDayOverride | null = given ? { wake: given.wake } : null;
      const month = monthOf(date);
      const req = day ? write(`/morning/days/${date}`, 'PUT', day, [keys.month(month)]) : write(`/morning/days/${date}`, 'DELETE', undefined, [keys.month(month)]);
      req.catch(() => undefined);
      await landed;
      ensureMonth(qc, month);
      patchMonth(qc, month, (b) => {
        const next = { ...b.morningDays };
        if (day) next[date] = day;
        else delete next[date];
        return { ...b, morningDays: next };
      });
      await req;
    },
    onError: (_e, v) => invalidateMonth(qc, monthOf(v.date)),
  });
  return {
    settings,
    setDay,
    /** `settings.mutate(patch)`, sent now, on the page once `landed` resolves. */
    settingsWhen: (patch: Record<string, unknown>, landed: Promise<void>) => settingsLanded.mutate({ patch, landed }),
    /** `setDay.mutate({ date, day })`, sent now, on the page once `landed` resolves. */
    setDayWhen: (v: { date: string; day: MorningDayOverride | null }, landed: Promise<void>) => setDayLanded.mutate({ ...v, landed }),
  };
};
const deepMerge = (a: any, b: any): any => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  for (const k of Object.keys(b)) out[k] = deepMerge(out[k], b[k]);
  return out;
};
// ── end WP3 ──

// ── WP4 ──
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

/**
 * `POST /plans/template` with `replace` (contract 1): rebuild the plan from a start date. Runs already done stay; the
 * planned ones it replaces are soft-deleted and the overlapping block is ended at startDate − 1 (or removed if it had not
 * started), so there are never two blocks over the same weeks. The bootstrap answers at once: the new block in, the old
 * one ended. The result carries what `useUndoRebuild` needs.
 */
export const useRebuildPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<OnboardingAnswers, 'wake' | 'leave' | 'pace' | 'habits' | 'start' | 'today'> & { startDate: string; replace?: boolean }) =>
      api<TemplateApplied>('/plans/template', { method: 'POST', json: { replace: true, ...input } }),
    onSuccess: (r, v) => {
      const ended = r.endedBlock;
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) =>
        b
          ? {
              ...b,
              blocks: [
                ...b.blocks
                  .filter((x) => x.id !== r.block.id && !(ended && 'deleted' in ended && x.id === ended.id))
                  .map((x) => (ended && 'prevEnd' in ended && x.id === ended.id ? { ...x, end: shiftDays(v.startDate, -1) } : x)),
                r.block,
              ],
            }
          : b,
      );
      for (const m of r.months) void qc.invalidateQueries({ queryKey: keys.month(m) });
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
};

/** `POST /plans/template/undo` (contract 1): the rebuilt block and its sessions go, the replaced sessions and the old block come back. */
export const useUndoRebuild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: TemplateApplied & Pick<PlanTemplateResult, 'addedIds'>) => api('/plans/template/undo', { method: 'POST', json: { blockId: r.block.id, replacedIds: r.replacedIds ?? [], endedBlock: r.endedBlock, ...(r.addedIds?.length ? { addedIds: r.addedIds } : {}) } }),
    onSuccess: (_x, r) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, blocks: b.blocks.filter((x) => x.id !== r.block.id).map((x) => (r.endedBlock && 'prevEnd' in r.endedBlock && x.id === r.endedBlock.id ? { ...x, end: r.endedBlock.prevEnd } : x)) } : b));
      void qc.invalidateQueries({ queryKey: ['month'] });
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
};

/** `POST /plans/template`'s answer. With `replace`, contract 1 adds what it soft-deleted so `undoTemplate` can put it back. */
export interface PlanTemplateResult {
  block: PlanBlock;
  months: string[];
  removed: number;
  /** The planned, not-done sessions the new block replaced (soft-deleted). Absent on a server before contract 1. */
  replacedIds?: string[];
  /** An overlapping block that was ended the day before the new one starts, or soft-deleted when it hadn't started. */
  endedBlock?: { id: string; prevEnd: string } | { id: string; deleted: true };
  /** Every block the new one ended or removed (a replace can overlap more than one). */
  endedBlocks?: Array<{ id: string; prevEnd: string } | { id: string; deleted: true }>;
  /** The sessions the write added to a plan it kept (a revise): Undo removes exactly these, and the plan stays. */
  addedIds?: string[];
}

/** `POST /plans/template`: write a block built by `buildTemplate`, then refetch its months and the bootstrap (blocks). */
export const useTemplatePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    // `assisted`: the assistant shaped the builder's answers; the plan's source records it
    mutationFn: (body: TemplateInput & { replace?: boolean; assisted?: boolean }) => api<PlanTemplateResult>('/plans/template', { method: 'POST', json: body }),
    onSuccess: async (r) => {
      // a replace can reach months past the new block (the old block's tail): refetch every month in the cache
      if (r.replacedIds?.length || r.endedBlock || r.endedBlocks?.length) void qc.invalidateQueries({ queryKey: ['month'] });
      else for (const m of r.months) void qc.invalidateQueries({ queryKey: keys.month(m) });
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
};

/**
 * `POST /plans/template/undo` (contract 1): delete the block just written with its sessions, restore the sessions it
 * replaced and the block it ended. The new block leaves the cache at once; everything is refetched after.
 */
export const useTemplateUndo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: PlanTemplateResult) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (bs) => (bs ? { ...bs, blocks: bs.blocks.filter((x) => x.id !== r.block.id) } : bs));
      for (const m of r.months) patchMonth(qc, m, (bd) => ({ ...bd, sessions: bd.sessions.filter((s) => s.blockId !== r.block.id) }));
      await api('/plans/template/undo', { method: 'POST', json: { blockId: r.block.id, replacedIds: r.replacedIds ?? [], ...(r.endedBlock ? { endedBlock: r.endedBlock } : {}), ...(r.endedBlocks?.length ? { endedBlocks: r.endedBlocks } : {}), ...(r.addedIds?.length ? { addedIds: r.addedIds } : {}) } });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['month'] });
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
};

/**
 * Delete a plan, server first (contract 2): `DELETE /blocks/:id` soft-deletes the block and its not-done future sessions
 * at once, so a reload inside the Undo window shows the plan gone; `restore` (`POST /blocks/:id/restore`) is the Undo. Both
 * change the cache optimistically (history stays: past and kept sessions are never hidden) and refetch when the server
 * answers. A failure puts the cache back and rejects, so the caller can say so.
 */
export const usePlanDelete = () => {
  const qc = useQueryClient();
  const monthsOf = (b: PlanBlock) => monthsBetween(shiftDays(b.start, -14), shiftDays(b.end, 14));
  // a block's sessions can sit outside its dates (moved), so every cached month is refetched
  const refresh = (_b: PlanBlock) => {
    void qc.invalidateQueries({ queryKey: ['month'] });
    void qc.invalidateQueries({ queryKey: keys.bootstrap });
  };
  const keep = (b: PlanBlock) => {
    const t = today();
    return (bd: MonthBundle) => (s: Session) => {
      if (s.blockId !== b.id || s.date < t) return true;
      if (s.mark === 'done' || s.mark === 'floor') return true;
      // a run with an activity that day is kept by Strava: history, so it stays
      return s.kind === 'run' && bd.activities.some((a) => a.date === s.date && a.kind === 'run');
    };
  };
  const snapshot = (b: PlanBlock) => ({ boot: qc.getQueryData<Bootstrap>(keys.bootstrap), months: monthsOf(b).map((m) => [m, qc.getQueryData<MonthBundle>(keys.month(m))] as const) });
  const putBack = (snap: ReturnType<typeof snapshot>) => {
    if (snap.boot) qc.setQueryData(keys.bootstrap, snap.boot);
    for (const [m, bd] of snap.months) if (bd) qc.setQueryData(keys.month(m), bd);
  };
  const remove = useMutation({
    mutationFn: async (b: PlanBlock) => {
      const before = snapshot(b);
      qc.setQueryData<Bootstrap>(keys.bootstrap, (bs) => (bs ? { ...bs, blocks: bs.blocks.filter((x) => x.id !== b.id) } : bs));
      for (const m of monthsOf(b)) patchMonth(qc, m, (bd) => ({ ...bd, sessions: bd.sessions.filter(keep(b)(bd)) }));
      try {
        return await api<{ ok: true; removed?: number; kept?: number; months?: string[] }>(`/blocks/${b.id}`, { method: 'DELETE' });
      } catch (e) {
        // already deleted (another tab, a replay): the plan is gone either way
        if (e instanceof ApiError && e.status === 404) return { ok: true as const };
        putBack(before);
        throw e;
      }
    },
    onSettled: (_r, _e, b) => refresh(b),
  });
  const restore = useMutation({
    mutationFn: async (b: PlanBlock) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (bs) => (bs ? { ...bs, blocks: [...bs.blocks.filter((x) => x.id !== b.id), b] } : bs));
      return api<unknown>(`/blocks/${b.id}/restore`, { method: 'POST' });
    },
    onSettled: (_r, _e, b) => refresh(b),
  });
  return { remove, restore };
};
// ── end WP4 ──

// ── WP6 ──
// The Journal team's block: journal entries, quotes, reads and today's pick. Other teams import, never edit.
import { notifyManager } from '@tanstack/react-query';

/**
 * A save's answer on screen, in the same commit as the entry's arrival in every list (review 3: the composer cleared in one
 * commit and the entry arrived in another, up to 420 ms later at 4×, because the query cache tells React on a setTimeout:
 * the page moved twice). `whenShown(vars, f)` before `add.mutate(vars)`: `f` runs in the cache's own notification batch.
 */
const shownBy = new WeakMap<object, () => void>();
export const whenShown = <T extends object>(vars: T, f: () => void): T => (shownBy.set(vars, f), vars);

// a search (q not empty) is a moment's question: kept a minute in memory, never on the device (perf-21, main.tsx)
export const useJournalList = (q: string, fav: boolean) =>
  useQuery({ queryKey: keys.journal(q, fav), queryFn: () => api<{ entries: JournalEntry[]; more: boolean }>(`/journal?q=${encodeURIComponent(q)}&fav=${fav ? 1 : 0}&limit=200`), staleTime: 30_000, ...(q.trim() ? { gcTime: 60_000 } : {}) });

// ---------- journal & quotes ----------
type JournalList = { entries: JournalEntry[]; more: boolean };
/** Newest day first, newest entry first within a day: the order the server keeps. */
const journalOrder = (a: JournalEntry, b: JournalEntry) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1);
/** Every cached entry list (`['journal', q, fav]`), patched in place so the timeline answers before the server does. */
const patchJournalLists = (qc: QueryClient, fn: (entries: JournalEntry[], q: string, fav: boolean) => JournalEntry[]) => {
  for (const [key, data] of qc.getQueriesData<JournalList>({ queryKey: ['journal'] })) {
    if (!data) continue;
    const [, q = '', fav = false] = key as unknown as [string, string, boolean];
    qc.setQueryData<JournalList>(key, { ...data, entries: fn(data.entries, q, fav).sort(journalOrder) });
  }
};
const matchesList = (e: JournalEntry, q: string, fav: boolean) => (!fav || e.fav) && (!q || e.text.toLowerCase().includes(q.toLowerCase()));

export const useJournalMutations = () => {
  const qc = useQueryClient();
  const bump = () => {
    void qc.invalidateQueries({ queryKey: ['journal'] });
    void qc.invalidateQueries({ queryKey: keys.daily });
  };
  /** Save an entry. The month and every list show it at once (a provisional id), then swap in the server's. Resolves to the entry. */
  const add = useMutation({
    mutationFn: async (vars: { date: string; text: string }) => {
      const { date, text } = vars;
      const month = monthOf(date);
      const tmp: JournalEntry = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, date, text, createdAt: new Date().toISOString(), editedAt: null, fav: false };
      void qc.cancelQueries({ queryKey: ['journal'] });
      const shown = shownBy.get(vars);
      notifyManager.batch(() => {
        ensureMonth(qc, month);
        patchMonth(qc, month, (b) => ({ ...b, journal: [...b.journal, tmp] }));
        patchJournalLists(qc, (l, q, fav) => (matchesList(tmp, q, fav) ? [tmp, ...l] : l));
        if (shown) notifyManager.schedule(shown);
      });
      const saved = await write<JournalEntry>('/journal', 'POST', { date, text }, [keys.month(month), ['journal']], { tmpId: tmp.id });
      if (saved) {
        patchMonth(qc, month, (b) => ({ ...b, journal: b.journal.map((x) => (x.id === tmp.id ? saved : x)) }));
        patchJournalLists(qc, (l) => l.map((x) => (x.id === tmp.id ? saved : x)));
      }
      bump();
      return saved ?? tmp;
    },
    onError: (_e, v) => {
      invalidateMonth(qc, monthOf(v.date));
      void qc.invalidateQueries({ queryKey: ['journal'] });
    },
  });
  const patch = useMutation({
    mutationFn: async ({ entry, text, fav }: { entry: JournalEntry; text?: string; fav?: boolean }) => {
      const next = (x: JournalEntry): JournalEntry => ({ ...x, text: text ?? x.text, fav: fav ?? x.fav, editedAt: text ? new Date().toISOString() : x.editedAt });
      patchMonth(qc, monthOf(entry.date), (b) => ({ ...b, journal: b.journal.map((x) => (x.id === entry.id ? next(x) : x)) }));
      void qc.cancelQueries({ queryKey: ['journal'] });
      patchJournalLists(qc, (l, q, onlyFav) => {
        const n = next(l.find((x) => x.id === entry.id) ?? entry);
        if (!matchesList(n, q, onlyFav)) return l.filter((x) => x.id !== entry.id);
        return l.some((x) => x.id === entry.id) ? l.map((x) => (x.id === entry.id ? n : x)) : [n, ...l];
      });
      qc.setQueryData<Daily>(keys.daily, (d) => (d && d.memory?.id === entry.id ? { ...d, memory: next(d.memory) } : d));
      await write(`/journal/${entry.id}`, 'PATCH', { text, fav }, [keys.month(monthOf(entry.date)), ['journal']]);
      bump();
    },
    onError: (_e, v) => {
      invalidateMonth(qc, monthOf(v.entry.date));
      void qc.invalidateQueries({ queryKey: ['journal'] });
    },
  });
  const remove = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      patchMonth(qc, monthOf(entry.date), (b) => ({ ...b, journal: b.journal.filter((x) => x.id !== entry.id) }));
      void qc.cancelQueries({ queryKey: ['journal'] });
      patchJournalLists(qc, (l) => l.filter((x) => x.id !== entry.id));
      await write(`/journal/${entry.id}`, 'DELETE', undefined, [keys.month(monthOf(entry.date)), ['journal']]);
      bump();
    },
    onError: (_e, v) => {
      invalidateMonth(qc, monthOf(v.date));
      void qc.invalidateQueries({ queryKey: ['journal'] });
    },
  });
  const restore = useMutation({
    mutationFn: async (entry: JournalEntry) => {
      patchMonth(qc, monthOf(entry.date), (b) => ({ ...b, journal: [...b.journal.filter((x) => x.id !== entry.id), entry] }));
      void qc.cancelQueries({ queryKey: ['journal'] });
      patchJournalLists(qc, (l, q, fav) => (matchesList(entry, q, fav) ? [entry, ...l.filter((x) => x.id !== entry.id)] : l));
      await write(`/journal/${entry.id}/restore`, 'POST', undefined, [keys.month(monthOf(entry.date)), ['journal']]);
      bump();
    },
  });
  const another = useMutation({
    mutationFn: async (kind: 'memory' | 'quote') => {
      const r = await api<{ kind: string; item: JournalEntry | Quote | null }>('/journal/daily/another', { method: 'POST', json: { kind } });
      qc.setQueryData<Daily>(keys.daily, (d) => (d ? { ...d, [kind]: r.item } : d));
      return r.item;
    },
  });
  const quotePrefs = useMutation({
    mutationFn: async ({ id, fav, hidden }: { id: string; fav?: boolean; hidden?: boolean }) => {
      qc.setQueryData<Daily>(keys.daily, (d) => (d && d.quote?.id === id && fav !== undefined ? { ...d, quote: { ...d.quote, fav } } : d));
      await write(`/quotes/${id}/prefs`, 'PUT', { fav, hidden }, [keys.daily]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.daily }),
  });
  return { add, patch, remove, restore, another, quotePrefs };
};

/** A small stable number for a string (a day's stable pick from a list). */
export const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

// ---------- reads ----------
const fetchReads = () => api<{ links: Link[] }>('/reads').then((r) => r.links);
/** Unread first, then newest first: the order the server keeps. */
const readsOrder = (a: Link, b: Link) => (!!a.readAt === !!b.readAt ? (a.addedAt < b.addedAt ? 1 : -1) : a.readAt ? 1 : -1);
export const useReads = () => useQuery({ queryKey: keys.reads, queryFn: fetchReads, staleTime: 30_000 });
// the pick takes 10–20 s the first time each day; one that has not answered in 45 s is given up on, so Reads can say so and
// offer Retry instead of waiting in silence (review 2 feel N5)
const PICK_GIVE_UP_MS = 45_000;
/** Today's pick. The first ask of the day makes it, which can take a while: the query waits, the screen does not. Refreshed with the other dated data when the app comes back to the front (main.tsx: after five minutes, or when the bootstrap changed), so a verdict given elsewhere shows within minutes. */
export const usePick = (date: string, enabled = true) =>
  useQuery({
    queryKey: keys.pick(date),
    queryFn: () => api<PickResult>(`/reads/pick?date=${date}`, typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal ? { signal: AbortSignal.timeout(PICK_GIVE_UP_MS) } : {}),
    enabled,
    staleTime: 2 * 60_000,
    retry: false,
  });

export const useReadsMutations = () => {
  const qc = useQueryClient();
  const setReads = (fn: (l: Link[]) => Link[]) => qc.setQueryData<Link[]>(keys.reads, (l) => fn(l ?? []).sort(readsOrder));
  const setPick = (date: string, fn: (p: PickResult) => PickResult) => qc.setQueryData<PickResult>(keys.pick(date), (p) => (p ? fn(p) : p));
  /** Save a link. Offline it queues and the row stands; the server's twin check makes the replay safe. Returns `{ link, existed }`. */
  const add = useMutation({
    mutationFn: async ({ url, note }: { url: string; note?: string }) => {
      const full = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
      const host = (() => {
        try {
          return new URL(full).hostname.replace(/^www\./, '');
        } catch {
          return url;
        }
      })();
      const before = qc.getQueryData<Link[]>(keys.reads) ?? [];
      const tmp: Link = { id: `tmp-${Math.random().toString(36).slice(2, 9)}`, url: full, title: host, siteName: host, description: null, imageUrl: null, note: note ?? null, tags: [], addedAt: new Date().toISOString(), readAt: null, source: 'me', pickReason: null, pickDate: null, verdict: null };
      setReads((l) => [tmp, ...l]);
      let saved: Link | null;
      try {
        saved = await write<Link>('/reads', 'POST', { url, note }, [keys.reads]);
      } catch (e) {
        setReads((l) => l.filter((x) => x.id !== tmp.id));
        throw e;
      }
      if (!saved) return { link: tmp, existed: false, queued: true };
      const existed = before.some((x) => x.id === saved!.id);
      setReads((l) => [saved!, ...l.filter((x) => x.id !== tmp.id && x.id !== saved!.id)]);
      // the link was today's pick: the hero now knows it was kept
      if (saved.source === 'pick' && saved.pickDate) setPick(saved.pickDate, (p) => (p.pick?.id === saved!.id ? { ...p, pick: saved! } : p));
      return { link: saved, existed, queued: false };
    },
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: string; readAt?: string | null; note?: string | null; tags?: string[] }) => {
      setReads((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
      await write(`/reads/${id}`, 'PATCH', p, [keys.reads]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.reads }),
  });
  const remove = useMutation({
    mutationFn: async (link: Link) => {
      setReads((l) => l.filter((x) => x.id !== link.id));
      await write(`/reads/${link.id}`, 'DELETE', undefined, [keys.reads]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.reads }),
  });
  const restore = useMutation({
    mutationFn: async (link: Link) => {
      setReads((l) => [link, ...l.filter((x) => x.id !== link.id)]);
      await write(`/reads/${link.id}/restore`, 'POST', undefined, [keys.reads]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: keys.reads }),
  });
  /** Save keeps the pick (it joins the list, unread); Skip remembers it as what not to bring back. */
  const feedback = useMutation({
    mutationFn: async ({ pick, verdict, date }: { pick: Link; verdict: LinkVerdict; date: string; onGone?: () => void }) => {
      const next = { ...pick, verdict };
      setPick(date, (p) => (p.pick?.id === pick.id ? { ...p, pick: next } : p));
      if (verdict === 'saved') setReads((l) => [next, ...l.filter((x) => x.id !== pick.id)]);
      else setReads((l) => l.filter((x) => x.id !== pick.id));
      await write(`/reads/pick/feedback`, 'POST', { id: pick.id, verdict }, [keys.reads, keys.pick(date)]);
    },
    onError: (e, v) => {
      void qc.invalidateQueries({ queryKey: keys.reads });
      void qc.invalidateQueries({ queryKey: keys.pick(v.date) });
      // the pick this screen knew is no longer there (given a verdict elsewhere, or a new day): the refetch above replaces it
      if (e instanceof ApiError && e.status === 404) v.onGone?.();
    },
  });
  /** A manual refresh: the server allows a few a day. */
  const another = useMutation({
    mutationFn: async (date: string) => {
      const r = await api<PickResult>(`/reads/pick?date=${date}&force=1`, { timeoutMs: LONG_TIMEOUT_MS });
      qc.setQueryData<PickResult>(keys.pick(date), r);
      return r;
    },
  });
  return { add, patch, remove, restore, feedback, another };
};

/** First run in one call (docs/platform.md §5): morning settings, starter habits, the first block, `onboardedAt`. */
export const useOnboard = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers: OnboardingAnswers) => api<OnboardingResult>('/me/onboarding', { method: 'POST', json: answers }),
    onSuccess: (r) => {
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, ...r.user }, morningSettings: r.morningSettings, habits: r.habits, blocks: [...b.blocks.filter((x) => x.id !== r.block.id), r.block] } : b));
      for (const m of r.months) void qc.invalidateQueries({ queryKey: keys.month(m) });
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
};

/** `PATCH /me { name }` (contract 6): the account's name, which the avatar's initial follows. Optimistic. */
export const useSetName = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<{ name?: string | null }>('/me', { method: 'PATCH', json: { name } }),
    onMutate: (name) => {
      const was = qc.getQueryData<Bootstrap>(keys.bootstrap)?.user.name ?? null;
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, name: name || null } } : b));
      return { was };
    },
    onError: (_e, _n, ctx) => qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, name: ctx?.was ?? null } } : b)),
  });
};

/** `GET /export` (contract 3): everything the account holds, as the file Settings saves and Import reads back. */
export const fetchExport = () => api<ExportBundle>('/export');

/** `DELETE /me`: the account and everything it owns. 403 `bad_password` when the password is wrong. */
export const useDeleteAccount = () =>
  useMutation({ mutationFn: (password: string) => api<{ ok: true; removed: Record<string, number> }>('/me', { method: 'DELETE', json: { password } }) });

/**
 * `PATCH /me/training`: save the training answers on the account (Settings → You and Training, after a rebuild). The
 * bootstrap's copy changes at once; the server's answer (with its `updatedAt`) replaces it.
 */
export const useSaveTraining = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TrainingProfile) => api<{ trainingProfile: SavedTrainingProfile }>('/me/training', { method: 'PATCH', json: p }),
    onMutate: (p) => {
      const was = qc.getQueryData<Bootstrap>(keys.bootstrap)?.user.trainingProfile ?? null;
      qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, trainingProfile: { ...p, raceDate: p.goal === 'base' ? null : p.raceDate, updatedAt: new Date().toISOString() } } } : b));
      return { was };
    },
    onSuccess: (r) => qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, trainingProfile: r.trainingProfile } } : b)),
    onError: (_e, _p, ctx) => qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, trainingProfile: ctx?.was ?? null } } : b)),
  });
};
/**
 * Set how the athlete is training (the chip on Today): the bootstrap's copy changes at once, the server's answer replaces
 * it, and a failure puts the old one back.
 */
export const useSetStatus = () => {
  const qc = useQueryClient();
  const put = (status: TrainingStatus | null) => qc.setQueryData<Bootstrap>(keys.bootstrap, (b) => (b ? { ...b, user: { ...b.user, status } } : b));
  return useMutation({
    mutationFn: (p: { kind: TrainingStatusKind; until: ISODate | null; today: ISODate }) => api<{ status: TrainingStatus | null }>('/me/status', { method: 'PUT', json: { kind: p.kind, until: p.until } }),
    onMutate: (p) => {
      const was = qc.getQueryData<Bootstrap>(keys.bootstrap)?.user.status ?? null;
      put(p.kind === 'training' ? null : { kind: p.kind, from: p.today, until: p.until });
      return { was };
    },
    onSuccess: (r) => put(r.status),
    onError: (_e, _p, ctx) => put(ctx?.was ?? null),
  });
};
// ── end WP6 ──

// ── Goals and to-do lists ──
// Goals: one per level and period, set through the review (POST /goals/refine), reviewed when the period ends; every step
// is logged on the server (GET /goals/events) for the history. To-do lists: named, coloured groups a to-do can be filed under.
Object.assign(keys, { goals: ['goals'] as const, goalEvents: (goal?: string) => ['goal-events', goal ?? 'all'] as const, todoGroups: ['todo-groups'] as const });
const goalsKey = ['goals'] as const;
const groupsKey = ['todo-groups'] as const;

/** A goal as the app reads it. Goals cached on the phone, or served by a server, from before steps existed have none. */
const aimOf = (g: Aim): Aim => (Array.isArray(g.steps) ? g : { ...g, steps: [] });
const aimsOf = (gs: Aim[]): Aim[] => (gs.every((g) => Array.isArray(g.steps)) ? gs : gs.map(aimOf));
// retryOnMount off: a goals query that failed with nothing cached is not restarted by every observer that mounts (the
// Goals badge, Today's card, the tab), which looped about once a second (goals-03)
export const useGoals = () => useQuery({ queryKey: goalsKey, queryFn: async () => aimsOf(await api<Aim[]>('/goals')), select: aimsOf, staleTime: 30_000, retryOnMount: false });
export const useGoalEvents = (goal?: string, enabled = true) =>
  useQuery({ queryKey: ['goal-events', goal ?? 'all'], queryFn: () => api<{ events: GoalEvent[]; more: boolean }>(`/goals/events${goal ? `?goal=${encodeURIComponent(goal)}` : '?limit=300'}`), staleTime: 15_000, enabled });

export const useGoalMutations = () => {
  const qc = useQueryClient();
  const setGoals = (fn: (g: Aim[]) => Aim[]) => qc.setQueryData<Aim[]>(goalsKey, (g) => fn(aimsOf(g ?? [])));
  const touched = () => void qc.invalidateQueries({ queryKey: ['goal-events'] });
  const set = useMutation({
    mutationFn: async (input: { level: GoalLevel; period: string; text: string; original?: string | null; why?: string | null; chose?: 'sharpened' | 'kept' | 'own'; steps?: GoalStep[] }) => {
      const { level, period, ...body } = input;
      const now = new Date().toISOString();
      // a new goal is shown under a provisional id until the server names it
      const tmpId = `tmp-goal-${level}-${period}`;
      const isNew = !aimsOf(qc.getQueryData<Aim[]>(goalsKey) ?? []).some((x) => x.level === level && x.period === period);
      setGoals((g) => {
        const had = g.find((x) => x.level === level && x.period === period);
        const next: Aim = had
          ? { ...had, text: body.text, original: body.original && body.original !== body.text ? body.original : null, why: body.why ?? null, steps: body.steps ?? had.steps, updatedAt: now }
          : { id: tmpId, level, period, text: body.text, original: body.original && body.original !== body.text ? body.original : null, why: body.why ?? null, status: 'open', reflection: null, steps: body.steps ?? [], createdAt: now, updatedAt: now, closedAt: null };
        return had ? g.map((x) => (x === had ? next : x)) : [next, ...g];
      });
      // the create carries its provisional id: a step added or Mark done before the answer waits behind it and is sent to
      // the real id (the outbox renames it), online or off
      const saved = await write<Aim>(`/goals/${level}/${period}`, 'PUT', body, [goalsKey], isNew ? { tmpId } : {});
      if (saved) setGoals((g) => g.map((x) => (x.level === level && x.period === period ? aimOf(saved) : x)));
      touched();
    },
    onError: () => void qc.invalidateQueries({ queryKey: goalsKey }),
  });
  const review = useMutation({
    mutationFn: async ({ id, status, reflection, steps }: { id: string; status?: GoalStatus; reflection?: string | null; steps?: GoalStep[] }) => {
      const now = new Date().toISOString();
      setGoals((g) => g.map((x) => (x.id === id ? { ...x, ...(status ? { status, closedAt: status === 'open' ? null : now } : {}), ...(reflection !== undefined ? { reflection } : {}), ...(steps ? { steps } : {}) } : x)));
      const saved = await write<Aim>(`/goals/${id}`, 'PATCH', { status, reflection, steps }, [goalsKey]);
      if (saved) setGoals((g) => g.map((x) => (x.id === id ? aimOf(saved) : x)));
      touched();
    },
    onError: () => void qc.invalidateQueries({ queryKey: goalsKey }),
  });
  const clear = useMutation({
    mutationFn: async (id: string) => {
      setGoals((g) => g.filter((x) => x.id !== id));
      await write(`/goals/${id}`, 'DELETE', undefined, [goalsKey]);
      touched();
    },
    onError: () => void qc.invalidateQueries({ queryKey: goalsKey }),
  });
  return { set, review, clear };
};

export const useTodoGroups = () => useQuery({ queryKey: groupsKey, queryFn: () => api<TodoGroup[]>('/todo-groups'), staleTime: 60_000 });

export const useTodoGroupMutations = () => {
  const qc = useQueryClient();
  const setGroups = (fn: (g: TodoGroup[]) => TodoGroup[]) => qc.setQueryData<TodoGroup[]>(groupsKey, (g) => fn(g ?? []));
  const add = useMutation({
    mutationFn: async (input: { name: string; color: TodoColor }) => {
      const saved = await api<TodoGroup>('/todo-groups', { method: 'POST', json: input });
      setGroups((g) => [...g, saved]);
      return saved;
    },
  });
  const patch = useMutation({
    mutationFn: async ({ id, ...p }: { id: string; name?: string; color?: TodoColor; position?: number }) => {
      setGroups((g) => g.map((x) => (x.id === id ? { ...x, ...p } : x)));
      await write(`/todo-groups/${id}`, 'PATCH', p, [groupsKey]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: groupsKey }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      setGroups((g) => g.filter((x) => x.id !== id));
      qc.setQueryData<Todo[]>(keys.todos, (t) => (t ?? []).map((x) => (x.groupId === id ? { ...x, groupId: null } : x)));
      await write(`/todo-groups/${id}`, 'DELETE', undefined, [groupsKey, keys.todos]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: groupsKey }),
  });
  return { add, patch, remove };
};
// ── end Goals and to-do lists ──

// ── Assistant ──
// The assistant on Today: ask (Claude answers or proposes checked changes), then apply, dismiss or undo. A write here
// changes rows across the app, so an apply or an undo refetches every dataset it may have touched.
/**
 * Ask the assistant. The ask runs on the server in the background and the app reads its answer with short requests
 * (features/assistant/poll.ts), so a long one (a plan read from photos) never hangs on one request.
 */
export const askAssistant = (
  date: string,
  turns: Array<{ role: 'user' | 'assistant'; text: string; attachments?: Attachment[] }>,
  screen?: import('@logbook/shared').AssistantScreen,
  watch: { onJob?: (id: string) => void; onProgress?: (live: import('@logbook/shared').AssistantLive) => void } = {},
) =>
  askAndWait<AssistantReply>(
    () => api<{ jobId: string } | AssistantReply>('/assistant?async=1', { method: 'POST', json: { date, turns, ...(screen ? { screen } : {}) }, timeoutMs: LONG_TIMEOUT_MS }),
    (id) => api<JobAnswer<AssistantReply>>(`/assistant/jobs/${encodeURIComponent(id)}`),
    { isTransient: (e) => e instanceof NetworkError, ...watch },
  );

/** Stop an answer partway (the Stop button). */
export const stopAssistant = (jobId: string) => api<{ stopped: boolean }>(`/assistant/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' });

export const useAssistantActions = () => {
  const qc = useQueryClient();
  const refresh = (months: string[]) => {
    for (const m of months) void qc.invalidateQueries({ queryKey: keys.month(m) });
    for (const k of [keys.todos, ['goals'], ['goal-events'], ['todo-groups'], keys.bootstrap] as const) void qc.invalidateQueries({ queryKey: k as readonly unknown[] });
  };
  const apply = useMutation({
    /** `skip`: the changes (by index) the owner removed before Apply. */
    mutationFn: async ({ id, skip }: { id: string; skip?: number[] }) => {
      const r = await api<AssistantApplied>(`/assistant/${id}/apply`, { method: 'POST', ...(skip?.length ? { json: { skip } } : {}), timeoutMs: LONG_TIMEOUT_MS });
      refresh(r.months);
      return r.proposal;
    },
  });
  const undo = useMutation({
    mutationFn: async (id: string) => {
      const r = await api<AssistantApplied>(`/assistant/${id}/undo`, { method: 'POST' });
      refresh(r.months);
      return r.proposal;
    },
  });
  const dismiss = useMutation({ mutationFn: (id: string) => api<AssistantProposal>(`/assistant/${id}/dismiss`, { method: 'POST' }) });
  return { apply, undo, dismiss };
};
// ── end Assistant ──

// ---------- the day's plan: morning, afternoon, evening (to-do and goal-step references, in order) ----------
const dayPlanKey = (date: string) => ['day-plan', date] as const;
const fetchDayPlan = async (date: string): Promise<DayPlan> => {
  const p = await api<DayPlan>(`/day-plans/${date}`);
  return { ...p, bands: cleanBands({ ...emptyBands(), ...p.bands }) };
};
export const useDayPlan = (date: string) => useQuery({ queryKey: dayPlanKey(date), queryFn: () => fetchDayPlan(date), staleTime: 30_000 });

/** Put the day's whole plan after a drag: the board shows it on the drop's frame; the write follows (the outbox when offline). */
export const useDayPlanSave = (date: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bands: DayBands) => {
      const clean = cleanBands(bands);
      qc.setQueryData<DayPlan>(dayPlanKey(date), (p) => ({ date, updatedAt: p?.updatedAt ?? null, bands: clean }));
      await write<DayPlan>(`/day-plans/${date}`, 'PUT', { bands: clean }, [dayPlanKey(date)]);
    },
    onError: () => void qc.invalidateQueries({ queryKey: dayPlanKey(date) }),
  });
};

// ---------- a run's history, for its records (two years back) ----------
export const useRunHistory = () =>
  useQuery({ queryKey: ['activities', 'history'] as const, queryFn: () => api<Activity[]>(`/activities?from=${shiftDays(today(), -730)}&to=${shiftDays(today(), 1)}`), staleTime: 5 * 60_000 });
