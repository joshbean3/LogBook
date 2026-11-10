# Logbook launch plan

Date: 2026-11-10. Goal: make Logbook ready for a public App Store launch on iPhone.

This plan is built from the verified audit in `docs/launch/audit.md` (638 reported findings, 424 after merging duplicates: 23 blockers, 56 high, 160 medium, 185 low) and from five requirement gap analyses (356 requirements, 97 owner tasks). Every finding is in a workstream, in Deferred, in Owner tasks, or merged into another finding. Nothing is dropped.

What this plan cannot promise: nobody has compiled the iOS project or run the app on an iPhone during this work. Swift and Xcode project changes are written without a Mac. The owner's device pass (section D, step 20) is the real gate. Treat every "on a phone" check as open until the owner has done it.

Sections: A the bar. Launch scope decisions. Step 0 and contracts. B blockers. C workstreams. D owner tasks. E deferred. F compliance checklist.

## A. The bar: what "ready" means

1. A stranger can install the app, create an account on production, finish setup and reach Today on any current iPhone, with no dead end.
2. Nothing a person writes is lost. A failed save keeps the words. Offline changes survive server errors. One account never sees another account's data on the same phone.
3. No personal data goes to Anthropic unless the person said yes to that flow. "Off" is enforced on the server and proven by tests. Strava data never goes to AI.
4. Every privacy sentence in the app is true. The privacy policy, terms and support page are public and are linked before sign-up and in Settings.
5. Apple Health asks only for what a screen shows, says where the data is stored, and stops at sign out.
6. A person can reset a password, export data to a real file and delete the account, and each does exactly what it says.
7. The binary has no developer screens, placeholder copy, hidden features or stale native settings. It carries the entitlement, privacy manifest and purpose strings it needs. It is iPhone only.
8. The assistant is labelled as AI, stays within training and wellness, has per-user cost limits, and the not-medical-advice line shows where it matters.
9. Core tasks work with VoiceOver and at large text sizes. Text contrast is 4.5:1 or better. Touch targets are 44 pt.
10. The owner has run the device pass on a release build, and App Store Connect holds true answers, a working demo account and clear review notes.

## Launch scope decisions

These seven choices shape the work. Each has a recommended default so the streams can start. The owner confirms them first (owner task 1). They are recorded in `docs/launch/decisions.md` by ws-11.

| # | Decision | Default for 1.0 | Why | If the owner says otherwise |
|---|---|---|---|---|
| D1 | Apple Health | Ship it, narrowed to three read types: sleep, heart rate variability, resting heart rate. Progress shows all three. | Today the app asks for 19 types, uploads a year of them and shows none. That is a rejection risk (5.1.1, 5.1.3, 2.1). Three types with real screens is honest and small. | Hold Apple Health out of 1.0: build with `VITE_FEATURE_HEALTH=0`, remove `@logbook/capacitor-health` from `apps/web/package.json`, remove `NSHealthShareUsageDescription`, the HealthKit entitlement and the Health entry in the privacy manifest, and do not mention Health in the listing. All Health items then move to Deferred. |
| D2 | Strava | Off in the 1.0 build. No Strava keys in production. All Strava UI hidden by a build flag. | A new Strava app is limited to one athlete until Strava approves it. Strava's rules on caching, analysis and branding are not met, and one question needs Strava's written answer. | Strava needs every item in the "Strava gate" list in section E first. |
| D3 | Devices | iPhone only. Portrait only. | The layout is a phone layout. iPad would need its own screenshots and review. | An iPad layout is a separate project. |
| D4 | Lowest iOS | iOS 17.0. | iOS 15 costs test time and gains almost no phones. | Any lower target adds a device to the test matrix. |
| D5 | Storefront and units | United States only. Miles and pounds only. Clock times follow the phone's 12 or 24 hour setting. | Kilometres, GDPR work and other languages are large. | Other regions wait for a units setting and a legal review. |
| D6 | Minimum age | 18 or older, stated at sign-up and in the terms. App Store age rating set to match. | The assistant is a general AI model and the app holds health data. 18 is the simplest safe line. | A lower age needs a lawyer's read on state age laws and Apple's Declared Age Range API. |
| D7 | Server address | A domain the owner controls, not `josh-logbook.fly.dev`. | The address is compiled into the binary, printed in the policy and shown to Apple. | Launching on the Fly subdomain works but ties the app to a personal name for good. |

## Step 0: one contract commit before the streams start

The eleven workstreams run in parallel and never edit the same file. A few of them need the same small names. Land this one commit on main first (about one hour, by the lead), then branch the streams from it. After it lands, each file belongs to the stream named beside it.

1. `apps/web/src/lib/siteLinks.ts` (then ws-02):

```ts
import { apiOrigin } from './native';
import { openLink } from '@/features/reads/openLink';

const site = (import.meta.env.VITE_SITE_ORIGIN as string | undefined) ?? (apiOrigin || window.location.origin);
export const LEGAL = {
  privacy: `${site}/legal/privacy.html`,
  healthPrivacy: `${site}/legal/health-privacy.html`,
  terms: `${site}/legal/terms.html`,
  acknowledgements: `${site}/legal/acknowledgements.html`,
} as const;
export const SUPPORT = `${site}/legal/support.html`;
/** Placeholder until the owner sets VITE_SUPPORT_EMAIL. The release script fails on example.com. */
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'support@example.com';
export const openExternal = (url: string) => openLink(url);
```

2. `apps/web/src/lib/copy.ts` (then ws-02):

```ts
export const DISCLAIMER = 'Logbook is for fitness and wellness. It is not medical advice. Talk to a doctor before changing your training, and if something feels wrong.';
export const AI_LABEL = 'AI assistant, powered by Claude. It can be wrong. Check anything important.';
export const MIN_AGE = 18;
```

3. `apps/web/src/lib/features.ts` (then ws-02):

```ts
/** Build-time feature choices. A server flag may report an outage. It never reveals a feature the build left out. */
export const STRAVA_BUILT = import.meta.env.VITE_FEATURE_STRAVA === '1';
export const HEALTH_BUILT = import.meta.env.VITE_FEATURE_HEALTH !== '0';
```

4. `packages/shared/src/schemas.ts` (then ws-01). Types only, no behaviour change yet:
   - `Consent` gains `recall: boolean`, `reads: boolean`, `version: string | null`. `DEFAULT_CONSENT` gains `recall: false, reads: false, version: null`. `zConsentInput` gains optional `recall`, `reads`, `version`, and `training` becomes optional. `readConsent` in `apps/api/src/services/consent.ts` returns the new fields.
   - `zOnboarding` gains optional `name`, `routine`, `trainWhen` (`'morning' | 'afternoon' | 'none'`) and `offWork` (minutes).
   - Existing tests must still pass after this commit. ws-01 flips the defaults later.

5. Empty folder markers so paths exist: `apps/web/public/legal/.gitkeep`, `docs/launch/` (already holds this plan).

A machine-readable copy of this step is in the scratch folder as `step0.md`, next to `workstreams.json`.

## Contracts between streams

Each contract is a small agreement that two or more streams code against. The stream named first builds it.

**C1 Consent (ws-01 builds; ws-03, ws-06, ws-07, ws-09, ws-10 read).** One record per account: `{ training, recall, reads, health, at, version }`. All false until the person says yes. `at: null` means never asked. `training` covers the plan, sessions, goals and to-dos for the assistant, the plan builder and the goal review. `recall` covers one past journal entry or learning plus the first name, for Remember when. `reads` covers saved links, notes and tags, for the daily pick. `health` stays null in 1.0: no health data goes to AI. Read through the bootstrap and `GET /api/me/consent`. Write with `PUT /api/me/consent` (any subset of the fields plus `version`). The server checks the switch on every Claude path. The client hides or rewords the feature when its switch is off. Current wording version: `2026-11`.

**C2 Local account wipe (ws-02 builds; every web stream obeys).** Anything a feature keeps on the device (localStorage, sessionStorage, idb-keyval) uses a key that starts with `logbook.`. On sign out, on Delete account and when a different user signs in, the shell empties the outbox, clears the query cache and idb-keyval, removes every `logbook.` key except `logbook.hasAccount`, cancels reminders 7000 to 7006, disconnects Apple Health, then reloads the page so in-memory state resets. Features do not write their own sign-out code. The shell also dispatches the window event `logbook:assistant-reset` from the assistant's error boundary; the assistant drops its current chat when it hears it.

**C3 Account endpoints (ws-01 builds; ws-03 and ws-10 call).**
- `POST /api/auth/forgot { email }` always answers `200 { ok: true }`.
- `POST /api/auth/reset { token, password }` answers 200, or 400 with code `reset_invalid`. It drops every session.
- `POST /api/me/password { current, next }` answers 200, or 403 with code `wrong_password`.
- The reset mail links to `<APP_URL>/login?reset=<token>`. The verification mail links to `<APP_URL>/api/auth/verify?token=<token>`, which answers a small HTML page.
- `POST /api/auth/logout` accepts an optional `{ healthTokenId }` and revokes that device token.
- Server env: `MAIL_API_KEY`, `MAIL_FROM`. With no key the server logs the link in development. In production it logs a warning at boot and the post-deploy check fails.

**C4 Health daily (ws-01 builds; ws-08 reads).** `GET /api/apple-health/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` answers `{ days: [{ date, sleepMin, hrvMs, restingHr }] }`. Each value is a number or null. At most 400 days per call.

**C5 Onboarding (ws-01 builds; ws-03 calls).** `POST /api/me/onboarding` takes the optional fields added in step 0 and writes them in the same transaction. `goal` may be null, which finishes setup with no plan.

**C6 Shared constants (ws-02 owns after step 0).** `LEGAL`, `SUPPORT`, `SUPPORT_EMAIL`, `openExternal` from `lib/siteLinks.ts`. `DISCLAIMER`, `AI_LABEL`, `MIN_AGE` from `lib/copy.ts`. `STRAVA_BUILT`, `HEALTH_BUILT` from `lib/features.ts`. Strava UI shows only when `STRAVA_BUILT && features.strava`. Apple Health UI shows only when `HEALTH_BUILT`. ws-11 writes the pages that `LEGAL` and `SUPPORT` point to.

**C7 Client error reports (ws-01 builds the route; ws-02 sends).** `POST /api/client-errors { message, stack, route, appVersion, ua }`, at most 8 KB, no session needed, answers 204. No user content and no health data in the body.

**C8 Glossary (every stream).** One word for each thing in UI copy:
- "the assistant" for the AI. "Claude, by Anthropic" only where the provider is named. Never "coach" in UI.
- "entry" and "entries" for the journal. "Favorite" for the saved state (not "Starred", not "Favourite").
- "learning" for an item in Learned.
- "plan" for a training plan (not "block"). "Warm-up week" (not "Lead-in").
- "habits", shown as tiles on Today.
- "Wake time" (not "Alarm").
- "Tomorrow" for the move-to-next-day action.
- "Apple Health" for the integration, "the Apple Health app" for Apple's app. Never "Apple Health data".
- American spelling. No em dashes. The empty-value mark is the en dash.

**C9 Small API additions (ws-01 builds; named streams read).**
- `POST /api/goals/refine` answers `{ text, why, changed, steps, available }`. A refusal answers 422 with code `refused` (ws-06).
- `POST /api/plans/apply` answers with `replacedIds: string[]` (ws-08).
- `GET /api/journal` answers with `total` (ws-07).
- Claude outages answer 503 with code `claude_busy` or `claude_not_configured`. Limits answer 429 with code `rate_limited` and a Retry-After header (ws-06, ws-08, ws-09).

## Rules for building in parallel

- A stream edits only the paths it owns (listed in section C and in `workstreams.json`). A needed change in someone else's path is a request to that stream, not an edit.
- Feature streams add feature-local hooks rather than editing `apps/web/src/api/queries.ts`.
- `pnpm-lock.yaml` belongs to nobody. The lead regenerates it with `pnpm install` at merge.
- New database tables and columns go through ws-01 only, in one migration line.
- Design fixes follow `docs/shape-system.md`: 16 px gutter, 12 px between cards, no visible card borders, tokens before one-off values. Layout fixes are checked at 320 and 390 wide, and at 135% and 200% text.
- UI copy is plain and short. No em dashes.
- Each stream finishes with `pnpm typecheck` and `pnpm test` green and a short list of what it could not check without a phone.
- Merge order: step 0, then ws-01 and ws-02, then the feature streams in any order, then ws-11. After the merge the lead runs the Playwright and axe suites from ws-11 against the merged build.
- Within a stream, work in severity order: blockers, high, medium, then low. Low items may slip to 1.0.1 if the stream runs long; say which.

## B. Blockers, in order

There are 23 blockers after merging (62 were reported). The order follows dependencies: open the door, publish the legal pages, make the AI consent true, make Apple Health honest, stop data loss, then recovery and cleanup. "Change" names the stream that does each part. "Done when" is the check.

### B1. Public sign-up is off in production today

Finding auth-02, also reported as sec-01, gap-ios-07, gap-rev-09, gap-sub-49, perf-19. Effort S.

Why it blocks: A reviewer or a new user who taps Get started cannot create an account (Guideline 2.1).

Change:

- ws-01-server: Set ALLOW_SIGNUP = "1" in fly.toml [env]. Add a post-deploy check (apps/api script) that reads /api/auth/status and exits non-zero when sign-up is closed.

Done when:

- ws-01-server: fly.toml sets ALLOW_SIGNUP = "1". After deploy, GET /api/auth/status on production reports sign-up open, and scripts in the deploy check fail if it does not.

### B2. No privacy policy exists, in the app or on the web

Finding copy-legal-01, also reported as auth-01, gap-leg-01, gap-rev-15, gap-sub-26, settings-01. Effort M.

Why it blocks: App Store Connect needs a policy URL, and the app must link the policy (5.1.1(i)). Other privacy copy points at it, so it comes first.

Change:

- ws-03-auth-onboarding: Add the links using LEGAL from lib/siteLinks.ts.
- ws-10-settings: Add the rows and the connect-sheet link using LEGAL from lib/siteLinks.ts.
- ws-11-ios-release: Draft the privacy policy and the separate consumer health data policy as plain static HTML from the outline in research_notes/App Store launch readiness/legal_privacy.md section 1. The API already serves the web build, so they are public at &lt;origin>/legal/\*.html.

Done when:

- ws-03-auth-onboarding: The privacy step links to the Privacy Policy. The sign-up password step reads "By creating an account you agree to the Terms and Privacy Policy" with both links, opened in the in-app browser.
- ws-10-settings: Settings, Privacy has rows for Privacy Policy and Consumer health data privacy policy; the Apple Health connect sheet links to the policy.
- ws-11-ios-release: apps/web/public/legal/privacy.html and health-privacy.html exist, load signed out at /legal/privacy.html and /legal/health-privacy.html, and name every data flow in the app. Marked DRAFT until the owner approves the text.

### B3. No terms of use, no minimum age, no support contact and no password recovery

Finding copy-legal-02, also reported as gap-leg-20, gap-rev-07, gap-sub-40. Effort M.

Why it blocks: An app with accounts, health data and an AI assistant has no terms, no age line and no recovery path.

Change:

- ws-03-auth-onboarding: Add the age line to the sign-up password step and the Forgot password link on /login (flow in sec-04).
- ws-10-settings: Add the About group using LEGAL and SUPPORT from lib/siteLinks.ts.
- ws-11-ios-release: Draft Terms of Use as static HTML: account, acceptable use, the AI and not-medical-advice terms, minimum age 18, termination, contact.

Done when:

- ws-03-auth-onboarding: Sign-up states "You must be 18 or older" beside the terms line. /login has "Forgot password?".
- ws-10-settings: Settings has an About group: Help and contact, Terms of Use, Privacy Policy, Acknowledgements. Each opens.
- ws-11-ios-release: apps/web/public/legal/terms.html exists, states the minimum age (18) and loads signed out. Marked DRAFT until the owner approves.

### B4. No support page and no way to contact the developer, in the app or on the web

Finding gap-sub-47, also reported as gap-qua-58, gap-rev-04, gap-leg-47. Effort S.

Why it blocks: A Support URL and a way to reach the developer from inside the app are required (1.5).

Change:

- ws-03-auth-onboarding: Add the link using SUPPORT from lib/siteLinks.ts.
- ws-10-settings: Row added with the About group (copy-legal-02).
- ws-11-ios-release: Draft the support page as static HTML.

Done when:

- ws-03-auth-onboarding: /login and /start show a quiet "Help" link to the support page, so a signed-out person can reach the developer.
- ws-10-settings: Settings, About, "Help and contact" opens the support page and offers a mailto link.
- ws-11-ios-release: apps/web/public/legal/support.html exists with the contact address and short answers (reset password, delete account, disconnect Apple Health, export data) and loads signed out.

### B5. AI data sharing is pre-enabled, and some sharing has no choice at all

Finding auth-03, also reported as gap-rev-20, gap-sub-34, assistant-19, sec-20, gap-rev-22. Effort M.

Why it blocks: Sharing personal data with a third-party AI needs explicit permission before it happens (5.1.2(i)). A switch that starts on is not permission.

Change:

- ws-01-server: In packages/shared/src/schemas.ts change the consent shape and default as in the plan's Contract 1. In routes/auth.ts stop defaulting training to on at sign-up. In services/consent.ts treat no record as not granted, add mayWriteRecall and mayPickReads, and keep an append-only log in user_settings key consentLog.
- ws-03-auth-onboarding: Replace the pre-set switch with two buttons so the person acts either way. Keep the list truthful for both states. Send the wording version with the choice.
- ws-09-assistant: On first open with consent.at null, show a small Allow / Not now step built inside features/assistant (what is sent, link to LEGAL.privacy) and store the answer through the consent endpoint before the first ask. Do not import from features/auth.
- ws-10-settings: Rebuild the Privacy page on the Contract 1 shape: three switches, each with one plain line on what is sent.

Done when:

- ws-01-server: DEFAULT_CONSENT is { training: false, recall: false, reads: false, health: null, at: null, version: null }. zConsentInput accepts training, recall, reads, health and version. Sign-up with no choice stores nothing as granted. Tests: an account with no consent record reads as not granted on every Claude path. Each change appends { kind, value, at, version } to the consent log.
- ws-03-auth-onboarding: The privacy step shows two buttons, Allow and Not now. Nothing is preselected and the choice is stored with its time and wording version.
- ws-09-assistant: An account whose consent.at is null sees the permission step the first time the assistant opens, before anything is sent. This covers people who sign in rather than sign up, and the review demo account.
- ws-10-settings: Settings, Privacy shows three switches (training data, Remember when, daily read) that read and write the same consent record, and "Not asked" when consent.at is null.

### B6. The consent switch does not stop every path: with it off the assistant can still read sessions through its tool, and plan revise still sends them

Finding assistant-03, also reported as copy-legal-05, sec-03, settings-05, plan-03, gap-rev-21. Effort M.

Why it blocks: The switch says off and the server still sends. The app breaks its own promise.

Change:

- ws-01-server: In ask(): send no tools when assistantMayReadTraining is false and guard both tool handlers on the server. In /plans/draft refuse mode revise with "Turn on 'Let the assistant read my training data' in Settings, Privacy to revise your plan." One test per path with consent off.

Done when:

- ws-01-server: Tests: with training consent off, an ask sends no tools; get_sessions and propose_changes return an error result; POST /plans/draft in revise mode answers 403 with the plain message.

### B7. The goal review sends goal text to Claude even when the AI consent switch is off

Finding goals-01. Effort M.

Why it blocks: Goal text goes to Claude with the switch off.

Change:

- ws-01-server: Gate /goals/refine on assistantMayReadTraining and add the case to the consent tests.
- ws-06-goals-learned: Read consent from bootstrap in GoalEditor.

Done when:

- ws-01-server: Test: with training consent off, POST /goals/refine returns available:false and makes no Claude call.
- ws-06-goals-learned: With consent off the editor skips the request, saves as typed and shows "Saved as written. Turn on assistant access in Settings to have goals reviewed." With it on the hint names Claude.

### B8. Journal entries and the saved Reads list go to Claude automatically, with no off switch

Finding copy-legal-06, also reported as sec-05, assistant-08, journal-08, learned-01, settings-04, gap-leg-31. Effort M.

Why it blocks: Journal text and saved links go to Claude with no switch at all.

Change:

- ws-01-server: Gate services/recall.ts on mayWriteRecall and services/reads.ts on mayPickReads. Cap Another to the stated daily number.
- ws-03-auth-onboarding: Correct the facts list in PrivacyFacts.tsx.
- ws-07-journal-share: Read the two consent flags from bootstrap in RecallCard, TodaysPick and ReadsView.
- ws-10-settings: Covered by the three-switch Privacy page in auth-03.

Done when:

- ws-01-server: Tests: with the recall switch off, Remember when uses fallbackSummary and no journal or learning text reaches Claude; with the reads switch off, no saved link reaches Claude and no pick is made. Another and Hide never send more than the copy states.
- ws-03-auth-onboarding: The Sent to Claude list names "One past journal entry or learning at a time, with your first name, to write Remember when" and "Your saved links, notes and tags, to pick a daily read", each shown only as its switch allows.
- ws-07-journal-share: With recall off, Remember when shows the plain excerpt. With reads off, Today's pick is hidden. The Reads screen says picks are chosen by Claude.
- ws-10-settings: Settings, Privacy carries the two new switches (built in auth-03, settings part).

### B9. "Never sent: Strava data" is false: Strava heart-rate zones go to Claude in the plan builder

Finding copy-legal-03, also reported as assistant-02, gap-leg-38, gap-rev-25, plan-01, sec-02. Effort S.

Why it blocks: Strava's API terms forbid sending its data to AI, and the app says it never does.

Change:

- ws-01-server: Return zones: null from ctxOf and drop the heart-rate zones line from the plan prompt. Add the guard test with a fake Claude client.
- ws-08-plan-progress: Change the fine print line in PlanBuilder.tsx.

Done when:

- ws-01-server: ctxOf always returns zones: null. An API test fails if any value from activities, hr_zones or strava_accounts appears in a Claude request body, for every Claude call site.
- ws-08-plan-progress: PlanBuilder fine print reads "Reads your source and the runs you marked done, then returns dated sessions you can check before saving."

### B10. "Never sold or shared" is not true, and the list of what goes to Claude leaves flows out

Finding gap-leg-06, also reported as copy-legal-04, auth-04, gap-rev-30, sec-15, settings-09. Effort S.

Why it blocks: A false privacy claim is an FTC risk and an App Review risk.

Change:

- ws-03-auth-onboarding: Reword the promise in PrivacyFacts.tsx so it is literally true.
- ws-10-settings: Reword the Apple Health line and the Privacy page headline.
- ws-11-ios-release: Write the release check for privacy sentences.

Done when:

- ws-03-auth-onboarding: The headline reads "Your data is yours. It is never sold. It goes to Claude only when you say so."
- ws-10-settings: AppleHealth.tsx reads "Logbook only reads. It never writes to Apple Health and never sells what it reads." The Privacy page carries the same headline as sign-up.
- ws-11-ios-release: docs/launch/privacy-claims.md lists every privacy sentence in the app beside the Claude call site it describes; the release checklist says to re-read it.

### B11. Apple Health as built collects far more than the app shows: 19 types and a year of history go to the server, and no screen shows any of it

Finding ios-03, also reported as gap-ios-03, progress-01, gap-rev-13, gap-rev-17, gap-rev-10. Effort L.

Why it blocks: The app collects health data it never shows (5.1.1(iii), 5.1.3, 2.1).

Change:

- ws-01-server: Add the read route in routes/appleHealth.ts and services/appleHealth.ts; narrow the accepted types.
- ws-08-plan-progress: Feed the three metrics from GET /api/apple-health/daily; sleep shows one decimal hour; drive the eyebrow from the real connection state; remove the permanent Syncing state. Drop Run pace from the tiles when there is no timed-run source (progress-05).
- ws-10-settings: Covered by copy-legal-30, settings part.
- ws-11-ios-release: Cut readTypes and the sync payloads in HealthReader.swift and HealthSync.swift to the three types; remove workout routes, workouts, heart rate buckets, steps, energy and the rest until a screen shows them; drop sourceName.

Done when:

- ws-01-server: GET /api/apple-health/daily?from&to returns { days: [{ date, sleepMin, hrvMs, restingHr }] } for the signed-in user (Contract 4). The sync routes reject any other type with 422. Tests cover both.
- ws-08-plan-progress: With Apple Health connected, the Sleep, HRV and Resting HR tiles and pages draw real numbers. Not connected: a Connect Apple Health button. "Syncing" shows only while a sync is running.
- ws-10-settings: The primer promises only sleep, HRV and resting heart rate on Progress and says readings are saved to the Logbook account.
- ws-11-ios-release: HealthReader requests exactly three read types: sleepAnalysis, heartRateVariabilitySDNN, restingHeartRate. The engine uploads no other type and no sourceName.

### B12. Apple Health purpose string, connect sheet and tour promise recovery, strain and sleep scores that the app never shows

Finding copy-legal-30, also reported as copy-legal-07, gap-ios-04, gap-leg-03, gap-rev-23, gap-sub-35, gap-rev-01, ios-11, gap-rev-16. Effort M.

Why it blocks: The permission text promises features that do not exist (2.3.1, 5.1.1).

Change:

- ws-03-auth-onboarding: Rewrite the tour's Apple Health line in Tour.tsx.
- ws-10-settings: Rewrite the Apple Health primer and connect sheet in AppleHealth.tsx to describe only what 1.0 shows.
- ws-11-ios-release: Rewrite the two purpose strings in Info.plist to match what 1.0 does.

Done when:

- ws-03-auth-onboarding: The tour line about Apple Health names only sleep, HRV and resting heart rate on Progress.
- ws-10-settings: The connect sheet lists exactly sleep, heart rate variability and resting heart rate, says they are saved to the Logbook account on Logbook's server, and links to the policy. No "recovery", "strain" or "sleep score" anywhere in Settings.
- ws-11-ios-release: NSHealthShareUsageDescription reads "Logbook reads your sleep, heart rate variability and resting heart rate from Apple Health to show them on Progress. Readings are saved to your Logbook account." NSCameraUsageDescription names the assistant and the plan builder. No string says recovery, strain or score.

### B13. HealthKit entitlement and capability are not in the project: Apple Health cannot work in a build of this repo

Finding ios-01, also reported as gap-ios-01, gap-sub-12. Effort S.

Why it blocks: Without the entitlement Apple Health cannot work in the shipped build.

Change:

- ws-11-ios-release: Add the entitlements file and the CODE_SIGN_ENTITLEMENTS build setting in both configurations of project.pbxproj; the file must still parse. The owner then enables HealthKit on the App ID and confirms in Xcode.

Done when:

- ws-11-ios-release: apps/web/ios/App/App/App.entitlements holds com.apple.developer.healthkit = true; CODE_SIGN_ENTITLEMENTS points at it in Debug and Release; no healthkit entry in UIRequiredDeviceCapabilities.

### B14. No app privacy manifest (PrivacyInfo.xcprivacy) in the app target, while a plugin compiled into the app reads file timestamps

Finding ios-02, also reported as gap-ios-02, gap-sub-17. Effort S.

Why it blocks: Uploads without a privacy manifest for required-reason APIs are flagged by App Store Connect.

Change:

- ws-11-ios-release: Add the manifest and its pbxproj entries: tracking false; file timestamp reason C617.1; collected data types EmailAddress, Name, UserID, OtherUserContent, PhotosorVideos, Fitness, Health (linked, purpose AppFunctionality) and CrashData for the client error reports (not linked); none for tracking. Add the file reference to the App target by following the pattern of an existing resource; project.pbxproj must still parse.

Done when:

- ws-11-ios-release: apps/web/ios/App/App/PrivacyInfo.xcprivacy is in the App target's resources with the contents listed in the finding, Health included.

### B15. No NSPhotoLibraryAddUsageDescription: Save Image in the iOS share sheet will crash the app or be missing

Finding journal-02, also reported as ios-05, gap-ios-05, gap-sub-14. Effort S.

Why it blocks: Save Image without the purpose string crashes or goes missing.

Change:

- ws-11-ios-release: Add the key. The owner tests Save Image on a phone.

Done when:

- ws-11-ios-release: Info.plist has NSPhotoLibraryAddUsageDescription "Save the cards you share to your photo library."

### B16. Signing out or deleting the account leaves the last user's assistant chats and unsent changes on the phone; the next account sees and inherits them

Finding shell-26, also reported as perf-01, assistant-01, gap-ios-08, settings-02, sec-14, journal-34, auth-24. Effort S.

Why it blocks: The next person on the phone sees the last person's chats and inherits their unsent changes. On-device deletion is incomplete (5.1.1(v)).

Change:

- ws-02-shell-foundation: Add clearLocalAccount() in App.tsx's signed-out path (Contract 2): empty the outbox, clear the persisted query cache and idb-keyval, remove every localStorage and sessionStorage key that starts with "logbook." except logbook.hasAccount, cancel reminders (goals-11), disconnect Health (ios-04), then reload the page so in-memory stores reset.

Done when:

- ws-02-shell-foundation: Test: sign out, sign up as someone else: History is empty, the outbox is empty, no reminder is pending, no key starting with "logbook." remains except logbook.hasAccount, the query cache and idb-keyval store are empty. The same wipe runs after Delete account and when a different user signs in.

### B17. Queued offline writes are thrown away when the server answers 5xx, 401 or 429 on replay

Finding shell-01, also reported as gap-qua-23, perf-02, learned-25. Effort M.

Why it blocks: An ordinary deploy or an expired session silently destroys work done offline.

Change:

- ws-02-shell-foundation: In replay drop an item only on a definitive client rejection. On 401 stop and keep the queue. On 408, 425, 429 and 5xx stop and retry with backoff. Stamp each item with the user id.

Done when:

- ws-02-shell-foundation: outbox.test.ts: on 503, 401 and 429 the queue is kept; items drop only on 400, 404, 409, 410, 413, 422, each with the toast "One change could not be saved"; each item carries the user id that wrote it and replays only for that user.

### B18. No root error boundary: a render error outside a tab page blanks the whole app, and saved data in a bad shape keeps it blank

Finding shell-02, also reported as perf-05. Effort M.

Why it blocks: One render error blanks the whole app. App Review treats that as a crash.

Change:

- ws-02-shell-foundation: Wrap the tree in main.tsx in a top-level ErrorBoundary whose fallback clears the cache key and reloads. Give SheetProvider's panel body and ContextMenu their own boundary. Validate the bootstrap before caching. Dispatch a window event (logbook:assistant-reset) from the assistant boundary so the assistant stream can drop the current chat.
- ws-09-assistant: Sanitise saved chats on load in store.ts and handle logbook:assistant-reset.

Done when:

- ws-02-shell-foundation: A thrown error in a sheet body, the dock, the nav bar or a sign-in screen shows a safe full-screen fallback with Reload, not a blank page. A bootstrap in a bad shape never enters the cache. The assistant boundary offers "Start a new chat".
- ws-09-assistant: A saved chat with a malformed turn loads without a crash (bad turns are dropped) and "Start a new chat" always works.

### B19. A memory is silently thrown away when its save fails (server error, or text over 5,000 characters)

Finding journal-01. Effort S.

Why it blocks: The journal loses the user's writing with no warning.

Change:

- ws-07-journal-share: Keep the draft until the write is confirmed or queued offline; restore on error for add and patch; import the existing watchJournalAdd from features/day/journalGuard.ts without editing it.

Done when:

- ws-07-journal-share: A save that fails (server error, or text over 5,000 characters) puts the words back in the writer with the toast "Couldn't save that. Your words are back." The field has maxLength 5000.

### B20. AI plan preview can say 'Add to my plan' while it replaces existing sessions, and a Replace has no way back

Finding plan-02. Effort M.

Why it blocks: A wrong button label leads to deleted sessions with no way back.

Change:

- ws-01-server: Return replacedIds from /plans/apply as /plans/template does.
- ws-08-plan-progress: In Preview load the draft's months before enabling the buttons; count as the server does; wire Undo to replacedIds.

Done when:

- ws-01-server: POST /plans/apply returns replacedIds, and a restore call brings them back. Test added.
- ws-08-plan-progress: The preview button says "Replace N sessions" whenever sessions in range will be replaced, and "Add to my plan" only when none are. A Replace offers Undo that restores them. Test for a draft that starts in a later month.

### B21. Export cannot save a file inside the iOS app, yet the row says "Saved"; "Export my data first" before deleting gives no feedback at all

Finding settings-03, also reported as copy-legal-13, ios-28. Effort M.

Why it blocks: The app says a backup was saved right before an irreversible delete, and no file exists.

Change:

- ws-10-settings: On native write the JSON with @capacitor/filesystem to the cache directory and open @capacitor/share. Keep the download on the web.

Done when:

- ws-10-settings: On iPhone, Export writes the file and opens the share sheet; the row says "Shared" only when the share resolves and "Export cancelled" on cancel. In the delete sheet the export shows progress and its result before the person continues.

### B22. No password reset, no email verification, no way to change password or email

Finding sec-04, also reported as auth-05, settings-08. Effort L.

Why it blocks: A forgotten password locks a person out for good, and out of deleting the account.

Change:

