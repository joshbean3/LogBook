import { AFTER_LABELS, AFTER_ORDER, afterLabel, buildMorning, clock, clockOfDay, durationWords, morningDayFor, NEW_ACCOUNT_MORNING, normalizeAfterOrder, num, routineOf, type MorningAfterKey, type MorningDayOverride, type MorningSettings, type MorningTimeline, type RoutineKey, type RoutineStep, type Session } from '@logbook/shared';

/**
 * This morning's pure model: the timeline for a day (the routine's block order is a setting `buildMorning` honours), the
 * schedule's rows (one row type, spec §4.1) and the Now card's line. The clock is Today's (`useNowMinutes`, features/day).
 */

// ---------- time words ----------
/** "7:20 AM" split so the number can be big and the meridiem small. */
export const timeParts = (m: number) => {
  const [v = '', u = ''] = clockOfDay(m).split(' ');
  return { v, u };
};
/** "7:20" without the meridiem (a morning is all AM; the axis and the stamps say so once). */
export const short = (m: number) => timeParts(m).v;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The alarm's range, and the step every alarm control moves in. */
export const WAKE_MIN = 240;
export const WAKE_MAX = 720;
export const WAKE_STEP = 5;

// ---------- the routine order: the back-home blocks, in the athlete's order ----------
/*
 * The order is a morning setting on the server (`after.order`), and `buildMorning` lays the blocks out in it, so every
 * timeline (this page, Today's mini timeline, the routine editor's preview) follows it with nothing to apply here.
 */
export type AfterKey = MorningAfterKey;
export const AFTER_KEYS = AFTER_ORDER;
export const isAfterKey = (k: string): k is AfterKey => (AFTER_ORDER as readonly string[]).includes(k);

/**
 * A routine block's name: the athlete's own (`afterLabel`), else the block's default. An account whose stored routine has a
 * smoothie block of its own (the owner's) reads "Blend smoothie" as it always did; a new account's smoothie slot is 0 (not
 * on the timeline) unless onboarding's Breakfast or Coffee chip filled it, and onboarding names it after that chip.
 */
export const routineName = (st: Pick<MorningSettings, 'after'> | null | undefined, k: AfterKey): string => afterLabel(st, k);

/**
 * A timeline block's name on this page. Routine blocks use `routineName`; the run's departure buffer keeps "Out the door"
 * (the hero's DOOR, the session sheet's OUT THE DOOR), so a routine block that would wear the same name on a morning with
 * a departure (a new account's last block is named "Out the door") goes by the routine's default name instead.
 */
export const blockLabel = (T: Pick<MorningTimeline, 'settings' | 'blocks'>, b: { key: string; label: string }): string => {
  if (!isAfterKey(b.key)) return b.label;
  const name = routineName(T.settings, b.key);
  const clash = T.blocks.some((x) => x.key === 'buffer' && x.label.toLowerCase() === name.toLowerCase());
  return clash ? AFTER_LABELS[b.key] : name;
};

/** The routine a new account starts from (contract 7), for any pre-load fallback and the routine editor's Reset. */
export const ROUTINE_DEFAULTS: MorningSettings = NEW_ACCOUNT_MORNING;

/** An order an earlier build kept on this device (`logbook.morning.order`): read once and forgotten, so it can go to the server. */
export const takeLegacyOrder = (): RoutineKey[] | null => {
  try {
    const raw = localStorage.getItem('logbook.morning.order');
    if (raw == null) return null;
    localStorage.removeItem('logbook.morning.order');
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? normalizeAfterOrder(list) : null;
  } catch {
    return null;
  }
};

/**
 * What a morning's own setting can change: the alarm, nothing else (spec §4.3, M16). The workout is the session's, edited
 * in the session sheet.
 */
export type DayPatch = { wake?: number };

/** "7:15", "715" or "7": a morning hour, with or without minutes. */
export const parseWake = (raw: string) => {
  const s = raw.trim().toLowerCase().replace(/\s*(am|a)$/, '');
  const x = /^(\d{1,2})(?::?(\d{2}))?$/.exec(s);
  if (!x) return null;
  const h = Number(x[1]);
  const m = Number(x[2] ?? 0);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
};

