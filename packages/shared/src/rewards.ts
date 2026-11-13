import { z } from 'zod';
import { daysBetween, isISODate, mondayOf, shiftDays, toISO, type ISODate } from './dates.js';
import { periodEnd, periodStart, type Aim, type GoalLevel } from './goals.js';
import { counts, isSkipMark, RUN_FLOOR_RATIO, sessionStatus, type Snapshot } from './status.js';
import { statusOn, type TrainingStatus, type TrainingStatusKind } from './trainingStatus.js';
import type { Habit, HabitCheck, Todo } from './types.js';

/*
 * Orbs: the rules, pure. Nothing here reads a clock, storage or the network: the phone and the server hand in what they
 * know (`now`, the day's facts, the stored object) and get the next stored object back.
 *
 * Awards are DERIVED. A day that is still open is recomputed from the day's facts every time they change (`earnDay`), so
 * an untick takes its Orb with it and nothing is ever stamped at a tap. A day that has closed is frozen and nothing
 * changes it again. No row id is stored anywhere, and the lifetime total is never stored: it is the sum of the days and
 * of the once-ledger (`totalOf`).
 */

// ---------- the published numbers ----------

/** One constant. `startsOn` is a build constant: nothing is paid for a day before it, whatever a device's storage says. */
export const RULES = {
  version: 1,
  startsOn: '2026-11-16' as ISODate,
  /** A to-do: 1 Orb, the first 5 a day. */
  todo: { each: 1, cap: 5 },
  /** A habit: 1 Orb, at most 8 a day. */
  habit: { each: 1, cap: 8 },
  /** A training session: 3 Orbs, 2 at its floor, per kind, at most two kinds a day. */
  train: { done: 3, floor: 2, kinds: 2 },
  /** Today's goal: 3 Orbs, once. */
  goalDay: 3,
  /** A full day: +5, flat, when the required set and the day's earlier to-dos come to `min` things or more. */
  full: { bonus: 5, min: 3 },
  /** Goals multiply by reach: 3 x 1, 3, 10, 30. `grace`: days after the period a review still earns. `age`: days between setting it and marking it. */
  goal: {
    base: 3,
    reach: { day: 1, week: 3, month: 10, year: 30 } as Record<GoalLevel, number>,
    grace: { day: 1, week: 2, month: 3, year: 7 } as Record<GoalLevel, number>,
    age: { day: 0, week: 2, month: 7, year: 30 } as Record<GoalLevel, number>,
  },
  /** The weekly bonus: 5 x the weeks in a row, up to x4. A week with `neutral` or more neutral days is neutral. */
  week: { bonus: 5, top: 4, target: 5, neutral: 3 },
  /** A comeback: +3 on the first counted day after `missed` or more missed days, once in `every` days. */
  comeback: { bonus: 3, missed: 3, every: 14 },
  /** A day challenge pays 5; a week challenge 10 at its floor and 20 in full. */
  challenge: { day: 5, weekFloor: 10, weekFull: 20 },
  /** A day takes taps until this hour of the next morning, and late evidence until the end of the next day. */
  close: { tapHour: 3 },
  /** Level thresholds, then one more level every `levelStep`. */
  levels: [25, 75, 200, 500, 1200, 2500, 5000] as readonly number[],
  levelStep: 5000,
  /** A chapter is four weeks. */
  chapterDays: 28,
  /** The Orbs per kind of a day are kept this long, then dropped (`compact`). */
  detailDays: 60,
  /** The most a day can pay: 5 + 8 + 6 + 3 + 5. */
  dailyCeiling: 27,
  keepsakes: { weeks: [2, 4, 8, 12, 26, 52] as readonly number[], days: [10, 50, 100, 250, 365, 500, 1000] as readonly number[] },
  /** What opens full screen. Everything else is a toast and a "New" row. At most `perWeek` in any seven days. */
  moments: { weeks: [4, 12, 26, 52] as readonly number[], days: [100, 365, 1000] as readonly number[], perWeek: 2 },
} as const;

/** The statuses that pause the count: a day under one is neutral unless something was done on it. */
export const PAUSE_KINDS: readonly TrainingStatusKind[] = ['sick', 'injured', 'travel', 'rest'];
export const pausedOn = (s: TrainingStatus | null | undefined, date: ISODate): boolean => PAUSE_KINDS.includes(statusOn(s, date));

// ---------- the stored object ----------

export type TrainKind = 'run' | 'lift' | 'cross';
export type Kind = 'todo' | 'habit' | 'line' | 'train:run' | 'train:lift' | 'train:cross' | 'goal:day';
/** What a day's Orbs are counted under: a base kind, the full-day bonus, or the comeback. (A line earns none, so it never appears.) */
export type DayKey = Exclude<Kind, 'line'> | 'full' | 'back';
/** The order the rules table lists them in, which is the order `gained` and `dayLines` use. */
export const DAY_KEYS: readonly DayKey[] = ['todo', 'habit', 'train:run', 'train:lift', 'train:cross', 'goal:day', 'full', 'back'];
const TRAIN_KINDS: readonly TrainKind[] = ['run', 'lift', 'cross'];
const trainKey = (k: TrainKind) => `train:${k}` as const;

/** One day. `n` Orbs, `a` base actions, `k` Orbs per kind (dropped after 60 days), `c` closed, `h` paused, `r` rebuilt after a wipe. */
export interface DayRec {
  n: number;
  a: number;
  k?: Partial<Record<DayKey, number>>;
  c?: 1;
  h?: 1;
  r?: 1;
}
export interface OnceRec {
  on: ISODate;
  n: number;
}
export type ChallengeStateName = 'offered' | 'added' | 'done' | 'skipped' | 'void';
export interface Challenge {
  item: string;
  target: number;
  floor?: number;
  /** Progress when it was added. */
  base: number;
  state: ChallengeStateName;
  /** When it reached this state (an ISO time). */
  at: string;
  by?: 'assistant';
  why?: string;
}
/** A keepsake: the day it was earned, and for a chapter its own facts (`d` days, `s` training sessions, `g` goals met), and `t` words (a goal's, or one line written in the chapter). */
export interface Keepsake {
  on: ISODate;
  d?: number;
  s?: number;
  g?: number;
  t?: string;
}
export type ChallengeSize = 'gentle' | 'steady' | 'bold';
/** The switches. `at` is when they last changed (an ISO time): the newest wins a merge. */
export interface RewardSet {
  on: boolean;
  show: boolean;
  weekTarget: 3 | 4 | 5;
  cadence: 0 | 1 | 2;
  size: ChallengeSize;
  at: string;
}
export const DEFAULT_SET: RewardSet = { on: true, show: true, weekTarget: 5, cadence: 1, size: 'steady', at: '' };

export interface Rewards {
  v: 1;
  rules: number;
  userId: string;
  /** The first day that can earn: the day the store began, never before `RULES.startsOn`. */
  startedOn: ISODate;
  /** The highest device day seen. Days more than one behind it are closed, whatever the device's date says. */
  clock: ISODate;
  days: Record<ISODate, DayRec>;
  /** goal:week:<monday> goal:month:<yyyy-mm> goal:year:<yyyy> week:<monday> challenge:d:<date> challenge:w:<monday> */
  once: Record<string, OnceRec>;
  challenges: Record<string, Challenge>;
  keepsakes: Record<string, Keepsake>;
  /** Ranges while Orbs were switched off: neutral days. */
  off: Array<{ from: ISODate; to: ISODate | null }>;
  set: RewardSet;
  /** The week target each finished week was lived under (by its Monday), so a later change never rewrites a past week. */
  wt: Record<ISODate, 3 | 4 | 5>;
  /** What has been seen (a keepsake's key or a goal's once-key), and the day it was. */
  seen: Record<string, ISODate>;
}

/** What one day holds, as the app's own records have it. The phone builds it from its caches (`dayFactsOf`). */
export interface DayFacts {
  date: ISODate;
  /** To-dos checked off on this day. */
  todosDone: number;
  /** Of those, the ones that existed before this day. */
  todosEarlier: number;
  /** Habits that existed before this day and were not archived before it (one archived on the day still counts). */
  habitsLive: number;
  /** Habits checked on this day (one made today included). */
  habitsDone: number;
  /** Of `habitsLive`, how many are checked. Read as min(habitsDone, habitsLive) when absent. */
  habitsLiveDone?: number;
  /** Journal lines written for this day. */
  lines: number;
  /** Training per kind: done, or done at its floor. Planned or not; marks, logged sets and synced activities all count. */
  train: Partial<Record<TrainKind, 'done' | 'floor'>>;
  /** The same, from synced activities alone: the only training that can still arrive after a day stopped taking taps. */
  auto?: Partial<Record<TrainKind, 'done' | 'floor'>>;
  /** Training is planned for the day, not skipped, Fitness is on and the day is not paused. */
  trainRequired: boolean;
  /** Planned sessions not yet done or at their floor. Read as 0 when any training is done and absent. */
  trainLeft?: number;
  goalDay: 'none' | 'open' | 'done';
  /** The day is under one of the pausing statuses. */
  held: boolean;
}

