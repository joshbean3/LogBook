import { describe, expect, it } from 'vitest';
import { assess, grade } from './assess.js';
import { buildMorning, morningDayFor, MORNING_DEFAULTS } from './morning.js';
import { chooseItem } from './rotation.js';
import { dayStatus, sessionStatus, trainingStreak, weekTotals, type Snapshot } from './status.js';
import type { Activity, HrZone, Session } from './types.js';

const sess = (p: Partial<Session> & Pick<Session, 'date' | 'kind'>): Session => ({
  id: p.id ?? `s-${p.date}-${p.kind}`,
  position: 0,
  type: null,
  title: null,
  details: null,
  miles: null,
  minutes: null,
  blockId: null,
  movedFrom: null,
  mark: null,
  ...p,
});
const run = (date: string, miles: number, extra: Partial<Activity> = {}): Activity => ({
  id: `a-${date}-${miles}`,
  date,
  time: '07:40',
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
  ...extra,
});
const snap = (sessions: Session[], acts: Activity[], today = '2026-10-11', sets: Record<string, number> = {}): Snapshot => ({
  today,
  sessionsOn: (d) => sessions.filter((s) => s.date === d),
  activitiesOn: (d) => acts.filter((a) => a.date === d),
  liftSetCountOn: (d) => sets[d] ?? 0,
});

describe('sessionStatus', () => {
  it('a run becomes done from Strava miles', () => {
    const s = sess({ date: '2026-10-10', kind: 'run', miles: 5 });
    expect(sessionStatus(snap([s], [run('2026-10-10', 5.1)]), '2026-10-10', s)).toBe('done');
  });
  it('under 80% of planned miles is the floor', () => {
    const s = sess({ date: '2026-10-10', kind: 'run', miles: 10 });
    expect(sessionStatus(snap([s], [run('2026-10-10', 6)]), '2026-10-10', s)).toBe('floor');
  });
  it('a past run with nothing recorded is missed, today is open, tomorrow upcoming', () => {
    const past = sess({ date: '2026-10-10', kind: 'run', miles: 5 });
    const now = sess({ date: '2026-10-11', kind: 'run', miles: 5 });
    const next = sess({ date: '2026-10-12', kind: 'run', miles: 5 });
    const S = snap([past, now, next], []);
    expect(sessionStatus(S, '2026-10-10', past)).toBe('missed');
    expect(sessionStatus(S, '2026-10-11', now)).toBe('open');
    expect(sessionStatus(S, '2026-10-12', next)).toBe('upcoming');
  });
  it('a skip mark wins over evidence; a lift is done from logged sets', () => {
    const r = sess({ date: '2026-10-10', kind: 'run', miles: 5, mark: 'skip' });
    const l = sess({ date: '2026-10-10', kind: 'lift' });
    const S = snap([r, l], [run('2026-10-10', 5)], '2026-10-11', { '2026-10-10': 3 });
    expect(sessionStatus(S, '2026-10-10', r)).toBe('skipped');
    expect(sessionStatus(S, '2026-10-10', l)).toBe('done');
  });
});

describe('dayStatus and streak', () => {
  it('summarises a day and skips rest days when counting the streak', () => {
    const sessions = [
      sess({ date: '2026-10-08', kind: 'run', miles: 5 }),
      sess({ date: '2026-10-09', kind: 'rest' }),
      sess({ date: '2026-10-10', kind: 'run', miles: 5, mark: 'floor' }),
      sess({ date: '2026-10-11', kind: 'run', miles: 5 }),
    ];
    const S = snap(sessions, [run('2026-10-08', 5)]);
    expect(dayStatus(S, '2026-10-08')).toBe('done');
    expect(dayStatus(S, '2026-10-09')).toBe('rest');
    expect(dayStatus(S, '2026-10-10')).toBe('floor');
    expect(dayStatus(S, '2026-10-11')).toBe('open');
    expect(dayStatus(S, '2026-10-07')).toBe('empty');
    expect(trainingStreak(S)).toBe(2);
  });
  it('an unplanned run is a bonus', () => {
    expect(dayStatus(snap([], [run('2026-10-10', 3)]), '2026-10-10')).toBe('bonus');
  });
  it('week totals add planned miles, ran miles and sessions hit', () => {
    const S = snap([sess({ date: '2026-10-06', kind: 'run', miles: 5 }), sess({ date: '2026-10-07', kind: 'lift' })], [run('2026-10-06', 5.2)], '2026-10-11', { '2026-10-07': 2 });
    expect(weekTotals(S, '2026-10-05')).toEqual({ planned: 5, ran: 5.2, sessions: 2, hit: 2 });
  });
});

