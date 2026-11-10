import { monthOf, type Consent, type JournalEntry } from '@logbook/shared';
import { keepPreviousData, useInfiniteQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { api } from '@/api/client';
import { fetchMonth, useBootstrap, useJournalList, useJournalMutations, useMonth, useMonths } from '@/api/queries';
import { useConsent } from '@/lib/consent';
import { claimDrafts } from './drafts';

/**
 * The Journal's own reads and writes, on top of the shared ones in `api/queries.ts` (which this feature imports and never
 * edits):
 *
 *   - `useAiConsent`: the two switches that decide what Remember when and the daily pick may send to Claude.
 *   - `useJournalFeed`: every entry, not only the newest 200. The first page is the shared list (the one every save
 *     patches at once); the pages under it are fetched here with the server's `before` cursor when the list runs out.
 *   - `useJournalDays`: the calendar's days, from the feed and from the month bundles of the months on screen, so a month
 *     far back shows its entries whether or not the list has reached it.
 *   - `useJournalWrites`: the shared writes, which also keep the older pages in step and never reject.
 */

// ---------- consent (Contract 1) ----------
/**
 * What the account allows for the two Journal-side AI flows. Read from the bootstrap (there on the first frame, from the
 * cache) and from the consent record itself, which a change on the Privacy page updates at once. Off until the answer is
 * a recorded yes; the server enforces the same switch on every Claude call.
 */
export const useAiConsent = (): { recall: boolean; reads: boolean } => aiFlags(useConsent().data, useBootstrap().data?.consent);
/** The record itself wins over the bootstrap's copy (it is the one a change updates); anything but a stored yes is off. */
export const aiFlags = (live: Partial<Consent> | null | undefined, boot: Partial<Consent> | null | undefined): { recall: boolean; reads: boolean } => {
  const c = live ?? boot ?? null;
  return { recall: c?.recall === true, reads: c?.reads === true };
};

// ---------- drafts ----------
/** Is there an entry on `date` with exactly these words? Null when the server cannot be asked now. */
export const entryLanded = async (date: string, text: string): Promise<boolean | null> => {
  try {
    const b = await fetchMonth(monthOf(date));
    return b.journal.some((e) => e.date === date && e.text === text);
  } catch {
    return null;
  }
};
/** Every surface that writes a draft says whose it is, so the words the device kept come back to that account only. */
export const useDraftOwner = () => {
  const uid = useBootstrap().data?.user.id;
  useEffect(() => {
    if (uid) claimDrafts(uid, entryLanded);
  }, [uid]);
};

// ---------- every entry ----------
/** `GET /journal`: a page, whether more lie under it, and (Contract 9) how many entries there are in all. */
export interface JournalPage {
  entries: JournalEntry[];
  more: boolean;
  total?: number;
}
/** The shared list asks for this many (`useJournalList`), so a full first page holds exactly this many when more exist. */
export const HEAD_SIZE = 200;
const OLDER = 'journalOlder';

/** Newest day first, newest entry first within a day: the order the server keeps. */
export const journalOrder = (a: JournalEntry, b: JournalEntry) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0) : a.date < b.date ? 1 : -1);

/**
 * The cursor for the page under these: the server's `before` keeps entries created before it. The oldest `createdAt`
 * seen so far always moves back, so a page never repeats and paging always ends. On its own it has one gap: an entry
 * written later for a day older than the page's last day is created after the cursor, so no later page holds it (the
 * calendar still has it, from its month). `pageUnder` therefore also sends the position, which closes the gap on a
 * server that pages by it.
 */
export const cursorOf = (entries: readonly JournalEntry[]): string | null => {
  let min: string | null = null;
  for (const e of entries) if (!e.id.startsWith('tmp-') && (min === null || e.createdAt < min)) min = e.createdAt;
  return min;
};

