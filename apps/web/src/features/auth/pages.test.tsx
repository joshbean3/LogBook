import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PAGES } from './pages';

const words = (p: (typeof PAGES)[number]) => `${p.title} ${renderToStaticMarkup(<>{p.sub}</>).replace(/<[^>]+>/g, '')}`;

describe('the welcome pager’s pages', () => {
  it('is three pages, one per place: Today, Fitness, Journal', () => {
    expect(PAGES.map((p) => p.key)).toEqual(['today', 'fitness', 'journal']);
  });
  it('gives every page a headline that ends in a period and one plain line', () => {
    for (const p of PAGES) {
      expect(p.title).toMatch(/^[A-Z].*\.$/);
      expect(words(p).length).toBeGreaterThan(p.title.length + 20);
    }
  });
  it('says what Orby is on the first page, and meets the assistant on the last', () => {
    expect(words(PAGES[0]!)).toContain('Orby is your day in one place');
    expect(words(PAGES.at(-1)!)).toContain('the assistant');
  });
  it('keeps to the copy rules: no em dash, no British spelling, the assistant by its name, no model name', () => {
    for (const p of PAGES) {
      const w = words(p);
      expect(w).not.toMatch(/[—–]/);
      expect(w).not.toMatch(/\b(coach|AI|bot|chatbot|Claude)\b/);
      expect(w).not.toMatch(/\bthe Orby\b|\bOrby app\b/);
      expect(w).not.toMatch(/colour|favourite|centre|programme/i);
    }
  });
});
