import { daysBetween, fmtDate, type ISODate } from '@logbook/shared';
import { CalendarPlus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { haptics } from '@/lib/haptics';
import { Button } from '@/ui';
import type { Log } from '../log/useLog';

/**
 * Where the plan stops. A plan runs to its last day and no further, so the next block is something you enter on purpose:
 * in the plan's last three days Today says when it ends, and on any day past it (with nothing planned) it says the plan
 * is over. Either way the one action is the next block.
 */
export const PlanEnd = ({ log, date, today }: { log: Log; date: ISODate; today: ISODate }) => {
  const nav = useNavigate();
  const blocks = log.boot?.blocks ?? [];
  if (!blocks.length) return null;
  const last = blocks.reduce((a, b) => (b.end > a.end ? b : a));
  const end = last.end;
  const left = daysBetween(today, end);
  const past = date > end && !log.snap.sessionsOn(date).length;
  const soon = date === today && left >= 0 && left <= 3;
  if (!past && !soon) return null;
  const day = `${fmtDate('dowLong', end)}, ${fmtDate('md', end)}`;
  const title = past ? `${last.name} ended ${day}.` : left === 0 ? `${last.name} ends today.` : `${last.name} ends ${day}.`;
  const sub = past ? 'Nothing is planned from here. Enter the next block to keep going.' : left === 0 ? 'Tomorrow is empty until you enter the next block.' : 'After that, the days are empty until you enter the next block.';
  return (
    <section className={`plan-end ${past ? 'is-past' : ''}`} aria-label="Your plan">
      <span className="plan-end-ic" aria-hidden="true">
        <CalendarPlus size={18} />
      </span>
      <div className="plan-end-text">
        <p className="plan-end-title">{title}</p>
        <p className="plan-end-sub">{sub}</p>
      </div>
      <Button
        variant={past ? 'primary' : 'soft'}
        size="sm"
        onClick={() => {
          haptics.select();
          nav('/plan/plans');
        }}
      >
        Next block
      </Button>
    </section>
  );
};
