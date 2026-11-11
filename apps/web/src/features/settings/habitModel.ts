/** The Habits page's rules, kept free of React so they can be tested. */

type H = { id: string; name: string; archivedOn?: string | null };

/** Today shows two tiles a row: past a dozen the grid stops being a glance. */
export const HABIT_CAP = 12;
export const HABIT_CAP_NOTE = 'Archive one to add another.';
export const HABITS_EMPTY = 'Habits are the tiles on Today. Start with one.';

/** One space between words, at most 80 characters. */
export const cleanName = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 80);

/** Another live habit already called this (any case), or null. `selfId` is the habit being renamed. */
export const sameName = (name: string, habits: H[], selfId?: string): H | null => {
  const n = cleanName(name).toLowerCase();
  return habits.find((h) => h.id !== selfId && !h.archivedOn && h.name.toLowerCase() === n) ?? null;
};

/** Why a habit cannot be renamed to this, or null. */
export const renameProblem = (name: string, habits: H[], selfId: string): string | null => {
  const dupe = sameName(name, habits, selfId);
  return dupe ? `${dupe.name} is already on Today.` : null;
};

/** True when one more live habit would pass the cap. */
export const atCap = (habits: H[]) => habits.filter((h) => !h.archivedOn).length >= HABIT_CAP;

/** "Meditate, Read and 5 more": two names and a count, so the line fits one row at 390 (layout standard 2.9). */
export const habitLine = (names: string[]): string => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`);
