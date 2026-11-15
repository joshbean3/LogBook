import { chapterOf, DAY_KEYS, daysBetween, fmt, mondayOf, parseISO, RULES, shiftDays, totalOf, type DayKey, type ISODate, type Rewards } from '@logbook/shared';
import { gemFor, gemName, rungName, rungOf, RUNGS, type Gem } from '../gems';
import { FILL, OCULUS, RADIUS } from './rules';

/**
 * What the oculus holds, worked out from the stored object and today's date, with nothing drawn. Pure: the same store
 * and day give the same Orbs, in the same order, with the same names.
 *
 * A body in the oculus is an award, not a single Orb: a run is one Orb worth 3. Its rung (how rare what earned it is)
 * decides its picture and its size; its worth comes from the rules. The worth of every body adds up to the total
 * (`totalOf`), always: nothing is lost and nothing is taken out, however far back it goes. What changes with time is
 * how much each one holds:
 *
 *   - this week: one per award (a to-do, a habit, a session, today's goal, a full day, a week that counts);
 *   - earlier weeks: one each;
 *   - past the last four weeks: one per chapter (the engine's own four weeks), for a year;
 *   - older than that: one per year of the store (thirteen chapters).
 *
 * A fused Orb is a Sky Orb, larger, and a Dawn Orb when the week it holds counted (or most of a chapter's or a year's
 * weeks did). **A Sunrise or a Sun Orb (a month goal, a year goal) never fuses**: it stays in the window as itself,
 * whatever week it came from, and its worth is then not in its week's fused total.
 *
 * And further whenever they would cover more than `FILL.limit` of the circle's area: fewer chapters are kept apart, then
 * the years become one, then the earlier weeks join them, and at the very last the days of this week before today
 * become one each, then one together. `PLANS` is that order; the first plan that fits is the one used. The kept Orbs
 * have the room this week and one Orb for all the past leave them (never more than `FILL.kept` of what the window may
 * hold, never less than `FILL.keptLeast`): past it they are drawn smaller, together, never fused; and only when their
 * smallest size is still too much do the oldest month goals join their stretch (`keptOf`).
 */

/** `kept`: a Sunrise or a Sun Orb from before this week, which never fuses. */
export type DomeTier = 'award' | 'kept' | 'day' | 'week' | 'chapter' | 'year';
export interface DomeBody {
  /** The same for the same award on every pass, so a body keeps its place when the store changes. */
  id: string;
  /** What its Orb is drawn from: a day's kind, a once-key, or `fused:week`, `fused:chapter`, `fused:year`. */
  key: string;
  tier: DomeTier;
  /** Its Orbs. The worth of every body adds up to the total. */
  worth: number;
  /** Its radius, in oculus units. */
  r: number;
  /** The day it belongs to; a fused one's first day. */
  date: ISODate;
  /** It was earned today: it drops in when the page opens. */
  fresh: boolean;
  gem: Gem;
  /** What a tap says, always with the rung: "A habit · Sky · Fri, Nov 13", "A month goal · Sunrise · November", "Week of Nov 9 · Dawn · 42 Orbs · 6 days". */
  caption: string;
}
export interface DomeOpts {
  /** Is Fitness on (default yes)? Off: nothing names training. */
  fitness?: boolean;
}

/** "1,000": a number as the page prints it. */
const num = (n: number): string => n.toLocaleString('en-US');
const orbs = (n: number): string => `${num(n)} ${n === 1 ? 'Orb' : 'Orbs'}`;
const lerp = (range: readonly [number, number], t: number): number => Math.round(range[0] + (range[1] - range[0]) * Math.sqrt(Math.max(0, Math.min(1, t))));
/** An Orb's drawing: its rung's. A fused one is a Sky Orb, and a Dawn Orb when what it holds counted. */
const gemOf = (key: string, id: string, counted?: boolean): Gem => gemFor(key, id, counted === undefined ? undefined : { counted });
/** The rung a fused Orb is drawn at, in words, as its caption says it: "Sky", or "Dawn" when what it holds counted. */
const fusedRung = (counted: boolean): string => rungName(gemOf('fused:week', '', counted).rung);
/** Does this key earn a Sunrise or a Sun Orb: one that never fuses? */
export const isKept = (key: string): boolean => rungOf(key) >= 4;

