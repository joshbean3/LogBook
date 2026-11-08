import { clock, dayStatus, fmtDate, mi, monthsBetween, num, shiftDays, weekCheck, weekStreak, type LiftSet } from '@logbook/shared';
import { Activity as ActivityIcon, CalendarCheck, CalendarDays, ChevronRight, Dumbbell, Footprints, HeartPulse, Plus, RefreshCw, Route, Timer, TrendingUp, type LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav } from '@/app/NavController';
import { useAllLifts } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { dayCaption, EmptyState, NavBar, Pressable, Segmented, Ticker, useSheet } from '@/ui';
import { useLog, type Log } from '../log/useLog';
import { StravaPrimer } from '../onboarding/StravaPrimer';
import { Spark } from './charts';
import { adherence, consistency, easyPace, FUTURE_WEEKS, liftGroups, longRuns, paceText, pct, plural, RANGE_WEEKS, RANGES, rangeBounds, rangeLabel, rangePhrase, rangeSummary, signedPct, verdict, weekSeries, weekTitle, type Range } from './data';
import { MileageChart } from './MileageChart';
import { ActivitySheet, LiftDaySheet, SourceChip } from './ActivitySheet';
import { blockWords, stravaChip, tileStatus, trendTone } from './context';
import { activityFeed, FEED_FILTERS, feedDetail, monthCompare, monthWords, type FeedFilter, type FeedItem } from './feed';
import { MetricIcon } from './icons';
import { METRICS, type MetricId } from './metrics';
import { useMetricModels } from './useMetrics';
import { useNow } from './useNow';
import { useOpenSession } from '../sessions/SessionCard';
import { RangePill, TrendCard, TrendChart } from '@/ui/charts';
import { AdherenceSheet, ConsistencySheet, EasyPaceSheet, LiftsSheet, LongRunSheet, paceChange, useOpenWeek } from './sheets';
import './progress.css';
import './metric.css';
import '../journal/seg.css';

// ---------- the range: a per-viewer convenience, remembered on this device ----------
const RANGE_KEY = 'logbook.progress.range';
const readRange = (): Range => {
  try {
    const v = localStorage.getItem(RANGE_KEY);
    return RANGES.includes(v as Range) ? (v as Range) : '3M';
  } catch {
    return '3M';
  }
};
const useRange = () => {
  const [r, setR] = useState<Range>(readRange);
  const set = (v: Range) => {
    setR(v);
    try {
      localStorage.setItem(RANGE_KEY, v);
    } catch {
      /* private mode: this session only */
    }
  };
  return [r, set] as const;
};

/** Dev builds take `?asof=YYYY-MM-DD` to see the page as it reads on another day (early week, a new block). */
const useAsOf = (real: string) => {
  if (!import.meta.env.DEV) return real;
  const v = new URLSearchParams(window.location.search).get('asof');
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : real;
};

const md = (d: string) => fmtDate('md', d);

/** Every number on the page, from one pass over the log: the months that are loaded; a missing one is a quiet gap. */
const buildModel = (log: Log, sets: LiftSet[], t: string, range: Range, from: string) => {
  const all = weekSeries(log.snap, t, range, (m) => log.snap.loaded(m));
  // A longer range than the log is old never draws a field of empty weeks: it starts where the log does (never under
  // thirteen weeks), and the label says so.
  const firstData = all.findIndex((p) => p.ran > 0 || p.planned > 0);
  const cut = firstData < 0 ? 0 : Math.max(0, Math.min(firstData, all.length - FUTURE_WEEKS - RANGE_WEEKS['3M']));
  const pts = cut ? all.slice(cut) : all;
  const since = cut ? all[firstData]!.w : null;
  const streak = weekStreak(log.snap, t);
  const ran = pts.some((p) => p.ran > 0);
  return {
    range,
    pts,
    since,
    streak,
    ran,
    planned: pts.some((p) => p.planned > 0),
    v: ran ? verdict(log.snap, t, pts, streak.weeks) : null,
    sum: rangeSummary(pts),
    ad: adherence(log.snap, t, from, log.boot?.blocks ?? []),
    lr: longRuns(pts),
    ep: easyPace(log.snap, from, t, log.zones),
    lg: liftGroups(sets, from, t),
    c: consistency(
      log.snap,
      t,
      from,
      log.habits,
      (w) => weekCheck(log.snap, w).kept,
      (d) => dayStatus(log.snap, d),
    ),
  };
};
type Model = ReturnType<typeof buildModel>;

