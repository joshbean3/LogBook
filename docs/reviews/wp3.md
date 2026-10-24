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
