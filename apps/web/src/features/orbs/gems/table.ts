/**
 * The Orb family as data (brand guide 2.1): what was finished decides which Orb is earned. Each hue names the tokens it
 * is made from (their values are written once in `TOKEN`, as a canvas palette, and a test holds them to
 * `styles/tokens.css`); each style is a mark on the sphere that says the kind without the hue.
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

/**
 * The token values the art is drawn from. An SVG that is rasterized onto a canvas cannot read CSS variables, so they are
 * written once here, each beside its token's name (`palette.test.ts` reads `styles/tokens.css` and fails if one drifts).
 */
export const TOKEN = {
  '--t-easy': '#117A74', // brand-ok: gem palette, --t-easy (Lagoon)
  '--apricot': '#FFB680', // brand-ok: gem palette, --apricot
  '--deep-sky': '#0A6CA6', // brand-ok: gem palette, --deep-sky
  '--t-lift': '#4A4FB0', // brand-ok: gem palette, --t-lift (Indigo)
  '--t-cross': '#7D6210', // brand-ok: gem palette, --t-cross (Ochre)
  '--warn': '#E0A21B', // brand-ok: gem palette, --warn (Marigold)
  '--paper': '#FFFDF8', // brand-ok: gem palette, --paper
  '--haze': '#CBE8F8', // brand-ok: gem palette, --haze
  '--t-hard': '#7E3F8F', // brand-ok: gem palette, --t-hard (Plum)
  '--t-fast': '#B23A5B', // brand-ok: gem palette, --t-fast (Rose)
  '--twilight': '#1B4870', // brand-ok: gem palette, --twilight
  '--night-ink': '#0E2236', // brand-ok: gem palette, --night-ink
  '--sky': '#38B6F2', // brand-ok: gem palette, --sky (the logo's body: never an earned Orb's, kept here to be tested against)
} as const;
export type TokenName = keyof typeof TOKEN;

/**
 * How a hue is made from its tokens.
 *   body   the sphere's own color (the middle of its gradient), or two tokens and how far from the first to the second
 *   deep   where the sphere goes toward its edge, when that is a token of its own (Night goes to Night Ink)
 *   warm   0 to 1: how far the Apricot underlight moves toward Paper, so it still shows on a body that is itself warm
 *   lift   how much lighter than its token the middle of the sphere is drawn (the deep text tokens need air to read as glass)
 */
export interface HueSpec {
  body: TokenName | readonly [TokenName, TokenName, number];
  deep?: TokenName;
  warm: number;
  lift: number;
}
export const HUES: Record<GemHue, HueSpec> = {
  lagoon: { body: '--t-easy', warm: 0, lift: 0.1 },
  apricot: { body: '--apricot', warm: 0.75, lift: 0 },
  deepsky: { body: '--deep-sky', warm: 0, lift: 0.04 },
  indigo: { body: '--t-lift', warm: 0, lift: 0.06 },
  ochre: { body: '--t-cross', warm: 0.35, lift: 0.1 },
  gold: { body: '--warn', warm: 0.6, lift: 0.03 },
  pearl: { body: ['--paper', '--haze', 0.5], deep: '--haze', warm: 0.3, lift: 0 },
  dusk: { body: '--twilight', warm: 0, lift: 0.08 },
  plum: { body: '--t-hard', warm: 0.1, lift: 0.08 },
  rose: { body: '--t-fast', warm: 0.3, lift: 0.08 },
  night: { body: ['--twilight', '--night-ink', 0.3], deep: '--night-ink', warm: 0, lift: 0 },
};

