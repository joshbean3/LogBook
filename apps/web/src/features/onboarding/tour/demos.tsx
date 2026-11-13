import { ArrowRight, Check, ChevronRight, Plus } from 'lucide-react';
import { Disc } from '@/ui/Disc';
import { Poster, WeekLights, type WeekLight } from '@/ui/poster';
import { AnimatePresence, motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { springs } from '@/lib/motion';
import { Finger, Stage, Steps, useLoop, useTyped } from './engine';

/**
 * One short film per part of Logbook, each a miniature of the real screen with the real labels (mapped from the code:
 * PlanDay, OrbRow, GoalSheets, the Journal poster and its line, Fitness's week and its Progress chart, Dock and the assistant sheet). Each loops while its
 * page is on screen; under Reduce Motion (`still`) it holds its finished frame and every step is lit.
 *
 * A demo is a list of beats (ms). `b` is the beat on screen; everything it shows is read off `b`, so a loop is a pure
 * function of time and never drifts.
 */
export interface DemoProps {
  running: boolean;
  still: boolean;
  /** Fitness is off (lib/prefs.ts): the sample words are about a day, not a run. */
  plain?: boolean;
}
const at = (b: number, from: number, to = Infinity) => b >= from && b < to;

// ---------- Today: the to-dos ----------
const TODO_BEATS = [900, 650, 260, 760, 700, 650, 260, 1500, 1300] as const;
export const TodosDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(TODO_BEATS, running && !still, TODO_BEATS.length - 1);
  const checked = b >= 3;
  const gone = b >= 4;
  const typing = at(b, 7);
  const typed = useTyped('Book physio fri', typing && !still, still || b >= 8);
  const rows = [...(gone ? [] : [{ id: 'a', t: 'Send the report' }]), { id: 'b', t: 'Call the bank' }, { id: 'c', t: 'Stretch 10 min' }, ...(gone ? [{ id: 'd', t: 'Groceries' }] : [])];
  return (
    <>
      <Stage className="td">
        <div className="tour-todo-box">
          <p className="tour-todo-head">
            <b>Your top three</b>
            <span>{gone ? '1 after these' : '2 after these'}</span>
          </p>
          <ul>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.li key={r.id} layout={!still} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={springs.settle} className={r.id === 'a' && checked ? 'tis-done' : ''}>
                  <span className="tour-todo-mark" data-spot={i === 0 ? 'mark0' : undefined}>
                    {r.id === 'a' && checked ? <Check size={12} /> : null}
                  </span>
                  <span className="tour-todo-rank">{i + 1}</span>
                  {r.t}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
        <p className="tour-todo-fold">{gone ? '+1 Then Pay rent' : '+2 Then Groceries, Pay rent'}</p>
        <p className="tour-todo-add" data-spot="add">
          <Plus size={15} />
          {typing || still || b >= 8 ? <span className="tour-todo-typed">{typed}<i className="tcaret" /></span> : 'Add a to-do'}
        </p>
        <Finger spot={at(b, 1, 4) ? 'mark0' : at(b, 5, 8) ? 'add' : null} down={b === 2 || b === 6} />
      </Stage>
      <Steps items={['Tap the circle when it’s done', 'The next one moves up into your three', 'Tap Add a to-do and type']} on={still ? -1 : b < 4 ? 0 : b < 5 ? 1 : 2} />
    </>
  );
};

