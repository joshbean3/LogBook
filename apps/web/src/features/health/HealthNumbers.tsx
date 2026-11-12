import { Heart, HeartPulse, Moon, type LucideIcon } from 'lucide-react';
import { monthsBetween, shiftDays } from '@logbook/shared';
import type * as React from 'react';
import { useMemo } from 'react';
import { Footnote, PageSection } from '@/ui/layout';
import { useLog } from '../log/useLog';
import { BODY_IDS } from '../progress/fitnessPage';
import { pillOf } from '../progress/healthDays';
import { valueDateWords, type MetricId, type MetricModel } from '../progress/metrics';
import { useHealthLink } from '../progress/useHealthDays';
import { useMetricModels } from '../progress/useMetrics';
import { MonitorTile, type Status } from './HealthParts';
import './health.css';

const ICON: Partial<Record<MetricId, LucideIcon>> = { sleep: Moon, hrv: HeartPulse, rhr: Heart };
const LABEL: Partial<Record<MetricId, string>> = { sleep: 'Sleep', hrv: 'HRV', rhr: 'Resting HR' };

/** A reading against your usual, as the tile's status word: Normal, Higher, Lower; Learning until two weeks are in. */
export const statusOf = (m: Pick<MetricModel, 'hasData' | 'value' | 'standing'>): Status => {
  if (!m.hasData || m.value == null) return 'none';
  return m.standing === 'within' ? 'normal' : m.standing === 'above' ? 'higher' : m.standing === 'below' ? 'lower' : 'learning';
};
/** The numbers that have a reading, in the order they are read (the night, then the two heart numbers). */
export const numbersShown = (models: Partial<Record<MetricId, Pick<MetricModel, 'hasData' | 'value'>>>): MetricId[] => BODY_IDS.filter((id) => models[id]?.hasData && models[id]?.value != null);

/**
 * What the watch sends, as three numbers: Sleep, HRV and Resting HR, each a 7-day average against your usual. With
 * Fitness on these are tiles under Trends on the Fitness tab; with Fitness off there is no such tab, so they stand here,
 * under the Apple Health card in Settings, Data sources (features/settings/AppleHealth.tsx). Only numbers with a reading
 * are drawn, and with none the block is not there: the card above it already says where the connection stands.
 */
export const HealthNumbers = (): React.JSX.Element | null => {
  const t = useLog([]).today;
  // a number is read against the 90 days before it, and the metric counts only days whose month is in: the months that
  // hold those days (the same ones Fitness reads; they are usually on the phone already)
  const log = useLog(useMemo(() => monthsBetween(shiftDays(t, -150), t), [t]));
  const models = useMetricModels(log, BODY_IDS);
  const link = useHealthLink();
  const ids = numbersShown(models);
  if (!ids.length) return null;
  return (
    <PageSection size="sm" title="Your numbers" className="s-sec hn">
      <div className="hn-tiles">
        {ids.map((id) => {
          const m = models[id];
          const pill = pillOf(m);
          const when = valueDateWords(m, log.today);
          return <MonitorTile key={id} icon={ICON[id]!} label={LABEL[id]!} value={m.variant.format(m.value!)} unit={m.variant.unit} status={statusOf(m)} foot={when.charAt(0).toUpperCase() + when.slice(1)} pos={pill?.pos} band={pill?.band} />;
        })}
      </div>
      <Footnote>{link.syncing ? 'From Apple Health. Syncing now.' : 'From Apple Health, each as a 7-day average against your usual.'}</Footnote>
    </PageSection>
  );
};
