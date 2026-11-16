import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chipsOf, MarkChips } from './QuickAddChips';
import { parseQuickAdd } from './quickAdd';

// 2026-11-16 is a Monday: "friday" is the 20th
const D = '2026-11-16';
const groups = [{ id: 'g1', name: 'Work', color: 'blue' as const, position: 0, createdAt: '' }];
const LINE = 'Finish the essay on friday !! #work';

describe('the chips under the quick-add field', () => {
  it('one per kind of mark, its words plain, the day first', () => {
    const chips = chipsOf(parseQuickAdd(LINE, D, groups), D, groups);
    expect(chips.map((c) => [c.kind, c.words])).toEqual([
      ['when', 'Fri, Nov 20'],
      ['priority', 'P2'],
      ['list', 'Work'],
    ]);
  });
  it('each says what it was read from and what a tap does, its own words first', () => {
    const [day, flag, list] = chipsOf(parseQuickAdd(LINE, D, groups), D, groups);
    expect(day!.label).toBe('Fri, Nov 20, read from “friday”. Tap to keep it as words');
    expect(flag!.label).toBe('P2, read from “!!”. Tap to keep it as words');
    expect(list!.label).toBe('Work, read from “#work”. Tap to keep it as words');
  });
  it('says Today, Tomorrow and Someday in words', () => {
    const words = (line: string) => chipsOf(parseQuickAdd(line, D, groups), D, groups)[0]?.words;
    expect(words('Call mom tomorrow')).toBe('Tomorrow');
    expect(words('Call mom later')).toBe('Tomorrow');
    expect(words('Call mom today')).toBe('Today');
    expect(words('Call mom someday')).toBe('Someday');
    expect(chipsOf(parseQuickAdd('Call mom', D, groups), D, groups)).toEqual([]);
  });
  it('two marks of one kind are one chip that says what the to-do gets, and a tap keeps both as words', () => {
    const line = 'Call mom fri later';
    const chips = chipsOf(parseQuickAdd(line, D, groups), D, groups);
    expect(chips).toHaveLength(1);
    expect(chips[0]!.words).toBe('Fri, Nov 20');
    expect(parseQuickAdd(line, D, groups, chips[0]!.runs)).toMatchObject({ text: 'Call mom fri later', bucket: 'today', due: null, marks: [] });
  });
  it('a tap on a chip keeps that mark in the name, and only that one', () => {
    const parsed = parseQuickAdd(LINE, D, groups);
    const [day] = chipsOf(parsed, D, groups);
    const after = parseQuickAdd(LINE, D, groups, day!.runs);
    expect(after).toMatchObject({ text: 'Finish the essay on friday', priority: 2, groupId: 'g1', due: null });
    expect(chipsOf(after, D, groups).map((c) => c.words)).toEqual(['P2', 'Work']);
  });
  it('draws a button per chip with its label, the flag and the list’s dot hidden from VoiceOver', () => {
    const parsed = parseQuickAdd(LINE, D, groups);
    const html = renderToStaticMarkup(<MarkChips id="c" chips={chipsOf(parsed, D, groups)} parsed={parsed} groups={groups} onKeep={() => undefined} />);
    expect(html).toContain('aria-label="Fri, Nov 20, read from “friday”. Tap to keep it as words"');
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toMatch(/class="prio prio-2 "[^>]*aria-hidden="true"/);
    expect(html).toContain('class="qa-dot"');
    expect(html).not.toContain('aria-pressed');
    // nothing read: no row at all
    expect(renderToStaticMarkup(<MarkChips id="c" chips={[]} parsed={parseQuickAdd('Call mom', D)} groups={groups} onKeep={() => undefined} />)).toBe('');
  });
});
