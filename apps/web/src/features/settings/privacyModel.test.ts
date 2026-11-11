import { DEFAULT_CONSENT, type Consent } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { CONSENT_SWITCHES, consentFoot, consentShort, consentWord, firstAnswer, mailto, switchOn } from './privacyModel';

const c = (over: Partial<Consent>): Consent => ({ ...DEFAULT_CONSENT, training: false, recall: false, reads: false, health: null, at: '2026-11-08T15:00:00.000Z', version: '2026-11', ...over });

describe('the Privacy page’s reading of the consent record', () => {
  it('offers exactly the three choices of Contract 1, each with a line on what is sent', () => {
    expect(CONSENT_SWITCHES.map((s) => s.key)).toEqual(['training', 'recall', 'reads']);
    for (const s of CONSENT_SWITCHES) expect(s.sub.length).toBeGreaterThan(20);
    expect(CONSENT_SWITCHES.map((s) => s.title)).toEqual(['Training data', 'Remember when', 'Daily read']);
  });
  it('reads every switch off, and "Not asked", for an account that never answered', () => {
    // a stored `true` with no answer time is not permission (an old default)
    const never = c({ at: null, training: true, recall: true, reads: true });
    for (const s of CONSENT_SWITCHES) expect(switchOn(never, s.key)).toBe(false);
    expect(consentWord(never)).toBe('Not asked');
    expect(consentFoot(never)).toMatch(/^Not asked yet\./);
  });
  it('bases a first answer on every switch off', () => {
    expect(firstAnswer()).toEqual({ training: false, recall: false, reads: false });
  });
  it('says On, Off or how many are on once the person has answered', () => {
    expect(consentWord(c({}))).toBe('Off');
    expect(consentWord(c({ training: true }))).toBe('1 of 3 on');
    expect(consentWord(c({ training: true, recall: true, reads: true }))).toBe('On');
    expect(switchOn(c({ recall: true }), 'recall')).toBe(true);
    expect(switchOn(c({ recall: true }), 'reads')).toBe(false);
  });
  it('has no word while the record is loading', () => {
    expect(consentWord(undefined)).toBeUndefined();
    expect(switchOn(undefined, 'training')).toBe(false);
  });
  it('dates the choice', () => {
    expect(consentFoot(c({}))).toContain('You last chose on Nov 8, 2026.');
  });
  it('writes a mail link with its subject', () => {
    expect(mailto('help@example.com', 'Privacy request')).toBe('mailto:help@example.com?subject=Privacy%20request');
  });
});

describe('the Settings root’s one word', () => {
  it('is Off until something is on, All with every switch, Some between', () => {
    expect(consentShort(undefined)).toBeUndefined();
    expect(consentShort(c({ at: null, training: true, recall: true, reads: true }))).toBe('Off');
    expect(consentShort(c({}))).toBe('Off');
    expect(consentShort(c({ training: true }))).toBe('Some');
    expect(consentShort(c({ training: true, recall: true, reads: true }))).toBe('All');
  });
});
