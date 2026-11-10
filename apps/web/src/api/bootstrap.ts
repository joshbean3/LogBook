import { z } from 'zod';
import { DEFAULT_CONSENT, type Consent } from '@logbook/shared';
import type { Bootstrap } from './types';

/**
 * The bootstrap is the one answer the whole app is drawn from, and it is kept on the device for the next open. An answer in
 * the wrong shape (a proxy's page, a server from another version, a half-written cache) used to blank the app on every open
 * until the saved copy was deleted by hand. So it is checked before it is used and before it is saved: what the shell and
 * the pages read without a guard has to be there; everything else passes through untouched.
 */
const zConsent = z.object({
  training: z.boolean(),
  health: z.boolean().nullable(),
  recall: z.boolean(),
  reads: z.boolean(),
  at: z.string().nullable(),
  version: z.string().nullable(),
});
const zTrainWhen = z.object({ when: z.enum(['morning', 'afternoon', 'none']), offWork: z.number().nullable() });
const zBootstrap = z.looseObject({
  user: z.looseObject({ id: z.string().min(1), email: z.string() }),
  habits: z.array(z.looseObject({ id: z.string() })),
  blocks: z.array(z.looseObject({ id: z.string() })),
  morningSettings: z.looseObject({ wake: z.number() }),
  zones: z.array(z.unknown()).nullish(),
  strava: z.looseObject({ connected: z.boolean() }),
  features: z.looseObject({ claude: z.boolean(), strava: z.boolean() }),
});

/** The server answered, but not with a bootstrap. Read like a failed request: the last good copy stays in the cache. */
export class BadShapeError extends Error {
  constructor(what: string) {
    super(`Unexpected answer from the server (${what})`);
    this.name = 'BadShapeError';
  }
}

/** The account's privacy choice as the server sent it (Contract 1), or undefined when it is absent or not readable. */
export const consentOf = (raw: unknown): Consent | undefined => {
  const r = zConsent.safeParse(raw);
  return r.success ? r.data : undefined;
};

export const isBootstrap = (raw: unknown): raw is Bootstrap => zBootstrap.safeParse(raw).success;

/**
 * The answer as a Bootstrap, or a BadShapeError. The object is returned as it came (no copy, so a refetch that brings
 * nothing new keeps its identity), except when `consent` is missing or not a full record: then it is filled with the
 * never-asked record (nothing granted), so the open still succeeds and the app never guesses a yes. A `trainWhen` that is
 * missing (a server or a saved copy from before it) or unreadable reads as null, no answer.
 */
export const parseBootstrap = (raw: unknown): Bootstrap => {
  const r = zBootstrap.safeParse(raw);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new BadShapeError(first ? `${first.path.join('.') || 'bootstrap'}: ${first.message}` : 'bootstrap');
  }
  const b = raw as Bootstrap;
  const badConsent = !consentOf(b.consent);
  const badTrainWhen = b.trainWhen !== null && !zTrainWhen.safeParse(b.trainWhen).success;
  if (!badConsent && !badTrainWhen) return b;
  return { ...b, ...(badConsent ? { consent: { ...DEFAULT_CONSENT } } : null), ...(badTrainWhen ? { trainWhen: null } : null) };
};
