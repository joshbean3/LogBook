import { fmtDate, label, mondayOf, shiftDays, tone, TYPES, type Session, type Tone } from '@logbook/shared';

/**
 * The Add sheet's arithmetic (AddSessionSheet.tsx), kept pure: which day the sheet opens on, where a run's miles and minutes
 * start, which lifts are offered, the session that is written and the words that say so.
 */

export type AddKind = 'run' | 'lift';
/** The four runs the short sheet offers, one per tone (easy, long, hard, fast). The full editor has the rest. */
export const RUN_KINDS = ['Easy', 'Long', 'Tempo', 'Speed'] as const;
export type RunKind = (typeof RUN_KINDS)[number];
/** Where a run starts with nothing else to go on (the full editor's own defaults). */
export const FALLBACK_MILES: Record<RunKind, number> = { Easy: 4, Long: 8, Tempo: 5, Speed: 5 };
const TONE_OF: Record<RunKind, Tone> = { Easy: 'easy', Long: 'long', Tempo: 'hard', Speed: 'fast' };

export const MILES_STEP = 0.5;
export const MILES_MIN = 0.5;
export const MILES_MAX = 50;
export const MINUTES_STEP = 5;
export const MINUTES_MIN = 5;
export const MINUTES_MAX = 300;
/** 9:00 a mile, the morning's default, when the account has no easy pace. */
const DEFAULT_PACE = 540;

const r05 = (v: number) => Math.round(v * 2) / 2;
const clampMiles = (v: number) => Math.min(MILES_MAX, Math.max(MILES_MIN, r05(v)));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** What the defaults read: plain data, so the tests build it by hand. */
export interface AddHistory {
  /** The owner's sessions around the open week (the twelve weeks before it and the week itself), newest first. */
  recent: Session[];
  /** Miles of the owner's last runs (activities), newest first. */
  runs: number[];
  /** The training answers, when there are any. */
  profile: { weeklyMiles: number; runDays: number } | null;
  /** The easy pace, seconds a mile. */
  pace: number | null;
}

/**
 * The day the sheet opens on. A tapped day is that day. From the week's Add: today in this week; in a later week its
 * first day with nothing on it (so Add, Add, Add walks down an open week), else its Monday; in a past week its last day
 * with nothing on it, else its Sunday.
 */
export const defaultDay = (sessionsOn: (d: string) => Session[], mon: string, today: string, from?: string | null): string => {
  if (from) return from;
  const now = mondayOf(today);
  if (mon === now) return today;
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  const open = (d: string) => sessionsOn(d).length === 0;
  if (mon > now) return days.find(open) ?? mon;
  return [...days].reverse().find(open) ?? days[6]!;
};

/** The owner's typical run from their last runs, by kind: the usual distance, and for the long run the longest of them. */
const fromRuns = (kind: RunKind, runs: number[]): number | null => {
  const last = runs.filter((m) => m > 0).slice(0, 8);
  if (!last.length) return null;
  const usual = median(last);
  if (kind !== 'Long') return usual;
  const longest = Math.max(...last);
  return longest >= usual * 1.25 ? longest : usual * 1.5;
};

/** From the training answers: the long run about a third of the week, the other runs share the rest. */
const fromProfile = (kind: RunKind, p: AddHistory['profile']): number | null => {
  if (!p || !(p.weeklyMiles > 0)) return null;
  const long = p.runDays > 1 ? p.weeklyMiles * 0.35 : p.weeklyMiles;
  return kind === 'Long' ? long : p.runDays > 1 ? (p.weeklyMiles - long) / (p.runDays - 1) : p.weeklyMiles;
};

/**
 * Where a new run's miles start: the last run of that kind in the owner's weeks (its own type first, then its tone: a
 * Threshold answers for Tempo, Intervals for Speed, never a race), else their recent runs, else the training answers,
 * else 4, 8, 5, 5. On the half mile, 0.5 to 50.
 */
export const milesFor = (kind: RunKind, h: AddHistory): number => {
  const runs = h.recent.filter((s) => s.kind === 'run' && Number(s.miles) > 0);
  const same = runs.find((s) => (s.type ?? '').toLowerCase() === kind.toLowerCase()) ?? runs.find((s) => tone(s) === TONE_OF[kind] && !/race/i.test(s.type ?? ''));
  return clampMiles(same?.miles ?? fromRuns(kind, h.runs) ?? fromProfile(kind, h.profile) ?? FALLBACK_MILES[kind]);
};

