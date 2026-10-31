/**
 * @deprecated The Journal home (ribbon, memory card, timeline) is gone: the logbook is `JournalView.tsx` and `JournalDay.tsx`.
 * `features/day/CloseDay.tsx` still lazy-loads `QuoteLine` from here, so it is re-exported until that import moves.
 */
export { QuoteLine, asPrompt } from './JournalDay';
