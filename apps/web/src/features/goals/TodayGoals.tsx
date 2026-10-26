import { awaitingReview, periodOf, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { memo } from 'react';
import { useGoals } from '@/api/queries';
import { Pressable } from '@/ui/Pressable';
import { goalOf, periodCaps } from './model';
import { GoalRow } from './GoalsView';
import { useOpenGoal } from './GoalSheets';
import './goals.css';

/**
 * Goals on a day's page, near the top (under the hero): the day's goal and its week's, set or waiting to be set, on any
 * day (ahead, to plan; behind, as it was). On today a review owed comes first, as one quiet row.
 */
export const TodayGoals = memo(function TodayGoals({ date, today }: { date: ISODate; today: ISODate }) {
  const goals = useGoals();
  const open = useOpenGoal();
  if (!goals.data) return <div className="goals-card group is-skel" aria-hidden="true" />;
  const list = goals.data;
  const week = periodOf('week', date);
  const owed = date === today ? awaitingReview(list, today)[0] : undefined;
  return (
    <section className="goals-card group" aria-label="Goals">
      {owed ? (
        <Pressable className="g-owed" press="surface" onPress={() => open(owed.level, owed.period)} label={`${periodCaps(owed.level, owed.period, today)}: ${owed.text}. Did you hit it?`}>
          <span className="g-owed-dot" aria-hidden="true" />
          <span className="g-owed-text">
            <span className="caps">{periodCaps(owed.level, owed.period, today)}</span>
            <span className="g-owed-ask">Did you hit it?</span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="g-chev" />
        </Pressable>
      ) : null}
      <GoalRow level="day" period={date} goal={goalOf(list, 'day', date)} today={today} compact />
      <GoalRow level="week" period={week} goal={goalOf(list, 'week', week)} today={today} compact />
    </section>
  );
});
