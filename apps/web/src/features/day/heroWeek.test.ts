import { MORNING_DEFAULTS, shiftDays, weekSummary, type Activity, type ISODate, type Session, type Snapshot } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { faceOf, phaseOf } from './faces';
import { crestY, faceLead, HERO_VIEWS, heroScene, heroWeek, markX, MAX_MARKS, sunAt, tenth, type HeroCount, type HeroInput, type HeroLead, type HeroView, type HeroWeek } from './heroWeek';

// ---------- a week to count: Monday November 9 to Sunday November 15, 2026; today is Wednesday unless a test says so ----------
const MON = '2026-11-09';
const DAYS = [0, 1, 2, 3, 4, 5, 6].map((i) => shiftDays(MON, i));
const [M, TU, W, TH, F, SA, SU] = DAYS as [ISODate, ISODate, ISODate, ISODate, ISODate, ISODate, ISODate];

let n = 0;
const sess = (date: ISODate, kind: Session['kind'], over: Partial<Session> = {}): Session => ({
  id: over.id ?? `s${++n}`,
  date,
  position: 0,
  kind,
  type: kind === 'run' ? 'Easy' : kind === 'lift' ? 'Strength' : kind === 'cross' ? 'Bike' : 'Rest',
  title: null,
  details: null,
  miles: null,
  minutes: null,
  blockId: null,
  movedFrom: null,
  mark: null,
  ...over,
});
const run = (date: ISODate, miles: number | null, over: Partial<Session> = {}) => sess(date, 'run', { miles, ...over });
const lift = (date: ISODate, over: Partial<Session> = {}) => sess(date, 'lift', over);
const cross = (date: ISODate, over: Partial<Session> = {}) => sess(date, 'cross', { minutes: 40, ...over });
const rest = (date: ISODate) => sess(date, 'rest');
const act = (date: ISODate, miles: number, over: Partial<Activity> = {}): Activity => ({
  id: `a${++n}`,
  date,
  time: '07:10',
  name: 'Morning Run',
  sportType: 'Run',
  kind: 'run',
  miles,
  movingSec: miles * 540,
  elevFt: 0,
  avgHr: null,
  maxHr: null,
  cadence: null,
  laps: null,
  perfAt: null,
  polyline: null,
  ...over,
});
const snapOf = (sessions: Session[], acts: Activity[] = [], today: ISODate = W, sets: Record<ISODate, number> = {}): Snapshot => ({
  today,
  sessionsOn: (d) => sessions.filter((s) => s.date === d).sort((a, b) => a.position - b.position),
  activitiesOn: (d) => acts.filter((a) => a.date === d),
  liftSetCountOn: (d) => sets[d] ?? 0,
});

/** The owner's kind of week: no plan block, sessions put on days one by one. 15.5 miles over four runs, a lift, a ride. */
const ownerWeek = (blockId: string | null = null): Session[] => [
  run(M, 4, { id: 'r-mon', blockId }),
  lift(TU, { id: 'l-tue', blockId }),
  run(W, 3.5, { id: 'r-wed', type: 'Intervals', blockId }),
  cross(TH, { id: 'c-thu', blockId }),
  run(F, 3, { id: 'r-fri', blockId }),
  run(SA, 5, { id: 'r-sat', type: 'Long', blockId }),
];

/** A week as the hero reads it, written by hand (the counts of the spec's states). */
const wk = (runs: [number, number], workouts: [number, number], doneMiles: number, plannedMiles: number): HeroWeek => ({
  mon: MON,
  runs: { planned: runs[0], done: runs[1] },
  workouts: { planned: workouts[0], done: workouts[1] },
  doneMiles,
  plannedMiles,
});
const day = (week: HeroWeek, lead: HeroLead, over: Partial<HeroInput> = {}) => heroScene({ week, lead, hasRuns: false, picked: null, ...over });
/** The marks' centers in the drawing, to one decimal. */
const xs = (week: HeroWeek, lead: HeroLead = 'run') => day(week, lead).marks.map((m) => Math.round(markX(m.share) * 10) / 10);
const sameAsWeekSheet = (snap: Snapshot, d: ISODate) => {
  const h = heroWeek(snap, d);
  const s = weekSummary(snap, d);
  expect([h.mon, h.runs.planned, h.runs.done, h.doneMiles, h.plannedMiles]).toEqual([s.weekStart, s.runsPlanned, s.runsDone, s.doneMiles, s.plannedMiles]);
  return h;
};

