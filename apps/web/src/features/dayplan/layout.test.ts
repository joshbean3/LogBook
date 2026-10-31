import { emptyBands } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { addAtWords, clampMinutes, clampStart, clockShort, hourLabel, hoursOf, metaWords, minutesAtY, minutesWords, nextFree, overlapIndent, paintOrder, placeSlot, placedOf, plannedWords, PX_PER_MIN, rangeWords, slotRect, snap15, trayOf, unscheduleSlot, windowOf } from './layout';
import type { DaySlot } from './types';

const W = { start: 360, end: 1380 };
const slot = (ref: string, start: number, minutes: number): DaySlot => ({ ref: ref as DaySlot['ref'], start, minutes });

describe('the window', () => {
  it('defaults to 06:00 – 23:00', () => {
    expect(windowOf(null, null)).toEqual({ start: 360, end: 1380 });
    expect(windowOf({ window: { start: 420, end: 1320 } }, null)).toEqual({ start: 420, end: 1320 });
  });
  it('opens earlier for an early alarm, rounded down to the hour', () => {
    expect(windowOf(null, { wake: 5 * 60 + 40 })).toEqual({ start: 300, end: 1380 });
    expect(windowOf(null, { wake: 7 * 60 })).toEqual({ start: 360, end: 1380 });
  });
  it('stretches to the hour around a slot outside it', () => {
    expect(windowOf(null, null, [slot('todo:a', 23 * 60 + 15, 30)])).toEqual({ start: 360, end: 1440 });
    expect(windowOf(null, null, [slot('todo:a', 4 * 60 + 30, 30)])).toEqual({ start: 240, end: 1380 });
  });
});

describe('slotRect', () => {
  it('maps minutes to px at 56 per hour', () => {
    expect(slotRect({ start: 450, minutes: 30 }, W)).toEqual({ top: 84, height: 28 });
    expect(slotRect({ start: 360, minutes: 60 }, W)).toEqual({ top: 0, height: 56 });
  });
  it('never draws a block under 24 px', () => {
    expect(slotRect({ start: 360, minutes: 15 }, W).height).toBe(24);
    expect(slotRect({ start: 360, minutes: 5 }, W).height).toBe(24);
  });
  it('reads minutes back from a y', () => {
    expect(minutesAtY(84, W)).toBeCloseTo(450);
    expect(snap15(minutesAtY(90, W))).toBe(450);
    expect(minutesAtY(28 * PX_PER_MIN * 2, W)).toBeCloseTo(360 + 56);
  });
});

describe('snap and clamp', () => {
  it('snaps to the nearest quarter hour', () => {
    expect(snap15(452)).toBe(450);
    expect(snap15(458)).toBe(465);
    expect(snap15(0)).toBe(0);
  });
  it('keeps a block inside the window', () => {
    expect(clampStart(300, 30, W)).toBe(360);
    expect(clampStart(1370, 30, W)).toBe(1350);
    expect(clampStart(600, 30, W)).toBe(600);
  });
  it('sizes in 15-minute steps, 15 at least, never past the end', () => {
    expect(clampMinutes(7, 600, W)).toBe(15);
    expect(clampMinutes(37, 600, W)).toBe(30);
    expect(clampMinutes(90, 1350, W)).toBe(30);
  });
  it('lists the hours from the first whole hour to the end', () => {
    expect(hoursOf({ start: 330, end: 480 })).toEqual([360, 420, 480]);
    expect(hoursOf({ start: 360, end: 480 })).toEqual([360, 420, 480]);
  });
});

describe('overlapIndent', () => {
  it('indents a block that starts inside another, two levels at most', () => {
    const a = slot('todo:a', 540, 120);
    const b = slot('todo:b', 570, 30);
    const c = slot('todo:c', 580, 30);
    const d = slot('todo:d', 585, 30);
    const lv = overlapIndent([d, c, b, a]);
    expect(lv.get('todo:a')).toBe(0);
    expect(lv.get('todo:b')).toBe(1);
    expect(lv.get('todo:c')).toBe(2);
    expect(lv.get('todo:d')).toBe(2);
  });
  it('a block that starts when another ends is not inside it', () => {
    const lv = overlapIndent([slot('todo:a', 540, 30), slot('todo:b', 570, 30)]);
    expect(lv.get('todo:b')).toBe(0);
  });
  it('paints by level, then by start', () => {
    const a = slot('todo:a', 540, 120);
    const b = slot('todo:b', 570, 30);
    const z = slot('todo:z', 400, 30);
    expect(paintOrder([b, a, z], overlapIndent([b, a, z])).map((s) => s.ref)).toEqual(['todo:z', 'todo:a', 'todo:b']);
  });
});

