import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { keys, useStravaCheck } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useToast } from '@/ui';

/** A window event a pull to refresh may fire (requested of the Shell; see REVIEW.md). Listened for here already. */
export const REFRESH_EVENT = 'logbook:refresh';
const GAP_MS = 30_000;

/**
 * Pull to refresh on Today means "check Strava now". The Shell's pull refetches the bootstrap; Today hears that (an
 * invalidation of the bootstrap query, or a `logbook:refresh` event) and asks the server to sync. A run that arrives is
 * drawn by the hero, which plays the one Success; nothing plays when nothing arrived. At most one check per 30 s.
 */
export const useStravaPull = (connected: boolean) => {
  const qc = useQueryClient();
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
    const unsub = qc.getQueryCache().subscribe((e) => {
      if (e.type === 'updated' && e.action.type === 'invalidate' && e.query.queryKey[0] === keys.bootstrap[0]) run();
    });
    window.addEventListener(REFRESH_EVENT, run);
    return () => {
      unsub();
      window.removeEventListener(REFRESH_EVENT, run);
    };
  }, [connected, qc]);
};
