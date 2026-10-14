# Progress (was Trends): review notes

Team: Progress. Spec: `docs/experience.md` §5.4. Audit: `docs/research/audit.md` §2.6 and fix 14. Research: `docs/research/consumer-research.md` §2.1 Trends, §3 (scrub, pinch).

Screenshots live under `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/progress/` (`before/`, `after/`). The Playwright scripts that made them are in the same folder (`verify.mjs`, `shots.mjs`, `asof.mjs`, `newacct.mjs`, `tap.mjs`, helpers in `lib.mjs`).

## What the page is now, top to bottom

1. `TabHeader` "Progress" (date line, avatar).
2. **Verdict** in serif 28, two short sentences from the log: the trend over finished weeks ("Three weeks building.", "Two quiet weeks.", "Last week was your biggest in six weeks.", "Four weeks kept in a row.", "Steady at about 15 mi a week.") then this week against the **same weekday last week** ("This one is ahead of last week.", "This one is light so far.", "This one starts today."). Never a zero.
3. **Sub**: the week's miles against the plan in words and a number ("8.2 of 26 mi planned. Two runs in." / "26 mi planned. Next: Easy 4, Friday." / "26 mi planned. First run today: Easy 5.").
4. **Range chips** 3M · 6M · 1Y (remembered per device in `localStorage` `logbook.progress.range`). They drive every section below. A range longer than the log starts where the log does (never under 13 weeks) and the label says "Since Aug 10" instead of drawing empty weeks.
5. **The hero card**: a context label ("Last 3 months"), three headline numbers (Avg week · Best week · Total, as `Ticker`s), and the **mileage chart** (220px): white run bars, outlined plan bars (dashed for the two weeks ahead), a 4-week average line, this week in blue, NOW under it, month names on the axis, and the series named on the chart itself (RUN, PLAN, 4-WK AVG, each placed where it covers no bar). No legend row.
6. **Drill-downs**, an edge-to-edge list, each row a title, one line of words, a sparkline and one number; each opens a sheet:
   - **Plan adherence**: sessions kept vs planned in the current block (or every planned session in the range when there is no block). Sheet: Kept / Block week stamps, the block summary, what "kept" means, and one row per week with its `WeekRing`, "1 of 4 kept · 2 ahead" and a meter; a week row pushes that week's sheet.
   - **Long run**: the longest run of the last 4 weeks, "Down from 8.0 in August". Sheet: a scrubbable line of each week's longest run, then the long runs; each opens its run.
   - **Easy pace**: median easy pace now, "8 s faster than August · 149 bpm". Sheet: a scrubbable line of every easy run (faster is higher), the rule used to pick easy runs, the runs with pace and HR.
   - **Lifts**: the latest lift's e1RM and its change. Sheet: each lift (sparkline, e1RM, change) → pushes the lift sheet with an e1RM line and the history.
   - **Consistency**: weeks kept in the range, habits % and training %. Sheet (large): Weeks kept / Training / Habits stamps, "5 of the last 8 weeks kept." (`weekStreak`), and the habit grid with one row per habit (name and rate above its last 28 days; 21 under 330px), Training first. The reviewed press-and-slide scrub is kept: press, slide to a day, let go to open it.
7. **Empty / new account**: the chart as it will look (a sample quarter at 30%, no axes over nothing), one serif sentence and one verb: "Plan a week and run it. This page draws the rest." + **Plan a week**, or with a plan already in place "Your plan is set. Each run you log lands here." + **See the plan** (**Connect Strava** when Strava is on and not linked).
8. **Loading**: a skeleton in the page's shape (two verdict lines, the sub, three chips, the 328px card, five 64px rows). While a longer range's months arrive the previous model stays up, so numbers never shuffle.

## Every gesture and its fallback

