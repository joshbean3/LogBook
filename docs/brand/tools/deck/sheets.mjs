// Brand sheets for docs/brand/assets and docs/brand/mockups, rendered at 2x.
import fs from 'fs';
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { orbSVG } from './orb.mjs';
import { icon, ICONS } from './icons.mjs';

const W = '/tmp/claude-0/-home-user-LogBook/203fe2a6-2bdf-53d9-a92e-1cbd9356aa24/scratchpad/brand/final';
const D = '/home/user/LogBook/docs/brand';
const only = process.argv[2] ? process.argv[2].split(',') : null;
const css = fs.readFileSync(`${W}/src/brand.css`, 'utf8');
const A = (f) => `file://${D}/assets/${f}`;
const M = (f) => `file://${D}/mockups/${f}`;
const page = (w, h, body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{background:var(--linen);position:relative}
body.grain::after{z-index:0}
.hdr{position:absolute;left:48px;right:48px;top:30px;display:flex;justify-content:space-between;align-items:center;z-index:2}
.rule{position:absolute;left:48px;right:48px;top:62px;height:1px;background:var(--ink);opacity:.85;z-index:2}
.foot{position:absolute;left:48px;right:48px;bottom:26px;display:flex;justify-content:space-between;color:var(--dusk);z-index:2}
.tile{position:absolute;background:var(--paper);border-radius:24px;box-shadow:0 1px 1px rgba(14,34,54,.04),0 10px 28px -14px rgba(14,34,54,.20);z-index:1}
.lbl{text-align:center;margin-top:14px}
${extra}</style></head><body class="grain">${body}</body></html>`;
const hdr = (title, right = 'Brand system / Nov 2026') => `<div class="hdr"><span class="cap">Orby &nbsp;/&nbsp; ${title}</span><span class="cap" style="display:flex;gap:10px;align-items:center"><i style="width:9px;height:9px;border-radius:50%;background:var(--sunrise);box-shadow:0 0 0 2px var(--paper)"></i>One good day at a time</span><span class="cap">${right}</span></div><div class="rule"></div>`;

const sheets = {};

// ---------------- palette ----------------
sheets['assets/palette.png'] = [1600, 1000, (() => {
  const P = [
    ['Sky', '#38B6F2', 'Signature fill. The Orb, selected day, active tab disc, primary button. Never text on light.', 'On it: Ink 7.03', 'As text: never (2.26)', '#0E2236'],
    ['Deep Sky', '#0A6CA6', 'Blue words and links, done dots, the gauge fill, the far hill.', 'On it: White 5.66', 'As text on Paper: 5.57', '#FFFFFF'],
    ['Haze', '#CBE8F8', 'Tracks, top of the dawn wash, chart tints, icon tiles.', 'On it: Ink 12.64', 'As text: never', '#0E2236'],
    ['Cloud', '#EAF5FC', 'The app ground. Segmented tracks.', 'On it: Ink 14.58', 'As text: never', '#0E2236'],
    ['Paper', '#FFFDF8', 'Cards, sheets, the ask bar, the tab capsule.', 'On it: Ink 15.88', 'As text on dark: 9.36', '#0E2236'],
    ['Linen', '#F6F0E5', 'Brand paper only: splash variant, store art, share cards, decks.', 'On it: Ink 14.23', 'As text: never', '#0E2236'],
    ['Night Ink', '#0E2236', 'All primary text. The wordmark.', 'On it: White 16.14', 'As text on Paper: 15.88', '#FFFFFF'],
    ['Dusk', '#46596D', 'Muted text, captions, metadata. The lightest neutral text color.', 'On it: White 7.22', 'As text on Paper: 7.10', '#FFFFFF'],
    ['Twilight', '#1B4870', 'Dark brand ground: night splash, dark icon, deck sections.', 'On it: White 9.51', 'As text on Paper: 9.36', '#FFFFFF'],
    ['Sunrise', '#F2600C', 'The accent. Now-marks, the badge dot, the stamp. At most 3 per screen.', 'On it: Ink 4.96, bold', 'As text: never (3.20)', '#0E2236'],
    ['Apricot', '#FFB680', 'Light, not ink: the Orb\'s warm underlight, the hero glow, the horizon.', 'On it: Ink 9.42', 'As text on dark: 5.55', '#0E2236'],
    ['Ember', '#B4430C', 'Orange words, rare: a streak label, a Today tag.', 'On it: White 5.60', 'As text on Paper: 5.51', '#FFFFFF']];
  const sw = P.map(([n, h, role, ratio, ratio2, fg], i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const light = ['#FFFDF8', '#F6F0E5', '#EAF5FC'].includes(h);
    return `<div style="position:absolute;left:${24 + col * 244}px;top:${70 + row * 300}px;width:228px;height:282px;border-radius:18px;background:${h};color:${fg};padding:18px;${light ? 'box-shadow:inset 0 0 0 1px rgba(14,34,54,.12)' : ''}">
      <div class="d" style="font-size:26px;line-height:30px;font-weight:650">${n}</div>
      <div class="cap" style="margin-top:6px;color:${fg}">${h}</div>
      <div style="position:absolute;left:18px;right:18px;bottom:66px;font-size:13px;line-height:18px;font-weight:500">${role}</div>
      <div class="cap" style="position:absolute;left:18px;bottom:36px;color:${fg}">${ratio}</div><div class="cap" style="position:absolute;left:18px;bottom:16px;color:${fg}">${ratio2}</div></div>`;
  }).join('');
  const bar = [['#EAF5FC', 40, 'Cloud'], ['#FFFDF8', 20, 'Paper'], ['#CBE8F8', 5, 'Haze'], ['#38B6F2', 14, 'Sky'], ['#0A6CA6', 6, 'Deep Sky'], ['#0E2236', 8, 'Ink'], ['#46596D', 4, 'Dusk'], ['#FFB680', 1.5, ''], ['#F2600C', 1.5, '']];
  const barHtml = bar.map(([c, p, n]) => `<div style="flex:${p};background:${c};height:46px;display:flex;align-items:flex-end;padding:0 0 6px 8px;${c === '#FFFDF8' || c === '#EAF5FC' ? 'box-shadow:inset 0 0 0 1px rgba(14,34,54,.1)' : ''}"><span class="cap" style="font-size:11px;color:${['#0E2236', '#46596D', '#0A6CA6'].includes(c) ? '#fff' : '#0E2236'}">${n}</span></div>`).join('');
  return page(1600, 1000, `${hdr('Color')}
  <div class="tile" style="left:48px;top:90px;width:1504px;height:680px">
    <div style="position:absolute;left:24px;right:24px;top:22px;display:flex;justify-content:space-between"><span class="cap">The palette, 12 colors</span><span class="cap" style="color:var(--dusk)">Two ratios per swatch: text on it, and it as text (WCAG 2.x)</span></div>
    ${sw}</div>
  <div class="tile" style="left:48px;top:790px;width:1504px;height:150px;padding:22px 24px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Proportion on any app screen</span><span class="cap" style="color:var(--dusk)">Grounds 65%+ &nbsp;/&nbsp; Sky family 15 to 25% &nbsp;/&nbsp; Ink and Dusk 10% &nbsp;/&nbsp; Warm 3%, Sunrise under 2%</span></div>
    <div style="display:flex;margin-top:18px;border-radius:12px;overflow:hidden">${barHtml}</div>
    <div class="cap" style="margin-top:12px;color:var(--dusk)">Sunrise touching Sky or Haze always gets a 2 px Paper keyline. White on Sky (2.30) and Sky as text (2.26) are banned.</div>
  </div>
  <div class="foot cap"><span>Every pairing and its ratio: brand-guide.md section 3</span><span>Tokens: tokens.json, tokens.css</span></div>`);
})()];

// ---------------- type specimen ----------------
sheets['assets/type-specimen.png'] = [1600, 1000, page(1600, 1000, `${hdr('Type')}
  <div class="tile" style="left:48px;top:90px;width:740px;height:850px;padding:30px 36px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Display: Fraunces</span><span class="cap" style="color:var(--dusk)">SIL OFL 1.1 &nbsp;/&nbsp; SOFT 100, WONK 0</span></div>
    <div class="d" style="font-size:190px;line-height:180px;font-weight:700;letter-spacing:-.03em;margin-top:18px">Aa</div>
    <div class="d" style="font-size:56px;line-height:56px;font-weight:700;letter-spacing:-.02em;margin-top:6px">One good day<br>at a time.</div>
    <div class="cap" style="color:var(--dusk);margin-top:8px">Hero, 3.5 rem / 3.5 rem, 700, -0.02 em</div>
    <div class="d" style="font-size:38px;line-height:42px;font-weight:650;letter-spacing:-.015em;margin-top:22px">Today</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Screen title, 2.375 rem / 2.625 rem, 650, -0.015 em</div>
    <div class="d" style="font-size:26px;line-height:32px;font-weight:600;margin-top:18px">Habits</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Section title, 1.625 rem / 2 rem, 600</div>
    <div class="it" style="font-size:22px;line-height:28px;margin-top:18px">What would make today count?</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Sentence, italic 420, 1.375 rem / 1.75 rem, a prompt or a greeting</div>
    <div style="margin-top:22px;font-size:16px;line-height:24px;color:var(--dusk)">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &amp; ? ! , . : ;</div>
  </div>
  <div class="tile" style="left:812px;top:90px;width:740px;height:520px;padding:30px 36px">
    <div style="display:flex;justify-content:space-between"><span class="cap">UI and numbers: Inter &nbsp;/&nbsp; Captions: Inter Tight</span><span class="cap" style="color:var(--dusk)">SIL OFL 1.1</span></div>
    <div style="font-size:17px;line-height:22px;font-weight:600;margin-top:22px">Easy 5 at 6:30, then a short lift</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Headline, Inter 600, 1.0625 rem / 1.375 rem</div>
    <div style="font-size:16px;line-height:24px;margin-top:16px;max-width:600px">Rest day. Your legs will thank you tomorrow. If something feels off, ask and the plan moves with you.</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Body, Inter 400, 1 rem / 1.5 rem</div>
    <div style="font-size:15px;line-height:20px;font-weight:500;color:var(--dusk);margin-top:16px">Zone 2, 45 min &nbsp;·&nbsp; Warm-up week</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Secondary, Inter 500, 0.9375 rem / 1.25 rem, Dusk</div>
    <div style="font-size:13px;line-height:18px;font-weight:500;color:var(--dusk);margin-top:16px">Updated 2 min ago from Apple Health</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Footnote, Inter 500, 0.8125 rem / 1.125 rem, floor 13 px</div>
    <div class="cap" style="margin-top:20px;font-size:11px">Today's run &nbsp;&nbsp; Week 2 of 12 &nbsp;&nbsp; 23 mi</div>
    <div class="cap" style="color:var(--dusk);margin-top:4px">Caption, Inter Tight 600, 0.6875 rem / 0.875 rem, +0.14 em, caps, floor 11 px</div>
  </div>
  <div class="tile" style="left:812px;top:630px;width:740px;height:310px;padding:30px 36px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Numerals</span><span class="cap" style="color:var(--dusk)">Live numbers are tabular</span></div>
    <div style="display:flex;gap:46px;align-items:flex-end;margin-top:20px">
      <div><div class="tnum" style="font-size:58px;line-height:58px;font-weight:650;letter-spacing:-.02em">4.2<span style="font:500 15px Inter;color:var(--dusk);letter-spacing:0"> of 23 mi</span></div><div class="cap" style="color:var(--dusk);margin-top:8px">Live hero stat, Inter 650, tnum</div></div>
      <div><div class="tnum" style="font-size:17px;line-height:22px;font-weight:600">8:42<span style="font-size:15px;font-weight:500;color:var(--dusk)"> /mi</span></div><div class="cap" style="color:var(--dusk);margin-top:8px">Live, Inter 600, tnum</div></div>
    </div>
    <div style="display:flex;gap:30px;margin-top:22px;align-items:center">
      <div class="tnum" style="font:600 22px Inter;font-variant-numeric:tabular-nums;background:var(--cloud);padding:6px 10px;border-radius:12px">1111</div>
      <div class="tnum" style="font:600 22px Inter;font-variant-numeric:tabular-nums;background:var(--cloud);padding:6px 10px;border-radius:12px">0000</div>
      <div style="font-size:15px;line-height:20px;color:var(--dusk);max-width:330px">The check: 1111 and 0000 render at the same width in Inter. Fraunces has no tabular figures: it sets static numbers only.</div>
    </div>
  </div>
  <div class="foot cap"><span>Fraunces, Inter and Inter Tight: SIL OFL 1.1, self-hosted from docs/brand/fonts</span><span>At most 4 serif and 5 sans sizes on one screen</span></div>`)];

// ---------------- icon sheet ----------------
sheets['assets/icon-sheet.png'] = [1600, 1000, (() => {
  const keys = Object.keys(ICONS);
  const grid = keys.map((k, i) => {
    const col = i % 8, row = Math.floor(i / 8);
    return `<div style="position:absolute;left:${28 + col * 112}px;top:${70 + row * 128}px;width:100px;text-align:center;color:var(--deep-sky)">
      <div style="width:64px;height:64px;margin:0 auto;border-radius:12px;background:var(--haze);display:flex;align-items:center;justify-content:center">${icon(k, 28)}</div>
      <div class="cap" style="margin-top:10px;color:var(--dusk)">${k}</div></div>`;
  }).join('');
  const tabs = [['today', 'Today', 1], ['goals', 'Goals', 0, 1], ['learned', 'Learned'], ['plan', 'Plan'], ['progress', 'Progress'], ['journal', 'Journal']]
    .map(([k, l, on, b]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:${on ? 650 : 550};color:${on ? '#0E2236' : '#46596D'};position:relative">
      <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;${on ? 'background:#38B6F2;color:#0E2236' : ''}">${icon(k, 22)}</div>${l}
      ${b ? '<span style="position:absolute;top:0;right:12px;width:8px;height:8px;border-radius:50%;background:#F2600C;box-shadow:0 0 0 2px #FFFDF8"></span>' : ''}</div>`).join('');
  const grid24 = `<svg width="240" height="240" viewBox="0 0 24 24" style="display:block;flex:none">
    ${Array.from({ length: 25 }, (_, i) => `<line x1="${i}" y1="0" x2="${i}" y2="24" stroke="#CBE8F8" stroke-width=".05"/><line x1="0" y1="${i}" x2="24" y2="${i}" stroke="#CBE8F8" stroke-width=".05"/>`).join('')}
    <rect x="2" y="2" width="20" height="20" fill="none" stroke="#46596D" stroke-width=".08" stroke-dasharray=".3 .3"/>
    <g fill="none" stroke="#0E2236" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS.today}</g></svg>`;
  return page(1600, 1000, `${hdr('Iconography')}
  <div class="tile" style="left:48px;top:90px;width:944px;height:850px">
    <div style="position:absolute;left:28px;right:28px;top:24px;display:flex;justify-content:space-between"><span class="cap">The set, 24 icons</span><span class="cap" style="color:var(--dusk)">Deep Sky glyph in a Haze tile &nbsp;/&nbsp; 1.75 px stroke, round caps</span></div>
    ${grid}</div>
  <div class="tile" style="left:1016px;top:90px;width:536px;height:430px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Construction</span><span class="cap" style="color:var(--dusk)">2 px live-area inset</span></div>
    <div style="display:flex;gap:26px;align-items:center;margin-top:22px">${grid24}
      <div style="font-size:14px;line-height:21px;color:var(--dusk)">Draw from circles and arcs first. Corners on rectangles are 4 px. One filled dot of 1.3 px radius is the only fill. Progress is a rising line ending in a 2 px circle, everywhere it appears. No emoji, no stars, no rockets.</div></div>
    <div class="cap" style="margin-top:22px;text-align:center">Today: a 4.2 px disc and eight rays</div>
  </div>
  <div class="tile" style="left:1016px;top:540px;width:536px;height:400px;padding:24px 28px;background:var(--cloud)">
    <div style="display:flex;justify-content:space-between"><span class="cap">In the tab capsule</span><span class="cap" style="color:var(--dusk)">Active: Ink icon on a 32 px Sky disc</span></div>
    <div style="margin-top:40px;height:58px;border-radius:999px;background:var(--paper);display:grid;grid-template-columns:repeat(6,1fr);align-items:center;box-shadow:0 1px 1px rgba(14,34,54,.05),0 12px 28px -12px rgba(14,34,54,.28)">${tabs}</div>
    <div style="font-size:14px;line-height:21px;color:var(--dusk);margin-top:34px">Inactive icons and labels are Dusk (7.10 on Paper). The active label is Night Ink 650. The badge dot is 8 px Sunrise with a 2 px Paper keyline, and it counts toward the screen's orange budget.</div>
  </div>
  <div class="foot cap"><span>Source: docs/brand/tools/icons.mjs</span><span>Lucide icons may stand in only if redrawn to these rules</span></div>`);
})()];

