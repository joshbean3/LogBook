import type { Moment } from '@logbook/shared';

/**
 * The moment's rules, with no DOM in them: when an Orb may pop and how many, the shape of the rise and of the fan, how
 * long a flight to the counter takes, which node of the pool a new Orb takes, what the counter shows while Orbs are in
 * the air, the words of a toast and of a big moment, and when a big moment may open. The layer (layer.ts), the wiring
 * (index.ts) and the screens read these.
 *
 * The numbers are the design critic's (rewards-critique-notes.md, design item 3). The two an owner is most likely to
 * tune by thumb are `POP.peak` (the overshoot) and `POP.rise` (how far a single Orb travels).
 */

// ---------- the single Orb ----------
export const POP = {
  /** A single Orb's core, in px. */
  size: 20,
  /** One of a fan's, in px. */
  fanSize: 18,
  /** At rest by the counter, in px: a flight ends at this size. */
  restSize: 12,
  /** Where the scale starts. */
  from: 0.3,
  /** The overshoot. */
  peak: 1.2,
  /** 0 to `inMs`: opacity 0 to 1 and scale `from` to `peak`. */
  inMs: 120,
  /** `inMs` to `settleMs`: scale back to 1. */
  settleMs: 260,
  /** How far a single Orb rises, in px, over `riseMs`. */
  rise: 48,
  /** How far it drifts to the trailing side, in px. */
  drift: 10,
  riseMs: 420,
  /** With no counter on screen: from here it fades and shrinks to `fadeScale`, done at `fadeEndMs`. */
  fadeFromMs: 300,
  fadeEndMs: 480,
  fadeScale: 0.7,
  /** With the counter on screen: the flight starts here instead of the fade. */
  flyAtMs: 300,
  /** Everything of one Orb is over by here (the node is free again). */
  goneMs: 620,
} as const;
/** Reduce Motion: the Orb fades in above the control, holds, fades out. No travel, no scale. */
export const STILL = { inMs: 150, holdMs: 400, outMs: 150, above: 14 } as const;
/** The fan of three (a session, today's goal): 60 ms apart, at these angles (degrees from straight up), rising this far. */
export const FAN = { stepMs: 60, angles: [-16, 0, 16], rises: [40, 60, 44] } as const;
/** The counter on landing: the sun 1 to `peak` to 1 over `ms`. */
export const LAND = { peak: 1.18, ms: 300 } as const;
/** Six nodes: a seventh live Orb takes the oldest. */
export const POOL_SIZE = 6;
/** One subject (one habit, one to-do, a day's goal, a session) pops at most once in this long. */
export const SUBJECT_QUIET_MS = 10_000;
/** A sheet takes this long to open: no Orb is born over one that is on its way up. */
export const SHEET_OPENING_MS = 520;
/** A claim the engine never confirmed (the write was refused, the check was taken back) is forgotten after this long. */
export const CLAIM_MS = 12_000;
/** The status region speaks this long after the last award. */
export const STATUS_AFTER_MS = 1200;

/** How long a flight to the counter takes, from how far it is (px): clamp(280, 220 + 0.5 x distance, 460). */
export const flightMs = (distance: number): number => Math.round(Math.min(460, Math.max(280, 220 + 0.5 * Math.max(0, distance))));

export type PopMode = 'rise' | 'fly' | 'still';
export interface PopAsk {
  /** How many Orbs the control thinks it earned: 1 (a to-do, a habit), 2 (a session at its floor) or 3. */
  n: number;
  /** The "Orbs" switch. */
  on: boolean;
  /** "Show Orbs when you earn them". */
  show: boolean;
  /** What the store says is left for this kind on this day (`orbRoom`). 0 for a closed day and past the caps. */
  room: number;
  /** Orbs already popped for this kind and day that the store has not counted yet (a burst of taps counts its own). */
  claimed: number;
  /** ms since this subject last popped, or null. */
  sinceSubject: number | null;
  /** The page is hidden. */
  hidden?: boolean;
  /** A sheet is on its way up. */
  sheetOpening?: boolean;
  /** Reduce Motion. */
  reduce?: boolean;
  /** The counter is on screen (and nothing covers it). */
  counter?: boolean;
}
/**
 * May an Orb pop, how many, and how? No Orbs with the switches off, with no room left (the sixth to-do, the ninth
 * habit, a closed day), inside the subject's quiet time, on a hidden page or over an opening sheet. Never more than
 * three. Reduce Motion pops still; a counter on screen makes it a flight.
 */
