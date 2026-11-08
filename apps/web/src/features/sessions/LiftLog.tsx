import { monthOf, type LiftSet } from '@logbook/shared';
import { Check, ChevronRight, Delete, Dumbbell, Minus, Plus, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAllLifts, useLiftMutations } from '@/api/queries';
import { haptics } from '@/lib/haptics';
import { Button, IconButton } from '@/ui/primitives';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';
import { PressButton } from './PressButton';
import { canAdd, fmtNum, groupsOf, hintFor, lastSession, pressKey, setText, stepValue, type PadKey } from './liftModel';

type Field = 'w' | 'r';
const KEYS: PadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

/**
 * The day's lifting (docs/inspiration.md §5 "Live lift logging"): the sets so far by exercise, each a row tinted with a
 * check; under the exercise in hand, the next set's row with last session's numbers as its hint ("Last time 135 × 8")
 * and a number pad with a −/+ stepper (5 lb, 1 rep) and "Same as last". Add set stays grey until the set is whole. A
 * removed set comes back with Undo. A hardware keyboard types into the picked field; Enter adds. `onDone` hears Done
 * logging (the session sheet then asks how hard it was).
 */
export const LiftLog = ({ date, onDone }: { date: string; onDone?: (logged: number) => void }) => {
  const log = useLog([monthOf(date)]);
  const all = useAllLifts();
  const { add, remove } = useLiftMutations();
  const toast = useToast();
  const sets = log.snap.liftsOn(date);
  const groups = useMemo(() => groupsOf(sets), [sets]);
  const [open, setOpen] = useState(false);
  const [ex, setEx] = useState('');
  const [w, setW] = useState('');
  const [r, setR] = useState('');
  const [field, setField] = useState<Field>('w');
  const fresh = useRef(true);
  const exRef = useRef<HTMLInputElement>(null);
  const history = all.data ?? [];
  const names = useMemo(() => [...new Set(history.map((s) => s.exercise))].reverse(), [history]);
  const today = new Set(groups.map((g) => g.exercise.toLowerCase()));
  const recents = names.filter((n) => !today.has(n.toLowerCase())).slice(0, 4);
  const name = ex.trim();
  const active = groups.find((g) => g.exercise.toLowerCase() === name.toLowerCase()) ?? null;
  const prev = useMemo(() => lastSession(history, name, date), [history, name, date]);
  const idx = active?.sets.length ?? 0;
  const hint = hintFor(prev, idx);
  const lastToday = active?.sets[active.sets.length - 1] ?? null;
  const same = lastToday ?? hint;
  // an empty weight takes last time's, as the field's placeholder shows
  const wEff = w !== '' ? w : hint ? fmtNum(hint.weight) : '';
  const ok = canAdd(name, wEff, r);

  const pickField = (f: Field) => {
    setField(f);
    fresh.current = true;
  };
  const pickExercise = (n: string) => {
    setEx(n);
    setOpen(true);
    const g = groups.find((x) => x.exercise.toLowerCase() === n.toLowerCase());
    const last = g?.sets[g.sets.length - 1];
    // a second set of the same exercise starts from the first one's numbers
    setW(last ? fmtNum(last.weight) : '');
    setR(last ? String(last.reps) : '');
    pickField(last ? 'r' : 'w');
  };
  const setVal = (f: Field, v: string) => (f === 'w' ? setW(v) : setR(v));
  const valOf = (f: Field) => (f === 'w' ? w : r);
  const key = (k: PadKey) => {
    setVal(field, pressKey(valOf(field), k, { fresh: fresh.current, decimals: field === 'w' }));
    fresh.current = false;
  };
  const step = (dir: 1 | -1) => {
    haptics.select();
    const base = field === 'w' ? wEff : r || (hint ? String(hint.reps) : '');
    setVal(field, stepValue(base, field, dir));
    fresh.current = false;
  };
  const sameAsLast = () => {
    if (!same) return;
    setW(fmtNum(same.weight));
    setR(String(same.reps));
    fresh.current = true;
  };
  const submit = () => {
    if (!name) return exRef.current?.focus();
    if (!ok) return;
    add.mutate({ date, exercise: name, weight: Number(wEff), reps: Number(r) });
    haptics.drop();
    // the next set starts as this one: Add set again logs the same, or change one number
    setW(wEff);
    pickField('r');
  };
  const drop = (s: LiftSet) => {
    haptics.delete();
    remove.mutate(s);
    toast('Set removed', { label: 'Undo', fn: () => add.mutate({ date, exercise: s.exercise, weight: s.weight, reps: s.reps }) });
  };
  const onFieldKey = (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key) || e.key === '.') key(e.key as PadKey);
    else if (e.key === 'Backspace') key('back');
    else if (e.key === 'Enter') submit();
    else if (e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowDown') step(-1);
    else return;
    e.preventDefault();
  };

  const pendingRow = (
    <li className="lft-set is-next">
      <span className="lft-n tnum">{idx + 1}</span>
      <span className="lft-fields">
        <button type="button" className={`lft-field tnum ${field === 'w' ? 'is-on' : ''} ${w === '' ? 'is-ghost' : ''}`} aria-pressed={field === 'w'} aria-label={`Weight, ${wEff || 'empty'} pounds`} onClick={() => pickField('w')} onKeyDown={onFieldKey}>
          {wEff || '–'}
          <small>lb</small>
        </button>
        <span className="lft-x" aria-hidden="true">
          ×
        </span>
        <button type="button" className={`lft-field tnum ${field === 'r' ? 'is-on' : ''} ${r === '' ? 'is-ghost' : ''}`} aria-pressed={field === 'r'} aria-label={`Reps, ${r || 'empty'}`} onClick={() => pickField('r')} onKeyDown={onFieldKey}>
          {r || (hint ? hint.reps : '–')}
          <small>reps</small>
        </button>
      </span>
      <span className="lft-hint">{hint ? `Last time ${setText(hint)}` : 'First time'}</span>
    </li>
  );

  const group = (exercise: string, rows: LiftSet[], isActive: boolean) => (
    <section key={exercise.toLowerCase()} className={`lft ${isActive ? 'is-active' : ''}`} aria-label={exercise}>
      <PressButton press="surface" className="lft-head" onClick={() => pickExercise(exercise)} aria-label={`${exercise}: ${rows.length} ${rows.length === 1 ? 'set' : 'sets'}. Add a set`}>
        <span className="icon-tile lft-ic" aria-hidden="true">
          <Dumbbell size={17} />
        </span>
        <span className="lft-head-main">
          <span className="lft-name">{exercise}</span>
          <span className="lft-count tnum">{rows.length ? `${rows.length} ${rows.length === 1 ? 'set' : 'sets'}` : 'The first set'}</span>
        </span>
        <Plus size={18} className="lft-head-add" aria-hidden="true" />
      </PressButton>
      <ol className="lft-sets">
        {rows.map((s, i) => (
          <li key={s.id} className="lft-set is-done">
            <span className="lft-n tnum">{i + 1}</span>
            <span className="stamp lft-val tnum">{setText(s)}</span>
            <span className="lft-check" aria-label="Logged">
              <Check size={14} strokeWidth={3} aria-hidden="true" />
            </span>
            <IconButton label={`Remove ${s.exercise} set ${i + 1}`} size="sm" onClick={() => drop(s)}>
              <X size={14} />
            </IconButton>
          </li>
        ))}
        {isActive && open ? pendingRow : null}
      </ol>
    </section>
  );

  return (
    <div className="lift-log">
      {groups.map((g) => group(g.exercise, g.sets, open && g === active))}
      {open && name && !active ? group(name, [], true) : null}
      {open ? (
        <div className="lft-compose">
          <datalist id="ex-list">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <input
            ref={exRef}
            className="in lft-ex"
            placeholder="Exercise"
            list="ex-list"
            maxLength={60}
            aria-label="Exercise"
            autoComplete="off"
            value={ex}
            onChange={(e) => setEx(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (e.currentTarget.value.trim()) pickExercise(e.currentTarget.value.trim());
            }}
          />
          {recents.length && !name ? (
            <div className="lft-recents" role="group" aria-label="Recent exercises">
              {recents.map((n) => (
                <PressButton key={n} press="surface" className="lft-chip" onClick={() => pickExercise(n)}>
                  {n}
                </PressButton>
              ))}
            </div>
          ) : null}
          {name ? (
            <div className="lft-pad" role="group" aria-label={field === 'w' ? 'Weight' : 'Reps'}>
              <div className="lft-step">
                <PressButton className="lft-stepbtn" aria-label={field === 'w' ? 'Five pounds less' : 'One rep less'} onClick={() => step(-1)}>
                  <Minus size={20} aria-hidden="true" />
                </PressButton>
                <span className="lft-stepval">
                  <span className="caps">{field === 'w' ? 'Weight' : 'Reps'}</span>
                  <span className="stamp tnum">
                    {(field === 'w' ? wEff : r) || '–'}
                    <small>{field === 'w' ? ' lb' : ''}</small>
                  </span>
                </span>
                <PressButton className="lft-stepbtn" aria-label={field === 'w' ? 'Five pounds more' : 'One rep more'} onClick={() => step(1)}>
                  <Plus size={20} aria-hidden="true" />
                </PressButton>
              </div>
              <div className="lft-keys">
                {KEYS.map((k) => (
                  <PressButton key={k} press="surface" className="lft-key tnum" disabled={k === '.' && field === 'r'} aria-label={k === 'back' ? 'Delete' : k === '.' ? 'Point' : k} onClick={() => key(k)}>
                    {k === 'back' ? <Delete size={20} aria-hidden="true" /> : k}
                  </PressButton>
                ))}
              </div>
              <div className="lft-acts">
                <Button variant="soft" disabled={!same} onClick={sameAsLast}>
                  Same as last
                </Button>
                <Button variant="primary" className="lft-add" disabled={!ok} onClick={submit}>
                  Add set
                </Button>
              </div>
            </div>
          ) : null}
          <Button
            variant="quiet"
            className="lft-close"
            onClick={() => {
              setOpen(false);
              onDone?.(sets.length);
            }}
          >
            Done logging
          </Button>
        </div>
      ) : (
        <div className="group lft-open-group">
          <PressButton
            press="surface"
            className="lft-open-row"
            onClick={() => {
              setOpen(true);
              if (!name && groups.length) pickExercise(groups[groups.length - 1]!.exercise);
            }}
          >
            <span className="icon-tile" aria-hidden="true">
              <Plus size={18} />
            </span>
            <span className="lft-open-main">
              <span className="lft-open-title">{groups.length ? 'Add a set' : 'Log sets'}</span>
              <span className="lft-open-sub">{groups.length ? `${sets.length} ${sets.length === 1 ? 'set' : 'sets'} so far` : 'None yet. Last time’s numbers fill in.'}</span>
            </span>
            <ChevronRight size={18} className="lft-open-chev" aria-hidden="true" />
          </PressButton>
        </div>
      )}
    </div>
  );
};
