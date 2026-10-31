import { awaitingReview, currentGoals, periodName, periodOf, shiftDays, shiftPeriod, type Aim, type GoalLevel, type GoalStep } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { useNav } from '@/app/NavController';
import { useGoalMutations, useGoals } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Button, Group, Row, Section } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { AskBar } from '../assistant/AskBar';
import { useNowMinutes } from '../day/useNow';
import { goalOf } from './model';
import { ReviewButtons, useOpenGoal } from './GoalSheets';
import { GoalRow } from './GoalRow';
import { useSaveSteps } from './Steps';
import './goals.css';

/** Nearest first: the day, then the week, the month, the year. */
const ORDER: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];

/** One period's goal as the one goal object, wired to the sheets and the mutations. */
const Goal = ({ level, period, goal, today, now }: { level: GoalLevel; period: string; goal: Aim | null; today: string; now: number }) => {
  const open = useOpenGoal();
  const saveSteps = useSaveSteps();
  const { review } = useGoalMutations();
  const toggleStep = goal ? (s: GoalStep) => saveSteps(goal, goal.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x))) : undefined;
  const toggleDone = goal
    ? () => {
        const next = goal.status === 'done' ? 'open' : 'done';
        review.mutate({ id: goal.id, status: next, ...(next === 'done' && goal.steps.some((x) => !x.done) ? { steps: goal.steps.map((x) => ({ ...x, done: true })) } : {}) });
      }
    : undefined;
  return <GoalRow level={level} period={period} goal={goal} today={today} now={now} onOpen={() => open(level, period)} onToggleStep={toggleStep} onToggleDone={toggleDone} />;
};

/**
 * A review owed (a period ended with its goal still open): one group at the top, the goal and its three answers. With more
 * than one owed, the rest can be marked missed in one tap. Nothing is asked mid-period.
 */
const ReviewOwed = ({ goals, today }: { goals: Aim[]; today: string }) => {
  const { review } = useGoalMutations();
  const owed = awaitingReview(goals, today);
  const g = owed[0];
  if (!g) return null;
  const rest = owed.slice(1);
  return (
    <div className="sec-secondary">
      <Group className="g-review">
        <div className="g-review-body">
          <p className="g-review-ask">{periodName(g.level, g.period, today)}: did you hit it?</p>
          <p className="g-review-text serif">{g.text}</p>
          <ReviewButtons goal={g} />
        </div>
        {rest.length ? (
          <Button
            variant="quiet"
            block
            onClick={() => {
              haptics.delete();
              for (const x of rest) review.mutate({ id: x.id, status: 'missed' });
            }}
          >
            Mark the other {rest.length === 1 ? 'one' : rest.length} missed
          </Button>
        ) : null}
      </Group>
    </div>
  );
};

/**
 * Goals (docs/system.md §2): one page, the Ask bar, then the day, week, month and year goals as one stack of the one goal
 * object (the day row is the same component Today shows), what is ahead, and the history. A review owed sits at the top.
 */
export default function GoalsView(): React.JSX.Element {
  const today = useToday();
  const nav = useNav();
  const goals = useGoals();
  const minutes = useNowMinutes();
  const now = new Date(`${today}T00:00:00`).getTime() + minutes * 60e3;
  const list = goals.data ?? [];
  const cur = currentGoals(list, today);
  const tomorrow = shiftDays(today, 1);
  const nextWeek = shiftPeriod('week', periodOf('week', today), 1);
  return (
    <div className="page g-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={24} />
      <AskBar date={today} context={{ tab: 'goals' }} />
      {goals.isPending && !goals.data ? (
        <SkeletonRows rows={4} label="Loading goals" />
      ) : (
        <>
          <ReviewOwed goals={list} today={today} />
          <Section title="Now" level="secondary">
            <div className="g-stack">
              {ORDER.map((l) => (
                <Goal key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} now={now} />
              ))}
            </div>
          </Section>
          <Section title="Ahead" level="primary">
            <div className="g-stack">
              <Goal level="day" period={tomorrow} goal={goalOf(list, 'day', tomorrow)} today={today} now={now} />
              <Goal level="week" period={nextWeek} goal={goalOf(list, 'week', nextWeek)} today={today} now={now} />
            </div>
          </Section>
          <Group className="sec-primary">
            <Row title="History" right={<ChevronRight size={18} className="lrow-chev" aria-hidden="true" />} onClick={() => nav.push('/goals/history')} />
          </Group>
        </>
      )}
    </div>
  );
}
