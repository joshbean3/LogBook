// Orby brand guide deck, v1.1. pptxgenjs, structured: theme, layouts, placeholders, sections.
// Fonts: body runs name Inter, captions Inter Tight. Every Fraunces setting is rendered to an image (fr()), so headlines
// keep the exact face on any computer; the title placeholder keeps the words for the outline and screen readers.
// Wordmarks are embedded as SVG (with a PNG fallback) by a post-process after writeFile.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pptxgen = require('pptxgenjs');
const JSZip = require('jszip');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { applyTheme } = require('/root/.claude/skills/synced/b3c8944b-fd19-427b-9f5d-0392c7795c1f_ebb07331-d6be-4b16-870b-4389124e05d9/pptx/scripts/apply_theme.js');

const IMG = path.join(__dirname, 'img');
const FR = path.join(__dirname, 'img-fr');
fs.mkdirSync(FR, { recursive: true });
const B = '/home/user/LogBook/docs/brand';
const OUT = process.argv[2] || `${B}/Orby Brand Guide.pptx`;
const GEO = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-LogBook/203fe2a6-2bdf-53d9-a92e-1cbd9356aa24/scratchpad/brand/final/out/geom.json', 'utf8'));

const THEME = {
  name: 'Orby Sunrise', headFontFace: 'Fraunces', bodyFontFace: 'Inter',
  colors: { dk1: '0E2236', lt1: 'FFFDF8', dk2: '46596D', lt2: 'EAF5FC', accent1: '38B6F2', accent2: 'F2600C', accent3: '0A6CA6', accent4: 'CBE8F8', accent5: '1B4870', accent6: 'FFB680', hlink: '0A6CA6', folHlink: '1B4870' },
};
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Orby'; pres.company = 'Orby'; pres.title = 'Orby Brand Guide'; pres.subject = 'Brand guide v1.1, Sunrise optimism';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const K = { ink: C.text1, paper: C.background1, dusk: C.text2, cloud: C.background2, sky: C.accent1, sunrise: C.accent2, deep: C.accent3, haze: C.accent4, twilight: C.accent5, apricot: C.accent6, ember: 'B4430C', linen: 'F6F0E5', signal: 'B42340', pencil: '7A8794', line: 'E3E5E7', lineStrong: 'C9CED3', lagoon: '117A74', white: 'FFFFFF' };
const HEX = { ink: '0E2236', paper: 'FFFDF8', dusk: '46596D', cloud: 'EAF5FC', sky: '38B6F2', sunrise: 'F2600C', deep: '0A6CA6', haze: 'CBE8F8', twilight: '1B4870', apricot: 'FFB680', ember: 'B4430C' };
const W = 13.333, X0 = 0.6, CW = 12.133;
const BODY = 'Inter', CAPF = 'Inter Tight';
const sz = (n) => Math.max(12, n || 14);

// ---------- images ----------
const pngSize = (file) => { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
function place(file, o) {
  const { w, h } = pngSize(file); const r = w / h;
  let ww = o.w, hh = o.h;
  if (ww && !hh) hh = ww / r;
  if (hh && !ww) ww = hh * r;
  if (o.w && o.h) { if (o.w / o.h > r) { ww = o.h * r; hh = o.h; } else { ww = o.w; hh = o.w / r; } }
  let x = o.x, y = o.y;
  if (o.cx !== undefined) x = o.cx - ww / 2;
  if (o.w && o.h && o.cx === undefined && o.center !== false) x = o.x + (o.w - ww) / 2;
  if (o.w && o.h && o.middle) y = o.y + (o.h - hh) / 2;
  return { x, y, w: ww, h: hh };
}
function img(s, name, o) {
  const file = path.join(IMG, name); const p = place(file, o);
  s.addImage({ path: file, ...p, altText: o.alt || '', objectName: o.name || name });
  return p;
}
// a wordmark as SVG (post-processed) over its PNG fallback
const WM = { ink: { png: 'wordmark-ink.png', svg: `${B}/assets/wordmark-ink.svg` }, paper: { png: 'wordmark-paper.png', svg: `${B}/assets/wordmark-paper.svg` } };
function wordmark(s, tone, o) {
  const vb = fs.readFileSync(WM[tone].svg, 'utf8').match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const w = o.w || o.h * vb[2] / vb[3], h = o.h || o.w * vb[3] / vb[2];
  const x = o.cx !== undefined ? o.cx - w / 2 : o.x;
  s.addImage({ path: path.join(IMG, WM[tone].png), x, y: o.y, w, h, altText: 'Orby', objectName: `svg:wordmark-${tone}` });
  return { x, y: o.y, w, h };
}
// lockups built from the construction (guide 2.3): the Orb render plus the vector wordmark
function lockupH(s, tone, o) { // o: x, y, w
  const U = GEO.horiz[2], Hu = GEO.horiz[3] - GEO.horiz[1], k = o.w / U, top = -GEO.horiz[1];
  const D = GEO.H.D * k, box = D * 100 / 96;
  const orbCy = o.y + (top + 10 - GEO.H.D / 2) * k;
  s.addImage({ path: path.join(IMG, 'mark.png'), x: o.x + D / 2 - box / 2, y: orbCy - box / 2, w: box, h: box, altText: 'Orb', objectName: 'lockup Orb' });
  wordmark(s, tone, { x: o.x + (GEO.H.D + GEO.H.gap) * k, y: o.y, w: (GEO.wm.x2 - GEO.wm.x1) * k });
  return { w: o.w, h: Hu * k };
}
function lockupS(s, tone, o) { // o: cx, y, w (wordmark width)
  const k = o.w / (GEO.wm.x2 - GEO.wm.x1), D = GEO.V.D * k, box = D * 100 / 96;
  s.addImage({ path: path.join(IMG, 'mark.png'), x: o.cx - box / 2, y: o.y + D / 2 - box / 2, w: box, h: box, altText: 'Orb', objectName: 'lockup Orb' });
  wordmark(s, tone, { cx: o.cx, y: o.y + D + GEO.V.gap * k, w: o.w });
  return { h: D + GEO.V.gap * k + 1988 * k };
}

// ---------- Fraunces as images ----------
const jobs = [];
function fr(s, text, o) {
  const size = o.size || 20, weight = o.weight || 700, color = o.color || HEX.ink;
  const key = crypto.createHash('md5').update(JSON.stringify([text, o.w, o.h, size, weight, o.italic, color, o.align, o.lh, o.valign])).digest('hex').slice(0, 12);
  const file = path.join(FR, key + '.png');
  jobs.push({ file, text, w: o.w, h: o.h, size, weight, italic: !!o.italic, color, align: o.align || 'left', lh: o.lh || 1.12, valign: o.valign || 'top', track: o.track ?? (size >= 28 ? -0.015 : 0) });
  s.addImage({ path: file, x: o.x, y: o.y, w: o.w, h: o.h, altText: text, objectName: o.name || 'Fraunces text' });
}
async function renderJobs() {
  const css = `@font-face{font-family:'Fr';src:url(file://${B}/fonts/fraunces-latin-full-normal.woff2) format('woff2');font-weight:100 900}
@font-face{font-family:'Fr';src:url(file://${B}/fonts/fraunces-latin-full-italic.woff2) format('woff2');font-weight:100 900;font-style:italic}
*{margin:0;padding:0}html,body{background:transparent}`;
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 3 });
  const seen = new Set();
  for (const j of jobs) {
    if (seen.has(j.file)) continue; seen.add(j.file);
    const w = Math.round(j.w * 96), h = Math.round(j.h * 96);
    await p.setViewportSize({ width: w, height: h });
    const just = j.valign === 'middle' ? 'center' : j.valign === 'bottom' ? 'flex-end' : 'flex-start';
    await p.setContent(`<html><head><style>${css}</style></head><body><div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;justify-content:${just};font-family:Fr;font-variation-settings:'SOFT' 100,'WONK' 0;font-optical-sizing:auto;font-weight:${j.weight};font-style:${j.italic ? 'italic' : 'normal'};font-size:${j.size * 96 / 72}px;line-height:${j.lh};letter-spacing:${j.track}em;color:#${j.color};text-align:${j.align}"><div>${j.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</div></div></body></html>`);
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(40);
    await p.screenshot({ path: j.file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  }
  await b.close();
  console.log('rendered', seen.size, 'Fraunces images');
}

// ---------- text helpers ----------
function cap(s, text, o) {
  const size = sz(o.size || 12);
  s.addText(text.toUpperCase(), { x: o.x, y: o.y, w: o.w, h: o.h || 0.3, fontFace: CAPF, bold: true, fontSize: size, charSpacing: +(size * 0.14).toFixed(2), color: o.color || K.dusk, align: o.align || 'center', valign: o.valign || 'top', margin: 0, isTextBox: true, objectName: o.name || 'caption' });
}
function txt(s, text, o) {
  s.addText(text, { x: o.x, y: o.y, w: o.w, h: o.h, fontSize: sz(o.size), fontFace: BODY, color: o.color || K.ink, bold: !!o.bold, align: o.align || 'left', valign: o.valign || 'top', margin: o.margin ?? 0, isTextBox: true, lineSpacingMultiple: o.lsm || 1.12, paraSpaceAfter: o.psa || 0, objectName: o.name || 'text', fit: 'none' });
}
const LINE = { type: 'solid', pt: 0.75, color: K.line }, NONE = { type: 'none' };
function spec(s, rows, o) {
  const lw = o.lw || 1.55, size = sz(o.size || 12), pad = o.pad ?? 5;
  const data = rows.map((r, i) => {
    const bd = [i ? LINE : NONE, NONE, i === rows.length - 1 ? NONE : LINE, NONE];
    return [
      { text: r[0].toUpperCase(), options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.6, color: K.dusk, valign: 'top', margin: [pad, 6, pad, 0], border: bd } },
      { text: r[1], options: { fontFace: BODY, fontSize: size, color: K.ink, valign: 'top', margin: [pad, 0, pad, 6], border: bd } },
    ];
  });
  s.addTable(data, { x: o.x, y: o.y, w: o.w, colW: [lw, o.w - lw], fontFace: BODY, fontSize: size, color: K.ink, objectName: o.name || 'spec table', autoPage: false });
}
function doDont(s, pairs, o) {
  const size = sz(o.size || 12), pad = o.pad ?? 5;
  const head = [
    { text: 'DO', options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color: K.deep, margin: [1, 6, 6, 0], border: [NONE, NONE, LINE, NONE] } },
    { text: "DON'T", options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color: K.signal, margin: [1, 6, 6, 10], border: [NONE, NONE, LINE, NONE] } },
  ];
  const data = [head, ...pairs.map((p, i) => [
    { text: p[0], options: { fontFace: BODY, fontSize: size, color: K.ink, margin: [pad, 8, pad, 0], valign: 'top', border: [NONE, NONE, i === pairs.length - 1 ? NONE : LINE, NONE] } },
    { text: p[1], options: { fontFace: BODY, fontSize: size, color: K.dusk, margin: [pad, 0, pad, 10], valign: 'top', border: [NONE, NONE, i === pairs.length - 1 ? NONE : LINE, NONE] } },
  ])];
  s.addTable(data, { x: o.x, y: o.y, w: o.w, colW: o.colW || [o.w / 2, o.w / 2], fontFace: BODY, fontSize: size, objectName: o.name || 'do and dont table', autoPage: false });
}
function rrect(s, o) {
  const opts = { x: o.x, y: o.y, w: o.w, h: o.h, fill: { color: o.fill || K.paper }, objectName: o.name || 'shape' };
  const shape = o.r ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE;
  if (o.r) opts.rectRadius = Math.min(o.r, Math.min(o.w, o.h) / 2);
  opts.line = o.line ? { color: o.line, width: o.lw || 0.75, dashType: o.dash } : { type: 'none' };
  if (o.shadow) opts.shadow = { type: 'outer', color: '0E2236', opacity: 0.14, blur: 12, offset: 4, angle: 90 };
  s.addShape(shape, opts);
}
function circle(s, o) {
  s.addShape(pres.shapes.OVAL, { x: o.cx - o.d / 2, y: o.cy - o.d / 2, w: o.d, h: o.d, fill: o.fill ? { color: o.fill } : { type: 'none' }, line: o.line ? { color: o.line, width: o.lw || 1 } : { type: 'none' }, objectName: o.name || 'circle' });
}
function pill(s, label, o) {
  rrect(s, { x: o.x, y: o.y, w: o.w, h: o.h, r: o.h / 2, fill: o.fill, line: o.line, shadow: o.shadow, name: o.name || 'pill' });
  if (label) txt(s, label, { x: o.x, y: o.y, w: o.w, h: o.h, align: 'center', valign: 'middle', size: o.size || 14, bold: o.bold, color: o.color || K.ink, name: 'pill label' });
}
// a Cloud panel aligned to the margin, for component crops
function panel(s, o) { rrect(s, { x: o.x, y: o.y, w: o.w, h: o.h, r: 0.24, fill: o.fill || K.cloud, name: 'panel' }); }

// ---------- layouts ----------
const capOpts = (x, y, w, align, color) => ({ x, y, w, h: 0.26, fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color, align, valign: 'top', margin: 0 });
pres.defineSlideMaster({
  title: 'Orby Content', background: { path: path.join(IMG, 'bg-grid.png') }, margin: [0.5, 0.6, 0.5, 0.6],
  objects: [
    { text: { text: 'ORBY BRAND GUIDE', options: capOpts(X0, 0.34, 4, 'left', K.ink) } },
    { text: { text: 'VERSION 1.1  /  NOVEMBER 2026', options: capOpts(W - X0 - 5, 0.34, 5, 'right', K.dusk) } },
    { text: { text: 'ONE GOOD DAY AT A TIME', options: capOpts(X0, 7.02, 5, 'left', K.dusk) } },
    { placeholder: { options: { name: 'eyebrow', type: 'body', x: X0, y: 0.8, w: 9, h: 0.28, fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color: K.deep, margin: 0, valign: 'top' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: X0, y: 1.08, w: CW, h: 0.66, fontFace: 'Fraunces', bold: true, fontSize: 32, color: K.paper, margin: 0, valign: 'top', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'lede', type: 'body', x: X0, y: 1.76, w: CW, h: 0.52, fontFace: BODY, fontSize: 15, color: K.dusk, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  ],
  slideNumber: { x: W - X0 - 0.8, y: 7.02, w: 0.8, h: 0.26, fontFace: CAPF, fontSize: 12, color: K.dusk, align: 'right', valign: 'top', margin: 0 },
});
pres.defineSlideMaster({
  title: 'Orby Cover', background: { color: HEX.cloud },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.64, y: 4.0, w: 6, h: 0.6, fontFace: 'Fraunces', bold: true, fontSize: 30, color: K.ink, margin: 0, valign: 'top' }, text: '' } }],
});
pres.defineSlideMaster({
  title: 'Orby Section', background: { color: HEX.twilight },
  objects: [
    { text: { text: 'ORBY BRAND GUIDE', options: capOpts(X0, 0.34, 4, 'left', K.haze) } },
    { text: { text: 'VERSION 1.1  /  NOVEMBER 2026', options: capOpts(W - X0 - 5, 0.34, 5, 'right', K.haze) } },
    { placeholder: { options: { name: 'title', type: 'title', x: X0, y: 2.95, w: 7, h: 0.9, fontFace: 'Fraunces', bold: true, fontSize: 44, color: K.twilight, margin: 0, valign: 'top' }, text: '' } },
  ],
  slideNumber: { x: W - X0 - 0.8, y: 7.02, w: 0.8, h: 0.26, fontFace: CAPF, fontSize: 12, color: K.haze, align: 'right', valign: 'top', margin: 0 },
});

