import { MORNING_DEFAULTS, dayStatus, shiftDays, weekSummary, type Activity, type ISODate, type Session, type Snapshot } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { faceOf, phaseOf } from './faces';
import { heroWeek, nextSession, tenth, type HeroCount, type HeroMark } from './heroWeek';

// ---------- a week to count: Monday November 9 to Sunday November 15, 2026; today is Wednesday unless a test says so ----------
const MON = '2026-11-09';
const [M, TU, W, TH, F, SA, SU] = [0, 1, 2, 3, 4, 5, 6].map((i) => shiftDays(MON, i)) as [ISODate, ISODate, ISODate, ISODate, ISODate, ISODate, ISODate];

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

/** A mark without its session, for comparing lists. */
const bare = (m: HeroMark) => ({ id: m.id, date: m.date, weekday: m.weekday, kind: m.kind, state: m.state, today: m.today, shown: m.shown, extra: m.extra });
const states = (c: HeroCount) => c.marks.map((m) => `${m.weekday}:${m.state}${m.extra ? '+' : ''}`).join(' ');

describe('the owner’s kind of week: no plan block, sessions day by day', () => {
  const h = heroWeek(snapOf(ownerWeek()), W);

  it('counts the runs on the week, and the numbers are the week sheet’s', () => {
    expect(h.runs).toMatchObject({ done: 0, planned: 4, share: 0, complete: false });
    expect(h.miles).toEqual({ done: 0, planned: 15.5, share: 0 });
    // the gauge this replaces printed "0 of 15.5 mi" and "0 of 4 runs" from the same weekSummary
    const sum = weekSummary(snapOf(ownerWeek()), MON);
    expect([h.runs.done, h.runs.planned, h.miles.done, h.miles.planned]).toEqual([sum.runsDone, sum.runsPlanned, sum.doneMiles, sum.plannedMiles]);
    expect(`${tenth(h.miles.done)} of ${tenth(h.miles.planned!)} mi · ${h.runs.done} of ${h.runs.planned} runs`).toBe('0 of 15.5 mi · 0 of 4 runs');
  });
  it('gives one mark a run, at its weekday: Monday missed, today open, Friday and Saturday ahead', () => {
    expect(h.runs.marks.map(bare)).toEqual([
      { id: 'r-mon', date: M, weekday: 0, kind: 'run', state: 'missed', today: false, shown: false, extra: false },
      { id: 'r-wed', date: W, weekday: 2, kind: 'run', state: 'planned', today: true, shown: true, extra: false },
      { id: 'r-fri', date: F, weekday: 4, kind: 'run', state: 'planned', today: false, shown: false, extra: false },
      { id: 'r-sat', date: SA, weekday: 5, kind: 'run', state: 'planned', today: false, shown: false, extra: false },
    ]);
    expect(h.runs.marks[1]!.session?.id).toBe('r-wed');
  });
  it('counts the lift and the ride as workouts', () => {
    expect(h.workouts).toMatchObject({ done: 0, planned: 2, share: 0, complete: false });
    expect(h.workouts.marks.map(bare)).toEqual([
      { id: 'l-tue', date: TU, weekday: 1, kind: 'lift', state: 'missed', today: false, shown: false, extra: false },
      { id: 'c-thu', date: TH, weekday: 3, kind: 'cross', state: 'planned', today: false, shown: false, extra: false },
    ]);
  });
  it('is a day scene on a run day, opens on runs, and names what comes next', () => {
    expect(h).toMatchObject({ date: W, mon: MON, weekday: 2, todayWeekday: 2, scene: 'day', emptyWeek: false, defaultView: 'runs', complete: false });
    expect(h.next).toMatchObject({ date: TH, name: 'Bike' });
  });
});

describe('a planned week', () => {
  it('counts exactly as the same sessions with no plan block: the block changes nothing', () => {
    const a = heroWeek(snapOf(ownerWeek()), W);
    const b = heroWeek(snapOf(ownerWeek('block-1')), W);
    const flat = (h: typeof a) => ({ ...h, runs: { ...h.runs, marks: h.runs.marks.map(bare) }, workouts: { ...h.workouts, marks: h.workouts.marks.map(bare) }, next: h.next && { date: h.next.date, name: h.next.name } });
    expect(flat(b)).toEqual(flat(a));
  });
  it('mid-week: a run that synced, a run marked done by hand, a lift with its sets in', () => {
    const sessions = ownerWeek('block-1').map((s) => (s.id === 'r-wed' ? { ...s, mark: 'done' as const } : s));
    const snap = snapOf(sessions, [act(M, 4.1)], TH, { [TU]: 12 });
    const h = heroWeek(snap, TH);
    expect(states(h.runs)).toBe('0:done 2:done 4:planned 5:planned');
    expect(h.runs).toMatchObject({ done: 2, planned: 4, share: 0.5, complete: false });
    // 4.1 tracked, and the run marked done counts its planned 3.5
    expect(h.miles.done).toBe(7.6);
    expect(h.miles.planned).toBe(15.5);
    expect(h.miles.share).toBeCloseTo(7.6 / 15.5);
    expect(states(h.workouts)).toBe('1:done 3:planned');
    expect(h.workouts).toMatchObject({ done: 1, planned: 2, share: 0.5 });
    const sum = weekSummary(snap, MON);
    expect([h.runs.done, h.runs.planned, h.miles.done]).toEqual([sum.runsDone, sum.runsPlanned, sum.doneMiles]);
    // Thursday is the ride's day
    expect(h).toMatchObject({ scene: 'day', defaultView: 'workouts', todayWeekday: 3 });
    expect(h.next).toMatchObject({ date: F, name: 'Easy 3' });
  });
});

