import { goalsDue } from '@logbook/shared';
import { useEffect } from 'react';
import { useNav } from '@/app/NavController';
import { useBootstrap, useGoals } from '@/api/queries';
import { useToday } from '@/lib/useToday';
import { onReminderTap, scheduleReminders } from './reminders';

/**
 * The Goals tab's dot: today's goal or the week's unset, or a past goal waiting on its review. It is the reminder on the
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
  if (!goals.data) return null;
  const due = goalsDue(goals.data, today);
  return due.day || due.week || due.review ? <span className="tab-dot" aria-label="Goals need you" /> : null;
};
