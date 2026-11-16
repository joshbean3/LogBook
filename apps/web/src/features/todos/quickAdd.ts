import { parseISO, shiftDays, type ISODate, type TodoBucket, type TodoGroup, type TodoPriority } from '@logbook/shared';

/** A run of the typed line, as character offsets into it: `start` inclusive, `end` exclusive. */
export interface Span {
  start: number;
  end: number;
}

/** What a mark sets: how much it matters, the day it is for, or its list. */
export type MarkKind = 'priority' | 'when' | 'list';

/** One mark the line was read for, where it sits in the typed text and the words as typed (`fri`, `!!`, `#work`). */
export interface Mark extends Span {
  kind: MarkKind;
  text: string;
  /** The connector dropped with a day word ("on" in "on friday"), when there was one. */
  lead?: Span;
}

export interface QuickAdd {
  text: string;
  priority: TodoPriority;
  bucket: TodoBucket;
  due: ISODate | null;
  /** The list a `#Name` mark named; null when none or no such list. */
  groupId: string | null;
  /** Every mark that was read, last typed first. Its words are left out of `text`. */
  marks: Mark[];
}

const DAYS: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

/**
 * The little words English puts before a day ("on friday", "by fri", "for tomorrow", "this sat", "next mon", "due thu").
 * Read with the day, they would be left dangling at the end of the name, so the one right before a day word goes with it.
 * "next fri" is the same Friday as "fri": the next one after today.
 */
const CONNECTOR = /^(.*\S)\s+(on|by|for|this|next|due)$/i;

