import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import type { Prefs, TodaySection } from '@/lib/prefs';
import type { BrandIconName } from '@/ui/icons';
import { TABS, type TabId } from '@/ui/nav';

/**
 * First-visit tips (layout standard 2.11, "First-visit tips"): the first time a person opens each tab after setup, one
 * small sheet rises over it and says, in a few plain lines, how the place works and how it is tracked. One per place,
 * once per phone. The tour ("How Orby works") stays as the longer version, and each tip links to its page of it.
 *
 * This file is the rules, apart from the screen: which place a path is, the words of each tip, whether one is due, and
 * the small store that remembers which have been seen. Nothing here renders.
 *
 * The words' rule: every line under "How it's tracked" says exactly what this build does, and names the code that makes
 * it so. A line that is not true for every account is left out for the accounts it is not true for (`needs`), never bent.
 */
export type TipPlace = TabId;
/** The places that have a tip, in the tabs' order. */
export const TIP_PLACES: readonly TipPlace[] = TABS.map((t) => t.id);
const isPlace = (v: unknown): v is TipPlace => typeof v === 'string' && (TIP_PLACES as readonly string[]).includes(v);

// ---------- which place a path is ----------

/**
 * The place a path shows, when it is a tab at its root: `/today`, `/goals`, `/plan`, `/journal`. Null for everything
 * else: a pushed page (Settings, History, a month), another day or week of a tab, first run and the tour (`/welcome/*`),
 * the signed-out screens.
 */
