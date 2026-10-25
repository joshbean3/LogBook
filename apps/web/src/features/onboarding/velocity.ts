import { POP_COMMIT_FRAC, POP_COMMIT_V } from '@/lib/gesture';

/**
 * A release's velocity (px/s) from the pointer's own samples ([x, event timeStamp]): the moves within 150 ms of the
 * release, and none at all when the last move is more than 80 ms old (the finger had stopped). Event timestamps, so a busy
 * main thread at release does not turn a flick into a stop, nor a held finger into a flick (review 2 code N3).
 */
export const releaseVelocity = (samples: ReadonlyArray<readonly [number, number]>, at: number): number => {
  const recent = samples.filter(([, t]) => at - t <= 150);
  const last = recent.at(-1);
  const first = recent[0];
  if (!last || !first || recent.length < 2 || at - last[1] > 80 || last[1] <= first[1]) return 0;
  return ((last[0] - first[0]) / (last[1] - first[1])) * 1000;
};

/**
 * Whether an edge swipe's release goes back (docs/feel.md §9.3, as PushedLayer): past 35 % of the width or a flick of more
 * than 300 px/s, and never while the finger is going back toward the edge (v ≥ 0; review 3 code N3), nor on a system cancel.
 */
export const commitsBack = (x: number, w: number, v: number, cancelled: boolean): boolean => !cancelled && v >= 0 && (x > w * POP_COMMIT_FRAC || v > POP_COMMIT_V);
