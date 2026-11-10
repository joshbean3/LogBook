import type * as React from 'react';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { PushedBar } from '@/ui';
import { AppleHealthGroup } from './AppleHealth';
import { StravaDisconnectPill, StravaGroup } from './StravaSource';

/**
 * /settings/connections, "Data sources": where health numbers (and, in a build with a run source, runs) come from. Each source
 * is drawn only when the build has it (lib/features.ts). The route keeps its old name so links still land here.
 */
export const DataSourcesPage = (): React.JSX.Element => (
  <div className="page s-set s-sub">
    <PushedBar title="Data sources" />
    {STRAVA_BUILT ? <StravaGroup /> : null}
    {HEALTH_BUILT ? <AppleHealthGroup /> : null}
    {STRAVA_BUILT ? <StravaDisconnectPill /> : null}
  </div>
);
