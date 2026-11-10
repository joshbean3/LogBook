// Renders every image the deck uses, with the brand fonts and the Orb recipe. Text inside images is sized so it lands at
// 12 pt or more on the slide (CSS px here are 1/96 in at slide size; deviceScaleFactor 3).
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { orbSVG } from '../final/orb.mjs';
import { ICONS, icon } from '../final/icons.mjs';

const B = '/home/user/LogBook/docs/brand';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'img');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ? process.argv[2].split(',') : null;
const F = `file://${B}/fonts`;
const css = `
@font-face{font-family:'Fr';src:url(${F}/fraunces-latin-full-normal.woff2) format('woff2');font-weight:100 900;font-style:normal}
@font-face{font-family:'Fr';src:url(${F}/fraunces-latin-full-italic.woff2) format('woff2');font-weight:100 900;font-style:italic}
@font-face{font-family:'In';src:url(${F}/inter-latin-wght-normal.woff2) format('woff2');font-weight:100 900}
@font-face{font-family:'IT';src:url(${F}/inter-tight-latin-wght-normal.woff2) format('woff2');font-weight:100 900}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent;font-family:'In';color:#0E2236;-webkit-font-smoothing:antialiased}
html{font-variation-settings:'SOFT' 100,'WONK' 0}
.fr{font-family:'Fr';font-optical-sizing:auto}
.cap{font-family:'IT';font-weight:600;text-transform:uppercase;letter-spacing:.14em}
.tnum{font-variant-numeric:tabular-nums}
`;
const INK = '#0E2236', DUSK = '#46596D', PAPER = '#FFFDF8', SKY = '#38B6F2', DEEP = '#0A6CA6', HAZE = '#CBE8F8', CLOUD = '#EAF5FC';
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 3, viewport: { width: 1280, height: 720 } });
const pages = { 3: page };
async function shot(name, html, w, h, { transparent = true, scale = 3 } = {}) {
  if (only && !only.includes(name.replace('.png', ''))) return;
  const p = pages[scale] ||= await browser.newPage({ deviceScaleFactor: scale, viewport: { width: w, height: h } });
  await p.setViewportSize({ width: w, height: h });
  const tmp = path.join(OUT, '_page.html');
  fs.writeFileSync(tmp, `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="width:${w}px;height:${h}px;overflow:hidden;position:relative">${html}</body></html>`);
  await p.goto('file://' + tmp, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, name), omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  console.log('wrote', name);
}
const svgFile = (f) => fs.readFileSync(`${B}/assets/${f}`, 'utf8');
const sized = (svg, w) => svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, `<svg$1 width="${w}"`).replace(/<svg(?![^>]*width=)/, `<svg width="${w}"`);
const grainDef = `<svg width="0" height="0" style="position:absolute"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .27  0 0 0 0 .18  0 0 0 .55 0"/></filter></svg>`;
const grain = (op = .22) => `<div style="position:absolute;inset:0;filter:url(#g);opacity:${op};mix-blend-mode:multiply"></div>`;
const ringsAt = (cx, cy, rs, color = '255,255,255', a0 = .7) => rs.map((r, i) => `<div style="position:absolute;left:${cx - r}px;top:${cy - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:1.5px solid rgba(${color},${Math.max(.1, a0 - i * .1)})"></div>`).join('');
// hills in a w x h box; the first hill's crest at x is crestY(x)
const hills = (w, h, top) => `<svg style="position:absolute;left:0;top:${top}px" width="${w}" height="${h - top}" viewBox="0 0 ${w} ${h - top}" preserveAspectRatio="none">
  <path d="M0 40 C ${w * .2} 0, ${w * .45} 10, ${w * .62} 34 S ${w * .9} 60, ${w} 22 L ${w} ${h} L 0 ${h} Z" fill="#8FCDEE"/>
  <path d="M0 96 C ${w * .18} 70, ${w * .4} 64, ${w * .58} 92 S ${w * .86} 120, ${w} 84 L ${w} ${h} L 0 ${h} Z" fill="#4FA9DB"/>
  <path d="M0 150 C ${w * .25} 128, ${w * .5} 140, ${w * .7} 152 S ${w * .92} 160, ${w} 136 L ${w} ${h} L 0 ${h} Z" fill="#0A6CA6"/></svg>`;
