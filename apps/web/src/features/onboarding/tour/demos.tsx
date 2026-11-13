import type { AssistantProposal, ISODate } from '@logbook/shared';
import { ArrowRightLeft, Check, ChevronDown, ChevronRight, Pencil, PenLine, SkipForward } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { ProposalCard } from '@/features/assistant/Proposal';
import { HeroHorizon } from '@/features/day/HeroHorizon';
import { heroScene, type HeroWeek } from '@/features/day/heroWeek';
import { RangeBars } from '@/features/progress/RangeBars';
import { bucketRuns, PROGRESS_RANGES, RANGE_WORDS, rangeSpan, type DayRun } from '@/features/progress/ranges';
import { runAt, runRest, runWords } from '@/features/progress/readout';
import { springs } from '@/lib/motion';
import { RangeControl } from '@/ui/charts';
import { SectionHeader } from '@/ui/layout';
import { shownTabs } from '@/ui/nav';
import { Orb } from '@/ui/Orb';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { FarHills, PathCheck, PathLine, PathStop, Poster, PosterScene, WeekLights, type WeekLight } from '@/ui/poster';
import { Finger, Stage, Steps, useLoop, useTyped } from './engine';
import '@/app/shell.css';
import '@/features/assistant/assistant.css';
import '@/features/day/day.css';
import '@/features/dayplan/dayplan.css';
import '@/features/goals/goals.css';
import '@/features/goals/goalsPage.css';
import '@/features/habits/habits.css';
import '@/features/journal/journalPage.css';
import '@/features/learned/learned.css';
import '@/features/plan/plan.css';
import '@/features/progress/fitness.css';
import '@/features/progress/hero.css';
import '@/features/sessions/sessions.css';

/**
 * One short film per place in Orby. Each is the real page, drawn with the page's own parts at their own sizes (the poster
 * kit, the training card's horizon, the habit tile, the Progress chart, the assistant's proposal card), with sample words.
 * Nothing here is a control the page does not have, and every gesture shown is the one the page answers to. A film loops
 * while its page is on screen; under Reduce Motion (`still`) it holds its finished frame and every step is lit.
 *
 * A demo is a list of beats (ms). `b` is the beat on screen; everything it shows is read off `b`, so a loop is a pure
 * function of time and never drifts. The stage is inert: nothing in it takes a tap or the keyboard's focus.
 */
export interface DemoProps {
  running: boolean;
  still: boolean;
  /** Fitness is off (lib/prefs.ts): no demo shows a run, a lift or a plan. */
  plain?: boolean;
}
const at = (b: number, from: number, to = Infinity) => b >= from && b < to;
const nothing = () => undefined;

// ---------- a habit tile, as Today draws it (features/habits/OrbRow.tsx, habits.css `.orbs.is-grid`) ----------
/** This week so far, Mon to today (Thursday in the picture): d done, o missed. Today's dot follows the tile. */
const Tile = ({ name, week, on, spot }: { name: string; week: string; on: boolean; spot: string }) => (
  <span className={`orb ${on ? 'on' : ''}`} data-spot={spot}>
    <span className="orb-ring">
      {on ? <Check size={18} strokeWidth={2.75} /> : <span className="orb-initial is-letter">{name[0]}</span>}
    </span>
    <span className="orb-text">
      <span className="orb-name">{name}</span>
      <span className="orb-week">
        {Array.from({ length: 7 }, (_, d) => {
          const v = d < 3 ? week[d] : d === 3 ? (on ? 'd' : 'o') : '';
          return <i key={d} className={`${v === 'd' ? 'is-d' : v === 'o' ? 'is-o' : ''} ${d === 3 ? 'is-day' : ''}`} />;
        })}
      </span>
    </span>
  </span>
);

// ---------- Today: the day's poster, then the habits ----------
const TODAY_BEATS = [1000, 650, 260, 1500, 650, 320, 1500, 750, 260, 1700] as const;
/**
 * Today as it is (features/dayplan/PlanDay.tsx): the day's poster asks the question and offers one idea; "Set this goal"
 * makes it the day's goal and the first to-do becomes the lit Next stop; its check ticks it and the next one lights.
 * Under the poster, the habits as two tiles; a tap lights one. With Fitness on the poster is the slim one that sits under
 * the training card; with Fitness off it leads the page at full size, with its sun.
 */
