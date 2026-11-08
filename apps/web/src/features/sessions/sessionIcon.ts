import { isFastRun, isHardRun, isRace, type Session } from '@logbook/shared';
import { Bike, Dumbbell, Flag, Footprints, Gauge, Moon, Route, Zap, type LucideIcon } from 'lucide-react';

/**
 * The glyph of a session's icon tile (docs/shape-system.md §3: a 32 px icon tile before a row's title), drawn in the
 * session's tone: a rest is a moon, a lift a dumbbell, cross training a bike; a run says its kind (race, tempo, fast reps,
 * the long run, an easy run).
 */
export const sessionIcon = (s: Pick<Session, 'kind' | 'type' | 'title'> | null): LucideIcon => {
  if (!s) return Footprints;
  if (s.kind === 'rest') return Moon;
  if (s.kind === 'lift') return Dumbbell;
  if (s.kind === 'cross') return Bike;
  if (isRace(s.type) || /^race\b/i.test(s.title ?? '')) return Flag;
  if (isHardRun(s.type)) return Zap;
  if (isFastRun(s.type)) return Gauge;
  if (/long/i.test(s.type ?? '')) return Route;
  return Footprints;
};
