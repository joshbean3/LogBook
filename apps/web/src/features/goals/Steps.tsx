import { GOAL_STEPS_MAX, type Aim, type GoalStep } from '@logbook/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useGoalMutations } from '@/api/queries';
import { revealField } from '@/lib/keyboard';
import { IconButton, Mark } from '@/ui/primitives';
import './goals.css';

const newId = () => `s${Math.random().toString(36).slice(2, 9)}`;
export const newStepId = newId;
export const stepsOf = (texts: readonly string[]): GoalStep[] => texts.map((text) => ({ id: newId(), text, done: false }));

/** Save a goal's steps; the last one checked finishes the goal, one unchecked opens a done goal again. */
export const useSaveSteps = () => {
  const { review } = useGoalMutations();
  return (goal: Aim, steps: GoalStep[]) => {
    const all = steps.length > 0 && steps.every((s) => s.done);
    const status = all && goal.status === 'open' ? 'done' : !all && goal.status === 'done' ? 'open' : undefined;
    review.mutate({ id: goal.id, steps, ...(status ? { status } : {}) });
  };
};

/**
 * @deprecated The ring is gone (docs/system.md §4: every check is a `Mark`). A circle Mark that marks the goal done or opens it
 * again, kept for `features/dayplan/PlanDay.tsx`.
 */
export const GoalRing = ({ goal, label }: { goal: Aim; label: string }) => {
  const { review } = useGoalMutations();
  const done = goal.status === 'done';
  const toggle = () => {
    const next = done ? 'open' : 'done';
    review.mutate({ id: goal.id, status: next, ...(next === 'done' && goal.steps.some((s) => !s.done) ? { steps: goal.steps.map((s) => ({ ...s, done: true })) } : {}) });
  };
  return <Mark status={done ? 'done' : 'open'} label={label} onClick={toggle} haptic="success" />;
};

/**
 * A goal's steps in the detail sheet: circle Marks to check them where they stand (the last one finishes the goal), a remove
 * per step and one add row when `editable`.
 */
export const GoalSteps = ({ goal, editable }: { goal: Aim; editable?: boolean }) => {
  const saveSteps = useSaveSteps();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const save = (steps: GoalStep[]) => saveSteps(goal, steps);
  const add = () => {
    const t = draft.trim();
    if (!t) return setAdding(false);
    save([...goal.steps, { id: newId(), text: t.slice(0, 120), done: false }]);
    setDraft('');
  };
  if (!goal.steps.length && !editable) return null;
  return (
    <ul className="g-steps" aria-label="Steps">
      {goal.steps.map((s) => (
        <li key={s.id} className={`g-step ${s.done ? 'is-done' : ''}`}>
          <Mark status={s.done ? 'done' : 'open'} label={s.text} onClick={() => save(goal.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} haptic="toggle" />
          <span className="g-step-text">{s.text}</span>
          {editable ? (
            <IconButton label={`Remove ${s.text}`} className="g-step-x" onClick={() => save(goal.steps.filter((x) => x.id !== s.id))}>
              <X size={16} aria-hidden="true" />
            </IconButton>
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

/** Steps before the goal exists (the editor): numbered, each droppable, one row to add. */
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
          <IconButton label={`Drop ${s}`} className="g-step-x" onClick={() => onChange(steps.filter((_, j) => j !== i))}>
            <X size={16} aria-hidden="true" />
          </IconButton>
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