describe('a week with nothing', () => {
  it('is empty: no marks, no targets, dusk, nothing next', () => {
    const h = heroWeek(snapOf([]), W);
    expect(h.emptyWeek).toBe(true);
    expect(h.scene).toBe('dusk');
    expect(h.runs).toEqual({ done: 0, planned: 0, share: 0, complete: false, marks: [] });
    expect(h.workouts).toEqual({ done: 0, planned: 0, share: 0, complete: false, marks: [] });
    expect(h.miles).toEqual({ done: 0, planned: null, share: 0 });
    expect(h).toMatchObject({ defaultView: 'runs', complete: false, next: null });
  });
  it('still names next week’s first session when it is within seven days', () => {
    const h = heroWeek(snapOf([run(shiftDays(MON, 7), 4, { type: 'Easy' })]), W);
    expect(h.emptyWeek).toBe(true);
    expect(h.next).toMatchObject({ date: '2026-11-16', name: 'Easy 4' });
  });
  it('a week of rest days, or of skipped sessions, has nothing to count but is not empty', () => {
    const rests = heroWeek(snapOf([M, TU, W, TH, F, SA, SU].map(rest)), W);
    expect(rests).toMatchObject({ emptyWeek: false, scene: 'dusk', complete: false });
    expect(rests.runs.marks.length + rests.workouts.marks.length).toBe(0);
    const skipped = heroWeek(snapOf([run(M, 4, { mark: 'skip' }), run(W, 4, { mark: 'sick' })]), W);
    expect(skipped).toMatchObject({ emptyWeek: false, scene: 'dusk' });
    expect(skipped.runs).toMatchObject({ done: 0, planned: 0, marks: [] });
    expect(skipped.miles.planned).toBeNull();
  });
  it('a run with nothing planned makes the week no longer empty', () => {
    expect(heroWeek(snapOf([], [act(M, 3)]), W).emptyWeek).toBe(false);
    expect(heroWeek(snapOf([], [], W, { [TU]: 6 }), W).emptyWeek).toBe(false);
  });
});

describe('the scene: dusk on a day with no run and no workout', () => {
  const week = ownerWeek();
  it('a day with nothing on it is dusk, and the week is still counted', () => {
    const h = heroWeek(snapOf(week), SU);
    expect(h).toMatchObject({ scene: 'dusk', weekday: 6, defaultView: 'runs', emptyWeek: false });
    expect(h.runs.planned).toBe(4);
    expect(h.runs.marks.some((m) => m.shown)).toBe(false);
  });
  it('a rest day is dusk', () => {
    const h = heroWeek(snapOf([...week, rest(SU)]), SU);
    expect(h.scene).toBe('dusk');
  });
  it('a day whose only session was skipped is dusk, and the skipped run leaves the week', () => {
    const h = heroWeek(snapOf(week.map((s) => (s.id === 'r-wed' ? { ...s, mark: 'skip' as const } : s))), W);
    expect(h.scene).toBe('dusk');
    expect(h.runs.planned).toBe(3);
    expect(h.runs.marks.map((m) => m.id)).toEqual(['r-mon', 'r-fri', 'r-sat']);
    // its 3.5 miles leave the plan too
    expect(h.miles.planned).toBe(12);
  });
  it('a run day, a lift day and a ride day are day scenes', () => {
    for (const d of [M, TU, W, TH, F, SA]) expect(heroWeek(snapOf(week), d).scene).toBe('day');
  });
  it('a day with nothing planned and a run on it is a day scene (a bonus day, never a rest day)', () => {
    expect(heroWeek(snapOf(week, [act(SU, 3)], SU), SU).scene).toBe('day');
    expect(heroWeek(snapOf(week, [], SU, { [SU]: 9 }), SU).scene).toBe('day');
    expect(heroWeek(snapOf([...week, rest(SU)], [act(SU, 3)], SU), SU).scene).toBe('day');
  });
  it('is dusk exactly when the day’s own word is rest, empty or skipped', () => {
    const snap = snapOf([...week, rest(SU)].map((s) => (s.id === 'r-fri' ? { ...s, mark: 'sick' as const } : s)));
    for (const d of [M, TU, W, TH, F, SA, SU]) expect(heroWeek(snap, d).scene === 'dusk').toBe(['rest', 'empty', 'skipped'].includes(dayStatus(snap, d)));
  });
});

