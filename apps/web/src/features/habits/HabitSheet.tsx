import { fmtDate, monthOf, parseISO, shiftDays, type Habit, type ISODate } from '@logbook/shared';
import { CalendarCheck, Flame } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useHabitMutations } from '@/api/queries';
import { animate, motionValue } from 'motion/react';
import { hapticAtPeak, haptics } from '@/lib/haptics';
import { Button, useSheet, useToast } from '@/ui';
import { useLog } from '../log/useLog';
import { sameName } from './initial';
import { habitTiles, habitWindow, WINDOW_DAYS as DAYS } from './stats';
import './habits.css';

/** Archive a habit with an Undo, from anywhere (the tile's menu, the habit sheet). */
export const useArchiveHabit = () => {
  const { patch } = useHabitMutations();
  const toast = useToast();
  return (h: Habit) => {
    patch.mutate({ id: h.id, archived: true });
    haptics.delete();
    toast(`${h.name} archived`, { label: 'Undo', fn: () => patch.mutate({ id: h.id, archived: false }) });
  };
};

/** Open the habit sheet with the habit's name as its title. */
export const useOpenHabit = () => {
  const sheet = useSheet();
  return (h: Habit) => sheet.open({ eyebrow: 'Habit', title: h.name, body: <HabitSheet id={h.id} /> });
};

/**
 * A habit's detail: the last 30 days as a grid you can tap to fix a day (the days before the habit began are not days to
 * light), the streak, the notes it has gathered, a rename field and Archive (with Undo). This is where habits are managed
 * now; Today keeps only the tiles.
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
  const twinId = useId();
  if (!h) return null;
  // a name another habit in use already has: said under the field, and not saved
  const twin = sameName(name, log.habits.filter((x) => x.id !== h.id).map((x) => x.name));
  const isDone = (d: ISODate) => log.snap.isHabitDone(d, h.id);
  // "N of 30" counts only the days the habit existed; the best run is the stamp when today's streak is short
  const { days, since, lit, streak, best } = habitWindow(isDone, t, h.createdOn, DAYS);
  const tiles = habitTiles({ since, lit, streak, best }, since.length < DAYS ? `Since ${fmtDate('md', h.createdOn)}` : `Last ${DAYS} days`);
  const notes = days
    .map((d) => ({ d, note: log.snap.checkOf(d, h.id)?.note ?? '' }))
    .filter((x) => x.note)
    .reverse();
  const rename = () => {
    const v = name.trim();
    if (v && v !== h.name && !twin) {
      patch.mutate({ id: h.id, name: v });
      sheet.update({ title: v });
    } else setName(h.name);
  };
  return (
    <div className="hs">
      <div className="tiles hs-tiles">
        {tiles.map((x, i) => (
          <div key={x.label} className="tile hs-tile">
            <span className="tile-label">
              {i === 0 ? <Flame size={15} aria-hidden="true" /> : <CalendarCheck size={15} aria-hidden="true" />} {x.label}
            </span>
            <span className="tile-value tnum">
              {x.value}
              {x.unit ? <small>{x.unit}</small> : null}
            </span>
            <span className={`tile-status ${x.none ? 'is-none' : ''}`}>{x.status}</span>
          </div>
        ))}
      </div>
      <section className="card hs-card" aria-label={`Last ${DAYS} days`}>
        <div className="hs-card-head">
          <h3 className="hs-card-title">Last {DAYS} days</h3>
          <span className="hs-card-foot">Tap a day to fix it</span>
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
                // a day before the habit began cannot be lit (the count would leave it out while the streak took it in); one
                // that was lit before this rule can still be put out
                disabled={before && !on}
                aria-label={`${fmtDate('long', d)}, ${before && !on ? 'before this habit began' : on ? 'done' : 'not done'}`}
                onClick={() => {
                  // lighting a day is a habit tile lighting: `orb` on the frame its fill completes (no pop on a cell); putting one out is silent
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
      </section>
      <section className="card hs-card hs-notes" aria-label="Notes">
        <div className="hs-card-head">
          <h3 className="hs-card-title">Notes</h3>
          {notes.length ? <span className="hs-card-foot tnum">{notes.length}</span> : null}
        </div>
        {notes.length ? (
          notes.map((n) => (
            <div key={n.d} className="hs-note">
              <span className="hs-note-date">{fmtDate('short', n.d)}</span>
              <span className="hs-note-text">{n.note}</span>
            </div>
          ))
        ) : (
          <p className="hs-note-none">No notes yet. Hold a habit on Today and choose Note.</p>
        )}
      </section>
      <section className="card hs-card" aria-label="Name">
        <label className="hs-field">
          <span className="hs-card-title">Name</span>
          <input className="in" value={name} maxLength={80} aria-label="Habit name" aria-invalid={twin ? true : undefined} aria-describedby={twin ? twinId : undefined} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
        </label>
        {twin ? (
          <p id={twinId} className="orb-add-twin" role="status">
            You already have {twin}.
          </p>
        ) : null}
      </section>
      <button
        type="button"
        className="pill-row hs-archive"
        onClick={() => {
          sheet.close();
          archive(h);
        }}
      >
        Archive habit
      </button>
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
