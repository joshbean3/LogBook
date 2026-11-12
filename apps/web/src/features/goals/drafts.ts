import type { GoalLevel } from '@logbook/shared';

/*
 * The words of a goal being written, kept while the app is open. The editor's field lives in a sheet, and a sheet can go
 * away under the words: a flick down, Close by mistake, a save the server refused. The words typed are kept here, per
 * account and per goal (level and period), and the editor starts from them the next time it opens for that goal. They
 * are let go when the goal is saved or the field is emptied. Memory only: nothing is written to the phone.
 */
export interface DraftFor {
  /** The account writing (the bootstrap's user id). */
  user: string | undefined;
  level: GoalLevel;
  period: string;
}

/** The words kept, and the words the goal had when they were typed ('' for a goal not set yet). */
const drafts = new Map<string, { text: string; base: string }>();
const keyOf = ({ user, level, period }: DraftFor) => `${user ?? ''}|${level}|${period}`;

/**
 * What the editor's field starts with: the words kept for this goal, else the goal as it stands, else nothing. Words kept
 * against other words than the goal has now (it was set or changed some other way since) are not offered: the goal as it
 * stands wins.
 */
export const draftOf = (who: DraftFor, initial?: string): string => {
  const kept = drafts.get(keyOf(who));
  return kept && kept.base === (initial ?? '') ? kept.text : (initial ?? '');
};

/** Keep what is in the field. An empty field, or one back to the goal's own words, keeps nothing. */
export const keepDraft = (who: DraftFor, text: string, initial?: string): void => {
  if (!text.trim() || text === (initial ?? '')) drafts.delete(keyOf(who));
  else drafts.set(keyOf(who), { text, base: initial ?? '' });
};

/** The goal was saved: its draft is done with. */
export const dropDraft = (who: DraftFor): void => void drafts.delete(keyOf(who));

/** Forget every draft (tests). */
export const clearDrafts = (): void => drafts.clear();
