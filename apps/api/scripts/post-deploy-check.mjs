#!/usr/bin/env node
/**
 * Run after every deploy:  pnpm --filter @logbook/api check:deploy -- https://your-host
 * (or set APP_URL). Exits non-zero, with one plain line per problem, when the server is not ready for the public:
 *   - it does not answer /api/health;
 *   - sign-up is closed (new people cannot create an account);
 *   - mail is not configured (password reset and email verification would send nothing);
 *   - the AI features are off (no key or no model).
 * Pass --allow-no-ai to skip the last one on a server that is meant to run without Claude.
 */
import { pathToFileURL } from 'node:url';

/** Ask the server and return the problems found (empty when it is ready). `fetchImpl` is injectable for tests. */
export const runChecks = async ({ origin, fetchImpl = fetch, allowNoAi = false }) => {
  const problems = [];
  const base = String(origin).replace(/\/+$/, '');
  const get = async (path) => {
    const res = await fetchImpl(`${base}${path}`, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`${path} answered ${res.status}`);
    return res.json();
  };
  let health;
  try {
    health = await get('/api/health');
    if (!health?.ok) problems.push('The server answered /api/health without ok: true.');
  } catch (e) {
    return [`The server did not answer at ${base}: ${e instanceof Error ? e.message : e}`];
  }
  try {
    const status = await get('/api/auth/status');
    if (status.signupOpen !== true) problems.push('Sign-up is closed: nobody new can create an account. Set ALLOW_SIGNUP = "1" (fly.toml [env]) and deploy again.');
  } catch (e) {
    problems.push(`Could not read /api/auth/status: ${e instanceof Error ? e.message : e}`);
  }
  const ready = health?.ready ?? {};
  if (ready.mail !== true) problems.push('Mail is not configured: password reset and email verification send nothing. Set MAIL_API_KEY and MAIL_FROM (fly secrets set).');
  if (ready.claude !== true && !allowNoAi) problems.push('The AI features are off. Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL (fly secrets set), or pass --allow-no-ai.');
  return problems;
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  const origin = args.find((a) => /^https?:\/\//.test(a)) ?? process.env.APP_URL;
  if (!origin) {
    console.error('Give the server address: pnpm --filter @logbook/api check:deploy -- https://your-host (or set APP_URL).');
    process.exit(2);
  }
  const problems = await runChecks({ origin, allowNoAi: args.includes('--allow-no-ai') });
  if (problems.length) {
    console.error(`Not ready (${origin}):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`Ready: ${origin} answers, sign-up is open, mail and the AI features are configured.`);
}
