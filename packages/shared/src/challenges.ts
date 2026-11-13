import { daysBetween, mondayOf, shiftDays, toISO, type ISODate } from './dates.js';
import { earnOnce, isFullDay, numberWord, RULES, seedOf, type Challenge, type ChallengeSize, type DayFacts, type Gained, type Rewards, type TrainKind } from './rewards.js';

/*
 * Challenges: offered, never assigned. The menu is made by code from the person's own record; the pick is the rule's (by a
 * seed, so it is the same on every device and cannot be predicted from the day before). Pure, like the rest of the rules.
 *
 * The never list is kept by construction: no item adds distance, pace, weight or sessions to the plan; none has a clock
 * deadline; none counts to-dos or journal lines; none is about food, weight, sleep or pain; nothing is offered on a paused
 * day; nothing about training is offered with Fitness off.
 */

export interface Slot {
  /** `challenge:d:<date>` or `challenge:w:<monday>`: also its key in the store and in the once-ledger (one payment per slot). */
  key: string;
  kind: 'day' | 'week';
  /** The day, or the week's Monday. */
  date: ISODate;
  /** Which item of the menu the rule picks. */
  seed: number;
}
/** A fixed Monday the weeks are numbered from. */
const WEEK_ZERO: ISODate = '2026-01-05';
const slot = (userId: string, kind: 'day' | 'week', date: ISODate): Slot => {
  const key = `challenge:${kind === 'day' ? 'd' : 'w'}:${date}`;
  return { key, kind, date, seed: seedOf(`${userId}:${key}`) };
};

/**
 * The week's slots for an account: the same on every device, since they are a function of the account's id and the week
 * alone. One day challenge on a day chosen by seed (two on different days with "Two a week", none with Off), and a week
 * challenge on three Mondays in four. Any day of the week may be passed.
 */
export const challengeSlots = (userId: string, week: ISODate, cadence: 0 | 1 | 2 = 1): Slot[] => {
  if (cadence === 0) return [];
  const monday = mondayOf(week);
  const out: Slot[] = [];
  const index = Math.round(daysBetween(WEEK_ZERO, monday) / 7);
  if ((((index + seedOf(userId)) % 4) + 4) % 4 !== 3) out.push(slot(userId, 'week', monday));
  const first = seedOf(`${userId}:d:${monday}`) % 7;
  const days = [first];
  if (cadence === 2) days.push((first + 1 + (seedOf(`${userId}:d2:${monday}`) % 6)) % 7);
  for (const d of days.sort((a, b) => a - b)) out.push(slot(userId, 'day', shiftDays(monday, d)));
  return out;
};
/** A slot read back from its key. */
export const slotOf = (userId: string, key: string): Slot => slot(userId, key.startsWith('challenge:d:') ? 'day' : 'week', key.slice(-10));

/** The numbered week items and their published bounds. */
export const CHALLENGE_BOUNDS = { days: [3, 5], 'habit-days': [2, 5], 'full-days': [1, 4] } as const;
type Numbered = keyof typeof CHALLENGE_BOUNDS;
const isNumbered = (item: string): item is Numbered => item in CHALLENGE_BOUNDS;

/** The person's own record, as the menu's sizes are made from it. */
export interface Baseline {
  /** Days since the store began. Under 28, only the items that need no number are offered. */
  recordDays: number;
  /** The last finished weeks, oldest first (four make a baseline): counted days, days with every habit done, full days. */
  weeks: Array<{ days: number; habitDays: number; fullDays: number }>;
  /** The last challenge of each numbered item: its target, whether it was met, how many weeks ago, and whether the target had risen in the last four weeks. */
  last?: Partial<Record<string, { target: number; met: boolean; weeksAgo: number; rose?: boolean }>>;
  /** A pause in the last four weeks: no target rises. */
  paused?: boolean;
  /** Just back from a pause: challenges run at Gentle (for as many days as the pause lasted, up to 7). */
  gentle?: boolean;
}

/** What a challenge is read against: today, the slot's day, and the week so far. The phone builds it from its caches and the store. */
export interface ChallengeFacts {
  today: ISODate;
  fitness: boolean;
  /** The day's facts (for a day challenge, the slot's day). */
  day: DayFacts;
  /** To-dos open on today's list now. */
  todosOpen: number;
  /** The kinds of training planned for the day and not skipped, in the plan's order. */
  planned: TrainKind[];
  week: {
    monday: ISODate;
    /** Counted days this week (`countOf(store, today).thisWeek`). */
    counted: number;
    /** Days this week that were full days. */
    fullDays: number;
    /** Days this week on which every habit was done. */
    habitDays: number;
    goal: 'none' | 'open' | 'done';
    /** The week's planned sessions that are not skipped, and how many are done or at their floor. */
    sessions: { planned: number; done: number };
    /** Paused days in the week. */
    paused: number;
  };
}

