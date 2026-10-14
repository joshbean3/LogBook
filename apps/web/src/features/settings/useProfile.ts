import { monthsBetween, shiftDays, today } from '@logbook/shared';
import { useEffect, useMemo, useRef } from 'react';
import { useBootstrap, useMonths, useSaveTraining } from '@/api/queries';
import { currentBlock, deriveProfile, takeLegacyProfile, type TrainingProfile } from '@/features/onboarding/model';

/**
 * The athlete's training answers (goal, race, days, long run, volume), kept on the account (`user.trainingProfile` in the
 * bootstrap; onboarding writes them, `save` sends PATCH /me/training). They win while they are newer than the current
 * block; a block made after them (a new block from Plan) speaks for itself, read back out of the plan.
 */
export const useTrainingProfile = () => {
  const boot = useBootstrap();
  const saveTraining = useSaveTraining();
  const uid = boot.data?.user.id;
  const t = today();
  const block = currentBlock(boot.data?.blocks ?? [], t);
  const months = block ? monthsBetween(block.start, shiftDays(block.start, 27)) : [];
  const { bundles, ready } = useMonths(months);
  const stored = boot.data?.user.trainingProfile ?? null;
  const derived = useMemo(() => deriveProfile(block, Object.values(bundles).flatMap((b) => b.sessions)), [block, bundles]);
  const fresh = !!stored && (!block || new Date(block.createdAt).getTime() <= new Date(stored.updatedAt).getTime() + 10_000);
  const profile: TrainingProfile = fresh && stored ? stored : derived;

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
    loaded: !!boot.data && (fresh || !block || ready),
    /** The answers came from the account, not read back from the plan. */
    stored: fresh,
    save: (p: TrainingProfile) => saveTraining.mutate({ goal: p.goal, raceDate: p.goal === 'base' ? null : p.raceDate, runDays: p.runDays, longRunDay: p.longRunDay, weeklyMiles: p.weeklyMiles }),
  };
};
