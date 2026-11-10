#!/usr/bin/env node
/**
 * Brand drift check (docs/brand/brand-guide.md, section 13). A migration aid: it lists what still has to move onto the
 * brand tokens. It is not in `pnpm test` yet, because the app has not migrated.
 *
 *   node scripts/check-brand.mjs                 every file in src
 *   node scripts/check-brand.mjs src/features/day  one folder or file (several are fine)
 *   node scripts/check-brand.mjs --summary       counts per file and per rule, no line list
 *
 * Paths are read from the current folder, then from apps/web, so it runs from the repo root too
 * (node apps/web/scripts/check-brand.mjs). Exits 1 when it finds anything, so it can join `pnpm test` once the count
 * reaches 0. Each occurrence counts, so a line with two hex values counts twice.
 *
 * Rules (each finding prints file:line, the rule and the text):
 *   hex          A raw hex color (#38b6f2) in a .css, .ts or .tsx file. Use a token: var(--sky), var(--ink) ...
 *   rgba-retired A literal of a retired color: the old navy rgba(15, 42, 68, ...) or the old orange rgba(242, ...).
 *                Use --line, --scrim, --shadow-* or another token.
 *   font-family  A font-family (CSS), fontFamily (inline style or SVG attribute) or font shorthand that names a face
 *                instead of var(--display), var(--serif), var(--sans), var(--stamp) or var(--mono). Also any canvas
 *                `.font = '...'` that names a face outside Fraunces, Inter and Inter Tight (canvas cannot read tokens,
 *                so only the face is checked there), and any @font-face for a face outside those three.
 *   px-font      A font size in px: font-size or the font shorthand in CSS, fontSize in an inline style or an SVG
 *                attribute. Use a --fs-* token, or max(px, rem) for the small roles. Same rule as check-styles.mjs,
 *                applied to all of src.
 *   color-fn     rgb(), hsl() or hsla() anywhere, and any rgba() that is not one of the exact values the guide names
 *                (ALLOWED_RGBA below). Use a token.
 *   named-color  A CSS named color (white, black, orange, red ...) as a color value. Use a token (transparent and
 *                currentColor are fine).
 *   color-mix    color-mix() with black, white or a raw color. Mix tokens only, or add a token.
 *   rem-font     A rem font size that is not in the guide's scale (section 4.2). Use the --fs-* token.
 *   radius       A border-radius that is not var(--r-*), 50%, 999px or 0 (section 5.2).
 *   tracking     A letter-spacing in em that is not var(--tr-*) or 0 (section 4.3).
 *   spacing      A px padding, margin, gap or inset off the steps 4, 8, 12, 16, 20, 24, 32, 48 and the named
 *                exceptions 3 and -7 (section 5.1). 0, 1 and 2 px (hairline nudges) are allowed.
 *   motion       A transition or animation of a property other than transform, opacity, color, background-color or
 *                stroke-dashoffset, or with a literal duration instead of var(--dur-*) (section 9.1).
 *   fraunces     A rule that sets var(--display) or var(--serif) roman at a weight under 600 (section 4.5).
 *   axes         font-variation-settings outside the token file: the html rule carries the axes (section 4.1).
 *   copy         In a string literal (.ts, .tsx): an em dash, "the Orby", "Orby app", ORBY, or a British spelling
 *                (colour, favourite, centre, behaviour, programme, organise, analyse) (section 10).
 *
 * Not checked: comments, *.test.ts(x), and the token files below.
 * Escape hatches, on the same line, with a reason:
 *   `brand-ok: <reason>`  skips every rule on that line (for example a color a third-party API requires).
 *   `px-ok: <reason>`     skips px-font only (text drawn on a canvas, or inside an SVG that scales with its viewBox),
 *                         the same marker check-styles.mjs reads.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files that define the tokens. Raw values belong here and only here. Paths relative to apps/web. */
const TOKEN_FILES = new Set(['src/styles/tokens.css']);

const args = process.argv.slice(2);
const summary = args.includes('--summary');
const targets = args.filter((a) => !a.startsWith('--'));
if (!targets.length) targets.push('src');

/** apps/web: paths print relative to it, and a target that is not found from the current folder is tried from it. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, path.resolve(p)).split(path.sep).join('/');

const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p)) if (e !== 'node_modules') walk(path.join(p, e));
  } else if (/\.(css|ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) && !/\.d\.ts$/.test(p) && !TOKEN_FILES.has(rel(p))) {
    files.push(p);
  }
};
for (const t of targets) {
  const found = [path.resolve(t), path.resolve(root, t)].find((p) => fs.existsSync(p));
  if (!found) {
    console.error(`check-brand: ${t} does not exist`);
    process.exit(2);
  }
  walk(found);
}

/* ---------- helpers ---------- */

