import type * as React from 'react';
import type { Learning, LearningMonth } from '@logbook/shared';
import { BookOpen, ChevronRight, Search, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNav, useTabScroller } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Button, SectionEmpty } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { KSection } from '../goals/Kit';
import { byTime, Composer, Days, groupByMonth, Line, monthName, plural, useLoadMore, useOpenLearning } from './LearnedParts';
import { useLearningEchoes, useLearningMonths, useLearnings, useLearningStats } from './queries';
import { Echoes } from './LearnedEchoes';
import { Streak } from './Streak';
import './learned.css';

/**
 * The hero (layout plan 2.3 L1): before today has anything, the serif question, one helper line, the field and Save; after,
 * today's learnings as lines and a quiet "Add another" under them. The screen's one hero card, with its sunrise glow.
 */
const TodayCard = ({ today, items, onOpen }: { today: string; items: Learning[]; onOpen: (l: Learning) => void }) => (
  <section className={`card is-hero has-glow ln-hero ${items.length ? 'has-items' : ''}`} aria-label="Today">
    {items.length ? (
      <>
        <span className="caps ln-hero-caps">Today</span>
        <div className="ln-today-list">
          {items.map((l) => (
            <Line key={l.id} item={l} onOpen={onOpen} className="is-today" clamp />
          ))}
        </div>
      </>
    ) : (
      <div className="ln-hero-head">
        <h2 className="ln-prompt">What did you learn today?</h2>
        <p className="ln-hint">Name one thing and why it matters.</p>
      </div>
    )}
    {/* one field for both states (the same place in the tree), so it and its words survive the swap above */}
    <Composer today={today} quiet={items.length > 0} />
  </section>
);

/**
 * Everything before, kept by year and month, newest first: each year a section with its count, its months as rows of one
 * inset group (the month's short name in a tile, the newest thing in it, the count). A month opens its own page. The
 * running month carries one marker, its "This month" tag. `search` sits in the first year's header when there is no
 * archive section above to hold it.
 */
const Archive = ({ months, today, search }: { months: LearningMonth[]; today: string; search?: React.ReactNode }) => {
  const nav = useNav();
  const years = useMemo(() => {
    const out: Array<{ year: string; total: number; months: LearningMonth[] }> = [];
    for (const m of months) {
      const y = m.month.slice(0, 4);
      let cur = out[out.length - 1];
      if (!cur || cur.year !== y) out.push((cur = { year: y, total: 0, months: [] }));
      cur.total += m.count;
      cur.months.push(m);
    }
    return out;
  }, [months]);
  const thisMonth = today.slice(0, 7);
  return (
    <>
      {years.map((y, i) => (
        <KSection key={y.year} title={y.year} meta={plural(y.total, 'thing')} action={i === 0 ? search : undefined} className="ln-year">
          <div className="k-rows has-icons ln-months">
            {y.months.map((m) => (
              <Pressable
                key={m.month}
                as="button"
                className="k-row two ln-mrow"
                press="surface"
                onPress={() => nav.push(`/learned/${m.month}-01`)}
                label={`${monthName(m.month)} ${y.year}${m.month === thisMonth ? ', this month' : ''}, ${plural(m.count, 'thing')} on ${plural(m.days, 'day')}. Open`}
              >
                <span className="icon-tile ln-mtile" aria-hidden="true">
                  {monthName(m.month).slice(0, 3)}
                </span>
                <span className="k-row-main" aria-hidden="true">
                  <span className="ln-mrow-top">
                    <span className="k-row-title ln-mrow-name">{monthName(m.month)}</span>
                    {m.month === thisMonth ? <span className="ln-mrow-now">This month</span> : null}
                  </span>
                  <span className="k-row-sub">{m.latest}</span>
                </span>
                <span className="k-row-end ln-mrow-meta" aria-hidden="true">
                  {m.count}
                </span>
                <ChevronRight size={18} aria-hidden="true" className="k-chev" />
              </Pressable>
            ))}
          </div>
        </KSection>
      ))}
    </>
  );
};

