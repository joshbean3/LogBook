/**
 * Progress's status words (docs/shape-system.md §2): how a metric's status reads on a tile. Pure: the page and the tests
 * share them.
 */
import type { TrendTone } from '@/ui/charts';
import type { MetricModel } from './metrics';

/** How a metric's status reads on its tile: navy with a check on your usual, orange with an arrow off it, grey before then. */
export const trendTone = (m: Pick<MetricModel, 'standing' | 'value' | 'hasData'> & { variant: { invert?: boolean } }): TrendTone => {
  if (!m.hasData || m.value == null || !m.standing) return 'none';
  if (m.standing === 'within') return 'ok';
  // pace: a smaller number is up the chart, so "below" (faster) points up, the way the line goes
  const up = m.standing === 'above';
  return (m.variant.invert ? !up : up) ? 'up' : 'down';
};

/** A tile says the learning period on one line, with its count: "Learning 9/14". */
export const tileStatus = (status: string) => status.replace(/^Building your normal: (\d+) of (\d+) days$/, 'Learning $1/$2');

/** A tile's unit and window from its variant's tile unit: "mi, 7 days" is the unit "mi" over "7 days". */
export const splitTileUnit = (tileUnit: string | undefined, unit: string): { unit: string; window: string | null } => {
  const m = /^(.*?),\s*(\d+ days?)$/.exec(tileUnit ?? '');
  return m ? { unit: m[1]!, window: m[2]! } : { unit: tileUnit ?? unit, window: null };
};

/** Off your usual, said short for a tile's one context line ("Above your usual" reads "Above usual"). */
const shortStatus = (s: string) => s.replace(/^(Above|Below) your usual$/, '$1 usual');

/**
 * A stat tile's one context line (layout standard 6.3): off your usual, the status with a triangle that points the way the
 * number went (Night Ink 600, never Deep Sky); otherwise the window the number covers ("Last 7 days"), or the status when
 * there is no window (Health: "Usual range", "Learning 9/14", "Not connected").
 */
export const tileContext = (m: Pick<MetricModel, 'standing' | 'value' | 'hasData'>, status: string, window: string | null): { text: string; dir?: 'up' | 'down'; hi?: boolean } => {
  const off = m.hasData && m.value != null && (m.standing === 'above' || m.standing === 'below');
  if (off) return { text: shortStatus(tileStatus(status)), dir: m.standing === 'above' ? 'up' : 'down', hi: true };
  // the window, with a number or without one ("None yet" over "Last 7 days" says the same thing once)
  if (window) return { text: `Last ${window}` };
  return { text: tileStatus(status) };
};