// ---------------- orb states ----------------
sheets['assets/orb-states.png'] = [1600, 1000, page(1600, 1000, `${hdr('The Orb')}
  <div class="tile" style="left:48px;top:90px;width:1504px;height:520px">
    <div style="position:absolute;left:28px;right:28px;top:24px;display:flex;justify-content:space-between"><span class="cap">A sky-blue sphere, lit by a sunrise from below</span><span class="cap" style="color:var(--dusk)">Blue first. The warm light is a glow, never a band</span></div>
    <div style="position:absolute;top:70px;left:0;right:0;display:grid;grid-template-columns:repeat(4,1fr);align-items:center;justify-items:center">
      <div><div style="height:340px;display:flex;align-items:center;justify-content:center">${orbSVG(220, { glow: true, id: 's1' })}</div><div class="cap lbl">Idle</div><div class="cap lbl" style="color:var(--dusk);margin-top:4px">Breath, 1 to 1.015, 4 s</div></div>
      <div><div style="height:340px;display:flex;align-items:center;justify-content:center">${orbSVG(200, { state: 'think', glow: true, id: 's2' })}</div><div class="cap lbl">Thinking</div><div class="cap lbl" style="color:var(--dusk);margin-top:4px">Warmer underlight, arc orbits 1.2 s</div></div>
      <div><div style="width:300px;height:300px;margin:20px 0;border-radius:28px;background:var(--twilight);display:flex;align-items:center;justify-content:center">${orbSVG(170, { glow: true, dark: true, id: 's3' })}</div><div class="cap lbl">On Twilight</div><div class="cap lbl" style="color:var(--dusk);margin-top:4px">Glow 22%, screen blend</div></div>
      <div><div style="width:300px;height:300px;margin:20px 0;border-radius:28px;background:var(--night-ink,#0E2236);display:flex;align-items:center;justify-content:center">${orbSVG(150, { state: 'think', glow: true, dark: true, id: 's4' })}</div><div class="cap lbl">Thinking on Night Ink</div><div class="cap lbl" style="color:var(--dusk);margin-top:4px">The status line carries it</div></div>
    </div></div>
  <div class="tile" style="left:48px;top:630px;width:1504px;height:310px">
    <div style="position:absolute;left:28px;right:28px;top:24px;display:flex;justify-content:space-between"><span class="cap">Size tiers</span><span class="cap" style="color:var(--dusk)">48 and up full &nbsp;/&nbsp; 28 to 47 gloss &nbsp;/&nbsp; under 28 flat</span></div>
    <div style="position:absolute;top:70px;left:40px;right:40px;display:flex;justify-content:space-between;align-items:flex-end">
      ${[[96, 'full'], [72, 'full'], [56, 'full'], [48, 'full'], [40, 'gloss'], [32, 'gloss'], [28, 'gloss'], [24, 'flat'], [20, 'flat'], [16, 'flat']].map(([s, t], i) => `<div style="text-align:center"><div style="height:160px;display:flex;align-items:center;justify-content:center">${t === 'flat' ? `<span style="display:block;width:${s}px;height:${s}px;border-radius:50%;background:var(--sky)"></span>` : orbSVG(s, { glow: t === 'full', id: 'z' + i })}</div><div class="cap" style="margin-top:12px">${s} px</div><div class="cap" style="color:var(--dusk);margin-top:4px">${t === 'full' ? 'Full, glow' : t === 'gloss' ? 'Gloss' : 'Flat'}</div></div>`).join('')}
    </div></div>
  <div class="foot cap"><span>Recipe and every gradient stop: brand-guide.md section 2.1, tools/orb.mjs</span><span>The Orb is the assistant's mark. It never appears twice on one screen</span></div>`)];

