import { useEffect, useState } from 'react';

/** Now, in epoch ms, re-read every `every` ms and when the app comes back to the front: for "Synced 6 m ago". */
export const useNow = (every = 60_000) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, every);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [every]);
  return now;
};
