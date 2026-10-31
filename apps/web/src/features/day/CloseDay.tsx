import { mi, monthOf, type ISODate } from '@logbook/shared';
import { useQueryClient } from '@tanstack/react-query';
import { PenLine, Share } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTodos } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { AuraStat, Button, StatStrip } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { Composer } from '../journal/JournalDaySection';
import { useLog, type Log } from '../log/useLog';
import { shareDataFor } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { useHabitsLit } from '../habits/OrbRow';
import { groupsOn } from '../todos/groups';
import { watchJournalAdd } from './journalGuard';
import { dayMiles, weekMiles } from './miles';
import { keepAboveKeyboard, revealBox } from './reveal';

/** The row's words before and after the day's first entry. */
export const EVENING_TITLE = 'Two sentences, then sleep.';
export const CLOSED_TITLE = 'Day, closed.';
/** The composer's question. */
export const CLOSE_ASK = 'How did today go?';

type StampRow = { k: string; v: number; from: number; fmt: (v: number) => string; u?: string; said: string };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The day in numbers, only the ones that happened, at most three: `MI 4.0` (a run marked done by hand counts its planned
 * miles), `HABITS 3 of 5`, `TO-DOS 2 done`. A stamp that would read zero is left out; when none is left, one plain sentence
 * takes the row ("2 to-dos left.", "Rest day."), never an instruction.
 */
export const dayStamps = ({ miles, planned, lit, habits, doneTodos, openTodos, restDay, runShown }: { miles: number; planned: number; lit: number; habits: number; doneTodos: number; openTodos: number; restDay: boolean; runShown: boolean }) => {
  const stamps: StampRow[] = [];
  if (miles > 0) stamps.push({ k: 'Mi', v: miles, from: planned > 0 ? planned : miles, fmt: (v) => mi(v), said: `${mi(miles)} miles` });
  if (lit > 0) stamps.push({ k: 'Habits', v: lit, from: 0, fmt: (v) => String(Math.round(v)), u: `of ${habits}`, said: `${lit} of ${habits} habits` });
  if (doneTodos > 0) stamps.push({ k: 'To-dos', v: doneTodos, from: 0, fmt: (v) => String(Math.round(v)), u: 'done', said: `${doneTodos} to-dos done` });
  if (stamps.length) return { stamps, line: null };
  const bits: string[] = [];
  if (restDay && !runShown) bits.push('Rest day.');
  if (openTodos) bits.push(`${plural(openTodos, 'to-do', 'to-dos')} left.`);
  return { stamps, line: bits.length ? bits.join(' ') : runShown ? null : 'A quiet day.' };
};

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

/**
 * The composer's box: the Journal's composer and Save; after Save the entry takes the field's place and `Add to it` brings
 * the field back. A Save the server refuses brings the field back with the words and the error toast, however late the
 * refusal comes (`watchJournalAdd`: the Composer that sent it has usually left by then).
 */