export const TodayDemo = ({ running, still, plain }: DemoProps) => {
  const b = useLoop(TODAY_BEATS, running && !still, TODAY_BEATS.length - 1);
  const set = still || b >= 3;
  const ticked = b === 5;
  const done = still || b >= 6;
  const habit = still || b >= 8;
  const size = plain ? 'full' : 'slim';
  const n = done ? 1 : 0;
  return (
    <>
      <Stage
        className="tt"
        still={still}
        show={b >= 7 ? 'habits' : set ? 'line' : 'top'}
        over={<Finger spot={at(b, 1, 3) ? 'set' : at(b, 4, 6) ? 'tick' : at(b, 7, 9) ? 'habit0' : null} down={b === 2 || b === 5 || b === 8} />}
      >
        {/* under the training card the section says its name; leading the page (Fitness off) the poster is the head */}
        {plain ? null : <SectionHeader className="pd-head" title="Plan your day" />}
        <Poster
          size={size}
          className="pd-poster"
          titleAs="p"
          titleSize={set ? 'goal' : 'lead'}
          title={
            set ? (
              <Pressable className={`pd-title${still ? '' : ' is-rising'}`} press="dim" onPress={nothing}>
                Finish the report
              </Pressable>
            ) : (
              'What would make today count?'
            )
          }
          now={set ? 'Today’s goal' : 'Today'}
          meta="10 h left"
          scene={<PosterScene size={size} lit={set} total={set ? 2 : 0} done={set ? n : 0} />}
          band={set ? { label: 'To-dos today', words: `${n} of 2 done` } : { label: 'An idea · from yesterday', words: 'Finish the report' }}
          path={
            <div className="pd-path" data-spot="line">
              <PathLine>
                {set ? null : (
                  <PathStop key="goal" id="goal" state="next">
                    <div className="po-actions">
                      <Button variant="primary" data-spot="set">
                        <Check size={18} aria-hidden="true" /> Set this goal
                      </Button>
                      <Button variant="quiet">Something else</Button>
                    </div>
                  </PathStop>
                )}
                <PathStop
                  key="a"
                  id="a"
                  state={done ? 'done' : set ? 'next' : 'ahead'}
                  tag={set && !done ? 'Next' : undefined}
                  title="Email Alex"
                  struck={ticked || done}
                  onPress={nothing}
                  trailing={
                    set && !done ? (
                      <span data-spot="tick">
                        <PathCheck checked={ticked} label="Email Alex, done" onPress={nothing} />
                      </span>
                    ) : undefined
                  }
                />
                <PathStop key="b" id="b" state={done ? 'next' : 'ahead'} tag={done ? 'Next' : undefined} title="Call the bank" onPress={nothing} trailing={done ? <PathCheck label="Call the bank, done" onPress={nothing} /> : undefined} />
                <PathStop
                  key="add"
                  id="add"
                  state="add"
                  title="Add a to-do"
                  onPress={nothing}
                  trailing={
                    <Button variant="quiet">
                      All to-dos <ChevronRight size={16} aria-hidden="true" />
                    </Button>
                  }
                />
              </PathLine>
            </div>
          }
        />
        <div className="tt-habits" data-spot="habits">
          <SectionHeader title="Habits" meta={`${habit ? 1 : 0} of 2 done`} action="History" onAction={nothing} />
          <div className="orbs is-grid">
            <Tile name="Stretch" week="dod" on={habit} spot="habit0" />
            <Tile name="Read" week="ddo" on={false} spot="habit1" />
          </div>
        </div>
      </Stage>
      <Steps items={['Tap Set this goal', 'Tick the lit stop. The next one lights', 'Tap a habit when it is done']} on={still ? -1 : b < 3 ? 0 : b < 7 ? 1 : 2} />
    </>
  );
};

// ---------- a sheet, drawn inside the stage ----------
/**
 * The picture of a sheet: it rises over the page from the stage's own bottom edge, with the grabber, the caps line and
 * the title a real sheet has (ui/Sheet.tsx), and a scrim behind it. What is in it is the caller's.
 */
