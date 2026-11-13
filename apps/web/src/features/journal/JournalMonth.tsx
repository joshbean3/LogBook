import type * as React from 'react';
import { fmtDate, type JournalEntry } from '@logbook/shared';
import { BookOpen, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectionBoundary } from '@/app/ErrorBoundary';
import { useRouteParams } from '@/app/NavController';
import { useReduced } from '@/lib/motion';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { PageSection } from '@/ui/layout';
import { Pressable } from '@/ui/Pressable';
import { Button, DateGutter, PagerButtons, SectionEmpty } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { Line, LoadError, monthName, sheetWords, useAddLearning, useOpenLearning } from '../learned/LearnedParts';
import { neighbours } from '../learned/month';
import { useLog } from '../log/useLog';
import { rowsOf, useKeepQueued, useLearnings } from '../learned/queries';
import { MonthCalendar } from './Calendar';
import { dayMarks, daysWritten, monthPageDays, writtenWords } from './days';
import { journalIntent } from './intent';
import { useOpenEntry } from './JournalDaySection';
import { EntryRow } from './JournalParts';
import { EntryWriter } from './JournalPoster';
import { runStamp } from './prompt';
import { useDraftOwner, useJournalDays, useJournalFeed } from './queries';
import { useArchive } from './written';
import '../goals/kit.css';
import '../learned/learned.css';
import './journal.css';
import './journalPage.css';

/** How far back "years ago" looks under a picked day. */
const YEARS_BACK = 5;
const yearsBack = (date: string, k: number) => `${Number(date.slice(0, 4)) - k}${date.slice(4)}`;

/** The month a URL names: '2026-11' (or the first of it, as older links wrote it); anything else is this month. */
export const monthParam = (v: string | undefined, today: string): string => {
  const m = /^(\d{4}-(0[1-9]|1[0-2]))(-01)?$/.exec(v ?? '')?.[1];
  return m && m >= '1900-01' && m <= '2199-12' ? m : today.slice(0, 7);
};

/** The entry writer for a day, in a sheet: the journal's own Composer on that day's draft. */
const useWriteEntry = (today: string) => {
  const sheet = useSheet();
  return useCallback((date: string) => sheet.open({ ...sheetWords(date, today), detent: 'large', body: <EntryWriter date={date} today={today} onDone={() => sheet.close()} /> }), [sheet, today]);
};

/**
 * One month of the Journal (/journal/2026-11, pushed over the tab): the month's calendar, a disc on each written day,
 * then the days, newest first, as date-gutter rows of one inset group. Each day: its line as the headline (a tap opens
 * the line's sheet), its entries under it (a tap opens the entry's sheet). A day with entries and no line offers "Add the
 * line"; no row is ever empty. Days with nothing are left out: the calendar is the way to them.
 *
 * A tap on a calendar day jumps to it and lights its row; there the day also offers "Write an entry" and, when an earlier
 * year has one, "This day in 2025". A day with nothing written opens its composer instead (the line, or a longer entry),
 * on any day up to today.
 * The two chevrons in the bar step to the month before or after that has something in it.
 */
