import { MORNING_DEFAULTS, type Activity, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { faceOf, milesText, otherEyebrow, phaseOf, planWords } from './faces';
import { morningRowWords } from './MorningRow';
import { isoWeek } from './WeekCard';

const FRI = '2026-10-23';
const run = (date: string, over: Partial<Session> = {}): Session => ({ id: `s-${date}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...over });
const bundle = (sessions: Session[], activities: Activity[] = []): MonthBundle => ({ month: '2026-10', sessions, checks: [], lifts: [], activities, morningDays: {}, journal: [], coach: [] });
const logOf = (b: MonthBundle, today = FRI): Log => {
  const snap = buildSnapshot({ '2026-10': b }, today);
  return { today, boot: { morningSettings: MORNING_DEFAULTS, habits: [], blocks: [] } as unknown as Log['boot'], habits: [], zones: null, features: { claude: false, strava: false }, strava: null, snap, ready: true, loading: false, loaded: () => true } as Log;
};

describe('the hero faces (docs/feel.md §3.2, §3.3)', () => {
  const b = bundle([run(FRI), run('2026-10-24', { type: 'Threshold', miles: 6 }), run('2026-10-11', { type: 'Easy', miles: 6 })]);
  const log = logOf(b);
  it('today before the door: the morning face with the four-stop line', () => {
    const ph = phaseOf(log, FRI, 6 * 60 + 30);
    const f = faceOf(log, FRI, ph);
    expect(f.kind).toBe('morning');
    expect(f.eyebrow).toBe('THIS MORNING');
    expect(f.stamp).toBe('EASY 4');
    expect(f.line).toMatch(/^Out the door in /);
    expect(f.stops?.map((s) => s.label)).toEqual(['Wake', 'Door', 'Back', 'Leave']);
    expect(f.tall).toBe(false);
  });
  it('the open face after the door and back: the status line and the ring', () => {
    const ph = phaseOf(log, FRI, 12 * 60);
    const f = faceOf(log, FRI, ph);
    expect(f.kind).toBe('open');
    expect(f.ring).toBe('open');
    expect(f.line).toBe('4 mi · floor 20 min easy');
  });
  it('done by hand: "4 mi. Done." and the check in the ring', () => {
    const l2 = logOf(bundle([run(FRI, { mark: 'done' })]));
    const f = faceOf(l2, FRI, phaseOf(l2, FRI, 12 * 60));
    expect(f.kind).toBe('doneHand');
    expect(f.line).toBe('4 mi. Done.');
    expect(f.ring).toBe('done');
  });
  it('another day: quiet, with the eyebrow of its distance', () => {
    const f = faceOf(log, '2026-10-24', phaseOf(log, '2026-10-24', 12 * 60));
    expect(f.kind).toBe('planned');
    expect(f.eyebrow).toBe('TOMORROW');
    expect(f.quiet).toBe(true);
    const m = faceOf(log, '2026-10-11', phaseOf(log, '2026-10-11', 12 * 60));
    expect(m.kind).toBe('missed');
    expect(m.line).toBe('Missed.');
  });
  it('a run that landed with a route is the one tall face', () => {
    const a = { id: 'a1', date: FRI, kind: 'run', name: 'Morning Run', time: '07:30', miles: 5.02, movingSec: 2480, elevFt: 30, avgHr: 150, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', laps: null } as unknown as Activity;
    const l3 = logOf(bundle([run(FRI, { mark: 'done' })], [a]));
    const f = faceOf(l3, FRI, phaseOf(l3, FRI, 12 * 60));
    expect(f.kind).toBe('landed');
    expect(f.tall).toBe(true);
    expect(f.line).toMatch(/^5\.02 mi at \d+:\d\d\.$/);
  });
  it('a rest day after leave: Rest day, the next session as one row', () => {
    const l4 = logOf(bundle([run('2026-10-24', { type: 'Long', miles: 4 })]), '2026-10-23');
    const f = faceOf(l4, FRI, phaseOf(l4, FRI, 12 * 60));
    expect(f.kind).toBe('rest');
    expect(f.stamp).toBe('REST');
    expect(f.next?.text).toMatch(/^Tomorrow: Long 4/);
  });
});

describe('the words around the hero', () => {
  it('eyebrows of other days', () => {
    expect(otherEyebrow('2026-10-22', FRI)).toBe('YESTERDAY');
    expect(otherEyebrow('2026-10-24', FRI)).toBe('TOMORROW');
    expect(otherEyebrow('2026-10-28', FRI)).toBe('IN 5 DAYS');
    expect(otherEyebrow('2026-10-11', FRI)).toBe('SUN, OCT 11');
  });
  it('the This morning row', () => {
    expect(morningRowWords(FRI, FRI, 435, 570)).toEqual({ title: 'This morning', right: 'Wake 7:15 · Leave 9:30' });
    expect(morningRowWords('2026-10-22', FRI, 435, 570)).toEqual({ title: 'That morning', right: 'Left 9:30' });
    expect(morningRowWords('2026-10-24', FRI, 435, 570)).toEqual({ title: 'Tomorrow morning', right: 'Alarm 7:15' });
    expect(morningRowWords('2026-10-28', FRI, 435, 570).title).toBe('Wednesday morning');
  });
  it('the ISO week', () => {
    expect(isoWeek('2026-10-23').week).toBe(43);
    expect(isoWeek('2026-10-19').key).toBe('2026-W43');
    expect(isoWeek('2026-01-01').key).toBe('2026-W01');
    expect(isoWeek('2027-01-01').key).toBe('2026-W53');
  });
  it('plan words and miles', () => {
    expect(planWords(run(FRI))).toBe('4 mi · floor 20 min easy');
    expect(milesText(5.02)).toBe('5.02');
    expect(milesText(4)).toBe('4');
  });
});
