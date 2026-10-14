# Fix team D (fixd): Journal, Library, Reads, Settings, sign-up and onboarding

Pre-launch fix round against the critic's verdict (Journal 6.5, Library/Reads 4, Settings 6, sign-up + onboarding 7) and
QA's report. Server for this worktree: port 8834. Screenshots: `<S>/fixd/shots/` and scripts: `<S>/fixd/*.mjs`, where
`<S>` = `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad`. `before_*` shots were taken
at the start on this worktree; `after_*` at the end. 390×844 unless the name ends in `_320` (320×568).

**Contracts.** Contracts 1, 3 and 6 are not in this worktree's API. The UI is coded against the endpoints in
`fix-contracts.md`. I verified it two ways: (a) on 8834 with Playwright route mocks (`MOCK=1 node st.mjs`, shots
`*_mock*`); (b) **for real** against Fix A's in-progress API. That run used their worktree read-only on port 8835, with
this worktree's web build and a scratch copy of the seed DB (`<S>/fixd/serve-fa.sh`, then
`BASE=http://localhost:8835 node roundtrip.mjs`, shots `after_rt_*`). Export/import, rebuild + Undo and the name all
worked end to end against it (results below).

## Items → change → verification → screenshot

| Item | Change | Verified | Shots |
|---|---|---|---|
| **B1** ghosts with invented data | The Journal timeline ghost and the Library favourites ghost are now shapes only. They use `features/journal/Ghost.tsx` (`GhostLines`, `GhostCards`): grey bars at 60%/35% with no words, dates or domains. Fix A's `GhostRows/GhostLines` did not exist, so I built them in the feature. The Reads ghost rows are **deleted**. | Fresh account: Journal, Library and Reads show no text in any ghost (`j1.mjs`). | before/after `_fresh_journal_full`, `_fresh_library_full`, `_fresh_reads` |
| **B5** Library | The order is now Reads row → Favourites → Your quotes → **Themes**. Themes is a 2-column grid of 9 cards: serif name, count, and one line from the theme that changes each day. A theme with an odd count spans the row. Tapping a card opens a large sheet with that theme's quotes, shuffled per day (seeded Fisher–Yates), 20 at a time with **More**. Tapping a quote there pushes its sheet. Search sits behind a magnifier in the header (TabHeader accessory, Library segment only) and opens a search sheet. The total count, the chip row and the A–Z list are gone. New hooks `useQuoteThemes` and `useThemeQuotes` live in the journal block. | The theme sheet has 20 rows, then 40 after More. Search for "courage" returns results. No overflow, no targets under 44px at 390 or 320 (`j1.mjs`). | before/after `_owner_library_full`; `after_owner_theme_sheet`, `after_owner_search`, `_320` |
| **B11** memory card | The card shows only entries **≥ 14 days old** that are **not among the newest 8** (`memoryPool`). That is stricter than "first 5": with one-line entries at 390×844, row 6 sits on the same screen as the card, and this keeps the rule "never twice on one screen". It uses the server's daily memory when it qualifies, else the day's pick from the pool. With nothing eligible, the card is not shown. Shuffle cycles the pool. | The seeded account with 12 entries shows "Six weeks ago…", not in the first 8. After a swipe it shows "A month ago…", also not in the first 8 (`j2.mjs`). The owner (2 entries, 3 and 9 days old) now gets no card, so "Legs felt heavy" is no longer shown twice. | `after_mem_journal_full`, `after_mem_swipe_*`, `after_owner_journal_full` |
| **Polish 9** quote shuffle | `useSlideSwap` in `gestures.ts` works like a pager. The swiped line keeps going in the swipe direction from where the finger let go. The next quote replaces it only once it has gone, then enters from the other side. The two never overlap and there is no cross-dissolve. The memory card uses the same motion. Reduced motion: no travel, a 150ms fade. | Frames at +50/120/220/400/800ms show exactly one `.qline-in` at a time: x = −336 → −357 (leaving) → +284 (entering) → 0. The menu path "Another quote" works with reduced motion. | `after_quote_drag`, `after_quote_swipe_*`, `after_quote_reduced_80` |
| **Polish 13** Reads empty | With nothing saved, the page shows one sentence ("Save links and Logbook finds you one a day.") and **Paste a link** (primary). The field shows only if the clipboard has no link, or from the header **+**. The pick hero shows only when a pick exists, with no slim card. The Unread/Read control shows only once something has been read. | The switch count is 0 with 2 unread links and 1 after marking one read (`reads2.mjs`). | `after_fresh_reads`, `after_reads_unread_only`, `after_reads_with_switch` |
| **D-X1** targets | Ribbon: it bleeds to the screen edges, each day's whole column (56px tall) is its button, and nothing clips it. Columns are 27px wide at 390 and 22px at 320; fourteen days cannot each be 44px wide, so the full-height column plus the scrub is the target. Library chips are gone. The Haptics switch is now a 51×44 button with the track drawn inside. Habits **Restore** and Reads **Save/Skip/Next** have a minimum of 44px. | `smallTargets()` finds nothing under 44 on Library, Reads or Settings. The only hits are the 1px visually hidden ContextMenu a11y buttons. Pick verbs measure Save 85×44, Skip 61×44, Next 83×44. | `after_owner_journal`, `after_reads_pick_next` |
| **B6** Settings training | `useTrainingProfile` now reports a `source`. **stored**: the section is "Training" with Starting miles / Run days / Long run from `user.trainingProfile`. **block**: there is no profile, or a newer block. The section becomes **"Your current block"**: This week (planned miles of this week of the active block), its run weekdays, and its long-run day (from `deriveThisWeek`). **none**: a "Build a plan" row and no defaults. Editing on Training → Rebuild writes the profile (PATCH /me/training). The miles note says where the number came from. | The owner now sees "Your current block: This week 26 mi · Mon Tue Fri Sat Sun · Sunday", which matches Plan. Before, it showed 11 mi · Tue·Wed·Fri·Sat. A fresh account sees "Training: Starting miles 18 · Tue Thu Sat Sun · Sunday". | before/after `_owner_settings_full`, `after_st_owner_training_mock` |
| **D-S2** Rebuild | `useRebuildPlan` reads contract 1's `replacedIds`/`endedBlock` and patches the bootstrap at once (old block ended at startDate−1, new block in). The toast reads "Half marathon · 12 weeks: 58 runs from Mon, Oct 19." with **Undo**. Undo calls `useUndoRebuild` → `POST /plans/template/undo`, restores the previous answers and toasts "Plan restored.". | **Real (Fix A API):** the old block `bsi5…` ends 10-18 and the new `bRo1…` starts 10-19, with no overlap. A second rebuild creates `b9DG…`; Undo brings back exactly `bRo1…` and removes `b9DG…`. Plans lists the new block. | `after_rt_rebuilt`, `after_rt_plan_after_rebuild`, `after_rt_undone`, `after_st_rebuilt_toast_mock` |
| **D-S1 / D-S3** Export/Import | Export calls `GET /export` and saves `logbook-YYYY-MM-DD.json`. On a server without it (404/405), it falls back to the old gather, now reading the journal at the server limit of 500 (the old 100000 caused a 422). Import posts the file to `/import` and states the result in words ("8 to-dos, 2 journal entries…"). | **Real round trip:** the owner exports from Settings (version 2). A fresh account imports it from Settings, and per-collection counts added = owner's: habits 8, checks 8, blocks 1, sessions 67, activities 25, lifts 3, todos 8, journal 2, links 0. **counts match: true**. A second import changes nothing (idempotent). | `after_rt_exported`, `after_rt_imported`, `after_st_exported_mock` |
| **D-S4** Delete step 1 | Counts now come from the export (`GET /export`, fallback gather), not from cached months. The sheet shows a skeleton while counting, then sessions, habits, journal entries, to-dos and links. | Real: "67 sessions, 5 habits, 2 journal entries, 8 to-dos". That equals the export's non-deleted sessions (67) and non-archived habits (5). Before, it said 27. | `after_rt_delete1`, `after_st_delete1_mock` |
| **D-S5** Name | Settings → You has a **Name** row typed in place. It saves on Return or blur via `PATCH /me {name}` (`useSetName`, optimistic). The Settings hero eyebrow shows the name. The Settings and You headers pass `initialOf(user)` to the avatar. | Real: the server has `name: Robin`; the Settings avatar shows "R" and the eyebrow "Robin". **The tab headers still show the email initial**, because `ui/Avatar.useInitial` is foundation's code (see Requests). | `after_rt_named`, `after_st_you_name_mock` |
| Native "Add to Home Screen" | It was already gated on `!isNative`. The manual Safari instruction now shows only in iOS Safari. Desktop and Android show nothing unless the install prompt exists. | Simulated native app (Capacitor iOS bridge injected, API origin routed back to 8834): `isNative: true`, 0 "Add to Home Screen" rows, 0 Install rows. iOS Safari UA: the row shows (`native.mjs`). | `after_st_native` |
| **B7** first screen | New `/start` (`features/auth/Start.tsx`): the mark, the halo rising once, "Your day, lit.", **Start** → `/signup`, and an "I have an account" link (48px) → `/login`. `logbook.hasAccount` (`features/auth/flag.ts`) is set on any successful sign-in or sign-up and whenever a session boots. No session plus no flag goes to `/start`; no session plus the flag goes to `/login`. That is App.tsx's 401 redirect and `onUnauthorized` (routing lines only). Login says "Welcome back." only when the flag is set, else "Sign in.". Sign-up says "Make it yours." / "So your plan is here tomorrow." and goes straight to `/welcome/goal`. The old in-flow promise is removed, `/welcome` redirects to goal, and there is no Back before the first question. | Cold start → `/start`. Start → `/signup` → `/welcome/goal`, with the flag set. A returning device (flag) → `/login` "Welcome back.". A new device via "I have an account" → "Sign in.". | before/after `_cold_start`, `after_ob_start`, `after_ob_signup`, `after_ob_returning`, `after_ob_newdevice_signin` |
| **B9** routine chips | The morning step has "Before you leave" chips: Shower 15 · Breakfast 15 · Pack bag 5 · Coffee 5. Nothing is preselected. The base is Get ready 25 + out the door 10. The total shows live, and the verdict and timeline use the routine. On payoff, the routine goes in the `/me/onboarding` body (`routine`, additive type) **and** is written with `PATCH /morning/settings` (`after.shower/ready/smoothie/prep`, `showerAt = leave − total`), because the server's zod schema strips unknown keys today. | All 4 chips → bootstrap `after = {shower 15, ready 25, smoothie 20, prep 15, showerAt 7:15}`, wake from the fix chip. | `after_ob_morning`, `after_ob_morning_chips(_full)`, `_320` |
| **Polish 14** payoff | Rows have a tabular weekday column (34px three-letter track + 22px right-aligned date: "MON 19", not "MON19"). The chosen long-run day is marked **LONG** with a lit weekday. Once contract 7 lands, the stamp itself reads "Long 7" and the tag drops itself. When the morning step is **Tight**, a one-tap "Wake 6:10?" chip appears (or "Leave …?" when the earlier alarm would be before 4:00). | "Tight: … 16 min" shows **Wake 6:10?**; tapping it gives "Out the door 6:25. An easy 4 has you back by 7:11." The payoff shows "SUN 18 EASY 5.5 LONG". The distances vary once Fix A's `buildTemplate` (contract 7) is merged; this worktree's template still gives 4× 5.5. | `after_ob_morning_fixed`, `after_ob_payoff(_320)` |
| Kept | The composer, the ribbon (scrub, dots, letters), the questions by direct manipulation and the halo are untouched in behaviour. | Screens above. | |

