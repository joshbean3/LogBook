import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/api/client';
import { DEFAULT_RANGE, PROGRESS_RANGES, type ProgressRange } from './ranges';

// ---------- the running chart's range: a per-viewer convenience, remembered on this device ----------
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

/** Where run history starts (the All range's first day): one date from the server, null with no runs planned or done. */
export const useHistoryStart = () => {
  const q = useQuery({ queryKey: ['progress', 'history-start'], queryFn: () => api<{ first: string | null }>('/activities/start'), staleTime: 5 * 60_000 });
  return { first: q.data?.first ?? null, ready: q.isSuccess || q.isError };
};
