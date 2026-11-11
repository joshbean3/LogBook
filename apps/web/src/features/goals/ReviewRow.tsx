import { awaitingReview, periodName, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useGoals } from '@/api/queries';
import { Pressable } from '@/ui/Pressable';
import { useOpenGoal } from './GoalSheets';

/**
 * The review prompt for a goal still open after its time ran out (layout plan C-6, 2.2 G2). One component for Today's Plan
 * your day and for Goals, so the two read the same.
 *
 * This is the contract the foundation lands before the screen streams fork: `ReviewRow({ today, className })`, drawn with
 * Today's `OwedRow` markup moved here unchanged (its look is `.pd-owed` in features/dayplan/dayplan.css). The Goals stream
 * restyles it (one owed goal: the goal as the title, "Still open from Mon, Nov 9" under it, a quiet "Review"; several: "3
 * goals to review" opening the multi-goal review); the Today stream places it in Plan your day and deletes `OwedRow`.
 * Nothing renders while no goal is owed.
 */
export const ReviewRow = ({ today, className = '' }: { today: ISODate; className?: string }) => {
  const goals = useGoals();
  const open = useOpenGoal();
  const goal = awaitingReview(goals.data ?? [], today)[0];
  if (!goal) return null;
  // "Yesterday's goal", "Last week's goal"; an older one by its dates: "Goal for Mon, Nov 2"
  const name = periodName(goal.level, goal.period, today);
  const caps = /^(Yesterday|Last (week|month|year))$/.test(name) ? `${name}’s goal` : `Goal for ${name}`;
  return (
    <Pressable className={`pd-owed ${className}`.trim()} press="surface" onPress={() => open(goal.level, goal.period)} label={`${caps}: ${goal.text}. Did you hit it?`}>
      <span className="pd-owed-dot" aria-hidden="true" />
      <span className="pd-owed-text">
        <span className="caps">{caps}</span>
        <span className="pd-owed-goal">{goal.text}</span>
        <span className="pd-owed-ask">Did you hit it?</span>
      </span>
      <ChevronRight size={16} aria-hidden="true" />
    </Pressable>
  );
};
