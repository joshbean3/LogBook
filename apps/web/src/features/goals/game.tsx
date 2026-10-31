import { bestDayStreak, dayStreak, levelOf, POINTS, streakIfHit, STREAK_MILESTONES, totalGoalPoints, weekMarks, goalPoints, type Aim, type ISODate, type Todo } from '@logbook/shared';
import { Flame } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useGoals, useTodos } from '@/api/queries';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import './goals.css';

const todoPoints = (t: Todo) => POINTS.todo[t.priority] ?? POINTS.todo[0];

/** The scoreboard, from the goals and to-dos as they stand: streak, best, points, level, and what today has earned. */
export const useGame = () => {
  const today = useToday();
  const goals = useGoals();
  const todos = useTodos();
  return useMemo(() => {
    const gs = goals.data ?? [];
    const done = (todos.data ?? []).filter((t) => t.doneOn && !t.deletedOn);
    const points = totalGoalPoints(gs) + done.reduce((n, t) => n + todoPoints(t), 0);
    const todayGoal = gs.find((g) => g.level === 'day' && g.period === today);
    const todayPoints = (todayGoal ? goalPoints(todayGoal, todayGoal.status === 'done' ? streakIfHit(gs, today) : 0) : 0) + done.filter((t) => t.doneOn === today).reduce((n, t) => n + todoPoints(t), 0);
    return { ready: !!goals.data, goals: gs, streak: dayStreak(gs, today), best: bestDayStreak(gs), points, todayPoints, level: levelOf(points), today };
  }, [goals.data, todos.data, today]);
};

/** A "+N" that rises from where it was earned and fades (700 ms). Reduced motion: it fades in place. */
export const PointsPop = ({ pops }: { pops: Array<{ id: number; n: number }> }) => {
  const reduce = useReduced();
  return (
    <span className="g-pops" aria-hidden="true">
      <AnimatePresence>
        {pops.map((p) => (
          <motion.span key={p.id} className="g-pop tnum" initial={{ opacity: 0, y: 0, scale: 0.8 }} animate={{ opacity: [0, 1, 1, 0], y: reduce ? 0 : -26, scale: 1 }} transition={{ duration: 0.75, ease: 'easeOut', times: [0, 0.15, 0.6, 1] }}>
            +{p.n}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
};

/** Fire a "+N": returns the pops to render and the function that adds one (each clears itself). */
export const usePops = () => {
  const [pops, setPops] = useState<Array<{ id: number; n: number }>>([]);
  const fire = (n: number) => {
    const id = Date.now() + Math.random();
    setPops((p) => [...p, { id, n }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 800);
  };
  return { pops, fire };
};

/** The burst when a goal is hit: twelve sparks thrown from the ring's centre (500 ms), bigger on a streak milestone. */
export const Burst = ({ go, big }: { go: number; big?: boolean }) => {
  const reduce = useReduced();
  if (!go || reduce) return null;
  const n = big ? 16 : 12;
  const r = big ? 34 : 24;
  return (
    <span className="g-burst" aria-hidden="true" key={go}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return <motion.i key={i} className={i % 3 === 0 ? 'warm' : ''} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: 0, scale: 0.4 }} transition={{ duration: big ? 0.7 : 0.5, ease: [0.22, 1, 0.36, 1] }} />;
      })}
    </span>
  );
};

/** The streak on Today: the flame and its count, what hitting today's goal would make it, and the week as seven marks. */
export const StreakStrip = ({ date, goals }: { date: ISODate; goals: Aim[] }) => {
  const game = useGame();
  const isToday = date === game.today;
  const marks = weekMarks(goals, date, game.today);
  const todayGoal = goals.find((g) => g.level === 'day' && g.period === game.today);
  const next = streakIfHit(goals, game.today);
  const line = !isToday
    ? null
    : todayGoal?.status === 'done'
      ? `${game.streak}-day streak`
      : game.streak
        ? `Hit today’s goal to make it ${next}`
        : todayGoal
          ? 'Hit today’s goal to start a streak'
          : 'Set a goal to start a streak';
  const hot = game.streak > 0;
  return (
    <div className="g-strip">
      <div className="g-strip-top">
        <span className={`g-flame ${hot ? 'is-hot' : ''}`}>
          <Flame size={16} strokeWidth={2.2} fill={hot ? 'currentColor' : 'none'} aria-hidden="true" />
          <span className="tnum">{game.streak}</span>
        </span>
        <span className="g-strip-line">{line ?? `Best streak ${game.best} ${game.best === 1 ? 'day' : 'days'}`}</span>
        {isToday && game.todayPoints ? <span className="g-strip-pts tnum">+{game.todayPoints} today</span> : null}
      </div>
      <div className="g-week" role="img" aria-label={`This week: ${marks.filter((m) => m.mark === 'done').length} day goals hit`}>
        {marks.map((m) => (
          <span key={m.date} className={`g-wday is-${m.mark} ${m.date === game.today ? 'is-today' : ''}`}>
            <i />
            <span className="g-wday-l">{'MTWTFSS'[(new Date(`${m.date}T12:00:00`).getDay() + 6) % 7]}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/** The level card at the top of Goals: level, points, the bar to the next, the streak and the best. */
export const LevelCard = () => {
  const g = useGame();
  if (!g.ready) return null;
  const pct = g.level.span ? g.level.into / g.level.span : 0;
  return (
    <section className="card g-level" aria-label={`Level ${g.level.level}, ${g.points} points`}>
      <div className="g-level-top">
        <div className="g-level-l">
          <span className="caps">Level {g.level.level}</span>
          <span className="g-level-pts stamp tnum">
            {g.points.toLocaleString('en-US')}
            <small> pts</small>
          </span>
        </div>
        <div className="g-level-r">
          <span className={`g-flame big ${g.streak ? 'is-hot' : ''}`}>
            <Flame size={20} strokeWidth={2.2} fill={g.streak ? 'currentColor' : 'none'} aria-hidden="true" />
            <span className="tnum">{g.streak}</span>
          </span>
          <span className="g-level-best">best {g.best}</span>
        </div>
      </div>
      <div className="g-xp" aria-hidden="true">
        <motion.i initial={false} animate={{ scaleX: Math.max(0.02, pct) }} transition={{ type: 'spring', duration: 0.6, bounce: 0 }} />
      </div>
      <span className="g-level-next tnum">
        {(g.level.next - g.points).toLocaleString('en-US')} to level {g.level.level + 1}
        {g.todayPoints ? ` · +${g.todayPoints} today` : ''}
      </span>
    </section>
  );
};

export const isMilestone = (n: number) => (STREAK_MILESTONES as readonly number[]).includes(n);