| Gesture | What happens | Haptic | Fallback |
|---|---|---|---|
| Press and slide on the chart | The context label and the three headline numbers rewrite to the week under the finger (Miles · Planned · Runs); other bars dim; a column marks the week. Starts after a 160 ms hold or a sideways slide, so a vertical swipe still scrolls; once live the page holds still. Release returns to now. | `select` per bar, `toggle` on the biggest week | Focus the chart: ←/→ read weeks, Home/End, Escape lets go; VoiceOver reads the label as a live status |
| Tap a bar | Opens that week's sheet; the readout names the week while the sheet is up, so the title flies from it and home again (`week-<isoWeek>`) | none (opens a sheet) | Enter on the focused chart; a hidden list of week buttons for VoiceOver |
| Pinch on the chart | Fingers apart: shorter range; together: longer. The bars follow the fingers a little, then move to the new range on `springs.settle` | `select` once per pinch | The 3M · 6M · 1Y chips |
| Chips | Change the range for every section | `select` | Tab + Enter |
| Tap a drill-down row | Opens its sheet | none | Tab + Enter |
| Week sheet row | A planned session opens the session sheet (`useOpenSession`); an unplanned run pushes the run sheet inside this sheet | none | Same rows are buttons |
| Press and slide on a sheet chart (long run, easy pace, e1RM) | The stamps above rewrite to the point; tap opens that run | `select` per point, `toggle` at the best | Arrow keys + Enter |
| Press and slide on the consistency grid | The column under the finger lights with its date; let go opens that day on Today | `select` per column | One button per day for keyboard / VoiceOver |

## Files

- `apps/web/src/features/progress/ProgressView.tsx` (was `features/trends/TrendsView.tsx`): the page, the readout, the drill-down list, the empty state and skeleton, the range and the dev-only `?asof=YYYY-MM-DD`.
- `apps/web/src/features/progress/data.ts` (new): every number as pure functions: `weekSeries`, `rangeSummary`, `verdict`, `nextRun`, `adherence`, `currentBlock`, `longRuns`, `easyPace`, `liftGroups`, `consistency`, `isoWeek`/`weekId`, words.
- `apps/web/src/features/progress/data.test.ts` (new): the verdict (no zero, same-weekday comparison, "starts today", quiet weeks), the range summary, adherence grading (today and later are "ahead"), ISO weeks. Run: `cd apps/web && npx vitest run src/features/progress`.
- `apps/web/src/features/progress/MileageChart.tsx` (new): the chart, direct labels with collision avoidance, bar motion.
- `apps/web/src/features/progress/useScrub.ts` (new): press-and-slide / tap / pinch / hover / keyboard for charts. A tap opens on the click that follows, so the click never lands on the sheet rising under the finger.
- `apps/web/src/features/progress/charts.tsx` (new): `Spark`, `LineChart` (sheet charts with scrub), `niceTicks`, `useWidth`.
- `apps/web/src/features/progress/sheets.tsx` (new): `WeekSheet` + `useOpenWeek`, `AdherenceSheet`, `LongRunSheet`, `EasyPaceSheet`, `LiftsSheet`, `LiftSheet`, `ConsistencySheet`.
- `apps/web/src/features/progress/progress.css` (was `trends.css`): rewritten.
- `apps/web/src/app/App.tsx`: the one import line now points at `@/features/progress/ProgressView`.
- `apps/web/src/api/queries.ts`: untouched (no new hooks were needed; months come through `useLog`, lifts through `useAllLifts`).

## Hand-verifiable steps (seed `test.db`, josh@example.com / password123, today Wed Oct 14 2026)

