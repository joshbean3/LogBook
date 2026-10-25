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
  const weekNow = useRef(week);
  weekNow.current = week;
  /**
   * A chevron tapped while the strip moves (a chevron's slide, a swipe's release) waits for it to rest, then slides on by
   * every step asked for meanwhile, in one goTo (its destination is in place before that slide starts): no step is lost and
   * the page sliding in never changes under the eye (code review 1 #5, code review 2 #10).
   */
  const queued = useRef({ n: 0, waiting: false });
  const step = (dir: 1 | -1) => {
    const q = queued.current;
    if (!handle.moving.get() && !q.waiting) return handle.goTo(shiftDays(weekNow.current, 7 * dir));
    q.n += dir;
    if (q.waiting) return;
    q.waiting = true;
    const off = handle.moving.on('change', (m) => {
      if (m) return;
      off();
      // the rest's commit runs right after `moving` drops: step on from the week it commits
      queueMicrotask(() => {
        const n = q.n;
        q.n = 0;
        q.waiting = false;
        if (n) handle.goTo(shiftDays(weekNow.current, 7 * n));
      });
    });
  };
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
          <IconButton label="Previous week" onClick={() => step(-1)}>
            <ChevronLeft size={20} />
          </IconButton>
          <IconButton label="Next week" onClick={() => step(1)}>
            <ChevronRight size={20} />
          </IconButton>
        </span>
      </div>
      <DayPager className="dp-intrinsic dpk-pager" date={week} step="week" handle={handle} onCommit={setWeek} render={render} label="Week" prevLabel="Previous week" nextLabel="Next week" />
    </div>
  );
};
