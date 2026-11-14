import { toneOf } from './color';
import { HUES, LINE, TOKEN, type FormHue, type FormStyle, type Gem } from './table';

/**
 * The art of an earned Orb, as one SVG document: a flat form built on a circle (brand guide 2.1). One color, one
 * silhouette, see-through gaps, so it sits on Paper, Cloud, the poster's sky and Twilight alike. No gradient, no gloss,
 * no shadow, no glow, no filter: the assistant's Orb is the only glossy thing in Orby.
 *
 * The geometry is the logo's own 100-unit square: the form's circle is r 48 at (50, 50), and nothing is drawn outside
 * it. Three measures, each a share of the diameter (96), are used by every form and nowhere changed:
 *   stroke  3/32   a line: a lit disc's ring, the orbit, the arc over the sunrise, the horizon (2 px at 22 px)
 *   gap     1/16   the air between two parts of one form
 *   hair    3/64   half a stroke: a pale disc's edge and the thin rings round an earlier chapter and year, which are
 *                  never drawn small
 * A target is the one form that cannot keep the stroke (four rings do not fit at it): its radius is cut into equal
 * bands instead, one per dot, gap and ring.
 *
 * It is drawn as an image (an `<img>`, or once onto a canvas as a sprite). No script, no font, nothing fetched.
 */
const R = 48;
const C = 50;
export const FORM = { stroke: 9, gap: 6, hair: 4.5 } as const;
const { stroke: W, gap: G, hair: H } = FORM;
/** Two decimals at most, no trailing zeros. */
const f = (n: number): string => String(Math.round(n * 100) / 100);

/** A filled circle and a ring whose outer edge is at `outer`. */
const dot = (r: number, fill: string, cx = C, cy = C) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"/>`;
const ring = (outer: number, w: number, color: string) => `<circle cx="${C}" cy="${C}" r="${f(outer - w / 2)}" fill="none" stroke="${color}" stroke-width="${f(w)}"/>`;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** A point on the form's own clock: 0 degrees is three o'clock, and the angle grows clockwise, as SVG's y does. */
const at = (r: number, deg: number, cx = C, cy = C): [number, number] => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
const pt = ([x, y]: readonly [number, number]) => `${f(x)} ${f(y)}`;

// ---------- the forms ----------
/** The orbit: a solid circle, one orbit line round it, and a small moon on the line at the upper right, with a gap each side. */
const ORBIT = { body: W * 2, moon: 8, toward: -45 } as const;
const orbit = (c: string): string => {
  const { body, moon, toward } = ORBIT;
  // the moon touches the form's circle from inside, and the line runs through its center
  const r = R - moon;
  const open = (2 * Math.asin((moon + G) / (2 * r)) * 180) / Math.PI;
  return `<path d="M${pt(at(r, toward + open))}A${f(r)} ${f(r)} 0 1 1 ${pt(at(r, toward - open))}" fill="none" stroke="${c}" stroke-width="${W}"/>` + dot(body, c) + dot(moon, c, ...at(r, toward));
};

/** A target: a center dot and `n` rings. The radius is cut into 2n + 1 equal bands, so dot, gap and ring are one width. */
const target = (n: number, c: string): string => {
  const band = R / (2 * n + 1);
  let out = dot(band, c);
  for (let i = 1; i <= n; i++) out += ring(band * (2 * i + 1), band, c);
  return out;
};

/** The sunrise: a half-disc on a short horizon line, one arc over it. The horizon is the form's second color. */
const SUN = { horizon: 59, reach: 42, line: 44 } as const;
const sunrise = (c: string, line: string): string => {
  const { horizon: y, reach } = SUN;
  const sun = reach - W - G;
  const arc = reach - W / 2;
  return (
    `<path d="M${f(C - sun)} ${y}A${f(sun)} ${f(sun)} 0 0 1 ${f(C + sun)} ${y}Z" fill="${c}"/>` +
    `<path d="M${f(C - arc)} ${y}A${f(arc)} ${f(arc)} 0 0 1 ${f(C + arc)} ${y}" fill="none" stroke="${c}" stroke-width="${W}"/>` +
    `<path d="M${f(C - SUN.line)} ${y}h${f(SUN.line * 2)}v${W}h${f(-SUN.line * 2)}z" fill="${line}"/>`
  );
};

/** Seven dots in a ring, one per day of a week, the first at twelve o'clock. */
const SEVEN = { dot: 12 } as const;
const seven = (c: string): string => {
  let out = '';
  for (let i = 0; i < 7; i++) {
    const [x, y] = at(R - SEVEN.dot, -90 + (360 / 7) * i);
    out += dot(SEVEN.dot, c, x, y);
  }
  return out;
};