/** A log for the faces, through the app's own snapshot (October-style bundles), with or without a plan block. */
const bundle = (month: string, sessions: Session[], activities: Activity[] = []): MonthBundle => ({ month, sessions, checks: [], lifts: [], activities, morningDays: {}, journal: [], coach: [] });
const logOf = (sessions: Session[], activities: Activity[] = [], today: ISODate = W): Log => {
  const snap = buildSnapshot({ '2026-11': bundle('2026-11', sessions, activities) }, today);
  return { today, boot: { morningSettings: MORNING_DEFAULTS, habits: [], blocks: [] } as unknown as Log['boot'], fitness: true, habits: [], zones: null, features: { claude: false, strava: false }, strava: null, snap, ready: true, loading: false, loaded: () => true } as Log;
};
/** The page's hero for a day at 1 pm, as the hero will build it: the week, the face's lead, no pick. */
const pageScene = (log: Log, d: ISODate, picked: HeroView | null = null) => {
  const face = faceOf(log, d, phaseOf(log, d, 13 * 60));
  return { face, scene: heroScene({ week: heroWeek(log.snap, d), ...faceLead(face), picked }) };
};

// ---------- the week ----------

describe('the week: the owner’s kind, no plan block, sessions day by day', () => {
  it('counts the runs, the workouts and the miles, and the runs and miles are the week sheet’s', () => {
    const h = sameAsWeekSheet(snapOf(ownerWeek()), W);
    expect(h).toEqual({ mon: MON, runs: { planned: 4, done: 0 }, workouts: { planned: 2, done: 0 }, doneMiles: 0, plannedMiles: 15.5 });
    // the gauge this replaces printed "0 of 15.5 mi" and "0 of 4 runs" from the same weekSummary
    expect(day(h, 'run')).toMatchObject({ label: 'Runs this week', count: '0 of 4', second: '0 of 15.5 mi' });
  });
  it('a plan block changes nothing', () => {
    expect(heroWeek(snapOf(ownerWeek('block-1')), W)).toEqual(heroWeek(snapOf(ownerWeek()), W));
  });
  it('mid-week: a run that synced, a run marked done by hand, a lift with its sets in', () => {
    const sessions = ownerWeek('block-1').map((s) => (s.id === 'r-wed' ? { ...s, mark: 'done' as const } : s));
    const h = sameAsWeekSheet(snapOf(sessions, [act(M, 4.1)], TH, { [TU]: 12 }), TH);
    // 4.1 tracked, and the run marked done counts its planned 3.5
    expect(h).toMatchObject({ runs: { planned: 4, done: 2 }, workouts: { planned: 2, done: 1 }, doneMiles: 7.6, plannedMiles: 15.5 });
  });
  it('a week with nothing is all zeros', () => {
    expect(heroWeek(snapOf([]), W)).toEqual({ mon: MON, runs: { planned: 0, done: 0 }, workouts: { planned: 0, done: 0 }, doneMiles: 0, plannedMiles: 0 });
    // rest days and skipped sessions have nothing to count either
    expect(heroWeek(snapOf([...DAYS.map(rest), run(M, 4, { mark: 'skip' }), lift(W, { mark: 'sick' })]), W)).toMatchObject({ runs: { planned: 0, done: 0 }, workouts: { planned: 0, done: 0 }, plannedMiles: 0 });
  });
});

describe('runs: weekSummary’s own numbers', () => {
  it('a run with nothing planned that day is one more done, never one more planned ("5 of 4")', () => {
    const acts = [act(M, 4), act(W, 3.5), act(F, 3), act(SA, 5.2), act(SU, 2)];
    const h = sameAsWeekSheet(snapOf(ownerWeek().filter((s) => s.kind === 'run'), acts, SU), SU);
    expect(h.runs).toEqual({ planned: 4, done: 5 });
    expect([h.doneMiles, h.plannedMiles]).toEqual([17.7, 15.5]);
  });
  it('a week of runs with no sessions at all: a day counts once, however many runs landed', () => {
    const h = sameAsWeekSheet(snapOf([], [act(M, 3.1), act(TH, 2), act(TH, 1.1)], SA), M);
    expect(h.runs).toEqual({ planned: 0, done: 2 });
    expect([h.doneMiles, h.plannedMiles]).toEqual([6.2, 0]);
  });
  it('a run that lands on a planned day completes that run: one, not two', () => {
    const h = sameAsWeekSheet(snapOf([run(W, 4)], [act(W, 2.5), act(W, 1.6)]), W);
    expect(h.runs).toEqual({ planned: 1, done: 1 });
    expect(h.doneMiles).toBe(4.1);
  });
  it('a run on the day of a skipped run is beyond the plan', () => {
    expect(sameAsWeekSheet(snapOf([run(W, 4, { mark: 'skip' })], [act(W, 3)]), W).runs).toEqual({ planned: 0, done: 1 });
  });
  it('a run on another day does not fill the one that was missed, but counts as the week sheet counts it', () => {
    expect(sameAsWeekSheet(snapOf([run(M, 4), run(F, 3)], [act(TU, 4)]), W).runs).toEqual({ planned: 2, done: 1 });
    expect(sameAsWeekSheet(snapOf([run(M, 4)], [act(TU, 4)]), W).runs).toEqual({ planned: 1, done: 1 });
  });
  it('a missed run stays planned and is never done; a past week keeps its count', () => {
    expect(sameAsWeekSheet(snapOf(ownerWeek(), [act(M, 4)], shiftDays(MON, 9)), W)).toMatchObject({ runs: { planned: 4, done: 1 }, workouts: { planned: 2, done: 0 } });
  });
  it('a skipped run and a run skipped for illness leave the week, miles and all', () => {
    const sessions = ownerWeek().map((s) => (s.id === 'r-mon' ? { ...s, mark: 'skip' as const } : s.id === 'r-fri' ? { ...s, mark: 'sick' as const } : s));
    expect(sameAsWeekSheet(snapOf(sessions), W)).toMatchObject({ runs: { planned: 2, done: 0 }, plannedMiles: 8.5 });
  });
  it('a floor counts as done, and its floor minutes as miles', () => {
    // 20 minutes at the default easy pace of 9:00 a mile
    expect(sameAsWeekSheet(snapOf([run(M, 5, { mark: 'floor' }), run(W, 4)]), W)).toMatchObject({ runs: { planned: 2, done: 1 }, doneMiles: 2.22 });
  });
  it('a run cut short still counts as done', () => {
    expect(sameAsWeekSheet(snapOf([run(M, 5)], [act(M, 2)]), W)).toMatchObject({ runs: { planned: 1, done: 1 }, doneMiles: 2, plannedMiles: 5 });
  });
  it('runs set in minutes plan no miles', () => {
    // 30 minutes at 9:00 a mile
    expect(sameAsWeekSheet(snapOf([run(M, null, { minutes: 30, mark: 'done' }), run(W, null, { minutes: 40 })]), W)).toMatchObject({ runs: { planned: 2, done: 1 }, doneMiles: 3.33, plannedMiles: 0 });
  });
  it('prints miles to one decimal, as the week does everywhere', () => {
    expect([9.46, 15.5, 4, 0, 17.96, 3.33].map(tenth)).toEqual(['9.5', '15.5', '4', '0', '18', '3.3']);
  });
});