/** A day that is on the calendar: `2026-02-30` is refused, where `isISODate` alone would read it as March 2. */
const zDay = z.string().refine((d) => isISODate(d) && shiftDays(d, 0) === d, 'Expected YYYY-MM-DD');
const zCount = (max: number) => z.number().int().min(0).max(max);
const capped = <T extends z.ZodType>(schema: T, max: number) => schema.refine((o) => Object.keys(o as object).length <= max, `at most ${max} entries`);
const zDayRec = z.object({
  n: zCount(999),
  a: zCount(999),
  k: z.partialRecord(z.enum(['todo', 'habit', 'train:run', 'train:lift', 'train:cross', 'goal:day', 'full', 'back']), zCount(99)).optional(),
  c: z.literal(1).optional(),
  h: z.literal(1).optional(),
  r: z.literal(1).optional(),
});
const zTarget = z.union([z.literal(3), z.literal(4), z.literal(5)]);
/** The most days a store may hold (eleven years), and the other size caps. The server refuses a bigger one. */
export const REWARDS_MAX_DAYS = 4000;
/**
 * The stored object, as the phone keeps it and as `PUT /me/rewards` takes it. Every map is capped. A field this build does
 * not know is dropped (not refused), so a store a newer build wrote can still be read.
 */
export const zRewards = z.object({
  v: z.literal(1),
  rules: z.number().int().min(1).max(999),
  userId: z.string().min(1).max(64),
  startedOn: zDay,
  clock: zDay,
  days: capped(z.record(zDay, zDayRec), REWARDS_MAX_DAYS),
  once: capped(z.record(z.string().min(1).max(40), z.object({ on: zDay, n: zCount(999) })), 3000),
  challenges: capped(
    z.record(
      z.string().min(1).max(40),
      z.object({
        item: z.string().min(1).max(24),
        target: zCount(99),
        floor: zCount(99).optional(),
        base: zCount(999),
        state: z.enum(['offered', 'added', 'done', 'skipped', 'void']),
        at: z.string().max(32),
        by: z.literal('assistant').optional(),
        why: z.string().max(120).optional(),
      }),
    ),
    400,
  ),
  keepsakes: capped(z.record(z.string().min(1).max(40), z.object({ on: zDay, d: zCount(99).optional(), s: zCount(999).optional(), g: zCount(999).optional(), t: z.string().max(200).optional() })), 1000),
  off: z.array(z.object({ from: zDay, to: zDay.nullable() })).max(200),
  set: z.object({ on: z.boolean(), show: z.boolean(), weekTarget: zTarget, cadence: z.union([z.literal(0), z.literal(1), z.literal(2)]), size: z.enum(['gentle', 'steady', 'bold']), at: z.string().max(32) }),
  wt: capped(z.record(zDay, zTarget), 1000),
  seen: capped(z.record(z.string().min(1).max(40), zDay), 4000),
});

/**
 * A new, empty store for an account. It begins no earlier than the rules do (`floor` is `RULES.startsOn`; only a
 * development build passes another, to try the feature before its start date).
 */
export const emptyRewards = (userId: string, startedOn: ISODate, set: RewardSet = DEFAULT_SET, floor: ISODate = RULES.startsOn): Rewards => {
  const from = startedOn < floor ? floor : startedOn;
  return { v: 1, rules: RULES.version, userId, startedOn: from, clock: from, days: {}, once: {}, challenges: {}, keepsakes: {}, off: [], set: { ...set }, wt: {}, seen: {} };
};

const sumK = (k: DayRec['k']): number => {
  let t = 0;
  if (k) for (const key of DAY_KEYS) t += k[key] ?? 0;
  return t;
};

/**
 * Drop what is only kept for a while: a closed day's Orbs per kind after 60 days, and challenges that old. The numbers, the
 * count and the total are untouched. Returns the same object when there is nothing to drop.
 */
export const compact = (s: Rewards, today: ISODate): Rewards => {
  const edge = shiftDays(s.clock > today ? s.clock : today, -RULES.detailDays);
  let days: Rewards['days'] | null = null;
  for (const d in s.days) {
    const r = s.days[d]!;
    if (d >= edge || !r.k || !r.c) continue;
    days ??= { ...s.days };
    const { k: _k, ...rest } = r;
    days[d] = rest;
  }
  let challenges: Rewards['challenges'] | null = null;
  for (const key in s.challenges) {
    if (key.slice(-10) >= edge) continue;
    challenges ??= { ...s.challenges };
    delete challenges[key];
  }
  return days || challenges ? { ...s, days: days ?? s.days, challenges: challenges ?? s.challenges } : s;
};

/** The most each kind can pay in a day, and the most a day can hold when its kinds are no longer kept (every cap at once, as a merge of two phones can leave it). */
const KIND_MAX: Record<DayKey, number> = {
  todo: RULES.todo.cap * RULES.todo.each,
  habit: RULES.habit.cap * RULES.habit.each,
  'train:run': RULES.train.done,
  'train:lift': RULES.train.done,
  'train:cross': RULES.train.done,
  'goal:day': RULES.goalDay,
  full: RULES.full.bonus,
  back: RULES.comeback.bonus,
};
const DAY_MAX = DAY_KEYS.reduce((t, k) => t + KIND_MAX[k], 0);
/** The most a key of the once-ledger can have paid, by what it is. A key this build does not know is left as it is. */
const onceMax = (key: string): number | null => {
  if (key.startsWith('week:')) return RULES.week.bonus * RULES.week.top;
  if (key.startsWith('goal:week:')) return RULES.goal.base * RULES.goal.reach.week;
  if (key.startsWith('goal:month:')) return RULES.goal.base * RULES.goal.reach.month;
  if (key.startsWith('goal:year:')) return RULES.goal.base * RULES.goal.reach.year;
  if (key.startsWith('challenge:d:')) return RULES.challenge.day;
  if (key.startsWith('challenge:w:')) return RULES.challenge.weekFull;
  return null;
};
/**
 * One day's record with nothing in it the rules cannot pay: each kind cut to its cap, and the day's number to every cap at
 * once (and never under the sum of its kinds). The same object comes back when it was already so.
 */
const fitRec = (r: DayRec): DayRec => {
  let k = r.k;
  if (k) for (const key of DAY_KEYS) if ((k[key] ?? 0) > KIND_MAX[key]) k = { ...k, [key]: KIND_MAX[key] };
  // at least the sum of its kinds (a merge takes a maximum per kind), at most every cap at once
  const n = Math.max(Math.min(r.n, DAY_MAX), sumK(k));
  return k === r.k && n === r.n ? r : { ...r, n, ...(k ? { k } : null) };
};

/**
 * A merged or stored object made regular: compacted to its own clock, each day's number made the sum of its kinds (which
 * is how "a maximum per kind" becomes the day's number after a merge), and nothing left in it that the rules cannot pay
 * (a day of 999 Orbs, a weekly bonus of 500: storage that was edited or damaged, which a merge by maximum would otherwise
 * keep for good). A store written under newer rules than this build knows is not cut. Idempotent. The phone and the server
 * both run it on what `mergeRewards` gives them; `parseRewards` runs it on everything it reads.
 */
export const tidy = (s: Rewards): Rewards => {
  const c = compact(s, s.clock);
  const known = c.rules <= RULES.version;
  let days: Rewards['days'] | null = null;
  for (const d in c.days) {
    const r = c.days[d]!;
    let next = r;
    if (known) next = fitRec(r);
    else {
      const sum = sumK(r.k);
      if (sum > r.n) next = { ...r, n: sum };
    }
    if (next === r) continue;
    days ??= { ...c.days };
    days[d] = next;
  }
  let once: Rewards['once'] | null = null;
  if (known)
    for (const key in c.once) {
      const max = onceMax(key);
      if (max === null || c.once[key]!.n <= max) continue;
      once ??= { ...c.once };
      once[key] = { ...c.once[key]!, n: max };
    }
  return days || once ? { ...c, days: days ?? c.days, once: once ?? c.once } : c;
};

/**
 * Whatever storage or the server holds, read as untrusted: text or an object, checked against `zRewards`, and only when it
 * belongs to `userId`. Garbage, another version, and another account's store are all null (the caller starts again).
 */
export const parseRewards = (raw: unknown, userId: string): Rewards | null => {
  if (!userId) return null;
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = zRewards.safeParse(v);
  if (!r.success || r.data.userId !== userId) return null;
  return tidy(r.data as Rewards);
};

const totals = new WeakMap<Rewards, number>();
/** Every Orb ever earned: the days and the once-ledger. Never stored. */
export const totalOf = (s: Rewards): number => {
  const hit = totals.get(s);
  if (hit !== undefined) return hit;
  let t = 0;
  for (const d in s.days) t += s.days[d]!.n;
  for (const k in s.once) t += s.once[k]!.n;
  totals.set(s, t);
  return t;
};
/** The Orbs of one day (0 when it holds none). */
export const orbsOn = (s: Rewards, date: ISODate): number => s.days[date]?.n ?? 0;
/** What a day paid, kind by kind, in the order of the rules table. Empty once the detail has been dropped. */
export const dayLines = (s: Rewards, date: ISODate): Array<{ key: DayKey; n: number }> => {
  const k = s.days[date]?.k;
  return k ? DAY_KEYS.flatMap((key) => (k[key] ? [{ key, n: k[key]! }] : [])) : [];
};

