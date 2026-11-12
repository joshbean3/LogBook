import { MessageCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type ComponentType } from 'react';
import { HEALTH_BUILT } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { Pressable } from '@/ui';
import { FitnessIcon, GoalsIcon, HabitIcon, JournalIcon, LearnedIcon, ProgressIcon, TodayIcon } from '@/ui/icons';
import { AskDemo, GoalsDemo, HabitsDemo, JournalDemo, LearnedDemo, PlanDemo, ProgressDemo, TodosDemo, type DemoProps } from './demos';
import './tour.css';

/**
 * How Logbook works, one page per part of it (first run's last step before the plan is written). Each page names the
 * place it lives, says in one line what it is for, and plays a short demo of the real gestures with the real labels.
 * Swipe or Next to move on; Skip tour (in the header) jumps to the plan. Each demo plays twice and rests on its finished
 * frame; under Reduce Motion it holds that frame from the start, with every step lit.
 */
interface Page {
  key: string;
  /** The eyebrow's glyph: the brand set's glyph for where it lives (a tab, or the habit), Lucide only where the set has none. */
  icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
  where: string;
  title: string;
  lede: string;
  Demo: (p: DemoProps) => React.JSX.Element;
}
export const TOUR_ALL: readonly Page[] = [
  { key: 'todos', icon: TodayIcon, where: 'Today', title: 'Your three that matter.', lede: 'The first three to-dos are your priorities. Check one off and the next moves up; the rest wait folded below.', Demo: TodosDemo },
  { key: 'habits', icon: HabitIcon, where: 'Today', title: 'Habits you can tap.', lede: 'Each habit is a tile on Today. Tap it when it’s done; the week fills in under it.', Demo: HabitsDemo },
  { key: 'goals', icon: GoalsIcon, where: 'Goals and Today', title: 'One goal a day.', lede: 'Set the one thing that would make today count, then break it into steps. Week, month and year goals live in Goals.', Demo: GoalsDemo },
  { key: 'journal', icon: JournalIcon, where: 'Journal', title: 'A calendar of days.', lede: 'Tap today to write a line or two. Every day you write gets its own dot, and old ones come back as Remember when.', Demo: JournalDemo },
  { key: 'learned', icon: LearnedIcon, where: 'Learned', title: 'One thing a day.', lede: 'What you learned, in a line. Kept by month, and some come back later when you need them.', Demo: LearnedDemo },
  { key: 'plan', icon: FitnessIcon, where: 'Fitness', title: 'A week you can move.', lede: 'Your runs, day by day. Life happens: hold a run and drag it to another day.', Demo: PlanDemo },
  { key: 'progress', icon: ProgressIcon, where: 'Progress', title: 'Weeks, as lines.', lede: HEALTH_BUILT ? 'Miles and pace, week by week. Connect Apple Health to add sleep, HRV and resting heart rate. Slide along any chart to read a week.' : 'Miles and pace, week by week. Slide along any chart to read a week.', Demo: ProgressDemo },
  { key: 'ask', icon: MessageCircle, where: 'Every tab', title: 'Ask, or change anything.', lede: 'The assistant answers questions and makes changes for you, and shows them to you first. It can be wrong, so check anything important.', Demo: AskDemo },
];

/** The pages a person sees: all of them, or with Fitness off (lib/prefs.ts) the ones that are not about training. */
export const tourPages = (fitness: boolean): readonly Page[] => (fitness ? TOUR_ALL : TOUR_ALL.filter((p) => p.key !== 'plan' && p.key !== 'progress'));

export const Tour = ({ page, onPage, onDone, doneLabel = 'Build my week', fitness = true }: { page: number; onPage: (p: number) => void; onDone: () => void; /** the last page's button */ doneLabel?: string; /** false: the answer to the Fitness question was No */ fitness?: boolean }) => {
  const reduce = !!useReducedMotion();
  const TOUR = tourPages(fitness);
  const p = Math.min(TOUR.length - 1, Math.max(0, page));
  const last = p === TOUR.length - 1;
  const dir = useRef(1);
  const go = (n: number) => {
    if (n < 0 || n > TOUR.length - 1 || n === p) return;
    dir.current = n > p ? 1 : -1;
    turned.current = true;
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
  // a page turn moves focus to the new page's heading (a11y-10); the arrival on the tour is the flow's own
  const turned = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!turned.current) return;
    const id = setTimeout(() => track.current?.querySelector<HTMLElement>(`.tour-page[data-key="${TOUR[p]!.key}"] h1`)?.focus({ preventScroll: true }), reduce ? 40 : 240);
    return () => clearTimeout(id);
  }, [p, reduce]);
  const pg = TOUR[p]!;
  const Icon = pg.icon;
  return (
    <div className="ob-step tour">
      <div ref={track} className="tour-track" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
          <motion.section
            key={pg.key}
            data-key={pg.key}
            className="tour-page"
            custom={dir.current}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir.current * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir.current * -40 }}
            transition={reduce ? { duration: 0.15 } : { ...springs.page, opacity: { duration: 0.14 } }}
            aria-roledescription="slide"
            aria-label={`${p + 1} of ${TOUR.length}: ${pg.title}`}
          >
            <span className="caps tour-eyebrow">
              <Icon size={15} aria-hidden="true" />
              {pg.where}
            </span>
            <h1 className="tour-title display" tabIndex={-1}>
              {pg.title}
            </h1>
            <p className="tour-lede">{pg.lede}</p>
            <pg.Demo running still={reduce} plain={!fitness} />
          </motion.section>
        </AnimatePresence>
      </div>
      <div className="ob-foot tour-foot">
        {/* where you are, not a control: Next and swipe do the paging (a11y-10, onboarding-19) */}
        <div className="tour-dots" role="img" aria-label={`Page ${p + 1} of ${TOUR.length}`}>
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
