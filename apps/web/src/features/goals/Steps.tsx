import { GOAL_STEPS_MAX, goalProgress, type Aim, type GoalStep } from '@logbook/shared';
import { Plus, X } from 'lucide-react';
import { animate, motion, useMotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useGoalMutations } from '@/api/queries';
import { hapticAtPeak } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { springs, useReduced } from '@/lib/motion';
import { usePress } from '@/ui/usePress';
import { TodoMark } from '../todos/TodoMark';
import './goals.css';

const newId = () => `s${Math.random().toString(36).slice(2, 9)}`;
export const stepsOf = (texts: readonly string[]): GoalStep[] => texts.map((text) => ({ id: newId(), text, done: false }));

const R = 12;
const C = 2 * Math.PI * R;
/** The pop's start velocity, as the to-do mark's. */
const POP_V = 5.5;

/**
 * The goal's ring: how far through its steps it is (an arc that fills as steps are checked), a check inside once it is
 * done. A tap marks the goal done (the ring fills, pops on `springs.complete`, `toggle` on the peak frame) or opens it
 * again. 28 px drawn, a 44 px target.
 */
export const GoalRing = ({ goal, label }: { goal: Aim; label: string }) => {
  const { review } = useGoalMutations();
  const reduce = useReduced();
  const pop = useMotionValue(1);
  const press = usePress();
  const unpeak = useRef<() => void>(() => {});
  useEffect(() => () => unpeak.current(), []);
  const done = goal.status === 'done';
  const p = goalProgress(goal);
  const toggle = () => {
    const next = done ? 'open' : 'done';
    if (next === 'done') {
      unpeak.current();
      unpeak.current = hapticAtPeak(pop, 'toggle');
      if (!reduce) animate(pop, 1, { ...springs.complete, velocity: POP_V });
      else pop.set(1.0001);
    }
    // done with steps left: they are all checked with it (the goal is the sum of its steps)
    review.mutate({ id: goal.id, status: next, ...(next === 'done' && goal.steps.some((s) => !s.done) ? { steps: goal.steps.map((s) => ({ ...s, done: true })) } : {}) });
  };
  return (
    <button type="button" className={`g-ring-hit ${done ? 'is-done' : ''}`} role="checkbox" aria-checked={done} aria-label={label} data-press="scale" {...press.handlers} onClick={toggle}>
      <motion.svg className="g-ring" width={28} height={28} viewBox="0 0 28 28" style={{ scale: pop }} aria-hidden="true">
        <circle cx={14} cy={14} r={R} className="g-ring-track" />
        <motion.circle cx={14} cy={14} r={R} className="g-ring-arc" strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - p) }} transition={reduce ? { duration: 0 } : springs.settle} transform="rotate(-90 14 14)" />
        <motion.path d="M9 14.5l3.2 3.2L19.5 10.5" className="g-ring-check" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }} />
      </motion.svg>
    </button>
  );
};

/**
 * A goal's steps, checked off where they stand (Today's card, the Goals tab, the goal's card). Checking the last one
 * finishes the goal; unchecking one of a done goal opens it again. `editable` adds the remove marks and the add row.
 */
export const GoalSteps = ({ goal, editable, compact }: { goal: Aim; editable?: boolean; compact?: boolean }) => {
  const { review } = useGoalMutations();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const save = (steps: GoalStep[]) => {
    const all = steps.length > 0 && steps.every((s) => s.done);
    const status = all && goal.status === 'open' ? 'done' : !all && goal.status === 'done' ? 'open' : undefined;
    review.mutate({ id: goal.id, steps, ...(status ? { status } : {}) });
  };
  const add = () => {
    const t = draft.trim();
    if (!t) return setAdding(false);
    save([...goal.steps, { id: newId(), text: t.slice(0, 120), done: false }]);
    setDraft('');
  };
  if (!goal.steps.length && !editable) return null;
  return (
    <ul className={`g-steps ${compact ? 'compact' : ''}`} aria-label="Steps">
      {goal.steps.map((s) => (
        <li key={s.id} className={`g-step ${s.done ? 'is-done' : ''}`}>
          <TodoMark on={s.done} label={s.text} onToggle={(next) => save(goal.steps.map((x) => (x.id === s.id ? { ...x, done: next } : x)))} />
          <span className="g-step-text">{s.text}</span>
          {editable ? (
            <button type="button" className="g-step-x" aria-label={`Remove ${s.text}`} onClick={() => save(goal.steps.filter((x) => x.id !== s.id))}>
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </li>
      ))}
      {editable && goal.steps.length < GOAL_STEPS_MAX ? (
        <li className="g-step g-step-add">
          {adding ? (
            <input
              className="g-step-input"
              autoFocus
              maxLength={120}
              placeholder="A step, verb first"
              enterKeyHint="done"
              value={draft}
              onFocus={(e) => revealField(e.currentTarget)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={add}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                } else if (e.key === 'Escape') setAdding(false);
              }}
            />
          ) : (
            <button type="button" className="g-step-addbtn" onClick={() => setAdding(true)}>
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              {goal.steps.length ? 'Add a step' : 'Break it into steps'}
            </button>
          )}
        </li>
      ) : null}
    </ul>
  );
};

/** Suggested steps before the goal exists: keep, drop or add, then they go in with it. */
export const DraftSteps = ({ steps, onChange }: { steps: string[]; onChange: (s: string[]) => void }) => {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && steps.length < GOAL_STEPS_MAX) onChange([...steps, t.slice(0, 120)]);
    setDraft('');
  };
  return (
    <ul className="g-steps is-draft" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={`${i}-${s}`} className="g-step">
          <span className="g-step-num tnum" aria-hidden="true">
            {i + 1}
          </span>
          <span className="g-step-text">{s}</span>
          <button type="button" className="g-step-x" aria-label={`Drop ${s}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <X size={15} aria-hidden="true" />
          </button>
        </li>
      ))}
      {steps.length < GOAL_STEPS_MAX ? (
        <li className="g-step g-step-add">
          <input className="g-step-input" maxLength={120} placeholder={steps.length ? 'Add a step' : 'Add a step, verb first'} enterKeyHint="done" value={draft} onFocus={(e) => revealField(e.currentTarget)} onChange={(e) => setDraft(e.target.value)} onBlur={add} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        </li>
      ) : null}
    </ul>
  );
};