// ---------- Today: the habit lights ----------
// two tiles of the real grid (OrbRow's .orbs.is-grid, guide 6.6; plan O10): a coin, the full name and this week's dots
const HAB = ['Stretch', 'Read 15 min'];
/** This week so far, Mon to today (Thursday in the picture): done, missed, done; today lights when the coin is tapped. */
const HAB_WEEK = [
  ['d', 'o', 'd'],
  ['d', 'd', 'o'],
] as const;
const HAB_BEATS = [800, 650, 240, 650, 600, 240, 800, 700, 650, 1400, 900] as const;
export const HabitsDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(HAB_BEATS, running && !still, HAB_BEATS.length - 1);
  const lit = [still || b >= 2, still || b >= 5];
  const menu = at(b, 8, 10) || still;
  return (
    <>
      <Stage className="th">
        <div className="th-grid">
          {HAB.map((h, i) => (
            <span key={h} className={`th-tile ${lit[i] ? 'tis-lit' : ''}`}>
              <motion.span className="th-orb" data-spot={`orb${i}`} animate={lit[i] && !still ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.36 }}>
                {lit[i] ? <Check size={18} /> : <span>{h[0]}</span>}
              </motion.span>
              <span className="th-tile-text">
                <b>{h}</b>
                <span className="th-week">
                  {Array.from({ length: 7 }, (_, d) => (
                    <i key={d} className={d < 3 ? `is-${HAB_WEEK[i]![d]}` : d === 3 ? `is-day ${lit[i] ? 'is-d' : ''}` : ''} />
                  ))}
                </span>
              </span>
            </span>
          ))}
        </div>
        <AnimatePresence>
          {menu ? (
            <motion.div className="th-menu" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              <span>Note</span>
              <span>Details</span>
              <span>Archive</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Finger spot={at(b, 1, 3) ? 'orb0' : at(b, 4, 6) ? 'orb1' : at(b, 7, 10) ? 'orb0' : null} down={b === 2 || b === 5} hold={at(b, 8, 10)} />
      </Stage>
      <Steps items={['Tap a habit when it’s done today', 'Hold one for a note, details or archive']} on={still ? -1 : b < 7 ? 0 : 1} />
    </>
  );
};

// ---------- Goals ----------
const GOAL_BEATS = [900, 650, 260, 1700, 600, 260, 900, 650, 260, 1300, 900] as const;
export const GoalsDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(GOAL_BEATS, running && !still, GOAL_BEATS.length - 1);
  const writing = at(b, 3, 6);
  const typed = useTyped('Send the report by 3 pm.', writing && !still, b >= 4);
  const set = still || b >= 6;
  const stepDone = still || b >= 9;
  return (
    <>
      <Stage className="tg">
        <div className={`tg-card ${set ? 'tis-set' : ''}`}>
          <span className="tg-sun" style={{ transform: `scale(${stepDone ? 1.25 : set ? 0.9 : 0.7})` }} />
          <span className="caps">Today’s goal</span>
          {set ? (
            <>
              <b className="tg-goal">Send the report by 3 pm.</b>
              <span className="tg-bar">
                <i style={{ '--p': stepDone ? 0.5 : 0 } as React.CSSProperties} />
                <em>{stepDone ? '1/2' : '0/2'}</em>
              </span>
              <span className={`tg-step ${stepDone ? 'tis-done' : ''}`}>
                <span className="tour-todo-mark" data-spot="step">
                  {stepDone ? <Check size={12} /> : null}
                </span>
                Outline
              </span>
            </>
          ) : (
            <>
              <b className="tg-ask">What would make today count?</b>
              <span className="tg-cta" data-spot="cta">
                Set the goal
              </span>
            </>
          )}
        </div>
        <AnimatePresence>
          {writing ? (
            <motion.div className="tg-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={springs.sheet}>
              <span className="tg-sheet-t">What is the one thing for today?</span>
              <span className="tg-field">
                {typed}
                <i className="tcaret" />
              </span>
              <span className="tg-set" data-spot="set">
                Set goal
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Finger spot={at(b, 1, 3) ? 'cta' : at(b, 4, 6) ? 'set' : at(b, 7, 9) ? 'step' : null} down={b === 2 || b === 5 || b === 8} />
      </Stage>
      <Steps items={['Tap Set the goal', 'Write the one thing that would make today count', 'Check its steps; the sun grows as you go']} on={still ? -1 : b < 3 ? 0 : b < 6 ? 1 : 2} />
    </>
  );
};

// ---------- Journal ----------
/** The six days before tonight, as the poster's lights: three already written. */
const JOUR_WEEK: readonly WeekLight[] = [
  { letter: 'F', lit: false },
  { letter: 'S', lit: true },
  { letter: 'S', lit: false },
  { letter: 'M', lit: true },
  { letter: 'T', lit: false },
  { letter: 'W', lit: true },
];
const JOUR_BEATS = [900, 650, 260, 1900, 600, 260, 1500, 700, 1100] as const;
/**
 * The Journal tab's top, as it is: the dusk poster with the week's lights, and under it the line, already started. The
 * line is finished, tonight lights, and the same spot offers "Write more about today". The poster is the kit's own
 * (ui/poster), drawn small; the field and the button sit outside it at the demo's size, where the finger can find them.
 */
export const JournalDemo = ({ running, still, plain }: DemoProps) => {
  // the field's first words are the real starters (features/learned/starter.ts)
  const starter = plain ? 'Today I learned' : 'On my run today I learned';
  const rest = plain ? ' a short walk after lunch clears my head.' : ' strides wake the legs up.';
  const b = useLoop(JOUR_BEATS, running && !still, JOUR_BEATS.length - 1);
  const typing = at(b, 3, 6);
  const typed = useTyped(rest, typing && !still, b >= 4);
  const kept = still || b >= 6;
  // the card's place holds the tallest height the card has had, so the steps under it stay put when the composer
  // gives way to one row
  const hold = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(0);
  useLayoutEffect(() => {
    const h = hold.current?.offsetHeight ?? 0;
    if (h > held) setHeld(h);
  });
  return (
    <>
      <Stage className="tj">
        <div ref={hold} className="tj-hold" style={held ? { minHeight: held } : undefined}>
          <div className="tj-card">
            <div className="tj-poster">
              <Poster
                ground="dusk"
                className="tj-po"
                titleAs="p"
                titleSize={kept ? 'goal' : 'lead'}
                title={kept ? `${starter}${rest}` : 'What did you learn today?'}
                meta={kept ? 'Tonight’s line is kept.' : 'One line is enough.'}
                scene={<WeekLights days={JOUR_WEEK} tonight={kept ? 'lit' : 'waiting'} />}
                band={kept ? { label: 'This week', words: '4 days written' } : { label: 'This week · 3 days written', words: 'Tonight’s line lights the fourth' }}
              />
            </div>
            {kept ? (
              <motion.div className="tj-more" data-spot="more" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springs.settle}>
                <span>Write more about today</span>
                <ChevronRight size={18} />
              </motion.div>
            ) : (
              <div className="tj-compose">
                <span className="tj-field" data-spot="field">
                  {starter}
                  {typed}
                  {b >= 2 ? <i className="tcaret" /> : null}
                </span>
                <span className="tg-set" data-spot="save">
                  Finish the line
                </span>
              </div>
            )}
          </div>
        </div>
        <Finger spot={at(b, 1, 3) ? 'field' : at(b, 4, 6) ? 'save' : b === 7 ? 'more' : null} down={b === 2 || b === 5} />
      </Stage>
      <Steps items={['Tap the line. It is started for you', 'Finish it, and tonight lights', 'Write more when you want to']} on={still ? -1 : b < 3 ? 0 : b < 7 ? 1 : 2} />
    </>
  );
};

