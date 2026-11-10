#!/usr/bin/env node
// Writes apps/web/public/legal/acknowledgements.html: the license of every piece of other people's work that ships
// inside Logbook, so the copyright notices travel with the app as their licenses ask.
//
//   node scripts/notices.mjs           write the page
//   node scripts/notices.mjs --check   exit 1 if the committed page differs from what this would write
//
// What it lists, all read from disk:
//   - the web app's production dependencies and theirs, from node_modules (name, version, license, license file);
//   - the native code: Capacitor's iOS runtime (@capacitor/ios), and every Swift package a plugin's Package.swift pulls
//     in, from the license files kept in scripts/notices (a Swift package with no license file there is an error);
//   - the three fonts in apps/web/public/fonts, with the copyright read from each font file and the SIL Open Font
//     License text from scripts/notices/OFL-1.1.txt.
// Logbook's own packages (@logbook/*) are left out. Run it after adding or upgrading a dependency.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CSS } from './legal-pages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps', 'web');
const OUT = path.join(web, 'public', 'legal', 'acknowledgements.html');
const KEPT = path.join(root, 'scripts', 'notices');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$|^licen[cs]e[-.]/i;

// ---------- the web app's dependencies ----------
/** Every production dependency of `from` (a package folder), and theirs, once each, by name@version. */
export const walkDependencies = (from = web) => {
  const seen = new Map();
  const visit = (dir) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.optionalDependencies ?? {}) };
    for (const name of Object.keys(deps).sort()) {
      if (name.startsWith('@logbook/')) {
        // our own package: not listed, but what it depends on ships too
        const own = path.join(root, 'packages', name.split('/')[1]);
        if (fs.existsSync(path.join(own, 'package.json')) && !seen.has(name)) {
          seen.set(name, null);
          visit(own);
        }
        continue;
      }
      const at = resolve(dir, name);
      if (!at) {
        if (pkg.optionalDependencies?.[name]) continue;
        throw new Error(`${name} (needed by ${pkg.name}) is not installed. Run pnpm install.`);
      }
      const real = fs.realpathSync(at);
      const info = JSON.parse(fs.readFileSync(path.join(real, 'package.json'), 'utf8'));
      const key = `${info.name}@${info.version}`;
      if (seen.has(key)) continue;
      seen.set(key, { name: info.name, version: info.version, license: licenseName(info), text: licenseText(real), homepage: homepage(info) });
      visit(real);
    }
  };
  visit(from);
  return [...seen.values()].filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
};

/** Node's lookup: node_modules in this folder, then in each folder above it. */
const resolve = (dir, name) => {
  for (let d = dir; ; d = path.dirname(d)) {
    const p = path.join(d, 'node_modules', name);
    if (fs.existsSync(path.join(p, 'package.json'))) return p;
    if (path.dirname(d) === d) return null;
  }
};

const licenseName = (info) => {
  if (typeof info.license === 'string') return info.license;
  if (info.license?.type) return info.license.type;
  if (Array.isArray(info.licenses)) return info.licenses.map((l) => l.type ?? l).join(' OR ');
  return 'see the license text';
};

const licenseText = (dir) => {
  const file = fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort((a, b) => a.length - b.length)[0];
  return file ? fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n?/g, '\n').trim() : '';
};

