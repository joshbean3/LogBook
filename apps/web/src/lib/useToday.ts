import { today } from '@logbook/shared';
import { useEffect, useState } from 'react';

/** Today's date, which rolls over while the app stays open. */
export const useToday = () => {
  const [t, setT] = useState(today);
  useEffect(() => {
    const check = () => {
      const n = today();
      setT((cur) => (cur === n ? cur : n));
    };
    const iv = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return t;
};

export const useMedia = (q: string) => {
  const [m, setM] = useState(() => (typeof matchMedia !== 'undefined' ? matchMedia(q).matches : false));
  useEffect(() => {
    const mq = matchMedia(q);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    fn();
    return () => mq.removeEventListener('change', fn);
  }, [q]);
  return m;
};