// ---------- Fitness: what is next, then how it is going ----------
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const RUNS: Record<number, { t: string; c: string }> = { 1: { t: 'Easy 4', c: 'easy' }, 3: { t: 'Tempo 5', c: 'hard' }, 5: { t: 'Easy 4', c: 'easy' }, 6: { t: 'Long 8', c: 'long' } };
const MILES = [14, 16, 15, 18, 12, 19, 21, 20, 23, 22, 25, 24];
/** Twelve Mondays, a week apart, ending on the latest. */
const WEEK_OF = MILES.map((_, k) => new Date(2026, 7, 17 + 7 * k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
const MILES_MAX = 26;
const FIT_BEATS = [900, 650, 700, 900, 300, 1300, 700, 380, 380, 380, 380, 380, 1200, 900] as const;
/**
 * The Fitness tab in two moves, top to bottom as the page reads. What is next: this week's sessions, and a run moved to
 * another day the way the page moves one (a tap on the run, then the day: there is no drag on the page). How it is going: the Progress chart under them, the weeks as bars, read by sliding along it
 * (the bar under the finger turns Deep Sky and the headline says its week, as on the page).
 */
export const FitnessDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(FIT_BEATS, running && !still, FIT_BEATS.length - 1);
  const lifted = at(b, 2, 4);
  const moved = still || b >= 4;
  const runs = { ...RUNS };
  if (moved) {
    runs[4] = runs[3]!;
    delete runs[3];
  }
  const scrub = at(b, 7, 13) ? 4 + (b - 7) * 1.4 : null;
  const i = scrub == null ? null : Math.min(MILES.length - 1, Math.round(scrub));
  return (
    <>
      <Stage className="tp">
        <p className="tour-line">
          <b>This week</b>
          <span>21 mi · 4 runs</span>
        </p>
        <div className="tour-wk">
          <div className="tour-week">
            {DAYS.map((d, k) => {
              const r = runs[k];
              return (
                <span key={k} className={`tour-day ${lifted && k === 4 ? 'tis-target' : ''}`} data-spot={`day${k}`}>
                  <small>{d}</small>
                  <span className="tour-date">{9 + k}</span>
                  {r ? (
                    <motion.span layout={!still} className={`tour-pill c-${r.c}`} transition={springs.settle}>
                      {r.t}
                    </motion.span>
                  ) : (
                    <span className="tour-rest">Rest</span>
                  )}
                </span>
              );
            })}
          </div>
          <AnimatePresence>
            {at(b, 4, 6) ? (
              <motion.p className="tour-toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.settle}>
                Moved to Fri <b>Undo</b>
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="tq">
          <p className="tq-head">
            <span className="caps">{i == null ? 'Progress · 12 weeks' : `Week of ${WEEK_OF[i]}`}</span>
            <b>{i == null ? '229 mi' : `${MILES[i]} mi`}</b>
          </p>
          <div className={`tq-chart ${i != null ? 'tis-reading' : ''}`}>
            {MILES.map((m, k) => (
              <span key={k} className={`tq-bar ${k === i ? 'tis-lit' : ''}`} style={{ height: `${(m / MILES_MAX) * 100}%` }} data-spot={`w${k}`} />
            ))}
          </div>
        </div>
        <Finger spot={at(b, 1, 3) ? 'day3' : b === 3 ? 'day4' : i != null ? `w${i}` : b === 6 ? 'w4' : null} down={b === 2 || b === 3} hold={i != null} />
      </Stage>
      <Steps items={['This week: what is next', 'Tap a run to move it to another day', 'Slide along Progress to read a week']} on={still ? -1 : b < 1 ? 0 : b < 6 ? 1 : 2} />
    </>
  );
};

// ---------- the ask bar ----------
const ASK_BEATS = [900, 650, 260, 1800, 900, 650, 260, 1300, 900] as const;
export const AskDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(ASK_BEATS, running && !still, ASK_BEATS.length - 1);
  const open = still || b >= 3;
  const typed = useTyped('Move my long run to Saturday', at(b, 3, 4) && !still, still || b >= 4);
  const reply = still || b >= 4;
  const applied = still || b >= 7;
  return (
    <>
      <Stage className="ta">
        <div className="ta-behind">
          <span className="caps">Tomorrow</span>
          <b>Easy 4</b>
          <span className="caps">Sunday</span>
          <b>Long 8</b>
        </div>
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div key="sheet" className="ta-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ opacity: 0 }} transition={springs.sheet}>
              <span className="ta-you">{typed}{!reply ? <i className="tcaret" /> : null}</span>
              {reply ? (
                <motion.div className="ta-reply" initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={springs.settle}>
                  <span>
                    Long 8 <ArrowRight size={13} /> Saturday
                  </span>
                  {applied ? (
                    <b className="ta-applied">
                      <Check size={14} /> Applied <em>Undo</em>
                    </b>
                  ) : (
                    <b className="ta-apply" data-spot="apply">
                      Apply 1 change
                    </b>
                  )}
                </motion.div>
              ) : null}
            </motion.div>
          ) : (
            <motion.span key="bar" className="ta-bar" data-spot="bar" exit={{ opacity: 0 }}>
              <Disc size={16} tone="sky" />
              Ask or change anything
            </motion.span>
          )}
        </AnimatePresence>
        <Finger spot={at(b, 1, 3) ? 'bar' : at(b, 5, 7) ? 'apply' : null} down={b === 2 || b === 6} />
      </Stage>
      <Steps items={['Tap Ask or change anything, on any tab', 'Ask in plain words', 'Nothing changes until you tap Apply']} on={still ? -1 : b < 3 ? 0 : b < 5 ? 1 : 2} />
    </>
  );
};
