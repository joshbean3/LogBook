/**
 * Progress: every number on the page, from the log. Pure functions over the snapshot so the page, its sheets and its tests
 * agree. Nothing here renders.
 */
import { counts, e1rm, fmtDate, isSkipMark, label, mi, mondayOf, parseISO, sessionStatus, shiftDays, zoneOf, type Activity, type HrZone, type ISODate, type LiftSet, type PlanBlock, type Session } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { dayMiles } from '../sessions/miles';

// ---------- range ----------
export type Range = '3M' | '6M' | '1Y';
export const RANGES: Range[] = ['3M', '6M', '1Y'];
/** Weeks shown, the current one included. */
export const RANGE_WEEKS: Record<Range, number> = { '3M': 13, '6M': 26, '1Y': 52 };
export const RANGE_WORDS: Record<Range, string> = { '3M': '3 months', '6M': '6 months', '1Y': 'year' };
/** "in 3 months" / "this year": for subs and sheet eyebrows. */
export const rangePhrase = (r: Range) => (r === '1Y' ? 'in a year' : `in ${RANGE_WORDS[r]}`);
export const rangeLabel = (r: Range) => (r === '1Y' ? 'Last 12 months' : `Last ${RANGE_WORDS[r]}`);
/** Planned weeks drawn as ghosts after this one: where the block is heading, never most of the chart. */
export const FUTURE_WEEKS = 2;

/** The first Monday in view for a range, and the last day (the Sunday after the future weeks). */
export const rangeBounds = (today: ISODate, r: Range) => {
  const mon = mondayOf(today);
  return { from: shiftDays(mon, -7 * (RANGE_WEEKS[r] - 1)), to: shiftDays(mon, 7 * FUTURE_WEEKS + 6) };
};

// ---------- words ----------
const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** "Three" for 3, "14" past twelve. Sentence-initial. */
export const Words = (n: number) => SMALL[n] ?? String(n);
export const words = (n: number) => (SMALL[n] ?? String(n)).toLowerCase();
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** ISO-8601 week id for the shared element: `2026-W42`. */
export const isoWeek = (date: ISODate) => {
  const d = parseISO(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3); // the Thursday of this week decides the year
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
};
export const weekId = (monday: ISODate) => `week-${isoWeek(monday)}`;
export const weekTitle = (monday: ISODate, today: ISODate) => (monday === mondayOf(today) ? 'This week' : monday === shiftDays(mondayOf(today), -7) ? 'Last week' : `Week of ${fmtDate('md', monday)}`);

/** Pace in seconds per mile -> `8:14`. */
export const paceText = (sec: number) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const paceOfRun = (a: Activity) => (a.miles > 0.2 && a.movingSec > 0 ? a.movingSec / a.miles : null);

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const monthName = (d: ISODate) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(parseISO(d));
const days7 = (mon: ISODate) => Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));

// ---------- the weekly series ----------
export interface WeekPoint {
  /** Monday. */
  w: ISODate;
  ran: number;
  runs: number;
  /** Planned run miles, skips left out. */
  planned: number;
  /** Planned runs, skips left out. */
  plannedRuns: number;
  /** Of `ran`, the miles logged by hand: runs marked Done with no activity (contract 5), drawn with a hairline. */
  logged: number;
  /** The longest run that week (an activity, or a run logged by hand). */
  long: number;
  longRun: Activity | null;
  current: boolean;
  future: boolean;
  /** Trailing four-week average of finished weeks (null before the first run, on this week and the future). */
  avg: number | null;
}

