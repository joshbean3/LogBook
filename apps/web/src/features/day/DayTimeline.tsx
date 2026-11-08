import type { DayTimeline as Timeline, ISODate, TimelineItem, TimelineKind } from '@logbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpen, Check, Dumbbell, Footprints, Lightbulb } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useMemo } from 'react';
import { api } from '@/api/client';
import type { Log } from '../log/useLog';

const ICON: Record<TimelineKind, typeof Check> = { habit: Check, run: Footprints, lift: Dumbbell, activity: Activity, learned: Lightbulb, journal: BookOpen };

/** Minutes after local midnight: from a recorded moment, or a local `HH:MM` start. */
const minutesOf = (i: TimelineItem): number | null => {
  if (i.time) {
    const [h, m] = i.time.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  }
  if (!i.at) return null;
  const d = new Date(i.at);
  return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
};
const clockOf = (mins: number) => `${mins % 720 === 0 ? 12 : Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${mins < 720 ? 'AM' : 'PM'}`;

/**
 * What was done, in the order it happened (docs/inspiration.md §6, Today 6): habit taps, sessions marked, synced
 * activities, the day's learnings and journal entries, at the foot of the day. Hidden until something has happened;
 * never on a day still to come. Today's refreshes whenever the day's data changes.
 */
export const DayTimeline = ({ date, log }: { date: ISODate; log: Log }): React.JSX.Element | null => {
  const isToday = date === log.today;
  const q = useQuery({ queryKey: ['timeline', date], queryFn: () => api<Timeline>(`/day/${date}/timeline`), staleTime: 15_000, enabled: date <= log.today });
  const { refetch } = q;
  useEffect(() => {
    if (isToday) void refetch();
  }, [log.snap, isToday, refetch]);
  const rows = useMemo(
    () =>
      (q.data?.items ?? [])
        .map((i) => ({ ...i, mins: minutesOf(i) }))
        .sort((a, b) => (a.mins ?? 1e9) - (b.mins ?? 1e9)),
    [q.data],
  );
  if (date > log.today || !rows.length) return null;
  return (
    <section className="tl" aria-label={isToday ? 'Today so far' : 'That day'}>
      <div className="day-sec-head">
        <h2 className="sec-title">{isToday ? 'Today so far' : 'That day'}</h2>
        <span className="sec-meta tnum">
          {rows.length} {rows.length === 1 ? 'thing' : 'things'}
        </span>
      </div>
      <ol className="tl-list">
        {rows.map((r) => {
          const Icon = ICON[r.kind];
          return (
            <li key={r.id} className={`tl-row tl-${r.kind}`}>
              <span className="tl-tile" aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="tl-main">
                <span className="tl-title">{r.title}</span>
                {r.sub ? <span className="tl-sub">{r.sub}</span> : null}
              </span>
              <span className="tl-time tnum">{r.mins === null ? '' : clockOf(r.mins)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
