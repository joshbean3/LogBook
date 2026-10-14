import { describe, expect, it } from 'vitest';
import { shiftDays } from './dates.js';
import { act, sess, snapOf } from './fixtures.js';
import type { Activity, Session } from './types.js';
import { weekCheck, weekStreak, weekSummary } from './week.js';

const MON = '2026-10-05'; // a past week
const TODAY = '2026-10-14'; // Wednesday

/** A week of four 5-mile runs (Mon, Wed, Fri, Sun) and three rest days; `ran` says which runs happened. */
const week = (monday: string, ran: boolean[] = [true, true, true, true], extra: Partial<Session>[] = []) => {
  const sessions: Session[] = [];
  const acts: Activity[] = [];
  [0, 2, 4, 6].forEach((off, i) => {
    const d = shiftDays(monday, off);
    sessions.push(sess({ id: `r-${d}`, date: d, kind: 'run', type: 'Easy', miles: 5, ...(extra[i] ?? {}) }));
    if (ran[i]) acts.push(act(d, 5));
  });
  [1, 3, 5].forEach((off) => sessions.push(sess({ id: `x-${shiftDays(monday, off)}`, date: shiftDays(monday, off), kind: 'rest' })));
  return { sessions, acts };
};
const merge = (...ws: Array<{ sessions: Session[]; acts: Activity[] }>) => ({ sessions: ws.flatMap((w) => w.sessions), acts: ws.flatMap((w) => w.acts) });

describe('weekCheck: the floor rule', () => {
  it('three sessions kept keeps the week', () => {
    const w = week(MON, [true, true, true, false]);
    // 15 of 20 planned miles (75%) misses the miles rule, but 3 sessions kept
    expect(weekCheck(snapOf(w.sessions, w.acts, TODAY), MON)).toMatchObject({ kept: true, keptSessions: 3, target: 3, plannedMiles: 20, ranMiles: 15 });
  });

  it('two sessions kept, but 80% of the planned miles run, keeps the week', () => {
    const w = week(MON, [true, true, false, false]);
    w.acts = [act(MON, 8), act(shiftDays(MON, 2), 8.2)];
    expect(weekCheck(snapOf(w.sessions, w.acts, TODAY), MON)).toMatchObject({ kept: true, keptSessions: 2 });
  });

  it('two sessions kept and under 80% of the miles does not', () => {
    const w = week(MON, [true, true, false, false]);
    expect(weekCheck(snapOf(w.sessions, w.acts, TODAY), MON)).toMatchObject({ kept: false, keptSessions: 2, target: 3 });
  });

  it('floor counts as kept', () => {
    const w = week(MON, [true, true, false, false], [{}, {}, { mark: 'floor' }]);
    expect(weekCheck(snapOf(w.sessions, w.acts, TODAY), MON).kept).toBe(true);
  });

  it('skipped for illness counts as kept, and its miles are excused; a plain skip does not', () => {
    const sick = week(MON, [true, true, false, false], [{}, {}, { mark: 'sick' }, { mark: 'sick' }]);
    expect(weekCheck(snapOf(sick.sessions, sick.acts, TODAY), MON)).toMatchObject({ kept: true, keptSessions: 4, plannedMiles: 10 });
    const skip = week(MON, [true, true, false, false], [{}, {}, { mark: 'skip' }, { mark: 'skip' }]);
    expect(weekCheck(snapOf(skip.sessions, skip.acts, TODAY), MON)).toMatchObject({ kept: false, keptSessions: 2 });
  });

  it('rest counts: a light week needs only what was planned, an all-rest week is kept', () => {
    const light = [sess({ date: MON, kind: 'run', miles: 4 }), sess({ date: shiftDays(MON, 3), kind: 'lift' }), ...[1, 2, 4, 5, 6].map((o) => sess({ date: shiftDays(MON, o), kind: 'rest' }))];
    expect(weekCheck(snapOf(light, [act(MON, 4)], TODAY, { [shiftDays(MON, 3)]: 4 }), MON)).toMatchObject({ kept: true, target: 2, keptSessions: 2 });
    const allRest = [0, 1, 2, 3, 4, 5, 6].map((o) => sess({ date: shiftDays(MON, o), kind: 'rest' }));
    expect(weekCheck(snapOf(allRest, [], TODAY), MON)).toMatchObject({ kept: true, target: 0 });
  });

  it('with nothing planned, three days of unplanned training keep the week; an empty week does not', () => {
    const acts = [act(MON, 3), act(shiftDays(MON, 2), 3), act(shiftDays(MON, 5), 4), act(shiftDays(MON, 5), 1)];
    expect(weekCheck(snapOf([], acts, TODAY), MON)).toMatchObject({ kept: true, keptSessions: 3, target: 3 });
    expect(weekCheck(snapOf([], acts.slice(0, 2), TODAY), MON).kept).toBe(false);
    expect(weekCheck(snapOf([], [], TODAY), MON).kept).toBe(false);
  });
});

