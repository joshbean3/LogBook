import { shiftDays } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { buildSnapshot } from '@/api/snapshot';
import type { MonthBundle } from '@/api/types';
import { rangeWindow } from '@/ui/charts';
import { snapSource } from './feed';
import { healthByDate, healthDaysKey, healthWord, healthYears, pillOf, type HealthDay } from './healthDays';
import { bandWords, buildMetric, METRICS } from './metrics';

const TODAY = '2026-11-10';
const empty = (m: string): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] });
const snap = () => {
  const bundles: Record<string, MonthBundle> = {};
  for (let d = shiftDays(TODAY, -400); d <= TODAY; d = shiftDays(d, 1)) bundles[d.slice(0, 7)] ??= empty(d.slice(0, 7));
  return buildSnapshot(bundles, TODAY);
};
/** `n` days ending today; night `i` back sleeps 7 h plus a small wobble. */
const days = (n: number, f: (i: number) => Partial<HealthDay> = () => ({})): HealthDay[] =>
  Array.from({ length: n }, (_, i) => ({ date: shiftDays(TODAY, -i), sleepMin: 420 + (i % 3) * 20, hrvMs: 60 + (i % 5), restingHr: 50 + (i % 4), ...f(i) }));
const src = (list: HealthDay[]) => snapSource(snap(), [], new Set(), healthByDate([{ days: list }]));

describe('Apple Health days (Contract 4)', () => {
  it('asks a year at a time, never more than the route allows, under a key that starts with apple-health', () => {
    expect(healthYears('2026-04-20', '2026-11-10')).toEqual([{ year: '2026', from: '2026-01-01', to: '2026-12-31' }]);
    expect(healthYears('2025-07-01', '2026-11-10').map((y) => y.year)).toEqual(['2025', '2026']);
    expect(healthDaysKey('2026')[0]).toBe('apple-health');
  });

  it('reads the answer by date and leaves out days with no reading', () => {
    const m = healthByDate([{ days: [{ date: '2026-11-09', sleepMin: 432, hrvMs: null, restingHr: 51 }, { date: '2026-11-08', sleepMin: null, hrvMs: null, restingHr: null }] }, null, undefined]);
    expect([...m.keys()]).toEqual(['2026-11-09']);
    expect(m.get('2026-11-09')).toEqual({ date: '2026-11-09', sleepMin: 432, hrvMs: null, restingHr: 51 });
  });

  it('survives an answer in a shape it does not know', () => {
    expect(healthByDate([{} as never, { days: [{ date: '2026-11-09', sleepMin: 'x' } as never] }]).size).toBe(0);
  });
});

describe('the three health metrics', () => {
  it('shows sleep in hours with one decimal, as a 7-night average', () => {
    const m = buildMetric(METRICS.sleep, null, src(days(40)), rangeWindow(TODAY, '1M'));
    expect(m.hasData).toBe(true);
    expect(m.variant.unit).toBe('h');
    // the last 7 nights: 420, 440, 460, 420, 440, 460, 420 minutes
    expect(m.value).toBeCloseTo((420 * 3 + 440 * 2 + 460 * 2) / 7 / 60, 6);
    expect(m.variant.format(m.value!)).toBe('7.3');
    expect(m.latest).toBe(TODAY);
    expect(bandWords(m)).toMatch(/^Usual \d\.\d–\d\.\d h$/);
  });

  it('shows HRV in whole milliseconds and resting heart rate in whole beats, lowest as the best', () => {
    const hrv = buildMetric(METRICS.hrv, null, src(days(40)), rangeWindow(TODAY, '1M'));
    expect(hrv.variant.format(hrv.value!)).toMatch(/^\d+$/);
    expect(hrv.variant.unit).toBe('ms');
    const rhr = buildMetric(METRICS.rhr, null, src(days(40, (i) => ({ restingHr: i === 3 ? 44 : 52 }))), rangeWindow(TODAY, '1M'));
    expect(rhr.variant.unit).toBe('bpm');
    expect(rhr.variant.bestLabel).toBe('Lowest');
    expect(rhr.best!.v).toBeLessThan(52);
    expect(rhr.status).toMatch(/usual/i);
  });

  it('reads back to the newest night when last night has no reading', () => {
    const m = buildMetric(METRICS.sleep, null, src(days(20).filter((d) => d.date < shiftDays(TODAY, -1))), rangeWindow(TODAY, '1M'));
    expect(m.value).not.toBeNull();
    expect(m.valueDate).toBe(shiftDays(TODAY, -2));
  });

  it('one metric missing does not empty the others', () => {
    const list = days(20, () => ({ hrvMs: null }));
    expect(buildMetric(METRICS.hrv, null, src(list), rangeWindow(TODAY, '1M')).hasData).toBe(false);
    expect(buildMetric(METRICS.rhr, null, src(list), rangeWindow(TODAY, '1M')).hasData).toBe(true);
  });

  it('makes no illness claim in its words', () => {
    for (const id of ['sleep', 'hrv', 'rhr'] as const) expect(`${METRICS[id].what} ${METRICS[id].why} ${METRICS[id].how}`).not.toMatch(/illness|sick|cold coming|injur|disease/i);
  });
});

describe('the word under a health number', () => {
  const none = { hasData: false, status: 'No readings yet' };
  it('says Syncing only while a sync is running', () => {
    expect(healthWord(none, { connected: true, syncing: true })).toBe('Syncing');
    expect(healthWord(none, { connected: true, syncing: false })).toBe('No readings yet');
  });
  it('says Not connected when no phone is connected and there is nothing to show', () => {
    expect(healthWord(none, { connected: false, syncing: false })).toBe('Not connected');
  });
  it('shows the number’s own status whenever there are readings, connected or not', () => {
    expect(healthWord({ hasData: true, status: 'Usual range' }, { connected: false, syncing: false })).toBe('Usual range');
    expect(healthWord({ hasData: true, status: 'Usual range' }, { connected: true, syncing: true })).toBe('Usual range');
  });
});

describe('the range pill on a health tile', () => {
  it('is empty with no value', () => {
    expect(pillOf({ value: null, band: null, line: [] })).toBeNull();
  });
  it('places the value and the usual band on one track, inside 0..1', () => {
    const p = pillOf({ value: 52, band: { lo: 50, hi: 54, n: 30 }, line: [48, 50, 52, 56] })!;
    expect(p.pos).toBeGreaterThan(0);
    expect(p.pos).toBeLessThan(1);
    expect(p.band![0]).toBeLessThan(p.pos);
    expect(p.band![1]).toBeGreaterThan(p.pos);
  });
  it('centers a single flat reading instead of dividing by zero', () => {
    const p = pillOf({ value: 60, band: null, line: [60] })!;
    expect(p.pos).toBeCloseTo(0.5, 6);
    expect(p.band).toBeNull();
  });
});
