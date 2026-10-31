import { decodePolyline, recordsFor, routeGeometry, type Activity, type Lap, type RunRecord } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { useRunHistory } from '@/api/queries';
import { ease } from '@/lib/motion';
import { useFirstToday } from '@/ui/useFirstToday';

const W = 358;
const H = 180;

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

/**
 * The route (docs/system.md): one ink line on `--surface`, a dot where it starts, a ring where it ends. No map tiles, no
 * glow, no pins. It draws itself the first time it is seen today. `compact` is the strip's 120 px version.
 */
export const RouteMap = ({ polyline, drawKey, compact }: { polyline: string; drawKey: string; compact?: boolean }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(`route-sheet-${drawKey}`);
  const pts = useMemo(() => decodePolyline(polyline), [polyline]);
  const h = compact ? 120 : H;
  const g = useMemo(() => routeGeometry(pts, W, h, compact ? 14 : 24), [pts, h, compact]);
  if (!g.d) return null;
  const draw = first && !reduce;
  const [sx, sy] = g.xy[0]!;
  const [fx, fy] = g.xy[g.xy.length - 1]!;
  return (
    <div className={`ss-map ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="xMidYMid meet">
        <motion.path d={g.d} className="ss-map-line" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
        <circle cx={sx} cy={sy} r={compact ? 3 : 4} className="ss-map-start" />
        <motion.circle cx={fx} cy={fy} r={compact ? 3.5 : 5} className="ss-map-end" initial={draw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: draw ? 1.05 : 0, duration: 0.2 }} />
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
