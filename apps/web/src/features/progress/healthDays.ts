/**
 * Apple Health on Progress, apart from the screen (the tests read it): the daily readings as `GET /api/apple-health/daily`
 * answers them (Contract 4), the calls that fetch a stretch of days, and the words and the range pill a tile shows.
 */
import type { ISODate } from '@logbook/shared';
import type { MetricModel } from './metrics';

/** One day as Contract 4 answers it. A value the phone had no reading for is null. */
export interface HealthDay {
  date: ISODate;
  sleepMin: number | null;
  hrvMs: number | null;
  restingHr: number | null;
}

/**
 * The key of one call. It starts with `apple-health`, the prefix the app shell leaves out of the cache it keeps on the
 * phone, so readings are never written to storage that a device backup carries.
 */
export const healthDaysKey = (year: string) => ['apple-health', 'daily', year] as const;

/**
 * The calls that cover `from`..`to`: one per calendar year, so each asks for at most 366 days (the route's limit is 400)
 * and two screens that need the same year share one answer.
 */
export const healthYears = (from: ISODate, to: ISODate): Array<{ year: string; from: ISODate; to: ISODate }> => {
  const out: Array<{ year: string; from: ISODate; to: ISODate }> = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) out.push({ year: String(y), from: `${y}-01-01`, to: `${y}-12-31` });
  return out;
};

/** The answers of those calls as one lookup by date. A day with no reading at all is left out. */
export const healthByDate = (answers: Array<{ days?: HealthDay[] } | null | undefined>): Map<ISODate, HealthDay> => {
  const m = new Map<ISODate, HealthDay>();
  for (const a of answers)
    for (const d of a?.days ?? []) {
      if (!d || typeof d.date !== 'string') continue;
      const day: HealthDay = { date: d.date, sleepMin: num(d.sleepMin), hrvMs: num(d.hrvMs), restingHr: num(d.restingHr) };
      if (day.sleepMin != null || day.hrvMs != null || day.restingHr != null) m.set(day.date, day);
    }
  return m;
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Where the account stands with Apple Health, as the tiles and the pages need it. */
export interface HealthLink {
  /** A phone is connected for this account. */
  connected: boolean;
  /** A sync is running on this phone right now. */
  syncing: boolean;
  /** When the server last took readings from a phone (ISO), when it has. */
  lastSyncAt?: string | null;
}

/**
 * The word under a health number. With readings it is the metric's own status ("Usual range"). Without: "Syncing" only
 * while a sync is running, "No readings yet" when connected, "Not connected" otherwise.
 */
export const healthWord = (m: Pick<MetricModel, 'hasData' | 'status'>, link: HealthLink): string => (m.hasData ? m.status : link.syncing ? 'Syncing' : link.connected ? 'No readings yet' : 'Not connected');

/**
 * The tile's range pill: where the latest value sits (0..1 up the track) and your usual stretch on the same track. The
 * track runs over the month on the tile and the usual band, with a little room at each end. Null with no value.
 */
export const pillOf = (m: Pick<MetricModel, 'value' | 'band' | 'line'>): { pos: number; band: [number, number] | null } | null => {
  if (m.value == null) return null;
  const xs = m.line.filter((v): v is number => v != null);
  let lo = Math.min(m.value, ...xs, m.band?.lo ?? Infinity);
  let hi = Math.max(m.value, ...xs, m.band?.hi ?? -Infinity);
  const pad = (hi - lo) * 0.15 || Math.max(1, Math.abs(hi) * 0.05);
  lo -= pad;
  hi += pad;
  const at = (v: number) => (v - lo) / (hi - lo);
  return { pos: at(m.value), band: m.band ? [at(m.band.lo), at(m.band.hi)] : null };
};
