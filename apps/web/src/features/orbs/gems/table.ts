import type { Rung } from './recipe';

/**
 * The ladder of earned Orbs as data (brand guide 2.1). An earned Orb is the logo's Orb, and what was finished decides
 * its rung: how rare the thing that earns it is. Nothing is random, so an Orb is as rare as its own cause.
 *
 *   1 Sky      a to-do, a habit                                       many a day
 *   2 Dawn     a session, today's goal, a full day, a return          about once a day
 *   3 Glow     a week that counts, a week goal, a challenge           about once a week
 *   4 Sunrise  a month goal                                           once a month at most
 *   5 Sun      a year goal                                            once a year at most
 *
 * The rung is not the worth: how many Orbs an award counts for comes from the rules (`RULES`, packages/shared).
 */
export type { Rung } from './recipe';
/** What a picture is drawn from. Two Orbs of a rung are the same picture, as two of a kind are. */
export interface Gem {
  rung: Rung;
}

interface Step {
  name: string;
  /** What earns it, for the legend. With Fitness off a session is not named. */
  earnedBy: (fitness: boolean) => string;
  often: string;
}
export const LADDER: Record<Rung, Step> = {
  1: { name: 'Sky', earnedBy: () => 'A to-do or a habit', often: 'Many a day' },
  2: { name: 'Dawn', earnedBy: (fitness) => (fitness ? 'A session, today’s goal or a full day' : 'Today’s goal or a full day'), often: 'About once a day' },
  3: { name: 'Glow', earnedBy: () => 'A week that counts, a week goal or a challenge', often: 'About once a week' },
  4: { name: 'Sunrise', earnedBy: () => 'A month goal', often: 'Once a month at most' },
  5: { name: 'Sun', earnedBy: () => 'A year goal', often: 'Once a year at most' },
};
/** "Sky", "Dawn", "Glow", "Sunrise", "Sun". */
export const rungName = (rung: Rung): string => LADDER[rung].name;

interface Kind {
  rung: Rung;
  name: string;
}
/** Every key the engine pays under, and the three that earlier weeks fuse into. A once-key matches by its prefix. */
const KINDS: ReadonlyArray<readonly [string, Kind]> = [
  ['todo', { rung: 1, name: 'A to-do' }],
  ['habit', { rung: 1, name: 'A habit' }],
  ['train:run', { rung: 2, name: 'A run' }],
  ['train:lift', { rung: 2, name: 'A lift' }],
  ['train:cross', { rung: 2, name: 'Cross-training' }],
  ['goal:day', { rung: 2, name: 'Today’s goal' }],
  ['full', { rung: 2, name: 'A full day' }],
  ['back', { rung: 2, name: 'Good to see you' }],
  ['week', { rung: 3, name: 'A week that counts' }],
  ['goal:week', { rung: 3, name: 'A week goal' }],
  ['challenge', { rung: 3, name: 'A challenge' }],
  ['goal:month', { rung: 4, name: 'A month goal' }],
  ['goal:year', { rung: 5, name: 'A year goal' }],
  ['fused:week', { rung: 1, name: 'An earlier week' }],
  ['fused:chapter', { rung: 1, name: 'An earlier chapter' }],
  ['fused:year', { rung: 1, name: 'An earlier year' }],
];
/** A key nothing here knows is the plainest Orb there is, and named as an Orb. A session of a kind not yet named is still a session. */
const UNKNOWN: Kind = { rung: 1, name: 'An Orb' };
const SESSION: Kind = { rung: 2, name: 'A session' };
const kindOf = (key: string): Kind => {
  for (const [k, kind] of KINDS) if (key === k || key.startsWith(`${k}:`)) return kind;
  return key === 'train' || key.startsWith('train:') ? SESSION : UNKNOWN;
};
/** The keys of the table, in the ladder's order (the gallery's sheet, the tests). */
export const GEM_KEYS: readonly string[] = KINDS.map(([k]) => k);

/**
 * The rung a key earns. `key` is a day kind (`todo`, `habit`, `train:run`, ..., `full`, `back`), a once-key
 * (`week:<monday>`, `goal:month:<p>`, `challenge:d:<date>`), or `fused:week` | `fused:chapter` | `fused:year`.
 */
export const rungOf = (key: string): Rung => kindOf(key).rung;

/**
 * The Orb a key earns. A fused Orb (earlier weeks as one) is a Sky Orb, and a Dawn Orb when what it holds counted
 * (`counted`). `seed` is taken and not used: there is no tint of an Orb's own, so two Sky Orbs are identical.
 */
export const gemFor = (key: string, _seed?: string, opts?: { counted?: boolean }): Gem => {
  const rung = rungOf(key);
  return { rung: opts?.counted && key.startsWith('fused:') && rung < 2 ? 2 : rung };
};
/** "A habit", "A to-do", "A run", "Today's goal", "A month goal", "A full day", "A week that counts", "A challenge", "Good to see you", "An earlier week". */
export const gemName = (key: string): string => kindOf(key).name;
