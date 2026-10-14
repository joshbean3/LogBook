# Journal team review: Journal and Reads (spec §5.5–5.6)

Branch `worktree-agent-a917c268200c09841`. Served on port 8825 for QA. Screenshots live under
`/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/journal/`, written `S/…` below. The Playwright scripts that made them
(`before.mjs`, `look.mjs`, `interact.mjs`, `states.mjs`, `phases.mjs`, `flows.mjs`, `off.mjs`, plus `seed.sh` and `fresh.sh`
for data) are in the same folder.

## Files changed and why

| File | Why |
|---|---|
| `apps/web/src/features/journal/JournalView.tsx` | The page: `TabHeader` "Journal" with a Journal · Library `Segmented` whose content slides in the direction of the change (`springs.page`; a fade under reduced motion). `/journal/library` is the library; `/journal/quotes` and `/journal/favorites` land on it, scrolled to that section. Re-tapping the tab at the top returns to Journal. Holds "Write about it" (a quote goes on top of today's draft and the composer takes focus) and "Open in library" (library, then that quote's sheet). |
| `apps/web/src/features/journal/JournalHome.tsx` (new) | The Journal segment: the composer card (hero) with the quote line inside, the 14-day ribbon, the memory card, the entry timeline. |
| `apps/web/src/features/journal/Library.tsx` (new) | The Library segment: Reads card, favourites carousel, your quotes (inline add), quote library (theme chips, search, SwipeRow rows), and the quote sheet. |
| `apps/web/src/features/journal/JournalDaySection.tsx` | `Composer` (contract kept, props added), `SaveButton`, the entry sheet (read first; Edit pushes the editor), the day sheet, `EntryItem`, `JournalDaySection` (now uses the day prompt), shared actions (`useEntryActions`, `useOpenEntry`, `useOpenDay`, `markShared`, `shareText`, `addToDraft`). |
| `apps/web/src/features/journal/prompt.ts` (new) | `dayPrompt` / `useDayPrompt(date)`: the placeholder from `dayPhase` + the one status vocabulary; `useNow()` with the dev `?at=HH:MM` clock; `runStamp` (the run name a journal day wears). |
| `apps/web/src/features/journal/gestures.ts` (new) | `useCardSwipe` (swipe a card sideways to shuffle, `haptics.select()` on commit, `springs.settle` home), slide variants, one-time hint counter. |
| `apps/web/src/features/journal/journal.css` | Rewritten for the new structure. Timeline classes are `jtl-*` (Morning owns `.tl`). |
| `apps/web/src/features/reads/ReadsView.tsx` | `PushedHeader`; quick add on top; the pick; Unread · Read with sliding content; rows on `SwipeRow` + `ContextMenu` (Mark and Edit kept); empty states with one verb; named haptics. |
| `apps/web/src/features/reads/TodaysPick.tsx` | The hero only when a pick exists, else a slim card; `ContextMenu` on the hero; `compact` unchanged for Today. |
| `apps/web/src/features/reads/reads.css` | Slim card, edge-to-edge list, no more hand-rolled swipe underlay. |
| `apps/web/src/api/queries.ts` | Only inside `// ── journal ── … // ── /journal ──` (the journal, quotes, reads and pick hooks, which were already ours). Journal mutations now patch every cached entry list optimistically (add/patch/remove/restore), so the timeline answers before the server; `add` passes its provisional id to the outbox (`tmpId`) and resolves to the entry; `another` returns the item; a quote favourite refreshes the favourites list. Reads hooks unchanged. |

No server code touched: the SSRF guard, the reads API and the pick generator are as reviewed.

## Contracts

**Provided (kept, additive only):**
- `Composer` from `features/journal/JournalDaySection.tsx`: `date`, `today`, `rows?`, `size?: 'lg'` as before. New:
  `placeholder?: string` (use `useDayPrompt(date)` from `features/journal/prompt.ts`), `prompt?: (insert, text) => ReactNode`,
  `onSaved?: () => void`, `toast?: boolean` (default true), `autoFocus?`, `inputRef?`, `label?`. Saving fires
  `haptics.success()` and shows a check in place of Save for 1.4s. Without `placeholder` it reads "Two sentences on the day."
