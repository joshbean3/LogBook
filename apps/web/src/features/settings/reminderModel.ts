/** The Settings reminder row's state, from the phone's permission and the app's own switch. Pure, so it is tested. */
export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';

/** iOS opens this app's page in the Settings app for this address (UIApplication.openSettingsURLString). */
export const APP_SETTINGS_URL = 'app-settings:';

export const REMINDER_TITLE = 'Morning goal reminder';
export const REMINDER_SUB = 'Each morning with no goal set, and Mondays for the week.';
export const REMINDER_DENIED = 'Turned off in iOS Settings.';

export const reminderRow = (permission: NotifyPermission, on: boolean) => {
  const denied = permission === 'denied';
  return {
    /** The switch shows on only while iOS allows it and the app's switch is on. */
    on: !denied && on,
    sub: denied ? REMINDER_DENIED : REMINDER_SUB,
    /** iOS asks only once: after a no, the way back is the Settings app. */
    showSettingsLink: denied,
  };
};

/**
 * "Rate Logbook": the App Store's write-review page for the app's id (VITE_APP_STORE_ID, from App Store Connect once
 * the app record exists). No id, no row. It is a link only: the review prompt API is never called from here.
 */
export const rateUrl = (id: string | undefined | null): string | null => {
  const clean = (id ?? '').trim().replace(/^id/i, '');
  return /^\d{6,12}$/.test(clean) ? `https://apps.apple.com/app/id${clean}?action=write-review` : null;
};
export const RATE_URL = rateUrl(import.meta.env.VITE_APP_STORE_ID as string | undefined);
