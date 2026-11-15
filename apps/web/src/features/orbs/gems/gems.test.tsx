import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GEM_KEYS, gemBox, gemFor, gemName, gemSvg, gemUrl, LADDER, OrbGem, rungName, rungOf, RUNGS, type Gem, type Rung } from './index';
import { INK, LOGO, MOVES, recipeOf, RING } from './recipe';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
const gem = (rung: Rung): Gem => ({ rung });

/** Every tag closes in order, every attribute is quoted, and there is one root (the tests run with no DOM). */
const wellFormed = (svg: string): boolean => {
  const open: string[] = [];
  let roots = 0;
  let at = 0;
  const tag = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*="[^"<>]*")*)\s*(\/?)>/y;
  while (at < svg.length) {
    tag.lastIndex = at;
    const m = tag.exec(svg);
    if (!m) return false;
    at = tag.lastIndex;
    if (m[1]) {
      if (open.pop() !== m[2]) return false;
    } else {
      if (!open.length) roots++;
      if (!m[4]) open.push(m[2]!);
    }
  }
  return open.length === 0 && roots === 1;
};
const colorsIn = (svg: string): string[] => [...new Set([...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()))];

/**
 * A drawing as what it draws, so two files that say the same thing compare equal however they are written: every tag
 * in order with its attributes sorted, numbers as numbers (".34" is "0.340"), colors in one case, ids renamed by the
 * order they are first used, and the definitions nothing uses left out. The root's own attributes but its viewBox, and
 * the space between tags, are not the drawing.
 */
