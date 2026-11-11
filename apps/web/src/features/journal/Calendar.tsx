import { fmtDate, parseISO, type JournalEntry } from '@logbook/shared';
import { ChevronLeft, ChevronRight, PenLine, Plus } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { Pressable, Segmented, Skeleton } from '@/ui';
import { Disc, type DiscTone } from '@/ui/Disc';
import { FavoriteIcon } from '@/ui/icons';
import { dayLabel, monthGrid, ORB_KEY, orbVariant, pageBy, pageHolds, pageTitle, weekDays, type CalView, type OrbVariant } from './calDays';

/** The guide's entry marks (12.1): one entry a Haze disc ringed in Deep Sky, two `--entry-2`, three or more Sky, a Favorite Deep Sky. */
const TONE: Record<Exclude<OrbVariant, 'brand'>, DiscTone> = { sky: 'haze', dusk: 'two', tide: 'sky', sun: 'deep' };

/**
 * A day's mark: a flat disc in the tone its entries pick (calDays.ts `orbVariant`), never the Orb (guide 2.1). The count is
 * the numeral inside it and a Favorite carries a heart instead, so the tone is never the only signal (guide 3.3). With no
 * variant it is the empty Haze disc of "Write today's entry".
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
 * the days. A day with entries wears a flat disc in its tone with the count inside it (a heart on a day with a
 * favorite), so nothing rests on color alone; a day without is a plain number. Today is ringed and, until it has an
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
  const markSize = view === 'week' ? 22 : 18;
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
                  <DayDisc variant={variant} size={markSize} n={n} />
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
          <DayDisc variant={null} size={26} />
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
          {ORB_KEY.map(({ v, label }, i) => (
            <li key={v}>
              <DayDisc variant={v} size={18} n={i + 1} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
