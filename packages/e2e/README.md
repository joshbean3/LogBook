# End-to-end flows and the accessibility scan

Playwright drives the real app in Chromium at two phone widths, 390 and 320 (the projects in `playwright.config.ts`, with touch and a phone viewport). CI runs everything here on every push (`.github/workflows/ci.yml`).

```sh
pnpm e2e                                   # everything, with servers Playwright starts on an empty database
pnpm --filter @logbook/e2e e2e:flows       # the flows only
pnpm --filter @logbook/e2e e2e:a11y        # the accessibility scan only
E2E_BASE_URL=http://localhost:5173 pnpm e2e  # against servers you already run (sign-up must be open: ALLOW_SIGNUP=1)
```

First time on a machine: `pnpm --filter @logbook/e2e exec playwright install chromium`.

## Flows (`tests/flows.spec.ts`)

Each test makes its own account (an address at example.com), so they run side by side and never see each other's data.

1. Sign up through setup to Today, and setup never shows again.
2. Check a habit, then undo it; each survives a reload.
3. Add a to-do; it is still there after a reload.
4. Write a journal entry, then edit it.
5. Add a to-do with no connection; it is sent when the connection comes back.
6. Sign out; every `logbook.` key but `logbook.hasAccount` is gone; the next person to sign up sees nothing of the last one, and the assistant's History is empty.
7. The assistant's permission step: Not now sends nothing, the step shows again, Allow stores the choice.
8. Forgot password, the reset link from the mail, the new password works and the old one does not. With no mail provider set the API logs the mail; the test reads the link from the API's output (`E2E_API_LOG`, set for you when Playwright starts the servers).
9. The opening: the sunrise plays on a cold open and a tap runs it out; the same tab opening again gets the quiet fade, and so does the reload after signing out; left alone it gives way when its 2.8 seconds are up; Reduce Motion gets a fade.
10. Setup, question by question: each answer changes its picture (the greeting, the tabs, the build, the week, the morning's times, the habit tiles), the last question leads to the reveal and never to the tour, the tour opens from the reveal's quiet link and comes back, and Today opens on one first move ("Set this goal").
11. The welcome pager: three posters of real tabs over the assistant's bar, Get started on every page, the page dots as one adjustable control (arrow keys, a tap), Back from the privacy page to the page that was left, and "I have an account" to sign in and back.
12. First-visit tips (`tests/tips.spec.ts`): each tab's tip rises once over the tab at its root, says how the place works and how it is tracked, and is gone for good however it is dismissed (Got it, Escape, Close, the link to the tour, which opens on that place's page and comes back); Settings' "Show the tips again" brings them back; a tip never rises over a tab being left or over another sheet; with Fitness off there are three and none names training. Flow 1 and flow 10 meet Today's tip as a new person does and dismiss it.
13. Challenges (`tests/challenges.spec.ts`): a day challenge is offered in the foot of Plan your day, its sheet says what counts and what it pays, "Add to today" adds it, the row shows progress in plain words and then "Done" with what it paid, and it pays once however the to-dos are undone and redone; "Skip" and "Drop it" leave no row, no word and no payment, on this phone or after a reload. An account's day challenge falls on a day chosen from its id, so each test makes accounts until one has today, and sets the development start-date key (`logbook.dev.orbsStart`) so Orbs earn before their start date.

A test that only waits for the page to look right would miss a change the server never got, so every write waits for the server's answer (`savedBy`) before the test reloads.

## Accessibility scan (`tests/a11y.spec.ts`)

axe-core checks every signed-out page (the welcome pager, sign in, sign up, the five static pages), every setup question and the reveal, every tab and Settings page, and the main sheets (the assistant, add a habit, set the goal, write in the journal, each tab's first-visit tip) for: low contrast, images with no alternative, empty links, empty buttons, inputs with no label, no document language, a control inside a control, and a spoken name that does not contain the visible words. Any one fails the run.

## Writing a test

Import `test` and `expect` from `./helpers`, not from `@playwright/test`: that `test` starts every session with the app's opening already seen, so a flow meets the app and not its 2.8 second sunrise (`test.use({ opening: 'sunrise' })` asks for the sunrise). It also starts with the four first-visit tips already seen, so a flow is not met by a sheet over each tab; a test of first run or of the tips asks for them with `test.use({ tips: 'first' })` and dismisses each with `gotIt(page, 'Today')`.

Find things the way a person does: by role and visible name (`getByRole('button', { name: 'Add a to-do' })`), not by class. Open routes with `go(page, path)`, which waits for the app to settle. Never use the seeded developer account; make a new one with `signUpByApi` (fast) or `startSignUp` + `createAccount` + `finishSetup` (the real screens).
