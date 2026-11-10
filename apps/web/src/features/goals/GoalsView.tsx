import { currentGoals, goalProgress, periodOf, periodSpan, shiftDays, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell, CalendarRange, Check, ChevronRight, Minus, Plus, Sunrise, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useGoals } from '@/api/queries';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { Stack } from '@/ui/layout';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { useNowMinutes } from '../day/useNow';
import { cardCaps, clockOf, goalOf, LEVEL, LEVEL_HUE, setWords, STATUS_WORD } from './model';
import { disableReminders, enableReminders, openAppSettings, reminderPermission, remindersOn, remindersSupported, reminderTime } from './reminders';
import { useOpenGoal } from './GoalSheets';
import { useReviewAccess } from './refine';
import { ScoreStrip, StaleNudge } from './GoalParts';
import { Burst, celebrateOnce } from './game';
import { TodayGoal } from './TodayGoal';
import { useCelebrate } from './Celebrate';
import { KSection } from './Kit';
import './goals.css';

/** Nearest first: the day, then the week, the month, the year. */
const LEVELS: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];
/** Under today's goal, the rest, nearest first. */
const BIGGER: readonly GoalLevel[] = ['week', 'month', 'year'];

/** A goal's words inside a longer name, without its own full stop. */
const bare = (t: string) => t.replace(/[.\s]+$/, '');

const hue = (level: GoalLevel) => ({ '--hue': LEVEL_HUE[level] }) as React.CSSProperties;

const MR = 19;
const MC = 2 * Math.PI * MR;
// the rings fill from empty once a session, the first time the tab shows them
let ringsDrawn = false;

/**
 * A level's ring: its colour filling as far as the goal has come (its steps; all of it once done), k/n in the middle, a
 * check once it is kept, a plus while it is unset. `hit` throws the burst.
 */
