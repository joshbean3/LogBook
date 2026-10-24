# WP5 review: shell, cold start and performance

Branch `worktree-wf_ad40b2ff-09a-1`, nine commits on top of `0c403c9`. Spec: `scratchpad/feel/decisions.md` "Shell", shell audit F1–F16/S3/S4, perf report §1/§4c/§6, critic C1/C10, flows 1.1/1.2, webview research P2/P5/P9/P10/P12.

Measurements were taken against this worktree's own build served by `apps/api` on port 8861 (seed DB copy), with Playwright at 390×844, DPR 2, touch, CPU throttling and Slow 4G through CDP, the same way the perf report did. Scripts, raw JSON and screenshots: `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel/wp5/` (`fg.mjs`, `fg2.mjs`, `cold.mjs`, `auth-paths.mjs`, `surfaces.mjs`, `auth.mjs`, `pinch.mjs`, `pinch2.mjs`, `longpress.mjs`, `restart.sh`, `*.json`, `*.log`, `shots/`). One thing to know when reproducing: `apps/api/src/index.ts` reads `index.html` once at startup, so the server must be restarted after every web build or `/login` and every other non-file path serves the previous bundle's hashes (`restart.sh` does this and checks the served hash).

## What changed, per step

### 1–3 (committed before the container restart, unchanged here)
`2768b8f` compressed assets (brotli/gzip siblings at build time, sent with `Content-Encoding`), `b0105f1` fonts (three preloaded faces, `fonts.css` inlined, `font-display: block` on native, metric-matched fallbacks on the web), `618652d` service worker registered after the first screen and no font precache.

### 4. Capacitor shell — `376e6d5`
- `apps/web/ios/App/App/LogbookViewController.swift` (new): `class LogbookViewController: CAPBridgeViewController`, overriding `capacitorDidLoad()`, which `CAPBridgeViewController.loadView()` calls right after `prepareWebView` (the place Capacitor sets `scrollView.bounces = false`, `node_modules/.pnpm/@capacitor+ios@8.5.3_*/node_modules/@capacitor/ios/Capacitor/Capacitor/CAPBridgeViewController.swift:53, 301`). It sets `bounces = true`, `alwaysBounceVertical = true`, `contentInsetAdjustmentBehavior = .never` and `allowsLinkPreview = false`. `webView` is `public fileprivate(set)` on the base class (line 11) so it is readable from the subclass; `capacitorDidLoad` is `open` (line 164). Read against the installed source, not compiled (no Xcode here).
- Wired in: `SceneDelegate.swift` instantiates it; `Base.lproj/Main.storyboard` now names `LogbookViewController` (module `App`, `customModuleProvider="target"`) instead of `CAPBridgeViewController`, since `Info.plist` still points the scene at `Main`; `App.xcodeproj/project.pbxproj` has the file reference, group entry and Sources build phase entry.
- `apps/web/capacitor.config.ts`: `ios.allowsLinkPreview: false`.
- `apps/web/src/styles/base.css`: `html { overscroll-behavior-y: contain }` (was `none`); `body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: manipulation }`; selection and callout re-enabled on `input, textarea, [contenteditable='true'], .esheet-text, .dsheet-text, .quote-text` (the journal entry sheet and day sheet text, and the library quote).
- `Base.lproj/LaunchScreen.storyboard`: image view background is sRGB black instead of `systemBackgroundColor` (the `systemColor` resource is gone), so the launch frame is black in light mode too.
- Not touched: the Keyboard plugin's `resize` mode (WP1).