- ws-01-server: Build forgot and reset, change password and the verification mail (Contract 3). Changing the email address waits (Deferred).
- ws-03-auth-onboarding: Add the forgot step and the reset form inside the existing /login screen (no new route).
- ws-10-settings: Add the sheet calling POST /me/password.

Done when:

- ws-01-server: Tests: POST /auth/forgot always answers 200 and is rate limited; the emailed token is single-use, expires in 30 minutes and is stored hashed; POST /auth/reset sets the password and drops every session; POST /me/password needs the current password; sign-up sends a verification mail. Mail goes through one sender module with a provider key from env, and logs the link in development.
- ws-03-auth-onboarding: /login has "Forgot password?": enter the email, see "If that address has an account, a reset link is on its way." Opening /login?reset=&lt;token> shows the new-password form.
- ws-10-settings: Settings, Account has "Change password" (current, new, confirm) with plain errors.

### B23. A dev screen, a build stamp and placeholder copy ship in the app

Finding gap-rev-08, also reported as gap-qua-68, gap-sub-54, copy-legal-28, gap-ios-11, perf-16, shell-06, ios-23. Effort S.

Why it blocks: Developer screens and placeholder copy are a 2.1 rejection.

Change:

- ws-02-shell-foundation: Gate the /dev route and its lazy import on import.meta.env.DEV. In lib/native.ts accept a deep link only if its path matches a known route. Keep test stubs out of production bundles.
- ws-10-settings: Drop the build line from the footer and remove the Units row until kilometres exist.
- ws-11-ios-release: Add the bundle check to the release script.

Done when:

- ws-02-shell-foundation: A production build has no /dev/ui route and no UiGallery, PagerLab or StubRoots chunk (grep of dist). Deep links are checked against an allow-list of real routes.
- ws-10-settings: The release Settings footer shows the version only. The Units row is gone. No placeholder copy remains in Settings.
- ws-11-ios-release: The release script greps the built bundle for UiGallery and "dev/ui" and fails on a hit.

## C. Workstreams

Eleven workstreams. Each owns a set of paths and no path has two owners. Together they hold 393 findings (537 items, because a finding that needs changes in several places has one item per stream). The same data is in `workstreams.json` in the scratch folder.

| Key | Title | Items | Blocker | High | Medium | Low |
|---|---|---:|---:|---:|---:|---:|
| ws-01-server | Server, shared schemas and deploy config | 61 | 9 | 17 | 23 | 12 |
| ws-02-shell-foundation | App shell, design tokens, shared UI, data layer | 67 | 4 | 11 | 27 | 25 |
| ws-03-auth-onboarding | Welcome, sign up, sign in and first-run onboarding | 64 | 8 | 7 | 27 | 22 |
| ws-04-today-training | Today: header, training card, morning, sessions, evening | 33 | 0 | 6 | 10 | 17 |
| ws-05-today-lists | Today: habits, plan your day, to-dos | 37 | 0 | 6 | 13 | 18 |
| ws-06-goals-learned | Goals and Learned tabs | 55 | 1 | 5 | 22 | 27 |
| ws-07-journal-share | Journal, Library, Reads and share cards | 44 | 2 | 5 | 20 | 17 |
| ws-08-plan-progress | Plan and Progress tabs | 63 | 3 | 8 | 29 | 23 |
| ws-09-assistant | AI assistant sheet | 29 | 2 | 4 | 13 | 10 |
| ws-10-settings | Settings, privacy page, data sources, account | 53 | 11 | 8 | 16 | 18 |
| ws-11-ios-release | iOS project, Health plugin, release scripts, CI, legal pages, launch docs | 31 | 10 | 3 | 13 | 5 |

Counts in the blocker column are parts of blockers, not separate blockers: one blocker often has a server part, a screen part and a Settings part.

### ws-01-server: Server, shared schemas and deploy config

Owns:

- `apps/api/**`
- `packages/shared/**`
- `fly.toml`
- `Dockerfile`
- `docker-compose.yml`
- `README.md`
- `.env.example`

Notes: One owner for the whole server and the shared package, because they share one schema, one migration line and one index.ts. Work in three passes: A, AI data flows and consent (routes ai, assistant, goals, journal, reads; services assistant, assistantJobs, claude, consent, recall, reads; new aiLimits.ts and aiSafety.ts). B, accounts and security (auth, me, index.ts, env.ts, db, lib). C, integrations and data (strava, appleHealth, exporter, import, account, timeline, seed). Two engineers can share the stream if one takes pass A and the other B and C; schema.ts, index.ts and packages/shared stay with the B and C engineer. Every new table goes through one migration line.

Contracts: C1 consent, C3 account endpoints, C4 health daily, C5 onboarding, C7 client errors, C9 small API additions.

