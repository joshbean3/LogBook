import { baselineOf, canAdd, isOpen, menuFor, mondayOf, monthsBetween, shiftDays, slotOf, type Challenge, type ChallengeFacts, type ISODate, type Offer, type Rewards, type Slot } from '@logbook/shared';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { PREFS_EVENT, useFitness } from '@/lib/prefs';
import { useToday } from '@/lib/useToday';
import { challengeFacts, factsReady, habitDaysIn, readCaches } from '../dayFacts';
import { useOrbsStore } from '../store';
import { rowView, rowsFor, weekOfferDay, type RowView, type Scope } from './model';

/**
 * The challenges on this phone, read for the row and the sheet: today's slot and this week's (and last week's, for a week
 * challenge that was finished after its week), the challenge each holds in the Orbs store, the facts it is read against
 * (the engine's own adapter, `challengeFacts`, through the same Fitness filter as the screens) and the row's words.
 *
 * It follows the caches the facts come from (to-dos, months, goals, lines, the bootstrap) as the reconciler does, at most
 * once per frame, and reads nothing at all while the store holds no challenge for these slots, which is most days.
 */
export interface Live {
  slot: Slot;
  challenge: Challenge;
  facts: ChallengeFacts;
  view: RowView | null;
  /** What the once-ledger holds for the slot. */
  paid: number;
  /** Does the slot's day still take taps by the real clock? Always true for a week slot. */
  tapsOpen: boolean;
}
export interface Board {
  today: ISODate;
  slots: Slot[];
  live: Record<string, Live>;
  views: Record<string, RowView | null>;
  /** The day Today shows the week challenge's offer (`weekOfferDay`). */
  offerDay: ISODate;
  /**
   * This phone's own menu for a slot, now, less what could not be added now: what the assistant's pick is checked
   * against (a pick the phone could not add would take the offer away).
   */
  menuOf: (key: string) => Offer[];
}

const WATCHED = new Set(['todos', 'month', 'goals', 'learnings', 'bootstrap']);
/** A number that changes, at most once per frame, when a cache the facts are read from does. */
const useCachesTick = (qc: QueryClient, on: boolean): number => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setTick((n) => n + 1);
      });
    };
    const off = qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' ? e.action.type !== 'success' : e.type !== 'added' && e.type !== 'removed') return;
      if (WATCHED.has(String(e.query.queryKey[0]))) bump();
    });
    window.addEventListener(PREFS_EVENT, bump);
    return () => {
      off();
      window.removeEventListener(PREFS_EVENT, bump);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [qc, on]);
  return tick;
};

/**
 * The slots a row could be for: today's day slot, this week's, and last week's week slot. Read by key from the store (what
 * the store holds is what shows, whichever cadence it was offered under); the engine only ever offers in an account's own
 * slots (`challengeSlots`).
 */
export const slotsFor = (userId: string, today: ISODate): Slot[] => {
  const monday = mondayOf(today);
  return [slotOf(userId, `challenge:d:${today}`), slotOf(userId, `challenge:w:${monday}`), slotOf(userId, `challenge:w:${shiftDays(monday, -7)}`)];
};
const SHOWABLE = new Set<Challenge['state']>(['offered', 'added', 'done']);
/** The slots that hold a challenge that could show: nothing else is worth reading the caches for. */
export const candidates = (store: Rewards | null, today: ISODate): Slot[] => (store && store.set.on && store.set.cadence !== 0 ? slotsFor(store.userId, today).filter((s) => SHOWABLE.has(store.challenges[s.key]?.state as Challenge['state'])) : []);

/**
 * Build the board from the store and the caches as they stand. Null while the facts have not loaded. `today` is the day
 * the place stands on (Today holds yesterday past midnight); `now` is the real clock, which says whether that day still
 * takes taps (`isOpen`): past 03:00 it does not, the engine settles nothing for it, and its challenge shows nowhere.
 */
export const boardOf = (qc: QueryClient, store: Rewards, today: ISODate, fitness: boolean, now: Date = new Date()): Board | null => {
  const slots = candidates(store, today);
  const offerDay = weekOfferDay(store.challenges, today);
  if (!slots.length) return { today, slots, live: {}, views: {}, offerDay, menuOf: () => [] };
  const monday = mondayOf(today);
  const c = readCaches(qc, fitness, monthsBetween(shiftDays(monday, -28), shiftDays(monday, 6)));
  if (!c || !factsReady(c, today)) return null;
  const live: Board['live'] = {};
  const views: Board['views'] = {};
  for (const slot of slots) {
    const challenge = store.challenges[slot.key]!;
    const facts = challengeFacts(c, store, slot, today);
    const paid = store.once[slot.key]?.n ?? 0;
    const tapsOpen = slot.kind !== 'day' || isOpen(slot.date, now, 'tap');
    const view = rowView(challenge, slot, facts, today, paid, tapsOpen);
    live[slot.key] = { slot, challenge, facts, view, paid, tapsOpen };
    views[slot.key] = view;
  }
  const menuOf = (key: string): Offer[] => {
    const l = live[key];
    if (!l) return [];
    const past = [4, 3, 2, 1].map((w) => habitDaysIn(c, shiftDays(monday, -7 * w), shiftDays(monday, -7 * w + 6)));
    return menuFor(l.slot, baselineOf(store, today, past), l.facts, store.set.size).filter((o) => canAdd({ ...o, state: 'offered', at: '' }, l.slot, l.facts));
  };
  return { today, slots, live, views, offerDay, menuOf };
};

/**
 * The board, kept in step with the store, the caches, the day and the Fitness switch. Null while Orbs are off or nothing
 * has loaded. The day is the place's own (`useToday`: inside Today that is the day Today holds, past midnight too). A
 * sheet is drawn outside its page, so it is handed the day its row stood on (`day`): read by the clock's day it would find
 * no challenge there after midnight and close under the finger.
 */
export const useBoard = (day?: ISODate): Board | null => {
  const qc = useQueryClient();
  const store = useOrbsStore();
  const live = useToday();
  const today = day ?? live;
  const fitness = useFitness();
  const any = useMemo(() => candidates(store, today).length > 0, [store, today]);
  const tick = useCachesTick(qc, any);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (store ? boardOf(qc, store, today, fitness) : null), [qc, store, today, fitness, tick]);
};

/** The rows a place shows now (`rowsFor`). */
export const useChallengeRowViews = (scope: Scope): RowView[] => useChallengeRows(scope).rows;
/** The rows a place shows now, and the day they stand on (what a sheet opened from one of them is read against). */
export const useChallengeRows = (scope: Scope): { rows: RowView[]; today: ISODate | null } => {
  const board = useBoard();
  return useMemo(() => ({ rows: board ? rowsFor(scope, board.slots, board.views, board.today, board.offerDay) : [], today: board?.today ?? null }), [board, scope]);
};
