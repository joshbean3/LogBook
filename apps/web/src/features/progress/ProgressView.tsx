import { monthsBetween, shiftDays } from '@logbook/shared';
import { ArrowRight, Heart } from 'lucide-react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { useToday } from '@/lib/useToday';
import { Button, dayCaption, EmptyState, NavBar, PageSection, Pressable, Skeleton, SkeletonGroup, useSheet } from '@/ui';
import { RangePill, TrendCard } from '@/ui/charts';
import { useLog, type Log } from '../log/useLog';
import { StatusWord, type Status } from '../health/HealthParts';
import { useMonthsFailed } from '../plan/LoadFail';
import { tileStatus, trendTone } from './context';
import { healthWord, pillOf } from './healthDays';
import { HeroChart } from './HeroChart';
import { MetricIcon } from './icons';
import { HEALTH_IDS, METRICS, type MetricId, type MetricModel } from './metrics';
import { useHealthLink } from './useHealthDays';
import { useMetricModels } from './useMetrics';
import { rangeSpan, spanMonths } from './ranges';
import { useHistoryStart, useRange } from './useRange';
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
 * Trends (30-day lines as tiles that open their metric pages; each number says the days it covers) and Health (resting HR,
 * HRV and sleep against your normal, from Apple Health; absent from a build without it). The page builds from the months
 * that are loaded: a month still on its way is a quiet gap in the chart. Before the first month lands it is a skeleton of
 * the hero card and four tiles; when nothing could be loaded it says so, with Try again.
 */
