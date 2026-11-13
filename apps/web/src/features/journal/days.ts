import { addMonths, fmtDate, LEARNING_MAX, shiftDays, type JournalEntry, type Learning, type LearningMonth } from '@logbook/shared';
import { lastSeven, letterOf, linesKept, ordinal } from '../learned/week';

/**
 * One Journal: the rules that lay lines (`learnings`) and entries (`journal`) out by day. A day has one line (its
 * headline; a second is allowed) and may have entries under it. Everything here is pure: the screens gather the two
 * lists and ask these what to draw.
 */

/** The longest entry the server takes (zJournalInput). */
export const ENTRY_MAX = 5000;

// ---------- the week's lights ----------

export interface WrittenWeek {
  /** The six days before tonight, oldest first, for `WeekLights`. */
  days: Array<{ date: string; letter: string; lit: boolean }>;
  /** How many of those six are lit. */
  before: number;
  /** Tonight is lit: today has a line or an entry. */
  tonight: boolean;
  /** Today has its line. */
  line: boolean;
  /** Days written in the seven, tonight included: the band's count. */
  written: number;
  /** Lines kept in the seven days. A day with two lines counts two. */
  kept: number;
}

/**
 * The week as the lights draw it. A day is lit when it holds a line or an entry (today both count); a missed day is an
 * unlit light and changes nothing else: there is no run of days to break.
 */
export const writtenWeek = (today: string, lines: ReadonlyMap<string, number>, entryDays: ReadonlySet<string>): WrittenWeek => {
  const seven = lastSeven(today);
  // a count that is not a whole number of lines (nothing, a negative, not a number) is no lines
  const kept = (d: string) => {
    const n = lines.get(d);
    return typeof n === 'number' && n >= 1 ? Math.floor(n) : 0;
  };
  const lit = (d: string) => kept(d) > 0 || entryDays.has(d);
  const days = seven.slice(0, 6).map((date) => ({ date, letter: letterOf(date), lit: lit(date) }));
  const before = days.filter((d) => d.lit).length;
  const tonight = lit(today);
  return { days, before, tonight, line: kept(today) > 0, written: before + (tonight ? 1 : 0), kept: seven.reduce((n, d) => n + kept(d), 0) };
};

export const daysWritten = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'} written`;

/**
 * The band's words, gain-framed. Before anything is written today: the count so far and which light tonight's line would
 * be; with nothing this week, an invitation. Once tonight is lit: the count of days, and the lines kept after it. Days
 * written, never days in a row. `ever`: something was written before this week (so "first" means this week's first).
 */
export const weekBand = (week: WrittenWeek, ever: boolean): { label: string; words: string; second?: string } => {
  if (week.tonight) return { label: 'This week', words: daysWritten(week.written), ...(week.kept ? { second: linesKept(week.kept) } : {}) };
  if (week.written === 0) return { label: 'This week', words: ever ? 'Tonight’s line lights the first' : 'Your first line lights tonight' };
  return { label: `This week · ${daysWritten(week.written)}`, words: `Tonight’s line lights the ${ordinal(week.before + 1)}` };
};

const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

/** The lights' one VoiceOver label: "3 days written this week: Monday, Wednesday, and today. Tonight's line is kept." */
export const weekLabel = (week: WrittenWeek): string => {
  const names = [...week.days.filter((d) => d.lit).map((d) => fmtDate('dowLong', d.date)), ...(week.tonight ? ['today'] : [])];
  const head = week.written ? `${daysWritten(week.written)} this week: ${LIST.format(names)}.` : 'Nothing written this week yet.';
  return `${head} ${week.line ? 'Tonight’s line is kept.' : 'Tonight’s line is not written yet.'}`;
};

// ---------- lines and entries, by day ----------

export interface JournalDay {
  date: string;
  /** The day's lines in the order they were written: the first is the headline. */
  lines: Learning[];
  /** The day's entries, newest first. */
  entries: JournalEntry[];
}