// ---------- slide factories ----------
let section = '';
function sec(t) { section = t; pres.addSection({ title: t }); }
function content(eyebrow, title, lede, notes) {
  const s = pres.addSlide({ masterName: 'Orby Content', sectionTitle: section });
  s.addText(eyebrow.toUpperCase(), { placeholder: 'eyebrow' });
  s.addText([{ text: title, options: { transparency: 100 } }], { placeholder: 'title' });
  fr(s, title, { x: X0, y: 1.08, w: CW, h: 0.66, size: 32, weight: 700, name: 'title image' });
  if (lede) s.addText(lede, { placeholder: 'lede' });
  s.addNotes(notes);
  return s;
}
function opener(num, title, line, notes) {
  sec(`${num} ${title}`);
  const s = pres.addSlide({ masterName: 'Orby Section', sectionTitle: section });
  s.addText([{ text: title, options: { transparency: 100 } }], { placeholder: 'title' });
  fr(s, num, { x: X0, y: 1.75, w: 3, h: 1.1, size: 72, weight: 700, color: HEX.apricot, name: 'section number' });
  fr(s, title, { x: X0, y: 2.95, w: 7.2, h: 1.55, size: 44, weight: 700, lh: 1.05, color: HEX.paper, name: 'section title' });
  txt(s, line, { x: X0, y: 4.75, w: 6.4, h: 1.0, size: 18, color: K.haze });
  img(s, 'opener-art.png', { x: 8.1, y: 1.35, w: 4.6, alt: 'A half-sun rising on a horizon, with rings' });
  s.addNotes(notes);
  return s;
}

// =====================================================================
// 1. Cover
sec('Cover');
{
  const s = pres.addSlide({ masterName: 'Orby Cover', sectionTitle: section });
  img(s, 'cover.png', { x: 0, y: 0, w: W, h: 7.5, center: false, alt: 'A glossy sky-blue Orb risen just above three blue hills at sunrise, with the headline One good day at a time.' });
  wordmark(s, 'ink', { x: 0.64, y: 0.6, h: 0.5 });
  s.addText([{ text: 'Brand guide', options: { transparency: 100 } }], { placeholder: 'title' });
  fr(s, 'Brand guide', { x: 0.64, y: 4.05, w: 6, h: 0.6, size: 30 });
  txt(s, 'The rules for every visible part of Orby, for the people and agents who build it. Version 1.1, November 10, 2026.', { x: 0.64, y: 4.7, w: 5.4, h: 0.8, size: 15 });
  txt(s, 'The PDF beside this file is the reference rendering. This deck names Inter and Inter Tight; install them from docs/brand/fonts for an exact match.', { x: 0.64, y: 5.72, w: 5.4, h: 0.7, size: 12, color: K.ink });
  cap(s, 'Orby for iPhone  /  Sunrise optimism', { x: 0.64, y: 6.95, w: 6, align: 'left', color: K.white });
  s.addNotes('Orby brand guide, version 1.1. This deck mirrors docs/brand/brand-guide.md section by section; when they disagree, the guide wins. Headlines are images so they keep the exact Fraunces soft axis on any computer. Orby Brand Guide.pdf is the reference rendering.');
}

// 2. Contents
sec('Contents');
{
  const s = content('Contents', 'Thirteen sections, one source of truth', "Every rule is checkable: a hex value, a size, a radius, a duration or a do and don't pair.", 'The deck follows the order of brand-guide.md. Builders, people and AI agents, work from these values. When the guide is silent, ask before inventing.');
  const items = ['The idea', 'Logo', 'Color', 'Type', 'Layout and shape', 'Components', 'Iconography', 'Illustration and renders', 'Motion and haptics', 'Voice and copy', 'Accessibility', 'Applying it to the app', 'The checklist and the brand agent'];
  items.forEach((t, i) => {
    const col = i < 7 ? 0 : 1, row = i < 7 ? i : i - 7, x = X0 + col * 4.0, y = 2.5 + row * 0.6;
    fr(s, String(i + 1).padStart(2, '0'), { x, y, w: 0.6, h: 0.42, size: 18, color: HEX.deep, name: 'section number' });
    txt(s, t, { x: x + 0.65, y: y + 0.05, w: 3.3, h: 0.4, size: 15 });
  });
  img(s, 'mark-glow.png', { cx: 10.6, y: 2.3, w: 3.3, alt: 'The Orb with its sunrise glow' });
  cap(s, 'The Orb', { x: 8.9, y: 5.75, w: 3.4, color: K.ink });
  cap(s, "The mark and the assistant's face", { x: 8.2, y: 6.05, w: 4.8 });
}

// ---------- 01 The idea ----------
opener('01', 'The idea', 'One good day at a time: a sphere rising over a horizon, lit warm from below.', 'Section 1 of the guide: the idea, why mid-century futurist, the governing image and the three brand words.');
{
  const s = content('01  The idea', 'One good day at a time', 'Every day in Orby starts like a sunrise on a mid-century travel poster.', 'The governing image is a sphere rising over a horizon, lit warm from below. Sky is the ground, the Orb is the sun, Sunrise orange is the small warm spot that says now, and the poster horizon belongs to brand surfaces.');
  const rows = [['The sky', 'The ground. Cloud and Haze, with a dawn wash at the top of every tab.', 'haze'], ['The sphere', "The Orb: the mark and the assistant's face, lit by a sunrise.", 'orb'], ["The sun's light", 'Sunrise and Apricot. A now-mark and a glow, never a wall of color.', 'sun'], ['The horizon', 'Flat hills, rings and grain on brand art; a half-sun on each tab title.', 'hill']];
  rows.forEach((r, i) => {
    const y = 2.5 + i * 0.78, cx = X0 + 0.26, cy = y + 0.28;
    if (r[2] === 'haze') circle(s, { cx, cy, d: 0.5, fill: K.haze });
    if (r[2] === 'orb') img(s, 'mark.png', { cx, y: cy - 0.27, w: 0.54, alt: 'Orb' });
    if (r[2] === 'sun') { circle(s, { cx, cy, d: 0.5, fill: K.apricot }); circle(s, { cx, cy, d: 0.2, fill: K.sunrise, line: K.paper, lw: 1.5 }); }
    if (r[2] === 'hill') circle(s, { cx, cy, d: 0.5, fill: K.deep });
    txt(s, r[0], { x: X0 + 0.75, y, w: 6.6, h: 0.3, size: 15, bold: true });
    txt(s, r[1], { x: X0 + 0.75, y: y + 0.32, w: 7.0, h: 0.4, size: 13, color: K.dusk });
  });
  cap(s, 'Three brand words', { x: X0, y: 5.75, w: 3, align: 'left', color: K.ink });
  [['Optimistic', 'It assumes today can go well.'], ['Clear', 'One thing at a time, plainly.'], ['Crafted', 'Made with care, like a good poster.']].forEach((w2, i) => {
    const x = X0 + i * 2.65;
    fr(s, w2[0], { x, y: 6.05, w: 2.5, h: 0.42, size: 20 });
    txt(s, w2[1], { x, y: 6.48, w: 2.5, h: 0.45, size: 12, color: K.dusk });
  });
  img(s, 'hero-poster.png', { x: 9.05, y: 0.95, h: 5.9, alt: 'Orby poster: the Orb risen over three hills with the headline One good day at a time.' });
}
{
  const s = content('01  The idea', 'Mid-century futurist, made warm', 'Reference for the feel: https://www.area.tech/openai. Orby borrows the mood (sky-blue optimism, the circle, mid-century poise) and nothing else.', "The reference is cited once, here, as inspiration for mood only. Never use another company's name, mark, wordmark, monogram or artwork in Orby's system, app or marketing.");
  const items = [['1949', 'Eames', 'Flat color fields in a strict grid.', K.haze, HEX.ink], ['1956', 'Braun', 'Quiet bodies, one accent control.', K.apricot, HEX.ink], ['1957', 'The Space Age', 'The circle and the orbit.', K.sky, HEX.ink], ['1962', 'Saarinen', 'Continuous curves, one warm accent.', K.cloud, HEX.ink], ['1967', 'Expo 67 and 70', 'Domes and radial forms in public.', K.deep, HEX.paper], ['1975', 'The NASA manual', 'Numbers and do and don\'t pairs.', K.twilight, HEX.paper]];
  const colW = CW / 6;
  items.forEach((it, i) => {
    const cx = X0 + colW * i + colW / 2;
    circle(s, { cx, cy: 3.4, d: 1.45, fill: it[3], line: it[3] === K.cloud ? K.sky : undefined, lw: 1.5 });
    fr(s, it[0], { x: cx - 0.7, y: 3.15, w: 1.4, h: 0.5, size: 22, color: it[4], align: 'center', valign: 'middle' });
    cap(s, it[1], { x: cx - colW / 2 + 0.05, y: 4.35, w: colW - 0.1, color: K.ink });
    txt(s, it[2], { x: cx - colW / 2 + 0.12, y: 4.7, w: colW - 0.24, h: 0.9, size: 13, color: K.dusk, align: 'center' });
  });
  rrect(s, { x: X0, y: 5.85, w: CW, h: 0.9, r: 0.2, fill: K.cloud, name: 'leave out band' });
  cap(s, 'What we leave out', { x: X0 + 0.3, y: 6.17, w: 2.6, align: 'left', color: K.ink });
  txt(s, 'Starbursts, rockets, atoms, neon, chrome, slate grounds and cockpit density. One sphere is a symbol; five shapes are wallpaper.', { x: X0 + 2.9, y: 5.95, w: 9.0, h: 0.7, size: 14, valign: 'middle' });
}

