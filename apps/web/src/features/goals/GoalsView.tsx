import { currentGoals, periodOf, periodSpan, shiftDays, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell, CalendarRange, Check, ChevronRight, Minus, Plus, Sunrise, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useGoals } from '@/api/queries';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { SkeletonRows } from '@/ui/Skeleton';
import { Stack } from '@/ui/layout';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { useNowMinutes } from '../day/useNow';
import { cardCaps, clockOf, goalOf, LEVEL, LEVEL_HUE, setWords, STATUS_WORD } from './model';
import { disableReminders, enableReminders, remindersOn, remindersSupported } from './reminders';
import { useOpenGoal } from './GoalSheets';
import { ScoreStrip, StaleNudge } from './GoalParts';
import { celebrateOnce } from './game';
import { useCelebrate } from './Celebrate';
import { KSection } from './Kit';
import './goals.css';

/** Nearest first: the day, then the week, the month, the year. */
const LEVELS: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];

const hue = (level: GoalLevel) => ({ '--hue': LEVEL_HUE[level] }) as React.CSSProperties;

/** Where an answered goal stands, as a small word with its mark: Done, Partly, Missed. */
const Stamp = ({ status }: { status: Aim['status'] }) => (
  <span className={`gl-stamp is-${status}`}>
    {status === 'done' ? <Check size={14} strokeWidth={2.8} aria-hidden="true" /> : status === 'partly' ? <Minus size={14} strokeWidth={2.8} aria-hidden="true" /> : <X size={14} strokeWidth={2.6} aria-hidden="true" />}
    {STATUS_WORD[status]}
  </span>
);

/**
 * One level's goal as a card in the list: the period at the top with its time left, the goal in the serif (or the way to
 * set it), its steps as a slim bar with k/n, and a chevron. A tap opens the goal, or the two ways to set one.
 */
const GoalCard = ({ level, period, goal, today, now }: { level: GoalLevel; period: string; goal: Aim | null; today: string; now: number }) => {
  const open = useOpenGoal();
  const reduce = useReduced();
  const caps = cardCaps(level, period, today);
  const clock = clockOf(level, period, now);
  const n = goal?.steps.length ?? 0;
  const k = goal?.steps.filter((s) => s.done).length ?? 0;
  const answered = goal && goal.status !== 'open';
  const label = goal
    ? `${LEVEL[level].label} goal, ${caps}: ${goal.text}. ${answered ? STATUS_WORD[goal.status] : n ? `${k} of ${n} steps, ${clock.words}` : clock.words}. Open`
    : `${LEVEL[level].label} goal, ${caps}: not set. ${setWords(level, period, today)}`;
  return (
    <Pressable className={`gl-card ${goal ? `is-${goal.status}` : 'is-empty'}`} press="scale" style={hue(level)} onPress={() => open(level, period)} label={label}>
      <span className="gl-main" aria-hidden="true">
        <span className="gl-head">
          <span className="gl-tick" />
          <span className="caps gl-caps">{caps}</span>
          <span className="gl-left">{answered ? <Stamp status={goal.status} /> : clock.words}</span>
        </span>
        {goal ? (
          <span className="gl-text">{goal.text}</span>
        ) : (
          <span className="gl-set">
            <Plus size={18} strokeWidth={2.4} className="gl-set-plus" />
            {setWords(level, period, today)}
          </span>
        )}
        {goal && n ? (
          <span className="gl-steps">
            <span className="gl-bar">
              <motion.i initial={false} animate={{ scaleX: k / n }} transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.5, bounce: 0.1 }} />
            </span>
            <span className="gl-count tnum">
              {k}/{n}
            </span>
          </span>
        ) : !goal ? (
          <span className="gl-example">Like: {LEVEL[level].example}</span>
        ) : null}
      </span>
      <ChevronRight size={20} className="gl-chev" aria-hidden="true" />
    </Pressable>
  );
};

/**
 * Something ahead (tomorrow's goal, next week's), as a small chip in the row over the list: an icon tile and its name, then
 * the goal on one line with a chevron, or "Not set" with a Set pill that opens the two ways to set it.
 */
const AheadChip = ({ level, period, goal, today, icon, title, when, describedBy }: { level: GoalLevel; period: string; goal: Aim | null; today: string; icon: React.ReactNode; title: string; when: string; describedBy: string }) => {
  const open = useOpenGoal();
  return (
    <Pressable
      className={`ga-chip ${goal ? 'is-set' : 'is-empty'}`}
      press="scale"
      style={hue(level)}
      onPress={() => open(level, period)}
      label={goal ? `${title}, ${when}: ${goal.text}. Open` : `${title}, ${when}: not set. ${setWords(level, period, today)}`}
      aria-describedby={describedBy}
    >
      <span className="ga-top" aria-hidden="true">
        <span className="ga-ic">{icon}</span>
        <span className="ga-title">{title}</span>
        {goal ? <ChevronRight size={15} className="gl-chev ga-chev" /> : null}
      </span>
      <span className="ga-line" aria-hidden="true">
        {goal ? (
          <span className="ga-goal">{goal.text}</span>
        ) : (
          <>
            <span className="ga-none">Not set</span>
            <span className="ga-pill">
              <Plus size={13} strokeWidth={2.8} />
              Set
            </span>
          </>
        )}
      </span>
    </Pressable>
  );
};

