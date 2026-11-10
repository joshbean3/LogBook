import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSENT } from '@logbook/shared';
import { BadShapeError, consentOf, isBootstrap, parseBootstrap } from './bootstrap';

const neverAsked = { training: false, health: null, recall: false, reads: false, at: null, version: null };
const consent = { training: true, health: null, recall: false, reads: false, at: '2026-11-10T08:00:00.000Z', version: '2026-11' };
const good = () => ({
  user: { id: 'u1', email: 'sam@example.com', onboardedAt: '2026-11-01T00:00:00.000Z', name: 'Sam' },
  habits: [{ id: 'h1', name: 'Stretch' }],
  blocks: [],
  morningSettings: { wake: 360, run: { pace: 600, wakeup: 15, buffer: 10 } },
  zones: null,
  strava: { connected: false, athleteName: null, lastSyncAt: null, syncing: false, error: null, configured: false },
  features: { claude: true, strava: false },
  consent,
  trainWhen: null,
});

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

  it('carries the privacy choice, typed and required (Contract 1)', () => {
    const b = parseBootstrap(good());
    expect(b.consent).toEqual(consent);
    // typed: this line is a compile error if Bootstrap.consent loses a field or becomes optional again
    const training: boolean = b.consent.training;
    expect(training).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['null', null],
    ['not a full record', { training: 'yes' }],
    ['missing a field', { ...consent, recall: undefined }],
    ['a string', 'granted'],
  ])('a choice that is %s becomes the never-asked record, never a yes, and the open still succeeds', (_name, bad) => {
    const raw: Record<string, unknown> = { ...good(), consent: bad };
    if (bad === undefined) delete raw.consent;
    const b = parseBootstrap(raw);
    expect(b.consent).toEqual(neverAsked);
    expect(b.consent).toEqual(DEFAULT_CONSENT);
    expect(b.consent).not.toBe(DEFAULT_CONSENT);
    expect(b.user.id).toBe('u1');
    expect(b.habits).toHaveLength(1);
  });

  it('carries the training time answer, and reads a missing or unreadable one as no answer', () => {
    const tw = { when: 'afternoon', offWork: 1050 };
    const b = { ...good(), trainWhen: tw };
    expect(parseBootstrap(b)).toBe(b);
    expect(parseBootstrap(b).trainWhen).toEqual(tw);
    const none = { ...good(), trainWhen: null };
    expect(parseBootstrap(none)).toBe(none);
    const { trainWhen: _gone, ...old } = good();
    expect(parseBootstrap(old).trainWhen).toBeNull();
    expect(parseBootstrap({ ...good(), trainWhen: { when: 'noon', offWork: 1050 } }).trainWhen).toBeNull();
    expect(parseBootstrap({ ...good(), trainWhen: 'afternoon' }).trainWhen).toBeNull();
  });

  it('consentOf reads only a full record', () => {
    expect(consentOf({ ...consent, recall: undefined })).toBeUndefined();
    expect(consentOf(undefined)).toBeUndefined();
    expect(consentOf(consent)).toEqual(consent);
  });
});
