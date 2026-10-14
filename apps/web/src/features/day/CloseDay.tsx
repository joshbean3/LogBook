import { floorFor, label, mi, type DayPhase, type ISODate, type PhaseSession } from '@logbook/shared';
import { PenLine, Share } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { usePick, useSessionMutations, useTodos } from '@/api/queries';
import { rowPresence } from '@/lib/motion';
import { useSheet } from '@/ui';
import { Composer, EntryItem } from '../journal/JournalDaySection';
import { useDayPrompt } from '../journal/prompt';
import type { Log } from '../log/useLog';
import { TodaysPick } from '../reads/TodaysPick';
import { shareDataFor } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { groupsOn } from '../todos/groups';
import { HoldRing } from './HoldRing';
import { dayMiles, weekMiles } from './miles';

/** The card's title, which the composer's prompt must never repeat. */
const EVENING_TITLE = 'Two sentences, then sleep.';

/**
 * The Journal's composer with the day's own prompt ("Speed 5 done, 5.02 mi. How did it feel?"), from the same status source
 * as the hero. The evening prompt's own close ("Two sentences, then sleep.") is the card's title, so here it asks instead.
 * No toast: the entry lands in this card.
 */
const DayComposer = ({ date, today, autoFocus, onSaved }: { date: ISODate; today: ISODate; autoFocus?: boolean; onSaved?: () => void }) => {
  const prompt = useDayPrompt(date).replace(EVENING_TITLE, 'How did today go?');
  return (
    <div className="cd-composer">
      <Composer date={date} today={today} rows={2} placeholder={prompt} toast={false} autoFocus={autoFocus} onSaved={onSaved} />
    </div>
  );
};

/** After the day's entry: a second empty composer is noise. One quiet row opens it again. */
const AddToIt = ({ date, today }: { date: ISODate; today: ISODate }) => {
  const [open, setOpen] = useState(false);
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {open ? (
        <motion.div key="compose" {...rowPresence}>
          <DayComposer date={date} today={today} autoFocus onSaved={() => setOpen(false)} />
        </motion.div>
      ) : (
        <motion.button key="row" type="button" className="cd-addto" onClick={() => setOpen(true)} {...rowPresence}>
          <PenLine size={16} aria-hidden="true" /> Add to it
        </motion.button>
      )}
    </AnimatePresence>
  );
};

/** A session still open in the evening: its stamp, the floor, and the hold ring, so the day can still be closed honestly. */
const OpenLine = ({ p, onOpen }: { p: PhaseSession; onOpen: () => void }) => {
  const { mark } = useSessionMutations();
  const floor = floorFor(p.session);
  return (
    <div className="cd-open">
      <button type="button" className="cd-open-main" onClick={onOpen}>
        <span className="stamp cd-open-stamp">{label(p.session)}</span>
        <span className="cd-open-sub">{floor ? `Floor: ${floor}` : p.word}</span>
      </button>
      <HoldRing label={`Hold to mark ${label(p.session)} done`} onComplete={() => mark.mutate({ session: p.session, mark: 'done' })} onTap={onOpen} />
    </div>
  );
};

type StampRow = { k: string; v: string; u?: string; said: string };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The day in numbers, only the ones that happened: MI (a run marked done by hand counts its planned miles), HABITS "3 of 5",
 * TO-DOS "2 done". A stamp that would read none, not yet or zero is left out; when none is left, one plain sentence from the
 * day takes the row ("Easy 4 still open. 5 habits to light.").
 */
export const dayStamps = ({ miles, lit, habits, doneTodos, openTodos, open, restDay }: { miles: number; lit: number; habits: number; doneTodos: number; openTodos: number; open: string[]; restDay: boolean }) => {
  const stamps: StampRow[] = [];
  if (miles > 0) stamps.push({ k: 'Mi', v: mi(miles), said: `${mi(miles)} miles` });
  if (lit > 0) stamps.push({ k: 'Habits', v: String(lit), u: lit < habits ? `of ${habits}` : 'lit', said: lit < habits ? `${lit} of ${habits} habits` : `all ${habits} habits lit` });
  if (doneTodos > 0) stamps.push({ k: 'To-dos', v: String(doneTodos), u: 'done', said: `${doneTodos} to-dos done` });
  if (stamps.length) return { stamps, line: null };
  const bits: string[] = [];
  if (open.length) bits.push(`${open.join(' and ')} still open.`);
  else if (restDay) bits.push('Rest day.');
  if (habits > lit) bits.push(`${plural(habits - lit, 'habit', 'habits')} to light.`);
  else if (openTodos) bits.push(`${plural(openTodos, 'to-do', 'to-dos')} left.`);
  return { stamps, line: bits.length ? bits.join(' ') : 'A quiet day.' };
};