const MiniRing = ({ goal, hit, first }: { goal: Aim | null; hit: number; first: boolean }) => {
  const reduce = useReduced();
  const p = goal ? goalProgress(goal) : 0;
  const n = goal?.steps.length ?? 0;
  const k = goal?.steps.filter((s) => s.done).length ?? 0;
  return (
    <span className={`gl-ring ${goal ? `is-${goal.status}` : 'is-empty'}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" className="gl-ring-svg">
        <circle cx={24} cy={24} r={MR} className="gl-ring-track" />
        {goal ? (
          <motion.circle
            cx={24}
            cy={24}
            r={MR}
            className="gl-ring-arc"
            strokeDasharray={MC}
            transform="rotate(-90 24 24)"
            initial={first ? { strokeDashoffset: MC } : false}
            animate={{ strokeDashoffset: MC * (1 - Math.max(p > 0 ? 0.02 : 0, p)) }}
            transition={reduce ? { duration: 0 } : { type: 'spring', duration: first ? 1 : 0.6, bounce: 0.15, delay: first ? 0.25 : 0 }}
          />
        ) : null}
      </svg>
      <span className="gl-ring-mid">
        {!goal ? (
          <Plus size={18} strokeWidth={2.6} />
        ) : goal.status === 'done' ? (
          <Check size={20} strokeWidth={3} />
        ) : goal.status === 'partly' ? (
          <Minus size={18} strokeWidth={3} />
        ) : goal.status === 'missed' ? (
          <X size={18} strokeWidth={2.8} />
        ) : n ? (
          <span className="gl-ring-num tnum">
            {k}/{n}
          </span>
        ) : (
          <i className="gl-ring-dot" />
        )}
      </span>
      <Burst go={hit} />
    </span>
  );
};

/**
 * The week, the month or the year as a card under today's: its ring, the period with a chip for its time left, the goal in
 * the serif (or the way to set it), and a chevron. A tap opens the goal, or the two ways to set one.
 */
const LevelCard = ({ level, period, goal, today, now, hit, first }: { level: GoalLevel; period: string; goal: Aim | null; today: string; now: number; hit: number; first: boolean }) => {
  const open = useOpenGoal();
  const caps = cardCaps(level, period, today);
  const clock = clockOf(level, period, now);
  const n = goal?.steps.length ?? 0;
  const k = goal?.steps.filter((s) => s.done).length ?? 0;
  const answered = goal && goal.status !== 'open';
  // the printed words first (caps, chip, goal), then what only a listener needs
  const chip = answered ? STATUS_WORD[goal.status] : clock.words;
  const label = goal
    ? `${caps}, ${chip}, ${bare(goal.text)}. ${LEVEL[level].label} goal${!answered && n ? `, ${k} of ${n} steps` : ''}. Open`
    : `${caps}, ${chip}, ${setWords(level, period, today)}. ${LEVEL[level].label} goal, not set`;
  return (
    <Pressable className={`gl-card ${goal ? `is-${goal.status}` : 'is-empty'}`} press="scale" style={hue(level)} onPress={() => open(level, period)} label={label}>
      <MiniRing goal={goal} hit={hit} first={first} />
      <span className="gl-main" aria-hidden="true">
        <span className="gl-head">
          <span className="caps gl-caps">{caps}</span>
          <span className={`gl-chip ${answered ? `is-${goal.status}` : ''}`}>{answered ? STATUS_WORD[goal.status] : clock.words}</span>
        </span>
        {goal ? <span className="gl-text">{goal.text}</span> : <span className="gl-set">{setWords(level, period, today)}</span>}
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
      label={goal ? `${title}, ${bare(goal.text)}. ${when}. Open` : `${title}, Not set, Set. ${when}. ${setWords(level, period, today)}`}
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
            <Bell size={17} />
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
 * Goals (the second tab): what is ahead (tomorrow, next week) as two small chips at the top, then today's goal as the
 * hero (its gauge, its steps to check, the next move), a review owed, then the week, the month and the year as smaller
 * cards with their rings. Then the record and the reminders. Each goal goes through the review when it is set (Locke and
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
  const reduce = useReduced();

  // a goal turning done while the tab is open (open → done), never one that loads done: its burst and the moment, once
  const was = useRef<Record<string, string>>({});
  const [hits, setHits] = useState<Partial<Record<GoalLevel, number>>>({});
  const firstRings = useRef(!ringsDrawn && !reduce);
  useEffect(() => {
    if (goals.data) ringsDrawn = true;
  }, [goals.data]);
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
        setHits((h) => ({ ...h, [l]: Date.now() }));
        celebrate(g);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

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
            <AheadChip level="day" period={tomorrow} goal={goalOf(list, 'day', tomorrow)} today={today} icon={<Sunrise size={15} />} title="Tomorrow" when={periodSpan('day', tomorrow)} describedBy={aheadHint} />
            <AheadChip level="week" period={nextWeek} goal={goalOf(list, 'week', nextWeek)} today={today} icon={<CalendarRange size={15} />} title="Next week" when={periodSpan('week', nextWeek)} describedBy={aheadHint} />
            <span id={aheadHint} className="sr-only">
              {review === 'on' ? 'Set them the night before. The review makes each one specific and due on time.' : 'Set them the night before.'}
            </span>
          </div>
          <TodayGoal goal={cur.day} today={today} now={now} hit={hits.day ?? 0} />
          <StaleNudge goals={list} today={today} />
          </Stack>
          <KSection title="Further out" meta={`${BIGGER.filter((l) => cur[l]).length} of 3 set`} className="g-now">
            <Stack className="gl-list">
              {BIGGER.map((l) => (
                <LevelCard key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} now={now} hit={hits[l] ?? 0} first={firstRings.current} />
              ))}
            </Stack>
          </KSection>
          <KSection title="History" action="See all" actionLabel="See all of the history" onAction={() => nav.push('/goals/history')} className="g-past">
            <Stack>
              <ScoreStrip goals={list} today={today} />
            </Stack>
          </KSection>
          {remindersSupported() ? <Reminders goals={list} today={today} /> : null}
        </>
      )}
    </div>
  );
}
