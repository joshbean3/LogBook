import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { contrast, mix, toHex, toLab, TONE, toneOf, WHITE } from './color';
import { GEM_KEYS, gemBox, gemFor, gemName, gemSvg, gemUrl, OrbGem, type Gem } from './index';
import { colorOf, FORM, gemInk } from './svg';
import { HUES, LINE, SHIFTS, TOKEN, type FormHue, type FormStyle } from './table';

const every = (): Gem[] => {
  const out: Gem[] = [];
  for (const key of GEM_KEYS) for (const shift of SHIFTS) out.push({ ...gemFor(key), shift });
  return out;
};
const idOf = (g: Gem) => `${g.hue} ${g.style} ${g.shift}`;

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
const colorsIn = (svg: string): string[] => [...new Set([...svg.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase()))];
const hueDeg = (hex: string) => {
  const p = toLab(hex);
  return ((Math.atan2(p.b, p.a) * 180) / Math.PI + 360) % 360;
};

describe('the table', () => {
  const rows: Array<[string, FormHue, FormStyle, string]> = [
    ['todo', 'deepsky', 'disc', 'A to-do'],
    ['habit', 'apricot', 'lit', 'A habit'],
    ['train:run', 'lagoon', 'orbit', 'A run'],
    ['train:lift', 'indigo', 'orbit', 'A lift'],
    ['train:cross', 'ochre', 'orbit', 'Cross-training'],
    ['goal:day', 'sky', 'target1', 'Today’s goal'],
    ['goal:week:2026-11-09', 'sky', 'target2', 'A week goal'],
    ['goal:month:2026-11', 'sky', 'target3', 'A month goal'],
    ['goal:year:2026', 'sky', 'target4', 'A year goal'],
    ['full', 'apricot', 'sunrise', 'A full day'],
    ['week:2026-11-09', 'deepsky', 'seven', 'A week that counts'],
    ['challenge:d:2026-11-13', 'plum', 'crescent', 'A challenge'],
    ['challenge:w:2026-11-09', 'plum', 'crescent', 'A challenge'],
    ['back', 'rose', 'open', 'Good to see you'],
    ['fused:week', 'haze', 'pale', 'An earlier week'],
    ['fused:chapter', 'hill', 'pale-ring', 'An earlier chapter'],
    ['fused:year', 'deepsky', 'disc-rings', 'An earlier year'],
  ];
  it.each(rows)('%s is %s, %s, "%s"', (key, hue, style, name) => {
    const g = gemFor(key);
    expect(g.hue).toBe(hue);
    expect(g.style).toBe(style);
    expect(g.shift).toBe(0);
    expect(gemName(key)).toBe(name);
  });
  it('draws a key it does not know as the plain disc, never as nothing', () => {
    expect(gemFor('something:new')).toEqual({ hue: 'deepsky', style: 'disc', shift: 0 });
    expect(gemName('something:new')).toBe('An Orb');
    // a prefix is a whole part of the key: "weekly" is not "week"
    expect(gemFor('weekly').style).toBe('disc');
    // and a gem from somewhere else (an older build's, a test's) is still a picture
    const old = gemSvg({ hue: 'night', style: 'starred', shift: 0.5, stars: 3 });
    expect(wellFormed(old)).toBe(true);
    expect(old).toBe(gemSvg({ hue: 'deepsky', style: 'disc', shift: 0.5 }));
  });
  it('no silhouette is used by two kinds, but for a session’s three', () => {
    const by = new Map<string, string[]>();
    for (const k of GEM_KEYS) by.set(gemFor(k).style, [...(by.get(gemFor(k).style) ?? []), k]);
    expect([...by.values()].filter((v) => v.length > 1)).toEqual([['train:run', 'train:lift', 'train:cross']]);
    expect(by.size).toBe(14);
  });
  it('names never use a word the brand does not', () => {
    for (const key of GEM_KEYS) expect(gemName(key)).not.toMatch(/jar|marble|coin|point|XP|streak|AI\b|coach|bot|—/i);
  });
  it('keeps an earlier week’s count of days with it: 0 to 7, seven when not told', () => {
    expect(gemFor('fused:week').stars).toBe(7);
    expect(gemFor('fused:week', 's', { stars: 3 }).stars).toBe(3);
    expect(gemFor('fused:week', 's', { stars: 12 }).stars).toBe(7);
    expect(gemFor('fused:week', 's', { stars: -2 }).stars).toBe(0);
    expect(gemFor('habit', 's', { stars: 3 }).stars).toBeUndefined();
    // the art does not draw it
    expect(gemSvg(gemFor('fused:week', undefined, { stars: 2 }))).toBe(gemSvg(gemFor('fused:week', undefined, { stars: 6 })));
  });
});