export const weekSeries = (snap: AppSnapshot, today: ISODate, r: Range): WeekPoint[] => {
  const mon = mondayOf(today);
  const n = RANGE_WEEKS[r];
  const pts: WeekPoint[] = Array.from({ length: n + FUTURE_WEEKS }, (_, i) => {
    const w = shiftDays(mon, (i - n + 1) * 7);
    let ran = 0;
    let runs = 0;
    let logged = 0;
    let long = 0;
    let planned = 0;
    let plannedRuns = 0;
    let longRun: Activity | null = null;
    for (const d of days7(w)) {
      for (const s of snap.sessionsOn(d))
        if (s.kind === 'run' && !isSkipMark(s.mark)) {
          planned += Number(s.miles) || 0;
          plannedRuns++;
        }
      if (d > today) continue;
      const acts = snap.runsOn(d);
      for (const a of acts) {
        ran += a.miles;
        runs++;
        if (!longRun || a.miles > longRun.miles) longRun = a;
        long = Math.max(long, a.miles);
      }
      // a run marked Done (or Floor) that no activity covers counts its miles (contract 5)
      const dm = dayMiles(snap, d);
      if (dm.logged > 0) {
        const n = dm.runs - acts.length;
        ran += dm.logged;
        runs += n;
        logged += dm.logged;
        long = Math.max(long, dm.logged / Math.max(1, n));
      }
    }
    return { w, ran, runs, logged, planned, plannedRuns, long, longRun, current: w === mon, future: w > mon, avg: null };
  });
  const first = pts.findIndex((p) => p.ran > 0);
  pts.forEach((p, i) => {
    if (p.current || p.future || first < 0 || i < first) return;
    const win = pts.slice(Math.max(first, i - 3), i + 1);
    p.avg = sum(win.map((q) => q.ran)) / win.length;
  });
  return pts;
};

/** Weeks that count toward averages: finished, from the first week with a run. */
export const finishedWeeks = (pts: WeekPoint[]) => {
  const first = pts.findIndex((p) => p.ran > 0);
  return first < 0 ? [] : pts.slice(first).filter((p) => !p.current && !p.future);
};

/** The numbers above the chart when nobody is touching it: the range, summed up. */
export const rangeSummary = (pts: WeekPoint[]) => {
  const done = finishedWeeks(pts);
  const past = pts.filter((p) => !p.future);
  const best = past.reduce<WeekPoint | null>((b, p) => (!b || p.ran > b.ran ? p : b), null);
  return {
    avg: done.length ? sum(done.map((p) => p.ran)) / done.length : null,
    best: best && best.ran > 0 ? best : null,
    total: sum(past.map((p) => p.ran)),
    runs: sum(past.map((p) => p.runs)),
  };
};

// ---------- the verdict ----------
/** Miles run Monday through `upTo`'s weekday, in the week starting `mon`. */
const ranThrough = (snap: AppSnapshot, mon: ISODate, dayIndex: number) => sum(days7(mon).slice(0, dayIndex + 1).map((d) => dayMiles(snap, d).miles));

export interface Verdict {
  /** Serif 28: two short sentences, the trend then this week. */
  line: string;
  /** The week in words and a number: "8.2 of 26 mi planned. Two runs in." */
  sub: string;
}

/**
 * The page's one sentence. Never a zero as the headline: a quiet stretch is said in words ("Two quiet weeks."), and the
 * week so far is compared with the same weekday last week, not with a whole week's average.
 */
