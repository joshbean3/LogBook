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

/**
 * First run on every fresh install of the iOS app. Deleting the app deletes its WebView storage, so a missing mark means
 * this copy of the app has never shown setup; an update keeps storage, so it stays quiet. An account that already has a
 * plan runs setup as a replay (nothing saved, the plan untouched). The web never asks: a browser has no install.
 */
export const INSTALL_KEY = 'logbook.install.setupShown';
export const installSetupDue = (native: boolean) => {
  if (!native) return false;
  try {
    return localStorage.getItem(INSTALL_KEY) !== '1';
  } catch {
    return false;
  }
};
export const markInstallSetupShown = () => {
  try {
    localStorage.setItem(INSTALL_KEY, '1');
  } catch {
    /* private mode: asks again next launch, which is the safer miss */
  }
};

/*
 * Settled once, at launch, before sign-in writes anything: a copy that already holds Logbook data is an update from a build
 * before this mark existed (stay quiet); an empty one is a fresh install (leave the mark unset, so setup runs).
 */
(() => {
  try {
    if (typeof localStorage === 'undefined' || localStorage.getItem(INSTALL_KEY) === '1') return;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== INSTALL_KEY && k.startsWith('logbook')) return markInstallSetupShown();
    }
  } catch {
    /* no storage: nothing to settle */
  }
})();
