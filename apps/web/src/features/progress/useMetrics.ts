import { shiftDays } from '@logbook/shared';
import { useMemo } from 'react';
import { rangeWindow, type RangeKey } from '@/ui/charts';
import type { Log } from '../log/useLog';
import { easyPace } from './data';
import { snapSource } from './feed';
import { buildMetric, leadVariant, METRICS, type MetricId, type MetricSource } from './metrics';
import { useHealthDays } from './useHealthDays';

/** The metric source over the loaded months: rebuilt only when a month lands or the day changes. */
export const useMetricSource = (log: Log, from: string): MetricSource => {
  const t = log.today;
  const health = useHealthDays(from, t).days;
  return useMemo(() => {
    const easy = new Set(easyPace(log.snap, from, t, log.zones).runs.map((r) => r.a.id));
    return snapSource(log.snap, log.habits, easy, health);
  }, [log.snap, log.habits, log.zones, from, t, health]);
};

/** Every metric's model for a range ending today (Progress's trend cards). */
export const useMetricModels = (log: Log, ids: readonly MetricId[], key: RangeKey = '1M') => {
  const t = log.today;
  const src = useMetricSource(log, shiftDays(t, -200));
  return useMemo(() => {
    const w = rangeWindow(t, key);
    return Object.fromEntries(ids.map((id) => [id, buildMetric(METRICS[id], leadVariant(METRICS[id], src, w), src, w)])) as Record<MetricId, ReturnType<typeof buildMetric>>;
  }, [src, t, key, ids]);
};
