# WP1 review: shell and navigation foundation

Branch `feel/wp1`, on `claude/hopeful-einstein-eunarl` (WP5 merged there; nothing of it undone). Spec `docs/feel.md` v4.2 §1, §2, §9–§14; build plan §2; contracts §A–§E, §G. This file replaces WP5's review (that one lives on at `scratchpad/feel/wp5-review.md`).

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`. Everything below was measured on this worktree's `VITE_FAKE_CLOCK=1` build served by `apps/api` on port 8791 (seed copy `S/wp1/test.db`), Playwright 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch, at 1× and 4× CPU (`Emulation.setCPUThrottlingRate`).

## How to rerun

- Build and serve: `bash S/wp1/build.sh && bash S/wp1/serve.sh` (the server reads `index.html` once: restart after every build).
- The battery: `node S/wp1/qa/run.mjs` runs every script of `S/wp1/qa/` at 1× and 4× (`CPU=<rate>` per run) and prints the table below (also written to `S/wp1/qa/results/TABLE.md`, with each run's log in `results/<script>.cpu<rate>.log`). `ONLY=t02-cut,t13-pager node run.mjs` runs a subset, `RATES=4` one rate, `--table` rebuilds the table from the result files.
- Screenshots: `node S/wp1/qa/shots.mjs <390|320> <after|before>` (before = the base build, served from the temporary worktree `S/wp1/before-wt`, removed after use; rebuild it with `git worktree add --detach … claude/hopeful-einstein-eunarl` and `VITE_FAKE_CLOCK=1 npx vite build`).

## What WP1 built (commits, oldest first)

| Commit | What |
|---|---|
| `e8b0cf1` | `api/queries.ts` cut into `// ── WP<n> ──` blocks, behaviour-free |
| `472c1e8` | every contract module of §A–§E with its final types (`lib/gesture.ts`, `lib/motion.ts`, `hapticAtPeak`, `ui/nav.ts` + tests, `lib/keyboard.ts`, `hideSplash`, `stravaSyncNow`/`useStravaChecking`) |
| `662e906`, `00fab91`, `9de2a49`, `a34029f` | the shell: `NavController` (the one owner of history), four mounted tab scrollers, `PushedLayer`, the tab switch on pointerup, the interim `RouterBridge` and old pages as roots, the splash on the first content frame |
| `39f117f`, `53d8603` | `useDrag` on the new vocabulary; the flyer's destination rect |
| `24ea127`, `aa24cae`, `56af101`, `35aef43`, `d0a7581`, `af7c241`, `fe915b3`, `d2f9576` | the one press, the one hold, the cut-out menu, Sheet v3 with `sheetY` as its one owner, toasts placed from the sheet store, SwipeRow v2, Segmented without a haptic, Mark/WeekRing on the press |
| `2526960`, `4fec564`, `15e7b38`, `69d8427`, `a134ed6` | DayPager v2, NavBar v2 (bar, word, fading date, strip, disc), WeekRing (marked, missed gap), Segmented in-bar, the gallery and its pager lab |
| QA step (`7bf3a60`) | see "Fixed in the QA step" |
| review round 1 | see "Review round 1" (every finding of the three reviews, fixed or rejected, with its check) |

### Fixed in the QA step (every failure of the battery was treated as a defect)

