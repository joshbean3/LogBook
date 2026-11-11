import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Text follows the phone's text size: the root font size is scaled, so every size and line height here is in rem (the
 * --fs-* and --lh-* tokens). A px size would stay put while the text around it grows. The one exception is a px bound
 * inside clamp(), for a glyph in a fixed ring or a field that must not drop under 16px.
 */
const here = dirname(fileURLToPath(import.meta.url));
const folders = ['../dayplan', '../habits', '../todos'];

describe('text sizes in the day plan, habits and to-dos follow the text size setting', () => {
  for (const folder of folders) {
    const dir = join(here, folder);
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
      it(`${folder.slice(3)}/${file} has no px font size or line height`, () => {
        const css = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        const bad = [...css.matchAll(/(?:^|[;{\s])(font-size|line-height|font)\s*:\s*([^;}]+)/g)]
          .map((m) => `${m[1]}: ${m[2]!.trim()}`)
          // a clamp() may hold a token, var(--fs-row): one level of parentheses inside it
          .filter((d) => /\dpx/.test(d.replace(/clamp\((?:[^()]|\([^()]*\))*\)/g, '')));
        expect(bad).toEqual([]);
      });
    }
  }
});
