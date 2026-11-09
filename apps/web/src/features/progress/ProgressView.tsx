import { useQuery } from '@tanstack/react-query';
import { mondayOf, monthsBetween, shiftDays, type HealthStatus } from '@logbook/shared';
import { HeartPulse } from 'lucide-react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { api } from '@/api/client';
import { healthStatusKey } from '@/lib/healthSync';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar, PageSection, Pressable, useSheet } from '@/ui';
import { RangePill, TrendCard } from '@/ui/charts';
import { useLog, type Log } from '../log/useLog';
import { StravaPrimer } from '../onboarding/StravaPrimer';
import { StatusWord } from '../health/HealthParts';
import { tileStatus, trendTone } from './context';
import { HeroChart } from './HeroChart';
import { MetricIcon } from './icons';
import { METRICS, type MetricId } from './metrics';
import { useMetricModels } from './useMetrics';
import './progress.css';
import './metric.css';

/** Dev builds take `?asof=YYYY-MM-DD` to see the page as it reads on another day (early week, a new block). */
const useAsOf = (real: string) => {
  if (!import.meta.env.DEV) return real;
  const v = new URLSearchParams(window.location.search).get('asof');
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : real;
};

/**
 * Progress, in three parts and nothing else: the hero card (Running or Strength, planned against done, week by week),
 * Trends (the last 30 days as tiles that open their metric pages) and Health (resting HR, HRV and sleep against your normal,
 * from Apple Health and the wearables behind it). The page builds from the months that are loaded: a month still on its way
 * is a quiet gap in the chart, never the page skeleton.
 */
export default function ProgressView() {
  const sheet = useSheet();
  const t = useAsOf(useToday());
  // the hero's weeks, and the trend tiles' 30 days against the 90 behind them
  const months = useMemo(() => monthsBetween(shiftDays(t, -150), shiftDays(mondayOf(t), 6)), [t]);
  const log = useLog(months);
  const anyLoaded = months.some((m) => log.snap.loaded(m));

  const header = <NavBar caps={{ cur: dayCaption(t, t) }} title={{ cur: 'Progress' }} gap={16} />;
  // nothing at all on this device yet: the bar alone, quietly, until the first month lands (no skeleton, no empty state)
  if (!anyLoaded || !log.boot)
    return (
      <div className="page pg-page" aria-busy="true">
        {header}
      </div>
    );

  const connect = () => sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> });
  return (
    <div className="page pg-page">
      {header}
      <HeroChart log={log} t={t} onConnect={connect} />
      <Trends log={log} />
      <Health />
    </div>
  );
}

// ---------- Trends: a 2-column grid of tiles, each opening its metric page ----------
const CARD_IDS: readonly MetricId[] = ['mileage', 'pace', 'consistency', 'lifts'];
/** A tile has 150 px: the short name. */
const TILE_NAME: Partial<Record<MetricId, string>> = { mileage: 'Mileage', lifts: 'Lifts' };
const Trends = ({ log }: { log: Log }) => {
  const nav = useNav();
  const models = useMetricModels(log, CARD_IDS);
  return (
    <PageSection className="pg-sec" id="pg-trends" title="Trends" meta="Last 30 days">
      <div className="tiles pg-tiles">
        {CARD_IDS.map((id) => {
          const mm = models[id];
          const v = mm.variant;
          return (
            <TrendCard
              key={id}
              label={TILE_NAME[id] ?? METRICS[id].name}
              icon={<MetricIcon id={id} size={16} />}
              value={mm.value != null ? v.format(mm.value) : null}
              unit={v.unit}
              status={tileStatus(mm.status)}
              tone={trendTone(mm)}
              spark={mm.line}
              invert={v.invert}
              zero={v.zero}
              aria={`${METRICS[id].name}: ${mm.value != null ? `${v.format(mm.value)} ${v.unit}, ` : ''}${mm.status}`}
              onPress={() => nav.push(`/progress/metric/${id}`)}
            />
          );
        })}
      </div>
    </PageSection>
  );
};

// ---------- Health: the wearable readings against your normal, waiting on Apple Health ----------
const VITALS: Array<{ id: MetricId; label: string }> = [
  { id: 'rhr', label: 'Resting HR' },
  { id: 'hrv', label: 'HRV' },
  { id: 'sleep', label: 'Sleep' },
];
const Health = () => {
  const nav = useNav();
  // whether Apple Health is connected (the same query Settings reads); the readings themselves are not on the web yet
  const status = useQuery({ queryKey: healthStatusKey, queryFn: () => api<HealthStatus>('/apple-health/status'), staleTime: 30_000 });
  const on = !!status.data?.connected;
  const word = on ? 'Syncing' : 'Apple Health';
  return (
    <PageSection className="pg-sec" id="pg-health" title="Health" meta="Against your normal">
      <div className="tiles pg-tiles">
        {VITALS.map((x) => (
          <Pressable key={x.id} className="tile pg-vital" press="scale" onPress={() => nav.push(`/progress/metric/${x.id}`)} label={`${METRICS[x.id].name}: no readings yet, ${on ? 'Apple Health is connected' : 'comes with Apple Health'}. Open`}>
            <span className="pg-vital-main">
              <span className="tile-label">
                <MetricIcon id={x.id} size={16} />
                <span>{x.label}</span>
              </span>
              <span className="tile-value pg-vital-none">–</span>
              <StatusWord status="none" word={word} />
            </span>
            <RangePill pos={null} />
          </Pressable>
        ))}
        {/* where the readings come from: Data sources says when */}
        <Pressable className="pg-slot" press="scale" onPress={() => nav.go('/settings/connections')} label={on ? 'Apple Health: connected. Open Data sources' : 'Apple Health: connect it in Data sources'}>
          <span className="pg-slot-ic" aria-hidden="true">
            <HeartPulse size={18} />
          </span>
          <span className="pg-slot-title">Apple Health</span>
          <span className="pg-slot-sub">{on ? 'Connected' : 'Connect in Data sources'}</span>
        </Pressable>
      </div>
    </PageSection>
  );
};