| Defect (how it showed) | Fix (file) |
|---|---|
| #2 the tab cut took 21.8 ms (1×) / 62.6 ms (4×) on the old pages: every URL change re-rendered every tab's old page, because `<Routes location>` still calls `useLocation()` on the window's router before it applies the override | `RouteAt` pins a memoised location per tab root and per layer; layers memoised on their entry (`app/Shell.tsx`) |
| #2 the cut's frame restyled both tabs' subtrees: `visibility`/`inert` are inherited, and an attribute inside `:not()` makes Blink restyle the whole subtree (measured: an unused `data-x` 0 ms, `data-leaving` inside `:not()` 10 ms at 4×) | positive selectors only; the tab being left keeps painting under the new one for the cut's frame and takes `visibility: hidden` + `inert` in the task after it (`[data-leaving]`); the tab under a pressing finger is prepared under the active one in the task after the pressed frame (`[data-preparing]`, undone on drag-off/cancel), so pointerup only moves a `z-index`; tab items memoised with a stable handler (`app/Shell.tsx`, `app/shell.css`) |
| #18 `useStravaChecking()` was still false on the first frame after `visibilitychange` (react-query notifies a task later) | non-quiet `stravaSyncNow` calls are also counted in a store read with `useSyncExternalStore` (`api/queries.ts`, WP1 block; its import sits inside the block so the shared header is untouched) |
| #13 the 1 px rule: a pointerdown that completed a landing spring hit the page while it was still an inert neighbour, so the browser aimed its click at the pager: a dead tap on a page that had visibly landed | the click of a pointer that completed a spring is sent on to the element now under the point (`ui/DayPager.tsx`) |
| SwipeRow full delete at 4×: the rows below jumped 41.5 of 52 px in one step (the spring's clock counted the long frame after the removal) | the FLIP's settle spring starts on the frame that paints the inverse (`ui/SwipeRow.tsx`) |
| #19 the pushed bar's chevron sat at x −12…32 (an old header rule's −12 px margin): 12 px of its 44 px target off the screen | `.pushed-bar .back-btn { margin-left: 0 }` (`styles/foundation.css`) |
| #19 the large title (`.nb-title`) was a 40 px target (§2.3: each of the title block's three parts is 44 tall) | the 4 px above the 34/40 line moved from margin to padding: same geometry, a 44 px target; its stacked labels follow (`styles/foundation.css`) |
| `PushedHeader` still rendered its old body (a serif large title with a motion `layoutId`), not `PushedBar` as contracts rule 5 requires | the adapter renders `PushedBar` (+ `.pushed-tools` for children); only a caller that overrides Back (none today) keeps the old body (`ui/headers.tsx`) |
| Today's selected tab icon was a bare dot (the Sun drawn with `stroke: none` loses its rays) | filled disc, rays kept (`app/Shell.tsx`) |
| The gallery's NavBar demos painted over the gallery's own sticky bar when scrolled under it (both z 20) | demos at `z-index: auto` (`app/dev/gallery.css`) |
| #24 had no subject: the gallery had no orb on `hapticAtPeak` | the gallery's Orb section: one `complete` pop to 1.12, `orb` on the apex frame; reduced motion: a 150 ms fill, `orb` on its last frame (`app/dev/UiGallery.tsx`, `gallery.css`) |
| The gallery imported `Link` from react-router inside the frame (contracts rule 2) and listed stale routes (`/morning` as a tab, `/reads`) | rows are Pressables calling `nav.go` on the §1.2 routes and two redirects; the WeekRing caption no longer says "a red outline" (`app/dev/UiGallery.tsx`) |
| #22 the stub sheet had no `header` to prove `useTab()`/`useToast()` there | `header` probe on the stub sheet (`app/dev/StubRoots.tsx`) |

The harness itself was also corrected where it measured itself: samplers now stamp a frame at its start (they used to stamp after their own `getComputedStyle` work, adding 2–30 ms to every "first frame" number), the #24 orb is read from its motion values' own change events (a style sample posted from rAF can land a frame late), and runs pair 1×/4× checks by id.

## Review round 1 (three reviews of `7bf3a60`: code, consumer, feel)

The reviews are `S/wp1/review-code-1.md` (C#), `S/wp1/review-consumer-1.md` (U#) and `S/wp1/review-feel-1.md` (F#). The full record is `S/wp1/fix-1.md`: each finding, then what was done, then the proof.

How each finding of severity 3 or more was proved:
- it has a Playwright check in `S/wp1/qa/r1-*.mjs`, which is part of the battery (section `R1`);
- the check was run first on the unfixed logic, and failed there (`S/wp1/qa/results-r1-before/`);
- it passes after the fix.

| Finding | Status | Fix | Check: before → after |
|---|---|---|---|
| C1 [5] an interrupted pop-all wedges the tab (ghost layer, dead root) | Fixed | **PushedLayer.** Every `leave(done)` waiter is kept and answered `left` or `came home`.<br>**One removal path.** `removeLayers` takes the layers off as they leave and repairs the URL after a catch.<br>**Pop-all.** A second pop-all rides along.<br>**Edge band.** Measured from the shown edge.<br>**Hit testing.** Only `.pushed` takes pointers in `.stack-host`. | `r1-popall` 4/12 → 12/12 (1×, 4×) |
| F3 [3] the lit-tab tap at depth 2 sweeps the middle page across | Fixed | A two-layer pop covers the depth-1 page; the top layer drives the root's offset and scrim | band frames 23/27 → 0; root error 0.00 px |
| C2 [4] a 2–7 page goTo leaves its far date as the neighbour | Fixed | The override is cleared with the goTo: on commit, on a home settle and on a host date change | 10-26 → 10-24 on all three paths |
| C3 [3] `data-pressed` stuck after a captured drag | Fixed | `usePress` follows its pointer on window and ends the press on another element's `gotpointercapture`; the delegate does the same | the title and chevron stayed pressed → nothing pressed |
| C4 [3] `nav.replace` under a sheet or menu overwrites the overlay entry | Fixed | Deferred until the overlays are released, then written onto the page's own entry | `/today` (stale) → `/today/2026-10-24`, no overlay flag |
| C5 [3] reduced motion: the parent jumps 117 px | Fixed | The parent stays at x 0 under reduced motion; only the scrim fades | 117 → 0.0 px |
| U1 [4] a hold-then-drag in a pager page also pages it | Fixed | A drag-capable hold claims its pointer (`pointerClaimed`). The pager, the edge pop, the sheet drag and pull to refresh let a claimed pointer go. The hero (no drag) still pages | track 391 px plus 1 commit → 0 px, 0 commits |
| U5 [3] pull to refresh under a hold-then-drag | Fixed | The same claim | REFRESH 1 → 0 |
| U2 [4] medium of [medium, large]: the body's end and foot cannot be reached | Fixed | `--sheet-inset` on a snap; the keyboard over medium goes to large | Save at y 1200 → on screen and hit-testable |
| U3 [3] the first tap on a revealed swipe action is eaten | Fixed | The swallow is reset on every pointerdown | no commit → committed |
| U4 [3] contract springs end unitless values on frame one | Fixed (+ request) | `forRange` in `lib/motion.ts`, used by the Ticker and the ring fill | Ticker's 1.0 snap → steps ≤ 0.3; ring 2 → ≥ 6 dash states |
| U6 [3] `useIsActiveTab` re-renders on every NavState change | Fixed | A boolean selector; the chevron's parent title is a selector too | 4 / 4 / 2-each renders → 0 / 1 + 1 / 0 |
| U7 [3] `/journal` and `/journal/library` deliver the same params | Fixed | `/journal/library` has `{ segment: 'library' }` (unit test added) | `{}` ×3 → distinct; a cold start reads it |
| F1 [3] a sheet flick freezes at release (4×) | Fixed | **Cause.** The release's back traversal re-rendered the old pages through react-router's route context: a 115 ms task.<br>**Fix.** `RouteAt` resets `RouteContext`, and the sheet releases its entry when it is gone | first write after release +147 → +17 ms (4×) |
| F2 [3] a tall sheet drops 336 px when the keyboard comes | Fixed | A sheet over 80 % keeps its top; its body pads by `--kb` | top 10→346→10 → 10 on every frame |
| F4 [3] the push spring starts before the page paints | Fixed | The push starts in motion's frame step after the mount, one frame in, then two | first visible frame: 45 % (Settings) and 74 % (This morning) gone → 4 % at 4× |
| F5 [3] sheet open at 4× over 70 ms | Partly fixed, open | WP1's two forced layouts are gone (H and the safe top are cached). The body's render and layout remain; request to WP2 | +78 → +63.7–108.6 ms (4×); 1× +16–18 ms |
| C6 [2] `--chrome-h` scaled under the recede | Fixed | Measured from `offsetTop` | 144 against 157 → equal |
| C7 [2] a `data-no-page` tap after a swipe loses its click | Fixed | The swallow is reset on every pointerdown | 0 → 1 click |
| C8 [2] no headings | Fixed | The large title and the pushed bar's title are level-1 headings | 0 → an h1 on every root and on Settings |
| C9 [2] focus on push and pop | Fixed | The push focuses the new page's title; the pop returns focus to the opener | BODY → `H1 Settings` → avatar |
| C10 [2] dead title buttons, invisible dim, the hidden inline title takes taps | Fixed | Text when there is no action; a relative dim; the inline title takes pointers only when collapsed | see `r1-a11y` |
| C11 [2] `useTabScroller` in a pushed page | Fixed | `PushedScrollerScope` | `tab-scroll` → `pushed` |
| C12 [1] the NavBar label effect runs on every render | Fixed | Bound dependencies | — |
| C13 [1] / F6 [2] the grabber: 24 px, no keyboard path | Fixed | The grabber row (minus its buttons) cycles the detents; a two-detent sheet's grabber is a named button | medium → large; Enter cycles |
| U8 [2] the `.pressable` reset outranks feature CSS | Fixed | `:where(.pressable)` | `today-hero` padding 0 → 18px |
| U9 [2] Segmented shows no press | Fixed | Delegated press; the label dims | — → pressed, 0.55 |
| U10 [2] `stravaSyncNow` reuses failed or quiet promises | Fixed | A rejection clears it; a quiet sync never stands in for a non-quiet one | 1 → 2 requests, the status line shows |
| U11 [1] contract gaps | `.page-root` added; the two others rejected | The header slot's content (and its crossfade) is the caller's; toast placement is by design | — |
| F7 [2] the first switch at 4× is one 67 ms frame | Rejected (not WP1's) | The interim pages' restyle. Stub roots: +38–54 ms on both builds today | — |
| F8 [2] release velocity depends on input spacing | Rejected (spec-bound) | §9.2 names `x.getVelocity()`. Frame-paced input reads −1420…−1463 for a 1500 px/s finger. Spec request: a sampled tracker; device check | `r1-misc` f8 |
| F9 [1] mid-drag labels overprint | Rejected (spec as written) | §2.3; a design note for the device check | — |
| F10 [1] the pushed bar's avatar sits 2 px from the edge | Fixed | Pushed bar `60 1fr 60` with a 16 px trailing gutter | right edge 390 → 374 (= the root bar) |
| F11 [1] the edge swipe re-bases at the lock | Fixed | x0 stays at pointerdown (§9.3) | layer at 110 → 120 for a finger 12 → 132 |

Side effects seen in the screenshots, all of them the CSS that was meant to apply (U8):
- The unselected tab labels are now `--ink-3`, as `shell.css` says. They were inheriting white.
- The interim Today hero has `.today-hero`'s 18 px padding.
- The interim Plan's block card has its own padding, so its caps are no longer clipped at the left edge (feel review 1 listed that under WP4).

Checks changed this round:
- `t09 #10`'s "x follows the finger after the lock" encoded the old re-base. It now checks §9.3's `clientX − x0`, with x0 at pointerdown: 154.6 against 154.5.
- `r1-push`'s first frame reads the layer's style writes per rAF frame, because a sampler posted from rAF runs late at 4×.
- `r1-press`'s Ticker bound is the last step (the rest snap) ≤ 0.2 and no frame step above 0.5. Before the fix the snap was 1.0.

Flakes seen this round:
- `t14 14a` failed once in 10 runs. Once it was the tab item's first-frame press (not reproduced in 9 reruns). Once it was `.gal-p-scale`'s clear, which landed in a 26.9 ms frame (frame cadence).
- `#2·interim` at 4× reads 51.6–94.9 ms on the new build and 54.8–103.1 ms on the pre-fix build, both measured today.

## The acceptance battery (build plan §2.5, every numbered test)

Final run after review round 1 (`node qa/run.mjs` over every script at `CPU=1` and `CPU=4`; the `R1` rows are the review-round-1 checks, `qa/r1-*.mjs`; then `r1-push`, `r1-press` and `t09-push` rerun after their checks were corrected, see "Review round 1"). Per test:

| §2.5 | checks | 1× pass | 4× pass |
|---|---|---|---|
| E2E | 22 | 22/22 | 22/22 |
| 1 | 6 | 6/6 | 6/6 |
| 2 | 18 | 18/18 | 18/18 |
| 2·interim | 14 | 14/14 | 12/14 |
| 3 | 6 | 6/6 | 6/6 |
| 4 | 8 | 8/8 | 8/8 |
| 5 | 2 | 2/2 | 2/2 |
| 6 | 14 | 14/14 | 14/14 |
| 7 | 8 | 8/8 | 8/8 |
| 8 | 9 | 9/9 | 9/9 |
| 9 | 13 | 13/13 | 13/13 |
| 10 | 9 | 8/8 | 9/9 |
| 11 | 5 | 5/5 | 5/5 |
| 12 | 21 | 21/21 | 20/21 |
| 13 | 41 | 41/41 | 41/41 |
| 14 | 46 | 46/46 | 46/46 |
| 15 | 8 | 8/8 | 8/8 |
| 16 | 10 | 10/10 | 10/10 |
| 17 | 22 | 22/22 | 22/22 |
| 18 | 12 | 12/12 | 12/12 |
| 19 | 20 | 20/20 | 20/20 |
| 20 | 25 | 25/25 | 25/25 |
| 21 | 24 | 24/24 | static |
| 22 | 20 | 20/20 | 20/20 |
| 23 | 13 | 13/13 | 13/13 |
| 24 | 10 | 10/10 | 10/10 |
| 25 | 5 | 5/5 | 5/5 |
| item 9 | 10 | 10/10 | 10/10 |
| R1 | 70 | 70/70 | 69/70 |
| **all (excl. 2·interim)** | 477 | 476 | 451/453 |

At 1× every check passes (476/476 run). At 4× all pass but two, both the time to the first frame of a sheet's opening:
- **#12a**: +74.4 ms against ≤ 70. This is the 40-paragraph stress sheet, open since the QA step.
- **R1 f5**: +98.5 ms. This is the Plan session sheet, which is feel review 1 #5, partly fixed.

See the notes. `2·interim` is not counted (see the note). `#10` has one check that only runs at 4×: the catch of a push needs the slower frame to land the touch in the moving band.

Every check with its measured numbers. A check's name carries the 1× bound where the rates differ. The 4× column was judged against the 4× bound:
- ≤ 34 / 68 ms for #1;
- ≤ 50 for #2;
- ≤ 70 for #12;
- ≤ 500 / 550 ms for #13's rests and `goTo`;
- the 4× budgets in #14.

Each 4× log in `qa/results/<script>.cpu4.log` prints its own bound. `item 9` is SwipeRow v2 (build plan §2.2 item 9); its `sw2` arm/disarm count is #15.

<details><summary>The full table (477 checks + 14 interim, 1× and 4×)</summary>

| §2.5 | script | check | 1× | 4× |
|---|---|---|---|---|
| E2E | smoke | login lands on Today | PASS /today | PASS /today |
| E2E | smoke | tab Plan | PASS /plan | PASS /plan |
| E2E | smoke | tab Progress | PASS /progress | PASS /progress |
| E2E | smoke | tab Journal | PASS /journal | PASS /journal |
| E2E | smoke | tab Today | PASS /today | PASS /today |
| E2E | smoke | avatar opens Settings | PASS /settings | PASS /settings |
| E2E | smoke | Settings shows its rows | PASS  | PASS  |
| E2E | smoke | Settings › Training | PASS /settings/training | PASS /settings/training |
| E2E | smoke | Training page shows | PASS  | PASS  |
| E2E | smoke | back to Settings | PASS /settings | PASS /settings |
| E2E | smoke | back to Today | PASS /today | PASS /today |
| E2E | smoke | This morning from Today | PASS /today/2026-10-23/morning | PASS /today/2026-10-23/morning |
| E2E | smoke | This morning shows its schedule | PASS  | PASS  |
| E2E | smoke | Back from This morning lands on Today | PASS /today | PASS /today |
| E2E | smoke | Reads from Journal | PASS /journal/reads | PASS /journal/reads |
| E2E | smoke | Journal tab stays lit on Reads | PASS  | PASS  |
| E2E | smoke | /settings/plans loads | PASS /settings/plans | PASS /settings/plans |
| E2E | smoke | a sheet opens | PASS 1 | PASS 1 |
| E2E | smoke | a hold menu opens on the hero | PASS 8 | PASS 8 |
| E2E | smoke | Escape closes it | PASS  | PASS  |
| E2E | smoke | /dev/ui loads as a pushed page over Today | PASS /dev/ui | PASS /dev/ui |
| E2E | smoke | console clean | PASS [] | PASS [] |
| 1 | t01-press | 1 data-pressed in the first sampled frame (≤ 17 ms) | PASS 13.6 ms, pressed=true | PASS 16.6 ms, pressed=true |
| 1 | t01-press | 1 scale below 1 by the second frame (≤ 34 ms) | PASS 30.3 ms, scale 0.9843 | PASS 28.1 ms, scale 0.9843 |
| 1 | t01-press | 1 scale reaches 0.97 ± 0.002 by 140 ms | PASS 63.6 ms (scale at 140: 0.9700) | PASS 61.9 ms (scale at 140: 0.9700) |
| 1 | t01-press | 1 touchend clears data-pressed within 16 ms (1 frame at 1x; 4x: the switch budget, 50) | PASS 15.9 ms | PASS 25.9 ms |
| 1 | t01-press | 1 no haptic on a tab tap | PASS [] | PASS [] |
| 1 | t01-press | 1 console clean | PASS [] | PASS [] |
| 2 | t02-cut | 2 [stub roots] the first frame that shows Plan begins within 17 ms of touchend (rAF frame start) | PASS +16.4 ms | PASS +31.3 ms |
| 2 | t02-cut | 2 [stub roots] presented frames (screencast; informational): the cut and a trivial change through the same pipeline | PASS cut presented at +24.5 ms, a one-element change at +19.3 ms (Δ 5.2 ms) | PASS cut presented at +39.8 ms, a one-element change at +13.9 ms (Δ 25.9 ms) |
| 2 | t02-cut | 2 [stub roots] no ancestor of the active page below opacity 1 on any frame | PASS min 1 | PASS min 1 |
| 2 | t02-cut | 2 [stub roots] no opacity animation on a .tab | PASS max 0 | PASS max 0 |
| 2 | t02-cut | 2 [stub roots] zero black frames in the 600 ms after | PASS 0 of 14 frames (max black share 0.58) | PASS 0 of 14 frames (max black share 0.58) |
| 2 | t02-cut | 2 [stub roots] pathname /plan | PASS /plan | PASS /plan |
| 2 | t02-cut | 2 [stub roots] console clean | PASS [] | PASS [] |
| 2 | t02b-black | 2 push (avatar → Settings): zero black frames in the 600 ms after | PASS 0 of 35 frames (max black share 0.71) | PASS 0 of 39 frames (max black share 0.71) |
| 2 | t02b-black | 2 push (avatar → Settings): the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 62 frames | PASS min opacity 1, tab opacity animations 0 over 90 frames |
| 2 | t02b-black | 2 pop (the chevron): zero black frames in the 600 ms after | PASS 0 of 33 frames (max black share 0.71) | PASS 0 of 36 frames (max black share 0.71) |
| 2 | t02b-black | 2 pop (the chevron): the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 60 frames | PASS min opacity 1, tab opacity animations 0 over 88 frames |
| 2 | t02b-black | 2 day swipe (stub pages): zero black frames in the 600 ms after | PASS 0 of 54 frames (max black share 0.12) | PASS 0 of 55 frames (max black share 0.12) |
| 2 | t02b-black | 2 day swipe (stub pages): the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 90 frames | PASS min opacity 1, tab opacity animations 0 over 127 frames |
| 2 | t02b-black | 2 sheet open: zero black frames in the 600 ms after | PASS 0 of 34 frames (max black share 0.69) | PASS 0 of 36 frames (max black share 0.68) |
| 2 | t02b-black | 2 sheet open: the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 60 frames | PASS min opacity 1, tab opacity animations 0 over 81 frames |
| 2 | t02b-black | 2 sheet close: zero black frames in the 600 ms after | PASS 0 of 31 frames (max black share 0.69) | PASS 0 of 28 frames (max black share 0.68) |
| 2 | t02b-black | 2 sheet close: the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 53 frames | PASS min opacity 1, tab opacity animations 0 over 136 frames |
| 2 | t02b-black | 2 console clean | PASS [] | PASS [] |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] the first frame that shows Plan begins within 17 ms of touchend (rAF frame start) | PASS +13.6 ms | FAIL +68.4 ms |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] presented frames (screencast; informational): the cut and a trivial change through the same pipeline | PASS cut presented at +23.8 ms, a one-element change at +20.4 ms (Δ 3.4 ms) | PASS cut presented at +85.2 ms, a one-element change at +23.4 ms (Δ 61.8 ms) |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] no ancestor of the active page below opacity 1 on any frame | PASS min 1 | PASS min 1 |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] no opacity animation on a .tab | PASS max 0 | PASS max 0 |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] zero black frames in the 600 ms after | PASS 0 of 14 frames (max black share 0.77) | PASS 0 of 12 frames (max black share 0.77) |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] pathname /plan | PASS /plan | PASS /plan |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] console clean | PASS [] | PASS [] |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] the first frame that shows Plan begins within 17 ms of touchend (rAF frame start) | PASS +11.8 ms | FAIL +71.6 ms |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] presented frames (screencast; informational): the cut and a trivial change through the same pipeline | PASS cut presented at +2.1 ms, a one-element change at +8.4 ms (Δ -6.3 ms) | PASS cut presented at +84.6 ms, a one-element change at +30.6 ms (Δ 53.9 ms) |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] no ancestor of the active page below opacity 1 on any frame | PASS min 1 | PASS min 1 |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] no opacity animation on a .tab | PASS max 0 | PASS max 0 |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] zero black frames in the 600 ms after | PASS 0 of 19 frames (max black share 0.77) | PASS 0 of 16 frames (max black share 0.77) |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] pathname /plan | PASS /plan | PASS /plan |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] console clean | PASS [] | PASS [] |
| 3 | t03-scroll | 3 Plan keeps scrollTop 300 across Today | PASS 300 | PASS 300 |
| 3 | t03-scroll | 3 Journal keeps scrollTop 600 across Today | PASS 600 | PASS 600 |
| 3 | t03-scroll | 3 Reads pushed on Journal | PASS /journal/reads | PASS /journal/reads |
| 3 | t03-scroll | 3 Journal → Reads → Today → Journal: Reads still on top | PASS {"path":"/journal/reads","pushed":1} | PASS {"path":"/journal/reads","pushed":1} |
| 3 | t03-scroll | 3 no remount: the Plan root is the same node | PASS  | PASS  |
| 3 | t03-scroll | 3 console clean | PASS [] | PASS [] |
| 4 | t04-reselect | 4 both layers unmount on the rest frame of one spring | PASS 30 moving frames; gone at +597 ms | PASS 30 moving frames; gone at +652 ms |
| 4 | t04-reselect | 4 pathname /today | PASS /today | PASS /today |
| 4 | t04-reselect | 4 the pop path changed on the unmount frame | PASS /today | PASS /today |
| 4 | t04-reselect | 4 a cold-start stack pops with replaceState (history.length unchanged) | PASS 3 → 3 | PASS 3 → 3 |
| 4 | t04-reselect | 4 second tap scrolls to 0 within 400 ms | PASS 0 at +350 ms after pointerup | PASS 0 at +350 ms after pointerup |
| 4 | t04-reselect | 4 a third tap does nothing | PASS {"before3":{"p":"/today","len":3,"n":1},"after3":{"p":"/today","len":3,"n":1,"top":0}} | PASS {"before3":{"p":"/today","len":3,"n":1},"after3":{"p":"/today","len":3,"n":1,"top":0}} |
| 4 | t04-reselect | 4 no haptic | PASS [] | PASS [] |
| 4 | t04-reselect | 4 console clean | PASS [] | PASS [] |
| 5 | t09-push | 5 push: scrollWidth 390 and document never scrolls, every frame | PASS sw 390 sh 844 | PASS sw 390 sh 844 |
| 5 | t09-push | 5 edge swipe: scrollWidth 390 and no document scroll, every frame | PASS  | PASS  |
| 6 | t06-listeners | 6 at rest on today: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 at rest on plan: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 at rest on progress: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 at rest on journal: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 during a push: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 at rest on a pushed page: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 during a sheet drag: no touchmove on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 Today at rest: no touchmove on its scroller | PASS [] | PASS [] |
| 6 | t06-listeners | 6 during a Today pull: one non-passive touchmove on the Today scroller | PASS [{"passive":false}] | PASS [{"passive":false}] |
| 6 | t06-listeners | 6 during a Today pull: none on document | PASS {"doc":[],"win":[]} | PASS {"doc":[],"win":[]} |
| 6 | t06-listeners | 6 after the pull: the scroller listener is gone | PASS [] | PASS [] |
| 6 | t06-listeners | 6 during a day swipe (stub pages): no touchmove on document or window | PASS {"doc":[],"win":[]} | PASS {"doc":[],"win":[]} |
| 6 | t06-listeners | 6 after the day swipe: none on document | PASS [] | PASS [] |
| 6 | t06-listeners | 6 console clean | PASS [] | PASS [] |
| 7 | t07-keyboard | 7 --kb reads 336px within 100 ms | PASS 336px after 8 ms | PASS 336px after 40 ms |
| 7 | t07-keyboard | 7 html.kb-open set | PASS true | PASS true |
| 7 | t07-keyboard | 7 tab bar visibility hidden | PASS hidden | PASS hidden |
| 7 | t07-keyboard | 7 nothing above the field changes its rect | PASS 0 moved; field top 214 → 214 | PASS 0 moved; field top 214 → 214 |
| 7 | t07-keyboard | 7 only the page bottom padding grows | PASS 24px → 310px | PASS 24px → 310px |
| 7 | t07-keyboard | 7 documentElement.clientHeight unchanged | PASS 844 → 844 | PASS 844 → 844 |
| 7 | t07-keyboard | 7 keyboard down: --kb 0px, kb-open off, tab bar back | PASS {"above":["32,16,326,34","16,58,358,0","32,58,122,44","162,58,112,44","32,110,105,44","145,110,94,44","247,110,76,44","32,162,90,44","130,162,96, | PASS {"above":["32,16,326,34","16,58,358,0","32,58,122,44","162,58,112,44","32,110,105,44","145,110,94,44","247,110,76,44","32,162,90,44","130,162,96, |
| 7 | t07-keyboard | 7 console clean | PASS [] | PASS [] |
| 8 | t08-history | 8 avatar pushes Settings | PASS {"path":"/settings","len":3,"idx":1,"active":"today","todayStack":["/settings"]} | PASS {"path":"/settings","len":3,"idx":1,"active":"today","todayStack":["/settings"]} |
| 8 | t08-history | 8 back on Today, Settings still stacked | PASS {"path":"/settings","len":5,"idx":3,"active":"today","todayStack":["/settings"]} | PASS {"path":"/settings","len":5,"idx":3,"active":"today","todayStack":["/settings"]} |
| 8 | t08-history | 8 the chevron's pop: /today on the pop's rest frame | PASS unmount frame 36: /today | PASS unmount frame 37: /today |
| 8 | t08-history | 8 history.length unchanged by the pop (the replaceState branch: its entry is not on top) | PASS 5 → 5 | PASS 5 → 5 |
| 8 | t08-history | 8 Back then lands on /plan with Plan shown and Today’s stack empty | PASS {"path":"/plan","len":5,"idx":2,"active":"plan","todayStack":[]} | PASS {"path":"/plan","len":5,"idx":2,"active":"plan","todayStack":[]} |
| 8 | t08-history | 8 cold start: Settings and Training stacked, each idx −1, nav.idx kept | PASS {"path":"/settings/training","len":5,"idx":0,"active":"today","todayStack":["/settings","/settings/training"]} | PASS {"path":"/settings/training","len":5,"idx":0,"active":"today","todayStack":["/settings","/settings/training"]} |
| 8 | t08-history | 8 chevron twice: /settings then /today | PASS /settings then /today | PASS /settings then /today |
| 8 | t08-history | 8 history.length unchanged, the app never navigates away | PASS 5 → 5 → 5 | PASS 5 → 5 → 5 |
| 8 | t08-history | 8 console clean | PASS [] | PASS [] |
| 9 | t09-push | 9 .pushed with translateX < 390 appears | PASS lx 375.7 | PASS lx 375.7 |
| 9 | t09-push | 9 parent translateX = −0.3 × (390 − x) ± 2 on every frame | PASS max error 0.00 px over 48 frames | PASS max error 0.00 px over 50 frames |
| 9 | t09-push | 9 depth-1 scrim = 0.12 × (1 − x/390) ± 0.02 on every frame | PASS max error 0.0000 | PASS max error 0.0000 |
| 9 | t09-push | 9 tab bar top 794 on every frame | PASS [794] | PASS [794] |
| 9 | t09-push | 9 parent visible on every frame | PASS  | PASS  |
| 9 | t09-push | 9 parent inert only after rest | PASS moving frames inert: 0; at rest inert: true | PASS moving frames inert: 0; at rest inert: true |
| 9 | t09-push | 9 push at rest in ≈ 460 ms (≤ 500) | PASS 450 ms from the first moving frame | PASS 450 ms from the first moving frame |
| 9 | t09-push | 9 at rest a pixel of the pushed page is its own colour (20,40,60) ± 3 | PASS [20,40,60] | PASS [20,40,60] |
| 9 | t09-push | 9 console clean | PASS [] | PASS [] |
| 9 | t09b-depth2 | 9 depth 2: scrim[data-depth=2] = 0.12 × (1 − x/390) ± 0.02 on every frame of the push | PASS max error 0.0000 over 50 frames | PASS max error 0.0000 over 49 frames |
| 9 | t09b-depth2 | 9 depth 2: paint order pushed(1) · scrim(2) · pushed(2) (each with its shadow under it), no z-index, pointer-events none | PASS {"kids":["pushed1","scrim2","pushed2"],"z":["auto","auto","auto"],"pe":"none","s1":"scrim1 between the scroller and .stack-host"} | PASS {"kids":["pushed1","scrim2","pushed2"],"z":["auto","auto","auto"],"pe":"none","s1":"scrim1 between the scroller and .stack-host"} |
| 9 | t09b-depth2 | 9 depth 2 held at x ≈ 195: the scrim dims the depth-1 page (left) and not the depth-2 page (right) | PASS {"held":"190.0","leftOn":"5.80","leftOff":"6.23","rightOn":"62.75","rightOff":"62.75"} | PASS {"held":"190.0","leftOn":"5.80","leftOff":"6.23","rightOn":"62.75","rightOff":"62.75"} |
| 9 | t09b-depth2 | 9/14 console clean | PASS [] | PASS [] |
| 10 | t09-push | 10 edge drag: parent = −0.3 × (390 − x) ± 2 on every frame | PASS max error 0.00 over 77 frames; max x 108 | PASS max error 0.00 over 79 frames; max x 108 |
| 10 | t09-push | 10 released slow under 0.35 W → back to 0, still pushed | PASS {"n":1,"lx":0,"px":-117,"scrim":0.12,"bar":794,"vis":"visible","inert":true,"sw":390,"sh":844,"ih":844,"path":"/dev/ui","t":1688.1999999999998} | PASS {"n":1,"lx":0,"px":-117,"scrim":0.12,"bar":794,"vis":"visible","inert":true,"sw":390,"sh":844,"ih":844,"path":"/dev/ui","t":1740.7000000014905} |
| 10 | t09-push | 10 parent visible while dragged | PASS  | PASS  |
| 10 | t09-push | 10 a fast edge swipe pops; unmount and pathname change on the same frame | PASS unmount frame 48, path frame 48 | PASS unmount frame 49, path frame 49 |
| 10 | t09-push | 10 the pop of an own entry uses history.back (length unchanged) | PASS 3 → 3 | PASS 3 → 3 |
| 10 | t09-push | 10 a touch 10.7 px inside the moving edge stops the push within a frame | PASS x at touch 97.1; next frames 94.5, 94.5, 94.5 | PASS x at touch 78.5; next frames 64.9, 64.9, 64.9 |
| 10 | t09-push | 10 then x follows the finger 1:1 after the 10 px lock (≤ 1 px from clientX − x0, x0 at pointerdown) | PASS x 154.6 vs 154.5 | PASS x 124.9 vs 124.9 |
| 10 | t09-push | 10 the released layer rests at 0 or W, never between | PASS none | PASS 0 |
| 10 | t09-push | 10 a tap on the chevron at x 20 (moved 4 px) pops | — | PASS /today |
| 11 | t11-flyer | 11 frame 1 of the push: source hidden and one .flyer under body | PASS {"srcVis":"hidden","flyers":1} | PASS {"srcVis":"hidden","flyers":1} |
| 11 | t11-flyer | 11 every frame: flyer rect = lerp(source, destination, 1 − x/W) ± 4 | PASS max error 0.00 px over 29 frames | PASS max error 0.00 px over 30 frames |
| 11 | t11-flyer | 11 at rest: no .flyer, the destination visible | PASS {"x":0,"flyers":0,"dstVis":"visible"} | PASS {"x":0,"flyers":0,"dstVis":"visible"} |
| 11 | t11-flyer | 11 the destination stays hidden until rest | PASS  | PASS  |
| 11 | t11-flyer | 11 console clean | PASS [] | PASS [] |
| 12 | t12-sheet | 12a .sheet's transform changes in the first frame after touchend (≤ 17 ms) | PASS first frame after touchend +18.3 ms (previous frame -2.2 ms) has the sheet at ty 777.3 (H 844); first moved frame +18.3 ms | FAIL first frame after touchend +74.4 ms (previous frame -7.8 ms) has the sheet at ty 777.3 (H 844); first moved frame +74.4 ms |
| 12 | t12-sheet | 12a every frame: scrim = 0.78 × (1 − sheetY/H) ± 0.02 | PASS 55 frames, max error 0.0000 | PASS 52 frames, max error 0.0001 |
| 12 | t12-sheet | 12a every frame: the active .tab's scale = 0.92 + 0.08 × sheetY/H ± 0.01 | PASS max error 0.0000 | PASS max error 0.0000 |
| 12 | t12-sheet | 12a at rest the scale is 0.92 ± 0.005 | PASS scale 0.9200, ty 0.00 | PASS scale 0.9200, ty 0.00 |
| 12 | t12-sheet | 12a activeElement is the opener until the open animation completes, the first field within 1 frame after | PASS rest at frame 30 (+515 ms), opener held on 30 frames: true; field focused at frame 30; actives seen: btn soft gal-sheet-auto / field gal-field | PASS rest at frame 27 (+586 ms), opener held on 27 frames: true; field focused at frame 27; actives seen: btn soft gal-sheet-auto / field gal-field |
| 12 | t12-sheet | 12b a 120 px drag on .sheet-body at scrollTop 0 moves the sheet 120 ± 1 | PASS sheet translateY 120.00 after the finger moved 120 | PASS sheet translateY 120.00 after the finger moved 120 |
| 12 | t12-sheet | 12b the drag tracks 1:1 (per-frame against the last dispatched point) | PASS 13 frames, max /Δ/ 0.00 px | PASS 13 frames, max /Δ/ 0.00 px |
| 12 | t12-sheet | 12b release at ~500 px/s dismisses | PASS finger speed 481 px/s; sheet gone | PASS finger speed 481 px/s; sheet gone |
| 12 | t12-sheet | 12c the same drag at scrollTop 40 scrolls the body; the sheet does not move | PASS sheet max translateY 0.00, body scrollTop 40 → 0 | PASS sheet max translateY 0.00, body scrollTop 40 → 0 |
| 12 | t12-sheet | 12d a pointerdown during the rise stops it within 1 frame | PASS ty at the frames after the page's pointerdown: 85.8, 85.8, 85.8, 85.8, 85.8 | PASS ty at the frames after the page's pointerdown: 34.0, 34.0, 34.0, 34.0, 34.0 |
| 12 | t12-sheet | 12d released without a drag, it settles at its detent | PASS top 10 | PASS top 10 |
| 12 | t12-sheet | 12e an inner sheet.push adds no history entry | PASS length 4 → open 4 → push 4, depth 2 | PASS length 4 → open 4 → push 4, depth 2 |
| 12 | t12-sheet | 12e history.back() closes the sheet; pathname and stack unchanged | PASS sheet false, /dev/ui → /dev/ui, stack ["/dev/ui"] → ["/dev/ui"] | PASS sheet false, /dev/ui → /dev/ui, stack ["/dev/ui"] → ["/dev/ui"] |
| 12 | t12-sheet | 12f grabber tap cycles data-detent medium → large → medium | PASS medium (top 422.0) → large (top 10.0) → medium (top 422.0) | PASS medium (top 422.0) → large (top 10.0) → medium (top 422.0) |
| 12 | t12-sheet | 12f the large detent's top is safeTop + 10 (10 on the web) | PASS top 10.00 | PASS top 10.00 |
| 12 | t12-sheet | 12g a hero tap on Today opens the session sheet | PASS hero aura today-hero halo-upcoming is-pressable is-other; sheet title "Threshold 6" | PASS hero aura today-hero halo-upcoming is-pressable is-other; sheet title "Threshold 6" |
| 12 | t12-sheet | 12g .sheet's transform changes in the first frame after touchend (≤ 17 ms) | PASS first frame after touchend +15.2 ms (previous frame -1.7 ms) has the sheet at ty 777.3 (H 844); first moved frame +15.2 ms | PASS first frame after touchend +50.3 ms (previous frame -13.1 ms) has the sheet at ty 777.3 (H 844); first moved frame +50.3 ms |
| 12 | t12-sheet | 12g every frame: scrim = 0.78 × (1 − sheetY/H) ± 0.02 | PASS 54 frames, max error 0.0000 | PASS 55 frames, max error 0.0001 |
| 12 | t12-sheet | 12g every frame: the active .tab's scale = 0.92 + 0.08 × sheetY/H ± 0.01 | PASS max error 0.0000 | PASS max error 0.0000 |
| 12 | t12-sheet | 12g at rest the scale is 0.92 ± 0.005 | PASS scale 0.9200, ty 0.00 | PASS scale 0.9200, ty 0.00 |
| 12 | t12-sheet | 12 console clean | PASS [] | PASS [] |
| 13 | t13-pager | 10 270 px left swipe on card commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on page head commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on a row (y 650) commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on the strip commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on the large title row commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-24","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 a swipe on the orb row (data-no-page) does not change the date | PASS {"date":"2026-10-23"} | PASS {"date":"2026-10-23"} |
| 13 | t13-pager | 10 a swipe on the field does not change the date | PASS {"date":"2026-10-23"} | PASS {"date":"2026-10-23"} |
| 13 | t13-pager | 11 at x = −195: disc = cellX + 27.86 ± 1, Today 0.5, Tomorrow 0.5 | PASS {"x":-195,"disc":250.71,"expected":250.71,"today":0.5,"tomorrow":0.5,"labels":["Today","Tomorrow"]} | PASS {"x":-195,"disc":250.71,"expected":250.71,"today":0.5,"tomorrow":0.5,"labels":["Today","Tomorrow"]} |
| 13 | t13-pager | 12 flick ≥ 1500 px/s: every frame in the 100 ms after release within 3 px of the pageFlick trajectory; rest ≤ 450 ms | PASS {"sameRelease":true,"releaseLagMs":0.2,"releaseV":-1667,"releaseX":-100,"framesIn100ms":6,"maxErrPx":0.426,"restMs":423.3,"firstFrameMs":15.6,"fi | PASS {"sameRelease":true,"releaseLagMs":1,"releaseV":-1667,"releaseX":-100,"framesIn100ms":6,"maxErrPx":1.826,"restMs":466.3,"firstFrameMs":15.3,"firs |
| 13 | t13-pager | 13 catch mid-slide: today's left edge the same ±1 on the frames either side of touchstart | PASS {"before":-355.91,"after":-355.91,"xAtCatch":-355.9,"caughtPastHalf":true} | PASS {"before":-355.3,"after":-355.3,"xAtCatch":-355.3,"caughtPastHalf":true} |
| 13 | t13-pager | 13 catch mid-slide: at touchend today's left edge = its edge at the touch + 120 ± 2 | PASS {"movedX":120,"framesAtTouch":-355.91,"framesAtEnd":-235.91} | PASS {"movedX":120,"framesAtTouch":-355.3,"framesAtEnd":-235.3} |
| 13 | t13-pager | 13 catch mid-slide: springs back to today; commits in pairs (0 or 2); no content jump | PASS {"date":"2026-10-23","commits":["2026-10-24","2026-10-23"],"maxJump":0,"frames":130,"fr0":75} | PASS {"date":"2026-10-23","commits":["2026-10-24","2026-10-23"],"maxJump":0,"frames":134,"fr0":80} |
| 13 | t13-pager | 14 flick, flick back: today, title Today, history unchanged, commits even | PASS {"date":"2026-10-23","title":"Today","commits":2,"history":"3→3","releaseV":[-1333,1111]} | PASS {"date":"2026-10-23","title":"Today","commits":2,"history":"3→3","releaseV":[-1333,1111]} |
| 13 | t13-pager | 15 clamp: a 450 px drag moves the track ≤ W + 12 and commits one page | PASS {"maxTx":399,"limit":402,"commits":1} | PASS {"maxTx":399,"limit":402,"commits":1} |
| 13 | t13-pager | 15a four 270 px swipes 150 ms apart: +4, exactly 4 page-commits, title dayTitle(+4), no jump > 1 px at a catch | PASS {"date":"2026-10-27","plus":4,"commits":4,"title":"Tue 27","catchJumpMax":0,"xAtCatches":[0,-381,-386,-387]} | PASS {"date":"2026-10-27","plus":4,"commits":4,"title":"Tue 27","catchJumpMax":0,"xAtCatches":[0,-381,-386,-387]} |
| 13 | t13-pager | 15b tap at x ≈ −200 (past halfway): rests on a page within 450 ms, the next day, no tap fires, no sheet | PASS {"xAtTap":-233,"date":"2026-10-24","commits":1,"restMs":347.6,"taps":[]} | PASS {"xAtTap":-242,"date":"2026-10-24","commits":1,"restMs":365.4,"taps":[]} |
| 13 | t13-pager | 15b tap at x ≈ −120 (short of halfway): rests on a page within 450 ms, today, 0 commits, no tap fires, no sheet | PASS {"xAtTap":-121.8,"date":"2026-10-23","commits":0,"restMs":330,"taps":[]} | PASS {"xAtTap":-179.7,"date":"2026-10-23","commits":0,"restMs":329,"taps":[]} |
| 13 | t13-pager | 15c four left 60 px flicks: /today/+4, page-commits = 4 | PASS {"date":"2026-10-27","commits":4,"downs":[0,-287,-261,-253],"rels":[[-40,-667],[43,-667],[69,-667],[77,-667]]} | PASS {"date":"2026-10-27","commits":4,"downs":[0,-281,-237,-241],"rels":[[-40,-667],[49,-667],[93,-667],[89,-667]]} |
| 13 | t13-pager | 15c three left and one right: /today/+2, page-commits = 4 (3 on, 1 back) | PASS {"date":"2026-10-25","commits":4,"downs":[0,-287,-261,-253],"rels":[[-40,-667],[43,-667],[69,-667],[197,667]]} | PASS {"date":"2026-10-25","commits":4,"downs":[0,-283,-234,-242],"rels":[[-40,-667],[47,-667],[96,-667],[208,667]]} |
| 13 | t13-pager | 16 zero React renders while the track springs; data-date unchanged until the rest frame | PASS {"springFrames":23,"distinctRenderCounts":1,"flipFrame":23} | PASS {"springFrames":16,"distinctRenderCounts":1,"flipFrame":16} |
| 13 | t13-pager | 16 on the rest frame data-date, the disc and the resting labels change together; content ≤ 1 px | PASS {"at":{"tx":0,"cur":"2026-10-24","disc":278.57,"title":"Tomorrow"},"contentBefore":-0.9,"contentAt":0} | PASS {"at":{"tx":0,"cur":"2026-10-24","disc":278.57,"title":"Tomorrow"},"contentBefore":-0.33,"contentAt":0} |
| 13 | t13-pager | 13-keyed a commit keeps the two staying pages' nodes and mounts exactly one | PASS {"sameToday":true,"sameNext":true,"added":1,"roles":["prev:2026-10-23","cur:2026-10-24","next:2026-10-25"]} | PASS {"sameToday":true,"sameNext":true,"added":1,"roles":["prev:2026-10-23","cur:2026-10-24","next:2026-10-25"]} |
| 13 | t13-pager | 17 at rest prev and next exist, text > 20, inert | PASS {"prev":[75,true,900],"next":[95,true,1400]} | PASS {"prev":[75,true,900],"next":[95,true,1400]} |
| 13 | t13-pager | 17 scrollHeight = cur offsetHeight + chrome with a 1400 px neighbour mounted; the 600 stub fills the scroller (min-height = --scroller-h − - | PASS {"day":-1,"prev":[75,true,900],"next":[95,true,1400],"curH":637,"minH":637,"chrome":157,"scH":794,"scrollHeight":794,"clientHeight":794,"dpTop":1 | PASS {"day":-1,"prev":[75,true,900],"next":[95,true,1400],"curH":637,"minH":637,"chrome":157,"scH":794,"scrollHeight":794,"clientHeight":794,"dpTop":1 |
| 13 | t13-pager | 18 scrolled 220 on the 1400 page, a swipe onto the 900 page keeps scrollTop | PASS {"scrollTop":220,"from":-3} | PASS {"scrollTop":220,"from":-3} |
| 13 | t13-pager | 3.5 scrolled to the bottom of the 1400 page, a catch past halfway onto the (previous) 600 page does not commit mid-gesture (no vertical jump | PASS {"scrollTop":[763,763],"commits":[0,0,1],"date":"2026-10-19","xAtCatch":256} | PASS {"scrollTop":[763,763],"commits":[0,0,1],"date":"2026-10-19","xAtCatch":254} |
| 13 | t13-pager | 19 a drag from the strip that commits one page: exactly 1 select; from the card: 0 | PASS {"strip":1,"body":0} | PASS {"strip":1,"body":0} |
| 13 | t13-pager | 19 ten day steps add 0 history entries | PASS {"history":"3→3","date":"2026-11-02"} | PASS {"history":"3→3","date":"2026-11-02"} |
| 13 | t13-pager | goTo goTo(+1) commits within 500 ms | PASS {"ms":490.6} | PASS {"ms":514.3} |
| 13 | t13-pager | goTo goTo(+5) sets target and span before its first frame, travels exactly W once, and both reset on commit | PASS {"target":"2026-10-24","span":5,"beforeFirstFrame":5.5,"maxTx":389.1} | PASS {"target":"2026-10-24","span":5,"beforeFirstFrame":35.8,"maxTx":389.2} |
| 13 | t13-pager | goTo goTo(+5): the label in the direction of travel shows the destination; the disc travels 5 cells | PASS {"nextLabel":"Tomorrow","want":"Tomorrow","lastDisc":277.9,"lastTx":-389.1} | PASS {"nextLabel":"Tomorrow","want":"Tomorrow","lastDisc":278,"lastTx":-389.2} |
| 13 | t13-pager | goTo goTo(+12): no transform animation on the track; a 150 ms opacity change on the cur slot | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} |
| 13 | t13-pager | goTo goTo(+1, { mode: 'crossfade' }): no transform animation on the track; a 150 ms opacity change on the cur slot | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} |
| 13 | t13-pager | goTo a date set by the host mid-slide stops the slide and shows it at x = 0, no animation, 0 page-commits | PASS {"xAfter":0,"x":0,"commits":0,"log":[-82.51444106673232,-125.11209357897592,0]} | PASS {"xAfter":0,"x":0,"commits":0,"log":[-94.03461162193184,-134.74479798894126,0]} |
| 13 | t13-pager | 20 the Today pill from +5: one slide (the track travels exactly W), today, avatar back ≤ 150 ms after rest; slot 80 wide and the caps line's | PASS {"maxTx":389,"commits":1,"avatarBackMs":72.6,"trailW":80,"haptics":[]} | PASS {"maxTx":389.1,"commits":1,"avatarBackMs":102.8,"trailW":80,"haptics":[]} |
| 13 | t13-pager | 35 3 body swipes, 2 strip taps, the pill and a far goTo: 0 haptics | PASS {"haptics":[],"commits":7} | PASS {"haptics":[],"commits":7} |
| 13 | t13-pager | console clean | PASS [] | PASS [] |
| 13 | t13b-onepx | 13 1 px rule: a released spring was caught within 1 px of its target while still moving | PASS attempt 0: x -389.15 vs target -390.00 (Δ 0.85 px), release v -1500 px/s | PASS attempt 0: x -389.89 vs target -390.00 (Δ 0.11 px), release v -1500 px/s |
| 13 | t13b-onepx | 13 1 px rule: the pointerdown completes the spring (one commit, no catch) | PASS {"afterDown":{"x":0,"moving":true,"commits":1,"date":"2026-10-24"},"afterUp":{"moving":false,"x":0},"totalCommits":1} | PASS {"afterDown":{"x":0,"moving":true,"commits":1,"date":"2026-10-24"},"afterUp":{"moving":false,"x":0},"totalCommits":1} |
| 13 | t13b-onepx | 13 1 px rule: the pointer's click fires normally (the card's tap, not swallowed) | PASS {"taps":["tap 2026-10-24"],"el":"dp","card":"2026-10-24"} | PASS {"taps":["tap 2026-10-24"],"el":"dp","card":"2026-10-24"} |
| 13 | t13b-onepx | 13 1 px rule: console clean | PASS [] | PASS [] |
| 14 | t09b-depth2 | 14 a hold-menu item on a stub Plan raises its toast through useToast(): the toast is Plan's (gone on Today) | PASS {"onPlan":"menu toast from plan","onToday":null} | PASS {"onPlan":"menu toast from plan","onToday":null} |
| 14 | t14-hold | 14a .gal-p-scale: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +14.7 ms (frame interval 16.6); cleared (pressed=false) on the first frame after pointerup, +16.5 ms (f | PASS set on the first frame after pointerdown, +67.6 ms (frame interval 73.3); cleared (pressed=false) on the first frame after pointerup, +60.7 ms (f |
| 14 | t14-hold | 14a .gal-p-scale: the scale look by 140 ms | PASS scale 0.9700 | PASS scale 0.9702 |
| 14 | t14-hold | 14a .gal-p-surface: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +15.0 ms (frame interval 16.8); cleared (pressed=false) on the first frame after pointerup, +16.0 ms (f | PASS set on the first frame after pointerdown, +9.9 ms (frame interval 16.5); cleared (pressed=false) on the first frame after pointerup, +64.7 ms (fr |
| 14 | t14-hold | 14a .gal-p-surface: the surface look by 140 ms | PASS rgba(0, 0, 0, 0) → rgb(17, 17, 17) | PASS rgba(0, 0, 0, 0) → rgb(17, 17, 17) |
| 14 | t14-hold | 14a .gal-p-dim: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +14.7 ms (frame interval 16.9); cleared (pressed=false) on the first frame after pointerup, +15.7 ms (f | PASS set on the first frame after pointerdown, +11.9 ms (frame interval 16.3); cleared (pressed=false) on the first frame after pointerup, +85.9 ms (f |
| 14 | t14-hold | 14a .gal-p-dim: the dim look by 140 ms | PASS opacity 0.55 | PASS opacity 0.55 |
| 14 | t14-hold | 14a .tab-item[data-tab=plan]: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +15.8 ms (frame interval 17.0); cleared (pressed=false) on the first frame after pointerup, +15.9 ms (f | PASS set on the first frame after pointerdown, +12.4 ms (frame interval 17.2); cleared (pressed=false) on the first frame after pointerup, +34.4 ms (f |
| 14 | t14-hold | 14a .tab-item[data-tab=plan]: the scale look by 140 ms | PASS scale 0.9700 | PASS scale 0.9700 |
| 14 | t14-hold | 14b a 378 ms press fires onPress and 0 menus, 0 haptics | PASS {"log":["hold-tap"],"menu":false,"h":[],"held":378.19999999925494} | PASS {"log":["hold-tap"],"menu":false,"h":[],"held":388.80000000074506} |
| 14 | t14-hold | 14c 470 ms unmoved: the menu opens, exactly 1 lift, no onPress | PASS {"haptics":["lift"],"log":[]} | PASS {"haptics":["lift"],"log":[]} |
| 14 | t14-hold | 14c no menu at 440 ms, in the DOM by 460 ms | PASS menu in the DOM at +456.9 ms after pointerdown | PASS menu in the DOM at +482.8 ms after pointerdown |
| 14 | t14-hold | 14c menu opacity ≥ 0.9 by 600 ms | PASS opacity 1 at +600 | PASS opacity 1 at +612 |
| 14 | t14-hold | 14c data-pressed is cleared on the frame data-lifting is set (pre-grow before it) | PASS lifting from frame 29; the frame before: pressed true, preholding true; frames with both: 0 | PASS lifting from frame 29; the frame before: pressed true, preholding true; frames with both: 0 |
| 14 | t14-hold | 14c .cm-hole's rect equals the lifted element's rect ± 1 on every frame of the lift | PASS 26 frames, max error 0.02 px | PASS 28 frames, max error 0.02 px |
| 14 | t14-hold | 14c the scrim has no backdrop-filter; no .cm-lift; ≤ 4 items | PASS backdrop-filter none, .cm-lift 0, items 4 | PASS backdrop-filter none, .cm-lift 0, items 4 |
| 14 | t14-hold | 14c a tap on the lifted element closes the menu without its onPress | PASS {"menu":false,"log":[],"sheet":false} | PASS {"menu":false,"log":[],"sheet":false} |
| 14 | t14-hold | 14d moving 10 px after 470 closes the menu within 100 ms and sets data-dragging | PASS menu up true; its 100 ms exit reached opacity 0 63 ms after the page's pointermove; dragging true; drag-start | PASS menu up true; its 100 ms exit reached opacity 0 51 ms after the page's pointermove; dragging true; drag-start |
| 14 | t14-hold | 14f a 300 ms press that moves 12 px: no menu, no lift | PASS {"menu":0,"h":[],"l":false,"log":["hold-tap"]} | PASS {"menu":0,"h":[],"l":false,"log":["hold-tap"]} |
| 14 | t14-hold | 14g ignore=".inner": a 600 ms hold on .inner: no data-pressed, no lift, no menu | PASS {"pressed":false,"menu":0,"h":[],"l":false} | PASS {"pressed":false,"menu":0,"h":[],"l":false} |
| 14 | t14-hold | 14g ignore=".inner": a tap on .inner does not fire the outer onPress | PASS ["inner"] | PASS ["inner"] |
| 14 | t14-hold | 14h a hold that reaches 450 then moves 150 px left: the menu is gone within 100 ms of the 10 px mark | PASS menu up at 470: true; gone 65 ms after the 10 px mark | PASS menu up at 470: true; gone 58 ms after the 10 px mark |
| 14 | t14-hold | 14h ... the track followed the finger (≤ 1 px against the last dispatched point, after the 10 px re-base) and exactly 1 page-commit | PASS track vs the last dispatched point: offset spread 0.00 px over 15 frames (the constant offset is the lock re-base); Today → SAT, OCT 24; page-com | PASS track vs the last dispatched point: offset spread 0.00 px over 20 frames (the constant offset is the lock re-base); Today → SAT, OCT 24; page-com |
| 14 | t14-hold | 14 console clean | PASS [] | PASS [] |
| 14 | t34-menu | 34 gallery .gal-p-hold: the menu is up (≤ 4 items here: 4); the hole is a cut-out (no backdrop-filter, no clone) | PASS {"menu":true,"items":4,"hit":true,"hitName":"stamp gal-session-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":521.1} | PASS {"menu":true,"items":4,"hit":true,"hitName":"stamp gal-session-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":562.2} |
| 14 | t34-menu | 34 gallery .gal-p-hold: elementFromPoint at the lifted element's centre returns it or a descendant | PASS stamp gal-session-name | PASS stamp gal-session-name |
| 14 | t34-menu | 34 gallery .gal-p-hold: the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimmed) | PASS pixel 17,17,17 → 17,17,17; 5×5 mean 17,17,17 → 17,17,17 (dimmed by the scrim it would be ×0.3) | PASS pixel 17,17,17 → 17,17,17; 5×5 mean 17,17,17 → 17,17,17 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 gallery .gal-p-hold: a tab-bar pixel is darker by the scrim | PASS 90,101,253 → 27,30,76 | PASS 90,101,253 → 27,30,76 |
| 14 | t34-menu | 34 gallery .gal-p-hold: tapping the lifted element closes the menu and opens nothing | PASS {"menu":false,"log":[],"sheet":false} | PASS {"menu":false,"log":[],"sheet":false} |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: the menu is up (≤ 4 items here: 4); the hole is a cut-out (no backdrop-filter, n | PASS {"menu":true,"items":4,"hit":true,"hitName":"pressable gal-press gal-p-pager","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":509.4} | PASS {"menu":true,"items":4,"hit":true,"hitName":"pressable gal-press gal-p-pager","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":584.8} |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: elementFromPoint at the lifted element's centre returns it or a descendant | PASS pressable gal-press gal-p-pager | PASS pressable gal-press gal-p-pager |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimm | PASS pixel 27,27,27 → 27,27,27; 5×5 mean 27,27,27 → 27,27,27 (dimmed by the scrim it would be ×0.3) | PASS pixel 27,27,27 → 27,27,27; 5×5 mean 27,27,27 → 27,27,27 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: a tab-bar pixel is darker by the scrim | PASS 90,101,253 → 27,30,76 | PASS 90,101,253 → 27,30,76 |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: tapping the lifted element closes the menu and opens nothing | PASS {"menu":false,"log":[],"sheet":false} | PASS {"menu":false,"log":[],"sheet":false} |
| 14 | t34-menu | 34 Today's hero: the menu is up (≤ 4 items here: 5); the hole is a cut-out (no backdrop-filter, no clone) | PASS {"menu":true,"items":5,"hit":true,"hitName":"hero-plan","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":504.6} | PASS {"menu":true,"items":5,"hit":true,"hitName":"hero-plan","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":558.4} |
| 14 | t34-menu | 34 Today's hero: elementFromPoint at the lifted element's centre returns it or a descendant | PASS hero-plan | PASS hero-plan |
| 14 | t34-menu | 34 Today's hero: the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimmed) | PASS pixel 135,135,135 → 135,135,135; 5×5 mean 70,70,70 → 70,70,70 (dimmed by the scrim it would be ×0.3) | PASS pixel 135,135,135 → 135,135,135; 5×5 mean 70,70,70 → 70,70,70 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 Today's hero: a tab-bar pixel is darker by the scrim | PASS 90,101,253 → 27,30,76 | PASS 90,101,253 → 27,30,76 |
| 14 | t34-menu | 34 Today's hero: tapping the lifted hero closes the menu and opens no sheet | PASS {"menu":false,"sheet":false} | PASS {"menu":false,"sheet":false} |
| 14 | t34-menu | 34 a Plan row (Threshold 6): the menu is up (≤ 4 items here: 5); the hole is a cut-out (no backdrop-filter, no clone) | PASS {"menu":true,"items":5,"hit":true,"hitName":"stamp pl-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":478.2} | PASS {"menu":true,"items":5,"hit":true,"hitName":"stamp pl-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":538.2} |
| 14 | t34-menu | 34 a Plan row (Threshold 6): elementFromPoint at the lifted element's centre returns it or a descendant | PASS stamp pl-name | PASS stamp pl-name |
| 14 | t34-menu | 34 a Plan row (Threshold 6): the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimmed) | PASS pixel 0,0,0 → 0,0,0; 5×5 mean 0,0,0 → 0,0,0 (dimmed by the scrim it would be ×0.3) | PASS pixel 0,0,0 → 0,0,0; 5×5 mean 0,0,0 → 0,0,0 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 a Plan row (Threshold 6): a tab-bar pixel is darker by the scrim | PASS 136,136,136 → 40,40,40 | PASS 136,136,136 → 40,40,40 |
| 14 | t34-menu | 34 Plan row → Skip raises a toast with Undo, above the tab bar | PASS {"text":"Threshold 6 skippedUndo","bottom":782,"tabbar":794} | PASS {"text":"Threshold 6 skippedUndo","bottom":782,"tabbar":794} |
| 14 | t34-menu | 34 Undo puts the session back and the toast goes | PASS {"toast":null,"cls":"pl-line t-hard k-planned is-lead"} | PASS {"toast":null,"cls":"pl-line t-hard k-planned is-lead"} |
| 14 | t34-menu | 34 console clean | PASS [] | PASS [] |
| 15 | t14-hold | 14d a hold + drop that crosses no slot: lift, drop | PASS ["lift","drop"] | PASS ["lift","drop"] |
| 15 | t14-hold | 14e a hold + drop that crosses exactly one slot: lift, select, drop | PASS {"h":["lift","select","drop"],"order":["Strides","Warm up","Cool down"]} | PASS {"h":["lift","select","drop"],"order":["Strides","Warm up","Cool down"]} |
| 15 | t15-haptics | 15 the session ran: 3 swipes moved 3 days, the pill went home, +12 went far | PASS {"before":"2026-10-23","afterSwipes":"2026-10-26","pillTapped":true,"atToday":true,"far":"2026-11-04"} | PASS {"before":"2026-10-23","afterSwipes":"2026-10-26","pillTapped":true,"atToday":true,"far":"2026-11-04"} |
| 15 | t15-haptics | 15 4 tab taps, 3 body swipes, 2 strip taps, the pill, 2 segmented, 3 sheet opens, a far goTo: 0 haptics | PASS 0 haptics [] over 16 actions | PASS 0 haptics [] over 16 actions |
| 15 | t15-haptics | 15 console clean | PASS [] | PASS [] |
| 15 | tsw-swipe | sw2 a row armed then disarmed fires exactly 1 threshold and commits nothing | PASS {"h":["threshold"],"log":[]} | PASS {"h":["threshold"],"log":[]} |
| 15 | t15-16 | 15 4 tab taps, 3 sheet opens and closes, 2 segmented changes: 0 haptics | PASS haptics [] (segmented options found: 4) | PASS haptics [] (segmented options found: 4) |
| 15 | t15-16 | 15-16 console clean | PASS [] | PASS [] |
| 16 | t15-16 | 16 a sheet open: no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a sheet open: no element's offset box changes on 2+ consecutive frames | PASS 49 frames; none | PASS 31 frames; none |
| 16 | t15-16 | 16 a swipe row swipe: no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a swipe row swipe: no element's offset box changes on 2+ consecutive frames | PASS 71 frames; none | PASS 61 frames; none |
| 16 | t15-16 | 16 a day swipe (DayPager v2): no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a day swipe (DayPager v2): no element's offset box changes on 2+ consecutive frames | PASS 77 frames; none | PASS 63 frames; none |
| 16 | t15-16 | 16 a tab tap: no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a tab tap: no element's offset box changes on 2+ consecutive frames | PASS 47 frames; none | PASS 48 frames; none |
| 16 | t15-16 | 16 a push (the avatar): no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a push (the avatar): no element's offset box changes on 2+ consecutive frames | PASS 49 frames; none | PASS 49 frames; none |
| 17 | t17-navbar | 17.@390 .nb-bar, .nb-title, .nb-strip and .nb-gap share one parent (the page element) | PASS [true,true,true,true] | PASS [true,true,true,true] |
| 17 | t17-navbar | 17.@390 pinned chrome = 97 + safe-t (bar 44, strip 53 with its hairline) | PASS {"bar":44,"strip":53} | PASS {"bar":44,"strip":53} |
| 17 | t17-navbar | 39.@390 RELENTLESSLY on +10: .nb-cap fits (scrollWidth ≤ clientWidth) and the date part is dayCaption(full) | PASS {"scrollWidth":278,"clientWidth":278,"date":"MON, NOV 2","word":"RELENTLESSLY · "} | PASS {"scrollWidth":278,"clientWidth":278,"date":"MON, NOV 2","word":"RELENTLESSLY · "} |
| 17 | t17-navbar | 39.@390 --nb-word-w equals .nb-word's width ± 1 | PASS {"var":101.78125,"word":101.78} | PASS {"var":101.78125,"word":101.78} |
| 17 | t17-navbar | 38.@390 after 60 px: .nb-title is behind the bar, the inline title at opacity 1, the strip's top = the bar's bottom, .is-collapsed | PASS {"titleBottom":28,"barBottom":44,"inlineOp":1,"stripTop":44,"collapsed":true} | PASS {"titleBottom":28,"barBottom":44,"inlineOp":1,"stripTop":44,"collapsed":true} |
| 17 | t17-navbar | 39.@390 collapsed: .nb-word opacity 1 with the word, .nb-date opacity 0, word.right ≤ inline.left | PASS {"wordOp":1,"dateOp":0,"wordRight":117.8,"inlineLeft":149.9,"inlineW":90.2,"ellipsis":false} | PASS {"wordOp":1,"dateOp":0,"wordRight":117.8,"inlineLeft":149.9,"inlineW":90.2,"ellipsis":false} |
| 17 | t17-navbar | 38.@390 after a 600 px scroll .nb-bar is at 0 and .nb-strip at 44 | PASS {"scrollTop":600,"barTop":0,"stripTop":44} | PASS {"scrollTop":600,"barTop":0,"stripTop":44} |
| 17 | t17-navbar | 17.@390 .nb-cap: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | 17.@390 .nb-title: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | 17.@390 .nb-inline: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | console.@390 clean | PASS [] | PASS [] |
| 17 | t17-navbar | 17.@320 .nb-bar, .nb-title, .nb-strip and .nb-gap share one parent (the page element) | PASS [true,true,true,true] | PASS [true,true,true,true] |
| 17 | t17-navbar | 17.@320 pinned chrome = 97 + safe-t (bar 44, strip 53 with its hairline) | PASS {"bar":44,"strip":53} | PASS {"bar":44,"strip":53} |
| 17 | t17-navbar | 39.@320 RELENTLESSLY on +10: .nb-cap fits (scrollWidth ≤ clientWidth) and the date part is dayCaption(full) | PASS {"scrollWidth":208,"clientWidth":208,"date":"MON, NOV 2","word":"RELENTLESSLY · "} | PASS {"scrollWidth":208,"clientWidth":208,"date":"MON, NOV 2","word":"RELENTLESSLY · "} |
| 17 | t17-navbar | 39.@320 --nb-word-w equals .nb-word's width ± 1 | PASS {"var":101.78125,"word":101.78} | PASS {"var":101.78125,"word":101.78} |
| 17 | t17-navbar | 38.@320 after 60 px: .nb-title is behind the bar, the inline title at opacity 1, the strip's top = the bar's bottom, .is-collapsed | PASS {"titleBottom":28,"barBottom":44,"inlineOp":1,"stripTop":44,"collapsed":true} | PASS {"titleBottom":28,"barBottom":44,"inlineOp":1,"stripTop":44,"collapsed":true} |
| 17 | t17-navbar | 39.@320 collapsed: .nb-word opacity 1 with the word, .nb-date opacity 0, word.right ≤ inline.left, the inline title ellipsizes | PASS {"wordOp":1,"dateOp":0,"wordRight":117.8,"inlineLeft":125.8,"inlineW":68.4,"ellipsis":true} | PASS {"wordOp":1,"dateOp":0,"wordRight":117.8,"inlineLeft":125.8,"inlineW":68.4,"ellipsis":true} |
| 17 | t17-navbar | 38.@320 after a 600 px scroll .nb-bar is at 0 and .nb-strip at 44 | PASS {"scrollTop":600,"barTop":0,"stripTop":44} | PASS {"scrollTop":600,"barTop":0,"stripTop":44} |
| 17 | t17-navbar | 17.@320 .nb-cap: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | 17.@320 .nb-title: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | 17.@320 .nb-inline: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | console.@320 clean | PASS [] | PASS [] |
| 18 | t18-open | 18 warm open at 4× / Slow 4G: black, then the page (2 distinct layouts) | PASS black > content over 3 frames | PASS black > content over 3 frames |
| 18 | t18-open | 18 only the active tab root is mounted on the first content frame | PASS 1 | PASS 1 |
| 18 | t18-open | 18 fonts.check('italic 34px "Instrument Serif"') on the first content frame | PASS true | PASS true |
| 18 | t18-open | 18 no skeleton in the active page with the month cached | PASS false | PASS false |
| 18 | t18-open | 18 the splash hides exactly once, within a frame or two of the first content paint | PASS 1 call(s), 1.4 ms after the first content frame | PASS 1 call(s), 2.6 ms after the first content frame |
| 18 | t18-open | 18 console clean (warm open) | PASS [] | PASS [] |
| 18 | t18-open | 18 foreground: ≤ 2 requests in 10 s (bootstrap + /strava/sync) | PASS ["/api/bootstrap","/api/strava/sync"] | PASS ["/api/bootstrap","/api/strava/sync"] |
| 18 | t18-open | 18 /strava/sync requested ≤ 100 ms after visibilitychange, before the bootstrap answers (held 2 s) | PASS +-1 ms | PASS +0 ms |
| 18 | t18-open | 18 useStravaChecking() true on the first frame after visibilitychange | PASS {"syncing":"true","dt":7.300000000745058} | PASS {"syncing":"true","dt":23.5} |
| 18 | t18-open | 18 stravaSyncNow(qc, { force: true, quiet: true }) inside the gap sends a request | PASS ["/api/strava/sync"] | PASS ["/api/strava/sync"] |
| 18 | t18-open | 18 … and leaves data-syncing false | PASS ["false"] | PASS ["false"] |
| 18 | t18-open | 18 console clean (foreground) | PASS [] | PASS [] |
| 19 | t17-navbar | 55.@390 strip cells are W/7 wide (55.71) | PASS 55.714285714285715 | PASS 55.714285714285715 |
| 19 | t17-navbar | 55.@390 document.scrollWidth === 390 | PASS 390 | PASS 390 |
| 19 | t17-navbar | 55.@320 strip cells are W/7 wide (45.71) | PASS 45.714285714285715 | PASS 45.714285714285715 |
| 19 | t17-navbar | 55.@320 document.scrollWidth === 320 | PASS 320 | PASS 320 |
| 19 | t19-320 | 19 root today: scrollWidth 320, nothing past the edge | PASS /today sw 320 | PASS /today sw 320 |
| 19 | t19-320 | 19 root plan: scrollWidth 320, nothing past the edge | PASS /plan sw 320 | PASS /plan sw 320 |
| 19 | t19-320 | 19 root progress: scrollWidth 320, nothing past the edge | PASS /progress sw 320 | PASS /progress sw 320 |
| 19 | t19-320 | 19 root journal: scrollWidth 320, nothing past the edge | PASS /journal sw 320 | PASS /journal sw 320 |
| 19 | t19-320 | 19 pushed This morning: scrollWidth 320, nothing past the edge | PASS /today/2026-10-23/morning sw 320 | PASS /today/2026-10-23/morning sw 320 |
| 19 | t19-320 | 19 pushed Settings: scrollWidth 320, nothing past the edge | PASS /settings sw 320 | PASS /settings sw 320 |
| 19 | t19-320 | 19 pushed /settings/you: scrollWidth 320, nothing past the edge | PASS /settings/you sw 320 | PASS /settings/you sw 320 |
| 19 | t19-320 | 19 pushed /settings/training: scrollWidth 320, nothing past the edge | PASS /settings/training sw 320 | PASS /settings/training sw 320 |
| 19 | t19-320 | 19 pushed /settings/habits: scrollWidth 320, nothing past the edge | PASS /settings/habits sw 320 | PASS /settings/habits sw 320 |
| 19 | t19-320 | 19 pushed /settings/plans: scrollWidth 320, nothing past the edge | PASS /settings/plans sw 320 | PASS /settings/plans sw 320 |
| 19 | t19-320 | 19 pushed Reads: scrollWidth 320, nothing past the edge | PASS /journal/reads sw 320 | PASS /journal/reads sw 320 |
| 19 | t19-320 | 19 pushed the gallery: scrollWidth 320, nothing past the edge | PASS /dev/ui sw 320 | PASS /dev/ui sw 320 |
| 19 | t19-320 | 19 the pager lab (stub Today): scrollWidth 320, nothing past the edge | PASS /dev/ui sw 320 | PASS /dev/ui sw 320 |
| 19 | t19-320 | 19 strip cells 45.7 ± 0.2 wide at 320 | PASS 45.70 45.72 45.72 45.70 45.72 45.72 45.72 | PASS 45.70 45.72 45.72 45.70 45.72 45.72 45.72 |
| 19 | t19-320 | 19 bar, strip and tab-bar targets ≥ 44 px tall | PASS [] | PASS [] |
| 19 | t19-320 | 19 console clean | PASS [] | PASS [] |
| 20 | t15-haptics | 15 (reduced motion) the session ran: 3 swipes moved 3 days, the pill went home, +12 went far | PASS {"before":"2026-10-23","afterSwipes":"2026-10-26","pillTapped":true,"atToday":true,"far":"2026-11-04"} | PASS {"before":"2026-10-23","afterSwipes":"2026-10-26","pillTapped":true,"atToday":true,"far":"2026-11-04"} |
| 20 | t15-haptics | 15 (reduced motion) 4 tab taps, 3 body swipes, 2 strip taps, the pill, 2 segmented, 3 sheet opens, a far goTo: 0 haptics | PASS 0 haptics [] over 16 actions | PASS 0 haptics [] over 16 actions |
| 20 | t15-haptics | 15 (reduced motion) console clean | PASS [] | PASS [] |
| 20 | t20-reduced | 20 push under reduced motion: no transform motion on .pushed | PASS [0] | PASS [0] |
| 20 | t20-reduced | 20 push: one opacity change ≤ 150 ms (± 1 frame) | PASS 8 frames, 117 ms | PASS 8 frames, 133 ms |
| 20 | t20-reduced | 20 no flyer under reduced motion | PASS  | PASS  |
| 20 | t20-reduced | 20 edge swipe still tracks the finger | PASS x 80.0 after 80 px of finger | PASS x 80.0 after 80 px of finger |
| 20 | t20-reduced | 20 pop under reduced motion: no transform motion, an opacity change ≤ 150 ms | PASS {"xs":[0],"fadeFrames":7} | PASS {"xs":[0],"fadeFrames":6} |
| 20 | t20-reduced | 20 console clean | PASS [] | PASS [] |
| 20 | t20b-reduced | 20b sheet open: no transform motion (translateY 0 on every frame) | PASS ty values 0.0 | PASS ty values 0.0 |
| 20 | t20b-reduced | 20b sheet open: one opacity change ≤ 150 ms (± 1 frame) | PASS 9 fading frames over 149 ms | PASS 6 fading frames over 105 ms |
| 20 | t20b-reduced | 20b no recede (the tab stays at scale 1) | PASS scales 1.000 | PASS scales 1.000 |
| 20 | t20b-reduced | 20b the scrim still dims (0.78 at rest) | PASS 0.78 | PASS 0.78 |
| 20 | t20b-reduced | 20b the sheet drag still tracks 1:1 | PASS translateY 60 after 60 px | PASS translateY 60 after 60 px |
| 20 | t20b-reduced | 20b closes | PASS closed | PASS closed |
| 20 | t20b-reduced | 20b the hold: the menu opens, the element is marked lifted with no scale, the haptic stays | PASS {"lifting":true,"scale":"1","menu":true,"h":["lift"]} | PASS {"lifting":true,"scale":"1","menu":true,"h":["lift"]} |
| 20 | t20b-reduced | 20b console clean | PASS [] | PASS [] |
| 20 | t21-reduced-pager | 21 reduced: a 270 px drag that pages tracks 1:1 (max lag 0.00 px) | PASS {"lag":0,"moves":9} | PASS {"lag":0,"moves":9} |
| 20 | t21-reduced-pager | 21 reduced: a 270 px drag that pages: the release is one ≤ 150 ms opacity change on the cur slot, no transform animation | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-24"} | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-24"} |
| 20 | t21-reduced-pager | 21 reduced: the labels swap at halfway instead of fading (at -216 px: cur 0, next 1) | PASS {"tx":-216,"cur":0,"next":1} | PASS {"tx":-216,"cur":0,"next":1} |
| 20 | t21-reduced-pager | 21 reduced: a 60 px drag that goes home tracks 1:1 (max lag 0.00 px) | PASS {"lag":0,"moves":8} | PASS {"lag":0,"moves":8} |
| 20 | t21-reduced-pager | 21 reduced: a 60 px drag that goes home: the release is one ≤ 150 ms opacity change on the cur slot, no transform animation | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-23"} | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-23"} |
| 20 | t21-reduced-pager | 21 reduced: goTo via .lab-go-p1: no transform, one ≤ 150 ms opacity change | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-24"} | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-24"} |
| 20 | t21-reduced-pager | 21 reduced: goTo via .lab-go-p5: no transform, one ≤ 150 ms opacity change | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-28"} | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-28"} |
| 20 | t21-reduced-pager | 21 reduced: console clean, no haptics | PASS {"errors":[],"hs":[]} | PASS {"errors":[],"hs":[]} |
| 21 | t21-gates | 21 no backdrop-filter | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no 100dvh | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no :active { transform } in ui/app/lib css | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no springs.press outside its adapter | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no deprecated motion names outside lib/motion.ts | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no touchmove listener on document | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no LayoutGroup in main.tsx | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no window.scrollTo in app/ | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 history writes only in NavController | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no :active rule left in WP1's stylesheets (the press is [data-pressed]) | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no clone lift, full-screen menu scrim or styledCopy | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 Sheet: no drag="y", dragElastic, useDragControls, layoutId flyer | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 Toast: no per-frame querySelector, no TOAST_ACTION_MS | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no body.style.overflow in ui/ | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no whileTap in ui/ or app/ | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no hand-typed 450 / 0.97 / the sheet curve in ui/ (lib/gesture.ts, lib/motion.ts own them) | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 WeekRing: no layoutId, no red (var(--bad), a red stroke) | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 Segmented: no layoutId thumb, no haptic | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 DayPager: no innerWidth, no motion style batch on the track, no haptic | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 DatePager/DayStepper adapters: no haptic, no own gesture | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no deprecated ui names in app/ and ui/ outside their adapters (DatePager, DayStepper, TabHeader, PushedHeader, dateLine) | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no useLongPress / LONG_PRESS_MS / pressScale / onLongPress / TAB_RESELECT / liftFx used in ui/ app/ lib/ outside their adapters | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 no react-router in ui/ or lib/, nor in app/ beyond the shell, the controller and the bridge's test stub | PASS grep over ui/ app/ lib/ main.tsx | static (rate-independent) |
| 21 | t21-gates | 21 ui/nav.test.ts + ui/captions.test.ts (routes, redirects, idx −1, captions) | PASS 47 passed | static (rate-independent) |
| 22 | t22-jumps | 22a go to another tab: useRootRequest once, { mon }, how.cut, before the first frame | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":1560.9000000022352}] | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":2401.39999999851}] |
| 22 | t22-jumps | 22a the first frame showing Plan is already at the request (no pager animation) | PASS {"mon":"2026-10-26"} | PASS {"mon":"2026-10-26"} |
| 22 | t22-jumps | 22a history.length + 1, NAV_EVENT jump, /plan/week/2026-10-26 | PASS {"reqs":[{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":1560.9000000022352}],"shown":"visible","params":"{\"mon\":\"2026-10-26\"}"," | PASS {"reqs":[{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":2401.39999999851}],"shown":"visible","params":"{\"mon\":\"2026-10-26\"}","le |
| 22 | t22-jumps | 22b the same go while Plan is active: how.cut false | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":false,"at":1571.800000000745}] | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":false,"at":2447.699999999255}] |
| 22 | t22-jumps | 22c go(/settings/training) on Plan: Today, two layers at rest from the first frame | PASS {"c1":[-117,0],"stack":["/settings","/settings/training"]} | PASS {"c1":[-117,0],"stack":["/settings","/settings/training"]} |
| 22 | t22-jumps | 22l nav.replace(/today/2026-10-24) from Today while Plan is active | PASS {"err":null,"today":"/today/2026-10-24","url":"/plan/week/2026-10-26"} | PASS {"err":null,"today":"/today/2026-10-24","url":"/plan/week/2026-10-26"} |
| 22 | t22-jumps | 22d Back onto /today/2026-10-20 from Plan: the Today stub receives { date }, no entry added | PASS {"reqs":[{"tab":"today","params":{"date":"2026-10-20"},"cut":true,"at":1069.0999999977648}],"path":"/today/2026-10-20","len":7,"active":"today"," | PASS {"reqs":[{"tab":"today","params":{"date":"2026-10-20"},"cut":true,"at":1438.2000000029802}],"path":"/today/2026-10-20","len":7,"active":"today"," |
| 22 | t22-jumps | 22e popstate onto /journal/reads with an empty stack rebuilds Reads | PASS {"before":{"path":"/journal","stack":[]},"after":{"path":"/journal","stack":["/journal/reads"]}} | PASS {"before":{"path":"/journal","stack":[]},"after":{"path":"/journal","stack":["/journal/reads"]}} |
| 22 | t22-jumps | 22f a pushed entry holds only { nav } with nav.idx | PASS {"keys":["nav"],"idx":4} | PASS {"keys":["nav"],"idx":4} |
| 22 | t22-jumps | 22h pop-all of two layers pushed this session: history.go(−2) (length unchanged) | PASS {"before":11,"after":11,"path":"/today/2026-10-20","idx":3} | PASS {"before":11,"after":11,"path":"/today/2026-10-20","idx":3} |
| 22 | t22-jumps | 22h the next Back leaves the tab | PASS {"path":"/journal","len":11,"active":"journal","stacks":{"today":{"path":"/today/2026-10-20","stack":[]},"plan":{"path":"/plan/week/2026-10-26"," | PASS {"path":"/journal","len":11,"active":"journal","stacks":{"today":{"path":"/today/2026-10-20","stack":[]},"plan":{"path":"/plan/week/2026-10-26"," |
| 22 | t22-jumps | 22h pop-all of two cold-start layers: replaceState (length unchanged, still in the app) | PASS {"a":9,"b":9,"path":"/today/2026-10-20"} | PASS {"a":9,"b":9,"path":"/today/2026-10-20"} |
| 22 | t22-jumps | 22g a sheet opened on Plan: useTab() in its body, header and action is plan; useNav and useToast work there | PASS {"tab":"plan","active":"plan","action":"plan","header":"plan"} | PASS {"tab":"plan","active":"plan","action":"plan","header":"plan"} |
| 22 | t22-jumps | 22g the sheet's toast is Plan's: dismissed when Today is activated | PASS {"toast1":"toast from plan","toast2":null} | PASS {"toast1":"toast from plan","toast2":null} |
| 22 | t22-jumps | 22 a Plan row's menu toast is Plan's: dismissed on Today | PASS {"mt1":"menu toast from plan","mt2":null} | PASS {"mt1":"menu toast from plan","mt2":null} |
| 22 | t22-jumps | 22j a hold-menu item that opens a sheet: the sheet is up 600 ms later, history.length + 1 | PASS {"sheet":true,"len":15,"tab":"plan","before":14} | PASS {"sheet":true,"len":15,"tab":"plan","before":14} |
| 22 | t22-jumps | 22k Open in Plan from a Progress sheet: Plan shown, no sheet, history.length + 1 | PASS {"active":"plan","sheet":false,"len":16,"path":"/plan/week/2026-10-26","before":15} | PASS {"active":"plan","sheet":false,"len":16,"path":"/plan/week/2026-10-26","before":15} |
| 22 | t22-jumps | 22k one Back returns to Progress | PASS {"path":"/progress","len":16,"active":"progress","stacks":{"today":{"path":"/today/2026-10-20","stack":[]},"plan":{"path":"/plan/week/2026-10-26" | PASS {"path":"/progress","len":16,"active":"progress","stacks":{"today":{"path":"/today/2026-10-20","stack":[]},"plan":{"path":"/plan/week/2026-10-26" |
| 22 | t22-jumps | 22m nav.go(/start) is a no-op | PASS {"m0":"/progress","m1":"/progress"} | PASS {"m0":"/progress","m1":"/progress"} |
| 22 | t22-jumps | 22 console clean | PASS [] | PASS [] |
| 23 | t23-bridge | 23 a login that mounts Authed forwarded nothing | PASS [] | PASS [] |
| 23 | t23-bridge | 23 navigate('/settings') from Today: Settings pushed on the push spring | PASS moving frames 28, first 390 | PASS moving frames 28, first 390 |
| 23 | t23-bridge | 23 history.length + 1 (not + 2), the entry nav.idx = previous + 1 | PASS {"s0":{"path":"/today","len":2,"idx":0,"active":"today","stack":[]},"s1":{"path":"/settings","len":3,"idx":1,"active":"today","stack":[["/setting | PASS {"s0":{"path":"/today","len":2,"idx":0,"active":"today","stack":[]},"s1":{"path":"/settings","len":3,"idx":1,"active":"today","stack":[["/setting |
| 23 | t23-bridge | 23 the chevron's pop uses history.back (an own entry): length unchanged, idx back | PASS {"path":"/today","len":3,"idx":0,"active":"today","stack":[]} | PASS {"path":"/today","len":3,"idx":0,"active":"today","stack":[]} |
| 23 | t23-bridge | 23 a second navigate('/settings') is forwarded too | PASS {"path":"/settings","len":3,"idx":1,"active":"today","stack":[["/settings",1]]} | PASS {"path":"/settings","len":3,"idx":1,"active":"today","stack":[["/settings",1]]} |
| 23 | t23-bridge | 23 navigate('/journal/reads') from Today: Journal shown with Reads | PASS {"path":"/journal/reads","len":3,"idx":1,"active":"journal","stack":[["/journal/reads",-1]]} | PASS {"path":"/journal/reads","len":3,"idx":1,"active":"journal","stack":[["/journal/reads",-1]]} |
| 23 | t23-bridge | 23 Reads' chevron pops to Journal's root (never cuts back to Today) | PASS {"path":"/journal","len":3,"idx":1,"active":"journal","stack":[]} | PASS {"path":"/journal","len":3,"idx":1,"active":"journal","stack":[]} |
| 23 | t23-bridge | 23 navigate(…, { replace: true }) keeps history.length and nav.idx | PASS {"s5":{"path":"/today","len":4,"idx":2,"active":"today","stack":[]},"s6":{"path":"/today/2026-10-24","len":4,"idx":2,"active":"today","stack":[]} | PASS {"s5":{"path":"/today","len":4,"idx":2,"active":"today","stack":[]},"s6":{"path":"/today/2026-10-24","len":4,"idx":2,"active":"today","stack":[]} |
| 23 | t23-bridge | 23 history.back() is handled once (no second jump from the bridge) | PASS ["jump"] | PASS ["jump"] |
| 23 | t23-bridge | 23 console clean (stubs) | PASS [] | PASS [] |
| 23 | t23-bridge | 23 old Settings' Training row shows the Training page (not the Settings root) | PASS {"path":"/settings/training","title":"Training","n":2} | PASS {"path":"/settings/training","title":"Training","n":2} |
| 23 | t23-bridge | 23 the old Today's next-day control shows tomorrow | PASS {"path":"/today/2026-10-24","root":"/today/2026-10-24"} | PASS {"path":"/today/2026-10-24","root":"/today/2026-10-24"} |
| 23 | t23-bridge | 23 console clean (old pages) | PASS [] | PASS [] |
| 24 | t24-peak | 24 one orb pop: exactly 1 orb haptic, nothing else | PASS ["orb"] | PASS ["orb"] |
| 24 | t24-peak | 24 the orb fires within 1 frame of the maximum scale | PASS max 1.1255 on frame 12 of 41 (+199 ms); the haptic on frame 13 (value 1.1253, the first below the apex) | PASS max 1.1255 on frame 12 of 41 (+192 ms); the haptic on frame 13 (value 1.1252, the first below the apex) |
| 24 | t24-peak | 24 the pop reaches 1.12 (one overshoot) and returns to 1 | PASS max 1.1255, last 1.0000 | PASS max 1.1255, last 1.0000 |
| 24 | t24-peak | 24 un-lighting fires nothing | PASS [] | PASS [] |
| 24 | t24-peak | 24 console clean | PASS [] | PASS [] |
| 24 | t24-peak | 24reduced reduced motion: no pop (the scale never moves) | PASS 0 scale changes | PASS 0 scale changes |
| 24 | t24-peak | 24reduced reduced motion: exactly 1 orb haptic | PASS ["orb"] | PASS ["orb"] |
| 24 | t24-peak | 24reduced reduced motion: it fires on the frame the fill completes | PASS fill reaches 1 on frame 9 of 10 (+149 ms); the haptic on frame 9 | PASS fill reaches 1 on frame 10 of 11 (+145 ms); the haptic on frame 10 |
| 24 | t24-peak | 24reduced un-lighting fires nothing | PASS [] | PASS [] |
| 24 | t24-peak | 24reduced console clean | PASS [] | PASS [] |
| 25 | t25-ring | 25 marked={2} draws the 1.5 px --ink ring on Wednesday | PASS {"markDay":"2","markStroke":"rgb(255, 255, 255)","markW":"1.5px","ink":"rgb(255, 255, 255)","gapDay":"2","gapStroke":"rgba(255, 255, 255, 0.28)", | PASS {"markDay":"2","markStroke":"rgb(255, 255, 255)","markW":"1.5px","ink":"rgb(255, 255, 255)","gapDay":"2","gapStroke":"rgba(255, 255, 255, 0.28)", |
| 25 | t25-ring | 25 a missed day has no arc; its stretch of track computes to --ink-4; no red anywhere in a ring | PASS {"gap":"rgba(255, 255, 255, 0.28)","ink4":"rgba(255, 255, 255, 0.28)","arcs":5,"red":false} | PASS {"gap":"rgba(255, 255, 255, 0.28)","ink4":"rgba(255, 255, 255, 0.28)","arcs":5,"red":false} |
| 25 | t25-ring | item 11 the in-bar Segmented is 96 × 32, radius 9 | PASS {"w":96,"h":32,"r":"9px"} | PASS {"w":96,"h":32,"r":"9px"} |
| 25 | t25-ring | item 11 a segmented change slides the thumb over ≥ 6 frames to the second half, no haptic | PASS {"distinctX":16,"endX":48,"on":"Month","haptics":[]} | PASS {"distinctX":16,"endX":48,"on":"Month","haptics":[]} |
| 25 | t25-ring | console clean | PASS [] | PASS [] |
| item 9 | tsw-swipe | sw1 the pane follows the finger 1:1 | PASS 37 frames, max /Δ/ 0.00 px | PASS 36 frames, max /Δ/ 0.00 px |
| item 9 | tsw-swipe | sw1 a slow 100 px release rests at the 72 px reveal detent; the action is a ≥ 44 px button; no haptic | PASS {"x":-72,"rev":"left","btn":[72,68],"log":["reveal-left"],"h":[]} | PASS {"x":-72,"rev":"left","btn":[72,68],"log":["reveal-left"],"h":[]} |
| item 9 | tsw-swipe | sw1 a tap elsewhere closes the open row and reaches nothing (here: no menu) | PASS {"rev":null,"log":["reveal-left","reveal-none"],"menu":false} | PASS {"rev":null,"log":["reveal-left","reveal-none"],"menu":false} |
| item 9 | tsw-swipe | sw3 a 120 px flick at ≥ 600 px/s commits (full): the content leaves to W with its velocity, onCommit on completion | PASS x max 390; at onCommit x 390.0; frames between release and commit 19; haptics [] | PASS x max 390; at onCommit x 390.0; frames between release and commit 19; haptics [] |
| item 9 | tsw-swipe | sw3 the row the page keeps comes home | PASS x 0, checked true | PASS x 0, checked true |
| item 9 | tsw-swipe | sw4 a full delete: the row leaves by a ≈ 100 ms fade (a copy of its pane) | PASS removed at frame 28; the fading copy on 6 frames over 82 ms (opacity 1.00 0.55 0.34 0.18 0.06 0.00) | PASS removed at frame 30; the fading copy on 7 frames over 95 ms (opacity 1.00 0.83 0.59 0.38 0.21 0.08 0.01) |
| item 9 | tsw-swipe | sw4 ... while the rows below FLIP up on a spring (no one-frame jump) | PASS row 3 moved up 52 px over 14 frames; largest step 7.1 px | PASS row 3 moved up 52 px over 15 frames; largest step 7.3 px |
| item 9 | tsw-swipe | sw4 ... and what follows the list (the Reset button) moves with them | PASS moved 52 px over 14 frames; largest step 7.1 px | PASS moved 52 px over 15 frames; largest step 7.7 px |
| item 9 | tsw-swipe | sw4 the delete's toast carries Undo | PASS DeletedUndo | PASS DeletedUndo |
| item 9 | tsw-swipe | sw console clean | PASS [] | PASS [] |
| R1 | r1-popall | c1-chevron after an interrupted pop-all: the stack, the layers on screen and the URL agree; the root takes touches when the stack is empty | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} |
| R1 | r1-popall | c1-chevron the avatar then pushes Settings | PASS {"path":"/settings","stack":["/settings"],"layers":[{"key":"/settings#10","left":0,"vis":"visible"}],"hit":["pushed","pushed","pushed"]} | PASS {"path":"/settings","stack":["/settings"],"layers":[{"key":"/settings#10","left":0,"vis":"visible"}],"hit":["pushed","pushed","pushed"]} |
| R1 | r1-popall | c1-chevron console clean | PASS [] | PASS [] |
| R1 | r1-popall | c1-edge-catch after an interrupted pop-all: the stack, the layers on screen and the URL agree; the root takes touches when the stack is empt | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} |
| R1 | r1-popall | c1-edge-catch the avatar then pushes Settings | PASS {"path":"/settings","stack":["/settings"],"layers":[{"key":"/settings#10","left":0,"vis":"visible"}],"hit":["pushed","pushed","pushed"]} | PASS {"path":"/settings","stack":["/settings"],"layers":[{"key":"/settings#10","left":0,"vis":"visible"}],"hit":["pushed","pushed","pushed"]} |
| R1 | r1-popall | c1-edge-catch console clean | PASS [] | PASS [] |
| R1 | r1-popall | c1-go-catch after an interrupted pop-all: the stack, the layers on screen and the URL agree; the root takes touches when the stack is empty | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} |
| R1 | r1-popall | c1-go-catch the avatar then pushes Settings | PASS {"path":"/settings","stack":["/settings"],"layers":[{"key":"/settings#10","left":0,"vis":"visible"}],"hit":["pushed","pushed","pushed"]} | PASS {"path":"/settings","stack":["/settings"],"layers":[{"key":"/settings#10","left":0,"vis":"visible"}],"hit":["pushed","pushed","pushed"]} |
| R1 | r1-popall | c1-go-catch console clean | PASS [] | PASS [] |
| R1 | r1-popall | f3 lit-tab tap at depth 2: the middle page never shows between the root and the top layer | PASS 27 moving frames; frames with a depth-1 band: 0 [] | PASS 27 moving frames; frames with a depth-1 band: 0 [] |
| R1 | r1-popall | f3 the root rides the top layer: x = −0.3 × (W − x₂) ± 2, scrim 0.12 × (1 − x₂/W) ± 0.02 (depth-2 scrim 0) | PASS max root error 0.00 px, scrim error 0.000 | PASS max root error 0.00 px, scrim error 0.000 |
| R1 | r1-popall | f3 one tap ends on /today with no layer | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} | PASS {"path":"/today","stack":[],"layers":[],"hit":["root","root","root"]} |
| R1 | r1-pager | c2 after goTo(+5), the host back on the base date: the neighbours are the adjacent days | PASS {"prev":"2026-10-22","cur":"2026-10-23","next":"2026-10-24"} | PASS {"prev":"2026-10-22","cur":"2026-10-23","next":"2026-10-24"} |
| R1 | r1-pager | c2 goTo(+3), three swipes back to today, one left swipe: lands on tomorrow (not the old far date) | PASS {"date":"2026-10-24","commits":["2026-10-24"],"title":"Tomorrow"} | PASS {"date":"2026-10-24","commits":["2026-10-24"],"title":"Tomorrow"} |
| R1 | r1-pager | c2 goTo(+3) caught near home, then one left swipe: tomorrow | PASS {"date":"2026-10-24","commits":["2026-10-24"]} | PASS {"date":"2026-10-24","commits":["2026-10-24"]} |
| R1 | r1-pager | c3 a strip drag that pages: no element is left pressed | PASS [] | PASS [] |
| R1 | r1-pager | c3 a day swipe that starts on a card: the card is not left pressed | PASS [] | PASS [] |
| R1 | r1-pager | c3 a swipe from the large title: nothing left pressed | PASS [] | PASS [] |
| R1 | r1-pager | c7 a tap on a data-no-page orb inside the 400 ms after a day drag springs home gets its click | PASS {"clicks":1,"date":"2026-10-23","tapAfterReleaseMs":256} | PASS {"clicks":1,"date":"2026-10-23","tapAfterReleaseMs":252} |
| R1 | r1-pager | u1 a hold then a 150 px drag left on a draggable row in a pager page: the object drags, the pager stays (0 track movement, 0 commits) | PASS {"drags":["start 2026-10-23","end ok"],"moves":10,"commits":0,"xmax":0,"date":"2026-10-23"} | PASS {"drags":["start 2026-10-23","end ok"],"moves":10,"commits":0,"xmax":0,"date":"2026-10-23"} |
| R1 | r1-pager | u1 a hold then a move on a card with no drag still pages (exactly 1 commit, menu gone) | PASS {"commits":1,"menu":false} | PASS {"commits":1,"menu":false} |
| R1 | r1-pager | c6 --chrome-h measured under the recede equals the layout offset; a 600 px day still fills the scroller exactly | PASS {"before":{"chromeH":157,"layout":157,"scrollH":794,"clientH":794},"after":{"chromeH":157,"layout":157,"scrollH":794,"clientH":794}} | PASS {"before":{"chromeH":157,"layout":157,"scrollH":794,"clientH":794},"after":{"chromeH":157,"layout":157,"scrollH":794,"clientH":794}} |
| R1 | r1-pager | pager console clean | PASS [] | PASS [] |
| R1 | r1-pager | c3 an edge drag from the chevron that springs home leaves nothing pressed | PASS {"path":"/settings","pressed":[]} | PASS {"path":"/settings","pressed":[]} |
| R1 | r1-nav | u6 nav.replace on Today re-renders no useIsActiveTab caller | PASS {"today":0,"plan":0,"progress":0,"journal":0} | PASS {"today":0,"plan":0,"progress":0,"journal":0} |
| R1 | r1-nav | u6 a tab tap Today → Plan re-renders only the two callers whose flag flips (1 each) | PASS {"today":1,"plan":1,"progress":0,"journal":0} | PASS {"today":1,"plan":1,"progress":0,"journal":0} |
| R1 | r1-nav | u6 a sheet open and close re-render no useIsActiveTab caller | PASS {"today":0,"plan":0,"progress":0,"journal":0} | PASS {"today":0,"plan":0,"progress":0,"journal":0} |
| R1 | r1-nav | c4 nav.replace under an open sheet, then the sheet closes: the URL is the replaced one, the entry is no overlay, history.length unchanged | PASS {"before":{"path":"/today","nav":{"idx":2},"len":4,"todayPath":"/today","sheet":false},"after":{"path":"/today/2026-10-24","nav":{"idx":2},"len": | PASS {"before":{"path":"/today","nav":{"idx":2},"len":4,"todayPath":"/today","sheet":false},"after":{"path":"/today/2026-10-24","nav":{"idx":2},"len": |
| R1 | r1-nav | c4 the same under a hold menu | PASS {"path":"/today/2026-10-25","nav":{"idx":2},"len":5,"todayPath":"/today/2026-10-25","sheet":false} | PASS {"path":"/today/2026-10-25","nav":{"idx":2},"len":5,"todayPath":"/today/2026-10-25","sheet":false} |
| R1 | r1-nav | u5 a hold then a 140 px drag down on Today: the object drags; no pull to refresh (ring hidden, no REFRESH) | PASS {"refresh":0,"ptrMax":0,"drags":["start today","end ok"],"moves":10} | PASS {"refresh":0,"ptrMax":0,"drags":["start today","end ok"],"moves":10} |
| R1 | r1-nav | u5 a plain pull from the top still refreshes | PASS 1 | PASS 1 |
| R1 | r1-nav | u7 /journal/library and /journal reach the Journal root as different params | PASS [{"p":{"segment":"library"},"cut":true},{"p":{},"cut":false},{"p":{"segment":"library"},"cut":false}] | PASS [{"p":{"segment":"library"},"cut":true},{"p":{},"cut":false},{"p":{"segment":"library"},"cut":false}] |
| R1 | r1-nav | c11 useTabScroller() inside a pushed page returns the layer's .pushed scroller | PASS pushed | PASS pushed |
| R1 | r1-nav | nav console clean | PASS [] | PASS [] |
| R1 | r1-nav | u7 a cold start on /journal/library: useRouteParams() at mount has segment 'library' | PASS {"segment":"library"} | PASS {"segment":"library"} |
| R1 | r1-sheet | u2 medium of [medium, large]: scrolled to its end, the body's last line and the foot's Save are on screen | PASS {"detent":"medium","top":422,"last":758,"save":[788,836],"H":844} | PASS {"detent":"medium","top":422,"last":758,"save":[788,836],"H":844} |
| R1 | r1-sheet | u2 the foot's Save is hit-testable at medium | PASS true | PASS true |
| R1 | r1-sheet | f6 a tap on the grabber row away from its buttons (the title line) cycles the detent | PASS large | PASS large |
| R1 | r1-sheet | c13 the grabber is a button with a name, and Enter cycles the detent (large → medium) | PASS {"tag":"BUTTON","label":"Collapse sheet","hidden":null,"h":24,"after":"medium"} | PASS {"tag":"BUTTON","label":"Collapse sheet","hidden":null,"h":24,"after":"medium"} |
| R1 | r1-sheet | f2 a tall sheet when the keyboard comes: its top stays put on every frame (shrinks, never drops) | PASS top range 10.0–10.0 over 43 frames | PASS top range 10.0–10.0 over 39 frames |
| R1 | r1-sheet | f2 the focused field never jumps down and ends above the keyboard | PASS {"maxDownStep":0,"fieldBottom":119,"visible":508} | PASS {"maxDownStep":0,"fieldBottom":119,"visible":508} |
| R1 | r1-sheet | f1 gallery sheet flick-dismiss: the first frame after release moves (≤ 20 ms), no gap > 34 ms in the first 260 ms | PASS {"first":16.399999998509884,"maxGap":16.899999998509884,"writes":[[16,91.65],[33,135.14],[50,187.96],[66,250.7],[83,315.81],[100,376.36],[116,437 | PASS {"first":16.5,"maxGap":18,"writes":[[17,91.65],[33,135.14],[49,187.96],[67,250.7],[83,315.81],[100,380.07],[116,437.84],[133,495.02]],"closed":tr |
| R1 | r1-sheet | sheet console clean | PASS [] | PASS [] |
| R1 | r1-sheet | f5 a Plan session row (Easy 5): the sheet moves in the first frame after touchend (≤ 17 ms) | PASS first moved frame +16.8 ms (first frame after touchend +16.8, ty 777) | FAIL first moved frame +98.5 ms (first frame after touchend +98.5, ty 777) |
| R1 | r1-sheet | f1 Plan session sheet flick-dismiss: the first frame after release moves (≤ 20 ms), no gap > 34 ms in the first 260 ms | PASS {"first":16.300000000745058,"maxGap":16.800000000745058,"writes":[[16,91.65],[33,135.14],[50,187.96],[66,250.7],[83,315.81],[100,376.36],[116,437 | PASS {"first":15.399999998509884,"maxGap":17.900000002235174,"writes":[[15,87.74],[33,132.16],[50,184.43],[66,243.13],[82,308.15],[100,376.36],[116,43 |
| R1 | r1-press | u8 an element "pressable today-hero" gets .today-hero's own padding (18px), not the reset's 0 | PASS 18px | PASS 18px |
| R1 | r1-press | u3 the first tap on a revealed action commits it | PASS {"revealed":"left","log":["reveal-left","reveal-none","later-3"]} | PASS {"revealed":"left","log":["reveal-left","reveal-none","later-3"]} |
| R1 | r1-press | u4 Ticker +3.1 on springs.number: counts through intermediate values (≥ 8), no frame steps more than 0.5 and the last (the rest snap) ≤ 0.2 | PASS from 26.2: 20 distinct values, largest one-frame step 0.30, last 0.10 (26.2 26.3 26.5 26.7 27 27.2 27.5 27.7 27.9 28.1 28.3 28.4…) | PASS from 26.2: 20 distinct values, largest one-frame step 0.30, last 0.10 (26.2 26.5 26.7 26.8 27.1 27.3 27.6 27.8 28 28.2 28.3 28.5…) |
| R1 | r1-press | u4 WeekRing once-a-day fill on springs.number draws over several frames (≥ 6 distinct dash states) | PASS 44 distinct: 1 1 / 0 1 / 0.007855174270349874 1 / 0.040134536115290276 1 / 0.09744317214078524 1 / 0.17198776149725226 1 | PASS 45 distinct: 1 1 / 0 1 / 0.009423127397810815 1 / 0.02883665370585009 1 / 0.08942224597573745 1 / 0.14462037665383143 1 |
| R1 | r1-press | u9 a segment shows its press 60 ms into a touch (data-pressed, dimmed) | PASS {"pressed":true,"opacity":"0.632553","at":{"x":333,"y":397}} | PASS {"pressed":true,"opacity":"0.559494","at":{"x":333,"y":397}} |
| R1 | r1-press | press console clean | PASS [] | PASS [] |
| R1 | r1-a11y | c8 every tab root has a level-1 heading (its title) | PASS {"today":{"h1":["Easy"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"dead":[ | PASS {"today":{"h1":["Easy"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"dead":[ |
| R1 | r1-a11y | c10 no title-block part is a button that does nothing (Plan, Progress, Journal) | PASS {"today":{"h1":["Easy"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"dead":[ | PASS {"today":{"h1":["Easy"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"dead":[ |
| R1 | r1-a11y | c8 a pushed page's bar title is its level-1 heading | PASS ["Settings"] | PASS ["Settings"] |
| R1 | r1-a11y | c9 on a push, focus moves into the new page (its title) | PASS {"opener":"A.avatar:Profile and settings","afterPush":"H1.pb-title:Settings"} | PASS {"opener":"A.avatar:Profile and settings","afterPush":"H1.pb-title:Settings"} |
| R1 | r1-a11y | c9 on a pop, focus returns to the control that opened the page | PASS {"opener":"A.avatar:Profile and settings","afterPop":"A.avatar:Profile and settings"} | PASS {"opener":"A.avatar:Profile and settings","afterPop":"A.avatar:Profile and settings"} |
| R1 | r1-a11y | c10 a touch on the large title dims it (data-pressed, opacity ≤ 0.6) | PASS {"pressed":true,"opacity":0.55} | PASS {"pressed":true,"opacity":0.55} |
| R1 | r1-a11y | c10 at rest (inline title invisible) a tap there does not land on it | PASS {"opacity":0,"pe":"none","hitsInline":false} | PASS {"opacity":0,"pe":"none","hitsInline":false} |
| R1 | r1-a11y | c10 collapsed (inline title shown) it takes the tap | PASS {"opacity":1,"hitsInline":true} | PASS {"opacity":1,"hitsInline":true} |
| R1 | r1-a11y | a11y console clean | PASS [] | PASS [] |
| R1 | r1-push | c5 reduced motion: the parent never moves during a push or a pop (the layer only fades) | PASS max /parent x/ 0.0 px; push fade frames 7 | PASS max /parent x/ 0.0 px; push fade frames 4 |
| R1 | r1-push | f4 push settings: the first frame that shows the layer has ≤ 10 % of the slide gone, and the slide then plays (no held frame) | PASS first painted x 375.7 (4 % gone); next steps 33 42 41 42 38 31 28 | PASS first painted x 375.7 (4 % gone); next steps 33 55 46 38 36 31 26 |
| R1 | r1-push | f10 the pushed bar's trailing avatar keeps the root bar's 16 px gutter (same right edge ± 2) | PASS {"right":374,"rootRight":374} | PASS {"right":374,"rootRight":374} |
| R1 | r1-push | f11 an edge drag from x 12 to 132: the layer sits at clientX − x0 = 120 (x0 at pointerdown, no re-base at the lock) | PASS {"layerLeft":120,"expected":120} | PASS {"layerLeft":120,"expected":120} |
| R1 | r1-push | push-settings console clean | PASS [] | PASS [] |
| R1 | r1-push | f4 push morning: the first frame that shows the layer has ≤ 10 % of the slide gone, and the slide then plays (no held frame) | PASS first painted x 375.7 (4 % gone); next steps 33 9 43 41 41 37 32 | PASS first painted x 375.7 (4 % gone); next steps 33 22 20 44 39 40 33 |
| R1 | r1-push | push-morning console clean | PASS [] | PASS [] |
| R1 | r1-misc | u10 a sync that failed is retried by the next non-forced call (not handed back for 30 s) | PASS {"requests":2,"syncs":["err","ok"]} | PASS {"requests":2,"syncs":["err","ok"]} |
| R1 | r1-misc | u10 after a quiet forced sync, a non-quiet call inside the gap still sends and shows the status line | PASS {"requests":2,"statusLine":true} | PASS {"requests":2,"statusLine":true} |
| R1 | r1-misc | f8 frame-paced input (one move per 16 ms): the release velocity reads the finger's 1500 px/s (± 35 %) in most flicks | PASS release v: -1455, -1437, -1429, -1472 px/s | PASS release v: -1818, -1283, -1558, -1437 px/s |

</details>

Notes on the rows:

- **#2 (stub roots vs interim pages).** #2 is the shell's number: on the stub roots it passes at both rates (frame start +15–17 ms at 1×, +28–38 ms at 4×, budget 17 / 50). The rows marked `2·interim` measure the same tap over the old pages WP2/WP4 replace; they are reported, not hidden, and not counted in the totals. At 1× they pass; at 4× they vary run to run (60 ms tap: +17.9 to +95.7 ms; 120 ms tap: +48.2 to +53.9 ms). What is left there is the shown page's own style recalc and paint (the old Plan restyles ~430 nodes, 28 ms at 4×), and whether the preparation under the finger finished before it lifted. Before this step the same tap measured +62.6 ms (4×) and +21.8 ms (1×), with every tab's old page re-rendering on each URL change. The presented-frame rows (screencast compositor timestamps against a one-element change through the same pipeline) are informational: the floor itself varies 6–27 ms between runs.
- **Review round 1, sheet open at 4× (#12a, #12g, R1 f5).**
  - WP1 no longer forces layouts on an open. The sheet's H and safe top are cached and warmed in idle; they were 26.7 ms and 19.8 ms of JS at 4× per open in a CPU profile.
  - What is left is the body's own render and first layout. The body must render on the open (§C.1), and the `auto` detent needs its height.
  - The pre-fix and post-fix builds were measured on the same machine today, 3 runs each at 4×:

    | Check | Pre-fix | Post-fix |
    |---|---|---|
    | #12a | 70.8–92.6 ms | 70.6–134.3 ms |
    | #12g | 53.2–73.5 ms | 49.9–78.5 ms |

  - The distributions overlap and run-to-run noise dominates. The bound sits inside that noise for heavy bodies.
- **#12a at 4× (QA step note, still open).** The gallery's 40-paragraph stress sheet: Chrome dispatches the click ~19 ms after touchend at 4×, then the sheet spends ~24 ms in JS (React renders the panel and its body; one overlay `pushState`) and ~27 ms in the body's first style + layout, forced by the sheet's geometry read (`innerHeight`, the body's `offsetHeight` for the `auto` detent), before its first frame. Moving that read would only move where the number is sampled, not when the pixels appear. Measured over seven 4× runs: 70.7, 71.6, 74.9, 76.7, 80.3, 92.9 ms and one pass. The session sheet from Today's hero (#12g) passes in this run at +50.2 ms; over the same runs it read 44.7–82.2 ms. At 1× both pass (+15–21 ms). Left open: the body mounted after the first frame of motion (live report §5) needs the `auto` detent's height from somewhere else first (a measured placeholder or a `large`-first open).
- **#13's 1 px rule** cannot be reached with a CDP touch (the window is a few ms on the `pageFlick` overshoot; the critically damped `page` spring reaches |Δ| ≤ 1 only at its rest frame). Nearest honest equivalent (`t13b-onepx.mjs`): a flick, and a page-side watcher that dispatches pointerdown → pointerup → click on the first frame within 1 px of the target while the spring still runs.
- **#17's "Today scrolled 60"** is measured on the pager lab (a stub Today made only of WP1 primitives): the interim Today (WP2's old DayView) has no strip and its content fits the screen, so it cannot scroll 60 px.
- **#19** covers every root and pushed page that exists on this branch at 320: the interim SettingsView (WP6's) has `you`, `training`, `habits` and redirects the other five section names to `/settings`; `plans` is WP1's interim page. `.focus-strip` (WP2's, deleted by the spec) runs 16 px past the edge at 320 (clipped by the scroller) and is excluded with a request below.
- **#21** greps run over `ui/`, `app/`, `lib/` and `main.tsx` (WP1's half); the integrated-branch half runs after WP6 lands. Two gates were added: no other deprecated name used outside its adapter, and no `react-router` import in `ui/`, `lib/` or `app/` beyond the shell, the controller and the bridge's test stub.
- Rest = the completion frame (`restDelta 1`, `restSpeed 30`), as §10 defines it.

## Gates (rerun after review round 1)

| Gate | Result |
|---|---|
| `pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` | exit 0 |
| `pnpm --filter @logbook/shared test` | 88 passed |
| `pnpm --filter @logbook/api test` | 59 passed |
| `pnpm --filter @logbook/web test` | 75 passed (incl. `ui/nav.test.ts` 33, `ui/captions.test.ts` 14, `lib/haptics.test.ts`) |
| `pnpm --filter @logbook/web build` | ok; largest entry chunk 924,990 B raw / 304,010 B gzip (QA step: 918,950 raw) |
| `qa/t21-gates.sh` (#21, WP1's half) | 23 grep gates pass + the route/caption unit tests (47) |
| smoke (log in; four tabs; avatar → Settings → Training → back; This morning; Reads from Journal; `/settings/plans`; a sheet; a hold menu; `/dev/ui`) | 22/22 at 1× and 4×, console clean |

## Hand-verifiable steps (on the branch's build, a phone-sized window, touch emulation)

1. Log in (josh@example.com / password123). Expected: Today, four tabs (Today · Plan · Progress · Journal), no Morning tab, the tab bar fully on screen, no horizontal scroll.
2. Press and hold the Plan tab item for a moment. Expected: it scales to 0.97 on touch-down; on release Plan shows at once, no fade, no black frame, its icon lit.
3. Scroll Plan, switch to Today and back. Expected: Plan's scroll position kept; the same for Journal; Journal → Reads → Today → Journal shows Reads still pushed.
4. Today: tap the avatar. Expected: Settings slides in from the right over Today, which moves left 30 % under a light scrim; the tab bar never moves; Today stays lit. The bar: chevron, "Settings" centred, the ringed avatar.
5. Settings → Training, then tap the lit Today tab once. Expected: both layers slide off on one spring and you are on Today; tap again with Today scrolled: it scrolls to the top in ~350 ms; a third tap does nothing.
6. On a pushed page, drag from the left edge slowly to a third of the width and let go. Expected: it springs back. Drag fast past the middle: it pops, the parent comes back from −30 %.
7. Today's hero → its hold (450 ms). Expected: it grows slightly from 300 ms, lifts at 450 with the menu; the page dims around a cut-out where the hero stays bright; a tap on the hero closes the menu and opens nothing.
8. /dev/ui (Settings → nothing links it; type the URL): Sheets → "Medium ⇄ large". Expected: the sheet rises in one 500 ms curve, the page behind recedes to 0.92 with black around it; tap the grabber: large (10 px from the top); drag the body down 120 px at its top: it follows the finger; flick: it closes.
9. /dev/ui → Swipe rows: swipe a row 100 px slowly: it rests showing a 72 px button; swipe one fully: it leaves, the rows below glide up.
10. /dev/ui → Orb: tap it. Expected: one pop to 1.12 and back; the haptic pill at the bottom says `orb` once.
11. /dev/ui → "Open the pager lab": swipe the card left: the whole page pages, the bar's date and title cross-fade with the finger, the strip's disc slides; flick and touch the page mid-slide: it stops under the finger; scroll down 60 px: the bar collapses to "STEADY ·" + a centred "Today", the strip stays pinned.
12. Turn on reduced motion (OS setting) and repeat 4, 6 and 11. Expected: pushes and pages fade in 150 ms; the finger still drags pages 1:1.
13. Back button of the browser on a pushed page: it pops (history length unchanged); on a sheet: it closes the sheet only.

## Audit findings WP1 was to close

From the ranked top ten of `S/audit/critic.md` §4 (the "Closes" list of each item that is WP1's) and the critic's own C-items. **Fixed** means the WP1 primitive or shell does it and a test above measures it; where the page that uses the primitive belongs to another package, that is said.

| Finding | Status | Evidence / why |
|---|---|---|
| motion #1, nav F9, touch F15, live §3: pushed pages over black, tab bar gone | Fixed | `PushedLayer` over the mounted parent at −30 % under a 0.12 scrim; #9, #10, #2 (0 black frames on push/pop) |
| motion #2, nav F8, touch F3, shell F3, live §7: tab switch through black + fade, remount, forgets | Fixed | 0 ms cut, both opaque, mounted roots; #1, #2, #3 |
| nav F6, shell F2: every path change scrolls to the top | Fixed | no `window.scrollTo` in app/ (#21 gate); #13 "scrolled 220 → 220" |
| nav F7, shell S1: tabs forget route, scroll, pushed pages | Fixed | #3 |
| critic C4, live §8 (two taps home; the way home scrolls off) | Fixed (shell) | lit-tab tap pops all / goes home in one tap (#4); the sticky bar + pill (#17); WP2 registers `useHomeControl` |
| critic C2, motion #4, touch F2: the pager cannot be caught, drops velocity, renders neighbours late | Fixed (primitive) | DayPager v2: catch, catch-commit, velocity, neighbours always mounted; #13 (WP2 mounts it on Today) |
| critic C5, D3: no swipe affordance; the arrows | Fixed (primitive) | DateStrip + TodayPill; DayStepper renders only its hidden `dpager-sr` buttons; #13, #17 |
| motion #13, touch F16: the date-line swipe doesn't track; held arrows replay slides | Fixed | the strip and title row are `attach`ed to the pager (1:1, #13); no arrows |
| nav F4, visual F1, live §8: the caption truncates | Fixed (primitive) | `.nb-word` + `.nb-date` with full → short → day; #17 `RELENTLESSLY` fits at 320 |
| nav F5, touch F17: paging pushes history | Fixed (primitive) | ten pager steps add 0 entries (#13); the roots `replace` (WP2/WP4) |
| nav F17, S7: five headers | Fixed (primitive) | NavBar + PushedBar; `TabHeader`/`PushedHeader` are adapters over them (this step completed `PushedHeader`) |
| critic C6: the title flips with data | Fixed (primitive) | `dayTitle` from the route (`ui/captions.ts`, 14 tests); WP2 drops `dayTitleWord` |
| critic C7, visual F13: the week ring greets the day in red | Fixed | WeekRing: missed = `--ink-4` gap, no red, `marked`; #25 |
| nav F1, S1, D1: Morning is a second Today | Fixed (routes) | four tabs, `/today/:date/morning` pushed, `/morning` redirects; `ui/nav.test.ts` |
| nav F12: many doors, rewriting addresses | Fixed (routes) | the redirect table + `nav.go`; #22, #23 |
| motion #6, touch F14, critic C14, live §5 (sheet): lags, header-only drag, focus race, glitch before moving | Fixed | Sheet v3: 1:1 from header or body at top, velocity, detents, focus on completion, moves on the first frame; #12 |
| motion #7, touch F9, live §5 (press): no press state, five scales | Fixed | one press (0.97 / surface / dim) on touch-down everywhere incl. the tab bar; #1, #14 |
| motion #9, touch F7, D8: five hold clocks | Fixed | one 450 ms clock, visual pre-grow at 300; #14 |
| motion #14, touch F6, live §5 (hold): the lift clones every node; blurred scrim freezes | Fixed | lift in place, `.cm-hole` cut-out, no `backdrop-filter`; #14 |
| touch F10, D6: haptics mark navigation | Fixed | 0 haptics over 16 navigation actions (#15); `orb`/`toggle` only on the apex (#24) |
| motion #8, touch F8: swipe rows need 40 %, no fling, no detent | Fixed (primitive) | SwipeRow v2: 72 px detent, 0.55 W / 600 px/s, FLIP; `tsw-swipe` (WP2 replaces TodoList's own rows) |
| touch F5, shell F9: document-level non-passive `touchmove` | Fixed | none on document at rest or in any gesture; PTR's only on Today's scroller during its pull; #6 |
| shell F7: the keyboard shrinks the app | Fixed (web) / device day one | `Keyboard.resize: 'none'`, `--kb`, `kb-open`; #7 on the web; the native path is the device check |
| shell F16, F1 (splash part): splash hide untimed | Fixed | hidden once, ≤ 1 frame after the first content frame; #18 |
| critic C1 (foreground half WP1 kept) | Fixed (WP5) / kept | one bootstrap + `/strava/sync` in parallel, ≤ 2 requests; #18 |
| critic C8: the toast's per-frame DOM loop | Fixed | placement from the sheet store; #21 gate |
| critic C9: PTR padded to 500 ms | Fixed | ends on the fetch, busy only after 150 ms (`app/Shell.tsx`) |
| critic C11: Progress waits on unprefetched months | Fixed (prefetch) | `prefetchAll` adds Progress's 7-month range; WP6 renders what is loaded |
| live §11: toasts travel across tabs, 6.5 s | Fixed | 4 / 6 s from `lib/gesture.ts`, tab-scoped (#22g, #14 menu toast), above the tab bar and the sheet |
| live §12: controls hide under the tab bar | Fixed (shell) | the scroller ends at the tab bar's top (grid row); the page padding contract; WP5 made the bar opaque |
| visual F20: tab icons | Fixed | §1.1 icon weights; this step fixed the selected Sun |
| visual F7 (type scale), F9 (containers) | Fixed (tokens) | nine type sizes and four radii as tokens; `.card`/`.group`/`.row`; pages apply them (WP2–WP6) |
| visual F22: menus with eight items | Fixed (primitive) / request | ≤ 4 items dev-asserted; the hero (8) and Plan rows are WP2's/WP4's to trim (requests) |
| touch F18: small hit areas | Fixed (WP1 controls) | tab items, strip cells W/7 × 52, the title block's three parts 44 tall, chevron 44 at x 0 (this step); #19 |
| critic D4: prototype `scroll-snap` first | Rejected | the spec chose the JS pager with one motion value (decisions, v4); everything D4 wanted from scroll-snap (interruptible, velocity, nested gestures arbitrated) is measured in #13/#14 |
| nav S4: Settings as a modal | Rejected | spec D5: pushed in Today's stack (one presentation, the edge swipe works, Today stays lit) |
| live §5: press via `:active` or `whileTap` | Rejected | `[data-pressed]` set synchronously on pointerdown (WebKit delays `:active` on touch; `whileTap` re-renders); #1 |
| live §12: 0.85-alpha glass bar | Rejected | WP5 made the bar opaque (no `backdrop-filter` anywhere, a gate) |
| motion #9's two clocks (300 lift + 450 menu) | Rejected | D8: one 450 ms clock; 300 is a visual pre-grow only |

Findings in the same audits that belong to other packages (not WP1's to close): the hero pull to Morning (nav F11, touch F11: WP2), the midnight rollover (C3: WP2), the two-session day (nav F13, touch F12: WP2), Plan's row swipe and pinch (nav F14, C10 removal: WP4), Morning's schedule (motion #3, F21: WP3), copy and page rhythm (visual F3–F6, F10–F12, F15–F19: WP2/WP6).

## Requests for other packages
- **Review round 1.**
  - **WP2.** The session sheet's body (the session card) takes about 47 ms to render and 11–15 ms to lay out at 4× on the open. That decides feel review 1 #5 and §14 #27's 70 ms. Mount less on the open, for example the stamps and the big Done first.
  - **Contracts §D.1.** Add `forScale(t)` and `forRange(t, span)` (`lib/motion.ts`) for unitless values (scale, pathLength, Tickers). The contract's px rest thresholds end such springs on frame one (consumer review 1 #4).
  - **Contracts §A.2.** `useRouteParams` and `useRootRequest` also carry `segment` (`'library'` on `/journal/library`).
  - **Contracts §A.3.** A paged root may use `.page-root`: full-bleed, no gutter, no padding.
  - **Spec §9.2.** Consider a sampled velocity tracker (the last 50–100 ms) in place of `x.getVelocity()`. With frame-paced input the two agree (feel review 1 #8), so this is a device-day check.
  - **Spec §2.3.** The stacked labels overprint mid-drag (feel review 1 #9); an offset or a slide reads cleaner.
  - **Spec §2.6/§2.7.** The pushed bar now has 60 px columns and a 16 px trailing gutter, so the avatar keeps the root bar's position.

- **WP2 (Today)**: mount `DayPage` in `DayPager` with `NavBar` + `DateStrip` (attach the strip and `titleRef`), keep the cur page cheap to restyle (the tab switch restyles the shown tab's whole subtree: the old Plan's ~430 nodes cost 28 ms at 4×), memoise the three pages; the hero menu to 4 items (Done · Skip · Move · Share) on `Pressable holdMenu` + `ignore` (drop `useHoldMenu`/`useLongPress`); `.focus-strip` leaves the top of the page (it runs 16 px past the edge at 320 today); `enterKeyHint` on quick-add; `hideSplashBy(900)` for the first-run face; `useHomeControl` and `useRootRequest` in DayView.
- **WP3 (This morning)**: `PushedBar` with the date eyebrow (the adapter does it today); the flyer's real ends (`entry.shared`).
- **WP4 (Plan)**: PlanView on `DayPager step="week"` with memoised pages and `Segmented in-bar` in the 96 px slot; the Plan row menu to 4 (Done · Skip · Move · Delete) on `Pressable onDragStart` (drop `useDayDrag`'s own lift so the hole tracks a real lift); `PlansPage` for `/settings/plans`; MISSED not in red (visual F16).
- **WP6**: the eight Settings sections (`connections`, `app`, `data`, `account` redirect to `/settings` on the interim page); Journal on `NavBar` + `useRootRequest`; the quote ContextMenu `preview` goes; onboarding's Pressable `animate` nudge goes; drop `TAB_RESELECT`.
- **All**: `features/sessions/sessions.css` uses `.dp` for its day picker, colliding with the contract's `.dp` (WP1 outranks it with `.dp[aria-roledescription='pager']`; rename theirs, e.g. `.dpk`); scope test selectors to `.dp-page[data-role=cur]` (neighbours are always mounted); no new imports of the names listed under "Delete at integration".
- **Spec (`docs/feel.md`, requests only)**: §2.7's literal `.nb-title { margin: 4px 16px 0; height: 40px }` contradicts §2.3's "44 tall" target; WP1 keeps §2.1's geometry with the 4 px as padding. §9.1 says pointerup gives the old tab `visibility: hidden` + `inert`; WP1 does it in the task after the cut's frame (and prepares the new tab during the press) for the §9.1 budget; nothing visible differs.

## Contract notes (behaviour as contracted, mechanism different)

- **Review round 1.**
  - `LayerControl` is internal. `leave(done(left))` answers every caller, and a two-layer pop is one slide with the middle page covered.
  - A drag-capable hold claims its pointer from the lift (`pointerClaimed`, `ui/useHold.ts`).
  - A sheet releases its overlay entry when it is gone. Back, a tab tap or a jump during the close still find it.
  - `nav.replace` under an overlay writes once the overlays are released.
  - `RouteAt` also resets react-router's `RouteContext`, so the old pages no longer re-render on any router location change.

- `RouterBridge` installs an adopter (`ctl.setAdopter`) rather than watching `location.key` (react-router can batch its PUSH with the POP of a pending traversal into one render; a key-keyed effect missed writes). #23 measures the contracted behaviour.
- The interim `<Routes location>` wrapping of contracts §A.3 is `RouteAt` (a memoised `LocationContext` per root and layer) around `<Routes>`: the old pages read the same params, and a URL change no longer re-renders them.
- Inactive tabs are `visibility: hidden` + `inert` at rest as contracted; around a switch the leaving tab keeps painting for one frame and the target tab is prepared under the active one during the press (`[data-leaving]`, `[data-preparing]`, `.tab[data-active] { z-index: 1 }`).

## Delete at integration (after WP6 lands; each still imported by a feature file today)

- `ui/headers.tsx`: `TabHeader` (adapter over NavBar), `PushedHeader` (adapter over PushedBar), `BackButton({onBack,label})`, `dateLine`, `usePushedBack`: DayView, MorningView, PlanView, JournalView, ProgressView, ReadsView, SettingsView, HabitsPage, TrainingPages.
- `ui/DatePager.tsx` (adapter over DayPager): DayView, MorningView, PlanView.
- `ui/DayStepper.tsx` (hidden sr buttons only): DayView, MorningView.
- `ui/useLongPress.ts` / `LONG_PRESS_MS` (adapter over `useHold`): `day/useHoldMenu.tsx`, `habits/OrbRow.tsx`, `sessions/SessionCard.tsx`, `settings/HabitsPage.tsx`.
- `ui/nav.ts` `TAB_RESELECT` / `TabReselectDetail` (never dispatched): JournalView.
- `lib/motion.ts` `springs.press`, `spring`, `springSoft`, `tween`, the variants, `rowPresence`.
- `lib/useDrag.ts` `DROP_SPRING`, `LIFT`, `REST`, `liftFx`, its `HOLD_MS` re-export.
- `ui/Sheet.tsx` `shared()`, `SheetSpec.layoutId`: Week.tsx, SessionCard and other session openers.
- `ui/Pressable.tsx` `pressScale`, `onLongPress`, and the motion props `animate`/`initial`/`transition` (onboarding/controls.tsx).
- `ui/ContextMenu.tsx` `preview` (journal/JournalHome.tsx).
- `ui/SwipeRow.tsx` `SWIPE_COMMIT/LOCK/RUBBER` re-exports.
- `ui/primitives.tsx` `DayStrip` (WP2's DayView).
- `styles/tokens.css` `--sp-primary` (journal, progress, reads css).
- `app/RouterBridge.tsx`, `App.tsx`'s `InterimPlans`, `Shell.tsx`'s `RouteAt`/`ROOT_ROUTES` interim wrapping, `app/dev/StubRoots.tsx`'s react-router stub button (with the bridge).

## Device day-one checks (not doable here)

Added in review round 1:
- the pager's release velocity with real touch input (feel review 1 #8);
- the stacked labels mid-drag (#9);
- a tall sheet with the keyboard up, which keeps its top and pads its body by `--kb`.


`Keyboard.resize = 'none'` + `--kb` on an iPhone build; the splash on the first content frame; the edge swipe in the standalone PWA and a Safari tab; inner-scroller `scrollTop` during the rubber band; the strip drag's direction (risk 16); routine-step reorder through hold → move (risk 9); the stacked labels in WebKit; the sheet's `bottom: var(--kb)` with a field focused; the tab preparation on a real press (iOS's tap timing).

## Screenshots (looked at, each one)

Review round 1:
- `S/wp1/qa/shots/after-<390|320>-*.png` is this build.
- `S/wp1/qa/shots-qa0/after-*.png` is the QA-step build.
- Side by side: `S/wp1/qa/shots/cmp-fix1-{root-today,settings,root-plan,sheet-medium,this-morning}.png`. They show the avatar on Settings keeping the root bar's gutter, the medium sheet's Save reachable, and the U8 side effects above.
- `scrollWidth` = width on every state at 390 and 320; console clean.


S/wp1/qa/shots/, `after-<390|320>-<state>.png` (this build) and `before-<390|320>-<state>.png` (the base, `claude/hopeful-einstein-eunarl`):
`root-today`, `root-plan`, `root-progress`, `root-journal`, `today-scrolled-60` (the interim Today cannot scroll 60: see `lab-scrolled-60`), `lab-rest`, `lab-scrolled-60` (bar collapsed, strip pinned, the word visible), `settings` (Today's avatar), `settings-training`, `this-morning`, `reads`, `settings-plans`, `hold-menu-hero`, `sheet-medium`, `sheet-large`, `toast`, `pager-mid-drag` (after only: the base gallery has no DayPager; its sheet shots are the Plan session sheet). The base overflows horizontally on Today (`scrollWidth` 406 at 390, 336 at 320) and pushes the tab bar half off screen; this build is 390 / 320 everywhere, console clean.
