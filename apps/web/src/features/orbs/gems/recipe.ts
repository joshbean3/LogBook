/**
 * The Orb's recipe as numbers (brand guide 2.1; the deck's page 7; `docs/brand/tools/orb.mjs`), and the five rungs an
 * earned Orb is drawn at. An earned Orb is the logo's Orb. Rung 1 is the logo's own file (`ui/orb/logo-mark.svg`),
 * number for number; a test reads that file and holds this to it. Every other rung is the same construction with the
 * light under it risen and its glow grown: its numbers are the brand's own sunrise drawing (`logo-mark-sunrise.svg`),
 * moved. Nothing else varies: no other hue, no other shape.
 *
 * An SVG drawn as an image cannot read CSS variables, so the colors are written once here. Each is a token
 * (`styles/tokens.css`) or a value of the brand's own Orb files; the test fails when one is neither.
 */
export type Rung = 1 | 2 | 3 | 4 | 5;
export const RUNGS: readonly Rung[] = [1, 2, 3, 4, 5];

/** A gradient stop: where, which color, how solid (1 when left out). */
export type Stop = readonly [offset: number, color: string, opacity?: number];

/** The palette: the tokens the art uses, and the recipe's own lights. */
export const INK = {
  white: '#FFFFFF', // brand-ok: Orb recipe, the specular and the body's center
  sky: '#38B6F2', // brand-ok: Orb recipe, --sky
  apricot: '#FFB680', // brand-ok: Orb recipe, --apricot
  sunrise: '#F2600C', // brand-ok: Orb recipe, --sunrise (rung 4's base and rung 5's body only)
  ember: '#B4430C', // brand-ok: Orb recipe, --ember (the edge where the sphere is warm, as the sunrise drawing has it)
  body1: '#E4F6FE', // brand-ok: Orb recipe, body 12%
  body2: '#97D8F9', // brand-ok: Orb recipe, body 34%
  body4: '#1590D2', // brand-ok: Orb recipe, body 84%
  body5: '#0A68A0', // brand-ok: Orb recipe, body 100%
  bounce0: '#D6F1FE', // brand-ok: Orb recipe, sky bounce 0
  bounce1: '#9ADBFA', // brand-ok: Orb recipe, sky bounce 50%
  bounce2: '#7FD0F7', // brand-ok: Orb recipe, sky bounce 100%
  under0: '#FFE3CB', // brand-ok: Orb recipe, underlight 0
  under1: '#FFC9A2', // brand-ok: Orb recipe, underlight 34%
  under2: '#DDF3FE', // brand-ok: Orb recipe, underlight 68%
  under3: '#9EDCFA', // brand-ok: Orb recipe, underlight 100%
  rim0: '#FFD9B8', // brand-ok: Orb recipe, warm glow 0
  edge: '#0A5E92', // brand-ok: Orb recipe, the edge
  pale0: '#FFF1E4', // brand-ok: Orb recipe, the sunrise drawing's pale light
  pale1: '#F4F9FD', // brand-ok: Orb recipe, the pale light's cool end
  warm0: '#FFA868', // brand-ok: Orb recipe, the sunrise drawing's warm light
  warm1: '#FF9F5A', // brand-ok: Orb recipe, the sunrise drawing's base (--orb-arc)
} as const;

/** A light from under the sphere: a circle of light centered below it at (50, cy), `sx` times as wide as tall. */
export interface Dome {
  cy: number;
  r: number;
  sx: number;
  stops: readonly Stop[];
}
/**
 * The light that wraps the lower edge: the sphere (to `within`) less a circle of radius `cut` set higher (at `cy`), so
 * it is thick at the bottom and gone by the equator; blurred, then drawn at `opacity`. The logo fills it from a point
 * (`from`: a circle of light at the base); the sunrise drawing fades it downward (`fade`: from this height to the base).
 */
