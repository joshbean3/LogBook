import { goalsDue } from '@logbook/shared';
import { useEffect } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useGoals } from '@/api/queries';
import { useAssistantTurns } from '@/features/assistant/store';
import { useToday } from '@/lib/useToday';
import { useNowMark } from '@/ui/nowBudget';
import { onReminderTap, scheduleReminders } from './reminders';

/**
 * The Goals tab's dot: today's goal or the week's unset (once the account has set any goal), or a past goal waiting on its
 * review. It is the reminder on the
 * web; on the phone it also keeps the morning notifications in step with the goals (rescheduled when they change).
 */
export const GoalsBadge = () => {
  const today = useToday();
  const goals = useGoals();
  const boot = useBootstrap();
  const nav = useNav();
  const wake = boot.data?.morningSettings?.wake ?? 7 * 60;
  const sig = (goals.data ?? []).map((g) => `${g.level}:${g.period}`).join('|');
  useEffect(() => {
    if (goals.data) void scheduleReminders(goals.data, today, wake).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, today, wake, !!goals.data]);
  useEffect(() => onReminderTap((p) => nav.go(p)), [nav]);
  const due = goals.data ? goalsDue(goals.data, today) : null;
  // an unset day or week counts only once the account has set a goal (a new account is not nagged from the first launch);
  // a review owed always counts
  const show = !!due && (due.review > 0 || ((goals.data?.length ?? 0) > 0 && (due.day || due.week)));
  // a badge dot on the Sunrise budget (guide 3.5): Sunrise while the screen has room and the dock's badge is not showing,
  // else the same dot in Night Ink. The dock's badge (a conversation going, app/Dock.tsx) always wins: the budget breaks
  // ties by registration order, so a conversation started after this dot registered would otherwise leave the dock's
  // dot yielded and this one lit (plan 6.2: the tab badge only when the dock badge is not showing)
  const dockBadge = useAssistantTurns().length > 0;
  const lit = useNowMark('badge', show && !dockBadge);
  const paint = dockBadge ? 'ink' : lit;
  if (!show) return null;
  // the dot is drawn; the words join the tab's own name: "Goals, needs attention"
  return (
    <>
      <span className="tab-dot" data-now={paint} aria-hidden="true" />
      <span className="sr-only">, needs attention</span>
    </>
  );
};