/** Typing settles for 250 ms before it searches. */
const useSettled = (v: string, ms = 250) => {
  const [out, setOut] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setOut(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return out;
};

/** A load that failed: says so, with Try again. Never an empty state. */
const LoadError = ({ what, onRetry, busy }: { what: 'list' | 'search'; onRetry: () => void; busy?: boolean }) => (
  <section className="k-card ln-error" role="alert">
    <p className="k-row-title">{what === 'search' ? 'Couldn’t search what you learned.' : 'Couldn’t load what you learned.'}</p>
    <p className="k-foot">Check the connection, then try again.</p>
    <Button size="sm" className="ln-error-btn" onClick={onRetry} disabled={busy}>
      Try again
    </Button>
  </section>
);

const Searching = () => (
  <SkeletonGroup label="Searching" className="k-card ln-more">
    <Skeleton w="40%" h={12} />
    <Skeleton w="85%" h={20} />
  </SkeletonGroup>
);

/** What the search found, across every month: a section per month, its days in one card. */
const Found = ({ q, today, onOpen }: { q: string; today: string; onOpen: (l: Learning) => void }) => {
  const list = useLearnings({ q });
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, list);
  const months = useMemo(() => groupByMonth(list.data?.pages.flatMap((p) => p.learnings) ?? []), [list.data]);
  // a failed search is not "no matches"
  if (list.isError && !list.data) return <LoadError what="search" onRetry={() => void list.refetch()} busy={list.isFetching} />;
  if (list.isPending) return <Searching />;
  if (!months.length)
    return (
      <section className="k-card ln-none">
        <p className="k-row-title">No matches</p>
        <p className="k-foot">Nothing you learned matches “{q}”.</p>
      </section>
    );
  return (
    <div className="ln-past">
      {months.map((m) => (
        <KSection key={m.month} title={`${monthName(m.month)} ${m.month.slice(0, 4)}`} className="ln-month">
          <div className="k-card ln-days">
            <Days days={m.days} today={today} onOpen={onOpen} />
          </div>
        </KSection>
      ))}
      <div ref={end} className="ln-end" aria-hidden="true" />
    </div>
  );
};

/**
 * The search field's place and focus. With the keyboard up the room for results is between the field and the keyboard, so
 * on focus the field goes to the top of the scroller, just under the nav bar (not to the keyboard's edge), and it is held
 * there when the first letter takes the streak, the hero and the archive away (and when clearing brings them back). The
 * keyboard's Search key blurs the field, and so does the first drag or wheel of the page while it is focused. A tap on a
 * result is left alone: the sheet it opens takes the focus.
 */