describe('workouts: lifts and cross sessions, counted the same way (spec 6.2)', () => {
  it('a lift is done by its sets, by a lift that synced, or by hand; a ride by a cross or a lift activity', () => {
    const bySets = heroWeek(snapOf([lift(M)], [], W, { [M]: 9 }), W);
    const bySync = heroWeek(snapOf([lift(M)], [act(M, 0, { kind: 'lift', sportType: 'WeightTraining' })]), W);
    const byHand = heroWeek(snapOf([lift(M, { mark: 'done' })]), W);
    const floor = heroWeek(snapOf([lift(M, { mark: 'floor' })]), W);
    for (const h of [bySets, bySync, byHand, floor]) expect(h.workouts).toEqual({ planned: 1, done: 1 });
    expect(heroWeek(snapOf([cross(M)], [act(M, 0, { kind: 'cross', sportType: 'Ride' })]), W).workouts.done).toBe(1);
    expect(heroWeek(snapOf([cross(M)], [act(M, 0, { kind: 'lift' })]), W).workouts.done).toBe(1);
    // a run does not do a lift
    expect(heroWeek(snapOf([lift(M)], [act(M, 4)]), W).workouts).toEqual({ planned: 1, done: 0 });
  });
  it('a bonus lift: sets logged with no lift or ride planned that day are one more done', () => {
    expect(heroWeek(snapOf([lift(M, { mark: 'done' }), lift(F)], [], F, { [W]: 12 }), F).workouts).toEqual({ planned: 2, done: 2 });
    // a ride that synced with nothing planned is one too
    expect(heroWeek(snapOf([], [act(TU, 0, { kind: 'cross', sportType: 'Ride' })]), W).workouts).toEqual({ planned: 0, done: 1 });
  });
  it('a skipped lift leaves the week; a skipped lift on a day lifted anyway makes that day a bonus', () => {
    expect(heroWeek(snapOf([lift(M, { mark: 'skip' }), lift(W)]), W).workouts).toEqual({ planned: 1, done: 0 });
    expect(heroWeek(snapOf([lift(M, { mark: 'skip' })], [], W, { [M]: 5 }), W).workouts).toEqual({ planned: 0, done: 1 });
  });
  it('sets on a run day count as a workout; a run on a lift day counts as a run', () => {
    const h = heroWeek(snapOf([run(M, 4), lift(TU)], [act(TU, 3)], W, { [M]: 6 }), W);
    expect(h.workouts).toEqual({ planned: 1, done: 1 });
    expect(h.runs).toEqual({ planned: 1, done: 1 });
  });
  it('a workout on a day whose own workout still stands adds nothing: sets do not do a ride', () => {
    expect(heroWeek(snapOf([cross(W)], [], W, { [W]: 6 }), W).workouts).toEqual({ planned: 1, done: 0 });
  });
  it('a lift and a ride on one day are two', () => {
    expect(heroWeek(snapOf([lift(W, { position: 0 }), cross(W, { position: 1 })]), W).workouts).toEqual({ planned: 2, done: 0 });
  });
  it('with lifts only, the count is Progress’s for strength: the lifts that stand, the ones that count, a day lifted off the plan', () => {
    // Mon done by sets, Wed done by hand, Fri still ahead, Sat skipped; Thursday lifted with nothing planned
    expect(heroWeek(snapOf([lift(M), lift(W, { mark: 'done' }), lift(F), lift(SA, { mark: 'skip' })], [], TH, { [M]: 10, [TH]: 5 }), TH).workouts).toEqual({ planned: 3, done: 3 });
  });
});

