import { monthOf } from '@logbook/shared';
import { useCallback, useMemo } from 'react';
import { useBootstrap, useMonths } from '@/api/queries';
import { useSnapshot } from '@/api/snapshot';
import type { Bootstrap, MonthBundle } from '@/api/types';
import { useFitness } from '@/lib/prefs';
import { useToday } from '@/lib/useToday';

const NO_FEATURES = { claude: false, strava: false };

/**
 * Fitness switched off (lib/prefs.ts): the months and the bootstrap as a screen should see them, with the training left
 * out (sessions, runs and other activities, lift sets, plans, the training status, the Strava connection). Nothing is
 * deleted: this is a view, and turning Fitness back on shows the same data again. Habits, the journal, the morning's
 * settings and everything else pass through untouched.
 */
export const withoutFitnessMonths = (bundles: Record<string, MonthBundle>): Record<string, MonthBundle> =>
  Object.fromEntries(Object.entries(bundles).map(([m, b]) => [m, { ...b, sessions: [], activities: [], lifts: [], coach: [] }]));
export const withoutFitnessBoot = (b: Bootstrap): Bootstrap => ({
  ...b,
  blocks: [],
  zones: null,
  user: { ...b.user, status: null, trainingProfile: null },
  strava: { ...b.strava, connected: false },
  features: { ...b.features, strava: false },
});

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
  const months$ = useMonths(list);
  const { ready, loading } = months$;
  const fitness = useFitness();
  const bundles = useMemo(() => (fitness ? months$.bundles : withoutFitnessMonths(months$.bundles)), [fitness, months$.bundles]);
  const raw = boot.data ?? null;
  const data = useMemo(() => (raw && !fitness ? withoutFitnessBoot(raw) : raw), [raw, fitness]);
  const pace = data?.morningSettings?.run?.pace ?? null;
  const snap = useSnapshot(bundles, t, pace);
  const loaded = useCallback((date: string) => snap.loaded(monthOf(date)), [snap]);
  return useMemo(
    () => ({
      today: t,
      /** Is Fitness on (lib/prefs.ts)? Off: `snap` and `boot` carry no training, and a screen draws none. */
      fitness,
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
    [t, fitness, data, snap, ready, loading, loaded],
  );
};
export type Log = ReturnType<typeof useLog>;