/**
 * The morning for a date: the sessions (the workout), the day's override (its alarm) and the routine, with `patch` (an
 * alarm drag in progress) laid over the day.
 */
export const morningOf = (sessions: Session[], override: Partial<MorningDayOverride> | null, st: MorningSettings, patch?: DayPatch | null): MorningTimeline => {
  const day = morningDayFor(sessions, override, st);
  return buildMorning(patch?.wake != null ? { ...day, wake: patch.wake } : day, st);
};

/** Out the door: the start of the first buffer block (null on a rest morning). */
export const doorOf = (T: MorningTimeline) => (T.day.mode === 'rest' ? null : (T.blocks.find((b) => b.key === 'buffer')?.start ?? null));

/** The four stops of a morning (three on a rest morning: no door, no back). */
export const stopsOf = (T: MorningTimeline): Array<{ key: 'wake' | 'door' | 'back' | 'leave'; label: string; at: number }> => {
  const door = doorOf(T);
  return [
    { key: 'wake' as const, label: 'Wake', at: T.day.wake },
    ...(door != null
      ? [
          { key: 'door' as const, label: 'Door', at: door },
          { key: 'back' as const, label: 'Back', at: T.back },
        ]
      : []),
    { key: 'leave' as const, label: 'Leave', at: T.leave },
  ];
};


// ---------- the schedule's rows (spec §4.1): one row type, time · icon · name · sub, nothing on the right ----------
export type RowKind = 'wake' | 'work' | 'late' | 'free' | 'step';
export interface SchedRow {
  /** Stable across renders (the FLIP and the reorder key on it): 'wake', 'work', 'late', 'free', or the step's routine key. */
  id: string;
  kind: RowKind;
  /** The time column. */
  at: number;
  /** The stretch the row covers (the progress line under the row that is under way). */
  start: number;
  end: number;
  name: string;
  sub: string;
  /** The block key the icon is chosen from ('run', 'gym', 'shower', 'step', …). */
  icon: string;
  tone?: string;
  step?: RoutineStep;
}

/**
 * Run `fn` once a push has settled: after the slide's at-rest budget, at an idle moment (at the latest 0.7 s after that). The first
 * measures of a new page (the FLIP's row tops, the Leave row's toast room) wait for it: read on the push's first frames they
 * forced the page's style and layout inside the slide (feel review 1 FL4); by now the layout is the one the frames drew.
 * Returns a cancel.
 */
/** The push's at-rest budget (spec §0.2 row 3: at rest ≤ 500 ms): a new page's first measures wait at least this long. */
const PUSH_REST_MS = 500;
export const whenSettled = (fn: () => void): (() => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  let idle = 0;
  const t = window.setTimeout(() => {
    if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 700 });
    else fn();
  }, PUSH_REST_MS);
  return () => {
    clearTimeout(t);
    if (idle) w.cancelIdleCallback?.(idle);
  };
};

/** 'today' / 'tomorrow' / 'this morning': the word the Wake row's `Just …` uses. */
export const justWord = (date: string, today: string, tomorrow: string) => (date === today ? 'today' : date === tomorrow ? 'tomorrow' : 'this morning');

/** The rows an alarm drag keeps while the finger is down (FL1): the set it began with, so nothing is inserted or removed. */
export interface RowSet {
  free: boolean;
  late: boolean;
}

/** The workout row's name: `Easy run`, `Threshold run`; a session typed `Run` (or `Long run`) is not `Run run`. */
export const workName = (key: string, type: string) => (key !== 'run' ? type : /\brun$/i.test(type.trim()) ? type : `${type} run`);

/**
 * The rows of a morning, top to bottom: Wake · the workout (its door and cool-down, or its walks, folded into its sub) · Free ·
 * the routine's steps. The Leave row is drawn by LeaveRow. `patched`: an alarm drag is laying its own wake over the day.
 * `keep`: while the finger is down the row set stays the one the drag began with (spec §4.2, heights do not change): a Free
 * that the alarm has eaten reads `0 min`, a late note the alarm has cleared stays (it says on time), and a late note the
 * alarm would bring waits for the release (the Leave row's sub says it meanwhile).
 */
