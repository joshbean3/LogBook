import { dayStatus, e1rm, fmtDate, grade, label, mi, mondayOf, monthsBetween, num, sessionStatus, shiftDays, zoneOf, type Activity } from '@logbook/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/api/client';
import { keys, useAllLifts } from '@/api/queries';
import { Button, EmptyState, Group, PageHeader, Row, Segmented } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { useLog, type Log } from '../log/useLog';
import './trends.css';

type Range = '1M' | '3M' | '6M';
const WEEKS: Record<Range, number> = { '1M': 4, '3M': 13, '6M': 26 };
const WEEKS_WORD: Record<Range, string> = { '1M': 'Four', '3M': 'Thirteen', '6M': 'Twenty-six' };
const FUT = 4;

const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(e.contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

const signed = (v: number) => `${v >= 0 ? '+' : '−'}${mi(Math.abs(v))}`;
/** Every month in range has arrived (or stopped trying). Numbers draw only then, so they never change under the eye. */
const settled = (log: Log) => log.ready || !log.loading;
const up = (s: string) => s.toUpperCase();

/** Every run the loaded months know about, newest first. */
const useRuns = (log: Log, from: string, to: string) =>
  useMemo(() => {
    const out: Activity[] = [];
    for (let d = from; d <= to; d = shiftDays(d, 1)) out.push(...log.snap.runsOn(d));
    return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [log.snap, from, to]);

/** A caps eyebrow with a caps meta at the right: the section head of this screen. */
const Sec = ({ title, meta }: { title: string; meta?: string }) => (
  <div className="tr-sec">
    <span className="caps">{title}</span>
    {meta ? <span className="caps meta">{meta}</span> : null}
  </div>
);

/** A caps label over a stamped number, with an optional caps line under it. */
const Stamp = ({ label: l, value, unit, under }: { label: string; value: ReactNode; unit?: string; under?: ReactNode }) => (
  <span className="tr-stamp">
    <span className="caps">{l}</span>
    <span className="stamp tr-num">
      {value}
      {unit ? <small>{unit}</small> : null}
    </span>
    {under !== undefined ? <span className="caps tr-delta">{under}</span> : null}
  </span>
);

// ---------- weekly mileage: the hero ----------
const Mileage = ({ log, range }: { log: Log; range: Range }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  // A mouse hovers; a finger taps to pin the tooltip, and a tap outside the chart or 3 s lets it go.
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned || hover == null) return;
    const clear = () => {
      setHover(null);
      setPinned(false);
    };
    const timer = setTimeout(clear, 3000);
    const onDown = (ev: PointerEvent) => {
      if (!ref.current?.contains(ev.target as Node)) clear();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [pinned, hover, ref]);
  const onBarEnter = (i: number) => (ev: React.PointerEvent) => {
    if (ev.pointerType === 'touch' || pinned) return;
    setHover(i);
  };
  const onBarDown = (i: number) => (ev: React.PointerEvent) => {
    if (ev.pointerType !== 'touch') {
      setHover(i);
      return;
    }
    const off = pinned && hover === i;
    setHover(off ? null : i);
    setPinned(!off);
  };
  const onLeave = (ev: React.PointerEvent) => {
    if (ev.pointerType === 'touch' || pinned) return;
    setHover(null);
  };
  const onCancel = () => {
    setHover(null);
    setPinned(false);
  };
  const t = log.today;
  const thisMon = mondayOf(t);
  const PAST = WEEKS[range];
  const weeks = Array.from({ length: PAST + FUT }, (_, i) => shiftDays(thisMon, (i - PAST + 1) * 7));
  const pts = weeks.map((w) => {
    let planned = 0;
    let ran = 0;
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = shiftDays(w, i);
      for (const s of log.snap.sessionsOn(d)) if (s.kind === 'run' && sessionStatus(log.snap, d, s) !== 'skipped') planned += Number(s.miles) || 0;
      for (const a of log.snap.runsOn(d)) {
        ran += a.miles;
        n++;
      }
    }
    return { w, planned, ran, n, future: w > thisMon, avg: null as number | null };
  });
  const firstRun = pts.findIndex((p) => p.ran > 0);
  pts.forEach((p, i) => {
    if (p.future || firstRun < 0 || i < firstRun) return;
    const win = pts.slice(Math.max(firstRun, i - 3), i + 1);
    p.avg = win.reduce((x, q) => x + q.ran, 0) / win.length;
  });
  const cur = pts[PAST - 1]!;
  const prevAvg = PAST >= 2 ? pts[PAST - 2]!.avg : null;
  const delta = prevAvg == null ? null : cur.ran - prevAvg;

  const W = Math.max(240, width || 640);
  const H = 180;
  const max = Math.max(10, ...pts.map((p) => Math.max(p.ran, p.planned, p.avg ?? 0)));
  const step = max > 40 ? 20 : max > 20 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const left = 26;
  const right = 8;
  const y0 = H - 22;
  const y = (v: number) => y0 - (v / top) * (y0 - 14);
  const band = (W - left - right) / weeks.length;
  const bw = Math.max(4, Math.min(28, band * 0.62));
  const xc = (i: number) => left + band * i + band / 2;
  const line = pts.map((p, i) => (p.avg == null ? null : ([xc(i), y(p.avg)] as [number, number]))).filter((x): x is [number, number] => !!x);
  const hp = hover != null ? pts[hover] : null;
  const labelEvery = PAST <= 4 ? 2 : band * 4 >= 52 ? 4 : 8;
  const direct = band >= 34;
  const clipId = `mile-clip-${range}`;
  const ready = settled(log);
  return (
    <section className="tr-hero" aria-label="Weekly mileage">
      <span className="tr-glow" aria-hidden="true" />
      <div className="tr-top">
        <span className="caps">Weekly mileage</span>
        <span className="caps">Last {PAST} wk</span>
      </div>
      <div className="tr-stamps">
        <Stamp label="This week" value={ready ? mi(cur.ran) : '—'} unit="mi" under={ready && delta != null ? `${signed(delta)} vs avg` : ''} />
        <Stamp label="Planned" value={ready ? num(cur.planned) : '—'} unit="mi" />
        <Stamp label="Runs" value={ready ? cur.n : '—'} />
      </div>
      <div ref={ref} className="chart-wrap tr-chart" onPointerLeave={onLeave}>
        {width && ready ? (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Miles run per week against the plan">
            <defs>
              <clipPath id={clipId}>
                <rect x={0} y={0} width={W} height={y0} />
              </clipPath>
            </defs>
            {ticks.map((v) => (
              <g key={v}>
                <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className={v ? 'grid' : 'axis'} />
                <text x={0} y={y(v)} dy="0.32em" className="ax">
                  {v}
                </text>
              </g>
            ))}
            <g clipPath={`url(#${clipId})`}>
              {pts.map((p, i) => (
                <g key={p.w}>
                  {p.planned > 0 ? <rect x={xc(i) - bw / 2 + 0.5} y={y(p.planned)} width={Math.max(0, bw - 1)} height={Math.max(0, y0 - y(p.planned)) + 8} rx={3} className="plan-out" /> : null}
                  {p.ran > 0 ? <rect x={xc(i) - bw / 2} y={y(p.ran)} width={bw} height={y0 - y(p.ran) + 8} rx={3} className={`bar ${p.w === thisMon ? 'cur' : ''}`} /> : null}
                </g>
              ))}
            </g>
            {direct
              ? pts.map((p, i) =>
                  p.ran > 0 ? (
                    <text key={p.w} x={xc(i)} y={y(p.ran) - 5} textAnchor="middle" className="ax val">
                      {mi(p.ran)}
                    </text>
                  ) : null,
                )
              : null}
            {line.length > 1 ? <motion.path d={`M${line.map((q) => q.join(',')).join('L')}`} className="avg" initial={false} /> : null}
            {weeks.map((w, i) =>
              (i - (PAST - 1)) % labelEvery === 0 ? (
                <text key={w} x={xc(i)} y={H - 4} textAnchor="middle" className="ax">
                  {w === thisMon ? 'NOW' : up(fmtDate('md', w))}
                </text>
              ) : null,
            )}
            {hover != null ? <rect x={xc(hover) - bw / 2 - 3} y={8} width={bw + 6} height={y0 - 8} rx={5} className="hov" /> : null}
            {pts.map((p, i) => (
              <rect key={`h-${p.w}`} x={left + band * i} y={0} width={band} height={y0} fill="transparent" onPointerEnter={onBarEnter(i)} onPointerDown={onBarDown(i)} onPointerCancel={onCancel} />
            ))}
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hp ? (
          <div className="tip" style={{ left: Math.max(0, Math.min(width - 170, (xc(hover!) / W) * width - 85)), bottom: H - y(Math.max(hp.ran, hp.planned)) + 10 }}>
            <div className="tip-head">
              Week of {fmtDate('md', hp.w)}
              {hp.w === thisMon ? ' (so far)' : ''}
            </div>
            <div>{hp.future ? 'Upcoming' : `${mi(hp.ran)} mi · ${hp.n} ${hp.n === 1 ? 'run' : 'runs'}`}</div>
            {hp.planned ? <div className="tip-sub">Planned {num(hp.planned)} mi</div> : null}
            {hp.avg != null ? <div className="tip-sub">4-week average {mi(hp.avg)} mi</div> : null}
          </div>
        ) : null}
      </div>
      <div className="tr-legend caps">
        <span className="lg">
          <i style={{ background: 'rgba(255,255,255,0.85)' }} /> Run
        </span>
        <span className="lg">
          <i style={{ background: 'var(--accent-bright)' }} /> This week
        </span>
        <span className="lg">
          <i style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)' }} /> Plan
        </span>
        <span className="lg">
          <i style={{ height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.6)' }} /> Avg
        </span>
      </div>
    </section>
  );
};

// ---------- effort ----------
const Effort = ({ log, runs }: { log: Log; runs: Activity[] }) => {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  // Zones ride along with a sync of the linked account; this is the same call Settings makes.
  const sync = useMutation({
    mutationFn: () => api<{ changed?: number }>('/strava/sync', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.bootstrap });
      await qc.invalidateQueries({ queryKey: ['month'] });
    },
    onError: () => toast('Sync didn’t finish. Try again.'),
  });
  const ready = settled(log);
  const z = log.zones;
  const connected = !!log.strava?.connected;
  const recent = runs.slice(0, 10);
  const rows = recent.map((a) => {
    const sess = log.snap.sessionsOn(a.date).find((s) => s.kind === 'run') ?? null;
    const hr = a.avgHr != null ? { avg: a.avgHr, max: a.maxHr } : null;
    return { a, sess, hr, g: hr ? grade(z, sess, hr) : null, zone: hr ? zoneOf(z, hr.avg) : null };
  });
  const withHr = rows.filter((r) => r.hr);
  const easy = withHr.filter((r) => (r.zone ?? 9) <= 2).length;
  const graded = rows.filter((r) => r.g && /On target|Too/.test(r.g.verdict ?? ''));
  const ok = graded.filter((r) => r.g!.verdict === 'On target').length;
  const Z = (n: number) => z?.find((r) => r.zone === n);
  return (
    <>
      <Sec title="Effort check" meta={ready && recent.length ? `Last ${recent.length} runs` : undefined} />
      {z ? (
        <>
          <div className="tr-strip">
            <Stamp label="Easy enough" value={ready ? easy : '—'} unit={ready ? `of ${withHr.length} ${withHr.length === 1 ? 'run' : 'runs'}` : undefined} under={ready ? (graded.length ? `${ok} of ${graded.length} planned on target` : 'Grades start with a planned run') : ''} />
          </div>
          {Z(2) && Z(3) && Z(4) ? (
            <p className="t-cap tr-key">
              Easy under {Z(2)!.max} bpm · Threshold {Z(3)!.min}–{Z(4)!.max} · Speed above {Z(4)!.min}
            </p>
          ) : null}
        </>
      ) : null}
      {!ready ? (
        <div className="tr-wait" aria-busy="true" />
      ) : (
        <Group>
          {/* the chart's this-week bar is this page's blue, so the verb here is quiet */}
          {!z ? (
            connected ? (
              <EmptyState
                action={
                  <Button variant="quiet" disabled={sync.isPending} onClick={() => sync.mutate()}>
                    Sync
                  </Button>
                }
              >
                No heart-rate zones yet. They arrive with the next sync.
              </EmptyState>
            ) : (
              <EmptyState
                action={
                  log.features.strava ? (
                    <Button variant="quiet" onClick={() => nav('/settings')}>
                      Connect
                    </Button>
                  ) : undefined
                }
              >
                No heart-rate zones yet.
              </EmptyState>
            )
          ) : null}
          {rows.map((r) => (
            <Row
              key={r.a.id}
              title={fmtDate('short', r.a.date)}
              sub={r.sess ? label(r.sess) : 'Unplanned'}
              right={
                <div className="eff-right">
                  <span className="eff-nums">
                    <span className="stamp">
                      {mi(r.a.miles)}
                      <small>mi</small>
                    </span>
                    {r.hr ? (
                      <span className="stamp">
                        {r.hr.avg}
                        <small>bpm</small>
                      </span>
                    ) : null}
                  </span>
                  {z ? (
                    <span className="eff-grade">
                      {r.zone ? <b className={`hr-chip z${r.zone}`}>Z{r.zone}</b> : null}
                      {r.g?.verdict ? <span className={`verdict ${r.g.verdict === 'On target' ? 'ok' : /Too/.test(r.g.verdict) ? 'off' : 'na'}`}>{r.g.verdict}</span> : null}
                    </span>
                  ) : null}
                </div>
              }
            />
          ))}
          {!rows.length && z ? (
            <EmptyState
              action={
                connected ? (
                  <Button variant="quiet" disabled={sync.isPending} onClick={() => sync.mutate()}>
                    Sync
                  </Button>
                ) : undefined
              }
            >
              No runs yet. The next one lands here.
            </EmptyState>
          ) : null}
        </Group>
      )}
    </>
  );
};