/** A crescent: the form's circle with the same circle, moved up and to the left, taken out of it. */
const CRESCENT = { move: 30, toward: -135 } as const;
const crescent = (c: string): string => {
  const { move, toward } = CRESCENT;
  const half = Math.sqrt(R * R - (move / 2) ** 2);
  const [mx, my] = at(move / 2, toward);
  const p1 = at(half, toward - 90, mx, my);
  const p2 = at(half, toward + 90, mx, my);
  return `<path d="M${pt(p1)}A${R} ${R} 0 1 0 ${pt(p2)}A${R} ${R} 0 0 1 ${pt(p1)}Z" fill="${c}"/>`;
};

/** An open ring: two strokes thick, round at its ends, with a gap at the top right. */
const OPEN = { width: W * 2, gap: 72, toward: -45 } as const;
const open = (c: string): string => {
  const r = R - OPEN.width / 2;
  const p1 = at(r, OPEN.toward + OPEN.gap / 2);
  const p2 = at(r, OPEN.toward - OPEN.gap / 2);
  return `<path d="M${pt(p1)}A${f(r)} ${f(r)} 0 1 1 ${pt(p2)}" fill="none" stroke="${c}" stroke-width="${f(OPEN.width)}" stroke-linecap="round"/>`;
};

const KNOWN_HUE = (h: string): h is FormHue => Object.prototype.hasOwnProperty.call(HUES, h);
const STYLES: readonly FormStyle[] = ['disc', 'lit', 'orbit', 'target1', 'target2', 'target3', 'target4', 'sunrise', 'seven', 'crescent', 'open', 'pale', 'pale-ring', 'disc-rings'];

/** The parts of a form in color `c`, with `line` for its second color and `fill` for a pale disc's inside (`none` in the one-color print). */
const parts = (style: FormStyle, c: string, line: string, fill: string): string => {
  switch (style) {
    case 'lit':
      return ring(R, W, c) + dot(R - W - G, c);
    case 'orbit':
      return orbit(c);
    case 'target1':
      return target(1, c);
    case 'target2':
      return target(2, c);
    case 'target3':
      return target(3, c);
    case 'target4':
      return target(4, c);
    case 'sunrise':
      return sunrise(c, line);
    case 'seven':
      return seven(c);
    case 'crescent':
      return crescent(c);
    case 'open':
      return open(c);
    case 'pale':
      return dot(R - H / 2, fill) + ring(R, H, line);
    case 'pale-ring':
      return ring(R, H, line) + dot(R - H * 2.5, fill) + ring(R - H * 2, H, line);
    case 'disc-rings':
      return ring(R, H, c) + ring(R - H * 2, H, c) + dot(R - H * 4, c);
    default:
      return dot(R, c);
  }
};

const doc = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="2 2 96 96">${inner}</svg>`;
const styleOf = (gem: Gem): FormStyle => (STYLES.includes(gem.style as FormStyle) ? (gem.style as FormStyle) : 'disc');

/** The color a gem is drawn in: its token at its tint. A lighter tint with no edge of its own is held to 1.5:1 on Paper. */
export const colorOf = (gem: Gem): string => {
  const token = TOKEN[HUES[KNOWN_HUE(gem.hue) ? gem.hue : 'deepsky']];
  const edged = gem.style === 'pale' || gem.style === 'pale-ring';
  return toneOf(token, gem.shift, edged ? undefined : TOKEN['--paper']);
};

/** The art as one SVG document: the form's circle fills the box. */
export const gemSvg = (gem: Gem): string => {
  const c = colorOf(gem);
  return doc(parts(styleOf(gem), c, TOKEN[LINE].toLowerCase(), c));
};
/**
 * The same form printed in one color (the silhouette test: every form must be told from every other with no hue). A
 * pale disc prints as its edge, open inside.
 */
export const gemInk = (gem: Gem, ink: string = TOKEN['--night-ink'].toLowerCase()): string => doc(parts(styleOf(gem), ink, ink, 'none'));

/** The art box over the form's diameter. Every form is drawn inside its own circle, so it is always 1. */
export const gemBox = (_gem: Gem): number => 1;

const urls = new Map<string, string>();
/** A cached `data:` URL of `gemSvg` (the same string for the same form and tint). */
export const gemUrl = (gem: Gem): string => {
  const id = `${gem.hue}|${gem.style}|${gem.shift}`;
  let url = urls.get(id);
  if (!url) {
    // the few characters a data URL cannot carry as they are; the art uses double quotes only in attributes
    url = `data:image/svg+xml;charset=utf-8,${gemSvg(gem).replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')}`;
    urls.set(id, url);
  }
  return url;
};
