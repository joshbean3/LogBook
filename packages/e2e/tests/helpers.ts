import { expect, test as base, type Page } from '@playwright/test';
import fs from 'node:fs';

export const PASSWORD = 'correct-horse-battery-9';

/**
 * The app opens with a 2.8 second sunrise once per session (apps/web/src/app/BrandSplash.tsx), and with a quiet 300 ms
 * fade whenever the same session opens it again. Tests are about the app, so every test's session starts with the
 * opening already seen: the same mark the app itself leaves in sessionStorage. A test of the opening asks for it with
 * `test.use({ opening: 'sunrise' })`.
 *
 * The first time a tab is opened, a short tip rises over it (apps/web/src/features/tips). For the same reason every
 * test's session starts with the four tips already seen: the mark the app leaves in localStorage when a tip is dismissed.
 * A test of first run or of the tips asks for them with `test.use({ tips: 'first' })` and dismisses each with `gotIt`.
 */
export const test = base.extend<{ opening: 'quiet' | 'sunrise'; tips: 'seen' | 'first' }>({
  opening: ['quiet', { option: true }],
  tips: ['seen', { option: true }],
  context: async ({ context, opening, tips }, use) => {
    if (opening === 'quiet') {
      await context.addInitScript(() => {
        try {
          sessionStorage.setItem('logbook-splash-played', '1');
        } catch {
          /* a page with no storage */
        }
      });
    }
    if (tips === 'seen') {
      await context.addInitScript(() => {
        try {
          // once per session, so signing out (which removes every `logbook.` key) leaves the key gone
          if (sessionStorage.getItem('e2e-tips-seen') === '1') return;
          sessionStorage.setItem('e2e-tips-seen', '1');
          localStorage.setItem('logbook.tips', JSON.stringify({ seen: ['today', 'goals', 'plan', 'journal'] }));
        } catch {
          /* a page with no storage */
        }
      });
    }
    await use(context);
  },
});
export { expect };

/**
 * A tab's first-visit tip (with `tips: 'first'`): waits for it to rise over the tab, checks it is that place's, and
 * dismisses it with its one Sky button. Ends when the sheet has gone and the tab takes taps again.
 */
