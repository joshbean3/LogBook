import { describe, expect, it } from 'vitest';
import { zCredentials } from '@logbook/shared';
import { emailProblem, fieldOf422, newPasswordProblem } from './rules';

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