/**
 * How many more Orbs a kind can still pay on a day, by what the store holds now: what a control asks at the moment of a
 * tap, to know whether an Orb should be born there (the sixth to-do of a day gets its check and no Orb). A session at its
 * floor leaves room for the difference to a full one.
 *
 * 0 for a day that takes nothing: a closed day, with or without a record (two or more behind the store's clock); a day
 * that has not come; a day before the start, or while Orbs are off; and anything that is not a day. Hand in `now` (every
 * caller that has a clock should) and the answer is also 0 for yesterday once it has stopped taking taps at 03:00.
 */
export const roomFor = (s: Rewards, date: ISODate, key: Exclude<DayKey, 'full' | 'back'>, now?: Date): number => {
  if (!s.set.on || !isISODate(date) || shiftDays(date, 0) !== date) return 0;
  const r = s.days[date];
  if (r?.c || date < s.startedOn || inOff(s, date)) return 0;
  // closed by the clock: the reconciler never reads a day two or more behind the highest day this store has seen
  if (date < shiftDays(s.clock, -1)) return 0;
  // not yet come (by the time when there is one: the clock may be one pass behind on a new morning), or yesterday after 03:00
  if (now ? !isOpen(date, now, 'tap') : date > s.clock) return 0;
  const have = r?.k?.[key] ?? 0;
  if (key === 'todo') return Math.max(0, RULES.todo.cap * RULES.todo.each - have);
  if (key === 'habit') return Math.max(0, RULES.habit.cap * RULES.habit.each - have);
  if (key === 'goal:day') return Math.max(0, RULES.goalDay - have);
  if (have) return Math.max(0, RULES.train.done - have);
  return TRAIN_KINDS.filter((t) => r?.k?.[trainKey(t)]).length >= RULES.train.kinds ? 0 : RULES.train.done;
};

// ---------- one day ----------

const habitsLiveDone = (f: DayFacts) => f.habitsLiveDone ?? Math.min(f.habitsDone, f.habitsLive);
const trainLeft = (f: DayFacts) => f.trainLeft ?? (TRAIN_KINDS.some((k) => f.train[k]) ? 0 : 1);

/**
 * A full day: today's goal exists and is done; the training planned is done or its floor is (asked only when planned, not
 * skipped, Fitness on, not paused); every habit is done but one (all of them with two or fewer). The required set and the
 * earlier to-dos done that day must come to three things or more, so a goal alone is never a full day.
 */
export const isFullDay = (f: DayFacts): boolean => {
  if (f.goalDay !== 'done') return false;
  if (f.trainRequired && trainLeft(f) > 0) return false;
  const need = f.habitsLive <= 2 ? f.habitsLive : f.habitsLive - 1;
  if (habitsLiveDone(f) < need) return false;
  return 1 + f.habitsLive + (f.trainRequired ? 1 : 0) + f.todosEarlier >= RULES.full.min;
};

export interface EarnCtx {
  /** Is Fitness on? Off: the day keeps the training Orbs already in its record and gains none. Default on. */
  fitness?: boolean;
  /** `tap`: the day follows its facts. `evidence`: the day only takes training that synced late, and a late review of its goal. */
  src: 'tap' | 'evidence';
  /** The day is the first counted one after three or more missed (the reconciler decides). */
  back?: boolean;
}

const recOf = (k: Partial<Record<DayKey, number>>, a: number, flags: { h?: boolean; c?: 1; r?: 1 }): DayRec => {
  const out: DayRec = { n: 0, a: Math.min(999, a) };
  const kk: Partial<Record<DayKey, number>> = {};
  for (const key of DAY_KEYS) {
    const v = k[key];
    if (v) {
      kk[key] = v;
      out.n += v;
    }
  }
  if (out.n) out.k = kk;
  if (flags.c) out.c = 1;
  if (flags.h) out.h = 1;
  if (flags.r) out.r = 1;
  return out;
};
const trainValue = (st: 'done' | 'floor') => (st === 'done' ? RULES.train.done : RULES.train.floor);

/**
 * What a day is worth, from its facts. `prev` is the day's record so far: a closed one is returned as it is; an open one
 * matters only for what the facts cannot say again (the training Orbs kept while Fitness is off, and everything but late
 * evidence once the day has stopped taking taps).
 */
export const earnDay = (f: DayFacts, prev: DayRec | undefined, ctx: EarnCtx): DayRec => {
  if (prev?.c) return prev;
  const k: Partial<Record<DayKey, number>> = {};
  if (ctx.src === 'evidence') {
    Object.assign(k, prev?.k);
    let a = prev?.a ?? 0;
    const have = () => TRAIN_KINDS.filter((t) => k[trainKey(t)]).length;
    for (const t of TRAIN_KINDS) {
      const st = ctx.fitness === false ? undefined : f.auto?.[t];
      if (!st) continue;
      const key = trainKey(t);
      const was = k[key] ?? 0;
      if (trainValue(st) <= was || (!was && have() >= RULES.train.kinds)) continue;
      if (!was) a += 1;
      k[key] = trainValue(st);
    }
    // a late review: the goal's Orbs, once, and the day is not made to count by it
    if (f.goalDay === 'done' && !k['goal:day']) k['goal:day'] = RULES.goalDay;
    // a day this phone has no record of takes its pause from the status as it stands (a status cannot be back-dated)
    return recOf(k, a, { h: prev ? !!prev.h : f.held });
  }
  k.todo = Math.min(f.todosDone, RULES.todo.cap) * RULES.todo.each;
  k.habit = Math.min(f.habitsDone, RULES.habit.cap) * RULES.habit.each;
  let kinds = 0;
  if (ctx.fitness === false) {
    for (const t of TRAIN_KINDS) {
      const was = prev?.k?.[trainKey(t)];
      if (was) {
        k[trainKey(t)] = was;
        kinds++;
      }
    }
  } else {
    const paid = TRAIN_KINDS.flatMap((t) => (f.train[t] ? [{ t, v: trainValue(f.train[t]!) }] : []))
      .sort((x, y) => y.v - x.v)
      .slice(0, RULES.train.kinds);
    for (const p of paid) k[trainKey(p.t)] = p.v;
    kinds = paid.length;
  }
  const goal = f.goalDay === 'done';
  if (goal) k['goal:day'] = RULES.goalDay;
  const a = f.todosDone + f.habitsDone + kinds + (goal ? 1 : 0) + f.lines;
  if (isFullDay(f)) k.full = RULES.full.bonus;
  if (ctx.back && a >= 1) k.back = RULES.comeback.bonus;
  return recOf(k, a, { h: f.held });
};

const sameRec = (x: DayRec | undefined, y: DayRec | undefined): boolean => {
  if (x === y) return true;
  if (!x || !y) return false;
  if (x.n !== y.n || x.a !== y.a || x.c !== y.c || x.h !== y.h || x.r !== y.r) return false;
  for (const key of DAY_KEYS) if ((x.k?.[key] ?? 0) !== (y.k?.[key] ?? 0)) return false;
  return true;
};
const emptyRec = (r: DayRec) => !r.n && !r.a && !r.h && !r.c;

/**
 * Is `day` still open at `now`? For taps until 03:00 the next morning (Today holds on yesterday past midnight); for
 * evidence that syncs late until the end of the next day. Never for a day that has not come.
 */
export const isOpen = (day: ISODate, now: Date, src: 'tap' | 'evidence'): boolean => {
  const today = toISO(now);
  if (day > today) return false;
  if (day === today) return true;
  if (day !== shiftDays(today, -1)) return false;
  return src === 'evidence' || now.getHours() < RULES.close.tapHour;
};

// ---------- the count ----------

const inOff = (s: Rewards, d: ISODate): boolean => {
  for (const r of s.off) if (d >= r.from && (r.to === null || d <= r.to)) return true;
  return false;
};
export type DayState = 'counted' | 'neutral' | 'missed' | 'pending';
/** A day counts with one base action. A paused day, a day before the start and a day with Orbs off is neutral unless it counts. */
export const dayState = (s: Rewards, d: ISODate, today: ISODate): DayState => {
  const r = s.days[d];
  if (r && r.a >= 1) return 'counted';
  if (d < s.startedOn || r?.h || inOff(s, d)) return 'neutral';
  return d >= today ? 'pending' : 'missed';
};
export type WeekState = 'counted' | 'neutral' | 'missed' | 'pending';
const targetOf = (s: Rewards, monday: ISODate): 3 | 4 | 5 => s.wt[monday] ?? s.set.weekTarget;
/** A week's seven dates and the Monday before it, remembered: the count walks a year of weeks on every change, and date arithmetic is most of that walk. */
const weekDates = new Map<ISODate, { days: ISODate[]; prev: ISODate }>();
const datesOf = (monday: ISODate) => {
  let w = weekDates.get(monday);
  if (!w) {
    if (weekDates.size > 4000) weekDates.clear();
    weekDates.set(monday, (w = { days: Array.from({ length: 7 }, (_, i) => shiftDays(monday, i)), prev: shiftDays(monday, -7) }));
  }
  return w;
};
const weekOf = (s: Rewards, monday: ISODate, today: ISODate) => {
  let counted = 0;
  let neutral = 0;
  let pending = 0;
  const marks: boolean[] = [];
  const dates = datesOf(monday).days;
  for (let i = 0; i < 7; i++) {
    const st = dayState(s, dates[i]!, today);
    marks.push(st === 'counted');
    if (st === 'counted') counted++;
    else if (st === 'neutral') neutral++;
    else if (st === 'pending') pending++;
  }
  const target = targetOf(s, monday);
  const need = Math.max(1, target - neutral);
  const state: WeekState = counted >= target ? 'counted' : neutral >= RULES.week.neutral ? 'neutral' : counted >= need ? 'counted' : pending > 0 ? 'pending' : 'missed';
  return { counted, neutral, pending, marks, target, need, state };
};
/**
 * A week counts with its target of counted days (5 unless the person set 4 or 3). Each neutral day lowers what it needs;
 * with three or more neutral days the week is neutral, unless it met its whole target anyway.
 */