/** A section of the page: a plain sans header (an optional grey meta or an action at its right), then its cards. */
const Sec = ({ id, title, meta, children }: { id: string; title: string; meta?: ReactNode; children: ReactNode }) => (
  <section className="pg-sec" aria-labelledby={id}>
    <div className="pg-head">
      <h2 className="pg-head-title" id={id}>
        {title}
      </h2>
      {meta != null ? <span className="pg-head-meta">{meta}</span> : null}
    </div>
    {children}
  </section>
);

/**
 * Progress (docs/shape-system.md §6 "A tab", docs/inspiration.md §6): the NavBar (the date in caps, the serif title), the
 * context row (where runs come from and when Strava last answered; the block and its week, which opens Plan), the hero card
 * (this month's running miles in orange against last month's in grey), Trends as a grid of tiles that open the metric pages
 * (/progress/metric/:id), Vitals as tiles waiting on Apple Health, the Weeks card (the verdict, three numbers that follow the
 * finger, the weekly chart, the range) with its drill-downs in one inset group, and Activities as rows in one card under
 * their filter chips. The page builds from the months that are loaded: a month still on its way (or never answering) is a
 * quiet gap in the chart and is left out of the numbers, never the page skeleton. Links into other tabs go through `nav.go`;
 * `Connect Strava` opens the primer card as a sheet over Progress (Settings keeps its one door).
 */
export default function ProgressView() {
  const sheet = useSheet();
  const [range, setRange] = useRange();
  const t = useAsOf(useToday());
  const { from, to } = rangeBounds(t, range);
  const months = useMemo(() => monthsBetween(shiftDays(from, -63), to), [from, to]);
  const log = useLog(months);
  const lifts = useAllLifts();

  // one model from what is loaded; the snapshot only changes when a month does, so a scrub never rebuilds this
  const anyLoaded = months.some((m) => log.snap.loaded(m));
  const model = useMemo(() => (anyLoaded && log.boot ? buildModel(log, lifts.data ?? [], t, range, from) : null), [anyLoaded, log.snap, log.boot, lifts.data, t, range, from]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = <NavBar caps={{ cur: dayCaption(t, t) }} title={{ cur: 'Progress' }} gap={16} />;
  // nothing at all on this device yet: the bar alone, quietly, until the first month lands (no skeleton, no empty state)
  if (!model)
    return (
      <div className="page pg-page" aria-busy="true">
        {header}
      </div>
    );

  const connect = () => sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> });
  return (
    <div className="page pg-page">
      {header}
      <ContextRow log={log} t={t} onConnect={connect} />
      <MonthHero log={log} t={t} />
      <Trends log={log} />
      <Vitals />
      <Weeks m={model} t={t} range={range} setRange={setRange} log={log} onConnect={connect} />
      <Activities log={log} t={t} from={from} range={range} />
    </div>
  );
}

