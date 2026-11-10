import type * as React from 'react';
import { fmtDate, shiftDays } from '@logbook/shared';
import { CalendarDays, ChevronLeft, ChevronRight, Lightbulb, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { PageSection } from '@/ui/layout';
import { Pressable } from '@/ui/Pressable';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { FILL_DAYS, Line, monthName, useAddLearning, useOpenLearning } from './LearnedParts';
import { monthGrid, neighbours } from './month';
import { useLearningMonths, useLearnings } from './queries';
import '../goals/kit.css';
import './learned.css';

/**
 * One month of What I learned (/learned/2026-11-01, pushed over the tab): two tiles with its counts, then the month as a
 * grid of rounded rows, a row per day from the newest back to the 1st. A day with nothing keeps its slot with a dash, so the
 * month reads at a glance; one in the last week is a tap from filling it in. A tap on a learning opens it to edit or delete,
 * as on the tab. The chevrons in the bar step to the month before or after that has something in it.
 */
export default function LearnedMonth(): React.JSX.Element {
  const today = useToday();
  const params = useRouteParams();
  const [month, setMonth] = useState(() => (/^\d{4}-\d{2}-01$/.test(params.month ?? '') ? params.month!.slice(0, 7) : today.slice(0, 7)));
  const list = useLearnings({ month });
  const months = useLearningMonths().data ?? [];
  const summary = months.find((m) => m.month === month);
  const open = useOpenLearning(today);
  const addFor = useAddLearning(today);
  // the whole month before the grid is trusted: a month over one page (200) loads the rest at once, and the days older
  // than what has loaded so far wait as skeletons rather than reading as empty
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.learnings) ?? [], [list.data]);
  const oldest = hasNextPage ? rows.reduce<string | null>((min, r) => (!min || r.date < min ? r.date : min), null) : null;
  const grid = useMemo(() => monthGrid(month, today, rows), [month, today, rows]);
  const filled = grid.filter((d) => d.items.length).length;
  const count = summary?.count ?? rows.length;
  const days = summary?.days ?? filled;
  const current = month === today.slice(0, 7);
  const name = monthName(month);
  const { older, newer } = neighbours(months, month);
  const fillFrom = shiftDays(today, -(FILL_DAYS - 1));
  const top = useRef<HTMLDivElement>(null);
  const step = (m: string | null) => {
    if (!m) return;
    setMonth(m);
    top.current?.closest<HTMLElement>('.pushed, .tab-scroll')?.scrollTo({ top: 0 });
  };
  const chevrons = (
    <span className="ln-mnav">
      <button type="button" className="icon-btn ln-mnav-btn" aria-label={older ? `Previous month, ${monthName(older)} ${older.slice(0, 4)}` : 'No earlier month'} disabled={!older} onClick={() => step(older)}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn ln-mnav-btn" aria-label={newer ? `Next month, ${monthName(newer)} ${newer.slice(0, 4)}` : 'No later month'} disabled={!newer} onClick={() => step(newer)}>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </span>
  );
  return (
    <div className="page ln-page ln-month-page" ref={top}>
      <PushedBar title={`${name} ${month.slice(0, 4)}`} trailing={chevrons} />
      {list.isError && !list.data ? (
        <section className="k-card ln-error" role="alert">
          <p className="k-row-title">Couldn’t load {name}.</p>
          <p className="k-foot">Check the connection, then go back and open it again.</p>
        </section>
      ) : list.isPending ? (
        <SkeletonGroup label="Loading" className="k-card ln-more">
          <Skeleton w="100%" h={52} />
          <Skeleton w="100%" h={52} />
          <Skeleton w="100%" h={52} />
        </SkeletonGroup>
      ) : grid.length ? (
        <>
          <div className="tiles ln-tiles">
            <div className="tile">
              <span className="tile-label">
                <Lightbulb size={15} aria-hidden="true" /> Learned
              </span>
              <span className="tile-value">
                {count || '–'}
                {count ? <small>{count === 1 ? 'thing' : 'things'}</small> : null}
              </span>
              <span className={`tile-status ${count ? '' : 'is-none'}`}>{count ? (current ? 'kept this month' : `kept in ${name}`) : current ? 'Nothing kept yet' : 'Nothing kept'}</span>
            </div>
            <div className="tile">
              <span className="tile-label">
                <CalendarDays size={15} aria-hidden="true" /> Days
              </span>
              <span className="tile-value">
                {days}
                <small>of {grid.length}</small>
              </span>
              <span className={`tile-status ${days ? '' : 'is-none'}`}>{days ? 'filled in' : current ? 'None yet' : 'None filled in'}</span>
            </div>
          </div>
          <PageSection title="By day" meta="Newest first">
            <ol className="k-rows ln-grid">
              {grid.map((d) => {
                const waiting = !d.items.length && oldest != null && d.date < oldest;
                const fillable = !d.items.length && !waiting && d.date >= fillFrom && d.date <= today;
                const date = (
                  <span className="ln-gday-date">
                    <span className="sr-only">{fmtDate('long', d.date)}</span>
                    <span className="stamp ln-gday-num" aria-hidden="true">
                      {Number(d.date.slice(8, 10))}
                    </span>
                    <span className="caps ln-gday-dow" aria-hidden="true">
                      {fmtDate('dow', d.date)}
                    </span>
                  </span>
                );
                return (
                  <li key={d.date} className={`k-row ln-gday ${d.items.length ? 'has' : 'is-empty'} ${d.date === today ? 'is-today' : ''} ${fillable ? 'is-fillable' : ''}`}>
                    {fillable ? (
                      <Pressable as="button" className="ln-gday-fill" press="surface" onPress={() => addFor(d.date)} label={`${fmtDate('long', d.date)}, nothing kept. Add one`}>
                        {date}
                        <span className="ln-gday-add" aria-hidden="true">
                          <Plus size={16} strokeWidth={2.4} /> Add one
                        </span>
                      </Pressable>
                    ) : (
                      <>
                        {date}
                        <span className="ln-gday-items">
                          {d.items.length ? (
                            d.items.map((l) => <Line key={l.id} item={l} onOpen={open} className="is-grid" />)
                          ) : waiting ? (
                            <Skeleton w="70%" h={18} />
                          ) : (
                            <span className="ln-gday-dash">
                              <span aria-hidden="true">–</span>
                              <span className="sr-only">Nothing kept</span>
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </PageSection>
        </>
      ) : (
        <section className="k-card ln-none">
          <p className="k-row-title">Not started yet</p>
          <p className="k-foot">{name} has not started yet.</p>
        </section>
      )}
      {isFetchingNextPage ? <p className="sr-only" aria-live="polite">Loading the rest of {name}</p> : null}
    </div>
  );
}
