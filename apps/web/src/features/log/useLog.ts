import { monthOf } from '@logbook/shared';
import { useCallback, useMemo } from 'react';
import { useBootstrap, useMonths } from '@/api/queries';
import { useSnapshot } from '@/api/snapshot';
import { useToday } from '@/lib/useToday';

const NO_FEATURES = { claude: false, strava: false };

/**
 * Everything a view needs to grade and show a set of dates. Pass the months you want in view.
 *
 * The return is memoised (critic C12): its identity changes only when the bootstrap, the months' data, the day or the
 * loading state change, so a memoised page that takes it as a prop does not re-render on its host's renders (the day pager's
 * three pages, a minute tick in the bar).
 */
export const useLog = (months: string[]) => {
  const t = useToday();
  const boot = useBootstrap();
  const list = useMemo(() => [...new Set([...months, monthOf(t)])].sort(), [months.join(','), t]); // eslint-disable-line react-hooks/exhaustive-deps
  const { bundles, ready, loading } = useMonths(list);
  const data = boot.data ?? null;
  const pace = data?.morningSettings?.run?.pace ?? null;
  const snap = useSnapshot(bundles, t, pace);
  const loaded = useCallback((date: string) => snap.loaded(monthOf(date)), [snap]);
  return useMemo(
    () => ({
      today: t,
      boot: data,
      habits: (data?.habits ?? []).filter((h) => !h.archivedOn).sort((a, b) => a.position - b.position),
      zones: data?.zones ?? null,
      features: data?.features ?? NO_FEATURES,
      strava: data?.strava ?? null,
      snap,
      ready,
      loading,
      loaded,
    }),
    [t, data, snap, ready, loading, loaded],
  );
};
export type Log = ReturnType<typeof useLog>;
