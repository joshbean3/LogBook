import type * as React from 'react';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { useFitness } from '@/lib/prefs';
import { PushedBar } from '@/ui';
import { AppleHealthGroup } from './AppleHealth';
import { StravaDisconnectPill, StravaGroup } from './StravaSource';

/**
 * /settings/connections, "Data sources": where health numbers (and, in a build with a run source, runs) come from. Each source
 * is drawn only when the build has it (lib/features.ts). The route keeps its old name so links still land here.
 */
export const DataSourcesPage = (): React.JSX.Element => {
  // a run source belongs to Fitness: with it off (lib/prefs.ts) the page is Apple Health alone. The build flag stays first
  // in each test, so a build without the source still drops its code
  const fitness = useFitness();
  return (
    <div className="page s-set s-sub">
      <PushedBar title="Data sources" />
      {STRAVA_BUILT && fitness ? <StravaGroup /> : null}
      {HEALTH_BUILT ? <AppleHealthGroup /> : null}
      {STRAVA_BUILT && fitness ? <StravaDisconnectPill /> : null}
    </div>
  );
};
