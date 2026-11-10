import { describe, expect, it } from 'vitest';
import { dayRange, maxOffset, rangeWindow, windowLabel } from './range';
import { arcPath, cumulative, downsample, gaugeAngle, labelIndices, mean, niceDomain, niceTicks, normalBand, percentile, rolling, rollingSparse, scaleLinear, segments, signedPercent, smoothPath, standing, trendRows } from './scale';

describe('chart kit scales', () => {
  it('maps a domain onto a range, and a flat domain onto the middle', () => {
    const s = scaleLinear([0, 10], [100, 0]);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(50);
    expect(scaleLinear([3, 3], [0, 10])(3)).toBe(5);
  });

  it('picks round ticks and never returns none', () => {
    expect(niceTicks(0, 30)).toEqual([0, 10, 20, 30]);
    expect(niceTicks(420, 540, 3, [15, 30, 60, 120])).toEqual([420, 480, 540]);
    expect(niceTicks(5, 5).length).toBe(1);
  });

  it('builds a domain from zero for miles and around the data for pace', () => {
    expect(niceDomain([2, 18, 9], { zero: true })).toEqual([0, 20]);
    const [lo, hi] = niceDomain([480, 510, 495]);
    expect(lo).toBeLessThanOrEqual(480);
    expect(hi).toBeGreaterThanOrEqual(510);
    expect(lo).toBeGreaterThan(0);
    expect(niceDomain([])).toEqual([0, 1]);
    const flat = niceDomain([7, 7, 7]);
    expect(flat[0]).toBeLessThan(7);
    expect(flat[1]).toBeGreaterThan(7);
  });

  it('breaks a line at nulls', () => {
    expect(segments([1, 2, null, 3, null, null, 4, 5]).map((s) => s.map((p) => p.i))).toEqual([[0, 1], [3], [6, 7]]);
  });

  it('draws a smooth path that passes through every point and never overshoots a flat run', () => {
    const d = smoothPath([
      [0, 10],
      [10, 10],
      [20, 10],
    ]);
    // every control point of a flat run is on the line
    expect(d.match(/-?\d+(\.\d+)?/g)!.filter((_, i) => i % 2 === 1).every((y) => y === '10')).toBe(true);
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[1, 2]])).toBe('M1,2');
    const peak = smoothPath([
      [0, 50],
      [10, 0],
      [20, 50],
    ]);
    const ys = peak.match(/-?\d+(\.\d+)?/g)!.filter((_, i) => i % 2 === 1).map(Number);
    expect(Math.min(...ys)).toBe(0);
  });
});

describe('chart kit series', () => {
  it('rolls a trailing window, keeping null days null', () => {
    expect(rolling([1, 2, 3, 4], 3, 'sum')).toEqual([1, 3, 6, 9]);
    expect(rolling([2, null, 4], 2, 'mean')).toEqual([2, null, 4]);
    expect(rolling([0, 0, 0], 7, 'sum')).toEqual([0, 0, 0]);
  });

  it('carries a sparse mean between runs and starts at the first value', () => {
    expect(rollingSparse([null, 500, null, 520, null], 3)).toEqual([null, 500, 500, 510, 520]);
    expect(rollingSparse([500, null, null, null], 2)).toEqual([500, 500, null, null]);
    expect(rollingSparse([500, 500], 2, [true, false])).toEqual([500, null]);
  });

  it('adds up a month and stops at the days not reached', () => {
    expect(cumulative([1, 0, 2.5, null, null])).toEqual([1, 1, 3.5, null, null]);
  });

  it('averages chunks down to a sparkline', () => {
    expect(downsample([1, 2, 3, 4], 2)).toEqual([1.5, 3.5]);
    expect(downsample([1, 2], 5)).toEqual([1, 2]);
  });

  it('reads means and percentiles from what is there', () => {
    expect(mean([null, 2, 4])).toBe(3);
    expect(mean([null])).toBeNull();
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });
});

describe('the personal normal', () => {
  it('waits for two weeks of values, then takes the middle half', () => {
    expect(normalBand(Array.from({ length: 13 }, (_, i) => i))).toBeNull();
    const b = normalBand(Array.from({ length: 21 }, (_, i) => i))!;
    expect(b).toEqual({ lo: 5, hi: 15, n: 21 });
    expect(standing(20, b)).toBe('above');
    expect(standing(10, b)).toBe('within');
    expect(standing(1, b)).toBe('below');
    expect(standing(10, null)).toBeNull();
  });
});