// ---------- the context row: where runs come from, and the block ----------
const ContextRow = ({ log, t, onConnect }: { log: Log; t: string; onConnect: () => void }) => {
  const nav = useNav();
  const now = useNow(60_000);
  const s = stravaChip(log.features.strava, log.strava, now);
  const blk = blockWords(log.boot?.blocks ?? [], t);
  const sIcon = (
    <span className={`ctx-ic pg-ctx-ic is-${s.tone}`} aria-hidden="true">
      {s.title === 'Strava' ? <RefreshCw size={16} className={s.sub === 'Syncing…' ? 'pg-spin' : ''} /> : <Footprints size={16} />}
    </span>
  );
  const sText = (
    <span className="ctx-text">
      <span className="ctx-title">{s.title}</span>
      <span className={`ctx-sub ${s.tone === 'warn' ? 'pg-ctx-warn' : ''}`}>{s.sub}</span>
    </span>
  );
  return (
    <div className="ctx-row pg-ctx-row">
      {s.tap ? (
        <Pressable className="ctx-chip pg-ctx-chip" press="scale" onPress={s.tap === 'connect' ? onConnect : () => nav.go('/settings/connections')} label={`${s.title}: ${s.sub}. ${s.tap === 'connect' ? 'Connect' : 'Open Data sources'}`}>
          {sIcon}
          {sText}
          <ChevronRight size={15} aria-hidden="true" />
        </Pressable>
      ) : (
        <div className="ctx-chip pg-ctx-chip" role="status" aria-label={`${s.title}: ${s.sub}`}>
          {sIcon}
          {sText}
        </div>
      )}
      {blk ? (
        <Pressable className="ctx-chip pg-ctx-chip" press="scale" onPress={() => nav.go('/plan')} label={`${blk.title}, ${blk.sub}. Open Plan`}>
          <span className="ctx-ic" aria-hidden="true">
            <CalendarDays size={16} />
          </span>
          <span className="ctx-text">
            <span className="ctx-title">{blk.title}</span>
            <span className="ctx-sub">{blk.sub}</span>
          </span>
        </Pressable>
      ) : null}
    </div>
  );
};

// ---------- the hero: this month's running total against last month's ----------
const monthName = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(`${d}T12:00:00`));
const MonthHero = ({ log, t }: { log: Log; t: string }) => {
  const mc = useMemo(() => monthCompare(log.snap, t), [log.snap, t]);
  const cur = monthName(mc.cur);
  const prev = monthName(mc.prev);
  const labels = Array.from({ length: mc.length }, (_, i) => (i === 0 ? md(shiftDays(mc.cur, i)) : String(i + 1)));
  const sentence = monthWords(mc, monthName);
  const curOn = mc.curTotal > 0;
  const prevOn = mc.prevLoaded && mc.prevTotal > 0;
  return (
    <section className="card pg-hero pg-month" aria-label={`${cur}: ${mi(mc.curTotal)} miles so far. ${mc.prevLoaded ? `${prev}: ${mi(mc.prevTotal)} miles. ` : ''}${sentence}`}>
      <span className="pg-glow" aria-hidden="true" />
      <div className="pg-month-top" aria-hidden="true">
        <span className="pg-month-cur">
          {/* never a zero as the headline: an empty month is a dash */}
          <span className={`pg-month-big ${curOn ? '' : 'is-dash'}`}>
            {curOn ? mi(mc.curTotal) : '–'}
            {curOn ? <small>mi</small> : null}
          </span>
          <span className="pg-mkey is-now">{cur} so far</span>
        </span>
        <span className="pg-month-prev">
          <span className={`pg-month-small ${prevOn ? '' : 'is-dash'}`}>
            {prevOn ? mi(mc.prevTotal) : '–'}
            {prevOn ? <small>mi</small> : null}
          </span>
          <span className="pg-mkey">{prev}</span>
        </span>
      </div>
      <p className="pg-month-words">{sentence}</p>
      <TrendChart
        label={`Running total of miles, ${cur} against ${prev}`}
        // two empty months draw the frame alone: a flat line at zero is not something to read
        line={curOn || mc.prevTotal > 0 ? mc.curLine : []}
        previous={mc.prevLoaded && (curOn || mc.prevTotal > 0) ? mc.prevLine : undefined}
        labels={labels}
        format={(v) => String(Math.round(v))}
        zero
        tone="accent"
        fill
        height={150}
        empty={<span>Your miles this month draw here.</span>}
        readout={(i) =>
          i == null ? null : (
            <span className="pg-readline">
              Day {i + 1} · {mc.curLine[i] != null ? `${mi(mc.curLine[i]!)} mi` : '–'} · {prev.slice(0, 3)} {mc.prevLine[i] != null ? `${mi(mc.prevLine[i]!)} mi` : '–'}
            </span>
          )
        }
      />
    </section>
  );
};

