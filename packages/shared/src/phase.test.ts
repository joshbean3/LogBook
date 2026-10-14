import { describe, expect, it } from 'vitest';
import { act, sess, snapOf } from './fixtures.js';
import { MORNING_DEFAULTS } from './morning.js';
import { dayPhase, EVENING_START } from './phase.js';

// MORNING_DEFAULTS: alarm 7:20 (440). Run: 15 min wake-up, door 7:35 (455), run at 9:00/mi, 5 min cool-down.
// Easy 5 = 45 min: run 7:40–8:25, back 8:30 (510). Shower fixed 8:40, leave 9:30 (570).
const T = '2026-10-14';
const easy5 = sess({ id: 'e5', date: T, kind: 'run', type: 'Easy', miles: 5 });
const at = (h: number, m = 0) => ({ date: T, minutes: h * 60 + m });
const ctx = (sessions = [easy5], acts: ReturnType<typeof act>[] = [], sets: Record<string, number> = {}, settings: typeof MORNING_DEFAULTS | null = MORNING_DEFAULTS) => ({
  date: T,
  snapshot: snapOf(sessions, acts, T, sets),
  settings,
});

describe('dayPhase', () => {
  it('morning: counts down to the door and carries the timeline times', () => {
    const p = dayPhase(at(6, 30), ctx());
    expect(p.phase).toBe('morning');
    expect(p.doorIn).toBe(65);
    expect(p).toMatchObject({ mode: 'run', wakeAt: 440, doorAt: 455, backBy: 510, leaveAt: 570, word: 'Today', key: 'today' });
    expect(p.primary?.session).toBe(easy5);
    expect(dayPhase(at(4, 0), ctx()).phase).toBe('morning'); // before the alarm too
  });

  it('door boundary: one minute before is morning (1 min), exactly at the door is out', () => {
    expect(dayPhase(at(7, 34), ctx())).toMatchObject({ phase: 'morning', doorIn: 1 });
    expect(dayPhase({ date: T, minutes: 454.5 }, ctx())).toMatchObject({ phase: 'morning', doorIn: 1 });
    const p = dayPhase(at(7, 35), ctx());
    expect(p.phase).toBe('out');
    expect(p.doorIn).toBeUndefined();
    expect(p.outProgress).toBe(0);
  });

  it('out until back, then day', () => {
    expect(dayPhase(at(8, 0), ctx())).toMatchObject({ phase: 'out', backBy: 510 });
    expect(dayPhase(at(8, 0), ctx()).outProgress).toBeCloseTo(25 / 55, 5);
    expect(dayPhase(at(8, 29), ctx()).phase).toBe('out');
    expect(dayPhase(at(8, 30), ctx()).phase).toBe('day');
    expect(dayPhase(at(12, 0), ctx())).toMatchObject({ phase: 'day', word: 'Today' });
  });

  it('a run done early skips straight to day', () => {
    const p = dayPhase(at(7, 0), ctx([easy5], [act(T, 5.1)]));
    expect(p).toMatchObject({ phase: 'day', word: 'Done' });
    expect(p.doorIn).toBeUndefined();
    // during what would have been "out"
    expect(dayPhase(at(8, 0), ctx([easy5], [act(T, 5.1)])).phase).toBe('day');
    // a short run is the floor: still kept, still day
    expect(dayPhase(at(8, 0), ctx([easy5], [act(T, 2)]))).toMatchObject({ phase: 'day', word: 'Floor' });
    // a tap on Done counts the same
    expect(dayPhase(at(6, 0), ctx([{ ...easy5, mark: 'done' }])).phase).toBe('day');
  });

  it('evening starts at 18:00 exactly', () => {
    expect(EVENING_START).toBe(1080);
    expect(dayPhase(at(17, 59), ctx()).phase).toBe('day');
    expect(dayPhase(at(18, 0), ctx()).phase).toBe('evening');
    expect(dayPhase(at(23, 59), ctx([easy5], [act(T, 5)]))).toMatchObject({ phase: 'evening', word: 'Done' });
  });

  it('two sessions: the run leads, both are listed with their own words, the hero can page between them', () => {
    const lift = sess({ id: 'l', date: T, kind: 'lift', type: 'Strength', title: 'Strength', position: 0 });
    const run = { ...easy5, position: 1 };
    const morning = dayPhase(at(6, 0), ctx([lift, run]));
    expect(morning.phase).toBe('morning');
    expect(morning.primary?.session).toBe(run);
    expect(morning.training.map((x) => x.session.id)).toEqual(['e5', 'l']);
    expect(morning.sessions.map((x) => x.session.id)).toEqual(['l', 'e5']);
    // run done, lift still to do: day, and the lift still reads Today
    const later = dayPhase(at(9, 0), ctx([lift, run], [act(T, 5)]));
    expect(later.phase).toBe('day');
    expect(later.word).toBe('Done');
    expect(later.sessions.find((x) => x.session.id === 'l')?.word).toBe('Today');
    expect(dayPhase(at(19, 0), ctx([lift, run], [act(T, 5)])).phase).toBe('evening');
  });

  it('rest day: rest until 18:00, then evening; no door, still a leave time', () => {
    const rest = sess({ id: 'r', date: T, kind: 'rest', type: 'Rest', title: 'Rest' });
    const p = dayPhase(at(6, 30), ctx([rest]));
    expect(p).toMatchObject({ phase: 'rest', mode: 'rest', word: 'Rest', leaveAt: 570, wakeAt: 440 });
    expect(p.doorAt).toBeUndefined();
    expect(p.backBy).toBeUndefined();
    expect(p.training).toEqual([]);
    expect(dayPhase(at(17, 59), ctx([rest])).phase).toBe('rest');
    expect(dayPhase(at(18, 0), ctx([rest])).phase).toBe('evening');
    // nothing planned is a rest day too
    expect(dayPhase(at(10, 0), ctx([]))).toMatchObject({ phase: 'rest', word: 'Rest', primary: null });
    expect(dayPhase(at(20, 0), ctx([])).phase).toBe('evening');
    // a run with nothing planned: still rest by the plan, but the word is Bonus
    expect(dayPhase(at(10, 0), ctx([], [act(T, 3)]))).toMatchObject({ phase: 'rest', word: 'Bonus' });
    // a skipped session leaves a rest day
    expect(dayPhase(at(6, 30), ctx([{ ...easy5, mark: 'skip' }]))).toMatchObject({ phase: 'rest', word: 'Skipped', mode: 'rest' });
  });

  it('gym morning: the door is the walk to the gym, back after the walk home; logged sets finish it', () => {
    const lift = sess({ id: 'l', date: T, kind: 'lift', type: 'Strength', title: 'Strength' });
    // 7:20 alarm, 15 min wake-up, walk 7:35–7:45, gym 40 min to 8:25, walk home to 8:35
    const p = dayPhase(at(7, 0), ctx([lift]));
    expect(p).toMatchObject({ phase: 'morning', mode: 'gym', doorAt: 455, backBy: 515, doorIn: 35 });
    expect(dayPhase(at(8, 34), ctx([lift])).phase).toBe('out');
    expect(dayPhase(at(8, 35), ctx([lift])).phase).toBe('day');
    expect(dayPhase(at(8, 0), ctx([lift], [], { [T]: 3 }))).toMatchObject({ phase: 'day', word: 'Done' });
  });

  it('no morning settings: no countdown, the clock alone decides day/evening', () => {
    const p = dayPhase(at(6, 30), ctx([easy5], [], {}, null));
    expect(p).toMatchObject({ phase: 'day', mode: null, word: 'Today' });
    expect(p.doorAt).toBeUndefined();
    expect(p.leaveAt).toBeUndefined();
    expect(dayPhase(at(18, 0), ctx([easy5], [], {}, null)).phase).toBe('evening');
  });

  it('a morning made into a rest day keeps the run for later: day, no door', () => {
    const p = dayPhase(at(6, 30), { ...ctx(), override: { mode: 'rest', type: 'Rest', miles: 5, minutes: 40, wake: 480 } });
    expect(p).toMatchObject({ phase: 'day', mode: 'rest', wakeAt: 480, word: 'Today' });
    expect(p.doorAt).toBeUndefined();
  });

  it('an override with a later alarm moves the door', () => {
    const p = dayPhase(at(7, 0), { ...ctx(), override: { mode: 'run', type: 'Easy', miles: 5, minutes: 40, wake: 480 } });
    expect(p).toMatchObject({ phase: 'morning', doorAt: 495, doorIn: 75 });
  });

  it('other days are past or future, with their words', () => {
    const past = dayPhase({ date: '2026-10-15', minutes: 600 }, ctx());
    expect(past).toMatchObject({ phase: 'past', word: 'Today' }); // the snapshot still says Oct 14 is today
    const S = snapOf([sess({ id: 'y', date: '2026-10-13', kind: 'run', miles: 5 }), sess({ id: 'z', date: '2026-10-16', kind: 'run', miles: 5 })], [], T);
    expect(dayPhase(at(9), { date: '2026-10-13', snapshot: S, settings: MORNING_DEFAULTS })).toMatchObject({ phase: 'past', word: 'Missed', doorAt: 455 });
    expect(dayPhase(at(9), { date: '2026-10-16', snapshot: S, settings: MORNING_DEFAULTS })).toMatchObject({ phase: 'future', word: 'Planned' });
  });

  it('takes a Date and reads its local clock', () => {
    const p = dayPhase(new Date(2026, 9, 14, 6, 30), ctx());
    expect(p).toMatchObject({ phase: 'morning', doorIn: 65, now: 390 });
    expect(dayPhase(new Date(2026, 9, 14, 7, 35, 0), ctx()).phase).toBe('out');
    expect(dayPhase(new Date(2026, 9, 14, 7, 34, 30), ctx())).toMatchObject({ phase: 'morning', doorIn: 1 });
  });
});