const asc = (a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
const desc = (a: { createdAt: string }, b: { createdAt: string }) => -asc(a, b);
const dated = (x: { date?: unknown } | null | undefined): x is { date: string } => typeof x?.date === 'string';

/** Lines and entries as days, newest day first. A day shows once whichever list it came from. */
export const mergeDays = (lines: readonly Learning[], entries: readonly JournalEntry[]): JournalDay[] => {
  const by = new Map<string, JournalDay>();
  const day = (date: string) => {
    let d = by.get(date);
    if (!d) by.set(date, (d = { date, lines: [], entries: [] }));
    return d;
  };
  const seenL = new Set<string>();
  const seenE = new Set<string>();
  for (const l of lines) if (dated(l) && !seenL.has(l.id)) (seenL.add(l.id), day(l.date).lines.push(l));
  for (const e of entries) if (dated(e) && !seenE.has(e.id)) (seenE.add(e.id), day(e.date).entries.push(e));
  const out = [...by.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of out) {
    d.lines.sort(asc);
    d.entries.sort(desc);
  }
  return out;
};

/**
 * A month's page: the days with something written, newest first. Empty days are left out (the calendar above the list is
 * the way to a day with nothing in it). `fillFrom`: the days from there to today stay even when empty, as rows to fill in;
 * null (the default) keeps none. A month still to come has none, and no day after today is ever offered to fill in (a
 * line dated after today, written in another time zone, is still shown).
 */
export const monthPageDays = (month: string, today: string, lines: readonly Learning[], entries: readonly JournalEntry[], fillFrom: string | null = null): JournalDay[] => {
  const first = `${month}-01`;
  const last = shiftDays(addMonths(first, 1), -1);
  const inMonth = (x: { date?: unknown }) => typeof x?.date === 'string' && x.date >= first && x.date <= last;
  const days = mergeDays(lines.filter(inMonth), entries.filter(inMonth));
  if (fillFrom === null) return days;
  const by = new Map(days.map((d) => [d.date, d]));
  const newest = days[0]?.date ?? '';
  const now = last < today ? last : today;
  const end = newest > now ? newest : now;
  const out: JournalDay[] = [];
  for (let d = end; d >= first; d = shiftDays(d, -1)) {
    const has = by.get(d);
    if (has) out.push(has);
    else if (d >= fillFrom && d <= today) out.push({ date: d, lines: [], entries: [] });
  }
  return out;
};

/** What a day's mark on the calendar needs: how much was written, and whether an entry is a favorite. */
export interface DayMark {
  lines: number;
  entries: number;
  fav: boolean;
}
export const dayMarks = (days: readonly JournalDay[]): Map<string, DayMark> => new Map(days.filter((d) => d.lines.length + d.entries.length > 0).map((d) => [d.date, { lines: d.lines.length, entries: d.entries.length, fav: d.entries.some((e) => e.fav) }]));

/** "1 line, 2 entries", "nothing written": a day in words (the calendar cell's label, a month's count). */
export const writtenWords = (lines: number, entries: number): string => {
  const parts = [lines ? `${lines} ${lines === 1 ? 'line' : 'lines'}` : '', entries ? `${entries} ${entries === 1 ? 'entry' : 'entries'}` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : 'nothing written';
};

// ---------- the archive: months ----------

export interface MonthRow {
  /** '2026-11' */
  month: string;
  /** Days with a line or an entry. */
  days: number;
  lines: number;
  entries: number;
  /**
   * False when `days` is only the least it can be (the device could not see both lists for the month and the server
   * gave no count of both): the row then says how many lines and entries, which it does know. Absent: exact.
   */
  exact?: boolean;
}

const isMonth = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const whole = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** The server's months (`GET /journal/months`) as far as they can be trusted; null when the answer is not a list. */
export const monthRowsOf = (v: unknown): MonthRow[] | null => {
  const list = v && typeof v === 'object' ? (v as { months?: unknown }).months : null;
  if (!Array.isArray(list)) return null;
  return list.flatMap((x) => {
    const m = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    if (!isMonth(m.month)) return [];
    const row = { month: m.month, days: whole(m.days), lines: whole(m.lines), entries: whole(m.entries) };
    return row.lines + row.entries > 0 ? [{ ...row, days: Math.max(1, row.days) }] : [];
  });
};

export interface ArchiveFacts {
  /** The months that hold a line, with their counts (`/learnings/months`; a save lands in it at once). */
  lineMonths: readonly LearningMonth[];
  /** Every entry loaded so far. */
  entries: ReadonlyArray<Pick<JournalEntry, 'date'>>;
  /** The oldest day the entries reach: every entry from that day on is loaded. Null with nothing loaded. */
  reach: string | null;
  /** The days that hold a line, for the months whose lines are on the device (this month, a month just opened). */
  lineDays?: ReadonlyMap<string, ReadonlySet<string>>;
  /** The server's own count of both, when it has one (a server from before the merge has none). */
  server?: readonly MonthRow[] | null;
}

/**
 * The archive's months, newest first: every month with a line or an entry, and how many days were written in it. Where
 * both lists are on the device for a month, the count is exact and follows a save at once. Else it is the server's count
 * of both, when there is one; else the larger of the two the device knows (days with a line, days with an entry), which
 * is never more than was written and is marked as not exact. A month with nothing written has no row.
 */
export const archiveMonths = ({ lineMonths, entries, reach, lineDays, server }: ArchiveFacts): MonthRow[] => {
  const months = new Map<string, { L: number; Ld: number; E: number; Ed: Set<string> }>();
  const at = (m: string) => {
    let x = months.get(m);
    if (!x) months.set(m, (x = { L: 0, Ld: 0, E: 0, Ed: new Set() }));
    return x;
  };
  for (const l of lineMonths) {
    if (!isMonth(l?.month) || whole(l.count) < 1) continue;
    const x = at(l.month);
    x.L = whole(l.count);
    x.Ld = Math.max(1, whole(l.days));
  }
  for (const e of entries) {
    if (typeof e?.date !== 'string' || !isMonth(e.date.slice(0, 7))) continue;
    const x = at(e.date.slice(0, 7));
    x.E += 1;
    x.Ed.add(e.date);
  }
  const srv = new Map((server ?? []).map((s) => [s.month, s]));
  for (const s of srv.values()) at(s.month);
  const out: MonthRow[] = [];
  for (const [month, x] of months) {
    const s = srv.get(month);
    // every entry of this month is on the device
    const reached = reach !== null && `${month}-01` >= reach;
    const lines = x.L;
    const entryCount = reached ? x.E : Math.max(x.E, s?.entries ?? 0);
    if (lines + entryCount < 1) continue;
    const known = lineDays?.get(month);
    const floor = Math.max(x.Ld, x.Ed.size);
    // both lists on the device: the days themselves; else the server's count, never under what the device can see
    const both = !!known && reached;
    const days = both ? new Set([...known!, ...x.Ed]).size : Math.max(floor, s?.days ?? 0);
    // one list alone names every day it has: a month the entries reach, with no line in it or no entry, needs no union
    const exact = both || !!s || (reached && (lines === 0 || x.E === 0));
    out.push({ month, days: Math.max(1, days), lines, entries: entryCount, ...(exact ? {} : { exact: false }) });
  }
  return out.sort((a, b) => (a.month < b.month ? 1 : -1));
};

// ---------- search ----------

export interface FoundMonth {
  month: string;
  days: JournalDay[];
}
/** What a search found in both lists, as months of days, newest first. */
export const mergeFound = (lines: readonly Learning[], entries: readonly JournalEntry[]): FoundMonth[] => {
  const out: FoundMonth[] = [];
  for (const d of mergeDays(lines, entries)) {
    const m = d.date.slice(0, 7);
    let cur = out[out.length - 1];
    if (!cur || cur.month !== m) out.push((cur = { month: m, days: [] }));
    cur.days.push(d);
  }
  return out;
};

export interface MarkPart {
  text: string;
  hit: boolean;
}
/** `text` cut where it holds `q` (any case), so the match can be marked. No match, or nothing searched: one part. */
export const markParts = (text: string, q: string): MarkPart[] => {
  const needle = q.trim().toLowerCase();
  if (!needle || !text) return [{ text, hit: false }];
  const hay = text.toLowerCase();
  // a letter whose lowercase is longer (rare) would shift every index after it: mark nothing rather than the wrong words
  if (hay.length !== text.length) return [{ text, hit: false }];
  const out: MarkPart[] = [];
  let from = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, from)) {
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + needle.length), hit: true });
    from = i + needle.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out.length ? out : [{ text, hit: false }];
};