export const verdict = (snap: AppSnapshot, today: ISODate, pts: WeekPoint[], streakWeeks: number): Verdict => {
  const ci = pts.findIndex((p) => p.current);
  const cur = pts[ci]!;
  const done = finishedWeeks(pts);
  const last = done[done.length - 1] ?? null;
  const prior = done.slice(0, -1).slice(-4);
  const priorAvg = prior.length ? sum(prior.map((p) => p.ran)) / prior.length : null;

  // 1. the trend, over finished weeks
  let trend = '';
  let building = 0;
  // building: each week bigger than a week that had running in it (climbing out of a blank week is a restart, not a build)
  for (let i = done.length - 1; i > 0 && done[i - 1]!.ran > 0 && done[i]!.ran > done[i - 1]!.ran + 0.5; i--) building++;
  // a quiet week ran under half of the average of the run weeks in the four before it
  let quiet = 0;
  for (let i = done.length - 1; i >= 0; i--) {
    const win = done.slice(Math.max(0, i - 4), i).filter((p) => p.ran > 0);
    const base = win.length ? sum(win.map((p) => p.ran)) / win.length : null;
    if (base == null || base < 3 || done[i]!.ran >= base * 0.5) break;
    quiet++;
  }
  if (!last) trend = 'A first week on the board.';
  else if (building >= 2) trend = `${Words(building + 1)} weeks building.`;
  else if (quiet >= 2) trend = `${Words(quiet)} quiet weeks.`;
  else if (quiet === 1) trend = 'Last week was quiet.';
  else if (priorAvg != null && last.ran >= priorAvg * 1.15 && done.slice(-6, -1).every((p) => p.ran < last.ran)) trend = `Last week was your biggest in ${words(Math.min(done.length, 6))} weeks.`;
  else if (streakWeeks >= 3) trend = `${Words(streakWeeks)} weeks kept in a row.`;
  else if (priorAvg != null && last.ran >= priorAvg * 1.15) trend = 'Last week was up on your average.';
  else {
    const avg = sum(done.slice(-4).map((p) => p.ran)) / Math.min(4, done.length);
    trend = `Steady at about ${Math.round(avg)} mi a week.`;
  }

  // 2. this week, against the same weekday last week
  const di = (parseISO(today).getDay() + 6) % 7;
  const prevMon = shiftDays(cur.w, -7);
  const sameDayLast = ranThrough(snap, prevMon, di);
  const next = nextRun(snap, today, cur.w);
  // a run planned earlier this week (and not skipped) means today's isn't the first: say "Next", as Plan's header does
  const earlier = days7(cur.w).some((d) => d < today && snap.sessionsOn(d).some((x) => x.kind === 'run' && !isSkipMark(x.mark)));
  let now = '';
  if (cur.planned > 0 && cur.ran >= cur.planned - 0.05) now = 'This one is done.';
  else if (cur.ran <= 0.05) {
    if (next?.date === today && di <= 1 && !earlier) now = 'This one starts today.';
    else if (next?.date === today) now = 'This one is light so far.';
    else if (di <= 1 && next && !earlier) now = `This one starts ${relDay(next.date, today)}.`;
    else if (sameDayLast > 0 || next) now = 'This one is light so far.';
    else now = 'This one is still open.';
  } else if (sameDayLast <= 0.05 || cur.ran >= sameDayLast * 1.1) now = 'This one is ahead of last week.';
  else if (cur.ran <= sameDayLast * 0.75) now = 'This one is light so far.';
  else now = 'This one is level with last week.';

  // 3. the sub: miles vs plan, as words and a number
  let sub: string;
  const runsIn = cur.runs ? `${Words(cur.runs)} ${plural(cur.runs, 'run')} in.` : '';
  if (cur.planned > 0) {
    if (cur.ran > 0.05) sub = `${mi(cur.ran)} of ${round1(cur.planned)} mi planned. ${runsIn}`;
    else if (next?.date === today && !earlier) sub = `${round1(cur.planned)} mi planned. First run today: ${label(next.s)}.`;
    else sub = `${round1(cur.planned)} mi planned.${next ? ` Next: ${label(next.s)}, ${relDay(next.date, today)}.` : ''}`;
  } else if (cur.ran > 0.05) sub = `${mi(cur.ran)} mi so far. ${runsIn}`;
  else sub = next ? `Next: ${label(next.s)}, ${relDay(next.date, today)}.` : 'No runs planned this week. Runs you log land here.';
  return { line: `${trend} ${now}`, sub: sub.trim() };
};

const round1 = (v: number) => String(Math.round(v * 10) / 10);
const relDay = (d: ISODate, today: ISODate) => (d === today ? 'today' : d === shiftDays(today, 1) ? 'tomorrow' : fmtDate('dowLong', d));

/** The next planned, unskipped run from today to Sunday that has not happened yet. */
export const nextRun = (snap: AppSnapshot, today: ISODate, mon: ISODate) => {
  for (const d of days7(mon)) {
    if (d < today) continue;
    if (d === today && snap.runsOn(d).length) continue;
    const s = snap.sessionsOn(d).find((x) => x.kind === 'run' && !isSkipMark(x.mark));
    if (s) return { date: d, s };
  }
  return null;
};