const DemoSheet = ({ open, eyebrow, title, still, children }: { open: boolean; eyebrow?: string; title: string; still: boolean; children: React.ReactNode }) => (
  <AnimatePresence initial={false}>
    {open ? <motion.span key="scrim" className="tsheet-scrim" initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} /> : null}
    {open ? (
      <motion.div key="sheet" className="tsheet" initial={still ? false : { y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={springs.sheet}>
        <span className="tsheet-grip" />
        <div className="tsheet-head">
          {eyebrow ? <span className="tsheet-eyebrow">{eyebrow}</span> : null}
          <b className="tsheet-title">{title}</b>
        </div>
        {children}
      </motion.div>
    ) : null}
  </AnimatePresence>
);

// ---------- Goals: today's goal, then further out ----------
const GOAL_BEATS = [1100, 650, 280, 1500, 1200, 650, 260, 2000, 650, 260, 1900] as const;
/**
 * Goals as it is (features/goals/GoalsHero.tsx, FurtherOut.tsx): today's goal leads as the poster, with the day's to-dos
 * counted on the band and the goal's own check under it; a tap on the check marks it done and the sun reaches its place.
 * Under it, "Further out": the year, the month and this week as three hills. The nearest hill with no goal carries the
 * plus; a tap opens the goal's sheet, and what is written there is then written on the hill.
 */
export const GoalsDemo = ({ running, still, plain }: DemoProps) => {
  const b = useLoop(GOAL_BEATS, running && !still, GOAL_BEATS.length - 1);
  const done = still || b >= 2;
  const sheet = at(b, 6, 9) && !still;
  const week = plain ? 'Read two chapters' : 'Four runs, the long one on Sunday';
  const typed = useTyped(week, b === 7 && !still, b >= 8);
  const taken = still || b >= 9;
  return (
    <>
      <Stage
        className="tgo"
        still={still}
        show={b >= 4 ? 'hills' : 'top'}
        over={
          <>
            <DemoSheet open={sheet} eyebrow="This week" title="Week goal" still={still}>
              <div className="gsheet">
                <p className="gs-ask serif">What will you get done this week?</p>
                <div className="gs-input tsheet-field">
                  {typed}
                  <i className="tcaret" />
                </div>
                <Button variant="primary" block data-spot="save">
                  Set goal
                </Button>
              </div>
            </DemoSheet>
            <Finger spot={at(b, 1, 3) ? 'done' : at(b, 5, 7) ? 'week' : b === 8 || b === 9 ? 'save' : null} down={b === 2 || b === 6 || b === 9} />
          </>
        }
      >
        <Poster
          className={`gx${done ? ' is-done' : ' is-open'}`}
          titleAs="p"
          titleSize="goal"
          title={
            <Pressable className="gx-title" press="dim" onPress={nothing}>
              <span className="gx-title-in">Finish the report</span>
            </Pressable>
          }
          now="Today’s goal"
          meta={done ? 'Done' : '10 h left'}
          scene={<PosterScene lit total={2} done={1} progress={done ? 1 : undefined} />}
          band={{ label: 'Today · 1 of 2 to-dos done', words: 'Next: Call the bank', onPress: nothing }}
        >
          <div className="gx-status">
            <span className="gx-status-words">
              <span className="gx-status-main">{done ? 'Done today' : 'Not done yet'}</span>
            </span>
            <span className="gx-check" data-spot="done">
              <PathCheck checked={done} label="Finish the report, mark done" onPress={nothing} />
            </span>
          </div>
        </Poster>
        <div data-spot="hills">
          <FarHills
            className="gx-far"
            title={
              <Pressable className="gx-far-title" press="dim" onPress={nothing}>
                Further out
                <ChevronRight size={12} aria-hidden="true" />
              </Pressable>
            }
            hills={[
              { caption: '2026', onPress: nothing },
              { caption: 'November', onPress: nothing },
              taken
                ? { caption: 'This week · 3 days left', words: <span className={still ? undefined : 'gx-take'}>{week}</span>, onPress: nothing }
                : { caption: 'This week · 3 days left', words: <span data-spot="week">Set this week’s goal</span>, plus: true, onPress: nothing },
            ]}
          />
        </div>
      </Stage>
      <Steps items={['Tap the check when today’s goal is done', 'Scroll on: the year, the month, this week', 'Tap a hill to set its goal']} on={still ? -1 : b < 4 ? 0 : b < 5 ? 1 : 2} />
    </>
  );
};

// ---------- Fitness: what is next, then how it is going ----------
/** The day every picture of Fitness is drawn on: a Thursday, so the week has days behind it and days ahead. */
const T = '2026-11-12' as ISODate;
/** This week as the card counts it: two runs done of four, 9 of 21 miles, and one workout still to come. */
const WEEK: HeroWeek = { mon: '2026-11-09' as ISODate, runs: { planned: 4, done: 2 }, workouts: { planned: 1, done: 0 }, doneMiles: 9, plannedMiles: 21 };
/** The twelve weeks before this one, in miles: a steady build with two lighter weeks. */
const PAST = [14, 16, 15, 18, 12, 19, 21, 20, 23, 22, 25, 24];
/** What each day ran and planned, for the chart: a past week's miles on its Sunday as four runs; this week as the card says. */
const NOW: Record<string, DayRun> = {
  '2026-11-09': { planned: 5, plannedRuns: 1, done: 5, runs: 1 },
  '2026-11-10': { planned: 4, plannedRuns: 1, done: 4, runs: 1 },
  '2026-11-12': { planned: 4, plannedRuns: 1, done: 0, runs: 0 },
  '2026-11-15': { planned: 8, plannedRuns: 1, done: 0, runs: 0 },
};
const NONE: DayRun = { planned: 0, plannedRuns: 0, done: 0, runs: 0 };
/** The Progress chart's own numbers and words for the sample weeks, from the page's own functions (ranges.ts, readout.ts). */
const progress = () => {
  const span = rangeSpan('3M', T, null);
  const sundays = new Map(span.buckets.slice(0, -1).map((k, i) => [k.to as string, PAST[i] ?? 0]));
  const day = (d: ISODate): DayRun => NOW[d] ?? (sundays.has(d) ? { planned: sundays.get(d)!, plannedRuns: 4, done: sundays.get(d)!, runs: 4 } : NONE);
  const buckets = bucketRuns(span.buckets, day, T);
  const week = buckets[buckets.length - 1]!;
  return { span, buckets, rest: runRest(span, buckets, week, buckets[buckets.length - 2] ?? null, T, false, false, span.from) };
};
const FIT_BEATS = [1200, 650, 260, 900, 650, 260, 900, 650, 260, 1700, 1100, 700, 380, 380, 380, 380, 1300, 1500] as const;
/** The buckets the finger reads as it slides along the chart, beat by beat. */
const READS = [6, 7, 8, 9, 10];
/**
 * Fitness as it is (features/plan/Week.tsx, TrainingCard.tsx, features/progress/FitnessProgress.tsx), top to bottom.
 * Today's card: the session's name, the week's horizon and the band that counts it. Under it the days ahead, stops on the
 * dotted line, ending at "Add a session". A session is moved the way the page moves one: a tap on its stop opens its
 * sheet, Move is a row there, and a day is picked (there is no drag on the page). Then, further down the page, Progress:
 * the weeks as bars, read by sliding along them (the bar under the finger turns Deep Sky and the headline says its week).
 */
export const FitnessDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(FIT_BEATS, running && !still, FIT_BEATS.length - 1);
  const scene = useMemo(() => heroScene({ week: WEEK, lead: 'run', hasRuns: true, picked: null }), []);
  const p = useMemo(progress, []);
  const sheet = at(b, 3, 9) && !still;
  const moving = b >= 6;
  const moved = still || b >= 9;
  const reading = at(b, 12, 17) ? READS[b - 12]! : null;
  const r = reading == null ? p.rest : runAt('week', p.buckets[reading]!, T);
  return (
    <>
      <Stage
        className="tfit"
        still={still}
        show={at(b, 10, 17) ? 'progress' : 'top'}
        over={
          <>
            <DemoSheet open={sheet} eyebrow={moving ? 'Strength' : 'Tomorrow · Fri 13'} title={moving ? 'Move' : 'Strength'} still={still}>
              {moving ? (
                <div className="mv2">
                  <p className="t-sub ink2">Strength is on Friday, November 13. A day with something on it swaps.</p>
                  <div className="mv2-chips">
                    <span className="pl-chip">Today</span>
                    <span className="pl-chip" data-spot="pick">
                      Next free day · Sat
                    </span>
                  </div>
                </div>
              ) : (
                <div className="ss">
                  <div className="group ss-acts">
                    <Pressable className="ss-act" press="surface" onPress={nothing}>
                      <span className="icon-tile">
                        <SkipForward size={18} />
                      </span>
                      <span className="ss-act-main">
                        <span className="ss-act-title">Skip</span>
                        <span className="ss-act-sub">The week still counts</span>
                      </span>
                    </Pressable>
                    <Pressable className="ss-act" press="surface" onPress={nothing}>
                      <span className="icon-tile">
                        <ArrowRightLeft size={18} />
                      </span>
                      <span className="ss-act-main" data-spot="move">
                        <span className="ss-act-title">Move</span>
                      </span>
                      <ChevronRight size={18} className="ss-act-chev" />
                    </Pressable>
                    <Pressable className="ss-act" press="surface" onPress={nothing}>
                      <span className="icon-tile">
                        <Pencil size={18} />
                      </span>
                      <span className="ss-act-main">
                        <span className="ss-act-title">Edit</span>
                      </span>
                      <ChevronRight size={18} className="ss-act-chev" />
                    </Pressable>
                  </div>
                </div>
              )}
            </DemoSheet>
            <AnimatePresence>
              {b === 9 ? (
                <motion.p className="ttoast" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                  Moved to Sat, Nov 14 <b>Undo</b>
                </motion.p>
              ) : null}
            </AnimatePresence>
            <Finger spot={at(b, 1, 3) ? 'session' : at(b, 4, 6) ? 'move' : b === 7 || b === 8 ? 'pick' : b === 11 ? `week${READS[0]}` : reading != null ? `week${reading}` : null} down={b === 2 || b === 5 || b === 8} hold={reading != null} />
          </>
        }
      >
        <div className="hero aura hz-card">
          <div className="hero-face hz-face">
            <HeroHorizon scene={scene} isToday firstToday={false} quiet={false} live page="tour" onWeek={nothing} onPick={nothing}>
              <span className="hero-stamp hz-name">Easy 4</span>
              <p className="hero-line hz-line">4 mi · floor 20 min</p>
            </HeroHorizon>
          </div>
        </div>
        <div className="pl-ahead card tfit-days">
          <PathLine>
            <PathStop key="lift" id="lift" node="dot" state="ahead" caption={moved ? 'Sat 14' : 'Tomorrow · Fri 13'} title="Strength" subtitle={<span data-spot="session">Full body</span>} chevron onPress={nothing} />
            <PathStop key="long" id="long" node="dot" state="ahead" caption="Sun 15" title="Long 8" subtitle="Z2, conversational" chevron onPress={nothing} />
            <PathStop key="add" id="add" state="add" title="Add a session" onPress={nothing} />
          </PathLine>
          <Pressable className="pl-fold" press="surface" onPress={nothing}>
            <span className="pl-fold-dots">
              <i />
              <i />
              <i />
            </span>
            <span className="pl-fold-title">Earlier this week</span>
            <span className="pl-fold-value">2 sessions</span>
            <ChevronDown size={18} className="pl-fold-chev" />
          </Pressable>
        </div>
        <div className="tfit-how" data-spot="progress">
          <SectionHeader title="Progress" />
          <section className="card ph ph-plain no-seg tfit-progress">
          <div className="ph-head">
            <div className="ph-main">
              <span className="ph-big">
                <span className="tnum">{r.big}</span>
                <small>{r.context}</small>
              </span>
              <span className="ph-take">{r.take}</span>
            </div>
          </div>
          {/* where the finger lands on each week's bar: the chart is the page's own and carries no names */}
          <div className="tfit-spots">
            {p.buckets.map((k, i) => (
              <i key={k.key} data-spot={`week${i}`} />
            ))}
          </div>
          <RangeBars span={p.span} marks={p.buckets.map((k) => ({ key: k.key, value: k.done, ahead: k.ahead, current: k.current, future: k.future, missing: k.missing }))} label="Weekly miles, 3 months." words={(i) => runWords('week', p.buckets[i]!, T)} from={0} read={reading} onScrub={nothing} />
          <RangeControl className="ph-range" value="3M" options={PROGRESS_RANGES} words={RANGE_WORDS} onChange={nothing} label="Range" />
          </section>
        </div>
      </Stage>
      <Steps items={['Today’s session leads, the week follows', 'Tap a session, then Move, then a day', 'Slide along Progress to read a week']} on={still ? -1 : b < 1 ? 0 : b < 10 ? 1 : b < 17 ? 2 : 0} />
    </>
  );
};

