import { dayKey, dayWord, fmtDate, label, mi, mondayOf, monthOf, monthsBetween, num, parseISO, shiftDays, weekSummary, type ISODate } from '@logbook/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { IconButton, Pressable, useSheet, WeekRing } from '@/ui';
import { useLog, type Log } from '../log/useLog';
import { ringDays, streakLine, weekHeadline } from './dayWords';

/** The ring in the hero's corner: the week around the shown day. Tap → the week sheet. */
export const HeroWeekRing = ({ date, log, onPick, still }: { date: ISODate; log: Log; onPick: (d: ISODate) => void; still?: boolean }) => {
  const sheet = useSheet();
  const sum = useMemo(() => weekSummary(log.snap, mondayOf(date)), [log.snap, date]);
  const days = ringDays(sum, log.today);
  const ti = sum.days.findIndex((d) => d.date === log.today);
  const open = () => sheet.open({ eyebrow: weekEyebrow(sum.weekStart, log.today), title: weekHeadline(sum, log.today), body: <WeekSheet start={sum.weekStart} onPick={onPick} /> });
  return <WeekRing days={days} size={40} today={ti >= 0 ? ti : undefined} onceADay={still ? null : 'today-week-ring'} onPress={still ? undefined : open} />;
};

const weekEyebrow = (start: ISODate, today: ISODate) => (today >= start && today <= shiftDays(start, 6) ? 'This week' : `Week of ${fmtDate('md', start)}`);

/**
 * The week sheet: the ring large, miles against the plan as one line, the streak in weeks ("7 of the last 8 weeks"), then
 * the seven days as an edge-to-edge list, each with its word and its miles. A day row goes to that day.
 */
export const WeekSheet = ({ start, onPick }: { start: ISODate; onPick: (d: ISODate) => void }) => {
  // the streak looks back eight weeks: load those months too
  const log = useLog(useMemo(() => monthsBetween(shiftDays(start, -7 * 9), shiftDays(start, 6)), [start]));
  const sheet = useSheet();
  const reduce = useReducedMotion();
  const sum = useMemo(() => weekSummary(log.snap, start), [log.snap, start]);
  const streak = streakLine(log.snap, log.today);
  const ti = sum.days.findIndex((d) => d.date === log.today);
  const frac = sum.plannedMiles ? Math.min(1, sum.doneMiles / sum.plannedMiles) : sum.doneMiles ? 1 : 0;
  return (
    <div className="wk">
      <div className="wk-top">
        <WeekRing days={ringDays(sum, log.today)} size={64} today={ti >= 0 ? ti : undefined} onceADay={null} />
        <div className="wk-nums">
          <span className="caps">Miles</span>
          <span className="stamp wk-miles">
            {sum.doneMiles > 0 ? mi(sum.doneMiles) : sum.plannedMiles ? num(sum.plannedMiles) : '—'}
            <small>{sum.doneMiles > 0 && sum.plannedMiles ? ` of ${num(sum.plannedMiles)} mi` : sum.plannedMiles ? ' mi planned' : ' mi'}</small>
          </span>
          {sum.plannedMiles ? (
            <span className="wk-bar" aria-hidden="true">
              <motion.i initial={reduce ? false : { width: 0 }} animate={{ width: `${frac * 100}%` }} transition={springs.number} />
            </span>
          ) : null}
        </div>
      </div>
      {streak ? <p className="wk-streak serif-line">{streak}</p> : null}
      <div className="list-edge wk-days">
        {sum.days.map((d) => {
          const sessions = log.snap.sessionsOn(d.date).filter((s) => s.kind !== 'rest');
          const ran = log.snap.runsOn(d.date).reduce((t, a) => t + a.miles, 0);
          const key = dayKey(log.snap, d.date);
          return (
            <Pressable
              key={d.date}
              className={`wk-day ${d.date === log.today ? 'is-today' : ''}`}
              pressScale={1}
              label={`${fmtDate('long', d.date)}. ${sessions.map(label).join(', ') || 'Nothing planned'}. ${dayWord(log.snap, d.date)}${ran ? `. ${mi(ran)} miles` : ''}`}
              onPress={() => {
                sheet.close();
                onPick(d.date);
              }}
            >
              <span className="wk-dow">
                <span className="caps">{fmtDate('dow', d.date)}</span>
                <span className="wk-dnum">{parseISO(d.date).getDate()}</span>
              </span>
              <span className="wk-what">{sessions.map(label).join(' + ') || 'Rest'}</span>
              <span className={`wk-word k-${key}`}>{dayWord(log.snap, d.date)}</span>
              <span className="stamp wk-mi">{ran ? mi(ran) : ''}</span>
            </Pressable>
          );
        })}
      </div>
    </div>
  );
};

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