1. Open `/progress` (or `/trends`, which redirects). Expect "Two quiet weeks. This one is light so far." and "26 mi planned. Next: Easy 4, Friday." No 0.0 anywhere above the chart. Headline: AVG WEEK 15.1 · BEST WEEK 31.3 · TOTAL 136. No tooltip is pinned.
2. The chart shows RUN over the Sep 14 bar, PLAN over the plan ahead, 4-WK AVG 12 at the end of the line, NOW in blue under this week, no legend row.
3. Press on the chart and slide left: the label becomes "Week of Sep 14" etc. and MILES / PLANNED / RUNS tick to that week; passing Sep 14 gives a Light tap instead of a tick (on /dev/ui-style devices, `window` `logbook:haptic` shows `toggle`). Let go: "Last 3 months" and 15.1 · 31.3 · 136 come back.
4. Swipe up starting on the chart: the page scrolls, no scrub, no haptic.
5. Tap the Sep 14 bar: sheet "Week of Sep 14", SEP 14 – SEP 20, ring of six done days, "Week kept.", 31.3 mi, 6 runs, a row per day (Bonus runs, Sunday Rest). Tap Monday's run: the run sheet pushes in with a back chevron. Close: the label returns to "Last 3 months".
6. Tap NOW's column: "This week", "Three more sessions keep it.", PLANNED 26 mi / RUNS 5 (no zero lead), Mon and Tue Missed in red, Wed/Thu Rest, Fri–Sun Planned; Saturday's two sessions share one day label.
7. Tap 1Y: the label reads "Since Aug 10" (the log starts in August; no field of empty weeks). Tap 6M: same. Pinch the chart apart: 3M lights. Pinch together: 6M lights.
8. Plan adherence row: "1 of 6", "This block: 17% kept, 5 ahead". Sheet: KEPT 1 of 6, BLOCK WEEK 2 of 11, the block summary, This week (0 of 2 kept · 5 ahead) and Last week (1 of 4 kept) with rings; a week row pushes its week sheet.
9. Long run: 5.3 mi, "Down from 8.0 in August". Sheet: press and slide the line; the stamps read each week's longest run.
10. Easy pace: 7:53 /mi, "8 s faster than August · 149 bpm". Sheet axis reads 8:00 / 9:00, faster is up.
11. Lifts: 263 e1RM, "Squat, 225 × 5 · 2 lifts". Sheet → Bench press: an e1RM line from Oct 4 to Oct 11, +6%. Squat (one day) shows a stamp and "The line draws from the second day you log it." instead of a one-dot chart.
12. Consistency: 6 of 10 wks. Sheet: per-habit rows with rates; press the grid and slide; the date reads above; let go opens that day on Today.
13. Sign up a new account (`ALLOW_SIGNUP=1`) and open `/progress`: a ghost chart at 30%, "Plan a week and run it. This page draws the rest." and a blue **Plan a week**. After onboarding (a plan, no runs): "Your plan is set. Each run you log lands here." and **See the plan**.
14. Dev build only (`NODE_ENV=development vite build --mode development`): `/progress?asof=2026-10-12` → "Two quiet weeks. This one starts today." / "26 mi planned. First run today: Easy 5."; `?asof=2026-09-16` → "Last week was up on your average. This one is ahead of last week." / "19.7 mi so far. Three runs in."; `?asof=2026-09-22` → "Last week was your biggest in six weeks. This one is light so far."
15. Reduced motion: range changes snap (no bar travel), sheets fade, the scrub still works.
16. At 320×568: no horizontal scroll on the page or in any sheet; sparklines step aside on the rows so the titles and numbers keep their room.

## Audit §2.6 and fix 14, item by item

| Audit item | Status |
|---|---|
| The range control only changes the mileage chart; lifts all-time, consistency fixed 14 days | **Fixed.** Chips drive the chart, the headline, adherence, long run, easy pace, lifts (sets in range) and consistency (rates, weeks kept, habit sparkline). |
| 1M shows "LAST 4 WK" over 9 bars, 5 of them future | **Fixed.** Ranges are 3M · 6M · 1Y (spec); only two weeks ahead are drawn, dashed. |
| 6M is 60% empty bars before the first run | **Fixed.** A range longer than the log starts where the log does (≥ 13 weeks) and says "Since Aug 10". |
| The hero leads with "THIS WEEK 0.0 mi / RUNS 0" and a red-feeling delta | **Fixed.** The verdict sentence leads; the headline at rest is the range (avg, best, total); this week's miles vs plan are words in the sub. The 4-stamp zero hero is gone. |
| "−12.2 mi vs avg" early in the week | **Fixed.** Removed; the week is compared with the same weekday last week. |
| No pace / HR / easy-pace trend, no long-run line, no plan adherence by week | **Fixed.** Easy pace (with HR when present; zones when they exist), Long run, Plan adherence by week. |
| Consistency: 12pt cells, five-item legend, two stamps: three ways to say one thing; the scrub is hidden | **Fixed / kept.** One row per habit in a full sheet (name and rate above its days), stamps once at the top, a four-item key in the sheet only, and a one-line hint for the scrub, which is kept as reviewed. |
| Range change doesn't tween; bars jump | **Fixed.** Bars and grid lines move on `springs.settle` (keyed by week); entering bars grow from the baseline. |
| Empty account: axes 0–10 and "—" stamps | **Fixed.** Ghost chart with one sentence and one verb. |
| Pinned tooltip on load / tap to pin a tooltip | **Fixed.** No tooltip: the headline numbers are the readout, and they return to now on release. |
| Legend row | **Fixed.** Series are labelled on the chart. |
| `tr-wait` placeholders | **Fixed.** A skeleton in the page's shape. |
| `haptic('tick')` in the consistency scrub | **Fixed.** `haptics.select()`; every haptic in the feature is named (`select`, `toggle`). No `haptic(` and no `whileTap` remain. |
| Effort check section (zones, per-run grade, Sync/Connect) | **Rejected as a section, folded in.** Heart rate sits in Easy pace (zones pick the easy runs when they exist). The per-run "On target / Too hard" grade and the zone Sync button are not on this page any more: the session sheet already shows the grade for a run, and zones sync with Strava from Settings. |

