import { daysBetween, fmtDate, monthsBetween, shiftDays } from '@logbook/shared';
import { ChevronRight, CircleArrowDown, CircleArrowUp, CircleCheck, Hourglass, Info, Sigma, Trophy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNav, useRouteParams } from '@/app/NavController';
import { DISCLAIMER } from '@/lib/copy';
import { STRAVA_BUILT } from '@/lib/features';
import { EmptyState, Footnote, NoData, PageSection, PushedBar, Pressable, SectionEmpty, Segmented, StatTile, useSheet } from '@/ui';
import { Gauge, RANGE_DAYS, RANGE_KEYS, RANGE_NAMES, RangeControl, rangeWindow, TrendChart, TrendTable, windowLabel, type RangeKey } from '@/ui/charts';
import { useLog } from '../log/useLog';
import { trendTone } from './context';
import { rangeLabel } from './data';
import { agoWords } from './feed';
import { healthWord, type HealthLink } from './healthDays';
import { MetricIcon } from './icons';
import { bandWords, buildMetric, daysWords, HISTORY_DAYS, isMetricId, leadVariant, METRICS, valueDateWords, type MetricId, type MetricModel } from './metrics';
import { EasyPaceSheet, LiftsSheet } from './sheets';
import { useHealthLink } from './useHealthDays';
import { useMetricSource } from './useMetrics';
import { useNow } from './useNow';
import './progress.css';
import './metric.css';

// ---------- the span: a per-viewer convenience, remembered on this device ----------
const RANGE_KEY = 'logbook.metric.range';
const readRange = (): RangeKey => {
  try {
    // "1Y" was this span's name before it matched the Progress range control ("12M")
    const v = localStorage.getItem(RANGE_KEY)?.replace(/^1Y$/, '12M');
    return (RANGE_KEYS as readonly string[]).includes(v ?? '') ? (v as RangeKey) : '3M';
  } catch {
    return '3M';
  }
};
const saveRange = (k: RangeKey) => {
  try {
    localStorage.setItem(RANGE_KEY, k);
  } catch {
    /* private mode: this session only */
  }
};

const md = (d: string) => fmtDate('md', d);
/** The shortest span that holds every day since `since`. */
const fitRange = (since: string, today: string): RangeKey => RANGE_KEYS.find((k) => RANGE_DAYS[k] >= daysBetween(since, today) + 1) ?? '12M';
const shorterOf = (a: RangeKey, b: RangeKey) => (RANGE_DAYS[a] <= RANGE_DAYS[b] ? a : b);
/** The chart card's title for a span that ends today: days for a month, months beyond it. */
const SPAN_WORDS: Record<RangeKey, string> = { '1M': 'Last 30 days', '3M': 'Last 3 months', '6M': 'Last 6 months', '12M': 'Last 12 months' };
const unitText = (u: string) => (u === '%' ? '%' : u);
const TONE_ICON = { ok: CircleCheck, up: CircleArrowUp, down: CircleArrowDown, none: Hourglass } as const;

/** "Updated 6 m ago" under each tile: the last sync for synced runs, else the last day with data. */
const freshness = (m: MetricModel, stravaAt: string | null, now: number, today: string, link: HealthLink) => {
  if (!m.latest) return m.def.health ? healthWord(m, link) : 'No data yet';
  if ((m.def.id === 'mileage' || m.def.id === 'pace') && stravaAt) {
    const a = agoWords(stravaAt, now);
    if (a) return `Updated ${a}`;
  }
  return `Updated ${m.latest === today ? 'today' : m.latest === shiftDays(today, -1) ? 'yesterday' : md(m.latest)}`;
};

/**
 * A metric's page (docs/shape-system.md §6 "A metric or detail page", references 378, 381, 648, 670), pushed from Progress at
 * /progress/metric/:id. A round back button, the name centered with the value's date under it, a round info button that
 * scrolls to the explainer; the hero (the big number, or a gauge for a share) with its status word and your usual range; two
 * stat tiles that say when they were updated; the chart card (its metric chips, the chart, the range control); the 3 to 90
 * day trend table in a card; and the explainer card: what it is, why it matters, how it is worked out. An Apple Health metric
 * with no readings keeps every piece of that with dashes in it, says where the connection stands (not connected, syncing,
 * no readings yet) and, when nothing is connected, offers the way to connect.
 */
