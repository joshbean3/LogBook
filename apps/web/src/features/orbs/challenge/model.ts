import { canAdd, CHALLENGE_BOUNDS, challengeState, challengeTitle, hasEasier, mondayOf, payFor, RULES, shiftDays, toISO, type Challenge, type ChallengeFacts, type ISODate, type Offer, type Slot } from '@logbook/shared';

/**
 * The challenge row and sheet, as rules: which row shows when, the words for each state, and when each action is offered.
 * Nothing here draws or reads a cache. The title is always the engine's (`challengeTitle`); what a challenge asks, what
 * counts and what it pays all come from the engine's own numbers, so no words here can ask for more than the rule holds.
 *
 * A challenge is offered, never assigned. A skipped, dropped, lapsed or voided one shows nowhere and is never mentioned.
 */

export type Scope = 'today' | 'page';
/** What a row can show: an offer that can still be added, one that is running, one that was finished today. */
export type Shown = 'offered' | 'added' | 'done';

export const eyebrowOf = (kind: Slot['kind']): string => (kind === 'day' ? 'Today’s challenge' : 'This week’s challenge');
export const addWords = (kind: Slot['kind']): string => (kind === 'day' ? 'Add to today' : 'Add to this week');
export const PICKED_CAPTION = 'Picked by the assistant';
export const ASK_WORDS = 'Ask the assistant to pick';
export const ASK_FAILED = 'Couldn’t ask just now.';
export const ASKING = 'The assistant is picking.';

const orbs = (n: number) => `${n} Orbs`;
/** What it is worth, before it is done: "5 Orbs", "10 to 20 Orbs" (a week challenge with a floor), "20 Orbs". */
export const worthWords = (kind: Slot['kind'], c: Pick<Challenge, 'target' | 'floor'>): string =>
  kind === 'day' ? orbs(RULES.challenge.day) : c.floor !== undefined && c.floor >= 1 && c.floor < c.target ? `${RULES.challenge.weekFloor} to ${orbs(RULES.challenge.weekFull)}` : orbs(RULES.challenge.weekFull);

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** The unit a week item counts in, for the pay line. */
const unitOf = (item: string): [string, string] => (item === 'sessions' ? ['session', 'sessions'] : ['day', 'days']);

/** What it pays, as the sheet's last sentence: "5 Orbs.", "10 Orbs at 4 days, 20 at 5.", "20 Orbs." */
export const payLine = (kind: Slot['kind'], c: Pick<Challenge, 'item' | 'target' | 'floor'>): string => {
  if (kind === 'day') return `${orbs(RULES.challenge.day)}.`;
  if (c.floor === undefined || c.floor < 1 || c.floor >= c.target) return `${orbs(RULES.challenge.weekFull)}.`;
  const [one, many] = unitOf(c.item);
  return `${orbs(RULES.challenge.weekFloor)} at ${count(c.floor, one, many)}, ${RULES.challenge.weekFull} at ${c.target}.`;
};

/**
 * A full day in words, from the person's own habits: the goal, the habits (all of two or fewer, else all but one), and
 * the session part when there is one to say. Nothing about habits for a person who has none.
 */
const fullDayParts = (f: ChallengeFacts | null, lead: string, session: string | null): string => {
  const parts = [lead];
  const habits = f?.day.habitsLive ?? 3;
  if (habits >= 3) parts.push('every habit but one');
  else if (habits >= 1) parts.push(habits === 1 ? 'your habit' : 'both habits');
  if (session) parts.push(session);
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

/**
 * What counts, in one plain sentence. With Fitness off nothing here names training: the training items are never
 * offered then, and a full day's sentence leaves the session out.
 */
export const whatCounts = (c: Pick<Challenge, 'item' | 'state'>, f: ChallengeFacts | null): string => {
  const fitness = f?.fitness ?? false;
  if (c.item.startsWith('session:')) return 'Today’s planned session. Its floor counts.';
  switch (c.item) {
    case 'habits':
      return 'Every habit you have today.';
    case 'goal':
      return 'Today’s goal, marked done.';
    case 'list':
      return c.state === 'offered' ? 'Every to-do on today’s list when you add this.' : 'Every to-do that was on today’s list when you added this.';
    case 'full':
      return `${fullDayParts(f, 'Today’s goal', f?.fitness && f.day.trainRequired ? 'today’s session' : null)}.`;
    case 'days':
      return 'A day counts when you finish one thing.';
    case 'sessions':
      return 'Every session in this week’s plan but one. Floors count.';
    case 'goal-week':
      return 'This week’s goal, marked done.';
    case 'habit-days':
      return 'A day counts when every habit is done.';
    case 'full-days':
      return `A full day is ${fullDayParts(f, 'the day’s goal', fitness ? 'any planned session' : null)}.`;
    default:
      return '';
  }
};

/** The sheet's one line: what counts and what it pays. "Every habit you have today. 5 Orbs." */
export const sheetLine = (kind: Slot['kind'], c: Pick<Challenge, 'item' | 'target' | 'floor' | 'state'>, f: ChallengeFacts | null): string => `${whatCounts(c, f)} ${payLine(kind, c)}`.trim();

/**
 * Progress in plain words once a challenge is added: "2 of 3 habits", "3 days so far". Never a zero: with nothing done
 * yet it says only that it was added. No worth is said until it is done.
 */
export const progressWords = (kind: Slot['kind'], c: Pick<Challenge, 'item' | 'target'>, progress: number): string => {
  const p = Math.max(0, Math.min(progress, c.target));
  if (p < 1) return kind === 'day' ? 'Added to today' : 'Added to this week';
  switch (c.item) {
    case 'habits':
      return `${p} of ${count(c.target, 'habit', 'habits')}`;
    case 'list':
      return `${p} of ${c.target} done`;
    case 'days':
      return `${count(p, 'day', 'days')} so far`;
    case 'sessions':
      return `${count(p, 'session', 'sessions')} so far`;
    case 'habit-days':
      return `${count(p, 'day', 'days')} so far`;
    case 'full-days':
      return `${count(p, 'full day', 'full days')} so far`;
    default:
      return kind === 'day' ? 'Added to today' : 'Added to this week';
  }
};
export const doneWords = (pay: number): string => `Done · ${orbs(pay)}`;

/** The local day an ISO time fell on. */
const dayOfTime = (iso: string): ISODate | null => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : toISO(d);
};

