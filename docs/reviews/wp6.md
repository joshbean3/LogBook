# WP6 review: Journal, Progress, Reads (step 1); Settings, first run, /start (step 2)

Branch `feel/wp6`, on `feel/pages-base` (`400f8f5`: WP1 merged, every contracts §F export at its final signature). Spec `docs/feel.md` v4.2 §8, §14 tests 4, 50, 51 (and 9a for the real Progress and Journal links); build plan §7 (this step: items 1, 2b, 3, 4, 5 and acceptance #1, #2, #3, #9, #10, #10b, #10c). Settings, onboarding and auth are the next step (see "Left").

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`. Everything below was measured on this worktree's `VITE_FAKE_CLOCK=1` build served by `apps/api` on port 8840 (seed copy `S/wp6/test.db`), Playwright 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch, at 1× and 4× CPU.

## How to rerun

- `bash S/wp6/build.sh && bash S/wp6/serve.sh` (the server reads `index.html` once: restart after every build).
- `node S/wp6/qa/run.mjs` runs every script at 1× and 4× and writes `S/wp6/qa/results/TABLE.md`; `ONLY=t50-journal node run.mjs`, `RATES=4`, `--table` as WP1's runner. The harness is WP1's `lib.mjs`, repointed; `seed.mjs` logs in through the API and adds journal entries and Reads links (idempotent) before the app's first fetch, so the persisted cache is never stale.
- Screenshots: `node S/wp6/qa/shots.mjs <390|320> <before|after>`.

## Commits

| Commit | What |
|---|---|
| `b1c3234` | Journal: NavBar; Journal · Library Segmented (32 px) pinned under the bar; two mounted, memoised panes crossfading 150 ms with the outgoing pane held still by a transform; each segment keeps its own offset; `nav.replace` / `useRootRequest` / `useHomeControl`; composer (17/22, Save pill at 40 %, growth by FLIP); `QuoteLine` in the composer; `gestures.ts` deleted; entries from cache; FLIP lists; `FavStar` / `popFav`; Library's empty favourites row; Reads row pushes `/journal/reads` |
| `d5a3349` | Reads: `PushedBar`, no react-router, tab crossfade, SwipeRow v2 rows without height presence, haptics and toasts by the grammar |
| `63e60f0` | Progress: NavBar; builds from the loaded months with a quiet gap (`weekSeries(…, loaded)` + unit test); verdict 20/25 600 sans; range `Segmented`; `nav.go` links; `Connect Strava` → primer sheet |
| `de770a8` | One press (`PressButton`, no `:active`), no attribute (size) animation in the chart, scrub ticks `select` only, a test-build hook on `drafts.ts` |
| `72c1991` | The hidden pane is `content-visibility: hidden` (no `inert` / `pointer-events` flip on the commit frame) |

## Files changed and why

- `features/journal/JournalView.tsx`: rebuilt on `NavBar`, segment as page state (contracts §A.2/§A.3), M28's crossfade with per-segment `scrollTop`.
- `features/journal/JournalHome.tsx`: `QuoteLine` (Favourite · Hide, Undo) in the composer; the swiping `PromptQuoteLine`, the ribbon's 220 ms hold and its always-on non-passive `touchmove` gone (one clock, gesture-scoped listener); memory card without swipe (hold menu, crossfade, keeps what it shows until "Another memory"); `Open the day` → `nav.go`; timeline from cache, skeleton only offline with nothing cached.
- `features/journal/JournalDaySection.tsx`: `Composer` (`grow="flip"`, 32 px Save pill, `success` only on the day's first entry, no plain toast), `SaveButton`, `FavStar` in sheets and rows, no `layoutId` / `markShared`, row buttons press.
- `features/journal/Library.tsx`: Reads row → `nav.push('/journal/reads')`; one 60 row "No favourites yet"; star pops on `complete` with `toggle` at the apex; FLIP list and form; search moved to the Themes section's action (Journal's trailing slot stays empty, §2.4).
- `features/journal/feel.ts`, `FavStar.tsx`, `PressButton.tsx`, `seg.css` (new): the FLIP carry (`carry`, `carryScaleY`, `measureBelow`, `useListFlip`), the favourite pop, the row press, the 32 px in-page Segmented.
- `features/journal/prompt.ts`: reads `?at=` from `window.location` (no react-router).
- `features/journal/drafts.ts`: a test-build-only `window.__drafts` hook.
- `features/journal/gestures.ts`: deleted (spec §8).
- `features/reads/ReadsView.tsx`, `TodaysPick.tsx`, `reads.css`: the pushed page on `PushedBar`; Unread · Read from `useRouteParams` as page state; rows on SwipeRow v2; the read mark's `toggle` on its peak; no "Copied" / "Saved to your reads" toasts.
- `features/progress/ProgressView.tsx`, `data.ts`, `data.test.ts`, `MileageChart.tsx`, `sheets.tsx`, `useScrub.ts`, `progress.css`: see commit `63e60f0` and `de770a8`.
- `api/queries.ts`, `api/types.ts`: untouched in this step.

## Acceptance (build plan §7.4; measured, `S/wp6/qa/results/TABLE.md`)

**70/70 checks pass at 1×; 60/60 at 4× (10 static gates counted once).** WP1's own smoke (`smoke-wp1.mjs`, unchanged but for the port) 22/22 at 1× and 4×.

| 7.4 | Check | 1× | 4× |
|---|---|---|---|
| #1 [50] | Journal at `scrollTop` 300 → Library → Journal: 300 ± 1 | 300 | 300 |
| | both panes in the DOM mid-fade | 8 frames both between 0 and 1 | 8 |
| | the incoming pane 0 → 1 | 133 ms (longest frame 17) | 217 ms (longest frame 83, see Requests 1) |
| | first fade frame after touchend | 38 ms | 29 ms |
| | outgoing pane drift while it fades | 0.00 px | 0.00 px |
| | pathname `/journal` ⇄ `/journal/library`, `history.length` unchanged; Library keeps its own offset (120); 0 haptics over 4 switches; lit tab on Library → Journal segment | pass | pass |
| #2 [51] | `GET /api/months/2026-09` never answered, fresh context: `.skel` count | 0 | 0 |
| | chart: bars from loaded months; gap weeks | 4 bars; 5 gap weeks (Aug 31 – Sep 28) | same |
| | verdict | Inter 20px/25px 600 normal | same |
| | range: Segmented 3 segments, 6M checked, 0 haptics; 32 tall with 44 px targets; scrollWidth 390 | pass | pass |
| #3 [4] | Journal scrolled 600 → Today → Journal | 600 | 600 |
| | Reads row → one `push:/journal/reads:journal` nav event, +1 history entry, `PushedBar` "Reads"; → Today → Journal: Reads still on top | pass | pass |
| | ~90 px swipe: rests at `translateX(-72px)`, `data-revealed`, action a `BUTTON` 64 tall × 72 on screen, 0 threshold | pass | pass |
| | still open 1.6 s later; a tap on the bar closes it and does nothing else | pass | pass |
| | 0.62 W swipe: row gone, exactly 1 `threshold` (+ `delete`), toast "Deleted · Undo"; Undo restores | pass | pass |
| | chevron → `/journal/library`, 0 layers | pass | pass |
| #10b [9a] | week sheet `Open in Plan` → Plan active from one frame to the next, `/plan/week/2026-10-26`, caps "Next week · Oct 26 – Nov 1" on that first frame, `history.length` 5 = 4 + 1, no sheet; one Back → Progress, sheet closed | pass | pass |
| | Consistency day → `/today/2026-10-21` (cut); Back → Progress | pass | pass |
| | Journal memory `Open the day` → `/today/2026-09-17`; Back → Journal | pass | pass |
| | `Connect Strava` → `.sheet` with the primer, Progress still active, `/progress`; Later closes it | pass | pass |
| #10c | typing → `hasDraft(today)` true, 40 `subscribeDrafts` calls; the Close card (`?at=20:30`) shows the same words; Save clears the draft, the entry lands first, exactly 1 `success`; the Close card no longer holds them | pass | pass |
| reduced | the switch is still an opacity crossfade (5 frames mid-fade), panes animate opacity only; the composer grows with no carried transform | pass | pass |
| #9, #10 | static (`t-gates.sh`): no react-router import and no `window.scrollTo` under journal/progress/reads; no name from WP1's "Delete at integration" list; no height animation; no `:active`; `--sp-primary` unused; `gestures.ts` gone; `toggle`/`orb` only through `hapticAtPeak`; `success` only in the Composer; every toast has Undo or names a failure | 10/10 | — |

Gates (final tree): `tsc --noEmit` shared/api/web exit 0; shared 88, api 59, web 87 passed (WP1's 86 + the missing-month test); `pnpm --filter @logbook/web build` ok (entry chunk 938.6 kB raw, seams 935.1: the Composer the Close card imports grew by the FLIP helpers and `FavStar`).

## Hand-verifiable steps (fake-clock build, phone-sized window, touch emulation)

1. Journal tab. Expected: caps `SAT, OCT 24` (the date), large `Journal`, a 32 px `Journal | Library` control, nothing in the bar's trailing slot.
2. Scroll the Journal down past the composer. Expected: the bar collapses to `Journal`, the segmented control stays pinned under it.
3. Tap Library, scroll a little, tap Journal. Expected: each switch is a short crossfade, nothing slides; each side comes back where you left it.
4. Type four lines in the composer. Expected: Save goes from a faint pill to full blue on the first letter; each new line pushes the card and everything below smoothly (no jump).
5. Save. Expected: the words leave, "Saved" with a check for a moment, the entry is first in Entries. No toast.
6. Hold the quote line inside the composer. Expected: `Favourite · Hide`; Hide shows a toast with Undo and a new quote.
7. Library → Reads. Expected: Reads slides over Journal with the chevron "Back to Journal"; swipe a link left a little: it rests open with a red Delete; tap anywhere else: it closes; swipe further: it goes, toast with Undo.
8. Progress. Expected: the verdict in the plain sans (not italic), `3M | 6M | 1Y` as one control; no skeleton ever. Tap a future week's bar → the week sheet → "Open this week in Plan": Plan appears at once on that week; Back returns to Progress.
9. Go offline for one month (devtools: block `/api/months/2026-09`), fresh profile, open Progress. Expected: the chart draws with a dashed gap where September is, the line broken there.

## Audit findings this step closes

| Finding | Status | Where |
|---|---|---|
| critic C13: Journal's segment switch scrolls and slides | Fixed | crossfade, per-segment offset, `window.scrollTo` gone (test 50) |
| newuser 3.5: entries skeleton when cached | Fixed | gate is `!list.data && !navigator.onLine` |
| evening #11, visual F19: the composer | Fixed | 17/22, `--ink-3` placeholder, 32 px Save pill at 40 %, FLIP growth |
| visual S8: Library's empty favourites | Fixed | one 60 row |
| navlive M1: Reads off the stack | Fixed | `/journal/reads` pushed over Journal (test 4) |
| critic C11, shell F11: Progress waits on unprefetched months | Fixed | builds from what is loaded; gap (test 51) |
| visual F18: Progress serif verdict, chip row | Fixed | 20/25 sans; `Segmented` |
| critic C8: toasts | Fixed in these features | Undo or errors only (gate #9) |
| motion: height presence animations (`rowPresence`) in Journal, Library, Reads | Fixed | FLIP on `settle`, opacity in |
| nav F10/F17, critic D5 (Settings); newuser 1.10 (Welcome) | Left | next WP6 step |

## Requests

1. **WP1 (`app/Shell.tsx`)**: `--hdr` is a custom property on `.tab-scroll`, and custom properties inherit, so every write that changes it restyles the whole tab subtree. A Journal segment switch that restores an offset across 0–44 pays a ~420-element restyle on the next frame (≈ 30 ms at 4×; it is most of the 4× crossfade's 217 ms against 150). Write `--hdr` on `.nb-bar` / `.nb-title` / `.nb-strip` only, or register it with `@property { inherits: false }` and set it where it is read.
2. **Contracts §A.2**: a pushed page has no way to mirror page state into its path (`nav.replace` is root-only). Reads' `Unread · Read` therefore reads `/journal/reads/read` once and is local state after. Either add `nav.replaceTop(path)` or document it.
3. **WP2**: `Composer` now fires `success` itself on the day's first entry (the Close card's Save is that save); the Close card must not fire a second. `ComposerProps.toast` is a no-op (marked deprecated). `QuoteLine`'s Hide also asks for another quote. `TodaysPick` (mounted by the Close card) no longer toasts "Saved to your reads".
4. **Spec §8**: two readings to confirm. (a) The Journal Segmented is pinned under the bar once scrolled (like Today's strip), so the switch is reachable at any offset (test 50 switches at 300). (b) The Journal composer's text is 17/22 like its placeholder (one size, no jump on the first keystroke).
5. **Spec §1.3 / §8**: Progress shows `Connect Strava` as a quiet drill row whenever Strava is configured and not connected (the empty state's button alone is unreachable once runs exist). It opens the primer sheet; Settings keeps its door.
6. **Device day one**: `content-visibility: hidden` on Journal's hidden pane needs Safari 18 / WKWebView 18; older WebKit falls back to `visibility: hidden` (`@supports`), which restyles the pane on a switch.
7. **WP1, Delete at integration**: journal, progress and reads no longer use `TabHeader`, `PushedHeader`, `TAB_RESELECT`, `ContextMenu preview`, `rowPresence`, `shared()`, `layoutId`, `pressScale`, `--sp-primary`. Settings and onboarding still do until the next step.

## Screenshots (looked at)

`S/wp6/qa/shots/{before,after}-{390,320}-{journal,journal-scrolled,library,reads,progress,progress-scrolled}.png`; `t51-cpu1-progress-gap.png` (the gap), `t04-cpu4-reads.png`, `t10b-primer-sheet.png`, `dbg-composer-typed.png`, `dbg-composer-saved.png`. No horizontal overflow at 390 or 320; console clean.

## Step 2: Settings, onboarding, auth (2026-10-24)

Spec §8 (Settings, Onboarding, Toasts rows), §1.2/§1.6, §14 tests 25 and 54; build plan §7.2 items 6–9 and acceptance #4–#10.

### Commits

| Commit | What |
|---|---|
| `63b4c6e` | Settings: the pushed page of inset groups; every row a push at depth 2; `SettingsSection` for all seven sections; Plans row; Morning routine sheet; sign out without react-router; toasts and haptics by the grammar; HabitsPage on the one hold |
| `6bf3d02` | First run: the payoff is Today's first-run face at the hero slot, handed off in place (`handoff.ts`); `/welcome/strava` gone; the questions' edge swipe on pointer events; `/start` staged 0 / 80 / 160; the sign-up form rises in the same surface |
| `81176f3` | `/start` under reduced motion: a 150 ms fade (base.css's blanket 0.01 ms overridden on purpose) |

### Files changed and why

- `features/settings/SettingsView.tsx`: `PushedBar title="Settings"`, no trailing avatar, no `.s-me` hero. Groups `You · Training · Habits · Morning routine · Connections (when this server has Strava) · App · Data · Account`; every row `nav.push('/settings/<section>')`; `Plans` (Training group) → `nav.push('/settings/plans')`; `Morning routine` → `useOpenRoutineEditor()()` (large sheet, no route; `/morning?routine=1` gone). No react-router: the Strava hand-off's `?strava=` is read once from `location.search`.
- `features/settings/SettingsSection.tsx`: you · training · habits · connections · app · data · account, each under its own `PushedBar` ("Back to Settings" from the stack).
- `features/settings/SectionPages.tsx` (new): Connections (status, `Sync now` through WP1's `stravaSyncNow`, a confirm sheet to disconnect, the HR zones), App (Haptics switch, install), Data (Import/Export answer in their own row), Account (Sign out, Delete account).
- `features/settings/parts.tsx`: `SGroup` (Section + `.group`), `GoRow` (`Row` + value + chevron; press = the delegate's `--surface-2`), `Switch`. The react-router `Link`-based `SRow` and `initialOf` are gone.
- `features/settings/TrainingPages.tsx`, `HabitsPage.tsx`, `HrZones.tsx`, `account.tsx`, `settings.css`: `PushedBar`; the You page's avatar gone; rows in inset groups; HabitsPage on `Pressable` (`holdMenu` Rename · Move up · Move down · Archive, `onDragStart/Move/End` on the one 450 ms clock) instead of `useHoldDrag` / `liftFx` / `LONG_PRESS_MS`; the duplicate-habit note under the field, not a toast; `StravaLine.tsx` deleted; no `:active` rules.
- `features/auth/flag.ts`: `markSignedOut(qc)`: Sign out and Delete account set the quiet `['auth-session']` query to signed out; `Authed` then drops the cache and shows `signedOutHome()` (no `useNavigate` inside the framed app).
- `features/onboarding/Welcome.tsx`, `handoff.ts` (new), `onboarding.css`: the payoff (below); the race block fades (no height animation); the edge swipe on the screen's pointer events with `EDGE_PX / LOCK_PX / lockAxis / POP_COMMIT_FRAC / POP_COMMIT_V` (no `touchmove` listener on `document`); Skip on `Pressable`; `.ob` is its own scroller (no `100dvh`).
- `features/onboarding/controls.tsx`: DayLetters' hold is `onHold` (one `lift`, no extra `select`), the "one run day at least" shake is a WAAPI `translate` (no Pressable motion props); the long-run pill on `Pressable`. `StravaPrimer.tsx`: `springs.page` instead of a typed spring.
- `features/auth/Start.tsx`, `AuthScreens.tsx`, `auth.css`: the staged entrance (`.start-in` keyframes; delays 0 / 0 / 80 / 160; 240 ms, the `fadeIn` ease); Start fades the promise 100 ms and navigates with `state.from = 'start'`, so the sign-up `Frame` keeps the halo still and only its body rises (y 40 → 0 on `springs.page`); `.auth` / `.start` are their own scrollers.
- `api/queries.ts`, `api/types.ts`: untouched.

### The hand-off (§8 Onboarding, contracts §A.5)

The payoff's headline block is exactly `157px + var(--safe-t)` tall, so `FirstRunHero` sits on Today's hero slot. `Open Today` (or a row of the face) calls `handOff`: a deep copy of the payoff screen is put over everything as a plain DOM layer; `navigate('/today', { replace })` mounts the framed app under it at once; inside the copy the week rows and the foot fall (translateY 40 + fade, 200 ms) and the headline and halo fade; once Today's hero is painted (and the 200 ms have passed) the copy fades out in 200 ms, so the bar, strip and tab bar fade in around a hero that never moves. Reduced motion: opacity only, 150 ms. `Connect Strava` on the face opens the primer as a sheet over Today after the hand-off.

### Acceptance (measured; `S/wp6/qa/results/TABLE.md`, `run-step2.log`)

Whole battery (both steps): **145/147 at 1×, 128/130 at 4×** (17 static gates counted once). WP1's smoke 22/22 at 1× and 4× (its Settings › Training click repointed from the deleted `a[href]` / `.s-row` to the new Training row; same behaviour asserted).

| 7.4 | Check | 1× | 4× |
|---|---|---|---|
| #4 [25] | avatar → Settings → `Plans`: `matchRoute(pathname).tab === 'today'` on every frame (the app's own `matchRoute`, run in node on every recorded pathname) | pass, 106 frames, tabs = [today] | pass |
| #4 [25] | `pathname === '/settings/plans'`, Plans on top at depth 2; lit tab today on every frame; `.pushed` ≤ 2 on every frame; two pushes = two history entries | pass (max 2 layers) | pass |
| #4 [25] | chevron → `/settings` (1 layer), second chevron → `/today` (0 layers) | pass | pass |
| #4 (§8) | every section row pushes `/settings/<section>` at depth 2 over the mounted Settings (`push` event, lit today) and its chevron returns: you, training, habits, app, data, account | pass | pass |
| #5 | Morning routine → `.sheet[data-detent=large]` (title Timings), pathname `/settings`, no push (one `overlay` event) | pass | pass |
| #5 | `matchRoute('/settings/routine').redirect === '/settings'`; a cold start on `/settings/routine` shows Settings at `/settings` (1 layer) | pass | pass |
| #6 | no `.s-me`, no avatar on Settings' bar or any section bar | pass | pass |
| #6 | `.avatar` on Today 1, Journal 0, Progress 0 | pass | pass |
| #6 | INFO, not WP6's: Plan shows 1 avatar (the old PlanView header, WP4's); Today off today shows 1 (the old DayView header, WP2's) | recorded | recorded |
| #7 [54] | the payoff's FirstRunHero at 157 + safe-t (157.0 at 390 × 844, safe-t 0), 358 × 184 | pass | pass |
| #7 [54] | the first-run hero's top on every frame from the tap to the layer's removal: max drift | 0 px (21 frames) | 0 px |
| #7 [54] | Today's hero top after Open Today − the payoff hero top | **fail on this branch: +16** (Today is still the old DayView with WP2's FocusStrip above its header: hero at 173) | **fail: +16** |
| #7 [54] | same, on the preview build (WP2's current tree `eebb7f4` with WP6's six folders laid over it, `S/wp6/integ`, port 8841) | **pass: 0 px** (Today's `.hero` at 157) | **pass: 0 px** |
| #7 [54] | black frames across the hand-off (screencast, ≥ 90 % #000 below the status bar) | 0 of 49 (max ratio 0.786); preview 0 of 33 | 0 of 41; preview 0 of 39 |
| #7 [54] | the week rows (and the foot) animate `opacity` + `transform` only, to `translateY(40px)`, 200 ms; nothing else animates a layout property | pass | pass |
| #7 [54] | no route cut: the payoff or its copy is on every frame until Today's hero is painted under it | pass (8 frames before Today, 0 with neither) | pass (16, 0) |
| #7 [54] | the copy fades out in one 200 ms opacity animation after the fall, then is removed | pass (fade start to removal 233 ms; preview 267) | pass (317 ms; preview 217) |
| #7 [54] | lands on `/today`, Today lit, `history.length` unchanged (replace) | pass | pass |
| #8 | mark and title at 0 ms, sub at 80, Start at 160 (CSS opacity keyframes; only opacity + transform) | pass | pass |
| #8 | no skeleton with `/auth/status` held 3 s | pass | pass |
| #8 | visible ≤ 300 ms (median of 3 cold first visits, first frame with the title at opacity > 0.05) | **fail: 304 ms** (in the DOM at 277) | **fail: 931 ms** (in the DOM at 838) |
| #8 | Start → `/signup`: the form rises (first frame translateY 38.9, opacity 0.02); the halo holds (no second rise, never below 0.5 on 69 frames); inputs 17 px | pass | pass |
| #9 | every `toast(` in journal, progress, reads, settings carries Undo or an error | pass | static |
| #10 | no react-router import in journal, progress, settings, reads; onboarding/auth import it only in Welcome.tsx, AuthScreens.tsx, Start.tsx; no `window.scrollTo` | pass | static |
| reduced | hand-off: opacity only, 150 ms, hero drift 0; `/start`: `start-fade` 150 ms at 0 / 0 / 80 / 160; Settings → Plans still pushes | 6/6 | 6/6 |
| extra | Habits: a 560 ms hold opens 4 items with exactly 1 `lift`; hold + 128 px drag moves the first habit two slots with `lift, select, select, drop`; saved after reload; Sign out lands on `/login`, no toast | 7/7 | 7/7 |
| extra | the questions: no `touchmove` on `document`; a day tap toggles; a hold makes the long run with exactly 1 `lift`; the edge swipe goes back; Skip; the payoff; `/welcome/strava` is no step | 9/9 | 9/9 |

The two misses, measured against the pre-step build (`c16de5f`, built in `S/wp6/base`, port 8842, same script): **#8** the title became visible at **851 ms** at 1× and **1493 ms** at 4× before this step (it faded in after a 450 ms delay); now **304** and **931**. What remains is the time to insert the DOM (277 ms / 838 ms, unchanged by this step: before it was 361 / 956): the 938 kB entry chunk downloads by ~85 ms and executes for ~190 ms at 1× before React renders anything. That is a shell request (below). **#7's landing** is WP2's header on this branch; with WP2's tree it lands at 0 px.

Gates: `tsc --noEmit` shared/api/web exit 0; shared 88, api 59, web 87 passed; `pnpm --filter @logbook/web build` ok (entry 937.66 kB raw / 308.55 kB gzip; step 1: 938.6 kB). Static gates 17/17 (`S/wp6/qa/t-gates.sh`, now over all six WP6 folders: react-router, `window.scrollTo`, deprecated names, Pressable motion props, height animations, `:active`, `100dvh`, document touch listeners, `--sp-primary`, `.s-me`/Avatar, `routine=1`, `/welcome/strava`, toggle/orb/success haptics, toasts).

### Hand-verifiable steps (step 2)

1. Today → avatar: Settings slides in over Today; the bar reads Settings with no avatar; eight groups (Connections only on a server with Strava).
2. Tap `Plans` (Training group): Plans slides in at depth 2, Today stays lit; chevron → Settings; chevron → Today.
3. Tap `Timings` (Morning routine): the routine editor rises as a large sheet; the URL stays `/settings`; Back closes it.
4. Open `/settings/routine` directly: Settings at `/settings`.
5. Settings › Habits: hold a habit 450 ms → it lifts with Rename · Move up · Move down · Archive; hold and drag → siblings move aside, a tick per slot, a drop on release; the order holds after a reload.
6. Settings › Account › Sign out: the sign-in screen, no toast.
7. Sign up a new account, answer the four questions (swipe from the left edge to go back), reach the payoff: the setup face sits where Today's hero will be. Open Today: the week falls away, Today's bar, strip and tab bar fade in, the face does not move.
8. Sign out, open `/start` on a fresh browser: mark and title, then the line, then Start, about 80 ms apart. Start: the promise fades and the form rises with the light behind it holding still.
9. With Reduce Motion on, 7 and 8 are fades only.

### Audit findings this step closes

| Finding | Status | Where |
|---|---|---|
| nav F10 / F17: Settings rows leave the stack (`/morning?routine=1`, links) | Fixed | every row a depth-2 push or a sheet (#4, #5) |
| critic D5: the ringed avatar on Settings, avatars on other bars | Fixed in WP6's pages | #6 (Plan's and Today's bars are WP4's and WP2's) |
| newuser 1.10: the payoff's leave animation and the route cut into Today | Fixed | the hand-off (#7) |
| §0.2 First launch: `/start` staged, the form in the same surface | Fixed (staging); first-visible time is the shell's | #8 |
| critic C8: toasts in Settings (connected, disconnected, synced, saved file, plan restored, account deleted) | Fixed | gate #9 |
| §12: a `touchmove` listener on `document` (Welcome's edge swipe) | Fixed | pointer events on the screen (flow check) |
| §10: height animation (Welcome's race block), `100dvh` (onboarding, auth), `:active` scale rules | Fixed | static gates |
| WP1's requests to WP6: the eight sections; the onboarding Pressable `animate` nudge; `onLongPress`; `LONG_PRESS_MS`, `liftFx`, `useHoldDrag` in Settings | Fixed | rule-5 gates |

### Requests (step 2)

8. **WP1 / WP5 (entry bundle, `/start`)**: 7.4 #8's 300 ms is not reachable from `features/auth`: the DOM of `/start` is inserted at 277 ms (1×) / 838 ms (4×) because the whole 938 kB entry chunk must execute first. Either render the promise from `index.html` (static markup the app replaces), or split `Start`/`Login`/`Signup` into their own entry so a signed-out first visit does not evaluate Today.
9. **WP2**: the payoff hands off to Today's hero slot at 157 + safe-t (contracts §A.5). On this branch the old DayView puts it at 173 (FocusStrip above the header); WP2's DayPage puts it at 157 (measured, 0 px). Also: after onboarding with habits picked and a plan written, WP2's first-run condition (`no runs && (!plan || !habits)`) shows the rest/tomorrow face, not `FirstRunHero`; the rect does not move, but the content crossfades. If "the payoff **is** this face" (§8) should hold literally, Today should show the setup face on the day onboarding finishes.
10. **API (WP2/WP3's files or a shared request)**: Strava's OAuth return lands on `/settings?strava=…` (`routes/strava.ts:25`); `/settings/connections` is now where the status lives. Landing there would show the answer without a tap.
11. **WP1 (`App.tsx`)**: Sign out writes `['auth-session']` (`markSignedOut`), a key `App.tsx` owns. An exported `signedOut(qc)` beside `useSession` would keep the key in one place.
12. **WP1, smoke**: `smoke.mjs` clicks `a[href="/settings/training"], .s-row` on Settings; those are gone (rows are `Row`s that push). WP6's copy uses `.pushed .s-go:has-text("Run days")`.
13. **Spec §11.4**: the App page's Haptics switch fires one `toggle` when it is turned on (the only way to feel the setting); listed as the one exception in the gate.
14. **WP1, Delete at integration**: WP6's folders no longer use any name on the list (`TabHeader`, `PushedHeader`, `BackButton({onBack})`, `useLongPress`/`LONG_PRESS_MS`, `TAB_RESELECT`, the motion aliases, `liftFx`/`useHoldDrag`'s aliases, `shared()`/`layoutId` on sheets, `pressScale`/`onLongPress`/Pressable motion props, `preview`, `--sp-primary`). `RouterBridge` is WP1's to delete after WP6 lands (build plan §7.5, §8.3); it is untouched here.

### Screenshots (step 2, looked at)

Before / after at 390 and 320: `S/wp6/qa/shots/s2-{before,after}-{390,320}-{settings,settings-bottom,settings-you,settings-training,settings-habits,settings-connections,settings-app,settings-data,settings-account,payoff,start,start-form}.png`; `t54-cpu{1,4}-{payoff,today}.png`, `t08-cpu{1,4}-start.png`. No horizontal overflow at either width; console clean in every script.

## Left

- The two measured misses above are other packages' (requests 8, 9). `connections` is reachable only on a server with Strava configured (the seed has none); its page was checked by screenshot, not by a Strava round trip.
- Device day one: the hand-off layer is a DOM deep clone; on WKWebView confirm no flash when the copy is inserted (fonts and the halo are already decoded).
