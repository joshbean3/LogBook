# Today rebuild: review notes (team: today)

Spec: docs/experience.md §5.1. Inputs: consumer research §2.2, §3, §5; audit §2.1; platform `dayPhase` / `sessionWord` / `weekSummary` / `weekStreak`.

## What Today is now, top to bottom

1. **TabHeader**: caps date line ("WED, OCT 14"), the day's serif word (the lead session's type: *Speed*, *Easy*, *Strength*; *Rest*; *Run* for a run off the plan; *Today* while loading and on the first day), avatar. Tap the date line → calendar sheet; swipe the date line → previous/next day; a "Today" chip only when off today. No gear, no arrows, no stat strip.
2. **The hero** (aura card inside `DatePager`, swipe for other days). Content follows `dayPhase` with the page clock (`?at=HH:MM` in dev builds):
   - *morning*: session stamp as label, "Out the door in 22 min" (serif 28, the number is a `Ticker`, re-read each minute), mini timeline wake → door → back → leave with a now dot and the four times. Tap the timeline or pull the hero down → push `/morning`.
   - *out*: "Back by 8:22" + door→back progress line with the now dot.
   - *day, done*: the route drawn once a day per run (`useFirstToday('route-<runId>')`), "5.0 mi at 8:16. Logged.", stamps DISTANCE · PACE · TIME ticking once, Share pill → ShareSheet. Marked by hand without a run: "Done. Logged." + plan line.
   - *day, not done*: big session stamp, plan line (miles · details · floor), the **hold-to-complete ring** (400ms fill, `haptics.success()`, marks done, halo boost; a quick tap opens the session sheet; Enter/Space completes).
   - *rest*: "Rest. It counts." + the next session ("Next: Easy 4, Friday.").
   - *evening*: the hero becomes **Close the day** (below).
   - *past / future*: quieter: weekday eyebrow, ink-2 stamp, "Missed. The week still counts." / "Skipped to recover. It counts for the week." / plan line + "Out the door 7:30." for a future day.
   - Two training sessions: the hero pages between them (scroll-snap, dots, `haptics.select()` per page); the date pager is disabled on that day and the date line still swipes.
   - Halo classes are state-driven: `halo-done | floor | missed | upcoming | rest`, `halo-boost` for 600ms on a completion or a run landing.
   - **WeekRing** (40px) in the corner → week sheet: ring 64, miles vs plan bar, the streak in weeks ("5 of the last 8 weeks." / "3 weeks in a row.", never a zero), seven day rows with `dayWord` and miles; a row goes to that day.
   - Hold the hero → ContextMenu: Open, Done, Floor, Skip (Undo), Not feeling 100% (`sick`, Undo), Move, Share, Morning, Add a session.
   - **Strava arrival while open**: a new run on today → route draws, numbers tick, `haptics.success()` once.
3. **Habit orbs** directly under the hero (`features/habits/OrbRow`). Up to six share the width, more scroll with snap. Tap lights (`springs.complete` velocity pop to ~1.12, glow bloom via CSS, `haptics.orb()`); unlight `haptics.toggle()`. The last one lit: every orb pulses left to right 40ms apart, the caption reads "All lit.", one `haptics.success()`. Hold (300ms, `haptics.lift()`) then slide → reorder (the reviewed `useHoldDrag` + `Reorder` path, `haptics.drop()` on a changed order); hold and let go → ContextMenu (Note, Details, Move left, Move right, Archive). Shift+F10 / ContextMenu key / right-click open it; Alt+←/→ moves; 1–9 still toggle. Trailing "+" orb → inline field with starter chips (Sleep 7 h, Stretch, Read, Protein, No phone in bed; existing ones hidden).
   - **Habit sheet** (Details; the orb name travels in as `habit-<id>`): last-30-days count, streak (or last 7 days when the streak is under 2), a 6-column 30-day grid you can tap to fix a day, notes from the last 30 days, rename, Archive with Undo.
   - **Note sheet**: title = habit, eyebrow = day, field, Save.
