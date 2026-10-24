import { clock, floorFor, label, mi, num, shiftDays, type DayPhase, type ISODate, type PhaseSession } from '@logbook/shared';
import { ChevronRight, PenLine, Share } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type * as React from 'react';
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useMorningMutations, usePick, useSessionMutations, useTodos } from '@/api/queries';
import { WORD_MAX } from '@/lib/gesture';
import { revealField } from '@/lib/keyboard';
import { crossfade } from '@/lib/motion';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { Ticker } from '@/ui/Ticker';
import { useFirstToday } from '@/ui/useFirstToday';
import { getDraft, subscribeDrafts } from '../journal/drafts';
import { addToDraft, Composer } from '../journal/JournalDaySection';
import type { Log } from '../log/useLog';
import { morningOf } from '../morning/model';
import { shareDataFor } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { groupsOn } from '../todos/groups';
import { shortClock } from './dayWords';
import { HoldRing } from './HoldRing';
import { dayMiles, sessionMiles, weekMiles } from './miles';
import { markSuccess } from './useStravaLanding';
import { saveFocus, useFocus } from './WordSheet';

/*
 * The card's heavier parts load on their own (the Journal's quote line, the morning's alarm editor, Reads' pick), each in its
 * fixed slot, so they never weigh on Today's first paint; `preloadCloseDay` fetches them at the first idle moment.
 */
const loadQuote = () => import('../journal/JournalHome');
const loadWake = () => import('../morning/StepSheets');
const loadPick = () => import('../reads/TodaysPick');
const QuoteLine = lazy(() => loadQuote().then((m) => ({ default: m.QuoteLine })));
const TodaysPick = lazy(() => loadPick().then((m) => ({ default: m.TodaysPick })));
let preloaded = false;
export const preloadCloseDay = () => {
  if (preloaded) return;
  preloaded = true;
  const go = () => void Promise.all([loadQuote(), loadWake(), loadPick()]).catch(() => (preloaded = false));
  const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
};

/** The card's title before and after the day's first entry (§5 step 0). */
export const EVENING_TITLE = 'Two sentences, then sleep.';
export const CLOSED_TITLE = 'Day, closed.';
/** The composer's question (§5 step 3): the title already says "two sentences". */
export const CLOSE_ASK = 'How did today go?';
/** The stamps' count-up runs 60 ms apart (§5 step 1). */
const STAGGER_MS = 60;
/** The slots' crossfade (§5: 150 ms, opacity only), from lib/motion's `crossfade`. */
const CROSSFADE_MS = ((crossfade as { duration?: number }).duration ?? 0.15) * 1000;

type StampRow = { k: string; v: number; from: number; fmt: (v: number) => string; u?: string; said: string };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The day in numbers (§5 step 1), only the ones that happened, at most three: `MI 4.0` (a run marked done by hand counts its
 * planned miles), `HABITS 3 of 5`, `TO-DOS 2 done`. A stamp that would read zero is left out; when none is left, one plain
 * sentence takes the row ("2 to-dos left.", "Rest day."), never an instruction, and nothing the run row below already says.
 */
export const dayStamps = ({ miles, planned, lit, habits, doneTodos, openTodos, restDay, runShown }: { miles: number; planned: number; lit: number; habits: number; doneTodos: number; openTodos: number; restDay: boolean; runShown: boolean }) => {
  const stamps: StampRow[] = [];
  // the miles tick from the plan's (never a 0 mi frame, M32); counts from zero
  if (miles > 0) stamps.push({ k: 'Mi', v: miles, from: planned > 0 ? planned : miles, fmt: (v) => mi(v), said: `${mi(miles)} miles` });
  if (lit > 0) stamps.push({ k: 'Habits', v: lit, from: 0, fmt: (v) => String(Math.round(v)), u: `of ${habits}`, said: `${lit} of ${habits} habits` });
  if (doneTodos > 0) stamps.push({ k: 'To-dos', v: doneTodos, from: 0, fmt: (v) => String(Math.round(v)), u: 'done', said: `${doneTodos} to-dos done` });
  if (stamps.length) return { stamps, line: null };
  const bits: string[] = [];
  if (restDay && !runShown) bits.push('Rest day.');
  if (openTodos) bits.push(`${plural(openTodos, 'to-do', 'to-dos')} left.`);
  return { stamps, line: bits.length ? bits.join(' ') : runShown ? null : 'A quiet day.' };
};

