import { monthsBetween, shiftDays } from '@logbook/shared';
import { memo, useEffect, useMemo, useState } from 'react';
import { SectionBoundary } from '@/app/ErrorBoundary';
import { useNav } from '@/app/NavController';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { useToday } from '@/lib/useToday';
import { ProgressIcon } from '@/ui/icons';
import { Footnote, NoData, PageSection, SectionEmpty, Skeleton, SkeletonGroup, StatTile, unitWords, useSheet } from '@/ui';
import { resolveRoute } from '@/ui/nav';
import { useLog, type Log } from '../log/useLog';
import { LoadFail, useMonthsFailed } from '../plan/LoadFail';
import { splitTileUnit, tileContext } from './context';
import { BODY_IDS, healthShown, trendIds, trendsShown } from './fitnessPage';
import { healthWord } from './healthDays';
import { runRange } from './hero';
import { HeroChart } from './HeroChart';
import { MetricIcon } from './icons';
import { metricDef, type MetricId, type MetricModel } from './metrics';
import { rangeSpan, spanMonths } from './ranges';
import { useHealthLink } from './useHealthDays';
import { useMetricModels } from './useMetrics';
import { useHistoryStart, useLiftStart, useRange } from './useRange';
import './progress.css';
import './metric.css';
import './fitness.css';

/** Dev builds take `?asof=YYYY-MM-DD` to see the page as it reads on another day (early week, a new block). */
const useAsOf = (real: string) => {
  if (!import.meta.env.DEV) return real;
  const v = new URLSearchParams(window.location.search).get('asof');
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : real;
};

/**
 * A metric's page, opened from a tile. It is a page pushed over the tab that owns its route: pushed when that is the tab
 * on screen (Fitness, once it owns `/progress/metric/:id`), a jump to it otherwise, so the same tile works either way.
 */
export const useOpenMetric = () => {
  const nav = useNav();
  return (id: MetricId) => {
    const path = `/progress/metric/${id}`;
    if (resolveRoute(path).tab === nav.getState().active) nav.push(path);
    else nav.go(path);
  };
};

/**
 * The lower half of Fitness (guide 6.5a, "Fitness"): how it is going, under what is next. Two sections on the page
 * itself, under the week pager and outside it, so they hold still while the weeks move and are never redrawn by a swipe:
 *
 * - **Progress**: one card, the chart (HeroChart, `lead={false}`: a plain card, since the training card is the page's
 *   hero). Runs / Workouts is the training card's own switch. With nothing planned or done yet it is one quiet row.
 * - **Trends**: the tiles that have something to show (Weekly mileage, Run pace, Plan kept, Lift volume), each opening its metric
 *   page, and under them the body's numbers from Apple Health (Sleep, HRV, Resting HR) once it is connected.
 *
 * The page builds from the months that are loaded: before the first lands it is the section title over a skeleton of the
 * card; when nothing could be loaded it says so, with Retry. Memoised with no props: a week commit above re-renders none
 * of it.
 */
export const FitnessProgress = memo(function FitnessProgress() {
  const sheet = useSheet();
  const t = useAsOf(useToday());
  const [range, setRange] = useRange();
  // when the server cannot say where history starts (an older deploy, a failed request), the months are read back instead,
  // and only when the answer matters: for the All range, and when the last 13 weeks have no run in them (someone back
  // after months away, whose runs are further back than the page has looked)
  const [quiet, setQuiet] = useState(false);
  const start = useHistoryStart(t, range === 'All' || quiet);
  const liftStart = useLiftStart();
  const startReady = start.ready && liftStart.ready;
  // All reaches back to whichever began first, running or lifting, so both charts read the same months
  const earliest = [start.first, liftStart.first].filter((d): d is string => !!d).sort()[0] ?? null;
  const span = useMemo(() => rangeSpan(range, t, earliest), [range, t, earliest]);
  const months = useMemo(() => [...new Set([...monthsBetween(shiftDays(t, -150), span.to), ...(range === 'All' && !startReady ? [] : spanMonths(span))])].sort(), [t, span, range, startReady]);
  const log = useLog(months);
  const quietNow = useMemo(() => !runRange(log.snap, t, '3M', null, (m) => log.snap.loaded(m)).buckets.some((b) => b.missing || b.planned > 0 || b.done > 0), [log.snap, t]);
  useEffect(() => setQuiet(quietNow), [quietNow]);
  const fail = useMonthsFailed(months);
  const anyLoaded = months.some((m) => log.snap.loaded(m));

  if (!anyLoaded || !log.boot) {
    return (
      <PageSection className="fp-sec" title="Progress">
        {fail.failed && !anyLoaded ? (
          // nothing could be read and nothing is stored on this phone: say so, with the way to ask again
          <LoadFail what="Couldn’t load your progress." onRetry={fail.retry} />
        ) : (
          <SkeletonGroup label="Loading your progress">
            <Skeleton h={320} r="card" />
          </SkeletonGroup>
        )}
      </PageSection>
    );
  }

  // the Strava sheet exists only in a build that has Strava: its code is fetched on the tap, and a build without it drops the branch
  const connect =
    STRAVA_BUILT && log.features.strava && !log.strava?.connected
      ? () => void import('../onboarding/StravaPrimer').then(({ StravaPrimer }) => sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> }))
      : null;
  return (
    <>
      <PageSection className="fp-sec" id="fp-progress" title="Progress">
        <SectionBoundary name="fitness.progress">
          <HeroChart
            lead={false}
            log={log}
            t={t}
            range={range}
            onRange={setRange}
            first={start.first}
            liftFirst={liftStart.first}
            firstReady={startReady}
            startFailed={start.failed}
            onConnect={connect}
            failed={fail.failed}
            onRetry={() => {
              fail.retry();
              if (start.failed) start.retry();
            }}
          />
        </SectionBoundary>
      </PageSection>
      <SectionBoundary name="fitness.trends">
        <Trends log={log} t={t} onConnect={connect} />
      </SectionBoundary>
    </>
  );
});

