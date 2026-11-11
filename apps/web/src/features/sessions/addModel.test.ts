import type { Session } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { addedWords, buildSession, dayWords, defaultDay, liftChoices, milesFor, minutesFor, type AddHistory } from './addModel';

// Wednesday, November 11, 2026: the week is Nov 9 to 15
const TODAY = '2026-11-11';
const MON = '2026-11-09';
const sess = (date: string, over: Partial<Session> = {}): Session => ({ id: `s-${date}-${over.type ?? over.title ?? 'x'}`, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...over });
const on = (list: Session[]) => (d: string) => list.filter((s) => s.date === d);
const none: AddHistory = { recent: [], runs: [], profile: null, pace: null };

describe('the day the sheet opens on', () => {
  it('is the tapped day when it was started from a day', () => {
    expect(defaultDay(on([]), MON, TODAY, '2026-11-13')).toBe('2026-11-13');
    expect(defaultDay(on([]), '2026-11-16', TODAY, '2026-11-20')).toBe('2026-11-20');
  });
  it('is today in this week, whatever today already holds', () => {
    expect(defaultDay(on([]), MON, TODAY)).toBe(TODAY);
    expect(defaultDay(on([sess(TODAY)]), MON, TODAY)).toBe(TODAY);
  });
  it('is the first open day of a later week, so Add walks down an open week; its Monday when every day is taken', () => {
    const next = '2026-11-16';
    expect(defaultDay(on([]), next, TODAY)).toBe(next);
    expect(defaultDay(on([sess(next), sess('2026-11-17', { kind: 'rest', type: 'Rest', miles: null })]), next, TODAY)).toBe('2026-11-18');
    const full = Array.from({ length: 7 }, (_, i) => sess(`2026-11-${16 + i}`));
    expect(defaultDay(on(full), next, TODAY)).toBe(next);
  });
  it('is the last open day of a past week; its Sunday when every day is taken', () => {
    const last = '2026-11-02';
    expect(defaultDay(on([sess('2026-11-08')]), last, TODAY)).toBe('2026-11-07');
    const full = Array.from({ length: 7 }, (_, i) => sess(`2026-11-0${2 + i}`));
    expect(defaultDay(on(full), last, TODAY)).toBe('2026-11-08');
  });
});

describe('where a run’s miles start', () => {
  it('with nothing to go on: 4, 8, 5, 5', () => {
    expect([milesFor('Easy', none), milesFor('Long', none), milesFor('Tempo', none), milesFor('Speed', none)]).toEqual([4, 8, 5, 5]);
  });
  it('takes the last run of that kind in the owner’s weeks, newest first', () => {
    const h: AddHistory = { ...none, recent: [sess('2026-11-11', { miles: 6.5 }), sess('2026-11-09', { miles: 4 }), sess('2026-11-07', { type: 'Long', miles: 9 })] };
    expect(milesFor('Easy', h)).toBe(6.5);
    expect(milesFor('Long', h)).toBe(9);
    // no tempo or speed run yet: the fallback, not an easy run's miles
    expect(milesFor('Tempo', h)).toBe(5);
  });
  it('lets a run of the same tone answer: Threshold for Tempo, Intervals for Speed, never a race', () => {
    const h: AddHistory = { ...none, recent: [sess('2026-11-10', { type: 'Race', miles: 13.1 }), sess('2026-11-05', { type: 'Threshold', miles: 8 }), sess('2026-11-03', { type: 'Intervals', miles: 7 })] };
    expect(milesFor('Tempo', h)).toBe(8);
    expect(milesFor('Speed', h)).toBe(7);
  });
  it('prefers the run of its own type to an earlier, newer one of the same tone', () => {
    const h: AddHistory = { ...none, recent: [sess('2026-11-10', { type: 'Recovery', miles: 3 }), sess('2026-11-08', { type: 'Easy', miles: 5 })] };
    expect(milesFor('Easy', h)).toBe(5);
  });
  it('with no sessions, reads the owner’s recent runs: the usual distance, and the longest for the long run', () => {
    const h: AddHistory = { ...none, runs: [5.1, 4.8, 9.6, 5.3, 3.2] };
    expect(milesFor('Easy', h)).toBe(5);
    expect(milesFor('Tempo', h)).toBe(5);
    expect(milesFor('Long', h)).toBe(9.5);
    // every run about the same: the long run is half again as far
    expect(milesFor('Long', { ...none, runs: [4, 4.2, 3.9] })).toBe(6);
  });
  it('then the training answers: the long run a third of the week, the rest shared', () => {
    const h: AddHistory = { ...none, profile: { weeklyMiles: 23, runDays: 4 } };
    expect(milesFor('Long', h)).toBe(8);
    expect(milesFor('Easy', h)).toBe(5);
    expect(milesFor('Easy', { ...none, profile: { weeklyMiles: 6, runDays: 1 } })).toBe(6);
  });
  it('stays on the half mile, between 0.5 and 50', () => {
    expect(milesFor('Easy', { ...none, runs: [0.2] })).toBe(0.5);
    expect(milesFor('Long', { ...none, runs: [62] })).toBe(50);
    expect(milesFor('Easy', { ...none, recent: [sess('2026-11-10', { miles: 6.2 })] })).toBe(6);
  });
});

describe('minutes from miles', () => {
  it('are those miles at the easy pace, on the five minutes; 9:00 a mile with no pace', () => {
    expect(minutesFor(4, null)).toBe(35);
    expect(minutesFor(4, 600)).toBe(40);
    expect(minutesFor(0.5, 540)).toBe(5);
    expect(minutesFor(50, 1200)).toBe(300);
    // a pace out of range is not believed
    expect(minutesFor(4, 30)).toBe(35);
  });
});

