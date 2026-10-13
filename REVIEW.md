# Review notes: to-dos with priority, when, and drag order

Branch `worktree-agent-a91a5c46b5bb1ba38`. Served on port 8803 from this worktree (`apps/api`, `DATABASE_PATH=./data/test.db`, `WEB_DIST=<worktree>/apps/web/dist`). Sign in as `josh@example.com` / `password123`.

## 1. Files changed

| File | Why |
| --- | --- |
| `packages/shared/src/types.ts` | `Todo` gains `priority` (0/1/2), `due`, `bucket` ('today' / 'later' / 'someday'), `position`; `TodoPriority`, `TodoBucket`, `TODO_BUCKETS` exported. |
| `packages/shared/src/schemas.ts` | `zTodoInput` accepts `priority`, `due`, `bucket`; `zTodoPatch` accepts all four (plus `position`); new `zTodosReorder`, `zTodoPriority`, `zTodoBucket`. |
| `apps/api/src/db/schema.ts` | `todos` table: `priority integer not null default 0`, `due text`, `bucket text not null default 'today'`, `position integer not null default 0`. |
| `apps/api/drizzle/0004_todo_priority.sql` | New migration: the four columns, then `UPDATE todos SET position = rowid` so existing rows keep their creation order. |
| `apps/api/drizzle/meta/_journal.json` | Journal entry idx 4, tag `0004_todo_priority` (same pattern as 0003). |
| `apps/api/src/lib/map.ts` | `toTodo` maps the four fields, clamping unknown values to 0 / 'today'. |
| `apps/api/src/routes/core.ts` | `GET /todos` orders by position; `POST /todos` takes priority/due/bucket and assigns position = max+1; `PATCH /todos/:id` accepts priority, due, bucket, position (a non-Later bucket clears `due`); new `PUT /todos/order { order: string[] }` sets positions 0..n and returns the list. |
| `apps/web/src/api/queries.ts` | `useTodoMutations`: `add` carries priority/due/bucket (optimistic row gets max+1 position), `patch` accepts all four, new `reorder(order)` writes `PUT /todos/order` optimistically. Only the todo block changed. |
| `apps/web/src/features/todos/TodoList.tsx` | New. `TodosSection` (Today / Later / Someday / Completed groups), `TodoRow` (swipe, press-and-hold lift, `drag="y"` via `useDragControls`), `TodoGroup` (local order, the swap rule, persistence), `Fold`, and the pure helpers `liveOn`, `inToday`, `todayOpenOn`. |
| `apps/web/src/features/todos/TodoSheet.tsx` | New. The editor: name, note, Priority segmented (None / Medium / High), When chips (Today / Later / Someday) with a date field for Later, Delete / Cancel / Save. |
| `apps/web/src/features/todos/PriorityDots.tsx` | New. The priority mark: one or two 6px white dots with an aria-label. |
| `apps/web/src/features/todos/quickAdd.ts` | New. `parseQuickAdd`: trailing `!` = medium, `!!` = high, `tomorrow` / `tmrw` / `today` / weekday / `later` / `someday` set when. |
| `apps/web/src/features/todos/todos.css` | New. All to-do styles, moved out of `day.css` and extended (dots, folds, lifted row, sheet rows). |
| `apps/web/src/features/day/DayView.tsx` | The to-do components (`TodoSheet`, `TodoRow`, `TodosSection`, `TodoLite`) removed; `<TodosSection date={date} />` imported from `../todos/TodoList`; the stat-strip count now uses `todayOpenOn`; to-do-only imports dropped. Habits code untouched. |
| `apps/web/src/features/day/day.css` | The `/* to-dos */` block and the to-do sheet block removed (now in `todos.css`); `.trow.is-done .hrow-name` dropped from a shared selector. `.hrow-name` itself left in place. |
| `REVIEW.md` | This file. |

## 2. What a reviewer can verify by hand (port 8803)

Open `http://localhost:8803/today` on a phone-sized viewport (iPhone 14, 390 wide) after signing in.

