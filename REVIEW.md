# Morning team review

Spec: `docs/experience.md` §5.2. Morning is a pushed page (`/morning/:date?`, lights Today) whose whole body is the timeline.
Branch `worktree-agent-a797df191b1118d66`.

## What the page is now (top to bottom)

1. **PushedHeader** "Morning"; eyebrow "TODAY · WED, OCT 14" (Today/Tomorrow/Yesterday drop the word under 360px);
   right: a quiet **Today** chip (only off today) and a **routine** icon button (SlidersHorizontal, "Edit routine").
   Chevron and the 20px edge swipe come from `PushedPage`.
2. **Late note** (only when the run/gym makes you late for the back-home routine): one sentence ("Back at 8:48, 8 min past
   the 8:40 routine. You leave at 9:43.") and the two fixes as chips that apply themselves: **Wake 7:15**, **Run 6 mi**
   (or **Skip the run**).
3. **"Alarm in 45 min"** with the pulsing dot, on today before the alarm.
4. **The timeline** inside a `DatePager` (swipe for the previous/next morning; arrow keys; hidden VoiceOver buttons):
   - 48px axis with a hairline, ticks every 30 min, the alarm stamped where the morning starts, the now time in blue.
   - Blocks positioned **by the clock** at a scale that fits the usual morning between header and tab bar (3.6–6 px/min),
     so durations are true; 5-min blocks draw small (one 12px line) instead of being padded to a minimum.
   - Icons per block (alarm, door/footprints, run, dumbbell, shower, shirt, cup, backpack); routine blocks are a surface
     with an ink-4 bar; buffers (out the door, cool down, walks) are hairline outlines; the **session** is the lit block:
     its tone as the 3px bar and a tone glow, the miles/minutes stamped, "42 MIN · 8:20/MI · PLAN 5 MI".
   - **Free time** is empty space with "18 min free" on a dashed hairline. On a **rest** morning the open stretch is a
     card: serif "Rest.", a soft halo, "1 h 10 min to yourself before the routine. Sleep in: drag the alarm down."
   - **Sleeping in** past the usual alarm shows a hatched "+20 min sleep" band above the wake block.
   - **Now**: a blue line with the dot on the axis (2s, 4% scale pulse; none under reduced motion). Blocks behind it step
     back (transparent surface, hairline border, bar at 40%; text stays ink-2, AA).
5. **Leave for work**: a black glass bar with the blue halo, a briefcase on the axis, the stamped time ("9:30 AM") and a
   sub ("In 1 h 40 min", "Out for the day", or amber "8 min later than your routine"). It is `position: sticky` above the
   tab bar, so the endpoint is pinned on screen until the timeline reaches it; it updates live while dragging. Tap → the
   routine editor on "Starts at".

Removed: the hero card, the Edit pill, the week strip, the Plan/Settings segmented control, the 11 numeric inputs,
the Word & quote section, `DateNav`, `Loading`.

## Gestures (and their fallbacks)

| Gesture | Result | Haptic | Fallback |
|---|---|---|---|
| Drag the **wake grip** (tab on the wake block's top edge) | alarm in 5-min steps; everything below re-times live; bubble "7:25 +10 MIN"; one write on release | `select` per step | focus the wake block: Arrow keys (role=slider); Day editor Alarm stepper |
| **Hold the wake block** (300ms) then drag | the block lifts (1.03, surface-2) and drags as above | `lift`, `select`…, `drop` | same |
| Hold the wake block and let go without moving | its menu | `lift` (once) | Shift+F10 / ContextMenu key; hidden "Wake up actions" button |
| Drag the **session grip** (tab on the run/gym bottom edge) | 0.5 mi (run, via pace) or 5 min (gym) steps; bubble "7 MI · BACK 8:38"; one write | `select` per step | the grip is a role=slider with Arrow keys; Day editor stepper |
| **Long-press any block** | ContextMenu: Edit (day editor for wake/session, routine editor focused on that block otherwise), Skip <session>, Make this a rest day / Back to <session>, Edit routine | `lift` (ContextMenu) | each block's hidden "… actions" button; header routine button |
| Tap a block | session/wake → Day editor; routine block → Routine editor focused on it; free → nothing | none | Enter on the focused block |
| Swipe the timeline left/right | next/previous morning, slides on `springs.page` | `select` (DatePager) | arrow keys on the pager, hidden Previous/Next morning buttons, Today chip |
| Edge swipe from the left 20px | back to Today | — | chevron |
| First visit | the wake grip nudges (12px, then 8px) with an "Drag the alarm" pill for 4s; once per device (`logbook.morning.taught`) | — | reduced motion: the pill without the nudge |

Skip marks the planned session `skip` (and turns a reshaped morning into a rest morning) with an **Undo** toast; Make this a
rest day writes the day override with Undo; Back to <session> deletes the override with Undo.

## Sheets

- **Day editor** (title = the weekday, eyebrow "MORNING · OCT 13"): the morning to scale at the top (live), Run/Gym/Rest,
  the kind as chips, Alarm and Miles/Minutes steppers, the late sentence, "Back to Speed 5" (when overridden) and Done.
  Writes on each change, as the drags do.
- **Routine editor** (`detent: 'large'`, sticky while dirty): a sticky preview (Run day / Gym day / Rest day chips, the
  morning to scale, WAKE · DOOR · BACK · LEAVE stamps, "2 h 15 min from alarm to door"), then Alarm, Run mornings, Gym
  mornings and **Back home**: Starts (Set time / When back), Starts at, and the four back-home blocks as a **reorderable
  list** (grip drag with `select` per swap and `drop` on release; Arrow keys on the grip). Every value is a **duration
  chip**: tap cycles the common lengths (`select`), tap the name for an inline stepper. **Save** sends the existing
  settings shape (`wake`, `run`, `gym`, `after`) in one PATCH, `haptics.success()`, toast "Routine saved". **Defaults**
  resets the draft only (nothing is lost until Save). Copy fixed: "Usual workout — One day different? Drag the gym block's
  edge on the timeline" replaces "Change it day by day on the Plan tab".

## Files

- `apps/web/src/features/morning/MorningView.tsx` — the page: header, pager, late note, leave bar, actions (skip / rest /
  back to plan with Undo), skeleton.
- `features/morning/Timeline.tsx` — the timeline: clock layout, grips (kept and extended the reviewed `useHoldDrag` code:
  the draft ref that leads the render, the release point as the last word, one write on release; added a held draft so a
  released drag never flicks back before the write lands), menus, now line, first-visit nudge.
- `features/morning/RoutineEditor.tsx` — the routine sheet.
- `features/morning/DayEditor.tsx` — the day sheet (replaces the old EditSheet/Controls).
- `features/morning/MiniLine.tsx`, `mini.css` — the one-line morning (metro or to-scale bar) and the now-dot pulse.
- `features/morning/MorningMini.tsx` — exported for Today (`{ date }`), documented in its JSDoc.
- `features/morning/model.ts` — `morningOf` (plan + override + routine + order), `applyOrder`, the routine-order store,
  `useNowMinutes` with `?at=HH:MM` (dev build or localhost only), the one-time lesson flag.
- `features/morning/morning.css` — rewritten.
- `apps/web/src/api/queries.ts` — only delimited the existing morning block (`// ── morning ──` … `// ── /morning ──`); no
  behaviour change.

Every haptic in these files is the named API (`haptics.select/lift/drop/toggle/success`); no `haptic(` remains.

## Hand-verifiable steps (server on 8822, josh@example.com / password123)

1. Open `/morning/2026-10-13`. Expected: header "Morning", eyebrow "YESTERDAY · TUE, OCT 13", Today chip and a sliders
   button; the timeline from 7:15 to 9:30 filling the screen; Speed run lit pink with "5 mi"; "18 min free"; Leave 9:30.
2. Drag the tab on the Speed run's bottom edge down ~70px. Expected: a white bubble "7 MI BACK 8:38", the blocks below move,
   one tick per half mile; on release the stamp stays at 7 mi (reload: still 7).
3. Drag the tab on the Wake up block's top edge down ~45px. Expected: "+10 min sleep" band, bubble "7:25 +10 MIN", the
   Leave bar turns "9:43 / 8 min later than your routine" live; release → amber late note with "Wake 7:15" and "Run 6 mi".
   Tap "Wake 7:15". Expected: the morning fits again.
4. Hold the Wake up block still for half a second and let go. Expected: the block lifts and a menu shows Edit, Skip Speed 5,
   Make this a rest day, Edit routine.
5. Long-press Shower. Expected: Edit shower, Skip Speed 5, Make this a rest day, Edit routine. Pick Edit shower. Expected: the
   Routine sheet, scrolled to Shower with its stepper open and a blue edge.
6. In the routine: tap the Shower chip (15 → 20 min, the preview's Leave moves), drag Shower's grip below Blend smoothie,
   Save. Expected: toast "Routine saved"; the timeline shows Get ready, Blend smoothie, Shower, Final prep.
7. Long-press the run → Make this a rest day. Expected: the "Rest." card with the halo, toast with Undo. Long-press a block →
   "Back to Speed 5" brings the run back.
8. Long-press the run → Skip Speed 5. Expected: a rest morning, toast "Speed 5 skipped / Undo"; Undo restores it.
9. Swipe the timeline left. Expected: the next morning slides in with the date in the eyebrow.
10. `/morning?at=06:30` (today; make it a run day first with the Day editor, or try the rest morning as seeded): "Alarm in
    45 min". `?at=07:50`: blue now line over the run, blocks above it dimmed. `?at=10:05`: everything past, Leave "Out for
    the day".
11. Clear `logbook.morning.taught` in localStorage and reload: the wake grip nudges once with "Drag the alarm".
12. Keyboard: Tab to Wake up, ArrowDown twice → 7:25; Tab to the miles grip, ArrowDown → 5.5 mi; Shift+F10 on Wake up opens
    its menu.
13. Reduced motion: the now dot does not pulse; drags still work with no lift scale; the nudge is replaced by the pill alone.

## Audit (docs/research/audit.md §2.2, fixes 13 and 19)

| # | Item | Verdict |
|---|---|---|
| 1 | Plan/Settings segmented control makes two modes | **Fixed**: gone; the routine is a sheet from the header button and every block's menu. |
| 2 | Hero repeats the timeline (four times), costs 200pt | **Fixed**: removed; the times are the blocks' own edges, the alarm is stamped on the axis, Leave is the pinned endpoint. |
| 3 | Week strip duplicates Plan's | **Fixed**: removed; swipe the timeline for other days, Today chip to come back. |
| 4 | Word & quote is a second quote system | **Fixed (removed)**: Journal owns the daily quote. The `focus` settings are untouched on the server. |
| 5 | "Change it day by day on the Plan tab" is wrong | **Fixed**: "One day different? Drag the gym block's edge on the timeline". |
| 6 | Empty day "Rest" here vs "Open" on Today; "Strength" becomes "Workout" | **Fixed here**: the mode is "Gym" with the plan's own type ("Strength") as the block's name; rest is the shared `morningPlanFor` word. Today's word is the Today team's. |
| 7 | Three ways into the same sheet; Free tap opens Edit | **Fixed**: tap the session/wake → Day editor, a routine block → the routine on that block, free time does nothing. |
| 8 | Good drags have no visible handle | **Fixed**: grips on the wake top edge and the session bottom edge, live value bubbles, a one-time nudge. |
| 9 | Edit sheet readout repeats the dimmed timeline | **Fixed**: the sheet's top is the morning drawn to scale, live, not a sentence. |
| 10 | Settings save on blur, no confirmation; Reset wipes 11 values without Undo | **Fixed**: a draft with one Save (success haptic + toast); Defaults resets only the draft. |
| 11 | No transition between modes; arrows disappear | **Fixed**: no modes; days slide on `springs.page`. |
| 12 | Every block the same dark pill; only the run has a tone bar | **Fixed**: routine surfaces, outlined buffers, the lit session with tone glow, empty free time, rest card, sleep band. |
| 13 | "Leave for work" white pill is the brightest object | **Fixed**: a black glass endpoint with the halo; the stamp carries it. |
| 14 | 15-min block drawn at the 32px minimum, proportions drift | **Fixed**: blocks are positioned by the clock; no minimum height. |
| 15 | Live now line only between wake and leave | **Kept and extended**: before the alarm "Alarm in 45 min" with the dot; after leave, "Out for the day". |
| 16 | First-timer gets someone else's routine (8:20 pace, smoothie) | **Partly**: the routine editor makes it one screen to change; onboarding writes wake/leave/pace (platform). |
| 17 | Skipping the run means opening Edit and choosing Rest | **Fixed**: Skip and Make this a rest day in every block's menu, with Undo; one-tap fixes in the late note. |
| 18 | 9pm job (set tomorrow) needs › then drag | **Fixed**: swipe left, drag the alarm. |
| 19 | 11 numeric inputs (fix 19) | **Fixed**: duration chips, reorderable back-home blocks, live preview. |
| — | 5-minute blocks are under 44px tall | **Rejected (conscious)**: the page's point is true durations. Every action they offer is also a ≥44px row in the routine editor and in any other block's menu; their names are read by VoiceOver as buttons. |

## Requests for other teams

- **Platform** (`packages/shared` schemas + API): add `after.order: ('shower'|'ready'|'smoothie'|'prep')[]` to
  `MorningSettings` / `zMorningSettingsPatch`, and apply it in `buildMorning`. Until then the back-home order is kept on the
  device (`localStorage logbook.morning.order`) and applied by `features/morning/model.ts applyOrder`; `dayPhase` is not
  affected (the leave time and the door/back times do not depend on the order).
- **Foundation**: `body { font-variant-numeric: tabular-nums }` gives Inter a wide hyphen ("Wake - up"); consider
  `tabular-nums` only on numeric classes. Morning sets `normal` on its word labels. Also: after a sheet closes, focus
  returns to the `.dpager` and its `:focus-visible` ring shows after a pointer tap (because Escape was a key) — consider
  restoring focus with `preventScroll` and `focusVisible: false` where supported.
- **Today**: `MorningMini` is available (`features/morning/MorningMini.tsx`, props `{ date }`); push `/morning/<date>` from
  the hero. It draws the same timeline (plan + override + routine) as this page and as `dayPhase`.

## Screenshots (`/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/morning/shots/`)

- Before: `before-today(-full).png`, `before-run-day(-full).png`, `before-gym-day(-full).png`, `before-2026-10-11(-full).png`,
  `before-settings.png`.
- After, 390×844 and 320×568: `after-{390,320}-{rest-today,run-before,gym,run-and-lift,long}(-full).png`.
- Time of day (today as a run day): `p-{390,320}-{0630,0722,0750,0835,1005}.png`; reduced motion `p-390-rm-*.png`.
- Gestures: `i-size-mid.png`, `i-size-after.png`, `i-wake-mid.png`, `i-wake-after.png`, `i-wake-menu.png`,
  `i-shower-menu.png`, `i-routine-focus.png`, `i-routine-dragging.png`, `i-routine-edited.png`, `i-routine-saved.png`,
  `i-day-editor.png`, `i-swipe-mid.png`, `t-first-visit.png`, `t-first-visit-rm.png`.
- Actions and sheets per width: `j-{390,320}-{skipped,rest-made,rest-menu,routine,routine-gym,day-editor}.png`;
  MorningMini: `mini-390-run.png`, `mini-390-rest.png`.

## Gates

`tsc --noEmit` (shared, api, web) clean; shared tests 59/59; api tests 35/35; web build passes. Console clean in every
Playwright run; no horizontal overflow at 390 or 320.
