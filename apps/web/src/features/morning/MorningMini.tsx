import { MORNING_DEFAULTS, monthOf } from '@logbook/shared';
import { useMemo } from 'react';
import { useLog } from '../log/useLog';
import { MiniLine } from './MiniLine';
import { morningOf, useNowMinutes, useRoutineOrder } from './model';

/**
 * The morning as one line, for anyone who wants it (Today's hero, a widget): wake → door → back → leave as four stops with
 * their times under them, and on today a pulsing "now" dot between the stops it falls between. A rest morning has three
 * stops (wake, leave). It draws the same timeline the Morning page draws (plan + the day's override + the routine), so the
 * two never disagree.
 *
 * ```tsx
 * import { MorningMini } from '@/features/morning/MorningMini';
 * <button onClick={() => nav(`/morning/${date}`)} aria-label="Open the morning"><MorningMini date={date} /></button>
 * ```
 *
 * It renders nothing until the settings and the month are loaded (keep a slot of ~56px if the layout must not move), it is
 * not interactive (wrap it in your own button or link), and it carries a VoiceOver label ("Wake 7:15, Door 7:30, …").
 * `?at=HH:MM` on localhost fakes the clock, as on the Morning page.
 */
export const MorningMini = ({ date }: { date: string }) => {
  const log = useLog([monthOf(date)]);
  const order = useRoutineOrder();
  const now = useNowMinutes();
  const st = log.boot?.morningSettings ?? MORNING_DEFAULTS;
  const ready = !!log.boot && log.loaded(date);
  const T = useMemo(() => morningOf(log.snap.sessionsOn(date), log.snap.morningOverride(date), st, order), [log.snap, date, st, order]);
  if (!ready) return null;
  return <MiniLine T={T} now={date === log.today ? now : null} />;
};

export default MorningMini;