export const popPlan = (a: PopAsk): { n: number; mode: PopMode } => {
  const none = { n: 0, mode: 'rise' as PopMode };
  if (!a.on || !a.show || a.hidden || a.sheetOpening) return none;
  if (a.sinceSubject !== null && a.sinceSubject < SUBJECT_QUIET_MS) return none;
  const n = Math.max(0, Math.min(Math.floor(a.n), a.room - a.claimed, 3));
  if (!n) return none;
  return { n, mode: a.reduce ? 'still' : a.counter ? 'fly' : 'rise' };
};

export interface Light {
  /** Core size in px. */
  size: number;
  /** ms after the birth frame. */
  delay: number;
  /** Where it ends its rise, from the control's center (px; y up is negative). */
  dx: number;
  dy: number;
}
/**
 * The lights of one award. One: 20 pt, rising 48 and drifting 10 to the trailing side (`dir` 1 in a left-to-right
 * layout). Three: 18 pt, 60 ms apart, fanned at -16, 0 and +16 degrees, rising 40, 60 and 44. Two (a session at its
 * floor): the fan's outer pair.
 */
export const lightsOf = (n: number, dir: 1 | -1 = 1): Light[] => {
  if (n <= 1) return [{ size: POP.size, delay: 0, dx: POP.drift * dir, dy: -POP.rise }];
  const idx = n === 2 ? [0, 2] : [0, 1, 2];
  return idx.map((i, k) => {
    const a = (FAN.angles[i]! * Math.PI) / 180;
    const r = FAN.rises[i]!;
    return { size: POP.fanSize, delay: k * FAN.stepMs, dx: Math.round(r * Math.sin(a) * 100) / 100, dy: -Math.round(r * Math.cos(a) * 100) / 100 };
  });
};
/** Reduce Motion: the same lights, standing in a row above the control (no travel). */
export const stillLights = (n: number, halfHeight: number): Light[] => {
  const size = n <= 1 ? POP.size : POP.fanSize;
  const gap = size + 6;
  const count = Math.max(1, Math.min(3, n));
  return Array.from({ length: count }, (_, i) => ({ size, delay: 0, dx: (i - (count - 1) / 2) * gap, dy: -(halfHeight + STILL.above + size / 2) }));
};

// ---------- the pool ----------
/**
 * Six nodes. A new Orb takes a free one; with none free it takes the one born longest ago (`recycled`), so a seventh
 * live Orb replaces the oldest and nothing is ever queued.
 */
export const createPool = (size: number = POOL_SIZE) => {
  const born: Array<number | null> = Array.from({ length: size }, () => null);
  let seq = 0;
  return {
    take(): { index: number; recycled: boolean } {
      let index = born.indexOf(null);
      const recycled = index < 0;
      if (recycled) {
        index = 0;
        for (let i = 1; i < size; i++) if (born[i]! < born[index]!) index = i;
      }
      born[index] = ++seq;
      return { index, recycled };
    },
    free(index: number) {
      born[index] = null;
    },
    live: () => born.filter((b) => b !== null).length,
  };
};

// ---------- what the counter shows while Orbs are in the air ----------
export interface Claim {
  key: string;
  date: string;
  /** The subject it was popped for (one habit, one to-do), so its un-check can take it back. */
  subject: string;
  n: number;
  at: number;
  /** Its Orbs have reached the counter (or it had no flight). */
  landed: boolean;
  /** The store has counted it. */
  confirmed: boolean;
}
/**
 * The pops the store has not caught up with. A tap pops at once; the store follows a frame later for a to-do and most
 * of a second later for a habit; the Orb lands in between or after. The counter shows the store's number plus
 * `offset()`: Orbs that have landed and are not in the store yet count, Orbs the store already has that are still in
 * the air do not. So the numeral changes once, on landing, whichever of the two comes first.
 *
 * `claimed(key, date)` is what a burst of taps has already taken of a day's room.
 */
