# WP4 review: Plan

Branch `feel/wp4`, on `feel/pages-base` (WP1 merged, the seams' §F exports). Spec `docs/feel.md` v4.2 §0.2 (Sunday planning, looking ahead), §7, §14 #49; build plan §5; contracts §A–§F.

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`.

This review covers the **page step**: PlanView, the Week rows and the drag, the Month grid. The block card's 128 spec, `PlansPage`'s rows, the builder (§7.4) and `MoveSheet`/`DayPicker` are the next steps (see "Left").

## How to rerun

- Build and serve: `bash S/wp4/build.sh && bash S/wp4/serve.sh` (port 8830, a fresh copy of the seed each time; kills only its own PID).
- The battery: `node S/wp4/qa/run.mjs` runs every script at 1× and 4× (each against a freshly served seed) and prints the table below (also `S/wp4/qa/results/TABLE.md`, logs in `results/<script>.cpu<rate>.log`). `ONLY=p2-drag,p3-swap`, `RATES=4`, `--table` as in WP1's runner.
- Screenshots: `node S/wp4/qa/shots.mjs <tag>` (390 and 320, and reduced motion once).
- The Plan scripts put the page's `Date` at Fri Oct 23 2026 06:30 New York with a Date-only override (`qa/plib.mjs`), not Playwright's `clock.install`: the installed clock also fakes `requestAnimationFrame` and `performance.now`, which bunches frames at 4× (a drop's 18-frame settle read as 3 frames under it). The smoke and the seams' e2e use WP1's `SHIFT_MIN=auto`.

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

- The block card to spec (128: `WEEK 2 OF 11`, name 22/28, the arc 24, `New block ›` only; `openPlans` from the card goes) — `Blocks.tsx`.
- `PlansPage` rows to spec (inset group, 60 rows); `PlanDetail`'s `This week` now goes through `nav.go`.
- The builder (§7.4): the ghost preview as the sheet's fixed 160 px `header` with the goal crossfade, `Replace N planned sessions from <date>`, `fromEndingBlock` prefill check, the builder's own haptics (`toggle` on its switches, `success` on Create); §5.4 #6's `Create` lands on `/plan/week/<start>` from Plan and leaves Today shown from the plan-end card; #7, #8.
- `MoveSheet.tsx`, `DayPicker.tsx`: `springs` imports, `DayPicker` off `DatePager`, `Pressable` cells, no haptic on a pick.
- `pressScale={0.985}` on the block card's `Pressable` (a deprecated prop, pre-existing) goes with the block card step.
