import { daysBetween, type ISODate } from './dates.js';

/**
 * Picks what to resurface today: a past journal entry or a quote. Nothing comes back within
 * 30 days of last being shown (favorites: 14). Favorites are 3x as likely, never-shown items 1.3x,
 * entries older than six months 1.3x.
 */
export const COOLDOWN_DAYS = 30;
export const FAV_COOLDOWN_DAYS = 14;

export interface RotationItem {
  id: string;
  fav: boolean;
  /** For journal entries: the entry's date, so old memories get a bump. */
  date?: ISODate;
}

export const chooseItem = <T extends RotationItem>(items: T[], lastShown: (id: string) => ISODate | null, todayDate: ISODate, excludeId?: string | null, rnd: () => number = Math.random): T | null => {
  const ok = (it: T) => {
    const l = lastShown(it.id);
    return !l || daysBetween(l, todayDate) >= (it.fav ? FAV_COOLDOWN_DAYS : COOLDOWN_DAYS);
  };
  const others = items.filter((it) => it.id !== excludeId);
  let pool = others.filter(ok);
  if (!pool.length) {
    // everything was shown recently: fall back to the tenth shown longest ago
    pool = [...others].sort((a, b) => ((lastShown(a.id) ?? '') < (lastShown(b.id) ?? '') ? -1 : 1)).slice(0, Math.max(1, Math.ceil(others.length * 0.1)));
  }
  if (!pool.length) return null;
  const weight = (it: T) => (it.fav ? 3 : 1) * (lastShown(it.id) ? 1 : 1.3) * (it.date && daysBetween(it.date, todayDate) > 180 ? 1.3 : 1);
  const total = pool.reduce((s, it) => s + weight(it), 0);
  let r = rnd() * total;
  for (const it of pool) {
    r -= weight(it);
    if (r <= 0) return it;
  }
  return pool[pool.length - 1] ?? null;
};

export const ago = (d: ISODate, todayDate: ISODate): string => {
  const n = daysBetween(d, todayDate);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 730) return `${Math.round(n / 30.4)} months ago`;
  return `${Math.round(n / 365)} years ago`;
};
