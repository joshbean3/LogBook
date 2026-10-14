# Growth & Account: sign-up, first run, Settings

Team: growth. Server for review: port 8826 (`ALLOW_SIGNUP=1`). Screenshots: `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/growth/shots/` (scripts `flow.mjs`, `settings.mjs`, `extras.mjs`, `before.mjs` in the folder above it).

## Files changed and why

| File | Why |
|---|---|
| `apps/web/src/features/auth/AuthScreens.tsx`, `auth.css` | Sign in and a real sign-up (`/signup`, shown when `GET /auth/status` says `signupOpen`). Night frame, halo rises once, inline errors under the field in plain words, Enter submits, `autocomplete` username / current-password / new-password, Show password, "Confirm password", "Sign in with that email" on a taken address (carries the email over). New accounts land in `/welcome`; both sign in and sign up clear the query cache so no other account's data paints. `Setup` stays exported as an alias. |
| `apps/web/src/features/onboarding/Welcome.tsx` | Replaces the placeholder: the whole first run (`/welcome`, `/goal`, `/days`, `/morning`, `/habits`, `/ready`, `/strava`). |
| `apps/web/src/features/onboarding/controls.tsx` | The direct-manipulation controls, shared with Settings: `GoalChips`, `RaceStrip` (race-day wheel), `DayLetters` (tap / hold for long run), `Dial` + `MilesDial` (big stepper with scrub), `MorningTrack` (wake and leave markers), `HabitPicker` (chips that become orbs). |
| `apps/web/src/features/onboarding/model.ts` | Pure helpers: goals, defaults by goal, race Sundays, `firstWeek()` (client `buildTemplate` preview + `buildMorning` door time), the training profile (load/save/derive from the plan). |
| `apps/web/src/features/onboarding/StravaPrimer.tsx`, `stravaPrimer.css`, `index.ts` | `StravaPrimer` + `useStravaPrimer` for Today, and the last optional first-run step. |
| `apps/web/src/features/settings/*` | Settings rebuilt: `SettingsView.tsx` (root tree + section router, still re-exports `StravaLine`), `TrainingPages.tsx` (You, Training, the rebuild offer), `HabitsPage.tsx`, `account.tsx` (export, two-step delete), `parts.tsx` (`SRow`, `Switch`), `useProfile.ts`. `StravaLine.tsx` unchanged. |
| `apps/web/src/app/App.tsx` | Routing only: `/signup` (and `/setup` → `/signup`), 401 handler ignores `/signup`, a signed-in account with `onboardedAt === null` is sent to `/welcome`, and `/settings` / `/settings/:section` are two keyed `PushedPage` routes so a sub-section pushes (slides in, edge-swipe and Back land on Settings). |
| `apps/web/src/api/types.ts` | Additive: `Bootstrap.user.onboardedAt?`, `AuthStatus.signupOpen?`, `OnboardingAnswers`, `OnboardingResult`, `TemplateApplied`. |
| `apps/web/src/api/queries.ts` | Growth block only: `useOnboard`, `useRebuildPlan`, `useDeleteAccount`. |

## What it does

**Sign in / sign up.** Black, the mark, serif title, halo rising from the bottom once. Fields validate on blur and on submit (`noValidate`, our own words: "Enter your email address.", "Use at least 8 characters.", "The two passwords don’t match.", "That email and password don’t match. Try again.", "There’s already an account with that email."). Failed submit fires `haptics.error()` and focuses the first bad field. Sign-in links to sign-up only when sign-up is open.

