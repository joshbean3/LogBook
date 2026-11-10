import { describe, expect, it } from 'vitest';
import { tileStatus, trendTone } from './context';

describe('progress context row', () => {
  it('reads a status as a check, an arrow or not yet', () => {
    const base = { value: 20, hasData: true, variant: {} };
    expect(trendTone({ ...base, standing: 'within' })).toBe('ok');
    expect(trendTone({ ...base, standing: 'above' })).toBe('up');
    expect(trendTone({ ...base, standing: 'below' })).toBe('down');
    // pace: faster (below) points up, the way the chart draws it
    expect(trendTone({ ...base, standing: 'below', variant: { invert: true } })).toBe('up');
    expect(trendTone({ ...base, standing: null })).toBe('none');
    expect(trendTone({ ...base, value: null, standing: 'within' })).toBe('none');
    expect(tileStatus('Building your normal: 9 of 14 days')).toBe('Learning 9/14');
    expect(tileStatus('Above your usual')).toBe('Above your usual');
  });
});