/** The next `dow` strictly after `from`: "fri" on a Friday means next week. */
const nextDow = (from: ISODate, dow: number): ISODate => {
  const d = parseISO(from).getDay();
  return shiftDays(from, ((dow - d + 7) % 7) || 7);
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const overlaps = (runs: readonly Span[], start: number, end: number) => runs.some((r) => start < r.end && end > r.start);

/**
 * Reads the small marks at the end of a quick-add line, so "Call the bank fri !!! #Work" lands as a P1 item for Friday in
 * Work. `!` P3, `!!` P2, `!!!` P1 (or `p1`, `p2`, `p3`); "tomorrow", "today", a weekday, "later", "someday" set when; `#Name`
 * files it in that list (spaces in a list's name are left out: `#DeepWork`); a `#tag` that names no list stays in the name.
 * One "on", "by", "for", "this", "next" or "due" right before a day word goes with it ("Finish the essay on friday" is
 * "Finish the essay", for Friday), and nothing before that phrase is read. Anything else is the name.
 *
 * `plain`: runs of the line the person said to keep as words (a tap on a mark's chip). A word inside one is never read as a
 * mark; it stays in the name, and the marks before it are still read.
 */
export const parseQuickAdd = (raw: string, date: ISODate, groups: readonly TodoGroup[] = [], plain: readonly Span[] = []): QuickAdd => {
  // offsets are into `raw`: the trimmed line starts `lead` characters in, and the marks are taken off its end
  const lead = raw.length - raw.trimStart().length;
  let text = raw.trim();
  let priority: TodoPriority = 0;
  let bucket: TodoBucket = 'today';
  let due: ISODate | null = null;
  let groupId: string | null = null;
  const marks: Mark[] = [];
  // a `#tag` that names no list, and a word kept plain, stay in the name (put back at the end); the marks before them are still read
  const kept: string[] = [];
  for (let reads = 0; reads < 6; ) {
    const m = /^(.*\S)\s+(\S+)$/.exec(text);
    if (!m) break;
    const tok = m[2]!;
    const start = lead + text.length - tok.length;
    const end = start + tok.length;
    const keep = () => {
      kept.unshift(tok);
      text = m[1]!;
    };
    if (overlaps(plain, start, end)) {
      keep();
      continue;
    }
    reads++;
    if (tok.length > 1 && tok.startsWith('#')) {
      const g = groups.find((x) => squash(x.name) === squash(tok.slice(1)));
      if (!g) {
        keep();
        continue;
      }
      groupId = groupId ?? g.id;
      marks.push({ kind: 'list', start, end, text: tok });
      text = m[1]!;
      continue;
    }
    // the marks need a space before them, so "Ship it!" keeps its punctuation
    if (/^!{1,3}$/.test(tok)) {
      priority = tok.length as TodoPriority;
      marks.push({ kind: 'priority', start, end, text: tok });
      text = m[1]!;
      continue;
    }
    if (!/^[a-z0-9]+$/i.test(tok)) break;
    const w = tok.toLowerCase();
    let day = false;
    let kind: MarkKind = 'when';
    if (w === 'p1' || w === 'p2' || w === 'p3') {
      priority = (4 - Number(w[1])) as TodoPriority;
      kind = 'priority';
    } else if (w === 'tomorrow' || w === 'tmrw') {
      bucket = 'later';
      due = shiftDays(date, 1);
      day = true;
    } else if (w === 'today') {
      bucket = 'today';
      due = null;
      day = true;
    } else if (w === 'someday') {
      bucket = 'someday';
      due = null;
    } else if (w === 'later') {
      // Later means a day: tomorrow unless a day was named
      bucket = 'later';
      due = due ?? shiftDays(date, 1);
    } else if (w in DAYS) {
      bucket = 'later';
      due = nextDow(date, DAYS[w]!);
      day = true;
    } else break;
    const mark: Mark = { kind, start, end, text: tok };
    marks.push(mark);
    text = m[1]!;
    if (day) {
      const c = CONNECTOR.exec(text);
      const cStart = c ? lead + text.length - c[2]!.length : 0;
      if (c && !overlaps(plain, cStart, cStart + c[2]!.length)) {
        // "on friday" is one phrase: the words before it are the name
        mark.lead = { start: cStart, end: cStart + c[2]!.length };
        text = c[1]!;
        break;
      }
    }
  }
  return { text: [text, ...kept].join(' '), priority, bucket, due, groupId, marks };
};

/**
 * Where a quick-added to-do lands. A day word that was read wins: "today", "tomorrow" or "fri" typed on a day ahead's page
 * is that day, counted from today (as its chip says). With no day read, a to-do typed on a day ahead's page (`page`) is
 * for that day; on today's page (`page` null) it is for today.
 */
export const landingOf = (parsed: QuickAdd, page: ISODate | null | undefined): { bucket: TodoBucket; due: ISODate | null } =>
  page && parsed.bucket === 'today' && !parsed.marks.some((m) => m.kind === 'when') ? { bucket: 'later', due: page } : { bucket: parsed.bucket, due: parsed.due };

/** A run of the line kept as words, with the words it covered, so an edit can tell whether it is still the same run. */
export interface PlainRun extends Span {
  text: string;
}

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/**
 * The runs kept plain, carried from the line as it was (`prev`) to the line as it is now (`next`). A run before or after
 * the edit moves with it; a run the edit touched is dropped, so its words are read again once they change. A run whose
 * word was typed onto ("fri" became "friday") is dropped too: it is a different word now.
 */
export const rebasePlain = (prev: string, next: string, runs: readonly PlainRun[]): PlainRun[] => {
  if (!runs.length || prev === next) return [...runs];
  const max = Math.min(prev.length, next.length);
  let p = 0;
  while (p < max && prev[p] === next[p]) p++;
  let s = 0;
  while (s < max - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  const cutEnd = prev.length - s;
  const shift = next.length - prev.length;
  const out: PlainRun[] = [];
  for (const r of runs) {
    const at = r.end <= p ? r.start : r.start >= cutEnd ? r.start + shift : null;
    if (at === null) continue;
    const moved = { start: at, end: at + r.text.length, text: r.text };
    if (next.slice(moved.start, moved.end) === r.text && isSpace(next[moved.start - 1]) && isSpace(next[moved.end])) out.push(moved);
  }
  return out;
};
