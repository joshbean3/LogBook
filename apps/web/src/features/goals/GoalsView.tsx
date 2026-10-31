import { awaitingReview, currentGoals, GOAL_LEVELS, periodOf, shiftDays, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell, ChevronRight, History, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNav } from '@/app/NavController';
import { useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { SkeletonRows } from '@/ui/Skeleton';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { goalOf, LEVEL, periodCaps, setWords, STATUS_WORD } from './model';
import { disableReminders, enableReminders, remindersOn, remindersSupported } from './reminders';
import { ReviewButtons, StatusIcon, useOpenGoal } from './GoalSheets';
import { GoalRing, GoalSteps } from './Steps';
import './goals.css';

/**
 * One goal: the period in caps, the goal in the row's voice. A set goal is a thing to work: its ring at the left (tap to
 * mark it done; it fills as steps are checked), the words open its card, and with `steps` its steps sit under it to be
 * checked off where they are. An empty period is the way to set it.
 */
export const GoalRow = ({ level, period, goal, today, compact, steps }: { level: GoalLevel; period: string; goal: Aim | null; today: string; compact?: boolean; steps?: boolean }) => {
  const open = useOpenGoal();
  const caps = periodCaps(level, period, today);
  if (!goal)
    return (
      <Pressable className={`g-row is-empty ${compact ? 'compact' : ''}`} press="surface" onPress={() => open(level, period)} label={`${caps}: ${setWords(level, period, today)}`}>
        <span className="g-row-main">
          <span className="caps g-row-caps">{caps}</span>
          <span className="g-row-set">{setWords(level, period, today)}</span>
        </span>
        <span className="g-row-end" aria-hidden="true">
          <Plus size={18} strokeWidth={2.2} className="g-plus" />
        </span>
      </Pressable>
    );
  const n = goal.steps.length;
  const k = goal.steps.filter((x) => x.done).length;
  const ended = goal.status === 'partly' || goal.status === 'missed';
  return (
    <div className={`g-live is-${goal.status} ${compact ? 'compact' : ''}`}>
      <div className="g-live-head">
        {ended ? (
          <span className={`g-stamp g-live-stamp is-${goal.status}`} aria-label={STATUS_WORD[goal.status]}>
            <StatusIcon status={goal.status} size={14} />
          </span>
        ) : (
          <GoalRing goal={goal} label={`${caps}: ${goal.text}. ${goal.status === 'done' ? 'Done' : 'Mark done'}`} />
        )}
        <Pressable className="g-live-main" press="dim" onPress={() => open(level, period)} label={`${caps}: ${goal.text}. Open`}>
          <span className="caps g-row-caps">
            {caps}
            {n ? <span className="g-live-count tnum"> · {k} of {n}</span> : null}
          </span>
          <span className="g-row-text">{goal.text}</span>
        </Pressable>
      </div>
      {steps && n ? <GoalSteps goal={goal} compact /> : null}
    </div>
  );
};

/** The review owed first: a past goal still open, with its three answers. The next one waits behind it. */
const ReviewCard = ({ goals, today }: { goals: Aim[]; today: string }) => {
  const owed = awaitingReview(goals, today);
  const g = owed[0];
  if (!g) return null;
  return (
    <section className="card g-review" aria-label="Review">
      <span className="caps">
        {periodCaps(g.level, g.period, today)}
        {owed.length > 1 ? ` · 1 of ${owed.length}` : ''}
      </span>
      <p className="g-review-text">{g.text}</p>
      <p className="g-review-ask">Did you hit it?</p>
      <ReviewButtons goal={g} />
    </section>
  );
};

/** The last fourteen days as fourteen marks: what each day's goal came to, or nothing set. */
const DayTrail = ({ goals, today, onOpen }: { goals: Aim[]; today: string; onOpen: () => void }) => {
  const days = Array.from({ length: 14 }, (_, i) => shiftDays(today, i - 13));
  const of = (d: string) => goalOf(goals, 'day', d);
  const set = days.filter((d) => of(d)).length;
  const hit = days.filter((d) => of(d)?.status === 'done').length;
  return (
    <Pressable className="g-trail" press="surface" onPress={onOpen} label={`Last 14 days: ${set} goals set, ${hit} done. Open the history`}>
      <span className="g-trail-head">
        <span className="caps">Last 14 days</span>
        <span className="g-trail-sum tnum">
          {set ? `${hit} of ${set} done` : 'No day goals yet'}
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      </span>
      <span className="g-trail-marks" aria-hidden="true">
        {days.map((d) => {
          const g = of(d);
          return <i key={d} className={`g-mark ${g ? `is-${g.status}` : 'is-none'} ${d === today ? 'is-today' : ''}`} />;
        })}
      </span>
    </Pressable>
  );
};

/**
 * Goals (the second tab): a review owed, then the four goals that stand now (the year, the month, the week, the day), the
 * last fourteen days at a glance, the history, and the reminders. Each goal goes through the review when it is set
 * (docs/goals: Locke and Latham's rules), and everything that happens to it is kept.
 */
export default function GoalsView(): React.JSX.Element {
  const today = useToday();
  const nav = useNav();
  const goals = useGoals();
  const list = goals.data ?? [];
  const cur = currentGoals(list, today);
  const [reminders, setReminders] = useState(remindersOn);
  const next = (l: GoalLevel) => shiftPeriod(l, periodOf(l, today), 1);
  const tomorrow = shiftDays(today, 1);
  return (
    <div className="page g-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={24} />
      {goals.isPending && !goals.data ? (
        <SkeletonRows rows={4} label="Loading goals" />
      ) : (
        <>
          <ReviewCard goals={list} today={today} />
          <section className="g-now" aria-label="Your goals now">
            <div className="group g-group">
              {GOAL_LEVELS.map((l) => (
                <GoalRow key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} steps={l === 'day' || l === 'week'} />
              ))}
            </div>
          </section>
          <section className="g-ahead" aria-label="Ahead">
            <h2 className="sec-title">Ahead</h2>
            <div className="group g-group">
              <GoalRow level="day" period={tomorrow} goal={goalOf(list, 'day', tomorrow)} today={today} compact />
              <GoalRow level="week" period={next('week')} goal={goalOf(list, 'week', next('week'))} today={today} compact />
            </div>
          </section>
          <section className="g-past" aria-label="History">
            <DayTrail goals={list} today={today} onOpen={() => nav.push('/goals/history')} />
            <div className="group g-group">
              <Pressable className="g-link" press="surface" onPress={() => nav.push('/goals/history')} label="History. Open">
                <History size={18} aria-hidden="true" className="g-link-ic" />
                <span className="g-link-title">History</span>
                <span className="g-link-sub">Every goal, how it went, and what changed</span>
                <ChevronRight size={16} aria-hidden="true" className="g-chev" />
              </Pressable>
              {remindersSupported() ? (
                <div className="g-link g-switch">
                  <Bell size={18} aria-hidden="true" className="g-link-ic" />
                  <span className="g-link-title">Reminders</span>
                  <span className="g-link-sub">Each morning a goal is unset; Mondays for the week</span>
                  <Switch
                    on={reminders}
                    label="Goal reminders"
                    onChange={async (on) => {
                      if (on) setReminders(await enableReminders());
                      else {
                        await disableReminders();
                        setReminders(false);
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
            <p className="g-foot">{LEVEL.week.ask} Write it as you would say it; the review makes it specific, measurable and due on time.</p>
          </section>
        </>
      )}
    </div>
  );
}
