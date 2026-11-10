import { describe, expect, it } from 'vitest';
import { BadShapeError, consentOf, isBootstrap, parseBootstrap } from './bootstrap';

const good = () => ({
  user: { id: 'u1', email: 'sam@example.com', onboardedAt: '2026-11-01T00:00:00.000Z', name: 'Sam' },
  habits: [{ id: 'h1', name: 'Stretch' }],
  blocks: [],
  morningSettings: { wake: 360, run: { pace: 600, wakeup: 15, buffer: 10 } },
  zones: null,
  strava: { connected: false, athleteName: null, lastSyncAt: null, syncing: false, error: null, configured: false },
  features: { claude: true, strava: false },
});
const consent = { training: true, health: null, recall: false, reads: false, at: '2026-11-10T08:00:00.000Z', version: '2026-11' };

describe('the bootstrap is checked before it is used or saved (shell-02, critic-01)', () => {
  it('a good answer passes through as the same object, unknown fields and all', () => {
    const b = { ...good(), somethingNew: 1 };
    expect(parseBootstrap(b)).toBe(b);
    expect(isBootstrap(b)).toBe(true);
  });

  it.each([
    ['an empty object', {}],
    ['no user', { ...good(), user: undefined }],
    ['a user with no id', { ...good(), user: { email: 'x@example.com' } }],
    ['habits that are not a list', { ...good(), habits: null }],
    ['blocks missing', { ...good(), blocks: undefined }],
    ['no morning settings', { ...good(), morningSettings: null }],
    ['no feature flags', { ...good(), features: undefined }],
    ['a page of HTML', '<html>Sign in to the wifi</html>'],
    ['null', null],
  ])('%s is refused', (_name, raw) => {
    expect(() => parseBootstrap(raw)).toThrow(BadShapeError);
    expect(isBootstrap(raw)).toBe(false);
  });

  it('carries the privacy choice, typed (Contract 1)', () => {
    const b = parseBootstrap({ ...good(), consent });
    expect(b.consent).toEqual(consent);
    // typed: this line is a compile error if Bootstrap.consent loses a field
    const training: boolean | undefined = b.consent?.training;
    expect(training).toBe(true);
  });

  it('a bootstrap from a server that does not send the choice yet is still good', () => {
    expect(parseBootstrap(good()).consent).toBeUndefined();
  });

  it('a choice that is not a full record is dropped, never read as a yes', () => {
    const b = parseBootstrap({ ...good(), consent: { training: 'yes' } });
    expect(b.consent).toBeUndefined();
    expect('consent' in b).toBe(false);
    expect(consentOf({ ...consent, recall: undefined })).toBeUndefined();
    expect(consentOf(consent)).toEqual(consent);
  });
});
