import { mondayOf, periodOf, type Aim, type GoalLevel, type ISODate } from '@logbook/shared';
import type { Transition, Variants } from 'motion/react';
import { fromParams } from '@/features/plan/planRoute';
import { crossfade, fadeIn, fadeOut, reducedFade, springs } from '@/lib/motion';
import type { BrandIconName } from '@/ui/icons';
import type { TabId } from '@/ui/nav';

/*
 * The add menu's rules (guide 6.1, "Add button" and "Add menu"), apart from its drawing: which rows it holds, in what
 * order, and which day or week a row adds to. Pure, so each can be tested without the dock.
 */

export type AddKind = 'todo' | 'goal' | 'session' | 'habit' | 'entry';

/** A row is a thing, not a sentence. "Session" is the app's word for one run or lift (guide 10.2). */
export const ADD_ROWS: Record<AddKind, { label: string; icon: BrandIconName }> = {
  todo: { label: 'To-do', icon: 'check' },
  goal: { label: 'Goal', icon: 'goals' },
  session: { label: 'Session', icon: 'run' },
  habit: { label: 'Habit', icon: 'habit' },
  entry: { label: 'Journal entry', icon: 'journal' },
};

const BASE: readonly AddKind[] = ['todo', 'goal', 'session', 'habit', 'entry'];
/** The thing a tab is about leads its menu. Today leads with the to-do, as every other place does. */
const LEADS: Partial<Record<TabId, AddKind>> = { goals: 'goal', plan: 'session', journal: 'entry' };

export interface AddShows {
  /** Fitness is on (lib/prefs.ts): a session can be added. */
  fitness: boolean;
  /** Today shows Plan your day, where to-dos live. */
  todos: boolean;
  /** Today shows Habits. */
  habits: boolean;
}

/**
 * The rows, most likely first. The first row is the one nearest the button (the card opens upward from it, so the list
 * is drawn from the bottom up, as a menu that opens above its button is on iPhone): the shortest reach for the thumb, and
 * the first row a slide crosses. A row whose home is switched off is not offered: a session with Fitness off, a to-do or
 * a habit when Today does not show its section.
 */
export const addOrder = (tab: TabId, shows: AddShows): AddKind[] => {
  const on = BASE.filter((k) => (k === 'session' ? shows.fitness : k === 'todo' ? shows.todos : k === 'habit' ? shows.habits : true));
  const lead = LEADS[tab];
  return lead && on.includes(lead) ? [lead, ...on.filter((k) => k !== lead)] : on;
};

const DAY = /^\/today\/(\d{4}-\d{2}-\d{2})/;
const WEEK = /^\/plan\/week\/(\d{4}-\d{2}-\d{2})/;
const MONTH = /^\/plan\/month\/(\d{4}-\d{2}-\d{2})/;

export interface AddPlace {
  /** The day a row adds to: the day Today's pager shows while Today is the tab, today anywhere else. */
  day: ISODate;
  /** The week Fitness shows, while Fitness is the tab (its Monday); null anywhere else. */
  week: ISODate | null;
}

/** Where the person is, from the tab and the two roots that can show another day or week. */
export const addPlace = (o: { active: TabId; todayPath: string; planPath: string; today: ISODate }): AddPlace => {
  const day = o.active === 'today' ? ((DAY.exec(o.todayPath)?.[1] as ISODate | undefined) ?? o.today) : o.today;
  if (o.active !== 'plan') return { day, week: null };
  const mon = WEEK.exec(o.planPath)?.[1];
  const month = MONTH.exec(o.planPath)?.[1];
  return { day, week: fromParams(mon ? { mon } : month ? { month } : {}, o.today).mon as ISODate };
};

/**
 * The goal the Goal row opens: the first level with nothing set, nearest first (the day, then this week, this month,
 * this year). The day is the shown day when it is today or ahead; a day that is over cannot take a goal, so today
 * stands in. With all four set it opens the day's goal.
 */
export const goalToOpen = (goals: readonly Aim[] | undefined, day: ISODate, today: ISODate): { level: GoalLevel; period: string } => {
  const d = day >= today ? day : today;
  const steps: Array<{ level: GoalLevel; period: string }> = [
    { level: 'day', period: d },
    { level: 'week', period: periodOf('week', today) },
    { level: 'month', period: periodOf('month', today) },
    { level: 'year', period: periodOf('year', today) },
  ];
  return steps.find((s) => !goals?.some((g) => g.level === s.level && g.period === s.period)) ?? steps[0]!;
};

