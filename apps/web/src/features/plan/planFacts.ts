import { daysBetween, fmtDate, GOAL_SPECS, label, num, shiftDays, tone, type Goal, type PlanBlock, type Session, type TrainingProfile } from '@logbook/shared';
import { firstMonOf } from './topWords';

/*
 * What the plan sheet says about a block (its summary at the top): what it is, where it came from, and its goals. All of it
 * is read from what the app already holds: the block's own fields (`name`, `start`, `end`, `source`, `summary`,
 * `createdAt`), its sessions, and the training answers on the account (only for a block those answers built). Nothing new
 * is stored for it.
 */

const tenth = (v: number) => num(Math.round(v * 10) / 10);
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
/** A short date that never breaks between the month and the day (`Nov 16`). */
const md = (d: string) => fmtDate('md', d).replace(' ', ' ');
/** The local calendar day of a timestamp (`createdAt`), as an ISO date. */
const localDay = (iso: string) => {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** A goal's plain name: `Half marathon`, `Marathon`, `10K`, `5K`, `Base build`. */
const GOAL_WORD = (g: Goal) => (g === 'base' ? 'Base build' : GOAL_SPECS[g].name);
/** The answers built this block: onboarding wrote it, or the block builder did (both from the goal, days and miles asked). */
const fromAnswers = (b: PlanBlock) => b.source === 'onboarding' || b.source === 'template';

/**
 * The block's goal type: what its name says (`Half marathon · 12 weeks`), else, for a block the training answers built,
 * the answers' goal. Null when neither says (an assistant plan named `Banking Plan`).
 */
export const goalOf = (b: PlanBlock, profile?: TrainingProfile | null): string | null => {
  const n = b.name.toLowerCase();
  // half before marathon (its name holds the word), 10K before 5K
  for (const g of ['half', 'marathon', '10k', '5k', 'base'] as const) if (n.includes(GOAL_SPECS[g].name.toLowerCase())) return GOAL_WORD(g);
  if (profile && fromAnswers(b)) return GOAL_WORD(profile.goal);
  return null;
};

/**
 * Where the block came from, as the block records it (`source`, set by the route that wrote it) and when (`createdAt`):
 * `onboarding` (POST /me/onboarding: buildTemplate from the onboarding answers), `template` (POST /plans/template: the block
 * builder), `file` / `text` / `describe` / `revise` / `chat` (POST /ai/plans/apply: an assistant draft from a PDF or photo,
 * pasted text, a description, a revision, or a chat). Null for a block that records no source (an import, an older block).
 */
export const sourceWords = (b: Pick<PlanBlock, 'source' | 'createdAt'>): string | null => {
  const day = localDay(b.createdAt);
  const on = day ? ` on ${md(day)}` : '';
  switch (b.source) {
    case 'onboarding':
      return `Built from your answers${on}`;
    case 'template':
      return `Made with the plan builder${on}`;
    case 'file':
      return `Written by the assistant from a file you shared${on}`;
    case 'text':
      return `Written by the assistant from text you pasted${on}`;
    case 'describe':
      return `Written by the assistant from what you described${on}`;
    case 'revise':
      // the block keeps its first day (`createdAt`), not the day of the change, so no date is said
      return 'Revised by the assistant';
    case 'chat':
      return `Written by the assistant in a chat${on}`;
    default:
      return null;
  }
};

export interface PlanFacts {
  goal: string | null;
  /** The race: its day, and its session's name and details when the plan holds one. */
  race: { date: string; name: string | null; details: string | null } | null;
  /** The biggest week's planned miles. */
  peak: number;
  /** Runs a week, in the block's full weeks (`4`, or `3 to 5`). Null with no runs. */
  runs: string | null;
  /** The usual long-run day (`Saturday`, `Sat`) and the longest long run's miles. */
  long: { day: string | null; short: string | null; miles: number } | null;
  /** Hard sessions a week (tempo, threshold, intervals), the most in a week; 0 for none. */
  quality: number;
  /** Weeks in the plan, and whether a lead-in comes before week 1. */
  weeks: number;
  leadIn: boolean;
}

/**
 * The plan's facts from its sessions (`sessionsOn`, the log's), for the sheet's "What it is" and "Its goals". `weeks` is
 * the block's count (topWords.ts `planWeeks`).
 */
export const planFacts = (b: PlanBlock, weeks: number, sessionsOn: (d: string) => Session[], profile?: TrainingProfile | null): PlanFacts => {
  const first = firstMonOf(b);
  const days: string[] = [];
  for (let d = b.start; d <= b.end; d = shiftDays(d, 1)) days.push(d);
  const all = days.flatMap((d) => sessionsOn(d).map((s) => [d, s] as const));
  const runs = all.filter(([, s]) => s.kind === 'run');
  // per week from week 1 (a lead-in's few days and race week are not the plan's shape)
  const perWeek = new Map<string, { miles: number; runs: number; quality: number }>();
  for (const [d, s] of runs) {
    const off = Math.floor(daysBetween(first, d) / 7);
    const mon = shiftDays(first, off * 7);
    const w = perWeek.get(mon) ?? { miles: 0, runs: 0, quality: 0 };
    w.miles += Number(s.miles) || 0;
    if (d >= first) w.runs += 1;
    const t = tone(s);
    if ((t === 'hard' || t === 'fast') && !/^race\b/i.test(s.type ?? '')) w.quality += 1;
    perWeek.set(mon, w);
  }
  const raceS = all.find(([, s]) => /^race\b/i.test(s.type ?? '') || /^race\b/i.test(s.title ?? ''));
  // the plan's own weeks: from week 1, whole, not race week (its few runs are the taper's end, not the plan's shape)
  const raceMon = raceS ? shiftDays(first, Math.floor(daysBetween(first, raceS[0]) / 7) * 7) : null;
  const full = [...perWeek.entries()].filter(([mon]) => mon >= first && shiftDays(mon, 6) <= b.end && mon !== raceMon).map(([, w]) => w);
  const peak = Math.max(0, ...[...perWeek.values()].map((w) => w.miles));
  const counts = full.map((w) => w.runs).filter((n) => n > 0);
  const lo = counts.length ? Math.min(...counts) : 0;
  const hi = counts.length ? Math.max(...counts) : 0;
  const longs = runs.filter(([, s]) => tone(s) === 'long');
  const byDay = new Map<string, number>();
  // the weekday most long runs fall on, kept as one of its dates (for its long and short names)
  const sample = new Map<string, string>();
  for (const [d] of longs) {
    const k = fmtDate('dow', d);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
    if (!sample.has(k)) sample.set(k, d);
  }
  const top = [...byDay.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
  const longDate = top ? sample.get(top)! : null;
  const raceDay = raceS?.[0] ?? (profile && fromAnswers(b) && profile.raceDate && profile.raceDate >= b.start && profile.raceDate <= b.end ? profile.raceDate : null);
  return {
    goal: goalOf(b, profile),
    race: raceDay ? { date: raceDay, name: raceS ? label(raceS[1]) : null, details: raceS?.[1].details ?? null } : null,
    peak: Math.round(peak * 10) / 10,
    runs: counts.length ? (lo === hi ? String(lo) : `${lo} to ${hi}`) : null,
    long: longs.length ? { day: longDate ? fmtDate('dowLong', longDate) : null, short: longDate ? fmtDate('dow', longDate) : null, miles: Math.max(...longs.map(([, s]) => Number(s.miles) || 0)) } : null,
    quality: Math.max(0, ...full.map((w) => w.quality)),
    weeks,
    leadIn: b.start < first,
  };
};

/** The plan's length in words: `12 weeks`, `12 weeks after a lead-in`. */
export const lengthWords = (f: Pick<PlanFacts, 'weeks' | 'leadIn'>) => `${plural(f.weeks, 'week')}${f.leadIn ? ' after a warm-up week' : ''}`;
/** The miles, to a tenth (`40`, `10.5`). */
export const miles1 = tenth;