// ---------- 02 Logo ----------
opener('02', 'Logo', 'The Orb and the wordmark: the name and the mark are one idea.', 'Section 2: the Orb, the wordmark, lockups, clear space, the app icon, the name and misuse.');
{
  const s = content('02  Logo', 'The Orb: a sky-blue sphere lit by a sunrise', 'Blue first. A soft white highlight on top, a warm glow on the lower half, an edge all the way round. Never a band, never two-tone.', 'Build the Orb only from the recipe in brand-guide.md 2.1 and tools/orb.mjs (exported as ORB). In the app, render the SVG files; do not repaint them on canvas.');
  img(s, 'mark-glow.png', { cx: 3.3, y: 2.3, w: 4.0, alt: 'The Orb, idle, with its Apricot glow' });
  cap(s, 'The Orb, idle, 48 px and up', { x: 1.3, y: 6.45, w: 4, color: K.ink });
  spec(s, [
    ['Body', 'Radial, center 50% / 36%, focus 50% / 26%, radius 64%: #FFFFFF 0, #E4F6FE 12%, #97D8F9 34%, #38B6F2 60%, #1590D2 84%, #0A68A0 100%.'],
    ['Sky bounce', 'Radial 50% / 104%, radius 58%: #D6F1FE 95% at 0, #9ADBFA 45% at 50%, 0 at 100%.'],
    ['Underlight', 'At (50, 99), radius 32, 1.9 x wide. Final opacities #FFE3CB .78 at 0, #FFC9A2 .61 at .34, #DDF3FE .43 at .68, 0 at 1.'],
    ['Warm glow', 'Bottom crescent mask (shift 5.5) inside r 47.2, #FFD9B8 to #FFB680, blur 2.5, opacity .6.'],
    ['Specular', 'Ellipse at (50, 22), 27 x 15, white 70% center fading to 0, blur 2.5.'],
    ['Edge', '0.8-unit stroke at r 47.6 all round: #0A5E92 35% top, 30%, 25% bottom.'],
    ['Glow', '48 px and up: #FFB680 ellipse at (50, 77), 56 x 32, 50% to 0. Dark grounds 22%, screen.'],
  ], { x: 6.55, y: 2.45, w: 6.18, lw: 1.45, size: 12, pad: 4 });
}
{
  const s = content('02  Logo', 'The Orb in use: states and size tiers', "One Orb per screen, and it is the assistant's. Its render follows its measured diameter.", 'Idle breathes (48 px and up), thinking warms and orbits (the status line carries the meaning), still is one frame. 48 px and up full, 28 to 47 gloss, under 28 a flat Sky disc. On dark grounds the glow drops to 22% with a screen blend.');
  const colW = CW / 4, y = 2.4;
  [['mark-glow.png', 'Idle', 'Breath 1 to 1.015, 4 s'], ['mark-thinking.png', 'Thinking', 'Status line carries it'], ['dark', 'On Twilight', 'Glow 22%, screen blend'], ['mark-flat.png', 'Flat, one color', 'Sky, Night Ink or Paper']].forEach((t, i) => {
    const cx = X0 + colW * i + colW / 2;
    if (t[0] === 'dark') { rrect(s, { x: cx - 0.9, y, w: 1.8, h: 1.75, r: 0.24, fill: K.twilight, name: 'Twilight tile' }); img(s, 'mark-glow-dark.png', { cx, y: y + 0.1, w: 1.55, alt: 'Orb on Twilight' }); }
    else img(s, t[0], { cx, y: y + (t[0] === 'mark-flat.png' ? 0.32 : 0), w: t[0] === 'mark-flat.png' ? 1.1 : 1.75, alt: t[1] });
    cap(s, t[1], { x: cx - colW / 2, y: 4.3, w: colW, color: K.ink });
    cap(s, t[2], { x: cx - colW / 2, y: 4.6, w: colW });
  });
  rrect(s, { x: X0, y: 5.05, w: CW, h: 1.85, r: 0.24, fill: K.paper, line: K.line, name: 'tiers panel' });
  img(s, 'tiers.png', { x: X0 + 0.25, y: 5.15, w: CW - 0.5, alt: 'Size tiers from 96 px to 16 px' });
  const sizes = ['96', '72', '56', '48', '40', '32', '28', '24', '20', '16'], cw = (CW - 0.5) / 10;
  sizes.forEach((v, i) => cap(s, v + ' px', { x: X0 + 0.25 + cw * i, y: 6.38, w: cw, color: K.ink }));
  cap(s, 'Full  48 and up', { x: X0 + 0.25, y: 6.62, w: cw * 4, color: K.deep });
  cap(s, 'Gloss  28 to 47', { x: X0 + 0.25 + cw * 4, y: 6.62, w: cw * 3, color: K.deep });
  cap(s, 'Flat  under 28', { x: X0 + 0.25 + cw * 7, y: 6.62, w: cw * 3, color: K.deep });
}
{
  const s = content('02  Logo', 'The wordmark: Orby in Fraunces, as outlines', 'With four letters, the O carries the name. It echoes the Orb in shape and stays a letter, no darker than the rest.', 'Always use the outlined SVG. Night Ink on light grounds, Paper on dark. The O is a true circle with a lightly tilted elliptical counter: its thickest stroke is 1.05 x the b stem.');
  wordmark(s, 'ink', { cx: W / 2, y: 2.45, w: 5.4 });
  [['Face', 'Fraunces 700, SOFT 100, WONK 0, opsz 144. Outlined.'], ['Tracking', '-20 units (-0.01 em). UPM 2000, cap 1400, x-height 890.'], ['Kerning', 'O/r -24, r/b +60, b/y +14 units. The r clears the b.'], ['The O', 'A true circle 1441 u; counter an ellipse 390 x 548 u, tilted 10 degrees.'], ['Color', 'Night Ink #0E2236 on light, Paper #FFFDF8 on dark. Nothing else.']].forEach((c, i) => {
    const cw = CW / 5, x = X0 + i * cw;
    cap(s, c[0], { x: x + 0.1, y: 5.3, w: cw - 0.2, color: K.ink });
    txt(s, c[1], { x: x + 0.1, y: 5.62, w: cw - 0.25, h: 1.1, size: 13, color: K.dusk, align: 'center' });
  });
}
{
  const s = content('02  Logo', 'Lockups: horizontal and stacked', 'Horizontal in headers, with the Orb as a small sun at x-height. Stacked on store art and tall formats.', 'Horizontal: the Orb is x-height (900 units) on the baseline, gap 0.35 C. Where the art already has an Orb, use the wordmark alone. Stacked: Orb 2 C, centered on the ink width, 0.5 C above the b. Under 28 px the lockup Orb is the flat disc.');
  const cw = (CW - 0.4) / 3, xs = [X0, X0 + cw + 0.2, X0 + 2 * (cw + 0.2)];
  lockupH(s, 'ink', { x: xs[0] + 0.3, y: 3.2, w: cw - 0.6 });
  lockupS(s, 'ink', { cx: xs[1] + cw / 2, y: 2.5, w: 1.9 });
  rrect(s, { x: xs[2], y: 2.35, w: cw, h: 3.0, r: 0.24, fill: K.twilight, name: 'Twilight panel' });
  lockupS(s, 'paper', { cx: xs[2] + cw / 2, y: 2.5, w: 1.9 });
  [['Horizontal', 'Orb at x-height (900 u) on the baseline. Gap 0.35 C (490 u).'], ['Stacked', 'Orb 2 C across, centered on the ink width, 0.5 C above the b.'], ['On dark grounds', 'Paper wordmark, same Orb. Paper on Twilight 9.36.']].forEach((c, i) => {
    cap(s, c[0], { x: xs[i], y: 5.6, w: cw, color: K.ink });
    txt(s, c[1], { x: xs[i] + 0.2, y: 5.92, w: cw - 0.4, h: 0.8, size: 13, color: K.dusk, align: 'center' });
  });
}
{
  const s = content('02  Logo', 'Clear space and minimum size', 'Clear space is C, the cap height, on every side. Nothing enters it: no text, no edge, no other mark.', 'Keep C of clear space around any lockup or the wordmark. Below the minimum widths, use the flat Orb alone.');
  img(s, 'construction.png', { x: X0, y: 2.45, w: 6.7, alt: 'Horizontal lockup construction with clear space C, cap height, x-height and baseline' });
  spec(s, [
    ['Clear space', 'C on every side of any lockup or the wordmark.'],
    ['On screen', 'Horizontal 96 pt, stacked 56 pt, wordmark 64 pt, gloss Orb 28 pt, flat Orb 16 pt (width).'],
    ['In print', 'Horizontal 25 mm, stacked 15 mm, wordmark 17 mm. Below these, the flat Orb alone.'],
    ['App header', 'The horizontal lockup at 24 pt cap height, its flat-Orb file (the Orb is under 28 px).'],
  ], { x: 7.6, y: 2.45, w: 5.13, lw: 1.35, size: 12, pad: 5 });
  rrect(s, { x: 7.6, y: 5.35, w: 5.13, h: 1.5, r: 0.2, fill: K.paper, line: K.line, name: 'minimum sizes panel' });
  img(s, 'minsizes.png', { x: 7.75, y: 5.45, w: 4.83, alt: 'Minimum sizes at screen scale' });
  ['96 pt', '56 pt', '64 pt', '28 pt', '16 pt'].forEach((l, i) => cap(s, l, { x: 7.75 + i * 0.966, y: 6.38, w: 0.966, color: K.ink }));
}
{
  const s = content('02  Logo', 'The name is Orby', 'The Orb is the mark, so the name and the mark are one idea.', "Always Orby with a capital O. Never ORBY in running text, never the Orby or Orby app. Possessive is Orby's. The assistant is still called the assistant. Internal identifiers keep the old name.");
  const hd = (t, c) => ({ text: t, options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color: c, margin: [1, 6, 6, 0], border: [NONE, NONE, LINE, NONE] } });
  const rows = [['A capital O, the rest lowercase.', 'Orby', 'orby, ORBY in running text'], ['Caps only in the caption style.', 'cap', 'Welcome to ORBY'], ['No article, no "app".', 'Orby plans your week.', 'the Orby, Orby app'], ["Possessive with 's.", "Orby's plan view", "Orbys', Orby'"], ['The assistant is "the assistant".', 'Ask the assistant.', 'Ask Orby, Orby says']];
  const data = [[hd('RULE', K.ink), hd('RIGHT', K.deep), hd('WRONG', K.signal)], ...rows.map((r, i) => r.map((c, j) => {
    const bd = [NONE, NONE, i === rows.length - 1 ? NONE : LINE, NONE];
    if (c === 'cap') return { text: 'ORBY FOR IPHONE', options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color: K.ink, margin: [8, 8, 8, 0], border: bd } };
    return { text: c, options: { fontFace: BODY, fontSize: 13, color: j === 2 ? K.dusk : K.ink, bold: j === 1, margin: [8, 8, 8, 0], border: bd } };
  }))];
  s.addTable(data, { x: X0, y: 2.5, w: 7.5, colW: [2.9, 2.4, 2.2], fontFace: BODY, objectName: 'naming table', autoPage: false });
  rrect(s, { x: 8.4, y: 2.4, w: 4.33, h: 2.1, r: 0.2, fill: K.cloud, name: 'unchanged card' });
  cap(s, 'What does not change', { x: 8.65, y: 2.6, w: 3.9, align: 'left', color: K.ink });
  txt(s, 'The repository (LogBook), packages (@logbook/*), the bundle id com.joshbean.logbook, storage keys, the LogbookAPIHost key, code and file names.', { x: 8.65, y: 2.95, w: 3.85, h: 1.45, size: 13 });
  rrect(s, { x: 8.4, y: 4.7, w: 4.33, h: 2.15, r: 0.2, fill: K.paper, line: K.line, name: 'says Orby card' });
  cap(s, 'Everything a person sees', { x: 8.65, y: 4.9, w: 3.9, align: 'left', color: K.ink });
  txt(s, 'The Home Screen label, index.html title, capacitor.config.ts appName, the manifest, Info.plist text, the splash, onboarding, Settings, disclaimers, emails and share cards.', { x: 8.65, y: 5.25, w: 3.85, h: 1.5, size: 13 });
}
{
  const s = content('02  Logo', 'Fifteen ways to break the logo', 'Use the files as supplied. Each tile breaks one rule; none of them is ever allowed.', 'Never stretch, retype, swap the O for the Orb, set the name in caps, recolor the Orb, make a two-tone ball, show two Orbs, use a busy ground, give the Orb a face, add shadows, grey the wordmark, change spacing, rotate, say the Orby, or box the logo.');
  img(s, 'donts.png', { x: X0, y: 2.45, w: CW, alt: 'Grid of fifteen logo misuses, each marked with a Signal cross' });
}
{
  const s = content('02  Logo', 'The app icon: a sunrise in a square', 'Supply 1024 px, square and opaque. iOS applies the mask. No text: the Home Screen label says Orby.', 'The Orb is 500 px at (512, 420); its bottom clears the hill crest by 0.1 D so its warm lower half always shows. Two 8 px rings. Check at 58 px.');
  const colW = CW / 3;
  [['app-icon.png', 'Light', 'Pale sky, the Orb clear of the hill'], ['app-icon-dark.png', 'Dark', 'Night Ink to Twilight, Apricot glow'], ['app-icon-tinted.png', 'Tinted', 'Greyscale source, iOS tints it']].forEach((ic, i) => {
    const cx = X0 + colW * i + colW / 2;
    img(s, ic[0], { cx, y: 2.35, w: 2.1, alt: ic[1] + ' app icon' });
    cap(s, ic[1], { x: cx - colW / 2, y: 4.6, w: colW, color: K.ink });
    cap(s, ic[2], { x: cx - colW / 2, y: 4.9, w: colW });
  });
  [['Canvas', '1024 x 1024 px, opaque, no corners, no text.'], ['Sky', '#CFEBFA 0, #E2F3FC 42%, #F6E7D3 60%, #FFC79C 72%.'], ['Orb', '500 px (49%) at (512, 420), 0.1 D above the crest.'], ['Rings and hills', 'Rings r 310 and 370, 8 px white. Hills #4FA9DB, #0A6CA6.'], ['Display name', 'Orby. Bundle id stays com.joshbean.logbook.']].forEach((c, i) => {
    const cw = CW / 5, x = X0 + i * cw;
    cap(s, c[0], { x: x + 0.08, y: 5.45, w: cw - 0.16, color: K.ink });
    txt(s, c[1], { x: x + 0.12, y: 5.78, w: cw - 0.24, h: 1.0, size: 12, color: K.dusk, align: 'center' });
  });
}