describe('the week’s edges', () => {
  const snap = snapOf([...ownerWeek(), run(shiftDays(MON, 7), 4), run(shiftDays(MON, -1), 6)], [act(M, 4)]);
  it('Monday and Sunday read the same week; the days either side are other weeks', () => {
    expect(heroWeek(snap, SU)).toEqual(heroWeek(snap, M));
    expect(heroWeek(snap, M)).toMatchObject({ mon: MON, runs: { planned: 4, done: 1 }, workouts: { planned: 2, done: 0 }, doneMiles: 4, plannedMiles: 15.5 });
    expect(heroWeek(snap, shiftDays(MON, 7))).toMatchObject({ mon: '2026-11-16', runs: { planned: 1, done: 0 } });
    expect(heroWeek(snap, shiftDays(MON, -1))).toMatchObject({ mon: '2026-11-02', runs: { planned: 1, done: 0 }, plannedMiles: 6 });
  });
  it('a week that crosses a month, and one that crosses a year, read as one week from any of their days', () => {
    // Monday November 30 to Sunday December 6, 2026, through the app's own snapshot of two month bundles
    const nd = buildSnapshot(
      {
        '2026-11': bundle('2026-11', [run('2026-11-30', 4), run('2026-11-28', 9)], [act('2026-11-30', 4.2)]),
        '2026-12': bundle('2026-12', [run('2026-12-02', 5), lift('2026-12-04'), run('2026-12-06', 8, { type: 'Long' }), run('2026-12-07', 3)]),
      },
      '2026-12-02',
    );
    const h = sameAsWeekSheet(nd, '2026-12-02');
    expect(h).toEqual({ mon: '2026-11-30', runs: { planned: 3, done: 1 }, workouts: { planned: 1, done: 0 }, doneMiles: 4.2, plannedMiles: 17 });
    expect(heroWeek(nd, '2026-11-30')).toEqual(h);
    expect(heroWeek(nd, '2026-12-06')).toEqual(h);
    const y = buildSnapshot({ '2026-12': bundle('2026-12', [run('2026-12-28', 4), run('2026-12-31', 5)], [act('2026-12-28', 4)]), '2027-01': bundle('2027-01', [run('2027-01-02', 10, { type: 'Long' })]) }, '2026-12-31');
    expect(sameAsWeekSheet(y, '2027-01-01')).toMatchObject({ mon: '2026-12-28', runs: { planned: 3, done: 1 }, doneMiles: 4, plannedMiles: 19 });
  });
});

// ---------- the day: the face's lead, day or dusk, the views ----------

describe('day or dusk: from the face the card shows (spec 6.7)', () => {
  it('a run day, a lift day and a ride day are day scenes that open on their own count', () => {
    const log = logOf(ownerWeek());
    expect(pageScene(log, W)).toMatchObject({ face: { lead: { session: { id: 'r-wed' } } }, scene: { mode: 'day', view: 'runs', views: ['runs', 'workouts'] } });
    expect(pageScene(log, TU).scene).toMatchObject({ mode: 'day', view: 'workouts' });
    expect(pageScene(log, TH).scene).toMatchObject({ mode: 'day', view: 'workouts' });
  });
  it('a rest day and a day with nothing on it are dusk: no view, no marks, no sun to place', () => {
    const log = logOf([...ownerWeek(), rest(SU)]);
    for (const d of [SU]) {
      const { face, scene } = pageScene(log, d);
      expect(face.kind).toBe('rest');
      expect(faceLead(face)).toEqual({ lead: null, hasRuns: false });
      expect(scene).toMatchObject({ mode: 'dusk', views: [], marks: [], f: 0, target: false, complete: false, label: '', count: '', second: null, said: '' });
      expect(scene.totals).toEqual(['0 of 4 runs', '0 of 15.5 mi', '0 of 2 workouts']);
    }
    // Sunday with nothing at all on it
    expect(pageScene(logOf(ownerWeek()), SU).scene.mode).toBe('dusk');
  });
  it('a skipped session and a missed one are day scenes: the card still names them', () => {
    const skipped = pageScene(logOf(ownerWeek().map((s) => (s.id === 'r-wed' ? { ...s, mark: 'skip' as const } : s))), W);
    expect(skipped.face.kind).toBe('skipped');
    // the skipped run left the week: three runs stand
    expect(skipped.scene).toMatchObject({ mode: 'day', view: 'runs', count: '0 of 3' });
    const missed = pageScene(logOf(ownerWeek()), M);
    expect(missed.face.kind).toBe('missed');
    expect(missed.scene).toMatchObject({ mode: 'day', view: 'runs' });
  });
  it('a run off the plan is a day scene on Runs, with no target: the sun up, the count alone', () => {
    const { face, scene } = pageScene(logOf([], [act(W, 3.1)]), W);
    expect(face.kind).toBe('landed');
    expect(faceLead(face)).toEqual({ lead: null, hasRuns: true });
    expect(scene).toMatchObject({ mode: 'day', view: 'runs', views: ['runs'], f: 1, target: false, complete: false, count: '1', second: '3.1 mi' });
  });
  it('a day lifted off the plan shows the app’s rest face, so it is dusk; the week still counts the lift', () => {
    const log = { ...logOf([run(M, 4)]), snap: { ...logOf([run(M, 4)]).snap, liftSetCountOn: (d: string) => (d === W ? 6 : 0) } } as Log;
    const { face, scene } = pageScene(log, W);
    expect(face.kind).toBe('rest');
    expect(scene.mode).toBe('dusk');
    expect(scene.totals).toEqual(['0 of 1 run', '0 of 4 mi', '1 workout']);
  });
});

