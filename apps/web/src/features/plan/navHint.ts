/**
 * Fitness shows one quiet line, once on this device, that says how to reach other weeks and the month ("Swipe for other
 * weeks. Tap the date for the month."): the week arrows and the Week / Month switch are off the surface (guide 6.5a). It
 * goes on the first swipe to another week, the first tap on the date, or a tap on the line. Kept under a `logbook.` key,
 * so sign out clears it (contract C2).
 */
const KEY = 'logbook.fitnessNavHint';
export const navHintSeen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true; // no storage: never show it on every visit
  }
};
export const markNavHintSeen = () => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* no storage */
  }
};
