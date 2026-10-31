/**
 * @deprecated Reads are gone from navigation (docs/system.md §2) and this folder with them. `features/day/CloseDay.tsx`
 * still lazy-loads `TodaysPick`, so this one export stays, rendering nothing, until that import is removed.
 */
export const TodaysPick = (_p: { compact?: boolean }): null => null;
