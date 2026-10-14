import { floorFor, label, mi, type DayPhase, type ISODate, type PhaseSession } from '@logbook/shared';
import { Share } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { usePick, useSessionMutations, useTodos } from '@/api/queries';
import { useSheet } from '@/ui';
import { Composer, EntryItem } from '../journal/JournalDaySection';
import type { Log } from '../log/useLog';
import { TodaysPick } from '../reads/TodaysPick';
import { shareDataFor } from '../sessions/SessionCard';
import { ShareSheet } from '../share/ShareSheet';
import { groupsOn } from '../todos/groups';
import { runTotals } from './dayWords';
import { HoldRing } from './HoldRing';

/** "Speed 5 done. How did it feel?": the composer's prompt, built from the day. */
export const journalPrompt = (ph: DayPhase | null, miles: number, isToday: boolean): string => {
  const p = ph?.training[0] ?? null;
  if (p && (p.key === 'done' || p.key === 'floor')) return `${label(p.session)} ${p.key === 'floor' ? 'at the floor' : 'done'}${miles > 0 ? `, ${mi(miles)} mi` : ''}. How did it feel?`;
  if (!p && miles > 0) return `${mi(miles)} mi off the plan. How did it feel?`;
  if (p && p.key === 'today') return `${label(p.session)} still open. What got in the way?`;
  if (p && p.key === 'missed') return `${label(p.session)} slipped. What got in the way?`;
  return isToday ? 'A rest day. What filled it?' : 'Two sentences on the day.';
};

/** The composer the Journal team owns, with the day's prompt as its placeholder (set on the field itself: the export takes no placeholder yet). */
const DayComposer = ({ date, today, prompt }: { date: ISODate; today: ISODate; prompt: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ta = ref.current?.querySelector('textarea');
    if (ta && ta.placeholder !== prompt) ta.placeholder = prompt;
  });
  return (
    <div ref={ref} className="cd-composer">
      <Composer date={date} today={today} rows={2} />
    </div>
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

/**
 * Close the day: the evening's card. The day stamped in one row (MI · HABITS · TO-DOS, words where nothing happened, never
 * a zero), anything still open with its hold ring, the day's entries and the composer with a prompt from the day, then
 * "Share the day" once something is written, and Today's read when there is one.
 */
export const CloseDay = ({ date, log, ph, onOpenSession, still, corner, asHero }: { date: ISODate; log: Log; ph: DayPhase | null; onOpenSession: (p: PhaseSession) => void; still?: boolean; corner?: ReactNode; asHero?: boolean }) => {
  const sheet = useSheet();
  const todos = useTodos();
  const isToday = date === log.today;
  const pick = usePick(log.today, isToday && !still);
  const runs = log.snap.runsOn(date);
  const t = runTotals(runs);
  const habits = log.habits.filter((h) => h.createdOn <= date);
  const lit = habits.filter((h) => log.snap.isHabitDone(date, h.id)).length;
  const groups = groupsOn(todos.data, date);
  const doneTodos = groups[3]?.items.length ?? 0;
  const openTodos = groups[0]?.items.length ?? 0;
  const entries = log.snap.journalOn(date);
  const open = (ph?.training ?? []).filter((p) => p.key === 'today');
  const primary = ph?.training[0] ?? ph?.primary ?? null;
  const restDay = !ph?.training.length;
  const stamps: Array<[string, string, string?]> = [
    ['Mi', t.miles > 0 ? mi(t.miles) : restDay ? 'Rest' : open.length ? 'Not yet' : 'None'],
    ...(habits.length ? [['Habits', lit === habits.length ? 'All lit' : lit ? `${lit}` : 'None', lit && lit < habits.length ? `of ${habits.length}` : undefined] as [string, string, string?]] : []),
    ['To-dos', doneTodos ? `${doneTodos}` : openTodos ? `${openTodos}` : 'Clear', doneTodos ? 'done' : openTodos ? 'left' : undefined],
  ];
  const share = () => {
    const data = shareDataFor(date, primary?.session ?? null, runs, log);
    // the day's own words are the card's line: the latest entry, cut at a word to fit the bubble
    const words = entries[0]?.text.replace(/\s+/g, ' ').trim() ?? '';
    const line = words.length > 80 ? `${words.slice(0, 79).replace(/\s+\S*$/, '')}…` : words;
    sheet.open({ title: 'Share the day', body: <ShareSheet data={line ? { ...data, verdict: line } : data} initial={t.miles > 0 ? (data.polyline ? 'route' : 'stamp') : 'bubble'} /> });
  };
  return (
    <section className={`aura cd ${asHero ? 'cd-hero' : ''} halo-${t.miles > 0 || primary?.key === 'done' ? 'done' : primary?.key === 'floor' ? 'floor' : 'rest'}`} aria-label="Close the day">
      <span className="aura-glow" aria-hidden="true" />
      <div className="cd-top">
        <span className="caps">{isToday ? 'Close the day' : 'The day'}</span>
        {corner}
      </div>
      <h2 className="cd-title display">{entries.length ? 'Day, closed.' : isToday ? 'Two sentences, then sleep.' : 'Two sentences on the day.'}</h2>
      <div className="cd-stamps" role="list" aria-label="The day">
        {stamps.map(([k, v, u]) => (
          <span key={k} className="cd-stamp" role="listitem" aria-label={`${k === 'Mi' ? 'Miles' : k}: ${v}${u ? ` ${u}` : ''}`}>
            <span className="caps">{k}</span>
            <span className="stamp cd-num">
              {v}
              {u ? <small> {u}</small> : null}
            </span>
          </span>
        ))}
      </div>
      {!still && isToday ? open.map((p) => <OpenLine key={p.session.id} p={p} onOpen={() => onOpenSession(p)} />) : null}
      {entries.length ? (
        <div className="cd-entries">
          {entries.map((e) => (
            <EntryItem key={e.id} e={e} />
          ))}
        </div>
      ) : null}
      {!still ? <DayComposer date={date} today={log.today} prompt={journalPrompt(ph, t.miles, isToday)} /> : null}
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