export const weekState = (s: Rewards, monday: ISODate, today: ISODate): WeekState => weekOf(s, monday, today).state;

export interface Count {
  /** Days in all. It only ever goes down by an untick in a day that is still open. */
  days: number;
  /** This week's seven marks, Monday first: does the day count? A day off, a miss and a paused day look the same. */
  marks: boolean[];
  /** Where today is in `marks` (0 Monday). */
  today: number;
  /** Counted days this week. */
  thisWeek: number;
  /** Weeks in a row. Shown only when it is 2 or more. */
  weeks: number;
  /** The person's week: 5, 4 or 3 days. */
  target: 3 | 4 | 5;
  /** What this week needs: the target less its neutral days. */
  need: number;
  /** Days off a week: 7 less the target. */
  daysOff: number;
  /** Days off still in hand this week. */
  offLeft: number;
  /** This week already counts. */
  kept: boolean;
}
const counted = new WeakMap<Rewards, Map<ISODate, Count>>();
/** Days in all, per `days` object. The reconciler keeps it in step as it changes a day, so a tap never walks every day. */
const daysInAll = new WeakMap<Rewards['days'], number>();
const daysIn = (days: Rewards['days']): number => {
  let n = daysInAll.get(days);
  if (n === undefined) {
    n = 0;
    for (const d in days) if (days[d]!.a >= 1) n++;
    daysInAll.set(days, n);
  }
  return n;
};
/**
 * The count, always recomputed from the stored days (and remembered per store object). Weeks in a row: consecutive counted
 * weeks; one missed week is forgiven when the next one counts (and while the next one is still in progress); two missed
 * weeks in a row end it; neutral weeks and the week in progress are skipped over.
 */
export const countOf = (s: Rewards, today: ISODate): Count => {
  const memo = counted.get(s) ?? new Map<ISODate, Count>();
  counted.set(s, memo);
  const hit = memo.get(today);
  if (hit) return hit;
  const days = daysIn(s.days);
  const monday = mondayOf(today);
  const w = weekOf(s, monday, today);
  const first = mondayOf(s.startedOn);
  let weeks = 0;
  let misses = 0;
  for (let m = monday, i = 0; m >= first && i < 1040; m = datesOf(m).prev, i++) {
    const st = m === monday ? w.state : weekOf(s, m, today).state;
    if (st === 'neutral' || st === 'pending') continue;
    if (st === 'counted') {
      weeks++;
      misses = 0;
    } else if (++misses >= 2) break;
  }
  const missed = 7 - w.counted - w.neutral - w.pending;
  const out: Count = { days, marks: w.marks, today: daysBetween(monday, today), thisWeek: w.counted, weeks, target: w.target, need: w.need, daysOff: 7 - w.target, offLeft: Math.max(0, 7 - w.target - missed), kept: w.state === 'counted' };
  memo.set(today, out);
  return out;
};

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
/** A small number as a word, capitalized ("Two"), for the lines below and the challenge titles. */
export const numberWord = (n: number): string => WORDS[n] ?? String(n);
/** The rule in eight words, by the person's week: "One thing a day. Two days off a week." Every day, with days off: never "5 of 7". */
export const ruleLine = (target: 3 | 4 | 5 = 5): string => `One thing a day. ${numberWord(7 - target)} days off a week.`;
/** Monday's line: "New week. Two days off in hand." */
export const mondayLine = (target: 3 | 4 | 5 = 5): string => `New week. ${numberWord(7 - target)} days off in hand.`;
/**
 * The fact line under the week: "5 days this week · 128 in all", with "· 6 weeks in a row" from two. No part is ever a
 * zero, and nothing is said when something ended.
 */
export const countLine = (c: Count): string => {
  const parts: string[] = [];
  if (c.thisWeek > 0) parts.push(`${c.thisWeek} ${c.thisWeek === 1 ? 'day' : 'days'} this week`);
  if (c.days > 0) parts.push(`${c.days} in all`);
  if (c.weeks >= 2) parts.push(`${c.weeks} weeks in a row`);
  return parts.join(' · ');
};

/**
 * The weekly bonus a week is worth: 5 Orbs times its rung, 0 when the week does not count. The rung climbs one with each
 * counted week up to x4, steps down one with a missed week (never below x1), and stays where it was over a neutral week.
 */
export const weekBonus = (s: Rewards, monday: ISODate): number => {
  const today = shiftDays(monday, 7);
  let rung = 1;
  for (let m = mondayOf(s.startedOn), i = 0; m <= monday && i < 1040; m = shiftDays(m, 7), i++) {
    const st = weekOf(s, m, today).state;
    if (m === monday) return st === 'counted' ? RULES.week.bonus * rung : 0;
    if (st === 'counted') rung = Math.min(RULES.week.top, rung + 1);
    else if (st === 'missed') rung = Math.max(1, rung - 1);
  }
  return 0;
};

export interface Level {
  level: number;
  /** Where this level began, and where the next one does. */
  floor: number;
  next: number;
  into: number;
  span: number;
  /** Orbs to the next level: "216 to level 6". */
  left: number;
}
/** Levels, numbered, with no top: 25, 75, 200, 500, 1,200, 2,500, 5,000, then every 5,000. */
export const levelOf = (total: number): Level => {
  const t = Math.max(0, Math.floor(total) || 0);
  let level = 1;
  let floor = 0;
  let next = RULES.levels[0]!;
  for (;;) {
    if (t < next) break;
    floor = next;
    level++;
    next = level <= RULES.levels.length ? RULES.levels[level - 1]! : floor + RULES.levelStep;
    if (level > RULES.levels.length && t >= next) {
      // past the listed thresholds every level is the same width: jump straight there
      const more = Math.floor((t - floor) / RULES.levelStep);
      level += more;
      floor += more * RULES.levelStep;
      next = floor + RULES.levelStep;
    }
  }
  return { level, floor, next, into: t - floor, span: next - floor, left: next - t };
};

// ---------- the once-ledger ----------

/** Pay a key once. A key already paid is left exactly as it is (the same object comes back), whatever `n` says now. */
export const earnOnce = (s: Rewards, key: string, n: number, on: ISODate): Rewards => {
  if (s.once[key] || !(n > 0)) return s;
  return { ...s, once: { ...s.once, [key]: { on, n: Math.floor(n) } } };
};

const localDay = (iso: string | null | undefined): ISODate | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : toISO(d);
};
/** The day a moment belongs to when a day runs until 03:00 the next morning. */
const heldDay = (iso: string | null | undefined): ISODate | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() - RULES.close.tapHour);
  return toISO(d);
};
/**
 * What a goal earns today, or null. Only a goal that is done; only inside its period or its review grace (day 1 day, week
 * 2, month 3, year 7); only when it was set before its period ended (a day's goal: before 03:00 the next morning, while the
 * day still takes taps) and early enough before it was marked (week 2 days, month 7, year 30). The key is the period, never the id, so a goal cleared and set again, or renamed by the server, is
 * the same goal. 3 Orbs times its reach: 3, 9, 30, 90.
 */
export const goalEarns = (g: Pick<Aim, 'level' | 'period' | 'status' | 'createdAt' | 'closedAt'>, today: ISODate): { key: string; n: number } | null => {
  if (g.status !== 'done') return null;
  const end = periodEnd(g.level, g.period);
  if (today < periodStart(g.level, g.period) || today > shiftDays(end, RULES.goal.grace[g.level])) return null;
  // a day runs until 03:00 the next morning (Today holds on it past midnight), so a goal set for it at 00:30 was set in it
  const made = g.level === 'day' ? heldDay(g.createdAt) : localDay(g.createdAt);
  if (!made || made > end) return null;
  const marked = localDay(g.closedAt) ?? today;
  if (daysBetween(made, marked) < RULES.goal.age[g.level]) return null;
  return { key: `goal:${g.level}:${g.period}`, n: RULES.goal.base * RULES.goal.reach[g.level] };
};

// ---------- the reconciler ----------

/**
 * A copy of a map of days. A plain loop: with a year of days in it, the engine copies this several times faster than a
 * spread, and it is the one copy a tap pays for.
 */
const copyOf = <T>(map: Record<string, T>): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const k in map) out[k] = map[k]!;
  return out;
};