describe('the tray', () => {
  const items = [{ ref: 'step:g:1' }, { ref: 'todo:a', altRefs: ['todo:tmp-a'] }, { ref: 'todo:b' }, { ref: 'todo:c' }];
  it('is everything live that is placed nowhere, the bands first in band order', () => {
    const plan = { bands: { ...emptyBands(), afternoon: ['todo:c'], morning: ['todo:b', 'todo:gone'] }, slots: [slot('todo:a', 540, 30)] };
    expect(trayOf(plan, items).map((i) => i.ref)).toEqual(['todo:b', 'todo:c', 'step:g:1']);
  });
  it('knows a to-do by the provisional id it was born with', () => {
    const plan = { bands: emptyBands(), slots: [slot('todo:tmp-a', 540, 30)] };
    expect(trayOf(plan, items).map((i) => i.ref)).toEqual(['step:g:1', 'todo:b', 'todo:c']);
    expect(placedOf(plan, items).map((p) => [p.slot.ref, p.item.ref])).toEqual([['todo:a', 'todo:a']]);
  });
  it('with no plan everything is in the tray, steps first', () => {
    expect(trayOf(undefined, items).map((i) => i.ref)).toEqual(['step:g:1', 'todo:a', 'todo:b', 'todo:c']);
  });
  it('drops a slot that names nothing live', () => {
    expect(placedOf({ slots: [slot('todo:gone', 540, 30)] }, items)).toEqual([]);
  });
});

describe('plan edits', () => {
  const plan = { bands: { ...emptyBands(), morning: ['todo:a', 'todo:b'] }, slots: [slot('todo:c', 540, 30)] };
  it('placing takes the ref out of the bands and replaces its slot', () => {
    const next = placeSlot(plan, slot('todo:a', 600, 45));
    expect(next.bands.morning).toEqual(['todo:b']);
    expect(next.slots).toEqual([slot('todo:c', 540, 30), slot('todo:a', 600, 45)]);
    expect(placeSlot(next, slot('todo:c', 660, 15)).slots).toEqual([slot('todo:a', 600, 45), slot('todo:c', 660, 15)]);
  });
  it('unscheduling removes the slot and leaves the bands', () => {
    const next = unscheduleSlot(plan, 'todo:c');
    expect(next.slots).toEqual([]);
    expect(next.bands.morning).toEqual(['todo:a', 'todo:b']);
  });
  it('finds the next free quarter hour', () => {
    const busy = [slot('todo:a', 540, 60), slot('todo:b', 600, 30)];
    expect(nextFree(busy, 500, 30, W)).toBe(510);
    expect(nextFree(busy, 545, 30, W)).toBe(630);
    expect(nextFree(busy, 1370, 30, W)).toBeNull();
    expect(nextFree([], 100, 30, W)).toBe(360);
  });
});

describe('words', () => {
  it('speaks the clock without a meridiem', () => {
    expect(clockShort(450)).toBe('7:30');
    expect(clockShort(0)).toBe('12:00');
    expect(clockShort(765)).toBe('12:45');
    expect(rangeWords(450, 30)).toBe('7:30 – 8:00');
    expect(addAtWords(870)).toBe('Add at 2:30');
  });
  it('lengths and the head', () => {
    expect(minutesWords(30)).toBe('30 min');
    expect(minutesWords(90)).toBe('1 h 30 min');
    expect(minutesWords(120)).toBe('2 h');
    expect(plannedWords(225)).toBe('3 h 45');
    expect(plannedWords(45)).toBe('45 min');
    expect(metaWords(3, 7, 225)).toBe('3 of 7 done · 3 h 45 planned');
    expect(metaWords(0, 2, 0)).toBe('0 of 2 done');
    expect(metaWords(0, 0, 0)).toBeNull();
  });
  it('hour labels', () => {
    expect(hourLabel(360)).toBe('6 AM');
    expect(hourLabel(720)).toBe('12 PM');
    expect(hourLabel(0)).toBe('12 AM');
    expect(hourLabel(1380)).toBe('11 PM');
  });
});
