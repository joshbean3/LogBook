import { CONSENT_VERSION, type Consent } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingConsent, consentForSignup, PENDING_CONSENT_KEY, readPendingChoice, writePendingChoice } from './consent';
import { PRIVACY_PROMISE, privacyFacts } from './PrivacyFacts';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('the answer from the privacy page', () => {
  it('is nothing until a button is tapped: no default', () => {
    expect(readPendingChoice()).toBeNull();
    expect(consentForSignup(readPendingChoice())).toBeUndefined();
  });
  it('Allow goes with the new account as a yes, with the wording version', () => {
    writePendingChoice('allow');
    expect(readPendingChoice()).toBe('allow');
    expect(consentForSignup('allow')).toEqual({ training: true, version: CONSENT_VERSION });
    expect(JSON.parse(store.get(PENDING_CONSENT_KEY)!)).toEqual({ choice: 'allow', version: CONSENT_VERSION });
  });
  it('Not now sends no consent at all, so the account reads as never asked', () => {
    writePendingChoice('later');
    expect(readPendingChoice()).toBe('later');
    expect(consentForSignup('later')).toBeUndefined();
  });
  it('ignores the older stored shape (a pre-set switch is not an answer) and anything unreadable', () => {
    store.set(PENDING_CONSENT_KEY, JSON.stringify({ training: true }));
    expect(readPendingChoice()).toBeNull();
    store.set(PENDING_CONSENT_KEY, '{nope');
    expect(readPendingChoice()).toBeNull();
  });
  it('clears after the account is made', () => {
    writePendingChoice('allow');
    clearPendingConsent();
    expect(readPendingChoice()).toBeNull();
  });
});

const record = (c: Partial<Consent>): Consent => ({ training: false, recall: false, reads: false, health: null, at: '2026-11-10T12:00:00.000Z', version: CONSENT_VERSION, ...c });
const keys = (rows: { key: string }[]) => rows.map((r) => r.key);
const text = (rows: { key: string; text: string }[], key: string) => rows.find((r) => r.key === key)?.text;

describe('the privacy lists', () => {
  it('the promise is the literal one', () => {
    expect(PRIVACY_PROMISE).toBe('Your data is yours. It is never sold. It goes to Claude only when you say so.');
  });
  it('before any answer: says what Allow would send, and Remember when and the daily read stay off', () => {
    for (const none of [null, undefined, record({ at: null, training: true, recall: true, reads: true })]) {
      const f = privacyFacts(none);
      expect(f.asked).toBe(false);
      expect(keys(f.sent)).toEqual(['typed', 'training']);
      expect(keys(f.notSent)).toEqual(['recall', 'reads', 'account', 'health']);
    }
  });
  it('names typed text and attached files', () => {
    expect(text(privacyFacts(null).sent, 'typed')).toBe('What you type to the assistant and the files you attach.');
  });
  it('each row sits under Sent only while its switch is on', () => {
    const all = privacyFacts(record({ training: true, recall: true, reads: true }));
    expect(all.asked).toBe(true);
    expect(keys(all.sent)).toEqual(['typed', 'training', 'recall', 'reads']);
    expect(text(all.sent, 'recall')).toBe('One past journal entry or learning at a time, with your first name, to write Remember when.');
    expect(text(all.sent, 'reads')).toBe('Your saved links, notes and tags, to pick a daily read.');
    expect(keys(all.notSent)).toEqual(['account', 'health']);

    const none = privacyFacts(record({}));
    expect(keys(none.sent)).toEqual(['typed']);
    expect(keys(none.notSent)).toEqual(['training', 'recall', 'reads', 'account', 'health']);
    expect(text(none.notSent, 'training')).toBe('Your plan, sessions, training status, goals and to-dos: off.');

    const one = privacyFacts(record({ reads: true }));
    expect(keys(one.sent)).toEqual(['typed', 'reads']);
    expect(keys(one.notSent)).toEqual(['training', 'recall', 'account', 'health']);
  });
  it('health reads as not sent, and a build without the Strava connection never names it', () => {
    const f = privacyFacts(record({ training: true, health: true }));
    expect(text(f.notSent, 'health')).toBe('Health data: not sent.');
    expect(JSON.stringify(f)).not.toMatch(/strava/i);
  });
});
