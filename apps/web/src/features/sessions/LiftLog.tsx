import { fmtDate } from '@logbook/shared';
import { X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAllLifts, useLiftMutations } from '@/api/queries';
import { Button, IconButton } from '@/ui/primitives';
import type { Log } from '../log/useLog';

/** Exercise, weight, reps. Fifteen seconds between sets. */
export const LiftLog = ({ date, log }: { date: string; log: Log }) => {
  const all = useAllLifts();
  const { add, remove } = useLiftMutations();
  const [ex, setEx] = useState('');
  const [w, setW] = useState('');
  const [r, setR] = useState('');
  const wRef = useRef<HTMLInputElement>(null);
  const rRef = useRef<HTMLInputElement>(null);
  const exRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => [...new Set((all.data ?? []).map((s) => s.exercise))].reverse(), [all.data]);
  const last = useMemo(() => {
    const n = ex.trim().toLowerCase();
    if (!n) return null;
    return [...(all.data ?? [])].filter((s) => s.exercise.toLowerCase() === n && s.date < date).pop() ?? null;
  }, [ex, all.data, date]);
  const sets = log.snap.liftsOn(date);
  const submit = () => {
    const name = ex.trim();
    const wt = Number(w || (last ? last.weight : ''));
    const reps = Number(r);
    if (!name) return exRef.current?.focus();
    if (!(wt >= 0) || (w === '' && !last)) return wRef.current?.focus();
    if (!(reps > 0)) return rRef.current?.focus();
    add.mutate({ date, exercise: name, weight: wt, reps });
    setW(String(wt));
    setR('');
    rRef.current?.focus();
  };
  const onKey = (next: React.RefObject<HTMLInputElement | null> | null) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (next) next.current?.focus();
    else submit();
  };
  return (
    <div className="lift-log">
      <datalist id="ex-list">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="lift-row">
        <input ref={exRef} className="in ex" placeholder="Exercise" list="ex-list" maxLength={60} aria-label="Exercise" autoComplete="off" value={ex} onChange={(e) => setEx(e.target.value)} onKeyDown={onKey(wRef)} />
        <input ref={wRef} className="in numin" type="number" inputMode="decimal" placeholder={last ? String(last.weight) : 'lb'} min={0} step={2.5} aria-label="Weight in pounds" value={w} onChange={(e) => setW(e.target.value)} onKeyDown={onKey(rRef)} />
        <span className="times">×</span>
        <input ref={rRef} className="in numin" type="number" inputMode="numeric" placeholder="reps" min={1} step={1} aria-label="Reps" value={r} onChange={(e) => setR(e.target.value)} onKeyDown={onKey(null)} />
        <Button size="sm" onClick={submit}>
          Add set
        </Button>
      </div>
      <div className="hint">{last ? `Last time: ${last.weight} × ${last.reps} on ${fmtDate('md', last.date)}` : ''}</div>
      {sets.length ? (
        <ul className="sets">
          {sets.map((s) => (
            <li key={s.id}>
              <span>
                {s.exercise} {s.weight} × {s.reps}
              </span>
              <IconButton label={`Remove ${s.exercise} set`} size="sm" onClick={() => remove.mutate(s)}>
                <X size={13} />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
