import type * as React from 'react';
import type { JournalEntry, Learning } from '@logbook/shared';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTabScroller } from '@/app/NavController';
import { useJournalList } from '@/api/queries';
import { Button } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { KSection } from '../goals/Kit';
import { dayWords, Line, LoadError, monthName, useLoadMore } from '../learned/LearnedParts';
import { rowsOf, useLearnings } from '../learned/queries';
import { mergeFound } from './days';
import { EntryRow } from './JournalParts';

/* Search, over lines and entries together: the magnifier at the end of the nav bar, the field, and what it finds by day. */

/** Typing settles for 250 ms before it searches. */
export const useSettled = (v: string, ms = 250): string => {
  const [out, setOut] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setOut(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return out;
};

export const Searching = (): React.JSX.Element => (
  <SkeletonGroup label="Searching" className="k-card ln-more">
    <Skeleton w="40%" h={12} />
    <Skeleton w="85%" h={20} />
  </SkeletonGroup>
);

/** A day's caption in a search: Today, Yesterday, else the weekday and the date; the year too when it is not this one. */
const foundDay = (date: string, today: string) => `${dayWords(date, today)}${date.slice(0, 4) === today.slice(0, 4) ? '' : `, ${date.slice(0, 4)}`}`;

/**
 * What the search found, in lines and in entries, as one list by day: a section per month, its days in one card, each
 * day its lines and then its entries with the match marked. The two lists are asked side by side. Either may fail alone:
 * the other's results still show, and one Try again asks for what is missing.
 */
export const Found = ({ q, today, onOpenLine, onOpenEntry }: { q: string; today: string; onOpenLine: (l: Learning) => void; onOpenEntry: (e: JournalEntry) => void }): React.JSX.Element => {
  const lines = useLearnings({ q });
  const found = useJournalList(q, false);
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, lines);
  const lineRows = useMemo(() => rowsOf(lines.data), [lines.data]);
  const entryRows = found.data?.entries;
  const months = useMemo(() => mergeFound(lineRows, entryRows ?? []), [lineRows, entryRows]);
  const linesFailed = lines.isError && !lines.data;
  const entriesFailed = found.isError && !found.data;
  const retry = () => {
    if (linesFailed) void lines.refetch();
    if (entriesFailed) void found.refetch();
    if (lines.isFetchNextPageError) void lines.fetchNextPage();
  };
  const busy = lines.isFetching || found.isFetching;
  // a failed search is not "no matches"
  if (linesFailed && entriesFailed) return <LoadError title="Couldn’t search your journal." onRetry={retry} busy={busy} />;
  // one list still on its way: nothing is said yet about what it holds (the other's results would jump when it lands)
  if ((lines.isPending && !linesFailed) || (found.isPending && !entriesFailed)) return <Searching />;
  const partly = linesFailed || entriesFailed || lines.isFetchNextPageError;
  if (!months.length && !partly)
    return (
      <section className="k-card ln-none">
        <p className="k-row-title">No matches</p>
        <p className="k-foot">Nothing you wrote matches “{q}”.</p>
      </section>
    );
  return (
    <div className="ln-past">
      {months.map((m) => (
        <KSection key={m.month} title={`${monthName(m.month)} ${m.month.slice(0, 4)}`} className="ln-month">
          <div className="k-card ln-days">
            {m.days.map((d) => (
              <div key={d.date} className="ln-day jn-fday">
                <span className="caps ln-day-caps">{foundDay(d.date, today)}</span>
                {d.lines.map((l) => (
                  <Line key={l.id} item={l} onOpen={onOpenLine} mark={q} />
                ))}
                {d.entries.map((e) => (
                  <EntryRow key={e.id} e={e} onOpen={onOpenEntry} q={q} className="is-inset" />
                ))}
              </div>
            ))}
          </div>
        </KSection>
      ))}
      {found.data?.more ? <p className="k-foot jn-found-more">More entries match than fit here. Add a word to narrow it.</p> : null}
      {/* one list failed, or the next page of lines did: it is not asked for again on its own (that would never stop) */}
      {partly ? <LoadError title={entriesFailed ? 'Couldn’t search your entries.' : linesFailed ? 'Couldn’t search your lines.' : 'Couldn’t load the rest.'} onRetry={retry} busy={busy} /> : <div ref={end} className="ln-end" aria-hidden="true" />}
    </div>
  );
};

