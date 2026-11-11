import type * as React from 'react';
import { fmtDate, shiftDays } from '@logbook/shared';
import { BookOpen, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouteParams } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { PushedBar } from '@/ui/NavBar';
import { PageSection } from '@/ui/layout';
import { Pressable } from '@/ui/Pressable';
import { DateGutter, PagerButtons, SectionEmpty } from '@/ui/primitives';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { FILL_DAYS, Line, monthName, plural, useAddLearning, useOpenLearning } from './LearnedParts';
import { monthDays, neighbours } from './month';
import { useLearningMonths, useLearnings } from './queries';
import '../goals/kit.css';
import './learned.css';

/**
 * One month of What I learned (/learned/2026-11-01, pushed over the tab; layout plan 2.3 LM1 to LM4): "By day" with the
 * month's count as its meta, then only the days with something kept, newest first, as date-gutter rows of one inset group
 * (two learnings on a day share the gutter, a hairline between them). Empty days are left out; the one exception is a day
 * in the last week, kept as a tap to fill it in. A tap on a learning opens it to edit or delete, as on the tab. The two
 * chevrons in the bar step to the month before or after that has something in it.
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
  // the whole month before the list is trusted: a month over one page (200) loads the rest at once, with a skeleton row
  // at the end until it has
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.learnings) ?? [], [list.data]);
  const fillFrom = shiftDays(today, -(FILL_DAYS - 1));
  const days = useMemo(() => monthDays(month, today, rows, fillFrom), [month, today, rows, fillFrom]);
  const kept = days.filter((d) => d.items.length);
  const count = summary?.count ?? rows.length;
  const dayCount = summary?.days ?? kept.length;
  const current = month === today.slice(0, 7);
  const started = `${month}-01` <= today;
  const name = monthName(month);
  const { older, newer } = neighbours(months, month);
  const top = useRef<HTMLDivElement>(null);
  const step = (m: string | null) => {
    if (!m) return;
    setMonth(m);
    top.current?.closest<HTMLElement>('.pushed, .tab-scroll')?.scrollTo({ top: 0 });
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
  return (
    <div className="page ln-page ln-month-page" ref={top}>
      <PushedBar title={`${name} ${month.slice(0, 4)}`} trailing={pager} />
      {list.isError && !list.data ? (
        <section className="k-card ln-error" role="alert">
          <p className="k-row-title">Couldn’t load {name}.</p>
          <p className="k-foot">Check the connection, then go back and open it again.</p>
        </section>
      ) : list.isPending ? (
        <SkeletonGroup label="Loading" className="group ln-mdays-skel">
          {[0, 1, 2].map((i) => (
            <div key={i} className="date-row ln-mday">
              <Skeleton w={40} h={44} r="control" />
              <Skeleton w={`${80 - i * 15}%`} h={18} />
            </div>
          ))}
        </SkeletonGroup>
      ) : !started ? (
        <section className="k-card ln-none">
          <p className="k-row-title">Not started yet</p>
          <p className="k-foot">{name} has not started yet.</p>
        </section>
      ) : (
        <PageSection title="By day" meta={count ? `${plural(count, 'thing')} on ${plural(dayCount, 'day')}` : current ? 'Nothing kept yet' : 'Nothing kept'} first>
          {days.length ? (
            <ol className="group ln-mdays">
              {days.map((d) =>
                d.items.length ? (
                  <li key={d.date} className="date-row ln-mday">
                    <span className="sr-only">{fmtDate('long', d.date)}</span>
                    <DateGutter date={d.date} today={d.date === today} />
                    <span className="ln-mday-items">
                      {d.items.map((l) => (
                        <Line key={l.id} item={l} onOpen={open} className="is-grid" />
                      ))}
                    </span>
                  </li>
                ) : (
                  <li key={d.date} className="ln-mday-fill">
                    <Pressable as="button" className="date-row ln-mday ln-mday-add" press="surface" onPress={() => addFor(d.date)} label={`${fmtDate('long', d.date)}, nothing kept. Add one`}>
                      <DateGutter date={d.date} today={d.date === today} />
                      <span className="ln-mday-add-words" aria-hidden="true">
                        <Plus size={18} /> Add one
                      </span>
                    </Pressable>
                  </li>
                ),
              )}
              {hasNextPage ? (
                <li className="date-row ln-mday" aria-hidden="true">
                  <Skeleton w={40} h={44} r="control" />
                  <Skeleton w="70%" h={18} />
                </li>
              ) : null}
            </ol>
          ) : (
            <SectionEmpty icon={<BookOpen size={18} />} title={`Nothing kept in ${name}`} line="Days you keep something show here." />
          )}
        </PageSection>
      )}
      {isFetchingNextPage ? (
        <p className="sr-only" aria-live="polite">
          Loading the rest of {name}
        </p>
      ) : null}
    </div>
  );
}
