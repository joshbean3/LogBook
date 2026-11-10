import { Activity, BookOpen, CalendarDays, Lightbulb, ListChecks, Sparkles, Sun, Target, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { HEALTH_BUILT } from '@/lib/features';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { Pressable } from '@/ui';
import { AskDemo, GoalsDemo, HabitsDemo, JournalDemo, LearnedDemo, PlanDemo, ProgressDemo, TodosDemo, type DemoProps } from './demos';
import './tour.css';

/**
 * How Logbook works, one page per part of it (first run's last step before the plan is written). Each page names the
 * place it lives, says in one line what it is for, and plays a short demo of the real gestures with the real labels.
 * Swipe or Next to move on; Skip (in the header) jumps to the plan. Under Reduce Motion each demo holds its finished
 * frame with every step lit.
 */
interface Page {
  key: string;
  icon: LucideIcon;
  where: string;
  title: string;
  lede: string;
  Demo: (p: DemoProps) => React.JSX.Element;
}
export const TOUR: readonly Page[] = [
  { key: 'todos', icon: ListChecks, where: 'Today', title: 'Your three that matter.', lede: 'The first three to-dos are your priorities. Check one off and the next moves up; the rest wait folded below.', Demo: TodosDemo },
  { key: 'habits', icon: Sun, where: 'Today', title: 'Habits, as lights.', lede: 'Each habit is a light on Today. Light it when it’s done; the week fills in under it.', Demo: HabitsDemo },
  { key: 'goals', icon: Target, where: 'Goals and Today', title: 'One goal a day.', lede: 'Set the one thing that would make today count, then break it into steps. Week, month and year goals live in Goals.', Demo: GoalsDemo },
  { key: 'journal', icon: BookOpen, where: 'Journal', title: 'A calendar of days.', lede: 'Tap today to write a line or two. Every day you write gets its own orb, and old ones come back as Remember when.', Demo: JournalDemo },
  { key: 'learned', icon: Lightbulb, where: 'Learned', title: 'One thing a day.', lede: 'What you learned, in a line. Kept by month, and some come back later when you need them.', Demo: LearnedDemo },
  { key: 'plan', icon: CalendarDays, where: 'Plan', title: 'A week you can move.', lede: 'Your runs, day by day. Life happens: hold a run and drag it to another day.', Demo: PlanDemo },
  { key: 'progress', icon: Activity, where: 'Progress', title: 'Weeks, as lines.', lede: HEALTH_BUILT ? 'Miles and pace, week by week. Connect Apple Health to add sleep, HRV and resting heart rate. Slide along any chart to read a week.' : 'Miles and pace, week by week. Slide along any chart to read a week.', Demo: ProgressDemo },
  { key: 'ask', icon: Sparkles, where: 'Every tab', title: 'Ask, or change anything.', lede: 'The assistant is AI. It answers questions and makes changes for you, and shows them to you first. It can be wrong, so check anything important.', Demo: AskDemo },
];

export const Tour = ({ page, onPage, onDone }: { page: number; onPage: (p: number) => void; onDone: () => void }) => {
  const reduce = !!useReducedMotion();
  const p = Math.min(TOUR.length - 1, Math.max(0, page));
  const last = p === TOUR.length - 1;
  const dir = useRef(1);
  const go = (n: number) => {
    if (n < 0 || n > TOUR.length - 1 || n === p) return;
    dir.current = n > p ? 1 : -1;
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
  const pg = TOUR[p]!;
  const Icon = pg.icon;
  return (
    <div className="ob-step tour">
      <div className="tour-track" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
          <motion.section
            key={pg.key}
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
              <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
              {pg.where}
            </span>
            <h1 className="tour-title display">{pg.title}</h1>
            <p className="tour-lede">{pg.lede}</p>
            <pg.Demo running still={reduce} />
          </motion.section>
        </AnimatePresence>
      </div>
      <div className="ob-foot tour-foot">
        <div className="tour-dots" role="tablist" aria-label="Tour">
          {TOUR.map((t, i) => (
            <span key={t.key} className={i === p ? 'tis-on' : ''} role="tab" aria-selected={i === p} aria-label={t.title} onClick={() => go(i)} />
          ))}
        </div>
        <Pressable className="btn primary block ob-cta" onPress={() => (last ? onDone() : go(p + 1))}>
          {last ? 'Build my week' : 'Next'}
        </Pressable>
      </div>
    </div>
  );
};