export interface Gained {
  /** A day's kind (`todo`, `habit`, `train:run`, `goal:day`, `full`, `back`) or a once-key (`goal:week:<monday>`, `week:<monday>`, `challenge:d:<date>`). */
  key: string;
  n: number;
  /** The day the Orbs belong to (a day's kind), or the day they were paid (a once-key). */
  date: ISODate;
}
export interface ReconcileOpts {
  /** Is Fitness on (default yes)? */
  fitness?: boolean;
  /** The server's date as last heard, when it is fresh. A device day beyond it plus one does not count and does not move the clock. */
  serverDay?: ISODate;
  /** The goals as the app holds them: week, month and year goals that are due are paid into the once-ledger. */
  goals?: readonly Aim[];
  /** Development builds only: a start date other than `RULES.startsOn`. Nothing else may pass it. */
  startsOn?: ISODate;
  /**
   * How the person is training now (the status chip). A day under a pausing status that this phone never saw (the app
   * was not opened: in bed, away) is recorded as paused when the phone next looks, not left to read as missed. A status
   * cannot be set for days already past, so this is never a way to repair a week after the fact.
   */
  status?: TrainingStatus | null;
}

/**
 * A store with nothing in it dated later than `limit` (the server's date plus one: the last day any phone's date can
 * be). A device whose date was set ahead while it could not ask the server leaves days that have not happened, payments
 * and keepsakes dated in the future, weeks sealed before they were lived, and a clock in the future, and a clock in the
 * future closes every day before it: nothing would earn again until the calendar caught up. What is taken out here is
 * earned again, on its real day, if it is due. The same object comes back when there is nothing to take out. The server
 * runs the same cut on what a phone sends (`PUT /me/rewards`).
 */
export const within = (s: Rewards, limit: ISODate): Rewards => {
  const cut = <T>(map: Record<string, T>, late: (v: T, k: string) => boolean): Record<string, T> => {
    let out: Record<string, T> | null = null;
    for (const k in map) {
      if (!late(map[k]!, k)) continue;
      out ??= { ...map };
      delete out[k];
    }
    return out ?? map;
  };
  const days = cut(s.days, (_r, d) => d > limit);
  const once = cut(s.once, (o) => o.on > limit);
  const keepsakes = cut(s.keepsakes, (k) => k.on > limit);
  const seen = cut(s.seen, (d) => d > limit);
  const challenges = cut(s.challenges, (_c, k) => k.slice(-10) > limit);
  // a week is sealed once it is over
  const wt = cut(s.wt, (_t, m) => shiftDays(m, 7) > limit);
  const off = s.off.some((r) => r.from > limit || (r.to !== null && r.to > limit)) ? s.off.filter((r) => r.from <= limit).map((r) => (r.to !== null && r.to > limit ? { from: r.from, to: limit } : r)) : s.off;
  // the first day that can earn is in the future only before the rules begin, and then it is the day they begin
  const last = limit > RULES.startsOn ? limit : RULES.startsOn;
  const startedOn = s.startedOn > last ? last : s.startedOn;
  if (days === s.days && once === s.once && keepsakes === s.keepsakes && seen === s.seen && challenges === s.challenges && wt === s.wt && off === s.off && s.clock <= limit && startedOn === s.startedOn) return s;
  return { ...s, days, once, keepsakes, seen, challenges, wt, off, clock: s.clock > limit ? limit : s.clock, startedOn };
};

/** Is `d` the first counted day after three or more missed, with no comeback in the 13 days before it and a counted day before the gap? */
const comebackDue = (s: Rewards, d: ISODate): boolean => {
  // the usual case, first: yesterday counted, so today is no return
  if ((s.days[shiftDays(d, -1)]?.a ?? 0) >= 1) return false;
  for (let i = 1; i < RULES.comeback.every; i++) if (s.days[shiftDays(d, -i)]?.k?.back) return false;
  let missed = 0;
  for (let x = shiftDays(d, -1), i = 0; x >= s.startedOn && i < 400; x = shiftDays(x, -1), i++) {
    const st = dayState(s, x, d);
    if (st === 'counted') return missed >= RULES.comeback.missed;
    if (st === 'missed') missed++;
  }
  return false;
};

/**
 * One pass over the days that can still change. Facts for any other day are ignored, which is the whole defense against
 * back-filling: a closed day is never read again.
 *
 * - Today follows its facts. Yesterday does too until 03:00, then only takes training that synced late and a late review
 *   of its goal, until the day ends.
 * - A day two or more behind today, or more than one behind the highest day this store has seen, is closed.
 * - A finished week is sealed with the target it was lived under and paid its bonus once, from the second day after it.
 * - Week, month and year goals that are due are paid once (when `goals` is given).
 *
 * Returns the same store object when nothing changed, and what was gained (only gains: an untick is silent).
 */
export const reconcile = (store: Rewards, facts: readonly DayFacts[], now: Date, opts: ReconcileOpts = {}): { store: Rewards; gained: Gained[] } => {
  const gained: Gained[] = [];
  const today = toISO(now);
  const limit = opts.serverDay ? shiftDays(opts.serverDay, 1) : null;
  // what cannot be: once the server's date is known, the clock was never past tomorrow, and nothing dated there happened
  // (a pass made under a wrong date always moves the clock, so the clock alone says whether to look)
  if (limit && store.clock > limit) store = within(store, limit);
  if (limit && today > limit) {
    // the device is ahead of the server by more than a time zone: nothing counts until it is not
    return { store: limit > store.clock ? { ...store, clock: limit } : store, gained };
  }
  const clock = today > store.clock ? today : store.clock;
  const edge = shiftDays(clock, -1);
  const yesterday = shiftDays(today, -1);
  let s = store;
  let days = store.days;
  // the total and the days in all follow each change, so neither is recounted from every day after a tap
  let orbs = 0;
  let dayCount = 0;
  const setDay = (d: ISODate, rec: DayRec | null) => {
    if (days === store.days) days = copyOf(store.days);
    const was = days[d];
    orbs += (rec?.n ?? 0) - (was?.n ?? 0);
    dayCount += ((rec?.a ?? 0) >= 1 ? 1 : 0) - ((was?.a ?? 0) >= 1 ? 1 : 0);
    if (rec) days[d] = rec;
    else delete days[d];
  };
  if (store.set.on) {
    for (const f of facts) {
      const d = f.date;
      if (d > today || d < edge || d < store.startedOn || d < (opts.startsOn ?? RULES.startsOn) || inOff(store, d)) continue;
      const src = d === today ? 'tap' : d === yesterday ? (now.getHours() < RULES.close.tapHour ? 'tap' : 'evidence') : null;
      if (!src) continue;
      const prev = days[d];
      if (prev?.c) continue;
      const rec = earnDay(f, prev, { fitness: opts.fitness, src, back: src === 'tap' ? comebackDue({ ...store, days }, d) : false });
      if (sameRec(prev, rec) || (!prev && emptyRec(rec))) continue;
      for (const key of DAY_KEYS) {
        const up = (rec.k?.[key] ?? 0) - (prev?.k?.[key] ?? 0);
        if (up > 0) gained.push({ key, n: up, date: d });
      }
      setDay(d, emptyRec(rec) ? null : rec);
    }
  }
  // days under a pause that this phone never saw (the app stayed closed): paused, not missed
  if (opts.status && store.set.on && today > store.clock) {
    for (let d = shiftDays(store.clock, 1), i = 0; d < yesterday && i < 400; d = shiftDays(d, 1), i++) {
      if (days[d] || d < store.startedOn || inOff(store, d) || !pausedOn(opts.status, d)) continue;
      setDay(d, { n: 0, a: 0, c: 1, h: 1 });
    }
  }
  // close what can no longer change. Nothing new can close while the date stands where the last pass left it.
  if (today !== store.clock) {
    for (const d in days) {
      const r = days[d]!;
      if (!r.c && (d < yesterday || d < edge)) setDay(d, { ...r, c: 1 });
    }
  }
  if (days !== store.days) daysInAll.set(days, daysIn(store.days) + dayCount);
  if (days !== store.days || clock !== store.clock) s = { ...store, days, clock };

  // Finished weeks. A week is sealed with the target it was lived under as soon as it is over (from its next Monday), so
  // a change to "Your week" made that Monday starts with the new week. It is paid its bonus once its Sunday can no longer
  // take late evidence (from the Tuesday). The newest sealed week is looked at again on every pass until a newer one is
  // sealed: that is how Monday's seal is paid on Tuesday, and a missed week costs seven lookups to pass over.
  const first = mondayOf(s.startedOn);
  let sealed: ISODate | null = null;
  for (const m in s.wt) if (!sealed || m > sealed) sealed = m;
  let wt = s.wt;
  let once = s.once;
  for (let m = sealed ? shiftDays(sealed, 7) : first, i = 0; shiftDays(m, 7) <= today && i < 1040; m = shiftDays(m, 7), i++) {
    if (wt === s.wt) wt = { ...s.wt };
    wt[m] = s.set.weekTarget;
  }
  for (let m = sealed ?? first, i = 0; shiftDays(m, 7) < today && i < 1040; m = shiftDays(m, 7), i++) {
    const key = `week:${m}`;
    if (once[key]) continue;
    let rebuilt = false;
    for (const d of datesOf(m).days) if (s.days[d]?.r) rebuilt = true;
    if (rebuilt) continue;
    const view = wt === s.wt && once === s.once ? s : { ...s, wt, once };
    if (weekOf(view, m, shiftDays(m, 7)).state !== 'counted') continue;
    const n = weekBonus(view, m);
    if (!n) continue;
    if (once === s.once) once = { ...s.once };
    once[key] = { on: today, n };
    orbs += n;
    gained.push({ key, n, date: today });
  }
  if (opts.goals && s.set.on && !inOff(s, today)) {
    for (const g of opts.goals) {
      if (g.level === 'day' || g.status !== 'done') continue;
      const e = goalEarns(g, today);
      if (!e || once[e.key]) continue;
      if (once === s.once) once = { ...s.once };
      once[e.key] = { on: today, n: e.n };
      orbs += e.n;
      gained.push({ key: e.key, n: e.n, date: today });
    }
  }
  if (wt !== s.wt || once !== s.once) s = { ...s, wt, once };
  if (s !== store) totals.set(s, totalOf(store) + orbs);
  return { store: s, gained };
};