describe('the view the card opens on', () => {
  it('runs on a run day, workouts on a lift day and on a ride day', () => {
    const snap = snapOf(ownerWeek());
    expect(heroWeek(snap, W).defaultView).toBe('runs');
    expect(heroWeek(snap, TU).defaultView).toBe('workouts');
    expect(heroWeek(snap, TH).defaultView).toBe('workouts');
  });
  it('a day with a run and a lift opens on runs: the card leads with the run', () => {
    const h = heroWeek(snapOf([run(W, 4, { position: 0 }), lift(W, { position: 1 })]), W);
    expect(h.defaultView).toBe('runs');
    expect(h.runs.marks.filter((m) => m.shown)).toHaveLength(1);
    expect(h.workouts.marks.filter((m) => m.shown)).toHaveLength(1);
    // the same when the lift comes first in the day's order, and when the run is already done
    expect(heroWeek(snapOf([lift(W, { position: 0 }), run(W, 4, { position: 1 })]), W).defaultView).toBe('runs');
    expect(heroWeek(snapOf([run(W, 4, { mark: 'done' }), lift(W, { position: 1 })]), W).defaultView).toBe('runs');
  });
  it('a run skipped beside a lift opens on workouts: the lift is what stands', () => {
    expect(heroWeek(snapOf([run(W, 4, { mark: 'skip' }), lift(W, { position: 1 })]), W).defaultView).toBe('workouts');
  });
  it('a lift day opens on workouts even when a run landed that day: the card is the lift’s', () => {
    expect(heroWeek(snapOf([lift(W)], [act(W, 3)]), W).defaultView).toBe('workouts');
  });
  it('with nothing planned: runs when a run landed, workouts when only a workout did, runs otherwise', () => {
    expect(heroWeek(snapOf([], [act(W, 3)]), W).defaultView).toBe('runs');
    expect(heroWeek(snapOf([], [], W, { [W]: 8 }), W).defaultView).toBe('workouts');
    expect(heroWeek(snapOf([], [act(W, 0, { kind: 'cross', sportType: 'Ride' })]), W).defaultView).toBe('workouts');
    expect(heroWeek(snapOf([], [act(W, 3)], W, { [W]: 8 }), W).defaultView).toBe('runs');
    expect(heroWeek(snapOf([rest(W)]), W).defaultView).toBe('runs');
  });
});

describe('runs beyond the plan', () => {
  it('a run with nothing planned that day is one more run done, never one more planned ("5 of 4")', () => {
    const acts = [act(M, 4), act(W, 3.5), act(F, 3), act(SA, 5.2), act(SU, 2)];
    const snap = snapOf(ownerWeek().filter((s) => s.kind === 'run'), acts, SU);
    const h = heroWeek(snap, SU);
    expect(h.runs).toMatchObject({ done: 5, planned: 4, share: 1, complete: true });
    expect(states(h.runs)).toBe('0:done 2:done 4:done 5:done 6:done+');
    expect(h.runs.marks[4]).toMatchObject({ id: `extra-runs-${SU}`, extra: true, session: null, kind: 'run', shown: true, today: true });
    // over the plan in miles too: the share stops at 1
    expect(h.miles).toEqual({ done: 17.7, planned: 15.5, share: 1 });
    expect(h.complete).toBe(true);
    const sum = weekSummary(snap, MON);
    expect([h.runs.done, h.runs.planned]).toEqual([sum.runsDone, sum.runsPlanned]);
  });
  it('a week of runs with no sessions at all: every run is done, nothing is planned, nothing to complete', () => {
    const h = heroWeek(snapOf([], [act(M, 3.1), act(TH, 2), act(TH, 1.1)], SA), M);
    // two runs on Thursday are one mark: a day counts once
    expect(states(h.runs)).toBe('0:done+ 3:done+');
    expect(h.runs).toMatchObject({ done: 2, planned: 0, share: 1, complete: false });
    expect(h.miles).toEqual({ done: 6.2, planned: null, share: 1 });
    expect(h).toMatchObject({ complete: false, emptyWeek: false, scene: 'day' });
    expect(heroWeek(snapOf([], [act(M, 3.1), act(TH, 2)], SA), TU).scene).toBe('dusk');
  });
  it('a run that lands on a planned day completes that run: one mark, not two', () => {
    const h = heroWeek(snapOf([run(W, 4)], [act(W, 2.5), act(W, 1.6)]), W);
    expect(states(h.runs)).toBe('2:done');
    expect(h.runs).toMatchObject({ done: 1, planned: 1 });
    expect(h.miles.done).toBe(4.1);
  });
  it('a run on the day of a skipped run is beyond the plan', () => {
    const h = heroWeek(snapOf([run(W, 4, { mark: 'skip' })], [act(W, 3)]), W);
    expect(states(h.runs)).toBe('2:done+');
    expect(h.runs).toMatchObject({ done: 1, planned: 0 });
    expect(h.scene).toBe('day');
  });
  it('a run on another day does not fill the one that was missed, but the count is the week’s own', () => {
    const snap = snapOf([run(M, 4), run(F, 3)], [act(TU, 4)], W);
    const h = heroWeek(snap, W);
    expect(states(h.runs)).toBe('0:missed 1:done+ 4:planned');
    expect(h.runs).toMatchObject({ done: 1, planned: 2, share: 0.5, complete: false });
    // one planned run, missed, and one run on another day: the week sheet says "1 of 1", and so does this
    const one = snapOf([run(M, 4)], [act(TU, 4)], W);
    const g = heroWeek(one, W);
    expect(states(g.runs)).toBe('0:missed 1:done+');
    expect(g.runs).toMatchObject({ done: 1, planned: 1, share: 1, complete: true });
    expect(weekSummary(one, MON)).toMatchObject({ runsDone: 1, runsPlanned: 1 });
  });
});

