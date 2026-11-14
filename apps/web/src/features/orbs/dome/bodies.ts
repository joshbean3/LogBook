import { chapterOf, DAY_KEYS, daysBetween, fmt, mondayOf, parseISO, RULES, shiftDays, totalOf, type DayKey, type ISODate, type Rewards } from '@logbook/shared';
import { gemFor, gemName, type Gem } from '../gems';
import { FILL, OCULUS, RADIUS } from './rules';

/**
 * What the oculus holds, worked out from the stored object and today's date, with nothing drawn. Pure: the same store
 * and day give the same Orbs, in the same order, with the same names.
 *
 * A body in the oculus is an award, not a single Orb: a run is one form worth 3. The worth of every body adds up to the
 * total (`totalOf`), always: nothing is lost and nothing is taken out, however far back it goes. What changes with time
 * is how much each one holds:
 *
 *   - this week: one per award (a to-do, a habit, a session, today's goal, a full day, a week that counts);
 *   - earlier weeks: one each;
 *   - past the last four weeks: one per chapter (the engine's own four weeks), for a year;
 *   - older than that: one per year of the store (thirteen chapters).
 *
 * And further whenever they would cover more than `FILL.limit` of the circle's area: fewer chapters are kept apart, then
 * the years become one, then the earlier weeks join them, and at the very last the days of this week before today
 * become one each, then one together. `PLANS` is that order; the first plan that fits is the one used.
 */

export type DomeTier = 'award' | 'day' | 'week' | 'chapter' | 'year';
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
  /** What a tap says: "A habit · Fri, Nov 13", "Week of Nov 9 · 42 Orbs · 6 days". */
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
/** An Orb's drawing: its kind's, with the shift its own id gives it (a few steps, so a pile of forty habits is a few pictures); a fused one also hands on how many days or weeks it holds. */
const gemOf = (key: string, id: string, stars?: number): Gem => gemFor(key, id, stars === undefined ? undefined : { stars: Math.max(0, Math.min(7, stars)) });

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

