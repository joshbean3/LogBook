import { fmtDate, mi, mondayOf, monthOf, monthsBetween, num, shiftDays, weekStreak, weekSummary, type Activity } from '@logbook/shared';
import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRunHistory } from '@/api/queries';
import { springs, useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { Card, Group, Pressable, Row, Segmented, Stat, StatStrip, Ticker, WeekRing } from '@/ui';
import { ringDays } from '../day/dayWords';
import { useLog, type Log } from '../log/useLog';
import { Spark } from '../progress/charts';
import { adherence, FUTURE_WEEKS, longRuns, RANGE_WEEKS, rangeBounds, rangeLabel, RANGES, rangeSummary, weekSeries, weekTitle, type Range, type WeekPoint } from '../progress/data';
import { MileageChart } from '../progress/MileageChart';
import { useOpenWeek } from '../progress/sheets';
import { weekMiles } from '../sessions/miles';
import { RouteMap } from '../sessions/RunDetail';
import { runStats, StatRow, useOpenSession, useOpenUnplanned } from '../sessions/SessionCard';
import { Arc, heroBlock, planWeeks, weekOf } from './Blocks';
import { recordRows } from './records';
import './plan.css';

/**
 * The progress strip (docs/system.md §2 Plan): Plan's one hero. Collapsed, a `Card hero` with the week's ring, the
 * week's miles against the plan, the runs and the weeks kept, and a 13-week bar sparkline. A tap expands it in place
 * (height on `springs.settle`, remembered on this device): the full mileage chart with scrub and range, the last run with
 * its route, the records as rows, and this block's adherence and long-run line.
 */
const OPEN_KEY = 'logbook.plan.strip.open';
const RANGE_KEY = 'logbook.progress.range';
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: this session only */
  }
};
const md = (d: string) => fmtDate('md', d);
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** A caps eyebrow for a metric block inside the strip, with meta at the right. */
const Eyebrow = ({ title, meta }: { title: string; meta?: ReactNode }) => (
  <div className="pl-eyebrow">
    <span className="caps">{title}</span>
    {meta != null ? <span className="caps pl-eyebrow-meta">{meta}</span> : null}
  </div>
);

/** The last run on record: the latest activity of kind run, by date then start time. */
const lastRunOf = (runs: Activity[] | undefined): Activity | null => {
  let best: Activity | null = null;
  for (const a of runs ?? []) if (a.kind === 'run' && (!best || a.date > best.date || (a.date === best.date && (a.time ?? '') > (best.time ?? '')))) best = a;
  return best;
};

export const ProgressStrip = memo(function ProgressStrip({ mon }: { mon: string }) {
  const today = useToday();
  const reduce = useReduced();
  const [open, setOpen] = useState(() => read(OPEN_KEY) === '1');
  const [range, setRangeState] = useState<Range>(() => {
    const v = read(RANGE_KEY);
    return RANGES.includes(v as Range) ? (v as Range) : '3M';
  });
  const setRange = (r: Range) => {
    setRangeState(r);
    write(RANGE_KEY, r);
  };
  const toggle = () => {
    setOpen((o) => {
      write(OPEN_KEY, o ? '0' : '1');
      return !o;
    });
  };
  // collapsed, the strip reads three months; a longer range loads only once it is open
  const r: Range = open ? range : '3M';
  const { from, to } = rangeBounds(today, r);
  const months = useMemo(() => [...new Set([...monthsBetween(shiftDays(from, -63), to), monthOf(mon), monthOf(shiftDays(mon, 6))])], [from, to, mon]);
  const log = useLog(months);
  const pts = useMemo(() => weekSeries(log.snap, today, r, (m) => log.snap.loaded(m)), [log.snap, today, r]);

  // ---------- the shown week, for the head ----------
  const sum = weekSummary(log.snap, mon);
  const ran = weekMiles(log.snap, mon, today);
  const streak = weekStreak(log.snap, today);
  const thisWeek = mon === mondayOf(today);
  const ti = thisWeek ? sum.days.findIndex((d) => d.date === today) : -1;
  const kept = streak.weeks ? `${plural(streak.weeks, 'week')} kept` : streak.ofLast.total ? `${streak.ofLast.kept} of ${streak.ofLast.total} weeks kept` : '';
  const runsLine = [sum.runsPlanned ? `${sum.runsDone} of ${plural(sum.runsPlanned, 'run')}` : ran.runs ? plural(ran.runs, 'run') : null, kept || null].filter(Boolean).join(' · ');
  const past = pts.filter((p) => !p.future);
  const headWords = `${weekTitle(mon, today)}: ${mi(ran.miles)}${sum.plannedMiles ? ` of ${num(sum.plannedMiles)}` : ''} miles${runsLine ? `, ${runsLine}` : ''}. ${open ? 'Collapse' : 'Expand'} progress`;

  return (
    <Card className="hero halo halo-done pl-strip" aria-label="Progress">
      <Pressable as="div" press="surface" className="pl-strip-head" onPress={toggle} label={headWords} aria-expanded={open}>
        <WeekRing days={ringDays(sum, today)} size={64} today={ti >= 0 ? ti : undefined} onceADay={thisWeek ? 'plan-strip-ring' : null}>
          {sum.keptSessions || ''}
        </WeekRing>
        <div className="pl-strip-words">
          <span className="caps">{thisWeek ? 'This week' : `Week of ${md(mon)}`}</span>
          <span className="stamp pl-strip-stamp">
            {mi(ran.miles)}
            {sum.plannedMiles ? <small> of {num(sum.plannedMiles)}</small> : null}
            <small> mi</small>
          </span>
          {runsLine ? <span className="t-sub ink2 pl-strip-sub">{runsLine}</span> : null}
        </div>
        <ChevronDown size={20} className={`pl-strip-chev ${open ? 'is-open' : ''}`} aria-hidden="true" />
      </Pressable>
      <div className="pl-strip-spark" aria-hidden="true">
        <Arc weeks={past.slice(-RANGE_WEEKS['3M']).map((p) => ({ mon: p.w, planned: p.planned, ran: p.ran }))} today={today} />
      </div>
      <motion.div className="pl-strip-more" initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={reduce ? { duration: 0.15 } : { height: springs.settle, opacity: { duration: 0.15 } }} inert={!open || undefined} aria-hidden={!open || undefined}>
        {open ? <Expanded log={log} pts={pts} range={range} setRange={setRange} today={today} /> : null}
      </motion.div>
    </Card>
  );
});

