import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../env.js';
import { passwordChangedMail, resetMail, sendMail, setMailTransport, verifyMail } from './mail.js';

/** The one sender module: what it posts to the provider, and what it does without a key. */
describe('sendMail', () => {
  let server: http.Server;
  let got: Array<{ auth: string; type: string; body: Record<string, unknown> }>;
  let status = 200;
  const was = { key: env.MAIL_API_KEY, from: env.MAIL_FROM, url: env.MAIL_API_URL, configured: env.mailConfigured, prod: env.isProd };

  beforeEach(async () => {
    got = [];
    status = 200;
    setMailTransport(null);
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        got.push({ auth: String(req.headers.authorization), type: String(req.headers['content-type']), body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> });
        res.writeHead(status, { 'content-type': 'application/json' }).end('{"id":"m_1"}');
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    env.MAIL_API_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/emails`;
    env.MAIL_API_KEY = 'mail-key-123';
    env.MAIL_FROM = 'Orby <no-reply@logbook.test>';
    env.mailConfigured = true;
  });
  afterEach(async () => {
    await new Promise((r) => server.close(r));
    Object.assign(env, { MAIL_API_KEY: was.key, MAIL_FROM: was.from, MAIL_API_URL: was.url, mailConfigured: was.configured, isProd: was.prod });
    vi.restoreAllMocks();
  });

  it('posts from, to, subject, text and html to the provider with the key from the environment', async () => {
    const link = 'https://logbook.test/login?reset=abc123';
    expect(await sendMail(resetMail('sam@example.com', link))).toBe(true);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ auth: 'Bearer mail-key-123', type: 'application/json', body: { from: 'Orby <no-reply@logbook.test>', to: ['sam@example.com'], subject: 'Reset your Orby password' } });
    expect(got[0]!.body.text).toContain(link);
    expect(got[0]!.body.html).toContain('href="https://logbook.test/login?reset=abc123"');
  });

  it('answers false and never throws when the provider refuses or cannot be reached', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    status = 500;
    expect(await sendMail(verifyMail('sam@example.com', 'https://logbook.test/api/auth/verify?token=t'))).toBe(false);
    env.MAIL_API_URL = 'http://127.0.0.1:1/emails';
    expect(await sendMail(passwordChangedMail('sam@example.com'))).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    // a warning never carries the link
    expect(JSON.stringify(warn.mock.calls)).not.toContain('token=t');
  });

  it('without a key: development logs the message with its link, production logs a warning without it', async () => {
    env.mailConfigured = false;
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const link = 'https://logbook.test/login?reset=secret-token-1';
    env.isProd = false;
    expect(await sendMail(resetMail('sam@example.com', link))).toBe(false);
    expect(String(info.mock.calls[0]![0])).toContain(link);
    env.isProd = true;
    expect(await sendMail(resetMail('sam@example.com', link))).toBe(false);
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain('MAIL_API_KEY and MAIL_FROM are not set');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token-1');
    expect(got).toHaveLength(0);
  });

  it('the mails are plain: no em dashes, the link once in the text, and markup escaped', () => {
    for (const m of [resetMail('a@example.com', 'https://x.test/login?reset=1&a=<b>'), verifyMail('a@example.com', 'https://x.test/v?token=2'), passwordChangedMail('a@example.com')]) {
      expect(m.text).not.toContain('—');
      expect(m.html).not.toContain('—');
      expect(m.html).not.toContain('<b>');
      expect(m.subject.length).toBeLessThan(60);
    }
    expect(resetMail('a@example.com', 'https://x.test/r').text.match(/https:\/\/x\.test\/r/g)).toHaveLength(1);
  });
});
