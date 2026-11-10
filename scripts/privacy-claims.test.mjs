// Tests for the privacy sentence check. Run with: pnpm test:scripts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { claimsIn, fixedParts, unlisted } from './privacy-claims.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const texts = (src) => claimsIn(src).map((c) => c.text);

test('finds a claim in a string, a template string and screen text', () => {
  const src = [
    "export const PROMISE = 'Your data is yours. It is never sold.';",
    'const days = 5;',
    'export const gone = `Backups clear within ${days} days. Anthropic deletes what was sent to Claude within 30 days.`;',
    'export const A = () => <p className="x">Kept on this phone only.</p>;',
  ].join('\n');
  assert.deepEqual(texts(src), ['Your data is yours. It is never sold.', 'Backups clear within ${} days. Anthropic deletes what was sent to Claude within 30 days.', 'Kept on this phone only.']);
  assert.equal(claimsIn(src)[2].line, 4);
});

test('reads screen text across inline tags and computed values as one sentence', () => {
  const src = 'export const A = ({ n }: { n: number }) => (<p>Logbook <strong>only reads</strong>. Backups clear within {n} days.</p>);';
  assert.deepEqual(texts(src), ['Logbook only reads. Backups clear within ${} days.']);
});

test('ignores comments, code, identifiers and plain interface copy', () => {
  const src = [
    '// Nothing here is ever sent to Claude, says this comment.',
    '/** It is never sold. */',
    "const code = 'claude_busy';",
    "const label = 'Add a habit';",
    'export const A = () => <button onClick={() => go()}>Save</button>;',
  ].join('\n');
  assert.deepEqual(texts(src), []);
});

test('a sentence is listed when every fixed part of it is in the document', () => {
  const claims = [{ file: 'a.tsx', line: 1, text: 'Backups clear within ${} days. Anthropic deletes what was sent to Claude within 30 days.' }];
  assert.deepEqual(fixedParts(claims[0].text), ['Backups clear within', 'days. Anthropic deletes what was sent to Claude within 30 days.']);
  assert.deepEqual(unlisted(claims, '| `Backups clear within ${} days. Anthropic deletes what was sent to Claude within 30 days.` | sheet |'), []);
  assert.equal(unlisted(claims, 'Backups clear within 5 days.').length, 1);
  // curly quotes and line breaks in the source do not hide a sentence
  assert.deepEqual(unlisted([{ file: 'a.tsx', line: 1, text: "Write it as you'd say it. Claude reviews the wording." }], 'Write it as you’d say it.\nClaude reviews the wording.'), []);
});

test('a reworded sentence is not covered by the old row', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/launch/privacy-claims.md'), 'utf8');
  const one = (text) => unlisted([{ file: 'x.tsx', line: 1, text }], doc).length;
  assert.equal(one('Your data is yours. It is never sold. It goes to Claude only when you say so.'), 0);
  assert.equal(one('Your data is yours. It is never sold or shared.'), 1);
  assert.equal(one('On. A short health summary goes with your question.'), 1);
  assert.equal(one('Your data is yours. It never leaves this phone.'), 1);
});

test('the document names each Claude call site', () => {
  const doc = fs.readFileSync(path.join(root, 'docs/launch/privacy-claims.md'), 'utf8');
  for (const site of ['services/assistant.ts', 'draftPlan', 'refineGoal', 'claudeSummary', 'claudePicker.generate', 'requireAiPermission', 'mayWriteRecall', 'mayPickReads', 'assistantMayReadTraining']) assert.ok(doc.includes(site), site);
});
