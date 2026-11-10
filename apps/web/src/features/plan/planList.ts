import type { PlanBlock } from '@logbook/shared';

type B = Pick<PlanBlock, 'id' | 'start' | 'end' | 'createdAt' | 'sessionCount'>;

/**
 * A plan a newer one took over whole (plan-29): no session of its own is left and a later plan covers all of its dates.
 * An AI plan saved over it, or a revision of it, leaves such a row on a server that does not end it yet. It is not a plan
 * any more, so neither the list nor the plan card shows it. A plan with sessions left, or one the newer plan only
 * partly covers, always shows.
 */
export const isShadowed = (b: B, all: readonly B[]): boolean => b.sessionCount === 0 && all.some((n) => n.id !== b.id && n.createdAt > b.createdAt && n.start <= b.start && n.end >= b.end);

/** The plans to show: every plan but the ones a newer plan took over whole. */
export const livePlans = <T extends B>(all: readonly T[]): T[] => all.filter((b) => !isShadowed(b, all));
