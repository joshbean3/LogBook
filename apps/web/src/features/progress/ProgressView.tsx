import { dayStatus, fmtDate, mi, monthsBetween, num, shiftDays, weekCheck, weekStreak, type LiftSet } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNav } from '@/app/NavController';
import { useAllLifts } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { dayCaption, EmptyState, GhostBars, NavBar, Pressable, Segmented, Skeleton, Ticker, useSheet } from '@/ui';
import { useLog, type Log } from '../log/useLog';
import { StravaPrimer } from '../onboarding/StravaPrimer';
import { Spark } from './charts';
import { adherence, consistency, easyPace, FUTURE_WEEKS, liftGroups, longRuns, paceText, pct, plural, RANGE_WEEKS, RANGES, rangeBounds, rangeLabel, rangePhrase, rangeSummary, signedPct, verdict, weekId, weekSeries, weekTitle, type Range, type WeekPoint } from './data';
import { MileageChart } from './MileageChart';
import { AdherenceSheet, ConsistencySheet, EasyPaceSheet, LiftsSheet, LongRunSheet, paceChange, useOpenWeek } from './sheets';
import './progress.css';
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

/** A drill-down: the whole row opens its sheet; a sparkline and one number on the right. */
const DrillRow = ({ title, sub, spark, value, unit, onPress, label }: { title: string; sub: ReactNode; spark?: ReactNode; value?: ReactNode; unit?: string; onPress: () => void; label: string }) => (
  <Pressable className="pg-row" press="surface" onPress={onPress} label={label}>
    <span className="pg-row-main">
      <span className="pg-row-title">{title}</span>
      <span className="pg-row-sub">{sub}</span>
    </span>
    {spark}
    {/* the number's column is auto (visual F18): an empty slot is not drawn, so the sparkline sits against the chevron */}
    <span className={`stamp pg-row-num pg-row-val ${value == null ? 'is-empty' : ''}`} aria-hidden={value == null ? true : undefined}>
      {value}
      {value != null && unit ? <small>{unit}</small> : null}
    </span>
    <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
  </Pressable>
);

/**
 * The empty state's ghost: the chart's shape, abstract. Plain bars of no particular height pattern, a baseline and three
 * grey bars where the headline numbers will be; no numbers, no axis, no labels, nothing that reads as someone's data.
 */
const ProgressGhost = () => (
  <section className="pg-hero pg-ghost" aria-hidden="true">
    <div className="pg-ghost-read">
      {[0, 1, 2].map((i) => (
        <span key={i} className="pg-ghost-slot">
          <Skeleton w={44} h={9} r="line" />
          <Skeleton w={64} h={26} r="control" />
        </span>
      ))}
    </div>
    <GhostBars count={13} height={160} />
  </section>
);

/**
 * Progress (docs/feel.md §8): the NavBar (caps the date, title `Progress`, nothing trailing), the verdict in the sans, the
 * range as a Segmented, the chart and the drill-downs. The page builds from the months that are loaded: a month still on
 * its way (or never answering) is a quiet gap in the chart and is left out of the numbers, never the page skeleton. Links
 * into other tabs go through `nav.go` (a day row → Today at that day; `Open in Plan` → that week); `Connect Strava` opens
 * the primer card as a sheet over Progress (Settings keeps its one door).
 */