### 5. Foreground cascade — `ea627ab`
- `apps/web/src/api/queries.ts`: `fetchBootstrap` drops `serverTime` from the response before it is cached, so a refetch that brings nothing new keeps the cached object's identity (TanStack structural sharing). `useMonths` keys its memo on data identity alone (the `dataUpdatedAt` part of the signature made every identical refetch rebuild every snapshot, shell F12). `usePick` loses its own `refetchOnWindowFocus: 'always'` and follows the rule below.
- `apps/web/src/api/types.ts`: `serverTime` removed from `Bootstrap` (nothing read it). The API still sends it.
- `apps/web/src/app/App.tsx`: the post-bootstrap effect is keyed on `!!boot.data` and guarded by a `useRef` so `markHasAccount`, the outbox replay, `prefetchViews`, `prefetchAll` and the service worker start run once per session.
- `apps/web/src/main.tsx`: `refetchOnWindowFocus: false` by default; the `visibilitychange` handler replays the outbox, invalidates the bootstrap, and when that answer differs from the cached one or a dated query (`month`, `todos`, `daily`, `journal`, `reads`, `reads-pick`, `activities`) is older than five minutes, invalidates those active queries. The blind 6 s month invalidation is gone. With Strava connected the return also asks `/strava/sync` once the bootstrap has answered (the server joins the sync the bootstrap kicked off and answers when it is done; `syncStrava` in `queries.ts`), and the months are refetched only on a `changed` answer: the data half of decisions.md 7. (Reviewer's fix: the first version relied on `useStravaPull`, which only listens to the pull-to-refresh event, so a run synced on foreground was not drawn until the next return or a pull.)

### 6. Cold start sequence — `f410c93`
- `apps/web/src/app/App.tsx`: `DayView` is a static import (in the entry bundle; `views.day` and its preload are gone), so `/today` can never show the `Quiet` Suspense fallback. `Authed` reads `useIsRestoring()` and returns `null` (black canvas) while the persisted cache is read instead of a skeleton; `useBootstrap` is enabled when the session is known **or** `hasAccountHere()` was true at mount, so a returning device paints from the cache while `/auth/status` is verified in the background (a `signedIn: false` answer still removes the cache and redirects; a 401 still routes to sign-in through `onUnauthorized`); a first visit (`!hasAccountHere()`, no cache, status unknown) goes to `/start` at once. `PageFade` gives the first page of the session `page-first` (no opacity animation) and later tab pages keep `page-enter`.
- `apps/web/src/app/shell.css`: `.page-first { min-height: 100dvh }`.
- `apps/web/src/features/auth/Start.tsx`: a visitor the status reports as signed in is marked (`markHasAccount`) and sent to `/today`, so the device-flag shortcut cannot strand a live session on the promise screen.

### 7. Tab bar, sticky header, scrim — `06e3da8`
- `apps/web/src/app/shell.css` `.tabbar`: `background: var(--surface)` + the existing `border-top` hairline; no `backdrop-filter`.
- `apps/web/src/styles/foundation.css` `.pushed-head`: `var(--surface)` + `box-shadow: 0 1px 0 var(--line-strong)`; no blur. `.cm-scrim`: no blur, so the ContextMenu's `opacity` animation is the only thing that animates.

### 8. Auth — `50cf532`
- `apps/web/src/features/auth/AuthScreens.tsx`: `nextOn(ref)` handles Enter on the email field (login and sign-up) with `preventDefault` + focus on the password; sign-up has two fields (the confirm field, its state, ref and `confirmProblem` are gone; Show stays), the password's `enterKeyHint` is `go`, the `onBlur` validations are gone, and `submit` is the only place errors are set.

### 9. Plan pinch — `f2d1ccc`
- `apps/web/src/features/plan/PlanView.tsx`: the non-passive `touchmove` listener is added inside the two-finger `touchstart` and removed in `touchend`/`touchcancel` (and on unmount). `touchend`/`touchcancel` are passive.

## Numbers

| What | Before | After | Script |
|---|---|---|---|
| Foreground return after 32 s idle (critic C1 method) | 11 requests: `/bootstrap`, 5× `/months`, `/todos`, `/journal`, `/reads`, then `/months/2026-10` and `-11` again at +6 s | **1 request**: `/bootstrap` | `fg.mjs`, `fg-before.json`, `fg-after.json` |
| Same, after a change on the server (`PATCH /me`) | (every return was the cascade) | 4: `/bootstrap`, the two active months, `/todos` | `fg2.mjs`, `fg2-after.json` |
| Warm open, CPU 4x, Slow 4G: frame sequence (DOM states) | black 68 → skeleton 483 → Quiet (black + tab bar) 611 → Today 967 ms | **black 56 → Today 774 ms**, nothing else | `cold.mjs`, `cold-before.log`, `cold-after.log` |
| Same, screencast frames | skeleton at 501, black+tab bar at 673, Today at 1032 | black until 154, Today complete at 816 (first content frame is the whole page) | `shots/cast-before-warm-cpu4-slow4g/`, `shots/cast-after-step6-warm-cpu4-slow4g/` |
| Warm open, no throttle | black → skeleton 144 → Quiet 164 → Today 262 ms | black → Today 207 ms | same |
| Warm open, CPU 4x, fast network | skeleton 485 → Quiet 602 → Today 1050 ms | black → Today 785–959 ms (two runs) | same |
| Warm cache, `/auth/status` held 3 s | Today waited for the status | Today at 143 ms | `auth-paths.mjs` |
| Expired session with a warm cache | — | Today from cache, then `/login` (black → today → black → auth) | `auth-paths.mjs` |
| First visit, status held 3 s | skeleton until the status answered (flows 1.2) | `/start` visible at 229 ms, no skeleton | `auth-paths.mjs` |
| API requests before the hero (warm) | 1 (`/auth/status`) | 1 (`/auth/status`, in the background) | `cold.mjs` |
| JS files in the build / entry size | 49 files; entry 640.8 KB (204.7 KB gz) + DayView 70.8 + SessionCard 51.8 + sheets 33.0 + Blocks 21.1 KB … | 26 files; entry 866.5 KB (283.7 KB gz; 339 KB brotli for all 23 compressed files, was 362 KB over 47) | build output |
| `.tabbar` / `.pushed-head` / `.cm-scrim` computed `backdrop-filter` | `blur(20px) saturate(1.5)` / same / `blur(12px)` | `none` / `none` / `none`; surfaces `rgb(17,17,17)` with a `rgba(255,255,255,.16)` hairline | `surfaces.mjs`, `surfaces.json`, `shots/s7-*.png` |
| Login: Enter on the email | submits, two red errors | focus moves to the password, no errors | `auth.mjs`, `auth.json` |
| Sign-up fields; short password blurred; Go | 3 fields; error on blur; — | 2 fields (`email`, `new-password`); no error on blur; "Use at least 8 characters." on Go only | `auth.mjs`, `shots/s8-signup.png` |
| Plan page touch listeners (CDP `getEventListeners`) | `touchmove (non-passive)` always | at rest / one finger: `touchstart, touchend, touchcancel` (passive); two fingers: + `touchmove (non-passive)`; after release: gone | `pinch2.mjs`, `pinch2.json` |
| Long-press menu (perf §4c method, `/today/2026-10-11`, hold 450 ms; 400 ms window after the hold) | 1x: 23/24 frames, 52 ms task; 4x: 12/24 frames, 12 dropped, worst gap 200 ms, 208 ms task | 1x: 24/24 frames, 0 dropped, no long task; 4x: 16/24 frames, 8 dropped, worst gap 150 ms, 147 ms task. What is left at 4x is the styled clone of the hero (`.cm-lift.has-preview`) mounting with the menu: motion #14, not a WP5 item | `longpress.mjs`, `longpress.json` |

Gates (all pass): `pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .`; shared tests 88/88; api tests 58/58; web tests 25/25; `pnpm --filter @logbook/web build`.

## Hand-verifiable steps

1. **Shell (needs a device or simulator):** `pnpm ios` build; on any page scroll past the top or bottom: it rubber-bands. Long-press the "Plan" tab or any link: no preview card. Long-press the serif title or a paragraph: no selection handles or callout. Long-press a journal entry in its sheet or a library quote: selection still works. Launch in light mode: the launch frame is black, not white. Xcode: the target compiles `LogbookViewController.swift` (listed in Sources) and the storyboard's class resolves.
2. **Foreground return (web):** sign in, open Today, wait 35 s, switch tabs away and back (or run `fg.mjs`): the Network panel shows one `/api/bootstrap`. Change the account name from another browser, come back: bootstrap plus the two active months and todos. Wait five minutes, come back: the active dated queries refetch once.
3. **Cold start (web):** sign in, reload `/today` with the Performance panel recording (CPU 4x): the first painted content is the whole Today page with the tab bar; no grey blocks, no empty page with a tab bar. Clear the site's cookies but not storage, reload: Today appears from the cache, then `/login`. In a private window: `/today` shows the promise screen at once.
4. **Surfaces:** scroll Reads under its header: the header is solid `#111` with a hairline. Hold the hero: the page dims, nothing blurs, the menu arrives without a stall.
5. **Auth:** on `/login`, type an email, press the keyboard's next: the password field is focused, nothing red. On `/signup` (needs `ALLOW_SIGNUP=1` on the API): two fields; type a 5-character password, tap elsewhere: nothing red; press Go: the one message.
6. **Plan:** scroll the week with one finger: it starts at once; pinch with two fingers: the month opens as before.

## Not done, and why

- The Swift was read against the installed Capacitor 8.5.3 source, not compiled (no Xcode in this container).
- Steps 1–3 were not re-measured: they were committed and verified before the restart; the cold-with-cache numbers above include them.
- The API still sends `serverTime` (harmless; the client drops it). Moving it to a header would be a one-line API change if wanted.
- `prefetchAll`'s range (shell F11: Plan and Progress still fetch a month on first tap) is unchanged: out of WP5's steps.
- The Keyboard plugin's `resize` mode and the `--kb` inset, the per-tab scroll containers, the pull-to-refresh on the native bounce, the splash hidden on the first content frame (shell F1.4/F16): WP1's structure, as the task said.
- `useMonths` keying on data identity alone is a small step past the letter of step 5 (it is what makes an identical refetch quiet all the way down); the earlier `dataUpdatedAt` term was redundant with the per-object version.
