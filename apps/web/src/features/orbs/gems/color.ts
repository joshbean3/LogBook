/**
 * Color for the Orb family, with no DOM in it: a token's hex in, derived hexes out. Everything a sphere needs besides
 * its token (the lighter stops toward its light, the deeper ones toward its edge, its small shift) is worked out here in
 * OKLab, where equal steps look equal, so no component types a color.
 */
export interface Lab {
  l: number;
  a: number;
  b: number;
}
const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gam = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export const toLab = (hex: string): Lab => {
  const n = parseInt(hex.slice(1), 16);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s };
};
const rgbOf = (c: Lab): [number, number, number] => {
  const l = (c.l + 0.3963377774 * c.a + 0.2158037573 * c.b) ** 3;
  const m = (c.l - 0.1055613458 * c.a - 0.0638541728 * c.b) ** 3;
  const s = (c.l - 0.0894841775 * c.a - 1.291485548 * c.b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
};
const inGamut = (rgb: readonly number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
/** Back to a hex. A color outside sRGB keeps its lightness and hue and gives up chroma until it fits. */
export const toHex = (c: Lab): string => {
  const l = Math.min(1, Math.max(0, c.l));
  let k = 1;
  let rgb = rgbOf({ l, a: c.a, b: c.b });
  for (let i = 0; i < 24 && !inGamut(rgb); i++) {
    k *= 0.94;
    rgb = rgbOf({ l, a: c.a * k, b: c.b * k });
  }
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, gam(Math.min(1, Math.max(0, v))))) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};

/** `t` of the way from `x` to `y`, in OKLab. */
export const mix = (x: string, y: string, t: number): string => {
  const p = toLab(x);
  const q = toLab(y);
  return toHex({ l: p.l + (q.l - p.l) * t, a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t });
};
/** The same hue, its lightness times `l` and its chroma times `c`. */
export const scale = (hex: string, l: number, c = 1): string => {
  const p = toLab(hex);
  return toHex({ l: p.l * l, a: p.a * c, b: p.b * c });
};
/** Turn the hue by `deg` degrees and move the lightness by `dl` (0 to 1): an Orb's own small shift. */
export const shifted = (hex: string, deg: number, dl: number): string => {
  const p = toLab(hex);
  const r = (deg * Math.PI) / 180;
  return toHex({ l: p.l + dl, a: p.a * Math.cos(r) - p.b * Math.sin(r), b: p.a * Math.sin(r) + p.b * Math.cos(r) });
};
/** The hue angle in degrees (0 to 360) and the lightness (0 to 1). */
export const hueOf = (hex: string): number => {
  const p = toLab(hex);
  return ((Math.atan2(p.b, p.a) * 180) / Math.PI + 360) % 360;
};
export const lightnessOf = (hex: string): number => toLab(hex).l;
/** Pure light: the top of the scale, derived rather than typed. */
export const WHITE = toHex({ l: 1, a: 0, b: 0 });
