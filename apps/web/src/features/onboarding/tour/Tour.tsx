import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { Pressable } from '@/ui';
import { AskDemo, FitnessDemo, GoalsDemo, JournalDemo, TodayDemo, type DemoProps } from './demos';
import './tour.css';

/**
 * How Orby works, one page per place: Today, Goals, Fitness, Journal and the assistant. Each page is headed with the
 * place's own name, set as the tab sets it, says in one line what the place is for, and plays a short demo of the real
 * page, drawn with the page's own parts at their own sizes, with the one thing to tap. Swipe or Next to move on. Each demo
 * plays twice and rests on its finished frame; under Reduce Motion it holds that frame from the start, with every step lit.
 *
 * `Tour` is the pages, the dots and the button. The screen round it (the bar with Back and Skip tour) is the caller's:
 * first run's own (Welcome.tsx), or `TourScreen` when the tour is opened by itself.
 */
export type TourKey = 'today' | 'goals' | 'plan' | 'journal' | 'ask';
export interface TourPage {
  key: TourKey;
  /** The place, named as its tab names it: the page's headline. */
  title: string;
  /** What the place is for, in one line. */
  lede: string;
  Demo: (p: DemoProps) => React.JSX.Element;
}
export const TOUR_ALL: readonly TourPage[] = [
  { key: 'today', title: 'Today', lede: 'One goal, your to-dos and your habits.', Demo: TodayDemo },
  { key: 'goals', title: 'Goals', lede: 'Today’s goal first, then further out.', Demo: GoalsDemo },
  // one page for training (its key keeps the tab's old name): what is next, then how it is going
  { key: 'plan', title: 'Fitness', lede: 'What is next, and how it is going.', Demo: FitnessDemo },
  { key: 'journal', title: 'Journal', lede: 'One line a day is enough.', Demo: JournalDemo },
  { key: 'ask', title: 'The assistant', lede: 'It answers, and makes changes you approve. It can be wrong, so check anything important.', Demo: AskDemo },
];

/** The pages a person sees: all five, or with Fitness off (lib/prefs.ts) the four that are not about training. */
export const tourPages = (fitness: boolean): readonly TourPage[] => (fitness ? TOUR_ALL : TOUR_ALL.filter((p) => p.key !== 'plan'));
/** The page a number names, held inside the pages there are (a page kept from a longer tour lands on the last one). */
export const tourPage = (page: number, count: number): number => Math.min(Math.max(0, count - 1), Math.max(0, Number.isFinite(page) ? Math.floor(page) : 0));
/** What the dots say to VoiceOver: "Page 2 of 5". */
export const dotsLabel = (page: number, count: number): string => `Page ${tourPage(page, count) + 1} of ${count}`;

export const Tour = ({ page, onPage, onDone, doneLabel = 'Build my week', fitness = true }: { page: number; onPage: (p: number) => void; onDone: () => void; /** the last page's button */ doneLabel?: string; /** false: Fitness is off (the answer to the Fitness question was No) */ fitness?: boolean }) => {
  const reduce = !!useReducedMotion();
  const TOUR = tourPages(fitness);
  const p = tourPage(page, TOUR.length);
  const last = p === TOUR.length - 1;
  const dir = useRef(1);
  const go = (n: number) => {
    if (n < 0 || n > TOUR.length - 1 || n === p) return;
    dir.current = n > p ? 1 : -1;
    mine.current = true;
    // the page turn's one haptic: the demos play in silence
    haptics.select();
    onPage(n);
  };
  // a horizontal swipe on the page turns it (the edge swipe stays the flow's own Back, from the left 24 px)
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.clientX <= 24) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(e.clientY - s.y) * 1.5) return;
    go(dx < 0 ? p + 1 : p - 1);
  };
  // a page turn moves focus to the new page's heading (a11y-10); the arrival on the tour is the caller's. The page may
  // also be turned from outside (the screen's Back), so the turn is read off the page number
  const turned = useRef(false);
  const mine = useRef(false);
  const was = useRef(p);
  if (was.current !== p) {
    if (!mine.current) dir.current = p > was.current ? 1 : -1;
    mine.current = false;
    turned.current = true;
    was.current = p;
  }
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!turned.current) return;
    const id = setTimeout(() => track.current?.querySelector<HTMLElement>(`.tour-page[data-key="${TOUR[p]!.key}"] h1`)?.focus({ preventScroll: true }), reduce ? 40 : 240);
    return () => clearTimeout(id);
  }, [p, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  const pg = TOUR[p]!;
  return (
    <div className="ob-step tour">
      <div ref={track} className="tour-track" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
          <motion.section
            key={pg.key}
            data-key={pg.key}
            className={`tour-page${reduce ? ' tis-still' : ''}`}
            custom={dir.current}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir.current * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir.current * -40 }}
            transition={reduce ? { duration: 0.15 } : { ...springs.page, opacity: { duration: 0.14 } }}
            aria-roledescription="slide"
            aria-label={`${p + 1} of ${TOUR.length}: ${pg.title}`}
          >
            <h1 className="tour-title" tabIndex={-1}>
              {pg.title}
            </h1>
            <p className="tour-lede">{pg.lede}</p>
            <pg.Demo running still={reduce} plain={!fitness} />
          </motion.section>
        </AnimatePresence>
      </div>
      <div className="ob-foot tour-foot">
        {/* where you are, not a control: Next and swipe do the paging (a11y-10, onboarding-19) */}
        <div className="tour-dots" role="img" aria-label={dotsLabel(p, TOUR.length)}>
          {TOUR.map((t, i) => (
            <span key={t.key} className={i === p ? 'tis-on' : ''} aria-hidden="true" />
          ))}
        </div>
        <Pressable className="btn primary block ob-cta" onPress={() => (last ? onDone() : go(p + 1))}>
          {last ? doneLabel : 'Next'}
        </Pressable>
      </div>
    </div>
  );
};