/**
 * The part of a long entry that holds the match: from a few words before it, so the marked words are inside the row's
 * three lines. An entry that matches near its start, or not at all, is shown from its start.
 */
export const snippet = (text: string, q: string, lead = 48): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const needle = q.trim().toLowerCase();
  const at = needle ? flat.toLowerCase().indexOf(needle) : -1;
  if (at <= lead) return flat;
  const cut = flat.slice(at - lead);
  const sp = cut.indexOf(' ');
  return `…${sp >= 0 && sp < lead / 2 ? cut.slice(sp + 1) : cut}`;
};

// ---------- the line field: a paste too long for a line ----------

/**
 * A paste into the line field. Null when the field's words with the paste still fit a line. Else the whole words, to be
 * offered as an entry instead of being cut: what was in the field (not a starter nobody changed) with the paste in the
 * selection's place.
 */
export const longPaste = ({ value, start, end, pasted, own }: { value: string; start: number; end: number; pasted: string; own: boolean }): string | null => {
  const a = Math.max(0, Math.min(start, end, value.length));
  const b = Math.max(a, Math.min(Math.max(start, end), value.length));
  if (value.length - (b - a) + pasted.length <= LEARNING_MAX) return null;
  const words = own ? `${value.slice(0, a)}${pasted}${value.slice(b)}` : pasted;
  return words.trim() ? words.trim() : null;
};

// ---------- Today's Journal row ----------

export interface TonightRowWords {
  title: string;
  sub: string | null;
  /** The words at the row's end: "Write more" once the line is kept. */
  trailing: string | null;
  /** What VoiceOver says for the row. */
  label: string;
  /** What the Journal tab opens on: the line field, or the entry writer. */
  opens: 'line' | 'entry';
}
/** The row at the foot of Today. Before the line: an invitation. After: the line itself, and the way to say more. */
export const tonightRow = (line: string | null | undefined): TonightRowWords => {
  const words = typeof line === 'string' ? line.replace(/\s+/g, ' ').trim() : '';
  if (!words) return { title: 'Tonight’s line', sub: 'One line is enough', trailing: null, label: 'Tonight’s line. One line is enough. Opens Journal', opens: 'line' };
  return { title: words, sub: 'Tonight’s line is kept', trailing: 'Write more', label: `Tonight’s line: ${words.replace(/[.!?…]+$/, '')}. Write more in Journal`, opens: 'entry' };
};
