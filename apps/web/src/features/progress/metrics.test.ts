import { shiftDays, type Activity, type HabitCheck, type LiftSet, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { rangeWindow } from '@/ui/charts';
import { activityFeed, agoWords, feedDetail, monthCompare, monthWords, snapSource, syncWords } from './feed';
import { bandWords, buildMetric, METRICS, valueDateWords, type MetricSource } from './metrics';
import { paceText } from './data';
import { chartZones, effortWord, hrShare, lapRows, zoneShare } from './run';

const TODAY = '2026-11-08';
const run = (date: string, miles: number, extra: Partial<Activity> = {}): Activity => ({ id: `a-${date}-${miles}`, date, time: '07:00', name: 'Morning Run', sportType: 'Run', kind: 'run', miles, movingSec: miles * 480, elevFt: 0, avgHr: 150, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null, ...extra });
const sess = (date: string, miles: number, extra: Partial<Session> = {}): Session => ({ id: `s-${date}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles, minutes: null, blockId: null, movedFrom: null, mark: null, ...extra });
const set = (date: string, weight: number, reps: number, exercise = 'Squat'): LiftSet => ({ id: `l-${date}-${weight}-${reps}-${exercise}`, date, exercise, weight, reps, createdAt: `${date}T10:00:00Z` });
const empty = (m: string): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] });
const snapOf = (acts: Activity[], sessions: Session[] = [], lifts: LiftSet[] = [], checks: HabitCheck[] = [], today = TODAY, back = 400) => {
  const bundles: Record<string, MonthBundle> = {};
  for (let d = shiftDays(today, -back); d <= shiftDays(today, 10); d = shiftDays(d, 1)) bundles[d.slice(0, 7)] ??= empty(d.slice(0, 7));
  for (const a of acts) bundles[a.date.slice(0, 7)]!.activities.push(a);
  for (const s of sessions) bundles[s.date.slice(0, 7)]!.sessions.push(s);
  for (const l of lifts) bundles[l.date.slice(0, 7)]!.lifts.push(l);
  for (const c of checks) bundles[c.date.slice(0, 7)]!.checks.push(c);
  return buildSnapshot(bundles, today);
};
const src = (s: ReturnType<typeof snapOf>, easy: string[] = []) => snapSource(s, [{ id: 'h1', name: 'Read', createdOn: '2026-01-01' }], new Set(easy));

describe('weekly mileage metric', () => {
  it('rolls seven days of miles, draws daily bars and starts where the runs do', () => {
    // a 3-mile run every other day for the last 40 days
    const acts = Array.from({ length: 20 }, (_, i) => run(shiftDays(TODAY, -i * 2), 3));
    const m = buildMetric(METRICS.mileage, null, src(snapOf(acts)), rangeWindow(TODAY, '3M'));
    expect(m.dates.length).toBe(91);
    // today ran, as did Nov 6, 4 and 2: 4 runs in 7 days
    expect(m.value).toBe(12);
    expect(m.daily[m.daily.length - 1]).toBe(3);
    expect(m.daily[m.daily.length - 2]).toBe(0);
    // nothing before the first run: no line, no zeros
    expect(m.line[0]).toBeNull();
    expect(m.hasData).toBe(true);
    expect(m.latest).toBe(TODAY);
    expect(m.band).not.toBeNull();
    expect(m.status).toMatch(/usual/i);
    expect(bandWords(m)).toMatch(/^Usual \d+\.\d–\d+\.\d mi$/);
    expect(valueDateWords(m, TODAY)).toBe('7 days to today');
  });

  it('says the learning period while the normal is building', () => {
    const acts = [run(TODAY, 4), run(shiftDays(TODAY, -2), 5)];
    const m = buildMetric(METRICS.mileage, 'miles', src(snapOf(acts)), rangeWindow(TODAY, '1M'));
    expect(m.band).toBeNull();
    expect(m.status).toBe('Building your normal: 3 of 14 days');
  });

  it('keeps the shell with no runs at all', () => {
    const m = buildMetric(METRICS.mileage, null, src(snapOf([])), rangeWindow(TODAY, '1M'));
    expect(m.value).toBeNull();
    expect(m.hasData).toBe(false);
    expect(m.status).toBe('No runs yet');
    expect(m.trend.every((r) => r.change == null)).toBe(true);
  });

  it('counts runs marked done by hand at their planned miles', () => {
    const m = buildMetric(METRICS.mileage, null, src(snapOf([], [sess(TODAY, 6, { mark: 'done' })])), rangeWindow(TODAY, '1M'));
    expect(m.value).toBe(6);
  });

  it('compares the last week with the week before in the trend table', () => {
    const acts = [...Array.from({ length: 7 }, (_, i) => run(shiftDays(TODAY, -i), 2)), ...Array.from({ length: 7 }, (_, i) => run(shiftDays(TODAY, -7 - i), 1))];
    const m = buildMetric(METRICS.mileage, null, src(snapOf(acts)), rangeWindow(TODAY, '1M'));
    const wk = m.trend.find((r) => r.days === 7)!;
    expect(wk.now).toBe(14);
    expect(wk.before).toBe(7);
    expect(wk.dir).toBe('up');
  });
});

describe('pace metric', () => {
  it('averages run days, carries the line between runs and reads faster as a word', () => {
    const acts = Array.from({ length: 20 }, (_, i) => run(shiftDays(TODAY, -i * 3), 5, { movingSec: 5 * (480 + i) }));
    const m = buildMetric(METRICS.pace, 'all', src(snapOf(acts)), rangeWindow(TODAY, '1M'));
    expect(m.variant.invert).toBe(true);
    // the day after a run still has a line point
    expect(m.line[m.line.length - 2]).not.toBeNull();
    expect(m.daily[m.daily.length - 2]).toBeNull();
    // the newest runs are the fastest: the 7-day row reads faster
    const wk = m.trend.find((r) => r.days === 7)!;
    expect(m.variant.change!(wk)).toMatch(/s faster$/);
  });

  it('keeps only easy runs on the easy chip', () => {
    const acts = [run(TODAY, 5, { id: 'easy', movingSec: 5 * 540 }), run(shiftDays(TODAY, -1), 5, { id: 'fast', movingSec: 5 * 420 })];
    const m = buildMetric(METRICS.pace, 'easy', src(snapOf(acts), ['easy']), rangeWindow(TODAY, '1M'));
    expect(m.value).toBe(540);
  });
});

describe('consistency and lifts', () => {
  it('reads habits as a share, counting today only once done', () => {
    const checks: HabitCheck[] = [shiftDays(TODAY, -1), shiftDays(TODAY, -3)].map((date) => ({ habitId: 'h1', date, done: true, note: null }) as HabitCheck);
    const m = buildMetric(METRICS.consistency, 'habits', src(snapOf([], [], [], checks)), rangeWindow(TODAY, '1M'));
    // today not done yet: no point for today, the line ends yesterday
    expect(m.daily[m.daily.length - 1]).toBeNull();
    expect(m.daily[m.daily.length - 2]).toBe(100);
    expect(m.valueDate).toBe(shiftDays(TODAY, -1));
  });

  it('adds weight times reps into a weekly volume', () => {
    const lifts = [set(TODAY, 100, 5), set(TODAY, 100, 5, 'Bench'), set(shiftDays(TODAY, -3), 200, 3)];
    const m = buildMetric(METRICS.lifts, 'volume', src(snapOf([], [], lifts)), rangeWindow(TODAY, '1M'));
    expect(m.value).toBe(1600);
    expect(m.variant.format(m.value!)).toBe('1,600');
    expect(m.variant.format(12345)).toBe('12.3K');
    const s = buildMetric(METRICS.lifts, 'sets', src(snapOf([], [], lifts)), rangeWindow(TODAY, '1M'));
    expect(s.value).toBe(3);
  });

  it('keeps the Apple Health metrics empty, with plain words, when the account has no readings', () => {
    for (const id of ['sleep', 'hrv', 'rhr'] as const) {
      const m = buildMetric(METRICS[id], null, src(snapOf([run(TODAY, 3)])), rangeWindow(TODAY, '1M'));
      expect(m.def.health).toBe(true);
      expect(m.hasData).toBe(false);
      expect(m.value).toBeNull();
      expect(m.status).toBe('No readings yet');
    }
  });

  it('works from a hand-built source', () => {
    const fake: MetricSource = { today: TODAY, loaded: () => true, milesOn: () => 1, runCountOn: () => 1, runsOn: () => [], isEasy: () => false, habitShare: () => null, trainingOn: () => null, liftsOn: () => [], healthOn: () => null };
    const m = buildMetric(METRICS.mileage, null, fake, rangeWindow(TODAY, '1M'));
    expect(m.value).toBe(7);
    expect(m.standing).toBe('within');
  });
});

describe('this month against last month', () => {
  it('adds up both months by day of month and compares by this day', () => {
    const acts = [run('2026-10-02', 5), run('2026-10-05', 5), run('2026-10-20', 10), run('2026-11-01', 4), run('2026-11-07', 6)];
    const m = monthCompare(snapOf(acts), TODAY);
    expect(m.length).toBe(31);
    expect(m.curTotal).toBe(10);
    expect(m.prevTotal).toBe(20);
    expect(m.prevByNow).toBe(10);
    expect(m.curLine[7]).toBe(10);
    expect(m.curLine[8]).toBeNull();
    expect(m.prevLine[30]).toBe(20);
    expect(monthWords(m, () => 'October')).toBe('Level with October by this day.');
    expect(monthWords({ ...m, curTotal: 14 }, () => 'October')).toBe('4.0 mi ahead of October by this day.');
  });
});

describe('the activity list', () => {
  it('lists Strava and manual entries newest first, with filters', () => {
    const s = snapOf(
      [run(TODAY, 5), run('2026-11-01', 13.1, { name: 'Harvest Half', time: '08:00' }), run('2026-11-01', 1.5, { name: 'Shakeout', time: '06:30' }), { ...run('2026-11-03', 0), id: 'wt', kind: 'lift', name: 'Weight Training', sportType: 'WeightTraining', movingSec: 2400 }],
      [sess('2026-11-01', 13.1, { type: 'Race' }), sess('2026-11-05', 4, { mark: 'done', id: 'manual' })],
      [set('2026-11-04', 135, 5), set('2026-11-04', 95, 8, 'Bench'), set('2026-11-04', 145, 5, 'Deadlift')],
    );
    const all = activityFeed(s, '2026-10-25', TODAY);
    expect(all.map((x) => `${x.date} ${x.kind} ${x.source}`)).toEqual(['2026-11-08 run Strava', '2026-11-05 run Manual', '2026-11-04 lift Manual', '2026-11-03 lift Strava', '2026-11-01 run Strava', '2026-11-01 run Strava']);
    expect(activityFeed(s, '2026-10-25', TODAY, 'races').map((x) => x.title)).toEqual(['Harvest Half']);
    expect(activityFeed(s, '2026-10-25', TODAY, 'runs').length).toBe(4);
    expect(activityFeed(s, '2026-10-25', TODAY, 'lifts').length).toBe(2);
    const lift = all.find((x) => x.key === 'l-2026-11-04')!;
    expect(feedDetail(lift, TODAY, paceText, String)).toBe('Nov 4 · 3 sets · Squat, Bench +1');
    expect(feedDetail(all[0]!, TODAY, paceText, () => '40:00')).toBe('Today · 8:00 /mi · 40:00');
    expect(feedDetail(all[1]!, TODAY, paceText, String)).toBe('Nov 5 · Marked done');
  });
});

describe('freshness words', () => {
  const now = Date.parse('2026-11-08T12:00:00');
  it('says how long ago, plainly', () => {
    expect(agoWords(new Date(now - 30_000).toISOString(), now)).toBe('just now');
    expect(agoWords(new Date(now - 6 * 60_000).toISOString(), now)).toBe('6 m ago');
    expect(agoWords(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('3 h ago');
    expect(agoWords(new Date(now - 26 * 3600_000).toISOString(), now)).toBe('yesterday');
    expect(agoWords(null, now)).toBeNull();
  });
  it('reads the Strava status', () => {
    expect(syncWords(null, now)).toBeNull();
    expect(syncWords({ connected: true, lastSyncAt: new Date(now - 6 * 60_000).toISOString(), syncing: false, error: null }, now)).toBe('Synced 6 m ago');
    expect(syncWords({ connected: true, lastSyncAt: null, syncing: true, error: null }, now)).toBe('Syncing…');
  });
});

describe('the run detail', () => {
  const zones = [
    { zone: 1, min: 0, max: 128 },
    { zone: 2, min: 129, max: 148 },
    { zone: 3, min: 149, max: 160 },
    { zone: 4, min: 161, max: 172 },
    { zone: 5, min: 173, max: null },
  ];
  it('turns laps into rows, leaving out stop-start scraps and marking the short last lap', () => {
    const rows = lapRows([[1609.34, 480, 140], [100, 30, null], [804.67, 250, 150]], zones);
    expect(rows.map((r) => [r.n, Math.round(r.pace), r.zone, r.part])).toEqual([
      [1, 480, 2, false],
      [2, 500, 3, true],
    ]);
  });
  it('shades zones that meet and places a heart rate on the gauge', () => {
    const z = chartZones(zones);
    expect(z[1]!.hi).toBe(z[2]!.lo);
    expect(z[4]).toEqual({ lo: 172.5, hi: 193.5, label: 'Z5' });
    expect(hrShare(zones, 0, 180)).toBe(0);
    expect(hrShare(zones, 193, 180)).toBe(1);
    expect(hrShare(null, 150, 180)).toBeNull();
    const band = zoneShare(zones, 2, 180)!;
    expect(band[0]).toBeLessThan(band[1]);
    expect(effortWord('hard')).toBe('Harder than planned');
    expect(effortWord(null)).toBeNull();
  });
});
