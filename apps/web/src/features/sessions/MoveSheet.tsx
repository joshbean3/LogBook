import { fmtDate, label, mondayOf, monthOf, parseISO, shiftDays, type Session } from '@logbook/shared';
import { useState } from 'react';
import { useSessionMutations } from '@/api/queries';
import { Button } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';

/** Pick a day in the next two weeks, or any date. */
export const MoveSheet = ({ date, session }: { date: string; session: Session }) => {
  const log = useLog([monthOf(date), monthOf(shiftDays(date, 16))]);
  const { move } = useSessionMutations();
  const sheet = useSheet();
  const toast = useToast();
  const t = log.today;
  const start = date < t ? t : date;
  const mon = mondayOf(start);
  const days: string[] = [];
  for (let k = start < mon ? mon : start; k <= shiftDays(mon, 13); k = shiftDays(k, 1)) if (k !== date) days.push(k);
  if (date > t) for (const k of [shiftDays(date, -2), shiftDays(date, -1)]) if (k >= t && !days.includes(k)) days.unshift(k);
  days.sort();
  const [other, setOther] = useState(shiftDays(start, 1));
  const go = (to: string) => {
    move.mutate({ session, to });
    sheet.close();
    toast(`Moved to ${fmtDate('short', to)}`, { label: 'Undo', fn: () => move.mutate({ session: { ...session, date: to }, to: date }) });
  };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="t-sub muted">From {fmtDate('short', date)}. Pick a day.</p>
      <div className="move-grid">
        {days.map((k) => {
          const list = log.snap.sessionsOn(k).filter((x) => x.kind !== 'rest');
          return (
            <button key={k} type="button" className="move-chip" onClick={() => go(k)}>
              <b>{k === t ? 'Today' : `${fmtDate('dow', k)} ${parseISO(k).getDate()}`}</b>
              <span>{list.length ? list.map(label).join(' + ') : 'Free'}</span>
            </button>
          );
        })}
      </div>
      <div className="row">
        <input className="in" type="date" value={other} onChange={(e) => setOther(e.target.value)} aria-label="Another date" />
        <Button onClick={() => /^\d{4}-\d{2}-\d{2}$/.test(other) && go(other)}>Move</Button>
      </div>
    </div>
  );
};
