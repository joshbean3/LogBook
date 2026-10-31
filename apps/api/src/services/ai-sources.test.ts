import { describe, expect, it } from 'vitest';
import { aiExcludedProviders, aiSourcesNote, aiVisible, aiVisibleProvider } from './ai-sources.js';

/** Strava's API Policy (1 June 2026) §5.3: nothing from Strava, directly or indirectly, reaches a model. */
describe('the AI source gate', () => {
  it('always excludes strava, and a null provider is read as strava', () => {
    expect(aiExcludedProviders()).toContain('strava');
    expect(aiVisibleProvider('strava')).toBe(false);
    expect(aiVisibleProvider('Strava')).toBe(false);
    expect(aiVisibleProvider(null)).toBe(false);
    expect(aiVisibleProvider(undefined)).toBe(false);
    expect(aiVisibleProvider('coros')).toBe(true);
    expect(aiVisibleProvider('import')).toBe(true);
  });
  it('filters rows by provider', () => {
    const rows = [{ id: 'a', provider: 'strava' }, { id: 'b', provider: 'coros' }, { id: 'c', provider: null }];
    expect(aiVisible(rows).map((r) => r.id)).toEqual(['b']);
  });
  it('tells the model what it cannot see', () => {
    expect(aiSourcesNote()).toMatch(/Strava/);
    expect(aiSourcesNote()).toMatch(/not confirmed/);
  });
});