describe('weekStreak', () => {
  // eight past weeks Aug 17 .. Oct 5, one of them (Sep 14) with a single run
  const mondays = Array.from({ length: 8 }, (_, i) => shiftDays('2026-08-17', i * 7));
  const past = merge(...mondays.map((m) => week(m, m === '2026-09-14' ? [true, false, false, false] : undefined)));

  it('counts consecutive kept weeks and "7 of the last 8"', () => {
    const thisWeek = week('2026-10-12', [true, false, false, false]); // Monday ran, Wednesday (today) still open
    const all = merge(past, thisWeek);
    const s = weekStreak(snapOf(all.sessions, all.acts, TODAY));
    // the current week has not met the rule yet: it neither counts nor breaks; Sep 21 .. Oct 5 are 3 kept weeks
    expect(s).toEqual({ weeks: 3, ofLast: { kept: 7, total: 8 } });
  });

  it('the current week counts once it has met the rule', () => {
    const thisWeek = week('2026-10-12', [true, true, true, false]);
    // three runs logged by Wednesday? Put them Mon, Tue, Wed as unplanned extras on top of Monday's planned run
    const S = snapOf([...past.sessions, ...thisWeek.sessions], [...past.acts, act('2026-10-12', 5), act('2026-10-13', 4), act('2026-10-14', 5)], TODAY);
    expect(weekCheck(S, '2026-10-12').kept).toBe(true);
    const s = weekStreak(S, TODAY);
    expect(s.weeks).toBe(4);
    expect(s.ofLast).toEqual({ kept: 7, total: 8 }); // window now Aug 24 .. Oct 12
  });

  it('a new account reads out of the weeks it has', () => {
    const two = merge(week('2026-09-28'), week('2026-10-05'));
    expect(weekStreak(snapOf(two.sessions, two.acts, TODAY))).toEqual({ weeks: 2, ofLast: { kept: 2, total: 2 } });
    expect(weekStreak(snapOf([], [], TODAY))).toEqual({ weeks: 0, ofLast: { kept: 0, total: 0 } });
  });

  it('a missed last week ends the streak at zero but the window remembers', () => {
    const w = merge(past, week('2026-10-05', [false, false, false, false]));
    // replace Oct 5 with a missed week
    const sessions = w.sessions.filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
    const acts = w.acts.filter((a) => a.date < '2026-10-05' || a.date > '2026-10-11');
    expect(weekStreak(snapOf(sessions, acts, TODAY))).toEqual({ weeks: 0, ofLast: { kept: 6, total: 8 } });
  });
});

describe('weekSummary', () => {
  it('gives the ring seven segments and the week numbers', () => {
    const sessions = [
      sess({ id: 'm', date: '2026-10-12', kind: 'run', type: 'Easy', miles: 5 }),
      sess({ id: 't', date: '2026-10-13', kind: 'run', type: 'Speed', miles: 5 }),
      sess({ id: 't2', date: '2026-10-13', kind: 'lift' }),
      sess({ id: 'w', date: '2026-10-14', kind: 'run', type: 'Easy', miles: 4 }),
      sess({ id: 'th', date: '2026-10-15', kind: 'rest' }),
      sess({ id: 'f', date: '2026-10-16', kind: 'run', miles: 6, mark: 'skip' }),
      sess({ id: 's', date: '2026-10-17', kind: 'run', type: 'Long', miles: 10 }),
    ];
    const S = snapOf(sessions, [act('2026-10-12', 5.2), act('2026-10-13', 2)], TODAY, { '2026-10-13': 3 });
    const w = weekSummary(S, '2026-10-14'); // any day of the week works
    expect(w.weekStart).toBe('2026-10-12');
    expect(w.days.map((d) => d.ring)).toEqual(['done', 'floor', 'future', 'rest', 'rest', 'future', 'rest']);
    expect(w.days.map((d) => d.word)).toEqual(['Done', 'Floor', 'Today', 'Rest', 'Skipped', 'Planned', 'Rest']);
    expect(w).toMatchObject({ plannedMiles: 24, doneMiles: 7.2, runsPlanned: 4, runsDone: 2, keptSessions: 3, kept: true });
  });

  it('counts a run on an unplanned day as a run done', () => {
    const S = snapOf([sess({ date: '2026-10-05', kind: 'run', miles: 5 })], [act('2026-10-05', 5), act('2026-10-07', 3)], TODAY);
    const w = weekSummary(S, MON);
    expect(w).toMatchObject({ runsPlanned: 1, runsDone: 2, plannedMiles: 5, doneMiles: 8 });
    expect(w.days[2]).toMatchObject({ ring: 'done', word: 'Bonus' });
    expect(w.days[1]).toMatchObject({ ring: 'rest', word: 'Rest' });
  });
});
