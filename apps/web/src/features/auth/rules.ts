import { zCredentials } from '@logbook/shared';

/**
 * The sign-in and sign-up rules, checked on the device with the same schema the server uses (zCredentials), so an
 * address the server would refuse is caught before the request (auth-07, auth-19).
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

export const emailProblem = (v: string): string | null => {
  if (!v.trim()) return 'Enter your email address.';
  return zCredentials.shape.email.safeParse(v).success ? null : 'That doesn’t look like an email address.';
};

/**
 * A short list of the passwords people pick most, checked on the device (auth-14). Lower case, compared after trimming and
 * lower-casing what was typed. Kept short on purpose: it catches the obvious ones without shipping a dictionary.
 */
const COMMON = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  '87654321',
  '11111111',
  '00000000',
  '12341234',
  '11223344',
  'qwertyui',
  'qwerty123',
  'qwertyuiop',
  'asdfghjk',
  'asdfasdf',
  'iloveyou',
  'iloveyou1',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'welcome1',
  'welcome123',
  'abc12345',
  'abcd1234',
  'letmein1',
  'trustno1',
  'superman',
  'starwars',
  'whatever',
  'changeme',
  'logbook1',
  'logbook123',
]);

/** Why a new password will not do, in plain words, or null. The length message counts down as the person types. */
export const newPasswordProblem = (pw: string, email = ''): string | null => {
  if (pw.length < PASSWORD_MIN) return pw ? `${PASSWORD_MIN - pw.length} more ${PASSWORD_MIN - pw.length === 1 ? 'character' : 'characters'}.` : `At least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  const low = pw.trim().toLowerCase();
  if (!low) return 'Use letters or numbers, not only spaces.';
  if (COMMON.has(low)) return 'That password is too common. Try another.';
  const mail = email.trim().toLowerCase();
  if (mail && (low === mail || low === mail.split('@')[0])) return 'Don’t use your email as your password.';
  return null;
};

/** Which field a 422 from the server is about: its message reads "email: ..." or "password: ...". */
export const fieldOf422 = (message: string): 'email' | 'password' | null => {
  const m = message.toLowerCase();
  if (/(^|;\s*)password\b/.test(m)) return 'password';
  if (/(^|;\s*)email\b/.test(m)) return 'email';
  return null;
};

/**
 * What to say when the server refuses a new password (a 422 about the password field): the same plain lines the device
 * uses when the server says why (a common password, the email), and the length rule otherwise.
 */
export const passwordRefusal = (message: string): string => {
  const m = message.toLowerCase();
  if (/common|breach|guess/.test(m)) return 'That password is too common. Try another.';
  if (/email/.test(m.replace(/^\s*password\s*:/, ''))) return 'Don’t use your email as your password.';
  return `That password won’t work. Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;
};
