# WP2 Today: review

Branch `feel/wp2`, from `feel/pages-base` (`400f8f5`). Spec: `docs/feel.md` v4.2. Build plan §3. This file has fix round 2
first, then fix round 1 (each: the three reviews' findings), then the QA step's review (the package's acceptance, as team-rules asks of REVIEW.md),
then the three build steps' notes as they were written (`# Build history`).

S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`. The battery is `S/wp2/qa/`
(one runner, `node run.mjs`, at 1× and 4×; every row with its numbers in `S/wp2/qa/results/TABLE.md`).

## Fix round 2 (2026-10-25): the three reviews' findings, round 2

Reviews: `S/wp2/review-code-2.md` (code 1–6), `S/wp2/review-feel-2.md` (feel 1–11), `S/wp2/review-day-2.md` (day 1–10). The full
record (finding → what was done → the proof, before and after, 1× and 4×) is `S/wp2/fix-2.md`. Each finding has a check under
`S/wp2/qa/` (`f2-save`, `f2-ring`, `f2-orbs`, `f2-skip`, `f2-close`, `f2-coach`, `f2-misc`, `f2-open`, all in `run.mjs`) or a unit
test (`faces.test.ts`), run first against the review build (`bf3c49e`, kept at `S/wp2/fix2/dist-before`), where it failed.

### What changed (all in WP2's files)

| Files | Findings | Change |
|---|---|---|
| `features/day/journalGuard.ts` (new), `CloseDay.tsx`, `TheDayCard.tsx` | code 1, 2, 5; day 1 | A Today composer's journal add is followed from the mutation cache until the server answers (`watchJournalAdd`), so a refusal rolls the card back however late it comes and whatever has unmounted: the provisional entry leaves the month, the words return to the draft with the error toast (unless the still-mounted Composer did both), the field comes back. The Close card cancels its layers' earlier animations before a new crossfade (a refusal inside the crossfade left the field at opacity 0). A keyboard Save moves the focus to `Add to it`; a refused one back to the field |
| `features/day/HoldRing.tsx`, `release.ts`, `Hero.tsx`, `CloseDay.tsx` | code 3 | The ring shows its own completion (`doneSelf || done`); the caller's `done` takes it back on a true → false edge, a failed write (the promise `onComplete` may return) clears it. The check's swap starts in the completing task, a frame in; the callers write after the frame (`afterPaint`). The motion-driven styles are written only by their listeners (a background commit could write a stale `style` back). The second ring's `toggle` listens to a value of its own (see request 34) |
| `features/habits/OrbRow.tsx`, `DayPage.tsx`, `CloseDay.tsx` | feel 1, 2; code 6; day 6 | The orb's write waits for the hand to rest (no pointer down, no pager move, no scroll for 250 ms), then goes at idle (8 s cap; at once on unmount or hide). The orbs' shown state is a per-day store; the head's count (`HabitsMeta`) and the Close card's stamp count from it (`useHabitsLit`) |
| `features/day/faces.ts`, `faces.test.ts` | day 2, feel 8 | The Skipped face's eyebrow follows its deck: `THIS MORNING` while the morning line shows, never `OUT`; the deck's change at Leave has its own face key (deferred, crossfaded). The next-session row's time is its own span, dropped whole below 360 |
| `features/day/Hero.tsx`, `RunLanding.tsx`, `day.css` | code 4, feel 4, 5, 6, 7 | `useMarkOverride` for the hero and the second session: the face (or the line) first, the write after the 150 ms crossfade, the override held while any write of that session is in flight. The second session's line crossfades in a `popLayout` slot and its ring fades; `Not done` on a marked-done second session. The hero's ring slot fades with the faces (`AnimatePresence`) |
| `features/day/CloseDay.tsx` | feel 3 | `flipCard`: the box is scaled and clipped to its interpolated height while the card moves (its layers counter-scaled), so `Add to it`'s composer is revealed as the card opens, never over the Tomorrow group |
| `api/queries.ts` (WP2 block), `features/day/coachShown.ts` (new), `useStravaLanding.ts`, `RunLanding.tsx` | day 7 | The coach's read joins the month's cached payload in place (no page rebuilds its snapshot for one sentence) and shows at once in the landed deck from a small store |
| `features/day/DayPage.tsx` | feel 10, day 4 (WP2's part) | The one-time nudge's store is read by its slot, not by every day page (the first push re-rendered all three pages inside the push's task) |

### Not closed in WP2's files, and why

- **day 3** (the alarm sheet) and **day 4 / feel 10** (the morning push), restated from the input's own time (`f2-open`): WP2's
  part holds on both builds (the push and the sheet happen in the pointerup's own task; the sheet's scrim is already darkening
  on the first frame after the input). The sheet's edge moves two frames later (WP1's `Sheet`, request 32); the push's first
  move is the push's own task (WP1's PushedLayer / DayPager measure, WP3's MorningView mount; requests 27, 29). Numbers in
  `S/wp2/fix-2.md`.
- **feel 9**: the half-collapsed bar is WP1's NavBar (no snap) and WP1's `revealField` target. Request 33.
- **feel 11, day 8**: the Skip deck's words (`ALARM` / `Wake`, the rest morning's stops) are the spec's call. Request 25.
- **day 5**: WP6's Composer haptic and journal write. Requests 30, 17.
- **day 9** (sev 1): `Add to it` shows the composer in the entries' place; keeping the entries above it is a third layer and a
  different Save transition. Left for the integration polish.
- **day 10**: WP1's crossfade from black. Request 31.
- **feel 7** on Oct 11: that lift is done by its logged sets, not a mark, so there is nothing to take back from the card; a
  marked-done second session now has `Not done`.

### Battery

`node S/wp2/qa/run.mjs` (the QA battery, round 1's fix checks and this round's), run with `SHIFT_DAYS=-1`: the real date
was Sunday Oct 25, a lift-only day, and the QA scripts were written on the Saturday (the two-session day with an open run).
A first attempt on Sunday's own date failed `t46`, `t13`, `t16`, `t45`, `t63` and part of `t10` for that reason alone (no
open run today); the QA lib now takes `SHIFT_DAYS`, and `t45` / `t63`'s node-side dates follow it (marked `[restated in fix
round 2]`). Table: `S/wp2/qa/results/TABLE.md`.

| Part | Checks | 1× | 4× | Round 1 |
|---|---|---|---|---|
| QA battery | 183 | 183/183 | 171/174 | 183/183, 171/174 |
| Round 1's fix checks | 55 | 54/55 | 47/50 | 54/55, 47/50 |
| This round's fix checks | 37 | 35/37 | 35/37 | — |
| **All** | 275 | **272/275** | **253/261** | 237/238, 218/224 |

The misses, each one also missing on the review build or in round 1:
- QA 4×: [13] catch mid-slide and [20] ×2 (the avatar after the slide): WP1's pager and commit task at 4× (requests 1–3);
  round 1 missed [12] and [20] ×2.
- Round 1's F2 (`f1-push`, the push's first moved frame ≤ 17 ms at 1×): a coin flip on both builds (review build: 2 of 3
  checks in each of two runs; this build: 1, 2, 3 and 2 of 3 in four runs; first moved frames 11–26 ms on both). At 4×
  it fails on both (WP1 / WP3, requests 27, 29). D6 at 4× (WP6, request 30).
- Run three times on both builds because a single run missed: `f1-orbs` F4 at 4× (longest frame while tapping: review build
  74–90 ms, this build 73–91 ms, budget 100; the battery's run had one 107.7 ms frame), `f1-close` F3 at 4× (translated
  frames: review build 2, 4, 2; this build 2, 7, 3), `t41-close` slots at 4× (the lazy quote line not in yet: review build
  11/11 then 10/11, this build 11/11 twice). The same spread on both builds.
- This round's two `f2-open` "whole" checks: WP1's Sheet and PushedLayer, WP3's MorningView (requests 27, 29, 32). WP2's
  part of both passes.

Gates: `tsc --noEmit` shared / api / web 0; shared 88, api 59, web 103 (102 + the skipped-eyebrow test);
`pnpm --filter @logbook/web build` ok (35 files precompressed).

### WP1's battery on this build (`S/wp2/wp1qa`, results `results/`; round 1's run kept in `results-fix1/`)

**1× 612/618, 4× 575/593** (round 1: 613/618, 586/593), run as round 1 ran it, on the Saturday at 13:30 (`SHIFT_MIN=auto
SHIFT_DAYS=-1`; the copy's lib takes `SHIFT_DAYS` now; a first try at Saturday evening put the Close card on Today's hero and
failed `t34`'s hero checks for that alone). 13 checks failed that had passed in round 1 and 4 passed that had failed. Every
script with a new miss was run again on the review build (`bf3c49e`, served on 8811) and on this build, side by side
(`S/wp2/fix2/wp1-control.log`):

| Script (rate) | Review build | This build |
|---|---|---|
| `r2-sheet` (1×), `t01-press` (4×) | 13/13, 6/6 | 13/13, 6/6 |
| `t14-hold` (1×), (4×) | 23/25, 25/25 | 23/25, 24/25 |
| `r1-sheet` (1×) | 9/10 | 10/10 |
| `r1-misc`, `r2-layer`, `r3-sheet`, `r4-sheet` (4×) | 2/3, 18/20, 27/28, 20/22 | 2/3, 18/20, 27/28, 20/22 |
| `t13-pager` (4×) | 33/37 | 35/37 |
| `r4-nav` (4×), three runs | 7/8, 8/8, 6/8 | 6/8, 7/8, 6/8 |
| `t02-cut` (4×), "old pages, 60 ms tap", seven runs each | 91–205 ms, median 112 | 92–176 ms, median 103 |

The same spread on both builds: these are WP1's gallery, pager and sheet timings at 4×, which this round's changes do not
touch (they run on `/dev/ui` or on stub roots, or move Today's pages the same way on both builds).

### Screenshots (looked at)

`S/wp2/qa/shots/fix2/{before,after}-{390,320}-{skip-0750,second-skipped,close-addto,orbs-two}.png` and
`{before,after}-next-row-{390,320}.png`: the skipped morning keeps `THIS MORNING` at 07:50; the second session reads
`Skipped` with no ring after its Skip; the composer back after `Add to it` sits above the Tomorrow group; the head reads
`2 of 5` with two orbs lit; the next-session row at 320 drops its time whole.

### Requests added this round

**WP1**
32. `ui/Sheet.tsx`: the sheet is in the DOM (and its scrim darkening) on the first frame after the release, but its edge sits
    at the closed position for two frames (motion's first sample, then the effect-started animation's first frame): the edge
    first moves 60–76 ms after the input at 1× (`f2-open`). Start the rise one sample in, in the open's own task.
33. `ui/NavBar.tsx` / `lib/keyboard.ts` `revealField` (feel review 2 #9): a scroll can rest inside the large title's 0–60 band
    (the title half cut). Snap to 0 or 60 on scroll end; `revealField` should target an offset outside the band.
34. `lib/haptics.ts` `hapticAtPeak`: `fireOnce()` unsubscribes inside the value's change notification, and motion's
    subscription list then skips the next listener for that notification. On a value with a listener after it, that listener
    misses the value the haptic fired on: HoldRing's check stayed at 0.46–0.98 opacity at rest (now avoided in HoldRing with a
    private value). The orb's pop and the to-do's mark lose one frame's write at the apex. Unsubscribe on the next microtask.

**WP3**
- MorningView's mount is still the other part of the push's task (request 27). The alarm sheet's body (WakeEditor) renders
  in the release's task with the sheet; at 4× the sheet is in the DOM 114–146 ms after the input (`f2-open`).

**Spec**
- Request 25 (the deck after Skip) also covers its words: the rest morning's first stop says `ALARM 7:15` while the This
  morning row says `Wake 7:15` (feel review 2 #11). One word for the morning's first stop, everywhere.

## Fix round 1 (2026-10-25): the three reviews' findings

Reviews: `S/wp2/review-code-1.md` (C1–C9), `S/wp2/review-feel-1.md` (F1–F14), `S/wp2/review-day-1.md` (D1–D10). The full
record (finding → what was done → the proof, with before and after numbers) is `S/wp2/fix-1.md`. Each finding has a check under
`S/wp2/qa/` (`f1-close`, `f1-second`, `f1-notfeeling`, `f1-landing-away`, `f1-hero`, `f1-push`, `f1-orbs`, `f1-misc`,
`f1-midnight`, `f1-static`, all in `run.mjs`). Each check failed on the review build (`504bb21`, kept at
`S/wp2/fix1/dist-before`) and passes on this one, at 1× and 4× except where noted below.

### What changed (all in WP2's files)

| Files | Findings | Change |
|---|---|---|
| `features/day/CloseDay.tsx`, `day.css` | C1, F3/D2, C5/D4, C7, D5, D6, F5, F11 | A refused Save rolls back: the field comes back with the words and the title goes back. After Save the box gives back the composer's height and what follows rises by one FLIP (`flipCard`, `data-layout-exception`, `springs.settle` on the frame clock). The entry is on Save's first frame. The word field calls `revealField`, and Return or Escape gives the focus back to its row. The alarm row opens its sheet on the release, in that task. The run row's floor is in minutes. The quote shows on two lines |
| `features/day/Hero.tsx`, `faces.ts`, `faces.test.ts` | F1, D7, F10, F5, C2, F7, F8, D1/D10 | `heroLead`: a run skipped beside another session keeps the hero. The Skipped face keeps the morning's eyebrow. Skip and Undo swap the face first (`markNow`: a mark override in its own render), and the write follows after that frame. `floorShort` for the hero's line. The second session's ring takes a boolean `done` and `haptic="toggle"`. The landed pace waits with the numbers. The face's `AnimatePresence` is keyed by the day |
| `features/day/HoldRing.tsx` | C2, C4, F7 | `done` turning false clears the ring's own latch. The frame loops of `fillRingAt` / `morphRingAt` stop when their run is cancelled, and the ring drops `data-done` on rollback. `haptic` prop (`success` by default, `toggle` through `hapticAtPeak` on the check's layer) |
| `features/day/useStravaLanding.ts` | C4 | Left during stages 1–3, the landing stops, puts the ring back and waits. It plays from stage 1 when next seen. The seen marks are set only when the FLIP settles |
| `features/day/useDeferred.ts` | D1 | `useDeferredMinutes` takes the live minutes when the shown day changes |
| `features/day/release.ts` (new), `MiniTimeline.tsx`, `MorningRow.tsx` | F2/D3, D5 | `useReleaseTap` and `swallowNextClick`, moved out of `Hero.tsx`: the stops line, the This morning row and the alarm row act on `pointerup` |
| `features/day/DayPage.tsx` | F4 | A page renders month writes in the background (`useDeferredValue`), except a new day |
| `features/habits/OrbRow.tsx` | F4 | A write waits until the row has been still for 700 ms. It is sent at once on unmount or when the app is hidden |
| `features/day/TheDayCard.tsx` | C5 | The composer calls `revealField` on focus |
| `features/day/WeekCard.tsx` | D8 | `weekNote` counts sessions left (not marked, not counted) instead of days |
| `features/day/WordSheet.tsx` | F14 | The explanatory line is deleted, and Save stands clear of the bottom edge |
| `features/sessions/actions.tsx`, `reshape.ts`, `SessionCard.tsx` | C3, C6 | "Not feeling 100%" is on today's matched run only, and `easeAfter` never touches a date before today. The sick skip and its easing are one action with one Undo. With nothing to ease, the pill says so in place |
| `features/sessions/PressButton.tsx` (new), `SessionCard.tsx`, `SessionEditor.tsx`, `sessions.css` | C9 | The session sheet's verbs and pills and the editor's chips use the one press (`usePress`). Their `:active` rules are deleted. WP4's chips keep a `:not(.pressable):active` fallback |
| `features/share/ShareSheet.tsx` | D9, C6 | The lead card is set (not scrolled to), ticks come only after a touch, and there is no `success` on share or save. Save says `Saved` on its own button |
| `features/todos/TodayTodos.tsx`, `TodoList.tsx`, `todos.css` | C8, F6, F13 | Pending dones are written on unmount. A past day with nothing on it says `Nothing done`. The To-dos sheet opens at medium |

### Rejected or not fully closed, and why

- **F12** (the Skip face's deck): the eyebrow now stays. The deck stays a four-stop line, showing the morning as it is now. It does
  not keep the skipped run's Door and Back, because `morningOf` drops a skipped session, so This morning (where the line
  pushes, its shared element) shows the morning without the run. A line that kept them would contradict the page it opens.
  Spec request 25 below.
- **F9** (the scroll that starts on the hero flinches): WP1's synchronous press (M33). Request 26.
- **F2 at 4×**: the push now starts on the release. Median first moved frame: 1× 33–35 → 13–18 ms; 4× 219–270 → 74–125 ms.
  What is left is the push's own task: DayPager's ResizeObserver `measure` and PushedLayer's `width()` force the new
  layer's layout (≈ 60 % of it, `S/wp2/qa/dbg/prof-push.mjs`), and MorningView mounts. At 1× the first frame after the
  release still shows `.pushed` at its rest, because motion samples its start value on the first frame. Requests 27 and 29.
- **F4**: Today's own share of the write's long task is now ≈ 2.5 % (11 ms of 422 sampled at 4×), and the orb row writes
  only once the finger rests. While three orbs are tapped 440 ms apart, the longest frame at 4× is 209 → 52 ms. The long
  frame that remains comes after the row rests (4× ≈ 140 ms). It is the other mounted tabs re-rendering on the month: Progress
  `buildModel` 41 ms, Plan `SessionLine` / `BlockCard`, and motion's layout projection. Request 28.
- **D6 at 4×**: Save's `success` comes from WP6's `Composer` inside its `save()`, about 95 ms before the entry's first
  frame at 4× (1× within a frame). Requests 30 and 17.
- **D10**: the fade from opacity 0 is WP1's DayPager `crossfade`. The content part is fixed (D1). Request 31.

### Battery (`node S/wp2/qa/run.mjs`: the QA battery plus the fix checks): 1× 237/238, 4× 218/224

The QA battery's own 183 checks: **1× 183/183, 4× 171/174** (the QA step's final run: 183/183, 168/174). The misses at 4×:

| Check | This run | Before (QA final) | Owner |
|---|---|---|---|
| [12] flick trajectory ≤ 3 px at 4× | 3.29 px (5.73 in the first run) | 4.25 px | WP1's pager spring at 4× (request 3) |
| [20] the avatar after the pill's / lit tab's slide at 4× | 156 / 172 ms after rest | 189 / 119 | The commit task at 4× (requests 1–2). Measured 3 × 2 times on both builds this round: before 119–223 ms (median ≈ 150), after 121–172 ms (median ≈ 163). The same spread, not a regression |

Restated this round, each marked `[restated in fix round 1]` in its script:
- `t41-close` §5: "nothing below the box moves" now covers the 150 ms crossfade. After it, what follows rises by exactly the
  box's change on the FLIP (spec §5 "only the entries list grows, via FLIP on what follows"; the old wording was spec
  request 23, now withdrawn).
- `t63-session` §6.3: with nothing to ease, the pill answers in place and no toast appears (C6).
- `t13-hero` #13: "two faces" counts faces on screen (opacity > 0). A leaving face at 0 that motion removes a long frame
  later is not part of the crossfade.

The fix checks fail at 4× only for F2 (above) and D6 (above). At 1× they fail only for F2's This morning row, in one of the
two full runs (17.3 / 20.4 ms against 17, the second frame; see F2).

Gates: `tsc --noEmit` shared / api / web 0; shared 88, api 59, web 102 (99 + 3 new: Skip on two sessions, the floor words,
the week card's count); `pnpm --filter @logbook/web build` ok.

### WP1's battery on this build (`S/wp2/wp1qa`, results `results/`, the QA step's run kept in `results-qa/`)

**1× 613/618, 4× 586/593** (the QA step: 612/617, 584/592; WP1's own final: 614/617, 586/593). Every miss also failed in the
QA step's run, except three. Each of those three was rerun, and run on the review build as a control:
- `r3-sheet` u3-5 at 1× (the gallery's sheet over a sheet): passed on 2 of 2 reruns.
- `r4-sheet` k4-1 at 4× (the sheet's travel step): flaky on both builds. The review build failed 2 of 3 runs (69, 64 / 65 px);
  this build failed 2 of 3 (90, 75 px), against a bound of 60–62.
- `t13-pager` 15c at 4×: the battery crossed midnight in New York, so "today" became Sunday Oct 25. On a Sunday the strip's
  next cell is the next week, and the review build fails the same checks (11, 12, 15c, 19 at 4×; 11 and 19 at 1×). This is
  a date dependence in WP1's lab script, not this round.

### Requests added this round (they extend the consolidated list below)

**WP1**
26. `ui/usePress.ts` (F9, spec M33): a vertical flick that starts on a card scales it to 0.98 for 2–4 frames before
    `pointercancel`. Start the 0.97 after 60–80 ms unmoved, or at once on an early `pointerup` (UIKit's
    `delaysContentTouches`).
27. `ui/DayPager.tsx` ResizeObserver `measure` (`clientWidth` plus a `--chrome-h` write) and `ui/PushedLayer.tsx` `width()`
    both force the new layer's layout inside the push's task (≈ 60 % of the 4× push, `S/wp2/qa/dbg/prof-push.mjs`). Cache
    the widths. PushedLayer's slide also shows its start value on its first frame (motion's first sample; request 10).
28. Mounted tabs: a month write re-renders Plan and Progress synchronously (Progress `buildModel` 41 ms, Plan `SessionLine`
    and `BlockCard`, and motion's layout projection), which is the whole of the orb write's long task at 4×. A mounted
    inactive tab could take the month deferred, or not at all (WP1's shell, or each root, as Today now does).
29. `ui/ContextMenu.tsx` runs `onSelect` in a `requestAnimationFrame` after the click, which costs a frame before any menu
    action shows (the Skip face: 1× ≈ 36 ms, 4× 80–200 ms).
31. `ui/DayPager.tsx` `goTo(…, { mode: 'crossfade' })` fades the cur page in from opacity 0 with nothing under it: three
    frames of black under the bar at midnight (D10). Keep the old page under the new one for the 150 ms.

**WP3**
- MorningView's mount is the other part of the push's task at 4× (request 27).

**WP4**
- `features/sessions/MoveSheet.tsx` and `features/plan/{Blocks,Week}.tsx` render `.pl-chip` as plain buttons. WP2 deleted
  `:active` for its own (C9) and keeps `.pl-chip:not(.pressable):active` for these until they use the one press
  (`features/sessions/PressButton.tsx`, or `usePress`).

**WP6**
30. `Composer` fires `haptics.success()` inside `save()`, before the Close card can show the entry (D6: at 4×, about 95 ms
    before the visual). Add an option (`haptic: false`, or an `onSaved` that fires it) so the Close card fires it on the
    entry's first frame.

**Spec**
25. §3.2 Skip "deck unchanged": the shared `morningOf` drops a skipped session, so the deck shows the morning as it now is.
    Keeping the skipped run's stops would contradict This morning.
- Request 23 (the box keeps the composer's height) is withdrawn. The box takes the entry's height, and what follows moves by
  FLIP (F3).

### Screenshots (looked at)

`S/wp2/qa/shots/fix1/{before,after}-{390,320}-{sat-0630,sat-skipped,sat-1230,past-todos,close,close-saved,close-word-kb}.png`.

## QA: the package's acceptance (2026-10-24)

### Verdict

Today is built and its battery passes at 1× (183/183). At 4× the final run passed 168/174; the six misses are timing at 4× in WP1's primitives or harness, each measured and attributed below, and four of them pass on a rerun. The QA step found and fixed five things in WP2's own code (a neighbour that mounted whole inside every commit, the trailing swap a frame late, the hero's sheet a frame late, a cut label in the Close card's word field, words cut at 320). WP1's battery on this build: 1× 612/617, 4× 584/592 (WP1's own final: 614/617, 586/593); every remaining failure fails on the seams base too, in WP1's own final run, or in a path WP2 does not run. Nothing WP2 touched broke a WP1 check that still targets a real surface; six checks written against the interim Today were restated against the real page and pass.

### Files changed and why (`git diff --stat feel/pages-base..HEAD`: 43 files, all in WP2's ownership)

| Files | Why |
|---|---|
| `features/day/DayView.tsx` | The Today tab root on WP1's `NavBar` + `DateStrip` + `DayPager` (§2, §3): date as page state mirrored by `nav.replace`, `useRootRequest`, `useHomeControl`, the title tap/hold menu, the midnight hold (`TodayHold`), the trailing slot's avatar ⇄ Today pill swap (`TrailSwap`, QA step), the hidden `Check for new runs` (pull to refresh's keyboard path). |
| `features/day/DayPage.tsx` | One day's page: the invariant section order, the bottom padding inside the cur page, one memoised `useLog` per page, a neighbour mounts as its shell and fills in (QA step: the shell now really mounts first). |
| `features/day/Hero.tsx`, `faces.ts`, `faces.test.ts`, `HoldRing.tsx`, `MiniTimeline.tsx`, `RunLanding.tsx`, `useStravaLanding.ts`, `live.ts` | The 184 hero (304 landed), its faces, the hold ring that becomes the check in one node, the four-stop line (shared element), the run landing's stage clock and FLIP, the coach sentence, the live-page store; the hero opens its session sheet on the touch's release (QA step). |
| `features/day/CloseDay.tsx` | The Close card (§5): fixed slots, Save in place with one `success`, the Tomorrow group always (word row as a field in the same 44 box, alarm row → WP3's `WakeEditor`), Share the day, the read. QA step: the word field fits beside its label. |
| `features/day/useDeferred.ts`, `lib/useToday.ts` | Clock-driven face changes and the midnight rollover wait for the owner (§5.3, §5.4). |
| `features/day/MorningRow.tsx`, `WeekCard.tsx`, `TheDayCard.tsx`, `PlanEnd.tsx`, `FirstRunHero.tsx`, `WordSheet.tsx`, `Calendar.tsx`, `nudge.ts`, `dayWords.ts`, `useNow.ts`, `useStravaPull.ts`, `day.css` | The other sections (§3.1 rows 2, 6, 7, 9), the first-run face, the word editor, the calendar for WP4, the nudge; QA step: the morning row and the week card no longer cut words at 320. |
| `features/day/FocusStrip.tsx`, `useHoldMenu.tsx`, `SetupCard.tsx` | Deleted (§13.1). |
| `features/habits/OrbRow.tsx`, `HabitSheet.tsx`, `habits.css` | The orb row (§3.1 row 4): 56 px orbs, the fill on the release, `orb` at the pop's peak, hold menu, reorder after the hold, ghost orbs; no deprecated `layoutId` (QA step). |
| `features/todos/TodayTodos.tsx`, `TodoMark.tsx`, `flip.ts`, `TodoList.tsx`, `TodoSheet.tsx`, `todos.css` | The to-dos (§3.1 row 5, M9): inset group of three, the check on the release, `toggle` at the peak, the fold by FLIP, quick add, no `SwipeRow` on Today; the sheet on SwipeRow v2. |
| `features/sessions/SessionCard.tsx`, `actions.tsx`, `SessionEditor.tsx` | The session sheet after a matched run (§6.3), quiet session actions, the dead drag rows deleted; no deprecated `layoutId` (QA step). |
| `features/log/useLog.ts` | Memoised return (critic C12). |
| `api/queries.ts` (WP2 block only) | `fetchCoachRead` (the existing `POST /coach/read`, answer written into the month cache). |
| `docs/reviews/wp2.md` | This file. |

### What the QA step changed (commits `6d5dcae` and the step's last)

- **Neighbours really mount as shells** (`DayPage.tsx`). `useDeferredValue(true, !p.live)` gave every *new neighbour* the
  initial value `true`, so it mounted whole inside the commit's synchronous frame (the comment said the opposite). Now
  `useDeferredValue(true, p.live)`. The pill home from +5 at 4×: the commit task 160–215 ms → 76–122 ms.
- **The trailing swap starts on the commit frame** (`DayView.tsx` `TrailSwap`, `day.css`). Through NavBar's keyed
  `AnimatePresence` the 120 ms fade started a frame after the commit's render (motion schedules it on the next frame). The
  avatar and the pill now both stay mounted under one stable key and crossfade by a CSS transition that starts with the
  commit's own style change. [20] 1×: avatar back 100 → 50–67 ms after rest.
- **The hero opens its session sheet on the touch's release** (`Hero.tsx`, `live.ts` `isPagerMoving`), as spec M7 says ("the
  body renders on pointerup"). A touch that came up before the hold, within the slop, off the ring and the stops line, and
  that did not land on a moving page, opens there; its click is swallowed at the window (else it lands on the new scrim and
  closes the sheet). Mouse, Enter, Space and VoiceOver still open from the click. Sheet first frame after `touchend`: 1×
  25.6 → 5–7 ms, 4× 110 → 25–47 ms. Guarded by new checks (a vertical scroll from the hero, a hold, a tap, Enter).
- **The word field fits beside its label** (`CloseDay.tsx`, `day.css`): at 390 the label read `A word for tomo…` while
  editing (the field was 144 px; 12 capitals need 124). Now the label is whole at 390 and reads `Word` below 360.
- **Narrow screens never cut a word** (`MorningRow.tsx`, `WeekCard.tsx`, `day.css`): at 320 the morning row read
  `Wake 7:15 …` / `Alar…` / `m 7:15`, the week card broke `0 of 4` / `runs`. Now a second time drops whole, a future day's
  title drops `morning` below 360 (`Tomorrow · Alarm 7:15`), and the week line breaks only at its dot.
- Sheet openers in sessions and habits no longer pass the deprecated `SheetSpec.layoutId` ("Delete at integration").

### Battery (build plan §3.4, spec §14 10–21 on the real page, 37–46, 54): 1× 183/183, 4× 168/174 (final run; four of the six 4× misses pass on the rerun)

`node S/wp2/qa/run.mjs` (scripts `t10-pager`, `t13-hero`, `t14-orbs`, `t15-morning`, `t16-week`, `t18-copy`, `t20-home`,
`t21-reduced`, `t37-sections`, `t41-word`, `t41-close`, `t42-midnight`, `t43-phase`, `t44-todos`, `t45-landing`,
`t46-ring`, `t54-first`, `t63-session`, `t90-audit`); results `S/wp2/qa/results/` (this run also copied to
`S/wp2/qa/results-qa-final2/`).

| §3.4 [§14] | checks | 1× pass | 4× pass |
|---|---|---|---|
| #1 [37] | 15 | 15/15 | 15/15 |
| #2 [38] | 10 | 10/10 | 10/10 |
| #3 [40] | 1 | 1/1 | 1/1 |
| #4 [41] | 6 | 6/6 | 6/6 |
| [39] | 4 | 4/4 | 4/4 |
| #9 [46] | 4 | 4/4 | 4/4 |
| #10 [10, 11, 19] | 10 | 10/10 | 10/10 |
| [12] real page | 1 | 1/1 | 0/1 |
| [13] real page | 1 | 1/1 | 0/1 |
| [14] real page | 1 | 1/1 | 1/1 |
| [15] real page | 1 | 1/1 | 1/1 |
| [15a] real page | 1 | 1/1 | 1/1 |
| [15c] real page | 2 | 2/2 | 1/2 |
| [15b] real page | 2 | 2/2 | 2/2 |
| #11 [16, 17, 18] | 5 | 5/5 | 5/5 |
| #12 [20] | 4 | 4/4 | 3/4 |
| #13 | 5 | 5/5 | 5/5 |
| [34] | 1 | 1/1 | 1/1 |
| [33] O4 | 1 | 1/1 | 1/1 |
| #15 O3 | 7 | 7/7 | 7/7 |
| #16 | 3 | 3/3 | 3/3 |
| #20 | 3 | 3/3 | 3/3 |
| #17 [54] | 5 | 5/5 | 5/5 |
| #18 | 9 | 9/9 | static |
| #14 [32] orbs | 8 | 8/8 | 7/8 |
| [31] orb press | 1 | 1/1 | 0/1 |
| §3.3 ghost orbs | 1 | 1/1 | 1/1 |
| #7 [44] to-dos | 5 | 5/5 | 5/5 |
| #7 quick add | 4 | 4/4 | 4/4 |
| #5 [42] midnight | 5 | 5/5 | 5/5 |
| #6 [43] phase | 5 | 5/5 | 5/5 |
| #4 [41] Close card | 4 | 4/4 | 4/4 |
| §5 Close card | 7 | 7/7 | 7/7 |
| #8 [45] landing | 15 | 15/15 | 15/15 |
| #19 coach read | 4 | 4/4 | 4/4 |
| [53] +8 s repeat | 1 | 1/1 | 1/1 |
| §6.3 session sheet | 6 | 6/6 | 6/6 |
| [21] reduced motion, real page | 8 | 8/8 | 8/8 |
| audit F6 | 1 | 1/1 | 1/1 |
| audit F13 | 1 | 1/1 | 1/1 |
| audit 5 | 2 | 2/2 | 2/2 |
| audit C7 | 1 | 1/1 | 1/1 |
| audit O5 | 2 | 2/2 | 2/2 |
| **all** | 183 | 183 | 168/174 |

Key numbers (1× / 4×):

| §3.4 [§14] | check | 1× | 4× |
|---|---|---|---|
| #10 [10] | a 270 px swipe from the hero on a two-session day: commits by replaceState, finger lag median / max | 0 / 0 px | 0 / 0 px |
| #10 [11] | at x = −195: disc at cellX + 27.86, `Today` / `Tomorrow` opacity | 306.43 (exp. 306.43), 0.5 / 0.5 | same |
| [12] | flick 1667 px/s: max error against `pageFlick` in the 100 ms after release; rest | 0.67 px; 415 ms | 4.25 px (fail; 2.4 in the QA step's first run); 411 ms |
| #11 [16] | React renders while the track springs | 0 (23 frames) | 0 (16 frames) |
| #12 [20] | the pill / the lit tab from +5: one slide of 390; avatar ≥ 0.9 after rest | 67 / 77 ms | 189 (fail) / 119 ms |
| #12 [20] | the calendar 12 days away: track frames moved; cur slot fade | 0; 150 ms | 0; 150 ms |
| #2 [38] | the landed face (Sep 8); hero top web / safe-top 59 | 304; 157 / 216 | same |
| #3 [40] | cold open, months cache cleared: titles seen; skeleton | `Today` only (197 frames); inside the hero | `Today` only (122 frames); inside |
| #4 [41] | the word from the title menu (from Save's pointerdown) / from the Close card's row (from Return): caps line | 9 / 6 ms | 47 / 41 ms |
| §5 | Close card Save: the entry's 150 ms fade starts after the tap | 115 ms | 293 ms |
| #5 [42] | 00:01 with a draft: held on Friday; Save + 01:01 idle → Saturday by one 150 ms fade | pass | pass |
| #6 [43] | 18:00:30 tap on an orb: the Close card after the release; the orb lit | 35 ms; yes | 139 ms; yes |
| #7 [44] | to-do: `toggle` frame = max-scale frame (scale); row still 600 ms; gone; rows up | 3 = 3 (1.12); yes; 728 ms; 44 px, 15 frames, 0 height keyframes | 1 = 1 (1.117); yes; 791 ms; 44 px, 12 frames, 0 |
| #14 [32] | orb: `orb` frame = max-scale frame; 470 ms menu in the DOM at | 3 = 3 (1.119); 458 ms | 1 = 1 (1.104); 523 ms (fail; 500 budget, passes on rerun) |
| #8 [45] | `Checking Strava…` after `visibilitychange`; shown for | 16 ms; 1500 ms | 49 ms; 1883 ms |
| #8 [45] | stage 1 (dashoffset 0) / stage 2 (check at 1, one node) / FLIP complete (304.1) / `success` Δ / route drawn | +317 / +517 / +904 / 0 ms / +1096 | +317 / +533 / +906 / −0.5 ms / +1127 |
| [53] | `changed: 0` after the back time: the quiet repeat | +8.000 s | +7.995 s |
| #9 [46] | ring held: marks / same node / `success` / menus / sheets / `0 mi` frames | 1 / yes / 1 / 0 / 0 / 0 | same |
| §6.3 [27] | hero tap → the session sheet's first moved frame after `touchend` (WP1's judge) | 7.7 ms (click at +6.9) | 33.1 ms (click at +28.8) |
| #17 [54] | `Open Today` → Today's hero: first frame rect, movement to rest, black frames | (16, 157, 358 × 184), 0 px, 0 of 27 | same, 0 px, 0 of 24 |
| [21] | reduced: drag lag; release: x set once, one 150 ms opacity on the cur slot, track animations > 1 ms | 0 px; yes; 0 | 0 px; yes; 0 |

### The checks that are not as first written (restated, with why)

- **[21] reduced motion** (new, `t21-reduced`): "no transform animation on the track" is measured as *none longer than 1 ms
  and x set once*. `styles/base.css`'s global reduced-motion rule (`* { transition-duration: 0.01ms !important }`, WP5/WP1)
  turns the pager's one write to the track's `transform` into a 0.01 ms `CSSTransition` that ends before any frame; WP1's own
  t21 measures the same way. A frame or two can still show the track at the drag's offset while the cur page fades (WP1's
  pager holds it for the fade, as on its lab); reported, not failed.
- **[54]** (`t54-first`): Today's half of the hand-off is measured on the seams base's Welcome (WP6 replaces it): a fresh
  account answers the four questions, `Open Today` → Today's hero is at its rest rect (16, 157, 358 × 184) on its first frame,
  moves 0 px, zero black frames over the screencast. The payoff's own hero is at (16, 40, 358 × 118) on this base: matching
  it to Today's rect is WP6's Welcome (request below).
- **§6.3 / [27]'s hero half** (`t63-session`): the sheet's first frame is now judged exactly as WP1's `t12-sheet` judges it
  (touchend from a capture listener, frames stamped at the rAF callback's entry). The old script took `touchend`'s time
  before dispatching it and read the rAF timestamp, which made 4× look better than it was (it said 34 ms; WP1's judge said
  110 ms).
- **#4 [41] word save** (`t41-word`): timed from the Save button's own `pointerdown`. Playwright's `click()` waits frames for
  actionability before it dispatches, and the old timer started before the call (4×: 178 ms of which ≥ 60 ms was that wait).
- **#1 [37]** (step 1, unchanged): "≥ 60 % of the viewport non-black" is measured as rows holding content (cards `#111` on
  `#000` read 45–50 % as a pixel share on every page; spec request below).
- **audit F6** (`t90-audit`): the rhythm is measured with the one-time nudge dismissed (it is a 44 box, its hit area, between
  the hero and the row: 44 instead of 12 on the first open only).

### Still failing at 4× (measured, not hidden)

Final run's six 4× misses, each with its other samples on this machine (the QA step ran the whole battery three times, and the
three scripts once more after the final run: four runs of each at 4×):

