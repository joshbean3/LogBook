import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../env.js';
import { makeApp, type App } from '../test/helpers.js';
// @ts-expect-error a plain script, run by node after a deploy
import { runChecks } from '../../scripts/post-deploy-check.mjs';

/** The post-deploy check fails when the server is not ready for strangers (finding auth-02, Contract 3). */
let app: App;
const was = { signup: env.allowSignup, setup: env.allowSetup, mail: env.mailConfigured, claude: env.claudeConfigured, support: env.supportConfigured };
/** What the server would serve for the web app: the page, its scripts, the support page. `null` is a 404. */
let site: Record<string, string | null>;
const check = (opts: Record<string, unknown> = {}): Promise<string[]> =>
  runChecks({
    origin: 'https://logbook.test/',
    fetchImpl: async (url: string, init?: RequestInit) => {
      const path = url.replace('https://logbook.test', '');
      if (path.startsWith('/api/')) return app.request(path, init);
      const body = site[path];
      return body == null ? new Response('Not found', { status: 404 }) : new Response(body, { status: 200 });
    },
    ...opts,
  });

beforeEach(() => {
  ({ app } = makeApp());
  env.allowSignup = true;
  env.mailConfigured = true;
  env.claudeConfigured = true;
  env.supportConfigured = true;
  site = {
    '/': '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-abc.js"></script><link rel="modulepreload" href="/assets/vendor-def.js"></head><body></body></html>',
    '/assets/index-abc.js': 'const SUPPORT_EMAIL="help@logbook.test";',
    '/assets/vendor-def.js': 'export const x=1;',
    '/legal/support.html': '<p>Write to <a href="mailto:help@logbook.test">help@logbook.test</a>.</p>',
  };
});
afterEach(() => {
  env.allowSignup = was.signup;
  env.allowSetup = was.setup;
  env.mailConfigured = was.mail;
  env.claudeConfigured = was.claude;
  env.supportConfigured = was.support;
});

describe('the post-deploy check', () => {
  it('passes when sign-up is open and mail and the AI features are configured', async () => {
    expect(await check()).toEqual([]);
  });

  it('fails when sign-up is closed', async () => {
    env.allowSignup = false;
    env.allowSetup = false;
    const problems = await check();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^Sign-up is closed/);
  });

  it('fails when mail is not configured, and when the AI features are off unless that is allowed', async () => {
    env.mailConfigured = false;
    env.claudeConfigured = false;
    const problems = await check();
    expect(problems.map((p) => p.split(':')[0])).toEqual(['Mail is not configured', 'The AI features are off. Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL (fly secrets set), or pass --allow-no-ai.']);
    expect(await check({ allowNoAi: true })).toHaveLength(1);
  });

  it('fails when the image was built with no support address (critic-03)', async () => {
    env.supportConfigured = false;
    const problems = await check();
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^No support address was built in\. Set VITE_SUPPORT_EMAIL/);
  });

  it('fails when the served web app or the support page still carries an example.com address, or the page is missing', async () => {
    site['/assets/index-abc.js'] = 'const SUPPORT_EMAIL="support@example.com";';
    expect(await check()).toEqual(['The web app still carries the placeholder address support@example.com. Set VITE_SUPPORT_EMAIL under [build.args] in fly.toml and deploy again.']);
    site['/assets/index-abc.js'] = 'ok';
    // a placeholder in a script the page only preloads counts too
    site['/assets/vendor-def.js'] = 'x="support@example.com"';
    expect(await check()).toHaveLength(1);
    site['/assets/vendor-def.js'] = 'ok';
    site['/legal/support.html'] = '<a href="mailto:support@example.com">support@example.com</a>';
    expect(await check()).toEqual(['The support page still shows the placeholder address support@example.com.']);
    site['/legal/support.html'] = null;
    expect(await check()).toEqual(['The support page (/legal/support.html) is missing.']);
  });

  it('a support address counts only when it is real: set, an address, and not on example.com', async () => {
    const { supportOk } = await import('../env.js');
    expect(supportOk('help@logbook.app')).toBe(true);
    for (const bad of [undefined, '', 'support@example.com', 'Support@Example.org', 'not an address']) expect(supportOk(bad), String(bad)).toBe(false);
  });

  it('the Dockerfile passes the support address into the web build and the running server, and fly.toml has the build args', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const docker = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    expect(docker).toMatch(/ARG VITE_SUPPORT_EMAIL/);
    expect(docker).toMatch(/ARG VITE_SITE_ORIGIN/);
    expect(docker).toMatch(/ENV SUPPORT_EMAIL=\$VITE_SUPPORT_EMAIL/);
    const fly = fs.readFileSync(path.join(root, 'fly.toml'), 'utf8');
    expect(fly).toMatch(/\[build\.args\]\s[\s\S]*VITE_SUPPORT_EMAIL = ""[\s\S]*VITE_SITE_ORIGIN = ""/);
    expect(fly).toMatch(/^kill_timeout = "15s"$/m);
  });

  it('fails plainly when the server does not answer', async () => {
    const problems = await runChecks({ origin: 'https://logbook.test', fetchImpl: async () => new Response('bad gateway', { status: 502 }) });
    expect(problems).toEqual(['The server did not answer at https://logbook.test: /api/health answered 502']);
  });

  it('fly.toml opens sign-up for production, and the script is wired into package.json', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const fly = fs.readFileSync(path.join(root, 'fly.toml'), 'utf8');
    expect(fly).toMatch(/^\s*ALLOW_SIGNUP = "1"\s*$/m);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'api', 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['check:deploy']).toBe('node scripts/post-deploy-check.mjs');
  });
});