describe('the tint', () => {
  it('is the same for the same seed, one of three steps, and the token itself without a seed', () => {
    const a = gemFor('habit', 'habit|2026-11-13|0');
    expect(gemFor('habit', 'habit|2026-11-13|0')).toEqual(a);
    expect(SHIFTS).toEqual([-1, 0, 1]);
    expect(SHIFTS).toContain(a.shift);
    expect(gemFor('habit').shift).toBe(0);
    for (const key of GEM_KEYS) expect(colorOf(gemFor(key)), key).toBe(TOKEN[HUES[gemFor(key).hue as FormHue]].toLowerCase());
  });
  it('spreads a pile: forty habits take every step, none more than half', () => {
    const counts = new Map<number, number>();
    for (let i = 0; i < 40; i++) {
      const s = gemFor('habit', `habit|2026-11-${String(1 + (i % 28)).padStart(2, '0')}|${i}`).shift;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    expect(counts.size).toBe(SHIFTS.length);
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(20);
  });
  it('is the same color lighter or deeper by one step, never a hue turn', () => {
    for (const name of Object.values(HUES)) {
      const token = TOKEN[name];
      const [deep, light] = [toneOf(token, -1), toneOf(token, 1)];
      expect(toLab(deep).l, name).toBeCloseTo(toLab(token).l - TONE.step, 2);
      // the palest tokens reach the top of the scale before a whole step
      expect(toLab(light).l, name).toBeGreaterThan(toLab(token).l + TONE.step / 2);
      for (const hex of [deep, light]) expect(Math.abs(hueDeg(hex) - hueDeg(token)), `${name} ${hex}`).toBeLessThan(6);
      expect(toneOf(token, 0)).toBe(token.toLowerCase());
    }
  });
  it('holds every form with no edge of its own to 1.5:1 on Paper, at every tint', () => {
    const paper = TOKEN['--paper'];
    for (const gem of every()) {
      if (gem.style === 'pale' || gem.style === 'pale-ring') continue;
      expect(contrast(colorOf(gem), paper), idOf(gem)).toBeGreaterThanOrEqual(TONE.floor);
    }
    // Apricot is the one the floor holds back: its lighter tint is lighter than the token, and still seen
    const light = colorOf({ ...gemFor('habit'), shift: 1 });
    expect(toLab(light).l).toBeGreaterThan(toLab(TOKEN['--apricot']).l);
    expect(toLab(light).l).toBeLessThan(toLab(TOKEN['--apricot']).l + TONE.step);
    // a pale disc is held by its Deep Sky edge instead
    expect(contrast(TOKEN[LINE], paper)).toBeGreaterThan(4.5);
  });
  it('stays nearer its own token than any other kind’s color', () => {
    const dist = (x: string, y: string) => {
      const p = toLab(x);
      const q = toLab(y);
      return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
    };
    // the eight colors a kind is earned in (the two pale blues of the earlier forms are told by their edge)
    const hues = (Object.keys(HUES) as FormHue[]).filter((h) => h !== 'haze' && h !== 'hill');
    for (const hue of hues)
      for (const shift of SHIFTS) {
        const mine = toneOf(TOKEN[HUES[hue]], shift, TOKEN['--paper']);
        for (const other of hues) if (other !== hue) expect(dist(mine, TOKEN[HUES[hue]]), `${hue} ${shift} vs ${other}`).toBeLessThan(dist(mine, TOKEN[HUES[other]]));
      }
  });
});

describe('the art', () => {
  it('is one small well-formed SVG with nothing fetched, no script and no font', () => {
    for (const gem of every()) {
      const svg = gemSvg(gem);
      expect(svg.length, idOf(gem)).toBeLessThan(1024);
      expect(wellFormed(svg), idOf(gem)).toBe(true);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="2 2 96 96">')).toBe(true);
      expect(svg).not.toMatch(/<script|<foreignObject|<image|<use|<text|font|href|url\(|@import|javascript:/i);
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it('is flat: no gradient, no gloss, no shadow, no glow, no filter, no mask, nothing see-through but the gaps', () => {
    for (const gem of every()) expect(gemSvg(gem), idOf(gem)).not.toMatch(/Gradient|filter|feGaussianBlur|<mask|<defs|clip-path|opacity|<stop|<ellipse/);
  });
  it('is one color, and two only where the table says: the sunrise’s horizon and a pale disc’s edge, both Deep Sky', () => {
    const line = TOKEN[LINE].toLowerCase();
    for (const gem of every()) {
      const used = colorsIn(gemSvg(gem));
      const two = gem.style === 'sunrise' || gem.style === 'pale' || gem.style === 'pale-ring';
      expect(used, idOf(gem)).toEqual(two ? expect.arrayContaining([colorOf(gem), line]) : [colorOf(gem)]);
      expect(used.length, idOf(gem)).toBe(two ? 2 : 1);
    }
  });
  it('fills its circle and draws nothing outside it: the box is the diameter', () => {
    for (const gem of every()) expect(gemBox(gem)).toBe(1);
    // every circle and every ring ends inside r 48 at (50, 50)
    for (const gem of every())
      for (const m of gemSvg(gem).matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"(?: fill="none" stroke="#[0-9a-f]{6}" stroke-width="([\d.]+)")?/g)) {
        const reach = Math.hypot(Number(m[1]) - 50, Number(m[2]) - 50) + Number(m[3]) + Number(m[4] ?? 0) / 2;
        expect(reach, `${idOf(gem)} ${m[0]}`).toBeLessThanOrEqual(48.01);
      }
    // the forms that are built to the edge reach it
    for (const key of ['todo', 'habit', 'goal:day', 'goal:year', 'fused:week', 'fused:chapter', 'fused:year']) {
      const reach = Math.max(...[...gemSvg(gemFor(key)).matchAll(/ r="([\d.]+)"(?: fill="none" stroke="#[0-9a-f]{6}" stroke-width="([\d.]+)")?/g)].map((m) => Number(m[1]) + Number(m[2] ?? 0) / 2));
      expect(reach, key).toBeCloseTo(48, 1);
    }
  });
  it('uses one stroke, one gap and one hairline, each a share of the diameter', () => {
    expect(FORM).toEqual({ stroke: 9, gap: 6, hair: 4.5 });
    // 2 px at 22 px
    expect((FORM.stroke / 96) * 22).toBeGreaterThanOrEqual(2);
    const widths = (key: string) => [...gemSvg(gemFor(key)).matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(widths('habit')).toEqual([9]);
    expect(widths('train:run')).toEqual([9]);
    expect(widths('full')).toEqual([9]);
    expect(widths('back')).toEqual([18]);
    expect(widths('fused:week')).toEqual([4.5]);
    expect(widths('fused:chapter')).toEqual([4.5, 4.5]);
    expect(widths('fused:year')).toEqual([4.5, 4.5]);
    // a lit disc: the ring, the gap, the disc
    expect(gemSvg(gemFor('habit'))).toContain('r="43.5" fill="none"');
    expect(gemSvg(gemFor('habit'))).toContain(`r="${48 - FORM.stroke - FORM.gap}" fill="#`);
    // everything the legend and today's lines show at 22 px has no line under 2 px there
    for (const key of ['todo', 'habit', 'train:run', 'train:lift', 'train:cross', 'goal:day', 'goal:week', 'full', 'week', 'challenge', 'back']) for (const w of widths(key)) expect((w / 96) * 22, key).toBeGreaterThanOrEqual(2);
  });
  it('draws a target as a dot and one to four rings in equal bands', () => {
    for (const [key, n] of [['goal:day', 1], ['goal:week', 2], ['goal:month', 3], ['goal:year', 4]] as const) {
      const svg = gemSvg(gemFor(key));
      const band = 48 / (2 * n + 1);
      const rings = [...svg.matchAll(/r="([\d.]+)" fill="none" stroke="#[0-9a-f]{6}" stroke-width="([\d.]+)"/g)];
      expect(rings.length, key).toBe(n);
      for (const [i, m] of rings.entries()) {
        expect(Number(m[2])).toBeCloseTo(band, 1);
        expect(Number(m[1])).toBeCloseTo(band * (2 * i + 2.5), 1);
      }
      expect(svg).toMatch(new RegExp(`<circle cx="50" cy="50" r="${String(Math.round(band * 100) / 100).replace('.', '\\.')}" fill="#`));
    }
  });
  it('gives each form the parts the table names', () => {
    const count = (key: string, re: RegExp) => (gemSvg(gemFor(key)).match(re) ?? []).length;
    expect(gemSvg(gemFor('todo'))).toBe(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="2 2 96 96"><circle cx="50" cy="50" r="48" fill="${TOKEN['--deep-sky'].toLowerCase()}"/></svg>`);
    // seven dots, the first at twelve o'clock
    expect(count('week:2026-11-09', /<circle /g)).toBe(7);
    expect(gemSvg(gemFor('week'))).toContain('<circle cx="50" cy="14" r="12"');
    // an orbit: a line, a body and a moon that touches the edge at the upper right
    expect(count('train:run', /<circle /g)).toBe(2);
    expect(count('train:run', /<path /g)).toBe(1);
    const moon = /<circle cx="([\d.]+)" cy="([\d.]+)" r="8"/.exec(gemSvg(gemFor('train:run')))!;
    expect(Number(moon[1])).toBeGreaterThan(50);
    expect(Number(moon[2])).toBeLessThan(50);
    expect(Math.hypot(Number(moon[1]) - 50, Number(moon[2]) - 50) + 8).toBeCloseTo(48, 1);
    // a sunrise: a half-disc, an arc, and a horizon in Deep Sky that is wider than both
    const sun = gemSvg(gemFor('full'));
    expect(sun).toContain(`<path d="M6 59h88v9h-88z" fill="${TOKEN['--deep-sky'].toLowerCase()}"/>`);
    expect(sun).toContain('<path d="M23 59A27 27 0 0 1 77 59Z"');
    expect(sun).toContain('<path d="M12.5 59A37.5 37.5 0 0 1 87.5 59" fill="none"');
    // a crescent and an open ring: one path each
    expect(count('challenge:d', /<path /g)).toBe(1);
    expect(count('challenge:d', /<circle /g)).toBe(0);
    expect(gemSvg(gemFor('back'))).toContain('stroke-linecap="round"');
    // the earlier forms: an edge, an edge and a ring, two rings
    expect(count('fused:week', /<circle /g)).toBe(2);
    expect(count('fused:chapter', /<circle /g)).toBe(3);
    expect(count('fused:year', /<circle /g)).toBe(3);
  });
  it('prints in one color with every silhouette its own', () => {
    const ink = TOKEN['--night-ink'].toLowerCase();
    const seen = new Map<string, string>();
    for (const key of GEM_KEYS) {
      const svg = gemInk(gemFor(key));
      expect(colorsIn(svg), key).toEqual([ink]);
      expect(wellFormed(svg), key).toBe(true);
      const body = svg.replace(/^<svg[^>]*>/, '');
      const style = gemFor(key).style;
      if (seen.has(body)) expect(seen.get(body), key).toBe(style);
      seen.set(body, style);
    }
    expect(seen.size).toBe(14);
    // a pale disc prints as its edge, open inside
    expect(gemInk(gemFor('fused:week'))).toContain('fill="none"/><circle');
  });
  it('hands out one cached data URL per form and tint', () => {
    const a = gemUrl(gemFor('habit'));
    expect(a.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(gemUrl({ hue: 'apricot', style: 'lit', shift: 0 })).toBe(a);
    expect(gemUrl(gemFor('habit', 'x1'))).toBe(gemUrl(gemFor('habit', 'x1')));
    expect(gemUrl(gemFor('todo'))).not.toBe(a);
    expect(gemUrl({ ...gemFor('habit'), shift: 1 })).not.toBe(a);
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
  it('goes to OKLab and back, mixes and measures', () => {
    for (const hex of Object.values(TOKEN)) expect(toHex(toLab(hex))).toBe(hex.toLowerCase());
    expect(WHITE).toBe('#ffffff');
    expect(mix(TOKEN['--apricot'], WHITE, 0)).toBe(TOKEN['--apricot'].toLowerCase());
    expect(mix(TOKEN['--apricot'], WHITE, 1)).toBe('#ffffff');
    // the guide's own figures (3.1): Sky and Deep Sky on Paper
    expect(contrast(TOKEN['--sky'], TOKEN['--paper'])).toBeCloseTo(2.26, 1);
    expect(contrast(TOKEN['--deep-sky'], TOKEN['--paper'])).toBeCloseTo(5.57, 1);
  });
});

describe('OrbGem', () => {
  it('is the form’s size, hidden from VoiceOver unless it is named', () => {
    const html = renderToStaticMarkup(<OrbGem gem={gemFor('goal:day')} size={22} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('--og:22px');
    expect(html).toContain('<img');
    const named = renderToStaticMarkup(<OrbGem gem={gemFor('habit')} size={20} label="A habit" className="x" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="A habit"');
    expect(named).not.toContain('aria-hidden');
    expect(named).toContain('class="orb-gem x"');
  });
});
