import { dayKey, dayWord, fmtDate, mondayOf, monthOf, parseISO, shiftDays, type ISODate } from '@logbook/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IconButton, useSheet } from '@/ui';
import { useLog } from '../log/useLog';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/**
 * The calendar sheet behind a tap on the date line: one month, Monday first, a dot under each day in its day colour, today
 * ringed, the shown day filled. A day goes there; the month steps with the two chevrons inside the sheet. In `week` mode
 * (Plan's `Go to a week…`) the shown day's whole week is lit and a pick answers that week's Monday. No haptic on a pick.
 */
export const CalendarSheet = ({ date, onPick, mode = 'day' }: { date: ISODate; onPick: (d: ISODate) => void; mode?: 'day' | 'week' }) => {
  const shownMon = mondayOf(date);
  const [month, setMonth] = useState(monthOf(date));
  const first = `${month}-01`;
  const log = useLog(useMemo(() => [month], [month]));
  const sheet = useSheet();
  const start = mondayOf(first);
  const cells = Array.from({ length: 42 }, (_, i) => shiftDays(start, i)).filter((d, i) => i < 35 || monthOf(shiftDays(start, 35)) === month);
  const step = (n: number) => {
    const d = parseISO(first);
    d.setMonth(d.getMonth() + n);
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
          const on = mode === 'week' ? mondayOf(d) === shownMon : d === date;
          return (
            <button
              key={d}
              type="button"
              className={`cal-day ${inMonth ? '' : 'out'} ${d === log.today ? 'is-today' : ''} ${on ? 'is-on' : ''} ${mode === 'week' && on ? 'in-week' : ''}`}
              aria-label={`${mode === 'week' ? `Week of ${fmtDate('long', mondayOf(d))}` : fmtDate('long', d)}${k && k !== 'rest' && k !== 'planned' ? `, ${dayWord(log.snap, d)}` : ''}`}
              aria-current={on ? (mode === 'week' ? 'true' : 'date') : undefined}
              onClick={() => {
                sheet.close();
                onPick(mode === 'week' ? mondayOf(d) : d);
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

/**
 * Opens the calendar sheet (medium, contracts §F): `day` mode answers the picked day (Today's `Go to a day…`), `week` mode
 * lights `value`'s week and answers the picked week's Monday (Plan's `Go to a week…`).
 */
export const useOpenCalendar = (o: { mode: 'day' | 'week'; value: string; onPick: (date: string) => void }): (() => void) => {
  const sheet = useSheet();
  return () =>
    sheet.open({
      eyebrow: o.mode === 'week' ? 'Go to a week' : 'Go to a day',
      title: o.mode === 'week' ? `Week of ${fmtDate('md', mondayOf(o.value))}` : fmtDate('long', o.value),
      detent: 'medium',
      body: <CalendarSheet date={o.value} onPick={o.onPick} mode={o.mode} />,
    });
};
