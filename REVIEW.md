# Drag & Drop team: review notes

Branch: `worktree-agent-ac590f15d22f757ce`. Served on **http://localhost:8802** (sign in `josh@example.com` / `password123`; seed data has today = 2026-10-13 with a "Speed 5" run, five visible habits). Every drag below was driven with real CDP touch events in Playwright (iPhone 14, hasTouch) and checked against the API.

## 1. Files changed

| File | Why |
| --- | --- |
| `apps/web/src/lib/useDrag.ts` (new) | Shared press-and-hold drag hook (300ms hold, slop, window pointer tracking, touch-scroll hold-off, edge auto-scroll), the brand lift/drop constants (1.03 + 20% white drop-shadow, spring 400/30, instant under reduced motion), day drop-target helpers (`data-drop-day`, `is-drop`), and a tiny "what is being dragged" store. |
| `apps/web/src/features/day/DayView.tsx` | Habits only (plus one line in Training): orbs are `Reorder.Item`s lifted by a 300ms hold; Edit mode rows are `Reorder.Item`s dragged by a grip, arrows kept; `<DropWeekStrip>` mounted under the Training head. |
| `apps/web/src/features/day/day.css` | Orb lift room and touch-action, Edit-row grip, lifted-row styles, the non-scrolling wrap that stops motion's Reorder from scrolling the page. |
| `apps/web/src/features/sessions/SessionCard.tsx` | `SessionRow` gains hold-and-move drag with a fixed ghost copy, day hit-testing, `move` + toast/Undo; long-press now requires a still finger; new `DropWeekStrip` (the week that slides in on Today while a row is in the air, with scroll compensation so the row stays under the finger). |
| `apps/web/src/features/sessions/sessions.css` | Ghost row, dimmed source row, `--accent-bright` ring on the lit day cell (raised above the ghost), drop-strip spacing. |
| `apps/web/src/features/plan/PlanView.tsx` | Week: the `DayStrip` is wrapped in a ref and its cells are labelled as drop days; Month: each `.mcell` carries `data-drop-day`. |
| `apps/web/src/features/morning/MorningView.tsx` | `Timeline` only (plus `date={date}` on its one call site): Wake block hold-and-drag in 5-min steps, run/gym bottom-edge grip for half-miles / 5 minutes, live stamp while dragging, one `setDay` write on release, arrow-key fallbacks with `role="slider"`. |
| `apps/web/src/features/morning/morning.css` | Timeline rules only: wake cursor/callout, lifted block, grip handle, focus rings. |

No edits to `ui.css`, `primitives.tsx`, `app/`, `api/` or `packages/shared`.

## 2. What to verify by hand (port 8802, phone-width viewport, touch or mouse)

Pointer sequence for every "hold" below: press, keep the pointer still for ~300ms (a haptic on a device), then move. Moving before the hold is up scrolls the page as usual.

