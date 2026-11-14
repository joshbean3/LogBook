import { lightnessOf, mix, scale, shifted, tint, WHITE } from './color';
import { HUES, isStarred, lightOf, SHIFT, TOKEN, type Gem, type GemHue, type GemStyle } from './table';

/**
 * The art of an earned Orb, as one SVG document: the logo's own form (`docs/brand/tools/orb.mjs`: the body lit from the
 * top, the pale light and the warm Apricot underlight from below, the blurred glow along the lower limb, the soft
 * specular, the thin edge) in another hue, with the mark of its kind. Same 100-unit geometry as the logo: the sphere is
 * r 48 at (50, 50). The document's box is the sphere's diameter times `gemBox`, centered on the sphere.
 *
 * It is drawn as an image (an `<img>`, or once onto a canvas as a sprite), so its ids are its own and it may use blurs.
 * No script, no font, nothing fetched.
 */
const R = 48;
const C = 50;
/** Two decimals at most, no trailing zeros: the art stays under 4 KB. */
const f = (n: number): string => String(Math.round(n * 100) / 100);

export interface Sphere {
  /** The body's six stops, from the light at the top to the edge (the token's own color is the fourth). */
  body: readonly string[];
  /** The pale light from below: three tints of the body. */
  fill: readonly string[];
  /** The warm underlight: two Apricot lights, then two tints of the body it fades into. */
  under: readonly string[];
  /** The glow along the lower limb. */
  glow: readonly string[];
  /** The edge that holds the silhouette on Paper. */
  edge: string;
}
/** Every color of a sphere, derived from its hue's tokens and its shift. The one place a stop is worked out. */
export const sphereOf = (hue: GemHue, shift = 0): Sphere => {
  const spec = HUES[hue];
  const apricot = TOKEN['--apricot'];
  const paper = TOKEN['--paper'];
  const turn = (hex: string) => shifted(hex, shift * SHIFT.hue, lightOf(shift));
  const token = typeof spec.body === 'string' ? TOKEN[spec.body] : mix(TOKEN[spec.body[0]], TOKEN[spec.body[1]], spec.body[2]);
  const base = turn(mix(token, WHITE, spec.lift));
  const deep = spec.deep ? turn(TOKEN[spec.deep]) : null;
  // a light body (Apricot, Marigold) needs more color toward its edge to read as a sphere, where a deep one needs less
  const rich = lightnessOf(base) > 0.7 ? 1.25 : 1.04;
  const d1 = deep ? mix(base, deep, 0.55) : scale(base, 0.85, rich);
  const d2 = deep ? scale(deep, hue === 'pearl' ? 0.86 : 0.94, hue === 'pearl' ? 1.5 : 1) : scale(base, 0.68, rich);
  const light1 = mix(mix(apricot, WHITE, 0.59), paper, spec.warm);
  const light2 = mix(mix(apricot, WHITE, 0.27), paper, spec.warm * 0.8);
  return {
    body: [tint(base, 0.97, 0.1), tint(base, 0.8, 0.5), tint(base, 0.42, 0.95), base, d1, d2],
    fill: [mix(base, WHITE, 0.78), mix(base, WHITE, 0.46), mix(base, WHITE, 0.3)],
    under: [light1, light2, mix(base, WHITE, 0.85), mix(base, WHITE, 0.5)],
    glow: [mix(mix(apricot, WHITE, 0.44), paper, spec.warm), mix(apricot, paper, spec.warm * 0.7)],
    edge: scale(d2, 0.88),
  };
};