export default function MetricPage(): React.JSX.Element {
  const params = useRouteParams();
  const nav = useNav();
  const link = useHealthLink();
  const id: MetricId = isMetricId(params.id) ? params.id : 'mileage';
  const def = METRICS[id];
  const [stored] = useState<RangeKey>(readRange);
  // the span picked on this visit; until then the remembered one, never longer than the data (MP2: no 3-month chart for 2 days)
  const [picked, setPicked] = useState<RangeKey | null>(null);
  // the chip the person picked; until they pick one the page opens on the variant that has something to show
  const [pickedVariant, setVariant] = useState<string | null>(null);
  const about = useRef<HTMLElement>(null);
  const setRange = (k: RangeKey) => {
    setPicked(k);
    saveRange(k);
  };
  const log0 = useLog([]);
  const t = log0.today;
  const probeLog = useLog(useMemo(() => monthsBetween(shiftDays(t, -(HISTORY_DAYS + 28)), t), [t]));
  const probeSrc = useMetricSource(probeLog, shiftDays(t, -(HISTORY_DAYS + 28)));
  const variantId = useMemo(() => pickedVariant ?? leadVariant(def, probeSrc, rangeWindow(t, '1M')), [pickedVariant, def, probeSrc, t]);
  const since = useMemo(() => buildMetric(def, variantId, probeSrc, rangeWindow(t, '1M')).since, [def, variantId, probeSrc, t]);
  const range: RangeKey = picked ?? (since ? shorterOf(stored, fitRange(since, t)) : stored);
  const window = rangeWindow(t, range);
  const start = useMemo(() => {
    const a = shiftDays(window.from, -(90 + 28));
    const b = shiftDays(t, -(HISTORY_DAYS + 28));
    return a < b ? a : b;
  }, [window.from, t]);
  const months = useMemo(() => monthsBetween(start, t), [start, t]);
  const log = useLog(months);
  const src = useMetricSource(log, start);
  const m = useMemo(() => buildMetric(def, variantId, src, window), [def, variantId, src, window.from, window.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const now = useNow(60_000);
  const fresh = freshness(m, STRAVA_BUILT && log.strava?.connected ? log.strava.lastSyncAt : null, now, t, link);
  // pace needs a timed run, and only a connected source has those: with one on offer and none connected, the way to connect
  const paceSource = STRAVA_BUILT && id === 'pace' && !m.hasData && log.features.strava && !log.strava?.connected;
  // an Apple Health metric with no readings says where the connection stands instead of the generic empty word
  const status = def.health ? healthWord(m, link) : m.status;
  const v = m.variant;
  const band = bandWords(m);
  const tone = trendTone(m);
  const ToneIcon = TONE_ICON[tone];
  const labels = m.dates.map((d) => md(d));
  // stretches in the trend table with something to compare: the table shows from two
  const trendRows = m.trend.filter((r) => r.dir != null && (r.change != null || r.dir === 'flat')).length;
  const when = valueDateWords(m, t);
  const dateLine = m.value != null ? when.charAt(0).toUpperCase() + when.slice(1) : def.health ? status : 'No data yet';
  const name = id === 'hrv' ? 'HRV' : id === 'rhr' ? 'resting HR' : def.name.toLowerCase();
  // a share (consistency) reads best on the gauge; everything else is one big number
  const gauge = v.unit === '%';
  const spanWords = SPAN_WORDS[range];
  const third = v.agg === 'sum' ? (m.hasData ? `${v.format(m.total)} ${unitText(v.unit)} in all` : null) : m.hasData ? daysWords(m.days, id === 'pace' ? 'run day' : 'day') : null;

  return (
    <div className="page pg-page mp-page">
      <PushedBar
        title={def.name}
        eyebrow={dateLine}
        trailing={
          <button type="button" className="icon-btn pressable mp-info" aria-label={`About ${name}`} onClick={() => about.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <Info size={19} aria-hidden="true" />
          </button>
        }
      />

      {!m.hasData ? (
        // nothing to read yet: the screen's empty state (one sentence, one way to fill it), no tiles, no plot, no dashes (MP2)
        <section className="card mp-empty" aria-label={def.name}>
          <EmptyState
            verb={
              def.health && !link.connected && !link.syncing
                ? { label: 'Connect Apple Health', onPress: () => nav.go('/settings/connections') }
                : paceSource
                  ? { label: 'Connect a source', onPress: () => nav.go('/settings/connections') }
                  : undefined
            }
          >
            {def.health && link.syncing ? 'Syncing with Apple Health. Your readings show here when it is done.' : def.emptyLine}
          </EmptyState>
        </section>
      ) : (
        <>
          <section className="mp-hero" aria-label={`${def.name}: ${m.value != null ? `${v.format(m.value)} ${v.unit}` : 'no value yet'}. ${status}${band ? `. ${band}` : ''}`}>
            <span className="mp-halo" aria-hidden="true" />
            {gauge ? (
              <Gauge
                value={m.value != null ? m.value / 100 : null}
                band={m.band ? [m.band.lo / 100, m.band.hi / 100] : null}
                center={
                  m.value != null ? (
                    <>
                      {v.format(m.value)}
                      <small className="mp-unit">%</small>
                    </>
                  ) : (
                    <NoData />
                  )
                }
                min="0"
                max="100"
                size={236}
                stroke={14}
                label={`${def.name}: ${m.value != null ? `${v.format(m.value)} percent` : 'no value yet'}`}
              />
            ) : m.value != null ? (
              <span className="mp-big" aria-hidden="true">
                {v.format(m.value)}
                <small>{unitText(v.unit)}</small>
              </span>
            ) : (
              <span className="mp-big is-empty" aria-hidden="true">
                <NoData />
              </span>
            )}
            <span className={`mp-status is-${tone}`} aria-hidden="true">
              <ToneIcon size={16} strokeWidth={2.2} aria-hidden="true" />
              {status}
            </span>
            <span className="mp-usual" aria-hidden="true">
              {band ?? 'Your usual range shows after 2 weeks'}
            </span>
          </section>

          <div className="tiles mp-tiles">
            <StatTile icon={<Sigma size={18} />} label="Average" value={m.avg != null ? v.format(m.avg) : <NoData />} unit={m.avg != null ? unitText(v.unit) : undefined} context={fresh} />
            <StatTile icon={<Trophy size={18} />} label={v.bestLabel ?? (v.invert ? 'Fastest' : 'High')} value={m.best ? v.format(m.best.v) : <NoData />} unit={m.best ? unitText(v.unit) : undefined} context={m.best ? `On ${md(m.best.d)}` : fresh} />
          </div>

          <section className="card mp-card" aria-label="Chart">
            <div className="mp-card-head">
              <span className="mp-card-title">{spanWords}</span>
              {third ? <span className="mp-card-meta">{third}</span> : null}
            </div>
            {def.variants.length > 1 ? (
              // the series switch shares the screen with the range control: it is the quiet one (F9, guide 6.3 amendment)
              <Segmented className="mp-series" tone="quiet" label="Show" value={v.id} onChange={(k) => setVariant(k)} options={def.variants.map((x) => [x.id, x.chip] as [string, string])} />
            ) : null}
            <TrendChart
              label={`${v.lineName}, ${windowLabel(window, t)}. ${m.value != null ? `Latest ${v.format(m.value)} ${v.unit}.` : 'No data yet.'}`}
              line={m.line}
              bars={v.bars ? m.daily : undefined}
              dots={v.sparse ? m.daily : undefined}
              band={m.band}
              // a share reads on a 0 to 100 axis, even when its average is exactly 100
              domain={v.percent ? [0, 100] : undefined}
              // a share's average of nothing is not a line worth drawing: no pill sitting on the baseline
              avg={m.hasData && !(v.percent && !m.avg) ? m.avg : null}
              labels={labels}
              format={v.axis}
              invert={v.invert}
              zero={v.zero}
              steps={v.steps}
              fill={!v.sparse}
              height={210}
              empty={<span>{def.emptyLine}</span>}
              readout={(i) =>
                i == null ? (
                  <span className="mp-readout">{v.lineName}</span>
                ) : (
                  <span className="mp-readout on">
                    {fmtDate('short', m.dates[i]!)} · {m.line[i] != null ? `${v.format(m.line[i]!)} ${v.unit}` : 'No data'}
                    {m.daily[i] != null && (v.bars || v.sparse) ? ` · day ${v.format(m.daily[i]!)}` : ''}
                  </span>
                )
              }
            />
            <RangeControl className="mp-range" value={range} options={RANGE_KEYS} words={RANGE_NAMES} onChange={setRange} label="Range" />
          </section>

          <PageSection className="mp-sec" title="Trend" meta={trendRows >= 2 ? 'Up to today' : undefined}>
            {trendRows >= 2 ? (
              <>
                <div className="card mp-table">
                  <TrendTable rows={m.trend} invert={v.invert} change={v.change} label={`${def.name} trend`} />
                </div>
                <Footnote>{v.method}</Footnote>
              </>
            ) : (
              // the table waits for two stretches it can compare (MP1): never a column of "Not enough yet"
              <SectionEmpty icon={<Hourglass size={18} />} title="No trend yet" line="Shows after two weeks of data." />
            )}
          </PageSection>
        </>
      )}

      {m.hasData ? <More id={id} today={t} /> : null}

      <PageSection className="mp-sec" title={`About ${name}`} ref={about}>
        <div className="card mp-explain">
          <div className="mp-qa">
            <h3 className="mp-q">What it is</h3>
            <p className="mp-a">{def.what}</p>
          </div>
          <div className="mp-qa">
            <h3 className="mp-q">Why it matters</h3>
            <p className="mp-a">{def.why}</p>
          </div>
          <div className="mp-qa">
            <h3 className="mp-q">How it’s worked out</h3>
            <p className="mp-a">{def.how}</p>
          </div>
        </div>
        <Footnote className="mp-note">{DISCLAIMER}</Footnote>
      </PageSection>
    </div>
  );
}

/**
 * The detail behind some metrics, in the sheets Progress already has: each run's easy pace, each lift's line. Each sheet
 * reads its own history, so one opened before that history has landed fills in when it does.
 */
const More = ({ id, today }: { id: MetricId; today: string }) => {
  const sheet = useSheet();
  const from = shiftDays(today, -90);
  if (id === 'pace') {
    const open = () => sheet.open({ title: 'Easy pace', eyebrow: rangeLabel('3M'), body: <EasyPaceSheet from={from} today={today} range="3M" />, wide: true });
    return <MoreRow id={id} title="Easy runs, one by one" sub="Last 3 months" onPress={open} />;
  }
  if (id === 'lifts') {
    const open = () => sheet.open({ title: 'Lifts', eyebrow: rangeLabel('3M'), body: <LiftsSheet from={from} today={today} range="3M" />, wide: true });
    return <MoreRow id={id} title="Estimated max by lift" sub="Last 3 months" onPress={open} />;
  }
  return null;
};
const MoreRow = ({ id, title, sub, onPress }: { id: MetricId; title: string; sub: string; onPress: () => void }) => (
  <div className="group mp-more">
    <Pressable className="pg-drill" press="surface" onPress={onPress} label={`${title}. ${sub}. Open`}>
      <span className="icon-tile" aria-hidden="true">
        <MetricIcon id={id} size={17} />
      </span>
      <span className="pg-drill-main">
        <span className="pg-drill-title">{title}</span>
        <span className="pg-drill-sub">{sub}</span>
      </span>
      <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
    </Pressable>
  </div>
);
