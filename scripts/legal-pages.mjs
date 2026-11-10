#!/usr/bin/env node
// Builds the four public pages in apps/web/public/legal from the texts in scripts/legal and the facts in
// docs/launch/legal-fields.json, so the publisher's name, the contact address, the provider names and the retention
// days are typed once and read the same on every page.
//
//   node scripts/legal-pages.mjs            write the pages
//   node scripts/legal-pages.mjs --check    exit 1 if the committed pages differ from what this would write
//   node scripts/legal-pages.mjs --release  --check, and exit 1 while the text is a draft or a fact is missing
//
// The pages are plain static HTML: one file each, no script, no outside asset. The server serves them at
// /legal/<name>.html from the web build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'scripts', 'legal');
const out = path.join(root, 'apps', 'web', 'public', 'legal');
const fieldsFile = path.join(root, 'docs', 'launch', 'legal-fields.json');

const PAGES = [
  { file: 'privacy.html', body: 'privacy.body.html', title: 'Privacy Policy', nav: 'Privacy Policy' },
  { file: 'health-privacy.html', body: 'health-privacy.body.html', title: 'Consumer Health Data Privacy Policy', nav: 'Consumer Health Data Privacy Policy' },
  { file: 'terms.html', body: 'terms.body.html', title: 'Terms of Use', nav: 'Terms of Use' },
  { file: 'support.html', body: 'support.body.html', title: 'Help and contact', nav: 'Help and contact', dated: false },
];

/** A fact the owner still has to give: what the page shows in its place while the text is a draft. */
const MISSING = {
  effectiveDate: 'date this text takes effect',
  publisher: 'legal name of the publisher',
  postalAddress: 'postal address of the publisher',
  supportEmail: 'support@example.com',
  governingState: 'state whose law governs',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const readFields = () => JSON.parse(fs.readFileSync(fieldsFile, 'utf8'));

/** What stops a release: the text is not approved, a fact is missing, or the contact address is the stand-in. */
export const problems = (f) => {
  const list = [];
  if (f.approved !== true) list.push('legal-fields.json: "approved" is not true (the pages still say Draft)');
  for (const k of Object.keys(MISSING)) if (!String(f[k] ?? '').trim()) list.push(`legal-fields.json: "${k}" is empty`);
  if (/@example\.(com|org|net)$/i.test(String(f.supportEmail ?? '').trim())) list.push('legal-fields.json: "supportEmail" is an example.com address');
  for (const k of ['hostingProvider', 'mailProvider', 'backupProvider', 'dataCountry']) if (!String(f[k] ?? '').trim()) list.push(`legal-fields.json: "${k}" is empty`);
  for (const k of ['snapshotDays', 'backupDays', 'purgeDays', 'logDays', 'mailLogDays', 'proposalDays', 'securityLogDays']) if (!(Number.isInteger(f[k]) && f[k] > 0)) list.push(`legal-fields.json: "${k}" must be a whole number of days`);
  return list;
};

const values = (f) => {
  const v = {};
  for (const [k, hint] of Object.entries(MISSING)) {
    const given = String(f[k] ?? '').trim();
    v[k] = given ? esc(given) : `<mark>${esc(hint)}</mark>`;
  }
  const email = String(f.supportEmail ?? '').trim() || MISSING.supportEmail;
  v.supportEmail = String(f.supportEmail ?? '').trim() ? esc(email) : `<mark>${esc(email)}</mark>`;
  v.supportMailto = `<a href="mailto:${esc(email)}">${v.supportEmail}</a>`;
  for (const k of ['hostingProvider', 'mailProvider', 'backupProvider', 'dataCountry']) v[k] = esc(f[k]);
  for (const k of ['snapshotDays', 'backupDays', 'purgeDays', 'logDays', 'mailLogDays', 'proposalDays', 'securityLogDays']) v[k] = esc(f[k]);
  // a deleted row can sit in a volume snapshot or an off-site backup: the longer of the two is the promise
  v.backupClearDays = esc(Math.max(Number(f.snapshotDays), Number(f.backupDays)));
  return v;
};

const fill = (text, v, where) =>
  text.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (!(k in v)) throw new Error(`${where}: unknown field {{${k}}}`);
    return v[k];
  });

