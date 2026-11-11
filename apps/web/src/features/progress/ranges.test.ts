import { shiftDays, type ISODate } from '@logbook/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { axisLabels, bucketRuns, bucketTitle, keptOver, PROGRESS_RANGES, rangeContext, rangeSpan, spanMonths, type DayRun, type RangeSpan } from './ranges';

// Wednesday Nov 11 2026: this week began Monday Nov 9
const T = '2026-11-11';
const none: DayRun = { planned: 0, plannedRuns: 0, done: 0, runs: 0 };
/** A day reader from two maps: planned miles and run miles by date. */
const reader =
  (plan: Record<string, number>, ran: Record<string, number>) =>
  (d: ISODate): DayRun => ({ planned: plan[d] ?? 0, plannedRuns: plan[d] ? 1 : 0, done: ran[d] ?? 0, runs: ran[d] ? 1 : 0 });

describe('range spans', () => {
  it('reads 1W by day, Monday to Sunday, the days ahead plan only', () => {
    const s = rangeSpan('1W', T);
    expect(s.unit).toBe('day');
    expect(s.buckets.map((b) => b.key)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(s.buckets.filter((b) => b.current).map((b) => b.key)).toEqual([T]);
    expect(s.buckets.filter((b) => b.future)).toHaveLength(4);
  });

  it('reads 1M, 3M, 6M and 12M by week, ending with this week', () => {
    for (const [r, n] of [['1M', 5], ['3M', 13], ['6M', 26], ['12M', 52]] as const) {
      const s = rangeSpan(r, T);
      expect(s.unit).toBe('week');
      expect(s.buckets).toHaveLength(n);
      expect(s.buckets.at(-1)).toMatchObject({ key: '2026-11-09', to: '2026-11-15', current: true, future: false });
      expect(s.buckets.every((b, i) => i === 0 || shiftDays(s.buckets[i - 1]!.key, 7) === b.key)).toBe(true);
    }
    expect(rangeSpan('1M', T).from).toBe('2026-10-12');
  });

  it('starts YTD on January 1, clipping the week it falls in', () => {
    const s = rangeSpan('YTD', T);
    expect(s.unit).toBe('week');
    // Jan 1 2026 is a Thursday: its week began Monday Dec 29 2025, and counts from Jan 1
    expect(s.buckets[0]).toMatchObject({ key: '2025-12-29', from: '2026-01-01', to: '2026-01-04' });
    expect(s.buckets.at(-1)!.current).toBe(true);
  });

  it('reads YTD by day in early January, and its first week across the year boundary', () => {
    const s = rangeSpan('YTD', '2027-01-03');
    expect(s.unit).toBe('day');
    expect(s.from).toBe('2027-01-01');
    // to Sunday Jan 3, the end of the week that holds today
    expect(s.buckets.map((b) => b.key)).toEqual(['2027-01-01', '2027-01-02', '2027-01-03']);
    const w = rangeSpan('YTD', '2027-01-25');
    expect(w.unit).toBe('week');
    expect(w.buckets[0]).toMatchObject({ key: '2026-12-28', from: '2027-01-01', to: '2027-01-03' });
  });

  it('keeps weeks whole across a year boundary', () => {
    const s = rangeSpan('3M', '2027-01-06');
    const cross = s.buckets.find((b) => b.key === '2026-12-28')!;
    expect(cross).toMatchObject({ from: '2026-12-28', to: '2027-01-03' });
    expect(spanMonths(s)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
  });

  it('reads All by week, by month past about 18 months, by day under three weeks', () => {
    expect(rangeSpan('All', T, '2026-03-02')).toMatchObject({ unit: 'week', from: '2026-03-02' });
    const long = rangeSpan('All', T, '2023-11-06');
    expect(long.unit).toBe('month');
    expect(long.buckets[0]).toMatchObject({ key: '2023-11-01', from: '2023-11-06' });
    expect(long.buckets.at(-1)).toMatchObject({ key: '2026-11-01', to: '2026-11-30', current: true });
    expect(rangeSpan('All', T, '2026-11-02').unit).toBe('day');
  });

  it('shows All as this week with no history, or a first day that is still ahead', () => {
    expect(rangeSpan('All', T, null)).toMatchObject({ unit: 'day', from: T, to: '2026-11-15' });
    expect(rangeSpan('All', T, '2027-01-01').from).toBe(T);
  });

  it('reads a range longer than the history as the range, the weeks before it empty', () => {
    const s = rangeSpan('12M', T);
    const b = bucketRuns(s.buckets, reader({ '2026-11-09': 4 }, { '2026-11-09': 4.2 }), T);
    expect(b).toHaveLength(52);
    expect(b.slice(0, -1).every((x) => x.planned === 0 && x.done === 0)).toBe(true);
    expect(b.at(-1)).toMatchObject({ planned: 4, done: 4.2, runs: 1 });
  });
});

describe('bucket sums', () => {
  it('has nothing to say with no runs and no plan', () => {
    const b = bucketRuns(rangeSpan('3M', T).buckets, () => none, T);
    expect(b.every((x) => x.done === 0 && x.planned === 0 && !x.missing)).toBe(true);
    expect(keptOver(b)).toBeNull();
  });

  it('counts runs only this week: the plan whole, runs up to today', () => {
    const plan = { '2026-11-09': 4, '2026-11-11': 6, '2026-11-14': 8 };
    const ran = { '2026-11-09': 4.2, '2026-11-14': 9 };
    const w = bucketRuns(rangeSpan('3M', T).buckets, reader(plan, ran), T).at(-1)!;
    expect(w).toMatchObject({ planned: 18, plannedRuns: 3, plannedPast: 4, done: 4.2, runs: 1 });
    const days = bucketRuns(rangeSpan('1W', T).buckets, reader(plan, ran), T);
    expect(days.map((d) => d.done)).toEqual([4.2, 0, 0, 0, 0, 0, 0]);
    expect(days.map((d) => d.planned)).toEqual([4, 0, 6, 0, 0, 8, 0]);
    // a finished-week rate needs a finished week
    expect(keptOver(bucketRuns(rangeSpan('3M', T).buckets, reader(plan, ran), T))).toBeNull();
  });

  it('marks a bucket that touches a month not loaded, and leaves it out of the rate', () => {
    const s = rangeSpan('3M', T);
    const plan = Object.fromEntries(s.buckets.map((b) => [b.key, 10]));
    const ran = Object.fromEntries(s.buckets.map((b) => [b.key, 5]));
    const b = bucketRuns(s.buckets, reader(plan, ran), T, (m) => m >= '2026-09');
    expect(b.filter((x) => x.missing).map((x) => x.key)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31']);
    expect(keptOver(b)).toMatchObject({ rate: 0.5, weeks: 9 });
  });

  it('grades the plan week by week, a big week never paying for a missed one', () => {
    const s = rangeSpan('1M', T);
    const [a, b2, c, d] = s.buckets.map((x) => x.key);
    const k = keptOver(bucketRuns(s.buckets, reader({ [a!]: 10, [b2!]: 10, [c!]: 10 }, { [a!]: 20, [c!]: 5, [d!]: 7 }), T));
    expect(k).toEqual({ rate: 0.5, behind: 15, weeks: 3 });
  });

  it('files a run by its calendar date whatever the time zone', () => {
    const before = process.env.TZ;
    const sums: string[] = [];
    try {
      for (const tz of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/New_York', 'Europe/London']) {
        process.env.TZ = tz;
        // Sunday night and Monday morning: two buckets, never one
        const s = rangeSpan('1M', '2026-11-09');
        const b = bucketRuns(s.buckets, reader({}, { '2026-11-08': 5, '2026-11-09': 3 }), '2026-11-09');
        sums.push(JSON.stringify(b.map((x) => [x.key, x.done])));
      }
    } finally {
      process.env.TZ = before;
    }
    expect(new Set(sums).size).toBe(1);
    expect(JSON.parse(sums[0]!).slice(-2)).toEqual([
      ['2026-11-02', 5],
      ['2026-11-09', 3],
    ]);
  });
});

describe('axis labels', () => {
  // an 11 px caption with its tracking: about 9 px a letter
  const width = (s: string) => s.length * 9;
  const layout = (s: RangeSpan, plotW: number) => {
    const n = s.buckets.length;
    const x = (i: number) => 8 + ((plotW - 38) / Math.max(1, n - 1)) * i;
    return { ls: axisLabels(s, x, width, plotW), x };
  };
  const collide = (ls: ReturnType<typeof axisLabels>, x: (i: number) => number, plotW: number) => {
    const ext = ls.map((l) => {
      const w = width(l.text);
      const a = Math.max(0, Math.min(plotW - w, l.anchor === 'start' ? x(l.i) : l.anchor === 'end' ? x(l.i) - w : x(l.i) - w / 2));
      return [a, a + w] as const;
    });
    return ext.some((e, i) => ext.some((f, j) => i !== j && e[0] < f[1] + 10 && f[0] < e[1] + 10));
  };

  it('never collides, at any range and phone width', () => {
    for (const r of PROGRESS_RANGES)
      for (const plotW of [240, 306, 352])
        for (const today of [T, '2027-01-03', '2026-06-30']) {
          const s = rangeSpan(r, today, '2023-11-06');
          const { ls, x } = layout(s, plotW);
          expect(collide(ls, x, plotW), `${r} at ${plotW} on ${today}`).toBe(false);
          expect(ls.length).toBeGreaterThan(0);
        }
  });

  it('names weekdays in 1W, months in 3M, and Now under this week', () => {
    const w = layout(rangeSpan('1W', T), 306).ls;
    expect(w.map((l) => l.text).join('')).toBe('MTWTFSS');
    expect(w.find((l) => l.now)!.i).toBe(2);
    const m = layout(rangeSpan('3M', T), 306).ls;
    expect(m.at(-1)).toMatchObject({ text: 'Now', anchor: 'end' });
    expect(m.map((l) => l.text)).toContain('Sep');
  });

  it('names the years in a long All', () => {
    const ls = layout(rangeSpan('All', T, '2023-11-06'), 306).ls.map((l) => l.text);
    expect(ls).toContain('2025');
    expect(ls.at(-1)).toBe('Now');
  });
});

describe('range words', () => {
  it('says the range once, in the headline', () => {
    expect(rangeContext(rangeSpan('3M', T), T)).toBe('in 3 months');
    expect(rangeContext(rangeSpan('1M', T), T)).toBe('since Oct 12');
    expect(rangeContext(rangeSpan('YTD', T), T)).toBe('this year');
    expect(rangeContext(rangeSpan('All', T, '2025-03-03'), T)).toBe('since Mar 2025');
  });

  it('names a bucket while it is read', () => {
    const s = rangeSpan('3M', T);
    expect(bucketTitle('week', s.buckets.at(-1)!, T)).toBe('This week');
    expect(bucketTitle('week', s.buckets.at(-2)!, T)).toBe('Last week');
    expect(bucketTitle('week', s.buckets[0]!, T)).toBe('Week of Aug 17');
    expect(bucketTitle('day', rangeSpan('1W', T).buckets[1]!, T)).toBe('Tue, Nov 10');
    expect(bucketTitle('month', rangeSpan('All', T, '2023-11-06').buckets[0]!, T)).toBe('November 2023');
  });
});