// ---------- expanded: the chart, the last run, the records, this block ----------
const Expanded = ({ log, pts, range, setRange, today }: { log: Log; pts: WeekPoint[]; range: Range; setRange: (r: Range) => void; today: string }) => {
  const openWeek = useOpenWeek(today);
  const history = useRunHistory();
  const openSession = useOpenSession(log);
  const openUnplanned = useOpenUnplanned();
  const [scrub, setScrubState] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  // while the finger is down the numbers are written as they are; on release each one springs from the week it showed
  // back to the range (a fresh Ticker, `from` the last value)
  const lastShown = useRef<Array<number | null>>([]);
  const [released, setReleased] = useState(0);
  const setScrub = (i: number | null) => {
    if (i == null && scrub != null) setReleased((n) => n + 1);
    setScrubState(i);
  };
  // the range never draws a field of empty weeks: it starts where the log does (never under thirteen weeks)
  const firstData = pts.findIndex((p) => p.ran > 0 || p.planned > 0);
  const cut = firstData < 0 ? 0 : Math.max(0, Math.min(firstData, pts.length - FUTURE_WEEKS - RANGE_WEEKS['3M']));
  const shownPts = cut ? pts.slice(cut) : pts;
  const since = cut ? pts[firstData]!.w : null;
  const sum = rangeSummary(shownPts);
  const held = shownPts.some((p) => p.missing);
  const pinch = (dir: -1 | 1) => {
    const i = RANGES.indexOf(range) + dir;
    const rr = RANGES[i];
    if (rr) setRange(rr);
  };
  const openAt = (i: number) => {
    const p = shownPts[i];
    if (!p) return;
    setOpened(i);
    openWeek(p.w, 'open', () => setOpened(null));
  };
  const shown = scrub ?? opened;
  const sp = shown != null ? shownPts[shown] : null;
  const ctx = sp ? `${weekTitle(sp.w, today)}${sp.current ? ' · so far' : sp.future ? ' · planned' : ''}` : since ? `Since ${md(since)}` : rangeLabel(range);
  const slots: Array<{ label: string; value: number | null; word?: string; format: (v: number) => string; unit?: string }> = sp
    ? sp.missing
      ? [{ label: 'Miles', value: null, word: 'Loading', format: mi }]
      : [
          { label: 'Miles', value: sp.future ? null : sp.ran, word: 'To run', format: mi, unit: 'mi' },
          { label: 'Planned', value: sp.planned || null, word: 'No plan', format: num, unit: 'mi' },
          { label: 'Runs', value: sp.future ? sp.plannedRuns : sp.runs, format: (v) => String(Math.round(v)) },
        ]
    : held
      ? [{ label: 'Avg week', value: null, word: 'Loading', format: mi }]
      : [
          { label: 'Avg week', value: sum.avg, format: mi, unit: 'mi' },
          { label: 'Best week', value: sum.best?.ran ?? null, format: mi, unit: 'mi' },
          { label: 'Total', value: sum.total, format: (v) => String(Math.round(v)), unit: 'mi' },
        ];
  if (scrub != null) lastShown.current = slots.map((x) => x.value);
  const live = slots.filter((s) => s.value != null || s.word);

  // the last run
  const last = lastRunOf(history.data);
  const lastSess = last && log.loaded(last.date) ? log.snap.sessionsOn(last.date).find((s) => s.kind === 'run') : undefined;
  const lastRuns = last ? (log.loaded(last.date) ? log.snap.runsOn(last.date) : [last]) : [];
  const openLast = () => {
    if (!last) return;
    if (lastSess) openSession(last.date, lastSess);
    else openUnplanned(last.date, lastRuns.length ? lastRuns : [last], log);
  };

  // the records
  const records = useMemo(() => recordRows(history.data ?? [], pts.filter((p) => !p.future && !p.missing)), [history.data, pts]);

  // this block
  const block = heroBlock(log.boot?.blocks ?? [], today);
  const ad = adherence(log.snap, today, rangeBounds(today, range).from, log.boot?.blocks ?? []);
  const wk = block ? weekOf(block, today) : 0;
  const weeks = block ? planWeeks(block) : 0;
  const lr = longRuns(shownPts);
  const lrWords = lr.recent > 0 ? `${mi(lr.recent)} mi lately${lr.best && lr.best.miles > lr.recent + 0.05 ? ` · best ${mi(lr.best.miles)} in ${lr.best.month}` : ' · your longest yet'}` : lr.best ? `Best ${mi(lr.best.miles)} in ${lr.best.month}` : 'No long runs yet';

  return (
    <div className="pl-strip-body">
      <Segmented className="pl-range" label="Range" value={range} onChange={setRange} options={RANGES.map((x) => [x, <span key={x} aria-label={rangeLabel(x)}>{x}</span>] as [Range, ReactNode])} />
      <Eyebrow title={ctx} />
      <StatStrip className={`stat-row cols-${live.length}`}>
        {live.map((s, i) => (
          <Stat key={s.label} label={s.label} value={s.value == null ? s.word : scrub != null ? <span className="tnum">{s.format(s.value)}</span> : <Ticker key={released} value={s.value} format={s.format} from={released ? (lastShown.current[i] ?? undefined) : undefined} />} unit={s.value != null ? s.unit : undefined} read={`${s.label} ${s.value == null ? s.word : `${s.format(s.value)} ${s.unit ?? ''}`}`} />
        ))}
      </StatStrip>
      <MileageChart pts={shownPts} range={range} today={today} onScrub={setScrub} onOpen={openAt} onPinch={pinch} />

      {last ? (
        <section className="pl-strip-sec" aria-label="Last run">
          <Eyebrow title="Last run" meta={md(last.date)} />
          <Pressable as="div" press="surface" className="pl-last" onPress={openLast} label={`Last run: ${last.name}, ${md(last.date)}, ${mi(last.miles)} miles. Open`}>
            {last.polyline ? <RouteMap polyline={last.polyline} drawKey={`strip-${last.id}`} compact /> : null}
            <span className="t-head pl-last-name">{last.name}</span>
            <StatRow stats={runStats(lastSess ?? null, lastRuns.length ? lastRuns : [last], log)} />
          </Pressable>
        </section>
      ) : null}

      {records.length ? (
        <section className="pl-strip-sec" aria-label="Records">
          <Eyebrow title="Records" />
          <Group>
            {records.map((rec) => (
              <Row
                key={rec.id}
                title={rec.title}
                sub={rec.sub}
                right={
                  <span className="stamp pl-rec-val tnum">
                    {rec.value}
                    {rec.unit ? <small> {rec.unit}</small> : null}
                  </span>
                }
                onClick={rec.run ? () => (log.loaded(rec.date) && log.snap.sessionsOn(rec.date).find((s) => s.kind === 'run') ? openSession(rec.date, log.snap.sessionsOn(rec.date).find((s) => s.kind === 'run')!) : openUnplanned(rec.date, [rec.run!], log)) : () => openWeek(rec.date)}
                label={`${rec.title}: ${rec.value}${rec.unit ? ` ${rec.unit}` : ''}, ${rec.sub}. Open`}
              />
            ))}
          </Group>
        </section>
      ) : null}

      {block ? (
        <section className="pl-strip-sec" aria-label="This block">
          <Eyebrow title="This block" meta={block.name} />
          <p className="t-sub pl-block-line">
            {wk ? `Week ${wk} of ${weeks}` : `Starts ${md(block.start)}`}
            {ad.planned ? ` · ${ad.kept} of ${plural(ad.planned, 'session')} kept` : ''}
          </p>
          <span className="meter pl-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((ad.planned ? ad.kept / ad.planned : 0) * 100)} aria-label="Sessions kept">
            <i style={{ width: `${Math.round((ad.planned ? ad.kept / ad.planned : 0) * 100)}%` }} />
          </span>
          <div className="pl-long">
            <Spark values={lr.points.map((p) => (p.miles > 0 ? p.miles : null))} w={96} h={28} />
            <span className="t-sub ink2">Long run · {lrWords}</span>
          </div>
        </section>
      ) : null}
    </div>
  );
};