**First run** (full screen, no tab bar; progress dots, Back chevron, edge swipe from the left 24px, browser back; every step but the goal has Skip; answers live in `sessionStorage` per account, so a reload keeps step and answers):
1. *Promise*: the mark, "Your day, lit.", "Three questions, then your first week.", Start. The halo rises once (1.1s), nothing else moves.
2. *Goal*: five chips (Just running · 5K · 10K · Half · Marathon) with a white thumb that slides between them (`springs.settle`), `select` per change. A race goal reveals a horizontal **race-day wheel** of Sundays (No date, then 4–29 weeks out) with a centre ring: scroll / fling / tap, `select` per day crossed, arrows on the keyboard. Default = the goal's usual block length.
3. *Days*: seven letters edge to edge (≥ 44px even at 320). Tap toggles a run day (`select`; removing the last one shakes and fires `error`), **hold** a letter (450ms) to make it the long run (blue ring + "LONG"). Visible fallback: "Long run on **Sunday**" button cycles the long run. Under it the **weekly miles dial**: big stamp number between round − / +; drag across the number to scrub, hold a button to repeat, arrows/Page keys. Default by goal (12/15/18/22/28) until touched.
4. *Morning*: a 4:00–11:00 line with **Wake** and **Leave** markers; drag in 5-minute steps (`select` per step) or tap the line to bring the nearer marker; the run (in its tone), cool-down and the shower/ready blocks draw live between them from `buildMorning`. Each marker is a `role=slider` (arrows 5 min, Page 30, Home/End). Verdict below: "Out the door 6:05." + "An easy 4 has you back by 6:51, with 74 min to spare." or "Tight: …".
5. *Habits*: starter chips (Sleep 7 h, Stretch, Read 15 min, Protein, No phone in bed, + Your own); each picked chip pops in as an orb above (the Today orb look). "Build my week".
6. *Payoff*: `POST /me/onboarding` (`start: 'tomorrow'`, the client's `today`) runs while the screen shows the block from `buildTemplate`: eyebrow = block name, "Tomorrow: Easy 4." / "Out the door 6:50.", the next seven days as rows (tone bar, stamp, a miles bar that grows on `springs.number`), "18.5 mi over 5 runs in your first seven days. Saved to your plan." with `haptics.success()` when the server confirms, the first long run, and **Open Today**. Open Today moves the hero up to where Today's hero sits while the week fades, then cuts to Today. Errors: "Couldn’t save your plan…" + Try again (`error`). A reload never posts twice (sent answers are remembered).
7. *Strava primer* (only when the server can connect Strava and the account is not connected): a sample run in Night style whose route draws itself, "See your runs land here.", **Connect Strava**, "Later. I can log runs by hand."

**Settings** (`/settings`, pushed): a hero card (email, "Training for a 10K." / the block's own name, race date and weeks to go; tap → You), then edge-to-edge lists with sentence-case section titles:
- *Training*: Weekly miles, Run days, Long run, Easy pace → `/settings/training`.
- *Morning routine*: "Up at 7:15, out for work at 9:30." → `/morning`.
- *Habits*: the first three names → `/settings/habits`.
- *Connections* (only when Strava is configured): Strava status; a red "Strava stopped syncing / Reconnect" row only when broken; connected row opens a sheet with `StravaLine` and Disconnect.
- *App*: Haptics switch (`useHapticsEnabled`, fires `toggle` when turned on); Install (web only, the existing install prompt / instructions).
- *Data*: Import (JSON, plain-word result in the row), Export (fetches bootstrap + every month with data + to-dos, lifts, journal, reads; progress in the row; downloads `logbook-YYYY-MM-DD.json`).
- *Account*: Sign out; Delete account (red) → sheet step 1 (what goes, with counts; Continue / Export my data first / Keep my account) → pushed step 2 (password, `autocomplete=current-password`, inline "That password doesn’t match."), `DELETE /me`, `haptics.delete()`, cache cleared, back to sign in with "Account deleted."

Sub-pages: **You** (email, units placeholder "Miles / Kilometres are on the way.", goal chips + race wheel), **Training** (miles dial, run-day letters, easy-pace dial in 5 s steps that saves itself to `/morning/settings`), **Habits** (tap → habit sheet: rename with autosave, Archive; **hold** a row → it lifts (`lift`), drag up/down → siblings spring aside, `select` per slot, `drop` on release, saved with `PUT /habits/order`; hold and release without moving → menu Rename / Move up / Move down / Archive; the grip button opens the same menu; Archive → `delete` haptic + "Meditate archived · Undo"; Archived list with Restore; Add a habit field + starter chips; empty state with ghost orbs and starters). Any change to goal, race, days, long run or miles shows the **"Rebuild my plan from next week"** card above the tab bar (the new block's name and summary from `buildTemplate`, Undo changes / Rebuild → `POST /plans/template` with `replace: true` from next Monday; `success` + toast "Plan rebuilt from Mon, Oct 19: 40 runs.").

## Hand-verifiable steps (port 8826)

1. Open `/login` signed out. Expect "Welcome back." and a "Create an account" link. Submit empty: "Enter your email address." and "Enter your password." under the fields.
2. `/signup`: type josh@example.com + matching passwords → "There’s already an account with that email." and a "Sign in with that email" button that opens sign-in with the address filled. Mismatched passwords → "The two passwords don’t match." under Confirm password.
3. Sign up with a new email → `/welcome` promise. Start → goal; Next is disabled until a chip is picked. Pick 10K → the race wheel appears; fling it, the header date follows.
4. Next → days. Tap Monday on; hold Saturday ~½ s → "LONG" moves to Saturday; the "Long run on" button reads Saturday. + on the dial → 19.
5. Reload the page → same step, same answers. Swipe from the left edge → back to goal; Next.
6. Morning: drag Wake left → the time and "Out the door" update in 5-min steps. Tab to a marker and press ← → it moves 5 min.
7. Habits: pick two, add "Floss" → three orbs. Build my week → the payoff with "Tomorrow: Easy 4." and seven rows; the check line says "Saved to your plan". Open Today → Today; Plan shows the sessions from tomorrow.
8. `/welcome` again → goes straight to Today (also true for josh@example.com, whose `onboardedAt` is set).
9. Avatar → Settings: hero "Training for a 10K." with the race date; Training rows show 19 mi, 5 days a week, Saturday, 9:00 /mi.
10. Weekly miles → Training; − once → the rebuild card appears; Rebuild → toast, card goes away.
11. Settings → Habits: hold a row and drag it down two rows → it lands there and Today's orbs follow. Hold and let go → menu. Tap → sheet; rename; Archive → toast with Undo.
12. Settings → Delete account → Continue → wrong password → red line, still signed in; right password → sign-in screen, "Account deleted."; signing in with it fails.

## Audit items

**§2.10 Auth / fix 30**
- No sign-up — **Fixed**: `/signup` whenever `signupOpen`; linked from sign-in.
- "Again" label — **Fixed**: "Confirm password".
- Lands on empty Today — **Fixed**: new accounts go to `/welcome` (App guard on `onboardedAt === null`).
- "There is no reset, so keep it somewhere safe." — **Fixed** (copy removed). Password **reset**: **Rejected for now**: needs an email sender and a reset-token endpoint the API does not have (request below).
- Sign in with Apple — **Rejected**: out of scope per spec §5.8.
- Single-account server — **Fixed** by the platform's `ALLOW_SIGNUP` + this UI.

**§2.9 Settings / fix 18**
- No back, no lit tab — **Fixed** by the foundation's PushedPage; sub-sections now push their own page with Back to Settings.
- "Import … Import" — **Fixed**: one title, a plain sub, no repeated verb.
- Missing profile/goal — **Fixed** (hero + You). Units — **Placeholder** (miles only; spec says placeholder). Week start — **Rejected**: the app is Monday-based throughout (templates, week rings); not configurable without a platform change. Reminders — **Rejected**: notifications are not built (spec §5.8 item 7). Habits management — **Fixed**. Morning routine — **Fixed** (row → Morning). Export — **Fixed**. Delete account — **Fixed** (two-step, password). About/version — **Rejected**: no version is exposed by the build; a quiet colophon only.
- Sign out the most prominent control — **Fixed**: an ordinary row; only Delete account is red.
- Page 50% empty — **Fixed**: a hero and eight sections.

**§3.6 First run / fix 6** — **Fixed**: promise, three questions by direct manipulation, starter habits, a pre-filled first week (from tomorrow), Strava primer. Notification ask — **Rejected** (not built).

**§3.3 / fix 11, 25** (as they touch these screens) — no spinners (skeletons on Training/You, quiet frame on auth), no grey-sentence empty states (habits empty state has ghost orbs + starters), no zero headlines.

**§3.2 / fix 26** — habit archive is now immediate with Undo and `haptics.delete()` (was ✕ with no undo). **Fix 23** (habits management): the five-control edit mode is gone; hold-drag + menu + sheet.

## Requests for other teams

- **Today**: (1) show `StravaPrimer` from `@/features/onboarding` (`const p = useStravaPrimer(); p.show && <StravaPrimer onLater={p.later} />`) as a card after first run; (2) on a rest / empty day whose next day has a run, the hero should read like the payoff: "Tomorrow: Easy 4. Out the door 6:50." (the payoff hands off to Today expecting it); (3) optional: give the Today hero `data-shared="today-hero"` so the payoff can do a true shared-element hand-off (today it is a move + cut). Today and Plan may keep importing `StravaLine` from `@/features/settings/StravaLine` (or from `SettingsView`).
- **Platform/API**: (1) store the training answers (goal, race date, run days, long-run day, weekly miles) server-side — `/me/onboarding` and `/plans/template` could persist them under a `training` setting and `GET /me` / bootstrap return them; Settings currently keeps them per device (`localStorage logbook.training.<userId>`) and otherwise reads them back from the plan; (2) password reset (email + token) for fix 30; (3) `units` setting when kilometres land.
- **Morning**: the routine editor is the target of Settings → Morning routine; when it exists as `/morning?edit=1` (or similar), we will link straight to it.

## Notes

- Console: clean on every screen except the expected network lines a browser logs for a deliberate failure (401 wrong sign-in, 409 taken email, 403 wrong delete password, and 401s right after an account is deleted).
- Targets: everything ≥ 44px; the Haptics switch (51×31) and the Restore `btn sm` (36 tall) reach 44px through their `::after` hit areas (the checker measures boxes only).
- Reduced motion: halo and route appear complete, step changes are 150ms fades, drags still work (`390-promise-reduced.png`, `390-goal-half-reduced.png`).

## Screenshots

Before: `before-login-{390,320}.png`, `before-setup-{390,320}.png`, `before-welcome-{390,320}.png`, `before-settings-{390,320}.png`.

After (each at 390 and 320 unless noted): `*-signup.png`, `*-signup-errors.png`, `*-signup-mismatch.png`, `320-signup-taken.png`, `320-login.png`, `320-login-empty.png`, `320-login-wrong.png`, `*-promise.png`, `*-goal-empty.png`, `*-goal-10k.png`, `*-goal-race-dragged.png`, `*-days.png`, `*-days-edited.png`, `*-morning.png`, `*-morning-dragged.png`, `*-habits.png`, `*-habits-picked.png`, `*-payoff-early.png`, `*-payoff.png`, `390-payoff-base.png`, `390-strava-primer.png`, `*-today-after.png`, `*-plan-after.png`, `*-new-settings.png`, `*-new-training-dirty.png`, `*-new-training-rebuilt.png`, `*-after-delete.png`, `*-settings.png`, `*-settings-full.png`, `*-training.png`, `*-training-dirty.png`, `*-you.png`, `*-habits-reordered.png`, `*-habits-menu.png`, `*-habit-sheet.png`, `*-delete-1.png`, `*-delete-2.png`, `*-delete-2-empty.png`, `*-delete-2-wrong.png`, `390-promise-reduced.png`, `390-goal-half-reduced.png`.
