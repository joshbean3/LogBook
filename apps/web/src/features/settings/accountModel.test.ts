import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/client', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
      public code: string | null = null,
    ) {
      super(message);
    }
  }
  class NetworkError extends Error {}
  return { ApiError, NetworkError };
});

import { ApiError, NetworkError } from '@/api/client';
import { BACKUP_KEEP_DAYS, DELETE_COPIES, deleteLede, exportNote, passwordProblem, passwordRefusal, signOutLede, unsentWords } from './accountModel';

describe('what an export says it did', () => {
  it('says Shared only for a share that finished, and names a closed share sheet', () => {
    expect(exportNote('shared', 'logbook-2026-11-10.json')).toBe('Shared logbook-2026-11-10.json.');
    expect(exportNote('saved', 'logbook-2026-11-10.json')).toBe('Saved logbook-2026-11-10.json.');
    expect(exportNote('canceled', 'logbook-2026-11-10.json')).toBe('Export canceled.');
  });
});

describe('the delete sheet’s first step', () => {
  it('lists what is removed, counted, and says it cannot be undone', () => {
    const lede = deleteLede({ sessions: 41, habits: 1, entries: 2, todos: 0, links: 3 });
    expect(lede).toBe('This removes your account and everything in it: 41 sessions, 1 habit, 2 journal entries, 3 saved links, and every lift and run. It can’t be undone, here or on any other device.');
    expect(deleteLede(null)).toBe('This removes your account and everything in it. It can’t be undone, here or on any other device.');
  });
  it('states the backup days from the runbook and Anthropic’s 30 days with its exception', () => {
    expect(BACKUP_KEEP_DAYS).toBe(5);
    expect(DELETE_COPIES).toContain('Backups clear within 5 days.');
    expect(DELETE_COPIES).toContain('Anthropic deletes what was sent to Claude within 30 days, unless it was flagged for abuse or the law requires longer.');
  });
});

describe('change password', () => {
  const ok = { current: 'old-password', next: 'new-password-1', confirm: 'new-password-1' };
  it('passes a complete form', () => expect(passwordProblem(ok)).toBeNull());
  it('asks for the current password first', () => expect(passwordProblem({ ...ok, current: '' })).toEqual({ field: 'current', text: 'Enter your current password.' }));
  it('refuses a short new password', () => expect(passwordProblem({ ...ok, next: 'short', confirm: 'short' })?.field).toBe('next'));
  it('refuses the same password again', () => expect(passwordProblem({ current: 'same-password', next: 'same-password', confirm: 'same-password' })?.text).toBe('The new password is the same as the current one.'));
  it('refuses a mismatch', () => expect(passwordProblem({ ...ok, confirm: 'new-password-2' })).toEqual({ field: 'confirm', text: 'The two new passwords don’t match.' }));
  it('puts the server’s refusals in plain words', () => {
    expect(passwordRefusal(new ApiError('That is not your current password.', 403, 'wrong_password'))).toEqual({ field: 'current', text: 'That’s not your current password.' });
    expect(passwordRefusal(new ApiError('slow down', 429, 'rate_limited')).text).toBe('Too many tries. Wait a few minutes, then try again.');
    expect(passwordRefusal(new ApiError('bad', 422)).field).toBe('next');
    // a password the server refuses for itself (ws-01 answers 422 weak_password with a plain sentence) says why
    expect(passwordRefusal(new ApiError('That password is too common. Pick another.', 422, 'weak_password'))).toEqual({ field: 'next', text: 'That password is too common. Pick another.' });
    expect(passwordRefusal(new NetworkError()).text).toBe('Couldn’t reach Logbook. Check your connection.');
    // a server without the route yet: no jargon, no dead end
    expect(passwordRefusal(new ApiError('Not found', 404)).text).toBe('Couldn’t change the password. Try again.');
  });
});

describe('sign out', () => {
  it('names the email and mentions unsent changes only when there are some', () => {
    expect(signOutLede('sam@example.com')).toMatch(/^Sign out of sam@example\.com\?/);
    expect(unsentWords(0)).toBeNull();
    expect(unsentWords(1)).toBe('1 change on this phone hasn’t been sent yet. Signing out now loses it. Go online first to keep it.');
    expect(unsentWords(3)).toMatch(/^3 changes on this phone haven’t been sent yet/);
  });
});
