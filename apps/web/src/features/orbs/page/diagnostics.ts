import { dayState, mondayOf, RULES, shiftDays, weekState, type ISODate, type Rewards, type RewardSet } from '@logbook/shared';

/**
 * "For the curious": a few counts about how Orbs are going, worked out on this phone from the stored object and shown at
 * the foot of "How Orbs work". Counts only, never content, and nothing here makes a request: the function is pure and its
 * one caller draws what it returns.
 */
export interface Diagnostics {
  /** Finished weeks since the start, leaving out the ones that were paused or switched off. */
  weeks: number;
  /** Days that counted in those weeks. `perWeek` is their mean, to one decimal; null with no finished week. */
  countedInWeeks: number;
  perWeek: number | null;
  /** Days that counted, in all, and how many of them held exactly one thing done. `oneShare` is a whole percent; null with no counted day. */
  counted: number;
  one: number;
  oneShare: number | null;
  /** Challenges the store still holds (about the last 60 days), by what became of them. */
  challenges: { offered: number; added: number; done: number; skipped: number };
  /** The switches as they stand, and how many times Orbs have been switched off. */
  set: Pick<RewardSet, 'on' | 'show' | 'weekTarget' | 'cadence' | 'size'>;
  timesOff: number;
}

export const diagnostics = (s: Rewards, today: ISODate): Diagnostics => {
  let weeks = 0;
  let countedInWeeks = 0;
  const thisWeek = mondayOf(today);
  for (let m = mondayOf(s.startedOn), i = 0; m < thisWeek && i < 1040; m = shiftDays(m, 7), i++) {
    if (weekState(s, m, today) === 'neutral') continue;
    weeks++;
    for (let d = 0; d < 7; d++) if (dayState(s, shiftDays(m, d), today) === 'counted') countedInWeeks++;
  }
  let counted = 0;
  let one = 0;
  for (const d in s.days) {
    const a = s.days[d]!.a;
    if (a >= 1) counted++;
    if (a === 1) one++;
  }
  const challenges = { offered: 0, added: 0, done: 0, skipped: 0 };
  for (const k in s.challenges) {
    const st = s.challenges[k]!.state;
    // every challenge in the store was offered; an added one is added whether or not it was finished
    challenges.offered++;
    if (st === 'added' || st === 'done') challenges.added++;
    if (st === 'done') challenges.done++;
    if (st === 'skipped') challenges.skipped++;
  }
  return {
    weeks,
    countedInWeeks,
    perWeek: weeks ? Math.round((countedInWeeks / weeks) * 10) / 10 : null,
    counted,
    one,
    oneShare: counted ? Math.round((one / counted) * 100) : null,
    challenges,
    set: { on: s.set.on, show: s.set.show, weekTarget: s.set.weekTarget, cadence: s.set.cadence, size: s.set.size },
    timesOff: s.off.length,
  };
};

const CADENCE = ['off', 'one a week', 'two a week'] as const;
/** The counts as label and value, for the disclosure. A count with nothing in it says "None yet", never a zero. */
export const diagnosticRows = (d: Diagnostics): Array<{ label: string; value: string }> => {
  const c = d.challenges;
  return [
    { label: 'Days counted a week', value: d.perWeek === null ? 'None yet' : `${d.perWeek} over ${d.weeks} ${d.weeks === 1 ? 'week' : 'weeks'}` },
    { label: 'Counted days with one thing done', value: d.oneShare === null ? 'None yet' : `${d.oneShare} percent (${d.one} of ${d.counted})` },
    { label: `Challenges, last ${RULES.detailDays} days`, value: c.offered ? `${c.offered} offered, ${c.added} added, ${c.done} done` : 'None yet' },
    { label: 'Switches', value: `Orbs ${d.set.on ? 'on' : 'off'}. Shown ${d.set.show ? 'on' : 'off'}. A ${d.set.weekTarget} day week. Challenges ${CADENCE[d.set.cadence]}${d.set.cadence ? `, ${d.set.size}` : ''}.` },
    { label: 'Orbs switched off', value: d.timesOff ? `${d.timesOff} ${d.timesOff === 1 ? 'time' : 'times'}` : 'Never' },
  ];
};
