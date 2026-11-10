import type * as React from 'react';
import { fmtDate, parseISO, type JournalEntry, type Quote } from '@logbook/shared';
import { EyeOff, PenLine, Search, Share, Star, Trash2, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useDaily, useJournalList, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { EmptyState, IconButton, Pressable, Skeleton, SkeletonGroup, SwipeRow, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import { FavStar } from './FavStar';
import { PressButton } from './PressButton';
import { measureBelow, popFav, useListFlip } from './feel';
import { EntryEditor, monthsOf, timeOf, useEntryActions, useOpenEntry } from './JournalDaySection';
import { runStamp } from './prompt';
import { KSection } from '../goals/Kit';

/** "“…” (Seneca)": how a quote goes into an entry when it is used as a prompt. */
export const asPrompt = (q: Quote) => `“${q.text}”${q.author ? ` (${q.author})` : ''}`;

/**
 * The quote line (contracts §F, docs/feel.md §8): the day's quote as one quiet serif line, 44 tall (15/20 `--ink-3`). Tap:
 * the quote goes to `onInsert` as a prompt (`“…” (Author)`). Hold 450 ms: `Favourite · Hide`; Hide has Undo. No swipe. It
 * sits inside Journal's composer and the Close card's. `date` is the day the line sits on (the quote is the day's, `/daily`).
 * Favouriting has no star on the line, so the `toggle` lands when a star's pop would peak (`popFav`).
 */
export const QuoteLine = ({ date, onInsert }: { date: string; onInsert: (text: string) => void }): React.JSX.Element | null => {
  const daily = useDaily();
  const { quotePrefs, another } = useJournalMutations();
  const toast = useToast();
  const q = daily.data?.quote ?? null;
  if (!q) return null;
  const items = [
    {
      label: q.fav ? 'Unfavourite' : 'Favourite',
      icon: <Star size={18} />,
      onSelect: () => {
        if (!q.fav) popFav();
        quotePrefs.mutate({ id: q.id, fav: !q.fav });
      },
    },
    ...(q.mine
      ? []
      : [
          {
            label: 'Hide',
            icon: <EyeOff size={18} />,
            destructive: true,
            onSelect: () => {
              haptics.delete();
              quotePrefs.mutate({ id: q.id, hidden: true });
              another.mutate('quote');
              toast('You won’t see that quote again', { label: 'Undo', fn: () => quotePrefs.mutate({ id: q.id, hidden: false }) });
            },
          },
        ]),
  ];
  return (
    <Pressable className="qline quote-line" press="dim" data-date={date} onPress={() => onInsert(asPrompt(q))} holdMenu={items} menuLabel="Today’s quote" label={`Today’s quote: ${q.text}${q.author ? `, ${q.author}` : ''}. Use as a prompt`}>
      <span className="qline-in">
        <span className="qline-text">“{q.text}”</span>
      </span>
    </Pressable>
  );
};

/** A provisional id that the server replaces keeps its row (and its key), so the row doesn't leave and come back. */
const useStableKeys = (entries: JournalEntry[]) => {
  const keys = useRef(new Map<string, string>());
  const prev = useRef<JournalEntry[]>([]);
  const gone = prev.current.filter((p) => p.id.startsWith('tmp-') && !entries.some((e) => e.id === p.id));
  for (const e of entries) {
    if (keys.current.has(e.id)) continue;
    const was = gone.find((g) => g.text === e.text && g.date === e.date);
    keys.current.set(e.id, was ? (keys.current.get(was.id) ?? was.id) : e.id);
  }
  prev.current = entries;
  return (id: string) => keys.current.get(id) ?? id;
};

const PAGE = 30;
/**
 * Every entry, newest first, edge to edge. The date stands at the left of a day's first entry; a day with a run wears the
 * run's name as a stamp. Tap: the entry. Swipe left: Delete (with Undo). Hold: Edit, Favourite, Share, Delete. The rows come
 * from the cache; the skeleton shows only with nothing cached and no network (newuser 3.5). A row that arrives fades in and
 * the rows it displaces ride a FLIP on `settle`; nothing animates height.
 */
export const Timeline = ({
  today,
  all,
  pending,
  onWrite,
  total = all.length,
  more = false,
  loadingOlder = false,
  onOlder,
}: {
  today: string;
  /** Every entry loaded so far. */
  all: JournalEntry[];
  pending: boolean;
  onWrite: () => void;
  /** How many entries there are in all; null while entries remain on the server and it has not said. */
  total?: number | null;
  /** Entries remain on the server under `all`; `onOlder` fetches the next page of them. */
  more?: boolean;
  loadingOlder?: boolean;
  onOlder?: () => void;
}) => {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const found = useJournalList(q.trim(), false);
  const list = q.trim() ? (found.data?.entries ?? []) : all;
  const shown = list.slice(0, limit);
  // under the rows on screen: what is loaded and not shown yet, then what the server still holds
  const left = list.length - limit;
  const canFetch = !q.trim() && more && !!onOlder;
  const older = () => {
    setLimit((l) => l + PAGE);
    // the next page is asked for a tap before the loaded rows run out, so "Show older" rarely waits
    if (canFetch && left <= PAGE) onOlder();
  };
  const log = useLog(monthsOf(shown.map((e) => e.date)));
  const keyOf = useStableKeys(shown);
  const act = useEntryActions();
  const openEntry = useOpenEntry();
  const sheet = useSheet();
  const search = useRef<HTMLInputElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const flip = useRef<(() => void) | null>(null);
  // the field's carry first, then the list's FLIP (review 2 code N6): layout effects run in the order they are declared, so
  // when Close removes the field and the list changes in one commit, the rows measure where they are with the container
  // already carried, and each is carried only by its own move (not by the field's height twice)
  useLayoutEffect(() => {
    flip.current?.();
    flip.current = null;
  }, [searching]);
  useListFlip(rowsRef, shown.map((e) => keyOf(e.id)).join(','));
  const stampOf = (d: string) => (log.loaded(d) ? runStamp(log.snap, d) : null);
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  return (
    <KSection
      title="Entries"
      meta={total === null ? `${all.length}+` : total || undefined}
      className="jtl-sec"
      action={
        all.length > 3 ? (
          <IconButton
            className="bare"
            label={searching ? 'Close search' : 'Search entries'}
            onClick={() => {
              flip.current = measureBelow(head.current);
              if (searching) setQ('');
              setSearching((s) => !s);
              if (!searching) requestAnimationFrame(() => search.current?.focus());
            }}
          >
            {searching ? <X size={20} /> : <Search size={20} />}
          </IconButton>
        ) : undefined
      }
    >
      <div ref={head} className="jtl-anchor" aria-hidden="true" />
      {searching ? (
        <div className="jtl-search fade-in">
          <input ref={search} className="in" type="search" placeholder="Search your entries" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} onFocus={(e) => revealField(e.currentTarget)} aria-label="Search entries" />
        </div>
      ) : null}
      {pending ? (
        offline ? (
          <SkeletonGroup label="Loading your entries" className="jtl-skel">
            {[0, 1, 2].map((i) => (
              <div key={i} className="jtl-skel-row">
                <Skeleton w={28} h={22} />
                <div style={{ display: 'grid', gap: 8, flex: 1 }}>
                  <Skeleton w={`${88 - i * 14}%`} h={16} />
                  <Skeleton w={`${60 - i * 8}%`} h={16} />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        ) : null
      ) : !all.length ? (
        // the sentence and its verb, no ghost rows: they read as the loading skeleton (review feel F10)
        <div className="k-card jtl-empty">
          <EmptyState verb={{ label: 'Write today’s', onPress: onWrite }}>
            Two sentences a day. Every one lands here, newest first.
          </EmptyState>
        </div>
      ) : q.trim() && !list.length && !found.isPending ? (
        <div className="k-card jtl-empty">
          <EmptyState verb={{ label: 'Clear the search', onPress: () => setQ('') }}>Nothing you wrote says “{q.trim()}”.</EmptyState>
        </div>
      ) : (
        <div ref={rowsRef} className="jtl k-rows" role="list">
          {shown.map((e, i) => {
            const first = i === 0 || shown[i - 1]!.date !== e.date;
            const stamp = first ? stampOf(e.date) : null;
            return (
              <div key={keyOf(e.id)} data-key={keyOf(e.id)} role="listitem" className={`jtl-item ${first ? 'first' : ''}`}>
                <SwipeRow
                  label={`Entry from ${fmtDate('short', e.date)}`}
                  left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.del(e) }}
                  menuItems={[
                    { label: 'Edit', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: fmtDate('short', e.date), title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' }) },
                    { label: e.fav ? 'Unfavourite' : 'Favourite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
                    { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
                  ]}
                >
                  <PressButton
                    className="jtl-row"
                    aria-label={`${fmtDate('long', e.date)}, ${timeOf(e.createdAt)}${stamp ? `, ${stamp}` : ''}${e.fav ? ', favourite' : ''}. ${e.text}`}
                    onClick={(ev) => openEntry(e, { from: ev.currentTarget.querySelector('.jtl-date-shared'), stamp: stampOf(e.date) })}
                  >
                    <span className="jtl-date" aria-hidden="true">
                      {first ? (
                        <span className="jtl-date-shared">
                          <span className="jtl-day">{parseISO(e.date).getDate()}</span>
                          <span className="caps">{e.date === today ? 'Today' : fmtDate('dow', e.date)}</span>
                        </span>
                      ) : null}
                    </span>
                    <span className="jtl-body" aria-hidden="true">
                      <span className="jtl-text">{e.text}</span>
                      <span className="jtl-meta">
                        {first && e.date.slice(0, 7) !== today.slice(0, 7) ? <span className="caps">{e.date.slice(0, 4) !== today.slice(0, 4) ? fmtDate('month', e.date) : fmtDate('monthShort', e.date)}</span> : null}
                        <span className="caps">{timeOf(e.createdAt)}</span>
                        {stamp ? <span className="jstamp">{stamp}</span> : null}
                        <FavStar on={e.fav} />
                      </span>
                    </span>
                  </PressButton>
                </SwipeRow>
              </div>
            );
          })}
        </div>
      )}
      {left > 0 || canFetch ? (
        <button type="button" className="pill-row jtl-more" onClick={older} disabled={left <= 0 && loadingOlder} aria-busy={(left <= 0 && loadingOlder) || undefined}>
          {left > 0 ? `Show ${Math.min(PAGE, left)} older` : loadingOlder ? 'Loading older entries' : 'Show older'}
        </button>
      ) : null}
    </KSection>
  );
};
