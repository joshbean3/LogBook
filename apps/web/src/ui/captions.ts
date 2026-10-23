import { WORD_MAX } from '@/lib/gesture';

/**
 * The bar's words (docs/feel.md §2.2–2.3, contracts §B.2): the caps line's date part, the owner's word, the titles. Pure
 * functions of ISO dates, never of data; ui/NavBar.tsx re-exports them.
 */
export const D = (s: string) => new Date(`${s}T12:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((D(b).getTime() - D(a).getTime()) / 86_400_000);
export const fmt = (s: string, o: Intl.DateTimeFormatOptions) => D(s).toLocaleDateString('en-US', { timeZone: 'UTC', ...o });
const MON = (s: string) => fmt(s, { month: 'short' }).toUpperCase();
export const DAYN = (s: string) => String(D(s).getUTCDate());
export const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const mondayOfIso = (s: string) => iso(D(s).getTime() - ((D(s).getUTCDay() + 6) % 7) * 86_400_000);

/** The date part: 'full' 'THU, OCT 29' → 'short' 'OCT 29' → 'day' '29'. The word never drops; the date shortens. */
export const dayCaption = (date: string, _today?: string, form: 'full' | 'short' | 'day' = 'full'): string => {
  if (form === 'day') return DAYN(date);
  if (form === 'short') return `${MON(date)} ${DAYN(date)}`;
  return `${fmt(date, { weekday: 'short' }).toUpperCase()}, ${MON(date)} ${DAYN(date)}`;
};
/** 'STEADY' from 'Steady': upper-cased, at most WORD_MAX (12) characters, a longer legacy word clipped with '…'; null when empty. */
export const capsWord = (word?: string | null): string | null => {
  const w = (word ?? '').trim();
  if (!w) return null;
  const up = w.toUpperCase();
  return up.length > WORD_MAX ? `${up.slice(0, WORD_MAX - 1)}…` : up;
};
/** 'Today' | 'Tomorrow' | 'Yesterday' | 'Sat 24' (±6 days) | 'Sun, Oct 11' | 'Sun, Oct 11, 2025'. Never from data. */
export const dayTitle = (date: string, today: string): string => {
  const n = daysBetween(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (Math.abs(n) <= 6) return `${fmt(date, { weekday: 'short' })} ${DAYN(date)}`;
  const base = `${fmt(date, { weekday: 'short' })}, ${fmt(date, { month: 'short' })} ${DAYN(date)}`;
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base}, ${date.slice(0, 4)}`;
};
/** 'THIS WEEK · OCT 19–25' | 'NEXT WEEK · OCT 26–NOV 1' | 'LAST WEEK · …' | 'OCT 12–18'. */
export const weekCaption = (mon: string, today: string): string => {
  const sun = iso(D(mon).getTime() + 6 * 86_400_000);
  const range = MON(mon) === MON(sun) ? `${MON(mon)} ${DAYN(mon)}–${DAYN(sun)}` : `${MON(mon)} ${DAYN(mon)}–${MON(sun)} ${DAYN(sun)}`;
  const w = Math.round(daysBetween(mondayOfIso(today), mon) / 7);
  if (w === 0) return `THIS WEEK · ${range}`;
  if (w === 1) return `NEXT WEEK · ${range}`;
  if (w === -1) return `LAST WEEK · ${range}`;
  return range;
};
/** 'OCTOBER 2026'. */
export const monthCaption = (first: string): string => fmt(first, { month: 'long', year: 'numeric' }).toUpperCase();

export type Form = 'full' | 'short' | 'day';
export const FORMS: Form[] = ['full', 'short', 'day'];
/** A caption in a shorter form: 'THIS WEEK · OCT 19–25' → 'OCT 19–25'; 'THU, OCT 29' → 'OCT 29' → '29'. */
export const shorten = (s: string, form: Form): string => {
  if (form === 'full' || typeof s !== 'string') return s;
  let t = s.includes(' · ') ? s.slice(s.lastIndexOf(' · ') + 3) : s;
  if (t.includes(', ')) t = t.slice(t.indexOf(', ') + 2);
  return form === 'short' ? t : (t.split(' ').at(-1) ?? t);
};

