import { fmtDate, monthOf, shiftDays, type JournalEntry } from '@logbook/shared';
import { ChevronRight, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { fadeIn, useReduced } from '@/lib/motion';
import { IconButton } from '@/ui';
import { useToast } from '@/ui/Toast';
import { Calendar, DayOrb } from './Calendar';
import { keepAboveKeyboard, revealBox } from '../day/reveal';
import { watchJournalAdd } from '../day/journalGuard';
import { anchorFor, dayTitle, monthGrid, orbVariant, pageHolds, readView, saveView, switchAnchor, weekDays, type CalView } from './calDays';
import { getDraft, getEdit, holdSent, SAVE_FAILED, setDraft, setEdit } from './drafts';
import { timeOf } from './JournalDaySection';
import { QuoteLine, Timeline } from './JournalHome';
import { useDayPrompt } from './prompt';
import { useDraftOwner, useJournalDays, useJournalFeed, useJournalWrites } from './queries';
import '../goals/kit.css';
import './calendar.css';

type WriteReq = { date: string; n: number } | null;
/** The server's limit for one entry (zJournalInput); the counter shows from here on. */
const MAX_CHARS = 5000;
const COUNT_FROM = 4500;
/** How far back "years ago" looks under an open day. */
const YEARS_BACK = 5;
const yearsBack = (date: string, k: number) => `${Number(date.slice(0, 4)) - k}${date.slice(4)}`;

/**
 * The Journal segment under Remember when: the calendar (Week or Month, remembered on this device), the day card that
 * opens under it, then every entry. Tap today to write today's memory; tap a past day to read it. `focusKey` (a quote
 * sent from the Library) opens today's writer; `openDay` (Remember when's words) opens that day.
 */
export const JournalCalendarPane = ({ today, focusKey = 0, openDay = null }: { today: string; focusKey?: number; openDay?: { date: string; n: number } | null }) => {
  useDraftOwner();
  const feed = useJournalFeed(true);
  const all = feed.entries;
  const reduce = useReduced();
  const [view, setView] = useState<CalView>(readView);
  const [anchor, setAnchor] = useState(today);
  const [open, setOpen] = useState<string | null>(null);
  // the calendar's days come from the months on screen (and the open day's, and the same day in the years before it),
  // so a month the list has not reached still shows what was written in it
  const months = useMemo(() => {
    const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor).filter((d): d is string => !!d);
    const back = open ? Array.from({ length: YEARS_BACK }, (_, i) => yearsBack(open, i + 1)) : [];
    return [...new Set([...days, ...(open ? [open] : []), ...back].map(monthOf))].sort();
  }, [view, anchor, open]);
  const { byDate, loading } = useJournalDays(feed, months);
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
      <Calendar today={today} byDate={byDate} loading={loading} view={view} onView={changeView} anchor={anchor} onAnchor={setAnchor} open={open} onPick={pick} writingToday={writingToday} />
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
        <Timeline today={today} all={all} pending={feed.pending} total={feed.total} more={feed.more} loadingOlder={feed.loadingOlder} onOlder={feed.loadOlder} onWrite={() => show(today, true)} />
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
  const w = useJournalWrites();
  const qc = useQueryClient();
  const toast = useToast();
  const reduce = useReduced();
  const prompt = useDayPrompt(date);
  // 'new': a new memory; an entry: that one being edited (followed by its id, the object changes with every refetch)
  const [writing, setWriting] = useState<'new' | JournalEntry | null>(null);
  const [text, setText] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const isToday = date === today;
  const variant = orbVariant(entries);
  const here = useRef(true);
  const writingNow = useRef(writing);
  writingNow.current = writing;
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);

  const startNew = () => {
    setText(getDraft(date));
    setWriting('new');
  };
  const startEdit = (e: JournalEntry) => {
    setText(getEdit(e.id) ?? e.text);
    setWriting(e);
  };
  useEffect(() => {
    if (writeReq && writeReq.date === date) startNew();
  }, [writeReq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (writing)
      requestAnimationFrame(() => {
        field.current?.focus({ preventScroll: true });
        // the whole writer, Save included, clear of the keyboard (the WebView does not resize for it)
        revealBox(box.current);
      });
    onWriting(writing === 'new' && isToday);
  }, [writing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onWriting(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const t = text.trim();
    if (writing === 'new') {
      if (t) {
        // the words stay on the device until the server or the outbox has them; a refused save puts them back in the
        // day's draft (journalGuard, which hears the answer whether or not this card is still open) and says so
        const release = holdSent(date, t);
        setDraft(date, '');
        void w.add({ date, text: t }).then((ok) => (ok ? release() : setTimeout(release, 0)));
        watchJournalAdd(qc, date, {
          toast: () => toast(SAVE_FAILED),
          onRefused: () => {
            if (here.current && !writingNow.current) startNew();
          },
        });
        haptics.orb();
      } else setDraft(date, '');
    } else if (writing) {
      const e = writing;
      if (!t) {
        void w.remove(e);
        toast('Memory removed', { label: 'Undo', fn: () => void w.add({ date, text: e.text }) });
      } else if (t !== e.text) {
        void w.patch({ entry: e, text: t }).then((ok) => {
          setEdit(e.id, ok ? null : t);
          if (ok) return;
          toast(SAVE_FAILED);
          // the editor opens again on the words, unless something else is being written by now
          if (here.current && !writingNow.current) startEdit(e);
        });
      } else setEdit(e.id, null);
    }
    setWriting(null);
  };

  const year = useMemo(() => {
    for (let k = 1; k <= YEARS_BACK; k++) {
      const d = yearsBack(date, k);
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
    <div ref={box} className="jday-write">
      <textarea
        ref={field}
        className="jday-field"
        value={text}
        maxLength={MAX_CHARS}
        data-no-reveal=""
        onFocus={() => revealBox(box.current)}
        aria-label={writing === 'new' ? `A memory for ${isToday ? 'today' : fmtDate('long', date)}` : 'Edit this memory'}
        placeholder={writing === 'new' && isToday ? prompt : 'Write a memory'}
        rows={4}
        onChange={(e) => {
          setText(e.target.value);
          if (writing === 'new') setDraft(date, e.target.value);
          keepAboveKeyboard(box.current);
        }}
      />
      {writing === 'new' && isToday ? <QuoteLine date={date} onInsert={(q) => setText((t) => (t ? `${t}\n${q}` : q))} /> : null}
      <div className="jday-write-foot">
        {text.length >= COUNT_FROM ? (
          <span className="jday-count" role="status">
            {text.length.toLocaleString('en-US')} of {MAX_CHARS.toLocaleString('en-US')}
          </span>
        ) : null}
        <button
          type="button"
          className="jday-btn is-quiet"
          onClick={() => {
            if (writing && writing !== 'new') setEdit(writing.id, null);
            setWriting(null);
          }}
        >
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
              {writing !== 'new' && writing?.id === e.id ? (
                writer
              ) : (
                <button
                  type="button"
                  className="jday-memory"
                  aria-label={`${e.text}. ${timeOf(e.createdAt)}. Edit`}
                  onClick={() => startEdit(e)}
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
