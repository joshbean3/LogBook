import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A to-do can be one long word with no space in it (a pasted link). The words of a stop on the path sit in a grid inside a
 * flex row; a grid track is as wide as its longest word unless it is told it may shrink, and then the words run under the
 * check and off the card where nobody can read them. The same holds for the name on a second session's card, which is cut
 * with an ellipsis only when its box may shrink. These rules keep both boxes shrinkable and let a long word break.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = (path: string) => readFileSync(join(here, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** Every declaration block of a selector, joined. */
const rule = (sheet: string, selector: string) =>
  [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1]!.split(',').some((s) => s.trim() === selector))
    .map((m) => m[2])
    .join(';');

describe('long words on Today’s cards stay inside the card', () => {
  const poster = css('../../ui/poster/poster.css');
  it('a stop’s words sit in a track that may shrink', () => {
    expect(rule(poster, '.pth-text')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(rule(poster, '.pth-text')).toMatch(/min-width:\s*0/);
  });
  it('a stop’s title and the line under it break a word that is longer than the line', () => {
    expect(rule(poster, '.pth-title')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule(poster, '.pth-sub')).toMatch(/overflow-wrap:\s*anywhere/);
  });
  it('a second session’s name is cut inside its card (its track may shrink)', () => {
    const day = css('../day/day.css');
    expect(rule(day, '.ss-text')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(rule(day, '.ss-stamp')).toMatch(/text-overflow:\s*ellipsis/);
  });
});
