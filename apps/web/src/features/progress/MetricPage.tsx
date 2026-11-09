import { fmtDate, monthsBetween, shiftDays } from '@logbook/shared';
import { ChevronRight, CircleArrowDown, CircleArrowUp, CircleCheck, Hourglass, Info, Sigma, Trophy } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useAllLifts } from '@/api/queries';
import { PushedBar, Pressable, useSheet } from '@/ui';
import { Gauge, maxOffset, RANGE_DAYS, RANGE_KEYS, RangeControl, rangeWindow, TrendChart, TrendTable, windowLabel, type RangeKey } from '@/ui/charts';
import { useLog } from '../log/useLog';
import { trendTone } from './context';
import { easyPace, liftGroups, rangeLabel } from './data';
import { agoWords } from './feed';
import { MetricIcon } from './icons';
import { bandWords, buildMetric, HISTORY_DAYS, isMetricId, METRICS, valueDateWords, type MetricId, type MetricModel } from './metrics';
import { EasyPaceSheet, LiftsSheet } from './sheets';
import { useMetricSource } from './useMetrics';
import { useNow } from './useNow';
import './progress.css';
import './metric.css';

// ---------- the span: a per-viewer convenience, remembered on this device ----------
const RANGE_KEY = 'logbook.metric.range';
const readRange = (): RangeKey => {
  try {
    const v = localStorage.getItem(RANGE_KEY);
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
const unitText = (u: string) => (u === '%' ? '%' : u);
const TONE_ICON = { ok: CircleCheck, up: CircleArrowUp, down: CircleArrowDown, none: Hourglass } as const;

/** "Updated 6 m ago" under each tile: Strava's last sync for runs, else the last day with data. */
const freshness = (m: MetricModel, stravaAt: string | null, now: number, today: string) => {
  if (m.def.health) return 'Not connected yet';
  if (!m.latest) return 'No data yet';
  if ((m.def.id === 'mileage' || m.def.id === 'pace') && stravaAt) {
    const a = agoWords(stravaAt, now);
    if (a) return `Updated ${a}`;
  }
  return `Updated ${m.latest === today ? 'today' : m.latest === shiftDays(today, -1) ? 'yesterday' : md(m.latest)}`;
};

/**
 * A metric's page (docs/shape-system.md §6 "A metric or detail page", references 378, 381, 648, 670), pushed from Progress at
 * /progress/metric/:id. A round back button, the name centred with the value's date under it, a round info button that
 * scrolls to the explainer; the hero (the big number, or a gauge for a share) with its status word and your usual range; two
 * stat tiles that say when they were updated; the chart card (its metric chips, the chart, the range control); the 3 to 90
 * day trend table in a card; and the explainer card: what it is, why it matters, how it is worked out. An Apple Health metric
 * keeps every piece of that with dashes in it and says it comes with Apple Health.
 */
export default function MetricPage(): React.JSX.Element {
  const params = useRouteParams();
  const id: MetricId = isMetricId(params.id) ? params.id : 'mileage';
  const def = METRICS[id];
  const [range, setRangeState] = useState<RangeKey>(readRange);
  const [offset, setOffset] = useState(0);
  const [variantId, setVariant] = useState(def.variants[0]!.id);
  const about = useRef<HTMLElement>(null);
  const setRange = (k: RangeKey) => {
    setRangeState(k);
    setOffset(0);
    saveRange(k);
  };
  const log0 = useLog([]);
  const t = log0.today;
  const window = rangeWindow(t, range, offset);
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
  const fresh = freshness(m, log.strava?.connected ? log.strava.lastSyncAt : null, now, t);
  const v = m.variant;
  const band = bandWords(m);
  const tone = trendTone(m);
  const ToneIcon = TONE_ICON[tone];
  // `<` stops at the span that holds your first day of data
  const canPrev = m.hasData && offset < maxOffset(t, range, m.since);
  const labels = m.dates.map((d) => md(d));
  const fmtVal = (x: number | null) => (x == null ? '–' : v.format(x));
  const when = valueDateWords(m, t);
  const dateLine = m.value != null ? when.charAt(0).toUpperCase() + when.slice(1) : def.health ? 'Not connected yet' : 'No data yet';
  const name = def.name.toLowerCase().startsWith('hrv') ? 'HRV' : def.name.toLowerCase();
  // a share (consistency) reads best on the gauge; everything else is one big number
  const gauge = v.unit === '%';
  const spanWords = offset === 0 ? `Last ${RANGE_DAYS[range]} days` : windowLabel(window, t);
  const third = v.agg === 'sum' ? (m.hasData ? `${v.format(m.total)} ${unitText(v.unit)} in all` : null) : m.hasData ? `${m.days} ${id === 'pace' ? 'run days' : 'days'}` : null;

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

      <section className="mp-hero" aria-label={`${def.name}: ${m.value != null ? `${v.format(m.value)} ${v.unit}` : 'no value yet'}. ${m.status}${band ? `. ${band}` : ''}`}>
        <span className="mp-halo" aria-hidden="true" />
        {gauge ? (
          <Gauge
            value={m.value != null ? m.value / 100 : null}
            band={m.band ? [m.band.lo / 100, m.band.hi / 100] : null}
            center={
              <>
                {fmtVal(m.value)}
                <small className="mp-unit">%</small>
              </>
            }
            min="0"
            max="100"
            size={236}
            stroke={14}
            label={`${def.name}: ${m.value != null ? `${v.format(m.value)} percent` : 'no value yet'}`}
          />
        ) : (
          <span className={`mp-big ${m.value == null ? 'is-empty' : ''}`} aria-hidden="true">
            {fmtVal(m.value)}
            {m.value != null ? <small>{unitText(v.unit)}</small> : null}
          </span>
        )}
        <span className={`mp-status is-${tone}`} aria-hidden="true">
          <ToneIcon size={16} strokeWidth={2.2} aria-hidden="true" />
          {m.status}
        </span>
        <span className="mp-usual" aria-hidden="true">
          {band ?? (m.hasData ? 'Your usual range shows after 2 weeks' : '')}
        </span>
      </section>

      <div className="tiles mp-tiles" role="list" aria-label="Stats">
        <Tile icon={<Sigma size={16} />} label="Average" value={fmtVal(m.avg)} unit={m.avg != null ? unitText(v.unit) : undefined} note={fresh} />
        <Tile icon={<Trophy size={16} />} label={v.invert ? 'Fastest' : 'High'} value={fmtVal(m.best?.v ?? null)} unit={m.best ? unitText(v.unit) : undefined} note={m.best ? `On ${md(m.best.d)}` : fresh} />
      </div>

      <section className="card mp-card" aria-label="Chart">
        <div className="mp-card-head">
          <span className="mp-card-title">{spanWords}</span>
          {third ? <span className="mp-card-meta">{third}</span> : null}
        </div>
        {def.variants.length > 1 ? (
          <div className="mp-chips" role="radiogroup" aria-label="Show">
            {def.variants.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={x.id === v.id} className={`mp-chip ${x.id === v.id ? 'on' : ''}`} onClick={() => setVariant(x.id)}>
                {x.chip}
              </button>
            ))}
          </div>
        ) : null}
        <TrendChart
          label={`${v.lineName}, ${windowLabel(window, t)}. ${m.value != null ? `Latest ${v.format(m.value)} ${v.unit}.` : 'No data yet.'}`}
          line={m.line}
          bars={v.bars ? m.daily : undefined}
          dots={v.sparse ? m.daily : undefined}
          band={m.band}
          avg={m.hasData ? m.avg : null}
          labels={labels}
          format={v.axis}
          invert={v.invert}
          zero={v.zero}
          steps={v.steps}
          fill={!v.sparse}
          height={210}
          empty={<span>{def.health ? 'Comes with Apple Health' : def.emptyLine}</span>}
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
        <RangeControl value={range} onChange={setRange} onPrev={() => setOffset((o) => o + 1)} onNext={() => setOffset((o) => Math.max(0, o - 1))} canPrev={canPrev} canNext={offset > 0} />
      </section>

      <section className="mp-sec" aria-labelledby="mp-trend">
        <div className="pg-head">
          <h2 className="pg-head-title" id="mp-trend">
            Trend
          </h2>
          <span className="pg-head-meta">Up to today</span>
        </div>
        <div className="card mp-table">
          <TrendTable rows={m.trend} invert={v.invert} change={v.change} label={`${def.name} trend`} />
        </div>
        <p className="mp-foot">{v.method}</p>
      </section>

      <More id={id} log={log} today={t} />

      <section className="mp-sec" aria-labelledby="mp-about" ref={about}>
        <div className="pg-head">
          <h2 className="pg-head-title" id="mp-about">
            About {name}
          </h2>
        </div>
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
          {def.health ? <p className="mp-a mp-note">This fills in once Apple Health syncs into your Logbook. Until then the page stays empty rather than guess.</p> : null}
        </div>
      </section>
    </div>
  );
}

