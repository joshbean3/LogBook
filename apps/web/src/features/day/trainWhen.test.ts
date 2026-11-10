import { MORNING_DEFAULTS, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import type { Log } from '../log/useLog';
import { afternoonStops, DEFAULT_AFTERNOON, faceForWhen, phaseForWhen, sessionMinutes, whenFace, type TrainWhen } from './trainWhen';
import { faceName, phaseOf, planWords, whenFaceKinds, type Face } from './faces';
import { parseOffWork } from './WhenPill';

describe('when you train', () => {
  it('builds the afternoon from the end of work, the way home and the run’s length', () => {
    const s = afternoonStops(DEFAULT_AFTERNOON, 40);
    expect(s.map((x) => x.label)).toEqual(['Off work', 'Run', 'Back', 'Dinner']);
    expect(s.map((x) => x.at)).toEqual([1050, 1090, 1130, 1160]);
  });
  it('times a run from its minutes, else its miles at the easy pace', () => {
    expect(sessionMinutes({ minutes: 50, miles: 4 }, 540)).toBe(50);
    expect(sessionMinutes({ minutes: null, miles: 4 }, 540)).toBe(36);
    expect(sessionMinutes(null, 540)).toBe(45);
  });
  const face = { key: 'm', kind: 'morning', eyebrow: 'THIS MORNING', stamp: 'EASY 4', line: 'Out the door in 20 min', stops: [{ key: 'wake', label: 'Wake', at: 390 }], stopsLabel: 'x', lead: { session: { kind: 'run', miles: 4, minutes: null } } } as unknown as Face;
  it('swaps in the afternoon’s line on a training day', () => {
    const f = faceForWhen(face, 'afternoon', DEFAULT_AFTERNOON, 540);
    expect(f.stopsKind).toBe('afternoon');
    expect(f.stops?.[1]?.label).toBe('Run');
    expect(f.line).toMatch(/^Run at /);
  });
  it('hides the line for no set time, and leaves morning as planned', () => {
    expect(faceForWhen(face, 'none', DEFAULT_AFTERNOON, 540).stops).toBeUndefined();
    expect(faceForWhen(face, 'morning', DEFAULT_AFTERNOON, 540)).toBe(face);
  });
  it('never touches a rest day', () => {
    const rest = { ...face, lead: undefined } as unknown as Face;
    expect(faceForWhen(rest, 'afternoon', DEFAULT_AFTERNOON, 540)).toBe(rest);
  });
});

/*
 * today-top-02: the choice feeds the day's phase. MORNING_DEFAULTS puts the morning's door at 7:35 and its back at 8:21 for
 * Easy 4; the default afternoon is off work 5:30, run 6:10, back 6:46 (4 mi at 9:00), dinner 7:16.
 */
describe('the phase follows when you train', () => {
  const FRI = '2026-10-23';
  const run = (over: Partial<Session> = {}): Session => ({ id: 's1', date: FRI, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...over });
  const logOf = (sessions: Session[]): Log => {
    const b: MonthBundle = { month: '2026-10', sessions, checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] };
    return { today: FRI, boot: { morningSettings: MORNING_DEFAULTS, habits: [], blocks: [{ id: 'b1', name: 'Plan', start: '2026-10-01', end: '2026-12-31' }] } as unknown as Log['boot'], habits: [], zones: null, features: { claude: false, strava: false }, strava: null, snap: buildSnapshot({ '2026-10': b }, FRI), ready: true, loading: false, loaded: () => true } as Log;
  };
  const open = logOf([run()]);
  const at = (h: number, m = 0) => h * 60 + m;
  const kind = (log: Log, when: TrainWhen, minutes: number) => whenFace(log, FRI, minutes, when, DEFAULT_AFTERNOON).face.kind;

  it('Morning: before the door, the open face at noon, the Close card at 18:05 (as before)', () => {
    expect(kind(open, 'morning', at(7))).toBe('morning');
    expect(kind(open, 'morning', at(7, 40))).toBe('out');
    expect(kind(open, 'morning', at(12))).toBe('open');
    expect(kind(open, 'morning', at(18, 5))).toBe('evening');
    // the wrapper hands the shared phase back untouched
    const ph = phaseOf(open, FRI, at(7));
    expect(phaseForWhen(ph, 'morning', DEFAULT_AFTERNOON, 540)).toBe(ph);
  });

  it('Afternoon: never the morning OUT face; the afternoon line until the run', () => {
    for (const m of [at(7), at(7, 10), at(7, 40), at(12), at(18, 5)]) {
      const { face, ph } = whenFace(open, FRI, m, 'afternoon', DEFAULT_AFTERNOON);
      expect(face.kind).toBe('later');
      expect(face.eyebrow).not.toBe('OUT');
      expect(face.line).toBe('Run at 6:10');
      expect(face.stops?.map((s) => s.label)).toEqual(['Off work', 'Run', 'Back', 'Dinner']);
      expect(face.ring).toBeNull();
      // no morning door left to count down to
      expect(ph.doorAt).toBe(18 * 60 + 10);
    }
  });

  it('Afternoon: the evening card waits until the session is past or marked', () => {
    // 18:05, five minutes before the run: still the session's card
    expect(kind(open, 'afternoon', at(18, 5))).not.toBe('evening');
    // out from Run to Back, on the afternoon's own times, with no "Leave" under it
    const out = whenFace(open, FRI, at(18, 20), 'afternoon', DEFAULT_AFTERNOON).face;
    expect(out.kind).toBe('out');
    expect(out.line).toBe('Back by 6:46');
    expect(out.out?.sub).toBeNull();
    // back, not yet dinner: the open face and its ring, nothing over it
    const back = whenFace(open, FRI, at(19), 'afternoon', DEFAULT_AFTERNOON).face;
    expect(back.kind).toBe('open');
    expect(back.ring).toBe('open');
    expect(back.stops).toBeUndefined();
    // past dinner: the day closes
    expect(kind(open, 'afternoon', at(19, 20))).toBe('evening');
    // marked done at 18:05: the day closes at once
    expect(kind(logOf([run({ mark: 'done' })]), 'afternoon', at(18, 5))).toBe('evening');
    expect(kind(logOf([run({ mark: 'skip' })]), 'afternoon', at(18, 5))).toBe('evening');
  });

  it('No set time: the open face all day, never OUT, the Close card from 18:00 with the session still in it', () => {
    for (const m of [at(7), at(7, 40), at(12)]) {
      const { face, ph } = whenFace(open, FRI, m, 'none', DEFAULT_AFTERNOON);
      expect(face.kind).toBe('open');
      expect(face.status).toBe('Any time today');
      expect(face.ring).toBe('open');
      expect(face.stops).toBeUndefined();
      expect(ph.doorAt).toBeUndefined();
      expect(ph.backBy).toBeUndefined();
    }
    const eve = whenFace(open, FRI, at(18, 5), 'none', DEFAULT_AFTERNOON);
    expect(eve.face.kind).toBe('evening');
    // the Close card's run row reads this list: the open session is still there to mark
    expect(eve.ph.training.map((p) => p.key)).toEqual(['today']);
  });

  it('a settled session keeps its own face whatever the choice', () => {
    for (const when of ['afternoon', 'none'] as const) {
      const done = whenFace(logOf([run({ mark: 'done' })]), FRI, at(12), when, DEFAULT_AFTERNOON).face;
      expect(done.kind).toBe('doneHand');
      expect(done.stops).toBeUndefined();
      const skipped = whenFace(logOf([run({ mark: 'skip' })]), FRI, at(12), when, DEFAULT_AFTERNOON).face;
      expect(skipped.kind).toBe('skipped');
      expect(skipped.stopsKind).toBeUndefined();
    }
  });

  it('the When switch shows only while the session is still to come (today-top-01)', () => {
    const shown = (log: Log, m: number) => whenFaceKinds.has(whenFace(log, FRI, m, 'morning', DEFAULT_AFTERNOON).face.kind);
    expect(shown(open, at(7))).toBe(true); // morning
    expect(shown(open, at(7, 40))).toBe(true); // out
    expect(shown(open, at(12))).toBe(true); // open
    expect(shown(logOf([run({ mark: 'done' })]), at(12))).toBe(false);
    expect(shown(logOf([run({ mark: 'floor' })]), at(12))).toBe(false);
    expect(shown(logOf([run({ mark: 'skip' })]), at(12))).toBe(false);
    // yesterday's run, never done: missed
    const missed = logOf([run({ id: 's0', date: '2026-10-22' })]);
    expect(whenFaceKinds.has(whenFace(missed, '2026-10-22', at(12), 'morning', DEFAULT_AFTERNOON).face.kind)).toBe(false);
  });

  it('the card is named for what it is about; "Open" belongs to the title button (a11y-07)', () => {
    expect(faceName(whenFace(open, FRI, at(12), 'morning', DEFAULT_AFTERNOON).face)).toBe('Easy 4, Today');
    const rest = whenFace(logOf([]), FRI, at(12), 'morning', DEFAULT_AFTERNOON).face;
    expect(faceName(rest)).toBe('Rest day');
    expect(rest.pressable).toBe(false);
  });

  it('another day keeps the shared phase; its plan line says when', () => {
    const next = logOf([run({ id: 's2', date: '2026-10-24' })]);
    const f = whenFace(next, '2026-10-24', at(12), 'afternoon', DEFAULT_AFTERNOON);
    expect(f.ph.phase).toBe('future');
    expect(f.face.kind).toBe('planned');
    expect(f.face.line).toBe('Run at 6:10');
    expect(whenFace(next, '2026-10-24', at(12), 'none', DEFAULT_AFTERNOON).face.line).toBe('Any time that day');
  });
});

