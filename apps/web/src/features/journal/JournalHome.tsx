import type * as React from 'react';
import { fmtDate, type JournalEntry, type Quote } from '@logbook/shared';
import { CircleAlert, EyeOff, PenLine, Search, Share, Trash2, X } from 'lucide-react';
import { FavoriteIcon, JournalIcon } from '@/ui/icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDaily, useJournalList, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { revealField } from '@/lib/keyboard';
import { DateGutter, IconButton, Pressable, Row, SectionEmpty, Skeleton, SkeletonGroup, SwipeRow, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import { PressButton } from './PressButton';
import { FavStar } from './FavStar';
import { measureBelow, popFav, useListFlip } from './feel';
import { EntryEditor, entryDay, entryWhen, monthsOf, upperFirst, useEntryActions, useOpenEntry } from './JournalDaySection';
import { groupByMonth } from './entryGroups';
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
      icon: <FavoriteIcon size={18} />,
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
 * Every entry, newest first, in one inset group per month (layout standard 2.8, 6.2). Each row is a date-gutter row: the
 * day's numeral and weekday in the 40 px gutter of its first entry (a day's later entries leave it empty), the entry's
 * opening in the journal's voice (Fraunces italic 17/24, at most three lines), then one Dusk line: the time, the run that
 * day, a heart for a favorite. The newest month names itself in the section's meta; older months get a list-page title.
 * Tap: the entry. Swipe left: Delete (with Undo). Hold: Edit, Favorite, Share, Delete. The rows come from the cache; with
 * nothing cached, skeleton rows hold the place until the first answer, and a failed first answer says so with Try again.
 * A row that arrives fades in and the rows it displaces ride a FLIP on `settle`; nothing animates height. Search asks the
 * server once typing pauses, from two characters on; the header counts what it found.
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
  const months = groupByMonth(shown, today);
  // while searching, how many of them say it ("7 of 23"); otherwise the newest month's name, which titles the first group
  const meta = failed || pending ? undefined : needle ? (found.data ? `${list.length}${found.data.more ? '+' : ''} of ${everything}` : undefined) : months[0]?.label;
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
        // a section that failed says so in the section's own form: one row, and the row itself tries again
        <div className="group jtl-empty" role="alert">
          <Row
            left={
              <span className="icon-tile" aria-hidden="true">
                <CircleAlert size={18} />
              </span>
            }
            title="Couldn’t load entries"
            sub={onRetry ? 'Tap to try again.' : 'Check your connection.'}
            onClick={onRetry}
          />
        </div>
      ) : pending || asking ? (
        <SkeletonGroup label={asking ? 'Searching your entries' : 'Loading your entries'} className="group jtl-skel">
          {[0, 1, 2].map((i) => (
            <div key={i} className="lrow jtl-skel-row">
              <span className="jtl-skel-gutter">
                <Skeleton w={20} h={18} />
                <Skeleton w={26} h={12} />
              </span>
              <div className="jtl-skel-lines">
                <Skeleton w={`${88 - i * 14}%`} h={16} />
                <Skeleton w={`${60 - i * 8}%`} h={16} />
              </div>
            </div>
          ))}
        </SkeletonGroup>
      ) : !all.length ? (
        // one row, no button: "Write today's entry" is already the calendar's last row (say it once)
        <SectionEmpty icon={<JournalIcon size={18} />} title="No entries yet" line="They land here, newest first." className="jtl-empty" />
      ) : needle && !list.length && found.data ? (
        // the header's X is the one way out of a search
        <SectionEmpty icon={<Search size={18} />} title="No matches" line={`Nothing you wrote says “${needle}”.`} className="jtl-empty" />
      ) : (
        <div ref={rowsRef} className="jtl-months">
          {months.map((m, mi) => (
            <div key={m.month} className="jtl-month">
              {mi > 0 ? (
                <h3 className="jtl-mhead" data-key={`month:${m.month}`}>
                  {m.label}
                </h3>
              ) : null}
              <div className="group jtl" role="list" aria-label={m.label}>
                {m.entries.map((e, i) => {
                  const first = i === 0 || m.entries[i - 1]!.date !== e.date;
                  const stamp = first ? stampOf(e.date) : null;
                  const when = entryWhen(e);
                  return (
                    <div key={keyOf(e.id)} data-key={keyOf(e.id)} role="listitem" className={`jtl-item ${first ? 'first' : ''}`}>
                      <SwipeRow
                        label={`Entry from ${entryDay(e.date, today)}`}
                        left={{ label: 'Delete', icon: <Trash2 size={20} />, tone: 'bad', onCommit: () => act.del(e) }}
                        menuItems={[
                          { label: 'Edit', icon: <PenLine size={18} />, onSelect: () => sheet.open({ eyebrow: entryDay(e.date, today), title: 'Edit', body: <EntryEditor e={e} />, detent: 'large' }) },
                          { label: e.fav ? 'Unfavorite' : 'Favorite', icon: <FavoriteIcon size={18} />, onSelect: () => act.fav(e) },
                          { label: 'Share', icon: <Share size={18} />, onSelect: () => act.share(e) },
                        ]}
                      >
                        <PressButton
                          className="lrow jtl-row"
                          aria-label={`${fmtDate('long', e.date)}, ${when}${stamp ? `, ${stamp}` : ''}${e.fav ? ', a favorite' : ''}. ${e.text}`}
                          onClick={(ev) => openEntry(e, { from: ev.currentTarget.querySelector('.date-gutter'), stamp: stampOf(e.date) })}
                        >
                          {first ? <DateGutter date={e.date} today={e.date === today} /> : <span className="date-gutter is-empty" aria-hidden="true" />}
                          <span className="jtl-body" aria-hidden="true">
                            <span className="jtl-text">{e.text}</span>
                            <span className="jtl-meta">
                              <span className="jtl-when">{upperFirst(when)}</span>
                              {stamp ? <span className="jtl-stamp">{stamp}</span> : null}
                              <FavStar on={e.fav} size={13} className="jtl-fav" />
                            </span>
                          </span>
                        </PressButton>
                      </SwipeRow>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