describe('the views and the one that opens (spec 6.3)', () => {
  const both = wk([4, 2], [2, 1], 9.5, 15.5);
  it('a run opens on Runs, a lift or a ride on Workouts; both views offered when both have something', () => {
    expect(day(both, 'run')).toMatchObject({ view: 'runs', views: ['runs', 'workouts'] });
    expect(day(both, 'lift')).toMatchObject({ view: 'workouts', views: ['runs', 'workouts'] });
    expect(day(both, 'cross')).toMatchObject({ view: 'workouts', views: ['runs', 'workouts'] });
    expect(day(both, null, { hasRuns: true })).toMatchObject({ view: 'runs' });
  });
  it('a week with nothing to switch to has one view: no pill', () => {
    expect(day(wk([3, 1], [0, 0], 4, 14), 'run').views).toEqual(['runs']);
    expect(day(wk([0, 0], [2, 0], 0, 0), 'lift').views).toEqual(['workouts']);
  });
  it('the day’s own view always exists, even with nothing in it (its only session skipped)', () => {
    expect(day(wk([1, 0], [0, 0], 0, 4), 'lift')).toMatchObject({ view: 'workouts', views: ['runs', 'workouts'], count: '0', f: 0, target: false, marks: [] });
    expect(day(wk([0, 0], [0, 0], 0, 0), 'run')).toMatchObject({ view: 'runs', views: ['runs'], count: '0', f: 0, second: null });
  });
  it('a pick holds while its view exists; a pick for a view that does not exist, or at dusk, is ignored', () => {
    expect(day(both, 'run', { picked: 'workouts' })).toMatchObject({ view: 'workouts', label: 'Workouts this week', count: '1 of 2' });
    expect(day(both, 'lift', { picked: 'runs' })).toMatchObject({ view: 'runs', count: '2 of 4' });
    expect(day(wk([3, 1], [0, 0], 4, 14), 'run', { picked: 'workouts' }).view).toBe('runs');
    expect(day(both, null, { picked: 'workouts' })).toMatchObject({ mode: 'dusk', view: 'runs', views: [] });
  });
  it('a day with a run and a lift opens on Runs: the card’s name is the run', () => {
    const log = logOf([run(W, 4, { position: 1 }), lift(W, { position: 0 })]);
    expect(pageScene(log, W).scene.view).toBe('runs');
  });
  it('a run skipped beside a lift keeps the card (Skipped.), so it opens on Runs', () => {
    const { face, scene } = pageScene(logOf([run(W, 4, { position: 0, mark: 'skip' }), lift(W, { position: 1 })]), W);
    expect(face).toMatchObject({ kind: 'skipped', lead: { session: { kind: 'run' } } });
    expect(scene).toMatchObject({ mode: 'day', view: 'runs', views: ['runs', 'workouts'] });
  });
});

// ---------- the picture ----------

describe('the sun (spec 6.4)', () => {
  const at = (runs: [number, number]) => day(wk(runs, [0, 0], 0, 0), 'run');
  it('climbs by done over planned, and rings when the count is met', () => {
    expect(at([4, 0])).toMatchObject({ f: 0, target: true, complete: false });
    expect(at([4, 2])).toMatchObject({ f: 0.5, target: true, complete: false });
    expect(at([4, 4])).toMatchObject({ f: 1, target: true, complete: true });
    // more than planned: the sun stays in its place, ringed
    expect(at([4, 5])).toMatchObject({ f: 1, target: true, complete: true });
    expect(at([7, 2]).f).toBeCloseTo(2 / 7);
  });
  it('with no target it is up once anything is done, and at rest when nothing is', () => {
    expect(at([0, 2])).toMatchObject({ f: 1, target: false, complete: false });
    expect(at([0, 0])).toMatchObject({ f: 0, target: false, complete: false });
  });
  it('stands where the spec’s table puts it', () => {
    const r = (p: [number, number]) => p.map((v) => Math.round(v * 10) / 10);
    expect([0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1].map((f) => r(sunAt(f)))).toEqual([[38, 63], [108.5, 45.1], [132, 40.2], [179, 32.3], [226, 26.6], [249.5, 24.6], [320, 22]]);
  });
});

