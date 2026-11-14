/**
 * The earned Orbs as data (brand guide 2.1): what was finished decides which form is earned. Each is one flat color and
 * one silhouette built on a circle. A color names its token (the values are written once in `TOKEN`, as a canvas
 * palette, and a test holds them to `styles/tokens.css`); a style is the silhouette, which says the kind without the
 * color.
 */
export type FormHue = 'deepsky' | 'apricot' | 'lagoon' | 'indigo' | 'ochre' | 'sky' | 'plum' | 'rose' | 'haze' | 'hill';
export type FormStyle = 'disc' | 'lit' | 'orbit' | 'target1' | 'target2' | 'target3' | 'target4' | 'sunrise' | 'seven' | 'crescent' | 'open' | 'pale' | 'pale-ring' | 'disc-rings';
/** What a `Gem` carries. Anything that is not one of the family's own is drawn as the plain disc. */
export type GemHue = FormHue | (string & {});
export type GemStyle = FormStyle | (string & {});
export interface Gem {
  hue: GemHue;
  style: GemStyle;
  /** -1, 0 or 1: this Orb's own tint. 0 is the token, 1 its lighter tint, -1 its deeper shade. */
  shift: number;
  /** 0 to 7 on an earlier week: the days it counted. Kept with the Orb; the art does not draw it. */
  stars?: number;
}

/**
 * The token values the art is drawn from. An SVG that is rasterized onto a canvas cannot read CSS variables, so they are
 * written once here, each beside its token's name (the palette test reads `styles/tokens.css` and fails if one drifts).
 */
export const TOKEN = {
  '--deep-sky': '#0A6CA6', // brand-ok: form palette, --deep-sky
  '--apricot': '#FFB680', // brand-ok: form palette, --apricot
  '--t-easy': '#117A74', // brand-ok: form palette, --t-easy (Lagoon)
  '--t-lift': '#4A4FB0', // brand-ok: form palette, --t-lift (Indigo)
  '--t-cross': '#7D6210', // brand-ok: form palette, --t-cross (Ochre)
  '--sky': '#38B6F2', // brand-ok: form palette, --sky
  '--t-hard': '#7E3F8F', // brand-ok: form palette, --t-hard (Plum)
  '--t-fast': '#B23A5B', // brand-ok: form palette, --t-fast (Rose)
  '--haze': '#CBE8F8', // brand-ok: form palette, --haze
  '--hill-1': '#8FCDEE', // brand-ok: form palette, --hill-1 (the brand art's pale sky blue)
  '--paper': '#FFFDF8', // brand-ok: form palette, --paper (the ground a tint is measured on, never drawn)
  '--night-ink': '#0E2236', // brand-ok: form palette, --night-ink (the one-color print, never an earned form's color)
} as const;
export type TokenName = keyof typeof TOKEN;

/** A form's color, by name. The second color a form may carry (a horizon, a pale disc's edge) is always Deep Sky. */
export const HUES: Record<FormHue, TokenName> = {
  deepsky: '--deep-sky',
  apricot: '--apricot',
  lagoon: '--t-easy',
  indigo: '--t-lift',
  ochre: '--t-cross',
  sky: '--sky',
  plum: '--t-hard',
  rose: '--t-fast',
  haze: '--haze',
  hill: '--hill-1',
};
export const LINE: TokenName = '--deep-sky';

interface Kind {
  hue: FormHue;
  style: FormStyle;
  name: string;
}
/** Every key the engine pays under, and the three that earlier weeks fuse into. A once-key matches by its prefix. */
const KINDS: ReadonlyArray<readonly [string, Kind]> = [
  ['todo', { hue: 'deepsky', style: 'disc', name: 'A to-do' }],
  ['habit', { hue: 'apricot', style: 'lit', name: 'A habit' }],
  ['train:run', { hue: 'lagoon', style: 'orbit', name: 'A run' }],
  ['train:lift', { hue: 'indigo', style: 'orbit', name: 'A lift' }],
  ['train:cross', { hue: 'ochre', style: 'orbit', name: 'Cross-training' }],
  ['goal:day', { hue: 'sky', style: 'target1', name: 'Today’s goal' }],
  ['goal:week', { hue: 'sky', style: 'target2', name: 'A week goal' }],
  ['goal:month', { hue: 'sky', style: 'target3', name: 'A month goal' }],
  ['goal:year', { hue: 'sky', style: 'target4', name: 'A year goal' }],
  ['full', { hue: 'apricot', style: 'sunrise', name: 'A full day' }],
  ['week', { hue: 'deepsky', style: 'seven', name: 'A week that counts' }],
  ['challenge', { hue: 'plum', style: 'crescent', name: 'A challenge' }],
  ['back', { hue: 'rose', style: 'open', name: 'Good to see you' }],
  ['fused:week', { hue: 'haze', style: 'pale', name: 'An earlier week' }],
  ['fused:chapter', { hue: 'hill', style: 'pale-ring', name: 'An earlier chapter' }],
  ['fused:year', { hue: 'deepsky', style: 'disc-rings', name: 'An earlier year' }],
];
/** A key nothing here knows is drawn as the plainest form there is, and named as an Orb. */
const UNKNOWN: Kind = { hue: 'deepsky', style: 'disc', name: 'An Orb' };
export const kindOf = (key: string): Kind => {
  for (const [k, kind] of KINDS) if (key === k || key.startsWith(`${k}:`)) return kind;
  return UNKNOWN;
};
/** The keys of the table, in its order (the sheet of every form, the tests). */
export const GEM_KEYS: readonly string[] = KINDS.map(([k]) => k);

/**
 * An Orb's own tint comes in three steps, so a pile of forty habits is not forty identical discs and a canvas still
 * draws them from three sprites. A tint is the same color lighter or deeper (`toneOf` in color.ts), never a hue turn.
 */
export const SHIFTS = [-1, 0, 1] as const;
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
const FUSED: readonly FormStyle[] = ['pale', 'pale-ring', 'disc-rings'];

/**
 * `key` is a day kind (`todo`, `habit`, `train:run`, ..., `full`, `back`), a once-key (`week:<monday>`,
 * `goal:month:<p>`, `challenge:d:<date>`), or `fused:week` | `fused:chapter` | `fused:year`. `seed` makes the tint
 * (kind + date + index); without one the Orb is its kind's own token.
 */
export const gemFor = (key: string, seed?: string, opts?: { stars?: number }): Gem => {
  const kind = kindOf(key);
  const gem: Gem = { hue: kind.hue, style: kind.style, shift: seed ? SHIFTS[hash(`${key}|${seed}`) % SHIFTS.length]! : 0 };
  if (FUSED.includes(kind.style)) gem.stars = Math.max(0, Math.min(7, Math.round(opts?.stars ?? 7)));
  return gem;
};
/** "A habit", "A to-do", "A run", "Today's goal", "A month goal", "A full day", "A week that counts", "A challenge", "Good to see you", "An earlier week". */
export const gemName = (key: string): string => kindOf(key).name;
