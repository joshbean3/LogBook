# Fix team B: Today, habits, to-dos, Morning (pre-launch fix round)

Screenshots: `<S>/fixb/shots/before/` and `<S>/fixb/shots/after/`, `<S>` = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad`.
The "before" for every interaction is the critic's or QA's own shot (`<S>/critic/shots/…`, `<S>/qa/shots/…`), named per item.
Scripts: `<S>/fixb/*.mjs` (`states.mjs` static states, `ix_today.mjs` Today gestures, `ix_done.mjs` the done hero,
`ix_more.mjs` Morning, orbs and to-dos, `fresh.mjs` a new account, `keep.mjs` the things the critic called excellent).
Server for the walk: port 8832, seed DB (restored to the seed after the walk). 390×844 and 320×568, DPR 2, touch, CDP touches.

## Contracts

- **Contract 5 (`sessionMiles`)** is not in this worktree yet. `features/day/miles.ts` is the local adapter with the
  documented signature `sessionMiles(snapshot, date, session) → { miles, source: 'activity' | 'planned' | 'floor' | 'none' }`
  and the documented rules (done with no run = planned miles; floor = floor minutes at an easy pace, capped at the plan).
  When Fix A lands it, replace the adapter's body with `export { sessionMiles, type MilesSource } from '@logbook/shared';`.
  `dayMiles` / `weekMiles` there build on it (the close-the-day MI stamp, the done hero's week line, the share card's week).
- **Contract 7 (generic morning defaults)**: the client no longer assumes anybody's routine (see B9). The server defaults
  are Fix A's; until they land a new account still gets the old numbers from the server (shown with generic names).

## Item → change → verification → screenshot

| # | Item | Change | Verified | Shots (after; before) |
|---|---|---|---|---|
| B3 | Done hero | `Hero.tsx` `DoneFace`: a session done with no Strava run reads "EASY 4" stamp, then a blue check that pops in on `springs.complete` + serif "4 mi. Done." (miles tick up on `springs.number` once a day via `Ticker`), "4 of 24 mi this week.", a **Share** pill and a quiet "Ran a different distance?" that opens a one-row 0.5-mi `Stepper` + Save (writes the session's miles, toast "4.5 mi logged"). No DONE chip anywhere on a done hero. The halo blooms (`halo-boost`), the ring fires `haptics.success()` once. Miles via `sessionMiles` (adapter). The share card for a hand-logged run opens on the Bubble ("4.5 mi. Done.") and carries the logged miles and week. | `ix_done.mjs`: haptics = `success` only; text "EASY 4 · 4 mi. Done. · 4 of 24 mi this week. · Share · Ran a different distance?"; after +0.5: "EASY 4.5 · 4.5 mi. Done.", haptics `select,toggle`; menu Open · Not done · Share · Morning · Add a session; evening stamps "MI 4.5". 320 fits. | `b3_hold_250`, `b3_after_80` (number ticking), `b3_after_250`, `b3_after_1500`, `b3_after_1500_320`, `b3_distance_open`, `b3_distance_saved`, `b3_share`, `b10_evening_after_done`; before `critic/shots/h2_after_1500.png`, `ev_fresh_done.png` |
| B10 | Evening card | `CloseDay.tsx` `dayStamps`: stamps are numbers only (MI from `dayMiles`, HABITS "3 of 5" / "5 lit", TO-DOS "2 done"); a stamp that would be none / not yet / zero is dropped; with none left, one ink-2 sentence from the day ("Easy 4 still open. 5 habits to light.", "Rest day. 5 habits to light."). Placeholder: the day prompt with "Two sentences, then sleep." replaced by "How did today go?" so it never repeats the title. | `states.mjs` 19:30 run day / rest day / Oct 11 / Sep 8 texts | `today_run_1930`, `today_run_1930_320`, `today_rest_1930`, `today_past_1011-full`, `today_bonus_0908-full`; before same names in `before/` |
| P8 | Rest-day 6:30 hero | `Hero.tsx` `restMorning`: on today's rest morning before leave: "REST DAY / Rest. It counts. / Alarm in 45 min" (then "Leave in 2 h") plus the mini timeline Alarm · first routine block · last routine block · Leave (3 stops when the routine has one block). Tap the line or the card → Morning; pull down on the hero → Morning; tomorrow's session joins the countdown line ("· Tomorrow: Easy 4"). | `states.mjs` today_rest_0630 | `today_rest_0630`; before `before/today_rest_0630.png` |
| P10 | After saving the entry | `CloseDay.tsx` `AddToIt`: under "Day, closed." the empty composer folds into a 44px "Add to it" row (pen icon, ink-3) that opens the composer focused; it folds again after a save. Entries no longer bleed full-width on black: a hairline above, transparent rows (surface only while a swipe is revealing Delete). | `addto.mjs`: row 44px, composer focused | `today_past_1011-full`, `p10_add_to_it_open`; before `before/today_past_1011-full.png`, `critic/shots/fx_saved.png` |
| P11 | Bonus-run hero | Eyebrow is the time of day from the run's start ("AFTERNOON"), the BONUS chip stays; the stamps are TIME and AVG HR (CLIMB when there is no HR) in two columns, since the verdict carries miles and pace. | today_bonus_0908 | `today_bonus_0908`; before `before/today_bonus_0908.png` |
| Menu | Hero menu | Open uses a chevron; order Open, Done, Floor, Skip, Move, Not feeling 100%, (Share), Morning, Add a session. A manual Done adds "Not done". | `ix_today.mjs` prints the list | `hero_menu`; before `critic/shots/ix_hero_hold.png` |
| D-D1 | Quick tap on the hold ring | `HoldRing.tsx`: a quick tap opens the sheet on the click (with a 350ms fallback if no click comes), so the post-pointerup click can't land on the new scrim. Same component on the evening card. | sheet still open 1s after a 30ms touch tap (hero and evening ring) | `dd1_ringtap_120`, `dd1_ringtap_after`, `dd1_evening_ringtap`; before `qa/shots/EV_D1_ringtap_after.png` |
| D-D2 | Not feeling 100% from the hero | Menu item calls `useSessionActions(log).sick` from features/sessions (imported, not edited): skipped-for-illness, then the "Ease the next few days?" offer. A future skipped session now reads "Skipped to recover." on the hero instead of its plan line. | toast shown | `dd2_ease_offer` |
| D-D3 | No press scale under reduced motion | `whileTap` only when `!useReducedMotion()`. | transform `matrix(0.9857…)` normally, `none` with reduced motion | — |
| D-D4 | Evening hero long-press | `useHoldMenu` on the evening card (Done, Floor, Skip, Move, Not feeling 100%, Add a session); a hold inside the composer stays the field's. | menu on hold; none in the textarea | `dd4_evening_menu` |
| D-D5 | Hold the mini timeline | `MiniTimeline` no longer stops the press: a hold is the hero's menu (the click after it is swallowed), a tap still pushes Morning. | hold → menu, URL unchanged; tap → /morning | `dd5_minitl_hold` |
| D-D6 | Date swipe from the ring | The ring no longer stops pointerdown; the hero's long-press (`useHoldMenu`) ignores presses that start on `.hold-ring`. | swipe from the ring → /today/2026-10-17, `select`, no sheet | `dd6_swipe_mid`, `dd6_swipe_done` |
| D-H1 | Orb menu at 450ms | `OrbRow.tsx`: lift at 300ms as before; still unmoved at 450ms the menu opens under the finger (no second haptic); moving on closes it and keeps dragging (iOS grammar); a release between 300–450ms still opens it. | 380ms: no menu, `lift`; 530ms finger down: menu; menu then drag → menu closes, order changes, `lift,drop` | `dh1_menu_while_held`, `dh1_menu_then_drag` |
| D-H2 | Habit sheet streak and N of 30 | `HabitSheet.tsx`: stamps STREAK (when ≥1), BEST (when longer), and "N of M" counted only from the habit's first day ("SINCE OCT 10 · 1 of 5"); with nothing yet: "Light it today and the streak starts here." | sheet text | `dh2_habit_sheet` |
| D-T1 | Drop haptic on to-do reorder | `TodoList.tsx` `onDrop`: `haptics.drop()` when the order changed. | `lift,drop`, order changed | `dt1_after_reorder` |
| D-M1 | Morning day swipes | `MorningView.tsx` `go()` uses `replace`. | Today → Morning → two swipes → back = /today | `dm1_after_back`; before `qa/shots/EV_D3_morning_back.png` |
| D-M2 | Short blocks 44px | `Timeline.tsx`: a block under 44px keeps its true height and gets an invisible `.tl-hit` slop taken from free time or a neighbour's spare height (never from the run's grip edge; neighbours keep ≥44), raised above neighbours (dropped while a grip drags). Free time is `pointer-events: none`. A neighbour's menu also lists "Edit <short block>" when a short block still can't reach 44. | measured hit bands: Out the door 45, Cool down 45, Breakfast 45, neighbours ≥53; hold 8px below Out the door → its menu; run grip still drags | `dm2_hold_short_block`, `dm2_grip_still_drags` |
| D-M3 + P6 | "Drag the alarm" | `.tl-hint`: one line, left of the wake grip on the block's top edge; hidden under 360px. | 390: visible, overlaps neither alarm time nor grip; 320: hidden | `dm3_lesson_390`, `dm3_lesson_320`, `morning_run_0630_320`; before `critic/shots/w320_morning.png` |
| P5 | Pull to Morning enters from the hero | The hero's pull navigates with `state.enter = 'pull'`; Morning drops in on y (`springs.page`, 120ms fade) and holds the frame's sideways push still for the entrance (`html[data-morning-enter]` in morning.css). Tap / menu → the normal push. Reduced motion: normal. | frames at 60/160/320/900ms | `p5_pull_armed`, `p5_enter_60`, `p5_enter_160`; before `critic/shots/strip2_pull.png` |
| P7 | Rest-morning free time | A rest morning's free block over 45 min is drawn at most 120px with an axis break (two slashes) and no ticks inside; the card keeps "1 h 10 min to yourself before the routine." Positions stay clock-true elsewhere (a piecewise `y(t)`). | rest morning full page | `morning_rest_0630-full`; before `before/morning_rest_0630-full.png` |
| B9 | No owner routine in the UI | `model.ts`: `AFTER_LABEL` generic ("Breakfast" for the `smoothie` slot, icon a cup), `blockLabel()` used by the timeline, menus and MiniLine; `ROUTINE_DEFAULTS` (Get ready 30, last block 10, others off) for every pre-load fallback and the routine editor's Reset. | a new account: "Shower · Get ready · Breakfast · Final prep" (server numbers until contract 7) | `b9_fresh_morning`, `b9_fresh_routine`; before `critic/shots/fr_morning_at_06_00.png` |
| Keep | Excellent things | Untouched or re-verified: morning states, hero swipe (from the body and now from the ring), pull to Morning, orb tap (`orb`), to-do swipe right (Undo toast), hero tap → sheet, Morning grips and routine editor. | `keep.mjs`, `ix_more.mjs` | `keep_hero_tap_sheet`, `today_run_0630`, `morning_run_0630` |

No horizontal overflow on any state (390 and 320); console clean on every route walked.

## Hand-verifiable steps

1. Today on a run day after the door time (`/today?at=10:00` in a dev build). Tap the HOLD ring quickly: the session sheet opens and stays.
2. Hold the ring 0.5 s: one Success, the check pops, "4 mi. Done." ticks up, the halo brightens, "4 of N mi this week.", Share, "Ran a different distance?". Tap it, +, Save: "4.5 mi. Done." and a toast.
3. Hold the hero anywhere but the ring: menu Open (chevron) · Done · Floor · Skip · Move · Not feeling 100% · Morning · Add a session. Not feeling 100% → "Ease the next few days?" toast.
4. Start a horizontal swipe on the ring: the day pages.
5. Morning phase (`?at=06:30`): hold the mini timeline → hero menu; tap it → Morning (push). Pull the hero down → Morning drops in from above. Swipe days twice, Back → Today.
6. Rest day at 6:30: "Rest. It counts.", "Alarm in 45 min", Alarm · Shower · Prep · Leave.
7. 19:30: stamps only numbers, or the one sentence; placeholder "… How did today go?". Hold the card title → its menu.
8. A past day with an entry: "Add to it" row, hairline above the entry, no black band.
9. Hold an orb still: menu at 450 ms; keep moving: menu closes and the orb drags. Details: STREAK / BEST / "Since …".
10. To-do sheet: hold a row and drag: one drop haptic when it lands in a new slot.
11. Morning at 390 first visit: "Drag the alarm" left of the grip; at 320 no pill. Hold just outside Out the door: its menu.

## Requests for other teams

- **Fix A**: `sessionMiles` (contract 5) in shared, then swap `features/day/miles.ts` to the re-export. Contract 7: please keep the
  `prep` block's label distinct from the run's "Out the door" buffer block (we show "Final prep"); naming both "Out the door"
  would put two identical names on a run morning.
- **Share (B4)**: a hand-logged run's card still draws "—'—'' · 0:00" in PACE/TIME rows (`b3_share.png`); drop rows with a zero or a dash.
  Today opens the share sheet on the Bubble for such runs meanwhile.
- **Foundation**: (1) `PushedPage` could take an `enter: 'push' | 'drop'` (or read `location.state.enter`) so Morning's pull entrance
  needs no `html[data-morning-enter]` override. (2) `ContextMenu` could accept an `ignore` selector (presses that start on a child
  with its own gesture); Today uses a local `useHoldMenu` for that. (3) D-F1 (Toast action replaced by a follow-up toast) affects the
  "Ease them" → "eased + Undo" step that D-D2 now reaches from Today.
- **Sessions**: D-SE1 (sheet title after Edit) shows after "Ran a different distance?" too, since that edits the session's miles.
- **Test note**: with Playwright's `clock.setFixedTime`, Today's cache updates after a write don't re-render until reload
  (the critic saw this too); with the real clock and `?at=` everything updates live. Worth a look by whoever owns `api/`.
