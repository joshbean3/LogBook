# WP1 review: shell and navigation foundation

Branch `feel/wp1`, on `claude/hopeful-einstein-eunarl` (WP5 merged there; nothing of it undone). Spec `docs/feel.md` v4.2 §1, §2, §9–§14; build plan §2; contracts §A–§E, §G. WP5's review is `docs/reviews/wp5.md`.

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`. Everything below was measured on this worktree's `VITE_FAKE_CLOCK=1` build served by `apps/api` on port 8791 (seed copy `S/wp1/test.db`), Playwright 390 × 844, DPR 2, `isMobile`, `hasTouch`, CDP touch, at 1× and 4× CPU (`Emulation.setCPUThrottlingRate`).

## How to rerun

- Build and serve: `bash S/wp1/build.sh && bash S/wp1/serve.sh` (the server reads `index.html` once: restart after every build).
- The battery: `node S/wp1/qa/run.mjs` runs every script of `S/wp1/qa/` at 1× and 4× (`CPU=<rate>` per run) and prints the table below (also written to `S/wp1/qa/results/TABLE.md`, with each run's log in `results/<script>.cpu<rate>.log`). `ONLY=t02-cut,t13-pager node run.mjs` runs a subset, `RATES=4` one rate, `--table` rebuilds the table from the result files.
- Late in the real day (after 18:00 New York), add `SHIFT_MIN=auto` (it puts the page at 13:30 New York on the same date; a number of minutes works too). The interim Today shows its evening face then, with no hero; `qa/lib.mjs` shifts only the page's `Date`.
- Round 4's before/after states: `node S/wp1/qa/shots-r4.mjs <390|320> <before|after>`; before = `265169e` plus the gallery hooks, served by `S/wp1/r4pre/serve.sh` (run `serve.sh` after). The R4 checks alone: `ONLY=r4-sheet,r4-nav,r4-layer node run.mjs`.
- Round 2's before/after states: `node S/wp1/qa/shots-r2.mjs <390|320> <before|after>`. Before = the pre-fix archive, served by `S/wp1/r2pre/serve.sh`.
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
| review round 2 | see "Review round 2" |
| review round 3 (`a5ed929` and the commit after it) | see "Review round 3" |
| review round 4 | see "Review round 4" |

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

## Review round 2 (three reviews of `5219e4e`: code, consumer, feel)

The reviews are `S/wp1/review-code-2.md` (C2-#), `S/wp1/review-consumer-2.md` (U2-#) and `S/wp1/review-feel-2.md` (N#). The full record is `S/wp1/fix-2.md`: each finding, then what was done, then the proof.

How each finding of severity 3 or more was proved:
- it has a check in `S/wp1/qa/r2-layer.mjs`, `r2-sheet.mjs`, `r2-misc.mjs` or `r2-captions.mjs` (battery section `R2`), or a unit test;
- the check failed first on the unfixed code: a `git archive` of `5219e4e` plus this round's two gallery hooks, served by `S/wp1/r2pre/serve.sh`, with logs in `S/wp1/qa/results-r2-before/`;
- it passes after the fix, at 1× and 4× (`S/wp1/qa/results/r2-*.cpu{1,4}.log`).

Before → after, all R2 checks: `r2-layer` 7/20 → 20/20, `r2-sheet` 3/13 → 13/13, `r2-misc` 4/5 (1×) and 3/5 (4×) → 5/5, `r2-captions` 0/1 → 1/1, at each rate.

| Finding | Status | Fix | Check: before → after |
|---|---|---|---|
| C2-1 [4] an edge pop caught short of halfway is popped anyway (a cut, history back) | Fixed | The layer's own waiters (`popSelf`, the edge commit) honour `left` (`ui/PushedLayer.tsx`) | `/today`, `pop` emitted → `/settings`, layer at 0, no pop |
| C2-2 [3] a depth-1 layer mounted at rest as a depth-2 layer goes is drawn at −117 | Fixed | `shownX` is resynced in the layer's layout effect, after the depth-2 cleanup reset `offsets[1]` | left −117, a hit test finds bare `SECTION.tab` → left 0, the layer takes the touch (cut and Back paths) |
| C2-3 [3] a caught layer freezes when dragged back toward home | Fixed | A caught gesture locks x in either direction; a fresh edge drag still only rightward | layer frozen over a 120 px finger move, then popped → offset spread ≤ 2 px, rests at 0 |
| N1 [3] a second tap during a push opens the page sliding in | Fixed | A pointerdown on the layer outside the edge band while its spring is > 1 px from its target swallows its click (UIKit: no content touches during a transition) | `/settings/you` at layer x 218…3 → `/settings` only; a tap at rest still opens the section |
| U2-1 [3] `sheet.push`/`pop` on an `auto` sheet jumps the box (715 px in one frame) | Fixed | FLIP (§10.1): the box keeps max(old, new); a transform-only `shift` (not sheetY: scrim and recede stay) travels the top on `springs.page`, clocked from the frame that paints the new panel; at rest the box takes the new height in the same frame | 1 step of 715 / 180 px → 32 / 26 frames, largest step 11 % of the travel, ends where it opened |
| U2-2 / N3 [3] a medium sheet dragged up shows an empty band | Fixed | `--sheet-inset` drops to 0 on the first upward move above the detent (once, at the gesture's start); a rest at the smaller detent restores it | body ends at 644, three empty hits → 1056, all hit the body; Save still reachable at medium |
| N2 [3] sheet open at 4×: the first painted frame already 27–52 % up | Fixed | The open is clocked from the frame that paints the sheet: one frame in on that frame, two on the next, then the tween's own clock (as `startPush`) | writes 31–44 % up right after the painting frame (allowed 18.8 %) → no write ahead of the frame-anchored curve, 3/3 opens per rate |
| U2-3 [3] captions build an `Intl.DateTimeFormat` per call (the top JS item of a 4× tab cut) | Fixed | One cached formatter per option set (`ui/captions.ts`); unit test | a Today render's ≈ 24 calls 6.9 ms → 0.1 ms at 4×, median (1.4 → 0.1 at 1×) |
| C2-4 [2] a pop-all's completion writes over a push made during its spring | Fixed | It writes and emits nothing when the stack is no longer empty | `/today` + stray `pop` → `/dev/ui`, no pop |
| C2-5 [2] a pop finishing after a tab tap leaves its entry; Back rebuilds the closed page | Fixed | `activate` runs the leaving tab's pop history rule first (`settleLeaving`; `LayerControl.leaving()`, `removeLayers` keys) | Back → `/settings` rebuilt → `/today`, no layer |
| C2-6 [2] a multi-detent sheet focuses its grabber on open | Fixed | `.sheet-grab-bar` excluded from the first-field search | "Expand sheet" → "Push" |
| C2-7 [1] pull to refresh has no keyboard / VoiceOver path | Rejected (spec gap), request | §9.5 defines only the pull; the title menu is WP2's | — |
| U2-4 [2] `sticky` on an inner panel is ignored | Fixed | The scrim honours `sticky` from any panel in the stack | closes → stays open |
| U2-5 [2] contract text lags; `springs.complete` as written is a one-frame flash | Fixed in the module; text is a request | `springs.complete` carries scale rest thresholds (every listed use is a scale); `lib/motion.test.ts` with motion's own generator | 2/3 tests fail → 3/3 (> 10 frames, peak > 1.125) |
| U2-6 [1] a non-quiet sync during a quiet one sends a second request | Fixed | It rides the running quiet request and raises the status line until it settles | 2 requests → 1, status line shown and cleared |
| N4 [2] This morning push at 4× starts 107–247 ms after the tap | Rejected (WP3's) | WP1's part (start on the first painted frame) holds (`r1-push f4`); the delay is the interim MorningView's mount | — |
| N5 [2] Escape at 4× pays a 55–89 ms long task | Fixed | **Cause:** `data-input` on `<html>` read by `:root[data-input='pointer'] :focus-visible` restyled the whole document on every keyboard/pointer switch. **Fix:** `ui/focus.ts` marks only the focused element `data-quiet-focus` (pointerdown, touchstart, focusin under a pointer; a key clears it); the root rule is gone | long tasks 56/81/55 ms → none; ring shown after Escape, hidden after a touch |
| N6 [2] tab cut at 4× 46–80 ms | Partly fixed (U2-3), rest open | the captions' JS is gone; the rest is the interim pages' restyle (#2·interim) | see #2 below |
| N7 [1] keyboard raise at 4× costs one long frame | Rejected for now (device check) | `--kb` on the root is the contract every package codes against (§9.4); a once-per-focus event | — |

Harness note: the final battery started at 18:40 New York time, when the interim Today shows its "Close the day" face (no hero), which fails every hero-based check on any build (the pre-fix build too). `qa/lib.mjs` takes `SHIFT_MIN` (shifts the page's `Date` only; motion, rAF and `performance.now` untouched); the battery ran with `SHIFT_MIN=-300` (13:40 New York, same date).

## Review round 3 (three reviews of `08e4764`: code, consumer, feel)

The reviews are `S/wp1/review-code-3.md` (C3-#), `S/wp1/review-consumer-3.md` (U3-#) and `S/wp1/review-feel-3.md` (R#). The full record is `S/wp1/fix-3.md`: each finding, then what was done, then the proof. The fixes are two commits: `a5ed929`, and the commit after it with the four defects its first full battery run found.

How each finding of severity 3 or more was proved:
- it has a check in `S/wp1/qa/r3-layer.mjs`, `r3-nav.mjs` or `r3-sheet.mjs` (battery section `R3`), or a unit test in `lib/motion.test.ts`;
- the check failed first on the unfixed code (`08e4764` plus the gallery hook, served by `S/wp1/r3pre/serve.sh`; logs `S/wp1/qa/results-r3-before/` and, for the checks rewritten after the container restart, `results-r3-before-rev/`);
- it passes on the final build at 1× and 4× (`S/wp1/qa/results-r3-final/`).

Before → after, at 1× and 4×:
- `r3-layer`: 5/16 and 7/16 → 16/16.
- `r3-nav`: 7/17 → 17/17.
- `r3-sheet`: 8/28 and 9/28 → 28/28.
- `motion.test.ts`: 3 of the new tests failed → 9/9.

| Finding | Status | Fix | Check: before → after |
|---|---|---|---|
| C3-1 [3] reduced motion: an edge touch during the 120 ms crossfade freezes the page part transparent over an inert root | Fixed | A pointerdown in the edge band during a reduced crossfade completes it (its completion runs, the pop sequence for a pop) and swallows that touch's click; `home()` restores the fade (`ui/PushedLayer.tsx`) | opacity 0.667 / 0.256 / 0.081 at rest → 1, a completed pop, one pop for a double tap |
| U3-1 / R3 [3] a medium sheet nudged up throws Save 412 px off screen and back | Fixed | The inset still drops on the first upward move; the body's sticky feet are translated by −clamp(y, 0, dropped) from the sheet's one synchronous writer, so they stay on the screen's bottom (`ui/Sheet.tsx`) | Save off screen on 58–76 frames, a 412 px jump → 0 frames, largest foot step 0–5 px |
| U3-2 [3] (C3-7, R6 [2]) the inner-push FLIP cannot be caught; a tap at the panel's back control closes the sheet | Fixed | The sheet's pointerdown holds the FLIP where it is drawn; a drag folds it into sheetY and settles on the detent rule, a tap lets it go on. Both `stop()`s (sheetY, the layer's x) stop where drawn (`ui/Sheet.tsx`, `ui/PushedLayer.tsx`) | the grabber travels 342 px under a still finger → 0 px; the back control pops the panel instead of closing the sheet |
| U3-3 [3] `springs.lift` / `settle` / `number` on a unitless value end on their first frame | Fixed in the module | `springFor`'s type is motion's spring wrapped (`unitAware`): px rest thresholds for a move of 5 units or more, `forScale`'s under 5; thresholds a caller sets are kept. The deprecated `springs.press` keeps its old behaviour (contracts rule 5) (`lib/motion.ts`) | 0 frames → > 5 frames, ends on target; px moves frame for frame identical to motion's own spring (unit tests) |
| R1 [3] a sheet opened while a page pops turns the screen black | Fixed | A layer on its way out (`ctl.isLeaving`) covers nothing; recomputed on every nav change while the sheet is up (`ui/Sheet.tsx`, `app/NavController.tsx`) | 7–12 black frames, root `hidden` → 0, `visible` |
| R2 [3] a sheet opened during a pop leaves the URL on the closed page | Fixed | `openOverlay` settles a leaving page's history first and writes the overlay entry on the page that stays (`app/NavController.tsx`) | `/settings` with Today shown, a reload rebuilds Settings → `/today`, a reload shows Today |
| R4 [3] a second tap on a sheet's opener closes the sheet | Fixed | A scrim tap while the sheet moves (> 1 px from its detent, the fade under 0.99, an inner FLIP) closes nothing | the sheet sinks away at +60/150/250 ms → stays open; a scrim tap at rest still closes |
| R5 [3] the page under a push or a pop takes taps during the transition | Fixed | While a layer moves, a capture pointerdown on the page under it goes no further and its click is swallowed (`ui/PushedLayer.tsx`) | Today's word sheet opens on a chevron double tap → popped once, nothing opened; at rest the same tap works |
| C3-2 [2] reduced motion: N1's swallow never arms | Fixed | `transitioning()` covers a running crossfade | `/settings/training` → `/settings` (the check now taps page-side in the fade's first frame, see fix-3) |
| C3-3 [2] a tab tap during a jump's pop traverses over the jump's entry | Fixed | `settleLeaving` acts only on pops whose history rule is still owed (`owed`) | Back → `/today` → `/today/2026-10-20` |
| C3-4 [2] a cross-tab jump during a pop leaves the closed page's entry | Fixed | `go`'s cut settles the leaving tab first; under an adopted write the entries are marked (`redirect`) | Back rebuilds `/journal/reads` → `/journal`, stack `[]` |
| C3-5 [2] Back onto the root, caught: the page stays, the URL says `/today` | Fixed | `restoreTop`: history steps forward onto the page's own entry, or a replace | `/today` idx 0 with Settings shown → `/settings` idx 1; the next Back pops it |
| C3-6 / U3-6 [2] a click swallow outlives a touch that makes no click | Fixed | New `ui/clickSwallow.ts`: the swallow belongs to its pointer, expires 400 ms after its up, never eats a `detail === 0` click; PushedLayer and SwipeRow use it | Enter after a scroll during a push: nothing → `/settings/you`; SwipeRow: 0 → 1 click |
| U3-4 [2] toasts ignore the FLIP shift | Fixed | The store's `height` is the visible height during a FLIP | 27 frames over the content, 657 px jump → 0 frames, the toast's step never more than the sheet's |
| U3-5 [2] `sheet.open()` over an open sheet cuts the box | Fixed (auto → auto) | A panel change in the same sheet (`gen`): the box FLIPs, the content crossfades | 715 px step → 72 px (1×), 103 px (4×) |
| U3-7 [1] `ToastAction` / `createToastStore` not where the contract puts them | Fixed | Re-exported from `ui/Toast.tsx` and `@/ui` | a probe import typechecks (TS2305/TS2459 before) |
| U3-8 [1] a retargeted FLIP drops its velocity | Fixed | The new spring starts from the shift's speed, measured from its last two frames without motion's 30 ms cap (the cap read 0 at 4×) | reversal −20.9 px → keeps direction at 1× and 4× |
| C3-8 [1] / C2-7 pull to refresh has no keyboard path | Rejected (spec gap), request stands | §9.5 defines only the pull; the control is WP2's title menu | — |
| N2, N4, N6 [2] 4× mount and tab-cut times | Open, not WP1's | WP1's halves hold (`r2-sheet n2`, `r1-push f4`, `t02-cut` stub roots at 1×); the rest is the interim pages' render (WP2, WP3, WP4 requests) | — |
| N7 [2] the keyboard's `--kb` restyle at 4× | Rejected for now (device check) | `--kb` on the root is the contract every package reads | — |

Defects found by this round's own final battery (after `a5ed929`) and fixed in the second commit:
- **A tap on an open sheet ended the next inner push's FLIP on its first frame** (round 2's U2-1 regressed, 715 px cut). `snapTo`'s rest now ends only a FLIP a drag folded in. `r2-sheet` u1: 2 frames → 32 frames.
- **The deprecated `springs.press` had become a spring** (the old hero's press). It is the old px spring again. t34: pixel 135 → 139 → 135 → 135.
- **The gallery hook "Open another" sat under t12 #28's touch.** It moved below the 40 lines.
- **U3-8's velocity read 0 at 4×.** This is the uncapped measure above.

**Environment note.** The round resumed after a container restart. On this container the unfixed `08e4764` fails the same first-frame and 4× cadence checks as the final build (t12 12a/12g, r1 f5, t02 stub roots at 4×, t13 15c, r2-sheet u1 at 4×, the r2-layer catch windows at 4×). The side-by-side numbers are in fix-3. Five checks were rewritten to keep their precondition on a slow machine, and each still fails on the unfixed build:
- c3-2, u3-8 and u3-5 in `r3-layer` / `r3-sheet`;
- u3-4's jump measured against the sheet's own step;
- r2-layer c2-3. Its 120 px drag only passed because motion's `stop()` let the layer run on 48 px under the finger at the catch, which this round fixed.

## Review round 4 (three reviews of `265169e`: code, consumer, feel)

The reviews are `S/wp1/review-code-4.md` (C4-#), `S/wp1/review-consumer-4.md` (K4-#) and `S/wp1/review-feel-4.md` (D1 and the carried F/N/O items). The full record is `S/wp1/fix-4.md`: each finding, then what was done, then the proof. One commit.

How each finding was proved:
- **A check for each.** Every finding of severity 3 or more, and every severity-2 finding that was fixed, has a check in `S/wp1/qa/r4-sheet.mjs`, `r4-nav.mjs` or `r4-layer.mjs` (battery section `R4`, 40 checks).
- **It failed first.** Each check failed on the unfixed code: `265169e` plus this round's gallery hooks, in `S/wp1/r4pre/dist`, served by `S/wp1/r4pre/serve.sh`. Logs: `S/wp1/qa/results-r4-before/`, at 1× and 4×.
- **It passes now.** Each passes on the final build at 1× and 4× (`S/wp1/qa/results-r4-final/`).

Before → after, 1× and 4×:
- `r4-sheet`: 8/22 → 22/22.
- `r4-nav`: 3/8 → 8/8.
- `r4-layer`: 5/10 → 10/10.

The "control" checks pass on both builds by design; they hold what this round must not lose.

| Finding | Status | Fix | Check: before → after |
|---|---|---|---|
| C4-1 [3] a detent change that is not a drag (grabber tap, Enter on the grabber, the keys coming up, a release from large) throws Save off the screen and back | Fixed | One pin rule for the sticky feet. While the sheet is between its detents with no inset, they are translated up by `min(cap, yv)`. It is armed by every `snapTo` whose inset changes, by a drag up from medium and by a drag down from large, and cleared on the frame the inset is back (`ui/Sheet.tsx`) | Save off screen on 39–80 frames, 412 px one-frame jumps → 0 frames, largest step 0 px, on all seven paths at 1× and 4× |
| K4-1 [3] `open()` over an open sheet ignores the new spec's detent (stays `auto` at full height; or keeps a stale `medium` with a 412 px inset) | Fixed | A `gen` change with another box kind or rest detent goes to the new spec's rest detent (`redetent`). The commit frame keeps the top where it was, then the sheet springs to the new detent through `snapTo`. An auto box drops the old inset before it is measured. The mount-once listeners read the current box and geometry (`latest`) | top 10 / `auto` → 422 / `medium` with Save on screen; stale `medium`, box 531, an 834 px step → `auto`, inset 0, box 119, largest step 23.7 px; reduced motion too |
| K4-2 [2] `onClose` of the specs `open()` replaces never runs | Fixed | `open()` over an open sheet runs the replaced specs' `onClose`. An inner `pop()` runs the popped panel's | `["close-auto2"]` → `["close-auto","close-medium","close-auto2"]` |
| C4-2 [2] a pop that starts under a sheet: the root hidden (black) for the whole slide; after `nav.pop()` the URL is the closed page's | Fixed | A leave notifies the store's listeners (`leavingChanged`), so the sheet's covered set is recomputed at the slide's start. `pop` and a lit-tab `popAll` close overlays first, as `push`, `go` and `activate` do (`app/NavController.tsx`) | hidden on 20–32 of 20–32 sliding frames, 16–18 black → 0 and 0; `/dev/ui`, rebuilt on reload → `/today` on Today's own entry, Today on reload |
| C4-3 [1] one pop, two `pop` events (chevron + Back inside its spring) | Fixed | `removeLayers` reports whether it took the layers off itself. A pop-all or `popDownTo` that rode along a pop dispatches nothing | `['pop:/today','pop:/today']` → `['pop:/today']` |
| D1 = K4-3 [2] a tap is dead for ~100 ms while the screen already looks at rest | Fixed | `ARRIVED_PX = 8` (`lib/gesture.ts`). R5's and N1's guards and R4's scrim guard arm only further out. Inside the band, a pointerdown completes the push or pop on that event (`arrive`) and the tap goes through. A push still swallows a tap on the page it is covering. The edge band keeps §10's 1 px rule | Training row at 2.5 px, hero at 2.4–3.4 px, scrim at 1.6–2.6 px: swallowed → act; the 120 ms scrim tap (R4) and the 60–250 ms double taps (N1, R5) still open nothing |
| K4-4 [2] a revealed SwipeRow swallows a tap anywhere (the sheet's Close, the chevron) | Fixed | The closing tap is consumed only inside the row's list (`.sheet-body` / `.pushed` / `.tab-scroll`, not its bars). Elsewhere the row closes and the tap acts (`ui/SwipeRow.tsx`) | chevron after a reveal: still on `/dev/ui` → popped on that tap; a tap on another row is still consumed |
| K4-5 [2] the click swallow keys on `click.pointerId` (WebKit unverified) | Fixed (robust), device check kept | A click whose id matches no arm takes the latest arm whose pointer is up. Every `pointerdown` retires the arms of pointers already up, so a touch that made no click never hands its arm on (`ui/clickSwallow.ts`) | a mismatched-id click after a reveal: goes through → swallowed; a stale arm (pointer 53, no click) then a new tap: goes through on both builds |
| C4-4 / C3-8 / C2-7 [1] pull to refresh has no keyboard path | Rejected (spec gap), request stands | §9.5 defines only the pull; the control is WP2's title menu | — |
| K4-6 [1] contract text still the 12:38 text | Not WP1's file; request repeated | See "Requests": §D.1, §A.2, §A.3, and the new §C.1 lines for `open()` over an open sheet | — |
| F8 [2] release velocity depends on input spacing (2 of 6 4× flicks read 0) | Rejected (spec-bound), request stands | §9.2/§9.3/§9.4 name `getVelocity()` as the one source; a tracker is a spec change and a device-day check | — |
| F9 [1], N2, N4, N6, N7, O1–O5 | Unchanged / other packages | As in round 3. O1–O5 are the interim pages (WP2's hero carousel and two-session swipe, word placement, stops line, 8-item menu; WP3/WP4 mount times) | — |

**What the battery found against the round-3 checks, and why each one changed.**
- **Four scripts fail the same way on the unfixed build today** (`results-r4-control/`), so the cause is the harness, not this round's code. These checks were written on Oct 23; today is Oct 24, a two-session day.
  - `t17` hard-coded `MON, NOV 2` and assumed the lab's day 0 and +10 stub pages are the tall ones. They cycle 600 / 1400 / 900 px by day number, and on Oct 24 the +10 page cannot scroll. The script now picks a page that scrolls and computes the caption.
  - `t14` 14h hard-coded tomorrow as `SAT, OCT 24`.
  - `t23`'s stub replaces to `/today/2026-10-24`, which is today, and so is `/today` by design.
  - Patched, all three pass on both builds. The originals are kept as `*.r3.mjs`.
- **One check changed with D1.** `r2-layer` n1-350's second tap landed 4.2 px (1×) and 2.0 px (4×) from rest. That is now a tap, which is the D1 fix. Its exemption moved from 1 px to `ARRIVED_PX`. The 60, 150 and 250 ms cases still assert that the tap opens nothing, and pass.
- **`r2-layer` at 4× is noise.** The c2-1 and c2-3 catch windows missed once each ("never in range", as in round 3's final run). Three more 4× runs: 19/20, 20/20, 20/20.

## The acceptance battery (build plan §2.5, every numbered test)

Final run after review round 4: `SHIFT_MIN=auto node qa/run.mjs` over every script at `CPU=1` and `CPU=4`, on the final build. Logs are in `S/wp1/qa/results-r4-final/`. The `R1`–`R4` rows are each review round's checks (`qa/r<n>-*.mjs`).

After the run, four scripts were rerun on the same build, and their results are the ones in the table:
- `t17`, `t23` and `t14` with the date fix described in "Review round 4";
- `r2-layer` with n1's 8 px band.

The table is rebuilt from the result files by `node run.mjs --table`. Per test:

| §2.5 | checks | 1× pass | 4× pass |
|---|---|---|---|
| E2E | 22 | 22/22 | 22/22 |
| 1 | 6 | 6/6 | 6/6 |
| 2 | 18 | 18/18 | 18/18 |
| 2·interim | 14 | 13/14 | 13/14 |
| 3 | 6 | 6/6 | 6/6 |
| 4 | 8 | 8/8 | 8/8 |
| 5 | 2 | 2/2 | 2/2 |
| 6 | 14 | 14/14 | 14/14 |
| 7 | 8 | 8/8 | 8/8 |
| 8 | 9 | 9/9 | 9/9 |
| 9 | 13 | 13/13 | 13/13 |
| 10 | 9 | 8/8 | 9/9 |
| 11 | 5 | 5/5 | 5/5 |
| 12 | 21 | 20/21 | 19/21 |
| 13 | 41 | 41/41 | 40/41 |
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
| R1 | 70 | 69/70 | 67/70 |
| R2 | 39 | 39/39 | 38/39 |
| R3 | 61 | 61/61 | 61/61 |
| R4 | 40 | 40/40 | 40/40 |
| | **all (excl. 2·interim)** | 617 | 614 | 586/593 |

Round 3's final run, for comparison: 1× 569 of 576 run, 4× 540 of 553.

**Every check that failed in round 3's final run and passes now:** t02 stub roots at 4×, t14 14a/14c, t13 15c at 4×, r1-press u4 at 4×, r1-sheet f1 at 1×, the r2-layer c2-1-tap / c2-3 windows. These are all timing noise on this container; nothing in them was changed.

**Every check outside `2·interim` that fails now also failed in round 3's final run.** All seven are the 4× / first-frame timing set recorded since the QA step:
- t12 12a at 4×, and 12g at 1× and 4×;
- t13 #12 at 4× (3.1 px against 3);
- r1 f5;
- r1-push c5 at 4× (the 120 ms fade is one frame);
- r1-misc f8 at 4× (motion's 30 ms velocity cap, F8);
- r2-sheet u1 at 4×.

The unfixed build fails the same ones on this container (round 3's control, and this round's control for the scripts above).

`2·interim` (the old pages WP2/WP4 replace): 13/14 at both rates, the 60 ms tap on the interim Plan.

<details><summary>The full table (round 4's final run, 1× and 4×)</summary>

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
| E2E | smoke | This morning from Today | PASS /today/2026-10-24/morning | PASS /today/2026-10-24/morning |
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
| 1 | t01-press | 1 data-pressed in the first sampled frame (≤ 17 ms) | PASS 15.3 ms, pressed=true | PASS 10.6 ms, pressed=true |
| 1 | t01-press | 1 scale below 1 by the second frame (≤ 34 ms) | PASS 31.9 ms, scale 0.9843 | PASS 28.6 ms, scale 0.9843 |
| 1 | t01-press | 1 scale reaches 0.97 ± 0.002 by 140 ms | PASS 65.2 ms (scale at 140: 0.9700) | PASS 60.9 ms (scale at 140: 0.9700) |
| 1 | t01-press | 1 touchend clears data-pressed within 16 ms (1 frame at 1x; 4x: the switch budget, 50) | PASS 11.4 ms | PASS 47.6 ms |
| 1 | t01-press | 1 no haptic on a tab tap | PASS [] | PASS [] |
| 1 | t01-press | 1 console clean | PASS [] | PASS [] |
| 2 | t02-cut | 2 [stub roots] the first frame that shows Plan begins within 17 ms of touchend (rAF frame start) | PASS +15.7 ms | PASS +45.6 ms |
| 2 | t02-cut | 2 [stub roots] presented frames (screencast; informational): the cut and a trivial change through the same pipeline | PASS cut presented at +25.5 ms, a one-element change at +21.0 ms (Δ 4.5 ms) | PASS cut presented at +57.7 ms, a one-element change at +14.0 ms (Δ 43.7 ms) |
| 2 | t02-cut | 2 [stub roots] no ancestor of the active page below opacity 1 on any frame | PASS min 1 | PASS min 1 |
| 2 | t02-cut | 2 [stub roots] no opacity animation on a .tab | PASS max 0 | PASS max 0 |
| 2 | t02-cut | 2 [stub roots] zero black frames in the 600 ms after | PASS 0 of 14 frames (max black share 0.58) | PASS 0 of 16 frames (max black share 0.58) |
| 2 | t02-cut | 2 [stub roots] pathname /plan | PASS /plan | PASS /plan |
| 2 | t02-cut | 2 [stub roots] console clean | PASS [] | PASS [] |
| 2 | t02b-black | 2 push (avatar → Settings): zero black frames in the 600 ms after | PASS 0 of 34 frames (max black share 0.71) | PASS 0 of 39 frames (max black share 0.71) |
| 2 | t02b-black | 2 push (avatar → Settings): the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 64 frames | PASS min opacity 1, tab opacity animations 0 over 95 frames |
| 2 | t02b-black | 2 pop (the chevron): zero black frames in the 600 ms after | PASS 0 of 33 frames (max black share 0.71) | PASS 0 of 36 frames (max black share 0.71) |
| 2 | t02b-black | 2 pop (the chevron): the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 63 frames | PASS min opacity 1, tab opacity animations 0 over 90 frames |
| 2 | t02b-black | 2 day swipe (stub pages): zero black frames in the 600 ms after | PASS 0 of 54 frames (max black share 0.16) | PASS 0 of 54 frames (max black share 0.16) |
| 2 | t02b-black | 2 day swipe (stub pages): the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 95 frames | PASS min opacity 1, tab opacity animations 0 over 133 frames |
| 2 | t02b-black | 2 sheet open: zero black frames in the 600 ms after | PASS 0 of 35 frames (max black share 0.68) | PASS 0 of 41 frames (max black share 0.69) |
| 2 | t02b-black | 2 sheet open: the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 62 frames | PASS min opacity 1, tab opacity animations 0 over 96 frames |
| 2 | t02b-black | 2 sheet close: zero black frames in the 600 ms after | PASS 0 of 31 frames (max black share 0.68) | PASS 0 of 31 frames (max black share 0.68) |
| 2 | t02b-black | 2 sheet close: the active page's ancestors stay at opacity 1, no opacity animation on a .tab | PASS min opacity 1, tab opacity animations 0 over 55 frames | PASS min opacity 1, tab opacity animations 0 over 71 frames |
| 2 | t02b-black | 2 console clean | PASS [] | PASS [] |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] the first frame that shows Plan begins within 17 ms of touchend (rAF frame start) | FAIL +18.1 ms | FAIL +83.5 ms |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] presented frames (screencast; informational): the cut and a trivial change through the same pipeline | PASS cut presented at +30.0 ms, a one-element change at +8.7 ms (Δ 21.3 ms) | PASS cut presented at +103.3 ms, a one-element change at +30.3 ms (Δ 73.0 ms) |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] no ancestor of the active page below opacity 1 on any frame | PASS min 1 | PASS min 1 |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] no opacity animation on a .tab | PASS max 0 | PASS max 0 |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] zero black frames in the 600 ms after | PASS 0 of 14 frames (max black share 0.75) | PASS 0 of 15 frames (max black share 0.75) |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] pathname /plan | PASS /plan | PASS /plan |
| 2·interim | t02-cut | 2 [old pages, 60 ms tap] console clean | PASS [] | PASS [] |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] the first frame that shows Plan begins within 17 ms of touchend (rAF frame start) | PASS +13.7 ms | PASS +45.9 ms |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] presented frames (screencast; informational): the cut and a trivial change through the same pipeline | PASS cut presented at +4.5 ms, a one-element change at +10.9 ms (Δ -6.5 ms) | PASS cut presented at +64.3 ms, a one-element change at +28.9 ms (Δ 35.4 ms) |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] no ancestor of the active page below opacity 1 on any frame | PASS min 1 | PASS min 1 |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] no opacity animation on a .tab | PASS max 0 | PASS max 0 |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] zero black frames in the 600 ms after | PASS 0 of 19 frames (max black share 0.75) | PASS 0 of 23 frames (max black share 0.75) |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] pathname /plan | PASS /plan | PASS /plan |
| 2·interim | t02-cut | 2 [old pages, 120 ms tap] console clean | PASS [] | PASS [] |
| 3 | t03-scroll | 3 Plan keeps scrollTop 300 across Today | PASS 300 | PASS 300 |
| 3 | t03-scroll | 3 Journal keeps scrollTop 600 across Today | PASS 600 | PASS 600 |
| 3 | t03-scroll | 3 Reads pushed on Journal | PASS /journal/reads | PASS /journal/reads |
| 3 | t03-scroll | 3 Journal → Reads → Today → Journal: Reads still on top | PASS {"path":"/journal/reads","pushed":1} | PASS {"path":"/journal/reads","pushed":1} |
| 3 | t03-scroll | 3 no remount: the Plan root is the same node | PASS  | PASS  |
| 3 | t03-scroll | 3 console clean | PASS [] | PASS [] |
| 4 | t04-reselect | 4 both layers unmount on the rest frame of one spring | PASS 30 moving frames; gone at +609 ms | PASS 29 moving frames; gone at +660 ms |
| 4 | t04-reselect | 4 pathname /today | PASS /today | PASS /today |
| 4 | t04-reselect | 4 the pop path changed on the unmount frame | PASS /today | PASS /today |
| 4 | t04-reselect | 4 a cold-start stack pops with replaceState (history.length unchanged) | PASS 3 → 3 | PASS 3 → 3 |
| 4 | t04-reselect | 4 second tap scrolls to 0 within 400 ms | PASS 0 at +350 ms after pointerup | PASS 0 at +353 ms after pointerup |
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
| 7 | t07-keyboard | 7 --kb reads 336px within 100 ms | PASS 336px after 10 ms | PASS 336px after 49 ms |
| 7 | t07-keyboard | 7 html.kb-open set | PASS true | PASS true |
| 7 | t07-keyboard | 7 tab bar visibility hidden | PASS hidden | PASS hidden |
| 7 | t07-keyboard | 7 nothing above the field changes its rect | PASS 0 moved; field top 214 → 214 | PASS 0 moved; field top 214 → 214 |
| 7 | t07-keyboard | 7 only the page bottom padding grows | PASS 24px → 310px | PASS 24px → 310px |
| 7 | t07-keyboard | 7 documentElement.clientHeight unchanged | PASS 844 → 844 | PASS 844 → 844 |
| 7 | t07-keyboard | 7 keyboard down: --kb 0px, kb-open off, tab bar back | PASS {"above":["32,16,326,34","16,58,358,0","32,58,122,44","162,58,112,44","32,110,105,44","145,110,94,44","247,110,76,44","32,162,90,44","130,162,96, | PASS {"above":["32,16,326,34","16,58,358,0","32,58,122,44","162,58,112,44","32,110,105,44","145,110,94,44","247,110,76,44","32,162,90,44","130,162,96, |
| 7 | t07-keyboard | 7 console clean | PASS [] | PASS [] |
| 8 | t08-history | 8 avatar pushes Settings | PASS {"path":"/settings","len":3,"idx":1,"active":"today","todayStack":["/settings"]} | PASS {"path":"/settings","len":3,"idx":1,"active":"today","todayStack":["/settings"]} |
| 8 | t08-history | 8 back on Today, Settings still stacked | PASS {"path":"/settings","len":5,"idx":3,"active":"today","todayStack":["/settings"]} | PASS {"path":"/settings","len":5,"idx":3,"active":"today","todayStack":["/settings"]} |
| 8 | t08-history | 8 the chevron's pop: /today on the pop's rest frame | PASS unmount frame 37: /today | PASS unmount frame 39: /today |
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
| 9 | t09-push | 9 push at rest in ≈ 460 ms (≤ 500) | PASS 450 ms from the first moving frame | PASS 467 ms from the first moving frame |
| 9 | t09-push | 9 at rest a pixel of the pushed page is its own colour (20,40,60) ± 3 | PASS [20,40,60] | PASS [20,40,60] |
| 9 | t09-push | 9 console clean | PASS [] | PASS [] |
| 9 | t09b-depth2 | 9 depth 2: scrim[data-depth=2] = 0.12 × (1 − x/390) ± 0.02 on every frame of the push | PASS max error 0.0000 over 50 frames | PASS max error 0.0000 over 49 frames |
| 9 | t09b-depth2 | 9 depth 2: paint order pushed(1) · scrim(2) · pushed(2) (each with its shadow under it), no z-index, pointer-events none | PASS {"kids":["pushed1","scrim2","pushed2"],"z":["auto","auto","auto"],"pe":"none","s1":"scrim1 between the scroller and .stack-host"} | PASS {"kids":["pushed1","scrim2","pushed2"],"z":["auto","auto","auto"],"pe":"none","s1":"scrim1 between the scroller and .stack-host"} |
| 9 | t09b-depth2 | 9 depth 2 held at x ≈ 195: the scrim dims the depth-1 page (left) and not the depth-2 page (right) | PASS {"held":"190.0","leftOn":"5.80","leftOff":"6.23","rightOn":"62.75","rightOff":"62.75"} | PASS {"held":"190.0","leftOn":"5.80","leftOff":"6.23","rightOn":"62.75","rightOff":"62.75"} |
| 9 | t09b-depth2 | 9/14 console clean | PASS [] | PASS [] |
| 10 | t09-push | 10 edge drag: parent = −0.3 × (390 − x) ± 2 on every frame | PASS max error 0.00 over 79 frames; max x 108 | PASS max error 0.00 over 87 frames; max x 108 |
| 10 | t09-push | 10 released slow under 0.35 W → back to 0, still pushed | PASS {"n":1,"lx":0,"px":-117,"scrim":0.12,"bar":794,"vis":"visible","inert":true,"sw":390,"sh":844,"ih":844,"path":"/dev/ui","t":1717.9999999998136} | PASS {"n":1,"lx":0,"px":-117,"scrim":0.12,"bar":794,"vis":"visible","inert":true,"sw":390,"sh":844,"ih":844,"path":"/dev/ui","t":1871.8999999999996} |
| 10 | t09-push | 10 parent visible while dragged | PASS  | PASS  |
| 10 | t09-push | 10 a fast edge swipe pops; unmount and pathname change on the same frame | PASS unmount frame 48, path frame 48 | PASS unmount frame 48, path frame 48 |
| 10 | t09-push | 10 the pop of an own entry uses history.back (length unchanged) | PASS 3 → 3 | PASS 3 → 3 |
| 10 | t09-push | 10 a touch 7.4 px inside the moving edge stops the push within a frame | PASS x at touch 97.1; next frames 97.1, 97.1, 97.1 | PASS x at touch 73.4; next frames 73.4, 73.4, 73.4 |
| 10 | t09-push | 10 then x follows the finger 1:1 after the 10 px lock (≤ 1 px from clientX − x0, x0 at pointerdown) | PASS x 157.1 vs 157.1 | PASS x 133.4 vs 133.4 |
| 10 | t09-push | 10 the released layer rests at 0 or W, never between | PASS none | PASS 0 |
| 10 | t09-push | 10 a tap on the chevron at x 20 (moved 4 px) pops | — | PASS /today |
| 11 | t11-flyer | 11 frame 1 of the push: source hidden and one .flyer under body | PASS {"srcVis":"hidden","flyers":1} | PASS {"srcVis":"hidden","flyers":1} |
| 11 | t11-flyer | 11 every frame: flyer rect = lerp(source, destination, 1 − x/W) ± 4 | PASS max error 0.00 px over 29 frames | PASS max error 0.00 px over 30 frames |
| 11 | t11-flyer | 11 at rest: no .flyer, the destination visible | PASS {"x":0,"flyers":0,"dstVis":"visible"} | PASS {"x":0,"flyers":0,"dstVis":"visible"} |
| 11 | t11-flyer | 11 the destination stays hidden until rest | PASS  | PASS  |
| 11 | t11-flyer | 11 console clean | PASS [] | PASS [] |
| 12 | t12-sheet | 12a .sheet's transform changes in the first frame after touchend (≤ 17 ms) | PASS first frame after touchend +20.0 ms (previous frame -2.6 ms) has the sheet at ty 777.3 (H 844); first moved frame +20.0 ms | FAIL first frame after touchend +136.4 ms (previous frame -16.9 ms) has the sheet at ty 777.3 (H 844); first moved frame +136.4 ms |
| 12 | t12-sheet | 12a every frame: scrim = 0.78 × (1 − sheetY/H) ± 0.02 | PASS 55 frames, max error 0.0001 | PASS 51 frames, max error 0.0001 |
| 12 | t12-sheet | 12a every frame: the active .tab's scale = 0.92 + 0.08 × sheetY/H ± 0.01 | PASS max error 0.0000 | PASS max error 0.0000 |
| 12 | t12-sheet | 12a at rest the scale is 0.92 ± 0.005 | PASS scale 0.9200, ty 0.00 | PASS scale 0.9200, ty 0.00 |
| 12 | t12-sheet | 12a activeElement is the opener until the open animation completes, the first field within 1 frame after | PASS rest at frame 30 (+514 ms), opener held on 30 frames: true; field focused at frame 30; actives seen: btn soft gal-sheet-auto / field gal-field | PASS rest at frame 30 (+694 ms), opener held on 30 frames: true; field focused at frame 30; actives seen: btn soft gal-sheet-auto / field gal-field |
| 12 | t12-sheet | 12b a 120 px drag on .sheet-body at scrollTop 0 moves the sheet 120 ± 1 | PASS sheet translateY 120.00 after the finger moved 120 | PASS sheet translateY 120.00 after the finger moved 120 |
| 12 | t12-sheet | 12b the drag tracks 1:1 (per-frame against the last dispatched point) | PASS 13 frames, max /Δ/ 0.00 px | PASS 13 frames, max /Δ/ 0.00 px |
| 12 | t12-sheet | 12b release at ~500 px/s dismisses | PASS finger speed 481 px/s; sheet gone | PASS finger speed 450 px/s; sheet gone |
| 12 | t12-sheet | 12c the same drag at scrollTop 40 scrolls the body; the sheet does not move | PASS sheet max translateY 0.00, body scrollTop 40 → 0 | PASS sheet max translateY 0.00, body scrollTop 40 → 0 |
| 12 | t12-sheet | 12d a pointerdown during the rise stops it within 1 frame | PASS ty at the frames after the page's pointerdown: 84.3, 84.3, 84.3, 84.3, 84.3 | PASS ty at the frames after the page's pointerdown: 47.1, 47.1, 47.1, 47.1, 47.1 |
| 12 | t12-sheet | 12d released without a drag, it settles at its detent | PASS top 10 | PASS top 10 |
| 12 | t12-sheet | 12e an inner sheet.push adds no history entry | PASS length 4 → open 4 → push 4, depth 2 | PASS length 4 → open 4 → push 4, depth 2 |
| 12 | t12-sheet | 12e history.back() closes the sheet; pathname and stack unchanged | PASS sheet false, /dev/ui → /dev/ui, stack ["/dev/ui"] → ["/dev/ui"] | PASS sheet false, /dev/ui → /dev/ui, stack ["/dev/ui"] → ["/dev/ui"] |
| 12 | t12-sheet | 12f grabber tap cycles data-detent medium → large → medium | PASS medium (top 422.0) → large (top 10.0) → medium (top 422.0) | PASS medium (top 422.0) → large (top 10.0) → medium (top 422.0) |
| 12 | t12-sheet | 12f the large detent's top is safeTop + 10 (10 on the web) | PASS top 10.00 | PASS top 10.00 |
| 12 | t12-sheet | 12g a hero tap on Today opens the session sheet | PASS hero aura today-hero halo-upcoming is-pressable ; sheet title "Threshold 6" | PASS hero aura today-hero halo-upcoming is-pressable ; sheet title "Threshold 6" |
| 12 | t12-sheet | 12g .sheet's transform changes in the first frame after touchend (≤ 17 ms) | FAIL first frame after touchend +23.4 ms (previous frame -2.6 ms) has the sheet at ty 777.3 (H 844); first moved frame +23.4 ms | FAIL first frame after touchend +82.7 ms (previous frame -7.9 ms) has the sheet at ty 777.3 (H 844); first moved frame +82.7 ms |
| 12 | t12-sheet | 12g every frame: scrim = 0.78 × (1 − sheetY/H) ± 0.02 | PASS 55 frames, max error 0.0001 | PASS 54 frames, max error 0.0001 |
| 12 | t12-sheet | 12g every frame: the active .tab's scale = 0.92 + 0.08 × sheetY/H ± 0.01 | PASS max error 0.0000 | PASS max error 0.0000 |
| 12 | t12-sheet | 12g at rest the scale is 0.92 ± 0.005 | PASS scale 0.9200, ty 0.00 | PASS scale 0.9200, ty 0.00 |
| 12 | t12-sheet | 12 console clean | PASS [] | PASS [] |
| 13 | t13-pager | 10 270 px left swipe on card commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on page head commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on a row (y 650) commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on the strip commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 270 px left swipe on the large title row commits tomorrow, no history entry, lag median 0 / max ≤ 1 | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} | PASS {"date":"2026-10-25","history":"3→3","lagMedian":0,"lagMax":0,"moves":11} |
| 13 | t13-pager | 10 a swipe on the orb row (data-no-page) does not change the date | PASS {"date":"2026-10-24"} | PASS {"date":"2026-10-24"} |
| 13 | t13-pager | 10 a swipe on the field does not change the date | PASS {"date":"2026-10-24"} | PASS {"date":"2026-10-24"} |
| 13 | t13-pager | 11 at x = −195: disc = cellX + 27.86 ± 1, Today 0.5, Tomorrow 0.5 | PASS {"x":-195,"disc":306.43,"expected":306.43,"today":0.5,"tomorrow":0.5,"labels":["Today","Tomorrow"]} | PASS {"x":-195,"disc":306.43,"expected":306.43,"today":0.5,"tomorrow":0.5,"labels":["Today","Tomorrow"]} |
| 13 | t13-pager | 12 flick ≥ 1500 px/s: every frame in the 100 ms after release within 3 px of the pageFlick trajectory; rest ≤ 450 ms | PASS {"sameRelease":true,"releaseLagMs":0.3,"releaseV":-1667,"releaseX":-100,"framesIn100ms":6,"maxErrPx":0.447,"restMs":421.4,"firstFrameMs":15.8,"fi | FAIL {"sameRelease":true,"releaseLagMs":1.8,"releaseV":-1667,"releaseX":-100,"framesIn100ms":5,"maxErrPx":3.162,"restMs":443.6,"firstFrameMs":15.1,"fi |
| 13 | t13-pager | 13 catch mid-slide: today's left edge the same ±1 on the frames either side of touchstart | PASS {"before":-355.91,"after":-355.91,"xAtCatch":-355.9,"caughtPastHalf":true} | PASS {"before":-354.8,"after":-354.8,"xAtCatch":-354.8,"caughtPastHalf":true} |
| 13 | t13-pager | 13 catch mid-slide: at touchend today's left edge = its edge at the touch + 120 ± 2 | PASS {"movedX":120,"framesAtTouch":-355.91,"framesAtEnd":-235.91} | PASS {"movedX":120,"framesAtTouch":-354.8,"framesAtEnd":-234.8} |
| 13 | t13-pager | 13 catch mid-slide: springs back to today; commits in pairs (0 or 2); no content jump | PASS {"date":"2026-10-24","commits":["2026-10-25","2026-10-24"],"maxJump":0,"frames":131,"fr0":76} | PASS {"date":"2026-10-24","commits":["2026-10-25","2026-10-24"],"maxJump":0,"frames":126,"fr0":80} |
| 13 | t13-pager | 14 flick, flick back: today, title Today, history unchanged, commits even | PASS {"date":"2026-10-24","title":"Today","commits":2,"history":"3→3","releaseV":[-1333,1111]} | PASS {"date":"2026-10-24","title":"Today","commits":2,"history":"3→3","releaseV":[-1333,1111]} |
| 13 | t13-pager | 15 clamp: a 450 px drag moves the track ≤ W + 12 and commits one page | PASS {"maxTx":399,"limit":402,"commits":1} | PASS {"maxTx":399,"limit":402,"commits":1} |
| 13 | t13-pager | 15a four 270 px swipes 150 ms apart: +4, exactly 4 page-commits, title dayTitle(+4), no jump > 1 px at a catch | PASS {"date":"2026-10-28","plus":4,"commits":4,"title":"Wed 28","catchJumpMax":0,"xAtCatches":[0,-381,-386,-387]} | PASS {"date":"2026-10-28","plus":4,"commits":4,"title":"Wed 28","catchJumpMax":0,"xAtCatches":[0,-381,-386,-386]} |
| 13 | t13-pager | 15b tap at x ≈ −200 (past halfway): rests on a page within 450 ms, the next day, no tap fires, no sheet | PASS {"xAtTap":-232,"date":"2026-10-25","commits":1,"restMs":346.6,"taps":[]} | PASS {"xAtTap":-253.3,"date":"2026-10-25","commits":1,"restMs":363.1,"taps":[]} |
| 13 | t13-pager | 15b tap at x ≈ −120 (short of halfway): rests on a page within 450 ms, today, 0 commits, no tap fires, no sheet | PASS {"xAtTap":-120.8,"date":"2026-10-24","commits":0,"restMs":330.2,"taps":[]} | PASS {"xAtTap":-111,"date":"2026-10-24","commits":0,"restMs":328.3,"taps":[]} |
| 13 | t13-pager | 15c four left 60 px flicks: /today/+4, page-commits = 4 | PASS {"date":"2026-10-28","commits":4,"downs":[0,-285,-259,-246],"rels":[[-40,-667],[45,-667],[71,-667],[84,-667]]} | PASS {"date":"2026-10-28","commits":4,"downs":[0,-279,-255,-229],"rels":[[-40,-667],[51,-667],[75,-667],[101,-667]]} |
| 13 | t13-pager | 15c three left and one right: /today/+2, page-commits = 4 (3 on, 1 back) | PASS {"date":"2026-10-26","commits":4,"downs":[0,-285,-260,-245],"rels":[[-40,-667],[45,-667],[70,-667],[205,667]]} | PASS {"date":"2026-10-26","commits":4,"downs":[0,-279,-267,-252],"rels":[[-40,-667],[51,-667],[63,-667],[198,0]]} |
| 13 | t13-pager | 16 zero React renders while the track springs; data-date unchanged until the rest frame | PASS {"springFrames":23,"distinctRenderCounts":1,"flipFrame":23} | PASS {"springFrames":16,"distinctRenderCounts":1,"flipFrame":16} |
| 13 | t13-pager | 16 on the rest frame data-date, the disc and the resting labels change together; content ≤ 1 px | PASS {"at":{"tx":0,"cur":"2026-10-25","disc":334.29,"title":"Tomorrow"},"contentBefore":-0.91,"contentAt":0} | PASS {"at":{"tx":0,"cur":"2026-10-25","disc":334.29,"title":"Tomorrow"},"contentBefore":-0.21,"contentAt":0} |
| 13 | t13-pager | 13-keyed a commit keeps the two staying pages' nodes and mounts exactly one | PASS {"sameToday":true,"sameNext":true,"added":1,"roles":["prev:2026-10-24","cur:2026-10-25","next:2026-10-26"]} | PASS {"sameToday":true,"sameNext":true,"added":1,"roles":["prev:2026-10-24","cur:2026-10-25","next:2026-10-26"]} |
| 13 | t13-pager | 17 at rest prev and next exist, text > 20, inert | PASS {"prev":[75,true,900],"next":[99,true,1400]} | PASS {"prev":[75,true,900],"next":[99,true,1400]} |
| 13 | t13-pager | 17 scrollHeight = cur offsetHeight + chrome with a 1400 px neighbour mounted; the 600 stub fills the scroller (min-height = --scroller-h − - | PASS {"day":-2,"prev":[75,true,900],"next":[99,true,1400],"curH":637,"minH":637,"chrome":157,"scH":794,"scrollHeight":794,"clientHeight":794,"dpTop":1 | PASS {"day":-2,"prev":[75,true,900],"next":[99,true,1400],"curH":637,"minH":637,"chrome":157,"scH":794,"scrollHeight":794,"clientHeight":794,"dpTop":1 |
| 13 | t13-pager | 18 scrolled 220 on the 1400 page, a swipe onto the 900 page keeps scrollTop | PASS {"scrollTop":220,"from":-1} | PASS {"scrollTop":220,"from":-1} |
| 13 | t13-pager | 3.5 scrolled to the bottom of the 1400 page, a catch past halfway onto the (previous) 600 page does not commit mid-gesture (no vertical jump | PASS {"scrollTop":[763,763],"commits":[0,0,1],"date":"2026-10-22","xAtCatch":254} | PASS {"scrollTop":[763,763],"commits":[0,0,1],"date":"2026-10-22","xAtCatch":253} |
| 13 | t13-pager | 19 a drag from the strip that commits one page: exactly 1 select; from the card: 0 | PASS {"strip":1,"body":0} | PASS {"strip":1,"body":0} |
| 13 | t13-pager | 19 ten day steps add 0 history entries | PASS {"history":"3→3","date":"2026-11-03"} | PASS {"history":"3→3","date":"2026-11-03"} |
| 13 | t13-pager | goTo goTo(+1) commits within 500 ms | PASS {"ms":489.5} | PASS {"ms":509} |
| 13 | t13-pager | goTo goTo(+5) sets target and span before its first frame, travels exactly W once, and both reset on commit | PASS {"target":"2026-10-24","span":5,"beforeFirstFrame":11.7,"maxTx":389} | PASS {"target":"2026-10-24","span":5,"beforeFirstFrame":26.5,"maxTx":389.1} |
| 13 | t13-pager | goTo goTo(+5): the label in the direction of travel shows the destination; the disc travels 5 cells | PASS {"nextLabel":"Today","want":"Today","lastDisc":277.9,"lastTx":-389} | PASS {"nextLabel":"Today","want":"Today","lastDisc":277.9,"lastTx":-389.1} |
| 13 | t13-pager | goTo goTo(+12): no transform animation on the track; a 150 ms opacity change on the cur slot | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} |
| 13 | t13-pager | goTo goTo(+1, { mode: 'crossfade' }): no transform animation on the track; a 150 ms opacity change on the cur slot | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} | PASS {"anyTx":false,"anims":[{"d":150,"k":["opacity"]}],"minOpacity":0} |
| 13 | t13-pager | goTo a date set by the host mid-slide stops the slide and shows it at x = 0, no animation, 0 page-commits | PASS {"xAfter":0,"x":0,"commits":0,"log":[-61.75609239243756,-103.55826432144995,0]} | PASS {"xAfter":0,"x":0,"commits":0,"log":[-65.1909065189488,-107.16358050043345,0]} |
| 13 | t13-pager | 20 the Today pill from +5: one slide (the track travels exactly W), today, avatar back ≤ 150 ms after rest; slot 80 wide and the caps line's | PASS {"maxTx":389,"commits":1,"avatarBackMs":75.8,"trailW":80,"haptics":[]} | PASS {"maxTx":389.2,"commits":1,"avatarBackMs":118.5,"trailW":80,"haptics":[]} |
| 13 | t13-pager | 35 3 body swipes, 2 strip taps, the pill and a far goTo: 0 haptics | PASS {"haptics":[],"commits":7} | PASS {"haptics":[],"commits":7} |
| 13 | t13-pager | console clean | PASS [] | PASS [] |
| 13 | t13b-onepx | 13 1 px rule: a released spring was caught within 1 px of its target while still moving | PASS attempt 0: x -389.12 vs target -390.00 (Δ 0.88 px), release v -1500 px/s | PASS attempt 0: x -389.19 vs target -390.00 (Δ 0.81 px), release v 0 px/s |
| 13 | t13b-onepx | 13 1 px rule: the pointerdown completes the spring (one commit, no catch) | PASS {"afterDown":{"x":0,"moving":true,"commits":1,"date":"2026-10-25"},"afterUp":{"moving":false,"x":0},"totalCommits":1} | PASS {"afterDown":{"x":0,"moving":true,"commits":1,"date":"2026-10-25"},"afterUp":{"moving":false,"x":0},"totalCommits":1} |
| 13 | t13b-onepx | 13 1 px rule: the pointer's click fires normally (the card's tap, not swallowed) | PASS {"taps":["tap 2026-10-25"],"el":"dp","card":"2026-10-25"} | PASS {"taps":["tap 2026-10-25"],"el":"dp","card":"2026-10-25"} |
| 13 | t13b-onepx | 13 1 px rule: console clean | PASS [] | PASS [] |
| 14 | t09b-depth2 | 14 a hold-menu item on a stub Plan raises its toast through useToast(): the toast is Plan's (gone on Today) | PASS {"onPlan":"menu toast from plan","onToday":null} | PASS {"onPlan":"menu toast from plan","onToday":null} |
| 14 | t14-hold | 14a .gal-p-scale: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +14.3 ms (frame interval 16.7); cleared (pressed=false) on the first frame after pointerup, +15.9 ms (f | PASS set on the first frame after pointerdown, +17.5 ms (frame interval 27.1); cleared (pressed=false) on the first frame after pointerup, +79.0 ms (f |
| 14 | t14-hold | 14a .gal-p-scale: the scale look by 140 ms | PASS scale 0.9700 | PASS scale 0.9700 |
| 14 | t14-hold | 14a .gal-p-surface: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +14.7 ms (frame interval 16.5); cleared (pressed=false) on the first frame after pointerup, +16.0 ms (f | PASS set on the first frame after pointerdown, +11.0 ms (frame interval 18.0); cleared (pressed=false) on the first frame after pointerup, +72.1 ms (f |
| 14 | t14-hold | 14a .gal-p-surface: the surface look by 140 ms | PASS rgba(0, 0, 0, 0) → rgb(17, 17, 17) | PASS rgba(0, 0, 0, 0) → rgb(17, 17, 17) |
| 14 | t14-hold | 14a .gal-p-dim: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +15.3 ms (frame interval 16.9); cleared (pressed=false) on the first frame after pointerup, +15.8 ms (f | PASS set on the first frame after pointerdown, +13.4 ms (frame interval 19.7); cleared (pressed=false) on the first frame after pointerup, +90.7 ms (f |
| 14 | t14-hold | 14a .gal-p-dim: the dim look by 140 ms | PASS opacity 0.55 | PASS opacity 0.55 |
| 14 | t14-hold | 14a .tab-item[data-tab=plan]: data-pressed on the first frame after touchstart, cleared on the first frame after touchend | PASS set on the first frame after pointerdown, +15.4 ms (frame interval 16.9); cleared (pressed=false) on the first frame after pointerup, +16.1 ms (f | PASS set on the first frame after pointerdown, +11.7 ms (frame interval 16.4); cleared (pressed=false) on the first frame after pointerup, +53.3 ms (f |
| 14 | t14-hold | 14a .tab-item[data-tab=plan]: the scale look by 140 ms | PASS scale 0.9700 | PASS scale 0.9700 |
| 14 | t14-hold | 14b a 381 ms press fires onPress and 0 menus, 0 haptics | PASS {"log":["hold-tap"],"menu":false,"h":[],"held":381.40000000037253} | PASS {"log":["hold-tap"],"menu":false,"h":[],"held":400.80000000074506} |
| 14 | t14-hold | 14c 470 ms unmoved: the menu opens, exactly 1 lift, no onPress | PASS {"haptics":["lift"],"log":[]} | PASS {"haptics":["lift"],"log":[]} |
| 14 | t14-hold | 14c no menu at 440 ms, in the DOM by 460 ms | PASS menu in the DOM at +457.4 ms after pointerdown | PASS menu in the DOM at +494.1 ms after pointerdown |
| 14 | t14-hold | 14c menu opacity ≥ 0.9 by 600 ms | PASS opacity 1 at +599 | PASS opacity 0.996439 at +606 |
| 14 | t14-hold | 14c data-pressed is cleared on the frame data-lifting is set (pre-grow before it) | PASS lifting from frame 29; the frame before: pressed true, preholding true; frames with both: 0 | PASS lifting from frame 29; the frame before: pressed true, preholding true; frames with both: 0 |
| 14 | t14-hold | 14c .cm-hole's rect equals the lifted element's rect ± 1 on every frame of the lift | PASS 26 frames, max error 0.02 px | PASS 28 frames, max error 0.02 px |
| 14 | t14-hold | 14c the scrim has no backdrop-filter; no .cm-lift; ≤ 4 items | PASS backdrop-filter none, .cm-lift 0, items 4 | PASS backdrop-filter none, .cm-lift 0, items 4 |
| 14 | t14-hold | 14c a tap on the lifted element closes the menu without its onPress | PASS {"menu":false,"log":[],"sheet":false} | PASS {"menu":false,"log":[],"sheet":false} |
| 14 | t14-hold | 14d moving 10 px after 470 closes the menu within 100 ms and sets data-dragging | PASS menu up true; its 100 ms exit reached opacity 0 60 ms after the page's pointermove; dragging true; drag-start | PASS menu up true; its 100 ms exit reached opacity 0 59 ms after the page's pointermove; dragging true; drag-start |
| 14 | t14-hold | 14f a 300 ms press that moves 12 px: no menu, no lift | PASS {"menu":0,"h":[],"l":false,"log":["hold-tap"]} | PASS {"menu":0,"h":[],"l":false,"log":["hold-tap"]} |
| 14 | t14-hold | 14g ignore=".inner": a 600 ms hold on .inner: no data-pressed, no lift, no menu | PASS {"pressed":false,"menu":0,"h":[],"l":false} | PASS {"pressed":false,"menu":0,"h":[],"l":false} |
| 14 | t14-hold | 14g ignore=".inner": a tap on .inner does not fire the outer onPress | PASS ["inner"] | PASS ["inner"] |
| 14 | t14-hold | 14h a hold that reaches 450 then moves 150 px left: the menu is gone within 100 ms of the 10 px mark | PASS menu up at 470: true; gone 64 ms after the 10 px mark | PASS menu up at 470: true; gone 52 ms after the 10 px mark |
| 14 | t14-hold | 14h ... the track followed the finger (≤ 1 px against the last dispatched point, after the 10 px re-base) and exactly 1 page-commit | PASS track vs the last dispatched point: offset spread 0.00 px over 16 frames (the constant offset is the lock re-base); Today → SUN, OCT 25; page-com | PASS track vs the last dispatched point: offset spread 0.00 px over 18 frames (the constant offset is the lock re-base); Today → SUN, OCT 25; page-com |
| 14 | t14-hold | 14 console clean | PASS [] | PASS [] |
| 14 | t34-menu | 34 gallery .gal-p-hold: the menu is up (≤ 4 items here: 4); the hole is a cut-out (no backdrop-filter, no clone) | PASS {"menu":true,"items":4,"hit":true,"hitName":"stamp gal-session-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":504.3} | PASS {"menu":true,"items":4,"hit":true,"hitName":"stamp gal-session-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":563.1} |
| 14 | t34-menu | 34 gallery .gal-p-hold: elementFromPoint at the lifted element's centre returns it or a descendant | PASS stamp gal-session-name | PASS stamp gal-session-name |
| 14 | t34-menu | 34 gallery .gal-p-hold: the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimmed) | PASS pixel 17,17,17 → 17,17,17; 5×5 mean 17,17,17 → 17,17,17 (dimmed by the scrim it would be ×0.3) | PASS pixel 17,17,17 → 17,17,17; 5×5 mean 17,17,17 → 17,17,17 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 gallery .gal-p-hold: a tab-bar pixel is darker by the scrim | PASS 90,101,253 → 27,30,76 | PASS 90,101,253 → 27,30,76 |
| 14 | t34-menu | 34 gallery .gal-p-hold: tapping the lifted element closes the menu and opens nothing | PASS {"menu":false,"log":[],"sheet":false} | PASS {"menu":false,"log":[],"sheet":false} |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: the menu is up (≤ 4 items here: 4); the hole is a cut-out (no backdrop-filter, n | PASS {"menu":true,"items":4,"hit":true,"hitName":"pressable gal-press gal-p-pager","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":503.3} | PASS {"menu":true,"items":4,"hit":true,"hitName":"pressable gal-press gal-p-pager","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":556.5} |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: elementFromPoint at the lifted element's centre returns it or a descendant | PASS pressable gal-press gal-p-pager | PASS pressable gal-press gal-p-pager |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimm | PASS pixel 27,27,27 → 27,27,27; 5×5 mean 27,27,27 → 27,27,27 (dimmed by the scrim it would be ×0.3) | PASS pixel 27,27,27 → 27,27,27; 5×5 mean 27,27,27 → 27,27,27 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: a tab-bar pixel is darker by the scrim | PASS 90,101,253 → 27,30,76 | PASS 90,101,253 → 27,30,76 |
| 14 | t34-menu | 34 gallery .gal-pager .dp-page[data-role=cur] .gal-p-pager: tapping the lifted element closes the menu and opens nothing | PASS {"menu":false,"log":[],"sheet":false} | PASS {"menu":false,"log":[],"sheet":false} |
| 14 | t34-menu | 34 Today's hero: the menu is up (≤ 4 items here: 8); the hole is a cut-out (no backdrop-filter, no clone) | PASS {"menu":true,"items":8,"hit":true,"hitName":"stamp hero-stamp big","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":489.6} | PASS {"menu":true,"items":8,"hit":true,"hitName":"stamp hero-stamp big","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":586.6} |
| 14 | t34-menu | 34 Today's hero: elementFromPoint at the lifted element's centre returns it or a descendant | PASS stamp hero-stamp big | PASS stamp hero-stamp big |
| 14 | t34-menu | 34 Today's hero: the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimmed) | PASS pixel 17,17,17 → 17,17,17; 5×5 mean 17,17,17 → 17,17,17 (dimmed by the scrim it would be ×0.3) | PASS pixel 17,17,17 → 17,17,17; 5×5 mean 17,17,17 → 17,17,17 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 Today's hero: a tab-bar pixel is darker by the scrim | PASS 90,101,253 → 27,30,76 | PASS 90,101,253 → 27,30,76 |
| 14 | t34-menu | 34 Today's hero: tapping the lifted hero closes the menu and opens no sheet | PASS {"menu":false,"sheet":false} | PASS {"menu":false,"sheet":false} |
| 14 | t34-menu | 34 a Plan row (Strength): the menu is up (≤ 4 items here: 5); the hole is a cut-out (no backdrop-filter, no clone) | PASS {"menu":true,"items":5,"hit":true,"hitName":"stamp pl-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":471.1} | PASS {"menu":true,"items":5,"hit":true,"hitName":"stamp pl-name","lifting":true,"hole":true,"bf":"none","clone":0,"heldMs":569} |
| 14 | t34-menu | 34 a Plan row (Strength): elementFromPoint at the lifted element's centre returns it or a descendant | PASS stamp pl-name | PASS stamp pl-name |
| 14 | t34-menu | 34 a Plan row (Strength): the centre pixel with the menu up equals the pixel before the lift ± 3 (not dimmed) | PASS pixel 0,0,0 → 0,0,0; 5×5 mean 0,0,0 → 0,0,0 (dimmed by the scrim it would be ×0.3) | PASS pixel 0,0,0 → 0,0,0; 5×5 mean 0,0,0 → 0,0,0 (dimmed by the scrim it would be ×0.3) |
| 14 | t34-menu | 34 a Plan row (Strength): a tab-bar pixel is darker by the scrim | PASS 136,136,136 → 40,40,40 | PASS 136,136,136 → 40,40,40 |
| 14 | t34-menu | 34 Plan row → Skip raises a toast with Undo, above the tab bar | PASS {"text":"Strength skippedUndo","bottom":782,"tabbar":794} | PASS {"text":"Strength skippedUndo","bottom":782,"tabbar":794} |
| 14 | t34-menu | 34 Undo puts the session back and the toast goes | PASS {"toast":null,"cls":"pl-line t-lift k-planned is-lead"} | PASS {"toast":null,"cls":"pl-line t-lift k-planned is-lead"} |
| 14 | t34-menu | 34 console clean | PASS [] | PASS [] |
| 15 | t14-hold | 14d a hold + drop that crosses no slot: lift, drop | PASS ["lift","drop"] | PASS ["lift","drop"] |
| 15 | t14-hold | 14e a hold + drop that crosses exactly one slot: lift, select, drop | PASS {"h":["lift","select","drop"],"order":["Strides","Warm up","Cool down"]} | PASS {"h":["lift","select","drop"],"order":["Strides","Warm up","Cool down"]} |
| 15 | t15-haptics | 15 the session ran: 3 swipes moved 3 days, the pill went home, +12 went far | PASS {"before":"2026-10-24","afterSwipes":"2026-10-27","pillTapped":true,"atToday":true,"far":"2026-11-05"} | PASS {"before":"2026-10-24","afterSwipes":"2026-10-27","pillTapped":true,"atToday":true,"far":"2026-11-05"} |
| 15 | t15-haptics | 15 4 tab taps, 3 body swipes, 2 strip taps, the pill, 2 segmented, 3 sheet opens, a far goTo: 0 haptics | PASS 0 haptics [] over 16 actions | PASS 0 haptics [] over 16 actions |
| 15 | t15-haptics | 15 console clean | PASS [] | PASS [] |
| 15 | tsw-swipe | sw2 a row armed then disarmed fires exactly 1 threshold and commits nothing | PASS {"h":["threshold"],"log":[]} | PASS {"h":["threshold"],"log":[]} |
| 15 | t15-16 | 15 4 tab taps, 3 sheet opens and closes, 2 segmented changes: 0 haptics | PASS haptics [] (segmented options found: 4) | PASS haptics [] (segmented options found: 4) |
| 15 | t15-16 | 15-16 console clean | PASS [] | PASS [] |
| 16 | t15-16 | 16 a sheet open: no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a sheet open: no element's offset box changes on 2+ consecutive frames | PASS 50 frames; none | PASS 26 frames; none |
| 16 | t15-16 | 16 a swipe row swipe: no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a swipe row swipe: no element's offset box changes on 2+ consecutive frames | PASS 69 frames; none | PASS 49 frames; none |
| 16 | t15-16 | 16 a day swipe (DayPager v2): no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a day swipe (DayPager v2): no element's offset box changes on 2+ consecutive frames | PASS 77 frames; none | PASS 55 frames; none |
| 16 | t15-16 | 16 a tab tap: no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a tab tap: no element's offset box changes on 2+ consecutive frames | PASS 48 frames; none | PASS 46 frames; none |
| 16 | t15-16 | 16 a push (the avatar): no animation keyframes touch height/width/top/left/padding/margin | PASS [] | PASS [] |
| 16 | t15-16 | 16 a push (the avatar): no element's offset box changes on 2+ consecutive frames | PASS 48 frames; none | PASS 39 frames; none |
| 17 | t17-navbar | 17.@390 .nb-bar, .nb-title, .nb-strip and .nb-gap share one parent (the page element) | PASS [true,true,true,true] | PASS [true,true,true,true] |
| 17 | t17-navbar | 17.@390 pinned chrome = 97 + safe-t (bar 44, strip 53 with its hairline) | PASS {"bar":44,"strip":53} | PASS {"bar":44,"strip":53} |
| 17 | t17-navbar | 39.@390 RELENTLESSLY on +10: .nb-cap fits (scrollWidth ≤ clientWidth) and the date part is dayCaption(full) | PASS {"offset":11,"scrollWidth":278,"clientWidth":278,"date":"WED, NOV 4","expected":"WED, NOV 4","word":"RELENTLESSLY · "} | PASS {"offset":11,"scrollWidth":278,"clientWidth":278,"date":"WED, NOV 4","expected":"WED, NOV 4","word":"RELENTLESSLY · "} |
| 17 | t17-navbar | 39.@390 --nb-word-w equals .nb-word's width ± 1 | PASS {"var":101.78125,"word":101.78} | PASS {"var":101.78125,"word":101.78} |
| 17 | t17-navbar | 38.@390 after 60 px: .nb-title is behind the bar, the inline title at opacity 1, the strip's top = the bar's bottom, .is-collapsed | PASS {"titleBottom":28,"barBottom":44,"inlineOp":1,"stripTop":44,"collapsed":true} | PASS {"titleBottom":28,"barBottom":44,"inlineOp":1,"stripTop":44,"collapsed":true} |
| 17 | t17-navbar | 39.@390 collapsed: .nb-word opacity 1 with the word, .nb-date opacity 0, word.right ≤ inline.left | PASS {"wordOp":1,"dateOp":0,"wordRight":117.8,"inlineLeft":149.2,"inlineW":91.6,"ellipsis":false} | PASS {"wordOp":1,"dateOp":0,"wordRight":117.8,"inlineLeft":149.2,"inlineW":91.6,"ellipsis":false} |
| 17 | t17-navbar | 38.@390 after a 600 px scroll .nb-bar is at 0 and .nb-strip at 44 | PASS {"scrollTop":600,"barTop":0,"stripTop":44} | PASS {"scrollTop":600,"barTop":0,"stripTop":44} |
| 17 | t17-navbar | 17.@390 .nb-cap: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | 17.@390 .nb-title: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | 17.@390 .nb-inline: a tap calls onTitlePress once; a 450 ms hold opens the title menu (and no press) | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} | PASS {"presses":1,"afterHold":0,"items":["Change the word","Clear the word","Go to a day…"]} |
| 17 | t17-navbar | console.@390 clean | PASS [] | PASS [] |
| 17 | t17-navbar | 17.@320 .nb-bar, .nb-title, .nb-strip and .nb-gap share one parent (the page element) | PASS [true,true,true,true] | PASS [true,true,true,true] |
| 17 | t17-navbar | 17.@320 pinned chrome = 97 + safe-t (bar 44, strip 53 with its hairline) | PASS {"bar":44,"strip":53} | PASS {"bar":44,"strip":53} |
| 17 | t17-navbar | 39.@320 RELENTLESSLY on +10: .nb-cap fits (scrollWidth ≤ clientWidth) and the date part is dayCaption(full) | PASS {"offset":11,"scrollWidth":208,"clientWidth":208,"date":"WED, NOV 4","expected":"WED, NOV 4","word":"RELENTLESSLY · "} | PASS {"offset":11,"scrollWidth":208,"clientWidth":208,"date":"WED, NOV 4","expected":"WED, NOV 4","word":"RELENTLESSLY · "} |
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
| 18 | t18-open | 18 the splash hides exactly once, within a frame or two of the first content paint | PASS 1 call(s), 2.4 ms after the first content frame | PASS 1 call(s), 3.3 ms after the first content frame |
| 18 | t18-open | 18 console clean (warm open) | PASS [] | PASS [] |
| 18 | t18-open | 18 foreground: ≤ 2 requests in 10 s (bootstrap + /strava/sync) | PASS ["/api/bootstrap","/api/strava/sync"] | PASS ["/api/bootstrap","/api/strava/sync"] |
| 18 | t18-open | 18 /strava/sync requested ≤ 100 ms after visibilitychange, before the bootstrap answers (held 2 s) | PASS +-2 ms | PASS +-7 ms |
| 18 | t18-open | 18 useStravaChecking() true on the first frame after visibilitychange | PASS {"syncing":"true","dt":16.100000000093132} | PASS {"syncing":"true","dt":57.10000000009313} |
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
| 19 | t19-320 | 19 pushed This morning: scrollWidth 320, nothing past the edge | PASS /today/2026-10-24/morning sw 320 | PASS /today/2026-10-24/morning sw 320 |
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
| 20 | t15-haptics | 15 (reduced motion) the session ran: 3 swipes moved 3 days, the pill went home, +12 went far | PASS {"before":"2026-10-24","afterSwipes":"2026-10-27","pillTapped":true,"atToday":true,"far":"2026-11-05"} | PASS {"before":"2026-10-24","afterSwipes":"2026-10-27","pillTapped":true,"atToday":true,"far":"2026-11-05"} |
| 20 | t15-haptics | 15 (reduced motion) 4 tab taps, 3 body swipes, 2 strip taps, the pill, 2 segmented, 3 sheet opens, a far goTo: 0 haptics | PASS 0 haptics [] over 16 actions | PASS 0 haptics [] over 16 actions |
| 20 | t15-haptics | 15 (reduced motion) console clean | PASS [] | PASS [] |
| 20 | t20-reduced | 20 push under reduced motion: no transform motion on .pushed | PASS [0] | PASS [0] |
| 20 | t20-reduced | 20 push: one opacity change ≤ 150 ms (± 1 frame) | PASS 8 frames, 117 ms | PASS 8 frames, 150 ms |
| 20 | t20-reduced | 20 no flyer under reduced motion | PASS  | PASS  |
| 20 | t20-reduced | 20 edge swipe still tracks the finger | PASS x 80.0 after 80 px of finger | PASS x 80.0 after 80 px of finger |
| 20 | t20-reduced | 20 pop under reduced motion: no transform motion, an opacity change ≤ 150 ms | PASS {"xs":[0],"fadeFrames":7} | PASS {"xs":[0],"fadeFrames":5} |
| 20 | t20-reduced | 20 console clean | PASS [] | PASS [] |
| 20 | t20b-reduced | 20b sheet open: no transform motion (translateY 0 on every frame) | PASS ty values 0.0 | PASS ty values 0.0 |
| 20 | t20b-reduced | 20b sheet open: one opacity change ≤ 150 ms (± 1 frame) | PASS 9 fading frames over 142 ms | PASS 2 fading frames over 63 ms |
| 20 | t20b-reduced | 20b no recede (the tab stays at scale 1) | PASS scales 1.000 | PASS scales 1.000 |
| 20 | t20b-reduced | 20b the scrim still dims (0.78 at rest) | PASS 0.78 | PASS 0.78 |
| 20 | t20b-reduced | 20b the sheet drag still tracks 1:1 | PASS translateY 60 after 60 px | PASS translateY 60 after 60 px |
| 20 | t20b-reduced | 20b closes | PASS closed | PASS closed |
| 20 | t20b-reduced | 20b the hold: the menu opens, the element is marked lifted with no scale, the haptic stays | PASS {"lifting":true,"scale":"1","menu":true,"h":["lift"]} | PASS {"lifting":true,"scale":"1","menu":true,"h":["lift"]} |
| 20 | t20b-reduced | 20b console clean | PASS [] | PASS [] |
| 20 | t21-reduced-pager | 21 reduced: a 270 px drag that pages tracks 1:1 (max lag 0.00 px) | PASS {"lag":0,"moves":9} | PASS {"lag":0,"moves":9} |
| 20 | t21-reduced-pager | 21 reduced: a 270 px drag that pages: the release is one ≤ 150 ms opacity change on the cur slot, no transform animation | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-25"} | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-25"} |
| 20 | t21-reduced-pager | 21 reduced: the labels swap at halfway instead of fading (at -216 px: cur 0, next 1) | PASS {"tx":-216,"cur":0,"next":1} | PASS {"tx":-216,"cur":0,"next":1} |
| 20 | t21-reduced-pager | 21 reduced: a 60 px drag that goes home tracks 1:1 (max lag 0.00 px) | PASS {"lag":0,"moves":8} | PASS {"lag":0,"moves":8} |
| 20 | t21-reduced-pager | 21 reduced: a 60 px drag that goes home: the release is one ≤ 150 ms opacity change on the cur slot, no transform animation | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-24"} | PASS {"xAfterRelease":[0],"anim":[[150,"opacity"]],"minOpacity":0,"date":"2026-10-24"} |
| 20 | t21-reduced-pager | 21 reduced: goTo via .lab-go-p1: no transform, one ≤ 150 ms opacity change | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-25"} | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-25"} |
| 20 | t21-reduced-pager | 21 reduced: goTo via .lab-go-p5: no transform, one ≤ 150 ms opacity change | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-29"} | PASS {"anyTx":false,"anim":[[150,"opacity"]],"date":"2026-10-29"} |
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
| 21 | t21-gates | 21 ui/nav.test.ts + ui/captions.test.ts (routes, redirects, idx −1, captions) | PASS 48 passed | static (rate-independent) |
| 22 | t22-jumps | 22a go to another tab: useRootRequest once, { mon }, how.cut, before the first frame | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":1643.8999999999069}] | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":2945.2999999998137}] |
| 22 | t22-jumps | 22a the first frame showing Plan is already at the request (no pager animation) | PASS {"mon":"2026-10-26"} | PASS {"mon":"2026-10-26"} |
| 22 | t22-jumps | 22a history.length + 1, NAV_EVENT jump, /plan/week/2026-10-26 | PASS {"reqs":[{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":1643.8999999999069}],"shown":"visible","params":"{\"mon\":\"2026-10-26\"}"," | PASS {"reqs":[{"tab":"plan","params":{"mon":"2026-10-26"},"cut":true,"at":2945.2999999998137}],"shown":"visible","params":"{\"mon\":\"2026-10-26\"}"," |
| 22 | t22-jumps | 22b the same go while Plan is active: how.cut false | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":false,"at":1658.5999999996275}] | PASS [{"tab":"plan","params":{"mon":"2026-10-26"},"cut":false,"at":3020.2999999998137}] |
| 22 | t22-jumps | 22c go(/settings/training) on Plan: Today, two layers at rest from the first frame | PASS {"c1":[-117,0],"stack":["/settings","/settings/training"]} | PASS {"c1":[-117,0],"stack":["/settings","/settings/training"]} |
| 22 | t22-jumps | 22l nav.replace(/today/2026-10-24) from Today while Plan is active | PASS {"err":null,"today":"/today/2026-10-24","url":"/plan/week/2026-10-26"} | PASS {"err":null,"today":"/today/2026-10-24","url":"/plan/week/2026-10-26"} |
| 22 | t22-jumps | 22d Back onto /today/2026-10-20 from Plan: the Today stub receives { date }, no entry added | PASS {"reqs":[{"tab":"today","params":{"date":"2026-10-20"},"cut":true,"at":1165}],"path":"/today/2026-10-20","len":7,"active":"today","params":"{\"da | PASS {"reqs":[{"tab":"today","params":{"date":"2026-10-20"},"cut":true,"at":1724.2000000001863}],"path":"/today/2026-10-20","len":7,"active":"today"," |
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
| 23 | t23-bridge | 23 navigate(…, { replace: true }) keeps history.length and nav.idx | PASS {"s5":{"path":"/today","len":4,"idx":2,"active":"today","stack":[]},"s6":{"path":"/today","len":4,"idx":2,"active":"today","stack":[]},"want":"/t | PASS {"s5":{"path":"/today","len":4,"idx":2,"active":"today","stack":[]},"s6":{"path":"/today","len":4,"idx":2,"active":"today","stack":[]},"want":"/t |
| 23 | t23-bridge | 23 history.back() is handled once (no second jump from the bridge) | PASS ["jump"] | PASS ["jump"] |
| 23 | t23-bridge | 23 console clean (stubs) | PASS [] | PASS [] |
| 23 | t23-bridge | 23 old Settings' Training row shows the Training page (not the Settings root) | PASS {"path":"/settings/training","title":"Training","n":2} | PASS {"path":"/settings/training","title":"Training","n":2} |
| 23 | t23-bridge | 23 the old Today's next-day control shows tomorrow | PASS {"path":"/today/2026-10-25","root":"/today/2026-10-25"} | PASS {"path":"/today/2026-10-25","root":"/today/2026-10-25"} |
| 23 | t23-bridge | 23 console clean (old pages) | PASS [] | PASS [] |
| 24 | t24-peak | 24 one orb pop: exactly 1 orb haptic, nothing else | PASS ["orb"] | PASS ["orb"] |
| 24 | t24-peak | 24 the orb fires within 1 frame of the maximum scale | PASS max 1.1255 on frame 12 of 41 (+199 ms); the haptic on frame 13 (value 1.1253, the first below the apex) | PASS max 1.1255 on frame 11 of 40 (+186 ms); the haptic on frame 12 (value 1.1253, the first below the apex) |
| 24 | t24-peak | 24 the pop reaches 1.12 (one overshoot) and returns to 1 | PASS max 1.1255, last 1.0000 | PASS max 1.1255, last 1.0000 |
| 24 | t24-peak | 24 un-lighting fires nothing | PASS [] | PASS [] |
| 24 | t24-peak | 24 console clean | PASS [] | PASS [] |
| 24 | t24-peak | 24reduced reduced motion: no pop (the scale never moves) | PASS 0 scale changes | PASS 0 scale changes |
| 24 | t24-peak | 24reduced reduced motion: exactly 1 orb haptic | PASS ["orb"] | PASS ["orb"] |
| 24 | t24-peak | 24reduced reduced motion: it fires on the frame the fill completes | PASS fill reaches 1 on frame 9 of 10 (+150 ms); the haptic on frame 9 | PASS fill reaches 1 on frame 9 of 10 (+135 ms); the haptic on frame 9 |
| 24 | t24-peak | 24reduced un-lighting fires nothing | PASS [] | PASS [] |
| 24 | t24-peak | 24reduced console clean | PASS [] | PASS [] |
| 25 | t25-ring | 25 marked={2} draws the 1.5 px --ink ring on Wednesday | PASS {"markDay":"2","markStroke":"rgb(255, 255, 255)","markW":"1.5px","ink":"rgb(255, 255, 255)","gapDay":"2","gapStroke":"rgba(255, 255, 255, 0.28)", | PASS {"markDay":"2","markStroke":"rgb(255, 255, 255)","markW":"1.5px","ink":"rgb(255, 255, 255)","gapDay":"2","gapStroke":"rgba(255, 255, 255, 0.28)", |
| 25 | t25-ring | 25 a missed day has no arc; its stretch of track computes to --ink-4; no red anywhere in a ring | PASS {"gap":"rgba(255, 255, 255, 0.28)","ink4":"rgba(255, 255, 255, 0.28)","arcs":5,"red":false} | PASS {"gap":"rgba(255, 255, 255, 0.28)","ink4":"rgba(255, 255, 255, 0.28)","arcs":5,"red":false} |
| 25 | t25-ring | item 11 the in-bar Segmented is 96 × 32, radius 9 | PASS {"w":96,"h":32,"r":"9px"} | PASS {"w":96,"h":32,"r":"9px"} |
| 25 | t25-ring | item 11 a segmented change slides the thumb over ≥ 6 frames to the second half, no haptic | PASS {"distinctX":16,"endX":48,"on":"Month","haptics":[]} | PASS {"distinctX":14,"endX":48,"on":"Month","haptics":[]} |
| 25 | t25-ring | console clean | PASS [] | PASS [] |
| item 9 | tsw-swipe | sw1 the pane follows the finger 1:1 | PASS 37 frames, max /Δ/ 0.00 px | PASS 37 frames, max /Δ/ 0.00 px |
| item 9 | tsw-swipe | sw1 a slow 100 px release rests at the 72 px reveal detent; the action is a ≥ 44 px button; no haptic | PASS {"x":-72,"rev":"left","btn":[72,68],"log":["reveal-left"],"h":[]} | PASS {"x":-72,"rev":"left","btn":[72,68],"log":["reveal-left"],"h":[]} |
| item 9 | tsw-swipe | sw1 a tap elsewhere closes the open row and reaches nothing (here: no menu) | PASS {"rev":null,"log":["reveal-left","reveal-none"],"menu":false} | PASS {"rev":null,"log":["reveal-left","reveal-none"],"menu":false} |
| item 9 | tsw-swipe | sw3 a 120 px flick at ≥ 600 px/s commits (full): the content leaves to W with its velocity, onCommit on completion | PASS x max 390; at onCommit x 390.0; frames between release and commit 19; haptics [] | PASS x max 390; at onCommit x 390.0; frames between release and commit 18; haptics [] |
| item 9 | tsw-swipe | sw3 the row the page keeps comes home | PASS x 0, checked true | PASS x 0, checked true |
| item 9 | tsw-swipe | sw4 a full delete: the row leaves by a ≈ 100 ms fade (a copy of its pane) | PASS removed at frame 30; the fading copy on 6 frames over 80 ms (opacity 1.00 0.55 0.34 0.18 0.06 0.00) | PASS removed at frame 30; the fading copy on 6 frames over 88 ms (opacity 1.00 0.99 0.50 0.31 0.15 0.04) |
| item 9 | tsw-swipe | sw4 ... while the rows below FLIP up on a spring (no one-frame jump) | PASS row 3 moved up 52 px over 14 frames; largest step 7.2 px | PASS row 3 moved up 52 px over 14 frames; largest step 7.3 px |
| item 9 | tsw-swipe | sw4 ... and what follows the list (the Reset button) moves with them | PASS moved 52 px over 14 frames; largest step 7.0 px | PASS moved 52 px over 14 frames; largest step 7.4 px |
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
| R1 | r1-pager | c2 after goTo(+5), the host back on the base date: the neighbours are the adjacent days | PASS {"prev":"2026-10-23","cur":"2026-10-24","next":"2026-10-25"} | PASS {"prev":"2026-10-23","cur":"2026-10-24","next":"2026-10-25"} |
| R1 | r1-pager | c2 goTo(+3), three swipes back to today, one left swipe: lands on tomorrow (not the old far date) | PASS {"date":"2026-10-25","commits":["2026-10-25"],"title":"Tomorrow"} | PASS {"date":"2026-10-25","commits":["2026-10-25"],"title":"Tomorrow"} |
| R1 | r1-pager | c2 goTo(+3) caught near home, then one left swipe: tomorrow | PASS {"date":"2026-10-25","commits":["2026-10-25"]} | PASS {"date":"2026-10-25","commits":["2026-10-25"]} |
| R1 | r1-pager | c3 a strip drag that pages: no element is left pressed | PASS [] | PASS [] |
| R1 | r1-pager | c3 a day swipe that starts on a card: the card is not left pressed | PASS [] | PASS [] |
| R1 | r1-pager | c3 a swipe from the large title: nothing left pressed | PASS [] | PASS [] |
| R1 | r1-pager | c7 a tap on a data-no-page orb inside the 400 ms after a day drag springs home gets its click | PASS {"clicks":1,"date":"2026-10-24","tapAfterReleaseMs":251} | PASS {"clicks":1,"date":"2026-10-24","tapAfterReleaseMs":279} |
| R1 | r1-pager | u1 a hold then a 150 px drag left on a draggable row in a pager page: the object drags, the pager stays (0 track movement, 0 commits) | PASS {"drags":["start 2026-10-24","end ok"],"moves":10,"commits":0,"xmax":0,"date":"2026-10-24"} | PASS {"drags":["start 2026-10-24","end ok"],"moves":10,"commits":0,"xmax":0,"date":"2026-10-24"} |
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
| R1 | r1-sheet | u2 medium of [medium, large]: scrolled to its end, the body's last line and the foot's Save are on screen | PASS {"detent":"medium","top":422,"last":700,"save":[788,836],"H":844} | PASS {"detent":"medium","top":422,"last":700,"save":[788,836],"H":844} |
| R1 | r1-sheet | u2 the foot's Save is hit-testable at medium | PASS true | PASS true |
| R1 | r1-sheet | f6 a tap on the grabber row away from its buttons (the title line) cycles the detent | PASS large | PASS large |
| R1 | r1-sheet | c13 the grabber is a button with a name, and Enter cycles the detent (large → medium) | PASS {"tag":"BUTTON","label":"Collapse sheet","hidden":null,"h":24,"after":"medium"} | PASS {"tag":"BUTTON","label":"Collapse sheet","hidden":null,"h":24,"after":"medium"} |
| R1 | r1-sheet | f2 a tall sheet when the keyboard comes: its top stays put on every frame (shrinks, never drops) | PASS top range 10.0–10.0 over 44 frames | PASS top range 10.0–10.0 over 34 frames |
| R1 | r1-sheet | f2 the focused field never jumps down and ends above the keyboard | PASS {"maxDownStep":0,"fieldBottom":119,"visible":508} | PASS {"maxDownStep":0,"fieldBottom":119,"visible":508} |
| R1 | r1-sheet | f1 gallery sheet flick-dismiss: the first frame after release moves (≤ 20 ms), no gap > 34 ms in the first 260 ms | PASS {"first":16.5,"maxGap":17.100000000093132,"writes":[[17,91.65],[33,135.14],[50,187.96],[66,250.7],[83,315.81],[99,376.36],[116,437.84],[133,495.0 | PASS {"first":13.700000000186265,"maxGap":18.600000000093132,"writes":[[14,84.15],[30,123.48],[48,177.45],[65,243.13],[80,300.47],[98,368.9],[114,427. |
| R1 | r1-sheet | sheet console clean | PASS [] | PASS [] |
| R1 | r1-sheet | f5 a Plan session row (Easy 5): the sheet moves in the first frame after touchend (≤ 17 ms) | FAIL first moved frame +26.6 ms (first frame after touchend +26.6, ty 777) | FAIL first moved frame +121.7 ms (first frame after touchend +121.7, ty 777) |
| R1 | r1-sheet | f1 Plan session sheet flick-dismiss: the first frame after release moves (≤ 20 ms), no gap > 34 ms in the first 260 ms | PASS {"first":16.399999999906868,"maxGap":17,"writes":[[16,91.65],[33,135.14],[50,187.96],[66,250.7],[83,315.81],[100,376.36],[116,437.84],[133,495.02 | PASS {"first":5.399999999906868,"maxGap":22.699999999720603,"writes":[[5,74.23],[22,102.65],[44,163.82],[56,209.58],[74,273.61],[90,331.11],[106,394.8 |
| R1 | r1-press | u8 an element "pressable today-hero" gets .today-hero's own padding (18px), not the reset's 0 | PASS 18px | PASS 18px |
| R1 | r1-press | u3 the first tap on a revealed action commits it | PASS {"revealed":"left","log":["reveal-left","reveal-none","later-3"]} | PASS {"revealed":"left","log":["reveal-left","reveal-none","later-3"]} |
| R1 | r1-press | u4 Ticker +3.1 on springs.number: counts through intermediate values (≥ 8), no frame steps more than 0.5 and the last (the rest snap) ≤ 0.2 | PASS from 26.2: 21 distinct values, largest one-frame step 0.30, last 0.10 (26.2 26.3 26.5 26.7 26.9 27.2 27.4 27.7 27.9 28.1 28.2 28.4…) | PASS from 26.2: 19 distinct values, largest one-frame step 0.50, last 0.10 (26.2 26.7 27 27.3 27.5 27.7 27.9 28 28.2 28.3 28.5 28.6…) |
| R1 | r1-press | u4 WeekRing once-a-day fill on springs.number draws over several frames (≥ 6 distinct dash states) | PASS 45 distinct: 1 1 / 0 1 / 0.016929723751709647 1 / 0.03152243493061968 1 / 0.05616970874688054 1 / 0.12260609348874851 1 | PASS 43 distinct: 1 1 / 0 1 / 0.021375655270340133 1 / 0.06668441041014983 1 / 0.14462037665383143 1 / 0.21435208853345633 1 |
| R1 | r1-press | u9 a segment shows its press 60 ms into a touch (data-pressed, dimmed) | PASS {"pressed":true,"opacity":"0.579632","at":{"x":333,"y":397}} | PASS {"pressed":true,"opacity":"0.632726","at":{"x":333,"y":397}} |
| R1 | r1-press | press console clean | PASS [] | PASS [] |
| R1 | r1-a11y | c8 every tab root has a level-1 heading (its title) | PASS {"today":{"h1":["Threshold"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"de | PASS {"today":{"h1":["Threshold"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"de |
| R1 | r1-a11y | c10 no title-block part is a button that does nothing (Plan, Progress, Journal) | PASS {"today":{"h1":["Threshold"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"de | PASS {"today":{"h1":["Threshold"],"dead":[]},"plan":{"h1":["Plan"],"dead":[]},"progress":{"h1":["Progress"],"dead":[]},"journal":{"h1":["Journal"],"de |
| R1 | r1-a11y | c8 a pushed page's bar title is its level-1 heading | PASS ["Settings"] | PASS ["Settings"] |
| R1 | r1-a11y | c9 on a push, focus moves into the new page (its title) | PASS {"opener":"A.avatar:Profile and settings","afterPush":"H1.pb-title:Settings"} | PASS {"opener":"A.avatar:Profile and settings","afterPush":"H1.pb-title:Settings"} |
| R1 | r1-a11y | c9 on a pop, focus returns to the control that opened the page | PASS {"opener":"A.avatar:Profile and settings","afterPop":"A.avatar:Profile and settings"} | PASS {"opener":"A.avatar:Profile and settings","afterPop":"A.avatar:Profile and settings"} |
| R1 | r1-a11y | c10 a touch on the large title dims it (data-pressed, opacity ≤ 0.6) | PASS {"pressed":true,"opacity":0.55} | PASS {"pressed":true,"opacity":0.55} |
| R1 | r1-a11y | c10 at rest (inline title invisible) a tap there does not land on it | PASS {"opacity":0,"pe":"none","hitsInline":false} | PASS {"opacity":0,"pe":"none","hitsInline":false} |
| R1 | r1-a11y | c10 collapsed (inline title shown) it takes the tap | PASS {"opacity":1,"hitsInline":true} | PASS {"opacity":1,"hitsInline":true} |
| R1 | r1-a11y | a11y console clean | PASS [] | PASS [] |
| R1 | r1-push | c5 reduced motion: the parent never moves during a push or a pop (the layer only fades) | PASS max /parent x/ 0.0 px; push fade frames 6 | FAIL max /parent x/ 0.0 px; push fade frames 0 |
| R1 | r1-push | f4 push settings: the first frame that shows the layer has ≤ 10 % of the slide gone, and the slide then plays (no held frame) | PASS first painted x 375.7 (4 % gone); next steps 33 47 36 42 38 35 25 | PASS first painted x 375.7 (4 % gone); next steps 33 60 45 33 38 31 25 |
| R1 | r1-push | f10 the pushed bar's trailing avatar keeps the root bar's 16 px gutter (same right edge ± 2) | PASS {"right":374,"rootRight":374} | PASS {"right":374,"rootRight":374} |
| R1 | r1-push | f11 an edge drag from x 12 to 132: the layer sits at clientX − x0 = 120 (x0 at pointerdown, no re-base at the lock) | PASS {"layerLeft":120,"expected":120} | PASS {"layerLeft":120,"expected":120} |
| R1 | r1-push | push-settings console clean | PASS [] | PASS [] |
| R1 | r1-push | f4 push morning: the first frame that shows the layer has ≤ 10 % of the slide gone, and the slide then plays (no held frame) | PASS first painted x 375.7 (4 % gone); next steps 33 12 51 31 41 35 32 | PASS first painted x 375.7 (4 % gone); next steps 33 37 36 40 37 40 24 |
| R1 | r1-push | push-morning console clean | PASS [] | PASS [] |
| R1 | r1-misc | u10 a sync that failed is retried by the next non-forced call (not handed back for 30 s) | PASS {"requests":2,"syncs":["err","ok"]} | PASS {"requests":2,"syncs":["err","ok"]} |
| R1 | r1-misc | u10 after a quiet forced sync, a non-quiet call inside the gap still sends and shows the status line | PASS {"requests":2,"statusLine":true} | PASS {"requests":2,"statusLine":true} |
| R1 | r1-misc | f8 frame-paced input (one move per 16 ms): the release velocity reads the finger's 1500 px/s (± 35 %) in most flicks | PASS release v: -1412, -4000, -1429, -1500 px/s | FAIL release v: -1481, -3750, -819, -1371 px/s |
| R2 | r2-layer | c2-1-tap an edge pop caught at x < W/2 and let go (tap) comes home: the page stays, at 0, the URL unchanged, no pop | PASS {"caughtAt":164.3,"atRelease":164.3,"after":{"active":"today","path":"/settings","stack":["/settings"],"layers":[0],"nav":[]}} | PASS {"caughtAt":182.5,"atRelease":182.5,"after":{"active":"today","path":"/settings","stack":["/settings"],"layers":[0],"nav":[]}} |
| R2 | r2-layer | c2-1-tap console clean | PASS [] | PASS [] |
| R2 | r2-layer | c2-1-drag-left an edge pop caught at x < W/2 and let go (drag-left) comes home: the page stays, at 0, the URL unchanged, no pop | PASS {"caughtAt":164.3,"atRelease":64.3,"after":{"active":"today","path":"/settings","stack":["/settings"],"layers":[0],"nav":[]}} | PASS {"caughtAt":178,"atRelease":78,"after":{"active":"today","path":"/settings","stack":["/settings"],"layers":[0],"nav":[]}} |
| R2 | r2-layer | c2-1-drag-left console clean | PASS [] | PASS [] |
| R2 | r2-layer | c2-3 a push caught at 295.6 then dragged 180 px left: the layer follows the finger 1:1 (±2 px) on every frame | PASS {"maxErr":0,"track":[{"finger":283.1,"layer":273.1},{"finger":260.6,"layer":250.6},{"finger":238.1,"layer":228.1},{"finger":215.6,"layer":205.6}, | PASS {"maxErr":0,"track":[{"finger":242.2,"layer":232.2},{"finger":219.7,"layer":209.7},{"finger":197.2,"layer":187.2},{"finger":174.7,"layer":164.7}, |
| R2 | r2-layer | c2-3 then released: the page rests at 0 and stays | PASS {"active":"today","path":"/settings","stack":["/settings"],"layers":[0],"nav":["push:/settings"]} | PASS {"active":"today","path":"/settings","stack":["/settings"],"layers":[0],"nav":["push:/settings"]} |
| R2 | r2-layer | c2-2-cut This morning mounted at rest as Settings › Training goes (cut): the layer is at x 0 and takes the touch at (330, 400) | PASS {"path":"/today/2026-10-20/morning","left":0,"tf":"none","hit":"pushed","depth2":false} | PASS {"path":"/today/2026-10-20/morning","left":0,"tf":"none","hit":"pushed","depth2":false} |
| R2 | r2-layer | c2-2-cut console clean | PASS [] | PASS [] |
| R2 | r2-layer | c2-2-back This morning mounted at rest as Settings › Training goes (back): the layer is at x 0 and takes the touch at (330, 400) | PASS {"path":"/today/2026-10-20/morning","left":0,"tf":"none","hit":"pushed","depth2":false} | PASS {"path":"/today/2026-10-20/morning","left":0,"tf":"none","hit":"pushed","depth2":false} |
| R2 | r2-layer | c2-2-back console clean | PASS [] | PASS [] |
| R2 | r2-layer | n1-60 a second tap 60 ms after the avatar (layer at 155 px at its pointerdown) opens nothing on the page sliding in | PASS {"xAtDown":154.72608947753906,"stack":["/settings"],"path":"/settings"} | PASS {"xAtDown":195.3461151123047,"stack":["/settings"],"path":"/settings"} |
| R2 | r2-layer | n1-150 a second tap 150 ms after the avatar (layer at 62 px at its pointerdown) opens nothing on the page sliding in | PASS {"xAtDown":62.27244567871094,"stack":["/settings"],"path":"/settings"} | PASS {"xAtDown":64.00881958007812,"stack":["/settings"],"path":"/settings"} |
| R2 | r2-layer | n1-250 a second tap 250 ms after the avatar (layer at 19 px at its pointerdown) opens nothing on the page sliding in | PASS {"xAtDown":18.907411575317383,"stack":["/settings"],"path":"/settings"} | PASS {"xAtDown":14.451622009277344,"stack":["/settings"],"path":"/settings"} |
| R2 | r2-layer | n1-350 a second tap 350 ms after the avatar (layer at 4 px at its pointerdown) opens nothing on the page sliding in | PASS {"xAtDown":4.115598678588867,"stack":["/settings","/settings/you"],"path":"/settings/you"} | PASS {"xAtDown":3.6325936317443848,"stack":["/settings","/settings/you"],"path":"/settings/you"} |
| R2 | r2-layer | n1-rest at rest the same tap on Settings opens its section (depth 2) | PASS ["/settings","/settings/you"] | PASS ["/settings","/settings/you"] |
| R2 | r2-layer | n1 console clean | PASS [] | PASS [] |
| R2 | r2-layer | c2-4-1 a lit-tab pop-all from /settings, then a push 120 ms in: the URL names the pushed page and no pop follows the jump | PASS {"active":"today","path":"/dev/ui","stack":["/dev/ui"],"layers":[0],"nav":["jump:/dev/ui"]} | PASS {"active":"today","path":"/dev/ui","stack":["/dev/ui"],"layers":[0],"nav":["jump:/dev/ui"]} |
| R2 | r2-layer | c2-4-2 a lit-tab pop-all from /settings/training, then a push 120 ms in: the URL names the pushed page and no pop follows the jump | PASS {"active":"today","path":"/dev/ui","stack":["/dev/ui"],"layers":[0],"nav":["jump:/dev/ui"]} | PASS {"active":"today","path":"/dev/ui","stack":["/dev/ui"],"layers":[0],"nav":["jump:/dev/ui"]} |
| R2 | r2-layer | c2-5 chevron pop, Plan 80 ms later, then Back: Today's root with no layer (the closed page stays closed) | PASS {"active":"today","path":"/today","stack":[],"layers":[],"nav":["push:/settings","tab:/plan","pop:/today","jump:/today"]} | PASS {"active":"today","path":"/today","stack":[],"layers":[],"nav":["push:/settings","tab:/plan","pop:/today","jump:/today"]} |
| R2 | r2-layer | c2-5 console clean | PASS [] | PASS [] |
| R2 | r2-sheet | n2-auto open: no write of the rise is more than two frames ahead of the curve clocked from the frame after the sheet's first paint | PASS {"seq":[{"ms":-12,"gone":0.079,"allowed":0.188},{"ms":1,"gone":0.168,"allowed":0.194},{"ms":18,"gone":0.272,"allowed":0.296},{"ms":34,"gone":0.39 | PASS {"seq":[{"ms":-43,"gone":0.079,"allowed":0.188},{"ms":7,"gone":0.168,"allowed":0.227},{"ms":33,"gone":0.372,"allowed":0.409},{"ms":48,"gone":0.50 |
| R2 | r2-sheet | n2-stack open: no write of the rise is more than two frames ahead of the curve clocked from the frame after the sheet's first paint | PASS {"seq":[{"ms":-19,"gone":0.079,"allowed":0.188},{"ms":1,"gone":0.168,"allowed":0.191},{"ms":17,"gone":0.272,"allowed":0.292},{"ms":34,"gone":0.39 | PASS {"seq":[{"ms":-30,"gone":0.079,"allowed":0.188},{"ms":5,"gone":0.168,"allowed":0.217},{"ms":23,"gone":0.293,"allowed":0.334},{"ms":40,"gone":0.44 |
| R2 | r2-sheet | n2-auto open: no write of the rise is more than two frames ahead of the curve clocked from the frame after the sheet's first paint | PASS {"seq":[{"ms":-16,"gone":0.079,"allowed":0.188},{"ms":1,"gone":0.168,"allowed":0.192},{"ms":17,"gone":0.272,"allowed":0.295},{"ms":34,"gone":0.39 | PASS {"seq":[{"ms":-59,"gone":0.079,"allowed":0.188},{"ms":5,"gone":0.168,"allowed":0.215},{"ms":21,"gone":0.285,"allowed":0.318},{"ms":32,"gone":0.37 |
| R2 | r2-sheet | u1-push tall → short the sheet's top travels to the new panel's height with no one-frame jump (largest step ≤ max(60 px, 15 % of the travel) | PASS {"from":10,"to":725,"maxStep":79.9,"frames":31,"rest":{"bottom":844,"top":725,"body":true,"styleH":""}} | FAIL {"from":10,"to":725,"maxStep":170.5,"frames":28,"rest":{"bottom":844,"top":725,"body":true,"styleH":""}} |
| R2 | r2-sheet | u1-pop tall → short the pop back travels the same way (largest step ≤ max(60 px, 15 % of the travel)) and ends where the sheet opened | PASS {"from":725,"to":10,"maxStep":80,"frames":31} | PASS {"from":725,"to":10,"maxStep":77.2,"frames":29} |
| R2 | r2-sheet | u1-push short → taller the sheet's top travels to the new panel's height with no one-frame jump (largest step ≤ max(60 px, 15 % of the trave | PASS {"from":645,"to":465,"maxStep":20.1,"frames":26,"rest":{"bottom":844,"top":465,"body":true,"styleH":""}} | PASS {"from":645,"to":465,"maxStep":27.7,"frames":22,"rest":{"bottom":844,"top":465,"body":true,"styleH":""}} |
| R2 | r2-sheet | u1-pop short → taller the pop back travels the same way (largest step ≤ max(60 px, 15 % of the travel)) and ends where the sheet opened | PASS {"from":465,"to":645,"maxStep":20.1,"frames":26} | PASS {"from":465,"to":645,"maxStep":23.6,"frames":26} |
| R2 | r2-sheet | u2-n3 a medium sheet held 200 px up: its body reaches the screen's bottom (no empty band) | PASS {"top":222,"bodyBottom":1056,"hits":["body","body","body"]} | PASS {"top":222,"bodyBottom":1056,"hits":["body","body","body"]} |
| R2 | r2-sheet | u2-n3 released short: back at medium, the body's end and Save are still on screen and hit-testable (U2 kept) | PASS {"detent":"medium","save":[788,836],"hit":true} | PASS {"detent":"medium","save":[788,836],"hit":true} |
| R2 | r2-sheet | c2-6 large opened by Enter: focus is on the first field ("Push"), not the grabber | PASS {"cls":"btn soft ","text":"Push"} | PASS {"cls":"btn soft ","text":"Push"} |
| R2 | r2-sheet | c2-6 detents opened by Enter: focus is on the first field ("Push"), not the grabber | PASS {"cls":"btn soft ","text":"Push"} | PASS {"cls":"btn soft ","text":"Push"} |
| R2 | r2-sheet | u4 an inner panel's update({ sticky: true }): a scrim tap leaves the sheet open | PASS {"open":true,"title":"Unsaved 2"} | PASS {"open":true,"title":"Unsaved 2"} |
| R2 | r2-sheet | r2-sheet console clean | PASS [] | PASS [] |
| R2 | r2-misc | u6 a non-quiet sync 120 ms into a quiet one rides it: 1 request, the status line shows, then clears | PASS {"requests":1,"statusLine":true,"syncs":["ok"],"idle":"false"} | PASS {"requests":1,"statusLine":true,"syncs":["ok"],"idle":"false"} |
| R2 | r2-misc | u6 console clean | PASS [] | PASS [] |
| R2 | r2-misc | n5 Escape closes a sheet with no long task ≥ 50 ms starting in its first 40 ms (3 runs) | PASS {"longTasks":[[],[],[]]} | PASS {"longTasks":[[],[],[]]} |
| R2 | r2-misc | n5 the ring rules hold: after Escape the opener has focus and no quiet mark; a touch marks it quiet (no ring) | PASS {"afterEscape":{"opener":true,"quiet":false,"ring":"solid"},"afterTouch":{"quiet":true,"ring":"none","active":true}} | PASS {"afterEscape":{"opener":true,"quiet":false,"ring":"solid"},"afterTouch":{"quiet":true,"ring":"none","active":true}} |
| R2 | r2-misc | n5 console clean | PASS [] | PASS [] |
| R2 | r2-captions | u3 the captions of one Today root render (≈ 24 calls) take < 1 ms (median of 15) | PASS {"median":0.1,"max":0.2,"runs":[0,0,0,0,0.1,0.1,0.1,0.1,0.1,0.1,0.2,0.2,0.2,0.2,0.2]} | PASS {"median":0.2,"max":1.3,"runs":[0,0,0.1,0.1,0.1,0.2,0.2,0.2,0.5,0.6,0.9,1.1,1.1,1.3,1.3]} |
| R3 | r3-layer | c3-1 reduced: an edge touch during a push's crossfade completes it (opacity 1, inert root, stack [/settings]) | PASS {"path":"/settings","idx":1,"stack":["/settings(1)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false} | PASS {"path":"/settings","idx":1,"stack":["/settings(1)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false} |
| R3 | r3-layer | c3-1 reduced: an edge touch during a pop's crossfade completes the pop (no layer, /today, nothing half transparent) | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false} | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false} |
| R3 | r3-layer | c3-1 reduced: a double tap on the chevron pops once (no layer, /today, nothing half transparent) | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false} | PASS {"path":"/today","idx":1,"stack":[],"layers":[],"rootInert":false,"sheet":true} |
| R3 | r3-layer | c3-1 console clean | PASS [] | PASS [] |
| R3 | r3-layer | c3-2 reduced: a second tap +40 ms into the push (during the fade) opens nothing (/settings) | PASS {"path":"/settings","idx":1,"stack":["/settings(1)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false,"opacityAtTouch":0} | PASS {"path":"/settings","idx":1,"stack":["/settings(1)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false,"opacityAtTouch":0} |
| R3 | r3-layer | c3-2 reduced: a second tap +60 ms into the push (during the fade) opens nothing (/settings) | PASS {"path":"/settings","idx":2,"stack":["/settings(2)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false,"opacityAtTouch":0} | PASS {"path":"/settings","idx":2,"stack":["/settings(2)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false,"opacityAtTouch":0} |
| R3 | r3-layer | c3-2 reduced control: the same tap at rest opens the row's page | PASS {"path":"/settings/training","idx":4,"stack":["/settings(3)","/settings/training(4)"],"layers":[{"op":1,"left":0},{"op":1,"left":0}],"rootInert": | PASS {"path":"/settings/training","idx":4,"stack":["/settings(3)","/settings/training(4)"],"layers":[{"op":1,"left":0},{"op":1,"left":0}],"rootInert": |
| R3 | r3-layer | r5 A: chevron double tap +60 ms: popped, no click reached Today, no sheet | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false,"rootClicks":0} | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false,"rootClicks":0} |
| R3 | r3-layer | r5 A: chevron double tap +150 ms: popped, no click reached Today, no sheet | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false,"rootClicks":0} | PASS {"path":"/today","idx":0,"stack":[],"layers":[],"rootInert":false,"sheet":false,"rootClicks":0} |
| R3 | r3-layer | r5 B: a tap on Today's uncovered strip 60 ms into the push (layer x 223) opens nothing | PASS {"path":"/settings","idx":1,"stack":["/settings(1)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false,"rootClicks":0,"layerX":223} | PASS {"path":"/settings","idx":1,"stack":["/settings(1)"],"layers":[{"op":1,"left":0}],"rootInert":true,"sheet":false,"rootClicks":0,"layerX":230} |
| R3 | r3-layer | r5 control: at rest the same tap on Today is taken | PASS {"path":"/today","idx":2,"stack":[],"layers":[],"rootInert":false,"sheet":true} | PASS {"path":"/today","idx":2,"stack":[],"layers":[],"rootInert":false,"sheet":true} |
| R3 | r3-layer | r5 console clean | PASS [] | PASS [] |
| R3 | r3-layer | c3-6 scroll-during-push: Enter on Settings' first row (BUTTON.s-me halo halo-upcoming) opens it | PASS {"path":"/settings/you","idx":2,"stack":["/settings(1)","/settings/you(2)"],"layers":[{"op":1,"left":-117},{"op":1,"left":0}],"rootInert":true,"s | PASS {"path":"/settings/you","idx":2,"stack":["/settings(1)","/settings/you(2)"],"layers":[{"op":1,"left":-117},{"op":1,"left":0}],"rootInert":true,"s |
| R3 | r3-layer | c3-6 edge-drag-home: Enter on Settings' first row (BUTTON.s-me halo halo-upcoming) opens it | PASS {"path":"/settings/you","idx":2,"stack":["/settings(1)","/settings/you(2)"],"layers":[{"op":1,"left":-117},{"op":1,"left":0}],"rootInert":true,"s | PASS {"path":"/settings/you","idx":2,"stack":["/settings(1)","/settings/you(2)"],"layers":[{"op":1,"left":-117},{"op":1,"left":0}],"rootInert":true,"s |
| R3 | r3-layer | c3-6 control: Enter on Settings' first row (BUTTON.s-me halo halo-upcoming) opens it | PASS {"path":"/settings/you","idx":2,"stack":["/settings(1)","/settings/you(2)"],"layers":[{"op":1,"left":-117},{"op":1,"left":0}],"rootInert":true,"s | PASS {"path":"/settings/you","idx":2,"stack":["/settings(1)","/settings/you(2)"],"layers":[{"op":1,"left":-117},{"op":1,"left":0}],"rootInert":true,"s |
| R3 | r3-layer | c3-6 SwipeRow: a swipe that went home, then a click with no pointerdown 1 s later reaches the row | PASS {"clicks":1} | PASS {"clicks":1} |
| R3 | r3-nav | r2 sheet opened during a pop, closed by Escape: /today at idx 0, no layer | PASS {"open":{"active":"today","path":"/today","idx":1,"tabPath":"/today","stack":[],"layers":0,"sheet":true},"after":{"active":"today","path":"/today | PASS {"open":{"active":"today","path":"/today","idx":1,"tabPath":"/today","stack":[],"layers":0,"sheet":true},"after":{"active":"today","path":"/today |
| R3 | r3-nav | r2 … then a reload shows Today (the page the owner closed stays closed) | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} |
| R3 | r3-nav | r2 Escape console clean | PASS [] | PASS [] |
| R3 | r3-nav | r2 sheet opened during a pop, closed by X: /today at idx 0, no layer | PASS {"open":{"active":"today","path":"/today","idx":1,"tabPath":"/today","stack":[],"layers":0,"sheet":true},"after":{"active":"today","path":"/today | PASS {"open":{"active":"today","path":"/today","idx":1,"tabPath":"/today","stack":[],"layers":0,"sheet":true},"after":{"active":"today","path":"/today |
| R3 | r3-nav | r2 … then a reload shows Today (the page the owner closed stays closed) | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} |
| R3 | r3-nav | r2 X console clean | PASS [] | PASS [] |
| R3 | r3-nav | c3-3 tap-during-pop: Back from Plan shows what the jump showed (/today/2026-10-20) | PASS {"onPlan":{"active":"plan","path":"/plan","idx":2,"tabPath":"/plan","stack":[],"layers":0,"sheet":false},"back":{"active":"today","path":"/today/ | PASS {"onPlan":{"active":"plan","path":"/plan","idx":2,"tabPath":"/plan","stack":[],"layers":0,"sheet":false},"back":{"active":"today","path":"/today/ |
| R3 | r3-nav | c3-3 tap-after-rest: Back from Plan shows what the jump showed (/today/2026-10-20) | PASS {"onPlan":{"active":"plan","path":"/plan","idx":2,"tabPath":"/plan","stack":[],"layers":0,"sheet":false},"back":{"active":"today","path":"/today/ | PASS {"onPlan":{"active":"plan","path":"/plan","idx":2,"tabPath":"/plan","stack":[],"layers":0,"sheet":false},"back":{"active":"today","path":"/today/ |
| R3 | r3-nav | c3-4 jump-during-pop: Back shows the Journal root (the closed page stays closed) | PASS {"onToday":{"active":"today","path":"/today/2026-10-20","idx":2,"tabPath":"/today/2026-10-20","stack":[],"layers":0,"sheet":false},"back":{"activ | PASS {"onToday":{"active":"today","path":"/today/2026-10-20","idx":2,"tabPath":"/today/2026-10-20","stack":[],"layers":0,"sheet":false},"back":{"activ |
| R3 | r3-nav | c3-4 adopt-during-pop: Back shows the Journal root (the closed page stays closed) | PASS {"onToday":{"active":"today","path":"/today/2026-10-20","idx":3,"tabPath":"/today/2026-10-20","stack":[],"layers":0,"sheet":false},"back":{"activ | PASS {"onToday":{"active":"today","path":"/today/2026-10-20","idx":3,"tabPath":"/today/2026-10-20","stack":[],"layers":0,"sheet":false},"back":{"activ |
| R3 | r3-nav | c3-4 tab-during-pop: Back shows the Journal root (the closed page stays closed) | PASS {"onToday":{"active":"today","path":"/today","idx":2,"tabPath":"/today","stack":[],"layers":0,"sheet":false},"back":{"active":"journal","path":"/ | PASS {"onToday":{"active":"today","path":"/today","idx":2,"tabPath":"/today","stack":[],"layers":0,"sheet":false},"back":{"active":"journal","path":"/ |
| R3 | r3-nav | c3-4 jump-after-pop: Back shows the Journal root (the closed page stays closed) | PASS {"onToday":{"active":"today","path":"/today/2026-10-20","idx":2,"tabPath":"/today/2026-10-20","stack":[],"layers":0,"sheet":false},"back":{"activ | PASS {"onToday":{"active":"today","path":"/today/2026-10-20","idx":2,"tabPath":"/today/2026-10-20","stack":[],"layers":0,"sheet":false},"back":{"activ |
| R3 | r3-nav | c3-5 back-to-root, caught at 142 and brought home: Settings shown and the URL says /settings | PASS {"active":"today","path":"/settings","idx":1,"tabPath":"/today","stack":["/settings(1)"],"layers":1,"sheet":false} | PASS {"active":"today","path":"/settings","idx":1,"tabPath":"/today","stack":["/settings(1)"],"layers":1,"sheet":false} |
| R3 | r3-nav | c3-5 back-to-root: … the next Back pops Settings (/today, no layer) | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} |
| R3 | r3-nav | c3-5 chevron (control), caught at 142 and brought home: Settings shown and the URL says /settings | PASS {"active":"today","path":"/settings","idx":1,"tabPath":"/today","stack":["/settings(1)"],"layers":1,"sheet":false} | PASS {"active":"today","path":"/settings","idx":1,"tabPath":"/today","stack":["/settings(1)"],"layers":1,"sheet":false} |
| R3 | r3-nav | c3-5 chevron (control): … the next Back pops Settings (/today, no layer) | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} | PASS {"active":"today","path":"/today","idx":0,"tabPath":"/today","stack":[],"layers":0,"sheet":false} |
| R3 | r3-nav | c3-5 back-to-root caught: a reload keeps Settings | PASS {"active":"today","path":"/settings","idx":1,"tabPath":"/today","stack":["/settings(-1)"],"layers":1,"sheet":false} | PASS {"active":"today","path":"/settings","idx":1,"tabPath":"/today","stack":["/settings(-1)"],"layers":1,"sheet":false} |
| R3 | r3-sheet | r1 chevron, then the hero +100 ms: the sheet opens over a visible Today, 0 black frames | PASS {"sheet":true,"scroller":"visible","frames":44,"black":0} | PASS {"sheet":true,"scroller":"visible","frames":42,"black":0} |
| R3 | r3-sheet | r1 +100 ms: after the close Today's scroller is visible | PASS visible | PASS visible |
| R3 | r3-sheet | r1 chevron, then the hero +200 ms: the sheet opens over a visible Today, 0 black frames | PASS {"sheet":true,"scroller":"visible","frames":47,"black":0} | PASS {"sheet":true,"scroller":"visible","frames":49,"black":0} |
| R3 | r3-sheet | r1 +200 ms: after the close Today's scroller is visible | PASS visible | PASS visible |
| R3 | r3-sheet | r1 chevron, then the hero +300 ms: the sheet opens over a visible Today, 0 black frames | PASS {"sheet":true,"scroller":"visible","frames":53,"black":0} | PASS {"sheet":true,"scroller":"visible","frames":56,"black":0} |
| R3 | r3-sheet | r1 +300 ms: after the close Today's scroller is visible | PASS visible | PASS visible |
| R3 | r3-sheet | r1 control: a sheet over a pushed page at rest still hides the root under it | PASS hidden | PASS hidden |
| R3 | r3-sheet | u3-1 medium sheet up 30 held: Save stays on screen on every frame (moves with the sheet only below medium), no one-frame jump (≤ 40 px) | PASS {"frames":118,"offScreen":0,"maxJump":0,"end":{"top":422,"foot":[776,844]}} | PASS {"frames":117,"offScreen":0,"maxJump":0,"end":{"top":422,"foot":[776,844]}} |
| R3 | r3-sheet | u3-1 medium sheet up 40 then back: Save stays on screen on every frame (moves with the sheet only below medium), no one-frame jump (≤ 40 px) | PASS {"frames":127,"offScreen":0,"maxJump":5,"end":{"top":422,"foot":[776,844]}} | PASS {"frames":127,"offScreen":0,"maxJump":5,"end":{"top":422,"foot":[776,844]}} |
| R3 | r3-sheet | u3-1 medium sheet up 200: Save stays on screen on every frame (moves with the sheet only below medium), no one-frame jump (≤ 40 px) | PASS {"frames":123,"offScreen":0,"maxJump":0,"end":{"top":422,"foot":[776,844]}} | PASS {"frames":124,"offScreen":0,"maxJump":0,"end":{"top":422,"foot":[776,844]}} |
| R3 | r3-sheet | u3-2 a finger held still 50 ms into the FLIP: the sheet stays under it (spread ≤ 2 px over 25 frames) | PASS {"spread":0,"first":334.75,"last":334.75} | PASS {"spread":0,"first":212.33999633789062,"last":212.33999633789062} |
| R3 | r3-sheet | u3-2 … the drag and release end at rest (no box height left, translateY 0) | PASS {"top":725,"styleH":"","transform":"translateY(0px)","title":"Short"} | PASS {"top":725,"styleH":"","transform":"translateY(0px)","title":"Short"} |
| R3 | r3-sheet | f3-r6 a drag 150 ms into the FLIP tracks 1:1 (offset drift ≤ 4 px) | PASS {"drift":0,"offs":[-39,-39,-39,-39,-39,-39,-39,-39]} | PASS {"drift":0,"offs":[-39,-39,-39,-39,-39,-39,-39,-39]} |
| R3 | r3-sheet | u3-2 the back control touched +60 ms into the push: held under the finger (≤ 1 px), the tap pops the panel ("Easy 6") | PASS {"moved":0,"under":"back","sheet":true,"title":"Easy 6"} | PASS {"moved":0,"under":"back","sheet":true,"title":"Easy 6"} |
| R3 | r3-sheet | u3-2 the back control touched +150 ms into the push: held under the finger (≤ 1 px), the tap pops the panel ("Easy 6") | PASS {"moved":0,"under":"back","sheet":true,"title":"Easy 6"} | PASS {"moved":0,"under":"back","sheet":true,"title":"Easy 6"} |
| R3 | r3-sheet | u3-2 a tap aimed at the back control +60 ms into the push never closes the sheet (Short) | PASS {"sheet":true,"title":"Short"} | PASS {"sheet":true,"title":"Short"} |
| R3 | r3-sheet | u3-2 a tap aimed at the back control +150 ms into the push never closes the sheet (Short) | PASS {"sheet":true,"title":"Short"} | PASS {"sheet":true,"title":"Short"} |
| R3 | r3-sheet | u3-8 a pop mid-push (shift past 150 px) keeps its speed: the first step after it goes the same way (72.1 → 50.9 px), ends at rest | PASS {"before":[26.3,86.8,158.9],"after":[158.9,209.8,223.8,217.1,198.5],"end":0} | PASS {"before":[26.3,86.8,163.6],"after":[163.6,210.1,221.5,211.8,200.9],"end":0} |
| R3 | r3-sheet | u3-2 console clean | PASS [] | PASS [] |
| R3 | r3-sheet | r4 the hero tapped twice (+60 ms): the sheet stays open | PASS {"sheet":true,"top":436} | PASS {"sheet":true,"top":436} |
| R3 | r3-sheet | r4 the hero tapped twice (+150 ms): the sheet stays open | PASS {"sheet":true,"top":436} | PASS {"sheet":true,"top":436} |
| R3 | r3-sheet | r4 the hero tapped twice (+250 ms): the sheet stays open | PASS {"sheet":true,"top":436} | PASS {"sheet":true,"top":436} |
| R3 | r3-sheet | r4 control: a scrim tap at rest closes the sheet | PASS {} | PASS {} |
| R3 | r3-sheet | u3-4 toast during the FLIP's push: above the sheet's visible top or pinned on every frame, no step > max(90 px, the sheet's step that frame  | PASS {"frames":62,"bad":0,"jump":80,"over":0} | PASS {"frames":46,"bad":0,"jump":147,"over":0} |
| R3 | r3-sheet | u3-4 toast during the FLIP's pop: above the sheet's visible top or pinned on every frame, no step > max(90 px, the sheet's step that frame + | PASS {"frames":122,"bad":0,"jump":80,"over":0} | PASS {"frames":60,"bad":0,"jump":121,"over":0} |
| R3 | r3-sheet | u3-5 open() over an open tall sheet: the box travels (largest step ≤ max(60 px, 15 % of the travel)), "Another" shown, one overlay | PASS {"maxStep":74,"from":10,"to":725,"title":"Another","n":1,"overlays":1} | PASS {"maxStep":100,"from":10,"to":725,"title":"Another","n":1,"overlays":1} |
| R3 | r3-sheet | u3-5 … one Escape closes it, back on the page entry | PASS {"sheet":false,"path":"/dev/ui","overlays":0} | PASS {"sheet":false,"path":"/dev/ui","overlays":0} |
| R3 | r3-sheet | u3-5 console clean | PASS [] | PASS [] |
| R4 | r4-sheet | c4-1 grabber tap medium → large: Save on screen on every frame, no one-frame jump > 40 px | PASS {"frames":81,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[776,844],"kb":false,"d":"medium"},"end":{"top":10,"foot":[776,844],"kb":false," | PASS {"frames":84,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[776,844],"kb":false,"d":"medium"},"end":{"top":10,"foot":[776,844],"kb":false," |
| R4 | r4-sheet | c4-1 grabber tap large → medium: Save on screen on every frame, no one-frame jump > 40 px | PASS {"frames":81,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":422,"foot":[776,844],"kb":false,"d | PASS {"frames":81,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":422,"foot":[776,844],"kb":false,"d |
| R4 | r4-sheet | c4-1 Enter on the grabber medium → large: Save on screen on every frame, no jump | PASS {"frames":76,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[776,844],"kb":false,"d":"medium"},"end":{"top":10,"foot":[776,844],"kb":false," | PASS {"frames":76,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[776,844],"kb":false,"d":"medium"},"end":{"top":10,"foot":[776,844],"kb":false," |
| R4 | r4-sheet | c4-1 Enter on the grabber large → medium: Save on screen on every frame, no jump | PASS {"frames":74,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":422,"foot":[776,844],"kb":false,"d | PASS {"frames":77,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":422,"foot":[776,844],"kb":false,"d |
| R4 | r4-sheet | c4-1 the keys come up over medium: Save stays above the keys on every frame, no jump | PASS {"frames":72,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[476,544],"kb":true,"d":"large"},"end":{"top":10,"foot":[476,544],"kb":true,"d": | PASS {"frames":65,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[476,544],"kb":true,"d":"medium"},"end":{"top":10,"foot":[476,544],"kb":true,"d" |
| R4 | r4-sheet | c4-1 a drag down from large, 150 px, held (back to large): Save on screen on every frame, no jump | PASS {"frames":123,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":10,"foot":[776,844],"kb":false,"d | PASS {"frames":122,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":10,"foot":[776,844],"kb":false,"d |
| R4 | r4-sheet | c4-1 a drag down from large, 300 px, let go (to medium): Save on screen on every frame, no jump | PASS {"frames":108,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":422,"foot":[776,844],"kb":false," | PASS {"frames":108,"offScreen":0,"maxJump":0,"first":{"top":10,"foot":[776,844],"kb":false,"d":"large"},"end":{"top":422,"foot":[776,844],"kb":false," |
| R4 | r4-sheet | c4-1 control: an upward nudge from medium keeps Save on screen (round 3's R3) | PASS {"frames":114,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[776,844],"kb":false,"d":"medium"},"end":{"top":422,"foot":[776,844],"kb":false | PASS {"frames":114,"offScreen":0,"maxJump":0,"first":{"top":422,"foot":[776,844],"kb":false,"d":"medium"},"end":{"top":422,"foot":[776,844],"kb":false |
| R4 | r4-sheet | c4-1 console clean | PASS [] | PASS [] |
| R4 | r4-sheet | k4-1 open() of a [medium, large] spec over an open auto sheet rests at medium like a fresh open (top 422, Save on screen) | PASS {"fresh":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"from":{"top":10,"boxH":834,"d":"auto","inset":"0 | PASS {"fresh":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"from":{"top":10,"boxH":834,"d":"auto","inset":"0 |
| R4 | r4-sheet | k4-1 … it travels there with no one-frame jump (largest step ≤ max(60 px, 15 % of the travel)) | PASS {"maxStep":39.6,"bound":61.8,"frames":81} | PASS {"maxStep":57.1,"bound":61.8,"frames":78} |
| R4 | r4-sheet | k4-1 … then open() of a short auto spec: detent auto, no inset, the box is the sheet (no stale medium) | PASS {"top":725,"boxH":119,"d":"auto","inset":"0px","title":"Another","foot":null} | PASS {"top":725,"boxH":119,"d":"auto","inset":"0px","title":"Another","foot":null} |
| R4 | r4-sheet | k4-1 … it travels there with no one-frame jump | PASS {"maxStep":23.7,"bound":60,"frames":81} | PASS {"maxStep":59.8,"bound":60,"frames":80} |
| R4 | r4-sheet | k4-2 every replaced spec's onClose runs once, in order (auto, medium, then the last on Escape) | PASS ["close-auto","close-medium","close-auto2"] | PASS ["close-auto","close-medium","close-auto2"] |
| R4 | r4-sheet | k4-1 a fresh [medium, large] sheet at medium, then open() of a short auto spec: detent auto, inset 0, the box is the sheet | PASS {"from":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"now":{"top":725,"boxH":119,"d":"auto","inset":"0p | PASS {"from":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"now":{"top":725,"boxH":119,"d":"auto","inset":"0p |
| R4 | r4-sheet | k4-1 … it travels there with no one-frame jump | PASS {"maxStep":23.7,"bound":60,"frames":83} | PASS {"maxStep":29.9,"bound":60,"frames":80} |
| R4 | r4-sheet | k4 console clean | PASS [] | PASS [] |
| R4 | r4-sheet | k4-1 [reduced motion] open() of a [medium, large] spec over an open auto sheet rests at medium like a fresh open (top 422, Save on screen) | PASS {"fresh":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"from":{"top":10,"boxH":834,"d":"auto","inset":"0 | PASS {"fresh":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"from":{"top":10,"boxH":834,"d":"auto","inset":"0 |
| R4 | r4-sheet | k4-1 [reduced motion] … then open() of a short auto spec: detent auto, no inset, the box is the sheet (no stale medium) | PASS {"top":725,"boxH":119,"d":"auto","inset":"0px","title":"Another","foot":null} | PASS {"top":725,"boxH":119,"d":"auto","inset":"0px","title":"Another","foot":null} |
| R4 | r4-sheet | k4-2 [reduced motion] every replaced spec's onClose runs once, in order (auto, medium, then the last on Escape) | PASS ["close-auto","close-medium","close-auto2"] | PASS ["close-auto","close-medium","close-auto2"] |
| R4 | r4-sheet | k4-1 [reduced motion] a fresh [medium, large] sheet at medium, then open() of a short auto spec: detent auto, inset 0, the box is the sheet | PASS {"from":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"now":{"top":725,"boxH":119,"d":"auto","inset":"0p | PASS {"from":{"top":422,"boxH":834,"d":"medium","inset":"412px","title":"Routine","foot":[776,844]},"now":{"top":725,"boxH":119,"d":"auto","inset":"0p |
| R4 | r4-sheet | k4 [reduced motion] console clean | PASS [] | PASS [] |
| R4 | r4-nav | c4-2a nav.go('/today/2026-10-20') from a sheet over /dev/ui: Today is visible on every sliding frame, 0 black frames | PASS {"moving":30,"hidden":0,"frames":31,"black":0} | PASS {"moving":7,"hidden":0,"frames":9,"black":0} |
| R4 | r4-nav | c4-2a … lands on /today/2026-10-20, no layer, no sheet | PASS {"path":"/today/2026-10-20","idx":1,"stack":[],"layers":0,"sheet":false} | PASS {"path":"/today/2026-10-20","idx":1,"stack":[],"layers":0,"sheet":false} |
| R4 | r4-nav | c4-2b nav.pop() under a sheet: the sheet closes with it; Today is visible on every sliding frame, 0 black | PASS {"pre":{"path":"/dev/ui","idx":3,"stack":["/dev/ui(2)"],"layers":1,"sheet":true},"mid":{"path":"/today","idx":1,"stack":[],"layers":0,"sheet":fal | PASS {"pre":{"path":"/dev/ui","idx":3,"stack":["/dev/ui(2)"],"layers":1,"sheet":true},"mid":{"path":"/today","idx":1,"stack":[],"layers":0,"sheet":fal |
| R4 | r4-nav | c4-2b … the URL is /today on Today's own entry (nav.idx 1), no layer | PASS {"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false} | PASS {"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false} |
| R4 | r4-nav | c4-2b … a reload shows Today, not the popped page | PASS {"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false} | PASS {"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false} |
| R4 | r4-nav | c4-3 nav.pop() then Back 80 ms in: one 'pop' event, /today one entry back, no layer | PASS {"ev":["pop:/today"],"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false,"before":2} | PASS {"ev":["pop:/today"],"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false,"before":2} |
| R4 | r4-nav | c4-3 control: a lit-tab pop-all dispatches one 'pop' and lands on /today | PASS {"ev":["pop:/today"],"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false} | PASS {"ev":["pop:/today"],"path":"/today","idx":1,"stack":[],"layers":0,"sheet":false} |
| R4 | r4-nav | c4 console clean | PASS [] | PASS [] |
| R4 | r4-layer | d1a a tap on Training while the Settings push is 1–8 px from rest (at 2.42 px) pushes Training | PASS {"at":2.42,"path":"/settings/training","stack":["/settings","/settings/training"],"sheet":false,"attempt":0} | PASS {"at":2.57,"path":"/settings/training","stack":["/settings","/settings/training"],"sheet":false,"attempt":0} |
| R4 | r4-layer | d1b a tap on Today's hero while the pop is 1–8 px from gone (at 3.77 px) opens the session sheet, on /today | PASS {"at":3.77,"path":"/today","stack":[],"sheet":true,"attempt":0} | PASS {"at":2.67,"path":"/today","stack":[],"sheet":true,"attempt":0} |
| R4 | r4-layer | d1c a scrim tap while the sheet is 1–8 px from its detent (at 2.61 px) closes it | PASS {"at":2.61,"path":"/today","stack":[],"sheet":false,"attempt":0} | PASS {"at":1.89,"path":"/today","stack":[],"sheet":false,"attempt":0} |
| R4 | r4-layer | d1c control: a scrim tap 120 ms into the rise (sheetY 128.52) closes nothing (round 3's R4) | PASS {"path":"/today","stack":[],"sheet":true,"layerX":null,"sheetY":128.52} | PASS {"path":"/today","stack":[],"sheet":true,"layerX":null,"sheetY":100.12} |
| R4 | r4-layer | sw4 a row revealed (left), then one tap on the pushed bar's chevron: the page pops on that tap | PASS {"rev":"left","path":"/today","stack":[],"sheet":false} | PASS {"rev":"left","path":"/today","stack":[],"sheet":false} |
| R4 | r4-layer | sw4 control: a tap on another row in the list closes the open row and is consumed | PASS {"rev2":"left","rev":null,"log":["reveal-none"],"path":"/dev/ui"} | PASS {"rev2":"left","rev":null,"log":["reveal-none"],"path":"/dev/ui"} |
| R4 | r4-layer | k4-5 a revealed row (left), then a tap whose click carries another pointerId: the click is still swallowed | PASS {"rowClosed":true,"log":["reveal-none"]} | PASS {"rowClosed":true,"log":["reveal-none"]} |
| R4 | r4-layer | k4-5 control: an arm whose pointer made no click is retired by the next pointerdown (that tap's click goes through) | PASS {"rowClosed":true,"log":["reveal-none","scale"]} | PASS {"rowClosed":true,"log":["reveal-none","scale"]} |
| R4 | r4-layer | k4-5 control: a click with its own pointerId is swallowed as before | PASS {"rowClosed":true,"log":["reveal-none"]} | PASS {"rowClosed":true,"log":["reveal-none"]} |
| R4 | r4-layer | r4-layer console clean | PASS [] | PASS [] |

| §2.5 | checks | 1× pass | 4× pass |
|---|---|---|---|
| E2E | 22 | 22/22 | 22/22 |
| 1 | 6 | 6/6 | 6/6 |
| 2 | 18 | 18/18 | 18/18 |
| 2·interim | 14 | 13/14 | 13/14 |
| 3 | 6 | 6/6 | 6/6 |
| 4 | 8 | 8/8 | 8/8 |
| 5 | 2 | 2/2 | 2/2 |
| 6 | 14 | 14/14 | 14/14 |
| 7 | 8 | 8/8 | 8/8 |
| 8 | 9 | 9/9 | 9/9 |
| 9 | 13 | 13/13 | 13/13 |
| 10 | 9 | 8/8 | 9/9 |
| 11 | 5 | 5/5 | 5/5 |
| 12 | 21 | 20/21 | 19/21 |
| 13 | 41 | 41/41 | 40/41 |
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
| R1 | 70 | 69/70 | 67/70 |
| R2 | 39 | 39/39 | 38/39 |
| R3 | 61 | 61/61 | 61/61 |
| R4 | 40 | 40/40 | 40/40 |
| **all (excl. 2·interim)** | 617 | 614 | 586/593 |

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

## Gates (rerun after review round 4)

| Gate | Result |
|---|---|
| `pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` | exit 0 |
| `pnpm --filter @logbook/shared test` | 88 passed |
| `pnpm --filter @logbook/api test` | 59 passed |
| `pnpm --filter @logbook/web test` | 85 passed, 8 files (unchanged; round 4's checks are the in-browser `R4` scripts, 40 checks) |
| `pnpm --filter @logbook/web build` | ok. Largest entry chunk 934.07 kB raw (round 3: 932.20 kB); 24 files precompressed, 1332 KB raw → 424 KB gzip, 365 KB brotli |
| `qa/t21-gates.sh` (#21, WP1's half) | 23 grep gates pass, plus the route and caption unit tests (48) |
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
14. (Round 2) Today: tap the avatar twice quickly. Expected: Settings slides in once; the second tap opens nothing.
15. (Round 2) On Settings, drag from the left edge past a third and let go, then touch the page as it slides away and let go before the middle. Expected: it comes back and stays; dragging it back left follows the finger.
16. (Round 2) /dev/ui → "Auto + field" → "Push a short panel", then the chevron. Expected: the sheet glides down to the short panel and back up; it never jumps.
17. (Round 2) /dev/ui → "Medium ⇄ large": drag the grabber up and hold. Expected: the body runs to the screen's bottom; no empty band.
18. (Round 4) /dev/ui → "Medium ⇄ large": tap the grabber, then tap it again; also Tab to the grabber and press Enter. Expected: Save stays on the screen's bottom the whole way, both directions; nothing jumps when the sheet rests.
19. (Round 4) /dev/ui → "Auto + field" → scroll to the end → "Open medium". Expected: the sheet glides down to half height (as "Medium ⇄ large" opens) with Save on screen; then "Open auto": it glides down to a short sheet with no empty box under it.
20. (Round 4) Today → avatar, then tap a Settings row the moment the page looks settled. Expected: the row opens on that first tap. The same after the chevron: a tap on Today's hero as Settings leaves opens the session sheet.
21. (Round 4) /dev/ui → Swipe rows: swipe one row 100 px (it rests open), then tap the bar's chevron. Expected: the page pops on that one tap; a tap on another row only closes the open one.

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
- **Review round 4.**
  - **Contracts §C.1 (new).**
    - `open()` over an open sheet rests at the new spec's rest detent, reached from where the sheet is.
    - It runs the replaced specs' `onClose`. An inner `pop()` runs the popped panel's.
  - **Contracts §D.1.** `springFor`'s `type` is a generator (`unitAware`), not `'spring'`. Also repeated: `forScale`/`forRange` optional, §A.2 `segment`, §A.3 `.page-root`.
  - **Spec §9.3 / §9.4 / §10.** A push, a pop or a sheet's rise within `ARRIVED_PX` (8 px) of rest takes a tap: the move completes on that pointerdown. Further out, the transition takes no touch. The edge band keeps the 1 px catch rule.
  - **Spec §9.6.** A revealed swipe row consumes the closing tap only inside its list. A tap on a bar, the tab bar or a sheet's header acts at once.
  - **Spec §9.2 (repeated, F8).** A sampled velocity tracker (pointer `timeStamp`s, no 30 ms cap) for the pager and the edge pop. Under 4× CDP input, 2 of 6 flicks read 0.
  - **WP2 (repeated, feel O1–O4).**
    - On a two-session day the hero's own carousel blocks the day swipe: §3.4 has no inner carousel.
    - Pass `word` to NavBar.
    - The stops line pushes This morning.
    - The hero menu has 4 items.
    - The headline must not break mid-word at 390.
- **Review round 2.**
  - **Contracts (repeated from round 1, still not in `contracts.md`).**
    - §D.1: `forScale` / `forRange`. `springs.complete` is now scale-native, so the §D.3 orb works as written.
    - §A.2: `segment`.
    - §A.3: `.page-root`.
  - **Spec §9.5 / WP2.** Pull to refresh has no keyboard or VoiceOver path (code review 2 #7). Add a "Refresh" item in Today's title menu that dispatches `REFRESH`.
  - **WP3.** The interim This morning page mounts synchronously in 83–206 ms at 4×, so its push starts 107–247 ms after the tap (feel review 2 N4). WP1's push already starts on the first painted frame.
  - **Spec §9.3.** UIKit's rule is now WP1's: a tap on a page that is still sliding opens nothing. The edge band still catches it (feel review 2 N1). Add it to §9.3's table.
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

- **Review round 4.**
  - `nav.pop()` and a lit-tab `popAll` close open overlays first, as `push`, `go` and `activate` do.
  - A layer that starts leaving notifies the store's listeners without a state change (`leavingChanged`).
  - A pop dispatches exactly one `pop` event, also when Back lands during its spring.
  - `ui/clickSwallow.ts` (internal) falls back to the latest released arm for a click whose `pointerId` matches no arm, and retires released arms on the next `pointerdown`.

- **Review round 3.**
  - The eight springs carry a unit-aware generator as their `type`. It uses the px rest (|Δ| ≤ 1, |v| ≤ 30) for a move of 5 units or more, and `forScale`'s thresholds under 5. So `animate(scale, LIFT_SCALE, springs.lift)`, a check on `springs.settle` and a ring on `springs.number` work exactly as contracts §D.1 lists them. `forScale` and `forRange` stay valid and are optional (request: list them in §D.1 as such). The deprecated `springs.press` is the old px spring, unchanged.
  - `ui/clickSwallow.ts` (WP1-internal) swallows one pointer's click. It is not part of any contract.
  - While a sheet is up, a page on its way out covers nothing (`NavController.isLeaving`). `openOverlay` settles a leaving page's history before it writes its entry.
  - The page under a moving push or pop takes no pointerdown. This is UIKit's rule; packages need do nothing.

- **Review round 2.**
  - `LayerControl` (internal) also has `leaving()`. `activate` uses it to settle a leaving page's history before it writes the new tab's entry.
  - An `auto` sheet's inner push or pop moves its box by a transform-only shift (§10.1 FLIP), not by sheetY. The scrim, the recede and the toasts' `sheetY` are untouched.
  - `springs.complete` carries scale rest thresholds.
  - Focus rings: the root no longer carries `data-input`. The focused element gets `data-quiet-focus` instead.

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

Added in review round 4:
- **The click swallow on WKWebView.** Double-tap the avatar: Settings is pushed once. Reveal a swipe row and tap a list button within 400 ms: it only closes the row. These confirm the fallback for a click whose `pointerId` differs from the touch's.
- **The 8 px "arrived" band on a real thumb.** A tap right after a push or a pop settles acts on the first try.

Added in review round 2: the keyboard's raise, which restyles the document through the root `--kb`. It measures 67–115 ms at 4× here (feel review 2 N7).

Added in review round 1:
- the pager's release velocity with real touch input (feel review 1 #8);
- the stacked labels mid-drag (#9);
- a tall sheet with the keyboard up, which keeps its top and pads its body by `--kb`.


`Keyboard.resize = 'none'` + `--kb` on an iPhone build; the splash on the first content frame; the edge swipe in the standalone PWA and a Safari tab; inner-scroller `scrollTop` during the rubber band; the strip drag's direction (risk 16); routine-step reorder through hold → move (risk 9); the stacked labels in WebKit; the sheet's `bottom: var(--kb)` with a field focused; the tab preparation on a real press (iOS's tap timing).

## Screenshots (looked at, each one)

Review round 4, before (unfixed `265169e` plus the gallery hooks, `S/wp1/r4pre/serve.sh`) and after, at 390 and 320:
- Files: `S/wp1/qa/shots/r4-{before,after}-{390,320}-{grabber-tap-150ms,open-medium-over-auto,open-auto-over-medium,pop-under-sheet-250ms}.png`.
- Side by side (top row before, bottom row after): `S/wp1/qa/shots/cmp-fix4-{390,320}.png`.
- What they show:
  - 150 ms after a grabber tap: no Save on screen → Save on the screen's bottom.
  - `open()` of a `[medium, large]` spec over a tall auto sheet: full height → medium with Save.
  - `open()` of a short auto spec over it: the same at rest; the stale box is measured in `r4-sheet`.
  - `nav.pop()` under a sheet: a black screen with the sheet still up → Today, the sheet closed with the pop.
- `scrollWidth` equals the width at both sizes; console clean.

Review round 3, before (unfixed `08e4764`, `S/wp1/r3pre/serve.sh`) and after, at 390 and 320:
- Files: `S/wp1/qa/shots/r3-{before,after}-{390,320}-{sheet-during-pop,chevron-double-tap,medium-nudged-30,flip-held,toast-mid-flip,open-another-mid,open-another-rest}.png`.
- Side by side: `S/wp1/qa/shots/cmp-fix3-{390,320}.png`.
- What they show:
  - A sheet opened during a pop: black behind it → Today.
  - A chevron double tap: Today's word sheet opened → Today, no sheet.
  - A medium sheet nudged 30 px up: Save gone → Save on screen.
  - A toast mid-FLIP: over the panel → above it.
  - `open()` over a tall sheet: mid-travel and at rest.
- `flip-held` at 320 caught the push after it rested (the script's fixed 50 ms on this container). The measured proof is `r3-sheet` u3-2.
- `scrollWidth` = width everywhere; console clean.

Review round 2, before (pre-fix archive) and after, at 390 and 320:
- Files: `S/wp1/qa/shots/r2-{before,after}-{390,320}-{morning-after-cut,medium-held-up-200,push-short-mid,push-short-rest}.png`.
- Side by side: `S/wp1/qa/shots/cmp-fix2-{390,320}-*.png`.
- What they show:
  - This morning after a cut was shifted 117 px left with a black band; it is now at 0 with its chevron.
  - A medium sheet held 200 px up ended at Save with an empty band below; its body now runs to the bottom.
  - Mid-push of a short panel, the box was already short; the top now travels with the outgoing panel inside.
  - At rest the two builds are identical.

Review round 1:
- `S/wp1/qa/shots/after-<390|320>-*.png` is this build.
- `S/wp1/qa/shots-qa0/after-*.png` is the QA-step build.
- Side by side: `S/wp1/qa/shots/cmp-fix1-{root-today,settings,root-plan,sheet-medium,this-morning}.png`. They show the avatar on Settings keeping the root bar's gutter, the medium sheet's Save reachable, and the U8 side effects above.
- `scrollWidth` = width on every state at 390 and 320; console clean.


S/wp1/qa/shots/, `after-<390|320>-<state>.png` (this build) and `before-<390|320>-<state>.png` (the base, `claude/hopeful-einstein-eunarl`):
`root-today`, `root-plan`, `root-progress`, `root-journal`, `today-scrolled-60` (the interim Today cannot scroll 60: see `lab-scrolled-60`), `lab-rest`, `lab-scrolled-60` (bar collapsed, strip pinned, the word visible), `settings` (Today's avatar), `settings-training`, `this-morning`, `reads`, `settings-plans`, `hold-menu-hero`, `sheet-medium`, `sheet-large`, `toast`, `pager-mid-drag` (after only: the base gallery has no DayPager; its sheet shots are the Plan session sheet). The base overflows horizontally on Today (`scrollWidth` 406 at 390, 336 at 320) and pushes the tab bar half off screen; this build is 390 / 320 everywhere, console clean.