export const createClaims = () => {
  let list: Claim[] = [];
  const drop = (c: Claim) => {
    list = list.filter((x) => x !== c);
  };
  // a claim is done with once it has both landed and been counted
  const settle = (c: Claim) => {
    if (c.landed && c.confirmed) drop(c);
  };
  return {
    add(key: string, date: string, subject: string, n: number, at: number, landed = false): Claim {
      const c: Claim = { key, date, subject, n, at, landed, confirmed: false };
      list.push(c);
      return c;
    },
    /** Its Orbs reached the counter. */
    land(c: Claim) {
      if (!list.includes(c)) return;
      c.landed = true;
      settle(c);
    },
    /** The store counted `n` Orbs of this kind and day: the oldest claims for it are confirmed. */
    confirm(key: string, date: string, n: number) {
      let left = n;
      for (const c of [...list]) {
        if (left <= 0) break;
        if (c.confirmed || c.key !== key || c.date !== date) continue;
        c.confirmed = true;
        left -= c.n;
        settle(c);
      }
    },
    /** The check was taken back before the store saw it: its claim goes (the newest one for the subject). */
    cancel(subject: string) {
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i]!;
        if (c.subject === subject && !c.confirmed) return drop(c);
      }
    },
    /** Forget claims the store never confirmed. */
    expire(now: number) {
      list = list.filter((c) => c.confirmed || now - c.at < CLAIM_MS);
    },
    claimed: (key: string, date: string) => list.reduce((s, c) => (!c.confirmed && c.key === key && c.date === date ? s + c.n : s), 0),
    /** Added to the store's number for `date`: + landed and not yet counted, - counted and still in the air. */
    offset: (date: string) => list.reduce((s, c) => (c.date !== date ? s : c.landed && !c.confirmed ? s + c.n : !c.landed && c.confirmed ? s - c.n : s), 0),
    size: () => list.length,
    clear() {
      list = [];
    },
  };
};

// ---------- words ----------
const orbs = (n: number) => `${n} ${n === 1 ? 'Orb' : 'Orbs'}`;
/** The status region: "5 Orbs. 12 today." */
export const statusLine = (gained: number, today: number): string => (today > 0 ? `${orbs(gained)}. ${today} today.` : `${orbs(gained)}.`);
/** The counter's name: "Orbs. 12 today. Level 5." */
export const counterLabel = (today: number, level: number): string => `Orbs. ${today > 0 ? `${today} today. ` : ''}Level ${level}.`;
export const FULL_DAY_CHIP = 'Full day +5';
export const FIRST_ORB = { text: 'Your first Orb. You earn one for each thing you finish.', action: 'Not for me' } as const;

const GOAL_WORD: Record<string, string> = { week: 'week', month: 'month', year: 'year' };
/**
 * The toast for what is paid once and arrives by event, or null for what pops at its control (a to-do, a habit, a
 * session, today's goal) and for the full day (its chip). The words and the number, never a pop without a control.
 * `weeks` is the weeks in a row as the count has them now.
 */
export const gainToast = (g: { key: string; n: number }, ctx: { weeks?: number } = {}): string | null => {
  if (g.n <= 0) return null;
  if (g.key === 'back') return `Good to see you. Today counts. ${orbs(g.n)}`;
  if (g.key.startsWith('week:')) {
    const weeks = ctx.weeks ?? 0;
    return weeks >= 2 ? `Week ${weeks} in a row. ${orbs(g.n)}` : `Last week counted. ${orbs(g.n)}`;
  }
  if (g.key.startsWith('goal:')) {
    const level = GOAL_WORD[g.key.split(':')[1] ?? ''];
    if (!level) return null;
    // the multiplier is real: a goal is 3 Orbs times its reach
    const times = g.n / 3;
    return `${orbs(g.n)} · ${level} goal${Number.isInteger(times) && times > 1 ? ` x${times}` : ''}`;
  }
  if (g.key.startsWith('challenge:d:')) return `Today’s challenge, done. ${orbs(g.n)}`;
  if (g.key.startsWith('challenge:w:')) return `This week’s challenge, done. ${orbs(g.n)}`;
  return null;
};
/** Does this gain pop at a control (so it is never a toast)? */
export const popsAtControl = (key: string): boolean => key === 'todo' || key === 'habit' || key === 'goal:day' || key.startsWith('train:');

