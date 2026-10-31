# Today v6: the day as a timeline

The day is built, not listed. Everything that can happen today (the workout, the morning routine, to-dos, the goal's steps) is a block on one vertical timeline, or a chip in the tray waiting to be placed. You build the day by dragging, or you ask the assistant to lay it out.

Bound by `docs/system.md`: one card, tokens only, the ten primitives, one Mark, one celebration.

## 1. The page, top to bottom

1. NavBar, date strip, AskBar: unchanged.
2. The workout card: unchanged (status, Strava, the Mark). The same session also appears on the timeline at its time.
3. Today's goal row (`GoalRow`, `steps="count"`): unchanged. Its steps appear in the tray.
4. **The day** (new, the centre of the page): one `Card` with three parts.
   - Head: `SectionHead` "The day", meta "3 of 7 done · 3 h 45 planned", and one `Button soft` "Plan my day" (Sparkles).
   - Tray: "To place" as a row of chips that wrap: unscheduled to-dos (6 px priority dot, text), goal steps (Target icon), each a `Pressable` chip. Empty tray: "Everything has a time."
   - Timeline: vertical, from `dayWindow.start` to `dayWindow.end` (defaults 06:00 to 23:00; from the morning settings' wake, rounded down to the hour, when earlier), 56 px per hour, hour labels in caps at the left (40 px column), hairlines per hour, a dashed line per half hour. The now line (accent, 2 px, a 6 px dot in the label column) when the shown day is today; past time dimmed to `--ink-4` on the labels. The whole timeline scrolls with the page (no inner scroll).
5. Habits (orbs), the week row, Close the day: unchanged.

## 2. Blocks

A block is `{ ref, start, minutes }` placed absolutely: top = (start − windowStart) × px per minute, height = minutes × px per minute, minimum 24 px. Full width minus the label column, 2 px inset. Radius `--r-group`. A 3 px bar at the left edge: session = its tone, to-do = `--ink-3`, step = `--accent`, morning routine = `--ink-4` (a ghost block from wake to leave labelled "Morning · out the door 6:50", not draggable, behind everything). Inside: title (17/600, one line, ellipsis), caption "7:30 – 8:15" (13, `--ink-3`), the Mark at the right (square for to-dos, circle for steps and sessions). Done: text `--ink-3` struck, surface `--surface-2`. Overlap: a block that starts inside another is indented 12 px and drawn above it (max two levels).

## 3. Interactions (every one has a hold-menu fallback)

- **Place**: hold a tray chip (450 ms, `haptics.lift`) → it lifts into a floating ghost that follows the finger (`Ghost` pattern from PlanDay); over the timeline a translucent target block shows where it will land, snapped to 15 min; `haptics.select` on each snap change; drop → the block is created with a default length (to-do 30 min, step 45 min) and `haptics.drop`; the page auto-scrolls when the finger is within 64 px of the viewport's top or bottom (use the tab scroller).
- **Move**: hold a block → it lifts (scale 1.02, `--shadow-menu`) → drag vertically, snapped to 15 min, the caption rewriting live; drop → `haptics.drop`. Dragging the session block changes the day's alarm by the same offset (`PUT /morning/days/:date` wake) with an Undo toast; the morning ghost follows.
- **Resize**: a 24 px grab zone at a block's bottom edge (a 32 × 4 px pill handle appears on hold or hover); drag changes `minutes` in 15-min steps, minimum 15, with `haptics.select` per step.
- **Complete**: tap the Mark (`haptics.toggle`), the block fills; the head's meta rewrites; the last open block of the day done → `haptics.success` once.
- **Open**: tap the block body → the item's sheet (TodoSheet, the goal detail, the session sheet).
- **Unschedule**: swipe the block left ("Back to tray") or from the hold menu. Hold menu (≤ 4): Unschedule · Move to tomorrow · Edit · Delete.
- **Add here**: tap an empty spot on the timeline → an inline field appears at that time ("Add at 2:30") → Return creates a to-do scheduled there; the quick-add marks still work (`!!!`, `#work`).
- **Drop a to-do on the goal row** → it becomes a step (kept from PlanDay).
- **Reduced motion**: no lift scale, no ghost spring; drops land instantly.

## 4. Plan my day (the executive assistant)

The button opens the assistant with the initial message "Plan my day" and `context.date`. The server's context carries the timeline (every slot), the tray, the morning window, `dayWindow`, and `workHours`. The model answers with one `plan_day` proposal: `slots` for every unplaced item, respecting the workout, the morning routine, work hours (deep work before noon, calls after), priorities (P1 first), durations by kind, and anything the owner said ("no meetings before 10" from memory). Apply lays the blocks out one after another (40 ms stagger, 6 max) and `haptics.success`. The proposal card lists each placement in words ("Call the bank · 9:00, 30 min").

## 5. Data

```ts
// packages/shared/src/dayplan.ts
export type DayRef = `todo:${string}` | `step:${string}` | `session:${string}`;
export interface DaySlot { ref: DayRef; start: number /* minutes from midnight, 0..1439, multiple of 5 */; minutes: number /* 5..720 */ }
export interface DayBands { morning: DayRef[]; afternoon: DayRef[]; evening: DayRef[] }
export interface DayPlan { date: ISODate; bands: DayBands; slots: DaySlot[]; updatedAt: string }
export const zDaySlot, zDayPlanPut = z.object({ bands: zDayBands.optional(), slots: z.array(zDaySlot).max(60).optional() })
```

- A ref is in `slots` or in a band or in neither (the tray is everything live for the day that is in neither, plus the bands' refs, in band order then priority). Writing a slot removes the ref from the bands.
- `user_settings` key `day`: `{ window: { start: 360, end: 1380 }, workHours: { start: 540, end: 1080 } }` (`GET/PATCH /me/day`); the bootstrap carries it as `daySettings`.
- Assistant op `plan_day` gains `slots?: DaySlot[]`; `labelOp` says "Place Call the bank at 9:00 for 30 min"; apply writes slots and removes those refs from bands; undo restores the previous plan row.
- The client keeps optimistic updates through the existing `useDayPlanSave` (debounced, one PUT per gesture end).

## 6. Done means

- 390 and 320 wide, no horizontal overflow; drag, move, resize and place all work with touch in Playwright (`page.touchscreen` or pointer events with `isMobile`) and with a mouse.
- Typecheck and tests clean; a pure `layout.ts` (slot → top/height, overlap indent, snap, tray derivation) with tests.
- Screenshots: empty day, a planned day, a block mid-drag, the proposal card after "Plan my day".