// crest of the first hill (sampled from the path above with a browser)
async function crestY(w, h, top, x) {
  return page.evaluate(({ w, h, top, x }) => {
    const ns = 'http://www.w3.org/2000/svg'; const s = document.createElementNS(ns, 'svg'); const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', `M0 40 C ${w * .2} 0, ${w * .45} 10, ${w * .62} 34 S ${w * .9} 60, ${w} 22 L ${w} ${h} L 0 ${h} Z`); s.appendChild(p); document.body.appendChild(s);
    let best = 1e9; const L = p.getTotalLength(); for (let i = 0; i < L; i += 0.5) { const q = p.getPointAtLength(i); if (Math.abs(q.x - x) < 0.6 && q.y < h - 1) best = Math.min(best, q.y); }
    s.remove(); return top + best;
  }, { w, h, top, x });
}

// ---------- the Orb, transparent ----------
await shot('mark.png', orbSVG(576, { id: 'm' }).replace(/width="[^"]+" height="[^"]+"/, 'width="600" height="600"'), 600, 600, { scale: 1 });
await shot('mark-glow.png', orbSVG(400, { id: 'mg', glow: true }).replace(/width="[^"]+" height="[^"]+"/, 'width="600" height="600"'), 600, 600, { scale: 1 });
await shot('mark-glow-dark.png', orbSVG(400, { id: 'md', glow: true, dark: true }).replace(/width="[^"]+" height="[^"]+"/, 'width="600" height="600"'), 600, 600, { scale: 1 });
await shot('mark-thinking.png', orbSVG(400, { id: 'mt', state: 'think', glow: true }).replace(/width="[^"]+" height="[^"]+"/, 'width="600" height="600"'), 600, 600, { scale: 1 });
await shot('mark-flat.png', `<svg width="600" height="600" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${SKY}"/></svg>`, 600, 600, { scale: 1 });
// wordmark PNG fallbacks for the embedded SVGs
for (const t of ['ink', 'paper']) {
  const s = svgFile(`wordmark-${t}.svg`); const vb = s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  await shot(`wordmark-${t}.png`, sized(s, 1200), 1200, Math.round(1200 * vb[3] / vb[2]), { scale: 1 });
}

// ---------- the size tiers: Orbs only, labels are live text in the deck ----------
const tierSizes = [[96, 'full'], [72, 'full'], [56, 'full'], [48, 'full'], [40, 'gloss'], [32, 'gloss'], [28, 'gloss'], [24, 'flat'], [20, 'flat'], [16, 'flat']];
await shot('tiers.png', `<div style="display:flex;justify-content:space-between;align-items:center;width:1164px;height:150px">${tierSizes.map(([s, t], i) => `<div style="width:116px;display:flex;justify-content:center">${t === 'flat' ? `<span style="display:block;width:${s}px;height:${s}px;border-radius:50%;background:${SKY}"></span>` : orbSVG(s, { glow: t === 'full', id: 't' + i })}</div>`).join('')}</div>`, 1164, 150);

// ---------- cover: the governing image, staged per guide 8.3 ----------
{
  const W = 1280, H = 720, top = 526, cx = 900, D = 380;
  const cy0 = await crestY(W, H, top, cx); const cy = cy0 - 0.1 * D - D / 2;
  await shot('cover.png', `${grainDef}<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:linear-gradient(180deg,#8DD0F5 0%,#AEDDF8 30%,#CFEBFA 50%,#F4E6D2 68%,#FFD2AE 78%)">
    <div style="position:absolute;left:${cx - 420}px;top:${cy0 - 150}px;width:840px;height:300px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,182,128,.75),rgba(255,182,128,0))"></div>
    ${ringsAt(cx, cy, [230, 285, 340])}
    <div style="position:absolute;left:${cx - D / 2}px;top:${cy - D / 2}px">${orbSVG(D, { id: 'cv' })}</div>
    ${hills(W, H, top)}${grain()}
    <div class="fr" style="position:absolute;left:61px;top:178px;font-weight:700;font-size:86px;line-height:.98;letter-spacing:-.02em;color:${INK}">One good day<br>at a time.</div>
  </div>`, W, H, { transparent: false, scale: 2 });
}

