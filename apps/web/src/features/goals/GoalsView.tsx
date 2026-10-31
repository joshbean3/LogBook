import { awaitingReview, currentGoals, goalProgress, periodOf, shiftDays, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell, ChevronRight, History, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useGoals } from '@/api/queries';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { SkeletonRows } from '@/ui/Skeleton';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { useNowMinutes } from '../day/useNow';
import { clockOf, goalOf, LEVEL, LEVEL_HUE, periodCaps, setWords, STATUS_WORD } from './model';
import { disableReminders, enableReminders, remindersOn, remindersSupported } from './reminders';
import { ReviewButtons, StatusIcon, useOpenGoal } from './GoalSheets';
import { GoalRing, GoalSteps } from './Steps';
import { Burst, celebrateOnce } from './game';
import { Orbit, type OrbitGoal } from './Orbit';
import { useCelebrate } from './Celebrate';
import './goals.css';

/** Nearest first on the cards: the day, then the week, the month, the year (the orbit draws them the other way, outside in). */
const CARD_ORDER: readonly GoalLevel[] = ['day', 'week', 'month', 'year'];

/**
 * One goal as a row (the Ahead list): the ring at the left to finish it, the words to open it, its steps under it when
 * asked. An empty period is the way to set it.
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
  const ended = goal.status === 'partly' || goal.status === 'missed';
  return (
    <div className={`g-live is-${goal.status} ${compact ? 'compact' : ''}`}>
      <div className="g-live-head">
        {ended ? (
          <span className={`g-stamp g-live-stamp is-${goal.status}`} aria-label={STATUS_WORD[goal.status]}>
            <StatusIcon status={goal.status} size={14} />
          </span>
        ) : (
          <span className="g-ring-wrap">
            <GoalRing goal={goal} label={`${caps}: ${goal.text}. ${goal.status === 'done' ? 'Done' : 'Mark done'}`} />
          </span>
        )}
        <Pressable className="g-live-main" press="dim" onPress={() => open(level, period)} label={`${caps}: ${goal.text}. Open`}>
          <span className="caps g-row-caps">{caps}</span>
          <span className="g-row-text">{goal.text}</span>
        </Pressable>
      </div>
      {steps && goal.steps.length ? <GoalSteps goal={goal} compact /> : null}
    </div>
  );
};

/**
 * One level's card in the strip under the orbit: its colour glowing up from the corner as its goal comes along, the period
 * and its time left, the goal in large serif, its steps to check right there, the ring to finish it. Done, the card is lit
 * in its colour.
 */
