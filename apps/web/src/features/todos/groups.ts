import type { ISODate, Todo } from '@logbook/shared';

// ---------- which list a to-do belongs to on a given day ----------

/** Everything that existed on `date` and was still open, or got done that day. */
export const liveOn = (todos: Todo[] | undefined, date: ISODate) => (todos ?? []).filter((x) => x.createdOn <= date && (!x.doneOn || x.doneOn >= date) && (!x.deletedOn || x.deletedOn > date));

/** Today's working list: Today items, plus any Later item whose day has come. */
export const inToday = (x: Todo, date: ISODate) => x.bucket === 'today' || (x.bucket === 'later' && !!x.due && x.due <= date);

/** What is open in Today's list on `date`: the number on the stat strip. */
export const todayOpenOn = (todos: Todo[] | undefined, date: ISODate) => liveOn(todos, date).filter((x) => (!x.doneOn || x.doneOn > date) && inToday(x, date));

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** High first, then the hand-set order, then age. */
export const byPriority = (a: Todo, b: Todo) => b.priority - a.priority || a.position - b.position || cmpStr(a.createdAt, b.createdAt);
/** Dated items by date, then priority and the hand-set order. */
export const byDue = (a: Todo, b: Todo) => (a.due && b.due ? cmpStr(a.due, b.due) : a.due ? -1 : b.due ? 1 : 0) || byPriority(a, b);
export const byPosition = (a: Todo, b: Todo) => a.position - b.position || cmpStr(a.createdAt, b.createdAt);

/** What a group is ordered by first: the thing a dragged row adopts when it lands among different neighbours. */
export type Tier = 'priority' | 'due' | 'none';
export interface TodoGroupSpec {
  key: 'today' | 'later' | 'someday' | 'done';
  items: Todo[];
  sort: (a: Todo, b: Todo) => number;
  tier: Tier;
}

/** The four lists for a day, each already in display order. */
export const groupsOn = (todos: Todo[] | undefined, date: ISODate): TodoGroupSpec[] => {
  const all = liveOn(todos, date);
  const open = all.filter((x) => x.doneOn !== date);
  return [
    { key: 'today', items: open.filter((x) => inToday(x, date)).sort(byPriority), sort: byPriority, tier: 'priority' },
    { key: 'later', items: open.filter((x) => x.bucket === 'later' && !inToday(x, date)).sort(byDue), sort: byDue, tier: 'due' },
    { key: 'someday', items: open.filter((x) => x.bucket === 'someday').sort(byPriority), sort: byPriority, tier: 'priority' },
    { key: 'done', items: all.filter((x) => x.doneOn === date).sort(byPosition), sort: byPosition, tier: 'none' },
  ];
};

/**
 * After a move, the item adopts the tier it landed in, so the move means what it looked like:
 * dropped among the high rows it becomes high; dropped among Friday's rows it becomes Friday's.
 * `list` is the new order. Returns the fields to patch, or null when nothing changes.
 */
export const settleInto = (list: Todo[], id: string, tier: Tier): Partial<Pick<Todo, 'priority' | 'due'>> | null => {
  const i = list.findIndex((x) => x.id === id);
  const x = list[i];
  if (!x) return null;
  const prev = list[i - 1];
  const next = list[i + 1];
  if (tier === 'priority') {
    // the list runs high → low, so the row above bounds it from above and the row below from below
    const p = Math.min(prev?.priority ?? 2, Math.max(next?.priority ?? 0, x.priority));
    return p !== x.priority ? { priority: p as Todo['priority'] } : null;
  }
  if (tier === 'due' && x.due) {
    let d = x.due;
    if (prev?.due && d < prev.due) d = prev.due;
    if (next?.due && d > next.due) d = next.due;
    return d !== x.due ? { due: d } : null;
  }
  return null;
};

/** One step up or down inside a group: the new order and what the moved row adopts. Null when it cannot move. */
export const stepWithin = (items: Todo[], id: string, dir: -1 | 1, tier: Tier): { order: string[]; fix: ReturnType<typeof settleInto> } | null => {
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return null;
  const next = [...items];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return { order: next.map((x) => x.id), fix: settleInto(next, id, tier) };
};
