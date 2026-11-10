import { ApiError, NetworkError } from '@/api/client';

/**
 * The words of the Account and Data pages, kept apart from the screens so each can be tested: what an export did, what
 * deleting an account removes and what happens to the copies, and why a password change was refused.
 */

// ---------- export ----------
/** What became of an export: a download (the web), the share sheet finished (the iPhone app), or the share sheet was closed. */
export type ExportOutcome = 'saved' | 'shared' | 'canceled';
/** The row's line after an export. "Shared" only when the share sheet finished; a closed sheet is said as it is. */
export const exportNote = (outcome: ExportOutcome, name: string): string => (outcome === 'shared' ? `Shared ${name}.` : outcome === 'saved' ? `Saved ${name}.` : 'Export canceled.');
export const EXPORT_FAILED = 'Export didn’t finish. Check your connection.';

// ---------- delete account ----------
/**
 * How long a deleted account can still sit in a backup, in days. From apps/api/RUNBOOK.md: volume snapshots are kept 5
 * days and the nightly off-site backup `BACKUP_KEEP_DAYS` (default 5). If either number goes up, change this one, the
 * runbook line and the privacy policy to the larger of the two.
 */
export const BACKUP_KEEP_DAYS = 5;
export interface AccountCounts {
  sessions: number;
  habits: number;
  entries: number;
  todos: number;
  links: number;
}
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
/** Step one's first sentence: what goes, counted, and that it cannot be undone. */
export const deleteLede = (c: AccountCounts | null | undefined): string => {
  const parts = c ? [c.sessions ? plural(c.sessions, 'session') : null, c.habits ? plural(c.habits, 'habit') : null, c.entries ? plural(c.entries, 'journal entry', 'journal entries') : null, c.todos ? plural(c.todos, 'to-do') : null, c.links ? plural(c.links, 'saved link') : null].filter(Boolean) : [];
  return `This removes your account and everything in it${parts.length ? `: ${parts.join(', ')}, and every lift and run` : ''}. It can’t be undone, here or on any other device.`;
};
/**
 * Step one's second paragraph: what happens to the copies. Neither sentence promises more than the processors do: the
 * backup window is the runbook's, and Anthropic's 30 days carries its own exceptions.
 */
export const DELETE_COPIES = `It is deleted from Orby right away. Backups clear within ${BACKUP_KEEP_DAYS} days. Anthropic deletes what was sent to Claude within 30 days, unless it was flagged for abuse or the law requires longer.`;

// ---------- change password ----------
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
export type PasswordField = 'current' | 'next' | 'confirm';
export interface PasswordProblem {
  field: PasswordField;
  text: string;
}
/** The first thing wrong with the form before it is sent, or null. */
export const passwordProblem = (v: { current: string; next: string; confirm: string }): PasswordProblem | null => {
  if (!v.current) return { field: 'current', text: 'Enter your current password.' };
  if (v.next.length < PASSWORD_MIN) return { field: 'next', text: `Use at least ${PASSWORD_MIN} characters for the new password.` };
  if (v.next.length > PASSWORD_MAX) return { field: 'next', text: `Use ${PASSWORD_MAX} characters or fewer.` };
  if (v.next === v.current) return { field: 'next', text: 'The new password is the same as the current one.' };
  if (v.confirm !== v.next) return { field: 'confirm', text: 'The two new passwords don’t match.' };
  return null;
};
/** Why the server refused (`POST /me/password`, Contract 3), in plain words, and the field to go back to. */
export const passwordRefusal = (e: unknown): PasswordProblem => {
  if (e instanceof NetworkError) return { field: 'current', text: 'Couldn’t reach Orby. Check your connection.' };
  if (e instanceof ApiError) {
    if (e.status === 403 || e.code === 'wrong_password') return { field: 'current', text: 'That’s not your current password.' };
    if (e.status === 429) return { field: 'current', text: 'Too many tries. Wait a few minutes, then try again.' };
    // the server's own sentence for a password it will not take (too common, the email, too short): plain, one line
    if (e.code === 'weak_password' && e.message && e.message.length <= 120) return { field: 'next', text: e.message };
    if (e.status === 400 || e.status === 422) return { field: 'next', text: `Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters for the new password.` };
  }
  return { field: 'current', text: 'Couldn’t change the password. Try again.' };
};

/** The sign-out sheet's words: who is signed out, and what is still waiting on this phone (the outbox) when there is any. */
export const signOutLede = (email: string | null | undefined) => `Sign out of ${email || 'this account'}? Everything you’ve logged stays in your account for when you sign in again.`;
export const unsentWords = (n: number) => (n > 0 ? `${n === 1 ? '1 change on this phone hasn’t' : `${n} changes on this phone haven’t`} been sent yet. Signing out now loses ${n === 1 ? 'it' : 'them'}. Go online first to keep ${n === 1 ? 'it' : 'them'}.` : null);
