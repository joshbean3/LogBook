import { assess, clock, decodePolyline, indexAlong, mi, num, recordHeadline, recordsFor, routeGeometry, type Activity, type Lap, type RunRecord, type Session } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useMemo } from 'react';
import { useRunHistory } from '@/api/queries';
import { ease } from '@/lib/motion';
import { useNowMark } from '@/ui/nowBudget';
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

/**
 * The record's mark: the milestone stamp (guide 8.4), a round Sunrise stamp rotated -10 degrees with PR in Night Ink and
 * a Paper keyline. It keeps the old medal's box, so the card around it does not move; one per screen, a stamp-priority
 * Sunrise mark (Night Ink once the screen's budget is spent).
 */
export const Medal = ({ size = 40 }: { size?: number }) => {
  const now = useNowMark('stamp');
  return (
    <svg className="medal" width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true" data-now={now === 'ink' ? 'ink' : undefined}>
      <g transform="rotate(-10 20 25)">
        <circle cx="20" cy="25" r="16" className="medal-disc" />
        <text x="20" y="29.5" textAnchor="middle" className="medal-pr">
          PR
        </text>
      </g>
    </svg>
  );
};

/**
 * The route at the top of the sheet: the Deep Sky line drawn in from the start (a Paper dot ringed in Night Ink) to the
 * finish (a checkered flag), on Cloud, with a PR pin where a record was set (the fastest mile, at that mile). It draws itself the first
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
          <pattern id={`c${id}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" className="ss-flag-a" />
            <rect width="3" height="3" className="ss-flag-b" />
            <rect x="3" y="3" width="3" height="3" className="ss-flag-b" />
          </pattern>
        </defs>
        <motion.path d={g.d} className="ss-map-line" initial={draw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
        <circle cx={sx} cy={sy} r={12} className="ss-map-start" />
        <motion.g initial={draw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: draw ? 1.05 : 0, duration: 0.2 }}>
          <circle cx={fx} cy={fy} r={8} fill={`url(#c${id})`} className="ss-flag" strokeWidth={2} />
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

/**
 * A finished run's numbers, in the order the sheet shows them: the distance first (the sheet's hero, "of 5 planned" under
 * it), then pace, moving time, elevation and average heart rate as two rows of tiles (cadence and max heart rate are in
 * the evidence's line under them).
 */
export const runNumbers = (sess: Session | null, runs: Activity[], log: Log, planned: number): Array<{ k: string; v: string; u?: string; n?: string }> => {
  const a = assess(log.zones, sess, runs);
  const elev = runs.reduce((t, r) => t + r.elevFt, 0);
  return [
    { k: 'Distance', v: mi(a.miles), u: 'mi', n: planned ? `of ${num(planned)} mi planned` : 'Distance' },
    { k: 'Avg pace', v: a.pace ?? '–', u: a.pace ? '/mi' : undefined },
    { k: 'Moving time', v: clock(a.movingSec) },
    { k: 'Elevation', v: String(Math.round(elev)), u: 'ft' },
    { k: 'Avg heart rate', v: a.avgHr != null ? String(a.avgHr) : '–', u: a.avgHr != null ? 'bpm' : undefined, n: a.avgHr == null ? 'No data yet' : undefined },
  ];
};