// ---------- lifts ----------
const Lifts = () => {
  const all = useAllLifts();
  const groups = useMemo(() => {
    const by = new Map<string, { name: string; days: Map<string, { date: string; weight: number; reps: number }> }>();
    for (const s of all.data ?? []) {
      const k = s.exercise.trim().toLowerCase();
      if (!by.has(k)) by.set(k, { name: s.exercise.trim(), days: new Map() });
      const g = by.get(k)!;
      const best = g.days.get(s.date);
      if (!best || e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps)) g.days.set(s.date, s);
    }
    return [...by.values()].map((g) => ({ name: g.name, days: [...g.days.values()].sort((a, b) => (a.date < b.date ? -1 : 1)) })).sort((a, b) => (a.days[a.days.length - 1]!.date < b.days[b.days.length - 1]!.date ? 1 : -1));
  }, [all.data]);
  return (
    <>
      <Sec title="Lifts" meta={groups.length ? `${groups.length} ${groups.length === 1 ? 'exercise' : 'exercises'}` : undefined} />
      <Group>
        {groups.map((g) => {
          const last = g.days[g.days.length - 1]!;
          const first = g.days[0]!;
          const ch = g.days.length > 1 ? (e1rm(last.weight, last.reps) - e1rm(first.weight, first.reps)) / e1rm(first.weight, first.reps) : null;
          const vals = g.days.map((s) => e1rm(s.weight, s.reps));
          const lo = Math.min(...vals);
          const hi = Math.max(...vals);
          const spk = vals.map((v, i) => [2 + (i / Math.max(1, vals.length - 1)) * 36, hi === lo ? 10 : 17 - ((v - lo) / (hi - lo)) * 14] as const);
          return (
            <Row
              key={g.name}
              title={g.name}
              sub={`${g.days.length} ${g.days.length === 1 ? 'session' : 'sessions'} · ${fmtDate('md', last.date)}`}
              right={
                <>
                  {g.days.length > 1 ? (
                    <svg viewBox="0 0 40 20" width={40} height={20} aria-hidden="true" className="spark">
                      <path d={`M${spk.map((p) => p.join(',')).join('L')}`} className="spk" />
                      <circle cx={spk[spk.length - 1]![0]} cy={spk[spk.length - 1]![1]} r={2} className="spk-dot" />
                    </svg>
                  ) : null}
                  <div className="lift-right">
                    <span className="stamp">
                      {last.weight} × {last.reps}
                    </span>
                    <span className="caps">
                      e1RM {Math.round(e1rm(last.weight, last.reps))}
                      {ch == null ? '' : ` · ${ch >= 0 ? '+' : '−'}${Math.abs(Math.round(ch * 100))}%`}
                    </span>
                  </div>
                </>
              }
            />
          );
        })}
        {!groups.length ? all.isPending ? <div className="tr-wait in-group" aria-busy="true" /> : <EmptyState>No lifts yet. On a lift day, open the session and log one: exercise, weight, reps.</EmptyState> : null}
      </Group>
      {groups.length ? <p className="t-cap muted tr-legend">Estimated 1RM = weight × (1 + reps ÷ 30)</p> : null}
    </>
  );
};

