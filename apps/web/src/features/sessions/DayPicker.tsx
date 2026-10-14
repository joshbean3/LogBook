import { fmtDate, heroSession, label, mondayOf, monthsBetween, parseISO, shiftDays, tone } from '@logbook/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { DatePager } from '@/ui/DatePager';
import { IconButton } from '@/ui/primitives';
import { useLog } from '../log/useLog';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A week of days to pick from, one swipe per week (DatePager): the day letter, the date, and a short bar in the colour of
 * what already sits there. Today is ringed, the picked day is filled white, the session's own day (`origin`) sits back.
 * Used by Move (tap a day) and by the editor's date. Cells bleed to the sheet's edges so each is at least 44px wide at 320.
 */
export const DayPicker = ({ value, onPick, origin, skipId, labelFor }: { value: string; onPick: (d: string) => void; origin?: string; skipId?: string; labelFor?: (d: string, what: string) => string }) => {
  const [week, setWeek] = useState(mondayOf(value));
  // the week in view and its neighbours (they show while a swipe is under way)
  const log = useLog(monthsBetween(shiftDays(week, -7), shiftDays(week, 13)));
  // a pick from outside (a "Tomorrow" chip) brings its week into view
  useEffect(() => setWeek(mondayOf(value)), [value]);
  const t = log.today;
  const render = (mon: string) => (
    <div className="dp-week" role="group" aria-label={`Week of ${fmtDate('md', mon)}`}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = shiftDays(mon, i);
        const there = log.snap.sessionsOn(d).filter((s) => s.id !== skipId);
        const lead = heroSession(there);
        const what = lead ? (lead.kind === 'rest' ? 'rest' : label(lead)) : 'free';
        return (
          <button
            key={d}
            type="button"
            className={`dp-day ${d === value ? 'is-sel' : ''} ${d === t ? 'is-today' : ''} ${d === origin ? 'is-origin' : ''}`}
            aria-pressed={d === value}
            aria-current={d === t ? 'date' : undefined}
            aria-label={labelFor ? labelFor(d, what) : `${fmtDate('long', d)}, ${what}`}
            onClick={() => onPick(d)}
          >
            <span className="dp-dow">{DOW[i]}</span>
            <span className="dp-pill">
              <span className="dp-num">{parseISO(d).getDate()}</span>
              <i className={`dp-bar ${lead && lead.kind !== 'rest' ? `t-${tone(lead)}` : 'none'}`} aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="dp">
      <div className="dp-head">
        <span className="caps">{fmtDate('md', week)} – {fmtDate('md', shiftDays(week, 6))}</span>
        <span className="dp-nav">
          <IconButton label="Previous week" onClick={() => (haptics.select(), setWeek(shiftDays(week, -7)))}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label="Next week" onClick={() => (haptics.select(), setWeek(shiftDays(week, 7)))}>
            <ChevronRight size={20} />
          </IconButton>
        </span>
      </div>
      <DatePager className="dp-pager" date={week} onChange={setWeek} step="week" render={render} label="Week" prevLabel="Previous week" nextLabel="Next week" />
    </div>
  );
};
