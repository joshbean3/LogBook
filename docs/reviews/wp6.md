# WP6 review: Journal, Progress, Reads (step 1 of WP6)

Branch `feel/wp6`, on `feel/pages-base` (`400f8f5`: WP1 merged, every contracts §F export at its final signature). Spec `docs/feel.md` v4.2 §8, §14 tests 4, 50, 51 (and 9a for the real Progress and Journal links); build plan §7 (this step: items 1, 2b, 3, 4, 5 and acceptance #1, #2, #3, #9, #10, #10b, #10c). Settings, onboarding and auth are the next step (see "Left").

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`. Everything below was measured on this worktree's `VITE_FAKE_CLOCK=1` build served by `apps/api` on port 8840 (seed copy `S/wp6/test.db`), Playwright 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch, at 1× and 4× CPU.

## How to rerun

- `bash S/wp6/build.sh && bash S/wp6/serve.sh` (the server reads `index.html` once: restart after every build).
- `node S/wp6/qa/run.mjs` runs every script at 1× and 4× and writes `S/wp6/qa/results/TABLE.md`; `ONLY=t50-journal node run.mjs`, `RATES=4`, `--table` as WP1's runner. The harness is WP1's `lib.mjs`, repointed; `seed.mjs` logs in through the API and adds journal entries and Reads links (idempotent) before the app's first fetch, so the persisted cache is never stale.
- Screenshots: `node S/wp6/qa/shots.mjs <390|320> <before|after>`.

## Commits

| Commit | What |
|---|---|
| `b1c3234` | Journal: NavBar; Journal · Library Segmented (32 px) pinned under the bar; two mounted, memoised panes crossfading 150 ms with the outgoing pane held still by a transform; each segment keeps its own offset; `nav.replace` / `useRootRequest` / `useHomeControl`; composer (17/22, Save pill at 40 %, growth by FLIP); `QuoteLine` in the composer; `gestures.ts` deleted; entries from cache; FLIP lists; `FavStar` / `popFav`; Library's empty favourites row; Reads row pushes `/journal/reads` |
| `d5a3349` | Reads: `PushedBar`, no react-router, tab crossfade, SwipeRow v2 rows without height presence, haptics and toasts by the grammar |
| `63e60f0` | Progress: NavBar; builds from the loaded months with a quiet gap (`weekSeries(…, loaded)` + unit test); verdict 20/25 600 sans; range `Segmented`; `nav.go` links; `Connect Strava` → primer sheet |
| `de770a8` | One press (`PressButton`, no `:active`), no attribute (size) animation in the chart, scrub ticks `select` only, a test-build hook on `drafts.ts` |
| `72c1991` | The hidden pane is `content-visibility: hidden` (no `inert` / `pointer-events` flip on the commit frame) |

## Files changed and why

- `features/journal/JournalView.tsx`: rebuilt on `NavBar`, segment as page state (contracts §A.2/§A.3), M28's crossfade with per-segment `scrollTop`.
- `features/journal/JournalHome.tsx`: `QuoteLine` (Favourite · Hide, Undo) in the composer; the swiping `PromptQuoteLine`, the ribbon's 220 ms hold and its always-on non-passive `touchmove` gone (one clock, gesture-scoped listener); memory card without swipe (hold menu, crossfade, keeps what it shows until "Another memory"); `Open the day` → `nav.go`; timeline from cache, skeleton only offline with nothing cached.
- `features/journal/JournalDaySection.tsx`: `Composer` (`grow="flip"`, 32 px Save pill, `success` only on the day's first entry, no plain toast), `SaveButton`, `FavStar` in sheets and rows, no `layoutId` / `markShared`, row buttons press.
- `features/journal/Library.tsx`: Reads row → `nav.push('/journal/reads')`; one 60 row "No favourites yet"; star pops on `complete` with `toggle` at the apex; FLIP list and form; search moved to the Themes section's action (Journal's trailing slot stays empty, §2.4).
- `features/journal/feel.ts`, `FavStar.tsx`, `PressButton.tsx`, `seg.css` (new): the FLIP carry (`carry`, `carryScaleY`, `measureBelow`, `useListFlip`), the favourite pop, the row press, the 32 px in-page Segmented.
- `features/journal/prompt.ts`: reads `?at=` from `window.location` (no react-router).
- `features/journal/drafts.ts`: a test-build-only `window.__drafts` hook.
- `features/journal/gestures.ts`: deleted (spec §8).
- `features/reads/ReadsView.tsx`, `TodaysPick.tsx`, `reads.css`: the pushed page on `PushedBar`; Unread · Read from `useRouteParams` as page state; rows on SwipeRow v2; the read mark's `toggle` on its peak; no "Copied" / "Saved to your reads" toasts.
- `features/progress/ProgressView.tsx`, `data.ts`, `data.test.ts`, `MileageChart.tsx`, `sheets.tsx`, `useScrub.ts`, `progress.css`: see commit `63e60f0` and `de770a8`.
- `api/queries.ts`, `api/types.ts`: untouched in this step.

## Acceptance (build plan §7.4; measured, `S/wp6/qa/results/TABLE.md`)

**70/70 checks pass at 1×; 60/60 at 4× (10 static gates counted once).** WP1's own smoke (`smoke-wp1.mjs`, unchanged but for the port) 22/22 at 1× and 4×.

| 7.4 | Check | 1× | 4× |
|---|---|---|---|
| #1 [50] | Journal at `scrollTop` 300 → Library → Journal: 300 ± 1 | 300 | 300 |
| | both panes in the DOM mid-fade | 8 frames both between 0 and 1 | 8 |
| | the incoming pane 0 → 1 | 133 ms (longest frame 17) | 217 ms (longest frame 83, see Requests 1) |
| | first fade frame after touchend | 38 ms | 29 ms |
| | outgoing pane drift while it fades | 0.00 px | 0.00 px |
| | pathname `/journal` ⇄ `/journal/library`, `history.length` unchanged; Library keeps its own offset (120); 0 haptics over 4 switches; lit tab on Library → Journal segment | pass | pass |
| #2 [51] | `GET /api/months/2026-09` never answered, fresh context: `.skel` count | 0 | 0 |
| | chart: bars from loaded months; gap weeks | 4 bars; 5 gap weeks (Aug 31 – Sep 28) | same |
| | verdict | Inter 20px/25px 600 normal | same |
| | range: Segmented 3 segments, 6M checked, 0 haptics; 32 tall with 44 px targets; scrollWidth 390 | pass | pass |
| #3 [4] | Journal scrolled 600 → Today → Journal | 600 | 600 |
| | Reads row → one `push:/journal/reads:journal` nav event, +1 history entry, `PushedBar` "Reads"; → Today → Journal: Reads still on top | pass | pass |
| | ~90 px swipe: rests at `translateX(-72px)`, `data-revealed`, action a `BUTTON` 64 tall × 72 on screen, 0 threshold | pass | pass |
| | still open 1.6 s later; a tap on the bar closes it and does nothing else | pass | pass |
| | 0.62 W swipe: row gone, exactly 1 `threshold` (+ `delete`), toast "Deleted · Undo"; Undo restores | pass | pass |
| | chevron → `/journal/library`, 0 layers | pass | pass |
| #10b [9a] | week sheet `Open in Plan` → Plan active from one frame to the next, `/plan/week/2026-10-26`, caps "Next week · Oct 26 – Nov 1" on that first frame, `history.length` 5 = 4 + 1, no sheet; one Back → Progress, sheet closed | pass | pass |
| | Consistency day → `/today/2026-10-21` (cut); Back → Progress | pass | pass |
| | Journal memory `Open the day` → `/today/2026-09-17`; Back → Journal | pass | pass |
| | `Connect Strava` → `.sheet` with the primer, Progress still active, `/progress`; Later closes it | pass | pass |
| #10c | typing → `hasDraft(today)` true, 40 `subscribeDrafts` calls; the Close card (`?at=20:30`) shows the same words; Save clears the draft, the entry lands first, exactly 1 `success`; the Close card no longer holds them | pass | pass |
| reduced | the switch is still an opacity crossfade (5 frames mid-fade), panes animate opacity only; the composer grows with no carried transform | pass | pass |
| #9, #10 | static (`t-gates.sh`): no react-router import and no `window.scrollTo` under journal/progress/reads; no name from WP1's "Delete at integration" list; no height animation; no `:active`; `--sp-primary` unused; `gestures.ts` gone; `toggle`/`orb` only through `hapticAtPeak`; `success` only in the Composer; every toast has Undo or names a failure | 10/10 | — |

Gates (final tree): `tsc --noEmit` shared/api/web exit 0; shared 88, api 59, web 87 passed (WP1's 86 + the missing-month test); `pnpm --filter @logbook/web build` ok (entry chunk 938.6 kB raw, seams 935.1: the Composer the Close card imports grew by the FLIP helpers and `FavStar`).

## Hand-verifiable steps (fake-clock build, phone-sized window, touch emulation)

1. Journal tab. Expected: caps `SAT, OCT 24` (the date), large `Journal`, a 32 px `Journal | Library` control, nothing in the bar's trailing slot.
2. Scroll the Journal down past the composer. Expected: the bar collapses to `Journal`, the segmented control stays pinned under it.
3. Tap Library, scroll a little, tap Journal. Expected: each switch is a short crossfade, nothing slides; each side comes back where you left it.
4. Type four lines in the composer. Expected: Save goes from a faint pill to full blue on the first letter; each new line pushes the card and everything below smoothly (no jump).
5. Save. Expected: the words leave, "Saved" with a check for a moment, the entry is first in Entries. No toast.
6. Hold the quote line inside the composer. Expected: `Favourite · Hide`; Hide shows a toast with Undo and a new quote.
7. Library → Reads. Expected: Reads slides over Journal with the chevron "Back to Journal"; swipe a link left a little: it rests open with a red Delete; tap anywhere else: it closes; swipe further: it goes, toast with Undo.
8. Progress. Expected: the verdict in the plain sans (not italic), `3M | 6M | 1Y` as one control; no skeleton ever. Tap a future week's bar → the week sheet → "Open this week in Plan": Plan appears at once on that week; Back returns to Progress.
9. Go offline for one month (devtools: block `/api/months/2026-09`), fresh profile, open Progress. Expected: the chart draws with a dashed gap where September is, the line broken there.

## Audit findings this step closes

| Finding | Status | Where |
|---|---|---|
| critic C13: Journal's segment switch scrolls and slides | Fixed | crossfade, per-segment offset, `window.scrollTo` gone (test 50) |
| newuser 3.5: entries skeleton when cached | Fixed | gate is `!list.data && !navigator.onLine` |
| evening #11, visual F19: the composer | Fixed | 17/22, `--ink-3` placeholder, 32 px Save pill at 40 %, FLIP growth |
| visual S8: Library's empty favourites | Fixed | one 60 row |
| navlive M1: Reads off the stack | Fixed | `/journal/reads` pushed over Journal (test 4) |
| critic C11, shell F11: Progress waits on unprefetched months | Fixed | builds from what is loaded; gap (test 51) |
| visual F18: Progress serif verdict, chip row | Fixed | 20/25 sans; `Segmented` |
| critic C8: toasts | Fixed in these features | Undo or errors only (gate #9) |
| motion: height presence animations (`rowPresence`) in Journal, Library, Reads | Fixed | FLIP on `settle`, opacity in |
| nav F10/F17, critic D5 (Settings); newuser 1.10 (Welcome) | Left | next WP6 step |

## Requests

1. **WP1 (`app/Shell.tsx`)**: `--hdr` is a custom property on `.tab-scroll`, and custom properties inherit, so every write that changes it restyles the whole tab subtree. A Journal segment switch that restores an offset across 0–44 pays a ~420-element restyle on the next frame (≈ 30 ms at 4×; it is most of the 4× crossfade's 217 ms against 150). Write `--hdr` on `.nb-bar` / `.nb-title` / `.nb-strip` only, or register it with `@property { inherits: false }` and set it where it is read.
2. **Contracts §A.2**: a pushed page has no way to mirror page state into its path (`nav.replace` is root-only). Reads' `Unread · Read` therefore reads `/journal/reads/read` once and is local state after. Either add `nav.replaceTop(path)` or document it.
3. **WP2**: `Composer` now fires `success` itself on the day's first entry (the Close card's Save is that save); the Close card must not fire a second. `ComposerProps.toast` is a no-op (marked deprecated). `QuoteLine`'s Hide also asks for another quote. `TodaysPick` (mounted by the Close card) no longer toasts "Saved to your reads".
4. **Spec §8**: two readings to confirm. (a) The Journal Segmented is pinned under the bar once scrolled (like Today's strip), so the switch is reachable at any offset (test 50 switches at 300). (b) The Journal composer's text is 17/22 like its placeholder (one size, no jump on the first keystroke).
5. **Spec §1.3 / §8**: Progress shows `Connect Strava` as a quiet drill row whenever Strava is configured and not connected (the empty state's button alone is unreachable once runs exist). It opens the primer sheet; Settings keeps its door.
6. **Device day one**: `content-visibility: hidden` on Journal's hidden pane needs Safari 18 / WKWebView 18; older WebKit falls back to `visibility: hidden` (`@supports`), which restyles the pane on a switch.
7. **WP1, Delete at integration**: journal, progress and reads no longer use `TabHeader`, `PushedHeader`, `TAB_RESELECT`, `ContextMenu preview`, `rowPresence`, `shared()`, `layoutId`, `pressScale`, `--sp-primary`. Settings and onboarding still do until the next step.

## Screenshots (looked at)

`S/wp6/qa/shots/{before,after}-{390,320}-{journal,journal-scrolled,library,reads,progress,progress-scrolled}.png`; `t51-cpu1-progress-gap.png` (the gap), `t04-cpu4-reads.png`, `t10b-primer-sheet.png`, `dbg-composer-typed.png`, `dbg-composer-saved.png`. No horizontal overflow at 390 or 320; console clean.

## Left (next WP6 step)

Settings (`SettingsView`, `SettingsSection` for `connections · app · data · account`, the `Plans ›` row, `Morning routine` → `useOpenRoutineEditor`, no ringed avatar; tests 25 and 7.4 #5, #6), onboarding (`Welcome` payoff with `FirstRunHero`, test 54, 7.4 #7), `/start` (7.4 #8), and the #9/#10 greps over `features/settings`, `onboarding`, `auth`.
