import type { Page } from '@playwright/test';
import { challengeSlots } from '../../shared/src/challenges';
import { expect, go, localDate, newEmail, PASSWORD, savedBy, test } from './helpers';

/**
 * Challenges (apps/web/src/features/orbs/challenge): the row in the foot of Plan your day and its sheet. Offered, never
 * assigned: a challenge can be added, it shows progress in plain words, it pays once when it is done, and skipping or
 * dropping it leaves no trace anywhere.
 *
 * Which day of the week an account is offered its day challenge follows from the account's id, so each test makes
 * accounts until one has today (a handful, as a rule). Orbs earn nothing before their start date, so every session sets
 * the development start-date key (dev builds only; a release build does not read it).
 */
const DEV_START = '2026-11-01';

/** A new account, set up with no habits, whose day challenge falls on today. Two to-dos are on today's list, so the rule's one offer is "Clear this morning's list". */
const accountOnItsDay = async (page: Page): Promise<{ id: string; key: string; today: string; todos: [string, string] }> => {
  await page.addInitScript((start) => {
    try {
      localStorage.setItem('logbook.dev.orbsStart', start);
    } catch {
      /* a page with no storage */
    }
  }, DEV_START);
  await page.goto('/start');
  const today = await localDate(page);
  const key = `challenge:d:${today}`;
  for (let i = 0; i < 80; i++) {
    const created = await page.request.post('/api/auth/signup', { data: { email: newEmail('ch'), password: PASSWORD } });
    expect(created.status(), await created.text()).toBe(201);
    const { id } = (await created.json()) as { id: string };
    if (!challengeSlots(id, today, 1).some((s) => s.key === key)) {
      await page.request.post('/api/auth/logout');
      continue;
    }
    const done = await page.request.post('/api/me/onboarding', { data: { goal: null, wake: 390, leave: 510, habits: [], name: 'Sam', today } });
    expect(done.ok(), await done.text()).toBeTruthy();
    const todos: [string, string] = ['Book the dentist', 'Reply to the landlord'];
    for (const text of todos) expect((await page.request.post('/api/todos', { data: { text, date: today } })).ok()).toBeTruthy();
    await go(page, '/today');
    return { id, key, today, todos };
  }
  throw new Error('no account with a day challenge today in 80 tries');
};

const row = (page: Page) => page.locator('.ch-row');
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Clear this morning’s list', exact: true });
const store = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('logbook.orbs') ?? 'null') as { once: Record<string, { n: number }>; challenges: Record<string, { state: string; item: string }>; days: Record<string, { n: number }> } | null);
/**
 * Check a to-do off in "All to-dos" (on Today a to-do's own check is on the next stop only once the day has a goal, and a
 * goal would change what is offered). Ends when the server has it and the sheet is closed.
 */
