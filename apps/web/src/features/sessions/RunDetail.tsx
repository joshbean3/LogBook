import { assess, clock, decodePolyline, indexAlong, mi, num, recordHeadline, recordsFor, routeGeometry, type Activity, type Lap, type RunRecord, type Session } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useMemo } from 'react';
import { useRunHistory } from '@/api/queries';
import { ease } from '@/lib/motion';
import { useFirstToday } from '@/ui/useFirstToday';
import type { Log } from '../log/useLog';

const W = 358;
const H = 210;

/** The run the day's records are about: the longest of its runs. */
export const mainRun = (runs: Activity[]): Activity | null => (runs.length ? runs.reduce((b, r) => (r.miles > b.miles ? r : b)) : null);

/** The day's run against every run before it (two years of them): its records, best yet or best this year. */
export const useRunRecords = (runs: Activity[]): RunRecord[] => {
  const h = useRunHistory();
  return useMemo(() => {
    const run = mainRun(runs);
    return run ? recordsFor(run, h.data ?? []) : [];
  }, [runs, h.data]);
};

/** The lap a split record was set on, as the very object in the run's laps (the splits list finds it by reference). */
export const recordLap = (runs: Activity[], records: RunRecord[]): Lap | null => {
  const r = records.find((x) => x.lap != null);
  const run = mainRun(runs);
  return r && run?.laps ? (run.laps[r.lap!] ?? null) : null;
};