// ---------- Journal: the line, the lights, then more ----------
/** The six days before tonight, as the poster's lights: three already written. */
const JOUR_WEEK: readonly WeekLight[] = [
  { letter: 'F', lit: false },
  { letter: 'S', lit: true },
  { letter: 'S', lit: false },
  { letter: 'M', lit: true },
  { letter: 'T', lit: false },
  { letter: 'W', lit: true },
];
const JOUR_BEATS = [1100, 650, 260, 2100, 650, 260, 1700, 800, 1500] as const;
/**
 * Journal as it is (features/journal/JournalPoster.tsx): the dusk poster asks the question over the week's lights, and
 * the line under its band is already started from the day. A tap puts the caret after those words (and, on a phone, the
 * page comes up clear of the keyboard, as the stage scrolls here); "Finish the line" keeps it: the line becomes the
 * poster's title, tonight lights, the band counts one more day, and the same spot offers "Write more about today".
 */
export const JournalDemo = ({ running, still, plain }: DemoProps) => {
  // the field's first words are the real starters (features/learned/starter.ts)
  const starter = plain ? 'Today I learned' : 'On my run today I learned';
  const rest = plain ? ' a short walk clears my head.' : ' easy miles feel easy now.';
  const b = useLoop(JOUR_BEATS, running && !still, JOUR_BEATS.length - 1);
  const typed = useTyped(rest, b === 3 && !still, b >= 4);
  const kept = still || b >= 6;
  return (
    <>
      <Stage className="tjo" still={still} show={kept ? (b >= 7 ? 'more' : 'top') : b >= 2 ? 'line' : 'top'} over={<Finger spot={at(b, 1, 3) ? 'field' : at(b, 4, 6) ? 'finish' : b === 7 ? 'more' : null} down={b === 2 || b === 5} />}>
        <Poster
          ground="dusk"
          className="ln-poster jn-poster"
          titleAs="p"
          titleSize={kept ? 'goal' : 'lead'}
          title={
            kept ? (
              <Pressable className={`jn-title${still ? '' : ' is-new'}`} press="dim" onPress={nothing}>
                <span className="jn-title-in">
                  {starter}
                  {rest}
                </span>
              </Pressable>
            ) : (
              'What did you learn today?'
            )
          }
          meta={kept ? 'Tonight’s line is kept.' : 'One line is enough.'}
          scene={<WeekLights days={JOUR_WEEK} tonight={kept ? 'lit' : 'waiting'} />}
          band={kept ? { label: 'This week', words: '4 days written' } : { label: 'This week · 3 days written', words: 'Tonight’s line lights the fourth' }}
        >
          {kept ? (
            <div data-spot="more">
              <Pressable className="jn-more" press="surface" onPress={nothing}>
                <span className="icon-tile">
                  <PenLine size={18} />
                </span>
                <span className="jn-more-words">
                  <span className="jn-more-title">Write more about today</span>
                </span>
                <ChevronRight size={18} className="jn-more-chev" />
              </Pressable>
            </div>
          ) : (
            <div className="ln-entry" data-spot="line">
              <div className="ln-entry-field" data-spot="field">
                <textarea className="ln-field ln-entry-in" rows={2} readOnly tabIndex={-1} value={`${starter}${typed}`} />
                <span className="ln-entry-ghost">
                  <span className="ln-entry-ghost-words">
                    {starter}
                    {typed}
                  </span>
                  <i className="ln-caret" />
                </span>
              </div>
              {plain ? null : <p className="caps ln-entry-note">From today’s run</p>}
              <div className="ln-entry-foot">
                <span className="ln-entry-more">
                  <Button variant="quiet" size="sm" className="jn-longer">
                    Write a longer entry
                  </Button>
                </span>
                <Button variant="primary" className="ln-finish" data-spot="finish">
                  Finish the line
                </Button>
              </div>
            </div>
          )}
        </Poster>
      </Stage>
      <Steps items={['Tap the line. It is started for you', 'Finish it, and tonight lights', 'Write more when you want to']} on={still ? -1 : b < 3 ? 0 : b < 7 ? 1 : 2} />
    </>
  );
};

