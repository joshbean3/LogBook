# Privacy claims

Every sentence in Logbook that makes a privacy claim, beside the code that makes it true. A false privacy sentence is an FTC risk and an App Review rejection (5.1.1, 5.1.2). This file is the release check for them.

## How to use this file

Before every release (it is a step in `release-checklist.md`):

1. Run `node scripts/privacy-claims.mjs --check`. It reads every string and every piece of screen text in `apps/web/src`, picks the ones that make a privacy claim, and fails if one is not written in this file. `pnpm ios:release` runs it and stops on a failure.
2. For each sentence it reports, find the code the sentence describes, read both, and add the sentence to the right table below. If the sentence is not true, fix the sentence or the code. Do not list it to make the check pass.
3. Re-read sections 1 and 2 against the server whenever a file under `apps/api/src/services` or `apps/api/src/routes` that calls Claude has changed. `apps/api/src/routes/claudeGuard.test.ts` fails when a new call site appears, which is the signal to come back here.
4. Re-read section 5 when `Info.plist`, the App Privacy answers or a legal page changes.

`node scripts/privacy-claims.mjs --list` prints every claim sentence with its file and line.

A sentence with a value in the middle is written here with `${}` in place of the value, the way the check reads it.

## 1. Where personal data can leave for Anthropic

These five are the only places the server calls Claude. Each is behind the consent record (`apps/api/src/services/consent.ts`): `at` is null until the person has answered, and then `training`, `recall` and `reads` are separate switches. `health` is always null in 1.0.

| # | Flow | Route | Call site | What is sent | Server gate |
|---|---|---|---|---|---|
| A | The assistant | `POST /api/assistant` (`routes/assistant.ts`) | `services/assistant.ts`, `api.beta.messages.stream` | What the person types, the photos and PDFs they attach, the earlier turns of that chat. With `training` on: training status, plan names and dates, sessions, to-dos and list names, goals, and what `get_sessions` looks up. | `requireAiPermission` answers 403 `consent_required` while `at` is null. `contextFor` and the tool handlers call `assistantMayReadTraining`, so with `training` off there is no context and no tool. |
| B | The plan builder | `POST /api/plans/draft` (`routes/ai.ts`) | `services/claude.ts`, `draftPlan`, `c.messages.stream` | What the person types or pastes and the file they attach. With `training` on: six weeks of run totals and recent paces from sessions marked done. In revise mode: the planned sessions in the range. | `requireAiPermission` (403 `consent_required`). `ctxOf` sends no runs with `training` off. Revise answers 403 `training_off` with `training` off. |
| C | The goal review | `POST /api/goals/refine` (`routes/goals.ts`) | `services/claude.ts`, `refineGoal`, `c.messages.create` | The words of one goal, its level and its period. | `requireAiPermission` (403 `consent_required`), then `training` must be on or the goal comes back as typed and nothing is sent. |
| D | Remember when | `GET /api/journal/recall` and its two sibling routes (`routes/journal.ts`) | `services/recall.ts`, `claudeSummary`, `api.messages.create` | One past journal entry or learning (4,000 characters at most), its date and the first name. One a day at most. | `mayWriteRecall`: `at` set and `recall` on. Otherwise the card shows the plain line and nothing is sent. |
| E | The daily pick | `GET /api/reads/pick` (`routes/reads.ts`) | `services/reads.ts`, `claudePicker.generate`, `c.messages.stream` with web search | Saved links: titles, addresses, site names, notes, tags, read or unread, and picks that were skipped. | `mayPickReads`: `at` set and `reads` on, checked in the route and again in `generate`. |

Never sent, by any of the five: the email address, the password, habits, wake time and morning routine, anything read from Apple Health (`health_samples`, `sleep_segments`), and anything from Strava (`activities`, `hr_zones`, `strava_accounts`).

Tests that prove it: `apps/api/src/routes/aiConsent.test.ts` (never asked sends nothing; each switch off sends nothing of its kind; a switch turned off mid-answer), `apps/api/src/routes/claudeGuard.test.ts` (every call site is exercised, none carries a Strava value, and the list of call sites in the source is exactly this one).