// ---------- section opener art: a half-sun on the horizon, Haze rings, on Twilight (transparent) ----------
await shot('opener-art.png', `<div style="position:relative;width:520px;height:520px">
  ${ringsAt(260, 360, [150, 200, 250], '203,232,248', .34)}
  <div style="position:absolute;left:150px;top:250px;width:220px;height:110px;border-radius:110px 110px 0 0;background:radial-gradient(circle at 50% 100%,#FFE3CB 0,#FFB680 72%)"></div>
  <div style="position:absolute;left:0;right:0;top:360px;height:2px;background:rgba(203,232,248,.55)"></div>
  <div style="position:absolute;left:0;right:0;top:362px;bottom:0;background:linear-gradient(180deg,rgba(27,72,112,1),rgba(27,72,112,1))"></div>
</div>`, 520, 520);

// ---------- logo construction (deck version, large labels) ----------
{
  const geo = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-LogBook/203fe2a6-2bdf-53d9-a92e-1cbd9356aa24/scratchpad/brand/final/out/geom.json', 'utf8'));
  const LW = geo.horiz[2], LH = geo.horiz[3] - geo.horiz[1], BASE = -geo.horiz[1], S = 0.088, C = 1400 * S;
  const w = LW * S, h = LH * S, W = w + 2 * C + 230, Hh = h + 2 * C + 70;
  const ox = C + 10, oy = C + 40;
  const line = (y, label) => `<div style="position:absolute;left:${ox - 24}px;width:${w + 48}px;top:${oy + y}px;height:1.5px;background:${DEEP}"></div><div class="cap" style="position:absolute;left:${ox + w + C + 14}px;top:${oy + y - 12}px;font-size:22px;color:${DEEP};white-space:nowrap">${label}</div>`;
  await shot('construction.png', `<div style="position:relative;width:${W}px;height:${Hh}px">
    <div style="position:absolute;left:${ox - C}px;top:${oy - C}px;width:${w + 2 * C}px;height:${h + 2 * C}px;border:2px dashed ${DUSK};border-radius:6px"></div>
    <div class="cap" style="position:absolute;left:${ox - C + 12}px;top:${oy - C + 10}px;font-size:22px;color:${DUSK}">Clear space C</div>
    <div style="position:absolute;left:${ox + geo.H.D * S}px;width:${geo.H.gap * S}px;top:${oy - 20}px;height:${h + 40}px;background:rgba(56,182,242,.18)"></div>
    <div class="cap" style="position:absolute;left:${ox + geo.H.D * S - 30}px;width:${geo.H.gap * S + 60}px;text-align:center;top:${oy - 52}px;font-size:22px;color:${DEEP}">0.35 C</div>
    <div style="position:absolute;left:${ox}px;top:${oy}px">${sized(svgFile('lockup-horizontal-ink.svg'), w)}</div>
    ${line((BASE - 1400) * S, 'Cap 1400')}${line((BASE - 890) * S, 'x 890')}${line(BASE * S, 'Base 0')}
  </div>`, Math.round(W), Math.round(Hh));
}
// ---------- minimum sizes at screen scale (labels live in the deck) ----------
await shot('minsizes.png', `<div style="display:flex;justify-content:space-around;align-items:flex-end;width:520px;height:90px;padding-bottom:6px">
  <div>${sized(svgFile('lockup-horizontal-flat-ink.svg'), 96)}</div><div>${sized(svgFile('lockup-stacked-ink.svg'), 56)}</div><div>${sized(svgFile('wordmark-ink.svg'), 64)}</div>
  <div>${orbSVG(28, { id: 'mn' })}</div><div><span style="display:block;width:16px;height:16px;border-radius:50%;background:${SKY}"></span></div></div>`, 520, 90);

