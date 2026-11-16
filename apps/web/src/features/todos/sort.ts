import { GOAL_STEPS_MAX, type Aim } from '@logbook/shared';
import { LIFT_SCALE, reducedFade, springs } from '@/lib/motion';

/**
 * Sorting to-dos by hand (Plan your day's line, the To-dos sheet): the rules a drag follows, apart from the drawing so a
 * test can read them. The drawing and the finger are in `useSortDrag.ts`.
 */

/** `id` taken out of `order` and put back at index `at` among the others (clamped to the list). */
export const moveTo = (order: readonly string[], id: string, at: number): string[] => {
  const rest = order.filter((x) => x !== id);
  const i = Math.max(0, Math.min(at, rest.length));
  return [...rest.slice(0, i), id, ...rest.slice(i)];
};

/**
 * The slot a dragged row would take: how many of the other rows have their middle above the dragged row's middle. A row
 * the dragged one passes moves out of the way at once, so its middle moves away from the finger and the slot never flickers
 * back, whatever the rows' heights.
 */
export const slotOf = (otherMids: readonly number[], mid: number): number => otherMids.reduce((n, m) => (m < mid ? n + 1 : n), 0);

/** `items` in the order `order` names (a drag's, or a drop's until the cache has it); items it does not name follow, as they were. */
export const inOrder = <T>(items: readonly T[], idOf: (t: T) => string, order: readonly string[] | null | undefined): T[] => {
  if (!order) return [...items];
  const by = new Map(items.map((t) => [idOf(t), t] as const));
  const named = order.flatMap((id) => {
    const t = by.get(id);
    return t ? [t] : [];
  });
  const seen = new Set(order);
  return [...named, ...items.filter((t) => !seen.has(idOf(t)))];
};

/** The order to save after a drop on a surface that shows only some of a list (Today's first three): those, then the rest as they were. */
export const withRest = (shown: readonly string[], all: readonly string[]): string[] => {
  const seen = new Set(shown);
  return [...shown, ...all.filter((id) => !seen.has(id))];
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
/** What the polite status says after a drop: "Moved to second"; past the tenth, "Moved to 12 of 14". */
export const movedWords = (index: number, count: number): string => (index < ORDINALS.length ? `Moved to ${ORDINALS[index]}` : `Moved to ${index + 1} of ${count}`);

/** The day's goal takes a dropped to-do as a step: only while it is open and has room for one more. */
export const takesStep = (goal: Aim | null | undefined): goal is Aim => !!goal && goal.status === 'open' && goal.steps.length < GOAL_STEPS_MAX;

/** Where a dragged to-do can land on Today besides the line: the goal's title (a step) and the two docks. */
export type DropTarget = 'goal' | 'tomorrow' | 'delete';
export interface DropZone {
  kind: DropTarget;
  rect: { left: number; top: number; right: number; bottom: number };
}
/** The zone a finger at `x`, `y` is over: the docks first (they sit over the page), then the goal. `pad` widens each. */
export const zoneAt = (zones: readonly DropZone[], x: number, y: number, pad = 0): DropTarget | null => {
  const hit = (z: DropZone) => x >= z.rect.left - pad && x <= z.rect.right + pad && y >= z.rect.top - pad && y <= z.rect.bottom + pad;
  return (zones.find((z) => z.kind !== 'goal' && hit(z)) ?? zones.find((z) => z.kind === 'goal' && hit(z)))?.kind ?? null;
};

/** Where a dragged row is drawn, kept inside its list's box when the list is a closed card (a group in the sheet). */
export const clampTo = (y: number, min: number, max: number): number => (max < min ? y : Math.max(min, Math.min(max, y)));

// ---------- Reduce Motion ----------

/** A lifted row's scale: the hold's 1.03, or 1 under Reduce Motion (the lift is the surface and the hairline alone). */
export const liftScaleFor = (reduce: boolean): number => (reduce ? 1 : LIFT_SCALE);

/**
 * Where a row whose place changed starts its slide, as an offset from its new place: from where it was drawn (its old
 * place plus any slide it was in). null: its place did not change, so it keeps whatever slide it is in. Under Reduce
 * Motion it does not slide: 0, it is at its place at once.
 */
export const slideFrom = (was: { top: number; drawn: number }, top: number, reduce: boolean): number | null => {
  if (Math.abs(was.top - top) < 0.5) return null;
  return reduce ? 0 : was.top + was.drawn - top;
};

/** The docks come in rising 16 pt on `springs.settle`; under Reduce Motion they fade in where they stand. */
export const dockMotion = (reduce: boolean) =>
  reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: reducedFade }
    : { initial: { opacity: 0, y: -16 }, animate: { opacity: 1, y: 0 }, transition: springs.settle };
