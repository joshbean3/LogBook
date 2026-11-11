import { fmtDate, label, num, sessionKey, shiftDays, tone, weekSummary, type Session } from '@logbook/shared';
import type { Log } from '../log/useLog';
import { weekMiles } from '../sessions/miles';

const tenth = (v: number) => num(Math.round(v * 10) / 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));
const isTraining = (s: Session) => s.kind !== 'rest';

/**
 * The week's line ("26 mi · 5 runs") and the sentence under it, said forward: what is next, never a zero (docs/feel.md
 * §7.1). `ran` is the miles run so far; the bar under the line exists only once a mile is run.
 */
export const weekWords = (log: Log, mon: string) => {
  const t = log.today;
  // miles run count a run marked Done without Strava at its planned miles (contract 5), as Progress and Share do
  const w0 = weekSummary(log.snap, mon);
  const w = { ...w0, doneMiles: weekMiles(log.snap, mon, t).miles };
  const sun = shiftDays(mon, 6);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  const training = days.flatMap((d) => log.snap.sessionsOn(d).filter(isTraining).map((s) => [d, s] as const));
  const live = training.filter(([d, s]) => {
    const k = sessionKey(log.snap, d, s);
    return k === 'today' || k === 'planned';
  });
  const next = live.find(([d]) => d >= t) ?? null;
  const when = (d: string) => (d === t ? 'today' : d === shiftDays(t, 1) ? 'tomorrow' : fmtDate('dowLong', d));
  const runsWord = plural(w.runsPlanned, 'run');
  let head: string;
  if (w.plannedMiles > 0) head = `${tenth(w.plannedMiles)} mi · ${runsWord}`;
  else if (training.length) head = `${plural(training.length, 'session')}`;
  else if (w.doneMiles > 0) head = `${tenth(w.doneMiles)} mi run`;
  else head = sun < t ? 'A quiet week' : 'An open week';
  let sub: string;
  if (sun < t) {
    // a past week: what happened, against what was planned
    sub = w.plannedMiles > 0 && w.doneMiles === 0 ? `${w.keptSessions ? `${w.keptSessions} of ${plural(training.length, 'session')} kept` : 'None of it run'}.${w.kept ? ' Kept.' : ''}` : w.plannedMiles > 0 ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} mi run${w.runsPlanned ? ` · ${w.runsDone} of ${runsWord}` : ''}.${w.kept ? ' Kept.' : ''}` : w.kept ? 'Kept.' : training.length ? `${w.keptSessions} of ${plural(training.length, 'session')} kept.` : 'Nothing was planned.';
  } else if (mon > t) {
    const first = live[0];
    const long = training.filter(([, s]) => tone(s) === 'long').sort((a, b) => (Number(b[1].miles) || 0) - (Number(a[1].miles) || 0))[0];
    sub = first ? `Opens with ${nameOf(first[1])}, ${fmtDate('dowLong', first[0])}.${long && long !== first ? ` Long run ${fmtDate('dowLong', long[0])}.` : ''}` : 'Tap a day to add a session.';
  } else if (!training.length && w.doneMiles === 0) {
    sub = 'Tap a day to add a session.';
  } else if (w.doneMiles === 0 && !w.keptSessions) {
    // early in the week: say what's next, never "0 of 26"; "First run today" only when no run was planned before today
    // what is next today is said once, by today's row in the week (layout plan P1), so the line stops at the totals
    sub = next ? (next[0] === t ? '' : `Next: ${nameOf(next[1])}, ${when(next[0])}.`) : 'Nothing left this week.';
  } else {
    const done = w.plannedMiles > 0 ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} mi` : w.doneMiles > 0 ? `${tenth(w.doneMiles)} mi run` : `${w.keptSessions} kept`;
    sub = next && next[0] !== t ? `${done}. Next: ${nameOf(next[1])}, ${when(next[0])}.` : w.kept ? `${done}. Week kept.` : `${done}.`;
  }
  const progress = w.plannedMiles > 0 ? Math.min(1, w.doneMiles / w.plannedMiles) : w.doneMiles > 0 ? 1 : 0;
  return { head, sub, progress, ran: w.doneMiles, summary: w };
};
