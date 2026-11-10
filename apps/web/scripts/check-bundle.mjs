#!/usr/bin/env node
/**
 * Release bundle check: fails when a built bundle holds something a release must not ship.
 *
 *   node scripts/check-bundle.mjs [dist] [--strava]
 *
 * Always refused: the developer gallery, the pager lab, the test stubs and their route. Refused unless `--strava` is given
 * (the owner's development build): any Strava code or wording, and the feature intro sheets. App Review Guideline 2.5.19
 * asks for a feature that is not offered to be absent from the binary, not switched off, so the proof is a search of the
 * files that ship.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const withStrava = args.includes('--strava');
const dist = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'dist');

const RULES = [
  { name: 'developer gallery', re: /UiGallery|PagerLab|StubRoots|StubPushed|dev\/ui|__splashHides/ },
  ...(withStrava ? [] : [{ name: 'Strava', re: /Strava|\/strava\// }, { name: 'feature intro sheets', re: /FeatureIntro|intro-sheet/ }]),
];

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|css|html|json|webmanifest)$/.test(e.name)) files.push(p);
  }
};
if (!fs.existsSync(dist)) {
  console.error(`check-bundle: ${dist} does not exist. Build first.`);
  process.exit(2);
}
walk(dist);

let bad = 0;
for (const f of files) {
  const rel = path.relative(dist, f);
  const text = fs.readFileSync(f, 'utf8');
  for (const rule of RULES) {
    // the file's own name counts too: a chunk called UiGallery-abc.js is a hit
    const inName = rule.re.exec(rel);
    const inText = rule.re.exec(text);
    if (!inName && !inText) continue;
    bad++;
    const at = inText ? text.slice(Math.max(0, inText.index - 40), inText.index + 60).replace(/\s+/g, ' ') : rel;
    console.error(`check-bundle: ${rule.name} in ${rel}: ...${at}...`);
  }
}
if (bad) {
  console.error(`check-bundle: ${bad} hit${bad === 1 ? '' : 's'} in ${dist}. This bundle must not ship.`);
  process.exit(1);
}
console.log(`check-bundle: ${files.length} files clean in ${dist}${withStrava ? ' (Strava allowed)' : ''}.`);
