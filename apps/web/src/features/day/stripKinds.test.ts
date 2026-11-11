import type { Activity, Session, Snapshot } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { stripKinds, stripLabel, stripStatus } from './stripKinds';

const snap = (sessions: Partial<Session>[], acts: Partial<Activity>[] = [], lifts = 0): Snapshot => ({
  today: '2026-11-09',
  sessionsOn: () => sessions as Session[],
  activitiesOn: () => acts as Activity[],
  liftSetCountOn: () => lifts,
});

describe('the strip’s glyphs', () => {
  it('shows what the plan calls for, run first', () => {
    expect(stripKinds(snap([{ kind: 'lift' }, { kind: 'run' }]), '2026-11-10')).toEqual(['run', 'lift']);
    expect(stripKinds(snap([{ kind: 'cross' }]), '2026-11-10')).toEqual(['cross']);
  });
  it('shows nothing for rest, or a session skipped or sick', () => {
    expect(stripKinds(snap([{ kind: 'rest' }]), '2026-11-10')).toEqual([]);
    expect(stripKinds(snap([{ kind: 'run', mark: 'skip' }, { kind: 'lift', mark: 'sick' }]), '2026-11-10')).toEqual([]);
  });
  it('shows what was done on a day with no plan', () => {
    expect(stripKinds(snap([], [{ kind: 'run' }]), '2026-11-08')).toEqual(['run']);
    expect(stripKinds(snap([], [], 12), '2026-11-08')).toEqual(['lift']);
  });
  it('never shows more than two', () => {
    expect(stripKinds(snap([{ kind: 'cross' }, { kind: 'lift' }, { kind: 'run' }]), '2026-11-10')).toEqual(['run', 'lift']);
  });
  it('says every kind in the cell’s name, though it draws two (today-top-29)', () => {
    const three = snap([{ kind: 'cross' }, { kind: 'lift' }, { kind: 'run' }]);
    expect(stripLabel('2026-11-10', stripKinds(three, '2026-11-10', 3), 'planned')).toBe('Tuesday, November 10, run, strength and workout');
    expect(stripLabel('2026-11-10', ['run'], 'done')).toBe('Tuesday, November 10, run done');
    expect(stripLabel('2026-11-15', [], 'rest')).toBe('Sunday, November 15, rest');
  });
});

describe('the strip’s fill: how much of the day is done (guide 6.7)', () => {
  const TODAY = '2026-11-09';
  const day = (sessions: Partial<Session>[], acts: Partial<Activity>[] = [], lifts = 0) => snap(sessions, acts, lifts);
  it('nothing done yet is planned, today or ahead', () => {
    expect(stripStatus(day([{ kind: 'run' }, { kind: 'lift' }]), TODAY)).toBe('planned');
    expect(stripStatus(day([{ kind: 'run' }]), '2026-11-12')).toBe('planned');
  });
  it('today with one session of two done is part done, not untouched', () => {
    expect(stripStatus(day([{ kind: 'run', mark: 'done' }, { kind: 'lift' }]), TODAY)).toBe('floor');
    // a run that landed from a watch counts the same way
    expect(stripStatus(day([{ kind: 'run', miles: 4 }, { kind: 'lift' }], [{ kind: 'run', miles: 4 }]), TODAY)).toBe('floor');
  });
  it('every session done is done; a floor is part', () => {
    expect(stripStatus(day([{ kind: 'run', mark: 'done' }, { kind: 'lift', mark: 'done' }]), TODAY)).toBe('done');
    expect(stripStatus(day([{ kind: 'run', mark: 'floor' }]), TODAY)).toBe('floor');
  });
  it('a day that passed: one of two done is part, none is missed', () => {
    expect(stripStatus(day([{ kind: 'run', mark: 'done' }, { kind: 'lift' }]), '2026-11-06')).toBe('floor');
    expect(stripStatus(day([{ kind: 'run' }, { kind: 'lift' }]), '2026-11-06')).toBe('missed');
  });
  it('rest and nothing planned have no mark; a skipped day and a bonus day keep their words', () => {
    expect(stripStatus(day([{ kind: 'rest' }]), TODAY)).toBeNull();
    expect(stripStatus(day([]), TODAY)).toBeNull();
    expect(stripStatus(day([{ kind: 'run', mark: 'skip' }]), TODAY)).toBe('skipped');
    expect(stripStatus(day([], [{ kind: 'run', miles: 3 }]), '2026-11-06')).toBe('bonus');
  });
});
