import type * as React from 'react';
import type { Learning, LearningMonth } from '@logbook/shared';
import { BookOpen, ChevronRight, Search, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNav, useTabScroller } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Button } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { KSection } from '../goals/Kit';
import { byTime, Days, groupByMonth, monthName, plural, useLoadMore, useOpenLearning } from './LearnedParts';
import { LearnedPoster, LearnedPosterSkeleton } from './LearnedPoster';
import { useLearningEchoes, useLearningMonths, useLearnings, useLearningStats } from './queries';
import { Echoes } from './LearnedEchoes';
import { lastSeven } from './week';
import './learned.css';

/**
 * Everything before, under the poster (A2): the months that hold a line, newest first, each one row (the book tile, the
 * month, its count of lines) and a tap from its own page. This year's months are one inset group with no heading; an
 * earlier year is a section under its own name and count. A month with nothing kept has no row.
 */
const Archive = ({ months, today }: { months: LearningMonth[]; today: string }) => {
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
  const thisYear = today.slice(0, 4);
  const rows = (y: (typeof years)[number]) => (
    <div className="k-rows has-icons ln-months">
      {y.months.map((m) => (
        <Pressable
          key={m.month}
          as="button"
          className="k-row ln-mrow"
          press="surface"
          onPress={() => nav.push(`/learned/${m.month}-01`)}
          label={`${monthName(m.month)} ${y.year}, ${plural(m.count, 'line')} on ${plural(m.days, 'day')}. Open`}
        >
          <span className="icon-tile" aria-hidden="true">
            <BookOpen size={18} />
          </span>
          <span className="k-row-main" aria-hidden="true">
            <span className="k-row-title">{monthName(m.month)}</span>
          </span>
          <span className="k-row-end ln-mrow-meta" aria-hidden="true">
            {plural(m.count, 'line')}
          </span>
          <ChevronRight size={18} aria-hidden="true" className="k-chev" />
        </Pressable>
      ))}
    </div>
  );
  return (
    <>
      {years.map((y) =>
        y.year === thisYear ? (
          <section key={y.year} className="ln-year is-now" aria-label={`${y.year}, ${plural(y.total, 'line')}`}>
            {rows(y)}
          </section>
        ) : (
          <KSection key={y.year} title={y.year} meta={plural(y.total, 'line')} className="ln-year">
            {rows(y)}
          </KSection>
        ),
      )}
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
 * there when the first letter takes the poster and the archive away (and when clearing brings them back). The
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

/** The search's way in: a bare 44 pt Deep Sky magnifier at the end of the nav bar, on the page from its first line. */
const SearchButton = ({ onPress }: { onPress: () => void }) => (
  <button type="button" className="icon-btn bare ln-search-btn" aria-label="Search all years" title="Search all years" onClick={onPress}>
    <Search size={18} aria-hidden="true" />
  </button>
);

/**
 * What I learned (the tab root; A2): the dusk poster (the week's lights, tonight's line), then the months that hold a
 * line, then From your archive. Search is one tap away, at the end of the nav bar, and opens its field in place of the
 * poster's neighbors; from its first letter the page is the field and what it finds.
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

  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.learnings) ?? [], [list.data]);
  const todays = useMemo(() => rows.filter((l) => l.date === today).sort(byTime), [rows, today]);
  // the week's lights: this month's lines, and last month's only while the seven days reach back into it. A save lands
  // in these lists at once, so tonight's light does too
  const from = lastSeven(today)[0]!;
  const prevMonth = from.slice(0, 7) !== today.slice(0, 7) ? from.slice(0, 7) : null;
  const prev = useLearnings({ month: prevMonth }, !!prevMonth);
  const lines = useMemo(() => {
    const out = new Map<string, number>();
    const count = (l: Learning) => {
      if (l.date >= from && l.date <= today) out.set(l.date, (out.get(l.date) ?? 0) + 1);
    };
    rows.forEach(count);
    for (const p of prev.data?.pages ?? []) p.learnings.forEach(count);
    return out;
  }, [rows, prev.data, from, today]);
  const s = stats.data;
  const total = s?.total ?? rows.length;
  const hasPast = total > todays.length;
  const loading = (list.isPending && !list.isError) || (!!prevMonth && prev.isPending && !prev.isError);
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
  // From your archive shows only once one of its three slots has a line
  const e = useLearningEchoes(hasPast).data;
  const hasEchoes = hasPast && !!(e?.yearAgo || e?.monthAgo || e?.random);
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
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'What I learned' }} gap={16} trailing={total > 0 && !searchOpen ? <SearchButton key="search" onPress={startSearch} /> : undefined} />
      {searching ? null : (
        <div className="k-stack">
          {loading ? <LearnedPosterSkeleton /> : <LearnedPoster today={today} items={todays} lines={lines} total={total} onOpen={open} />}
          {failed ? <LoadError what="list" onRetry={retry} busy={list.isFetching || stats.isFetching || months.isFetching} /> : null}
        </div>
      )}
      {field}
      {searching ? (
        needle ? (
          <Found q={needle} today={today} onOpen={open} />
        ) : (
          <Searching />
        )
      ) : months.isError && !months.data ? null : months.isPending ? (
        <SkeletonGroup label="Loading the months" className="k-card ln-more">
          <Skeleton w="100%" h={44} />
        </SkeletonGroup>
      ) : months.data?.length ? (
        <Archive months={months.data} today={today} />
      ) : null}
      {hasEchoes && !searchOpen ? <Echoes today={today} onOpen={open} /> : null}
    </div>
  );
}