describe('the lifts to pick from', () => {
  it('with no lifts yet: the five plain kinds', () => {
    expect(liftChoices([]).map((c) => c.name)).toEqual(['Strength', 'Upper', 'Lower', 'Full body', 'Mobility']);
  });
  it('the owner’s own first, by name and newest first, each once, with what it last held; then plain kinds to six', () => {
    const recent = [
      sess('2026-11-11', { kind: 'lift', type: null, title: 'Core', miles: null }),
      sess('2026-11-10', { kind: 'lift', type: null, title: 'Strength A', miles: null, details: 'Squat, Bench', minutes: 45 }),
      sess('2026-11-03', { kind: 'lift', type: null, title: 'strength a', miles: null, details: 'Old list' }),
      sess('2026-11-02', { kind: 'run' }),
    ];
    const c = liftChoices(recent);
    expect(c.map((x) => x.name)).toEqual(['Core', 'Strength A', 'Strength', 'Upper', 'Lower', 'Full body']);
    expect(c[1]).toMatchObject({ saved: true, title: 'Strength A', details: 'Squat, Bench', minutes: 45 });
    expect(c[2]).toMatchObject({ saved: false, type: 'Strength', title: null });
  });
  it('a saved lift named like a plain kind is not offered twice, and four saved lifts at most', () => {
    const recent = ['Upper', 'A', 'B', 'C', 'D'].map((t, i) => sess(`2026-11-0${9 - i}`, { kind: 'lift', type: t === 'Upper' ? 'Upper' : null, title: t === 'Upper' ? null : t, miles: null }));
    expect(liftChoices(recent).map((x) => x.name)).toEqual(['Upper', 'A', 'B', 'C', 'Strength', 'Lower']);
  });
});

describe('the session that is written', () => {
  it('a run by miles, or by minutes when it has no miles; planned from today on', () => {
    expect(buildSession('p1', '2026-11-13', TODAY, { kind: 'run', type: 'Easy', miles: 4, minutes: null })).toMatchObject({ id: 'p1', date: '2026-11-13', kind: 'run', type: 'Easy', miles: 4, minutes: null, mark: null, blockId: null });
    expect(buildSession('p1', TODAY, TODAY, { kind: 'run', type: 'Long', miles: null, minutes: 60 })).toMatchObject({ type: 'Long', miles: null, minutes: 60, mark: null });
  });
  it('a day already past is added as done', () => {
    expect(buildSession('p1', '2026-11-09', TODAY, { kind: 'run', type: 'Easy', miles: 4, minutes: null }).mark).toBe('done');
    expect(buildSession('p1', '2026-11-10', TODAY, { kind: 'lift', choice: null, name: 'Legs' }).mark).toBe('done');
  });
  it('a lift is the picked one with what it held, or the typed name alone', () => {
    const [core, strengthA, strength] = liftChoices([
      sess('2026-11-11', { kind: 'lift', type: null, title: 'Core', miles: null }),
      sess('2026-11-10', { kind: 'lift', type: null, title: 'Strength A', miles: null, details: 'Squat, Bench', minutes: 45 }),
    ]);
    expect(core!.name).toBe('Core');
    // a saved lift goes in as it was, its type included (here it has none)
    expect(buildSession('p2', TODAY, TODAY, { kind: 'lift', choice: strengthA!, name: '' })).toMatchObject({ kind: 'lift', type: null, title: 'Strength A', details: 'Squat, Bench', minutes: 45, miles: null });
    expect(buildSession('p2', TODAY, TODAY, { kind: 'lift', choice: null, name: '' })).toMatchObject({ kind: 'lift', type: 'Strength', title: null });
    expect(buildSession('p2', TODAY, TODAY, { kind: 'lift', choice: strength!, name: '  ' })).toMatchObject({ kind: 'lift', type: 'Strength', title: null });
    // a typed name wins, and carries none of the picked lift's exercises
    expect(buildSession('p2', TODAY, TODAY, { kind: 'lift', choice: strengthA!, name: ' Legs and core ' })).toMatchObject({ kind: 'lift', type: null, title: 'Legs and core', details: null, minutes: null });
  });
});

describe('the words', () => {
  it('say the day as the owner reads it', () => {
    expect(dayWords(TODAY, TODAY)).toBe('today');
    expect(dayWords('2026-11-12', TODAY)).toBe('tomorrow');
    expect(dayWords('2026-11-10', TODAY)).toBe('yesterday');
    expect(dayWords('2026-11-14', TODAY)).toBe('Saturday');
    expect(dayWords('2026-11-05', TODAY)).toBe('Thursday');
    expect(dayWords('2026-11-20', TODAY)).toBe('Fri, Nov 20');
    expect(dayWords('2026-11-02', TODAY)).toBe('Mon, Nov 2');
  });
  it('the toast names the session and the day, and says when it went in as done', () => {
    expect(addedWords(buildSession('p', '2026-11-13', TODAY, { kind: 'run', type: 'Easy', miles: 4, minutes: null }), TODAY)).toBe('Easy 4 added to Friday');
    expect(addedWords(buildSession('p', '2026-11-09', TODAY, { kind: 'run', type: 'Long', miles: 8.5, minutes: null }), TODAY)).toBe('Long 8.5 added to Monday as done');
    expect(addedWords(buildSession('p', TODAY, TODAY, { kind: 'lift', choice: null, name: 'Strength A' }), TODAY)).toBe('Strength A added to today');
    expect(addedWords(buildSession('p', TODAY, TODAY, { kind: 'lift', choice: null, name: 'A very long name for a lift session indeed' }), TODAY)).toBe('Session added to today');
  });
});
