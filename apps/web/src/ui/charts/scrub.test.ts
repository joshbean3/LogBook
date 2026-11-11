import { describe, expect, it } from 'vitest';
import { SCRUB_CLAIM_PX, SCRUB_SCROLL_PX } from '@/lib/gesture';
import { BAR_SHARE, barCenter, barLayout, bucketAt, MAX_BAR, MIN_BAR, scrubIntent, stepIndex } from './scrub';

describe('the bars', () => {
  it('gives each bucket an equal slot and a bar centered in it', () => {
    const l = barLayout(288, 13);
    expect(l.slot).toBeCloseTo(288 / 13);
    expect(l.barW).toBeCloseTo((288 / 13) * BAR_SHARE);
    expect(barCenter(l, 0)).toBeCloseTo(l.slot / 2);
    expect(barCenter(l, 12)).toBeCloseTo(288 - l.slot / 2);
    // the first bar starts inside the plot and the last ends inside it
    expect(barCenter(l, 0) - l.barW / 2).toBeGreaterThan(0);
    expect(barCenter(l, 12) + l.barW / 2).toBeLessThan(288);
  });

  it('keeps bars apart at every range and phone width, never wider than 24 or thinner than 2', () => {
    // the bars area on a 320, 390 and 440 pt phone, for 5 to 60 buckets (a five-year All by month)
    for (const plotW of [218, 288, 338])
      for (const n of [1, 5, 7, 11, 12, 13, 15, 26, 36, 60]) {
        const l = barLayout(plotW, n);
        expect(l.barW).toBeLessThanOrEqual(MAX_BAR);
        expect(l.barW).toBeGreaterThanOrEqual(MIN_BAR);
        // a gap between neighbors, so two bars never read as one: 1.5 px or more up to three years by month, and
        // still a full pixel for a five-year All on the narrowest phone
        if (n > 1) expect(l.slot - l.barW, `${n} bars in ${plotW}`).toBeGreaterThanOrEqual(n <= 36 ? 1.5 : 1);
        expect(l.slot * n).toBeCloseTo(plotW);
      }
    // at the ranges people use most a bar is at least 5 px wide, wide enough to hold its rim
    for (const [plotW, n] of [[218, 26], [288, 26], [218, 13], [218, 12]] as const) expect(barLayout(plotW, n).barW).toBeGreaterThanOrEqual(5);
  });

  it('survives nothing to draw', () => {
    expect(barLayout(288, 0)).toMatchObject({ n: 0 });
    expect(bucketAt(barLayout(288, 0), 40)).toBeNull();
    expect(bucketAt(barLayout(0, 5), 40)).toBeNull();
    expect(bucketAt(barLayout(288, 13), Number.NaN)).toBeNull();
  });
});

describe('the bucket under a finger', () => {
  const l = barLayout(260, 13); // 20 px slots

  it('is the slot the point falls in, edge to edge with no dead zones', () => {
    expect(bucketAt(l, 0)).toBe(0);
    expect(bucketAt(l, 19.9)).toBe(0);
    expect(bucketAt(l, 20)).toBe(1);
    expect(bucketAt(l, 130)).toBe(6);
    expect(bucketAt(l, 259.9)).toBe(12);
    // every pixel across the plot reads some bucket, and they only ever go up
    let last = -1;
    for (let x = 0; x < 260; x += 0.5) {
      const i = bucketAt(l, x)!;
      expect(i).toBeGreaterThanOrEqual(last);
      expect(i - last).toBeLessThanOrEqual(1);
      last = i;
    }
    expect(last).toBe(12);
  });

  it('keeps reading the end when the finger slides past it', () => {
    expect(bucketAt(l, -40)).toBe(0);
    expect(bucketAt(l, 400)).toBe(12);
  });

  it('never reads a bucket before the log began', () => {
    expect(bucketAt(l, 5, 4)).toBe(4);
    expect(bucketAt(l, 85, 4)).toBe(4);
    expect(bucketAt(l, 105, 4)).toBe(5);
    // a first bucket past the end is held to the last one
    expect(bucketAt(l, 5, 40)).toBe(12);
  });

  it('honors a plot that does not start at zero', () => {
    const off = barLayout(260, 13, 8);
    expect(bucketAt(off, 7)).toBe(0);
    expect(bucketAt(off, 28)).toBe(1);
    expect(barCenter(off, 0)).toBe(18);
  });
});