/** Where the next page starts: `before` for the server as it is, `offset` (how many entries lie above) for one that pages by position. */
export interface PageParam {
  before: string;
  offset: number;
}
/** The page under `above` (everything the server has answered so far, newest first); null when there is nothing to anchor it. */
export const pageUnder = (above: readonly JournalEntry[]): PageParam | null => {
  const before = cursorOf(above);
  return before === null ? null : { before, offset: above.filter((e) => !e.id.startsWith('tmp-')).length };
};
export const pagePath = (p: PageParam) => `/journal?q=&fav=0&limit=${HEAD_SIZE}&before=${encodeURIComponent(p.before)}&offset=${p.offset}`;

/** Lists joined into one, each entry once (the first list that has it wins), in the journal's order. */
export const mergeEntries = (...lists: ReadonlyArray<readonly JournalEntry[]>): JournalEntry[] => {
  const seen = new Set<string>();
  const out: JournalEntry[] = [];
  for (const l of lists)
    for (const e of l) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  return out.sort(journalOrder);
};

/**
 * How many entries the account has. All of them are in the first page when it says there are no more; else the server's
 * `total`, moved by what was added or removed on screen since that answer; null when the server did not say.
 */
export const totalOf = (head: JournalPage | undefined, loaded: number, more: boolean): number | null => {
  if (!head) return null;
  if (!head.more) return head.entries.length;
  if (typeof head.total === 'number') return Math.max(loaded, head.total + (head.entries.length - HEAD_SIZE));
  return more ? null : loaded;
};

export interface JournalFeed {
  /** Every entry loaded so far, newest first. */
  entries: JournalEntry[];
  /** How many there are in all; null while that is not known. */
  total: number | null;
  /** Entries remain on the server under the ones loaded. */
  more: boolean;
  /** Nothing has answered yet. */
  pending: boolean;
  /** The first page failed and nothing is cached. */
  failed: boolean;
  retry: () => void;
  /** The oldest day the feed has reached (every entry from that day on is loaded); null with nothing loaded. */
  reach: string | null;
  loadingOlder: boolean;
  /** Fetch the next page under the ones loaded (no-op when there is none, or one is on its way). */
  loadOlder: () => void;
}

/**
 * The whole journal. `fetchOlder: false` (the default) only reads what is loaded: for a sheet or a card that must not
 * start paging by being open. The Journal's pane passes true and calls `loadOlder` when its list runs out.
 */
