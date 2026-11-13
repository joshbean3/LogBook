import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hueOf, lightnessOf, mix, toHex, toLab, WHITE } from './color';
import { GEM_KEYS, gemBox, gemFor, gemName, gemSvg, gemUrl, OrbGem, type Gem, type GemHue, type GemStyle } from './index';
import { sphereOf } from './svg';
import { HUES, SHIFTS, TOKEN } from './table';

const every = (): Gem[] => {
  const out: Gem[] = [];
  for (const key of GEM_KEYS) for (const shift of SHIFTS) for (const stars of key.startsWith('fused') ? [0, 1, 4, 7] : [undefined]) out.push({ ...gemFor(key, undefined, { stars }), shift });
  return out;
};

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

describe('the family table', () => {
  const rows: Array<[string, GemHue, GemStyle, string]> = [
    ['todo', 'lagoon', 'plain', 'A to-do'],
    ['habit', 'apricot', 'plain', 'A habit'],
    ['train:run', 'deepsky', 'plain', 'A run'],
    ['train:lift', 'indigo', 'plain', 'A lift'],
    ['train:cross', 'ochre', 'plain', 'Cross-training'],
    ['goal:day', 'gold', 'ring1', 'Today’s goal'],
    ['goal:week:2026-11-09', 'gold', 'ring1', 'A week goal'],
    ['goal:month:2026-11', 'gold', 'ring2', 'A month goal'],
    ['goal:year:2026', 'gold', 'ring3', 'A year goal'],
    ['full', 'pearl', 'plain', 'A full day'],
    ['week:2026-11-09', 'dusk', 'banded', 'A week that counts'],
    ['challenge:d:2026-11-13', 'plum', 'half', 'A challenge'],
    ['challenge:w:2026-11-09', 'plum', 'half', 'A challenge'],
    ['back', 'rose', 'plain', 'Good to see you'],
    ['fused:week', 'night', 'starred', 'An earlier week'],
    ['fused:chapter', 'night', 'starred-ring1', 'An earlier chapter'],
    ['fused:year', 'night', 'starred-ring2', 'An earlier year'],
  ];
  it.each(rows)('%s is %s, %s, "%s"', (key, hue, style, name) => {
    const g = gemFor(key);
    expect(g.hue).toBe(hue);
    expect(g.style).toBe(style);
    expect(g.shift).toBe(0);
    expect(gemName(key)).toBe(name);
  });
  it('draws a key it does not know as a plain Orb, never as nothing', () => {
    expect(gemFor('something:new')).toEqual({ hue: 'apricot', style: 'plain', shift: 0 });
    expect(gemName('something:new')).toBe('An Orb');
    // a prefix is a whole part of the key: "weekly" is not "week"
    expect(gemFor('weekly').hue).toBe('apricot');
  });
  it('no Orb of the family is the logo’s Sky', () => {
    const sky = TOKEN['--sky'];
    for (const hue of Object.keys(HUES) as GemHue[]) for (const shift of SHIFTS) expect(sphereOf(hue, shift).body[3]!.toLowerCase()).not.toBe(sky.toLowerCase());
    // a run is Deep Sky: visibly darker than the logo's body at every shift
    for (const shift of SHIFTS) expect(lightnessOf(sphereOf('deepsky', shift).body[3]!)).toBeLessThan(lightnessOf(sky) - 0.12);
  });
  it('names never use a word the brand does not', () => {
    for (const key of GEM_KEYS) expect(gemName(key)).not.toMatch(/jar|marble|coin|point|XP|streak|AI\b|coach|bot|—/i);
  });
});

