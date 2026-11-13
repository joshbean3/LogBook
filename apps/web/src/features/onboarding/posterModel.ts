import { fmtDate, type MorningSettings, type ISODate } from '@logbook/shared';
import { helloLine } from '@/features/assistant/hello';
import { shortClock } from '@/features/day/dayWords';
import { heroScene, tenth, type HeroScene } from '@/features/day/heroWeek';
import type { Stop } from '@/features/day/MiniTimeline';
import { afternoonStops, DEFAULT_AFTERNOON, sessionMinutes } from '@/features/day/trainWhen';
import { goalIdea, type GoalIdea } from '@/features/goals/goalIdea';
import { DAY_NAME, firstWeek, fixLongRun, goalLong, HABIT_LIMIT, templateProblem, type BlockShape, type FirstWeek, type TrainingProfile } from './model';

/**
 * What each first-run poster shows for a given set of answers. Pure, so every picture can be read by a test: the
 * pictures are the app's own components (the training card's week horizon, its timeline row, the far hills, the habit
 * tiles, the day poster), and this file turns the answers so far into what those components are handed.
 *
 *   helloPoster    the name question: the assistant's greeting with the name as it is typed
 *   trainPoster    the days question and the reveal: the training card for the first run, and the week it counts
 *   morningStops   the morning question: the card's timeline row (Wake, Door, Back, Leave; after work, the afternoon's)
 *   goalHills      the goal question: the build as three hills, the race the far one
 *   habitTiles     the habits question: one tile a habit picked
 *   firstIdea      the reveal and Today's first move: the goal Today will suggest to this account
 */

// ---------- the name ----------
/** The greeting as the assistant will say it. Nothing typed: the greeting alone ("Good morning."), never a sample name. */
export const helloPoster = (name: string | null | undefined, hour?: number): string => helloLine(name, hour);

// ---------- the training card ----------
export interface TrainPoster {
  /** The card's name: the first run as the plan names it ("Easy 3"). */
  name: string;
  /** The line under it: when the first run is, and where the long run sits ("Tomorrow · Long run Sunday"). */
  line: string;
  /** The week horizon and its band: one mark a run, "0 of 4", "0 of 12 mi". */
  scene: HeroScene;
  runs: number;
  miles: number;
  /** The picture in words, for VoiceOver. */
  said: string;
}

/** The band's caption: the picture counts the plan's first seven days, not the calendar week Today will count. */
export const FIRST_WEEK_LABEL = 'Runs in week one';

/**
 * The training card the answers make: the first run's name, and the horizon counting the first seven days of the plan
 * (the same seven the plan builder writes: `firstWeek`). Nothing is done yet, so the sun rests at the left and every mark
 * is open. A change of run days changes the marks and the count; a change of miles changes the name and the miles.
 * `problem` (model.ts `templateProblem`) is the line when the answers build no plan at all.
 */
export const trainPoster = (week: FirstWeek, p: Pick<TrainingProfile, 'runDays' | 'longRunDay'>, problem: string | null = null): TrainPoster => {
  const first = week.first ? week.days.find((d) => d.session === week.first) : undefined;
  const name = first?.label ?? 'Your first run';
  const long = DAY_NAME[fixLongRun(p.runDays, p.longRunDay)];
  // answers that build no plan (more miles than the days can hold): the builder's own words say what to change
  const line = first ? [week.firstWhen, p.runDays.length > 1 ? `Long run ${long}` : ''].filter(Boolean).join(' · ') : (problem ?? '');
  const base = heroScene({ week: { mon: week.days[0]?.date ?? ('2000-01-03' as ISODate), runs: { planned: week.runs, done: 0 }, workouts: { planned: 0, done: 0 }, doneMiles: 0, plannedMiles: week.miles }, lead: 'run', hasRuns: false, picked: null });
  const miles = tenth(week.miles);
  const said = `${name}. ${line ? `${line}. ` : ''}Week one: ${week.runs} ${week.runs === 1 ? 'run' : 'runs'}, ${miles} ${miles === '1' ? 'mile' : 'miles'}.`;
  return { name, line, scene: { ...base, label: FIRST_WEEK_LABEL, said }, runs: week.runs, miles: week.miles, said };
};

/** The same card straight from the answers (the days question, the morning question, the reveal). */
export const trainPosterFor = (p: TrainingProfile, start: ISODate, today: ISODate, wake: number, leave: number, settings?: MorningSettings | null): { week: FirstWeek; poster: TrainPoster } => {
  const week = firstWeek(p, start, today, wake, leave, settings);
  return { week, poster: trainPoster(week, p, week.first ? null : templateProblem(p, start)) };
};

// ---------- the morning ----------
export interface MorningPoster {
  /** The card's timeline row. */
  stops: Stop[];
  /** The line under the session's name: "Out the door 6:45", "Run at 6:10 PM". */
  line: string;
  /** The row in words, for VoiceOver. */
  said: string;
  /** The run does not fit before work on these times. */
  tight: boolean;
}

/**
 * The card's timeline row for the first run on these times. Before work: Wake, Door, Back, Leave, read off the real
 * morning (`firstWeek`'s preview). After work: the afternoon's own row (Off work, Run, Back, Dinner), as Today draws it.
 */
