import { type ISODate } from '@logbook/shared';
import { ChevronRight, Sun } from 'lucide-react';
import type * as React from 'react';
import { memo, useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { Pressable } from '@/ui/Pressable';
import type { Log } from '../log/useLog';
import { morningOf } from '../morning/model';
import { shortClock } from './dayWords';
import { morningLineId, morningPath } from './Hero';
import { dismissNudge } from './nudge';

const D = (s: string) => Date.parse(`${s}T12:00:00Z`);
const weekday = (s: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(D(s));

/** The row's words for a day: 'This morning' · 'Wake 7:15 · Leave 9:30'; 'That morning' · 'Left 9:30'; 'Tomorrow morning' · 'Alarm 7:15'. */
export const morningRowWords = (date: ISODate, today: ISODate, wake: number | null, leave: number | null): { title: string; right: string } => {
  const n = Math.round((D(date) - D(today)) / 86_400_000);
  if (n === 0) return { title: 'This morning', right: wake != null && leave != null ? `Wake ${shortClock(wake)} · Leave ${shortClock(leave)}` : '' };
  if (n < 0) return { title: 'That morning', right: leave != null ? `Left ${shortClock(leave)}` : '' };
  return { title: n === 1 ? 'Tomorrow morning' : `${weekday(date)} morning`, right: wake != null ? `Alarm ${shortClock(wake)}` : '' };
};

/**
 * The This morning row (docs/feel.md §3.1 row 2): one 44 row in an inset group under the hero, on every day, the door to the
 * day's morning (pushed, `/today/<date>/morning`, with the four-stop line as the shared element when the hero draws it).
 */
export const MorningRow = memo(function MorningRow({ date, log }: { date: ISODate; log: Log }): React.JSX.Element {
  const nav = useNav();
  const st = log.boot?.morningSettings ?? null;
  const T = useMemo(() => (st ? morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st) : null), [st, log.snap, date]);
  const w = morningRowWords(date, log.today, T?.day.wake ?? null, T?.leave ?? null);
  return (
    <div className="morning-row group">
      <Pressable
        className="mr-row"
        press="surface"
        label={`${w.title}${w.right ? `, ${w.right}` : ''}. Open`}
        onPress={() => {
          dismissNudge();
          nav.push(morningPath(date), { shared: morningLineId(date) });
        }}
      >
        <Sun size={18} className="mr-ic" aria-hidden="true" />
        <span className="mr-title">{w.title}</span>
        <span className="mr-right tnum">{w.right}</span>
        <ChevronRight size={16} className="mr-chev" aria-hidden="true" />
      </Pressable>
    </div>
  );
});
