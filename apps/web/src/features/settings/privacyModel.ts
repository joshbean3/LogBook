import type { Consent } from '@logbook/shared';

/** The three choices of the consent record that 1.0 offers (Contract 1). `health` stays null: no health data goes to the assistant. */
export type ConsentSwitch = 'training' | 'recall' | 'reads';

/**
 * One switch on Settings, Privacy: its name, and one short line on what it covers (layout standard 2.9: a row's subtitle is
 * one line). The whole of what is sent, and when, is the list under the switches ("What is sent"), word for word the one
 * sign-up shows, so nothing is lost by keeping the rows short.
 */
export const CONSENT_SWITCHES: ReadonlyArray<{ key: ConsentSwitch; title: string; sub: string }> = [
  { key: 'training', title: 'Training data', sub: 'Plan, sessions, status, goals, to-dos' },
  { key: 'recall', title: 'Remember when', sub: 'One past entry or learning at a time' },
  { key: 'reads', title: 'Daily read', sub: 'Your saved links, notes and tags' },
];

/** A switch reads on only for a person who has answered: an account that was never asked has granted nothing. */
export const switchOn = (c: Consent | null | undefined, key: ConsentSwitch): boolean => !!c && c.at !== null && c[key] === true;

/** Every switch off: what the page shows an account that was never asked, and so the base of its first answer. */
export const firstAnswer = (): Record<ConsentSwitch, boolean> => ({ training: false, recall: false, reads: false });

/** The short word for the Settings root row and the Privacy group: "Not asked", "Off", "On", or "2 of 3 on". */
export const consentWord = (c: Consent | null | undefined): string | undefined => {
  if (!c) return undefined;
  if (c.at === null) return 'Not asked';
  const n = CONSENT_SWITCHES.filter((s) => switchOn(c, s.key)).length;
  return n === 0 ? 'Off' : n === CONSENT_SWITCHES.length ? 'On' : `${n} of ${CONSENT_SWITCHES.length} on`;
};

/**
 * The one word on the Settings root's row (layout standard 2.9: the subtitle stays one line, so the value is short): "Off"
 * until something is on (an account never asked has granted nothing), "All" with every switch on, "Some" between.
 */
export const consentShort = (c: Consent | null | undefined): string | undefined => {
  if (!c) return undefined;
  const n = c.at === null ? 0 : CONSENT_SWITCHES.filter((s) => switchOn(c, s.key)).length;
  return n === 0 ? 'Off' : n === CONSENT_SWITCHES.length ? 'All' : 'Some';
};

/** The line under the switches: when the choice was made, or that it never was. */
export const consentFoot = (c: Consent | null | undefined): string => {
  if (!c) return ' ';
  if (c.at === null) return 'Not asked yet. Nothing goes to Claude until you allow it.';
  const d = new Date(c.at);
  const when = Number.isNaN(+d) ? '' : `You last chose on ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)}. `;
  return `${when}A change applies right away.`;
};

/** A mail to the support address, with the subject filled in. */
export const mailto = (address: string, subject: string): string => `mailto:${address}?subject=${encodeURIComponent(subject)}`;
