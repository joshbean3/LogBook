import type * as React from 'react';
import { fmtDate, LEARNING_MAX, shiftDays, type Learning } from '@logbook/shared';
import { Search, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTabScroller } from '@/app/NavController';
import { revealField } from '@/lib/keyboard';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui/NavBar';
import { Button } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';
import { useLearnedMutations, useLearnings, useLearningStats } from './queries';
import './learned.css';

/** Oldest first within a day: the order they were written. */
const byTime = (a: Learning, b: Learning) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 days in a row · 48 things learned"; a run under two days is not a headline. */
export const statsWords = (s: { days: number; streak: number; total: number }) => {
  const things = plural(s.total, 'thing') + ' learned';
  if (s.streak >= 2) return `${s.streak} days in a row · ${things}`;
  return s.days > 1 ? `${things} over ${s.days} days` : things;
};

/** A field that grows with its words and never scrolls inside itself. */
const useGrow = (ref: React.RefObject<HTMLTextAreaElement | null>, text: string) =>
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, text]);

/**
 * The words and Save. `hero`: the day's first, at the size of the prompt above it. `quiet`: "Add another", one line until
 * there are words, Save only then. ⌘/Ctrl+Enter saves. The field is kept above the keyboard on focus (`revealField`).
 */
const Composer = ({ today, quiet }: { today: string; quiet?: boolean }) => {
  const { add } = useLearnedMutations(today);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  useGrow(ref, text);
  const v = text.trim();
  const save = () => {
    if (!v) return;
    setText('');
    add.mutate({ date: today, text: v }, { onError: () => (setText(v), toast('Couldn’t save that. Your words are back in the field.')) });
  };
  return (
    <div className={`ln-compose ${quiet ? 'is-quiet' : ''}`}>
      <textarea
        ref={ref}
        className="ln-field"
        rows={quiet ? 1 : 3}
        maxLength={LEARNING_MAX}
        placeholder={quiet ? 'Add another' : 'One thing, in a sentence or two'}
        aria-label={quiet ? 'Add another thing you learned today' : 'What you learned today'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => revealField(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      {!quiet || v ? (
        <div className="ln-compose-foot">
          <Pressable as="button" className={`ln-save ${v ? 'is-ready' : ''}`} disabled={!v} onPress={save} label="Save">
            Save
          </Pressable>
        </div>
      ) : null}
    </div>
  );
};

/** Behind a tap on a learning: its words to change, Save, and Delete (with Undo). */
const LearningSheet = ({ item, today }: { item: Learning; today: string }) => {
  const sheet = useSheet();
  const { edit, del } = useLearnedMutations(today);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(item.text);
  useGrow(ref, text);
  const v = text.trim();
  const save = () => {
    if (v && v !== item.text) edit.mutate({ item, text: v });
    sheet.close();
  };
  return (
    <div className="ln-sheet">
      <textarea
        ref={ref}
        className="ln-field ln-sheet-field"
        rows={3}
        maxLength={LEARNING_MAX}
        value={text}
        aria-label="What you learned"
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => revealField(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="sheet-foot">
        <Button
          variant="quiet"
          className="ln-del"
          onClick={() => {
            sheet.close();
            del(item);
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Delete
        </Button>
        <div className="foot-right">
          <Button variant="primary" onClick={save} disabled={!v || v === item.text}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

const useOpenLearning = (today: string) => {
  const sheet = useSheet();
  return (item: Learning) =>
    sheet.open({
      eyebrow: item.date === today ? 'Today' : item.date === shiftDays(today, -1) ? 'Yesterday' : fmtDate('dowLong', item.date),
      title: fmtDate('md', item.date),
      sticky: true,
      body: <LearningSheet item={item} today={today} />,
    });
};

/** One learning as serif words; a tap opens it. */
const Line = ({ item, onOpen, className = '' }: { item: Learning; onOpen: (l: Learning) => void; className?: string }) => (
  <Pressable as="button" className={`ln-line ${className}`} press="dim" onPress={() => onOpen(item)} label={`${item.text}. Edit`}>
    {item.text}
  </Pressable>
);

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

interface Month {
  month: string;
  days: Array<{ date: string; items: Learning[] }>;
}
/** Newest month first, newest day first, each day's learnings in the order they were written. */
const groupByMonth = (rows: Learning[]): Month[] => {
  const months: Month[] = [];
  for (const r of rows) {
    const m = r.date.slice(0, 7);
    let month = months[months.length - 1];
    if (!month || month.month !== m) months.push((month = { month: m, days: [] }));
    let day = month.days[month.days.length - 1];
    if (!day || day.date !== r.date) month.days.push((day = { date: r.date, items: [] }));
    day.items.push(r);
  }
  for (const m of months) for (const d of m.days) d.items.sort(byTime);
  return months;
};

/**
 * What I learned (the tab root): today's card, the stats line, then every day before it, newest first, under month
 * headings. Older pages load as the end of the list comes into view; the search filters what has loaded.
 */
export default function LearnedView(): React.JSX.Element {
  const today = useToday();
  const list = useLearnings();
  const stats = useLearningStats();
  const open = useOpenLearning(today);
  const [q, setQ] = useState('');
  const scroller = useTabScroller();
  const end = useRef<HTMLDivElement>(null);

  const all = useMemo(() => list.data?.pages.flatMap((p) => p.learnings) ?? [], [list.data]);
  const todays = useMemo(() => all.filter((l) => l.date === today).sort(byTime), [all, today]);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (needle ? all.filter((l) => l.text.toLowerCase().includes(needle)) : all.filter((l) => l.date < today)), [all, needle, today]);
  const months = useMemo(() => groupByMonth(shown), [shown]);
  const hasPast = all.some((l) => l.date < today) || list.hasNextPage;

  // the next page when the end of the list comes into view (a screen early)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const el = end.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && void fetchNextPage(), { root: scroller.current, rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, scroller, months.length]);

  const s = stats.data;
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
        {list.isPending || !s ? ' ' : s.total > 0 ? statsWords(s) : 'One thing a day. They gather here.'}
      </p>
      {hasPast ? (
        <label className="ln-search">
          <Search size={16} aria-hidden="true" className="ln-search-icon" />
          <input className="ln-search-in" type="search" enterKeyHint="search" placeholder="Search what you learned" aria-label="Search what you learned" value={q} onChange={(e) => setQ(e.target.value)} onFocus={(e) => revealField(e.currentTarget)} />
          {q ? (
            <button type="button" className="ln-search-clear" aria-label="Clear search" onClick={() => setQ('')}>
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
        </label>
      ) : null}
      {needle && !months.length && !list.hasNextPage ? <p className="ln-none">Nothing you learned matches “{q.trim()}”.</p> : null}
      <div className="ln-past">
        {months.map((m) => (
          <section key={m.month} className="ln-month" aria-label={fmtDate('month', `${m.month}-01`)}>
            <h3 className="ln-month-title">{fmtDate('month', `${m.month}-01`)}</h3>
            {m.days.map((d) => (
              <div key={d.date} className="ln-day">
                <span className="caps ln-day-caps">{d.date === today ? 'Today' : d.date === shiftDays(today, -1) ? `Yesterday, ${fmtDate('md', d.date)}` : `${fmtDate('dowLong', d.date)}, ${fmtDate('md', d.date)}`}</span>
                {d.items.map((l) => (
                  <Line key={l.id} item={l} onOpen={open} />
                ))}
              </div>
            ))}
          </section>
        ))}
      </div>
      <div ref={end} className="ln-end" aria-hidden="true" />
      {list.isFetchingNextPage ? (
        <SkeletonGroup label="Loading older" className="ln-more">
          <Skeleton w="40%" h={12} />
          <Skeleton w="85%" h={20} />
        </SkeletonGroup>
      ) : null}
    </div>
  );
}
