#!/usr/bin/env node
/**
 * Text contrast check for the design tokens (WCAG 2.2, 1.4.3): every colour token used for words must reach 4.5:1 on each
 * surface words sit on. Reads src/styles/tokens.css, prints a table, and exits 1 if any pair falls short.
 *
 *   node scripts/check-contrast.mjs
 *
 * `TEXT` lists the tokens that colour text. A token for marks only (--ink-faint, --line, --warn, the session tones as
 * fills) is not in it: the rule for marks is 3:1 and is judged where the mark is drawn.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, '..', 'src', 'styles', 'tokens.css'), 'utf8');

const TEXT = ['--ink', '--ink-2', '--ink-3', '--ink-4', '--accent-text', '--bad', '--j-ink'];
const SURFACES = ['--surface', '--bg', '--surface-2'];
const MIN = 4.5;

const token = (name) => {
  const m = new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm').exec(css);
  if (!m) throw new Error(`check-contrast: ${name} is not in tokens.css`);
  const v = m[1].trim();
  const ref = /^var\((--[\w-]+)\)$/.exec(v);
  return ref ? token(ref[1]) : v;
};
const rgb = (hex) => {
  const h = /^#([0-9a-f]{6})$/i.exec(hex) ?? /^#([0-9a-f]{3})$/i.exec(hex);
  if (!h) throw new Error(`check-contrast: ${hex} is not a hex colour`);
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
console.log(`${'text token'.padEnd(16)}${SURFACES.map((s) => `${s} ${token(s)}`.padEnd(22)).join('')}`);
for (const t of TEXT) {
  const cells = SURFACES.map((s) => {
    const ratio = contrast(token(t), token(s));
    if (ratio < MIN) bad++;
    return `${ratio.toFixed(2)}:1${ratio < MIN ? ' FAIL' : ''}`.padEnd(22);
  });
  console.log(`${`${t} ${token(t)}`.padEnd(16)} ${cells.join('')}`);
}
if (bad) {
  console.error(`check-contrast: ${bad} pair${bad === 1 ? '' : 's'} under ${MIN}:1.`);
  process.exit(1);
}
console.log(`check-contrast: every text token reaches ${MIN}:1 on ${SURFACES.join(', ')}.`);
