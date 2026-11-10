import type { Consent } from '@logbook/shared';

/** The three choices of the consent record that 1.0 offers (Contract 1). `health` stays null: no health data goes to the assistant. */
export type ConsentSwitch = 'training' | 'recall' | 'reads';

/** One switch on Settings, Privacy: its name, and one plain line on what is sent to Claude while it is on. */
export const CONSENT_SWITCHES: ReadonlyArray<{ key: ConsentSwitch; title: string; sub: string }> = [
  { key: 'training', title: 'Training data', sub: 'Your plan, sessions, training status, goals and to-dos. Sent when you ask the assistant, draft a plan or review a goal.' },
  { key: 'recall', title: 'Remember when', sub: 'One past journal entry or learning at a time, with your first name, to write Remember when.' },
  { key: 'reads', title: 'Daily read', sub: 'Your saved links, notes and tags, to pick one read a day.' },
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