describe('the marks (spec 6.5)', () => {
  const runs = (planned: number, done = 0) => wk([planned, done], [0, 0], 0, 0);
  it('one per session of the view, evenly spread, at the spec’s places', () => {
    expect(xs(runs(1))).toEqual([179]);
    expect(xs(runs(2))).toEqual([108.5, 249.5]);
    expect(xs(runs(3))).toEqual([85, 179, 273]);
    expect(xs(runs(4))).toEqual([73.3, 143.8, 214.3, 284.8]);
    expect(xs(runs(5))).toEqual([70, 122.6, 179, 235.4, 291.8]);
    expect(xs(runs(6))).toEqual([70, 108.5, 155.5, 202.5, 249.5, 296.5]);
    expect(xs(runs(7))).toEqual([70, 98.4, 138.7, 179, 219.3, 259.6, 299.9]);
  });
  it('the first is never left of 70, and each next is at least 14 past the one before', () => {
    for (let k = 1; k <= MAX_MARKS; k++) {
      const x = xs(runs(k));
      expect(x[0]).toBeGreaterThanOrEqual(70);
      x.slice(1).forEach((v, i) => expect(v - x[i]!).toBeGreaterThanOrEqual(14 - 1e-9));
      expect(x[x.length - 1]).toBeLessThanOrEqual(320);
    }
    // ten: the second is pushed to 84
    expect(xs(runs(10)).slice(0, 3)).toEqual([70, 84, 108.5]);
  });
  it('are filled by count, left to right; past the plan there is a mark for each run done', () => {
    expect(day(runs(4, 2), 'run').marks.map((m) => m.lit)).toEqual([true, true, false, false]);
    expect(day(runs(4, 5), 'run').marks.map((m) => m.lit)).toEqual([true, true, true, true, true]);
    // no target: a mark per run, all lit
    expect(day(runs(0, 2), 'run').marks.map((m) => [Math.round(markX(m.share) * 10) / 10, m.lit])).toEqual([[108.5, true], [249.5, true]]);
  });
  it('sit on the horizon', () => {
    // the near crest's heights the spec lists (the error of its linear table is under 0.15)
    const table: [number, number][] = [[0, 69], [40, 62.9], [100, 58.3], [140, 59.1], [200, 64.5], [260, 69.6], [300, 70], [358, 64]];
    for (const [x, y] of table) expect(Math.abs(crestY(x) - y)).toBeLessThan(0.15);
  });
  it('a lit mark the sun stands over is in the sun (six runs or more, one done); an open mark never is', () => {
    expect(day(runs(6, 1), 'run').marks.map((m) => m.inSun)).toEqual([true, false, false, false, false, false]);
    expect(day(runs(7, 1), 'run').marks[0]).toMatchObject({ lit: true, inSun: true });
    expect(day(runs(4, 1), 'run').marks.some((m) => m.inSun)).toBe(false);
    expect(day(runs(5, 1), 'run').marks.some((m) => m.inSun)).toBe(false);
    expect(day(runs(6, 0), 'run').marks.some((m) => m.inSun)).toBe(false);
  });
  it('past ten there are none: the band carries the count', () => {
    expect(day(runs(10), 'run').marks).toHaveLength(10);
    expect(day(runs(11), 'run').marks).toEqual([]);
    expect(day(runs(4, 11), 'run').marks).toEqual([]);
  });
  it('follow the view shown', () => {
    const both = wk([4, 2], [2, 1], 9.5, 15.5);
    expect(day(both, 'run', { picked: 'workouts' }).marks.map((m) => m.lit)).toEqual([true, false]);
    expect(day(both, 'run', { picked: 'workouts' }).f).toBe(0.5);
  });
});

// ---------- the words ----------

