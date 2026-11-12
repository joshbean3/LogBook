import { isISODate, recallDay, type RecallItem, type RecallKind, type RecallState } from '@logbook/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, LONG_TIMEOUT_MS } from '@/api/client';
import { write } from '@/api/outbox';

/**
 * "Remember when" (the top of the Journal tab): today's reminder from a past entry or learning, kept by the server for the
 * day (GET /journal/recall), so every open shows the same one and Claude writes each summary once.
 */
export const recallKey = (date: string) => ['recall', date] as const;

/**
 * Today's item as far as it can be drawn: a kind, an id, a real day, and words to show (the reminder, or the excerpt the
 * plain line is made from). Null for anything else, from the server or from the copy kept on the device: the card reads
 * these fields without asking, and nothing to remember is no card, never a broken page.
 */
export const recallItemOf = (v: unknown): (RecallItem & { ai?: boolean }) | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if ((o.kind !== 'journal' && o.kind !== 'learning') || typeof o.id !== 'string' || !o.id || !isISODate(o.date)) return null;
  const excerpt = typeof o.excerpt === 'string' ? o.excerpt : '';
  const summary = typeof o.summary === 'string' ? o.summary : '';
  if (!excerpt && !summary) return null;
  // no reminder came with it: the entry's own words stand in, and they are nobody's writing but the person's
  const ai = summary ? o.ai : false;
  return { kind: o.kind, id: o.id, date: o.date, excerpt, summary: summary || excerpt, ...(typeof ai === 'boolean' ? { ai } : {}), boosted: o.boosted === true };
};

/* Both calls can wait on the assistant writing the summary, so they get the long limit, not the default 20 s. */

export const useRecall = (date: string) => useQuery({ queryKey: recallKey(date), queryFn: () => api<RecallState>('/journal/recall', { timeoutMs: LONG_TIMEOUT_MS }), staleTime: 5 * 60_000 });

export const useRecallActions = (date: string) => {
  const qc = useQueryClient();
  const key = recallKey(date);
  const set = (s: RecallState) => qc.setQueryData<RecallState>(key, s);

  /** A different one for today (the same one when there is no other). */
  const another = useMutation({
    mutationFn: () => api<RecallState>('/journal/recall/another', { method: 'POST', timeoutMs: LONG_TIMEOUT_MS }),
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
        // a boost answered after "Another" moved on keeps the card where it is
        const cur = qc.getQueryData<RecallState>(key)?.item;
        if (next && (hidden !== undefined || !cur || (cur.kind === kind && cur.id === id))) set(next);
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

// ---------- the plain line, and whether a line is Claude's ----------
const firstSentence = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const s = flat.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? flat;
  if (s.length <= 140) return s;
  const cut = s.slice(0, 139);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 80 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
};
/** How the plain reminder opens, on the server (services/recall.ts `fallbackSummary`) and here: `On Oct 12 you wrote: “`. */
const opening = (it: Pick<RecallItem, 'kind' | 'date'>, today: string) => `On ${recallDay(it.date, today)} you ${it.kind === 'learning' ? 'learned' : 'wrote'}: “`;

/**
 * The plain reminder, made on the device from the card's own excerpt: `On Oct 12 you wrote: “…”`, the entry's first
 * sentence and nothing written by anyone else. What the card shows while the account has not said yes to Claude writing
 * Remember when (Contract 1), whatever line an earlier answer carried.
 */
export const plainLine = (it: Pick<RecallItem, 'kind' | 'date' | 'excerpt'>, today: string): string => `${opening(it, today)}${firstSentence(it.excerpt)}”`;

/**
 * Whether the card's line was written by Claude. The server says so (`ai`) where it does; otherwise the plain line is
 * known by its own opening, which no summary of Claude's starts with (it is told to write to the person, in a sentence).
 */
export const writtenByAi = (it: RecallItem & { ai?: boolean }, today: string): boolean => (typeof it.ai === 'boolean' ? it.ai : !it.summary.startsWith(opening(it, today)));