// ---------- merge ----------

const rankOf = (r: DayRec) => (r.c ? (r.r ? 1 : 2) : 0);
const joinDay = (x: DayRec, y: DayRec): DayRec => {
  const rx = rankOf(x);
  const ry = rankOf(y);
  if (rx !== ry) return rx > ry ? x : y;
  const out: DayRec = { n: Math.max(x.n, y.n), a: Math.max(x.a, y.a) };
  if (x.k || y.k) {
    const k: Partial<Record<DayKey, number>> = {};
    for (const key of DAY_KEYS) {
      const v = Math.max(x.k?.[key] ?? 0, y.k?.[key] ?? 0);
      if (v) k[key] = v;
    }
    if (Object.keys(k).length) out.k = k;
  }
  if (x.c) out.c = 1;
  if (x.h || y.h) out.h = 1;
  if (x.r) out.r = 1;
  return out;
};
const stable = (v: unknown): string => JSON.stringify(v, (_k, o: unknown) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : o));
/** The one of two that sorts first by its JSON: an arbitrary but fixed choice, so a tie is settled the same way everywhere. */
const firstOf = <T>(x: T, y: T): T => (stable(x) <= stable(y) ? x : y);
// letting go is further than holding on: a challenge dropped on one phone ("Drop it") is not brought back as `added` by
// the copy another phone, or the server, still holds. A payment is never lost to it: that is the once-ledger's.
const STATE_RANK: Record<ChallengeStateName, number> = { offered: 1, added: 2, skipped: 3, void: 3, done: 4 };
const joinChallenge = (x: Challenge, y: Challenge): Challenge => {
  const d = STATE_RANK[x.state] - STATE_RANK[y.state];
  if (d) return d > 0 ? x : y;
  // the same standing: the earlier one wins (an offer is frozen at its first generation; the first add stands)
  if (x.at !== y.at) return x.at < y.at ? x : y;
  return firstOf(x, y);
};
const joinKeepsake = (x: Keepsake, y: Keepsake): Keepsake => (x.on !== y.on ? (x.on < y.on ? x : y) : firstOf(x, y));
const joinMap = <T>(a: Record<string, T>, b: Record<string, T>, join: (x: T, y: T) => T): Record<string, T> => {
  const out: Record<string, T> = { ...a };
  for (const k in b) out[k] = k in a ? join(a[k]!, b[k]!) : b[k]!;
  return out;
};
const joinOff = (a: Rewards['off'], b: Rewards['off']): Rewards['off'] => {
  const by = new Map<ISODate, ISODate | null>();
  for (const r of [...a, ...b]) {
    const was = by.get(r.from);
    by.set(r.from, was === undefined ? r.to : was === null ? r.to : r.to === null ? was : was > r.to ? was : r.to);
  }
  return [...by.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).slice(-200).map(([from, to]) => ({ from, to }));
};

/**
 * Two copies of one account's store, made one. Commutative, associative and idempotent, so the phone and the server can
 * merge in any order and any number of times and agree.
 *
 * - A day: a closed record beats an open one; a real closed record beats one rebuilt after a wipe; two of the same
 *   standing take the maximum of the number, of the actions and of each kind. (Open days are never sent: each phone
 *   recomputes them from the synced facts. `tidy` then makes a closed day's number the sum of its kinds.)
 * - The once-ledger: the larger payment and the earlier day. Keepsakes and "seen": the earlier day.
 * - A challenge: the further state (offered, added, let go, done), then the earlier time. The switches: the newest change.
 * - Another account's store is never merged: `a` comes back.
 */
export const mergeRewards = (a: Rewards, b: Rewards): Rewards => {
  if (a.userId !== b.userId) return a;
  const set = a.set.at !== b.set.at ? (a.set.at > b.set.at ? a.set : b.set) : firstOf(a.set, b.set);
  return {
    v: 1,
    rules: Math.max(a.rules, b.rules),
    userId: a.userId,
    startedOn: a.startedOn < b.startedOn ? a.startedOn : b.startedOn,
    clock: a.clock > b.clock ? a.clock : b.clock,
    days: joinMap(a.days, b.days, joinDay),
    once: joinMap(a.once, b.once, (x, y) => ({ on: x.on < y.on ? x.on : y.on, n: Math.max(x.n, y.n) })),
    challenges: joinMap(a.challenges, b.challenges, joinChallenge),
    keepsakes: joinMap(a.keepsakes, b.keepsakes, joinKeepsake),
    off: joinOff(a.off, b.off),
    set: { ...set },
    wt: joinMap(a.wt, b.wt, (x, y) => (x < y ? x : y)),
    seen: joinMap(a.seen, b.seen, (x, y) => (x < y ? x : y)),
  };
};
/** Do two stores hold the same thing (key order aside)? */
export const sameRewards = (a: Rewards, b: Rewards): boolean => a === b || stable(a) === stable(b);
/** What is sent to the server: closed days only (an open day is recomputed by each phone from the synced facts). */
export const forSync = (s: Rewards): Rewards => {
  let days: Rewards['days'] | null = null;
  for (const d in s.days) {
    if (s.days[d]!.c) continue;
    days ??= { ...s.days };
    delete days[d];
  }
  return days ? { ...s, days } : s;
};

// ---------- after a wipe ----------

/**
 * A store re-derived from the account's own facts after this device lost its copy (sign-out, Reset, a reinstall) and the
 * server has none. Every day from `from` (never before `RULES.startsOn`) to yesterday is read as it stands now, pays its
 * base Orbs only (no full day, no comeback, no weekly bonus), and is closed and marked rebuilt. Today is left to the
 * reconciler.
 */
export const rebuild = (facts: readonly DayFacts[], from: ISODate, today: ISODate, userId: string, set: RewardSet = DEFAULT_SET, floor: ISODate = RULES.startsOn): Rewards => {
  const s = emptyRewards(userId, from, set, floor);
  let fullOn: ISODate | null = null;
  for (const f of facts) {
    if (f.date < s.startedOn || f.date >= today) continue;
    const rec = rebuiltRec(f);
    if (rec) s.days[f.date] = rec;
    if (isFullDay(f) && (!fullOn || f.date < fullOn)) fullOn = f.date;
  }
  s.clock = today > s.startedOn ? today : s.startedOn;
  // Keepsakes are earned at fixed moments, and the ones the facts can still show are put back: the first full day (its
  // +5 is not paid again), and the weeks in a row as they stood on each Monday since (a later gap does not take them).
  // The first Orb, the days in all and the chapters come back by `keepsakesDue`, which reads them from the days.
  if (fullOn) s.keepsakes.full = { on: fullOn };
  for (let m = shiftDays(mondayOf(s.startedOn), 7), i = 0; i < 1040; m = shiftDays(m, 7), i++) {
    const on = m > today ? today : m;
    const weeks = countOf(s, on).weeks;
    for (const n of RULES.keepsakes.weeks) if (weeks >= n && !s.keepsakes[`weeks:${n}`]) s.keepsakes[`weeks:${n}`] = { on };
    if (m >= today) break;
  }
  return s;
};
/** A day read back from the account's facts as they stand: base Orbs only, closed, marked rebuilt. Null when the day holds nothing. */
const rebuiltRec = (f: DayFacts): DayRec | null => {
  const full = earnDay(f, undefined, { src: 'tap' });
  const { full: _f, back: _b, ...base } = full.k ?? {};
  const rec = recOf(base, full.a, { h: !!full.h, c: 1, r: 1 });
  return rec.n || rec.a || rec.h ? rec : null;
};

/**
 * The account's copy, as a device with no store of its own takes it (a new phone, after Sign out, after the error
 * screen's Reset), made whole. The copy never holds an open day (`forSync`), so the days that were still open when it was
 * last sent (the day before its clock, and every day since) are not in it, and this device never saw them. Without this
 * yesterday's Orbs, and yesterday itself in the count, were lost every time a phone signed out and in.
 *
 * Those days, and only those, are read from the account's own facts, each as the phone that held it would have counted
 * it (the full day and the comeback included, so signing out and in takes nothing away): closed, except yesterday,
 * which stays open for a run that syncs late. A day the copy holds is left exactly as it is, and a day that had already
 * closed when the copy was sent is never filled (it was seen, and held nothing: filling it would pay for back-fill).
 * `facts` are for days that no longer take taps; today is left to the reconciler. The same object comes back when there
 * is nothing to fill.
 */
export const fillFrom = (kept: Rewards, facts: readonly DayFacts[], today: ISODate): Rewards => {
  if (!kept.set.on) return kept;
  const open = shiftDays(kept.clock, -1);
  const from = open > kept.startedOn ? open : kept.startedOn;
  const yesterday = shiftDays(today, -1);
  let days: Rewards['days'] | null = null;
  for (const f of [...facts].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))) {
    const d = f.date;
    if (d < from || d >= today || kept.days[d] || days?.[d] || inOff(kept, d)) continue;
    const rec = earnDay(f, undefined, { src: 'tap', back: comebackDue(days ? { ...kept, days } : kept, d) });
    if (emptyRec(rec)) continue;
    days ??= { ...kept.days };
    days[d] = d < yesterday ? { ...rec, c: 1 } : rec;
  }
  return days ? { ...kept, days } : kept;
};