describe('words for the session’s kind (today-top-06)', () => {
  const lift = { key: 'm', kind: 'morning', eyebrow: 'THIS MORNING', stamp: 'STRENGTH A', line: 'Out the door in 20 min', stops: [{ key: 'wake', label: 'Wake', at: 390 }], stopsLabel: 'x', lead: { session: { kind: 'lift', miles: null, minutes: 40 } } } as unknown as Face;
  const cross = { ...lift, stamp: 'BIKE 40', lead: { session: { kind: 'cross', miles: null, minutes: 40 } } } as unknown as Face;
  it('a strength day lifts at its time and its stop says Lift', () => {
    const f = faceForWhen(lift, 'afternoon', DEFAULT_AFTERNOON, 540);
    expect(f.line).toMatch(/^Lift at /);
    expect(f.stops?.map((s) => s.label)).toEqual(['Off work', 'Lift', 'Back', 'Dinner']);
    expect(JSON.stringify(f)).not.toMatch(/Run/);
  });
  it('a cross day has no morning line to move: the choice changes nothing', () => {
    expect(faceForWhen(cross, 'afternoon', DEFAULT_AFTERNOON, 540)).toBe(cross);
  });
  it('a plan line with no miles or minutes is still a whole line', () => {
    expect(planWords({ id: 'x', date: '2026-10-23', position: 0, kind: 'lift', type: 'Strength', title: 'Strength A', details: null, miles: null, minutes: null, blockId: null, movedFrom: null, mark: null } as Session)).toBe('Floor 20 min');
  });
});

describe('a typed end of work (today-top-22)', () => {
  it('reads h:mm, bare hours, digits and AM or PM; an hour before 11 is the afternoon', () => {
    expect(parseOffWork('6:00')).toBe(18 * 60);
    expect(parseOffWork('5.30')).toBe(17 * 60 + 30);
    expect(parseOffWork('530')).toBe(17 * 60 + 30);
    expect(parseOffWork('18:15')).toBe(18 * 60 + 15);
    expect(parseOffWork('6 pm')).toBe(18 * 60);
    expect(parseOffWork('11:30am')).toBe(11 * 60 + 30);
    expect(parseOffWork('12')).toBe(12 * 60);
    expect(parseOffWork('soon')).toBeNull();
    expect(parseOffWork('25:00')).toBeNull();
  });
});
