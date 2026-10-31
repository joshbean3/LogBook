/**
 * Time zones without a library: the IANA zone the client sends (`X-Timezone`) and `Intl` turn a local date and time
 * into an instant and back. Enough for reminders (minute precision, DST-safe through the two-pass offset check).
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
const fmtFor = (tz: string) => {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
    fmtCache.set(tz, f);
  }
  return f;
};

export const isTimeZone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export interface LocalParts {
  date: string;
  time: string;
  /** mon … sun */
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  /** Minutes after midnight. */
  minutes: number;
}

/** The wall clock in `tz` at `instant`. */
export const localParts = (instant: Date, tz: string): LocalParts => {
  const parts = Object.fromEntries(fmtFor(tz).formatToParts(instant).map((p) => [p.type, p.value])) as Record<string, string>;
  const hh = Number(parts.hour);
  const mm = Number(parts.minute);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: (parts.weekday ?? 'Mon').slice(0, 3).toLowerCase() as LocalParts['weekday'], minutes: hh * 60 + mm };
};

/** The zone's offset from UTC at `instant`, in milliseconds (east positive). */
const offsetAt = (instant: Date, tz: string): number => {
  const p = Object.fromEntries(fmtFor(tz).formatToParts(instant).map((x) => [x.type, x.value])) as Record<string, string>;
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/** The instant at which `tz` reads `date` `HH:MM`. A time skipped by a DST jump lands at the next valid instant. */
export const zonedToUtc = (date: string, time: string, tz: string): Date => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = offsetAt(new Date(guess), tz);
  let utc = guess - off1;
  const off2 = offsetAt(new Date(utc), tz);
  // a wall clock inside a DST gap: the offset before the jump, so the instant lands after it
  if (off2 !== off1) utc = guess - Math.min(off1, off2);
  return new Date(utc);
};

/** The instant for `minutes` after local midnight on `date` in `tz`. */
export const zonedMinutesToUtc = (date: string, minutes: number, tz: string): Date => {
  const extraDays = Math.floor(minutes / 1440);
  const m = ((minutes % 1440) + 1440) % 1440;
  const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const at = zonedToUtc(date, time, tz);
  return extraDays ? new Date(at.getTime() + extraDays * 864e5) : at;
};
