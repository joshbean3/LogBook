import type * as React from 'react';
import type { Learning, LearningMonth } from '@logbook/shared';
import { ChevronRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Pressable } from '@/ui/Pressable';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { byTime, Composer, Days, groupByMonth, Line, monthName, plural, statsWords, useLoadMore, useOpenLearning } from './LearnedParts';
import { useLearningMonths, useLearnings, useLearningStats } from './queries';
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
        <Composer key="quiet" today={today} quiet />
      </>
    ) : (
      <>
        <h2 className="ln-prompt">What did you learn today?</h2>
        <Composer key="hero" today={today} />
      </>
    )}
  </section>
);

/**
 * Everything before, kept by year and month, newest first: a year's heading with its count, then a row per month with its
 * counts and the newest thing in it. A month opens its own page (/learned/2026-11-01) with every day in it.
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
    <div className="ln-archive">
      {years.map((y) => (
        <section key={y.year} className="ln-year" aria-label={y.year}>
          <div className="ln-year-head">
            <h3 className="ln-year-title">{y.year}</h3>
            <span className="ln-year-meta">{plural(y.total, 'thing')}</span>
          </div>
          <div className="ln-months">
            {y.months.map((m) => (
              <Pressable
                key={m.month}
                as="button"
                className="ln-mrow"
                press="surface"
                onPress={() => nav.push(`/learned/${m.month}-01`)}
                label={`${monthName(m.month)} ${y.year}, ${plural(m.count, 'thing')} on ${plural(m.days, 'day')}. Open`}
              >
                <span className="ln-mrow-top">
                  <span className="ln-mrow-name">{monthName(m.month)}</span>
                  {m.month === thisMonth ? <span className="caps ln-mrow-now">This month</span> : null}
                  <span className="ln-mrow-meta">
                    {plural(m.count, 'thing')}
                    <span className="ln-mrow-days"> · {plural(m.days, 'day')}</span>
                  </span>
                </span>
                <span className="ln-mrow-latest">{m.latest}</span>
                <ChevronRight size={18} aria-hidden="true" className="ln-mrow-chev" />
              </Pressable>
            ))}
          </div>
        </section>
      ))}
    </div>
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

/** What the search found, across every month, under month headings. */
const Found = ({ q, today, onOpen }: { q: string; today: string; onOpen: (l: Learning) => void }) => {
  const list = useLearnings({ q });
  const end = useRef<HTMLDivElement>(null);
  useLoadMore(end, list);
  const months = useMemo(() => groupByMonth(list.data?.pages.flatMap((p) => p.learnings) ?? []), [list.data]);
  if (list.isPending)
    return (
      <SkeletonGroup label="Searching" className="ln-more">
        <Skeleton w="40%" h={12} />
        <Skeleton w="85%" h={20} />
      </SkeletonGroup>
    );
  if (!months.length) return <p className="ln-none">Nothing you learned matches “{q}”.</p>;
  return (
    <div className="ln-past">
      {months.map((m) => (
        <section key={m.month} className="ln-month" aria-label={`${monthName(m.month)} ${m.month.slice(0, 4)}`}>
          <h3 className="ln-month-title">
            {monthName(m.month)} {m.month.slice(0, 4)}
          </h3>
          <Days days={m.days} today={today} onOpen={onOpen} />
        </section>
      ))}
      <div ref={end} className="ln-end" aria-hidden="true" />
    </div>
  );
};

/**
 * What I learned (the tab root): today's card, the stats line, a search over everything, then the archive: every month
 * with something in it, by year, each one a tap from its days.
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
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'What I learned' }} gap={24} />
      {list.isPending ? (
        <SkeletonGroup label="Loading" className="ln-hero ln-hero-skel">
          <Skeleton w="70%" h={28} />
          <Skeleton w="90%" h={18} />
          <Skeleton w="60%" h={18} />
        </SkeletonGroup>
      ) : (
        <TodayCard today={today} items={todays} onOpen={open} />
      )}
      <p className="ln-stats" aria-live="polite">
        {list.isPending || !s ? ' ' : s.total > 0 ? statsWords(s) : 'One thing a day. They gather here.'}
      </p>
      {hasPast ? (
        <label className="ln-search">
          <Search size={16} aria-hidden="true" className="ln-search-icon" />
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
        <SkeletonGroup label="Loading the months" className="ln-more">
          <Skeleton w="30%" h={24} />
          <Skeleton w="100%" h={56} />
          <Skeleton w="100%" h={56} />
        </SkeletonGroup>
      ) : months.data?.length ? (
        <Archive months={months.data} today={today} />
      ) : null}
    </div>
  );
}
