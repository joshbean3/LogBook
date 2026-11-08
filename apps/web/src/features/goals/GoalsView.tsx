import { currentGoals, goalProgress, periodOf, shiftDays, shiftPeriod, type Aim, type GoalLevel } from '@logbook/shared';
import { Bell, ChevronRight, History, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useGoals } from '@/api/queries';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Segmented } from '@/ui/primitives';
import { SkeletonRows } from '@/ui/Skeleton';
import { Switch } from '../settings/parts';
import '../settings/settings.css';
import { useNowMinutes } from '../day/useNow';
import { clockOf, goalOf, leftWords, LEVEL, LEVEL_HUE, periodCaps, setWords, STATUS_WORD } from './model';
import { disableReminders, enableReminders, remindersOn, remindersSupported } from './reminders';
import { StatusIcon, useOpenGoal } from './GoalSheets';
import { ScoreCard, StaleNudge } from './GoalParts';
import { GoalRing, GoalSteps } from './Steps';
import { Burst, celebrateOnce } from './game';
import { Orbit, type OrbitGoal } from './Orbit';
import { useCelebrate } from './Celebrate';
import { KSection } from './Kit';
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
 * One level's card in the strip: the period and its time left, the goal in the serif, the ring to finish it, what is left
 * in words, its steps as rows to check right there, and the period's clock along the foot. Its colour glows up from the
 * corner as the goal comes along; done, the card is lit in it. Every card has the same radius, padding and height.
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
        <span className="gv-clock" aria-hidden="true">
          <i style={{ transform: `scaleX(${clock.elapsed})` }} />
        </span>
      </Pressable>
    );
  const ended = goal.status === 'partly' || goal.status === 'missed';
  return (
    <article className={`gv-card is-${goal.status}`} style={style} aria-label={`${caps}: ${goal.text}`}>
      <motion.span className="gv-card-glow" aria-hidden="true" initial={false} animate={{ opacity: goal.status === 'done' ? 1 : 0.2 + 0.6 * p }} transition={reduce ? { duration: 0 } : { duration: 0.5 }} />
      <div className="gv-card-head">
        <span className="caps">{caps}</span>
        <span className="gv-left">{goal.status === 'open' ? clock.words : STATUS_WORD[goal.status]}</span>
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
      <p className={`gv-leftwords ${goal.status === 'done' ? 'is-done' : ''}`}>{leftWords(goal, level, period, now)}</p>
      {goal.steps.length ? <GoalSteps goal={goal} compact /> : null}
      <span className="gv-clock" aria-hidden="true">
        <i style={{ transform: `scaleX(${clock.elapsed})` }} />
      </span>
    </article>
  );
};

/** The hero's legend under the rings: each level's colour, its name and where its goal stands; a tap picks the level. */
const Legend = ({ goals, sel, onSel }: { goals: OrbitGoal[]; sel: GoalLevel; onSel: (l: GoalLevel) => void }) => (
  <div className="gv-legend" role="group" aria-label="Levels">
    {goals.map(({ level, goal }) => {
      const n = goal?.steps.length ?? 0;
      const k = goal?.steps.filter((x) => x.done).length ?? 0;
      const word = !goal ? 'Not set' : goal.status !== 'open' ? STATUS_WORD[goal.status] : n ? `${k} of ${n}` : 'Set';
      return (
        <button key={level} type="button" className={`gv-leg ${sel === level ? 'is-sel' : ''} ${goal ? `is-${goal.status}` : 'is-none'}`} style={{ '--hue': LEVEL_HUE[level] } as React.CSSProperties} aria-pressed={sel === level} onClick={() => onSel(level)}>
          <span className="gv-leg-top">
            <i aria-hidden="true" />
            {LEVEL[level].label}
          </span>
          <span className="gv-leg-word tnum">{word}</span>
        </button>
      );
    })}
  </div>
);

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
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Goals' }} gap={16}>
        <div className="g-segrow">
          <Segmented<GoalLevel> label="Level" className="k-seg g-levels" value={sel} onChange={toCard} options={CARD_ORDER.map((l) => [l, LEVEL[l].label] as [GoalLevel, string])} />
        </div>
      </NavBar>
      {goals.isPending && !goals.data ? (
        <SkeletonRows rows={4} label="Loading goals" />
      ) : (
        <>
          <div className="k-stack g-top">
            <ScoreCard goals={list} level={sel} today={today} />
            <section className="k-card g-hero" aria-label="Your goals now">
              <Orbit goals={orbit} sel={sel} onSel={toCard} now={now} hit={orbitHit} />
              <hr className="k-rule" />
              <Legend goals={orbit} sel={sel} onSel={toCard} />
            </section>
            <StaleNudge goals={list} today={today} />
          </div>
          <KSection title="Now" meta={`${CARD_ORDER.filter((l) => cur[l]).length} of 4 set`} className="g-now">
            <div ref={strip} className="gv-strip" onScroll={onScroll}>
              {CARD_ORDER.map((l) => (
                <LevelCard key={l} level={l} period={periodOf(l, today)} goal={cur[l]} today={today} now={now} hit={hits[l] ?? 0} />
              ))}
            </div>
          </KSection>
          <KSection title="Ahead" className="g-ahead">
            <div className="group g-group k-lined">
              <GoalRow level="day" period={tomorrow} goal={goalOf(list, 'day', tomorrow)} today={today} compact />
              <GoalRow level="week" period={next('week')} goal={goalOf(list, 'week', next('week'))} today={today} compact />
            </div>
          </KSection>
          <KSection title="History" action="See all" actionLabel="See all of the history" onAction={() => nav.push('/goals/history')} className="g-past">
            <div className="k-stack">
              <DayTrail goals={list} today={today} onOpen={() => nav.push('/goals/history')} />
              <ul className="k-rows has-icons">
                <li>
                  <Pressable className="k-row two" press="surface" onPress={() => nav.push('/goals/history')} label="History. Open">
                    <span className="icon-tile" aria-hidden="true">
                      <History size={17} />
                    </span>
                    <span className="k-row-main">
                      <span className="k-row-title">History</span>
                      <span className="k-row-sub">Every goal, how it went, and what changed</span>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" className="k-chev" />
                  </Pressable>
                </li>
                {remindersSupported() ? (
                  <li className="k-row two">
                    <span className="icon-tile" aria-hidden="true">
                      <Bell size={17} />
                    </span>
                    <span className="k-row-main">
                      <span className="k-row-title">Reminders</span>
                      <span className="k-row-sub">Each morning a goal is unset; Mondays for the week</span>
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
                ) : null}
              </ul>
            </div>
            <p className="k-foot">{LEVEL.week.ask} Write it as you would say it; the review makes it specific, measurable and due on time.</p>
          </KSection>
        </>
      )}
    </div>
  );
}
