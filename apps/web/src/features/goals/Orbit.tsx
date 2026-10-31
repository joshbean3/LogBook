import { goalProgress, type Aim, type GoalLevel } from '@logbook/shared';
import { motion } from 'motion/react';
import { useRef } from 'react';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import { clockOf, LEVEL_HUE } from './model';
import { Burst } from './game';

const SIZE = 288;
const C0 = SIZE / 2;
const W = 15;
/** Outside in: the year holds the month, the month the week, the week the day. */
const RINGS: Array<{ level: GoalLevel; r: number }> = [
  { level: 'year', r: 128 },
  { level: 'month', r: 102 },
  { level: 'week', r: 76 },
  { level: 'day', r: 50 },
];

// the rings draw themselves in once a session, the first time Goals is opened; after that they are simply there
let drawn = false;

export interface OrbitGoal {
  level: GoalLevel;
  period: string;
  goal: Aim | null;
}

/**
 * The orbit (the head of Goals): one ring per level, the year outermost. Each ring fills, in its level's colour, as far as
 * its goal has come (its steps; all of it once done), and a hand on it marks how much of the period is already gone, so a
 * goal behind the clock shows as an arc short of its hand. A tap on a ring picks that level. `hit` throws the burst.
 */
export const Orbit = ({ goals, sel, onSel, now, hit }: { goals: OrbitGoal[]; sel: GoalLevel; onSel: (l: GoalLevel) => void; now: number; hit: number }) => {
  const reduce = useReduced();
  const first = useRef(!drawn && !reduce);
  drawn = true;
  const ref = useRef<SVGSVGElement>(null);
  const pick = (e: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const s = box.width / SIZE;
    const d = Math.hypot(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2)) / s;
    const near = RINGS.reduce((a, b) => (Math.abs(b.r - d) < Math.abs(a.r - d) ? b : a));
    if (Math.abs(near.r - d) > W) return;
    if (near.level !== sel) haptics.select();
    onSel(near.level);
  };
  return (
    <div className="gv-orbit">
      <svg ref={ref} className="gv-orbit-svg" viewBox={`0 0 ${SIZE} ${SIZE}`} onPointerUp={pick} aria-hidden="true">
        {RINGS.map(({ level, r }, i) => {
          const g = goals.find((x) => x.level === level)!;
          const C = 2 * Math.PI * r;
          const p = g.goal ? goalProgress(g.goal) : 0;
          const clock = clockOf(level, g.period, now);
          const a = clock.elapsed * Math.PI * 2 - Math.PI / 2;
          const done = g.goal?.status === 'done';
          return (
            <g key={level} className={`gv-ring ${level === sel ? 'is-sel' : ''} ${g.goal ? '' : 'is-unset'} ${done ? 'is-done' : ''}`} style={{ '--hue': LEVEL_HUE[level] } as React.CSSProperties}>
              <circle cx={C0} cy={C0} r={r} className="gv-track" strokeWidth={W} />
              {g.goal ? (
                <motion.circle
                  cx={C0}
                  cy={C0}
                  r={r}
                  className="gv-arc"
                  strokeWidth={W}
                  strokeDasharray={C}
                  transform={`rotate(-90 ${C0} ${C0})`}
                  initial={first.current ? { strokeDashoffset: C } : false}
                  animate={{ strokeDashoffset: C * (1 - Math.max(0.002, p)) }}
                  transition={reduce ? { duration: 0 } : { type: 'spring', duration: first.current ? 1.1 : 0.7, bounce: 0.12, delay: first.current ? 0.08 * i : 0 }}
                />
              ) : null}
              {/* the hand: how much of the period has gone */}
              <line x1={C0 + Math.cos(a) * (r - W / 2 - 1)} y1={C0 + Math.sin(a) * (r - W / 2 - 1)} x2={C0 + Math.cos(a) * (r + W / 2 + 1)} y2={C0 + Math.sin(a) * (r + W / 2 + 1)} className="gv-hand" />
            </g>
          );
        })}
      </svg>
      <OrbitCentre g={goals.find((x) => x.level === sel)!} now={now} />
      <Burst go={hit} big />
    </div>
  );
};

const CENTRE_NAME: Record<GoalLevel, string> = { day: 'Today', week: 'This week', month: 'This month', year: 'This year' };

/** The middle of the orbit: the picked level, the time it has left, how far its goal has come. */
const OrbitCentre = ({ g, now }: { g: OrbitGoal; now: number }) => {
  const clock = clockOf(g.level, g.period, now);
  const n = g.goal?.steps.length ?? 0;
  const k = g.goal?.steps.filter((s) => s.done).length ?? 0;
  const sub = !g.goal ? 'No goal yet' : g.goal.status === 'done' ? 'Done' : g.goal.status !== 'open' ? (g.goal.status === 'partly' ? 'Partly done' : 'Missed') : n ? `${k} of ${n} steps` : 'Under way';
  return (
    <div className="gv-centre" style={{ '--hue': LEVEL_HUE[g.level] } as React.CSSProperties}>
      <span className="caps gv-centre-name">{CENTRE_NAME[g.level]}</span>
      <span className="gv-centre-left">{clock.words}</span>
      <span className={`gv-centre-sub ${g.goal?.status === 'done' ? 'is-done' : ''}`}>{sub}</span>
    </div>
  );
};
