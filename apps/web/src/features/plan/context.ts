import { fmtDate, mondayOf, shiftDays } from '@logbook/shared';

/** A block's name without the length it often ends with (`Half marathon · 12 weeks`): a card has room for the name only. */
export const shortName = (name: string) => name.replace(/\s*·\s*\d+\s*weeks?$/i, '') || name;

/** A week's name for its section header: `This week`, `Last week`, `Next week`, else `Week of Nov 16`. */
export const weekTitle = (mon: string, today: string) => {
  const now = mondayOf(today);
  return mon === now ? 'This week' : mon === shiftDays(now, -7) ? 'Last week' : mon === shiftDays(now, 7) ? 'Next week' : `Week of ${fmtDate('md', mon)}`;
};