/** Blank out comments, keeping every newline so line numbers stay true. */
const blank = (s) => s.replace(/[^\n]/g, ' ');
const stripCss = (text) => text.replace(/\/\*[\s\S]*?\*\//g, blank);
const stripTs = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // a line comment: `//` not inside a URL (not after `:`) and not inside a quote that opened earlier on the line
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + blank(m.slice(pre.length)));

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** A hex color: 3, 4, 6 or 8 hex digits after `#`, not part of a word, an HTML entity or a private field. */
const HEX = /(?<![\w&.#$/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
/** In .ts and .tsx, `#abc = 1` or `#add(` is a private class member, not a color. */
const PRIVATE_MEMBER = /^\s*[=(;:!?]/;
const RGBA_RETIRED = /rgba?\(\s*(?:15\s*,\s*42\s*,\s*68|242\s*,\s*96\s*,\s*12)\b/g;
/** rgba values the guide names exactly (normalized: no spaces, no leading zero). Everything else is a token. */
const ALLOWED_RGBA = new Set([
  ...['.04', '.05', '.08', '.1', '.12', '.14', '.16', '.18', '.2', '.22', '.28', '.3', '.32', '.45', '.5', '.55', '.7'].map((a) => `rgba(14,34,54,${a})`),
  'rgba(255,182,128,.42)', 'rgba(255,182,128,0)', 'rgba(56,182,242,.16)', 'rgba(56,182,242,.28)', 'rgba(10,108,166,.45)', 'rgba(180,67,12,.4)',
  'rgba(234,245,252,0)', 'rgba(234,245,252,.86)', 'rgba(255,253,248,.88)', 'rgba(27,72,112,.4)', 'rgba(203,232,248,.95)', 'rgba(203,232,248,0)',
]);
const normRgba = (t) => t.replace(/\s+/g, '').replace(/([,(])0\./g, '$1.').replace(/\.(\d*?)0+\)/, (m, d) => (d ? `.${d})` : ')')).replace(/,1\.?\)$/, ',1)').toLowerCase();
const NAMED = 'white|black|orange|red|blue|green|yellow|purple|pink|gray|grey|navy|teal|silver|gold|tomato|coral|salmon|crimson|maroon|olive|lime|aqua|cyan|magenta|fuchsia|indigo|violet|brown|beige|ivory|tan|khaki|orchid|plum|skyblue|lightblue|darkblue|lightgray|darkgray|whitesmoke|ghostwhite|aliceblue|azure|snow|seashell|linen';
const COLOR_PROPS = '(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|text-decoration-color)';
const NAMED_CSS = new RegExp(`(^|[;{\\s])${COLOR_PROPS}\\s*:\\s*([^;{}]*?)\\b(${NAMED})\\b`, 'gi');
const NAMED_TS = new RegExp(`\\b(?:color|background|backgroundColor|fill|stroke|borderColor)\\s*[:=]\\s*\\{?\\s*['"\`](${NAMED})['"\`]`, 'g');
/** rem sizes in the 4.2 scale. */
const REM_SCALE = new Set(['3.5', '2.375', '2.5', '1.875', '2.75', '3.625', '1.625', '1.375', '1.0625', '1', '0.9375', '0.875', '0.8125', '0.75', '0.6875']);
const SPACE_OK = new Set(['0', '1', '2', '3', '4', '8', '12', '16', '20', '24', '32', '48', '-7', '-1', '-2']);
const MOTION_PROPS = new Set(['transform', 'opacity', 'color', 'background-color', 'stroke-dashoffset', 'all-none', 'none']);
const BRITISH = /\b(colour|favourite|centre|behaviour|programme|organis(?:e|ed|ing)|analys(?:e|ed|ing))s?\b/i;

/** Faces the brand allows, plus the system and generic fallbacks that may follow them in a stack. */
const FACES = ['fraunces', 'fraunces fallback', 'fraunces card', 'inter', 'inter fallback', 'inter tight', 'inter tight fallback'];
const FALLBACKS = [
  'iowan old style', 'georgia', 'serif', 'sans-serif', 'monospace', 'system-ui', '-apple-system', 'blinkmacsystemfont',
  'segoe ui', 'roboto', 'helvetica', 'helvetica neue', 'arial', 'ui-monospace', 'sf mono', 'sfmono-regular', 'menlo',
  'ui-sans-serif', 'ui-serif',
];
const familyOk = (name) => {
  const n = name.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  return !n || FACES.includes(n) || FALLBACKS.includes(n) || /^-apple-system-[\w-]+$/.test(n);
};
/** Families named in a canvas font string such as `italic 600 30px "Fraunces Card", Georgia, serif`. */
const canvasFamilies = (value) => {
  const afterSize = value.replace(/^.*?(?:\d*\.?\d+|\$\{[^}]*\})(?:px|pt|em|rem)(?:\s*\/\s*[\d.]+\w*)?\s+/, '');
  return afterSize.split(',').map((s) => s.trim()).filter((s) => s && !s.includes('${'));
};
const TOKEN_FONT = /^(?:var\(--(?:display|serif|sans|stamp|mono)\)|inherit|initial|unset|revert)$/;
const CSS_FONT_KEYWORDS = /^(?:inherit|initial|unset|revert|caption|icon|menu|message-box|small-caption|status-bar|-apple-system-[\w-]+)$/;

/** The value with every clamp(), min() and max() call removed (nested calls too), as in check-styles.mjs. */
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
/** The size part of a `font` shorthand: everything before the first slash outside parentheses. */
const sizePart = (value) => {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')') depth--;
    else if (value[i] === '/' && depth === 0) return value.slice(0, i);
  }
  return value;
};
/** The family part of a `font` shorthand: what follows the size (and line height). */
const shorthandFamily = (value) => {
  const m = /\d*\.?\d+(?:px|rem|em|%|pt)|\)|\b(?:small|medium|large|x-small|x-large|xx-small|xx-large|smaller|larger)\b/g;
  let last = -1;
  let hit;
  // the family starts after the last size-like token (or the closing paren of var()/max() used as a size)
  while ((hit = m.exec(value))) last = hit.index + hit[0].length;
  if (last < 0) return value.trim();
  return value.slice(last).replace(/^\s*\/\s*[^\s]+/, '').trim();
};