// ---------- Trends: a 2-column grid of tiles, each opening its metric page ----------
const CARD_IDS: readonly MetricId[] = ['mileage', 'pace', 'consistency', 'lifts'];
/** A tile has 150 px: the short name. */
const TILE_NAME: Partial<Record<MetricId, string>> = { mileage: 'Mileage', lifts: 'Lifts' };
const Trends = ({ log }: { log: Log }) => {
  const nav = useNav();
  const models = useMetricModels(log, CARD_IDS);
  return (
    <Sec id="pg-trends" title="Trends" meta="Last 30 days">
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
    </Sec>
  );
};

// ---------- Vitals: the Health Monitor tiles, empty until Apple Health ----------
const VITALS: Array<{ id: MetricId; label: string; unit: string }> = [
  { id: 'rhr', label: 'Resting HR', unit: 'bpm' },
  { id: 'hrv', label: 'HRV', unit: 'ms' },
  { id: 'sleep', label: 'Sleep', unit: 'h' },
];
const Vitals = () => {
  const nav = useNav();
  return (
    <Sec id="pg-vitals" title="Vitals" meta="Against your normal">
      <div className="tiles pg-tiles">
        {VITALS.map((x) => (
          <Pressable key={x.id} className="tile pg-vital" press="scale" onPress={() => nav.push(`/progress/metric/${x.id}`)} label={`${METRICS[x.id].name}: no data yet, comes with Apple Health. Open`}>
            <span className="pg-vital-main">
              <span className="tile-label">
                <MetricIcon id={x.id} size={16} />
                <span>{x.label}</span>
              </span>
              <span className="tile-value pg-vital-none">No data</span>
              <span className="pg-vital-foot">Comes with Apple Health</span>
            </span>
            <RangePill pos={null} />
          </Pressable>
        ))}
        {/* where the readings will come from: Data sources says when */}
        <Pressable className="pg-slot" press="scale" onPress={() => nav.go('/settings/connections')} label="Apple Health: not yet available. Open Data sources">
          <span className="pg-slot-ic" aria-hidden="true">
            <HeartPulse size={18} />
          </span>
          <span className="pg-slot-title">Apple Health</span>
          <span className="pg-slot-sub">Not yet available</span>
        </Pressable>
      </div>
    </Sec>
  );
};