const homepage = (info) => {
  const repo = typeof info.repository === 'string' ? info.repository : info.repository?.url;
  const url = info.homepage ?? repo ?? '';
  const clean = url.replace(/^git\+/, '').replace(/\.git$/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/');
  return /^https:\/\//.test(clean) ? clean : '';
};

// ---------- the native code ----------
/** Swift packages pulled in by a plugin, with the license file kept for each in scripts/notices. */
const SWIFT_PACKAGES = {
  'https://github.com/ionic-team/capacitor-swift-pm.git': { name: 'Capacitor for iOS (capacitor-swift-pm)', fromNpm: '@capacitor/ios' },
  'https://github.com/ionic-team/ion-ios-filesystem.git': { name: 'ion-ios-filesystem', file: 'ion-ios-filesystem.LICENSE', license: 'MIT', homepage: 'https://github.com/ionic-team/ion-ios-filesystem' },
};

export const nativePackages = () => {
  const urls = new Set();
  const pkg = JSON.parse(fs.readFileSync(path.join(web, 'package.json'), 'utf8'));
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    const at = name.startsWith('@logbook/') ? path.join(root, 'packages', name.split('/')[1]) : resolve(web, name);
    const swift = at && path.join(at, 'Package.swift');
    if (!swift || !fs.existsSync(swift)) continue;
    for (const m of fs.readFileSync(swift, 'utf8').matchAll(/\.package\(\s*url:\s*"([^"]+)"/g)) urls.add(m[1]);
  }
  const out = [];
  for (const url of [...urls].sort()) {
    const known = SWIFT_PACKAGES[url];
    if (!known) throw new Error(`${url} is a Swift package a plugin uses, with no license on file. Add its license to scripts/notices and to SWIFT_PACKAGES in scripts/notices.mjs.`);
    if (known.fromNpm) {
      const dir = fs.realpathSync(resolve(web, known.fromNpm));
      const info = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      out.push({ name: known.name, version: info.version, license: licenseName(info), text: licenseText(dir), homepage: url.replace(/\.git$/, '') });
    } else {
      out.push({ name: known.name, version: '', license: known.license, text: fs.readFileSync(path.join(KEPT, known.file), 'utf8').trim(), homepage: known.homepage });
    }
  }
  return out;
};

// ---------- the fonts ----------
const readBase128 = (buf, at) => {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[at.i++];
    value = value * 128 + (b & 0x7f);
    if (!(b & 0x80)) return value;
  }
  throw new Error('bad UIntBase128');
};

/** The `name` table strings of a WOFF2 file (copyright is name 0, family name 1), read with Node's own Brotli. */
export const woff2Names = (file) => {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${file} is not a WOFF2 font`);
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  const at = { i: 48 };
  const tables = [];
  for (let t = 0; t < numTables; t++) {
    const flags = buf[at.i++];
    const tagIndex = flags & 0x3f;
    let tag = '';
    if (tagIndex === 63) {
      tag = buf.toString('latin1', at.i, at.i + 4);
      at.i += 4;
    } else tag = tagIndex === 5 ? 'name' : `#${tagIndex}`;
    const version = (flags >> 6) & 3;
    const origLength = readBase128(buf, at);
    // glyf (10) and loca (11) are transformed unless version is 3; every other table only when version is not 0
    const transformed = tagIndex === 10 || tagIndex === 11 ? version !== 3 : version !== 0;
    const length = transformed ? readBase128(buf, at) : origLength;
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(at.i, at.i + compressedSize));
  let offset = 0;
  let name = null;
  for (const t of tables) {
    if (t.tag === 'name') name = data.subarray(offset, offset + t.length);
    offset += t.length;
  }
  if (!name) throw new Error(`${file} has no name table`);
  const count = name.readUInt16BE(2);
  const strings = name.readUInt16BE(4);
  const out = {};
  for (let r = 0; r < count; r++) {
    const base = 6 + r * 12;
    const platform = name.readUInt16BE(base);
    const id = name.readUInt16BE(base + 6);
    const len = name.readUInt16BE(base + 8);
    const off = strings + name.readUInt16BE(base + 10);
    if (platform !== 3 || id in out) continue; // Windows, Unicode: UTF-16 big endian
    const bytes = Buffer.from(name.subarray(off, off + len));
    bytes.swap16();
    out[id] = bytes.toString('utf16le');
  }
  return out;
};

