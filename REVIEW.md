# Fix team A (platform + foundation): fix-round review

Shots: `<S>/fixa/shots/` with `<S>` = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad`.
Scripts: `<S>/fixa/*.mjs` (Playwright, 390×844 and 320×568, DPR 2, touch via CDP). Server: port 8831, seed `test.db`.

Gates: `tsc --noEmit` (shared, api, web) clean · shared tests 79 pass · api tests 55 pass · web tests 17 pass · web build OK.

## Items

| # | Item | Change | Verification | Shots |
|---|---|---|---|---|
| C1 | Template replace + Undo | `POST /plans/template` soft-deletes replaced sessions, ends an overlapping block at start−1 (or soft-deletes one that had not started), answers `replacedIds`, `endedBlock?`, `endedBlocks`. New `POST /plans/template/undo`. (`services/plans.ts` `writeTemplate`/`undoTemplate`, `routes/plans.ts`) | `fixround.test.ts` › contract 1: live sessions + blocks after Undo equal those before the replace, row for row (ended and deleted cases); other users untouched; 422s | – |
| C2 | Block delete survives reload | `DELETE /blocks/:id` soft-deletes the block and only its unmarked, unkept sessions from today on; `POST /blocks/:id/restore` restores exactly those (shared timestamp). Bootstrap hides deleted blocks. | contract 2 tests: past done/missed and future done/floor/sick/skip stay visible with their blockId; restore returns the exact prior state; a separately deleted session stays deleted | – |
| C3 | Export / import | `GET /export` (v2, every table, lossless activities, attachment header); `POST /import` accepts v2 (idempotent by id, deterministic id renaming into another account, references follow) and still the artifact bundle (`services/exporter.ts`) | contract 3 test: full account → fresh account gives identical counts in all 16 parts; re-import adds nothing; broken v2 → 422 | – |
| C4 | Idempotent writes | `idempotency` middleware on every authed write (`lib/requests.ts`, table `idempotency_keys`, 24 h); client sends `Idempotency-Key` = queued item id (`api/client.ts`, `api/outbox.ts`) | contract 4 tests (replay, simultaneous twins, other users/keys, DELETE, expiry); `outbox.test.ts` (key per write, in-flight persisted, reload replays same key) | – |
| C5 | Miles without Strava | `packages/shared/src/miles.ts`: `sessionMiles`, `dayMiles`, `ranMiles`; `weekCheck`/`weekSummary`/`weekTotals` count logged runs; `loggedMiles`; optional `Snapshot.easyPace` | `miles.test.ts` (planned, floor at pace with cap, activity wins, ordering, week math, fresh-account Easy 4 → 4 mi). Live: last week's sheet now reads "2.2 mi" for a Floor with no activity | `after_week_sheet.png` |
| C6 | Account name | migration 0008 `users.name`; `PATCH /me { name }`; name on `/me`, `/auth/me`, bootstrap, login/signup | contract 6 test | – |
| C7 | Generic defaults | `NEW_ACCOUNT_MORNING` (Get ready 30 · Out the door 10, no smoothie/shower) used for accounts without a stored morning; `after.names` + `afterLabel`; zero-minute blocks skipped. `buildTemplate`: easy days vary 0.5–1 mi, long run strictly longest, lead-in gets the long run | `miles.test.ts` (morning), `templates.test.ts` (first-week variety, long-run day, tomorrow start), contract 7 API test; owner's stored routine unchanged | – |
| B2 | WeekRing | Continuous `--surface-3` track; arcs only on session days (done accent, floor warn, missed 1.5px red outline at 60%, skipped grey, future faint); rest = track; no dashes; kept count in the middle (stamp face) | Compared with `critic/shots/crop_ring.png`; gallery shows all states | before `before_ring_2026-10-11.png`, `before_today_2026-10-11.png`; after `after_ring_2026-10-11.png`, `after_ring_2026-10-14.png`, `after_gallery_rings_390.png`, `after_week_sheet.png` |
| B1 | Ghost previews | `ui/Ghost.tsx`: `GhostBars`, `GhostLines`, `GhostRows` (shapes only); `EmptyState` takes them or `'bars'|'rows'|'lines'`; dev warning when a ghost has text; gallery demos; foundation.md | gallery: every `.empty-ghost` has empty textContent, no overflow at 390/320 | before `before_gallery_empty.png`; after `after_gallery_empty_390.png`, `after_gallery_empty_320.png` |
| D-F1 | Toast follow-up wiped | `ui/toastStore.ts`: `act(id)` clears only that toast, then runs the action; ids are a counter | `toastStore.test.ts` (follow-up kept for its full 6.5 s, stale act ignored, timers) | – |
| D-F2 | Outbox duplicates | one key per write from first try to last replay; item persisted with `sentAt` before it is sent; server dedupes | `dup.mjs` (QA's ev3 scenario, 8 runs, reload 0–210 ms after reconnect): **0 duplicates, 0 lost**; run 0 shows the same key sent twice (replay after reload) and one row. Before: QA 3 of 4 runs duplicated | before `qa/shots/EV_D6_offline_duplicate.png`; after `after_offline_todos.png` |
| D-F3 | Toast over sheet actions | Toast host moves just above an open sheet's top edge (top of screen when no room); toast body is tap-through, only the action takes taps | at 390 the toast sits at y 395–439 above the sheet (sheet buttons 668–780); at 320 at y 99 | before `before_toast_over_sheet.png`; after `after_toast_over_sheet.png`, `after_320_toast_over_sheet.png` |
| P3 | Title flight | the flyer sits on the opener until the sheet's title row is on screen, then flies (450 ms fallback) | at 50 ms the sheet header is up and the title travels to it; before it floated alone over an empty page | before `before_flight_50.png`; after `after_flight_50.png`, `after_flight_120.png` |
| P15 | Keyboard-only focus rings | `ui/focus.ts` sets `<html data-input>`; `:root[data-input='pointer'] :focus-visible` drops outline and shadow rings | `focus.mjs`: the critic's path (tap ring → Escape → touch): ring `solid 2px` after Escape, `none` after the touch | `after_focus_escape.png`, `after_focus_touch.png` |
| TZ | Client a day ahead | client sends `X-Local-Date`; server `c.get('today')` (±2 days of its own) for every "today" default: habit createdOn/archivedOn, to-do Later default and window, template replace window, onboarding, daily pick, Reads pick | API test: all dated writes a day ahead are accepted and filed on that day; rebuild never removes the client's yesterday. Browser with clock installed one day ahead (`tz.mjs`): orb lights without reload, check and to-do filed on 2026-10-15 | `after_tz_ahead_orb.png` |

Reduced motion (`reduced.mjs`): ring drawn complete, no flyer, console clean. No horizontal overflow at 390 or 320. Console clean on every route visited.

## Hand-verifiable steps

1. `/dev/ui` → Week ring: five rings, no dashes; the kept count sits in the middle; the planned-only ring shows faint arcs with bare track between.
2. `/today/2026-10-11?at=10:00`: hero ring shows two amber arcs (Sat, Sun) and a red outline (Tue), "2" in the middle. Tap it: the sheet's 64 ring matches.
3. `/today/2026-10-13?at=10:00` → tap the hero → Skip: the toast appears above the sheet, the Move/Edit pills stay tappable; Undo puts the session back.
4. In the same sheet, close with Escape, then swipe the hero: the blue ring on the week ring disappears at the touch.
5. Offline (devtools), add two to-dos, go online and reload immediately: exactly two to-dos.
6. `curl -b cookies localhost:8831/api/export` → a v2 file; sign up another account and `POST /api/import` it: same counts.
7. `/dev/ui` → Empty states: the Progress, Journal and quote ghosts are bars and grey lines only.

## Requests for other teams

- **Fix C (plan)**: use `TemplateAppliedV2` from `POST /plans/template` and send it back to `POST /plans/template/undo` for the 8 s Undo; replace `useDeferredBlockDelete`'s client timer with `DELETE /blocks/:id` + `POST /blocks/:id/restore`. Kept sessions of a deleted block still carry its `blockId` (the block is no longer in the bootstrap): don't assume every `blockId` resolves.
- **Fix D (settings)**: Export = `GET /export` (save the body as the file); Import = `POST /import` with the file; `PATCH /me { name }` and `bootstrap.user.name` for the avatar initial.
- **Today / Share / Progress**: use `sessionMiles` / `dayMiles` (or `weekSummary.ranMiles`/`loggedMiles`) for MI, never a sum of activities. Pass the pace: `{ ...snap, easyPace: boot.morningSettings.run.pace }` or `sessionMiles(snap, d, s, { pace })`. Owner of `api/snapshot.ts`: add `easyPace` to `buildSnapshot`.
- **Progress, Journal, Reads**: swap ghosts to `GhostBars` / `GhostRows` / `GhostLines` (dev builds now warn about text in a ghost). Reads: drop the ghost rows.
- **Morning**: show block names with `afterLabel(settings, k)` and hide back-home blocks set to 0 in the routine editor (a new account has shower 0 and smoothie 0). Note the new account's last block is named "Out the door" while the run buffer is also "Out the door"; consider renaming the run buffer "Head out" if both show on a run morning.
- **Owner of the generic part of `api/queries.ts`**: `useMonths` keys its memo on `dataUpdatedAt`; with a frozen clock (Playwright `setFixedTime`, the critic's tool) two writes in the same millisecond look unchanged, which is the "stale until reload" the critic saw. Key the memo on the data objects (`results.map((r) => r.data)`) instead. With a running clock (real users ahead of the server) screens update; verified with `tz.mjs`.
- Out of scope, noticed: `POST /plans/apply` with `mode: 'replace'` (AI plans) still hard-deletes every session in its range, done history included.
- B7 (Promise screen before /login) touches `app/App.tsx` routing, which I own; it was not in this round's list. Happy to take it if asked.

## Files

Shared: `miles.ts` (new), `week.ts`, `status.ts`, `templates.ts`, `morning.ts`, `schemas.ts`, `types.ts`, `index.ts`, tests `miles.test.ts`, `templates.test.ts`.
API: `drizzle/0008_fix_round.sql` + journal, `db/schema.ts`, `auth.ts`, `index.ts`, `lib/requests.ts` (new), `services/plans.ts`, `services/exporter.ts` (new), `services/account.ts`, routes `plans.ts`, `core.ts`, `import.ts`, `me.ts`, `auth.ts`, `journal.ts`, `reads.ts`, tests `fixround.test.ts` (new), `platform.test.ts`.
Web: `api/client.ts`, `api/outbox.ts` (+ test), `ui/WeekRing.tsx`, `ui/Ghost.tsx` (new), `ui/primitives.tsx` (EmptyState), `ui/Toast.tsx`, `ui/toastStore.ts` (+ test), `ui/Sheet.tsx`, `ui/focus.ts`, `ui/index.ts`, `styles/foundation.css`, `styles/ui.css`, `app/dev/UiGallery.tsx`.
Docs: `docs/platform.md` §7–§14, `docs/foundation.md` (EmptyState ghosts, WeekRing, Sheet flight, Toast, `data-input`).