1. **Habit orbs reorder.** Today › Habits. Hold the first orb ~300ms: it lifts (slightly larger, soft white shadow). Slide it right past the third orb and release. Expected: the orbs shuffle live; after release the order sticks; `GET /api/habits` shows the new `position`s; reload keeps the order.
2. **Orb tap and note still work.** A plain tap toggles the orb (fills blue, check draws, meter moves). Hold without moving for ~450ms: the note field opens under the row and the orb is not toggled.
3. **Edit-mode list reorder.** Today › Habits › Edit. Drag a row by its grip (the six dots at the left) over another row and release. Expected: rows slide live, the dropped order sticks, persists through reload, and the Move up / Move down / Remove buttons still work (keyboard: Tab to a row's arrows, Enter).
4. **Today: drag a Training row to another day.** Today › Training. Hold the "Speed 5" row ~300ms, then move. Expected: a copy of the row lifts under the finger, the row underneath dims, and a 7-day strip (this week) slides in under the TRAINING head while the list stays put under your finger. Move over Thursday: its pill gets the `--accent-bright` ring (visible above the lifted row). Release. Expected: toast "Moved to Thu, Oct 15" with Undo; the row leaves today's list; `GET /api/months/2026-10` shows `bp20261013r` with `date: 2026-10-15`; Undo returns it to the 13th. Release anywhere that is not a day: the copy springs back and nothing changes.
5. **Tap and long-press keep working.** Tap the row: the session sheet opens. Hold the row without moving for ~450ms: the Move calendar sheet opens (no drag starts). Scroll by dragging the row immediately: the page scrolls, nothing lifts.
6. **Plan week.** Plan › Week (scroll so the Speed 5 row is mid-screen). Hold the row, drag onto "F 16" in the day strip (ring lights), release. Expected: toast + Undo, the session is on 2026-10-16 in the API, the strip's dots update; Undo puts it back on the 13th.
7. **Plan month.** Plan › Month. Scroll down to the Sessions row, hold it, drag toward the top of the screen: the page auto-scrolls up until the grid is in view. Drop on the 20th (its pill lights). Expected: toast + Undo, `date: 2026-10-20` in the API and after reload. (Restore it with Undo or by dragging it back.)
8. **Morning: wake block.** Morning › Timeline. Hold the "Wake up" block ~300ms (it lifts), drag down 32px. Expected: the block shows a live stamp ("7:35"), the axis ticks and every block below recompute as you go, one haptic tick per 5-minute step on a device. Release: `GET /api/months/2026-10` has `morningDays["2026-10-13"].wake = 455`; the hero stamps update; reload keeps 7:35. Drag up for earlier.
9. **Morning: run / gym size.** Drag the short bar at the bottom edge of the lit run block down ~22px. Expected: the stamp reads "6.5 mi" live and the block grows; on release `miles: 6.5` is written and survives reload. On a gym morning the same edge changes minutes in steps of 5.
10. **Keyboard / VoiceOver.** Tab to the Wake block (`role="slider"`, value text "7:35 AM"): ArrowUp/ArrowDown move it 5 minutes and write immediately. Tab to the run block's edge handle (`role="slider"`, "6.5 mi"): arrows change by 0.5 mi (5 min for a gym). The Edit-mode arrow buttons and the Move button in the session sheet remain the keyboard paths for lists and sessions.
11. **Reduced motion.** With `prefers-reduced-motion: reduce`, every drag still works; lifted things do not scale or cast a shadow, and drops land instantly.

## 3. Deliberately left out / not finished

- The Morning hero above the timeline updates on release, not per step: the timeline recomputes live from a local draft (`buildMorning`) and `setDay` is written once when the finger lifts, so a drag does not fire a PUT per 5-minute step.
- The Edit-mode list is wrapped in a non-scrolling `overflow: auto` box on purpose: motion 12.43's `Reorder` auto-scroll mis-measures the document scroller here and jumped the page ~120px on drag start (reproduced with mouse and touch); the wrap makes the list its own scroll ancestor, so the drag never touches the page. Session-row drags use the hook's own edge auto-scroll instead.
- The DayStrip primitive is untouched: drop days are labelled by walking its `.dcell`s in order from the Week view's wrapper (`useDropDays`). If `DayStrip` ever renders extra `.dcell`s, pass the real days to it instead.
- No `aria-grabbed`; the lists keep their arrow buttons as the accessible path, as briefed.

## 4. Shared-file edits requested from the integrator / Team A

- None required. Two touches sit just outside my files, both one line and both conflict-safe: `<DropWeekStrip date={date} log={log} />` under the Training `SectionHead` in `DayView.tsx`, and `date={date}` on the `<Timeline>` call in `MorningView.tsx`. If the to-do extraction rewrites `DayView.tsx`, keep that one line.
- Optional for Team A: a `.dcell` drop-target variant in `ui.css` (`is-drop` ring) would let the `.dcell.is-drop` rules move out of `sessions.css`.

Screenshots (mid-drag frames and after states) are in `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/shots/`.
