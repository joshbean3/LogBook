#!/usr/bin/env node
/**
 * Text contrast check for the design tokens (WCAG 2.x, 1.4.3), against the brand guide's table of allowed text pairings
 * (docs/brand/brand-guide.md 3.2, 11). Reads the pairs from docs/brand/tokens.json `contrast.allowedText` and
 * `contrast.largeTextOnly`, resolves each color through apps/web/src/styles/tokens.css (so a token that drifts from the guide
 * fails here), and also checks the semantic aliases the app paints words with on the grounds they sit on.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exits 1 if a pair falls under its floor (4.5:1 for body, 3:1 for large-text-only pairs) or if a pair's ratio has moved more
 * than 0.05 from the value the guide prints (the token and the guide disagree).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '..', 'src', 'styles', 'tokens.css'), 'utf8');
const brand = JSON.parse(fs.readFileSync(path.join(here, '..', '..', '..', 'docs', 'brand', 'tokens.json'), 'utf8'));
// only the :root block: the Increase Contrast block redefines names with darker steps
const root = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-contrast'));

const token = (name) => {
  const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(root);
  if (!m) throw new Error(`check-contrast: ${name} is not in tokens.css`);
  const v = m[1].trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? token(ref[1]) : v;
};
// a guide name ("night-ink", "deep-sky-ic #085A8C", "splash sky (cloud)", "signal") to a hex value
const ALIAS = { signal: '--bad' };
const color = (name) => {
  const hex = /#[0-9a-f]{6}\b/i.exec(name);
  if (hex) return hex[0];
  const paren = /\(([\w-]+)\)/.exec(name);
  const key = (paren ? paren[1] : name).trim();
  return token(ALIAS[key] ?? `--${key}`);
};
const rgb = (hex) => {
  const h = /^#([0-9a-f]{6})$/i.exec(hex) ?? /^#([0-9a-f]{3})$/i.exec(hex);
  if (!h) throw new Error(`check-contrast: ${hex} is not a hex color`);
  const s = h[1].length === 3 ? [...h[1]].map((c) => c + c).join('') : h[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let bad = 0;
const row = (text, ground, min, printed) => {
  const ratio = contrast(color(text), color(ground));
  const short = ratio < min;
  const drift = printed != null && Math.abs(ratio - printed) > 0.05;
  if (short || drift) bad++;
  const note = short ? ` FAIL (under ${min}:1)` : drift ? ` DRIFT (guide says ${printed})` : '';
  console.log(`${text.padEnd(22)} on ${ground.padEnd(20)} ${ratio.toFixed(2)}:1${note}`);
};

console.log('Allowed text pairings (guide 3.2), body 4.5:1');
for (const [text, ground, printed] of brand.contrast.allowedText) row(text, ground, 4.5, printed);
console.log('\nLarge text only, 3:1');
for (const [text, ground, printed] of brand.contrast.largeTextOnly) row(text, ground, 3, printed);

// the semantic aliases the app paints words with, on the grounds words sit on (Paper cards, the Cloud ground and insets)
const TEXT = ['--ink', '--ink-2', '--ink-3', '--ink-4', '--accent-text', '--now-text', '--warn-text', '--bad', '--j-ink'];
const GROUNDS = ['--surface', '--bg', '--surface-2'];
console.log('\nText tokens on the grounds, body 4.5:1');
for (const t of TEXT) for (const g of GROUNDS) row(t.slice(2), g.slice(2), 4.5);
// words on fills: the primary label on the primary, words on Haze (--surface-3), words on the sun disc
row('primary-ink', 'primary', 4.5);
row('accent-ink', 'accent', 4.5);
row('sun-ink', 'sun', 4.5);
for (const t of ['--ink', '--ink-2']) row(t.slice(2), 'surface-3', 4.5);

if (bad) {
  console.error(`\ncheck-contrast: ${bad} pair${bad === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\ncheck-contrast: every pairing reaches its floor and matches the guide.');
