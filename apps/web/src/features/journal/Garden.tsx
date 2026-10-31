import { shiftDays, type JournalEntry } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useJournalList, useJournalMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { getDraft, setDraft } from './drafts';
import { QuoteLine, Timeline } from './JournalHome';
import { Plant, PlantButtonGlyph } from './plants';
import { useDayPrompt } from './prompt';
import './garden.css';

const COLS = 14;
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const at = (d: string) => new Date(`${d}T12:00:00`);
/** One Year's way of naming a day: `today`, `yesterday`, else `sunday, 03.15`. */
export const dayWords = (d: string, today: string) => (d === today ? 'today' : d === shiftDays(today, -1) ? 'yesterday' : `${WEEKDAY.format(at(d)).toLowerCase()}, ${d.slice(5, 7)}.${d.slice(8, 10)}`);

// the garden grows in once a session, the first time it is seen; after that it is simply there
let grown = false;

export type GardenMode = 'garden' | 'day';

/**
 * The Journal (after One Year): the year as a garden and each day as a page. The garden is the year's days in rows of
 * dots; a day with a memory has grown a plant, today is the little house. A touch names the day; a tap opens it. The day
 * page carries the days around it as a row of plants, its name, and its memory in the typewriter ink, or the hand-drawn
 * plus to plant one. Planting draws the day's plant in. The pill at the bottom switches between the two.
 */
export const JournalGarden = ({ today, focusKey = 0 }: { today: string; focusKey?: number }) => {
  const list = useJournalList('', false);
  const all = useMemo(() => list.data?.entries ?? [], [list.data]);
  const byDate = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const e of all) m.set(e.date, [...(m.get(e.date) ?? []), e].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)));
    return m;
  }, [all]);
  // open on today's page until today has a memory; on the garden after
  const [mode, setMode] = useState<GardenMode>(() => (byDate.has(today) ? 'garden' : 'day'));
  const [day, setDay] = useState(today);
  const [writeKey, setWriteKey] = useState(0);
  useEffect(() => {
    if (!focusKey) return;
    setDay(today);
    setMode('day');
    setWriteKey((k) => k + 1);
  }, [focusKey, today]);
  const open = (d: string) => {
    setDay(d);
    setMode('day');
  };
  return (
    <div className="gdn">
      {mode === 'garden' ? <Garden today={today} byDate={byDate} all={all} pending={!list.data} onOpen={open} /> : <DayPage key={day} date={day} today={today} byDate={byDate} onDay={setDay} writeKey={writeKey} />}
      <div className="gdn-toggle" role="tablist" aria-label="Garden or day">
        <button type="button" role="tab" aria-selected={mode === 'garden'} className={mode === 'garden' ? 'is-on' : ''} aria-label="The year" onClick={() => (setMode('garden'), haptics.select())}>
          <Plant date="2026-03-01" size={22} />
          <Plant date="2026-03-04" size={18} />
        </button>
        <button type="button" role="tab" aria-selected={mode === 'day'} className={mode === 'day' ? 'is-on' : ''} aria-label="The day" onClick={() => (setMode('day'), haptics.select())}>
          <Plant date={day} size={22} />
        </button>
      </div>
    </div>
  );
};