// ---------- plan adherence ----------
export interface AdherenceWeek {
  w: ISODate;
  kept: number;
  planned: number;
  /** Sessions still ahead this week (today on). */
  ahead: number;
}
export interface Adherence {
  block: PlanBlock | null;
  weeks: AdherenceWeek[];
  kept: number;
  planned: number;
}

/** The block that holds today, else the latest one that started. */
export const currentBlock = (blocks: PlanBlock[], today: ISODate) =>
  blocks.find((b) => b.start <= today && b.end >= today) ?? [...blocks].filter((b) => b.start <= today).sort((a, b) => (a.start < b.start ? 1 : -1))[0] ?? null;

/**
 * Sessions kept vs planned, week by week, for the current block inside the range (or every planned session in the range
 * when there is no block). Kept: done, floor, or skipped for illness. Rest days are not counted either way. Only days up
 * to yesterday are graded; today's and later sessions are "ahead", never missed.
 */
export const adherence = (snap: AppSnapshot, today: ISODate, from: ISODate, blocks: PlanBlock[]): Adherence => {
  const block = currentBlock(blocks, today);
  const start = block ? (block.start > from ? block.start : from) : from;
  const inBlock = (s: Session) => !block || s.blockId === block.id;
  const weeks: AdherenceWeek[] = [];
  for (let w = mondayOf(start); w <= mondayOf(today); w = shiftDays(w, 7)) {
    let kept = 0;
    let planned = 0;
    let ahead = 0;
    for (const d of days7(w)) {
      if (d < start) continue;
      for (const s of snap.sessionsOn(d)) {
        if (s.kind === 'rest' || !inBlock(s)) continue;
        if (d >= today) {
          if (!isSkipMark(s.mark)) ahead++;
          // something already kept today counts now
          if (d === today && counts(sessionStatus(snap, d, s))) {
            kept++;
            planned++;
            ahead--;
          }
          continue;
        }
        planned++;
        if (counts(sessionStatus(snap, d, s)) || s.mark === 'sick') kept++;
      }
    }
    if (planned || ahead) weeks.push({ w, kept, planned, ahead });
  }
  return { block, weeks, kept: sum(weeks.map((x) => x.kept)), planned: sum(weeks.map((x) => x.planned)) };
};

// ---------- long run ----------
export interface LongRun {
  points: Array<{ w: ISODate; miles: number; run: Activity | null }>;
  recent: number;
  recentRun: Activity | null;
  early: number;
  earlyMonth: string | null;
  peak: Activity | null;
  /** The longest week's long run in range, activity or logged, and its month ("Aug"). */
  best: { miles: number; w: ISODate; month: string } | null;
}
export const longRuns = (pts: WeekPoint[]): LongRun => {
  const past = pts.filter((p) => !p.future);
  const first = past.findIndex((p) => p.ran > 0);
  const live = first < 0 ? [] : past.slice(first);
  const points = live.map((p) => ({ w: p.w, miles: p.long, run: p.longRun }));
  const recentWin = points.slice(-4);
  const recentBest = recentWin.reduce<(typeof points)[number] | null>((b, p) => (!b || p.miles > b.miles ? p : b), null);
  const earlyWin = points.length > 6 ? points.slice(0, 4) : [];
  const earlyBest = earlyWin.reduce<(typeof points)[number] | null>((b, p) => (!b || p.miles > b.miles ? p : b), null);
  const peak = points.reduce<Activity | null>((b, p) => (p.run && (!b || p.run.miles > b.miles) ? p.run : b), null);
  const top = points.reduce<(typeof points)[number] | null>((b, p) => (p.miles > 0 && (!b || p.miles > b.miles) ? p : b), null);
  return {
    best: top ? { miles: top.miles, w: top.w, month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parseISO(top.run?.date ?? top.w)) } : null,
    points,
    recent: recentBest?.miles ?? 0,
    recentRun: recentBest?.run ?? null,
    early: earlyBest?.miles ?? 0,
    earlyMonth: earlyBest?.run ? monthName(earlyBest.run.date) : null,
    peak,
  };
};