/** The circle's area, in square units, and what the Orbs may cover of it. */
export const OCULUS_AREA = Math.PI * (OCULUS.d / 2) ** 2;
export const FILL_AREA = FILL.limit * OCULUS_AREA;
/** What these bodies cover, in square units. */
export const areaOf = (bodies: readonly Pick<DomeBody, 'r'>[]): number => bodies.reduce((t, b) => t + Math.PI * b.r * b.r, 0);

// ---------- names ----------
const day = (d: ISODate): string => fmt.short.format(parseISO(d));
const when = (d: ISODate, today: ISODate): string => (d === today ? 'today' : day(d));
const monthYear = (d: ISODate): string => `${fmt.monthShort.format(parseISO(d))} ${d.slice(0, 4)}`;
/** "Nov 2026 to Nov 2027"; one month when it began and ended in the same one. */
const stretch = (from: ISODate, to: ISODate): string => (monthYear(from) === monthYear(to) ? monthYear(from) : `${monthYear(from)} to ${monthYear(to)}`);
const span = (from: ISODate, to: ISODate): string => `${fmt.md.format(parseISO(from))} to ${fmt.md.format(parseISO(to))}`;
/** The first words of an award's caption. With Fitness off a session is never named. */
const nameOf = (key: string, date: ISODate, today: ISODate, fitness: boolean): string => {
  if (key.startsWith('train:') && !fitness) return 'Earned earlier';
  if (key === 'goal:day' && date !== today) return 'A day’s goal';
  return gemName(key);
};

/** An award's size is its rung's: how rare it is, never what it paid. */
const radiusOf = (key: string): number => RADIUS.rung[rungOf(key) - 1]!;
/** "November", and "November 2025" for a month of another year; "2026" for a year. */
const periodOf = (key: string, today: ISODate): string | null => {
  const p = key.slice(key.lastIndexOf(':') + 1);
  if (/^\d{4}$/.test(p)) return p;
  if (!/^\d{4}-\d{2}$/.test(p)) return null;
  const words = fmt.month.format(parseISO(`${p}-01` as ISODate));
  return p.slice(0, 4) === today.slice(0, 4) ? words.replace(/\s*\d{4}$/, '') : words;
};

// ---------- the plans: how far the past is fused, most detail first ----------
interface Plan {
  /** Chapters kept as one body each (the newest ones, and never one older than a year). */
  chapters: number;
  /** Every stretch older than the kept chapters becomes one body, not one a year. */
  merge: boolean;
  /** Earlier weeks kept as one body each. */
  weeks: number;
  /** This week's days before today: each award, one body a day, or one together. */
  days: 'each' | 'day' | 'week';
}
const tight = { chapters: 0, merge: true, weeks: 0 } as const;
export const PLANS: readonly Plan[] = [
  ...[FILL.yearChapters, 9, 6, 4, 2, 1, 0].map((chapters): Plan => ({ chapters, merge: false, weeks: FILL.weeks, days: 'each' })),
  { chapters: 0, merge: true, weeks: FILL.weeks, days: 'each' },
  { chapters: 0, merge: true, weeks: 2, days: 'each' },
  { ...tight, days: 'each' },
  { ...tight, days: 'day' },
  { ...tight, days: 'week' },
];
/** All the past as one Orb, this week one body per award: what the kept Orbs' room is measured against. */
const LEAN: Plan = { ...tight, days: 'each' };

interface Group {
  from: ISODate;
  to: ISODate;
  total: number;
  /** Days that counted. */
  days: number;
  /** Weeks that hold anything. */
  weeks: number;
  /** Of those, the weeks that counted. */
  counted: number;
}
const add = (g: Group | undefined, w: Group): Group => (g ? { from: g.from < w.from ? g.from : w.from, to: g.to > w.to ? g.to : w.to, total: g.total + w.total, days: g.days + w.days, weeks: g.weeks + w.weeks, counted: g.counted + w.counted } : { ...w });
/** Most of what it holds counted: a week that did, or more than half of a longer stretch's weeks. */
const mostly = (g: Group): boolean => g.counted * 2 > g.weeks;