export const rowsOf = (T: MorningTimeline, just: string, patched = false, keep?: RowSet | null): SchedRow[] => {
  const out: SchedRow[] = [];
  const wake = T.blocks.find((b) => b.key === 'wake');
  const door = doorOf(T);
  const own = T.day.own || patched;
  out.push({ id: 'wake', kind: 'wake', at: T.day.wake, start: T.day.wake, end: wake?.end ?? T.day.wake, name: 'Wake up', sub: own ? `Just ${just}` : T.day.mode === 'rest' ? 'Rest morning' : 'Every morning', icon: 'wake' });
  const work = T.blocks.find((b) => b.key === 'run' || b.key === 'gym');
  if (work && door != null) {
    const sub = work.key === 'run' ? `${num(T.day.miles)} mi · ${clock(T.settings.run.pace)}/mi · back ${short(T.back)}` : `${durationWords(T.day.minutes)} · back ${short(T.back)}`;
    out.push({ id: 'work', kind: 'work', at: door, start: door, end: T.back, name: workName(work.key, T.day.type), sub, icon: work.key, tone: work.tone });
  }
  if (keep ? keep.late : T.late && T.fix) out.push({ id: 'late', kind: 'late', at: T.back, start: T.back, end: T.back, name: '', sub: '', icon: 'late' });
  const steps = new Map(routineOf(T.settings).map((r) => [r.key, r]));
  const first = T.blocks.find((b) => b.id != null && steps.has(b.id));
  const free = T.blocks.find((b) => b.key === 'free');
  const routineAt = (at: number) => (first ? `${durationWords(0)} · routine at ${short(at)}` : durationWords(0));
  if (free && (!keep || keep.free)) out.push({ id: 'free', kind: 'free', at: free.start, start: free.start, end: free.end, name: 'Free', sub: first ? `${durationWords(free.mins)} · routine at ${short(free.end)}` : durationWords(free.mins), icon: 'free' });
  else if (!free && keep?.free) {
    const at = first?.start ?? T.back;
    out.push({ id: 'free', kind: 'free', at, start: at, end: at, name: 'Free', sub: routineAt(at), icon: 'free' });
  }
  for (const b of T.blocks) {
    if (b.id == null) continue;
    const step = steps.get(b.id);
    if (!step) continue;
    out.push({ id: b.id, kind: 'step', at: b.start, start: b.start, end: b.end, name: blockLabel(T, b), sub: durationWords(b.mins), icon: step.builtin ? b.key : 'step', step });
  }
  return out;
};

/** Where a stretch sits against the clock on today: behind, under way (and how far along, 0..1), or still to come. */
export const timeState = (isToday: boolean, now: number, start: number, end: number): { cls: '' | 'past' | 'is-now'; p: number } => {
  if (!isToday) return { cls: '', p: 0 };
  if (end <= now) return { cls: 'past', p: 1 };
  if (start <= now) return { cls: 'is-now', p: Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start))) };
  return { cls: '', p: 0 };
};

/**
 * The Now card's one line (spec §4.1). Today, by phase: `Alarm in 43 min` · `Out the door in 22 min` · `Back by 8:13` ·
 * `Shower now · Leave in 45 min` · `Left 9:30`. A past morning: `Woke 7:15 · Left 9:30`. A future one: `Alarm 7:15 · Leave 9:30`.
 */
export const nowLine = (T: MorningTimeline, now: number, rel: 'past' | 'today' | 'future'): string => {
  const wake = T.day.wake;
  if (rel === 'past') return `Woke ${short(wake)} · Left ${short(T.leave)}`;
  if (rel === 'future') return `Alarm ${short(wake)} · Leave ${short(T.leave)}`;
  const inW = (m: number) => durationWords(Math.max(1, Math.ceil(m - now)));
  if (now < wake) return `Alarm in ${inW(wake)}`;
  const door = doorOf(T);
  if (door != null && now < door) return `Out the door in ${inW(door)}`;
  if (door != null && now < T.back) return `Back by ${short(T.back)}`;
  if (now >= T.leave) return `Left ${short(T.leave)}`;
  const leave = `Leave in ${inW(T.leave)}`;
  const b = T.blocks.find((x) => x.start <= now && now < x.end);
  if (b?.key === 'free') return `Free until ${short(b.end)} · ${leave}`;
  if (b && b.id != null) return `${blockLabel(T, b)} now · ${leave}`;
  return leave;
};
