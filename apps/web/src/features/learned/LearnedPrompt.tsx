import type { ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { useNav } from '@/app/NavController';
import { LearnedIcon } from '@/ui/icons';
import { SectionHeader } from '@/ui/layout';
import { Row } from '@/ui/primitives';
import { keptOn, rowsOf, useLearnings, useLearningStats } from './queries';

/**
 * Today's way into What I learned (a Today section, lib/prefs.ts): one row that asks the day's question and opens the
 * Learned tab, where the line is written. Its second line is the poster's own ("One line is enough"; once today has its
 * line, "Tonight's line is kept"). Built from the list row every screen uses; the Learned poster is not copied here.
 */
export const LearnedPrompt = ({ today }: { today: ISODate }): React.JSX.Element => {
  const nav = useNav();
  const stats = useLearningStats();
  // the month's lines are read from what is already loaded; they are only asked for when the stats do not name the days
  // (a server from before they did), so the row is right there too
  const list = useLearnings({ month: today.slice(0, 7) }, !!stats.data && !Array.isArray(stats.data.recent));
  const wrote = keptOn(today, stats.data, rowsOf(list.data));
  const sub = wrote ? 'Tonight’s line is kept' : 'One line is enough';
  return (
    <section className="day-learned" aria-label="What I learned">
      <SectionHeader title="What I learned" />
      <div className="group">
        <Row
          left={
            <span className="icon-tile" aria-hidden="true">
              <LearnedIcon size={18} />
            </span>
          }
          title="What did you learn today?"
          sub={sub}
          right={<ChevronRight size={18} className="day-learned-chev" aria-hidden="true" />}
          onClick={() => nav.go('/learned')}
          label={`What did you learn today? ${sub}. Opens Learned`}
        />
      </div>
    </section>
  );
};
