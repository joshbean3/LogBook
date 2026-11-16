import { describe, expect, it } from 'vitest';
import { parseQuickAdd, rebasePlain, type PlainRun } from './quickAdd';

const groups = [{ id: 'g1', name: 'Deep Work', color: 'blue' as const, position: 0, createdAt: '' }];

describe('quick add marks', () => {
  it('reads P1 to P3 from bangs and words', () => {
    expect(parseQuickAdd('Call the bank !!!', '2026-10-26').priority).toBe(3);
    expect(parseQuickAdd('Call the bank !!', '2026-10-26').priority).toBe(2);
    expect(parseQuickAdd('Call the bank !', '2026-10-26').priority).toBe(1);
    expect(parseQuickAdd('Call the bank p1', '2026-10-26').priority).toBe(3);
  });
  it('files under a list by #name, spaces left out', () => {
    const q = parseQuickAdd('Draft the memo fri p2 #deepwork', '2026-10-26', groups);
    expect(q).toMatchObject({ text: 'Draft the memo', priority: 2, groupId: 'g1', bucket: 'later' });
  });
  it('keeps an unknown #tag in the name', () => {
    expect(parseQuickAdd('Buy #2 pencils', '2026-10-26', groups)).toMatchObject({ text: 'Buy #2 pencils', groupId: null });
  });
  it('still reads the marks before a #tag that names no list', () => {
    // 2026-10-26 is a Monday: "fri" is the 30th
    expect(parseQuickAdd('Call the bank fri !! #Work', '2026-10-26', groups)).toMatchObject({ text: 'Call the bank #Work', priority: 2, bucket: 'later', due: '2026-10-30', groupId: null });
    expect(parseQuickAdd('Issue #42 tomorrow', '2026-10-26', groups)).toMatchObject({ text: 'Issue #42', bucket: 'later', due: '2026-10-27' });
    expect(parseQuickAdd('Plan #q4 #deepwork !', '2026-10-26', groups)).toMatchObject({ text: 'Plan #q4', priority: 1, groupId: 'g1' });
  });
});

// 2026-10-26 is a Monday: Friday is the 30th, Tuesday the 27th, tomorrow the 27th
const D = '2026-10-26';
const q = (line: string, plain: { start: number; end: number }[] = []) => parseQuickAdd(line, D, groups, plain);

describe('a day word takes the little word before it', () => {
  it('drops one "on", "by", "for", "this", "next" or "due" right before a day word', () => {
    expect(q('Finish the essay on friday')).toMatchObject({ text: 'Finish the essay', bucket: 'later', due: '2026-10-30' });
    expect(q('Send the deck by fri')).toMatchObject({ text: 'Send the deck', due: '2026-10-30' });
    expect(q('Pack for tomorrow')).toMatchObject({ text: 'Pack', due: '2026-10-27' });
    expect(q('Buy milk for today')).toMatchObject({ text: 'Buy milk', bucket: 'today', due: null });
    expect(q('Clean the garage this sat')).toMatchObject({ text: 'Clean the garage', due: '2026-10-31' });
    expect(q('Renew the permit due thu')).toMatchObject({ text: 'Renew the permit', due: '2026-10-29' });
    expect(q('Call the bank ON Tuesday')).toMatchObject({ text: 'Call the bank', due: '2026-10-27' });
  });
  it('"next fri" is the Friday "fri" means: the next one after today', () => {
    expect(q('Book the hall next fri')).toMatchObject({ text: 'Book the hall', due: q('Book the hall fri').due });
    // on a Friday, "fri" (and so "next fri") is a week away
    expect(parseQuickAdd('Book the hall next fri', '2026-10-30')).toMatchObject({ text: 'Book the hall', due: '2026-11-06' });
  });
  it('reads the marks after the day as before', () => {
    expect(q('Finish the essay on friday !! #deepwork')).toMatchObject({ text: 'Finish the essay', priority: 2, due: '2026-10-30', groupId: 'g1' });
    expect(q('Send the model on fri p1')).toMatchObject({ text: 'Send the model', priority: 3, due: '2026-10-30' });
  });
  it('drops only one, and reads nothing before the phrase', () => {
    expect(q('Work on for fri')).toMatchObject({ text: 'Work on', due: '2026-10-30' });
    // "!!" before "on friday" is part of the name, as it was before
    expect(q('Ship it !! on fri')).toMatchObject({ text: 'Ship it !!', priority: 0, due: '2026-10-30' });
  });
  it('leaves those words alone when no day word follows them', () => {
    expect(q('Call Don')).toMatchObject({ text: 'Call Don', bucket: 'today', due: null });
    expect(q('Pay for lunch')).toMatchObject({ text: 'Pay for lunch', due: null });
    expect(q('Book on Tuesday’s flight')).toMatchObject({ text: 'Book on Tuesday’s flight', due: null });
    expect(q('Book on Tuesday flight')).toMatchObject({ text: 'Book on Tuesday flight', due: null });
    expect(q('Pass it on')).toMatchObject({ text: 'Pass it on', due: null });
    expect(q('Ask about next steps')).toMatchObject({ text: 'Ask about next steps', marks: [] });
  });
  it('leaves Later and Someday’s words alone (they are not days)', () => {
    expect(q('Save it for later')).toMatchObject({ text: 'Save it for', bucket: 'later' });
    expect(q('Read it for someday')).toMatchObject({ text: 'Read it for', bucket: 'someday' });
  });
  it('a line that is only the phrase keeps its first word', () => {
    expect(q('on friday')).toMatchObject({ text: 'on', due: '2026-10-30' });
  });
});

