/**
 * Which questions first run asks, and what the nudge step does on Next: pure, so the rules are tested without a phone.
 */
export type Step = '' | 'name' | 'fitness' | 'goal' | 'days' | 'morning' | 'habits' | 'nudge' | 'tour' | 'ready';

/**
 * The questions in order. The nudge step only where a nudge can be sent (the iOS app) and never in a replay of setup,
 * which changes nothing (settings-39). No running plan skips the run questions (days and the morning, onboarding-09).
 * The Fitness question comes right after the name, where the training questions begin: "No" (`fitness: false`) skips
 * every one of them (the goal, the days, the morning).
 *
 * The tour is not a question and is not in the path: the last question's Next goes to `ready` (the plan being written,
 * then the reveal), and the reveal's quiet link opens the tour. The step id `tour` stays (the route /welcome/tour and
 * drafts saved by an earlier build), and `afterTour` says where it leads.
 */
export const questionsFor = ({ native, replaying, noPlan, fitness = true }: { native: boolean; replaying: boolean; noPlan: boolean; fitness?: boolean }): Step[] => [
  'name',
  'fitness',
  ...(fitness ? (['goal'] as Step[]) : []),
  ...(noPlan || !fitness ? [] : (['days', 'morning'] as Step[])),
  'habits',
  ...(native && !replaying ? (['nudge'] as Step[]) : []),
];

/**
 * Where /welcome/tour leads. Once setup is saved (or in a replay, which saves nothing) the tour opens, and it ends on the
 * reveal it was opened from. Before that there is no reveal to come back to: an old draft that was on the tour, or a link
 * straight to it, goes on to `ready`, which writes the plan and reveals it.
 */
export const tourOpens = ({ replaying, saved }: { replaying: boolean; saved: boolean }): boolean => replaying || saved;
/** The step a draft saved on `tour` (an earlier build's last question) opens on now. */
export const resumeStep = (saved: Step | undefined, order: readonly Step[]): Step => (saved && order.includes(saved) ? saved : saved === 'tour' ? 'ready' : 'name');

/**
 * Next on the nudge step (onboarding-14, settings-39): with the nudge on, ask the phone and wait for its answer before
 * moving on (a decline is an answer, never an error); with it off, or in a replay, nothing is asked at all.
 */
export const nudgeNext = async ({ on, replaying, enable }: { on: boolean; replaying: boolean; enable: () => Promise<boolean> }): Promise<boolean> => {
  if (!on || replaying) return false;
  try {
    return await enable();
  } catch {
    return false;
  }
};
