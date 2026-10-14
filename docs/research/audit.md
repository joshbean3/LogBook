# Logbook UX audit, pre-redesign

Principal product design, October 14 2026. Build audited: the one running at `localhost:8790`, at 390×844 @2x on a touch device in Playwright, plus a read of `apps/web/src/features/*`. Companion to `docs/research/consumer-research.md`, which covers the benchmark apps and principles. This document covers what is on screen today and what is wrong with it, screen by screen.

**Screenshots.** Paths written as `shots/…` sit under `/tmp/claude-0/-home-user-LogBook/4a9c51c6-05c9-563f-8f15-fe013a7d02f8/scratchpad/audit/shots/`. The Playwright scripts that made them (`tabs.mjs`, `sheets1.mjs`, `sheets2.mjs`, `firstrun.mjs`, `extra.mjs`) are in the parent folder. The scratchpad does not last; re-run the scripts to get the screenshots back. Full-page captures show the fixed tab bar part-way down the image. That is an artifact of the capture; on a phone the bar stays at the bottom of the screen.

**Feature flags in the audited build:** `features.claude = false` and `features.strava = false`, and no heart-rate zones. So the plan builder, the coach's read, the Strava rows and the Effort section never show. The audit judges the app as a user without them would see it, and says where the flags change things.

---

## 1. Executive verdict

Logbook has a real brand: true black, the italic serif, stamped numerals, a route line that draws itself. It also has some unusually good interaction engineering, such as the drag-to-day and timeline drags. It still reads as bare-bones, because every screen is built from one module repeated top to bottom: a caps eyebrow, then a 20px-radius `#111` card. Today is nine of these, about 1,260pt tall (`shots/today-full.png`, `shots/today-oct11.png`). Journal and Trends are five each. Plan and Morning are a hero, a 7-day strip and a list. Nothing tells the eye where to start. The one hero per tab tends to repeat the row under it: "SPEED 5 / MISSED" in the hero, then "Speed 5 / MISSED" in the Training row (`shots/today_2026-10-13-full.png`). The things people actually tap every day (habits, journal, marking a session done) sit below the fold or inside a sheet. The page never changes with the time of day. At 6:30am and at 9pm the owner sees the same stack, so in both cases they scroll past what they don't need. Actions are mostly 15px grey text ("Add", "Edit", "Change", "Journal", "Reads", "Open", "Hide", "Shuffle"), placed like footnotes. Related views share no motion: the hero, its sheet and its edit form swap in place. Moving between days is an instant re-render, and a day cannot be swiped. Empty states are grey sentences in cards, the spec's own anti-pattern. A first-time user lands on six of them stacked (`shots/fr-today.png`).

**The five systemic causes**

1. **One section template for everything.** Each section is a `SectionHead` caps label (11px, ink-3) over a `Group` card (same radius, same surface, same 16px padding, same 32px gap). Habits, to-dos, training, the journal composer, empty states, the reads input and the settings rows all get the same visual weight. Even Today's hero is just this card plus a glow (`ui.css` `.group`, `.aura`). The layout recipes in `docs/design-spec.md §3` require it, and that requirement is where the monotony comes from.
2. **No hierarchy of jobs.** No page is ordered by how often, or how urgently, its parts get used. On Today the order is a session summary, then stats, then the session again, then to-dos, habits and journal. That is the order of the data model, not of the day. Each primary action carries the same weight as a tertiary one. In the session sheet, Done/Floor/Skip are small grey chips, while Delete is the most prominent button on the sheet (`shots/sheet-session-missed.png`).
3. **Actions are text links and hidden gestures.** About 25 actions are rendered as small ink or blue text (`.link`, `Button variant="quiet"`, `ChipButton quiet`). The good gestures can't be found without reading the source: swipe a to-do right or left, hold it to reorder, hold an orb to add a note, hold a session to move it, hold the wake block, drag the edge of the run block, scrub the consistency grid. None of them has an affordance, a hint or a first-use cue.
4. **No continuity between related views.** The only transitions are a 200ms CSS fade, and only when the *section* changes (`App.tsx` `PageFade` key is the first path segment), plus a bottom-sheet spring. Day to day, week to week, Week/Month/Plans, Plan/Settings on Morning, Entries/Favorites/Quotes, the 1M/3M/6M range, hero to sheet, sheet to Edit or Move: every one of these is an instant content swap.
5. **Empty space and zero-states instead of guidance.** Real numbers are mostly "0.0 of 26 mi", "0 days", "0 open", "0%" (`shots/today-fold.png`, `shots/plan-full.png`). Empty days get a 220pt hero card that says "OPEN" twice and can't be tapped. Settings and Reads are more than half blank (`shots/settings-full.png`, `shots/reads-full.png`). First run shows six grey sentences and no setup flow. Sign-up is closed once one account exists.

---

## 2. Page by page

The three walk-throughs on every page: **(a) the first-timer** who just created an account; **(b) the owner at 6:30am** deciding what to do; **(c) the owner at 9pm** logging the day.

### 2.1 Today (`/today`, `/today/:date`)

**Inventory, top to bottom** (CSS px at 390 wide; from `shots/today-fold.png`, `shots/today-full.png`, `shots/today-oct11.png`, `shots/today_2026-09-08-full.png`)