const check = async (page: Page, text: string) => {
  await page.getByRole('button', { name: /Open all to-dos/ }).click();
  const list = page.getByRole('dialog', { name: 'To-dos', exact: true });
  const saved = savedBy(page, 'PATCH', /\/api\/todos\//);
  await list.getByRole('checkbox', { name: text, exact: true }).click();
  await saved;
  await list.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

test('a challenge is offered, added, shows progress, and pays once when it is done', async ({ page }) => {
  const { key, today, todos } = await accountOnItsDay(page);

  // offered: one row, the rule's title, what it is and what it is worth. Nothing else marks it: no badge, no tip.
  await expect(row(page)).toHaveCount(1);
  await expect(row(page)).toHaveAccessibleName('Clear this morning’s list. Today’s challenge · 5 Orbs. Open');
  await expect(row(page).getByText('Today’s challenge · 5 Orbs')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const box = await row(page).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(56);

  // the sheet: the eyebrow, the title, one line saying what counts and what it pays, one Sky button, a quiet Skip
  await row(page).click();
  await expect(sheet(page).getByText('Today’s challenge', { exact: true })).toBeVisible();
  await expect(sheet(page).getByText('Every to-do on today’s list when you add this. 5 Orbs.')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
  // this challenge has no size, and this server has no assistant to ask: neither action is offered
  await expect(sheet(page).getByRole('button', { name: 'Easier' })).toHaveCount(0);
  await expect(sheet(page).getByRole('button', { name: 'Ask the assistant to pick' })).toHaveCount(0);
  expect(await sheet(page).locator('.btn.primary').count()).toBe(1);

  // added: the row says so, with no worth until it is done
  await sheet(page).getByRole('button', { name: 'Add to today', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row(page).getByText('Added to today')).toBeVisible();
  await expect(row(page)).not.toContainText('Orbs');
  // the sheet now shows where it stands, and a quiet way out
  await row(page).click();
  await expect(sheet(page).getByText('Added to today')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Drop it', exact: true })).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Add to today' })).toHaveCount(0);
  await sheet(page).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // progress, in plain words
  await check(page, todos[0]);
  await expect(row(page).getByText('1 of 2 done')).toBeVisible();
  // done: it reads Done with what it paid, for the rest of the day
  await check(page, todos[1]);
  await expect(row(page).getByText('Done · 5 Orbs')).toBeVisible();
  await expect.poll(async () => (await store(page))?.once[key]?.n).toBe(5);
  await expect.poll(async () => (await store(page))?.challenges[key]?.state).toBe('done');
  // two to-dos and the challenge: 2 Orbs in the day, 5 paid once
  await expect.poll(async () => (await store(page))?.days[today]?.n).toBe(2);

  // it pays once: undo a to-do and do it again, and nothing more is paid
  const undone = savedBy(page, 'PATCH', /\/api\/todos\//);
  await page.getByRole('button', { name: `Done: ${todos[1]}. Mark not done`, exact: true }).click();
  await undone;
  await expect(row(page).getByText('Done · 5 Orbs')).toBeVisible();
  await expect.poll(async () => (await store(page))?.days[today]?.n).toBe(1);
  await check(page, todos[1]);
  await expect(row(page).getByText('Done · 5 Orbs')).toBeVisible();
  await expect.poll(async () => (await store(page))?.days[today]?.n).toBe(2);
  await page.waitForTimeout(2500);
  const after = (await store(page))!;
  expect(after.once[key]).toMatchObject({ n: 5 });
  expect(Object.keys(after.once).filter((k) => k.startsWith('challenge:'))).toEqual([key]);

  // and it is still there, done, after a reload
  await go(page, '/today');
  await expect(row(page).getByText('Done · 5 Orbs')).toBeVisible();
  await row(page).click();
  await expect(sheet(page).getByText('Done · 5 Orbs')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: /Add to today|Skip|Drop it/ })).toHaveCount(0);
});

test('skipping a challenge leaves no trace', async ({ page }) => {
  const { key, today, todos } = await accountOnItsDay(page);
  await expect(row(page)).toHaveCount(1);
  await row(page).click();
  await sheet(page).getByRole('button', { name: 'Skip', exact: true }).click();
  // the sheet goes, the row goes, and nothing says a word about it: no toast, no line
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/challenge/i);
  await expect.poll(async () => (await store(page))?.challenges[key]?.state).toBe('skipped');
  // finishing what it asked for pays nothing for it
  await page.waitForTimeout(3500);
  await check(page, todos[0]);
  await check(page, todos[1]);
  await expect.poll(async () => (await store(page))?.days[today]?.n).toBe(2);
  expect(Object.keys((await store(page))!.once)).toEqual([]);
  // nor does it come back after a reload (the account's copy on the server agrees)
  await go(page, '/today');
  expect((await store(page))!.challenges[key]?.state).toBe('skipped');
  await expect(row(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/challenge/i);
});

test('a challenge that was added can be dropped, and is not mentioned again', async ({ page }) => {
  const { key } = await accountOnItsDay(page);
  await row(page).click();
  await sheet(page).getByRole('button', { name: 'Add to today', exact: true }).click();
  await expect(row(page).getByText('Added to today')).toBeVisible();
  // give the phone time to tell the server it was added, so the drop has a copy to hold against
  await page.waitForTimeout(3500);
  await row(page).click();
  await sheet(page).getByRole('button', { name: 'Drop it', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row(page)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/challenge/i);
  await page.waitForTimeout(3500);
  await go(page, '/today');
  await expect(row(page)).toHaveCount(0);
  expect((await store(page))!.challenges[key]?.state).toBe('skipped');
  expect(Object.keys((await store(page))!.once)).toEqual([]);
});
