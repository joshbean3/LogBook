/**
 * `logbook.hasAccount`: set on this device by any successful sign-in or sign-up (and whenever a session opens the app).
 * A cold start without it is a new person, who lands on the promise (/start), never on "Welcome back" (critic B7).
 */
export const HAS_ACCOUNT_KEY = 'logbook.hasAccount';
export const hasAccountHere = () => {
  try {
    return localStorage.getItem(HAS_ACCOUNT_KEY) === '1';
  } catch {
    return false;
  }
};
export const markHasAccount = () => {
  try {
    localStorage.setItem(HAS_ACCOUNT_KEY, '1');
  } catch {
    /* private mode: the promise shows again on the next cold start, which is harmless */
  }
};
/** Where a visitor without a session goes: sign in on a device that has had an account, the promise otherwise. */
export const signedOutHome = () => (hasAccountHere() ? '/login' : '/start');
