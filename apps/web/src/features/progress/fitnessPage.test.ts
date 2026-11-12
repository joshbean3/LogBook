import { describe, expect, it } from 'vitest';
import { BODY_IDS, healthShown, trendIds, trendsShown } from './fitnessPage';
import type { MetricId } from './metrics';

const having = (...ids: MetricId[]) => (id: MetricId) => ids.includes(id);

describe('Fitness, Trends: which tiles show', () => {
  it('offers pace only where a synced source can time a run', () => {
    expect(trendIds(true)).toEqual(['mileage', 'pace', 'lifts']);
    expect(trendIds(false)).toEqual(['mileage', 'lifts']);
    // the habits tile is not training: it is on Today's History, never here
    expect(trendIds(true)).not.toContain('consistency');
    expect(trendIds(false)).not.toContain('consistency');
  });

  it('shows a tile only for a metric with something in it', () => {
    expect(trendsShown({ ids: trendIds(false), has: having('mileage', 'lifts'), canConnect: false, health: false })).toEqual({ tiles: ['mileage', 'lifts'], empty: false, health: false, section: true });
    // a runner who never lifts gets no "None yet" tile for lifts, and a lifter none for miles
    expect(trendsShown({ ids: trendIds(false), has: having('mileage'), canConnect: false, health: false }).tiles).toEqual(['mileage']);
    expect(trendsShown({ ids: trendIds(false), has: having('lifts'), canConnect: false, health: false }).tiles).toEqual(['lifts']);
    expect(trendsShown({ ids: trendIds(true), has: having('mileage', 'pace', 'lifts'), canConnect: false, health: false }).tiles).toEqual(['mileage', 'pace', 'lifts']);
    // a source is connected and no run has a time yet: no empty pace tile
    expect(trendsShown({ ids: trendIds(true), has: having('mileage'), canConnect: false, health: false }).tiles).toEqual(['mileage']);
  });

  it('is not drawn before the first run or lift: the Progress row already says what will show', () => {
    expect(trendsShown({ ids: trendIds(false), has: having(), canConnect: false, health: false })).toEqual({ tiles: [], empty: false, health: false, section: false });
  });

  it('with Strava on offer and not connected: the row with the way to connect, then pace as the door once there are miles', () => {
    expect(trendsShown({ ids: trendIds(true), has: having(), canConnect: true, health: false })).toEqual({ tiles: [], empty: true, health: false, section: true });
    expect(trendsShown({ ids: trendIds(true), has: having('mileage'), canConnect: true, health: false })).toEqual({ tiles: ['mileage', 'pace'], empty: false, health: false, section: true });
    // only lifts so far: pace still stands beside them, the one way to a source from here
    expect(trendsShown({ ids: trendIds(true), has: having('lifts'), canConnect: true, health: false }).tiles).toEqual(['pace', 'lifts']);
  });

  it('with Apple Health: the body’s numbers are one group under the tiles, or the whole section before any run', () => {
    expect(trendsShown({ ids: trendIds(false), has: having('mileage'), canConnect: false, health: true })).toEqual({ tiles: ['mileage'], empty: false, health: true, section: true });
    expect(trendsShown({ ids: trendIds(false), has: having(), canConnect: false, health: true })).toEqual({ tiles: [], empty: false, health: true, section: true });
    expect(BODY_IDS).toEqual(['sleep', 'hrv', 'rhr']);
  });
});

describe('Fitness, Trends: when the health group shows', () => {
  const off = { connected: false, syncing: false };
  it('never in a build without Apple Health', () => {
    expect(healthShown(false, { connected: true, syncing: true }, true)).toBe(false);
  });
  it('not before Apple Health has anything to do with the account (it is connected in Settings)', () => {
    expect(healthShown(true, off, false)).toBe(false);
  });
  it('once a phone is connected, a sync runs, or the server holds readings from another phone', () => {
    expect(healthShown(true, { connected: true, syncing: false }, false)).toBe(true);
    expect(healthShown(true, { connected: false, syncing: true }, false)).toBe(true);
    expect(healthShown(true, off, true)).toBe(true);
  });
});
