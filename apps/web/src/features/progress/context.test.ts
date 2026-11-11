import { describe, expect, it } from 'vitest';
import { splitTileUnit, tileContext, tileStatus, trendTone } from './context';

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

  it('splits a tile unit into its unit and window', () => {
    expect(splitTileUnit('mi, 7 days', 'mi')).toEqual({ unit: 'mi', window: '7 days' });
    expect(splitTileUnit('%, 14 days', '%')).toEqual({ unit: '%', window: '14 days' });
    expect(splitTileUnit(undefined, 'bpm')).toEqual({ unit: 'bpm', window: null });
  });

  it('gives a tile one context line: off your usual with its triangle, else the window, else the status', () => {
    const on = { value: 20, hasData: true };
    expect(tileContext({ ...on, standing: 'above' }, 'Above your usual', '7 days')).toEqual({ text: 'Above usual', dir: 'up', hi: true });
    expect(tileContext({ ...on, standing: 'below' }, 'Faster than usual', null)).toEqual({ text: 'Faster than usual', dir: 'down', hi: true });
    expect(tileContext({ ...on, standing: 'within' }, 'Usual range', '7 days')).toEqual({ text: 'Last 7 days' });
    expect(tileContext({ ...on, standing: 'within' }, 'Usual range', null)).toEqual({ text: 'Usual range' });
    expect(tileContext({ ...on, standing: null }, 'Building your normal: 2 of 14 days', null)).toEqual({ text: 'Learning 2/14' });
    expect(tileContext({ value: null, hasData: false, standing: null }, 'No runs yet', '7 days')).toEqual({ text: 'Last 7 days' });
    expect(tileContext({ value: null, hasData: false, standing: null }, 'Not connected', null)).toEqual({ text: 'Not connected' });
  });
});
