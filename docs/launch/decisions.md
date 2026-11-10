# Launch decisions for Logbook 1.0

Date: 2026-11-10. These are the choices the 1.0 build, the store listing, the legal pages and the review notes are all written to. Change one here first, then change everything the "If it changes" column names. `docs/launch/plan.md` has the reasons at length.

## Scope

| # | Decision | 1.0 | Where it is built in | If it changes |
|---|---|---|---|---|
| D1 | Apple Health | In. Read only. Three types: sleep, heart rate variability, resting heart rate. Each is shown on Progress. Readings are saved to the Logbook account. Nothing from Apple Health goes to AI. | `HealthReader.readTypes`, `HealthSync.swift`, `App.entitlements`, `NSHealthShareUsageDescription`, `PrivacyInfo.xcprivacy` (Health), the server's accepted types | A new type needs a screen that shows it, then the Swift list, the purpose string, the connect sheet, both policies and `scripts/release-check.mjs` (`HEALTH_TYPES`) in the same change. To leave Apple Health out: build with `VITE_FEATURE_HEALTH=0`, remove `@logbook/capacitor-health` from `apps/web/package.json`, the purpose string, the entitlement and the Health entry in the manifest. |
| D2 | Strava | Not in the release build: no code, no copy, no URL scheme, no keys on the production server. The owner's own development build keeps it. | `STRAVA_BUILT` (`VITE_FEATURE_STRAVA=1` only in `pnpm ios` and `pnpm ios:fresh`), the bundle check in `pnpm ios:release`, `Info.plist` (no `CFBundleURLTypes`) | Every item in the plan's "Strava gate" list first. Then the policies, the review notes (name the server flag as a remote switch) and `Info.plist` gain Strava together. |
| D3 | Devices | iPhone only. Portrait only for 1.0. | `TARGETED_DEVICE_FAMILY = 1`, `UISupportedInterfaceOrientations` (portrait), no iPad orientation block | An iPad or landscape layout is its own project with its own screenshots. |
| D4 | Lowest iOS | iOS 17.0. | `IPHONEOS_DEPLOYMENT_TARGET` in the Xcode project and the Health plugin's `Package.swift`. Both still say 15.0 today; finding gap-qua-03 raises them, and the generated `CapApp-SPM/Package.swift` follows on the next `npx cap sync ios` | A lower target adds a device to the test matrix. |
| D5 | Storefront and units | United States only. Miles and pounds only. Weeks start on Monday. Clock times follow the phone's 12 or 24 hour setting. | App Store Connect availability; `mondayOf` in `packages/shared`; no units setting in the app | Other regions wait for a units setting and a legal review (GDPR, UK GDPR). |
| D6 | Minimum age | 18 or older. Said at sign-up, in the terms and in the privacy policy. App Store age rating overridden to 18+. | `MIN_AGE` in `apps/web/src/lib/copy.ts`, `terms.html` section 1 | A lower age needs the lawyer's read and Anthropic's safeguards for minors. |
| D7 | Server address | A domain the owner controls. Never a `fly.dev` address in a release. Read from the environment at build time. | `VITE_API_ORIGIN`, `VITE_SITE_ORIGIN`, checked by `scripts/release-check.mjs env` | The address is compiled into the binary and printed in the policy. Moving it means a new build. |

## Lead decisions made while building

- **Build line.** Settings keeps one line in the About group: "Version <version> (<short commit>)". The owner uses it to confirm the phone has the latest build. No build time, nothing that reads as a developer screen.
- **Two builds.** `pnpm ios` and `pnpm ios:fresh` make the owner's development build (Debug, with Strava, with the `logbook` URL scheme through the generated `Info-Dev.plist`). `pnpm ios:release` makes the App Store build (Release, no Strava, no URL scheme) and refuses to finish if it finds either.
- **Design.** 1.0 is a clean-up of the approved design, not a redesign.
- **Plans in the style of a coach or athlete.** Not in 1.0. The plan proposal flow and the plan `source` field stay as they are so it can be added.
- **Model names.** No model name or identifier is in the repository. The server reads them from its environment.
- **Light appearance.** The app is light only for 1.0.

## Age assurance gate

Apple's age assurance page says that where the law requires it "you must check the age of the people using your app". Apple names Texas (new Apple Accounts from June 4, 2026), Utah (May 6, 2026) and Louisiana (July 1, 2026). Logbook launches in all three with an "18 or older" line and no age check.

**Gate: Logbook is not submitted until the lawyer has answered whether these laws require Logbook to use Apple's Declared Age Range API (owner task 3).** If the answer is yes, a Swift bridge to that API and its entitlement become a blocker (finding gap-leg-22) and the submission waits for them.

| Question | Answer | Date | From |
|---|---|---|---|
| Do the Texas, Utah or Louisiana laws require Logbook to check age with the Declared Age Range API? | Not answered yet | | |

## Facts the owner confirms before approving the legal pages

The four pages in `apps/web/public/legal` are written from `docs/launch/legal-fields.json`. `pnpm ios:release` refuses to run while a field is empty, the support address is an example address, or `approved` is not `true`. After changing the file run `pnpm legal` and commit the pages.

| Field | Now | Confirm |
|---|---|---|
| `publisher` | empty | The legal name of the seller (your name or the LLC), the same as on the App Store. |
| `postalAddress` | empty | A postal address for the publisher. A P.O. box or registered agent works. |
| `supportEmail` | empty | The monitored support address. Must equal `VITE_SUPPORT_EMAIL`. |
| `effectiveDate` | empty | The day the pages go live, written out, for example "December 1, 2026". |
| `governingState` | empty | The state whose law governs the terms (lawyer). |
| `hostingProvider` | Fly.io | Still the host. |
| `mailProvider` | Resend | The provider chosen in owner task 6. The server's default endpoint is Resend's. |
| `backupProvider` | Cloudflare R2 | The bucket provider chosen in owner task 9. `apps/api/RUNBOOK.md` assumes Cloudflare R2. |
| `snapshotDays`, `backupDays` | 5 and 5 | `fly volumes show` and `BACKUP_KEEP_DAYS`. The Delete account sheet says the larger of the two. |
| `purgeDays` | 30 | Deleted items are removed for good within this many days. The server's purge must be live before the policy says so. |
| `logDays` | 30 | How long server logs are kept by the host. |
| `mailLogDays` | 30 | How long the mail provider keeps a record of sent mail on your plan. |
| `dataCountry` | the United States | The Fly region the volume is in. |

Also confirm these sentences, which are promises: "We usually answer within two business days" (support page); "Logbook is free" (terms, section 8); "at least 30 days' notice" before a shutdown (terms, section 9).

The lawyer reads all four pages (owner task 3). They are drafts until then.
