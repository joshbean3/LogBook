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
