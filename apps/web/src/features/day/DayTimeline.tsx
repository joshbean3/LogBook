import type { DayTimeline as Timeline, ISODate, TimelineItem, TimelineKind } from '@logbook/shared';
import { useQuery } from '@tanstack/react-query';
import { Bike, BookOpen, Check, Dumbbell, Footprints, Lightbulb } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { api } from '@/api/client';
import { minutesText } from '@/ui/captions';
import { SectionHeader } from '@/ui/layout';
import type { Log } from '../log/useLog';

const ICON: Record<TimelineKind, typeof Check> = { habit: Check, run: Footprints, lift: Dumbbell, activity: Bike, learned: Lightbulb, journal: BookOpen };

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
/** `?tz=<IANA zone>` (this phone's), so the server keeps a moment only when it fell on this local day; nothing when unknown. */
const tzQuery = (): string => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? `?tz=${encodeURIComponent(tz)}` : '';
  } catch {
    return '';
  }
};
/** How long the day's data must sit still before today's timeline is asked again: a run of habit taps asks once. */
const SETTLE_MS = 1000;

/**
 * What was done, in the order it happened (docs/inspiration.md §6, Today 6): habit taps, sessions marked, synced
 * activities, the day's learnings and journal entries, at the foot of the day. Hidden until something has happened;
 * never on a day still to come. Today's refreshes whenever the day's data changes.
 */
export const DayTimeline = ({ date, log }: { date: ISODate; log: Log }): React.JSX.Element | null => {
  const isToday = date === log.today;
  const q = useQuery({ queryKey: ['timeline', date], queryFn: () => api<Timeline>(`/day/${date}/timeline${tzQuery()}`), staleTime: 15_000, enabled: date <= log.today });
  const { refetch } = q;
  // the first snapshot is the one the query just loaded with; each later change asks again once things settle
  const seen = useRef(log.snap);
  useEffect(() => {
    if (!isToday || seen.current === log.snap) return;
    seen.current = log.snap;
    const t = setTimeout(() => void refetch(), SETTLE_MS);
    return () => clearTimeout(t);
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
    <section className="tl" aria-label={isToday ? 'Today so far' : 'What happened'}>
      <SectionHeader title={isToday ? 'Today so far' : 'What happened'} meta={`${rows.length} ${rows.length === 1 ? 'thing' : 'things'}`} />
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
              <span className="tl-time tnum">{r.mins === null ? '' : minutesText(r.mins)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
