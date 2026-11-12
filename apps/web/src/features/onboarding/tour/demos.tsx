import { ArrowRight, Check, Plus } from 'lucide-react';
import { Disc } from '@/ui/Disc';
import { Orb } from '@/ui/Orb';
import { AnimatePresence, motion } from 'motion/react';
import { springs } from '@/lib/motion';
import { Finger, Stage, Steps, useLoop, useTyped } from './engine';

/**
 * One short film per part of Logbook, each a miniature of the real screen with the real labels (mapped from the code:
 * PlanDay, OrbRow, GoalSheets, the journal calendar, LearnedParts, Week, ProgressView, Dock and the assistant sheet). Each loops while its
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
/** The days of the month written so far: each gets its dot (a flat Disc in the journal's tones, never an Orb). */
const WRITTEN = [true, true, false, true, true, true, false, true, true, true, true, false, true];
const JOUR_BEATS = [900, 650, 260, 1900, 600, 260, 1400, 900] as const;
export const JournalDemo = ({ running, still, plain }: DemoProps) => {
  const line = plain ? 'Long walk by the river with Sam.' : 'Long run by the river with Sam.';
  const b = useLoop(JOUR_BEATS, running && !still, JOUR_BEATS.length - 1);
  const writing = at(b, 3, 6);
  const typed = useTyped(line, writing && !still, b >= 4);
  const written = still || b >= 6;
  return (
    <>
      <Stage className="tj">
        <div className="tj-cal">
          <span className="caps">November</span>
          <div className="tj-grid">
            {WRITTEN.map((on, i) => (
              <span key={i} className="tj-cell">
                {on ? <Orb size={14} state="still" variant={(['sky', 'dusk', 'sun', 'tide'] as const)[i % 4]} /> : null}
              </span>
            ))}
            <span className="tj-cell tis-today">
              {written ? (
                <motion.span initial={still ? false : { scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={springs.complete}>
                  <Orb size={16} state="still" variant="sky" />
                </motion.span>
              ) : null}
            </span>
          </div>
        </div>
        <div className="tj-day">
          {written ? (
            <p className="tj-memory">“{line}”</p>
          ) : writing ? (
            <>
              <span className="tj-field">
                {typed}
                <i className="tcaret" />
              </span>
              <span className="tj-done" data-spot="done">
                done
              </span>
            </>
          ) : (
            <span className="tj-write" data-spot="write">
              <Plus size={16} />
              Write today’s
            </span>
          )}
        </div>
        <Finger spot={at(b, 1, 3) ? 'write' : at(b, 4, 6) ? 'done' : null} down={b === 2 || b === 5} />
      </Stage>
      <Steps items={['Tap today on the calendar', 'Write a line or two', 'Done, and the day gets its dot']} on={still ? -1 : b < 3 ? 0 : b < 6 ? 1 : 2} />
    </>
  );
};

// ---------- Learned ----------
const LRN_BEATS = [800, 650, 260, 1900, 600, 260, 1500, 900] as const;
export const LearnedDemo = ({ running, still, plain }: DemoProps) => {
  const line = plain ? 'A short walk after lunch clears my head.' : 'Strides before a race wake the legs up.';
  const b = useLoop(LRN_BEATS, running && !still, LRN_BEATS.length - 1);
  const typing = at(b, 3, 6);
  const typed = useTyped(line, typing && !still, b >= 4);
  const saved = still || b >= 6;
  return (
    <>
      <Stage className="tour-learn">
        <b className="tour-learn-q">What did you learn today?</b>
        {saved ? (
          <motion.div className="tour-learn-saved" initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={springs.settle}>
            <span className="caps">Today</span>
            <p>{line}</p>
            <span className="tour-learn-another">Add another</span>
          </motion.div>
        ) : (
          <>
            <span className="tour-learn-field" data-spot="field">
              {typing || b >= 4 ? (
                <>
                  {typed}
                  <i className="tcaret" />
                </>
              ) : (
                <em>One thing, in a sentence or two</em>
              )}
            </span>
            <span className="tour-learn-save" data-spot="save">
              Save
            </span>
          </>
        )}
        <Finger spot={at(b, 1, 3) ? 'field' : at(b, 4, 6) ? 'save' : null} down={b === 2 || b === 5} />
      </Stage>
      <Steps items={['Tap the field', 'One thing, in a sentence or two', 'Save keeps it, by month, to come back to later']} on={still ? -1 : b < 3 ? 0 : b < 6 ? 1 : 2} />
    </>
  );
};

// ---------- Plan ----------
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const RUNS: Record<number, { t: string; c: string }> = { 1: { t: 'Easy 4', c: 'easy' }, 3: { t: 'Tempo 5', c: 'hard' }, 5: { t: 'Easy 4', c: 'easy' }, 6: { t: 'Long 8', c: 'long' } };
const PLAN_BEATS = [900, 650, 700, 900, 300, 1500, 900] as const;
export const PlanDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(PLAN_BEATS, running && !still, PLAN_BEATS.length - 1);
  const lifted = at(b, 2, 4);
  const moved = still || b >= 4;
  const runs = { ...RUNS };
  if (moved) {
    runs[4] = runs[3]!;
    delete runs[3];
  }
  return (
    <>
      <Stage className="tp">
        <p className="tour-line">
          <b>This week</b>
          <span>21 mi · 4 runs</span>
        </p>
        <div className="tour-week">
          {DAYS.map((d, i) => {
            const r = runs[i];
            const ghost = lifted && i === 3;
            return (
              <span key={i} className={`tour-day ${lifted && i === 4 ? 'tis-target' : ''}`} data-spot={`day${i}`}>
                <small>{d}</small>
                <span className="tour-date">{9 + i}</span>
                {r && !ghost ? (
                  <motion.span layout={!still} className={`tour-pill c-${r.c}`} transition={springs.settle}>
                    {r.t}
                  </motion.span>
                ) : (
                  <span className="tour-rest">{ghost ? '' : 'Rest'}</span>
                )}
              </span>
            );
          })}
        </div>
        <AnimatePresence>
          {at(b, 4, 6) || still ? (
            <motion.p className="tour-toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={springs.settle}>
              Moved to Fri <b>Undo</b>
            </motion.p>
          ) : null}
        </AnimatePresence>
        <Finger spot={at(b, 1, 3) ? 'day3' : b === 3 ? 'day4' : null} hold={at(b, 2, 4)} carry={lifted ? <span className="tour-pill c-hard tis-lifted">Tempo 5</span> : undefined} />
      </Stage>
      <Steps items={['Hold a run until it lifts', 'Drag it to another day and let go', 'Tap any day to open or change it']} on={still ? -1 : b < 2 ? 0 : b < 5 ? 1 : 2} />
    </>
  );
};

// ---------- Progress ----------
const MILES = [14, 16, 15, 18, 12, 19, 21, 20, 23, 22, 25, 24];
/** Twelve Mondays, a week apart, ending on the latest. */
const WEEK_OF = MILES.map((_, k) => new Date(2026, 7, 17 + 7 * k).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
const PROG_BEATS = [900, 600, 380, 380, 380, 380, 380, 1200, 900] as const;
export const ProgressDemo = ({ running, still }: DemoProps) => {
  const b = useLoop(PROG_BEATS, running && !still, PROG_BEATS.length - 1);
  const scrub = at(b, 2, 8) ? 4 + (b - 2) * 1.4 : null;
  const i = scrub == null ? null : Math.min(MILES.length - 1, Math.round(scrub));
  const max = 26;
  const pts = MILES.map((m, k) => `${(k / (MILES.length - 1)) * 100},${100 - (m / max) * 100}`).join(' ');
  return (
    <>
      <Stage className="tq">
        <p className="tq-head">
          <span className="caps">{i == null ? 'Last 12 weeks' : `Week of ${WEEK_OF[i]}`}</span>
          <b>{i == null ? '229 mi' : `${MILES[i]} mi`}</b>
        </p>
        <div className="tq-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {MILES.map((m, k) => (
            <span key={k} className="tq-spot" style={{ left: `${(k / (MILES.length - 1)) * 100}%`, top: `${100 - (m / max) * 100}%` }} data-spot={`w${k}`} />
          ))}
          {i != null ? <span className="tq-rule" style={{ transform: `translateX(${(i / (MILES.length - 1)) * 100}%)` }} /> : null}
        </div>
        <Finger spot={i != null ? `w${i}` : b === 1 ? 'w4' : null} hold={i != null} />
      </Stage>
      <Steps items={['Press on a chart and slide along it', 'The numbers follow the week under your finger']} on={still ? -1 : b < 3 ? 0 : 1} />
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