describe('the shift', () => {
  it('is the same for the same seed, one of five steps, and 0 without a seed', () => {
    const a = gemFor('habit', 'habit|2026-11-13|0');
    expect(gemFor('habit', 'habit|2026-11-13|0')).toEqual(a);
    expect(SHIFTS).toContain(a.shift);
    expect(gemFor('habit').shift).toBe(0);
  });
  it('spreads a pile: forty habits take every step, none more than half', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 40; i++) {
      const s = gemFor('habit', `habit|2026-11-${String(1 + (i % 28)).padStart(2, '0')}|${i}`).shift;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    expect(counts.size).toBe(SHIFTS.length);
    for (const n of counts.values()) expect(n).toBeLessThan(20);
  });
  it('is small: a shifted Orb stays nearer its own kind than any other plain hue', () => {
    const plain: GemHue[] = ['lagoon', 'apricot', 'deepsky', 'indigo', 'ochre', 'rose', 'gold', 'plum'];
    const dist = (x: string, y: string) => {
      const p = toLab(x);
      const q = toLab(y);
      return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
    };
    for (const hue of plain)
      for (const shift of SHIFTS) {
        const mine = sphereOf(hue, shift).body[3]!;
        const own = dist(mine, sphereOf(hue, 0).body[3]!);
        for (const other of plain) if (other !== hue) expect(own, `${hue} ${shift} vs ${other}`).toBeLessThan(dist(mine, sphereOf(other, 0).body[3]!) / 2);
      }
    // and a habit never drifts to a goal's gold
    const habit = hueOf(sphereOf('apricot', 1).body[3]!);
    const habit2 = hueOf(sphereOf('apricot', -1).body[3]!);
    const gold = hueOf(sphereOf('gold', 0).body[3]!);
    expect(Math.abs(habit - gold)).toBeGreaterThan(10);
    expect(Math.abs(habit2 - gold)).toBeGreaterThan(10);
  });
  it('gives fused Orbs their stars: 0 to 7, seven when not told', () => {
    expect(gemFor('fused:week').stars).toBe(7);
    expect(gemFor('fused:week', 's', { stars: 3 }).stars).toBe(3);
    expect(gemFor('fused:week', 's', { stars: 12 }).stars).toBe(7);
    expect(gemFor('fused:week', 's', { stars: -2 }).stars).toBe(0);
    expect(gemFor('habit', 's', { stars: 3 }).stars).toBeUndefined();
  });
});

