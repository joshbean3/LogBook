import { addMonths, fmtDate, heroSession, label as nameOf, mondayOf, monthOf, monthStart, num, parseISO, sessionKey, sessionStatus, shiftDays, tone, weekSummary, type Tone } from '@logbook/shared';
import { memo, useMemo } from 'react';
import { Pressable } from '@/ui/Pressable';
import { SectionHeader } from '@/ui/layout';
import { useLog, type Log } from '../log/useLog';
import { dayMiles, weekMiles } from '../sessions/miles';
import { LoadFail, useMonthsFailed } from './LoadFail';
import { StepNav } from './Week';

/**
 * The month (docs/feel.md §7.3): 7 columns × up to 6 rows of 56 px cells (day 13/18, miles 11/13, a 3 px tone bar), a `Wk`
 * column (run, of planned), today's number in the accent disc, the current week's row on `--surface`. Each week is one
 * row you tap to see that week (PlanView crossfades back to Week, 200 ms). The month pager (`step: 'month'`) renders a page
 * for prev, cur and next, memoised by the first of the month; it follows the finger 1:1. Nothing animates on its own.
 *
 * A day's mark says its session type by shape as well as color (a bar, a longer bar, two dashes, three dots, a block, a
 * dot), the key under the grid names each, and a week's accessible name says each day in words.
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
    <span className={`mg-cell k-${k} ${inMonth ? '' : 'is-out'} ${d === t ? 'is-today' : ''} ${lead || ran > 0 ? `has-tone t-${lead ? tone(lead) : 'easy'}` : ''}`.trim()}>
      <span className="mg-num tnum">{parseISO(d).getDate()}</span>
      {miles ? <span className={`mg-mi tnum ${ran > 0 ? 'is-ran' : ''}`.trim()}>{miles}</span> : null}
    </span>
  );
};

/** The marks' key, in the order of a training week: the same shapes and tones as the cells. */
const KEY: Array<[Tone, string]> = [
  ['easy', 'Easy'],
  ['long', 'Long'],
  ['hard', 'Hard'],
  ['fast', 'Fast'],
  ['lift', 'Strength'],
  ['cross', 'Cross'],
];
const DONE_WORD: Record<string, string> = { done: ', done', bonus: ', done', floor: ', done at the floor', missed: ', missed', skipped: ', skipped' };

/** A week's days in words for its accessible name: `Mon Easy 4, done. Tue Strength A.` (rest and empty days left out). */
const weekDaysWords = (log: Log, mon: string) =>
  Array.from({ length: 7 }, (_, i) => shiftDays(mon, i))
    .map((d) => {
      const lead = heroSession(log.snap.sessionsOn(d).filter((s) => s.kind !== 'rest'));
      if (!lead) return d <= log.today && dayMiles(log.snap, d).miles > 0 ? `${fmtDate('dow', d)} a run off the plan` : '';
      return `${fmtDate('dow', d)} ${nameOf(lead)}${DONE_WORD[sessionKey(log.snap, d, lead)] ?? ''}`;
    })
    .filter(Boolean)
    .join('. ');

/** One month page. `still`: a neighbour not yet live, the same pixels with no Pressables (PlanView; feel review 2 D). */
export const MonthPage = memo(function MonthPage({ first, onWeek, onStep, onThisMonth, still }: { first: string; onWeek: (mon: string) => void; onStep: (dir: -1 | 1) => void; onThisMonth: () => void; still?: boolean }) {
  const weeks = monthWeeks(first);
  const months = useMemo(() => [...new Set([monthOf(weeks[0]!), monthOf(first), monthOf(shiftDays(weeks.at(-1)!, 6))])], [first]); // eslint-disable-line react-hooks/exhaustive-deps
  const log = useLog(months);
  const t = log.today;
  const next = addMonths(first, 1);
  const ready = months.every((m) => log.loaded(`${m}-01`));
  const fail = useMonthsFailed(months);
  // the month's miles for its header: run so far, else what it plans (never a zero as the headline)
  let ran = 0;
  let planned = 0;
  for (let d = first; d < next; d = shiftDays(d, 1)) {
    if (d <= t) ran += dayMiles(log.snap, d).miles;
    for (const s of log.snap.sessionsOn(d)) if (s.kind === 'run' && sessionStatus(log.snap, d, s) !== 'skipped') planned += Number(s.miles) || 0;
  }
  const meta = !ready ? '' : ran > 0 ? `${tenth(ran)} mi run` : planned > 0 ? `${tenth(planned)} mi planned` : 'Nothing planned';
  const away = first !== monthStart(t);
  return (
    <div className="pl-mpage">
      <section className="pl-sec pl-month-sec" aria-label={fmtDate('month', first)}>
        <SectionHeader className={`pl-wk-head pl-mo-head ${away ? 'is-away' : ''}`.trim()} title={fmtDate('month', first).replace(/ \d{4}$/, '')} meta={meta} action={<StepNav unit="month" away={away} onStep={onStep} onHome={onThisMonth} />} />
        {!ready && fail.failed && !still ? (
          <LoadFail what="Couldn’t load this month." onRetry={fail.retry} />
        ) : (
          <div className="mg card" role="group" aria-label={fmtDate('month', first)} aria-busy={!ready || undefined}>
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
              // a past week with nothing run reads as such (`0 of 26`), never its plan as if it were run (review-feel-1 #12)
              const total = done > 0 ? tenth(done) : w.plannedMiles ? (past ? '0' : tenth(w.plannedMiles)) : '';
              const of = w.plannedMiles ? (done > 0 || past ? `of ${tenth(w.plannedMiles)}` : 'planned') : '';
              const cells = (
                <>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = shiftDays(mon, i);
                    return <Cell key={d} d={d} log={log} inMonth={d >= first && d < next} />;
                  })}
                  <span className={`mg-wk ${done > 0 ? '' : 'is-plan'}`.trim()}>
                    <b className="tnum">{total}</b>
                    {of ? <small>{of}</small> : null}
                  </span>
                </>
              );
              const cls = `mg-week ${now ? 'is-now' : ''}`.trim();
              if (still)
                return (
                  <div key={mon} className={`pressable ${cls}`} data-press="surface" data-week={mon}>
                    {cells}
                  </div>
                );
              const days = ready ? weekDaysWords(log, mon) : '';
              return (
                <Pressable
                  key={mon}
                  as="div"
                  press="surface"
                  data-week={mon}
                  className={cls}
                  label={`Week of ${fmtDate('md', mon)}: ${w.plannedMiles ? `${tenth(done)} of ${tenth(w.plannedMiles)} miles` : `${tenth(done)} miles`}. ${days ? `${days}. ` : ''}Show the week`}
                  onPress={() => onWeek(mon)}
                >
                  {cells}
                </Pressable>
              );
            })}
            <div className="mg-key" role="note" aria-label="Key: each mark is a session type">
              {KEY.map(([k, w]) => (
                <span key={k} className={`mg-key-i t-${k}`}>
                  <i className="mg-mark" aria-hidden="true" />
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
});