export interface Limb {
  within: number;
  cy: number;
  cut: number;
  blur: number;
  opacity: number;
  from?: { cy: number; r: number };
  fade?: number;
  stops: readonly Stop[];
}
/** The glow round the sphere: an ellipse of Apricot behind it, strongest at its middle. */
export interface Glow {
  cy: number;
  rx: number;
  ry: number;
  stops: readonly Stop[];
}
export interface Ring {
  r: number;
  w: number;
  color: string;
  opacity: number;
}
export interface Recipe {
  body: readonly Stop[];
  bounce: readonly Stop[];
  /** A pale light under the warm one, so the blue never greys where they meet. */
  pale?: Dome;
  /** The underlight: the logo's thin one, or the sunrise drawing's dome of warm light. */
  under: Dome;
  limb: Limb;
  /** The bright core at the very bottom. */
  core?: Dome;
  spec: { cx: number; cy: number; rx: number; ry: number; peak: number; blur: number };
  edge: readonly Stop[];
  glow?: Glow;
  rings: readonly Ring[];
}

// ---------- rung 1: the logo's Orb, number for number ----------
export const LOGO: Recipe = {
  body: [
    [0, INK.white],
    [0.12, INK.body1],
    [0.34, INK.body2],
    [0.6, INK.sky],
    [0.84, INK.body4],
    [1, INK.body5],
  ],
  bounce: [
    [0, INK.bounce0, 0.95],
    [0.5, INK.bounce1, 0.45],
    [1, INK.bounce2, 0],
  ],
  under: {
    cy: 99,
    r: 32,
    sx: 1.9,
    stops: [
      [0, INK.under0, 0.78],
      [0.34, INK.under1, 0.61],
      [0.68, INK.under2, 0.43],
      [1, INK.under3, 0],
    ],
  },
  limb: {
    within: 47.2,
    cy: 44.5,
    cut: 48.825,
    blur: 2.5,
    opacity: 0.6,
    from: { cy: 98, r: 44 },
    stops: [
      [0, INK.rim0],
      [0.5, INK.apricot, 0.85],
      [1, INK.apricot, 0],
    ],
  },
  spec: { cx: 50, cy: 22, rx: 27, ry: 15, peak: 0.7, blur: 2.5 },
  edge: [
    [0, INK.edge, 0.35],
    [0.75, INK.edge, 0.3],
    [1, INK.edge, 0.25],
  ],
  rings: [],
};

// ---------- the sunrise drawing's light (`logo-mark-sunrise.svg`), which the upper rungs move ----------
const PALE: Dome = {
  cy: 104,
  r: 66,
  sx: 1.5,
  stops: [
    [0, INK.pale0, 0.9],
    [0.6, INK.pale0, 0.85],
    [0.8, INK.pale1, 0.45],
    [1, INK.bounce0, 0],
  ],
};
const WARM: Dome = {
  cy: 106,
  r: 50,
  sx: 1.6,
  stops: [
    [0, INK.warm0, 0.95],
    [0.4, INK.apricot, 0.8],
    [0.7, INK.under1, 0.45],
    [1, INK.under0, 0],
  ],
};
const WRAP: Limb = {
  within: 48,
  cy: 41.5,
  cut: 42.7,
  blur: 3.6,
  opacity: 1,
  fade: 56,
  stops: [
    [0, INK.under0, 0],
    [0.3, INK.under1, 0.5],
    [0.62, INK.warm0, 0.85],
    [1, INK.warm1, 1],
  ],
};
const CORE: Dome = {
  cy: 100,
  r: 24,
  sx: 1.9,
  stops: [
    [0, INK.pale0, 0.75],
    [0.5, INK.under0, 0.4],
    [1, INK.under0, 0],
  ],
};
const WARM_EDGE: readonly Stop[] = [
  [0, INK.edge, 0.35],
  [0.45, INK.edge, 0.24],
  [0.75, INK.ember, 0.2],
  [1, INK.ember, 0.3],
];

/**
 * What a rung moves, and nothing else.
 *   rise   how far up the sphere the sunrise reaches: the growth of the pale and the warm dome of light (1 is the
 *          sunrise drawing itself, its lower third)
 *   deep   how much Sunrise the base carries (0 is the drawing's Apricot)
 *   core   how bright the pale core at the very bottom is (1 is the drawing's)
 *   sun    the body itself is warm: the logo's body with its blues turned to the sunrise's colors, the top left cool
 *   glow   the Apricot glow behind the sphere: half-width, half-height, strength, and how far its middle sits under
 *          the sphere's
 *   rings  the hairline rings that stand round it: their radii
 */
