import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A name with no spaces (a pasted link, a long compound word, a name from an import) must wrap inside its row. A grid with
 * no stated column sizes it to its longest word, so the words ran under the chevron and past the card's edge, and the line
 * under them was cut with them (a 320 pt phone; any phone at the largest text size). These rows hold what a person typed:
 * each states one column that may shrink, and lets the words break anywhere.
 */
const here = dirname(fileURLToPath(import.meta.url));
const css = (file: string) => readFileSync(join(here, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** The declarations of every rule whose selector list names `sel` exactly. */
const rule = (sheet: string, sel: string): string =>
  [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((m) => m[1]!.split(',').some((s) => s.trim() === sel))
    .map((m) => m[2]!)
    .join(';');

describe('rows that hold a name wrap a word of any length', () => {
  /** What it is, its stylesheet, the grid that holds the words, and the rules that must let a word break (selector, how). */
  const rows: Array<[string, string, string, Array<[string, RegExp]>]> = [
    ['a stop on the line of days', '../../ui/poster/poster.css', '.pth-text', [['.pth-title', /overflow-wrap:\s*anywhere/], ['.pth-sub', /overflow-wrap:\s*anywhere/], ['.pth-cap', /overflow-wrap:\s*anywhere/]]],
    ['the plan row', 'plantop.css', '.pt-row-main', [['.pt-row-name', /overflow-wrap:\s*anywhere/]]],
    // every sheet: its body is one column as wide as the sheet, and its words break before they overflow
    ['a sheet\u2019s body', '../../styles/ui.css', '.sheet-body', [['.sheet-body', /overflow-wrap:\s*break-word/]]],
    ['a sheet\u2019s title block', '../../styles/foundation.css', '.sheet-titles', [['.sheet-eyebrow', /overflow-wrap:\s*anywhere/]]],
    ['a sheet\u2019s title and eyebrow', '../../styles/foundation.css', '.sheet-titles-in', []],
    // the Move sheet (the session's name in its first line) and the session sheet's notes (a pasted link)
    ['the Move sheet', '../sessions/sessions.css', '.mv2', []],
    ['the session sheet\u2019s notes', '../sessions/sessions.css', '.ss-words.card', []],
  ];
  for (const [what, file, box, words] of rows) {
    it(`${what}: its text column can be narrower than its longest word`, () => {
      const sheet = css(file);
      const b = rule(sheet, box);
      expect(b).toMatch(/display:\s*grid/);
      expect(b).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
      for (const [sel, how] of words) expect(rule(sheet, sel), sel).toMatch(how);
    });
  }
});
