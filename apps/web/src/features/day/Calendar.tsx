import { dayKey, dayWord, fmtDate, mondayOf, monthOf, parseISO, shiftDays, type ISODate } from '@logbook/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { IconButton, useSheet } from '@/ui';
import { useLog } from '../log/useLog';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/**
 * The calendar sheet behind a tap on the date line: one month, Monday first, a dot under each day in its day colour, today
 * ringed, the shown day filled. A day goes there; the month steps with the two chevrons inside the sheet.
 */
export const CalendarSheet = ({ date, onPick }: { date: ISODate; onPick: (d: ISODate) => void }) => {
  const [month, setMonth] = useState(monthOf(date));
  const first = `${month}-01`;
  const log = useLog(useMemo(() => [month], [month]));
  const sheet = useSheet();
  const start = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => shiftDays(start, i)).filter((d, i) => i < 35 || monthOf(shiftDays(start, 35)) === month);
  const step = (n: number) => {
    const d = parseISO(first);
    d.setMonth(d.getMonth() + n);
    haptics.select();
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className="cal">
      <div className="cal-head">
        <IconButton label="Previous month" onClick={() => step(-1)}>
          <ChevronLeft size={20} />
        </IconButton>
        <span className="cal-month" aria-live="polite">
          {fmtDate('month', first)}
        </span>
        <IconButton label="Next month" onClick={() => step(1)}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div className="cal-grid" role="grid" aria-label={fmtDate('month', first)}>
        {DOW.map((d, i) => (
          <span key={i} className="caps cal-dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth = monthOf(d) === month;
          const k = log.loaded(d) ? dayKey(log.snap, d) : null;
          return (
            <button
              key={d}
              type="button"
              className={`cal-day ${inMonth ? '' : 'out'} ${d === log.today ? 'is-today' : ''} ${d === date ? 'is-on' : ''}`}
              aria-label={`${fmtDate('long', d)}${k && k !== 'rest' && k !== 'planned' ? `, ${dayWord(log.snap, d)}` : ''}`}
              aria-current={d === date ? 'date' : undefined}
              onClick={() => {
                haptics.select();
                sheet.close();
                onPick(d);
              }}
            >
              <span>{parseISO(d).getDate()}</span>
              <i className={`cal-dot ${k ? `k-${k}` : ''}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
