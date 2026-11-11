import { monthsBetween, shiftDays } from '@logbook/shared';
import { Activity, ChevronRight, Heart } from 'lucide-react';
import { useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { useToday } from '@/lib/useToday';
import { dayCaption, EmptyState, Footnote, NavBar, NoData, PageSection, Row, SectionEmpty, Skeleton, SkeletonGroup, StatTile, unitWords, useSheet } from '@/ui';
import { useLog, type Log } from '../log/useLog';
import { useMonthsFailed } from '../plan/LoadFail';
import { splitTileUnit, tileContext } from './context';
import { healthWord } from './healthDays';
import { HeroChart } from './HeroChart';
import { MetricIcon } from './icons';
import { HEALTH_IDS, METRICS, type MetricId } from './metrics';
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
          <Skeleton h={418} r="card" />
          <Skeleton w={120} h={28} r="control" className="pg-skel-title" />
          <div className="tiles">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={148} r="card" />
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
      <HeroChart log={log} t={t} range={range} onRange={setRange} first={start.first} firstReady={start.ready} onConnect={connect} failed={fail.failed} onRetry={fail.retry} />
      <Trends log={log} onConnect={connect} />
      {HEALTH_BUILT ? <Health log={log} t={t} /> : null}
    </div>
  );
}

// ---------- Trends: a 2-column grid of stat tiles, each opening its metric page ----------
const ALL_CARDS: readonly MetricId[] = ['mileage', 'pace', 'consistency', 'lifts'];
/** Pace needs runs with a time, and only a synced source has those: with none offered, the tile is not shown. */
const UNTIMED_CARDS: readonly MetricId[] = ['mileage', 'consistency', 'lifts'];
/** A tile has 150 px: the short name. */
const TILE_NAME: Partial<Record<MetricId, string>> = { mileage: 'Mileage', lifts: 'Lifts' };
/** A value and its unit as a tile shows them: a share keeps its % on the number ("7%"). */
const valueParts = (value: string, unit: string) => (unit === '%' ? { value: `${value}%`, unit: undefined } : { value, unit });

/**
 * Trends (layout standard 6.3): one stat tile per metric, the same tile as Health. Each tile says its own window ("Last 7
 * days"), so the section has no meta. With no run and no lift yet, one section row says what will show here (never a grid of
 * dashes, and no second way to the plan, which is a tab away); the tiles that do have something follow it.
 */
const Trends = ({ log, onConnect }: { log: Log; onConnect: (() => void) | null }) => {
  const nav = useNav();
  const ids = STRAVA_BUILT && log.features.strava ? ALL_CARDS : UNTIMED_CARDS;
  const models = useMetricModels(log, ids);
  const fresh = !models.mileage.hasData && !models.lifts.hasData;
  const shown = fresh ? ids.filter((id) => models[id].hasData) : ids;
  return (
    <PageSection className="pg-sec" id="pg-trends" title="Trends">
      {fresh ? (
        <SectionEmpty
          className="pg-empty"
          icon={<Activity size={18} />}
          title="No trends yet"
          line="They show after your first run or lift."
          action={STRAVA_BUILT && onConnect ? { label: 'Connect', onPress: onConnect, voiceLabel: 'Connect Strava' } : undefined}
        />
      ) : null}
      {shown.length ? (
        <div className="tiles pg-tiles">
          {shown.map((id) => {
            const mm = models[id];
            const v = mm.variant;
            const name = METRICS[id].tileName?.[v.id] ?? TILE_NAME[id] ?? METRICS[id].name;
            const { unit, window } = splitTileUnit(v.tileUnit, v.unit);
            const ctx = tileContext(mm, mm.status, window);
            const parts = mm.value != null ? valueParts(v.format(mm.value), unit) : null;
            const spark = mm.line.filter((x): x is number => x != null);
            return (
              <StatTile
                key={id}
                label={name}
                icon={<MetricIcon id={id} size={18} />}
                value={parts ? parts.value : <NoData />}
                unit={parts?.unit}
                context={ctx.text}
                dir={ctx.dir}
                hi={ctx.hi}
                spark={spark.length >= 7 ? spark : undefined}
                read={`${name}. ${parts ? `${parts.value}${parts.unit ? ` ${unitWords(parts.unit)}` : ''}${window ? ` in the last ${window}` : ''}. ` : 'None yet. '}${ctx.text}. Open`}
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
const syncedAt = (iso: string | null | undefined, today: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = d.toLocaleDateString('en-CA');
  return day === today ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
};
/**
 * Health (layout standard 6.3): the same stat tile as Trends for resting HR, HRV and sleep, each with one context line
 * against your usual ("Above usual" with its triangle). Where the readings come from is a footnote under the grid, not a
 * fourth tile. Nothing connected and nothing to read: one row, the way to connect.
 */
const Health = ({ log, t }: { log: Log; t: string }) => {
  const nav = useNav();
  const link = useHealthLink();
  const models = useMetricModels(log, HEALTH_IDS);
  const any = HEALTH_IDS.some((id) => models[id].hasData);
  if (!link.connected && !link.syncing && !any)
    return (
      <PageSection className="pg-sec" id="pg-health" title="Health">
        <div className="group">
          <Row
            left={
              <span className="icon-tile" aria-hidden="true">
                <Heart size={18} />
              </span>
            }
            title="Connect Apple Health"
            sub="Sleep, HRV, resting HR"
            right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />}
            onClick={() => nav.go('/settings/connections')}
            label="Connect Apple Health. Sleep, HRV, resting HR. Open Data sources"
          />
        </div>
      </PageSection>
    );
  const at = syncedAt(link.lastSyncAt, t);
  const foot = link.syncing ? 'Apple Health · syncing' : at ? `Apple Health · synced ${at}` : 'Apple Health';
  return (
    <PageSection className="pg-sec" id="pg-health" title="Health">
      <div className="tiles pg-tiles">
        {HEALTH_IDS.map((id) => {
          const mm = models[id];
          const v = mm.variant;
          const name = VITAL_LABEL[id] ?? METRICS[id].name;
          const ctx = tileContext(mm, healthWord(mm, link), null);
          const spark = mm.line.filter((x): x is number => x != null);
          return (
            <StatTile
              key={id}
              label={name}
              icon={<MetricIcon id={id} size={18} />}
              value={mm.value != null ? v.format(mm.value) : <NoData />}
              unit={mm.value != null ? v.unit : undefined}
              context={ctx.text}
              dir={ctx.dir}
              hi={ctx.hi}
              spark={spark.length >= 7 ? spark : undefined}
              read={`${name}. ${mm.value != null ? `${v.format(mm.value)} ${unitWords(v.unit)}` : 'None yet'}. ${ctx.text}. Open`}
              onPress={() => nav.push(`/progress/metric/${id}`)}
            />
          );
        })}
      </div>
      <Footnote className="pg-foot">{foot}</Footnote>
    </PageSection>
  );
};
