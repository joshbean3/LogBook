import { describe, expect, it } from 'vitest';
import { clampLines, recallText, wrapLines } from './recallShare';

// one unit per character
const measure = (s: string) => s.length;

describe('the shared Remember when card', () => {
  it('breaks words into lines that fit', () => {
    expect(wrapLines('On Nov 5 you learned that sleep before midnight counts', 16, measure)).toEqual(['On Nov 5 you', 'learned that', 'sleep before', 'midnight counts']);
  });

  it('breaks a word too long for a line by characters, and gives nothing for nothing', () => {
    expect(wrapLines('a supercalifragilistic b', 8, measure)).toEqual(['a', 'supercal', 'ifragili', 'stic b']);
    expect(wrapLines('https://example.com/a/very/long/path', 10, measure).every((l) => l.length <= 10)).toBe(true);
    expect(wrapLines('   ', 8, measure)).toEqual([]);
  });

  it('ends with an ellipsis when the words still do not fit', () => {
    expect(clampLines(['one two', 'three four', 'five'], 2, 10, measure)).toEqual(['one two', 'three fou…']);
    expect(clampLines(['one', 'two'], 3, 10, measure)).toEqual(['one', 'two']);
  });

  it('copies the words with where they came from', () => {
    expect(recallText('You ran by the river.', 'Oct 19')).toBe('You ran by the river.\n\nRemember when · Oct 19');
  });
});
