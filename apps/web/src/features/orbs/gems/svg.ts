import { recipeOf, type Dome, type Recipe, type Rung, type Stop } from './recipe';
import type { Gem } from './table';

/**
 * The art of an earned Orb, as one SVG document: the logo's Orb at one of five rungs (brand guide 2.1). The
 * construction is the logo's, layer for layer (the deck's page 7): the body, the sky's bounce, the light under it, the
 * light that wraps its lower edge, the specular, the edge. A rung only moves numbers (`recipe.ts`); from rung 3 a glow
 * is drawn behind the sphere, and on rungs 4 and 5 thin rings stand round it.
 *
 * The geometry is the logo file's own: the sphere is r 48 at (50, 50). A plain Orb is drawn in the logo's 100-unit box;
 * one with a glow in the brand's 150-unit box (25 more on each side), which holds every glow and ring.
 *
 * It is drawn as an image (an `<img>`, or once onto a canvas as a sprite). No script, no font, nothing fetched.
 */
const f = (n: number): string => String(Math.round(n * 1000) / 1000);
const stops = (list: readonly Stop[]): string => list.map(([off, c, a]) => `<stop offset="${f(off)}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${f(a)}"`}/>`).join('');
/** A light from under the sphere, as a gradient: a circle about (50, cy), stretched `sx` wide. */
const dome = (id: string, d: Dome): string =>
  `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="50" cy="${f(d.cy)}" r="${f(d.r)}" gradientTransform="translate(50 ${f(d.cy)}) scale(${f(d.sx)} 1) translate(-50 -${f(d.cy)})">${stops(d.stops)}</radialGradient>`;
const FULL = '<rect x="0" y="0" width="100" height="100"';

const draw = (r: Recipe, id: string): string => {
  const { limb: L, spec: S } = r;
  const padded = !!r.glow || r.rings.length > 0;
  const defs =
    `<radialGradient id="${id}b" cx="50%" cy="36%" r="64%" fx="50%" fy="26%">${stops(r.body)}</radialGradient>` +
    `<radialGradient id="${id}w" cx="50%" cy="104%" r="58%">${stops(r.bounce)}</radialGradient>` +
    (r.pale ? dome(`${id}p`, r.pale) : '') +
    dome(`${id}a`, r.under) +
    (L.from
      ? `<radialGradient id="${id}k" gradientUnits="userSpaceOnUse" cx="50" cy="${f(L.from.cy)}" r="${f(L.from.r)}">${stops(L.stops)}</radialGradient>`
      : `<linearGradient id="${id}k" gradientUnits="userSpaceOnUse" x1="0" y1="${f(L.fade ?? 50)}" x2="0" y2="98">${stops(L.stops)}</linearGradient>`) +
    (r.core ? dome(`${id}q`, r.core) : '') +
    `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1">${stops(r.edge)}</linearGradient>` +
    `<radialGradient id="${id}s" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity="${f(S.peak)}"/><stop offset="0.45" stop-color="#fff" stop-opacity="${f(S.peak * 0.6)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` + // brand-ok: Orb recipe, the specular's white as the logo file writes it
    (r.glow ? `<radialGradient id="${id}g" cx="50%" cy="50%" r="50%">${stops(r.glow.stops)}</radialGradient>` : '') +
    `<mask id="${id}m"><circle cx="50" cy="50" r="${f(L.within)}" fill="#fff"/><circle cx="50" cy="${f(L.cy)}" r="${f(L.cut)}" fill="#000"/></mask>` + // brand-ok: a mask's white and black, as the logo file writes them
    `<filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${f(L.blur)}"/></filter>` +
    `<filter id="${id}sf" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="${f(S.blur)}"/></filter>` +
    `<clipPath id="${id}c"><circle cx="50" cy="50" r="48"/></clipPath>` +
    `<clipPath id="${id}ci"><circle cx="50" cy="50" r="${f(L.within)}"/></clipPath>`;
  const body =
    (r.glow ? `<ellipse cx="50" cy="${f(r.glow.cy)}" rx="${f(r.glow.rx)}" ry="${f(r.glow.ry)}" fill="url(#${id}g)"/>` : '') +
    r.rings.map((g) => `<circle cx="50" cy="50" r="${f(g.r)}" fill="none" stroke="${g.color}" stroke-opacity="${f(g.opacity)}" stroke-width="${f(g.w)}"/>`).join('') +
    `<circle cx="50" cy="50" r="48" fill="url(#${id}b)"/>` +
    `<g clip-path="url(#${id}c)">` +
    `<circle cx="50" cy="50" r="48" fill="url(#${id}w)"/>` +
    (r.pale ? `${FULL} fill="url(#${id}p)"/>` : '') +
    `${FULL} fill="url(#${id}a)"/>` +
    `<g clip-path="url(#${id}ci)"><g filter="url(#${id}f)">${FULL} fill="url(#${id}k)" mask="url(#${id}m)" opacity="${f(L.opacity)}"/></g></g>` +
    (r.core ? `${FULL} fill="url(#${id}q)"/>` : '') +
    `<ellipse cx="${f(S.cx)}" cy="${f(S.cy)}" rx="${f(S.rx)}" ry="${f(S.ry)}" fill="url(#${id}s)" filter="url(#${id}sf)"/>` +
    `</g>` +
    `<circle cx="50" cy="50" r="47.6" fill="none" stroke="url(#${id}r)" stroke-width="0.8"/>`;
  const box = padded ? PADDED : PLAIN;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ROOT}" height="${ROOT}" viewBox="${box.min} ${box.min} ${box.side} ${box.side}"><defs>${defs}</defs>${body}</svg>`;
};

