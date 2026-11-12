#!/usr/bin/env node
/**
 * Fitness off, on the running app: no screen may speak of training. The unit test (src/lib/fitnessOff.test.tsx) holds the
 * words the code writes; this walks the real screens with real data, where a row built from the account can still say
 * "run". It sets the device preference (`logbook.prefs`, lib/prefs.ts) to Fitness off, opens each screen at 390 x 844, and
 * reads what a person can see or hear: the text of what is displayed, plus every aria-label, placeholder and title.
 *
 *   node apps/web/scripts/check-fitness-off.mjs http://localhost:5220 --state path/to/storageState.json [--allow "words a person typed"]...
 *
 * It fails (exit 1) on run, lift, mile, plan, training, workout, Strava or fitness as whole words (and their plain
 * forms: runs, running, ran, lifts, miles, mi, plans, planned, train, workouts).
 *
 * Allowed, and why:
 *   "Plan your day", "Plan the day", "The plan",  Today's own section and its empty line on a past day: the goal and the
 *   "Nothing was planned."                        to-dos, not a training plan.
 *   the Fitness row in Settings                   the switch that turns it back on has to say its name.
 *   --allow "..."                                 words the person typed (a to-do, a journal entry, a habit's name): the
 *                                                 app shows what they wrote. Pass each as it is written.
 * Fitness routes must lead to Today: /plan, /fitness, /settings/training, /settings/plans and a running metric page.
 */
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';

const args = process.argv.slice(2);
const base = args.find((a) => /^https?:/.test(a)) || 'http://localhost:5220';
const flag = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const state = flag('--state')[0];
const typed = flag('--allow');

const WORDS = /\b(run|runs|running|ran|runner|lift|lifts|lifting|mile|miles|mi|mileage|plan|plans|planned|training|train|workout|workouts|strava|fitness)\b/gi;
const ALLOW = ['Plan your day', 'Plan the day', 'The plan', 'Nothing was planned.'];
/** The Settings row that carries the switch: its title, its line and its spoken name. */
const SWITCH_ROW = [/^Fitness$/, /^Training plan, runs and lifts$/];

const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** [route, hour of the page clock, what to do before reading] */
const SCREENS = [
  ['/today', 9],
  ['/today', 21],
  [`/today/${day(-1)}`, 9],
  [`/today/${day(-3)}`, 9],
  [`/today/${day(1)}`, 9],
  [`/today/${day(0)}/morning`, 9],
  ['/goals', 9],
  ['/goals/history', 9],
  ['/learned', 9],
  ['/progress', 9],
  ['/progress/metric/sleep', 9],
  ['/progress/metric/consistency', 9],
  ['/journal', 9],
  ['/settings', 9],
  ['/settings/you', 9],
  ['/settings/habits', 9],
  ['/settings/connections', 9],
  ['/settings/privacy', 9],
  ['/settings/app', 9],
  ['/settings/data', 9],
  ['/settings/account', 9],
  ['/today', 9, 'assistant'],
];
const REDIRECTS = ['/plan', '/fitness', '/plan/week/2026-11-09', '/settings/training', '/settings/plans', '/progress/metric/mileage', '/progress/metric/lifts'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: state, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  sessionStorage.setItem('logbook-splash-played', '1');
  localStorage.setItem('logbook.prefs', JSON.stringify({ fitness: false }));
});

/** Everything on the page a person can see or hear, each with where it was. */
const read = (page) =>
  page.evaluate(() => {
    const out = [];
    // the page on top: the last pushed layer of the shown tab, else its root; a page under it is covered
    const layers = document.querySelectorAll('.tab[data-active] .pushed');
    const top = layers.length ? layers[layers.length - 1] : null;
    const shown = (el) => {
      // the day pager's neighbors and a tab that is not shown are off screen and inert
      if (el.closest('[inert]')) return false;
      const tab = el.closest('.tab');
      if (tab && (!tab.hasAttribute('data-active') || (top && !top.contains(el)))) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      const el = n.parentElement;
      if (!t || !el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !shown(el)) continue;
      out.push({ text: t, where: el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase() });
    }
    for (const el of document.querySelectorAll('[aria-label], [placeholder], [title], [alt]')) {
      if (!shown(el)) continue;
      for (const a of ['aria-label', 'placeholder', 'title', 'alt']) {
        const t = el.getAttribute(a);
        if (t) out.push({ text: t, where: `${a} on .${String(el.className).split(' ')[0]}` });
      }
    }
    return out;
  });

let bad = 0;
for (const [route, hour, act] of SCREENS) {
  const page = await ctx.newPage();
  const at = new Date();
  at.setHours(hour, 30, 0, 0);
  await page.clock.install({ time: at });
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  if (act === 'assistant') {
    await page.locator('.dock-ask').click();
    await page.waitForTimeout(1200);
  }
  const hits = [];
  for (const { text, where } of await read(page)) {
    if (typed.some((w) => text.includes(w))) continue;
    if (route.startsWith('/settings') && SWITCH_ROW.some((r) => r.test(text))) continue;
    let rest = text;
    for (const a of ALLOW) rest = rest.split(a).join(' ');
    const m = rest.match(WORDS);
    if (m) hits.push(`    ${[...new Set(m.map((x) => x.toLowerCase()))].join(', ')}: "${text.slice(0, 110)}" (${where})`);
  }
  const name = `${route}${hour === 21 ? ' (evening)' : ''}${act ? ` + ${act}` : ''}`;
  if (hits.length) {
    bad += hits.length;
    console.log(`FAIL ${name}\n${[...new Set(hits)].join('\n')}`);
  } else console.log(`ok   ${name}`);
  await page.close();
}
for (const route of REDIRECTS) {
  const page = await ctx.newPage();
  await page.goto(base + route, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  const at = new URL(page.url()).pathname;
  if (at !== '/today') {
    bad++;
    console.log(`FAIL ${route} stayed on ${at}: a Fitness route must lead to Today`);
  } else console.log(`ok   ${route} leads to Today`);
  await page.close();
}
await browser.close();
console.log(bad ? `\n${bad} place(s) still speak of training with Fitness off.` : '\nFitness off: no screen speaks of training.');
process.exit(bad ? 1 : 0);
