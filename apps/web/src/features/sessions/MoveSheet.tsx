import { addMonths, counts, fmtDate, label, mondayOf, monthsBetween, monthStart, parseISO, sessionStatus, shiftDays, tone, type Session } from '@logbook/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useSessionMutations } from '@/api/queries';
import { Button, IconButton } from '@/ui/primitives';
import { useSheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useLog } from '../log/useLog';

const DOW1 = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** The sheet's title: a caps MOVE over the session's name in the serif. */
export const MoveTitle = ({ session }: { session: Session }) => (
  <span className="mv-title">
    <span className="caps">Move</span>
    <span className="display">{session.kind === 'rest' ? 'Rest' : label(session)}</span>
  </span>
);

/** Open the Move calendar for a session, from the sheet footer or a long press on a row. */
export const openMoveSheet = (sheet: ReturnType<typeof useSheet>, date: string, session: Session) => sheet.open({ title: <MoveTitle session={session} />, body: <MoveSheet date={date} session={session} /> });

/**
 * A month calendar in the day-strip grammar: tap a day and the session moves there. Today is ringed in the accent,
 * the session's own day is filled white, days with sessions carry their 6px tone dots, past days sit at 40% and still take a tap.
 * Under the grid: Skip, and Delete.
 */
export const MoveSheet = ({ date, session }: { date: string; session: Session }) => {
  const [first, setFirst] = useState(monthStart(date));
  const next = addMonths(first, 1);
  const gridStart = mondayOf(first);
  // the grid runs in whole weeks from the Monday before the 1st to the Sunday after the last day
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = gridStart, i = 0; (d < next || parseISO(d).getDay() !== 1) && i < 42; d = shiftDays(d, 1), i++) out.push(d);
    return out;
  }, [gridStart, next]);
  const log = useLog(monthsBetween(gridStart, days[days.length - 1] ?? first));
  const { move, mark, remove, restore } = useSessionMutations();
  const sheet = useSheet();
  const toast = useToast();
  const t = log.today;
  const name = session.kind === 'rest' ? 'Rest' : label(session);
  // the hold that opened this sheet ends with a release, and the click it makes must not land on a day: a day only
  // takes a click that started with a press inside the sheet
  const pressed = useRef(false);

  const go = (to: string) => {
    if (!pressed.current) return;
    if (to === date) return;
    move.mutate({ session, to });
    sheet.close();
    toast(`Moved to ${fmtDate('short', to)}`, { label: 'Undo', fn: () => move.mutate({ session: { ...session, date: to }, to: date }) });
  };
  const skip = () => {
    const was = session.mark;
    const skipping = was !== 'skip';
    mark.mutate({ session, mark: skipping ? 'skip' : null });
    sheet.close();
    toast(skipping ? `${name} skipped` : `${name} back on`, { label: 'Undo', fn: () => mark.mutate({ session, mark: was }) });
  };
  const del = () => {
    remove.mutate(session);
    sheet.close();
    toast('Session deleted', { label: 'Undo', fn: () => restore.mutate(session) });
  };

  return (
    <div className="mv" onPointerDownCapture={() => (pressed.current = true)}>
      <div className="mv-nav">
        <span className="mv-month">{fmtDate('month', first)}</span>
        <IconButton label="Previous month" onClick={() => setFirst(addMonths(first, -1))}>
          <ChevronLeft size={22} />
        </IconButton>
        <IconButton label="Next month" onClick={() => setFirst(next)}>
          <ChevronRight size={22} />
        </IconButton>
      </div>
      <div className="mv-grid" role="grid" aria-label={`Pick a day in ${fmtDate('month', first)}`}>
        {DOW1.map((x, i) => (
          <span key={i} className="mv-dow" aria-hidden="true">
            {x}
          </span>
        ))}
        {days.map((d) => {
          const inMonth = d >= first && d < next;
          const here = d === date;
          const list = log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest' && s.id !== session.id);
          const bonus = !here && !list.length && log.snap.runsOn(d).length > 0;
          const what = here ? `${name} is here` : list.length ? list.map(label).join(', ') : 'free';
          return (
            <button
              key={d}
              type="button"
              className={`mv-day ${here ? 'is-here' : ''} ${d === t ? 'is-today' : ''} ${d < t || !inMonth ? 'is-dim' : ''}`}
              aria-current={d === t ? 'date' : undefined}
              aria-pressed={here}
              aria-label={`${fmtDate('long', d)}, ${what}${here ? '' : `. Move ${name} here`}`}
              onClick={() => go(d)}
            >
              <span className="mv-pill">
                <span className="mv-num">{parseISO(d).getDate()}</span>
                <span className="mv-dots" aria-hidden="true">
                  {here ? <i className={`mv-dot t-${tone(session)} on`} /> : null}
                  {bonus ? <i className="mv-dot t-easy on" /> : null}
                  {list.slice(0, here ? 2 : 3).map((s) => {
                    const st = sessionStatus(log.snap, d, s);
                    return <i key={s.id} className={`mv-dot t-${tone(s)} ${counts(st) ? 'on' : ''} ${st === 'skipped' ? 'skip' : ''}`} />;
                  })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="fine mv-hint">From {date === t ? 'today' : fmtDate('short', date)}. Tap a day.</p>
      <div className="sheet-foot">
        <Button variant="quiet" onClick={skip}>
          {session.mark === 'skip' ? 'Unskip' : 'Skip'}
        </Button>
        <div className="foot-right">
          <Button variant="danger" onClick={del}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};
