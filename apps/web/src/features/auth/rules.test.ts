import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS, passwordProblem, zCredentials } from '@logbook/shared';
import { afterSignIn, emailProblem, fieldOf422, isPasswordRefusal, newPasswordProblem, passwordRefusal } from './rules';

describe('emailProblem', () => {
  it('asks for an address when empty', () => {
    expect(emailProblem('  ')).toBe('Enter your email address.');
  });
  it('matches the server rule on every sample', () => {
    for (const v of ['sam@example.com', ' Sam@Example.com ', 'a@b.c', 'someone@gmail', 'not-an-email', 'a b@c.com', 'x@y.co']) {
      expect(emailProblem(v) === null).toBe(zCredentials.shape.email.safeParse(v).success);
    }
  });
  it('catches the addresses the old device rule let through', () => {
    expect(emailProblem('a@b.c')).not.toBeNull();
    expect(emailProblem('someone@gmail')).not.toBeNull();
  });
});

describe('newPasswordProblem', () => {
  it('counts down to the minimum', () => {
    expect(newPasswordProblem('')).toBe('At least 8 characters.');
    expect(newPasswordProblem('abcdefg')).toBe('1 more character.');
    expect(newPasswordProblem('abc')).toBe('5 more characters.');
  });
  it('refuses common passwords, spaces only, and the email', () => {
    expect(newPasswordProblem('password')).toMatch(/too common/);
    expect(newPasswordProblem('12345678')).toMatch(/too common/);
    expect(newPasswordProblem('        ')).toMatch(/spaces/);
    expect(newPasswordProblem('sam@example.com', 'Sam@example.com')).toMatch(/email/);
    expect(newPasswordProblem('samuel99', 'samuel99@example.com')).toMatch(/email/);
  });
  it('refuses what the server refuses: its whole common list and one repeated character', () => {
    expect(newPasswordProblem('marathon1')).toBe('That password is too common. Try another.');
    expect(newPasswordProblem('aaaaaaaaaa')).toMatch(/too easy to guess/);
    for (const p of COMMON_PASSWORDS) expect(newPasswordProblem(p)).not.toBeNull();
    for (const p of ['marathon1', 'Running123', 'zzzzzzzz', 'correct horse 9', 'sam@example.com', 'samuel99']) {
      expect(newPasswordProblem(p, 'samuel99@example.com') === null).toBe(passwordProblem(p, 'samuel99@example.com') === null);
    }
  });
  it('accepts a fair password', () => {
    expect(newPasswordProblem('correct horse 9', 'sam@example.com')).toBeNull();
  });
  it('refuses more than 200 characters', () => {
    expect(newPasswordProblem('x'.repeat(201))).toMatch(/200/);
  });
});

describe('fieldOf422', () => {
  it('reads the field from the server message', () => {
    expect(fieldOf422('password: Too big: expected string to have <=200 characters')).toBe('password');
    expect(fieldOf422('email: Invalid email address')).toBe('email');
    expect(fieldOf422('body: bad')).toBeNull();
  });
});

describe('passwordRefusal', () => {
  it('says why the server refused a new password, in the device words', () => {
    expect(passwordRefusal('password: That password is too common')).toBe('That password is too common. Try another.');
    expect(passwordRefusal('password: must not equal the email')).toBe('Don’t use your email as your password.');
    expect(passwordRefusal('password: Too big: expected string to have <=200 characters')).toBe('That password won’t work. Use 8 to 200 characters.');
    expect(passwordRefusal('')).toBe('That password won’t work. Use 8 to 200 characters.');
  });
});

describe('isPasswordRefusal', () => {
  it('reads a weak_password 422 as about the password, whatever the message says', () => {
    expect(isPasswordRefusal({ status: 422, code: 'weak_password', message: 'That password is too common. Pick another.' })).toBe(true);
    expect(passwordRefusal('That password is too common. Pick another.')).toBe('That password is too common. Try another.');
    expect(isPasswordRefusal({ status: 422, code: null, message: 'password: Too big' })).toBe(true);
    expect(isPasswordRefusal({ status: 422, code: null, message: 'email: Invalid email address' })).toBe(false);
    expect(isPasswordRefusal({ status: 409, code: 'weak_password', message: '' })).toBe(false);
  });
});

describe('afterSignIn', () => {
  it('goes back to the in-app page the visitor came from', () => {
    expect(afterSignIn('/plan')).toBe('/plan');
    expect(afterSignIn('/settings/privacy')).toBe('/settings/privacy');
  });
  it('goes to Today otherwise', () => {
    for (const f of [undefined, null, 'start', '', '//evil.example.com', '/login', '/start', '/welcome/name', '/signup', 'https://example.com/x']) {
      expect(afterSignIn(f)).toBe('/today');
    }
  });
});
