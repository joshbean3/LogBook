# WP6 review: Journal, Progress, Settings, Reads, onboarding, auth

Branch `feel/wp6`, on `feel/pages-base` (`400f8f5`: WP1 merged, every contracts §F export at its final signature). Spec `docs/feel.md` v4.2 §8, §14 tests 4, 25, 50, 51, 54 (and 9a for the real Progress and Journal links); build plan §7. Three steps: Journal, Progress and Reads (step 1); Settings, first run and `/start` (step 2); the QA lead's battery, WP1's battery on this build, screenshots and the fixes they found (QA step, first below). The step sections after it are kept as the record of what each step built.

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`. Everything below was measured on this worktree's `VITE_FAKE_CLOCK=1` build served by `apps/api` on port 8840 (seed copy `S/wp6/test.db`), Playwright 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch, at 1× and 4× CPU, on 2026-10-24 (the real date; the battery names no fixed date beyond the seeded ones).

## Fix round 1 (2026-10-25)

The two round-1 reviews (`S/wp6/review-code-1.md`, code F1–F13; `S/wp6/review-feel-1.md`, feel F1–F13). Finding → fix →
proof, one line each: `S/wp6/fix-1.md`. Fixes in `bcebd1a`.

### Result

- Every finding of severity ≥ 3 (code F1–F5, feel F1–F6) has a check in `S/wp6/qa/fix1/` that fails on the reviewed build
  (`ce512ad`, served on 8842 by `S/wp6/before1/serve.sh`) and passes on this branch, at 1× and 4×. Runner
  `S/wp6/qa/fix1/run-fix1.mjs` (`TAG=before|after`), tables `out/TABLE-before.md`, `out/TABLE-after.md`.
  **Before: 22/42 at 1×, 21/42 at 4× (f-visual: 6/16 at 1×). After: 62/62 at 1×, 62/62 at 4×.**
- Severity ≤ 2: code F6–F13 and feel F9, F10, F12, F13 fixed (proofs in `f-sev2`, `f-visual`); feel F7 and F8 are WP1's
  primitives (requests 16, 17); feel F11 is WP2's Today behind the copy (request 9 stands; 0 px on the WP2 + WP6 preview).
  Two polish items left as they are, with reasons (below). No finding was wrong.
- WP6's battery: **169/169 at 1×, 152/152 at 4×** (17 static gates; the gates lost two exceptions this round: the Haptics
  switch's own `toggle` and the "No link" toast). `S/wp6/qa/results-fix1/`.
- WP1's battery on this build (`S/wp6/wp1qa/`, `SHIFT_MIN=auto`): **611/619 at 1×, 577/591 at 4×** (QA step: 610/616,
  576/592). Six checks missed here that passed in the QA step's run: t09-push 10 (4×) and r2-layer c2-3 (4×) pass on a rerun;
  t12-sheet 12g (1×) passes on the rerun; t13-pager 15c (4×), t14-hold 14c (1×, menu at 461–466 ms for a 460 ms bound) and
  r4-nav c4-2a fail the same way on the reviewed build (`S/wp6/wp1qa-control/control-fix1.log`, same scripts on 8842). None
  is on a WP6 page. Logs: `wp1qa/run-fix1.log`, `rerun-fix1.log`, `results/TABLE-full-fix1.md`.
- Gates: `tsc --noEmit` shared/api/web exit 0; shared 88, api 59, web 87 passed; `pnpm --filter @logbook/web build` ok
  (entry 939.04 kB / 308.92 kB gzip).

### What changed (files, why)

| File | Change | Findings |
|---|---|---|
| `features/journal/feel.ts` | `useListFlip` reads "before" rects on the render that changes the list and "after" rects in that commit (screen rects both: no stale origin); `carry()` keeps and restores the element's own `transition`; `below()` stops at a `.j-pane`; `useBodyReady` / `useBodyFade` (a pushed page's body as a deferred render, faded in 120 ms) | feel F1, code F6, feel F4 |
| `features/journal/JournalView.tsx` | the switch's commit effect clears both panes' hold-still transform after cancelling the fades | code F1 |
| `features/journal/journal.css`, `JournalHome.tsx` | no focus ring on the in-card fields; theme names break between words (hyphenate), 20/24 under 360; no ghost rows in the entries' empty state | feel F5, F9, F10 |
| `features/reads/ReadsView.tsx`, `TodaysPick.tsx`, `reads.css` | the pick waits in the hero's own box; what is under the pick rides its size changes on `settle` (the pick's layout effect, ResizeObserver backstop, no read at mount); the tab mirrored with `nav.replace`; un-marking silent; no "No link" toast; the Read control fades in when it first appears; body deferred | feel F2, F4, code F9, F11, F12 |
| `features/settings/HabitsPage.tsx` | the drag on motion values with the DOM order fixed until the drop; one re-basing commit; no 1.5 s timer | code F4, F5 |
| `features/settings/SettingsView.tsx`, `SettingsSection.tsx`, `SectionPages.tsx` | bodies deferred behind the bar; `?strava=` cleared with `nav.replace('/settings')`; `HapticsRow` (root and App page) fires `toggle` through `hapticAtPeak`; "Signed in as · email" row; one Account group | feel F4, code F10, F13, feel F13 |
| `features/progress/MileageChart.tsx` | fade per range change; the line keyed `avg-<range>` (it shared the bars' key: React kept stray groups); month labels 36 px apart | code F3, feel F13 |
| `features/progress/ProgressView.tsx`, `sheets.tsx`, `progress.css` | a missing month: drill-downs wait, Total "Loading", a neutral verdict; "on plan" for adherence, "kept" for the week rule; the fresh page's sentence in sans | code F8, feel F6, F13 |
| `features/onboarding/Welcome.tsx`, `onboarding.css` | the edge swipe as a pushed page's back (the step before under it at −30 %, opaque dragged step with its own halo, no enter/exit at the swap); the payoff face's rows each do what they say after the hand-off; Strava primer only where it can connect; run-day discs inside the gutter | feel F3, code F2, F7, feel F12 |

### Measured (before → after; `S/wp6/qa/fix1/out/`)

| Check | Before (1× / 4×) | After (1× / 4×) |
|---|---|---|
| code F1: double switch 70 ms apart, stale transform | `translateY(-100px)`, composer top 61 under the control | none; composer 161 |
| code F2: payoff rows Add habits / Plan a week | `/today`, nothing open | habits sheet / `/plan/week/2026-10-19` |
| code F3: bar groups' min opacity on the first scrub | 0 / 0 | 1.00 / 1.00 (a range change still fades: full at 208 ms) |
| code F4: frames with the lifted habit > 20 px off the finger | 3 of 140 (−56 px) | 0 of 134 (median 0, max 12) |
| code F5: second reorder 0.5 s after a drop | lost | kept, screen and server |
| feel F1: worst excursion outside [from, to] ± 6 px | Journal Save 384–387 px; mark read 426 px | 0; 0 |
| feel F2: links' largest step when the pick lands | 176 px in one frame (10 539 px/s) | 26 px over 300 ms on `settle` |
| feel F3: frames with two questions over each other; under-step position | 4 frames; nothing under (black) | 0; −70.4 px at x 102 (= −0.3 × (W − x)) |
| feel F4: first moving frame, median of 3, 4× (Reads / Settings / Training) | 75 / 61 / 73 ms | 43 / 42 / 33 ms (1×: 31 / 31 / 30, unchanged); slide's longest frame ≤ 50 ms at 4× |
| feel F5: composer outline while typing | solid 2 px | none |
| feel F6 / F9 / F10 / F12 | "Kept" in both sheets; "Acceptance" broken at 320; 17 ghost elements; discs x 9–381 | "on plan" vs "kept"; none broken; 0; discs x 20–370 |

### Hand-verifiable steps (fix round 1)

1. Journal: scroll down a little, then tap Library and Journal quickly (a double tap). Expected: Journal comes back where it was, and scrolling to the top shows the whole composer under the control.
2. Journal: type six short lines (the box grows), then Save. Expected: the new entry fades in at the top of Entries and the others slide down from where they were; nothing flies up from the bottom.
3. Reads on the first open of a day: "Today's pick" waits in a full-size card; when the pick arrives the links under it do not jump (at most a short slide). Mark a link read: the Unread · Read control fades in and the rows slide.
4. Settings › Habits: hold a habit, drag it down past two others. Expected: it stays under your finger the whole way (no row-height jump at each slot), the others slide aside, it drops in place. Drag another one right after: it saves too.
5. Progress: press and slide on the chart right after opening the tab. Expected: the bars dim around the week, never blink out.
6. First run (a new account): on "Which days can you run?", drag from the left edge. Expected: the goal question is under it, offset left and dimmed, like a pushed page; let go past a third: it slides off and the goal question is simply there. On the payoff, tap "Plan a week": Today, then Plan at the first week.
7. Settings: Haptics is a switch on the main page; the Account row reads "Signed in as" with the email.

### Requests (new in fix round 1)

16. **WP1 (`ui/lift.ts`)**: for a `press="dim"` element the lift reads its start scale after `data-preholding` / `data-pressed` are cleared, so the quote line drops 1.02 → 1.00 on the lift frame and regrows (feel F7, `S/wp6/feel1/qprobe.mjs`). Read the scale before clearing them.
17. **WP1 (`Segmented`)**: at 4× the thumb starts 63–173 ms after the tap (motion, after the commit) while the switch's opacity fades start in 3–5 ms (feel F8). Move the thumb with WAAPI/CSS from the same commit, so the control and the content agree from the first frame.
18. **WP1 (push commit)**: with a bare pushed page (only `PushedBar`) the first moving frame at 4× is still 54–60 ms after touchend on a session's first push: the push's own synchronous commit (Shell, `PushedLayer`, and `width()` reading `clientWidth` inside `apply`, a forced layout of 8 ms at 4×). WP6's pages now add 0–10 ms on top (their bodies are deferred).
19. **WP2 (`FirstRunHero`)**, optional: a prop that leaves out rows the caller has already answered (the payoff answers habits and the week). WP6 now maps every row after the hand-off, so nothing is broken without it.

Retired this round: 2 (Reads mirrors its tab with `nav.replace`, which replaces the top pushed entry in place) and 13 (the Haptics switch fires `toggle` through `hapticAtPeak`).

### Left as is (reasons)

- feel F13: the Journal ribbon's first visible day is clipped at 390: it is a horizontal scroller and the clipped day is the cue that more days are to the left. The Connections page with one row: on a Strava server it also holds the connection's status and heart-rate zones; it cannot be exercised on the QA server (no Strava keys).
- feel F11: the double exposure during the hand-off is the seams base's old DayView behind the payoff's copy; on the WP2 + WP6 preview t54 lands at 0 px with 0 black frames (`t54-firstrun-integ` 9/9 at both rates). Re-check frame by frame at integration.
- feel F4 at 4×: the first push of a session is near the 70 ms budget because of request 18; the later ones are 22–45 ms.

## QA step (2026-10-24)

### Result

- **WP6's battery (build plan §7.4 #1–#10c, plus layout, sign-up and reduced motion): 169/169 at 1×, 152/152 at 4×** (17 static gates counted once), on `c69b338`. Runner `S/wp6/qa/run.mjs`; table `S/wp6/qa/results-qa/TABLE-final.md`; log `results-qa/run-qa3.log`.
- **WP1's battery on this build** (`S/wp6/wp1qa/`, WP1's scripts repointed at port 8840, `SHIFT_MIN=auto`): 609/616 at 1×, 566/592 at 4× after five checks that targeted the interim Settings page were restated against WP6's Settings (below). Every remaining miss is on WP1's gallery, stubs, sheets or the old Plan page, and each one either fails on the seams base too (control build, same scripts) or passes on a rerun of this build. None is on a page WP6 owns. Details under "WP1's battery".
- Gates: `tsc --noEmit` shared/api/web exit 0; shared 88, api 59, web 87 passed; `pnpm --filter @logbook/web build` ok (entry 937.84 kB).
- Two defects fixed in this step (`3d5853b` sign-up, `c69b338` from the screenshots); three tests restated where they could not be honestly measured as written (below).

### Commits (QA step)

| Commit | What |
|---|---|
| `3d5853b` | Sign-up: the form stays (busy) until the first question replaces it. Create account used to clear the cache under the form (its status query went pending, so it unmounted into an empty busy frame), and `Authed` stayed black until the new bootstrap answered and the Welcome chunk arrived: 15–20 empty frames, 317–433 ms (flows 1.2). Now the bootstrap and the first-run module are fetched first, and the cache is cleared and seeded on the same tick as the navigation. |
| `c69b338` | What the 390 and 320 screenshots showed: Progress's value column is `auto` (visual F18's last clause: no 88 px hole on rows without a number); Settings' drill-row subtitles wrap to two lines rather than ending in "…" at 320; shorter Data subtitle and habit placeholder; Library's empty-favourites hint fits on its one line; the payoff's week bars give the LONG tag room at 320. |

### Files changed in this step

- `features/auth/AuthScreens.tsx` (`Signup`): fetch `fetchBootstrap()` and the Welcome module before navigating; `qc.clear()` + `setQueryData(keys.bootstrap)` + `nav` in one tick; the form is not swapped for the empty `Frame` once the account exists.
- `features/progress/progress.css`, `ProgressView.tsx`: `.pg-row-val` has no min-width; an empty one is not drawn.
- `features/settings/settings.css`: `.s-go .lrow-sub` wraps to two lines (`-webkit-line-clamp: 2`), 10 px block padding on two-line rows. `SettingsView.tsx` (Data subtitle), `HabitsPage.tsx` (placeholder).
- `features/journal/Library.tsx`: "Swipe a quote right to keep it."
- `features/onboarding/onboarding.css`: inside the existing `@container page (max-width: 21rem)`, the week bars are 20 % (were 28 %).

### WP6's battery (measured; `S/wp6/qa/results-qa/TABLE-final.md`)

| 7.4 | Script | Checks | 1× | 4× | The numbers |
|---|---|---|---|---|---|
| #1 [50] | `t50-journal` | 17 | 17/17 | 17/17 | Journal 300 → Library → Journal: 300; Library keeps its own 120; both panes in the DOM on 8 mid-fade frames; outgoing pane drift 0.00 px; `history.length` unchanged; 0 haptics over 4 switches. Crossfade without a sampler: two 150 ms WAAPI opacity fades (nothing else animates), the incoming one finished 182 ms after touchend at 1× (budget 200), 240 ms at 4× (budget 270); longest animation frame of the switch 0 ms at 1× (none ≥ 50), 52–73 ms at 4× (budget 100) |
| #2 [51] | `t51-progress` | 10 | 10/10 | 10/10 | `/api/months/2026-09` held: 0 `.skel`; chart from the loaded months (4 bars), gap weeks Aug 31 – Sep 28; verdict Inter 20/25 600 normal; range `Segmented` 32 tall, 44 px targets |
| #3 [4] | `t04-reads` | 13 | 13/13 | 13/13 | Journal 600 → Today → Journal: 600; one `push` nav event, +1 history, Reads still on top after Today; a 72 px swipe released still rests at `translateX(-72px)`, action a 64 × 72 button, open 1.6 s later, a tap elsewhere closes it; a ⌈0.55 W⌉ = 215 px slow swipe commits with exactly 1 `threshold`, toast with Undo, Undo restores |
| #4 [25], #5, #6 | `t25-settings` | 20 | 20/20 | 20/20 | `matchRoute(pathname).tab === 'today'` on all 106 frames; `/settings/plans` at depth 2; `.pushed` ≤ 2 on every frame; chevrons → `/settings` → `/today`; six sections push and pop; Morning routine → `.sheet[data-detent=large]`, pathname `/settings`; `/settings/routine` redirects; no `.s-me`, no avatar on any Settings bar; avatar count Today 1, Journal 0, Progress 0 |
| extra | `t-settings-more` | 7 | 7/7 | 7/7 | Habits: hold 560 ms → 4 items, 1 `lift`; hold + drag 128 px → two slots, `lift, select, select, drop`; saved after reload; Sign out → `/login`, no toast |
| #7 [54] | `t54-firstrun` (+ `-integ`) | 9 + 9 | 18/18 | 18/18 | payoff hero at 157 + safe-t, 358 × 184; hero drift 0 px on every frame; 0 black of 48 / 39 screencast frames; rows animate opacity + `translateY(40px)` 200 ms only; the copy fades 1 → 0 in 200 ms then is removed. Landing on Today: **0 px** on the WP2 + WP6 preview (`S/wp6/integ`, WP2 `01f3271` + WP6 `c69b338`); INFO on this branch (+16, the seams base's DayView, see "Restated") |
| #8 | `t08-start` | 11 | 11/11 | 11/11 | mark + title at 0 ms, sub 80, Start 160 (opacity + transform keyframes); no skeleton with `/auth/status` held 3 s; the title visible **2 frames** after the app's first commit (27–37 ms at 1×, 56–103 ms at 4×). Absolute first-visible: 328 ms at 1×, 937 ms at 4× (INFO, see "Restated"); Start → the form rises in the same lit surface; inputs 17 px |
| extra | `t-onboarding-flow` | 9 | 9/9 | 9/9 | no `touchmove` on `document`; day tap toggles; hold → long run with 1 `lift`; edge swipe goes back; Skip; payoff; no `/welcome/strava` step |
| extra (flows 1.1, 1.2) | `t-signup` (+ `-probe`) | 7 + 7 | 14/14 | 14/14 | the keyboard's next on Email moves focus to the password, no submit, no error; Create account → `/welcome/goal`, 0 skeleton frames, the form stays until the route changes; after it 3 frames (33 ms) at 1×, 4 frames at 4× show App.tsx's empty welcome fallback (INFO; request 15); with WP1's one line (the probe build) **0 empty, 0 black** at both rates |
| #10b [9a] | `t10b-jumps` | 12 | 12/12 | 12/12 | `Open in Plan` → Plan in one frame at `/plan/week/2026-10-26`, caps on that frame, history +1, no sheet; Back → Progress; Consistency day → `/today/2026-10-21`; Journal `Open the day` → `/today/2026-09-17`; `Connect Strava` → primer sheet, Progress stays, pathname unchanged |
| #10c | `t10c-drafts` | 7 | 7/7 | 7/7 | typing → `hasDraft(today)` true, 40 `subscribeDrafts` calls; the Close card shows the same words; Save clears it, 1 `success` |
| reduced | `t-reduced`, `t-reduced2` | 4 + 6 | 10/10 | 10/10 | Journal switch opacity only; composer grows with no carried transform; hand-off opacity only 150 ms, hero drift 0; `/start` `start-fade` 150 ms at 0/0/80/160; Settings → Plans still pushes |
| [55] + targets | `t55-layout` (new) | 4 | 4/4 | 4/4 | 22 WP6 states (Journal, Library, Reads, Progress, Settings and its 8 pages, the 5 questions, the payoff, `/start`, `/signup`, `/login`) at 390 and 320, top and bottom of each scroller: `scrollWidth === innerWidth` everywhere; 225 interactive targets probed with `elementFromPoint` at centre ± 21 px, all ≥ 44 px each way (AT-only `.sr-only` / `.cm-sr` controls and probes landing on pinned chrome excluded, by design) |
| #9, #10 | `t-gates.sh` | 17 | 17/17 | static | no react-router under journal/progress/settings/reads (onboarding/auth only in `Welcome.tsx`, `AuthScreens.tsx`, `Start.tsx`); no `window.scrollTo`; no deprecated WP1 names; no height animation; no `:active`; no `100dvh`; no `document` touch listener; toasts carry Undo or an error |

### Restated (unmeasurable as written; why, and what decides instead)

1. **#8 "visible ≤ 300 ms"**: `/start` is in the DOM on the app's first React commit, which waits for the whole entry chunk to evaluate. Interleaved cold visits on this build and the seams base (`S/wp6/qa/t08-compare.mjs`, `results-qa/t08-compare*.json`): first commit 249 vs 274 ms at 1× (5 pairs) and **996 vs 977 ms at 4× (9 pairs)**, the same within noise. So the absolute number is the shell's (request 8), and the row reads INFO with its value. The deciding row measures WP6's part: the title is visible 2 frames after that commit at both rates. On the base it was 763 / 1437 ms (a 450 ms delayed fade); the absolute number varies with container load (258–397 ms at 1× across today's runs).
2. **#7 landing ± 2 px on this branch**: Today's page is WP2's; on `feel/wp6` it is still the seams base's DayView with its FocusStrip above the header, hero at 173. The row reads INFO with +16, and the preview row (WP2's real DayPage, rebuilt from `feel/wp2` `01f3271` with WP6's six folders) decides: 0 px at both rates.
3. **#1's sampled crossfade at 4×**: the per-frame recorder's `getComputedStyle` and `getBoundingClientRect` force style and layout under the 4× throttle and stretch the frames they sample (83–200 ms frames here, 217–350 ms readings over 5 runs). Without the recorder, Long Animation Frame entries show the switch frame at 53–68 ms (`qa/dbg/loaf50.mjs`). The sampled number stays as INFO at 4× (it decides at 1×: 133 ms). The sampler-free rows decide: WAAPI start → finish against touchend, plus the longest animation frame.
4. **t04's swipe distances** were tightened to the stated ones: exactly 72 px (was ~90) and ⌈0.55 W⌉ (was 0.62 W), both slow and held still before the lift, so distance commits, not the 600 px/s flick.
5. **New flows 1.2 rows**: the zero-empty and zero-black rows read INFO on this branch (3–4 frames of App.tsx's `fallback={null}`) and are decided on the probe build (this tree + the one line WP1 request 15 asks for): 0 and 0.

### WP1's battery on this build

`S/wp6/wp1qa/` is a copy of `S/wp1/qa/` with `DIR`, `BASE` (8840) and the worktree path changed; results `results-full1/TABLE.md` (full run on `3d5853b`, with the restated scripts) and `run-final-wp6pages.log` (the 17 scripts that touch WP6's pages, rerun on `c69b338`). Control: WP1's unmodified scripts against the seams base (`S/wp6/wp1qa-control/`, port 8842, built in a detached temporary worktree of `feel/pages-base`, removed afterwards).

**Restated against the real page** (WP1 tests that targeted the interim Settings WP6 replaced; same behaviour asserted, selector moved; each marked `RESTATED by WP6` in the script):

| Script / check | Interim target | Restated to | 1× | 4× |
|---|---|---|---|---|
| `smoke` Settings › Training | `a[href="/settings/training"], .s-row` | the Training group's first row (`.s-go` "Run days") | 22/22 | 22/22 |
| `t23-bridge` "Settings' Training row shows Training" | same | same | 13/13 | 13/13 |
| `r2-layer n1-rest` "at rest a tap on Settings opens its section" | the avatar's spot (the interim bar had a door there; WP6's bar has nothing trailing, spec §8) | the first section row (You) | pass | pass |
| `r3-layer c3-6` "Enter on Settings' first row opens it" | `.pushed a[href], .pushed button` | + `[role=button]` (WP6's rows are `Row role=button tabIndex=0`); Enter opens `/settings/you` | 16/16 | 16/16 |
| `r4-layer d1a` "a tap on Training while the push is 1–8 px from rest" | `a[href="/settings/training"]` | the Training row | 10/10 | 10/10 |

**What still misses, and whose** (this build's full run; this build's paired rerun; the control on the base; `S/wp6/qa/dbg/cmp-wp1.mjs`):

| Check | This build | Rerun | Base | Verdict |
|---|---|---|---|---|
| t01 touchend clears `data-pressed` (4×) | F | F | F | WP1's (tab bar, timing) |
| t01 scale by 2nd frame (4×), touchend clear (1×) | F | P | P | flaky |
| t02 [stub roots] 4× | P | P | F | WP1's, flaky |
| t02 [old pages, 60 ms tap] 1× / 4× (interim, outside WP1's totals) | F | F | P | not WP6: three alternating rounds on the **same fresh seed** read base 15.3–29.7 ms vs this build 18.1–29.2 ms (1×, 3 s or 0.5 s settle), 4× 52.9–117.6 vs 66.0–128.7; a trace of the cut shows the same style recalc (734–737 elements, 10–15 ms) and the same script (pointerup 3–4 ms) on both (`qa/dbg/trace-cut.mjs`). The full run's gap was the QA DB's extra rows, then noise |
| t12 12a (both), 12g (4×) | F | F | F | WP1's known (sheet first frame) |
| t12 12g 1× | F | P | P | flaky |
| t13 14 / 15c (4×) and 12 / 15a / 15c-3+1 (4×) | F / P | P / F | P | flaky (pager timing under 4×) |
| t14 14a, 14c (1×), 14c opacity (4×) | F | P | P | flaky |
| t14 14c (4×) | F | F | F | WP1's |
| tsw-swipe sw3, sw4 ×4 (4×, the gallery's swipe rows) | F | P | P | flaky |
| t20b sheet open (4×) | F | P | P | flaky |
| r1-sheet f5 1× (a Plan session row's sheet) | F | F | P | not WP6: three more alternating same-seed rounds read base 26.8–30.5 ms, this build 24.1–33.6 (both over 17); 4× F on both |
| r1-sheet f1, r1-press u4 (4×) | F | P | P | flaky |
| r2-layer c2-1 tap / drag-left (4×, an edge pop caught on WP6's Settings: "never in range") | F | P | P | harness: three more alternating 4× rounds fail one or two of the four c2-1 rows per run on **both** builds (base: 1, 1, 2; this build: 2, 1, 1); the catch window is missed under 4×, as WP3's QA also saw on Settings |
| r1-misc f8 (4×, frame-paced release velocity) | F | F | P | harness: the base fails it in 1 of 3 same-seed rounds too, and WP1's own final listed it |
| r2-layer c2-3, r2-sheet u1, r3-sheet u3-5, r4-sheet k4-1 (4×) | F | F | F | WP1's known |
| r4-nav c4-2a/b | mixed | mixed | mixed | flaky (fails on the base at 4× too) |

No WP1 check fails because of a WP6 page, and no miss is new against the base once seed and noise are controlled for. Confirmation on the final commit `c69b338` (`run-final-wp6pages.log`): the 17 WP1 scripts that open WP6's pages (smoke, t03, t04, t06, t08, t09b, t19-320, t22, t23, r1-a11y, r1-pager, r1-popall, r1-nav, r2-layer, r3-layer, r3-nav, r4-layer) all pass at 1×, and at 4× all but r2-layer c2-1 (above).

### Screenshots (all looked at, every one)

Before (`TAG=before`, the seams base `400f8f5`) and after (`c69b338`) at 390 and 320, 30 states each: `S/wp6/qa/shots/qa-{before,after}-{390,320}-<state>.png`, side by side in `S/wp6/qa/pairs/<width>-<state>.png` (60 sheets). States: journal, journal-scrolled, journal-composer, library, reads, reads-revealed, progress, progress-scrolled, progress-week, progress-primer, settings, settings-bottom, settings-routine, settings-{you,training,habits,connections,app,data,account,plans}, welcome, welcome-{goal,days,morning,habits}, payoff, start, signup, login. The base has no connections, app, data or account page (they redirected to `/settings`), no routine sheet (the row left the stack) and no Connect Strava door on Progress, so those six have only an after. Script `S/wp6/qa/shots-qa.mjs` (it stubs the bootstrap as Strava-configured, as t10b does, so the Strava doors show). No horizontal overflow in any shot. What they showed and what changed is `c69b338` above; the re-shot pairs after it (`S/wp6/qa/sheets/f1–f4.png`) were looked at again.

### Hand-verifiable steps (QA step)

1. Sign up a new account and tap Create account. Expected: the button stays (busy) and the first question replaces the form; at most a blink of black between them (the blink is request 15).
2. Progress, scroll to the rows (390 wide). Expected: Long run and Lifts on one line each; a row with no number has its sparkline next to the chevron, not 88 px left of it.
3. Settings at 320 wide (iPhone SE). Expected: every row's grey line reads in full on up to two lines (Strava's "See your runs land on Today."); only long values (the plan's name on Plans) end in "…".
4. First run at 320: on the payoff, Sunday's row reads `EASY 4  LONG` in full.
5. Journal › Library with no favourites. Expected: one row, "No favourites yet / Swipe a quote right to keep it."
6. Reads: drag a row left by about a thumb's width (72 px), stop, lift. Expected: it rests open on Delete until you tap elsewhere. Drag another slowly past half the row, hold, lift. Expected: one tick, the row goes, a toast with Undo.

### Requests (new in this step)

15. **WP1 (`app/App.tsx`)**: the welcome route's lazy view suspends once even when its module is loaded (React.lazy always does), and `<Suspense fallback={null}>` paints 3–4 empty frames between the sign-up form and the first question (33 ms at 1×, up to 200 ms at 4×: one black screencast frame). The fix is one line: have the `Welcome` view's own `preload()` run before sign-up ends, for example `void Welcome.preload()` once the sign-up screen mounts, or an exported `preloadView('welcome')` that `Signup` awaits instead of its `import()`. Measured on the probe build with that line (`S/wp6/probe/build.sh`): 0 empty and 0 black frames at both rates.
8 (updated). **WP1 / WP5**: `/start`'s first commit is the entry chunk's evaluation: 996 ms at 4× on this build vs 977 on the seams base (9 interleaved pairs), so no page can meet 300 ms at 4×. Static markup in `index.html` or a signed-out entry would.

Open from the earlier steps: 1 (`--hdr` inheritance), 2 (`nav.replaceTop`), 3 (WP2's Composer `success`), 4 and 5 (spec readings), 6 (device day one, `content-visibility`), 7 and 14 (Delete at integration: WP6 uses none of the names), 9 (WP2's hero slot; measured 0 px on the preview), 10 (Strava OAuth landing), 11 (`signedOut()` export), 12 (done: WP1's smoke restated here), 13 (the Haptics switch's own `toggle`).

### Audit findings this package was to close (all steps)

| Finding | Status | Evidence |
|---|---|---|
| critic C13: Journal's segment switch scrolls and slides | Fixed | t50: 300 ± 0, two 150 ms opacity fades, 0 drift |
| newuser 3.5: entries skeleton when cached | Fixed | gate `!list.data && !navigator.onLine` |
| evening #11, visual F19: the composer | Fixed | 17/22, `--ink-3`, 32 px Save at 40 %, FLIP growth |
| visual S8: Library's empty favourites | Fixed | one 60 row; its hint now fits at 320 (`c69b338`) |
| navlive M1: Reads off the stack | Fixed | t04: pushed over Journal, still on top after Today |
| critic C11, shell F11: Progress waits on unprefetched months | Fixed | t51: 0 `.skel`, a quiet gap |
| visual F18: serif verdict, chip row, reserved value column | Fixed | verdict 20/25 600 sans and `Segmented` (step 1); value column `auto` (`c69b338`) |
| spec §1.3: links into other tabs | Fixed | t10b: `nav.go` cuts, Back returns |
| critic C8: toasts | Fixed in WP6's features | gate: Undo or an error only (the host's timing is WP1's) |
| motion: `rowPresence` height animations (Journal, Library, Reads) | Fixed | FLIP on `settle`; gate: no height animation |
| nav F10 / F17, critic D5: Settings rows leave the stack; avatars | Fixed in WP6's pages | t25 (#4–#6); Plan's and Today's bars are WP4's and WP2's |
| newuser 1.10, flows 1.3: the payoff → Today cut | Fixed | t54: hero drift 0, 0 black frames, lands at 0 px on the preview |
| flows 1.1: next submits the sign-up form | Fixed | t-signup 1.1 |
| flows 1.2: skeleton and black frames in the first minute | Fixed for WP6's part | signed-out cold start: no skeleton (WP5, t08); after Create account: 15–20 empty frames → 3–4 (`3d5853b`); the last frames are request 15 (probe: 0) |
| flows 1.5: the Strava primer as a whole screen | Fixed | `/welcome/strava` gone; the card stays (t-onboarding-flow) |
| §0.2 first launch: `/start` staged, the form in the same surface | Fixed (staging, 2 frames); the 300 ms is the shell's | t08; request 8 |
| §12: `touchmove` on `document` (Welcome's edge swipe) | Fixed | t-onboarding-flow |
| §10: height animation, `100dvh`, `:active` in WP6's folders | Fixed | static gates |
| WP1's requests to WP6 (eight sections, Journal on NavBar + `useRootRequest`, the quote `preview`, onboarding's Pressable `animate`, `TAB_RESELECT`) | Fixed | rule-5 gates; t25 |
| flows 1.4, 1.6 (the first hero's two days; the word strip above the date) | Not WP6's | WP2's Today |

Nothing was rejected. One reading to note: 7.4 #3 says the chevron on Reads returns to `/journal`; Reads is pushed from the Library segment, so the chevron returns to `/journal/library`, the Journal root on the segment it was opened from (asserted that way).

### Left

- Requests 15 and 8 (WP1/WP5), 9 (WP2's hero slot, done on WP2's branch), 10, 11, 13; the spec readings 4 and 5.
- Device day one: the hand-off's DOM copy on WKWebView; `content-visibility` on older WebKit; a real Strava round trip through Settings › Connections (the QA server has no Strava keys; both doors were checked with the bootstrap stubbed as configured).

## Step 1: Journal, Progress, Reads (2026-10-24)

### How to rerun

- `bash S/wp6/build.sh && bash S/wp6/serve.sh` (the server reads `index.html` once: restart after every build).
- `node S/wp6/qa/run.mjs` runs every script at 1× and 4× and writes `S/wp6/qa/results/TABLE.md`; `ONLY=t50-journal node run.mjs`, `RATES=4`, `--table` as WP1's runner. The harness is WP1's `lib.mjs`, repointed; `seed.mjs` logs in through the API and adds journal entries and Reads links (idempotent) before the app's first fetch, so the persisted cache is never stale.
- Screenshots: `node S/wp6/qa/shots.mjs <390|320> <before|after>`.

### Commits

| Commit | What |
|---|---|
| `b1c3234` | Journal: NavBar; Journal · Library Segmented (32 px) pinned under the bar; two mounted, memoised panes crossfading 150 ms with the outgoing pane held still by a transform; each segment keeps its own offset; `nav.replace` / `useRootRequest` / `useHomeControl`; composer (17/22, Save pill at 40 %, growth by FLIP); `QuoteLine` in the composer; `gestures.ts` deleted; entries from cache; FLIP lists; `FavStar` / `popFav`; Library's empty favourites row; Reads row pushes `/journal/reads` |
| `d5a3349` | Reads: `PushedBar`, no react-router, tab crossfade, SwipeRow v2 rows without height presence, haptics and toasts by the grammar |
| `63e60f0` | Progress: NavBar; builds from the loaded months with a quiet gap (`weekSeries(…, loaded)` + unit test); verdict 20/25 600 sans; range `Segmented`; `nav.go` links; `Connect Strava` → primer sheet |
| `de770a8` | One press (`PressButton`, no `:active`), no attribute (size) animation in the chart, scrub ticks `select` only, a test-build hook on `drafts.ts` |
| `72c1991` | The hidden pane is `content-visibility: hidden` (no `inert` / `pointer-events` flip on the commit frame) |

### Files changed and why

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

### Acceptance (build plan §7.4; measured, `S/wp6/qa/results/TABLE.md`)

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

### Hand-verifiable steps (fake-clock build, phone-sized window, touch emulation)

1. Journal tab. Expected: caps `SAT, OCT 24` (the date), large `Journal`, a 32 px `Journal | Library` control, nothing in the bar's trailing slot.
2. Scroll the Journal down past the composer. Expected: the bar collapses to `Journal`, the segmented control stays pinned under it.
3. Tap Library, scroll a little, tap Journal. Expected: each switch is a short crossfade, nothing slides; each side comes back where you left it.
4. Type four lines in the composer. Expected: Save goes from a faint pill to full blue on the first letter; each new line pushes the card and everything below smoothly (no jump).
5. Save. Expected: the words leave, "Saved" with a check for a moment, the entry is first in Entries. No toast.
6. Hold the quote line inside the composer. Expected: `Favourite · Hide`; Hide shows a toast with Undo and a new quote.
7. Library → Reads. Expected: Reads slides over Journal with the chevron "Back to Journal"; swipe a link left a little: it rests open with a red Delete; tap anywhere else: it closes; swipe further: it goes, toast with Undo.
8. Progress. Expected: the verdict in the plain sans (not italic), `3M | 6M | 1Y` as one control; no skeleton ever. Tap a future week's bar → the week sheet → "Open this week in Plan": Plan appears at once on that week; Back returns to Progress.
9. Go offline for one month (devtools: block `/api/months/2026-09`), fresh profile, open Progress. Expected: the chart draws with a dashed gap where September is, the line broken there.

### Audit findings this step closes

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

### Requests

1. **WP1 (`app/Shell.tsx`)**: `--hdr` is a custom property on `.tab-scroll`, and custom properties inherit, so every write that changes it restyles the whole tab subtree. A Journal segment switch that restores an offset across 0–44 pays a ~420-element restyle on the next frame (≈ 30 ms at 4×; it is most of the 4× crossfade's 217 ms against 150). Write `--hdr` on `.nb-bar` / `.nb-title` / `.nb-strip` only, or register it with `@property { inherits: false }` and set it where it is read.
2. **Contracts §A.2**: a pushed page has no way to mirror page state into its path (`nav.replace` is root-only). Reads' `Unread · Read` therefore reads `/journal/reads/read` once and is local state after. Either add `nav.replaceTop(path)` or document it.
3. **WP2**: `Composer` now fires `success` itself on the day's first entry (the Close card's Save is that save); the Close card must not fire a second. `ComposerProps.toast` is a no-op (marked deprecated). `QuoteLine`'s Hide also asks for another quote. `TodaysPick` (mounted by the Close card) no longer toasts "Saved to your reads".
4. **Spec §8**: two readings to confirm. (a) The Journal Segmented is pinned under the bar once scrolled (like Today's strip), so the switch is reachable at any offset (test 50 switches at 300). (b) The Journal composer's text is 17/22 like its placeholder (one size, no jump on the first keystroke).
5. **Spec §1.3 / §8**: Progress shows `Connect Strava` as a quiet drill row whenever Strava is configured and not connected (the empty state's button alone is unreachable once runs exist). It opens the primer sheet; Settings keeps its door.
6. **Device day one**: `content-visibility: hidden` on Journal's hidden pane needs Safari 18 / WKWebView 18; older WebKit falls back to `visibility: hidden` (`@supports`), which restyles the pane on a switch.
7. **WP1, Delete at integration**: journal, progress and reads no longer use `TabHeader`, `PushedHeader`, `TAB_RESELECT`, `ContextMenu preview`, `rowPresence`, `shared()`, `layoutId`, `pressScale`, `--sp-primary`. Settings and onboarding still do until the next step.

### Screenshots (looked at)

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

## Left (as of step 2; superseded by the QA step's "Left" above)

- The two measured misses above are other packages' (requests 8, 9). `connections` is reachable only on a server with Strava configured (the seed has none); its page was checked by screenshot, not by a Strava round trip.
- Device day one: the hand-off layer is a DOM deep clone; on WKWebView confirm no flash when the copy is inserted (fonts and the halo are already decoded).
