import { useEffect, useRef } from 'react';
import { useStravaCheck } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { REFRESH, useToast } from '@/ui';

const GAP_MS = 30_000;

/**
 * Pull to refresh on Today means "check Strava now". The Shell fires `logbook:refresh` (REFRESH) when a pull commits, then
 * refetches the months and the bootstrap; Today hears the event and asks the server to sync. A run that arrives is drawn by
 * the hero, which plays the one Success; nothing plays when nothing arrived. At most one check per 30 s.
 */
export const useStravaPull = (connected: boolean) => {
  const check = useStravaCheck();
  const toast = useToast();
  const last = useRef(0);
  const api = useRef({ check, toast });
  api.current = { check, toast };
  useEffect(() => {
    if (!connected) return;
    const run = () => {
      const { check: c, toast: t } = api.current;
      if (Date.now() - last.current < GAP_MS || c.isPending) return;
      last.current = Date.now();
      c.mutate(undefined, {
        onError: () => {
          haptics.error();
          t('Couldn’t reach Strava. Trying again when you’re online.');
        },
      });
    };
    window.addEventListener(REFRESH, run);
    return () => window.removeEventListener(REFRESH, run);
  }, [connected]);
};
