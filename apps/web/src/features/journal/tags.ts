import { DEFAULT_DAY_TAGS, type DayTagDef, type DayTagsDay, type DayTagStats } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { write } from '@/api/outbox';

/**
 * Day tags (the Journal's day page): a yes or a no per tag per day, and what each tag does to the next day's run once there
 * is enough to say. Marks land in the cache first and go through the outbox, so they work offline.
 */
export const tagKeys = {
  all: ['day-tags'] as const,
  day: (date: string) => ['day-tags', 'day', date] as const,
  stats: ['day-tags', 'stats'] as const,
};

export const useDayTags = (date: string, enabled = true) =>
  useQuery({
    queryKey: tagKeys.day(date),
    queryFn: () => api<DayTagsDay>(`/journal/tags/${date}`),
    staleTime: 60_000,
    enabled,
    // the four defaults paint at once; the stored list and marks replace them
    placeholderData: { date, tags: [...DEFAULT_DAY_TAGS], values: {} },
  });

export const useDayTagStats = (enabled = true) => useQuery({ queryKey: tagKeys.stats, queryFn: () => api<DayTagStats>('/journal/tags/stats'), staleTime: 60_000, enabled });

export const useDayTagMutations = () => {
  const qc = useQueryClient();
  const settle = () => void qc.invalidateQueries({ queryKey: tagKeys.all });
  /** Every loaded day's list of tags, changed in place. */
  const setLists = (fn: (tags: DayTagDef[]) => DayTagDef[]) => {
    for (const [key, d] of qc.getQueriesData<DayTagsDay>({ queryKey: ['day-tags', 'day'] })) if (d) qc.setQueryData<DayTagsDay>(key, { ...d, tags: fn(d.tags) });
  };

  /** Yes, no, or cleared (null). */
  const mark = useMutation({
    mutationFn: async ({ date, tag, value }: { date: string; tag: string; value: boolean | null }) => {
      qc.setQueryData<DayTagsDay>(tagKeys.day(date), (cur) => {
        // tapped before the day loaded: the defaults it was painted with
        const d = cur ?? { date, tags: [...DEFAULT_DAY_TAGS], values: {} };
        const values = { ...d.values };
        if (value === null) delete values[tag];
        else values[tag] = value;
        return { ...d, values };
      });
      await write(`/journal/tags/${date}`, 'PUT', { tag, value }, [tagKeys.all]);
      void qc.invalidateQueries({ queryKey: tagKeys.stats });
    },
    onError: settle,
  });

  const add = useMutation({
    mutationFn: async ({ id, label }: DayTagDef) => {
      setLists((tags) => (tags.some((t) => t.id === id) ? tags : [...tags, { id, label }]));
      await write('/journal/tags', 'POST', { label }, [tagKeys.all]);
      settle();
    },
    onError: settle,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      setLists((tags) => tags.filter((t) => t.id !== id));
      await write(`/journal/tags/${encodeURIComponent(id)}`, 'DELETE', undefined, [tagKeys.all]);
      settle();
    },
    onError: settle,
  });

  return { mark, add, remove };
};