// ---------- 03 Color ----------
opener('03', 'Color', 'Sky leads. Sunrise means now. Every pairing has a stated ratio.', 'Section 3: the palette, allowed and banned pairings, proportions and orange\'s exact jobs.');
{
  const s = content('03  Color', 'Twelve colors. Sky leads, Sunrise accents', 'Two ratios on every swatch: the text that sits on it, and the swatch used as text on Paper (on Twilight where marked), WCAG 2.x.', 'Sky is a fill and a mark, never text on light grounds. Deep Sky carries blue words. Sunrise means now and stays small. Ember carries the rare orange words. Linen and Twilight never appear in app chrome.');
  const sw = [
    ['Sky', '38B6F2', 'On it: Ink 7.03', 'As text: never (2.26)', HEX.ink], ['Deep Sky', '0A6CA6', 'On it: White 5.66', 'As text: 5.57', 'FFFFFF'], ['Haze', 'CBE8F8', 'On it: Ink 12.64', 'As text: never', HEX.ink],
    ['Cloud', 'EAF5FC', 'On it: Ink 14.58', 'As text: never', HEX.ink], ['Paper', 'FFFDF8', 'On it: Ink 15.88', 'On Twilight: 9.36', HEX.ink], ['Linen', 'F6F0E5', 'On it: Ink 14.23', 'As text: never', HEX.ink],
    ['Night Ink', '0E2236', 'On it: White 16.14', 'As text: 15.88', 'FFFFFF'], ['Dusk', '46596D', 'On it: White 7.22', 'As text: 7.10', 'FFFFFF'], ['Twilight', '1B4870', 'On it: White 9.51', 'As text: 9.36', 'FFFFFF'],
    ['Sunrise', 'F2600C', 'On it: Ink 4.96, bold', 'As text: never (3.20)', HEX.ink], ['Apricot', 'FFB680', 'On it: Ink 9.42', 'On Twilight: 5.55', HEX.ink], ['Ember', 'B4430C', 'On it: White 5.60', 'As text: 5.51', 'FFFFFF'],
  ];
  const w = 1.9, h = 2.0, g = (CW - 6 * w) / 5;
  sw.forEach((c, i) => {
    const x = X0 + (i % 6) * (w + g), y = 2.45 + Math.floor(i / 6) * (h + 0.2);
    rrect(s, { x, y, w, h, r: 0.16, fill: c[1], line: ['CBE8F8', 'EAF5FC', 'FFFDF8', 'F6F0E5'].includes(c[1]) ? K.lineStrong : undefined, name: c[0] + ' swatch' });
    fr(s, c[0], { x: x + 0.16, y: y + 0.14, w: w - 0.3, h: 0.38, size: 17, color: c[4] });
    txt(s, '#' + c[1], { x: x + 0.16, y: y + 0.55, w: w - 0.3, h: 0.28, size: 12, bold: true, color: c[4] });
    txt(s, c[2], { x: x + 0.16, y: y + h - 0.72, w: w - 0.25, h: 0.28, size: 12, color: c[4] });
    txt(s, c[3], { x: x + 0.16, y: y + h - 0.42, w: w - 0.25, h: 0.28, size: 12, color: c[4] });
  });
}
{
  const s = content('03  Color', 'Proportion on every screen', 'Share of pixels on any app screen at 390 x 844. A beige screen means Paper crept in where Cloud belongs.', 'Grounds 65 percent or more, the Sky family 15 to 25, text about 10, warm light 5 or less with Sunrise itself under 2 percent. Support colors exist only for a contrast or role need.');
  const groups = [['Grounds 65% or more', [[0.40, HEX.cloud, 'Cloud'], [0.20, HEX.paper, 'Paper'], [0.07, HEX.haze, 'Haze']]], ['Sky family 15 to 25%', [[0.13, HEX.sky, 'Sky'], [0.07, HEX.deep, 'Deep Sky']]], ['Ink and Dusk about 10%', [[0.06, HEX.ink, 'Ink'], [0.04, HEX.dusk, 'Dusk']]], ['Warm 5% or less', [[0.02, HEX.apricot, ''], [0.01, HEX.sunrise, '']]]];
  let x = X0; const y = 2.5, bh = 0.5;
  rrect(s, { x: X0 - 0.01, y: y - 0.01, w: CW + 0.02, h: bh + 0.02, fill: K.paper, line: K.lineStrong, name: 'bar edge' });
  const starts = [];
  groups.forEach(([gl, segs]) => { starts.push(x); segs.forEach(([f, c, n]) => { const w = CW * f; rrect(s, { x, y, w, h: bh, fill: c, name: n || 'warm' }); if (n && w > 1.0) txt(s, n, { x: x + 0.08, y: y + 0.12, w: w - 0.1, h: 0.28, size: 12, bold: true, color: ['0A6CA6', '0E2236', '46596D'].includes(c) ? 'FFFFFF' : HEX.ink }); x += w; }); });
  [['Grounds 65% or more', 'Cloud, Paper, Haze. The dawn wash counts.', [HEX.cloud, HEX.paper, HEX.haze]], ['Sky family 15 to 25%', 'Sky, Deep Sky, the Orb.', [HEX.sky, HEX.deep]], ['Ink and Dusk about 10%', 'Text.', [HEX.ink, HEX.dusk]], ['Warm 5% or less', 'Apricot glow and Sunrise; Sunrise itself under 2%.', [HEX.apricot, HEX.sunrise]]].forEach((r, i) => {
    const yy = 3.95 + i * 0.68;
    r[2].forEach((hx, j) => circle(s, { cx: X0 + 0.2 + j * 0.42, cy: yy + 0.2, d: 0.34, fill: hx, line: [HEX.cloud, HEX.paper, HEX.haze].includes(hx) ? K.lineStrong : undefined }));
    cap(s, r[0], { x: X0 + 1.5, y: yy + 0.07, w: 3.6, align: 'left', color: K.ink });
    txt(s, r[1], { x: X0 + 5.2, y: yy + 0.05, w: 6.9, h: 0.32, size: 14 });
  });
}
{
  const s = content('03  Color', 'Support colors', 'Each added for a contrast or role need. Data tones are glyphs, lines and markers, never surfaces.', 'Graphite, Deep Sky IC and Pencil IC are the Increase Contrast steps. Marigold always pairs with a glyph and words. Brand art colors never appear in app chrome.');
  const rows = [
    ['Graphite', ['33475B'], '#33475B', 'Dusk under Increase Contrast. 9.42 on Paper.'],
    ['Deep Sky IC', ['085A8C'], '#085A8C', 'Deep Sky under Increase Contrast; body text on Haze (5.76).'],
    ['Pencil', ['7A8794', '5F6D7B'], '#7A8794, IC #5F6D7B', 'Marks only, 3.61 on Paper. Rest glyph on Haze: #5F6D7B (4.15).'],
    ['Warn', ['E0A21B', '7A5A00'], '#E0A21B, text #7A5A00', 'Marigold mark with a glyph and words; Warn text 6.28.'],
    ['Signal', ['B42340'], '#B42340', 'Errors and destructive words, 6.35. White on Signal 6.45.'],
    ['Data tones', ['117A74', '0A6CA6', '7E3F8F', 'B23A5B', '4A4FB0', '7D6210', '7A8794'], '#117A74 #0A6CA6 #7E3F8F #B23A5B #4A4FB0 #7D6210 #7A8794', 'Easy, long, hard, fast, lift, cross, rest.'],
    ['Brand art', ['8DD0F5', 'AEDDF8', 'CFEBFA', 'F4E6D2', 'FFD2AE', '8FCDEE', '4FA9DB', '0A6CA6'], '#8DD0F5 #AEDDF8 #CFEBFA #F4E6D2 #FFD2AE #8FCDEE #4FA9DB #0A6CA6', 'Sky bands, horizon, three hills.'],
  ];
  rows.forEach((r, i) => {
    const yy = 2.5 + i * 0.62;
    cap(s, r[0], { x: X0, y: yy + 0.07, w: 1.6, align: 'left', color: K.ink });
    r[1].forEach((hx, j) => circle(s, { cx: X0 + 1.85 + j * 0.3, cy: yy + 0.17, d: 0.24, fill: hx, line: ['CFEBFA', 'F4E6D2', 'AEDDF8', 'FFD2AE'].includes(hx) ? K.lineStrong : undefined }));
    txt(s, r[2], { x: 5.0, y: yy + 0.04, w: 3.65, h: 0.55, size: 12, color: K.dusk });
    txt(s, r[3], { x: 8.75, y: yy + 0.04, w: 3.98, h: 0.55, size: 12 });
  });
}
function pairTable(s, rows, o) {
  const hd = (t) => ({ text: t, options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.6, color: K.dusk, margin: [1, 4, 5, 4], border: [NONE, NONE, LINE, NONE] } });
  const data = [[hd(''), hd('TEXT ON GROUND'), hd('RATIO'), hd(o.last || 'USE')]];
  rows.forEach((r, i) => {
    const bb = [NONE, NONE, i === rows.length - 1 ? NONE : LINE, NONE];
    const pb = { type: 'solid', pt: 2, color: HEX.paper };
    data.push([
      { text: 'Aa', options: { fill: { color: r[2] }, color: r[1], fontFace: BODY, bold: true, fontSize: 13, align: 'center', valign: 'middle', margin: [3, 0, 3, 0], border: [pb, pb, pb, pb] } },
      { text: r[0], options: { fontFace: BODY, fontSize: 13, color: K.ink, margin: [3, 4, 3, 8], valign: 'middle', border: bb } },
      { text: r[3], options: { fontFace: BODY, fontSize: 13, color: o.bad ? K.signal : K.ink, bold: true, margin: [3, 4, 3, 4], valign: 'middle', border: bb } },
      { text: r[4], options: { fontFace: BODY, fontSize: 12, color: K.dusk, margin: [3, 2, 3, 4], valign: 'middle', border: bb } },
    ]);
  });
  s.addTable(data, { x: o.x, y: o.y, w: o.w, colW: o.colW, rowH: o.rowH, fontFace: BODY, objectName: o.name, autoPage: false });
}
const TW = (CW - 0.45) / 2, PCOL = [0.6, 2.55, 0.8, TW - 3.95];
{
  const s = content('03  Color', 'Text on light grounds: ink and Dusk', 'Only listed pairings. Body text needs 4.5:1; large text and graphics need 3:1.', 'Night Ink and Dusk are the text colors. Dusk is the lightest neutral text color. Night Ink on Sunrise is for bold 13 px and up only.');
  pairTable(s, [['Night Ink on Paper', HEX.ink, HEX.paper, '15.88', 'Body'], ['Night Ink on Cloud', HEX.ink, HEX.cloud, '14.58', 'Body'], ['Night Ink on Linen', HEX.ink, 'F6F0E5', '14.23', 'Body'], ['Night Ink on Haze', HEX.ink, HEX.haze, '12.64', 'Body'], ['Night Ink on Apricot', HEX.ink, HEX.apricot, '9.42', 'Body'], ['Night Ink on Sky', HEX.ink, HEX.sky, '7.03', 'Button label, selected day']], { x: X0, y: 2.5, w: TW, colW: PCOL, rowH: 0.44, name: 'light pairings A' });
  pairTable(s, [['Night Ink on Sunrise', HEX.ink, HEX.sunrise, '4.96', 'Bold 13 px up: the stamp'], ['Twilight on Paper', HEX.twilight, HEX.paper, '9.36', 'Journal pen ink'], ['Dusk on Paper', HEX.dusk, HEX.paper, '7.10', 'Body'], ['Dusk on Cloud', HEX.dusk, HEX.cloud, '6.52', 'Body; the splash line'], ['Dusk on Linen', HEX.dusk, 'F6F0E5', '6.36', 'Body'], ['Dusk on Haze', HEX.dusk, HEX.haze, '5.65', 'Disabled button label']], { x: X0 + TW + 0.45, y: 2.5, w: TW, colW: PCOL, rowH: 0.44, name: 'light pairings B' });
}
{
  const s = content('03  Color', 'Text on light grounds: blue, orange and status words', 'Deep Sky for links, Ember for rare orange words, Warn and Signal for status.', 'Deep Sky on Haze is large text only; use #085A8C for body there. Ember never sits on Haze. White on Signal is allowed for a destructive action fill.');
  pairTable(s, [['Deep Sky on Paper', HEX.deep, HEX.paper, '5.57', 'Links'], ['Deep Sky on Cloud', HEX.deep, HEX.cloud, '5.11', 'Body'], ['Deep Sky on Linen', HEX.deep, 'F6F0E5', '4.99', 'Body'], ['Deep Sky on Haze', HEX.deep, HEX.haze, '4.43', 'Large only'], ['#085A8C on Haze', '085A8C', HEX.haze, '5.76', 'Body on Haze'], ['Ember on Paper', HEX.ember, HEX.paper, '5.51', 'Today tag, streak label']], { x: X0, y: 2.5, w: TW, colW: PCOL, rowH: 0.44, name: 'light pairings C' });
  pairTable(s, [['Ember on Cloud', HEX.ember, HEX.cloud, '5.06', 'Body'], ['Ember on Linen', HEX.ember, 'F6F0E5', '4.94', 'Body'], ['Warn text on Paper', '7A5A00', HEX.paper, '6.28', 'On Warn soft 5.63'], ['Signal on Paper', 'B42340', HEX.paper, '6.35', 'On Signal soft 5.27'], ['White on Signal', 'FFFFFF', 'B42340', '6.45', 'Destructive action fill'], ['White on Deep Sky', 'FFFFFF', HEX.deep, '5.66', 'Caption on the hills']], { x: X0 + TW + 0.45, y: 2.5, w: TW, colW: PCOL, rowH: 0.44, name: 'light pairings D' });
}
{
  const s = content('03  Color', 'Text on dark grounds', 'Dark grounds are for brand surfaces: the night splash, the dark icon, section slides, share cards.', 'Paper, Haze and Apricot carry text on Twilight and Night Ink. Sky on Twilight is large text and graphics only.');
  pairTable(s, [['White on Night Ink', 'FFFFFF', HEX.ink, '16.14', 'Toasts, dark slides'], ['White on Twilight', 'FFFFFF', HEX.twilight, '9.51', 'Body'], ['White on Dusk', 'FFFFFF', HEX.dusk, '7.22', 'Body'], ['White on Ember', 'FFFFFF', HEX.ember, '5.60', 'Body'], ['Paper on Twilight', HEX.paper, HEX.twilight, '9.36', 'Wordmark, text on dark']], { x: X0, y: 2.5, w: TW, colW: PCOL, rowH: 0.46, name: 'dark pairings A' });
  pairTable(s, [['Paper on Night Ink', HEX.paper, HEX.ink, '15.88', 'Wordmark on Night Ink'], ['Haze on Twilight', HEX.haze, HEX.twilight, '7.45', 'Secondary text on dark'], ['Apricot on Twilight', HEX.apricot, HEX.twilight, '5.55', 'Warm accent text'], ['Sky on Twilight', HEX.sky, HEX.twilight, '4.14', 'Large text, graphics only'], ['Night Ink on poster sky', HEX.ink, '8DD0F5', '9.59', 'Hero headline on brand art']], { x: X0 + TW + 0.45, y: 2.5, w: TW, colW: PCOL, rowH: 0.46, name: 'dark pairings B' });
}
{
  const s = content('03  Color', 'Banned pairings and decorative marks', 'The banned list is checked on every change. A mark under 3:1 must be decorative: the meaning lives elsewhere.', 'Never white on Sky or Sunrise, never Sky or Sunrise as text on light grounds, always a Paper keyline where Sunrise touches Sky. Night Ink on Twilight is 1.70.');
  pairTable(s, [['Sky text on Paper', HEX.sky, HEX.paper, '2.26', 'Sky is a fill'], ['White on Sky', 'FFFFFF', HEX.sky, '2.30', 'Night Ink on Sky'], ['White on Sunrise', 'FFFFFF', HEX.sunrise, '3.25', 'Night Ink, bold'], ['Sunrise text on Paper', HEX.sunrise, HEX.paper, '3.20', 'Words are Ember'], ['Dusk on Sky', HEX.dusk, HEX.sky, '3.14', 'Night Ink']], { x: X0, y: 2.5, w: TW, colW: PCOL, rowH: 0.46, name: 'banned pairings A', bad: true, last: 'INSTEAD' });
  pairTable(s, [['Ember on Haze', HEX.ember, HEX.haze, '4.38', 'Tag on Paper'], ['Night Ink on Twilight', HEX.ink, HEX.twilight, '1.70', 'Paper on Twilight'], ['Sunrise touching Sky', HEX.sunrise, HEX.sky, '1.42', '2 px Paper keyline'], ['Pencil glyph on Haze', '7A8794', HEX.haze, '2.87', '#5F6D7B (4.15)']], { x: X0 + TW + 0.45, y: 2.5, w: TW, colW: PCOL, rowH: 0.46, name: 'banned pairings B', bad: true, last: 'INSTEAD' });
  rrect(s, { x: X0, y: 5.5, w: CW, h: 1.3, r: 0.2, fill: K.cloud, name: 'decorative band' });
  cap(s, 'Decorative by design', { x: X0 + 0.3, y: 5.7, w: 3, align: 'left', color: K.ink });
  txt(s, 'Minor gauge ticks (1.57; the readout carries the value), the off coin ring (1.80; the check carries it), the off chip edge (1.44; the label carries it), the thinking arc (2.0; the status line carries it). Journal discs carry a numeral, never lightness alone.', { x: X0 + 0.3, y: 6.0, w: CW - 0.6, h: 0.75, size: 13 });
}
{
  const s = content('03  Color', 'Sunrise means now. It has six jobs', 'At most three on a screen. When more would show, the lower priority yields to Night Ink.', 'Priority: today\'s dot, then the gauge pointer (or the NOW tick and now dot on Progress), the live node, the stamp, badge dots. A yielding mark keeps its shape and turns Night Ink. Keylines at least 2 px; the pointer 3.5; the stamp max(2px, 3.3%).');
  const colW = CW / 6, cy = 3.15;
  const jobs = [["Today's dot", "6 px above today's letter, 2 px keyline."], ['Gauge pointer', '12 px dot, 3.5 px Paper keyline.'], ['Badge dot', '8 px, 2 px keyline. Yields first.'], ['Milestone stamp', 'One per screen. Ink on Sunrise 4.96.'], ['Live node', '12 px on a timeline, 2 px keyline.'], ['Now on a chart', 'The 8 px now dot and the NOW tick.']];
  jobs.forEach((j, i) => {
    const cx = X0 + colW * i + colW / 2;
    if (i === 0) { txt(s, 'T', { x: cx - 0.3, y: cy - 0.12, w: 0.6, h: 0.35, size: 16, bold: true, align: 'center' }); circle(s, { cx, cy: cy - 0.3, d: 0.18, fill: K.sunrise, line: K.paper, lw: 2 }); txt(s, '10', { x: cx - 0.4, y: cy + 0.3, w: 0.8, h: 0.4, size: 18, bold: true, align: 'center' }); }
    if (i === 1) { rrect(s, { x: cx - 0.75, y: cy - 0.08, w: 1.5, h: 0.2, r: 0.1, fill: K.haze }); rrect(s, { x: cx - 0.75, y: cy - 0.035, w: 0.9, h: 0.11, r: 0.055, fill: K.deep }); circle(s, { cx: cx + 0.15, cy: cy + 0.02, d: 0.3, fill: K.sunrise, line: K.paper, lw: 3 }); }
    if (i === 2) { circle(s, { cx, cy, d: 0.8, fill: K.paper, line: K.lineStrong }); circle(s, { cx, cy, d: 0.3, line: K.dusk, lw: 1.75 }); circle(s, { cx: cx + 0.28, cy: cy - 0.28, d: 0.2, fill: K.sunrise, line: K.paper, lw: 2 }); }
    if (i === 3) img(s, 'stamp.png', { cx, y: cy - 0.7, w: 1.4, alt: 'Day 12 streak stamp' });
    if (i === 4) { s.addShape(pres.shapes.LINE, { x: cx - 0.8, y: cy, w: 1.6, h: 0, line: { color: K.lagoon, width: 2 } }); [-0.8, -0.27, 0.27, 0.8].forEach((dx, k) => circle(s, { cx: cx + dx, cy, d: k === 1 ? 0.26 : 0.18, fill: k === 1 ? K.sunrise : K.paper, line: k === 1 ? K.paper : K.ink, lw: k === 1 ? 2.5 : 1.5 })); }
    if (i === 5) { [0.35, 0.55, 0.42, 0.7].forEach((hh, k) => rrect(s, { x: cx - 0.62 + k * 0.33, y: cy + 0.4 - hh, w: 0.22, h: hh, fill: K.sky })); circle(s, { cx: cx - 0.62 + 3 * 0.33 + 0.11, cy: cy + 0.4 - 0.7, d: 0.16, fill: K.sunrise, line: K.paper, lw: 2 }); }
    cap(s, j[0], { x: cx - colW / 2, y: 4.3, w: colW, color: K.ink });
    txt(s, j[1], { x: cx - colW / 2 + 0.1, y: 4.62, w: colW - 0.2, h: 0.8, size: 12, color: K.dusk, align: 'center' });
  });
  rrect(s, { x: X0, y: 5.6, w: CW, h: 1.2, r: 0.2, fill: K.cloud, name: 'budget band' });
  cap(s, 'Priority', { x: X0 + 0.3, y: 5.8, w: 1.6, align: 'left', color: K.ink });
  txt(s, "1 Today's dot  2 Gauge pointer (Progress: NOW tick and now dot)  3 Live node  4 Stamp  5 Badge dots. Past the third, a mark turns Night Ink. Ember words, Apricot light and the thinking arc do not count.", { x: X0 + 1.95, y: 5.72, w: 9.9, h: 0.95, size: 13, valign: 'middle' });
}

