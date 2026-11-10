import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './quickAdd';

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
    expect(parseQuickAdd('Call the bank fri !! #Work', '2026-10-26', groups)).toEqual({ text: 'Call the bank #Work', priority: 2, bucket: 'later', due: '2026-10-30', groupId: null });
    expect(parseQuickAdd('Issue #42 tomorrow', '2026-10-26', groups)).toMatchObject({ text: 'Issue #42', bucket: 'later', due: '2026-10-27' });
    expect(parseQuickAdd('Plan #q4 #deepwork !', '2026-10-26', groups)).toMatchObject({ text: 'Plan #q4', priority: 1, groupId: 'g1' });
  });
});
