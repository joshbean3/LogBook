#!/usr/bin/env node
// Finds every sentence in the app that makes a privacy claim (what is sent, sold, stored, read or deleted, and every
// mention of Claude or Anthropic) and checks it against docs/launch/privacy-claims.md, where each one is listed beside
// the code that makes it true.
//
//   node scripts/privacy-claims.mjs --list            print every claim sentence with its file and line
//   node scripts/privacy-claims.mjs --check           exit 1 if a sentence in the app is not in privacy-claims.md
//   node scripts/privacy-claims.mjs --list --root DIR  the same, for another checkout
//
// A new or reworded privacy sentence fails the release until someone has read it against the code and listed it.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Words that make a sentence a privacy claim. */
export const CLAIM =
  /\b(Claude|Anthropic)\b|\bnever (sold|sells|sent|shared|writes|leaves|used|stored)\b|\b(is|are|was|were) (never|not) (sold|sent|shared|stored|saved|used)\b|\bnot sent\b|\bnothing is sent\b|\b(sent|goes|go) to (Claude|Anthropic|the assistant)\b|\bonly reads\b|\bsaved (to|on) (your Logbook account|Logbook's server|this phone|your phone)\b|\b(stays?|kept|stay) on (this|your) (phone|iPhone|device)\b|\bbackups?\b|\bwithin \d+ days\b|\b(sell|sells|sold)\b|\byour data is yours\b|\bremoved? from (our|the) (server|database)\b|\bdeletes? (your account|everything|the readings|what)\b|\bleaves? this phone\b|\bhealth (data|summary)\b|\bsummary of your health\b|\b(kept|stays?) private\b|\bon this (phone|iPhone) only\b|\bnever shared\b/i;

const norm = (s) =>
  s
    .replace(/\\(['"`])/g, '$1')
    .replace(/&apos;|&#39;|&rsquo;|[‘’]/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|[“”]/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const words = (s) => (s.match(/[A-Za-z][A-Za-z']+/g) ?? []).length;

/** The TypeScript parser the web app already uses: strings and JSX text are read from the syntax tree, never guessed. */
const ts = createRequire(path.join(HERE, 'apps', 'web', 'package.json'))('typescript');

/**
 * Every claim sentence in one source file: `{ line, text }`. A sentence is a string, a template string (its `${...}`
 * holes kept as `${}`), or the text of a JSX element, read across inline tags and `{...}` holes so "Backups clear
 * within {days} days." is one sentence.
 */
export const claimsIn = (source, name = 'file.tsx') => {
  const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const seen = new Set();
  const take = (raw, node) => {
    const text = norm(raw);
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (words(text) < 3 || !CLAIM.test(text.replace(/\$\{\}/g, ' ')) || seen.has(`${line}|${text}`)) return;
    seen.add(`${line}|${text}`);
    found.push({ line, text });
  };
  const isText = (n) => ts.isJsxText(n) && n.text.trim() !== '';
  /** The words of a JSX element as a reader sees them: text, inline elements' text, and `${}` for anything computed. */
  const flat = (n) => {
    if (ts.isJsxText(n)) return n.text;
    if (ts.isJsxExpression(n)) {
      if (!n.expression) return '';
      if (ts.isStringLiteralLike(n.expression)) return n.expression.text;
      return '${}';
    }
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) return n.children.map(flat).join('');
    return '';
  };
  const visit = (n, insideText) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) take(n.text, n);
    else if (ts.isTemplateExpression(n)) take(n.head.text + n.templateSpans.map((sp) => '${}' + sp.literal.text).join(''), n);
    else if ((ts.isJsxElement(n) || ts.isJsxFragment(n)) && !insideText && n.children.some(isText)) {
      take(flat(n), n);
      insideText = true; // its inline children are part of this sentence, not sentences of their own
    }
    ts.forEachChild(n, (c) => visit(c, insideText));
  };
  visit(sf, false);
  return found;
};

const sourceFiles = (dir, list = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'dev' && e.name !== 'node_modules') sourceFiles(p, list);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec|d)\.tsx?$/.test(e.name)) list.push(p);
  }
  return list;
};

/** Every claim sentence in the web app of the checkout at `root`. */
export const appClaims = (root = HERE) => {
  const src = path.join(root, 'apps', 'web', 'src');
  const out = [];
  for (const f of sourceFiles(src).sort()) for (const c of claimsIn(fs.readFileSync(f, 'utf8'), f)) out.push({ file: path.relative(root, f), ...c });
  return out;
};

/** The parts of a sentence that must appear in the document: its text between any `${...}` holes. */
export const fixedParts = (text) =>
  text
    .split('${}')
    .map((p) => p.trim())
    .filter((p) => p.length >= 12);

/** The sentences in the app that privacy-claims.md does not list. */
export const unlisted = (claims, doc) => {
  const hay = norm(doc.replace(/`/g, ''));
  return claims.filter((c) => {
    const parts = fixedParts(c.text);
    return !(parts.length ? parts : [c.text]).every((p) => hay.includes(p));
  });
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--root');
  const root = at >= 0 ? path.resolve(args[at + 1]) : HERE;
  const claims = appClaims(root);
  if (args.includes('--check')) {
    const doc = fs.readFileSync(path.join(HERE, 'docs', 'launch', 'privacy-claims.md'), 'utf8');
    const missing = unlisted(claims, doc);
    if (missing.length) {
      for (const c of missing) console.error(`privacy claims: not in docs/launch/privacy-claims.md: ${c.file}:${c.line}  ${c.text}`);
      console.error(`privacy claims: ${missing.length} of ${claims.length} sentences are not listed. Read each one against the code it describes, then add it to the table.`);
      process.exit(1);
    }
    console.log(`privacy claims: all ${claims.length} privacy sentences in the app are listed in docs/launch/privacy-claims.md`);
  } else {
    for (const c of claims) console.log(`${c.file}:${c.line}\t${c.text}`);
    console.error(`${claims.length} sentences`);
  }
}
