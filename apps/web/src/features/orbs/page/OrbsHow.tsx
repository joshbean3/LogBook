import type * as React from 'react';
import { useFitness } from '@/lib/prefs';
import { PushedBar } from '@/ui/NavBar';
import { useWeekTarget } from '../store';
import { HowBody } from './HowBody';
import { useLeaveWhenOff } from './useLeaveWhenOff';
import './orbs.css';

/** How Orbs work (`/orbs/how`, pushed over the Orbs page): the rules on one page. With Orbs off it leads to Today. */
export default function OrbsHow(): React.JSX.Element {
  const on = useLeaveWhenOff();
  const fitness = useFitness();
  const target = useWeekTarget();
  return (
    <div className="page orp-page orh-page">
      <PushedBar title="How Orbs work" />
      {on ? <HowBody fitness={fitness} target={target} /> : null}
    </div>
  );
}