| # | Section | Size | What it shows | What you can do |
|---|---|---|---|---|
| 1 | `PageHeader` | 0–80 | 44px serif "Today" / "Yesterday" / weekday; long date; on other days, a quiet "Today" link | Arrows ‹ › step one day. Gear opens Settings. **Only Today has the gear.** |
| 2 | Hero `.aura` | 100–320 (≈ 400 with a route) | Eyebrow; status chip; title (a STAMP such as "SPEED 5" or "OPEN", or the serif run name); one-line verdict; 2–4 stamped stats; halo | Tap opens the session sheet, or the unplanned-run sheet. "Share" pill when there is a run. **Not tappable on an open day.** |
| 3 | `StatStrip` | 335–385 | WEEK "0.0 of 26 mi", STREAK "0 days", TO-DOS "0 open" | Nothing. They look like tiles but are dead. |
| 4 | `StravaLine` | — | Sync status (hidden with the flag off) | Sync |
| 5 | Training | head at 435 | `SessionRow`s (60px: check, tone bar, title, sub, stat or chip, chevron) and unplanned rows | Tap the check to mark done. Tap the body to open the sheet. Hold 300ms and move to drag onto a day (a week strip slides in). Hold 450ms without moving to open Move. Head "Add" opens Add session. The empty state has a second "Add". |
| 6 | To-dos | head at ~570 | Open items; quick-add input with parse hint ("HIGH · OCT 16", `shots/today-todo-typing.png`); Later / Someday / Completed folds | Swipe right to complete. Swipe left to delete. Hold to reorder. Tap the text to open the to-do sheet. Tap a square to check. |
| 7 | Today's pick | — | Only when there are saved links (none in the test data) | Open, Save, Dismiss |
| 8 | Habits | head at ~760 (**below the fold**) | 5 orbs of 56px, names wrapping to two lines, progress meter, "Add a habit" input | Tap toggles. Hold 300ms lifts: let go to get the note field, or slide to reorder. Head "Edit" switches to edit mode (grip, ↑, ↓, ✕ per row: `shots/today-habits-edit.png`). Number keys 1–9. |
| 9 | Journal | head at ~1,100 | The day's entries, then a composer (serif placeholder, Save as ghost text) | Type and Save. Tap an entry to open the entry sheet. The head "Journal" link goes to the Journal tab. |

**Real jobs**
- (a) First-timer: understand what this app is and set up a plan and habits. Today gives them "OPEN / Nothing on the plan. Add a session or let the day breathe." and then five more empty cards (`shots/fr-today.png`). Nothing explains the system: floors, plans, the morning timeline. The Training empty state promises "or build a plan", but with `claude` off, Plan → Plans only offers "Add a session". That copy points at a feature the user doesn't have (`DayView.tsx:586` isn't gated; the matching line in `PlanView.tsx` is).
- (b) 6:30am: What's the session, what's the floor, when do I leave? Can I swap or skip? On a planned day the hero verdict does say "Out at 7:30, back by 8:13". But the timeline itself is on another tab. Weather isn't anywhere. To skip or move the session takes a tap, then a sheet, then a small chip.
- (c) 9pm: mark the session (or let Strava do it), tick the habits, write two sentences, clear tomorrow's to-dos. Habits start about 1.0 screen down and the composer about 1.6 screens down. The day's hero, still showing the morning plan, takes up the first screen.

**Above the fold today vs what should be.** Today, above the fold: header, hero, three zero stats, the Training head, the session row that repeats the hero, and the top of To-dos. What should be there: one time-aware card (morning: the session plus a leave countdown and the timeline; evening: "Log the day" with session status, habits and a journal prompt), then the habit orbs, then whatever is next.

**Structural problems**
- **Duplication.** The hero and the Training row show the same session, status and plan. On `/today/2026-10-13`, MISSED appears three times (hero chip, hero verdict "Missed.", row chip) and "Speed 5" twice.
- **Contradiction.** On `/today/2026-10-11` (`shots/today-oct11.png`) the hero says **FLOOR · "Floor held."** for EASY 6, while the Training row for that same Easy 6 says **MISSED**. The hero shows the *day* status (`dayStatus`; the Strength session was done) under the *run's* title. Trust breaks right here.
- An "Open" day shows the same word as the title and the chip ("OPEN" / "OPEN"). The Morning tab calls the same day "Rest / A rest morning" (`shots/morning-fold.png`). Same day, two vocabularies.
- Unplanned runs show BONUS on the hero and DONE in their sheet (`shots/sheet-unplanned-run.png`).
- The stat strip is the week, a streak and a to-do count. These are three unrelated numbers, and the strip sits between the session hero and the session list, splitting one topic in two. A training streak of "0 days" shows on every screen in the test data.
- The Journal section's head has a "Journal" link next to the "JOURNAL" label: the label repeated as an action.
- Habits management (add, rename, reorder, archive) lives inline on Today, in an edit mode that turns the card into a form.
- On other days, the "Today" way back is a 15px quiet link beside the date, and it moves sideways with the date's length.

**Interaction problems**
- The empty-day hero looks like the pressable hero but does nothing. Its verdict says "Add a session", yet the card isn't the button.
- The stat tiles are dead: Week should open the week, To-dos should scroll to the list, Streak should open Consistency.
- **Habit orb toggles fire no haptic.** `Orb.onClick` → `toggle()` has no `haptic()`; only the hold-to-lift ticks (`DayView.tsx:189`). Brand §9.2 says completion gets "one haptic". The most frequent completion in the app gets none.
- The orb note is invisible until you hold. The only cue that a note exists is a tiny dot. The note opens as a dashed-underline input inside the habits card (`shots/today-orb-note.png`), with no title and no Save.
- A session row carries four gestures (check, tap, hold-drag, hold-still-to-Move) with no visual cue for the holds.
- To-do swipe directions are invisible. Delete by swipe-left has Undo, but nothing teaches it.
- Two "Add" buttons for one action, 60px apart: ink text in the head and a blue soft pill in the empty state (`shots/today-fold.png`).
- The day arrows re-render instantly, with no slide. There's no horizontal swipe between days, though the Journal and Morning pages both treat day-by-day browsing as normal.
- Re-tapping the Today tab does nothing (`Shell.go` returns early): no scroll to top, no reset to today from `/today/:date`.
- In habit edit mode, ✕ archives at once with no confirmation and no Undo, unlike session delete.

**Visual problems**
- Nine near-identical blocks with 32px gaps, so the rhythm is flat. The only accent is the hero glow, and it's the same blue bloom on a missed day as on a done day.
- The hero title switches face by data type: STAMP for plans ("SPEED 5", "OPEN"), serif for Strava names ("Afternoon Run"). Day to day, the hero looks like two different components.
- The Share pill (`.aura-share`, bordered, 44px) is heavier than the status chip next to it, and the eyebrow wraps at 320 (handled with `narrow`).
- Habit names wrap to two lines under the orbs ("Read 15 / Min", "Guitar 5 / Min"). Five orbs fill the row, and a sixth habit would overflow horizontally.
- Completed to-dos show as checked rows with grey text, not struck through, and duplicates read as noise ("Book physio" twice in the test data, `shots/today-completed-open.png`).

### 2.2 Morning (`/morning`, `/morning/:date`)

