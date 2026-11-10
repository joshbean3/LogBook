// The acknowledgments page: every shipped dependency, the native code and the fonts, read from disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, fonts, nativePackages, walkDependencies, woff2Names } from './notices.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('fonts: the copyright is read from each font file, under the Open Font License', () => {
  const n = woff2Names(path.join(root, 'apps/web/public/fonts/Inter-latin.woff2'));
  assert.match(n[0], /Copyright 2016 The Inter Project Authors/);
  assert.equal(n[1], 'Inter');
  const list = fonts();
  assert.deepEqual(list.map((f) => f.name).sort(), ['Fraunces (font)', 'Inter (font)', 'Inter Tight (font)']);
  for (const f of list) {
    assert.match(f.text, /^Copyright/);
    assert.match(f.text, /SIL OPEN FONT LICENSE/);
  }
});

test('web dependencies: every production dependency of the app is listed, with a license', () => {
  const listed = walkDependencies();
  const names = new Set(listed.map((p) => p.name));
  const deps = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'apps/web/package.json'), 'utf8')).dependencies);
  for (const d of deps) if (!d.startsWith('@logbook/')) assert.ok(names.has(d), `${d} is listed`);
  // what our own shared package depends on ships too
  assert.ok(names.has('zod'));
  assert.ok(![...names].some((n) => n.startsWith('@logbook/')), 'our own packages are left out');
  // indirect dependencies are there
  assert.ok(names.has('scheduler') && names.has('motion-dom'));
  for (const p of listed) assert.ok(p.license, `${p.name} names a license`);
  assert.ok(listed.filter((p) => p.text).length >= listed.length - 2, 'nearly every package carries its license text');
});

test('native code: Capacitor for iOS and every Swift package a plugin pulls in', () => {
  const names = nativePackages().map((p) => p.name);
  assert.ok(names.some((n) => /capacitor-swift-pm/.test(n)));
  assert.ok(names.includes('ion-ios-filesystem'));
  for (const p of nativePackages()) assert.match(p.text, /Permission is hereby granted/);
});

test('page: one h1, lang, viewport, no script, no outside asset, license text kept as written', () => {
  const html = build();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
  assert.equal(html.match(/<h1[ >]/g).length, 1);
  assert.doesNotMatch(html, /<script|<link |<img /);
  assert.match(html, /<pre>Copyright 2016 The Inter Project Authors[^\n]*\n\nSIL OPEN FONT LICENSE\n/);
  assert.match(html, /<h3>react <span class="ver">/);
});
