import { shiftDays, type ISODate } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { axisLabels, bucketDates, bucketLifts, bucketRuns, bucketTitle, firstShown, gridFor, labelExtent, PROGRESS_RANGES, rangeContext, rangeSpan, spanMonths, usualOver, WEEKLY_MAX, type DayLift, type DayRun, type RangeSpan } from './ranges';

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

  it('reads 1M, 3M and 6M by week, ending with this week', () => {
    for (const [r, n] of [['1M', 5], ['3M', 13], ['6M', 26]] as const) {
      const s = rangeSpan(r, T);
      expect(s.unit).toBe('week');
      expect(s.buckets).toHaveLength(n);
      expect(s.buckets.at(-1)).toMatchObject({ key: '2026-11-09', to: '2026-11-15', current: true, future: false });
      expect(s.buckets.every((b, i) => i === 0 || shiftDays(s.buckets[i - 1]!.key, 7) === b.key)).toBe(true);
    }
    expect(rangeSpan('1M', T).from).toBe('2026-10-12');
  });

  it('reads 12M as this month and the 11 before it, by month', () => {
    const s = rangeSpan('12M', T);
    expect(s.unit).toBe('month');
    expect(s.buckets.map((b) => b.key.slice(0, 7))).toEqual(['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(s.buckets[0]).toMatchObject({ from: '2025-12-01', to: '2025-12-31', current: false });
    expect(s.buckets.at(-1)).toMatchObject({ from: '2026-11-01', to: '2026-11-30', current: true, future: false });
    // across a year boundary, and on the first of a month
    expect(rangeSpan('12M', '2027-01-01').buckets.map((b) => b.key)).toEqual(expect.arrayContaining(['2026-02-01', '2027-01-01']));
    expect(rangeSpan('12M', '2027-01-01').buckets).toHaveLength(12);
  });

  it('never draws more than 26 bars, at any range on any day of the year', () => {
    for (const today of ['2026-01-01', '2026-01-20', '2026-03-15', '2026-06-29', '2026-07-06', T, '2026-12-31'])
      for (const r of PROGRESS_RANGES)
        for (const first of [null, '2026-11-02', '2026-06-01', '2025-09-08', '2019-01-01']) {
          const s = rangeSpan(r, today, first);
          // a long All is the one range with no ceiling: it reads by month, 12 bars a year
          const cap = r === 'All' && s.unit === 'month' ? Infinity : Math.max(WEEKLY_MAX, 26);
          expect(s.buckets.length, `${r} on ${today} from ${first}`).toBeLessThanOrEqual(cap);
          expect(s.buckets.length).toBeGreaterThan(0);
        }
  });

  it('starts YTD on January 1, clipping the week it falls in', () => {
    // late June: 26 weeks from the week of January 1
    const s = rangeSpan('YTD', '2026-06-24');
    expect(s.unit).toBe('week');
    // Jan 1 2026 is a Thursday: its week began Monday Dec 29 2025, and counts from Jan 1
    expect(s.buckets[0]).toMatchObject({ key: '2025-12-29', from: '2026-01-01', to: '2026-01-04' });
    expect(s.buckets).toHaveLength(26);
    expect(s.buckets.at(-1)!.current).toBe(true);
  });

  it('reads YTD by month once the year holds more than 26 weeks', () => {
    expect(rangeSpan('YTD', '2026-06-28').unit).toBe('week');
    expect(rangeSpan('YTD', '2026-06-29').unit).toBe('month');
    const s = rangeSpan('YTD', T);
    expect(s.unit).toBe('month');
    expect(s.buckets).toHaveLength(11);
    expect(s.buckets[0]).toMatchObject({ key: '2026-01-01', from: '2026-01-01' });
    expect(s.buckets.at(-1)).toMatchObject({ key: '2026-11-01', to: '2026-11-30', current: true });
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

  it('reads All by week up to 26 weeks, by month past that, by day under three weeks', () => {
    expect(rangeSpan('All', T, '2026-08-03')).toMatchObject({ unit: 'week', from: '2026-08-03' });
    // 26 weeks to the day, then one more
    expect(rangeSpan('All', T, '2026-05-18')).toMatchObject({ unit: 'week' });
    expect(rangeSpan('All', T, '2026-05-18').buckets).toHaveLength(26);
    expect(rangeSpan('All', T, '2026-05-17')).toMatchObject({ unit: 'month', from: '2026-05-17' });
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
    const s = rangeSpan('6M', T);
    const b = bucketRuns(s.buckets, reader({ '2026-11-09': 4 }, { '2026-11-09': 4.2 }), T);
    expect(b).toHaveLength(26);
    expect(b.slice(0, -1).every((x) => x.planned === 0 && x.done === 0)).toBe(true);
    expect(b.at(-1)).toMatchObject({ planned: 4, done: 4.2, runs: 1 });
  });
});

describe('bucket sums', () => {
  it('has nothing to say with no runs and no plan', () => {
    const b = bucketRuns(rangeSpan('3M', T).buckets, () => none, T);
    expect(b.every((x) => x.done === 0 && x.planned === 0 && x.ahead === 0 && !x.missing)).toBe(true);
    expect(usualOver(b)).toBeNull();
  });

  it('counts runs only up to today, and the plan whole', () => {
    const plan = { '2026-11-09': 4, '2026-11-11': 6, '2026-11-14': 8 };
    const ran = { '2026-11-09': 4.2, '2026-11-14': 9 };
    const w = bucketRuns(rangeSpan('3M', T).buckets, reader(plan, ran), T).at(-1)!;
    expect(w).toMatchObject({ planned: 18, plannedRuns: 3, plannedPast: 4, done: 4.2, runs: 1 });
    const days = bucketRuns(rangeSpan('1W', T).buckets, reader(plan, ran), T);
    expect(days.map((d) => d.done)).toEqual([4.2, 0, 0, 0, 0, 0, 0]);
    expect(days.map((d) => d.planned)).toEqual([4, 0, 6, 0, 0, 8, 0]);
  });

  it('keeps the plan for what is ahead: the days to come, and today until it is run', () => {
    const plan = { '2026-11-03': 5, '2026-11-09': 4, '2026-11-11': 6, '2026-11-14': 8 };
    // today's 6 not run yet: it is still ahead, with Saturday's 8
    const before = bucketRuns(rangeSpan('3M', T).buckets, reader(plan, { '2026-11-09': 4.2 }), T);
    expect(before.at(-1)).toMatchObject({ done: 4.2, ahead: 14 });
    // a week that is over has nothing ahead, whatever it planned and whatever was missed
    expect(before.at(-2)).toMatchObject({ planned: 5, done: 0, ahead: 0 });
    // today's run done (a little short): what is left of today, and Saturday
    const after = bucketRuns(rangeSpan('3M', T).buckets, reader(plan, { '2026-11-09': 4.2, '2026-11-11': 5 }), T);
    expect(after.at(-1)).toMatchObject({ done: 9.2, ahead: 9 });
    // today's run longer than planned: only Saturday is ahead
    expect(bucketRuns(rangeSpan('3M', T).buckets, reader(plan, { '2026-11-11': 7.5 }), T).at(-1)!.ahead).toBe(8);
    // by day: the days behind have none, the days ahead have their plan
    expect(bucketRuns(rangeSpan('1W', T).buckets, reader(plan, { '2026-11-09': 4.2 }), T).map((d) => d.ahead)).toEqual([0, 0, 6, 0, 0, 8, 0]);
    // by month: the rest of the month's plan
    expect(bucketRuns(rangeSpan('12M', T).buckets, reader({ ...plan, '2026-11-28': 10 }, {}), T).at(-1)!.ahead).toBe(24);
  });

  it('marks a bucket that touches a month not loaded, and leaves it out of the usual week', () => {
    const s = rangeSpan('3M', T);
    const ran = Object.fromEntries(s.buckets.map((b) => [b.key, 5]));
    const b = bucketRuns(s.buckets, reader({}, ran), T, (m) => m >= '2026-09');
    expect(b.filter((x) => x.missing).map((x) => x.key)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31']);
    // nine finished weeks that loaded, 5 miles each (this week is not over)
    expect(usualOver(b)).toEqual({ mean: 5, buckets: 9 });
  });

  it('averages finished buckets from where the log begins, never the one holding today', () => {
    const s = rangeSpan('1M', T);
    const [, b2, c, d, e] = s.buckets.map((x) => x.key);
    // nothing in the first week, then 10, 0 and 20, and 7 so far this week
    const u = usualOver(bucketRuns(s.buckets, reader({}, { [b2!]: 10, [d!]: 20, [e!]: 7 }), T));
    expect(u).toEqual({ mean: 10, buckets: 3 });
    expect(c).toBe('2026-10-26');
    // only this week has anything: no finished bucket to count
    expect(usualOver(bucketRuns(s.buckets, reader({}, { [e!]: 7 }), T))).toBeNull();
  });

  it('sums lifting the same way: sessions done up to today, what is still ahead, sets and pounds', () => {
    const lift = (plan: Record<string, number>, did: Record<string, [number, number, number]>) => (d: ISODate): DayLift => ({ planned: plan[d] ?? 0, done: did[d]?.[0] ?? 0, sets: did[d]?.[1] ?? 0, volume: did[d]?.[2] ?? 0 });
    const day = lift({ '2026-11-10': 1, '2026-11-11': 1, '2026-11-12': 1 }, { '2026-11-10': [1, 9, 9270], '2026-11-08': [1, 3, 600] });
    const w = bucketLifts(rangeSpan('3M', T).buckets, day, T);
    expect(w.at(-1)).toMatchObject({ planned: 3, done: 1, ahead: 2, sets: 9, volume: 9270 });
    expect(w.at(-2)).toMatchObject({ planned: 0, done: 1, ahead: 0, sets: 3, volume: 600 });
    expect(bucketLifts(rangeSpan('1W', T).buckets, day, T).map((d) => [d.done, d.ahead])).toEqual([[0, 0], [1, 0], [0, 1], [0, 1], [0, 0], [0, 0], [0, 0]]);
    expect(bucketLifts(rangeSpan('3M', T).buckets, day, T, (m) => m !== '2026-11').at(-1)!.missing).toBe(true);
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

describe('where the bars start', () => {
  const at = (range: Parameters<typeof rangeSpan>[0], ran: Record<string, number>, start: string | null, plan: Record<string, number> = {}) => {
    const span = rangeSpan(range, T, start);
    return firstShown(span, bucketRuns(span.buckets, reader(plan, ran), T), start);
  };

  it('draws every day of this week, a rest day on Monday included', () => {
    expect(at('1W', { '2026-11-10': 5 }, null)).toBe(0);
    expect(at('1W', {}, null, { '2026-11-13': 5 })).toBe(0);
  });

  it('starts at the first bucket with anything in it when the app does not know where the log began', () => {
    // 3M: 13 weeks from Aug 17; the first run is in the week of Sep 7 (the fourth bar)
    expect(at('3M', { '2026-09-09': 4, '2026-10-01': 6 }, null)).toBe(3);
    expect(at('3M', {}, null)).toBe(0);
    // a plan still ahead counts as something
    expect(at('3M', {}, null, { '2026-11-13': 5 })).toBe(12);
  });

  it('starts where the log began when the app knows: a week of rest after it is a week', () => {
    // the log began Aug 20 (the first bar); nothing was run until Sep 9: those weeks are drawn as rest
    expect(at('3M', { '2026-09-09': 4 }, '2026-08-20')).toBe(0);
    // it began before the range: the range's first bucket
    expect(at('3M', { '2026-09-09': 4 }, '2025-01-01')).toBe(0);
    // it began inside the range: the weeks before it are not drawn
    expect(at('3M', { '2026-10-01': 6 }, '2026-09-10')).toBe(3);
    // never later than the first bucket with anything in it (a run older than the app thought)
    expect(at('3M', { '2026-08-25': 3 }, '2026-10-01')).toBe(1);
  });
});

describe('the grid', () => {
  it('draws one to three round gridlines and uses the height it has', () => {
    const cases: Array<[number, number[], number]> = [
      [0, [5, 10], 10],
      // a tallest bar of 1 (a day with one lift session) ends the scale: it stands the whole height
      [0.6, [1], 1],
      [1, [1], 1],
      [1.5, [1], 1.5],
      [1.6, [1, 2], 2],
      [2, [1, 2], 2],
      [3, [1, 2, 3], 3],
      [4.1, [2, 4], 4.1],
      [5, [2, 4], 5],
      [5.2, [2, 4, 6], 6],
      [9, [5, 10], 10],
      [12, [5, 10], 12],
      [13, [5, 10, 15], 15],
      [19.9, [5, 10, 15], 19.9],
      [23.8, [10, 20], 23.8],
      [27, [10, 20, 30], 30],
      [31.4, [10, 20, 30], 31.4],
      [96, [50, 100], 100],
      [118, [50, 100], 118],
      [140, [50, 100, 150], 150],
      [1240, [500, 1000], 1240],
    ];
    for (const [max, lines, top] of cases) expect(gridFor(max), `max ${max}`).toEqual({ lines, top });
  });

  it('holds for any maximum: 1 to 3 lines, evenly stepped from zero, the tallest bar in the top fifth of the plot', () => {
    for (let m = 0.1; m < 6000; m *= 1.07) {
      const { lines, top } = gridFor(m);
      expect(lines.length >= 1 && lines.length <= 3, `max ${m}`).toBe(true);
      expect(lines.every((v, i) => v === lines[0]! * (i + 1))).toBe(true);
      expect(top).toBeGreaterThanOrEqual(m);
      expect(top).toBeGreaterThanOrEqual(lines.at(-1)!);
      // the bars use the plot: the tallest stands at least 80 percent of the way up (under 0.8 the one line stays on 1)
      if (m >= 0.8) expect(m / top, `max ${m}`).toBeGreaterThanOrEqual(0.8);
    }
    expect(gridFor(Number.NaN)).toEqual(gridFor(0));
    expect(gridFor(-3)).toEqual(gridFor(0));
  });

  it('gives an empty chart a scale of its own: 5 and 10 miles, 1 and 2 for whole counts', () => {
    expect(gridFor(0)).toEqual({ lines: [5, 10], top: 10 });
    expect(gridFor(0, 2)).toEqual({ lines: [1, 2], top: 2 });
    // with anything to draw the data sets the scale
    expect(gridFor(3, 2)).toEqual(gridFor(3));
  });
});

describe('axis labels', () => {
  // an 11 px caption with its tracking: about 9 px a letter
  const width = (s: string) => s.length * 9;
  // bars: each bucket has an equal slot of the plot and its label sits under the slot's center
  const layout = (s: RangeSpan, plotW: number) => {
    const n = s.buckets.length;
    const x = (i: number) => (plotW / n) * (i + 0.5);
    return { ls: axisLabels(s, x, width, plotW), x };
  };
  const collide = (ls: ReturnType<typeof axisLabels>, x: (i: number) => number, plotW: number) => {
    const ext = ls.map((l) => labelExtent(x(l.i), width(l.text), plotW));
    // words keep 10 between them; two single letters may sit 6 apart
    return ext.some((e, i) => ext.some((f, j) => i !== j && e[0] < f[1] + (ls[i]!.text.length === 1 && ls[j]!.text.length === 1 ? 6 : 10) && f[0] < e[1] + (ls[i]!.text.length === 1 && ls[j]!.text.length === 1 ? 6 : 10)));
  };

  it('never collides, and never leaves the plot, at any range and phone width', () => {
    for (const r of PROGRESS_RANGES)
      for (const plotW of [210, 240, 288, 306, 352])
        for (const today of [T, '2027-01-03', '2026-06-30'])
          for (const first of ['2023-11-06', '2025-09-08', '2026-09-01']) {
            const s = rangeSpan(r, today, first);
            const { ls, x } = layout(s, plotW);
            expect(collide(ls, x, plotW), `${r} at ${plotW} on ${today} from ${first}`).toBe(false);
            expect(ls.length).toBeGreaterThan(0);
            for (const l of ls) {
              const [a, b] = labelExtent(x(l.i), width(l.text), plotW);
              expect(a).toBeGreaterThanOrEqual(0);
              expect(b).toBeLessThanOrEqual(plotW);
            }
          }
  });

  it('names weekdays in 1W, months in 3M, and Now under this week', () => {
    const w = layout(rangeSpan('1W', T), 306).ls;
    expect(w.map((l) => l.text).join('')).toBe('MTWTFSS');
    expect(w.find((l) => l.now)!.i).toBe(2);
    const m = layout(rangeSpan('3M', T), 306).ls;
    expect(m.at(-1)).toMatchObject({ text: 'Now', now: true, i: 12 });
    expect(m.map((l) => l.text)).toContain('Sep');
  });

  it('names each month in 12M by its initial, and Now under this month', () => {
    const ls = layout(rangeSpan('12M', T), 288).ls;
    expect(ls.at(-1)).toMatchObject({ text: 'Now', i: 11 });
    // December to September by initial; October gives way to "Now" beside it
    expect(ls.slice(0, -1).map((l) => l.text).join('')).toBe('DJFMAMJJAS');
    expect(ls.slice(0, -1).map((l) => l.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps a label whole inside the plot', () => {
    expect(labelExtent(4, 27, 300)).toEqual([0, 27]);
    expect(labelExtent(150, 27, 300)).toEqual([136.5, 163.5]);
    expect(labelExtent(296, 27, 300)).toEqual([273, 300]);
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

  it('says the days a bucket covers, for the readout', () => {
    const s = rangeSpan('3M', T);
    // the bucket holding today is named, not dated
    expect(bucketDates('week', s.buckets.at(-1)!, T)).toBe('This week');
    expect(bucketDates('week', s.buckets.at(-2)!, T)).toBe('Nov 2 to 8');
    expect(bucketDates('week', s.buckets.find((b) => b.key === '2026-09-28')!, T)).toBe('Sep 28 to Oct 4');
    // a week clipped to January 1 says the days it counts
    expect(bucketDates('week', rangeSpan('YTD', '2026-03-10').buckets[0]!, '2026-03-10')).toBe('Jan 1 to 4');
    expect(bucketDates('day', rangeSpan('1W', T).buckets[2]!, T)).toBe('Today');
    expect(bucketDates('day', rangeSpan('1W', T).buckets[4]!, T)).toBe('Fri, Nov 13');
    expect(bucketDates('month', rangeSpan('12M', T).buckets[0]!, T)).toBe('December 2025');
    expect(bucketDates('month', rangeSpan('12M', T).buckets.at(-2)!, T)).toBe('October');
    expect(bucketDates('month', rangeSpan('12M', T).buckets.at(-1)!, T)).toBe('This month');
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
