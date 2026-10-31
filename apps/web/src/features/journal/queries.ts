import { useQuery } from '@tanstack/react-query';
import type { Activity } from '@logbook/shared';
import { api } from '@/api/client';

/**
 * The run days over a span (the year grid): one read of `/activities?from&to`, which the API already supports. Only the
 * dates are kept, so the grid never holds a year of laps.
 */
export const useRunDays = (from: string, to: string) =>
  useQuery({
    queryKey: ['run-days', from, to],
    queryFn: async () => {
      const acts = await api<Activity[]>(`/activities?from=${from}&to=${to}`);
      return [...new Set(acts.filter((a) => a.kind === 'run').map((a) => a.date))];
    },
    staleTime: 5 * 60_000,
  });
