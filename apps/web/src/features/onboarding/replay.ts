/**
 * Replay setup (Settings → App): first run again as a preview, for an account that has already finished it. Nothing is
 * sent: the payoff shows the week the answers would build and says the plan wasn't changed. Per tab (sessionStorage), and
 * cleared when the preview hands off to Today.
 */
export const REPLAY_KEY = 'logbook.onboarding.replay';
const draftKey = (uid: string) => `logbook.onboarding.${uid}`;

export const isReplaying = () => {
  try {
    return sessionStorage.getItem(REPLAY_KEY) === '1';
  } catch {
    return false;
  }
};
/** Start fresh: yesterday's half-finished answers don't carry into a replay. */
export const startReplay = (uid: string) => {
  try {
    sessionStorage.removeItem(draftKey(uid));
    localStorage.removeItem(draftKey(uid));
    sessionStorage.setItem(REPLAY_KEY, '1');
  } catch {
    /* private mode: the replay still runs, from defaults */
  }
};
export const endReplay = () => {
  try {
    sessionStorage.removeItem(REPLAY_KEY);
  } catch {
    /* nothing to clear */
  }
};

