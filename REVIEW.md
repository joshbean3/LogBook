# Drag & Drop team: review notes

Branch: `worktree-agent-ac590f15d22f757ce`. Served on **http://localhost:8802** (sign in `josh@example.com` / `password123`; seed data has today = 2026-10-13 with a "Speed 5" run, five visible habits). Every drag below was driven with real CDP touch events in Playwright (iPhone 14 profile, hasTouch) at 390 and at 320, and again at 390 under `prefers-reduced-motion: reduce`, and checked against the API.

## 1. Files changed

| File | Why |
| --- | --- |
| `apps/web/src/lib/useDrag.ts` (new) | Shared press-and-hold drag hook (300ms hold, slop, window pointer tracking, touch-scroll hold-off once armed, edge auto-scroll, `cancel()`), the lift constants (scale 1.03; `REST` under reduced motion; spring 400/30), day drop-target helpers (`useDropDays` labels `.dcell`s with `data-drop-day`; `useDropOver` toggles `is-drop` and draws the accent-bright ring as a fixed overlay above the thing in the air), and a tiny "what is being dragged" store (`setDragInfo` / `getDragInfo` / `useDragInfo`). |
| `apps/web/src/features/day/DayView.tsx` | Habits only (plus one line in Training): orbs are `Reorder.Item`s lifted by a 300ms hold, one gesture (tap toggles; lifted release opens the note; drag reorders; cancel reverts); Edit-mode rows are `Reorder.Item`s dragged by a 44px grip, arrow buttons kept; `<DropWeekStrip>` mounted under the Training head. |
| `apps/web/src/features/day/day.css` | Orb lift (ring steps up one surface, hairline, no shadow) and touch-action; Edit-row grip (44×44, overlapping the row padding), lifted-row surface-2 + line-strong hairline; the non-scrolling wrap that keeps motion's Reorder from scrolling the page. |
| `apps/web/src/features/sessions/SessionCard.tsx` | `SessionRow`: hold (300ms: tick, the row dims) then move lifts a compact pill (tone dot + name, 40px, 24px above the finger, opacity .9); day hit-testing; `move` + toast/Undo; unmount guard clears the drag state. Long press (450ms, still finger) opens Move only after the release and its click have passed. `DropWeekStrip`: the week slides in under Today's Training head with scroll compensation (also under reduced motion), exact scroll give-back on exit, no selected pill, the session's own day dimmed. |
| `apps/web/src/features/sessions/MoveSheet.tsx` | A day in the Move calendar only takes a click that began with a press inside the sheet, so the release that opened it can never move the session. |
| `apps/web/src/features/sessions/sessions.css` | Ghost pill, dimmed source row, the `.drop-ring` overlay and the `is-drop` hairline, origin-day dimming, drop-strip spacing. |
| `apps/web/src/features/plan/PlanView.tsx` | Week: the `DayStrip` cells are labelled as drop days; Month: in-month `.mcell`s carry `data-drop-day` (out-of-month cells do not); the selected-day hero card is a button that opens the session sheet, as Today's hero does. |
| `apps/web/src/features/morning/MorningView.tsx` | `Timeline` only (plus `date={date}` on its one call site): Wake block hold-and-drag in 5-min steps with the block lifted; run/gym bottom-edge grip for half-miles / 5 minutes with the block at rest and the grip bar brightened; live stamp while dragging; one `setDay` write on release; `role="slider"` + arrow keys. |
| `apps/web/src/features/morning/morning.css` | Timeline rules only: lifted block surface-2 + hairline, 44px grip hit area with the bar at the edge, focus rings. |
| `docs/brand.md` | §9 item 5: the lift named as the one exception to "nothing moves without a tap". |

No edits to `ui.css`, `primitives.tsx`, `app/`, `api/` or `packages/shared`.

## 2. What to verify by hand (port 8802, 390 or 320 wide, touch or mouse)

"Hold" means: press, keep the pointer still ~300ms (a tick on a device), then move. Moving before the hold is up scrolls the page.

