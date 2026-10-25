import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { stravaSyncNow } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { REFRESH, useToast } from '@/ui';

/**
 * Pull to refresh on Today means "check Strava now" (spec §6.1, contracts §E). The Shell fires `logbook:refresh` (REFRESH)
 * when a pull commits (and the hidden `Check for new runs` button does, for the keyboard and VoiceOver); Today hears it and
 * asks the server to sync through `stravaSyncNow(qc, { force: true })`: the one throttle owner, forced because the owner
 * asked. A run that arrives is drawn by the hero's landing, which plays the one success; nothing plays when nothing arrived.
 */
export const useStravaPull = (connected: boolean) => {
  const qc = useQueryClient();
  const toast = useToast();
  const api = useRef(toast);
  api.current = toast;
  useEffect(() => {
    if (!connected) return;
    const run = () => {
      stravaSyncNow(qc, { force: true }).catch(() => {
        haptics.error();
        api.current('Couldn’t reach Strava. Trying again when you’re online.');
      });
    };
    window.addEventListener(REFRESH, run);
    return () => window.removeEventListener(REFRESH, run);
  }, [connected, qc]);
};