// ---------- 04 Type ----------
opener('04', 'Type', 'Fraunces for display, Inter for everything people read and every live number, Inter Tight for captions.', 'Section 4: families and licenses, the scale, captions and numerals.');
{
  const s = content('04  Type', 'Three families, all SIL OFL', 'All licensed for a shipped app, self-hosted from docs/brand/fonts.', 'Fraunces replaces Instrument Serif. The html rule sets SOFT 100 and WONK 0 once; nothing else sets font-variation-settings. Inter Tight faces become font-weight 100 900 so a 600 caption gets the 600 instance.');
  [['fam-fraunces.png', 'Titles, card titles, the session name, static hero stats. Italic 420 is the sentence voice. Roman 600 to 700.', 'fraunces-latin-full (SOFT and WONK)'], ['fam-inter.png', 'Body, buttons, tabs, chips, inputs and every number that changes, with tabular-nums.', 'inter-latin-wght'], ['fam-intertight.png', 'Captions only: 600, caps, +0.14 em, 11 px floor. And gauge end labels.', 'inter-tight-latin-wght']].forEach((f, i) => {
    const cw = CW / 3, x = X0 + i * cw;
    img(s, f[0], { x, y: 2.45, w: 3.3, alt: f[0].replace('fam-', '').replace('.png', '') + ' specimen' });
    txt(s, f[1], { x, y: 4.55, w: cw - 0.45, h: 1.25, size: 14, color: K.dusk });
    cap(s, 'SIL OFL 1.1', { x, y: 5.95, w: cw - 0.3, align: 'left', color: K.ink });
    txt(s, f[2], { x, y: 6.27, w: cw - 0.3, h: 0.3, size: 12, color: K.deep });
  });
}
function scaleTable(s, rows) {
  const hd = (t) => ({ text: t, options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.6, color: K.dusk, margin: [1, 4, 5, 0], border: [NONE, NONE, LINE, NONE] } });
  const data = [[hd('ROLE'), hd('FACE'), hd('SIZE / LINE'), hd('WEIGHT'), hd('COLOR'), hd('TOKEN')]];
  rows.forEach((r, i) => {
    const bb = [NONE, NONE, i === rows.length - 1 ? NONE : LINE, NONE];
    data.push(r.map((c) => ({ text: c, options: { fontFace: BODY, fontSize: 12, color: K.ink, margin: [4, 4, 4, 0], valign: 'middle', border: bb } })));
  });
  s.addTable(data, { x: X0, y: 2.45, w: CW, colW: [2.55, 1.6, 3.0, 1.9, 1.55, CW - 10.6], rowH: 0.4, fontFace: BODY, objectName: 'type scale table', autoPage: false });
}
{
  const s = content('04  Type', 'The type scale: display', 'Sizes in rem at a 16 px root, so iOS Larger Text scales them. At most 4 Fraunces sizes on one screen.', 'Fraunces roman never under 600 or 20 px; italic 420, never under 17 px. Fraunces has no tabular figures, so it never sets a number that changes.');
  scaleTable(s, [['Hero', 'Fraunces', '3.5 / 3.5 rem (56/56)', '700, -0.02 em', 'Night Ink', '--fs-hero'], ['Screen title', 'Fraunces', '2.375 / 2.625 rem (38/42)', '650, -0.015 em', 'Night Ink', '--fs-title'], ['Session name', 'Fraunces', '2.5 / 2.625 rem (40/42)', '650, -0.015 em', 'Night Ink', '--fs-stamp'], ['Static hero stat', 'Fraunces', '2.75 to 3.625 rem, line 1', '650', 'Night Ink', '--fs-stat'], ['Section title', 'Fraunces', '1.625 / 2 rem (26/32)', '600', 'Night Ink', '--fs-section'], ['Card, sheet title', 'Fraunces', '1.375 / 1.75 rem (22/28)', '600', 'Night Ink', '--fs-head'], ['Sentence', 'Fraunces italic', '1.375 / 1.75 rem (22/28)', '420', 'Night Ink', '--fs-sentence'], ['Sentence, small', 'Fraunces italic', '1.0625 / 1.375 rem (17/22)', '420', 'Dusk', '--fs-sentence-sm']]);
}
{
  const s = content('04  Type', 'The type scale: UI and numbers', 'Inter for everything a person reads or taps, and every live number. At most 5 Inter sizes on one screen.', 'Small roles carry px floors (11, 12, 13). Raw px font sizes fail check-styles.mjs; off-scale rem sizes fail check-brand.mjs.');
  scaleTable(s, [['Live hero stat', 'Inter', '2.75 rem, line 1, tnum', '650, -0.02 em', 'Night Ink', '--fs-stat-live'], ['Row headline', 'Inter', '1.0625 / 1.375 rem (17/22)', '600', 'Night Ink', '--fs-row'], ['Body', 'Inter', '1 / 1.5 rem (16/24)', '400', 'Night Ink', '--fs-body'], ['Secondary', 'Inter', '0.9375 / 1.25 rem (15/20)', '500', 'Dusk', '--fs-sub'], ['Habit tile name', 'Inter', '0.9375 / 1.125 rem (15/18)', '600', 'Night Ink', '--fs-tile'], ['Footnote, tag', 'Inter', 'max(13px, 0.8125rem)', '500; tag 600', 'Dusk; Ember', '--fs-foot, --fs-tag'], ['Small tile label', 'Inter', 'max(12px, 0.75rem)', '600', 'Night Ink', '--fs-orb'], ['Tab label', 'Inter', 'max(11px, 0.6875rem)', '550; 650 active', 'Dusk; Ink', '--fs-caps'], ['Caption', 'Inter Tight', 'max(11px, 0.6875rem)', '600, caps, +0.14 em', 'Ink or Dusk', '--fs-caps, --tr-caps']]);
}
{
  const s = content('04  Type', 'Captions, numerals and type rules', 'Live numbers are Inter with tabular figures. Captions are tiny, letterspaced and few.', 'Captions: Inter Tight 600, 11 px floor, caps, +0.14 em, one per card, four words at most. Every live number is Inter with tabular-nums: 1111 and 0000 render at the same width. Fraunces sets only static numbers.');
  img(s, 'type-captions.png', { x: X0, y: 2.5, w: 4.4, alt: 'Caption, session name, a live stat in Inter and the 1111 and 0000 check' });
  txt(s, 'Times "6:30", distances "4.2 mi", durations "45 min" and "2 h 4 min". No leading zeros on hours.', { x: X0, y: 5.75, w: 4.3, h: 0.8, size: 13, color: K.dusk });
  doDont(s, [['Fraunces for titles, sentences and static stats.', 'Fraunces in buttons, chips, inputs, coins or live numbers.'], ['Inter 650 tnum for a stat that changes.', 'tabular-nums on Fraunces (it has no tabular figures).'], ['Fraunces roman at 600 to 700.', 'Fraunces roman under 600.'], ['Fraunces at 17 px and up (italic), 20 px and up (roman).', 'Fraunces below those floors.'], ['Captions: one per card, 4 words, no period.', 'A second caps tracking, or caps as the only label.'], ['rem sizes with px floors.', 'Raw px font sizes.']], { x: 5.4, y: 2.45, w: 7.33, size: 12, pad: 5 });
}

// ---------- 05 Layout ----------
opener('05', 'Layout and shape', 'A 16 px gutter, eight spacing steps, six radii and one soft shadow.', 'Section 5: grid, spacing, radii, surfaces and dividers.');
{
  const s = content('05  Layout and shape', 'Spacing steps and radii', 'Eight spacing steps plus three named exceptions. Six radii. Nothing else.', 'Spacing: 4, 8, 12, 16, 20, 24, 32, 48 for padding, margin and gap; the only exceptions are --gap-dot 3, --dot-offset -7 and --fade-h 52. Habit tiles gap and pad 12. Radii are drawn here at true ratio on a 96 px box.');
  const steps = [4, 8, 12, 16, 20, 24, 32, 48]; const k = 0.022; let x = X0; const base = 3.55;
  steps.forEach((v) => { const d = v * k; rrect(s, { x, y: base - d, w: d, h: d, fill: v === 16 ? K.sky : K.haze, name: 'step ' + v }); txt(s, String(v), { x: x - 0.2, y: base + 0.06, w: d + 0.4, h: 0.28, size: 12, bold: true, align: 'center' }); x += Math.max(d, 0.34) + 0.22; });
  cap(s, 'Spacing steps, px (16 is the gutter)', { x: X0, y: 3.98, w: 5.4, align: 'left' });
  spec(s, [['Gutter', '16 px at every phone width.'], ['Gaps', 'Cards 12, habit tiles 12, sections 32, header to card 12.'], ['Padding', 'Card 16, hero card 20, habit tile 12. Hit 44 x 44 pt.'], ['Exceptions', 'Week-dot gap 3, today dot offset -7, dock fade 52.']], { x: X0, y: 4.4, w: 5.6, lw: 1.5, size: 12, pad: 5 });
  // radii at true ratio: each box is 96 px wide (1.2 in), radius scaled the same
  const sc = 1.2 / 96, radii = [[24, 'Cards, sheets'], [18, 'Tiles, chips'], [14, 'Inputs, menus'], [12, 'Icon tiles'], ['pill', 'Buttons, bars'], ['circle', 'Coins, dots']];
  radii.forEach((r, i) => {
    const col = i % 3, row = Math.floor(i / 3), cw = 6.2 / 3, cx = 6.55 + col * cw + cw / 2, y = 2.5 + row * 2.15;
    const bw = 1.2, bh = r[0] === 'pill' ? 0.55 : 1.2;
    if (r[0] === 'circle') circle(s, { cx, cy: y + 0.6, d: 1.2, fill: K.paper, line: K.deep, lw: 1.5 });
    else rrect(s, { x: cx - bw / 2, y: y + (1.2 - bh) / 2, w: bw, h: bh, r: r[0] === 'pill' ? bh / 2 : r[0] * sc, fill: K.paper, line: K.deep, lw: 1.5, name: 'radius ' + r[0] });
    cap(s, typeof r[0] === 'number' ? `r ${r[0]} on 96` : r[0], { x: cx - cw / 2, y: y + 1.3, w: cw, color: K.ink });
    cap(s, r[1], { x: cx - cw / 2, y: y + 1.6, w: cw });
  });
}

