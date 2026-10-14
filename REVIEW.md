# Plan & Sessions: review notes

Team: plan. Spec: `docs/experience.md` §5.3. Port 8823. Shots: `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/plan/shots/` (`before/`, `after/`, `rm-` = reduced motion). Scripts: same folder (`before.mjs`, `after.mjs [width] [steps]`, `func.mjs`, `today.mjs`).

## Files changed, and why

| File | What |
|---|---|
| `features/plan/PlanView.tsx` | Rewritten. `TabHeader` "Plan" (date line = the week's range, swipeable; accessory = **Month**/**Week**). Week view = a `DatePager` (step week) over the week header + seven rows, then the block card. Month view = the grid + the block card. Pinch in/out, `/plan/plans` opens the plans sheet over this week. Shared plate (`week-<isoWeek>`) for the zoom. |
| `features/plan/Week.tsx` | New. `weekWords` (headline + forward sentence, no zero headline), `WeekHeader` (thin miles bar, pull down → month, its touches don't start the Shell's pull to refresh), `Agenda`/`DayRow` (edge-to-edge, today lit by a screen-blended halo, rest days quiet), `SessionLine` (tap → sheet with shared title, `SwipeRow` right Done / left Move, hold → lift + drag, still release → ContextMenu, right-click/Shift+F10/hidden "… actions" button), `BonusLine`, `RestLine` (tap → add; hold → menu), the inline "Two hard days in a row. Keep it?" row. |
| `features/plan/Month.tsx` | New. 7 columns + weekly totals; miles per day (run in ink, planned in ink-3); heat = done vs plan (blue, amber for floor, red outline for missed); each week is one button (tap → zoom into it); a day still to do can be held and dragged to another **in-month** day; swipe sideways for months. |
| `features/plan/Blocks.tsx` | New. Block card (arc of planned vs run per week, "Week 2 of 11", New block), Plans sheet, plan detail (Delete with Undo), **New block** template picker on `buildTemplate` with a ghosted preview and "Use this plan" (`POST /plans/template`); "Write my next block" when `features.claude`. |
| `features/plan/useDayDrag.tsx` | New. Hold-drag for Plan rows/cells (`data-plan-day` targets), ghost pill, `select` per day, release-without-move → menu after the release's click lands (the reviewed long-press-to-Move fix, now opening the full menu). |
| `features/plan/PlanBuilder.tsx` | Trimmed to the AI builder (pushed inside the plans sheet); `PlanSheet`/`PlansList`/`Upcoming` removed. |
| `features/plan/plan.css` | Rewritten for the above; builder/preview styles kept. |
| `features/sessions/SessionCard.tsx` | Session sheet v2 (name as the sheet title + `layoutId`, route map, Done/Floor 52px, Skip·Move›·Edit›, ⋯ overflow in the header, evidence kept), `UnplannedSheet` (route, Bonus, evidence, Share), `useOpenSession(date, s, { sharedId })`, new `useOpenUnplanned`, `sessionSheetSpec`, `chipKind`, `RouteMap`, `startClock` (12-hour "Started 2:38 PM"). `SessionRow`/`DropWeekStrip`/`UnplannedRow`/`AddSessionButton`/`sessionMeta`/`shareDataFor`/`SessionActual`/`plannedMiles`/`sessionSheetTitle` kept; rows now use `sessionWord`; haptics migrated. |
| `features/sessions/actions.tsx` | New. `useSessionActions(log)` (done/floor/skip/sick+ease/delete/move/edit/share/add + `menuItems`) so swipe, menu and sheet do the same thing with the same haptic and toast. `sessionCan` (no Done on future days). |
| `features/sessions/reshape.ts` | New. Move vs swap (`dropPlan`), two-hard-days check (`hardPair`), `useReshape` (move/swap with Undo, `easeAfter` for "Not feeling 100%"). |
| `features/sessions/SessionEditor.tsx` | Kind-aware editor: run (type chips, miles stepper, "Floor only · 20 min"), lift (exercise chips from your history + add), cross/lift minutes stepper, a day-strip date picker, "Repeat last Easy · 5 mi". Pops back when pushed. |
| `features/sessions/MoveSheet.tsx` | Move panel: Today/Tomorrow/Next free day chips + the week strip; an occupied day swaps. `openMoveSheet` kept, `pushMoveSheet` added; Skip/Delete no longer repeated here. |
| `features/sessions/DayPicker.tsx` | New. A week of days (DatePager, plus ‹ › buttons), cells bleed to 44px at 320. |
| `features/sessions/sessions.css` | Old month-calendar Move styles removed; sheet, editor, picker, chip, overflow menu styles added. |
| `features/share/ShareSheet.tsx`, `share.css` | Swipeable carousel of live 9:16 previews (snap, peeking neighbours), name + page dots (tap to jump), caption under the Bubble card, Share = the one blue, Save in ink, `success` on share/save. |
| `api/queries.ts` (plan block only) | `useTemplatePlan`, `useDeferredBlockDelete` (plan delete with Undo: cache first, DELETE after the toast window). The `TemplateInput` type import sits inside the block to avoid touching the shared import line. |

## Hand-verifiable steps

1. `/plan` (today Wed Oct 14): header "THIS WEEK · OCT 12 – 18", **Plan**, "26 mi planned · 5 runs", an empty miles bar, "Next: Easy 4, Friday." Seven rows: Mon/Tue missed (red MISSED word, dimmed bar), Today "Rest" lit blue from the left, Fri Easy 4, Sat Threshold 6 + Strength, Sun Easy 6 + Strength. Block card below.
2. Tap **Easy 4**: the stamp flies into the sheet title "Easy 4" (eyebrow FRIDAY, OCTOBER 16), PLANNED chip, PLAN 4 mi / FLOOR 20 min, "Planned for Friday. Done and Floor open on the day.", Skip · Move › · Edit ›, the floor line. ⋯ (top right) → Not feeling 100% / Delete. Close: the title flies home.
3. In the sheet, **Edit ›** pushes the editor with a back chevron; change type to Tempo, tap Thu in the day strip, **Save** → back/close, toast "Moved to Thu, Oct 15", row moves. **Move ›** pushes the Move panel.
4. Hold Easy 4 still ~0.5s and let go: it lifts (`lift`), the menu opens after release: Skip, Not feeling 100%, Move, Edit, Delete (red, last).
5. Hold Speed 5 on `/plan/week/2026-10-19` and drag it onto Fri (Easy 4): the ghost pill rides above the finger, Fri lights (`select` per day), drop swaps them; Fri now sits next to Sat's Threshold → `warning` and the amber row "Two hard days in a row. Keep it?" with Keep it / Undo. Undo puts both back. A drop onto a free day: `drop` + toast "Moved to …" with Undo.
6. Swipe a past/today session right → **Done** (`threshold` then `success`); swipe left → Move sheet. Future sessions have no Done swipe.
7. Swipe the week header sideways (or the date line, or a Rest row) → next week slides in. "This week" chip appears off-week.
8. Tap **Month**, pinch two fingers closed on the week, or pull the week header down past "Let go for the month" → October grid with miles, heat and a Wk column (no zeros: an unrun week shows its plan muted, "planned"/"none run"). Tap a week row → back into that week (the plate morphs). Pinch open on the month → the week under your fingers. Hold a future day's cell and drag to another October day → move/swap; days outside the month take nothing.
9. **New block** (card) → large sheet: goal chips, run-day letters (tap toggles, hold = long run; "Long run" chips as the fallback), Weeks and Miles steppers, Start tomorrow, Race on the last Sunday (race goals). The preview below is the real `buildTemplate` output, ghosted. **Use this plan** → `success`, sheet closes, lands on the block's first week, toast "10K · Dec 27 is on your calendar."
10. Tap the block card → Plans sheet → a plan → detail (arc, kept so far, summary) → **Delete plan** → toast with Undo (Undo restores; otherwise the DELETE goes after ~7s).
11. `/plan/week/2026-09-07`, tap Tue's Afternoon Run → route at the top of the sheet, BONUS, splits, "Faded: …", "Started 2:38 PM · …", **Share** pushes the carousel; swipe cards; dots follow.
12. On a session menu, **Not feeling 100%** → marks `sick` (reads Skipped, keeps the week) and the toast offers **Ease them** (next 3 days: quality runs → Easy at 70%, long at 75%), then Undo.
13. `/plan/week/2027-03-01`: "An open week · Tap a day to add a session, or start a block below." Tap a Rest row → Add a session editor on that day.
14. `/plan/plans` → this week with the Plans sheet open.

## Audit items

**§2.3 Plan: Week**
- Week never visible as a list → **Fixed**: seven rows with session, distance, status.
- Hero mixes day and week stats → **Fixed**: hero removed; week numbers live in the week header only.
- Control under the thing it controls → **Fixed**: no strip; the rows are the controls.
- "PLANNED" three times → **Fixed**: one status mark per row (glyph; words only for Missed/Skipped).
- "Open" row → **Fixed**: removed.
- Week tab doesn't show a week → **Fixed**.
- Day/week change not animated → **Fixed**: DatePager slide.
- Future session can be marked Done → **Fixed**: `sessionCan` hides Done/Floor (sheet, swipe, menu) until the day.
- Two Add pills → **Fixed**: one path (tap an empty day); the block card's New block is a different verb.
- Large empty area / 220pt empty hero → **Fixed**.

**§2.4 Plan: Month**
- Selected day renders 550pt below → **Fixed**: tapping a week zooms into it.
- Colours only, no miles, no weekly totals → **Fixed**: miles per day, Wk column, heat.
- 70pt legend → **Fixed**: one line key under the grid.
- Month swaps instantly, no swipe → **Fixed** horizontally (follow + slide). Vertical swipe between months **Rejected**: vertical belongs to page scroll and pull-down.
- Header and strip restate the range → **Fixed**: one date line.

**§2.5 Plans**
- No way to create a plan without AI → **Fixed**: template picker.
- Plan sheet restates hero, "Open" jumps → **Fixed**: detail shows the arc + kept count; "This week" button.
- Plan delete confirm, no Undo → **Fixed**: immediate with Undo (deferred DELETE, no API change).
- Next-two-weeks rows → **Fixed** by removal (the week agenda is that view).
- No week-by-week view of the plan → **Fixed**: arc on the card and in the detail; ghosted weeks in the picker.
- Title wraps at 44px → **Fixed**: plan names are serif 26 in the card.
- CSV/sheet import (fix 7) → **Rejected for now**: the AI builder's File/Paste mode is the import path when `claude` is on; a plain CSV importer needs an API. Requested below.

**§2.11 Sheets (ours)**
- Session sheet repeats the hero, grey chips, Delete heaviest, Move/Edit quiet, caps-date title, no route → **Fixed** (see step 2). Swipe to previous/next session **Rejected**: the sheet's horizontal space is the Share carousel and the edge; not worth a second gesture.
- Unplanned: route disappears, DONE vs BONUS, 24-hour time → **Fixed** (route at top, Bonus via `sessionWord`, 12-hour clock).
- Share: text chips clipped, "Save" ghost word → **Fixed**: carousel + dots; Save is quiet ink beside the one blue.
- Edit replaces sheet, generic form, native date, empty miles, no presets → **Fixed** (push, kind-aware, day strip, defaults, Repeat last).
- Move: month calendar, foot repeats Skip/Delete → **Fixed**.
- Plan sheet → **Fixed** (above).

**Ranked fixes**: 5 Fixed · 7 Fixed (templates; import partially, see above) · 8 Fixed (tap opens the sheet rather than expanding in place, per spec §5.3) · 17 Fixed · 24 Fixed · 28 Fixed.

**Haptics in our files**: every call is named (`haptic(` no longer appears in plan/sessions/share).

## Contracts

Provided:
- `useOpenSession()(date, session, { sharedId?, fromHero? })`. Mark your title with `shared(sharedId)` (convention `session-<id>`).
- `useOpenUnplanned()(date, runs, log, { sharedId? })` and `sessionSheetSpec(date, s, opts)` (new, optional).
- Unchanged exports: `shareDataFor`, `UnplannedSheet`, `sessionMeta`, `SessionRow`, `DropWeekStrip`, `AddSessionButton`, `UnplannedRow`, `SessionActual`, `plannedMiles`, `sessionSheetTitle`, `openMoveSheet`, `MoveSheet`, `MoveTitle`, `SessionEditor`, `ShareSheet`. `UnplannedSheet` no longer forces a caps-date title: Today should open it with `useOpenUnplanned` (title = run name, eyebrow = date).
- `useSessionActions(log)` / `sessionCan` for any surface that wants the same verbs (Today hero menu).
- `openTemplate(sheet, log)` (from `features/plan/Blocks`) for Today's "Plan a week" starter; `heroBlock`.

Relied on: `sessionWord`/`sessionKey`/`heroSession`/`weekSummary`/`buildTemplate`/`isSkipMark` (shared), `POST /plans/template`, mark `sick`, Sheet v2 push/pop/layoutId, DatePager, SwipeRow, ContextMenu (imperative open), Pressable `onLongPress`, `useHoldDrag`.

## Requests for other teams

1. **Foundation**: `SheetProvider` is mounted above `ContextMenuProvider` (`main.tsx` vs `App.tsx`), so `useContextMenu()` throws inside any sheet body. I built a small menu card for the sheet's ⋯; please move `ContextMenuProvider` above `SheetProvider` (or inside it) so sheets can use the shared menu.
2. **Foundation**: add `SheetSpec.action?: ReactNode` (a right-side header action before Close). The session sheet currently inserts its ⋯ into `.sheet-head` through a portal.
3. **Foundation**: `haptics.ts` calls `navigator.vibrate` before any user activation in some flows, which logs a Chrome intervention error in tests ("Blocked call to navigator.vibrate…"); gate on `navigator.userActivation?.hasBeenActive`.
4. **Platform**: `POST /blocks/:id/restore` (or soft delete) so plan Undo needn't defer the DELETE; and a CSV plan import if the non-AI import path matters.
5. **Today**: switch the unplanned sheet to `useOpenUnplanned`, pass `sharedId` with your hero stamp marked `shared(session-<id>)`, and use `openTemplate` for "Plan a week". The hero still prints FLOOR over a missed Easy 6 on Oct 11 (theirs; see `today-compat-sheet-390.png`).

## Screenshots

Before (`shots/before/`): `plan-week.png`, `plan-month.png`, `plan-plans.png`, `plan-week-sep8.png`, `sheet-session-run.png`, `sheet-share.png`.

After (`shots/after/`, each at 390 and 320 unless noted): `week`, `sheet-flight`, `sheet-planned-future`, `sheet-edit`, `sheet-edit-bottom`, `sheet-move`, `sheet-overflow`, `hold-menu`, `swipe-left-armed`, `swipe-left-move`, `drag-midair`, `drag-swap-conflict`, `drag-undone`, `zoom-out-flight`, `month`, `zoom-in-flight`, `pull-armed`, `next-week`, `template`, `template-half-preview`, `plans-sheet`, `plan-detail`, `week-sep7`, `sheet-unplanned-route`, `share`, `share-swiped`, `week-oct5`, `sheet-missed`, `week-empty`, `add-session`; functional (390): `swipe-done`, `sick-toast`, `eased-toast`, `deleted-toast`, `after-edit`, `template-used`, `plan-deleted-toast`; reduced motion: `rm-*-390.png`; Today compatibility: `today-compat-sheet-390.png`, `today-compat-unplanned-390.png`.

Checks: no horizontal overflow at 390 or 320 on any state; no visible target under 44px (the only hits are the visually hidden "… actions" buttons, which show as 44px pills on focus); console clean apart from request 3. Gates: typecheck (shared, api, web), shared tests 59/59, api tests 35/35, web build.