/** A stamp's number: on the day's first view it counts up from `from`, each one `delay` after the last; later changes tick. */
const StampNum = ({ s, delay, once }: { s: StampRow; delay: number; once: string | null }) => {
  const first = useFirstToday(once);
  const [v, setV] = useState(first ? s.from : s.v);
  useEffect(() => {
    if (v === s.v) return;
    const t = setTimeout(() => setV(s.v), first ? delay : 0);
    return () => clearTimeout(t);
  }, [s.v]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ticker value={v} format={s.fmt} />;
};

/** The words of the run row (§5 step 2): `EASY 4` over `4.0 mi · 8:12 /mi`, `4 mi · Done`, or `Floor: 20 min easy` while open. */
const runWords = (log: Log, date: ISODate, p: PhaseSession): string => {
  const s = p.session;
  const runs = s.kind === 'run' ? log.snap.runsOn(date) : [];
  if (runs.length) {
    const m = runs.reduce((t, r) => t + r.miles, 0);
    const sec = runs.reduce((t, r) => t + r.movingSec, 0);
    return m > 0.1 ? `${mi(m)} mi · ${clock(sec / m)} /mi` : `${mi(m)} mi`;
  }
  if (p.key === 'done' || p.key === 'floor') {
    const m = s.kind === 'run' ? sessionMiles(log.snap, date, s).miles : 0;
    return [m > 0 ? `${num(m)} mi` : s.minutes ? `${s.minutes} min` : null, p.key === 'floor' ? 'Floor met' : 'Done'].filter(Boolean).join(' · ');
  }
  const floor = floorFor(s);
  return floor ? `Floor: ${floor}` : p.word;
};

/** The run row (§5 step 2): 60, the session's stamp and how it went; the 40 px ring while it is open. The words open the sheet. */
const RunRow = ({ date, log, p, onOpen, still }: { date: ISODate; log: Log; p: PhaseSession; onOpen: () => void; still: boolean }) => {
  const { mark } = useSessionMutations();
  const s = p.session;
  const open = p.key === 'today';
  const done = p.key === 'done' || p.key === 'floor';
  const byRun = done && log.snap.runsOn(date).length > 0 && s.kind === 'run';
  return (
    <Pressable as="div" className="cd-run" press="surface" ignore=".hold-ring" onPress={onOpen} label={`${label(s)}, ${runWords(log, date, p)}. Open`}>
      <span className="cd-run-text">
        <span className="cd-run-stamp">{label(s)}</span>
        <span className="cd-run-sub">{runWords(log, date, p)}</span>
      </span>
      {!still && (open || (done && !byRun)) ? (
        <HoldRing
          size={40}
          label={`Hold to mark ${label(s)} done`}
          done={done}
          onComplete={() => {
            markSuccess(s.id);
            mark.mutate({ session: s, mark: 'done' });
          }}
          onTap={onOpen}
        />
      ) : null}
    </Pressable>
  );
};

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/**
 * The composer's box (§5 steps 3–4): the quote line as the prompt, the Journal's composer, Save. After Save the entry takes
 * the field's place in the same box (a 150 ms crossfade) and the Save slot becomes `Add to it`; the box keeps the height it
 * had, so nothing under it moves. `Add to it` brings the composer back the same way.
 */
const ComposeBox = ({ date, log, onSaved }: { date: ISODate; log: Log; onSaved: () => void }) => {
  const logged = log.snap.journalOn(date);
  const [writing, setWriting] = useState(logged.length === 0);
  // the words as they were saved, shown at once in the entry's place until the month carries the entry (the journal's write
  // re-renders every page; the swap renders first, on its own)
  const typed = useRef('');
  useEffect(() => subscribeDrafts(() => {
    const v = getDraft(date);
    if (v.trim()) typed.current = v.trim();
  }), [date]);
  const [justSaved, setJustSaved] = useState<{ text: string; at: string } | null>(null);
  const entries = justSaved && !logged.some((e) => e.text.trim() === justSaved.text) ? [{ id: 'just-saved', text: justSaved.text, createdAt: justSaved.at }, ...logged] : logged;
  const [lock, setLock] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const keep = () => setLock((h) => Math.max(h, box.current?.offsetHeight ?? 0));
  // the two layers crossfade in the box (150 ms, opacity) as native animations, which the compositor runs even while the
  // journal's write re-renders the pages; the leaving one stays its 150 ms, over the other, then goes
  const [leaving, setLeaving] = useState<'write' | 'read' | null>(null);
  const writeEl = useRef<HTMLDivElement>(null);
  const readEl = useRef<HTMLDivElement>(null);
  const swap = (to: boolean) => {
    setLeaving(to ? 'read' : 'write');
    setWriting(to);
  };
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const inEl = writing ? writeEl.current : readEl.current;
    const outEl = writing ? readEl.current : writeEl.current;
    const ms = CROSSFADE_MS;
    inEl?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'linear', fill: 'backwards' });
    const out = outEl?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'linear', fill: 'forwards' });
    if (!out) return setLeaving(null);
    let live = true;
    out.finished.then(() => live && setLeaving(null), () => undefined);
    return () => {
      live = false;
    };
  }, [writing]);
  return (
    <div
      ref={box}
      className="cd-box"
      style={lock ? { minHeight: lock } : undefined}
      onFocusCapture={(e) => {
        if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) revealField(e.target);
      }}
    >
      {writing || leaving === 'write' ? (
        <div ref={writeEl} key="write" className="cd-write" data-leaving={leaving === 'write' || undefined}>
            <Suspense fallback={<div className="cd-quote-slot" aria-hidden="true" />}>
              <QuoteLine
                date={date}
                onInsert={(t) => {
                  addToDraft(date, t);
                  requestAnimationFrame(() => field.current?.focus());
                }}
              />
            </Suspense>
            <div className="cd-composer">
              <Composer
                date={date}
                today={log.today}
                rows={2}
                placeholder={CLOSE_ASK}
                toast={false}
                inputRef={field}
                autoFocus={logged.length > 0}
                onSaved={() => {
                  // the keyboard goes down with the words, and nothing in the leaving layer keeps the focus (the midnight rule
                  // sees no field in use, and the layer's removal later is no "activity")
                  const a = document.activeElement;
                  if (a instanceof HTMLElement && box.current?.contains(a)) a.blur();
                  const text = typed.current;
                  flushSync(() => {
                    keep();
                    if (text) setJustSaved({ text, at: new Date().toISOString() });
                    swap(false);
                    onSaved();
                  });
                }}
              />
            </div>
        </div>
      ) : null}
      {!writing || leaving === 'read' ? (
        <div ref={readEl} key="read" className="cd-read" data-leaving={leaving === 'read' || undefined}>
            <div className="cd-entries">
              {entries.map((e) => (
                <div key={e.id} className="cd-entry">
                  <span className="caps cd-entry-time">{timeOf(e.createdAt)}</span>
                  <p className="cd-entry-text">{e.text}</p>
                </div>
              ))}
            </div>
            <Pressable
              className="cd-addto"
              press="surface"
              onPress={() => {
                keep();
                swap(true);
              }}
              label="Add to it"
            >
              <PenLine size={16} aria-hidden="true" /> Add to it
            </Pressable>
        </div>
      ) : null}
    </div>
  );
};

