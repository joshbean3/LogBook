import { fmtDate, shiftDays, type Learning, type LearningStats } from '@logbook/shared';
import { Check } from 'lucide-react';
import { animate, motion, motionValue, useMotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { hapticAtPeak } from '@/lib/haptics';
import { reducedFade, springs, useReduced } from '@/lib/motion';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useLearnings } from './queries';

/** The seven days the tracker shows: six days ago (left) to today (right). */
export const lastSeven = (today: string): string[] => Array.from({ length: 7 }, (_, i) => shiftDays(today, i - 6));

const NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const letterOf = (d: string) => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return NARROW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
};

const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

/**
 * The tracker's one VoiceOver label (layout plan 2.3): the count, "Not yet today" while today is unlit, then the days that
 * are lit by name ("Monday, Tuesday and today"). The count's words match what is printed.
 */
export const streakWords = (streak: number, lit: ReadonlySet<string>, today: string): string => {
  const before = lastSeven(today).filter((d) => d !== today && lit.has(d));
  const head = streak ? `${streak} ${streak === 1 ? 'day' : 'days'} in a row.` : 'Start a streak today.';
  // at zero the first line already says today is still open
  const now = lit.has(today) || !streak ? '' : ' Not yet today.';
  const names = before.map((d) => fmtDate('dowLong', d));
  const learned = lit.has(today)
    ? names.length
      ? ` Learned on ${LIST.format([...names, 'today'])}.`
      : ' Learned today.'
    : names.length
      ? ` Learned on ${LIST.format(names)}.`
      : ' Nothing learned in the last 7 days.';
  return `${head}${now}${learned}`;
};

/** The light-up's start velocity: `springs.complete` from rest at 1 overshoots to about 1.12 and back (OrbRow's POP_V). */
const POP_V = 5.5;

/**
 * The bulb: the icon set's Learned glyph (guide 7, its path unmodified) drawn at 22 px, with three short rays above it that
 * only a lit bulb shows (shape plus color, guide 3.3). The 26 unit box keeps the glyph at its own scale with room for the
 * rays; at 24 px the glyph is the guide's 22. The lit layer (the glass fill, the rays and the soft glow behind them) is its
 * own layer, so under Reduce Motion it can fade in (guide 9.4) while the outline stays put.
 */
const Bulb = () => (
  <>
    <span className="ln-bulb-glow" aria-hidden="true" />
    <svg viewBox="-1 -3 26 26" className="ln-bulb-svg" aria-hidden="true">
      <g className="ln-bulb-on">
        <path className="ln-bulb-glass" d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
        <path d="M12 -0.6v-1.9M6.2 2.6 4.9 1.3M17.8 2.6l1.3-1.3" />
      </g>
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
      <path d="M9 17.5h6M10 21h4" />
    </svg>
  </>
);

/**
 * The lightbulb streak tracker at the top of What I learned (owner request; layout plan 2.3, L 6.8 as amended): on the
 * ground, no card, read in passing like Today's week strip. Line one: the run of days ("3 days in a row", a calm line at
 * 0) and whether today is done. Line two: the last seven days as bulbs with their letters, oldest left, today right; a day
 * with a learning is lit (Apricot glass, Night Ink rays, a soft warm glow), the rest an outline, today's letter ringed.
 *
 * The count is the server's (`LearningStats.streak`, raised at once by the save's cache patch); which bulbs are lit comes
 * from this month's learnings, plus last month's only while the seven days reach back into it, so a save lights today's
 * bulb the moment it lands in the cache (optimistic). It lights with the app's completion beat (guide 9.1: one pop to about
 * 1.12 on `springs.complete`) and `orb` fires on the pop's peak frame through `hapticAtPeak`; under Reduce Motion there is no
 * pop, the light fades in over 150 ms (guide 9.4) and the haptic lands when it has, as a habit orb's does.
 * Display only: one element with one label.
 */
