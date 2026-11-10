import type { ConsentInput } from '@logbook/shared';

/**
 * The privacy choice (user_settings `consent`). Before the account exists it waits on this device (`logbook.consent.pending`),
 * chosen on the privacy page; Create account sends it with the new account and clears it.
 */
export const PENDING_CONSENT_KEY = 'logbook.consent.pending';

export const readPendingConsent = (): ConsentInput | null => {
  try {
    const raw = localStorage.getItem(PENDING_CONSENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { training?: unknown };
    return typeof v.training === 'boolean' ? { training: v.training } : null;
  } catch {
    return null;
  }
};
export const writePendingConsent = (c: ConsentInput) => {
  try {
    localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify({ training: c.training }));
  } catch {
    /* private mode: the page asks again next time, which is the safe way round */
  }
};
export const clearPendingConsent = () => {
  try {
    localStorage.removeItem(PENDING_CONSENT_KEY);
  } catch {
    /* nothing to clear */
  }
};

/** The account's choice and its save live in lib/consent.ts (shared by Settings, the assistant and first run). */
export { consentKey, useConsent, useSaveConsent } from '@/lib/consent';