| Id | Severity | Pass | Change | Done when |
|---|---|---|---|---|
| assistant-03 | blocker | A | In ask(): send no tools when assistantMayReadTraining is false and guard both tool handlers on the server. In /plans/draft refuse mode revise with "Turn on 'Let the assistant read my training data' in Settings, Privacy to revise your plan." One test per path with consent off. | Tests: with training consent off, an ask sends no tools; get_sessions and propose_changes return an error result; POST /plans/draft in revise mode answers 403 with the plain message. |
| auth-02 | blocker | B/C | Set ALLOW_SIGNUP = "1" in fly.toml [env]. Add a post-deploy check (apps/api script) that reads /api/auth/status and exits non-zero when sign-up is closed. | fly.toml sets ALLOW_SIGNUP = "1". After deploy, GET /api/auth/status on production reports sign-up open, and scripts in the deploy check fail if it does not. |
| auth-03 | blocker | A and B/C | In packages/shared/src/schemas.ts change the consent shape and default as in the plan's Contract 1. In routes/auth.ts stop defaulting training to on at sign-up. In services/consent.ts treat no record as not granted, add mayWriteRecall and mayPickReads, and keep an append-only log in user_settings key consentLog. | DEFAULT_CONSENT is { training: false, recall: false, reads: false, health: null, at: null, version: null }. zConsentInput accepts training, recall, reads, health and version. Sign-up with no choice stores nothing as granted. Tests: an account with no consent record reads as not granted on every Claude path. Each change appends { kind, value, at, version } to the consent log. |
| copy-legal-03 | blocker | A | Return zones: null from ctxOf and drop the heart-rate zones line from the plan prompt. Add the guard test with a fake Claude client. | ctxOf always returns zones: null. An API test fails if any value from activities, hr_zones or strava_accounts appears in a Claude request body, for every Claude call site. |
| copy-legal-06 | blocker | A | Gate services/recall.ts on mayWriteRecall and services/reads.ts on mayPickReads. Cap Another to the stated daily number. | Tests: with the recall switch off, Remember when uses fallbackSummary and no journal or learning text reaches Claude; with the reads switch off, no saved link reaches Claude and no pick is made. Another and Hide never send more than the copy states. |
| goals-01 | blocker | A | Gate /goals/refine on assistantMayReadTraining and add the case to the consent tests. | Test: with training consent off, POST /goals/refine returns available:false and makes no Claude call. |
| ios-03 | blocker | B/C | Add the read route in routes/appleHealth.ts and services/appleHealth.ts; narrow the accepted types. | GET /api/apple-health/daily?from&to returns { days: [{ date, sleepMin, hrvMs, restingHr }] } for the signed-in user (Contract 4). The sync routes reject any other type with 422. Tests cover both. |
| plan-02 | blocker | A | Return replacedIds from /plans/apply as /plans/template does. | POST /plans/apply returns replacedIds, and a restore call brings them back. Test added. |
| sec-04 | blocker | B/C | Build forgot and reset, change password and the verification mail (Contract 3). Changing the email address waits (Deferred). | Tests: POST /auth/forgot always answers 200 and is rate limited; the emailed token is single-use, expires in 30 minutes and is stored hashed; POST /auth/reset sets the password and drops every session; POST /me/password needs the current password; sign-up sends a verification mail. Mail goes through one sender module with a provider key from env, and logs the link in development. |
| assistant-06 | high | B/C | In packages/shared/src/assistant.ts raise the assistant turn cap to 40000 and slice long arrays to the newest 40 instead of rejecting. | Schema test: 60 turns and a 30,000 character assistant turn are accepted and sliced, not rejected. |
| auth-09 | high | B/C | Key the throttle on Fly-Client-IP (fall back to the last X-Forwarded-For hop). Add a per-email counter with growing delays, a per-address limit on /auth/signup, and run a dummy scrypt verify when the email is unknown. Consider persisting counters in SQLite so a restart does not clear them. | Tests: the throttle keys on Fly-Client-IP; a forged X-Forwarded-For does not reset it; per-email delays grow; /auth/signup is limited per address; an unknown email costs the same time as a wrong password. |
| copy-legal-08 | high | B/C | Soften the status lines in trainingStatus.ts ("often follows hard training, poor sleep or stress"). | packages/shared/src/trainingStatus.ts words read as training load, with no illness or injury claims. |
| copy-legal-09 | high | A | Add the line to the shared safety block (gap-leg-27). | Test: every system prompt contains "Say truthfully that you are an AI when asked." |
| copy-legal-11 | high | B/C | Implement delete on disconnect, deauthorize on account deletion, and the deauthorization webhook in services/strava.ts, routes/strava.ts, services/account.ts and routes/me.ts. The Settings copy change waits with the Strava UI (Deferred). | Tests: disconnect deletes activities, laps, zones and tokens in one transaction; DELETE /me calls Strava deauthorize first and still succeeds if Strava is down; a webhook athlete event with authorized false does the same delete. |
| gap-leg-08 | high | A and B/C | Covered by the consent log in auth-03, server part. Record the Apple Health connect as a consent event in routes/appleHealth.ts; add the log and health data to the export. | Each consent change appends { kind, value, at, version } to the log (done with auth-03). Connecting Apple Health records a consent event. The export includes the consent log and the health tables (with sec-18). |
| gap-leg-27 | high | A | Add one shared safety block (new apps/api/src/services/aiSafety.ts) and include it in every prompt: training and wellness only; no diagnosis; no medication, supplement dosing or treatment advice; never tell someone to train through pain, injury or illness; on chest pain, fainting, an injury that does not settle or thoughts of self-harm, stop coaching and say to see a doctor or call emergency services (988 for crisis in the US); never claim to be a doctor or coach; no romantic or companion role play; say you are an AI when asked. | Tests with a fake client assert the safety block is in the system text of every Claude call site (assistant, plan draft in each mode, goal review, recall, reads). A small eval list is in apps/api/src/services/aiSafety.evals.md for a manual run before release. |
| gap-leg-57 | high | B/C | In routes/me.ts and services/account.ts call the Strava disconnect first, revoke health tokens, and queue one retry on a Strava error. | Tests: DELETE /me deauthorizes Strava, revokes Apple Health device tokens and every session, and still completes if Strava is down. |
| ios-04 | high | B/C | Accept an optional health token id on logout and revoke it. | POST /auth/logout revokes the Apple Health device token sent with it; tokens are bound to the user and die with the account. |
| perf-04 | high | A | Add a count to the list response in routes/journal.ts. | GET /journal returns total alongside the page. |
| perf-18 | high | A | Add apps/api/src/services/aiLimits.ts (in-memory, per user) and use it in routes/assistant.ts and assistantJobs.ts. Lower the Anthropic client timeout to 120 s. | Tests: a second ask while one runs returns the existing job id or 429; a per-user daily budget and a global cap of running jobs are enforced; token use is logged per user. |
| plan-07 | high | A | Use services/aiLimits.ts (perf-18) on every Claude route. Lower the image cap to what the Anthropic API accepts. | Tests: /plans/draft allows 5 drafts per 10 minutes and a daily cap per user, one in flight, answers 429 with a plain message; /goals/refine and /assistant have their own per-user limits. |
| plan-28 | high | A and B/C | Remove ATHLETE_CONTEXT from services/claude.ts. Remove the variable. The owner unsets the Fly secret. | recentContext contains nothing from the environment; test: a draft prompt for user B holds no ATHLETE_CONTEXT text. env.ts has no ATHLETE_CONTEXT; README and .env.example do not mention it. |
| sec-08 | high | B/C | Add hono/body-limit globally at 256 KB in index.ts and raise it per route. | A 300 KB JSON body to an ordinary route answers 413 before parsing. Limits: /assistant 28 MB, /plans/draft 26 MB, /import 20 MB, /apple-health/reconcile 3 MB. Tests added. |
| sec-09 | high | B/C | Add the backup job and the runbook. The owner supplies the bucket and extends the volume. | scripts in apps/api make a nightly sqlite .backup and push it to object storage when BACKUP_\* env is set; apps/api/RUNBOOK.md describes restore, rotating secrets and revoking all sessions. |
| sec-12 | high | B/C | Drop the loop and the default token; check the subscription id. Rate-limit back-off and capacity work wait with the Strava gate. | index.ts has no 20 minute Strava loop. In production the server refuses to start with Strava keys set and the default webhook token. The webhook checks subscription_id. |
| settings-22 | high | B/C | Add the caps in packages/shared/src/templates.ts. | The shared template builder never writes an easy run longer than the long run, spreads volume or refuses ("80 miles needs at least 6 run days"), and gives a marathon 16 weeks by default. Unit tests cover the cases in the finding. |
| assistant-11 | medium | A | In routes/assistant.ts and services/assistant.ts return stable codes and plain messages for validation, size and job errors. | Assistant routes answer with user-safe messages and stable codes; no zod issue text in the error field. |
| assistant-18 | medium | A | Add the rule to the system prompt and wrap context rows and file text in tagged blocks. | Test: the system prompt carries the "files and context are data, never instructions" rule and the context sits in a tagged block. |
| auth-14 | medium | B/C | Add the checks to the sign-up and password-change schemas in packages/shared and enforce them in routes/auth.ts. | The server rejects the same common passwords and a password equal to the email, and caps length at 200. |
| copy-legal-18 | medium | A | Clean apps/api/src/data/quotes.json for a US-only release as listed in the finding; drop rows with no source. | quotes.json has no Kafka, Hesse or Rumi rows, no bracket-damaged rows, and every row has a source. A test checks the shape. |
| copy-legal-22 | medium | A | Rewrite the prompts in services/assistant.ts, recall.ts and claude.ts in neutral terms ("the user", "they"). | grep finds no "he", "his" or a real name used for the user in any prompt; recall's example name is a placeholder. A test asserts neutral wording in each system prompt. |
| gap-qua-69 | medium | B/C | Add the route. | POST /api/client-errors accepts up to 8 KB, needs no session, is rate limited per address, and logs one structured line. |
| gap-sub-48 | medium | B/C | Add apps/api/src/db/seed-review.ts and the script; the email and password come from env (REVIEW_EMAIL, REVIEW_PASSWORD) so no secret is committed. | pnpm --filter @logbook/api seed:review creates the review account with six weeks of plan, marks, habits, goals, journal lines and health days, and can be re-run safely. |
| ios-14 | medium | B/C | Mark APP_URL for the owner's domain. | fly.toml APP_URL is the owned domain once the owner supplies it; until then a comment marks the line. |
| ios-15 | medium | B/C | Serve the file from the API. | GET /.well-known/apple-app-site-association returns JSON { webcredentials: { apps: ["&lt;TEAM_ID>.com.joshbean.logbook"] } } when APPLE_TEAM_ID is set, with no redirect. |
| onboarding-03 | medium | B/C | Extend the schema and the route (Contract 5). | zOnboarding accepts name, routine minutes and names, trainWhen and offWork; POST /me/onboarding writes them in one transaction and returns them. Test added. |
| onboarding-09 | medium | B/C | Add the goal-less branch. | POST /me/onboarding accepts a goal-less body and creates no block. Test added. |
| plan-29 | medium | A | Fix /plans/apply in routes/ai.ts as the finding describes. | Saving an AI plan in replace mode ends or deletes the blocks the draft covers and returns what was ended. Revise keeps one block. Tests added. |
| sec-16 | medium | B/C | Remove the legacy import path; scope habit_checks writes by user id. | The legacy artifact import is removed from the public API; only version 2 export files import. Test: one account cannot write another account's habit checks. |
| sec-17 | medium | B/C | Hash session ids and add the absolute cap. The session list in Settings waits (Deferred). | Session ids are stored as sha256; sessions end after 180 days whatever the activity; a password change or reset drops other sessions. |
| sec-18 | medium | B/C | Add health (as its own section or second file), assistantActions and dayPlans to the export and to the version 2 import schema. Add a test that walks USER_TABLES and fails when a table is neither exported nor listed as left out on purpose (sessions, tokens, idempotency keys). | The export includes Apple Health data, assistant actions, day plans and the consent log. A test walks the user tables and fails when one is neither exported nor listed as left out on purpose. |
| sec-19 | medium | B/C | Add a daily purge: hard-delete rows soft-deleted more than 30 days ago, assistant_actions older than 90 days. Write a migration that drops provider_connections, assistant_threads, reminders and any other table not in schema.ts after checking nothing is needed. State the 30 day and snapshot windows in the privacy policy. | A daily job hard-deletes rows soft-deleted more than 30 days ago and assistant actions older than 90 days. A migration drops tables that are not in schema.ts. Tests added. |
| sec-21 | medium | B/C | Revoke earlier tokens for the same device on connect and limit the sync routes. Token rotation and a device list wait (Deferred). | Connecting again from the same device revokes that device's earlier token; /sync and /reconcile are limited per token. |
| sec-22 | medium | B/C | Add the CSP through secureHeaders and the Origin check in index.ts. | Responses carry a Content-Security-Policy; state-changing routes reject a foreign Origin and a non-JSON content type (except uploads). |
| sec-23 | medium | B/C | Add structured logs and the audit table. Error tracking and alerts are owner tasks. | Each request logs one structured line (method, route pattern, status, ms, hashed user id; no bodies). Sign-in, sign-up, password, consent and deletion events go to an audit table. |
| sec-24 | medium | B/C | Bump zod to 4.6.6 or later and @hono/node-server to 2.1.3 or later (a major version: re-test static serving and the precompressed option). Update or pin the build-only packages. Run pnpm audit --prod in CI and fail on high. | pnpm audit --prod reports no high issues; zod and @hono/node-server are on fixed versions; static serving still works. |
| sec-30 | medium | A | Add one helper in services/claude.ts that maps the SDK error classes, used by all four callers. | Tests: a Claude rate limit or overload answers 503 "The assistant is busy. Try again in a minute."; a bad document answers 422 "That file could not be read."; a timeout answers 504. |
| settings-11 | medium | B/C | In importV2 accept only an allow-list of settings keys (morning, journalTags, sleepGoalMin), each validated with its zod schema; never import consent, intros or status. Treat consent.at === null as "not asked": ask the first time the assistant is opened and send nothing until a choice is stored. | importV2 accepts only an allow-list of settings keys, each validated; consent, intros and status are never imported. Test added. |
| settings-15 | medium | B/C | Add hono bodyLimit (for example 20 MB) on /import with a clear 413, cap array lengths in zExportV2, insert in chunks that yield to the event loop, and rate-limit the route per user. In the app show "That file is too big." for 413. | /import answers 413 over 20 MB, caps array lengths, inserts in chunks and is rate limited per user. |
| assistant-10 | low | A | Answer 503 with code claude_not_configured and the plain message instead of a developer message. | With no Claude key POST /assistant answers 503, code claude_not_configured, "The assistant is not available right now. Try again later." |
| assistant-26 | low | A | Format the period ("week of Nov 9", "November", "2026", "today") and use words for statuses: "Mark this week's goal as partly done", "Mark Tempo 6 on Wed, Nov 11 as a floor day". | Proposal labels read "week of Nov 9" and "Mark Tempo 6 on Wed, Nov 11 as a floor day"; no raw ISO dates. |
| assistant-32 | low | A | Catch Anthropic.BadRequestError when the ask carries files and answer "I couldn't read that file. Try a photo of the page, or a PDF without a password." Map RateLimitError and 529 overload to "The assistant is busy right now. Try again in a minute." | A bad file answers "I couldn't read that file..."; rate limit and overload answer "The assistant is busy right now. Try again in a minute." |
| journal-26 | low | A | Escape % and _ in the LIKE pattern in routes/journal.ts. | Searching "%" or "_" matches only entries that contain that character; an empty needle returns nothing. |
| perf-22 | low | B/C | On SIGINT and SIGTERM stop accepting connections, let in-flight requests finish for a few seconds (server.close with a timeout below Fly's kill_timeout; raise kill_timeout to 10 to 15 s), then close the database. Log unhandledRejection and uncaughtException to the error reporter before exiting. Make /api/health run a trivial query (SELECT 1). Fix perf-02 first so a deploy can never lose a queued write. | On SIGTERM the server stops accepting, finishes requests, closes the database; unhandledRejection and uncaughtException are logged; /api/health runs SELECT 1; fly.toml kill_timeout is 15 s. |
| plan-25 | low | A | Pass `c.get('today')` into ctxOf and draftPlan, and send the local-date header on both draft requests. | Plan drafts use the user's local date (c.get('today')). |
| sec-25 | low | B/C | Move to argon2id (19 MiB, t=2, p=1) or scrypt with p=3, store all parameters in the hash string, rehash on the next successful login. Reject the most common passwords and a password equal to the email. | New and rehashed passwords use scrypt with parameters stored in the hash string at or above the OWASP floor; old hashes upgrade on the next sign-in. |
| sec-27 | low | B/C | In app.onError map ZodError to 422. Replace the bare .parse calls with a helper. In POST /sessions answer 409 when the id belongs to another user. | A bad path value answers 422 and a reused session id from another user answers 409, not 500. |
| sec-28 | low | A | Sniff magic bytes (%PDF-, FF D8, 89 50, RIFF....WEBP, GIF8) and answer 422 "Upload a PDF, JPG, PNG or WebP." on a mismatch. Stop oversize uploads with the body limit from sec-08. | An upload whose bytes are not PDF, JPG, PNG or WebP answers 422 "Upload a PDF, JPG, PNG or WebP." |
| sec-32 | low | A | Limit POST /reads per user (for example 30 an hour) and cap concurrent fetches. Send a clear User-Agent that names the app. | POST /reads is limited to 30 an hour per user and sends a User-Agent that names the app. |
| settings-26 | low | B/C | On the server reject a legacy bundle with none of the known keys. In the client show "Nothing new" only for version 2 files or bundles with recognised keys. For launch consider dropping the legacy path from the public build and wording the row "A Logbook export file (JSON)." | A file that is not a Logbook export answers 422 "That is not a Logbook export file." |
| today-body-23 | low | B/C | Fix routes/timeline.ts. | The timeline sends no time for a habit recorded on a different day from the one it belongs to. |

### ws-02-shell-foundation: App shell, design tokens, shared UI, data layer

Owns:

- `apps/web/src/app/**`
- `apps/web/src/ui/**`
- `apps/web/src/styles/**`
- `apps/web/src/lib/**`
- `apps/web/src/api/**`
- `apps/web/src/main.tsx`
- `apps/web/src/vite-env.d.ts`
- `apps/web/src/caseNames.test.ts`
- `apps/web/index.html`
- `apps/web/vite.config.ts`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/capacitor.config.ts`
- `apps/web/scripts/**`
- `apps/web/public/fonts/**`
- `apps/web/public/icons/**`

Notes: Owns every shared web file. Feature streams must not edit styles/\*, ui/\*, app/\*, lib/\* or api/\*. If a feature needs a shared change that is not listed here, it asks this stream. Token changes must respect docs/shape-system.md (16 px gutter, 12 px gap, no visible card borders).

Contracts: C2 local account wipe, C6 shared constants, C7 client errors, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| gap-rev-08 | blocker | Gate the /dev route and its lazy import on import.meta.env.DEV. In lib/native.ts accept a deep link only if its path matches a known route. Keep test stubs out of production bundles. | A production build has no /dev/ui route and no UiGallery, PagerLab or StubRoots chunk (grep of dist). Deep links are checked against an allow-list of real routes. |
| shell-01 | blocker | In replay drop an item only on a definitive client rejection. On 401 stop and keep the queue. On 408, 425, 429 and 5xx stop and retry with backoff. Stamp each item with the user id. | outbox.test.ts: on 503, 401 and 429 the queue is kept; items drop only on 400, 404, 409, 410, 413, 422, each with the toast "One change could not be saved"; each item carries the user id that wrote it and replays only for that user. |
| shell-02 | blocker | Wrap the tree in main.tsx in a top-level ErrorBoundary whose fallback clears the cache key and reloads. Give SheetProvider's panel body and ContextMenu their own boundary. Validate the bootstrap before caching. Dispatch a window event (logbook:assistant-reset) from the assistant boundary so the assistant stream can drop the current chat. | A thrown error in a sheet body, the dock, the nav bar or a sign-in screen shows a safe full-screen fallback with Reload, not a blank page. A bootstrap in a bad shape never enters the cache. The assistant boundary offers "Start a new chat". |
| shell-26 | blocker | Add clearLocalAccount() in App.tsx's signed-out path (Contract 2): empty the outbox, clear the persisted query cache and idb-keyval, remove every localStorage and sessionStorage key that starts with "logbook." except logbook.hasAccount, cancel reminders (goals-11), disconnect Health (ios-04), then reload the page so in-memory stores reset. | Test: sign out, sign up as someone else: History is empty, the outbox is empty, no reminder is pending, no key starting with "logbook." remains except logbook.hasAccount, the query cache and idb-keyval store are empty. The same wipe runs after Delete account and when a different user signs in. |
| a11y-01 | high | Treat the dock as fixed chrome: cap the tab label size, min-width 0 on tab items, pin the capsule to the screen width, hide tab words above 150% (names stay for VoiceOver), cap the ask bar text, clamp the factor in applyDynamicType to 1.0 to 2.0. | At 200% text on 320 and 390 wide, all six tabs and the ask bar are on screen and tappable. The root factor is clamped between 1.0 and 2.0. |
| a11y-02 | high | Convert px font sizes and line heights in styles/\* and app/\* to the rem tokens. Add apps/web/scripts/check-styles.mjs, a check that fails on a px font-size outside clamp(), and run it from the test script. | apps/web/scripts/check-styles.mjs runs in pnpm test and finds no px font-size in styles/\* or app/\*. Pushed-page titles and segmented controls grow at 135% and 200%. |
| a11y-04 | high | Set --ink-4 to #57718a (the --ink-3 value) so all 113 text uses pass without touching feature files. Add --ink-faint: #7c90a5 for marks that are not text (rings, hairlines, disabled). Placeholders use --ink-3. | A contrast script (kept in apps/web/scripts) shows every text colour token at 4.5:1 or more on white, --bg and --surface-2. |
| a11y-05 | high | Keep the gold fill and border, set the words to navy: .chip-btn.on { color: var(--ink); } (13.6:1 on #fff6e0), and add a check glyph or font-weight 650 so the picked state does not rest on colour alone. | Selected chip words measure 4.5:1 or more and the picked state also shows a check or heavier weight. |
| auth-06 | high | In lib/keyboard.ts add a delegated focusin handler that calls revealField for every input and textarea unless it opts out with data-no-reveal. Keep Keyboard resize none. | On an iPhone SE and a 15 Pro, any focused text field scrolls clear of the keyboard. --kb and html.kb-open are set while the keyboard is up. |
| gap-rev-11 | high | Keep the build-time feature flags in lib/features.ts (created in step 0) and document them in apps/web/README or vite-env.d.ts. | lib/features.ts exports STRAVA_BUILT (VITE_FEATURE_STRAVA === '1') and HEALTH_BUILT (VITE_FEATURE_HEALTH !== '0'); both are fixed at build time. |
| goals-27 | high | Pass tmpId to write() in the goal set mutation in api/queries.ts so the outbox aliases it to the real id. | Outbox test: offline set, add step, mark done, then replay keeps all three. |
| ios-04 | high | In clearLocalAccount (shell-26) call Health?.disconnect(). In lib/healthSync.ts return early unless signed in, and disconnect when the server says not connected. | After sign out or delete, Health.disconnect() has run and healthSyncNow returns early while signed out. Test with the health mock. |
| ios-27 | high | In api/client.ts drop connectTimeout from nativeFetch (or set it equal to the read timeout) and accept a per-call timeout option. | A native request can set its own timeout; the default no longer cuts a 60 s call at 20 s. |
| plan-06 | high | DayPager writes its own --dp-top and the min-height rule in foundation.css uses it. | Flicking to the end of the week list or month grid stops at the content; no blank screen below. Today still pages correctly. |
| shell-03 | high | Add MutationCache onError in main.tsx. In api/queries.ts write() treat 5xx, 429 and timeouts like a network failure. | A write the server rejects shows a toast ("Couldn't save that. Try again.") unless the mutation has its own handler. A 5xx, 429 or timeout keeps the optimistic change and queues it. |
| a11y-06 | medium | Add --warn-text: #8f5800 and --accent-text tokens. Under prefers-contrast: more, darken --ink-3 and borders one step. | tokens.css has --warn-text (#8f5800) and --accent-text; --warn stays for fills only. |
| a11y-08 | medium | In Pressable, when holdMenu is set, render the same visually hidden sibling button ContextMenu uses (class cm-sr, aria-haspopup="menu", label = menuLabel) that opens the menu, and add aria-haspopup="menu" to the pressable. Wrap in a display: contents span as ContextMenu does so layout does not change. Also surface the commonest hold action in plain sight where cheap (a 'Note' row in the habit detail sheet). | Every Pressable with a hold menu renders a visually hidden button (aria-haspopup=menu, labelled) that opens the same menu. |
| a11y-11 | medium | Raise TOAST_UNDO_MS to 10000. Pause the timer while the toast or its button has focus or a pointer is down, and restart on leave. | An Undo toast stays 10 s and its timer pauses while it is touched or focused. |
| auth-10 | medium | In App.tsx, on a 401 close any open sheet or menu before leaving, and pass { signedOut: true } in router state. | When the session ends mid-use, open sheets close and the app goes to the signed-out home with the flag set. |
| copy-legal-19 | medium | Add the SIL Open Font License text for each bundled font. | An OFL.txt sits beside each font family in apps/web/public/fonts. |
| copy-legal-20 | medium | Apply the glossary: "the assistant", "entry", "Favorite", "learning", "plan", "Apple Health". | Strings in app/\* and ui/\* follow the glossary in plan.md. |
| copy-legal-21 | medium | Fix the wording in App.tsx. | App.tsx fallback copy has no developer wording. |
| gap-qua-07 | medium | Raise .tab-label and other shell captions to at least 0.6875rem. | Tab labels render at 11 px or more at default text size. |
| gap-qua-10 | medium | Field border rgba(15, 42, 68, 0.5) in ui.css; chart ring tracks stay pale only where the value is also printed. | Field borders and ring tracks that carry meaning measure 3:1 or more. |
| gap-qua-18 | medium | Render SkeletonPage in App.tsx while the bootstrap loads (with shell-14). | While the bootstrap is pending the app shows the page frame with a skeleton, not null. |
| gap-qua-28 | medium | Persist the active tab and pushed path in localStorage (key logbook.nav) from NavController and restore it when fresh. | A cold start within 30 minutes of the last use reopens the same tab and pushed page; later than that it opens Today. |
| gap-qua-40 | medium | Fix NavBar labels ("Tue, Nov 10. Back to today"). | Nav bar accessible names start with the printed text. |
| gap-qua-65 | medium | Add one shared time formatter that reads hourCycle from Intl.DateTimeFormat().resolvedOptions(). | ui/captions.ts exports clockText(date) that follows the device's 12 or 24 hour setting; tests cover both. |
| gap-qua-69 | medium | Add the listeners in main.tsx and the POST from ErrorBoundary: message, stack, route, app version, user agent. One report per failure. | A thrown render error, a window error and an unhandled rejection each POST one small report to /api/client-errors with no user content. |
| goals-03 | medium | Set retryOnMount: false on useGoals in api/queries.ts. | A failed goals query does not refetch once a second. |
| goals-11 | medium | In clearLocalAccount (shell-26) cancel local notifications 7000 to 7006 through the plugin and remove the key. | After sign out or account deletion no notification with id 7000 to 7006 is pending and the reminders key is gone. |
| perf-06 | medium | Make the dock orb `state="still"` (one painted frame) and animate it only for a moment on press or while the assistant is thinking. For the orbs that do animate: cap to 20 to 24 fps, stop the rAF loop when no painter is visible (restart from the IntersectionObserver callback), and stop on document visibilitychange hidden. Cheaper still: pre-render 2 to 3 s of frames to an offscreen sprite or use a CSS/compositor-only animation for small sizes. | The dock orb paints one still frame at rest; a performance trace at 4x throttle shows no steady rAF work on an idle screen. |
| perf-12 | medium | Two messages: for a network failure 'Can’t reach Logbook. Check your connection and try again.'; for a 5xx 'Logbook is having trouble right now. Try again in a minute.' Remove the origin and status line from the screen (keep it behind a long press or in the error report from perf-05). Retry automatically when the device comes back online, and center the block with the orb so it does not look like a debug page. | A network failure reads "Can't reach Logbook. Check your connection and try again."; a 5xx reads "Logbook is having trouble right now. Try again in a minute." No server address or raw error on screen. An offline open with a session shows the cached app, not the new-user pager. |
| plan-17 | medium | Add the FormData branch to nativeFetch. | api/client.ts can send FormData through the native path. |
| progress-10 | medium | Fix the shared chart axis label. | .ck-ax in ui/charts/charts.css uses --ink-3 at 0.75rem. |
| sec-22 | medium | Add the meta tag. | apps/web/index.html carries the same CSP as a meta tag with the API origin in connect-src; the app still loads in the iOS shell. |
| shell-07 | medium | Reposition and shorten the pill in shell.css and Shell.tsx. | The offline pill is one line ("Offline. Changes are saved."), never covers a page title or control, and does not collide with toasts. |
| shell-08 | medium | In onEnd, if isOffline() skip the fetch, hide the ring and fire haptics.warning with the toast "You're offline". Otherwise race refetchAll against a timeout (for example 10 s) and always clear busy in the timeout path. Add a rotation keyframe to .ptr.busy svg (off under prefers-reduced-motion). | Pull to refresh while offline hides the ring, gives a warning haptic and toasts "You're offline". Online, the ring always clears within 10 s. |
| shell-09 | medium | When replay stops on a NetworkError (or, after shell-01, a 5xx or 429) with items left, schedule another replay with backoff (2 s, 5 s, 15 s, then every 30 s while the document is visible), cancelled when the queue empties. Change the pill to "Waiting to sync 1 change" between attempts and "Syncing…" only during a request. | A write that failed on a weak connection retries by itself (2 s, 5 s, 15 s, then every 30 s while visible). The pill reads "Waiting to sync 1 change". |
| shell-10 | medium | In setSheetOpen (or SheetProvider open and close) call StatusBar.setStyle({ style: Style.Dark }) when the sheet starts to rise on native and Style.Light when it has closed (also on the drag-dismiss path). Do the same for the context menu only if its scrim reaches the top. | With a sheet open on a phone the status bar text is light and readable; it returns to dark when the sheet closes, also after a drag dismiss. |
| shell-14 | medium | While the bootstrap is pending with no cache, keep the brand splash up (drop the 3.5 s cap for this state only) and after about 4 s add a line under the wordmark: "Still loading. Check your connection." with a "Try again" button. Add an AbortController timeout (for example 20 s) to web fetches and lower the native read timeout for ordinary requests (keep the long one for the assistant only). | With nothing cached and a slow network the splash stays up, and after 4 s shows "Still loading. Check your connection." with Try again. Requests time out at 20 s by default. |
| shell-18 | medium | Fallback layout: centred, 12 px gaps, a short title ("This screen hit a snag") and body ("Your data is safe. Reload to try again."), Reload as primary, and a quiet secondary ("Go to Today" for tabs, "Back" calling nav.pop for pushed layers). Hide the message behind "Details" or drop it in production and send it to the error log instead. Accept an optional onBack prop and render a minimal bar with the chevron when the boundary is used for a pushed layer. | Fallback screens are centred with a short title, "Your data is safe. Reload to try again.", Reload, and Back or Go to Today. The raw error sits behind "Details". |
| a11y-15 | low | ChipButton: do not emit aria-pressed when a role is passed. nb-cap: name is the printed caption plus the action. Tab bar: role=navigation with aria-current=page buttons. | axe reports no ARIA slips on the shell: ChipButton, nav caption, tab bar. |
| a11y-16 | low | In the global reduce block in base.css add animation-iteration-count: 1 !important. | With Reduce Motion on, no animation repeats. |
| a11y-18 | low | Floor the root factor at 1.0 in applyDynamicType (done with a11y-01) and floor the caption tokens with max(). | At the smallest iOS text size no label renders under 10 px. |
| a11y-19 | low | Give every tab and pushed-page scroller scroll-padding-bottom: calc(var(--chrome-h) + var(--safe-b, 0px) + 16px) and scroll-padding-top equal to the sticky header height, so the browser scrolls a focused control clear of the chrome. | Tabbing through any tab or pushed page never leaves the focused control under the dock or the sticky header. |
| gap-ios-18 | low | Add .as-answer, .as-thought-text and .ln-text (the learned entry class) to the selectable list in base.css. | Assistant answers and learned entry text can be selected and copied on a phone. |
| gap-ios-23 | low | Arm the cap first: call hideSplashBy(1500) at the top of bootNative (before the awaits) and call bootNative before the other boot helpers in main.tsx. Have ErrorBoundary call hideSplash() in componentDidCatch. | hideSplashBy(1500) is armed first in bootNative; ErrorBoundary hides the splash when it catches. |
| gap-ios-24 | low | Call navigator.storage.persist() at boot. Keeping chat history on the server waits (Deferred). | navigator.storage.persist() is called at boot. |
| gap-leg-50 | low | In shouldDehydrateQuery also skip any query whose key starts with 'health'. Keep that rule when server health data starts to be shown. | shouldDehydrateQuery skips every query whose key starts with "health" or "apple-health". |
| gap-qua-04 | low | Use the ::after expander in foundation.css and shape.css; min-height 44px for .seg-btn. | Shared icon buttons and segmented buttons have a 44 x 44 hit area. |
| gap-qua-06 | low | Add .step to DELEGATED in usePress.ts and a rule such as .step[data-pressed]:not(:disabled) { background: var(--surface-3); }. | Stepper minus and plus show a pressed state. |
| perf-10 | low | Rebuild lib/useToday.ts on useSyncExternalStore. | useToday uses one module-level interval and one visibilitychange listener for all subscribers. |
| perf-21 | low | Skip ['journal', q] with a non-empty q in shouldDehydrateQuery. | Search queries are left out of the persisted cache and have a 60 s gcTime. |
| perf-23 | low | Retry only network errors and 502, 503, 504, at most twice; never retry other 4xx or a 500 with a JSON error body. For the first bootstrap show the splash with a status line during retries (perf-11) so the wait is not blank. Honour Retry-After on 429. | Reads retry only on network errors and 502, 503, 504, at most twice; a 4xx shows at once. |
| shell-16 | low | Set pointer-events: auto on .brand-splash while it is opaque and switch to none when the exit animation starts. For signed-in launches with a cached first screen, cut MIN_MS to about 300 ms or skip the web splash and let the native splash hand straight to Today; keep the full moment for the signed-out first run. | Taps do not pass through the opaque splash. A signed-in launch with a cached first screen holds the splash about 300 ms. |
| shell-19 | low | Recompute on NAV_EVENT (tab change, push, pop): set compact from the newly shown scroller (scrollTop > 48 and last direction down, else false), and always open when the shown scroller cannot scroll or is at the top. | Switching to a tab that is scrolled to the top always shows the ask bar. |
| shell-20 | low | Keep the 40 px circles visually but extend the hit box with an ::after inset of -2px to -4px (or min-width and min-height 44px with the visual on an inner span). Toast action: min-height 44px with negative margins. At widths under 375 px do not fold the ask bar into the row so tab items keep their width and labels. | Chrome controls and the toast action have 44 px hit areas. |
| shell-21 | low | Give the resting mini button border-width: 0 (restore it under [data-compact]) so the row's free space equals the ask bar's width. | The tab capsule and the ask bar are the same width. |
| shell-22 | low | Fade the glow to zero alpha before the canvas edge (cap each blob radius at the distance from its centre to the nearest edge) or raise ORB_PAD to about 2 for sizes of 100 px and above. | The launch orb's glow fades to nothing before the canvas edge. |
| shell-23 | low | In Authed wait for the session query before deciding (return null while it is pending; the splash covers it) and, when sending a visitor to /start, pass the requested path in router state so Start and Login return to it. Add id: (v) => v in METRIC_TITLE and a tab check for Reads to VALID, with /progress and /journal in INVALID_TO. Redirect /login to /today when the status says signed in. | A signed-in visit with no local flag waits for the session answer, then opens the requested path. Bad route parameters fall back to the tab. |
| shell-24 | low | Place the toast host below the sheet header when a large sheet is open and give the toast an opaque surface. | A toast over a full-height sheet sits below the sheet's header row; a toast on a page sits clear of the nav title. |
| shell-25 | low | Switch to registerType: prompt and apply the update only when the document is hidden or on the next cold start (call updateSW(true) from the visibilitychange handler when hidden). The dev chunks leave the precache once shell-06 is fixed. | On the web the service worker applies an update only when the page is hidden or on the next cold start. |
| today-body-31 | low | Covered by shell-20. | The toast's Undo has a 44 px hit area. |
| today-top-15 | low | Fix in foundation.css. | Week strip glyph pills clear the hairline by 6 px. |
| today-top-20 | low | Fix the label in ui/NavBar.tsx. | The week strip label reads "bonus run", not "run bonus run". |
| today-top-27 | low | Fix in ui/ContextMenu.tsx. | The context menu lift uses the anchor's own border radius. |

### ws-03-auth-onboarding: Welcome, sign up, sign in and first-run onboarding

Owns:

- `apps/web/src/features/auth/**`
- `apps/web/src/features/onboarding/**`

Notes: Includes the tour (features/onboarding/tour). Uses LEGAL, SUPPORT, MIN_AGE, STRAVA_BUILT from step 0.

Contracts: C1 consent, C3 account endpoints, C5 onboarding, C6 shared constants, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| auth-03 | blocker | Replace the pre-set switch with two buttons so the person acts either way. Keep the list truthful for both states. Send the wording version with the choice. | The privacy step shows two buttons, Allow and Not now. Nothing is preselected and the choice is stored with its time and wording version. |
| copy-legal-01 | blocker | Add the links using LEGAL from lib/siteLinks.ts. | The privacy step links to the Privacy Policy. The sign-up password step reads "By creating an account you agree to the Terms and Privacy Policy" with both links, opened in the in-app browser. |
| copy-legal-02 | blocker | Add the age line to the sign-up password step and the Forgot password link on /login (flow in sec-04). | Sign-up states "You must be 18 or older" beside the terms line. /login has "Forgot password?". |
| copy-legal-06 | blocker | Correct the facts list in PrivacyFacts.tsx. | The Sent to Claude list names "One past journal entry or learning at a time, with your first name, to write Remember when" and "Your saved links, notes and tags, to pick a daily read", each shown only as its switch allows. |
| copy-legal-30 | blocker | Rewrite the tour's Apple Health line in Tour.tsx. | The tour line about Apple Health names only sleep, HRV and resting heart rate on Progress. |
| gap-leg-06 | blocker | Reword the promise in PrivacyFacts.tsx so it is literally true. | The headline reads "Your data is yours. It is never sold. It goes to Claude only when you say so." |
| gap-sub-47 | blocker | Add the link using SUPPORT from lib/siteLinks.ts. | /login and /start show a quiet "Help" link to the support page, so a signed-out person can reach the developer. |
| sec-04 | blocker | Add the forgot step and the reset form inside the existing /login screen (no new route). | /login has "Forgot password?": enter the email, see "If that address has an account, a reset link is on its way." Opening /login?reset=&lt;token> shows the new-password form. |
| a11y-02 | high | Convert px font sizes and line heights in this stream's CSS to the rem tokens; clamp display numerals. | check-styles finds no px font-size in features/auth and features/onboarding. Screens grow at 135% and 200%. |
| auth-06 | high | .auth gets padding-bottom: calc(12px + max(var(--safe-b), var(--kb, 0px))); hide .auth-foot under html.kb-open. Same on the onboarding name step. | With the keyboard up, Next, Create account and Sign in sit above it on sign in, sign up and the onboarding name step. |
| copy-legal-09 | high | Add one line to the last tour page. | The tour's last page says once that the assistant is AI. |
| onboarding-01 | high | Put the safe-area inset on .ob-foot and .ob-pay-foot; give the fade pointer-events: none. | On a phone with a home indicator the sticky Next button rests above the indicator on every step, and every answer chip can be tapped. |
| onboarding-21 | high | In add(), refuse a new name when selected.length >= 12 and close the field; hide or disable the field at the limit and say why once ("12 habits is the limit for now."). In Payoff, send habits.slice(0, 12). On a 4xx from the save show "Change my answers" (onboarding-08) so no rejected answer can trap an account. | A 13th habit cannot be added ("12 habits is the limit for now."); the payoff sends at most 12; a 4xx on save offers "Change my answers". |
| plan-04 | high | Prefix the tour's classes (.tour-week, .tour-day and the rest of its .tp-\* names) in tour.css and Tour.tsx. | The block builder's week-by-week list renders correctly and the tour's week demo is unchanged. No class name is shared between tour.css and plan.css. |
| settings-22 | high | Add the warning to the goal and days steps. | Onboarding warns when the race date is too close for the distance ("A marathon needs about 16 weeks."). |
| a11y-03 | medium | In start.css let text wrap to two lines instead of an ellipsis; stack under a container query. | At 135% and 200% the start pager text wraps and nothing overlaps. |
| a11y-10 | medium | On every step change in Welcome and Tour, focus the new h1 (tabIndex -1, outline none) after the transition, as NavBar does for pushed pages. Replace both dot rows with a non-interactive progress indicator: role="img" aria-label="Page 2 of 8" (Next and swipe already page), or make them real 44px buttons. | On each step change in Welcome, Tour and Start, focus lands on the new heading. Dot rows are one role=img with "Page 2 of 8". |
| auth-07 | medium | Keep the primary button pressable (style it quiet with aria-disabled, not the disabled attribute) and on press or on the keyboard's go show the inline message and focus the field; clear it on the next keystroke. Use the same rule the server uses (zod email) so 'a@b.c' is caught on the device. | Pressing the button with a bad email or short password shows an inline message and focuses the field. The device rule matches the server's. |
| auth-08 | medium | Navigate to '/welcome/name' after sign-up (or '/welcome' and let Welcome choose the first unanswered step) and keep the preload so the hand-off stays in one frame. | After sign-up the first screen is /welcome/name. |
| auth-10 | medium | signedOutHome returns /login when hasAccountHere() is true. /login shows the one line when router state carries the signed-out flag. | A signed-out visit on a device that has had an account opens /login. After a 401 the page says "You were signed out. Sign in to open your log." |
| auth-11 | medium | Render the form at once and treat the status answer as an enhancement (only the redirects and the footer link depend on it). Give the status query retry: 0 and a short timeout on these screens, and keep the footer link visible when the answer is unknown. | Sign in and sign up render their form at once, also when /auth/status is slow or fails. |
| auth-12 | medium | Let the page shrink before it clips: scale the demo card when the page is short (transform or container query), drop .start-title a step with a container query in rem, and allow .start-page to scroll vertically as a last resort. Keep the demo cards at a fixed px scale and cap the root scale these screens accept. | At 320 x 568 and at 200% text, no pager content is clipped; the page scrolls as a last resort. |
| auth-13 | medium | Add one plain descriptor on page 1 (a caps line 'Training plan, habits and journal' above the title, or a sub such as 'Your run, your habits and your notes for today, on one screen.'). Make one page about the assistant ('Ask it anything. It can read your plan and change it when you say so.') and on the privacy step explain Remember when in a few words ('a daily reminder of something you wrote'). | Page 1 says what Logbook is in one plain line; one page introduces the assistant before the consent page. |
| auth-14 | medium | Neutral hint, maxLength={200}, a short on-device list of common passwords, and map a 422 to the field the server names. | The hint reads "OK", never "Good."; the field has maxLength 200; a common password or one equal to the email is refused with a plain line. |
| copy-legal-16 | medium | Rebuild the list in PrivacyFacts.tsx from the consent record; one separator; an off item moves under "Never sent". | The facts list is built from the same switches the server checks, does not contradict itself, uses one name for each place, and lists "What you type to the assistant" and "Your first name". Health reads "Health data: not sent." |
| copy-legal-20 | medium | Apply the glossary to this stream's strings. | Strings in features/auth and onboarding follow the glossary. |
| copy-legal-21 | medium | Fix the wording in AuthScreens.tsx and Welcome.tsx. | Closed sign-up reads "New accounts are not open right now." No self-hosting wording in auth or onboarding. |
| copy-legal-23 | medium | Fix the old habit wording in Start.tsx and Welcome.tsx. | Start and Welcome copy describes habits as tiles on Today. |
| gap-qua-07 | medium | Raise the small styles to at least 0.6875rem. | No text under 11 px in onboarding.css at default size. |
| ios-15 | medium | Check and fix the autocomplete attributes in AuthScreens.tsx. | Email and password fields carry autocomplete username, current-password and new-password. |
| onboarding-02 | medium | Add .ob-habits { min-width: 0 } and make .ob-chip shrink (min-width: 0, label in a span with overflow: hidden; text-overflow: ellipsis). Cap a custom habit at about 40 characters in the input (maxLength) and in add(). Add overflow-x: clip on .ob-swipe as a guard. | A 60 character custom habit name does not widen the card; the input caps at 40 characters. |
| onboarding-03 | medium | Send everything in one call (Contract 5). | The payoff sends name, routine, trainWhen and offWork in the one POST /me/onboarding call; no follow-up mutations. |
| onboarding-04 | medium | Keep the draft in localStorage under a logbook. key with the current step. | Quit mid-setup and reopen: the app returns to the same step with answers intact. The draft clears on finish and at sign out. |
| onboarding-05 | medium | When trainWhen is afternoon, make the verdict and payoff line about the afternoon ("Run after work, about 6:10 PM.") or hide the door time, and soften the title to "When does your day start?". Save trainWhen and offWork on the account with the onboarding POST and key any local copy by user id. | Choosing After work changes the verdict and payoff line to the afternoon ("Run after work, about 6:10 PM."). |
| onboarding-06 | medium | Set touch-action: pan-y on .ob-track and keep touch-action: none on the markers only. Move a marker from a tap on the line only on pointerup with under about 8 px of movement, not on pointerdown. | A vertical drag that starts on the wake/leave track scrolls the page; markers move only on a tap with under 8 px of travel or a drag on the marker. |
| onboarding-07 | medium | Replace the setup card with a short summary. Offer Connect Strava only when STRAVA_BUILT and features.strava are true. | The payoff shows a summary of what was made, not "Add habits" or "Plan a week". |
| onboarding-08 | medium | On error stop the ticking, change the title to "Couldn’t save your plan", show the reason in var(--bad) directly above the button ("Check your connection and try again."), keep the layout height fixed, and add a secondary "Change my answers" that goes back to /welcome/goal; show it at once for a 4xx answer. | When the final save fails the ticking stops, the title reads "Couldn't save your plan", the reason shows above the button, and "Change my answers" goes back. |
| onboarding-09 | medium | Add the choice and the Sign out button. | A sixth choice "No running plan for now" finishes setup without a block. The name step has a small Sign out. |
| onboarding-11 | medium | Raise the specificity (.card.ob-card.ob-when { gap: 12px }). Let the stepper take the room it needs (flex: 0 0 auto, value min-width 9ch, white-space: nowrap) and stack the label above it under 360 px. | At 320 and at large text the "Work ends" time is whole and the After work controls have a 12 px gap. |
| onboarding-12 | medium | Size the weekday and date tracks in rem; let .tstage and .ob-pay-hero use min-height in rem. The factor clamp is in a11y-01. | At 135% text the payoff week list and tour demos are whole. |
| settings-18 | medium | Gate StravaPrimer and the payoff row on STRAVA_BUILT. | With STRAVA_BUILT false the Strava primer and the payoff's Connect Strava row never show. |
| settings-39 | medium | Skip the nudge step in a replay, or make its Next a no-op when isReplaying(). Add a test that a replay makes no call into reminders. | A replay of setup never calls into reminders. Test added. |
| a11y-15 | low | Fix the labels and roles axe reports in AuthScreens.tsx, controls.tsx and onboarding.css (race strip focus ring). | axe reports no ARIA slips on sign in, sign up and onboarding controls. |
| a11y-16 | low | In tour.css set .tcaret { animation: none } under reduce. Stop each tour demo after two loops and rest on the finished frame. | With Reduce Motion on, the tour caret does not blink. Tour demos stop after two loops for everyone. |
| auth-17 | low | Add overflow-wrap: anywhere to .auth-sub (and to the error and hint lines). | A 60 character email wraps on the password step at 320. |
| auth-18 | low | While `taken` is true make 'Sign in with that email' the primary action and disable Next until the address changes. Keep the check at submit. | When the email is taken, "Sign in with that email" is the primary action and Next is off until the address changes. |
| auth-19 | low | On 422 at sign-in show 'That doesn’t look like an email address.' on the email field; at sign-up read the field from the server's validation detail. Align the device email rule with the server's. | A 422 at sign-in shows "That doesn't look like an email address." on the email field. |
| auth-20 | low | Move the 'change this later' line up under the choice card, tighten .pv-facts margin-top, and make the foot fade tall enough (40 px) to read as 'more below'. | On the privacy step the last line is visible above Continue or the fade reads as "more below". |
| auth-22 | low | Carry the page index in history state (or a module variable) and scroll the track to it on mount without animation. | Back from the privacy step returns to the pager page the person left. |
| auth-23 | low | Keep the 40 px circle but extend the hit area to 44 px (::after with inset -2px). Either make the dots decorative (aria-hidden; swipe and Next already cover it) or give each a 44 px target and plain buttons with aria-current. | Back buttons have a 44 px hit area; pager dots are decorative (aria-hidden). |
| auth-25 | low | On the eye button call preventDefault on pointerdown so the field keeps focus. Disable Back and the field while busy. Give /login a back button when it was opened from /start. | The eye button keeps focus in the field; Back and the field are off while busy; /login has a back button when opened from /start. |
| auth-26 | low | Ignore onScroll while a programmatic scroll is running (set a ref in goTo, clear it on scrollend or after 400 ms), so the page index, the label and the haptic change once. | One Next tap changes the dots, the label and the haptic once. |
| copy-legal-29 | low | Say what the app does: "One reminder each morning, only on days with no goal yet. You choose the time." | The reminder step reads "One reminder each morning, only on days with no goal yet. You choose the time." |
| gap-qua-29 | low | Pass inputMode numeric to the steppers in Welcome.tsx. | Onboarding time steppers open the numeric keyboard. |
| journal-33 | low | Rename the tour identifiers in demos.tsx and tour.css. | Tour identifiers no longer say garden or plant. |
| onboarding-10 | low | Compute the fix by search: step wake earlier in 5-minute steps (down to TRACK_FROM) until previewMorning(wake, leave).late is 0, else step leave later. Add a unit test for wake 600 / leave 660 with every chip. | The one-tap wake fix works in one tap; unit test for wake 600, leave 660 with every chip. |
| onboarding-14 | low | Await enableReminders() before next() (disable the button meanwhile), label the button "Turn on nudges" when on and "Continue without" when off, and treat a decline in the alert as off without an error. | The nudge step button reads "Turn on nudges" or "Continue without"; the system alert appears on that screen before the app moves on. |
| onboarding-15 | low | Verdict: "Tight. A 4 mile easy run ends 61 min after you need to start getting ready." Format spare time over 90 min as hours ("5 h 24 min"). Capitalise the range sentence ("About 80 mi a week."), drop "builds from here" when peak equals from, collapse "X to X" in the summary, lower-case the goal mid-sentence. Habits: "Pick a few daily habits." / "Pick any, or none. Each one is a light you tap on Today when it is done." Failure: "Couldn’t save your plan. ... | Previews and the verdict read as in the finding ("About 80 mi a week."; "5 h 24 min"). |
| onboarding-17 | low | Remove the header Skip on steps whose CTA already advances with defaults (name, days, morning, habits), or keep it only where it differs. On the tour label it "Skip tour". Consider cutting the tour to the four pages a new account needs on day one. | The tour's skip reads "Skip tour"; header Skip is removed where the main button does the same. |
| onboarding-19 | low | Make the dots presentational (aria-hidden, no click) or real buttons with a 44 px hit area; give Back a 44 px hit area; use --ink-3 for inactive steps and hour labels; add .tcaret { animation: none } under prefers-reduced-motion. | Tour dots are presentational; Back has a 44 px target; inactive steps use --ink-3. |
| onboarding-20 | low | Make .ob-top position: sticky; top: 0 with the page background. Set .ob-goals gap to 12px and drop the race block’s margin-top. Shrink discs to 40 px (or the ring to 3 px). Crop the Plan demo at a row boundary. | The onboarding header stays pinned; card gaps are 12 px; the Plan demo is cropped at a row. |
| onboarding-22 | low | Pass draft.habits.length only (it already holds every selected habit, custom ones included). | Two habits are announced as "Adding 2 lights to Today". |
| onboarding-23 | low | Pass inputProps={{ readOnly: true, tabIndex: -1 }} (or render the value as text) for this stepper, or give it a real parse for times such as "6:15 pm". | The "Work ends" value is plain text or read-only; typing cannot be thrown away. |
| settings-38 | low | Fix the sentence in onboarding/controls.tsx. | The Run days card reads "Tap a day to run on it. Hold a run day to make it the long run." |

### ws-04-today-training: Today: header, training card, morning, sessions, evening

Owns:

- `apps/web/src/features/day/**`
- `apps/web/src/features/morning/**`
- `apps/web/src/features/sessions/**`

Notes: Does not edit packages/shared: phase changes are wrapped inside features/day.

Contracts: C6 shared constants, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| a11y-02 | high | Convert px font sizes and line heights in day.css, morning.css, sessions.css, effort.css, daypicker.css to the rem tokens. Display numerals (hero stamp, gauge) use clamp(44px, 2.75rem, 60px) style limits. | check-styles finds no px font-size in features/day, morning, sessions. Hero, week strip and Morning schedule grow at 135% and 200%. |
| a11y-07 | high | Make the hero a role=group container. Move the open action to a real button on the title with a stretched ::after hit layer. Do the same for the evening run row in CloseDay. | axe reports 0 nested-interactive on every hero face (morning, out, evening, missed, planned) and on the evening run row. The whole card still opens the session on tap. |
| today-body-03 | high | In DayPage.tsx never gate PlanDay or the Close card on first-run; narrow the first-run test to "no plan, no habits, no to-dos, no goals". | Today always renders Plan your day (goal, to-dos, All to-dos), with or without a plan or habits. The first-run face shows only when nothing at all is set up, and never offers "Add habits" to someone who has habits. The evening Close the day card shows without a plan. |
| today-top-01 | high | Let the card height follow its content with a min-height; put the hold ring inside the deck row; hide the When switch when the session is settled. | On every hero face at 320 and 390 nothing is clipped; the done ring never overlaps the When switch; the switch is hidden once the session is done, skipped or matched. |
| today-top-02 | high | Feed the choice into the phase inside features/day (a wrapper in trainWhen.ts around the shared phase); do not edit packages/shared. | Unit tests at 7:00, 12:00 and 18:05 for Morning, Afternoon and No time: Afternoon never shows the morning OUT face, and the evening card waits until the afternoon session is past or marked. |
| today-top-04 | high | Rename Alarm to Wake time in faces.ts, CloseDay, features/morning and add the one line. | No screen in Today or Morning says "Alarm"; they say "Wake time". The step sheet adds "Logbook does not ring. Set this time in your Clock app." |
| a11y-06 | medium | Use #9a5a0c or var(--accent-text) for the hero line; use var(--warn-text) wherever --warn colours words in day.css and morning.css. | Amber hero line and Morning text measure 4.5:1 or more. |
| copy-legal-23 | medium | Fix the old habit wording in DayPage.tsx. | DayPage help text describes habit tiles, not a row of orbs. |
| gap-qua-65 | medium | Format with Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }) in CloseDay and the hero lines. | Clock times on Today and Close the day follow the device's 12 or 24 hour setting. |
| settings-18 | medium | Gate useStravaLanding, useStravaPull and RunLanding on STRAVA_BUILT. | With STRAVA_BUILT false Today never shows a Strava landing or pull state. |
| today-body-34 | medium | Guard SessionEditor.tsx the same way. | Closing the session editor with changes asks "Discard changes?" or saves. |
| today-top-05 | medium | Render SecondSession directly under the hero with the 12 px card gap, before Habits. Keep it out of the evening layout only if the Close card already lists it. | On a two session day the second session sits directly under the hero. |
| today-top-06 | medium | Pick the words from the session kind: 'Lift at 6:10' / 'Start 6:10', stop label 'Start' (or the kind), 'After the session'. In planWords fall back to a capitalised, complete line when there are no miles or minutes ('Strength · floor 20 min' or just 'Floor 20 min'). Give cross days the same morning line as gym days or hide the switch when it changes nothing. | Strength and cross training days use their own words ("Lift at 6:10", "After the session"); no line reads only "floor 20 min". |
| today-top-09 | medium | Let the status chip take only the width of its words (flex: 0 1 auto) and give the block chip the rest. On Today show the goal as the title ('Half marathon') and keep the count in the sub line. Make the total agree with the name: count weeks from the block's start date, or build the block name from its real span. | The plan chip shows the goal name whole when the status chip has room; week counts agree ("Week 1 of 13"). |
| today-top-11 | medium | Limit the text block to the chord of the dial at its row (about 170 px for the line at 320), let a long stamp wrap to two lines at a smaller size (or step down to 22/20 px above 14 characters) instead of one clipped line, and use a shorter countdown below 360 ('Out in 4 h 32 min'). | At 320 a long session name wraps to two lines beside the gauge; nothing collides with the dial. |
| today-top-12 | medium | When there is no live block: chip sub 'No plan yet' and tap opens the plan builder. Build the setup rows from what is missing (hide habits when there are any, hide Strava when connected) and retitle when only the plan is missing. Use 'Nothing planned' instead of 'REST / Rest day' for days with no plan at all, and collapse the empty dial space. | With no plan the chip reads "No plan yet" and opens the plan builder; other days read "Nothing planned", not "Rest day". |
| copy-legal-26 | low | Replace the em dash in the Today sentence line. | No em dash in DayPage.tsx strings; the empty mark is the en dash. |
| gap-qua-29 | low | Pass inputMode numeric to the steppers in WhenPill.tsx. | The WhenPill time steppers open the numeric keyboard. |
| today-body-18 | low | Put inert on .day-habits-card only in DayPage.tsx. | On a future day the Habits header action still works; only the card is inert. |
| today-body-24 | low | Rename in TheDayCard.tsx and DayTimeline.tsx. | Past-day headings read "Journal" and "What happened"; TheDayCard's aria-label matches its heading. |
| today-top-08 | low | Rename one of the two classes (for example the sheet's chips to `.st-len`). Remove the fixed height so both chips stretch to the row and share one min-height. | The two chips under the Today title share one height (no 52 and 56 px). |
| today-top-14 | low | In `.hero.aura:not(.is-tall) .hero-next` set `margin: 0` (keep width 100%). | The "Tomorrow:" row on rest and skipped days is centred. |
| today-top-17 | low | Offer Share only when a run exists, the session is done or at the floor, or the day has a journal entry. | The hold menu offers Share only when there is something to share. |
| today-top-18 | low | Rest: drop the 'Rest day' line or use it for the next session. Done: drop the deck's week line now that the pill carries it. Landed: keep the pace in one place and round week miles to one decimal. Sheet: use 'Planned 5 mi' under the number instead of repeating the status, and hide door/back tiles once they are past. | No repeated words or numbers on the card and sheet ("Rest day" once, pace once). |
| today-top-19 | low | Darken the line to about #a85f12 (4.9:1) and use --ink-3 for the runs part. | Training card small text measures 4.5:1 or more. |
| today-top-20 | low | Label the option "No set time" in WhenPill.tsx. | VoiceOver reads "Train, no set time" for the third option. |
| today-top-22 | low | Parse typed times (h:mm, with am/pm) or make the field read only. Show the change time as its own row or fold it into the copy. Give the steppers one fixed width, keep the summary labels on one line ('OFF'), raise the segmented control to 44 px, and title the sheet by day. | The Afternoon sheet's time field is read-only or parses typed times; steppers share one width; the segmented control is 44 px tall. |
| today-top-23 | low | Do not render `.mini-tl-now` when now is negative. | A future morning shows no orange "now" dot. |
| today-top-24 | low | Make the caps date in the bar a visible control (small calendar glyph or chevron) that opens the calendar on tap, and keep the hold menu as a shortcut. Rename the items 'Set a word for the day'. | The caps date in the bar has a small calendar glyph and opens the calendar on tap. |
| today-top-25 | low | On the first tap of the ring show a short hint ('Hold to mark done') or fill it briefly to teach the gesture. Add 'Put it back' to the hold menu when the lead is skipped. | The first tap on the done ring shows "Hold to mark done"; a skipped session has "Put it back" in the hold menu. |
| today-top-26 | low | Give the length chips a 44 px hit area (min-height or ::after). Align the chevrons to the gutter. Show a counter near the name limit. | Length chips have a 44 px hit area; the name field shows a counter near its limit. |
| today-top-29 | low | Render every remaining training session as its own compact card (map over the sessions after the lead) and list them all in the Close card. Keep two glyphs in the strip but say all kinds in the label. | A third session on a day shows as its own compact card and in the Close card. |
| today-top-31 | low | Until about 3 AM, if yesterday has no journal entry, show a one line prompt on Today ('Close yesterday') that opens yesterday's composer. Do not change the date logic. | Until 3 AM, if yesterday has no journal entry, Today shows a one-line "Close yesterday" prompt. |

### ws-05-today-lists: Today: habits, plan your day, to-dos

Owns:

- `apps/web/src/features/dayplan/**`
- `apps/web/src/features/habits/**`
- `apps/web/src/features/todos/**`
- `apps/web/src/features/log/**`

Notes: Owns features/log/useLog.ts. Other streams read its existing result and do not edit it.

Contracts: C2 local account wipe, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| a11y-02 | high | Convert px font sizes and line heights in this stream's CSS to the rem tokens. | check-styles finds no px font-size in features/dayplan, habits, todos. Habit tiles grow at 135% and 200%. |
| auth-06 | high | Make the inline add field reveal itself above the keyboard (scroll-margin and the shared reveal). | Today's "Add a to-do" field sits above the keyboard when focused. |
| shell-03 | high | In OrbRow.tsx roll the tile back on error, also when the failure returns before the animation ends. | A habit tile never stays lit after its save is refused. |
| today-body-01 | high | Rename the to-do row classes in todos.css and TodoList.tsx (for example .tdl-row) so day.css no longer reaches them; set .list-chip { flex: 0 1 auto; max-width: 40%; min-width: 0 }. | In the To-dos sheet at 320 and 390 a to-do with a list shows its chip at natural width and a full title. No class is shared with the Day timeline. |
| today-body-02 | high | When top is empty give the empty line row 2 and start the fold row at 3 (for example `let row = top.length ? 2 : 3`). When only done items are folded show one label ('2 done') and drop the '+2' badge. | With every to-do done, "All done" and the "N done" fold row sit on separate rows with no overlap. |
| today-body-04 | high | Render every row from one keyed array with explicit gridRow so the dragged node is never replaced. | Dragging a to-do from "After these" into the top three works three times out of three. |
| a11y-13 | medium | In PriorityDots show the priority as a numeral or distinct shape, and put it in the accessible name. | Priority flags carry a numeral or shape as well as colour. |
| copy-legal-23 | medium | Fix the old habit wording in HabitSheet.tsx and HabitsHistory.tsx. | HabitSheet and HabitsHistory help text describes tiles on Today. |
| gap-qua-10 | medium | Use a border of rgba(15, 42, 68, 0.5) for the to-do circle. | The to-do circle border measures 3:1 or more. |
| today-body-05 | medium | .tlist { grid-template-columns: minmax(0, 1fr) } and min-width: 0 on .tlist-add / .tt-field; .tt-input { min-width: 0; flex: 1 }; .tt-hint { flex: 0 1 auto; max-width: 55%; overflow: hidden; text-overflow: ellipsis }. At narrow widths put the hint on a second line. | The quick-add field with a long hint does not widen the sheet at 320. |
| today-body-06 | medium | Stamp deletions with the earlier of the page's date and today (pass `today` into useTodoActions and TodoSheet; deletedOn: date > today ? today : date). Same for the to-do turned into a goal step. | Deleting a to-do from a future day's page removes it everywhere at once. |
| today-body-08 | medium | Take the first grapheme: `[...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name.trim())][0]?.segment` (fallback Array.from(name)[0]). If it is an emoji, show it upright at the emoji size; for a digit use the upright sans face. | A habit named with a leading emoji shows the whole emoji as its tile initial. |
| today-body-10 | medium | Branch the words on the date. Past, no goal: 'No goal was set.' with no button. Future: 'What would make this day count?' and 'Add what matters that day.' Past all done: 'Everything got done.' Off today, label the action 'Next day' and say 'Moved to Fri, Nov 13'. Toast: 'Now a step of that day's goal'. Fix the ring's label and 'Done today' the same way. | Plan card copy on a past or future day reads for that day ("No goal was set.", "What would make this day count?"). |
| today-body-11 | medium | Decide inside OrbRow from the date it is given. | The Add habit tile shows on today only; a past day with no habits reads "No habits were set up yet." |
| today-body-12 | medium | Sort the day list by position only and do not rewrite priority on reorder. | Reordering a to-do on Today leaves its priority flag alone. |
| today-body-13 | medium | Drop the opacity stacking. Done: text in --ink-3 with the strike-through, mark at full strength. Rest: text in --ink-2, number chip outlined, no opacity on the row. Use --ink-3 for the done count. | Done and "After these" rows measure 4.5:1 or more; no stacked opacity. |
| today-body-16 | medium | Wire the Undo toast in PlanDay.tsx. | One tap on the goal ring on Today marks the goal done with an Undo toast and no step changes. |
| today-body-17 | medium | Use the same field as the sheet (with the hint, after the overflow fix) or show the hint under the row. After adding something that is not for today, toast 'Added for Fri, Nov 13' with View. Keep parsing when a #tag matches no list (leave the tag in the text, or offer 'Create list Work'). Add aria-label='New to-do'. Mention the marks once, for example in the empty state. | Adding a to-do for another day toasts "Added for Fri, Nov 13" with View; the inline field shows what its marks did. |
| today-body-34 | medium | Save on close when something changed. | Closing the to-do editor with changes saves them. |
| a11y-15 | low | Fix the labels and roles axe reports in TodoSheet.tsx. | axe reports no ARIA slips in the to-do sheet. |
| copy-legal-25 | low | Change to "Color" and "No color" in colors.tsx and ListSheet.tsx. | No "Colour" in features/todos. |
| perf-10 | low | Remove the interval in PlanDay.tsx; debounce the timeline refetch by 1 s. | PlanDay has no 400 ms interval; the rail re-measures from the ResizeObserver and when the layout animation ends. |
| perf-13 | low | Apply content-visibility: auto with contain-intrinsic-size to rows, or render 40 and add on scroll. | Opening All to-dos with 300 rows takes under 100 ms of blocking on a 4x throttled trace. |
| today-body-09 | low | Below 360 px: ring 34 px, tighter tile padding and gap, name 13/16; or allow a third line (tiles already grow). Check with the starter names and a 20-character name. | At 320 two-word habit names are whole in the tiles. |
| today-body-15 | low | Make .pd-card-text a block with the flag inline after the last word, and clamp the text to 3 lines on Today (-webkit-line-clamp: 3); the editor shows the full text. | Today's to-do text is clamped to 3 lines with the flag inline after the last word. |
| today-body-19 | low | Two spans: the names (min-width: 0, CSS ellipsis, no hand-written '…') and the done count (flex: none) so '· 2 done' always shows. | The fold row always shows the done count; one ellipsis at most. |
| today-body-20 | low | Inside .pd-flow remove the 8 px side inset of the top rows (or give the rest rows the same inset) so one column of numbers and one column of checks runs down the card. | Numbers and check circles line up in one column down the card. |
| today-body-21 | low | Clamp the goal to 4 lines on Today (the goal sheet shows it whole). | The goal on Today is clamped to 4 lines. |
| today-body-22 | low | Show the goal: caps 'Yesterday's goal', then the goal text on one line with ellipsis, then 'Did you hit it?' as the action. | The review row shows the goal text above "Did you hit it?". |
| today-body-24 | low | Rename the heading in PlanDay.tsx. | Past-day headings read "The plan" for goal and to-dos. |
| today-body-25 | low | Show one line under the field: 'You already have Meditate.' Do the same check for list names. | A duplicate habit or list name shows "You already have Meditate." |
| today-body-26 | low | Disable the cells before createdOn (disabled, no tap), or when one is lit move the habit's start back so counts and streak agree. | Days before a habit existed cannot be lit in its sheet. |
| today-body-29 | low | Show the goal hint as a third dock ('Make it a step') or tint the whole goal card with the words above it; fade the nav title while docks are up; keep the rank number on the ghost. | While dragging, the goal hint is visible as a third dock and the ghost keeps its number. |
| today-body-30 | low | Swatches: a fixed grid (4 columns x 2). Chips: min-width: 0; max-width: 100%; text-overflow: ellipsis on the label, and let the pair wrap instead of stretching. | Colour swatches sit in a fixed 4 x 2 grid; list chips do not overflow at 320. |
| today-body-31 | low | Make the Order buttons 44 x 44 in TodoSheet.tsx. | Move up and Move down are 44 x 44. |
| today-body-32 | low | Pick one word everywhere: 'Tomorrow' (it matches the toast and what happens). Add the Moon icon to Someday in the sheet menu. | The move is called "Tomorrow" everywhere. |
| today-body-35 | low | Filter by createdOn and archivedOn in OrbRow; if the bootstrap does not carry archivedOn, stop and report instead of changing the server. | A past day shows the habits that existed that day, archived or not. |

### ws-06-goals-learned: Goals and Learned tabs

Owns:

- `apps/web/src/features/goals/**`
- `apps/web/src/features/learned/**`

Notes: Owns the shared kit styles in features/goals/kit.css. Adds feature-local hooks instead of editing api/queries.ts.

Contracts: C1 consent, C2 local account wipe, C6 shared constants, C8 glossary, C9 small API additions.

| Id | Severity | Change | Done when |
|---|---|---|---|
| goals-01 | blocker | Read consent from bootstrap in GoalEditor. | With consent off the editor skips the request, saves as typed and shows "Saved as written. Turn on assistant access in Settings to have goals reviewed." With it on the hint names Claude. |
| a11y-02 | high | Convert px font sizes and line heights in this stream's CSS to the rem tokens. | check-styles finds no px font-size in features/goals and learned. |
| copy-legal-09 | high | Mark the reviewed goal in GoalSheets.tsx. | A goal changed by the review shows "Sharpened by AI". |
| goals-02 | high | Keep a mounted ref (or pass an AbortController to api()) in GoalEditor and drop the result when the editor has unmounted or been popped. Make the textarea readOnly while reviewing. Add a client timeout of about 15 s that falls back to the write step with a toast ("The review took too long. Save as written?"). | Closing the editor during "Reviewing" saves nothing. After 15 s the review gives way to "The review took too long. Save as written?" |
| learned-02 | high | Keep one Composer mounted across the empty and has-items states. | A rejected first save of the day keeps the typed text in the composer and shows a toast. Test added. |
| learned-03 | high | On focus scroll the search field to the top of the scroller (just under the nav bar) instead of to the keyboard edge, and hide the hero, tiles and From your archive while a query is active. Wrap the input in a form whose submit blurs it, and blur on the first touch or scroll of the results. | With the keyboard up, search results are visible above it; the Search key and the first scroll blur the field. |
| a11y-06 | medium | Use var(--warn-text) for warn-coloured words in goals.css. | Words coloured by --warn in goals.css measure 4.5:1 or more. |
| gap-qua-07 | medium | Raise the small styles to at least 0.6875rem. | No text under 11 px in learned.css at default size. |
| gap-qua-10 | medium | Darken stand-alone ring tracks in goals.css. | Goal ring tracks that stand alone measure 3:1 or more. |
| gap-qua-40 | medium | Start each aria-label in features/goals with the visible words. | Goal control names start with the printed text. |
| gap-qua-65 | medium | Format with Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }) in GoalSheets. | Clock times in goal sheets follow the device setting. |
| goals-03 | medium | Add the error branch in GoalsView. | When goals fail to load the tab shows "Goals didn't load." with Try again. |
| goals-04 | medium | Use a short title that always fits ("Day goal", "Week goal", "Month goal", "Year goal", as the detail sheet does) and put the question in the sheet body as a wrapping serif line above the choices or field. Or let .sheet-title wrap to two lines for these sheets. | The set-goal sheet title fits at 320; the question wraps in the body. |
| goals-05 | medium | Build the question from periodName: "What is the one thing for tomorrow?", "What will you get done next week?", and for other dates "What is the one thing for Thu, Nov 12?". In useStarters drop "today" unless the period is today ("Run Easy 6.5 tomorrow."), do not repeat the miles when the title already has the number, and use "Part of the week: ...". | The question names the right period ("What is the one thing for tomorrow?"). |
| goals-06 | medium | Give word stamps their own size (.gh-stamp.is-word at about 2rem / 2.25rem) and centre them (justify-items:center with inset-inline:0 on .gh-mid) so any overflow stays symmetric. Check Partly and Missed fit inside about 124 px. | "Missed" and "Partly" fit inside the Today gauge and sit centred. |
| goals-07 | medium | Follow the restoring PUT with a PATCH of status and reflection from the saved copy, and mirror it in the cache. | Undo after Clear goal brings back the status and the note. |
| goals-08 | medium | Raise the selector in kit.css (:root .btn.k-danger) so the shared kit rule wins; add a pressed state. | The Clear goal and learned Delete confirm buttons are red with white text. |
| goals-09 | medium | Pass a reason to saveSteps ("toggle" / "add" / "remove") and change status only on a toggle: last step checked on an open goal sets done; a step unchecked on a done goal reopens it. Never reopen on a check, an add or a remove. When Done is tapped in the answers row, check the remaining steps as the hero's Mark done does. | Adding or removing a step never changes the goal's status; only ticking the last step sets done, and unticking on a done goal reopens it. |
| goals-10 | medium | After enableReminders() resolves true, call scheduleReminders(goals.data, today, wake) directly. When it resolves false, show "Notifications are off for Logbook. Turn them on in Settings." with a button that opens the app's settings page. On mount and on resume call checkPermissions() and show Off if not granted. Move the row into its own short section and show the time ("About 7:15 am, only on days with no goal"). | Turning reminders on schedules at once. When iOS permission is denied the page says "Notifications are off for Logbook. Turn them on in Settings." with a button to the app's settings. |
| goals-12 | medium | Rename the card and line so they promise only what the assistant gets. | The card reads "Suggest one for me" and its line matches what is sent; with assistant access off it says so. |
| goals-13 | medium | Call refine through a feature-local hook (features/goals/refine.ts) that keeps the available flag and the error code. | When the review is not available the goal saves as typed with the toast "Saved as written. The review was not available." |
| goals-14 | medium | Make the backdrop opaque (var(--bg)) or add a backdrop blur. On open move focus to "Keep going", return focus on close, and do not auto-dismiss while VoiceOver focus is inside (or drop the dialog role and announce through an aria-live region). Clamp .cel-goal to 3 lines. | The Goal done overlay has an opaque backdrop, takes focus on open and returns it on close. |
| goals-29 | medium | Handle code "refused" and any 4xx from refine in the feature-local hook. | When Claude declines, the goal saves as typed with a plain toast. |
| learned-04 | medium | Branch on isError for the list, months, stats and search queries: show a card such as "Couldn't load what you learned. Try again" with a retry button, keep the composer usable, and never render the empty-year row or "No matches" from an error. | A failed load shows "Couldn't load what you learned. Try again", never "0 things" or "No matches". |
| learned-10 | medium | Render the section only when at least one slot has an item, and render only the filled slots (a single card can span the full width). Drop the empty-card variant. | "From your archive" renders only when a slot has an item. |
| learned-11 | medium | Make recent empty day rows tappable to add for that date. If POST /learned turns out not to accept a past date, stop and report instead of changing the server. | On the month page an empty day in the last 7 days opens the add sheet for that date. |
| today-body-16 | medium | In goals/Steps.tsx stop ticking steps for the user and return an undo handle. | Marking a goal done with steps open does not tick the steps; a toast offers Undo that restores status and steps. |
| today-body-34 | medium | Save on close when something changed in LearnedParts.tsx. | Closing the learned edit sheet with changes saves them. |
| goals-15 | low | Add width:0 (keeping flex:1) to .gh-step-input, or min-width:0 on .gh-steps and .gh-step, and make the .gh content column minmax(0, 1fr). | At 320 the hero "Add a step" field stays inside the card. |
| goals-16 | low | Clamp .gh-text to 4 lines (-webkit-line-clamp) and step the size down for long text (about 1.375rem over 80 characters); the full text is in Details. | A 400 character goal is clamped to 4 lines in the Today hero. |
| goals-17 | low | Lay each row out as two parts: the text (flex:1, ellipsis) and the period (no shrink) at the right. Give the button a 44 px height or hit area. | The To review card keeps the period visible; its button is 44 px tall. |
| goals-18 | low | Start the list at the account's createdAt (or the first goal) with a minimum of the current period, and base "of N" on that count. Make empty past rows non-interactive. | History starts at the account's first period; empty past rows are not tappable. |
| goals-19 | low | Under a "behind" number show the short reason from s.vs ("was 1 of 1"), or drop the orange. Add a one line key under the trail ("Done · Partly · Missed · Open") or cut to three states. | The trail has a one-line key under it. |
| goals-20 | low | Use "Done" everywhere for the status; keep "kept" only in the "Goals kept" heading or rename it "Goals done". Replace "Answered" with the day or nothing. Label the edit button "Save". Remove the unused leftWords(). | Status wording is "Done" everywhere; no "Answered". |
| goals-21 | low | Give the chips min-height 44 (or an ::after hit area), raise the segmented control to 44 px or extend its hit area, and make sheet icon buttons 44 x 44. | Chips, the segmented control and sheet icon buttons in goals are 44 px targets. |
| goals-22 | low | Do it in GoalsBadge.tsx only; do not change packages/shared. | The Goals tab dot appears only once the account has set a goal; its name reads "Goals, needs attention". |
| goals-23 | low | Make the whole step row the toggle. Dim disabled marks (opacity 0.5) and apply the same lock in the sheet. Use one mark shape in both places, add padding-block 8px to .g-step, and keep a quiet "Details" link in the no-steps hero. | The whole step row toggles; locked steps look dimmed. |
| goals-24 | low | Drop the chevron or the gap in .ga-top below 360 px. Cap .gh-ask at max-width 60% below 360 px or move the sun up and right. | At 320 the Next week chip title is whole and the sun clears the headline. |
| goals-31 | low | For a period that has not started, hide the answers row and the gauge clock, and show "Starts tomorrow" (or "Starts Mon, Nov 16") with the steps and Edit goal only. | A goal for a period that has not started shows "Starts tomorrow" and no answer buttons. |
| learned-07 | low | Make the month name flex: none and let the label be the part that shrinks or drops (the orange NOV tile already marks the current month), or hide .ln-mrow-now below about 360 px. | At 320 the current month name is whole. |
| learned-08 | low | After each growth, scroll so the compose foot (not just the field) stays 16 px above the keyboard, for example by calling the reveal helper on the .ln-compose element from useGrow while the field is focused. | Save stays 16 px above the keyboard as the first entry grows. |
| learned-12 | low | Set the skeleton colour and heights in learned.css (do not edit foundation.css). | The loading state shows tinted skeleton blocks of the final height; no jump. |
| learned-13 | low | Shorten the visible placeholder to "Search" (keep the long aria-label), or add text-overflow: ellipsis to the input. | The search placeholder reads "Search" at 320. |
| learned-14 | low | Append the year to the sheet title when item.date is not in the current year (the same rule dateWords uses in LearnedEchoes.tsx). | The edit sheet title shows the year for entries from other years. |
| learned-15 | low | Use "kept in July" (or just "kept") for past months, "Nothing kept" for an empty past month, and drop either the eyebrow or the tiles. | A past month reads "kept in July"; an empty past month reads "Nothing kept". |
| learned-16 | low | Add border-radius: 0 to .ln-line.is-grid, or draw the separator with a pseudo-element. | The divider between two learnings on one day is straight. |
| learned-17 | low | Add maxLength={100} to the search input and do not retry 4xx responses in the query client defaults. | The search input has maxLength 100. |
| learned-18 | low | Drop the per-month count from search results. | Search results show no per-month count that can be wrong. |
| learned-19 | low | Show a small counter from about 900 characters ("940 / 1000") and a one-line note when a paste is cut. | A counter shows from 900 characters; a cut paste says so. |
| learned-20 | low | Open the sheet unfocused and scrolled to the top; focus (caret at the end) only when the user taps the text. | A long entry opens at the top, unfocused. |
| learned-21 | low | Clamp each of today's lines to about 6 lines with a fade; the tap already opens the full text. | Each of today's lines is clamped to about 6 lines. |
| learned-22 | low | Use "Not yet today" with white-space: nowrap (or "Not yet"), "Done today", and "Nothing kept yet"; remove tnum from the large tile value. | Tiles read "Not yet today", "Done today", "Nothing kept yet" on one line. |
| learned-23 | low | Use --ink-3 for the "Add another" placeholder, raise the weekday caps to 11 px, and give the labelled elements a role (role="group" or role="img") or replace the labels with visually hidden text. | The "Add another" placeholder uses --ink-3; weekday caps are 11 px; labelled elements have a role. |
| learned-24 | low | On the month page fetch all pages before building the grid (loop fetchNextPage while hasNextPage), or show a skeleton row for days older than the oldest loaded row. | A month with 230 entries shows no false empty days. |
| learned-27 | low | Add previous and next chevrons in the bar (or a "October" row at the foot of the day list) that replace the page with the neighbouring month that has entries. | The month page has previous and next chevrons. |

### ws-07-journal-share: Journal, Library, Reads and share cards

Owns:

- `apps/web/src/features/journal/**`
- `apps/web/src/features/share/**`
- `apps/web/src/features/reads/**`

Notes: Adds feature-local query hooks (features/journal/queries.ts) instead of editing api/queries.ts. Imports journalGuard from features/day without editing it.

Contracts: C1 consent, C2 local account wipe, C6 shared constants, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| copy-legal-06 | blocker | Read the two consent flags from bootstrap in RecallCard, TodaysPick and ReadsView. | With recall off, Remember when shows the plain excerpt. With reads off, Today's pick is hidden. The Reads screen says picks are chosen by Claude. |
| journal-01 | blocker | Keep the draft until the write is confirmed or queued offline; restore on error for add and patch; import the existing watchJournalAdd from features/day/journalGuard.ts without editing it. | A save that fails (server error, or text over 5,000 characters) puts the words back in the writer with the toast "Couldn't save that. Your words are back." The field has maxLength 5000. |
| a11y-02 | high | Convert px font sizes and line heights in this stream's CSS to the rem tokens. | check-styles finds no px font-size in features/journal, share, reads. |
| auth-06 | high | Pad the writer by var(--kb) and scroll it into view on focus; keep Save visible. | The Journal day writer and its Save button stay above the keyboard and scroll into view when opened. |
| copy-legal-09 | high | Mark the card in RecallCard.tsx. | A Remember when summary shows "Written by AI" with the original entry one tap away. |
| journal-06 | high | Persist drafts per day with idb-keyval under a logbook. key, debounced; load at start; drop drafts older than 30 days. | Type a memory, reload the app: the words are back in the writer for that day. Drafts clear on save and at sign out. |
| perf-04 | high | Feed the calendar from the month bundles. Add feature-local hooks (features/journal/queries.ts) with useInfiniteQuery and the before cursor; do not edit api/queries.ts. | On an account with 400 entries, March shows its entries in the calendar and "Show older" loads past 200. The header shows the real total. Test with more than 200 entries. |
| a11y-03 | medium | In calendar.css and seg.css let labels wrap to two lines and stack under a container query. | At 135% and 200% the calendar bar and segmented control wrap or stack with no overlap. |
| a11y-13 | medium | In the journal Calendar show the entry count as a numeral in or beside the orb and a star glyph for starred days. | Journal calendar cells show the count as a numeral and a star glyph for starred days. |
| copy-legal-20 | medium | Apply the glossary to this stream's strings. | Strings in features/journal follow the glossary (done with journal-19). |
| gap-qua-07 | medium | Raise the small styles to at least 0.6875rem. | No text under 11 px in journal.css at default size. |
| gap-qua-18 | medium | Add the Journal skeleton (with journal-04). | Journal shows skeleton rows while loading and never prints an empty sentence during a pending query. |
| gap-qua-40 | medium | Start each aria-label in the journal Calendar with the visible words. | Journal calendar cell names start with the printed text ("Wed 4, no entries"). |
| journal-04 | medium | Pass loading and error states into Calendar and Timeline. While pending: no "Nothing written" and no "Write today's" swap, show skeleton rows online too. On error with nothing cached: a card "Couldn't load your journal. Try again" with a retry button. | A slow first load shows skeleton rows, never "Nothing written". A failed load with nothing cached shows "Couldn't load your journal. Try again." |
| journal-07 | medium | Give .jcal `grid-template-columns: minmax(0, 1fr)` so content can never widen the card, and let the bar shrink: .jcal-seg `flex: 0 1 136px; min-width: 112px`, Today button side padding 8 px under 360 px, or move Today next to the title on narrow screens. | At 320 the calendar card does not overflow when the Today button shows. |
| journal-09 | medium | Route both through one helper: on native use shareImage(blob, name, 'share') from share/shareOut.ts for the card and Share.share({text}) for entries; keep the web fallbacks for the browser. Rename the button to "Share image" on native. Only toast "Image saved" after a real save; toast "Copied" when the fallback copies. | On iPhone, Save as image and entry Share open the native share sheet through share/shareOut.ts; "Image saved" shows only after a real save. |
| journal-10 | medium | Track the edited entry by id and follow the tmp-to-real id swap (the outbox alias, or match on date plus text like useStableKeys does). Never drop the writer while it holds unsaved text. | The inline editor stays open while its entry's save lands, with the typed text intact. |
| journal-11 | medium | Use the same action as everywhere else: useEntryActions().del(e), which calls restore on Undo. | Undo after removing a memory restores the same entry: same time, star kept. |
| journal-12 | medium | Pick one model. Simplest: in the day card a tap opens the same entry sheet as the list, or add a small action row under the inline editor (star, Share, Delete with Undo). Remove "empty it to delete" as the only route. Keep or confirm unsaved edits before discarding. | In the day card a tap on a memory opens the same entry sheet as the list (star, Share, Delete with Undo). |
| journal-13 | medium | Open the writer on a tap only when today is empty. When today has memories, open the day card in reading state with "Add another". | Tapping today's cell opens the writer only when today is empty; otherwise the day card opens in reading state with "Add another". |
| journal-14 | medium | Reserve the space: render a skeleton card of the final height while the query is pending and collapse it only once the answer is "no item". Or answer at once with the fallback line and swap the AI summary in place later. Show a small spinner on Another while it waits. | The calendar does not jump when Remember when arrives: a skeleton of the final height holds the space. |
| journal-15 | medium | Size the columns to content (for example grid-template-columns: 1.3fr 1fr 1fr) with 12 px inner padding, or shorten the label ("More often"). Check at 375 and 393 as well. | At 375, 390 and 393 the "Remind me more" row has 12 px inner padding and nothing touches an edge. |
| journal-16 | medium | Append the year whenever it is not the current year: "Nov 7 to 13, 2025", "Monday, November 10, 2025", and the same in the entry sheet. Label the footer with the actual year or "A year earlier". | Days and weeks outside the current year show the year. |
| journal-18 | medium | Use --ink-3 for these labels and the placeholder; raise future days by dropping the extra 0.55 opacity. | Small grey labels and the Starred indicator in the calendar measure 4.5:1 or more. |
| journal-19 | medium | Apply the glossary: "entry", "Favorite"; CTA "Write today's entry". | One noun (entry) and one verb (Favorite) across the tab and its VoiceOver labels; the inner segment is not named "Journal". |
| journal-20 | medium | Set the user's own words in one face everywhere (the serif of the timeline and sheet). Remove the mono rule. Use one order within a day in both places. | The user's own words are set in the serif face in the calendar, the list and the sheet. |
| journal-21 | medium | On native show one primary button (Share), or make Save really save to Photos with a plugin after adding the usage string. Give both buttons one height. Make the dot hit areas 28 px wide and 44 px tall. Reserve the caption field's space for every template. Decide whether share cards should carry the light brand and align the two share images. | On iPhone the Share the day sheet shows one primary button (Share); controls share one height; dot targets are 28 x 44. |
| copy-legal-25 | low | Change to "Favorite", "Favorited", "Unfavorite", "Favorites". | No "Favourite" in features/journal. |
| copy-legal-26 | low | Fix attribution in share/cards.ts. | Share cards put the author on its own line or after a comma, with no em dash. |
| gap-qua-04 | low | Widen .jcal-arrow to 44 and raise seg.css buttons to 44. | Journal calendar arrows and segmented buttons have a 44 x 44 hit area. |
| gap-qua-29 | low | Add enterKeyHint="search". | The Journal search field shows a Search key. |
| journal-17 | low | Use the short form under about 360 px ("Thu, Nov 5") or let the title wrap to two lines; never truncate the number. | At 320 the day card title keeps the day number ("Thu, Nov 5"). |
| journal-22 | low | Disable Save until there is text (or until the text changed when editing). Auto-grow the field up to about half the screen, then scroll. | Save is off on an empty writer; the field grows to about half the screen, then scrolls. |
| journal-23 | low | Label it ("Today's quote · tap to use") and let it wrap to two lines. Call setDraft in the insert, and insert in the same position and format as addToDraft (quote on top, blank line). | The quote line is labelled "Today's quote. Tap to use", wraps to two lines, and its insert is kept in the draft. |
| journal-24 | low | Give the arrows and Close a 44x44 hit box, make Cancel and Save 44 high, and let month cells use the full row height as their hit area. | Calendar arrows, Close, Cancel and Save are 44 px targets. |
| journal-25 | low | Show today's empty state as a ring or a plus instead of an orb, and an outline or no orb on an empty day card. Drop one of the two "nothing" lines. Make the key orbs larger or show the count as a small number. Add ", starred" to the cell label. | Today's empty cell shows a ring or plus, not an orb; an empty past day shows an outline. |
| journal-26 | low | Show the result count and keep one clear control in JournalHome. | The Entries header shows "7 of 23" while searching; one clear control. |
| journal-27 | low | Remove the grid gap before .j-entries (or the section's own top margin there) so the heading lands at the 28 px the other sections use. | The Entries heading sits 28 px under the card above it. |
| journal-28 | low | Break a word wider than the line by characters in wrapLines, and end with an ellipsis if the text still does not fit at the smallest size. | A long unbroken word wraps by character in the share image. |
| journal-30 | low | Show a hint in the empty search ("Type two letters or more"). Reword to "Star a quote or an entry to keep it here." Reject or merge an exact duplicate with a toast. Add a hairline above the author field and align the two buttons. | Empty Library search shows "Type two letters or more"; an exact duplicate quote is refused with a toast. |
| journal-31 | low | Format with the device locale (undefined locale, hour: 'numeric', minute: '2-digit'). For an entry whose createdAt date differs from its day, show "added Nov 10" instead of a time. | Entry times follow the device's 12 or 24 hour setting; a back-filled entry shows "added Nov 10". |
| journal-33 | low | Delete unused Journal code. Server day-tag routes stay until a migration can drop the table (noted in Deferred). | Unused Journal components (JournalHome leftovers, Ghost) are deleted and the app builds. |
| journal-35 | low | Lay the actions out on purpose: three equal buttons in one row with Delete as a quiet full-width row beneath, or icon-over-label tiles in a four-column grid. Give the star button a fixed width so the toggle does not move its neighbours. | Entry sheet actions sit in one row of three with Delete as a quiet full-width row beneath. |
| perf-21 | low | Debounce the search in JournalHome. | Journal search waits 250 ms and needs 2 characters. |

### ws-08-plan-progress: Plan and Progress tabs

Owns:

- `apps/web/src/features/plan/**`
- `apps/web/src/features/progress/**`

Notes: Builds the Apple Health views on Progress against Contract 4. Does not edit ui/charts: override in feature CSS.

Contracts: C4 health daily, C6 shared constants, C8 glossary, C9 small API additions.

| Id | Severity | Change | Done when |
|---|---|---|---|
| copy-legal-03 | blocker | Change the fine print line in PlanBuilder.tsx. | PlanBuilder fine print reads "Reads your source and the runs you marked done, then returns dated sessions you can check before saving." |
| ios-03 | blocker | Feed the three metrics from GET /api/apple-health/daily; sleep shows one decimal hour; drive the eyebrow from the real connection state; remove the permanent Syncing state. Drop Run pace from the tiles when there is no timed-run source (progress-05). | With Apple Health connected, the Sleep, HRV and Resting HR tiles and pages draw real numbers. Not connected: a Connect Apple Health button. "Syncing" shows only while a sync is running. |
| plan-02 | blocker | In Preview load the draft's months before enabling the buttons; count as the server does; wire Undo to replacedIds. | The preview button says "Replace N sessions" whenever sessions in range will be replaced, and "Add to my plan" only when none are. A Replace offers Undo that restores them. Test for a draft that starts in a later month. |
| a11y-02 | high | Convert px font sizes and line heights in this stream's CSS to the rem tokens; clamp chart numerals. | check-styles finds no px font-size in features/plan and progress. |
| copy-legal-08 | high | Show DISCLAIMER (lib/copy.ts) in PlanBuilder, the builder's last step and MetricPage About sheets. Rename Health Monitor. | The DISCLAIMER line shows on the plan build step, the AI plan preview and every metric About sheet. "Health Monitor" is renamed "Your numbers" with no stethoscope icon. |
| copy-legal-09 | high | Mark the preview in PlanBuilder.tsx. | AI plan previews show "Written by AI". |
| gap-rev-11 | high | Remove the dead run-note call and UI until the feature returns. Gate the Health block on HEALTH_BUILT. | The run-note call and its UI are removed from the plan screens. With HEALTH_BUILT false the Progress Health block and its three metric pages are absent. |
| ios-27 | high | Call /plans/draft with a 150 s timeout and show the named wait. Running drafts as a background job waits (Deferred). | Describing a 12 week plan on a phone returns a draft; the wait shows progress and can be stopped. |
| plan-05 | high | Stop the grid from shrinking the list: wrap Preview in one block container (as `.tp` does for the builder), or give `.pv-weeks` `min-height: max-content`, so the sheet body scrolls. Check with a 16-week draft at 320 and 390. | A 16-week AI draft scrolls to its last week at 320 and 390. |
| progress-02 | high | In EasyPaceSheet return an EmptyState when ep.runs.length === 0 ("No timed runs yet. Runs synced from a watch show their pace here.") and hide the More row on the pace page while the metric has no data. Harden LineChart: with no values render the empty state instead of computing lo/hi from an empty list. Replace the the em dash placeholders in sheets.tsx (lines 321, 379, 393) with "–". | With no timed runs the Easy runs sheet shows an empty state, never NaN:NaN. LineChart renders an empty state for no values. |
| today-top-04 | high | Rename in MorningCard.tsx. | The Plan morning card says "Wake", not "Alarm". |
| a11y-03 | medium | In morningcard.css let chips and timeline labels wrap; switch the timeline labels to a 2 x 2 grid when narrow. | At 135% and 200% the morning card labels wrap or move to a 2 x 2 grid with no overlap. |
| a11y-06 | medium | Pills on --accent-soft use #b23a09; warn-coloured words use var(--warn-text). | Today pills and warn-coloured words in plantop.css, plan.css and progress.css measure 4.5:1 or more. |
| a11y-13 | medium | In Month put the type's initial in the cell or vary the bar pattern, add a one-line key under the grid, and add per-day words to the week's accessible name. | Month view bars differ by pattern or initial, and a one-line key sits under the grid. |
| copy-legal-20 | medium | Apply the glossary to this stream's strings. | Strings in features/plan and progress follow the glossary (done with plan-19). |
| gap-qua-07 | medium | Raise the small styles to at least 0.6875rem. | No text under 11 px in morningcard.css, plan.css, progress.css at default size. |
| gap-qua-18 | medium | Add the Progress skeleton. | Progress shows a skeleton (hero card and four tiles) while loading. |
| gap-qua-19 | medium | Name the waits in HeroChart and PlanBuilder; Stop cancels the draft (with plan-17). | Waits say what is happening ("Reading your weeks", "Writing your plan"); the plan draft has a working Stop. |
| gap-qua-40 | medium | Start each aria-label in features/plan with the visible words. | Plan control names start with the printed text. |
| gap-rev-03 | medium | Reword the two lines in progress/metrics.ts. | The two metric lines read as training terms ("often goes with fatigue or a hard block"), with no illness claim. |
| plan-08 | medium | Use the month queries' error state from useLog (features/log is owned by the lists stream: read isError through the existing hook result, do not edit useLog). | When a month fails to load, Plan shows "Couldn't load this week." with Retry instead of blank cards. |
| plan-09 | medium | When the view switches while the pane's header is below the fold, scroll it to just under the nav bar. Consider a compact morning card on Plan (one line with the next stop and 'Schedule'), since the full card has its own page, so the week header and two or three days show on open. | After switching Week / Month the pane header sits just under the nav bar. |
| plan-10 | medium | Add visible actions to the summary sheet (a secondary row: 'New plan' and 'All plans'). When the shown plan has ended, make the card say 'Plan ended Oct 25. Build the next one' and open the builder prefilled (fromEndingBlock) on tap. | The plan summary sheet has visible "New plan" and "All plans" actions. An ended plan's card reads "Plan ended Oct 25. Build the next one". |
| plan-11 | medium | Open the plans list as a sheet from Plan (PlansPanel renders standalone). Leave the Settings entry alone. | "All plans" opened from Plan closes back to Plan. |
| plan-12 | medium | Let the header arrows work while the pager moves: handle their press before the pager's catch, or queue the step and run it when the slide ends. | Five quick taps on a week arrow move five weeks. |
| plan-13 | medium | Put the pill on the caps row (kind at the left, pill at the right) so the name and the sub line get the full width, and allow the name two lines (`-webkit-line-clamp: 2`). | Today's session card shows the full name on up to two lines; the status pill sits on the caps row. |
| plan-15 | medium | For the pill, show the session kind word ('Strength', 'Intervals') when the name does not fit rather than an ellipsis. Let the foot line wrap, or shorten it under 360 px. | The morning card shows the kind word when the name does not fit; its foot line wraps at 320. |
| plan-17 | medium | Track a request id and drop late responses. Send the file through CapacitorHttp with FormData. | On iPhone, Stop cancels a Paste, Describe or Revise draft at once, and a late response is ignored. A PDF and a camera photo upload through the native HTTP path. |
| plan-19 | medium | Use 'plan' everywhere a user sees it ('New plan', 'Write my next plan'). Empty card: 'No plan / Build one in a minute'. Rename 'Its goals' to 'By the numbers'. Say 'Starts Wednesday. Week 1 is Nov 16' for a mid-week start, and 'Warm-up week' instead of 'Lead-in'. Drop the floor sentence or explain it in one line. Neutral placeholders: 'Move every long run to Sunday. Make next week lighter.' | The screens say "plan" everywhere; "Warm-up week" replaces "Lead-in"; "Its goals" reads "By the numbers". |
| plan-29 | medium | Use the server's answer in PlanBuilder and Blocks. | After a replace or a revise, All plans shows one plan for the range. |
| progress-04 | medium | Return change: null when first.e1rm is 0 (the caps label then falls back to "e1RM"). For weight 0 show reps instead of an e1RM ("8 reps", "Bodyweight × 8") in LiftsSheet, LiftSheet and LiftDaySheet, and trend on best reps. Add a unit test for the 0-weight case in data.test.ts. | A bodyweight lift shows reps ("Bodyweight x 8"), never "-NAN%". Unit test for weight 0. |
| progress-05 | medium | Change the pace empty word to "No timed runs yet" and, when Strava is offered, add a "Connect a source" button to /settings/connections on the pace page. When no timed-run source is offered (features.strava false and no Health workouts feed) drop Run pace from CARD_IDS. Make the Strava mention in the mileage "How it's worked out" text conditional on features.strava. | The pace tile reads "No timed runs yet", and Run pace is dropped from the tiles when no timed-run source is offered. |
| progress-06 | medium | Say what each number is on the tile: unit "mi, 7 days" / "lb, 7 days" (or labels "7-day miles", "7-day volume"), and change the section meta to "30-day trend" so it describes the sparkline only. | Tiles say what each number is ("mi, 7 days"); the section meta reads "30-day trend". |
| progress-07 | medium | For a past week with no sessions and no runs show a plain empty state ("Nothing planned or logged this week.") and make weeks before the first week with data untappable on the chart (clamp indexAt to >= first). For a past week with a plan always show the Miles and Runs stamps, zeros included ("0 mi of 18.8 planned", "0 of 4 runs"). Rewrite the lines in plain words: "1 of 3 sessions done. ... | A past week with nothing shows "Nothing planned or logged this week."; weeks before the first data are not tappable. |
| progress-08 | medium | Read isError and refetch from the existing useLog result; if the hook does not expose them, wrap the month queries in a feature-local hook. | When months fail to load, the hero shows "Couldn't load your progress." with Try again. |
| progress-09 | medium | Add small section labels inside the list ("This week", "Last week", then "October", "September"), or put the month in the chip for rows outside the current month ("OCT 29"). Add "Show less" once expanded and reset to 4 weeks when the tab is left. | The strength list has section labels and "Show less". |
| progress-10 | medium | Fix .pl-ax and the Missed pill in hero.css. | Chart axis labels in hero.css use --ink-3 at 0.75rem; the Missed pill measures 4.5:1. |
| progress-12 | medium | Give LiftDaySheet the same set rows as the session sheet. Moving sets with a moved session waits (noted in Deferred). | A "Lifted" day sheet lets the person delete a set and add a set. |
| progress-13 | medium | Until there are at least two weeks with data, replace the plot with a simple this-week progress bar (done of planned) and one line: "Your weeks draw here as you go." Hide the legend when no line is drawn. On an account with no data collapse Trends into one card ("Trends appear after your first week") instead of four empty tiles. Swap the bars ghost for a curve ghost and change the Strength line to "No lifts yet. ... | A new account sees a this-week progress bar and "Your weeks draw here as you go." instead of a one-point chart; no legend when no line is drawn. |
| settings-18 | medium | Gate Strava buttons and copy on STRAVA_BUILT. | With STRAVA_BUILT false Progress and Plan show no "Connect Strava" button or Strava wording. |
| copy-legal-26 | low | Replace the em dash placeholders. | progress/sheets.tsx uses the en dash as the empty mark. |
| gap-qua-04 | low | Widen .pl-step to 44. | Plan week arrows have a 44 x 44 hit area (with plan-22). |
| gap-qua-05 | low | Covered by plan-22. | Plan's week arrows are 44 wide with an 8 px gap. |
| gap-qua-20 | low | Above the tiles on an account with no finished sessions, one card: "Your first week shows here after your first run." with buttons "Open this week's plan" and, when available, "Connect Strava". Hide the Health block until a source is connected. | A new account sees one card above the tiles: "Your first week shows here after your first run." with "Open this week's plan". The Health block is hidden until Apple Health is connected. |
| perf-15 | low | Use a midday-safe instant relative to the local zone in the test (build the ISO string from a local Date), or set TZ=UTC in the Vitest config (test.env) and add one explicit test that pins another zone. | topWords.test.ts passes under TZ=Pacific/Auckland and TZ=UTC. |
| plan-14 | low | Below 360 px stack the two tiles in one column, or shrink the stepper buttons, so the input keeps at least 44 px. | At 320 the builder's stepper values are whole ("12"). |
| plan-16 | low | On mount, scroll the conflict row into view above the dock (`scrollIntoView({ block: 'nearest' })` with a scroll-margin-bottom of the dock height). | The two-hard-days question scrolls into view above the dock. |
| plan-18 | low | Fine print that follows the switch: 'Your file or text is sent to Claude, made by Anthropic, to write the plan. Nothing is saved until you check it.' plus one line about recent runs only when consent is on. Map SDK errors in draftPlan to plain messages ('The assistant is busy. Try again in a minute.'). | The AI plan form's fine print follows the consent switch and names Claude, made by Anthropic. |
| plan-20 | low | Reuse the week header's pill in the month header (previous month, Today when away, next month). Add a one-line key under the grid (Easy, Long, Hard, Strength, Cross) with the same tone dots. | Month view has previous, Today and next controls. (The key is in a11y-13.) |
| plan-22 | low | Widen the arrows to 44 (the pill has room) or add a gap between them. | The week arrows are 44 wide with a gap. |
| plan-23 | low | Darken the pill text one step (for example #B23A0A) or lighten the pill background until it reaches 4.5:1. | The Today pill text measures 4.5:1 or more. |
| plan-24 | low | Add `alive.current = true;` at the top of the effect. | On the dev build the builder sheet closes after saving. |
| plan-26 | low | Shorten the placeholder to one line ('Optional. Anything worth knowing.'). Shorten the verb to 'Replace 48 sessions' with the date in the note above it. Set the week line's inset to 0. Give empty rows the session row height. Format whole miles without '.0'. Clamp typed values to the min and max. | Placeholder on one line; "Replace 48 sessions" on one line; whole miles without ".0". |
| progress-14 | low | Label the tile "Lowest" for Resting HR and keep "Fastest" for pace (a bestLabel per variant). "About resting HR". Pluralise days. Use "Last 3 months" / "Last 12 months" for the span title. Drive the health eyebrow from the real connection state and write one empty line per metric. | Metric page copy reads as in the finding ("Lowest" for Resting HR, "Last 3 months"). |
| progress-15 | low | Give .ph-side a min-width that fits the widest caption (about 104 px; smaller in the narrow container query) and keep the text right aligned. | The percentage box keeps its width while scrubbing. |
| progress-16 | low | One min-height for the trend tiles and one for the vital tiles and the slot so rows match. Shorten the learning status to one line ("Learning 1/14"). Show the same small arrow on the Health tiles and keep it at 320. | Trend tiles share one min-height; every tile shows the same "opens a page" cue. |
| progress-17 | low | Fix in metric.css and MetricPage; override in the feature CSS rather than editing ui/charts. | At 320 the metric page labels are whole; range keys are 44 px wide. |
| progress-18 | low | Treat a release as a tap only if the scrub never activated for touch: quick = (pointerType === 'mouse' // !p.active) && ..., or cut TAP_MS to HOLD_MS for touch. | Press, read and let go within 450 ms does not open the week sheet on touch. |
| progress-19 | low | Render the words as visually hidden text inside the status element (a .sr-only span with readWords) and keep the visible parts aria-hidden. Name the switch "Running or strength". | VoiceOver reads the headline words once; the switch is named "Running or strength". |
| progress-20 | low | Delete the unused sheets, helpers, their tests and the dead CSS blocks; update the two header comments. Run the type check and the Progress tests after. feed.ts keeps agoWords and snapSource, which are in use. | Unused sheets, helpers, tests and dead CSS from the redesign are deleted; typecheck and Progress tests pass. |
| progress-21 | low | Move the query into the sheet body (call useAllLifts inside a small wrapper component that renders LiftsSheet) so it re-renders when data lands, show a short loading state while lifts.isPending, and an error line with Try again on failure. Do the same for the easy pace sheet. | The Lifts sheet shows a loading state, then the lifts, when opened before history loads. |
| progress-22 | low | Name the tile for what it counts ("Habits") or lead with the Plan variant when the account has a plan and no habit history. Give percent variants a fixed 0 to 100 axis (steps 50, 100) and hide the average pill when the average is 0. | The Consistency tile is named for what it counts; percent charts use a fixed 0 to 100 axis. |
| today-top-13 | low | Fix is/are by count in plan/Held.tsx. | The hold note reads "Today's 2 sessions are on hold while you're sick." |

### ws-09-assistant: AI assistant sheet

Owns:

- `apps/web/src/features/assistant/**`

Notes: Builds its own first-use permission step. Listens for the window event logbook:assistant-reset.

Contracts: C1 consent, C2 local account wipe, C6 shared constants, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| auth-03 | blocker | On first open with consent.at null, show a small Allow / Not now step built inside features/assistant (what is sent, link to LEGAL.privacy) and store the answer through the consent endpoint before the first ask. Do not import from features/auth. | An account whose consent.at is null sees the permission step the first time the assistant opens, before anything is sent. This covers people who sign in rather than sign up, and the review demo account. |
| shell-02 | blocker | Sanitise saved chats on load in store.ts and handle logbook:assistant-reset. | A saved chat with a malformed turn loads without a crash (bad turns are dropped) and "Start a new chat" always works. |
| a11y-02 | high | Convert px font sizes and line heights in assistant.css to the rem tokens. | check-styles finds no px font-size in features/assistant. |
| assistant-06 | high | Send only the last 20 turns and trim each assistant turn to the server cap before sending. | A 61-turn chat and a chat holding a 30,000 character answer both still get a reply. |
| copy-legal-08 | high | Show DISCLAIMER (lib/copy.ts) under the AI label in the empty state. | The assistant empty state shows the DISCLAIMER line. |
| copy-legal-09 | high | Add the persistent AI_LABEL line (lib/copy.ts). | The sheet shows "AI assistant, powered by Claude. It can be wrong. Check anything important." at all times in the header or under the greeting. |
| assistant-07 | medium | On thumbs down open a small sheet: reasons (Wrong, Unsafe or harmful, Not what I asked, Other), an optional note, and Report, which opens mail to SUPPORT_EMAIL (lib/siteLinks.ts) with the answer text. Add "Report a problem" to the sheet menu. Storing feedback on the server waits (see Deferred). | Thumbs down opens a sheet with reasons and a Report button that opens a prefilled mail to the support address. |
| assistant-11 | medium | Map by status and code in failureText to plain lines; 401 closes the sheet and shows sign in. | No raw server or validation string can reach the error card: unit test over failureText for 413, 422, 429, 401, 5xx and job_gone. |
| assistant-12 | medium | Treat _text_ as italic only when the opening underscore follows the start, a space or punctuation and the closing one is followed by the end, a space or punctuation: (?&lt;![\w])_[^_\s](?:[^_\n]\*?[^_\s])?_(?![\w]). Apply the same rule in plainOf. Add tests for snake_case, file names and URLs. | Rich tests: snake_case, file_name.ts and ids keep their underscores; _word_ still renders italic. |
| assistant-13 | medium | Hide Ask again when the last answer carries an applied proposal. Before an edit that would remove an applied proposal, confirm ("This removes the answers after it. Changes you applied stay."). Confirm chat deletion or show an Undo toast. | Ask again is hidden on an answer with an applied proposal. Edit and Delete chat ask first when an applied proposal would be removed. |
| assistant-14 | medium | Read useConsent() in the sheet. When training is off: change the sub line to "The assistant can't see your training data. It answers in general terms." with a link "Change in Settings, Privacy", and hide the four plan starters. | With training consent off the sheet says "The assistant can't see your training data. It answers in general terms.", links to Settings, Privacy, and hides the four plan starters. |
| assistant-15 | medium | Show the chip only where it changes what the assistant reads (Today's day, Plan's week or month). On other tabs drop it or add one line in the empty state ("The assistant sees your plan, goals and to-dos. It can't read your journal."). Label another day "Thu, Nov 12" without the tab name. Make starters per tab. Let a removed chip be restored. | The context chip shows only on Today and Plan; another day reads "Thu, Nov 12". Other tabs show one line on what the assistant can see. |
| assistant-16 | medium | Persist {chatId, jobId, startedAt} in sessionStorage and resume polling on load; if the job is gone, add the error turn with Retry. Show a "No answer. Retry" row whenever the last turn is the user's and nothing is running. Add a short "Stopped" row on stop with no words. Call stopAssistant on too_slow. Show "Waiting for a connection" after two failed looks. When busy in another chat, show "Answering in another chat" with a link. | Reload during an answer: the answer resumes or a "No answer. Retry" row shows. Stop with no words shows "Stopped". |
| assistant-18 | medium | In Proposal.tsx build a count line from the ops and add Show all so no change is hidden before Apply. | A proposal card with more than 6 changes shows a count line ("12 changes: 6 added, 3 removed, 3 moved") and Show all. |
| assistant-21 | medium | Give each a 44x44 hit area: size Send, attach and the header buttons at 44, or add the ::after inset used for .as-ctx-pill-x. Space the answer actions on a 44 px pitch. | Send, attach, header buttons and answer actions each measure 44 x 44 or more, on a 44 px pitch. |
| assistant-22 | medium | Make .as-thread role="log" aria-live="polite" aria-relevant="additions", keeping the per-word spans out by announcing only the final turn, and announce "Changes ready to review" when a proposal arrives. Use --ink-3 rgb(87,113,138) or darker for the footnote, the Stopped label and the placeholder. | VoiceOver reads the finished answer once and "Changes ready to review" for a proposal. The footnote measures 4.5:1 or more. |
| copy-legal-16 | medium | Correct the History footnote. | History says "Chats are kept on this phone. What you send is processed by Claude." |
| copy-legal-20 | medium | Apply the glossary to this stream's strings. | Assistant strings say "the assistant"; "Claude, by Anthropic" only where the provider is named. |
| gap-qua-28 | medium | Persist the composer text per chat in localStorage under a logbook. key. | Unsent composer text survives closing the sheet and a reload, and clears on send. |
| assistant-10 | low | Treat available:false or code claude_not_configured as an error turn (Retry, no actions, not saved). | With features.claude false, or on that code, the sheet shows an error turn with Retry and saves nothing as an answer. |
| assistant-23 | low | Set the chat title in the sans face at 17 px and weight 600 (as History rows do) and let it use the space up to the buttons, or drop it from the header and show it only in History. | The chat title uses the room up to the buttons at 320 and 390. |
| assistant-24 | low | Add flex: none to the icon in both chips and min-width: 0 to the name span. | A PDF chip with a 60 character name keeps its icon at full size. |
| assistant-25 | low | Wrap the title text in a span with overflow:hidden, text-overflow:ellipsis and min-width:0. In previewOf drop separator rows and pipes (reuse plainOf). Remove the footnote when the list is empty. | Long History titles end in an ellipsis; a table answer previews as words; the empty state says its line once. |
| assistant-29 | low | Delete the AskBar component and its CSS. Keep useOpenAssistant exported from the same module path the dock imports today. | AskBar.tsx and its CSS are gone; useOpenAssistant lives in its own file inside features/assistant; the app builds. |
| assistant-30 | low | Cap what is stored by size (drop reasoning text and photo previews from older chats first, then the oldest chats) and retry the save. If it still fails, show one toast: "This chat can't be saved on this phone. Delete old chats in History." | When storage is full the chat store trims old data and retries; if it still fails one toast says so. |
| assistant-31 | low | Ignore Enter when e.nativeEvent.isComposing is true or e.keyCode is 229. | Enter while an IME is composing does not send. |
| gap-ios-19 | low | Drop the per-word tick. Keep one light tick when the answer starts and the existing success or error haptic when it ends. | One light tick when the answer starts, one at the end; none per word. |
| gap-qua-05 | low | Covered by assistant-21. | Answer actions sit 8 px apart with no overlapping targets. |
| perf-10 | low | Stop the idle poll in AssistantSheet.tsx. | The assistant's 400 ms poll runs only while a job is running and the sheet is visible. |

### ws-10-settings: Settings, privacy page, data sources, account

Owns:

- `apps/web/src/features/settings/**`
- `apps/web/src/features/health/**`

Notes: Owns the Privacy page (three consent switches), the About group, export, account and Apple Health screens.

Contracts: C1 consent, C3 account endpoints, C6 shared constants, C8 glossary.

| Id | Severity | Change | Done when |
|---|---|---|---|
| auth-03 | blocker | Rebuild the Privacy page on the Contract 1 shape: three switches, each with one plain line on what is sent. | Settings, Privacy shows three switches (training data, Remember when, daily read) that read and write the same consent record, and "Not asked" when consent.at is null. |
| copy-legal-01 | blocker | Add the rows and the connect-sheet link using LEGAL from lib/siteLinks.ts. | Settings, Privacy has rows for Privacy Policy and Consumer health data privacy policy; the Apple Health connect sheet links to the policy. |
| copy-legal-02 | blocker | Add the About group using LEGAL and SUPPORT from lib/siteLinks.ts. | Settings has an About group: Help and contact, Terms of Use, Privacy Policy, Acknowledgements. Each opens. |
| copy-legal-06 | blocker | Covered by the three-switch Privacy page in auth-03. | Settings, Privacy carries the two new switches (built in auth-03, settings part). |
| copy-legal-30 | blocker | Rewrite the Apple Health primer and connect sheet in AppleHealth.tsx to describe only what 1.0 shows. | The connect sheet lists exactly sleep, heart rate variability and resting heart rate, says they are saved to the Logbook account on Logbook's server, and links to the policy. No "recovery", "strain" or "sleep score" anywhere in Settings. |
| gap-leg-06 | blocker | Reword the Apple Health line and the Privacy page headline. | AppleHealth.tsx reads "Logbook only reads. It never writes to Apple Health and never sells what it reads." The Privacy page carries the same headline as sign-up. |
| gap-rev-08 | blocker | Drop the build line from the footer and remove the Units row until kilometres exist. | The release Settings footer shows the version only. The Units row is gone. No placeholder copy remains in Settings. |
| gap-sub-47 | blocker | Row added with the About group (copy-legal-02). | Settings, About, "Help and contact" opens the support page and offers a mailto link. |
| ios-03 | blocker | Covered by copy-legal-30, settings part. | The primer promises only sleep, HRV and resting heart rate on Progress and says readings are saved to the Logbook account. |
| sec-04 | blocker | Add the sheet calling POST /me/password. | Settings, Account has "Change password" (current, new, confirm) with plain errors. |
| settings-03 | blocker | On native write the JSON with @capacitor/filesystem to the cache directory and open @capacitor/share. Keep the download on the web. | On iPhone, Export writes the file and opens the share sheet; the row says "Shared" only when the share resolves and "Export cancelled" on cancel. In the delete sheet the export shows progress and its result before the person continues. |
| a11y-02 | high | Convert px font sizes and line heights in this stream's CSS to the rem tokens. | check-styles finds no px font-size in features/settings and health. |
| copy-legal-08 | high | Show DISCLAIMER (lib/copy.ts) in AppleHealth.tsx and the About group. | The Apple Health connect sheet and Settings, About show the DISCLAIMER line. |
| copy-legal-14 | high | Give the row the same wrapping classes as the switch row (title and sub wrap, no clamp), move the "Not asked / On / Off" value under the title or shorten it to a chip, and shorten the title to "Health summary for the assistant". Let the Settings root sub wrap too. Verify at 320 with the largest Dynamic Type size. | At 320 with the largest text size no Privacy row title or Settings root sub line is cut. |
| gap-leg-08 | high | Add the row and the processors line. | Settings, Privacy has "Privacy requests" (opens mail to the support address, states the 45 day answer time) and names the processors: Anthropic, Fly.io. |
| gap-leg-57 | high | Covered by the lede in copy-legal-17. | Delete step one says what happens to copies (with copy-legal-17). |
| gap-rev-11 | high | Covered by settings-12 and settings-18. Gate every Apple Health surface in Settings on HEALTH_BUILT (lib/features.ts) so the feature can be held out at build time. | No row in Settings points at a feature that does not exist (Coach access is hidden, see settings-12). With HEALTH_BUILT false no Apple Health row, card or wording shows in Settings. |
| settings-06 | high | Set bottom to calc(var(--chrome-h) + env(safe-area-inset-bottom) + 12px) (or whatever token the Ask bar plus tab bar height uses) so the card rests above the Ask bar, and scroll the changed control into view if the card would cover it. Re-check at 320 and with the keyboard closed. | The Rebuild card rests above the ask bar and tab bar; its buttons can be tapped without scrolling to the bottom. |
| settings-22 | high | Add the warnings in TrainingPages.tsx. | Rebuild warns before a change that raises weekly miles by more than 30% and shows "Keep at least one run day". |
| copy-legal-17 | medium | Use the lede from the finding; take the backup days from the owner's Fly snapshot setting (default 5). | The delete sheet lede lists what is removed, says it cannot be undone, and adds "Backups clear within 5 days. Anything sent to Claude is cleared by Anthropic within 30 days." |
| copy-legal-19 | medium | Row added with the About group (copy-legal-02). | Settings, About, Acknowledgements opens the page. |
| copy-legal-20 | medium | Apply the glossary to this stream's strings. | Settings strings follow the glossary; no "coach". |
| copy-legal-21 | medium | Remove the build line from release builds in version.ts and SettingsView; fix the self-hosting wording in DataSources and SectionPages. | A release build shows the version only, no commit or build time. No string says "this Logbook" or "this server". Export wording reads "A Logbook export file." |
| copy-legal-23 | medium | Fix the old habit wording in HabitsPage.tsx and SettingsView.tsx. | HabitsPage reads "Habits are the tiles on Today. Start with one." |
| gap-leg-07 | medium | Row added with copy-legal-01, settings part. | Settings, Privacy has a separate row "Consumer health data privacy policy". |
| gap-qua-10 | medium | Use #7c90a5 (the new --ink-faint) or a 1.5 px outline for the off track in switch.css. | The switch off track measures 3:1 or more on white. |
| gap-qua-19 | medium | Name the wait in AppleHealth.tsx. | The Apple Health import says "Reading Apple Health" with the month. |
| gap-qua-40 | medium | Fix labels in settings/parts.tsx. | Settings row names start with the printed text ("Sam. Your profile"). |
| sec-18 | medium | Word the row to match the export. | The export row says what the file holds and no longer claims more than it has. |
| settings-12 | medium | Hide the rows and the sheet. | Both "Coach access" rows and the health consent sheet are hidden until a health summary for the assistant exists. No copy says a health summary is sent. |
| settings-14 | medium | Flush instead of cancel on unmount: keep the latest pace in a ref and, if a timer is pending in the cleanup, clear it and call morning.settings.mutate with that value. | Change easy pace and leave Training at once: the change is saved. |
| settings-15 | medium | Map the error in SectionPages. | A 413 on import shows "That file is too big." |
| settings-16 | medium | Render the "Add a habit" card (input plus starters) in the empty state too, under the sentence. | The empty Habits page has an "Add a habit" field as well as the starter chips. |
| settings-18 | medium | Hide the Strava group and root row unless STRAVA_BUILT and features.strava are both true. | With STRAVA_BUILT false (the 1.0 build) Settings shows no Strava row, group or wording at all. |
| settings-21 | medium | When there is no current or upcoming block, show the card permanently with the title "Build my plan from next week" and one primary button, use the "none" footnote, and show the "Build a plan" row on the root. | With no plan, Training shows "Build my plan from next week" with one primary button, and the root has a "Build a plan" row. |
| copy-legal-25 | low | Change "Kilometres" to "Kilometers" (the row itself goes with gap-rev-08). | No British spellings in features/settings. |
| copy-legal-27 | low | Replace the home-made icon tile and the ring art in AppleHealth.tsx, SettingsView.tsx and features/health/HealthParts.tsx. | The Apple Health row and connect sheet use a plain heart glyph with no app-icon tile (or Apple's official icon once the owner supplies it). The connect art is not three nested rings. |
| copy-legal-32 | low | Use a path that holds on every supported version: "In the Health app, tap your picture, then Apps, then Logbook." or "Settings › Apps › Health › Data Access & Devices › Logbook" if the minimum iOS is 18. Show it as a line in the disconnect sheet instead of a toast. | The disconnect sheet shows the path "In the Health app, tap your picture, then Apps, then Logbook." as a line, not a toast. |
| gap-ios-20 | low | Word it by what arrived: use the server span ("Since Aug 2026") in the done state, and say "as much history as you shared, up to a year" in the primer. Optionally read earliestAuthorizedSampleDate(for:) on iOS 27 and add "Sharing more history sharpens your normal ranges." | The import copy says "as much history as you shared, up to a year" and the done state uses the real span from the server. |
| gap-qua-57 | low | Add the row, hidden until the id exists. | With VITE_APP_STORE_ID set, Settings shows "Rate Logbook" and opens the write-review URL; with it unset the row is hidden. |
| gap-rev-29 | low | Say "the Apple Health app" in both places, and "Nothing in Apple Health changes." for the third. | Both strings say "the Apple Health app"; the third reads "Nothing in Apple Health changes." |
| ios-21 | low | Give the tile 'flex: 0 0 38px' in .ahc-unlocks li. Pin the two buttons in a sticky footer of the sheet or cut the hero so the button is visible at 667 pt tall. Make .ah-device-btn 44 px tall (or pad its hit area to 44). | The primer's Connect button is visible at 667 pt tall; icon tiles keep 38 px; the Data sources Connect button is 44 px tall. |
| settings-17 | low | Below about 360 px, or when the text column is under 140 px, stack: icon, name and status on the first line and the Connect/Sync button full width under it; put the Coach access value under its title. A container query on the card does it. | At 320 and at large text the Apple Health card stacks: name and status, then the button full width. |
| settings-20 | low | Remove the row; it is a demo tool. | The "Replay setup" row is removed for launch. |
| settings-26 | low | Show "Nothing new" only for a valid version 2 file and reword the row. | The import row reads "A Logbook export file (JSON)"; "Nothing new" shows only for a valid file. |
| settings-27 | low | On the Account page let the email wrap (white-space: normal; overflow-wrap: anywhere). On You put the email on its own second line under the label. | A 60 character email wraps on Account and You. |
| settings-28 | low | Habits: show "7 habits" as the title and the first names as a wrapping second line. Plans: put the plan name on a second line under "Plans". Shorten the Privacy sub to "What the assistant may read." | Root rows show "7 habits" with names on a second line, and the plan name under "Plans". |
| settings-29 | low | Open a small confirm sheet ("Sign out of &lt;email>?" with Sign out / Stay signed in) and mention unsent changes when the outbox is not empty. Keep one Sign out, on the Account page, or both with the same confirm. | Sign out opens a confirm sheet that names the email and mentions unsent changes when there are any. |
| settings-30 | low | Toast only "Apple Health disconnected." and keep the revoke path as the card's footnote while not connected, or as the last line of the disconnect sheet. Check the path against the current iOS (on iOS 18 the Health entry sits under Settings > Apps). | Disconnect toasts only "Apple Health disconnected."; the revoke path stays on the card. |
| settings-31 | low | Run the duplicate check in the rename save (show the note under the field and keep the old name). Pass the current name to the archive toast. Cap live habits (for example 12) with "Archive one to add another." | Renaming a habit to an existing name is refused with a note; live habits cap at 12 with "Archive one to add another." |
| settings-32 | low | In commit() always setV(next). Give the field an affordance (a pencil icon or a faint underline, select-all on focus) or open a small "Your name" sheet on tap like the habit rename. | A spaces-only name resets to the saved name; the field shows it can be edited. |
| settings-33 | low | Give the small buttons a 44 x 44 hit area (min-height 44 or an ::after inset of -5 px) without changing how they look; let the day row use the full card width at 320. | Small buttons across Settings have a 44 x 44 hit area. |
| settings-34 | low | Add a Notifications row to the App group on iOS: a switch "Morning goal reminder" bound to the same reminders module, with "Turned off in iOS Settings" and a link to the app's system settings when permission is denied. | On iOS, Settings has a "Morning goal reminder" switch bound to the reminders module, with a link to system settings when permission is denied. |

### ws-11-ios-release: iOS project, Health plugin, release scripts, CI, legal pages, launch docs

Owns:

- `apps/web/ios/**`
- `packages/capacitor-health/**`
- `packages/e2e/**`
- `scripts/**`
- `.github/**`
- `apps/web/public/legal/**`
- `docs/launch/**` (all files except audit.md and plan.md)
- `docs/brand.md`
- `apps/web/assets/**`
- `package.json` (repo root)

Notes: Swift and Xcode project edits are written without a Mac. Keep them small and plain; the owner compiles and runs the device pass. Also owns the static legal and support pages (drafts for the owner to approve) and the launch docs.

Contracts: C6 shared constants (legal page paths).

| Id | Severity | Change | Done when |
|---|---|---|---|
| copy-legal-01 | blocker | Draft the privacy policy and the separate consumer health data policy as plain static HTML from the outline in research_notes/App Store launch readiness/legal_privacy.md section 1. The API already serves the web build, so they are public at &lt;origin>/legal/\*.html. | apps/web/public/legal/privacy.html and health-privacy.html exist, load signed out at /legal/privacy.html and /legal/health-privacy.html, and name every data flow in the app. Marked DRAFT until the owner approves the text. |
| copy-legal-02 | blocker | Draft Terms of Use as static HTML: account, acceptable use, the AI and not-medical-advice terms, minimum age 18, termination, contact. | apps/web/public/legal/terms.html exists, states the minimum age (18) and loads signed out. Marked DRAFT until the owner approves. |
| copy-legal-30 | blocker | Rewrite the two purpose strings in Info.plist to match what 1.0 does. | NSHealthShareUsageDescription reads "Logbook reads your sleep, heart rate variability and resting heart rate from Apple Health to show them on Progress. Readings are saved to your Logbook account." NSCameraUsageDescription names the assistant and the plan builder. No string says recovery, strain or score. |
| gap-leg-06 | blocker | Write the release check for privacy sentences. | docs/launch/privacy-claims.md lists every privacy sentence in the app beside the Claude call site it describes; the release checklist says to re-read it. |
| gap-rev-08 | blocker | Add the bundle check to the release script. | The release script greps the built bundle for UiGallery and "dev/ui" and fails on a hit. |
| gap-sub-47 | blocker | Draft the support page as static HTML. | apps/web/public/legal/support.html exists with the contact address and short answers (reset password, delete account, disconnect Apple Health, export data) and loads signed out. |
| ios-01 | blocker | Add the entitlements file and the CODE_SIGN_ENTITLEMENTS build setting in both configurations of project.pbxproj; the file must still parse. The owner then enables HealthKit on the App ID and confirms in Xcode. | apps/web/ios/App/App/App.entitlements holds com.apple.developer.healthkit = true; CODE_SIGN_ENTITLEMENTS points at it in Debug and Release; no healthkit entry in UIRequiredDeviceCapabilities. |
| ios-02 | blocker | Add the manifest and its pbxproj entries: tracking false; file timestamp reason C617.1; collected data types EmailAddress, Name, UserID, OtherUserContent, PhotosorVideos, Fitness, Health (linked, purpose AppFunctionality) and CrashData for the client error reports (not linked); none for tracking. Add the file reference to the App target by following the pattern of an existing resource; project.pbxproj must still parse. | apps/web/ios/App/App/PrivacyInfo.xcprivacy is in the App target's resources with the contents listed in the finding, Health included. |
| ios-03 | blocker | Cut readTypes and the sync payloads in HealthReader.swift and HealthSync.swift to the three types; remove workout routes, workouts, heart rate buckets, steps, energy and the rest until a screen shows them; drop sourceName. | HealthReader requests exactly three read types: sleepAnalysis, heartRateVariabilitySDNN, restingHeartRate. The engine uploads no other type and no sourceName. |
| journal-02 | blocker | Add the key. The owner tests Save Image on a phone. | Info.plist has NSPhotoLibraryAddUsageDescription "Save the cards you share to your photo library." |
| gap-rev-11 | high | Draft the review notes and the decisions file for the owner. | docs/launch/review-notes.md is a ready draft of the App Review notes: why an account is needed, the AI flows and where the permission step is, Apple Health (read only, three types, where to connect), where Delete account is, that Strava is not in this build, and the demo account line. docs/launch/decisions.md records the launch scope. |
| ios-04 | high | Add both guards in HealthSync.swift and HealthStorage.swift. | On a 401 the engine wipes its queue. On first launch after install a leftover Keychain token is deleted when state.json is missing. |
| ios-06 | high | Set the device family to iPhone and delete the iPad orientation block. | TARGETED_DEVICE_FAMILY = 1 in both configurations; no UISupportedInterfaceOrientations\~ipad block. |
| copy-legal-19 | medium | Add scripts/notices.mjs (reads production dependency licences from node_modules) and commit its output page. | apps/web/public/legal/acknowledgements.html lists the licences of the web and native dependencies, generated by scripts/notices.mjs. |
| gap-ios-10 | medium | Run npx cap sync ios on the release commit, commit the regenerated Package.swift and Package.resolved, and add the check to the release script. | apps/web/ios/App/CapApp-SPM/Package.swift lists every Capacitor plugin in apps/web/package.json; Package.resolved is committed; the release script fails if they differ. |
| gap-qua-03 | medium | Raise the deployment target to iOS 17.0 and write the decision down. | IPHONEOS_DEPLOYMENT_TARGET is 17.0 in all four pbxproj places and both Package.swift files; docs/launch/decisions.md records it. |
| gap-qua-36 | medium | Add docs/launch/common-tasks.md (the twelve groups, one line per task) and docs/launch/qa-matrix.md (devices and iOS versions, install state, network, interrupted flows, permissions, data edge cases, device state, accessibility settings, regions, review readiness) with a results table per build. The owner runs it on TestFlight builds. | docs/launch/common-tasks.md and docs/launch/qa-matrix.md exist with owners and pass/fail columns. |
| gap-qua-44 | medium | Add the scan in a new workspace package packages/e2e so no app package.json changes. | packages/e2e holds a Playwright plus axe-core script that visits each route and main sheet at 390 and 320 and fails on the listed rules; CI runs it. |
| gap-qua-65 | medium | Write the region decisions down. | docs/launch/decisions.md states: weeks start on Monday, miles and pounds only, United States storefront for 1.0. Swift day keys use the Gregorian calendar (ios-10). |
| ios-07 | medium | Change the key to Light and update the doc. | Info.plist UIUserInterfaceStyle is Light; docs/brand.md item 14 says so. |
| ios-09 | medium | Apply the cancellation order from the finding in HealthSync.swift. | disconnect() cancels and awaits a running sync before it wipes; run() saves nothing after cancellation. |
| ios-10 | medium | Add the one helper and use it everywhere a day or month is cut. | Every day key in the Swift engine is built with Calendar(identifier: .gregorian) in the current time zone. |
| ios-13 | medium | Add scripts/ios-release.sh and the root package.json script. | pnpm ios:release requires a clean tree at a tag, sets MARKETING_VERSION 1.0.0 and a rising build number, builds, syncs and runs the release checks (including: VITE_SUPPORT_EMAIL is set and is not example.com). scripts/ios-fresh.sh no longer pulls a working branch. |
| ios-14 | medium | Add the check; pass the origin to the plugin at start instead of trusting the saved copy. | The release script fails if VITE_API_ORIGIN is unset or is a fly.dev host. The engine takes the origin from the build on every sync. |
| ios-15 | medium | Add the entitlement, with the host as a build setting the owner fills. | App.entitlements lists com.apple.developer.associated-domains with webcredentials:&lt;api host> from a build setting. |
| perf-14 | medium | Add CI and six end-to-end flows at 390 and 320 in packages/e2e. | .github/workflows/ci.yml runs typecheck, unit tests, build and the Playwright smoke suite (packages/e2e) on every push: sign up through onboarding to Today; habit check and undo; to-do add and reload; journal write and edit; offline add then reconnect; sign out then sign up as another person with empty History. |
| a11y-20 | low | Write the portrait-only decision down in docs/launch/decisions.md and make Info.plist match (done with ios-06). | docs/launch/decisions.md records "portrait only for 1.0". Info.plist lists portrait only and has no iPad orientation block. |
| copy-legal-25 | low | Add the grep to the CI workflow. | CI runs a grep for Colour, Favourite, Kilometre in UI strings and fails on a hit. |
| gap-ios-17 | low | In the release script, read ios/App/App/capacitor.config.json after sync and exit non-zero if server.url, server.cleartext, server.allowNavigation or webContentsDebuggingEnabled is present. | The release script exits non-zero if capacitor.config.json after sync holds server.url, server.cleartext, allowNavigation or webContentsDebuggingEnabled. |
| ios-16 | low | Write init(from:) with decodeIfPresent and defaults, add schemaVersion. | HealthState decodes a file written without newer keys; a damaged file reports .corrupt and is kept. |
| ios-19 | low | Set both in Info.plist. | CFBundleName is Logbook; UIRequiredDeviceCapabilities is arm64. |

## D. Owner tasks

Only the developer can do these. They are in order. Values to type are given where they are known. `<domain>` is the domain you buy in task 4. `<host>` is the address the app talks to, for example `api.<domain>`. Sources name the audit's owner-task ids and findings each step covers.

### Phase 0: decide (this week, before the streams start)

1. **Confirm the launch scope.** Read decisions D1 to D7 above. Say yes or change them. ws-11 writes the result to `docs/launch/decisions.md`. Defaults: Apple Health with three types; Strava off; iPhone only, portrait; iOS 17.0; United States; 18 or older; your own domain. (Sources: own-qua-01, own-qua-02)
2. **Choose the seller.** Either your personal legal name (shown on the store) or an LLC. An LLC needs a D-U-N-S number and an organization enrollment, and should hold the Apple, Anthropic, Fly.io and Strava accounts. Decide before the first upload, together with the bundle id: `com.joshbean.logbook` is permanent after the first upload and carries a personal name. If unsure, ask in an App Review appointment. Use a P.O. box or registered agent for any published address. (Sources: own-02, gap-leg-own-05, gap-rev-own-14)
3. **Book a lawyer's read.** Questions: does Washington's My Health My Data Act or Nevada SB 370 cover an individual developer; other state health data laws (Connecticut, Texas); age assurance duties in Texas, Utah and Louisiana and whether Apple's Declared Age Range API is needed (finding gap-leg-22); state chatbot disclosure laws; a review of the Terms, the privacy policy and the consumer health data policy drafted in task 15. Keep Apple's standard EULA unless the lawyer says otherwise. (Sources: gap-leg-own-07, gap-leg-own-04, own-19)
4. **Buy a domain and point it at the server.** Then: `fly certs add <host> -a josh-logbook`, add the DNS records Fly prints, and set `APP_URL = "https://<host>"` in `fly.toml`. Release builds use `VITE_API_ORIGIN=https://<host>` and `VITE_SITE_ORIGIN=https://<host>`. (Source: finding ios-14)
5. **Create a monitored support address**, for example `support@<domain>`. Release builds use `VITE_SUPPORT_EMAIL=support@<domain>`. Write a short procedure: answer access, withdrawal and deletion requests within 45 days (30 days for Nevada deletion); if you learn a user is under 13, delete the account. (Sources: own-qua-03, gap-leg-own-12, gap-rev-own-01)
6. **Pick a transactional mail provider** for password reset and verification mail (Resend, Postmark or Amazon SES all work). Verify `<domain>` with SPF and DKIM. Then: `fly secrets set MAIL_API_KEY=<key> MAIL_FROM="Logbook <no-reply@<domain>>" -a josh-logbook`. (Source: finding sec-04)

### Phase 1: accounts and server

7. **Apple Developer Program.** Membership active and paid (99 USD a year), two-factor on, Account Holder can sign in to App Store Connect. Accept the Program License Agreement dated October 13, 2026. No Paid Apps Agreement is needed for a free app. (Sources: own-01, own-03)
8. **EU Digital Services Act status.** App Store Connect, Business, Agreements, Compliance: declare non-trader for a free, United States only launch. (Source: own-04)
9. **Fly.io settings.** Run `fly secrets list -a josh-logbook`. Then:
   - `fly secrets unset ATHLETE_CONTEXT -a josh-logbook` (finding plan-28: your own profile must not reach other users' prompts).
   - `fly secrets unset STRAVA_CLIENT_ID STRAVA_CLIENT_SECRET -a josh-logbook` so Strava is off in production (D2). If you keep Strava for your own web use, run it on a separate Fly app.
   - Check `SESSION_SECRET` is set and long.
   - Confirm the `logbook_data` volume is encrypted at rest. Note the snapshot retention (5 days by default) and give that number to ws-10 and ws-11 for the delete sheet and the policy.
   - Extend the volume from 1 GB (`fly volumes extend <volume id> -s 3 -a josh-logbook`) and set a usage alert at 70 percent.
   - Create an object storage bucket with another provider for the nightly backup and set the `BACKUP_*` secrets named in `apps/api/RUNBOOK.md` (finding sec-09). Do one test restore.
   - Turn on two-factor sign-in for Fly, Anthropic, Apple and Strava. Limit who can open the Fly and Anthropic consoles.
   (Source: gap-leg-own-10)
10. **Anthropic.** A production key with enough quota and a monthly spend limit. Optional: ask sales for zero data retention and check the models in use are covered. Do not move personal data to the Files API or batch processing without updating the policy. (Sources: gap-leg-own-11, gap-rev-own-04)
11. **Deploy with sign-up open.** After ws-01 merges: `fly deploy`, then `curl -s https://<host>/api/auth/status` must show sign-up open. Create a throwaway account on production from a phone to prove it. (Source: finding auth-02)
12. **Write a one-page breach runbook.** Contain, assess, who is affected; notify users by email without unreasonable delay and within 60 days; the FTC Health Breach Notification form (at once if 500 or more people, else within 60 days after year end); state attorneys general where required; Strava within 24 hours at legal@strava.com if Strava data is involved; your lawyer's contact. (Source: gap-leg-own-06)
13. **Strava, for later.** Ask Strava developer support in writing whether showing a user their own runs against their own plan, in charts and on share cards, is allowed under API Policy 2.3, 5.4 and 5.5. Check the app's athlete capacity. Keep the API agreement on file. Ask for the capacity review only after the Strava gate items in section E are done. (Sources: gap-leg-own-09, gap-rev-own-16)

### Phase 2: legal text

14. **Fill in the facts the drafts need.** Legal name or entity, a contact address, the support address, the effective date, the snapshot retention days, the minimum age (18). ws-11 leaves these as marked blanks in the drafts.
15. **Approve and publish the four pages.** ws-11 drafts them in `apps/web/public/legal/`. After your edits and the lawyer's read, deploy. They are then public at:
    - Privacy Policy: `https://<host>/legal/privacy.html`
    - Consumer Health Data Privacy Policy: `https://<host>/legal/health-privacy.html`
    - Terms of Use: `https://<host>/legal/terms.html`
    - Support: `https://<host>/legal/support.html`
    The privacy policy must state the Apple Health flow (read on the phone, stored on the Logbook server, never used for ads, never sold, not sent to the AI), name the processors (Anthropic, Fly.io) and say what goes to Claude and when. Open all four signed out on a phone. (Sources: gap-leg-own-01, gap-leg-own-03, own-11, own-ios-15, gap-rev-own-02)

### Phase 3: Xcode and the device pass (needs a Mac)

16. **Set up the build.** Xcode 26 or later with the iOS 26 SDK. On the release commit: `pnpm install`, then `pnpm ios:release` (added by ws-11; it builds, runs `npx cap sync ios` and the release checks). Open the project, select your paid team under Signing and Capabilities, automatic signing. (Sources: own-05, own-ios-02, gap-rev-own-08)
17. **Capabilities.** In Certificates, Identifiers and Profiles, on App ID `com.joshbean.logbook`: enable HealthKit (Clinical Health Records off, Background Delivery off) and Associated Domains. In Xcode confirm the App target shows HealthKit and Associated Domains with `webcredentials:<host>`. If Xcode adds `healthkit` to `UIRequiredDeviceCapabilities`, delete it. Then `fly secrets set APPLE_TEAM_ID=<your team id> -a josh-logbook` so the server serves the app site association file. (Sources: own-06, own-ios-01, own-qua-19)
18. **First compile.** The Swift and project changes were written without a Mac. Build, fix what the compiler reports, change `@UIApplicationMain` to `@main`, accept "Update to recommended settings". Check the target: iPhone only; iOS 17.0; version 1.0.0; a build number higher than any earlier upload; `CFBundleName` Logbook; `PrivacyInfo.xcprivacy` and `App.entitlements` in the App target; `UIUserInterfaceStyle` Light. (Source: finding ios-26)
19. **Decide on crash reporting.** Default for 1.0: Xcode Organizer plus the app's own small error reports to your server (finding gap-qua-69). No third-party SDK. If you add one later, update the privacy label and manifest in the same release. (Source: own-ios-16)
20. **Run the device pass** on a release build, launched from the Home Screen, using `docs/launch/qa-matrix.md` (written by ws-11). At least: a small phone, a Dynamic Island phone and a large phone; the newest iOS, the previous major version and iOS 17. The pass covers:
    - First launch signed out, sign up, onboarding to Today, sign out, sign in. Force quit, restart the phone, still signed in. Sign out and delete an account: the next launch shows the welcome page and no old chats, reminders or Health sync remain.
    - Keyboard: sign in, sign up, onboarding name, Journal writer, Today's add field, Learned search. Nothing sits under the keyboard.
    - Apple Health: connect, the permission sheet shows three types, a full sync, Progress shows sleep, HRV and resting heart rate; deny and confirm the app still works and says how to turn it on; on iOS 27 share only a recent window of history.
    - Assistant: the permission step on first open; a photo, a camera photo and a PDF at the size limit; a long answer; Stop mid-answer; a request while the network drops.
    - Plan builder with a description and with a PDF; the wait must outlast 20 seconds.
    - Share a card and tap Save Image, AirDrop and Messages. Export my data to Files.
    - Notifications: allow, deny, and a delivered goal reminder. Camera and Photos denied.
    - Airplane mode at cold launch (signed out and signed in) and mid-action; a slow link with Network Link Conditioner; an IPv6-only (NAT64) network; the Fly machine stopped.
    - Fresh install, update over the previous TestFlight build with data present, delete and reinstall.
    - Low Power Mode; returning after many heavy apps (the web view must not be blank).
    - Regions: 12-hour and 24-hour clocks, each overridden; a non-Gregorian calendar.
    - Accessibility, one setting at a time: Bold Text, text sizes from xSmall to AX5, Button Shapes, Reduce Transparency, Increase Contrast, Differentiate Without Color, Grayscale, Reduce Motion; then VoiceOver, Voice Control and Switch Control on every task in `docs/launch/common-tasks.md`.
    - Safe areas on a home-button phone, a notch phone and a Dynamic Island phone. The launch image hands over without a jump. The Home Screen name is not cut. The status bar, keyboard and system sheets look right with the Light style.
    - An iPad simulator (iPadOS 26 and 27) in iPhone compatibility mode: no crash, no clipped sheets.
    - Cold launch time on the oldest supported iPhone with Instruments (App Launch).
    - Neither reminders nor Apple Health answers "Plugin not implemented" on the archived build.
    - Put the Health and Progress screens beside Bevel and Strava and change anything that reads as a copy.
    (Sources: own-ios-04, own-ios-05, own-ios-08, own-ios-09, own-ios-10, own-ios-11, own-ios-12, own-ios-17, own-ios-18, own-ios-07, own-09, own-qua-04, own-qua-05, own-qua-06, own-qua-07, own-qua-08, own-qua-09, own-qua-10, own-qua-21, gap-rev-own-07, gap-rev-own-17)
21. **Archive and upload.** Product, Archive, Validate App, Distribute. Keep "Upload your app's symbols" ticked and keep each archive. In Organizer, right click the archive, Generate Privacy Report: it must match the App Privacy answers in task 26. Read the upload email for ITMS-91056 privacy manifest warnings. Raise the build number on every upload. (Sources: own-07, own-ios-03, own-ios-14)

### Phase 4: App Store Connect

22. **Create the app record.** Platform iOS. Primary language English (U.S.). Bundle ID `com.joshbean.logbook`. SKU `logbook-ios-1`. Name: the product is now **Orby** (docs/brand/brand-guide.md 2.6); the Home Screen name is "Orby" (`CFBundleDisplayName`). Store names must be unique and at most 30 characters, and "Orby" alone may be taken: owner decision. If it is, a longer name such as `Orby: Run, Habits, Journal` (26 characters) keeps the Home Screen name. Subtitle: `Training plan, habits, journal` (30 characters). No Strava, Apple, Claude, Whoop or Bevel in the name, subtitle or keywords. Search the USPTO in classes 9 and 42 for "Orby" before launch. (Sources: own-10, gap-rev-own-09, finding copy-legal-12)
23. **Categories.** Primary Health & Fitness. Secondary Productivity. Regulated medical device: No. (Source: own-12)
24. **Age rating.** Answer the questionnaire honestly: Health or Wellness Topics yes; the AI assistant question yes; social media, shared location, dating and relationships all No; decide whether Reads counts as web access (it opens links the user saved, in the in-app browser). Kids: Not Applicable. Then override the rating upward to 18+ to match the terms (D6). (Sources: own-13, gap-rev-own-10)
25. **Content rights.** The app shows third-party content (the quote library, public domain after the cleanup in finding copy-legal-18). Answer that you have the rights. When Strava returns, keep the Strava API Agreement on file for this answer. (Source: own-14)
26. **App Privacy (the privacy label).** Privacy Policy URL: `https://<host>/legal/privacy.html`. Data types, all "linked to the user", purpose App Functionality, tracking No:
    - Contact Info: Email Address, Name.
    - Health & Fitness: Health, Fitness.
    - User Content: Other User Content (journal, goals, to-dos, links, AI chats sent for an answer), Photos or Videos (assistant and plan builder attachments).
    - Identifiers: User ID.
    - Diagnostics: Crash Data, not linked to the user (the client error reports).
    Keep it identical to `PrivacyInfo.xcprivacy` and to the policy. (Sources: own-15, gap-rev-own-13, gap-leg-own-02)
27. **Pricing and availability.** Price Free. Availability: United States only. Untick "Make this app available on Apple silicon Macs" and review the Apple Vision Pro setting (off). Leave EU and UK storefronts off until consent, a representative, a DPIA and the 72 hour breach step are in place. Check the developer name, contact email and phone on the account. (Sources: own-18, own-ios-06, gap-leg-own-08, gap-rev-own-15)
28. **Export compliance.** `ITSAppUsesNonExemptEncryption` is already NO in Info.plist (HTTPS only). Before February 1 after launch, check whether the year-end BIS self-classification report applies to an HTTPS-only app, or ask the lawyer. (Sources: own-08, gap-leg-own-14)
29. **Store text.** Write it after the fixes so it lists only shipped features. The product name in it is Orby (capital O, no "the", no "app"; guide 2.6 and 10).
    - Description: the first sentence is the pitch. Say "Works with the Apple Health app: reads your sleep, heart rate variability and resting heart rate, with your permission. It never writes." Include the not-medical-advice line. Do not mention Strava. Keep to fitness, sleep, recovery and habits.
    - Keywords: 100 bytes, commas, no spaces, no brand names ("strava", "whoop", "claude", "apple health").
    - Promotional text and "What's New".
    - Copyright: `2026 <legal name>`.
    - Support URL: `https://<host>/legal/support.html`. Marketing URL: optional, `https://<domain>/`.
    - On any website: "Works with the Apple Health app", Apple's badge artwork once, at least 30 px high, with the trademark credit line.
    (Sources: own-16, own-qua-14, gap-rev-own-11, own-ios-13, gap-leg-own-13)
30. **Screenshots.** From the release build, with the demo account and a fictional persona. Portrait, PNG or JPEG without alpha. Sizes: 1320 x 2868 (large Dynamic Island) and 1206 x 2622 (medium). Order: Today with plan and habits; the assistant answering from training data; Plan; Progress; Goals; Journal. More than half must show the app in use. No prices, URLs, awards, other platforms, real people's data or third-party logos. Skip the app preview video for 1.0. (Sources: own-20, own-qua-12, own-qua-13, gap-rev-own-12)
31. **Create the review demo account** on production: `fly ssh console -a josh-logbook`, then run `pnpm --filter @logbook/api seed:review` with `REVIEW_EMAIL=review@<domain>` and a strong `REVIEW_PASSWORD` (script from ws-01, finding gap-sub-48). It must not expire. On the exact build you submit, sign in with it and confirm every link opens, no placeholder text shows, Progress shows health days, and the server still accepts new accounts. (Sources: own-qua-20, gap-rev-own-03)
32. **App Review Information.** Contact first name, last name, email, phone in +1 format. Sign-in required: yes, with the demo email and password. Notes: start from `docs/launch/review-notes.md` (drafted by ws-11). They must say: why an account is needed; the app is free with no purchases or ads; the assistant calls the Anthropic Claude API from Logbook's server, is opt-in, and the permission step appears the first time the assistant opens and in Settings, Privacy; Anthropic acts as Logbook's processor; Apple Health is read only, three types, connected in Settings, Data sources, and the demo account is pre-filled for a device with no Watch; where Delete account is (Settings, Account); the native features (Apple Health, reminders, haptics, offline use, native share); Strava is not part of this build. Attach a short screen recording from a real iPhone of the Apple Health connect and sync flow and of the AI permission step. (Sources: own-21, gap-rev-own-05, gap-rev-own-06, gap-leg-own-15)
33. **Accessibility Nutrition Labels.** Declare none at the first submission. After the device pass, declare only what passed on a phone; Reduced Motion is the first candidate. Leave Larger Text, Sufficient Contrast and Dark Interface undeclared until they pass. Recheck at every release. (Sources: own-17, own-qua-11, finding a11y-17)
34. **TestFlight.** Have the demo account, review notes and privacy policy ready before the first external build. Internal build first. Then 10 to 30 external testers for one to two weeks, with a Beta App Description and a feedback email. (Sources: own-24, gap-rev-own-18)
35. **Release option.** Choose "Manually release this version" for 1.0. Turn on phased release from 1.0.1. (Source: own-23)
36. **Optional: featuring nomination.** Type App Launch, at least three weeks before the launch date, with a TestFlight link and notes on accessibility and the solo-developer story. (Source: own-qua-15)
37. **Submit, then hold steady.** Keep the server up and unchanged, sign-up open, the Anthropic key funded and no region blocks while the build is Waiting for Review or In Review. Repeat the airplane mode checks on the TestFlight build first. (Sources: own-22, gap-rev-own-04)

### Phase 5: after launch

38. **Watch and answer.** Check crashes, hangs, launch time and terminations in Xcode Organizer daily in week one, then weekly; turn on regression notifications. Reply to low-star and bug reviews first, on the reviewer's point, with no personal data. Never ask for or reward reviews. Leave the summary rating alone when shipping updates. Write specific "What's New" text for each update. (Sources: own-qua-16, own-qua-17, own-qua-18, gap-rev-own-19)
39. **Before April 2027.** Move to Xcode 27 and the iOS 27 SDK; smoke test a cold launch and scene resizing on iOS 27; add iPhone Duo screenshots. (Sources: own-05, own-20, own-ios-02)
40. **Next releases.** Work through section E: the Strava gate when Strava answers, the age API when the lawyer answers, then units, dark theme and the rest.

## E. Deferred

28 findings are left for after 1.0 on purpose. None is a blocker. Each has its reason. Full detail for each id is in `audit.md`.

### Strava gate: do all of these before Strava is turned on

| Id | Severity | Finding | Reason |
|---|---|---|---|
| copy-legal-10 | high | Strava brand rules are not met: no official Connect button, no Powered by Strava, no View on Strava (also gap-leg-44, gap-rev-27, progress-03, settings-24) | Strava gate. Strava is off in the 1.0 build; the official button and logo assets come from Strava after approval. Do before Strava is turned on. |
| copy-legal-31 | high | Strava data is kept with no time limit, and the connect step does not say what is read (also gap-leg-40, gap-rev-26) | Strava gate. Needs Strava's written answer on caching and analysis first (owner task). Do before Strava is turned on. |
| gap-leg-39 | high | Strava runs are analysed, charted and combined with plan data | Strava gate. Needs Strava's written answer (owner task). Strava is off in 1.0. |
| gap-leg-43 | high | No consent screen before connecting Strava | Strava gate. Build the pre-connect sheet with the Strava UI work before Strava is turned on. |
| sec-10 | high | Strava OAuth state is not tied to the browser session: an attacker can link a victim's Strava to the attacker's Logbook account | Strava gate. Strava routes are off in production (no keys). Fix the OAuth state before Strava is turned on. |
| settings-07 | high | Strava's return to the iOS app is ignored when Settings is already open: no "Connected", no failure sheet | Strava gate. Strava is off in 1.0. Fix the return handling before Strava is turned on. |
| gap-leg-37 | medium | Share cards are drawn from Strava runs and leave the app with no Strava attribution | Strava gate. Share cards from Strava runs wait for Strava's answer; Strava is off in 1.0. |
| gap-leg-55 | medium | Strava tokens are stored in clear text and the webhook token has a public default (also sec-26) | Strava gate. Encrypt Strava tokens before Strava is turned on. The default webhook token is removed now (sec-12). |
| settings-23 | medium | Strava error states say the wrong thing | Strava gate. Error states for a hidden feature. Do before Strava is turned on. |

### Waits for a legal answer

| Id | Severity | Finding | Reason |
|---|---|---|---|
| gap-leg-22 | high | No age check through Apple's Declared Age Range API (Texas accounts since June 4, 2026) | Needs a lawyer's read first (owner task). 1.0 states 18+ at sign-up and in the terms; the Declared Age Range API follows the legal answer. |

### Product changes for after launch

| Id | Severity | Finding | Reason |
|---|---|---|---|
| gap-qua-34 | medium | The first run is 23 screens before Today | A flow redesign (2 page pager, tour moved out). Cut it after launch with real funnel numbers. Cheap parts are in onboarding-17. |
| today-top-10 | medium | The morning routine assumes leaving for work every day, so a weekend long run is flagged '58 min late' with 'Run 6 mi' and 'Skip the run' as fixes | A weekday picker for the leave-by routine is a product change (large). After launch. |
| today-top-30 | medium | Distances are miles only and clock times have no AM/PM (also progress-11, settings-19) | Kilometres, kilograms and a units setting are large. 1.0 ships in the United States storefront only (owner task) and the Units row is removed (gap-rev-08). Clock times follow the device now (gap-qua-65). |
| assistant-27 | low | Undo puts back whole old rows with no check for later edits | Rare, and a safe fix needs per-field history. After launch. |
| gap-qua-54 | low | Two of Apple's seven featuring factors are unserved: no dark theme and English only | Dark theme and other languages are large projects. After launch. |
| gap-qua-56 | low | The app never asks for a rating | Needs a plugin and real usage to time the prompt. After launch. |
| goals-26 | low | A goal's log carries events from earlier cleared goals of the same period, and logs have no paging | Log paging and cross-goal events: low reach, medium work, and it needs a server change. After launch. |
| journal-29 | low | Hide is permanent after the toast, for quotes and for Remember when | A new "Hidden" list is a small feature. After launch. The Hide toast stays as the warning. |
| onboarding-18 | low | Feature intro sheets can never show: nothing enrolls the account | Dead code that never shows. Removing it touches App.tsx routes; do it after launch. |
| shell-15 | low | Coming back to the app refetches only the bootstrap, so changes made on another device do not appear for up to five minutes | Needs a server change marker in the bootstrap. Five minutes of staleness across devices is acceptable for 1.0. |

### Performance and native polish for after launch

| Id | Severity | Finding | Reason |
|---|---|---|---|
| ios-08 | medium | Heart rate day buckets from the phone fail the server's own schema, so most days' heart rate rows are dropped silently | Heart rate is not read in 1.0 (ios-03), so the bucket bug cannot fire. Fix before heart rate returns. |
| gap-qua-33 | low | The launch shows a logo and a wordmark splash instead of a plain first frame | A taste call, not a rule. The current splash is allowed. Revisit with a device in hand. |
| ios-17 | low | Uploads the server refuses for a passing reason are thrown away, and refused batches stay on the phone forever | Low reach and blind Swift work. Do with the next native pass on a Mac. |
| ios-20 | low | Launch image to web splash: the orb changes size at the hand-off on every phone except the tallest (also gap-ios-22) | Cosmetic and needs a device to compare sizes. Do with the device pass. |
| ios-24 | low | App icon is valid for upload; its pale edge disappears on white and there are no dark or tinted variants | Optional icon variants. Owner's call after launch. |
| perf-08 | low | Entry bundle is 1.12 MB (369 KB gzip): zod ships unused, sheets and sign-in are eager, 400 ms parse task at start | Bundle size is acceptable for a bundled app (no download at launch). Measure on an old phone first. After launch. |
| perf-09 | low | First open sends 53 API requests; 21 of them are quote fetches, 18 for the hidden Library theme cards | Needs a new server endpoint for theme cards; first-open cost is on Wi-Fi-class requests. After launch. |
| perf-20 | low | Short stalls at 4x CPU when opening the assistant, pushing Settings and swiping days | Short stalls only at 4x throttle. Measure on an iPhone SE class device first. After launch. |

### Parts left for later from findings that are otherwise in a workstream

| Id | What ships now | What waits |
|---|---|---|
| sec-04 | Forgot and reset password, change password, verification mail. | Changing the email address, and deletion by emailed link. A locked-out person resets the password, then deletes. |
| sec-17 | Hashed session ids, a 180 day cap, sessions dropped on password change. | A session list and "Sign out everywhere" in Settings. |
| sec-21 | Earlier device tokens revoked on reconnect and at sign out; per-token limits. | Token rotation every 90 days and a device list. |
| sec-12 | The 20 minute Strava loop and the default webhook token are removed. | Webhook-driven sync, rate-limit back-off, the capacity request (Strava gate). |
| sec-09 | Nightly backup job and a runbook. | A second region or a move off single-machine SQLite. State the single-machine limit to yourself: one Fly machine, one volume. |
| sec-23 | Structured logs, an audit table, a real health check. | Third-party error tracking and uptime alerts (owner decision, task 19). |
| copy-legal-11 | Server deletes Strava data on disconnect, on account deletion and on Strava-side revocation. | The Settings copy and toast, with the rest of the Strava UI (Strava gate). |
| assistant-07 | Thumbs down opens a report sheet that mails the developer. | Storing feedback on the server. |
| ios-27 | The 20 second cut is removed and the wait is named. | Running plan drafts as a background job with polling. |
| gap-ios-24 | The web view asks for persistent storage. | Chat history kept on the server so it survives a reinstall. |
| journal-33 | Unused Journal screens and tour names are cleaned up. | Removing the day-tag routes, service and table on the server. |
| progress-12 | Sets on a "Lifted" day can be deleted and added. | Moving sets together with a moved session. |
| gap-rev-08 | The Units row is removed. | A real units setting (today-top-30). |
| a11y-02 | Font sizes move to rem tokens and a check stops regressions. | A full pass at AX sizes on a phone, then the Larger Text label. |
| perf-14 | CI and six end-to-end flows. | Component tests and native (XCTest) tests. |

### Findings handled only by the owner

| Id | Severity | Finding | Owner task |
|---|---|---|---|
| a11y-17 | medium | Accessibility Nutrition Labels: what Logbook can honestly claim today | 33 |
| copy-legal-12 | high | The name "Logbook" is already used on the App Store, including by a fitness tracker | 22 |
| ios-26 | high | Steps only the owner can do in Xcode, the Apple Developer portal and App Store Connect | 16 to 21 |

## F. Compliance checklist

Every requirement from the five gap analyses, with its status on 2026-11-10 before any fix: 95 met, 99 partly met, 63 not met, 99 owner tasks (356 in all). The last column says what closes it: findings in this plan (D marks a deferred one) and owner task numbers from section D. Re-run this list after the workstreams merge; a row is closed only when its findings pass their checks and its owner task is done.

### App Store Connect submission requirements and checklist

59 requirements: 13 met, 6 partly, 10 not met, 30 owner tasks.

| Id | Requirement | Status | Closed by |
|---|---|---|---|
| SUB-01 | Active Apple Developer Program membership (99 USD a year), two-factor Apple Account, legal age. | owner task | owner task 7 |
| SUB-02 | Individual enrollment shows the developer's personal legal name as seller; an organization needs a legal entity and D-U-N-S. | owner task | owner task 2 |
| SUB-03 | Apps in regulated fields or that need sensitive user data should be submitted by a legal entity (5.1.1(ix)). | owner task | copy-legal-08; owner task 2 |
| SUB-04 | Latest Program License Agreement (October 13, 2026) accepted. | owner task | owner task 7 |
| SUB-05 | Free app needs only the Program License Agreement; Paid Apps Agreement, tax and banking only when selling. | met | Already met |
| SUB-06 | EU Digital Services Act trader status declared in the account. | owner task | owner task 8 |
| SUB-07 | Build with Xcode 26 or later and the iOS 26 SDK or later. | owner task | owner task 16, 39 |
| SUB-08 | From April 2027: iOS 27 SDK and a deployment target of iOS 15 or later. | met | Already met |
| SUB-09 | iOS apps target iOS 13 or later. | met | Already met |
| SUB-10 | Bundle ID in the build matches the app record and is permanent after the first upload. | owner task | owner task 2, 22 |
| SUB-11 | Build carries a version and a build string; each upload of a version has a higher build string. | met | Already met |
| SUB-12 | App target has the HealthKit capability: com.apple.developer.healthkit entitlement in the signed build. | not met | ios-01; owner task 17 |
| SUB-13 | Background-delivery entitlement present if and only if enableBackgroundDelivery is called. | met | Already met |
| SUB-14 | Info.plist has an accurate purpose string for every protected resource used. | partly | journal-02 |
| SUB-15 | UIRequiredDeviceCapabilities matches real needs (arm64, not healthkit). | not met | ios-19 |
| SUB-16 | If the build supports iPad, a 13 inch iPad screenshot is required and the app must work on iPad. | not met | ios-06; owner task 20 |
| SUB-17 | App bundle contains a valid PrivacyInfo.xcprivacy with reasons for required-reason APIs used. | not met | ios-02; owner task 21 |
| SUB-18 | Listed third-party SDKs (Capacitor, Cordova) include their privacy manifests and signatures. | met | Already met |
| SUB-19 | Export compliance declared: ITSAppUsesNonExemptEncryption NO only with exempt encryption. | met | Already met |
| SUB-20 | Possible year-end BIS self-classification report for exempt encryption. | owner task | owner task 28 |
| SUB-21 | App icon 1024 x 1024, square, unmasked, sRGB or P3. | met | Already met |
| SUB-22 | App Store icon has no alpha channel. | met | Already met |
| SUB-23 | Only public APIs; runs on the shipping OS; tested on device for crashes. | owner task | owner task 20 |
| SUB-24 | App record created before first upload: name, primary language, bundle ID, SKU. | owner task | owner task 22 |
| SUB-25 | Subtitle of 30 characters or fewer that follows metadata rules. | owner task | owner task 22 |
| SUB-26 | Public Privacy Policy URL in App Store Connect, and the policy linked inside the app. | not met | copy-legal-01; owner task 15 |
| SUB-27 | Primary and secondary category reflect the app. | owner task | owner task 23 |
| SUB-28 | Regulated medical device status declared (No) for a Health & Fitness app. | owner task | copy-legal-08; owner task 23 |
| SUB-29 | Age rating questionnaire answered honestly under the 2026 system. | owner task | gap-leg-27; owner task 24 |
| SUB-30 | Social media, shared location, dating and relationships questions answered; assistant must not act as a romantic or sexual companion. | partly | gap-leg-27; owner task 24 |
| SUB-31 | Content rights question answered (third-party content: Strava). | owner task | owner task 25 |
| SUB-32 | App Privacy details (nutrition label) completed and published. | owner task | owner task 26 |
| SUB-33 | No tracking: no ATT prompt, NSPrivacyTracking false. | met | Already met |
| SUB-34 | Sharing personal data with third-party AI is clearly disclosed and explicitly permitted before it happens (5.1.2(i)). | partly | auth-03 |
| SUB-35 | Health data not used for ads or data mining; the specific health data collected is disclosed; none in iCloud. | partly | copy-legal-01; copy-legal-30 |
| SUB-36 | App Store description states the HealthKit integration. | owner task | owner task 29 |
| SUB-37 | Accessibility Nutrition Labels: voluntary; declare only what passes. | owner task | owner task 33 |
| SUB-38 | Price (Free) and countries or regions set before submission. | owner task | owner task 27 |
| SUB-39 | Opt out of Apple silicon Mac and Apple Vision Pro availability. | owner task | owner task 27 |
| SUB-40 | Age assurance where the law requires it (Texas, Utah, Louisiana): Declared Age Range API; at minimum a stated minimum age. | not met | copy-legal-02; owner task 3, 15 |
| SUB-41 | EU distribution needs trader status and local-law privacy compliance. | owner task | owner task 27 |
| SUB-42 | At least one screenshot for the required iPhone size (Dynamic Island medium and large sets). | owner task | owner task 30, 39 |
| SUB-43 | From April 2027: iPhone Duo screenshots. | owner task | owner task 30, 39 |
| SUB-44 | Screenshots show the app in use, suit a 4+ audience, no other platforms. | owner task | owner task 30, 39 |
| SUB-45 | App previews are optional. | owner task | owner task 30, 39 |
| SUB-46 | Version metadata complete: description, keywords, support URL, copyright, optional promo text and marketing URL. | owner task | gap-sub-47; owner task 29 |
| SUB-47 | No placeholder text, empty sites or broken links; working support and privacy links. | not met | copy-legal-01; gap-sub-47; owner task 29 |
| SUB-48 | App Review contact, and a demo account that does not expire, already populated. | not met | gap-sub-48; auth-02; owner task 32 |
| SUB-49 | Review notes explain non-obvious features; backend live during review. | partly | auth-02; owner task 32, 37 |
| SUB-50 | Account deletion offered inside the app. | partly | copy-legal-17; owner task 32 |
| SUB-51 | Login only where account-based features need it; ask only for relevant personal data. | met | Already met |
| SUB-52 | Sign in with Apple required only with third-party or social login. | met | Already met |
| SUB-53 | More than a repackaged website (4.2); no web tells. | met | Already met |
| SUB-54 | No hidden, dormant or undocumented features (2.5.19); no placeholder or test content. | not met | gap-rev-08 |
| SUB-55 | Release option chosen (manual for 1.0; phased release for updates). | owner task | owner task 35 |
| SUB-56 | TestFlight: internal then a small external beta before store submission. | owner task | owner task 34 |
| SUB-57 | Archive signed for distribution by a Developer Program team. | owner task | owner task 16, 39 |
| SUB-58 | Optional creative assets follow 2.3.14; Kids category not selected. | owner task | copy-legal-02; owner task 24 |
| SUB-59 | Remind users to check with a doctor; no unvalidated measurement claims (1.4.1). | not met | gap-leg-27; copy-legal-08; owner task 29 |

### App Store Review Guidelines applied to Logbook

95 requirements: 38 met, 20 partly, 14 not met, 23 owner tasks.

| Id | Requirement | Status | Closed by |
|---|---|---|---|
| REV-01 | 1.4.1: every health score or measurement discloses its data source and calculation method; no phone-sensor-only measurement claims. | partly | copy-legal-30; ios-03 |
| REV-02 | 1.4.1: the app reminds users to check with a doctor in addition to using the app and before medical decisions. | not met | copy-legal-08 |
| REV-03 | 1.4.1 and review documentation: no diagnostic or treatment claims in the app, AI answers or metadata. | partly | gap-rev-03 |
| REV-04 | 1.4.5: the app does not urge users toward activities that risk physical harm. | partly | gap-rev-03 |
| REV-05 | 1.5: the app and its Support URL each give an easy way to contact the developer. | not met | gap-sub-47; owner task 5 |
| REV-06 | 1.6: user information is protected by appropriate security measures. | partly | auth-09 |
| REV-07 | 1.2: if users can share content with other users, filtering, reporting, blocking and contact details exist. | met | Already met |
| REV-08 | 1.1 and 1.1.6: no offensive content, false information or fake functionality, including AI output. | partly | copy-legal-09 |
| REV-09 | 1.3, 2.3.8, 5.1.4: not in the Kids Category and no metadata implies children are the audience; a minimum age is stated in the terms. | partly | copy-legal-02; owner task 15 |
| REV-10 | 2.1(a): no placeholder text, empty pages, temporary content or dev screens; every URL works. | not met | gap-rev-08 |
| REV-11 | 2.1(a): no crashes or obvious bugs on real devices on the current iOS. | owner task | owner task 20 |
| REV-12 | 2.1(a): App Review gets a demo account that works through review, with no extra code step. | owner task | auth-02; owner task 31 |
| REV-13 | 2.1(a): backend services are live and reachable for the whole review. | partly | auth-02; owner task 10, 37 |
| REV-14 | Review notes state concept, business model, purpose, audience, devices and OS tested, external services (AI included) and regional differences. | owner task | owner task 32 |
| REV-15 | Features that need an environment the reviewer may lack are still reviewable (demo video or seeded data). | partly | ios-03; owner task 31, 32 |
| REV-16 | 2.2: the build is not labelled or presented as a beta, demo or trial. | met | Already met |
| REV-17 | 2.3: description, screenshots, previews and privacy information match what the app does. | owner task | gap-leg-06; owner task 29 |
| REV-18 | 2.3.1(a): new features are described specifically in Notes for Review and reachable by the reviewer. | owner task | owner task 32 |
| REV-19 | 2.5.19: no hidden, dormant or undocumented features in the binary. | not met | gap-rev-11 |
| REV-20 | 2.3.3: more than half of the screenshots per device type show the app in use. | owner task | owner task 30 |
| REV-21 | 2.3.9: screenshots and previews show fictional account data and only material the developer has rights to. | owner task | owner task 30 |
| REV-22 | 2.3.10: no names, icons or imagery of other mobile platforms or marketplaces. | met | Already met |
| REV-23 | 2.3.7: unique app name of at most 30 characters; no trademarks, other app names or prices in name, subtitle or keywords. | owner task | owner task 22 |
| REV-24 | 2.3.5 and 2.3.6: fitting category and an honest age rating questionnaire. | owner task | owner task 24 |
| REV-25 | 2.3.8: icon, screenshots and previews suit a 4+ audience. | owner task | owner task 30 |
| REV-26 | 2.3.12: each update has specific What is New text. | owner task | owner task 38 |
| REV-27 | 2.4.1: the app works on every device it can be installed on, iPad included. | not met | ios-06; owner task 20 |
| REV-28 | 2.4.2: no battery drain or device strain from background work. | met | Already met |
| REV-29 | 2.5.1: public APIs only, built with the required Xcode and SDK, runs on the current iOS. | owner task | owner task 16 |
| REV-30 | 2.5.1: HealthKit is used for health and fitness purposes, integrates with the Health app, and the description says so. | not met | ios-03; owner task 16, 29 |
| REV-31 | 2.5.2: self-contained; no downloaded or executed code that adds or changes features. | met | Already met |
| REV-32 | 2.5.4: background modes are used only for their intended purposes. | met | Already met |
| REV-33 | 2.5.5: fully functional on an IPv6-only network. | met | Already met |
| REV-34 | 2.5.9: standard system behaviours and links out work as users expect. | met | Already met |
| REV-35 | 2.5.14: recording of user activity or camera use has explicit consent and a clear indication. | met | Already met |
| REV-36 | 2.5.16: notifications relate to the app content and functions. | met | Already met |
| REV-37 | 3.1.1: nothing is unlocked by a mechanism other than In-App Purchase. | met | Already met |
| REV-38 | Section 3: the business model is explained in the review notes. | owner task | owner task 32 |
| REV-39 | 3.1.2(a), if a subscription is added: sold by In-App Purchase, at least seven days, works on all devices, ongoing value. | met | Already met |
| REV-40 | 3.1.2(c), if a subscription is added: sign-up screen content, restore, links to Terms of Use and Privacy Policy. | met | Already met |
| REV-41 | 2.1(b), if purchases are added: every purchase is complete and visible, with a lapsed-subscription demo account. | met | Already met |
| REV-42 | 3.1.1(a) and 3.1.3, if purchases are added: outside purchase links only where allowed. | met | Already met |
| REV-43 | 5.1.1(v), if a subscription is added: delete flow tells subscribers billing continues and links to subscription management. | met | Already met |
| REV-44 | 3.2.2(x) and 5.6.1: no forced rating or review; any prompt uses the system API. | met | Already met |
| REV-45 | 4.10 and 5.1.1(ii): no built-in capability is monetised and no paid feature depends on data access. | met | Already met |
| REV-46 | 4.1: name, icon and UI are the app's own; no other developer's icon, brand or product name in the icon or name. | owner task | owner task 20, 22 |
| REV-47 | 4.2: more than a repackaged website; feels app-like. | met | Already met |
| REV-48 | 4.2.3: works without installing another app; no undisclosed first-launch downloads. | met | Already met |
| REV-49 | 4.5.4 and DPLA Attachment 1: notifications are optional, carry no sensitive data, and are not marketing. | met | Already met |
| REV-50 | 5.1.2(i): no functionality is withheld because the user declined notifications, location or tracking. | met | Already met |
| REV-51 | 4.8: if a third-party or social login is offered, an equivalent privacy-preserving login is offered too. | met | Already met |
| REV-52 | 4.9: Apple Pay disclosure and branding. | met | Already met |
| REV-53 | 4.7: software not embedded in the binary meets 4.7.1 to 4.7.5. | met | Already met |
| REV-54 | Section 4 and common issues: the interface is clean, refined and user friendly. | partly | copy-legal-14 |
| REV-55 | 4.5.6: Apple emoji only as Unicode characters, not embedded images. | met | Already met |
| REV-56 | 5.1.1(i): a privacy policy link in App Store Connect and easy to reach in the app, covering data, uses, third parties, retention, deletion and consent withdrawal. | not met | copy-legal-01; owner task 15 |
| REV-57 | 5.1.1(ii): consent that is easy to withdraw, and purpose strings that state the specific use with an example. | partly | copy-legal-30 |
| REV-58 | 5.1.1(iii): only data needed for core features is requested; photos through the system picker. | not met | ios-03 |
| REV-59 | 5.1.1(iv): respects denied permissions, no nagging or tricks, an alternative path. | met | Already met |
| REV-60 | 5.1.1(v): account deletion starts and finishes in the app, is easy to find, deletes the whole account and data, needs no support contact, states timing and anything ... | partly | gap-leg-57 |
| REV-61 | 5.1.1(v) and (x): login only because of significant account-based features; no personal information beyond what the core function needs. | met | Already met |
| REV-62 | 5.1.1(v): a connected social network can be disconnected and its data access disabled from inside the app. | partly | copy-legal-11 |
| REV-63 | 5.1.1(ix): apps in regulated fields or needing sensitive user information are submitted by a legal entity. | owner task | owner task 2 |
| REV-64 | 5.1.2(i): before personal data goes to a third-party AI the app says what is sent, names the recipient and gets explicit permission. | partly | auth-03 |
| REV-65 | 5.1.2(i): every data flow to the AI provider is covered by a permission; nothing personal is sent while permission is off. | not met | assistant-03 |
| REV-66 | 5.1.2(i) in practice: the reviewer can see the AI permission step on the normal path with the demo account. | not met | auth-03; owner task 31, 32 |
| REV-67 | 5.1.2(ii) and (iii): data used only for the purpose collected; no hidden user profile. | met | Already met |
| REV-68 | 5.1.2(i): tracking only with App Tracking Transparency permission. | met | Already met |
| REV-69 | 5.1.2(vi) and 5.1.3(i): Apple Health data is never used for advertising, marketing or use-based data mining. | met | Already met |
| REV-70 | DPLA 3.3.3(H): Apple Health data reaches a third party only with prior express consent and only to provide a health or fitness service. | met | Already met |
| REV-71 | 5.1.3(i): the app discloses the specific health data it collects from the device. | not met | copy-legal-30 |
| REV-72 | 5.1.3(ii): no false data written to HealthKit; no personal health information stored in iCloud. | met | Already met |
| REV-73 | DPLA 3.3.3(H) and HealthKit docs: the health and fitness use is evident in marketing and UI, and users are told how health data is used. | partly | ios-03; copy-legal-30; owner task 29 |
| REV-74 | HIG HealthKit: Health access is requested in context through the system sheet, without custom screens that copy it. | met | Already met |
| REV-75 | 2.3 and App privacy details: the privacy label lists every data type collected, with linkage and purposes. | owner task | owner task 26 |
| REV-76 | 5.1.4: children's data is handled under children's privacy laws, or the app is not offered to them. | partly | copy-legal-02; owner task 15 |
| REV-77 | 5.1.5: location is used only when directly relevant and with consent. | partly | ios-03 |
| REV-78 | 5.1.1(vii) and account deletion FAQ: web sign-in flows run in a visible in-app browser sheet. | met | Already met |
| REV-79 | 5.2.1: all content (quotes, fonts, icons, images, sounds) is original or licensed. | partly | copy-legal-19 |
| REV-80 | 5.2.2: use of a third-party service is permitted by its terms, with authorization on request. | owner task | owner task 13 |
| REV-81 | Strava API Policy 5.3 and 5.10: Strava data and anything derived never enters an AI context or reaches an AI provider. | not met | copy-legal-03 |
| REV-82 | Strava API Policy 5.4, 6.2, 6.3, 2.5, 7.4: owner-only display, cache at most seven days, removal within 48 hours of deletion on Strava, no pooled analytics, deletion on ... | not met | copy-legal-31 (D) |
| REV-83 | Strava brand rules: official Connect with Strava button, "Powered by Strava" or "Compatible with Strava", "View on Strava" links, no Strava marks in name or icon, no ... | not met | copy-legal-10 (D) |
| REV-84 | 5.2.4: nothing implies Apple supplies or endorses the app. | met | Already met |
| REV-85 | 5.2.5 and HIG: the app does not resemble an Apple app; no ring-like element shows Move, Exercise or Stand data. | partly | copy-legal-27 |
| REV-86 | HIG HealthKit: say "Apple Health" or "the Apple Health app" (never "HealthKit"); the Apple Health icon is Apple's artwork, unaltered and not a button. | partly | gap-rev-29 |
| REV-87 | Apple trademark and Works with Apple Health guidelines for marketing. | owner task | gap-rev-29; owner task 29 |
| REV-88 | 4.1(c) and 5.2.1: third-party AI brand names appear only as factual disclosure. | met | Already met |
| REV-89 | 5.6: no misleading of users or App Review; no manipulative patterns to obtain data, purchases or consent. | partly | gap-leg-06 |
| REV-90 | 5.6.2 and 1.5: developer identity and contact details are accurate and current; EU trader status if offered in the EU. | owner task | owner task 27 |
| REV-91 | 5.6.3 and Section 3: ratings, reviews, charts and search are not manipulated. | met | Already met |
| REV-92 | Section 5 intro: complies with the law in every storefront where it is offered. | owner task | owner task 27 |
| REV-93 | TestFlight: the first build sent to external testers passes App Review. | owner task | owner task 34 |
| REV-94 | Section 4 intro and App Store Improvements: after launch the app stays functional and updated. | owner task | owner task 10, 37, 38 |
| REV-95 | Strava API Policy 3.3 and 5.8: the Strava application tier covers the number of connected users; users are never charged for Strava-based features. | owner task | owner task 13 |

### Legal, privacy and third-party terms for a US health and AI app

58 requirements: 4 met, 19 partly, 15 not met, 20 owner tasks.

Not assessed: Rows marked unlikely in the source table were not assessed: LEG-10 (CCPA thresholds), LEG-35 (companion chatbot laws; its crisis-resources action is folded into gap-leg-27), LEG-36 (EU AI Act Art. 50; covered by the AI label in gap-leg-25 if the EU is ever served), LEG-62 (French encryption declaration).

| Id | Requirement | Status | Closed by |
|---|---|---|---|
| LEG-01 | A privacy policy link is in App Store Connect and reachable inside the app in an easily accessible manner (5.1.1). | not met | copy-legal-01; owner task 15, 26 |
| LEG-02 | The policy states what is collected, how, all uses, that third parties give equal protection, retention and deletion, and how to revoke consent and request deletion ... | owner task | sec-19; owner task 15 |
| LEG-03 | A HealthKit app has a privacy policy and discloses the specific health data it collects from the device (5.1.3(i)). | partly | copy-legal-30; copy-legal-01; owner task 15 |
| LEG-04 | CalOPPA: a reasonably accessible policy that names data categories, third-party categories, review and correction process, effective date, change notice and Do Not Track ... | owner task | copy-legal-01; owner task 15 |
| LEG-05 | A Strava API app has a lawful, GDPR-shaped privacy policy, linked prominently, with a Strava section and the Usage Data statement (API Policy 6.5, 7.3). | owner task | copy-legal-01; gap-leg-43 (D); owner task 15 |
| LEG-06 | Privacy statements in the app match the actual data flows (FTC deception standard). | not met | gap-leg-06; plan-28; owner task 26 |
| LEG-07 | Washington MHMD: a separate Consumer Health Data Privacy Policy, linked distinctly from the home page and from the app's settings or about section. | not met | gap-leg-07; owner task 3, 15 |
| LEG-08 | Consumer health data is collected only with opt-in consent, shared only with a separate consent, with a way to withdraw, and access, withdrawal and deletion requests ... | partly | gap-leg-08; copy-legal-06; copy-legal-30; owner task 3, 5 |
| LEG-09 | Nevada SB 370: consumer health data privacy policy, affirmative consent, requests answered in 45 days, deletion (including processors) within 30 days. | partly | gap-leg-57; gap-leg-08; gap-leg-07; sec-19; owner task 5, 15 |
| LEG-11 | Some state privacy laws reach small businesses that process health data regardless of revenue (Connecticut, Texas). | owner task | gap-leg-08; owner task 3 |
| LEG-12 | FTC Health Breach Notification Rule: notify users within 60 days, the FTC and media at the thresholds. | owner task | owner task 12 |
| LEG-13 | Under the HBNR a breach includes disclosing health data to a third party without the user's authorization ... | partly | copy-legal-06; plan-28; owner task 12 |
| LEG-14 | After a breach, follow each affected user's state breach notification law. | owner task | owner task 12 |
| LEG-15 | GDPR and UK GDPR apply when the app is offered to people in the EU or UK. | owner task | owner task 27 |
| LEG-16 | GDPR Art. 9: explicit, separate, recorded consent for health data, withdrawable (only if EU or UK users are served). | owner task | gap-leg-08; copy-legal-06; owner task 27 |
| LEG-17 | A non-EU controller names an EU and a UK representative (only if EU or UK users are served). | owner task | owner task 27 |
| LEG-18 | A data protection impact assessment before high-risk processing (only if EU or UK users are served). | owner task | owner task 27 |
| LEG-19 | Notify the supervisory authority of a breach within 72 hours (only if EU or UK users are served). | owner task | owner task 12, 27 |
| LEG-20 | COPPA: on actual knowledge that a user is under 13, get parental consent or delete; any age screen is neutral. | partly | copy-legal-02; owner task 5 |
| LEG-21 | The app states a minimum age and the App Store age rating is not lower than it. | not met | copy-legal-02; owner task 3 |
| LEG-22 | Where the law requires it, check age with Apple's Declared Age Range API and honor parental consent (Texas since June 4, 2026). | not met | gap-leg-22 (D); owner task 3 |
| LEG-23 | The app is licensed under Apple's standard EULA or a custom EULA with Apple's ten minimum terms; separate Terms of Service accepted at signup are recommended. | not met | copy-legal-02; owner task 3 |
| LEG-24 | A custom EULA states the developer's name, address, phone and email. | owner task | owner task 2, 3 |
| LEG-25 | Anthropic Commercial Terms D.3: tell users that factual assertions in outputs should not be relied on without checking. | not met | copy-legal-09 |
| LEG-26 | Anthropic Usage Policy: disclose that the user is interacting with AI, at the start of each chat or in the product interface. | not met | copy-legal-09 |
| LEG-27 | Claude is not used to give medical high-risk recommendations (diagnosis, treatment, reading symptoms or test results, mental health) without qualified review ... | not met | gap-leg-27 |
| LEG-28 | Anthropic's Commercial Terms can be held by an individual; an entity is still advised. | owner task | owner task 2 |
| LEG-29 | Statements about Anthropic's handling are accurate: no training on API content, deletion within 30 days by default, flagged content kept longer. | owner task | gap-leg-57; owner task 10, 15 |
| LEG-30 | Zero data retention is by arrangement with Anthropic and excludes the Files API, batch and some models. | owner task | owner task 10 |
| LEG-31 | Personal data goes to a third party, including third-party AI, only after clear disclosure and explicit permission (5.1.2(i)). | not met | copy-legal-06; gap-leg-06; owner task 32 |
| LEG-32 | Data collected for one purpose is not reused for another without further consent (5.1.2(ii)). | partly | plan-28 |
| LEG-33 | If minors can use a Claude-powered product, follow Anthropic's extra safeguards. | owner task | copy-legal-02; gap-leg-22 (D); owner task 3 |
| LEG-34 | The AI never implies a health care licence, and users get a clear notice that the chatbot is not human. | partly | copy-legal-09; gap-leg-27; owner task 3 |
| LEG-37 | Strava data about a user is shown or disclosed only to that user. | partly | gap-leg-37 (D); owner task 13 |
| LEG-38 | Strava data, and anything derived from it, never reaches an AI model or provider, even with user consent (API Policy 5.3, 5.10). | not met | copy-legal-03 |
| LEG-39 | Strava data is not used for analytics or analyses, not combined with other customer data, and not kept in a persistent index (API Policy 5.4, 5.5). | partly | gap-leg-39 (D); owner task 13 |
| LEG-40 | Strava data is cached no longer than seven days; deletions and privacy changes on Strava are reflected within 48 hours ... | not met | copy-legal-31 (D) |
| LEG-41 | On request, on revocation and on account deletion, all Strava data is permanently deleted within 30 days, with written confirmation to the user. | not met | copy-legal-11; gap-leg-57 |
| LEG-42 | The app reacts when access is revoked from Strava's side (webhook athlete update, authorized false) and the webhook answers 200 within two seconds. | partly | copy-legal-11 |
| LEG-43 | Before reading Strava data the app gets consent on a screen that says what is collected, how, how to withdraw, how to request deletion, and that deletions are confirmed. | not met | gap-leg-43 (D) |
| LEG-44 | Strava brand rules: official Connect with Strava button, Powered by Strava where Strava data shows, View on Strava links, no Strava name in the app name or icon, Garmin ... | partly | copy-legal-10 (D); gap-leg-37 (D) |
| LEG-45 | A new Strava app is limited to 1 athlete (10 by self-upgrade) until Strava's review; hide Strava connect until approved; use webhooks, not polling. | partly | settings-18; owner task 13 |
| LEG-46 | A breach involving Strava data is reported to Strava within 24 hours. | owner task | owner task 12 |
| LEG-47 | No charge for Strava access, no Strava data in ads, no Strava-like features, and easy-to-find support contact details and links to the user's Strava account. | partly | gap-sub-47; owner task 5 |
| LEG-48 | HealthKit data is never used for advertising, marketing or data mining, and never sold. | met | Already met |
| LEG-49 | HealthKit information goes to a third party only with express permission, and only to one that provides a health or fitness service to the user. | met | Already met |
| LEG-50 | No personal health information is stored in iCloud and no false data is written to HealthKit. | partly | gap-leg-50 |
| LEG-51 | Marketing says 'the Apple Health app' or 'the Health app', never 'Apple Health data'; badge rules. | partly | gap-rev-29; owner task 29 |
| LEG-52 | Apps that need sensitive user information should be submitted by a legal entity, not an individual (5.1.1(ix)). | owner task | owner task 2 |
| LEG-53 | The app reminds users to check with a doctor before making medical decisions and makes no unvalidated accuracy claims (1.4.1). | not met | copy-legal-08 |
| LEG-54 | The product stays general wellness: no claims about specific diseases or conditions. | partly | gap-rev-03; gap-leg-27; owner task 29 |
| LEG-55 | Health data has reasonable security: encryption in transit and at rest, least privilege, tested authentication. | partly | gap-leg-55 (D); owner task 9 |
| LEG-56 | Passwords are salted and hashed with a slow function, never stored in clear text. | met | Already met |
| LEG-57 | Account deletion is in the app, easy to find, deletes the whole account and its data, needs no email or call, and says what is kept and how long it takes. | partly | gap-leg-57 |
| LEG-58 | Retention statements cover backups and processors, and data is kept only as long as needed. | partly | sec-19; owner task 9, 15 |
| LEG-59 | Declare EU Digital Services Act trader status in App Store Connect. | owner task | owner task 27 |
| LEG-60 | ITSAppUsesNonExemptEncryption is NO only if the app uses no or only exempt encryption. | met | Already met |
| LEG-61 | A year-end self-classification report to the US government may be required for exempt encryption. | owner task | owner task 28 |

### Technical production readiness for a Capacitor iOS app with HealthKit

72 requirements: 35 met, 19 partly, 12 not met, 6 owner tasks.

| Id | Requirement | Status | Closed by |
|---|---|---|---|
| IOS-01 | Info.plist has a non-blank, accurate NSHealthShareUsageDescription under 4,000 bytes. | met | Already met |
| IOS-02 | The Health purpose string and the in-app disclosure completely describe the use and name the specific health data collected. | not met | ios-03; copy-legal-30 |
| IOS-03 | NSHealthUpdateUsageDescription is present only if the app writes to HealthKit. | met | Already met |
| IOS-04 | Every protected resource the binary touches has a valid purpose string. | partly | journal-02; owner task 20 |
| IOS-05 | Permission is requested when the person uses the feature, not at launch. | met | Already met |
| IOS-06 | UIRequiredDeviceCapabilities lists only what the app requires and is decided before 1.0 (it can never be tightened). | partly | ios-19 |
| IOS-07 | healthkit is not in required device capabilities unless the app cannot work without HealthKit. | met | Already met |
| IOS-08 | isHealthDataAvailable() is checked before any other HealthKit call and false is handled. | met | Already met |
| IOS-09 | The signed app carries the com.apple.developer.healthkit entitlement and the App ID has HealthKit enabled. | not met | ios-01; owner task 17 |
| IOS-10 | healthkit.access lists only values the app uses; no Clinical Health Records. | met | Already met |
| IOS-11 | The background-delivery entitlement is present if and only if enableBackgroundDelivery is called. | met | Already met |
| IOS-12 | If background delivery ships: observers set up in didFinishLaunching, completion handler always called. | met | Already met |
| IOS-13 | Health sync tolerates a locked phone. | met | Already met |
| IOS-14 | UIBackgroundModes lists only modes the app uses. | met | Already met |
| IOS-15 | On iOS 27 the app behaves correctly when only a recent window of Health history is granted. | partly | gap-ios-20; owner task 20 |
| IOS-16 | HealthKit data is not used for ads, not sold, not disclosed to third parties without permission; the use is disclosed and a privacy policy exists. | partly | copy-legal-30; shell-26; settings-12; owner task 15 |
| IOS-17 | Personal health information is not stored in iCloud. | partly | gap-leg-50 |
| IOS-18 | The app bundle contains a valid PrivacyInfo.xcprivacy in the App target resources. | not met | ios-02 |
| IOS-19 | Every required reason API used by app code is declared (FileTimestamp C617.1 for @capacitor/filesystem). | not met | ios-02 |
| IOS-20 | The manifest is valid (Boolean tracking, no tracking domains with false, no empty arrays, exact reason strings). | not met | ios-02 |
| IOS-21 | NSPrivacyCollectedDataTypes lists each collected data type with linked, tracking and purposes. | not met | ios-02; owner task 21 |
| IOS-22 | Capacitor and Cordova carry their own privacy manifests and are signed binaries. | met | Already met |
| IOS-23 | A privacy report is generated from each archive and compared with the nutrition label. | owner task | owner task 21 |
| IOS-24 | ITSAppUsesNonExemptEncryption is NO only if no non-exempt encryption is used. | met | Already met |
| IOS-25 | CFBundleShortVersionString is three period-separated integers, matching the package version. | not met | ios-13 |
| IOS-26 | CFBundleVersion is numeric and higher for every upload. | partly | ios-13 |
| IOS-27 | CFBundleDisplayName is the Home Screen name. | met | Already met |
| IOS-28 | Info.plist has a launch screen key. | met | Already met |
| IOS-29 | The launch storyboard is one plain UIKit view with no custom classes or connections. | met | Already met |
| IOS-30 | The launch screen matches the first screen, with no text. | partly | ios-20 (D); owner task 20 |
| IOS-31 | The app adopts the UIScene life cycle. | met | Already met |
| IOS-32 | Built with Xcode 26 or later and an iOS 26 SDK; targets iOS 13 or later. | owner task | owner task 16, 39 |
| IOS-33 | Capacitor 8 floor: Xcode 26 and deployment target iOS 15.0. | met | Already met |
| IOS-34 | TARGETED_DEVICE_FAMILY reflects the intended devices (1 for an iPhone-only launch). | not met | ios-06 |
| IOS-35 | The app runs on iPad in iPhone compatibility mode. | owner task | ios-06; owner task 20 |
| IOS-36 | UIRequiresFullScreen is not relied on; the layout handles scene size changes. | met | Already met |
| IOS-37 | Supported orientations match what the UI handles. | partly | ios-06 |
| IOS-38 | Mac (Apple silicon) and Vision Pro availability is decided in App Store Connect. | owner task | owner task 27 |
| IOS-39 | The asset catalog has a 1024 x 1024 App Store icon. | met | Already met |
| IOS-40 | The icon has no alpha channel. | met | Already met |
| IOS-41 | Icon artwork is square and unmasked. | met | Already met |
| IOS-42 | All traffic is HTTPS with no ATS exceptions. | met | Already met |
| IOS-43 | Production Capacitor config sets none of server.url, server.cleartext, server.allowNavigation. | partly | gap-ios-17 |
| IOS-44 | The app is self-contained: no downloaded code that changes features. | met | Already met |
| IOS-45 | Release builds do not expose web inspection. | met | Already met |
| IOS-46 | viewport-fit=cover and safe-area padding on fixed chrome. | met | Already met |
| IOS-47 | Data that cannot be lost is not kept only in localStorage or IndexedDB. | partly | shell-26; gap-ios-24 |
| IOS-48 | The session cookie carries an expiry; sign out and deletion clear it. | partly | shell-26; owner task 20 |
| IOS-49 | WKAppBoundDomains is not added unless needed. | met | Already met |
| IOS-50 | Requests through the patched fetch send only strings or JSON; large transfers use another path. | partly | plan-17; owner task 20 |
| IOS-51 | Standard behaviours (links out, selecting your own text) are not blocked. | partly | gap-ios-18 |
| IOS-52 | Service workers are not relied on in the native shell. | met | Already met |
| IOS-53 | The splash is hidden on every path when launchAutoHide is false. | partly | gap-ios-23 |
| IOS-54 | First frame is drawn fast; no synchronous work in didFinishLaunching. | owner task | owner task 20 |
| IOS-55 | The binary does not crash or show obvious technical problems in review; the back end is on. | not met | auth-02; owner task 20 |
| IOS-56 | With no network the app opens to a usable or clearly explained state. | partly | perf-12; owner task 20 |
| IOS-57 | Release emits dSYMs. | met | Already met |
| IOS-58 | Bitcode is not enabled. | met | Already met |
| IOS-59 | A signing team is set and the profile includes HealthKit. | owner task | owner task 17 |
| IOS-60 | cap sync has been run on the release commit so every plugin is in the SPM package. | not met | gap-ios-10; owner task 20 |
| IOS-61 | Pending local notifications stay under the 64 cap. | met | Already met |
| IOS-62 | schedule() never triggers the permission prompt by surprise. | met | Already met |
| IOS-63 | The app works fully with notifications denied, and shows how to turn them on later. | partly | goals-10; owner task 20 |
| IOS-64 | No Time Sensitive or Critical interruption level without the capability. | met | Already met |
| IOS-65 | Haptics follow system meanings, are sparing and optional. | partly | gap-ios-19 |
| IOS-66 | Text follows the system text size up to 200% or more without overlap or truncation. | not met | a11y-01; owner task 20 |
| IOS-67 | The app is more than a repackaged website. | partly | gap-rev-08; perf-12; owner task 29 |
| IOS-68 | The app works without extra downloads on first launch. | met | Already met |
| IOS-69 | HealthKit is used for health and fitness, and the integration is clear in the UI and the description. | not met | ios-03; owner task 29 |
| IOS-70 | Custom URL scheme callbacks carry no secrets, and paths are validated. | partly | gap-rev-08 |
| IOS-71 | Universal links, if added, have a valid AASA file and entitlement. | met | Already met |
| IOS-72 | A crash reporting SDK, if added, is declared in the label and has its own manifest. | met | Already met |

### Quality, accessibility and UX bar for a featured-quality launch

72 requirements: 5 met, 35 partly, 12 not met, 20 owner tasks.

| Id | Requirement | Status | Closed by |
|---|---|---|---|
| QUA-01 | No content or control sits under the Dynamic Island, status bar, home indicator or the app's own floating bars. | partly | shell-07; owner task 20 |
| QUA-02 | The layout adapts to every width the app can get, including a size change mid-session. | partly | ios-06; owner task 1 |
| QUA-03 | Every device the deployment target allows is tested or excluded by raising the target. | not met | gap-qua-03; owner task 1 |
| QUA-04 | Every tappable control has a hit region of at least 44 x 44 pt. | partly | gap-qua-04 |
| QUA-05 | Neighbouring controls are spaced so a tap cannot land on the wrong one. | partly | gap-qua-05 |
| QUA-06 | Every custom button shows a press state. | partly | gap-qua-06 |
| QUA-07 | No text is smaller than 11 pt at the default size, and body text is 17 pt. | not met | gap-qua-07 |
| QUA-08 | With the iOS text size raised, body text grows to at least 200 percent with no overlap or truncation that hides meaning. | not met | a11y-02 |
| QUA-09 | Text and icons meet 4.5:1 up to 17 pt and 3:1 at 18 pt and above or bold. | not met | a11y-04 |
| QUA-10 | Control outlines, selected states, toggles, rings and chart marks meet 3:1 against what is next to them. | not met | gap-qua-10 |
| QUA-11 | No information is carried by colour alone. | partly | a11y-13 |
| QUA-12 | If default contrast is below the minimum anywhere, a higher-contrast scheme applies when Increase Contrast is on. | not met | a11y-06 |
| QUA-13 | The interface style the app declares to iOS matches the interface it draws. | not met | ios-07; owner task 20 |
| QUA-14 | The Dark Interface label is not declared unless every common task stays dark. | owner task | owner task 33 |
| QUA-15 | With Reduce Motion on, parallax, zoom, spinning and auto-advancing motion are removed or replaced by a fade. | partly | a11y-16 |
| QUA-16 | No animation blocks input, and nothing people do often makes them wait for motion to finish. | partly | shell-16 |
| QUA-17 | Haptics use each system pattern for its meaning, are consistent, not overused, and can be turned off. | met | Already met |
| QUA-18 | Every screen shows something at once: cached content, a placeholder or a skeleton. | partly | gap-qua-18 |
| QUA-19 | Any wait longer than a moment shows a moving, specific progress indicator and can be cancelled where safe. | partly | gap-qua-19 |
| QUA-20 | Every empty screen says what belongs there and offers the next action as a button. | partly | gap-qua-20 |
| QUA-21 | Error messages appear next to the problem, say what to do next, and avoid blame, codes and "we". | partly | shell-18 |
| QUA-22 | Alerts are used only for critical information; none at launch; destructive confirmations have Cancel and a specific verb. | met | Already met |
| QUA-23 | When the network fails the app keeps showing cached data, labels the problem without blocking, and says what to do. | partly | shell-01 |
| QUA-24 | Every modal has an obvious way out, a title that names its task, and a confirmation before unsaved work is lost. | partly | today-body-34 |
| QUA-25 | Only one sheet shows at a time, and Done is always paired with Cancel or Back. | met | Already met |
| QUA-26 | The tab bar stays visible on every non-modal screen, no tab is hidden or disabled, and every tab has a text label. | partly | a11y-01 |
| QUA-27 | Pushed screens use the standard back chevron at the top leading edge, behave the same everywhere, and have a short title. | partly | plan-11 |
| QUA-28 | On relaunch the app returns to where the person was (tab, screen, scroll position, unsent text). | partly | gap-qua-28 |
| QUA-29 | Every input shows the keyboard that fits its content, a sensible Return key, and a secure field for passwords. | partly | gap-qua-29 |
| QUA-30 | Every field keeps a visible label, validates at the right moment, shows the error beside the field, and Continue is active only when data is present. | partly | auth-07 |
| QUA-31 | The keyboard never hides the focused field or the main action. | partly | auth-06; owner task 20 |
| QUA-32 | Password managers, AutoFill, strong-password suggestions and paste work on sign up and log in. | partly | ios-15; owner task 17 |
| QUA-33 | The launch screen is a plain match of the first frame with no text, logo or branding, in the same appearance as the app. | partly | gap-qua-33 (D) |
| QUA-34 | Onboarding is short, lets people act instead of read, and never asks for a rating or shows licence text walls. | partly | gap-qua-34 (D) |
| QUA-35 | A system permission is requested only when the feature that needs it is used; a pre-permission screen has one button that leads to the system alert. | partly | onboarding-14 |
| QUA-36 | A written list of common tasks exists, and each was completed on an iPhone with each accessibility feature before any label is declared. | not met | gap-qua-36; owner task 20 |
| QUA-37 | With VoiceOver, every control has a label, role and state; focus order is logical; modals trap focus; banners are announced. | partly | a11y-07 |
| QUA-38 | Charts and rings have a text alternative that gives the values. | met | Already met |
| QUA-39 | Every action that needs a drag, long press or swipe can also be done with a tap or a menu, reachable by VoiceOver and Voice Control. | partly | a11y-08 |
| QUA-40 | With Voice Control, names match the visible text and dictation works in every field. | partly | gap-qua-40 |
| QUA-41 | Each declared Accessibility Nutrition Label is true for all common tasks and rechecked every release. | owner task | owner task 33 |
| QUA-42 | The orientation lock is a recorded decision. | partly | a11y-20 |
| QUA-43 | Toasts and other self-dismissing elements do not carry information that is lost when they vanish, or they stay until dismissed. | partly | a11y-11 |
| QUA-44 | An automated accessibility scan reports no low-contrast text, unlabelled inputs, empty buttons, empty links, missing alternatives or missing language. | partly | gap-qua-44 |
| QUA-45 | Most screenshots show the app in use; none is only a login, splash or title art; all match the shipped UI. | owner task | owner task 30 |
| QUA-46 | The first three screenshots carry the core value on their own. | owner task | owner task 30 |
| QUA-47 | Screenshots, previews and other assets contain no prices, URLs, award claims, other platforms or content above 4+. | owner task | owner task 30 |
| QUA-48 | An app preview, if made, is 15 to 30 seconds of in-app capture that works with sound off. | owner task | owner task 30 |
| QUA-49 | Name and subtitle are each at most 30 characters; the subtitle states the value plainly. | owner task | owner task 29 |
| QUA-50 | The keyword field uses at most 100 bytes with no repeated, plural, competitor or trademarked words. | owner task | owner task 29 |
| QUA-51 | The first sentence of the description carries the pitch; no stuffed keywords or prices; "What's New" names real changes. | owner task | owner task 29 |
| QUA-52 | Creative assets for iOS 27, if used, show one clear idea and follow the metadata rules. | owner task | owner task 30 |
| QUA-53 | A featuring nomination of type "App Launch" is submitted at least three weeks before launch. | owner task | owner task 36 |
| QUA-54 | The app is measured against Apple's seven featuring factors. | partly | gap-qua-54 (D); owner task 36 |
| QUA-55 | Rating requests use only Apple's review API, and no custom star prompt or sentiment filter exists. | met | Already met |
| QUA-56 | A rating request fires only after proven engagement, at a natural stopping point, and not again within one to two weeks. | not met | gap-qua-56 (D) |
| QUA-57 | A "Rate Logbook" row in Settings opens the App Store write-review page by URL. | not met | gap-qua-57; owner task 17 |
| QUA-58 | The app and the Support URL each give an easy way to contact the developer. | not met | gap-sub-47; owner task 5 |
| QUA-59 | Replies to App Store reviews stay on point and contain no personal information or marketing. | owner task | owner task 38 |
| QUA-60 | The release build is tested on real iPhones, launched from the Home Screen with no debugger. | owner task | owner task 20 |
| QUA-61 | The QA matrix covers the newest iOS, the previous major version and the lowest allowed version, on the smallest and largest screens. | owner task | owner task 1, 20 |
| QUA-62 | A fresh install, an update over the previous build, and a delete and reinstall are tested. | owner task | owner task 20 |
| QUA-63 | The app is tested on a slow link, offline, on IPv6 only and with the server down. | owner task | owner task 20 |
| QUA-64 | The app is tested in Low Power Mode, under memory pressure and with very large files. | owner task | owner task 20 |
| QUA-65 | Dates, times, week start and units are correct under 12-hour and 24-hour regions and a non-Gregorian calendar. | partly | gap-qua-65; owner task 20 |
| QUA-66 | With each permission denied the app still works and explains how to turn the feature on. | partly | goals-10; owner task 20 |
| QUA-67 | Each accessibility setting is switched on one at a time and every common task is run. | owner task | owner task 20 |
| QUA-68 | At submission the build has no placeholder content, every link works, the back end is up, and a demo account is supplied. | not met | gap-rev-08; owner task 31 |
| QUA-69 | After launch, crashes, hangs, launch time and terminations are checked in Xcode Organizer for each version. | partly | gap-qua-69; owner task 38 |
| QUA-70 | Crash rate, conversion and retention are compared with the Health & Fitness peer benchmarks. | owner task | owner task 38 |
| QUA-71 | Taps respond without a visible pause (no main-thread block over 250 ms). | partly | perf-06 |
| QUA-72 | The summary rating is not reset without a strong reason. | owner task | owner task 38 |


## Critic: gaps and corrections

Date: 2026-11-10. A second read of the audit, this plan, the 22 findings files, the five research notes and the repository itself. It lists what the review missed. Tick each box when it is closed. Items marked "Fixed in workstreams.json" are already added there as `critic-NN` items (22 new items, 559 in all; the per-stream counts in the table in section C are now 67, 70, 67, 33, 37, 55, 44, 65, 31, 55 and 35). The files each stream owns did not change.

What held up: every one of the 638 finding ids is in a workstream, in Deferred or in Owner tasks. No blocker or high was downgraded by a merge. No tracked file has two owners. The claim that the server already serves `/legal/*.html` is true (static files are served from the web build before the app shell, and the Docker image copies the build).

### 1. Never reviewed

- [ ] **Session sheets.** `features/sessions/Effort.tsx` (200 lines), `MoveSheet.tsx`, `DayPicker.tsx` and `actions.tsx` have no finding, and no screenshot is named for the effort sheet. `LiftLog.tsx` has one. Audit: log effort, move a session, log lifts, at 320 and 390.
- [ ] **The Morning page** (`/today/:date/morning` and `/plan/morning/:date`). `MorningView.tsx`, `Schedule.tsx` (571 lines), `StepSheets.tsx`, `AlarmHandle.tsx` and `LeaveRow.tsx` appear only in cross-cutting findings (wording, text size, hold menus). Nothing covers the wake handle drag, the step sheets or the routine editor.
- [ ] **Dragging a session on the Plan week** (`features/plan/useDayDrag.tsx`, 283 lines). No finding.
- [ ] **The Reads screen** (`features/reads/ReadsView.tsx`, 426 lines). One finding, about consent. Add link, tags, tabs and the empty state were not judged.
- [ ] **Shared charts and gesture layers.** `ui/charts/TrendChart.tsx`, `TrendTable.tsx`, `Rings.tsx`, `Spark.tsx` and `RangeControl.tsx` have no finding. `ui/PushedLayer.tsx` (edge swipe back), `ui/SwipeRow.tsx` and `ui/ContextMenu.tsx` have one each, none about the gesture itself.
- [ ] **Small sheets.** The date jump calendar (`features/day/Calendar.tsx`) and the evening word sheet (`features/day/WordSheet.tsx`) have no finding.
- [ ] **Widths.** Screenshots were taken at 390 and 320 wide (891 and 496 files by name). Seven are named for 375 and none for 402, 430 or 440. The largest phones were not reviewed. Fixed in workstreams.json: ws-11 critic-08 adds 430 and 440 to the QA matrix. Each stream should also open its screens at 440.
- [ ] **Every native-only path.** All review ran in a browser. Native HTTP and its cookie jar, native share, the keyboard inset, the status bar, haptics and the tap on a goal reminder have never run. The plan says so in its opening; the device pass (owner task 20) is the only cover.
- [ ] **The public web app.** The plan makes `https://<host>/` a public product: the legal pages live there and the reset mail opens `/login?reset=` in Safari. It was audited only as a phone-sized view of the iOS app. Not checked: desktop widths, the service worker for people who already have it, the browser Back button. Decide whether the web app is supported or whether it shows only sign in, reset and the legal pages.
- [ ] **Screens this plan creates.** Privacy, health privacy, terms and support pages, the email verification page, the reset mail, the reset form, the change password sheet, the two permission steps, and the health tiles with real data. None exists yet, so none was audited. The compliance re-check must open each one. Fixed in workstreams.json: ws-11 critic-08 sets a layout and accessibility bar for the static pages.
- [ ] **Server files no finding names.** `routes/dayplans.ts` (only the export finding touches it), `db/migrate.ts` (start-up migrations on a database that will hold strangers' data), and the pure logic in `packages/shared` (`week.ts`, `timeline.ts`, `recall.ts`, `links.ts`).
- [ ] **Unused files.** `features/day/PlanEnd.tsx` is imported by nothing. `features/day/WeekCard.tsx` is imported only by `faces.test.ts` (two helpers). Delete the first and trim the second (ws-04).

### 2. Research requirements with no status, or with a status that does not hold

- [ ] **LEG-10, LEG-35, LEG-36 and LEG-62 have no row in section F.** Line 1622 says they were not assessed. Suggested rows: LEG-10 (CCPA thresholds) not applicable today, re-check each January. LEG-35 (companion chatbot laws) not applicable, kept so by the safety block in gap-leg-27. LEG-36 (EU AI Act Article 50) not applicable while the app is United States only; the AI label covers it. LEG-62 (French encryption declaration) not applicable while France is off.
- [ ] **LEG-31 is closed too early.** Its action is a recorded opt-in for every flow, a one-time notice at the first attachment, and "with all switches off, send nothing personal". The plan had no item for the notice, and typed text, files and pasted plans still went to Claude with every switch off. Fixed in workstreams.json: critic-02 in ws-01, ws-03, ws-08 and ws-09.
- [ ] **REV-65 is closed by assistant-03 alone.** That finding stops tools and revise mode. It does not stop the other sends. Add critic-02 to the row.
- [ ] **REV-19 and SUB-54 (Guideline 2.5.19) are closed by gap-rev-11 and gap-rev-08 alone.** See 5a.
- [ ] **REV-72 says "met" and IOS-17 says "partly"** for the same rule (no health information in iCloud). IOS-17 is right. The new health tiles add a second way to break it. Fixed in workstreams.json: ws-08 critic-07.
- [ ] **REV-88 says "met".** The research says twice that Anthropic's brand rules for "Claude" and "Powered by Claude" were not fetched. Mark it partly met. Owner: read Anthropic's brand guidelines before `AI_LABEL` ("AI assistant, powered by Claude...") is final.
- [ ] **LEG-58 lost a part.** Its action includes "decide a period for inactive accounts". sec-19 absorbed gap-leg-58 and covers only deleted rows. Fixed in workstreams.json: ws-11 critic-05 (state a rule or say there is none).
- [ ] **SUB-40 and LEG-22 (age assurance) are closed only by a deferred finding and the lawyer task.** See 5b.
- [ ] **Open research gaps with no owner task.** Anthropic's Usage Policy page showed a new version effective November 12, 2026: re-read it before submission (add to owner task 10). Whether the app name "Logbook: Run, Habits, Journal" is free can only be seen in App Store Connect (owner task 22 covers it).

### 3. Blockers and highs missing from the workstreams

No blocker id is missing. Parts of merged blockers were lost, and one contract has no builder.

- [ ] **Contract 1 says consent is read "through the bootstrap". It is not there.** `GET /api/bootstrap` returns user, habits, blocks, morningSettings, zones, strava, features and serverTime. No item added consent to it, yet goals-01 (ws-06) and copy-legal-06 (ws-07), both blocker parts, read it from there. Fixed in workstreams.json: critic-01 in ws-01 (server) and ws-02 (type and validation).
- [ ] **The permission step covered one of three doors.** gap-sub-34 (blocker) asks for one sheet "before the first message, the first plan draft and the first Remember when" and a server that answers "AI is off" with no yes. gap-rev-22 (high) names the plan builder. gap-leg-31 (blocker) asks for one server gate. After the merge into auth-03 only the assistant sheet had a step, and "Not now" still let typed text and files through. Fixed in workstreams.json: critic-02 in ws-01 (403 `consent_required` on every Claude route while `consent.at` is null), ws-03 (Not now at sign-up stores nothing), ws-08 (step in the plan builder) and ws-09 (the step names typed text and files; Not now sends nothing).
- [ ] **Highs outside every workstream: 13.** Ten are Strava findings behind the Strava gate, which is sound while the keys are unset (the connect routes refuse without them). Two are owner-only (copy-legal-12, ios-26). One is gap-leg-22, which should not wait without a gate: see 5b.
- [ ] **onboarding-18 (feature intro sheets) should not be deferred.** See 5a. Fixed in workstreams.json: ws-02 critic-06.

### 4. Overlaps that break parallel work

No path has two owners. These files are still needed by more than one stream.

- [ ] **`apps/web/src/features/auth/consent.ts` (ws-03).** ws-10 imports `useConsent` and `useSaveConsent` from it for the three-switch page, and `useSaveConsent` writes only `training` and `health`, so ws-10 would have to edit it. ws-09 is told both "do not import from features/auth" (auth-03) and "read useConsent()" (assistant-14). Fixed: step 0 moves the hooks to `apps/web/src/lib/consent.ts` (see `step0.md` section 6); critic-11 in ws-03, ws-09 and ws-10; critic-01 in ws-02.
- [ ] **`apps/web/src/features/auth/PrivacyFacts.tsx` (ws-03).** `PrivacyPage.tsx` (ws-10) renders it with `on` and `health` props while three ws-03 items rebuild it. Fixed: the `consent` prop is set in step 0; critic-11 freezes the export names.
- [ ] **`apps/web/src/api/types.ts` (ws-02).** ws-06, ws-07 and ws-08 need `Bootstrap.consent` to compile. Fixed: step 0 adds it as optional.
- [ ] **Step 0 item 4 does not typecheck as written.** Making `training` optional in `zConsentInput` breaks `features/auth/consent.ts` line 45 (`training: c.training` into a `Consent`), a file step 0 does not list. Fixed in `step0.md` section 6. Apply the same text to the Step 0 section of this plan.
- [ ] **`apps/web/src/main.tsx`, `app/App.tsx`, `api/queries.ts`, `lib/native.ts` (ws-02).** The Strava gating (settings-18) was given to ws-03, ws-04, ws-08 and ws-10 only. These four shared files start `/strava/sync` on every open and handle the Strava deep link. Fixed in workstreams.json: ws-02 critic-06.
- [ ] **`apps/web/scripts/check-styles.mjs` (ws-02) runs inside `pnpm test`.** ws-02 merges first, so main fails for every stream that has not yet converted its CSS. Fixed in workstreams.json: ws-02 critic-10.
- [ ] **Interfaces that cross streams without a contract.** Review these at merge: `features/goals/reminders.ts` (ws-06 changes it in goals-10; ws-10 binds a new switch to it in settings-34; ws-03 calls it; ws-02 cancels ids 7000 to 7006). `features/todos/todos.css` (ws-05 renames row classes in today-body-01; `features/goals/TodayGoal.tsx` in ws-06 imports that stylesheet). `features/goals/kit.css` and `Kit.tsx` (ws-06 raises selector weight in goals-08; Journal, Library and Reads in ws-07 use the kit). `features/sessions/SessionCard.tsx` and `actions.tsx` (ws-04; four Plan and Progress files in ws-08 render them). `features/onboarding/model.ts` and `controls.tsx` (ws-03; Settings pages in ws-10 import them). `styles/tokens.css` `--ink-4` (ws-02 darkens it in a11y-04; any feature that uses it for rings or hairlines must move to `--ink-faint` in its own stream).
- [ ] **`apps/web/ios/App/CapApp-SPM/Package.swift` is generated** ("DO NOT MODIFY"). gap-qua-03 asks ws-11 to set iOS 17 in "both Package.swift files". `npx cap sync` rewrites this one from the Xcode project, so set the target in `project.pbxproj` and let the sync carry it. The committed file also lacks the notifications plugin and the Health plugin until that sync runs on a Mac.

### 5. Fixes that would break an App Store rule or a third-party term

- [ ] **5a. Guideline 2.5.19 (new on October 16, 2026): remove, do not switch off.** The research corrected its own advice: "code that ships switched off is still dormant", and the penalty named is removal and account termination. The plan hides Strava behind a build flag (D2, C6), defers the feature intro sheets as dead code (section E) and checks the bundle only for `UiGallery` and `dev/ui`. Today's web bundle holds Strava strings in nine chunks. The intro sheets are mounted in `App.tsx` and show as soon as an account's `intros` setting is enrolled, which a change on the server can do after review. The `logbook` URL scheme stays registered though its documented use is the Strava return. Fixed in workstreams.json: critic-06 in ws-02, ws-03 and ws-11. When Strava returns, `features.strava` from the server is a remote switch: document it in the review notes for that release.
- [ ] **5b. Age checks are deferred with no gate.** Apple's age assurance page: where the law requires it "you must check the age of the people using your app". Apple names Texas (new accounts from June 4, 2026), Utah (May 6, 2026) and Louisiana (July 1, 2026). The plan launches in all three with an 18+ line and leaves gap-leg-22 "until the lawyer answers". Make owner task 3 a gate on owner task 37 (submit). If the answer is yes, the Declared Age Range bridge and its entitlement are a blocker for ws-11. Fixed in workstreams.json: ws-11 critic-13 records the gate.
- [ ] **5c. Two sentences the plan writes are not true.** copy-legal-17 puts "Backups clear within 5 days. Anything sent to Claude is cleared by Anthropic within 30 days." in the delete sheet. sec-09 and owner task 9 add an off-site nightly backup with no retention rule, so the first sentence fails the day it ships. Research row LEG-29 says Anthropic keeps flagged content up to 2 years, so the second is too strong. Fixed in workstreams.json: critic-05 in ws-01, ws-10 and ws-11.
- [ ] **5d. The policy names two processors; the plan uses four.** Owner task 15 names Anthropic and Fly.io. Owner task 6 adds a mail provider that receives email addresses, and owner task 9 adds a storage provider that receives the whole database. Both must be in the two policies and in the answer to the Nevada and Washington "processors" questions. Fixed in workstreams.json: ws-11 critic-05. Add both to owner task 15.
- [ ] **5e. Strava: unsetting the keys is not enough.** Owner task 9 unsets `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`. The owner's own Strava rows (activities, laps, zones, tokens) stay in the production database with no way to refresh them, against the seven-day cache rule (API Policy 6.2, research row LEG-40), and the authorization stays live at Strava. Order for owner task 9: deploy copy-legal-11, disconnect Strava in the app while the keys are still set (this deauthorizes and deletes), confirm the tables are empty, then unset the keys.
- [ ] **5f. "Crash Data, not linked to the user" may not hold.** sec-23 logs a hashed user id on every request, and the native app sends its session cookie with every call. Fixed in workstreams.json: ws-01 critic-04. If the route cannot be kept anonymous, change the label and the manifest to linked.
- [ ] **5g. Guideline 5.1.2(i) and "Not now".** Covered in section 3. Without critic-02 the app would send what a person types to a third-party AI after that person declined.

### 6. Claims in the plan that nobody verified

- [ ] **"Types only, no behaviour change, typecheck passes" (step 0).** False as written. See section 4.
- [ ] **"Read through the bootstrap" (Contract 1).** False today. See section 3.
- [ ] **"All Strava UI hidden by a build flag" means Strava is out of the binary.** Not measured. It depends on the bundler dropping code in about 50 files. The release check in critic-06 is the proof.
- [ ] **The reset link works for an iPhone user.** `<APP_URL>/login?reset=<token>` opens Safari and the web build, not the app (there are no universal links; the entitlement in ios-15 is for saved passwords only). Nobody walked this path. Add to ws-03 sec-04: after a reset on the web, the page says "Password changed. Open Logbook and sign in." Add the path to owner task 20.
- [ ] **The public web build has the right support address.** The Dockerfile sets no `VITE_` values, so the web build ships `support@example.com` from step 0. Fixed in workstreams.json: ws-01 critic-03.
- [ ] **The reviewer sees health numbers.** Owner task 31 expects "Progress shows health days" for the demo account, and the review notes say it is "pre-filled for a device with no Watch". ws-08's check says a phone that is not connected shows a Connect button. A reviewer who then connects an empty phone triggers a sync and a reconcile against seeded rows. Fixed in workstreams.json: ws-01 critic-09 and ws-08 critic-07. Say in the review notes that the demo numbers are sample data.
- [ ] **"Anything sent to Claude is cleared within 30 days" and "Backups clear within 5 days".** See 5c.
- [ ] **"AI assistant, powered by Claude" is allowed wording.** Anthropic's brand rules were not read. See section 2.
- [ ] **"Sets --ink-4 to the --ink-3 value so all 113 text uses pass without touching feature files" (a11y-04).** True for text. Not checked for the places that use `--ink-4` as a line or ring colour, which will get darker.
- [ ] **Texas, Utah and Louisiana dates.** Taken from Apple's news posts. The statutes were not read (the research says so). The lawyer confirms.
- [ ] **Swift, entitlement, privacy manifest and project file edits.** Written without a compiler. The plan says this. Nothing in sections B or F should be marked closed for ios-01, ios-02, ios-03 or ios-06 until owner task 18 has built the project.

### What the critic changed

- `workstreams.json` (scratch folder): 22 items added with ids `critic-01` to `critic-13`, notes and contract lists updated for ws-01, ws-02, ws-03, ws-08, ws-09, ws-10 and ws-11. No ownership path changed. Still valid JSON, same layout.
- `step0.md` (scratch folder): section 6 added (consent hooks move to `lib/consent.ts`, `Bootstrap.consent`, the `PrivacyFacts` prop, fixtures).
- This plan: this section only. Still to apply by the plan's author: the Step 0 text, Contract 1 (name `consent_required` and the three choices), Contract 4 (query key prefix, tiles draw without a device connection), a new Contract 10 (`lib/consent.ts` and the `PrivacyFacts` prop), the section C counts, owner tasks 3, 9, 10, 15 and 20, the Deferred row for onboarding-18, and the section F rows named in section 2.
