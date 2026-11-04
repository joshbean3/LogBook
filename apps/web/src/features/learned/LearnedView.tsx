import type * as React from 'react';
import { today } from '@logbook/shared';
import { dayCaption, NavBar } from '@/ui/NavBar';

/** What I learned (the tab root). Placeholder while the tab is built. */
export default function LearnedView(): React.JSX.Element {
  const t = today();
  return (
    <div className="page">
      <NavBar caps={{ cur: dayCaption(t, t) }} title={{ cur: 'What I learned' }} gap={24} />
    </div>
  );
}