Console was clean on every walk; the one exception is the browser's own network line for the expected 401 on a cold
start's `/bootstrap`. No horizontal overflow at 390 or 320.

## Hand-verifiable steps (8834, or 8835 for the contract items)
1. Open `/` in a private window. You land on "Your day, lit." Tap **Start** to reach "Make it yours.", create an
   account, and you land on "What are you training for?" with no back chevron.
2. On the morning step, tap Shower, Breakfast, Pack bag and Coffee. "Before you leave 75 min" and "Tight …" appear,
   then **Wake 6:10?**. Tap it and the verdict fits. Finish: the payoff shows "MON 19" aligned and Sunday marked LONG.
3. Sign out and reload `/`. You land on Sign in with "Welcome back.".
4. Owner → Journal → Library: Favourites, Your quotes, Themes (2 columns, count and a line each). Tap Living to get
   20 quotes; More gives 40. Tap the magnifier to search.
5. Journal: swipe the quote line left. It leaves left, then the next one slides in from the right; they never overlap.
6. Settings (owner): "Your current block · This week 26 mi · Mon Tue Fri Sat Sun · Sunday".
7. On 8835: Settings → Export downloads `logbook-<date>.json`. In a new account, Settings → Import that file gives
   "Imported 8 habits, … 67 sessions …".
