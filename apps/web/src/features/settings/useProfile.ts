import { mondayOf, monthsBetween, shiftDays, today } from '@logbook/shared';
import { useEffect, useMemo, useRef } from 'react';
import { useBootstrap, useMonths, useSaveTraining } from '@/api/queries';
import { currentBlock, DEFAULT_PROFILE, deriveThisWeek, takeLegacyProfile, type TrainingProfile } from '@/features/onboarding/model';

/**
 * Where the training rows come from (critic B6: never a value the athlete neither set nor can see in Plan):
 * - `stored`: the answers kept on the account (`user.trainingProfile`), while they are at least as new as the current block;
 * - `block`: no answers (or a newer block made in Plan): read from the active block as it stands this week;
 * - `none`: no answers and no plan. The rows say so instead of showing defaults.
 */
export type ProfileSource = 'stored' | 'block' | 'none';

/**
 * The athlete's training answers (goal, race, days, long run, volume). Onboarding writes them; Settings edits them (a
 * Rebuild saves them with PATCH /me/training).
 */
export const useTrainingProfile = () => {
  const boot = useBootstrap();
  const saveTraining = useSaveTraining();
  const uid = boot.data?.user.id;
  const t = today();
  const block = currentBlock(boot.data?.blocks ?? [], t);
  // this week (or the block's first, when it is still ahead), and the weeks after it in case this one is empty
  const from = block ? (block.start > t ? block.start : mondayOf(t)) : t;
  const months = block ? monthsBetween(from, shiftDays(from, 27)) : [];
  const { bundles, ready } = useMonths(months);
  const stored = boot.data?.user.trainingProfile ?? null;
  const derived = useMemo(() => deriveThisWeek(block, Object.values(bundles).flatMap((b) => b.sessions), t), [block, bundles, t]);
  const fresh = !!stored && (!block || new Date(block.createdAt).getTime() <= new Date(stored.updatedAt).getTime() + 10_000);
  const source: ProfileSource = fresh ? 'stored' : derived ? 'block' : 'none';
  // `none` still needs a starting point for the editor: the editor says it is a new plan, not the current one
  const profile: TrainingProfile = fresh && stored ? stored : (derived ?? { ...DEFAULT_PROFILE });

  // answers an earlier build kept on this device go to the account once, when the account has none
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current || !boot.data || stored || !uid) return;
    moved.current = true;
    const legacy = takeLegacyProfile(uid);
    if (legacy) saveTraining.mutate({ goal: legacy.goal, raceDate: legacy.raceDate ?? null, runDays: legacy.runDays, longRunDay: legacy.longRunDay, weeklyMiles: legacy.weeklyMiles });
  }, [boot.data, stored, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    profile,
    block,
    source,
    loaded: !!boot.data && (fresh || !block || ready),
    /** The answers came from the account, not read back from the plan. */
    stored: fresh,
    save: (p: TrainingProfile, opts?: { onSuccess?: () => void }) =>
      saveTraining.mutate({ goal: p.goal, raceDate: p.goal === 'base' ? null : p.raceDate, runDays: p.runDays, longRunDay: p.longRunDay, weeklyMiles: p.weeklyMiles }, opts),
  };
};
