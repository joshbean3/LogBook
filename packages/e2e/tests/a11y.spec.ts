import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, go, signUpByApi, test } from './helpers';

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

test.describe('signed in', () => {
  const ROUTES = ['/today', '/goals', '/learned', '/plan', '/progress', '/journal', '/settings', '/settings/you', '/settings/training', '/settings/habits', '/settings/plans', '/settings/connections'];

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
});
