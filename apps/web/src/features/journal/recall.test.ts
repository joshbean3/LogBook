import type { RecallItem } from '@logbook/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => ({ api: vi.fn() }));
vi.mock('@/api/outbox', () => ({ write: vi.fn() }));

import { plainLine, writtenByAi } from './recall';

const item = (over: Partial<RecallItem & { ai?: boolean }> = {}): RecallItem & { ai?: boolean } => ({
  kind: 'journal',
  id: 'j1',
  date: '2026-03-30',
  excerpt: 'Easy miles and a quiet evening. Legs felt fine after Sunday.',
  summary: 'On Mar 30 you wrote: “Easy miles and a quiet evening.”',
  boosted: false,
  ...over,
});
const TODAY = '2026-11-10';

/** copy-legal-06, copy-legal-09: what Remember when shows with the recall switch off, and when a line is marked as AI. */
describe('Remember when: the plain line and the AI mark', () => {
  it('builds the plain line from the excerpt alone: the first sentence, the day, nothing else', () => {
    expect(plainLine(item(), TODAY)).toBe('On Mar 30 you wrote: “Easy miles and a quiet evening.”');
    expect(plainLine(item({ kind: 'learning', excerpt: 'Sleep before long runs matters more than the shoes' }), TODAY)).toBe('On Mar 30 you learned: “Sleep before long runs matters more than the shoes”');
    // another year says so
    expect(plainLine(item({ date: '2025-03-30' }), TODAY)).toBe('On Mar 30, 2025 you wrote: “Easy miles and a quiet evening.”');
    // a long first sentence is cut at a word, never mid-word
    const long = plainLine(item({ excerpt: `${'word '.repeat(60)}end.` }), TODAY);
    expect(long.length).toBeLessThan(170);
    expect(long.endsWith('…”')).toBe(true);
  });

  it('does not use the summary the answer carried: with the switch off, a cached AI line never shows', () => {
    const cached = item({ summary: 'Sam, on Mar 30 you logged easy miles. Small days built this.' });
    expect(plainLine(cached, TODAY)).toBe('On Mar 30 you wrote: “Easy miles and a quiet evening.”');
  });

  it('marks a line as written by AI when the server says so, else when it is not the plain line', () => {
    expect(writtenByAi(item(), TODAY)).toBe(false);
    expect(writtenByAi(item({ summary: 'Sam, on Mar 30 you logged easy miles. Small days built this.' }), TODAY)).toBe(true);
    expect(writtenByAi(item({ kind: 'learning', summary: 'On Mar 30 you learned: “Sleep matters.”' }), TODAY)).toBe(false);
    // the server's own word wins
    expect(writtenByAi(item({ ai: true }), TODAY)).toBe(true);
    expect(writtenByAi(item({ ai: false, summary: 'Sam, on Mar 30 you logged easy miles.' }), TODAY)).toBe(false);
  });
});
