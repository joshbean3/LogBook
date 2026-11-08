import { Activity, CalendarCheck, Dumbbell, Footprints, HeartPulse, Moon, Timer, type LucideIcon } from 'lucide-react';
import type { MetricId } from './metrics';

/** One icon per metric, the same on its trend card and its page. */
export const METRIC_ICON: Record<MetricId, LucideIcon> = {
  mileage: Footprints,
  pace: Timer,
  consistency: CalendarCheck,
  lifts: Dumbbell,
  sleep: Moon,
  hrv: Activity,
  rhr: HeartPulse,
};

export const MetricIcon = ({ id, size = 14 }: { id: MetricId; size?: number }) => {
  const I = METRIC_ICON[id];
  return <I size={size} strokeWidth={2.2} aria-hidden="true" />;
};
