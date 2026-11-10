import { useEffect, useState } from 'react';
import type * as React from 'react';
import { BellRing, Settings2 } from 'lucide-react';
import { useBootstrap, useGoals } from '@/api/queries';
import { disableReminders, enableReminders, remindersOn, remindersSupported, scheduleReminders } from '@/features/goals/reminders';
import { useToday } from '@/lib/useToday';
import { Row } from '@/ui';
import { GoRow, Switch, Tile } from './parts';
import { APP_SETTINGS_URL, REMINDER_TITLE, reminderRow, type NotifyPermission } from './reminderModel';

const permission = async (): Promise<NotifyPermission> => {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    return (await LocalNotifications.checkPermissions()).display;
  } catch {
    return 'unknown';
  }
};

/**
 * Settings, App: the goal reminder (the same switch and module as on Goals). On only in the iPhone app; on the web there
 * are no notifications and the row is not drawn. When iOS has said no, the row says so and links to this app's page in
 * the Settings app, since iOS never asks twice. Permission is read again whenever the app comes back to the front.
 */
export const ReminderRows = (): React.JSX.Element | null => {
  const supported = remindersSupported();
  const [on, setOn] = useState(remindersOn);
  const [perm, setPerm] = useState<NotifyPermission>('unknown');
  const goals = useGoals();
  const boot = useBootstrap();
  const today = useToday();
  const wake = boot.data?.morningSettings?.wake ?? 7 * 60;
  useEffect(() => {
    if (!supported) return;
    let live = true;
    const read = () => void permission().then((p) => live && setPerm(p));
    read();
    const onShow = () => document.visibilityState === 'visible' && read();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [supported]);
  if (!supported) return null;
  const row = reminderRow(perm, on);
  const change = async (next: boolean) => {
    if (next) {
      const ok = await enableReminders();
      setOn(ok);
      setPerm(await permission());
      // the mornings owed from now on, without waiting for the next time Goals changes
      if (ok && goals.data) void scheduleReminders(goals.data, today, wake).catch(() => undefined);
    } else {
      await disableReminders();
      setOn(false);
    }
  };
  return (
    <>
      <Row className="s-wrap has-tile" left={<Tile icon={BellRing} />} title={REMINDER_TITLE} sub={row.sub} right={<Switch on={row.on} label={REMINDER_TITLE} disabled={row.showSettingsLink} onChange={(v) => void change(v)} />} />
      {row.showSettingsLink ? <GoRow icon={Settings2} title="Open iOS Settings" sub="Notifications, then Allow Notifications." href={APP_SETTINGS_URL} /> : null}
    </>
  );
};
