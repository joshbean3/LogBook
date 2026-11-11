import { awaitingReview, currentGoals, periodOf, periodSpan, shiftDays, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell, CalendarDays, CalendarRange, ChevronRight, Flag, Plus, Sunrise } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { Stack } from '@/ui/layout';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { useNowMinutes } from '../day/useNow';
import { cardCaps, clockOf, goalOf, LEVEL, setWords, STATUS_WORD } from './model';
import { disableReminders, enableReminders, openAppSettings, reminderPermission, remindersOn, remindersSupported, reminderTime } from './reminders';
import { useOpenGoal } from './GoalSheets';
import { useReviewAccess } from './refine';
import { ScoreStrip } from './GoalParts';
import { celebrateOnce } from './game';
import { ReviewRow } from './ReviewRow';
import { CarryOver } from './CarryOver';
import { carryable } from './follow';
import { TodayGoal } from './TodayGoal';
import { useCelebrate } from './Celebrate';
import { KSection } from './Kit';
import './goals.css';

/** Each level's glyph: the day a sunrise, the week its span, the month its days, the year a flag. */
const LEVEL_ICON: Record<GoalLevel, typeof CalendarRange> = { day: Sunrise, week: CalendarRange, month: CalendarDays, year: Flag };
const icon = (level: GoalLevel) => LEVEL_ICON[level];

/** Nearest first: the day, then the week, the month, the year. */
const LEVELS: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];
/** Under today's goal, the rest, nearest first. */
const BIGGER: readonly GoalLevel[] = ['week', 'month', 'year'];

/** A goal's words inside a longer name, without its own full stop. */
const bare = (t: string) => t.replace(/[.\s]+$/, '');

/**
 * The week, the month or the year as a row of the one inset group under "Further out" (layout plan 2.2 G1): its icon tile,
 * the period as the title, the goal (or "Not set") under it, the time left (or the answer) at the trailing edge, and a
 * chevron. A tap opens the goal, or the ways to set one.
 */
const LevelRow = ({ level, period, goal, today, now }: { level: GoalLevel; period: string; goal: Aim | null; today: string; now: number }) => {
  const open = useOpenGoal();
  const name = cardCaps(level, period, today);
  const clock = clockOf(level, period, now);
  const n = goal?.steps.length ?? 0;
  const k = goal?.steps.filter((s) => s.done).length ?? 0;
  const answered = goal && goal.status !== 'open';
  const end = answered ? STATUS_WORD[goal.status] : clock.words;
  // the printed words first (the period, the goal, the time left), then what only a listener needs
  const label = goal
    ? `${name}, ${bare(goal.text)}, ${end}. ${LEVEL[level].label} goal${!answered && n ? `, ${k} of ${n} steps` : ''}. Open`
    : `${name}, not set, ${end}. ${setWords(level, period, today)}`;
  const Icon = icon(level);
  return (
    <Pressable className={`k-row two gl-row ${goal ? `is-${goal.status}` : 'is-empty'}`} press="surface" onPress={() => open(level, period)} label={label}>
      <span className="icon-tile" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="k-row-main" aria-hidden="true">
        <span className="k-row-title">{name}</span>
        <span className="k-row-sub">{goal ? goal.text : 'Not set'}</span>
      </span>
      <span className={`k-row-end gl-end ${answered ? `is-${goal.status}` : ''}`} aria-hidden="true">
        {end}
      </span>
      <ChevronRight size={18} aria-hidden="true" className="k-chev" />
    </Pressable>
  );
};


/**
 * Something ahead (tomorrow's goal, next week's) as a context chip in the row over the hero (guide 6.3, layout plan 2.2
 * G8): a 40 px Haze disc (at 375 pt and wider), the name on one line and the goal or "Not set" under it. The whole chip is
 * the one target; "Not set" shows a + in the disc.
 */
const AheadChip = ({ level, period, goal, today, title, when, describedBy }: { level: GoalLevel; period: string; goal: Aim | null; today: string; title: string; when: string; describedBy: string }) => {
  const open = useOpenGoal();
  const Icon = goal ? icon(level) : Plus;
  return (
    <Pressable
      className={`ctx-chip ga-chip ${goal ? 'is-set' : 'is-empty'}`}
      press="scale"
      onPress={() => open(level, period)}
      label={goal ? `${title}, ${bare(goal.text)}. ${when}. Open` : `${title}, not set. ${when}. ${setWords(level, period, today)}`}
      aria-describedby={describedBy}
    >
      <span className="ctx-ic" aria-hidden="true">
        <Icon />
      </span>
      <span className="ctx-text" aria-hidden="true">
        <span className="ctx-title">{title}</span>
        <span className="ctx-sub">{goal ? goal.text : 'Not set'}</span>
      </span>
    </Pressable>
  );
};

/**
 * The morning reminder, in its own short section: when it comes, and a switch. Turning it on asks iOS and schedules what is
 * owed at once. When iOS has said no, only the Settings app can change that, so the page says so and opens it. What iOS
 * allows is read again on open and whenever the app comes back, so the switch never shows on while notifications are off.
 */
