import type { Learning } from '@logbook/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { api, ApiError } from '@/api/client';
import { useLearningMonths } from '../learned/queries';
import { archiveMonths, monthRowsOf, type MonthRow } from './days';
import type { JournalFeed } from './queries';

/**
 * The archive's months, for the one Journal: lines and entries counted together by month.
 *
 * Three sources, in the order they are trusted (days.ts `archiveMonths`): the two lists on the device (exact, and they
 * follow a save at once), the server's own count of both (`GET /journal/months`), and each list's own months. The
 * server's count is new with the merge: a server from before it answers 404, which is read as "no count" and never as a
 * failed load, so the page works against an older server. There the entries are paged in to their end instead, so a
 * month that holds only entries still has its row.
 */
export const writtenKeys = { months: ['written', 'months'] as const };

/** The server's months, or null from a server that has no such route (or answers something that is not a list). */
export const fetchWrittenMonths = async (): Promise<MonthRow[] | null> => {
  try {
    return monthRowsOf(await api<unknown>('/journal/months'));
  } catch (e) {
    // an older server: no such route. Anything else is a real failure and may be retried
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return null;
    throw e;
  }
};

export interface Archive {
  months: MonthRow[];
  /** Neither list has answered yet. */
  pending: boolean;
  /** A list failed and there is nothing of it to show. */
  failed: boolean;
  fetching: boolean;
  retry: () => void;
}

/**
 * `feed`: the journal's entries (the caller's `useJournalFeed(true)`, so older pages can be asked for). `known`: lines
 * already on the device by month (this month's list, a month just opened), each complete.
 */
export const useArchive = (feed: JournalFeed, known: ReadonlyArray<{ month: string; rows: readonly Learning[] }>): Archive => {
  const qc = useQueryClient();
  const lineMonths = useLearningMonths();
  const server = useQuery({ queryKey: writtenKeys.months, queryFn: fetchWrittenMonths, staleTime: 30_000, retry: 1, retryOnMount: false });
  const entries = feed.entries;
  // the server's count follows the two lists: asked again when either changes (not on the first render)
  const sig = `${(lineMonths.data ?? []).map((m) => `${m.month}:${m.count}`).join(',')}|${entries.length}`;
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (last.current !== null && last.current !== sig) void qc.invalidateQueries({ queryKey: writtenKeys.months });
    last.current = sig;
  }, [sig, qc]);
  // a server with no count of both: the entries are read to their end, a page at a time, so every month is known
  const noCount = server.isSuccess && server.data === null;
  const { more, loadingOlder, loadOlder } = feed;
  useEffect(() => {
    if (noCount && more && !loadingOlder) loadOlder();
  }, [noCount, more, loadingOlder, loadOlder]);
  const lineDays = useMemo(() => new Map(known.map((k) => [k.month, new Set(k.rows.map((l) => l.date))])), [known]);
  const months = useMemo(() => archiveMonths({ lineMonths: lineMonths.data ?? [], entries, reach: feed.reach, lineDays, server: server.data ?? null }), [lineMonths.data, entries, feed.reach, lineDays, server.data]);
  const linesFailed = lineMonths.isError && !lineMonths.data;
  return {
    months,
    pending: (lineMonths.isPending && !lineMonths.isError) || feed.pending,
    failed: linesFailed || feed.failed,
    fetching: lineMonths.isFetching || server.isFetching,
    retry: () => {
      if (linesFailed) void lineMonths.refetch();
      if (feed.failed) feed.retry();
      if (server.isError) void server.refetch();
    },
  };
};
