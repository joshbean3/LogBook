import { createElement, type JSX } from 'react';

/*
 * A placeholder for the family of Orbs (flat circles), so the dome can be built while the real art is drawn. Replaced
 * whole at merge by the family's own module: the exports below are the contract, and nothing else is read from here.
 */
export type GemHue = 'lagoon' | 'apricot' | 'deepsky' | 'indigo' | 'ochre' | 'gold' | 'pearl' | 'dusk' | 'plum' | 'rose' | 'night';
export type GemStyle = 'plain' | 'ring1' | 'ring2' | 'ring3' | 'banded' | 'half' | 'starred' | 'starred-ring1' | 'starred-ring2';
export interface Gem {
  hue: GemHue;
  style: GemStyle;
  /** -1 to 1: this Orb's own small shift of hue and lightness. */
  shift: number;
  /** Star points, 0 to 7 (fused weeks). */
  stars?: number;
}

const TOKEN: Record<GemHue, string> = {
  lagoon: '--t-easy',
  apricot: '--apricot',
  deepsky: '--deep-sky',
  indigo: '--t-lift',
  ochre: '--t-cross',
  gold: '--warn',
  pearl: '--haze',
  dusk: '--twilight',
  plum: '--t-hard',
  rose: '--t-fast',
  night: '--night-ink',
};
const token = (hue: GemHue): string => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(TOKEN[hue]).trim() || 'gray';
  } catch {
    return 'gray';
  }
};
const hash = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
};
const KIND: Array<[prefix: string, hue: GemHue, style: GemStyle, name: string]> = [
  ['todo', 'lagoon', 'plain', 'A to-do'],
  ['habit', 'apricot', 'plain', 'A habit'],
  ['train:run', 'deepsky', 'plain', 'A run'],
  ['train:lift', 'indigo', 'plain', 'A lift'],
  ['train:cross', 'ochre', 'plain', 'Cross-training'],
  ['goal:day', 'gold', 'ring1', 'Today’s goal'],
  ['goal:week', 'gold', 'ring1', 'A week goal'],
  ['goal:month', 'gold', 'ring2', 'A month goal'],
  ['goal:year', 'gold', 'ring3', 'A year goal'],
  ['full', 'pearl', 'plain', 'A full day'],
  ['week:', 'dusk', 'banded', 'A week that counts'],
  ['challenge:', 'plum', 'half', 'A challenge'],
  ['back', 'rose', 'plain', 'Good to see you'],
  ['fused:week', 'night', 'starred', 'An earlier week'],
  ['fused:chapter', 'night', 'starred-ring1', 'An earlier chapter'],
  ['fused:year', 'night', 'starred-ring2', 'An earlier year'],
];
const kindOf = (key: string) => KIND.find(([prefix]) => key.startsWith(prefix)) ?? KIND[1]!;

export const gemFor = (key: string, seed?: string, opts?: { stars?: number }): Gem => {
  const [, hue, style] = kindOf(key);
  const shift = seed ? (hash(seed) % 2001) / 1000 - 1 : 0;
  return { hue, style, shift, ...(opts?.stars ? { stars: Math.max(0, Math.min(7, opts.stars)) } : null) };
};
export const gemBox = (gem: Gem): number => (gem.style === 'plain' || gem.style === 'half' || gem.style === 'banded' || gem.style === 'starred' ? 1 : 1.3);
export const gemSvg = (gem: Gem): string => {
  const box = gemBox(gem);
  const side = 100 * box;
  const c = side / 2;
  const rings = gem.style.includes('ring') ? Number(gem.style.slice(-1)) : 0;
  let art = `<circle cx="${c}" cy="${c}" r="49" fill="${token(gem.hue)}" opacity="${(0.86 + gem.shift * 0.14).toFixed(2)}"/>`;
  for (let i = 0; i < rings; i++) art += `<ellipse cx="${c}" cy="${c}" rx="${56 + i * 4}" ry="${14 + i * 4}" fill="none" stroke="${token('apricot')}" stroke-width="2"/>`;
  for (let i = 0; i < (gem.stars ?? 0); i++) art += `<circle cx="${c - 24 + i * 8}" cy="${c - 10 + (i % 2) * 14}" r="2.4" fill="${token('pearl')}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" width="${side}" height="${side}">${art}</svg>`;
};
const urls = new Map<string, string>();
export const gemUrl = (gem: Gem): string => {
  const id = `${gem.hue}|${gem.style}|${gem.shift}|${gem.stars ?? 0}`;
  let url = urls.get(id);
  if (!url) urls.set(id, (url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(gemSvg(gem))}`));
  return url;
};
export const gemName = (key: string): string => kindOf(key)[3];
export const OrbGem = (p: { gem: Gem; size: number; className?: string; label?: string }): JSX.Element => {
  const side = p.size * gemBox(p.gem);
  return createElement('img', { src: gemUrl(p.gem), width: side, height: side, className: p.className, alt: p.label ?? '', 'aria-hidden': p.label ? undefined : true, draggable: false });
};