## 2. Sentences about what goes to Claude

| Sentence | Where it shows | Call sites | True because |
|---|---|---|---|
| `Your data is yours. It is never sold. It goes to Claude only when you say so.` | Privacy step before sign-up; Settings, Privacy (`features/auth/PrivacyFacts.tsx`, `PRIVACY_PROMISE`) | A to E | No route sells or exports data to anyone. Every Claude call is behind `at` and a switch (section 1). |
| `Sent to Claude, by Anthropic` and `If you allow, sent to Claude, by Anthropic` | Heading of the first list (`PrivacyFacts.tsx`) | A to E | The list under it is built by `privacyFacts(consent)` from the same record the server checks. |
| `What you type to the assistant and the files you attach.` | First list, always | A, B | Typed text and files go with every ask once `at` is set, whatever the switches say. |
| `Your plan, sessions, training status, goals and to-dos, only when you ask the assistant, draft a plan or review a goal.` | First list while `training` is on | A, B, C | `contextFor`, `ctxOf`, `refineGoal`. Nothing runs on its own: each needs a request from the person. |
| `Your plan, sessions, training status, goals and to-dos: off.` | Second list while `training` is off | A, B, C | `assistantMayReadTraining` is false: no context, no tools, no run totals, no revise, no goal review. |
| `One past journal entry or learning at a time, with your first name, to write Remember when.` (and the same with `: off.` or `: off until you turn it on.`) | Either list, by the `recall` switch | D | `mayWriteRecall`; one a day (`recallToday`). |
| `Your saved links, notes and tags, to pick a daily read.` (and the same with `: off.` or `: off until you turn it on.`) | Either list, by the `reads` switch | E | `mayPickReads`; `tasteProfile` builds the text from links, notes and tags only. |
| `Your email and password.` | Second list ("Not sent"), always | A to E | No prompt builder reads `users.email` or `users.password_hash`. |
| `Health data: not sent.` | Second list, always | A to E | No prompt builder reads a health table. `consent.health` is null and nothing checks it to send. |
| `Let the assistant read my training data` with `On. When you ask, it reads your plan, sessions, training status, goals and to-dos to answer.` or `Off. The assistant answers without your training data.` | The training switch (`PrivacyFacts.tsx`, `consentSub`) | A, B, C | `PUT /api/me/consent` writes `training`; section 1 gates. |
| `It runs on Claude, by Anthropic. To answer you, Logbook sends Claude what is listed here. Nothing is sent until you allow it.` | The ask before the account (`features/auth/Start.tsx`) | A to E | "Not now" stores nothing, so `at` stays null and every route answers 403 or falls back. |
| `You sign in with it. It is never sold.` | Sign-up, under the email field (`features/auth/AuthScreens.tsx`) | none | The address goes to the mail provider only, to send the two kinds of mail (`services/mail.ts`). |
| `What you type and the files you attach go to Claude, by Anthropic, to answer you.` and `${} to Claude, by Anthropic, to answer you.` | The assistant's permission step (`features/assistant/Permission.tsx`, `AssistantSheet.tsx`) | A | Same as the first row of the first list. |
| `Nothing is sent.` | The assistant's permission step, under Not now | A | The client does not call `POST /api/assistant` until there is an answer, and the server refuses with 403 if it did. |
| `Not asked yet. Nothing goes to Claude until you allow it.` | Settings, Privacy before an answer (`features/settings/privacyModel.ts`) | A to E | `at` null: 403 `consent_required` or the quiet fallback on every route. |
| `Anthropic runs the assistant and sees only what you allow. Fly.io hosts Logbook. The Privacy Policy lists everyone who handles your data.` | Settings, Privacy (`features/settings/PrivacyPage.tsx`) | A to E | Section 1; the policy's section 4 names all four companies. If the hosting company changes, this sentence and `legal-fields.json` change together. |
| `The assistant is Claude, by Anthropic. What you type or paste here, and any file or photo you attach, goes to Claude to write your plan.` | The plan builder's permission step (`features/plan/PlanBuilder.tsx`) | B | `draftPlan` sends the text and the file. |
| `This file goes to Claude, by Anthropic, to write your plan.` | The plan builder, the first time a file is attached | B | The file is sent inline with the draft request and is not stored. |
| `Your file or text goes to Claude, by Anthropic, to write the plan. Nothing is saved until you check it.` | The plan builder, before Build | B | A draft is returned to the screen; sessions are written only by `POST /api/plans/apply`. |
| `Write it your way. Claude reviews the wording.`, `Write it as you'd say it. Claude, by Anthropic, reviews the wording so it is specific, measurable and due ${}, and breaks it into steps.` and `Claude is reviewing the wording…` | The goal sheets (`features/goals/GoalSheetParts.tsx`, `GoalSheets.tsx`) | C | Shown only when the review is available (`at` set and `training` on). Otherwise the goal is saved as typed. |
| `Save links and Claude, by Anthropic, picks one new read a day.`, `Daily picks are made by Claude, by Anthropic, from the links you save.` and `Daily picks are off. Turn them on in Settings, Privacy, and Claude, by Anthropic, picks one new read a day from the links you save.` | Reads (`features/reads/ReadsView.tsx`, `TodaysPick.tsx`) | E | One pick a day plus three refreshes (`routes/reads.ts`); off or never asked answers `reason: 'off'` and sends nothing. |
| `AI assistant, powered by Claude. It can be wrong. Check anything important.` | Wherever the assistant is labeled (`lib/copy.ts`, `AI_LABEL`) | A | Names the provider. Not a data claim. Owner: check the wording against Anthropic's brand guidelines before submission. |