interface Move {
  rise: readonly [pale: number, warm: number];
  deep: number;
  core: number;
  sun?: boolean;
  glow?: readonly [rx: number, ry: number, op: number, drop: number];
  rings: readonly number[];
}
export const MOVES: Record<Exclude<Rung, 1>, Move> = {
  2: { rise: [1, 1], deep: 0, core: 1, rings: [] },
  3: { rise: [1.12, 1.14], deep: 0, core: 1, glow: [70, 46, 0.85, 24], rings: [] },
  4: { rise: [1.3, 1.36], deep: 0.7, core: 0.35, glow: [73, 56, 0.9, 16], rings: [59] },
  5: { rise: [1.27, 1.32], deep: 0.8, core: 0, sun: true, glow: [75, 75, 0.95, 0], rings: [59, 69] },
};
/**
 * A ring is a hairline, as the rings on the deck's cover are: one px wide at the size the Orb is shown at, never under
 * `min` or over `max` of the art's units (the sphere is 96 across), in the base's own Apricot, the outer one fainter.
 */
export const RING = { px: 1, min: 1.5, max: 4.5, color: INK.warm1, opacity: [0.95, 0.6] } as const;
/** The glow holds its strength out to here (a share of its radius), then fades to nothing: it must be seen past the sphere's edge at 20 px. */
const GLOW_HOLD = 0.6;
/** Past its hold the glow pales as it fades (the recipe's own two lighter Apricots), so over a blue ground its last reach is light, never grey. */
const GLOW_PALE = 0.82;

/** Rung 5's body: the logo's own stops, where they stand, with the blues turned to the sunrise. The first two stay: the cool highlight. */
const SUN_BODY: readonly Stop[] = [
  [0, INK.white],
  [0.12, INK.body1],
  [0.3, INK.pale0],
  [0.46, INK.rim0],
  [0.66, INK.apricot],
  [0.86, INK.warm1],
  [1, INK.sunrise],
];
const faded = (list: readonly Stop[], k: number): readonly Stop[] => list.map(([o, c, a]) => [o, c, Math.round((a ?? 1) * k * 1000) / 1000] as const);
const grown = (d: Dome, k: number): Dome => ({ ...d, r: Math.round(d.r * k * 10) / 10 });
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The recipe of a rung: the logo at 1, and above it the logo's sphere with the sunrise drawing's light, moved. `px` is the size it will be shown at, which only a ring's width reads. */
export const recipeOf = (rung: Rung, px = 32): Recipe => {
  if (rung === 1) return LOGO;
  const m = MOVES[rung];
  const base = m.deep > 0 ? ([...WRAP.stops.slice(0, 3), [0.8, INK.warm1, 1], [1, INK.sunrise, m.deep]] as readonly Stop[]) : WRAP.stops;
  // the wrap rises with the light: its fade starts higher, and the circle cut from it sits a little higher
  const lift = (m.rise[1] - 1) * 48;
  const w = Math.min(RING.max, Math.max(RING.min, (96 / Math.max(1, px)) * RING.px));
  return {
    ...LOGO,
    body: m.sun ? SUN_BODY : LOGO.body,
    bounce: m.sun ? faded(LOGO.bounce, 0) : LOGO.bounce,
    pale: m.sun ? undefined : grown(PALE, m.rise[0]),
    under: m.sun ? { ...grown(WARM, m.rise[1]), stops: faded(WARM.stops, 0.5) } : grown(WARM, m.rise[1]),
    limb: { ...WRAP, fade: round1(WRAP.fade! - lift * 0.7), cy: round1(WRAP.cy - lift * 0.12), stops: base },
    core: m.core > 0 ? { ...CORE, stops: faded(CORE.stops, m.core) } : undefined,
    edge: m.sun ? WARM_EDGE.map(([o, , a]) => [o, INK.ember, a] as const) : WARM_EDGE,
    glow: m.glow
      ? {
          cy: 50 + m.glow[3],
          rx: m.glow[0],
          ry: m.glow[1],
          stops: [
            [0, INK.apricot, m.glow[2]],
            [GLOW_HOLD, INK.apricot, round2(m.glow[2] * 0.8)],
            [GLOW_PALE, INK.under1, round2(m.glow[2] * 0.35)],
            [1, INK.under0, 0],
          ],
        }
      : undefined,
    rings: m.rings.map((r, i) => ({ r, w: round2(w), color: RING.color, opacity: RING.opacity[i] ?? RING.opacity[1] })),
  };
};
