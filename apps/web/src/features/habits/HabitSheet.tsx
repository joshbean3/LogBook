import { fmtDate, habitStreak, monthOf, parseISO, shiftDays, type Habit, type ISODate } from '@logbook/shared';
import { useMemo, useState } from 'react';
import { useHabitMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
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
  const lit = days.filter(isDone).length;
  const streak = habitStreak(isDone, t);
  const week = days.slice(-7).filter(isDone).length;
  const notes = days
    .map((d) => ({ d, note: log.snap.checkOf(d, h.id)?.note ?? '' }))
    .filter((x) => x.note)
    .reverse();
  const rename = () => {
    const v = name.trim();
    if (v && v !== h.name) {
      patch.mutate({ id: h.id, name: v });
      sheet.update({ title: v });
      haptics.toggle();
    } else setName(h.name);
  };
  return (
    <div className="hs">
      <div className="hs-stamps">
        <span className="hs-stamp">
          <span className="caps">Last 30 days</span>
          <span className="stamp hs-num">
            {lit ? lit : 'None'}
            {lit ? <small> of {DAYS}</small> : null}
          </span>
        </span>
        {streak >= 2 ? (
          <span className="hs-stamp">
            <span className="caps">Streak</span>
            <span className="stamp hs-num">
              {streak}
              <small> days</small>
            </span>
          </span>
        ) : (
          <span className="hs-stamp">
            <span className="caps">Last 7 days</span>
            <span className="stamp hs-num">
              {week ? week : 'None'}
              {week ? <small> of 7</small> : null}
            </span>
          </span>
        )}
      </div>
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
                if (on) haptics.toggle();
                else haptics.orb();
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
    haptics.toggle();
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