// ---------- 06 Components ----------
opener('06', 'Components', 'Every part has a token or a number to check.', 'Section 6: the dock, buttons, chips, cards, the gauge, habit tiles, the week strip, charts, sheets, toasts, empty states, the assistant, Today\'s other parts, primitives and third-party marks.');
{
  const s = content('06  Components', 'The floating dock and tab capsule', 'The ask bar and six tabs float together, 8 px above the safe area, on a Cloud fade.', 'Tabs: Today, Goals, Learned, Plan, Progress, Journal. The active tab is a 32 px Sky disc with a Night Ink icon. The ask bar Orb is 28 px gloss and still. Progress uses the set\'s rising-line glyph.');
  panel(s, { x: X0, y: 2.45, w: 5.9, h: 2.4 });
  img(s, 'crop-dock.png', { x: X0 + 0.2, y: 2.6, w: 5.5, alt: 'The ask bar and the tab capsule' });
  cap(s, 'Ask bar 48, capsule 56, gap 8', { x: X0, y: 5.05, w: 5.9 });
  spec(s, [['Position', '12 px in from each edge, 8 above the safe area, a 52 px Cloud fade.'], ['Ask bar', '48 tall, Paper pill, Orb 28 px still. "Ask or change anything" Inter 17 Dusk.'], ['Capsule', '56 tall, Paper pill, six tabs in order.'], ['Tab', 'Icon 22 px, 1.75 stroke, in a 32 px circle. Label Inter 11 550 Dusk.'], ['Active', '32 px Sky disc, Night Ink icon (7.03), label 650.'], ['Badge', '8 px Sunrise dot, 2 px Paper keyline.'], ['Fold', 'The Orb becomes a 48 px round button holding a 28 px Orb.']], { x: 6.85, y: 2.45, w: 5.88, lw: 1.2, size: 12, pad: 4 });
}
{
  const s = content('06  Components', 'Buttons', 'Night Ink words on Sky. One primary per screen. Orange is never a button.', 'The primary is Sky with a Night Ink label at 7.03; white on Sky fails at 2.30. Secondary is Paper with a 1 px --edge. Destructive words are Signal and confirm in a sheet.');
  const L = X0, bw = 3.0, bh = 0.5;
  [['Primary', () => pill(s, "Set today's goal", { x: L, y: 2.5, w: bw, h: bh, fill: K.sky, bold: true, size: 14 })], ['Secondary', () => pill(s, "Write today's entry", { x: L, y: 3.2, w: bw, h: bh, fill: K.paper, line: K.lineStrong, bold: true, size: 14 })], ['Quiet', () => txt(s, 'History  >', { x: L + 0.2, y: 3.9, w: bw, h: bh, size: 14, bold: true, color: K.deep, valign: 'middle' })], ['Destructive', () => pill(s, 'Delete plan', { x: L, y: 4.6, w: bw, h: bh, fill: K.paper, line: K.lineStrong, bold: true, size: 14, color: K.signal })], ['Disabled', () => pill(s, 'Save', { x: L, y: 5.3, w: bw, h: bh, fill: K.haze, bold: true, size: 14, color: K.dusk })], ['Round icon', () => { circle(s, { cx: L + 0.25, cy: 6.25, d: 0.5, fill: K.paper, line: K.lineStrong }); txt(s, '+', { x: L, y: 6.0, w: 0.5, h: 0.5, size: 18, align: 'center', valign: 'middle' }); }]].forEach((r, i) => { r[1](); cap(s, r[0], { x: L + bw + 0.25, y: 2.62 + i * 0.7, w: 1.6, align: 'left', color: K.ink }); });
  spec(s, [['Primary', 'Sky #38B6F2, Night Ink Inter 17 650 (7.03). 54 full width, 44 inline. Pressed scale 0.97, 160 ms, #5CC4F5. Disabled Haze, Dusk (5.65).'], ['Secondary', 'Paper, Night Ink 600, 1 px --edge, no shadow.'], ['Quiet', 'Deep Sky Inter 600 (5.57), 44 hit. Also "+ Set".'], ['Destructive', 'Paper, Signal 600 (6.35), 1 px edge. Confirm in a sheet.'], ['Round icon', '40 px Paper circle (44 hit), 18 px icon, --shadow-float.']], { x: 5.75, y: 2.45, w: 6.98, lw: 1.6, size: 12, pad: 4 });
  doDont(s, [['Night Ink words on Sky.', 'White words on Sky (2.30).'], ['One primary per screen.', 'Two Sky buttons competing.']], { x: 5.75, y: 5.75, w: 6.98, size: 12, pad: 4 });
}
{
  const s = content('06  Components', 'Chips, tags and segmented controls', 'Selected things are Sky with Night Ink words. Tracks are Cloud. Tags stay small.', 'Context chips are Paper with a 40 px Haze disc. Filter chips and the segmented thumb turn Sky when on. The Today tag is Ember on Paper, never on Haze (4.38 fails).');
  panel(s, { x: X0, y: 2.45, w: 5.9, h: 2.45 });
  img(s, 'crop-chips.png', { x: X0 + 0.2, y: 2.6, w: 5.5, alt: 'Context chips: Training, Half marathon' });
  img(s, 'crop-seg.png', { x: X0 + 0.95, y: 3.85, w: 4.0, alt: 'Segmented control with Morning selected' });
  pill(s, 'Today', { x: X0, y: 5.15, w: 1.1, h: 0.42, fill: K.paper, line: 'D9A68C', size: 13, bold: true, color: K.ember });
  pill(s, 'Planned', { x: X0 + 1.3, y: 5.15, w: 1.3, h: 0.42, fill: K.cloud, size: 13, bold: true, color: K.dusk });
  pill(s, 'Easy', { x: X0 + 3.0, y: 5.15, w: 1.1, h: 0.42, fill: K.paper, line: K.lineStrong, size: 13, color: K.dusk });
  pill(s, 'Long', { x: X0 + 4.3, y: 5.15, w: 1.1, h: 0.42, fill: K.sky, size: 13, bold: true });
  cap(s, 'Tags', { x: X0, y: 5.75, w: 2.6, align: 'left' });
  cap(s, 'Filter chips: off, on', { x: X0 + 3.0, y: 5.75, w: 2.8, align: 'left' });
  spec(s, [['Context chip', 'Paper, r 18, --shadow-1, padding 12. 40 px Haze circle, Deep Sky 18 px glyph. Title Inter 17 600, subtitle 15 Dusk.'], ['Filter chip', 'Pill, 32 tall (44 hit). Off: Paper, 1 px --line-strong, Dusk. On: Sky, Night Ink 650.'], ['Tag', 'Pill, 28 tall, Inter --fs-tag 600. Today: Ember on Paper, 1 px Ember keyline at 40%. Planned: Dusk on Cloud.'], ['Segmented', 'Cloud track, Sky thumb, Inter 15. 44 tall in a card, 36 in a bar. Thumb on springs.settle.']], { x: 6.85, y: 2.45, w: 5.88, lw: 1.35, size: 12, pad: 5 });
}
{
  const s = content('06  Components', 'Cards and the hero card', 'Paper cards on a Cloud ground, no borders. One hero card per screen, with the only sunrise glow.', 'A card is Paper, radius 24, padding 16, --shadow-1. The hero card holds the screen\'s main thing and carries the one glow.');
  panel(s, { x: X0, y: 2.45, w: 5.3, h: 4.4 });
  img(s, 'crop-hero.png', { x: X0 + 0.2, y: 2.55, w: 4.9, h: 4.2, alt: "Today's hero card with the gauge" });
  spec(s, [['Card', 'Paper #FFFDF8, r 24, padding 16, no border. One caption, one primary at most.'], ['Shadow-1', '0 1px 1px rgba(14,34,54,.04), 0 10px 28px -14px rgba(14,34,54,.20).'], ['Hero card', 'One per screen. Padding 20. The sunrise glow under its bottom edge.'], ['Sunrise glow', 'radial-gradient(closest-side, rgba(255,182,128,.42), transparent), -12% sides, -52% bottom, 78% tall.'], ['Icon tile', '32 px, r 12, Haze, Deep Sky glyph. Session tiles 48 px, the data tone.'], ['Ground', 'Cloud with the dawn wash on tab roots; it scrolls with the page.']], { x: 6.2, y: 2.45, w: 6.53, lw: 1.35, size: 12, pad: 5 });
}
{
  const s = content('06  Components', "The U-arc training gauge, Today's hero", 'A Haze track, a Deep Sky fill, a Sunrise pointer, horizontal end labels and a readout inside the bowl.', 'The fill is Deep Sky (4.43 on Haze), never Sky (1.80). The readout carries the number; it sits inside the bowl, clear of the track. The fill sweeps on springs.number, the pointer on springs.settle.');
  panel(s, { x: X0, y: 2.45, w: 5.6, h: 4.1, fill: K.paper });
  img(s, 'crop-gauge.png', { x: X0 + 0.2, y: 2.55, w: 5.2, alt: 'U-arc gauge at 4.2 of 23 mi with fill, pointer and readout' });
  cap(s, 'Readout: required on every gauge', { x: X0, y: 6.6, w: 5.6 });
  spec(s, [['Geometry', '220 degrees, center (150, 62), r 118, viewBox 300 x 200. SVG y-down: 200 degrees (39.1, 21.6) through 90 to -20 (260.9, 21.6).'], ['Track, fill', 'Track 16 px Haze. Fill 9 px Deep Sky to the pointer, a Deep Sky start cap.'], ['Ticks', 'On the outer edge. Minor 0.5 mi, 1 x 5, --tick; major 5 mi, 1.5 x 10, --tick-major.'], ['Pointer', '12 px Sunrise, 3.5 px Paper keyline.'], ['End labels', '"0" and "23 MI", caption style, Dusk, tnum, horizontal.'], ['Readout', 'Paper pill, --shadow-pill, Inter 17 tnum: "4.2 of 23 mi · 1 of 4 runs". 8 px clear of the track.'], ['Motion', 'Fill springs.number (stroke-dashoffset), pointer springs.settle. First view only.']], { x: 6.45, y: 2.45, w: 6.28, lw: 1.3, size: 12, pad: 4 });
}
{
  const s = content('06  Components', 'Habit tiles', 'Two columns of Paper tiles. A lit coin is a flat Sky disc with a Night Ink check, never a glossy Orb.', 'Initials are Inter 600, names sentence case. Lit coins overshoot to 1.12 on springs.complete with the orb haptic on the peak. Week dots never use orange.');
  panel(s, { x: X0, y: 2.45, w: 5.4, h: 4.4 });
  img(s, 'crop-habits.png', { x: X0 + 0.2, y: 2.55, w: 5.0, h: 4.2, alt: 'Habit tiles: two lit coins, sentence-case names' });
  spec(s, [['Grid', 'Two columns, gap 12. Tiles Paper, r 18, --shadow-1, min 60, padding 12.'], ['Coin, off', '42 px, 1.5 px --coin-ring (decorative), initial Inter 600 --fs-row.'], ['Coin, lit', 'Flat Sky disc, Night Ink check (7.03). Overshoot to 1.12, orb haptic.'], ['Name', 'Inter 600 --fs-tile, sentence case: "Read 15 min". Up to 2 lines.'], ['Week dots', '6 px, gap 3. Done Deep Sky; missed 1.25 px Pencil ring; ahead --dot-ahead; shown day an Ink outline.'], ['Add tile', '42 px circle, 1.5 px --line ring and +, "Add" Inter 600.']], { x: 6.3, y: 2.45, w: 6.43, lw: 1.3, size: 12, pad: 5 });
}
{
  const s = content('06  Components', 'The week strip', 'Today and the shown day are never the same signal: today keeps its Sunrise dot, the shown day gets the Sky disc.', 'Seven cells, Monday first, sticky under the title bar on --wash-strip. Today always keeps its dot, whether or not it is the shown day.');
  panel(s, { x: X0, y: 2.45, w: 6.4, h: 1.75 });
  img(s, 'crop-week.png', { x: X0 + 0.2, y: 2.55, w: 6.0, alt: 'Week strip with Tuesday 10 as today and shown day' });
  const dx = [X0 + 1.4, X0 + 4.6];
  cap(s, 'Today', { x: dx[0] - 1, y: 4.55, w: 2, color: K.ink });
  circle(s, { cx: dx[0], cy: 5.0, d: 0.14, fill: K.sunrise, line: K.paper, lw: 1.5 });
  txt(s, 'T', { x: dx[0] - 0.3, y: 5.1, w: 0.6, h: 0.3, size: 13, bold: true, align: 'center' });
  txt(s, '10', { x: dx[0] - 0.4, y: 5.43, w: 0.8, h: 0.4, size: 17, bold: true, align: 'center' });
  cap(s, 'Dot plus a Night Ink letter', { x: dx[0] - 1.5, y: 6.05, w: 3.0 });
  cap(s, 'Shown day', { x: dx[1] - 1, y: 4.55, w: 2, color: K.ink });
  txt(s, 'F', { x: dx[1] - 0.3, y: 5.1, w: 0.6, h: 0.3, size: 13, bold: true, align: 'center', color: K.dusk });
  circle(s, { cx: dx[1], cy: 5.63, d: 0.5, fill: K.sky });
  txt(s, '13', { x: dx[1] - 0.4, y: 5.43, w: 0.8, h: 0.4, size: 17, bold: true, align: 'center', valign: 'middle' });
  cap(s, 'Sky disc plus a numeral', { x: dx[1] - 1.5, y: 6.05, w: 3.0 });
  spec(s, [['Letter', 'Caption style, Dusk. Today\'s letter Night Ink.'], ['Numeral', 'Inter 600 1.0625 rem, Night Ink, tnum.'], ['Shown day', '34 px Sky disc (7.03), on springs.settle.'], ['Today', '6 px Sunrise dot, 2 px keyline, 7 px above the letter. Always.'], ['Kind pill', '22 tall. Paper, 1 px edge. Done Sky, Ink glyphs. Today planned: Deep Sky ring.'], ['Hit', 'Each cell 44 pt wide or more, 81 tall.']], { x: 7.35, y: 2.45, w: 5.38, lw: 1.2, size: 12, pad: 5 });
}
{
  const s = content('06  Components', 'Charts', 'Sky bars with a Deep Sky top edge, a dashed plan, one Sunrise now dot, and the headline number printed above.', 'This week is done plus a dashed planned remainder. Axes are caption style in Dusk with tabular numerals. The headline is Inter 600 with tnum, never Fraunces. On Progress, a week horizon of half-suns sits under the ruler.');
  img(s, 'chart.png', { x: X0, y: 2.4, w: 6.0, alt: 'Weekly miles: Sky bars with Deep Sky tops, a dashed plan line, this week done plus a dashed remainder, a Sunrise now dot' });
  spec(s, [['Actual line', '2.5 px Deep Sky; area Sky at 16 percent.'], ['Plan', '1.5 px Dusk, dashed 4 / 4.'], ['Bars', 'Done: Sky with a 1.5 px Deep Sky top edge. Planned remainder: 1.5 px Deep Sky dashed 3 / 3.'], ['Now dot', '8 px Sunrise, 2 px Paper keyline.'], ['Ruler', 'Haze 6 px, Deep Sky fill, NOW tick 2 x 14 with Ember "NOW", Night Ink plan triangle.'], ['Week horizon', 'Half-suns on a --tick line, r = min(20, 6 + 1.5 x mi). Done Sky, planned dashed.'], ['Axes', 'Caption style, Dusk, tnum. Gridlines --grid. No borders.']], { x: 6.95, y: 2.45, w: 5.78, lw: 1.3, size: 12, pad: 4 });
}
{
  const s = content('06  Components', 'Sheets, toasts and empty states', 'Sheets for decisions, toasts for undo, a kind sentence when there is nothing yet.', 'Sheets open in 500 ms on --ease-sheet; drag releases run on springs.sheet. Toasts are Night Ink pills with White words (16.14). Empty states are a Fraunces italic sentence, one Dusk line and one button.');
  const cw = CW / 3, x1 = X0 + 0.25, w1 = cw - 0.5;
  rrect(s, { x: x1, y: 2.5, w: w1, h: 2.6, r: 0.24, fill: K.paper, line: K.line, shadow: true, name: 'sheet' });
  pill(s, '', { x: x1 + w1 / 2 - 0.25, y: 2.6, w: 0.5, h: 0.07, fill: K.lineStrong });
  fr(s, 'Move this run', { x: x1 + 0.25, y: 2.85, w: w1 - 0.5, h: 0.45, size: 20, weight: 600 });
  txt(s, 'Easy 5, Tuesday 6:30', { x: x1 + 0.25, y: 3.33, w: w1 - 0.5, h: 0.3, size: 13, color: K.dusk });
  pill(s, 'Move to Thursday', { x: x1 + 0.25, y: 4.4, w: w1 - 0.5, h: 0.48, fill: K.sky, bold: true, size: 13 });
  const x2 = X0 + cw + 0.2, w2 = cw - 0.4;
  pill(s, '', { x: x2, y: 3.45, w: w2, h: 0.55, fill: K.ink });
  txt(s, 'Moved your run to Thursday.', { x: x2 + 0.25, y: 3.45, w: w2 - 1.0, h: 0.55, size: 13, color: K.white, valign: 'middle' });
  txt(s, 'Undo', { x: x2 + w2 - 0.85, y: 3.45, w: 0.6, h: 0.55, size: 13, bold: true, color: K.haze, valign: 'middle', align: 'right' });
  const cx3 = X0 + 2 * cw + cw / 2;
  circle(s, { cx: cx3, cy: 3.05, d: 1.0, line: K.haze, lw: 1.5 }); circle(s, { cx: cx3, cy: 3.05, d: 0.6, fill: K.haze }); circle(s, { cx: cx3, cy: 3.17, d: 0.34, fill: K.sky });
  fr(s, 'Your first week shows here after your first run.', { x: cx3 - 1.8, y: 3.7, w: 3.6, h: 0.65, size: 15, weight: 420, italic: true, align: 'center' });
  pill(s, "Open this week's plan", { x: cx3 - 1.15, y: 4.5, w: 2.3, h: 0.44, fill: K.paper, line: K.lineStrong, size: 12, bold: true });
  [['Sheet', 'Paper, top corners 24, grabber 36 x 5 --grabber, title Fraunces 600, 40 px round buttons, scrim .32, one pinned primary.'], ['Toast', 'Night Ink pill 48 tall, White Inter 15 (16.14), action Haze 600. 3.2 s (5 s with action), never stacks.'], ['Empty state', 'Fraunces italic --fs-sentence, one Inter 15 Dusk line, one button. Flat circles only; never the glossy Orb.']].forEach((sp, i) => {
    const x = X0 + i * cw;
    cap(s, sp[0], { x: x + 0.15, y: 5.35, w: cw - 0.3, color: K.ink });
    txt(s, sp[1], { x: x + 0.2, y: 5.67, w: cw - 0.4, h: 1.2, size: 12, color: K.dusk, align: 'center' });
  });
}
{
  const s = content('06  Components', 'The assistant: composer and working state', 'The glossy Orb lives here. It thinks while the assistant works, and a status line says what it is doing.', 'Call it the assistant, never coach. The thinking arc is decorative; the status line with role="status" is the accessible signal. The provider disclosure stays as compliance wrote it.');
  img(s, 'phone-assistant-top.png', { x: X0, y: 2.35, h: 4.55, alt: 'The assistant sheet: Orb, greeting, suggestions and composer' });
  img(s, 'mark-thinking.png', { cx: 4.4, y: 2.75, w: 1.7, alt: 'The Orb thinking' });
  cap(s, 'Thinking', { x: 3.4, y: 4.55, w: 2, color: K.ink });
  cap(s, 'Arc is decorative', { x: 3.1, y: 4.85, w: 2.6 });
  spec(s, [['Empty state', 'Orb 56 px with glow. Greeting Fraunces italic --fs-sentence. One Inter 17 Dusk line. Disclaimer --fs-foot.'], ['Suggestions', 'Paper cards r 18, --shadow-1, Inter 17 600 and 15 Dusk.'], ['Composer', 'Paper r 24, 1 px --edge. "Ask anything" Inter 17 Dusk.'], ['Send', '40 px. Empty Haze; ready Sky with an Ink arrow; working: a 12 px Stop glyph, r 4.'], ['Working', 'Orb thinking. Status Inter 15 Dusk ("Reading your week"), role="status".'], ['Disclosure', 'The provider line stays exactly as written, --fs-foot Dusk.']], { x: 6.0, y: 2.45, w: 6.73, lw: 1.65, size: 12, pad: 5 });
}
{
  const s = content('06  Components', "Today's other parts, primitives and partner marks", 'Every part on Today has a spec (6.13), every primitive has one (6.14), and partner marks follow their owners (6.15).', 'Hold ring: Haze track, Deep Sky fill. Focus: a Deep Sky edge plus a 4 px Sky ring at 28%. Strava and Apple Health assets are used as supplied, marked brand-ok: third-party.');
  spec(s, [['Hold ring', 'Haze track 3 px, Deep Sky fill on stroke-dashoffset over 600 ms. Done: Sky face, Ink check.'], ['Morning line', 'Data tone line, Paper stops with Ink rings; the live node yields to Night Ink while the gauge pointer shows.'], ['Close the day', 'Three numbers in Inter 650 tnum (they change).'], ['To-dos', 'Checked: Sky coin, Ink check, Dusk words. User colors are 10 px dots from --tag-*; "orange" renders Ochre.']], { x: X0, y: 2.5, w: 5.9, lw: 1.4, size: 12, pad: 5 });
  spec(s, [['Field', '48 tall, r 14, Paper, 1 px --field-edge (3.20), Inter 17. Error: Signal edge and a line with a glyph.'], ['Focus', '1.5 px Deep Sky edge plus 0 0 0 4px rgba(56,182,242,.28).'], ['Switch', 'Sky track on, a check in the thumb so state is not color alone.'], ['Swipe action', 'White on Signal (6.45) or White on Deep Sky (5.66).'], ['Partner marks', 'Strava and Apple Health art unmodified, own row, never beside a Sunrise mark.']], { x: 6.83, y: 2.5, w: 5.9, lw: 1.45, size: 12, pad: 5 });
}

