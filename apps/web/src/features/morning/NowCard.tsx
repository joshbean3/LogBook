import type { MorningTimeline } from '@logbook/shared';
import type * as React from 'react';
import { MiniTimeline } from '../day/MiniTimeline';
import { nowLine, short, stopsOf } from './model';

/** The four-stop line's shared id: the flyer travels from Today's hero to here (spec §4.1, M27; contracts §F). */
export const morningLineId = (date: string) => `morning-line-${date}`;

/**
 * The Now card (spec §4.1): the morning's four stops (the landing of the line that flies in from Today's hero) and one line
 * under it that says where the morning is: `Alarm in 43 min`, `Out the door in 22 min`, `Back by 8:13`, `Shower now · Leave
 * in 45 min`, `Left 9:30`. A past morning says `Woke 7:15 · Left 9:30`, a future one `Alarm 7:15 · Leave 9:30`. The clock is
 * Today's (`useNowMinutes`), so the hero and this card never disagree. 96 tall, no halo.
 */
export const NowCard = ({ T, date, now, rel }: { T: MorningTimeline; date: string; now: number; rel: 'past' | 'today' | 'future' }): React.JSX.Element => {
  const stops = stopsOf(T);
  const line = nowLine(T, now, rel);
  const label = `${rel === 'past' ? 'That morning' : 'This morning'}: ${stops.map((s) => `${s.label} ${short(s.at)}`).join(', ')}`;
  return (
    <section className={`now-card is-${rel}`} aria-label="Now">
      <MiniTimeline stops={stops} now={rel === 'today' ? now : rel === 'past' ? 1440 : -1} label={label} shared={morningLineId(date)} />
      <p className="now-line" aria-live={rel === 'today' ? 'polite' : undefined}>
        {line}
      </p>
    </section>
  );
};