const radiusOf = (key: string, n: number): number => {
  if (key === 'todo') return RADIUS.todo;
  if (key === 'habit') return RADIUS.habit;
  if (key.startsWith('train:')) return n >= RULES.train.done ? RADIUS.train : RADIUS.trainFloor;
  if (key === 'goal:day') return RADIUS.goalDay;
  if (key === 'full') return RADIUS.full;
  if (key === 'back') return RADIUS.back;
  if (key.startsWith('goal:week:')) return RADIUS.goalWeek;
  if (key.startsWith('goal:month:')) return RADIUS.goalMonth;
  if (key.startsWith('goal:year:')) return RADIUS.goalYear;
  // a week that counts, a challenge, and a key this build does not know: by what it paid, 5 to 20
  return lerp(RADIUS.bonus, ((n - RULES.week.bonus) / (RULES.week.bonus * RULES.week.top - RULES.week.bonus)) ** 2);
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

interface Group {
  from: ISODate;
  to: ISODate;
  total: number;
  /** Days that counted. */
  days: number;
  /** Weeks that hold anything. */
  weeks: number;
}
const add = (g: Group | undefined, w: Group): Group => (g ? { from: g.from < w.from ? g.from : w.from, to: g.to > w.to ? g.to : w.to, total: g.total + w.total, days: g.days + w.days, weeks: g.weeks + w.weeks } : { ...w });

const build = (s: Rewards, today: ISODate, plan: Plan, fitness: boolean): DomeBody[] => {
  const monday = mondayOf(today);
  const zero = mondayOf(s.startedOn);
  const out: DomeBody[] = [];

  // ---------- everything before this week, a week at a time ----------
  const weeks = new Map<ISODate, Group>();
  const into = (d: ISODate, n: number, counted: boolean) => {
    const m = mondayOf(d);
    const w = weeks.get(m) ?? { from: m, to: shiftDays(m, 6), total: 0, days: 0, weeks: 1 };
    w.total += n;
    if (counted) w.days++;
    weeks.set(m, w);
  };
  const dates = Object.keys(s.days).sort();
  for (const d of dates) if (d < monday) into(d, s.days[d]!.n, s.days[d]!.a >= 1);
  const paid = Object.keys(s.once).sort();
  for (const k of paid) if (s.once[k]!.on < monday) into(s.once[k]!.on, s.once[k]!.n, false);

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
  const kept: Array<{ n: number; g: Group }> = [];
  const years = new Map<number, Group>();
  const newestFirst = [...chapterGroups.keys()].sort((x, y) => y - x);
  for (const n of newestFirst) {
    const g = chapterGroups.get(n)!;
    const end = shiftDays(chapterStart.get(n)!, RULES.chapterDays - 1);
    if (kept.length < plan.chapters && end >= yearAgo) kept.push({ n, g });
    else {
      const y = plan.merge ? 0 : Math.floor((n - 1) / FILL.yearChapters);
      years.set(y, add(years.get(y), g));
    }
  }
  for (const y of [...years.keys()].sort((a, b) => a - b)) {
    const g = years.get(y)!;
    const id = plan.merge ? 'y:all' : `y:${y}`;
    out.push({ id, key: 'fused:year', tier: 'year', worth: g.total, r: RADIUS.year, date: g.from, fresh: false, gem: gemOf('fused:year', id, Math.ceil(g.weeks / 8)), caption: `${stretch(g.from, g.to)} · ${orbs(g.total)}` });
  }
  for (const { n, g } of kept.reverse()) {
    const start = chapterStart.get(n)!;
    const id = `c:${start}`;
    // a chapter with all its weeks is the keepsake's own "Chapter 2"; one still being lived says its dates
    const whole = shiftDays(start, RULES.chapterDays) <= monday;
    out.push({ id, key: 'fused:chapter', tier: 'chapter', worth: g.total, r: lerp(RADIUS.chapter, g.total / RADIUS.chapterTop), date: start, fresh: false, gem: gemOf('fused:chapter', id, g.weeks), caption: `${whole ? `Chapter ${num(n)}` : span(g.from, g.to)} · ${orbs(g.total)}` });
  }
  for (const g of alone) {
    const id = `w:${g.from}`;
    out.push({ id, key: 'fused:week', tier: 'week', worth: g.total, r: lerp(RADIUS.week, g.total / RADIUS.weekTop), date: g.from, fresh: false, gem: gemOf('fused:week', id, g.days), caption: `Week of ${fmt.md.format(parseISO(g.from))} · ${orbs(g.total)}${g.days ? ` · ${num(g.days)} ${g.days === 1 ? 'day' : 'days'}` : ''}` });
  }

  // ---------- this week ----------
  const award = (id: string, key: string, n: number, date: ISODate) => out.push({ id, key, tier: 'award', worth: n, r: radiusOf(key, n), date, fresh: date === today, gem: gemOf(key, id), caption: `${nameOf(key, date, today, fitness)} · ${when(date, today)}` });
  const fusedDay = (id: string, n: number, date: ISODate, counted: number, words: string) => out.push({ id, key: 'fused:week', tier: 'day', worth: n, r: lerp([RADIUS.goalDay, RADIUS.goalWeek], n / RULES.dailyCeiling), date, fresh: date === today, gem: gemOf('fused:week', id, counted), caption: `${words} · ${orbs(n)}` });
  const each: Partial<Record<DayKey, number>> = { todo: RULES.todo.each, habit: RULES.habit.each };
  let soFar = 0;
  let soFarDays = 0;
  let soFarFrom: ISODate | null = null;
  const thisWeek = [...new Set([...dates.filter((d) => d >= monday), ...paid.filter((k) => s.once[k]!.on >= monday).map((k) => s.once[k]!.on)])].sort();
  for (const d of thisWeek) {
    const rec = s.days[d];
    if (rec && rec.n > 0) {
      const fuse = d < today ? plan.days : 'each';
      if (fuse === 'week') {
        soFar += rec.n;
        soFarFrom ??= d;
        if (rec.a >= 1) soFarDays++;
      } else if (fuse === 'day') fusedDay(`D:${d}`, rec.n, d, rec.a >= 1 ? 1 : 0, day(d));
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
        if (left > 0) fusedDay(`r:${d}`, left, d, 0, d === today ? 'Today' : day(d));
      }
    }
    for (const k of paid) if (s.once[k]!.on === d && s.once[k]!.n > 0) award(`o:${k}`, k, s.once[k]!.n, d);
  }
  if (soFar > 0 && soFarFrom) {
    // before this week's own awards, after everything older: where it would lie in the pile
    const at = out.findIndex((b) => b.tier === 'award' || b.tier === 'day');
    const id = 'D:week';
    const body: DomeBody = { id, key: 'fused:week', tier: 'day', worth: soFar, r: lerp(RADIUS.week, soFar / RADIUS.weekTop), date: soFarFrom, fresh: false, gem: gemOf('fused:week', id, soFarDays), caption: `This week before today · ${orbs(soFar)}` };
    out.splice(at < 0 ? out.length : at, 0, body);
  }
  return out;
};

