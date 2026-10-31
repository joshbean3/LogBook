import { MORNING_DEFAULTS, weekSummary, type Activity, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { dayStamps } from './CloseDay';
import { coachSentence, faceOf, floorShort, heroLead, milesText, otherEyebrow, phaseOf, planWords, preLandingFace, secondOf } from './faces';
import { morningRowWords } from './MorningRow';
import { isoWeek, weekNote } from './WeekCard';

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
    expect(f.line).toBe('4 mi · floor 20 min');
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
  it('a run skipped before the door keeps THIS MORNING through Leave, never OUT; after Leave a new face key (day review 2 #2)', () => {
    const l = logOf(bundle([run(FRI, { mark: 'skip' }), run('2026-10-24', { type: 'Threshold', miles: 6 })]));
    const at = (m: number) => faceOf(l, FRI, phaseOf(l, FRI, m));
    const a = at(6 * 60 + 30);
    const b = at(7 * 60 + 50);
    const c = at(8 * 60 + 45);
    for (const f of [a, b, c]) {
      expect(f.kind).toBe('skipped');
      expect(f.eyebrow).toBe('THIS MORNING');
      expect(f.line).toBe('Skipped.');
    }
    // the door passing changes nothing on the card
    expect(b.key).toBe(a.key);
    const d = at(12 * 60);
    expect(d.eyebrow).toBe('TODAY’S RUN');
    expect(d.stops).toBeUndefined();
    // the deck's change at Leave goes through the deferred crossfade: its own key
    expect(d.key).not.toBe(a.key);
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
    expect(planWords(run(FRI))).toBe('4 mi · floor 20 min');
    expect(milesText(5.02)).toBe('5.02');
    expect(milesText(4)).toBe('4');
  });
});

describe('the run landing and the Close card (docs/feel.md §5, §6)', () => {
  const act: Activity = { id: 'a1', date: FRI, time: '12:05', name: 'Run', sportType: 'Run', kind: 'run', miles: 4.2, movingSec: 2100, elevFt: 0, avgHr: null, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: 'gp~wFrqmbMsAqBiAuBu@sBc@sBKmBLgBb@{A|@oA' } as unknown as Activity;
  it('a matched run lands on the 304 face; before it, the day showed the open face with its ring', () => {
    const log = logOf(bundle([run(FRI)], [act]));
    const f = faceOf(log, FRI, phaseOf(log, FRI, 13 * 60));
    expect(f.kind).toBe('landed');
    expect(f.tall).toBe(true);
    const pre = preLandingFace(log, FRI, 13 * 60);
    expect(pre.kind).toBe('open');
    expect(pre.ring).toBe('open');
    expect(pre.lead?.session.id).toBe(f.lead?.session.id);
  });
  it("the coach's read as the hero says it: its first sentence", () => {
    expect(coachSentence('Even splits, well judged. Hold the last mile next time.')).toBe('Even splits, well judged.');
    expect(coachSentence('  One line without a stop ')).toBe('One line without a stop');
    expect(coachSentence(null)).toBeNull();
  });
  it('the Close card stamps: only what happened, at most three; the miles tick from the plan, never from 0', () => {
    const r = dayStamps({ miles: 4.2, planned: 4, lit: 3, habits: 5, doneTodos: 2, openTodos: 1, restDay: false, runShown: true });
    expect(r.stamps.map((s) => s.k)).toEqual(['Mi', 'Habits', 'To-dos']);
    expect(r.stamps[0]!.from).toBe(4);
    expect(r.line).toBeNull();
    const q = dayStamps({ miles: 0, planned: 0, lit: 0, habits: 5, doneTodos: 0, openTodos: 2, restDay: true, runShown: false });
    expect(q.stamps).toEqual([]);
    expect(q.line).toBe('Rest day. 2 to-dos left.');
  });
});

describe('fix round 1: Skip on two sessions, the floor words, the week card count', () => {
  const SAT = '2026-10-24';
  const lift = (date: string, over: Partial<Session> = {}): Session => ({ ...run(date), id: `l-${date}`, position: 1, kind: 'lift', type: 'Strength', miles: null, minutes: 45, ...over });
  it('a run skipped beside a lift keeps the hero (Skipped., the morning eyebrow); the lift is the second card', () => {
    const l = logOf(bundle([run(SAT, { type: 'Threshold', miles: 6, mark: 'skip' }), lift(SAT)]), SAT);
    const ph = phaseOf(l, SAT, 6 * 60 + 30);
    expect(heroLead(ph)?.session.id).toBe(`s-${SAT}`);
    expect(secondOf(ph, heroLead(ph))?.session.id).toBe(`l-${SAT}`);
    const f = faceOf(l, SAT, ph);
    expect(f.kind).toBe('skipped');
    expect(f.stamp).toBe('THRESHOLD 6');
    expect(f.line).toBe('Skipped.');
    expect(f.eyebrow).toBe('THIS MORNING');
  });
  it('the floor on the hero is its minutes only', () => {
    expect(planWords(run(SAT, { type: 'Threshold', miles: 6 }))).toBe('6 mi · floor 20 min');
    expect(floorShort(lift(SAT))).toBe('20 min');
  });
  it('the week card counts sessions left (a matched run is not one)', () => {
    const sessions = [run(FRI), run(SAT, { type: 'Threshold', miles: 6 }), lift(SAT), lift('2026-10-25')];
    const l = logOf(bundle(sessions));
    expect(weekNote(l.snap, weekSummary(l.snap, '2026-10-19'), FRI, FRI)).toBe('4 sessions to go.');
    const a = { id: 'a2', date: FRI, kind: 'run', name: 'Run', time: '07:30', miles: 4.1, movingSec: 2000, elevFt: 0, avgHr: null, polyline: null, laps: null } as unknown as Activity;
    const l2 = logOf(bundle(sessions, [a]));
    expect(weekNote(l2.snap, weekSummary(l2.snap, '2026-10-19'), FRI, FRI)).toBe('3 sessions to go.');
  });
});