/** The day and the week a session is added to: the shown day on Today, the shown week's own day on Fitness (`pick`), today elsewhere. */
export const sessionDay = (place: AddPlace, today: ISODate, pick: (mon: ISODate) => string): { mon: string; date: string } =>
  place.week ? { mon: place.week, date: pick(place.week) } : { mon: mondayOf(place.day), date: place.day };

// ---------- what a row opens ----------

/** The app's own add flows, one per row. Nothing here is a form of the menu's own. */
export interface AddFlows {
  /** The To-dos sheet with the caret in its field. `due`: a day ahead the to-do is for (Today's pager showed it). */
  todo: (due: ISODate | null) => void;
  /** A period's goal: the editor (or the app's own chooser) when it is not set, its card when it is. */
  goal: (level: GoalLevel, period: string) => void;
  /** The Add a session sheet, on `date` in the week of `mon`. */
  session: (mon: string, date: string) => void;
  /** The Add a habit sheet. A habit starts today, whatever day is shown. */
  habit: () => void;
  /** Journal, with the entry writer open in place. */
  entry: () => void;
}

/** Run a row: the flow it stands for, for the day (or the week) the screen is showing. */
export const runAdd = (kind: AddKind, place: AddPlace, today: ISODate, flows: AddFlows, read: { goals: readonly Aim[] | undefined; pickDay: (mon: ISODate) => string }): void => {
  if (kind === 'todo') return flows.todo(place.day > today ? place.day : null);
  if (kind === 'goal') {
    const g = goalToOpen(read.goals, place.day, today);
    return flows.goal(g.level, g.period);
  }
  if (kind === 'session') {
    const s = sessionDay(place, today, read.pickDay);
    return flows.session(s.mon, s.date);
  }
  if (kind === 'habit') return flows.habit();
  flows.entry();
};

// ---------- the menu's behavior, with no DOM in it ----------

/** What is under the finger: a row (its place in `addOrder`, 0 nearest the button), the card's own padding, the button, or anything else. */
export type Over = { on: 'row'; index: number } | { on: 'card' } | { on: 'button' } | { on: 'outside' };
export interface AddMenuState {
  open: boolean;
  /** The row under the finger, lit; -1 for none. */
  lit: number;
}
export type AddHaptic = 'lift' | 'tick' | 'select' | 'drop';

/**
 * The add menu as a small machine (guide 6.1, 9.5), driven by the dock's button and the card's rows.
 *
 * A press on the button opens it at once (`lift`), so the finger may stay down: sliding onto a row lights it (`tick`, one
 * per row crossed) and letting go there chooses it (`select`). Letting go on the button leaves the menu open for a
 * second tap; letting go anywhere else closes it. A press that starts on the card works the same way, except that
 * letting go outside only lets the row go. A press on the button while it is open puts it away (`drop`); every other way
 * of closing (the veil, Escape, Back, a change of page) is silent, as every other dismissal in the app is.
 */
export const createAddMenu = (deps: { haptic: (e: AddHaptic) => void; choose: (index: number) => void }) => {
  let s: AddMenuState = { open: false, lit: -1 };
  /** Where the pointer that is down began. */
  let from: 'button' | 'card' | null = null;
  const subs = new Set<() => void>();
  const set = (next: AddMenuState) => {
    if (next.open === s.open && next.lit === s.lit) return;
    s = next;
    for (const f of [...subs]) f();
  };
  const shut = () => {
    from = null;
    set({ open: false, lit: -1 });
  };
  const choose = (index: number) => {
    if (!s.open) return;
    shut();
    deps.haptic('select');
    deps.choose(index);
  };
  const toggle = () => {
    if (s.open) {
      shut();
      deps.haptic('drop');
      return;
    }
    set({ open: true, lit: -1 });
    deps.haptic('lift');
  };
  return {
    get: () => s,
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    /** A pointer went down on the button: open (and follow the finger), or put the menu away. */
    pressButton: () => {
      const was = s.open;
      toggle();
      from = was ? null : 'button';
    },
    /** A pointer went down on the card: on a row (it lights, with no tick: a press is not a crossing), or on its padding (-1). */
    pressCard: (index: number) => {
      if (!s.open) return;
      from = 'card';
      set({ open: true, lit: index });
    },
    /** The finger moved while down. */
    move: (over: Over) => {
      if (!s.open || !from) return;
      const next = over.on === 'row' ? over.index : -1;
      if (next === s.lit) return;
      set({ open: true, lit: next });
      if (next !== -1) deps.haptic('tick');
    },
    /** The finger lifted. */
    release: (over: Over) => {
      if (!s.open || !from) return;
      const began = from;
      from = null;
      if (over.on === 'row') return choose(over.index);
      if (over.on === 'outside' && began === 'button') return shut();
      set({ open: true, lit: -1 });
    },
    /** The system took the touch: nothing is chosen and nothing closes. */
    cancel: () => {
      from = null;
      if (s.open) set({ open: true, lit: -1 });
    },
    /** The button's click with no pointer behind it (the keyboard, VoiceOver). */
    toggle,
    /** A row's own click (a tap after the menu is open, Return, VoiceOver). */
    clickRow: choose,
    /** The veil, Escape, Tab, Back, a change of page, the keyboard coming up: closed, in silence. */
    dismiss: shut,
  };
};
export type AddMenuMachine = ReturnType<typeof createAddMenu>;