export const CSS = `
:root { color-scheme: light; }
html { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 100%; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
@supports (font: -apple-system-body) { html { font: -apple-system-body; } }
body { margin: 0; background: #f3f8fb; color: #0f2a44; line-height: 1.55; overflow-wrap: break-word; }
main, header, footer { box-sizing: border-box; max-width: 42rem; margin: 0 auto; padding: 0 16px; }
header { padding-top: 28px; padding-bottom: 16px; }
.brand { margin: 0; font-size: 0.9375rem; font-weight: 600; color: #2f5d85; }
h1 { margin: 6px 0 4px; font-size: 1.75rem; line-height: 1.2; }
.dated { margin: 0 0 4px; font-size: 0.9375rem; color: #2f5d85; }
.draft { margin: 16px 0 0; padding: 12px 16px; border-radius: 12px; background: #ffe6d6; color: #0f2a44; font-size: 0.9375rem; }
h2 { margin: 28px 0 8px; font-size: 1.25rem; line-height: 1.3; }
h3 { margin: 20px 0 6px; font-size: 1.0625rem; line-height: 1.3; }
p, ul, ol, table { margin: 0 0 12px; }
ul, ol { padding-left: 1.25rem; }
li { margin-bottom: 6px; }
a { color: #0f2a44; text-decoration: underline; text-underline-offset: 2px; }
a:focus-visible { outline: 2px solid #0f2a44; outline-offset: 2px; border-radius: 4px; }
mark { background: #ffe6d6; color: #0f2a44; padding: 0 3px; border-radius: 4px; }
.card { background: #ffffff; border-radius: 22px; padding: 16px; margin: 0 0 12px; box-shadow: 0 1px 2px rgba(15,42,68,.04), 0 6px 20px rgba(15,42,68,.06); }
.card > :first-child { margin-top: 0; }
.card > :last-child { margin-bottom: 0; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
caption { text-align: left; font-weight: 600; padding-bottom: 6px; }
th, td { text-align: left; vertical-align: top; padding: 8px 8px 8px 0; border-top: 1px solid rgba(15,42,68,.16); overflow-wrap: anywhere; }
th:last-child, td:last-child { padding-right: 0; }
thead th { border-top: 0; font-size: 0.9375rem; color: #2f5d85; }
thead th:first-child { width: 38%; }
footer { padding-top: 12px; padding-bottom: 40px; font-size: 0.9375rem; }
footer ul { list-style: none; padding: 16px 0 0; margin: 0; border-top: 1px solid rgba(15,42,68,.16); }
footer li { margin: 0; }
footer a { display: inline-block; padding: 10px 0; min-height: 24px; }
`.trim();

const page = (p, f, v) => {
  const body = fill(fs.readFileSync(path.join(src, p.body), 'utf8'), v, p.body).trim();
  const draft = f.approved === true ? '' : '\n      <p class="draft" role="note"><strong>Draft.</strong> This text is waiting for approval and is not final yet.</p>';
  const dated = p.dated === false ? '' : `\n      <p class="dated">Effective ${v.effectiveDate}</p>`;
  const links = PAGES.filter((q) => q.file !== p.file)
    .map((q) => `        <li><a href="${q.file}">${esc(q.nav)}</a></li>`)
    .join('\n');
  return `<!doctype html>
<!-- Written by scripts/legal-pages.mjs from scripts/legal/${p.body} and docs/launch/legal-fields.json. Edit those, then run the script. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="referrer" content="no-referrer" />
    <title>${esc(p.title)} · Logbook</title>
    <style>
${CSS.split('\n').map((l) => `      ${l}`).join('\n')}
    </style>
  </head>
  <body>
    <header>
      <p class="brand">Logbook</p>
      <h1>${esc(p.title)}</h1>${dated}${draft}
    </header>
    <main>
${body.split('\n').map((l) => (l ? `      ${l}` : '')).join('\n')}
    </main>
    <footer>
      <nav aria-label="More from Logbook">
        <ul>
${links}
        </ul>
      </nav>
    </footer>
  </body>
</html>
`;
};

export const build = (f = readFields()) => {
  const v = values(f);
  return PAGES.map((p) => ({ file: p.file, html: page(p, f, v) }));
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv[2] ?? '';
  const f = readFields();
  const pages = build(f);
  if (mode === '--check' || mode === '--release') {
    const stale = pages.filter((p) => !fs.existsSync(path.join(out, p.file)) || fs.readFileSync(path.join(out, p.file), 'utf8') !== p.html).map((p) => p.file);
    const list = stale.map((x) => `apps/web/public/legal/${x} is out of date: run node scripts/legal-pages.mjs and commit`);
    if (mode === '--release') list.push(...problems(f));
    if (list.length) {
      for (const l of list) console.error(`legal pages: ${l}`);
      process.exit(1);
    }
    console.log(`legal pages: ${pages.length} pages match their sources${mode === '--release' ? ', approved, every fact given' : ''}`);
  } else {
    fs.mkdirSync(out, { recursive: true });
    for (const p of pages) fs.writeFileSync(path.join(out, p.file), p.html);
    console.log(`legal pages: wrote ${pages.map((p) => p.file).join(', ')}${f.approved === true ? '' : ' (draft)'}`);
  }
}
