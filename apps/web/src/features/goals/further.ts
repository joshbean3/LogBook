import { periodOf, periodSpan, type Aim, type GoalLevel, type ISODate } from '@logbook/shared';
import { clockOf, goalOf, STATUS_WORD } from './model';

/*
 * "Further out" on the Goals page: the year, the month and this week as three hills (ui/poster FarHills), far to near.
 * Pure, so a test reads what each hill says and which one carries the plus.
 */

/** Far to near: the order the hills are drawn in, top to bottom. */
export const FAR_LEVELS = ['year', 'month', 'week'] as const;
export type FarLevel = (typeof FAR_LEVELS)[number];

export interface HillView {
  level: FarLevel;
  period: string;
  goal: Aim | null;
  /** set: the goal is written on the hill. invite: the nearest hill with no goal, the one that carries the plus. far: its name only. */
  state: 'set' | 'invite' | 'far';
  /** The caps line: "2026 · 50 days left", "November", "This week · Done". */
  caption: string;
  /** The goal, or the invitation ("Set this week’s goal"). Absent on a far hill. */
  words?: string;
  /** Steps done, when the goal has steps: "2 of 5". */
  value?: string;
  /** What VoiceOver says for the hill's button. */
  label: string;
}

/** A period by its own name: "2026", "November", "This week". */
export const hillName = (level: FarLevel, period: string): string => (level === 'week' ? 'This week' : level === 'month' ? (periodSpan('month', period).split(' ')[0] ?? period) : period);

/** The one invitation a hill makes: "Set this week’s goal", "Set a goal for November", "Set a goal for 2026". */
export const inviteWords = (level: FarLevel, period: string): string => (level === 'week' ? 'Set this week’s goal' : `Set a goal for ${hillName(level, period)}`);

const bare = (t: string) => t.replace(/[.\s]+$/, '');

/**
 * The three hills, far to near. A set goal shows its caption with the time left (or its answer once reviewed) and its
 * steps done. Of the hills with no goal, only the nearest carries the plus and the invitation; the others show their name
 * alone. Nothing ever reads "Not set".
 */
export const hillsOf = (goals: readonly Aim[] | undefined, today: ISODate, now: number): [HillView, HillView, HillView] => {
  const rows = FAR_LEVELS.map((level) => {
    const period = periodOf(level, today);
    return { level, period, goal: goalOf(goals, level as GoalLevel, period) };
  });
  // the nearest hill with no goal: the week before the month before the year
  const invite = [...rows].reverse().find((r) => !r.goal)?.level ?? null;
  return rows.map(({ level, period, goal }): HillView => {
    const name = hillName(level, period);
    const left = clockOf(level, period, now).words;
    if (goal) {
      const n = goal.steps.length;
      const k = goal.steps.filter((s) => s.done).length;
      const end = goal.status === 'open' ? left : STATUS_WORD[goal.status];
      const value = n && goal.status === 'open' ? `${k} of ${n}` : undefined;
      return { level, period, goal, state: 'set', caption: `${name} · ${end}`, words: goal.text, value, label: `${name}, ${end}. ${bare(goal.text)}${value ? `, ${k} of ${n} steps done` : ''}. Open` };
    }
    if (level === invite) {
      const words = inviteWords(level, period);
      return { level, period, goal: null, state: 'invite', caption: `${name} · ${left}`, words, label: `${name}, ${left}. ${words}` };
    }
    return { level, period, goal: null, state: 'far', caption: name, label: `${name}, no goal yet. ${inviteWords(level, period)}` };
  }) as [HillView, HillView, HillView];
};