// ---------- the assistant: ask, see the change, Apply ----------
const ASK_BEATS = [1100, 650, 260, 1900, 1300, 650, 260, 1900] as const;
/** What is asked for, and the change that comes back: about a run with Fitness on, about a to-do with it off. */
const ask = (plain: boolean, applied: boolean): { words: string; proposal: AssistantProposal } =>
  plain
    ? {
        words: 'Remind me to call the bank on Friday',
        proposal: { id: 'tour', summary: 'One new to-do, due Friday.', status: applied ? 'applied' : 'proposed', changes: [{ op: { op: 'add_todo', text: 'Call the bank', due: '2026-11-13' }, label: 'Add to-do: Call the bank', reason: 'Due Fri, Nov 13' }] },
      }
    : {
        words: 'Move my long run to Saturday',
        proposal: { id: 'tour', summary: 'Your long run moves from Sunday to Saturday.', status: applied ? 'applied' : 'proposed', changes: [{ op: { op: 'move_session', id: 'tour', to: '2026-11-14' }, label: 'Move Long 8 to Sat, Nov 14', reason: 'Sunday becomes a rest day' }] },
      };
/**
 * The assistant as it is: its door is the ask bar in the dock, over the tab capsule on every tab (app/Dock.tsx). A tap
 * opens its sheet; a request in plain words comes back as a proposal card (features/assistant/Proposal.tsx, the real
 * card here): what would change, and Apply. Nothing changes until Apply is tapped, and Undo follows it.
 */
