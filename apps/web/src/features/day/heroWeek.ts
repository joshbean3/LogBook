import { counts, isSkipMark, num, sessionStatus, weekSummary, type ISODate, type Snapshot } from '@logbook/shared';
import type { Face } from './faces';

/**
 * The data of Today's hero, the week horizon (the hero spec, section 6; it replaces the gauge of guide 6.5). Two pure
 * functions, apart from the drawing, so a test can read every state:
 *
 * - `heroWeek(snapshot, date)`: what the week holds. Runs, workouts (lifts and cross sessions) and miles, done and planned.
 * - `heroScene(input)`: everything the drawing and its words show for one day page: day or dusk, the view the scene counts,
 *   the views the pill offers, the sun's place, the marks on the horizon, the band's words and what VoiceOver says, and the
 *   dusk card's totals. Its input is the week, the face's lead (`faceLead(face)`) and the view picked on the page.
 *
 * One way of counting, and it is the app's own:
 *
 * - **Runs** are `weekSummary` (`@logbook/shared`), unchanged: the function behind the week sheet, Plan's week line and the
 *   gauge this replaces, so the hero and those can never disagree. `planned` is the run sessions on the week that are not
 *   skipped; `done` is those done or at the floor, plus one for each day with a run and no run planned ("5 of 4").
 * - **Workouts** are the same rule over `lift` and `cross` sessions (spec 6.2): for each day, the ones not skipped are
 *   planned, the ones that count (`counts(sessionStatus)`: marked Done or Floor, or matched by logged sets or a lift or cross
 *   activity) are done, and a day with logged sets or a lift or cross activity and no lift or cross session standing is one
 *   more done. It is Progress's rule for lifts (`liftWeeks`), with cross sessions in too.
 * - **Miles** are `weekSummary`'s too: every mile run that week (`dayMiles`: what synced, runs marked Done at their planned
 *   miles, Floors at their floor minutes) against the miles of the runs that stand. Printed to one decimal (`tenth`).
 *
 * A skipped session leaves the week (no mark, not planned, its miles out of the plan). A missed one stays planned and is
 * never done, and the horizon never draws it: the week strip says which days were missed, and the count stays honest.
 */

/** What the scene can count. One union, so a third view can be added without a redesign (spec 6.3, 17.1). */
export type HeroView = 'runs' | 'workouts';
/** The views in the pill's order. */
export const HERO_VIEWS: readonly HeroView[] = ['runs', 'workouts'];
/** The pill's words. */
export const VIEW_WORD: Record<HeroView, string> = { runs: 'Runs', workouts: 'Workouts' };

/** Sessions of one kind on the week. */
export interface HeroCount {
  /** The sessions of the kind on the week that are not skipped. */
  planned: number;
  /** Of those, the ones that count (done or floor), plus one for each day with training of the kind and nothing of the kind planned. */
  done: number;
}

/** What the hero needs from the week. Built by `heroWeek(snapshot, date)`. */
export interface HeroWeek {
  /** The week's Monday: the band opens this week. */
  mon: ISODate;
  /** `weekSummary().runsPlanned` and `runsDone`, unchanged. */
  runs: HeroCount;
  /** Lift and cross sessions, counted the same way. */
  workouts: HeroCount;
  /** `weekSummary().doneMiles`, to two decimals. Print it with `tenth`. */
  doneMiles: number;
  /** `weekSummary().plannedMiles`: 0 when the week plans no miles (runs set in minutes, or no runs). */
  plannedMiles: number;
}

/** The kind of the session the card is about (`face.lead`), null on a rest day and a day with nothing on it. */
export type HeroLead = 'run' | 'lift' | 'cross' | null;

/** What the hero needs from the day. */
export interface HeroInput {
  week: HeroWeek;
  lead: HeroLead;
  /** The face is a run off the plan: no lead, and the day has runs (`face.runs`). */
  hasRuns: boolean;
  /** The view picked on this page today (spec 6.3), null for none. A pick for a view that does not exist is ignored. */
  picked: HeroView | null;
}

