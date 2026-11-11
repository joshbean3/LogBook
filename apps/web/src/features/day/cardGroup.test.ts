import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * a11y-07: a card that is a group (CardGroup) opens from its title's button, whose `::after` layer is stretched over the
 * card. That layer is absolutely placed, so it is only as big as the nearest positioned box. Without a positioned card, the
 * second session's layer covered the whole day page (the hero's switch, the habits, Plan your day) and the Close card's run
 * row covered the journal box: every tap there opened the session. These rules keep each layer inside its own card.
 */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'day.css'), 'utf8');
const rule = (selector: string): string | null => {
  const at = css.indexOf(`\n${selector} {`);
  return at < 0 ? null : css.slice(at, css.indexOf('}', at));
};

describe('each card holds its own hit layer', () => {
  it('a card group is the box its title layer fills', () => {
    expect(rule('.card-group')).toMatch(/position:\s*relative/);
  });

  it('only the training card stretches the layer past the dial (the Close card is a .hero too)', () => {
    expect(css).not.toMatch(/\n\.hero \.card-open::after\s*\{/);
    expect(rule('.hero.card-group .card-open::after')).toMatch(/inset:\s*-1000px/);
  });
});

/**
 * The title in that button is a `<span>`, and `text-overflow` cuts only a block. Left inline, a 60 character session
 * name (the longest the server takes) ran past the second session's card and under its hold ring, and under the ring in
 * the Close card's run row, instead of ending in an ellipsis. Each of these names is a block that is cut on one line.
 */
describe('a long session name is cut inside its card', () => {
  for (const name of ['.ss-stamp', '.cd-run-stamp'])
    it(`${name} is a block that ends in an ellipsis`, () => {
      const r = rule(name);
      expect(r).toMatch(/display:\s*block/);
      expect(r).toMatch(/white-space:\s*nowrap/);
      expect(r).toMatch(/overflow:\s*hidden/);
      expect(r).toMatch(/text-overflow:\s*ellipsis/);
    });
});
