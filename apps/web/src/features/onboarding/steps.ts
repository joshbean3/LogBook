/**
 * Which questions first run asks, and what the nudge step does on Next: pure, so the rules are tested without a phone.
 */
export type Step = '' | 'name' | 'goal' | 'days' | 'morning' | 'habits' | 'nudge' | 'tour' | 'ready';

/**
 * The questions in order. The nudge step only where a nudge can be sent (the iOS app) and never in a replay of setup,
 * which changes nothing (settings-39). No running plan skips the run questions (days and the morning, onboarding-09).
 */
export const questionsFor = ({ native, replaying, noPlan }: { native: boolean; replaying: boolean; noPlan: boolean }): Step[] => [
  'name',
  'goal',
  ...(noPlan ? [] : (['days', 'morning'] as Step[])),
  'habits',
  ...(native && !replaying ? (['nudge'] as Step[]) : []),
  'tour',
];

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