/**
 * The Sunrise and Sun Orbs from before this week, oldest first, and how large they are drawn, given the `room` they
 * have (square units). At their own size while they fit; past that they shrink together, to `FILL.keptScale` of their
 * size at the least; and when even that is too much, the oldest month goals are not kept apart: they go to their
 * stretch's fused Orb, a year goal last of all.
 */
const keptOf = (s: Rewards, monday: ISODate, room: number): { keys: string[]; scale: number } => {
  let keys = Object.keys(s.once)
    .filter((k) => isKept(k) && s.once[k]!.n > 0 && s.once[k]!.on < monday)
    .sort((a, b) => (s.once[a]!.on < s.once[b]!.on ? -1 : s.once[a]!.on > s.once[b]!.on ? 1 : a < b ? -1 : 1));
  const area = (list: readonly string[]) => list.reduce((t, k) => t + Math.PI * radiusOf(k) ** 2, 0);
  // the oldest give way first, a month goal before any year goal
  for (const k of [...keys.filter((x) => rungOf(x) === 4), ...keys.filter((x) => rungOf(x) !== 4)]) {
    if (area(keys) * FILL.keptScale ** 2 <= room) break;
    keys = keys.filter((x) => x !== k);
  }
  return { keys, scale: Math.max(FILL.keptScale, Math.min(1, Math.sqrt(room / Math.max(1, area(keys))))) };
};

