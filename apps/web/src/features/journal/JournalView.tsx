import type * as React from 'react';
import { shiftDays, type Learning } from '@logbook/shared';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SectionBoundary } from '@/app/ErrorBoundary';
import { useIsActiveTab, useNav, useTab, useTabScroller } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { dropIfLanded, lineDay, todayDraft } from '../learned/draft';
import { byTime, LoadError, useOpenLearning } from '../learned/LearnedParts';
import { rowsOf, useKeepQueued, useLearnings, useLearningStats } from '../learned/queries';
import { isStarterOnly } from '../learned/starter';
import { lastSeven } from '../learned/week';
import { journalIntent } from './intent';
import { useOpenEntry } from './JournalDaySection';
import { Archive, monthPath, TodayRows } from './JournalParts';
import { JournalPoster, JournalPosterSkeleton, type DayComposerHandle } from './JournalPoster';
import { Found, SearchButton, SearchField, Searching, useSearchField, useSettled } from './JournalSearch';
import { useDraftOwner, useJournalFeed } from './queries';
import { RecallCard } from './RecallCard';
import { useArchive } from './written';
import '../goals/kit.css';
import '../learned/learned.css';
import './journal.css';
import './journalPage.css';

/**
 * The day the page stands on: the clock's, or the evening before while a line begun then is still in the field (draft.ts
 * `lineDay`; midnight must not move the lights under a line half written, or file it under the wrong day). Once that line
 * is saved the page stays on its evening, showing it kept, until the tab or the app is left; then it is the new day.
 */
const usePageDay = (): string => {
  const live = useToday();
  const active = useIsActiveTab();
  const text = useSyncExternalStore(todayDraft.subscribe, todayDraft.get, todayDraft.get);
  const day = useSyncExternalStore(todayDraft.subscribe, todayDraft.day, todayDraft.day);
  const writing = lineDay(live, day, !isStarterOnly(text));
  const [stay, setStay] = useState<string | null>(null);
  if (writing !== live && stay !== writing) setStay(writing);
  const held = stay !== null && stay === shiftDays(live, -1);
  useEffect(() => {
    // still being written: it holds
    if (stay === null || writing !== live) return;
    if (!held || !active) return setStay(null);
    const away = () => {
      if (document.hidden) setStay(null);
    };
    document.addEventListener('visibilitychange', away);
    return () => document.removeEventListener('visibilitychange', away);
  }, [stay, writing, live, held, active]);
  return writing !== live ? writing : held ? stay : live;
};

/**
 * Journal (the tab root): one place to write about the day. Top to bottom: the dusk poster with the week's lights and the
 * one composer under its band (the line first, then more); what else was written today; Remember when; the months. Search
 * is one tap away, at the end of the nav bar: from its first letter the page is the field and what it finds, in lines and
 * entries together.
 *
 * Lines are `learnings` and entries are `journal`: two lists, each with its own queries, drafts and guards, read here side
 * by side and laid out by day (days.ts).
 */