describe('the trend table', () => {
  it('compares each window with the one before it', () => {
    // 14 days: a week of 1 mile a day, then a week of 2
    const daily = [...Array(7).fill(1), ...Array(7).fill(2)];
    const [d3, d7, d14] = trendRows(daily, 'sum', [3, 7, 14]);
    expect(d3!.now).toBe(6);
    expect(d3!.before).toBe(6);
    expect(d3!.dir).toBe('flat');
    expect(d7!.now).toBe(14);
    expect(d7!.before).toBe(7);
    expect(d7!.change).toBe(1);
    expect(d7!.dir).toBe('up');
    // no 14 days before the last 14: nothing to compare
    expect(d14!.change).toBeNull();
    expect(d14!.dir).toBeNull();
  });

  it('says nothing about a window before the first value, and averages rates', () => {
    const daily = [null, null, null, 500, null, 510];
    const [d3] = trendRows(daily, 'mean', [3]);
    expect(d3!.now).toBe(505);
    expect(d3!.before).toBeNull();
    expect(d3!.change).toBeNull();
  });

  it('does not compare with a stretch that starts before the data does', () => {
    // 5 days of nothing loaded, then 9 days of 1 mile: the 7-day row's stretch before reaches into the gap
    const daily = [...Array(5).fill(null), ...Array(9).fill(1)];
    const [d3, d7] = trendRows(daily, 'sum', [3, 7]);
    expect(d3!.change).toBe(0);
    expect(d7!.before).toBeNull();
    expect(d7!.dir).toBeNull();
  });

  it('draws the sparkline from the series it is given', () => {
    const [d3] = trendRows([1, 2, 3, 4], 'sum', [3], [10, 20, 30, 40]);
    expect(d3!.spark).toEqual([20, 30, 40]);
  });

  it('writes a signed percent with a real minus', () => {
    expect(signedPercent(0.123)).toBe('+12%');
    expect(signedPercent(-0.04)).toBe('−4%');
    expect(signedPercent(0.001)).toBe('0%');
  });
});

describe('labels and arcs', () => {
  it('labels the first and last point and keeps labels apart', () => {
    const ix = labelIndices(30, 300, 60);
    expect(ix[0]).toBe(0);
    expect(ix[ix.length - 1]).toBe(29);
    for (let k = 1; k < ix.length; k++) expect(((ix[k]! - ix[k - 1]!) / 29) * 300).toBeGreaterThanOrEqual(50);
    expect(labelIndices(1, 300)).toEqual([0]);
    expect(labelIndices(0, 300)).toEqual([]);
  });

  it('draws arcs clockwise and maps a share onto the half gauge', () => {
    expect(gaugeAngle(0)).toBe(180);
    expect(gaugeAngle(0.5)).toBe(270);
    expect(gaugeAngle(2)).toBe(360);
    expect(arcPath(50, 50, 40, 180, 360)).toBe('M10,50A40,40 0 0 1 90,50');
    expect(arcPath(50, 50, 40, 10, 10)).toBe('');
  });
});

describe('range windows', () => {
  it('ends today and steps back whole spans', () => {
    const w = rangeWindow('2026-11-08', '1M');
    expect(w.to).toBe('2026-11-08');
    expect(w.from).toBe('2026-10-10');
    expect(w.dates.length).toBe(30);
    const back = rangeWindow('2026-11-08', '1M', 1);
    expect(back.to).toBe('2026-10-09');
    expect(windowLabel(w, '2026-11-08')).toBe('Oct 10 to Nov 8');
    expect(windowLabel(rangeWindow('2026-01-10', '1M'), '2026-01-10')).toBe('Dec 12, 2025 to Jan 10, 2026');
    expect(dayRange('2026-11-09', '2026-11-15')).toBe('Nov 9 to 15');
    expect(dayRange('2026-11-10', '2027-02-07')).toBe('Nov 10 to Feb 7');
  });

  it('stops going back where the data starts', () => {
    expect(maxOffset('2026-11-08', '1M', null)).toBe(0);
    expect(maxOffset('2026-11-08', '1M', '2026-09-01')).toBe(2);
  });
});