export default function ProgressView() {
  const sheet = useSheet();
  const t = useAsOf(useToday());
  const [range, setRange] = useRange();
  const start = useHistoryStart();
  // the chart's range (All waits for where history starts), the last 13 weeks (this week's numbers, and whether there is a
  // week before it), and the trend tiles' 30 days against the 90 behind them
  const span = useMemo(() => rangeSpan(range, t, start.first), [range, t, start.first]);
  const months = useMemo(() => [...new Set([...monthsBetween(shiftDays(t, -150), span.to), ...(range === 'All' && !start.ready ? [] : spanMonths(span))])].sort(), [t, span, range, start.ready]);
  const log = useLog(months);
  const fail = useMonthsFailed(months);
  const anyLoaded = months.some((m) => log.snap.loaded(m));

  const header = <NavBar caps={{ cur: dayCaption(t, t) }} title={{ cur: 'Progress' }} gap={16} />;
  if (!anyLoaded || !log.boot) {
    // nothing could be read and nothing is stored on this phone: say so, with the way to ask again
    if (fail.failed && !anyLoaded)
      return (
        <div className="page pg-page">
          {header}
          <section className="card ph" aria-label="Progress">
            <EmptyState className="ph-empty" verb={{ label: 'Try again', onPress: fail.retry, primary: true }}>
              Couldn’t load your progress. Check your connection.
            </EmptyState>
          </section>
        </div>
      );
    // on its way: the page's shape (the hero card and four tiles), announced once
    return (
      <div className="page pg-page">
        {header}
        <SkeletonGroup label="Loading your progress" className="pg-skel">
          <Skeleton h={372} r="card" />
          <Skeleton w={120} h={28} r="control" className="pg-skel-title" />
          <div className="tiles">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={152} r="card" />
            ))}
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  // the Strava sheet exists only in a build that has Strava: its code is fetched on the tap, and a build without it drops the branch
  const connect =
    STRAVA_BUILT && log.features.strava && !log.strava?.connected
      ? () => void import('../onboarding/StravaPrimer').then(({ StravaPrimer }) => sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> }))
      : null;
  return (
    <div className="page pg-page">
      {header}
      <HeroChart log={log} t={t} range={range} onRange={setRange} first={start.first} onConnect={connect} failed={fail.failed} onRetry={fail.retry} />
      <Trends log={log} onConnect={connect} />
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
const Trends = ({ log, onConnect }: { log: Log; onConnect: (() => void) | null }) => {
  const nav = useNav();
  const ids = STRAVA_BUILT && log.features.strava ? ALL_CARDS : UNTIMED_CARDS;
  const models = useMetricModels(log, ids);
  // no run and no lift finished yet: one card says what will show here and where to start; only tiles with something in
  // them follow it (never a grid of dashes)
  const fresh = !models.mileage.hasData && !models.lifts.hasData;
  const shown = fresh ? ids.filter((id) => models[id].hasData) : ids;
  return (
    <PageSection className="pg-sec" id="pg-trends" title="Trends" meta="30-day trend">
      {fresh ? (
        <div className="card pg-first">
          <p className="pg-first-t">Your first week shows here after your first run.</p>
          <div className="pg-first-acts">
            <Button size="sm" onClick={() => nav.go('/plan')}>
              Open this week’s plan
            </Button>
            {STRAVA_BUILT && onConnect ? (
              <Button variant="soft" size="sm" onClick={onConnect}>
                Connect Strava
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {shown.length ? (
        <div className="tiles pg-tiles">
          {shown.map((id) => {
            const mm = models[id];
            const v = mm.variant;
            const name = METRICS[id].tileName?.[v.id] ?? TILE_NAME[id] ?? METRICS[id].name;
            const unit = v.tileUnit ?? v.unit;
            const status = tileStatus(mm.status);
            return (
              <TrendCard
                key={id}
                label={name}
                icon={<MetricIcon id={id} size={16} />}
                value={mm.value != null ? v.format(mm.value) : null}
                unit={unit}
                status={status}
                tone={trendTone(mm)}
                spark={mm.line}
                invert={v.invert}
                zero={v.zero}
                // the printed words first, in their order (Voice Control: "Tap Mileage")
                aria={`${name}. ${mm.value != null ? `${v.format(mm.value)} ${unit}. ` : ''}${status}`}
                onPress={() => nav.push(`/progress/metric/${id}`)}
              />
            );
          })}
        </div>
      ) : null}
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
  const any = HEALTH_IDS.some((id) => models[id].hasData);
  // nothing connected and nothing to read: the way to connect, alone (three tiles of dashes say nothing)
  if (!slot && !any)
    return (
      <PageSection className="pg-sec" id="pg-health" title="Health">
        <Pressable className="pg-slot is-connect is-row" press="scale" onPress={() => nav.go('/settings/connections')} label="Connect Apple Health. Sleep, HRV, resting HR. Open Data sources">
          <span className="pg-slot-ic" aria-hidden="true">
            <Heart size={18} />
          </span>
          <span className="pg-slot-words">
            <span className="pg-slot-title">Connect Apple Health</span>
            <span className="pg-slot-sub">Sleep, HRV, resting HR</span>
          </span>
          <ArrowRight size={16} className="pg-go" aria-hidden="true" />
        </Pressable>
      </PageSection>
    );
  return (
    <PageSection className="pg-sec" id="pg-health" title="Health" meta="Against your normal">
      <div className="tiles pg-tiles">
        {HEALTH_IDS.map((id) => {
          const mm = models[id];
          const v = mm.variant;
          const word = tileStatus(healthWord(mm, link));
          const pill = pillOf(mm);
          const name = VITAL_LABEL[id] ?? METRICS[id].name;
          return (
            <Pressable key={id} className="tile pg-vital" press="scale" onPress={() => nav.push(`/progress/metric/${id}`)} label={`${name}. ${mm.value != null ? `${v.format(mm.value)} ${v.unit}. ` : ''}${word}. Open`}>
              <span className="pg-vital-main">
                <span className="tile-label">
                  <MetricIcon id={id} size={16} />
                  <span className="pg-vital-name">{name}</span>
                </span>
                {mm.value != null ? (
                  <span className="tile-value">
                    {v.format(mm.value)}
                    <small>{v.unit}</small>
                  </span>
                ) : (
                  <span className="tile-value pg-vital-none" aria-hidden="true">
                    –
                  </span>
                )}
                <StatusWord status={vitalStatus(mm)} word={word} />
              </span>
              {/* the arrow sits over the pill, so it stays at 320 and the name keeps its room (and its icon where it fits) */}
              <span className="pg-vital-side">
                <ArrowRight size={16} className="pg-go" aria-hidden="true" />
                <RangePill pos={pill?.pos ?? null} band={pill?.band} />
              </span>
            </Pressable>
          );
        })}
        {/* where the readings come from: connected, or the way to connect */}
        <Pressable className={`pg-slot ${slot ? '' : 'is-connect'}`} press="scale" onPress={() => nav.go('/settings/connections')} label={slot ? `Apple Health. ${slot}. Open Data sources` : 'Connect Apple Health. Sleep, HRV, resting HR. Open Data sources'}>
          <span className="pg-slot-ic" aria-hidden="true">
            <Heart size={18} />
          </span>
          <span className="pg-slot-title">{slot ? 'Apple Health' : 'Connect Apple Health'}</span>
          <span className="pg-slot-sub">{slot ?? 'Sleep, HRV, resting HR'}</span>
        </Pressable>
      </div>
    </PageSection>
  );
};
