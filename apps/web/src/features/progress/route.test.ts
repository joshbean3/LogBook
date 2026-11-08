import { describe, expect, it } from 'vitest';
import { matchRoute } from '@/ui/nav';
import { isMetricId, METRIC_IDS, METRICS } from './metrics';

describe('the metric page route', () => {
  it('pushes a metric page over Progress, titled with the metric', () => {
    const m = matchRoute('/progress/metric/hrv');
    expect(m.kind).toBe('pushed');
    expect(m.tab).toBe('progress');
    expect(m.root).toBe('/progress');
    expect(m.stack.map((e) => e.title)).toEqual(['HRV']);
    expect(m.params.id).toBe('hrv');
  });

  it('titles every metric the way its page names it', () => {
    for (const id of METRIC_IDS) expect(matchRoute(`/progress/metric/${id}`).stack[0]!.title).toBe(METRICS[id].name);
  });

  it('knows its ids', () => {
    expect(isMetricId('pace')).toBe(true);
    expect(isMetricId('steps')).toBe(false);
    expect(isMetricId(undefined)).toBe(false);
  });
});