| Check | 4× in the final run | Other 4× runs | Owner and cause |
|---|---|---|---|
| #12 [20] the avatar after the pill's / lit tab's slide (≤ 150 ms) | 189 ms (pill); the lit tab passed at 119 | 130, 194, 185, 154–204 over 10 repeats (2 pass) | the commit task at 4×: 76–122 ms after the QA fixes (160–215 before). What is left in it is WP1's: DateStrip's forced layout (20–24 % of the task) and the pager's whole-page attribute flips and unmounts (requests 1–2). 1×: 67 / 77 ms |
| [15c] three left + one right | 3 of 4 commits | passed in 2 of 4 runs (the rerun passed) | WP1's velocity (F8): a flick at 4× reads v = 0 (request 3); also fails on WP1's lab |
| [13] catch mid-slide: the page's edge ± 1 across `touchstart` | 15 px | passed in 2 of 4 runs | the recorder: at 4× the posted sample lands a frame before the touch is handled, so the slide's own next frame (15 px at that speed) shows as the "jump"; `movedX` is exactly 120 and the commits pair (WP1's QA gotcha). 1×: 0 px |
| [12] flick trajectory ≤ 3 px | 4.25 px | passed in 3 of 4 runs (2.37–2.4 px) | DayPager's spring at 4×: errors of ±3.5 px with no offset (profiled), WP1's own t13 #12 fails at 4× too |
| [31] orb press-in ≤ 17 ms / cleared ≤ 1 frame | 17.3 / 34.8 ms | passes in the other runs and the rerun (16.6 / 24.2) | WP1's `usePress` at 4×, at the boundary |
| #14 [32] orb menu in the DOM by 500 ms | 523 ms | 489–514 earlier; 10/10 on the rerun | WP1's hold clock at 4× (450 + one 4× frame), at the boundary |

### WP1's battery on this build

`S/wp1/qa` copied to `S/wp2/wp1qa/` (`DIR` and `BASE` pointed at this build on 8810, `SHIFT_MIN=auto`; WP1's own results are
untouched). Final table: `S/wp2/wp1qa/results/TABLE.md` (the first full run is `run-wp2build.log`, the reruns
`rerun-wp2.log`).

- **1× 612/617, 4× 584/592** (excluding WP1's `2·interim` rows, the old pages: 13/14 and 12/14). WP1's own final run
  (`S/wp1/qa/results-r4-final`): 1× 614/617, 4× 586/593.
- **Restated against the real page** (each marked `[restated on WP2's Today]` in the script): the interim `.today-hero`
  selector → `.dp-page[data-role=cur] .hero` in 9 scripts; `r1-press` u8 (the interim hero's CSS order) → the live hero keeps
  its 184 / min-height 0 / face padding 16 over the `.pressable` reset; `smoke`'s This-morning link scoped to the cur page
  (WP1's own note: neighbours are always mounted); `t23-bridge`'s next-day control → the day pager's hidden `Next day`
  button (the `.nb-acc` DayStepper adapter is gone); `r2-layer` n1-rest → a tap on Settings' first row (the interim header put
  the avatar over that row; the real avatar sits in the 44 bar, over Settings' own avatar); `r3-layer` r5 control → "taken"
  is a click that reached Today *or the sheet the hero opened* (the hero answers on the release and swallows the click).
  All pass at both rates.
- **Every remaining failure is not this package's** (control: the same scripts on the seams base build, served from
  `S/wp2/dist-before-qa` on this machine today, `S/wp2/wp1qa/results-control/`):
  - `t12` 12a (the gallery sheet, 1× 30–37 ms, 4× 140–157): fails on the seams base too (37.3 / 127.0) and in WP1's final
    run at 4×.
  - `r1-sheet` f5 (a Plan row's session sheet, 1× 19–24 ms, 4× 115–185): fails on the seams base (23.4 / 114.2) and in WP1's
    final at 4×. The body is WP2's session card; the row and its click are WP4's interim Plan (request: WP4 opens on the
    release too, as the hero now does).
  - `t14` 14c (the gallery's hold menu at 460.2 ms vs 460 at 1×, 501.7–507.2 vs 500 at 4×), 14a (one 13.3 ms frame at 1×):
    gallery, at the boundary; 14c 4× fails on the seams base too (516.5).
  - `t02` [stub roots] 4× (50.0–73.6 ms over 4 runs vs 50): `?stubs=1` replaces all four roots with WP1's stubs, so no WP2
    code runs; WP1's final measured 45.6.
  - `t13` 15c 4×, `r1-push` c5 4×, `r2-sheet` u1 4×, `t20b` 20b 4×: the lab/gallery at 4× (F8 velocity, frame pacing); c5
    and u1 also fail in WP1's final run.
  - `r2-layer` c2-1 4×, `r3-sheet` u3-5 4×, `r4-sheet` k4-1 4×: failed in the first run, pass on rerun (c2-1 5/6 over three
    repeats; WP1 notes the 4× catch windows are noise).

### Gates (worktree, this step)

`pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` exit 0;
`pnpm --filter @logbook/shared test` 88 passed; `@logbook/api test` 59 passed; `@logbook/web test` 99 passed;
`pnpm --filter @logbook/web build` ok, entry chunk 925.0 kB raw (step 3: 923.1). `t18-copy`: no react-router import in
`features/day`, `habits`, `todos` (and none in `sessions`, `share`, `log/useLog.ts`, `lib/useToday.ts`, `api/snapshot.ts`:
grep); no deprecated names from WP1's "Delete at integration" list in WP2's files (grep: `TabHeader`, `DatePager`,
`DayStepper`, `useLongPress`, `TAB_RESELECT`, `rowPresence`, `DROP_SPRING`, `liftFx`, `pressScale`, `onLongPress`, `DayStrip`,
`layoutId`, `whileTap`, `springs.press`).

### Hand-verifiable steps (phone or a 390 × 844 touch emulation; expected results)

1. Open the app on Today. The bar's caps line reads the word and the date (`PATIENT · SAT, OCT 24`, or the date alone), the title `Today`, the
   strip Mon–Sun with today's disc filled. The hero is a 184 card; under it the This morning row, Habits, To-dos, the Week card.
   Nothing above the bar.
2. Swipe left anywhere below the bar (the hero, the Habits head, a to-do, the week card, the strip). The whole page follows the
   finger; the disc slides one cell; `Today` crossfades to `Tomorrow` with the drag. Release: tomorrow; the trailing slot
   crossfades avatar → `Today` pill (120 ms); the URL is `/today/<tomorrow>` and Back does not walk through days.
3. Swipe left on the orb row instead: the orbs scroll; the day does not change.
4. Swipe left three more times fast, the next starting while the last still slides: the slide stops under the finger and
   pages on; the title reads the right day at every rest.
5. Tap the `Today` pill (or the lit Today tab): one slide home of exactly one page width; the avatar is back as the slide
   rests.
6. Hold the title 450 ms: `Change the word · Clear the word · Go to a day…`. `Go to a day…` → a date 12 days away: the page
   crossfades (no slide).
7. Tap the hero: the session sheet rises as the finger lifts. Close it. Hold the hero 450 ms: the card lifts, `Done · Skip ·
   Move · Share`, one `lift` tick. `Skip`: the face crossfades to *Skipped.*, the card stays 184, a toast with Undo, no haptic.
   Undo restores it.
8. Hold the hero's ring (open face) 400 ms: it fills, becomes the check in the same circle, one `success`; the card does not
   lift, no menu. Release at 200 ms instead: the fill springs back, nothing is sent. Scroll starting on the ring: the page
   scrolls.
9. Tap the four-stop line or the This morning row: This morning slides in over Today; the line flies to the Now card. The
   chevron (or an edge swipe) brings Today back where it was.
10. Tap an unlit orb: it fills on the lift, pops once, one `orb` tick at the pop's top. Hold an orb 470 ms: `Note · Details ·
    Archive`; move after the hold: the orb follows, others make room, a `select` per slot, `drop` on release.
11. Tap a to-do's mark: it fills on the lift, one `toggle` at the pop; the row stays 600 ms, then folds and the rows below
    slide up. With a finger still on the list, the fold waits. `+N more ›` opens the To-dos sheet (its rows swipe). `+ Add a
    to-do` becomes the field in the same row; Return inserts the row with its text and keeps the field.
12. Look at yesterday, tomorrow and +5: every page has the same sections (future: ghost orbs `5 habits`; past: `The day`
    card); a missed day says *Missed.* in grey, never red.
13. After 18:00 (or `?at=20:30` on a test build): the hero becomes the Close card (on the next touch, or after a minute idle,
    with a 150 ms crossfade). Type two sentences, Save: the text settles into the same box, the title reads *Day, closed.*,
    one `success`, nothing below moves. Tap `A word for tomorrow`: the field opens in the row beside the whole label; type
    `Patient`, Return: the bar reads `PATIENT · SAT, OCT 24` at once, no toast. `Alarm 7:15 · change` opens the alarm for
    tomorrow (`Just tomorrow`). Tap the run row's words: the session sheet.
14. With text in the composer at 23:58, wait past midnight: nothing changes (title `Today`, Friday's date) until you Save and
    leave it a minute; then the page crossfades to the new day.
15. When a run lands from Strava with the app open on Today: `Checking Strava…`, the ring fills, becomes the check, the card
    grows to 304 with everything below riding along, one `success`, the route draws, the numbers tick from the planned miles,
    the coach's sentence fades in. With Journal open when it lands, nothing plays until you come back to Today.
16. Settings › Reduce motion on: swipes still track the finger; a release, the pill and the strip are a 150 ms fade, no slide.
17. At 320 wide: nothing runs off the edge; the morning row shows one time (`Wake 7:15`, or `Tomorrow · Alarm 7:15`); the week
    card breaks only at its dot; the Close card's word field reads `Word`.

### Audit findings this package was to close

Sources: `S/audit/{critic,nav,touch,motion,visual,flows}.md`, the Today rows of critic §4's top ten, spec §0.3's merge
decisions for Today (M1, M9, M13–M15, M17, M18, M22, M31, M32, M34), WP1's review (its O-list and its requests to WP2).

| Finding | Status | Proof (script, both rates unless noted) |
|---|---|---|
| critic C2, touch F1/F2, nav F2, motion #4/#5: only the hero pages; velocity dropped; neighbours render late | Fixed | `t10` [10]–[19] on the real page: a 270 px swipe from the hero, Habits head, a to-do, the week card, the strip commits by `replaceState`, lag 0; catch, flick-back, clamp, fast paging; prev/next mounted (`inert`, text > 20) |
| nav F13, touch F12, motion #5: a two-session day disables the swipe (WP1 O1) | Fixed | `t10` [10] on Sat Oct 24 (Threshold 6 + Strength) |
| nav F3, visual F2, flows 7.4, touch F16, motion #13: six ways to change the day, arrows, an untracked date-line swipe | Fixed | one pager under the bar, the strip, home by the title / pill / lit tab (`t10`, `t20`); the arrows and `DayStepper` are gone (`t18`) |
| nav F4, visual F1, flows 7.2: the date line truncates off today | Fixed | `t41-word` [39]: `RELENTLESSLY · MON, NOV 2` fits at 390 and 320 |
| nav F5, touch F17, flows 7.3: each day step pushes history | Fixed | `t10` [19]: ten steps add 0 entries |
| nav F11, touch F11, motion #10: pulling the hero changes tab | Fixed | `usePullToMorning` deleted (`t18`); the stops line pushes This morning inside Today (`t15`) |
| nav F16, visual F4, flows 2.5: the word strip above the app (WP1 O2) | Fixed | `FocusStrip` deleted (`t18`); the word in the caps line, still there collapsed (`t41-word` 41) |
| visual F3, critic C6: the title repeats / flips to the session word | Fixed | `t37` [40]: `Today` on every frame of a cold open; titles from the route |
| visual F5, F6, F10, critic top ten #10: the page empties, uneven rhythm, cramped top | Fixed | `t37` [37]: every section on every day, bottom gap 0–25; `t90` F6: gaps 12 · 24 · 24 · 24; `t37` [38]: hero top 157 (216 with the safe top). The "≥ 60 % non-black pixels" wording: Rejected as written (spec request), measured as content rows (63–66 %) |
| visual F12, flows 5.3: clever copy, `Add the first one` | Fixed | `t18` copy grep (6 strings) |
| visual F13, critic C7: the corner week ring reads as a spinner and greets the day in red | Fixed | `HeroWeekRing` deleted (`t18`); `t90` C7: Oct 11 (missed) carries no red in the hero or the week ring |
| visual F14: the `HOLD` caption | Fixed | `t18` |
| visual F15, flows 4.2: the to-dos section's three languages; quick add does not look like a field | Fixed | the inset group, `+ Add a to-do` → the field in the same 44 row (`t44` §0.2 8:45 #4–5) |
| visual F22 (WP1 O4): an 8-item hero menu | Fixed | `t13`: exactly `Done · Skip · Move · Share`; title 3 items, orb 3, to-do 4 |
| touch F7, motion #9, flows 4.1: four hold clocks; a slow orb tap opens a menu | Fixed | `t14` [32]: 380 ms lights the orb, 470 ms opens its menu (the one 450 clock) |
| touch F8, motion #8 / #12, flows 4.3, critic top ten #9: two swipe-row systems on Today; the tick is a chain of timers | Fixed | `t44`: no `.swipe-row` on Today (the sheet's rows are SwipeRow v2); the check fills on the release, `toggle` at the peak, fold after 600 ms by FLIP |
| touch F10, M18, M34: haptics on navigation, not completion | Fixed | `t21`: 0 haptics over day steps; `t10` [19]: `select` only from the strip; `t13` Skip 0; `t14` / `t44` `orb` / `toggle` on the pop's peak frame; `t63` session actions quiet |
| touch F13: the hold ring is a 64 px scroll dead zone | Fixed | `t90` F13: a drag starting on the 48 px ring scrolls the page 117 px and marks nothing |
| motion #11, flows 3.2, M13: faces cut and the card reflows | Fixed | `t13` Skip: a 150 ms crossfade at 184; `t43`: the Close card by a 150 ms crossfade; `t45`: the landed face by one FLIP |
| motion #16, critic C3, M14, M15: things move on their own; midnight replaces the page under the typing | Fixed | `t43` (the phase change waits for a touch or an idle minute), `t42` (the draft holds the day past midnight) |
| flows 2.1 (WP1 O3): the morning lands on another tab | Fixed | `t15`: the stops line and the row push `/today/<date>/morning` with the shared line |
| flows 2.4: Skip lives under an unadvertised long press | Fixed | the hero's tap opens the sheet whose second row is `Skip · Move · Edit` (`t63`); the hold menu has it too |
| flows 3.1: the landing is passive | Fixed | `t45`: `Checking Strava…` ≤ 150 ms after `visibilitychange`, the sync requested ≤ 100 ms |
| flows 3.3: the coach's read is two taps and a wait | Fixed | `t45` #19: one `POST /coach/read` after stage 4, the sentence on the face |
| flows 3.4: Move and Edit on a matched run | Fixed | `t63`: `Share · Not feeling 100%`; Move · Edit under ⋯ |
| flows 5.1: the evening split across tabs | Fixed | `t41-close`: the quote line, the composer and the Tomorrow group on the Close card |
| flows 5.2: after 18:00 the run cannot be opened from Today | Fixed | `t90` 5.2: the Close card's run row opens the session sheet |
| flows 5.4: the word is a setting, not a day's word | Rejected | spec M17 keeps the sticky word (`settings.focus.word`), shown dated in the caps line |
| flows 5.5: a horizontal drag in the composer pages the day | Fixed | `t90` 5.5: a 264 px drag from the composer, 0 commits |
| flows 7.1: a future day is an empty page | Fixed | `t37`, `t16`: every section, the week card on −3 / +3 |
| critic C12: a swipe re-renders the whole tree | Fixed | `t10` [16]: zero renders while the track springs; QA step: new neighbours mount as shells (the commit task at 4× 160–215 → 76–122 ms) |
| critic C5: no swipe affordance at rest | Fixed (with WP1) | the strip under the bar (`t10` [11]: the disc follows the drag) |
| WP1 O5: the headline breaks mid-word at 390 | Fixed | `t90` O5: one line on the morning, out, open and done faces at 390 and 320 |
| WP1 C2-7 / C3-8 / C4-4: pull to refresh has no keyboard path | Fixed | DayView's hidden `Check for new runs` button dispatches `REFRESH` |
| WP1 R1 #5, §14 27: the session sheet's body is slow on the open | Fixed for the hero | `t63`: the sheet's first frame 5 ms (1×), 25–47 ms (4×, budget 70) after `touchend`; a Plan row's open (`r1-sheet` f5) is WP4's row (request) |
| WP1: `.focus-strip` 16 px past the edge at 320; `enterKeyHint` on quick add; `useHomeControl` / `useRootRequest` in DayView | Fixed | `FocusStrip` deleted; `QuickAddField` `enterKeyHint="done"`; DayView |
| WP1: `sessions.css`'s `.dp` collides with the pager's `.dp` | Open (request) | the rules style `DayPicker.tsx`, which is WP4's; WP1 outranks them meanwhile |
| visual F11 (grey text contrast), F7 (type sizes) | Not WP2's | tokens (WP1); Today uses them |


### Requests (all open, consolidated; the step notes below say where each came from)

**WP1**

1. **`ui/NavBar.tsx` DateStrip: a forced layout on every commit.** Its layout effect re-runs on every commit (deps `[idx,
   handle]`) and reads `strip.clientWidth`: 20–24 % of the 4× commit task on the pill home from +5 (profiled on an
   unminified build). Cache the pitch from the ResizeObserver. With it and the pager's per-commit restyle (next), [20]'s
   avatar at 4× would come back within 150 ms; today it is 137–204 ms (median ≈ 160; 1×: 50–67).
2. **`ui/DayPager.tsx`: the commit restyles both pages.** `data-role`, `inert` and `aria-hidden` flip on whole pages in the
   commit's frame, and two full pages unmount after a 5-day `goTo`; at 4× the commit task is 76–122 ms after the QA step's
   shell fix. Anything that moves the unmount or the attribute flips out of that frame helps [20] at 4×.
3. **`ui/DayPager.tsx` velocity (F8, repeated).** [15c]'s "three left, one right" at 4× reads v = 0 on a flick (motion's
   30 ms `getVelocity()` window); a sampled tracker closes it. Also fails on WP1's lab at 4×.
4. **`ui/NavBar.tsx` trailing swap.** NavBar's keyed `AnimatePresence` starts the 120 ms fade a frame after the commit's
   render. DayView now passes one stable `TrailSwap` (both occupants mounted, a CSS crossfade on the commit's own style
   change). Either NavBar adopts that (and DayView passes avatar / pill again) or the contract names the stable-key form.
5. **`ui/Pressable.tsx`: a release option (`pressOn: 'release'`), repeated.** The orb, `TodoMark` and now the hero answer on
   `pointerup` and swallow their click themselves; the hero's `swallowNextClick` (`features/day/Hero.tsx`) is a local
   stand-in for WP1's internal `ui/clickSwallow.ts`. WP4's Plan rows need the same for `r1-sheet` f5.
6. **`app/App.tsx`.** `Framed`'s interim `requestAnimationFrame(hideSplash)` is WP2's now (the live page's first paint);
   its cold-open `stravaSyncNow` duplicates DayView's (harmless under the 30 s throttle): keep one.
7. **`styles/ui.css`.** The old `.hero` rule collides with the contract's `.hero` section class; delete it at integration.
8. **`styles/base.css` reduced motion.** `* { transition-duration: 0.01ms !important }` turns every style write into a
   transition (the pager's track transform included): harmless to the eye, but every transform write under reduced motion
   is a CSS transition object. Scope it to the elements that declare a transition, or use `transition: none` where JS owns
   the property.
9. **`ui/primitives.tsx` `Mark`, `EmptyState`** fire `toggle` / `success` directly (contracts §D.3: `hapticAtPeak` only). WP2
   uses neither for to-dos or habits.
10. **Contracts §D.1.** A `startOnNextFrame` option in `lib/motion.ts` (motion's `animate()` inside a long task starts from a
    stale frame time; the landing runs on the frames' own clock).

**WP3**

11. `WakeEditor`'s save fires `haptics.success()` and toasts `Alarm 7:15 on tomorrow` (the Close card's alarm row opens it):
    §11.4 has no haptic on that save and §8 toasts are Undo and errors only.
12. Risk 8: `Back to the plan` needs `plannedMiles` stored on a session at its first edit (shared types and schema are WP3's).
13. The Now card carries `[data-shared="morning-line-<date>"]`; Today pushes with `{ shared: 'morning-line-<date>' }`.

**WP4**

14. `DayPicker.tsx` uses `.dp*` classes (styled in WP2's `sessions.css`) that collide with the pager's `.dp`: rename to
    `.dpk-*` in `DayPicker.tsx`; WP2 renames its rules at the same integration commit.
15. Plan rows open the session sheet from the click (`r1-sheet` f5: 1× 19–24 ms, 4× 115–185 ms); open it on the release as
    the hero does (the body is WP2's and renders in the same frame).

**WP6**

16. The Welcome payoff must draw `FirstRunHero` at Today's hero rect: (16, 157, 358 × 184) on the web, (16, 216) with
    `--safe-t` 59. On the seams base the payoff's hero is at (16, 40, 358 × 118); Today's half of [54] passes (the hero is at
    its rest rect on its first frame, 0 px of movement, zero black frames).
17. The `Composer`'s journal write re-renders every mounted day page in the save's task (4×: the Close card's crossfade starts
    ≈ 330 ms after the tap; 1×: ≈ 100 ms).
18. `EntryItem` is a `SwipeRow`, which Today may not host (M9): an exported plain entry row would let the past day's card and
    Journal share one.

**Spec (`docs/feel.md`)**

19. §14 37: "≥ 60 % of the viewport non-black" cannot hold as a pixel share on this design (cards `#111` on `#000`, 24 px
    gaps): every page reads 45–50 %. The battery measures rows holding content (63–66 %).
20. §3.4 #9 / §14 46: "a tap on the ring opens no session sheet": the hero opens none; the ring's own `onTap` is the session
    sheet (contracts §F). The battery asserts at most one sheet.
21. §3.1 row 4: 56 px orbs with 12 gaps and "scroll past 6" cannot both hold in 358 (six cells are 396); names take two lines
    (the row is 92, not 72).
22. §6.1 / risk 11: `/coach/read` returns 2–3 sentences; the hero shows the first.
23. ~~§5 step 4: after Save the box keeps the composer's height~~ Withdrawn in fix round 1: the box takes the entry's height and
    what follows moves by FLIP (feel review 1 #3).
24. §3.1 nudge: "a 24 px line under the hero"; built as a 44 box (its hit area) with the row directly under it (44 between
    the hero and the row on the first open, against 24 + 12).


### Screenshots (looked at, each one)

- Before (the seams base `400f8f5`, built in a detached temporary worktree, since removed; served from
  `S/wp2/dist-before-qa`): `S/wp2/qa/shots/qa-before-{390,320}-*.png` (20 states each; the interactive states the old page
  does not have are absent).
- After: `S/wp2/qa/shots/qa-after-{390,320}-*.png` (29 states each): Fri 06:30 / 07:50 / 08:45 / 12:30 / 20:30, Sat (two
  sessions), yesterday, tomorrow, +5, Oct 11 (missed), Sep 8 (landed), scrolled 300 and to the end; the hero menu, the title
  menu, the calendar, the orb menu, a checked and a folded to-do, the To-dos sheet, quick add, the session sheet, the week
  sheet, This morning, the Close card typed / saved / word field / alarm sheet, reduced motion. `scrollWidth` equals the
  width in every one; the console was clean.
- Side by side: `S/wp2/qa/shots/cmp-qa/cmp-{390,320}-<state>.png`; the QA step's fixes: `cmp-qa/fix-320-390.png`,
  `cmp-qa/fix-morningrow.png`.
- Earlier steps: `S/wp2/qa/shots/{after,lists,landing,evening}-*.png`.
- Looked at and judged fine as they are: the Close card's box keeps the composer's height after Save (spec request below);
  the orb row cut at the right edge is its scroll affordance; the hero's line ellipsizes long session descriptions on one line
  (`6 mi · floor 20 min with the mid…`), never mid-word on a short one.

# Build history (the three build steps' notes, as written then)

The requests in these notes are all carried into the consolidated list above.

### Step 1 of 3: the page (DayView, DayPage, the hero)

What it built (commits `d5c2779`, `f49e6bb` and the step's later ones):

- **DayView** is the Today tab root on WP1's primitives: `NavBar` (the owner's word, the stacked date and title labels bound
  to the pager, the avatar ⇄ Today pill, the title block's tap home and hold menu `Change the word · Clear the word · Go to a
  day…`), the `DateStrip`, the `DayPager` rendering a `DayPage` for prev, cur and next. The date is page state read once from
  the route, mirrored with `nav.replace`, changed from outside through `useRootRequest` (a cut sets it, an active tab slides);
  `useHomeControl` slides home. The cold open starts the Strava check. A hidden `Check for new runs` button dispatches
  `REFRESH` (pull to refresh's keyboard and VoiceOver path, WP1's request).
- **DayPage**: the same sections in the same order on every day (hero, sentence, nudge, This morning row, second session,
  habits, to-dos, week card, plan end, Strava primer, the day), the bottom padding inside the cur page. A neighbour mounts as
  its shell and fills in in the background (`useDeferredValue`); which page is live is a small store (`features/day/live.ts`)
  read only by the leaves that need it (daily moments, the ring fill and `celebrate`, the nudge, the splash), so a commit
  re-renders little.
- **Hero**: fixed 184 (304 landed with a route); faces from `faces.ts` (pure, unit-tested) crossfading in the same box:
  morning, out, open (status line `Checking Strava…` from `useStravaChecking`), landed, done by hand, skipped, missed, rest,
  the rest morning, other days quiet. Menu `Done · Skip · Move · Share`; the ring and the four-stop line own their press
  (`ignore`); the line pushes This morning with the shared element. Two sessions stack (the second is a 60 px compact card).
- **HoldRing** 48 (56 hit) / 40, `touch-action: pan-y`, no pointer capture, the check in the same node, the completing
  click swallowed. **MiniTimeline** 44 tall, the now dot by transform. **MorningRow**, **WeekCard** (marked day, `celebrate`
  once per ISO week when Today is active and the card in view), **TheDayCard** (past days; plain rows, no swipe), **PlanEnd**
  (lazy; `useOpenBuilder()(fromEndingBlock(…))` over Today), **FirstRunHero** on Today, the one-time nudge, `useLog` memoised.
- Deleted: `FocusStrip.tsx`, `useHoldMenu.tsx`, `SetupCard.tsx`, `dayTitleWord`, the hero carousel and dots, `HeroWeekRing`,
  `usePullToMorning`, the `HOLD` caption. Minimal changes ahead of the lists step: the orb row is `data-no-page`; the to-dos lose
  their swipe rows on Today (the words carry the hold menu `Later · Someday · Priority · Delete`) and their skeleton rows.

WP1's live review O1–O4 (the interim Today), closed on the real page:

| | Finding | Now | Proof (1×) |
|---|---|---|---|
| O1 | Two-session day: the day swipe dead on the hero | Fixed: sessions stack; the pager is the only horizontal gesture | `t10-pager` 10: a 270 px swipe on the hero of Sat Oct 24 (Threshold 6 + Strength) commits tomorrow, lag 0 |
| O2 | The word scrolls off with the page | Fixed: `NavBar word`; it stays in the collapsed bar | `t41-word` 41: scrolled 60, `.nb-word` reads `PATIENT · ` at opacity 1 |
| O3 | The stops line opens the session | Fixed: it pushes `/today/<date>/morning` with `shared` | `t15-morning`: one push, `shared = morning-line-<date>`, the hero's line hidden on the first frame, the flyer a child of body |
| O4 | 8-item menu that stays up while the page pages | Fixed: 4 items; the menu closes on the drag | `t13-hero` 13 and 33: `Done · Skip · Move · Share`; gone 51 ms after the 10 px mark, 1 page-commit |

### Step 2 of 3: the lists (orb row, to-dos, useDeferred)

What it built (commits `7423539`, `cae8e99` and the step's last one):

- **Orb row** (`features/habits/OrbRow.tsx`, §3.1 row 4): 56 px rings in 64 px cells (12 between rings), names 12/16, native
  horizontal scroll (`touch-action: pan-x pan-y`, `data-no-page`). The tap is the release: the fill and the check land on the
  release's frame (on touch the click can come a frame later, so the orb answers in `pointerup` and swallows its click; Enter,
  Space, VoiceOver and the 1–9 keys still go through the click), the ring pops on `springs.complete` and `orb` fires on the
  pop's peak (`hapticAtPeak`). A press that travels past the hold slop is a scroll, not a tap. Hold: `Note · Details ·
  Archive`; a move after the hold carries the orb (`translate`, so the press scale and the lift compose), the others make room
  on `settle`, `select` per slot, `drop` on release, one `PUT /habits/order` on release, and the new order commits on the
  settle's completion with the shifts cleared in the same frame. Future days: ghost orbs (outline `--ink-4`, 40 %, inert),
  meta `5 habits`. The `+` orb opens a sheet (no inline expansion, no height animation). The `success` for all lit, the
  inline add, `Move left/right` and the `Habits light up here…` line are gone.
- **To-dos** (`TodayTodos.tsx`, `TodoList.tsx`, new `TodoMark.tsx`, `flip.ts`; §3.1 row 5, §3.3, M9, §10.1): an inset group
  (radius 12, rows 44/60, hairlines inset 16) of the top three, `+N more ›` (or `Later N · Someday M ›`) opening the To-dos
  sheet, and `+ Add a to-do`, which becomes the field in the same 44 box (focused on the tap, `revealField`, `enterKeyHint`,
  Return keeps the field for the next one). `TodoMark` fills on the release and pops with `toggle` at the peak. The checked
  row dims and after `FOLD_MS` folds: its content fades 100 ms, it leaves, and the rows below and the sections after the list
  move by FLIP on `settle` (`useFlip`: "first" is snapshotted at the action, so only the owner's changes animate). While a
  finger is on the list the fold waits for it to lift. Hold on the row (not the mark): `Later · Someday · Priority · Delete`,
  the row lifted in place. No `SwipeRow` on Today; the sheet's rows are SwipeRow v2 (right Done, left Later or Today; the
  menu lists them first, so it reads `Done · Later · Someday · Delete`; priority and order are in the editor). Past days list
  what was due and what was done (struck; the mark reopens); future days what is due, and Add adds it for that day.
  `TodoList`'s motion-drag rows, swipe code and timer chain are deleted; no `orb`/`toggle` is fired directly anywhere in
  habits or to-dos (the habit sheet's day grid lights through `hapticAtPeak` on its fill).
- **`useDeferred`** (`features/day/useDeferred.ts`, §5.3, §5.4, M14, M15): one store of waiting changes. The hero gates its
  clock (`useDeferredMinutes`): a minute that keeps the face ticks at once; one that changes it waits for the next
  interaction (applied inside the tap's click, after its own handlers, at the click's priority), a foreground return, or
  `IDLE_MS` without a touch, focused field, sheet or menu, counted from the later of the change and the last touch; never
  under a finger, never on a scroll's release. The day card and the Close card crossfade 150 ms in one slot (`.hero-swap`).
  Midnight: `lib/useToday.ts` gains `TodayHold` (every `useToday`/`useLog` inside the Today tab reads the held day) and
  `useLiveToday` (still polling); DayView rolls only with no focused field in the tab, no draft (`hasDraft`, re-asked on
  `subscribeDrafts`), no sheet or menu, and an idle minute, a tab change away, a cold open or a foreground return; it rolls
  with `handle.goTo(newToday, { mode: 'crossfade' })` + `nav.replace('/today')`. A held day's hero reads the day's last
  minute, so its evening face stays.

### Step 3 of 3: the evening and the run landing

What it built (commits `555241f`, `a7f9c29`, `34ce0fe`, `e41b73b`, `df902ab` and the step's last one):

- **The run landing** (`features/day/useStravaLanding.ts`, `RunLanding.tsx`, §6.1, build plan items 5, 6). A matched run in
  today's snapshot whose landing has not been seen today waits (`stage = wait`): the hero keeps the face from before the run
  (`preLandingFace`: the open face, its ring where it was) until Today is the active tab with nothing pushed over it, the
  app is visible, the page is the live one and the hero is ≥ `LANDING_VISIBLE` in the tab scroller (an
  `IntersectionObserver`). It subscribes to nothing while no landing waits, so a tab tap, a day step or a foreground return
  re-renders no hero. Then, from the first calm frame (two frames on time, at most 1.2 s after the refetch that brought the
  run): stage 1 fills the ring 0–300 and stage 2 crossfades its stroke into the check 300–500 (the check 0.8 → 1 on
  `settle`), on one frame clock, on the ring's own node, with no React render (the node sets its own `data-done`); stage 3
  is `growHero`: the card commits its 304 layout 150 ms early under the inverse transform (the landed face is already
  mounted, hidden, under the face from before, so the commit is a class and two opacities), and from +500 one
  `springs.settle` progress (0 → 1000, integrated on the frames' clock like the pager, at rest within 1 unit and 30/s)
  scales the card back to 1 with its radius corrected and its content counter-scaled, carries the deck and the ring with
  the bottom edge and translates everything below the hero by the same amount (`data-layout-exception` while it moves); on
  its completion frame the styles clear, the one `success` fires (unless the hand already gave it today) and `.halo-boost`
  runs; stage 4 draws the route (1.1 s), ticks DISTANCE from the planned miles, PACE from the easy pace, TIME from 0, fades
  the verdict in, and the check's slot hands its place to Share. Then the coach: once per matched run, when the month has no
  read, `fetchCoachRead` (`POST /coach/read`, the existing route) writes the answer into the month cache; the hero fades its
  first sentence in (200 ms); a failure is silent and not asked again that day. The +8 s quiet repeat (`StravaRetry`, only
  on the live open face): a non-quiet check answered `changed: 0` gets one `stravaSyncNow(qc, { force: true, quiet: true })`
  8 s after it started. `useStravaPull` goes through `stravaSyncNow(qc, { force: true })`. The status line derives from
  `useStravaChecking` in the render (no effect in between) and starts its fade one frame in.
- **HoldRing**: two layers in the one node (the stroke's, the check's), the three values (`fill`, `morph`, `check`)
  drivable by the landing (`RingDrive`), written to the node synchronously; the hand's completion plays stage 2 on it; no
  1.12 pop on the ring (the check grows 0.8 → 1 on `settle`).
- **The Close card** (`CloseDay.tsx`, §5, item 12): one card of fixed slots: `CLOSE THE DAY` and the title crossfading to
  *Day, closed.*; the stamps (only what happened, counting once a day 60 ms apart, MI from the plan's miles); the run row
  (60, the 40 ring while open, the words open the session sheet); the quote line as the composer's prompt (tap inserts it)
  and the composer (`How did today go?`); Save swaps the box first (`flushSync`, the just-saved words shown until the month
  carries the entry) with a native 150 ms opacity crossfade, the box keeping its height so nothing below moves, the
  Composer's one `success`, `.halo-boost`, `Add to it`; Tomorrow always: the word as an inline field in the same 44 row
  (Return saves; the bar's caps line paints before the write, `saveFocus`) and `Alarm 7:15 · change` (WP3's `WakeEditor`
  for tomorrow, `Just tomorrow` chosen, a medium sheet); `Share the day`; today's read. Save blurs what had focus in the card.
- **The session sheet** (§6.3, item 17): after a matched run the second row is `Share · Not feeling 100%` (which eases the
  next three days, with Undo, and leaves the run done), Move and Edit under the ⋯; the evidence renders after the open
  (WP1's request); no `0 mi` stat. Session actions: no haptic on Skip, un-completing or the illness skip; Done and Floor by
  hand mark the session's one success; no toast without an Undo. The unused drag rows (`SessionRow`, `DropWeekStrip`,
  `UnplannedRow`, `AddSessionButton`) are deleted with their `DROP_SPRING`, `useHoldDrag`, `DayStrip` and long-press uses:
  nothing mounted them (build plan item 17 asked that the last two keep working "in the sheet"; they were not in it).
- **Share doors** (item 18): the hero menu's Share, the landed face's Share pill (which takes the check's place at stage 4),
  `Share the day` on the Close card and on past days' card.
- No haptic on the calendar's month chevrons or the session editor's chips; no `Saved` / `Added to` toasts.

#### Battery (this step's scripts)

`S/wp2/qa/run.mjs` now also runs `t41-close`, `t45-landing`, `t63-session` (S =
`/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`); every row with its numbers is in
`S/wp2/qa/results/TABLE.md`. Whole suite on this step's build: **164/165 at 1×, 153/156 at 4×** (the three 4× misses are
step 1's page-commit items, WP1 requests: the [12] flick's 4.8 px vs 3 and the avatar after the pill's and the lit tab's
slide; the 1× miss is the hero tap's sheet frame below). This step's rows (1× / 4×):

| §3.4 [§14] | check | 1× | 4× |
|---|---|---|---|
| #8 [45] | `/strava/sync` requested after `visibilitychange` (bootstrap held 2 s) | 4.1 ms | 8.3 ms |
| #8 [45] | `Checking Strava…` on screen after `visibilitychange` / shown for | 7.9 ms / 1483 ms | 10.2 ms / 1717 ms |
| #8 [45] | stage 1: the ring's `stroke-dashoffset` at 0 (budget +300 ± 50) | +317 | +317 |
| #8 [45] | stage 2: the check at scale 1, same node, `[data-done]` (+500 ± 50) | +517 | +550 |
| #8 [45] | stage 3: `.hero` 304 ± 1 at the FLIP's completion (+900 ± 60); `.habits` translated on every intermediate frame | +907, 304.1, 14 frames | +931, 304.1, 12 frames |
| #8 [45] | one `success`, on the FLIP's completion frame | 1, Δ 0 ms | 1, Δ 0 ms |
| #8 [45] | the route's `pathLength` 1 at completion + 1100 ± 100 | +1093 | +1119 |
| #8 [45] | frames with `0 mi`; layout keyframes in `getAnimations()` | 0; 0 | 0; 0 |
| #8 [45] | hidden / Journal active / hero scrolled out when the run lands: 0 stages, 0 `success`; then once from stage 1, 1 `success` | pass ×3 | pass ×3 |
| [53] | `changed: 0` after the back time: one more `/strava/sync` at +8 s ± 0.5, no status line for it | +7.999 s | +7.995 s |
| #19 | one `POST /coach/read` `{ date, sessionId }` after stage 4, its sentence fades in, no `Reading`; a reload: 0 more; read in the month: 0 calls; a 500: no sentence, no toast | pass ×4 | pass ×4 |
| #4 [41] | Close card at Fri 20:30: every slot, the Tomorrow group before any entry | pass | pass |
| #4 [41] | the word row → the field in the same 44 box (maxLength 12); Return → `PATIENT · FRI, OCT 23` (≤ 150 ms), no toast, no haptic | 10 ms | 37 ms |
| #4 [41] | after a reload; `/today/+1` `PATIENT · SAT, OCT 24`; scrolled 60 the word at opacity 1 | pass | pass |
| §5 | the composer focused (keyboard stub): the card's height unchanged, `--kb` 336px | pass | pass |
| §5 | Save: the entry in the box by one 150 ms opacity fade (started after the tap), the title → *Day, closed.*, `Add to it` 44 | 96 ms | 324 ms |
| §5 | Save: exactly one `success`, `.halo-boost`, nothing below the box moves | 0 px | 0 px |
| §5 | `Add to it` brings the composer back, focused; the alarm row: a medium sheet, `Just tomorrow`, 0 haptics; `Share the day` | pass | pass |
| §6.3 | the open session's sheet: `Skip · Move · Edit`; its first frame after `touchend` (budget 17 / 70) | 30 ms (fail) | 54 ms |
| §6.3 | Skip in the sheet: 0 haptics, toast with Undo; after a matched run: `Share · Not feeling 100%`, ⋯ `Move · Edit · Delete`, no `0 mi`; Not feeling 100% eases, the run stays done, 0 haptics | pass | pass |

Re-run on this step after the Close card change: `t42-midnight` 5/5 and 5/5 (it failed 3/5 at both rates before Save blurred
the card's focus: the Save button, focused by the tap, left the DOM 26 s of fake time later and its `focusout` restarted the
idle minute), `t43-phase` 5/5 and 5/5, `t37-sections` 26/26 and 26/26, `t41-word` now 10/10 at 4× too (the word paints
before the write).

Gates: tsc shared/api/web exit 0; shared 88, api 59, web 99 (96 + 3 new in `faces.test.ts`) pass; `pnpm --filter
@logbook/web build` ok, entry chunk 923.1 kB raw (step 2: 915.6; the Close card's quote line, alarm editor and read load in
their own slots and are fetched at idle). Reduced motion (`shots-landing.mjs`): the landing swaps without the FLIP, still
304 at rest, 1 `success`. Screenshots (Read): `S/wp2/qa/shots/landing-{390,320,390-reduced}-{open,grow,landed}.png`,
`S/wp2/qa/shots/evening-{390,320}-{close,close-scrolled}.png`, `S/wp2/qa/shots/evening-390-{typed,saved,word,alarm}.png`;
before: `S/wp2/qa/shots/after-{390,320}-*.png` (step 1's 20:30 and Sep 8 states).

#### Requests (this step)

- **WP3 (`features/morning/StepSheets.tsx`, `WakeEditor`).** Its save still fires `haptics.success()` and toasts `Alarm 7:15
  on tomorrow` (the Close card's alarm row opens it): §11.4 has no haptic on "Save of the alarm" and §8 toasts are Undo and
  errors only.
- **WP3 (risk 8, `packages/shared` types, the sessions table).** `Back to the plan` needs `plannedMiles` stored on a session at
  its first edit; the shared `Session` type and the schema are WP3's.
- **WP6 (`Composer`).** The journal write's optimistic month patch re-renders every mounted day page in the save's task: at
  4× the Close card's crossfade starts 339 ms after the tap (1×: 101 ms) though the fade itself is a 150 ms compositor
  animation. Deferring the month patch to after the next frame (or a lighter page subscription, step 2's note) would close it.
- **WP1 (`Pressable`, repeated).** The hero's tap opens the session sheet from the click, a frame after the touch's release:
  the sheet's first moving frame is 23–31 ms after `touchend` at 1× (§14 27: 17). Opening on `pointerup` here would bypass
  the pager's swallowed tap-during-a-slide, so it stays on the click until Pressable has a release option.
- **Contracts §D.1 / WP1.** motion's `animate()` started inside a long task takes its start from a stale frame time, so a
  timed sequence jumps ahead by the task's length (the landing's ring at 4× read +197 ms for a 300 ms fill). The landing runs
  its stages on the frames' own clock (as DayPager does); a `startOnNextFrame` option in `lib/motion.ts` would serve others.
- **Spec §6.1 / risk 11.** `/coach/read` returns 2–3 sentences (the API's prompt asks for them); the hero shows the first,
  one line, 15/20. If the owner wants the whole read on the face, the prompt should ask for one sentence.
- **Spec §5 step 4.** "The entry replaces the field in the same box": the box keeps the composer's height after Save (so
  nothing under it moves, §0.4 rule 1), which leaves space under a short entry until the next open.

### Requests

- **WP1 (`ui/NavBar.tsx` DateStrip).** Its layout effect re-runs on every commit (deps `[idx, handle]`) and reads
  `strip.clientWidth`, which forces a synchronous style and layout of the whole Today tab inside the commit: the largest single
  cost of a catch-commit on the real page (≈ 10 ms at 1×; a catch-commit is 16–34 ms at 1×, 86–184 ms at 4×, against 5–9 ms on
  the pager lab). Cache the pitch from the ResizeObserver (or `handle.width() / 7`) so a commit never forces layout.
- **WP1 (`ui/DayPager.tsx`, F8 repeated).** On the real page at 4×, §14 15c's "three left, one right" variant commits 3 of 4:
  the catch-commit's render delays the next flick's events past motion's 30 ms `getVelocity()` window, so that flick reads
  v = 0. The sampled tracker WP1 proposed (pointer `timeStamp`s, no 30 ms cap) would close it. 1× passes.
- **WP1 (`app/App.tsx`).** `Framed`'s `requestAnimationFrame(hideSplash)` is now WP2's (the live `DayPage`'s first content
  paint); remove the interim at integration. Its cold-open `stravaSyncNow` after the first bootstrap duplicates DayView's
  (harmless under the 30 s throttle); keep one.
- **WP1 (`styles/ui.css`).** The old `.hero` rule (a padded two-column grid card) collides with the contract's `.hero` section
  class; `day.css` overrides it for the evening and first-run wrappers. Delete it at integration (nothing else uses it).
- **WP3.** This morning's Now card line carries `[data-shared="morning-line-<date>"]` (the flyer's destination); Today pushes
  with `{ shared: 'morning-line-<date>' }` from both the stops line and the This morning row.
- **WP6.** `EntryItem` is a `SwipeRow`, which the Today page may not host (M9), so the past day's card renders its own plain
  rows; an exported plain entry row (tap to open, hold for Edit · Favourite · Share) would let both share one. The Welcome
  payoff must draw `FirstRunHero` at Today's hero rect: (16, 157, 358 × 184) on the web, (16, 216) with `--safe-t` 59
  (measured, `t54-first`).
- **Spec (§14 37).** "≥ 60 % of the viewport below the header is non-black" cannot hold as a pixel share on this design (cards
  `#111` on `#000`, 24 px of black between sections): every page reads 0.45–0.50. The battery measures the share of rows below
  the pinned chrome that hold content (0.63–0.66 on every page and time) and reports both.
- **Spec (§3.4 #9 / §14 46).** "A tap on the ring opens no session sheet": the hero opens none (it ignores the ring); the
  ring's own `onTap` is the session sheet (contracts §F). The battery asserts at most one sheet.

- **WP1 (`ui/primitives.tsx` `Mark`, `EmptyState`).** `Mark` fires `toggle`/`success` from an effect when its status
  becomes done, and `EmptyState` fires `toggle` when a starter is added: contracts §D.3 says `hapticAtPeak` is the only way
  `orb`/`toggle` fire. WP2 no longer uses either for to-dos or habits (TodoMark, the orb sheet); other callers still do.
- **WP1 (`ui/Pressable.tsx`).** `onPress` comes from the click, which on touch lands one frame (4×: 60–100 ms) after the
  release, so a fill "on the tap's frame" cannot be built on it. The orb and TodoMark answer in `pointerup` and swallow the
  click themselves; a `Pressable` option for it (`pressOn: 'release'`) would keep that in one place.
- **Spec (§3.1 row 4).** `56 px orbs, 12 gap` and `scroll past 6` cannot both hold in 358: six cells at 68 are 396, so the
  row scrolls from six (five habits and the `+`). The names take two lines at most: three of the owner's five ("Read 15 Min",
  "Guitar 5 Min", "8,000 Steps") measure 69 px at 12/16 against a 68 px pitch, so on one line they were cut; the row is
  92 tall with them (56 + 4 + 2 × 16), not the 72 of `25 + 8 + 72`.

### Battery (step 1): 100/100 at 1×, 86/91 at 4×

`S/wp2/qa/run.mjs` (S = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/feel`); the full
table with every measured number is `S/wp2/qa/results/TABLE.md`.

| §3.4 [§14] | checks | 1× pass | 4× pass |
|---|---|---|---|
| #1 [37] | 15 | 15/15 | 15/15 |
| #2 [38] | 10 | 10/10 | 10/10 |
| #3 [40] | 1 | 1/1 | 1/1 |
| #4 [41] | 6 | 6/6 | 5/6 |
| [39] | 4 | 4/4 | 4/4 |
| #9 [46] | 4 | 4/4 | 4/4 |
| #10 [10, 11, 19] | 10 | 10/10 | 10/10 |
| [12] real page | 1 | 1/1 | 1/1 |
| [13] real page | 1 | 1/1 | 0/1 |
| [14] real page | 1 | 1/1 | 1/1 |
| [15] real page | 1 | 1/1 | 1/1 |
| [15a] real page | 1 | 1/1 | 1/1 |
| [15c] real page | 2 | 2/2 | 1/2 |
| [15b] real page | 2 | 2/2 | 2/2 |
| #11 [16, 17, 18] | 5 | 5/5 | 5/5 |
| #12 [20] | 4 | 4/4 | 2/4 |
| #13 | 5 | 5/5 | 5/5 |
| [34] | 1 | 1/1 | 1/1 |
| [33] O4 | 1 | 1/1 | 1/1 |
| #15 O3 | 7 | 7/7 | 7/7 |
| #16 | 3 | 3/3 | 3/3 |
| #20 | 3 | 3/3 | 3/3 |
| #17 [54] | 3 | 3/3 | 3/3 |
| #18 | 9 | 9/9 | static |
| **all** | 100 | 100 | 86/91 |

The 4× misses are the page commit's cost at 4× (86–184 ms; see the DateStrip and velocity requests above): the avatar back
235–300 ms after rest (150), the caps line 284 ms after Save (150), a 15 px recorder skew across a catch, and one 15c variant.
Gates: tsc shared/api/web exit 0; shared 88, api 59, web 96 tests pass; `pnpm --filter @logbook/web build` ok (entry chunk
917.7 kB raw, 935.1 on the base).

### Battery (step 2, the whole suite after the lists step): 129/129 at 1×, 116/120 at 4×

`S/wp2/qa/run.mjs` now also runs `t14-orbs`, `t44-todos`, `t42-midnight`, `t43-phase`; the table with every number is
`S/wp2/qa/results/TABLE.md`. This step's rows (1× / 4×):

| §3.4 [§14] | check | 1× | 4× |
|---|---|---|---|
| #14 [32] | 380 ms press lights the orb, fill on the release's frame, 0 menus | pass | pass |
| #14 [32] | 1 `orb`, on the frame of the pop's sampled maximum (peak 1.119 / 1.115), not the tap frame | frame 3 = max 3 | frame 2 = max 2 |
| [31] | orb `data-pressed` after touchstart / 0.97 by / cleared after touchend | 13.7 / 63.9 / 14.5 ms | 16.6 / 73.2 / 24.2 ms |
| #14 [32] | 470 ms: exactly `Note · Details · Archive`, 1 lift, not lit, menu in the DOM at | 457 ms | 492–514 ms (budget 500; 6 runs, 4 pass) |
| #14 [32] | 10 px after the hold: menu closes in, orb `data-dragging` | 67 ms | 70 ms |
| #14 | carried one slot: 1 lift · 1 select · 1 drop, one `PUT /habits/order` on release, none during | pass | pass |
| #14 [32] | a 300 ms press that moves 12 px: neither | pass | pass |
| §3.3 | future day: 5 ghost orbs, 0.4, inert, no `+`, `5 habits` | pass | pass |
| #7 [44] | no `.todos .swipe-row` on Today; the sheet's rows are swipe rows (4) | pass | pass |
| #7 [44] | check filled on the tap frame; 1 `toggle` on the frame of the max scale (1.12 / 1.112) | frame 3 = 3 | frame 1 = 1 |
| #7 [44] | row unchanged 600 ms; gone at; rows below up 44 on a spring (frames moving); no height keyframes | 729 ms; 44 px; 15 | 793 ms; 44 px; 12 |
| #7 [44] | the fold waits while a finger is on the list, folds after it lifts | +3 ms | +130 ms |
| #7 | Add → the field in the same 44 box, focused on the tap; `--kb` 336 and the field revealed above it | pass | pass |
| #7 | Return → the row with its text on its first frame; field and week card down 44 by FLIP (frames moving) | 14 | 14 |
| #5 [42] | 00:01 with a draft: text kept, `Today`, `FRI, OCT 23`, disc on Friday; hide → show unchanged | pass | pass |
| #5 [42] | Save + 01:01 idle: one 150 ms opacity animation on the cur page, none on the track, `SAT, OCT 24`, `/today`; the entry in Friday's `.the-day` | pass | pass |
| #6 [43] | idle from 17:59: still the day card at 18:00:0x; Close card after the idle minute with 150 ms crossfades | pass | pass |
| #6 [43] | 18:00:30 tap on an unlit orb: the orb lights and the Close card arrives on that tap (release → card) | 40 ms | 116 ms |

Reduced motion (`shots-lists.mjs`): an orb tap and a mark tap still fire `orb` and `toggle`; no FLIP translate is set.
The four 4× misses: the 470 ms menu at 505 ms (above), and step 1's three (the caps line 420 ms after Save, the avatar after
the pill's and the lit tab's slide: the page commit's render at 4×, WP1 requests). Gates: tsc shared/api/web 0; shared 88,
api 59, web 96 pass; `pnpm --filter @logbook/web build` ok (entry 915.6 kB raw, 917.7 after step 1).

Battery changes this step (the app was right, the scripts were not): t37 reads the hero through its `.hero-swap` slot; t41's
"scrolled 60" check gets three to-dos first (an empty to-do list makes Friday 29 px taller than the scroller, and a short day
does not scroll); t10 #18 starts its drag 24 px clear of the orb row (at that offset y 500 was 9 px under an orb, and the
browser's touch adjustment put the touch on the orb, which by spec never pages).

Screenshots (Read): `S/wp2/qa/shots/lists-{390,320}-{fri-scrolled,tomorrow,yesterday}.png`,
`S/wp2/qa/shots/lists-390-{checked,folded,orb-menu,sheet,quickadd}.png`; before: `S/wp2/qa/shots/after-*.png` (step 1).
