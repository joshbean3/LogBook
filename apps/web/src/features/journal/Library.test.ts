import { describe, expect, it } from 'vitest';
import { sameQuote } from './Library';

describe('a quote added twice', () => {
  it('is the same line whatever its case, spacing and quote marks', () => {
    expect(sameQuote({ text: 'Keep going.', author: 'Seneca' }, { text: ' “keep   going.” ', author: 'seneca' })).toBe(true);
    expect(sameQuote({ text: 'Keep going.', author: 'Seneca' }, { text: 'Keep going.', author: '' })).toBe(false);
    expect(sameQuote({ text: 'Keep going.', author: '' }, { text: 'Keep going on.', author: '' })).toBe(false);
  });
});