// ---------- easy pace ----------
export interface EasyRun {
  a: Activity;
  pace: number;
  hr: number | null;
  why: 'planned' | 'zone' | 'hr' | 'pace';
}
export interface EasyPace {
  runs: EasyRun[];
  /** Weekly median easy pace (sec/mi), finished and current weeks with an easy run. */
  weekly: Array<{ w: ISODate; pace: number; hr: number | null }>;
  now: number | null;
  nowHr: number | null;
  then: number | null;
  thenMonth: string | null;
  basis: 'planned' | 'zones' | 'hr' | 'pace';
}

const EASY_TYPES = /easy|long|recovery|shakeout|base/i;
/**
 * Easy runs in the range: runs on a day planned as Easy/Long/Recovery; else, with heart-rate zones, runs averaging zone 2 or
 * under; else runs at or under the range's median heart rate; else the slower half by pace. Walk-heavy outings (pace
 * more than 35% slower than the median) are left out so one stroll does not drag the line.
 */
export const easyPace = (snap: AppSnapshot, from: ISODate, today: ISODate, zones: HrZone[] | null): EasyPace => {
  const all: Activity[] = [];
  for (let d = from; d <= today; d = shiftDays(d, 1)) all.push(...snap.runsOn(d));
  const paced = all.map((a) => ({ a, pace: paceOfRun(a) })).filter((x): x is { a: Activity; pace: number } => x.pace != null);
  const med = median(paced.map((x) => x.pace)) ?? 0;
  const sane = paced.filter((x) => x.pace <= med * 1.35);
  const hrs = sane.map((x) => x.a.avgHr).filter((h): h is number => h != null);
  const hrMed = median(hrs);
  const basis: EasyPace['basis'] = zones?.length ? 'zones' : hrs.length >= Math.max(3, sane.length * 0.6) ? 'hr' : 'pace';
  const runs: EasyRun[] = [];
  for (const x of sane) {
    const planned = snap.sessionsOn(x.a.date).find((s) => s.kind === 'run');
    const hr = x.a.avgHr ?? null;
    if (planned) {
      if (EASY_TYPES.test(planned.type ?? '')) runs.push({ ...x, hr, why: 'planned' });
      continue;
    }
    if (basis === 'zones') {
      const z = zoneOf(zones, hr);
      if (z != null && z <= 2) runs.push({ ...x, hr, why: 'zone' });
    } else if (basis === 'hr') {
      if (hr != null && hrMed != null && hr <= hrMed) runs.push({ ...x, hr, why: 'hr' });
    } else if (x.pace >= med) runs.push({ ...x, hr, why: 'pace' });
  }
  runs.sort((a, b) => (a.a.date < b.a.date ? -1 : 1));
  const byWeek = new Map<ISODate, EasyRun[]>();
  for (const r of runs) {
    const w = mondayOf(r.a.date);
    byWeek.set(w, [...(byWeek.get(w) ?? []), r]);
  }
  const weekly = [...byWeek.entries()].map(([w, rs]) => ({ w, pace: median(rs.map((r) => r.pace))!, hr: median(rs.map((r) => r.hr).filter((h): h is number => h != null)) }));
  const recent = runs.filter((r) => r.a.date >= shiftDays(mondayOf(today), -21));
  const early = runs.length >= 6 ? runs.filter((r) => r.a.date < shiftDays(runs[0]!.a.date, 28)) : [];
  const nowSet = recent.length ? recent : runs.slice(-3);
  return {
    runs,
    weekly,
    now: median(nowSet.map((r) => r.pace)),
    nowHr: median(nowSet.map((r) => r.hr).filter((h): h is number => h != null)),
    then: early.length && early.length < runs.length ? median(early.map((r) => r.pace)) : null,
    thenMonth: early.length ? monthName(early[0]!.a.date) : null,
    basis,
  };
};