const LevelCard = ({ level, period, goal, today, now, hit }: { level: GoalLevel; period: string; goal: Aim | null; today: string; now: number; hit: number }) => {
  const open = useOpenGoal();
  const reduce = useReduced();
  const caps = periodCaps(level, period, today);
  const clock = clockOf(level, period, now);
  const p = goal ? goalProgress(goal) : 0;
  const style = { '--hue': LEVEL_HUE[level], '--p': p } as React.CSSProperties;
  if (!goal)
    return (
      <Pressable className="gv-card is-empty" press="surface" style={style} onPress={() => open(level, period)} label={setWords(level, period, today)}>
        <span className="gv-card-glow" aria-hidden="true" />
        <span className="gv-card-head">
          <span className="caps">{caps}</span>
          <span className="gv-left">{clock.words}</span>
        </span>
        <span className="gv-set">
          <span className="gv-set-plus" aria-hidden="true">
            <Plus size={20} strokeWidth={2.4} />
          </span>
          <span className="gv-set-words">{setWords(level, period, today)}</span>
        </span>
        <span className="gv-example">Like: {LEVEL[level].example}</span>
      </Pressable>
    );
  const ended = goal.status === 'partly' || goal.status === 'missed';
  return (
    <article className={`gv-card is-${goal.status}`} style={style} aria-label={`${caps}: ${goal.text}`}>
      <motion.span className="gv-card-glow" aria-hidden="true" initial={false} animate={{ opacity: goal.status === 'done' ? 1 : 0.25 + 0.6 * p }} transition={reduce ? { duration: 0 } : { duration: 0.5 }} />
      <div className="gv-card-head">
        <span className="caps">{caps}</span>
        <span className="gv-left">{goal.status === 'done' ? 'Done' : ended ? STATUS_WORD[goal.status] : clock.words}</span>
      </div>
      <div className="gv-card-body">
        <Pressable className="gv-text" press="dim" onPress={() => open(level, period)} label={`${goal.text}. Open`}>
          {goal.text}
        </Pressable>
        {ended ? (
          <span className={`g-stamp is-${goal.status}`} aria-label={STATUS_WORD[goal.status]}>
            <StatusIcon status={goal.status} size={16} />
          </span>
        ) : (
          <span className="g-ring-wrap gv-card-ring">
            <GoalRing goal={goal} label={`${caps}: ${goal.text}. ${goal.status === 'done' ? 'Done' : 'Mark done'}`} />
            <Burst go={hit} />
          </span>
        )}
      </div>
      {goal.steps.length ? <GoalSteps goal={goal} compact /> : null}
      <span className="gv-clock" aria-hidden="true">
        <i style={{ transform: `scaleX(${clock.elapsed})` }} />
      </span>
    </article>
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

/** The last fourteen days as a chain of lights: lit for a day goal hit, dim for one missed, empty for none set. */
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
 * Goals (the second tab). The orbit first: the four goals that stand now as rings, the year holding the month holding the
 * week holding the day, each filling as its goal comes along against a hand that shows the time gone. Under it, a card per
 * level to swipe through (the orbit and the cards follow each other), then a review owed, what is ahead, the last two
 * weeks, the history, the reminders. Each goal goes through the review when it is set (Locke and Latham's rules), and
 * everything that happens to it is kept.
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
  const [sel, setSel] = useState<GoalLevel>('day');
  const next = (l: GoalLevel) => shiftPeriod(l, periodOf(l, today), 1);
  const tomorrow = shiftDays(today, 1);
  const orbit: OrbitGoal[] = CARD_ORDER.map((l) => ({ level: l, period: periodOf(l, today), goal: cur[l] }));

  // a goal turning done here (open → done), never one that loads done: the burst in the orbit and on its card
  const was = useRef<Record<string, string>>({});
  const [hits, setHits] = useState<Partial<Record<GoalLevel, number>>>({});
  const [orbitHit, setOrbitHit] = useState(0);
  const celebrate = useCelebrate();
  const sig = orbit.map((g) => `${g.goal?.id}:${g.goal?.status}`).join('|');
  useEffect(() => {
    for (const g of orbit) {
      if (!g.goal) continue;
      const before = was.current[g.goal.id];
      was.current[g.goal.id] = g.goal.status;
      if (before === 'open' && g.goal.status === 'done') {
        celebrateOnce(`${g.goal.id}:${g.goal.updatedAt}`, g.level !== 'day');
        setHits((h) => ({ ...h, [g.level]: Date.now() }));
        setOrbitHit(Date.now());
        setSel(g.level);
        celebrate(g.goal);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // the cards and the orbit follow each other: a swipe picks the level, a tap on a ring brings its card
  const strip = useRef<HTMLDivElement>(null);
  const steering = useRef(false);
  const toCard = (l: GoalLevel) => {
    setSel(l);
    const el = strip.current;
    const card = el?.children[CARD_ORDER.indexOf(l)] as HTMLElement | undefined;
    if (!el || !card) return;
    steering.current = true;
    el.scrollTo({ left: card.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft || '0'), behavior: 'smooth' });
    window.setTimeout(() => (steering.current = false), 450);
  };
  const onScroll = () => {
    const el = strip.current;
    if (!el || steering.current) return;
    const kids = [...el.children] as HTMLElement[];
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    kids.forEach((k, i) => {
      if (Math.abs(k.offsetLeft - el.offsetLeft + k.offsetWidth / 2 - mid) < Math.abs(kids[best]!.offsetLeft - el.offsetLeft + kids[best]!.offsetWidth / 2 - mid)) best = i;
    });
    const l = CARD_ORDER[best]!;
    if (l !== sel) setSel(l);
  };

  return (
    <div className="page g-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={24} />
      {goals.isPending && !goals.data ? (
        <SkeletonRows rows={4} label="Loading goals" />
      ) : (
        <>
          <section className="gv-head" aria-label="Your goals now">
            <Orbit goals={orbit} sel={sel} onSel={toCard} now={now} hit={orbitHit} />
            <div className="gv-picks" role="tablist" aria-label="Level">
              {CARD_ORDER.map((l) => (
                <button key={l} type="button" role="tab" aria-selected={sel === l} className={`gv-pick ${sel === l ? 'is-sel' : ''}`} style={{ '--hue': LEVEL_HUE[l] } as React.CSSProperties} onClick={() => toCard(l)}>
                  <i aria-hidden="true" className={cur[l]?.status === 'done' ? 'is-done' : cur[l] ? 'is-set' : ''} />
                  {LEVEL[l].label}
                </button>
              ))}
            </div>
            <div ref={strip} className="gv-strip" onScroll={onScroll}>
              {CARD_ORDER.map((l) => (
                <LevelCard key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} now={now} hit={hits[l] ?? 0} />
              ))}
            </div>
          </section>
          <AnimatePresence initial={false}>
            <ReviewCard goals={list} today={today} />
          </AnimatePresence>
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