const build = (s: Rewards, today: ISODate, plan: Plan, fitness: boolean, room: number): DomeBody[] => {
  const monday = mondayOf(today);
  const zero = mondayOf(s.startedOn);
  const out: DomeBody[] = [];

  // ---------- everything before this week, a week at a time ----------
  const weeks = new Map<ISODate, Group>();
  const into = (d: ISODate, n: number, counted: boolean) => {
    const m = mondayOf(d);
    const w = weeks.get(m) ?? { from: m, to: shiftDays(m, 6), total: 0, days: 0, weeks: 1, counted: 0 };
    w.total += n;
    if (counted) w.days++;
    weeks.set(m, w);
  };
  const dates = Object.keys(s.days).sort();
  for (const d of dates) if (d < monday) into(d, s.days[d]!.n, s.days[d]!.a >= 1);
  const paid = Object.keys(s.once).sort();
  // a Sunrise or a Sun Orb is not in its week's total: it stays in the window as itself
  const kept = keptOf(s, monday, room);
  const apart = new Set(kept.keys);
  for (const k of paid) if (s.once[k]!.on < monday && !apart.has(k)) into(s.once[k]!.on, s.once[k]!.n, false);
  // a week counted when its bonus was paid, or (before it is, on the Monday after) when its days reach the target it was lived under
  for (const [m, w] of weeks) if (s.once[`week:${m}`] || w.days >= (s.wt[m] ?? s.set.weekTarget)) w.counted = 1;

  // each week is a body of its own, or goes to its chapter; each chapter is one, or goes to its year
  const chapterGroups = new Map<number, Group>();
  const chapterStart = new Map<number, ISODate>();
  const alone: Group[] = [];
  for (const m of [...weeks.keys()].sort()) {
    const w = weeks.get(m)!;
    if (w.total <= 0) continue;
    const ch = chapterOf(s, m < zero ? zero : m);
    // a chapter stays as weeks while its last week is among the last few
    const open = plan.weeks > 0 && daysBetween(shiftDays(ch.start, RULES.chapterDays - 7), monday) <= plan.weeks * 7;
    if (open) alone.push(w);
    else {
      chapterGroups.set(ch.n, add(chapterGroups.get(ch.n), w));
      chapterStart.set(ch.n, ch.start);
    }
  }
  const yearAgo = shiftDays(monday, -FILL.yearChapters * RULES.chapterDays);
  const open: Array<{ n: number; g: Group }> = [];
  const years = new Map<number, Group>();
  const newestFirst = [...chapterGroups.keys()].sort((x, y) => y - x);
  for (const n of newestFirst) {
    const g = chapterGroups.get(n)!;
    const end = shiftDays(chapterStart.get(n)!, RULES.chapterDays - 1);
    if (open.length < plan.chapters && end >= yearAgo) open.push({ n, g });
    else {
      const y = plan.merge ? 0 : Math.floor((n - 1) / FILL.yearChapters);
      years.set(y, add(years.get(y), g));
    }
  }
  for (const y of [...years.keys()].sort((a, b) => a - b)) {
    const g = years.get(y)!;
    const id = plan.merge ? 'y:all' : `y:${y}`;
    out.push({ id, key: 'fused:year', tier: 'year', worth: g.total, r: RADIUS.year, date: g.from, fresh: false, gem: gemOf('fused:year', id, mostly(g)), caption: `${stretch(g.from, g.to)} · ${fusedRung(mostly(g))} · ${orbs(g.total)}` });
  }
  for (const { n, g } of open.reverse()) {
    const start = chapterStart.get(n)!;
    const id = `c:${start}`;
    // a chapter with all its weeks is the keepsake's own "Chapter 2"; one still being lived says its dates
    const whole = shiftDays(start, RULES.chapterDays) <= monday;
    out.push({ id, key: 'fused:chapter', tier: 'chapter', worth: g.total, r: lerp(RADIUS.chapter, g.total / RADIUS.chapterTop), date: start, fresh: false, gem: gemOf('fused:chapter', id, mostly(g)), caption: `${whole ? `Chapter ${num(n)}` : span(g.from, g.to)} · ${fusedRung(mostly(g))} · ${orbs(g.total)}` });
  }
  for (const g of alone) {
    const id = `w:${g.from}`;
    out.push({ id, key: 'fused:week', tier: 'week', worth: g.total, r: lerp(RADIUS.week, g.total / RADIUS.weekTop), date: g.from, fresh: false, gem: gemOf('fused:week', id, mostly(g)), caption: `Week of ${fmt.md.format(parseISO(g.from))} · ${fusedRung(mostly(g))} · ${orbs(g.total)}${g.days ? ` · ${num(g.days)} ${g.days === 1 ? 'day' : 'days'}` : ''}` });
  }

  // ---------- the Sunrise and Sun Orbs of earlier weeks: themselves, for good ----------
  const said = (key: string, date: ISODate) => `${nameOf(key, date, today, fitness)} · ${rungName(rungOf(key))} · ${(isKept(key) && periodOf(key, today)) || when(date, today)}`;
  for (const k of kept.keys) out.push({ id: `o:${k}`, key: k, tier: 'kept', worth: s.once[k]!.n, r: Math.floor(radiusOf(k) * kept.scale * 10) / 10, date: s.once[k]!.on, fresh: false, gem: gemOf(k, `o:${k}`), caption: said(k, s.once[k]!.on) });

  // ---------- this week ----------
  const award = (id: string, key: string, n: number, date: ISODate) => out.push({ id, key, tier: 'award', worth: n, r: radiusOf(key), date, fresh: date === today, gem: gemOf(key, id), caption: said(key, date) });
  const fusedDay = (id: string, n: number, date: ISODate, words: string) => out.push({ id, key: 'fused:week', tier: 'day', worth: n, r: lerp(RADIUS.day, n / RULES.dailyCeiling), date, fresh: date === today, gem: gemOf('fused:week', id, false), caption: `${words} · ${fusedRung(false)} · ${orbs(n)}` });
  const each: Partial<Record<DayKey, number>> = { todo: RULES.todo.each, habit: RULES.habit.each };
  let soFar = 0;
  let soFarFrom: ISODate | null = null;
  const thisWeek = [...new Set([...dates.filter((d) => d >= monday), ...paid.filter((k) => s.once[k]!.on >= monday).map((k) => s.once[k]!.on)])].sort();
  for (const d of thisWeek) {
    const rec = s.days[d];
    if (rec && rec.n > 0) {
      const fuse = d < today ? plan.days : 'each';
      if (fuse === 'week') {
        soFar += rec.n;
        soFarFrom ??= d;
      } else if (fuse === 'day') fusedDay(`D:${d}`, rec.n, d, day(d));
      else {
        let left = rec.n;
        for (const key of DAY_KEYS) {
          const have = Math.min(rec.k?.[key] ?? 0, left);
          if (have <= 0) continue;
          const unit = each[key] ?? have;
          const count = Math.floor(have / unit);
          for (let i = 0; i < count; i++) award(`d:${d}:${key}:${i}`, key, unit, d);
          left -= count * unit;
        }
        // Orbs the day holds that its kinds do not account for (a record whose detail was lost): one body, so the sum stands
        if (left > 0) fusedDay(`r:${d}`, left, d, d === today ? 'Today' : day(d));
      }
    }
    for (const k of paid) if (s.once[k]!.on === d && s.once[k]!.n > 0) award(`o:${k}`, k, s.once[k]!.n, d);
  }
  if (soFar > 0 && soFarFrom) {
    // before this week's own awards, after everything older: where it would lie in the pile
    const at = out.findIndex((b) => b.tier === 'award' || b.tier === 'day');
    const id = 'D:week';
    const body: DomeBody = { id, key: 'fused:week', tier: 'day', worth: soFar, r: lerp(RADIUS.week, soFar / RADIUS.weekTop), date: soFarFrom, fresh: false, gem: gemOf('fused:week', id, false), caption: `This week before today · ${fusedRung(false)} · ${orbs(soFar)}` };
    out.splice(at < 0 ? out.length : at, 0, body);
  }
  return out;
};

