import { dayStatus, e1rm, fmtDate, grade, label, mi, mondayOf, monthsBetween, num, sessionStatus, shiftDays, zoneOf } from '@logbook/shared';
import { motion } from 'motion/react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useActivities, useAllLifts } from '@/api/queries';
import { Card, CardHead, Empty, Loading, PageHeader } from '@/ui/primitives';
import { useLog } from '../log/useLog';
import './trends.css';

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

// ---------- weekly mileage ----------
const Mileage = ({ log }: { log: ReturnType<typeof useLog> }) => {
  const acts = useActivities();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const t = log.today;
  const thisMon = mondayOf(t);
  const PAST = width < 520 ? 9 : 13;
  const FUT = 4;
  const weeks = Array.from({ length: PAST + FUT }, (_, i) => shiftDays(thisMon, (i - PAST + 1) * 7));
  const pts = weeks.map((w) => {
    let planned = 0;
    for (let i = 0; i < 7; i++) {
      const d = shiftDays(w, i);
      for (const s of log.snap.sessionsOn(d)) if (s.kind === 'run' && sessionStatus(log.snap, d, s) !== 'skipped') planned += Number(s.miles) || 0;
    }
    const runs = (acts.data ?? []).filter((a) => a.kind === 'run' && a.date >= w && a.date < shiftDays(w, 7));
    return { w, planned, ran: runs.reduce((x, a) => x + a.miles, 0), n: runs.length, future: w > thisMon, avg: null as number | null };
  });
  pts.forEach((p, i) => {
    if (p.future) return;
    const win = pts.slice(Math.max(0, i - 3), i + 1).filter((x) => !x.future);
    p.avg = win.reduce((x, q) => x + q.ran, 0) / win.length;
  });
  const W = Math.max(280, width || 640);
  const H = 230;
  const max = Math.max(10, ...pts.map((p) => Math.max(p.ran, p.planned, p.avg ?? 0)));
  const step = max > 40 ? 20 : max > 20 ? 10 : 5;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const left = 30;
  const right = 60;
  const y0 = H - 24;
  const y = (v: number) => y0 - (v / top) * (y0 - 12);
  const band = (W - left - right) / weeks.length;
  const bw = Math.max(4, Math.min(26, band * 0.64));
  const xc = (i: number) => left + band * i + band / 2;
  const line = pts.map((p, i) => (p.avg == null ? null : [xc(i), y(p.avg)] as [number, number])).filter((x): x is [number, number] => !!x);
  const lastAvg = [...pts].reverse().find((p) => p.avg != null);
  const hp = hover != null ? pts[hover] : null;
  return (
    <Card>
      <CardHead title="Weekly mileage" meta={`Last ${PAST} weeks and the next ${FUT}`} />
      <div ref={ref} className="chart-wrap" onPointerLeave={() => setHover(null)}>
        {width ? (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Miles run per week against the plan">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className={v ? 'grid' : 'axis'} />
                <text x={0} y={y(v)} dy="0.32em" className="ax">
                  {v}
                </text>
              </g>
            ))}
            {pts.map((p, i) => (
              <g key={p.w}>
                {p.planned > 0 ? <rect x={xc(i) - bw / 2 + 0.75} y={y(p.planned)} width={Math.max(0, bw - 1.5)} height={Math.max(0, y0 - y(p.planned))} rx={4} className="plan-out" /> : null}
                {p.ran > 0 ? <motion.rect x={xc(i) - bw / 2} width={bw} rx={4} className={`bar ${p.w === thisMon ? 'cur' : ''}`} initial={{ y: y0, height: 0 }} animate={{ y: y(p.ran), height: y0 - y(p.ran) }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.02 }} /> : null}
                <rect x={left + band * i} y={0} width={band} height={y0} fill="transparent" onPointerEnter={() => setHover(i)} />
              </g>
            ))}
            {line.length > 1 ? <motion.path d={`M${line.map((q) => q.join(',')).join('L')}`} className="avg" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: 'easeOut' }} /> : null}
            {lastAvg?.avg != null ? (
              <text x={W - right + 6} y={y(lastAvg.avg)} dy="0.32em" className="ax">
                4-wk avg
              </text>
            ) : null}
            {weeks.map((w, i) => ((i - PAST + 1) % 4 === 0 ? (
              <text key={w} x={xc(i)} y={H - 6} textAnchor="middle" className="ax">
                {w === thisMon ? 'This wk' : fmtDate('md', w)}
              </text>
            ) : null))}
            {hover != null ? <rect x={xc(hover) - bw / 2 - 3} y={6} width={bw + 6} height={y0 - 6} rx={5} className="hov" /> : null}
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hp ? (
          <div className="tip" style={{ left: Math.max(0, Math.min(width - 170, (xc(hover!) / W) * width - 85)), top: Math.max(0, (y(Math.max(hp.ran, hp.planned)) / H) * H - 70) }}>
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
      <div className="legend">
        <span className="lg">
          <i style={{ background: 'var(--t-long)' }} /> Miles run
        </span>
        <span className="lg">
          <i style={{ background: 'none', border: '1.25px dashed var(--ink-3)', width: 8, height: 8 }} /> Planned
        </span>
        <span className="lg">
          <i style={{ height: 2, background: 'var(--t-hard)', borderRadius: 1 }} /> 4-week average
        </span>
      </div>
    </Card>
  );
};

