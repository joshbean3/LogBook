# Release polish (team "polish", port 8841)

The final polish pass on the redesign: the 17 items from the critic's second verdict (`critic/verdict-2.md`) and QA round 2, and nothing else.

**How the screenshots were taken**
- *Before* screenshots come from the unchanged build (`git archive HEAD`, served on port 8842 with the same seed).
- *After* screenshots come from this branch on port 8841.
- All screenshots are at 390×844 (and 320×568 where it is named), with deviceScaleFactor 2, isMobile and hasTouch. Holds, swipes and drags use CDP touch events.
- Time-of-day states use Playwright's clock (`page.clock.setFixedTime`).

**Paths**
- Screenshots: `<S>/polish/shots/`
- Scripts: `<S>/polish/*.mjs`
- `<S>` = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad`

## Items

### 1. The evening card repeats itself (features/day)

**Change**
- In `CloseDay.tsx`, `dayStamps` takes `openShown`. When the open session's own row (its stamp and hold ring) is on the card, the sentence leaves the session out ("5 habits to light."). If that clause was all the sentence had, there is no sentence.
- A new `composerAsk` sets the composer's question:
  - "How did today go?" when the session row is shown.
  - "What did you do with the day?" when the sentence says "Rest day."

**Verification**
- `states.mjs`, owner on Fri Oct 16 at 19:30, run day: "5 habits to light." → EASY 4 row → "How did today go?"
- Owner on Wed Oct 14 at 19:30, rest day: "Rest day. 5 habits to light." → "What did you do with the day?"

**Screenshots**
- Before: `before_i1_eve_run_full.png`, `before_i1_eve_rest_full.png`
- After: `after_i1_eve_run.png`, `after_i1_eve_run_full.png`, `after_i1_eve_rest.png`

### 2. Past days (features/day)

**Change**
- On a past day, `dayStamps` gives no instruction. It says "Rest day." on a rest day and nothing otherwise.
- The orb caption under a past day said "5 to light", the same instruction. It now reads "None lit that day." (`habits/OrbRow.tsx`).

**Verification**
- `/today/2026-10-13`: the card has no sentence and the composer asks "Speed 5 didn't happen. What got in the way?"
- The orbs read "None lit that day."

**Screenshots**
- Before: `before_i2_past_full.png`
- After: `after_i2_past_full.png`

### 3. Progress copy (features/progress)

**Change**
- The readout never shows a dash.
  - At rest, a stat with no value yet (AVG WEEK in a first week) is left out.
  - While scrubbing, the three slots stay put and an empty one says a word: MILES "To run" on a future week, PLANNED "No plan".
- `verdict` drops the comparison when last week had no plan and no runs. A first week reads "A first week on the board."
- New test in `data.test.ts`.

**Verification**
- `flow.mjs` on a fresh account with a run marked done today.
  - Before: "A first week on the board. This one is ahead of last week." and "AVG WEEK —"; the scrub showed "MILES —".
  - After: "A first week on the board." with BEST WEEK and TOTAL only; the scrub shows "MILES To run · PLANNED 21.5 mi · RUNS 4".

**Screenshots**
- Before: `before_i3_progress_390.png`, `before_i3_progress_scrub_390.png`
- After: `after_i3_progress_390.png`, `after_i3_progress_scrub_390.png`

### 4. Session sheet label (features/sessions)

**Change**
- The stamp in `planStats` (`SessionCard.tsx`) reads "Out at".
- The sentences elsewhere (the hero, the payoff, Today's "Out the door 6:45.") keep "Out the door".

**Verification**
- Owner on Fri Oct 16 at 6:30, tap the hero. PLAN · FLOOR · OUT AT · BACK sit on one baseline.

**Screenshots**
- Before: `before_i4_sheet.png`
- After: `after_i4_sheet.png`, `after_i16_flight_end.png` (the sheet opened from Plan)

### 5. The owner's smoothie block (shared morning labels, features/morning, onboarding)

**Change**
- `routineName` no longer turns an unnamed smoothie block into "Breakfast". The owner's stored routine reads "Blend smoothie" again.
- Onboarding now names the slot explicitly. New `routineNames(chips)` in `onboarding/model.ts` sends `names.smoothie`:
  - "Breakfast" when the Breakfast chip is picked.
  - "Coffee" when only the Coffee chip is picked.
  - Otherwise `''` (the default name).
- The name goes in the same `PATCH /morning/settings` the payoff already sends, and the morning-step preview uses it too.
- New accounts still have smoothie 0, so they never see the block.

**Verification**
- Owner `/morning`: Shower, Get ready, **Blend smoothie**, Final prep.
- Fresh sign-up at 320 with the Breakfast chip (`cold.mjs after 320 568 breakfast`): `morning.after.names = {"smoothie":"Breakfast"}`, and the timeline shows Breakfast.
- Fresh sign-up without chips: `smoothie: 0`, no names.

**Screenshots**
- Before: `before_i5_morning_full.png`
- After: `after_i5_morning_full.png`, `after_c3_morning_tomorrow_320.png` (Breakfast)

### 6. Two "leaving" times for new accounts (shared morning, features/morning, features/day)

**Change**
- `NEW_ACCOUNT_MORNING` no longer names the last block "Out the door". It is the default "Final prep".
- `afterLabel` reads an "Out the door" stored on that block by an earlier build as "Final prep" (`RETIRED_NAMES`), so accounts that already exist are fixed too.
- The payoff's PATCH clears any stored prep name.
- The hero's stop word maps "Final prep" to "Prep" (the old "Out the door" → "Out" special case is gone).
- Tests updated in `miles.test.ts`, `platform.test.ts` and `fixround.test.ts`, plus a new test for the retired name.

**Verification**
- After onboarding (leave 8:30), Today's line reads ALARM 6:30 · READY 7:55 · PREP 8:20 · LEAVE 8:30. Before, the third stop was OUT 8:20.
- The only door is the run's: Today shows "Out the door 6:45." and tomorrow's Morning shows Out the door 6:45–6:50. Both match the payoff's "Out the door 6:45."

**Screenshots**
- Before: `before_c2_today_390.png`, `before_c3_morning_390.png`
- After: `after_c2_today_390.png`, `after_c3_morning_390.png`, `after_c3_morning_tomorrow_390.png`

### 7. Today after onboarding leads with Tomorrow (features/day)

**Change**
- In the `Hero.tsx` no-session face, `upNext` now leads whenever there is one, including on a rest morning before work.
- The face reads, top to bottom:
  1. The headline "Tomorrow: Easy 4.5."
  2. "Out the door 6:45." in the serif (`.hero-door`). This is tomorrow's run door, read from that morning's timeline.
  3. A sub-line: "Rest. It counts." only mid-plan (never before the plan's first run), plus today's countdown ("Leave in 24 min.").
  4. Today's mini timeline, which still opens Morning.
- A tap on the card opens tomorrow's session. A tap on the line, or a pull, opens Morning.

**Verification**
- Fresh account on Wed Oct 14: "Tomorrow: Easy 4.5. / Out the door 6:45." under the block's eyebrow "10K · DEC 27". This matches the payoff `after_c1_q4_390.png`.
- Owner, mid-plan rest day (Thu Oct 15):
  - 7:30: "Tomorrow: Easy 4. / Out the door 7:30. / Rest. It counts. Leave in 2 h." with the line.
  - 12:30 at 320: the same without the line.

**Screenshots**
- Before: `before_c2_today_390.png`, `before_i7_midplan_rest.png`, `before_i7_midplan_rest_noon_320.png`
- After: `after_c2_today_390.png`, `after_c2_today_320.png`, `after_i7_midplan_rest.png`, `after_i7_midplan_rest_noon_320.png`

### 8. Plan card after Rebuild (features/plan)

**Change**
- `heroBlock` (`Blocks.tsx`) ignores a block that a newer block has replaced: the newer one was created later, starts after this one ends, and has not ended.
- The pick is the block covering today, else the next one to start.

**Verification**
- `flow.mjs`: new account → Settings → Training → miles + → Rebuild → Plan.
- Blocks after Rebuild: "Oct 15..Oct 18" (the leftover) and "Oct 19..Dec 27".
- The card went from "STARTS OCT 15 · Oct 15 – Oct 18" (before) to "STARTS OCT 19 · 10K · Dec 27 · Oct 19 – Dec 27" (after).

**Screenshots**
- Before: `before_i8_plan_after_rebuild_390.png`
- After: `after_i8_plan_after_rebuild_390.png`

### 9. Share the day on a skipped day (features/share)

**Change**
- In `shareDataFor` (`SessionCard.tsx`), a day whose sessions were all skipped is no longer typed `rest`.
- Its card is titled with the session and the shared status word, `STATUS_WORDS.skipped` ("Easy 4 · Skipped").
- Its line is the day's words, or "The week still counts." ("Rested to recover. It counts for the week." for a sick skip).

**Verification**
- Easy 4 on Oct 13, marked skip, with a journal entry → Share the day.
  - Before: "Rest".
  - After: "Easy 4 · Skipped".

**Screenshots**
- Before: `before_i9_share_skipped_390.png`
- After: `after_i9_share_skipped_390.png`

### 10. Journal ribbon targets (features/journal)

**Change**
- The ribbon is a horizontally scrolling grid of columns that are each at least 44px wide.
- It snaps to days (`scroll-snap-align: end`) and opens with today at the right edge.
- The left edge fades while earlier days are off screen.
- Scrub gesture:
  - With a finger, hold for 220ms, then slide. Each day steps with `haptics.select()`, the caption previews it, the ribbon follows the finger to its edges, and letting go opens the day.
  - A plain swipe just scrolls. A non-passive touchmove stops the scroll during a scrub.
  - A mouse scrubs on drag, as before.
- Arrow keys move between days and scroll the focused one into view.

**Verification** (`ix.mjs 10`)
- Every column is 44px at both widths.
- At 390, 8 days are visible and today's right edge is at 386. At 320, 7 are visible and it is at 316.
- A swipe right scrolls to the first day.
- A hold on today, then sliding left, moves the caption from "Wed, Oct 14 · Today. Write above." to "Sat, Oct 10 · Nothing written. Let go to add it.", and the release opens that day's sheet.
- Page overflow is 0.

**Screenshots**
- Before: `before_i10_journal.png`, `before_i10_journal_320.png`
- After: `after_i10_ribbon_390.png`, `after_i10_ribbon_320.png`, `after_i10_ribbon_swiped_*.png`, `after_i10_ribbon_scrub_*.png`, `after_i10_ribbon_scrub_open_*.png`

### 11. Morning short blocks (features/morning)

**Change**
- In `Timeline.tsx`, a block shorter than 44px keeps its true drawn height.
- It gets an invisible hit area that only ever covers empty space:
  - It uses half of a neighbouring free stretch.
  - Where a full block sits right against it, a little room is let into the timeline at that edge. The axis, the now line and the ticks all follow the same `y()`, so the clock still reads true.
- Under the run or gym block nothing is taken. The short block starts below the grip's 22px reach and grows downwards, so the grip keeps its whole 44px target.
- Neighbouring blocks now keep their own full area. The old version lent their height away.
- `usePx` in `MorningView.tsx` reserves that room, so a morning still fits one screen at 390.

**Verification** (`hits.mjs`, elementFromPoint walked 1px at a time down the timeline)

| | Before | After |
|---|---|---|
| Breakfast / smoothie, 320 | 30px | 44px |
| Get ready (neighbour) | gave away 5–6px (47 of 52) | keeps 52 |
| Run grip | owned only its centre; 10px and 20px below went to Cool down | owns center, 10px and 20px below |

- After, at 390 the short blocks measure Out the door 45 · Cool down 46 · Blend smoothie 45. At 320 they measure 44 · 46 · 44.
- Fresh account (Breakfast chip, Final prep 10 min): every block is 44px or more at both widths.

**Screenshots**
- Before: `before_i11_2026-10-16_390.png`, `before_i11_2026-10-16_320.png`
- After: `after_i11_2026-10-16_390.png`, `after_i11_2026-10-16_320_full.png`, `after_i11_2026-10-14_*.png`

### 12. Week sheet (features/day + features/progress WeekSheet)

**Change**
- `WeekSheet` keeps the ring, the kept line, the streak ("5 of the last 8 weeks.") and the miles and runs stamps.
- The seven day rows are replaced by one "Open this week in Plan" row, which closes the sheet and pushes `/plan/week/<monday>`.

**Verification**
- Tap the hero's ring: the sheet shows the summary and the single row (44px).
- Tapping the row lands on `/plan/week/2026-10-12` with no sheet open.

**Screenshots**
- Before: `before_i12_week_390.png`, `before_i12_week_320.png`
- After: `after_i12_week_390.png`, `after_i12_week_320.png`, `after_i12_week_to_plan_320.png`

### 13. Month info button (features/plan)

**Change**
- The floating (i) disc is gone.
- The month's header row reads "Tap a week to open it" with a small blue text link, "Legend" (a 44px target, `aria-expanded`). It opens the legend under it and then reads "Hide legend".

**Verification**
- `.mg-info` count is 0. The link box is 57×44 at both widths.
- The legend expands with page overflow 0.

**Screenshots**
- Before: `before_i13_month.png`
- After: `after_i13_month.png`, `after_i13_legend_open_390.png`, `after_i13_legend_open_320.png`

### 14. Saved link with no title (features/reads)

**Change**
- New `packages/shared/src/links.ts` with `linkTitleFromUrl`, `isAddressTitle` and `linkTitle`, plus tests.
- The title is the domain plus the path's last readable segment, decoded with its extension removed: "nytimes.com · the-quiet-mile". Ids, hashes and numbers are skipped; with nothing readable, the domain alone.
- The server stores that name for a page with no title (`extractMeta` and `readPage` in `services/reads.ts`; tests updated).
- The app shows it for older rows whose stored title is only the address. Those rows' meta line then leaves the site out ("TODAY", not "NYTIMES.COM · TODAY").
- The same names apply in the edit sheet, Today's pick and Library's Reads row.

**Verification**
- Two links added to unreachable hosts:
  - Before, the stored and shown titles were "nytimes.invalid/2026/10/12/well/the-quiet-mile.html" and "runnersworld.invalid/training/the-long-run".
  - After, they show "nytimes.invalid · the-quiet-mile" and "runnersworld.invalid · the-long-run". The second was stored by the old format (forced with SQL) and is still shown pretty.

**Screenshots**
- Before: `before_i14_reads.png`
- After: `after_i14_reads.png`

### 15. Signed-out cold open (app/ + auth)

**Change**
- `GET /api/auth/status` adds `signedIn`, checked quietly from the session cookie (`hasLiveSession` in `auth.ts`). It is always a 200.
- `Authed` (`App.tsx`) asks for the status first (query `auth-session`: never persisted, gcTime 0) and holds `/bootstrap` (`useBootstrap({ enabled })`) until it knows.
- Signed out: it redirects to `signedOutHome()` (/start, or /login on a device that has had an account) and drops what the cache remembers.
- Offline, or with an older server, it carries on as before.
- When something is cached it still paints from the cache at once.
- `platform.test.ts` covers `signedIn` false and true.

**Verification**
- `cold.mjs` and `sweep.mjs`: `/`, `/today` and `/plan` signed out at 390 and 320 redirect to /start.
  - Before: `401 /api/bootstrap` with "Failed to load resource … 401" in the console.
  - After: console `[]` and no response ≥ 400.
- The whole sign-up and onboarding walk is console-clean.

**Screenshots**
- Before: `before_c0_cold_today_390.png`
- After: `after_c0_cold_root_390.png`, `after_c0_cold_today_320.png`

### 16. Shared title flight (ui/Sheet)

**Change**
- The flight now rides the sheet's own spring:
  - Until the sheet's title row is on screen, the flyer sits on the opener.
  - From then on `fly` = the sheet's remaining rise over what was left when the row came on screen.
- The flyer moves straight from the opener to the title's resting place and lands on the frame the sheet settles.
- The flyer no longer runs on its own `springs.page` timeline. Before, it reached its spot about 190ms before the slot, overshot it by 10px and floated above the empty slot.
- Past rest (the spring's last pixel) it moves with the sheet. Closing is unchanged.

**Verification**
- `motion.mjs 16` logged a rAF frame log, Plan row "Easy 4" → sheet.
- Before: the flyer reached its final y (503) at about 245ms and overshot to 513 while the slot was still 43px below. The gap reached 0 at 437ms.
- After: the flyer rises monotonically 467 → 517. The gap closes in step with the sheet (85 → 37 → 8 → 1 → 0) and reaches 0 at 473ms, as the sheet settles. There is no overshoot.

**Screenshots**
- After: `after_i16_flight_end.png`
- The frame logs are printed by `motion.mjs`. Screenshots are too slow to catch individual frames.

### 17. First Morning entry blank frame (app/)

**Change**
- In `App.tsx`, the views are created with `view()`, which has a `preload()`. Once a module is in, the view renders its component directly, with no `React.lazy` suspend. Which component a mounted view uses is fixed at mount, so it never remounts.
- Morning, Reads and Settings preload in the frame after the first paint (`requestAnimationFrame` → `setTimeout 0`).
- The other views preload in idle time, as before.

**Verification**
- `preload.mjs` and `motion.mjs 17` recorded the frames of cold first pushes into Morning, including with every lazy chunk delayed by 600ms. There were 0 blank or fallback frames, and Morning's content appeared within 42–72ms of the tap.
- The chunks land before or right after Today's first paint: Morning at about 300ms, with Today painted at about 620ms.
- The critic saw the blank frame once in three runs. I could not reproduce it on this machine with the old build either (0 blank frames in 8 tries), so this change removes the cause (a suspend on the first push) rather than a measured symptom.

**Screenshots**
- After: `after_i17_slow0.png`, `after_i17_slow600.png`, `after_i17_first_push_80ms_run*.png`

## Gates

| Gate | Result |
|---|---|
| `pnpm -r --filter @logbook/shared --filter @logbook/api --filter @logbook/web exec tsc --noEmit -p .` | clean |
| `pnpm --filter @logbook/shared test` | 82 passed (new: `links.test.ts`, retired-name and smoothie cases) |
| `pnpm --filter @logbook/api test` | 56 passed |
| `pnpm --filter @logbook/web build` | passes |
| `pnpm --filter @logbook/web test` | 25 passed (new first-week verdict test) |

**Walk** (`sweep.mjs`; log `<S>/polish/sweep.log`; screenshots `sweep_*.png`)
- Routes: Today, Morning, Plan, Plan month, Progress, Journal, Library, Reads, Settings, Settings › Training, `/today/2026-10-11` and `/today/2026-10-13`.
- Each route was walked at 390 and 320, as the owner and as a fresh account.
- The owner at 320 ran with reduced motion.
- Signed out, `/`, `/today`, `/plan`, `/start` and `/login` were opened at both widths.
- **Result:** 0 horizontal overflow and 0 console messages.
- Compared with the old build, the only change in sub-44px elements is the Journal ribbon, which went from 14 to 0. The Morning short blocks count by drawn box, but their hit areas measure 44px or more (item 11).

**Fresh sign-up through onboarding to Today**
- Ran at 390 (`cold.mjs after 390`) and at 320 with the Breakfast chip (`cold.mjs after 320 568 breakfast`).
- No overflow at any step and a clean console.

## Notes

- Today's fake clock (`?at=` in `features/day/useNow.ts`) works only in dev builds (or with `VITE_FAKE_CLOCK=1`). The QA scripts therefore set the browser clock instead. Nothing was changed there.
- **Not changed, outside these items:**
  - The orb caption on today still says "5 to light" while the evening card says "5 habits to light." These are two components, not the same card.
  - `fly.toml` still lacks `ALLOW_SIGNUP` (verdict §6). That is a deployment setting, not part of this list.
