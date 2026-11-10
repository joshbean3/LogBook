// Tests for the public legal and support pages. Run with: pnpm test:scripts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build, problems, readFields } from './legal-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'apps/web/public/legal');
const filled = { ...readFields(), approved: true, effectiveDate: 'December 1, 2026', publisher: 'Logbook Test LLC', postalAddress: '1 Test Street, Testville, CA 90000', supportEmail: 'help@logbook-app.test', governingState: 'California' };
const text = (html) => html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');

test('the committed pages are what the script writes', () => {
  for (const p of build()) assert.equal(fs.readFileSync(path.join(out, p.file), 'utf8'), p.html, `${p.file} is out of date: run node scripts/legal-pages.mjs`);
});

test('every page: lang, viewport, one h1, no outside asset, no script, no em dash', () => {
  for (const p of build()) {
    assert.match(p.html, /<html lang="en">/, p.file);
    assert.match(p.html, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/, p.file);
    assert.equal((p.html.match(/<h1[ >]/g) ?? []).length, 1, p.file);
    assert.doesNotMatch(p.html, /<script|<link|<img|@import|url\(/, p.file);
    assert.doesNotMatch(p.html, /\u2014/, p.file);
    assert.doesNotMatch(p.html, /\{\{/, p.file);
  }
});

test('a draft says Draft and marks what is missing; an approved text does neither', () => {
  for (const p of build({ ...readFields(), approved: false, publisher: '' })) assert.match(p.html, /class="draft"/, p.file);
  for (const p of build(filled)) {
    assert.doesNotMatch(p.html, /class="draft"|<mark>/, p.file);
    assert.doesNotMatch(p.html, /example\.com/, p.file);
  }
});

test('a release is refused while the text is a draft, a fact is missing or the address is a stand-in', () => {
  assert.deepEqual(problems(filled), []);
  assert.match(problems({ ...filled, approved: false }).join('\n'), /approved/);
  assert.match(problems({ ...filled, publisher: ' ' }).join('\n'), /publisher/);
  assert.match(problems({ ...filled, supportEmail: 'support@example.com' }).join('\n'), /example\.com/);
  assert.match(problems({ ...filled, backupDays: 0 }).join('\n'), /backupDays/);
});

test('privacy policy: names every processor, every AI flow, the three Health types and the retention days', () => {
  const t = text(build(filled).find((p) => p.file === 'privacy.html').html);
  for (const who of ['Logbook Test LLC', 'Anthropic', filled.hostingProvider, filled.mailProvider, filled.backupProvider]) assert.ok(t.includes(who), who);
  for (const flow of ['You ask the assistant', 'You draft or revise a plan', 'You review a goal', 'Remember when', 'Daily pick']) assert.ok(t.includes(flow), flow);
  for (const type of ['Sleep:', 'Heart rate variability.', 'Resting heart rate.']) assert.ok(t.includes(type), type);
  for (const flow of ['Your email address', 'journal entries and learnings', 'Links you save', 'Error reports', 'Reminders', 'Cards you share', 'Server logs', 'our server fetches that page']) assert.ok(t.includes(flow), flow);
  assert.match(t, /Server snapshots 5 days\./);
  assert.match(t, /Off-site backups 5 days\./);
  assert.match(t, /Removed for good within 30 days\./);
  assert.match(t, /Deleted by Anthropic within 30 days\. Up to 2 years if flagged/);
  assert.match(t, /We do not delete accounts for being inactive\./);
  assert.match(t, /never sold/);
  assert.doesNotMatch(t, /Strava/);
  assert.doesNotMatch(t, /never shared|Apple Health data/);
});

test('the backup promise follows the longer of the two windows', () => {
  const t = text(build({ ...filled, snapshotDays: 5, backupDays: 14 }).find((p) => p.file === 'privacy.html').html);
  assert.match(t, /copies in snapshots and backups are gone within 14 days/);
});

test('health data policy: what, from where, why, who receives it, rights with an appeal, no outside collection', () => {
  const t = text(build(filled).find((p) => p.file === 'health-privacy.html').html);
  for (const part of ['The health data we collect', 'Where it comes from', 'Why we collect it', 'who receives it', 'you can appeal', 'No other company collects', 'Withdraw consent', 'Never sleep, heart rate variability or resting heart rate']) assert.ok(t.includes(part), part);
  for (const who of ['Anthropic', filled.hostingProvider, filled.mailProvider, filled.backupProvider]) assert.ok(t.includes(who), who);
});

test('terms: 18 or older, not medical advice, the AI terms, ending and contact', () => {
  const t = text(build(filled).find((p) => p.file === 'terms.html').html);
  assert.match(t, /You must be 18 or older/);
  assert.match(t, /Logbook is for fitness and wellness\. It is not medical advice\. Talk to a doctor before changing your training, and if something feels wrong\./);
  assert.match(t, /The assistant is AI\. It runs on Claude, a model made by Anthropic\./);
  assert.match(t, /It can be wrong/);
  for (const h of ['Acceptable use', 'Ending', 'Limit of liability', 'Governing law', 'Contact']) assert.ok(t.includes(h), h);
  assert.ok(t.includes('help@logbook-app.test'));
});

test('support: the contact address and the four short answers', () => {
  const html = build(filled).find((p) => p.file === 'support.html').html;
  assert.match(html, /<a href="mailto:help@logbook-app\.test">help@logbook-app\.test<\/a>/);
  const t = text(html);
  for (const a of ['I forgot my password', 'Delete my account', 'Disconnect Apple Health', 'Export my data']) assert.ok(t.includes(a), a);
});

test('the app\'s medical line and the terms use the same words', () => {
  const copy = path.join(root, 'apps/web/src/lib/copy.ts');
  const line = /DISCLAIMER = '([^']+)'/.exec(fs.readFileSync(copy, 'utf8'))[1];
  assert.ok(text(build(filled).find((p) => p.file === 'terms.html').html).includes(line));
});