export const gotIt = async (page: Page, place: 'Today' | 'Goals' | 'Fitness' | 'Journal') => {
  const tip = page.getByRole('dialog', { name: place, exact: true });
  await expect(tip.getByRole('button', { name: 'Got it', exact: true })).toBeVisible();
  await expect(tip.getByText('How it works', { exact: true })).toBeVisible();
  await tip.getByRole('button', { name: 'Got it', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

/** A fresh address for every account, so tests never share one (and can run side by side). */
export const newEmail = (tag: string) => `e2e-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@example.com`;

/** The browser's local date as YYYY-MM-DD (the app's days are the person's, not the server's). */
export const localDate = (page: Page) => page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

/**
 * A new account that has finished setup, made through the API (fast), with one habit, "Stretch". The context's cookie is
 * the new session, so the page that follows is signed in. Ends on Today.
 */
export const signUpByApi = async (page: Page, opts: { habits?: string[]; name?: string } = {}) => {
  const email = newEmail('api');
  await page.goto('/start');
  const created = await page.request.post('/api/auth/signup', { data: { email, password: PASSWORD } });
  expect(created.status(), await created.text()).toBe(201);
  const done = await page.request.post('/api/me/onboarding', {
    data: { goal: '5k', runDays: ['tue', 'thu', 'sun'], longRunDay: 'sun', weeklyMiles: 10, wake: 390, leave: 510, habits: opts.habits ?? ['Stretch'], name: opts.name ?? 'Sam', today: await localDate(page) },
  });
  expect(done.ok(), await done.text()).toBeTruthy();
  await go(page, '/today');
  return email;
};

/**
 * A new account that has not been through setup, made through the API: the page that follows is signed in and lands on
 * setup's first question (/welcome/name).
 */
export const signUpForSetup = async (page: Page) => {
  const email = newEmail('setup');
  await page.goto('/start');
  const created = await page.request.post('/api/auth/signup', { data: { email, password: PASSWORD } });
  expect(created.status(), await created.text()).toBe(201);
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/welcome\/name/, { timeout: 30_000 });
  return email;
};

/**
 * Opens a route and waits for the app to settle on it. Right after sign-up the app can still move itself to Today once
 * its first data lands, so a route that did not stick is opened again.
 */
export const go = async (page: Page, path: string) => {
  for (let i = 0; i < 3; i++) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    if (new URL(page.url()).pathname === path) return;
  }
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`));
};

/** Resolves when the server has answered a write (method and path) with success: the change is saved, not just shown. */
export const savedBy = (page: Page, method: string | RegExp, path: RegExp) =>
  page.waitForResponse((r) => (typeof method === 'string' ? r.request().method() === method : method.test(r.request().method())) && path.test(new URL(r.url()).pathname) && r.ok(), { timeout: 30_000 });

/**
 * From the welcome pager to the account form: Get started (it is on every page of the pager), then the privacy page
 * left as it is (nothing allowed).
 */
export const startSignUp = async (page: Page) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/start/);
  await page.getByRole('button', { name: 'Get started' }).click();
  // the privacy page: what goes where. Continue without switching anything on.
  await page.getByRole('button', { name: /^(Continue|Not now)$/ }).first().click();
};

/** The account form on /signup: email, then password. Ends when the account exists and setup has opened. */
export const createAccount = async (page: Page, email: string) => {
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  // an age or terms line, when there is one, is a checkbox or a switch to tick before the account can be made
  for (const box of await page.getByRole('checkbox').all()) if (!(await box.isChecked())) await box.check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/welcome/, { timeout: 30_000 });
};

const FORWARD = /^(Next|Continue|Not now|Skip for now|Continue without|Open Today)$/;

/**
 * Walks setup one step at a time, the way a person who takes the defaults would: types a name, picks the first answer
 * where a choice is needed (Yes to training, Just running), picks the "Stretch" habit, and goes on through the plan
 * being written to the reveal and "Open Today". The tour is not in the path (the reveal's quiet link opens it). Written
 * against what each step shows, not its order, so a reordered or added step does not break it.
 */
export const finishSetup = async (page: Page, opts: { habit?: string } = {}) => {
  const habit = opts.habit ?? 'Stretch';
  for (let step = 0; step < 60; step++) {
    if (/\/today/.test(page.url())) break;
    await page.waitForTimeout(400);
    if (!/\/welcome/.test(page.url())) continue;
    if (/\/welcome\/habits/.test(page.url())) {
      const tile = page.getByRole('button', { name: habit, exact: true });
      if ((await tile.isVisible()) && (await tile.getAttribute('aria-pressed')) !== 'true') await tile.click();
    }
    for (const input of await page.locator('input[type=text]:visible, input:not([type]):visible').all()) if (!(await input.inputValue())) await input.fill('Sam');
    const radios = page.locator('[role=radio]:visible');
    if ((await radios.count()) && !(await page.locator('[role=radio][aria-checked=true]:visible').count())) await radios.first().click();
    const forward = page.getByRole('button', { name: FORWARD }).filter({ visible: true });
    if (await forward.count()) await forward.last().click();
  }
  await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });
};

/**
 * Sign out from Settings, through the confirmation sheet. Sign out lives on the Account page (Settings, Account), so the
 * helper opens that page; where a build still has it on the Settings root, the root's button is used. Ends on the
 * signed-out screens.
 */
export const signOut = async (page: Page) => {
  await page.getByRole('link', { name: 'Profile and settings' }).click();
  await expect(page).toHaveURL(/\/settings/);
  const button = page.getByRole('button', { name: 'Sign out', exact: true }).first();
  if (!(await button.isVisible().catch(() => false))) await go(page, '/settings/account');
  await button.click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true });
  await confirm.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect(page).toHaveURL(/\/(start|login)/, { timeout: 30_000 });
};

/** The reset link the API logs when no mail provider is set (development), for the newest mail to `email`. */
export const resetLinkFromLog = async (email: string): Promise<string | null> => {
  const file = process.env.E2E_API_LOG;
  if (!file) return null;
  for (let i = 0; i < 20; i++) {
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    // one block per mail: "[mail] ...\n  To: <address>\n  Subject: ...\n\n<text with the link>"
    const block = text.split('[mail]').filter((b) => b.toLowerCase().includes(`to: ${email.toLowerCase()}`) && b.includes('/login?reset=')).at(-1);
    const m = block?.match(/\/login\?reset=([A-Za-z0-9_-]+)/);
    if (m) return `/login?reset=${m[1]}`;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
};