/**
 * Is this challenge shown now, and as what? An offer only while it can still be added (`canAdd`: one with nothing left to
 * do is not offered, a week one only Monday to Wednesday, nothing on a paused day). An added one while its day or week
 * runs. A done one for the rest of the day it was finished. Anything else (skipped, dropped, lapsed, void): null.
 */
export const shownAs = (c: Challenge | undefined, slot: Slot, f: ChallengeFacts, today: ISODate): Shown | null => {
  if (!c) return null;
  if (c.state === 'offered') return canAdd(c, slot, f) ? 'offered' : null;
  if (c.state === 'added') {
    const live = slot.kind === 'day' ? slot.date === today : slot.date === mondayOf(today);
    if (!live) return null;
    const now = challengeState(c, slot, f).state;
    return now === 'added' ? 'added' : now === 'done' ? 'done' : null;
  }
  if (c.state === 'done') return (slot.kind === 'day' ? slot.date : dayOfTime(c.at)) === today ? 'done' : null;
  return null;
};

export interface RowView {
  key: string;
  kind: Slot['kind'];
  shown: Shown;
  /** The engine's title. */
  title: string;
  /** "Today's challenge · 5 Orbs", then progress, then "Done · 5 Orbs". For an offer the assistant picked: its reason. */
  sub: string;
  /** "Picked by the assistant", when it was. */
  caption?: string;
  /** The assistant's reason, shown under the title of an offer and in the sheet. */
  reason?: string;
  /** The whole row, for VoiceOver. */
  label: string;
}

/**
 * One row's words, or null when the challenge is not shown. `paid` is what the once-ledger holds for the slot (a done
 * challenge says what it paid, not what it could have).
 */
export const rowView = (c: Challenge | undefined, slot: Slot, f: ChallengeFacts, today: ISODate, paid = 0): RowView | null => {
  const shown = shownAs(c, slot, f, today);
  if (!c || !shown) return null;
  const title = challengeTitle(c);
  if (!title) return null;
  const st = challengeState(c, slot, f);
  const picked = c.by === 'assistant' && !!c.why;
  const offer = `${eyebrowOf(slot.kind)} · ${worthWords(slot.kind, c)}`;
  const sub = shown === 'done' ? doneWords(paid || st.pay || payFor(slot.kind, c, st.progress) || (slot.kind === 'day' ? RULES.challenge.day : RULES.challenge.weekFloor)) : shown === 'added' ? progressWords(slot.kind, c, st.progress) : picked ? c.why! : offer;
  const view: RowView = { key: slot.key, kind: slot.kind, shown, title, sub, label: '' };
  if (picked) {
    view.caption = PICKED_CAPTION;
    view.reason = c.why;
  }
  // VoiceOver hears the row in the order it reads on screen, then what it is where the line under the title does not say
  view.label = [picked ? PICKED_CAPTION : '', title, sub, shown !== 'offered' ? eyebrowOf(slot.kind) : picked ? offer : '', 'Open']
    .filter(Boolean)
    .map((s) => s.replace(/[.]+$/, ''))
    .join('. ');
  return view;
};

/**
 * Which rows a place shows, in order. Today: at most one, the day challenge on its day, or, when there is none to show, the
 * week challenge on its Monday (an offer) or on any day of its week once it was added. The Orbs page: the week's, then the day's, then a week challenge that was
 * finished today for a week that is over. `views` holds a row per slot key (null: not shown).
 */
