import type { Activity, Session, Snapshot } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { stripKinds } from './stripKinds';

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
});