## 3. Sentences about what stays on the phone

| Sentence | Where it shows | True because |
|---|---|---|
| `Kept on this phone only.` | The assistant's chat history (`features/assistant/History.tsx`) | Chats are in localStorage under `logbook.assistant.chats` (`features/assistant/store.ts`). The server stores no chat. It does store each proposal the assistant made with the ask that led to it (`assistant_actions`), which the policy says. |
| `Chats are kept on this phone. What you send is processed by Claude.` | The assistant's History (`features/assistant/History.tsx`) | Chats are in localStorage under `logbook.assistant.chats` (`features/assistant/store.ts`); the server stores no chat. What is sent and when: flow A in section 1. |
| `This chat can't be saved on this phone. Delete old chats in History.` | The assistant, when the phone's storage for chats is full (`features/assistant/AssistantSheet.tsx`) | `store.ts` catches the quota error from `localStorage.setItem` and shows this line. Nothing is sent to the server to keep the chat instead. |
| `Report opens an email to Logbook with this answer in it. Nothing is sent until you send it.` and `Report opens an email to Logbook. Nothing is sent until you send it.` | The Report form under an answer (`features/assistant/Report.tsx`) | `reportMail` builds a `mailto:` link to `SUPPORT_EMAIL` and the app opens it; the app makes no request. The mail app sends it, and only if the person taps Send. |
| `Reset clears chats, drafts and view settings kept on this phone. Your account and anything waiting to sync stay.` | The error screen (`app/ErrorBoundary.tsx`) | Reset removes the `logbook.` keys but keeps the outbox. |
| `Saved on this phone. They send when Logbook is back online.` | Apple Health, uploads waiting (`features/settings/AppleHealth.tsx`) | The Swift engine queues uploads as files in Application Support/LogbookHealth (`HealthStorage.swift`), left out of backups. |

## 4. Sentences about Apple Health and about deleting

