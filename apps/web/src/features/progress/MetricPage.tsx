import { fmtDate, monthsBetween, shiftDays } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useAllLifts } from '@/api/queries';
import { PushedBar, Pressable, useSheet } from '@/ui';
import { maxOffset, RANGE_DAYS, RANGE_KEYS, RangeControl, rangeWindow, TrendChart, TrendTable, windowLabel, type RangeKey } from '@/ui/charts';
import { useLog } from '../log/useLog';
import { easyPace, liftGroups, rangeLabel } from './data';
import { syncWords } from './feed';
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

const up = (s: string) => s.toUpperCase();
const md = (d: string) => fmtDate('md', d);
const unitText = (u: string) => (u === '%' ? '%' : u);

/** The freshness under each tile: Strava's sync for runs, else the last day with data. */
const freshness = (m: MetricModel, strava: string | null, today: string) => {
  if (m.def.health) return 'Not connected';
  if ((m.def.id === 'mileage' || m.def.id === 'pace') && strava) return strava;
  if (!m.latest) return 'No data yet';
  return `Updated ${m.latest === today ? 'today' : m.latest === shiftDays(today, -1) ? 'yesterday' : md(m.latest)}`;
};

/**
 * A metric's page (docs/inspiration.md §3 "Metric page"), pushed from Progress at /progress/metric/:id. Top to bottom: the
 * icon and name, the big number with its unit and its date, the status word with your usual range on the right; the
 * chart with its metric chips and the range control; stat tiles that say when they were updated; the 3 to 90 day trend
 * table; and what the metric is, why it matters and how it is worked out. An Apple Health metric keeps every piece of
 * that with dashes in it and says it comes with Apple Health.
 */