1. **Habit orbs reorder.** Today › Habits. Hold the first orb: at 300ms it lifts (ring steps to surface-3 inside its hairline, 1.03 scale, no shadow). Slide it past the third orb, release. Expected: the orbs shuffle live, the order sticks, `GET /api/habits` has the new `position`s, reload keeps it. A cancelled touch (incoming call, palm) puts the row back and writes nothing.
2. **Orb gesture.** Tap (under 300ms): toggles. Hold and release without moving (also a 3–5px nudge): the note field opens under the row with focus, the orb is not toggled.
3. **Edit-mode list.** Today › Habits › Edit. Drag a row by the 44px grip over another row, release: rows slide live, the order sticks and survives reload; Move up / Move down / Remove still work (Tab + Enter). At 320 the name field keeps ≥100px.
4. **Today: drag a row to another day.** Hold the "Speed 5" row: at 300ms it dims (tick). Move: a 40px pill with the tone dot and the name lifts 24px above the finger, and the week slides in under the TRAINING head while the list stays put under the finger (also under reduced motion). The session's own day sits at 40%; no day is drawn as selected. Over Thursday the pill gets the `--accent-bright` ring, drawn above the pill. Release: toast "Moved to Thu, Oct 15" + Undo; `GET /api/months/2026-10` shows `bp20261013r` on `2026-10-15`; Undo returns it. Release on nothing: the pill springs back, nothing moves, and the page's scroll position is exactly what it was.
5. **Tap, hold, scroll.** Tap the row: the session sheet. Hold still for 450ms (second haptic) and release: the Move calendar opens after the release; the session is still on the 13th and no toast appears. Drag the row immediately: the page scrolls, nothing lifts.
6. **Plan week.** Plan › Week, with the row mid-screen. Hold, drag onto "F 16" (ring), release: toast + Undo, `2026-10-16` in the API; Undo restores. The hero card above opens the session sheet on tap, Enter or Space.
7. **Plan month.** Plan › Month. Hold the Sessions row, drag toward the top: the page auto-scrolls until the grid is in view. Drop on the 20th (ring): toast + Undo, `2026-10-20` after reload. The grey out-of-month cells take no drop.
8. **Morning: wake.** Hold the "Wake up" block (lifts: surface-2, hairline, 1.03), drag down 32px: the block shows "7:35" live, the axis and every block below recompute, one tick per 5 minutes. Release: `morningDays["2026-10-13"].wake = 455`; reload keeps 7:35.
9. **Morning: run / gym size.** Drag the bar at the bottom edge of the lit run block (44px hit area) down ~22px: the stamp reads "6.5 mi" live and the block grows; the block itself does not lift, only the bar brightens. Release: `miles: 6.5`, kept after reload. On a gym morning the same edge changes minutes in steps of 5.
10. **Keyboard / VoiceOver.** The Wake block and the edge handle are `role="slider"`: ArrowUp/Down write 5 minutes / 0.5 mile at once. Rows read "Open; hold to move"; lists keep their arrow buttons; the session sheet keeps its Move button.
11. **Reduced motion.** With `prefers-reduced-motion: reduce` every drag still works; nothing scales (the lifted orb, row, block and pill carry only their surface change); the week strip still keeps the list under the finger; drops land instantly.

## 3. Deliberately left out / not finished

- The Morning hero updates on release, not per step: the timeline recomputes live from a local draft and `setDay` is written once when the finger lifts.
- The lifted orb ring steps to `--surface-3` (its rest state is already surface-2 inside a line-strong hairline, so surface-2 alone would read as no change); rows, blocks and the pill use surface-2 + line-strong exactly.
- The Edit-mode list sits in a non-scrolling `overflow: auto` wrap: motion 12.43's `Reorder` auto-scroll mis-measures the document scroller here and jumped the page ~120px on drag start (reproduced with mouse and touch). Session rows use the hook's own edge auto-scroll.
- No `aria-grabbed`; the arrow buttons and the sheet's Move button are the accessible paths, as briefed.

## 4. Shared-file edits requested from the integrator / Team A

- Two one-line touches outside my files: `<DropWeekStrip date={date} log={log} />` under the Training `SectionHead` in `DayView.tsx` (keep it if the to-do extraction rewrites the file) and `date={date}` on `<Timeline>` in `MorningView.tsx`.
- `ui.css`: the toast nowrap (integrator). Optional: a `.dcell` drop-target variant would let `.drop-ring` / `.dcell.is-drop` move out of `sessions.css`.

Screenshots (mid-drag frames at 390, 320 and reduced motion) are in `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/shots/` (`r-390-*`, `r-320-*`, `r-390-reduce-*`).