// ---------- Weeks: the verdict, three numbers that follow the finger, the weekly chart, the range; then the drill-downs ----------
const Weeks = ({ m, t, range, setRange, log, onConnect }: { m: Model; t: string; range: Range; setRange: (r: Range) => void; log: Log; onConnect: () => void }) => {
  const nav = useNav();
  const sheet = useSheet();
  const openWeek = useOpenWeek(t);
  const [scrub, setScrubState] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  // while the finger is down the numbers are written as they are (no Ticker chasing them); on release each one springs
  // from the week it showed back to the range (a fresh Ticker, `from` the last value)
  const lastShown = useRef<Array<number | null>>([]);
  const [released, setReleased] = useState(0);
  const setScrub = (i: number | null) => {
    if (i == null && scrub != null) setReleased((n) => n + 1);
    setScrubState(i);
  };
  const pts = m.pts;
  // the range is a Segmented: no haptic on a change (§11.4)
  const pick = (r: Range) => {
    if (r !== range) setRange(r);
  };
  const pinch = (dir: -1 | 1) => {
    const r = RANGES[RANGES.indexOf(range) + dir];
    if (r) setRange(r);
  };
  const openAt = (i: number) => {
    const p = pts[i];
    if (!p) return;
    // the readout names this week while its sheet is up
    setOpened(i);
    openWeek(p.w, 'open', () => setOpened(null));
  };
  const gaps = pts.some((p) => p.missing);
  const chips = (
    <Segmented
      className="pg-range"
      label="Range"
      value={range}
      onChange={pick}
      options={RANGES.map((r) => [r, <span key={r} aria-label={rangeLabel(r)}>{r}</span>] as [Range, ReactNode])}
    />
  );

  // ---------- new account: the card keeps its place (the chart's shape as a ghost), one sentence, one verb ----------
  if (!m.ran && !gaps) {
    const strava = log.features.strava && !log.strava?.connected;
    return (
      <Sec id="pg-weeks" title="Weeks" meta={rangeLabel(range)}>
        <div className="card pg-weeks pg-weeks-empty">
          <EmptyState
            ghost="bars"
            verb={m.planned ? (strava ? { label: 'Connect Strava', onPress: onConnect } : { label: 'See the plan', onPress: () => nav.go('/plan') }) : { label: 'Plan a week', onPress: () => nav.go('/plan'), primary: true }}
          >
            {m.planned ? 'Your plan is set. Each run you log lands here.' : 'Plan a week and run it. This card draws the rest.'}
          </EmptyState>
        </div>
        {m.c.habitOf ? <Drills m={m} t={t} range={range} log={log} sheet={sheet} onConnect={onConnect} /> : null}
      </Sec>
    );
  }

  // ---------- the headline numbers: the range at rest, the week under the finger while scrubbing ----------
  const shown = scrub ?? opened;
  const sp = shown != null ? pts[shown] : null;
  const ctx = sp ? `${weekTitle(sp.w, t)}${sp.current ? ' · so far' : sp.future ? ' · planned' : ''}` : m.since ? `Since ${md(m.since)}` : rangeLabel(range);
  // a slot never shows a dash: while scrubbing (three slots that must hold still) an empty one says a word; at rest a stat with
  // no value yet (no finished week to average) is left out
  const slots: Array<{ label: string; value: number | null; word?: string; format: (v: number) => string; unit?: string }> = sp
    ? sp.missing
      ? [
          { label: 'Miles', value: null, word: 'Loading', format: mi },
          { label: 'Planned', value: null, word: '', format: num },
          { label: 'Runs', value: null, word: '', format: (v) => String(Math.round(v)) },
        ]
      : [
          { label: 'Miles', value: sp.future ? null : sp.ran, word: 'To run', format: mi, unit: 'mi' },
          { label: 'Planned', value: sp.planned || null, word: 'No plan', format: num, unit: 'mi' },
          { label: 'Runs', value: sp.future ? sp.plannedRuns : sp.runs, format: (v) => String(Math.round(v)) },
        ]
    : gaps
      ? // a month of the range not loaded: every number of the range would read the gap as weeks off and change by itself
        // when the month lands, so all three wait in their slots (review code F8, review 2 code N5 / feel N6)
        [
          { label: 'Avg week', value: null, word: 'Loading', format: mi },
          { label: 'Best week', value: null, word: 'Loading', format: mi },
          { label: 'Total', value: null, word: 'Loading', format: (v) => String(Math.round(v)) },
        ]
      : [
          { label: 'Avg week', value: m.sum.avg, format: mi, unit: 'mi' },
          { label: 'Best week', value: m.sum.best?.ran ?? null, format: mi, unit: 'mi' },
          { label: 'Total', value: m.sum.total, format: (v) => String(Math.round(v)), unit: 'mi' },
        ];
  if (scrub != null) lastShown.current = slots.map((x) => x.value);
  // VoiceOver reads what the slots show: never a number the screen is holding back
  const readWords = sp
    ? sp.missing
      ? `${ctx}: not loaded yet`
      : `${ctx}: ${sp.future ? '' : `${mi(sp.ran)} miles, `}${sp.planned ? `${num(sp.planned)} planned, ` : ''}${sp.future ? sp.plannedRuns : sp.runs} runs`
    : gaps
      ? `${ctx}: a month of this range is still loading`
      : `${ctx}: ${m.sum.avg != null ? `${mi(m.sum.avg)} miles a week on average, ` : ''}${m.sum.best ? `best week ${mi(m.sum.best.ran)}, ` : ''}${Math.round(m.sum.total)} miles in all`;
  // a month of the range not loaded: the verdict and the drill-downs would read the gap as weeks off (review code F8), so the
  // verdict says only that, in the same place, and the drill-downs wait under the chart's quiet gap
  const line = m.v && gaps ? { line: 'Your weeks so far.', sub: 'A month of this range is still on its way; its weeks are left blank.' } : m.v;

  return (
    <Sec id="pg-weeks" title="Weeks" meta={rangeLabel(range)}>
      <div className="card pg-hero pg-weeks" aria-label="Weekly miles" role="group">
        <span className="pg-eyebrow">{ctx}</span>
        {line ? (
          <>
            <p className="pg-verdict">{line.line}</p>
            <p className="pg-sub">{line.sub}</p>
          </>
        ) : null}
        <div className="pg-readout" role="status" aria-label={readWords}>
          {slots.map((s, i) =>
            s.value == null && !s.word ? null : (
              <span className="pg-slot-stat" key={i} aria-hidden="true">
                <span className="pg-slot-label">{s.label}</span>
                <span className="stamp pg-slot-num">
                  {s.value == null ? <span className="pg-slot-word">{s.word}</span> : scrub != null ? <span className="tnum">{s.format(s.value)}</span> : <Ticker key={released} value={s.value} format={s.format} from={released ? (lastShown.current[i] ?? undefined) : undefined} />}
                  {s.unit && s.value != null ? <small>{s.unit}</small> : null}
                </span>
              </span>
            ),
          )}
        </div>
        <MileageChart pts={pts} range={m.range} today={t} onScrub={setScrub} onOpen={openAt} onPinch={pinch} />
        {chips}
      </div>
      {gaps ? null : <Drills m={m} t={t} range={range} log={log} sheet={sheet} onConnect={onConnect} />}
    </Sec>
  );
};

