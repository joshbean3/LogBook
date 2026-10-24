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
