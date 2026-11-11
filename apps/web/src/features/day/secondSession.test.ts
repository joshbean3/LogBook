import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A day's other session is a compact card under the hero (Hero.tsx `SecondSession`): its name over its line, the hold ring
 * on the right. A name can run to 60 characters (the editor's limit), far wider than the card. Its cut (`nowrap` and an
 * ellipsis) was written on the name's span, an inline box, where `overflow` and `text-overflow` do nothing: at 390 wide a
 * 60 character name was drawn from x 33 to x 512, under the ring and past the card's edge at 374. These rules keep the
 * name a box that can cut its own text, in a column that gives way to the ring. Which cut it is (two lines then an
 * ellipsis, as now, or one line with an ellipsis) is the design's to choose.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'day.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (selector: string): string => {
  const at = css.indexOf(`\n${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};
/** A declaration's value in a rule, or null. The property is matched whole (`overflow` is not `overflow-wrap`). */
const value = (selector: string, prop: string): string | null => new RegExp(`[{;\\s]${prop}\\s*:\\s*([^;}]+)`).exec(rule(selector))?.[1]?.trim() ?? null;

describe("a second session's name stays inside its card", () => {
  it('the name is a box that can cut its text, not an inline span', () => {
    // a span with no `display` of its own is inline
    expect(value('.ss-stamp', 'display') ?? 'inline').toMatch(/^(-webkit-box|block|flow-root)$/);
    expect(value('.ss-stamp', 'overflow')).toBe('hidden');
  });

  it('it is cut on purpose: two lines then an ellipsis, or one line with one', () => {
    const clamp = value('.ss-stamp', '-webkit-line-clamp');
    if (clamp === null) {
      expect(value('.ss-stamp', 'white-space')).toBe('nowrap');
      expect(value('.ss-stamp', 'text-overflow')).toBe('ellipsis');
      return;
    }
    // the clamp counts lines only in the old flex box, and a word wider than the column has to break to reach the cut
    expect(Number(clamp)).toBeGreaterThanOrEqual(2);
    expect(value('.ss-stamp', 'display')).toBe('-webkit-box');
    expect(value('.ss-stamp', '-webkit-box-orient')).toBe('vertical');
    expect(value('.ss-stamp', 'overflow-wrap')).toBe('anywhere');
    expect(value('.ss-stamp', 'white-space')).toBeNull();
  });

  it('the words give way to the ring, never the ring to the words', () => {
    expect(value('.ss-text', 'min-width')).toBe('0');
    expect(value('.ss-ring', 'flex')).toBe('none');
  });

  it('reads a property whole', () => {
    expect(value('.ss-stamp', 'overflow')).not.toBe(value('.ss-stamp', 'overflow-wrap'));
    expect(value('.ss-stamp', 'no-such-property')).toBeNull();
    expect(rule('.no-such-rule')).toBe('');
  });
});
