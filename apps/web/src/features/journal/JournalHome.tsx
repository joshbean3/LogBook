import type * as React from 'react';
import { fmtDate, parseISO, type JournalEntry, type Quote } from '@logbook/shared';
import { EyeOff, PenLine, Search, Share, Star, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDaily, useJournalList, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { EmptyState, IconButton, Pressable, Skeleton, SkeletonGroup, SwipeRow, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import { FavStar } from './FavStar';
import { PressButton } from './PressButton';
import { measureBelow, popFav, useListFlip } from './feel';
import { EntryEditor, entryDay, entryWhen, monthsOf, useEntryActions, useOpenEntry } from './JournalDaySection';
import { runStamp } from './prompt';
import { KSection } from '../goals/Kit';

/** "“…” (Seneca)": how a quote goes into an entry when it is used as a prompt. */
export const asPrompt = (q: Quote) => `“${q.text}”${q.author ? ` (${q.author})` : ''}`;

/**
 * The quote line (contracts §F, docs/feel.md §8): the day's quote as one quiet serif line, 44 tall (15/20 `--ink-3`). Tap:
 * the quote goes to `onInsert` as a prompt (`“…” (Author)`). Hold 450 ms: `Favorite · Hide`; Hide has Undo. No swipe. It
 * sits inside Journal's writer and the Close card's. `date` is the day the line sits on (the quote is the day's, `/daily`).
 * A favorite has no star on the line, so the `toggle` lands when a star's pop would peak (`popFav`). `labelled` (the
 * Journal's writer): the line says what it is ("Today's quote. Tap to use") and the quote may take two lines.
 */
export const QuoteLine = ({ date, onInsert, labelled = false }: { date: string; onInsert: (text: string) => void; labelled?: boolean }): React.JSX.Element | null => {
  const daily = useDaily();
  const { quotePrefs, another } = useJournalMutations();
  const toast = useToast();
  const q = daily.data?.quote ?? null;
  if (!q) return null;
  const items = [
    {
      label: q.fav ? 'Unfavorite' : 'Favorite',
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
    <Pressable className={`qline quote-line ${labelled ? 'is-labelled' : ''}`} press="dim" data-date={date} onPress={() => onInsert(asPrompt(q))} holdMenu={items} menuLabel="Today’s quote" label={`Today’s quote${labelled ? '. Tap to use' : ''}: ${q.text}${q.author ? `, ${q.author}` : ''}${labelled ? '' : '. Use as a prompt'}`}>
      <span className="qline-in">
        {labelled ? (
          <span className="qline-hint" aria-hidden="true">
            Today’s quote. Tap to use
          </span>
        ) : null}
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
/** Search waits for a pause in typing this long, and for this many characters. */
export const SEARCH_WAIT_MS = 250;
export const SEARCH_MIN = 2;

/**
 * Every entry, newest first, edge to edge. The date stands at the left of a day's first entry; a day with a run wears the
 * run's name as a stamp. Tap: the entry. Swipe left: Delete (with Undo). Hold: Edit, Favorite, Share, Delete. The rows come
 * from the cache; with nothing cached, skeleton rows hold the place until the first answer, and a failed first answer
 * says so with Try again. A row that arrives fades in and the rows it displaces ride a FLIP on `settle`; nothing animates
 * height. Search asks the server once typing pauses, from two characters on; the header counts what it found.
 */
export const Timeline = ({
  today,
  all,
  pending,
  failed = false,
  onRetry,
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
  /** The first answer failed and nothing is cached. */
  failed?: boolean;
  onRetry?: () => void;
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
  // what the server is asked for: the field's words once typing pauses, and only from two characters on
  const [needle, setNeedle] = useState('');
  useEffect(() => {
    const v = q.trim();
    const t = setTimeout(() => setNeedle(v.length >= SEARCH_MIN ? v : ''), v ? SEARCH_WAIT_MS : 0);
    return () => clearTimeout(t);
  }, [q]);
  const [limit, setLimit] = useState(PAGE);
  const found = useJournalList(needle, false);
  const list = needle ? (found.data?.entries ?? []) : all;
  const shown = list.slice(0, limit);
  // under the rows on screen: what is loaded and not shown yet, then what the server still holds
  const left = list.length - limit;
  const canFetch = !needle && more && !!onOlder;
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
  const everything = total === null ? `${all.length}+` : String(total);
  // while searching, how many of them say it: "7 of 23"
  const meta = failed || pending ? undefined : needle ? (found.data ? `${list.length}${found.data.more ? '+' : ''} of ${everything}` : undefined) : total === null ? `${all.length}+` : total || undefined;
  const asking = !!needle && !found.data;
  return (
    <KSection
      title="Entries"
      meta={meta}
      className="jtl-sec"
      action={
        all.length > 3 ? (
          <IconButton
            className="bare"
            label={searching ? 'Close search' : 'Search entries'}
            onClick={() => {
              flip.current = measureBelow(head.current);
              if (searching) {
                setQ('');
                setNeedle('');
              }
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
          <input ref={search} className="in" type="search" enterKeyHint="search" placeholder="Search your entries" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} onFocus={(e) => revealField(e.currentTarget)} aria-label="Search entries" />
        </div>
      ) : null}
      {failed ? (
        <div className="k-card jtl-empty jtl-failed" role="alert">
          <EmptyState verb={onRetry ? { label: 'Try again', onPress: onRetry } : undefined}>Couldn’t load your journal.</EmptyState>
        </div>
      ) : pending || asking ? (
        <SkeletonGroup label={asking ? 'Searching your entries' : 'Loading your entries'} className="k-card jtl-skel">
          {[0, 1, 2].map((i) => (
            <div key={i} className="jtl-skel-row">
              <Skeleton w={28} h={22} />
              <div className="jtl-skel-lines">
                <Skeleton w={`${88 - i * 14}%`} h={16} />
                <Skeleton w={`${60 - i * 8}%`} h={16} />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : !all.length ? (
        // the sentence and its verb, no ghost rows: they read as the loading skeleton (review feel F10)
        <div className="k-card jtl-empty">
          <EmptyState verb={{ label: 'Write today’s entry', onPress: onWrite }}>
            Two sentences a day. Every one lands here, newest first.
          </EmptyState>
        </div>
      ) : needle && !list.length && found.data ? (
        // the header's X is the one way out of a search
        <div className="k-card jtl-empty">
          <EmptyState>Nothing you wrote says “{needle}”.</EmptyState>
        </div>
      ) : (
        <div ref={rowsRef} className="jtl k-rows" role="list">
          {shown.map((e, i) => {
            const first = i === 0 || shown[i - 1]!.date !== e.date;
            const stamp = first ? stampOf(e.date) : null;
            return (
              <div key={keyOf(e.id)} data-key={keyOf(e.id)} role="listitem" className={`jtl-item ${first ? 'first' : ''}`}>
                <SwipeRow
                  label={`Entry from ${entryDay(e.date, today)}`}
                  left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.del(e) }}
                  menuItems={[
                    { label: 'Edit', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: entryDay(e.date, today), title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' }) },
                    { label: e.fav ? 'Unfavorite' : 'Favorite', icon: <Star size={18} />, onSelect: () => act.fav(e) },
                    { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
                  ]}
                >
                  <PressButton
                    className="jtl-row"
                    aria-label={`${fmtDate('long', e.date)}, ${entryWhen(e)}${stamp ? `, ${stamp}` : ''}${e.fav ? ', a favorite' : ''}. ${e.text}`}
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
                        <span className="caps">{entryWhen(e)}</span>
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
