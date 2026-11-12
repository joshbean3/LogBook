import { describe, expect, it } from 'vitest';
import { loginSendsOn, sessionEnded } from './session';

/**
 * A session that ends while the app is open (it ran out, the password was changed, the account signed out elsewhere):
 * the app goes to the sign-in page once and stays there. It used to swing between Today and the sign-in page for ever,
 * asking the server over a hundred times a second, because the sign-in page still believed the session was live.
 */
describe('the sign-in page and a visitor who seems signed in', () => {
  it('sends a signed-in visitor on to Today', () => {
    expect(loginSendsOn(true, '', null)).toBe(true);
    expect(loginSendsOn(true, '?x=1', { from: '/goals' })).toBe(true);
  });
  it('never sends on a visitor the server just signed out, whatever this page still believes', () => {
    expect(loginSendsOn(true, '', { signedOut: true, from: '/today' })).toBe(false);
    expect(loginSendsOn(true, '', { signedOut: true })).toBe(false);
  });
  it('keeps a password reset link on the form, and a visitor who is not signed in, or not known yet', () => {
    expect(loginSendsOn(true, '?reset=abc', null)).toBe(false);
    expect(loginSendsOn(false, '', null)).toBe(false);
    expect(loginSendsOn(undefined, '', null)).toBe(false);
  });
  it('reads any router state without throwing', () => {
    for (const state of [undefined, null, 0, '', 'signedOut', [], [true], { signedOut: 'yes' }, { signedOut: 1 }, { nested: { signedOut: true } }]) expect(loginSendsOn(true, '', state)).toBe(true);
    for (const search of ['', '?', '?reset', '?reset=', '%', '?%E0%A4%A']) expect(typeof loginSendsOn(true, search, null)).toBe('boolean');
  });
});

describe('a 401: is the session really gone?', () => {
  it('yes when the server says signed out', async () => expect(await sessionEnded(async () => ({ signedIn: false }))).toBe(true));
  it('no only when the server clearly says still signed in (the 401 was about something else)', async () => expect(await sessionEnded(async () => ({ signedIn: true }))).toBe(false));
  it('yes when the server cannot be asked, or answers in another shape', async () => {
    expect(await sessionEnded(() => Promise.reject(new Error('offline')))).toBe(true);
    expect(await sessionEnded(async () => null)).toBe(true);
    expect(await sessionEnded(async () => undefined)).toBe(true);
    expect(await sessionEnded(async () => ({}))).toBe(true);
    expect(await sessionEnded(async () => ({ signedIn: 'true' as unknown as boolean }))).toBe(true);
    expect(
      await sessionEnded(() => {
        throw new Error('sync');
      }),
    ).toBe(true);
  });
});
