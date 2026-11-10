import { passwordProblem, zCredentials } from '@logbook/shared';

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

/** Why a new password will not do, in plain words, or null. The length message counts down as the person types. */
export const newPasswordProblem = (pw: string, email = ''): string | null => {
  if (pw.length < PASSWORD_MIN) return pw ? `${PASSWORD_MIN - pw.length} more ${PASSWORD_MIN - pw.length === 1 ? 'character' : 'characters'}.` : `At least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Use ${PASSWORD_MAX} characters or fewer.`;
  if (!pw.trim()) return 'Use letters or numbers, not only spaces.';
  // the server's own rule (packages/shared): the same common passwords, one repeated character, the email
  const why = passwordProblem(pw, email);
  if (why) return passwordRefusal(why);
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
 * Is this 422 from sign-up, reset or change password about the new password? The server's `weak_password` code, or a
 * message that names the password field.
 */
export const isPasswordRefusal = (e: { status: number; code?: string | null; message: string }): boolean => e.status === 422 && (e.code === 'weak_password' || fieldOf422(e.message) === 'password');

/**
 * Where to go after signing in: the in-app page the visitor was sent away from (a 401 on /plan comes back to /plan), or
 * Today. Never back to a sign-in or first-run door.
 */
export const afterSignIn = (from: unknown): string => {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/today';
  if (/^\/(login|signup|start|welcome)(\/|$|\?)/.test(from)) return '/today';
  return from;
};

/**
 * What to say when the server refuses a new password (a 422 about the password field): the same plain lines the device
 * uses when the server says why (a common password, the email), and the length rule otherwise.
 */
export const passwordRefusal = (message: string): string => {
  const m = message.toLowerCase();
  if (/guess/.test(m)) return 'That password is too easy to guess. Try another.';
  if (/common|breach/.test(m)) return 'That password is too common. Try another.';
  if (/email/.test(m.replace(/^\s*password\s*:/, ''))) return 'Don’t use your email as your password.';
  return `That password won’t work. Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;
};
