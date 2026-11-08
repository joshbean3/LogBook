import type * as React from 'react';
import { fmtDate } from '@logbook/shared';
import { CalendarDays, Lightbulb } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { Line, monthName, plural, useLoadMore, useOpenLearning } from './LearnedParts';
import { monthGrid } from './month';
import { useLearningMonths, useLearnings } from './queries';
import '../goals/kit.css';
import './learned.css';

/**
 * One month of What I learned (/learned/2026-11-01, pushed over the tab): its counts under the title, then the month as a
 * grid of rounded rows, a row per day from the newest back to the 1st. A day with nothing keeps its slot with a dash, so the
 * month reads at a glance. A tap on a learning opens it to edit or delete, as on the tab.
 */
export default function LearnedMonth(): React.JSX.Element {
  const today = useToday();
  const params = useRouteParams();
  const month = /^\d{4}-\d{2}-01$/.test(params.month ?? '') ? params.month!.slice(0, 7) : today.slice(0, 7);
  const list = useLearnings({ month });
  const summary = useLearningMonths().data?.find((m) => m.month === month);
  const open = useOpenLearning(today);
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, list);
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.learnings) ?? [], [list.data]);
  const grid = useMemo(() => monthGrid(month, today, rows), [month, today, rows]);
  const filled = grid.filter((d) => d.items.length).length;
  const count = summary?.count ?? rows.length;
  const days = summary?.days ?? filled;
  const eyebrow = count ? `${plural(count, 'thing')} · ${days} of ${plural(grid.length, 'day')}` : undefined;
  return (
    <div className="page ln-page ln-month-page">
      <PushedBar title={`${monthName(month)} ${month.slice(0, 4)}`} eyebrow={eyebrow} />
      {list.isPending ? (
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
              <span className="tile-value tnum">
                {count || '–'}
                {count ? <small>{count === 1 ? 'thing' : 'things'}</small> : null}
              </span>
              <span className={`tile-status ${count ? '' : 'is-none'}`}>{count ? 'kept this month' : 'No data yet'}</span>
            </div>
            <div className="tile">
              <span className="tile-label">
                <CalendarDays size={15} aria-hidden="true" /> Days
              </span>
              <span className="tile-value tnum">
                {days}
                <small>of {grid.length}</small>
              </span>
              <span className={`tile-status ${days ? '' : 'is-none'}`}>{days ? 'filled in' : 'The days wait here'}</span>
            </div>
          </div>
          <section className="k-sec" aria-label={`${monthName(month)} by day`}>
            <div className="k-head">
              <h2 className="k-head-title">By day</h2>
              <span className="k-head-meta">Newest first</span>
            </div>
            <ol className="k-rows ln-grid">
              {grid.map((d) => (
                <li key={d.date} className={`k-row ln-gday ${d.items.length ? 'has' : 'is-empty'} ${d.date === today ? 'is-today' : ''}`}>
                  <span className="ln-gday-date" aria-label={fmtDate('long', d.date)}>
                    <span className="stamp tnum ln-gday-num">{Number(d.date.slice(8, 10))}</span>
                    <span className="caps ln-gday-dow">{fmtDate('dow', d.date)}</span>
                  </span>
                  <span className="ln-gday-items">
                    {d.items.length ? (
                      d.items.map((l) => <Line key={l.id} item={l} onOpen={open} className="is-grid" />)
                    ) : (
                      <span className="ln-gday-dash" aria-label="Nothing kept">
                        –
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <section className="k-card ln-none">
          <p className="k-row-title">Not started yet</p>
          <p className="k-foot">{monthName(month)} has not started yet.</p>
        </section>
      )}
      <div ref={end} className="ln-end" aria-hidden="true" />
      {list.isFetchingNextPage ? (
        <SkeletonGroup label="Loading more" className="ln-more">
          <Skeleton w="85%" h={20} />
        </SkeletonGroup>
      ) : null}
    </div>
  );
}
