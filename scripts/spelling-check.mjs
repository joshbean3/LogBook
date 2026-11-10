#!/usr/bin/env node
// Fails on British spellings in the app's words (Logbook 1.0 is American English, docs/launch/plan.md Contract C8).
//
//   node scripts/spelling-check.mjs            check apps/web/src
//   node scripts/spelling-check.mjs <dir>...   check other folders
//
// It reads what a person can see: string literals, template strings and JSX text, from the TypeScript syntax tree, so
// identifiers, comments and CSS are not checked. Tests and the developer gallery (src/app/dev) are skipped.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(ROOT, 'apps', 'web', 'package.json'))('typescript');

/** British form, and the American one to use. Whole words, any case. */
export const BRITISH = [
  [/\bcolour(s|ed|ful|ing)?\b/i, 'color'],
  [/\b(un)?favourit(e|es|ed|ing)\b/i, 'favorite'],
  [/\bkilometres?\b/i, 'kilometer'],
  [/\bmetres?\b/i, 'meter'],
  [/\bcentre(s|d)?\b/i, 'center'],
  [/\bbehaviours?\b/i, 'behavior'],
  [/\bhonour(s|ed)?\b/i, 'honor'],
  [/\b(organis|personalis|recognis|apologis|prioritis|customis|summaris|minimis|maximis)(e|es|ed|ing|ation)\b/i, '-ize'],
  [/\banalys(e|es|ed|ing)\b/i, 'analyze'],
  [/\bcatalogue(s)?\b/i, 'catalog'],
  [/\bjewellery\b/i, 'jewelry'],
];

/** Every visible string in one source file, with its line. */
export const textsIn = (source, name = 'file.tsx') => {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const take = (text, node) => out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return; // module paths are not words
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) take(n.text, n);
    else if (ts.isTemplateExpression(n)) take(n.head.text + n.templateSpans.map((s) => ` ${s.literal.text}`).join(''), n);
    else if (ts.isJsxText(n) && n.text.trim()) take(n.text, n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
};

/** The British spellings in a source text: `{ line, word, use }`. */
export const britishIn = (source, name) => {
  const found = [];
  for (const { line, text } of textsIn(source, name)) {
    for (const [re, us] of BRITISH) {
      const m = text.match(re);
      if (m) found.push({ line, word: m[0], use: us, text: text.trim().slice(0, 80) });
    }
  }
  return found;
};

const files = (dir, list = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dev') files(p, list);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec|d)\.tsx?$/.test(e.name)) list.push(p);
  }
  return list;
};

export const check = (dirs = [path.join(ROOT, 'apps', 'web', 'src')]) => {
  const out = [];
  for (const d of dirs) for (const f of files(d).sort()) for (const hit of britishIn(fs.readFileSync(f, 'utf8'), f)) out.push({ file: path.relative(ROOT, f), ...hit });
  return out;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dirs = process.argv.slice(2).map((d) => path.resolve(d));
  const hits = check(dirs.length ? dirs : undefined);
  if (hits.length) {
    for (const h of hits) console.error(`${h.file}:${h.line}: "${h.word}" is British. Use the American spelling (${h.use}). In: ${h.text}`);
    console.error(`spelling: ${hits.length} British spelling(s) in the app's words.`);
    process.exit(1);
  }
  console.log('spelling: American throughout');
}
