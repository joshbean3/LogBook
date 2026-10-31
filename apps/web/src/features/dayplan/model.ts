import { DAY_BANDS, emptyBands, stepRef, todoRef, type Aim, type DayBand, type DayBands, type GoalStep, type ISODate, type Todo } from '@logbook/shared';
import { clientKey } from '@/api/queries';
import { byPosition, byPriority, groupsOn, liveOn } from '../todos/groups';

/** One thing on the board: a to-do, or a step of the day's goal. `ref` is what the plan stores. */
export type Card = { ref: string; kind: 'todo'; todo: Todo; done: boolean } | { ref: string; kind: 'step'; goal: Aim; step: GoalStep; done: boolean };

/** Where a card can sit: one of the three bands, or the tray of what has no time yet. */
export type Place = DayBand | 'tray';

/**
 * What a day holds: the day goal's steps first, then its to-dos. Today: the open Today items (and any Later item whose day has
 * come) and what was done today, which stays on the board, struck. Ahead: what is due that day. Behind: what was due, and
 * what got done.
 */
export const cardsFor = (todos: Todo[] | undefined, goal: Aim | null, date: ISODate, today: ISODate): Card[] => {
  const steps: Card[] = goal ? goal.steps.map((s) => ({ ref: stepRef(goal.id, s.id), kind: 'step', goal, step: s, done: s.done })) : [];
  let list: Todo[];
  if (date === today) {
    const g = groupsOn(todos, date);
    list = [...g[0]!.items, ...g[3]!.items];
  } else if (date < today) list = liveOn(todos, date).filter((x) => x.doneOn === date || (x.due === date && (!x.doneOn || x.doneOn > date))).sort(byPosition);
  else list = (todos ?? []).filter((x) => !x.deletedOn && !x.doneOn && x.due === date).sort(byPriority);
  return [...steps, ...list.map((x): Card => ({ ref: todoRef(x.id), kind: 'todo', todo: x, done: x.doneOn === date || (date === today && !!x.doneOn) }))];
};

export interface Laid {
  tray: Card[];
  bands: Record<DayBand, Card[]>;
}

/**
 * The cards in their places: each band in the plan's order, the rest in the tray. A to-do made offline is stored under its
 * provisional id until the plan is read again, so both of its ids find it.
 */
export const lay = (cards: Card[], plan: DayBands): Laid => {
  const by = new Map<string, Card>();
  for (const c of cards) {
    by.set(c.ref, c);
    if (c.kind === 'todo') by.set(todoRef(clientKey(c.todo.id)), c);
  }
  const placed = new Set<Card>();
  const bands = { morning: [] as Card[], afternoon: [] as Card[], evening: [] as Card[] };
  for (const b of DAY_BANDS)
    for (const r of plan[b]) {
      const c = by.get(r);
      if (c && !placed.has(c)) {
        placed.add(c);
        bands[b].push(c);
      }
    }
  return { tray: cards.filter((c) => !placed.has(c)), bands };
};

/** The plan as it should be stored: the laid-out bands, under each card's current id. */
export const bandsOf = (laid: Laid): DayBands => ({ morning: laid.bands.morning.map((c) => c.ref), afternoon: laid.bands.afternoon.map((c) => c.ref), evening: laid.bands.evening.map((c) => c.ref) });

/** Move one card to `to` at `index` (the index counts the cards there without it). */
export const moveCard = (laid: Laid, ref: string, to: Place, index: number): Laid => {
  let card: Card | undefined;
  const strip = (l: Card[]) =>
    l.filter((c) => {
      if (c.ref !== ref) return true;
      card = c;
      return false;
    });
  const next: Laid = { tray: strip(laid.tray), bands: { morning: strip(laid.bands.morning), afternoon: strip(laid.bands.afternoon), evening: strip(laid.bands.evening) } };
  if (!card) return laid;
  const list = to === 'tray' ? next.tray : next.bands[to];
  list.splice(Math.max(0, Math.min(index, list.length)), 0, card);
  return next;
};

/** Where a card is now, and at what index. */
export const placeOf = (laid: Laid, ref: string): { place: Place; index: number } | null => {
  const i = laid.tray.findIndex((c) => c.ref === ref);
  if (i >= 0) return { place: 'tray', index: i };
  for (const b of DAY_BANDS) {
    const j = laid.bands[b].findIndex((c) => c.ref === ref);
    if (j >= 0) return { place: b, index: j };
  }
  return null;
};

/** Replace one card's reference with another in place (a to-do dropped on the goal becomes one of its steps, where it was). */
export const swapRef = (plan: DayBands, from: string, to: string): DayBands => {
  const out = emptyBands();
  for (const b of DAY_BANDS) out[b] = plan[b].map((r) => (r === from ? to : r));
  return out;
};

/** Each section of the day: its words, its colour (the feel palette), and the icon a to-do there gets when its words name none. */
export const BAND: Record<Place, { label: string; span: string; hue: string; icon: string }> = {
  tray: { label: 'Anytime', span: 'Whenever today works', hue: 'var(--mint)', icon: '✨' },
  morning: { label: 'Morning', span: 'Until noon', hue: 'var(--sun)', icon: '☀️' },
  afternoon: { label: 'Afternoon', span: 'Noon to 5', hue: 'var(--sky)', icon: '🌤️' },
  evening: { label: 'Evening', span: 'After 5', hue: 'var(--coral)', icon: '🌙' },
};

/** How a band stands against the clock today: still to come, now, or over. */
export const bandTime = (b: DayBand, hour: number): 'ahead' | 'now' | 'past' => {
  const [from, to] = b === 'morning' ? [0, 12] : b === 'afternoon' ? [12, 17] : [17, 24];
  return hour < from ? 'ahead' : hour >= to ? 'past' : 'now';
};
