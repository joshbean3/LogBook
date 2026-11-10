// Screenshots the live app with the Sunrise override stylesheet injected (no source changes).
// usage: node mock.mjs [screens,comma,separated] [--before]
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
import { ICONS } from './icons.mjs';
const B = 'http://localhost:5220';
const D = '/home/user/LogBook/docs/brand';
const OUT = process.env.OUT || `${D}/mockups`;
const STATE = '/tmp/claude-0/-home-user-LogBook/203fe2a6-2bdf-53d9-a92e-1cbd9356aa24/scratchpad/tools/state.json';
const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].split(',') : null;
const before = process.argv.includes('--before');
const run = (n) => !only || only.includes(n);
const css = fs.readFileSync(`${D}/mockups/override.css`, 'utf8');
const opts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

const b = await chromium.launch();
async function newPage(signedIn = true) {
  const ctx = await b.newContext({ ...opts, ...(signedIn ? { storageState: STATE } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  // serve the brand fonts and the Orb art at the paths override.css names (in the app these live in apps/web/public)
  await page.route((u) => u.pathname.startsWith('/brand/'), (r) => {
    const p = new URL(r.request().url()).pathname.replace('/brand/', '');
    const file = p.startsWith('fonts/') ? `${D}/${p}` : `${D}/assets/${p}`;
    const type = file.endsWith('.svg') ? 'image/svg+xml' : 'font/woff2';
    r.fulfill({ body: fs.readFileSync(file), contentType: type });
  });
  if (signedIn && !before) await seed(page);
  return page;
}
// Seed data for the mockups, in the browser only (nothing is written to the server): eight weeks of runs before this
// week plus Monday's 4.2 mi, two habits lit today with a few past checks, and the habit names in sentence case.
const T0 = '2026-11-10';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const WEEKS = [[12, 11.2], [14, 13.6], [15, 12.4], [16, 15.8], [18, 17.1], [15, 14.6], [20, 18.9], [22, 21.3]]; // [planned, done] for the 8 weeks before Nov 9
function synth(month) {
  const sessions = [], activities = [], checks = [];
  WEEKS.forEach(([plan, done], i) => {
    const mon = addDays('2026-11-09', -7 * (WEEKS.length - i));
    const split = [0.25, 0.3, 0.45], days = [1, 3, 6];
    days.forEach((dd, k) => {
      const date = addDays(mon, dd); if (date.slice(0, 7) !== month) return;
      const miles = Math.round(plan * split[k] * 10) / 10, dm = Math.round(done * split[k] * 10) / 10;
      sessions.push({ id: 'seed-s-' + date, date, position: 0, kind: 'run', type: k === 2 ? 'Long' : 'Easy', title: null, details: null, miles, minutes: null, blockId: null, movedFrom: null, mark: null, effort: null });
      activities.push({ id: 'seed-a-' + date, date, time: '06:40', name: k === 2 ? 'Long run' : 'Easy run', sportType: 'Run', kind: 'run', miles: dm, movingSec: Math.round(dm * 560), elevFt: 120, avgHr: 142, maxHr: 160, cadence: 172, laps: null, perfAt: null, polyline: null });
    });
  });
  if (month === '2026-11') activities.push({ id: 'seed-a-2026-11-09', date: '2026-11-09', time: '06:35', name: 'Easy run', sportType: 'Run', kind: 'run', miles: 4.2, movingSec: 2310, elevFt: 80, avgHr: 140, maxHr: 155, cadence: 172, laps: null, perfAt: null, polyline: null });
  return { sessions, activities, checks };
}
const LIT = { hzAo0taJghnTC: ['2026-11-10', '2026-11-09', '2026-11-07', '2026-11-06'], hlSwmm9h6Lc7P: ['2026-11-10', '2026-11-08', '2026-11-05'], h7lyExjlB1piM: ['2026-11-09'] };
const NAMES = { 'Read 15 Min': 'Read 15 min', 'Guitar 5 Min': 'Guitar 5 min', '100 Morning Pushups': '100 morning pushups', 'Screen Time Under 2 h': 'Screen time under 2 h' };
async function seed(page) {
  await page.route((u) => /^\/api\/months\/\d{4}-\d{2}$/.test(u.pathname), async (r) => {
    const res = await r.fetch(); let j; try { j = await res.json(); } catch { return r.fulfill({ response: res }); }
    const add = synth(j.month);
    const seen = new Set(j.sessions.map((x) => x.date + x.kind));
    j.sessions = [...j.sessions, ...add.sessions.filter((x) => !seen.has(x.date + x.kind))];
    j.activities = [...j.activities, ...add.activities];
    for (const [hid, ds] of Object.entries(LIT)) for (const d of ds) if (d.slice(0, 7) === j.month) j.checks.push({ habitId: hid, date: d, done: true, note: null });
    await r.fulfill({ response: res, json: j });
  });
  await page.route((u) => u.pathname === '/api/bootstrap', async (r) => {
    const res = await r.fetch(); let j; try { j = await res.json(); } catch { return r.fulfill({ response: res }); }
    for (const h of j.habits || []) if (NAMES[h.name]) h.name = NAMES[h.name];
    await r.fulfill({ response: res, json: j });
  });
}
const PROGRESS_GLYPH = ICONS.progress;
// the week horizon (guide 8.5): a ruler (Haze track, Deep Sky fill, Sunrise NOW tick, Night Ink plan-by-today triangle)
// over a horizon of half-suns, one per run day. Proposed component, drawn by this script.
function weekHorizon() {
  const W = 326, x0 = 8, x1 = W - 8, sc = (x1 - x0) / 23, done = 4.2, byToday = 4, H = 104;
  const days = [['M', 'done', 4.2], ['T', 'none'], ['W', 'plan', 6.5], ['T', 'none'], ['F', 'plan', 5.5], ['S', 'plan', 7], ['S', 'none']];
  const col = (W - 16) / 7, hy = 80, r = (mi) => Math.min(20, 6 + 1.5 * mi);
  const suns = days.map(([l, k, mi], i) => {
    const cx = 8 + col * i + col / 2;
    let g = '';
    if (k === 'done') g = `<path d="M${cx - r(mi)} ${hy} A ${r(mi)} ${r(mi)} 0 0 1 ${cx + r(mi)} ${hy} Z" fill="#38B6F2"/><path d="M${cx - r(mi)} ${hy} A ${r(mi)} ${r(mi)} 0 0 1 ${cx + r(mi)} ${hy}" fill="none" stroke="#0A6CA6" stroke-width="1.5"/>`;
    else if (k === 'plan') g = `<path d="M${cx - r(mi)} ${hy} A ${r(mi)} ${r(mi)} 0 0 1 ${cx + r(mi)} ${hy}" fill="none" stroke="#0A6CA6" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    else g = `<circle cx="${cx}" cy="${hy - 4}" r="2" fill="#7A8794"/>`;
    return g + `<text x="${cx}" y="${hy + 17}" text-anchor="middle" class="wh-cap" fill="${i === 1 ? '#0E2236' : '#46596D'}">${l}</text>`;
  }).join('');
  const fx = x0 + done * sc, tx = x0 + byToday * sc;
  return `<div class="wh" aria-label="This week: 4.2 of 23 miles, 1 of 4 runs"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="${x0}" y="22" width="${x1 - x0}" height="6" rx="3" fill="#CBE8F8"/><rect x="${x0}" y="22" width="${fx - x0}" height="6" rx="3" fill="#0A6CA6"/>
    <path d="M${tx - 4} 38 L${tx + 4} 38 L${tx} 32 Z" fill="#0E2236"/>
    <rect x="${fx - 1}" y="18" width="2" height="14" rx="1" fill="#F2600C" stroke="#FFFDF8" stroke-width="2" paint-order="stroke"/>
    <text x="${fx}" y="12" text-anchor="middle" class="wh-cap" fill="#B4430C">Now</text>
    <text x="${x1}" y="12" text-anchor="end" class="wh-cap" fill="#46596D" style="font-variant-numeric:tabular-nums">23 mi</text>
    <line x1="0" x2="${W}" y1="${hy}" y2="${hy}" stroke="rgba(14,34,54,.22)" stroke-width="1"/>${suns}</svg></div>`;
}
const style = async (page) => {
  if (!before) {
    await page.addStyleTag({ content: css });
    await page.evaluate(({ g, wh }) => {
      for (const s of document.querySelectorAll('.tab-item[data-tab="progress"] svg')) { s.innerHTML = g; s.setAttribute('stroke-width', '1.75'); s.setAttribute('class', ''); }
      const head = document.querySelector('.card.ph[aria-label="Running"] .ph-head');
      if (head && !document.querySelector('.wh')) head.insertAdjacentHTML('afterend', wh);
      // the gauge readout: the card already says "this week", so the pill reads "4.2 of 23 mi · 1 of 4 runs" (6.5)
      for (const el of document.querySelectorAll('.hero-week')) { const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) n.nodeValue = n.nodeValue.replace(/ this week/, ''); }
    }, { g: PROGRESS_GLYPH, wh: weekHorizon() });
    await page.evaluate(() => { for (const el of document.querySelectorAll('.hero-stamp, .lc-big')) el.textContent = el.textContent.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()); const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (/Logbook/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/Logbook/g, 'Orby'); return document.fonts.ready; });
  }
  await page.waitForTimeout(500);
};
const rename = (page) => before ? null : page.evaluate(() => { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (/Logbook/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/Logbook/g, 'Orby'); });
const go = async (page, p, ms = 2600) => { await page.goto(B + p, { waitUntil: 'load' }); await page.waitForTimeout(ms); await style(page); };
const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}${before ? '-before' : ''}.png` });
const tap = async (page, loc) => { await loc.scrollIntoViewIfNeeded(); const bb = await loc.boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(900); };
const scrollTab = async (page, y) => { await page.evaluate((y) => { const s = [...document.querySelectorAll('.tab-scroll')].find((e) => e.offsetParent !== null && getComputedStyle(e.closest('.tab') || e).visibility !== 'hidden'); (s || document.scrollingElement).scrollTo(0, y); }, y); await page.waitForTimeout(700); };

const page = await newPage();
if (run('today')) { await go(page, '/today', 3500); await shot(page, 'today'); await scrollTab(page, 380); await shot(page, 'today-habits'); }
if (run('goals')) { await go(page, '/goals'); await shot(page, 'goals'); }
if (run('learned')) { await go(page, '/learned'); await shot(page, 'learned'); }
if (run('plan')) { await go(page, '/plan'); await shot(page, 'plan'); }
if (run('progress')) { await go(page, '/progress'); await shot(page, 'progress'); }
if (run('journal')) { await go(page, '/journal'); await shot(page, 'journal'); }
if (run('settings')) { await go(page, '/settings'); await shot(page, 'settings'); }
if (run('assistant')) {
  const p2 = await newPage();
  // browser-only: answer the consent read as already chosen, so the real sheet shows; nothing is written to the server
  const C = { training: true, health: null, recall: false, reads: false, at: new Date().toISOString(), version: '2026-11' };
  await p2.route((u) => u.pathname === '/api/me/consent', (r) => r.request().method() === 'GET' ? r.fulfill({ json: { consent: C } }) : r.abort());
  await p2.route((u) => u.pathname === '/api/bootstrap', async (r) => { const res = await r.fetch(); try { const j = await res.json(); j.consent = C; await r.fulfill({ response: res, json: j }); } catch { await r.fulfill({ response: res }); } });
  await go(p2, '/today', 3000);
  await tap(p2, p2.locator('.dock-ask').first()); await p2.waitForTimeout(1500); await rename(p2);
  await shot(p2, 'assistant');
}
if (run('welcome')) {
  const p3 = await newPage(false);
  await go(p3, '/start', 3500); await shot(p3, 'welcome');
}
if (run('crops')) {
  const C = process.env.CROPS || '/tmp/claude-0/-home-user-LogBook/203fe2a6-2bdf-53d9-a92e-1cbd9356aa24/scratchpad/brand/deck/img';
  const ctx3 = await b.newContext({ ...opts, deviceScaleFactor: 3, storageState: STATE });
  const pc = await ctx3.newPage();
  await pc.route((u) => u.pathname.startsWith('/brand/'), (r) => { const p = new URL(r.request().url()).pathname.replace('/brand/', ''); const file = p.startsWith('fonts/') ? `${D}/${p}` : `${D}/assets/${p}`; r.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'font/woff2' }); });
  await seed(pc);
  await go(pc, '/today', 3500);
  const clip = async (sel, name, pad = 16, first = true) => {
    const el = pc.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); await pc.waitForTimeout(500);
    const bb = await el.boundingBox(); if (!bb) { console.log('no', sel); return; }
    const x = Math.max(0, bb.x - pad), y = Math.max(0, bb.y - pad);
    await pc.screenshot({ path: `${C}/${name}`, clip: { x, y, width: Math.min(390 - x, bb.width + 2 * pad), height: bb.height + 2 * pad } });
    console.log('crop', name);
  };
  await clip('.dock', 'crop-dock.png', 8);
  await clip('.ctx-chip >> xpath=..', 'crop-chips.png', 12);
  await clip('.nb-strip', 'crop-week.png', 4);
  await clip('.hero.aura', 'crop-hero.png', 16);
  { // the gauge: the hero card's width, from its top to the bottom of the arc
    const r = await pc.evaluate(() => { const h = [...document.querySelectorAll('.hero.aura')].find((e) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.left < 100; }); h.scrollIntoView({ block: 'center' }); return true; });
    await pc.waitForTimeout(600);
    const box = await pc.evaluate(() => { const h = [...document.querySelectorAll('.hero.aura')].find((e) => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.left < 100; }); const a = h.getBoundingClientRect(), g = h.querySelector('svg').getBoundingClientRect(); return { x: a.left + 1, y: a.top + 1, width: a.width - 2, height: g.bottom - a.top + 8 }; });
    await pc.screenshot({ path: `${C}/crop-gauge.png`, clip: box });
    console.log('crop crop-gauge.png');
  }
  await clip('.hero-when', 'crop-seg.png', 10);
  { // habits: the section title to the bottom of the grid, in the visible day page, clear of the sticky bars and the dock
    const vis = `(sel) => [...document.querySelectorAll(sel)].find((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.left < 100; })`;
    await pc.evaluate((v) => { const f = eval(v); const g = f('.orbs.is-grid'); const sc = g.closest('.tab-scroll') || document.scrollingElement; sc.scrollTo(0, sc.scrollTop + g.getBoundingClientRect().top - 260); }, vis);
    await pc.waitForTimeout(900);
    const box = await pc.evaluate((v) => { const f = eval(v); const g = f('.orbs.is-grid').getBoundingClientRect(); return { x: 0, y: g.top - 78, width: 390, height: g.height + 78 + 16 }; }, vis);
    await pc.screenshot({ path: `${C}/crop-habits.png`, clip: box });
    console.log('crop crop-habits.png');
  }
}
await b.close();
console.log('done');
