import { fmtDate, mondayOf, shiftDays, type ISODate } from '@logbook/shared';
import { Check, Circle, Minus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useIsActiveTab } from '@/app/NavController';
import { Pressable, useSheet } from '@/ui';
import type { Log } from '../log/useLog';
import { useOpenSession } from '../sessions/SessionCard';
import { STRAVA_BUILT } from '@/lib/features';
import { LiftDaySheet } from './LiftDaySheet';
import { HERO_WEEKS, LIFT_STATUS_WORD, liftLog, type LiftItem, type LiftStatus } from './hero';

/** Weeks the list shows at first, and how many more each "Show more" adds. */
const PAGE_WEEKS = 4;
const STATUS_ICON: Record<LiftStatus, typeof Check> = { done: Check, planned: Circle, missed: X, skipped: Minus };
const dow = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' });
const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
/** The label a row sits under: "This week", "Last week", then the month ("October"; "December 2025" in another year). */
const sectionOf = (d: ISODate, today: ISODate) => {
  const mon = mondayOf(today);
  if (d >= mon) return 'This week';
  if (d >= shiftDays(mon, -7)) return 'Last week';
  const at = new Date(`${d}T12:00:00`);
  return d.slice(0, 4) === today.slice(0, 4) ? monthName.format(at) : monthYear.format(at);
};
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
  // leaving the tab folds the list back to its first weeks
  const activeTab = useIsActiveTab();
  useEffect(() => {
    if (!activeTab) setWeeks(PAGE_WEEKS);
  }, [activeTab]);
  const sections = useMemo(() => {
    const out: Array<{ label: string; items: LiftItem[] }> = [];
    for (const x of shown) {
      const label = sectionOf(x.date, t);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(x);
      else out.push({ label, items: [x] });
    }
    return out;
  }, [shown, t]);

  const open = (x: LiftItem) => {
    if (x.session) openSession(x.date, x.session);
    // a synced workout opens its own sheet, which exists only in a build with Strava (fetched on the tap, dropped without)
    else if (STRAVA_BUILT && x.activity && !x.sets.length) {
      const a = x.activity;
      void import('./ActivitySheet').then(({ ActivitySheet }) => sheet.open({ eyebrow: fmtDate('long', x.date), title: a.name, body: <ActivitySheet a={a} />, wide: true }));
    } else sheet.open({ eyebrow: fmtDate('long', x.date), title: 'Lifted', body: <LiftDaySheet date={x.date} /> });
  };

  return (
    <div className="ll">
      {shown.length ? (
        sections.map((sec) => (
          <section key={sec.label} className="ll-sec" aria-label={sec.label}>
            <h3 className="ll-sec-h">{sec.label}</h3>
            <ul className="ll-list">
              {sec.items.map((x) => {
                const chip = dayChip(x.date, t);
                const Icon = STATUS_ICON[x.status];
                return (
                  <li key={x.key}>
                    <Pressable className={`ll-card is-${x.status} ${x.date === t ? 'is-today' : ''}`} press="scale" onPress={() => open(x)} label={`${fmtDate('long', x.date)}. ${x.title}. ${LIFT_STATUS_WORD[x.status]}${x.detail ? `. ${x.detail}` : ''}. Open`}>
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
          </section>
        ))
      ) : (
        <p className="ll-none">No lifts in the last {weeks} weeks.</p>
      )}
      {more || weeks > PAGE_WEEKS ? (
        <div className="ll-acts">
          {weeks > PAGE_WEEKS ? (
            <button type="button" className="ll-more" onClick={() => setWeeks(PAGE_WEEKS)}>
              Show less
            </button>
          ) : null}
          {more ? (
            <button type="button" className="ll-more" onClick={() => setWeeks((w) => w + PAGE_WEEKS)}>
              Show more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
