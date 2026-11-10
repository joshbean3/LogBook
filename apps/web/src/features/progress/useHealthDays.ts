import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HealthStatus, ISODate } from '@logbook/shared';
import { useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import { HEALTH_BUILT } from '@/lib/features';
import { healthStatusKey, useHealthSync } from '@/lib/healthSync';
import { healthByDate, healthDaysKey, healthYears, type HealthDay, type HealthLink } from './healthDays';

const NONE: ReadonlyMap<ISODate, HealthDay> = new Map();

/** `&tz=<IANA zone>` (this phone's), so the server puts a night's sleep on the right local day; nothing when unknown. */
const tzParam = (): string => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? `&tz=${encodeURIComponent(tz)}` : '';
  } catch {
    return '';
  }
};

/**
 * The account's daily Apple Health readings over `from`..`to` (`GET /api/apple-health/daily`, Contract 4), by date. They
 * draw whenever the server has days, whether or not this phone is the one that sent them. A call that fails (offline, or a
 * server without the route) reads as no days: the tiles keep their shape and say where things stand.
 *
 * Each answer is held in memory as a Map, on purpose: a Map does not serialise, so even a cache that is written to the
 * phone's storage (which a device backup carries) can never hold a reading. What comes back from such a cache is not a
 * Map, counts as nothing, and is fetched again.
 */
export const useHealthDays = (from: ISODate, to: ISODate): { days: ReadonlyMap<ISODate, HealthDay>; pending: boolean } => {
  const years = useMemo(() => (HEALTH_BUILT ? healthYears(from, to) : []), [from, to]);
  const results = useQueries({
    queries: years.map((y) => ({
      queryKey: healthDaysKey(y.year),
      queryFn: async () => healthByDate([await api<{ days: HealthDay[] }>(`/apple-health/daily?from=${y.from}&to=${y.to}${tzParam()}`)]),
      staleTime: (q: { state: { data?: unknown } }) => (q.state.data instanceof Map ? 60_000 : 0),
      retry: false,
    })),
  });
  // a sync that just finished on this phone brought new days: ask again
  const qc = useQueryClient();
  const synced = useHealthSync().last?.at;
  useEffect(() => {
    if (synced) void qc.invalidateQueries({ queryKey: ['apple-health', 'daily'] });
  }, [synced, qc]);
  const stamp = results.map((r) => `${r.dataUpdatedAt}:${r.data instanceof Map ? r.data.size : '-'}`).join('|');
  const days = useMemo(() => {
    const maps = results.map((r) => r.data).filter((d): d is Map<ISODate, HealthDay> => d instanceof Map);
    if (!maps.length) return NONE;
    if (maps.length === 1) return maps[0]!;
    return new Map(maps.flatMap((m) => [...m]));
  }, [stamp]); // eslint-disable-line react-hooks/exhaustive-deps
  return { days, pending: results.some((r) => r.isPending) };
};

/** Whether a phone is connected for this account (the query Settings reads), and whether this phone is syncing now. */
export const useHealthLink = (): HealthLink => {
  const status = useQuery({ queryKey: healthStatusKey, queryFn: () => api<HealthStatus>('/apple-health/status'), staleTime: 30_000, enabled: HEALTH_BUILT });
  const sync = useHealthSync();
  return { connected: !!status.data?.connected, syncing: sync.phase === 'running' || sync.phase === 'importing' };
};