export const AskDemo = ({ running, still, plain = false }: DemoProps) => {
  const b = useLoop(ASK_BEATS, running && !still, ASK_BEATS.length - 1);
  const open = still || b >= 3;
  const applied = still || b >= 7;
  const a = ask(plain, applied);
  const typed = useTyped(a.words, b === 3 && !still, still || b >= 4);
  const replied = still || b >= 4;
  return (
    <>
      <Stage
        className="tas"
        still={still}
        over={
          <>
            <DemoSheet open={open} title="Assistant" still={still}>
              <div className="tas-thread">
                <div className="as-turn is-user">
                  <span className="as-bubble">
                    {typed}
                    {replied ? null : <i className="tcaret" />}
                  </span>
                </div>
                {replied ? (
                  <motion.div className="as-turn is-assistant" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springs.settle}>
                    <div data-spot="apply">
                      <ProposalCard p={a.proposal} waiting={false} chat="tour" />
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </DemoSheet>
            <Finger spot={at(b, 1, 3) ? 'bar' : at(b, 5, 7) ? '.as-apply' : null} down={b === 2 || b === 6} />
          </>
        }
      >
        <div className="orbs is-grid">
          <Tile name="Stretch" week="dod" on spot="h0" />
          <Tile name="Read" week="ddo" on={false} spot="h1" />
        </div>
        <div className="tas-dock">
          <Pressable className="dock-ask" press="surface" onPress={nothing}>
            <Orb size={28} className="dock-ask-ic" state="still" />
            <span className="dock-ask-text" data-spot="bar">
              Ask or change anything
            </span>
          </Pressable>
          <nav className="tabbar">
            <div className="tabs">
              {shownTabs(!plain).map((t) => (
                <span key={t.id} className="tab-item" aria-current={t.id === 'today' ? 'page' : undefined}>
                  <span className="tab-ic">
                    <t.icon size={22} />
                  </span>
                  <span className="tab-label">{t.label}</span>
                </span>
              ))}
            </div>
          </nav>
        </div>
      </Stage>
      <Steps items={['Tap Ask or change anything, on any tab', 'Ask in plain words', 'Nothing changes until you tap Apply']} on={still ? -1 : b < 3 ? 0 : b < 5 ? 1 : 2} />
    </>
  );
};
