#!/usr/bin/env node
/**
 * Orby runtime brand audit (brand-guide.md section 13, the lines marked "runtime"). It loads screens of a running build
 * in Playwright at 390 x 844 and checks what a diff cannot show:
 *
 *   pairing     every visible text element's computed color against its effective ground (the first opaque
 *               background up its ancestors), checked against the allowed pairings in docs/brand/tokens.json
 *               (contrast.allowedText). A ground painted by a gradient or an image is read as the nearest solid
 *               color up the tree, so confirm such hits by eye. A pair that is not listed but passes 4.5:1 (3:1 for large text) is reported as
 *               "unlisted"; one that fails is a violation.
 *   sunrise     elements whose computed color, background, fill, stroke or border is #F2600C. More than 3 is a
 *               violation (guide 3.5).
 *   orb         elements with class .lb-orb that are visible. More than 1 is a violation (2.1). Each Orb's diameter is
 *               reported with its tier.
 *   fraunces    distinct Fraunces font sizes (max 4) and Inter sizes (max 5); Fraunces under 20 px roman or 17 px italic.
 *   tnum        text that looks like a live number (digits with a unit, a time, a count) not in Fraunces must have
 *               font-variant-numeric: tabular-nums. Fraunces digits are flagged (no tabular figures).
 *   axes        any element whose computed font-variation-settings is not the html value.
 *   hero        more than one .hero / [data-hero] card is a violation.
 *
 * It never passes what it cannot see: Reduce Motion, Increase Contrast, 200 percent text and haptics are listed as
 * UNVERIFIED for a person to check.
 *
 *   node docs/brand/tools/audit.mjs http://localhost:5220 [/today,/goals,...] [--state path/to/storageState.json]
 *
 * Exit code 1 when any violation is found.
 */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(fs.readFileSync(path.join(here, '..', 'tokens.json'), 'utf8'));
const args = process.argv.slice(2);
const base = args.find((a) => /^https?:/.test(a)) || 'http://localhost:5220';
const routes = (args.find((a) => a.startsWith('/')) || '/today,/goals,/learned,/plan,/progress,/journal').split(',');
const si = args.indexOf('--state');
const state = si >= 0 ? args[si + 1] : undefined;