- `useDayPrompt(date)` (new, for Today's "Close the day" card): "Speed 5 done, 5.02 mi. How did it feel?", "Rest day. What did
  you do with it?", "Speed 5 still open. Two sentences, then sleep." (evening), etc.
- `TodaysPick` from `features/reads/TodaysPick.tsx` with `compact`: unchanged behaviour (one row, nothing when there is no pick).
- `JournalDaySection({ date, log })` still renders (Today can keep using it until it switches to `Composer` alone).

**Relied on:** `TabHeader`, `PushedHeader`, `Segmented`, `SwipeRow`, `ContextMenu`, `Pressable`, `EmptyState` v2, `Skeleton*`,
`Section`, Sheet v2 (`push`/`pop`, `eyebrow`, `layoutId` shared title), `Toast`, `springs`, `rowPresence`, `haptics.*`,
`dayPhase`, `sessionKey`, `label`, `TAB_RESELECT`.

## The page, top to bottom

**Journal**
1. Date line, serif "Journal", avatar; under it the Journal · Library switch.
2. **Composer** (the hero card, halo behind Save only): serif 22, grows with the words, placeholder from the day. Inside it,
   the **quote of the day** as one line (serif 17, ink-3, two lines max, author under it).
   - Tap the line: the quote goes into the entry as a prompt (`“…” (Author)`), caret after it; the line folds away.
   - Swipe it sideways: another quote slides in from the side you swiped (`haptics.select()`).
   - Hold: ContextMenu with a full-quote preview: Use as a prompt, Another quote, Favourite, Open in library, Hide (Undo).
   - First three visits: the line nudges 24px and back, with "Tap to write from it. Swipe for another." under it.
   - Save (the one blue, only with text; ⌘↵ too): `haptics.success()`, the field clears, Save becomes "✓ Saved", today's
     ribbon dot fills with a `springs.complete` pop, the entry expands into the top of the timeline (`springs.settle`).
3. **Ribbon**: 14 dots (filled = written, today ringed in blue) over weekday letters, and a line: "6 of the last 14 days,
   today included." Tap a dot: that day's entry sheet, the title flying from the dot (`entry-<date>`); a day with several
   entries opens a list; a day with none opens a composer for that day with its own prompt. Today's dot with nothing written
   focuses the composer. Press and slide along it to scrub: each day steps with `haptics.select()` and the line previews it;
   let go to open. Keyboard: one tab stop, arrows move, Enter opens.
4. **On this day / From your journal**: one inset card. "On this day · 2025 — A year ago" when an earlier year has an entry on
   this date, else the daily memory. Tap the words: the entry (title flies from the card's date). Swipe sideways: another
   memory. Hold: Another memory, Favourite, Open the day, Share. Hidden when there is no past entry.
5. **Entries**: section title with the count and a search button. Edge to edge, newest first; the stamped day number and
   weekday stand at the left of each day's first entry; hairlines between days. Meta: time, month (or month and year) when not
   this month, a run stamp (EASY 5, AFTERNOON RUN) on days with a run, a star when favourited. Tap: the entry sheet. Swipe
   left: Delete (`haptics.threshold()` at the line, `haptics.delete()`, "Deleted · Undo", the row collapses and comes back on
   Undo). Hold: Edit, Favourite, Share, Delete. "Show 30 older" at the end.
6. **Entry sheet**: eyebrow "3 days ago", title "Sun, Oct 11", the words in serif 22 to read, time and run stamp, then Edit
   (pushes the editor inside the sheet; Save is the one blue), Favourite, Share, Delete (Undo).

**Library**
1. **Reads** card (serif title, "2 unread · Today: <pick>") → pushes `/reads`.
2. **Favourites**: a carousel of favourite entries and quotes. Tap opens; hold: Write about it / Unfavourite (quotes), Unfavourite
   / Share (entries).
3. **Your quotes**: "+ Add" in the section head opens an inline form; rows as below, swipe left deletes (Undo re-adds it).
4. **Quotes**: theme chips (`haptics.select()`), search, the count, edge-to-edge rows. Tap: the quote sheet (eyebrow theme,
   title author, the quote, the work; Write, Favourite). Swipe right: Favourite (`haptics.toggle()`). Swipe left: Hide (Undo).
   Hold: both, plus Write about it.

**Reads** (pushed; back chevron and edge swipe from the frame)
1. Quick add on top: "Paste a link to keep", Add turns blue only with a link; a link pasted anywhere on the page lands in it.
2. The pick: the aura hero only when a pick exists (title links out, why, site; Save / Skip, then Next while refreshes last;
   hold: Open, Save, Skip, Next pick, Copy link). Otherwise a slim card: "Save links and Logbook finds you one a day." (nothing
   saved), "Finding today's pick" with two quiet bars (waiting), "Nothing new fit today." + Retry (failed), "That's all for
   today." (limit), "Daily picks are off. Your links still wait below." (off).
3. Unread · Read switch (counts), content slides. Rows: Mark (check draws, then the row moves over; "Marked read · Undo"), the
   title opens the link (read on return, as before), Edit (sheet: note, tags, Save, Delete). Swipe right: Read / Unread. Swipe
   left: Delete with Undo. Hold: Read, Open, Edit, Copy link, Delete.
4. Empty: ghost rows + "Links you keep wait here, unread first." + **Paste a link** (reads the clipboard, else focuses the
   field); "All read. The next link you keep lands here."; Read tab: "Links you finish move here." + **Show unread**.

## Verify by hand (port 8825, josh@example.com / password123; `S/seed.sh` adds entries, a quote and two links)

1. `/journal`: the composer is the first thing under the switch; on today (a rest day in the seed) it reads "Rest day. What did
   you do with it?". On an account with a run today, `?at=06:30` / `?at=12:00` / `?at=21:00` read "Out on Speed 5…", "Speed 5
   still to come…", "Speed 5 still open. Two sentences, then sleep."; marked done: "Speed 5 done. How did it feel?".
2. Swipe the quote line left: a new quote slides in from the right. Hold it: five items with a preview. Tap it: the quote is at
   the top of the field and the line folds away.
3. Type and Save: Save becomes "✓ Saved", today's dot fills, the entry is first in Entries. No toast.
4. Tap the Oct 11 dot: "Sun, Oct 11" sheet (title flies from the dot). Tap Oct 9: a composer for that day. Press and slide on
   the ribbon: the line under it names each day.
5. Tap the memory card: its entry. Hold it: Favourite, Open the day, Share.
6. Entries: swipe a row left past 40%: red Delete, release: row collapses, "Deleted · Undo"; Undo brings it back. Hold a row:
   Edit, Favourite, Share, Delete. Tap a row, then Edit: the editor pushes in with a back chevron.
7. Tap Library: content slides left. Reads card pushes `/reads`; back slides out to `/journal/library`.
8. Swipe a quote right: it shows a star and joins Favourites. Swipe left: hidden, Undo restores. Tap it, then Write: Journal,
   the quote in the field, the keyboard up.
9. `/reads`: quick add on top; with the fake picker on, the hero shows; Save marks it Saved and shows Next. Swipe a link right:
   it moves to Read ("Marked read · Undo"); swipe left: deleted with Undo. Hold: five items.
10. A fresh account (`S/fresh.sh`): Journal shows the ghost timeline and **Write today's** (focuses the composer); Library shows
    ghost favourites + Browse quotes, "Lines you want to keep…" + Add a quote; Reads shows the slim pick card and ghost rows +
    Paste a link.
11. 320×568: no horizontal scroll on any of the three pages; reduced motion: segment and shuffle are 150ms fades, drags work.

Automated results (latest run): console clean on every page and flow; `scrollWidth − innerWidth = 0` at 390 and 320;
haptic log per action: hold → `lift`, quote swipe → `select`, save → `success`, row delete → `threshold, delete`, quote
favourite swipe → `threshold, toggle`, read swipe → `threshold, toggle`, segment → `select`; keyboard: ribbon arrows + Enter,
Shift+F10 on the quote line opens its menu.

## Audit §2.7 Journal

| Problem | Status |
|---|---|
| The page's primary job sits under two blocks that aren't the user's content | **Fixed.** The composer is first, open, with a prompt built from the day. |
| Sub-pages are a segmented control 930pt down; the URL doesn't show them | **Fixed.** Journal · Library at the top under the title; `/journal/library` (and the old `/quotes`, `/favorites`) open the library, scrolled to the section. |
| Two quote concepts, two shuffles one card apart | **Fixed (Journal side).** One quote line, shuffled by swiping it; the memory shuffles by its own swipe or menu. Morning's "Word & quote" is the Morning team's (request below). |
| Quote sheet shows the author twice; Star is its only verb | **Fixed.** Author is the title only; the sheet shows the work, the theme as eyebrow, and Write + Favourite. |
| Entry sheet is an editor; entries can't be swiped; no calendar / on this day; no link to the run beyond "Open ›" | **Fixed:** the sheet reads first and pushes Edit; rows swipe to delete with Undo and have a menu; the 14-day ribbon and "On this day" card; run stamps on entries, "Open the day" in the memory menu. **Rejected for now:** tags and mood (no data model; would need API work outside this brief). |
| Favorites is two stacked lists with two empty states | **Fixed.** One carousel of entries and quotes, one empty state with a ghost and one verb. |
| The Reads link in the Write header | **Fixed.** A Reads card at the top of Library. |
| The quote library's Add chip floats alone | **Fixed.** "Your quotes" has its own section with "+ Add" in the head and an inline form. |

## Audit §2.8 Reads

| Problem | Status |
|---|---|
| No tab, no back, no lit tab | **Fixed** by the foundation route (`PushedPage`, Journal lit) plus `PushedHeader` here. |
| Only way in is a text link in Journal | **Fixed.** Library's Reads card; Today keeps the compact pick row. |
| 55% empty; the empty pick hero is the largest object | **Fixed.** The hero shows only with a pick; otherwise a 60px slim card. Empty list has ghost rows and one verb. |
| No share-sheet or clipboard intake | **Partly fixed.** Paste anywhere on the page, and "Paste a link" reads the clipboard. **Rejected here:** the iOS share-sheet extension is native (Capacitor) work outside this page. |

## Fixes 12 and 27

- **12** (composer first, prompt tied to today's run, entries under it, Library segment at the top, quote shrinks to one line): Fixed.
- **27** (Reads into Journal → Library, share-sheet / clipboard intake, compact pick on Today only when one exists): Fixed except the
  native share extension (above). The compact row already rendered only with a pick; kept.

Also removed, per §5.5: the Shuffle / Hide / Open chips, the quote hero card, the sub-tabs far down the page, the caps
"WRITE" and "FROM YOUR JOURNAL" section heads (section titles are sentence case now).

## Conscious decisions

- **Ribbon targets.** Fourteen 44px targets do not fit 320–390px. Each dot's hit area is its full column (21–25px × 56px), and
  the ribbon is also a scrubber: press anywhere and slide, the caption names the day under the finger, release opens it. The
  keyboard path is one tab stop with arrows. The QA script lists these as the only sub-44px targets on the three pages.
- **Hide is not red.** Hiding a quote is reversible and not a loss; it uses the neutral pane and `haptics.delete()` with Undo.
- **Your-quote Undo** re-adds the quote (the API has no restore for own quotes); it gets a new id.
- **Dev clock**: `?at=HH:MM` works on dev builds and on `localhost` builds (the QA build is a production bundle), never on a
  deployed host.
- **The ContextMenu's hidden "Actions" button** draws a 1px dot at a row's corner on black; I set it to `opacity: 0` until focused
  inside Journal and Reads only (still in the accessibility tree).

## Requests for other teams

1. **Today**: use `<Composer placeholder={useDayPrompt(date)} … />` in "Close the day" (`useDayPrompt` is exported from
   `features/journal/prompt.ts`); `toast={false}` if the card shows the entry itself. `JournalDaySection` keeps working meanwhile.
2. **Foundation**: (a) `.cm-sr` shows a 1px coloured dot at its anchor on black (`position: absolute; width/height 1px`); consider
   `opacity: 0` until `:focus-visible` globally. (b) In `.list-edge`, `.list-edge > .cm-target > :first-child` (0,3,0) outranks
   `.list-edge .swipe-row { padding-inline: 0 }` (0,2,0), so a SwipeRow directly in a list-edge gets the gutter twice (on the
   row and its content). I override it in `journal.css` for my lists.
3. **Morning**: its "Word & quote" is a second quote concept (audit §2.7); consider reading `useDaily().quote` so the day has one.

## Screenshots

Before (`S/before/`): `journal-390.png`, `journal-390-full.png`, `journal-quotes-390-full.png`, `journal-favorites-390-full.png`,
`reads-390-full.png`, `reads-read-390-full.png`, and the same at 320.

After, overview (`S/final/`): `journal-390.png`, `journal-390-full.png`, `library-390-full.png`, `reads-390-full.png`,
`reads-read-390-full.png`, and `*-320*.png`.

After, states and gestures (`S/after/`):
`01-journal-390` · `02-quote-menu` · `03-quote-shuffled` · `04-quote-inserted` · `05-composer-ready` · `06-saved-beat` ·
`07-saved-in-timeline` · `08-ribbon-entry-sheet` · `09-ribbon-empty-day` · `10-ribbon-scrub` · `11-memory-entry-sheet` ·
`12-entry-sheet` · `13-entry-edit-pushed` · `14-entry-menu` · `15-entry-swipe-armed` · `16-entry-deleted-toast` ·
`17-segment-sliding` · `18-library` · `19-library-favourited` · `20-quote-sheet` · `21-reads` · `22-reads-menu` ·
`23-reads-swipe-read` · `24-reads-after-read` · `25-reads-read-tab` · `26-open-in-library` · `27-write-about-it` ·
`28-quote-hidden-toast` · `29-library-favourites` · `30-fresh-journal` · `31-fresh-library` · `32-fresh-reads` ·
`33-fresh-reads-read` · `34-day-composer-cross` · `35-phase-morning` · `36-phase-done` · `37-reads-pick-off` ·
`40-journal-320` · `41-journal-320-full` · `42-library-320-full` · `43-reads-320-full` · `50-reduced-segment-mid` ·
`51-reduced-library` · `60-today-journal-section`.

## Gates

`pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` clean;
`pnpm --filter @logbook/shared test` 59 passed; `pnpm --filter @logbook/api test` 35 passed; `pnpm --filter @logbook/web build` passes.
