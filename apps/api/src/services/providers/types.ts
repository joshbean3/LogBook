import type { Lap } from '@logbook/shared';
import type { providerConnections } from '../../db/schema.js';

export type ProviderId = 'strava' | 'coros';
export const PROVIDER_IDS: readonly ProviderId[] = ['strava', 'coros'];

export type ConnectionRow = typeof providerConnections.$inferSelect;

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: 'not_connected' | 'needs_reauth' | 'rate_limited' | 'unavailable' | 'not_configured',
    public provider: ProviderId | null = null,
  ) {
    super(message);
  }
}

/** What an OAuth exchange or refresh hands back. `athleteId` is the provider's id for the person (the row's unique key). */
export interface ProviderTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  scope: string | null;
  athleteId: string;
  athleteName: string | null;
}

/** One activity as the provider lists it, in the fields the `activities` table keeps. `startLocal` is `YYYY-MM-DDTHH:MM`. */
export interface ProviderActivity {
  externalId: string;
  startLocal: string;
  name: string;
  sportType: string;
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  elevM: number;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  polyline: string | null;
}

/** The per-activity detail: laps and heart rate, when the provider has them. */
export interface ProviderDetail {
  laps: Lap[] | null;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
}

/** A webhook delivery, parsed: one activity changed, or the athlete pulled the plug. */
export type WebhookEvent = { type: 'activity'; aspect: 'create' | 'update' | 'delete'; athleteId: string; externalId: string } | { type: 'deauthorize'; athleteId: string };

/**
 * One integration. `listSince` yields pages of activities that started after `afterUnix` (seconds); it pages until a short
 * page and throws midway on failure, so the engine never treats a partial listing as the whole window.
 */
export interface Provider {
  readonly id: ProviderId;
  readonly name: string;
  readonly configured: boolean;
  authorizeUrl(state: string): string;
  exchange(code: string, scope: string | null): Promise<ProviderTokens>;
  refresh(conn: ConnectionRow): Promise<ProviderTokens>;
  listSince(conn: ConnectionRow, afterUnix: number): AsyncGenerator<ProviderActivity[], void, void>;
  detail(conn: ConnectionRow, externalId: string): Promise<ProviderDetail | null>;
  /** `null` when the delivery is not an event the engine acts on (a verification ping, an unknown shape). */
  parseWebhook(body: unknown, headers: Headers): WebhookEvent[];
  revoke(conn: ConnectionRow): Promise<void>;
  /** Heart-rate zones, for providers that publish them. */
  zones?(conn: ConnectionRow): Promise<Array<{ zone: number; min: number; max: number | null }> | null>;
}