// ---------- 07 Icons ----------
opener('07', 'Iconography', 'Circles first, a 1.75 stroke, round caps. Never orange, never emoji.', 'Section 7: grid, stroke, construction, sizes, color and the set.');
{
  const s = content('07  Iconography', 'Icons: circles first, 1.75 stroke', 'A 24 px grid, round caps and joins, currentColor. Deep Sky in a Haze tile. One Progress glyph everywhere.', 'Today is a sun, Goals concentric rings, Progress a rising line ending in a small circle, in the set, the dock and everywhere else. Lucide fills gaps only at 1.75 with round caps.');
  img(s, 'icons.png', { x: X0, y: 2.4, w: 6.7, alt: 'The 24-icon set, Deep Sky glyphs in Haze tiles' });
  spec(s, [['Grid', '24 px, 2 px live-area inset.'], ['Stroke', '1.75 px, round caps and joins, currentColor.'], ['Corners', 'Rectangles r 4. One 1.3 px dot is the only fill.'], ['Sizes', '22 in tabs (26 at Larger Text), 18 in buttons, 15 in a 22 tile, 28 on sheets.'], ['Color', 'Dusk inactive, Night Ink active, Deep Sky in a Haze tile, the data tone in a session tile.'], ['Never', 'Emoji, stars, rockets, atoms, filled sets, two styles at once.']], { x: 7.6, y: 2.45, w: 5.13, lw: 1.0, size: 12, pad: 5 });
}

// ---------- 08 Illustration ----------
opener('08', 'Illustration and renders', 'One glossy object. Flat color everywhere else. The Orb always clears the horizon.', 'Section 8: one render, lighting, the poster, staging, the stamp and the circle vocabulary.');
{
  const s = content('08  Illustration and renders', 'One render, staged the same way every time', 'The Orb\'s bottom clears the horizon by 0.1 D. The horizon glow carries the warmth. Nothing covers the lower half.', 'Applies to the cover, the app icon, the poster, the landscape hero and the splash. Rings center on the Orb and never cross text. Where the art has its own Orb, use the wordmark alone.');
  img(s, 'hero-landscape.png', { x: X0, y: 2.45, w: 7.3, alt: 'Landscape hero: the Orb risen over three hills, the wordmark, the headline and a phone with Today' });
  spec(s, [['One render', 'The Orb only: the assistant, the splash, the app icon.'], ['Lighting', 'Cool white specular from above, Apricot underlight from below.'], ['Staging', 'Bottom 0.1 D above the crest; glow on the horizon; lower half never covered.'], ['The poster', 'Sky #8DD0F5 to #CFEBFA, horizon #F4E6D2 to #FFD2AE, hills #8FCDEE, #4FA9DB, #0A6CA6.'], ['The stamp', 'App: 44 px numeral only, aria-label "Day 12 streak". Art: 92 to 118 px with caption words.']], { x: 8.2, y: 2.45, w: 4.53, lw: 1.15, size: 12, pad: 5 });
}

// ---------- 09 Motion ----------
opener('09', 'Motion and haptics', 'Short, soft, and named: transform and opacity, plus three named cases.', 'Section 9: durations, springs, brand moments, Reduce Motion and haptics.');
{
  const s = content('09  Motion and haptics', 'Motion: short, soft and named', 'Transform and opacity, plus color, background-color and stroke-dashoffset where 9.1 names them. Springs come from lib/motion.ts.', 'A gradient never transitions: the dawn wash and the Orb\'s warming underlight are overlay opacity. The gauge fill uses springs.number, the pointer springs.settle. CSS sheet opens use --ease-sheet; drag releases use springs.sheet.');
  const rows = [['Press', 160, '160 ms to 0.97, --ease-out'], ['Color, halo', 200, '200 ms, color or background-color'], ['Fade in / out', 120, '120 / 100 ms'], ['Page push', 350, 'springs.page, 0.35 s'], ['Sheet open', 500, '500 ms, --ease-sheet'], ['Thumb, reflow', 300, 'springs.settle, 0.30 s'], ['Gauge fill', 480, 'springs.number, stroke-dashoffset'], ['Completion', 300, 'springs.complete to 1.12, orb haptic'], ['Splash rise', 900, '24 px rise, underlight opacity']];
  const sc = 0.0028;
  rows.forEach((r, i) => {
    const y = 2.5 + i * 0.47;
    cap(s, r[0], { x: X0, y: y + 0.08, w: 1.85, align: 'left', color: K.ink });
    rrect(s, { x: X0 + 1.95, y: y + 0.1, w: r[1] * sc, h: 0.18, r: 0.09, fill: r[0] === 'Splash rise' ? K.apricot : K.sky, name: r[0] + ' bar' });
    txt(s, r[2], { x: X0 + 1.95 + r[1] * sc + 0.12, y: y + 0.04, w: 3.6, h: 0.3, size: 12, color: K.dusk });
  });
  [['Brand moments', 'Splash: the Orb rises 24 px in 900 ms, wordmark fades 200 ms. Dawn wash: overlay opacity, 600 ms, once a day.'], ['Reduce Motion', '150 ms linear fades. The Orb holds still, gauges jump, the splash shows its final frame.'], ['Haptics', 'Named events from lib/haptics.ts, one per action, on the peak frame. Never for navigation.']].forEach((b, i) => {
    const y = 2.45 + i * 1.5;
    rrect(s, { x: 8.15, y, w: 4.58, h: 1.4, r: 0.2, fill: K.cloud, name: b[0] + ' card' });
    cap(s, b[0], { x: 8.4, y: y + 0.15, w: 4.1, align: 'left', color: K.ink });
    txt(s, b[1], { x: 8.4, y: y + 0.47, w: 4.15, h: 0.85, size: 12 });
  });
}

// ---------- 10 Voice ----------
opener('10', 'Voice and copy', 'Plain, warm, specific, honest. Orby is the product; the assistant speaks.', 'Section 10: principles, glossary and ten lines.');
{
  const s = content('10  Voice and copy', 'Voice: plain, warm, specific, honest', "Orby's copy reads like a friend who runs. Short words, short sentences, numbers instead of adjectives.", 'American spelling, no em dashes, at most one exclamation mark per screen, no model names in brand copy, sentence case everywhere except captions.');
  [['Plain', 'Short words, short sentences. One idea per line.'], ['Warm, not cute', 'Encouraging like a friend who runs, never a cheerleader.'], ['Specific', 'Numbers and times: "Easy 5 at 6:30", not "a great run".'], ['Honest', 'Say what happened, misses included, without guilt.'], ['House style', 'American spelling. No em dashes. One exclamation mark at most.']].forEach((p, i) => {
    const y = 2.5 + i * 0.86;
    fr(s, String(i + 1), { x: X0, y, w: 0.45, h: 0.5, size: 24, color: HEX.deep });
    txt(s, p[0], { x: X0 + 0.55, y: y + 0.02, w: 5, h: 0.3, size: 15, bold: true });
    txt(s, p[1], { x: X0 + 0.55, y: y + 0.35, w: 5.6, h: 0.4, size: 13, color: K.dusk });
  });
  const hd = (t, c) => ({ text: t, options: { fontFace: CAPF, bold: true, fontSize: 12, charSpacing: 1.7, color: c, margin: [1, 6, 6, 0], border: [NONE, NONE, LINE, NONE] } });
  const g = [['Orby', 'the Orby, Orby app, ORBY'], ['the assistant', 'coach, AI, bot, Orby'], ['entry', 'post, log'], ['Favorite', 'star, like, heart'], ['plan', 'program, schedule'], ['Wake time', 'alarm, wake-up'], ['session', 'workout (in UI labels)'], ['habit', 'streak item, task']];
  const data = [[hd('USE', K.deep), hd('NOT', K.signal)], ...g.map((r, i) => [{ text: r[0], options: { fontFace: BODY, fontSize: 13, bold: true, color: K.ink, margin: [5, 6, 5, 0], border: [NONE, NONE, i === g.length - 1 ? NONE : LINE, NONE] } }, { text: r[1], options: { fontFace: BODY, fontSize: 13, color: K.dusk, margin: [5, 6, 5, 0], border: [NONE, NONE, i === g.length - 1 ? NONE : LINE, NONE] } }])];
  cap(s, 'Glossary', { x: 7.2, y: 2.45, w: 3, align: 'left', color: K.ink });
  s.addTable(data, { x: 7.2, y: 2.78, w: 5.53, colW: [2.0, 3.53], fontFace: BODY, objectName: 'glossary', autoPage: false });
}
{
  const s = content('10  Voice and copy', 'Ten lines, done right and wrong', 'Copy these patterns. If a new line sounds like the right column, rewrite it.', 'Good copy is plain and specific and never shouts. It names numbers, admits misses kindly, and never calls the assistant a coach.');
  doDont(s, [["Good morning, Sam. Easy 5 today, then you're free.", 'Rise and grind, Sam!!! Time to crush it!'], ['Three mornings in a row. Nice work.', "AMAZING streak!! You're unstoppable!"], ['Rest day. Your legs will thank you tomorrow.', "No workout today :( Don't lose momentum!"], ['What would make today count?', 'Enter your daily goal below.'], ['Ask or change anything.', 'Chat with your AI coach.'], ['Moved your run to Thursday. Undo', 'Your workout has been successfully rescheduled.'], ['You missed Tuesday. Want to fit it in Saturday?', "You failed to complete Tuesday's session."], ['Orby is for fitness and wellness. It is not medical advice.', 'The Orby app is not a medical device.'], ['4.2 of 23 mi this week', '18% of weekly mileage goal achieved'], ['Nothing written yet. A line or two is plenty.', 'No entries found.']], { x: X0, y: 2.45, w: CW, size: 13, pad: 4.5 });
}

