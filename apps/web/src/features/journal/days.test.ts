import type { JournalEntry, Learning, LearningMonth } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { archiveMonths, dayMarks, longPaste, markParts, mergeDays, mergeFound, monthPageDays, monthRowsOf, snippet, tonightRow, weekBand, weekLabel, writtenWeek, writtenWords } from './days';

const T = '2026-11-12'; // a Thursday
const line = (id: string, date: string, text = `Line ${id}`, at = '20:00'): Learning => ({ id, date, text, createdAt: `${date}T${at}:00.000Z`, editedAt: null });
const entry = (id: string, date: string, text = `Entry ${id}`, at = '21:00', fav = false): JournalEntry => ({ id, date, text, createdAt: `${date}T${at}:00.000Z`, editedAt: null, fav });
const counts = (...days: string[]) => {
  const m = new Map<string, number>();
  for (const d of days) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
};

describe('the week’s lights: a day is lit by a line or by an entry', () => {
  it('lights a day with a line, a day with only an entry, and counts a day with both once', () => {
    const w = writtenWeek(T, counts('2026-11-09', '2026-11-11', '2026-11-11'), new Set(['2026-11-10', '2026-11-11']));
    expect(w.days.map((d) => d.date)).toEqual(['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
    expect(w.days.map((d) => d.lit)).toEqual([false, false, false, true, true, true]);
    expect(w.days.map((d) => d.letter).join('')).toBe('FSSMTW');
    expect(w).toMatchObject({ before: 3, tonight: false, line: false, written: 3, kept: 3 });
  });
  it('today counts either way: an entry lights tonight, but the line is still to write', () => {
    const entryOnly = writtenWeek(T, counts(), new Set([T]));
    expect(entryOnly).toMatchObject({ tonight: true, line: false, written: 1, kept: 0 });
    const both = writtenWeek(T, counts(T), new Set([T]));
    expect(both).toMatchObject({ tonight: true, line: true, written: 1, kept: 1 });
  });
  it('reads nothing outside the seven days, and a count that is not a number of lines as none', () => {
    const odd = new Map<string, number>([['2026-11-05', 2], ['2026-11-13', 1], ['2026-11-10', Number.NaN], ['2026-11-09', -1], ['2026-11-08', 2.9]]);
    const w = writtenWeek(T, odd, new Set(['2026-11-01', '2026-11-13']));
    expect(w).toMatchObject({ before: 1, written: 1, kept: 2, tonight: false });
  });
});

describe('the band’s words: gain-framed, days written, never days in a row', () => {
  it('invites the first line, by name for someone who has never written', () => {
    const none = writtenWeek(T, counts(), new Set());
    expect(weekBand(none, false)).toEqual({ label: 'This week', words: 'Your first line lights tonight' });
    expect(weekBand(none, true)).toEqual({ label: 'This week', words: 'Tonight’s line lights the first' });
  });
  it('before tonight is written: the count so far and which light tonight’s would be', () => {
    const w = writtenWeek(T, counts('2026-11-09'), new Set(['2026-11-10']));
    expect(weekBand(w, true)).toEqual({ label: 'This week · 2 days written', words: 'Tonight’s line lights the third' });
  });
  it('once tonight is lit: the days written, then the lines kept when there are any', () => {
    expect(weekBand(writtenWeek(T, counts('2026-11-09', T), new Set()), true)).toEqual({ label: 'This week', words: '2 days written', second: '2 lines kept' });
    expect(weekBand(writtenWeek(T, counts(), new Set([T])), true)).toEqual({ label: 'This week', words: '1 day written' });
  });
  it('says the week in one label, with no word for a run of days', () => {
    const w = writtenWeek(T, counts('2026-11-09', T), new Set(['2026-11-11']));
    expect(weekLabel(w)).toBe('3 days written this week: Monday, Wednesday, and today. Tonight’s line is kept.');
    expect(weekLabel(writtenWeek(T, counts(), new Set()))).toBe('Nothing written this week yet. Tonight’s line is not written yet.');
    expect(weekLabel(writtenWeek(T, counts(), new Set([T])))).toBe('1 day written this week: today. Tonight’s line is not written yet.');
    for (const s of [weekLabel(w), ...Object.values(weekBand(w, true))]) expect(s).not.toMatch(/streak|in a row/i);
  });
});

describe('lines and entries, laid out by day', () => {
  const lines = [line('l2', '2026-11-10', 'Second', '21:00'), line('l1', '2026-11-10', 'First', '08:00'), line('l3', '2026-11-12')];
  const entries = [entry('e1', '2026-11-11', 'Old', '09:00'), entry('e2', '2026-11-11', 'New', '22:00'), entry('e3', '2026-11-10')];
  it('merges both lists into days, newest first: lines as written, entries newest first', () => {
    const days = mergeDays(lines, entries);
    expect(days.map((d) => d.date)).toEqual(['2026-11-12', '2026-11-11', '2026-11-10']);
    expect(days[2]!.lines.map((l) => l.text)).toEqual(['First', 'Second']);
    expect(days[1]!.entries.map((e) => e.text)).toEqual(['New', 'Old']);
    expect(days[1]!.lines).toEqual([]);
    expect(days[0]!.entries).toEqual([]);
  });
  it('shows a thing once when a list holds it twice, and skips what has no day', () => {
    const days = mergeDays([...lines, lines[0]!, { id: 'x' } as unknown as Learning], [...entries, entries[0]!, null as unknown as JournalEntry]);
    expect(days.flatMap((d) => d.lines).length).toBe(3);
    expect(days.flatMap((d) => d.entries).length).toBe(3);
  });
  it('a month’s page keeps only that month’s written days, and no empty row', () => {
    const days = monthPageDays('2026-11', T, [...lines, line('o', '2026-10-31')], [...entries, entry('p', '2026-12-01')]);
    expect(days.map((d) => d.date)).toEqual(['2026-11-12', '2026-11-11', '2026-11-10']);
    expect(days.every((d) => d.lines.length + d.entries.length > 0)).toBe(true);
    expect(monthPageDays('2026-09', T, lines, entries)).toEqual([]);
  });
  it('can keep the last days as rows to fill in, never a day still to come', () => {
    const days = monthPageDays('2026-11', T, [line('a', '2026-11-10')], [], '2026-11-09');
    expect(days.map((d) => [d.date, d.lines.length])).toEqual([['2026-11-12', 0], ['2026-11-11', 0], ['2026-11-10', 1], ['2026-11-09', 0]]);
    // a line dated after today (another time zone) is still shown; the day after it is not offered
    expect(monthPageDays('2026-11', T, [line('z', '2026-11-13')], [], T).map((d) => d.date)).toEqual(['2026-11-13', '2026-11-12']);
  });
  it('marks the calendar by what a day holds', () => {
    const marks = dayMarks(mergeDays(lines, [...entries, entry('f', '2026-11-12', 'Fav', '10:00', true)]));
    expect(marks.get('2026-11-10')).toEqual({ lines: 2, entries: 1, fav: false });
    expect(marks.get('2026-11-12')).toEqual({ lines: 1, entries: 1, fav: true });
    expect(marks.has('2026-11-09')).toBe(false);
    expect(writtenWords(2, 1)).toBe('2 lines, 1 entry');
    expect(writtenWords(0, 3)).toBe('3 entries');
    expect(writtenWords(1, 0)).toBe('1 line');
    expect(writtenWords(0, 0)).toBe('nothing written');
  });
});

describe('the archive’s months, from lines and entries together', () => {
  const lm = (month: string, count: number, days: number): LearningMonth => ({ month, count, days, latest: '' });
  it('counts a month’s days exactly when both lists are on the device', () => {
    const rows = archiveMonths({
      lineMonths: [lm('2026-11', 3, 2)],
      entries: [entry('e1', '2026-11-10'), entry('e2', '2026-11-11'), entry('e3', '2026-11-11')],
      reach: '0000-00-00',
      lineDays: new Map([['2026-11', new Set(['2026-11-09', '2026-11-10'])]]),
    });
    // the 9th and 10th hold a line, the 10th and 11th an entry: three days
    expect(rows).toEqual([{ month: '2026-11', days: 3, lines: 3, entries: 3 }]);
  });
  it('uses the server’s count for a month it cannot see whole, and never shows fewer days than the device knows', () => {
    const rows = archiveMonths({
      lineMonths: [lm('2026-10', 4, 4), lm('2025-12', 2, 2)],
      entries: [entry('e1', '2026-10-02')],
      reach: '2026-10-01',
      server: [
        { month: '2026-10', days: 2, lines: 4, entries: 1 },
        { month: '2025-12', days: 9, lines: 2, entries: 8 },
        { month: '2025-06', days: 1, lines: 0, entries: 1 },
      ],
    });
    expect(rows).toEqual([
      { month: '2026-10', days: 4, lines: 4, entries: 1 },
      { month: '2025-12', days: 9, lines: 2, entries: 8 },
      // a month that holds only entries the device has not loaded still has its row
      { month: '2025-06', days: 1, lines: 0, entries: 1 },
    ]);
  });
  it('with no server count: the larger of the days each list knows, newest month first, and no row for nothing', () => {
    const rows = archiveMonths({ lineMonths: [lm('2026-09', 5, 5), lm('2026-11', 1, 1), lm('bad', 3, 3), lm('2026-08', 0, 0)], entries: [entry('a', '2026-09-01'), entry('b', '2026-07-04'), { date: 'nope' }], reach: null, server: null });
    expect(rows).toEqual([
      { month: '2026-11', days: 1, lines: 1, entries: 0 },
      { month: '2026-09', days: 5, lines: 5, entries: 1 },
      { month: '2026-07', days: 1, lines: 0, entries: 1 },
    ]);
  });
  it('reads the server’s answer without trusting it', () => {
    expect(monthRowsOf(null)).toBeNull();
    expect(monthRowsOf({ months: 'no' })).toBeNull();
    expect(monthRowsOf({ months: [{ month: '2026-11', days: 3, lines: 2, entries: 2 }, { month: '2026-13', days: 1, lines: 1, entries: 0 }, { month: '2026-10', days: 0, lines: 0, entries: 0 }, { month: '2026-09', days: -2, lines: 1.9, entries: 'x' }, null] })).toEqual([
      { month: '2026-11', days: 3, lines: 2, entries: 2 },
      { month: '2026-09', days: 1, lines: 1, entries: 0 },
    ]);
  });
});

describe('search: both lists as one, the match marked', () => {
  it('groups what was found by month and day, newest first', () => {
    const found = mergeFound([line('l1', '2026-11-10'), line('l2', '2026-10-02')], [entry('e1', '2026-11-10'), entry('e2', '2025-11-10')]);
    expect(found.map((m) => [m.month, m.days.map((d) => d.date)])).toEqual([
      ['2026-11', ['2026-11-10']],
      ['2026-10', ['2026-10-02']],
      ['2025-11', ['2025-11-10']],
    ]);
    expect(found[0]!.days[0]).toMatchObject({ lines: [{ id: 'l1' }], entries: [{ id: 'e1' }] });
    // one list alone (the other failed, or found nothing) is still a result
    expect(mergeFound([], [entry('e', '2026-11-01')]).length).toBe(1);
    expect(mergeFound([], [])).toEqual([]);
  });
  it('marks every match, whatever its case, and leaves the rest as written', () => {
    expect(markParts('Run, then run again. RUN!', 'run')).toEqual([
      { text: 'Run', hit: true },
      { text: ', then ', hit: false },
      { text: 'run', hit: true },
      { text: ' again. ', hit: false },
      { text: 'RUN', hit: true },
      { text: '!', hit: false },
    ]);
    expect(markParts('Nothing here', 'tempo')).toEqual([{ text: 'Nothing here', hit: false }]);
    expect(markParts('Anything', '  ')).toEqual([{ text: 'Anything', hit: false }]);
    expect(markParts('100% of it (really)', '% of it (')).toEqual([
      { text: '100', hit: false },
      { text: '% of it (', hit: true },
      { text: 'really)', hit: false },
    ]);
    expect(markParts('aaa', 'aa').map((p) => p.text).join('')).toBe('aaa');
  });
  it('shows a long entry from near its match, a short or early one from its start', () => {
    const long = `${'Filler words that say little. '.repeat(6)}Then the tempo run happened and it mattered.`;
    const s = snippet(long, 'tempo');
    expect(s.startsWith('…')).toBe(true);
    expect(s.toLowerCase().indexOf('tempo')).toBeLessThan(60);
    expect(snippet('The tempo run was first.', 'tempo')).toBe('The tempo run was first.');
    expect(snippet('No match\n\nin   here.', 'zzz')).toBe('No match in here.');
  });
});

describe('a paste too long for a line', () => {
  const big = 'x'.repeat(1200);
  it('fits: nothing is offered', () => {
    expect(longPaste({ value: 'Today I learned ', start: 16, end: 16, pasted: 'a short thing', own: false })).toBeNull();
    expect(longPaste({ value: 'a'.repeat(900), start: 0, end: 900, pasted: 'b'.repeat(1000), own: true })).toBeNull();
  });
  it('too long: the whole words, without a starter nobody changed', () => {
    expect(longPaste({ value: 'Today I learned ', start: 16, end: 16, pasted: big, own: false })).toBe(big);
  });
  it('too long, into words of the person’s own: theirs, with the paste where the selection was', () => {
    expect(longPaste({ value: 'Before [cut] after', start: 7, end: 12, pasted: big, own: true })).toBe(`Before ${big} after`);
    // a selection given backwards, or past the end, is still read as one
    expect(longPaste({ value: 'abc', start: 99, end: 1, pasted: big, own: true })).toBe(`a${big}`);
  });
  it('a paste of only space is nothing to save', () => {
    expect(longPaste({ value: '', start: 0, end: 0, pasted: ' '.repeat(1500), own: false })).toBeNull();
  });
});

describe('Today’s Journal row', () => {
  it('before the line: an invitation that opens the line field', () => {
    for (const none of [null, undefined, '', '   ']) expect(tonightRow(none)).toEqual({ title: 'Tonight’s line', sub: 'One line is enough', trailing: null, label: 'Tonight’s line. One line is enough. Opens Journal', opens: 'line' });
  });
  it('after: the line itself, and Write more, which opens the entry writer', () => {
    expect(tonightRow('Easy days\n build   the base.')).toEqual({ title: 'Easy days build the base.', sub: 'Tonight’s line is kept', trailing: 'Write more', label: 'Tonight’s line: Easy days build the base. Write more in Journal', opens: 'entry' });
  });
});
