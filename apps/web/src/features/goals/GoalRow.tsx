import { periodName, type Aim, type GoalLevel, type GoalStep, type ISODate } from '@logbook/shared';
import { ChevronRight, Plus } from 'lucide-react';
import { memo } from 'react';
import { Mark } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { clockOf, periodCaps, setWords } from './model';
import './goalrow.css';

/**
 * The one goal object (docs/system.md §5): Today's day goal and every row on Goals are this component. A caps eyebrow names
 * the period, the goal is one serif line, its steps are circle Marks, and the row's own Mark says the status. Empty, it is
 * one quiet row that sets the goal. No hue per level: the level is the eyebrow.
 */
export interface GoalRowProps {
  level: GoalLevel;
  period: string;
  goal: Aim | null;
  today: ISODate;
  /** Open the editor (empty) or the detail (set). */
  onOpen: () => void;
  /** Check or uncheck a step in place; absent, steps are read-only. */
  onToggleStep?: (step: GoalStep) => void;
  /** Mark the goal itself (done or open) from its Mark; absent, the Mark is display only. */
  onToggleDone?: () => void;
  /** `hero`: the day goal on Today (larger text). Default: a row on Goals. */
  variant?: 'row' | 'hero';
  /** The clock, for the time left. */
  now?: number;
}

const markStatus = (g: Aim): 'done' | 'floor' | 'missed' | 'open' => (g.status === 'done' ? 'done' : g.status === 'partly' ? 'floor' : g.status === 'missed' ? 'missed' : 'open');

export const GoalRow = memo(function GoalRow({ level, period, goal, today, onOpen, onToggleStep, onToggleDone, variant = 'row', now = Date.now() }: GoalRowProps) {
  const caps = periodCaps(level, period, today);
  if (!goal) {
    return (
      <Pressable as="div" className={`goal-row is-empty is-${variant}`} press="surface" onPress={onOpen} label={setWords(level, period, today)}>
        <span className="caps goal-row-caps">{caps}</span>
        <span className="goal-row-set">
          <Plus size={18} aria-hidden="true" />
          {setWords(level, period, today)}
        </span>
      </Pressable>
    );
  }
  const { words } = clockOf(level, period, now);
  const done = goal.steps.filter((s) => s.done).length;
  const closed = goal.status !== 'open';
  return (
    <div className={`goal-row is-${variant} is-${goal.status}`}>
      <Pressable as="div" className="goal-row-head" press="surface" onPress={onOpen} label={`${periodName(level, period, today)} goal: ${goal.text}. ${closed ? goal.status : words}`}>
        <span className="goal-row-top">
          <span className="caps goal-row-caps">{caps}</span>
          <span className="caps goal-row-meta">{closed ? goal.status : goal.steps.length ? `${done} of ${goal.steps.length} · ${words}` : words}</span>
        </span>
        <span className="goal-row-text">{goal.text}</span>
        <ChevronRight size={18} className="goal-row-chev" aria-hidden="true" />
      </Pressable>
      <div className="goal-row-mark">
        <Mark status={markStatus(goal)} label={closed ? `${goal.status}. Reopen` : 'Mark done'} onClick={onToggleDone} disabled={!onToggleDone} haptic="success" />
      </div>
      {goal.steps.length ? (
        <ul className="goal-row-steps">
          {goal.steps.map((s) => (
            <li key={s.id} className={`goal-row-step ${s.done ? 'is-done' : ''}`}>
              <Mark status={s.done ? 'done' : 'open'} label={s.text} onClick={onToggleStep ? () => onToggleStep(s) : undefined} disabled={!onToggleStep} haptic="toggle" />
              <span className="goal-row-step-text">{s.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