export interface Offer {
  item: string;
  target: number;
  floor?: number;
  base: number;
}
const offer = (item: string, target: number, floor?: number): Offer => (floor !== undefined && floor >= 1 && floor < target ? { item, target, floor, base: 0 } : { item, target, base: 0 });

const sized = (b: Baseline, item: Numbered, pick: (w: Baseline['weeks'][number]) => number, size: ChallengeSize): number => {
  const [lo, hi] = CHALLENGE_BOUNDS[item];
  const v = b.weeks.slice(-4).map(pick).sort((x, y) => x - y);
  // Gentle: the lowest of the four. Steady: met in three of the four. Bold: met in two of the four.
  let t = v[b.gentle || size === 'gentle' ? 0 : size === 'steady' ? 1 : 2]!;
  t = Math.min(hi, Math.max(lo, t));
  const last = b.last?.[item];
  if (last && last.weeksAgo <= 4) t = Math.min(t, !last.met || b.paused || last.rose ? last.target : last.target + 1);
  return Math.min(hi, Math.max(lo, t));
};

/**
 * Everything on the menu for a slot, in the menu's order. Empty on a paused day, on any day but the slot's own (a week
 * slot: any day of its week), and whenever nothing can be asked. An account with under 28 days of record, or without four
 * finished weeks, is offered only the items that need no number.
 */
export const menuFor = (s: Slot, b: Baseline, f: ChallengeFacts, size: ChallengeSize): Offer[] => {
  if (f.day.held) return [];
  const out: Offer[] = [];
  if (s.kind === 'day') {
    if (f.today !== s.date || f.day.date !== s.date) return [];
    if (f.day.habitsLive >= 2) out.push(offer('habits', f.day.habitsLive));
    if (f.day.goalDay === 'open') out.push(offer('goal', 1));
    if (f.fitness && f.day.trainRequired) {
      const kind = f.planned.find((k) => !f.day.train[k]);
      if (kind) out.push(offer(`session:${kind}`, 1));
    }
    if (f.todosOpen >= 2) out.push(offer('list', f.todosOpen));
    if (f.day.goalDay === 'open' && !isFullDay(f.day)) out.push(offer('full', 1));
    return out;
  }
  if (mondayOf(f.today) !== s.date || f.week.paused > 0) return [];
  const numbers = b.recordDays >= 28 && b.weeks.length >= 4;
  if (numbers) {
    const t = sized(b, 'days', (w) => w.days, size);
    out.push(offer('days', t, t - 1));
  }
  if (f.fitness && f.week.sessions.planned >= 2) out.push(offer('sessions', f.week.sessions.planned - 1, f.week.sessions.planned - 2));
  if (f.week.goal === 'open') out.push(offer('goal-week', 1));
  if (numbers && f.day.habitsLive >= 1) {
    const t = sized(b, 'habit-days', (w) => w.habitDays, size);
    out.push(offer('habit-days', t, t - 1));
  }
  if (numbers) {
    const t = sized(b, 'full-days', (w) => w.fullDays, size);
    out.push(offer('full-days', t, t - 1));
  }
  return out;
};
/** The rule's pick for a slot, or null when there is nothing to offer. */
export const offerChallenge = (s: Slot, b: Baseline, f: ChallengeFacts, size: ChallengeSize): Offer | null => {
  const menu = menuFor(s, b, f, size);
  return menu.length ? menu[s.seed % menu.length]! : null;
};

const off = (target: number) => {
  const n = 7 - target;
  return `${numberWord(n).toLowerCase()} ${n === 1 ? 'day' : 'days'} off`;
};
/**
 * A challenge's title. A week of days is said as every day with days off ("Every day this week, two days off"), the way
 * the count's rule is, never as a number of seven.
 */
