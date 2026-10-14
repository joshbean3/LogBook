import { useEffect, useState } from 'react';

/** The fake clock is for screenshots and QA: dev builds, or a build made with VITE_FAKE_CLOCK=1. Never in a release build. */
const FAKE_OK = import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK === '1';

/** `?at=6:40` or `?at=18:05` → minutes after midnight, read once at load. */
const fakeStart = (() => {
  if (!FAKE_OK || typeof location === 'undefined') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get('at') ?? '');
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 1440 ? { at: v, t0: Date.now() } : null;
})();

const readMinutes = () => {
  if (fakeStart) return fakeStart.at + (Date.now() - fakeStart.t0) / 60000;
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};

/**
 * The clock of the day in minutes after local midnight, re-read on each minute boundary (and when the app comes back to the
 * front), so "Out the door in 22 min" counts down without a render every second. Dev builds accept `?at=HH:MM`.
 */
export const useNowMinutes = () => {
  const [m, setM] = useState(readMinutes);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = readMinutes();
      setM(now);
      // wake just after the next whole minute
      t = setTimeout(tick, Math.max(250, (Math.floor(now) + 1 - now) * 60000 + 50));
    };
    tick();
    const vis = () => document.visibilityState === 'visible' && setM(readMinutes());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return m;
};