describe('the art', () => {
  it('is one well-formed SVG under 4 KB with nothing fetched, no script and no font', () => {
    for (const gem of every()) {
      const svg = gemSvg(gem);
      const id = `${gem.hue} ${gem.style} ${gem.shift} ${gem.stars ?? ''}`;
      expect(svg.length, id).toBeLessThan(4096);
      expect(wellFormed(svg), id).toBe(true);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" ')).toBe(true);
      expect(svg).not.toMatch(/<script|<foreignObject|<image|<use|<text|font|href|@import|javascript:/i);
      // every url() points inside the document
      for (const m of svg.matchAll(/url\(([^)]*)\)/g)) expect(m[1]).toMatch(/^#[a-z]$/);
      for (const m of svg.matchAll(/url\(#([a-z])\)/g)) expect(svg, id).toContain(`id="${m[1]}"`);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it('keeps the logo’s lighting on every Orb: the body, the warm underlight, the limb glow, the specular, the edge', () => {
    for (const gem of every()) {
      const svg = gemSvg(gem);
      for (const part of ['fill="url(#b)"', 'fill="url(#a)"', 'fill="url(#k)"', 'fill="url(#s)"', 'stroke="url(#r)"']) expect(svg).toContain(part);
      expect(svg).toContain('<ellipse cx="50" cy="22" rx="27" ry="15"');
    }
  });
  it('centers the sphere: the box is the diameter for a plain Orb and more where rings or a halo reach outside', () => {
    for (const gem of every()) {
      const box = gemBox(gem);
      const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(gemSvg(gem))!.slice(1).map(Number);
      expect(vb[2]).toBeCloseTo(96 * box, 1);
      expect(vb[3]).toBe(vb[2]);
      expect(vb[0]! + vb[2]! / 2).toBeCloseTo(50, 1);
      expect(vb[1]! + vb[3]! / 2).toBeCloseTo(50, 1);
    }
    expect(gemBox(gemFor('habit'))).toBe(1);
    expect(gemBox(gemFor('week:2026-11-09'))).toBe(1);
    expect(gemBox(gemFor('challenge:d:2026-11-13'))).toBe(1);
    expect(gemBox(gemFor('fused:week'))).toBe(1);
    expect(gemBox(gemFor('full'))).toBeGreaterThan(1.2);
    const [one, two, three] = ['goal:day', 'goal:month:2026-11', 'goal:year:2026'].map((k) => gemBox(gemFor(k))) as [number, number, number];
    expect(one).toBeGreaterThan(1.2);
    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
    expect(three).toBeLessThan(1.7);
    expect(gemBox(gemFor('fused:chapter'))).toBe(one);
    expect(gemBox(gemFor('fused:year'))).toBe(two);
  });
  it('marks each style so the kind is told without the hue', () => {
    const marks = (key: string, o?: { stars?: number }) => {
      const svg = gemSvg(gemFor(key, undefined, o));
      return { rings: (svg.match(/A[\d.]+ [\d.]+ 0 0 0 /g) ?? []).length, bands: svg.includes('Q50 60'), shadow: svg.includes('filter="url(#t)"'), stars: (/<path d="([^"]+)" fill="#[0-9a-fA-F]{6}" opacity="\.94"/.exec(svg)?.[1]?.match(/M/g) ?? []).length, halo: svg.includes('url(#h)') };
    };
    expect(marks('habit')).toEqual({ rings: 0, bands: false, shadow: false, stars: 0, halo: false });
    expect(marks('goal:day').rings).toBe(1);
    expect(marks('goal:week:2026-11-09').rings).toBe(1);
    expect(marks('goal:month:2026-11').rings).toBe(2);
    expect(marks('goal:year:2026').rings).toBe(3);
    expect(marks('full').halo).toBe(true);
    expect(marks('week:2026-11-09').bands).toBe(true);
    expect(marks('challenge:w:2026-11-09').shadow).toBe(true);
    expect(marks('fused:week', { stars: 5 })).toEqual({ rings: 0, bands: false, shadow: false, stars: 5, halo: false });
    expect(marks('fused:week', { stars: 0 }).stars).toBe(0);
    expect(marks('fused:chapter')).toMatchObject({ rings: 1, stars: 7 });
    expect(marks('fused:year')).toMatchObject({ rings: 2, stars: 7 });
  });
  it('hands out one cached data URL per gem', () => {
    const a = gemUrl(gemFor('habit'));
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(gemUrl({ hue: 'apricot', style: 'plain', shift: 0 })).toBe(a);
    expect(gemUrl(gemFor('habit', 'x1'))).toBe(gemUrl(gemFor('habit', 'x1')));
    expect(gemUrl(gemFor('todo'))).not.toBe(a);
    expect(gemUrl(gemFor('fused:week', undefined, { stars: 2 }))).not.toBe(gemUrl(gemFor('fused:week', undefined, { stars: 3 })));
    // nothing a URL cannot carry
    expect(a.slice(a.indexOf(',') + 1)).not.toMatch(/[#<>"]/);
    const back = decodeURIComponent(a.slice(a.indexOf(',') + 1)).replace(/'/g, '"');
    expect(back).toBe(gemSvg(gemFor('habit')));
  });
});

describe('the palette', () => {
  it('is the token file’s own values', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../../styles/tokens.css'), 'utf8');
    const root = css.slice(0, css.indexOf('@media'));
    for (const [name, hex] of Object.entries(TOKEN)) {
      const m = new RegExp(`\\n\\s*${name}:\\s*(#[0-9a-fA-F]{6})`).exec(root);
      expect(m?.[1]?.toLowerCase(), name).toBe(hex.toLowerCase());
    }
  });
  it('goes to OKLab and back, and mixes', () => {
    for (const hex of Object.values(TOKEN)) expect(toHex(toLab(hex))).toBe(hex.toLowerCase());
    expect(WHITE).toBe('#ffffff');
    expect(mix(TOKEN['--apricot'], WHITE, 0)).toBe(TOKEN['--apricot'].toLowerCase());
    expect(mix(TOKEN['--apricot'], WHITE, 1)).toBe('#ffffff');
  });
  it('keeps the warm underlight visible on the warm bodies', () => {
    // the light at the bottom is lighter than the body it lies on, by enough to be seen
    for (const hue of ['apricot', 'gold', 'rose', 'ochre'] as const) {
      const s = sphereOf(hue);
      expect(lightnessOf(s.under[0]!) - lightnessOf(s.body[4]!), hue).toBeGreaterThan(0.1);
    }
  });
});

describe('OrbGem', () => {
  it('is the sphere’s size, hidden from VoiceOver unless it is named', () => {
    const html = renderToStaticMarkup(<OrbGem gem={gemFor('goal:day')} size={22} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('--og:22px');
    expect(html).toContain(`--ob:${gemBox(gemFor('goal:day'))}`);
    expect(html).toContain('<img');
    const named = renderToStaticMarkup(<OrbGem gem={gemFor('habit')} size={20} label="A habit" className="x" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="A habit"');
    expect(named).not.toContain('aria-hidden');
    expect(named).toContain('class="orb-gem x"');
  });
});