/** One session of the view on the horizon. */
export interface HeroMark {
  /** Where it sits along the way, 0 to 1: its center is at x = 38 + 282 × share in the 358 wide drawing (`markX`). */
  share: number;
  /** Done: a disc. Not done: a ring. The first `done` marks are lit, left to right. */
  lit: boolean;
  /** Lit and within 25 of the sun's center where the sun stands at rest (six runs or more with one done): not drawn. */
  inSun: boolean;
}

/** Everything the drawing and its words show. Built by `heroScene(input)`. */
export interface HeroScene {
  /** dusk: the card is about no session and no run (a rest day, a day with nothing). Every other face is day. */
  mode: 'day' | 'dusk';
  // ---------- day ----------
  /** The view shown: the pick when it exists, else the view of the day's own session. 'runs' at dusk (unused). The day's
   *  fields after it (views to said) are empty at dusk: no pill, no sun to place, no marks, no words. */
  view: HeroView;
  /** The views the pill offers, in order. One entry: no pill. Empty at dusk. */
  views: HeroView[];
  /** The sun's place, 0 to 1 along the way: done over planned, capped at 1; with no target 1 once anything is done, else 0. */
  f: number;
  /** The view has a planned count: the dotted way and the sun's place are drawn. */
  target: boolean;
  /** `target`, and done has reached planned: the two rings, no way. */
  complete: boolean;
  /** One per session of the view on the week (planned, or done when more were done), at most 10; past 10 none. */
  marks: HeroMark[];
  /** 'Runs this week' | 'Workouts this week' (set in caps by the caption style). */
  label: string;
  /** '2 of 4', or '2' with no target. */
  count: string;
  /** The week's miles, the same in both views: '9.5 of 15.5 mi' | '6.2 mi' | null for a week with no runs and no miles. */
  second: string | null;
  /** The band button's VoiceOver label (spec 11.1): 'Runs this week, 2 of 4. 9.5 of 15.5 miles. Open the week'. */
  said: string;
  // ---------- dusk (filled on day pages too: they are the week's) ----------
  /** The week's totals, each only when it has something: ['2 of 4 runs', '7.5 of 15.5 mi', '1 of 2 workouts'], or empty. */
  totals: string[];
  /** The dusk band's VoiceOver label: 'This week: 2 of 4 runs, 7.5 of 15.5 miles, 1 of 2 workouts. Open the week'; '' with no totals. */
  totalsSaid: string;
}

// ---------- the week ----------

/** Miles as the week prints them everywhere: one decimal at most ("9.5", "4", never "9.46"). */
export const tenth = (miles: number): string => num(Math.round(miles * 10) / 10);

const isWorkout = (kind: string) => kind === 'lift' || kind === 'cross';
/** A workout happened that day: logged sets, or a lift or cross activity. */
const workedOn = (snap: Snapshot, d: ISODate) => snap.liftSetCountOn(d) > 0 || snap.activitiesOn(d).some((a) => isWorkout(a.kind));

/** The hero's week for any day of it. Pure: the same snapshot and day always give the same answer. */
export const heroWeek = (snap: Snapshot, date: ISODate): HeroWeek => {
  const sum = weekSummary(snap, date);
  const workouts: HeroCount = { planned: 0, done: 0 };
  for (const { date: d } of sum.days) {
    const live = snap.sessionsOn(d).filter((s) => isWorkout(s.kind) && !isSkipMark(s.mark));
    workouts.planned += live.length;
    workouts.done += live.filter((s) => counts(sessionStatus(snap, d, s))).length;
    if (!live.length && workedOn(snap, d)) workouts.done += 1;
  }
  return { mon: sum.weekStart, runs: { planned: sum.runsPlanned, done: sum.runsDone }, workouts, doneMiles: sum.doneMiles, plannedMiles: sum.plannedMiles };
};

// ---------- the face ----------

/** The face's part of `HeroInput`: the kind of the session the card is about, and whether it is a run off the plan. */
export const faceLead = (face: Pick<Face, 'lead' | 'runs'>): Pick<HeroInput, 'lead' | 'hasRuns'> => {
  const kind = face.lead?.session.kind;
  return { lead: kind === 'run' || kind === 'lift' || kind === 'cross' ? kind : null, hasRuns: !face.lead && face.runs.length > 0 };
};

