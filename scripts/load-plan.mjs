#!/usr/bin/env node
/**
 * Load a plan file into your Logbook account: `pnpm plan:load` (or `pnpm plan:load plans/<file>.json`).
 *
 * The plan replaces what was only planned on its dates and stops on its last day: anything planned after it is cleared
 * and an older block ends the day before it starts. Runs you already marked (done, skipped, sick) are never touched.
 * It signs in with your email and password (typed here, sent only to your own server) and signs out when it is done.
 */
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const file = process.argv[2] ?? 'plans/2026-10-banking-plan.json';
const server = (process.env.LOGBOOK_URL ?? 'https://josh-logbook.fly.dev').replace(/\/$/, '');
const draft = JSON.parse(readFileSync(file, 'utf8'));

const ask = (q, hidden = false) =>
  new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
    if (hidden) rl._writeToOutput = (s) => rl.output.write(s.startsWith(q) ? s : '');
    rl.question(q, (a) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      done(a.trim());
    });
  });

const miles = draft.sessions.reduce((m, s) => m + (s.miles ?? 0), 0);
console.log(`\n${draft.name}: ${draft.start} to ${draft.end}, ${draft.sessions.length} sessions, ${miles} miles.`);
console.log(`Loading into ${server}. Anything only planned after ${draft.end} is cleared.\n`);

const email = process.env.LOGBOOK_EMAIL || (await ask('Email: '));
const password = await ask('Password: ', true);

const login = await fetch(`${server}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
if (!login.ok) {
  console.error(`\nSign-in failed (${login.status}): ${(await login.json().catch(() => ({}))).error ?? 'is the server running? Try: fly status'}`);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() ?? [login.headers.get('set-cookie') ?? '']).map((c) => c.split(';')[0]).join('; ');

const res = await fetch(`${server}/api/plans/apply`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ draft, mode: 'replace', only: true, source: 'file' }) });
const out = await res.json().catch(() => ({}));
await fetch(`${server}/api/auth/logout`, { method: 'POST', headers: { cookie } }).catch(() => {});
if (!res.ok) {
  console.error(`\nThe plan didn’t load (${res.status}): ${out.error ?? JSON.stringify(out)}`);
  process.exit(1);
}
console.log(`\nDone. "${out.block?.name ?? draft.name}" is on your calendar through ${draft.end}. Open the app and pull down on Today to refresh.`);