const Garden = ({ today, byDate, all, pending, onOpen }: { today: string; byDate: Map<string, JournalEntry[]>; all: JournalEntry[]; pending: boolean; onOpen: (d: string) => void }) => {
  const reduce = useReduced();
  const sheet = useSheet();
  const years = useMemo(() => [...new Set([today.slice(0, 4), ...all.map((e) => e.date.slice(0, 4))])].sort(), [all, today]);
  const [year, setYear] = useState(today.slice(0, 4));
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = `${year}-01-01`; d.startsWith(year); d = shiftDays(d, 1)) out.push(d);
    return out;
  }, [year]);
  const [named, setNamed] = useState<{ d: string; x: number; y: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const first = useRef(!grown && !reduce);
  useEffect(() => {
    grown = true;
  }, []);
  const planted = days.filter((d) => byDate.has(d)).length;
  const left = year === today.slice(0, 4) ? days.filter((d) => d > today).length : 0;
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-day]');
    return el && grid.current?.contains(el) ? el : null;
  };
  const name = (el: HTMLElement | null) => {
    if (!el || !grid.current) return;
    const d = el.dataset.day!;
    if (named?.d !== d) haptics.select();
    const g = grid.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setNamed({ d, x: r.left - g.left + r.width / 2, y: r.top - g.top });
  };
  const nextYear = () => {
    const i = years.indexOf(year);
    setYear(years[(i + 1) % years.length]!);
    haptics.select();
  };
  // planted days grow in row by row, the first time
  let n = 0;
  return (
    <div className="gdn-year">
      <button type="button" className="gdn-pill is-solid" onClick={nextYear} aria-label={`${year}. ${years.length > 1 ? 'Show another year' : ''}`}>
        {year}
      </button>
      <div
        ref={grid}
        className="gdn-grid"
        style={{ '--cols': COLS } as React.CSSProperties}
        onPointerDown={(e) => name(cellAt(e.clientX, e.clientY))}
        onPointerMove={(e) => e.buttons && name(cellAt(e.clientX, e.clientY))}
        onPointerLeave={() => setNamed(null)}
      >
        {days.map((d) => {
          const has = byDate.has(d);
          const isToday = d === today;
          const future = d > today;
          const delay = has && first.current ? Math.min(1.2, 0.03 * n++) : 0;
          return (
            <button
              key={d}
              type="button"
              data-day={d}
              className={`gdn-cell ${has ? 'has' : ''} ${isToday ? 'is-today' : ''} ${future ? 'is-future' : ''}`}
              aria-label={`${dayWords(d, today)}${has ? ', a memory' : ''}`}
              disabled={future}
              onClick={() => {
                setNamed(null);
                onOpen(d);
              }}
            >
              {has || isToday ? (
                <motion.span className="gdn-plant" initial={first.current ? { scale: 0, opacity: 0, y: 6 } : false} animate={{ scale: 1, opacity: 1, y: 0 }} transition={{ delay, type: 'spring', duration: 0.5, bounce: 0.45 }}>
                  <Plant date={d} house={isToday && !has} size={20} />
                </motion.span>
              ) : (
                <i className="gdn-dot" />
              )}
            </button>
          );
        })}
        <AnimatePresence>
          {named ? (
            <motion.span key="tip" className="gdn-pill gdn-tip is-solid" style={{ left: named.x, top: named.y }} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
              {dayWords(named.d, today)}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <p className="gdn-count">
        <b>{planted}</b> {planted === 1 ? 'day' : 'days'} of growth{left ? (
          <>
            {' · '}
            <b>{left}</b> days left
          </>
        ) : null}
      </p>
      {pending ? null : (
        <button type="button" className="gdn-link" onClick={() => sheet.open({ title: 'Every memory', detent: 'large', body: <Timeline today={today} all={all} pending={false} onWrite={() => (sheet.close(), onOpen(today))} /> })}>
          every memory <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

/** One day: the plants around it, its name, its memory (or the plus to plant one), and what it said a year ago. */
const DayPage = ({ date, today, byDate, onDay, writeKey }: { date: string; today: string; byDate: Map<string, JournalEntry[]>; onDay: (d: string) => void; writeKey: number }) => {
  const entries = byDate.get(date) ?? [];
  const { add, patch, remove } = useJournalMutations();
  const toast = useToast();
  const reduce = useReduced();
  const prompt = useDayPrompt(date);
  const [writing, setWriting] = useState<'new' | JournalEntry | null>(null);
  const [text, setText] = useState('');
  const [justPlanted, setJustPlanted] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const future = date > today;
  useEffect(() => {
    if (writeKey) startNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeKey]);
  useEffect(() => {
    if (writing) requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
  }, [writing]);
  const startNew = () => {
    setText(getDraft(date));
    setWriting('new');
  };
  const done = () => {
    const t = text.trim();
    if (writing === 'new') {
      setDraft(date, '');
      if (t) {
        const firstOfDay = !entries.length;
        add.mutate({ date, text: t });
        haptics.orb();
        if (firstOfDay) setJustPlanted(true);
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
  // the strip: the four days before, the day, and the days after it up to today (two at most)
  const strip = useMemo(() => {
    const out: string[] = [];
    for (let i = -4; i <= 2; i++) {
      const d = shiftDays(date, i);
      if (i > 0 && d > today) break;
      out.push(d);
    }
    return out;
  }, [date, today]);
  // a swipe across the page goes a day back or on
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const year = useMemo(() => {
    for (let k = 1; k <= 5; k++) {
      const d = `${Number(date.slice(0, 4)) - k}${date.slice(4)}`;
      const e = byDate.get(d)?.[0];
      if (e) return { d, e, k };
    }
    return null;
  }, [byDate, date]);
  return (
    <div
      className="gdn-day"
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
      <span className="gdn-pill">{dayWords(date, today)}</span>
      <div className="gdn-strip" aria-label="The days around it">
        {strip.map((d) => {
          const has = byDate.has(d);
          return (
            <button key={d} type="button" className={`gdn-strip-plant ${d === date ? 'is-on' : ''} ${has ? 'has' : ''}`} aria-label={dayWords(d, today)} onClick={() => onDay(d)}>
              <Plant date={d} house={d === today && !has} size={d === date ? 34 : 26} draw={d === date && justPlanted && !reduce} />
            </button>
          );
        })}
      </div>
      <div className="gdn-page">
        {writing ? (
          <div className="gdn-write">
            <textarea
              ref={field}
              className="gdn-field"
              value={text}
              placeholder={writing === 'new' && date === today ? prompt.toLowerCase() : 'add a memory…'}
              rows={5}
              onChange={(e) => {
                setText(e.target.value);
                if (writing === 'new') setDraft(date, e.target.value);
              }}
            />
            {writing === 'new' && date === today ? <QuoteLine date={date} onInsert={(q) => setText((t) => (t ? `${t}\n${q}` : q))} /> : null}
            <div className="gdn-write-foot">
              <button type="button" className="gdn-btn is-quiet" onClick={() => setWriting(null)}>
                cancel
              </button>
              <button type="button" className="gdn-btn" onClick={done}>
                done
              </button>
            </div>
          </div>
        ) : entries.length ? (
          <div className="gdn-memories">
            {entries.map((e) => (
              <button
                key={e.id}
                type="button"
                className="gdn-memory"
                onClick={() => {
                  setText(e.text);
                  setWriting(e);
                }}
              >
                {e.text}
              </button>
            ))}
            {!future ? (
              <button type="button" className="gdn-more" onClick={startNew}>
                + plant another
              </button>
            ) : null}
          </div>
        ) : future ? (
          <p className="gdn-empty">not yet</p>
        ) : (
          <button type="button" className="gdn-plantbtn" onClick={startNew}>
            <PlantButtonGlyph />
            <span>{date === today ? 'plant memory' : 'no memory · plant one'}</span>
          </button>
        )}
      </div>
      {year && !writing ? (
        <button type="button" className="gdn-ago" onClick={() => onDay(year.d)}>
          <span className="gdn-ago-k">
            {year.k === 1 ? 'one year ago' : `${year.k} years ago`} <ChevronRight size={12} aria-hidden="true" />
          </span>
          <span className="gdn-ago-t">{year.e.text}</span>
        </button>
      ) : null}
    </div>
  );
};
