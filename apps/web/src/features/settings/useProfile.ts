import { monthsBetween, shiftDays, today } from '@logbook/shared';
import { useMemo, useState } from 'react';
import { useBootstrap, useMonths } from '@/api/queries';
import { currentBlock, deriveProfile, loadProfile, saveProfile, type TrainingProfile } from '@/features/onboarding/model';

/**
 * The athlete's training answers (goal, race, days, long run, volume). The answers the athlete last gave on this device win
 * while they are newer than the current block; otherwise they are read back out of the plan itself.
 */
export const useTrainingProfile = () => {
  const boot = useBootstrap();
  const uid = boot.data?.user.id;
  const t = today();
  const block = currentBlock(boot.data?.blocks ?? [], t);
  const months = block ? monthsBetween(block.start, shiftDays(block.start, 27)) : [];
  const { bundles, ready } = useMonths(months);
  const [ver, setVer] = useState(0);
  const stored = useMemo(() => loadProfile(uid), [uid, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const derived = useMemo(() => deriveProfile(block, Object.values(bundles).flatMap((b) => b.sessions)), [block, bundles]);
  // a block made after the last answers (a new block from Plan) speaks for itself
  const fresh = stored && (!block || !stored.savedAt || new Date(block.createdAt).getTime() <= new Date(stored.savedAt).getTime() + 10_000);
  const profile: TrainingProfile = fresh && stored ? stored : derived;
  return {
    profile,
    block,
    loaded: !!boot.data && (!!fresh || !block || ready),
    /** The answers came from this device, not read back from the plan. */
    stored: !!fresh,
    save: (p: TrainingProfile) => {
      saveProfile(uid, p);
      setVer((v) => v + 1);
    },
  };
};
