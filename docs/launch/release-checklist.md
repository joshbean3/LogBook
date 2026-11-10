# Release checklist

What to do for every build that goes to TestFlight or the App Store. The owner tasks in `docs/launch/plan.md` (section D) say what to set up once; this is the loop for each release.

## Before the build

1. **Decisions.** Nothing in `docs/launch/decisions.md` changed without its "If it changes" column being followed.
2. **Legal pages.** `docs/launch/legal-fields.json` is complete and `approved` is `true`. Run `pnpm legal` after any change and commit the pages. Deploy the server so the pages are live, then open all four signed out on a phone:
   `/legal/privacy.html`, `/legal/health-privacy.html`, `/legal/terms.html`, `/legal/support.html`.
3. **Privacy sentences.** Run `node scripts/privacy-claims.mjs --check`, then re-read `docs/launch/privacy-claims.md`: every sentence beside the code it describes. Do this whenever a privacy sentence, a Claude call, the Apple Health types or a retention number changed since the last release. A sentence that is not true gets fixed, not listed.
4. **Tests.** `pnpm typecheck` and `pnpm test` pass on the release commit, and CI is green on it (`.github/workflows/ci.yml`: the build checks, the spelling check, the end-to-end flows and the accessibility scan at 390 and 320 wide). After any dependency change run `pnpm notices` and commit `apps/web/public/legal/acknowledgements.html`.
5. **Settings.** Put the three values in `.env.release` in the repo root (git ignores it):

   ```
   VITE_API_ORIGIN=https://api.<your domain>
   VITE_SITE_ORIGIN=https://<your domain>
   VITE_SUPPORT_EMAIL=<support address>
   ```

   `VITE_SUPPORT_EMAIL` must be the `supportEmail` in `legal-fields.json`. Do not set `VITE_FEATURE_STRAVA`.
6. **Once, before the first release:** on the Mac run `npx cap sync ios` in `apps/web` and check that `CapApp-SPM/Package.swift` now lists the local notifications and Apple Health plugins and says `.iOS(.v17)`; commit it with `App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`. On the App ID (developer.apple.com, Identifiers) turn on HealthKit and Associated Domains. Make the server answer `https://<api host>/.well-known/apple-app-site-association` with `{"webcredentials":{"apps":["<Team ID>.com.joshbean.logbook"]}}`.
7. **Commit everything**, including the Xcode project if Xcode changed it (the signing team), and `apps/web/ios/App/CapApp-SPM/Package.swift` if `npx cap sync ios` rewrote it.
8. **Tag** the commit: `git tag v1.0.0` (the version comes from the tag).

## The build

Run `pnpm ios:release` on the Mac. It stops with a red line at the first problem. It checks, in order:

| Step | What fails it |
|---|---|
| The commit | No tag `vX.Y.Z` on this commit, or a working tree with changes. |
| The settings | No server address, a `fly.dev` or http address, no support address, an `example.com` address, an address that differs from the legal pages, `VITE_FEATURE_STRAVA=1`. |
| Legal pages | A page that is out of date, still a draft, or missing a fact. |
| Privacy sentences | A privacy sentence in the app that `privacy-claims.md` does not list. |
| The iOS project | A changed purpose string, a URL scheme, an iPad block, a missing entitlement or privacy manifest entry, a fourth Apple Health type, a source name in an upload. |
| The built files | `UiGallery`, `PagerLab`, `StubRoots` or `dev/ui`; any "Strava" or `/strava` path; a build that does not carry this commit. Checked in `apps/web/dist` and again in the iOS project after sync. |
| After sync | `capacitor.config.json` with `server.url`, `server.cleartext`, `server.allowNavigation` or `webContentsDebuggingEnabled`; a Capacitor plugin missing from `CapApp-SPM/Package.swift`; a `Package.swift` that sync changed. |

Then it writes the version and a build number (the commit count, so it rises with every release; set `BUILD_NUMBER` to override) into the Xcode project and opens Xcode.

## In Xcode

1. Choose "Any iOS Device". Product, Archive.
2. In Organizer: right click the archive, Generate Privacy Report. It must match the App Privacy answers and `PrivacyInfo.xcprivacy`.
3. Validate App, then Distribute App. Keep "Upload your app's symbols" ticked.
4. Read the upload email. An ITMS-91056 line means the privacy manifest needs a fix.

## On a phone, from TestFlight

1. Settings, About reads "Version X.Y.Z (commit)" with this release's commit.
2. Run `docs/launch/qa-matrix.md` (the device pass, owner task 20).
3. Sign in with the review demo account. Every link opens. No placeholder text. Progress shows the sample health numbers. A new account can still be made.
4. Apple's permission sheet for Apple Health lists three types. The camera and photo sheets read as in `privacy-claims.md` section 5.

## Before pressing Submit

1. `docs/launch/review-notes.md`: the three values filled in, pasted into App Review Information.
2. The age assurance gate in `decisions.md` has the lawyer's answer.
3. The store text names only what this build has. No Strava. "Works with the Apple Health app".
4. Keep the server up and unchanged, sign-up open and the AI key funded while the build is in review.

## Your own phone, any day

`pnpm ios:fresh` builds the development build (with Strava) from the latest pushed code on the current branch and opens Xcode. It is never the build you upload.