**Inventory** (`shots/morning-full.png`, `shots/morning-run-day.png`, `shots/morning-thu-full.png`)
1. Header: "Morning", "Today · Oct 14", arrows. A **Plan / Settings** segmented control sits under the title, so the page has two modes.
2. Hero `.m-aura` (147–347): eyebrow, duration caps ("2 H 15 MIN"), an "Edit" pill, a serif word (Run / Gym / Rest), a verdict, and 3–4 stamped times (WAKE, DOOR, BACK, LEAVE). Tapping anywhere on it opens the **Edit morning** sheet.
3. A 7-day strip (360–430) with tone dots. Tapping a day changes the date.
4. TIMELINE: an axis with 30-minute ticks. Blocks run 1.6px per minute (32px minimum): Wake up, Out the door, the run (lit, with a tone bar and a stamped "4 mi"), Cool down, Free (dashed), Shower, Get ready, Blend smoothie, Final prep, and a **white** "Leave for work" pill. Gestures: hold the Wake block and drag to shift wake-up in 5-minute steps. Drag the run block's bottom edge to change miles. Tap any block to open the same Edit sheet.
5. WORD & QUOTE: an empty state with "Add", or a word, quote and author with "Change". Edits inline as a three-field form (`shots/morning-focus-edit.png`).
6. Settings mode: 11 numeric inputs in three groups (Running, Workout, After), a Set time / After segmented control, and a blue "Reset" (`shots/morning-settings.png`).

**Real jobs**
- (a) Never opened by a first-timer without guidance, because nothing explains what Morning is for. The default settings (8:20 pace, 8:40 shower, smoothie) are someone else's morning.
- (b) This is the 6:30am page. It answers "when do I wake, when am I out, when must I leave". But it is a separate tab from the session it plans. Skipping the run means opening Edit and choosing Rest. The live "now" line shows only between wake and leave.
- (c) 9pm: set tomorrow's wake time and miles. That takes › to tomorrow, then hold-drag, or Edit then steppers. It works, but nothing suggests it.

**Above the fold.** Now: the hero (four times) and the week strip. The timeline starts at ~485 and is cut off by the tab bar after about five blocks. It should be the timeline itself, starting at the top, with "now" and the next block emphasised and the leave time pinned. The four hero times are the timeline's own block edges, so the hero is a duplicate. The prior research found the same.

**Structural problems**
- The hero repeats the timeline (WAKE 7:15, DOOR 7:30, BACK 8:13, LEAVE 9:30 are all timeline labels) and costs 200pt.
- The week strip is a copy of Plan → Week's strip, carrying the same tone dots.
- "Word & quote" is a second quote system. Journal already has a daily quote with Shuffle and Favorites, and the two never meet.
- Morning settings are a separate mode of this tab, while app settings sit behind a gear on Today. One copy line is wrong: "Usual length: Change it day by day on the **Plan tab**". It's actually changed in this tab's Edit sheet.
- A day with nothing planned shows as "Rest" here and "Open" on Today. A plan that says "Strength" becomes "Workout".

**Interaction problems**
- Three ways in to edit the same values (the hero tap, the "Edit" pill, a tap on any block), all opening the same sheet. Meanwhile the direct manipulation that's actually good (wake drag, edge drag) has no visible handle beyond a 24px grey bar on the run block.
- Tapping the dashed Free block opens Edit, which is a strange target.
- The Edit sheet (`shots/sheet-morning-edit.png`) has steppers with − and + at 44px, plus a sentence readout, and closes with a blue "Done". The readout sentence repeats what's behind the dimmed timeline.
- The Settings inputs save on blur, with no confirmation. Reset is blue text and wipes 11 values with no Undo.
- The Plan ↔ Settings swap has no transition, and the arrows disappear in Settings.

**Visual problems.** Every block is the same dark pill. Only the run block gets a tone bar. "Leave for work" is a solid white pill, the brightest object on the page (`shots/morning-thu-full.png`). The Wake up block is 15 minutes long but drawn at the 32px minimum, and so are the 5-minute blocks, so the time proportions drift from the axis. The settings page is a tax form: 11 equal rows with inputs on the right and helper text in 15px grey.

### 2.3 Plan: Week (`/plan`)

**Inventory** (`shots/plan-full.png`, `shots/plan-week-sat.png`)
1. Header "This week", "Oct 12 – Oct 18", arrows step a week. Segmented control: Week, Month, Plans.
2. A `DayAura` hero for the **selected day**: date caps, chip, serif weekday ("Wednesday"), stamped session ("THRESHOLD 6") with chips for other sessions, verdict, and **week** stats (MILES 0.0 of 26, HIT 0 of 7, HABITS 0%). Tap opens the session sheet.
3. A 7-day strip with tone dots. Tap selects a day. It's also a drop target for dragged rows.
4. SESSIONS: `SessionRow`s for the selected day, then an "Open" row that jumps to `/today/:date`.

**Real jobs**
- (a) See the plan that was handed to them. With no plan there's nothing to see, and no path to make one beyond adding sessions one at a time.
- (b) 6:30am: "What's this week look like, should I swap today and tomorrow?" The week is never visible as a list. You read it one day at a time, and only seven 6px dots show the whole week.
- (c) 9pm: check what's tomorrow and maybe move it. Same problem.

**Above the fold.** Now: one day's card plus the strip. Should be: the whole week as seven rows (day, session, miles, status) with the week's progress meter on top. Drag between rows to rearrange.

**Structural problems**
- The hero is a *day* card carrying *week* stats ("MILES 0.0 of 26" belongs to the week, not to Saturday). The scopes are mixed.
- The control (the strip) sits *under* the thing it controls (the hero), so selecting a day changes content above your thumb.
- The selected day repeats three times: hero ("THRESHOLD 6 · PLANNED"), strip, and row ("Threshold 6 · PLANNED"). "PLANNED" appears three times on one screen.
- The "Open" row's label means "go to this day on Today", but it reads as a dead word.
- The Week tab doesn't show a week, while Plans → "Next two weeks" does.

**Interaction problems.** Changing the selected day isn't animated. Neither are week ‹ ›. A future session can be marked "Done" from its sheet (`shots/sheet-plan-session-sat.png`). The empty state's "Add" and the head's "Add" are again two pills for one action.

