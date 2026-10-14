import { dayStatus, fmtDate, mi, mondayOf, monthsBetween, num, shiftDays, weekCheck, weekStreak, type LiftSet } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAllLifts } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';
import { ChipButton, EmptyState, Pressable, shared, Skeleton, SkeletonGroup, TabHeader, Ticker, useSheet } from '@/ui';
import { useLog, type Log } from '../log/useLog';
import { Spark } from './charts';
import { adherence, consistency, easyPace, FUTURE_WEEKS, liftGroups, longRuns, paceText, pct, plural, RANGE_WEEKS, RANGES, rangeBounds, rangeLabel, rangePhrase, rangeSummary, signedPct, verdict, weekId, weekSeries, weekTitle, type Range, type WeekPoint } from './data';
import { MileageChart } from './MileageChart';
import { AdherenceSheet, ConsistencySheet, EasyPaceSheet, LiftsSheet, LongRunSheet, paceChange, useOpenWeek } from './sheets';
import './progress.css';

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

/** Every number on the page, from one pass over the log. */
const buildModel = (log: Log, sets: LiftSet[], t: string, range: Range, from: string) => {
  const all = weekSeries(log.snap, t, range);
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
  <Pressable className="pg-row" pressScale={1} onPress={onPress} label={label}>
    <span className="pg-row-main">
      <span className="pg-row-title">{title}</span>
      <span className="pg-row-sub">{sub}</span>
    </span>
    {spark}
    {value != null ? (
      <span className="stamp pg-row-num">
        {value}
        {unit ? <small>{unit}</small> : null}
      </span>
    ) : null}
    <ChevronRight size={16} className="pg-chev" aria-hidden="true" />
  </Pressable>
);

/** A believable quarter for the empty state's ghost: build weeks, a down week, this week under way. */
const sampleWeeks = (today: string): WeekPoint[] => {
  const ran = [12, 14, 15, 11, 16, 18, 19, 14, 20, 21, 23, 17, 9];
  const mon = mondayOf(today);
  const pts = [...ran, 0, 0].map((r, i): WeekPoint => {
    const future = i >= ran.length;
    return { w: shiftDays(mon, (i - ran.length + 1) * 7), ran: future ? 0 : r, runs: 4, planned: future ? 22 + i - ran.length : Math.round(r * 1.08), plannedRuns: 4, long: 0, longRun: null, current: i === ran.length - 1, future, avg: null };
  });
  pts.forEach((p, i) => {
    if (i >= 3 && !p.current && !p.future) p.avg = (pts[i]!.ran + pts[i - 1]!.ran + pts[i - 2]!.ran + pts[i - 3]!.ran) / 4;
  });
  return pts;
};

/** Grey blocks in the page's own shape: the verdict, the chips, the chart card, five rows. */
const ProgressSkeleton = () => (
  <SkeletonGroup label="Loading progress" className="pg-skel">
    <Skeleton w="86%" h={28} r="control" style={{ marginTop: 8 }} />
    <Skeleton w="58%" h={28} r="control" />
    <Skeleton w="70%" h={15} style={{ marginTop: 4 }} />
    <div className="pg-skel-chips">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} w={44} h={32} r="pill" />
      ))}
    </div>
    <Skeleton h={328} r="card" />
    <div className="pg-skel-rows">
      {[0, 1, 2, 3, 4].map((i) => (
        <div className="pg-skel-row" key={i}>
          <span>
            <Skeleton w={`${44 + ((i * 11) % 22)}%`} h={15} />
            <Skeleton w={`${60 - ((i * 7) % 18)}%`} h={13} />
          </span>
          <Skeleton w={56} h={24} />
          <Skeleton w={44} h={22} />
        </div>
      ))}
    </div>
  </SkeletonGroup>
);

