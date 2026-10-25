import { floorFor, floorMinutes, fmtDate, label, monthsBetween, num, shiftDays, tone, TYPES, type Session, type SessionKind } from '@logbook/shared';
import { Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ApiError } from '@/api/client';
import { useAllLifts, useSessionMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, Segmented, Stepper } from '@/ui/primitives';
import { useSheet, useSheetDepth } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { DayPicker } from './DayPicker';
import { PressButton } from './PressButton';

const KIND_LABEL: Record<SessionKind, string> = { run: 'Run', lift: 'Lift', cross: 'Cross', rest: 'Rest' };
const KIND_ORDER: SessionKind[] = ['run', 'lift', 'cross', 'rest'];
/** The run types worth a chip, in the order a week uses them. "Run" (an imported plan's word) shows only when in use. */
const RUN_TYPES = ['Easy', 'Long', 'Tempo', 'Threshold', 'Speed', 'Intervals', 'Hills', 'Fartlek', 'Recovery', 'Race'];
const DEFAULT_MILES: Record<string, number> = { Easy: 4, Recovery: 3, Long: 8, Race: 3.1 };
const r05 = (v: number) => Math.round(v * 2) / 2;
const fmtMi = (v: number) => `${num(v)} mi`;
const parseMi = (s: string) => {
  const v = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(v) && v > 0 ? r05(v) : null;
};
const fmtMin = (v: number) => `${v} min`;
const parseMin = (s: string) => {
  const v = Math.round(Number(s.replace(/[^\d]/g, '')));
  return Number.isFinite(v) && v > 0 ? v : null;
};
/** A lift's details are its exercise list, "Squat, Bench, Row". */
const splitExercises = (s: string | null) => (s ? s.split(/\s*,\s*/).filter((x) => x && x.length <= 40) : []);

/**
 * Add or edit a session, shaped by its kind: a run picks a type and steps its miles (or takes the floor); a lift picks its
 * exercises; cross training counts minutes; rest is just the day. The date is a strip of days, not a calendar field.
 * "Repeat last Easy" copies the last session of that type. Saving pops back to the session sheet when this was pushed there.
 */