export const challengeTitle = (c: Pick<Offer, 'item' | 'target'>): string => {
  if (c.item.startsWith('session:')) return 'Today’s session, done';
  switch (c.item) {
    case 'habits':
      return 'Every habit today';
    case 'goal':
      return 'Today’s goal, done';
    case 'list':
      return 'Clear this morning’s list';
    case 'full':
      return 'A full day';
    case 'days':
      return `Every day this week, ${off(c.target)}`;
    case 'sessions':
      return 'Every planned session but one';
    case 'goal-week':
      return 'This week’s goal, done';
    case 'habit-days':
      return `Every habit, every day this week, ${off(c.target)}`;
    case 'full-days':
      return c.target <= 1 ? 'One full day this week' : `A full day, every day this week, ${off(c.target)}`;
    default:
      return '';
  }
};

/** How far a challenge has come, by the facts. */
export const progressOf = (c: Pick<Challenge, 'item' | 'base'>, f: ChallengeFacts): number => {
  if (c.item.startsWith('session:')) return f.day.train[c.item.slice(8) as TrainKind] ? 1 : 0;
  switch (c.item) {
    case 'habits':
      return f.day.habitsLiveDone ?? Math.min(f.day.habitsDone, f.day.habitsLive);
    case 'goal':
      return f.day.goalDay === 'done' ? 1 : 0;
    case 'list':
      return Math.max(0, f.day.todosDone - c.base);
    case 'full':
      return isFullDay(f.day) ? 1 : 0;
    case 'days':
      return f.week.counted;
    case 'sessions':
      return f.week.sessions.done;
    case 'goal-week':
      return f.week.goal === 'done' ? 1 : 0;
    case 'habit-days':
      return f.week.habitDays;
    case 'full-days':
      return f.week.fullDays;
    default:
      return 0;
  }
};

/** A day challenge pays 5. A week challenge pays 20 in full and 10 at its floor. Below that, nothing. */
export const payFor = (kind: Slot['kind'], c: Pick<Challenge, 'target' | 'floor'>, progress: number): number => {
  if (progress >= c.target) return kind === 'day' ? RULES.challenge.day : RULES.challenge.weekFull;
  return kind === 'week' && c.floor !== undefined && progress >= c.floor ? RULES.challenge.weekFloor : 0;
};

/**
 * Can an offered challenge still be added? Only while it asks for something: a day challenge needs one step left, on its
 * own day; a week challenge needs 40 percent of its target left, Monday to Wednesday. Never on a paused day.
 */
export const canAdd = (c: Challenge, s: Slot, f: ChallengeFacts): boolean => {
  if (c.state !== 'offered' || f.day.held) return false;
  if (s.kind === 'day') {
    if (f.today !== s.date || f.day.date !== s.date) return false;
    if (c.item === 'list') return f.todosOpen >= 2;
    return c.target - progressOf(c, f) >= 1;
  }
  if (mondayOf(f.today) !== s.date || daysBetween(s.date, f.today) > 2 || f.week.paused > 0) return false;
  return (c.target - progressOf(c, f)) * 10 >= 4 * c.target;
};

/**
 * Where an added challenge stands by the facts: still `added`, `done` (with what it pays), or `void` (its session was
 * moved or deleted, its day or week was paused, or Fitness went off: it ends silently, with no record). A day challenge
 * is read only on its own day. A week challenge is done the moment its target is met, or at its floor once the week is
 * over. Any other state is returned as it is.
 */
export const challengeState = (c: Challenge, s: Slot, f: ChallengeFacts): { state: Challenge['state']; progress: number; pay: number } => {
  const progress = progressOf(c, f);
  if (c.state !== 'added') return { state: c.state, progress, pay: 0 };
  if (s.kind === 'day') {
    if (f.day.date !== s.date) return { state: 'added', progress, pay: 0 };
    if (f.day.held) return { state: 'void', progress, pay: 0 };
    if (c.item.startsWith('session:') && (!f.fitness || !f.planned.includes(c.item.slice(8) as TrainKind))) return { state: 'void', progress, pay: 0 };
  } else {
    if (f.week.monday !== s.date) return { state: 'added', progress, pay: 0 };
    if (f.week.paused > 0) return { state: 'void', progress, pay: 0 };
    if (c.item === 'sessions' && (!f.fitness || f.week.sessions.planned < c.target + 1)) return { state: 'void', progress, pay: 0 };
  }
  if (progress >= c.target) return { state: 'done', progress, pay: payFor(s.kind, c, progress) };
  if (s.kind === 'week' && f.today > shiftDays(s.date, 6)) {
    const pay = payFor('week', c, progress);
    if (pay) return { state: 'done', progress, pay };
  }
  return { state: 'added', progress, pay: 0 };
};

// ---------- the store ----------

const put = (s: Rewards, key: string, c: Challenge): Rewards => ({ ...s, challenges: { ...s.challenges, [key]: c } });