/** A drill-down row in the Weeks group: an icon tile, the title over its words, a sparkline and one number, a chevron. */
const DrillRow = ({ icon: Icon, title, sub, spark, value, unit, onPress, label }: { icon: LucideIcon; title: string; sub: ReactNode; spark?: ReactNode; value?: ReactNode; unit?: string; onPress: () => void; label: string }) => (
  <Pressable className="pg-drill" press="surface" onPress={onPress} label={label}>
    <span className="icon-tile" aria-hidden="true">
      <Icon size={17} />
    </span>
    <span className="pg-drill-main">
      <span className="pg-drill-title">{title}</span>
      <span className="pg-drill-sub">{sub}</span>
    </span>
    {spark ? <span className="pg-drill-spark">{spark}</span> : null}
    {/* the number's column is auto: an empty slot is not drawn, so the sparkline sits against the chevron */}
    {value != null ? (
      <span className="pg-drill-val" aria-hidden="true">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
    ) : null}
    <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
  </Pressable>
);

/** The drill-downs under the Weeks card, in one inset group: each row a sparkline and one number, each opening its sheet. */
const Drills = ({ m, t, range, log, sheet, onConnect }: { m: Model; t: string; range: Range; log: Log; sheet: ReturnType<typeof useSheet>; onConnect: () => void }) => {
  const { ad, lr, ep, lg, c } = m;
  // "1 of 6 on plan · 5 to go": counts, never a percentage grade ("kept" is the week's word, review feel F6)
  const toGo = ad.weeks.reduce((s, w) => s + w.ahead, 0);
  const adSub = ad.weeks.length ? [ad.planned ? `${ad.kept} of ${ad.planned} on plan` : 'Nothing due yet', toGo ? `${toGo} to go` : null].filter(Boolean).join(' · ') : 'No plan in this range';
  // "5.3 mi lately · best 8.0 in Aug"
  const lrDelta = lr.recent > 0 ? `${mi(lr.recent)} mi lately${lr.best && lr.best.miles > lr.recent + 0.05 ? ` · best ${mi(lr.best.miles)} in ${lr.best.month}` : ' · your longest yet'}` : lr.best ? `Best ${mi(lr.best.miles)} in ${lr.best.month}` : 'No runs yet';
  const ch = paceChange(ep.now, ep.then);
  const epSub = [ch ? (ch === 'level' ? `Level with ${ep.thenMonth}` : `${ch} than ${ep.thenMonth}`) : `${ep.runs.length} easy ${plural(ep.runs.length, 'run')}`, ep.nowHr != null ? `${Math.round(ep.nowHr)} bpm` : null].filter(Boolean).join(' · ');
  const top = lg[0];
  // "Squat 225 × 5 · est. max 263": the set itself, then the estimate, in words
  const topLast = top ? top.days[top.days.length - 1]! : null;
  const liftSub = top && topLast ? `${top.name} ${topLast.weight} × ${topLast.reps} · est. max ${Math.round(topLast.e1rm)}` : `None ${rangePhrase(range)}`;
  const tp = pct(c.rows[0]!.hit, c.rows[0]!.of);
  const hp = pct(c.habitHit, c.habitOf);
  const eyebrow = rangeLabel(range);
  return (
    <div className="group pg-drills" aria-label="Drill-downs" role="group">
      {m.ran || ad.weeks.length ? (
        <DrillRow
          icon={CalendarCheck}
          title="Plan adherence"
          sub={adSub}
          spark={<Spark values={ad.weeks.map((w) => (w.planned ? w.kept / w.planned : null))} />}
          onPress={() => sheet.open({ title: 'Plan adherence', eyebrow: ad.block?.name ?? eyebrow, body: <AdherenceSheet ad={ad} today={t} range={range} log={log} />, wide: true })}
          label={`Plan adherence: ${adSub}. Open`}
        />
      ) : null}
      {m.ran ? (
        <DrillRow
          icon={Route}
          title="Long run"
          sub={lrDelta}
          spark={<Spark values={lr.points.map((p) => (p.miles > 0 ? p.miles : null))} />}
          onPress={() => sheet.open({ title: 'Long run', eyebrow, body: <LongRunSheet lr={lr} log={log} today={t} />, wide: true })}
          label={`Long run: ${lrDelta}. Open`}
        />
      ) : null}
      {ep.runs.length ? (
        <DrillRow
          icon={Timer}
          title="Easy pace"
          sub={epSub}
          spark={<Spark values={ep.weekly.map((w) => w.pace)} invert />}
          value={ep.now != null ? paceText(ep.now) : undefined}
          unit="/mi"
          onPress={() => sheet.open({ title: 'Easy pace', eyebrow, body: <EasyPaceSheet ep={ep} log={log} range={range} />, wide: true })}
          label={`Easy pace: ${ep.now != null ? `${paceText(ep.now)} a mile` : 'not enough runs yet'}. ${epSub}. Open`}
        />
      ) : null}
      <DrillRow
        icon={Dumbbell}
        title="Lifts"
        sub={liftSub}
        spark={top ? <Spark values={top.days.map((d) => d.e1rm)} /> : undefined}
        value={top && top.change != null ? signedPct(top.change) : undefined}
        onPress={() => sheet.open({ title: 'Lifts', eyebrow, body: <LiftsSheet groups={lg} range={range} />, wide: true })}
        label={`Lifts: ${top ? `${liftSub}${top.change != null ? `, ${signedPct(top.change)} since ${md(top.days[0]!.date)}` : ''}` : `none ${rangePhrase(range)}`}. Open`}
      />
      <DrillRow
        icon={TrendingUp}
        title="Consistency"
        sub={[hp != null ? `Habits ${hp}%` : null, tp != null ? `Training ${tp}%` : null].filter(Boolean).join(' · ') || 'Habits and training, day by day'}
        spark={<Spark values={c.habitWeeks.map((w) => w.v)} />}
        value={c.weeks ? c.keptWeeks : undefined}
        unit={c.weeks ? `of ${c.weeks}` : undefined}
        onPress={() => sheet.open({ title: 'Consistency', eyebrow, detent: 'large', body: <ConsistencySheet c={c} log={log} today={t} range={range} streak={m.streak} />, wide: true })}
        label={`Consistency: ${c.weeks ? `${c.keptWeeks} of ${c.weeks} weeks kept` : 'your first week is under way'}${hp != null ? `, habits ${hp}%` : ''}. Open`}
      />
      {log.features.strava && !log.strava?.connected ? (
        // Strava's door on Progress: the primer card as a sheet over Progress (no navigation; Settings keeps its own door, §1.3)
        <DrillRow icon={Plus} title="Connect Strava" sub="Runs land here on their own" onPress={onConnect} label="Connect Strava. Opens a card about it" />
      ) : null}
    </div>
  );
};

