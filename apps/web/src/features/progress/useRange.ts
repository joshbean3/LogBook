import { monthOf, type ISODate } from '@logbook/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/api/client';
import { fetchMonth, keys, useAllLifts } from '@/api/queries';
import { routeMissing, walkBackStart } from './historyStart';
import { DEFAULT_RANGE, PROGRESS_RANGES, type ProgressRange } from './ranges';

// ---------- the hero chart's range: a per-viewer convenience, remembered on this device ----------
const RANGE_KEY = 'logbook.progress.range';
const readRange = (): ProgressRange => {
  try {
    const v = localStorage.getItem(RANGE_KEY);
    return PROGRESS_RANGES.includes(v as ProgressRange) ? (v as ProgressRange) : DEFAULT_RANGE;
  } catch {
    return DEFAULT_RANGE;
  }
};
export const useRange = () => {
  const [r, setR] = useState<ProgressRange>(readRange);
  const set = (v: ProgressRange) => {
    setR(v);
    try {
      localStorage.setItem(RANGE_KEY, v);
    } catch {
      /* private mode: this session only */
    }
  };
  return [r, set] as const;
};

// ---------- where history starts (the All range's first day) ----------
/**
 * Where run history starts: one date from the server, null with no runs planned or done. A server without the route (an
 * older deploy) answers 404; then, while `walk` is set (the All range is on show), the months are read back instead.
 */
export const useHistoryStart = (today: ISODate, walk = false) => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['progress', 'history-start'], queryFn: () => api<{ first: string | null }>('/activities/start'), staleTime: 5 * 60_000 });
  const missing = routeMissing(q.error);
  const w = useQuery({
    queryKey: ['progress', 'history-walk', monthOf(today)],
    enabled: missing && walk,
    staleTime: 60 * 60_000,
    queryFn: () => walkBackStart((m) => qc.fetchQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 }), today),
  });
  if (missing && walk) return { first: w.data ?? null, ready: w.isSuccess || w.isError };
  return { first: (missing ? w.data : q.data?.first) ?? null, ready: q.isSuccess || q.isError };
};

/** Where lifting starts: the first day with a logged set. The sets are already on the phone (the Lifts sheet reads them). */
export const useLiftStart = () => {
  const q = useAllLifts();
  const first = useMemo(() => (q.data ?? []).reduce<ISODate | null>((m, x) => (m == null || x.date < m ? x.date : m), null), [q.data]);
  return { first, ready: q.isSuccess || q.isError };
};