// ---------- 11 Accessibility ----------
opener('11', 'Accessibility', 'Every rule has a check. Color is never the only signal.', 'Section 11: contrast, color alone, Dynamic Type, targets, Reduce Motion, Increase Contrast, VoiceOver.');
{
  const s = content('11  Accessibility', 'Accessibility is part of the brand', 'Test at 200 percent text with Reduce Motion and Increase Contrast on.', 'Body 4.5:1, large text and meaningful graphics 3:1. Increase Contrast remaps both semantic aliases and palette names. Animated working indicators carry a status line.');
  const cards = [['Contrast', 'Body 4.5:1, large 3:1, graphics 3:1. check-contrast.mjs reads tokens.json.'], ['Color alone', 'Disc plus numeral, coin plus check, dot plus Ink letter, printed readouts.'], ['Dynamic Type', 'rem sizes with 11, 12, 13 px floors. Nothing clips at 200 percent.'], ['Targets', '44 x 44 pt for anything tappable, week cells and chips included.'], ['Reduce Motion', 'Every move a 150 ms linear fade. The Orb holds still.'], ['Increase Contrast', 'Dusk to #33475B, Deep Sky to #085A8C, Pencil to #5F6D7B, aliases and palette names.'], ['VoiceOver', 'The Orb reads "Assistant" or "Orby". Gauges read their readout. Stamps "Day 12 streak".'], ['Status', 'The thinking arc and skeletons pair with role="status" text.']];
  const cw = (CW - 3 * 0.2) / 4, ch = 2.1;
  cards.forEach((c, i) => {
    const x = X0 + (i % 4) * (cw + 0.2), y = 2.45 + Math.floor(i / 4) * (ch + 0.2);
    rrect(s, { x, y, w: cw, h: ch, r: 0.2, fill: K.cloud, name: c[0] + ' card' });
    txt(s, c[0], { x: x + 0.22, y: y + 0.2, w: cw - 0.4, h: 0.32, size: 14, bold: true });
    txt(s, c[1], { x: x + 0.22, y: y + 0.62, w: cw - 0.42, h: 1.35, size: 12 });
  });
}

// ---------- 12 Applying ----------
opener('12', 'Applying it to the app', 'Same structure, new palette, type and shape. Every screen has a mockup.', 'Section 12: screen by screen, the token migration and the order for builders.');
{
  const s = content('12  Applying it to the app', 'Today, before and after', 'Same screen, same structure. Sky leads, orange only marks now, and a half-sun sits on the title line.', 'The navy pill becomes a Sky pill with Ink words, the orange selected day becomes a Sky disc with today\'s Sunrise dot kept apart, caps become Fraunces title case.');
  img(s, 'phone-today-before.png', { x: X0, y: 2.35, h: 4.15, alt: 'Today before' });
  img(s, 'phone-today.png', { x: X0 + 2.75, y: 2.35, h: 4.15, alt: 'Today after' });
  cap(s, 'Before', { x: X0, y: 6.6, w: 1.92, color: K.ink });
  cap(s, 'After', { x: X0 + 2.75, y: 6.6, w: 1.92, color: K.deep });
  spec(s, [['Ground', 'Dawn wash on Cloud; the title-line sunrise.'], ['Week strip', 'Sky disc for the shown day; today keeps its dot.'], ['Hero card', 'Paper and the glow. Deep Sky fill, Sunrise pointer, horizontal ends, readout in the bowl.'], ['Session', '"Strength A" in Fraunces title case.'], ['Controls', 'Sky thumb with Ink words.'], ['Dock', '28 px gloss Orb, Sky active disc.']], { x: 6.35, y: 2.45, w: 6.38, lw: 1.3, size: 12, pad: 6 });
}
function phones(title, lede, list, notes) {
  const s = content('12  Applying it to the app', title, lede, notes);
  const colW = CW / list.length;
  list.forEach((p) => {
    const i = list.indexOf(p), cx = X0 + colW * i + colW / 2;
    img(s, p[0], { cx, y: 2.35, h: 3.8, alt: p[1] + ' mockup' });
    cap(s, p[1], { x: cx - colW / 2, y: 6.2, w: colW, color: K.ink });
    txt(s, p[2], { x: cx - colW / 2 + 0.08, y: 6.5, w: colW - 0.16, h: 0.45, size: 12, color: K.dusk, align: 'center' });
  });
}
phones('Applied: Today, Goals, Learned, Plan, Progress', 'The live app at 390 x 844 with the new tokens, seeded with a week of runs.', [['phone-today-habits.png', 'Today, habits', 'Two lit Sky coins'], ['phone-goals.png', 'Goals', 'One primary, quiet "+ Set"'], ['phone-learned.png', 'Learned', 'Input in Inter 17'], ['phone-plan.png', 'Plan', 'Sunrise live node'], ['phone-progress.png', 'Progress', 'Ruler, half-suns, now dot']], 'Each screen keeps its structure. The Progress week horizon is the proposed component from 6.8, drawn by the shoot script. override.css lists the class-level changes tokens cannot reach.');
phones('Applied: Journal, the assistant, Settings, welcome, splash', 'The splash is the one place the Orb rises: over the poster\'s hills, with a caption that follows the time of day.', [['phone-journal.png', 'Journal', 'Flat discs with numerals'], ['phone-assistant-top.png', 'The assistant', 'Orb 56 px, Fraunces greeting'], ['phone-settings.png', 'Settings', 'Inset groups, Haze tiles'], ['phone-welcome.png', 'Welcome', 'Outlined lockup'], ['phone-splash.png', 'Splash', 'GOOD MORNING, AFTERNOON, EVENING']], 'Native splash: the still Orb centered on Cloud. theme-color and backgroundColor become #EAF5FC.');

// ---------- 13 Checklist and agent ----------
opener('13', 'The checklist and the brand agent', 'A change is done when every line is true, checked by the brand-guardian agent.', 'Section 13 and 13.1.');
{
  const s = content('13  The checklist', 'Before you finish any UI change', 'Run all of it. Lines marked runtime need the app running; a rule that was not run is unverified, never passed.', 'The definition of done. check-brand.mjs covers the static lines; docs/brand/tools/audit.mjs covers the runtime ones.');
  const items = ['Every value from a token. check-brand.mjs adds no findings.', 'Every pairing listed (3.2). pnpm test passes. Runtime: the audit.', 'No Sky text on light, no white on Sky, no Sunrise text.', 'At most 3 Sunrise marks, by priority; keylines 2 px or more. Runtime.', 'One Orb, sized by tier: 48+, 28 to 47, under 28 flat. Runtime.', 'One hero card and one glow. Runtime.', 'Fraunces only in titles, sentences, static stats. No stray axes.', 'Live numbers are Inter with tnum. Gauges print a readout.', 'Radii 24, 18, 14, 12, pill, circle. Spacing on steps or a named exception.', 'Captions: Inter Tight 600, caps, +0.14 em, one per card.', 'Icons 1.75, round caps, the set\'s Progress glyph. No emoji.', 'Copy: Orby, the assistant, American spelling, no em dashes.', 'Tested at 200 percent, Reduce Motion, Increase Contrast. Runtime.', 'Motion: transform, opacity and the named cases only.', 'Partner marks unmodified, marked brand-ok: third-party.', 'Identifiers unchanged. A screenshot matches its mockup.'];
  const cw = (CW - 0.4) / 2;
  items.forEach((t, i) => {
    const col = i < 8 ? 0 : 1, row = i % 8, x = X0 + col * (cw + 0.4), y = 2.45 + row * 0.55;
    circle(s, { cx: x + 0.13, cy: y + 0.16, d: 0.24, fill: K.paper, line: K.deep, lw: 1.5 });
    txt(s, t, { x: x + 0.42, y, w: cw - 0.45, h: 0.5, size: 13 });
  });
}
{
  const s = content('13.1  The brand agent', 'The brand agent: the guide, as a reviewer', 'The brand-guardian agent (.claude/agents/brand-guardian.md) checks every change against the guide and the tokens.', 'It reads the guide, tokens.css and tokens.json and the diff across apps/web, apps/api, packages/shared and the shell files. It runs check-brand, check-styles and, with a dev server URL, the runtime audit. It never edits files.');
  [['Ask before you build', '"Which tokens does a new filter chip use?" It answers with values and the guide section.'], ['Run it on your diff', 'check-brand.mjs: colors, fonts, sizes, radii, tracking, spacing, motion, axes and copy.'], ['Give it a URL', 'audit.mjs checks pairings on real grounds, the Sunrise count, Orbs, sizes and tnum.'], ['Fix and re-run', 'PASS needs every line; anything not run is listed as not verified.']].forEach((st, i) => {
    const cw = (CW - 3 * 0.25) / 4, x = X0 + i * (cw + 0.25), y = 2.55;
    circle(s, { cx: x + 0.38, cy: y + 0.38, d: 0.76, fill: i === 0 ? K.sky : K.haze });
    fr(s, String(i + 1), { x, y, w: 0.76, h: 0.76, size: 24, align: 'center', valign: 'middle' });
    txt(s, st[0], { x, y: y + 0.95, w: cw - 0.1, h: 0.35, size: 15, bold: true });
    txt(s, st[1], { x, y: y + 1.35, w: cw - 0.15, h: 1.0, size: 13, color: K.dusk });
  });
  const hw = (CW - 0.3) / 2;
  rrect(s, { x: X0, y: 5.0, w: hw, h: 1.8, r: 0.2, fill: K.cloud, name: 'reads card' });
  cap(s, 'What it reads and runs', { x: X0 + 0.3, y: 5.2, w: 4, align: 'left', color: K.ink });
  txt(s, 'brand-guide.md, tokens.css, tokens.json and the diff. check-brand.mjs, check-styles.mjs, check-contrast.mjs when tokens change, and audit.mjs on the screens touched.', { x: X0 + 0.3, y: 5.52, w: hw - 0.6, h: 1.2, size: 13 });
  rrect(s, { x: X0 + hw + 0.3, y: 5.0, w: hw, h: 1.8, r: 0.2, fill: K.paper, line: K.line, name: 'never card' });
  cap(s, 'What it never does', { x: X0 + hw + 0.6, y: 5.2, w: 4, align: 'left', color: K.signal });
  txt(s, 'Edit files, invent a token, approve an unlisted pairing, rename the repo, packages, bundle id or storage keys, or pass a rule it could not check.', { x: X0 + hw + 0.6, y: 5.52, w: hw - 0.6, h: 1.2, size: 13 });
}

// ---------- Closing ----------
sec('Closing');
{
  const s = pres.addSlide({ masterName: 'Orby Section', sectionTitle: section });
  s.addText([{ text: 'One good day at a time.', options: { transparency: 100 } }], { placeholder: 'title' });
  img(s, 'closing-art.png', { cx: W / 2, y: 0.7, w: 7.4, alt: 'Stacked Orby lockup in Paper with rings around the Orb and the line One good day at a time.' });
  cap(s, 'Questions go to docs/brand/brand-guide.md. When the guide is silent, ask before inventing.', { x: X0, y: 6.45, w: CW, color: K.haze });
  s.addNotes('The guide is the source of truth; this deck is its summary. If they disagree, the guide wins, and someone fixes the deck.');
}

// ---------- write, theme, embed the wordmark SVGs ----------
async function embedSvgs(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const ct = await zip.file('[Content_Types].xml').async('string');
  if (!ct.includes('Extension="svg"')) zip.file('[Content_Types].xml', ct.replace('<Default Extension="png"', '<Default Extension="svg" ContentType="image/svg+xml"/><Default Extension="png"'));
  const svgParts = {};
  for (const tone of ['ink', 'paper']) { const name = `ppt/media/orby-wordmark-${tone}.svg`; zip.file(name, fs.readFileSync(WM[tone].svg)); svgParts[tone] = name; }
  let n = 0;
  for (const f of Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))) {
    let xml = await zip.file(f).async('string');
    if (!xml.includes('name="svg:wordmark-')) continue;
    const relsPath = f.replace('slides/', 'slides/_rels/') + '.rels';
    let rels = await zip.file(relsPath).async('string');
    const ids = {};
    for (const tone of ['ink', 'paper']) {
      if (!xml.includes(`name="svg:wordmark-${tone}"`)) continue;
      const rid = `rIdSvg${tone}`;
      rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/orby-wordmark-${tone}.svg"/></Relationships>`);
      ids[tone] = rid;
    }
    xml = xml.replace(/<p:pic>([\s\S]*?)<\/p:pic>/g, (pic) => {
      const m = /name="svg:wordmark-(ink|paper)"/.exec(pic);
      if (!m) return pic;
      n++;
      return pic.replace(/<a:blip r:embed="([^"]+)"\s*\/>/, `<a:blip r:embed="$1"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${ids[m[1]]}"/></a:ext></a:extLst></a:blip>`)
        .replace(/<a:blip r:embed="([^"]+)">(?!<a:extLst>)/, `<a:blip r:embed="$1"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${ids[m[1]]}"/></a:ext></a:extLst>`);
    });
    zip.file(f, xml); zip.file(relsPath, rels);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('embedded', n, 'wordmark SVGs');
}
(async () => {
  await renderJobs();
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  await embedSvgs(OUT);
  console.log('wrote', OUT);
})();