/** The last fourteen days as a chain of lights: lit for a day goal hit, dim for one missed, empty for none set. */
const DayTrail = ({ goals, today, onOpen }: { goals: Aim[]; today: string; onOpen: () => void }) => {
  const days = Array.from({ length: 14 }, (_, i) => shiftDays(today, i - 13));
  const of = (d: string) => goalOf(goals, 'day', d);
  const set = days.filter((d) => of(d)).length;
  const hit = days.filter((d) => of(d)?.status === 'done').length;
  return (
    <Pressable className="g-trail" press="surface" onPress={onOpen} label={`Last 14 days: ${set} goals set, ${hit} done. Open the history`}>
      <span className="k-label g-trail-head">
        Day goals, last 14 days
        <ChevronRight size={16} aria-hidden="true" className="k-label-end" />
      </span>
      <span className="k-num g-trail-num">
        {set ? hit : '–'}
        <small>{set ? `of ${set} done` : 'No day goals yet'}</small>
      </span>
      <span className="g-trail-marks" aria-hidden="true">
        {days.map((d, i) => {
          const g = of(d);
          // a run of hit days joins up into one bar of light
          const joined = g?.status === 'done' && of(days[i - 1] ?? '')?.status === 'done';
          return <i key={d} className={`g-mark ${g ? `is-${g.status}` : 'is-none'} ${d === today ? 'is-today' : ''} ${joined ? 'is-joined' : ''}`} />;
        })}
      </span>
    </Pressable>
  );
};

/**
 * Goals (the second tab): what is ahead (tomorrow, next week) as two small chips at the top, then the goals that stand now
 * as a list of cards, nearest first (the day, the week, the month, the year), each opening its goal or the way to set it,
 * with a review owed at its head. Then the record and the reminders. Each
 * goal goes through the review when it is set (Locke and Latham's rules), and everything that happens to it is kept.
 */
export default function GoalsView(): React.JSX.Element {
  const today = useToday();
  const nav = useNav();
  const goals = useGoals();
  const minutes = useNowMinutes();
  const now = new Date(`${today}T00:00:00`).getTime() + minutes * 60e3;
  const list = goals.data ?? [];
  const cur = currentGoals(list, today);
  const [reminders, setReminders] = useState(remindersOn);
  const tomorrow = shiftDays(today, 1);
  const nextWeek = shiftPeriod('week', periodOf('week', today), 1);
  const aheadHint = useId();

  // a goal turning done while the tab is open (open → done), never one that loads done: the moment, once
  const was = useRef<Record<string, string>>({});
  const celebrate = useCelebrate();
  const sig = LEVELS.map((l) => `${cur[l]?.id}:${cur[l]?.status}`).join('|');
  useEffect(() => {
    for (const l of LEVELS) {
      const g = cur[l];
      if (!g) continue;
      const before = was.current[g.id];
      was.current[g.id] = g.status;
      if (before === 'open' && g.status === 'done') {
        celebrateOnce(`${g.id}:${g.updatedAt}`, l !== 'day');
        celebrate(g);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <div className="page g-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={16} />
      {goals.isPending && !goals.data ? (
        <SkeletonRows rows={4} label="Loading goals" />
      ) : (
        <>
          <div className="ga-row" role="group" aria-label="Ahead">
            <AheadChip level="day" period={tomorrow} goal={goalOf(list, 'day', tomorrow)} today={today} icon={<Sunrise size={15} />} title="Tomorrow" when={periodSpan('day', tomorrow)} describedBy={aheadHint} />
            <AheadChip level="week" period={nextWeek} goal={goalOf(list, 'week', nextWeek)} today={today} icon={<CalendarRange size={15} />} title="Next week" when={periodSpan('week', nextWeek)} describedBy={aheadHint} />
            <span id={aheadHint} className="sr-only">
              Set them the night before. The review makes each one specific and due on time.
            </span>
          </div>
          <KSection title="Now" meta={`${LEVELS.filter((l) => cur[l]).length} of 4 set`} className="g-now">
            <Stack className="gl-list">
              <StaleNudge goals={list} today={today} />
              {LEVELS.map((l) => (
                <GoalCard key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} now={now} />
              ))}
            </Stack>
          </KSection>
          <KSection title="History" action="See all" actionLabel="See all of the history" onAction={() => nav.push('/goals/history')} className="g-past">
            <Stack>
              <ScoreStrip goals={list} today={today} />
              <DayTrail goals={list} today={today} onOpen={() => nav.push('/goals/history')} />
              {remindersSupported() ? (
                <ul className="k-rows has-icons">
                  <li className="k-row two">
                    <span className="icon-tile" aria-hidden="true">
                      <Bell size={17} />
                    </span>
                    <span className="k-row-main">
                      <span className="k-row-title">Reminders</span>
                      <span className="k-row-sub">Each morning with no goal set, and Mondays for the week</span>
                    </span>
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
                  </li>
                </ul>
              ) : null}
            </Stack>
          </KSection>
        </>
      )}
    </div>
  );
}
