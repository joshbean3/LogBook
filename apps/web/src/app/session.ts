/**
 * The two rules that keep a session's end from turning into a loop (edge cases of sign-in and sign-out). Pure, so they
 * are tested without a screen; App.tsx is their only caller.
 */

/**
 * Does the sign-in page send a visitor on to Today? Only one who is signed in (as far as this page knows), who did not
 * come by a password reset link, and who was not sent here because the server ended the session (`state.signedOut`):
 * what this page knows about the session is then out of date, and sending them back made the app swing between Today
 * and this page for ever, asking the server each time.
 */
export const loginSendsOn = (signedIn: boolean | undefined, search: string, state: unknown): boolean =>
  signedIn === true && !new URLSearchParams(search).has('reset') && !(state && typeof state === 'object' && (state as { signedOut?: unknown }).signedOut === true);

/**
 * A request was answered 401. Is the session really gone? The server is asked (GET /auth/status answers 200 either way):
 * only a clear "still signed in" keeps the person where they are (a 401 that was about something else, a device token);
 * "signed out", or no answer at all, sends them to sign in.
 */
export const sessionEnded = async (ask: () => Promise<{ signedIn?: boolean } | null | undefined>): Promise<boolean> => {
  try {
    return (await ask())?.signedIn !== true;
  } catch {
    return true;
  }
};