export const placeOf = (path: string): TipPlace | null => {
  const p = (typeof path === 'string' ? path : '').split(/[?#]/)[0]!.replace(/\/+$/, '');
  return TABS.find((t) => t.root === p)?.id ?? null;
};

// ---------- the words ----------

export interface TipRow {
  /** One glyph of the brand's set (guide 7), in a 32 px Haze tile. */
  icon: BrandIconName;
  /** One line, Inter 17 600. */
  title: string;
  /** One more line, Inter 15 Dusk. */
  sub?: string;
}
export interface Tip {
  place: TipPlace;
  /** The sheet's title: the place's name, as its tab writes it. */
  title: string;
  /** Under "How it works": two rows at most. */
  works: TipRow[];
  /** Under "How it's tracked": two rows at most. */
  tracked: TipRow[];
}

/**
 * The two groups' names (caps, four words at most). "How it works" is the caps line over the sheet's title, and the first
 * group stands directly under it, so it is printed once; "How it's tracked" is the caption inside the card.
 */
export const TIP_CAPTIONS = { works: 'How it works', tracked: 'How it’s tracked' } as const;
/** The caps line over the title: the first group's name. */
export const TIP_EYEBROW = TIP_CAPTIONS.works;
/** The sheet's one Sky button, and the quiet link under it. */
export const TIP_DONE = 'Got it';
export const TIP_TOUR = 'See it in the tour';
/** Settings, beside "How Orby works": the row that shows the tips again, and what it says when tapped. */
export const TIPS_AGAIN = { title: 'Show the tips again', sub: 'One short card per tab', done: 'Tips will show again' } as const;

/** What a build has (lib/features.ts): a line never names a source the build left out. */
export interface TipBuild {
  strava: boolean;
  health: boolean;
}
export const TIP_BUILD: TipBuild = { strava: STRAVA_BUILT, health: HEALTH_BUILT };

/** A row and the section of Today it is about: with that section switched off (Today shows) the row is left out. */
type TodayRow = TipRow & { needs?: TodaySection };

/*
 * Each "tracked" line, and the code that makes it true:
 *
 * - Today, "Saved when you tap": every write is applied to the screen at once and sent at once (`write`, api/outbox.ts);
 *   with no connection it is queued on the phone and sent when the connection returns (`outbox.replay`).
 * - Today, "Seven dots, one week": a habit tile draws this week, Monday to Sunday, one dot a day (`OrbFace`'s `week`), and
 *   the section's History opens every habit's last 30 days (`HabitsHistory`).
 * - Goals, "Done, partly or missed": a goal's status is `open`, `done`, `partly` or `missed` and only the owner sets it
 *   (`useMarkDone`, the review; features/goals/model.ts `STATUS_WORD`).
 * - Goals, "History keeps them": `/goals/history` lists every period of every level with its goal, and its log lists each
 *   change (`GoalHistory`'s `LOG_WORD`: set, edited, done, reopened, cleared).
 * - Fitness, "A session counts when it is done": `sessionStatus` (packages/shared/src/status.ts) reads done from a mark
 *   (Done, or Floor, which counts too), from a lift's logged sets, or from a run that arrived as an activity. Activities
 *   arrive from Strava only, so that way is named only in a build that has Strava. Apple Health brings sleep and heart
 *   numbers, never a workout (apps/api/src/services/appleHealth.ts), so it is not named here in any build.
 * - Fitness, "Progress adds it up": the chart is bars of what was done in each bucket of the chosen range, read by
 *   sliding along them (`RangeBars`, features/progress/ranges.ts).
 * - Journal, "A day lights when you write": `writtenWeek` (features/journal/days.ts) lights a day that holds a line or an
 *   entry, and counts days written, never days in a row.
 */
const TODAY_WORKS: readonly TodayRow[] = [
  { icon: 'goals', title: 'One goal for the day', sub: 'Then your to-dos. The lit stop is next.', needs: 'day' },
  { icon: 'habit', title: 'Habits are tiles', sub: 'Tap one when it is done.', needs: 'habits' },
];
const TODAY_TRACKED: readonly TodayRow[] = [
  { icon: 'check', title: 'Saved when you tap', sub: 'Offline, it sends when you reconnect.' },
  { icon: 'history', title: 'Seven dots, one week', sub: 'On each habit tile. History has more.', needs: 'habits' },
];
const strip = ({ needs: _needs, ...row }: TodayRow): TipRow => row;

/**
 * The tip for a place, for this account and this build, or null when there is none: Fitness with Fitness off, and Today
 * when every section its lines are about is switched off (nothing true is left to say about how it works).
 */
export const tipFor = (place: TipPlace, prefs: Prefs, build: TipBuild = TIP_BUILD): Tip | null => {
  if (place === 'today') {
    const shown = (r: TodayRow) => !r.needs || prefs.today[r.needs];
    const works = TODAY_WORKS.filter(shown).map(strip);
    if (!works.length) return null;
    return { place, title: 'Today', works, tracked: TODAY_TRACKED.filter(shown).map(strip) };
  }
  if (place === 'goals')
    return {
      place,
      title: 'Goals',
      works: [{ icon: 'goals', title: 'Today’s goal leads', sub: 'Week, month and year sit further out.' }],
      tracked: [
        { icon: 'check', title: 'Done, partly or missed', sub: 'You say how each goal went.' },
        { icon: 'history', title: 'History keeps them', sub: 'Every goal, and each change you made.' },
      ],
    };
  if (place === 'plan') {
    if (!prefs.fitness) return null;
    return {
      place,
      title: 'Fitness',
      works: [{ icon: 'run', title: 'Today comes first', sub: 'Then the days ahead. Tap one to open it.' }],
      tracked: [
        { icon: 'check', title: 'A session counts when it is done', sub: build.strava ? 'Mark it, log a lift’s sets, or sync a run from Strava.' : 'Mark it done, or log a lift’s sets.' },
        { icon: 'progress', title: 'Progress adds it up', sub: 'Slide along the bars to read one.' },
      ],
    };
  }
  return {
    place,
    title: 'Journal',
    works: [{ icon: 'journal', title: 'One line a day', sub: 'Write more whenever you want to.' }],
    tracked: [{ icon: 'learned', title: 'A day lights when you write', sub: 'A line or an entry. No streak to break.' }],
  };
};

/** Every line a tip shows, for the checks: captions, titles, subs, the buttons. */
export const tipWords = (tip: Tip): string[] => [TIP_EYEBROW, tip.title, TIP_CAPTIONS.tracked, ...[...tip.works, ...tip.tracked].flatMap((r) => (r.sub ? [r.title, r.sub] : [r.title])), TIP_DONE, TIP_TOUR];

// ---------- whether a tip is due ----------

/** How long a tab must have been painted and clear before its tip rises. */
export const TIP_DELAY_MS = 600;

export interface TipMoment {
  /** The path on screen: the active tab's root, or the pushed page over it. */
  path: string;
  prefs: Prefs;
  /** The places whose tip has been seen on this phone. */
  seen: ReadonlySet<TipPlace>;
  /** Sheets, the assistant and menus that are up (`NavState.overlays`). */
  overlays: number;
  /** Something else has the screen: the splash, the hand-off from first run, a skeleton, a field being typed in. */
  busy: boolean;
  /** Setup is being replayed from Settings (a preview: nothing is saved, and nothing is taught). */
  replaying: boolean;
  /** A tip already rose since the last tab change: never two in a row. */
  rose: boolean;
  build?: TipBuild;
}

/**
 * The tip to raise now, or null. One is due when the tab on screen is at its root, has a tip for this account that has
 * not been seen, and nothing else is up: no sheet, assistant or menu, no splash or skeleton, no replay of setup, and no
 * other tip since the last tab change.
 */
export const tipDue = (m: TipMoment): Tip | null => {
  const place = placeOf(m.path);
  if (!place || m.seen.has(place)) return null;
  if (m.overlays > 0 || m.busy || m.replaying || m.rose) return null;
  return tipFor(place, m.prefs, m.build);
};

// ---------- the seen store ----------

/** One key, wiped with the rest of the account's device copy (lib/account.ts removes every `logbook.` key). */
export const TIPS_KEY = 'logbook.tips';

/**
 * What the key holds, read as untrusted: `{ "seen": ["today", "goals"] }`. Anything else (nothing, text that is not JSON,
 * a list, a number, places this build does not have) reads as nothing seen, so a damaged copy shows the tips once more
 * and is then written whole.
 */
export const parseSeen = (raw: string | null | undefined): TipPlace[] => {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    const list: unknown = v && typeof v === 'object' && !Array.isArray(v) ? (v as { seen?: unknown }).seen : null;
    return Array.isArray(list) ? TIP_PLACES.filter((p) => list.includes(p)) : [];
  } catch {
    return [];
  }
};

interface SeenState {
  seen: ReadonlySet<TipPlace>;
  /** A tip rose since the last tab change. */
  rose: boolean;
}
let state: SeenState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

const load = (): SeenState => {
  try {
    return { seen: new Set(parseSeen(localStorage.getItem(TIPS_KEY))), rose: false };
  } catch {
    // no storage to remember in: stay quiet, rather than show every tip on every launch
    return { seen: new Set(TIP_PLACES), rose: false };
  }
};
const save = (seen: ReadonlySet<TipPlace>) => {
  try {
    if (seen.size) localStorage.setItem(TIPS_KEY, JSON.stringify({ seen: TIP_PLACES.filter((p) => seen.has(p)) }));
    else localStorage.removeItem(TIPS_KEY);
  } catch {
    /* private mode: remembered until the page is closed */
  }
};

export const tipsStore = {
  get: (): SeenState => (state ??= load()),
  subscribe: (f: () => void) => {
    subs.add(f);
    return () => void subs.delete(f);
  },
  /** A tip rose over this place: no other rises until the tab changes. */
  rose: () => {
    const s = tipsStore.get();
    if (s.rose) return;
    state = { ...s, rose: true };
    emit();
  },
  /** The place's tip was dismissed (any way): it is not shown again on this phone. */
  markSeen: (place: TipPlace) => {
    const s = tipsStore.get();
    if (!isPlace(place) || s.seen.has(place)) return;
    const seen = new Set(s.seen).add(place);
    state = { ...s, seen };
    save(seen);
    emit();
  },
  /** The tab on screen changed: a tip may rise over the new one. */
  tabChanged: () => {
    const s = tipsStore.get();
    if (!s.rose) return;
    state = { ...s, rose: false };
    emit();
  },
  /** "Show the tips again" (Settings): every tip is due once more, starting with the tab the person goes back to. */
  reset: () => {
    state = { seen: new Set(), rose: false };
    save(state.seen);
    emit();
  },
  /** Tests only: forget what is in memory, so the next read is from storage. */
  forgetForTest: () => {
    state = null;
  },
};