/** Keep an offer in the store. It is frozen at its first generation: a slot that already holds one is left as it is. */
export const offerInto = (s: Rewards, sl: Slot, o: Offer, at: Date): Rewards => {
  if (s.challenges[sl.key]) return s;
  const c: Challenge = { item: o.item, target: o.target, base: o.base, state: 'offered', at: at.toISOString() };
  if (o.floor !== undefined) c.floor = o.floor;
  return put(s, sl.key, c);
};
/** "Add to today" / "Add to this week". Refused (the same store comes back) unless `canAdd`. Progress so far is kept as its base. */
export const addChallenge = (s: Rewards, sl: Slot, f: ChallengeFacts, at: Date): Rewards => {
  const c = s.challenges[sl.key];
  if (!c || !canAdd(c, sl, f)) return s;
  const next: Challenge = { ...c, state: 'added', at: at.toISOString() };
  if (c.item === 'list') {
    // the list as it stands now: every to-do open on it, counted from what is already done today
    next.target = f.todosOpen;
    next.base = f.day.todosDone;
  } else next.base = progressOf(c, f);
  return put(s, sl.key, next);
};
/** "Skip": costs nothing, is never mentioned, and settles the slot. */
export const skipChallenge = (s: Rewards, key: string, at: Date): Rewards => {
  const c = s.challenges[key];
  return c && c.state === 'offered' ? put(s, key, { ...c, state: 'skipped', at: at.toISOString() }) : s;
};
/** Does this challenge have a size, so "Easier" can be offered? */
export const hasEasier = (c: Pick<Challenge, 'item' | 'target' | 'state'>): boolean => c.state === 'offered' && isNumbered(c.item) && c.target > CHALLENGE_BOUNDS[c.item][0];
/** "Easier": one step off the target (and its floor), down to the item's lower bound. */
export const easierChallenge = (s: Rewards, key: string): Rewards => {
  const c = s.challenges[key];
  if (!c || !hasEasier(c)) return s;
  const o = offer(c.item, c.target - 1, c.target - 2);
  const { floor: _floor, ...rest } = c;
  return put(s, key, { ...rest, target: o.target, ...(o.floor !== undefined ? { floor: o.floor } : null) });
};

