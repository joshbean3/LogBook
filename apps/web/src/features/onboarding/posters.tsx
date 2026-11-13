import { weekdayOf, WEEKDAYS, type ISODate } from '@logbook/shared';
import { Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { useRef } from 'react';
import { HeroHorizon } from '@/features/day/HeroHorizon';
import type { HeroScene } from '@/features/day/heroWeek';
import { MiniTimeline, type Stop } from '@/features/day/MiniTimeline';
import { leftWords } from '@/features/dayplan/model';
import type { GoalIdea } from '@/features/goals/goalIdea';
import { OrbFace } from '@/features/habits/OrbFace';
import { tonightRow } from '@/features/journal/days';
import { TonightFace } from '@/features/journal/TonightRow';
import { reducedFade, springs } from '@/lib/motion';
import { shownTabs } from '@/ui/nav';
import { Orb } from '@/ui/Orb';
import { FarHills, PathLine, PathStop, Poster, PosterScene } from '@/ui/poster';
import { Pressable } from '@/ui/Pressable';
import type { GoalHills } from './posterModel';
import '@/features/day/day.css';
import '@/app/shell.css';
import './posters.css';

/**
 * The pictures of first run: each one a real piece of the app, drawn by the app's own components from the answers so far
 * (what each is handed is worked out in posterModel.ts, apart from the drawing, so a test can read it).
 *
 *   HelloPoster      the assistant's greeting: its Orb and "Good morning, Sam." as the assistant sheet says it
 *   FitnessChoice    the two choices as two pictures (the week horizon, the day's dotted line) and the tab capsule
 *   GoalPoster       the far hills (ui/poster FarHills), the race the last hill
 *   TrainingPoster   the training card: the session's name, the week horizon and its band (HeroHorizon), and, when
 *                    it is given stops, the card's own timeline row (MiniTimeline)
 *   HabitTiles       the habit tiles as Today lays them out (OrbFace, two columns)
 *   DayPoster        Today's day poster: the question, the band's idea, the lit stop
 *   TonightPoster    the Journal row at the foot of Today
 *
 * Every one is a picture: the frame hides it from VoiceOver behind one sentence and makes it inert, so nothing in it
 * takes a tap. FitnessChoice is the exception: its two pictures are the two answers.
 */

const noop = () => undefined;

// ---------- the name: the assistant's greeting ----------
/** The first line of the assistant's empty sheet, on a poster's sky: the Orb, then the greeting in the sentence italic. */
export const HelloPoster = ({ line }: { line: string }): React.JSX.Element => (
  <Poster
    size="slim"
    className="obp-hello"
    titleAs="p"
    title={
      <span className="obp-hello-in">
        <Orb size={56} className="obp-hello-orb" />
        <span className="obp-hello-line">{line}</span>
      </span>
    }
    scene={<PosterScene size="slim" />}
  />
);

// ---------- Fitness: two pictures, two answers ----------
/** The tab capsule as the app draws it (app/shell.css), with the tabs this answer leaves: four, or three. */
export const TabCapsule = ({ fitness }: { fitness: boolean }): React.JSX.Element => {
  const reduce = useReducedMotion();
  const tabs = shownTabs(fitness);
  return (
    <div className="obp-tabs" role="img" aria-label={`Your tabs: ${tabs.map((t) => t.label).join(', ')}`}>
      <div className="tabbar" aria-hidden="true">
        <div className="tabs">
          <AnimatePresence initial={false} mode="popLayout">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <motion.span key={t.id} layout={reduce ? false : 'position'} className="tab-item" aria-current={t.id === 'today' ? 'page' : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? reducedFade : springs.settle}>
                  <span className="tab-ic">
                    <Icon size={22} />
                  </span>
                  <span className="tab-label">{t.label}</span>
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const FITNESS_CHOICES = [
  { v: true, label: 'Yes, track training', line: 'Runs, lifts, a plan' },
  { v: false, label: 'No, just my day', line: 'Goals, to-dos, habits' },
] as const;

/**
 * "Do you want Orby to track training?" as two pictures: the training card's week horizon, and the day poster's dotted
 * line. Each is a radio; the chosen one is lit (its sun, or its Next stop, takes the now color, and it carries the
 * check), the other dims. The capsule under them shows the tabs the answer leaves.
 */
export const FitnessChoice = ({ value, onChange, label }: { value: boolean | undefined; onChange: (v: boolean) => void; label: string }): React.JSX.Element => {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + FITNESS_CHOICES.length) % FITNESS_CHOICES.length;
    onChange(FITNESS_CHOICES[n]!.v);
    refs.current[n]?.focus();
  };
  return (
    <div className="obp-fit">
      <div className="obp-choices" role="radiogroup" aria-label={label}>
        {FITNESS_CHOICES.map((c, i) => {
          const on = value === c.v;
          const dim = value !== undefined && !on;
          return (
            <div key={String(c.v)} className={`obp-choice${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}`} data-choice={c.v ? 'yes' : 'no'}>
              <span className="obp-choice-sky" aria-hidden="true" />
              <div className="obp-choice-art" aria-hidden="true" inert>
                {c.v ? (
                  <PosterScene total={4} done={1} lit={on} />
                ) : (
                  <PathLine lead={false} className="obp-choice-path">
                    <PathStop state={on ? 'next' : 'ahead'} tag={on ? 'Next' : undefined} title="Call the bank" highlight={false} />
                    <PathStop state="ahead" title="Stretch 10 min" />
                  </PathLine>
                )}
              </div>
              {/* the radio covers the card: its words sit at the top, the picture shows under it */}
              <Pressable
                ref={(el: HTMLElement | null) => {
                  refs.current[i] = el;
                }}
                role="radio"
                aria-checked={on}
                tabIndex={on || (value === undefined && i === 0) ? 0 : -1}
                className="obp-choice-btn"
                press="dim"
                onPress={() => onChange(c.v)}
                onKeyDown={(e: React.KeyboardEvent) => onKey(e, i)}
              >
                <span className="obp-choice-words">
                  <span className="obp-choice-title">{c.label}</span>
                  <span className="obp-choice-line">{c.line}</span>
                </span>
                <span className="obp-choice-mark" aria-hidden="true">
                  {on ? <Check size={16} strokeWidth={3} /> : null}
                </span>
              </Pressable>
            </div>
          );
        })}
      </div>
      <TabCapsule fitness={value !== false} />
    </div>
  );
};

// ---------- the goal: the build as far hills ----------
export const GoalPoster = ({ hills }: { hills: GoalHills }): React.JSX.Element => <FarHills className="obp-goal" title={hills.title} label="Your plan" hills={hills.hills} />;

// ---------- the training card ----------
/**
 * The training card as Today and Fitness draw it, from plain values: the session's name and line on the sky, the week
 * horizon and its band (HeroHorizon, the card's own scene), and under the hill the timeline row (MiniTimeline) when
 * `stops` are given. `scene={null}` draws the name over the timeline alone (the morning question, where the row is the
 * point). The classes are the card's own (features/day/day.css), so it is the card, not a drawing of it.
 */
export const TrainingPoster = ({ name, line, scene, stops, stopsLabel = 'The morning' }: { name: string; line: string; scene: HeroScene | null; stops?: Stop[]; stopsLabel?: string }): React.JSX.Element => (
  <section className={`hero aura hz-card obp-train${scene ? '' : ' is-rowonly'}`}>
    <div className="hero-face hz-face">
      {scene ? (
        <HeroHorizon scene={scene} isToday={false} firstToday={false} quiet={false} live page="first-run" onWeek={noop} onPick={noop}>
          <span className="hero-stamp hz-name">{name}</span>
          <p className="hero-line hz-line">{line}</p>
        </HeroHorizon>
      ) : (
        <div className="hz">
          <span className="hz-sky" aria-hidden="true" />
          <div className="hz-words">
            <span className="hero-stamp hz-name">{name}</span>
            <p className="hero-line hz-line">{line}</p>
          </div>
        </div>
      )}
      {stops ? (
        <div className="hz-ctl">
          <div className="hero-deck">
            <MiniTimeline stops={stops} now={-1} label={stopsLabel} tone="easy" yieldNow />
          </div>
        </div>
      ) : null}
    </div>
  </section>
);

// ---------- the habits ----------
/** A new habit's week on the day it is added: nothing before today, today open, the days ahead still to come. */
const newWeek = (today: ISODate): { week: string; dayIdx: number } => {
  const dayIdx = WEEKDAYS.indexOf(weekdayOf(today));
  return { week: WEEKDAYS.map((_, i) => (i === dayIdx ? 'o' : '-')).join(''), dayIdx };
};

/**
 * The habits picked, as the tiles they become on Today: the same face (OrbFace) in the same two-column grid. A tile
 * comes in with one small pop as its chip is picked. None picked: one quiet line, never an empty box.
 */
export const HabitTiles = ({ names, today, empty = 'Pick one and it shows here, as on Today.' }: { names: readonly string[]; today: ISODate; empty?: string | null }): React.JSX.Element | null => {
  const reduce = useReducedMotion();
  const { week, dayIdx } = newWeek(today);
  if (!names.length) return empty ? <p className="obp-none">{empty}</p> : null;
  return (
    <div className="orbs is-grid obp-tiles">
      <AnimatePresence initial={false} mode="popLayout">
        {names.map((n) => (
          <motion.span key={n} className="orb" layout={reduce ? false : 'position'} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }} transition={reduce ? reducedFade : springs.settle}>
            <OrbFace name={n} on={false} week={week} dayIdx={dayIdx} reduce={!!reduce} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ---------- the day poster ----------
/**
 * Today's day poster for an account on its first day: the question, the band's idea (the one Today will offer:
 * posterModel `firstIdea`) and the lit stop where Today has its buttons. `slim`: under the training card, so no second
 * sun. The stop is words here, not the Sky button: the screen's one Sky button is the frame's.
 */
export const DayPoster = ({ idea, minutes, slim = false }: { idea: GoalIdea | null; minutes: number; slim?: boolean }): React.JSX.Element => (
  <Poster
    size={slim ? 'slim' : 'full'}
    className="obp-day"
    title="What would make today count?"
    titleAs="p"
    now="Today"
    meta={leftWords(minutes)}
    scene={<PosterScene size={slim ? 'slim' : 'full'} />}
    band={idea ? { label: idea.label, words: idea.text } : { label: 'Today’s goal', words: 'One thing, in your own words' }}
    path={
      <PathLine>
        <PathStop state="next" tag="Next" title={idea ? 'Set this goal' : 'Set today’s goal'} />
      </PathLine>
    }
  />
);

// ---------- tonight's Journal row ----------
export const TonightPoster = (): React.JSX.Element => (
  <div className="obp-tonight">
    <TonightFace w={tonightRow(null)} />
  </div>
);