/* ---------- scan ---------- */

const problems = [];
const add = (file, line, rule, text, lines) => {
  const src = lines[line - 1] ?? '';
  if (/brand-ok/.test(src)) return;
  if (rule === 'px-font' && /px-ok/.test(src)) return;
  problems.push({ file: rel(file), line, rule, text: text.replace(/\s+/g, ' ').trim().slice(0, 110) });
};

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split('\n');
  const isCss = file.endsWith('.css');
  const text = isCss ? stripCss(raw) : stripTs(raw);

  // hex and retired rgba: anywhere outside comments
  for (const m of text.matchAll(HEX)) {
    if (!isCss && PRIVATE_MEMBER.test(text.slice(m.index + m[0].length, m.index + m[0].length + 3))) continue;
    add(file, lineOf(text, m.index), 'hex', lines[lineOf(text, m.index) - 1], lines);
  }
  for (const m of text.matchAll(RGBA_RETIRED))
    add(file, lineOf(text, m.index), 'rgba-retired', lines[lineOf(text, m.index) - 1], lines);

  // color functions and named colors
  for (const m of text.matchAll(/\b(rgba?|hsla?)\(\s*[^)]*\)/g)) {
    const t = m[0];
    if (/^hsl/i.test(t) || /^rgb\(/i.test(t)) { add(file, lineOf(text, m.index), 'color-fn', lines[lineOf(text, m.index) - 1], lines); continue; }
    if (/var\(/.test(t) || RGBA_RETIRED.test(t)) { RGBA_RETIRED.lastIndex = 0; continue; }
    if (!ALLOWED_RGBA.has(normRgba(t))) add(file, lineOf(text, m.index), 'color-fn', `${t} (not a value the guide names; use a token)`, lines);
  }
  for (const m of text.matchAll(/color-mix\([^;]*/g)) if (/\b(black|white)\b|#[0-9a-f]{3,8}/i.test(m[0])) add(file, lineOf(text, m.index), 'color-mix', m[0], lines);
  if (!isCss) {
    for (const m of text.matchAll(NAMED_TS)) add(file, lineOf(text, m.index), 'named-color', m[0], lines);
    // copy in string literals
    const literals = [...raw.matchAll(/(['"`])((?:(?!\1)[^\n\\]|\\.)*)\1/g)].map((m) => [m.index, m[2]]);
    if (file.endsWith('.tsx')) for (const m of raw.matchAll(/>([^<>{}\n]*[A-Za-z][^<>{}\n]*)</g)) literals.push([m.index, m[1]]); // JSX text
    for (const [index, str] of literals) {
      const m = { index };
      if (!/[a-z]/i.test(str) || /^[\w./@:-]*$/.test(str)) continue; // identifiers, paths, class names
      const at = lineOf(raw, m.index);
      if (/\u2014/.test(str)) add(file, at, 'copy', `em dash in "${str.slice(0, 60)}"`, lines);
      if (/\bthe Orby\b|\bOrby app\b|\bORBY\b/.test(str)) add(file, at, 'copy', `name misuse in "${str.slice(0, 60)}"`, lines);
      if (BRITISH.test(str)) add(file, at, 'copy', `British spelling in "${str.slice(0, 60)}"`, lines);
    }
  }
  if (isCss) {
    for (const m of text.matchAll(NAMED_CSS)) {
      if (/var\(--[\w-]*$/.test(m[2])) continue;
      add(file, lineOf(text, m.index + m[1].length), 'named-color', m[0].trim(), lines);
    }
    // rule-level checks: radius, tracking, spacing, motion, Fraunces weight, axes
    for (const m of text.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      const body = m[2], at0 = m.index + m[1].length + 1;
      if (/@font-face/.test(m[1])) continue;
      const decl = (re, fn) => { for (const d of body.matchAll(re)) fn(d, lineOf(text, at0 + d.index)); };
      decl(/(?:^|;)\s*(border(?:-(?:top|bottom)-(?:left|right))?-radius)\s*:\s*([^;]+)/g, (d, ln) => {
        const v = d[2].trim();
        if (!v.split(/\s+/).every((x) => /^var\(--r-[\w-]+\)$|^50%$|^999px$|^0(px)?$|^inherit$/.test(x))) add(file, ln, 'radius', `${d[1]}: ${v}`, lines);
      });
      decl(/(?:^|;)\s*letter-spacing\s*:\s*([^;]+)/g, (d, ln) => { const v = d[1].trim(); if (/em\b/.test(v) && !/^var\(--tr-[\w-]+\)$/.test(v) && !/^-?0(\.0+)?em$/.test(v)) add(file, ln, 'tracking', `letter-spacing: ${v}`, lines); });
      decl(/(?:^|;)\s*((?:padding|margin|inset)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?|gap|row-gap|column-gap|top|right|bottom|left)\s*:\s*([^;]+)/g, (d, ln) => {
        if (/^(top|right|bottom|left)$/.test(d[1])) return; // positions are layout, not spacing
        const bad = [...withoutBounded(d[2]).matchAll(/(-?\d*\.?\d+)px\b/g)].map((x) => x[1]).filter((n) => !SPACE_OK.has(String(+n)));
        if (bad.length) add(file, ln, 'spacing', `${d[1]}: ${d[2].trim()}`, lines);
      });
      decl(/(?:^|;)\s*(transition|animation)(?:-property|-duration)?\s*:\s*([^;]+)/g, (d, ln) => {
        const v = d[2];
        if (/\b\d*\.?\d+m?s\b/.test(v.replace(/var\([^)]*\)/g, ''))) add(file, ln, 'motion', `${d[1]}: ${v.trim()} (use var(--dur-*))`, lines);
        if (d[1] === 'transition') for (const part of v.split(',')) { const prop = part.trim().split(/\s+/)[0]; if (prop && !/^var\(/.test(prop) && !MOTION_PROPS.has(prop)) add(file, ln, 'motion', `transition of ${prop}`, lines); }
      });
      if (/font-variation-settings\s*:/.test(body)) add(file, lineOf(text, at0 + body.indexOf('font-variation-settings')), 'axes', 'font-variation-settings outside the html rule', lines);
      if (/var\(--(?:display|serif)\)/.test(body) && !/italic/.test(body)) {
        const w = /font-weight\s*:\s*(\d+)/.exec(body) || /font\s*:\s*(?:normal\s+)?(\d{3})\s/.exec(body);
        if (w && +w[1] < 600) add(file, lineOf(text, at0 + body.indexOf(w[0])), 'fraunces', `Fraunces roman at ${w[1]} (600 to 700)`, lines);
      }
      decl(/(?:^|;)\s*font-size\s*:\s*([\d.]+)rem\b/g, (d, ln) => { if (!REM_SCALE.has(String(+d[1]))) add(file, ln, 'rem-font', `font-size: ${d[1]}rem (not in the 4.2 scale)`, lines); });
    }
    // @font-face blocks: only the face is checked
    const faceRanges = [];
    for (const m of text.matchAll(/@font-face\s*\{[^}]*\}/g)) {
      faceRanges.push([m.index, m.index + m[0].length]);
      const fam = /font-family\s*:\s*([^;}]+)/.exec(m[0]);
      if (fam && !familyOk(fam[1])) {
        const line = lineOf(text, m.index + fam.index);
        add(file, line, 'font-family', `@font-face for ${fam[1].trim()} (not a brand face)`, lines);
      }
    }
    const inFace = (i) => faceRanges.some(([a, b]) => i >= a && i < b);

    for (const m of text.matchAll(/(^|[;{\s])(font-family|font-size|font)\s*:\s*([^;{}]+)/g)) {
      const at = m.index + m[1].length;
      if (inFace(at)) continue;
      const prop = m[2];
      const value = m[3].trim();
      const line = lineOf(text, at);
      if (prop === 'font-family') {
        if (!TOKEN_FONT.test(value)) add(file, line, 'font-family', `font-family: ${value}`, lines);
        continue;
      }
      if (prop === 'font') {
        if (CSS_FONT_KEYWORDS.test(value) || /^var\(--[\w-]+\)$/.test(value)) continue;
        const fam = shorthandFamily(value);
        if (fam && !TOKEN_FONT.test(fam)) add(file, line, 'font-family', `font: ${value}`, lines);
      }
      const size = withoutBounded(prop === 'font' ? sizePart(value) : value);
      if (PX.test(size)) add(file, line, 'px-font', `${prop}: ${value}`, lines);
    }
  } else {
    // fontFamily in an inline style object or as an SVG/JSX attribute
    for (const m of text.matchAll(/fontFamily\s*(?::|=)\s*(\{?\s*['"`][^'"`]*['"`]\s*\}?|\{[^}\n]*\})/g)) {
      const v = m[1].replace(/^\{\s*|\s*\}$/g, '').replace(/^['"`]|['"`]$/g, '').trim();
      if (!TOKEN_FONT.test(v)) add(file, lineOf(text, m.index), 'font-family', m[0], lines);
    }
    // canvas font strings: check the faces only (canvas needs px and cannot read CSS variables)
    for (const m of text.matchAll(/\.font\s*=\s*(['"`])((?:(?!\1)[^\n])*)\1/g)) {
      const bad = canvasFamilies(m[2]).filter((f) => !familyOk(f));
      if (bad.length) add(file, lineOf(text, m.index), 'font-family', `canvas font names ${bad.join(', ')}`, lines);
    }
    // font sizes in px: style objects (numbers are px in React) and SVG/JSX attributes
    for (const m of text.matchAll(/fontSize\s*:\s*(\d+(?:\.\d+)?\b(?!\s*\*)|['"`][^'"`]*px['"`])/g)) {
      if (m[1] === '0') continue;
      add(file, lineOf(text, m.index), 'px-font', m[0], lines);
    }
    for (const m of text.matchAll(/fontSize\s*=\s*(\{\s*\d+(?:\.\d+)?\s*\}|['"]\d+(?:\.\d+)?(?:px)?['"])/g)) {
      add(file, lineOf(text, m.index), 'px-font', m[0], lines);
    }
  }
}

/* ---------- report ---------- */

problems.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
const byRule = {};
for (const p of problems) byRule[p.rule] = (byRule[p.rule] ?? 0) + 1;
const ruleLine = Object.entries(byRule)
  .map(([r, n]) => `${r} ${n}`)
  .join(', ');

if (!problems.length) {
  console.log(`check-brand: ${files.length} files, no brand drift in ${targets.join(', ')}.`);
  process.exit(0);
}
if (summary) {
  const byFile = {};
  for (const p of problems) byFile[p.file] = (byFile[p.file] ?? 0) + 1;
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${f}`);
} else {
  for (const p of problems) console.log(`${p.file}:${p.line}  ${p.rule.padEnd(12)}  ${p.text}`);
}
console.log(
  `\ncheck-brand: ${problems.length} finding${problems.length === 1 ? '' : 's'} in ${files.length} files (${ruleLine}). ` +
    'Fix with tokens from docs/brand/tokens.css; see docs/brand/brand-guide.md section 13.',
);
process.exit(1);