// ---------- the drawing's geometry (spec 4.1, 4.2), in the 358 x 88 viewBox ----------

/** The sun's way: its center at rest (x0, yH) and with the count met (x1, yTop). */
export const HZ = { x0: 38, x1: 320, yH: 63, yTop: 22, W: 282, D: 41 } as const;
type Pt = readonly [number, number];
/** The near hill's crest (the horizon), as cubic Bézier segments [p0, c1, c2, p1]: `M 0 69 C 40 62 86 56 138 59 C 198 63 250 72 300 70 C 325 69 345 66 358 64`. */
export const NEAR_CREST: readonly (readonly [Pt, Pt, Pt, Pt])[] = [
  [[0, 69], [40, 62], [86, 56], [138, 59]],
  [[138, 59], [198, 63], [250, 72], [300, 70]],
  [[300, 70], [325, 69], [345, 66], [358, 64]],
];
/** The sun's center at fraction `f`: straight across, and up a parabola whose top is the full count. */
export const sunAt = (f: number): [number, number] => [HZ.x0 + HZ.W * f, HZ.yTop + HZ.D * (1 - f) * (1 - f)];
/** A mark's center x from its share. */
export const markX = (share: number): number => HZ.x0 + HZ.W * share;
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};
/** The horizon's height at x (each segment's x rises with t, so t is found by halving). */
export const crestY = (x: number): number => {
  const seg = NEAR_CREST.find((s) => x <= s[3][0]) ?? NEAR_CREST[NEAR_CREST.length - 1]!;
  const [p0, c1, c2, p1] = seg;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const t = (lo + hi) / 2;
    if (bez(p0[0], c1[0], c2[0], p1[0], t) < x) lo = t;
    else hi = t;
  }
  return bez(p0[1], c1[1], c2[1], p1[1], (lo + hi) / 2);
};
/** Marks past this many are not drawn: the band carries the count. */
export const MAX_MARKS = 10;
/** The first mark's center is never left of this (clear of the resting sun), and each next is this far right of the last. */
const FIRST_X = 70;
const MARK_GAP = 14;
/** A lit mark this close to the sun's center (the sun's 15 and its 3.5 keyline, the mark's 4.5, and 2 to spare) is in the sun. */
const IN_SUN = 25;

/**
 * The marks of a count (spec 6.5): one per session (`max(planned, done)`), evenly spread along the way, then pushed right
 * where they would crowd: the first never left of 70, each next at least 14 past the one before. The first `done` are lit.
 * Evenly spread, the sun (at done over planned) always stands halfway between the last lit mark and the next open one.
 */
const marksOf = (c: HeroCount, f: number): HeroMark[] => {
  const n = Math.max(c.planned, c.done);
  if (n > MAX_MARKS) return [];
  const [sx, sy] = sunAt(f);
  let last = FIRST_X - MARK_GAP;
  return Array.from({ length: n }, (_, i) => {
    const x = Math.max(markX((i + 0.5) / n), last + MARK_GAP);
    last = x;
    const lit = i < c.done;
    return { share: (x - HZ.x0) / HZ.W, lit, inSun: lit && Math.hypot(x - sx, crestY(x) - sy) < IN_SUN };
  });
};

// ---------- the words ----------