// ---------- logo misuse grid (deck version: captions at 12 pt or more on the slide) ----------
{
  const lockH = svgFile('lockup-horizontal-ink.svg'), wm = svgFile('wordmark-ink.svg');
  const d = (inner, cap) => `<div style="text-align:center"><div style="height:96px;border-radius:18px;background:${CLOUD};display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden"><div style="transform:scale(.72)">${inner}</div>
    <svg width="34" height="34" viewBox="0 0 24 24" style="position:absolute;right:8px;top:8px"><circle cx="12" cy="12" r="11" fill="#B42340"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></div><div class="cap" style="margin-top:8px;font-size:18px;line-height:22px;white-space:nowrap">${cap}</div></div>`;
  const wmD = (wm.match(/ d="([^"]+)"/) || [])[1];
  await shot('donts.png', `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px 20px;width:1164px">
    ${d(`<div style="transform:scaleX(1.4)">${sized(lockH, 150)}</div>`, 'Stretch or squash')}
    ${d(`<span style="font:700 46px In;letter-spacing:-.02em">Orby</span>`, 'Retype it')}
    ${d(`<div style="display:flex;align-items:center;gap:2px">${orbSVG(58, { id: 'd0' })}<svg viewBox="1440 -1497 2969 1988" width="${2969 * 0.03}"><path fill="${INK}" d="${wmD}"/></svg></div>`, 'Swap the O')}
    ${d(`<span class="fr" style="font-size:40px;font-weight:700;letter-spacing:.06em">ORBY</span>`, 'Set it in caps')}
    ${d(`<div style="filter:hue-rotate(160deg)">${sized(lockH, 180)}</div>`, 'Recolor the Orb')}
    ${d(`<svg width="76" height="76" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#F2600C"/><circle cx="50" cy="50" r="48" fill="${SKY}" clip-path="inset(0 0 50% 0)"/></svg>`, 'A two-tone ball')}
    ${d(`<div style="display:flex;gap:6px">${orbSVG(46, { id: 'd2' })}${orbSVG(46, { id: 'd3' })}</div>`, 'Two Orbs')}
    ${d(`<div style="background:linear-gradient(135deg,#F2600C,${SKY});padding:20px 14px;border-radius:12px">${sized(lockH, 160)}</div>`, 'A busy ground')}
    ${d(`<div style="position:relative">${orbSVG(76, { id: 'd4' })}<svg width="76" height="76" viewBox="0 0 100 100" style="position:absolute;left:3px;top:3px"><circle cx="38" cy="44" r="5" fill="${INK}"/><circle cx="62" cy="44" r="5" fill="${INK}"/><path d="M36 62q14 12 28 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/></svg></div>`, 'Give it a face')}
    ${d(`<span style="filter:drop-shadow(3px 4px 2px rgba(0,0,0,.4))">${sized(wm, 130)}</span>`, 'Drop shadows')}
    ${d(sized(lockH, 180).replace(/fill="#0E2236"/, 'fill="#46596D"'), 'A grey wordmark')}
    ${d(`<div style="display:flex;align-items:center;gap:40px">${orbSVG(40, { id: 'd5' })}${sized(wm, 100)}</div>`, 'Change the spacing')}
    ${d(`<div style="transform:rotate(-14deg)">${sized(lockH, 170)}</div>`, 'Rotate it')}
    ${d(`<div style="text-align:left;font-size:20px;line-height:27px;padding:0 16px">Open <b>the Orby app</b> and log your run.</div>`, '"The Orby app"')}
    ${d(`<div style="outline:2px solid ${INK};outline-offset:10px;border-radius:2px">${sized(lockH, 160)}</div>`, 'Box it')}
  </div>`, 1164, 420);
}

// ---------- icon set: Deep Sky glyphs in Haze tiles ----------
await shot('icons.png', `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:16px 10px;width:640px">${Object.keys(ICONS).map((k) => `<div style="text-align:center;color:${DEEP}"><div style="width:62px;height:62px;margin:0 auto;border-radius:12px;background:${HAZE};display:flex;align-items:center;justify-content:center">${icon(k, 30)}</div><div class="cap" style="margin-top:7px;font-size:16px;color:${DUSK}">${k}</div></div>`).join('')}</div>`, 640, 470);

// ---------- weekly chart, drawn to the 6.8 spec ----------
{
  const weeks = [['SEP 22', 12, 11.2], ['SEP 29', 14, 13.6], ['OCT 6', 15, 12.4], ['OCT 13', 16, 15.8], ['OCT 20', 18, 17.1], ['OCT 27', 15, 14.6], ['NOV 3', 20, 18.9], ['NOV 10', 23, 4.2]];
  const W = 580, H = 340, L = 44, R = 12, T = 96, Bm = 46, max = 25, ph = H - T - Bm, y = (v) => T + ph * (1 - v / max), bw = 34, step = (W - L - R) / weeks.length;
  const grid = [0, 5, 10, 15, 20, 25].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(14,34,54,.08)"/><text x="${L - 10}" y="${y(v) + 6}" text-anchor="end" class="cap" font-size="17" fill="${DUSK}">${v}</text>`).join('');
  const bars = weeks.map(([l, plan, done], i) => {
    const x = L + step * i + (step - bw) / 2, cur = i === weeks.length - 1;
    let g = `<rect x="${x}" y="${y(done)}" width="${bw}" height="${y(0) - y(done)}" fill="${SKY}"/><line x1="${x}" x2="${x + bw}" y1="${y(done) + .75}" y2="${y(done) + .75}" stroke="${DEEP}" stroke-width="1.5"/>`;
    if (cur) g += `<rect x="${x + .75}" y="${y(plan)}" width="${bw - 1.5}" height="${y(done) - y(plan)}" fill="none" stroke="${DEEP}" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="${x + bw / 2}" cy="${y(done)}" r="4" fill="#F2600C" stroke="${PAPER}" stroke-width="2"/>`;
    return g + `<text x="${x + bw / 2}" y="${H - 16}" text-anchor="middle" class="cap" font-size="16" fill="${cur ? '#B4430C' : DUSK}">${cur ? 'NOW' : i % 2 === 0 ? l : ''}</text>`;
  }).join('');
  const plan = weeks.map(([, p], i) => `${i ? 'L' : 'M'}${L + step * i + step / 2} ${y(p)}`).join(' ');
  await shot('chart.png', `<div style="width:${W}px;height:${H}px;position:relative">
    <div class="cap" style="font-size:17px;color:${DUSK}">Weekly miles</div>
    <div class="tnum" style="font-weight:600;font-size:30px;line-height:36px;margin-top:4px">4.2 <span style="font-weight:500;font-size:20px;color:${DUSK}">of 23 mi this week</span></div>
    <svg width="${W}" height="${H}" style="position:absolute;left:0;top:0" font-family="IT" font-weight="600" letter-spacing="2">${grid}${bars}<path d="${plan}" fill="none" stroke="${DUSK}" stroke-width="1.5" stroke-dasharray="4 4"/></svg></div>`, W, H);
}

// ---------- captions and numerals (no Fraunces digits) ----------
await shot('type-captions.png', `<div style="width:440px;height:300px;position:relative">
  <div class="cap" style="font-size:17px">Today's lift</div>
  <div class="fr" style="font-weight:650;font-size:40px;line-height:1.1;margin-top:6px">Strength A</div>
  <div style="font-size:19px;color:${DUSK};margin-top:4px">Floor 20 min</div>
  <div style="display:flex;gap:30px;margin-top:26px;align-items:baseline">
    <div><span class="tnum" style="font-weight:650;font-size:56px;letter-spacing:-.02em">4.2</span><span style="font-size:19px;color:${DUSK};font-weight:500"> of 23 mi</span></div>
    <div><span class="tnum" style="font-weight:600;font-size:30px">8:42</span><span style="font-size:19px;color:${DUSK};font-weight:500"> /mi</span></div>
  </div>
  <div style="display:flex;gap:14px;margin-top:20px">
    <div class="tnum" style="font-size:26px;font-weight:600;background:${CLOUD};border-radius:12px;padding:6px 16px">1111</div>
    <div class="tnum" style="font-size:26px;font-weight:600;background:${CLOUD};border-radius:12px;padding:6px 16px">0000</div>
  </div></div>`, 440, 300);

// ---------- type family specimens ----------
const fam = (inner) => `<div style="width:330px;height:190px">${inner}</div>`;
await shot('fam-fraunces.png', fam(`<div class="fr" style="font-weight:700;font-size:120px;line-height:1">Aa</div><div class="fr" style="font-weight:700;font-size:32px;margin-top:14px">Fraunces</div>`), 330, 190);
await shot('fam-inter.png', fam(`<div style="font-weight:600;font-size:120px;line-height:1">Aa</div><div style="font-weight:600;font-size:32px;margin-top:14px">Inter</div>`), 330, 190);
await shot('fam-intertight.png', fam(`<div class="cap" style="font-size:40px;line-height:1.2;margin-top:24px">Today's lift</div><div class="cap" style="font-size:40px;line-height:1.2;color:${DUSK}">Week 2 of 12</div><div style="font-family:IT;font-weight:600;font-size:32px;margin-top:22px">Inter Tight</div>`), 330, 190);

// ---------- the milestone stamp (brand art size) ----------
await shot('stamp.png', `<div style="width:220px;height:220px;display:flex;align-items:center;justify-content:center">
  <div style="width:170px;height:170px;border-radius:50%;background:#F2600C;box-shadow:0 0 0 6px ${PAPER};transform:rotate(-10deg);display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div class="cap" style="font-size:17px">Day</div><div class="fr" style="font-weight:700;font-size:76px;line-height:.9">12</div><div class="cap" style="font-size:17px">Streak</div></div></div>`, 220, 220);

// ---------- closing art: rings on the Orb, faded, kept out of the lockup's clear space ----------
{
  const s = svgFile('lockup-stacked-paper.svg'); const vb = s.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const w = 250, sc = w / vb[2], h = vb[3] * sc, C = 1400 * sc, W = 900, H = 680, lx = (W - w) / 2, ly = 230;
  const ocx = W / 2, ocy = ly + 1400 * sc; // the Orb's center (2 C diameter, top of the lockup)
  const clear = { x: lx - C, y: ly - C, w: w + 2 * C, h: h + 2 * C };
  await shot('closing-art.png', `<div style="position:relative;width:${W}px;height:${H}px">
    <svg width="${W}" height="${H}" style="position:absolute;left:0;top:0"><defs>
      <radialGradient id="f" cx="${ocx}" cy="${ocy}" r="${ocy - 6}" gradientUnits="userSpaceOnUse"><stop offset=".6" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <mask id="m"><rect width="${W}" height="${H}" fill="url(#f)"/><rect x="${clear.x}" y="${clear.y}" width="${clear.w}" height="${clear.h}" rx="12" fill="#000"/></mask></defs>
      <g mask="url(#m)" fill="none" stroke="#CBE8F8">${[225, 262, 299].map((r, i) => `<circle cx="${ocx}" cy="${ocy}" r="${r}" stroke-opacity="${.5 - i * .1}" stroke-width="1.5"/>`).join('')}</g></svg>
    <div style="position:absolute;left:${lx}px;top:${ly}px">${sized(s, w)}</div>
    <div class="fr" style="position:absolute;left:0;right:0;top:${ly + h + C * 0.9}px;text-align:center;font-style:italic;font-weight:420;font-size:34px;color:${HAZE}">One good day at a time.</div>
  </div>`, W, H);
}

// ---------- copies of finished art ----------
const cp = (src, dst) => { if (!only || only.includes(dst.replace('.png', ''))) { fs.copyFileSync(src, path.join(OUT, dst)); console.log('copied', dst); } };
for (const [a, b] of [['app-icon-1024.png', 'app-icon.png'], ['app-icon-dark-1024.png', 'app-icon-dark.png'], ['app-icon-tinted-1024.png', 'app-icon-tinted.png'], ['hero-poster.png', 'hero-poster.png'], ['hero-landscape.png', 'hero-landscape.png']]) cp(`${B}/assets/${a}`, b);
for (const m of ['today', 'today-habits', 'today-before', 'goals', 'learned', 'plan', 'progress', 'journal', 'settings', 'assistant', 'welcome', 'splash']) cp(`${B}/mockups/${m}.png`, `phone-${m}.png`);
// assistant top crop
if (!only || only.includes('phone-assistant-top')) {
  await page.setViewportSize({ width: 390, height: 844 });
  fs.copyFileSync(`${B}/mockups/assistant.png`, path.join(OUT, 'phone-assistant-top.png'));
}
// faint grid ground
await shot('bg-grid.png', `<div style="width:1280px;height:720px;background-color:${PAPER};background-image:linear-gradient(rgba(14,34,54,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(14,34,54,.04) 1px,transparent 1px);background-size:48px 48px;background-position:57.6px 24px"></div>`, 1280, 720, { transparent: false, scale: 1.5 });
await browser.close();