// ---------- the switches ----------

/**
 * A change to the switches, stamped with `now`. Switching Orbs off opens a range of neutral days from today; switching
 * them on closes it at yesterday (off and on again the same day leaves nothing). Returns the same store when nothing
 * changes.
 */
export const applySet = (s: Rewards, patch: Partial<Omit<RewardSet, 'at'>>, now: Date): Rewards => {
  const next: RewardSet = { ...s.set, ...patch, at: s.set.at };
  if (next.on === s.set.on && next.show === s.set.show && next.weekTarget === s.set.weekTarget && next.cadence === s.set.cadence && next.size === s.set.size) return s;
  next.at = now.toISOString();
  let off = s.off;
  const today = toISO(now);
  // "A change starts with this week": every week that is already over keeps the target it was lived under
  let wt = s.wt;
  if (next.weekTarget !== s.set.weekTarget) {
    let sealed: ISODate | null = null;
    for (const m in s.wt) if (!sealed || m > sealed) sealed = m;
    for (let m = sealed ? shiftDays(sealed, 7) : mondayOf(s.startedOn), i = 0; shiftDays(m, 7) <= today && i < 1040; m = shiftDays(m, 7), i++) {
      if (wt === s.wt) wt = { ...s.wt };
      wt[m] = s.set.weekTarget;
    }
  }
  if (next.on !== s.set.on) {
    if (!next.on) off = off.some((r) => r.to === null) ? off : [...off, { from: today, to: null }];
    else off = off.flatMap((r) => (r.to !== null ? [r] : r.from >= today ? [] : [{ from: r.from, to: shiftDays(today, -1) }]));
  }
  return { ...s, set: next, off, wt };
};
/** Take a whole set of switches (this device's own key, or the newest from a merge) into the store, ranges and all. */
export const adoptSet = (s: Rewards, set: RewardSet, now: Date): Rewards => {
  const applied = applySet(s, { on: set.on, show: set.show, weekTarget: set.weekTarget, cadence: set.cadence, size: set.size }, now);
  return applied.set.at === set.at ? applied : { ...applied, set: { ...applied.set, at: set.at } };
};

// ---------- keepsakes, chapters, what is new ----------

export interface Chapter {
  /** Which chapter this is, from 1. */
  n: number;
  start: ISODate;
  end: ISODate;
  /** The Monday it closes on. */
  closes: ISODate;
  /** Today's place in it, 1 to 28. */
  day: number;
  /** Orbs earned in it so far (its days only), and its counted days. The chapter's bar starts again; the total and the level do not. */
  orbs: number;
  days: number;
}
const chapterStart = (s: Rewards, date: ISODate): { start: ISODate; index: number } => {
  const zero = mondayOf(s.startedOn);
  const index = Math.max(0, Math.floor(daysBetween(zero, date) / RULES.chapterDays));
  return { start: shiftDays(zero, index * RULES.chapterDays), index };
};
/** The chapter `today` is in: four weeks from a Monday, counted from the week the store began. */
export const chapterOf = (s: Rewards, today: ISODate): Chapter => {
  const { start, index } = chapterStart(s, today);
  let orbs = 0;
  let days = 0;
  for (let i = 0; i < RULES.chapterDays; i++) {
    const r = s.days[shiftDays(start, i)];
    if (!r) continue;
    orbs += r.n;
    if (r.a >= 1) days++;
  }
  return { n: index + 1, start, end: shiftDays(start, RULES.chapterDays - 1), closes: shiftDays(start, RULES.chapterDays), day: daysBetween(start, today) + 1, orbs, days };
};
/** Which chapter a `chapter:<monday>` keepsake is (from 1). */
export const chapterNumber = (s: Rewards, key: string): number => chapterStart(s, key.slice(8)).index + 1;

const fnv = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};
/** A fixed number from a text (FNV-1a): the same on every device, so a choice "by seed" is the same everywhere. */
export const seedOf = (text: string): number => fnv(text);

export interface KeepsakeExtra {
  /** The goals as the app holds them: a month or year goal's keepsake carries the goal's own words. */
  goals?: readonly Pick<Aim, 'level' | 'period' | 'text'>[];
  /** Journal lines the app holds: a chapter's keepsake carries one that was written in it. */
  lines?: ReadonlyArray<{ date: ISODate; text: string }>;
}
const clip = (t: string) => (t.length > 200 ? `${t.slice(0, 199)}…` : t);

/**
 * The keepsakes a store has earned and does not hold yet. Fixed moments, never chance: the first Orb (`first`); weeks in a
 * row 2, 4, 8, 12, 26, 52 (`weeks:N`); days in all 10, 50, 100, 250, 365, 500, 1,000 (`days:N`); the first full day
 * (`full`); the first challenge (`challenge`); a month goal and a year goal with the goal's words (`goal:month:<yyyy-mm>`,
 * `goal:year:<yyyy>`); and a chapter every four weeks on a Monday (`chapter:<its first Monday>`) with that chapter's own
 * facts and one line written in it. A chapter with no counted day leaves none.
 */
export const keepsakesDue = (s: Rewards, now: Date, extra: KeepsakeExtra = {}): Array<{ key: string; keepsake: Keepsake }> => {
  const today = toISO(now);
  const out: Array<{ key: string; keepsake: Keepsake }> = [];
  const due = (key: string, keepsake: Keepsake) => {
    if (!s.keepsakes[key]) out.push({ key, keepsake });
  };
  // the days in order, only when something below needs them (after the first weeks nearly nothing does)
  let sorted: ISODate[] | null = null;
  const dates = () => (sorted ??= Object.keys(s.days).sort());
  if (!s.keepsakes.first && totalOf(s) > 0) {
    let on: ISODate | null = null;
    for (const d in s.days) if (s.days[d]!.n > 0 && (!on || d < on)) on = d;
    for (const k in s.once) if (s.once[k]!.n > 0 && (!on || s.once[k]!.on < on)) on = s.once[k]!.on;
    if (on) due('first', { on });
  }
  const c = countOf(s, today);
  for (const n of RULES.keepsakes.weeks) if (c.weeks >= n) due(`weeks:${n}`, { on: today });
  if (RULES.keepsakes.days.some((n) => c.days >= n && !s.keepsakes[`days:${n}`])) {
    const countedDays = dates().filter((d) => s.days[d]!.a >= 1);
    for (const n of RULES.keepsakes.days) if (c.days >= n) due(`days:${n}`, { on: countedDays[n - 1] ?? today });
  }
  if (!s.keepsakes.full) {
    let on: ISODate | null = null;
    for (const d in s.days) if (s.days[d]!.k?.full && (!on || d < on)) on = d;
    if (on) due('full', { on });
  }
  let firstChallenge: ISODate | null = null;
  for (const k in s.once) {
    const o = s.once[k]!;
    if (k.startsWith('challenge:')) {
      if (!firstChallenge || o.on < firstChallenge) firstChallenge = o.on;
    } else if (k.startsWith('goal:month:') || k.startsWith('goal:year:')) {
      const [, level, period] = k.split(':') as [string, GoalLevel, string];
      const words = extra.goals?.find((g) => g.level === level && g.period === period)?.text.trim();
      due(k, words ? { on: o.on, t: clip(words) } : { on: o.on });
    }
  }
  if (firstChallenge) due('challenge', { on: firstChallenge });
  // Chapters that have closed (the Monday after their last Sunday, once that Sunday has stopped taking taps), newest
  // first, back to the newest one already kept: they are added in order, so nothing older is waiting. A year at most.
  const zero = mondayOf(s.startedOn);
  let last = Math.floor(daysBetween(zero, today) / RULES.chapterDays) - 1;
  if (last >= 0 && shiftDays(zero, (last + 1) * RULES.chapterDays) === today && now.getHours() < RULES.close.tapHour) last--;
  const chapters: Array<{ key: string; keepsake: Keepsake }> = [];
  for (let i = last; i >= 0 && i > last - 13; i--) {
    const start = shiftDays(zero, i * RULES.chapterDays);
    const key = `chapter:${start}`;
    if (s.keepsakes[key]) break;
    const closes = shiftDays(start, RULES.chapterDays);
    let d = 0;
    let sessions = 0;
    let goals = 0;
    for (let j = 0; j < RULES.chapterDays; j++) {
      const r = s.days[shiftDays(start, j)];
      if (!r) continue;
      if (r.a >= 1) d++;
      for (const t of TRAIN_KINDS) if (r.k?.[trainKey(t)]) sessions++;
      if (r.k?.['goal:day']) goals++;
    }
    if (!d) continue;
    const end = shiftDays(closes, -1);
    for (const k in s.once) if (k.startsWith('goal:') && s.once[k]!.on >= start && s.once[k]!.on <= end) goals++;
    const line = chapterLine(s.userId, start, extra.lines ?? []);
    chapters.push({ key, keepsake: { on: closes, d, s: sessions, g: goals, ...(line ? { t: line } : null) } });
  }
  out.push(...chapters.reverse());
  return out;
};
/** The one line a chapter carries: chosen by a seed (the account and the chapter), so every device picks the same one from the same lines. */
const chapterLine = (userId: string, start: ISODate, lines: ReadonlyArray<{ date: ISODate; text: string }>): string | null => {
  const end = shiftDays(start, RULES.chapterDays - 1);
  const written = lines.filter((l) => l.date >= start && l.date <= end && l.text.trim()).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.text < y.text ? -1 : 1));
  return written.length ? clip(written[fnv(`${userId}:${start}`) % written.length]!.text.trim()) : null;
};
/**
 * A chapter's keepsake that holds no line yet takes one, when the journal's lines are there. A chapter closes on the
 * first pass of its Monday, and on a cold open that pass runs before the journal's list has answered: the keepsake was
 * then made without its line and, a keepsake being left as it is once held, never got one. Only the line is added; the
 * same store comes back when there is nothing to add.
 */