/**
 * A key while the menu is open. Rows are counted as `addOrder` counts them, 0 nearest the button, so Up moves away from
 * the button and Down toward it; Home is the top row and End the one by the button. `at` is the focused row, -1 for none.
 */
export const keyStep = (key: string, at: number, count: number): { close: true } | { focus: number } | null => {
  if (key === 'Escape' || key === 'Tab') return { close: true };
  if (!count) return null;
  if (key === 'ArrowUp') return { focus: at < 0 ? 0 : (at + 1) % count };
  if (key === 'ArrowDown') return { focus: at < 0 ? 0 : (at - 1 + count) % count };
  if (key === 'Home') return { focus: count - 1 };
  if (key === 'End') return { focus: 0 };
  return null;
};

// ---------- its motion (guide 9.1), as data ----------

/** The card grows from this scale, out of the button's center. */
export const ADD_FROM_SCALE = 0.4;
/** Closing, it steps back this far while it fades. */
export const ADD_EXIT_SCALE = 0.9;
/** A row rises this many px as it fades in. */
export const ADD_ROW_RISE = 8;
/** One row starts this long after the row below it (s). */
export const ADD_STAGGER_S = 0.03;
/** The plus turns this far to become the close mark (degrees). */
export const ADD_TURN = 45;

/** Each part has two states, `open` and `closed`, and the way into each. A row takes its index (0 nearest the button) as `custom`. */
export interface AddMotion {
  veil: Variants;
  card: Variants;
  row: Variants;
  /** How far the plus turns when open, and the way there and back. 0: it does not turn; the close mark fades in over it. */
  glyph: { turn: number; open: Transition; closed: Transition };
}

const still: Transition = { duration: 0 };
/**
 * Open: the card scales from the button on `springs.settle` while it fades in (120 ms), each row rises 8 px and fades in
 * 30 ms after the one below it, and the plus turns 45 degrees on the same spring. Close: one 100 ms fade with a small
 * step back, and the plus turns back in 150 ms. Reduce Motion: one 150 ms linear fade and nothing else.
 *
 * Only `transform` and `opacity` move, and each is written whole (`transform: scale(...)`), so the browser can run it
 * off the main thread where it is able to.
 */
export const addMotion = (reduce: boolean): AddMotion => {
  if (reduce) {
    const fade = { opacity: reducedFade, transform: still };
    return {
      veil: { open: { opacity: 1, transition: reducedFade }, closed: { opacity: 0, transition: reducedFade } },
      card: { open: { opacity: 1, transform: 'none', transition: fade }, closed: { opacity: 0, transform: 'none', transition: fade } },
      row: { open: { opacity: 1, transform: 'none', transition: still } },
      glyph: { turn: 0, open: reducedFade, closed: reducedFade },
    };
  }
  return {
    veil: { open: { opacity: 1, transition: fadeIn }, closed: { opacity: 0, transition: fadeOut } },
    card: {
      open: { opacity: [0, 1], transform: [`scale(${ADD_FROM_SCALE})`, 'scale(1)'], transition: { transform: springs.settle, opacity: fadeIn } },
      closed: { opacity: 0, transform: `scale(${ADD_EXIT_SCALE})`, transition: fadeOut },
    },
    row: {
      open: (index: number) => {
        const delay = index * ADD_STAGGER_S;
        return { opacity: [0, 1], transform: [`translateY(${ADD_ROW_RISE}px)`, 'translateY(0px)'], transition: { transform: { ...springs.settle, delay }, opacity: { ...fadeIn, delay } } };
      },
    },
    glyph: { turn: ADD_TURN, open: springs.settle, closed: crossfade },
  };
};
