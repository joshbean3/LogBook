import { fmtDate, shiftDays, type ISODate } from '@logbook/shared';
import type * as React from 'react';
import { Pressable } from '@/ui/Pressable';
import type { Log } from '../log/useLog';
import { fromEndingBlock, useOpenBuilder } from '../plan/PlanBuilder';
import { planEndOf } from './dayWords';

/**
 * Where the plan stops (docs/feel.md §3.1 row 7, §7.4): `Banking Plan ends Sun, Nov 8` and one action, `Next block`, which
 * opens the builder prefilled from the ending block (WP4's `useOpenBuilder()(fromEndingBlock(block, profile))`) as a large
 * sheet over Today: no tab change, and after Create the sheet closes and Today stays. No haptic. Loaded lazily by the page
 * (it shows a few days a block), so the builder never weighs on Today's entry bundle.
 */
export const PlanEnd = ({ log, date }: { log: Log; date: ISODate }): React.JSX.Element | null => {
  const openBuilder = useOpenBuilder();
  const end = planEndOf(log, date);
  if (!end) return null;
  const { block, past } = end;
  const day = `${fmtDate('dowLong', block.end)}, ${fmtDate('md', block.end)}`;
  const today = date === block.end;
  const title = past ? `${block.name} ended ${day}` : today ? `${block.name} ends today` : `${block.name} ends ${day}`;
  const sub = past ? 'Nothing is planned from here.' : 'After that, the days are empty.';
  const profile = log.boot?.user.trainingProfile ?? null;
  return (
    <section className={`plan-end card ${past ? 'is-past' : ''}`} aria-label="Your plan">
      <div className="pe-text">
        <p className="pe-title">{title}</p>
        <p className="pe-sub">{sub}</p>
      </div>
      <Pressable className="pe-next" label="Next block" onPress={() => openBuilder(profile ? fromEndingBlock(block, profile) : { startDate: shiftDays(block.end, 1) })}>
        Next block
      </Pressable>
    </section>
  );
};

export default PlanEnd;
