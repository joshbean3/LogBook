import { monthOf } from '@logbook/shared';
import { useMemo } from 'react';
import { useBootstrap, useMonths } from '@/api/queries';
import { useSnapshot } from '@/api/snapshot';
import { useToday } from '@/lib/useToday';

/** Everything a view needs to grade and show a set of dates. Pass the months you want in view. */
export const useLog = (months: string[]) => {
  const t = useToday();
  const boot = useBootstrap();
  const list = useMemo(() => [...new Set([...months, monthOf(t)])].sort(), [months.join(','), t]); // eslint-disable-line react-hooks/exhaustive-deps
  const { bundles, ready, loading } = useMonths(list);
  const pace = boot.data?.morningSettings?.run?.pace ?? null;
  const snap = useSnapshot(bundles, t, pace);
  return {
    today: t,
    boot: boot.data ?? null,
    habits: (boot.data?.habits ?? []).filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position),
    zones: boot.data?.zones ?? null,
    features: boot.data?.features ?? { claude: false, strava: false },
    strava: boot.data?.strava ?? null,
    snap,
    ready,
    loading,
    loaded: (date: string) => snap.loaded(monthOf(date)),
  };
};
export type Log = ReturnType<typeof useLog>;