export const SessionEditor = ({ date, session, restore }: { date: string; session: Session | null; restore?: boolean }) => {
  const isNew = !session || !!restore;
  const { upsert } = useSessionMutations();
  const sheet = useSheet();
  const depth = useSheetDepth();
  const toast = useToast();
  const lifts = useAllLifts();
  // twelve weeks back, for "Repeat last …"
  const log = useLog(monthsBetween(shiftDays(date, -84), date));
  const [d, setD] = useState(date);
  const [kind, setKind] = useState<SessionKind>(session?.kind ?? 'run');
  const [type, setType] = useState(session?.type ?? (session?.kind ? (TYPES[session.kind][0] ?? '') : 'Easy'));
  const [title, setTitle] = useState(session?.title ?? '');
  const [details, setDetails] = useState(session?.kind === 'lift' ? '' : (session?.details ?? ''));
  const [exercises, setExercises] = useState<string[]>(session?.kind === 'lift' ? splitExercises(session.details) : []);
  const [newEx, setNewEx] = useState('');
  const [miles, setMiles] = useState<number | null>(session?.miles ?? (session ? null : DEFAULT_MILES.Easy!));
  const [minutes, setMinutes] = useState<number | null>(session?.minutes ?? null);
  const [busy, setBusy] = useState(false);

  /** The last session of this kind (and, for a run, this type) before the date. */
  const last = useMemo(() => {
    for (let i = 1; i <= 84; i++) {
      const day = shiftDays(d, -i);
      const hit = log.snap
        .sessionsOn(day)
        .filter((s) => s.id !== session?.id && s.kind === kind && (kind !== 'run' || (s.type ?? '') === type))
        .pop();
      if (hit) return hit;
    }
    return null;
  }, [log.snap, d, kind, type, session?.id]);

  const names = useMemo(() => {
    const seen = new Map<string, number>();
    for (const s of lifts.data ?? []) seen.set(s.exercise, (seen.get(s.exercise) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n).slice(0, 10);
  }, [lifts.data]);

  const pickKind = (k: SessionKind) => {
    setKind(k);
    const t0 = k === 'run' ? 'Easy' : (TYPES[k][0] ?? '');
    setType(t0);
    if (k === 'run') setMiles((m) => m ?? DEFAULT_MILES.Easy!);
    if (k === 'cross' || k === 'lift') setMinutes((m) => m ?? 45);
  };
  const pickType = (t: string) => {
    setType(t);
    // a fresh run takes its type's usual distance; an edited one keeps what it had
    if (kind === 'run' && (isNew || miles == null)) setMiles(DEFAULT_MILES[t] ?? miles ?? 5);
  };
  const repeat = () => {
    if (!last) return;
    setType(last.type ?? type);
    setMiles(last.miles);
    setMinutes(last.minutes);
    if (last.kind === 'lift') setExercises(splitExercises(last.details));
    else setDetails(last.details ?? '');
  };
  const floorMin = kind === 'run' ? floorMinutes({ kind, type }) : null;
  const floorOnly = kind === 'run' && miles == null && minutes != null && minutes === floorMin;
  const toggleFloor = () => {
    if (floorOnly) {
      setMinutes(null);
      setMiles(DEFAULT_MILES[type] ?? 4);
    } else {
      setMiles(null);
      setMinutes(floorMin);
    }
  };
  const toggleEx = (n: string) => {
    setExercises((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n]));
  };
  const addEx = () => {
    const n = newEx.trim();
    if (!n) return;
    if (!exercises.includes(n)) setExercises((xs) => [...xs, n]);
    setNewEx('');
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      await upsert.mutateAsync({
        id: restore ? undefined : session?.id,
        prevDate: session && !restore ? session.date : undefined,
        date: d,
        kind,
        type: kind === 'rest' ? 'Rest' : type || null,
        title: title.trim() || null,
        details: kind === 'lift' ? exercises.join(', ') || null : kind === 'rest' ? null : details.trim() || null,
        miles: kind === 'run' ? miles : null,
        minutes: kind === 'rest' ? null : minutes,
      });
      // the sheet closing onto the changed row is the answer: no haptic, no toast without an Undo (§8, §11.4)
      if (depth > 1) sheet.pop();
      else sheet.close();
    } catch (err) {
      haptics.error();
      toast(err instanceof ApiError ? err.message : 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const runTypes = type && !RUN_TYPES.includes(type) && kind === 'run' ? [type, ...RUN_TYPES] : RUN_TYPES;
  const types = kind === 'run' ? runTypes : kind === 'rest' ? [] : [...TYPES[kind]];
  const preview = kind === 'rest' ? 'Rest' : label({ kind, type, title: title.trim() || null, miles: kind === 'run' ? miles : null });
  const lastWords = last ? `Repeat last ${last.kind === 'run' ? last.type ?? 'run' : label(last)}${last.kind === 'run' && last.miles ? ` · ${num(last.miles)} mi` : last.kind === 'lift' && last.details ? ` · ${splitExercises(last.details).slice(0, 2).join(', ')}` : ''}` : null;

  return (
    <form className="ed" onSubmit={save}>
      <div className={`ed-preview t-${tone({ kind, type })}`} aria-live="polite">
        <i aria-hidden="true" />
        <span className="stamp">{preview}</span>
        <span className="ed-preview-day">{fmtDate('short', d)}</span>
      </div>
      <Segmented label="Kind" options={KIND_ORDER.map((k) => [k, KIND_LABEL[k]] as [SessionKind, string])} value={kind} onChange={pickKind} />
      {lastWords ? (
        <PressButton className="pl-chip ed-repeat" onClick={repeat}>
          <Repeat size={16} aria-hidden="true" />
          {lastWords}
        </PressButton>
      ) : null}
      {types.length ? (
        <div className="ed-group">
          <span className="ed-label" id="ed-type">
            Type
          </span>
          <div className="ed-chips" role="radiogroup" aria-labelledby="ed-type">
            {types.map((t) => (
              <PressButton key={t} role="radio" aria-checked={type === t} className={`pl-chip ${type === t ? 'on' : ''}`} onClick={() => pickType(t)}>
                {kind === 'run' ? <i className={`ed-dot t-${tone({ kind, type: t })}`} aria-hidden="true" /> : null}
                {t}
              </PressButton>
            ))}
          </div>
        </div>
      ) : null}
      {kind === 'run' ? (
        <div className="ed-group">
          <span className="ed-label">Distance</span>
          {floorOnly ? (
            <p className="t-sub ink2">Just the floor: {floorFor({ kind, type })}.</p>
          ) : (
            <Stepper label="Miles" value={miles ?? 0} onChange={(v) => setMiles(v)} step={0.5} min={0.5} max={50} format={fmtMi} parse={parseMi} inputProps={{ inputMode: 'decimal' }} />
          )}
          {floorMin ? (
            <PressButton role="switch" aria-checked={floorOnly} className={`pl-chip ${floorOnly ? 'on' : ''}`} onClick={toggleFloor}>
              Floor only · {floorMin} min
            </PressButton>
          ) : null}
        </div>
      ) : null}
      {kind === 'lift' ? (
        <div className="ed-group">
          <span className="ed-label" id="ed-ex">
            Exercises
          </span>
          <div className="ed-chips" role="group" aria-labelledby="ed-ex">
            {[...new Set([...exercises, ...names])].map((n) => (
              <PressButton key={n} role="checkbox" aria-checked={exercises.includes(n)} className={`pl-chip ${exercises.includes(n) ? 'on' : ''}`} onClick={() => toggleEx(n)}>
                {n}
              </PressButton>
            ))}
          </div>
          <div className="ed-add">
            <input className="in" value={newEx} maxLength={40} placeholder="Add an exercise" aria-label="Add an exercise" onChange={(e) => setNewEx(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' ? (e.preventDefault(), addEx()) : undefined)} />
            <Button onClick={addEx} disabled={!newEx.trim()}>
              Add
            </Button>
          </div>
        </div>
      ) : null}
      {kind === 'cross' || kind === 'lift' ? (
        <div className="ed-group">
          <span className="ed-label">Time</span>
          <Stepper label="Minutes" value={minutes ?? 45} onChange={(v) => setMinutes(v)} step={5} min={5} max={300} format={fmtMin} parse={parseMin} inputProps={{ inputMode: 'numeric' }} />
        </div>
      ) : null}
      <div className="ed-group">
        <span className="ed-label">Day</span>
        <DayPicker value={d} onPick={(x) => setD(x)} origin={session && !restore ? session.date : undefined} skipId={session?.id} />
      </div>
      {kind !== 'rest' ? (
        <div className="ed-group">
          <label className="ed-label" htmlFor="ed-name">
            Name and notes
          </label>
          <input id="ed-name" className="in" value={title} maxLength={60} placeholder={label({ kind, type, title: null, miles: kind === 'run' ? miles : null })} onChange={(e) => setTitle(e.target.value)} />
          {kind !== 'lift' ? <textarea className="in" rows={2} maxLength={600} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={kind === 'run' ? 'Warm-up, reps, paces' : 'Anything worth knowing'} aria-label="Notes" /> : null}
        </div>
      ) : null}
      <div className="sheet-foot">
        <span />
        <div className="foot-right">
          <Button variant="primary" type="submit" disabled={busy || (kind === 'run' && miles == null && minutes == null)}>
            {isNew ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
};
