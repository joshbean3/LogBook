import type { QueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Health, type HealthSyncEvent, type HealthSyncResult } from './health';

/**
 * Apple Health syncing, from the web app's side (docs/health/apple-health.md §3.4). The engine itself runs natively; this
 * starts a run when the app opens or comes back (at most one every 30 seconds, as with Strava), on Sync now, and right after
 * connecting; and it keeps the engine's progress events in a small store the screens and the status pill read.
 */

export const healthStatusKey = ['apple-health', 'status'] as const;

export interface HealthSyncView {
  /** Idle, or what a run is doing now. */
  phase: 'idle' | 'running' | 'importing' | 'done' | 'error';
  /** The month being imported ("Oct 1, 2026"), or the error. */
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
    else if (e.phase === 'progress') set({ ...view, phase: 'importing', detail: e.detail });
  });
};

let lastRun = 0;
let inflight: Promise<HealthSyncResult | null> | null = null;

/** Runs a sync if this phone is connected. Joins one already running; skips if one ran in the last 30 s (unless forced). */
export const healthSyncNow = (qc: QueryClient, reason: 'open' | 'manual' | 'import' = 'open', force = false): Promise<HealthSyncResult | null> => {
  if (!Health) return Promise.resolve(null);
  if (inflight) return inflight;
  if (!force && Date.now() - lastRun < 30_000) return Promise.resolve(null);
  listen();
  const h = Health;
  inflight = (async () => {
    const st = await h.status().catch(() => null);
    if (!st?.connected) return null;
    lastRun = Date.now();
    const r = await h.sync({ reason });
    set({ phase: r.error && r.error !== 'offline' ? 'error' : 'done', detail: r.error, last: { ...r, at: Date.now() } });
    void qc.invalidateQueries({ queryKey: healthStatusKey });
    return r;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
};

/** Words for an engine error. */
export const syncErrorWords = (e: string | undefined) =>
  e === 'locked'
    ? 'Unlock your iPhone to read Apple Health.'
    : e === 'offline'
      ? 'Waiting for a connection. What was read is saved on the phone.'
      : e === 'unauthorized'
        ? 'This phone is no longer connected. Connect again.'
        : e === 'not_connected'
          ? 'Not connected on this phone.'
          : e
            ? `Couldn’t sync: ${e}`
            : null;
