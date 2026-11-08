import { shiftDays } from '@logbook/shared';
import { useMemo } from 'react';
import { rangeWindow, type RangeKey } from '@/ui/charts';
import type { Log } from '../log/useLog';
import { easyPace } from './data';
import { snapSource } from './feed';
import { buildMetric, METRICS, type MetricId, type MetricSource } from './metrics';

/** The metric source over the loaded months: rebuilt only when a month lands or the day changes. */
export const useMetricSource = (log: Log, from: string): MetricSource => {
  const t = log.today;
  return useMemo(() => {
    const easy = new Set(easyPace(log.snap, from, t, log.zones).runs.map((r) => r.a.id));
    return snapSource(log.snap, log.habits, easy);
  }, [log.snap, log.habits, log.zones, from, t]);
};

/** Every metric's model for a range ending today (Progress's trend cards). */
export const useMetricModels = (log: Log, ids: readonly MetricId[], key: RangeKey = '1M') => {
  const t = log.today;
  const src = useMetricSource(log, shiftDays(t, -200));
  return useMemo(() => {
    const w = rangeWindow(t, key);
    return Object.fromEntries(ids.map((id) => [id, buildMetric(METRICS[id], null, src, w)])) as Record<MetricId, ReturnType<typeof buildMetric>>;
  }, [src, t, key, ids]);
};