| Sentence | Where it shows | True because |
|---|---|---|
| `Logbook only reads. It never writes to Apple Health and never sells what it reads.` | Apple Health in Settings (`features/settings/healthCopy.ts`) | `HealthReader.requestAuthorization` passes `toShare: nil`. `scripts/release-check.mjs ios` fails if that changes or if `NSHealthUpdateUsageDescription` appears. No route sells data. |
| `Saved to your Logbook account` and `Readings are saved to your Logbook account on Logbook's server, so Progress can show them. Logbook reads as much history as you share, up to a year, then keeps up each time you open it.` | The connect sheet (`features/settings/AppleHealth.tsx`) | `POST /api/apple-health/sync` stores samples and sleep for the signed-in person's device token. `HEALTH_HISTORY_DAYS` is 365. The engine runs when the app opens. |
| The connect sheet's list: sleep, heart rate variability, resting heart rate | The connect sheet | `HealthReader.readTypes` is exactly those three (`scripts/release-check.mjs ios` and `scripts/release-check.test.mjs` fail on a fourth). The server refuses any other type with 422 `health_type`. |
| `Logbook stops reading Apple Health and deletes everything it read from your Logbook account. Nothing in Apple Health changes.` | The Disconnect sheet | `Health.disconnect()` wipes the queue, anchors, state and token on the phone (`HealthSync.disconnect`). `DELETE /api/apple-health` deletes the server rows. Logbook cannot write to Apple Health. |
| `Consumer health data privacy policy` | Link label in Settings, Privacy and the connect sheet | Opens `/legal/health-privacy.html`. |
| `It is deleted from Logbook right away. Backups clear within ${} days. Anthropic deletes what was sent to Claude within 30 days, unless it was flagged for abuse or the law requires longer.` | The Delete account sheet (`features/settings/accountModel.ts`) | `DELETE /api/me` removes every row in one transaction. The number is `BACKUP_KEEP_DAYS` (5), the same as the volume snapshots (`apps/api/RUNBOOK.md`). Anthropic's 30 days and the flagged-content exception are from its data retention page, read 2026-11-10. If either backup window changes, change the constant, the runbook and `docs/launch/legal-fields.json` together. |

## 5. Claims outside the web app

| Claim | Where | True because |
|---|---|---|
| `Logbook reads your sleep, heart rate variability and resting heart rate from Apple Health to show them on Progress. Readings are saved to your Logbook account.` | `Info.plist`, `NSHealthShareUsageDescription` (Apple's permission sheet) | Three read types; Progress draws them from `GET /api/apple-health/daily`. |
| `Take a photo of a training plan, a schedule or a list to send to the assistant or the plan builder.` | `Info.plist`, `NSCameraUsageDescription` | The camera is offered only by the two file inputs (the assistant's composer and the plan builder). |
| `Save the cards you share to your photo library.` | `Info.plist`, `NSPhotoLibraryAddUsageDescription` | Save Image in the share sheet writes one image. Logbook reads nothing from the library through this permission. |
| No tracking; data types: email, name, user id, other user content, photos, fitness, health (linked), crash data (not linked) | `PrivacyInfo.xcprivacy` and the App Privacy answers | No analytics or ad SDK is in the build. Error reports (`POST /api/client-errors`) carry no session and no account id. If that route ever logs an account id, crash data becomes linked here, in the manifest and in App Store Connect. |
| The privacy policy, the health data policy, the terms and the support page | `apps/web/public/legal`, written from `scripts/legal` | `scripts/legal-pages.test.mjs` checks the policy names every processor, every AI flow in section 1, the three Health types and the retention days. The sections to re-read against this file: policy 2 (what is collected), 4 (who receives it, the Claude table), 6 (retention). |

## 6. Sentences that must not come back

The check does not know these are false. A reviewer does.

- "never sold or shared", "never shared": data goes to Anthropic when allowed, and Apple calls that sharing (5.1.2(i)).
- "A short health summary goes with your question", "health summary": no code sends health readings to Claude.
- "recovery", "strain", "sleep score": nothing computes them.
- "Never sent: Strava data" in a release build: the build has no Strava, so the sentence has nothing to describe. It may appear only in the owner's build (`STRAVA_BUILT`).
- "Nothing is stored" about Anthropic: it keeps requests for up to 30 days.
