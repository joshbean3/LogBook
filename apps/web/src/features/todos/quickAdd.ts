import { parseISO, shiftDays, type ISODate, type TodoBucket, type TodoGroup, type TodoPriority } from '@logbook/shared';

export interface QuickAdd {
  text: string;
  priority: TodoPriority;
  bucket: TodoBucket;
  due: ISODate | null;
  /** The list a `#Name` mark named; null when none or no such list. */
  groupId: string | null;
}

const DAYS: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

/** The next `dow` strictly after `from`: "fri" on a Friday means next week. */
const nextDow = (from: ISODate, dow: number): ISODate => {
  const d = parseISO(from).getDay();
  return shiftDays(from, ((dow - d + 7) % 7) || 7);
};

/**
 * Reads the small marks at the end of a quick-add line, so "Call the bank fri !!! #Work" lands as a P1 item for Friday in
 * Work. `!` P3, `!!` P2, `!!!` P1 (or `p1`, `p2`, `p3`); "tomorrow", "today", a weekday, "later", "someday" set when; `#Name`
 * files it in that list (spaces in a list's name are left out: `#DeepWork`). Anything else is the name.
 */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const parseQuickAdd = (raw: string, date: ISODate, groups: readonly TodoGroup[] = []): QuickAdd => {
  let text = raw.trim();
  let priority: TodoPriority = 0;
  let bucket: TodoBucket = 'today';
  let due: ISODate | null = null;
  let groupId: string | null = null;
  for (let i = 0; i < 4; i++) {
    const tag = /^(.*\S)\s+#(\S+)$/.exec(text);
    if (tag) {
      const g = groups.find((x) => squash(x.name) === squash(tag[2]!));
      if (!g) break;
      groupId = g.id;
      text = tag[1]!.trim();
      continue;
    }
    // the marks need a space before them, so "Ship it!" keeps its punctuation
    const bang = /^(.*\S)\s+(!{1,3})$/.exec(text);
    if (bang) {
      text = bang[1]!.trim();
      priority = (bang[2]!.length >= 3 ? 3 : bang[2]!.length === 2 ? 2 : 1) as TodoPriority;
      continue;
    }
    const word = /^(.*\S)\s+([a-z0-9]+)$/i.exec(text);
    if (!word) break;
    const w = word[2]!.toLowerCase();
    if (w === 'p1' || w === 'p2' || w === 'p3') {
      priority = (4 - Number(w[1])) as TodoPriority;
    } else if (w === 'tomorrow' || w === 'tmrw') {
      bucket = 'later';
      due = shiftDays(date, 1);
    } else if (w === 'today') {
      bucket = 'today';
      due = null;
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
    } else break;
    text = word[1]!.trim();
  }
  return { text, priority, bucket, due, groupId };
};
