import type { Consent } from '@logbook/shared';

/**
 * Whether the conversation may show. `open`: a choice about the assistant is stored. `ask`: none is (consent.at is null,
 * or the server answered an ask with "ask first"), so the permission step shows and nothing can be sent. `checking`: the
 * choice is not known yet. `unknown`: it could not be read (no connection and nothing kept on the phone).
 */
export type Gate = 'open' | 'ask' | 'checking' | 'unknown';
export const gateOf = (consent: Consent | null | undefined, serverAsked: boolean, failed: boolean): Gate =>
  serverAsked ? 'ask' : consent ? (consent.at === null ? 'ask' : 'open') : failed ? 'unknown' : 'checking';