/**
 * `A word for tomorrow · Steady ›` (§5 step 5, M17): a tap turns the row into the field in the same 44 box; Return or leaving
 * the field saves the sticky `settings.focus.word` (the bar's caps line changes at once: the confirmation; no toast, no haptic).
 */
const WordRow = () => {
  const focus = useFocus();
  const { settings } = useMorningMutations();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState('');
  const done = useRef(false);
  const save = () => {
    if (done.current) return;
    done.current = true;
    const word = v.trim().slice(0, WORD_MAX);
    if (word !== focus.word) saveFocus(settings, { word, quote: focus.quote, by: focus.by });
    setEditing(false);
  };
  if (editing)
    return (
      <div className="row cd-trow cd-word-edit">
        {/* the label keeps its words beside the field at 390; below 360 wide it shortens rather than being cut */}
        <span className="cd-trow-title">
          <span className="cd-word-long">A word for tomorrow</span>
          <span className="cd-word-short" aria-hidden="true">
            Word
          </span>
        </span>
        <input
          className="cd-word-in"
          value={v}
          onChange={(e) => setV(e.target.value)}
          maxLength={WORD_MAX}
          placeholder="Steady"
          autoCapitalize="words"
          enterKeyHint="done"
          aria-label="A word for tomorrow"
          autoFocus
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            } else if (e.key === 'Escape') {
              done.current = true;
              setEditing(false);
            }
          }}
        />
      </div>
    );
  return (
    <Pressable
      className="row cd-trow cd-word"
      press="surface"
      label={`A word for tomorrow${focus.word ? `: ${focus.word}` : ''}. Change`}
      onPress={() => {
        done.current = false;
        setV(focus.word.slice(0, WORD_MAX));
        setEditing(true);
      }}
    >
      <span className="cd-trow-title">A word for tomorrow</span>
      {focus.word ? <span className="cd-trow-right">{focus.word}</span> : null}
      <ChevronRight size={16} className="cd-trow-chev" aria-hidden="true" />
    </Pressable>
  );
};

