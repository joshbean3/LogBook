import { fmtDate, shiftDays, type JournalEntry } from '@logbook/shared';
import { ChevronRight, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useJournalList, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { fadeIn, useReduced } from '@/lib/motion';
import { IconButton } from '@/ui';
import { useToast } from '@/ui/Toast';
import { Calendar, DayOrb } from './Calendar';
import { anchorFor, dayTitle, orbVariant, pageHolds, readView, saveView, switchAnchor, type CalView } from './calDays';
import { getDraft, setDraft } from './drafts';
import { timeOf } from './JournalDaySection';
import { QuoteLine, Timeline } from './JournalHome';
import { useDayPrompt } from './prompt';
import '../goals/kit.css';
import './calendar.css';

type WriteReq = { date: string; n: number } | null;

/**
 * The Journal segment under Remember when: the calendar (Week or Month, remembered on this device), the day card that
 * opens under it, then every entry. Tap today to write today's memory; tap a past day to read it. `focusKey` (a quote
 * sent from the Library) opens today's writer; `openDay` (Remember when's words) opens that day.
 */
export const JournalCalendarPane = ({ today, focusKey = 0, openDay = null }: { today: string; focusKey?: number; openDay?: { date: string; n: number } | null }) => {
  const list = useJournalList('', false);
  const all = useMemo(() => list.data?.entries ?? [], [list.data]);
  const byDate = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of all) m.set(e.date, [...(m.get(e.date) ?? []), e].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
    return m;
  }, [all]);
  const reduce = useReduced();
  const [view, setView] = useState<CalView>(readView);
  const [anchor, setAnchor] = useState(today);
  const [open, setOpen] = useState<string | null>(null);
  const [writeReq, setWriteReq] = useState<WriteReq>(null);
  const [writingToday, setWritingToday] = useState(false);
  const [seq, setSeq] = useState(0);
  const card = useRef<HTMLDivElement>(null);

  const viewRef = useRef(view);
  viewRef.current = view;
  const todayRef = useRef(today);
  todayRef.current = today;
  const show = useCallback((d: string, write = false) => {
    setOpen(d);
    setAnchor((a) => (pageHolds(a, viewRef.current, d) ? a : anchorFor(d, viewRef.current, todayRef.current)));
    setWriteReq((r) => (write ? { date: d, n: (r?.n ?? 0) + 1 } : null));
    setSeq((s) => s + 1);
  }, []);
  const pick = (d: string) => (d === today ? show(d, true) : show(d));

  useEffect(() => {
    if (focusKey) show(today, true);
  }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (openDay) show(openDay.date);
  }, [openDay]); // eslint-disable-line react-hooks/exhaustive-deps
  // the day card comes into view when a day is opened (it may sit under the fold of a month)
  useEffect(() => {
    if (!seq) return;
    const id = requestAnimationFrame(() => card.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }));
    return () => cancelAnimationFrame(id);
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeView = (v: CalView) => {
    setView(v);
    saveView(v);
    setAnchor((a) => switchAnchor(a, view, v, today, open));
  };

  return (
    <div className="jpane">
      <Calendar today={today} byDate={byDate} view={view} onView={changeView} anchor={anchor} onAnchor={setAnchor} open={open} onPick={pick} writingToday={writingToday} />
      <div ref={card} className="jday-slot">
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div key="day" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fadeIn}>
              <DayCard key={open} date={open} today={today} byDate={byDate} writeReq={writeReq} onDay={show} onClose={() => setOpen(null)} onWriting={setWritingToday} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div id="j-entries" className="j-entries">
        <Timeline today={today} all={all} pending={!list.data} onWrite={() => show(today, true)} />
      </div>
    </div>
  );
};

const countWords = (n: number) => (n === 0 ? 'No memories' : n === 1 ? '1 memory' : `${n} memories`);

/**
 * One day: its orb, its name and its memories (tap one to edit it; empty it to remove it, with Undo), then "Add another",
 * or "Write a memory" on a day without one. Saving a new memory lands with the orb haptic. A swipe across the card goes a
 * day back or on. Under it, what was written on this day a year ago, if anything.
 */
