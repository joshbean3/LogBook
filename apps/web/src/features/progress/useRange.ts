import { monthOf, type ISODate } from '@logbook/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { api } from '@/api/client';
import { fetchMonth, keys, useAllLifts } from '@/api/queries';
import { historyStartOf, routeMissing, walkBackStart } from './historyStart';
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
export interface HistoryStart {
  /** The first day with a run, done or on the plan; null with none, or while it is not known. */
  first: ISODate | null;
  /** The answer is in (or cannot be had): the All range can be drawn, or said to have failed. */
  ready: boolean;
  /** Neither the server nor the months read back could say: the All range has no first day to start from. */
  failed: boolean;
  retry: () => void;
}
/**
 * Where run history starts: one date from the server, null with no runs planned or done. When the server does not say (an
 * older deploy answers the route 404; a request can also fail, or the phone can be offline with nothing stored from
 * before), the month bundles, which every server has and the phone keeps, are read back instead: while `walk` is set (the
 * All range is on show, or the last 13 weeks are empty), and from what an earlier walk stored at any time. Only when both
 * fail is the start unknown (`failed`), and the caller says so with a way to ask again: it never draws All from today.
 */
export const useHistoryStart = (today: ISODate, walk = false): HistoryStart => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['progress', 'history-start'], queryFn: () => api<{ first: string | null }>('/activities/start'), staleTime: 5 * 60_000 });
  // the server has not said, and nothing it said before is stored on this phone
  const unsaid = q.data === undefined && q.isError;
  // a route that is not there will not be there on a second ask; any other failure is asked again with the walk
  const gone = routeMissing(q.error);
  const w = useQuery({
    queryKey: ['progress', 'history-walk', monthOf(today)],
    enabled: unsaid && walk,
    staleTime: 60 * 60_000,
    queryFn: () => walkBackStart((m) => qc.fetchQuery({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 }), today),
  });
  const refetchStart = q.refetch;
  const refetchWalk = w.refetch;
  const retry = useCallback(() => {
    if (gone) void refetchWalk();
    else void refetchStart().then((r) => (r.isError ? refetchWalk() : undefined));
  }, [gone, refetchStart, refetchWalk]);
  return { ...historyStartOf({ said: q.data, unsaid, walked: w.data, walkFailed: w.isError, walk }), retry };
};

/** Where lifting starts: the first day with a logged set. The sets are already on the phone (the Lifts sheet reads them). */
export const useLiftStart = () => {
  const q = useAllLifts();
  const first = useMemo(() => (q.data ?? []).reduce<ISODate | null>((m, x) => (m == null || x.date < m ? x.date : m), null), [q.data]);
  return { first, ready: q.isSuccess || q.isError };
};