/**
 * The room the kept Orbs have: what this week's awards and one Orb for all the past leave of the window's fill, never
 * more than `FILL.kept` of it and never less than `FILL.keptLeast`. So an old month goal gives way before this week is
 * lumped together, and a week of everything does not put every one of them away.
 */
const keptRoom = (store: Rewards, today: ISODate, fitness: boolean): number => {
  const lean = build(store, today, LEAN, fitness, 0);
  return Math.max(FILL.keptLeast * FILL_AREA, Math.min(FILL.kept * FILL_AREA, FILL_AREA - areaOf(lean)));
};

/** The bodies under one plan (by its place in `PLANS`), whether or not it fits: for the tests, which try them all. */
export const domeBodiesUnder = (store: Rewards, today: ISODate, plan: number, opts: DomeOpts = {}): DomeBody[] => build(store, today, PLANS[Math.max(0, Math.min(PLANS.length - 1, plan))]!, opts.fitness !== false, keptRoom(store, today, opts.fitness !== false));

/** The first plan that fits; the last one when none does (it is today, what was paid once this week, and three bodies). */
const pick = (store: Rewards, today: ISODate, fitness: boolean): DomeBody[] => {
  const room = keptRoom(store, today, fitness);
  let out: DomeBody[] = [];
  for (const plan of PLANS) {
    out = build(store, today, plan, fitness, room);
    if (areaOf(out) <= FILL_AREA) break;
  }
  return out;
};

const memo = new WeakMap<Rewards, Map<string, DomeBody[]>>();
/**
 * The bodies in the oculus, oldest first (the order they are poured in, so the oldest lie lowest): the years, the
 * chapters, the earlier weeks, then this week's awards day by day, today's last. The first plan whose bodies cover no
 * more than `FILL.limit` of the circle is used; the last one always is (it is today and three bodies).
 */
export const domeBodies = (store: Rewards, today: ISODate, opts: DomeOpts = {}): DomeBody[] => {
  const fitness = opts.fitness !== false;
  const hit = memo.get(store) ?? new Map<string, DomeBody[]>();
  memo.set(store, hit);
  const at = `${today}|${fitness ? 1 : 0}`;
  let out = hit.get(at);
  if (out) return out;
  out = pick(store, today, fitness);
  hit.set(at, out);
  return out;
};

