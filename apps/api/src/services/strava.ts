import type { StravaStatus } from '@logbook/shared';
import type { DB } from '../db/index.js';
import { connectionStatus, isSyncing as isSyncingProvider, kindOf, ProviderError, syncConnection, syncZones as syncProviderZones, userForAthlete as ownerOf, type SyncResult } from './providers/index.js';

/**
 * Strava, as the rest of the server has always called it: thin names over the provider engine (`services/providers`).
 * New code should use the engine directly; these keep `routes/core.ts`, `routes/ai.ts` and the tests reading.
 */
export { kindOf };
export const StravaError = ProviderError;
export type StravaError = ProviderError;

export const syncActivities = (db: DB, userId: string, opts: { detailLimit?: number; full?: boolean } = {}): Promise<SyncResult> => syncConnection(db, userId, 'strava', opts);
export const syncZones = (db: DB, userId: string) => syncProviderZones(db, userId, 'strava');
export const isSyncing = (userId: string) => isSyncingProvider(userId, 'strava');

export const stravaStatus = (db: DB, userId: string): StravaStatus => {
  const s = connectionStatus(db, userId, 'strava');
  return { configured: s.configured, connected: s.connected, athleteName: s.athleteName, lastSyncAt: s.lastSyncAt, syncing: s.syncing, error: s.error, status: s.status };
};

/** Owner of a Strava athlete id, for webhook deliveries. */
export const userForAthlete = (db: DB, athleteId: string) => ownerOf(db, 'strava', athleteId);
