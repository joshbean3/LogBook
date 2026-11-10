// Builds the vector assets for docs/brand/assets: mark, wordmark, lockups, app icon source.
import fs from 'fs';
import { orbDefsAndBody, orbSVG } from './orb.mjs';
import { orby } from './orby.mjs';

const OUT = '/home/user/LogBook/docs/brand/assets';
const INK = '#0E2236', PAPER = '#FFFDF8', SKY = '#38B6F2';
const w = orby();
const C = 1400; // cap height in font units: the lockup module
const r = (n) => Math.round(n * 10) / 10;
const write = (name, svg) => fs.writeFileSync(`${OUT}/${name}`, svg.trim() + '\n');

// ---------- mark ----------
write('logo-mark.svg', orbSVG(96, { id: 'm' }).replace('<svg ', '<svg role="img" aria-label="Orby" ').replace(/width="[^"]+" height="[^"]+"/, 'width="1024" height="1024"'));
write('logo-mark-glow.svg', orbSVG(96, { id: 'mg', glow: true }).replace(/width="[^"]+" height="[^"]+"/, 'width="1024" height="1024"'));
write('logo-mark-thinking.svg', orbSVG(96, { id: 'mt', state: 'think', glow: true }).replace(/width="[^"]+" height="[^"]+"/, 'width="1024" height="1024"'));
write('logo-mark-flat.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${SKY}"/></svg>`);
write('logo-mark-mono-ink.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="${INK}"/></svg>`);

// ---------- wordmark ----------
const { x1, x2, y1, y2 } = w.bbox;
const wmW = x2 - x1, wmH = y2 - y1;
for (const [name, fill] of [['ink', INK], ['paper', PAPER]]) {
  write(`wordmark-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orby" viewBox="${x1} ${y1} ${wmW} ${wmH}" width="${r(wmW / 10)}" height="${r(wmH / 10)}"><path fill="${fill}" d="${w.d}"/></svg>`);
}

// ---------- lockups ----------
// Orb as a group scaled from its 100-unit box. diameter D, sphere centre (cx, cy).
const orbAt = (id, D, cx, cy, flat, fill) => {
  const s = D / 96;
  const body = flat ? `<circle cx="50" cy="50" r="48" fill="${fill || SKY}"/>` : orbDefsAndBody({ id });
  return `<g transform="translate(${r(cx - 50 * s)} ${r(cy - 50 * s)}) scale(${(s).toFixed(4)})">${body}</g>`;
};
export const H = { D: 900, gap: 490 };           // horizontal (v1.1): the Orb is x-height (890 + 10 overshoot) on the baseline, a small sun beside the name; gap 0.35 C (490)
export const V = { D: 2 * C, gap: 0.5 * C };          // stacked: orb 2 C, gap 0.5 C above the b ascender
function horizontal(id, ink, flat, orbFill) {
  const D = H.D, cy = 10 - D / 2; // sphere spans -890 .. +10
  const wx = D + H.gap - x1;          // shift so the wordmark's left edge sits gap after the sphere
  const minX = 0, maxX = wx + x2, minY = Math.min(cy - D / 2, y1), maxY = y2;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orby" viewBox="${minX} ${r(minY)} ${r(maxX - minX)} ${r(maxY - minY)}" width="${r((maxX - minX) / 10)}" height="${r((maxY - minY) / 10)}">${orbAt(id, D, D / 2, cy, flat, orbFill)}<path fill="${ink}" transform="translate(${r(wx)} 0)" d="${w.d}"/></svg>`, box: [minX, minY, maxX, maxY] };
}
function stacked(id, ink, flat, orbFill) {
  const D = V.D, cx = x1 + wmW / 2, cy = -1497 - V.gap - D / 2; // above the b ascender
  const minX = x1, maxX = x2, minY = cy - D / 2, maxY = y2;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Orby" viewBox="${r(minX)} ${r(minY)} ${r(maxX - minX)} ${r(maxY - minY)}" width="${r((maxX - minX) / 10)}" height="${r((maxY - minY) / 10)}">${orbAt(id, D, cx, cy, flat, orbFill)}<path fill="${ink}" d="${w.d}"/></svg>`, box: [minX, minY, maxX, maxY] };
}
write('lockup-horizontal-ink.svg', horizontal('h1', INK).svg);
write('lockup-horizontal-paper.svg', horizontal('h2', PAPER).svg);
write('lockup-stacked-ink.svg', stacked('v1', INK).svg);
write('lockup-stacked-paper.svg', stacked('v2', PAPER).svg);
write('lockup-horizontal-flat-ink.svg', horizontal('h3', INK, true).svg);
write('lockup-horizontal-mono-ink.svg', horizontal('h4', INK, true, INK).svg);
write('lockup-horizontal-mono-paper.svg', horizontal('h5', PAPER, true, PAPER).svg);

// ---------- app icon (1024, square, opaque, no rounded corners: iOS applies the mask) ----------
function appIcon(variant = 'light') {
  const dark = variant === 'dark', tint = variant === 'tinted';
  const sky = tint ? [['0', '#000000'], ['1', '#000000']]
    : dark ? [['0', '#0E2236'], ['.45', '#163A5C'], ['.7', '#2A4E70'], ['1', '#2A4E70']]
      : [['0', '#CFEBFA'], ['.42', '#E2F3FC'], ['.6', '#F6E7D3'], ['.72', '#FFC79C']];
  // staging (guide 8.3): the Orb's bottom clears the horizon (the near hill's crest, y 724 at the center) by 0.1 D
  const orbD = 500, cx = 512, cy = 420;
  const glow = tint ? '' : `<ellipse cx="512" cy="700" rx="600" ry="300" fill="url(#hg)"${dark ? ' style="mix-blend-mode:screen"' : ''}/>`;
  const rings = tint ? '' : [310, 370].map((rr, i) => `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${dark ? '#CBE8F8' : '#FFFFFF'}" stroke-opacity="${dark ? (.22 - i * .06) : (.85 - i * .2)}" stroke-width="8"/>`).join('');
  const orb = tint
    ? `<defs><radialGradient id="tb" cx="50%" cy="34%" r="66%" fx="50%" fy="24%"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#C9C9C9"/><stop offset="1" stop-color="#8A8A8A"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${orbD / 2}" fill="url(#tb)"/>`
    : orbAt('ai' + variant, orbD, cx, cy);
  const hills = tint
    ? `<path d="M0 760 C 260 712, 560 712, 1024 772 L1024 1024 L0 1024Z" fill="#5A5A5A"/><path d="M0 862 C 300 806, 720 812, 1024 868 L1024 1024 L0 1024Z" fill="#3A3A3A"/>`
    : dark
      ? `<path d="M0 760 C 260 712, 560 712, 1024 772 L1024 1024 L0 1024Z" fill="#1B4870"/><path d="M0 862 C 300 806, 720 812, 1024 868 L1024 1024 L0 1024Z" fill="#0E2236"/>`
      : `<path d="M0 760 C 260 712, 560 712, 1024 772 L1024 1024 L0 1024Z" fill="#4FA9DB"/><path d="M0 862 C 300 806, 720 812, 1024 868 L1024 1024 L0 1024Z" fill="#0A6CA6"/>`;
  const grain = tint ? '' : `<filter id="gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .18 0 0 0 .55 0"/></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">${sky.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>
    <radialGradient id="hg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFB680" stop-opacity="${dark ? .32 : .85}"/><stop offset=".5" stop-color="#FFB680" stop-opacity="${dark ? .12 : .35}"/><stop offset="1" stop-color="#FFB680" stop-opacity="0"/></radialGradient>
    ${grain}
  </defs>
  <rect width="1024" height="1024" fill="url(#sk)"/>
  ${glow}${rings}${orb}${hills}
  ${tint ? '' : `<rect width="1024" height="1024" filter="url(#gr)" opacity="${dark ? .18 : .22}" style="mix-blend-mode:multiply"/>`}
</svg>`;
}
write('app-icon-source.svg', appIcon('light'));
write('app-icon-dark-source.svg', appIcon('dark'));
write('app-icon-tinted-source.svg', appIcon('tinted'));

fs.writeFileSync('/tmp/claude-0/-home-user-LogBook/203fe2a6-2bdf-53d9-a92e-1cbd9356aa24/scratchpad/brand/final/out/geom.json', JSON.stringify({ wm: w.bbox, H, V, C, horiz: horizontal('x', INK).box, stack: stacked('y', INK).box }, null, 1));
console.log('svgs written');