// palette name -> hex, from the token groups
const hexOf = {};
for (const g of Object.values(tokens.groups)) for (const [k, v] of Object.entries(g)) if (/^#[0-9a-f]{6}$/i.test(v.value)) hexOf[k] = v.value.toUpperCase();
const alias = { 'night-ink': 'night-ink', paper: 'paper', cloud: 'cloud', linen: 'linen', haze: 'haze', apricot: 'apricot', sky: 'sky', sunrise: 'sunrise', dusk: 'dusk', 'deep-sky': 'deep-sky', ember: 'ember', white: 'white', twilight: 'twilight', graphite: 'graphite', 'warn-text': 'warn-text', 'warn-soft': 'warn-soft', bad: 'bad', 'bad-soft': 'bad-soft', signal: 'bad' };
const toHex = (n) => {
  const m = /#([0-9a-f]{6})/i.exec(n);
  if (m) return '#' + m[1].toUpperCase();
  const k = alias[n.split(' ')[0]];
  return k ? hexOf[k] : null;
};
const allowed = new Set();
for (const [t, g] of [...tokens.contrast.allowedText, ...tokens.contrast.largeTextOnly]) {
  const a = toHex(t), b = toHex(g);
  if (a && b) allowed.add(a + '/' + b);
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(state ? { storageState: state } : {}) });
const page = await ctx.newPage();
let violations = 0;
for (const r of routes) {
  await page.goto(base + r, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const res = await page.evaluate(() => {
    const hex = (c) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || '');
      if (!m || (m[4] !== undefined && +m[4] < 0.95)) return null;
      return '#' + [m[1], m[2], m[3]].map((v) => Math.round(+v).toString(16).padStart(2, '0')).join('').toUpperCase();
    };
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (!(r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && cs.visibility !== 'hidden')) return false; for (let e = el; e; e = e.parentElement) if (+getComputedStyle(e).opacity < 0.05) return false; return true; };
    const ground = (el) => { for (let e = el; e; e = e.parentElement) { const g = hex(getComputedStyle(e).backgroundColor); if (g) return g; } return '#FFFFFF'; };
    const out = { texts: [], sunrise: 0, orbs: [], fr: new Set(), inter: new Set(), frSmall: [], tnum: [], axes: [], heroes: 0 };
    const rootAxes = getComputedStyle(document.documentElement).fontVariationSettings;
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      for (const p of ['color', 'backgroundColor', 'fill', 'stroke', 'borderTopColor']) if (hex(cs[p]) === '#F2600C' && (p !== 'color' || el.childNodes.length)) { out.sunrise++; break; }
      if (el.classList.contains('lb-orb')) out.orbs.push(Math.round(el.getBoundingClientRect().width));
      if (el.matches('.hero, [data-hero]')) out.heroes++;
      if (cs.fontVariationSettings !== rootAxes && cs.fontVariationSettings !== 'normal') out.axes.push(el.className.toString().slice(0, 40));
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (!own) continue;
      const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join('').trim();
      const fam = cs.fontFamily.toLowerCase(), size = parseFloat(cs.fontSize);
      if (fam.includes('fraunces')) { out.fr.add(size); if ((cs.fontStyle === 'italic' && size < 17) || (cs.fontStyle !== 'italic' && size < 20)) out.frSmall.push(text.slice(0, 30)); }
      else if (fam.includes('inter') && !fam.startsWith('"inter tight"') && !fam.startsWith('inter tight')) out.inter.add(size);
      if (/\d/.test(text) && /(\d[\d.,:]*\s?(mi|km|min|h|%|\/mi)|\d+:\d\d|\b\d+ of \d+)/.test(text)) {
        if (fam.includes('fraunces')) out.tnum.push('Fraunces digits: ' + text.slice(0, 30));
        else if (!cs.fontVariantNumeric.includes('tabular-nums')) out.tnum.push(text.slice(0, 30));
      }
      const c = hex(cs.color);
      if (c) out.texts.push([c, ground(el), size, +cs.fontWeight, text.slice(0, 30)]);
    }
    out.fr = [...out.fr]; out.inter = [...out.inter];
    return out;
  });
  const v = [], unlisted = [];
  for (const [c, g, size, w, t] of res.texts) {
    if (c === g) continue;
    const key = c + '/' + g, rr = ratio(c, g), large = size >= 24 || (size >= 18.66 && w >= 700);
    if (allowed.has(key)) continue;
    if (rr < (large ? 3 : 4.5)) v.push(`pairing ${key} ${rr.toFixed(2)} "${t}"`);
    else unlisted.push(`${key} ${rr.toFixed(2)}`);
  }
  if (res.sunrise > 3) v.push(`sunrise: ${res.sunrise} Sunrise elements (max 3)`);
  if (res.orbs.length > 1) v.push(`orb: ${res.orbs.length} Orbs on screen`);
  for (const d of res.orbs) if (d < 28 && d > 0) v.push(`orb: a ${d} px Orb must be the flat disc (check its render)`);
  if (res.fr.length > 4) v.push(`fraunces: ${res.fr.length} sizes (${res.fr.join(', ')})`);
  if (res.inter.length > 5) v.push(`inter: ${res.inter.length} sizes (${res.inter.join(', ')})`);
  for (const t of res.frSmall) v.push(`fraunces under its floor: "${t}"`);
  for (const t of res.tnum) v.push(`tnum: "${t}"`);
  for (const t of new Set(res.axes)) v.push(`axes: font-variation-settings set on .${t}`);
  if (res.heroes > 1) v.push(`hero: ${res.heroes} hero cards`);
  violations += v.length;
  console.log(`\n${r}: ${v.length ? 'FAIL' : 'PASS'}  (Sunrise ${res.sunrise}, Orbs ${res.orbs.join('/') || 0} px, Fraunces sizes ${res.fr.length}, Inter sizes ${res.inter.length})`);
  for (const x of v) console.log('  - ' + x);
  if (unlisted.length) console.log('  unlisted but passing (add to 3.2 or change): ' + [...new Set(unlisted)].slice(0, 8).join('; '));
}
console.log('\nUNVERIFIED (check by hand): Reduce Motion, Increase Contrast, 200 percent text, haptics on the peak frame, VoiceOver labels.');
await b.close();
process.exit(violations ? 1 : 0);
