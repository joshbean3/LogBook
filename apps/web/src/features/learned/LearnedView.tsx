import type * as React from 'react';
import type { Learning, LearningMonth, LearningStats } from '@logbook/shared';
import { BookOpen, ChevronRight, Flame, Lightbulb, Minus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { KSection } from '../goals/Kit';
import { byTime, Composer, Days, groupByMonth, Line, monthName, plural, statsWords, useLoadMore, useOpenLearning } from './LearnedParts';
import { useLearningMonths, useLearnings, useLearningStats } from './queries';
import { Echoes } from './LearnedEchoes';
import './learned.css';

export { statsWords };

/**
 * The hero: before today has anything, the serif question and the field; after, today's learnings as serif lines and a
 * quiet "Add another" under them. Lit from below like every tab's hero.
 */
const TodayCard = ({ today, items, onOpen }: { today: string; items: Learning[]; onOpen: (l: Learning) => void }) => (
  <section className={`ln-hero ${items.length ? 'has-items' : ''}`} aria-label="Today">
    <span className="ln-glow" aria-hidden="true" />
    {items.length ? (
      <>
        <span className="caps ln-hero-caps">Today</span>
        <div className="ln-today-list">
          {items.map((l) => (
            <Line key={l.id} item={l} onOpen={onOpen} className="is-today" />
          ))}
        </div>
      </>
    ) : (
      <>
        <h2 className="ln-prompt">What did you learn today?</h2>
        <p className="ln-hint">Name one thing and why it matters. Like: “Strides after easy runs keep my legs quick.”</p>
      </>
    )}
    {/* one field for both states (the same place in the tree), so it and its words survive the swap above */}
    <Composer today={today} quiet={items.length > 0} />
  </section>
);

/**
 * The counts as two tiles: everything learned (and on how many days), and the run of days in a row. Before anything is
 * kept they keep their place with a dash.
 */
const StatsTiles = ({ s, today, keptToday }: { s: LearningStats | undefined; today: string; keptToday: boolean }) => {
  void today;
  const total = s?.total ?? 0;
  const streak = s?.streak ?? 0;
  return (
    <div className="tiles ln-tiles" aria-live="polite" aria-label={s ? (total ? statsWords(s) : 'Nothing learned yet') : 'Loading the counts'}>
      <div className="tile">
        <span className="tile-label">
          <Lightbulb size={15} aria-hidden="true" /> Learned
        </span>
        <span className="tile-value tnum">
          {s ? (total ? total : '–') : ' '}
          {total ? <small>{total === 1 ? 'thing' : 'things'}</small> : null}
        </span>
        <span className={`tile-status ${total ? '' : 'is-none'}`}>{!s ? ' ' : total ? `on ${plural(s.days, 'day')}` : 'No data yet'}</span>
      </div>
      <div className="tile">
        <span className="tile-label">
          <Flame size={15} aria-hidden="true" /> In a row
        </span>
        <span className="tile-value tnum">
          {s ? (streak ? streak : '–') : ' '}
          {streak ? <small>{streak === 1 ? 'day' : 'days'}</small> : null}
        </span>
        {!s ? (
          <span className="tile-status is-none"> </span>
        ) : keptToday ? (
          <span className="tile-status is-hi">Today is in</span>
        ) : (
          <span className="tile-status is-none">
            <Minus size={14} aria-hidden="true" /> Not today yet
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Everything before, kept by year and month, newest first: each year a section with its count, its months as rows of one
 * inset group (the month's short name in a tile, the newest thing in it, the count). A month opens its own page.
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
  const thisMonth = today.slice(0, 7);
  return (
    <>
      {years.map((y) => (
        <KSection key={y.year} title={y.year} meta={plural(y.total, 'thing')} className="ln-year">
          <div className="k-rows has-icons ln-months">
            {y.months.map((m) => (
              <Pressable
                key={m.month}
                as="button"
                className="k-row two ln-mrow"
                press="surface"
                onPress={() => nav.push(`/learned/${m.month}-01`)}
                label={`${monthName(m.month)} ${y.year}, ${plural(m.count, 'thing')} on ${plural(m.days, 'day')}. Open`}
              >
                <span className={`icon-tile ln-mtile ${m.month === thisMonth ? 'is-now' : ''}`} aria-hidden="true">
                  {monthName(m.month).slice(0, 3)}
                </span>
                <span className="k-row-main">
                  <span className="ln-mrow-top">
                    <span className="k-row-title ln-mrow-name">{monthName(m.month)}</span>
                    {m.month === thisMonth ? <span className="ln-mrow-now">This month</span> : null}
                  </span>
                  <span className="ln-mrow-latest">{m.latest}</span>
                </span>
                <span className="k-row-end ln-mrow-meta">{m.count}</span>
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

/** What the search found, across every month: a section per month, its days in one card. */
const Found = ({ q, today, onOpen }: { q: string; today: string; onOpen: (l: Learning) => void }) => {
  const list = useLearnings({ q });
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, list);
  const months = useMemo(() => groupByMonth(list.data?.pages.flatMap((p) => p.learnings) ?? []), [list.data]);
  if (list.isPending)
    return (
      <SkeletonGroup label="Searching" className="k-card ln-more">
        <Skeleton w="40%" h={12} />
        <Skeleton w="85%" h={20} />
      </SkeletonGroup>
    );
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
        <KSection key={m.month} title={`${monthName(m.month)} ${m.month.slice(0, 4)}`} meta={plural(m.days.reduce((n, d) => n + d.items.length, 0), 'match', 'matches')} className="ln-month">
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
 * What I learned (the tab root): today's card, the counts as tiles, the archive's echoes, then the search over
 * everything and the archive itself: every month with something in it, by year, each one a tap from its days.
 */
export default function LearnedView(): React.JSX.Element {
  const today = useToday();
  const list = useLearnings({ month: today.slice(0, 7) });
  const months = useLearningMonths();
  const stats = useLearningStats();
  const open = useOpenLearning(today);
  const [q, setQ] = useState('');
  const needle = useSettled(q.trim());

  const todays = useMemo(() => (list.data?.pages.flatMap((p) => p.learnings) ?? []).filter((l) => l.date === today).sort(byTime), [list.data, today]);
  const s = stats.data;
  const hasPast = !!s && s.total > todays.length;
  return (
    <div className="page ln-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'What I learned' }} gap={16} />
      <div className="k-stack">
        {list.isPending ? (
          <SkeletonGroup label="Loading" className="ln-hero ln-hero-skel">
            <Skeleton w="70%" h={28} />
            <Skeleton w="90%" h={18} />
            <Skeleton w="60%" h={18} />
          </SkeletonGroup>
        ) : (
          <TodayCard today={today} items={todays} onOpen={open} />
        )}
        <StatsTiles s={list.isPending ? undefined : s} today={today} keptToday={todays.length > 0} />
      </div>
      {hasPast ? <Echoes today={today} onOpen={open} /> : null}
      {hasPast ? (
        <label className="ln-search">
          <Search size={17} aria-hidden="true" className="ln-search-icon" />
          <input className="ln-search-in" type="search" enterKeyHint="search" placeholder="Search everything you learned" aria-label="Search everything you learned" value={q} onChange={(e) => setQ(e.target.value)} onFocus={(e) => revealField(e.currentTarget)} />
          {q ? (
            <button type="button" className="ln-search-clear" aria-label="Clear search" onClick={() => setQ('')}>
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </label>
      ) : null}
      {needle ? (
        <Found q={needle} today={today} onOpen={open} />
      ) : months.isPending ? (
        <SkeletonGroup label="Loading the months" className="k-card ln-more">
          <Skeleton w="30%" h={20} />
          <Skeleton w="100%" h={44} />
          <Skeleton w="100%" h={44} />
        </SkeletonGroup>
      ) : months.data?.length ? (
        <Archive months={months.data} today={today} />
      ) : (
        <KSection title={today.slice(0, 4)} meta="0 things" className="ln-year">
          <ul className="k-rows has-icons ln-months">
            <li className="k-row two">
              <span className="icon-tile" aria-hidden="true">
                <BookOpen size={17} />
              </span>
              <span className="k-row-main">
                <span className="k-row-title">No months yet</span>
                <span className="k-row-sub">Each month you keep something lands here.</span>
              </span>
            </li>
          </ul>
        </KSection>
      )}
    </div>
  );
}
