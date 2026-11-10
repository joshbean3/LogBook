import { CONSENT_VERSION, type ConsentInput } from '@logbook/shared';

/**
 * The answer given on the privacy page, before the account exists. It waits on this device (`logbook.consent.pending`)
 * until Create account, which sends it with the new account and clears it.
 *
 *   allow   the person tapped Allow: the account is created with `{ training: true, version }`
 *   later   the person tapped Not now: the account is created with no consent record at all, so its `at` stays null
 *           and the first use of the assistant or the plan builder asks again before anything is sent
 *
 * Nothing is stored until one of the two buttons is tapped: there is no default.
 */
export const PENDING_CONSENT_KEY = 'logbook.consent.pending';
export type PendingChoice = 'allow' | 'later';

export const readPendingChoice = (): PendingChoice | null => {
  try {
    const raw = localStorage.getItem(PENDING_CONSENT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { choice?: unknown };
    return v.choice === 'allow' || v.choice === 'later' ? v.choice : null;
  } catch {
    return null;
  }
};
export const writePendingChoice = (choice: PendingChoice) => {
  try {
    localStorage.setItem(PENDING_CONSENT_KEY, JSON.stringify({ choice, version: CONSENT_VERSION }));
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

/**
 * What sign-up sends for a choice: the yes with the wording version it was given under, or nothing at all. The server
 * stamps the time when it stores it.
 */
export const consentForSignup = (choice: PendingChoice | null): ConsentInput | undefined => (choice === 'allow' ? { training: true, version: CONSENT_VERSION } : undefined);

/** The account's choice and its save live in lib/consent.ts (shared by Settings, the assistant and first run). */
export { consentKey, useConsent, useSaveConsent } from '@/lib/consent';