// ---------- the marks ----------
/** Rings: tilted like a planet's, behind the sphere at the top and across it at the bottom. Radii and widths by count. */
const RING = {
  tilt: -18,
  flat: 0.34,
  radii: [[], [62], [57.5, 69.5], [56.5, 66, 75.5]],
  width: [0, 4.6, 3.2, 2.6],
} as const;
const ringsOf = (style: GemStyle): 0 | 1 | 2 | 3 => (style === 'ring1' || style === 'starred-ring1' ? 1 : style === 'ring2' || style === 'starred-ring2' ? 2 : style === 'ring3' ? 3 : 0);
/** Pearl's halo reaches this far (the sphere is 48). */
const HALO = 70;
/** Star points: x, y and reach, the largest first. A fused week shows one per day that counted. */
const STARS: ReadonlyArray<readonly [number, number, number]> = [
  [42, 50, 10],
  [68, 60, 6.6],
  [26, 64, 5.4],
  [63, 37, 5.4],
  [49, 75, 5.8],
  [79, 43, 4.4],
  [30, 38, 4.6],
];
const star = ([x, y, s]: readonly [number, number, number]): string => {
  const k = s * 0.24;
  const a = s - k;
  return `M${f(x)} ${f(y - s)}l${f(k)} ${f(a)} ${f(a)} ${f(k)} ${f(-a)} ${f(k)} ${f(-k)} ${f(a)} ${f(-k)} ${f(-a)} ${f(-a)} ${f(-k)} ${f(a)} ${f(-k)}z`;
};

/** How far the art reaches from the sphere's center, in the sphere's own units (48 is the sphere itself). */
const reach = (gem: Gem): number => {
  const n = ringsOf(gem.style);
  if (n) {
    const t = (RING.tilt * Math.PI) / 180;
    const rx = Math.max(...RING.radii[n]);
    return Math.hypot(rx * Math.cos(t), rx * RING.flat * Math.sin(t)) + RING.width[n] / 2 + 0.5;
  }
  return gem.hue === 'pearl' ? HALO : R;
};
/** The art box over the sphere's diameter: 1 for a plain Orb, more where rings or a halo reach outside. */
export const gemBox = (gem: Gem): number => Math.ceil((reach(gem) / R) * 100) / 100;

const stop = (offset: number, color: string, opacity?: number) => `<stop offset="${f(offset)}" stop-color="${color}"${opacity === undefined ? '' : ` stop-opacity="${f(opacity)}"`}/>`;