interface Kind {
  hue: GemHue;
  style: GemStyle;
  name: string;
}
/** Every key the engine pays under, and the three the dome fuses earlier weeks into. A once-key matches by its prefix. */
const KINDS: ReadonlyArray<readonly [string, Kind]> = [
  ['todo', { hue: 'lagoon', style: 'plain', name: 'A to-do' }],
  ['habit', { hue: 'apricot', style: 'plain', name: 'A habit' }],
  ['train:run', { hue: 'deepsky', style: 'plain', name: 'A run' }],
  ['train:lift', { hue: 'indigo', style: 'plain', name: 'A lift' }],
  ['train:cross', { hue: 'ochre', style: 'plain', name: 'Cross-training' }],
  ['goal:day', { hue: 'gold', style: 'ring1', name: 'Today’s goal' }],
  ['goal:week', { hue: 'gold', style: 'ring1', name: 'A week goal' }],
  ['goal:month', { hue: 'gold', style: 'ring2', name: 'A month goal' }],
  ['goal:year', { hue: 'gold', style: 'ring3', name: 'A year goal' }],
  ['full', { hue: 'pearl', style: 'plain', name: 'A full day' }],
  ['week', { hue: 'dusk', style: 'banded', name: 'A week that counts' }],
  ['challenge', { hue: 'plum', style: 'half', name: 'A challenge' }],
  ['back', { hue: 'rose', style: 'plain', name: 'Good to see you' }],
  ['fused:week', { hue: 'night', style: 'starred', name: 'An earlier week' }],
  ['fused:chapter', { hue: 'night', style: 'starred-ring1', name: 'An earlier chapter' }],
  ['fused:year', { hue: 'night', style: 'starred-ring2', name: 'An earlier year' }],
];
/** A key nothing here knows is drawn as the plainest Orb there is, and named as one. */
const UNKNOWN: Kind = { hue: 'apricot', style: 'plain', name: 'An Orb' };
export const kindOf = (key: string): Kind => {
  for (const [k, kind] of KINDS) if (key === k || key.startsWith(`${k}:`)) return kind;
  return UNKNOWN;
};
/** The keys of the table, in its order (the sheet of every Orb, the tests). */
export const GEM_KEYS: readonly string[] = KINDS.map(([k]) => k);

/**
 * An Orb's own shift comes in five steps, so a pile of forty habits is not forty identical discs and a canvas still
 * draws them from five sprites. Each step turns the hue a little and moves the lightness a little, and the two do not
 * move together.
 */
export const SHIFTS = [-1, -0.5, 0, 0.5, 1] as const;
/** The most a shift turns the hue (degrees) and moves the lightness (of 1). Small: a habit never reads as a goal. */
export const SHIFT = { hue: 7, light: 0.03 } as const;
/** The lightness part of each step, out of step with the hue part: -1 is a touch lighter, -0.5 the deepest, and so on. */
export const lightOf = (shift: number): number => {
  const i = SHIFTS.indexOf(shift as (typeof SHIFTS)[number]);
  return ([0.5, -1, 0, 1, -0.5][i] ?? 0) * SHIFT.light;
};
const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // one more stir, so seeds that differ only in their last character spread
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return h >>> 0;
};
const STARRED: readonly GemStyle[] = ['starred', 'starred-ring1', 'starred-ring2'];
export const isStarred = (style: GemStyle): boolean => STARRED.includes(style);

/**
 * `key` is a day kind (`todo`, `habit`, `train:run`, ..., `full`, `back`), a once-key (`week:<monday>`,
 * `goal:month:<p>`, `challenge:d:<date>`), or `fused:week` | `fused:chapter` | `fused:year`. `seed` makes the shift
 * (kind + date + index); without one the Orb is its kind's own, unshifted.
 */
export const gemFor = (key: string, seed?: string, opts?: { stars?: number }): Gem => {
  const kind = kindOf(key);
  const gem: Gem = { hue: kind.hue, style: kind.style, shift: seed ? SHIFTS[hash(`${key}|${seed}`) % SHIFTS.length]! : 0 };
  if (isStarred(kind.style)) gem.stars = Math.max(0, Math.min(7, Math.round(opts?.stars ?? 7)));
  return gem;
};
/** "A habit", "A to-do", "A run", "Today's goal", "A month goal", "A full day", "A week that counts", "A challenge", "Good to see you", "An earlier week". */
export const gemName = (key: string): string => kindOf(key).name;
