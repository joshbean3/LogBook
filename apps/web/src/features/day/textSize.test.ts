import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * a11y-02: Larger Text. The app scales its root font size with the phone's text size (app/dynamicType.ts), so only type
 * set in rem follows it. A font size or a line height in px stays fixed while everything round it grows. This keeps px out
 * of the type in Today, the Morning page and the session sheets. A px value is allowed only as the floor or the ceiling of
 * a `clamp()` whose middle is in rem (a display numeral that may grow, to a limit).
 */
const here = dirname(fileURLToPath(import.meta.url));
const dirs = [here, join(here, '../morning'), join(here, '../sessions')];
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.css')).map((f) => join(d, f)));

/** The px lengths in a font declaration that are not inside a clamp() with a rem (or token) middle. */
const fixedPx = (value: string): string[] => {
  const withoutClamps = value.replace(/clamp\(\s*[\d.]+px\s*,\s*(?:[\d.]+rem|var\(--(?:fs|lh|tl)-[a-z-]+\))\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g, '');
  return withoutClamps.match(/[\d.]+px/g) ?? [];
};

describe('type in Today, Morning and the session sheets follows the text size (a11y-02)', () => {
  it('finds the stylesheets', () => {
    expect(files.map((f) => f.split('/').pop()).sort()).toEqual(['day.css', 'daypicker.css', 'effort.css', 'morning.css', 'sessions.css']);
  });
  for (const file of files) {
    it(`${file.split('/').slice(-2).join('/')} has no px font size or line height`, () => {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const bad: string[] = [];
      for (const m of css.matchAll(/(?:^|[;{\s])(font|font-size|line-height|--tl-[a-z-]+)\s*:\s*([^;}]+)/g)) {
        const px = fixedPx(m[2]!);
        if (px.length) bad.push(`${m[1]}: ${m[2]!.trim()}`);
      }
      expect(bad).toEqual([]);
    });
  }
  it('knows a fixed px from a bounded clamp', () => {
    expect(fixedPx('600 11px/13px var(--sans)')).toEqual(['11px', '13px']);
    expect(fixedPx('800 clamp(44px, 2.75rem, 60px) / clamp(50px, 3.125rem, 68px) var(--stamp)')).toEqual([]);
    expect(fixedPx('clamp(11px, var(--fs-caps), max(11px, 3.9cqi))')).toEqual([]);
    expect(fixedPx('clamp(12px, 14px, 16px)')).toEqual(['12px', '14px', '16px']);
  });
});