/** One entry per font family in apps/web/public/fonts, with every distinct copyright line its files carry. */
export const fonts = () => {
  const dir = path.join(web, 'public', 'fonts');
  const families = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.woff2')).sort()) {
    const n = woff2Names(path.join(dir, f));
    const family = n[16] ?? n[1];
    const entry = families.get(family) ?? { name: family, copyrights: new Set(), license: n[13] ?? '', url: n[14] ?? '' };
    if (n[0]) entry.copyrights.add(n[0].trim());
    families.set(family, entry);
  }
  const ofl = fs.readFileSync(path.join(KEPT, 'OFL-1.1.txt'), 'utf8').trim();
  return [...families.values()].map((e) => {
    if (!/Open Font License|\/OFL\b|openfontlicense\.org/i.test(`${e.license} ${e.url}`)) throw new Error(`${e.name}: the font file does not say it is under the SIL Open Font License (it says "${e.license || e.url}")`);
    return { name: `${e.name} (font)`, version: '', license: 'OFL-1.1', text: `${[...e.copyrights].join('\n')}\n\n${ofl}`, homepage: '' };
  });
};

// ---------- the page ----------
const section = (p) => {
  const title = `${esc(p.name)}${p.version ? ` <span class="ver">${esc(p.version)}</span>` : ''}`;
  const link = p.homepage ? `\n  <p class="src"><a href="${esc(p.homepage)}">${esc(p.homepage.replace(/^https:\/\//, ''))}</a></p>` : '';
  const text = p.text
    ? `\n  <details>\n    <summary>License text</summary>\n    <pre>${esc(p.text)}</pre>\n  </details>`
    : '\n  <p>No license file is included with this package. Its license is named above.</p>';
  return `<section class="card">\n  <h3>${title}</h3>\n  <p class="lic">License: ${esc(p.license)}</p>${link}${text}\n</section>`;
};

const EXTRA_CSS = `
.ver { font-weight: 400; color: #2f5d85; }
.lic, .src { margin: 0 0 6px; font-size: 0.9375rem; }
details { margin-top: 8px; }
summary { cursor: pointer; padding: 11px 0; line-height: 22px; font-weight: 600; }
h1 { -webkit-hyphens: auto; hyphens: auto; }
summary:focus-visible { outline: 2px solid #0f2a44; outline-offset: 2px; border-radius: 4px; }
pre { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 0.8125rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #0f2a44; }
`.trim();

export const build = () => {
  const groups = [
    { title: 'Fonts', intro: 'The typefaces Logbook uses.', items: fonts() },
    { title: 'In the iPhone app', intro: 'Native code built into the iPhone app.', items: nativePackages() },
    { title: 'In the app', intro: 'Open source libraries the app is built with. Each is used under the license shown.', items: walkDependencies() },
  ];
  const body = groups
    .map((g) => `<h2>${esc(g.title)}</h2>\n<p>${esc(g.intro)}</p>\n${g.items.map(section).join('\n')}`)
    .join('\n');
  return `<!doctype html>
<!-- Written by scripts/notices.mjs from node_modules, scripts/notices and the font files. Do not edit: run the script. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="referrer" content="no-referrer" />
    <title>Acknowledgments · Logbook</title>
    <style>
${`${CSS}\n${EXTRA_CSS}`.split('\n').map((l) => `      ${l}`).join('\n')}
    </style>
  </head>
  <body>
    <header>
      <p class="brand">Logbook</p>
      <h1>Acknowl&shy;edgments</h1>
      <p class="dated">Logbook is built with the work of the people below. Thank you.</p>
    </header>
    <main>
${body}
    </main>
    <footer>
      <nav aria-label="More from Logbook">
        <ul>
          <li><a href="privacy.html">Privacy Policy</a></li>
          <li><a href="terms.html">Terms of Use</a></li>
          <li><a href="support.html">Help and contact</a></li>
        </ul>
      </nav>
    </footer>
  </body>
</html>
`;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const html = build();
  if (process.argv[2] === '--check') {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, 'utf8') !== html) {
      console.error('acknowledgements: apps/web/public/legal/acknowledgements.html is out of date: run node scripts/notices.mjs and commit');
      process.exit(1);
    }
    console.log('acknowledgements: the page matches the installed dependencies');
  } else {
    fs.writeFileSync(OUT, html);
    console.log(`acknowledgements: wrote apps/web/public/legal/acknowledgements.html`);
  }
}
