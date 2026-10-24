# WP2 Today: review

Branch `feel/wp2`, from `feel/pages-base`. This file grows with each step; the QA step completes it (battery table, hand
steps, audit findings, screenshots). Spec: `docs/feel.md` v4.2. Build plan §3. Battery: `scratchpad/feel/wp2/qa/`
(`run.mjs`, results in `qa/results/TABLE.md`).

## Step 1 of 3: the page (DayView, DayPage, the hero)

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

## Step 2 of 3: the lists (orb row, to-dos, useDeferred)

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

## Requests

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

## Battery (step 1): 100/100 at 1×, 86/91 at 4×

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

## Battery (step 2, the whole suite after the lists step): 129/129 at 1×, 116/120 at 4×

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
