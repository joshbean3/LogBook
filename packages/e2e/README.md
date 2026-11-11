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

A test that only waits for the page to look right would miss a change the server never got, so every write waits for the server's answer (`savedBy`) before the test reloads.

## Accessibility scan (`tests/a11y.spec.ts`)

axe-core checks every signed-out page (the welcome pager, sign in, sign up, the five static pages), every tab and Settings page, and the main sheets (the assistant, add a habit, set the goal, write in the journal) for: low contrast, images with no alternative, empty links, empty buttons, inputs with no label, no document language, a control inside a control, and a spoken name that does not contain the visible words. Any one fails the run.

## Writing a test

Import `test` and `expect` from `./helpers`, not from `@playwright/test`: that `test` starts every session with the app's opening already seen, so a flow meets the app and not its 2.8 second sunrise (`test.use({ opening: 'sunrise' })` asks for the sunrise).

Find things the way a person does: by role and visible name (`getByRole('button', { name: 'Add a to-do' })`), not by class. Open routes with `go(page, path)`, which waits for the app to settle. Never use the seeded developer account; make a new one with `signUpByApi` (fast) or `startSignUp` + `createAccount` + `finishSetup` (the real screens).