/** The art as one SVG document. The sphere is centered; `gemBox(gem)` is the art box over the sphere's diameter. */
export const gemSvg = (gem: Gem): string => {
  const s = sphereOf(gem.hue, gem.shift);
  const apricot = TOKEN['--apricot'];
  const paper = TOKEN['--paper'];
  const half = R * gemBox(gem);
  const rings = ringsOf(gem.style);
  const ringColor = gem.hue === 'night' ? apricot : scale(s.body[3]!, 0.76, 1.1);
  const ringPath = (sweep: 0 | 1) =>
    RING.radii[rings]
      .map((rx) => `M${f(C - rx)} ${C}A${f(rx)} ${f(rx * RING.flat)} 0 0 ${sweep} ${f(C + rx)} ${C}`)
      .join('');
  const ring = (sweep: 0 | 1, opacity: number) => (rings ? `<path transform="rotate(${RING.tilt} ${C} ${C})" d="${ringPath(sweep)}" fill="none" stroke="${ringColor}" stroke-width="${RING.width[rings]}" opacity="${opacity}"/>` : '');
  const bands =
    gem.style === 'banded'
      ? `<g fill="none" stroke="${apricot}"><path d="M0 27Q50 39 100 27" stroke-width="4" opacity=".5"/><path d="M0 44Q50 60 100 44" stroke-width="8.5" opacity=".9"/><path d="M0 64Q50 81 100 64" stroke-width="5.5" opacity=".75"/></g>`
      : '';
  const shadow = gem.style === 'half' ? `<path transform="rotate(28 ${C} ${C})" d="M50 2A48 48 0 0 1 50 98A11 48 0 0 0 50 2Z" fill="${scale(s.body[5]!, 0.5)}" opacity=".86" filter="url(#t)"/>` : '';
  const stars = isStarred(gem.style) && gem.stars ? `<path d="${STARS.slice(0, gem.stars).map(star).join('')}" fill="${paper}" opacity=".94"/>` : '';
  const halo = gem.hue === 'pearl' ? `<circle cx="${C}" cy="${C}" r="${HALO}" fill="url(#h)"/>` : '';
  const haloColor = mix(apricot, paper, 0.3);
  // opal: two faint colors along the limb under the gloss, Rose on one side and Lagoon on the other, none in the middle
  const opal = gem.hue === 'pearl' ? '<path d="M0 0h100v100H0z" fill="url(#o)"/>' : '';
  const opalDef = opal ? `<linearGradient id="o" x1="0" y1=".7" x2="1" y2=".3">${stop(0.04, tint(TOKEN['--t-fast'], 0.6, 0.8), 0.5)}${stop(0.4, paper, 0)}${stop(0.62, paper, 0)}${stop(0.97, tint(TOKEN['--t-easy'], 0.62, 1), 0.5)}</linearGradient>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(half * 2)}" height="${f(half * 2)}" viewBox="${f(C - half)} ${f(C - half)} ${f(half * 2)} ${f(half * 2)}"><defs><radialGradient id="b" cx="50%" cy="36%" r="64%" fx="50%" fy="26%">${[0, 0.12, 0.34, 0.6, 0.84, 1].map((o, i) => stop(o, s.body[i]!)).join('')}</radialGradient><radialGradient id="w" cx="50%" cy="104%" r="58%">${stop(0, s.fill[0]!, 0.95)}${stop(0.5, s.fill[1]!, 0.45)}${stop(1, s.fill[2]!, 0)}</radialGradient><radialGradient id="a" gradientUnits="userSpaceOnUse" cx="50" cy="99" r="32" gradientTransform="translate(50 99) scale(1.9 1) translate(-50 -99)">${stop(0, s.under[0]!, 0.78)}${stop(0.34, s.under[1]!, 0.61)}${stop(0.68, s.under[2]!, 0.43)}${stop(1, s.under[3]!, 0)}</radialGradient><radialGradient id="k" gradientUnits="userSpaceOnUse" cx="50" cy="98" r="44">${stop(0, s.glow[0]!)}${stop(0.5, s.glow[1]!, 0.85)}${stop(1, s.glow[1]!, 0)}</radialGradient><linearGradient id="r" x1="0" y1="0" x2="0" y2="1">${stop(0, s.edge, 0.35)}${stop(0.75, s.edge, 0.3)}${stop(1, s.edge, 0.25)}</linearGradient><radialGradient id="s" cx="50%" cy="40%" r="60%">${stop(0, WHITE, 0.7)}${stop(0.45, WHITE, 0.42)}${stop(1, WHITE, 0)}</radialGradient>${halo ? `<radialGradient id="h">${stop(0.6, haloColor, 0.7)}${stop(0.8, haloColor, 0.24)}${stop(1, haloColor, 0)}</radialGradient>` : ''}<mask id="m"><circle cx="50" cy="50" r="47.2" fill="${WHITE}"/><circle cx="50" cy="44.5" r="48.83"/></mask><filter id="f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5"/></filter><filter id="g" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.5"/></filter>${shadow ? '<filter id="t"><feGaussianBlur stdDeviation="1.6"/></filter>' : ''}${opalDef}<clipPath id="c"><circle cx="50" cy="50" r="48"/></clipPath><clipPath id="i"><circle cx="50" cy="50" r="47.2"/></clipPath></defs>${halo}${ring(1, 0.72)}<circle cx="50" cy="50" r="48" fill="url(#b)"/><g clip-path="url(#c)"><circle cx="50" cy="50" r="48" fill="url(#w)"/>${opal}${bands}${shadow}<path d="M0 0h100v100H0z" fill="url(#a)"/><g clip-path="url(#i)"><g filter="url(#f)"><path d="M0 0h100v100H0z" fill="url(#k)" mask="url(#m)" opacity=".6"/></g></g>${stars}<ellipse cx="50" cy="22" rx="27" ry="15" fill="url(#s)" filter="url(#g)"/></g><circle cx="50" cy="50" r="47.6" fill="none" stroke="url(#r)" stroke-width=".8"/>${ring(0, 1)}</svg>`;
};

const urls = new Map<string, string>();
/** A cached `data:` URL of `gemSvg` (the same string for the same gem). */
export const gemUrl = (gem: Gem): string => {
  const id = `${gem.hue}|${gem.style}|${gem.shift}|${gem.stars ?? ''}`;
  let url = urls.get(id);
  if (!url) {
    // the few characters a data URL cannot carry as they are; the art uses double quotes only in attributes
    url = `data:image/svg+xml;charset=utf-8,${gemSvg(gem).replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`;
    urls.set(id, url);
  }
  return url;
};