## Contracts

- **Relies on**: `useLog` (months, boot blocks, habits, zones), `useAllLifts`, `weekSummary` / `weekCheck` / `weekStreak` / `sessionWord` / `sessionKey` / `dayStatus` from shared, `useOpenSession` / `UnplannedSheet` / `sessionSheetTitle` from `features/sessions`, the foundation (`TabHeader`, `Pressable`, `Ticker`, `WeekRing`, `EmptyState`, `Skeleton*`, `useSheet` push/pop/`layoutId`, `shared()`, `ChipButton`, `haptics`, `springs`).
- **Provides**: `WeekSheet` and `useOpenWeek(today)(weekStart, 'open' | 'push')` in `features/progress/sheets.tsx`, the week sheet the spec wants behind Today's week ring (`layoutId` `week-<isoWeek>`). `isoWeek` / `weekId` in `features/progress/data.ts`. Route `/progress` unchanged.

## Requests for other teams

1. **Sessions**: a push variant of `useOpenSession` (e.g. `open(date, s, { push: true })`). From the week sheet a planned session currently *replaces* the stack (`sheet.open`), so there is no back to the week; unplanned runs already push.
2. **Foundation**: `.chip-btn:hover` outranks `.chip-btn.on` on hover-capable devices, so a selected chip loses its white fill under the pointer. Patched locally for `.pg-chips`; the primitive should keep `.on` under `:hover`.
3. **Today**: the week ring's week sheet can be `useOpenWeek` from `features/progress/sheets` if you want one sheet for the week everywhere.
4. **Settings**: since the Effort section is gone, the HR-zone sync explanation ("zones come in with your runs") should live with the Strava row.

## Screenshots

Before (`before/`): `progress-390.png`, `progress-390-fold.png`, `progress-320.png`, `progress-320-fold.png` (zero hero, legend, "−12.2 MI VS AVG", a pinned tooltip on load), and from the audit run `fr-trends.png` (empty), `sheet-lift.png`, `trends-6m.png`, `trends-1m.png`.

After (`after/`):
- Page: `progress-390.png`, `progress-390-fold.png`, `progress-320.png`, `progress-320-fold.png`
- Scrub: `scrub-390.png`
- Ranges: `range-1y-390.png`, `range-6m-mid-390.png` (mid-transition), `range-6m-390.png`, `range-1y-320.png`, `range-6m-320.png`
- Week sheets: `sheet-week-390.png`, `sheet-week-run-390.png` (pushed run), `sheet-thisweek-390.png`, and the `-320` versions
- Drill-down sheets: `sheet-plan-adherence-*.png`, `sheet-long-run-*.png`, `sheet-long-run-scrub-390.png`, `sheet-easy-pace-*.png`, `sheet-lifts-*.png`, `sheet-lift-*.png`, `sheet-consistency-*.png`
- Empty / new account: `new-plain-390.png`, `new-plan-390.png`, `new-plan-320.png`
- Skeleton: `skeleton-390.png`
- Other days (dev `?asof`): `asof-2026-10-12.png`, `asof-2026-10-13.png`, `asof-2026-09-16.png`, `asof-2026-09-20.png`, `asof-2026-09-22.png`, `asof-2026-08-26.png`, `asof-2026-10-17.png`
- Reduced motion: `reduced-6m.png`, `reduced-consistency.png`

QA results (verify.mjs): no horizontal overflow on the page or any sheet at 390 and 320; console clean (including reduced motion); the only interactive elements under 44px are the range chips, 32px to the eye with the primitive's 44px hit extension.

## Gates

`pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .`, `pnpm --filter @logbook/shared test`, `pnpm --filter @logbook/api test`, `pnpm --filter @logbook/web build`: all pass. Plus `npx vitest run src/features/progress` in `apps/web` (6 tests).
