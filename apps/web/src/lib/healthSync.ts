import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api } from '@/api/client';
import { Health, type HealthSyncEvent, type HealthSyncResult } from './health';
import { apiOrigin } from './native';

/**
 * Apple Health syncing, from the web app's side (docs/health/apple-health.md §3.4). The engine itself runs natively; this
 * starts a run when the app opens or comes back (at most one every 30 seconds, as with Strava), on Sync now, and right after
 * connecting; and it keeps the engine's progress events in a small store the screens and the status pill read.
 */

export const healthStatusKey = ['apple-health', 'status'] as const;

export interface HealthSyncView {
  /**
   * Idle, or what a run is doing now. `importing` is no longer sent (the engine reads the three types in one short run);
   * it stays in the type until the screens that still test for it drop it.
   */
  phase: 'idle' | 'running' | 'importing' | 'done' | 'error';
  /** The engine's error code, after a run that failed. */
  detail?: string;
  /** The last finished run. */
  last?: HealthSyncResult & { at: number };
}

let view: HealthSyncView = { phase: 'idle' };
const subs = new Set<() => void>();
const set = (v: HealthSyncView) => {
  view = v;
  subs.forEach((f) => f());
};
export const useHealthSync = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => view,
    () => view,
  );

let listening = false;
const listen = () => {
  if (listening || !Health) return;
  listening = true;
  void Health.addListener('healthSync', (e: HealthSyncEvent) => {
    if (e.phase === 'start') set({ ...view, phase: 'running', detail: undefined });
  });
};

let lastRun = 0;
let inflight: Promise<HealthSyncResult | null> | null = null;

/** Is an account signed in here? The cached bootstrap says (a 401 and Sign out both remove it). */
const signedIn = (qc: QueryClient) => !!qc.getQueryData<{ user?: { id?: string } }>(['bootstrap'])?.user?.id;

/**
 * Runs a sync if this phone is connected. Joins one already running; skips if one ran in the last 30 s (unless forced).
 *
 * Never while signed out: the phone's engine keeps its own token, so without this check it would go on reading Apple Health
 * for an account that has left. And on an automatic run (the app opening or coming back), the account's own answer is
 * asked first: when the server says this account is not connected while the phone still is (it was disconnected elsewhere,
 * or the phone's token belongs to an account that was here before), the phone is disconnected and nothing is read.
 */
export const healthSyncNow = (qc: QueryClient, reason: 'open' | 'manual' | 'import' = 'open', force = false): Promise<HealthSyncResult | null> => {
  if (!Health) return Promise.resolve(null);
  if (!signedIn(qc)) return Promise.resolve(null);
  if (inflight) return inflight;
  if (!force && Date.now() - lastRun < 30_000) return Promise.resolve(null);
  listen();
  const h = Health;
  inflight = (async () => {
    const st = await h.status().catch(() => null);
    if (!st?.connected) return null;
    if (reason === 'open') {
      // no answer (offline, a server error) is not a no: the run goes on and the engine queues what it reads
      const server = await api<{ connected?: boolean }>('/apple-health/status').catch(() => null);
      if (server) qc.setQueryData(healthStatusKey, server);
      if (server && server.connected === false) {
        await h.disconnect().catch(() => undefined);
        set({ phase: 'idle' });
        return null;
      }
      if (!signedIn(qc)) return null;
    }
    lastRun = Date.now();
    // the engine sends to this origin, over the copy saved at connect (ios-14)
    const r = await h.sync({ reason, apiOrigin });
    // a run stopped by a disconnect or a new connect (`cancelled`) has nothing to say; being offline is not an error
    set({ phase: r.error && r.error !== 'offline' && r.error !== 'cancelled' ? 'error' : 'done', detail: r.error, last: { ...r, at: Date.now() } });
    void qc.invalidateQueries({ queryKey: healthStatusKey });
    return r;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
};

/** Apple Health's state on this phone did not read back (`corrupt`): the fix is Disconnect, then Connect. */
export const RECONNECT_WORDS = 'Apple Health needs to be connected again on this phone.';

/** Words for an engine error, or null when there is nothing to say (none, or a run that was `cancelled`). */
export const syncErrorWords = (e: string | undefined): string | null => {
  if (!e || e === 'cancelled') return null;
  if (e === 'corrupt') return RECONNECT_WORDS;
  if (e === 'locked') return 'Unlock your iPhone to read Apple Health.';
  if (e === 'offline') return 'Waiting for a connection. What was read is saved on the phone.';
  if (e === 'unauthorized') return 'This phone is no longer connected. Connect again.';
  if (e === 'not_connected') return 'Not connected on this phone.';
  return `Couldn’t sync: ${e}`;
};
