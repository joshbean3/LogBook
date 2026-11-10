import { today as realToday } from '@logbook/shared';
import { markSeenToday } from '@/ui/useFirstToday';

// ---------- once a day: the same `logbook.seen.<key>.<date>` marks `useFirstToday` keeps ----------
const seenKey = (key: string) => `logbook.seen.${key}.${realToday()}`;
export const seenToday = (key: string) => {
  try {
    return localStorage.getItem(seenKey(key)) === '1';
  } catch {
    return true; // no storage: stay still rather than replay every time
  }
};

/**
 * The session's one `success` (M18): whichever of a synced run or the hand completes it fires it; the other is silent. Kept
 * apart from the run landing so a build without Strava carries the hand's half only.
 */
export const successKey = (id: string) => `success-${id}`;
export const markSuccess = (id: string) => markSeenToday(successKey(id));