/**
 * Close the day: the evening's card. The day stamped in one row (numbers only, see `dayStamps`), anything still open with its
 * hold ring, the day's entries and the composer with a prompt from the day, then "Share the day" once something is written
 * (and the composer folds into "Add to it"), and Today's read when there is one.
 */
export const CloseDay = ({ date, log, ph, onOpenSession, still, corner, asHero }: { date: ISODate; log: Log; ph: DayPhase | null; onOpenSession: (p: PhaseSession) => void; still?: boolean; corner?: ReactNode; asHero?: boolean }) => {
  const sheet = useSheet();
  const todos = useTodos();
  const isToday = date === log.today;
  const pick = usePick(log.today, isToday && !still);
  const runs = log.snap.runsOn(date);
  const miles = dayMiles(log.snap, date).miles;
  const habits = log.habits.filter((h) => h.createdOn <= date);
  const lit = habits.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const groups = groupsOn(todos.data, date);
  const doneTodos = groups[3]?.items.length ?? 0;
  const openTodos = isToday ? (groups[0]?.items.length ?? 0) : 0;
  const entries = log.snap.journalOn(date);
  const open = (ph?.training ?? []).filter((p) => p.key === 'today');
  const primary = ph?.training[0] ?? ph?.primary ?? null;
  const restDay = !ph?.training.length;
  const { stamps, line } = dayStamps({ miles, lit, habits: habits.length, doneTodos, openTodos, open: open.map((p) => label(p.session)), restDay });
  const share = () => {
    const base = shareDataFor(date, primary?.session ?? null, runs, log);
    const days = weekMiles(log.snap, date);
    const data = runs.length ? base : { ...base, miles, week: base.week ? { ...base.week, days, total: days.reduce((t, d) => t + d.miles, 0) } : base.week };
    // the day's own words are the card's line: the latest entry, cut at a word to fit the bubble
    const words = entries[0]?.text.replace(/\s+/g, ' ').trim() ?? '';
    const cut = words.length > 80 ? `${words.slice(0, 79).replace(/\s+\S*$/, '')}…` : words;
    sheet.open({ title: 'Share the day', body: <ShareSheet data={cut ? { ...data, verdict: cut } : data} initial={miles > 0 ? (data.polyline ? 'route' : 'stamp') : 'bubble'} /> });
  };
  return (
    <section className={`aura cd ${asHero ? 'cd-hero' : ''} halo-${miles > 0 || primary?.key === 'done' ? 'done' : primary?.key === 'floor' ? 'floor' : 'rest'}`} aria-label="Close the day">
      <span className="aura-glow" aria-hidden="true" />
      <div className="cd-top">
        <span className="caps">{isToday ? 'Close the day' : 'The day'}</span>
        {corner}
      </div>
      <h2 className="cd-title display">{entries.length ? 'Day, closed.' : isToday ? EVENING_TITLE : 'Two sentences on the day.'}</h2>
      {stamps.length ? (
        <div className={`cd-stamps n-${stamps.length}`} role="list" aria-label="The day">
          {stamps.map((s) => (
            <span key={s.k} className="cd-stamp" role="listitem" aria-label={s.said}>
              <span className="caps">{s.k}</span>
              <span className="stamp cd-num">
                {s.v}
                {s.u ? <small> {s.u}</small> : null}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="cd-line">{line}</p>
      )}
      {!still && isToday ? open.map((p) => <OpenLine key={p.session.id} p={p} onOpen={() => onOpenSession(p)} />) : null}
      {entries.length ? (
        <div className="cd-entries">
          {entries.map((e) => (
            <EntryItem key={e.id} e={e} />
          ))}
        </div>
      ) : null}
      {still ? null : entries.length ? <AddToIt date={date} today={log.today} /> : <DayComposer date={date} today={log.today} />}
      {entries.length && !still ? (
        <button type="button" className="aura-share cd-share" onClick={share}>
          <Share size={14} strokeWidth={2.25} aria-hidden="true" /> Share the day
        </button>
      ) : null}
      {isToday && !still && pick.data?.pick && pick.data.pick.verdict !== 'dismissed' ? (
        <div className="cd-pick">
          <TodaysPick compact />
        </div>
      ) : null}
    </section>
  );
};