/** The medal: a ribbon and a gold coin with PR on it. */
export const Medal = ({ size = 40 }: { size?: number }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="medal" width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <radialGradient id={`m${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffe9a3" />
          <stop offset="0.55" stopColor="#ffc83d" />
          <stop offset="1" stopColor="#e89a00" />
        </radialGradient>
      </defs>
      <path d="M9 2h9l4 14h-9z" fill="#ff5b5b" />
      <path d="M31 2h-9l-4 14h9z" fill="#ff8a5b" />
      <circle cx="20" cy="28" r="15" fill={`url(#m${id})`} stroke="#b37400" strokeWidth="1.5" />
      <text x="20" y="32.5" textAnchor="middle" className="medal-pr">
        PR
      </text>
    </svg>
  );
};

/**
 * The route at the top of the sheet: the line drawn in from the start (a mint dot) to the finish (a checkered flag), on a
 * dark map, with a gold medal pinned where a record was set (the fastest mile, at that mile). It draws itself the first
 * time it is seen today.
 */
export const RouteMap = ({ polyline, drawKey, run, records = [] }: { polyline: string; drawKey: string; run?: Activity | null; records?: RunRecord[] }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(`route-sheet-${drawKey}`);
  const id = useId().replace(/:/g, '');
  const pts = useMemo(() => decodePolyline(polyline), [polyline]);
  const g = useMemo(() => routeGeometry(pts, W, H, 30), [pts]);
  const pins = useMemo(() => {
    const laps = run?.laps ?? [];
    const total = laps.reduce((t, l) => t + l[0], 0);
    if (!total || g.xy.length < 2) return [];
    return records
      .filter((r) => r.lap != null && laps[r.lap])
      .map((r) => {
        const before = laps.slice(0, r.lap!).reduce((t, l) => t + l[0], 0);
        const [x, y] = g.xy[indexAlong(pts, (before + laps[r.lap!]![0] / 2) / total)]!;
        return { r, x, y };
      });
  }, [run, records, g, pts]);
  if (!g.d) return null;
  const draw = first && !reduce;
  const [sx, sy] = g.xy[0]!;
  const [fx, fy] = g.xy[g.xy.length - 1]!;
  return (
    <div className="ss-map" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`r${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ff8a5b" />
            <stop offset="1" stopColor="#ff4d3d" />
          </linearGradient>
          <pattern id={`c${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#fff" />
            <rect width="3" height="3" fill="#000" />
            <rect x="3" y="3" width="3" height="3" fill="#000" />
          </pattern>
        </defs>
        <path d={g.d} className="ss-map-glow" />
        <motion.path d={g.d} className="ss-map-line" stroke={`url(#r${id})`} initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
        <circle cx={sx} cy={sy} r={12} className="ss-map-start" />
        <motion.g initial={draw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: draw ? 1.05 : 0, duration: 0.2 }}>
          <circle cx={fx} cy={fy} r={8} fill={`url(#c${id})`} stroke="#fff" strokeWidth={2} />
        </motion.g>
        {pins.map(({ r, x, y }, i) => {
          const left = x > W * 0.58;
          const words = r.scope === 'best' ? `${r.title} · Best yet` : `${r.title} · ${(run?.date ?? '').slice(0, 4)}`;
          const tw = words.length * 6.4 + 16;
          return (
            <motion.g key={r.kind} initial={draw ? { scale: 0, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ delay: draw ? 0.9 + i * 0.12 : 0, type: 'spring', duration: 0.5, bounce: 0.5 }} style={{ transformOrigin: `${x}px ${y}px` }}>
              <rect x={left ? x - 14 - tw : x + 14} y={y - 11} width={tw} height={22} rx={11} className="ss-pin-tag" />
              <text x={left ? x - 14 - tw / 2 : x + 14 + tw / 2} y={y + 4} textAnchor="middle" className="ss-pin-words">
                {words}
              </text>
              <circle cx={x} cy={y} r={11} className="ss-pin" />
              <text x={x} y={y + 3.5} textAnchor="middle" className="ss-pin-pr">
                PR
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
};

/** Under the title: when the run started, as Strava says it: `Today at 1:47 PM`. */
export const whenLine = (date: string, today: string, time: string | null, startClock: (t: string) => string): string | null => {
  if (!time) return null;
  const d = new Date(`${date}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 864e5);
  const day = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d) : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  return `${day} at ${startClock(time)}`;
};

/**
 * The record, as a card under the title: the medal, the headline (`Your fastest mile yet!`), and what it beat. A tap
 * brings the splits into view with the record's mile lit. Any other records ride under it in a line.
 */
export const RecordCard = ({ records, date, onTap }: { records: RunRecord[]; date: string; onTap?: () => void }) => {
  const [top, ...rest] = records;
  if (!top) return null;
  return (
    <button type="button" className="rec-card" onClick={onTap}>
      <Medal />
      <span className="rec-words">
        <span className="rec-head">{recordHeadline(top, date)}</span>
        <span className="rec-detail">
          {top.value} · {top.detail}
        </span>
        {rest.length ? <span className="rec-more">Also {rest.map((r) => `${r.title.toLowerCase()} ${r.scope === 'best' ? 'yet' : `in ${date.slice(0, 4)}`}`).join(', ')}</span> : null}
      </span>
    </button>
  );
};

/** A finished run's numbers as Strava lays them out: two columns, the label over the number. */
export const RunGrid = ({ sess, runs, log, planned }: { sess: Session | null; runs: Activity[]; log: Log; planned: number }) => {
  const a = assess(log.zones, sess, runs);
  const elev = runs.reduce((t, r) => t + r.elevFt, 0);
  const cad = runs.find((r) => r.cadence)?.cadence ?? null;
  const cells: Array<[string, string, string?, string?]> = [
    ['Distance', mi(a.miles), 'mi', planned ? `of ${num(planned)} planned` : undefined],
    ['Avg Pace', a.pace ?? '—', a.pace ? '/mi' : undefined],
    ['Moving Time', clock(a.movingSec)],
    ['Elevation Gain', String(Math.round(elev)), 'ft'],
    ['Avg Heart Rate', a.avgHr != null ? String(a.avgHr) : '—', a.avgHr != null ? 'bpm' : undefined],
    cad ? ['Cadence', String(Math.round(cad)), 'spm'] : ['Max Heart Rate', a.maxHr != null ? String(a.maxHr) : '—', a.maxHr != null ? 'bpm' : undefined],
  ];
  return (
    <div className="run-grid" role="list" aria-label="The run">
      {cells.map(([k, v, u, n]) => (
        <span key={k} className="run-cell" role="listitem">
          <span className="run-k">{k}</span>
          <span className="run-v tnum">
            {v}
            {u ? <small> {u}</small> : null}
          </span>
          {n ? <span className="run-n">{n}</span> : null}
        </span>
      ))}
    </div>
  );
};
