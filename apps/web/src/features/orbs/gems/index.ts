/**
 * The Orb family (brand guide 2.1): which Orb a finished thing earns, its art, its name and the component that draws it.
 * The dome (`features/orbs/dome`) draws the same art on a canvas from `gemUrl` and `gemBox`.
 */
export { gemFor, gemName, GEM_KEYS } from './table';
export type { Gem, GemHue, GemStyle } from './table';
export { gemBox, gemSvg, gemUrl } from './svg';
export { OrbGem } from './OrbGem';