export default function ProgressView() {
  const nav = useNav();
  const sheet = useSheet();
  const [range, setRange] = useRange();
  const t = useAsOf(useToday());
  const { from, to } = rangeBounds(t, range);
  const months = useMemo(() => monthsBetween(shiftDays(from, -63), to), [from, to]);
  const log = useLog(months);
  const lifts = useAllLifts();
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

  // one model from what is loaded; the snapshot only changes when a month does, so a scrub never rebuilds this
  const anyLoaded = months.some((m) => log.snap.loaded(m));
  const model = useMemo(() => (anyLoaded && log.boot ? buildModel(log, lifts.data ?? [], t, range, from) : null), [anyLoaded, log.snap, log.boot, lifts.data, t, range, from]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = model;

  const header = <NavBar caps={{ cur: dayCaption(t, t) }} title={{ cur: 'Progress' }} gap={24} />;
  // nothing at all on this device yet: the bar alone, quietly, until the first month lands (no skeleton, no empty state)
  if (!m)
    return (
      <div className="page pg-page" aria-busy="true">
        {header}
      </div>
    );

  const pts = m.pts;
  // the range is a Segmented: no haptic on a change (§11.4)
  const pick = (r: Range) => {
    if (r !== range) setRange(r);
  };
  const pinch = (dir: -1 | 1) => {
    const i = RANGES.indexOf(range) + dir;
    const r = RANGES[i];
    if (r) setRange(r);
  };
  const openAt = (i: number) => {
    const p = pts[i];
    if (!p) return;
    // the readout names this week while its sheet is up
    setOpened(i);
    openWeek(p.w, 'open', () => setOpened(null));
  };
  const connect = () => sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> });

  // ---------- the headline numbers: the range at rest, the week under the finger while scrubbing ----------
  const shown = scrub ?? opened;
  const sp = shown != null ? pts[shown] : null;
  const ctx = sp ? `${weekTitle(sp.w, t)}${sp.current ? ' · so far' : sp.future ? ' · planned' : ''}` : m.since ? `Since ${md(m.since)}` : rangeLabel(range);
  // a slot never shows a dash: while scrubbing (three slots that must hold still) an empty one says a word; at rest a stat with
  // no value yet (no finished week to average) is left out
  const held = pts.some((p) => p.missing);
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
    : held
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
    : held
      ? `${ctx}: a month of this range is still loading`
      : `${ctx}: ${m.sum.avg != null ? `${mi(m.sum.avg)} miles a week on average, ` : ''}${m.sum.best ? `best week ${mi(m.sum.best.ran)}, ` : ''}${Math.round(m.sum.total)} miles in all`;

  const chips = (
    <Segmented
      className="pg-range"
      label="Range"
      value={range}
      onChange={pick}
      options={RANGES.map((r) => [r, <span key={r} aria-label={rangeLabel(r)}>{r}</span>] as [Range, ReactNode])}
    />
  );
  const gaps = held;

  // ---------- new account: the chart as it will look, one sentence, one verb ----------
  if (!m.ran && !gaps) {
    const strava = log.features.strava && !log.strava?.connected;
    return (
      <div className="page pg-page">
        {header}
        <EmptyState
          className="pg-empty"
          ghost={<ProgressGhost />}
          verb={m.planned ? (strava ? { label: 'Connect Strava', onPress: connect } : { label: 'See the plan', onPress: () => nav.go('/plan') }) : { label: 'Plan a week', onPress: () => nav.go('/plan'), primary: true }}
        >
          {m.planned ? 'Your plan is set. Each run you log lands here.' : 'Plan a week and run it. This page draws the rest.'}
        </EmptyState>
        {m.c.habitOf ? <Drills m={m} t={t} range={range} log={log} sheet={sheet} onConnect={connect} /> : null}
      </div>
    );
  }

  return (
    <div className="page pg-page">
      {header}
      {/* a month of the range not loaded: the verdict and the drill-downs would read the gap as weeks off (review code F8),
          so the verdict says only that, in the same place, and the drill-downs wait under the chart's quiet gap */}
      {m.v && gaps ? (
        <>
          <p className="pg-verdict">Your weeks so far.</p>
          <p className="pg-sub">A month of this range is still on its way; its weeks are left blank.</p>
        </>
      ) : m.v ? (
        <>
          <p className="pg-verdict">{m.v.line}</p>
          <p className="pg-sub">{m.v.sub}</p>
        </>
      ) : null}
      {chips}
      <section className="pg-hero" aria-label="Weekly miles">
        <span className="pg-glow" aria-hidden="true" />
        <div className="pg-ctx-row">
          <span className="caps pg-ctx">{ctx}</span>
        </div>
        <div className="pg-readout" role="status" aria-label={readWords}>
          {slots.map((s, i) =>
            s.value == null && !s.word ? null : (
              <span className="pg-slot" key={i} aria-hidden="true">
                <span className="caps">{s.label}</span>
                <span className="stamp pg-slot-num">
                  {s.value == null ? <span className="pg-slot-word">{s.word}</span> : scrub != null ? <span className="tnum">{s.format(s.value)}</span> : <Ticker key={released} value={s.value} format={s.format} from={released ? (lastShown.current[i] ?? undefined) : undefined} />}
                  {s.unit && s.value != null ? <small>{s.unit}</small> : null}
                </span>
              </span>
            ),
          )}
        </div>
        <MileageChart pts={pts} range={m.range} today={t} onScrub={setScrub} onOpen={openAt} onPinch={pinch} />
      </section>
      {gaps ? null : <Drills m={m} t={t} range={range} log={log} sheet={sheet} onConnect={connect} />}
    </div>
  );
}