1. **Migration ran.** `sqlite3 apps/api/data/test.db "pragma table_info(todos)"` lists `priority INTEGER default 0`, `due TEXT`, `bucket TEXT default 'today'`, `position INTEGER default 0`; `select count(*) from __drizzle_migrations` is 5. Migrations apply on boot, nothing to run by hand.
2. **API shape.** In the browser console `await (await fetch('/api/todos')).json()` returns rows with `priority`, `due`, `bucket`, `position`. The list is ordered by `position`.
3. **API priority validation.** `fetch('/api/todos/<id>', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ priority: 3 }) })` returns 400 `{"error":"priority: Invalid input","code":"validation"}`; with `{ priority: 2 }` it returns the row with `priority: 2`.
4. **API when.** PATCH `{ bucket: 'later', due: '2026-10-21' }` returns `bucket: 'later', due: '2026-10-21'`; then PATCH `{ bucket: 'today' }` returns `due: null` (a date only lives on a Later item).
5. **API order.** `PUT /api/todos/order` with `{ order: ['<idA>', '<idB>'] }` returns the full list with A at position 0 and B at 1. `POST /api/todos` with `{ text, date, priority: 2, bucket: 'later', due }` creates a Later item at position max+1.
6. **Quick-add marks.** In "Add a to-do" type `Call the bank fri !!` and press Enter: the row appears under **Later** with two white dots and `OCT 16` (next Friday) at the right. While typing, a caps hint `HIGH · OCT 16` shows beside the field. `Plan the week !` lands in Today with one dot. `Sort the garage someday` lands under Someday. `Book the dentist tomorrow` lands under Later with `TOMORROW`.
7. **Folds.** The **Later (n)** row shows the next two due dates on the right (`OCT 14 · OCT 16`); tapping it expands the rows, sorted by date. **Someday (n)** and **Completed (n)** fold the same way; all start collapsed.
8. **Today sort.** Today's open rows are high first, then medium, then none, then hand order. The stat strip's "To-dos N open" counts Today's list only (Later/Someday are not counted).
9. **Sheet.** Tap a to-do's name: the sheet has the name, Note, a **Priority** segmented (None / • Medium / •• High), **When** chips (Today / Later / Someday). Pick Later: a date field appears. Save (the sheet's only blue) is disabled until something changes. Set High + Later + a date and Save: the row moves to Later with two dots and the date. Open it again, pick Today, Save: it returns to Today and the API row shows `due: null`.
10. **Overdue surfacing.** PATCH a Later item to `due: '2026-10-13'` (today) or earlier: it appears in Today's list; a past date shows `DUE OCT 12` caps at the right; today's date shows nothing extra.
11. **Press-and-hold reorder.** On a touch device (or Playwright with `hasTouch` + CDP touch), press and hold a Today row for 300ms: a haptic fires (where supported), the row lifts (surface-2 background, hairline, class `is-lifted`); drag it vertically past a neighbour of the same priority and release: the order changes, `/api/todos` shows new `position` values 0..n for that group, and the order survives a reload. Drag a high item below a medium one and it snaps back above it (priority has the last word). A short tap on the name (no hold) still opens the sheet. Completed rows never lift.
12. **Swipe.** Swipe right past 56px completes (blue check underneath, tick haptic at the threshold, the row folds away and appears under Completed); swipe left deletes (red X). Tapping the square mark fills it, draws the check, then folds the row after the celebration.
13. **Carried items.** A to-do created on an earlier day and still open shows its origin date as a small pill (`OCT 11`) at the right, as before.
14. **Widths.** At 320 and 390 there is no horizontal overflow (`document.documentElement.scrollWidth <= clientWidth`), rows are 44px, dates and dots do not wrap mid-word.
15. **Typecheck.** `pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` passes; `pnpm --filter @logbook/web build` passes.

## 3. Left out or not finished

- Quick-add parsing is deliberately small: trailing `!`/`!!`, `today`, `tomorrow`/`tmrw`, weekday names (full or 3-letter), `later`, `someday`. No "next week", no explicit dates, no times.
- Overdue Later items surface into Today in the client (`inToday`); the server does not rewrite their bucket. Their row shows `DUE <date>` in ink, not a status colour.
- Dragging across priority tiers does not change priority; the item settles at the edge of its own tier. Changing priority is done in the sheet or with the quick-add marks.
- Later items with a date sort by date; dragging reorders only the undated ones among themselves. Someday and Today reorder freely within their priority tier.
- Reordering does not use motion's `Reorder` component. It auto-scrolls the page whenever the finger is within 50px of the bottom of `body`, and with `html, body, #root { height: 100% }` (base.css, not mine to edit) `body` is always one viewport tall, so the page ran away on every drag (verified: `window.scrollBy` calls from `autoScrollIfNeeded` growing 3 → 554px). `TodoGroup` applies the same swap rule by hand (a row swaps with its neighbour once its edge passes the neighbour's centre, measured with `onLayoutMeasure`). The cost: no auto-scroll while dragging; the groups are short lists inside a page, so a drag stays within the viewport.
- The lifted row uses a hairline and the control surface, no drop shadow, so it stays inside the brand's "no shadows on the canvas" rule; it does not scale.
- Haptics come from `haptic()` (Capacitor on iOS, `navigator.vibrate` elsewhere); headless Chromium reports nothing, so haptics were not machine-verified.
- No automated tests were added; verification was done with a Playwright script against port 8803 (screenshots in the report).

## 4. Shared-file edits needed from the integrator

- None required. Touched shared files outside my feature are only the to-do parts of `apps/web/src/api/queries.ts`, the to-do block of `DayView.tsx` / `day.css`, and the drizzle journal (a new entry appended after idx 3). If another branch also adds a migration, the journal entries and `when` values need to be ordered by the integrator; mine is `0004_todo_priority`, `when: 1791800000000`.
- `ui.css` / `primitives.tsx` were not edited. The to-do sheet uses `Segmented` and `ChipButton` as they are; `.tsheet-when .chip-btn` sets its own 44px height locally in `todos.css`.
