import { shiftDays, type Aim, type ISODate } from '@logbook/shared';
import { CornerDownRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGoalMutations, useGoals } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Pressable } from '@/ui/Pressable';
import { useToast } from '@/ui/Toast';
import { goalOf } from './model';
import './goals.css';

/** Yesterday's day goal when it was set and not hit (open, partly or missed), so it can be carried over to today. */
export const unfinishedYesterday = (goals: readonly Aim[] | undefined, today: ISODate): Aim | null => {
  const y = goalOf(goals, 'day', shiftDays(today, -1));
  return y && y.status !== 'done' ? y : null;
};

/**
 * One tap to make yesterday's unfinished goal today's: the same words, the same why, and its steps as they stood (a step
 * already checked stays checked). Shown only while today has no goal. Yesterday's goal is left as it was. An Undo takes
 * today's copy away again.
 */
export const CarryOver = ({ today, className = '' }: { today: ISODate; className?: string }) => {
  const goals = useGoals();
  const { set, clear } = useGoalMutations();
  const toast = useToast();
  const qc = useQueryClient();
  if (goalOf(goals.data, 'day', today)) return null;
  const from = unfinishedYesterday(goals.data, today);
  if (!from) return null;
  const carry = () => {
    haptics.toggle();
    set.mutate({ level: 'day', period: today, text: from.text, why: from.why ?? null, steps: from.steps.map((s) => ({ ...s })) });
    toast('Carried over from yesterday', {
      label: 'Undo',
      fn: () => {
        // the copy may still carry its provisional id; whichever it has now is the one to take away
        const now = goalOf(qc.getQueryData<Aim[]>(['goals']), 'day', today);
        if (now) clear.mutate(now.id);
      },
    });
  };
  return (
    <Pressable className={`carry ${className}`.trim()} press="dim" onPress={carry} label={`Carry over yesterday’s goal: ${from.text}`}>
      <CornerDownRight size={16} strokeWidth={2.4} aria-hidden="true" className="carry-icon" />
      <span className="carry-words" aria-hidden="true">
        <span className="carry-lead">Carry over yesterday’s</span>
        <span className="carry-goal">{from.text}</span>
      </span>
    </Pressable>
  );
};