describe('a touch on the chart', () => {
  it('is nothing yet while it has barely moved', () => {
    expect(scrubIntent(0, 0)).toBeNull();
    expect(scrubIntent(SCRUB_CLAIM_PX - 1, 0)).toBeNull();
    expect(scrubIntent(0, SCRUB_SCROLL_PX - 1)).toBeNull();
    expect(scrubIntent(4, 4)).toBeNull();
  });

  it('reads the chart once it has moved sideways, either way', () => {
    expect(scrubIntent(SCRUB_CLAIM_PX, 0)).toBe('scrub');
    expect(scrubIntent(-SCRUB_CLAIM_PX, 0)).toBe('scrub');
    expect(scrubIntent(12, 5)).toBe('scrub');
    expect(scrubIntent(-30, -22)).toBe('scrub');
  });

  it('scrolls the page once it has moved up or down, and never claims a diagonal for the chart', () => {
    expect(scrubIntent(0, SCRUB_SCROLL_PX)).toBe('scroll');
    expect(scrubIntent(3, -40)).toBe('scroll');
    expect(scrubIntent(9, 12)).toBe('scroll');
    // exactly diagonal: the page keeps it
    expect(scrubIntent(10, 10)).toBe('scroll');
    expect(scrubIntent(8, 8)).toBeNull();
    // mostly sideways with a little drift still reads
    expect(scrubIntent(10, 9)).toBe('scrub');
  });

  it('claims a sideways drag before the page can start a scroll', () => {
    // a phone starts a scroll after about 10 px of travel: the chart claims at 6
    expect(SCRUB_CLAIM_PX).toBeLessThan(SCRUB_SCROLL_PX);
    // a thumb arcing across the chart drifts up as it goes: every step of it reads, none scrolls
    for (let x = SCRUB_CLAIM_PX; x <= 240; x += 6) expect(scrubIntent(x, -x * 0.35)).toBe('scrub');
  });
});

describe('the keys', () => {
  const o = { count: 13, home: 12, min: 3 };

  it('move one bucket from the one holding today on the first press', () => {
    expect(stepIndex('ArrowLeft', null, o)).toBe(11);
    expect(stepIndex('ArrowDown', null, o)).toBe(11);
    // already at the last bucket: Right stays there (and shows it)
    expect(stepIndex('ArrowRight', null, o)).toBe(12);
    expect(stepIndex('ArrowUp', null, o)).toBe(12);
    expect(stepIndex('ArrowRight', null, { ...o, home: 6 })).toBe(7);
  });

  it('step one bucket at a time and stop at the ends', () => {
    expect(stepIndex('ArrowLeft', 8, o)).toBe(7);
    expect(stepIndex('ArrowRight', 8, o)).toBe(9);
    expect(stepIndex('ArrowLeft', 3, o)).toBe(3);
    expect(stepIndex('ArrowRight', 12, o)).toBe(12);
  });

  it('jump to the first bucket that can be read and to the last', () => {
    expect(stepIndex('Home', 9, o)).toBe(3);
    expect(stepIndex('End', 5, o)).toBe(12);
  });

  it('leave every other key alone, and an empty chart too', () => {
    for (const k of ['Enter', ' ', 'Escape', 'Tab', 'a', 'PageUp']) expect(stepIndex(k, 5, o)).toBeNull();
    expect(stepIndex('ArrowLeft', null, { count: 0, home: 0, min: 0 })).toBeNull();
  });

  it('hold a reading that is out of range to the range', () => {
    expect(stepIndex('ArrowLeft', 40, o)).toBe(11);
    expect(stepIndex('ArrowRight', 0, o)).toBe(4);
    expect(stepIndex('Home', null, { count: 5, home: 4, min: 9 })).toBe(4);
  });
});
