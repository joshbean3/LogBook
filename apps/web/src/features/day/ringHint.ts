/**
 * The hold ring teaches itself (today-top-25): its first tap on this device says "Hold to mark done" instead of opening
 * the session, once. Later taps open the session as before. Kept under a `logbook.` key, so sign out clears it (contract C2).
 */
const KEY = 'logbook.ringHint';
export const RING_HINT = 'Hold to mark done';
export const firstRingTap = (): boolean => {
  try {
    if (localStorage.getItem(KEY) === '1') return false;
    localStorage.setItem(KEY, '1');
    return true;
  } catch {
    return false; // no storage: never nag on every tap
  }
};
