import { useQueries, useQueryClient } from '@tanstack/react-query';
import type * as React from 'react';
import { useCallback } from 'react';
import { fetchMonth, keys } from '@/api/queries';
import { Button } from '@/ui/primitives';

/**
 * Whether any of these months failed to load and has nothing to show (a first open with no connection, or a server
 * error). The same queries `useLog` runs, read again here for their error state: a month that is in the stored cache, or
 * that loaded once, never counts. `retry` asks for the failed ones again.
 */
export const useMonthsFailed = (months: string[]): { failed: boolean; retry: () => void } => {
  const qc = useQueryClient();
  const results = useQueries({ queries: months.map((m) => ({ queryKey: keys.month(m), queryFn: () => fetchMonth(m), staleTime: 30_000 })) });
  const failed = results.some((r) => r.isError && !r.data);
  const key = months.join(',');
  const retry = useCallback(() => {
    for (const m of key.split(',')) if (m) void qc.refetchQueries({ queryKey: keys.month(m) });
  }, [qc, key]);
  return { failed, retry };
};

/** In place of a skeleton that would never fill: what did not load, and Retry. */
export const LoadFail = ({ what, onRetry, className = '' }: { what: string; onRetry: () => void; className?: string }): React.JSX.Element => (
  <div className={`card pl-fail ${className}`.trim()} role="alert">
    <span className="pl-fail-t">{what}</span>
    <Button variant="soft" size="sm" onClick={onRetry}>
      Retry
    </Button>
  </div>
);