/** The minutes those miles take at the easy pace, on the five minutes. */
export const minutesFor = (miles: number, pace: number | null): number => {
  const p = typeof pace === 'number' && pace >= 240 && pace <= 1200 ? pace : DEFAULT_PACE;
  return Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, Math.round((miles * p) / 60 / MINUTES_STEP) * MINUTES_STEP));
};

/** A lift the sheet offers: one the owner already has in their weeks (`saved`), or a plain kind. */
export interface LiftChoice {
  key: string;
  name: string;
  type: string | null;
  title: string | null;
  details: string | null;
  minutes: number | null;
  saved: boolean;
}
const MAX_SAVED = 4;
const MAX_LIFTS = 6;

/**
 * The lifts to pick from: the owner's own (by name, newest first, each with the exercises and minutes it last had), then
 * the plain kinds that are not already named, six at most.
 */
export const liftChoices = (recent: Session[]): LiftChoice[] => {
  const out: LiftChoice[] = [];
  const seen = new Set<string>();
  for (const s of recent) {
    if (s.kind !== 'lift') continue;
    const name = label(s).trim();
    const k = name.toLowerCase();
    if (!name || seen.has(k)) continue;
    seen.add(k);
    if (out.length < MAX_SAVED) out.push({ key: `saved:${k}`, name, type: s.type, title: s.title, details: s.details, minutes: s.minutes, saved: true });
  }
  for (const t of TYPES.lift) {
    if (out.length >= MAX_LIFTS) break;
    if (seen.has(t.toLowerCase())) continue;
    out.push({ key: `kind:${t.toLowerCase()}`, name: t, type: t, title: null, details: null, minutes: null, saved: false });
  }
  return out;
};

export type AddDraft =
  | { kind: 'run'; type: RunKind; miles: number | null; minutes: number | null }
  /** `name`: what was typed (it wins over the picked lift, and carries none of that lift's exercises). */
  | { kind: 'lift'; choice: LiftChoice | null; name: string };

/**
 * The session to write. A day already past is added as done: planned in the past it would read Missed, and nobody adds a
 * run to last Monday to say they missed it.
 */
export const buildSession = (id: string, date: string, today: string, d: AddDraft): Session => {
  const base = { id, date, position: 999, blockId: null, movedFrom: null, mark: date < today ? ('done' as const) : null };
  if (d.kind === 'run') return { ...base, kind: 'run', type: d.type, title: null, details: null, miles: d.miles, minutes: d.miles == null ? d.minutes : null };
  const typed = d.name.trim();
  if (typed) return { ...base, kind: 'lift', type: null, title: typed, details: null, miles: null, minutes: null };
  const c = d.choice;
  // the picked lift as it is (a saved one keeps its own type, or none); with nothing to pick from, a plain Strength
  return { ...base, kind: 'lift', type: c ? c.type : 'Strength', title: c?.title ?? null, details: c?.details ?? null, miles: null, minutes: c?.minutes ?? null };
};

/**
 * The same session for another try, after the server refused it: everything that was picked (the day, the done mark of a
 * day already past), under a new id. The server wrote nothing under the refused id, and the id itself can be what it
 * refused: one that is already someone else's answers 409 `id_taken`, and the app is to pick another.
 */
export const retryOf = (s: Session, id: string): Session => ({ ...s, id });

/** A day in a sentence: today, tomorrow, yesterday, the weekday inside a week of today, else "Fri, Nov 27". */
export const dayWords = (date: string, today: string): string => {
  if (date === today) return 'today';
  if (date === shiftDays(today, 1)) return 'tomorrow';
  if (date === shiftDays(today, -1)) return 'yesterday';
  return date > shiftDays(today, -7) && date < shiftDays(today, 7) ? fmtDate('dowLong', date) : fmtDate('short', date);
};

/** The toast: "Easy 4 added to Friday", "Strength A added to yesterday as done". A long name gives way to "Session". */
export const addedWords = (s: Session, today: string): string => {
  const name = label(s);
  return `${name.length > 24 ? 'Session' : name} added to ${dayWords(s.date, today)}${s.mark === 'done' ? ' as done' : ''}`;
};