// ---------- lifts ----------
export interface LiftDay {
  date: ISODate;
  weight: number;
  reps: number;
  e1rm: number;
}
export interface LiftGroup {
  name: string;
  /** The best set of each day in the range, oldest first. */
  days: LiftDay[];
  /** e1RM change across the range, as a ratio (null with one day). */
  change: number | null;
}
export const liftGroups = (sets: LiftSet[], from: ISODate, today: ISODate): LiftGroup[] => {
  const by = new Map<string, { name: string; days: Map<ISODate, LiftDay> }>();
  for (const s of sets) {
    if (s.date < from || s.date > today) continue;
    const k = s.exercise.trim().toLowerCase();
    if (!by.has(k)) by.set(k, { name: s.exercise.trim(), days: new Map() });
    const g = by.get(k)!;
    const e = e1rm(s.weight, s.reps);
    const cur = g.days.get(s.date);
    if (!cur || e > cur.e1rm) g.days.set(s.date, { date: s.date, weight: s.weight, reps: s.reps, e1rm: e });
  }
  return [...by.values()]
    .map((g) => {
      const days = [...g.days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
      const first = days[0]!;
      const last = days[days.length - 1]!;
      return { name: g.name, days, change: days.length > 1 ? (last.e1rm - first.e1rm) / first.e1rm : null };
    })
    .sort((a, b) => (a.days[a.days.length - 1]!.date < b.days[b.days.length - 1]!.date ? 1 : -1));
};
export const signedPct = (ch: number) => `${ch >= 0 ? '+' : '−'}${Math.abs(Math.round(ch * 100))}%`;

// ---------- consistency ----------
export interface HabitLike {
  id: string;
  name: string;
  createdOn: ISODate;
}
export interface ConsistencyRow {
  id: string;
  name: string;
  train: boolean;
  hit: number;
  of: number;
}
export interface Consistency {
  rows: ConsistencyRow[];
  /** Per week in range: share of habit checks done (0..1), null before any habit existed. */
  habitWeeks: Array<{ w: ISODate; v: number | null }>;
  /** Weeks kept by the floor rule, in the range from the first week with anything in it. */
  keptWeeks: number;
  weeks: number;
  habitHit: number;
  habitOf: number;
}

export const consistency = (snap: AppSnapshot, today: ISODate, from: ISODate, habits: HabitLike[], weekKept: (w: ISODate) => boolean, dayStatus: (d: ISODate) => string): Consistency => {
  const rows: ConsistencyRow[] = [{ id: '__t', name: 'Training', train: true, hit: 0, of: 0 }, ...habits.map((h) => ({ id: h.id, name: h.name, train: false, hit: 0, of: 0 }))];
  const habitWeeks: Consistency['habitWeeks'] = [];
  let keptWeeks = 0;
  let weeks = 0;
  let started = false;
  for (let w = mondayOf(from); w <= mondayOf(today); w = shiftDays(w, 7)) {
    let hHit = 0;
    let hOf = 0;
    let anything = false;
    for (const d of days7(w)) {
      if (d < from || d > today) continue;
      const st = dayStatus(d);
      if (st !== 'empty' && st !== 'upcoming') anything = true;
      const tr = rows[0]!;
      if (st === 'done' || st === 'floor' || st === 'missed' || st === 'bonus') {
        tr.of++;
        if (st !== 'missed') tr.hit++;
      }
      habits.forEach((h, i) => {
        if (h.createdOn && d < h.createdOn) return;
        const done = snap.isHabitDone(d, h.id);
        // today counts only once it is done: an unfinished today never lowers a rate
        if (d === today && !done) return;
        const r = rows[i + 1]!;
        r.of++;
        hOf++;
        if (done) {
          r.hit++;
          hHit++;
          anything = true;
        }
      });
    }
    habitWeeks.push({ w, v: hOf ? hHit / hOf : null });
    if (anything) started = true;
    // this week is still being run: it counts once it is kept, never against you while it is open
    const open = w === mondayOf(today);
    if (started && (!open || weekKept(w))) {
      weeks++;
      if (weekKept(w)) keptWeeks++;
    }
  }
  const habitRows = rows.slice(1);
  return { rows, habitWeeks, keptWeeks, weeks, habitHit: sum(habitRows.map((r) => r.hit)), habitOf: sum(habitRows.map((r) => r.of)) };
};

export const pct = (hit: number, of: number) => (of ? Math.round((hit / of) * 100) : null);
