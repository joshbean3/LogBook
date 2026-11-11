/**
 * Where run history starts, for a server that cannot say. `GET /activities/start` answers it in one request; a server
 * from before that route existed answers 404, and then the month bundles (which every server has) are read back instead.
 * Pure: the caller hands in how a month is fetched.
 */
import { addMonths, monthOf, monthStart, type ISODate } from '@logbook/shared';
import { ApiError } from '@/api/client';
import type { MonthBundle } from '@/api/types';

/** A server from before a route existed answers it 404 (405 or 501 behind a proxy): the app does without the route. */
export const routeMissing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501);

/** Months read at once on the walk back, the run of months with no run that ends it, and how far back it will go. */
const WALK_BATCH = 6;
const WALK_QUIET = 12;
const WALK_MAX = 120;
/**
 * The first day with a run, done or on the plan, found from the month bundles themselves: this month, then back a month at
 * a time until a whole year has none. Null with no run at all. A month that cannot be read rejects the walk (the caller
 * shows the range as not loaded, never a wrong start).
 */
export const walkBackStart = async (month: (m: string) => Promise<Pick<MonthBundle, 'activities' | 'sessions'>>, today: ISODate, quiet = WALK_QUIET, max = WALK_MAX): Promise<ISODate | null> => {
  let first: ISODate | null = null;
  let empty = 0;
  let from = monthStart(today);
  for (let read = 0; read < max && empty < quiet; ) {
    const batch = Array.from({ length: Math.min(WALK_BATCH, max - read, quiet - empty) }, (_, i) => monthOf(addMonths(from, -i)));
    const bundles = await Promise.all(batch.map(month));
    for (const b of bundles) {
      const days = [...b.activities.filter((a) => a.kind === 'run').map((a) => a.date), ...b.sessions.filter((s) => s.kind === 'run').map((s) => s.date)].sort();
      if (days.length) {
        first = days[0]!;
        empty = 0;
      } else empty++;
    }
    read += batch.length;
    from = addMonths(from, -batch.length);
  }
  return first;
};
