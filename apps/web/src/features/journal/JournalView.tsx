import { useCallback, useState } from 'react';
import { SectionBoundary } from '@/app/ErrorBoundary';
import { useToday } from '@/lib/useToday';
import { dayCaption, NavBar } from '@/ui';
import { JournalCalendarPane } from './JournalPane';
import { RecallCard } from './RecallCard';
import './journal.css';

/**
 * Journal (layout standard 2.8): the NavBar (the date in caps, the title `Journal`, nothing trailing), then Remember when,
 * the calendar and the entries, in that order. One page: the Library and its Entries / Library switch were removed at the
 * owner's request, so nothing sits between the title and Remember when but the title block's 16.
 */
export default function JournalView() {
  const today = useToday();
  // Remember when's words open their day under the calendar
  const [openDay, setOpenDay] = useState<{ date: string; n: number } | null>(null);
  const openRecalled = useCallback((date: string) => setOpenDay((r) => ({ date, n: (r?.n ?? 0) + 1 })), []);
  return (
    <div className="page journal-page">
      <NavBar caps={{ cur: dayCaption(today, today) }} title={{ cur: 'Journal' }} gap={16} />
      <SectionBoundary name="journal.recall"><RecallCard today={today} onOpenDay={openRecalled} /></SectionBoundary>
      <SectionBoundary name="journal.calendar"><JournalCalendarPane today={today} openDay={openDay} /></SectionBoundary>
    </div>
  );
}
