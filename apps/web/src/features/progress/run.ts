/** The run detail sheet's numbers: laps, heart-rate zones on the chart, where the effort sits. Pure; display only. */
import { METERS_PER_MILE, zoneOf, type Effort, type HrZone, type Lap } from '@logbook/shared';
import type { ChartZone } from '@/ui/charts';

export interface LapRow {
  n: number;
  miles: number;
  /** Seconds per mile. */
  pace: number;
  hr: number | null;
  zone: number | null;
  /** A short lap (the last bit of a run): its distance is shown instead of its number. */
  part: boolean;
}

/** Strava's laps as rows: a lap under 0.1 mi (a stop-start) is left out. */
export const lapRows = (laps: Lap[] | null | undefined, zones: HrZone[] | null | undefined): LapRow[] =>
  (laps ?? [])
    .filter((l) => l[0] > 160 && l[1] > 0)
    .map((l, i) => {
      const miles = l[0] / METERS_PER_MILE;
      return { n: i + 1, miles, pace: l[1] / miles, hr: l[2], zone: l[2] != null ? zoneOf(zones, l[2]) : null, part: l[0] < 0.9 * METERS_PER_MILE };
    });

/** The zones as shaded bands that meet (129–148 and 149–160 leave no gap); the open top zone gets a band 20 bpm tall. */
export const chartZones = (zones: HrZone[] | null | undefined): ChartZone[] =>
  [...(zones ?? [])].sort((a, b) => a.zone - b.zone).map((z) => ({ lo: z.min - 0.5, hi: (z.max ?? z.min + 20) + 0.5, label: `Z${z.zone}` }));

/**
 * Where a heart rate sits on the half gauge: 0 at the bottom of zone 1, 1 at the top of zone 5 (or the run's max when the
 * top zone is open). Null without zones or a heart rate.
 */
export const hrShare = (zones: HrZone[] | null | undefined, hr: number | null, maxHr: number | null): number | null => {
  if (!zones?.length || hr == null) return null;
  const s = [...zones].sort((a, b) => a.zone - b.zone);
  const lo = s[0]!.min;
  const top = s[s.length - 1]!;
  const hi = top.max ?? Math.max(top.min + 20, maxHr ?? 0);
  return hi > lo ? Math.min(1, Math.max(0, (hr - lo) / (hi - lo))) : null;
};

/** The band of a zone on the same gauge (zone 2 for an easy run). */
export const zoneShare = (zones: HrZone[] | null | undefined, zone: number, maxHr: number | null): [number, number] | null => {
  const z = zones?.find((x) => x.zone === zone);
  if (!z) return null;
  const a = hrShare(zones, z.min, maxHr);
  const b = hrShare(zones, z.max ?? z.min + 20, maxHr);
  return a != null && b != null ? [a, b] : null;
};

/** The effort word against the plan, when there was a plan to hold it to. */
export const effortWord = (e: Effort | null): string | null => (e === 'on' ? 'On target' : e === 'easy' ? 'Easier than planned' : e === 'hard' ? 'Harder than planned' : null);