export default function MetricPage(): React.JSX.Element {
  const params = useRouteParams();
  const id: MetricId = isMetricId(params.id) ? params.id : 'mileage';
  const def = METRICS[id];
  const [range, setRangeState] = useState<RangeKey>(readRange);
  const [offset, setOffset] = useState(0);
  const [variantId, setVariant] = useState(def.variants[0]!.id);
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
  const sync = syncWords(log.strava, now);
  const fresh = freshness(m, sync, t);
  const v = m.variant;
  const band = bandWords(m);
  // `<` stops at the span that holds your first day of data
  const canPrev = m.hasData && offset < maxOffset(t, range, m.since);
  const labels = m.dates.map((d) => up(md(d)));
  const fmtVal = (x: number | null) => (x == null ? '–' : v.format(x));

  return (
    <div className="page pg-page mp-page">
      <PushedBar title={def.name} />
      <header className="mp-head">
        <span className="mp-icon" aria-hidden="true">
          <MetricIcon id={id} size={18} />
        </span>
        <span className="mp-name">{def.name}</span>
      </header>
      <div className="mp-value" role="group" aria-label={`${def.name}: ${m.value != null ? `${v.format(m.value)} ${v.unit}` : 'no value yet'}. ${m.status}${band ? `. ${band}` : ''}`}>
        <span className={`ck-big stamp mp-big ${m.value == null ? 'is-empty' : ''}`} aria-hidden="true">
          {fmtVal(m.value)}
          {m.value != null ? <small>{unitText(v.unit)}</small> : null}
        </span>
        <span className="mp-date" aria-hidden="true">
          {m.value != null ? valueDateWords(m, t) : def.health ? 'Not connected yet' : 'No data yet'}
        </span>
      </div>
      <div className="mp-status-row" aria-hidden="true">
        <span className={`mp-status ${m.standing ? `is-${m.standing}` : ''}`}>{m.status}</span>
        <span className="mp-usual">{band ?? (m.hasData ? 'Usual range: after 2 weeks' : '')}</span>
      </div>

      <section className="mp-card" aria-label="Chart">
        {def.variants.length > 1 ? (
          <div className="mp-chips" role="radiogroup" aria-label="Show">
            {def.variants.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={x.id === v.id} className={`chip-btn mp-chip ${x.id === v.id ? 'on' : ''}`} onClick={() => setVariant(x.id)}>
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
          height={200}
          empty={<span>{def.health ? 'Comes with Apple Health' : def.emptyLine}</span>}
          readout={(i) =>
            i == null ? (
              <span className="mp-readout caps">{v.lineName}</span>
            ) : (
              <span className="mp-readout caps on">
                {fmtDate('short', m.dates[i]!)} · {m.line[i] != null ? `${v.format(m.line[i]!)} ${v.unit}` : 'No data'}
                {m.daily[i] != null && (v.bars || v.sparse) ? ` · day ${v.format(m.daily[i]!)}` : ''}
              </span>
            )
          }
        />
        <RangeControl value={range} onChange={setRange} onPrev={() => setOffset((o) => o + 1)} onNext={() => setOffset((o) => Math.max(0, o - 1))} canPrev={canPrev} canNext={offset > 0} />
        <p className="mp-window caps">{offset === 0 ? `Last ${RANGE_DAYS[range]} days` : windowLabel(window, t)}</p>
      </section>

      <div className="mp-tiles" role="list" aria-label="Stats">
        <Tile label="Average" value={fmtVal(m.avg)} unit={m.avg != null ? unitText(v.unit) : undefined} note={fresh} />
        <Tile label={v.invert ? 'Fastest' : 'High'} value={fmtVal(m.best?.v ?? null)} unit={m.best ? unitText(v.unit) : undefined} sub={m.best ? md(m.best.d) : undefined} note={fresh} />
        {v.agg === 'sum' ? (
          <Tile label="Total" value={m.hasData ? v.format(m.total) : '–'} unit={m.hasData ? unitText(v.unit) : undefined} sub={offset === 0 ? `Last ${RANGE_DAYS[range]} days` : undefined} note={fresh} />
        ) : (
          <Tile label={id === 'pace' ? 'Run days' : 'Days'} value={m.hasData ? String(m.days) : '–'} sub={offset === 0 ? `Last ${RANGE_DAYS[range]} days` : undefined} note={fresh} />
        )}
      </div>

      <section className="mp-sec" aria-labelledby="mp-trend">
        <h2 className="section-title" id="mp-trend">
          Trend
        </h2>
        <TrendTable rows={m.trend} invert={v.invert} change={v.change} footnote={`${v.method} Always up to today.`} label={`${def.name} trend`} />
      </section>

      <More id={id} log={log} today={t} />

      <section className="mp-sec mp-explain" aria-labelledby="mp-about">
        <h2 className="section-title" id="mp-about">
          About {def.name.toLowerCase().startsWith('hrv') ? 'HRV' : def.name.toLowerCase()}
        </h2>
        <h3 className="mp-q">What it is</h3>
        <p className="mp-a">{def.what}</p>
        <h3 className="mp-q">Why it matters</h3>
        <p className="mp-a">{def.why}</p>
        <h3 className="mp-q">How it’s worked out</h3>
        <p className="mp-a">{def.how}</p>
        {def.health ? <p className="mp-a mp-note">Apple Health reading is on its way. Until then this page stays empty rather than guess.</p> : null}
      </section>
    </div>
  );
}

const Tile = ({ label, value, unit, sub, note }: { label: string; value: string; unit?: string; sub?: string; note: string }) => (
  <div className="mp-tile" role="listitem">
    <span className="caps">{label}</span>
    <span className="stamp mp-tile-num">
      {value}
      {unit ? <small>{unit}</small> : null}
    </span>
    {sub ? <span className="mp-tile-sub">{sub}</span> : null}
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
    return <MoreRow title="Easy runs, one by one" sub="Last 3 months" onPress={open} />;
  }
  if (id === 'lifts') {
    const from = shiftDays(today, -90);
    const open = () => sheet.open({ title: 'Lifts', eyebrow: rangeLabel('3M'), body: <LiftsSheet groups={liftGroups(lifts.data ?? [], from, today)} range="3M" />, wide: true });
    return <MoreRow title="Each lift’s estimated max" sub="Last 3 months" onPress={open} />;
  }
  return null;
};
const MoreRow = ({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) => (
  <div className="list-edge mp-more">
    <Pressable className="pg-row" press="surface" onPress={onPress} label={`${title}. Open`}>
      <span className="pg-row-main">
        <span className="pg-row-title">{title}</span>
        <span className="pg-row-sub">{sub}</span>
      </span>
      <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
    </Pressable>
  </div>
);