export const chapterLines = (s: Rewards, lines: ReadonlyArray<{ date: ISODate; text: string }>): Rewards => {
  if (!lines.length) return s;
  let keepsakes: Rewards['keepsakes'] | null = null;
  for (const key in s.keepsakes) {
    if (!key.startsWith('chapter:') || s.keepsakes[key]!.t) continue;
    const line = chapterLine(s.userId, key.slice(8), lines);
    if (!line) continue;
    keepsakes ??= { ...s.keepsakes };
    keepsakes[key] = { ...s.keepsakes[key]!, t: line };
  }
  return keepsakes ? { ...s, keepsakes } : s;
};
/** Put keepsakes in the store. One already there is left as it is; the same store comes back when nothing is new. */
export const addKeepsakes = (s: Rewards, due: ReadonlyArray<{ key: string; keepsake: Keepsake }>): Rewards => {
  let keepsakes: Rewards['keepsakes'] | null = null;
  for (const { key, keepsake } of due) {
    if (s.keepsakes[key] || keepsakes?.[key]) continue;
    keepsakes ??= { ...s.keepsakes };
    keepsakes[key] = keepsake;
  }
  return keepsakes ? { ...s, keepsakes } : s;
};

const isGoalKey = (k: string) => k.startsWith('goal:week:') || k.startsWith('goal:month:') || k.startsWith('goal:year:');
/** Everything earned that shows as a row on the Orbs page and has not been seen: keepsakes, and week, month and year goals. Newest first. */
export const newKeys = (s: Rewards): string[] => {
  const on = new Map<string, ISODate>();
  for (const k in s.keepsakes) if (!s.seen[k]) on.set(k, s.keepsakes[k]!.on);
  for (const k in s.once) if (isGoalKey(k) && !s.seen[k] && !on.has(k)) on.set(k, s.once[k]!.on);
  return [...on.entries()].sort(([ka, a], [kb, b]) => (a !== b ? (a < b ? 1 : -1) : ka < kb ? -1 : 1)).map(([k]) => k);
};
/** Is this one of the moments that open full screen? A week, month or year goal; weeks in a row 4, 12, 26, 52; days in all 100, 365, 1,000; a chapter. */
export const isBigMoment = (key: string): boolean => {
  if (isGoalKey(key) || key.startsWith('chapter:')) return true;
  const [what, n] = key.split(':');
  if (what === 'weeks') return RULES.moments.weeks.includes(Number(n));
  if (what === 'days') return RULES.moments.days.includes(Number(n));
  return false;
};
export interface Moment {
  key: string;
  /** The day it was earned. */
  on: ISODate;
  /** The Orbs it paid (a goal), when it paid any. */
  n?: number;
  keepsake?: Keepsake;
}
/**
 * The big moments waiting to be shown, oldest first, and only as many as may be shown now: at most two in any seven days
 * (counting the ones marked seen in the last seven). The rest stay "New" rows (`newKeys`) until their turn.
 */
export const pendingMoments = (s: Rewards, today: ISODate): Moment[] => {
  const since = shiftDays(today, -6);
  let recent = 0;
  for (const k in s.seen) if (isBigMoment(k) && s.seen[k]! >= since) recent++;
  const room = RULES.moments.perWeek - recent;
  if (room <= 0) return [];
  const all = new Map<string, Moment>();
  for (const k in s.once) if (isGoalKey(k) && !s.seen[k]) all.set(k, { key: k, on: s.once[k]!.on, n: s.once[k]!.n });
  for (const k in s.keepsakes) if (isBigMoment(k) && !s.seen[k]) all.set(k, { ...all.get(k), key: k, on: all.get(k)?.on ?? s.keepsakes[k]!.on, keepsake: s.keepsakes[k]! });
  return [...all.values()].sort((x, y) => (x.on !== y.on ? (x.on < y.on ? -1 : 1) : x.key < y.key ? -1 : 1)).slice(0, room);
};
/** Mark a keepsake or a goal's moment seen on `today`. Seen once is seen: the same store comes back the second time. */
export const markSeen = (s: Rewards, key: string, today: ISODate): Rewards => (s.seen[key] ? s : { ...s, seen: { ...s.seen, [key]: today } });

// ---------- the one way from the app's records to a day's facts ----------

/**
 * What the rules need to know about the account's records. The phone builds one from its caches, read through the same
 * Fitness filter as its screens (with Fitness off, `snap` holds no training); a server can build one from its tables.
 */
export interface World {
  /** Sessions, activities and logged sets, as the status rules read them. */
  snap: Snapshot;
  todos: readonly Todo[];
  /** The to-dos checked off on a day, when the caller keeps them by day (the phone does: it asks after every tap). */
  todosDoneOn?(date: ISODate): readonly Todo[];
  /** Every habit, archived ones included. */
  habits: readonly Habit[];
  checksOn(date: ISODate): readonly HabitCheck[];
  goals: readonly Aim[];
  /** The day's goal, when the caller keeps the goals by period. */
  dayGoal?(date: ISODate): Aim | undefined;
  /** How many journal lines a day holds. */
  linesOn(date: ISODate): number;
  /** How the person is training now (the status chip). */
  status: TrainingStatus | null | undefined;
  fitness: boolean;
}

/**
 * One day's facts from the account's records. Nothing here is keyed by a row id that outlives the call, so a row under a
 * provisional id and the same row under the server's id are the same fact.
 */
export const dayFactsOf = (w: World, date: ISODate, today: ISODate): DayFacts => {
  let todosDone = 0;
  let todosEarlier = 0;
  for (const t of w.todosDoneOn ? w.todosDoneOn(date) : w.todos) {
    if (t.doneOn !== date || (t.deletedOn && t.deletedOn <= date)) continue;
    todosDone++;
    if (t.createdOn < date) todosEarlier++;
  }
  const done = new Set<string>();
  for (const c of w.checksOn(date)) if (c.done) done.add(c.habitId);
  let habitsLive = 0;
  let habitsDone = 0;
  let liveDone = 0;
  for (const h of w.habits) {
    if (h.archivedOn && h.archivedOn < date) continue;
    const live = h.createdOn < date;
    if (live) habitsLive++;
    if (done.has(h.id)) {
      habitsDone++;
      if (live) liveDone++;
    }
  }
  const held = pausedOn(w.status, date);
  const train: DayFacts['train'] = {};
  const auto: NonNullable<DayFacts['auto']> = {};
  let planned = 0;
  let left = 0;
  if (w.fitness) {
    const sessions = w.snap.sessionsOn(date);
    const acts = w.snap.activitiesOn(date);
    for (const s of sessions) {
      if (s.kind === 'rest' || isSkipMark(s.mark)) continue;
      planned++;
      const st = sessionStatus(w.snap, date, s);
      if (!counts(st)) {
        left++;
        continue;
      }
      const kind = s.kind as TrainKind;
      if (st === 'done' || !train[kind]) train[kind] = st === 'done' ? 'done' : 'floor';
    }
    // training nothing was planned for still earns: a run that happened, sets that were logged
    for (const k of TRAIN_KINDS) if (!train[k] && (acts.some((a) => a.kind === k) || (k === 'lift' && w.snap.liftSetCountOn(date) > 0))) train[k] = 'done';
    // what a synced activity alone shows
    const ran = acts.filter((a) => a.kind === 'run').reduce((t, a) => t + a.miles, 0);
    if (ran > 0) {
      const plannedMiles = sessions.filter((s) => s.kind === 'run' && !isSkipMark(s.mark)).reduce((t, s) => t + (Number(s.miles) || 0), 0);
      auto.run = plannedMiles > 0 && ran < plannedMiles * RUN_FLOOR_RATIO ? 'floor' : 'done';
    }
    if (acts.some((a) => a.kind === 'lift')) auto.lift = 'done';
    if (acts.some((a) => a.kind === 'cross')) auto.cross = 'done';
  }
  const g = w.dayGoal ? w.dayGoal(date) : w.goals.find((x) => x.level === 'day' && x.period === date);
  return {
    date,
    todosDone,
    todosEarlier,
    habitsLive,
    habitsDone,
    habitsLiveDone: liveDone,
    lines: w.linesOn(date),
    train,
    auto,
    trainRequired: w.fitness && !held && planned > 0,
    trainLeft: left,
    goalDay: !g ? 'none' : goalEarns(g, today) ? 'done' : 'open',
    held,
  };
};