/** The toast for a keepsake that is not a big moment, or null (big ones open full screen; `first` has its own words). */
export const keepsakeToast = (key: string): string | null => {
  const [what, n] = key.split(':');
  if (what === 'weeks' && Number(n) >= 2) return `${n} weeks in a row. A new keepsake`;
  if (what === 'days' && Number(n) > 0) return `${Number(n).toLocaleString('en-US')} days in all. A new keepsake`;
  if (key === 'full') return 'Your first full day. A new keepsake';
  if (key === 'challenge') return 'Your first challenge. A new keepsake';
  return null;
};

export interface MomentWords {
  /** In the disc: a numeral ("4", "100"), or the check for a goal. */
  disc: string | 'check';
  title: string;
  line: string;
  /** The Orbs it paid, in type: "30 Orbs · month goal x10". */
  paid?: string;
  /** A chapter's facts: "18 days · 9 sessions · 2 goals". */
  facts?: string;
  /** The person's own words: the goal, or a chapter's one line. */
  quote?: string;
  /** What the dialog is called. */
  label: string;
}
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
/**
 * A big moment's words: a week, month or year goal; weeks in a row; days in all; a chapter. `goalText` is the goal's
 * own words where the app still holds them, `chapter` the chapter's number, `fitness` whether training is named.
 */
export const momentWords = (m: Moment, ctx: { goalText?: string; chapter?: number; fitness?: boolean; rule?: string } = {}): MomentWords => {
  const [what, a] = m.key.split(':');
  if (what === 'goal') {
    const level = GOAL_WORD[a ?? ''] ?? 'week';
    const line = level === 'week' ? 'A whole week, done.' : level === 'month' ? 'A month of it, done.' : 'The year’s goal. Done.';
    return { disc: 'check', title: 'Goal done', line, paid: m.n ? (gainToast({ key: m.key, n: m.n }) ?? undefined) : undefined, quote: m.keepsake?.t ?? ctx.goalText, label: 'Goal done' };
  }
  if (what === 'weeks') {
    const n = Number(a) || 0;
    return { disc: String(n), title: `${n} weeks in a row`, line: ctx.rule ?? 'One thing a day, week after week.', label: `${n} weeks in a row` };
  }
  if (what === 'days') {
    const n = Number(a) || 0;
    const s = n.toLocaleString('en-US');
    return { disc: s, title: `${s} days in all`, line: 'Each one had something done in it.', label: `${s} days in all` };
  }
  // a chapter
  const k = m.keepsake;
  const no = ctx.chapter ?? 1;
  const facts = [k?.d ? plural(k.d, 'day', 'days') : null, ctx.fitness !== false && k?.s ? plural(k.s, 'session', 'sessions') : null, k?.g ? plural(k.g, 'goal', 'goals') : null].filter(Boolean).join(' · ');
  return { disc: String(no), title: `Chapter ${no}`, line: 'Four weeks, closed.', facts: facts || undefined, quote: k?.t, label: `Chapter ${no}` };
};

// ---------- when a big moment may open ----------
export interface RestAsk {
  /** Big moments waiting (`pendingMoments().length`): the engine already holds them to two in seven days. */
  pending: number;
  /** One is up already. */
  showing: boolean;
  /** Sheets and menus that are open. */
  overlays: number;
  /** A field has the keyboard. */
  typing: boolean;
  /** A finger is down. */
  touching: boolean;
  /** ms since the last touch, scroll or key. */
  quietMs: number;
  /** Orbs in the air. */
  popping: boolean;
  /** The page is hidden, or the opening is still playing. */
  away: boolean;
  /** Why now: the app was just opened or came back, or the Close card saved. Nothing else opens one. */
  cause: 'open' | 'closed-day' | null;
}
/** A hand at rest: nothing touched for this long. */
export const REST_QUIET_MS = 600;
/**
 * A big moment opens only at rest: after the Close card's save or on the next open, never from a routine tap, never
 * over a sheet or a menu, never while typing, scrolling or touching, never while Orbs are moving.
 */
export const mayShowBig = (a: RestAsk): boolean => a.pending > 0 && !a.showing && a.cause !== null && a.overlays === 0 && !a.typing && !a.touching && !a.popping && !a.away && a.quietMs >= REST_QUIET_MS;