export const useJournalFeed = (fetchOlder = false): JournalFeed => {
  const first = useJournalList('', false);
  const head = first.data as JournalPage | undefined;
  const start = head?.more ? pageUnder(head.entries) : null;
  const cursor = start?.before ?? null;
  // how many older pages this screen has asked for: kept across a change of cursor (an entry added or removed moves the
  // first page's edge, and the pages under it are fetched again from the new edge)
  const want = useRef(0);
  const older = useInfiniteQuery({
    queryKey: [OLDER, cursor ?? ''],
    enabled: fetchOlder && !!cursor && want.current > 0,
    initialPageParam: start ?? { before: '', offset: 0 },
    queryFn: ({ pageParam }) => api<JournalPage>(pagePath(pageParam)),
    getNextPageParam: (last, pages): PageParam | undefined => {
      if (!last.more || !start) return undefined;
      const under = pages.flatMap((p) => p.entries);
      const before = cursorOf(under);
      return before === null ? undefined : { before: before < start.before ? before : start.before, offset: start.offset + under.length };
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  const pages = cursor ? older.data?.pages : undefined;
  const loadedPages = older.isPlaceholderData ? 0 : (pages?.length ?? 0);
  const fetching = older.isFetching;
  const hasNext = older.hasNextPage;
  const fetchNext = older.fetchNextPage;
  // after the cursor moved: back to as many pages as were on screen
  useEffect(() => {
    if (!fetchOlder || !cursor || fetching || older.isError) return;
    if (loadedPages > 0 && loadedPages < want.current && hasNext) void fetchNext();
  }, [fetchOlder, cursor, fetching, loadedPages, hasNext, fetchNext, older.isError]);

  const entries = useMemo(() => mergeEntries(head?.entries ?? [], ...(pages ?? []).map((p) => p.entries)), [head, pages]);
  const more = !!head?.more && (!pages?.length || older.isPlaceholderData || hasNext);
  const reach = !head ? null : !more ? '0000-00-00' : (entries.at(-1)?.date ?? null);
  return {
    entries,
    total: totalOf(head, entries.length, more),
    more,
    pending: !head && first.isPending,
    failed: !head && first.isError,
    retry: () => void first.refetch(),
    reach,
    loadingOlder: fetchOlder && fetching && more,
    loadOlder: () => {
      if (!fetchOlder || !cursor || fetching || !more) return;
      want.current = loadedPages + 1;
      void fetchNext();
    },
  };
};

/** The entry as the caches know it now (a favorite, an edit), wherever it was loaded from; `fallback` until one has it. */
export const useLiveEntry = (id: string, fallback: JournalEntry): JournalEntry => {
  const feed = useJournalFeed();
  const month = useMonth(monthOf(fallback.date));
  return feed.entries.find((x) => x.id === id) ?? month.data?.journal.find((x) => x.id === id) ?? fallback;
};

/**
 * The days the calendar draws: the feed's entries and the journal of each month asked for, by date, oldest first within a
 * day. `loading`: one of those months has not answered yet and the feed has not reached it, so a day there is not known
 * to be empty.
 */
export const useJournalDays = (feed: JournalFeed, months: string[]) => {
  // months the feed already covers in full need no request
  const need = useMemo(() => months.filter((m) => feed.reach === null || `${m}-01` <= feed.reach), [months.join(','), feed.reach]); // eslint-disable-line react-hooks/exhaustive-deps
  const { bundles, loading, error } = useMonths(need);
  const byDate = useMemo(() => {
    const all = mergeEntries(feed.entries, ...Object.values(bundles).map((b) => b.journal));
    const m = new Map<string, JournalEntry[]>();
    // oldest first within a day
    for (let i = all.length - 1; i >= 0; i--) {
      const e = all[i]!;
      const day = m.get(e.date);
      if (day) day.push(e);
      else m.set(e.date, [e]);
    }
    return m;
  }, [feed.entries, bundles]);
  return { byDate, loading: feed.pending || (need.length > 0 && loading), failed: feed.failed || (need.length > 0 && !!error && need.some((m) => !bundles[m])) };
};

// ---------- writes ----------
const patchOlder = (qc: QueryClient, fn: (l: JournalEntry[]) => JournalEntry[]) => {
  qc.setQueriesData<InfiniteData<JournalPage>>({ queryKey: [OLDER] }, (d) => (d ? { ...d, pages: d.pages.map((p) => ({ ...p, entries: fn(p.entries) })) } : d));
};
const settled = (p: Promise<unknown>): Promise<boolean> =>
  p.then(
    () => true,
    () => false,
  );

/**
 * The journal's writes for its own screens. Each answers true once the write is saved or queued offline and false when
 * the server refused it (it never rejects, and it answers whether or not the caller is still on screen). The pages under
 * the first, which the shared hook does not know, change with the write and are asked for again after it.
 */
export const useJournalWrites = () => {
  const m = useJournalMutations();
  const qc = useQueryClient();
  const after = (p: Promise<unknown>) =>
    settled(p).then((ok) => {
      void qc.invalidateQueries({ queryKey: [OLDER] });
      return ok;
    });
  return {
    /** Pass the same object to `whenShown` first to hear the commit that shows the entry. */
    add: (vars: { date: string; text: string }) => settled(m.add.mutateAsync(vars)),
    patch: (v: { entry: JournalEntry; text?: string; fav?: boolean }) => {
      patchOlder(qc, (l) => l.map((x) => (x.id === v.entry.id ? { ...x, text: v.text ?? x.text, fav: v.fav ?? x.fav, editedAt: v.text ? new Date().toISOString() : x.editedAt } : x)));
      return after(m.patch.mutateAsync(v));
    },
    remove: (e: JournalEntry) => {
      patchOlder(qc, (l) => l.filter((x) => x.id !== e.id));
      return after(m.remove.mutateAsync(e));
    },
    restore: (e: JournalEntry) => after(m.restore.mutateAsync(e)),
  };
};
