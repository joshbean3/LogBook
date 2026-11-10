#!/usr/bin/env node
/**
 * Larger Text check: fails on a font size set in px, which would not follow the iOS text size (the app scales the root, so
 * sizes in rem follow it; see src/app/dynamicType.ts).
 *
 *   node scripts/check-styles.mjs <folder or file> [more ...]
 *
 * Checked: `font-size` and the size in a `font` shorthand, in .css files, and `fontSize` in inline styles in .tsx files.
 * Allowed: px inside clamp(), min() or max() (a size with a rem middle and a px floor or ceiling, for fixed chrome and
 * display numerals), and a declaration whose line carries the comment `px-ok` with the reason (text drawn on a canvas or
 * inside an SVG that scales with its viewBox).
 *
 * `pnpm test` runs it on src/styles and src/app. Once every feature folder has been converted the lead widens that to all
 * of src (critic-10).
 */
import fs from 'node:fs';
import path from 'node:path';

const targets = process.argv.slice(2);
if (!targets.length) {
  console.error('check-styles: name the folders or files to check, e.g. node scripts/check-styles.mjs src/styles src/app');
  process.exit(2);
}

const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e));
  else if (/\.(css|tsx)$/.test(p) && !/\.test\.tsx$/.test(p)) files.push(p);
};
for (const t of targets) {
  if (!fs.existsSync(t)) {
    console.error(`check-styles: ${t} does not exist`);
    process.exit(2);
  }
  walk(t);
}

/** The value with every clamp(), min() and max() call removed (nested calls too). */
const withoutBounded = (value) => {
  let out = '';
  for (let i = 0; i < value.length; ) {
    const m = /^(clamp|min|max)\(/.exec(value.slice(i));
    const before = i === 0 ? '' : value[i - 1];
    if (m && !/[\w-]/.test(before)) {
      let depth = 0;
      let j = i + m[0].length - 1;
      for (; j < value.length; j++) {
        if (value[j] === '(') depth++;
        else if (value[j] === ')' && --depth === 0) break;
      }
      i = j + 1;
      out += ' ';
      continue;
    }
    out += value[i++];
  }
  return out;
};
const PX = /(^|[^\w.-])\d*\.?\d+px\b/;
/** The part of a `font` shorthand that holds the size: everything before the first slash outside parentheses. */
const sizePart = (value) => {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === '/' && depth === 0) return value.slice(0, i);
  }
  return value;
};

const problems = [];
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const ok = (line) => /px-ok/.test(lines[line - 1] ?? '');
  if (file.endsWith('.css')) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    for (const m of css.matchAll(/(^|[;{\s])(font-size|font)\s*:\s*([^;{}]+)/g)) {
      const prop = m[2];
      const value = m[3].trim();
      const line = lineOf(css, m.index + m[1].length);
      if (ok(line)) continue;
      const size = withoutBounded(prop === 'font' ? sizePart(value) : value);
      if (PX.test(size)) problems.push({ file, line, text: `${prop}: ${value}` });
    }
  } else {
    for (const m of text.matchAll(/fontSize\s*:\s*(\d+(?:\.\d+)?\b(?!\s*\*)|['"`][^'"`]*px['"`])/g)) {
      const line = lineOf(text, m.index);
      if (ok(line)) continue;
      if (m[1] === '0') continue;
      problems.push({ file, line, text: m[0] });
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error(`${p.file}:${p.line}  ${p.text}`);
  console.error(`check-styles: ${problems.length} font size${problems.length === 1 ? '' : 's'} in px. Use a rem token (--fs-*) or clamp(px, rem, px).`);
  process.exit(1);
}
console.log(`check-styles: ${files.length} files, no px font size in ${targets.join(', ')}.`);
