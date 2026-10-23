import type { Transition } from 'motion/react';

/**
 * A spring (mass 1) integrated in 1 ms RK4 steps: the same physics motion runs for `springs.*`, for the places that need
 * its state at a given time (the pager's own release, the push's first frames). WP1-internal.
 */
export interface SpringP {
  k: number;
  c: number;
  rd: number;
  rs: number;
}
export const springParams = (t: Transition): SpringP => {
  const s = t as { stiffness: number; damping: number; restDelta?: number; restSpeed?: number };
  return { k: s.stiffness, c: s.damping, rd: s.restDelta ?? 1, rs: s.restSpeed ?? 30 };
};
/** Advance (pos, vel) toward `to` by `dt` seconds. */
export const springAdvance = (p: SpringP, pos: number, vel: number, to: number, dt: number) => {
  const a = (x: number, v: number) => -p.k * (x - to) - p.c * v;
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(0.001, left);
    left -= h;
    const k1x = vel;
    const k1v = a(pos, vel);
    const k2x = vel + (k1v * h) / 2;
    const k2v = a(pos + (k1x * h) / 2, vel + (k1v * h) / 2);
    const k3x = vel + (k2v * h) / 2;
    const k3v = a(pos + (k2x * h) / 2, vel + (k2v * h) / 2);
    const k4x = vel + k3v * h;
    const k4v = a(pos + k3x * h, vel + k3v * h);
    pos += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    vel += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return [pos, vel] as const;
};
