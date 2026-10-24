import { fmtDate, habitStreak, monthOf, parseISO, shiftDays, type Habit, type ISODate } from '@logbook/shared';
import { useMemo, useState } from 'react';
import { useHabitMutations } from '@/api/queries';
import { animate, motionValue } from 'motion/react';
import { hapticAtPeak, haptics } from '@/lib/haptics';
import { Button, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import './habits.css';

const DAYS = 30;

/** Archive a habit with an Undo, from anywhere (the orb's menu, the habit sheet). */
export const useArchiveHabit = () => {
  const { patch } = useHabitMutations();
  const toast = useToast();
  return (h: Habit) => {
    patch.mutate({ id: h.id, archived: true });
    haptics.delete();
    toast(`${h.name} archived`, { label: 'Undo', fn: () => patch.mutate({ id: h.id, archived: false }) });
  };
};

/** Open the habit sheet with the orb's name travelling into its title. */
export const useOpenHabit = () => {
  const sheet = useSheet();
  return (h: Habit) => sheet.open({ eyebrow: 'Habit', title: h.name, layoutId: `habit-${h.id}`, body: <HabitSheet id={h.id} /> });
};

/**
 * A habit's detail: the last 30 days as a grid you can tap to fix a day, the streak, the notes it has gathered, a rename
 * field and Archive (with Undo). This is where habits are managed now; Today keeps only the orbs.
 */
export const HabitSheet = ({ id }: { id: string }) => {
  const base = useLog([]);
  const t = base.today;
  const from = shiftDays(t, -(DAYS - 1));
  const log = useLog(useMemo(() => [monthOf(from), monthOf(t)], [from, t]));
  const { patch, check } = useHabitMutations();
  const archive = useArchiveHabit();
  const sheet = useSheet();
  const h = (log.boot?.habits ?? []).find((x) => x.id === id) ?? null;
  const [name, setName] = useState(h?.name ?? '');
  if (!h) return null;
  const days = Array.from({ length: DAYS }, (_, i) => shiftDays(from, i));
  const isDone = (d: ISODate) => log.snap.isHabitDone(d, h.id);
  // "N of 30" counts only the days the habit existed
  const since = days.filter((d) => d >= h.createdOn);
  const lit = since.filter(isDone).length;
  const streak = habitStreak(isDone, t);
  // the longest run of lit days in the window, for the stamp when today's streak is short
  let best = 0;
  let run = 0;
  for (const d of since) {
    run = isDone(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const stamps: Array<{ k: string; v: number; u: string }> = [];
  if (streak > 0) stamps.push({ k: 'Streak', v: streak, u: streak === 1 ? 'day' : 'days' });
  if (best > streak && best >= 2) stamps.push({ k: 'Best', v: best, u: 'days' });
  if (lit > 0) stamps.push({ k: since.length < DAYS ? `Since ${fmtDate('md', h.createdOn)}` : 'Last 30 days', v: lit, u: `of ${since.length}` });
  const notes = days
    .map((d) => ({ d, note: log.snap.checkOf(d, h.id)?.note ?? '' }))
    .filter((x) => x.note)
    .reverse();
  const rename = () => {
    const v = name.trim();
    if (v && v !== h.name) {
      patch.mutate({ id: h.id, name: v });
      sheet.update({ title: v });
    } else setName(h.name);
  };
  return (
    <div className="hs">
      {stamps.length ? (
        <div className="hs-stamps">
          {stamps.map((s) => (
            <span key={s.k} className="hs-stamp">
              <span className="caps">{s.k}</span>
              <span className="stamp hs-num">
                {s.v}
                <small> {s.u}</small>
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="hs-start">Light it today and the streak starts here.</p>
      )}
      <div className="hs-grid" role="group" aria-label="Last 30 days">
        {days.map((d) => {
          const on = isDone(d);
          const before = d < h.createdOn;
          return (
            <button
              key={d}
              type="button"
              className={`hs-cell ${on ? 'on' : ''} ${d === t ? 'is-today' : ''} ${before ? 'before' : ''}`}
              aria-pressed={on}
              aria-label={`${fmtDate('long', d)}, ${on ? 'done' : 'not done'}`}
              onClick={() => {
                // lighting a day is an orb lighting: `orb` on the frame its fill completes (no pop on a cell); putting one out is silent
                if (!on) {
                  const fill = motionValue(0);
                  hapticAtPeak(fill, 'orb');
                  animate(fill, 1, { duration: 0.16, ease: 'linear' });
                }
                check.mutate({ habitId: h.id, date: d, done: !on });
              }}
            >
              <span aria-hidden="true">{parseISO(d).getDate()}</span>
            </button>
          );
        })}
      </div>
      {notes.length ? (
        <div className="hs-notes">
          <h4 className="section-title">Notes</h4>
          <div className="list-edge">
            {notes.map((n) => (
              <div key={n.d} className="hs-note">
                <span className="caps">{fmtDate('short', n.d)}</span>
                <span className="hs-note-text">{n.note}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <label className="hs-field">
        <span className="caps">Name</span>
        <input className="in" value={name} maxLength={80} aria-label="Habit name" onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
      </label>
      <div className="sheet-foot">
        <Button
          variant="danger"
          onClick={() => {
            sheet.close();
            archive(h);
          }}
        >
          Archive
        </Button>
        <span />
      </div>
    </div>
  );
};

/** The note for one habit on one day: a title, a field, Save. */
export const HabitNoteSheet = ({ habit, date }: { habit: Habit; date: ISODate }) => {
  const log = useLog(useMemo(() => [monthOf(date)], [date]));
  const { check } = useHabitMutations();
  const sheet = useSheet();
  const cur = log.snap.checkOf(date, habit.id)?.note ?? '';
  const [text, setText] = useState(cur);
  const save = () => {
    const v = text.trim();
    if (v !== cur) check.mutate({ habitId: habit.id, date, note: v || null });
    sheet.close();
  };
  return (
    <div className="hs">
      <textarea
        className="jtext serif hs-notein"
        rows={3}
        maxLength={280}
        autoFocus
        placeholder={`A note on ${habit.name}`}
        aria-label={`Note for ${habit.name}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            save();
          }
        }}
      />
      <div className="sheet-foot">
        <span />
        <div className="foot-right">
          <Button variant="ghost" onClick={() => sheet.close()}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={text.trim() === cur}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
