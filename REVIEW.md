# Platform review: shared logic and endpoints for the redesign

Spec: `docs/experience.md` §4. Reference for page teams: **`docs/platform.md`** (every function and endpoint, with signatures, examples and rules).

## Files

**Shared (`packages/shared/src`)**
- `status.ts`: one status vocabulary: `sessionWord`, `sessionKey`, `dayWord`, `dayKey`, `statusKey`, `heroSession`, `STATUS_WORDS`, `isSkipMark`; `sessionStatus` treats the new `sick` mark as skipped.
- `phase.ts` (new): `dayPhase(now, ctx)`, `EVENING_START`.
- `week.ts` (new): `weekCheck`, `weekSummary`, `weekStreak`.
- `templates.ts` (new): `buildTemplate`, `TemplateError`, `GOAL_SPECS`, `TEMPLATE_RULES`, `WEEKDAYS`, `weekdayOf`, `weekdayIndex`, `floorMinutes`.
- `schemas.ts`: `zWeekday`, `zGoal`, `zTemplateInput`, `zTemplateRequest`, `zClockMinutes`, `zPace`, `zOnboarding`, `zDeleteAccount`; `zMark` gains `sick`.
- `types.ts`: `SessionMark` gains `'sick'` (additive).
- `morning.ts`: `morningPlanFor` ignores skipped sessions (a skipped run is no longer on the morning).
- `sessions.ts`: legacy `STATUS_WORD.open` reads "Today" (was "To do").
- `index.ts`: exports the new modules. `fixtures.ts`: test factories (not exported).
- Tests: `words.test.ts`, `phase.test.ts`, `week.test.ts`, `templates.test.ts` (new); `status.test.ts` unchanged.