const DayCard = ({ date, today, byDate, writeReq, onDay, onClose, onWriting }: { date: string; today: string; byDate: Map<string, JournalEntry[]>; writeReq: WriteReq; onDay: (d: string) => void; onClose: () => void; onWriting: (on: boolean) => void }) => {
  const entries = byDate.get(date) ?? [];
  const { add, patch, remove } = useJournalMutations();
  const toast = useToast();
  const reduce = useReduced();
  const prompt = useDayPrompt(date);
  const [writing, setWriting] = useState<'new' | JournalEntry | null>(null);
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const isToday = date === today;
  const variant = orbVariant(entries);

  const startNew = () => {
    setText(getDraft(date));
    setWriting('new');
  };
  useEffect(() => {
    if (writeReq && writeReq.date === date) startNew();
  }, [writeReq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (writing) requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    onWriting(writing === 'new' && isToday);
  }, [writing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onWriting(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const t = text.trim();
    if (writing === 'new') {
      setDraft(date, '');
      if (t) {
        add.mutate({ date, text: t });
        haptics.orb();
      }
    } else if (writing) {
      const e = writing;
      if (!t) {
        remove.mutate(e);
        toast('Memory removed', { label: 'Undo', fn: () => add.mutate({ date, text: e.text }) });
      } else if (t !== e.text) patch.mutate({ entry: e, text: t });
    }
    setWriting(null);
  };

  const year = useMemo(() => {
    for (let k = 1; k <= 5; k++) {
      const d = `${Number(date.slice(0, 4)) - k}${date.slice(4)}`;
      const e = byDate.get(d)?.[0];
      if (e) return { d, e, k };
    }
    return null;
  }, [byDate, date]);

  // a swipe across the card goes a day back or on (never past today)
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const named = isToday || date === shiftDays(today, -1);
  const sub = named ? `${fmtDate('long', date)}${entries.length ? ` · ${countWords(entries.length)}` : ''}` : countWords(entries.length);

  const writer = (
    <div className="jday-write">
      <textarea
        ref={field}
        className="jday-field"
        value={text}
        aria-label={writing === 'new' ? `A memory for ${isToday ? 'today' : fmtDate('long', date)}` : 'Edit this memory'}
        placeholder={writing === 'new' && isToday ? prompt : 'Write a memory'}
        rows={4}
        onChange={(e) => {
          setText(e.target.value);
          if (writing === 'new') setDraft(date, e.target.value);
        }}
      />
      {writing === 'new' && isToday ? <QuoteLine date={date} onInsert={(q) => setText((t) => (t ? `${t}\n${q}` : q))} /> : null}
      <div className="jday-write-foot">
        <button type="button" className="jday-btn is-quiet" onClick={() => setWriting(null)}>
          Cancel
        </button>
        <button type="button" className="jday-btn" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );

  return (
    <section
      className="jday"
      aria-label={dayTitle(date, today)}
      onPointerDown={(e) => (swipe.current = writing ? null : { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) < 70 || Math.abs(e.clientY - s.y) > 50) return;
        const next = shiftDays(date, dx < 0 ? 1 : -1);
        if (next <= today) {
          haptics.select();
          onDay(next);
        }
      }}
    >
      <div className="jday-head">
        <motion.span key={variant ?? 'none'} className="jday-orb" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', duration: 0.5, bounce: 0.4 }}>
          <DayOrb variant={variant} size={34} live={isToday && !entries.length} />
        </motion.span>
        <div className="jday-titles">
          <h2 className="jday-title">{dayTitle(date, today)}</h2>
          <span className="jday-sub">{sub}</span>
        </div>
        <IconButton className="bare jday-close" label="Close day" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>

      {entries.length ? (
        <ul className="jday-list">
          {entries.map((e) => (
            <li key={e.id}>
              {writing === e ? (
                writer
              ) : (
                <button
                  type="button"
                  className="jday-memory"
                  aria-label={`${e.text}. ${timeOf(e.createdAt)}. Edit`}
                  onClick={() => {
                    setText(e.text);
                    setWriting(e);
                  }}
                >
                  <span className="jday-memory-t">{e.text}</span>
                  <span className="jday-memory-m">
                    {timeOf(e.createdAt)}
                    {e.fav ? ' · Starred' : ''}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : writing !== 'new' ? (
        <p className="jday-empty">{isToday ? 'Nothing yet today. A line or two is plenty.' : 'Nothing written this day.'}</p>
      ) : null}

      {writing === 'new' ? (
        writer
      ) : (
        <button type="button" className={`jday-add ${entries.length ? '' : 'is-first'}`} onClick={startNew}>
          <Plus size={18} aria-hidden="true" />
          {entries.length ? 'Add another' : 'Write a memory'}
        </button>
      )}

      {year && !writing ? (
        <button type="button" className="jday-ago" onClick={() => onDay(year.d)}>
          <span className="jday-ago-k">
            {year.k === 1 ? 'One year ago' : `${year.k} years ago`} <ChevronRight size={13} aria-hidden="true" />
          </span>
          <span className="jday-ago-t">{year.e.text}</span>
        </button>
      ) : null}
    </section>
  );
};