const Tile = ({ icon, label, value, unit, note }: { icon: React.ReactNode; label: string; value: string; unit?: string; note: string }) => (
  <div className="tile mp-tile" role="listitem">
    <span className="tile-label">
      {icon}
      <span>{label}</span>
    </span>
    <span className={`tile-value ${value === '–' ? 'is-empty' : ''}`}>
      {value}
      {unit ? <small>{unit}</small> : null}
    </span>
    <span className="mp-tile-note">{note}</span>
  </div>
);

/** The detail behind some metrics, in the sheets Progress already has: each run's easy pace, each lift's line. */
const More = ({ id, log, today }: { id: MetricId; log: ReturnType<typeof useLog>; today: string }) => {
  const sheet = useSheet();
  const lifts = useAllLifts();
  if (id === 'pace') {
    const from = shiftDays(today, -90);
    const open = () => sheet.open({ title: 'Easy pace', eyebrow: rangeLabel('3M'), body: <EasyPaceSheet ep={easyPace(log.snap, from, today, log.zones)} log={log} range="3M" />, wide: true });
    return <MoreRow id={id} title="Easy runs, one by one" sub="Last 3 months" onPress={open} />;
  }
  if (id === 'lifts') {
    const from = shiftDays(today, -90);
    const open = () => sheet.open({ title: 'Lifts', eyebrow: rangeLabel('3M'), body: <LiftsSheet groups={liftGroups(lifts.data ?? [], from, today)} range="3M" />, wide: true });
    return <MoreRow id={id} title="Each lift’s estimated max" sub="Last 3 months" onPress={open} />;
  }
  return null;
};
const MoreRow = ({ id, title, sub, onPress }: { id: MetricId; title: string; sub: string; onPress: () => void }) => (
  <div className="group mp-more">
    <Pressable className="pg-drill" press="surface" onPress={onPress} label={`${title}. Open`}>
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