// ---------- Trends: stat tiles, each opening its metric page; the body's numbers as one group under them ----------
const TIMED: readonly MetricId[] = [...trendIds(true), ...BODY_IDS];
const UNTIMED: readonly MetricId[] = [...trendIds(false), ...BODY_IDS];
/** A tile has 150 px: the short name. */
const TILE_NAME: Partial<Record<MetricId, string>> = { mileage: 'Mileage', lifts: 'Lifts', rhr: 'Resting HR', hrv: 'HRV', sleep: 'Sleep' };
/** A value and its unit as a tile shows them: a share keeps its % on the number ("7%"). */
const valueParts = (value: string, unit: string) => (unit === '%' ? { value: `${value}%`, unit: undefined } : { value, unit });

/** One metric as a stat tile (layout standard 6.3). `status` replaces the metric's own status word (Apple Health: where the connection stands). */
export const MetricTile = ({ id, mm, fitness, status, onPress }: { id: MetricId; mm: MetricModel; fitness: boolean; status?: string; onPress?: () => void }) => {
  const v = mm.variant;
  const def = metricDef(id, fitness);
  const name = def.tileName?.[v.id] ?? TILE_NAME[id] ?? def.name;
  const { unit, window } = status == null ? splitTileUnit(v.tileUnit, v.unit) : { unit: v.unit, window: null };
  const ctx = tileContext(mm, status ?? mm.status, window);
  const parts = mm.value != null ? valueParts(v.format(mm.value), unit) : null;
  const spark = mm.line.filter((x): x is number => x != null);
  return (
    <StatTile
      label={name}
      icon={<MetricIcon id={id} size={18} />}
      value={parts ? parts.value : <NoData />}
      unit={parts?.unit}
      context={ctx.text}
      dir={ctx.dir}
      hi={ctx.hi}
      spark={spark.length >= 7 ? spark : undefined}
      read={`${name}. ${parts ? `${parts.value}${parts.unit ? ` ${unitWords(parts.unit)}` : ''}${window ? ` in the last ${window}` : ''}. ` : 'None yet. '}${ctx.text}.${onPress ? ' Open' : ''}`}
      onPress={onPress}
    />
  );
};

/** "9:41 AM" for today, "Nov 9, 9:41 AM" before. */
export const syncedAt = (iso: string | null | undefined, today: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const day = d.toLocaleDateString('en-CA');
  return day === today ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
};

/**
 * The body's numbers from Apple Health as one group of tiles: the night's sleep across the row, then HRV and resting HR
 * side by side, each against your usual; where the readings come from is a footnote under the group. `onOpen` makes each
 * tile the way to its metric page; without it (Settings, with Fitness off) the tiles are read only.
 */
export const BodyTiles = ({ log, t, onOpen }: { log: Log; t: string; onOpen?: (id: MetricId) => void }) => {
  const link = useHealthLink();
  const models = useMetricModels(log, BODY_IDS);
  const at = syncedAt(link.lastSyncAt, t);
  const foot = link.syncing ? 'Apple Health · syncing' : at ? `Apple Health · synced ${at}` : 'Apple Health';
  return (
    <div className="fp-body" role="group" aria-label="From Apple Health">
      <div className="tiles pg-tiles fp-tiles">
        {BODY_IDS.map((id) => (
          <MetricTile key={id} id={id} mm={models[id]} fitness={log.fitness} status={healthWord(models[id], link)} onPress={onOpen ? () => onOpen(id) : undefined} />
        ))}
      </div>
      <Footnote className="pg-foot">{foot}</Footnote>
    </div>
  );
};

const Trends = ({ log, t, onConnect }: { log: Log; t: string; onConnect: (() => void) | null }) => {
  const open = useOpenMetric();
  const link = useHealthLink();
  const timed = STRAVA_BUILT && log.features.strava;
  const models = useMetricModels(log, timed ? TIMED : UNTIMED);
  const shown = trendsShown({
    ids: trendIds(timed),
    // Plan kept shows once a planned day has been kept: a week of misses is not a lone "0%" tile
    has: (id) => models[id].hasData && (id !== 'consistency' || models[id].line.some((x) => x != null && x > 0)),
    canConnect: STRAVA_BUILT && !!onConnect,
    health: healthShown(HEALTH_BUILT, link, BODY_IDS.some((id) => models[id].hasData)),
  });
  if (!shown.section) return null;
  return (
    <PageSection className="fp-sec" id="fp-trends" title="Trends">
      {shown.empty ? (
        <SectionEmpty className="pg-empty" icon={<ProgressIcon size={18} />} title="No trends yet" line="They show after your first run or lift." action={onConnect ? { label: 'Connect', onPress: onConnect, voiceLabel: 'Connect Strava' } : undefined} />
      ) : null}
      {shown.tiles.length ? (
        <div className="tiles pg-tiles fp-tiles">
          {shown.tiles.map((id) => (
            <MetricTile key={id} id={id} mm={models[id]} fitness={log.fitness} onPress={() => open(id)} />
          ))}
        </div>
      ) : null}
      {shown.health ? (
        <SectionBoundary name="fitness.health">
          <BodyTiles log={log} t={t} onOpen={open} />
        </SectionBoundary>
      ) : null}
    </PageSection>
  );
};
