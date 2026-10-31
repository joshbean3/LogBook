import { MORNING_DEFAULTS, weekSummary, type Activity, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { dayStamps } from './CloseDay';
import { coachSentence, dayPossessive, floorShort, heroLead, heroOf, milesText, nextUp, otherEyebrow, phaseOf, planWords, secondOf } from './faces';
import { isoWeek, weekNote, weekStats } from './WeekCard';

const FRI = '2026-10-23';
const SAT = '2026-10-24';
const run = (date: string, over: Partial<Session> = {}): Session => ({ id: `s-${date}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...over });
const lift = (date: string, over: Partial<Session> = {}): Session => ({ ...run(date), id: `l-${date}`, position: 1, kind: 'lift', type: 'Strength', miles: null, minutes: 45, ...over });
const bundle = (sessions: Session[], activities: Activity[] = []): MonthBundle => ({ month: '2026-10', sessions, checks: [], lifts: [], activities, morningDays: {}, journal: [], coach: [] });
const logOf = (b: MonthBundle, today = FRI): Log => {
  const snap = buildSnapshot({ '2026-10': b }, today);
  return { today, boot: { morningSettings: MORNING_DEFAULTS, habits: [], blocks: [] } as unknown as Log['boot'], habits: [], zones: null, features: { claude: false, strava: false }, strava: null, snap, ready: true, loading: false, loaded: () => true } as Log;
};
const at = (log: Log, date: string, minutes: number) => heroOf(log, date, phaseOf(log, date, minutes));

describe('the hero words (docs/system.md §5: time of day changes words, never layout)', () => {
  const log = logOf(bundle([run(FRI), run(SAT, { type: 'Threshold', miles: 6 }), run('2026-10-11', { type: 'Easy', miles: 6 })]));
  it('today before the door: the same layout, the status counts down and opens This morning', () => {
    const w = at(log, FRI, 6 * 60 + 30);
    expect(w.eyebrow).toBe('TODAY’S RUN');
    expect(w.stamp).toBe('Easy 4');
    expect(w.sub).toBe('4 mi · floor 20 min');
    expect(w.status).toMatch(/^Out the door in /);
    expect(w.morning).toBe(true);
    expect(w.mark).toBe('open');
    expect(w.landed).toBeNull();
  });
  it('out the door: Back by; after the morning: Not logged yet', () => {
    const out = at(log, FRI, 7 * 60 + 50);
    expect(out.status).toMatch(/^Back by /);
    const day = at(log, FRI, 12 * 60);
    expect(day.status).toBe('Not logged yet');
    expect(day.morning).toBe(false);
    expect(day.mark).toBe('open');
  });
  it('done by hand: the miles as planned, Done by hand, the Mark done', () => {
    const l2 = logOf(bundle([run(FRI, { mark: 'done' })]));
    const w = at(l2, FRI, 12 * 60);
    expect(w.status).toMatch(/^4 mi · Done by hand/);
    expect(w.mark).toBe('done');
    expect(w.halo).toBe('done');
  });
  it('a run that landed from Strava: Logged, the numbers and the route', () => {
    const a = { id: 'a1', date: FRI, kind: 'run', name: 'Morning Run', time: '07:30', miles: 5.02, movingSec: 2480, elevFt: 30, avgHr: 150, polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@', laps: null } as unknown as Activity;
    const l3 = logOf(bundle([run(FRI, { mark: 'done' })], [a]));
    const w = at(l3, FRI, 12 * 60);
    expect(w.status).toMatch(/^5\.02 mi at \d+:\d\d\. Logged\.$/);
    expect(w.landed?.polyline).toBeTruthy();
    expect(w.landed?.miles).toBe(5.02);
    expect(w.mark).toBe('done');
  });
  it('other days: the weekday owns the eyebrow; behind, Missed; ahead, the door', () => {
    const w = at(log, SAT, 12 * 60);
    expect(w.eyebrow).toBe('TOMORROW’S RUN');
    expect(w.stamp).toBe('Threshold 6');
    expect(w.status).toMatch(/^Out the door /);
    expect(w.mark).toBe('upcoming');
    const m = at(log, '2026-10-11', 12 * 60);
    expect(m.eyebrow).toBe('SUNDAY’S RUN');
    expect(m.status).toBe('Missed');
    expect(m.mark).toBe('missed');
  });
  it('a run skipped: Skipped, whatever the clock says', () => {
    const l = logOf(bundle([run(FRI, { mark: 'skip' }), run(SAT, { type: 'Threshold', miles: 6 })]));
    for (const m of [6 * 60 + 30, 7 * 60 + 50, 12 * 60]) {
      const w = at(l, FRI, m);
      expect(w.status).toBe('Skipped');
      expect(w.eyebrow).toBe('TODAY’S RUN');
      expect(w.mark).toBe('skipped');
    }
  });
  it('a rest day: REST DAY, Rest, what is next, no Mark', () => {
    const l4 = logOf(bundle([run(SAT, { type: 'Long', miles: 4 })]));
    const w = at(l4, FRI, 12 * 60);
    expect(w.eyebrow).toBe('REST DAY');
    expect(w.stamp).toBe('Rest');
    expect(w.sub).toBe('Next: Long 4, tomorrow');
    expect(w.mark).toBeNull();
    expect(nextUp(l4, FRI)?.date).toBe(SAT);
  });
  it('a lift: TODAY’S LIFT', () => {
    const l = logOf(bundle([lift(FRI)]));
    const w = at(l, FRI, 12 * 60);
    expect(w.eyebrow).toBe('TODAY’S LIFT');
    expect(w.sub).toBe('45 min · floor 20 min');
  });
});

describe('the words around the hero', () => {
  it('eyebrows of other days', () => {
    expect(otherEyebrow('2026-10-22', FRI)).toBe('YESTERDAY');
    expect(otherEyebrow('2026-10-24', FRI)).toBe('TOMORROW');
    expect(otherEyebrow('2026-10-28', FRI)).toBe('IN 5 DAYS');
    expect(otherEyebrow('2026-10-11', FRI)).toBe('SUN, OCT 11');
    expect(dayPossessive(FRI, FRI)).toBe('TODAY’S');
    expect(dayPossessive('2026-10-22', FRI)).toBe('YESTERDAY’S');
    expect(dayPossessive('2026-10-28', FRI)).toBe('WEDNESDAY’S');
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
    expect(floorShort(lift(SAT))).toBe('20 min');
  });
  it("the coach's read as the hero says it: its first sentence", () => {
    expect(coachSentence('Even splits, well judged. Hold the last mile next time.')).toBe('Even splits, well judged.');
    expect(coachSentence('  One line without a stop ')).toBe('One line without a stop');
    expect(coachSentence(null)).toBeNull();
  });
  it('the Close sheet stamps: only what happened, at most three; the miles tick from the plan, never from 0', () => {
    const r = dayStamps({ miles: 4.2, planned: 4, lit: 3, habits: 5, doneTodos: 2, openTodos: 1, restDay: false, runShown: true });
    expect(r.stamps.map((s) => s.k)).toEqual(['Mi', 'Habits', 'To-dos']);
    expect(r.stamps[0]!.from).toBe(4);
    expect(r.line).toBeNull();
    const q = dayStamps({ miles: 0, planned: 0, lit: 0, habits: 5, doneTodos: 0, openTodos: 2, restDay: true, runShown: false });
    expect(q.stamps).toEqual([]);
    expect(q.line).toBe('Rest day. 2 to-dos left.');
  });
});

describe('two sessions, and the week row', () => {
  it('a run skipped beside a lift keeps the hero (Skipped); the lift is the second row', () => {
    const l = logOf(bundle([run(SAT, { type: 'Threshold', miles: 6, mark: 'skip' }), lift(SAT)]), SAT);
    const ph = phaseOf(l, SAT, 6 * 60 + 30);
    expect(heroLead(ph)?.session.id).toBe(`s-${SAT}`);
    expect(secondOf(ph, heroLead(ph))?.session.id).toBe(`l-${SAT}`);
    const w = heroOf(l, SAT, ph);
    expect(w.stamp).toBe('Threshold 6');
    expect(w.status).toBe('Skipped');
  });
  it('the week row counts sessions left (a matched run is not one) and says the week in one line', () => {
    const sessions = [run(FRI), run(SAT, { type: 'Threshold', miles: 6 }), lift(SAT), lift('2026-10-25')];
    const l = logOf(bundle(sessions));
    const sum = weekSummary(l.snap, '2026-10-19');
    expect(weekNote(l.snap, sum, FRI, FRI)).toBe('4 sessions to go.');
    expect(weekStats(sum)).toBe('0 of 10 mi · 0 of 2 runs');
    const a = { id: 'a2', date: FRI, kind: 'run', name: 'Run', time: '07:30', miles: 4.1, movingSec: 2000, elevFt: 0, avgHr: null, polyline: null, laps: null } as unknown as Activity;
    const l2 = logOf(bundle(sessions, [a]));
    expect(weekNote(l2.snap, weekSummary(l2.snap, '2026-10-19'), FRI, FRI)).toBe('3 sessions to go.');
  });
});
