import { RULES, shiftDays, within, type ISODate, type Rewards } from '@logbook/shared';

/** User setting: the Orbs store (`zRewards`; the bootstrap carries it, null before one is saved). */
export const REWARDS_KEY = 'rewards';
/** The most the stored Orbs object may weigh as JSON. Eleven years of days fit well inside it. */
export const REWARDS_MAX_BYTES = 240 * 1024;

/**
 * What a phone sent (or an import file holds), made safe to merge:
 *
 * - nothing dated after the server's own date plus one (`within`: a phone ahead of every time zone has its clock wrong),
 *   and nothing before the rules began;
 * - only closed days (an open day is recomputed by each phone from the synced facts), and only days that could have
 *   closed. A phone closes a day when its own date is two past it, and no phone's date is more than one past the
 *   server's, so an honestly closed day is before the server's today. (A day rebuilt from the account's facts after a
 *   wipe is closed up to the phone's yesterday, which is the server's today for a phone east of it.) A day closed
 *   earlier than that came from a device with a wrong date: taken in, "closed beats open" would shut that day on every
 *   other phone of the account.
 */
export const admitRewards = (sent: Rewards, serverDay: ISODate): Rewards => {
  const cut = within(sent, shiftDays(serverDay, 1));
  const days: Rewards['days'] = {};
  for (const [d, rec] of Object.entries(cut.days)) if (rec.c && d >= RULES.startsOn && (d < serverDay || (rec.r === 1 && d === serverDay))) days[d] = rec;
  return { ...cut, startedOn: cut.startedOn < RULES.startsOn ? RULES.startsOn : cut.startedOn, days };
};