**Visual.** A large empty area under the list. The empty-day hero is 220pt of "Wednesday / Nothing planned." and zeros (`shots/plan-full.png`).

### 2.4 Plan: Month (`/plan/month`)

**Inventory** (`shots/plan_month-full.png`, `shots/plan-month-sel.png`): header "October 2026"; segmented control; StatStrip (MILES 3.0 run, PLANNED 61 mi, HIT 2 of 6); a 6×7 grid of 44pt cells with up to three tone dots each (filled = done, ring = to do); a two-line legend (EASY, LONG, THRESHOLD, SPEED, LIFT, CROSS, TO DO); **then** the same `DayAura` hero; then SESSIONS.

**Jobs.** (b) and (c) want a block-level view: which weeks are heavy, where the long runs fall, what's been hit. The grid shows colours only. There are no miles per day, no weekly totals, no long-run marker.

**Problems**
- Tap a cell and the selected day's card renders 550pt down, half under the tab bar (`shots/plan-month-sel.png`). The response to the tap is mostly off screen.
- The legend takes 70pt every time, when it's needed once. Dots at 6px can't carry six families plus done/to-do state on a phone.
- No weekly totals column, though weekly mileage is the number runners plan by.
- The month swaps instantly, and there's no vertical swipe between months.
- The month header and the stat strip restate "Oct 1 – Oct 31" under "October 2026".

### 2.5 Plan: Plans (`/plan/plans`)

**Inventory** (`shots/plan_plans-full.png`, `shots/sheet-plan.png`, `shots/fr-plan_plans.png`): the subtitle "Your plans and the next two weeks."; the `PlanAura` hero (ACTIVE · WEEK 2 OF 11, the dates, a serif name over two lines, "Next: Easy 4, Friday.", WEEKS 11 / SESSIONS 66 / DONE 2 of 6), which opens the plan sheet; the PlanBuilder (hidden without `claude`); "Other plans" (hidden when only one); NEXT TWO WEEKS as 11 rows of caps date, dot, STAMP label and details.

**Jobs.** (a) Get a plan in: import, pick a template, or build one. Without the AI flag, the only option is "No plans yet. Add a session." (`shots/fr-plan_plans.png`). That's a dead end for a consumer. (b)/(c) See where they are in the block, what's next, and whether they're on pace.

**Problems**
- The plan sheet restates the hero's stats exactly (WEEKS 11, SESSIONS 66) and adds a summary and source line. "Open" jumps to the Week tab.
- Deleting a 66-session plan takes a confirm step and has no Undo, while deleting one session has Undo.
- The Next-two-weeks rows are tappable but have no chevron and no press state beyond the background. They show no done/missed state and no miles column. Their STAMP labels ("THRESHOLD 6") shout next to the 11px caps dates.
- There's no week-by-week view of the plan (volume curve, long-run progression), which is the thing a plan *is*.
- The serif title wraps to two lines at 44px ("2026.10 Banking / Plan").

### 2.6 Trends (`/trends`)

**Inventory** (`shots/trends-full.png`, `shots/trends-1m.png`, `shots/trends-6m.png`, `shots/sheet-lift.png`, `shots/fr-trends.png`)
1. Header "Trends", "Thirteen weeks, run and planned." Segmented control: 1M, 3M, 6M.
2. Hero: WEEKLY MILEAGE / LAST 13 WK; THIS WEEK 0.0 mi, PLANNED 26 mi, RUNS 0; "−12.2 MI VS AVG"; a 180px bar chart (run bars, the current-week bar in blue, outlined plan bars, a 4-week average line); and a legend. Tap a bar to pin a tooltip.
3. Effort check (hidden: no zones, no Strava).
4. LIFTS / 2 EXERCISES: rows with name, sessions, a sparkline, best set and EST. 1RM. Tap opens the lift sheet.
5. CONSISTENCY / LAST 14 DAYS: a TRAINING 40% / HABITS 30% strip, then a grid of 14 cells × (Training plus each habit), then a two-line legend. Press and scrub opens a day.

**Jobs.** (a) Nothing to see, and the empty chart draws axes 0–10 with no empty state (`shots/fr-trends.png`). (b) Rarely opened at 6:30. (c) At 9pm: "Am I on track for the block? Is my easy pace drifting? Is the long run building?" None of that is here. The page shows mileage, two lifts and a 14-day dot grid.

**Problems**
- **The range control only changes the mileage chart.** Lifts are all-time and Consistency is a fixed 14 days. Its subtitle ("Thirteen weeks…") changes, but the page below doesn't.
- 1M shows "LAST 4 WK" over a chart of 9 bars, 5 of them *future* plan outlines (`shots/trends-1m.png`). 6M is 60% empty bars before the first run (`shots/trends-6m.png`).
- The hero leads with "THIS WEEK 0.0 mi / RUNS 0" on a Wednesday. The headline is a zero and a red-feeling delta. A within-week progress meter against the plan would say the same thing without the failing grade.
- No pace, HR or easy-pace trend without Strava zones, no long-run line, no plan-adherence by week.
- The consistency grid's 12pt cells, a five-item legend and two summary stamps add up to three ways of saying one thing. The interaction (scrub to open a day) is hidden.
- The chart range change doesn't tween. Bars jump.

### 2.7 Journal (`/journal`)

**Inventory** (`shots/journal-full.png`, `shots/journal-fold.png`, `shots/sheet-quote.png`, `shots/sheet-entry.png`)
1. Header "Journal", "Write, look back, and a quote to start the day."
2. TODAY'S QUOTE hero (100–420): a five-line serif quote, author, work, theme caps, "Shuffle" chip, "Hide" link, star. Tap the text to open the quote sheet.
3. FROM YOUR JOURNAL: a random past entry, with Shuffle, "Open ›" (goes to that day on Today) and a star. Tap the text to open the entry sheet.
4. WRITE · WED, OCT 14, with a "**Reads**" link on the right (the only way into Reads), then the composer card with a ghost "Save".
5. At about 930pt, the **Entries (2) / Favorites / Quote library** segmented control, then the tab's content: search plus entries grouped by day; or favorite entries plus favorite quotes; or theme chips, search, an "Add" chip, "3,458 QUOTES" and a long list (`shots/journal-quotes-tabs.png`, `shots/journal-quotes-list.png`).