/** The two boxes the brand draws its Orb in: the logo's (the sphere is 96 of its 100 units) and the one with room for a glow (96 of 150). */
const PLAIN = { min: 0, side: 100 } as const;
const PADDED = { min: -25, side: 150 } as const;
const SPHERE = 96;
/** The root's own size, as the logo file writes it: an engine that asks an image its size before scaling it treats both alike. */
const ROOT = 1024;

const rungIn = (gem: Gem): Rung => (gem && gem.rung >= 1 && gem.rung <= 5 ? (Math.round(gem.rung) as Rung) : 1);
/** The size a picture is drawn for. Only an Orb with rings reads it (a ring is a hairline at every size), in whole px. */
const sizeIn = (rung: Rung, px?: number): number => (rung >= 4 && px ? Math.max(8, Math.min(128, Math.round(px))) : 0);
const drawn = new Map<string, string>();
/**
 * The art as one SVG document. Two Orbs of a rung are the same picture. `px` is the diameter it will be shown at: the
 * rings of rungs 4 and 5 are drawn one px wide for it; nothing else changes with size.
 */
export const gemSvg = (gem: Gem, px?: number): string => {
  const rung = rungIn(gem);
  const at = sizeIn(rung, px);
  const id = `${rung}@${at}`;
  let svg = drawn.get(id);
  if (!svg) {
    svg = draw(recipeOf(rung, at || undefined), `o${rung}`);
    drawn.set(id, svg);
  }
  return svg;
};

/**
 * The art box over the sphere's diameter: how much larger than the Orb its picture is. A glow and its rings reach
 * outside the sphere, so the picture is drawn this many times the Orb's size, centered on it.
 */
export const gemBox = (gem: Gem): number => {
  const r = recipeOf(rungIn(gem));
  return (r.glow || r.rings.length ? PADDED.side : PLAIN.side) / SPHERE;
};

const urls = new Map<string, string>();
/** A cached `data:` URL of `gemSvg` (the same string for the same rung and, where it has rings, size). */
export const gemUrl = (gem: Gem, px?: number): string => {
  const rung = rungIn(gem);
  const id = `${rung}@${sizeIn(rung, px)}`;
  let url = urls.get(id);
  if (!url) {
    // the few characters a data URL cannot carry as they are; the art uses double quotes only in attributes
    url = `data:image/svg+xml;charset=utf-8,${gemSvg(gem, px).replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`;
    urls.set(id, url);
  }
  return url;
};