// ---------- consistency ----------
const Consistency = ({ log }: { log: Log }) => {
  const nav = useNavigate();
  const [ref, width] = useWidth<HTMLDivElement>();
  const t = log.today;
  const W = Math.max(240, width || 600);
  const N = W < 520 ? 14 : 30;
  const days = Array.from({ length: N }, (_, i) => shiftDays(t, i - N + 1));
  const rows = [{ id: '__t', name: 'Training', train: true, createdOn: '' }, ...log.habits.map((h) => ({ id: h.id, name: h.name, train: false, createdOn: h.createdOn }))];
  const lw = Math.min(Math.max(80, W * 0.3), 150);
  const rateW = 40;
  const gap = W < 480 ? 3 : 4;
  const cell = Math.max(6, Math.min(18, Math.floor((W - lw - rateW - gap * (N - 1)) / N)));
  const rowH = cell + gap + 6;
  const H = rows.length * rowH + 6 + 24;
  const x = (i: number) => lw + i * (cell + gap);
  const stats = rows.map((r) => {
    let hit = 0;
    let of = 0;
    const cells = days.map((d) => {
      let cls = 'cell';
      if (r.train) {
        const st = dayStatus(log.snap, d);
        cls += st === 'done' || st === 'bonus' ? ' on' : st === 'floor' ? ' half' : st === 'missed' ? ' miss' : st === 'open' ? '' : ' none';
        if (st === 'done' || st === 'floor' || st === 'missed') {
          of++;
          if (st !== 'missed') hit++;
        }
      } else if (r.createdOn && d < r.createdOn) cls += ' none';
      else if (d < t || log.snap.isHabitDone(d, r.id)) {
        of++;
        if (log.snap.isHabitDone(d, r.id)) {
          hit++;
          cls += ' on';
        }
      }
      return { d, cls };
    });
    return { r, hit, of, cells };
  });
  const train = stats[0]!;
  const habitHit = stats.slice(1).reduce((s, x) => s + x.hit, 0);
  const habitOf = stats.slice(1).reduce((s, x) => s + x.of, 0);
  const pct = (hit: number, of: number) => (of ? `${Math.round((hit / of) * 100)}%` : '—');
  const ready = settled(log);
  return (
    <>
      <Sec title="Consistency" meta={`Last ${N} days`} />
      <div className="tr-strip">
        <Stamp label="Training" value={ready ? pct(train.hit, train.of) : '—'} under={!ready ? '' : train.of ? `of ${train.of} ${train.of === 1 ? 'day' : 'days'}` : 'no days yet'} />
        <Stamp label="Habits" value={ready ? pct(habitHit, habitOf) : '—'} under={!ready ? '' : habitOf ? `of ${habitOf} checks` : 'no checks yet'} />
      </div>
      <Group className="chart-group">
        <div ref={ref} className="chart-wrap">
          {width && ready ? (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Training and habits, day by day">
              {stats.map(({ r, hit, of, cells }, j) => {
                const yy = j * rowH + (j ? 6 : 0);
                const name = r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name;
                return (
                  <g key={r.id}>
                    <text x={0} y={yy + cell / 2} dy="0.32em" className={`lbl ${r.train ? 'strong' : ''}`}>
                      {name}
                    </text>
                    {cells.map((c, i) => (
                      <rect key={c.d} x={x(i)} y={yy} width={cell} height={cell} rx={Math.min(4, cell / 3.5)} className={c.cls} onClick={() => nav(c.d === t ? '/today' : `/today/${c.d}`)} style={{ cursor: 'pointer' }}>
                        <title>{fmtDate('short', c.d)}</title>
                      </rect>
                    ))}
                    <text x={W} y={yy + cell / 2} dy="0.32em" textAnchor="end" className="ax">
                      {pct(hit, of)}
                    </text>
                  </g>
                );
              })}
              {Array.from({ length: N }, (_, i) => i)
                .filter((i) => (N - 1 - i) % 7 === 0)
                .map((i) => (
                  <text key={i} x={i === N - 1 ? x(i) + cell : x(i) + cell / 2} y={H - 4} textAnchor={i === N - 1 ? 'end' : 'middle'} className="ax">
                    {i === N - 1 ? 'TODAY' : up(fmtDate('md', days[i]!))}
                  </text>
                ))}
            </svg>
          ) : (
            <div style={{ height: width ? H : 160 }} />
          )}
        </div>
      </Group>
      <div className="tr-legend caps">
        <span className="lg">
          <i style={{ background: 'var(--ok)' }} /> Done
        </span>
        <span className="lg">
          <i style={{ background: 'var(--warn)' }} /> Floor
        </span>
        <span className="lg">
          <i style={{ background: 'color-mix(in srgb, var(--bad) 60%, transparent)' }} /> Missed
        </span>
        <span className="lg">
          <i style={{ background: 'var(--surface-3)' }} /> Not done
        </span>
        <span className="lg">
          <i style={{ background: 'none', border: '1px dashed rgba(255,255,255,0.16)' }} /> No record
        </span>
      </div>
      <p className="t-cap muted tr-legend">Tap a day to open it</p>
    </>
  );
};

export default function TrendsView() {
  const [range, setRange] = useState<Range>('3M');
  const base = useLog([]);
  const t = base.today;
  const from = shiftDays(mondayOf(t), -7 * (WEEKS[range] - 1));
  const to = shiftDays(mondayOf(t), 7 * FUT + 6);
  const months = useMemo(() => monthsBetween(from, to), [from, to]);
  const log = useLog(months);
  const runs = useRuns(log, from, t);
  return (
    <div className="page">
      <PageHeader title="Trends" sub={`${WEEKS_WORD[range]} weeks, run and planned.`}>
        <Segmented label="Range" options={[['1M', '1M'], ['3M', '3M'], ['6M', '6M']]} value={range} onChange={setRange} />
      </PageHeader>
      <Mileage log={log} range={range} />
      <Effort log={log} runs={runs} />
      <Lifts />
      <Consistency log={log} />
    </div>
  );
}
