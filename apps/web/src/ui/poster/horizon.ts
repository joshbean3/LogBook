/**
 * The horizon's geometry: the landscape the training card (features/day/HeroHorizon.tsx, the hero spec 4.1 and 4.2) and the
 * day poster (PosterScene) both draw, in one 358 x 88 viewBox. Pure numbers and path strings, no React, so both drawings
 * and their tests read the same values. `features/day/heroWeek.ts` re-exports the names it always had.
 */

import { unit } from './logic';

type Pt = readonly [number, number];

/** One session (or to-do) on the horizon. */
export interface HorizonMark {
  /** Where it sits along the way, 0 to 1: its center is at x = 38 + 282 x share (`markX`). */
  share: number;
  /** Done: a disc. Not done: a ring. */
  lit: boolean;
  /** Lit and within 25 of the sun's center: not drawn. */
  inSun: boolean;
}

/** The sun's way: its center at rest (x0, yH) and with the count met (x1, yTop). */
export const HZ = { x0: 38, x1: 320, yH: 63, yTop: 22, W: 282, D: 41 } as const;
/** The near hill's crest (the horizon), as cubic Bézier segments [p0, c1, c2, p1]: `M 0 69 C 40 62 86 56 138 59 C 198 63 250 72 300 70 C 325 69 345 66 358 64`. */
export const NEAR_CREST: readonly (readonly [Pt, Pt, Pt, Pt])[] = [
  [[0, 69], [40, 62], [86, 56], [138, 59]],
  [[138, 59], [198, 63], [250, 72], [300, 70]],
  [[300, 70], [325, 69], [345, 66], [358, 64]],
];
/**
 * The sun's center at fraction `f`: straight across, and up a parabola whose top is the full count. `f` is held between 0
 * and 1 here and in `sunDx` / `sunDy`, and a value that is not a number is 0, so no drawing can be handed a NaN.
 */
export const sunAt = (f: number): [number, number] => {
  const u = unit(f);
  return [HZ.x0 + HZ.W * u, HZ.yTop + HZ.D * (1 - u) * (1 - u)];
};
/** A mark's center x from its share. */
export const markX = (share: number): number => HZ.x0 + HZ.W * share;
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
};
/** The horizon's height at x (each segment's x rises with t, so t is found by halving). */
export const crestY = (x: number): number => {
  const seg = NEAR_CREST.find((s) => x <= s[3][0]) ?? NEAR_CREST[NEAR_CREST.length - 1]!;
  const [p0, c1, c2, p1] = seg;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const t = (lo + hi) / 2;
    if (bez(p0[0], c1[0], c2[0], p1[0], t) < x) lo = t;
    else hi = t;
  }
  return bez(p0[1], c1[1], c2[1], p1[1], (lo + hi) / 2);
};
/** Marks past this many are not drawn: the band carries the count. */
export const MAX_MARKS = 10;
/** The first mark's center is never left of this (clear of the resting sun), and each next is this far right of the last. */
const FIRST_X = 70;
const MARK_GAP = 14;
/** A lit mark this close to the sun's center (the sun's 15 and its 3.5 keyline, the mark's 4.5, and 2 to spare) is in the sun. */
const IN_SUN = 25;

/**
 * The marks of a count (spec 6.5): one per session (`max(planned, done)`), evenly spread along the way, then pushed right
 * where they would crowd: the first never left of 70, each next at least 14 past the one before. The first `done` are lit.
 * Evenly spread, the sun (at done over planned) always stands halfway between the last lit mark and the next open one.
 */
export const marksOf = (c: { planned: number; done: number }, f: number): HorizonMark[] => {
  const n = Math.max(c.planned, c.done);
  // more than the horizon holds, or a count that is not a count (NaN, a negative, no end): no marks
  if (!(n >= 0 && n <= MAX_MARKS)) return [];
  const [sx, sy] = sunAt(f);
  let last = FIRST_X - MARK_GAP;
  return Array.from({ length: n }, (_, i) => {
    const x = Math.max(markX((i + 0.5) / n), last + MARK_GAP);
    last = x;
    const lit = i < c.done;
    return { share: (x - HZ.x0) / HZ.W, lit, inSun: lit && Math.hypot(x - sx, crestY(x) - sy) < IN_SUN };
  });
};

// ---------- the fixed drawing ----------

/** The drawing's viewBox. */
export const VB_W = 358;
export const VB_H = 88;
/** A crest's segments as an open SVG path. */
export const crestPath = (segs: readonly (readonly [Pt, Pt, Pt, Pt])[]): string => `M ${segs[0]![0].join(' ')} ` + segs.map(([, c1, c2, p1]) => `C ${c1.join(' ')} ${c2.join(' ')} ${p1.join(' ')}`).join(' ');
/** The three crests, near to far (the far hill is the band's ground). */
export const NEAR = crestPath(NEAR_CREST);
export const MIDDLE = 'M 0 81 C 60 82 120 80.5 180 77.5 C 235 75 300 76.5 358 80';
export const FAR = 'M 0 78 C 70 76 140 79 205 82.5 C 260 85.5 315 85 358 82.5';
/** A crest closed down to the drawing's floor: the hill's fill. */
export const closed = (crest: string): string => `${crest} L ${VB_W} ${VB_H} L 0 ${VB_H} Z`;
/** Everything above the horizon: the clip the sun, its light and the way are drawn in. */
export const SKY = `${NEAR} L ${VB_W} -90 L 0 -90 Z`;
/** The sun's radius, its Paper keyline, and a mark's radius. */
export const SUN_R = 15;
export const KEY = 3.5;
export const MARK_R = 4.5;
/** The way's dots: one every 7 along the parabola, never past 301 (clear of the sun's place). */
export const WAY: readonly { x: number; y: number }[] = Array.from({ length: 40 }, (_, i) => {
  const x = HZ.x0 + 7 * (i + 1);
  const u = (x - HZ.x0) / HZ.W;
  return { x, y: HZ.yTop + HZ.D * (1 - u) * (1 - u) };
}).filter((d) => d.x <= 301);
/** The sun's offset from its resting place (38, 63) at fraction f, as a translate. */
export const sunDx = (f: number): number => HZ.W * unit(f);
export const sunDy = (f: number): number => HZ.D * (1 - unit(f)) * (1 - unit(f)) - HZ.D;
/** The way still to go with the sun at `f`: the dots from the sun onward, never within 11 of a drawn mark. */
export const wayAhead = (f: number, marks: readonly HorizonMark[] = []): { x: number; y: number }[] => {
  const [sx] = sunAt(f);
  const at = marks.filter((m) => !m.inSun).map((m) => [markX(m.share), crestY(markX(m.share))] as const);
  return WAY.filter((d) => d.x >= sx + 25.5 && !at.some(([mx, my]) => Math.hypot(mx - d.x, my - d.y) < 11));
};