**API (`apps/api`)**
- `drizzle/0006_onboarding.sql` + `meta/_journal.json` idx 6 (`when` 1791900000000 > idx 5's 1791850000000): adds `users.onboarded_at`, sets it for every existing account.
- `src/env.ts`: `ALLOW_SIGNUP` (zod, default off) → `env.allowSignup`.
- `src/db/schema.ts`: `users.onboardedAt`.
- `src/auth.ts`: the authed user carries `onboardedAt` (so `/auth/me` and `/bootstrap`'s `user` include it).
- `src/routes/auth.ts`: `/setup` and new `/signup` create accounts (more than one with `ALLOW_SIGNUP`), 409 on a taken email; `/status` adds `signupOpen`; `/login` returns `onboardedAt`; the throttle helpers are exported.
- `src/routes/me.ts` (new): `GET /me`, `POST /me/onboarding`, `DELETE /me`.
- `src/routes/plans.ts` (new): `POST /plans/template`.
- `src/services/plans.ts` (new): `snapshotFor`, `removePlanned`, `writeTemplate`, `retireBlock`.
- `src/services/account.ts` (new): `USER_TABLES`, `deleteAccount`.
- `src/routes/core.ts`: `deepMerge` exported. `src/index.ts`: mounts the two new route groups.
- `src/routes/platform.test.ts` (new): in-process `buildApp` + in-memory DB.

**Docs**: `docs/platform.md` (new), this file. Nothing under `apps/web` changed.

## The status bug

Root cause: the Today hero (`DayView.tsx` `Hero`) printed `dayStatus(snap, date)`, the roll-up of the whole day, under the title of one session, while the Training row (`SessionCard.tsx` `SessionRow`) printed `sessionStatus(snap, date, s)` for that session. On Oct 11 the Easy 6 had nothing recorded (Missed) and the Strength session had logged sets (Done); `dayStatus` rolls "some missed, some kept" up to Floor, so the hero read FLOOR under "Easy 6" and the row read MISSED. The same split caused BONUS (hero, `dayStatus`) vs DONE (unplanned sheet, a hard-coded `'done'`) and "Open" (hero fallback for `STATUS_WORD.empty = ''`) vs "Rest" (Morning).

Fix: `sessionWord(snap, date, session | null)` is the one word for a session: hero, row and sheet all pass the session they show (`heroSession` picks the hero's); `null` reads Bonus when something was recorded, else Rest. `dayWord` is only for whole-day surfaces (ring segment, calendar). `words.test.ts` first reproduces all three disagreements with the exact calls the web makes today, then asserts the single answer. On the owner's live data: Oct 11 old hero "Floor", row "Missed", new hero "Missed", day (ring) "Floor".

The web callers are not switched over (outside my lane; the Today/Plan teams rebuild those surfaces on `sessionWord` / `dayPhase`). The one visible change in today's UI: chips for today's open session now read "Today" instead of "To do".

## Verification

```sh
pnpm install --offline
pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .   # exit 0
pnpm --filter @logbook/shared test   # 5 files, 59 tests (13 before)
pnpm --filter @logbook/api test      # 3 files, 35 tests (22 before)
pnpm --filter @logbook/web build     # built
```

API tests cover: first account via setup, second refused without `ALLOW_SIGNUP` and allowed with it, 409 duplicate, `ALLOW_SIGNUP` alone opening the first account; `onboardedAt` on `/me`, `/auth/me`, `/bootstrap`; onboarding writes (settings mapping, habit de-dup, block from next Monday, sessions on run days), idempotency (same habits, sessions, blocks, `onboardedAt`), `start: 'tomorrow'` + race date, 422 with nothing written; `/plans/template` creating block + sessions, `replace` removing only future unkept sessions in the window, validation, 401; `DELETE /me` with a coverage check (every `user_id` table in sqlite is in `USER_TABLES`), a row seeded in every user table for two users, wrong password (403, nothing deleted), success (every table empty for that user, the other user untouched, cookie cleared, old cookie 401, email reusable); migration 0006 run over a pre-0006 database (existing user gets a timestamp, new users null).

### Live run (port 8812, copy of the seed `test.db`, `ALLOW_SIGNUP=1 READS_FAKE_PICK=1`)

Script: `<scratchpad>/platform-curl.sh`, output `<scratchpad>/platform-curl.out`; the shared functions on the owner's data: `<scratchpad>/platform-owner.mts` → `platform-owner.out`.

- Server started on the seed DB and ran the pending migrations (3–6) cleanly.
- **Owner** `josh@example.com` signs in: `GET /me` → `onboardedAt: "2026-10-14T03:07:04.216Z"` (set by 0006); same on `/bootstrap`. Still set after the whole run.
- `GET /auth/status` → `{ hasAccount: true, setupOpen: true, signupOpen: true }`.
- `POST /auth/signup` fresh.runner@example.com → 201 `{ onboardedAt: null }`; again → 409 `email_taken`.
- `POST /me/onboarding` (10K, Tue/Thu/Sat/Sun, long Sun, 15 mi, wake 6:15, leave 8:45, pace 9:15, 3 habits) → 200: `onboardedAt` set, morning `wake 375, pace 555, showerAt 475`, 3 habits, block "10K · 10 weeks" 2026-10-19..2026-12-27, 40 sessions, `firstDay 2026-10-20`.
- Same call again (habits "Sleep 7 h", "stretch") → still 3 habits, one onboarding block, 40 sessions, same `onboardedAt`.
- `POST /plans/template` (5K, 6 weeks from 2027-01-04, `replace: true`) → 201 `{ block: "5K · 6 weeks", sessionCount 24, months [2027-01, 2027-02], removed 0 }`; bad goal → 422.
- `/bootstrap` → both blocks, habits, morning settings; October sessions: Easy 3.5, Intervals 4 (1 mi wu, 3 × 1000 m at 10K effort, 400 m jog, 1 mi cd), Easy 3.5, Long 4, Easy 4, Tempo 4, Easy 4.
- `DELETE /me` wrong password → 403 `bad_password`; right password → 200 with per-table counts (64 sessions, 2 blocks, 3 habits, 1 auth session, 1 setting, 1 user), `Set-Cookie: logbook_session=; Max-Age=0`. A second throwaway account's old cookie after delete → 401.
- Owner data through the new functions: `dayPhase` on Oct 14 (nothing planned) → `rest` all day, `evening` at 21:00, leave 9:30; Oct 16 at 6:00 → `morning`, Easy 4, `doorIn 90`; `weekStreak` → `{ weeks: 0, ofLast: { kept: 5, total: 8 } }`; this week's ring: missed, missed, rest, rest, future ×3, 26 mi planned.
- Server stopped by PID.

## Decisions worth a look

- **`sick` mark** for "skipped for illness": the streak rule needs to tell it from a plain skip, and nothing in the data could. Additive to `SessionMark`/`zMark`, no migration (text column). It reads Skipped everywhere.
- **Streak target** is `min(3, training sessions planned)`; rest days lower the bar instead of counting as sessions (otherwise any week with three rest days would be kept with every run missed).
- **`dayPhase` without settings** gives no countdown (`day`/`rest`/`evening` by clock) rather than assuming someone else's default morning.
- **Floors are not stored**: the app derives them from the session type (`floorFor`), so templates pick types whose floor is 20 or 30 min and expose `floorMin` for previews; `minutes` stays null on runs, as in the seed data.
- **`replace` hard-deletes**, like `POST /plans/apply`; it only touches sessions from today on whose status is not Done/Floor.
- **Wrong password on delete is 403**, not 401, so the client doesn't treat it as signed out.

## Left out

- Switching the current web callers (`DayView`, `SessionCard`, `PlanView`, `MoveSheet`) to `sessionWord` / `dayPhase` / `weekSummary`: the page teams' job; the web's `Bootstrap.user` and `AuthStatus` types are not widened (the new fields are additive).
- No template preview endpoint: `buildTemplate` is pure and runs in the client.
- No UI or menu item for the `sick` mark yet.
- Strava access is not revoked on Strava's side when an account is deleted (the tokens are deleted locally).
- `.env.example` and `README.md` don't mention `ALLOW_SIGNUP` (outside my files); suggest adding `ALLOW_SIGNUP=1` to `.env.example` for local dev.
- `/plans/template` uses the server's date for "future" when replacing; onboarding accepts the client's `today`.
