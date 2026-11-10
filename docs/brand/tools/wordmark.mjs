// Needs opentype.js (npm i opentype.js). Run from this folder: node -e "import('./wordmark.mjs').then(m=>console.log(m.orby().d.length))"
// Outlines the "Orby" wordmark from a static Fraunces instance (wght 700, SOFT 100, WONK 0, opsz 144), UPM 2000.
// Construction: the O's outer contour is redrawn as a true circle (diameter 1441 = the O's own height, cap 1400 plus 21 overshoot
// top and bottom) so the letter's silhouette is the Orb's silhouette; the counter is Fraunces' own, so the O keeps its stress.
import opentype from 'opentype.js';
const FONT = new URL('../fonts/Fraunces-Wordmark-700-S100-o144.ttf', import.meta.url).pathname;
export const font = opentype.loadSync(FONT);
export const UPM = 2000;
export const CAP = 1400, XH = 890, ASC = 1497, DESC = 491;
export const O_D = 1441;          // circle diameter
export const O_SB = [16, 44];      // O side bearings after the redraw
export const TRACK = -20;          // -0.01 em
export const KERN = { Or: -24, rb: 60, by: 14 };
// The counter is Fraunces' own, widened about its center so the O's thickest stroke is about 1.05 x the b stem.
// v1.1: the counter is a lightly tilted ellipse (semi-axes 390 x 548, major axis 10 degrees off vertical), centered in the
// circle, so the O's thickest stroke is 330 units (1.05 x the b stem, 314) and its thinnest 172. It keeps Fraunces' stress angle.
export const COUNTER = { rx: 390, ry: 548, rot: -10 };
function ellipse(cx, cy, rx, ry, rotDeg, ccw) {
  const t = rotDeg * Math.PI / 180, N = 8, f = (n) => Math.round(n * 10) / 10; const k = (4 / 3) * Math.tan(Math.PI / (2 * N));
  const pt = (a) => { const x = rx * Math.cos(a), y = ry * Math.sin(a); return [cx + x * Math.cos(t) - y * Math.sin(t), cy + x * Math.sin(t) + y * Math.cos(t)]; };
  const dv = (a) => { const x = -rx * Math.sin(a), y = ry * Math.cos(a); return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]; };
  const dir = ccw ? -1 : 1; let d = ''; const a0 = 0; const p0 = pt(a0); d += `M${f(p0[0])} ${f(p0[1])}`;
  for (let i = 0; i < N; i++) { const a = a0 + dir * i * 2 * Math.PI / N, b = a + dir * 2 * Math.PI / N; const P = pt(a), Q = pt(b), dP = dv(a), dQ = dv(b); const kk = k * dir;
    d += `C${f(P[0] + kk * dP[0])} ${f(P[1] + kk * dP[1])} ${f(Q[0] - kk * dQ[0])} ${f(Q[1] - kk * dQ[1])} ${f(Q[0])} ${f(Q[1])}`; }
  return d + 'Z';
}
const area = (cmds) => { let a = 0, px, py, sx, sy; for (const c of cmds) { if (c.type === 'M') { sx = px = c.x; sy = py = c.y; continue; } if (c.type === 'Z') { a += px * sy - sx * py; continue; } a += px * c.y - c.x * py; px = c.x; py = c.y; } return a; };
function circle(cx, cy, r, ccw) { const k = 0.5522847498 * r; const f = (n) => Math.round(n * 10) / 10;
  // four cubic quarters, start at top
  const pts = ccw
    ? [[cx, cy - r], [cx - k, cy - r, cx - r, cy - k, cx - r, cy], [cx - r, cy + k, cx - k, cy + r, cx, cy + r], [cx + k, cy + r, cx + r, cy + k, cx + r, cy], [cx + r, cy - k, cx + k, cy - r, cx, cy - r]]
    : [[cx, cy - r], [cx + k, cy - r, cx + r, cy - k, cx + r, cy], [cx + r, cy + k, cx + k, cy + r, cx, cy + r], [cx - k, cy + r, cx - r, cy + k, cx - r, cy], [cx - r, cy - k, cx - k, cy - r, cx, cy - r]];
  return `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.slice(1).map((p) => `C${p.map(f).join(' ')}`).join('') + 'Z';
}
function contours(path) { const cs = []; let cur = []; for (const c of path.commands) { if (c.type === 'M') { if (cur.length) cs.push(cur); cur = [c]; } else cur.push(c); } if (cur.length) cs.push(cur); return cs; }
const toD = (cmds) => { const p = new opentype.Path(); p.commands = cmds; return p.toPathData(1); };
export function orby(opts = {}) {
  const kern = { ...KERN, ...(opts.kern || {}) }, track = opts.track ?? TRACK, trueO = opts.trueO ?? true;
  const text = 'Orby'; let x = 0; const parts = []; const pos = {};
  for (let i = 0; i < 4; i++) {
    const ch = text[i], g = font.charToGlyph(ch);
    if (ch === 'O' && trueO) {
      const orig = g.getPath(0, 0, UPM); const [outer, counter] = contours(orig);
      const ocx = (45 + 1426) / 2, dx = O_SB[0] + O_D / 2 - ocx; // move so the circle's left edge sits at x + O_SB[0]
      const cs = { ...COUNTER, ...(opts.counter || {}) };
      const cy = (-1420 + 21) / 2;
      const ccw = area(outer) < 0;
      parts.push(circle(x + O_SB[0] + O_D / 2, cy, O_D / 2, ccw) + (cs.rx ? ellipse(x + O_SB[0] + O_D / 2, cy, cs.rx, cs.ry, cs.rot, !ccw) : toD(counter.map((c) => { const n = { ...c }; for (const k of ['x', 'x1', 'x2']) if (n[k] != null) n[k] += x + dx; return n; }))));
      pos.O = { x: x + O_SB[0], cx: x + O_SB[0] + O_D / 2, cy, d: O_D };
      x += O_SB[0] + O_D + O_SB[1];
    } else {
      parts.push(g.getPath(x, 0, UPM).toPathData(1));
      pos[ch] = { x };
      x += g.advanceWidth;
    }
    if (i < 3) x += track + (kern[text[i] + text[i + 1]] || 0);
  }
  // bounds
  const full = parts.join('');
  const bb = { x1: trueO ? O_SB[0] : 45, x2: pos.y.x + 1011, y1: -ASC, y2: DESC };
  return { d: full, bbox: bb, pos, cap: CAP, xh: XH, asc: ASC, desc: DESC };
}