const drawingOf = (svg: string): string[] => {
  const tags = [...svg.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*="[^"]*")*)\s*(\/?)>/g)];
  const used = new Set([...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]!));
  const names = new Map<string, string>();
  const nameOf = (id: string) => names.get(id) ?? (names.set(id, `id${names.size}`), names.get(id)!);
  // names in the order of use in the body, which both files draw in the same order
  const body = svg.slice(svg.indexOf('</defs>'));
  for (const m of body.matchAll(/url\(#([^)]+)\)/g)) nameOf(m[1]!);
  const value = (v: string): string =>
    v
      .replace(/url\(#([^)]+)\)/g, (_m, id: string) => `url(#${nameOf(id)})`)
      .replace(/#[0-9a-fA-F]{3,6}\b/g, (c) => (c.length === 4 ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c).toLowerCase())
      .replace(/(?<![#\w])-?\d*\.?\d+(?![\w)])/g, (n) => String(Number(n)));
  const out: string[] = [];
  let skip = 0;
  for (const m of tags) {
    const [, close, name, attrs, self] = m;
    if (skip) {
      if (!self) skip += close ? -1 : 1;
      continue;
    }
    const map = new Map([...attrs!.matchAll(/([a-zA-Z][a-zA-Z0-9:-]*)="([^"]*)"/g)].map((a) => [a[1]!, a[2]!] as const));
    const id = map.get('id');
    if (!close && id && !used.has(id)) {
      if (!self) skip = 1;
      continue;
    }
    if (close) {
      out.push(`/${name}`);
      continue;
    }
    if (name === 'svg') {
      out.push(`svg viewBox=${map.get('viewBox')}`);
      continue;
    }
    if (id) map.set('id', nameOf(id));
    out.push(`${name} ${[...map].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${value(v)}`).join(' ')}${self ? ' /' : ''}`);
  }
  return out;
};

describe('the ladder', () => {
  const rows: Array<[string, Rung, string]> = [
    ['todo', 1, 'A to-do'],
    ['habit', 1, 'A habit'],
    ['train:run', 2, 'A run'],
    ['train:lift', 2, 'A lift'],
    ['train:cross', 2, 'Cross-training'],
    ['goal:day', 2, 'Today’s goal'],
    ['full', 2, 'A full day'],
    ['back', 2, 'Good to see you'],
    ['week:2026-11-09', 3, 'A week that counts'],
    ['goal:week:2026-11-09', 3, 'A week goal'],
    ['challenge:d:2026-11-13', 3, 'A challenge'],
    ['challenge:w:2026-11-09', 3, 'A challenge'],
    ['goal:month:2026-11', 4, 'A month goal'],
    ['goal:year:2026', 5, 'A year goal'],
    ['fused:week', 1, 'An earlier week'],
    ['fused:chapter', 1, 'An earlier chapter'],
    ['fused:year', 1, 'An earlier year'],
  ];
  it.each(rows)('%s is rung %i, "%s"', (key, rung, name) => {
    expect(rungOf(key)).toBe(rung);
    expect(gemFor(key)).toEqual({ rung });
    expect(gemName(key)).toBe(name);
  });
  it('has five rungs, named for a sun coming up', () => {
    expect(RUNGS).toEqual([1, 2, 3, 4, 5]);
    expect(RUNGS.map(rungName)).toEqual(['Sky', 'Dawn', 'Glow', 'Sunrise', 'Sun']);
    for (const r of RUNGS) {
      expect(LADDER[r].often).toMatch(/^[A-Z]/);
      expect(LADDER[r].earnedBy(true)).toMatch(/^[A-Z]/);
    }
    // with Fitness off a session is never named
    expect(LADDER[2].earnedBy(true)).toContain('session');
    for (const r of RUNGS) expect(LADDER[r].earnedBy(false)).not.toMatch(/session|run|lift|train/i);
  });
  it('draws a key it does not know as the plainest Orb, never as nothing', () => {
    expect(gemFor('something:new')).toEqual({ rung: 1 });
    expect(gemName('something:new')).toBe('An Orb');
    // a prefix is a whole part of the key: "weekly" is not "week"
    expect(rungOf('weekly')).toBe(1);
    // a session of a kind this build does not name is still a session
    expect(rungOf('train:swim')).toBe(2);
    expect(gemName('train:swim')).toBe('A session');
    // and a gem from somewhere else (an older build's, a test's) is still a picture: the logo's
    const old = gemSvg({ hue: 'night', style: 'starred', shift: 0.5 } as unknown as Gem);
    expect(wellFormed(old)).toBe(true);
    expect(old).toBe(gemSvg(gem(1)));
    expect(gemBox({ rung: 9 } as unknown as Gem)).toBe(gemBox(gem(1)));
  });
  it('gives two Orbs of a rung the same picture: no tint of an Orb’s own', () => {
    expect(gemFor('habit', 'habit|2026-11-13|0')).toEqual(gemFor('habit', 'habit|2026-11-14|7'));
    expect(gemSvg(gemFor('habit', 'a'))).toBe(gemSvg(gemFor('todo', 'b')));
    expect(gemUrl(gemFor('train:run'))).toBe(gemUrl(gemFor('full')));
  });
  it('makes a fused Orb a Sky Orb, and a Dawn Orb when what it holds counted', () => {
    expect(gemFor('fused:week', 'w', { counted: false })).toEqual({ rung: 1 });
    for (const key of ['fused:week', 'fused:chapter', 'fused:year']) expect(gemFor(key, 'x', { counted: true })).toEqual({ rung: 2 });
    // only a fused one: a habit is a Sky Orb whatever is said of it
    expect(gemFor('habit', 'x', { counted: true })).toEqual({ rung: 1 });
    expect(gemFor('goal:month:2026-11', 'x', { counted: true })).toEqual({ rung: 4 });
  });
  it('names never use a word the brand does not', () => {
    const words = [...GEM_KEYS.map(gemName), ...RUNGS.flatMap((r) => [rungName(r), LADDER[r].often, LADDER[r].earnedBy(true), LADDER[r].earnedBy(false)])];
    for (const w of words) expect(w).not.toMatch(/jar|marble|coin|point|XP|streak|AI\b|coach|bot\b|common|rare|epic|legend|shiny|card|pack|—/i);
  });
});

describe('rung 1 is the logo', () => {
  it('draws what ui/orb/logo-mark.svg draws, number for number', () => {
    const logo = read('../../../ui/orb/logo-mark.svg');
    expect(drawingOf(gemSvg(gem(1)))).toEqual(drawingOf(logo));
    // the comparison can fail: a drawing with one number moved is another drawing
    expect(drawingOf(gemSvg(gem(1)).replace('stdDeviation="2.5"', 'stdDeviation="2.6"'))).not.toEqual(drawingOf(logo));
    expect(drawingOf(gemSvg(gem(2)))).not.toEqual(drawingOf(logo));
  });
  it('is the same at every size, in the logo’s own box', () => {
    expect(gemSvg(gem(1), 20)).toBe(gemSvg(gem(1), 96));
    expect(gemSvg(gem(1))).toContain('viewBox="0 0 100 100"');
    expect(gemBox(gem(1))).toBeCloseTo(100 / 96, 6);
    expect(recipeOf(1)).toBe(LOGO);
  });
});

describe('the art', () => {
  it('is one well-formed SVG with nothing fetched, no script and no font', () => {
    for (const r of RUNGS)
      for (const px of [undefined, 20, 44]) {
        const svg = gemSvg(gem(r), px);
        expect(svg.length, `${r}`).toBeLessThan(5200);
        expect(wellFormed(svg), `${r}`).toBe(true);
        expect(svg).not.toMatch(/<script|<foreignObject|<image|<use|<text|font|href|@import|javascript:|style=/i);
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
        // every gradient, mask, filter and clip it names is its own
        const ids = new Set([...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
        for (const m of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids.has(m[1]), `${r} ${m[1]}`).toBe(true);
      }
  });
  it('is the logo’s sphere at every rung: the same specular and clip, one sphere of r 48 at the middle', () => {
    for (const r of RUNGS) {
      const svg = gemSvg(gem(r));
      expect(svg, `${r}`).toContain(`<circle cx="50" cy="50" r="48" fill="url(#o${r}b)"/>`);
      expect(svg, `${r}`).toContain('<ellipse cx="50" cy="22" rx="27" ry="15"');
      expect(svg, `${r}`).toContain('<circle cx="50" cy="50" r="47.6" fill="none"');
      expect(recipeOf(r).spec).toBe(LOGO.spec);
      // blue stays the body's color up to rung 4; rung 5 is the one warm body, and keeps the logo's cool top
      if (r < 5) expect(recipeOf(r).body).toBe(LOGO.body);
      else expect(recipeOf(r).body.slice(0, 2)).toEqual(LOGO.body.slice(0, 2));
    }
  });
  it('climbs by more than hue: a glow from rung 3, a ring at 4, two at 5', () => {
    const glowOf = (r: Rung) => recipeOf(r).glow;
    expect(glowOf(1)).toBeUndefined();
    expect(glowOf(2)).toBeUndefined();
    for (const r of [3, 4, 5] as const) expect(gemSvg(gem(r))).toMatch(/^<svg[^>]*><defs>.*<\/defs><ellipse /);
    // each glow is wider, taller and stronger than the one below it
    for (const [lo, hi] of [[3, 4], [4, 5]] as const) {
      expect(glowOf(hi)!.rx).toBeGreaterThan(glowOf(lo)!.rx);
      expect(glowOf(hi)!.ry).toBeGreaterThan(glowOf(lo)!.ry);
      expect(glowOf(hi)!.stops[0]![2]!).toBeGreaterThan(glowOf(lo)!.stops[0]![2]!);
    }
    expect(RUNGS.map((r) => recipeOf(r).rings.length)).toEqual([0, 0, 0, 1, 2]);
    // the light rises: the warm dome under the sphere reaches higher at each rung up to 4
    const top = (r: Rung) => recipeOf(r).under.cy - recipeOf(r).under.r;
    expect(top(1)).toBeGreaterThan(top(2));
    expect(top(2)).toBeGreaterThan(top(3));
    expect(top(3)).toBeGreaterThan(top(4));
    expect(MOVES[2].rise).toEqual([1, 1]);
  });
  it('keeps Sunrise the color scarce: only in rung 4’s base and rung 5’s body', () => {
    const sunrise = INK.sunrise.toLowerCase();
    for (const r of RUNGS) expect(colorsIn(gemSvg(gem(r), 24)).includes(sunrise), `${r}`).toBe(r >= 4);
    expect(recipeOf(4).body).toBe(LOGO.body);
    expect(recipeOf(5).body.at(-1)![1]).toBe(INK.sunrise);
  });
  it('holds everything inside its box: the logo’s for a plain Orb, the brand’s glow box from rung 3', () => {
    expect(RUNGS.map((r) => Math.round(gemBox(gem(r)) * 96))).toEqual([100, 100, 150, 150, 150]);
    for (const r of [3, 4, 5] as const) {
      const svg = gemSvg(gem(r), 20);
      expect(svg).toContain('viewBox="-25 -25 150 150"');
      const g = recipeOf(r, 20).glow!;
      expect(50 - g.rx).toBeGreaterThanOrEqual(-25);
      expect(g.cy + g.ry).toBeLessThanOrEqual(125);
      expect(g.cy - g.ry).toBeGreaterThanOrEqual(-25);
      for (const ring of recipeOf(r, 20).rings) expect(ring.r + ring.w / 2).toBeLessThanOrEqual(75);
    }
  });
  it('draws a ring as a hairline: one px at the size it is shown at', () => {
    for (const px of [20, 24, 32, 44]) for (const ring of recipeOf(5, px).rings) expect((ring.w / 96) * px).toBeGreaterThan(0.9);
    for (const px of [24, 32, 44, 64]) for (const ring of recipeOf(4, px).rings) expect((ring.w / 96) * px).toBeCloseTo(1, 1);
    // never a band: 1.5 px at 96
    expect(recipeOf(4, 96).rings[0]!.w).toBe(RING.min);
    expect(recipeOf(4, 8).rings[0]!.w).toBe(RING.max);
    // a ring stands clear of the sphere, and the second clear of the first
    const [a, b] = recipeOf(5, 20).rings;
    expect(a!.r - a!.w / 2).toBeGreaterThan(48 + 4);
    expect(b!.r - b!.w / 2).toBeGreaterThan(a!.r + a!.w / 2 + 4);
    expect(b!.opacity).toBeLessThan(a!.opacity);
    // only an Orb with rings is drawn anew for a size
    expect(gemSvg(gem(3), 20)).toBe(gemSvg(gem(3), 44));
    expect(gemSvg(gem(4), 20)).not.toBe(gemSvg(gem(4), 44));
  });
  it('hands out one cached data URL per rung', () => {
    const a = gemUrl(gem(1));
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(gemUrl({ rung: 1 })).toBe(a);
    expect(gemUrl(gem(2))).not.toBe(a);
    expect(gemUrl(gem(5), 22)).toBe(gemUrl(gem(5), 22));
    // nothing a URL cannot carry
    for (const r of RUNGS) {
      const u = gemUrl(gem(r), 22);
      expect(u.slice(u.indexOf(',') + 1)).not.toMatch(/[#<>"]/);
      expect(decodeURIComponent(u.slice(u.indexOf(',') + 1)).replace(/'/g, '"')).toBe(gemSvg(gem(r), 22));
    }
  });
});

describe('the palette', () => {
  const tokens = read('../../../styles/tokens.css');
  const root = tokens.slice(0, tokens.indexOf('@media'));
  const token = (name: string) => new RegExp(`\\n\\s*${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root)?.[1]?.toLowerCase();
  it('names its tokens by the token file’s own values', () => {
    expect(INK.sky.toLowerCase()).toBe(token('--sky'));
    expect(INK.apricot.toLowerCase()).toBe(token('--apricot'));
    expect(INK.sunrise.toLowerCase()).toBe(token('--sunrise'));
    expect(INK.ember.toLowerCase()).toBe(token('--ember'));
    expect(INK.white.toLowerCase()).toBe(token('--white'));
  });
  it('types no color of its own: each is a token or a value of the brand’s own Orb files', () => {
    const brand = new Set([...colorsIn(read('../../../ui/orb/logo-mark.svg')), ...colorsIn(read('../../../ui/orb/logo-mark-sunrise.svg')), token('--sunrise')!]);
    for (const [name, hex] of Object.entries(INK)) expect(brand.has(hex.toLowerCase()), `${name} ${hex}`).toBe(true);
    for (const r of RUNGS) for (const c of colorsIn(gemSvg(gem(r), 24))) expect(brand.has(c), `rung ${r} ${c}`).toBe(true);
  });
  it('takes the upper rungs’ light from the brand’s sunrise drawing', () => {
    // rung 2 is that drawing's sphere without its glow: the same two domes of light and the same edge, number for number
    const sunrise = read('../../../ui/orb/logo-mark-sunrise.svg');
    const dawn = gemSvg(gem(2));
    const grad = (svg: string, cy: number) => new RegExp(`<radialGradient[^>]*cy="${cy}"[^>]*>(.*?)</radialGradient>`).exec(svg.replace(/\n/g, ''));
    for (const cy of [104, 106, 100]) {
      const [a, b] = [grad(sunrise, cy), grad(dawn, cy)];
      expect(a && b, `${cy}`).toBeTruthy();
      expect(drawingOf(`<svg><defs></defs>${b![0].replace(/id="[^"]+"/, '')}</svg>`)).toEqual(drawingOf(`<svg><defs></defs>${a![0].replace(/id="[^"]+"/, '')}</svg>`));
    }
  });
});

describe('OrbGem', () => {
  it('is the sphere’s size, with a picture as large as its box, hidden from VoiceOver unless it is named', () => {
    const html = renderToStaticMarkup(<OrbGem gem={gemFor('goal:day')} size={22} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('--og:22px');
    expect(html).toContain(`--og-box:${gemBox(gem(2))}`);
    expect(html).toContain('<img');
    const named = renderToStaticMarkup(<OrbGem gem={gemFor('goal:year:2026')} size={32} label="Sun" className="x" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Sun"');
    expect(named).not.toContain('aria-hidden');
    expect(named).toContain('class="orb-gem x"');
    expect(named).toContain(`--og-box:${150 / 96}`);
  });
  it('never turns, clips or tints the picture in its own styles', () => {
    const css = read('./gem.css');
    expect(css).not.toMatch(/rotate|filter|overflow|opacity|animation|transition/);
    expect(css).toMatch(/width: calc\(var\(--og\) \* var\(--og-box\)\)/);
  });
});
