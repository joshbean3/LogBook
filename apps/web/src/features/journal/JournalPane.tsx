import { fmtDate, monthOf, shiftDays, type JournalEntry } from '@logbook/shared';
import { ChevronRight, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { fadeIn, springs, useReduced } from '@/lib/motion';
import { IconButton } from '@/ui';
import { useToast } from '@/ui/Toast';
import { FavoriteIcon } from '@/ui/icons';
import { Calendar, DayDisc } from './Calendar';
import { keepAboveKeyboard, revealBox } from '../day/reveal';
import { watchJournalAdd } from '../day/journalGuard';
import { anchorFor, dayTitle, dayTitleShort, monthGrid, orbVariant, pageHolds, readView, saveView, switchAnchor, weekDays, type CalView } from './calDays';
import { getDraft, holdSent, SAVE_FAILED, setDraft } from './drafts';
import { entryWhen, useOpenEntry } from './JournalDaySection';
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
 * Journal under Remember when: the calendar (Week or Month, remembered on this device), the day card that opens under it,
 * then every entry. Tap a day to open it; today opens on its writer while it has no entry. `openDay` (Remember when's
 * words) opens that day.
 */
export const JournalCalendarPane = ({ today, openDay = null }: { today: string; openDay?: { date: string; n: number } | null }) => {
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
  const { byDate, loading, failed, retry } = useJournalDays(feed, months);
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
  // today opens on its writer only while nothing is written; with entries it opens to read, "Add another" under them
  const pick = (d: string) => show(d, d === today && !byDate.get(today)?.length);

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
      <Calendar today={today} byDate={byDate} loading={loading} failed={failed} onRetry={feed.failed ? undefined : retry} view={view} onView={changeView} anchor={anchor} onAnchor={setAnchor} open={open} onPick={pick} writingToday={writingToday} />
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
        <Timeline today={today} all={all} pending={feed.pending} failed={feed.failed} onRetry={feed.retry} total={feed.total} more={feed.more} loadingOlder={feed.loadingOlder} onOlder={feed.loadOlder} onWrite={() => show(today, true)} />
      </div>
    </div>
  );
};

const countWords = (n: number) => (n === 1 ? '1 entry' : `${n} entries`);
/** The writer grows with the words up to about half the screen, then scrolls inside itself. */
const growField = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  const max = Math.round(window.innerHeight * 0.5);
  el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
};

/**
 * One day: its mark, its name and its entries, then "Add another", or "Write an entry" on a day without one. A tap on an
 * entry opens the same sheet as the Entries list (Edit, Favorite, Share, Delete with Undo). Saving a new entry lands
 * with the orb haptic. A swipe across the card goes a day back or on. Under it, what was written on this day in an
 * earlier year, if anything.
 */
const DayCard = ({ date, today, byDate, writeReq, onDay, onClose, onWriting }: { date: string; today: string; byDate: Map<string, JournalEntry[]>; writeReq: WriteReq; onDay: (d: string) => void; onClose: () => void; onWriting: (on: boolean) => void }) => {
  const entries = byDate.get(date) ?? [];
  const w = useJournalWrites();
  const qc = useQueryClient();
  const toast = useToast();
  const reduce = useReduced();
  const prompt = useDayPrompt(date);
  const openEntry = useOpenEntry();
  const [writing, setWriting] = useState(false);
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
    setWriting(true);
  };
  useEffect(() => {
    if (writeReq && writeReq.date === date) startNew();
  }, [writeReq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (writing)
      requestAnimationFrame(() => {
        growField(field.current);
        field.current?.focus({ preventScroll: true });
        // the whole writer, Save included, clear of the tab bar at once (its scroll-margin), then of the keyboard once it
        // has risen (the WebView does not resize for it)
        box.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
        revealBox(box.current);
      });
    onWriting(writing && isToday);
  }, [writing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onWriting(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => growField(field.current), [text]);

  const edit = (v: string) => {
    setText(v);
    setDraft(date, v);
  };
  const save = () => {
    const t = text.trim();
    if (!t) return;
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
    setWriting(false);
  };
  // the day's quote goes on top of the words with a blank line under it, and into the draft, as Close the day's quote line does
  const useQuote = (q: string) => {
    const next = text.trim() ? `${q}\n\n${text}` : `${q}\n\n`;
    edit(next);
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(next.length, next.length);
    });
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
  const sub = named ? `${fmtDate('long', date)}${entries.length ? ` · ${countWords(entries.length)}` : ''}` : entries.length ? countWords(entries.length) : null;

  const writer = (
    <div ref={box} className="jday-write">
      <textarea
        ref={field}
        className="jday-field"
        value={text}
        maxLength={MAX_CHARS}
        data-no-reveal=""
        onFocus={() => revealBox(box.current)}
        aria-label={isToday ? 'Today’s entry' : `An entry for ${dayTitle(date, today)}`}
        placeholder={isToday ? prompt : 'Write an entry'}
        rows={4}
        onChange={(e) => {
          edit(e.target.value);
          keepAboveKeyboard(box.current);
        }}
      />
      {isToday ? <QuoteLine date={date} labelled onInsert={useQuote} /> : null}
      <div className="jday-write-foot">
        {text.length >= COUNT_FROM ? (
          <span className="jday-count" role="status">
            {text.length.toLocaleString('en-US')} of {MAX_CHARS.toLocaleString('en-US')}
          </span>
        ) : null}
        <button type="button" className="jday-btn is-quiet" onClick={() => setWriting(false)}>
          Cancel
        </button>
        <button type="button" className="jday-btn" onClick={save} disabled={!text.trim()}>
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
        <motion.span key={variant ?? 'none'} className="jday-orb" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springs.complete}>
          {variant ? <DayDisc variant={variant} size={34} n={entries.length} /> : <span className="jday-ring" aria-hidden="true" />}
        </motion.span>
        <div className="jday-titles">
          <h2 className="jday-title">
            <span className="jday-title-l">{dayTitle(date, today)}</span>
            <span className="jday-title-s">{dayTitleShort(date, today)}</span>
          </h2>
          {sub ? <span className="jday-sub">{sub}</span> : null}
        </div>
        <IconButton className="bare jday-close" label="Close day" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>

      {entries.length ? (
        <ul className="jday-list">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" className="jday-memory" aria-label={`${e.text}. ${entryWhen(e)}${e.fav ? ', a favorite' : ''}`} onClick={() => openEntry(e)}>
                <span className="jday-memory-t">{e.text}</span>
                <span className="jday-memory-m">
                  {entryWhen(e)}
                  {e.fav ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <FavoriteIcon size={13} fill="currentColor" strokeWidth={0} className="jday-fav" />
                      Favorite
                    </>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : !writing ? (
        <p className="jday-empty">{isToday ? 'Nothing yet today. A line or two is plenty.' : 'Nothing written this day.'}</p>
      ) : null}

      {writing ? (
        writer
      ) : (
        <button type="button" className={`jday-add ${entries.length ? '' : 'is-first'}`} onClick={startNew}>
          <Plus size={18} aria-hidden="true" />
          {entries.length ? 'Add another' : 'Write an entry'}
        </button>
      )}

      {year && !writing ? (
        <button type="button" className="jday-ago" onClick={() => onDay(year.d)}>
          <span className="jday-ago-k">
            This day in {year.d.slice(0, 4)} <ChevronRight size={13} aria-hidden="true" />
          </span>
          <span className="jday-ago-t">{year.e.text}</span>
        </button>
      ) : null}
    </section>
  );
};
