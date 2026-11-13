import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, go, gotIt, signUpByApi, signUpForSetup, test } from './helpers';

/**
 * The accessibility scan (requirement QUA-44): every route and the main sheets, at 390 and 320 wide, checked by axe-core
 * for the six most common failures on the web (WebAIM Million) plus two that an earlier audit found here.
 */
export const RULES = [
  'color-contrast', // low contrast text
  'image-alt', // images with no alternative
  'link-name', // empty links
  'button-name', // empty buttons
  'label', // form inputs with no label
  'html-has-lang', // no document language
  'nested-interactive', // a control inside a control
  'label-content-name-mismatch', // a spoken name that does not contain the visible words
];

const scan = async (page: Page, where: string) => {
  // let entrance animations finish: a half-faded word reads as low contrast
  await page.waitForTimeout(900);
  const result = await new AxeBuilder({ page }).withRules(RULES).analyze();
  const problems = result.violations.flatMap((v) => v.nodes.map((n) => `${where}: ${v.id} (${v.impact}) ${n.target.join(' ')} :: ${n.failureSummary?.split('\n').slice(1, 2).join('').trim() ?? ''}`));
  expect(problems, `axe found ${problems.length} problem(s) on ${where}`).toEqual([]);
};

test.describe('signed out', () => {
  for (const path of ['/start', '/login', '/signup', '/legal/privacy.html', '/legal/health-privacy.html', '/legal/terms.html', '/legal/support.html', '/legal/acknowledgements.html']) {
    test(`page ${path}`, async ({ page }) => {
      await page.goto(path);
      await scan(page, path);
    });
  }
});

test.describe('setup', () => {
  // first launch is a common task: every question and the reveal, with an answer given so each picture is drawn
  test('every question and the reveal', async ({ page }) => {
    await signUpForSetup(page);
    const problems: string[] = [];
    const check = async (where: string) => {
      try {
        await scan(page, where);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    };
    // the step being left is still on its way out for a moment: the button of the step that came in is the last one
  const next = () => page.getByRole('button', { name: 'Next', exact: true }).last().click();
    await check('/welcome/name, empty');
    await page.getByRole('textbox', { name: 'First name' }).fill('Sam');
    await check('/welcome/name');
    await next();
    await check('/welcome/fitness, not answered');
    await page.getByRole('radio', { name: /Yes, track training/ }).click();
    await check('/welcome/fitness');
    await next();
    await check('/welcome/goal, not answered');
    await page.getByRole('radio', { name: 'Half marathon' }).click();
    await check('/welcome/goal');
    await next();
    await check('/welcome/days');
    await next();
    await check('/welcome/morning');
    await next();
    await check('/welcome/habits, none');
    await page.getByRole('button', { name: 'Stretch', exact: true }).click();
    await check('/welcome/habits');
    await next();
    await expect(page.getByRole('heading', { name: 'Your first day.' })).toBeVisible({ timeout: 30_000 });
    await check('/welcome/ready, the reveal');
    expect(problems).toEqual([]);
  });
});

test.describe('signed in', () => {
  // a month of the journal is a pushed page of its own (`/journal/2026-11`); the month is this one
  const MONTH = new Date().toISOString().slice(0, 7);
  const ROUTES = ['/today', '/goals', '/plan', '/journal', `/journal/${MONTH}`, '/settings', '/settings/you', '/settings/training', '/settings/habits', '/settings/plans', '/settings/connections'];

  test('every tab and the Settings pages', async ({ page }) => {
    await signUpByApi(page);
    const problems: string[] = [];
    for (const path of ROUTES) {
      await go(page, path);
      try {
        await scan(page, path);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    }
    expect(problems).toEqual([]);
  });

  const SHEETS: Array<{ name: string; route: string; open: (page: Page) => Promise<void> }> = [
    { name: 'the assistant', route: '/today', open: (p) => p.getByRole('button', { name: /Ask or change anything/ }).first().click() },
    { name: 'add a habit', route: '/today', open: (p) => p.getByRole('button', { name: 'Add a habit' }).first().click() },
    { name: 'set the goal', route: '/today', open: (p) => p.getByRole('button', { name: /Set (today|this day)’s goal/ }).first().click() },
    { name: 'write in the journal', route: '/journal', open: (p) => p.getByRole('button', { name: 'Write a longer entry' }).first().click() },
  ];
  for (const s of SHEETS) {
    test(`sheet: ${s.name}`, async ({ page }) => {
      await signUpByApi(page);
      await go(page, s.route);
      await s.open(page);
      await scan(page, `${s.route} + ${s.name}`);
    });
  }

  // the first-visit tips: each one over its own tab, as a new person meets them
  test.describe('first visit', () => {
    test.use({ tips: 'first' });
    test('sheet: each tab’s tip', async ({ page }) => {
      await signUpByApi(page);
      const problems: string[] = [];
      for (const place of ['Today', 'Goals', 'Fitness', 'Journal'] as const) {
        if (place !== 'Today') await page.getByRole('navigation', { name: 'Views' }).getByRole('button', { name: new RegExp(`^${place}`) }).click();
        await expect(page.getByRole('dialog', { name: place, exact: true }).getByRole('button', { name: 'Got it', exact: true })).toBeVisible();
        try {
          await scan(page, `the ${place} tip`);
        } catch (e) {
          problems.push(e instanceof Error ? e.message : String(e));
        }
        await gotIt(page, place);
      }
      expect(problems).toEqual([]);
    });
  });
});