const ComposeBox = ({ date, log, onSaved }: { date: ISODate; log: Log; onSaved: () => void }) => {
  const qc = useQueryClient();
  const toast = useToast();
  const logged = log.snap.journalOn(date);
  const [writing, setWriting] = useState(logged.length === 0);
  const [focusOnOpen, setFocusOnOpen] = useState(true);
  // the words as they were saved, shown at once in the entry's place until the month carries the entry
  const [justSaved, setJustSaved] = useState<{ text: string; at: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const entries = justSaved && !logged.some((e) => e.text.trim() === justSaved.text) ? [{ id: 'just-saved', text: justSaved.text, createdAt: justSaved.at }, ...logged] : logged;
  const field = useRef<HTMLTextAreaElement>(null);
  if (writing)
    return (
      <div
        className="cd-write"
        onFocusCapture={(e) => {
          if (e.target instanceof HTMLTextAreaElement) revealBox(e.target.closest<HTMLElement>('.cd-composer'));
        }}
        onInput={(e) => {
          if (e.target instanceof HTMLTextAreaElement) keepAboveKeyboard(e.target.closest<HTMLElement>('.cd-composer'));
        }}
      >
        <div className="cd-composer">
          <Composer
            date={date}
            today={log.today}
            rows={2}
            placeholder={CLOSE_ASK}
            haptic={false}
            inputRef={field}
            autoFocus={focusOnOpen}
            onSaved={({ first }) => {
              const a = document.activeElement;
              if (a instanceof HTMLElement) a.blur();
              // the words as sent (the add is in the cache now), followed until the server answers
              const { text } = watchJournalAdd(qc, date, {
                toast,
                onRefused: () => {
                  if (!alive.current) return;
                  setJustSaved(null);
                  setFocusOnOpen(false);
                  setWriting(true);
                },
              });
              if (text) setJustSaved({ text, at: new Date().toISOString() });
              setWriting(false);
              onSaved();
              // the day's close: its one success on the frame the entry shows
              if (first) requestAnimationFrame(() => haptics.success());
            }}
          />
        </div>
      </div>
    );
  return (
    <div className="cd-read">
      <div className="cd-entries">
        {entries.map((e) => (
          <div key={e.id} className="cd-entry">
            <span className="caps cd-entry-time">{timeOf(e.createdAt)}</span>
            <p className="cd-entry-text serif">{e.text}</p>
          </div>
        ))}
      </div>
      <Button
        variant="quiet"
        className="cd-addto"
        onClick={() => {
          setFocusOnOpen(true);
          setWriting(true);
        }}
      >
        <PenLine size={16} aria-hidden="true" /> Add to it
      </Button>
    </div>
  );
};

/**
 * Close the day (docs/system.md §2): the sheet behind the `Close the day` row, from 18:00 and on every past day. The day's
 * numbers as stamps, the composer (two sentences; after Save the entry, and `Add to it`), and `Share the day`.
 */
export const CloseDaySheet = ({ date }: { date: ISODate }): React.JSX.Element => {
  const months = useMemo(() => [monthOf(date)], [date]);
  const log = useLog(months);
  const sheet = useSheet();
  const todos = useTodos();
  const runs = log.snap.runsOn(date);
  const miles = dayMiles(log.snap, date).miles;
  const habits = log.habits.filter((h) => h.createdOn <= date);
  const { lit } = useHabitsLit(date, log);
  const groups = groupsOn(todos.data, date);
  const doneTodos = groups[3]?.items.length ?? 0;
  const openTodos = groups[0]?.items.length ?? 0;
  const entries = log.snap.journalOn(date);
  const sessions = log.snap.sessionsOn(date).filter((s) => s.kind !== 'rest');
  const lead = sessions[0] ?? null;
  const planned = sessions.reduce((t, s) => t + (s.kind === 'run' ? Number(s.miles) || 0 : 0), 0);
  const { stamps, line } = dayStamps({ miles, planned, lit, habits: habits.length, doneTodos, openTodos, restDay: !sessions.length, runShown: !!lead });
  const [closedNow, setClosedNow] = useState(false);
  const share = () => {
    const base = shareDataFor(date, lead, runs, log);
    const days = weekMiles(log.snap, date);
    const data = runs.length ? base : { ...base, miles, week: base.week ? { ...base.week, days, total: days.reduce((t, d) => t + d.miles, 0) } : base.week };
    // the day's own words are the card's line: the latest entry, cut at a word to fit the bubble
    const words = entries[0]?.text.replace(/\s+/g, ' ').trim() ?? '';
    const cut = words.length > 80 ? `${words.slice(0, 79).replace(/\s+\S*$/, '')}…` : words;
    sheet.push({ title: 'Share the day', body: <ShareSheet data={cut ? { ...data, verdict: cut } : data} initial={miles > 0 ? (data.polyline ? 'route' : 'stamp') : 'bubble'} /> });
  };
  return (
    <div className="cd">
      <p className="cd-title serif">{entries.length || closedNow ? CLOSED_TITLE : EVENING_TITLE}</p>
      {stamps.length ? (
        <StatStrip className="cd-stamps">
          {stamps.map((s) => (
            <AuraStat key={s.k} label={s.k} value={s.fmt(s.v)} unit={s.u} />
          ))}
        </StatStrip>
      ) : line ? (
        <p className="cd-line">{line}</p>
      ) : null}
      <ComposeBox date={date} log={log} onSaved={() => setClosedNow(true)} />
      <div className="sheet-foot">
        <span />
        <div className="foot-right">
          <Button variant="soft" onClick={share}>
            <Share size={16} aria-hidden="true" /> Share the day
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Opens the Close the day sheet (large) for a date. */
export const useOpenCloseDay = () => {
  const sheet = useSheet();
  return (date: ISODate, eyebrow: string) => sheet.open({ eyebrow, title: 'Close the day', detent: 'large', detents: ['large'], sticky: true, body: <CloseDaySheet date={date} /> });
};
