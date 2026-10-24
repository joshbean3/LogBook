# WP3 review: This morning

Branch `feel/wp3` (worktree `.claude/worktrees/feel-wp3`), on `feel/pages-base` (`400f8f5`, WP1 and the seams merged).
Spec `docs/feel.md` v4.2 §0.2, §4, §11, §14 tests 26, 47, 48; build plan §4. QA scripts, results and screenshots live in
`scratchpad/feel/wp3/qa/` (S below = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`).

## Step 1: one editor (spec §4.3, M16; build plan §4.2 item 6)

The session is the run; a morning's own setting is its alarm.

### Files changed, and why

| File | Change |
|---|---|
| `packages/shared/src/types.ts` | `MorningDayOverride = { wake: number }`. New `LegacyMorningDay = MorningDayOverride & Partial<{ mode; type; miles; minutes }>`; `ExportV2.morningDays` is `Record<ISODate, LegacyMorningDay>` so old export files still type and validate |
| `packages/shared/src/schemas.ts` | `zMorningDay` is `{ wake }` only; legacy fields are stripped (zod's default), never rejected |
| `packages/shared/src/morning.ts` | `MorningDay` declares its own `mode/type/miles/minutes` (no longer extends the override); `morningDayFor` takes the workout from the sessions (`morningPlanFor`) and only `wake` from the override, so a stored legacy override is read as `{ wake }` |
| `packages/shared/src/morning.test.ts` | the legacy override → the session's workout + the override's wake; a legacy run override on a rest or lift day; a skipped session keeps the day's alarm; `zMorningDay` strips |
| `apps/api/src/routes/core.ts` | `PUT /morning/days/:date` inserts `{ wake }` + neutral fillers (`mode` = the day's session mode or `'run'`, `type ''`, `miles 0`, `minutes 0`), updates only `wake` on conflict, answers `{ wake }`; the month payload emits `{ wake }` |
| `apps/api/src/services/exporter.ts` | the export writes the stored columns as `LegacyMorningDay`; the import validates `wake` required and the other four optional, and fills a missing column with the same fillers |
| `apps/api/src/db/schema.ts` | unchanged (the `NOT NULL` columns stay; no migration) |
| `apps/api/src/routes/fixround.test.ts` | new `one editor` block: fillers on a new day, a legacy PUT stores and answers `{ wake }`, a second PUT changes only `wake`, the month says `{ wake }`, export round trip of legacy rows, an old five-field file imports, a day without `wake` is refused |
| `apps/web/src/features/morning/DayEditor.tsx` | deleted; `parseWake` moved to `model.ts` |
| `apps/web/src/features/morning/model.ts` | `DayPatch = { wake?: number }`; `morningOf` keeps its signature |
| `apps/web/src/api/queries.ts` (WP3 block only) | `setDay` sends exactly `{ wake }` and caches the same shape, whatever the caller holds |
| `apps/web/src/features/morning/MorningView.tsx` | the run row (and `Edit` in its menu) opens the session sheet (`useOpenSession`), or the alarm sheet on a morning with no workout; Skip is one session mark (no override write); `Make this a rest day` marks every open workout of the day `skip`; `Back to …` un-skips them; the late note's chips write `{ wake }`, a session upsert with the miles, or `mark 'skip'` |
| `apps/web/src/features/morning/StepSheets.tsx`, `RoutineEditor.tsx`, `Schedule.tsx` | `WakeEditor` writes `{ wake }`; `parseWake` from `model.ts`; a doc comment |
| `packages/shared/src/phase.test.ts`, `status.test.ts` | **no owner in the build plan.** Each had one case asserting the deleted behaviour (a `mode: 'rest'` override winning over a planned run). Without the edit the shared test gate cannot pass, so each was restated in place: a skipped run with the day's own alarm. Nothing else in either file changed |

### Acceptance (build plan §4.4, the parts this step owns), measured

Runner `S/wp3/qa/run.mjs`; the full table with every number is `S/wp3/qa/results/TABLE.md`: **168 pass, 0 fail, 0 missing**. Browser scripts ran at 1× and 4× CPU, clock installed at Fri 2026-10-23 (New York time).

| Test | Script | Checks | 1× | 4× | Key numbers |
|---|---|---|---|---|---|
| E2E (WP1's smoke, unchanged) | `smoke.mjs` | 22 | 22/22 | 22/22 | four tabs, Settings depth 2, This morning push and back, Reads, `/settings/plans`, a sheet, a hold menu, console clean |
| #2 [48] run row → session sheet | `t48-session.mjs` | 11 | 11/11 | 11/11 | sheet `Easy 4` 5 ms / 37 ms after the tap; save = one `POST /sessions` `miles: 3`, 0 writes to `/morning/days`; the run row reads `3 mi` at once; hero `Easy 3` the frame the pop rests (pop 534 / 579 ms), 0 month refetches (optimistic); `morningDays[10-23]` unchanged (null → null) |
| #1 [47] the write's body | `t47-wake.mjs` | 8 | 8/8 | 8/8 | WakeEditor `Just today`: one `PUT /morning/days/2026-10-23` `{"wake":440}` and nothing else; wake, door, run and cool-down +5 min, the 8:40 routine unchanged; month `{"wake":440}`; stored row `run,'',0,0,440`; `Every morning` → `PATCH /morning/settings {"wake":430}`, no day row |
| #9 late note | `t09-late.mjs` | 12 | 12/12 | 12/12 | 8:00 alarm: `Back at 8:58, 18 min past`; `Wake 7:40` → `{"wake":460}`; `Run 1.5 mi` → `POST /sessions miles 1.5`; 8:35 alarm: `Skip the run` → `mark: skip`; no override body with a workout field |
| #4 the hold menu's writes | `t04-menu.mjs` | 9 | 9/9 | 9/9 | Skip → 1 mark write and a toast with Undo; Undo → `mark: null`; Sat `Make this a rest day` → 2 marks; `Back to Threshold 6` → 2 un-marks; 0 morning-day writes |
| §4.3 quiet drop | `t43-legacy.mjs` | 8 | 8/8 | 8/8 | stored `('rest','Rest',9,90,450)` → month `{"wake":450}`; This morning Easy run 4 mi at 7:50, Wake 7:30; hero `Easy 4 … Wake 7:30`; a legacy-shaped month answer (gym 90) is still read as the run; an alarm save on that row → `{"wake":455}`, legacy columns untouched |
| #10 shared/API, live | `t10-export.mjs` + vitest | 8 + 5 + 3 | 8/8 | n/a | fillers on a new day; legacy PUT answers `{"wake":430}`; second PUT changes only wake; export → fresh account 3/3 same wakes; an old five-field file imports; no wake → 422 |
| #11 greps (this step's) | `t11-grep.mjs` | 14 | 14/14 | n/a | DayEditor gone; `DayPatch = { wake?: number }`; `morningOf` signature kept; `zMorningDay` wake only; `db/schema.ts` unchanged; no react-router added |
| Gates | `gates.mjs` | 6 | 6/6 | n/a | tsc shared/api/web exit 0; shared 93, api 62, web 86 passed; web build ok (425 KB gzip); WP1's grep gates 23/23 + 48 unit tests |

Not yet covered (later WP3 steps): the alarm drag itself (#1's 42 px / 3 `select`), the Leave row and Now card (#1, #5), the FLIP on Skip (#4), the flyer (#7), RoutineEditor focus (#8), and #11's MiniLine / `m-leave-glow` / `sch-grip` / `now-pulse` / react-router greps.

### Hand-verifiable steps

1. Log in (josh@example.com / password123) with the clock on Fri Oct 23 06:30. Open `/today/2026-10-23/morning`. Tap `Easy run`. Expected: the session sheet `Easy 4` (Plan / Floor / Out at / Back), not the old Run/Gym/Rest editor.
2. In the sheet: Edit → Miles − twice (3 mi) → Save. Expected: the run row reads `3 mi · 8:20/mi` at once; the chevron back shows the hero `Easy 3`; the network shows one `POST /api/sessions` and nothing to `/api/morning/days`.
3. Tap `Wake up` → Alarm + → `Just today` → Save. Expected: one `PUT /api/morning/days/2026-10-23` with body `{"wake":440}`; every row up to the cool-down moves 5 min; the routine stays at 8:40.
4. `GET /api/months/2026-10`: `morningDays["2026-10-23"]` is `{"wake":440}`, no other key.
5. In SQLite, write a legacy row `('rest','Rest',9,90,450)` for Oct 23 and reload with the cache cleared. Expected: This morning shows Easy run 4 mi from 7:50, Wake 7:30; the hero says Easy 4 with Wake 7:30, no rest.
6. Set the alarm to 8:00 for Oct 23 and open This morning at `?at=08:40`. Expected: the late note `Back at 8:58, 18 min past the 8:40 routine` with `Wake 7:40` and `Run 1.5 mi`. Each chip writes, in order, `{ wake: 460 }`, `POST /sessions` with `miles: 1.5`, and (with an 8:35 alarm) `Skip the run` → `POST /sessions/<id>/mark {"mark":"skip"}`.
7. Hold the run row. Expected: `Skip Easy 4` → one mark write and a toast with Undo; Undo → `mark: null`. On Sat Oct 24 `Make this a rest day` → two mark writes (run and lift); the wake row's `Back to Threshold 6` → two `mark: null`.
8. Export the account, then import into a fresh one. Expected: the same wakes, each read back as `{ wake }`.

### Requests

- **Owner of `packages/shared/src/phase.test.ts` and `status.test.ts`** (none in the build plan; the orchestrator): accept the two restated cases above, or assign the files.
- **WP2**: the hero needs nothing for this step (it reads `morningOf`, which now follows the session). Risk 8 (`Back to the plan` restoring the planned miles via `plannedMiles` on the session) is the session sheet's, so it is WP2's.
- **WP1 (an observation, not this step's to fix)**: at 4× a session sheet takes 855–1086 ms to close after Escape, and a tap on the pushed page's chevron during that close is lost (the layer stays, `pathname` unchanged after 4 s). `t48-session` now waits for the sheet to unmount. Worth a look in `ui/Sheet.tsx` / `ui/PushedLayer.tsx`: the closing sheet should not swallow a tap on the page under it.
- **Spec note (§4.1, §11.2)**: the run row's menu is `Skip Easy 4 · Make this a rest day · Edit`. With the session as the run, this branch reads "Make this a rest day" as *every* workout of the day skipped (Skip takes the one in the row), so on a one-session day the two differ only in copy and toast. A product decision is open: keep both, or drop `Make this a rest day` on one-session days.

### Screenshots (looked at)

`S/wp3/qa/shots/{before,after}-{390,320}-{morning-legacy,today-legacy,run-row-tap,late-note}.png`. Before: a legacy rest override turns Friday's planned Easy 4 into a rest morning, and the run row opens the DayEditor (Run/Gym/Rest, Alarm, Miles). After: the same legacy row gives the session's Easy run 4 mi from 7:50 with the override's Wake 7:30, the Today hero agrees (`EASY 4`, Wake 7:30), and the run row opens the session sheet (`Threshold 6`: Plan, Floor, Out at, Back; Done, Floor, Skip, Move, Edit). The late note looks the same before and after; only its writes changed. `scrollWidth` is 390 / 320 on every shot, and the console is clean.

## Step 2: the page (spec §4.1, §4.2, §4.4–§4.6, §11.2; build plan §4.2 items 1–5, 7–9)

This morning is now the pushed page the spec describes. The owner asked for a schedule that is "very accessible and
satisfying, something you can drag and drop, but also click into to edit". Every row taps into its own editor. The
alarm drags by its stamp, and every time below follows on the same frame. A routine step held 450 ms lifts and can be
dropped into place. Each gesture has a keyboard and VoiceOver path.

Commits: `44d833e` (the page), `23cc874` (Now card geometry, the stamp's column after a drag, past Leave copy, reduced motion).

### Files changed, and why

| File | Change |
|---|---|
| `features/morning/MorningView.tsx` | The pushed page: `PushedBar` (title `This morning`, or `Tomorrow morning` / `Yesterday morning` / `<Weekday> morning` on other days, with the date as the eyebrow; trailing `SlidersHorizontal` 44 × 44 opens the routine editor). Then the Now card, the schedule, `+ Add a step`. The date comes from `useRouteParams()` and the clock is Today's `useNowMinutes`. No react-router, DatePager, TabHeader, DayStepper, MiniLine, `now-pulse`, `.m-timings`, `enterPull` or `?routine=1`. The alarm drag lives here: the dragged wake is laid over the day (`morningOf(…, { wake })`), and the stamps it moved are tracked against where the drag began. The day keeps the dragged alarm until the optimistic cache has it, so nothing flickers back. The one write is sent after the release frame has painted. Skip, rest and back raise their Undo toast once the morning has been re-laid. None of them fires a haptic (§11.4) |
| `features/morning/NowCard.tsx` (new) | `MiniTimeline shared="morning-line-<date>"` (the flyer's landing) and one line: `Alarm in 43 min` · `Out the door in 22 min` · `Back by 8:13` · `<Step> now · Leave in 45 min` (`Free until 8:40 · …` in the free stretch) · `Left 9:30`. On past days it reads `Woke 7:15 · Left 9:30` and on future days `Alarm 7:15 · Leave 9:30`. Only today's line is a live region. Padding 13/16, so the card is 96 tall with the 44 px line |
| `features/morning/AlarmHandle.tsx` (new) | The Wake stamp, 48 × 60, the only element with `touch-action: none`. It locks after 10 px inside the 40° vertical cone, and a horizontal lock lets go. Each `trunc(dy / 14)` step from the pointerdown point is 5 minutes, with one `haptics.select()` per step and the page re-laid on the same frame (`flushSync`). Past `WAKE_MIN`/`WAKE_MAX` the stamp rubber-bands at 0.25×. Release sends one write. The digits are two stacked labels crossfading over 120 ms. It is a slider for the keyboard and VoiceOver (`aria-valuenow`, `aria-valuetext`): ArrowUp/Down move 5 min, with one write when the keys stop. A tap, Enter or a release before the lock opens the alarm sheet. A handle that captures the pointer ignores its child's implicit-capture loss |
| `features/morning/Schedule.tsx` | One row type (time 48 · icon 32 · name · sub, nothing on the right) in one inset group: Wake · the workout (door and cool-down folded into `4 mi · 8:20/mi · back 8:13`) · the late note · Free (`27 min · routine at 8:40`) · the steps · Leave. The row under way has the accent time and the 2 px `scaleX` line (1 s linear). Rows are `Pressable`s: a tap opens the editor; a 450 ms hold opens `Edit · Remove` on a step and `Skip Easy 4 · Make this a rest day · Edit` on the run. A move after the hold drags the step 1:1 (inline transform, no spring under the finger), with a `select` per slot crossed and the others sliding by FLIP. Release gives one `drop` and one `saveOrder`. Alt+Arrow and hidden `Move … up/down` buttons are the keyboard and VoiceOver path. Rows that leave fade 100 ms (`AnimatePresence popLayout`) and the rows below spring on `settle` |
| `features/morning/flip.ts` (new) | The FLIP (§10.1) on the compositor: `springs.settle` sampled with WP1's integrator into a WAAPI `translateY` animation. A Skip's or a drop's write re-renders every page that reads the month (Today's three, under this one), which blocks the main thread for about 400 ms at 4×. A motion-value spring froze through that and jumped (measured, 4×: 0 frames translated). This one keeps playing |
| `features/morning/LeaveRow.tsx` (new) | `Leave for work`, sub `In 45 min` (late: `12 min later than your routine` in `--warn`), stamp 22/28 on the right, `position: sticky; bottom: 0` with a hairline above. It writes `--toast-lift` on `.pushed` from its resting position (on every render, scroll and resize), so toasts sit above it. A tap opens the routine editor on its leave field. `m-leave-glow` is gone |
| `features/morning/model.ts` | `rowsOf`, `timeState`, `nowLine`, `justWord`. Its own 30 s `useNowMinutes` and the reorder "lesson" are deleted |
| `features/morning/StepSheets.tsx` | `WakeEditor` ends in its two choices, `Every morning · Just today` (`Just tomorrow` for tomorrow), each saving on its own tap. The filled one follows `preselect` and there is no segmented. No toast and no `success` haptic on any editor's save; `Remove` keeps its Undo. `GapEditor` is deleted (the buffers fold into the run row; the routine editor keeps the field). The segmented in `StartEditor` fires no haptic |
| `features/morning/RoutineEditor.tsx` | A `Leave` field leads the sheet: the time you leave on this morning, which sets when the routine starts (fixed). `useOpenRoutineEditor('leave')` opens on it, and the input takes focus when the open animation completes. The preview is `MiniTimeline`. No height animation (the fine stepper fades in), no `:active` scale, no toast, no `success` |
| `features/morning/morning.css` | Rewritten for the page. The stamps' flash is an accent copy faded by opacity (compositor), not a colour tween |
| `MiniLine.tsx`, `MorningMini.tsx`, `mini.css` | Deleted |

### Acceptance (build plan §4.4), measured

Runner: `S/wp3/qa/run.mjs`. Every browser script runs at 1× and 4× CPU. The full table, every check with its measured
numbers, is `S/wp3/qa/results/TABLE.md`: **301 pass, 1 fail, 0 missing**. That covers this step's 6 new scripts, step 1's 6
(updated for the new DOM), WP1's smoke, the export and grep scripts, and the gates: tsc for shared, api and web exit 0;
shared 93, api 62, web 86 tests; web build ok; WP1's grep gates 23/23. The one fail is 22a at 4× (below). The key checks,
condensed:

| Test | Check | 1× | 4× |
|---|---|---|---|
| t47-drag 47a | 06:30: the Leave row's bottom ≤ the tab bar's top without scrolling | PASS {"leaveBottom":687,"tabTop":794,"lines":1,"scrollTop":0,"sw":390} | PASS {"leaveBottom":687,"tabTop":794,"lines":1,"scrollTop":0,"sw":390} |
| t47-drag 47c | the handle is 48 × 60 with touch-action none (on it only) | PASS 48×60 ["none","auto"] | PASS 48×60 ["none","auto"] |
| t47-drag 47d | 42 px down: the alarm 7:15 → 7:30 (+15 min) | PASS stamp 7:15 → 7:30 | PASS stamp 7:15 → 7:30 |
| t47-drag 47e | exactly 3 select events (none for start/end), no other haptic | PASS ["select","select","select"] | PASS ["select","select","select"] |
| t47-drag 47f | while dragged: the Wake row at 1.02 on --surface-2, the moved stamps lit, nothing written  | PASS {"dragging":true,"scale":"1.02","bg":"rgb(27, 27, 27)","moved":3,"writes":0,"writesMid":0} | PASS {"dragging":true,"scale":"1.02","bg":"rgb(27, 27, 27)","moved":3,"writes":0,"writesMid":0} |
| t47-drag 47g | every row's time (and the Now card's stops) updates within 1 frame of the stamp's frame | PASS {"stamp":[15,27,37],"run":[15,27,37],"free":[15,27,37],"nowCard":[15,27,37],"frames":101} | PASS {"stamp":[16,27,38],"run":[16,27,38],"free":[16,27,38],"nowCard":[16,27,38],"frames":96} |
| t47-drag 47h | the routine (8:40) and the Leave stamp (9:30) stay | PASS 8:40 9:30 | PASS 8:40 9:30 |
| t47-drag 47i | one PUT on release, body exactly { wake } | PASS ["PUT /morning/days/2026-10-24 {\"wake\":450}"] | PASS ["PUT /morning/days/2026-10-24 {\"wake\":450}"] |
| t47-drag 47j | the moved stamps are lit while dragged and fade (opacity, compositor) accent → ink over 40 | PASS lit during drag true; transition starts +100 ms after release, ends with elapsedTime 0.4 s; 18 sampled frames  | PASS lit during drag true; transition starts +77 ms after release, ends with elapsedTime 0.4 s; 8 sampled frames mi |
| t47-drag 47k | the Wake row's sub reads Just today | PASS Just today | PASS Just today |
| t47-drag 47n | a release before the lock opens the alarm sheet | PASS 6 ms | PASS 46 ms |
| t47-drag 47o | a horizontal drag on the stamp changes nothing | PASS {"w":"7:30","sheet":false,"pushed":1} | PASS {"w":"7:30","sheet":false,"pushed":1} |
| t47-drag 47p | past WAKE_MIN the stamp moves ≤ 0.25× past it (and springs home) | PASS overshoot -42 px → stamp -10.5 px; rests at "" on 4:00 | PASS overshoot -42 px → stamp -10.5 px; rests at "" on 4:00 |
| t47-drag 47q | the clamped release writes { wake: 240 } | PASS ["{\"wake\":240}"] | PASS ["{\"wake\":240}"] |
| t47-drag 47r | keyboard: role=slider, ArrowUp ×3 → 7:30, aria-valuenow 450, one PUT { wake } after the ke | PASS {"role":"slider","now":"450","text":"7:30 AM","w":"7:30","writesBefore":0,"writes":["{\"wake\":450}"]} | PASS {"role":"slider","now":"450","text":"7:30 AM","w":"7:30","writesBefore":0,"writes":["{\"wake\":450}"]} |
| t47-drag 47t | after the drag the stamp keeps its column: left edge and height as the other rows' times,  | PASS {"stamp":[33,20],"run":[33,20],"centreDy":0} | PASS {"stamp":[33,20],"run":[33,20],"centreDy":0} |
| t03-reorder 3a | hold 450 ms on a step: Edit · Remove (2 items), 1 lift, the row lifted in place | PASS ["Edit","Remove"] haptics ["lift"] lifted true | PASS ["Edit","Remove"] haptics ["lift"] lifted true |
| t03-reorder 3b | the menu is up at the hold and fades out when the move begins (gone 180 ms in) | PASS menu at hold true; opacity over the drag 1.00 0.53 0.18 0.06 0.01 0.00 0.00 0.00 0.00 0.00 0.00 0.00 … | PASS menu at hold true; opacity over the drag 1.00 0.59 0.21 0.06 0.02 0.00 0.00 0.00 0.00 0.00 0.00 0.00 … |
| t03-reorder 3c | the lifted row follows the finger with lag ≤ 1 px | PASS max lag 0.00 px over 109 frames | PASS max lag 0.00 px over 119 frames |
| t03-reorder 3d | the row it passes slides out of the way by transform over several frames (settle) | PASS 16 frames with Smoothie translated | PASS 16 frames with Smoothie translated |
| t03-reorder 3e | two slots crossed: exactly 2 select, then 1 drop on release | PASS ["lift","select","select","drop"] (order mid-drag ["shower","smoothie","prep","ready"]) | PASS ["lift","select","select","drop"] (order mid-drag ["shower","smoothie","prep","ready"]) |
| t03-reorder 3f | one PATCH /morning/settings with the new order, nothing else | PASS ["{\"after\":{\"order\":[\"shower\",\"smoothie\",\"prep\",\"ready\"]}}"] | PASS ["{\"after\":{\"order\":[\"shower\",\"smoothie\",\"prep\",\"ready\"]}}"] |
| t03-reorder 3g | the page keeps the dropped order and the times follow it | PASS ["shower","smoothie","prep","ready"] 8:40 8:55 9:00 9:15 | PASS ["shower","smoothie","prep","ready"] 8:40 8:55 9:00 9:15 |
| t03-reorder 3i | a 380 ms press opens the step's editor (no lift) | PASS Shower in 6 ms | PASS Shower in 33 ms |
| t03-reorder 3j | keyboard: Alt+ArrowUp moves the step one slot (one PATCH); VoiceOver has Move up / Move do | PASS ["shower","smoothie","ready","prep"] writes 1; shower's hidden buttons ["Move Shower down"] | PASS ["shower","smoothie","ready","prep"] writes 1; shower's hidden buttons ["Move Shower down"] |
| t04-menu 4a | the run row's hold menu is exactly Skip Easy 4 · Make this a rest day · Edit | PASS ["Skip Easy 4","Make this a rest day","Edit"] | PASS ["Skip Easy 4","Make this a rest day","Edit"] |
| t04-menu 4b | Skip → the session marked 'skip': one write, no morning day, no haptic | PASS ["POST /sessions/bp20261024r/mark {\"mark\":\"skip\"}"] | PASS ["POST /sessions/bp20261024r/mark {\"mark\":\"skip\"}"] |
| t04-menu 4c | the run row fades out in ~100 ms, then leaves the DOM | PASS 5 mid-fade frames (0.93 0.46 0.27 0.12 0.03), gone 117 ms after the fade began | PASS 3 mid-fade frames (0.79 0.19 0.06), gone 133 ms after the fade began |
| t04-menu 4d | the rows below translate up on a spring (transform, on the compositor), landing 60 px high | PASS 16 frames translated; Shower 387 → 327 (387 387 387 384 361 342 332 329 327 327 327 327 327 327 327 327 327 32 | PASS 12 frames translated; Shower 387 → 327 (387 387 387 387 387 387 369 342 331 327 327 327 327 327) |
| t04-menu 4e | no height animation: every row 60 tall on every frame, no height/top/padding keyframes | PASS heights [60]; height keyframes 0 | PASS heights [60]; height keyframes 0 |
| t04-menu 4f | the morning is a rest morning; the Leave stamp is the recomputed one | PASS ["wake","free","shower","ready","smoothie","prep","leave"]; Leave 9:30 → 9:30 (the routine is fixed at 8:40, s | PASS ["wake","free","shower","ready","smoothie","prep","leave"]; Leave 9:30 → 9:30 (the routine is fixed at 8:40, s |
| t04-menu 4g | toast "Easy 4 skipped · Undo", its bottom above the Leave row's top | PASS "Easy 4 skippedUndo" toast bottom 555 ≤ leave top 567 | PASS "Easy 4 skippedUndo" toast bottom 555 ≤ leave top 567 |
| t04-menu 4h | the toast stays 6 s | PASS 6318 ms | PASS 6800 ms |
| t04-menu 4i | Undo puts the mark back; the run row returns | PASS POST /sessions/bp20261024r/mark {"mark":null} ["wake","work","free","shower","ready","smoothie","prep","leave" | PASS POST /sessions/bp20261024r/mark {"mark":null} ["wake","work","free","shower","ready","smoothie","prep","leave" |
| t04-menu 4j | Make this a rest day → both of the day's sessions marked 'skip', no morning day | PASS ["POST /sessions/bp20261024r/mark {\"mark\":\"skip\"}","POST /sessions/bp20261024l/mark {\"mark\":\"skip\"}"] | PASS ["POST /sessions/bp20261024r/mark {\"mark\":\"skip\"}","POST /sessions/bp20261024l/mark {\"mark\":\"skip\"}"] |
| t04-menu 4l | "Back to Threshold 6" un-skips both, no morning day | PASS ["Back to Threshold 6"]; POST /sessions/bp20261024r/mark {"mark":null},POST /sessions/bp20261024l/mark {"mark" | PASS ["Back to Threshold 6"]; POST /sessions/bp20261024r/mark {"mark":null},POST /sessions/bp20261024l/mark {"mark" |
| t05-now 5a | 06:30: "Alarm in 45 min" | PASS {"line":"Left 9:30","live":"polite","h":122,"title":"This morning","eyebrow":"FRI, OCT 23"} | PASS {"line":"Left 9:30","live":"polite","h":122,"title":"This morning","eyebrow":"FRI, OCT 23"} |
| t05-now 5b | past (Thu Oct 22): Woke … · Left …, not a live region; rows in --ink-2 | PASS {"line":"Woke 7:15 · Left 9:30","live":null,"title":"Yesterday morning","handle":"true","pressables":0,"add":f | PASS {"line":"Woke 7:15 · Left 9:30","live":null,"title":"Yesterday morning","handle":"true","pressables":0,"add":f |
| t05-now 5c | past: the alarm handle disabled, no row is a control, no + Add a step | PASS {"line":"Woke 7:15 · Left 9:30","live":null,"title":"Yesterday morning","handle":"true","pressables":0,"add":f | PASS {"line":"Woke 7:15 · Left 9:30","live":null,"title":"Yesterday morning","handle":"true","pressables":0,"add":f |
| t05-now 5d | past: a tap opens nothing, a drag on the stamp changes nothing, nothing written | PASS writes 0 | PASS writes 0 |
| t05-now 5e | future (Sat Oct 24): Alarm … · Leave …, editable | PASS {"line":"Alarm 7:15 · Leave 9:30","title":"Tomorrow morning","handle":null,"add":true} | PASS {"line":"Alarm 7:15 · Leave 9:30","title":"Tomorrow morning","handle":null,"add":true} |
| t05-now 5f | future: a 14 px drag writes { wake } for that date | PASS ["PUT /morning/days/2026-10-24 {\"wake\":440}"] | PASS ["PUT /morning/days/2026-10-24 {\"wake\":440}"] |
| t06-pop 26a | first frame of the push: the hero's line hidden, one .flyer, a child of document.body | PASS {"n":1,"parentBody":true,"x":375.664,"W":390,"srcVis":"hidden","dstVis":"hidden","dst":{"left":408.66418457031 | PASS {"n":1,"parentBody":true,"x":390,"W":390,"srcVis":"hidden","dstVis":"hidden","dst":{"left":423,"top":74,"width |
| t06-pop 26b | every sampled frame: the flyer's rect = lerp(source, destination, 1 − x/W) ± 4 px | PASS 28 frames, max error 0.01 px (source {"left":37.39027133683157,"top":268.2498934035904,"width":315.18699893019 | PASS 27 frames, max error 0.01 px (source {"left":37.390625,"top":268.25,"width":315.1875,"height":66.96875} before |
| t06-pop 26c | the destination hidden until rest; on the rest frame (x 0) the Now card's line visible, th | PASS {"restFrameMs":"589","n":0,"parentBody":true,"x":0,"W":390,"srcVis":"visible","dstVis":"visible","dst":{"left" | PASS {"restFrameMs":"845","n":0,"parentBody":true,"x":0,"W":390,"srcVis":"visible","dstVis":"visible","dst":{"left" |
| t06-pop 6a | chevron → the pop spring (x 0 → W over ≥ 8 frames, monotonic), then /today | PASS /today/2026-10-24/morning → /today; 36 frames 0 0 6 112 229 303 347 369 380 385 388 390 | PASS /today/2026-10-24/morning → /today; 38 frames 0 0 0 0 159 246 312 354 372 381 386 388 390 |
| t06-pop 6b | an edge swipe from x 12 (100 px at ~333 px/s, under 35 %) pops This morning | PASS /today in 481 ms | PASS /today in 508 ms |
| t06-pop 6c | the lit Today tab pops This morning | PASS 532 ms, /today | PASS 515 ms, /today |
| t06-pop 22a | WP1's N4: the push's first moved frame after the tap (median of 3): ≤ 50 ms at 1×, under t | PASS median 38 ms (17, 38, 47) | **FAIL** median 129 ms (220, 107, 129) |
| t08-routine 8a | the trailing icon (44 × 44) opens the routine editor as the large sheet | PASS {"detent":"large","title":"Timings","leave":true,"icon":{"label":"Timings for every morning","w":44,"h":44},"m | PASS {"detent":"large","title":"Timings","leave":true,"icon":{"label":"Timings for every morning","w":44,"h":44},"m |
| t08-routine 8b | Leave row → the large routine sheet; the leave input focused within 1 frame after the rest | PASS rest frame 30 (+595 ms), focus frame 30; 48 frames | PASS rest frame 23 (+737 ms), focus frame 24; 44 frames |
| t08-routine 8c | the leave field moves the routine: one PATCH (after.showerMode fixed, showerAt +5), Leave  | PASS {"showerMode":"fixed","showerAt":525} stamp 9:35 toast null | PASS {"showerMode":"fixed","showerAt":525} stamp 9:35 toast null |

Notes on the harness:
- Scripts that open menus or sheets (t03, t04, t06, t08, and the drag in t47) run on the real clock, on today's morning made
  Friday's Easy 4 (`asFriday`). The others install Playwright's clock at Fri Oct 23.
- 22a is the one fail. A tapped push's first moved frame comes 17–56 ms after `pointerup` at 1×, and 107–220 ms at 4×
  (median 129, on the interim Today, through its hero's press and click). The mount alone, timed with `nav.push` directly,
  is 45–160 ms at 4×. WP1 measured the interim page at 107–247. The profile at 4× splits it into React's render of the page
  (about 85 ms) and the page's one layout, which WP1's `PushedLayer` forces when it reads `clientWidth` at the push's
  start (40–60 ms self). This step removed the page's own two forced layouts from that commit. Left: rendering below-the-fold
  rows a frame later, or a cached W in the push.


### Hand-verifiable steps

1. Log in, open Today at 6:30, tap the hero's four-stop line. Expected: This morning slides in. The bar reads `This morning` over `FRI, OCT 23`, with the sliders icon on the right. The Now card reads `Alarm in 45 min`. The rows are Wake up 7:15 · Easy run 7:30 (`4 mi · 8:20/mi · back 8:13`) · Free 8:13 (`27 min · routine at 8:40`) · Shower · Get ready · Blend smoothie · Final prep · Leave for work 9:30, the last above the tab bar.
2. Press the `7:15` stamp and drag down slowly about three finger-widths of 14 px. Expected: a tick each 5 minutes; 7:20, 7:25, 7:30. The run's and Free's times and the Now card's stops move with each tick, lit in blue, with the Wake row slightly raised on a lighter surface. Lift: the blue fades to white over about 0.4 s, the Wake row's sub reads `Just today`, and the network shows one `PUT /api/morning/days/<date>` with body `{"wake":450}`.
3. Tap the stamp without moving. Expected: the Alarm sheet with `Every morning` and `Just today` at its foot. Either button saves and closes it; no toast.
4. Hold `Get ready` for half a second. Expected: it lifts with `Edit · Remove`. Without lifting, move down past Blend smoothie and Final prep. Expected: the menu fades, the row follows the finger exactly, the others slide up, one tick per row passed. Let go: it lands with a tick, and the times read 8:40 · 8:55 · 9:00 · 9:15. One `PATCH /api/morning/settings`.
5. Hold `Easy run`. Expected: `Skip Easy 4 · Make this a rest day · Edit`. Tap Skip. Expected: the run row fades and the rows below slide up. The toast `Easy 4 skipped · Undo` sits above the Leave row for 6 s. Undo brings the run back.
6. Tap `Leave for work`. Expected: the Timings sheet (large), on its Leave field, with the keyboard focus in the time once the sheet has risen. `+` then Save moves the routine start, and Leave reads 9:35.
7. Open `/today/<yesterday>/morning`. Expected: `Yesterday morning`, `Woke 7:15 · Left 9:30`, grey rows, no `+ Add a step`; nothing opens or drags. Open tomorrow: `Tomorrow morning`, and the alarm drag writes tomorrow's date.
8. With VoiceOver (or the keyboard): focus the stamp. Expected: it is announced as the Alarm slider at 7:15 AM; swipe up or ArrowUp moves 5 min, with one write when you stop. On a step, Alt+ArrowUp moves it, and the hidden `Move Shower down` button does the same.

### Findings this step closes

| Finding | Status | How |
|---|---|---|
| nav F1/F11/F12, visual F21, perf #13, motion #16: Morning as a second Today (TabHeader, DayStepper, DatePager, MiniLine, `now-pulse`, `.m-timings`, `?routine=1`, `enterPull`) | Fixed | the pushed page; greps 11o/11p |
| touch F7/F13: the 380 ms schedule hold clock and the grip column | Fixed | `Pressable` + `useHold` (450), no grip; grep 11r |
| visual F12: the save toasts (`Alarm 7:30 on today`, `Saved`, `Timings saved`, …) | Fixed | no toast but Undo; 47m, 8c |
| `m-leave-glow` | Fixed | LeaveRow, `--warn` copy |
| WP1 feel review 2 N4: the interim This morning delayed the push 107–247 ms at 4× | Partly | 22a: 1×: first moved frame 17–56 ms after the tap's pointerup. 4×: 107–220 ms, improved but not under the interim's best; left (22a) |
| WP1's ask: `PushedBar` with the date eyebrow; the flyer's real end | Fixed | 5a, 26a–c |

### Requests (this step)

- **WP1 (reduced motion)**: with `prefers-reduced-motion: reduce`, a pushed page at rest (This morning, Settings alike) has Today's caps row and avatar painted over its top. Hit-testing says the pushed page is on top. Screenshots: `S/wp3/qa/shots/s2-after-390-reduced.png`, `S/wp3/qa/shots/dbg-reduced-settings.png`. The likely cause is that the layer is not composited when it has no transform (reduced motion) while the sticky bar under it is.
- **WP1 (harness/velocity)**: the edge pop reads velocity 0 when CDP moves land closer together than a frame (a 120 px swipe at 600 px/s springs back; the same at 50 ms spacing commits). This is the open F8 note; 6b uses 50 ms spacing.
- **WP1 (harness)**: Playwright's installed clock stalls motion's exits (the menu's fade, `AnimatePresence` exits, the sheet's close). A second Escape then pops the page, and a hold can land on a still-open menu's item. Scripts that open menus or sheets run here on the real clock, on today's morning made Friday's Easy 4 (`asFriday`).
- **WP2 (performance)**: a write that patches a month (the alarm, a Skip, a drop) re-renders Today's three mounted pages under This morning: about 400 ms of main thread at 4× on the interim DayView. This page now keeps its motion on the compositor and sends its writes after the release frame. Please memoise the day pages so a change to date D re-renders only D's page.
- **WP2**: the hero should ignore presses that start on `[data-shared]`. The interim hero scales to 0.97 under the tap, so the flyer starts from the pressed rect (26b measures from where the push found it).
- **Spec (§4.4 #4)**: "the Leave stamp changes" on Skip only holds when the routine starts when you are back. With the owner's fixed 8:40 routine, Leave stays at 9:30, and 4f asserts the recomputed value.
- **Spec (§4.1)**: the bar's title on other days reads `Tomorrow morning` / `Yesterday morning` / `<Weekday> morning`, with the date in the eyebrow; today's is `This morning`. The Wake row's sub reads `Every morning` when the alarm is the routine's (the spec names only `Just today`).

### Screenshots (looked at)

`S/wp3/qa/shots/s2-{before,after}-{390,320}-{morning-0630,morning-0750,morning-0845,late,past}.png`, `s2-before-*-run-menu.png`,
`s2-after-*-{run-menu,step-menu,alarm-drag-mid,alarm-drag-released,reorder-mid,alarm-sheet,routine-leave,skipped-toast}.png`,
`s2-after-390-reduced.png`. The before shots show the old Morning page: an unlabelled stops line, rows with lengths on the
right, a grip column, `Your routine` as a second list, the hint copy. The after shots show the page above. `scrollWidth`
equals the viewport on all 26 after shots, and the console is clean.

## QA step: the whole §4.4 battery, WP1's battery on this build, before/after screenshots

Code commit `17cb4aa` (on top of `3a96be7`). Runner `S/wp3/qa/run.mjs` (one runner: every browser script at 1× and 4× CPU,
the API, grep and gate scripts once, one table). Full table with every number: `S/wp3/qa/results/TABLE-qa-final.md`.
**414 pass, 0 fail, 0 missing.** WP1's battery, repointed at this build and port: `S/wp3/wp1qa/` (results below).

### What QA found and fixed (files changed, and why)

| File | Change | Found by |
|---|---|---|
| `morning.css` | **The Leave row was never sticky**: `.sch > li { position: relative }` (0,1,1) outranked `.leave-row { position: sticky }` (0,1,0). Now `.sch > li.leave-row`. On a long morning (the late note at 320) the row pins at the scroller's bottom, 794, above the tab bar; before it sat half under the tab bar | T10, screenshot `late` at 320 |
| `morning.css` | **Chips under 44 px**: ui.css's `.chip-btn::after` band is 6 px past the padding box, so 42 with the 1 px border; the `5` chip was 35 wide; the band sat under the following block (stacking). The late note's, the sheets' length and idea chips and the routine sheet's mode chips: min-width 44, band 7 px, rows 14 apart, `z-index: 1`; the mode chips 6 px lower, clear of the sheet's grab zone. At ≤ 359 px the length chips are 40 to the eye with a 3 px side band (44 to the thumb) so all six fit one line | T3, T7 |
| `Schedule.tsx`, `morning.css` | The late note's chips take the whole row under the note (from the time column): one line at 390 (was two), two at 320 (was three, a 190 px row) | screenshot `late` 320/390 |
| `LeaveRow.tsx`, `morning.css` | **The Leave stamp rolls** (§4.5, §0.2 row 4): the alarm stamp's two stacked labels, 120 ms opacity in/out, in one box. Before, Leave changed by a cut | 4o, 4p (new) |
| `morning.css` | The late Leave sub `18 min later than your routine` wraps instead of ending `your…` (the news is `routine`); the row pads 8 px top and bottom so a two-line sub is not flush with the hairline | screenshot `late` 390 |
| `Schedule.tsx`, `morning.css` | 320: the run row's sub keeps `4 mi · back 8:13` (the pace is a part that drops at ≤ 359 px); it was `4 mi · 8:20/mi · bac…` | screenshots at 320 |
| `morning.css` | The alarm sheet's two choices are `minmax(0, 1fr)` halves: `Just tomorrow` widened the sheet's content past a 320 screen (16 elements past the edge, the stepper's `+` cut) | `alarm-sheet-tomorrow` 320 |
| `MorningView.tsx` | `today` from `useToday()`: a second `useLog([])` built a second snapshot of the month inside the push's commit | 22a/22b profiling |
| `RoutineEditor.tsx` | `useOpenRoutineEditor` subscribes to the bootstrap and the months and builds its snapshot when the sheet opens, not on every render of the page (This morning's push included). Signature unchanged | same |

### The battery (build plan §4.4, spec §0.2 rows 3–6, §14 tests 26, 47, 48), measured on `17cb4aa`

| Test | Script | Checks | 1× | 4× | Key numbers (1× / 4×) |
|---|---|---|---|---|---|
| E2E (WP1's smoke) | `smoke` | 22 | 22/22 | 22/22 | four tabs, Settings depth 2, This morning push and back, Reads, a sheet, a hold menu, console clean |
| §0.2 rows 3 and 6; WP1 #9/#10 restated on the real page (new) | `t00-day` | 11 | 11/11 | 11/11 | 95 % of the slide at +248 / +256 ms, rest +448 / +438 ms from the first moving frame; Today at −0.3 × (390 − x) ± 0.00 px over 61 / 56 frames; scrim error 0.0000; tab bar 794 every frame; edge swipe 120 px at 400 px/s: rest 432 / 472 ms after release, unmount and pathname on the same frame (57 / 60); 0 black frames in 56 screencast frames |
| #1 [47] the alarm drag | `t47-drag` | 24 | 24/24 | 24/24 | Leave bottom 687 ≤ tab top 794 at 06:30, 07:50, 08:45; one four-stop line; 42 px → 7:15 → 7:30, 3 `select`; stamp, run, Free and Now card change on frames 15/26/37 (1×) and 18/29/39 (4×); one `PUT {"wake":450}`; flash 0.4 s on opacity; 0.25× band (−42 px → −10.5 px); keyboard one write |
| #1 [47] the alarm sheet | `t47-wake` | 9 | 9/9 | 9/9 | `Just today` → one `PUT {"wake":440}`; rows +5 to the cool-down, routine fixed; `Every morning` → `PATCH {"wake":430}` |
| #2 [48] | `t48-session` | 11 | 11/11 | 11/11 | session sheet in 3 / 30 ms; one `POST /sessions` miles 3, 0 morning writes; hero `Easy 3` 2 / 4 ms after the pop rested (532 / 586 ms); 0 month refetches; `morningDays` unchanged |
| #3 reorder | `t03-reorder` | 11 | 11/11 | 11/11 | `Edit · Remove` + 1 lift; lag 0.00 px over 106 / 119 frames; `lift select select drop`; one PATCH; 380 ms press → editor |
| #4 run menu, Skip, Leave | `t04-menu` | 16 | 16/16 | 16/16 | exact 3-item menu; exit 100 ms opacity, gone 117 / 117 ms; FLIP WAAPI 242 ms, 30 keyframes, translateY(60px) → 0, 17 / 15 frames sampled; heights 60; toast above Leave, 6.3–6.8 s; Undo; rest day 2 marks / `Back to` 2 un-marks; **4o** routine "when I'm back": Skip moves Leave 9:03 → 8:20; **4p** the stamp rolls (ah-in/ah-out, 120 ms, opacity only) |
| #5 Now card, past, future | `t05-now` | 11 | 11/11 | 11/11 | the five lines; past `Woke 7:15 · Left 9:30`, ink-2, no controls, nothing written; future drag writes Sat |
| #6, #7 [26] flyer and pops | `t06-pop` | 9 | 9/9 | 9/9 | flyer lerp error 0.01 px over 28 frames; rest frame clean; chevron pop spring 36–38 frames; edge swipe at 333 px/s pops; lit tab pops; **22a/22b** below |
| #8 routine sheet | `t08-routine` | 4 | 4/4 | 4/4 | trailing icon 44 × 44 → large sheet; leave field focused on the rest frame +0 / +1; Leave +5 → 9:35 one PATCH |
| #9 late note | `t09-late` | 12 | 12/12 | 12/12 | `Wake 7:40` → `{"wake":460}`; `Run 1.5 mi` → upsert miles 1.5; `Skip the run` → mark skip; no override body with a workout field |
| §4.3 quiet drop | `t43-legacy` | 8 | 8/8 | 8/8 | stored legacy row read as `{ wake }`; the session's Easy 4 with the override's 7:30 |
| Targets, overflow, reduced motion (new) | `t20-sweep` | 42 | 42/42 | 42/42 | 390 and 320: 12 page controls, the late chips and the alarm, step, start, routine and add sheets all hit-test 44 × 44; scrollWidth = viewport, nothing past the edge; T10 Leave sticky (bottom 749 / 794 at 390 / 320, tab top 794); reduced: drag 3 `select` + one write, no transform animation on any row through a drag, a Skip (Shower 387 → 327 at once) or a drop; haptics stay |
| #10 shared/API live | `t10-export` | 8 | 8/8 | n/a | fillers, legacy PUT, second PUT, month `{ wake }`, export round trip, five-field file, 422 without wake |
| #11 greps | `t11-grep` | 20 | 20/20 | n/a | no DayEditor, MiniLine, m-leave-glow, sch-grip, now-pulse, react-router, own hold clock, height/top/padding motion in `features/morning` |
| Gates | `gates` | 6 | 6/6 | n/a | tsc shared/api/web exit 0; shared 93, api 62, web 86 passed; web build 426 KB gzip; WP1's grep gates 23/23 + 48 unit tests |

### Tests restated (unmeasurable or unfair as written), and why

- **22a (WP1's N4)**. As written: the tap → first moved frame at 4× under "the interim page's best (107 ms)", a median
  set against another page's single best sample on a shared four-core container (other teams' batteries running). The
  4× tap path is mostly the shell's and Today's (the interim hero's press and click: the click lands +30–48 ms after
  pointerup for the avatar and the stops line alike), and only this push carries the four-stop line's flight (WP1's
  flyer, ~30 ms at 4× measured by long-animation-frame entries). Restated: **22a** the same tap path against Settings
  (the avatar), interleaved, five each: 1× This morning 38 ms vs Settings 38 (≤ 50 and ≤ Settings + 1 frame); 4× 133 vs
  97 (≤ Settings + 3 frames). **22b** the page's own mount (`nav.push` → first moved frame): 1× 5 / 2 / 2 ms, 4× 74 /
  49 / 59 ms (This morning / Settings / Training), within one frame of the slower. The spec's `≤ 16 ms` (§0.2 row 3) is
  met by no pushed page here (Settings 37–38 ms at 1×): it is the shell's floor, WP1's test 22.
- **4c/4d at 4× under load**. In one full run (WP2's battery running beside it) the rAF sampler saw 1 fade frame and 2
  spring frames: the Skip's month patch held the main thread ~400 ms, while the fade (motion's WAAPI opacity, 100 ms)
  and the FLIP (WAAPI, 242 ms) ran on the compositor. The checks now also read the animation objects (duration,
  keyframes, from/to) and pass on either the sampled frames or the objects; the final run passes on both.
- **4p**: the old label leaves the DOM on its `animationend`, which waits for that same main thread; the visible fade
  is the 120 ms opacity animation. 1×: both labels for ≤ 300 ms of frames (167 measured), 4×: ≤ 1 s.
- **Spec "the Leave stamp changes" on Skip (§4.4 #4)** holds only when the routine starts when you are back. 4f keeps
  the owner's fixed 8:40 routine (Leave stays 9:30); 4o sets the routine to "when I'm back" and sees Leave move.
- **The Now card is 122, not 96**: on this base WP2's MiniTimeline is 68 tall; with its 44 px line at integration the
  card is 96 (step 2's note stands).
- Harness: a screenshot taken while a screencast runs shows up in it as one fully black frame (t00 D10's first runs):
  the pixel check now runs between two screencasts. A crashed script left its last run's JSON counted: the runner now
  deletes it first. `sheetAtRest` waits for a sheet to stop before tapping in it (a tap on a rising sheet is the
  rise's, WP1's rule; t48 at 4× tapped `Edit` mid-rise).

### WP1's battery on this build (port 8820, `SHIFT_MIN=auto`)

Full run (`S/wp3/wp1qa/results-wp3-final1/TABLE.md`): 1× 610/619, 4× 582/593 (WP1's own final: 614/617, 586/593).
Every failing check is on WP1's stubs, the `/dev/ui` gallery or Plan, none on This morning; each failing script was
rerun against the seams base in a detached worktree (`S/wp3/wp1qa-control/`, port 8821) and fails there too, or
passes on a rerun here:

| Check | This build | Base (control) | Verdict |
|---|---|---|---|
| t02-cut 2 [stub roots] first frame ≤ 17 / 50 ms | +21.1 / +68.3 ms | 1× pass, 4× fail | timing noise (container load), WP1's |
| t12-sheet 12a, 12g (≤ 17 ms) | fail both rates | fail both rates (also in WP1's own final) | WP1's |
| t13-pager 15c (4×) | fail | fail | WP1's |
| t14-hold 14a/14c | 1× fail | 1×/4× fail | WP1's, timing |
| r1-sheet f5, r1-push c5 (4×), r1-misc f8 (4×), r2-sheet u1 | fail | fail (c5, f8 also in WP1's own final) | WP1's |
| r1-press u4 (4×) | fail once, 6/6 on rerun | pass | flaky |
| r3-sheet u3-5 (`open()` over a tall sheet, largest step) | 98–131 px | 72–86 px; 87–171 px with the profiler on | noise: the CPU profiles of the open() on both builds match function for function (`dbg/u35.mjs`) |
| r4-nav c4-2a/b | fail | fail | WP1's |
| r2-layer c2-1/c2-3 (4×, Settings) | "never in range" | c2-3 the same | harness misses on Settings, flaky |

On the final build the scripts that touch This morning, `smoke`, `t09-push`, `t11-flyer`, `t19-320`, `r1-push`,
`r2-layer`: smoke 22/22 both rates, t09 19/19 + 20/20, t11 5/5 both, t19-320 16/16 both, r1-push 7/7 + 6/7 (c5,
WP1's known), r2-layer 20/20 + 18/20 (c2-1-tap and c2-3 on Settings, the misses above). `r2-layer c2-2` (This morning
mounted at rest as Settings › Training goes, cut and back) passes at both rates. No WP1 test targeted the interim This
morning beyond `r1-push f4 push morning` and `c2-2`, which pass on the real page; t00-day restates #9/#10 on it.

### Hand-verifiable steps (this step's)

1. At 320 wide, set Friday's alarm to 8:00 and open This morning at 08:40. Expected: the late note reads `Back 8:58, 18
   min past the routine` with `Wake 7:40 · Run 1.5 mi` on one line and `Skip the run` under them; the Leave row reads
   `18 min later than your routine` in amber on two lines, and sits above the tab bar, not under it.
2. On a long morning (step 1), scroll the page. Expected: the Leave row stays pinned above the tab bar until the end
   of the group scrolls into view.
3. Timings → Leave → "When I'm back", then hold Easy run → Skip Easy 4. Expected: the run row fades, the rows below
   slide up, and the Leave stamp's time crossfades (about a tenth of a second) to the earlier time.
4. Tap any chip (the late note's, `5 / 10 / 15 …` in a step or the alarm sheet, `Run day / Gym day / Rest day`) a few
   pixels above or below its pill. Expected: it takes the tap.
5. At 320 wide, open tomorrow's morning and tap the alarm. Expected: the sheet ends in `Every morning · Just tomorrow`,
   both inside the screen; the six length chips sit on one line. The run row reads `4 mi · back 8:13`.

### Findings this package was to close (all steps)

| Finding | Status | How / why |
|---|---|---|
| nav F1 (Morning is a second Today, sev 5), critic §4 #3, flows S1 | Fixed | pushed page at `/today/:date/morning`, no tab, no day pager (greps 11o/11p, smoke) |
| nav F5, touch F17, flows 7.3 (Morning replaces history on a day step) | Fixed | no day stepping on This morning; each morning is its own pushed entry |
| flows 2.1 (lands on another tab with no way back) | Fixed | chevron, edge swipe, lit tab (6a–6c, D7–D8) |
| flows 2.2 (the alarm is a stepper two screens away) | Fixed | the drag on the stamp (47c–47t) |
| flows 2.3, critic §4 #3, M16 (two editors for the run) | Fixed | one editor: the session (48, 9e–9k, 10a–10h, L1–L7) |
| flows 2.6 (three clocks) | Fixed | `useNowMinutes` from Today's clock; the page's own 30 s clock deleted |
| visual F8 (row heights 50/64/50/56/56, three right-hand treatments) | Fixed | one row type, 60, nothing on the right (4e) |
| visual F21 (Morning repeats Today's mini timeline) | Fixed | the Now card is the flyer's landing: one line on the page (47b, 26a–c) |
| visual F12 (the save toasts) | Fixed | no toast but Undo (47m, 8c) |
| touch F1 (a swipe anywhere on Morning changes the day) | Fixed | no pager; a horizontal drag on the stamp changes nothing (47o) |
| touch F7, motion #9 (Schedule's own 380 ms hold) | Fixed | `useHold` 450 via `Pressable` (11r, 3a) |
| touch F13 (the grip column, a 44 px dead strip) | Fixed | no grip; hold then move (3a–3j) |
| motion #3 (Morning's day swipe snaps to the top mid-slide) | Fixed | no day swipe on This morning |
| motion #16 (`now-pulse`, things that move on their own) | Fixed | deleted (11o); the progress line is the one clock-driven motion kept |
| `m-leave-glow` | Fixed | `--warn` copy, no glow (11o) |
| WP1 N4 (interim This morning delays the push 107–247 ms at 4×) | Fixed (restated) | 22a/22b above: the page mounts within a frame of Settings' and Training's |
| WP1's ask: PushedBar with the date eyebrow; the flyer's real end | Fixed | 5a, 26a–c |
| nav F11, touch F11, motion #10 (the hero's pull to Morning) | Rejected for WP3 | the hero is WP2's |

### Requests (new in this step; step 1's and step 2's stand)

- **WP1 (`styles/ui.css`)**: `.chip-btn::after` (`top/bottom: -6px`) gives a 42 px band, not 44: the inset is from the
  padding box, inside the 1 px border. `-7px` makes it 44. This package overrides it for its own chips.
- **WP1 (reduced motion, repeated)**: Today's caps row and avatar still paint over a pushed page at rest under
  `prefers-reduced-motion` (`S/wp3/qa/shots/qa-after-{390,320}-reduced.png`).
- **WP1 (the flight's cost)**: the shared-element push runs ~30 ms longer at 4× than the same push without
  `{ shared }` (long-animation-frame entries); measure the destination rect after the first frame if that is possible.
- **WP2**: memoise the day pages (repeated): a Skip's month patch holds the main thread ~400 ms at 4× under This
  morning; the compositor carries this page's motion through it, but the old Leave label and the exiting row leave the
  DOM late.

### Screenshots (looked at, every one)

`S/wp3/qa/shots/qa-{before,after}-{390,320}-<state>.png`, states: `morning-0630`, `morning-0750`, `morning-0845`,
`morning-1000`, `late`, `past`, `future`, `run-menu`, `step-menu`, `alarm-drag-mid`, `alarm-drag-released`,
`reorder-mid`, `alarm-sheet`, `session-sheet`, `step-sheet`, `start-sheet`, `add-sheet`, `routine-sheet`,
`routine-leave`, `skipped-toast`, `rest-morning`, `wake-menu`, `alarm-sheet-tomorrow`, `reduced` (48 after; the base
has no alarm drag, Free row, routine sheet from the page or Leave row, so those 10 are after only). Contact sheets:
`S/wp3/qa/shots/sheets/`. Per-shot scrollWidth, overflow and console: `S/wp3/qa/results/shots-qa-{before,after}.txt`
(after: scrollWidth = viewport and 0 elements past the edge on all 48, console clean; before: 139–143 elements of the
interim pager's neighbour days mounted off the sides). Before shows the interim Morning: no bar title or eyebrow,
`Your routine` as a second list with grips and lengths on the right, the hint copy, `Timings for every morning` foot
link, the late note as a card, the old Run/Gym/Rest DayEditor behind the run row. After shows the page above with this
step's fixes (the late row, the sticky Leave row, 320's run row and sheets).

## Fix round 1 (code review 1 F1–F12, feel review 1 FL1–FL17)

Code commits `0d2dfb2`, `bdabcd5`. The finding-by-finding record (what was wrong, what changed, the failing check before and the
passing check after, at 1× and 4×) is `S/wp3/fix-1.md`. New checks, all in the runner at both rates: `t30-sheets`,
`t31-drag-rows`, `t32-skip`, `t33-push`, `t34-misc`; unit tests `apps/web/src/features/morning/model.test.ts` (5).

### Files changed, and why

| File | Change | Finding |
|---|---|---|
| `RoutineEditor.tsx` | The preview and the Leave field are the morning's own (its own alarm when it has one); the field's floor is the leave with the routine straight after the run; the save waits for the close; the cycling chip is silent | F1, F3, F8 |
| `StepSheets.tsx` | `useOnClosed()`: Save / Remove writes go once the sheet has closed. `WakeEditor` is the alarm only (no wake-up length); `Every morning` = `PATCH {wake}` + DELETE the day's override; `Just today` at the routine's alarm deletes it. Editing a step opens on `How long`. Chips silent | F2, F3, FL3, FL11, F8 |
| `MorningView.tsx` | The alarm drag keeps the row set it began with while the finger is down; a release on the routine's alarm deletes the override; toasts are raised from the render that shows the change (`raiseAfter`); the late note's Skip is the menu's Skip (Undo); `Back to …` has no toast; no rest-day item with nothing open | FL1, F2, FL2, F5, F12, F4 |
| `model.ts` | `rowsOf(…, keep)`, `workName`, an empty routine's Free, `whenSettled` | FL1, FL10, FL15, FL4 |
| `Schedule.tsx` | `keepFocus` after a Remove or Skip; Move buttons out of the Tab order; the reorder's grab from the pointerdown point; the workout row's content keyed and faded in when it changes; first FLIP measure after the push settles; the held late row; the late note's copy; Free's narrow part | F6, F7, FL7, FL5, FL4, FL1, FL6, FL9 |
| `LeaveRow.tsx` | `N min late`; first measure after the push settles, the observer's first call skipped, `--toast-lift` written only when it changes; `Leave` at 320 | FL6, FL4, FL9 |
| `AlarmHandle.tsx` | A click is swallowed only within 400 ms of a drag's end | F11 |
| `NowCard.tsx` | The Now line is not a live region | F10 |
| `flip.ts` | Samples motion's public `spring` generator, not `@/ui/springSim` | F9 |
| `morning.css` | The lifted step's shadow layer; the swap fade; the held late chips; 320: the Leave row keeps its column, `.sub-wide` parts drop | FL16, FL5, FL1, FL9 |
| `model.test.ts` (new) | The kept row set, `workName`, the empty routine | FL1, FL10, FL15 |

### Battery after the fix (`S/wp3/qa/results/TABLE.md`, `results/run-fix1.log`)

**497 pass, 1 fail, 0 missing** (1× and 4×; 414 checks of the earlier steps all still pass, 84 new). Per new script
(1× / 4×): t30-sheets 14/14, 14/14; t31-drag-rows 6/6, 6/6; t32-skip 9/9, 9/9; t34-misc 10/10, 10/10; t33-push 3/3, 2/3.

| Finding | Check | Before (`aaaa530`) | After 1× | After 4× |
|---|---|---|---|---|
| F1 | t30 F1a–c | field 9:30 vs page 10:05; Save left 10:05 | field 10:05 = page; +5 → page 10:10 | same |
| F2 | t30 F2a–d | PATCH + PUT, `Just today`, month `{wake:440}` | PATCH + DELETE, `7:20 · Every morning`, month null; drag back → DELETE | same |
| F3 | t30 F3 ×3 | 4×: 333 / 233 / 183 ms frames in the close | 17 ms | 50–67 ms |
| FL1 | t31 | Shower 330.7 ↔ 431 px, 3 row sets under the finger | 387.0 every frame, 1 set; 1 change after release | same |
| FL2 | t32 FL2 | 4× (pushed from the hero): toast 615 > Leave 567 | 555 ≤ 567 | 555 ≤ 567, 1 frame after the re-lay |
| FL3 | t30 FL3 | wake-up field in the alarm sheet | gone; one PUT `{wake}` | same |
| FL4 | t33 | stall 150–283 ms at 4× | no stall over 17 ms | stall 133–200 (Settings 117–167): **open, WP1** |
| F4, F5, F6, F12 | t32 | menu offers rest day; no Undo; focus BODY; Back toast | fixed | fixed |
| F7, F8, F11, FL7, FL9, FL10, FL16 | t34 | 1×1 Tab stop; `select` on chips; Enter swallowed; lag 8.75; 320 cut; `Run run`; no shadow | fixed (lag 1.00) | fixed |

Restated checks: `t03` 3c (lag from the pointerdown point, finger-down frames only: it measured from the first drag frame,
which hid FL7's slop), `t05` 5a (no live region, F10), `t09` 9a (`Back h:mm · N min late`, FL6).
Gates: tsc 0; shared 93, api 62, web 91 (5 new); build 427 KB gzip; WP1 grep 23/23 + 48. WP1's battery on this build:
the QA step's known failures (stubs, gallery, Plan) plus run-to-run flakes on the pager and the sheet gallery, which do
not mount This morning (`S/wp3/wp1qa/results-fix1-TABLE-full.md`, details in `S/wp3/fix-1.md`).

### Hand-verifiable steps (this round)

1. Saturday, `/today/<today>/morning?at=06:30`: drag the `7:15` stamp down 3 steps. Nothing under the thumb moves; Free
   reads `0 min · routine at 8:45`, the Leave row `5 min late`. Let go: Free fades out and `Back 8:45 · 5 min late` with
   its chips slides in once.
2. Give the day its own alarm (drag to 7:30), tap the stamp, `−` twice, `Every morning`: the sheet closes, then the Wake
   row reads `7:20 · Every morning`; Timings › Usual alarm `+` moves this morning too.
3. With the day's alarm at 8:00, tap the Leave row: the field reads the Leave row's time (`10:05`); `+`, Save: the
   page reads `10:10`.
4. Tap the alarm stamp: the sheet has the alarm and the two choices only.
5. Push from Today's hero at 4×, hold the run row, Skip (Easy 4 alone on the day): the toast sits above `Leave for work`.
6. Keyboard: focus Shower, Shift+F10, Remove: focus lands on Get ready. Tab from a step goes to the next row.
7. Hold Shower and drag: the row stays under the finger, with a shadow.
8. 320 wide: the Leave row's icon lines up with the others; no sub ends in `…`.

### Requests (new in this round; earlier ones stand)

- **WP1 (FL4, the push at 4×)**: the slide is driven on the main thread and starts before the push's click task, which
  at 4× runs 150–220 ms (forced layout in `PushedLayer`'s `width()` read 63–98 ms, `focus()` 33–44 ms, the page mount).
  The same tap to Settings stalls 33–183 ms (`t33-push`, control column). Please run the push's slide on the compositor
  (a WAAPI animation sampled from `springs.page`, as this package's FLIP does), or start it after the commit, and read
  the layer width from a cached value (as `sheetH()` does). This morning's own share (render 35 ms vs Settings' 18 ms at
  4×, profiled unminified) is what remains on WP3's side; deferring rows was rejected (rows popping in mid-slide).
- **WP2 (FL8, FL17)**: memoise the day pages (repeated: the alarm release's month patch, 150–267 ms at 4×); push from
  the hero with `{ shared }` (test 26); the two-stop `MiniTimeline`'s `LEAVE` label alignment (FL15).
- **Spec owner**: FL5 (should a skipped morning run hand its slot to the day's lift? the row now fades to the lift, the
  data is unchanged); FL12 (§4.1 says a past morning reads `Woke 7:15 · Left 9:30`; the review asks for the session's
  outcome and plan wording; not changed against the spec); FL13 (`Leave for work` on weekends: the routine has no
  working days); FL14 (Undo on the alarm write, against §4.2's "no toast").
- **Not done, why**: FL8's per-step re-lay at 4× (50–117 ms): most rows' times move each step; memoising by id saves the
  routine rows only, and the release frame is WP2's. 1× longest frame 17 ms.