export default function ProgressView() {
  const nav = useNavigate();
  const sheet = useSheet();
  const [range, setRange] = useRange();
  const t = useAsOf(useToday());
  const { from, to } = rangeBounds(t, range);
  const months = useMemo(() => monthsBetween(shiftDays(from, -63), to), [from, to]);
  const log = useLog(months);
  const lifts = useAllLifts();
  const openWeek = useOpenWeek(t);
  const [scrub, setScrub] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);

  // Everything on the page comes from one model, built once every month in view has arrived. While a longer range
  // loads, the last model stays up (the chips already show the new range), so numbers never shuffle under the eye.
  const ready = log.ready;
  // habits and zones come from boot; the snapshot only changes when a month does, so a scrub never rebuilds this
  const model = useMemo(() => (ready ? buildModel(log, lifts.data ?? [], t, range, from) : null), [ready, log.snap, log.boot, lifts.data, t, range, from]); // eslint-disable-line react-hooks/exhaustive-deps
  const last = useRef(model);
  if (model) last.current = model;
  const m = model ?? last.current;

  const header = <TabHeader title="Progress" />;
  if (!m)
    return (
      <div className="page pg-page">
        {header}
        <ProgressSkeleton />
      </div>
    );

  const pts = m.pts;
  const pick = (r: Range) => {
    if (r === range) return;
    haptics.select();
    setRange(r);
  };
  const pinch = (dir: -1 | 1) => {
    const i = RANGES.indexOf(range) + dir;
    const r = RANGES[i];
    if (r) setRange(r);
  };
  const openAt = (i: number) => {
    const p = pts[i];
    if (!p) return;
    // the readout names this week while its sheet is up, so the title travels from it and home again
    setOpened(i);
    openWeek(p.w, 'open', () => setOpened(null));
  };

  // ---------- the headline numbers: the range at rest, the week under the finger while scrubbing ----------
  const shown = scrub ?? opened;
  const sp = shown != null ? pts[shown] : null;
  const ctx = sp ? `${weekTitle(sp.w, t)}${sp.current ? ' · so far' : sp.future ? ' · planned' : ''}` : m.since ? `Since ${md(m.since)}` : rangeLabel(range);
  const slots: Array<{ label: string; value: number | null; format: (v: number) => string; unit?: string }> = sp
    ? [
        { label: 'Miles', value: sp.future ? null : sp.ran, format: mi, unit: 'mi' },
        { label: 'Planned', value: sp.planned || null, format: num, unit: 'mi' },
        { label: 'Runs', value: sp.future ? sp.plannedRuns : sp.runs, format: (v) => String(Math.round(v)) },
      ]
    : [
        { label: 'Avg week', value: m.sum.avg, format: mi, unit: 'mi' },
        { label: 'Best week', value: m.sum.best?.ran ?? null, format: mi, unit: 'mi' },
        { label: 'Total', value: m.sum.total, format: (v) => String(Math.round(v)), unit: 'mi' },
      ];
  const readWords = sp ? `${ctx}: ${sp.future ? '' : `${mi(sp.ran)} miles, `}${sp.planned ? `${num(sp.planned)} planned, ` : ''}${sp.future ? sp.plannedRuns : sp.runs} runs` : `${ctx}: ${m.sum.avg != null ? `${mi(m.sum.avg)} miles a week on average, ` : ''}${m.sum.best ? `best week ${mi(m.sum.best.ran)}, ` : ''}${Math.round(m.sum.total)} miles in all`;

  const chips = (
    <div className="pg-chips" role="group" aria-label="Range">
      {RANGES.map((r) => (
        <ChipButton key={r} on={r === range} onClick={() => pick(r)} aria-label={rangeLabel(r)}>
          {r}
        </ChipButton>
      ))}
    </div>
  );

  // ---------- new account: the chart as it will look, one sentence, one verb ----------
  if (!m.ran) {
    const strava = log.features.strava && !log.strava?.connected;
    return (
      <div className="page pg-page">
        {header}
        <EmptyState
          className="pg-empty"
          ghost={
            <section className="pg-hero" aria-hidden="true">
              <span className="pg-glow" />
              <div className="pg-readout">
                {['Avg week', 'Best week', 'Total'].map((l, i) => (
                  <span className="pg-slot" key={l}>
                    <span className="caps">{l}</span>
                    <span className="stamp pg-slot-num">
                      {['16.4', '23.0', '213'][i]}
                      <small>mi</small>
                    </span>
                  </span>
                ))}
              </div>
              <MileageChart pts={sampleWeeks(t)} range="3M" today={t} onScrub={() => undefined} onOpen={() => undefined} ghost />
            </section>
          }
          verb={
            m.planned
              ? strava
                ? { label: 'Connect Strava', onPress: () => nav('/settings') }
                : { label: 'See the plan', onPress: () => nav('/plan') }
              : { label: 'Plan a week', onPress: () => nav('/plan/plans'), primary: true }
          }
        >
          {m.planned ? 'Your plan is set. Each run you log lands here.' : 'Plan a week and run it. This page draws the rest.'}
        </EmptyState>
        {m.c.habitOf ? <Drills m={m} t={t} range={range} log={log} sheet={sheet} /> : null}
      </div>
    );
  }

  return (
    <div className="page pg-page">
      {header}
      <p className="pg-verdict">{m.v!.line}</p>
      <p className="pg-sub">{m.v!.sub}</p>
      {chips}
      <section className="pg-hero" aria-label="Weekly miles">
        <span className="pg-glow" aria-hidden="true" />
        <div className="pg-ctx-row">
          <span className="caps pg-ctx" {...(sp ? shared(weekId(sp.w)) : {})}>
            {ctx}
          </span>
        </div>
        <div className="pg-readout" role="status" aria-label={readWords}>
          {slots.map((s, i) => (
            <span className="pg-slot" key={i} aria-hidden="true">
              <span className="caps">{s.label}</span>
              <span className="stamp pg-slot-num">
                {s.value == null ? '—' : <Ticker value={s.value} format={s.format} />}
                {s.unit && s.value != null ? <small>{s.unit}</small> : null}
              </span>
            </span>
          ))}
        </div>
        <MileageChart pts={pts} range={m.range} today={t} onScrub={setScrub} onOpen={openAt} onPinch={pinch} />
      </section>
      <Drills m={m} t={t} range={range} log={log} sheet={sheet} />
    </div>
  );
}