describe('each mark comes back with its kind and its place in the line', () => {
  it('names the words read, last typed first', () => {
    const line = 'Send the model fri !!! #deepwork';
    const { marks } = q(line);
    expect(marks.map((m) => [m.kind, m.text, line.slice(m.start, m.end)])).toEqual([
      ['list', '#deepwork', '#deepwork'],
      ['priority', '!!!', '!!!'],
      ['when', 'fri', 'fri'],
    ]);
  });
  it('counts from the line as typed, spaces at its start included', () => {
    const line = '  Finish the essay on friday !!';
    const [bang, day] = q(line).marks;
    expect(line.slice(bang!.start, bang!.end)).toBe('!!');
    expect(line.slice(day!.start, day!.end)).toBe('friday');
    expect(line.slice(day!.lead!.start, day!.lead!.end)).toBe('on');
  });
  it('a word mark (p1, someday, later) is a mark too; a #tag that names no list is not', () => {
    expect(q('Plan it p2').marks).toMatchObject([{ kind: 'priority', text: 'p2' }]);
    expect(q('Plan it someday').marks).toMatchObject([{ kind: 'when', text: 'someday' }]);
    expect(q('Plan #q4').marks).toEqual([]);
  });
});

describe('a mark kept as words', () => {
  const at = (line: string, word: string) => {
    const start = line.lastIndexOf(word);
    return { start, end: start + word.length };
  };
  it('stays in the name and is not read; the other marks still are', () => {
    const line = 'Finish the essay on friday !! #deepwork';
    expect(q(line, [at(line, 'friday')])).toMatchObject({ text: 'Finish the essay on friday', priority: 2, groupId: 'g1', bucket: 'today', due: null });
    expect(q(line, [at(line, '!!')])).toMatchObject({ text: 'Finish the essay !!', priority: 0, groupId: 'g1', due: '2026-10-30' });
    expect(q(line, [at(line, '#deepwork')])).toMatchObject({ text: 'Finish the essay #deepwork', priority: 2, groupId: null, due: '2026-10-30' });
    expect(q(line, [at(line, 'friday')]).marks.map((m) => m.kind)).toEqual(['list', 'priority']);
  });
  it('a connector kept as words is not dropped, and the day is still read', () => {
    const line = 'Read on fri';
    expect(q(line, [at(line, 'on')])).toMatchObject({ text: 'Read on', due: '2026-10-30' });
  });
});

describe('the runs kept as words, as the line changes', () => {
  const run = (line: string, word: string): PlainRun => {
    const start = line.lastIndexOf(word);
    return { start, end: start + word.length, text: word };
  };
  it('stay through typing after them', () => {
    const a = 'Call fri';
    const r = rebasePlain(a, 'Call fri ', [run(a, 'fri')]);
    expect(r).toEqual([run(a, 'fri')]);
    const b = rebasePlain('Call fri ', 'Call fri !!', r);
    expect(b).toEqual([run(a, 'fri')]);
    expect(parseQuickAdd('Call fri !!', D, groups, b)).toMatchObject({ text: 'Call fri', priority: 2, due: null });
  });
  it('move with typing before them', () => {
    const a = 'Call fri';
    expect(rebasePlain(a, 'Call Al fri', [run(a, 'fri')])).toEqual([run('Call Al fri', 'fri')]);
  });
  it('go when their words change, so the new word is read', () => {
    const a = 'Call fri';
    expect(rebasePlain(a, 'Call friday', [run(a, 'fri')])).toEqual([]);
    expect(rebasePlain(a, 'Call fr', [run(a, 'fri')])).toEqual([]);
    expect(rebasePlain(a, 'Call sat', [run(a, 'fri')])).toEqual([]);
    expect(rebasePlain(a, '', [run(a, 'fri')])).toEqual([]);
  });
});

