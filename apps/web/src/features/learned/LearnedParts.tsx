import type * as React from 'react';
import { fmtDate, LEARNING_MAX, shiftDays, type Learning } from '@logbook/shared';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTabScroller } from '@/app/NavController';
import { revealField } from '@/lib/keyboard';
import { Button } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { KPin, KTrash } from '../goals/Kit';
import { submitDraft, todayDraft } from './draft';
import { useLearnedMutations } from './queries';

/* The pieces the tab and a month's page share: the field, the edit sheet, a learning as words, days under month headings. */

/** Oldest first within a day: the order they were written. */
export const byTime = (a: Learning, b: Learning) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 days in a row · 48 things learned"; a run under two days is not a headline. */
export const statsWords = (s: { days: number; streak: number; total: number }) => {
  const things = plural(s.total, 'thing') + ' learned';
  if (s.streak >= 2) return `${s.streak} days in a row · ${things}`;
  return s.days > 1 ? `${things} over ${s.days} days` : things;
};

/** A field that grows with its words and never scrolls inside itself. */
const useGrow = (ref: React.RefObject<HTMLTextAreaElement | null>, text: string, rows = 0) =>
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [ref, text, rows]);

/**
 * The words and Save. `hero`: the day's first, at the size of the prompt above it. `quiet`: "Add another", one line until
 * there are words, Save only then. ⌘/Ctrl+Enter saves. The field is kept above the keyboard on focus (`revealField`).
 * One field serves both: it stays mounted when the day's first learning lands, and its words live in `todayDraft`, so a
 * save the server rejects puts them back in the field whichever state the card is in by then.
 */
export const Composer = ({ today, quiet }: { today: string; quiet?: boolean }) => {
  const { add } = useLearnedMutations(today);
  const toast = useToast();
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = useSyncExternalStore(todayDraft.subscribe, todayDraft.get, todayDraft.get);
  const rows = quiet ? 1 : 3;
  useGrow(ref, text, rows);
  const v = text.trim();
  const save = () => submitDraft(todayDraft, (words) => add.mutateAsync({ date: today, text: words }), () => toast('Couldn’t save that. Your words are back in the field.'));
  return (
    <div className={`ln-compose ${quiet ? 'is-quiet' : ''}`}>
      <textarea
        ref={ref}
        className="ln-field"
        rows={rows}
        maxLength={LEARNING_MAX}
        placeholder={quiet ? 'Add another' : 'One thing, in a sentence or two'}
        aria-label={quiet ? 'Add another thing you learned today' : 'What you learned today'}
        value={text}
        onChange={(e) => todayDraft.set(e.target.value)}
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
  const { edit } = useLearnedMutations(today);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(item.text);
  useGrow(ref, text);
  const v = text.trim();
  const save = () => {
    if (v && v !== item.text) edit.mutate({ item, text: v });
    sheet.close();
  };
  return (
    <div className="ln-sheet k-sheet">
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
      <KPin>
        <Button variant="primary" block onClick={save} disabled={!v || v === item.text}>
          Save
        </Button>
      </KPin>
    </div>
  );
};

export const useOpenLearning = (today: string) => {
  const sheet = useSheet();
  const { del } = useLearnedMutations(today);
  return (item: Learning) =>
    sheet.open({
      eyebrow: item.date === today ? 'Today' : item.date === shiftDays(today, -1) ? 'Yesterday' : fmtDate('dowLong', item.date),
      title: fmtDate('md', item.date),
      sticky: true,
      action: <KTrash label="Delete" title="Delete this?" what={item.text} words="It leaves What I learned. Undo brings it back." verb="Delete" onConfirm={() => del(item)} />,
      body: <LearningSheet item={item} today={today} />,
    });
};

/** One learning as serif words; a tap opens it. */
export const Line = ({ item, onOpen, className = '' }: { item: Learning; onOpen: (l: Learning) => void; className?: string }) => (
  <Pressable as="button" className={`ln-line ${className}`} press="dim" onPress={() => onOpen(item)} label={`${item.text}. Edit`}>
    {item.text}
  </Pressable>
);

export interface Month {
  month: string;
  days: Array<{ date: string; items: Learning[] }>;
}
/** Newest month first, newest day first, each day's learnings in the order they were written. */
export const groupByMonth = (rows: Learning[]): Month[] => {
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


/** A day's caption: Today, Yesterday, else the weekday and the date. */
export const dayWords = (date: string, today: string) =>
  date === today ? 'Today' : date === shiftDays(today, -1) ? `Yesterday, ${fmtDate('md', date)}` : `${fmtDate('dowLong', date)}, ${fmtDate('md', date)}`;

/** A month's days, newest first, each with its learnings as serif lines (a tap opens one). */
export const Days = ({ days, today, onOpen }: { days: Month['days']; today: string; onOpen: (l: Learning) => void }) => (
  <>
    {days.map((d) => (
      <div key={d.date} className="ln-day">
        <span className="caps ln-day-caps">{dayWords(d.date, today)}</span>
        {d.items.map((l) => (
          <Line key={l.id} item={l} onOpen={onOpen} />
        ))}
      </div>
    ))}
  </>
);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** 'November' for '2026-11'. */
export const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;

/** Load the next page when `end` comes within a screen of view. */
export const useLoadMore = (end: React.RefObject<HTMLElement | null>, q: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown }) => {
  const scroller = useTabScroller();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = end.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && void fetchNextPage(), { root: scroller.current, rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  });
};

