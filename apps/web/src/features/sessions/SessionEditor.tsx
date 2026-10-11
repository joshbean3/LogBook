import { fmtDate, KINDS, TYPES, type Session, type SessionKind } from '@logbook/shared';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useSessionMutations } from '@/api/queries';
import { Button, Field, Segmented } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

const KIND_LABEL: Record<SessionKind, string> = { run: 'Run', lift: 'Lift', cross: 'Cross', rest: 'Rest' };

export const SessionEditor = ({ date, session, restore }: { date: string; session: Session | null; restore?: boolean }) => {
  const isNew = !session || restore;
  const { upsert, remove, restore: restoreSession } = useSessionMutations();
  const sheet = useSheet();
  const toast = useToast();
  const [d, setD] = useState(date);
  const [kind, setKind] = useState<SessionKind>(session?.kind ?? 'run');
  const [type, setType] = useState(session?.type ?? 'Easy');
  const [title, setTitle] = useState(session?.title ?? '');
  const [details, setDetails] = useState(session?.details ?? '');
  const [miles, setMiles] = useState(session?.miles != null ? String(session.miles) : '');
  const [minutes, setMinutes] = useState(session?.minutes != null ? String(session.minutes) : '');
  const [busy, setBusy] = useState(false);
  const types = TYPES[kind];
  const typeOptions = types.includes(type) || !type ? [...types] : [type, ...types];
  const changeKind = (k: SessionKind) => {
    setKind(k);
    setType(TYPES[k][0] ?? '');
  };
  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const to = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : date;
    setBusy(true);
    try {
      await upsert.mutateAsync({
        id: restore ? undefined : session?.id,
        prevDate: session && !restore ? session.date : undefined,
        date: to,
        kind,
        type: type || null,
        title: title.trim() || null,
        details: details.trim() || null,
        miles: kind === 'run' && Number(miles) > 0 ? Math.round(Number(miles) * 10) / 10 : null,
        minutes: Number(minutes) > 0 ? Math.round(Number(minutes)) : null,
      });
      sheet.close();
      toast(isNew ? 'Session added' : to !== date ? `Moved to ${fmtDate('short', to)}` : 'Session saved');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Not saved. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={save}>
      <Field label="Date">
        <input className="in" type="date" value={d} onChange={(e) => setD(e.target.value)} required />
      </Field>
      <div className="field">
        <span className="field-label">Kind</span>
        <Segmented options={KINDS.map((k) => [k, KIND_LABEL[k]] as [SessionKind, string])} value={kind} onChange={changeKind} label="Kind" />
      </div>
      <div className="grid2">
        <Field label="Type">
          <select className="in" value={type} onChange={(e) => setType(e.target.value)}>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        {kind === 'run' ? (
          <Field label="Miles">
            <input className="in" type="number" inputMode="decimal" step={0.1} min={0} value={miles} onChange={(e) => setMiles(e.target.value)} />
          </Field>
        ) : (
          <Field label="Minutes">
            <input className="in" type="number" inputMode="numeric" step={1} min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        )}
      </div>
      <div className="grid2">
        <Field label="Title">
          <input className="in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Easy 5" maxLength={60} />
        </Field>
        {kind === 'run' ? (
          <Field label="Minutes">
            <input className="in" type="number" inputMode="numeric" step={1} min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        ) : null}
      </div>
      <Field label="Details">
        <textarea className="in" rows={3} maxLength={600} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Warm-up, reps, paces, exercises" />
      </Field>
      <div className="sheet-foot">
        {!isNew && session ? (
          <Button
            variant="danger"
            onClick={() => {
              remove.mutate(session);
              sheet.close();
              toast('Session deleted', { label: 'Undo', fn: () => restoreSession.mutate(session) });
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="foot-right">
          <Button variant="ghost" onClick={sheet.close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {isNew ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </form>
  );
};
