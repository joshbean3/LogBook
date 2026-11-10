#!/usr/bin/env node
/**
 * Two static pairing checks the token flip can break (brand guide 3.3; plan 1.6):
 *
 *   A  white on Sky: a rule whose background resolves to Sky (#38B6F2, or the pressed #5CC4F5) while that rule, or another
 *      rule with the same selector, sets the words white (#fff, white, var(--white), var(--surface)). Use Night Ink.
 *   B  Deep Sky words on Haze: a background that resolves to Haze (#CBE8F8) or the Sky tint, with Deep Sky words
 *      (var(--accent-text), var(--deep-sky), var(--ok)), unless the selector sets a font size of 1.5rem or more
 *      (4.43:1 is large text only). Use Night Ink, or #085A8C for body on Haze. An icon tile (a selector naming -ic, ico,
 *      icon or -tile) holds a glyph, not words: Deep Sky on Haze is a graphic there (4.43, over 3:1; guide 6.4).
 *
 *   node scripts/check-pairs.mjs              every .css file in src
 *   node scripts/check-pairs.mjs <files...>   only these
 *
 * Backgrounds resolve through src/styles/tokens.css, one var() at a time (with the fallback when a name is unknown). The
 * browser audit (docs/brand/tools/audit.mjs) catches the computed pairs a static scan cannot. Exits 1 on any finding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = fs.readFileSync(path.join(web, 'src/styles/tokens.css'), 'utf8');
const rootBlock = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('@media (prefers-contrast'));
const defs = new Map([...rootBlock.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));

const resolve = (value, depth = 0) => {
  const v = value.trim().toLowerCase();
  const m = /^var\((--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(v);
  if (!m || depth > 6) return v;
  if (defs.has(m[1])) return resolve(defs.get(m[1]), depth + 1);
  return m[2] ? resolve(m[2], depth + 1) : v;
};
const SKY = new Set(['#38b6f2', '#5cc4f5']);
const HAZE = new Set(['#cbe8f8', 'rgba(56, 182, 242, 0.16)']);
const WHITE = new Set(['#fff', '#ffffff', 'white', '#fffdf8']);
const DEEP = new Set(['#0a6ca6']);

const walk = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((f) => walk(path.join(p, f))) : p.endsWith('.css') ? [p] : []);
const args = process.argv.slice(2);
const files = (args.length ? args : ['src']).flatMap((a) => walk(fs.existsSync(a) ? a : path.join(web, a)));

const findings = [];
for (const file of files) {
  if (file.endsWith('tokens.css')) continue;
  const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const rules = [];
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (sel.startsWith('@') || /^(from|to|\d+%)/.test(sel)) continue;
    const line = src.slice(0, m.index + m[0].indexOf(m[1].trim())).split('\n').length;
    const decl = Object.fromEntries([...m[2].matchAll(/(?:^|;)\s*([\w-]+)\s*:\s*([^;]+)/g)].map((d) => [d[1].toLowerCase(), d[2].trim()]));
    rules.push({ sel, line, decl });
  }
  const bySel = new Map();
  for (const r of rules) for (const s of r.sel.split(',').map((x) => x.trim())) bySel.set(s, [...(bySel.get(s) ?? []), r]);
  for (const r of rules) {
    const bgRaw = r.decl['background-color'] ?? r.decl.background;
    if (!bgRaw || /gradient|url\(/.test(bgRaw)) continue;
    const bg = resolve(bgRaw.split(/\s+!important/)[0]);
    for (const s of r.sel.split(',').map((x) => x.trim())) {
      const same = bySel.get(s) ?? [r];
      const colorRaw = [r, ...same].map((x) => x.decl.color).find(Boolean);
      if (!colorRaw) continue;
      const color = resolve(colorRaw);
      const big = same.some((x) => /font(-size)?:[^;]*\b(1\.[5-9]|[2-9](\.\d+)?)rem/.test(`font:${x.decl.font ?? ''};font-size:${x.decl['font-size'] ?? ''}`));
      const rel = path.relative(web, file);
      if (SKY.has(bg) && WHITE.has(color) && colorRaw !== 'var(--surface)' ? true : SKY.has(bg) && colorRaw === 'var(--surface)')
        findings.push(`${rel}:${r.line} A white on Sky  ${s} { background: ${bgRaw}; color: ${colorRaw} }`);
      const glyph = /(-ic|ico|icon|-tile)\b/.test(s.split(' ').at(-1));
      if (HAZE.has(bg) && DEEP.has(color) && !big && !glyph) findings.push(`${rel}:${r.line} B Deep Sky words on Haze  ${s} { background: ${bgRaw}; color: ${colorRaw} }`);
    }
  }
}
for (const f of [...new Set(findings)]) console.log(f);
if (findings.length) {
  console.error(`check-pairs: ${new Set(findings).size} finding(s).`);
  process.exit(1);
}
console.log(`check-pairs: no white on Sky and no Deep Sky words on Haze in ${files.length} file(s).`);
