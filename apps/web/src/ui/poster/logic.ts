/**
 * The poster kit's logic, apart from the drawing so a test can read it: the path's stop states and line segments, the
 * sun's progress, and where the week's lights sit on the dusk sky.
 */

/** A stop on the path. done: behind you. next: the one lit stop. ahead: still to come. add: the end of the line ("Add a to-do"). */
export type StopState = 'done' | 'next' | 'ahead' | 'add';
/** A stretch of the line: solid behind you, dotted ahead, or none (the line starts or ends at this stop). */
export type Segment = 'solid' | 'dots' | 'none';
/** The line into a stop (from the stop above, or from the band) and out of it. */
export interface StopSegments {
  in: Segment;
  out: Segment;
}

/**
 * Stop states from a list of done flags, in the order shown: every done item is 'done', the first open one is 'next', the
 * rest are 'ahead'. With everything done there is no 'next'.
 */
export const stopStates = (done: readonly boolean[]): StopState[] => {
  const next = done.indexOf(false);
  return done.map((d, i) => (d ? 'done' : i === next ? 'next' : 'ahead'));
};

/**
 * The line through a list of stops. A stretch between two stops is solid when the upper one is done and the lower one is
 * done or next (you have walked it); every other stretch is dotted. `lead` (default true): the line starts at the edge
 * above the first stop (the poster's band), solid when the first stop is done. The line ends at the last stop.
 */
export const pathSegments = (states: readonly StopState[], { lead = true }: { lead?: boolean } = {}): StopSegments[] => {
  const between = (i: number): Segment => (states[i] === 'done' && (states[i + 1] === 'done' || states[i + 1] === 'next') ? 'solid' : 'dots');
  return states.map((s, i) => ({
    in: i === 0 ? (lead ? (s === 'done' ? 'solid' : 'dots') : 'none') : between(i - 1),
    out: i === states.length - 1 ? 'none' : between(i),
  }));
};

/** The sun's place from a count: done over total, 0 to 1. Nothing to count is 0 (the sun at rest on the horizon). */
export const sunProgress = (done: number, total: number): number => (total > 0 ? Math.min(1, Math.max(0, done / total)) : 0);

// ---------- the week's lights (the dusk scene), in a 358 x 156 drawing ----------

export const LIGHTS_W = 358;
export const LIGHTS_H = 156;
type Pt = readonly [number, number];

/** The lights' centers, first to last (tonight): evenly across from x 30 to 312, rising from y 96 to 46. */
export const lightPoints = (n: number): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const u = n > 1 ? i / (n - 1) : 1;
    return [30 + 282 * u, 96 - 50 * Math.pow(u, 1.3)] as const;
  });

/** Points every `step` along the smooth curve through `pts` (a Catmull-Rom spline): the dots of a way. */
export const waypoints = (pts: readonly Pt[], step: number): Pt[] => {
  if (pts.length < 2) return [];
  const out: Pt[] = [];
  const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
  let carry = 0;
  let prev: Pt | null = null;
  const at = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1]!, P[i]!, P[i + 1]!, P[i + 2]!];
    for (let k = 0; k <= 100; k++) {
      const t = k / 100;
      const p: Pt = [at(p0[0], p1[0], p2[0], p3[0], t), at(p0[1], p1[1], p2[1], p3[1], t)];
      if (prev) {
        carry += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
        if (carry >= step) {
          out.push(p);
          carry = 0;
        }
      }
      prev = p;
    }
  }
  return out;
};

/** How far the way's dots stay clear of a light: tonight lit (its rings), tonight waiting, a lit day, an unlit day. */
export const LIGHT_CLEAR = { tonightLit: 34, tonightWaiting: 22, lit: 16, unlit: 8 } as const;

/** The dots between the lights: the way through every light, clear of each one. `lit` has one flag per light before tonight. */
export const lightsWay = (lit: readonly boolean[], tonightLit: boolean): Pt[] => {
  const pts = lightPoints(lit.length + 1);
  const clear = (i: number) => (i === lit.length ? (tonightLit ? LIGHT_CLEAR.tonightLit : LIGHT_CLEAR.tonightWaiting) : lit[i] ? LIGHT_CLEAR.lit : LIGHT_CLEAR.unlit);
  return waypoints(pts, 7).filter(([x, y]) => !pts.some(([px, py], i) => Math.hypot(px - x, py - y) < clear(i)));
};