const Reminders = ({ goals, today }: { goals: Aim[]; today: string }) => {
  const boot = useBootstrap();
  const wake = boot.data?.morningSettings?.wake ?? 7 * 60;
  const [on, setOn] = useState(remindersOn);
  // denied, and the owner wanted them (tried just now, or had them on before Settings turned them off)
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () =>
      void reminderPermission()
        .then((p) => {
          if (!live) return;
          if (p !== 'granted') {
            if (p === 'denied' && remindersOn()) setBlocked(true);
            setOn(false);
          } else setBlocked(false);
        })
        .catch(() => undefined);
    check();
    const back = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', back);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', back);
    };
  }, []);
  return (
    <KSection title="Reminders" className="g-rem">
      <ul className="k-rows has-icons">
        <li className="k-row two">
          <span className="icon-tile" aria-hidden="true">
            <Bell size={18} />
          </span>
          <span className="k-row-main">
            <span className="k-row-title">Goal reminders</span>
            <span className="k-row-sub">{reminderTime(wake)}, only on days with no goal</span>
          </span>
          <Switch
            on={on}
            label="Goal reminders"
            onChange={async (next) => {
              if (!next) {
                await disableReminders();
                setBlocked(false);
                return setOn(false);
              }
              const ok = await enableReminders({ goals, today, wake }).catch(() => false);
              setOn(ok);
              setBlocked(!ok && (await reminderPermission().catch(() => 'prompt')) === 'denied');
            }}
          />
        </li>
      </ul>
      {blocked ? (
        <div className="k-card g-rem-off" role="status">
          <p className="k-foot">Notifications are off for Orby. Turn them on in Settings.</p>
          <Button size="sm" className="g-rem-btn" onClick={openAppSettings}>
            Open Settings
          </Button>
        </div>
      ) : null}
    </KSection>
  );
};

/**
 * Goals (the second tab; layout plan 2.2): what is ahead (tomorrow, next week) as two context chips at the top, then
 * today's goal as the hero (its gauge, its steps to check, the next move), a card with the review owed and the carry-over
 * while either has a row, then the week, the month and the year as rows of one inset group. Then the record and the
 * reminders. Each goal goes through the review when it is set (Locke and
 * Latham's rules), and everything that happens to it is kept.
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
  const aheadHint = useId();
  // the review is promised only where it runs (assistant access on)
  const review = useReviewAccess();

  // today's goal turning done while the tab is open (open → done), never one that loads done: its burst and the moment,
  // once; the week's, month's and year's moments play the same way, without a burst of their own
  const was = useRef<Record<string, string>>({});
  const [hit, setHit] = useState(0);
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
        if (l === 'day') setHit(Date.now());
        celebrate(g);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  // the review owed and the carry-over share one card under the hero, and it shows only while one of them has a row
  const follow = awaitingReview(list, today).length > 0 || !!carryable(list, today);

  return (
    <div className="page g-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={16} />
      {goals.isError && !goals.data ? (
        <section className="k-card g-error" role="alert">
          <p className="k-row-title">Goals didn’t load.</p>
          <p className="k-foot">Check the connection, then try again.</p>
          <Button size="sm" className="g-error-btn" onClick={() => void goals.refetch()} disabled={goals.isFetching}>
            Try again
          </Button>
        </section>
      ) : goals.isPending && !goals.data ? (
        <SkeletonRows rows={4} label="Loading goals" />
      ) : (
        <>
          <Stack className="g-top">
            <div className="ga-row" role="group" aria-label="Ahead">
              <AheadChip level="day" period={tomorrow} goal={goalOf(list, 'day', tomorrow)} today={today} title="Tomorrow" when={periodSpan('day', tomorrow)} describedBy={aheadHint} />
              <AheadChip level="week" period={nextWeek} goal={goalOf(list, 'week', nextWeek)} today={today} title="Next week" when={periodSpan('week', nextWeek)} describedBy={aheadHint} />
              <span id={aheadHint} className="sr-only">
                {review === 'on' ? 'Set them the night before. The review makes each one specific and due on time.' : 'Set them the night before.'}
              </span>
            </div>
            <TodayGoal goal={cur.day} today={today} now={now} hit={hit} />
            {follow ? (
              <div className="k-rows has-icons g-follow">
                <ReviewRow today={today} />
                <CarryOver today={today} />
              </div>
            ) : null}
          </Stack>
          <KSection title="Further out" meta={`${BIGGER.filter((l) => cur[l]).length} of 3 set`} className="g-now">
            <div className="k-rows has-icons gl-list">
              {BIGGER.map((l) => (
                <LevelRow key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} now={now} />
              ))}
            </div>
          </KSection>
          <KSection title="History" meta="Goals kept" action="See all" actionLabel="See all of the history" onAction={() => nav.push('/goals/history')} className="g-past">
            <ScoreStrip goals={list} today={today} />
          </KSection>
          {remindersSupported() ? <Reminders goals={list} today={today} /> : null}
        </>
      )}
    </div>
  );
}
