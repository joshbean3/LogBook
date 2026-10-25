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
