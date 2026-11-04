import { MORNING_DEFAULTS, type Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { morningOf, nowLine } from '../morning/model';
import { cardStops, gapsOf, headline, nowOnTrack, quietLine, trackOf, whichMorning, workOf } from './morningCard';

const sess = (p: Partial<Session> & Pick<Session, 'date' | 'kind'>): Session => ({ id: `s-${p.date}-${p.kind}`, position: 0, type: null, title: null, details: null, miles: null, minutes: null, blockId: null, movedFrom: null, mark: null, ...p });
// MORNING_DEFAULTS: alarm 7:20, Easy 5 at 9:00/mi (out 7:35, back 8:30), the routine fixed at 8:40, leave 9:30
const RUN = morningOf([sess({ date: '2026-11-04', kind: 'run', type: 'Easy', miles: 5 })], null, MORNING_DEFAULTS);
const REST = morningOf([], null, MORNING_DEFAULTS);

describe('which morning Plan shows', () => {
  it("today's until its leave time has passed, then tomorrow's", () => {
    expect(whichMorning('2026-11-04', 300, 570)).toEqual({ date: '2026-11-04', rel: 'today' });
    expect(whichMorning('2026-11-04', 569.5, 570)).toEqual({ date: '2026-11-04', rel: 'today' });
    expect(whichMorning('2026-11-04', 570, 570)).toEqual({ date: '2026-11-05', rel: 'tomorrow' });
    expect(whichMorning('2026-11-30', 1200, 570)).toEqual({ date: '2026-12-01', rel: 'tomorrow' });
  });
  it("today's while today's morning is not known yet", () => {
    expect(whichMorning('2026-11-04', 1200, null).rel).toBe('today');
  });
});

describe('the stops on the track', () => {
  it('a run morning: Wake · Run out · Back · Leave', () => {
    expect(cardStops(RUN).map((s) => [s.key, s.label, s.short, s.at])).toEqual([
      ['wake', 'Wake', 'Wake', 440],
      ['door', 'Run out', 'Out', 455],
      ['back', 'Back', 'Back', 510],
      ['leave', 'Leave', 'Leave', 570],
    ]);
  });
  it('a rest morning: Wake · Leave', () => {
    expect(cardStops(REST).map((s) => s.key)).toEqual(['wake', 'leave']);
  });
  it('sit in proportion to time, but never closer than their gap (the run keeps room for its name)', () => {
    const stops = cardStops(RUN);
    expect(gapsOf(stops)).toEqual([0.2, 0.34, 0.2]);
    expect(trackOf(stops.map((s) => s.at), gapsOf(stops))).toEqual([0, 0.2, 0.54, 1]);
    expect(trackOf([0, 50, 60, 100], [0.2, 0.2, 0.2])).toEqual([0, 0.5, 0.7, 1]);
    expect(trackOf([0, 1, 2, 100], [0.2, 0.2, 0.2])).toEqual([0, 0.2, 0.4, 1]);
    expect(trackOf([0, 98, 99, 100], [0.2, 0.2, 0.2])).toEqual([0, 0.6, 0.8, 1]);
    expect(trackOf([440, 570], gapsOf(cardStops(REST)))).toEqual([0, 1]);
  });
  it('are evenly spaced when the gaps cannot all fit', () => {
    expect(trackOf([0, 10, 20, 100], [0.5, 0.5, 0.5])).toEqual([0, 1 / 3, 2 / 3, 1].map((x) => Math.round(x * 1e4) / 1e4));
  });
  it('carry the now dot in proportion within the stretch it is in, and none outside the morning', () => {
    const stops = cardStops(RUN);
    const pos = trackOf(stops.map((s) => s.at), gapsOf(stops));
    expect(nowOnTrack(stops, pos, 482.5)).toBeCloseTo(0.37);
    expect(nowOnTrack(stops, pos, 440)).toBe(0);
    expect(nowOnTrack(stops, pos, 570)).toBe(1);
    expect(nowOnTrack(stops, pos, 400)).toBeNull();
    expect(nowOnTrack(stops, pos, 600)).toBeNull();
  });
});

describe('the words', () => {
  it("today's big line follows the morning's phase", () => {
    expect(headline(RUN, 400, 'today')).toBe('Alarm in 40 min');
    expect(headline(RUN, 445, 'today')).toBe('Out the door in 10 min');
    expect(headline(RUN, 480, 'today')).toBe('Back by 8:30');
    expect(headline(RUN, 530, 'today')).toBe('Leave for work in 40 min');
    expect(headline(RUN, 575, 'today')).toBe('Left at 9:30');
    expect(headline(REST, 460, 'today')).toBe('Leave for work in 1 h 50 min');
  });
  it("tomorrow's says when it starts", () => {
    expect(headline(RUN, 1200, 'tomorrow')).toBe('Out the door at 7:35');
    expect(headline(REST, 1200, 'tomorrow')).toBe('Leave for work at 9:30');
  });
  it('the Now card line is unchanged by the shared phase rule', () => {
    expect(nowLine(RUN, 445, 'today')).toBe('Out the door in 10 min');
    expect(nowLine(RUN, 515, 'today')).toBe('Free until 8:40 · Leave in 55 min');
    expect(nowLine(RUN, 525, 'today')).toBe('Shower now · Leave in 45 min');
    expect(nowLine(RUN, 575, 'today')).toBe('Left 9:30');
  });
  it('the workout and the quiet line', () => {
    expect(workOf(RUN)).toEqual({ name: 'Easy 5', tone: 'easy' });
    expect(workOf(REST)).toEqual({ name: 'Rest morning', tone: 'rest' });
    expect(quietLine(RUN)).toBe('6 steps · 2 h 10 min from alarm to door');
    expect(quietLine(REST)).toBe('5 steps · 2 h 10 min from alarm to door');
  });
});