8. On 8835: Settings → Training, toggle Monday, tap Rebuild. The toast offers Undo, and Undo gives "Plan restored.".
9. Settings → You → Name "Robin" and Return. The Settings avatar shows R.
10. A fresh account's Reads: one sentence and Paste a link. Nothing else.

## Critic and QA items for these pages
- B1, B5, B6, B7, B9 (chips; the server default is contract 7's), B11: **Fixed** (above).
- Polish 9, 13, 14: **Fixed**. The distances in polish 14 come from contract 7.
- QA D-S1, D-S2, D-S3, D-S4, D-S5: **Fixed**. D-S5's tab-header avatar is a request (below).
- QA D-X1 (journal, settings, reads parts): **Fixed**. The ribbon columns can't be 44 wide; they are full-height (56) full-column targets with scrub.
- Lower-priority note "Add to Home Screen inside the native app": **Fixed / verified** (already gated, now also iOS-only on the web).

## Requests for other teams
- **Foundation / Fix A (`ui/Avatar.tsx`)**: change `useInitial` to prefer the name (contract 6), so the tab headers'
  avatar follows it:
  `return (override ?? (boot.data?.user.name?.trim() || boot.data?.user.email) ?? '').trim().charAt(0).toUpperCase() || '·';`
  (`Bootstrap.user.name` is already in `api/types.ts`).
- **Fix A (`/me/onboarding`)**: accept the optional `routine: { shower, ready, smoothie, prep }` the client now sends,
  and compute `showerAt` from it. Until then the client writes it with `PATCH /morning/settings`, which works.
- **Fix A / Morning (`buildMorning`)**: skip any 0-minute back-home block, not only `smoothie`. A routine without the
  Shower chip has `shower: 0`, as contract 7's defaults do.
- **Fix A (`/import`)**: `imported` counts every row it touched, so a second import says "Imported 67 sessions" though
  nothing changed. Counting only rows actually inserted would let the UI say "Nothing new".
- **Plan**: an ended block and the new one share a name ("Half marathon · 12 weeks", "Oct 15 – Oct 18 · 1 weeks").
  Consider naming or hiding a block that was ended by a rebuild.

## Files
- `features/journal/`: `JournalHome.tsx` (quote pager, memory pool, shape ghost), `Library.tsx` (themes grid, theme
  sheet, search sheet, shape ghost), `JournalView.tsx` (search accessory), `gestures.ts` (`useSlideSwap`), `Ghost.tsx`
  (new), `journal.css`.
- `features/reads/`: `ReadsView.tsx` (empty state, add field behind +, switch only once read), `TodaysPick.tsx`
  (`heroOnly`), `reads.css` (44px verbs).
- `features/settings/`: `SettingsView.tsx`, `TrainingPages.tsx` (Name row, rebuild toast + Undo), `account.tsx`
  (`/export`, exact counts), `useProfile.ts` (`source`), `parts.tsx` (`initialOf`), `settings.css`.
- `features/onboarding/`: `Welcome.tsx` (routine chips, Tight fix chip, payoff rows; no in-flow promise), `model.ts`
  (`deriveThisWeek`, routine helpers), `onboarding.css`.
- `features/auth/`: `Start.tsx` (new), `flag.ts` (new), `AuthScreens.tsx`, `auth.css`.
- `app/App.tsx`: the `/start` route, and the signed-out redirects (`signedOutHome`), plus `markHasAccount` on boot.
- `api/queries.ts`: journal block (`useQuoteThemes`, `useThemeQuotes`, `seedOf`, theme lists answer `quotePrefs`). Growth
  block (`useRebuildPlan` with contract 1, `useUndoRebuild`, `useSetName`, `fetchExport`). `api/types.ts`: additive
  (`user.name`, `TemplateApplied.replacedIds/endedBlock`, `ExportBundle`, `OnboardingAnswers.routine`).

Gates: `tsc --noEmit` (shared, api, web) clean · shared tests 66 passed · api tests 40 passed · web build OK.
