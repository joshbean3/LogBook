import type { Aim } from '@logbook/shared';
import { GOAL_STEPS_MAX } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { LIFT_SCALE, reducedFade, springs } from '@/lib/motion';
import { clampTo, dockMotion, inOrder, liftScaleFor, movedWords, moveTo, slideFrom, slotOf, takesStep, withRest, zoneAt, type DropZone } from './sort';

describe('a row taken to a new place', () => {
  it('goes to the index among the others', () => {
    expect(moveTo(['a', 'b', 'c', 'd'], 'c', 0)).toEqual(['c', 'a', 'b', 'd']);
    expect(moveTo(['a', 'b', 'c', 'd'], 'a', 3)).toEqual(['b', 'c', 'd', 'a']);
    expect(moveTo(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });
  it('is held to the list', () => {
    expect(moveTo(['a', 'b'], 'a', 9)).toEqual(['b', 'a']);
    expect(moveTo(['a', 'b'], 'b', -3)).toEqual(['b', 'a']);
  });
});

describe('the slot under the finger', () => {
  it('counts the rows whose middle is above the dragged row’s middle', () => {
    expect(slotOf([24, 72, 120], 10)).toBe(0);
    expect(slotOf([24, 72, 120], 80)).toBe(2);
    expect(slotOf([24, 72, 120], 500)).toBe(3);
  });
  it('does not flicker back once a row has made room: the passed row’s middle moves away from the finger', () => {
    // dragging a 64 pt row down past a 48 pt one: the swap puts the other row's middle 64 pt higher
    const mid = 100;
    expect(slotOf([96], mid)).toBe(1);
    expect(slotOf([96 - 64], mid)).toBe(1);
  });
});

describe('the order on screen', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('follows a drag’s order', () => {
    expect(inOrder(items, (x) => x.id, ['c', 'a', 'b']).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
  it('is the data’s with no order, and keeps a row the order does not name (it came in during the drag)', () => {
    expect(inOrder(items, (x) => x.id, null).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(inOrder(items, (x) => x.id, ['b', 'a']).map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });
  it('drops a row that left the data (dropped on a dock)', () => {
    expect(inOrder(items, (x) => x.id, ['z', 'c', 'a', 'b']).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
  it('saves Today’s three in their new order, then the rest as they were', () => {
    expect(withRest(['c', 'a', 'b'], ['a', 'b', 'c', 'd', 'e'])).toEqual(['c', 'a', 'b', 'd', 'e']);
  });
});

describe('the polite status after a drop', () => {
  it('names the place', () => {
    expect(movedWords(0, 5)).toBe('Moved to first');
    expect(movedWords(1, 5)).toBe('Moved to second');
    expect(movedWords(9, 12)).toBe('Moved to tenth');
    expect(movedWords(11, 14)).toBe('Moved to 12 of 14');
  });
});

describe('the drop targets on Today', () => {
  const goal = (status: Aim['status'], steps: number) => ({ status, steps: Array.from({ length: steps }, (_, i) => ({ id: String(i), text: 's', done: false })) }) as unknown as Aim;
  it('the goal takes a step only while it is open and has room', () => {
    expect(takesStep(goal('open', 0))).toBe(true);
    expect(takesStep(goal('open', GOAL_STEPS_MAX - 1))).toBe(true);
    expect(takesStep(goal('open', GOAL_STEPS_MAX))).toBe(false);
    expect(takesStep(goal('done', 0))).toBe(false);
    expect(takesStep(null)).toBe(false);
  });
  const zones: DropZone[] = [
    { kind: 'goal', rect: { left: 0, top: 0, right: 390, bottom: 120 } },
    { kind: 'tomorrow', rect: { left: 60, top: 4, right: 200, bottom: 48 } },
    { kind: 'delete', rect: { left: 214, top: 4, right: 324, bottom: 48 } },
  ];
  it('a dock comes before the goal under it', () => {
    expect(zoneAt(zones, 100, 20)).toBe('tomorrow');
    expect(zoneAt(zones, 250, 20)).toBe('delete');
    expect(zoneAt(zones, 30, 20)).toBe('goal');
    expect(zoneAt(zones, 100, 300)).toBe(null);
  });
  it('takes the finger a little outside its box', () => {
    const docks = zones.slice(1);
    expect(zoneAt(docks, 330, 20)).toBe(null);
    expect(zoneAt(docks, 330, 20, 6)).toBe('delete');
  });
  it('a goal hidden under the sticky strip (its top below its bottom) takes nothing', () => {
    expect(zoneAt([{ kind: 'goal', rect: { left: 0, top: 130, right: 390, bottom: 100 } }], 100, 110)).toBe(null);
  });
});

describe('a row kept in its group', () => {
  it('is held between the group’s edges', () => {
    expect(clampTo(-40, -20, 100)).toBe(-20);
    expect(clampTo(140, -20, 100)).toBe(100);
    expect(clampTo(30, -20, 100)).toBe(30);
  });
});

describe('Reduce Motion', () => {
  it('nothing scales: the lift is the surface and the hairline alone', () => {
    expect(liftScaleFor(true)).toBe(1);
    expect(liftScaleFor(false)).toBe(LIFT_SCALE);
  });
  it('rows jump to their places instead of sliding', () => {
    expect(slideFrom({ top: 100, drawn: 0 }, 148, true)).toBe(0);
    expect(slideFrom({ top: 100, drawn: 0 }, 148, false)).toBe(-48);
  });
  it('a row mid-slide starts from where it is drawn, and one whose place did not change keeps its slide', () => {
    expect(slideFrom({ top: 100, drawn: 20 }, 148, false)).toBe(-28);
    expect(slideFrom({ top: 100, drawn: 20 }, 100, false)).toBe(null);
  });
  it('the docks appear without rising', () => {
    expect(dockMotion(true)).toEqual({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: reducedFade });
    expect(dockMotion(false).initial).toEqual({ opacity: 0, y: -16 });
    expect(dockMotion(false).transition).toBe(springs.settle);
  });
});
