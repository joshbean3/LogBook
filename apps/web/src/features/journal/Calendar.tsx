import type * as React from 'react';
import { fmtDate, parseISO, type JournalEntry } from '@logbook/shared';
import { ChevronLeft, ChevronRight, PenLine, Plus, Star } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { Pressable, Segmented, Skeleton } from '@/ui';
import { Orb } from '@/ui/Orb';
import { dayLabel, monthGrid, ORB_KEY, orbVariant, pageBy, pageHolds, pageTitle, weekDays, type CalView, type OrbVariant } from './calDays';

type OrbProps = React.ComponentProps<typeof Orb>;
/** The brand orb with its palette (`variant` lands with the canvas orb; until then the prop is passed through as is). */
const BrandOrb = Orb as unknown as (p: OrbProps & { variant?: OrbVariant }) => React.JSX.Element;

/**
 * A day's mark: the orb in the palette its entries pick (calDays.ts `orbVariant`), one still frame. `live`: the brand's own
 * orb, breathing, inside a soft pulse (none under Reduce Motion), for the card's one invitation to write.
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
  /** The page's days could not be read (the pane says so under the calendar): nothing is said about them either. */
  failed?: boolean;
  /** Ask again for the days that could not be read (the meta line offers it). */
  onRetry?: () => void;
  view: CalView;
  onView: (v: CalView) => void;
  /** Any day of the page shown (a week, or a month). */
  anchor: string;
  onAnchor: (d: string) => void;
  /** The day open in the day card under the calendar. */
  open: string | null;
  onPick: (d: string) => void;
  /** Whether today's entry is being written right now (the affordance steps aside). */
  writingToday: boolean;
}

/**
 * The Journal's calendar card: the page's name with how many days have entries, Week · Month and the paging arrows, then
 * the days. A day with entries wears a small still orb in its palette with the count beside it (and a star on a day with
 * a favorite), so nothing rests on color alone; a day without is a plain number. Today is ringed and, until it has an
 * entry, holds a plus and the card ends in "Write today's entry". Tap a day to open it; days to come are quiet.
 */
export const Calendar = ({ today, byDate, loading = false, failed = false, onRetry, view, onView, anchor, onAnchor, open, onPick, writingToday }: CalendarProps) => {
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
  const unknown = loading || failed;
  const title = pageTitle(anchor, view, today);
  return (
    <section className="jcal" aria-label="Calendar">
      <div className="jcal-head">
        <h2 className="jcal-title">{title}</h2>
        {written ? (
          <span className="jcal-meta">{`${written} ${written === 1 ? 'day' : 'days'} written`}</span>
        ) : loading ? (
          <span className="jcal-meta" aria-hidden="true">
            <Skeleton w={96} h={14} />
          </span>
        ) : failed ? (
          onRetry ? (
            <button type="button" className="jcal-retry" onClick={onRetry}>
              Couldn’t load. Try again
            </button>
          ) : null
        ) : (
          <span className="jcal-meta">Nothing written</span>
        )}
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
      <div className={`jcal-grid is-${view}`} role="group" aria-label={title}>
        {days.map((d, i) => {
          if (!d) return <span key={`x${i}`} className="jcal-cell is-blank" aria-hidden="true" />;
          const entries = byDate.get(d);
          const n = entries?.length ?? 0;
          const isToday = d === today;
          const future = d > today;
          const variant = orbVariant(entries);
          const fav = !!entries?.some((e) => e.fav);
          return (
            <button
              key={d}
              type="button"
              className={`jcal-cell ${isToday ? 'is-today' : ''} ${future ? 'is-future' : ''} ${n ? 'has' : ''} ${open === d ? 'is-open' : ''}`}
              aria-label={`${dayLabel(d, n, { view, today, fav })}${isToday && !n && !unknown ? '. Write today’s entry' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={open === d}
              disabled={future}
              onClick={() => onPick(d)}
            >
              {view === 'week' ? <span className="jcal-wd">{fmtDate('dow', d)}</span> : null}
              <span className="jcal-num">{parseISO(d).getDate()}</span>
              <span className="jcal-mark" aria-hidden="true">
                {variant ? (
                  <>
                    {fav ? <Star className="jcal-fav" size={view === 'week' ? 11 : 9} fill="currentColor" strokeWidth={0} /> : null}
                    <DayOrb variant={variant} size={markSize} />
                    <span className="jcal-n">{n}</span>
                  </>
                ) : isToday && !unknown ? (
                  <span className="jcal-plus" style={{ width: markSize, height: markSize }}>
                    <Plus size={view === 'week' ? 14 : 11} strokeWidth={2.4} />
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      {todayEmpty && !writingToday && !unknown ? (
        <Pressable className="jcal-write" press="scale" onPress={() => onPick(today)} label="Write today’s entry">
          <DayOrb variant={null} size={26} live />
          <span className="jcal-write-t">
            <b>Write today’s entry</b>
            <span>A line or two is plenty</span>
          </span>
          <PenLine size={18} aria-hidden="true" className="jcal-write-i" />
        </Pressable>
      ) : null}
      <div className="jcal-key">
        <span className="jcal-key-k" id="jcal-key-k">
          Entries
        </span>
        <ul aria-labelledby="jcal-key-k">
          {ORB_KEY.map(({ v, label }) => (
            <li key={v}>
              <BrandOrb size={14} variant={v} state="still" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
