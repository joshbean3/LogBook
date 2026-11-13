import type { Page } from '@playwright/test';
import { expect, go, gotIt, signUpByApi, test } from './helpers';

/**
 * First-visit tips (apps/web/src/features/tips): the first time each tab is on screen at its root, one small sheet rises
 * over it and says how the place works and how it is tracked. One per place, once per phone; Settings can show them again.
 */
test.use({ tips: 'first' });

const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: new RegExp(`^${name}`) });
const tip = (page: Page, place: string) => page.getByRole('dialog', { name: place, exact: true });
const seen = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('logbook.tips') ?? '{"seen":[]}') as { seen: string[] }).seen);
/** Long enough for a tip that was due to have risen (it waits about 600 ms for a tab that is painted and still). */
const settle = (page: Page) => page.waitForTimeout(1800);

test('each tab’s tip rises once, says how it works and how it is tracked, and is gone for good', async ({ page }) => {
  await signUpByApi(page);

  // Today: the place's name is the title; two groups; one Sky button and one quiet link
  const today = tip(page, 'Today');
  await expect(today.getByRole('button', { name: 'Got it', exact: true })).toBeVisible();
  await expect(today.getByText('How it works', { exact: true })).toBeVisible();
  await expect(today.getByRole('heading', { name: 'How it’s tracked' })).toBeVisible();
  await expect(today.getByText('One goal for the day')).toBeVisible();
  await expect(today.getByText('Habits are tiles')).toBeVisible();
  await expect(today.getByText('Saved when you tap')).toBeVisible();
  await expect(today.getByRole('button', { name: 'See it in the tour', exact: true })).toBeVisible();
  // VoiceOver starts at the title
  await expect(today.getByRole('heading', { name: 'Today', exact: true })).toBeFocused();
  // it fits the screen without scrolling
  expect(await page.evaluate(() => { const b = document.querySelector('.sheet .sheet-body')!; return b.scrollHeight - b.clientHeight; })).toBeLessThanOrEqual(1);
  expect(await seen(page), 'not seen until it is dismissed').toEqual([]);
  await gotIt(page, 'Today');
  expect(await seen(page)).toEqual(['today']);

  // Goals: dismissed with Escape
  await tab(page, 'Goals').click();
  await expect(tip(page, 'Goals').getByText('Done, partly or missed')).toBeVisible();
  await expect(tip(page, 'Goals').getByText('History keeps them')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await seen(page)).toEqual(['today', 'goals']);

  // Fitness: what makes a session count, in this build's words (no source the build does not have); dismissed with Close
  await tab(page, 'Fitness').click();
  const fitness = tip(page, 'Fitness');
  await expect(fitness.getByText('A session counts when it is done')).toBeVisible();
  const strava = await page.evaluate(() => /Strava/.test(document.querySelector('[role=dialog]')!.textContent ?? ''));
  await expect(fitness.getByText(strava ? /Strava/ : 'Mark it done, or log a lift’s sets.')).toBeVisible();
  await expect(fitness.getByText(/Apple Health/)).toHaveCount(0);
  await fitness.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Journal: its link opens the tour on the Journal's page, and the tour ends back on the Journal with the tip seen
  await tab(page, 'Journal').click();
  await expect(tip(page, 'Journal').getByText('A day lights when you write')).toBeVisible();
  await expect(tip(page, 'Journal').getByText('A line or an entry. No streak to break.')).toBeVisible();
  await tip(page, 'Journal').getByRole('button', { name: 'See it in the tour', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome\/how/);
  await expect(page.getByRole('heading', { level: 1, name: 'Journal', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Page 4 of 5' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await settle(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await seen(page)).toEqual(['today', 'goals', 'plan', 'journal']);

  // every tab again, and after a reload: nothing rises
  for (const name of ['Today', 'Goals', 'Fitness', 'Journal']) {
    await tab(page, name).click();
    await settle(page);
    await expect(page.getByRole('dialog'), `no second tip on ${name}`).toHaveCount(0);
  }
  await go(page, '/today');
  await settle(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Settings shows the tips again: one row, a toast, and the tip is back on the tab', async ({ page }) => {
  await signUpByApi(page);
  await gotIt(page, 'Today');
  // a pushed page is not a tab at its root: nothing rises over Settings
  await page.getByRole('link', { name: 'Profile and settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await settle(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const row = page.getByRole('button', { name: /^Show the tips again/ });
  await expect(row).toContainText('One short card per tab');
  await row.click();
  await expect(page.getByRole('status').filter({ hasText: 'Tips will show again' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('logbook.tips'))).toBeNull();
  await settle(page);
  await expect(page.getByRole('dialog'), 'still nothing over Settings').toHaveCount(0);
  // back on Today, at its root: Today's tip, once more
  await page.getByRole('button', { name: 'Back to Today', exact: true }).click();
  await gotIt(page, 'Today');
  await tab(page, 'Goals').click();
  await gotIt(page, 'Goals');
});

/**
 * Two taps closer together than a tip's wait (600 ms), whatever the machine: both are made inside the page, 150 ms
 * apart. The tabs and the ask bar answer a click as they answer a tap.
 */
const twoTaps = (page: Page, first: string, second: string) =>
  page.evaluate(
    async ([a, b]) => {
      const find = (name: string) => Array.from(document.querySelectorAll<HTMLElement>('button')).find((el) => (el.textContent ?? '').trim().startsWith(name) && el.getBoundingClientRect().width > 0);
      find(a!)!.click();
      await new Promise((r) => setTimeout(r, 150));
      find(b!)!.click();
    },
    [first, second],
  );

test('a tip never rises over a tab that is being left, or over another sheet', async ({ page }) => {
  await signUpByApi(page);
  await gotIt(page, 'Today');
  // through Goals to the Journal before Goals' tip can rise: the Journal's rises, Goals' waits for its own visit
  await twoTaps(page, 'Goals', 'Journal');
  await expect(tip(page, 'Journal').getByRole('button', { name: 'Got it', exact: true })).toBeVisible();
  await expect(tip(page, 'Goals')).toHaveCount(0);
  await gotIt(page, 'Journal');
  expect(await seen(page)).toEqual(['today', 'journal']);
  // Fitness, and the assistant opened at once: the assistant is the only sheet, and the tip comes after it has gone
  await twoTaps(page, 'Fitness', 'Ask or change anything');
  await settle(page);
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(tip(page, 'Fitness')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await gotIt(page, 'Fitness');
  // and Goals still has its own
  await tab(page, 'Goals').click();
  await gotIt(page, 'Goals');
});

test('with Fitness off there are three tips, and none of them names training', async ({ page }) => {
  await signUpByApi(page);
  await page.evaluate(() => localStorage.setItem('logbook.prefs', JSON.stringify({ fitness: false })));
  await go(page, '/today');
  await expect(tab(page, 'Fitness')).toHaveCount(0);
  for (const place of ['Today', 'Goals', 'Journal'] as const) {
    if (place !== 'Today') await tab(page, place).click();
    await expect(tip(page, place).getByRole('button', { name: 'Got it', exact: true })).toBeVisible();
    const words = (await tip(page, place).textContent()) ?? '';
    expect(words, `${place}'s tip says nothing about training`).not.toMatch(/\b(fitness|training|sessions?|runs?|lifts?|miles?|Strava)\b/i);
    await gotIt(page, place);
  }
  expect(await seen(page)).toEqual(['today', 'goals', 'journal']);
});