// ---------- Activities: filter chips, then the rows in one card, a source chip on every row ----------
const PAGE = 12;
const KIND_ICON = { run: Footprints, lift: Dumbbell, cross: ActivityIcon } as const;
const EMPTY_WORDS: Record<FeedFilter, string> = {
  all: 'Nothing logged in this range yet. Synced runs and runs you mark done land here.',
  runs: 'No runs in this range yet. Once one syncs or you mark one done, it shows up here.',
  lifts: 'No lifts in this range yet. Sets you log show up here.',
  races: 'No races in this range. A run on a day planned as a race shows up here.',
};
const Activities = ({ log, t, from, range }: { log: Log; t: string; from: string; range: Range }) => {
  const sheet = useSheet();
  const openSession = useOpenSession(log);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [shown, setShown] = useState(PAGE);
  const items = useMemo(() => activityFeed(log.snap, from, t, filter), [log.snap, from, t, filter]);
  const openItem = (x: FeedItem) => {
    if (x.activity) sheet.open({ eyebrow: fmtDate('long', x.date), title: x.title, body: <ActivitySheet a={x.activity} />, wide: true });
    else if (x.kind === 'lift') sheet.open({ eyebrow: fmtDate('long', x.date), title: x.title, body: <LiftDaySheet sets={x.sets} /> });
    else if (x.session) openSession(x.date, x.session);
  };
  return (
    <Sec id="pg-acts" title="Activities" meta={rangeLabel(range)}>
      <div className="pg-filters" role="radiogroup" aria-label="Show">
        {FEED_FILTERS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={filter === k}
            className={`pg-filter ${filter === k ? 'on' : ''}`}
            onClick={() => {
              setFilter(k);
              setShown(PAGE);
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="card pg-acts" role="list">
        {items.length === 0 ? (
          <div className="pg-acts-empty" role="listitem">
            <span className="icon-tile" aria-hidden="true">
              <Footprints size={17} />
            </span>
            <span>{EMPTY_WORDS[filter]}</span>
          </div>
        ) : (
          items.slice(0, shown).map((x) => {
            const Icon = KIND_ICON[x.kind];
            const detail = feedDetail(x, t, paceText, clock);
            return (
              <Pressable key={x.key} className="pg-act" press="surface" onPress={() => openItem(x)} label={`${x.title}, ${x.race ? 'race, ' : ''}from ${x.source}. ${detail}${x.miles ? `, ${mi(x.miles)} miles` : ''}. Open`}>
                <span className={`icon-tile pg-act-icon k-${x.kind} ${x.race ? 'is-race' : ''}`} aria-hidden="true">
                  <Icon size={17} />
                </span>
                <span className="pg-act-main">
                  <span className="pg-act-title">
                    <span className="pg-act-name">{x.title}</span>
                    {x.race ? <span className="pg-act-race">Race</span> : null}
                  </span>
                  <span className="pg-act-sub">
                    <SourceChip source={x.source} />
                    <span className="pg-act-detail">{detail}</span>
                  </span>
                </span>
                <span className="pg-act-val" aria-hidden="true">
                  {x.miles != null && x.miles > 0.05 ? (
                    <>
                      {mi(x.miles)}
                      <small>mi</small>
                    </>
                  ) : x.kind === 'lift' && x.sets.length ? (
                    <>
                      {x.sets.length}
                      <small>sets</small>
                    </>
                  ) : null}
                </span>
                <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
              </Pressable>
            );
          })
        )}
        {items.length > shown ? (
          <button type="button" className="pg-more" onClick={() => setShown((n) => n + PAGE)}>
            Show {Math.min(PAGE, items.length - shown)} more
          </button>
        ) : null}
      </div>
    </Sec>
  );
};