describe('the band’s words and what VoiceOver hears (spec 6.6, 11.1)', () => {
  const words = (s: ReturnType<typeof heroScene>) => [s.label, s.count, s.second, s.said];
  it('state 1, a run day with nothing done', () => {
    expect(words(day(wk([4, 0], [2, 0], 0, 15.5), 'run'))).toEqual(['Runs this week', '0 of 4', '0 of 15.5 mi', 'Runs this week, 0 of 4. 0 of 15.5 miles. Open the week']);
  });
  it('states 2 and 3, mid-week, on Runs and then on Workouts: the miles stay, and say they were run', () => {
    const w = wk([4, 2], [2, 1], 9.5, 15.5);
    expect(words(day(w, 'run'))).toEqual(['Runs this week', '2 of 4', '9.5 of 15.5 mi', 'Runs this week, 2 of 4. 9.5 of 15.5 miles. Open the week']);
    expect(words(day(w, 'run', { picked: 'workouts' }))).toEqual(['Workouts this week', '1 of 2', '9.5 of 15.5 mi', 'Workouts this week, 1 of 2. 9.5 of 15.5 miles run. Open the week']);
  });
  it('state 4, a lift day', () => {
    expect(day(wk([4, 1], [2, 0], 6, 15.5), 'lift').said).toBe('Workouts this week, 0 of 2. 6 of 15.5 miles run. Open the week');
  });
  it('states 6 and 12: the count met, and more than planned', () => {
    expect(day(wk([4, 4], [2, 2], 15.5, 15.5), 'run').said).toBe('Runs this week, 4 of 4, all done. 15.5 of 15.5 miles. Open the week');
    expect(words(day(wk([4, 5], [2, 2], 17.5, 15.5), 'run'))).toEqual(['Runs this week', '5 of 4', '17.5 of 15.5 mi', 'Runs this week, 5 of 4, all done. 17.5 of 15.5 miles. Open the week']);
  });
  it('state 9, day by day with no mile target, and a week with no target at all', () => {
    expect(words(day(wk([3, 2], [0, 0], 6.2, 0), 'run'))).toEqual(['Runs this week', '2 of 3', '6.2 mi', 'Runs this week, 2 of 3. 6.2 miles. Open the week']);
    expect(day(wk([0, 2], [0, 0], 6.2, 0), null, { hasRuns: true }).said).toBe('Runs this week, 2. 6.2 miles. Open the week');
    expect(day(wk([0, 1], [0, 0], 1, 0), null, { hasRuns: true }).said).toBe('Runs this week, 1. 1 mile. Open the week');
  });
  it('a week of lifts only has no second number', () => {
    expect(words(day(wk([0, 0], [2, 1], 0, 0), 'lift'))).toEqual(['Workouts this week', '1 of 2', null, 'Workouts this week, 1 of 2. Open the week']);
  });
  it('miles print to one decimal', () => {
    expect(day(wk([4, 2], [0, 0], 9.46, 15.5), 'run').second).toBe('9.5 of 15.5 mi');
  });
});

describe('dusk’s totals (spec 6.8)', () => {
  const dusk = (w: HeroWeek) => day(w, null);
  it('runs, miles and workouts, in that order', () => {
    expect(dusk(wk([4, 2], [2, 1], 7.5, 15.5))).toMatchObject({
      mode: 'dusk',
      totals: ['2 of 4 runs', '7.5 of 15.5 mi', '1 of 2 workouts'],
      totalsSaid: 'This week: 2 of 4 runs, 7.5 of 15.5 miles, 1 of 2 workouts. Open the week',
    });
  });
  it('each only when it has something', () => {
    expect(dusk(wk([3, 1], [0, 0], 4, 14)).totals).toEqual(['1 of 3 runs', '4 of 14 mi']);
    expect(dusk(wk([0, 0], [2, 1], 0, 0)).totals).toEqual(['1 of 2 workouts']);
    // runs set in minutes with none done: no miles to say
    expect(dusk(wk([3, 0], [0, 0], 0, 0)).totals).toEqual(['0 of 3 runs']);
  });
  it('the noun is singular for a plan of one, or with no target for one done', () => {
    expect(dusk(wk([1, 0], [1, 1], 0, 8)).totals).toEqual(['0 of 1 run', '0 of 8 mi', '1 of 1 workout']);
    expect(dusk(wk([0, 1], [0, 1], 3, 0))).toMatchObject({ totals: ['1 run', '3 mi', '1 workout'], totalsSaid: 'This week: 1 run, 3 miles, 1 workout. Open the week' });
    expect(dusk(wk([0, 2], [0, 3], 1, 0))).toMatchObject({ totals: ['2 runs', '1 mi', '3 workouts'], totalsSaid: 'This week: 2 runs, 1 mile, 3 workouts. Open the week' });
  });
  it('a week with nothing gives no totals: the band is the bare hill', () => {
    expect(dusk(wk([0, 0], [0, 0], 0, 0))).toMatchObject({ totals: [], totalsSaid: '' });
  });
});

// ---------- one count everywhere ----------