const NEVER = /\b(miles?|km|kilometers?|distance|pace|faster|speed|weigh\w*|heavier|pounds?|lbs?|kg|calories?|food|eat\w*|ate|diet\w*|meals?|sleep\w*|slept|pain\w*|sore|hurts?|aches?|injur\w*|noon|midnight|deadline|o[’']clock|a\.m|p\.m)\b/i;
/**
 * May the assistant's one-line reason be shown? At most 90 characters, no number that is not in the title, no clock time,
 * and nothing about distance, pace, weight, food, sleep or pain.
 */
export const reasonAllowed = (reason: string, title: string): boolean => {
  const r = reason.trim();
  if (!r || r.length > 90 || NEVER.test(r)) return false;
  const allowed = new Set(title.match(/\d+/g) ?? []);
  return (r.match(/\d+/g) ?? []).every((n) => allowed.has(n));
};
/**
 * "Picked by the assistant": the assistant chose `item` from the rule's own `menu` and gave a reason. Taken only while the
 * challenge is still an offer, the item is on the menu and the reason passes `reasonAllowed`; anything else leaves the
 * rule's pick as it is. The title stays the rule's.
 */
export const withPick = (s: Rewards, key: string, menu: readonly Offer[], item: string, why: string): Rewards => {
  const c = s.challenges[key];
  const o = menu.find((m) => m.item === item);
  if (!c || c.state !== 'offered' || !o || !reasonAllowed(why, challengeTitle(o))) return s;
  const next: Challenge = { item: o.item, target: o.target, base: o.base, state: 'offered', at: c.at, by: 'assistant', why: why.trim() };
  if (o.floor !== undefined) next.floor = o.floor;
  return put(s, key, next);
};

const kindOf = (key: string): Slot['kind'] => (key.startsWith('challenge:d:') ? 'day' : 'week');
/**
 * Read the added challenges against the facts and settle the ones that are finished: a met one is paid into the
 * once-ledger under its slot (one payment per slot, whatever happens afterwards) and a voided one ends with no record.
 * `facts` is keyed by slot; a slot with no facts is left alone. The same store comes back when nothing changed.
 */
export const settleChallenges = (store: Rewards, facts: Readonly<Record<string, ChallengeFacts>>, now: Date): { store: Rewards; gained: Gained[] } => {
  let s = store;
  const gained: Gained[] = [];
  const today = toISO(now);
  for (const key in facts) {
    const c = s.challenges[key];
    if (!c || c.state !== 'added') continue;
    const st = challengeState(c, { key, kind: kindOf(key), date: key.slice(-10), seed: 0 }, facts[key]!);
    if (st.state === 'void') s = put(s, key, { ...c, state: 'void', at: now.toISOString() });
    else if (st.state === 'done' && st.pay > 0) {
      const paid = !s.once[key];
      s = put(earnOnce(s, key, st.pay, today), key, { ...c, state: 'done', at: now.toISOString() });
      if (paid) gained.push({ key, n: st.pay, date: today });
    }
  }
  return { store: s, gained };
};

/**
 * May this slot be offered? Not when it already holds a challenge, and not for 14 days after two skips or lapses in a row
 * of its kind (a lapse: offered and left, or added and not done). A voided one is no one's choice and is passed over.
 */
export const mayOffer = (s: Rewards, sl: Slot, today: ISODate): boolean => {
  if (s.challenges[sl.key]) return false;
  const prefix = sl.kind === 'day' ? 'challenge:d:' : 'challenge:w:';
  const before = Object.keys(s.challenges)
    .filter((k) => k.startsWith(prefix) && k.slice(-10) < sl.date && s.challenges[k]!.state !== 'void')
    .sort()
    .reverse()
    .slice(0, 2);
  if (before.length < 2) return true;
  const let_go = (k: string) => {
    const c = s.challenges[k]!;
    const over = (sl.kind === 'day' ? k.slice(-10) : shiftDays(k.slice(-10), 6)) < today;
    return c.state === 'skipped' || (over && (c.state === 'offered' || c.state === 'added'));
  };
  return !(before.every(let_go) && daysBetween(before[0]!.slice(-10), sl.date) < 14);
};

/**
 * The baseline the menu's sizes are made from: the last finished weeks out of the store (four at most, oldest first), with
 * `habitDays` laid over them from the phone's own caches (days with every habit done, for the same weeks, oldest first:
 * the store does not hold it), the last challenge of each item, and whether a pause is recent.
 */
export const baselineOf = (s: Rewards, today: ISODate, habitDays: readonly number[]): Baseline => {
  const monday = mondayOf(today);
  const first = mondayOf(s.startedOn);
  const weeks: Baseline['weeks'] = [];
  for (let m = shiftDays(monday, -7), i = 0; m >= first && i < 4; m = shiftDays(m, -7), i++) {
    let days = 0;
    let fullDays = 0;
    for (let j = 0; j < 7; j++) {
      const r = s.days[shiftDays(m, j)];
      if (!r) continue;
      if (r.a >= 1) days++;
      if (r.k?.full) fullDays++;
    }
    weeks.unshift({ days, fullDays, habitDays: 0 });
  }
  weeks.forEach((w, i) => (w.habitDays = habitDays[habitDays.length - weeks.length + i] ?? 0));
  const last: NonNullable<Baseline['last']> = {};
  const since = shiftDays(today, -28);
  const byItem = new Map<string, Array<{ date: ISODate; c: Challenge }>>();
  for (const key of Object.keys(s.challenges).sort()) {
    const date = key.slice(-10);
    if (date >= (kindOf(key) === 'week' ? monday : today)) continue;
    const c = s.challenges[key]!;
    byItem.set(c.item, [...(byItem.get(c.item) ?? []), { date, c }]);
  }
  for (const [item, list] of byItem) {
    const end = list[list.length - 1]!;
    const rose = list.some((x, i) => i > 0 && x.c.target > list[i - 1]!.c.target && x.date >= since);
    last[item] = { target: end.c.target, met: end.c.state === 'done', weeksAgo: Math.floor(daysBetween(end.date, today) / 7), rose };
  }
  let paused = false;
  for (let i = 1; i <= 28; i++) if (s.days[shiftDays(today, -i)]?.h) paused = true;
  // the pause that ended most recently, and how long it ran
  let gentle = false;
  for (let i = 1; i <= 7; i++) {
    const end = shiftDays(today, -i);
    if (!s.days[end]?.h) continue;
    let length = 0;
    while (length < 7 && s.days[shiftDays(end, -length)]?.h) length++;
    gentle = i <= length;
    break;
  }
  return { recordDays: daysBetween(s.startedOn, today), weeks, last, paused, gentle };
};
