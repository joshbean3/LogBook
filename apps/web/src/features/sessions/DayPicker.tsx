import { fmtDate, heroSession, label, mondayOf, monthsBetween, parseISO, shiftDays, tone } from '@logbook/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DayPager, useDayPagerHandle } from '@/ui/DayPager';
import { IconButton } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useLog } from '../log/useLog';
import './daypicker.css';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A week of days to pick from (Move, the session editor's day): the day letter, the date, and a short bar in the colour of
 * what already sits there. Today is ringed, the picked day is filled, the session's own day (`origin`) sits back. The weeks
 * page on `DayPager` v2 (`step: 'week'`): a swipe tracks the finger 1:1, the chevrons slide one week; no haptic on a page or
 * a pick (spec §11.4). Each cell is a `Pressable` (0.97 on touch-down) at least 44 px wide at 320 (the pager bleeds to the
 * sheet's edges). Classes are `.dpk-*` (the contract's `.dp` is the pager's).
 */
export const DayPicker = ({ value, onPick, origin, skipId, labelFor }: { value: string; onPick: (d: string) => void; origin?: string; skipId?: string; labelFor?: (d: string, what: string) => string }) => {
  const handle = useDayPagerHandle();
  const [week, setWeek] = useState(mondayOf(value));
  // the week in view and its neighbours (always mounted by the pager)
  const log = useLog(monthsBetween(shiftDays(week, -7), shiftDays(week, 13)));
  // a pick from outside (a "Tomorrow" chip) brings its week into view: one slide, or the pager's far crossfade
  const seen = useRef(value);
  useEffect(() => {
    if (value === seen.current) return;
    seen.current = value;
    const mon = mondayOf(value);
    if (mon !== week) handle.goTo(mon);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = log.today;
  // a chevron tapped while a slide runs steps on from where that slide is going, not from the committed week (code review 1 #5)
  const from = () => handle.target.get() ?? week;
  const render = (mon: string) => (
    <div className="dpk-week" role="group" aria-label={`Week of ${fmtDate('md', mon)}`}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = shiftDays(mon, i);
        const there = log.snap.sessionsOn(d).filter((s) => s.id !== skipId);
        const lead = heroSession(there);
        const what = lead ? (lead.kind === 'rest' ? 'rest' : label(lead)) : 'free';
        return (
          <Pressable
            key={d}
            className={`dpk-day ${d === value ? 'is-sel' : ''} ${d === t ? 'is-today' : ''} ${d === origin ? 'is-origin' : ''}`}
            aria-pressed={d === value}
            aria-current={d === t ? 'date' : undefined}
            label={labelFor ? labelFor(d, what) : `${fmtDate('long', d)}, ${what}`}
            onPress={() => onPick(d)}
          >
            <span className="dpk-dow">{DOW[i]}</span>
            <span className="dpk-pill">
              <span className="dpk-num">{parseISO(d).getDate()}</span>
              <i className={`dpk-bar ${lead && lead.kind !== 'rest' ? `t-${tone(lead)}` : 'none'}`} aria-hidden="true" />
            </span>
          </Pressable>
        );
      })}
    </div>
  );
  return (
    <div className="dpk">
      <div className="dpk-head">
        <span className="caps">
          {fmtDate('md', week)} – {fmtDate('md', shiftDays(week, 6))}
        </span>
        <span className="dpk-nav">
          <IconButton label="Previous week" onClick={() => handle.goTo(shiftDays(from(), -7))}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label="Next week" onClick={() => handle.goTo(shiftDays(from(), 7))}>
            <ChevronRight size={20} />
          </IconButton>
        </span>
      </div>
      <DayPager className="dp-intrinsic dpk-pager" date={week} step="week" handle={handle} onCommit={setWeek} render={render} label="Week" prevLabel="Previous week" nextLabel="Next week" />
    </div>
  );
};