describe('weeks of every size', () => {
  it('a week of seven runs has a mark on every weekday', () => {
    const days = [M, TU, W, TH, F, SA, SU];
    const h = heroWeek(snapOf(days.map((d) => run(d, 3)), [act(M, 3), act(TU, 3.2)]), W);
    expect(h.runs.marks.map((m) => m.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(states(h.runs)).toBe('0:done 1:done 2:planned 3:planned 4:planned 5:planned 6:planned');
    expect(h.runs).toMatchObject({ done: 2, planned: 7 });
    expect(h.runs.share).toBeCloseTo(2 / 7);
    expect(h.miles).toMatchObject({ done: 6.2, planned: 21 });
    expect(h.workouts.marks).toEqual([]);
  });
  it('a week with one run', () => {
    const h = heroWeek(snapOf([run(SA, 6, { type: 'Long' })]), W);
    expect(states(h.runs)).toBe('5:planned');
    expect(h.runs).toMatchObject({ done: 0, planned: 1, share: 0 });
    expect(h).toMatchObject({ scene: 'dusk', emptyWeek: false });
    expect(h.next).toMatchObject({ date: SA, name: 'Long 6' });
    const done = heroWeek(snapOf([run(SA, 6, { type: 'Long', mark: 'done' })], [], SA), SA);
    expect(done.runs).toMatchObject({ done: 1, planned: 1, share: 1, complete: true });
    expect(done.complete).toBe(true);
  });
  it('two runs on one day are two marks on that weekday, in the day’s order', () => {
    const h = heroWeek(snapOf([run(W, 2, { id: 'pm', position: 1 }), run(W, 4, { id: 'am', position: 0 })]), W);
    expect(h.runs.marks.map((m) => `${m.id}@${m.weekday}`)).toEqual(['am@2', 'pm@2']);
    expect(h.runs.planned).toBe(2);
  });
});

describe('the first and last day of the week', () => {
  const snap = snapOf([...ownerWeek(), run(shiftDays(MON, 7), 4, { id: 'next-mon' }), run(shiftDays(MON, -1), 6, { id: 'last-sun' })], [act(M, 4)]);
  it('Monday and Sunday read the same week', () => {
    const mon = heroWeek(snap, M);
    const sun = heroWeek(snap, SU);
    expect([mon.mon, sun.mon]).toEqual([MON, MON]);
    expect([mon.weekday, sun.weekday]).toEqual([0, 6]);
    const counts = (h: typeof mon) => [h.runs.done, h.runs.planned, h.workouts.done, h.workouts.planned, h.miles.done, h.miles.planned];
    expect(counts(sun)).toEqual(counts(mon));
    expect(counts(mon)).toEqual([1, 4, 0, 2, 4, 15.5]);
    // neither the Sunday before nor the Monday after is in it
    expect(mon.runs.marks.map((m) => m.id)).toEqual(['r-mon', 'r-wed', 'r-fri', 'r-sat']);
    expect(mon.runs.marks.find((m) => m.shown)?.id).toBe('r-mon');
    expect(sun.runs.marks.some((m) => m.shown)).toBe(false);
  });
  it('the day after Sunday is the next week, the day before Monday the last', () => {
    expect(heroWeek(snap, shiftDays(MON, 7))).toMatchObject({ mon: '2026-11-16', weekday: 0, todayWeekday: null });
    expect(heroWeek(snap, shiftDays(MON, 7)).runs.marks.map((m) => m.id)).toEqual(['next-mon']);
    expect(heroWeek(snap, shiftDays(MON, -1))).toMatchObject({ mon: '2026-11-02', weekday: 6, todayWeekday: null });
    expect(heroWeek(snap, shiftDays(MON, -1)).runs.marks.map((m) => `${m.id}:${m.state}`)).toEqual(['last-sun:missed']);
  });
  it('from Sunday, next looks into the week after', () => {
    expect(heroWeek(snap, SU).next).toMatchObject({ date: '2026-11-16', name: 'Easy 4' });
    expect(heroWeek(snap, M).next).toMatchObject({ date: TU, name: 'Strength' });
  });
});

describe('a week that crosses a month', () => {
  const bundle = (month: string, sessions: Session[], activities: Activity[] = []): MonthBundle => ({ month, sessions, checks: [], lifts: [], activities, morningDays: {}, journal: [], coach: [] });
  // Monday November 30 to Sunday December 6, 2026, through the app's own snapshot of two month bundles
  const snap = buildSnapshot(
    {
      '2026-11': bundle('2026-11', [run('2026-11-30', 4, { id: 'nov-30' }), run('2026-11-28', 9, { id: 'the-week-before' })], [act('2026-11-30', 4.2)]),
      '2026-12': bundle('2026-12', [run('2026-12-02', 5, { id: 'dec-2' }), lift('2026-12-04', { id: 'dec-4' }), run('2026-12-06', 8, { id: 'dec-6', type: 'Long' }), run('2026-12-07', 3, { id: 'the-week-after' })]),
    },
    '2026-12-02',
  );
  it('counts both months as one week', () => {
    const h = heroWeek(snap, '2026-12-02');
    expect(h).toMatchObject({ mon: '2026-11-30', weekday: 2, todayWeekday: 2 });
    expect(h.runs.marks.map((m) => `${m.date} ${m.weekday} ${m.state}`)).toEqual(['2026-11-30 0 done', '2026-12-02 2 planned', '2026-12-06 6 planned']);
    expect(h.runs).toMatchObject({ done: 1, planned: 3 });
    expect(h.miles).toMatchObject({ done: 4.2, planned: 17 });
    expect(h.workouts.marks.map((m) => `${m.date} ${m.state}`)).toEqual(['2026-12-04 planned']);
    const sum = weekSummary(snap, '2026-11-30');
    expect([h.runs.done, h.runs.planned, h.miles.done, h.miles.planned]).toEqual([sum.runsDone, sum.runsPlanned, sum.doneMiles, sum.plannedMiles]);
  });
  it('reads the same from its November day and from its December days', () => {
    const a = heroWeek(snap, '2026-11-30');
    const b = heroWeek(snap, '2026-12-06');
    expect([a.mon, b.mon]).toEqual(['2026-11-30', '2026-11-30']);
    expect([b.runs.done, b.runs.planned, b.miles.planned]).toEqual([a.runs.done, a.runs.planned, a.miles.planned]);
    expect(b.next).toMatchObject({ date: '2026-12-07', name: 'Easy 3' });
  });
  it('and a week that crosses a year', () => {
    const y = buildSnapshot(
      { '2026-12': bundle('2026-12', [run('2026-12-28', 4), run('2026-12-31', 5)], [act('2026-12-28', 4)]), '2027-01': bundle('2027-01', [run('2027-01-02', 10, { type: 'Long' })]) },
      '2026-12-31',
    );
    const h = heroWeek(y, '2027-01-01');
    expect(h).toMatchObject({ mon: '2026-12-28', weekday: 4, todayWeekday: 3, scene: 'dusk' });
    expect(states(h.runs)).toBe('0:done 3:planned 5:planned');
    expect(h.miles).toMatchObject({ done: 4, planned: 19 });
    expect(h.next).toMatchObject({ date: '2027-01-02', name: 'Long 10' });
  });
});

describe('missed, skipped and the floor', () => {
  it('a missed run stays planned and is never done; a past week keeps its count', () => {
    const h = heroWeek(snapOf(ownerWeek(), [act(M, 4)], shiftDays(MON, 9)), W);
    expect(states(h.runs)).toBe('0:done 2:missed 4:missed 5:missed');
    expect(h.runs).toMatchObject({ done: 1, planned: 4, share: 0.25, complete: false });
    expect(states(h.workouts)).toBe('1:missed 3:missed');
    expect(h.todayWeekday).toBeNull();
    expect(h.runs.marks.some((m) => m.today)).toBe(false);
  });
  it('a week ahead is all planned', () => {
    const h = heroWeek(snapOf(ownerWeek(), [], shiftDays(MON, -3)), W);
    expect(states(h.runs)).toBe('0:planned 2:planned 4:planned 5:planned');
    expect(h.todayWeekday).toBeNull();
  });
  it('a skipped run and a run skipped for illness leave the week, miles and all', () => {
    const sessions = ownerWeek().map((s) => (s.id === 'r-mon' ? { ...s, mark: 'skip' as const } : s.id === 'r-fri' ? { ...s, mark: 'sick' as const } : s));
    const snap = snapOf(sessions);
    const h = heroWeek(snap, W);
    expect(h.runs.marks.map((m) => m.id)).toEqual(['r-wed', 'r-sat']);
    expect(h.runs.planned).toBe(2);
    expect(h.miles.planned).toBe(8.5);
    expect(weekSummary(snap, MON)).toMatchObject({ runsPlanned: 2, plannedMiles: 8.5 });
  });
  it('a floor counts as done, and counts its floor minutes as miles', () => {
    const snap = snapOf([run(M, 5, { mark: 'floor' }), run(W, 4)]);
    const h = heroWeek(snap, W);
    expect(states(h.runs)).toBe('0:done 2:planned');
    expect(h.runs).toMatchObject({ done: 1, planned: 2 });
    // 20 minutes at the default easy pace of 9:00 a mile
    expect(h.miles.done).toBe(2.22);
    expect(h.miles.done).toBe(weekSummary(snap, MON).doneMiles);
  });
  it('a run cut short still counts as done', () => {
    const h = heroWeek(snapOf([run(M, 5)], [act(M, 2)]), W);
    expect(h.runs).toMatchObject({ done: 1, planned: 1, complete: true });
    expect(h.miles).toMatchObject({ done: 2, planned: 5, share: 0.4 });
  });
});

describe('miles', () => {
  it('runs set in minutes plan no miles: the week has no mile target', () => {
    const snap = snapOf([run(M, null, { minutes: 30, mark: 'done' }), run(W, null, { minutes: 40 })]);
    const h = heroWeek(snap, W);
    expect(h.runs).toMatchObject({ done: 1, planned: 2 });
    // 30 minutes at 9:00 a mile
    expect(h.miles).toEqual({ done: 3.33, planned: null, share: 1 });
  });
  it('prints to one decimal, as the week does everywhere', () => {
    expect(tenth(9.46)).toBe('9.5');
    expect(tenth(15.5)).toBe('15.5');
    expect(tenth(4)).toBe('4');
    expect(tenth(0)).toBe('0');
    expect(tenth(17.96)).toBe('18');
  });
});

describe('workouts: lifts and cross sessions', () => {
  it('a lift is done by its sets, by a lift that synced, or by hand; a ride by a cross or lift activity', () => {
    const bySets = heroWeek(snapOf([lift(M)], [], W, { [M]: 9 }), W);
    const bySync = heroWeek(snapOf([lift(M)], [act(M, 0, { kind: 'lift', sportType: 'WeightTraining' })]), W);
    const byHand = heroWeek(snapOf([lift(M, { mark: 'done' })]), W);
    for (const h of [bySets, bySync, byHand]) expect(h.workouts).toMatchObject({ done: 1, planned: 1, share: 1, complete: true });
    expect(heroWeek(snapOf([cross(M)], [act(M, 0, { kind: 'cross', sportType: 'Ride' })]), W).workouts.done).toBe(1);
    expect(heroWeek(snapOf([cross(M)], [act(M, 0, { kind: 'lift' })]), W).workouts.done).toBe(1);
    // a run does not do a lift
    expect(heroWeek(snapOf([lift(M)], [act(M, 4)]), W).workouts).toMatchObject({ done: 0, planned: 1 });
  });
  it('sets logged with no lift planned that day are one workout beyond the plan', () => {
    const h = heroWeek(snapOf([lift(M, { mark: 'done' }), lift(F)], [], F, { [W]: 12 }), F);
    expect(states(h.workouts)).toBe('0:done 2:done+ 4:planned');
    expect(h.workouts).toMatchObject({ done: 2, planned: 2, share: 1 });
    expect(h.workouts.marks[1]).toMatchObject({ kind: 'lift', extra: true, session: null });
    // a ride that synced with nothing planned is one too, drawn as a ride
    const ride = heroWeek(snapOf([], [act(TU, 0, { kind: 'cross', sportType: 'Ride' })]), W);
    expect(ride.workouts.marks.map(bare)).toEqual([{ id: `extra-workouts-${TU}`, date: TU, weekday: 1, kind: 'cross', state: 'done', today: false, shown: false, extra: true }]);
  });
  it('sets logged on a run day count as a workout; a run on a lift day counts as a run', () => {
    const h = heroWeek(snapOf([run(M, 4), lift(TU)], [act(TU, 3)], W, { [M]: 6 }), W);
    expect(states(h.workouts)).toBe('0:done+ 1:missed');
    expect(states(h.runs)).toBe('0:missed 1:done+');
  });
  it('a workout that happened on a day whose own workout still stands does not add a mark', () => {
    // sets on a ride day: the ride is not done by sets, and the day keeps its one mark
    const h = heroWeek(snapOf([cross(W)], [], W, { [W]: 6 }), W);
    expect(states(h.workouts)).toBe('2:planned');
    expect(h.workouts).toMatchObject({ done: 0, planned: 1 });
  });
  it('a lift and a ride on one day are two marks; a skipped lift is none', () => {
    const h = heroWeek(snapOf([lift(W, { id: 'l', position: 0 }), cross(W, { id: 'c', position: 1 }), lift(F, { mark: 'skip' })]), W);
    expect(h.workouts.marks.map((m) => `${m.id}:${m.kind}@${m.weekday}`)).toEqual(['l:lift@2', 'c:cross@2']);
    expect(h.workouts.planned).toBe(2);
  });
  it('with lifts only, the count is Progress’s for strength: the lifts that stand, the ones that count, and a day lifted off the plan', () => {
    // Mon done by sets, Wed done by hand, Fri still ahead, Sat skipped; Thursday lifted with nothing planned
    const h = heroWeek(snapOf([lift(M), lift(W, { mark: 'done' }), lift(F), lift(SA, { mark: 'skip' })], [], TH, { [M]: 10, [TH]: 5 }), TH);
    expect(h.workouts).toMatchObject({ done: 3, planned: 3, share: 1, complete: true });
    expect(states(h.workouts)).toBe('0:done 2:done 3:done+ 4:planned');
  });
});

describe('the week complete', () => {
  it('every run and every workout done', () => {
    const sessions = ownerWeek().map((s) => ({ ...s, mark: 'done' as const }));
    const h = heroWeek(snapOf(sessions, [], SA), SA);
    expect(h.complete).toBe(true);
    expect([h.runs.share, h.workouts.share, h.miles.share]).toEqual([1, 1, 1]);
  });
  it('not while one workout is still open, though the runs are done', () => {
    const sessions = ownerWeek().map((s) => (s.kind === 'run' || s.id === 'l-tue' ? { ...s, mark: 'done' as const } : s));
    const h = heroWeek(snapOf(sessions, [], SA), SA);
    expect(h.runs.complete).toBe(true);
    expect(h.workouts).toMatchObject({ done: 1, planned: 2, complete: false });
    expect(h.complete).toBe(false);
  });
  it('a skipped session is excused', () => {
    const sessions = ownerWeek().map((s) => (s.id === 'c-thu' ? { ...s, mark: 'skip' as const } : { ...s, mark: 'done' as const }));
    expect(heroWeek(snapOf(sessions, [], SA), SA).complete).toBe(true);
  });
  it('a week of workouts only can be complete; a week with nothing planned never is', () => {
    expect(heroWeek(snapOf([lift(M, { mark: 'done' }), cross(W, { mark: 'done' })]), W).complete).toBe(true);
    expect(heroWeek(snapOf([], [act(M, 5), act(TU, 5)]), W).complete).toBe(false);
  });
  it('miles are not part of it: every run done short of the miles is still complete', () => {
    const h = heroWeek(snapOf([run(M, 5), run(TU, 5)], [act(M, 4.2), act(TU, 4.1)]), W);
    expect(h.miles.share).toBeLessThan(1);
    expect(h.complete).toBe(true);
  });
});

describe('what comes next', () => {
  it('is the first session that stands after the shown day: not rest, not skipped', () => {
    const snap = snapOf([rest(TH), run(F, 4, { mark: 'skip' }), lift(SA, { title: 'Strength A' }), run(SU, 8, { type: 'Long' })]);
    expect(nextSession(snap, W)).toMatchObject({ date: SA, name: 'Strength A' });
    expect(nextSession(snap, SA)).toMatchObject({ date: SU, name: 'Long 8' });
    expect(nextSession(snap, SU)).toBeNull();
  });
  it('takes the first in the day’s order, and never today’s own', () => {
    const snap = snapOf([run(W, 4), lift(TH, { id: 'second', position: 1 }), run(TH, 3, { id: 'first', position: 0 })]);
    expect(nextSession(snap, W)?.session.id).toBe('first');
  });
  it('looks seven days ahead and no further', () => {
    expect(nextSession(snapOf([run(shiftDays(W, 7), 4)]), W)).toMatchObject({ date: shiftDays(W, 7) });
    expect(nextSession(snapOf([run(shiftDays(W, 8), 4)]), W)).toBeNull();
  });
  it('is the session the rest face’s row names', () => {
    const b: MonthBundle = { month: '2026-11', sessions: [run(F, 5, { type: 'Long' })], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] };
    const snap = buildSnapshot({ '2026-11': b }, W);
    const log = { today: W, boot: { morningSettings: MORNING_DEFAULTS, habits: [], blocks: [] } as unknown as Log['boot'], habits: [], zones: null, features: { claude: false, strava: false }, strava: null, snap, ready: true, loading: false, loaded: () => true } as Log;
    const face = faceOf(log, W, phaseOf(log, W, 13 * 60));
    const h = heroWeek(snap, W);
    expect(h.scene).toBe('dusk');
    expect(face.next?.session.id).toBe(h.next?.session.id);
    expect(face.next?.head).toBe(`Fri: ${h.next?.name}`);
  });
});

describe('the marks and the totals are one count', () => {
  /** A small seeded generator: the same weeks on every run. */
  const rng = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
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

  it('holds for 400 generated weeks, on every day of each', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { snap, sessions, acts, sets } = week(seed);
      const sum = weekSummary(snap, MON);
      for (const d of [M, TU, W, TH, F, SA, SU]) {
        const h = heroWeek(snap, d);
        const where = `seed ${seed}, ${d}`;
        // the totals are the week sheet's
        expect([h.runs.done, h.runs.planned, h.miles.done, h.miles.planned ?? 0], where).toEqual([sum.runsDone, sum.runsPlanned, sum.doneMiles, sum.plannedMiles]);
        for (const c of [h.runs, h.workouts]) {
          // the marks add up to them
          expect(c.marks.filter((m) => m.state === 'done').length, where).toBe(c.done);
          expect(c.marks.filter((m) => !m.extra).length, where).toBe(c.planned);
          expect(c.share, where).toBe(c.planned > 0 ? Math.min(1, c.done / c.planned) : c.done > 0 ? 1 : 0);
          expect(c.complete, where).toBe(c.planned > 0 && c.done >= c.planned);
          for (const m of c.marks) {
            expect(m.weekday, where).toBe([M, TU, W, TH, F, SA, SU].indexOf(m.date));
            expect([m.today, m.shown], where).toEqual([m.date === snap.today, m.date === d]);
            if (m.extra) expect([m.state, m.session], where).toEqual(['done', null]);
            else expect(m.session && m.session.kind === m.kind && m.session.mark !== 'skip' && m.session.mark !== 'sick', where).toBe(true);
            // nothing is missed today or ahead, nothing is merely planned once its day has passed
            if (m.state === 'missed') expect(m.date < snap.today, where).toBe(true);
            if (m.state === 'planned') expect(m.date >= snap.today, where).toBe(true);
          }
          expect(c.marks.map((m) => m.date), where).toEqual([...c.marks.map((m) => m.date)].sort());
          expect(new Set(c.marks.map((m) => m.id)).size, where).toBe(c.marks.length);
        }
        expect(h.runs.marks.every((m) => m.kind === 'run') && h.workouts.marks.every((m) => m.kind !== 'run'), where).toBe(true);
        // dusk is the day with no mark on it
        const onDay = [...h.runs.marks, ...h.workouts.marks].filter((m) => m.shown).length;
        expect(h.scene, where).toBe(onDay ? 'day' : 'dusk');
        if (h.scene === 'dusk') expect(h.defaultView, where).toBe('runs');
        // the view it opens on has a mark on the day
        else expect((h.defaultView === 'runs' ? h.runs : h.workouts).marks.some((m) => m.shown), where).toBe(true);
        const inWeek = (x: { date: ISODate }) => x.date >= M && x.date <= SU;
        const nothing = !sessions.some(inWeek) && !acts.some(inWeek) && ![M, TU, W, TH, F, SA, SU].some((x) => sets[x]);
        expect(h.emptyWeek, where).toBe(nothing);
        if (h.emptyWeek) expect(h.runs.marks.length + h.workouts.marks.length, where).toBe(0);
        const withPlan = [h.runs, h.workouts].filter((c) => c.planned > 0);
        expect(h.complete, where).toBe(withPlan.length > 0 && withPlan.every((c) => c.complete));
        expect([h.mon, h.weekday, h.todayWeekday], where).toEqual([MON, [M, TU, W, TH, F, SA, SU].indexOf(d), snap.today >= M && snap.today <= SU ? [M, TU, W, TH, F, SA, SU].indexOf(snap.today) : null]);
        if (h.next) expect(h.next.date > d && h.next.date <= shiftDays(d, 7) && h.next.session.kind !== 'rest', where).toBe(true);
      }
    }
  });
});
