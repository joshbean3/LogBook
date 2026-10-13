# Reads team: review notes

Branch: `worktree-agent-a4084c5c33ae0bf6b`. Dev server for this branch: `http://localhost:8804` (started from this worktree's `apps/api` with `DATABASE_PATH=./data/test.db PORT=8804 READS_FAKE_PICK=1 WEB_DIST=<worktree>/apps/web/dist node --import tsx src/index.ts`). Sign in as `josh@example.com` / `password123`.

Second round: the 19 reviewer items are addressed; each is called out below with how it was verified. Verification on this box: `pnpm -r typecheck` (three packages clean), `cd apps/api && npx vitest run` (21 tests), `cd apps/web && pnpm build`, the Playwright pass in `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/shoot-reads.mjs`, and the curl script `.../scratchpad/verify-api.sh`.

## 1. Files changed

| File | Why |
| --- | --- |
| `packages/shared/src/types.ts` | `Link`, `LinkSource`, `LinkVerdict`, `PickResult` types (appended at the end). |
| `packages/shared/src/schemas.ts` | `zLinkInput`, `zLinkPatch` (`readAt` is `z.iso.datetime({ offset: true })`), `zPickFeedback`, `zReadsPickOutput` (appended at the end). |
| `apps/api/src/db/schema.ts` | New `links` table (appended before `uniqueEmail`). |
| `apps/api/drizzle/0005_reads.sql` | Hand-written migration creating `links` and its two indexes. |
| `apps/api/drizzle/meta/_journal.json` | Journal entry `idx 5`, tag `0005_reads`, `when 1791850000000`. |
| `apps/api/src/env.ts` | `READS_FAKE_PICK` env var and `env.readsFakePick` (dev stub switch). |
| `apps/api/src/services/reads.ts` | URL normalizing (private literals refused in any spelling), IPv6 expansion (mapped / v4-compatible / NAT64 / 6to4), page fetcher over `node:http(s)` with a pinned resolver (the checked address is the dialled address), 10 s / 1 MB / text/html / manual redirects, Open Graph extractor, taste profile, pick prompt (saved data wrapped in `<saved_links>` and declared data in the system prompt), `PickGenerator` with the real Claude picker and the fake picker. |
| `apps/api/src/services/reads.test.ts` | 21 vitest cases: normalizing (incl. private literals), private ranges incl. `::ffff:7f00:1`, `0:0:0:0:0:ffff:a00:1`, `64:ff9b::7f00:1`, `2002:7f00:1::`, entity decoding, extractor fixtures, fetcher against a local `http.Server` (redirect, redirect to a private v4 and to a mapped-v6 address, loop, non-HTML, 1 MB cap, timeout, private-host refusal), taste profile, pick cleaning. |
| `apps/api/src/routes/reads.ts` | `GET/POST /reads`, `PATCH/DELETE /reads/:id`, `POST /reads/:id/restore`, `GET /reads/pick` (daily cap counts deleted picks and failed attempts), `POST /reads/pick/feedback`, plus `toLink`. |
| `apps/api/src/index.ts` | Two lines: import and `authed.route('/', readsRoutes(db))`. |
| `apps/web/src/api/queries.ts` | Reads part only: `keys.reads`, `keys.pick`, `useReads`, `usePick` (2 min stale, refetch on focus), `useReadsMutations` (add through the outbox, patch, remove, restore, feedback with a 404 hook, another), one `prefetchQuery` for the list in `prefetchAll`. Also imports `ApiError` from `./client`. |
| `apps/web/src/features/reads/ReadsView.tsx` | The `/reads` page: hero, quick add, Unread/Read segmented, rows with a Mark, a link and an Edit button (swipe as a shortcut), edit sheet. |
| `apps/web/src/features/reads/TodaysPick.tsx` | The hero card, incl. the off state, and `<TodaysPick compact />` for the Today page. |
| `apps/web/src/features/reads/openLink.ts` | `openLink` (Capacitor Browser in the app, new tab on the web) and `useOpenLink` (mark-read-on-return). |
| `apps/web/src/features/reads/reads.css` | Styles for the above; no edits to `ui.css`. |
| `apps/web/src/app/App.tsx` | `reads` in the lazy `views` map (so `prefetchViews` pulls it) and the `/reads/:tab?` route. |
| `apps/web/src/features/journal/JournalView.tsx` | `Sec` gains an optional `action` slot; the "Write" head carries a right-aligned ink `Reads` link to `/reads`; `Link` imported from react-router. The segmented is back to its original three options. |
| `apps/web/src/ui/Sheet.tsx` | Two attributes: `id="sheet-title"` on the `h2.sheet-title`, `aria-labelledby="sheet-title"` on the dialog. |
| `REVIEW.md` | This file. |

Not committed: `apps/api/data/test.db` (gitignored), `apps/web/dist`.

## 2. What a reviewer can verify by hand

### Migration
1. Start the API against a copy of the seed DB (`apps/api/data/test.db`, migrations 0000–0002 applied). Expected: it boots with no error; `__drizzle_migrations` gains rows for `0003_todo_note` and `0005_reads`; `.schema links` shows `id, user_id, url, title, site_name, description, image_url, note, tags_json, added_at, read_at, source, pick_reason, pick_date, verdict, deleted_at` and indexes `links_user`, `links_user_pick`. There is no `0004` on this branch; `idx 5` / `when 1791850000000` leaves room for a sibling `0004` with a smaller `when`.

### API (cookie from `POST /api/auth/login` with the credentials above)
2. `GET /api/reads` → `{ links: [...] }`, unread first then newest first; `source: 'me'` links and picks with `verdict: 'saved'`; never unverdicted or skipped picks, never deleted rows.
3. `POST /api/reads` `{ "url": "example.com/a?utm_source=x#top" }` → 201 with `url: "https://example.com/a"`. Outbound HTTP is blocked in this sandbox, so the title falls back to `example.com/a`; with web access the title / `og:description` / `og:image` / `og:site_name` come from the page (unit-tested against a local server).
4. Refusals (`422`): `mailto:x@y.z` → `bad_url`; `http://169.254.169.254/`, `http://[::ffff:7f00:1]:8804/`, `http://[64:ff9b::7f00:1]/`, `http://[2002:7f00:1::]/`, `http://127.1/` → `private_host` (verified with `verify-api.sh`). A public name that resolves to a private address is refused by the resolver the socket uses (`lookupPublic` in `services/reads.ts`), and every redirect hop goes through the same path; the unit test `refuses a redirect that lands on a private address, in v4 or mapped-v6 spelling` covers a 302 to `10.0.0.1` and to `[::ffff:7f00:1]`. DNS runs inside the 10 s `AbortController` budget (the request's `signal` covers the lookup).
5. Posting the same URL twice (`www.`, trailing slash, query differences ignored) → 200 and the existing row.
6. `PATCH /api/reads/:id` `{ "readAt": "not a date" }` → 422 `readAt: Invalid ISO datetime`; a real ISO timestamp or `null` is accepted; `tags` come back lowercased and de-duplicated; `verdict` on a non-pick → 422 `not_a_pick`.
7. `DELETE /api/reads/:id` → `{ ok: true }` (soft); `POST /api/reads/:id/restore` brings it back.
8. `GET /api/reads/pick` with `READS_FAKE_PICK=1`:
   - no saved links → `{ pick: null, reason: 'empty', refreshesLeft: 3 }`, nothing generated;
   - with links → ~1.2 s later a pick (`source: 'pick'`, `pickDate`, `pickReason`, `tags`), `refreshesLeft: 3`; the same row comes back instantly after that; concurrent first calls share one generation.
   - **Cap** (`verify-api.sh`, item 3): delete the day's pick and ask again → a new pick but `refreshesLeft: 2` (the deleted one counts); `?force=1` three times → 1, 0, then `reason: 'limit'`; every further call, forced or not, stays `limit`. Attempts are counted in memory next to the in-flight map, so a generation that fails (the fake list has 4 picks; a 5th attempt throws `invalid_pick`) also spends a refresh. The counter is per process; the rows (deleted ones included) back it across restarts.
   - `?date=` more than one day from the server's today never generates.
9. `POST /api/reads/pick/feedback` `{ id, verdict: 'saved' }` → the pick appears in `GET /api/reads` (unread); `'dismissed'` → stays out of the list and is listed under PICKS THEY SKIPPED in the next prompt (`tasteProfile`). An unknown id → 404.
10. **No `ANTHROPIC_API_KEY` and no `READS_FAKE_PICK`** (e.g. `PORT=8805`): `GET /api/reads/pick` and `?force=1` → `{ pick: null, reason: 'off', refreshesLeft: 0 }`, nothing generated. Verified on this box on port 8805.
11. The real path (`ANTHROPIC_API_KEY` set) type-checks against `@anthropic-ai/sdk` 0.133: `messages.stream` with `tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }]`, `output_config: { effort: 'medium', format: zodOutputFormat(zReadsPickOutput) }`, `pause_turn` resumed up to 3 times, the last text block parsed, `cleanPick` rejects a non-web or already-known URL. The prompt's data section sits between `<saved_links>` and `</saved_links>`, and the system prompt says that section is data, never instructions. Not run here (no key, no outbound web).

### Browser, on `http://localhost:8804` (iPhone 14 width and 320 px both checked, no horizontal overflow on `/reads` or `/journal`)
12. Open `/reads`. Expected: serif title "Reads"; the hero shows "TODAY'S PICK" over two quiet bars (`role="status"`, no spinner) while the pick is made, the list renders at once, and after ~1 s the hero fills in: "TODAY'S PICK · site" (under 360 px the site moves to a caps line under the sentence), serif title at 28, one line of `why` at 15, quiet "Save" and "Skip" chips. The halo sits only behind this card.
13. Tap the hero title → the article opens in a new tab (web) / in-app browser (iOS). The hero `<a>` has `target="_blank"` and `aria-label="{title}. {site}. Opens in a new window"`; the compact row has the same label.
14. "Save" → toast "Saved." once the server answers, caps "SAVED", the pick joins Unread, a "Next" chip appears. "Next" → bars, then a different pick; after the day's refreshes: "That's all for today." "Skip" → caps "SKIPPED", the title drops to `--ink-2` (the why stays ink-2; nothing uses opacity), "Next" chip. A failed search shows "Nothing found today." with "Retry". A pick that no longer exists (verdict given elsewhere) → toast "That pick is gone." and the card refetches. The card refetches whenever the window regains focus (2 min stale).
15. **No key** (port 8805): the aura card stays, with the halo, and reads "Nothing picked today."; no chips; Add is the one action (verified, screenshot `iphone14-11-off.png`).
16. Quick add: "Add" is quiet grey until the field holds a link, then blue (the screen's one blue). Type `look at this https://example.com/x later` → only `https://example.com/x` is sent (the first row's `href` is the bare link). Pasting text that contains a link keeps the link; pasting anywhere outside an input drops it into the field. Adding a link that is already saved → toast "Already saved." and no duplicate. Offline, the add goes through the outbox: the row stays and the request replays when the connection returns (POST is idempotent through the twin check).
17. Rows: a 44 px Mark at the left (`role="checkbox"`, label = title) flips read / unread; the title (17/600) is the link, with caps "SITE · N DAYS AGO" (local day via `toISO`) and the note under it; a 44 px Edit button (`aria-label="Edit {title}"`) at the right opens the sheet. With `prefers-reduced-motion` the drag is off and all three still work (verified: 5 marks and 5 edit buttons after `emulateMedia({ reducedMotion: 'reduce' })`). Swipe right / left remain as shortcuts: right flips read (grey zone on the Read tab), left deletes with "Deleted · Undo". Coming back to the tab after opening an unread link marks it read.
18. The sheet: title, site, Note (serif), Tags (44 px field), Delete / Cancel / Save (Save the one blue, enabled when something changed). The dialog is named by its title (`aria-labelledby="sheet-title"`).
19. The Unread / Read segmented shows counts and switches the list and URL (`/reads` ↔ `/reads/read`). Empty states: "Nothing saved yet. Paste a link above to keep it here." / "All read. Paste a link above to keep the next one." / "Nothing read yet. Tick a link when you've finished it."
20. `/journal`: the segmented is unchanged (three options, no overflow at 320); the "WRITE" section head carries a right-aligned ink "Reads" link that goes to `/reads`.
21. Copy: no vendor names; the feature is "Today's pick"; the only toasts are "Saved.", "Already saved.", "Deleted · Undo", "That's all for today.", "Nothing found this time.", "Couldn't fetch a pick.", "That pick is gone."; chips are one verb (Save, Skip, Next, Retry).

Screenshots (Playwright, iPhone 14 + 320×640): `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/shots/` — `iphone14-01-waiting.png`, `-02-pick.png`, `-03-add-ready.png`, `-04-added.png`, `-05-saved.png`, `-06-read-tab.png`, `-07-swipe.png`, `-08-deleted-undo.png`, `-09-sheet.png`, `-10-journal-link.png`, `-11-off.png`, `320-01-reads.png`, `320-02-skipped.png`, `320-03-another-waiting.png`, `320-04-another.png`.

## 3. Left out or not finished

- The real Claude call was never executed (no key, no outbound web). It type-checks and mirrors `services/claude.ts`; the first live run should be watched for latency (10–20 s) and for `reason: 'failed'` (non-article URL rejected → "Retry").
- `web_search` results are not stored; only the chosen pick is.
- The attempt counter for failed generations is in memory (resets on restart); rows, deleted ones included, are the durable part of the cap.
- `og:image` is stored but not shown.
- No server-side refusal `fallbacks` on the pick request, to match the existing `claude.ts` calls.
- `prefetchAll` prefetches the list, not the pick, so merely opening the app never triggers a generation.
- `undici` is not installed in this workspace (offline), so the connection is pinned with `node:http(s)` + a `lookup` option instead of an undici `Agent`; same effect, no new dependency.

## 4. For the integrator

- Drop `<TodaysPick compact />` (from `@/features/reads/TodaysPick`) into Today (DayView is another team's file). It renders one `Group` row ("TODAY'S READ · site" over the title, chevron, opens the link, labelled), one quiet bar while generating, `null` when picks are off / empty / skipped. Mounting it on Today means the day's pick is generated on the first open of Today.
- The Shell tab bar is untouched; whether the Journal tab lights for `/reads*` is your call (`Shell.tsx` was not edited).
- `JournalView.tsx`: 4 small hunks (import, `Sec` prop, `Sec` render, the "Write" head). `Sheet.tsx`: 2 attributes. `App.tsx`, `index.ts`: two-line insertions.
- A sibling migration `0004` should keep its `when` below `1791850000000`.