// ---------- the same in words, for VoiceOver ----------
const COUNTED: Array<[match: (key: string) => boolean, one: string, many: string]> = [
  [(k) => k === 'habit', 'habit', 'habits'],
  [(k) => k === 'todo', 'to-do', 'to-dos'],
  [(k) => k === 'train:run', 'run', 'runs'],
  [(k) => k === 'train:lift', 'lift', 'lifts'],
  [(k) => k === 'train:cross', 'cross-training', 'cross-training'],
  [(k) => k === 'goal:day', 'day’s goal', 'days’ goals'],
  [(k) => k === 'full', 'full day', 'full days'],
  [(k) => k === 'back', 'return', 'returns'],
  [(k) => k.startsWith('week:'), 'week that counts', 'weeks that count'],
  [(k) => k.startsWith('challenge:'), 'challenge', 'challenges'],
  [(k) => k.startsWith('goal:week:'), 'week goal', 'week goals'],
  [(k) => k.startsWith('goal:month:'), 'month goal', 'month goals'],
  [(k) => k.startsWith('goal:year:'), 'year goal', 'year goals'],
];
const list = (words: readonly string[]): string => words.join(', ');
export interface DomeSaid {
  /** "128 Orbs. This week, Sky: 6 habits, 3 to-dos. Dawn: 1 run, today’s goal. From earlier weeks, Sunrise: 2 month goals. 11 earlier weeks." */
  summary: string;
  /** The fused ones, newest first, each by its caption (which names its rung). */
  items: string[];
}
/** Awards counted by kind under their rung's name, the ladder's order: "Sky: 6 habits, 3 to-dos. Dawn: 1 run, today’s goal." */
const byRung = (awards: readonly DomeBody[], today: ISODate, fitness: boolean): string[] => {
  const out: string[] = [];
  for (const rung of RUNGS) {
    const mine = awards.filter((b) => b.gem.rung === rung);
    if (!mine.length) continue;
    const parts: string[] = [];
    const seen = new Set<DomeBody>();
    for (const [match, one, many] of COUNTED) {
      const hits = mine.filter((b) => match(b.key) && (fitness || !b.key.startsWith('train:')));
      for (const b of hits) seen.add(b);
      if (!hits.length) continue;
      if (one === 'day’s goal' && hits.length === 1 && hits[0]!.date === today) parts.push('today’s goal');
      else parts.push(`${num(hits.length)} ${hits.length === 1 ? one : many}`);
    }
    // what this build cannot name, and a session with Fitness off, are still said: by their rung and how many
    const other = mine.filter((b) => !seen.has(b)).length;
    if (other) parts.push(parts.length ? `${num(other)} more` : `${num(other)} ${other === 1 ? 'Orb' : 'Orbs'}`);
    out.push(`${rungName(rung)}: ${list(parts)}.`);
  }
  return out;
};
/**
 * What the oculus shows, in words: the total, this week's awards by rung and by kind, the Sunrise and Sun Orbs that
 * stay from earlier weeks, and how much of the past there is. Every Orb is said with its rung (guide 3.3, 11).
 */
export const domeSaid = (store: Rewards, today: ISODate, opts: DomeOpts = {}): DomeSaid => {
  const fitness = opts.fitness !== false;
  const bodies = domeBodies(store, today, opts);
  const week = byRung(bodies.filter((b) => b.tier === 'award'), today, fitness);
  const days = bodies.filter((b) => b.tier === 'day').length;
  if (days) week.push(`${num(days)} earlier ${days === 1 ? 'day' : 'days'} as one ${fusedRung(false)} Orb each.`);
  const kept = byRung(bodies.filter((b) => b.tier === 'kept'), today, fitness);
  const count = (tier: DomeTier, one: string, many: string): string | null => {
    const n = bodies.filter((b) => b.tier === tier).length;
    return n ? `${num(n)} ${n === 1 ? one : many}` : null;
  };
  const past = [count('week', 'earlier week', 'earlier weeks'), count('chapter', 'chapter', 'chapters'), count('year', 'longer stretch', 'longer stretches')].filter((x): x is string => !!x);
  const summary = [`${orbs(totalOf(store))}.`, week.length ? `This week, ${week.join(' ')}` : null, kept.length ? `From earlier weeks, ${kept.join(' ')}` : null, past.length ? `${list(past)}.` : null].filter(Boolean).join(' ');
  const items = bodies
    .filter((b) => b.tier !== 'award' && b.tier !== 'kept')
    .map((b) => b.caption)
    .reverse();
  return { summary: summary.replace(/^(.)/, (c) => c.toUpperCase()), items };
};
