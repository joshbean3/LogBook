import { haptics } from '@/lib/haptics';

/**
 * @deprecated The burst, sparks and points are gone (docs/system.md §5). `features/dayplan/PlanDay.tsx` still imports these,
 * so they stay as no-ops until it drops them: `Burst` draws nothing, `celebrateOnce` keeps the one haptic per finish.
 */
export const Burst = (_p: { go: number; big?: boolean }): null => null;

let celebrated = '';
/** A goal shows in more than one place: its `success` haptic plays once per finish. */
export const celebrateOnce = (key: string, _big?: boolean) => {
  if (celebrated === key) return;
  celebrated = key;
  haptics.success();
};
