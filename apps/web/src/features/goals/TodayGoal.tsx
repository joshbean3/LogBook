import { GOAL_STEPS_MAX, goalProgress, type Aim } from '@logbook/shared';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useId, useRef, useState } from 'react';
import { revealField } from '@/lib/keyboard';
import { useReduced } from '@/lib/motion';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { TodoMark } from '../todos/TodoMark';
import '../todos/todos.css';
import { clockOf, periodCaps, STATUS_WORD } from './model';
import { useOpenGoal } from './GoalSheets';
import { newStepId, rowToggle, stepsLocked, useMarkDone, useSaveSteps } from './Steps';
import { Burst } from './game';
import { CarryOver } from './CarryOver';
import './goals.css';

/* the gauge: three quarters of a circle, open at the foot, filling clockwise from the lower left */
const R = 62;
const CX = 75;
const CY = 72;
const at = (deg: number) => [CX + R * Math.cos((deg * Math.PI) / 180), CY + R * Math.sin((deg * Math.PI) / 180)] as const;
const [SX, SY] = at(135);
const [EX, EY] = at(45);
const ARC = `M ${SX.toFixed(2)} ${SY.toFixed(2)} A ${R} ${R} 0 1 1 ${EX.toFixed(2)} ${EY.toFixed(2)}`;

// the gauge fills from empty once a session, the first time the tab shows it; after that it moves from where it stands
let filled = false;

/**
 * Today's goal as a gauge: the arc fills as its steps are checked (all of it once it is done) against a dot that marks how
 * much of the day has gone. In the middle, the steps done stamped big, or the time left when it has no steps.
 */
