/**
 * The first time a file or a photo is attached on this phone, the composer says in one line where it goes. Kept under a
 * `logbook.` key (Contract C2), so signing out clears it and the next account is told too.
 */
const KEY = 'logbook.assistant.attachNote';

export const attachNoteSeen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // storage is closed (private mode): say it each time the sheet opens, never skip it
    return false;
  }
};
export const markAttachNoteSeen = (): void => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* kept for this open of the sheet only */
  }
};
