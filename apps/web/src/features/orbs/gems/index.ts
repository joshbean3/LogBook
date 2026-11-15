/**
 * The earned Orbs (brand guide 2.1): the logo's Orb at one of five rungs (Sky, Dawn, Glow, Sunrise, Sun). What was
 * finished decides the rung. Here: which rung a key earns, its art, its names and the component that draws it. The
 * oculus (`features/orbs/dome`) draws the same art on a canvas from `gemSvg` and `gemBox`.
 */
export { gemFor, gemName, GEM_KEYS, LADDER, rungName, rungOf } from './table';
export type { Gem, Rung } from './table';
export { RUNGS } from './recipe';
export { gemBox, gemSvg, gemUrl } from './svg';
export { OrbGem } from './OrbGem';
