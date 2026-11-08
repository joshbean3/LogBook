import { describe, expect, it } from 'vitest';
import { recallText, wrapLines } from './recallShare';

// one unit per character
const measure = (s: string) => s.length;

describe('the shared Remember when card', () => {
  it('breaks words into lines that fit', () => {
    expect(wrapLines('On Nov 5 you learned that sleep before midnight counts', 16, measure)).toEqual(['On Nov 5 you', 'learned that', 'sleep before', 'midnight counts']);
  });

  it('gives a word too long for a line its own line, and nothing for nothing', () => {
    expect(wrapLines('a supercalifragilistic b', 8, measure)).toEqual(['a', 'supercalifragilistic', 'b']);
    expect(wrapLines('   ', 8, measure)).toEqual([]);
  });

  it('copies the words with where they came from', () => {
    expect(recallText('You ran by the river.', 'Oct 19')).toBe('You ran by the river.\n\nRemember when · Oct 19');
  });
});