4. **To-dos** (`features/todos/TodayTodos`): "To-dos" + quiet count; edge-to-edge list of the top 3 Today items on `SwipeRow` (→ Done with Undo, ← Later "Moved to tomorrow" with Undo), ContextMenu (Done, Later, Someday, High/Clear priority, Edit, Delete with Undo). Tap the square: fill + check, strike, 700ms beat, collapse (`rowPresence`). Tap the words → TodoSheet. A "+2 more · Later 3 · Someday 1" row opens the full list sheet (large detent) with the reviewed TodoGroup (hold-to-reorder, folds, provisional ids, Move up/down in the pushed editor). Quick-add with the parsing hint under the rows.
5. **Close the day** (the evening hero, and at the end of the page after 18:00 when the hero is still a morning/out state, and on past days as "The day"): stamped row MI · HABITS · TO-DOS in words when nothing happened (Rest / None / Not yet / Clear / All lit), every still-open session with its hold ring, the day's entries, the Journal team's `Composer` with a placeholder from the day ("Speed 5 done, 5.0 mi. How did it feel?", "Easy 6 slipped. What got in the way?"), "Share the day" once an entry exists (ShareSheet with the entry as the bubble line; route/stamp when there are miles), and `<TodaysPick compact />` only when a pick exists.
6. **First day**: when today has no runs, no journal, and no habits or no plan in the three weeks around it, the hero is replaced by one **Set up your day** card: Add habits (sheet of starter chips) · Plan a week (→ /plan) · Connect Strava (→ /settings, only when the Strava feature is on). Each step ticks itself off.
7. **Pull to refresh = check Strava now** (`useStravaPull`): the Shell's pull invalidates the bootstrap; Today hears that invalidation (or a `logbook:refresh` event) and calls `POST /strava/sync` (at most once per 30s) via `useStravaCheck` in my queries block; when anything changed the months refetch and the hero's arrival path plays the one Success. Nothing plays when nothing arrived. A failure toasts "Couldn't reach Strava. Trying again when you're online." with `haptics.error()`.