/** The edge-to-edge list under the chart: each row a sparkline and one number, each opening its sheet. */
const Drills = ({ m, t, range, log, sheet, onConnect }: { m: Model; t: string; range: Range; log: Log; sheet: ReturnType<typeof useSheet>; onConnect: () => void }) => {
  const { ad, lr, ep, lg, c } = m;
  // "1 of 6 on plan · 5 to go": counts, never a percentage grade ("kept" is the week's word, review feel F6)
  const toGo = ad.weeks.reduce((s, w) => s + w.ahead, 0);
  const adSub = ad.weeks.length ? [ad.planned ? `${ad.kept} of ${ad.planned} on plan` : 'Nothing due yet', toGo ? `${toGo} to go` : null].filter(Boolean).join(' · ') : 'No plan in this range';
  // "5.3 mi lately · best 8.0 in Aug"
  const lrDelta = lr.recent > 0 ? `${mi(lr.recent)} mi lately${lr.best && lr.best.miles > lr.recent + 0.05 ? ` · best ${mi(lr.best.miles)} in ${lr.best.month}` : ' · your longest yet'}` : lr.best ? `Best ${mi(lr.best.miles)} in ${lr.best.month}` : 'No runs yet';
  const ch = paceChange(ep.now, ep.then);
  const epSub = [ch ? (ch === 'level' ? `Level with ${ep.thenMonth}` : `${ch} than ${ep.thenMonth}`) : `${ep.runs.length} easy ${plural(ep.runs.length, 'run')}`, ep.nowHr != null ? `${Math.round(ep.nowHr)}\u00a0bpm` : null].filter(Boolean).join(' · ');
  const top = lg[0];
  // "Squat 225 × 5 · est. max 263": the set itself, then the estimate, in words
  const topLast = top ? top.days[top.days.length - 1]! : null;
  const liftSub = top && topLast ? `${top.name} ${topLast.weight} × ${topLast.reps} · est. max ${Math.round(topLast.e1rm)}` : `None ${rangePhrase(range)}`;
  const tp = pct(c.rows[0]!.hit, c.rows[0]!.of);
  const hp = pct(c.habitHit, c.habitOf);
  const eyebrow = rangeLabel(range);
  return (
    <div className="list-edge pg-drills" aria-label="Drill-downs" role="group">
      {m.ran || ad.weeks.length ? (
        <DrillRow
          title="Plan adherence"
          sub={adSub}
          spark={<Spark values={ad.weeks.map((w) => (w.planned ? w.kept / w.planned : null))} />}
          onPress={() => sheet.open({ title: 'Plan adherence', eyebrow: ad.block?.name ?? eyebrow, body: <AdherenceSheet ad={ad} today={t} range={range} log={log} />, wide: true })}
          label={`Plan adherence: ${adSub}. Open`}
        />
      ) : null}
      {m.ran ? (
        <DrillRow
          title="Long run"
          sub={lrDelta}
          spark={<Spark values={lr.points.map((p) => (p.miles > 0 ? p.miles : null))} />}
          onPress={() => sheet.open({ title: 'Long run', eyebrow, body: <LongRunSheet lr={lr} log={log} today={t} />, wide: true })}
          label={`Long run: ${lrDelta}. Open`}
        />
      ) : null}
      {ep.runs.length ? (
        <DrillRow
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
        title="Lifts"
        sub={liftSub}
        spark={top ? <Spark values={top.days.map((d) => d.e1rm)} /> : undefined}
        value={top && top.change != null ? signedPct(top.change) : undefined}
        onPress={() => sheet.open({ title: 'Lifts', eyebrow, body: <LiftsSheet groups={lg} range={range} />, wide: true })}
        label={`Lifts: ${top ? `${liftSub}${top.change != null ? `, ${signedPct(top.change)} since ${md(top.days[0]!.date)}` : ''}` : `none ${rangePhrase(range)}`}. Open`}
      />
      <DrillRow
        title="Consistency"
        sub={[hp != null ? `Habits ${hp}%` : null, tp != null ? `Training ${tp}%` : null].filter(Boolean).join(' · ') || 'Habits and training, day by day'}
        spark={<Spark values={c.habitWeeks.map((w) => w.v)} />}
        value={c.weeks ? c.keptWeeks : undefined}
        unit={c.weeks ? `of ${c.weeks} wks` : undefined}
        onPress={() => sheet.open({ title: 'Consistency', eyebrow, detent: 'large', body: <ConsistencySheet c={c} log={log} today={t} range={range} streak={m.streak} />, wide: true })}
        label={`Consistency: ${c.weeks ? `${c.keptWeeks} of ${c.weeks} weeks kept` : 'your first week is under way'}${hp != null ? `, habits ${hp}%` : ''}. Open`}
      />
      {log.features.strava && !log.strava?.connected ? (
        // Strava's door on Progress: the primer card as a sheet over Progress (no navigation; Settings keeps its own door, §1.3)
        <DrillRow title="Connect Strava" sub="Runs land here on their own" onPress={onConnect} label="Connect Strava. Opens a card about it" />
      ) : null}
    </div>
  );
};
