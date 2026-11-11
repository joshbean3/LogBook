import { fmtDate, mondayOf, shiftDays, type ISODate } from '@logbook/shared';
import { useEffect, useMemo, useState } from 'react';
import { useIsActiveTab } from '@/app/NavController';
import { DateGutter, Row, useSheet } from '@/ui';
import type { Log } from '../log/useLog';
import { useOpenSession } from '../sessions/SessionCard';
import { STRAVA_BUILT } from '@/lib/features';
import { LiftDaySheet } from './LiftDaySheet';
import { HERO_WEEKS, LIFT_STATUS_WORD, liftLog, type LiftItem } from './hero';

/** Weeks the list shows at first, and how many more each "Show more" adds. */
const PAGE_WEEKS = 4;
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

/**
 * Strength, as the workouts themselves: date rows (layout standard 6.2), newest first, this week's planned ones on top, under
 * a label per stretch ("This week", "Last week", then the month). Each row has its day in the date gutter (today ringed), the
 * workout's name, one line of what it was (or is meant to be) and its status as the trailing value ("Done", "Planned",
 * "Missed"), and opens what a tap on that lift opens anywhere: the session's sheet, the day's sets when nothing was on the
 * plan, or the synced workout.
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
            <div className="ll-rows">
              {sec.items.map((x) => (
                <Row
                  key={x.key}
                  className={`ll-row is-${x.status}`}
                  head
                  left={<DateGutter date={x.date} today={x.date === t} />}
                  title={x.title}
                  sub={x.detail ?? undefined}
                  right={<span className="lrow-value">{LIFT_STATUS_WORD[x.status]}</span>}
                  onClick={() => open(x)}
                  label={`${fmtDate('long', x.date)}. ${x.title}. ${LIFT_STATUS_WORD[x.status]}${x.detail ? `. ${x.detail}` : ''}. Open`}
                />
              ))}
            </div>
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
