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
const was = { signup: env.allowSignup, setup: env.allowSetup, mail: env.mailConfigured, claude: env.claudeConfigured };
const check = (opts: Record<string, unknown> = {}): Promise<string[]> => runChecks({ origin: 'https://logbook.test/', fetchImpl: (url: string, init?: RequestInit) => app.request(url.replace('https://logbook.test', ''), init), ...opts });

beforeEach(() => {
  ({ app } = makeApp());
  env.allowSignup = true;
  env.mailConfigured = true;
  env.claudeConfigured = true;
});
afterEach(() => {
  env.allowSignup = was.signup;
  env.allowSetup = was.setup;
  env.mailConfigured = was.mail;
  env.claudeConfigured = was.claude;
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