export default function JournalView(): React.JSX.Element {
  const today = usePageDay();
  const nav = useNav();
  const active = useIsActiveTab();
  const tab = useTab();
  const scroller = useTabScroller();
  useKeepQueued();
  useDraftOwner();
  // ---- lines ----
  const list = useLearnings({ month: today.slice(0, 7) });
  const stats = useLearningStats();
  const openLine = useOpenLearning(today);
  const rows = useMemo(() => rowsOf(list.data), [list.data]);
  // words that came back from a save cut off by the page going away: the list is asked again, and they are let go once
  // it shows that line (the field must not offer a line that is already kept)
  const refetchList = list.refetch;
  useEffect(() => {
    if (todayDraft.unsure()) void refetchList();
  }, [refetchList]);
  useEffect(() => {
    dropIfLanded(todayDraft, rows);
  }, [rows]);
  const todays = useMemo(() => rows.filter((l) => l.date === today).sort(byTime), [rows, today]);
  // the week's lights: this month's lines, and last month's only while the seven days reach back into it. A save lands
  // in these lists at once, so tonight's light does too
  const from = lastSeven(today)[0]!;
  const prevMonth = from.slice(0, 7) !== today.slice(0, 7) ? from.slice(0, 7) : null;
  const prev = useLearnings({ month: prevMonth }, !!prevMonth);
  const prevRows = useMemo(() => rowsOf(prev.data), [prev.data]);
  const lineCounts = useMemo(() => {
    const out = new Map<string, number>();
    const count = (l: Learning) => {
      if (l.date >= from && l.date <= today) out.set(l.date, (out.get(l.date) ?? 0) + 1);
    };
    rows.forEach(count);
    prevRows.forEach(count);
    return out;
  }, [rows, prevRows, from, today]);
  // ---- entries ----
  const feed = useJournalFeed(true);
  const openEntry = useOpenEntry();
  const entryDays = useMemo(() => new Set(feed.entries.filter((e) => e.date >= from && e.date <= today).map((e) => e.date)), [feed.entries, from, today]);
  const todaysEntries = useMemo(() => feed.entries.filter((e) => e.date === today), [feed.entries, today]);
  // ---- the months ----
  const known = useMemo(() => {
    const out: Array<{ month: string; rows: Learning[] }> = [];
    if (list.data && !list.hasNextPage) out.push({ month: today.slice(0, 7), rows });
    if (prevMonth && prev.data && !prev.hasNextPage) out.push({ month: prevMonth, rows: prevRows });
    return out;
  }, [list.data, list.hasNextPage, rows, prevMonth, prev.data, prev.hasNextPage, prevRows, today]);
  const archive = useArchive(feed, known);

  const s = stats.data;
  // never fewer than the lines on the page (the stats do not count a line still waiting to sync)
  const totalLines = Math.max(s?.total ?? 0, rows.length);
  const anything = totalLines > 0 || feed.entries.length > 0;
  // something was written before today: "first" on the band then means this week's first
  const ever = totalLines > todays.length || feed.entries.some((e) => e.date < today);
  const loading = (list.isPending && !list.isError) || (!!prevMonth && prev.isPending && !prev.isError) || feed.pending;
  // a failed load is said once, with Try again; the field above it still works
  const failed = (list.isError && !list.data) || (!!prevMonth && prev.isError && !prev.data) || (stats.isError && !s) || archive.failed;
  const retry = () => {
    if (list.isError) void list.refetch();
    if (prevMonth && prev.isError) void prev.refetch();
    if (stats.isError) void stats.refetch();
    archive.retry();
  };

  // ---- search ----
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const needle = useSettled(q.trim());
  // a query is active from its first letter: the page becomes the field and what it finds
  const searching = q.trim().length > 0;
  const search = useSearchField(searching);
  const startSearch = () => {
    setSearchOpen(true);
    // the field mounts in this tap, so iOS raises the keyboard for it
    requestAnimationFrame(() => search.input.current?.focus());
  };
  const stopSearch = () => {
    setQ('');
    setSearchOpen(false);
  };

  // ---- a day asked for: a past light, Remember when ----
  const openDay = useCallback(
    (date: string) => {
      journalIntent.set({ kind: 'day', date });
      nav.push(monthPath(date));
    },
    [nav],
  );

  // ---- asked to open on the composer (Today's row): the line field with the caret in it, or the entry writer ----
  const composer = useRef<DayComposerHandle>(null);
  const answer = useCallback(() => {
    const i = journalIntent.peek();
    // only the page on screen answers (the tabs stay mounted)
    if (!i || i.kind === 'day' || !composer.current || nav.getState().active !== tab) return;
    journalIntent.clear();
    setQ('');
    setSearchOpen(false);
    scroller.current?.scrollTo({ top: 0 });
    if (i.kind === 'line') composer.current.focusLine();
    else composer.current.writeMore();
  }, [scroller, nav, tab]);
  // at once when it is asked while this page is mounted (inside the tap that brought it up, so the keyboard rises), and
  // when the page first shows
  useEffect(() => journalIntent.subscribe(answer), [answer]);
  useEffect(() => {
    if (active && !loading) answer();
  }, [active, loading, answer]);

  return (
    <div className={`page ln-page jn-page ${searching ? 'is-searching' : ''}`}>
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Journal' }} gap={16} trailing={anything && !searchOpen ? <SearchButton key="search" onPress={startSearch} /> : undefined} />
      {searching ? null : (
        <div className="k-stack">
          {loading ? (
            <JournalPosterSkeleton />
          ) : (
            <SectionBoundary name="journal.poster">
              <JournalPoster today={today} lines={todays} lineCounts={lineCounts} entryDays={entryDays} ever={ever} onOpenLine={openLine} onOpenDay={openDay} composer={composer} />
            </SectionBoundary>
          )}
          {failed ? <LoadError title="Couldn’t load your journal." onRetry={retry} busy={list.isFetching || prev.isFetching || stats.isFetching || archive.fetching} /> : null}
        </div>
      )}
      {searchOpen ? <SearchField q={q} onQ={setQ} onCancel={stopSearch} search={search} /> : null}
      {searching ? (
        needle ? (
          <SectionBoundary name="journal.found">
            <Found q={needle} today={today} onOpenLine={openLine} onOpenEntry={openEntry} />
          </SectionBoundary>
        ) : (
          <Searching />
        )
      ) : (
        <>
          {loading ? null : (
            <SectionBoundary name="journal.today">
              <TodayRows entries={todaysEntries} lines={todays.slice(1)} onOpenEntry={openEntry} onOpenLine={openLine} />
            </SectionBoundary>
          )}
          {searchOpen ? null : (
            <SectionBoundary name="journal.recall">
              <RecallCard today={today} onOpenDay={openDay} onOpenLine={openLine} />
            </SectionBoundary>
          )}
          {archive.failed ? null : archive.pending ? (
            <SkeletonGroup label="Loading the months" className="k-card ln-more">
              <Skeleton w="100%" h={44} />
            </SkeletonGroup>
          ) : archive.months.length ? (
            <SectionBoundary name="journal.archive">
              <Archive months={archive.months} today={today} />
            </SectionBoundary>
          ) : null}
        </>
      )}
    </div>
  );
}
