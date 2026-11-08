/**
 * The training phase of each week of a block (docs/inspiration.md §6 Plan: "a band underneath for the training phase:
 * base, build, taper, race week"). Blocks do not store their phases, so they are read from the block's own shape, the
 * way the template builds it (packages/shared/src/templates.ts): volume climbs, every 4th week drops, the weeks after the
 * last big week taper to race week.
 *
 * - race week: the block's last week, when the block ends with a race
 * - taper: the weeks between the last biggest week and race week (a down week before the taper stays a down week)
 * - peak: the biggest weeks just before the taper (or the end), within 5% of the biggest, in the block's second half
 * - base: the first third of the climb, and every week of a base block
 * - build: the rest
 * A down week (a drop of 10% or more that the next week climbs back from) keeps its phase and is flagged `down`.
 */
export type TrainingPhase = 'base' | 'build' | 'peak' | 'taper' | 'race';

export interface PhaseWeek {
  phase: TrainingPhase;
  down: boolean;
}

export const PHASE_WORDS: Record<TrainingPhase, string> = { base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper', race: 'Race week' };

export const phasesOf = (planned: number[], opts: { race: boolean; base: boolean }): PhaseWeek[] => {
  const n = planned.length;
  if (!n) return [];
  const raceIdx = opts.race && n > 1 ? n - 1 : -1;
  // race week carries the race's miles: climbing "back" into it is not the end of a down week
  const lastClimb = raceIdx >= 0 ? raceIdx - 1 : n - 1;
  const down = planned.map((v, i) => i > 0 && i < lastClimb && v < planned[i - 1]! * 0.9 && planned[i + 1]! > v);
  if (opts.base) return planned.map((_, i) => ({ phase: 'base', down: down[i]! }));
  const climb = raceIdx >= 0 ? planned.slice(0, raceIdx) : planned;
  const peak = Math.max(0, ...climb);
  // the last week at the top: where the climb ends
  let top = -1;
  climb.forEach((v, i) => {
    if (v === peak && peak > 0) top = i;
  });
  const out: PhaseWeek[] = planned.map((_, i) => ({ phase: 'build', down: down[i]! }));
  if (raceIdx >= 0) out[raceIdx] = { phase: 'race', down: false };
  if (top < 0) return out.map((w, i) => (i === raceIdx ? w : { ...w, phase: i < Math.ceil(n / 3) ? 'base' : 'build' }));
  // the taper: after the top, before race week, not a down week the climb comes back from
  if (raceIdx >= 0) for (let i = top + 1; i < raceIdx; i++) if (!down[i]) out[i] = { phase: 'taper', down: false };
  // the peak: the top and the big weeks right before it (in the second half), never a down week
  const half = Math.floor(climb.length / 2);
  for (let i = top; i >= Math.max(half, top - 2); i--) {
    if (down[i] || planned[i]! < peak * 0.95) break;
    out[i] = { phase: 'peak', down: false };
  }
  // the base: the first third of the climb up to the peak
  const firstPeak = out.findIndex((w) => w.phase === 'peak');
  const climbLen = firstPeak >= 0 ? firstPeak : top + 1;
  const baseN = Math.max(1, Math.round(climbLen / 3));
  for (let i = 0; i < Math.min(baseN, climbLen); i++) if (out[i]!.phase === 'build') out[i] = { ...out[i]!, phase: 'base' };
  return out;
};