/** The edge-to-edge list under the chart: each row a sparkline and one number, each opening its sheet. */
const Drills = ({ m, t, range, log, sheet }: { m: Model; t: string; range: Range; log: Log; sheet: ReturnType<typeof useSheet> }) => {
  const { ad, lr, ep, lg, c } = m;
  const adP = pct(ad.kept, ad.planned);
  const lrDelta = lr.early ? (Math.abs(lr.recent - lr.early) < 0.3 ? `Level with ${lr.earlyMonth}` : lr.recent > lr.early ? `Up from ${mi(lr.early)} in ${lr.earlyMonth}` : `Down from ${mi(lr.early)} in ${lr.earlyMonth}`) : lr.peak ? `Longest ${rangePhrase(range)}: ${mi(lr.peak.miles)}` : 'No runs yet';
  const ch = paceChange(ep.now, ep.then);
  const epSub = [ch ? (ch === 'level' ? `Level with ${ep.thenMonth}` : `${ch} than ${ep.thenMonth}`) : `${ep.runs.length} easy ${plural(ep.runs.length, 'run')}`, ep.nowHr != null ? `${Math.round(ep.nowHr)}\u00a0bpm` : null].filter(Boolean).join(' · ');
  const top = lg[0];
  const tp = pct(c.rows[0]!.hit, c.rows[0]!.of);
  const hp = pct(c.habitHit, c.habitOf);
  const eyebrow = rangeLabel(range);
  return (
    <div className="list-edge pg-drills" aria-label="Drill-downs" role="group">
      {m.ran || ad.weeks.length ? (
        <DrillRow
          title="Plan adherence"
          sub={ad.weeks.length ? `${ad.block ? 'This block' : 'Planned sessions'}: ${adP ?? 0}% kept${ad.weeks.some((w) => w.ahead) ? `, ${ad.weeks.reduce((s, w) => s + w.ahead, 0)} ahead` : ''}` : 'No plan in this range'}
          spark={<Spark values={ad.weeks.map((w) => (w.planned ? w.kept / w.planned : null))} />}
          value={ad.weeks.length ? ad.kept : undefined}
          unit={ad.weeks.length ? `of ${ad.planned}` : undefined}
          onPress={() => sheet.open({ title: 'Plan adherence', eyebrow: ad.block?.name ?? eyebrow, body: <AdherenceSheet ad={ad} today={t} range={range} log={log} />, wide: true })}
          label={`Plan adherence: ${ad.weeks.length ? `${ad.kept} of ${ad.planned} sessions kept` : 'no plan in this range'}. Open`}
        />
      ) : null}
      {m.ran ? (
        <DrillRow
          title="Long run"
          sub={lrDelta}
          spark={<Spark values={lr.points.map((p) => (p.miles > 0 ? p.miles : null))} />}
          value={mi(lr.recent)}
          unit="mi"
          onPress={() => sheet.open({ title: 'Long run', eyebrow, body: <LongRunSheet lr={lr} log={log} today={t} />, wide: true })}
          label={`Long run: ${mi(lr.recent)} miles, the longest of the last 4 weeks. ${lrDelta}. Open`}
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
        sub={top ? `${top.name}${top.change != null ? ` ${signedPct(top.change)} since ${md(top.days[0]!.date)}` : `, ${top.days[0]!.weight} × ${top.days[0]!.reps}`}${lg.length > 1 ? ` · ${lg.length} lifts` : ''}` : `None ${rangePhrase(range)}`}
        spark={top ? <Spark values={top.days.map((d) => d.e1rm)} /> : undefined}
        value={top ? Math.round(top.days[top.days.length - 1]!.e1rm) : undefined}
        unit={top ? 'e1RM' : undefined}
        onPress={() => sheet.open({ title: 'Lifts', eyebrow, body: <LiftsSheet groups={lg} range={range} />, wide: true })}
        label={`Lifts: ${top ? `${top.name}, estimated one-rep max ${Math.round(top.days[top.days.length - 1]!.e1rm)}` : `none ${rangePhrase(range)}`}. Open`}
      />
      <DrillRow
        title="Consistency"
        sub={[hp != null ? `Habits ${hp}%` : null, tp != null ? `Training ${tp}%` : null].filter(Boolean).join(' · ') || 'Habits and training, day by day'}
        spark={<Spark values={c.habitWeeks.map((w) => w.v)} />}
        value={c.weeks ? c.keptWeeks : undefined}
        unit={c.weeks ? `of ${c.weeks} wks` : undefined}
        onPress={() => sheet.open({ title: 'Consistency', eyebrow, detent: 'large', body: <ConsistencySheet c={c} log={log} today={t} range={range} streak={m.streak} />, wide: true })}
        label={`Consistency: ${c.keptWeeks} of ${c.weeks} weeks kept${hp != null ? `, habits ${hp}%` : ''}. Open`}
      />
    </div>
  );
};
