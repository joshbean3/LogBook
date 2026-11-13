import { PASSWORD, createAccount, expect, finishSetup, go, newEmail, resetLinkFromLog, savedBy, signOut, signUpByApi, signUpForSetup, startSignUp, test } from './helpers';

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

test('setup: each answer changes its picture, the tour is off the path, and Today asks for one thing first', async ({ page }) => {
  await signUpForSetup(page);
  // the step being left is still on its way out for a moment: the button of the step that came in is the last one
  const next = () => page.getByRole('button', { name: 'Next', exact: true }).last().click();
  const picture = (name: RegExp | string) => page.getByRole('img', { name });

  // the name: the assistant's greeting writes it as it is typed; skipping is a quiet link, and Next waits for a name
  await expect(page.getByRole('heading', { name: 'What should Orby call you?' })).toBeVisible();
  await expect(picture(/^The assistant will say: Good (morning|afternoon|evening)\.$/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
  await page.getByRole('textbox', { name: 'First name' }).fill('Sam');
  await expect(picture(/^The assistant will say: Good (morning|afternoon|evening), Sam\.$/)).toBeVisible();
  await next();

  // Fitness: the two pictures are the two answers, and the capsule shows the tabs the answer leaves
  await expect(page).toHaveURL(/\/welcome\/fitness/);
  await page.getByRole('radio', { name: /No, just my day/ }).click();
  await expect(picture('Your tabs: Today, Goals, Journal')).toBeVisible();
  await page.getByRole('radio', { name: /Yes, track training/ }).click();
  await expect(picture('Your tabs: Today, Goals, Fitness, Journal')).toBeVisible();
  await next();

  // the goal: picking a race draws its build on the hills
  await expect(page).toHaveURL(/\/welcome\/goal/);
  await page.getByRole('radio', { name: 'Half marathon' }).click();
  await expect(picture(/^Half marathon: \d+ weeks\. Week one, .* Peak week, .* Race day /)).toBeVisible();
  await next();

  // the days: a day tapped on adds a mark to the training card's week
  await expect(page).toHaveURL(/\/welcome\/days/);
  await expect(picture(/Week one: 4 runs/)).toBeVisible();
  await page.getByRole('button', { name: 'Monday, rest day' }).click();
  await expect(picture(/Week one: 5 runs/)).toBeVisible();
  await next();

  // the morning: the markers move the card's four times; the arrow keys are the way without a drag
  await expect(page).toHaveURL(/\/welcome\/morning/);
  await expect(picture(/Wake 6:30, Door \d+:\d\d, Back \d+:\d\d, Leave 8:30/)).toBeVisible();
  await page.getByRole('slider', { name: 'Wake up' }).press('ArrowLeft');
  await expect(picture(/Wake 6:25, /)).toBeVisible();
  await next();

  // the habits: a chip picked is a tile
  await expect(page).toHaveURL(/\/welcome\/habits/);
  await expect(picture('No habits picked yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Stretch', exact: true }).click();
  await expect(picture('One tile on Today: Stretch.')).toBeVisible();
  const saved = savedBy(page, 'POST', /\/api\/me\/onboarding$/);
  await next();

  // the last question leads to the plan being written and the reveal, never to the tour
  await expect(page).toHaveURL(/\/welcome\/ready/);
  await saved;
  await expect(page.getByRole('heading', { name: 'Your first day.' })).toBeVisible({ timeout: 30_000 });
  // the tour opens from the reveal's quiet link and ends on the reveal, which is not written out again
  await page.getByRole('button', { name: 'See how Orby works' }).click();
  await expect(page).toHaveURL(/\/welcome\/tour/);
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page).toHaveURL(/\/welcome\/ready/);
  await expect(page.getByRole('heading', { name: 'Your first day.' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Today' }).click();
  await expect(page).toHaveURL(/\/today/, { timeout: 30_000 });

  // Today's first move, in place: the day poster leads with the idea from the habit just picked
  const set = page.getByRole('button', { name: /^Set this goal: Your one habit/ });
  await expect(set).toBeInViewport();
  const goal = savedBy(page, 'PUT', /\/api\/goals/);
  await set.click();
  await goal;
  await expect(page.getByRole('button', { name: /^Today’s goal: Your one habit/ })).toBeVisible();
});

/**
 * The welcome pager (apps/web/src/features/auth/Start.tsx): three pages, each a poster of a real tab, over the assistant's
 * bar. Get started is on every page. The page dots are the swipe's equal for the keyboard and VoiceOver.
 */
test('the welcome pager: three posters, Get started from any page, and Back returns to the page left', async ({ page }) => {
  await page.goto('/start');
  const dots = page.getByRole('slider', { name: 'Page' });
  await expect(dots).toHaveAttribute('aria-valuemax', '3');
  await expect(dots).toHaveAttribute('aria-valuetext', 'Page 1 of 3: Your day, lit.');
  await expect(page.getByRole('heading', { level: 1, name: 'Your day, lit.' })).toBeVisible();
  // each page is one picture of a tab, and the assistant's bar sits under all of them
  await expect(page.getByRole('img', { name: /^Today in Orby\./ })).toBeVisible();
  await expect(page.getByRole('img', { name: /^The assistant’s bar/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCount(0);

  // the dots page with the arrow keys, and hold at the ends
  await dots.focus();
  await page.keyboard.press('ArrowRight');
  await expect(dots).toHaveAttribute('aria-valuetext', 'Page 2 of 3: A plan that fits.');
  await expect(page.getByRole('heading', { level: 1, name: 'A plan that fits.' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^Fitness in Orby\./ })).toBeVisible();
  await page.keyboard.press('End');
  await expect(dots).toHaveAttribute('aria-valuetext', 'Page 3 of 3: One line a day.');
  await expect(page.getByRole('img', { name: /^Journal in Orby\./ })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dots).toHaveAttribute('aria-valuenow', '3');
  // a tap on the dots goes on a page, and from the last one back to the first
  await dots.click();
  await expect(dots).toHaveAttribute('aria-valuenow', '1');
  await page.keyboard.press('ArrowRight');
  await expect(dots).toHaveAttribute('aria-valuenow', '2');
  // only the page on screen is read: one heading, one poster
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // Get started from the second page opens the privacy page; Back returns to the page that was left
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Get started' }).click();
  await expect(page.getByRole('heading', { name: 'Allow the assistant?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Allow', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'A plan that fits.' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Page' })).toHaveAttribute('aria-valuenow', '2');

  // the quiet way in for someone with an account, and the way back from it
  await page.getByRole('button', { name: 'I have an account' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /^(Sign in\.|Welcome back\.)$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/start/);
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

test('journal: finish the line, write more, then edit the entry', async ({ page }) => {
  await signUpByApi(page);
  await go(page, '/journal');
  // the line first: the field is already started, and Finish the line keeps it as the poster's title
  const tag = Date.now().toString(36);
  const line = `Today I learned the river is loudest at dawn ${tag}.`;
  await page.getByRole('textbox', { name: 'What did you learn today?' }).fill(line);
  let saved = savedBy(page, 'POST', /\/api\/learnings/);
  await page.getByRole('button', { name: 'Finish the line' }).click();
  await saved;
  await expect(page.getByRole('button', { name: /Edit tonight’s line$/ })).toContainText(line);

  // then more: the same place opens the entry writer
  const first = `Ran by the river at dawn ${tag}.`;
  await page.getByRole('button', { name: /^Write more about today/ }).click();
  await page.getByRole('textbox', { name: 'Today’s entry' }).fill(first);
  saved = savedBy(page, 'POST', /\/api\/journal/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;
  // the entry is a row under the poster (the tabs stay mounted, so only what is on screen is asked for)
  const row = page.getByRole('button', { name: new RegExp(`^Entry.*${tag}`) }).filter({ visible: true }).first();
  await expect(row).toBeVisible();

  // tap the row: its sheet, where Edit opens the words
  await row.click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Entry', exact: true });
  await expect(editor).toBeVisible();
  const edited = `${first} Then coffee.`;
  await editor.fill(edited);
  saved = savedBy(page, /^(PUT|PATCH)$/, /\/api\/journal\//);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await saved;
  await expect(page.getByText(edited).filter({ visible: true }).first()).toBeVisible();
  // and the server has the new words, and the line
  const list = await page.request.get('/api/journal?q=&limit=200');
  expect(JSON.stringify(await list.json())).toContain(edited);
  const lines = await page.request.get('/api/learnings?limit=200');
  expect(JSON.stringify(await lines.json())).toContain(line);
});

test('the tour by itself: Settings opens it, each page turns, and it ends back on Settings', async ({ page }) => {
  await signUpByApi(page);
  await go(page, '/settings');
  const row = page.getByRole('button', { name: /How Orby works/ });
  await row.click();
  await expect(page).toHaveURL(/\/welcome\/how/);
  // one page per place, headed with the place's own name; the dots say which page of how many
  const places = ['Today', 'Goals', 'Fitness', 'Journal', 'The assistant'];
  for (const [i, place] of places.entries()) {
    await expect(page.getByRole('heading', { level: 1, name: place, exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: `Page ${i + 1} of ${places.length}` })).toBeVisible();
    if (i < places.length - 1) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  // the chevron turns back a page; the last page's button ends the tour where it was opened
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Journal', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(row).toBeVisible();
  // Skip tour leaves from the first page, to the same place
  await row.click();
  await expect(page).toHaveURL(/\/welcome\/how/);
  await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  // opened by its address there is no page to go back to: it ends on Today
  await page.goto('/welcome/how');
  await page.getByRole('button', { name: 'Skip tour', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
});

test('the tour with Fitness off: four pages, none of them Fitness', async ({ page }) => {
  await signUpByApi(page);
  await page.evaluate(() => localStorage.setItem('logbook.prefs', JSON.stringify({ fitness: false })));
  await page.goto('/welcome/how');
  const places = ['Today', 'Goals', 'Journal', 'The assistant'];
  for (const [i, place] of places.entries()) {
    await expect(page.getByRole('heading', { level: 1, name: place, exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: `Page ${i + 1} of ${places.length}` })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Fitness', exact: true })).toHaveCount(0);
    if (i < places.length - 1) await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
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
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible();
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