/**
 * The search field's place and focus. With the keyboard up the room for results is between the field and the keyboard, so
 * on focus the field goes to the top of the scroller, just under the nav bar (not to the keyboard's edge), and it is held
 * there when the first letter takes the poster and the archive away (and when clearing brings them back). The
 * keyboard's Search key blurs the field, and so does the first drag or wheel of the page while it is focused. A tap on a
 * result is left alone: the sheet it opens takes the focus.
 */
export const useSearchField = (searching: boolean) => {
  const scroller = useTabScroller();
  const box = useRef<HTMLLabelElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pin = useCallback(
    (smooth: boolean) => {
      const sc = scroller.current;
      const el = box.current;
      if (!sc || !el) return;
      const bar = sc.querySelector<HTMLElement>('.nb-bar');
      const under = (bar ? bar.getBoundingClientRect().bottom : sc.getBoundingClientRect().top) + 8;
      const by = el.getBoundingClientRect().top - under;
      if (Math.abs(by) >= 1) sc.scrollBy({ top: by, behavior: smooth ? 'smooth' : 'auto' });
    },
    [scroller],
  );
  const was = useRef(searching);
  useLayoutEffect(() => {
    if (was.current === searching) return;
    was.current = searching;
    pin(false);
  }, [searching, pin]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const sc = scroller.current;
    if (!focused || !sc) return;
    const blur = (e: Event) => {
      if (e.target instanceof Node && box.current?.contains(e.target)) return;
      input.current?.blur();
    };
    sc.addEventListener('touchmove', blur, { passive: true });
    sc.addEventListener('wheel', blur, { passive: true });
    return () => {
      sc.removeEventListener('touchmove', blur);
      sc.removeEventListener('wheel', blur);
    };
  }, [focused, scroller]);
  return {
    box,
    input,
    onFocus: () => {
      setFocused(true);
      clearTimeout(timer.current);
      // after the keyboard's 250 ms, when the page has its room under it
      timer.current = setTimeout(() => pin(true), 250);
    },
    onBlur: () => {
      setFocused(false);
      clearTimeout(timer.current);
    },
    onSubmit: (e: React.FormEvent) => {
      e.preventDefault();
      input.current?.blur();
    },
  };
};

/** The search's way in: a bare 44 pt Deep Sky magnifier at the end of the nav bar, on the page once anything is written. */
export const SearchButton = ({ onPress }: { onPress: () => void }): React.JSX.Element => (
  <button type="button" className="icon-btn bare ln-search-btn" aria-label="Search your journal" title="Search your journal" onClick={onPress}>
    <Search size={18} aria-hidden="true" />
  </button>
);

/** The field itself, with its clear button and Cancel. */
export const SearchField = ({ q, onQ, onCancel, search }: { q: string; onQ: (q: string) => void; onCancel: () => void; search: ReturnType<typeof useSearchField> }): React.JSX.Element => (
  <form role="search" className="ln-search-form" onSubmit={search.onSubmit}>
    <label className="ln-search" ref={search.box}>
      <Search size={18} aria-hidden="true" className="ln-search-icon" />
      <input ref={search.input} className="ln-search-in" type="search" enterKeyHint="search" maxLength={100} placeholder="Search lines and entries" aria-label="Search your journal" value={q} autoFocus onChange={(e) => onQ(e.target.value)} onFocus={search.onFocus} onBlur={search.onBlur} />
      {q ? (
        <button type="button" className="ln-search-clear" aria-label="Clear search" onClick={() => onQ('')}>
          <X size={18} aria-hidden="true" />
        </button>
      ) : null}
    </label>
    <Button variant="quiet" size="sm" className="ln-search-cancel" onClick={onCancel}>
      Cancel
    </Button>
  </form>
);
