import { mondayOf, monthsBetween, shiftDays } from '@logbook/shared';
import { HeartPulse } from 'lucide-react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar, PageSection, Pressable, useSheet } from '@/ui';
import { RangePill, TrendCard } from '@/ui/charts';
import { useLog, type Log } from '../log/useLog';
import { StravaPrimer } from '../onboarding/StravaPrimer';
import { StatusWord, type Status } from '../health/HealthParts';
import { tileStatus, trendTone } from './context';
import { healthWord, pillOf } from './healthDays';
import { HeroChart } from './HeroChart';
import { MetricIcon } from './icons';
import { HEALTH_IDS, METRICS, type MetricId, type MetricModel } from './metrics';
import { useHealthLink } from './useHealthDays';
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
 * from Apple Health; absent from a build without it). The page builds from the months that are loaded: a month still on its
 * way is a quiet gap in the chart, never the page skeleton.
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
      {HEALTH_BUILT ? <Health log={log} /> : null}
    </div>
  );
}

// ---------- Trends: a 2-column grid of tiles, each opening its metric page ----------
const ALL_CARDS: readonly MetricId[] = ['mileage', 'pace', 'consistency', 'lifts'];
/** Pace needs runs with a time, and only a synced source has those: with none offered, the tile is not shown. */
const UNTIMED_CARDS: readonly MetricId[] = ['mileage', 'consistency', 'lifts'];
/** A tile has 150 px: the short name. */
const TILE_NAME: Partial<Record<MetricId, string>> = { mileage: 'Mileage', lifts: 'Lifts' };
const Trends = ({ log }: { log: Log }) => {
  const nav = useNav();
  const ids = STRAVA_BUILT && log.features.strava ? ALL_CARDS : UNTIMED_CARDS;
  const models = useMetricModels(log, ids);
  return (
    <PageSection className="pg-sec" id="pg-trends" title="Trends" meta="Last 30 days">
      <div className="tiles pg-tiles">
        {ids.map((id) => {
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

// ---------- Health: resting HR, HRV and sleep from Apple Health, against your normal ----------
const VITAL_LABEL: Partial<Record<MetricId, string>> = { rhr: 'Resting HR', hrv: 'HRV', sleep: 'Sleep' };
/** How the word under a vital reads: on your usual, off it either way, still learning it, or nothing to read. */
const vitalStatus = (m: MetricModel): Status => (!m.hasData || m.value == null ? 'none' : m.standing === 'within' ? 'normal' : m.standing === 'above' ? 'higher' : m.standing === 'below' ? 'lower' : 'learning');
const Health = ({ log }: { log: Log }) => {
  const nav = useNav();
  const link = useHealthLink();
  const models = useMetricModels(log, HEALTH_IDS);
  const slot = link.syncing ? 'Syncing' : link.connected ? 'Connected' : null;
  return (
    <PageSection className="pg-sec" id="pg-health" title="Health" meta="Against your normal">
      <div className="tiles pg-tiles">
        {HEALTH_IDS.map((id) => {
          const mm = models[id];
          const v = mm.variant;
          const word = tileStatus(healthWord(mm, link));
          const pill = pillOf(mm);
          return (
            <Pressable key={id} className="tile pg-vital" press="scale" onPress={() => nav.push(`/progress/metric/${id}`)} label={`${METRICS[id].name}: ${mm.value != null ? `${v.format(mm.value)} ${v.unit}, ` : ''}${word}. Open`}>
              <span className="pg-vital-main">
                <span className="tile-label">
                  <MetricIcon id={id} size={16} />
                  <span>{VITAL_LABEL[id] ?? METRICS[id].name}</span>
                </span>
                {mm.value != null ? (
                  <span className="tile-value">
                    {v.format(mm.value)}
                    <small>{v.unit}</small>
                  </span>
                ) : (
                  <span className="tile-value pg-vital-none">–</span>
                )}
                <StatusWord status={vitalStatus(mm)} word={word} />
              </span>
              <RangePill pos={pill?.pos ?? null} band={pill?.band} />
            </Pressable>
          );
        })}
        {/* where the readings come from: connected, or the way to connect */}
        <Pressable className={`pg-slot ${slot ? '' : 'is-connect'}`} press="scale" onPress={() => nav.go('/settings/connections')} label={slot ? `Apple Health: ${slot.toLowerCase()}. Open Data sources` : 'Connect Apple Health. Open Data sources'}>
          <span className="pg-slot-ic" aria-hidden="true">
            <HeartPulse size={18} />
          </span>
          <span className="pg-slot-title">{slot ? 'Apple Health' : 'Connect Apple Health'}</span>
          <span className="pg-slot-sub">{slot ?? 'Sleep, HRV, resting HR'}</span>
        </Pressable>
      </div>
    </PageSection>
  );
};