// ---------------- logo construction ----------------
const lockH = fs.readFileSync(`${D}/assets/lockup-horizontal-ink.svg`, 'utf8');
const lockV = fs.readFileSync(`${D}/assets/lockup-stacked-ink.svg`, 'utf8');
const wm = fs.readFileSync(`${D}/assets/wordmark-ink.svg`, 'utf8');
const sized = (svg, w) => svg.replace(/width="[^"]+" height="[^"]+"/, `width="${w}"`);
const GEO = JSON.parse(fs.readFileSync(`${W}/out/geom.json`, 'utf8'));
const LW = GEO.horiz[2] - GEO.horiz[0], LH = GEO.horiz[3] - GEO.horiz[1], BASE = -GEO.horiz[1], ORB_D = GEO.H.D, GAP = GEO.H.gap;
const OCX = ORB_D + GAP + 720.5, OCY = BASE - 699.5, OR = 720.5, S = 0.07;
sheets['assets/logo-construction.png'] = [1600, 1000, page(1600, 1000, `${hdr('Logo')}
  <div class="tile" style="left:48px;top:90px;width:980px;height:520px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Horizontal lockup, construction</span><span class="cap" style="color:var(--dusk)">C = cap height, 1400 u &nbsp;/&nbsp; clear space C on every side</span></div>
    <div style="position:relative;margin:${1400 * S + 22}px 0 0 ${(924 - LW * S) / 2}px;width:${LW * S}px;height:${LH * S}px">
      <div style="position:absolute;left:${-1400 * S}px;top:${-1400 * S}px;right:${-1400 * S}px;bottom:${-1400 * S}px;border:1.5px dashed #46596D;border-radius:4px"></div>
      ${sized(lockH, LW * S)}
      <div style="position:absolute;left:-30px;right:-30px;top:${(BASE - 1400) * S}px;height:1px;background:#0A6CA6"></div>
      <div style="position:absolute;left:-30px;right:-30px;top:${(BASE - 890) * S}px;height:1px;background:#46596D"></div>
      <div style="position:absolute;left:-30px;right:-30px;top:${BASE * S}px;height:1px;background:#0A6CA6"></div>
      <div style="position:absolute;left:-30px;right:-30px;top:0;height:1px;background:#0A6CA6;opacity:.5"></div>
      <div style="position:absolute;left:${ORB_D * S}px;width:${GAP * S}px;top:-30px;bottom:-30px;background:rgba(56,182,242,.16)"></div>
      <div class="cap" style="position:absolute;left:${ORB_D * S - 20}px;top:-50px;width:${GAP * S + 40}px;text-align:center;color:var(--deep-sky)">0.35 C</div>
      <div style="position:absolute;left:${(OCX - OR) * S}px;top:${(OCY - OR) * S}px;width:${2 * OR * S}px;height:${2 * OR * S}px;border-radius:50%;border:1.5px dashed #0A6CA6"></div>
      <div class="cap" style="position:absolute;left:${(OCX - 200) * S}px;width:${400 * S}px;top:${LH * S + 14}px;text-align:center;color:var(--deep-sky);white-space:nowrap;margin-left:-40px">True-circle O</div>
      <div class="cap" style="position:absolute;left:${LW * S + 1400 * S + 12}px;white-space:nowrap;top:${(BASE - 1400) * S - 7}px;color:var(--deep-sky)">Cap 1400</div>
      <div class="cap" style="position:absolute;left:${LW * S + 1400 * S + 12}px;white-space:nowrap;top:${(BASE - 890) * S - 7}px;color:var(--dusk)">x 890</div>
      <div class="cap" style="position:absolute;left:${LW * S + 1400 * S + 12}px;white-space:nowrap;top:${BASE * S - 7}px;color:var(--deep-sky)">Base 0</div>
      <div class="cap" style="position:absolute;left:${-1400 * S + 10}px;top:${-1400 * S + 10}px;color:var(--dusk)">Clear space C</div>
    </div>
    <div style="position:absolute;left:28px;right:28px;bottom:24px;font-size:14px;line-height:21px;color:var(--dusk)">Wordmark: Fraunces 700, SOFT 100, WONK 0, opsz 144, tracked -0.01 em, kerned O/r -12, r/b +30, b/y +7 per 1000, outlined. The O is a true circle 1441 u across with a lightly tilted elliptical counter (390 x 548 u, 10 degrees), so its thickest stroke is 1.05 x the b stem. The Orb is x-height (900 u) on the baseline, a small sun beside the name. Gap to the O: 0.35 C.</div>
  </div>
  <div class="tile" style="left:1052px;top:90px;width:500px;height:520px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Stacked lockup</span><span class="cap" style="color:var(--dusk)">Orb 2 C, gap 0.5 C</span></div>
    <div style="display:flex;justify-content:center;margin-top:44px">${sized(lockV, 230)}</div>
    <div style="font-size:14px;line-height:21px;color:var(--dusk);margin-top:36px">Splash, store art and anywhere taller than wide. The Orb is centered on the wordmark's ink width and sits 0.5 C above the b ascender.</div>
  </div>
  <div class="tile" style="left:48px;top:630px;width:980px;height:310px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Minimum sizes</span><span class="cap" style="color:var(--dusk)">On screen, in points (width)</span></div>
    <div style="display:flex;gap:56px;align-items:flex-end;margin-top:40px">
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${sized(lockH, 96)}</div><div class="cap" style="margin-top:12px">Horizontal 96 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${sized(lockV, 56)}</div><div class="cap" style="margin-top:12px">Stacked 56 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${sized(wm, 64)}</div><div class="cap" style="margin-top:12px">Wordmark 64 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${orbSVG(28, { id: 'mn' })}</div><div class="cap" style="margin-top:12px">Gloss Orb 28 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center"><span style="width:16px;height:16px;border-radius:50%;background:var(--sky)"></span></div><div class="cap" style="margin-top:12px">Flat Orb 16 pt</div></div>
    </div>
    <div style="font-size:15px;line-height:21px;color:var(--dusk);margin-top:26px">Print: horizontal 25 mm wide, stacked 15 mm, wordmark 17 mm. Below these, use the flat Orb alone.</div>
  </div>
  <div class="tile" style="left:1052px;top:630px;width:500px;height:310px;padding:24px 28px;background:var(--twilight);color:#fff">
    <div style="display:flex;justify-content:space-between"><span class="cap" style="color:#fff">On dark grounds</span><span class="cap" style="color:var(--haze)">Paper wordmark, same Orb</span></div>
    <div style="display:flex;justify-content:center;margin-top:62px">${sized(fs.readFileSync(`${D}/assets/lockup-horizontal-paper.svg`, 'utf8'), 300)}</div>
    <div class="cap" style="text-align:center;margin-top:56px;color:var(--haze)">Paper on Twilight 9.36 &nbsp;/&nbsp; on Night Ink 15.88</div>
  </div>
  <div class="foot cap"><span>Files: assets/logo-mark.svg, wordmark-*.svg, lockup-*.svg</span><span>Never retype the wordmark: use the outlined files</span></div>`)];

