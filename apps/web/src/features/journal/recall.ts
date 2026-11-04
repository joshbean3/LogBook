import type { RecallKind, RecallState } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { write } from '@/api/outbox';

/**
 * "Remember when" (the top of the Journal tab): today's reminder from a past entry or learning, kept by the server for the
 * day (GET /journal/recall), so every open shows the same one and Claude writes each summary once.
 */
export const recallKey = (date: string) => ['recall', date] as const;

export const useRecall = (date: string) => useQuery({ queryKey: recallKey(date), queryFn: () => api<RecallState>('/journal/recall'), staleTime: 5 * 60_000 });

export const useRecallActions = (date: string) => {
  const qc = useQueryClient();
  const key = recallKey(date);
  const set = (s: RecallState) => qc.setQueryData<RecallState>(key, s);

  /** A different one for today (the same one when there is no other). */
  const another = useMutation({
    mutationFn: () => api<RecallState>('/journal/recall/another', { method: 'POST' }),
    onSuccess: set,
  });

  /**
   * Boost (shown at once) or hide (the card cross-fades to the server's next one). Un-hiding puts it back as today's.
   */
  const prefs = useMutation({
    mutationFn: async ({ kind, id, boost, hidden }: { kind: RecallKind; id: string; boost?: boolean; hidden?: boolean }) => {
      const before = qc.getQueryData<RecallState>(key);
      if (boost !== undefined) qc.setQueryData<RecallState>(key, (s) => (s?.item && s.item.id === id && s.item.kind === kind ? { ...s, item: { ...s.item, boosted: boost } } : s));
      try {
        const next = await write<RecallState>(`/journal/recall/${kind}/${encodeURIComponent(id)}`, 'PUT', { boost, hidden }, [key]);
        if (next) set(next);
        // queued offline: a hidden one leaves now; the next comes when the write lands and the query refetches
        else if (hidden) qc.setQueryData<RecallState>(key, (s) => (s?.item && s.item.id === id && s.item.kind === kind ? { ...s, item: null } : s));
        return next;
      } catch (e) {
        if (before) set(before);
        throw e;
      }
    },
  });

  return { another, prefs };
};
