import { STREAK_MILESTONES } from '@logbook/shared';
import { motion } from 'motion/react';
import { haptics } from '@/lib/haptics';
import { useReduced } from '@/lib/motion';
import './goals.css';

/**
 * The burst when something is finished: a ring of light thrown out from the centre, sparks after it in the accent, amber and
 * white (500 ms; 700 ms and wider when `big`). Reduced motion: nothing moves; the finished state says it.
 */
export const Burst = ({ go, big }: { go: number; big?: boolean }) => {
  const reduce = useReduced();
  if (!go || reduce) return null;
  const n = big ? 18 : 12;
  const r = big ? 46 : 28;
  return (
    <span className="g-burst" aria-hidden="true" key={go}>
      <motion.b className="g-wave" initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: big ? 3.2 : 2.2, opacity: 0 }} transition={{ duration: big ? 0.75 : 0.55, ease: [0.22, 1, 0.36, 1] }} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 2 ? 0.18 : 0);
        const d = r * (i % 2 ? 0.72 : 1);
        return <motion.i key={i} className={i % 3 === 0 ? 'warm' : i % 3 === 1 ? 'white' : ''} initial={{ x: 0, y: 0, opacity: 1, scale: 1.1 }} animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 0.3 }} transition={{ duration: big ? 0.75 : 0.5, ease: [0.22, 1, 0.36, 1] }} />;
      })}
    </span>
  );
};

/** A goal shows in more than one place (Today and the Goals tab stay mounted): its haptic plays once per finish. */
let celebrated = '';
export const celebrateOnce = (key: string, big: boolean) => {
  if (celebrated === key) return;
  celebrated = key;
  if (big) haptics.celebrate();
  else haptics.success();
};

export const isMilestone = (n: number) => (STREAK_MILESTONES as readonly number[]).includes(n);
