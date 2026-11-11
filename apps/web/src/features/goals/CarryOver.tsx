import type { Aim, ISODate } from '@logbook/shared';
import { CornerDownRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useGoalMutations, useGoals } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Pressable } from '@/ui/Pressable';
import { useToast } from '@/ui/Toast';
import { goalOf, STATUS_WORD } from './model';
import { carryable } from './follow';
import './goals.css';

/**
 * Make a goal today's: the same words, the same why, and its steps as they stood (a step already checked stays checked).
 * The goal it came from is left as it was. An Undo takes today's copy away again.
 */
export const useCarry = (today: ISODate) => {
  const { set, clear } = useGoalMutations();
  const toast = useToast();
  const qc = useQueryClient();
  return (from: Aim) => {
    haptics.toggle();
    set.mutate({ level: 'day', period: today, text: from.text, why: from.why ?? null, steps: from.steps.map((s) => ({ ...s })) });
    toast('Carried over to today', {
      label: 'Undo',
      fn: () => {
        // the copy may still carry its provisional id; whichever it has now is the one to take away
        const now = goalOf(qc.getQueryData<Aim[]>(['goals']), 'day', today);
        if (now) clear.mutate(now.id);
      },
    });
  };
};

/**
 * The carry-over as a row (the same template as `ReviewRow`, so the two read alike on Goals and in Today's Plan your day):
 * the goal as the title, how yesterday went under it, and a quiet "Carry over" at the trailing edge. The whole row is the
 * one target. Shown only while `carryable` finds a goal.
 */
export const CarryOver = ({ today, className = '' }: { today: ISODate; className?: string }) => {
  const goals = useGoals();
  const carry = useCarry(today);
  const from = carryable(goals.data, today);
  if (!from) return null;
  const how = `Yesterday’s goal · ${STATUS_WORD[from.status]}`;
  return (
    <Pressable className={`k-row two g-follow-row carry ${className}`.trim()} press="surface" onPress={() => carry(from)} label={`${from.text}. ${how}. Carry over to today`}>
      <span className="icon-tile" aria-hidden="true">
        <CornerDownRight size={18} />
      </span>
      <span className="k-row-main" aria-hidden="true">
        <span className="k-row-title">{from.text}</span>
        <span className="k-row-sub">{how}</span>
      </span>
      <span className="g-follow-act" aria-hidden="true">
        Carry over
      </span>
    </Pressable>
  );
};
