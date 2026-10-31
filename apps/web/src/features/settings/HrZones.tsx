import type { HrZone } from '@logbook/shared';
import type * as React from 'react';
import { Row } from '@/ui';

/** "Easy under 145 bpm · Threshold 146–172 · Speed from 173", or null when the zones that line needs are missing. */
export const zoneLine = (z: HrZone[] | null | undefined): string | null => {
  const Z = (n: number) => z?.find((r) => r.zone === n);
  const z2 = Z(2);
  const z3 = Z(3);
  const z4 = Z(4);
  if (!z2?.max || !z3 || !z4?.max) return null;
  // speed starts where threshold ends (zone 5), so the three ranges never overlap
  return `Easy under ${z2.max} bpm · Threshold ${z3.min}–${z4.max} · Speed from ${Z(5)?.min ?? z4.max + 1}`;
};

/**
 * Heart-rate zones, beside Strava (they were the old Trends page's Effort section; Progress reads easy runs by them): the
 * zones in one line and where they come from. They ride along with a sync (Connections' `Sync now`).
 */
export const HrZonesRow = ({ zones, connected }: { zones: HrZone[] | null; connected: boolean }): React.JSX.Element | null => {
  const line = zoneLine(zones);
  if (!connected && !line) return null;
  return (
    <Row
      className="s-wrap s-zones"
      title="Heart-rate zones"
      sub={
        line ? (
          <>
            <span className="s-zones-line">{line}.</span> From Strava with each sync; Progress reads your easy runs by them.
          </>
        ) : (
          'None yet. Sync and they come in with your runs.'
        )
      }
    />
  );
};
