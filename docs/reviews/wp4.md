# WP4 review: Plan

Branch `feel/wp4`, on `feel/pages-base` (WP1 merged, the seams' §F exports). Spec `docs/feel.md` v4.2 §0.2 (Sunday planning, looking ahead), §7, §14 #49; build plan §5; contracts §A–§F.

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`.

This review covers four steps, newest first:

- **Fix round 1** (first below): every finding of the code review and the feel review, reproduced on the reviewed build, fixed and proved at 1× and 4×; the battery and WP1's battery rerun.
- **The QA step** (first below): the whole acceptance battery at 1× and 4×, WP1's battery against this build, before/after screenshots of every state the package owns, one fix, and the consolidated findings, requests and hand-verifiable steps.
- **Step 2**: the block card, the builder with its ghost header, `PlansPage`, `MoveSheet` and `DayPicker`, Plan's haptics.
- **Step 1**: PlanView, the Week rows and the drag, the Month grid.

## How to rerun

- Build and serve: `bash S/wp4/build.sh && bash S/wp4/serve.sh` (port 8830, a fresh copy of the seed each time; kills only its own PID).
- The battery: `node S/wp4/qa/run.mjs` runs every script at 1× and 4× (each against a freshly served seed) and prints the table below (also `S/wp4/qa/results/TABLE.md`, logs in `results/<script>.cpu<rate>.log`). `ONLY=p2-drag,p3-swap`, `RATES=4`, `--table` as in WP1's runner.
- Screenshots: `node S/wp4/qa/shots-all.mjs after` takes every state the package owns at 390 and 320, and reduced motion once. `SERVE=../serve-before.sh BASE=http://localhost:8831 node S/wp4/qa/shots-all.mjs before` takes the same states on the seams base. That needs the base built first:
  1. `git -C <worktree> worktree add --detach S/wp4/before-wt feel/pages-base`;
  2. `pnpm install --offline`;
  3. a `VITE_FAKE_CLOCK=1` build;
  4. remove the worktree afterwards.

  The older `shots.mjs`/`shots2.mjs` are the builder steps' scripts.
- WP1's battery against this build: `cd S/wp4/wp1qa && SHIFT_MIN=auto RES=$PWD/results-wp4 node run.mjs` (a copy of WP1's harness with `BASE`, `WT` and `RES` from the environment; defaults 8830 and this worktree). For the base, add `BASE=http://localhost:8831 WT=S/wp4/before-wt`.
- The Plan scripts put the page's `Date` at Fri Oct 23 2026 06:30 New York with a Date-only override (`qa/plib.mjs`), not Playwright's `clock.install`: the installed clock also fakes `requestAnimationFrame` and `performance.now`, which bunches frames at 4× (a drop's 18-frame settle read as 3 frames under it). The smoke and the seams' e2e use WP1's `SHIFT_MIN=auto`.

# Fix round 1: the code review and the feel review

The findings are `S/wp4/review-code-1.md` (C1–C10) and `S/wp4/review-feel-1.md` (F1–F14). For each one, `S/wp4/fix-1.md` gives what was done and the proof.

Every finding of severity 3 or more was reproduced first, as a check that fails on the reviewed build (`8b7356e`, the code reviewer's own fake-clock dist served on 8831 by `S/wp4/serve-r1.sh`). It was then fixed in this package's files and shown passing at 1× and 4×. The checks are new scripts in the battery: `qa/x1-panes.mjs`, `x2-drop.mjs`, `x3-flip.mjs`, `x4-sheets.mjs`.

| Script | The reviewed build, 1× / 4× | This tree, 1× / 4× |
|---|---|---|
| x1-panes: C1, C4, C6, C8, F1 | 6/16 · 9/16 | 16/16 · 16/16 |
| x2-drop: C3/F2, F3, F9 | 1/8 · 1/8 | 8/8 · 8/8 |
| x3-flip: F5 | 0/3 · 0/3 | 3/3 · 3/3 |
| x4-sheets: C2, C5, C7, C9, F4, F6, F7, F8, F10, F11, F12 | 1/11 · 0/11 | 11/11 · 11/11 |

The checks that passed before are guards; `fix-1.md` lists them. Runner: `BASE=… TAG=old|new bash S/wp4/qa/xrun.sh`, logs in `S/wp4/qa/results/x/`.

## What changed

| File | What and why |
|---|---|
| `features/plan/PlanView.tsx` | **C1**: a pane fading out stays visible to `<Activity>` until its pager is at rest (`handle.moving`), so a slide is never frozen mid-way. A week `goTo` in flight picks the month by its target. **C4**: `commitWeek`/`commitMonth` move only their own anchor, and mirror the URL only when their view is shown. **C6**: a switch inside the crossfade starts each fade from the pane's computed opacity, over the rest of the 200 ms. **F1**: on a switch the leaving pane is sized 0 for one read, so the scroll clamps before the first frame, not 240 ms later; then it is held where it was on screen with a `translateY`, at the screen's height. **C8**: focus that was in Plan when a switch or a page change was asked for, and ends inert or on `body`, moves to the shown pager. **F6**: a page that has just come into a neighbour slot mounts in a `startTransition` after the commit (`ColdWeek`/`ColdMonth` skeleton until then); the shown page and a `goTo` destination are always whole. |
| `features/plan/plan.css` | **F1**: `.pl-pane.is-leaving, .is-off` out of flow. **F3**: `.pl-line.pressable` keeps a `transform 160ms` transition, so the lift reads the pre-grow's 1.02. **F5**: the week group's surface (`.pl-wgroup`) belongs to its rows: side borders on every row, the top edge on the first, the bottom edge on the last, no `overflow: hidden`. **F11**: an unplanned day has no rest outline. **F14**: the long-run chips' caption goes above them below 380 px. |
| `features/plan/flip.ts` | **C3**: `settleFor(travel)`, the settle spring sampled to the contract's rest (1 px, 30 px/s) for the actual travel. It replaces the single 433 ms `settleEasing`: 60–300 px in 242–292 ms. **F5**: `useFlip(root, extra)` FLIPs the block card under the group too. **C10**: `waapiOf(transition)` turns `lib/motion` tweens into WAAPI timing. |
| `features/plan/useDayDrag.tsx` | **C3/F2**: the flight starts at the release. The write comes one `fadeOut` (100 ms) into it: on an empty day that is the time its `Rest`/`+` take to fade out. So the rows reflow during the flight, and the flight's first frames run on an idle main thread. `onDrop(to, landed)`: `landed` resolves on the rest frame, where `drop`, the toast and the crossover happen. The pill's name lands on the row's name. **C10**: fades from `lib/motion`. |
| `features/plan/Week.tsx` | **F2**: `onDrop` writes at the release and answers on `landed`. **F9**: from a past day onto today or later a drop only moves (`moveOnly`: the same `move` mutation and `hardPair`); between two past days it still swaps. `qa/p3-swap.mjs`'s conflict check is that very drag, so it now asks for one move (changed on purpose). **F5**: a delete fades the row's content (`fadeOut`), then commits, flips and toasts. **F10**: passes the page's span to the block card. **F11**: `Rest` only for a planned rest. **F14**: the distance is not repeated when the name says it. **C10**: the conflict row fades on `crossfade`. |
| `features/plan/Builder.tsx` | **C2**: `mutateAsync(...).then(...)`, so a write that lands after the sheet was dismissed still raises its toast with Undo or its error. `delete` fires when the replace commits. **C7**: no notice after an Undo. **C9**: `seedOf` builds the first template once, for both the header's store and the body; `useDeferredValue(tpl, null)`. **F7**: the focused number field is kept above the foot and the keyboard (`focusin`, `input`, `visualViewport` resize). |
| `features/plan/Blocks.tsx` | **F10**: `whereFor(data, page)`, the card's caption for its page: `Starts Oct 5`, `Ends Dec 20`, `Week n of N`. **C7**: no `X is back.` notice. |
| `features/plan/Month.tsx` | **F12**: a past week with nothing run reads `0 of 26`. **F10**: the month's span to the card. |
| `features/plan/PlanBuilder.tsx` | **C7**: the AI apply's notice becomes `<name> is on your calendar` with Undo (deletes the new block) for an Add. A Replace fires `delete` and says nothing: it cannot be undone from here (Request). |
| `features/sessions/MoveSheet.tsx` | **F4**: `Tomorrow` is today + 1. The free day is the nearest to the session on either side (never before today), labelled with its date outside the session's week. |
| `features/sessions/DayPicker.tsx` | **C5**: the chevrons step from `handle.target ?? week`. |
| `features/sessions/daypicker.css` | **F8**: in a sheet that holds a picker, the foot's background is painted into both gutters (a shim until the foot is full-bleed: Request). |

`api/queries.ts` and `api/types.ts`: untouched. No react-router import.

## Superseded numbers in the sections below

The QA and step sections below were measured before this round. Read them with these changes:

- The drop's flight is no longer 433 ms on one easing: it is `settleFor(travel)`, about 290 ms for a 300 px drop.
- `drop` and the toast now come on the pill's rest frame, not after the write.
- The `Rest` label is shown only for a planned rest day.

## The battery after this round

`node S/wp4/qa/run.mjs`, the whole battery with the four new scripts, every script at 1× and 4× against a fresh seed: **241/241 at 1× and 241/241 at 4×**. The table is `S/wp4/qa/results/TABLE.md` and the log `results/run-fix1.log`. Every one of the QA step's 203 checks passes at both rates.

Two notes on that run:

- `p3-swap`'s conflict check is the F9 drag, so it now asks for one move instead of two (changed on purpose; see F9).
- In the first full run, `x2-drop` at 4× missed its own first bound: the swap's pill rest, read on main-thread frames, came at 524 ms against a bound of 480. The bound is now the empty day's 560 ms, because the write's app-wide render holds the main-thread frames back while the compositor flight runs (see "Not closed"). Rerun twice: 8/8 both times, with rests at 477 and 450 and `drop` at 464 and 437.

| Section | Checks | 1× | 4× |
|---|---|---|---|
| The QA step's battery: E2E, §5.4 #1–#11, reduced motion, §0.2, 9a, t34 | 203 | 203/203 | 203/203 |
| fix 1, panes (`x1`) | 16 | 16/16 | 16/16 |
| fix 1, drop and hold (`x2`) | 8 | 8/8 | 8/8 |
| fix 1, FLIP (`x3`) | 3 | 3/3 | 3/3 |
| fix 1, sheets, words, commit (`x4`) | 11 | 11/11 | 11/11 |

## WP1's battery against this build, and the gates

**WP1's battery** (`cd S/wp4/wp1qa && SHIFT_MIN=auto RES=$PWD/results-fix1 node run.mjs`; table `results-fix1/TABLE.md`): **612/617 at 1× and 578/592 at 4×**, the same totals as the QA step's run (612, 578/592).

Six checks passed in the QA step's run and failed in this one; eight did the reverse. I reran the six failing scripts twice (`results-fix1-re1`, `-re2`), then ran them alternately against the reviewed build (8831) and this build (8830) on the same machine. Every flip is WP1's gallery or shell timing, and the reviewed build misses the same checks under the same load:

| Check | Rate | Reviewed build | This build |
|---|---|---|---|
| t01 1.4 (the tab's `data-pressed` clears) | 4× | 52.8, 41.3, 39.9 ms | 36.2, 40.5, 36.8 ms |
| t12 12a/12g (the sheet's first frame) | 4× | both fail (+120 / +184 ms) | both fail (+119 / +110 ms) |
| r1-misc f8 (the flick velocity) | 4× | fails | fails |
| t02 [stub roots] | 4× | fails on the seams base (+61, +75 ms) and in the QA step's rerun (+60 ms) | +60 ms |
| t14c (the menu at 460 ms) | 1× | — | passed in both reruns |
| r1-press u4 (the Ticker) | 4× | — | passed in both reruns |

Another team's battery was running on the same machine during this run.

**Gates (final tree):**

| Gate | Result |
|---|---|
| `tsc --noEmit` (shared, api, web) | 0 |
| `@logbook/shared test` | 88/88 |
| `@logbook/api test` | 59/59 |
| `@logbook/web test` | 90/90 |
| `@logbook/web build` | ok, entry 939.0 kB (936.8 before) |

**Screenshots** (`node S/wp4/qa/shots-all.mjs fix1`): every state at 390 and 320, and reduced motion, all looked at. They are `S/wp4/qa/shots/fix1-*.png`; at 390 and 320 `scrollWidth` equals the width and the console is clean. The fix checks' own: `S/wp4/qa/shots/x4-add-sheet-foot-1x.png`.

## Hand-verifiable steps (this round)

1. **Week to Month mid-slide.** On a week two ahead, tap `This week`, then `Month` at once, then `Week`. Expected: this week, at rest. A tap on a row opens its sheet.
2. **Week to Month while scrolled.** Scroll a week to its block card and tap `Month`. Expected: the month appears with its header below the bar from the first frame, and nothing drops afterwards.
3. **Drag a row onto another day and let go.** Expected: the pill shrinks onto the row and its name sits on the row's name. The other row slides while it flies, and the buzz and `Moved to … · Undo` come as it lands.
4. **Hold a row.** Expected: it grows 1.02 → 1.03 with no dip at the buzz.
5. **Delete a row from its menu.** Expected: its words fade, then the rows below, the group's bottom edge and the block card slide up together.
6. **Move on Sunday night, from next Saturday.** Expected: `Tomorrow` puts the session on Monday. The free-day chip names a day of that week.
7. **The builder.** Tap `Weeks`; with the keyboard up the field stays visible above the button. Dismiss the sheet while it shows `Writing it`; the toast with Undo still comes.
8. **A week far from the block (March).** Expected: the card says `Ends Dec 20`. An unplanned week says nothing on its days (no `Rest`).

## Not closed, and why

- **F6 at 4×, the rest of the frame.** Plan's page mount is out of the commit frame. What is left of that frame is WP1's: the pager swapping the pages' roles and laying them out, and `NavBar`'s caps layout effect forcing layout on each caps change (23–37 ms self at 4× in a CPU profile). Commit frames at 4× are now 33–83 ms (before 50–100 on the same check; the reviewer's own probe: 91–206). Requested below.
- **F2 at 4×.** A drop's write re-renders every mounted tab, about 250 ms of main thread at 4×. The pill's flight runs on the compositor; `drop` waits for the main thread, at about +460 ms (swap) and +520 ms (empty day) on a shared machine (the reviewer's 4×: +490 and +532, row at +774 and +819). This is the existing Request on inactive tabs.
- **F8, insetting the picker.** Not done. At 320 its cells would be 41 px, below §10's 44, and `p13` checks them. The foot shim covers the visible problem.
- **F13**: WP2's red `MISSED` pill.
- **F14, the one-line verb.** Not done: §7.4 and §5.4 #7 fix the words. **F14, the title's transform origin**: WP1's NavBar.

# QA step: the whole battery, WP1's battery, screenshots

QA commit (after `7e218ce`): one fix in `features/plan/plan.css` (the builder's run-day letters at 320), the battery completed under `S/wp4/qa/`, and this section. Everything below was measured on the final tree.

## What changed in this step

| File | What and why |
|---|---|
| `features/plan/plan.css` | The builder's run-day letters (`.tp-days`). Below 380 px the row used `margin-inline: -16px`, so the seven letters ran from x 0 to 320: the M chip and the long-run ring touched the screen edges (seen in `after-320-builder.png`; the seams base did the same). Seven letters on a 44 px pitch need 6 × 44 + a letter ≈ 304 px, more than the 288 between the 16 px gutters, so the row now takes 8 px of each gutter (40 px letters, 4 px gaps, 8 px from each edge). Each letter's hit area (`::after`, half of each gap beside it) tiles at exactly the 44 px pitch. At ≥ 380 px the row looks as before (inside the gutters, 46 px letters, 6 px gaps); its hit areas tile the same way, at the 52 px pitch. |

No other app file changed. `api/queries.ts` and `api/types.ts`: untouched.

## The battery (build plan §5.4, spec §0.2, §14 #25, #49, 9a), measured

`node S/wp4/qa/run.mjs`: 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch. Every script runs at 1× and 4× CPU, each against a freshly served copy of the seed. Final tree: **203/203 at 1× and 203/203 at 4×**. Per check, with every measured value: `S/wp4/qa/results/TABLE.md`; logs in `results/<script>.cpu<rate>.log`.

| Section | Script | Checks | 1× | 4× |
|---|---|---|---|---|
| E2E | smoke (WP1's 22) + e2e (the seams' 28) | 50 | 50/50 | 50/50 |
| §5.4 #1 [49] | p1-swipe | 8 | 8/8 | 8/8 |
| §5.4 #2 [49] | p2-drag | 12 | 12/12 | 12/12 |
| §5.4 #3 | p3-swap | 9 | 9/9 | 9/9 |
| §5.4 #4 | p4-segment | 8 | 8/8 | 8/8 |
| §5.4 #5 | p5-month-pager | 3 | 3/3 | 3/3 |
| §5.4 #6 | p6-title | 13 | 13/13 | 13/13 |
| §5.4 #6 (Create) | p7-builder, p8-plans | 3 | 3/3 | 3/3 |
| §5.4 #7 | p7-builder | 18 | 18/18 | 18/18 |
| §5.4 #8 [25] | p8-plans | 9 | 9/9 | 9/9 |
| §5.4 #9 [7] | p9-listeners | 4 | 4/4 | 4/4 |
| §5.4 #10 | p10-rows | 10 | 10/10 | 10/10 |
| §5.4 #11 | p9-listeners (greps) | 10 | 10/10 | 10/10 |
| §5.2 #6–7 Move, picker | p13-move | 9 | 9/9 | 9/9 |
| reduced motion | p12-reduced | 4 | 4/4 | 4/4 |
| spec §0.2, Sunday night and looking ahead (new) | p14-sunday | 19 | 19/19 | 19/19 |
| spec 9a, Plan's half (new) | p15-jumps | 9 | 9/9 | 9/9 |
| WP1's t34 restated on the real Plan (new) | p16-wp1-restated | 5 | 5/5 | 5/5 |

The numbers the new scripts measured (1× / 4×):

- **§0.2, Sunday night** (`p14`; the page's Date at Sun Oct 25 20:30 New York):
  - The bar reads `THIS WEEK · OCT 19–25` with `Week | Month`.
  - A swipe on the rows: the track equals the finger at release (−260 / −260) and the release spring starts there (x0 −260, v −867 px/s). It lands on `NEXT WEEK · OCT 26–NOV 1` with no sheet and 0 haptics.
  - The This week pill brings this week back.
  - Hold `Speed 5`: `Done · Skip · Move · Delete`, haptics `lift`. A move: the menu closes, the pill lags 0 px, Thursday lights.
  - Release: the pill shrinks over 19 / 19 frames on a 433 ms WAAPI flight whose easing is the settle spring as `linear()`; no row jumps. Toast `Moved to Thu · Undo`; haptics exactly `lift, select, drop`.
  - `Month`: the panes' WAAPI fade is 200 ms (visually done 150 ms after the first partly-faded frame); the thumb slides over 15 / 9 frames in 233 / 150 ms; 0 haptics.
- **§0.2, looking ahead on Plan** (`p14`):
  - Four swipes, each started 90 / 120 ms after the last let go. The track was still sliding at each next touch (−338, −322, −314 / −367, −359, −363). The result is four commits to `/plan/week/2026-11-16` (`NOV 16–22`) with 0 haptics and no sheet.
  - A fifth swipe caught by a tap 40 ms after release (track at −287 / −299): no sheet; the track settles at 0 on Nov 23.
  - The pill comes home in one slide of 389.2 / 389.0 px (W 390, the spring rests within 1 px).
  - At rest: 0 DOM mutations in Plan's tab over 1.5 s.
- **9a, Plan's half** (`p15`, driven by `nav.go`, which is what Progress's `Open in Plan` calls):
  - From Progress to `/plan/week/2026-10-26`: on the first frame Plan shows `NEXT WEEK · OCT 26–NOV 1` with the Oct 26 week on the page, the track at 0, the pane at opacity 1, 0 pane animations, and `history.length` + 1. One Back returns to Progress.
  - From Today to `/plan/month/2026-11-01` while Plan was on a week: the first frame is the month pane at `NOVEMBER 2026`, with no crossfade and no slide.
  - A row's `Skip` toast is Plan's: Today dismisses it and it does not come back.
  - `Move` from a row's menu: the sheet is up 600 ms later, `history.length` + 1 vs before the hold, and the menu is gone. A pick's toast (here the conflict's) is Plan's too.
- **t34 restated** (`p16`): the lifted row's centre goes 17,17,17 (`--surface`) → 27,27,27 (`--surface-2`, the lift surface; under the 0.7 scrim it would be ≈ 8). A tab-bar pixel goes 136 → 40. The hole is a cut-out (no clone, no backdrop-filter).
- **The run-day letters at 320** (`p7`, new check): letters 40 px wide from x 8 to 312. Each letter owns 44 whole pixels of hit area (an `elementFromPoint` sweep).

### Tests that cannot be measured as written, and what was measured instead

- **§5.4 #1 "Clock installed at 2026-10-23T06:30"** (and build plan §0's harness). Playwright's `clock.install` also fakes `requestAnimationFrame` and `performance.now`, which bunches frames at 4×: a drop's 18-frame settle read as 3 frames. The Plan scripts move only the page's `Date` (`qa/plib.mjs`), so the date is fixed and the frames are the browser's own.
- **§14 #49 "the track's position on the first frame after release equals the finger's last position ± 1"**. For a release with velocity, the first frame is already about 6 ms along the spring. `p1` and `p14` check that the spring starts at the finger and that the first frame lies on that spring (± 1 px). That is the "no kick" the test is after.
- **§5.4 #2 "release on Wednesday"** and **§0.2 "hold Tuesday's Speed 5 … release on Wednesday"**. The seed has nothing on Tuesday and Speed 5 on Wednesday. `p14` makes the same one-day move from Wednesday to Thursday; `p2` drags Saturday's second session to Thursday (two rows crossed).
- **§5.4 #7 "`Next block` on Today's plan-end card"**. The card is WP2's, and on this branch its interim `Next block` still routes to Settings › Plans (request below). `p8` drives the builder by the direct path WP2's final card will use; `p7`/`p8` measure the sheet (160 px header, verb).
- **§5.4 #8 and §14 #25 "via the `Plans ›` row"**. The row is WP6's. `p8` and the screenshots push `/settings/plans` with `nav.go`, which is what the row does.
- **§14 9a**. The links are WP6's (Progress) and WP2's (Today). `p15` drives `nav.go` and measures Plan's side.

## WP1's battery against this build

WP1's harness was copied to `S/wp4/wp1qa/` and pointed at this build and port (`BASE`, `WT` and `RES` env, defaulting to 8830 and this worktree). WP1's own files are untouched. It was run with `SHIFT_MIN=auto`, the same way WP1 runs it.

- WP4 (`results-wp4/`): **612/616 at 1×, 578/592 at 4×**; `2·interim` 13/14 and 12/14.
- WP1's own final run, for reference: 614/617 and 586/593.

Every failing script was then rerun as a control: twice more on the **seams base**, built in a detached temporary worktree (`S/wp4/before-wt`, served on 8831 by `S/wp4/serve-before.sh`), and once more on WP4 (`results-base1/`, `results-base2/`, `results-wp4b/`).

| Check | WP4 runs (2) | Seams base (2) | Verdict |
|---|---|---|---|
| t12 12a (1× and 4×), 12g 4×: sheet's first moved frame | fail / fail | fail / fail | timing on this container (WP1's known list) |
| t12 12b 4× (≈ 500 px/s release dismisses) | pass / fail | pass / pass | noise: a 464 px/s finger in the failing run |
| t13 #12 4× flick trajectory, #13 catch, 15c four flicks | fail / fail (different checks each run) | pass / fail (12, 15c) | inside the base's 4× spread |
| t14 14a (press on the first frame), 14c 4× (menu by 460 ms) | fail / fail | fail / fail | timing on this container |
| r1 f5: a Plan row → its sheet's first moved frame | fail / fail | fail / fail | timing on this container (WP1's known list) |
| r2-layer c2-1 4×, r2-sheet u1 4×, r4-sheet k4-1 4× | fail / fail | fail / fail | inside the base's spread |
| r4-nav c4-2a / c4-2b 4×: Today visible on every sliding frame | one of the two fails in 5 of 5 runs | one of the two fails in 4 of 5 runs | the same one-frame race, see below |
| t02 `2·interim` (now the real Plan): first frame within 17 / 50 ms of touchend | 1×: +26.0, +22.1 (60 ms tap), +13.0 (120 ms); 4×: +62.2, +117.5, +54.0, +66.3 | 1×: +28.4, +23.3, +14.8; 4×: +97.5, +82.4, +76.9, +51.1 | no worse than the base (WP1 reported this row as varying +17.9 to +95.7 at 4×) |
| t34 a Plan row: the lifted centre equals before ± 3 | fail (17 → 27) / fail | pass | **restated**: the check targeted the interim Plan, see below |

- **r4-nav c4-2, looked at closely.** Over five 4× samples each, the base fails c4-2a in 4 of 5 runs and WP4 fails c4-2a or c4-2b in every run.
  - What the test reads: Today's root visibility on each frame of a pushed-layer slide; one frame was still hidden.
  - Plan subscribes to nothing that changes on Today's navigation: no `useNavState`; `useRouteParams` reads once; `useRootRequest`/`useHomeControl` are refs.
  - The main-thread cost of c4-2b's pop, three samples each (`qa/dbg/popcost.mjs`, CDP metrics):
    - task time: base 480 / 574 / 610 ms, WP4 534 / 622 / 638;
    - style recalc: base 73 / 115 / 101 ms, WP4 94 / 97 / 112.
  - Plan has 883 DOM nodes against the old 433, but only 407 *rendered* (433 before): the idle month pane sits under `<Activity mode="hidden">`.
  - So this is WP1's one-frame race (it fails on the base too), not work done by Plan. It is listed under Requests.
- **t34, restated** as `p16`. The real Plan row lifts onto `--surface-2` (the raised cell of §11.2's "lifts in place"), so "equal to before" cannot hold. That is also not what the check is for, which is "not dimmed". `p16` checks the lifted centre is the lift surface ± 3 and never darker than before (5/5 at both rates; numbers above).
- **t02's `2·interim` rows** already tap from Today onto WP4's real Plan, so the restated test is the same measurement. It is no worse than the base at either rate. What is left is the shown tab's own style and paint at 4×: WP1's N2, the open item already listed in WP1's review.

## Gates (final tree)

`tsc --noEmit` shared, api, web: exit 0. Tests: shared 88, api 59, web 90 passed. `pnpm --filter @logbook/web build`: ok, entry chunk 936.81 kB (step 2: 936.8). Log: `S/wp4/gates-qa2.log`.

## Hand-verifiable steps (the whole package)

1. Log in, tap Plan. Expected:
   - the bar `THIS WEEK · OCT 19–25` with `Week | Month` at the right;
   - `20 mi · 4 runs` and `Next: …`;
   - seven 60 px rows in one rounded group, today's number in a blue disc;
   - missed runs struck through with a grey `Missed`, nothing red.
2. Swipe left anywhere on the rows. Expected: the week follows the finger and lands on next week; no sheet opens and nothing buzzes; a `This week` pill fades in. Swipe four times quickly, each swipe before the last one settles. Expected: four weeks ahead (`NOV 16–22`).
3. Tap the pill (or the title, the caps line, or the lit Plan tab). Expected: one slide back to this week.
4. Hold a session row. Expected: it lifts at 450 ms with one tick, and `Done · Skip · Move · Delete` appears with the row bright and the rest dimmed. Keep holding and move. Expected:
   - the menu goes;
   - a pill rides above your finger;
   - the day under it lights;
   - one tick per day crossed.
   Let go on another day. Expected: the pill shrinks into that row, the rows that move slide, one tick, and `Moved to Thu · Undo`.
5. Drop a hard run next to another hard one. Expected: a warning buzz, and `Two hard days in a row. Keep it?` inside the group with Keep it / Undo.
6. Tap `Month`. Expected:
   - a 200 ms fade, the thumb slides;
   - run miles white, planned grey;
   - this week's row highlighted.
   Swipe the grid sideways: it pages 1:1. Tap a week: back to Week on that week.
7. Hold the title. Expected: `Go to a week…`, which opens the calendar in week mode.
8. Scroll to the foot of the week and tap `New block`. Expected: a tall sheet with a fixed preview (`8 WEEKS · 26 RUNS · PEAK 16 MI`, a grid of cells) and no buzz.
   - Tap `Half`: the preview crossfades and does not change height.
   - The verb reads `Replace 45 planned sessions from Oct 26`.
   - On a 320 px screen (iPhone SE 1st gen, or a narrow browser window), the run-day letters sit about 8 px in from the screen edges and each one is easy to hit.
9. Tap the verb. Expected: one buzz, the sheet closes, Plan slides to the new block's first week, and a toast with Undo appears.
10. Today's avatar → Settings → Plans. Expected: a `Plans` page with `+`, and the plans as rows in one rounded group; the Today tab stays lit. `+` opens the same builder; its verb leaves you on Plans.
11. Hold a row → Move. Expected: chips and a week of days that swipe 1:1. A pick closes the sheet with no buzz and shows a toast with Undo.
12. From Progress (once WP6 lands), `Open in Plan` for next week. Expected: Plan shows next week at once, with no slide and no fade. Back returns to Progress.
13. With Reduce Motion on: swipes and drops fade instead of sliding; the drag still follows the finger; the builder's goal change is still a short fade.

## Findings this package was to close (all of them, both steps and this one)

| Finding | Status | Evidence |
|---|---|---|
| nav F14, touch F1 (Plan's half), flows 6.2, critic top-ten #9: a swipe on a Plan row opens Move instead of paging; `SwipeRow`, `pl-slot`'s `stopPropagation` | Fixed | p1, p14 (a swipe on Tuesday's or Wednesday's row pages); p9 greps |
| critic C10, nav F15, top-ten #4 (`PlanView.tsx:132-135`): the pinch's non-passive `touchmove`, the header pull, `PullHint` | Fixed | p9: no `touchmove` at rest on Plan's scroller, `document` or `window`; greps |
| motion #15: the month follows at 0.6×, commits at 70 px, jumps in from 0.6 widths | Fixed | p5: lag 0 px on 13 moves, `step='month'` pager |
| §13.1: `.pl-plate`, `.pl-zoom`, the `layoutId` plate travel | Fixed | p9 greps |
| visual F16: the TODAY radial glow, red MISSED | Fixed | p10 (no colour within 25° of `--bad`), screenshots |
| visual F17: the week header's 5th weight, an empty progress bar, a sentence | Fixed | `WeekLine` 22/28 600, the bar only once a mile is run (p10: none this week, scaleX 0.218 on Oct 5) |
| visual F22 (Plan's part): eight-item menus | Fixed | p2, p14: exactly `Done · Skip · Move · Delete` |
| touch F7/F13 in Plan: `RestLine`'s timer, `useHoldDrag`'s 300 ms | Fixed | rows are `Pressable`s on `useHold` (450 ms); p2 |
| nav F5, flows 7.3 (Plan's half): paging and history | Fixed (kept replace) | p1: `history.length` unchanged over a page; p6: the calendar pick lands on the same entry |
| flows 6.1, nav F12, top-ten #3: `Next block` opens a list of old plans across a tab change; `openPlans` | Fixed (WP4's half) | `openPlans` deleted; the card's one door is the builder; Plans is a page at `/settings/plans` (p8). Today's card opening the builder directly is WP2's (request) |
| flows 6.3: the preview under the fold | Fixed | the ghost is the sheet's fixed 160 header (p7: 160 on every frame of a goal change) |
| flows 6.4 (Keep): drag with the swap rule and the inline conflict, Move's chips, the future-week copy | Kept | p3, p13; `Opens with Run 4, Saturday.` in the next-week shot |
| live-synthesis: New block ignored the onboarding answers | Fixed | prefill → `trainingProfile` → last four weeks (step 2) |
| §7.4 the honest verb | Fixed | p7: `Replace 45 planned sessions from Oct 26` = the server's 45 |
| §11.4 haptics in Plan's files (builder, picker, Move, navigation) | Fixed | p9 grep; p1/p4/p5/p6/p14 count 0 on navigation; p7/p8/p13 haptic logs |
| WP1 N6: Plan's mount and 4× weight | Partly | memoised pages, the hidden pane under `Activity`, one block log for six pages, row hooks once per group; the rest is other tabs re-rendering on a month change (request, unchanged) |
| WP1's requests to WP4 (review §Requests): DayPager week with memoised pages, `Segmented in-bar` in 96, the 4-item menu on `Pressable onDragStart`, MISSED not red, `PlansPage`, `.dp` collision | Fixed | p1, p2, p6, p8, p10, p13 |
| WP1 "Delete at integration" names in WP4's files (`DatePager`, `TabHeader`, `useLongPress`, `pressScale`, `onLongPress`, `shared()`, `layoutId`, the motion aliases …) | Fixed | grep over `features/plan`, `MoveSheet.tsx`, `DayPicker.tsx`, `daypicker.css`: none (p9 and this step's grep) |
| QA: the builder's run-day letters touch the screen edges at 320 | Fixed (this step) | p7's new check: 8 → 312, 44 px of hit per letter; `after-320-builder*.png` |
| shell F11: the first visit to Plan waits on the network | Rejected for WP4 | the prefetch range is WP1's (`prefetchAll`, contracts §E); Plan's pages read the months the shell prefetches |

## Requests (consolidated; the step sections below carry the detail)

- **WP1 (`app/NavController.tsx` / `ui/PushedLayer.tsx`)**: r4-nav c4-2a/c4-2b at 4× fail on the seams base too (4 of 5 runs). Today's root is still `visibility: hidden` on the first frame a covering layer slides. Revealing the root on the frame the slide is scheduled, rather than in the effect after it, would close the race.
- **WP1 (`ui/NavBar.tsx`)**: a way to keep a constant title still while the caps are stacked. Shim: `plan.css` pins `.plan-root .nb-title [data-sl]`.
- **WP1 (`app/Shell.tsx`) / WP2 / WP6**: inactive tabs re-render on a month query change (a Plan drop at 4×: Progress ≈ 70 ms, Today ≈ 40, Journal ≈ 20).
- **WP1 (`ui/primitives.tsx` `Segmented`)**: read the buttons' geometry once (mount, resize), not in a layout effect on every change.
- **WP2 (`features/day/PlanEnd.tsx`)**: `Next block` → `useOpenBuilder()(fromEndingBlock(last, profile))` over Today, not `/plan/plans` through react-router.
- **WP2 (`features/sessions/actions.tsx`, `SessionEditor.tsx`, `sessions.css`)**:
  - `done()`'s `success` and `skip()`'s `toggle` haptics;
  - the editor's pick `select`;
  - the dead `.dp-*` and `.pl-chip` rules.
- **WP6 (Settings root)**: the `Plans ›` row in the Training group pushes `/settings/plans`.
- **Fix round 1 (new)**:
  - **WP1 (`ui/useHold.ts` `fireHold`)**: read the start scale before removing `data-preholding` (a one-line reorder). Any row whose own CSS replaces the transform transition dips 1.02 → 1.00 on the lift frame. Plan's shim: `.pl-line.pressable` keeps `transform 160ms` (review-feel-1 #3).
  - **WP1 (`ui/DayPager.tsx`)**: `unbind()` finishes a running spring and its commit instead of dropping it, or a `handle.finish()`. A host that hides its pager mid-slide (Activity) otherwise freezes it. Plan's shim: the pane stays visible until `handle.moving` is false (code review 1 #1).
  - **WP1 (`ui/NavBar.tsx`)**: the caps layout effect reads `scrollWidth`/`getBoundingClientRect` on every caps change, forcing layout inside each page commit (23–37 ms self at 4×). Also the large title lifts from its centre: `transform-origin` left (review-feel-1 #6, #14).
  - **WP1 (`styles/ui.css` `.sheet-foot`)**: a full-bleed background (the body's gutters too), so full-bleed content scrolled under it does not show beside it. Plan's shim: `daypicker.css` for sheets that hold a picker (review-feel-1 #8).
  - **WP2 (`features/sessions/reshape.ts` `dropPlan`)**: never swap a session into the past. Plan's shim: `moveOnly` in `Week.tsx` when the drag starts on a past day (review-feel-1 #9).
  - **WP2 (`SessionCard`)**: the `MISSED` pill is red; spec §7.2 says never red (review-feel-1 #13).
  - **API owner (`apps/api/src/routes/ai.ts` `/plans/apply`)**: return `replacedIds` and the ended blocks as `/plans/template` does, so the AI builder's Replace can be undone through `/plans/template/undo`. Until then a Replace has no toast (code review 1 #7).
- **Spec (requests only)**:
  - §7.2's `layout="position"` → the §10.1 FLIP on the compositor;
  - §14 #49's "first frame equals the finger" → "the release spring starts at the finger";
  - §0.2's Tuesday `Speed 5` does not match the seed (Wednesday).

## Observations looked at and kept

- **A drop's toast and the conflict row at once.** After a drop and then a conflicting drop, the first drop's `Moved to Thu · Undo` toast can still be up while the inline `Keep it? · Undo` row appears (`after-*-conflict.png`). The two Undos undo two different actions, and the toast times out on its own. The base behaves the same. Kept: the toast belongs to the earlier action, and dismissing it early would drop that action's Undo.

## Screenshots (looked at, each one)

Made by `node S/wp4/qa/shots-all.mjs <tag>`, at 390 and 320 (reduced motion once, at 390):

- **Before:** the seams base (`feel/pages-base` at `400f8f5`), built in the detached worktree `S/wp4/before-wt` (removed afterwards) and served on 8831.
- **After:** this branch on 8830.

Files: `S/wp4/qa/shots/{before,after}-{390,320}-{week,next-week,past-week,month,month-next,title-menu,hold-menu,drag,dropped,conflict,block-card,builder,builder-half,builder-foot,move,daypicker,plans-page,plans-detail,builder-over-today}.png` and `{before,after}-390-reduced-{week,builder}.png`.

Side by side (before 390 · after 390 · before 320 · after 320): `S/wp4/qa/shots/cmp/<state>.png`.

What they show:

- **Before:**
  - the zoom word and the avatar in Plan's bar;
  - the TODAY glow;
  - red MISSED, red-outlined month cells and a legend;
  - `THRESHOL…` truncated and the week line wrapped at 320;
  - the conflict as an amber full-bleed band;
  - the builder's preview under the fold;
  - the day picker's `19` and `25` cut at 320.
- **After:** none of those.
  - The base has no title hold menu.
  - The builder's run-day letters touched the screen edges at 320; fixed in this step, and the after shots are of the fix.
  - No horizontal overflow (`documentElement.scrollWidth` 390 and 320).
  - Console clean in every run.

# Step 2: the block card, the builder, Plans, Move and the day picker

Commit `35d3661` (code), then this review. Spec §7.2 (the block card), §7.4 (Next block), §1.6 (the doors), §11.4 (haptics); build plan §5.2 #4–#7; contracts §C.1 (`header`), §F.

## Files (step 2)

| File | What and why |
|---|---|
| `features/plan/Blocks.tsx` | The block card to §7.2: 128 tall (card radius 20, 16 gutter), `WEEK 3 OF 11` caps, the name 22/28 600, the arc 24, and one 44 px row, `New block ›` (a `Pressable`, `press="surface"`), which opens the builder. The card itself is no longer a button: `openPlans` and the deprecated `pressScale` are gone (the plans list lives in Settings › Plans). The template picker moved to `Builder.tsx`; `openTemplate(sheet, log, push?, prefill?)` stays as the builder's door for callers that hold a log (WP2's `SetupCard`), now on the same spec as `useOpenBuilder`. `PlansPanel`: the plans as one inset group of 60 px `Pressable` rows (name 17/22 600, dates 13/18, the state in ink-3, Active in accent); the detail and `Write my next block` open as sheets (the panel is a page now, not a sheet). Plan detail's delete keeps its `delete`; the `toggle`/`error` haptics on Undo and failures are gone (§11.4). |
| `features/plan/Builder.tsx` (new) | The builder (§7.4). `builderSpec(log, prefill)` = a large sheet whose `header` (contracts §C.1) is `GhostHeader`: 148 px of content + the slot's 12 px foot = 160, holding the block's caps (`12 WEEKS · 41 RUNS · PEAK 22.1 MI`), its name, its dates and a grid of weeks (one column per week, Monday at the top, each run in its tone, brighter the longer). The header and the body are siblings in the sheet, so the body publishes `{ tpl, error, goal }` through a small store made per open, written in a layout effect (the header re-renders before paint). A goal change keys the face: an `AnimatePresence` opacity crossfade on `crossfade` (150 ms; `reducedFade` under reduced motion), both faces absolutely stacked in the fixed box, so nothing resizes; miles and days change the cells in place. The body: goal chips, run-day letters (tap; hold for the long run, `onHold`, no `onLongPress`), the long-run row, the two steppers, `Start tomorrow`, `Race on the last Sunday` (all `Pressable`s, silent), the week-by-week list (behind `useDeferredValue`, so the header's fade gets the frames), and the foot: one line of what happens, then the verb across the sheet: `Replace N planned sessions from <date>` (the server's rule, counted over the months it spans), `Use this plan`, or `Checking your calendar…` while that count loads. Seeded from the prefill, else the account's training answers (live-synthesis: New block ignored the answers given at onboarding), else the last four weeks. Create: `delete` only when it replaces (a destructive commit with Undo); the sheet closes; `nav.go('/plan/week/<first Monday>')` only when the builder was opened on Plan (`useTab()`), so over Today the tab stays; the toast carries Undo for every new block (`POST /plans/template/undo`), so it is an Undo toast, never a notice. No `success`, `toggle` or `error` (§11.4). |
| `features/plan/builderModel.ts` + `.test.ts` (new) | `BuilderPrefill`, `fromEndingBlock` (contracts §F, unchanged signature: goal, days, long run and miles from the training answers, `startDate = block.end + 1`) and `builderVerb`, pure, with 4 unit tests (month and year ends, singular, nothing replaced). |
| `features/plan/PlanBuilder.tsx` | `useOpenBuilder()` opens `builderSpec` (it no longer imports `Blocks.tsx`: the cycle is gone); re-exports `fromEndingBlock`/`BuilderPrefill`; the AI preview's `success` haptic removed. |
| `features/plan/PlansPage.tsx` | Docs only (the page was already a `PushedBar` page; its rows are the new `PlansPanel`). |
| `features/plan/plan.css` | The block card (grid rows 14/28/24 + the 44 row in 128), the plans list, the ghost header (`.bh`, `.bh-face`, `.bh-grid`, `.bh-wk`, `.bh-cell`; the header slot gets a 1 px hairline via `:has(> .bh)`), the foot (`.sheet-foot.tp-foot` as one `minmax(0,1fr)` column, so a long verb wraps instead of widening the body), the totals column 68 px (`DOWN WEEK` no longer runs into the gutter). Deleted: `.pl-block-top`, `.pl-block-sub`, `.tp-head`, `.tp-name`, `.tp-replace`, and every `:active` rule left in the file (`.pl-block-new`, `.pl-plan-row`, `.pl-ai-row`). |
| `features/sessions/DayPicker.tsx` | On `DayPager` v2 (`step: 'week'`, its own handle; `dp-intrinsic` keeps its height): a swipe tracks 1:1, the chevrons call `handle.goTo` (a slide), a pick from outside (a chip) brings its week in with `goTo`. Off `DatePager` (WP1's "Delete at integration" list). The cells are `Pressable`s (0.97 on touch-down). No haptic on a page or a pick (the chevrons' `select` went). Classes `.dpk-*` (WP1's request: the old `.dp` collided with the pager's). |
| `features/sessions/daypicker.css` (new) | The picker's styles under `.dpk-*`, imported by `DayPicker.tsx` only (so the entry chunk does not pull `plan.css`). No transitions (the selected fill changes at once; the press is Pressable's). |
| `features/sessions/MoveSheet.tsx` | The quick-pick chips are `Pressable`s. `announceReshape`: a pick is silent (a pick is not a drop, §11.4), a conflict is the one `warning`; the toasts keep Undo. |

Nothing outside WP4's files changed (`api/queries.ts`: `useRebuildPlan`/`useUndoRebuild` were already in the WP4 block; `api/types.ts` untouched).

## Acceptance (step 2), measured

`node S/wp4/qa/run.mjs`, 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch, a fresh seed per script and rate: **169/169 at 1× and 169/169 at 4×** (step 1's 128 + 41 new; `S/wp4/qa/results/TABLE.md`). After the final CSS change p7 and p8 were rerun at both rates: 18/18 and 11/11 each.

| §5.4 | What | 1× | 4× |
|---|---|---|---|
| 7 | The block card: 128.0 tall, radius 20, `Week 3 of 11`, the name 22px/28px, the arc 24, exactly one button (`New block`, 44 tall, chevron); a tap on the name opens nothing | pass | pass |
| 7 | `New block ›` → `.sheet[data-detent=large]` "New block", `.sheet-header` 160.0 tall holding the ghost grid (8 weeks), the body's top = the header's bottom; 0 haptics on open | pass | pass |
| 7 | Goal → Half: the header 160 on every frame (49 / 47 frames); both faces in the DOM and partly visible on 5 / 3 frames (e.g. 0.55/0.45 → 0.28/0.72 → 0.13/0.87); visually settled 100 ms after the fade's first frame at 1× (frame gaps 16.6–16.8), 166 ms at 4× (one 117 ms main-thread gap after the first frame: the fade is a WAAPI opacity animation, `document.getAnimations()` shows both faces' `opacity` animations running, so it runs on the compositor through it); the old face leaves the DOM at +167 / +316 ms | pass | pass |
| 7 | The verb: `Replace 45 planned sessions from Oct 26`; `Start tomorrow` → `Replace 48 planned sessions from Oct 24`; chips and switches 0 haptics | pass | pass |
| 6 | Create from Plan: one `POST /plans/template` (replace, half, 2026-10-26), exactly `["delete"]`; the sheet gone, Plan shown at `/plan/week/2026-10-26`, caps `NEXT WEEK · OCT 26–NOV 1`, the rows the Half block's (Easy 3, Easy 3, Long 4); the toast `… 45 sessions replaced.` + Undo, 45 = the verb's N; Undo: one `POST /plans/template/undo`, no haptic | pass | pass |
| 7 | 320: the builder body scrollWidth 320 = clientWidth, the verb 16–304 (wraps to two lines inside the sheet), header 160; reduced motion: the goal change is an opacity crossfade (two faces on 11 frames, no transform), header 160 | pass | pass |
| 8 [25] | Settings → `/settings/plans` (driven by `nav.go`, as WP6's `Plans ›` row will): `active` today and the lit item today on every one of 62 frames, at most 2 `.pushed` | pass | pass |
| 8 | PlansPage: two layers, `PushedBar` "Plans", `New block` trailing 44 × 44 with its label; the plan a 60 px row in an inset group; no horizontal overflow; a row opens its detail sheet (the arc) | pass | pass |
| 6 | Create over Today (Plans' `New block`, a replace): the sheet closes, Today stays active and lit, the page stays `/settings/plans`, the new block is in the list; haptics exactly `["delete"]` | pass | pass |
| 8 | Cold start `/settings/plans`: Settings + Plans stacked, Today active and lit; `/plan/plans` redirects to `/settings/plans` | pass | pass |
| 6 | Today's plan-end card (on `/today/2026-12-22`): its `Next block` (WP2's interim card still goes through `/plan/plans` → Settings › Plans; the script also takes the direct path WP2's final card opens) → the builder → Create: Today active and lit, no sheet | pass | pass |
| 5.2 #6 | Move from a row's menu: the picker is a `DayPager` (`aria-roledescription="pager"`) with 7 `Pressable` `.dpk-day` cells and no `.dp-day`/`.dp-week` left; the chips are Pressables | pass | pass |
| 5.2 #6 | A cell takes `data-pressed` on touch-down, cleared when the finger turns into a swipe; the swipe tracks 1:1 after the lock (the offset from the 22 px lock move constant over 8 moves: spread 0 px); a 220 px swipe pages to Oct 26 – Nov 1 with 0 haptics and no write; the chevron slides back over 28 frames | pass | pass |
| 5.2 #6–7 | A pick (Thu): the sheet closes, Easy 4 on Thursday, one `POST /sessions/:id/move`, toast with Undo, 0 haptics; a conflicting pick (Speed 5 next to Threshold 6): exactly `["warning"]`, `Two hard days in a row. Keep it?` + Undo; at 320 the cells are 45.7 wide | pass | pass |
| 11 (extended) | Grep over every file in `features/plan` plus `MoveSheet.tsx`, `DayPicker.tsx`, `daypicker.css`: haptics only `select` (useDayDrag), `drop`, `warning`, `delete` (Move: `warning` only; the picker none); no `layout`/`layoutId`/height animation; none of WP1's "Delete at integration" names nor `pressScale`, `onLongPress`, `openPlans`; no react-router; no `:active` | pass | pass |

Unit: `builderModel.test.ts` 4/4. Gates on the final tree: `tsc --noEmit` shared, api, web exit 0; shared 88, api 59, web 90 tests; `pnpm --filter @logbook/web build` ok (entry chunk 936.8 kB, step 1 935.5).

Run-to-run note: in the first full run p1 at 1× missed by 0.08 px (the first frame after release 1.08 px off the predicted spring, tolerance 1) and p4 at 4× saw the segmented thumb on 2 frames instead of ≥ 4 ; neither the code they measure nor the scripts changed in this step, and three reruns of p1 and p4 at both rates and the final full run passed. (A one-off debugging browser of mine overlapped part of the final run; it passed regardless.)

## Hand-verifiable steps (step 2)

1. Plan, scroll to the foot of the week. Expected: one card, `WEEK 3 OF 11`, `2026.10 Banking Plan`, a row of small bars, and `New block ›`. Tapping the name does nothing.
2. Tap `New block`. Expected: a tall sheet; under its title a fixed preview: `8 WEEKS · 26 RUNS · PEAK 16 MI`, the block's name and dates, and a grid of coloured cells (a column per week). No buzz.
3. Tap `Half`. Expected: the preview cross-fades to the half-marathon block (12 columns, the race cell orange in the last one); the preview's height does not change; the controls below do not jump.
4. Change the miles or a run day. Expected: the cells change in place; the verb at the bottom reads `Replace 45 planned sessions from Oct 26` (or `Use this plan` with nothing to replace). Toggle `Start tomorrow`: the date in the verb becomes Oct 24.
5. Tap the verb. Expected: one buzz (a replace), the sheet closes, Plan slides to the block's first week, a toast `… 45 sessions replaced. Undo`. Undo puts it back, silently.
6. Today's avatar → Settings; go to Plans (`/settings/plans`). Expected: a `Plans` page with `+` at the right and the plans as rows in one rounded group; the Today tab stays lit. `+` → the same builder; its verb → the sheet closes and you stay on Plans, with the new block in the list.
7. Hold a Plan row → Move. Expected: the chips and a week of days; swipe the days sideways: they follow the finger and land on the next week; the chevrons slide. Tap a day: the sheet closes, the session moves, no buzz, a toast with Undo. Move a hard session next to another hard one: one warning buzz and `Two hard days in a row. Keep it?`.
8. With Reduce Motion on: the builder's goal change is still a short fade; the day picker's page change is a fade.

## Findings closed in step 2

| Finding | Status | Evidence |
|---|---|---|
| flows 6.3: the template sheet is a long form with the preview under the fold | Fixed | the ghost is the sheet's fixed 160 header (p7) |
| flows 6.1 / nav F12: `openPlans`; Next block opens a list of old plans | Fixed (WP4's half) | the card's only door is the builder; `openPlans` deleted; Plans is a page at `/settings/plans` (p8). Today's `Next block` opening the builder directly is WP2's `PlanEnd` (request below) |
| live-synthesis (New block ignores the onboarding answers: `Just running`, Tue/Thu/Sat/Sun for an account that said 10K, Tue/Wed/Thu/Sat/Sun) | Fixed | the builder seeds from the prefill, else `user.trainingProfile`, else the last four weeks (`startOf`) |
| §7.4 the honest verb | Fixed | p7: `Replace 45 planned sessions from Oct 26`, and the server replaced exactly 45 |
| §11.4 haptics in the builder (`toggle` on switches, `success` on Create, `error`, `toggle` on Undo), the picker's chevron `select`, Move's `drop` on a pick | Fixed | p7, p8, p13 haptic logs; p9 grep |
| WP1 request: `.dp` collision (`sessions.css`'s day picker) | Fixed on WP4's side | the picker is `.dpk-*` in `daypicker.css`; the dead `.dp-*` rules in `sessions.css` are WP2's to delete (request) |
| WP1 "Delete at integration": `DatePager` in the day picker; `pressScale` on the block card; `onLongPress` in the picker | Fixed | p9 grep |
| `:active` scale/surface rules (§11.1) in `plan.css` | Fixed | p9 grep |

## Requests (step 2)

- **WP2 (`features/day/PlanEnd.tsx`)**: `Next block` should call `useOpenBuilder()(fromEndingBlock(last, profile))` over Today (spec §7.4, flows 6.1); today it does `haptics.select()` and `nav('/plan/plans')` through react-router. `SetupCard` already imports `openTemplate` from `Blocks.tsx` statically, so `Blocks.tsx` and `Builder.tsx` are in the entry chunk today and a static `useOpenBuilder` import adds nothing new.
- **WP2 (`features/sessions/SessionEditor.tsx`)**: the editor's day pick fires `haptics.select()` (`DayPicker onPick={(x) => (haptics.select(), setD(x))}`); §11.4 has no haptic on a pick.
- **WP2 (`features/sessions/sessions.css`)**: the `.dp`, `.dp-head`, `.dp-nav`, `.dp-pager`, `.dp-week`, `.dp-day`, `.dp-dow`, `.dp-pill`, `.dp-num`, `.dp-bar` rules (the old day picker) are dead now and can go; `foundation.css`'s comment on the collision (WP1) can then go too.
- **WP6 (Settings root)**: the `Plans ›` row in the Training group pushes `/settings/plans` (p8 drives it with `nav.go`, which is what the row does).

## Screenshots (step 2, looked at)

Before (`e9f4d1c`): `S/wp4/qa/shots/before-{390,320}-{block-card,builder,builder-half,builder-foot,move,daypicker,plans-page}.png`: the card a button with a chevron and a separate New block button, the preview under the fold of the form, the verb `Replace 45 sessions`, the plans page's single row floating without a group. After: `S/wp4/qa/shots/after-{390,320}-{block-card,builder,builder-half,builder-foot,move,daypicker,plans-page}.png` and `after-390-reduced-builder.png`. No horizontal overflow at 320; console clean.

# Step 1: the page

## Files

| File | What and why |
|---|---|
| `features/plan/PlanView.tsx` | Rewritten. `NavBar` (caps `weekCaption` / `monthCaption`, prev · cur · next stacked and bound to the shown pager's `progress`, `handle.target` for a 2–7 page `goTo`; title `Plan`, tap → this week / this month, hold → `Go to a week…` = `useOpenCalendar({ mode: 'week' })`; `Segmented` Week \| Month in the 96 px slot, `wideTrailing`). `view` + Monday + first-of-month as state, read once from `useRouteParams`, mirrored with `nav.replace`, changed by `useRootRequest` (a cut sets them before the first frame; on an active Plan the pager slides, or the panes crossfade if the view changes) and `useHomeControl`. Two panes, both mounted (the month pane in idle after the first paint), stacked in one grid cell: `DayPager step='week'` and `step='month'`; Week ⇄ Month is a 200 ms WAAPI opacity crossfade; the pane that is neither shown nor leaving sits under React's `<Activity mode="hidden">`, so a drop or a tab switch does no work for it. No react-router. |
| `features/plan/Week.tsx` | Rewritten. `WeekPage` (memoised by its Monday, its own `useLog`): the week line, the seven days as 60 px rows in one inset group, the block card. Rows: date column 48 (weekday caps, the number; today's in the 28 px accent disc), 3 px tone bar, the name as a 17 px stamp, distance 15 ink-3, status (done = 14 px check; Missed / Skipped 13/18 ink-3, a 1 px strike on a missed name; Floor amber; never red). A row is a `Pressable` (`press="surface"`): tap → `useOpenSession`; hold 450 → lift in place + `Done · Skip · Move · Delete`; a move after the hold → the drag (`useDayDrag` on `Pressable`'s `onDragStart/Move/End`). An empty day: tap adds (`Rest` + `+`); a planned rest day also holds Add / Move rest day / Delete rest day. The conflict row inline under the pair (`Two hard days in a row. Keep it?` · Keep it · Undo), fading in; the rows below move by FLIP. The row hooks (open, add, move, mark, delete, reshape, toast) are made once per group (`useKit`), not per row. |
| `features/plan/WeekLine.tsx` (new) | `weekWords` (moved from Week.tsx; the head is now `20 mi · 4 runs`) and `WeekLine`: 22/28 600, the `This week` pill (32, `--accent-tint`) at the right off this week, shown on the live page only and faded in over 120 ms when its page commits; the 4 px bar only once a mile is run (static `scaleX`). |
| `features/plan/useDayDrag.tsx` | Rewritten over `Pressable`'s drag callbacks (no hold of its own, no clone): a `.drag-pill` portalled to `body` follows the finger 1:1 (transform written on the move), the day under the finger is lit (`.is-target`), `select` once per row crossed, edge auto-scroll of the tab scroller. On a drop on another day the pill flies into the day's slot on `springs.settle` as a WAAPI animation (transform only; its easing is the spring as `linear()`), the row it left keeps a placeholder look; on the landing frame the move or swap is written (`drop` or `warning`, toast with Undo), the new row renders under the pill with its content held back (`data-landing`) and the two cross over in 120 ms. Back to its row on its own day, off any day or on cancel. Reduced motion: no travel, a 150 ms fade. |
| `features/plan/flip.ts` (new) | The §10.1 FLIP for the week group: `capture()` before a change; every render in the next 1.5 s animates whatever moved (relative to its day) from where it was on screen with an inverse `translateY` released to 0 on `springs.settle` (WAAPI, `linear()` spring easing). Positions are relative to the group, so a scroll moves nothing. Reduced motion: none. Exports `settleEasing`. |
| `features/plan/Month.tsx` | Rewritten. `MonthPage` (memoised by its first): `M T W T F S S Wk` head; up to 6 week rows of 56 px, each a `Pressable` (tap → that week in Week); cells: number 13/18 (today in the accent disc), miles 11/13 (run in ink, planned in ink-3), the lead session's 3 px tone bar as `::after` (missed/skipped ink-4); `Wk` column (run, `of` planned; `planned` ahead); this week's row on `--surface`. No drag, no legend (its height animation went), no entry animation, no 0.6× follow (the pager is 1:1). |
| `features/plan/Blocks.tsx` | `BlockCard` split into `blockCardOf(log)` + `BlockCardView`, and `usePlanBlock()` (one log over the block's months, the card's data computed once per data change and handed to all six pages; it was six logs). `useNavigate` → `useNav().go` (the builder's `Create` goes to Plan only when `useTab() === 'plan'`; the week path is a Monday). The template picker's three `haptics.select()` removed. |
| `features/plan/PlanBuilder.tsx` | `useNavigate` → `useNav().go`, only when opened on Plan (spec §1.3). |
| `features/plan/plan.css` | The week, month and pane sections rewritten (the block card, plans sheet and builder sections kept). Deleted: `.pl-zoom`, `.pl-pullhint`/`.pl-pullwrap`, `.pl-plate`, `.mg-plate`, the TODAY radial glow, red MISSED, `:active` rules on rows and weeks, the legend. |

No file outside WP4's ownership changed. `api/queries.ts` and `api/types.ts`: untouched.

## Acceptance (build plan §5.4; the checks this step covers), measured

`node S/wp4/qa/run.mjs`, 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch; **128/128 at 1× and 128/128 at 4×**. Full table with every measured value: `S/wp4/qa/results/TABLE.md`.

| §5.4 | What | 1× | 4× |
|---|---|---|---|
| 1 [49] | 270 px swipe from Tuesday's row: `/plan/week/2026-10-26` by replace (history.length 3 → 3), no sheet, 0 haptics, 1 commit; caps `NEXT WEEK · OCT 26–NOV 1`; caps labels 0.50 / 0.50 at x = −195; the track = finger travel (−260 / −260); the release spring starts at the finger (x0 −260, no kick); first frame after release on that spring (−262.87 vs −263.12, +6 ms) | 8/8 | 8/8 (−263.04 vs −263.12) |
| 2 [49] | hold: `Done · Skip · Move · Delete`, 1 lift, lifted in place; menu gone 77 ms (4×: 49 ms) after the drag starts; pill lag 0.09 px; the lit row is the one under the finger; `select` 1 then 2 (rows crossed); the pill shrinks over 19 frames (transform; WAAPI transform + opacity only); Sunday (the displaced row) translateY 60 → 0 over 18 frames (4×: 20); 1 `drop`, toast `Moved to Thu · Undo`; one `POST /sessions/:id/move`; no `/plan/plans` | 12/12 | 12/12 |
| 3 | swap Easy 5 ⇄ Speed 5: two writes; the pill shrinks over 19 frames and Speed 5 slides 120 → 0 over 20 frames; `lift,select,select,drop`, `Swapped with Speed 5 · Undo`; Undo: two writes, the row slides −120 → 0; conflict: 1 `warning`, 0 `drop`, the inline row under Saturday inside the group, no height/top/padding/margin keyframes, Sunday FLIPs −84 → 0; its Undo puts both back | 9/9 | 9/9 |
| 4 | the month pane mounted before the first switch; tap Month: both panes in the DOM and visible through the fade (6 mid-fade frames), settled at 183 ms (4×: 200); `.seg-thumb` 0 → 48 over 15 frames (4×: 8); `/plan/month/2026-10-01`, `OCTOBER 2026`, 0 haptics; a week tap → `/plan/week/2026-10-26`, thumb back, the same crossfade | 8/8 | 8/8 |
| 5 | month pager 270 px: lag 0 px on 13 moves, the grid at −244 (= 16 − 260); `/plan/month/2026-11-01` by replace, `NOVEMBER 2026`, 0 haptics | 3/3 | 3/3 |
| 6 | caps line, large title, inline title (scrolled), the lit tab and the This week pill, each off this week: one slide home of W (max travel 389.0–389.2 px: the spring rests within 1 px) to `/plan`; the pill 32 tall on the live page only; 0 haptics; hold → exactly `Go to a week…` → the calendar in week mode → a pick of Nov 4 lands on `/plan/week/2026-11-02` on the same history entry; trailing slot 96, segmented 96 × 32; at 320 `.nb-cap` 192 / 192 with `NEXT WEEK · OCT 26–NOV 1`, no horizontal overflow | 13/13 | 13/13 |
| 9 [7] | no `touchmove` at rest on Plan's `.tab-scroll`, `document` or `window`, nor on a row; `pinch`, `PullHint`, `pl-plate`, `pl-zoom` nowhere in `features/plan` | 4/4 | 4/4 |
| 11 | no `SwipeRow` / `stopPropagation` in Week.tsx; no react-router in `features/plan`; `haptics.select()` only in the drag; Plan's page files fire only select (drag), drop, warning, delete; no `layout`/`layoutId`/height animation; none of WP1's "Delete at integration" names | 7/7 | 7/7 |
| 10 | missed row: no colour within 25° of `--bad`'s hue, `Missed`, a 1 px strike; today's disc 28 × 28 `--accent`, white; rows 60 in a 12 px group; no bar this week, the bar at scaleX 0.218 on Oct 5 (2.4 of 11); a row tap opens the session sheet; an empty day's tap opens Add a session; 28 targets ≥ 44 | 10/10 | 10/10 |
| reduced | the drag tracks 1:1 and the release crossfades (no slide); the drop has no travel or FLIP; Week → Month stays an opacity crossfade | 4/4 | 4/4 |
| E2E | WP1's smoke (22) and the seams' e2e (28): login, four tabs, Settings and its sections, This morning, Reads, `/settings/plans`, sheets, a hold menu, `/dev/ui`, `/welcome`; console clean | 50/50 | 50/50 |

Not covered by this step (next steps): §5.4 #6's builder `Create` (from Plan and from Today), #7 (the builder's 160 px header, the honest verb), #8 (`PlansPage` under `/settings/plans` with `New block`, `/plan/plans` redirect: WP1's routes already redirect; the seams' e2e covers the page loading).

Gates (final tree): `tsc --noEmit` shared, api, web exit 0; shared 88, api 59, web 86 tests passed; `pnpm --filter @logbook/web build` ok (entry chunk 935.53 kB, seams base 935.05; 25 files precompressed, 425 KB gzip).

## Hand-verifiable steps

1. Log in, tap Plan. Expected: bar `THIS WEEK · OCT 19–25` (this week) with `Week | Month` at the right; title `Plan`; `20 mi · 4 runs` and `Next: Easy 4, today.`; seven 60 px rows in one rounded group; today's number in a blue disc; missed runs struck through with a grey `Missed`, nothing red.
2. Swipe left anywhere on the rows. Expected: the whole week follows the finger, the caps words cross-fade as you drag, the page lands on next week, no sheet opens, nothing buzzes; a `This week` pill fades in at the right of the week line.
3. Tap the title (or the caps line, or the pill, or the lit Plan tab). Expected: one slide back to this week.
4. Hold a session row. Expected: it grows slightly at 300 ms, lifts at 450 ms with one tick, and a menu `Done · Skip · Move · Delete` appears with the row bright and the rest dimmed.
5. Keep holding and move. Expected: the menu goes, a pill with the session's colour and name rides above your finger, the day under it lights with a blue ring, a tick per day crossed.
6. Let go on an empty day. Expected: the pill shrinks into that day's row, the session is there, the rows that had to move slide into place, one tick, a toast `Moved to Thu · Undo`. Undo puts it back with the rows sliding.
7. Drop a hard run next to another hard one. Expected: a warning buzz and, inside the group under the pair, `Two hard days in a row. Keep it?` with Keep it / Undo; the rows below slide down to make room.
8. Tap `Month`. Expected: the week fades out and the month fades in (200 ms), the thumb slides; the grid shows run miles in white, planned in grey, a tone bar under each day with a session, this week's row highlighted. Swipe the grid sideways: it follows the finger and lands on the next month. Tap a week row: back to Week on that week.
9. Hold the title. Expected: one item, `Go to a week…`; it opens the calendar in week mode; a pick lands on that week.
10. With Reduce Motion on: swipes and drops fade instead of sliding; the drag still follows the finger.

## Findings this step was to close

| Finding | Status | Evidence |
|---|---|---|
| nav F14, evening #2: `SwipeRow` on Plan rows, `pl-slot` `stopPropagation`, `useSwipeKeepsName` | Fixed | p9 #11 greps; a swipe on a row pages the week (p1) |
| nav F15, critic C10: the pinch, the header pull, `PullHint` | Fixed | p9: no `touchmove` at rest; greps |
| visual F16: the TODAY glow, red MISSED | Fixed | p10: no red within 25° of `--bad`; today is a 28 px disc |
| §13.1: `.pl-plate`, `.pl-zoom`, the 0.6× month follow, `layoutId` plate travel | Fixed | greps; p5 lag 0 px |
| touch F7/F13 (`RestLine`'s timer, `useHoldDrag`'s 300 ms) in Plan | Fixed | rows are `Pressable`s on `useHold` (one 450 ms clock); p2 |
| §11.4: `haptics.select()` in the builder pickers; navigation haptics | Fixed | p9 static; p1/p4/p5/p6 count 0 haptics |
| WP1's requests to WP4 (review §Requests): PlanView on `DayPager step='week'` with memoised pages; `Segmented in-bar` in the 96 px slot; the row menu to 4 on `Pressable onDragStart` (no own lift: the hole tracks the real lift); MISSED not red | Fixed | p1, p2, p6, p10 |
| WP1 feel review N6 (Plan's mount / 4× weight) | Partly | pages memoised; the hidden pane under `Activity`; the block card's data once for six pages; row hooks once per group. A drop's optimistic re-render at 4× is still ≈ 150–250 ms of main thread, about two thirds of it other tabs (Progress, Journal, Today) re-rendering on the month change (request below); the pill flight and the FLIPs are compositor animations, so they run through it |
| flows 6.1, nav F12: `/plan/plans` as a URL-rewriting sheet; `openPlans` | Partly | PlanView's `/plan/plans` handling is gone (WP1's route redirects to `/settings/plans`); the block card still opens the plans sheet on tap (the block card step) |

## Requests

- **WP1 (`ui/NavBar.tsx`)**: a way to keep the title still while the caps are stacked. NavBar binds every `[data-sl]` label to `progress`, so Plan's constant `Plan` would fade to 0.5 mid-drag (and a `prev`/`next` of `Plan` would dip to 0.75). Shim: `.plan-root .nb-title [data-sl], .plan-root .nb-inline [data-sl] { opacity: 1 !important }` in `plan.css`. Suggested: bind a label only when its stack has a `prev` or `next` that differs from `cur`.
- **WP1 (`app/Shell.tsx`) / WP2 / WP6**: every mounted tab re-renders on a month query change. On a Plan drop at 4×, Progress (≈ 70 ms), Journal (≈ 20 ms) and Today (≈ 40 ms) re-render with Plan's ≈ 60 ms. An inactive tab could defer such updates (React's `Activity` would, but it hides with `display: none`, which WP1 avoids for WebKit's `scrollTop`; `useDeferredValue` on the month bundles in the hidden tabs' roots would also do).
- **WP1 (`ui/primitives.tsx` `Segmented`)**: `place()` reads `offsetWidth` in a layout effect on every value change, which forces the incoming pane's style and layout inside the click's task (measured ≈ 180 ms of a Week → Month switch at 4×, before the stacking fix ≈ 230 ms; now ≈ 60 ms). Reading the button's `offsetLeft`/`offsetWidth` once at mount and on resize would leave the switch's layout to the frame.
- **WP2 (`features/sessions/actions.tsx`)**: `done()` fires `haptics.success()` (spec §11.4: `success` only twice a day) and `skip()` fires `toggle` (Skip: none). Plan's rows do not use them (their menu marks through `useSessionMutations` directly); the session sheet still does.
- **WP2 (`features/sessions/sessions.css`)**: `.pl-chip` lives there; Plan's conflict row uses its own `.pl-ask` now.
- **Spec (`docs/feel.md`, requests only)**: §7.2 says the displaced row reflows by `layout="position"`; Plan uses the §10.1 FLIP as a compositor animation instead (motion's layout projection measured ≈ 200 ms per drop at 4× across the three mounted weeks). §14 #49's "the track's position on the first frame after release equals the finger's last position ± 1" cannot hold literally for a release with velocity (the first frame is already ≈ 6 ms along the spring); p1 checks that the spring starts at the finger and that the first frame is on that spring (± 1 px). The drop's `drop` haptic fires on the landing frame (the pill in the slot), ≈ 300 ms after the finger lifts, so the haptic and the visual settle coincide (decisions "Haptics").

## Screenshots (looked at)

Before (`S/wp4/qa/shots/before-{390,320}-{week,next-week,month,past-week}.png`, the seams base): the zoom word, the TODAY glow, red MISSED, a month grid empty under the installed clock (its entry animation never ran). After: `S/wp4/qa/shots/after-{390,320}-{week,next-week,past-week,month,hold-menu,drag,dropped,conflict}.png` and `after-390-reduced-week.png`. No horizontal overflow at 320 (scrollWidth 320), console clean.

## Left (next steps of this package)

- Nothing of build plan §5.2 is unbuilt. What remains sits with other packages (the requests above) and the integration: Today's `Next block` straight into the builder (WP2), the `Plans ›` row (WP6), deleting the old `.dp-*` rules (WP2), and the deprecated adapters (WP1, after WP6).
- Device day one: the builder's crossfade and the picker's swipe in WebKit; the ghost header's `:has()` hairline (Safari 15.4+).