export const rowsFor = (scope: Scope, slots: readonly Slot[], views: Readonly<Record<string, RowView | null | undefined>>, today: ISODate): RowView[] => {
  const monday = mondayOf(today);
  const day = slots.filter((s) => s.kind === 'day' && s.date === today).map((s) => views[s.key]).find(Boolean) ?? null;
  const week = slots.filter((s) => s.kind === 'week' && s.date === monday).map((s) => views[s.key]).find(Boolean) ?? null;
  // an offer shows on Today on its Monday only; one the person added stays in sight all week (it would otherwise live only
  // on the Orbs page from Tuesday, and be forgotten)
  if (scope === 'today') return day ? [day] : week && (today === monday || week.shown === 'added') ? [week] : [];
  const last = slots.filter((s) => s.kind === 'week' && s.date === shiftDays(monday, -7)).map((s) => views[s.key]).find((v) => v?.shown === 'done') ?? null;
  return [week, day, last].filter((v): v is RowView => !!v);
};

// ---------- the assistant's pick ----------

/**
 * The items the assistant may choose (the server's own list, services/challengePick.ts): never a habit item, since habits
 * are never sent, and never one whose number is counted from them.
 */
const PICKABLE = new Set(['goal', 'list', 'full', 'days', 'sessions', 'goal-week']);
export const isPickable = (item: string): boolean => PICKABLE.has(item) || /^session:(run|lift|cross)$/.test(item);
/** Is there a choice to ask about? Two items or more that the assistant may be shown. */
export const worthAsking = (menu: readonly Offer[]): boolean => menu.filter((o) => isPickable(o.item)).length >= 2;

export interface PickAnswer {
  item: string;
  target: number;
  floor?: number;
  why?: string;
  by: 'assistant' | 'rule';
}
/** The server's answer, read as untrusted: the fields in their types, or null. */
export const parsePick = (raw: unknown): PickAnswer | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.item !== 'string' || typeof r.target !== 'number' || !Number.isInteger(r.target) || (r.by !== 'assistant' && r.by !== 'rule')) return null;
  const out: PickAnswer = { item: r.item.slice(0, 40), target: r.target, by: r.by };
  if (typeof r.floor === 'number' && Number.isInteger(r.floor)) out.floor = r.floor;
  if (typeof r.why === 'string') out.why = r.why.slice(0, 200);
  return out;
};

/**
 * The offer an answer may become, or null. Only the assistant's own pick is taken (the rule's pick from the server
 * changes nothing: this phone's rule already chose), only an item the assistant may choose, and only one that is on this
 * phone's own menu right now, with this phone's own target: the server cannot make a challenge the rules here would not.
 * The one number an answer may bring is a lower target for "days" (the server counts fewer days than the phone, since it
 * counts no habit and no tracked run): the lower one is taken, inside the published bounds, so the title the person reads
 * is the title the assistant was shown. A higher one is refused.
 */
export const acceptPick = (a: PickAnswer | null, own: readonly Offer[]): Offer | null => {
  if (!a || a.by !== 'assistant' || !a.why || !isPickable(a.item)) return null;
  const mine = own.find((o) => o.item === a.item);
  if (!mine) return null;
  if (a.item !== 'days' || a.target === mine.target) return mine;
  if (a.target > mine.target || a.target < CHALLENGE_BOUNDS.days[0]) return null;
  return { item: mine.item, target: a.target, floor: a.target - 1, base: 0 };
};

// ---------- the sheet's actions ----------

export interface SheetActions {
  /** The one Sky button's words ("Add to today"), or null when adding is not offered. */
  add: string | null;
  skip: boolean;
  easier: boolean;
  /** "Ask the assistant to pick". */
  ask: boolean;
  /** "Drop it", on a challenge that was added. */
  drop: boolean;
}
/**
 * What the sheet offers. An offer: "Add" while `canAdd`, "Skip", "Easier" where the engine's `hasEasier` says so, and
 * "Ask the assistant to pick" when this account may ask (`mayAsk`: the server has the route, the assistant is allowed and
 * its training switch is on), the assistant has not already picked this one, and there is a choice to make. An added
 * one: "Drop it". A done one: nothing.
 */
export const actionsFor = (c: Challenge | undefined, slot: Slot, f: ChallengeFacts, today: ISODate, opts: { mayAsk: boolean; menu: readonly Offer[] }): SheetActions => {
  const shown = shownAs(c, slot, f, today);
  const none: SheetActions = { add: null, skip: false, easier: false, ask: false, drop: false };
  if (!c || !shown) return none;
  if (shown === 'offered') return { add: addWords(slot.kind), skip: true, easier: hasEasier(c), ask: opts.mayAsk && c.by !== 'assistant' && worthAsking(opts.menu), drop: false };
  if (shown === 'added') return { ...none, drop: true };
  return none;
};
