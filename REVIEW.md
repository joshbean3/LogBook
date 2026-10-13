# Reads team: review notes

Branch: `worktree-agent-a4084c5c33ae0bf6b`. Dev server for this branch: `http://localhost:8804` (started from this worktree's `apps/api` with `DATABASE_PATH=./data/test.db PORT=8804 READS_FAKE_PICK=1 WEB_DIST=<worktree>/apps/web/dist node --import tsx src/index.ts`). Sign in as `josh@example.com` / `password123`.

## 1. Files changed

| File | Why |
| --- | --- |
| `packages/shared/src/types.ts` | `Link`, `LinkSource`, `LinkVerdict`, `PickResult` types (appended at the end). |
| `packages/shared/src/schemas.ts` | `zLinkInput`, `zLinkPatch`, `zPickFeedback`, `zReadsPickOutput` (the model's output shape) (appended at the end). |
| `apps/api/src/db/schema.ts` | New `links` table (appended before `uniqueEmail`). |
| `apps/api/drizzle/0005_reads.sql` | Hand-written migration creating `links` and its two indexes. |
| `apps/api/drizzle/meta/_journal.json` | Journal entry `idx 5`, tag `0005_reads`, `when 1791850000000`. |
| `apps/api/src/env.ts` | `READS_FAKE_PICK` env var and `env.readsFakePick` (dev stub switch). |
| `apps/api/src/services/reads.ts` | URL normalizing, private-network guard, page fetcher (10 s, 1 MB, text/html, manual redirects), Open Graph extractor, taste profile, pick prompt, the `PickGenerator` interface with the real Claude picker (web search + structured output) and the fake picker. |
| `apps/api/src/services/reads.test.ts` | 18 vitest cases: normalizing, private ranges, entity decoding, extractor on inline fixtures, fetcher against a local `http.Server` (redirect, loop, non-HTML, 1 MB cap, timeout, private-host refusal), taste profile, pick cleaning. |
| `apps/api/src/routes/reads.ts` | `GET/POST /reads`, `PATCH/DELETE /reads/:id`, `POST /reads/:id/restore`, `GET /reads/pick`, `POST /reads/pick/feedback`, plus `toLink`. |
| `apps/api/src/index.ts` | Two lines: import and `authed.route('/', readsRoutes(db))`. |
| `apps/web/src/api/queries.ts` | Reads part only: `keys.reads`, `keys.pick`, `useReads`, `usePick`, `useReadsMutations` (add, patch, remove, restore, feedback, another), and one `prefetchQuery` for the list in `prefetchAll`. |
| `apps/web/src/features/reads/ReadsView.tsx` | The `/reads` page: hero, quick add, Unread/Read segmented, swipeable rows, long-press edit sheet. |
| `apps/web/src/features/reads/TodaysPick.tsx` | The hero card (and `<TodaysPick compact />` for the Today page). |
| `apps/web/src/features/reads/openLink.ts` | `openLink` (Capacitor Browser in the app, new tab on the web) and `useOpenLink` (mark-read-on-return). |
| `apps/web/src/features/reads/reads.css` | Styles for the above; no edits to `ui.css`. |
| `apps/web/src/app/App.tsx` | `reads` added to the lazy `views` map (so `prefetchViews` pulls it) and the `/reads/:tab?` route. |
| `apps/web/src/features/journal/JournalView.tsx` | One line: a fourth `Reads` segment that navigates to `/reads`. |
| `REVIEW.md` | This file. |

Not committed: `apps/api/data/test.db` (gitignored), `apps/web/dist`.

## 2. What a reviewer can verify by hand

Setup once: `pnpm install --offline`, `pnpm -r typecheck` (all three packages pass), `cd apps/api && npx vitest run src/services/reads.test.ts` (18 pass), `cd apps/web && pnpm build`.

### Migration
1. Start the API against a copy of the seed DB (`apps/api/data/test.db`, which has migrations 0000–0002 applied). Expected: it boots with no error, and `__drizzle_migrations` gains rows for `0003_todo_note` and `0005_reads`; `sqlite> .schema links` shows the table with `id, user_id, url, title, site_name, description, image_url, note, tags_json, added_at, read_at, source, pick_reason, pick_date, verdict, deleted_at` and indexes `links_user`, `links_user_pick`. Note there is no `0004` on this branch; `idx 5` / `when 1791850000000` was chosen so another team's `0004` (with a smaller `when`) still sorts before it.

### API (cookie from `POST /api/auth/login` with the credentials above)
2. `GET /api/reads` → `{ links: [...] }`, unread first, then newest first. Includes links with `source: 'me'` and picks with `verdict: 'saved'`; never unverdicted or skipped picks, never deleted rows.
3. `POST /api/reads` `{ "url": "example.com/a?utm_source=x#top" }` → 201 with `url: "https://example.com/a"` (scheme added, fragment and `utm_*` dropped). In this sandbox outbound HTTP is blocked, so the title falls back to `example.com/a` and `siteName` to `example.com`; on a machine with web access the title / `og:description` / `og:image` / `og:site_name` are filled from the page (covered by the unit tests against a local server).
4. `POST /api/reads` with `{ "url": "mailto:x@y.z" }` → 422 `bad_url`. With `{ "url": "http://127.0.0.1:8804/" }` or `http://10.0.0.1/` → 422 `private_host` (the fetcher refuses loopback / private / link-local / multicast for every redirect hop, resolving DNS first).
5. Posting the same URL twice (or with `www.` / trailing slash / query differences) → 200 and the existing row, not a duplicate.
6. `PATCH /api/reads/:id` `{ "readAt": "<iso>" | null, "note": "...", "tags": ["Running","base"] }` → tags come back lowercased and de-duplicated. `verdict` on a non-pick → 422 `not_a_pick`.
7. `DELETE /api/reads/:id` → `{ ok: true }` (soft delete); `POST /api/reads/:id/restore` brings it back unchanged.
8. `GET /api/reads/pick` with the server started with `READS_FAKE_PICK=1`:
   - with no saved links: `{ pick: null, reason: 'empty', refreshesLeft: 3 }` (nothing to learn from, nothing generated);
   - after at least one link is saved: ~1.2 s later `{ pick: { source: 'pick', pickDate: '<today>', pickReason: '...', tags: [...] }, reason: null, refreshesLeft: 3 }`; a second call returns the same row instantly (cached in `links` by `pick_date`); two concurrent first calls share one generation (in-memory in-flight map).
   - `?force=1` three times → a new pick each time with `refreshesLeft` 2, 1, 0; the fourth → the current pick with `reason: 'limit'`. So: one automatic generation per day plus at most 3 manual refreshes.
   - `?date=` more than one day away from the server's today never generates.
9. `POST /api/reads/pick/feedback` `{ id, verdict: 'saved' }` → the pick now appears in `GET /api/reads` (unread). `verdict: 'dismissed'` → it stays out of the list and is listed in the next prompt as a negative example (see `tasteProfile` in `services/reads.ts`).
10. **No `ANTHROPIC_API_KEY` and no `READS_FAKE_PICK`** (e.g. `DATABASE_PATH=./data/test.db PORT=8805 node --import tsx src/index.ts`): `GET /api/reads/pick` and `?force=1` both return `{ pick: null, reason: 'off', refreshesLeft: 0 }` with 200; nothing is generated; the UI hides the hero. Verified on this box. Everything else on `/reads` keeps working without a key.
11. The real path (`ANTHROPIC_API_KEY` set, no fake flag) type-checks against `@anthropic-ai/sdk` 0.133: `messages.stream` with `tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }]`, `output_config: { effort: 'medium', format: zodOutputFormat(zReadsPickOutput) }`, `pause_turn` resumed up to 3 times, the last text block parsed as JSON, then `cleanPick` rejects a non-web URL or anything already known. It could not be run here (no key, no outbound web).

### Browser, on `http://localhost:8804` (iPhone 14 width and 320 px both checked, no horizontal overflow)
12. Open `/reads`. Expected: serif title "Reads"; the hero card shows "TODAY'S PICK" over two quiet grey bars while the pick is made (no spinner), the list below renders immediately, and after ~1 s the hero fills in with "TODAY'S PICK · <site>", the title in the serif at 28, one line of `why` at 15, and quiet "Save" and "Skip" chips. The halo sits only behind this card.
13. Tap the hero title. Expected: the article opens in a new tab (web) / the in-app browser (iOS). The hero's `<a>` has `target="_blank"`.
14. Tap "Save". Expected: toast "Kept. It's in your list.", the top-right caps reads "SAVED", the pick appears at the top of Unread, and an "Another" chip appears. Tap "Another" → the bars return, then a different pick. After three refreshes the chip gives way to "That's all for today." (`?force=1` limit).
15. Reload with a fresh day's state (delete rows where `source='pick'`) and tap "Skip". Expected: caps "SKIPPED", the body dims, an "Another" chip appears; the skipped pick never enters the list.
16. Quick add: type or paste a URL into "Paste a link". Expected: "Add" is quiet grey while the field is empty or not a link and turns blue (the screen's one blue) once a link is in it; pasting a block of text that contains a link keeps only the link; pasting anywhere on the page outside an input drops the link into the field. Press Add → the field clears and a row appears at the top of Unread at once (title = hostname until the server answers). A bad link puts the text back and shows the server's message in a toast.
17. Rows: title 17/600, caps "SITE · N DAYS AGO", the note under it. Tap a row → opens the link; when you come back to the tab (focus / visibilitychange, or `browserFinished` in the app) the row moves to Read. Swipe right ≥ 56 px → a blue check zone, then the row moves to Read (on the Read tab the same swipe marks it unread, grey zone). Swipe left → red delete zone, the row goes, toast "Deleted · Undo"; Undo restores it in place.
18. Press and hold a row (~0.5 s) → a sheet with the title, site, a Note field (serif), a Tags field, Delete / Cancel / Save (Save is the sheet's one blue, enabled only when something changed).
19. The Unread / Read segmented shows counts and switches the list and the URL (`/reads` ↔ `/reads/read`); empty states name the state and offer one verb.
20. `/journal` → the segmented now has a fourth "Reads" segment; tapping it navigates to `/reads` (that is the only change to `JournalView.tsx`).
21. Copy check: no vendor names anywhere in the UI; the feature is called "your daily pick" / "Today's pick".

Screenshots from this run (Playwright, iPhone 14 + 320×640): `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/shots/` (`iphone14-01-waiting.png`, `-02-pick.png`, `-03-add-ready.png`, `-05-saved.png`, `-06-read-tab.png`, `-07-swipe.png`, `-08-deleted-undo.png`, `-09-sheet.png`, `320-01-reads.png`, `320-02-skipped.png`, `320-04-another.png`).

## 3. Left out or not finished

- The real Claude call was never executed (no key, no outbound web in this environment). It type-checks and follows the same SDK pattern as `services/claude.ts`; the first live run should be watched for (a) the model returning a non-article URL (rejected → `reason: 'failed'`, retryable with "Try again") and (b) latency, since web search + structured output is 10–20 s.
- `web_search` results are not stored; only the chosen pick is. No citations are surfaced.
- The schema has two columns the brief did not list: `pick_date` (the day a pick was offered; the daily cache key, independent of UTC `added_at`) and `deleted_at` (soft delete so Undo restores the exact row, matching journal/sessions).
- The page fetcher does not pin the connection to the resolved IP, so a DNS-rebinding host that answers public on lookup and private on connect is not blocked; it is checked on every redirect hop, which covers the realistic cases.
- `og:image` is stored but not shown (rows stay text-only on purpose).
- Server-side refusal `fallbacks` were not added to the pick request, to stay consistent with the existing `claude.ts` calls.
- `prefetchAll` prefetches the reads list, not the pick (so merely opening the app never triggers a generation). The pick is requested when Reads opens, or wherever `<TodaysPick compact />` is mounted.

## 4. For the integrator

- Drop `<TodaysPick compact />` (from `@/features/reads/TodaysPick`) into Today (DayView is another team's file). It renders a single `Group` row ("TODAY'S READ · site" over the title, chevron, opens the link), returns `null` when picks are off / empty / skipped, and shows one quiet bar while generating. Mounting it on Today means the day's pick is generated on the first open of Today rather than of Reads.
- The Shell tab bar is unchanged: Reads is reached from the Journal segmented (and `/reads` directly). If you want it in the tab bar, that is a `Shell.tsx` edit (not mine).
- If another branch adds migration `0004`, keep its `when` below `1791850000000` and both apply in order; `idx` values do not need to be contiguous for drizzle's migrator.
- `apps/api/src/index.ts` and `App.tsx` edits are two-line insertions; `JournalView.tsx` is a one-line change to the segmented options (Team A is restyling Journal; the merge should be trivial).