**Jobs.** (a) Write a first entry. The composer is the third block, under a quote from Goethe. (b) 6:30am: maybe read the quote. (c) 9pm: write two sentences, the page's main job, which is the third thing on it and starts at ~690pt.

**Problems**
- The page's primary job sits under two blocks that aren't the user's content.
- The sub-pages (`/journal/quotes`, `/journal/favorites`) are a segmented control 930pt down. Following the URL lands at the top of the page, so the user sees the same quote and composer and none of the selected tab.
- Two quote concepts (the Journal daily quote; Morning's "Word & quote") and two shuffles one card apart.
- The quote sheet shows the author as its serif title and again under the quote. "Star" is the only primary action. It's the same as the star on the card.
- The entry sheet is an editor with Delete, Cancel and Save. Entries can't be swiped. There's no calendar or "on this day" view, no tags, no mood, and no link to the day's run beyond "Open ›".
- Favorites is two stacked lists (entries, then quotes) with two empty states (`shots/journal_favorites-full.png`).
- The Reads link in the Write header is a navigation item placed in a section head about a different thing.
- The quote library's "Add" chip floats alone between the search and the count.

### 2.8 Reads (`/reads`, `/reads/read`)

**Inventory** (`shots/reads-full.png`): header "Reads"; a TODAY'S PICK hero ("Nothing to go on yet." empty); a "Paste a link" input with an ink "Add"; an Unread / Read segmented control; the list or its empty state. Rows: check, link and edit icon. Swipe right to flip read, swipe left to delete. The link sheet holds a note and tags.

**Problems.** No tab, no back button, and no active tab in the bar: you're on a page the navigation doesn't acknowledge. The only way in is the "Reads" link in Journal's Write header (or the pick card on Today, when one exists). 55% of the screen is empty. The empty hero is the largest object on the page and tells you to use the input under it. There's no share-sheet or clipboard intake, which is how links actually arrive on a phone.

### 2.9 Settings (`/settings`)

**Inventory** (`shots/settings-full.png`, `shots/fr-settings.png`): header "Settings" with the email as subtitle; DATA: "Import / From your old log / Import ›"; INSTALL: "Add to Home Screen / From the browser's share menu." (not tappable); a full-width red "Sign out" row. With the flags on, there's also Account (Run sync) and Coach.

**Problems.** No back button, and no tab is lit. You get out by guessing a tab. You get in only through the gear on Today. The row title and its verb are the same word ("Import … Import"). Missing: profile and goal, units, week start, reminders (morning alarm hand-off, evening log nudge), habits management, morning routine (it's in Morning), export, privacy/delete account, about/version. Sign out is the most prominent control. The page is 50% empty.

### 2.10 Auth (`/login`, `/setup`)

`shots/auth-login.png`, `shots/fr-setup.png` (setup shown with mocked status). Good: the black-and-halo stage, the serif "Welcome back." and "Make it yours.", one blue button. Problems: **there is no sign-up**. `/setup` works only while no account exists (`auth.ts: setupOpen = n === 0 && allowSetup`); after that it redirects to `/login`. Not consumer-ready. No password reset, and the setup copy says so: "There is no reset, so keep it somewhere safe." No Sign in with Apple. "Again" as a field label. After Create, the user lands on the empty Today with no onboarding.

### 2.11 Sheets

| Sheet | Opened from | Screenshot | Problems |
|---|---|---|---|
| Session (planned/missed) | Hero tap, row tap | `sheet-session-missed.png`, `sheet-plan-session-sat.png` | Repeats the hero 1:1 (eyebrow, chip, STAMP title, PLAN/FLOOR stamps). Primary actions Done/Floor/Skip are 40px grey chips; Delete is the heaviest button. Move and Edit are quiet text. Title is the caps date, the 3rd sheet-title style. No route map. No swipe to the previous or next session. A future session can be marked Done. |
| Unplanned run | Hero or row on a run day | `sheet-unplanned-run.png` | Good content (splits bars, "Faded: the second half was 16 s/mi slower"). The route from the hero disappears. "DONE" here vs "BONUS" on the hero. "Started 14:38" is 24-hour while the rest of the app is 12-hour. |
| Share | Hero "Share" pill, sheet Share | `sheet-share.png` | The best sheet. Templates are text chips (Stamp/Route/Marker/Bubble/Week) clipped at the edge instead of swipeable previews. "Save" is a ghost word. |
| Edit session / Add session | Session sheet Edit; Training Add | `sheet-session-edit.png`, `sheet-add-session.png` | Edit *replaces* the session sheet in place, with no push or back. A generic form: native date input with mm/dd/yyyy and the "10" pre-selected, Kind segmented, Type select, Miles, Title, Minutes and Details for every kind. No presets, no "same as last Easy". Miles is empty when you choose Easy. |
| Move | Session sheet Move; hold a row | `sheet-move.png` | A full month calendar to move one session usually one or two days. The foot repeats Skip and Delete, so Delete is reachable from three places. |
| To-do | Tap to-do text | `sheet-todo.png` | Priority is a segmented control and When is white pills: two selection idioms stacked. Delete/Cancel/Save for an object that could save itself. The note placeholder is in the serif. |
| Habit note | Hold an orb | `today-orb-note.png` | Not a sheet: a dashed-underline input inside the card. Nothing tells you it saved. |
| Habits edit | "Edit" | `today-habits-edit.png` | Grip, ↑, ↓ and ✕ on every row (five controls). ✕ archives with no undo. |
| Edit morning | Hero, Edit pill, any block | `sheet-morning-edit.png` | Fine controls. Duplicates the timeline drags. Three entry points. |
| Morning word & quote | "Add"/"Change" | `morning-focus-edit.png` | An inline three-field form that pushes the page. Save/Cancel fall under the tab bar. |
| Plan | Plan hero, plan rows | `sheet-plan.png` | Restates the hero. Delete has no undo. "Open" goes to the Week tab. |
| Lift | Lift row | `sheet-lift.png` | Good: Best e1RM, Change, history. No chart. No "log a set" from here. |
| Quote | Tap quote | `sheet-quote.png` | Author as title and again under the quote. "Star" is the only verb. |
| Entry | Tap entry / memory | `sheet-entry.png` | Serif title "Sun, Oct 11" plus a caps time. Editing has no autosave. |

Every sheet: one height that fits its content, no detents, a spring rise, drag down to dismiss. Opening a sheet from a sheet swaps the body instantly (`Sheet.tsx` `open()` just sets spec). Focus management and the inert background are well done.

---

## 3. Across the app

### 3.1 Navigation model
- **Tabs:** Today, Morning, Plan, Trends, Journal. **Reads** has no tab and is reached by a text link in Journal's Write header. **Settings** has no tab and is reached by a gear that only Today shows. On both, no tab is active and there's no back button: an orphan state.
- **Morning is a tab for a 2-hour window.** It overlaps Today's hero (the Out/Back times) and Plan's strip. It should be Today's morning state. The research doc reaches the same conclusion.
- **Plan's sub-views** use a segmented control in the header, and **Journal's** use one 930pt down. **Morning's** Plan/Settings segmented control mixes content with configuration. Three patterns for sub-navigation.
- **Date navigation** appears four ways: Today's ‹ › by day, Morning's ‹ › plus a strip, Plan's ‹ › by week or month plus a strip or grid, and the Move sheet's own month grid. There's no swipe anywhere, the "Today" way back has three styles (quiet ink link on Today and Morning, blue link on Plan), and re-tapping a tab doesn't reset.
- **Recommended model:** four tabs (Today, Plan, Progress, Journal) plus a profile avatar in every header for Settings. Reads folds into Journal as "Library", or into Today as the read card. Morning becomes Today's pre-leave state. Every pushed page gets a back chevron and the edge-swipe gesture.

### 3.2 Consistency: the same thing done different ways
- **Add:** head text link (Training, Plan), soft blue pill in empty states, inline input that grows an Add (to-dos, habits), a standalone chip (quote library), input plus ink text (Reads). Five patterns.
- **Edit:** inline mode toggle (Habits "Edit"), a pill opening a sheet (Morning hero), a link opening an inline form (Word & quote "Change"), a quiet button replacing a sheet (session Edit), tapping the object (to-dos, entries). Five patterns.
- **Delete:** with Undo toast (session, to-do swipe, reads swipe, hide quote), with a confirm step and no undo (plan), immediate with no undo (habit ✕, quote delete). Three behaviours.
- **Selection:** grey sliding thumb (`Segmented`), white filled pill (`ChipButton on`: When, quote themes, share templates), white filled circle (day strip), blue outline (today). Four "selected" looks.
- **Sheet titles:** serif ("Edit session", "Share", plan name, author), caps date (session sheets), caps kicker ("TO-DO", "LINK"). Three.
- **Status words:** Open, Rest, Planned, Upcoming, Bonus, Done, Floor, Missed, Skipped, sometimes contradicting on one screen (§2.1).
- **Session names:** STAMP uppercase on heroes and Plans ("EASY 4"), title case in rows ("Easy 6"), serif for Strava names.
- **Times:** "7:15 AM", "7:15", "14:38", "5:12 PM", "2 H 15 MIN", "1 h 10 min".
- **Settings live in four places:** Settings, Morning → Settings, Today → Habits Edit, Journal → Quote library (hide/favorite cadence).

### 3.3 Loading, empty and error states
- **Loading:** `Loading` renders a **spinner** with "Loading October…", "Loading to-dos…", "Loading your morning…" and "Opening your log…" (`primitives.tsx`, `App.tsx:42`, `DayView.tsx:573`, `TodoList.tsx:360`, `PlanView.tsx:166`, `MorningView.tsx:720`). That breaks brand checklist #10 ("no spinner, ever"). Elsewhere there are good shape placeholders (`jwait`, `tr-wait`, the hero `skeleton`). It's inconsistent.
- **Empty:** grey sentences in cards, the spec's own anti-pattern ("a grey sentence as an empty state"). First run shows: Today ×5 (training, to-dos, habits, journal, plus the hero), Plans ×2, Trends (chart with axes and no data, lifts sentence, consistency "—"), Journal ×2, Reads ×2. None has a picture, a preview of what it will look like, or a starter set ("Add the 3 most common habits").
- **Error:** an offline/syncing pill (`NetPill`) and toasts. The top-level "Couldn't connect. Check your connection." is a lone `.empty` paragraph with no retry. Strava errors show as a `Note` at the page foot.

### 3.4 Motion inventory

| Moves today | Where |
|---|---|
| Page fade 200ms (CSS) | Only when the first path segment changes (`App.tsx PageFade`) |
| Sheet spring rise, scrim fade, drag-to-dismiss | `Sheet.tsx` |
| Segmented thumb slide (`layoutId`) | Every `Segmented` |
| Tap compress 0.985 | Heroes (`whileTap`), Mark 0.9, CSS `:active` on rows, buttons, cells |
| Mark fill then check draw (160+160ms) | Session and to-do checks, reads |
| Orb check draw plus ring pulse; habits meter spring | Today habits |
| Route draw 1.1s | Today hero |
| `AnimatedNumber` ticking | Today stat strip, Plan heroes, Plan month strip |
| Lift on hold (1.03), ghost follows finger, drop-strip expand | Session drag, orb reorder, habit edit, wake block |
| Toast spring | `Toast.tsx` |
| To-do `layout` reflow; reads row collapse; quote/memory crossfade | Lists |
| Pull-to-refresh ring | Today, Plan, Trends |

**Does not move:** day ‹ › on Today and Morning; week and month ‹ ›; Week/Month/Plans, Plan/Settings, Entries/Favorites/Quotes, Unread/Read content swaps; Trends range (bars jump); hero → sheet (no shared element); sheet → Edit/Move (instant body swap); habits Edit mode toggle; fold expand (Later/Someday/Completed); adding a to-do, habit or entry (rows pop in); the Morning timeline when wake changes from the sheet; selecting a day in the month grid (the card below swaps off-screen); quote Shuffle on the hero (crossfade only). Under brand rule 9.4 ("No ambient motion… nothing longer than 600ms"), the app has gone so far the other way that related views feel unrelated.

### 3.5 Haptic inventory (`grep haptic(` → 26 calls in 9 files)

| Fires | Kind | File |
|---|---|---|
| Session/to-do/reads check reaches done/floor | success / tick | `primitives.tsx:82` (`Mark`) |
| Stepper ± | tick | `primitives.tsx:139` |
| Pull-to-refresh armed | tick | `Shell.tsx:133` |
| Orb lifted (hold), habit edit drag start | tick | `DayView.tsx:189, 386` |
| To-do: lift, swipe armed, complete, delete, reorder drop | tick/success/warn | `TodoList.tsx:87,114,121,125,280` |
| To-do sheet priority/when/delete | tick/warn | `TodoSheet.tsx:56,72,93,150` |
| Consistency scrub per column | tick | `TrendsView.tsx:547` |
| Morning wake/edge drag steps and arming, arrow keys | tick | `MorningView.tsx:313,330,350,365` |
| Session drag arm/start/over a day/drop | tick/success | `SessionCard.tsx:471,476,487,498` |
| Reads swipe armed/flip/delete | tick/success/warn | `ReadsView.tsx:177,185,189` |

**Missing:** **habit orb toggle (the most frequent completion)**, tab change, every segmented control, sheet open/dismiss threshold, day/week/month step, journal Save, add session/to-do/habit/link submit, Share or Save success, the Undo action, session Delete (sheet), plan Delete, star/favorite, Shuffle, chart bar pin, Morning Settings changes. **On iPhone outside the Capacitor build, haptics do nothing at all:** `haptics.ts` falls back to `navigator.vibrate`, which iOS Safari doesn't implement, so the PWA is silent.

### 3.6 First-run experience
- **Sign-up is disabled** once the single account exists (`/setup` redirects to `/login`). A new user can't create an account on this server. To see the journey I mocked the API in Playwright (`firstrun.mjs`: status `setupOpen`, empty habits, plans, months, to-dos, lifts and journal).
- Journey: "Make it yours." form (`shots/fr-setup.png`), then straight to Today with six empty cards (`shots/fr-today.png`). No welcome, no goal or race, no weekly volume, no run days, no units, no wake or leave times (Morning silently uses the owner's defaults: 8:20/mi pace, 8:40 shower, a smoothie), no starter habits, no Strava connect step, no notification permission, no explanation of "floor" (a core concept that appears as a stat with no definition).
- The empty Today promises "build a plan", but Plans (without the AI flag) offers only "Add a session". Trends shows an empty chart with axes 0–10 and "—" stamps (`shots/fr-trends.png`). Journal opens on a Goethe quote and "Write your first one below." (`shots/fr-journal.png`).

---

## 4. What is genuinely good, and must be kept

- **The brand system.** True black, one blue, the Instrument Serif titles, Inter Tight stamps, caps labels, the halo as a stage light. The login screen and the Share card are the proof (`shots/auth-login.png`, `shots/sheet-share.png`). Keep all tokens. Change the composition, not the palette.
- **The route line** drawn once over 1.1s on the run hero (`shots/today_2026-09-08-full.png`), and the route/stamp share templates.
- **The Morning timeline as a concept**, and its direct manipulation: hold the Wake block and drag in 5-minute steps with a tick per step; drag the run block's edge to change miles while the whole morning recomputes live. This is the most "the thing is the control" interaction in the app. Make it discoverable, don't replace it.
- **Session drag-to-day** with the week strip sliding in under the head, the ghost pill above the finger, a tick per day crossed, and a success haptic plus Undo toast on drop (`SessionCard.tsx useRowDrag`, `DropWeekStrip`).
- **To-do quick-add parsing** ("!! fri" → "HIGH · OCT 16", `shots/today-todo-typing.png`), Later/Someday buckets, rollover, and swipe complete/delete with haptics.
- **Undo toasts** on session delete, move, skip and to-do delete.
- **Run evidence:** mile splits as bars, the one-line assessment ("Faded: the second half was 16 s/mi slower"), and Started · max HR · cadence · elevation (`shots/sheet-unplanned-run.png`). The lift sheet's Best e1RM and change.
- **Consistency scrub:** press anywhere on the grid, slide to a day, let go to open it. Hidden, but excellent.
- **Pull-to-refresh ring** with no spinner, the offline outbox with the "Offline · changes saved here" pill, and the persisted query cache (the app opens instantly).
- **Accessibility groundwork:** VoiceOver strings for stats ("Week 6.0 of 26 miles"), roles on orbs and sliders, arrow-key equivalents for every drag, reduced-motion paths, Dynamic Type, 44pt targets, focus return on sheet close, inert background. No horizontal overflow at 320 (`shots/w320-today.png`, scrollWidth 320).
- **Memory resurfacing** ("From your journal, 3 days ago") and the quote library's favorites-come-back-sooner rule. The content ideas are right; the placement is wrong.
- **Voice.** Short verbs, plain verdicts ("Floor held.", "Out the door 7:30, back 8:13."). Keep it.

---

## 5. The 30 most important fixes, ranked

1. **Today.** A fixed stack of nine equal sections that ignores the time of day. → Rebuild Today as a time-aware screen. Before leaving: session plus the Morning timeline plus a leave countdown. During the day: the session and what's next. Evening: a "Log the day" card with session status, habits and a journal prompt. Then retire the Morning tab.
2. **Today and Plan.** The hero repeats the Training row, and the hero and row can contradict each other (hero "FLOOR · Floor held." over a row saying MISSED on Oct 11; BONUS vs DONE; Open vs Rest). → Make the hero *the* session, and let a second session hang off it. Drive every status word from one source and one vocabulary.
3. **Navigation.** Five tabs, Morning duplicating Today, Reads and Settings orphaned with no back and no lit tab, a gear only on Today. → Today · Plan · Progress · Journal, plus an avatar for Settings on every header. Reads goes into Journal's Library. Every pushed page gets a back chevron and edge-swipe. Re-tapping a tab scrolls to top and resets to today.
4. **Today, Habits.** The most-tapped control is below the fold, and its toggle fires no haptic. → Move the orbs into the top screen (under the hero, or inside the evening card). Fire `haptic('success')` on done and a glow bloom. Make the orb ring itself the progress meter.
5. **Session sheet.** Done/Floor/Skip are small grey chips, Delete is the heaviest button, the sheet restates the hero, and Edit/Move swap in place. → Big primary Done and Floor (or a swipe-to-complete on the hero), Delete in an overflow, a shared-element morph from the hero, Edit/Move pushed inside the sheet with a back control, the route map at the top.
6. **First run.** Sign-up is closed, there's no onboarding, and you get six grey empty states. → Open sign-up (with Sign in with Apple). Add a 5-step setup: goal or race, weekly volume and run days, wake and leave times, starter habits, connect Strava. Then a pre-filled first week.
7. **Plans.** Without the AI flag there's no way to create a plan, and Today's empty state still promises one. → A manual plan builder (template picker: 5K/10K/half/marathon by weeks and volume) plus CSV/sheet import. Gate the "build a plan" copy until then.
8. **Plan, Week.** It shows one day at a time; the hero mixes day and week stats; the strip sits under the card it controls. → A 7-row week agenda (day, session, miles, status) under a week progress meter. Drag rows between days. Tap a row to expand in place.
9. **Motion system.** Related views share no motion. → Spring transitions: horizontal slide for day, week and month steps with swipe; content slide for every segmented control; hero→sheet morph; sheet push for Edit and Move; tween bars on range change; animate list insert and remove. Keep everything under 300ms and interruptible.
10. **Haptics.** 26 calls with big gaps, and the iOS PWA is silent. → A named vocabulary (select, toggle on, complete, threshold, success, warning, delete) applied to tabs, segmented controls, sheet dismiss threshold, date steps, saves, submits, Undo, star, Shuffle. Document in the redesign that the PWA has no haptics on iOS.
11. **Empty states, app-wide.** Grey sentences in cards, the spec's own anti-pattern. → Ghost previews of the filled state with one verb, starter sets ("Add Sleep 7h, Stretch, Read"), and on Today collapse empty sections into a single "Set up your day" card.
12. **Journal.** The composer sits third under a stranger's quote; the sub-tabs are 930pt down and the URL doesn't scroll to them. → Composer first (with a prompt tied to today's run), entries timeline under it, Library (quotes plus reads) as a page-level segment at the top. The daily quote shrinks to one line.
13. **Morning (until merged).** The hero repeats the timeline; three ways in to the same sheet; the good drags are invisible. → Drop the hero. Pin "Leave 9:30" and "now". Give the wake block and the run edge visible handles plus a first-use hint. Remove the Edit pill.
14. **Trends.** The range control changes only one chart; the hero leads with "0.0 / 0 runs"; 1M is mostly future bars; no block or pace view. → Rename it Progress. The range applies to every section. Add block adherence, long-run progression and easy-pace/HR trend. Replace the zero headline with this week's progress vs plan. Give the empty chart a real empty state.
15. **Today, stat strip.** Three unrelated dead numbers; "0 days" streak everywhere. → Make each stat tappable (Week to the week, To-dos to the list, Streak to Consistency), or remove the strip and fold the week meter into the hero.
16. **Add pattern.** Five different add idioms and duplicated Add buttons 60px apart. → One "+" per screen opening a quick-add sheet (session · to-do · habit · entry · link) with natural-language parsing like the to-do field. Remove the head-and-empty-state double Add.
17. **Plan, Month.** The selected day renders 550pt below the tap; colours only; a 70pt legend. → Selection opens a peek sheet or expands that week's row. Add miles per day and a weekly totals column. Move the legend behind an info button.
18. **Settings.** Three rows, no back, Sign out the biggest thing, and settings spread over four places. → A real settings tree: profile and goal, units and week start, reminders (morning, evening log), habits, morning routine, connected apps, import/export, privacy/delete account, about.
19. **Morning settings.** 11 raw numeric inputs and wrong copy ("Change it… on the Plan tab"). → A visual routine builder: reorderable blocks with duration chips, previewed live on the timeline. Fix the copy.
20. **Hero visuals.** The same blue bloom on missed, open and done days; the title face switches between stamp and serif with the data. → A state-driven halo (dim and cold for missed, amber edge for floor, full bloom on done, as brand §9.2 says). One title treatment for sessions (stamp label plus a serif run name as subtitle).
21. **Type and rhythm.** Caps labels on every section, chip, axis and eyebrow (Trends' hero has four caps lines before its first number), and every section has the same weight. → Cut the section eyebrows where the content names itself. Vary the containers: edge-to-edge lists, inline rows, horizontal carousels, not card after card. Make the gap between primary and secondary sections deliberate (48 vs 24) rather than 32 everywhere.
22. **To-dos.** Swipe, hold and reorder are invisible, and the to-do sheet uses two selection idioms. → Peek affordances (a swipe hint on first use, a visible grip on hold), autosave in the sheet, and one selection style for Priority and When.
23. **Habits management.** An edit mode with five controls per row; ✕ archives with no undo; no habit detail. → A habit detail sheet (streak, 30-day grid, note history, rename, archive with Undo). Reordering stays hold-and-drag on the orbs. Retire the arrow buttons from the visual layer (keep them for VoiceOver).
24. **Edit/Add session form.** Generic fields for every kind, native date picker, empty Miles. → A kind-aware form: run (type chips, miles stepper, floor preset), lift (exercise list), cross (minutes). A day-strip date picker, and "Repeat last Easy" presets.
25. **Loading.** A spinner with "Loading October…" breaks the brand's no-spinner rule. → Content-shaped skeletons everywhere, as the hero and Journal already do.
26. **Destructive actions.** Undo for session delete, confirm-only for plan delete, nothing for habit archive and quote delete. → One rule: every destructive action is immediate with an Undo toast, and a warning haptic.
27. **Reads.** Hidden behind a section-head link; the empty pick hero dominates; no share-sheet intake. → Move it into Journal → Library, accept links from the iOS share sheet and the clipboard, and show today's pick as a compact card on Today only when one exists.
28. **Share sheet.** Templates are text chips clipped at the edge. → A swipeable carousel of live template previews with a page indicator. Keep Share as the one blue verb.
29. **Copy and format consistency.** 24-hour "Started 14:38" next to "5:12 PM"; three sheet-title styles; "Import… Import"; a "Journal" link beside the JOURNAL label; the "Open" row label. → One time format, one sheet-header pattern (caps eyebrow plus serif title), and no label repeated as its own action.
30. **Auth.** No password reset ("There is no reset"), "Again" as a label, no Apple sign-in, a single-account server. → Standard account system with reset and Apple sign-in. "Confirm password". Land new accounts in onboarding, not on an empty Today.
