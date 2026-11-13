import type * as React from 'react';
import { FitnessSample, JournalSample, TodaySample } from '@/features/onboarding/cards';

/** "to-dos" never breaks at its hyphen. */
const TODOS = <span className="start-nw">to-dos</span>;

/**
 * The welcome pager's pages: one per place the person is about to enter (Today, Fitness, Journal), each the tab's own
 * poster with sample content (features/onboarding/cards.tsx), a serif headline in Orby's voice and one plain line. The
 * assistant is not a page: its bar sits under the posters on every page, as the dock does in the app, and the last
 * page's line says what it does.
 */
export const PAGES: readonly { key: string; Card: (p: { live: boolean }) => React.JSX.Element; title: string; sub: React.ReactNode }[] = [
  // page 1 says what Orby is, in one plain line (auth-13)
  { key: 'today', Card: TodaySample, title: 'Your day, lit.', sub: <>Orby is your day in one place: a goal, your {TODOS}, your training and a journal.</> },
  { key: 'fitness', Card: FitnessSample, title: 'A plan that fits.', sub: 'Runs and workouts planned around your week, and a clear view of how it is going.' },
  { key: 'journal', Card: JournalSample, title: 'One line a day.', sub: 'Keep what you learned in a line. Ask the assistant to change your plan any time.' },
];