const zones: HrZone[] = [
  { zone: 1, min: 0, max: 130 },
  { zone: 2, min: 131, max: 150 },
  { zone: 3, min: 151, max: 165 },
  { zone: 4, min: 166, max: 178 },
  { zone: 5, min: 179, max: null },
];

describe('grade and assess', () => {
  it('grades easy runs against the Z2 ceiling and threshold against Z3-Z4', () => {
    expect(grade(zones, { type: 'Easy' }, { avg: 145, max: 160 })?.verdict).toBe('On target');
    expect(grade(zones, { type: 'Easy' }, { avg: 158, max: 170 })?.verdict).toBe('Too hard');
    expect(grade(zones, { type: 'Threshold' }, { avg: 145, max: 160 })?.verdict).toBe('Too easy');
    expect(grade(zones, { type: 'Intervals' }, { avg: 150, max: 172 })?.verdict).toBe('On target');
  });
  it('spots a negative split', () => {
    const laps = [1609, 1609, 1609, 1609].map((m, i) => [m, 560 - i * 10, 140 + i] as [number, number, number]);
    const a = assess(zones, sess({ date: '2026-10-10', kind: 'run', type: 'Easy', miles: 4 }), [run('2026-10-10', 4, { avgHr: 142, maxHr: 150, laps, perfAt: 'x' })]);
    expect(a.distance).toBe('full');
    expect(a.effort).toBe('on');
    expect(a.lines.some((l) => l.startsWith('Negative split'))).toBe(true);
    expect(a.head).toBe('Full distance, effort on target');
  });
});

describe('morning timeline', () => {
  it('walks from the alarm to the door with the default numbers', () => {
    const day = morningDayFor([sess({ date: '2026-10-12', kind: 'run', type: 'Easy', miles: 5 })], null, MORNING_DEFAULTS);
    const t = buildMorning(day, MORNING_DEFAULTS);
    expect(day.mode).toBe('run');
    // 7:20 alarm, 15 wake, 5 buffer: run starts 7:40, 45 min at 9:00/mi, back 8:30, shower 8:40 fixed, door 9:30
    expect(t.blocks.find((b) => b.key === 'run')?.start).toBe(460);
    expect(t.back).toBe(510);
    expect(t.late).toBe(0);
    expect(t.leave).toBe(570);
  });
  it('tells you what to change when the run runs past the shower', () => {
    const day = morningDayFor([sess({ date: '2026-10-12', kind: 'run', type: 'Long', miles: 10 })], null, MORNING_DEFAULTS);
    const t = buildMorning(day, MORNING_DEFAULTS);
    expect(t.late).toBeGreaterThan(0);
    expect(t.fix?.maxMiles).toBeCloseTo(6.1, 1);
  });
});

describe('rotation', () => {
  it('never repeats inside the cooldown and prefers favorites', () => {
    const items = [
      { id: 'a', fav: false },
      { id: 'b', fav: true },
      { id: 'c', fav: false },
    ];
    const shown: Record<string, string> = { a: '2026-10-01', c: '2026-10-05' };
    const pick = chooseItem(items, (id) => shown[id] ?? null, '2026-10-11', null, () => 0.5);
    expect(pick?.id).toBe('b');
  });
});