const useSearchField = (searching: boolean) => {
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

/** The search's way in (layout plan 2.3 L5): a bare 44 pt Deep Sky magnifier in a section header's action slot. */
const SearchButton = ({ onPress }: { onPress: () => void }) => (
  <button type="button" className="icon-btn bare ln-search-btn" aria-label="Search all years" title="Search all years" onClick={onPress}>
    <Search size={18} aria-hidden="true" />
  </button>
);

/**
 * What I learned (the tab root): the streak tracker, today's card (the hero), From your archive, then every year with its
 * months, each one a tap from its days. Search is one tap away, in the archive's header (or the first year's), and opens
 * its field in place of the archive.
 */
export default function LearnedView(): React.JSX.Element {
  const today = useToday();
  const list = useLearnings({ month: today.slice(0, 7) });
  const months = useLearningMonths();
  const stats = useLearningStats();
  const open = useOpenLearning(today);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const needle = useSettled(q.trim());
  // a query is active from its first letter: the page becomes the field and what it finds
  const searching = q.trim().length > 0;
  const search = useSearchField(searching);

  const todays = useMemo(() => (list.data?.pages.flatMap((p) => p.learnings) ?? []).filter((l) => l.date === today).sort(byTime), [list.data, today]);
  const s = stats.data;
  const hasPast = !!s && s.total > todays.length;
  // a failed load is said once, with Try again; the field above it still works
  const failed = (list.isError && !list.data) || (stats.isError && !s) || (months.isError && !months.data);
  const retry = () => {
    if (list.isError) void list.refetch();
    if (stats.isError) void stats.refetch();
    if (months.isError) void months.refetch();
  };
  const startSearch = () => {
    setSearchOpen(true);
    // the field mounts in this tap, so iOS raises the keyboard for it
    requestAnimationFrame(() => search.input.current?.focus());
  };
  const stopSearch = () => {
    setQ('');
    setSearchOpen(false);
  };
  // From your archive shows only once one of its three slots has a learning; until then the first year's header holds search
  const e = useLearningEchoes(hasPast).data;
  const hasEchoes = hasPast && !!(e?.yearAgo || e?.monthAgo || e?.random);
  const echoes = hasEchoes && !searchOpen ? <Echoes today={today} onOpen={open} action={<SearchButton onPress={startSearch} />} /> : null;
  const field = searchOpen ? (
    <form role="search" className="ln-search-form" onSubmit={search.onSubmit}>
      <label className="ln-search" ref={search.box}>
        <Search size={18} aria-hidden="true" className="ln-search-icon" />
        <input
          ref={search.input}
          className="ln-search-in"
          type="search"
          enterKeyHint="search"
          maxLength={100}
          placeholder="Search all years"
          aria-label="Search everything you learned"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          onFocus={search.onFocus}
          onBlur={search.onBlur}
        />
        {q ? (
          <button type="button" className="ln-search-clear" aria-label="Clear search" onClick={() => setQ('')}>
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </label>
      <Button variant="quiet" size="sm" className="ln-search-cancel" onClick={stopSearch}>
        Cancel
      </Button>
    </form>
  ) : null;
  return (
    <div className={`page ln-page ${searching ? 'is-searching' : ''}`}>
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'What I learned' }} gap={16} />
      {searching ? null : (
        <div className="k-stack">
          {(stats.isError && !s) || (list.isError && !list.data) ? null : <Streak today={today} stats={list.isPending ? undefined : s} month={list} />}
          {list.isPending && !list.isError ? (
            <SkeletonGroup label="Loading" className="card is-hero ln-hero ln-hero-skel">
              <Skeleton w="70%" h={28} />
              <Skeleton w="80%" h={18} />
              <Skeleton w={96} h={44} r="pill" style={{ marginTop: 'auto' }} />
            </SkeletonGroup>
          ) : (
            <TodayCard today={today} items={todays} onOpen={open} />
          )}
          {failed ? <LoadError what="list" onRetry={retry} busy={list.isFetching || stats.isFetching || months.isFetching} /> : null}
        </div>
      )}
      {echoes}
      {field}
      {searching ? (
        needle ? (
          <Found q={needle} today={today} onOpen={open} />
        ) : (
          <Searching />
        )
      ) : months.isError && !months.data ? null : months.isPending ? (
        <SkeletonGroup label="Loading the months" className="k-card ln-more">
          <Skeleton w="30%" h={20} />
          <Skeleton w="100%" h={44} />
          <Skeleton w="100%" h={44} />
        </SkeletonGroup>
      ) : months.data?.length ? (
        // with no archive section above, the first year's header holds the search
        <Archive months={months.data} today={today} search={hasPast && !searchOpen && !hasEchoes ? <SearchButton onPress={startSearch} /> : undefined} />
      ) : (
        <KSection title={today.slice(0, 4)} meta="0 things" className="ln-year">
          <SectionEmpty icon={<BookOpen size={18} />} title="No months yet" line="Each month lands here." />
        </KSection>
      )}
    </div>
  );
}