/** The bodies under one plan (by its place in `PLANS`), whether or not it fits: for the tests, which try them all. */
export const domeBodiesUnder = (store: Rewards, today: ISODate, plan: number, opts: DomeOpts = {}): DomeBody[] => build(store, today, PLANS[Math.max(0, Math.min(PLANS.length - 1, plan))]!, opts.fitness !== false);

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
  out = [];
  for (const plan of PLANS) {
    out = build(store, today, plan, fitness);
    if (areaOf(out) <= FILL_AREA) break;
  }
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
  /** "128 Orbs. This week: 6 habits, 3 to-dos, 1 run, today’s goal. 11 earlier weeks." */
  summary: string;
  /** The fused ones, newest first, each by its caption. */
  items: string[];
}
/** What the oculus shows, in words: the total, this week's awards counted by kind, and how much of the past there is. */
export const domeSaid = (store: Rewards, today: ISODate, opts: DomeOpts = {}): DomeSaid => {
  const fitness = opts.fitness !== false;
  const bodies = domeBodies(store, today, opts);
  const awards = bodies.filter((b) => b.tier === 'award');
  const parts: string[] = [];
  let other = 0;
  const seen = new Set<DomeBody>();
  for (const [match, one, many] of COUNTED) {
    const hits = awards.filter((b) => match(b.key) && (fitness || !b.key.startsWith('train:')));
    for (const b of hits) seen.add(b);
    if (!hits.length) continue;
    if (one === 'day’s goal' && hits.length === 1 && hits[0]!.date === today) parts.push('today’s goal');
    else parts.push(`${num(hits.length)} ${hits.length === 1 ? one : many}`);
  }
  for (const b of awards) if (!seen.has(b)) other++;
  if (other) parts.push(`${num(other)} more`);
  const days = bodies.filter((b) => b.tier === 'day').length;
  if (days) parts.push(`${num(days)} earlier ${days === 1 ? 'day' : 'days'} as one Orb each`);
  const count = (tier: DomeTier, one: string, many: string): string | null => {
    const n = bodies.filter((b) => b.tier === tier).length;
    return n ? `${num(n)} ${n === 1 ? one : many}` : null;
  };
  const past = [count('week', 'earlier week', 'earlier weeks'), count('chapter', 'chapter', 'chapters'), count('year', 'longer stretch', 'longer stretches')].filter((x): x is string => !!x);
  const summary = [`${orbs(totalOf(store))}.`, parts.length ? `This week: ${list(parts)}.` : null, past.length ? `${list(past)}.` : null].filter(Boolean).join(' ');
  const items = bodies
    .filter((b) => b.tier !== 'award')
    .map((b) => b.caption)
    .reverse();
  return { summary: summary.replace(/^(.)/, (c) => c.toUpperCase()), items };
};
