import { fmtDate, parseISO } from '@logbook/shared';
import { Plus } from 'lucide-react';
import { Disc, type DiscTone } from '@/ui/Disc';
import { FavoriteIcon } from '@/ui/icons';
import { monthGrid, type OrbVariant } from './calDays';
import { writtenWords, type DayMark } from './days';
import './calendar.css';

/** The guide's entry marks (12.1): one thing written a Haze disc ringed in Deep Sky, two `--entry-2`, three or more Sky, a Favorite Deep Sky. */
const TONE: Record<Exclude<OrbVariant, 'brand'>, DiscTone> = { sky: 'haze', dusk: 'two', tide: 'sky', sun: 'deep' };

/**
 * A day's mark: a flat disc in the tone its count picks, never the Orb (guide 2.1). The count is the numeral inside it and
 * a Favorite carries a heart instead, so the tone is never the only signal (guide 3.3). With no variant it is an empty
 * Haze disc.
 */
export const DayDisc = ({ variant, size, n }: { variant: OrbVariant | null; size: number; n?: number }) => {
  if (!variant || variant === 'brand') return <Disc size={size} tone="haze" className="jcal-disc" />;
  if (variant === 'sun')
    return (
      <span className="jcal-disc is-fav" style={{ width: size, height: size }}>
        <Disc size={size} tone="deep" />
        <FavoriteIcon size={Math.round(size * 0.62)} fill="currentColor" strokeWidth={0} className="jcal-disc-heart" />
      </span>
    );
  return <Disc size={size} tone={TONE[variant]} n={n == null ? undefined : n > 9 ? '9+' : n} className="jcal-disc" />;
};

/** The disc for a day's mark: by how much was written (a line and each entry count one), a Favorite first. */
export const markVariant = (m: DayMark | undefined): OrbVariant | null => {
  const n = m ? m.lines + m.entries : 0;
  if (!m || !n) return null;
  if (m.fav) return 'sun';
  return n === 1 ? 'sky' : n === 2 ? 'dusk' : 'tide';
};

/** A day cell's name for VoiceOver: the number printed on it first, then the weekday and what the cell shows. */
export const cellLabel = (d: string, m: DayMark | undefined, today: string): string => {
  const num = String(parseISO(d).getDate());
  const empty = !m || m.lines + m.entries === 0;
  return `${num}, ${fmtDate('dowLong', d)}${today === d ? ', today' : ''}, ${writtenWords(m?.lines ?? 0, m?.entries ?? 0)}${m?.fav ? ', a Favorite' : ''}${empty && d <= today ? '. Write this day' : ''}`;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface MonthCalendarProps {
  /** '2026-11' */
  month: string;
  today: string;
  /** What each written day holds (days.ts `dayMarks`). */
  marks: ReadonlyMap<string, DayMark>;
  /** The month's days are still being read (or could not be): nothing is said about what was or was not written. */
  unknown?: boolean;
  /** The day picked last (its page's row is lit under the calendar). */
  open: string | null;
  onPick: (d: string) => void;
}

/**
 * A month's calendar, at the top of its page: a day with something written wears a flat disc in its tone with the count
 * inside it (a heart on a day with a Favorite), so nothing rests on color alone and no legend is needed; a day without is
 * a plain number. Today's numeral is ringed in Night Ink, the picked day's in Sky; until today has something it holds a
 * plus. Tap a day: the page jumps to it (or, for a day with nothing, opens its composer). Days to come are quiet.
 */
export const MonthCalendar = ({ month, today, marks, unknown = false, open, onPick }: MonthCalendarProps) => {
  const days = monthGrid(`${month}-01`);
  const title = fmtDate('month', `${month}-01`);
  return (
    <section className="jcal is-fixed" aria-label={`${title}, calendar`}>
      <div className="jcal-dow" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="jcal-grid is-month" role="group" aria-label={title}>
        {days.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="jcal-cell is-blank" aria-hidden="true" />;
          const m = marks.get(d);
          const n = m ? m.lines + m.entries : 0;
          const isToday = d === today;
          const future = d > today;
          const variant = markVariant(m);
          return (
            <button key={d} type="button" className={`jcal-cell ${isToday ? 'is-today' : ''} ${future ? 'is-future' : ''} ${n ? 'has' : ''} ${open === d ? 'is-open' : ''}`} aria-label={cellLabel(d, unknown ? undefined : m, today)} aria-current={isToday ? 'date' : undefined} aria-pressed={open === d} disabled={future} onClick={() => onPick(d)}>
              <span className="jcal-num">{parseISO(d).getDate()}</span>
              <span className="jcal-mark" aria-hidden="true">
                {variant ? (
                  <DayDisc variant={variant} size={18} n={n} />
                ) : isToday && !unknown ? (
                  <span className="jcal-plus" style={{ width: 18, height: 18 }}>
                    <Plus size={11} strokeWidth={2.4} />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
