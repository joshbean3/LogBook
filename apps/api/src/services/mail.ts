import { env } from '../env.js';

/**
 * The one place mail leaves the server (password reset, email verification). One provider, one key from the
 * environment (MAIL_API_KEY, MAIL_FROM; MAIL_API_URL is the provider's JSON send endpoint).
 *
 * Without a key nothing is sent. In development the message, link included, is written to the log so the flow can be
 * walked by hand. In production only a warning is logged (never the link: a reset link in a log is a way in), the server
 * warns at boot, and the post-deploy check fails.
 */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}
type Transport = (m: Mail) => Promise<void> | void;
let transport: Transport | null = null;
/** Tests hand in a transport that keeps the mail; null puts the real one back. */
export const setMailTransport = (t: Transport | null) => {
  transport = t;
};

/** Send one message. Answers whether it was handed to the provider; never throws (the caller has already answered). */
export const sendMail = async (m: Mail): Promise<boolean> => {
  try {
    if (transport) {
      await transport(m);
      return true;
    }
    if (!env.mailConfigured) {
      if (env.isProd) console.warn(`[mail] not sent (${m.subject}): MAIL_API_KEY and MAIL_FROM are not set`);
      else console.info(`[mail] no provider key, so here is the message.\n  To: ${m.to}\n  Subject: ${m.subject}\n\n${m.text}\n`);
      return false;
    }
    const res = await fetch(env.MAIL_API_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.MAIL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`[mail] the provider answered ${res.status} (${m.subject})`);
    return res.ok;
  } catch (e) {
    console.warn(`[mail] could not send (${m.subject}):`, e instanceof Error ? e.message : e);
    return false;
  }
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const page = (title: string, lines: string[], link: { href: string; label: string }) =>
  `<!doctype html><html lang="en"><body style="margin:0;padding:24px;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1d21;background:#ffffff"><div style="max-width:480px;margin:0 auto"><h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}<p style="margin:20px 0"><a href="${esc(link.href)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#1a1d21;color:#ffffff;text-decoration:none;font-weight:600">${esc(link.label)}</a></p><p style="margin:0 0 12px;color:#5b6168;font-size:14px">Or paste this link into your browser:<br>${esc(link.href)}</p></div></body></html>`;

/** How long each emailed link works. */
export const RESET_MINUTES = 30;
export const VERIFY_DAYS = 7;

export const resetMail = (to: string, link: string): Mail => {
  const lines = [`Someone asked to reset the password for this Logbook account. If that was you, choose a new password with the link below. It works once, for ${RESET_MINUTES} minutes.`, 'If it was not you, ignore this email. Your password stays as it is.'];
  return { to, subject: 'Reset your Logbook password', text: `${lines[0]}\n\n${link}\n\n${lines[1]}\n`, html: page('Reset your password', lines, { href: link, label: 'Choose a new password' }) };
};

export const verifyMail = (to: string, link: string): Mail => {
  const lines = ['Welcome to Logbook. Confirm that this is your email address, so you can reset your password if you ever forget it.', `The link works once, for ${VERIFY_DAYS} days. If you did not make a Logbook account, ignore this email.`];
  return { to, subject: 'Confirm your email for Logbook', text: `${lines[0]}\n\n${link}\n\n${lines[1]}\n`, html: page('Confirm your email', lines, { href: link, label: 'Confirm my email' }) };
};

export const passwordChangedMail = (to: string): Mail => {
  const lines = ['The password for this Logbook account was just changed, and every other device was signed out.', 'If this was not you, open Logbook, tap "Forgot password?" on the sign-in screen and choose a new one.'];
  return {
    to,
    subject: 'Your Logbook password was changed',
    text: `${lines.join('\n\n')}\n`,
    html: `<!doctype html><html lang="en"><body style="margin:0;padding:24px;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1d21;background:#ffffff"><div style="max-width:480px;margin:0 auto"><h1 style="font-size:20px;margin:0 0 12px">Your password was changed</h1>${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}</div></body></html>`,
  };
};
