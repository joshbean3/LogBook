// The Orby Orb: a glossy sky-blue sphere lit by a sunrise from below. 100-unit box, sphere r 48 at (50,50).
// v1.1: soft specular (blur 2.5, 70% peak), the warm light is a wide underglow (blur 2.5) rather than a crescent,
// an edge that runs all the way round (35% top, 25% on the bottom quarter) so the silhouette holds on Paper and Cloud,
// and a dark-ground glow (22% Apricot, screen blend).
// opts: state 'idle'|'think', glow (bool), dark (bool: glow for Twilight or Night Ink grounds), warm (0..1.4), flat (bool), id,
// arc (bool, default true: the thinking state draws its ring and arc; false draws the warm sphere alone, for the app, where
// the arc is a separate overlay that rotates while the sphere holds still).
// The app's arc-free art (apps/web/src/ui/orb/) was written with:
//   orbSVG(96, { state: 'think', glow: true, arc: false })  -> logo-mark-thinking-body.svg (48 px and up)
//   orbSVG(96, { state: 'think', arc: false })              -> logo-mark-thinking-gloss.svg (28 to 47 px, 0..100 box)
//   orbSVG(96, { glow: true, warm: 0 })                     -> logo-mark-dawn.svg (the splash rise: no underlight)
let n = 0;
export const ORB = {
  body: [['0', '#FFFFFF'], ['.12', '#E4F6FE'], ['.34', '#97D8F9'], ['.6', '#38B6F2'], ['.84', '#1590D2'], ['1', '#0A68A0']],
  // final opacities (the 0.85 warm factor is already applied), offsets 0 / .34 / .68 / 1
  under: { idle: { r: 32, op: [0.78, 0.61, 0.43] }, think: { r: 36, op: [0.85, 0.66, 0.46] }, stretch: 1.9, cy: 99 },
  rim: { shift: { idle: 5.5, think: 7.5 }, blur: 2.5, opacity: { idle: 0.6, think: 0.72 } },
  spec: { cx: 50, cy: 22, rx: 27, ry: 15, peak: 0.7, blur: 2.5 },
  edge: { r: 47.6, w: 0.8, color: '#0A5E92', top: 0.35, mid: 0.3, bottom: 0.25 },
  glow: { light: { op: 0.5, thinkOp: 0.62 }, dark: { op: 0.22, thinkOp: 0.25 } },
};
export function orbDefsAndBody(o = {}) {
  const id = o.id || 'orb' + (n++);
  const think = o.state === 'think';
  if (o.flat) return `<circle cx="50" cy="50" r="48" fill="${o.fill || '#38B6F2'}"/>`;
  const warm = (o.warm ?? 0.85) / 0.85; // 1 = the published recipe
  const U = think ? ORB.under.think : ORB.under.idle;
  const rimShift = think ? ORB.rim.shift.think : ORB.rim.shift.idle;
  const glow = o.glow ?? false;
  const G = o.dark ? ORB.glow.dark : ORB.glow.light;
  const op = (v) => Math.min(1, v * warm).toFixed(3);
  const E = ORB.edge, S = ORB.spec;
  return `
  <defs>
    <radialGradient id="${id}b" cx="50%" cy="36%" r="64%" fx="50%" fy="26%">${ORB.body.map(([o2, c]) => `<stop offset="${o2}" stop-color="${c}"/>`).join('')}</radialGradient>
    <radialGradient id="${id}w" cx="50%" cy="104%" r="58%">
      <stop offset="0" stop-color="#D6F1FE" stop-opacity=".95"/><stop offset=".5" stop-color="#9ADBFA" stop-opacity=".45"/><stop offset="1" stop-color="#7FD0F7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}a" gradientUnits="userSpaceOnUse" cx="50" cy="${ORB.under.cy}" r="${U.r}" gradientTransform="translate(50 ${ORB.under.cy}) scale(${ORB.under.stretch} 1) translate(-50 -${ORB.under.cy})">
      <stop offset="0" stop-color="#FFE3CB" stop-opacity="${op(U.op[0])}"/>
      <stop offset=".34" stop-color="#FFC9A2" stop-opacity="${op(U.op[1])}"/>
      <stop offset=".68" stop-color="#DDF3FE" stop-opacity="${op(U.op[2])}"/>
      <stop offset="1" stop-color="#9EDCFA" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}k" gradientUnits="userSpaceOnUse" cx="50" cy="98" r="${think ? 48 : 44}"><stop offset="0" stop-color="${think ? '#FFC596' : '#FFD9B8'}"/><stop offset=".5" stop-color="${think ? '#FFA868' : '#FFB680'}" stop-opacity=".85"/><stop offset="1" stop-color="#FFB680" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${E.color}" stop-opacity="${E.top}"/><stop offset=".75" stop-color="${E.color}" stop-opacity="${E.mid}"/><stop offset="1" stop-color="${E.color}" stop-opacity="${E.bottom}"/></linearGradient>
    <radialGradient id="${id}s" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="${S.peak}"/><stop offset=".45" stop-color="#fff" stop-opacity="${(S.peak * 0.6).toFixed(2)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFB680" stop-opacity="${think ? G.thinkOp : G.op}"/><stop offset="1" stop-color="#FFB680" stop-opacity="0"/></radialGradient>
    <mask id="${id}m"><circle cx="50" cy="50" r="47.2" fill="#fff"/><circle cx="50" cy="${50 - rimShift}" r="${48 + rimShift * 0.15}" fill="#000"/></mask>
    <filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${ORB.rim.blur}"/></filter>
    <filter id="${id}sf" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${S.blur}"/></filter>
    <clipPath id="${id}c"><circle cx="50" cy="50" r="48"/></clipPath>
    <clipPath id="${id}ci"><circle cx="50" cy="50" r="47.2"/></clipPath>
  </defs>
  ${glow ? `<ellipse cx="50" cy="${think ? 78 : 77}" rx="${think ? 64 : 56}" ry="${think ? 38 : 32}" fill="url(#${id}g)"${o.dark ? ' style="mix-blend-mode:screen"' : ''}/>` : ''}
  <circle cx="50" cy="50" r="48" fill="url(#${id}b)"/>
  <g clip-path="url(#${id}c)">
    <circle cx="50" cy="50" r="48" fill="url(#${id}w)"/>
    <rect x="0" y="0" width="100" height="100" fill="url(#${id}a)"/>
    <g clip-path="url(#${id}ci)"><g filter="url(#${id}f)"><rect x="0" y="0" width="100" height="100" fill="url(#${id}k)" mask="url(#${id}m)" opacity="${op(think ? ORB.rim.opacity.think : ORB.rim.opacity.idle)}"/></g></g>
    <ellipse cx="${S.cx}" cy="${S.cy}" rx="${S.rx}" ry="${S.ry}" fill="url(#${id}s)" filter="url(#${id}sf)"/>
  </g>
  <circle cx="50" cy="50" r="${E.r}" fill="none" stroke="url(#${id}r)" stroke-width="${E.w}"/>
  ${think && o.arc !== false ? `<circle cx="50" cy="50" r="58" fill="none" stroke="#38B6F2" stroke-opacity=".3" stroke-width="1"/><circle cx="50" cy="50" r="58" fill="none" stroke="#FFFDF8" stroke-width="4" stroke-dasharray="51 400" stroke-linecap="round" transform="rotate(118 50 50)"/><circle cx="50" cy="50" r="58" fill="none" stroke="#FF9F5A" stroke-width="1.8" stroke-dasharray="50 400" stroke-linecap="round" transform="rotate(118.5 50 50)"/>` : ''}`;
}
// A standalone <svg>. size = sphere diameter in px; the box is padded by 25% each side when glow or think is on.
export function orbSVG(size, o = {}) {
  const padded = o.glow || (o.state === 'think' && o.arc !== false) || o.pad;
  if (!padded) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 100 / 96}" height="${size * 100 / 96}" viewBox="0 0 100 100">${orbDefsAndBody(o)}</svg>`;
  const W = size * 150 / 96;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="-25 -25 150 150">${orbDefsAndBody(o)}</svg>`;
}
