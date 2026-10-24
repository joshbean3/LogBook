import { addMonths, fmtDate, heroSession, mondayOf, monthOf, monthStart, num, parseISO, sessionKey, sessionStatus, shiftDays, tone, weekSummary } from '@logbook/shared';
import { memo, useMemo } from 'react';
import { Pressable } from '@/ui/Pressable';
import { useLog, type Log } from '../log/useLog';
import { dayMiles, weekMiles } from '../sessions/miles';
import { BlockCardView, type PlanBlockProps } from './Blocks';

/**
 * The month (docs/feel.md §7.3): 7 columns × up to 6 rows of 56 px cells (day 13/18, miles 11/13, a 3 px tone bar), a `Wk`
 * column (run, of planned), today's number in the accent disc, the current week's row on `--surface`. Each week is one
 * row you tap to see that week (PlanView crossfades back to Week, 200 ms). The month pager (`step: 'month'`) renders a page
 * for prev, cur and next, memoised by the first of the month; it follows the finger 1:1. Nothing animates on its own.
 */

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const tenth = (v: number) => num(Math.round(v * 10) / 10);

/** The Mondays of every week that touches the month. */
export const monthWeeks = (first: string) => {
  const next = addMonths(monthStart(first), 1);
  const out: string[] = [];
  for (let m = mondayOf(monthStart(first)); m < next; m = shiftDays(m, 7)) out.push(m);
  return out;
};

/** One day: its number, its miles (run when it happened, planned in ink-3 when it is ahead), the tone bar of its lead session. */
const Cell = ({ d, log, inMonth }: { d: string; log: Log; inMonth: boolean }) => {
  const t = log.today;
  const sessions = log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest');
  const lead = heroSession(sessions);
  // run miles: the activities, or a run marked Done by hand at its planned miles (contract 5)
  const ran = d <= t ? dayMiles(log.snap, d).miles : 0;
  const planned = sessions.reduce((x, s) => x + (s.kind === 'run' && sessionStatus(log.snap, d, s) !== 'skipped' ? Number(s.miles) || 0 : 0), 0);
  const k = lead ? sessionKey(log.snap, d, lead) : ran ? 'bonus' : 'rest';
  const miles = ran > 0 ? tenth(ran) : planned > 0 ? tenth(planned) : '';
  return (
    <span className={`mg-cell k-${k} ${inMonth ? '' : 'is-out'} ${d === t ? 'is-today' : ''}`.trim()}>
      <span className="mg-num tnum">{parseISO(d).getDate()}</span>
      <span className={`mg-mi tnum ${ran > 0 ? 'is-ran' : ''}`.trim()}>{miles}</span>
      {lead || ran > 0 ? <i className={`mg-tone ${lead ? `t-${tone(lead)}` : 't-easy'}`} aria-hidden="true" /> : null}
    </span>
  );
};

/** One month page. */
export const MonthPage = memo(function MonthPage({ first, onWeek, block }: { first: string; onWeek: (mon: string) => void; block: PlanBlockProps }) {
  const weeks = monthWeeks(first);
  const months = useMemo(() => [...new Set([monthOf(weeks[0]!), monthOf(first), monthOf(shiftDays(weeks.at(-1)!, 6))])], [first]); // eslint-disable-line react-hooks/exhaustive-deps
  const log = useLog(months);
  const t = log.today;
  const next = addMonths(first, 1);
  const ready = months.every((m) => log.loaded(`${m}-01`));
  return (
    <div className="pl-mpage">
      <div className="mg" role="group" aria-label={fmtDate('month', first)} aria-busy={!ready || undefined}>
        <div className="mg-head" aria-hidden="true">
          {DOW.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
          <span className="mg-wk-h">Wk</span>
        </div>
        {weeks.map((mon) => {
          const w = weekSummary(log.snap, mon);
          const done = weekMiles(log.snap, mon, t).miles;
          const now = mon === mondayOf(t);
          const past = shiftDays(mon, 6) < t;
          // never a zero as the week's number: a week with nothing run shows what it planned, muted
          const total = done > 0 ? tenth(done) : w.plannedMiles ? tenth(w.plannedMiles) : '';
          const of = done > 0 ? (w.plannedMiles ? `of ${tenth(w.plannedMiles)}` : '') : w.plannedMiles && !past ? 'planned' : '';
          return (
            <Pressable
              key={mon}
              as="div"
              press="surface"
              data-week={mon}
              className={`mg-week ${now ? 'is-now' : ''}`.trim()}
              label={`Week of ${fmtDate('md', mon)}: ${w.plannedMiles ? `${tenth(done)} of ${tenth(w.plannedMiles)} miles` : `${tenth(done)} miles`}. Show the week`}
              onPress={() => onWeek(mon)}
            >
              {Array.from({ length: 7 }, (_, i) => {
                const d = shiftDays(mon, i);
                return <Cell key={d} d={d} log={log} inMonth={d >= first && d < next} />;
              })}
              <span className={`mg-wk ${done > 0 ? '' : 'is-plan'}`.trim()}>
                <b className="tnum">{total}</b>
                {of ? <small>{of}</small> : null}
              </span>
            </Pressable>
          );
        })}
      </div>
      <BlockCardView data={block.data} getLog={block.getLog} />
    </div>
  );
});
