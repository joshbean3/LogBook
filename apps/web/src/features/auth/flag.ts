import type { QueryClient } from '@tanstack/react-query';
import type { AuthStatus } from '@/api/types';

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

/**
 * Signed out here (Sign out, Delete account): the quiet session query `Authed` reads (`['auth-session']`, App.tsx) says so,
 * and `Authed` does the rest: it drops every other cached query and sends the visitor to `signedOutHome()`. No react-router
 * call from inside the framed app, and no black frame of an empty bootstrap on the way out.
 */
export const markSignedOut = (qc: QueryClient) => qc.setQueryData<AuthStatus>(['auth-session'], (s) => ({ hasAccount: true, setupOpen: false, ...s, signedIn: false }));
