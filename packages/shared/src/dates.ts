/** Calendar dates as `YYYY-MM-DD` strings in the athlete's local time zone. */

export type ISODate = string;

export const pad = (n: number): string => String(n).padStart(2, '0');

export const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

export const isISODate = (s: unknown): s is ISODate => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime());

export const shiftDays = (s: ISODate, n: number): ISODate => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Monday that starts the week containing `s`. */
export const mondayOf = (s: ISODate): ISODate => shiftDays(s, -((parseISO(s).getDay() + 6) % 7));

export const monthOf = (s: ISODate): string => s.slice(0, 7);
export const monthStart = (s: ISODate): ISODate => `${s.slice(0, 7)}-01`;

export const addMonths = (s: ISODate, n: number): ISODate => {
  const d = parseISO(monthStart(s));
  d.setMonth(d.getMonth() + n);
  return toISO(d);
};

export const daysBetween = (a: ISODate, b: ISODate): number => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5);

export const today = (): ISODate => toISO(new Date());

/** Every `YYYY-MM` month touched by the inclusive range. */
export const monthsBetween = (a: ISODate, b: ISODate): string[] => {
  const out: string[] = [];
  for (let m = monthStart(a); m <= b; m = addMonths(m, 1)) out.push(monthOf(m));
  return out;
};

/** Every date in the inclusive range. */
export const eachDay = (a: ISODate, b: ISODate): ISODate[] => {
  const out: ISODate[] = [];
  for (let d = a; d <= b; d = shiftDays(d, 1)) out.push(d);
  return out;
};

const F = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', opts);
export const fmt = {
  long: F({ weekday: 'long', month: 'long', day: 'numeric' }),
  short: F({ weekday: 'short', month: 'short', day: 'numeric' }),
  md: F({ month: 'short', day: 'numeric' }),
  dow: F({ weekday: 'short' }),
  dowLong: F({ weekday: 'long' }),
  month: F({ month: 'long', year: 'numeric' }),
  monthShort: F({ month: 'short' }),
};
export const fmtDate = (kind: keyof typeof fmt, s: ISODate): string => fmt[kind].format(parseISO(s));

/** Human label for a date relative to today: Today, Yesterday, Tomorrow, else weekday. */
export const relativeDay = (s: ISODate, t: ISODate = today()): string => {
  if (s === t) return 'Today';
  if (s === shiftDays(t, -1)) return 'Yesterday';
  if (s === shiftDays(t, 1)) return 'Tomorrow';
  return fmt.dowLong.format(parseISO(s));
};

/** Seconds -> `m:ss` or `h:mm:ss`. */
export const clock = (sec: number): string => {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${pad(m)}` : String(m)}:${pad(s % 60)}`;
};

/** Minutes after midnight -> `7:20 AM`. */
export const clockOfDay = (mins: number): string => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  return `${hh % 12 || 12}:${pad(m % 60)} ${hh < 12 ? 'AM' : 'PM'}`;
};

/** Minutes -> `1 h 20 min` / `45 min`. */
export const durationWords = (mins: number): string => {
  const m = Math.round(mins);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};

/** Miles to one decimal, always with the decimal (`5.0`). */
export const mi = (v: number | null | undefined): string => (Math.round((v ?? 0) * 10) / 10).toFixed(1);
/** Compact number: up to two decimals, no trailing zeros. */
export const num = (v: number | null | undefined): string => String(Math.round((v ?? 0) * 100) / 100);

export const METERS_PER_MILE = 1609.344;
