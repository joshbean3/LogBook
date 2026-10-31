import { decodePolyline, routePath, type ISODate } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';
import { ease } from '@/lib/motion';
import { useFirstToday } from '@/ui/useFirstToday';
import { useIsLive } from './live';

/** The route draws once, 1.1 s. */
const ROUTE_S = 1.1;

/**
 * The landed run's route, 358 × 120, in the hero under the numbers: drawn once a day (`drawKey`, the live page's own) and
 * still on every other view. The stroke is the ink; nothing glows.
 */
export const LandingRoute = ({ polyline, drawKey, date }: { polyline: string; drawKey: string | null; date: ISODate }) => {
  const live = useIsLive(date);
  return <RouteDraw key={live ? 'live' : 'still'} polyline={polyline} drawKey={live ? drawKey : null} />;
};

const RouteDraw = ({ polyline, drawKey }: { polyline: string; drawKey: string | null }) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(drawKey);
  const d = useMemo(() => routePath(decodePolyline(polyline), 358, 120, 12), [polyline]);
  if (!d) return <div className="hero-route" aria-hidden="true" />;
  return (
    <svg className="hero-route" viewBox="0 0 358 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <motion.path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" initial={first && !reduce ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { duration: ROUTE_S, ease }} />
    </svg>
  );
};