Removed: the gear, ‹ › arrows, the stat strip, the separate Training section (second sessions page in the hero; Add a session is in the hero's menu and the first-day card), `StravaLine`, the daytime journal composer, the habits Edit mode (rename/archive moved to the habit sheet, reorder stays on the orbs).

## Files

| File | Why |
|---|---|
| `apps/web/src/features/day/DayView.tsx` | Rewritten page: header, pager+hero, orbs, to-dos, close the day, first-day card, skeleton. |
| `features/day/Hero.tsx` | The time-aware hero, faces per phase, session paging, context menu, pull-to-Morning, arrival detection. |
| `features/day/HoldRing.tsx` | Hold-to-complete ring. |
| `features/day/MiniTimeline.tsx` | Four-stop morning line and the out progress line. |
| `features/day/WeekSheet.tsx` | Hero week ring, week sheet, calendar sheet. |
| `features/day/CloseDay.tsx` | Close the day card (composer placeholder, Share the day, Today's read). |
| `features/day/SetupCard.tsx` | First-day card. |
| `features/day/dayWords.ts` | Pure copy helpers (title word, verdicts, week headline, streak line, ring statuses). |
| `features/day/useNow.ts` | Minute clock, `?at=HH:MM` in DEV or `VITE_FAKE_CLOCK=1` builds only. |
| `features/day/useStravaPull.ts` | Pull to refresh → Strava check. |
| `features/day/day.css` | All Today styles (old orb/edit styles moved out). |
| `features/habits/OrbRow.tsx`, `HabitSheet.tsx`, `habits.css` | New: orbs (moved from DayView), habit details and note sheets, archive with Undo. |
| `features/todos/TodayTodos.tsx` | New: top-3 list. |
| `features/todos/TodoList.tsx` | `TodosSection` → `TodoListSheet`; `QuickAddField`, `useTodoActions` exported; left swipe = Later for Today rows (Delete elsewhere); haptics migrated. |
| `features/todos/TodoSheet.tsx` | Pops back when pushed from the list; haptics migrated. |
| `features/todos/todos.css` | Top-3 list, list sheet, amber Later pane. |
| `apps/web/src/api/queries.ts` | `// ── today ──` block: `useStravaCheck`. |

Haptics: every `haptic(...)` in day/, todos/, habits/ is gone (`grep "haptic(" features/{day,todos,habits}` is empty).

## Hand-verifiable steps

Serve with the seed DB (josh@example.com / password123). For time states build with `VITE_FAKE_CLOCK=1 pnpm --filter @logbook/web build` and add `?at=HH:MM`. The seed has nothing planned on Oct 14; add a run for today (Plan → add, or hero menu → Add a session: Speed 5) to see the training states.

1. `/today?at=06:50` with Speed 5 today → header *Speed*; hero "SPEED 5 / Out the door in 40 min", timeline 7:15 · 7:30 · 8:22 · 9:30 with the dot at the start. Tap the timeline → `/morning`. Back, pull the hero down ~60px → one threshold tick, `/morning`.
2. `?at=07:50` → "Back by 8:22", dot about 38% along the line.
3. `?at=11:00` → big SPEED 5 stamp, plan line, ring with HOLD. Hold it ~0.5s → ring fills, pops, Success; hero becomes "Done. Logged." (no sheet opens). A quick tap on the ring opens the session sheet.
4. Hold the hero → menu with Open / Skip / Not feeling 100% / Move / Morning / Add a session (Done/Floor when open).
5. Tap the week ring → week sheet: "31 mi planned.", e.g. "5 of the last 8 weeks.", seven rows; tap Fri → `/today/2026-10-16`.
6. Tap the date line → calendar; tap a day → goes there; "Today" chip returns.
7. Swipe the hero left → tomorrow slides in (select tick); right → back.
8. `/today/2026-10-11` → *Easy*; hero "SUNDAY / EASY 6 / Missed. The week still counts." with two dots; swipe inside the hero → STRENGTH; the hero never says Floor for Easy 6 (audit §2.1).
9. `/today/2026-09-08` → *Run*; BONUS RUN, route, 6.0 mi at 7:57, stamps, Share; "The day" card below.
10. Orbs: tap Meditate → pop + glow, caption "1 of 5 lit". Light all five → pulse along the row, "All lit.", one Success. Hold an orb and let go → menu (Note, Details, Move left/right, Archive). Hold and slide → reorders. Details → habit sheet; tap a day cell to fix it; Archive → toast with Undo. "+" → field and chips.
11. To-dos: add "Call the bank fri !!" (hint "HIGH · OCT 16", lands in Later), add four more → three rows + "+N more · Later 1". Swipe a row right → Done + Undo; left → "Moved to tomorrow" + Undo; hold → menu; tap the square → strike and fold after ~0.7s. Tap "+N more" → full list sheet; tap a name → editor pushed inside; Save/Cancel pops back.
12. `?at=19:30` → hero is Close the day: MI "Not yet" (or miles), HABITS, TO-DOS in words, the open session with its ring, composer placeholder from the day. Save an entry → "Day, closed.", "Share the day" → share sheet on the Bubble card with your sentence.
13. Pull to refresh on Today with Strava connected → sync request; a new run draws in the hero with one Success; nothing when nothing arrived.
14. Sign up a fresh account (ALLOW_SIGNUP=1) → `/today` shows "Set up your day" with Add habits / Plan a week (/ Connect Strava); adding starters ticks the first step and the orbs appear.

Playwright checks run at 390×844 and 320×568 (touch, DPR 2), and once with reduced motion: no horizontal overflow on any state; console clean (only the blocked service-worker warning from Playwright itself); targets ≥ 44 (chips are 32 to the eye with the primitives' 44 hit area; the TabHeader date line is the foundation's).

## Audit §2.1: every item

| Audit item | Status |
|---|---|
| Fixed stack of nine sections, ignores time of day | Fixed: time-aware hero driven by `dayPhase`. |
| Hero repeats the Training row (duplication) | Fixed: Training section removed; the hero is the session; second sessions page inside it. |
| Contradiction FLOOR vs MISSED (Oct 11) | Fixed: hero words come from `dayPhase` (`sessionWord` per session); verified on Oct 11 ("Missed"). |
| "OPEN / OPEN"; Today vs Morning vocabulary | Fixed: an empty day reads Rest everywhere ("Rest. It counts."). |
| Unplanned runs BONUS vs DONE | Fixed on Today (Bonus); the unplanned sheet is the sessions team's. |
| Stat strip of three dead numbers, "0 days" streak | Fixed: removed; the week lives in the ring + week sheet, streak in weeks, never zero. |
| Journal head "Journal" link beside the label | Fixed: daytime journal section removed; Close the day has no link. |
| Habit management inline (edit mode) | Fixed: edit mode removed; habit sheet holds rename/archive; reorder stays on the orbs. |
| Off-today "Today" link 15px and moving | Fixed: "Today" chip in the header accessory. |
| Empty-day hero looks pressable but isn't | Fixed: a rest hero is not pressable (no press scale); its menu offers Add a session. |
| Stat tiles dead | Fixed (removed); the ring opens the week. |
| Orb toggle fires no haptic | Fixed: `haptics.orb()`, `toggle()` off, `success()` for all lit. |
| Orb note invisible, dashed input with no title/Save | Fixed: Note is in the orb menu and opens a titled sheet with Save; the warn dot stays as the cue. |
| Session row with four gestures, no cue | Fixed on Today (row removed); hero hold ring shows "HOLD"; every hero action is in its menu. |
| To-do swipe directions invisible; delete by swipe | Fixed: SwipeRow panes with icons and labels, right Done / left Later, every action in the menu; delete only via menu/sheet with Undo. (A first-use nudge is not built: see requests.) |
| Two Add buttons 60px apart | Fixed: one Add a session (hero menu / first-day card). |
| Day arrows re-render instantly; no swipe between days | Fixed: DatePager on the hero, swipe on the date line, calendar sheet. |
| Re-tapping Today does nothing | Fixed by the Shell (foundation); Today needs no own state. |
| Habit ✕ archives with no Undo | Fixed: Archive always with an Undo toast. |
| Nine identical blocks, flat rhythm, same blue bloom on missed | Fixed: hero card, a row of orbs, an edge-to-edge list, one inset close card; state-driven halo. |
| Hero title face switches stamp/serif by data | Fixed: the session is always a stamp label; the serif is always the sentence. |
| Share pill heavier than chip; eyebrow wraps at 320 | Fixed: one Share pill under the stamps; no chip next to it; checked at 320. |
| Orb names wrap ("Read 15 / Min"); a sixth habit overflows | Fixed: names clamp to two lines inside an equal column; more than six scroll with snap. |
| Completed to-dos not struck; duplicates as noise | Fixed on Today: a checked row strikes, waits, collapses; completed live in the list sheet's fold. |
| First-timer: five grey empty states | Fixed: one Set up your day card. |
| 6:30am: timeline is on another tab | Fixed: mini timeline in the hero, one tap/pull to Morning. |
| 9pm: habits 1 screen down, composer 1.6 screens | Fixed: orbs right under the hero; the evening hero is the composer. |
| Weather | Rejected: no data source; out of scope. |
| Training empty state promises "build a plan" | Fixed: copy gone; Plan a week links to Plan, where the template builder lives. |

## Contracts

- **Relies on**: `dayPhase`, `sessionWord`/`heroSession` (via `dayPhase`), `weekSummary`, `weekStreak`, `dayKey`/`dayWord` (packages/shared); `useOpenSession`, `shareDataFor`, `UnplannedSheet`, `sessionSheetTitle`, `SessionEditor`, `openMoveSheet` (sessions); `Composer`, `EntryItem` (journal, import only); `ShareSheet` (share, uses its existing `initial` prop); `TodaysPick` (reads); every foundation primitive.
- **Session opener**: the hero calls `openSession(date, s, { fromHero: true }, { sharedId: 'session-<id>' })` and marks its stamp with `{...shared('session-<id>')}`. The fourth argument is not in this worktree, so the call carries `// @ts-expect-error until sessions adds sharedId`; once the Plan team's opener lands, delete that comment (tsc will flag it as unused).
- **Provides**: `features/habits` (`OrbRow`, `HabitSheet`, `HabitNoteSheet`, `useOpenHabit`, `useArchiveHabit`, `HABIT_STARTERS`) for Settings → Habits; `TodoListSheet`, `QuickAddField`, `useTodoActions` from todos; `useStravaCheck` in queries; shared ids `habit-<id>` (orb name) and `session-<id>` (hero stamp).

## Requests for other teams

1. **Journal**: give `Composer` a `placeholder?: string` prop. Today sets the day's prompt on the textarea from outside (a layout effect in `CloseDay.tsx`), which works but is a workaround.
2. **Sessions / Plan**: the `{ sharedId }` option on `useOpenSession` (contract above).
3. **Shell (foundation)**: fire a `logbook:refresh` window event when a pull to refresh commits (Today already listens). Today currently infers the pull from the bootstrap invalidation, which also fires on app resume; harmless (throttled to 30s) but indirect. Also remove the transitional `shell.css` rule that hid Today's old gear: Today now uses `TabHeader`.
4. **Share**: a day-card template for days without a run; the Bubble card's footer still prints "0.00 MI · —'—" · 0:00" when there are no miles.
5. **Foundation**: `SwipeRow` first-use nudge (research §3: "the first time a to-do appears, the row nudges 24px left and back") would teach the swipe once; not built here to avoid a second gesture implementation.
6. **Settings**: a Habits section can reuse `features/habits/HabitSheet` (`useOpenHabit`) for rename/archive.

## Screenshots

All under `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/today/shots/`.

- Before: `before-{today,oct11,sep08,oct13,oct16}-{390,320}[-full].png`
- Morning / out / day / evening (390): `b-s0-390.png` (morning), `b-combo.png` (out, day not done, evening), `st-morning-two-390.png`, `st-morning-two-page2-390.png`
- Hold to complete: `i-hold-mid-390.png`, `i-hold-done-390.png`
- Strava arrival: `arr-before-390.png`, `arr-landing-390.png`, `arr-after-390.png`, `arr-share-390.png`
- Orbs: `i-orb-lit-*.png`, `i-orb-menu-*.png`, `i-all-lit-*.png`, `st-habit-sheet-*.png`, `st-add-habit-*.png`
- To-dos: `i-todos-*.png`, `i-todo-swiped-done-*.png`, `i-todo-swiped-later-*.png`, `i-todo-menu-*.png`, `i-todo-checking-*.png`, `i-todo-sheet-390.png`
- Sheets: `i-week-sheet-*.png`, `i-calendar-*.png`
- Close the day: `st-evening-open-*.png`, `st-evening-saved-*.png`, `st-evening-share-*.png`
- Other days: `st-past-route-*.png`, `st-future-*.png`, `st-oct11-*.png`, `swipe-mid-390.png`
- First day: `setup-390.png`, `setup-habits-sheet-390.png`, `setup-after-390.png`
- 320×568: every `*-320.png`; reduced motion: `rm-*-390.png`