export const morningStops = ({ week, wake, leave, afternoon }: { week: FirstWeek; wake: number; leave: number; /** when work ends, for someone who trains after it; null before work */ afternoon: number | null }): MorningPoster => {
  const said = (stops: Stop[]) => stops.map((s) => `${s.label} ${shortClock(s.at)}`).join(', ');
  if (afternoon != null) {
    const stops = afternoonStops({ ...DEFAULT_AFTERNOON, offWork: afternoon }, sessionMinutes(week.first, null), 'run');
    return { stops, line: `Run at ${shortClock(stops[1]!.at)}`, said: said(stops), tight: false };
  }
  const m = week.morning;
  const door = m?.door ?? wake + 15;
  const back = m?.back ?? door + 40;
  const stops: Stop[] = [
    { key: 'wake', label: 'Wake', at: wake },
    { key: 'door', label: 'Door', at: door },
    { key: 'back', label: 'Back', at: back },
    // the person's own two times, as set: a run that does not fit shows as Back after Leave, and `tight` says so
    { key: 'leave', label: 'Leave', at: leave },
  ];
  return { stops, line: `Out the door ${shortClock(door)}`, said: said(stops), tight: (m?.late ?? 0) > 0 };
};

// ---------- the goal ----------
export interface GoalHill {
  caption: string;
  words?: string;
  value?: string;
}
export interface GoalHills {
  /** The caption on the sky: "16 weeks", or "Your plan" before a goal is picked. */
  title: string;
  /** Far to near: race day (or where the build ends), the peak week, week one. */
  hills: readonly [GoalHill, GoalHill, GoalHill];
  said: string;
}

/** The longest run the plan holds, in miles (0 with no plan). */
export const longestRun = (week: FirstWeek): number => Math.max(0, ...(week.template?.sessions ?? []).filter((s) => !/race/i.test(s.type)).map((s) => s.miles));

/**
 * The build as three hills, the far one last in time: race day (or, with no race, the week the build ends), the peak
 * week with its longest run and the taper after it, and week one. Every number is read off the real plan (`blockShape`
 * and the template it came from). With no goal picked yet the hills carry their names only.
 */
export const goalHills = (p: TrainingProfile | null, shape: BlockShape | null, week: FirstWeek | null): GoalHills => {
  if (!p || !shape || !week) return { title: 'Your plan', hills: [{ caption: 'Race day' }, { caption: 'Peak week' }, { caption: 'Week one' }], said: 'Your plan: pick what you are training for.' };
  const weeks = `${shape.weeks} ${shape.weeks === 1 ? 'week' : 'weeks'}`;
  const race = p.goal !== 'base';
  const far: GoalHill = race
    ? { caption: p.raceDate ? `Race day · ${fmtDate('md', p.raceDate)}` : 'Race day', words: p.raceDate ? goalLong(p.goal) : `${goalLong(p.goal)}, no date yet`, value: `${shape.weeks} wk` }
    : { caption: `Week ${shape.weeks}`, words: `${shape.peak} mi a week`, value: 'No race' };
  const long = longestRun(week);
  const peak: GoalHill = { caption: 'Peak week', words: long > 0 ? `${shape.peak} mi, long run ${tenth(long)}` : `${shape.peak} mi`, ...(shape.taperWeeks ? { value: `${shape.taperWeeks} wk taper` } : {}) };
  const one: GoalHill = { caption: 'Week one', words: `${shape.from} mi over ${p.runDays.length} ${p.runDays.length === 1 ? 'run' : 'runs'}` };
  const said = `${goalLong(p.goal)}: ${weeks}. Week one, ${one.words}. Peak week, ${peak.words}${shape.taperWeeks ? `, then a ${shape.taperWeeks}-week taper` : ''}.${race && p.raceDate ? ` Race day ${fmtDate('short', p.raceDate)}.` : ''}`;
  return { title: weeks, hills: [far, peak, one], said };
};

// ---------- the habits ----------
/** One tile a habit picked, in the order picked, never more than the account holds. */
export const habitTiles = (selected: readonly string[]): string[] => selected.slice(0, HABIT_LIMIT);

/** How many tiles the reveal shows before it says how many more wait on Today (two rows of two). */
export const REVEAL_TILES = 4;
export const revealTiles = (selected: readonly string[]): { shown: string[]; more: number } => {
  const all = habitTiles(selected);
  return { shown: all.slice(0, REVEAL_TILES), more: Math.max(0, all.length - REVEAL_TILES) };
};

// ---------- the first move ----------
/**
 * The goal Today will suggest to this account when it opens for the first time: a new account has no yesterday and no
 * to-do, and the plan starts tomorrow, so the idea comes from the habits ("All 3 habits, done by 9"), and with none it is
 * the person's own words (null). The same `goalIdea` Today's poster runs, so the reveal and Today say the same thing.
 */
export const firstIdea = ({ habits, fitness, minutes }: { habits: number; fitness: boolean; minutes: number }): GoalIdea | null => goalIdea({ yesterday: null, todos: [], fitness, session: null, habits, minutes });