// ---------- effort ----------
const Effort = ({ log }: { log: ReturnType<typeof useLog> }) => {
  const acts = useActivities();
  const z = log.zones;
  const runs = (acts.data ?? []).filter((a) => a.kind === 'run').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
  const rows = runs.map((a) => {
    const sess = log.snap.sessionsOn(a.date).find((s) => s.kind === 'run') ?? null;
    const hr = a.avgHr != null ? { avg: a.avgHr, max: a.maxHr } : null;
    return { a, sess, hr, g: hr ? grade(z, sess, hr) : null };
  });
  const withHr = rows.filter((r) => r.hr);
  const z2 = withHr.filter((r) => (zoneOf(z, r.hr!.avg) ?? 9) <= 2).length;
  const graded = rows.filter((r) => r.g && /On target|Too/.test(r.g.verdict ?? ''));
  const ok = graded.filter((r) => r.g!.verdict === 'On target').length;
  const Z = (n: number) => z?.find((r) => r.zone === n);
  return (
    <Card>
      <CardHead title="Effort check" />
      {z && Z(2) && Z(3) && Z(4) ? (
        <p className="fine">
          Easy: under {Z(2)!.max} bpm · Threshold: {Z(3)!.min}–{Z(4)!.max} · Speed: peak above {Z(4)!.min}
        </p>
      ) : null}
      {withHr.length ? (
        <p className="lead">
          <b className="big num">{z2}</b> of {withHr.length} recent runs averaged Zone 2 or easier.{graded.length ? ` ${ok} of ${graded.length} planned runs hit their target.` : ' Grades start with your first planned run.'}
        </p>
      ) : acts.isPending ? (
        <Loading />
      ) : (
        <Empty>{log.strava?.connected ? 'Heart rate shows up here once Strava runs come in.' : 'Connect Strava in Settings to grade effort by heart-rate zone.'}</Empty>
      )}
      {rows.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Planned</th>
                <th className="n">Miles</th>
                <th className="n">Avg HR</th>
                <th>Zone</th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const zn = r.hr ? zoneOf(z, r.hr.avg) : null;
                return (
                  <tr key={r.a.id}>
                    <td>{fmtDate('short', r.a.date)}</td>
                    <td>{r.sess ? label(r.sess) : 'Unplanned'}</td>
                    <td className="n">{mi(r.a.miles)}</td>
                    <td className="n">{r.hr ? r.hr.avg : '…'}</td>
                    <td>{zn ? <b className={`hr-chip z${zn}`}>Z{zn}</b> : ''}</td>
                    <td>{r.g?.verdict ? <span className={`verdict ${r.g.verdict === 'On target' ? 'ok' : /Too/.test(r.g.verdict) ? 'off' : 'na'}`}>{r.g.verdict}</span> : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
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
    <Card>
      <CardHead title="Lifts" meta="est. 1RM = weight × (1 + reps ÷ 30)" />
      {groups.length ? (
        <ul className="lifts">
          {groups.map((g) => {
            const last = g.days[g.days.length - 1]!;
            const first = g.days[0]!;
            const ch = g.days.length > 1 ? (e1rm(last.weight, last.reps) - e1rm(first.weight, first.reps)) / e1rm(first.weight, first.reps) : null;
            const vals = g.days.map((s) => e1rm(s.weight, s.reps));
            const lo = Math.min(...vals);
            const hi = Math.max(...vals);
            const spk = vals.map((v, i) => [2 + (i / Math.max(1, vals.length - 1)) * 68, hi === lo ? 10 : 16 - ((v - lo) / (hi - lo)) * 12] as const);
            return (
              <li key={g.name}>
                <div className="lift-main">
                  <span>{g.name}</span>
                  <small>
                    {g.days.length} {g.days.length === 1 ? 'session' : 'sessions'} · last {fmtDate('md', last.date)}
                  </small>
                </div>
                {g.days.length > 1 ? (
                  <svg viewBox="0 0 72 20" width={72} height={20} aria-hidden="true">
                    <path d={`M${spk.map((p) => p.join(',')).join('L')}`} className="spk" />
                    <circle cx={spk[spk.length - 1]![0]} cy={spk[spk.length - 1]![1]} r={2.25} className="spk-dot" />
                  </svg>
                ) : null}
                <div className="lift-top">
                  <b className="num">
                    {last.weight} × {last.reps}
                  </b>
                  <small>
                    e1RM {Math.round(e1rm(last.weight, last.reps))}
                    {ch == null ? '' : ` (${ch >= 0 ? '+' : ''}${Math.round(ch * 100)}%)`}
                  </small>
                </div>
              </li>
            );
          })}
        </ul>
      ) : all.isPending ? (
        <Loading />
      ) : (
        <Empty>No lifts logged yet. On a lift day, open the session and tap “Log lift”: exercise, weight, reps. About 15 seconds.</Empty>
      )}
    </Card>
  );
};

// ---------- consistency ----------
const Consistency = ({ log }: { log: ReturnType<typeof useLog> }) => {
  const nav = useNavigate();
  const [ref, width] = useWidth<HTMLDivElement>();
  const t = log.today;
  const W = Math.max(280, width || 600);
  const N = W < 520 ? 14 : 30;
  const days = Array.from({ length: N }, (_, i) => shiftDays(t, i - N + 1));
  const rows = [{ id: '__t', name: 'Training', train: true, createdOn: '' }, ...log.habits.map((h) => ({ id: h.id, name: h.name, train: false, createdOn: h.createdOn }))];
  const lw = Math.min(Math.max(80, W * 0.3), 150);
  const rateW = 40;
  const gap = W < 480 ? 2 : 3;
  const cell = Math.max(5, Math.min(18, Math.floor((W - lw - rateW - gap * (N - 1)) / N)));
  const rowH = cell + gap + 4;
  const H = rows.length * rowH + 28;
  const x = (i: number) => lw + i * (cell + gap);
  return (
    <Card>
      <CardHead title="Consistency" meta={`Last ${N} days · tap a day to open it`} />
      <div ref={ref} className="chart-wrap">
        {width ? (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Training and habits, day by day">
            {rows.map((r, j) => {
              const yy = j * rowH + (j ? 6 : 0);
              let hit = 0;
              let of = 0;
              const cells = days.map((d, i) => {
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
                return <rect key={d} x={x(i)} y={yy} width={cell} height={cell} rx={Math.min(4, cell / 3.5)} className={cls} onClick={() => nav(d === t ? '/today' : `/today/${d}`)} style={{ cursor: 'pointer' }} />;
              });
              const name = r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name;
              return (
                <g key={r.id}>
                  <text x={0} y={yy + cell / 2} dy="0.32em" className={`lbl ${r.train ? 'strong' : ''}`}>
                    {name}
                  </text>
                  {cells}
                  <text x={W} y={yy + cell / 2} dy="0.32em" textAnchor="end" className="ax">
                    {of ? `${Math.round((hit / of) * 100)}%` : '—'}
                  </text>
                </g>
              );
            })}
            {Array.from({ length: N }, (_, i) => i)
              .filter((i) => (N - 1 - i) % 7 === 0)
              .map((i) => (
                <text key={i} x={i === N - 1 ? x(i) + cell : x(i) + cell / 2} y={H - 6} textAnchor={i === N - 1 ? 'end' : 'middle'} className="ax">
                  {i === N - 1 ? 'Today' : fmtDate('md', days[i]!)}
                </text>
              ))}
          </svg>
        ) : (
          <div style={{ height: 120 }} />
        )}
      </div>
      <div className="legend">
        <span className="lg">
          <i style={{ background: 'var(--ok)' }} /> Done
        </span>
        <span className="lg">
          <i style={{ background: 'color-mix(in srgb, var(--ok) 45%, transparent)' }} /> Floor
        </span>
        <span className="lg">
          <i style={{ background: 'color-mix(in srgb, var(--bad) 30%, transparent)' }} /> Missed
        </span>
      </div>
    </Card>
  );
};

export default function TrendsView() {
  const base = useLog([]);
  const t = base.today;
  const months = useMemo(() => monthsBetween(shiftDays(mondayOf(t), -91), shiftDays(mondayOf(t), 35)), [t]);
  const log = useLog(months);
  return (
    <div className="page">
      <PageHeader eyebrow="Over time" title="Trends" sub="Runs from Strava, plan from this app." />
      <Mileage log={log} />
      <div className="two-col even">
        <Effort log={log} />
        <Lifts />
      </div>
      <Consistency log={log} />
    </div>
  );
}
