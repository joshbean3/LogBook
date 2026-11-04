import type * as React from 'react';
import { useMemo, useRef } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { Days, groupByMonth, monthName, plural, useLoadMore, useOpenLearning } from './LearnedParts';
import { useLearningMonths, useLearnings } from './queries';
import './learned.css';

/**
 * One month of What I learned (/learned/2026-11-01, pushed over the tab): its counts under the title, then every day in it,
 * newest first. A tap on a learning opens it to edit or delete, as on the tab.
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
  const days = useMemo(() => groupByMonth(list.data?.pages.flatMap((p) => p.learnings) ?? [])[0]?.days ?? [], [list.data]);
  const count = days.reduce((n, d) => n + d.items.length, 0);
  const eyebrow = summary ? `${plural(summary.count, 'thing')} · ${plural(summary.days, 'day')}` : days.length ? `${plural(count, 'thing')} · ${plural(days.length, 'day')}` : undefined;
  return (
    <div className="page ln-page ln-month-page">
      <PushedBar title={`${monthName(month)} ${month.slice(0, 4)}`} eyebrow={eyebrow} />
      {list.isPending ? (
        <SkeletonGroup label="Loading" className="ln-more">
          <Skeleton w="40%" h={12} />
          <Skeleton w="85%" h={20} />
          <Skeleton w="40%" h={12} />
          <Skeleton w="70%" h={20} />
        </SkeletonGroup>
      ) : days.length ? (
        <div className="ln-month-days">
          <Days days={days} today={today} onOpen={open} />
        </div>
      ) : (
        <p className="ln-none">Nothing kept from {monthName(month)} yet.</p>
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
