import { parseISO, shiftDays, type ISODate, type TodoBucket, type TodoPriority } from '@logbook/shared';

export interface QuickAdd {
  text: string;
  priority: TodoPriority;
  bucket: TodoBucket;
  due: ISODate | null;
}

const DAYS: Record<string, number> = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };

/** The next `dow` strictly after `from`: "fri" on a Friday means next week. */
const nextDow = (from: ISODate, dow: number): ISODate => {
  const d = parseISO(from).getDay();
  return shiftDays(from, ((dow - d + 7) % 7) || 7);
};

/**
 * Reads the small marks at the end of a quick-add line, so "Call the bank fri !!" lands as a high item for Friday.
 * `!` medium, `!!` high; "tomorrow", "today", a weekday, "later", "someday" set when. Anything else is the name.
 */
export const parseQuickAdd = (raw: string, date: ISODate): QuickAdd => {
  let text = raw.trim();
  let priority: TodoPriority = 0;
  let bucket: TodoBucket = 'today';
  let due: ISODate | null = null;
  for (let i = 0; i < 3; i++) {
    const bang = /^(.*\S)\s+(!{1,2})$/.exec(text) ?? /^(.*[^\s!])(!{1,2})$/.exec(text);
    if (bang) {
      text = bang[1]!.trim();
      priority = bang[2]!.length === 2 ? 2 : 1;
      continue;
    }
    const word = /^(.*\S)\s+([a-z]+)$/i.exec(text);
    if (!word) break;
    const w = word[2]!.toLowerCase();
    if (w === 'tomorrow' || w === 'tmrw') {
      bucket = 'later';
      due = shiftDays(date, 1);
    } else if (w === 'today') {
      bucket = 'today';
      due = null;
    } else if (w === 'someday') {
      bucket = 'someday';
      due = null;
    } else if (w === 'later') {
      bucket = 'later';
    } else if (w in DAYS) {
      bucket = 'later';
      due = nextDow(date, DAYS[w]!);
    } else break;
    text = word[1]!.trim();
  }
  return { text, priority, bucket, due };
};