export default function JournalMonth(): React.JSX.Element {
  const today = useToday();
  const params = useRouteParams();
  const reduce = useReduced();
  const [month, setMonth] = useState(() => monthParam(params.month ?? params.ym, today));
  // the day asked for (a past light, Remember when), or picked on the calendar
  const [open, setOpen] = useState<string | null>(() => {
    const asked = journalIntent.take('day')?.date ?? null;
    return asked && asked.slice(0, 7) === monthParam(params.month ?? params.ym, today) ? asked : null;
  });
  const [seq, setSeq] = useState(open ? 1 : 0);
  useKeepQueued();
  useDraftOwner();

  // ---- lines: the whole month before the list is trusted (a month over one page loads the rest at once) ----
  const list = useLearnings({ month });
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = list;
  useEffect(() => {
    // a page that failed is not asked for again on its own (that would never stop): the page says so, with Try again
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const rows = useMemo(() => rowsOf(list.data), [list.data]);

  // ---- entries: the feed, and this month's own bundle where the feed has not reached it (and the same day in the
  // years before the picked one) ----
  const feed = useJournalFeed(true);
  const jd = useJournalDays(feed, useMemo(() => [month], [month]));
  // the same day in the years before the picked one: read apart, so picking a day never puts the page back to loading
  const past = useJournalDays(feed, useMemo(() => (open ? [...new Set(Array.from({ length: YEARS_BACK }, (_, i) => yearsBack(open, i + 1).slice(0, 7)))].sort() : []), [open]));
  const entries = useMemo(() => {
    const out: JournalEntry[] = [];
    for (const [d, es] of jd.byDate) if (d.slice(0, 7) === month) out.push(...es);
    return out;
  }, [jd.byDate, month]);

  const days = useMemo(() => monthPageDays(month, today, rows, entries), [month, today, rows, entries]);
  const marks = useMemo(() => dayMarks(days), [days]);
  const written = marks.size;
  const lineCount = rows.length;
  const entryCount = entries.length;

  const openLine = useOpenLearning(today);
  // an entry's sheet also says the run that day, as the entries list did
  const log = useLog(useMemo(() => [month], [month]));
  const openSheet = useOpenEntry();
  const openEntry = useCallback((e: JournalEntry) => openSheet(e, { stamp: log.loaded(e.date) ? runStamp(log.snap, e.date) : null }), [openSheet, log]);
  const writeEntry = useWriteEntry(today);
  const addLine = useAddLearning(today, writeEntry);

  // ---- the months either side that hold something ----
  const known = useMemo(() => (list.data && !hasNextPage ? [{ month, rows }] : []), [list.data, hasNextPage, month, rows]);
  const archive = useArchive(feed, known);
  const { older, newer } = neighbours(archive.months, month);
  const top = useRef<HTMLDivElement>(null);
  const scrollerOf = () => top.current?.closest<HTMLElement>('.pushed, .tab-scroll') ?? null;
  const step = (m: string | null) => {
    if (!m) return;
    setMonth(m);
    setOpen(null);
    scrollerOf()?.scrollTo({ top: 0 });
  };
  const pager = (
    <PagerButtons
      inBar
      onPrev={() => step(older)}
      onNext={() => step(newer)}
      prevDisabled={!older}
      nextDisabled={!newer}
      prevLabel={older ? `Previous month, ${monthName(older)} ${older.slice(0, 4)}` : 'No earlier month'}
      nextLabel={newer ? `Next month, ${monthName(newer)} ${newer.slice(0, 4)}` : 'No later month'}
    />
  );

  const linesFailed = list.isError && !list.data;
  const pending = (list.isPending && !linesFailed) || jd.loading;
  const failedAll = linesFailed && jd.failed;
  const retry = () => {
    if (linesFailed) void list.refetch();
    if (jd.failed) jd.retry();
    if (isFetchNextPageError) void fetchNextPage();
  };

  /** A day on the calendar: one with something written is jumped to; one with nothing opens its composer. */
  const pick = (d: string) => {
    if (d > today || pending) return;
    if (days.some((x) => x.date === d)) {
      setOpen(d);
      setSeq((n) => n + 1);
    } else addLine(d);
  };
  /** Another month's day (this day in an earlier year). */
  const goDay = (d: string) => {
    setMonth(d.slice(0, 7));
    setOpen(d);
    setSeq((n) => n + 1);
  };
  // the picked day's row comes into view (it may sit far under the calendar). A day that was asked for from outside (a
  // past light) and has nothing written opens its composer instead, once
  useEffect(() => {
    if (!seq || !open || pending) return;
    if (!days.some((x) => x.date === open)) {
      setOpen(null);
      if (open <= today) addLine(open);
      return;
    }
    const id = requestAnimationFrame(() => top.current?.querySelector<HTMLElement>(`[data-day="${open}"]`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [seq, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // what was written on the picked day in an earlier year
  const year = useMemo(() => {
    if (!open) return null;
    for (let k = 1; k <= YEARS_BACK; k++) {
      const d = yearsBack(open, k);
      const e = past.byDate.get(d)?.[0];
      if (e) return { d, e };
    }
    return null;
  }, [past.byDate, open]);

  const name = monthName(month);
  const current = month === today.slice(0, 7);
  const started = `${month}-01` <= today;
  return (
    <div className="page ln-page ln-month-page jn-month-page" ref={top}>
      <PushedBar title={name} eyebrow={month.slice(0, 4)} trailing={pager} />
      {failedAll ? (
        <LoadError title={`Couldn’t load ${name}.`} onRetry={retry} busy={list.isFetching} />
      ) : !started && !written ? (
        <section className="k-card ln-none">
          <p className="k-row-title">Not started yet</p>
          <p className="k-foot">{name} has not started yet.</p>
        </section>
      ) : (
        <SectionBoundary name="journal.month">
          <MonthCalendar month={month} today={today} marks={marks} unknown={pending || jd.failed || linesFailed} open={open} onPick={pick} />
          <PageSection title="By day" meta={pending ? undefined : written ? daysWritten(written) : current ? 'Nothing written yet' : 'Nothing written'}>
            {pending ? (
              <SkeletonGroup label="Loading" className="group ln-mdays-skel">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="date-row ln-mday">
                    <Skeleton w={40} h={44} r="control" />
                    <Skeleton w={`${80 - i * 15}%`} h={18} />
                  </div>
                ))}
              </SkeletonGroup>
            ) : days.length ? (
              <ol className="group ln-mdays jn-mdays">
                {days.map((d) => {
                  const isOpen = open === d.date;
                  return (
                    <li key={d.date} className={`date-row ln-mday ${isOpen ? 'is-open' : ''}`} data-day={d.date}>
                      <span className="sr-only">
                        {fmtDate('long', d.date)}, {writtenWords(d.lines.length, d.entries.length)}
                      </span>
                      <DateGutter date={d.date} today={d.date === today} />
                      <span className="ln-mday-items">
                        {d.lines.length ? (
                          d.lines.map((l, i) => <Line key={l.id} item={l} onOpen={openLine} className={`is-grid ${i === 0 ? 'is-head' : ''}`} />)
                        ) : (
                          // entries and no line: the headline's place offers it, never an empty row
                          <Button variant="quiet" className="jn-addline" onClick={() => addLine(d.date)} aria-label={`Add the line for ${fmtDate('long', d.date)}`}>
                            <Plus size={18} aria-hidden="true" /> Add the line
                          </Button>
                        )}
                        {d.entries.map((e) => (
                          <EntryRow key={e.id} e={e} onOpen={openEntry} className="is-inset" />
                        ))}
                        {isOpen ? (
                          <span className="jn-dayfoot">
                            <Button variant="quiet" className="jn-addline" onClick={() => writeEntry(d.date)} aria-label={`Write an entry for ${fmtDate('long', d.date)}`}>
                              <Plus size={18} aria-hidden="true" /> Write an entry
                            </Button>
                            {year ? (
                              <Pressable as="button" className="jn-ago" press="dim" onPress={() => goDay(year.d)} label={`This day in ${year.d.slice(0, 4)}: ${year.e.text}. Open that day`}>
                                <span className="jn-ago-k" aria-hidden="true">
                                  This day in {year.d.slice(0, 4)} <ChevronRight size={14} />
                                </span>
                                <span className="jn-ago-t" aria-hidden="true">
                                  {year.e.text}
                                </span>
                              </Pressable>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
                {hasNextPage && !isFetchNextPageError ? (
                  <li className="date-row ln-mday" aria-hidden="true">
                    <Skeleton w={40} h={44} r="control" />
                    <Skeleton w="70%" h={18} />
                  </li>
                ) : null}
              </ol>
            ) : (
              <SectionEmpty icon={<BookOpen size={18} />} title={`Nothing written in ${name}`} line="Tap a day above to write it." />
            )}
          </PageSection>
          {!pending && written ? <p className="k-foot jn-month-count">{writtenWords(lineCount, entryCount)}</p> : null}
        </SectionBoundary>
      )}
      {/* one of the two lists did not load, or the rest of the lines did not: what there is shows, and this asks again */}
      {!failedAll && !pending && (linesFailed || jd.failed || isFetchNextPageError) ? (
        <LoadError title={jd.failed && !linesFailed ? `Couldn’t load the entries of ${name}.` : linesFailed ? `Couldn’t load the lines of ${name}.` : `Couldn’t load the rest of ${name}.`} onRetry={retry} busy={list.isFetching || isFetchingNextPage} />
      ) : null}
      {isFetchingNextPage ? (
        <p className="sr-only" aria-live="polite">
          Loading the rest of {name}
        </p>
      ) : null}
    </div>
  );
}
