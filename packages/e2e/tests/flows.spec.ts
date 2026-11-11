import { PASSWORD, createAccount, expect, finishSetup, go, newEmail, resetLinkFromLog, savedBy, signOut, signUpByApi, startSignUp, test } from './helpers';

/**
 * The smoke flows every push must pass, at 390 and 320 wide (the two projects in playwright.config.ts). Each test makes
 * its own account, so they never see each other's data.
 */

test('sign up through setup to Today', async ({ page }) => {
  const email = newEmail('signup');
  await startSignUp(page);
  await expect(page).toHaveURL(/\/signup/);
  await createAccount(page, email);
  await finishSetup(page);
  await expect(page.getByRole('heading', { name: 'Habits' }).first()).toBeVisible();
  await expect(page.locator('button[data-habit][aria-label="Stretch"]')).toBeVisible();
  // an account that finished setup never sees it again
  await page.reload();
  await expect(page).toHaveURL(/\/today/);
  await page.goto('/welcome');
  await expect(page).not.toHaveURL(/\/welcome/);
});

test('habit: check, then undo, and each survives a reload', async ({ page }) => {
  await signUpByApi(page);
  const tile = page.locator('button[data-habit][aria-label="Stretch"]');
  await expect(tile).toHaveAttribute('aria-pressed', 'false');
  let saved = savedBy(page, 'PUT', /\/api\/habits\//);
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  await saved;
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(tile).toHaveAttribute('aria-pressed', 'true');
  saved = savedBy(page, 'PUT', /\/api\/habits\//);
  await tile.click();
  await expect(tile).toHaveAttribute('aria-pressed', 'false');
  await saved;
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(tile).toHaveAttribute('aria-pressed', 'false');
});

test('to-do: add one, and it is still there after a reload', async ({ page }) => {
  await signUpByApi(page);
  const text = `Book the track ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Add a to-do' }).first().click();
  const input = page.getByRole('textbox', { name: 'Add a to-do' });
  await input.fill(text);
  const saved = savedBy(page, 'POST', /\/api\/todos/);
  await input.press('Enter');
  await expect(page.getByText(text).first()).toBeVisible();
  await saved;
  await page.reload();
  await expect(page.getByText(text).first()).toBeVisible();
});

test('journal: write an entry, then edit it', async ({ page }) => {
  await signUpByApi(page);
  await go(page, '/journal');
  const first = `Ran by the river at dawn ${Date.now().toString(36)}.`;
  await page.getByRole('button', { name: /^Write today/ }).first().click();
  await page.getByRole('textbox', { name: 'A memory for today' }).fill(first);
  let saved = savedBy(page, 'POST', /\/api\/journal/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;
  await expect(page.getByText(first).first()).toBeVisible();

  // tap the entry in the day's card: it opens for editing in place
  await page.getByText(first, { exact: true }).first().click();
  const editor = page.getByRole('textbox').filter({ hasText: first }).first();
  await expect(editor).toBeVisible();
  const edited = `${first} Then coffee.`;
  await editor.fill(edited);
  saved = savedBy(page, /^(PUT|PATCH)$/, /\/api\/journal\//);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;
  await expect(page.getByText(edited).first()).toBeVisible();
  // and the server has the new words
  const list = await page.request.get('/api/journal?q=&limit=200');
  expect(JSON.stringify(await list.json())).toContain(edited);
});

test('offline: a to-do added with no connection is sent when it comes back', async ({ page, context }) => {
  await signUpByApi(page);
  await page.waitForLoadState('networkidle');
  const text = `Offline to-do ${Date.now().toString(36)}`;
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Add a to-do' }).first().click();
  const input = page.getByRole('textbox', { name: 'Add a to-do' });
  await input.fill(text);
  await input.press('Enter');
  await expect(page.getByText(text).first()).toBeVisible();

  const sent = savedBy(page, 'POST', /\/api\/todos/);
  await context.setOffline(false);
  await sent;
  // what the server has, not what the page remembers
  await page.reload();
  await expect(page.getByText(text).first()).toBeVisible();
});

test('sign out, then a new person signs up and sees nothing of the last one', async ({ page }) => {
  await signUpByApi(page, { name: 'Alex' });
  const todo = `Alex private to-do ${Date.now().toString(36)}`;
  await page.getByRole('button', { name: 'Add a to-do' }).first().click();
  await page.getByRole('textbox', { name: 'Add a to-do' }).fill(todo);
  const saved = savedBy(page, 'POST', /\/api\/todos/);
  await page.getByRole('textbox', { name: 'Add a to-do' }).press('Enter');
  await expect(page.getByText(todo).first()).toBeVisible();
  await saved;
  // a conversation kept on this phone (the assistant's History lives in local storage)
  await page.evaluate(() => {
    const chat = { id: 'c-e2e', title: 'Alex asked about knees', updatedAt: Date.now(), turns: [{ role: 'user', text: 'Alex asked about knees' }] };
    localStorage.setItem('logbook.assistant.chats', JSON.stringify([chat]));
  });

  await signOut(page);
  const kept = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('logbook.') && k !== 'logbook.hasAccount'));
  expect(kept, 'every logbook. key but hasAccount is gone after sign out').toEqual([]);

  await startSignUp(page);
  await createAccount(page, newEmail('second'));
  await finishSetup(page);
  await expect(page.getByText(todo)).toHaveCount(0);
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('logbook.assistant.chats') ?? '[]') as unknown[]);
  expect(history, 'the assistant History is empty for the new person').toEqual([]);
  await go(page, '/journal');
  await expect(page.getByText('Alex asked about knees')).toHaveCount(0);
});

test('the assistant asks first: Not now sends nothing, then Allow opens it', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && /\/api\/(assistant|ai|me\/consent)/.test(r.url())) writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  // sign up the way a person does, leaving the privacy page as it is: no choice is stored
  await startSignUp(page);
  await createAccount(page, newEmail('consent'));
  await finishSetup(page);

  await page.getByRole('button', { name: /Ask or change anything/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Before you ask' })).toBeVisible();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Before you ask' })).toHaveCount(0);
  expect(writes, 'Not now sends nothing').toEqual([]);

  // the step comes back next time, and Allow stores the choice
  await page.getByRole('button', { name: /Ask or change anything/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Before you ask' })).toBeVisible();
  const saved = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/api/me/consent'));
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Before you ask' })).toHaveCount(0);
  await expect(page.getByRole('textbox').last()).toBeVisible();
});

test('forgot password, then reset it from the mail link and sign in with the new one', async ({ page }) => {
  const email = await signUpByApi(page);
  await page.request.post('/api/auth/logout');
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible();

  const link = await resetLinkFromLog(email);
  expect(link, 'the API logs the reset mail when no mail provider is set (E2E_API_LOG)').toBeTruthy();
  await page.goto(link!);
  const next = `${PASSWORD}-new`;
  await page.getByRole('textbox', { name: 'New password' }).fill(next);
  await page.getByRole('button', { name: 'Change password' }).click();
  await expect(page.getByRole('heading', { name: 'Password changed.' })).toBeVisible();

  // the old password no longer works, the new one does
  const old = await page.request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(old.status()).toBeGreaterThanOrEqual(400);
  const ok = await page.request.post('/api/auth/login', { data: { email, password: next } });
  expect(ok.ok()).toBeTruthy();
});

/**
 * The opening (apps/web/src/app/BrandSplash.tsx): a 2.8 second sunrise on a cold open, once per session. It is brand art,
 * hidden from assistive technology, so it is found by its class here, the one place a test does that.
 */
test.describe('the opening', () => {
  test.use({ opening: 'sunrise' });

  test('the sunrise plays on a cold open, a tap runs it out, and the same tab opening again is quiet', async ({ page }) => {
    await page.goto('/start');
    const splash = page.locator('.brand-splash');
    await expect(splash).toHaveAttribute('data-moment', 'sunrise');
    // it covers the welcome page: the button under it cannot be pressed yet
    await page.waitForTimeout(500);
    await expect(splash).toBeVisible();
    await splash.tap({ position: { x: 40, y: 40 } });
    // gone well inside its 2.8 seconds, and the tap went to the splash, not to the page under it
    await expect(splash).toHaveCount(0, { timeout: 1500 });
    await expect(page).toHaveURL(/\/start/);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('.brand-splash')).toHaveAttribute('data-moment', 'fade');
    await expect(page.locator('.brand-splash')).toHaveCount(0, { timeout: 3000 });
  });

  test('left alone, it gives way to the app when its 2.8 seconds are up', async ({ page }) => {
    await page.goto('/start');
    const splash = page.locator('.brand-splash');
    await expect(splash).toHaveAttribute('data-moment', 'sunrise');
    const began = Date.now();
    await expect(splash).toHaveCount(0, { timeout: 8000 });
    const took = Date.now() - began;
    // never shorter than the sunrise less what it took to find it, and not held past its cap
    expect(took).toBeGreaterThan(1800);
    expect(took).toBeLessThan(5000);
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
  });

  test('signing out reloads the page, and that reload is quiet: the sunrise is once per session', async ({ page }) => {
    // every splash this tab shows, kept where the sign-out wipe does not reach (it removes the logbook. keys)
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const moment = document.querySelector('.brand-splash')?.getAttribute('data-moment');
        if (!moment || (window as unknown as { seen?: boolean }).seen) return;
        (window as unknown as { seen?: boolean }).seen = true;
        sessionStorage.setItem('e2e-moments', `${sessionStorage.getItem('e2e-moments') ?? ''}${moment} `);
      }).observe(document, { childList: true, subtree: true });
    });
    await signUpByApi(page);
    await signOut(page);
    await expect(page.locator('.brand-splash')).toHaveCount(0, { timeout: 8000 });
    const moments = (await page.evaluate(() => sessionStorage.getItem('e2e-moments') ?? '')).trim().split(' ');
    expect(moments[0], 'the first open of the session is the sunrise').toBe('sunrise');
    expect(moments.length).toBeGreaterThan(1);
    expect(moments.slice(1).every((m) => m === 'fade'), `every later open is the quiet fade: ${moments.join(', ')}`).toBe(true);
  });

  test('Reduce Motion: no sunrise, the picture fades in and out', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/start');
    const splash = page.locator('.brand-splash');
    await expect(splash).toHaveAttribute('data-moment', 'still');
    await expect(splash).toHaveCount(0, { timeout: 4000 });
  });
});
