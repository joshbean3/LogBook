import { fmtDate, mondayOf, shiftDays, type ISODate } from '@logbook/shared';
import { Check, Circle, Minus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Pressable, useSheet } from '@/ui';
import type { Log } from '../log/useLog';
import { useOpenSession } from '../sessions/SessionCard';
import { ActivitySheet, LiftDaySheet } from './ActivitySheet';
import { HERO_WEEKS, LIFT_STATUS_WORD, liftLog, type LiftItem, type LiftStatus } from './hero';

/** Weeks the list shows at first, and how many more each "Show more" adds. */
const PAGE_WEEKS = 4;
const STATUS_ICON: Record<LiftStatus, typeof Check> = { done: Check, planned: Circle, missed: X, skipped: Minus };
const dow = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
/** "Today", or "Tue 10". */
const dayChip = (d: ISODate, today: ISODate) => (d === today ? { top: 'Today', n: null } : { top: dow.format(new Date(`${d}T12:00:00`)), n: String(Number(d.slice(8))) });

/**
 * Strength, as the workouts themselves: a card per lift, newest first, this week's planned ones on top. Each card has its
 * day, its status and one line of what it was (or is meant to be), and opens what a tap on that lift opens anywhere: the
 * session's sheet, or the day's sets when nothing was on the plan, or the synced workout.
 */
export const LiftList = ({ log, t }: { log: Log; t: string }) => {
  const sheet = useSheet();
  const openSession = useOpenSession(log);
  const [weeks, setWeeks] = useState(PAGE_WEEKS);
  const all = useMemo(() => liftLog(log.snap, t, shiftDays(mondayOf(t), -7 * (HERO_WEEKS - 1))), [log.snap, t]);
  const cut = shiftDays(mondayOf(t), -7 * (weeks - 1));
  const shown = all.filter((x) => x.date >= cut);
  const more = all.length > shown.length;

  const open = (x: LiftItem) => {
    if (x.session) openSession(x.date, x.session);
    else if (x.activity) sheet.open({ eyebrow: fmtDate('long', x.date), title: x.activity.name, body: <ActivitySheet a={x.activity} />, wide: true });
    else sheet.open({ eyebrow: fmtDate('long', x.date), title: 'Lifted', body: <LiftDaySheet sets={x.sets} /> });
  };

  return (
    <div className="ll">
      {shown.length ? (
        <ul className="ll-list" aria-label="Strength workouts">
          {shown.map((x) => {
            const chip = dayChip(x.date, t);
            const Icon = STATUS_ICON[x.status];
            return (
              <li key={x.key}>
                <Pressable className={`ll-card is-${x.status} ${x.date === t ? 'is-today' : ''}`} press="scale" onPress={() => open(x)} label={`${fmtDate('long', x.date)}. ${LIFT_STATUS_WORD[x.status]}. ${x.summary}. Open`}>
                  <span className="ll-day" aria-hidden="true">
                    <span className="ll-dow">{chip.top}</span>
                    {chip.n ? <span className="ll-dn">{chip.n}</span> : null}
                  </span>
                  <span className="ll-main" aria-hidden="true">
                    <span className="ll-top">
                      <span className="ll-title">{x.title}</span>
                      <span className="ll-status">
                        <Icon size={12} strokeWidth={2.6} />
                        {LIFT_STATUS_WORD[x.status]}
                      </span>
                    </span>
                    {x.detail ? <span className="ll-sum">{x.detail}</span> : null}
                  </span>
                </Pressable>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ll-none">No lifts in the last {weeks} weeks.</p>
      )}
      {more ? (
        <button type="button" className="ll-more" onClick={() => setWeeks((w) => w + PAGE_WEEKS)}>
          Show more
        </button>
      ) : null}
    </div>
  );
};