describe('generated weeks', () => {
  /** A small seeded generator: the same weeks on every run. */
  const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
  const KINDS = ['run', 'run', 'run', 'lift', 'cross', 'rest'] as const;
  const MARKS = [null, null, null, null, 'done', 'floor', 'skip', 'sick'] as const;
  const week = (seed: number) => {
    const r = rng(seed);
    const today = shiftDays(MON, Math.floor(r() * 11) - 2);
    const sessions: Session[] = [];
    const acts: Activity[] = [];
    const sets: Record<ISODate, number> = {};
    for (let i = -1; i <= 7; i++) {
      const d = shiftDays(MON, i);
      const count = pick(r, [0, 0, 1, 1, 1, 2, 3]);
      for (let k = 0; k < count; k++) {
        const kind = pick(r, KINDS);
        sessions.push(sess(d, kind, { position: k, miles: kind === 'run' && r() < 0.8 ? Math.round((2 + r() * 8) * 2) / 2 : null, minutes: r() < 0.3 ? 30 : null, mark: kind === 'rest' ? null : pick(r, MARKS) }));
      }
      if (d <= today) {
        if (r() < 0.3) acts.push(act(d, Math.round((1 + r() * 9) * 10) / 10));
        if (r() < 0.1) acts.push(act(d, Math.round((1 + r() * 3) * 10) / 10));
        if (r() < 0.12) acts.push(act(d, 0, { kind: 'lift' }));
        if (r() < 0.12) acts.push(act(d, 0, { kind: 'cross' }));
        if (r() < 0.15) sets[d] = 1 + Math.floor(r() * 12);
      }
    }
    return { snap: snapOf(sessions, acts, today, sets), sessions, acts, sets };
  };
  /** Workouts counted again, from the raw lists, by the words of spec 6.2. */
  const workoutsByHand = (sessions: Session[], acts: Activity[], sets: Record<ISODate, number>): HeroCount => {
    let planned = 0;
    let done = 0;
    for (const d of DAYS) {
      const live = sessions.filter((s) => s.date === d && (s.kind === 'lift' || s.kind === 'cross') && s.mark !== 'skip' && s.mark !== 'sick');
      const dayActs = acts.filter((a) => a.date === d);
      planned += live.length;
      for (const s of live) {
        const matched = s.kind === 'lift' ? (sets[d] ?? 0) > 0 || dayActs.some((a) => a.kind === 'lift') : dayActs.some((a) => a.kind === 'cross' || a.kind === 'lift');
        if (matched || s.mark === 'done' || s.mark === 'floor') done++;
      }
      if (!live.length && ((sets[d] ?? 0) > 0 || dayActs.some((a) => a.kind === 'lift' || a.kind === 'cross'))) done++;
    }
    return { planned, done };
  };

  it('hold for 400 weeks, from any of their days and for every input', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { snap, sessions, acts, sets } = week(seed);
      const where = `seed ${seed}`;
      // the runs and miles are the week sheet's; the workouts are spec 6.2's; any day of the week reads the same week
      const h = heroWeek(snap, M);
      const s = weekSummary(snap, M);
      expect([h.mon, h.runs.planned, h.runs.done, h.doneMiles, h.plannedMiles], where).toEqual([MON, s.runsPlanned, s.runsDone, s.doneMiles, s.plannedMiles]);
      expect(h.workouts, where).toEqual(workoutsByHand(sessions, acts, sets));
      expect(heroWeek(snap, pick(rng(seed), DAYS)), where).toEqual(h);
      for (const lead of [null, 'run', 'lift', 'cross'] as HeroLead[]) {
        for (const hasRuns of [false, true]) {
          for (const picked of [null, ...HERO_VIEWS]) {
            const sc = heroScene({ week: h, lead, hasRuns, picked });
            const at = `${where}, ${lead} ${hasRuns} ${picked}`;
            const bad: string[] = [];
            if (sc.mode !== (lead === null && !hasRuns ? 'dusk' : 'day')) bad.push('mode');
            if (sc.mode === 'dusk') {
              if (sc.views.length || sc.marks.length || sc.f || sc.target || sc.complete || sc.label || sc.count || sc.second || sc.said) bad.push('dusk draws nothing');
            } else {
              if (!sc.views.includes(sc.view)) bad.push('view in views');
              if (picked && sc.views.includes(picked) && sc.view !== picked) bad.push('pick holds');
              const c = sc.view === 'runs' ? h.runs : h.workouts;
              if (sc.f !== (c.planned > 0 ? Math.min(1, c.done / c.planned) : c.done > 0 ? 1 : 0)) bad.push('f');
              if (sc.target !== c.planned > 0 || sc.complete !== (c.planned > 0 && c.done >= c.planned)) bad.push('target, complete');
              const k = Math.max(c.planned, c.done);
              if (sc.marks.length !== (k > MAX_MARKS ? 0 : k)) bad.push('how many marks');
              sc.marks.forEach((m, i) => {
                if (m.lit !== i < c.done || (m.inSun && !m.lit)) bad.push(`mark ${i} lit`);
                if (i && markX(m.share) - markX(sc.marks[i - 1]!.share) < 14 - 1e-9) bad.push(`mark ${i} gap`);
              });
              if (sc.marks.length && markX(sc.marks[0]!.share) < 70 - 1e-9) bad.push('first mark');
              if (sc.count !== (c.planned > 0 ? `${c.done} of ${c.planned}` : `${c.done}`)) bad.push('count');
            }
            if ((sc.mode === 'day' && !sc.said.endsWith('. Open the week')) || (sc.totals.length === 0) !== (sc.totalsSaid === '')) bad.push('words');
            expect(bad, at).toEqual([]);
          }
        }
      }
    }
  }, 30_000);
});
