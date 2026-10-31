import { env } from '../env.js';

/**
 * Transactional mail (the verify link, the reset link) through Resend's HTTP API: one POST, no SDK. Without `RESEND_API_KEY`
 * nothing leaves the process: the message is printed to the console (dev) and kept in `sentMails`, which the tests and the
 * dev-only `GET /auth/dev/last-mail` read. A failure never reaches the person asking: it is logged and answered `{ ok: false }`.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface SentMail extends Mail {
  at: string;
  /** 'console' when no key was set, 'resend' when it went out, 'failed' when Resend refused it or could not be reached. */
  via: 'console' | 'resend' | 'failed';
  id?: string;
}

export const RESEND_URL = 'https://api.resend.com/emails';
/** The last mails, newest last (capped; tests reset it). */
export const sentMails: SentMail[] = [];
export const resetSentMails = () => sentMails.splice(0, sentMails.length);
export const lastMail = (): SentMail | null => sentMails[sentMails.length - 1] ?? null;
const keep = (m: SentMail) => {
  sentMails.push(m);
  if (sentMails.length > 50) sentMails.shift();
};

/** The `?token=…` of a link: the first one in the text, for the dev route and the tests. */
export const tokenOf = (m: Pick<Mail, 'text'> | null): string | null => m?.text.match(/[?&]token=([A-Za-z0-9_-]+)/)?.[1] ?? null;

export const sendMail = async (mail: Mail, fetchFn: typeof fetch = fetch): Promise<{ ok: boolean; id?: string }> => {
  const at = new Date().toISOString();
  if (!env.mailConfigured) {
    if (!env.isProd && env.NODE_ENV !== 'test') console.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
    keep({ ...mail, at, via: 'console' });
    return { ok: true };
  }
  try {
    const res = await fetchFn(RESEND_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[mail] Resend answered ${res.status} for "${mail.subject}" to ${mail.to}: ${body.slice(0, 200)}`);
      keep({ ...mail, at, via: 'failed' });
      return { ok: false };
    }
    const id = ((await res.json().catch(() => null)) as { id?: string } | null)?.id;
    keep({ ...mail, at, via: 'resend', ...(id ? { id } : {}) });
    return { ok: true, ...(id ? { id } : {}) };
  } catch (e) {
    console.error(`[mail] could not send "${mail.subject}" to ${mail.to}:`, e instanceof Error ? e.message : e);
    keep({ ...mail, at, via: 'failed' });
    return { ok: false };
  }
};

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** Plain text and a one-column HTML twin: a greeting, the lines, the link as a button, the small print. */
const compose = (lines: string[], link: string, button: string, small: string): Pick<Mail, 'text' | 'html'> => ({
  text: `${lines.join('\n\n')}\n\n${link}\n\n${small}\n\n— Logbook`,
  html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#111;max-width:480px;margin:0 auto;padding:24px">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p style="margin:28px 0"><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(button)}</a></p><p style="font-size:13px;line-height:18px;color:#666">${esc(small)}<br>If the button does nothing, open this link: <a href="${esc(link)}" style="color:#666">${esc(link)}</a></p><p style="color:#666">— Logbook</p></div>`,
});

/** The sign-up (and change-of-address) mail: one link, good for 24 hours. */
export const verifyMail = (to: string, link: string): Mail => ({
  to,
  subject: 'Verify your email for Logbook',
  ...compose(['Confirm this is your address so your Logbook account stays yours.'], link, 'Verify my email', 'The link works for 24 hours. If you didn’t create a Logbook account, ignore this; nothing happens.'),
});

/** The forgot-password mail: one link, good for an hour and once. */
export const resetMail = (to: string, link: string): Mail => ({
  to,
  subject: 'Reset your Logbook password',
  ...compose([`Someone asked to reset the password for ${to}. If that was you, choose a new one here.`], link, 'Choose a new password', 'The link works for one hour and only once. If it wasn’t you, ignore this; your password stays as it is.'),
});