const Gauge = ({ goal, now, hit }: { goal: Aim; now: number; hit: number }) => {
  const reduce = useReduced();
  const first = useRef(!filled && !reduce);
  filled = true;
  const grad = useId();
  const p = goalProgress(goal);
  const n = goal.steps.length;
  const k = goal.steps.filter((s) => s.done).length;
  const clock = clockOf('day', goal.period, now);
  const [DX, DY] = at(135 + 270 * clock.elapsed);
  const done = goal.status === 'done';
  const answered = goal.status === 'partly' || goal.status === 'missed';
  return (
    <div className={`gh-gauge is-${goal.status}`} aria-hidden="true">
      <svg viewBox="0 0 150 132" className="gh-gauge-svg">
        <defs>
          <linearGradient id={grad} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffc83d" />
            <stop offset="100%" stopColor="#f2600c" />
          </linearGradient>
        </defs>
        <path d={ARC} className="gh-track" />
        <motion.path
          d={ARC}
          className="gh-arc"
          stroke={`url(#${grad})`}
          initial={first.current ? { pathLength: 0, opacity: 0 } : false}
          animate={{ pathLength: Math.max(0.001, p), opacity: p > 0 ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { pathLength: { type: 'spring', duration: first.current ? 1.1 : 0.7, bounce: 0.15, delay: first.current ? 0.15 : 0 }, opacity: { duration: 0.15 } }}
        />
        {/* the dot: how much of the day has gone */}
        {done || answered ? null : <circle cx={DX} cy={DY} r={4.5} className="gh-now" />}
      </svg>
      <div className="gh-mid">
        {done ? (
          <>
            <span className="gh-stamp is-check">
              <Check size={40} strokeWidth={2.8} />
            </span>
            <span className="gh-sub">Done today</span>
          </>
        ) : answered ? (
          <>
            <span className="gh-stamp is-word">{STATUS_WORD[goal.status]}</span>
            {n ? <span className="gh-sub">{`${k} of ${n} steps`}</span> : null}
          </>
        ) : n ? (
          <>
            <span className="gh-stamp tnum">
              {k}
              <small>/{n}</small>
            </span>
            <span className="gh-sub">steps done</span>
          </>
        ) : (
          <>
            <span className="gh-stamp tnum">{clock.words.replace(/ left$/, '')}</span>
            <span className="gh-sub">left today</span>
          </>
        )}
      </div>
      <Burst go={hit} big />
    </div>
  );
};

/**
 * Today's goal, the head of the tab: a warm card with the gauge, the goal in the serif, its steps to check right there
 * (the same save as Today: the last one checked finishes it), and one clear next move: Mark done once nothing is left, or
 * Add a step. Unset, the whole card is the way to set it.
 */
export const TodayGoal = ({ goal, today, now, hit }: { goal: Aim | null; today: string; now: number; hit: number }) => {
  const open = useOpenGoal();
  const saveSteps = useSaveSteps();
  const markDone = useMarkDone();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const caps = periodCaps('day', today, today).split(' · ').pop();
  const clock = clockOf('day', today, now);

  if (!goal)
    return (
      <>
        <Pressable className="gh is-empty" press="scale" onPress={() => open('day', today)} label={`Today, ${caps}, ${clock.words}. What would make today count? Set today’s goal`}>
          <span className="gh-head" aria-hidden="true">
            <span className="gh-label">Today</span>
            <span className="gh-date">{caps}</span>
            <span className="gh-chip">{clock.words}</span>
          </span>
          <span className="gh-sun" aria-hidden="true" />
          <span className="gh-ask" aria-hidden="true">
            What would make today count?
          </span>
          <span className="gh-cta" aria-hidden="true">
            <Plus size={18} strokeWidth={2.6} />
            Set today’s goal
          </span>
        </Pressable>
        <CarryOver today={today} className="gh-carry" />
      </>
    );

  const n = goal.steps.length;
  const k = goal.steps.filter((s) => s.done).length;
  const isOpen = goal.status === 'open';
  const editable = !stepsLocked(goal);
  const nothingLeft = isOpen && k === n;
  const add = () => {
    const t = draft.trim();
    setDraft('');
    setAdding(false);
    if (t) saveSteps(goal, [...goal.steps, { id: newStepId(), text: t.slice(0, 120), done: false }]);
  };
  const toggle = (id: string, next: boolean) => saveSteps(goal, goal.steps.map((x) => (x.id === id ? { ...x, done: next } : x)));
  // long words step down a size; past four lines the rest is in Details
  const long = goal.text.length > 80;
  return (
    <section className={`gh is-${goal.status}`} aria-label={`Today’s goal: ${goal.text}`}>
      <div className="gh-head">
        <span className="gh-label">Today</span>
        <span className="gh-date">{caps}</span>
        <span className="gh-chip">{isOpen ? clock.words : STATUS_WORD[goal.status]}</span>
      </div>
      <Gauge goal={goal} now={now} hit={hit} />
      <Pressable className={`gh-text ${long ? 'is-long' : ''}`} press="dim" onPress={() => open('day', today)} label={`${goal.text}. ${n ? `${k} of ${n} steps done. ` : ''}Open`}>
        <span className="gh-text-in">{goal.text}</span>
      </Pressable>
      {n || adding ? (
        <ul className="gh-steps" aria-label="Steps">
          {goal.steps.map((s) => (
            <li key={s.id} className={`gh-step ${s.done ? 'is-done' : ''} ${editable ? '' : 'is-locked'}`} onClick={editable ? rowToggle(() => toggle(s.id, !s.done)) : undefined}>
              <TodoMark round on={s.done} label={s.text} disabled={!editable} onToggle={(next) => toggle(s.id, next)} />
              <span className="gh-step-text">{s.text}</span>
            </li>
          ))}
          {adding ? (
            <li className="gh-step is-adding">
              <span className="gh-step-plus" aria-hidden="true">
                <Plus size={16} strokeWidth={2.4} />
              </span>
              <input
                className="gh-step-input"
                autoFocus
                maxLength={120}
                placeholder="A step, verb first"
                aria-label="New step"
                enterKeyHint="done"
                value={draft}
                onFocus={(e) => revealField(e.currentTarget)}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={add}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  } else if (e.key === 'Escape') {
                    setDraft('');
                    setAdding(false);
                  }
                }}
              />
            </li>
          ) : null}
        </ul>
      ) : null}
      <div className="gh-actions">
        {nothingLeft ? (
          <Button variant="primary" size="sm" className="gh-btn" onClick={() => markDone(goal)}>
            <Check size={17} strokeWidth={2.8} aria-hidden="true" />
            Mark done
          </Button>
        ) : null}
        {isOpen && n < GOAL_STEPS_MAX && !adding ? (
          <Button size="sm" className="gh-btn" onClick={() => setAdding(true)}>
            <Plus size={17} strokeWidth={2.6} aria-hidden="true" />
            {n ? 'Add a step' : 'Break it into steps'}
          </Button>
        ) : null}
        {!nothingLeft || !n ? (
          <Button variant="quiet" size="sm" className="gh-btn gh-more" onClick={() => open('day', today)}>
            Details
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </section>
  );
};