const weekday = (s: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(Date.parse(`${s}T12:00:00Z`));

/** `Alarm 7:15 · change ›` (§5 step 5): tomorrow's alarm, the WakeEditor for tomorrow with `Just tomorrow` chosen, a medium sheet. */
const AlarmRow = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const st = log.boot?.morningSettings ?? null;
  const tomorrow = shiftDays(log.today, 1);
  const T = useMemo(() => (st ? morningOf(log.snap.sessionsOn(tomorrow), log.snap.morningOverride(tomorrow), st) : null), [st, log.snap, tomorrow]);
  if (!st || !T) return null;
  return (
    <Pressable
      className="row cd-trow cd-alarm"
      press="surface"
      label={`Alarm ${shortClock(T.day.wake)} tomorrow. Change`}
      onPress={() =>
        // the editor's module is fetched at idle (preloadCloseDay); a tap before that waits for it, once
        void loadWake().then(({ WakeEditor }) => sheet.open({ eyebrow: 'Tomorrow', title: 'Alarm', detent: 'medium', body: <WakeEditor settings={st} day={T.day} date={tomorrow} dayName={weekday(tomorrow)} preselect="today" /> }))
      }
    >
      <span className="cd-trow-title tnum">Alarm {shortClock(T.day.wake)}</span>
      <span className="cd-trow-right">change</span>
      <ChevronRight size={16} className="cd-trow-chev" aria-hidden="true" />
    </Pressable>
  );
};

/**
 * Close the day (docs/feel.md §5, build plan §3.2 item 12): the evening's hero, one card of fixed slots whose content
 * crossfades (150 ms) in place:
 * 0. `CLOSE THE DAY`, *Two sentences, then sleep.* → *Day, closed.* after the first save;
 * 1. the stamps row (40): the day's numbers, counting up once a day, 60 ms apart;
 * 2. the run row (60): the session, how it went, its 40 px ring while open; the words open the session sheet;
 * 3–4. the composer (the quote line as its prompt) → after Save, the entry in the same box, one `success` (the Composer's),
 *    `.halo-boost`, and `Add to it`;
 * 5. Tomorrow, always: the word (inline) and tomorrow's alarm (WakeEditor);
 * 6. `Share the day`; 7. Today's read when there is a pick.
 * A neighbour's copy (`still`) shows the day only: no composer, no rows to act on.
 */