// ---------------- logo don'ts ----------------
const dont = (inner, cap) => `<div style="text-align:center"><div style="height:170px;border-radius:18px;background:var(--cloud);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">${inner}
  <svg width="30" height="30" viewBox="0 0 24 24" style="position:absolute;right:12px;top:12px"><circle cx="12" cy="12" r="11" fill="#B42340"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></div><div class="cap" style="margin-top:12px">${cap}</div></div>`;
sheets['assets/logo-donts.png'] = [1600, 1000, page(1600, 1000, `${hdr('Logo misuse')}
  <div class="tile" style="left:48px;top:90px;width:1504px;height:850px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Never do these</span><span class="cap" style="color:var(--dusk)">Use the supplied files. Each tile breaks one rule</span></div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:30px 22px;margin-top:40px">
      ${dont(`<div style="transform:scaleX(1.35)">${sized(lockH, 190)}</div>`, 'Stretch or squash')}
      ${dont(`<div style="display:flex;align-items:center;gap:12px">${orbSVG(40, { id: 'd1' })}<span style="font:700 40px Inter;letter-spacing:-.02em;color:#0E2236">Orby</span></div>`, 'Retype it in another face')}
      ${dont(`<div style="display:flex;align-items:center;gap:2px">${orbSVG(62, { id: 'd0' })}<svg viewBox="1440 -1497 2945 1988" width="${2945 * 0.03}"><path fill="#0E2236" d="${(fs.readFileSync(`${D}/assets/wordmark-ink.svg`, 'utf8').match(/ d="([^"]+)"/) || [])[1]}"/></svg></div>`, 'Swap the O for the Orb')}
      ${dont(`<span class="d" style="font-size:44px;font-weight:700;letter-spacing:.06em;color:#0E2236">ORBY</span>`, 'Set the name in caps')}
      ${dont(`<div style="filter:hue-rotate(160deg)">${sized(lockH, 210)}</div>`, 'Recolor the Orb')}
      ${dont(`<svg width="80" height="80" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#F2600C"/><circle cx="50" cy="50" r="48" fill="#38B6F2" clip-path="inset(0 0 50% 0)"/></svg>`, 'A two-tone ball')}
      ${dont(`<div style="display:flex;align-items:center;gap:6px">${orbSVG(46, { id: 'd2' })}${orbSVG(46, { id: 'd3' })}</div>`, 'Two Orbs on one screen')}
      ${dont(`<div style="background:linear-gradient(135deg,#F2600C,#38B6F2);padding:22px 16px;border-radius:12px">${sized(lockH, 190)}</div>`, 'Busy or clashing grounds')}
      ${dont(`<div style="position:relative">${orbSVG(80, { id: 'd4' })}<svg width="80" height="80" viewBox="0 0 100 100" style="position:absolute;left:3px;top:3px"><circle cx="38" cy="44" r="5" fill="#0E2236"/><circle cx="62" cy="44" r="5" fill="#0E2236"/><path d="M36 62q14 12 28 0" stroke="#0E2236" stroke-width="4" fill="none" stroke-linecap="round"/></svg></div>`, 'Give it a face')}
      ${dont(`<div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:50%;background:#38B6F2;box-shadow:0 8px 14px rgba(0,0,0,.45)"></span><span style="filter:drop-shadow(3px 4px 2px rgba(0,0,0,.4))">${sized(wm, 120)}</span></div>`, 'Drop shadows or bevels')}
      ${dont(`${sized(lockH, 210).replace(/fill="#0E2236"/, 'fill="#46596D"')}`, 'Grey or tinted wordmark')}
      ${dont(`<div style="display:flex;align-items:center;gap:40px">${orbSVG(40, { id: 'd5' })}${sized(wm, 110)}</div>`, 'Change the spacing')}
      ${dont(`<div style="transform:rotate(-14deg)">${sized(lockH, 200)}</div>`, 'Rotate or tilt')}
      ${dont(`<div style="text-align:left;font-size:17px;line-height:24px;color:#0E2236;padding:0 18px">Open <b>the Orby app</b> and log your run.</div>`, 'Say "the Orby" or "Orby app"')}
      ${dont(`<div style="outline:2px solid #0E2236;outline-offset:10px;border-radius:2px">${sized(lockH, 190)}</div>`, 'Box it or add rules')}
    </div></div>
  <div class="foot cap"><span>Use the files as supplied</span><span>Questions: brand-guide.md section 2.7</span></div>`)];

// ---------------- hero poster (store / social portrait) ----------------
const rings = (cx, cy, list, col = '#fff', base = .7) => list.map((d, i) => `<i style="position:absolute;left:${cx}px;top:${cy}px;width:${d}px;height:${d}px;border-radius:50%;border:1.5px solid ${col};opacity:${base - i * .1};transform:translate(-50%,-50%)"></i>`).join('');
const hills = (w, h) => `<svg style="position:absolute;left:0;bottom:0" width="${w}" height="${h}" viewBox="0 0 500 200" preserveAspectRatio="none">
  <path d="M0 62 C 90 40, 170 44, 250 58 S 410 76, 500 52 L500 200 L0 200Z" fill="#8FCDEE"/>
  <path d="M0 98 C 120 70, 220 84, 300 96 S 440 112, 500 90 L500 200 L0 200Z" fill="#4FA9DB"/>
  <path d="M0 136 C 100 118, 200 120, 290 136 S 430 150, 500 128 L500 200 L0 200Z" fill="#0A6CA6"/></svg>`;
const stamp = (size, x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:50%;background:#F2600C;box-shadow:0 0 0 ${Math.max(2, size * .033)}px #FFFDF8;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#0E2236;transform:rotate(-10deg);z-index:3">
  <span class="cap" style="font-size:${size * .1}px;line-height:1.2;color:#0E2236">Day</span><b class="d tnum" style="font-size:${size * .38}px;line-height:${size * .34}px;font-weight:700">12</b><span class="cap" style="font-size:${size * .1}px;line-height:1.2;color:#0E2236">Streak</span></div>`;
// Staging (guide 8.3): the Orb's bottom clears the horizon (the first hill's crest under it) by 0.1 D; the horizon glow
// carries the warmth; nothing covers the lower hemisphere. Rings center on the Orb and never cross text.
const wmInk = fs.readFileSync(`${D}/assets/wordmark-ink.svg`, 'utf8');
const crest = (w, h, x) => { // y of the first hill (path in a 500 x 200 box) at page-x x, for hills(w, h) placed at the bottom
  const u = x / w * 500; const pts = [[0, 62], [90, 40], [170, 44], [250, 58], [330, 70], [410, 76], [500, 52]];
  for (let i = 0; i < pts.length - 1; i++) if (u <= pts[i + 1][0]) { const t = (u - pts[i][0]) / (pts[i + 1][0] - pts[i][0]); return pts[i][1] + t * (pts[i + 1][1] - pts[i][1]); }
  return 52; };
const stage = (W, Hh, hillH, cx, Dm) => { const hy = Hh - hillH + crest(W, hillH, cx) / 200 * hillH; return { hy, cy: hy - 0.1 * Dm - Dm / 2 }; };
{
  const P = stage(645, 1398, 470, 322, 250);
  sheets['assets/hero-poster.png'] = [645, 1398, `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body{width:645px;height:1398px;overflow:hidden}
.p{position:absolute;inset:0;background:linear-gradient(180deg,#8DD0F5 0%,#AEDDF8 30%,#CFEBFA 50%,#F4E6D2 64%,#FFD2AE 72%)}
</style></head><body><div class="p grain">
  <div style="position:absolute;left:322px;top:${P.hy}px;width:900px;height:460px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,182,128,.85),rgba(255,182,128,.35) 45%,rgba(255,182,128,0))"></div>
  ${rings(322, P.cy, [330, 430, 530, 620, 700])}
  <div style="position:absolute;left:44px;top:72px">${sized(wmInk, 120)}</div>
  <div class="d" style="position:absolute;left:44px;right:40px;top:150px;font-size:92px;line-height:88px;font-weight:700;letter-spacing:-.025em">One good day at a time.</div>
  <div style="position:absolute;left:46px;top:430px;font-size:22px;line-height:30px;font-weight:450;max-width:520px">Your plan, your habits, your notes.<br>Up with the sun.</div>
  <div style="position:absolute;left:322px;top:${P.cy}px;transform:translate(-50%,-50%)">${orbSVG(250, { id: 'hp' })}</div>
  ${hills(645, 470)}
  ${stamp(118, 488, 690)}
  <div style="position:absolute;left:44px;right:44px;bottom:44px;display:flex;justify-content:space-between;color:#fff" class="cap"><span style="color:#fff">Orby for iPhone</span><span style="color:#fff">Running, strength, habits, journal</span></div>
</div></body></html>`];
}

// ---------------- hero landscape (web / social) ----------------
{
  const P = stage(1600, 900, 300, 860, 210);
  sheets['assets/hero-landscape.png'] = [1600, 900, `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body{width:1600px;height:900px;overflow:hidden}
.p{position:absolute;inset:0;background:linear-gradient(180deg,#8DD0F5 0%,#AEDDF8 34%,#CFEBFA 54%,#F4E6D2 68%,#FFD2AE 76%)}
.phone{position:absolute;width:390px;height:844px;border-radius:54px;overflow:hidden;box-shadow:0 0 0 10px #FFFDF8,0 0 0 11px rgba(14,34,54,.14),0 40px 80px -30px rgba(14,34,54,.45)}
</style></head><body><div class="p grain">
  <div style="position:absolute;left:860px;top:${P.hy}px;width:1200px;height:520px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,182,128,.8),rgba(255,182,128,0))"></div>
  ${rings(860, P.cy, [290, 370, 450])}
  <div style="position:absolute;left:860px;top:${P.cy}px;transform:translate(-50%,-50%)">${orbSVG(210, { id: 'hl' })}</div>
  ${hills(1600, 300)}
  <div style="position:absolute;left:90px;top:96px">${sized(wmInk, 150)}</div>
  <div class="d" style="position:absolute;left:88px;top:176px;width:700px;font-size:84px;line-height:82px;font-weight:700;letter-spacing:-.025em">One good day<br>at a time.</div>
  <div style="position:absolute;left:92px;top:362px;font-size:22px;line-height:32px;font-weight:450;width:480px">Your training plan, your habits and what you learned, on one calm screen. Ask or change anything.</div>
  <div class="phone" style="left:1100px;top:56px;transform:rotate(4deg) scale(.96);transform-origin:top left"><img src="${M('today.png')}" width="390" height="844"></div>
  ${stamp(104, 940, 96)}
  <div style="position:absolute;left:90px;bottom:36px;color:#fff" class="cap"><span style="color:#fff">Orby for iPhone</span></div>
</div></body></html>`];
}

// ---------------- splash (static mockup of the first open of the day) ----------------
// The poster's hills are the horizon; the Orb has risen and its bottom clears the crest by 0.1 D; the caption follows the
// time of day (GOOD MORNING before noon, GOOD AFTERNOON to 5 pm, GOOD EVENING after).
const splash = (caption) => { const P = stage(390, 844, 250, 195, 96); return [390, 844, `<!doctype html><html><head><meta charset="utf-8"><style>${css}
html,body{width:390px;height:844px;overflow:hidden;background:#EAF5FC}
</style></head><body>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,#CBE8F8 0,#EAF5FC 300px,#EAF5FC 52%,#FFE3CB 74%)"></div>
  <div style="position:absolute;left:195px;top:${P.hy}px;width:640px;height:300px;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,182,128,.6),rgba(255,182,128,0))"></div>
  <div style="position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center">${sized(wmInk, 150)}</div>
  <div class="it" style="position:absolute;left:0;right:0;top:336px;text-align:center;font-size:17px;line-height:22px;color:#46596D">One good day at a time.</div>
  <div style="position:absolute;left:195px;top:${P.cy}px;transform:translate(-50%,-50%)">${orbSVG(96, { glow: true, id: 'sp' + caption.length })}</div>
  ${hills(390, 250)}
  <div class="cap" style="position:absolute;left:0;right:0;bottom:44px;text-align:center;color:#FFFFFF">${caption}</div>
</body></html>`]; };
sheets['mockups/splash.png'] = splash('Good morning');
sheets['mockups/splash-evening.png'] = splash('Good evening');

// ---------------- before / after ----------------
sheets['mockups/today-before-after.png'] = [900, 1000, page(900, 1000, `${hdr('Today, before and after', '390 x 844')}
  <div style="position:absolute;left:48px;top:96px;width:390px;height:844px;border-radius:36px;overflow:hidden;box-shadow:0 0 0 1px rgba(14,34,54,.12),0 20px 40px -24px rgba(14,34,54,.4)"><img src="${M('today-before.png')}" width="390" height="844"></div>
  <div style="position:absolute;left:462px;top:96px;width:390px;height:844px;border-radius:36px;overflow:hidden;box-shadow:0 0 0 1px rgba(14,34,54,.12),0 20px 40px -24px rgba(14,34,54,.4)"><img src="${M('today.png')}" width="390" height="844"></div>
  <div class="cap" style="position:absolute;left:48px;width:390px;top:956px;text-align:center">Before: Columbia, navy pills, orange lead</div>
  <div class="cap" style="position:absolute;left:462px;width:390px;top:956px;text-align:center">After: Sunrise. Sky leads, orange marks now</div>`, 'body.grain::after{opacity:.25}')];

// ---------------- app icon on the Home Screen ----------------
const ic = (f, size) => `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.2237}px;overflow:hidden;box-shadow:0 0 0 0.5px rgba(14,34,54,.12)"><img src="${A(f)}" width="${size}" height="${size}" style="display:block"></div>`;
const homeRow = (f, bg, labelColor, title, sub) => `<div style="position:relative;border-radius:24px;overflow:hidden;height:600px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="display:grid;grid-template-columns:repeat(4,76px);gap:28px 26px;opacity:.95">
    ${[0, 1, 2].map(() => `<div style="text-align:center"><div style="width:76px;height:76px;border-radius:17px;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)"></div><div style="height:16px"></div></div>`).join('')}
    <div style="text-align:center">${ic(f, 76)}<div style="font:500 12px/16px Inter;color:${labelColor};margin-top:6px">Orby</div></div>
  </div>
  <div style="margin-top:56px">${ic(f, 180)}</div>
  <div class="cap" style="margin-top:22px;color:${labelColor}">${title}</div>
  <div class="cap" style="margin-top:6px;color:${labelColor};opacity:.8">${sub}</div>
</div>`;
sheets['assets/app-icon-homescreen.png'] = [1600, 1000, page(1600, 1000, `${hdr('App icon')}
  <div class="tile" style="left:48px;top:90px;width:1504px;height:850px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">On the Home Screen, display name Orby</span><span class="cap" style="color:var(--dusk)">Supply 1024 px, square, opaque. iOS applies the mask</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:26px">
      ${homeRow('app-icon-1024.png', 'linear-gradient(180deg,#7DB8DE,#C9DDEA 60%,#E9D6C4)', '#0E2236', 'Light', 'Pale morning sky, the Orb clear of the hill')}
      ${homeRow('app-icon-dark-1024.png', 'linear-gradient(180deg,#0B1726,#16304A)', '#FFFFFF', 'Dark', 'Night Ink to Twilight, an Apricot horizon glow')}
      ${homeRow('app-icon-tinted-1024.png', 'linear-gradient(180deg,#2A3440,#11161C)', '#FFFFFF', 'Tinted', 'Greyscale source, iOS tints it')}
    </div>
    <div style="font-size:14px;line-height:21px;color:var(--dusk);margin-top:22px">The label under the icon is CFBundleDisplayName "Orby". The bundle id stays com.joshbean.logbook. The Orb is 500 px (49% of the canvas), centered at (512, 420); its bottom clears the hill's crest by 54 px (0.1 D), so the sunrise rim always shows. Two rings, 8 px white. Check at 58 px: the Orb, its warm rim and the rings still read.</div>
  </div>
  <div class="foot cap"><span>Files: assets/app-icon-1024.png, app-icon-dark-1024.png, app-icon-tinted-1024.png and their -source.svg</span><span>No text, no transparency, no corners</span></div>`)];

const b = await chromium.launch();
for (const [out, [w, h, html]] of Object.entries(sheets)) {
  if (only && !only.some((o) => out.includes(o))) continue;
  const f = `${W}/src/sheet-${out.replace(/[\/.]/g, '_')}.html`;
  fs.writeFileSync(f, html);
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto('file://' + f, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.screenshot({ path: `${D}/${out}` });
  await p.close();
  console.log('wrote', out);
}
await b.close();
