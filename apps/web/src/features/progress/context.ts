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
