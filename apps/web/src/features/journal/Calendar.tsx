import type * as React from 'react';
import { fmtDate, parseISO, type JournalEntry } from '@logbook/shared';
import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { Pressable, Segmented } from '@/ui';
import { Orb } from '@/ui/Orb';
import { dayLabel, monthGrid, ORB_KEY, orbVariant, pageBy, pageHolds, pageTitle, weekDays, type CalView, type OrbVariant } from './calDays';

type OrbProps = React.ComponentProps<typeof Orb>;
/** The brand orb with its palette (`variant` lands with the canvas orb; until then the prop is passed through as is). */
const BrandOrb = Orb as unknown as (p: OrbProps & { variant?: OrbVariant }) => React.JSX.Element;

/**
 * A day's mark: the orb in the palette its memories pick (calendar.ts `orbVariant`), one still frame. `live` is today's:
 * the brand's own orb, breathing, inside a soft pulse (none under Reduce Motion).
 */
export const DayOrb = ({ variant, size, live = false }: { variant: OrbVariant | null; size: number; live?: boolean }) =>
  live ? (
    <span className="jcal-pulse" aria-hidden="true">
      <BrandOrb size={size} variant={variant ?? 'brand'} state="idle" />
    </span>
  ) : (
    <BrandOrb size={size} variant={variant ?? 'brand'} state="still" />
  );

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export interface CalendarProps {
  today: string;
  byDate: Map<string, JournalEntry[]>;
  /** The page's days are still being fetched: nothing is said about what was or was not written. */
  loading?: boolean;
  view: CalView;
  onView: (v: CalView) => void;
  /** Any day of the page shown (a week, or a month). */
  anchor: string;
  onAnchor: (d: string) => void;
  /** The day open in the day card under the calendar. */
  open: string | null;
  onPick: (d: string) => void;
  /** Whether today's memory is being written right now (the affordance steps aside). */
  writingToday: boolean;
}

/**
 * The Journal's calendar card: the page's name with how many days have memories, Week · Month and the paging arrows, then
 * the days. A day with memories wears a small still orb in its palette; a day without is a plain number; today is ringed
 * and, until it has a memory, holds the breathing orb and the card ends in "Write today's". Tap today to write, a past
 * day to read it; days to come are quiet.
 */
export const Calendar = ({ today, byDate, loading = false, view, onView, anchor, onAnchor, open, onPick, writingToday }: CalendarProps) => {
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor);
  const written = days.filter((d) => d && byDate.has(d)).length;
  const onToday = pageHolds(anchor, view, today);
  const todayEmpty = !byDate.has(today);
  // nothing to page on to once the page holds today (the days to come have no memories yet)
  const atEnd = view === 'week' ? anchor >= today : anchor.slice(0, 7) >= today.slice(0, 7);
  const page = (dir: -1 | 1) => {
    haptics.select();
    onAnchor(pageBy(anchor, view, dir));
  };
  const back = () => {
    haptics.select();
    onAnchor(today);
  };
  const markSize = view === 'week' ? 22 : 16;
  return (
    <section className="jcal" aria-label="Calendar">
      <div className="jcal-head">
        <h2 className="jcal-title">{pageTitle(anchor, view)}</h2>
        <span className="jcal-meta">{written ? `${written} ${written === 1 ? 'day' : 'days'} written` : loading ? '' : 'Nothing written'}</span>
      </div>
      <div className="jcal-bar">
        <Segmented
          className="k-seg jcal-seg"
          label="Week or month"
          options={[
            ['week', 'Week'],
            ['month', 'Month'],
          ]}
          value={view}
          onChange={(v: CalView) => {
            haptics.select();
            onView(v);
          }}
        />
        <div className="jcal-nav">
          {onToday ? null : (
            <button type="button" className="jcal-today-btn" onClick={back}>
              Today
            </button>
          )}
          <button type="button" className="jcal-arrow" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => page(-1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="jcal-arrow" aria-label={view === 'week' ? 'Next week' : 'Next month'} disabled={atEnd} onClick={() => page(1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      {view === 'month' ? (
        <div className="jcal-dow" aria-hidden="true">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
      ) : null}
      <div className={`jcal-grid is-${view}`} role="group" aria-label={pageTitle(anchor, view)}>
        {days.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="jcal-cell is-blank" aria-hidden="true" />;
          const entries = byDate.get(d);
          const n = entries?.length ?? 0;
          const isToday = d === today;
          const future = d > today;
          const variant = orbVariant(entries);
          return (
            <button
              key={d}
              type="button"
              className={`jcal-cell ${isToday ? 'is-today' : ''} ${future ? 'is-future' : ''} ${n ? 'has' : ''} ${open === d ? 'is-open' : ''}`}
              aria-label={`${isToday ? 'Today, ' : ''}${dayLabel(d, n)}${isToday && !n ? '. Write today’s' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={open === d}
              disabled={future}
              onClick={() => onPick(d)}
            >
              {view === 'week' ? <span className="jcal-wd">{fmtDate('dow', d)}</span> : null}
              <span className="jcal-num">{parseISO(d).getDate()}</span>
              <span className="jcal-mark">{variant ? <DayOrb variant={variant} size={markSize} /> : isToday ? <DayOrb variant={null} size={markSize} live /> : null}</span>
            </button>
          );
        })}
      </div>
      {todayEmpty && !writingToday && !loading ? (
        <Pressable className="jcal-write" press="scale" onPress={() => onPick(today)} label="Write today’s memory">
          <DayOrb variant={null} size={26} live />
          <span className="jcal-write-t">
            <b>Write today’s</b>
            <span>A line or two is plenty</span>
          </span>
          <PenLine size={18} aria-hidden="true" className="jcal-write-i" />
        </Pressable>
      ) : null}
      <div className="jcal-key">
        <span className="jcal-key-k" id="jcal-key-k">
          Memories
        </span>
        <ul aria-labelledby="jcal-key-k">
          {ORB_KEY.map(({ v, label }) => (
            <li key={v}>
              <BrandOrb size={11} variant={v} state="still" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
