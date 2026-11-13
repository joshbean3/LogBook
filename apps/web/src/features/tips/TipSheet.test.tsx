import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '@/lib/prefs';
import { TipSheet } from './TipSheet';
import { TIP_PLACES, tipFor, type Tip } from './tips';

const html = (tip: Tip) => renderToStaticMarkup(<TipSheet tip={tip} onDone={() => undefined} onTour={() => undefined} />);
const count = (s: string, part: string) => s.split(part).length - 1;
const text = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();

describe('a tip’s body', () => {
  it.each(TIP_PLACES)('%s: one card, its rows under the two groups, one Sky button and one quiet link', (place) => {
    const tip = tipFor(place, DEFAULT_PREFS, { strava: false, health: true })!;
    const out = html(tip);
    expect(out).toContain(`data-place="${place}"`);
    expect(count(out, 'class="tip-card"')).toBe(1);
    // two groups: the first is named for VoiceOver and headed by the sheet's own caps line, the second prints its caption
    expect(count(out, '<section')).toBe(2);
    expect(out).toContain('aria-label="How it works"');
    expect(count(out, '<h3')).toBe(1);
    expect(out).toMatch(/<h3 id="[^"]+" class="caps tip-cap">How it’s tracked<\/h3>/);
    expect(text(out)).not.toMatch(/How it works/);
    // every row: a Haze tile with one glyph of the brand's set, hidden from VoiceOver, a title, a second line
    const rows = [...tip.works, ...tip.tracked];
    expect(count(out, '<li class="tip-row"')).toBe(rows.length);
    expect(count(out, 'class="icon-tile" aria-hidden="true"')).toBe(rows.length);
    expect(count(out, 'class="brand-icon"')).toBe(rows.length);
    expect(out).not.toContain('lucide');
    for (const r of rows) {
      expect(out).toContain(`<span class="tip-title">${r.title}</span>`);
      expect(out).toContain(`<span class="tip-sub">${r.sub}</span>`);
    }
    // the rows read in order: how it works, then how it is tracked
    const order = rows.map((r) => out.indexOf(`>${r.title}<`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(out.indexOf(`>${tip.works.at(-1)!.title}<`)).toBeLessThan(out.indexOf('<h3'));
    expect(out.indexOf('<h3')).toBeLessThan(out.indexOf(`>${tip.tracked[0]!.title}<`));
    // one primary, one quiet link after it, and nothing else to press
    expect(count(out, '<button')).toBe(2);
    expect(count(out, 'btn primary')).toBe(1);
    expect(out).toMatch(/<button type="button" class="btn primary\s+block\s*">Got it<\/button>/);
    expect(out).toMatch(/<button type="button" class="btn quiet\s+tip-tour">See it in the tour<\/button>/);
    expect(out.indexOf('Got it')).toBeLessThan(out.indexOf('See it in the tour'));
  });

  it('draws a group only when it has rows', () => {
    const tip = tipFor('journal', DEFAULT_PREFS)!;
    const out = html({ ...tip, tracked: [] });
    expect(count(out, '<section')).toBe(1);
    expect(out).not.toContain('<h3');
  });

  it('with Fitness off, the three tips say nothing about training', () => {
    const off = { ...DEFAULT_PREFS, fitness: false };
    expect(tipFor('plan', off)).toBeNull();
    for (const place of ['today', 'goals', 'journal'] as const) expect(text(html(tipFor(place, off)!))).not.toMatch(/\b(fitness|training|sessions?|runs?|lifts?|miles?|Strava)\b/i);
  });
});