export const CloseDay = ({ date, log, ph, onOpenSession, still }: { date: ISODate; log: Log; ph: DayPhase | null; onOpenSession: (p: PhaseSession) => void; still?: boolean; asHero?: boolean }): React.JSX.Element => {
  const sheet = useSheet();
  const todos = useTodos();
  const pick = usePick(log.today, !still);
  const [boost, setBoost] = useState(false);
  useEffect(() => {
    if (!boost) return;
    const t = setTimeout(() => setBoost(false), 650);
    return () => clearTimeout(t);
  }, [boost]);
  const runs = log.snap.runsOn(date);
  const miles = dayMiles(log.snap, date).miles;
  const habits = log.habits.filter((h) => h.createdOn <= date);
  const lit = habits.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const groups = groupsOn(todos.data, date);
  const doneTodos = groups[3]?.items.length ?? 0;
  const openTodos = groups[0]?.items.length ?? 0;
  const entries = log.snap.journalOn(date);
  const lead = ph?.training[0] ?? (ph?.primary && ph.primary.session.kind !== 'rest' ? ph.primary : null);
  const planned = (ph?.training ?? []).reduce((t, p) => t + (p.session.kind === 'run' ? Number(p.session.miles) || 0 : 0), 0);
  const { stamps, line } = dayStamps({ miles, planned, lit, habits: habits.length, doneTodos, openTodos, restDay: !ph?.training.length, runShown: !!lead });
  const [closedNow, setClosedNow] = useState(false);
  const title = entries.length || closedNow ? CLOSED_TITLE : EVENING_TITLE;
  const share = () => {
    const base = shareDataFor(date, lead?.session ?? null, runs, log);
    const days = weekMiles(log.snap, date);
    const data = runs.length ? base : { ...base, miles, week: base.week ? { ...base.week, days, total: days.reduce((t, d) => t + d.miles, 0) } : base.week };
    // the day's own words are the card's line: the latest entry, cut at a word to fit the bubble
    const words = entries[0]?.text.replace(/\s+/g, ' ').trim() ?? '';
    const cut = words.length > 80 ? `${words.slice(0, 79).replace(/\s+\S*$/, '')}…` : words;
    sheet.open({ title: 'Share the day', body: <ShareSheet data={cut ? { ...data, verdict: cut } : data} initial={miles > 0 ? (data.polyline ? 'route' : 'stamp') : 'bubble'} /> });
  };
  const halo = miles > 0 || lead?.key === 'done' ? 'done' : lead?.key === 'floor' ? 'floor' : 'rest';
  const once = still ? null : `close-${date}`;
  return (
    <section className={`aura cd cd-hero halo-${halo} ${boost ? 'halo-boost' : ''}`} aria-label="Close the day">
      <span className="aura-glow" aria-hidden="true" />
      <span className="caps cd-eyebrow">Close the day</span>
      <div className="cd-title-slot">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.h2 key={title} className="cd-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={crossfade}>
            {title}
          </motion.h2>
        </AnimatePresence>
      </div>
      {stamps.length ? (
        <div className="cd-stamps" role="list" aria-label="The day">
          {stamps.map((s, i) => (
            <span key={s.k} className="cd-stamp" role="listitem" aria-label={s.said}>
              <span className="caps">{s.k}</span>
              <span className="cd-num">
                <StampNum s={s} delay={i * STAGGER_MS} once={once && `${once}-${s.k}`} />
                {s.u ? <small> {s.u}</small> : null}
              </span>
            </span>
          ))}
        </div>
      ) : line ? (
        <p className="cd-line">{line}</p>
      ) : null}
      {lead ? <RunRow date={date} log={log} p={lead} onOpen={() => onOpenSession(lead)} still={!!still} /> : null}
      {still ? null : (
        <>
          <ComposeBox
            date={date}
            log={log}
            onSaved={() => {
              setBoost(true);
              setClosedNow(true);
            }}
          />
          <div className="cd-tomorrow">
            <span className="caps cd-tomorrow-head">Tomorrow</span>
            <div className="group cd-tgroup">
              <WordRow />
              <AlarmRow log={log} />
            </div>
          </div>
          <Pressable className="hero-share cd-share" onPress={share} label="Share the day">
            <Share size={14} strokeWidth={2.25} aria-hidden="true" /> Share the day
          </Pressable>
          {pick.data?.pick && pick.data.pick.verdict !== 'dismissed' ? (
            <div className="cd-pick">
              <Suspense fallback={null}>
                <TodaysPick compact />
              </Suspense>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
};