const LABEL: Record<HeroView, string> = { runs: 'Runs this week', workouts: 'Workouts this week' };
const countOf = (week: HeroWeek, view: HeroView): HeroCount => (view === 'runs' ? week.runs : week.workouts);
const has = (c: HeroCount) => c.planned + c.done > 0;
/** '2 of 4', or '2' with no target. */
const countText = (c: HeroCount) => (c.planned > 0 ? `${c.done} of ${c.planned}` : `${c.done}`);
/** The noun after a count: singular when its planned count is 1, or with no target when its done count is 1. */
const noun = (planned: number, done: number, one: string, many: string) => ((planned > 0 ? planned : done) === 1 ? one : many);
/** The week's miles, printed and spoken. Null for a week with no run planned, no run done and no miles (lifts only). */
const milesOf = (week: HeroWeek): { text: string; said: string } | null => {
  if (!has(week.runs) && week.doneMiles <= 0 && week.plannedMiles <= 0) return null;
  const [done, planned] = [tenth(week.doneMiles), tenth(week.plannedMiles)];
  const word = noun(Number(planned), Number(done), 'mile', 'miles');
  return week.plannedMiles > 0 ? { text: `${done} of ${planned} mi`, said: `${done} of ${planned} ${word}` } : { text: `${done} mi`, said: `${done} ${word}` };
};
/** The dusk card's totals, printed and spoken: runs, miles, workouts, each only when it has something (spec 6.8). */
const totalsOf = (week: HeroWeek): { text: string; said: string }[] => {
  const out: { text: string; said: string }[] = [];
  const kind = (c: HeroCount, one: string, many: string) => {
    const t = `${countText(c)} ${noun(c.planned, c.done, one, many)}`;
    out.push({ text: t, said: t });
  };
  if (has(week.runs)) kind(week.runs, 'run', 'runs');
  if (week.plannedMiles > 0 || week.doneMiles > 0) out.push(milesOf(week)!);
  if (has(week.workouts)) kind(week.workouts, 'workout', 'workouts');
  return out;
};

// ---------- the scene ----------

/**
 * Everything one day page's hero shows. The rules (spec 6.3 to 6.8):
 *
 * - **Day or dusk**: dusk when the card is about no session and no run (`lead === null && !hasRuns`): the faces the app
 *   calls rest and restMorning ("Rest day", "Nothing planned"). A skipped or missed session is a day scene: the card still
 *   names it.
 * - **Views**: a view exists when it has something to count (`planned + done > 0`); the view of the day's own session
 *   always exists. Order: Runs, Workouts. The pill shows when two exist.
 * - **Which view**: the pick, when it exists; else the day's own: a run (or a run off the plan) opens Runs, a lift or a
 *   cross session opens Workouts. A day with a run and a lift opens on Runs, because the card's name is the run (`heroLead`).
 * - **The sun**: `f` is done over planned, capped at 1. No target: 1 once anything is done (the sun is up), else 0.
 * - **The words**: the label says what is counted, the count follows, the week's miles are the second number in both views.
 */
export const heroScene = ({ week, lead, hasRuns, picked }: HeroInput): HeroScene => {
  const own: HeroView | null = lead === 'run' ? 'runs' : lead ? 'workouts' : hasRuns ? 'runs' : null;
  const mode = own ? 'day' : 'dusk';
  const views = own ? HERO_VIEWS.filter((v) => v === own || has(countOf(week, v))) : [];
  const view = picked && views.includes(picked) ? picked : (own ?? 'runs');
  const c = countOf(week, view);
  const target = mode === 'day' && c.planned > 0;
  const f = mode === 'dusk' ? 0 : target ? Math.min(1, c.done / c.planned) : c.done > 0 ? 1 : 0;
  const complete = target && c.done >= c.planned;
  const totals = totalsOf(week);
  const dusk = { totals: totals.map((t) => t.text), totalsSaid: totals.length ? `This week: ${totals.map((t) => t.said).join(', ')}. Open the week` : '' };
  // at dusk the band carries the totals: the day's words are empty, so nothing can print "Runs this week" on a rest day
  if (mode === 'dusk') return { mode, view, views, f, target, complete, marks: [], label: '', count: '', second: null, said: '', ...dusk };
  const label = LABEL[view];
  const count = countText(c);
  const miles = milesOf(week);
  return {
    mode,
    view,
    views,
    f,
    target,
    complete,
    marks: marksOf(c, f),
    label,
    count,
    second: miles?.text ?? null,
    // the label, the count, then the miles in words; on Workouts the miles say they were run
    said: `${label}, ${count}${complete ? ', all done' : ''}${miles ? `. ${miles.said}${view === 'workouts' ? ' run' : ''}` : ''}. Open the week`,
    ...dusk,
  };
};
