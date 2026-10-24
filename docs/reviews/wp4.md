# WP4 review: Plan

Branch `feel/wp4`, on `feel/pages-base` (WP1 merged, the seams' §F exports). Spec `docs/feel.md` v4.2 §0.2 (Sunday planning, looking ahead), §7, §14 #49; build plan §5; contracts §A–§F.

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`.

This review covers two steps. **Step 2** (first below): the block card, the builder with its ghost header, `PlansPage`, `MoveSheet` and `DayPicker`, Plan's haptics. **Step 1** (the sections after it): PlanView, the Week rows and the drag, the Month grid.

## How to rerun

- Build and serve: `bash S/wp4/build.sh && bash S/wp4/serve.sh` (port 8830, a fresh copy of the seed each time; kills only its own PID).
- The battery: `node S/wp4/qa/run.mjs` runs every script at 1× and 4× (each against a freshly served seed) and prints the table below (also `S/wp4/qa/results/TABLE.md`, logs in `results/<script>.cpu<rate>.log`). `ONLY=p2-drag,p3-swap`, `RATES=4`, `--table` as in WP1's runner.
- Screenshots: `node S/wp4/qa/shots.mjs <tag>` (the page step's states) and `node S/wp4/qa/shots2.mjs <tag>` (the block card, the builder, Move, the day picker, Plans), at 390 and 320; reduced motion once each.
- The Plan scripts put the page's `Date` at Fri Oct 23 2026 06:30 New York with a Date-only override (`qa/plib.mjs`), not Playwright's `clock.install`: the installed clock also fakes `requestAnimationFrame` and `performance.now`, which bunches frames at 4× (a drop's 18-frame settle read as 3 frames under it). The smoke and the seams' e2e use WP1's `SHIFT_MIN=auto`.

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