export const Streak = ({ today, stats, month }: { today: string; stats: LearningStats | undefined; month: { data?: { pages: Array<{ learnings: Learning[] }> }; isPending: boolean } }) => {
  const days = useMemo(() => lastSeven(today), [today]);
  const prevMonth = days[0]!.slice(0, 7) !== today.slice(0, 7) ? days[0]!.slice(0, 7) : null;
  const prev = useLearnings({ month: prevMonth }, !!prevMonth);
  const reduce = useReduced();
  const lit = useMemo(() => {
    const out = new Set<string>();
    const from = days[0]!;
    for (const q of [month.data, prevMonth ? prev.data : undefined]) for (const p of q?.pages ?? []) for (const l of p.learnings) if (l.date >= from && l.date <= today) out.add(l.date);
    return out;
  }, [month.data, prev.data, prevMonth, days, today]);
  const loading = !stats || month.isPending || (!!prevMonth && prev.isPending);
  const litToday = lit.has(today);

  // today lighting up while the tab is open (not on load): the completion beat and one haptic on its peak frame. Under
  // Reduce Motion the lit layer fades in with CSS (is-fading, set before paint so it never shows at full first) and a value
  // run over the same 150 ms times the haptic
  const was = useRef<boolean | null>(null);
  const pop = useMotionValue(1);
  const [fading, setFading] = useState(false);
  const unpeak = useRef<() => void>(() => {});
  useEffect(() => () => unpeak.current(), []);
  useLayoutEffect(() => {
    if (loading) return;
    const before = was.current;
    was.current = litToday;
    if (!litToday) {
      setFading(false);
      return;
    }
    if (before !== false) return;
    unpeak.current();
    if (reduce) {
      setFading(true);
      const fill = motionValue(0);
      unpeak.current = hapticAtPeak(fill, 'orb');
      animate(fill, 1, reducedFade);
    } else {
      unpeak.current = hapticAtPeak(pop, 'orb');
      animate(pop, 1, { ...springs.complete, velocity: POP_V });
    }
  }, [litToday, loading, reduce, pop]);

  if (loading)
    return (
      <SkeletonGroup label="Loading the streak" className="ln-streak">
        <div className="ln-streak-head">
          <Skeleton w={140} h={18} />
        </div>
        <ol className="ln-bulbs">
          {days.map((d) => (
            <li key={d} className="ln-bulb">
              <span className="ln-bulb-glyph">
                <Skeleton circle h={22} />
              </span>
              <span className="ln-bulb-day">{letterOf(d)}</span>
            </li>
          ))}
        </ol>
      </SkeletonGroup>
    );

  const streak = stats.streak;
  return (
    <section className="ln-streak" role="img" aria-label={streakWords(streak, lit, today)}>
      <div className="ln-streak-head" aria-hidden="true">
        {streak ? (
          <span className="ln-streak-count">
            <b className="tnum">{streak}</b> {streak === 1 ? 'day' : 'days'} in a row
          </span>
        ) : (
          <span className="ln-streak-count is-zero">Start a streak today</span>
        )}
        {streak ? (
          litToday ? (
            <span className="ln-streak-today is-done">
              <Check size={18} aria-hidden="true" /> Done today
            </span>
          ) : (
            <span className="ln-streak-today">Not yet today</span>
          )
        ) : null}
      </div>
      <ol className="ln-bulbs" aria-hidden="true">
        {days.map((d) => {
          const on = lit.has(d);
          const isToday = d === today;
          return (
            <li key={d} className={`ln-bulb ${on ? 'is-lit' : ''} ${isToday ? 'is-today' : ''} ${isToday && fading ? 'is-fading' : ''}`.replace(/\s+/g, ' ').trim()}>
              {isToday ? (
                <motion.span className="ln-bulb-glyph" style={{ scale: pop }}>
                  <Bulb />
                </motion.span>
              ) : (
                <span className="ln-bulb-glyph">
                  <Bulb />
                </span>
              )}
              <span className="ln-bulb-day">{letterOf(d)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
