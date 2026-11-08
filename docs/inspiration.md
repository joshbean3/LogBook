# Inspiration log and redesign plan

A running file. Reference screenshots go in, and what they teach comes out as rules, a tab-by-tab map and a build plan. We build from this at the end.

Ground rules
- Tabs stay as they are: Today, Goals, Learned, Plan, Progress, Journal. The references shape flow, layout and feel inside those tabs, not the app's structure.
- References are for patterns, not copying. No borrowed names, logos, art, icons or copy.
- Palette: Columbia Blue, white, orange as the highlight.
- Screenshots are not committed. Detailed per-screenshot notes are in `docs/research/inspiration/notes-*.md`, and every rule below cites screenshot numbers.

## 0. What stays: Logbook's integrity

The references teach how a professional app looks and feels. They do not decide what Logbook is. Every change in this plan has to pass this section first.

What Logbook is
- One athlete's private daily logbook: the day, the training block, the habits, and what was learned and felt, kept honestly in one place. It is built for its owner, not for an audience.
- Its job: open it at 6:30 am or 9 pm and see the one thing that matters now in under two seconds, then touch it directly (`docs/experience.md`).
- What it is for, in the owner's own use:
  - Training for races: a plan of runs and lifts by week and block, synced activities, and progress over time.
  - The morning: wake, run, back, out the door, with the alarm and the leave time.
  - Habits: tapped as lights at the top of Today, with history behind them.
  - Goals: year, month, week and day, reviewed honestly.
  - Learned: one thing a day, kept by month.
  - Journal: entries, and a daily "remember when" from your own words.
  - To-dos and plan-my-day.
  - An assistant that proposes and never acts alone: you apply, with Undo.

What does not change
- The six tabs and what each is for. Today is the day, not a score dashboard: habits first, then the plan. Health rings, when they come, sit under the habits and only once there is real data.
- The interaction model: the thing is the control (tap to open, hold for its menu, drag to move), the day pager, instant paint from cache, writes that work offline.
- Principles: one job and one hero per screen, nothing shown twice; progress, not grades (no zero as a headline, no coins, badges or streak shaming); celebration one or two moments a day at most; honest numbers.
- The voice: verbs, then a plain clause. No hype, no "coach personality" theatre.
- Type: Instrument Serif italic for the big words, Inter Tight stamps for numbers, small caps labels. This keeps Logbook from looking like the reference, whose type is a plain sans.
- The halo, the light rising from under what matters. It stays as Logbook's signature, relit in Columbia Blue (and orange for a highlight) instead of electric blue on black.
- Privacy: your data is yours, and nothing goes to the assistant without your say.

What changes
- The skin: from true black with one electric blue to white and Columbia Blue, navy ink, orange as the one highlight. This is the owner's call and supersedes the "Night" palette in `docs/brand.md`.
- The craft: sheets, feedback, data honesty, metric pages, chart grammar, logging ergonomics and how the assistant shows up, all from the references below.

What we do not take
- A score-first home, nutrition, cycle, lab records, a paywall, a coach with a persona, confetti on every log.

The test for every screen
1. Does it help one athlete run the day and the training block better?
2. With the logo hidden, does it still read as Logbook (serif words, stamped numbers, the halo, the habits as lights)?
3. Does it keep the principles above?
If any answer is no, the reference loses.

## Status

| Source | Reviewed | Notes |
|---|---|---|
| Pasted in chat | 5 | First launch and sign-up |
| Drive folder ("Bevel ios Oct 2026 N.png", N = 1 to 715) | 242 of 715 | 473 numbers are not in the folder. Upload looks incomplete |

Present per range: 1–90: 39 · 91–180: 31 · 181–270: 15 · 271–360: 49 · 361–450: 8 · 451–540: 49 · 541–630: 10 · 631–715: 41. The exact missing numbers are listed in each notes file. If the rest gets uploaded, the gaps get reviewed and this file updated.

Caution about the set: 138, 139, 158, 159, 165 and 171 come from an older version of the reference app (different tab bar). Treat them as a separate style. Some sequences are slightly out of time order (76 comes after 90, 265 before 264).

---

## 1. Palette

Columbia Blue is very light. On white it reads as a tint (1.5:1), so it works as page color, surface and atmosphere, never as text. Text and buttons are deep navy. Orange on white fails for text (2.9:1), so it is a fill and highlight color, with a darker orange for any orange words.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--bg` | `#F3F8FB` (draft) | Page: a whisper of Columbia Blue so white cards lift off it | |
| `--card` | `#FFFFFF` | Cards, sheets | |
| `--columbia` | `#B9D9EB` | Selected states, chart fills, hero gradients, the AI glow | 9.9:1 under navy text |
| `--columbia-wash` | `#E8F3F9` | Grouped rows, chips, empty rings | 13:1 under navy text |
| `--ink` | `#0F2A44` | Text, primary pill buttons (where the reference uses black) | 14.6:1 on white |
| `--ink-2` | `#2F5D85` | Secondary text, icons, "on track" | 6.9:1 on white |
| `--orange` | `#FF6B1A` | The one highlight: today, streaks, the live dot, effort, "behind", the newest chart point | 5.1:1 on navy; fill only on white |
| `--orange-text` | `#C2410C` | Orange words on white | 5.2:1 on white |
| `--danger` | red on pale pink tint | Delete only, never for "bad data" | |

Rules taken from the references:
- Color carries meaning only. Everything else is white cards, navy text, grey labels. (Seen in every range: 112, 266, 466, 714.)
- Each metric owns one color everywhere it appears: ring, chart, tile, icon. (29, 59, 667, 714) Logbook needs a metric color map: runs, lifts, sleep, HRV, resting HR, readiness, habits. Draft it in Phase 1, built from Columbia Blue, navy and orange tints plus at most two extra hues.
- Orange means "look here": the newest point, effort, behind target, a value the AI is unsure of. Not "bad". (113, 576, 620)
- On-track and success use navy or `--ink-2`, where the reference uses green. A small green check stays for "synced".

Open: light only, or a dark variant? The reference switches sleep pages to dark (350–359) and offers appearance tiles (663, 666).

---

## 2. System rules (apply everywhere)

### Chrome and navigation
1. Floating tab bar as a capsule, with the ask bar floating above it. Both shrink on scroll; the ask bar keeps a dot when the assistant has something waiting. (296–303, 381, 385, 496–501, 620) Logbook keeps 6 tabs, so the capsule is icon-first at narrow widths.
2. Quick add: a "+" opens a grid of actions with Ask in the middle (log run, log lift, habit, to-do, learned, journal). (158, 620) Lives inside or beside the ask bar.
3. The page title is the date and opens a calendar sheet. Past days show a recap. (23, 296, 520, 527)
4. Context chips under the title: a status chip and, optionally, weather. (23, 296, 667)
5. Big titles shrink into a small header on scroll. (261→262, 298–303)
6. Round floating glass buttons instead of a nav bar on sheets and pushed pages; related actions grouped in one capsule. (104, 110, 128, 1.4, 1.5)

### Sheets (the main surface)
7. Almost every task is a bottom sheet over the tab. Sheets stack; sub-steps push inside the sheet with a back chevron; small pickers open as a second, smaller sheet on top. (49, 58–63, 306–314, 502–511, 675, 689, 698)
8. One sheet header: close or back left, small grey centered title, confirm right or one pinned full-width navy pill at the bottom. (207, 213, 248, 549, 561, 603, 617)
9. The primary button stays grey until the input is valid. In settings, Save stays grey until something changes. (207, 213, 248, 660, 698–704, 1.5)
10. Delete is a red icon in a tinted circle at top right of the item's sheet, then a system alert that says what is lost, then a toast. (114–116, 249, 549)
11. Confirm buttons name the result: 'Sort by "Alphabetical"', 'Filter by "Active Duration"', "Add to log". (128, 603, 29)

### Feedback
12. A status pill at the top for background work: spinner "Syncing…" turns into a check "Synced". (260, 261, 315, 316)
13. Small top toasts confirm actions with the exact time where it matters ("Synced at 9:24"). (23, 82, 85, 700)
14. Long work never blocks: a sheet says "Working on it, we'll let you know" with Done, then changes in place to "Ready to review". Nothing applies without review. (18, 448, 449) This matches Logbook's background assistant jobs exactly.
15. Loading screens say what happens if you leave. (260)

### Data honesty
16. Empty states keep the full layout: rings at "–", cards with dashes, "No data available" rows. Never a blank screen, never hidden sections. (18, 23, 297, 499, 622, 707, 712)
17. Freshness on every live number: "Updated 7:54", "6m ago", "Last data point on…". (23, 378, 649, 667, 712)
18. A learning period is stated, with counts toward it: "needs 2 weeks of data", "5 of 5 days". (346, 381, 576)
19. Confidence and missing inputs are shown ("based on 4 of 7 nights", "9 inputs missing"). (620–622)
20. Every metric explains itself: what it is, why it matters, how it is computed, the normal bands with exact cut-offs, sometimes sources. (367, 338–346, 358, 476, 514)

### Copy
21. Short, plain, direct. Empty states in two lines ("No logs yet. Once you add one, it shows up here."). (561)
22. Every number gets a sentence or a status word: "Above normal", "12 mi left", "7.4 over", "6, steady effort". (258, 386, 471, 498)
23. Forms say what a good entry contains before you type. (248, 264)
24. Settings are offered at the moment they matter, with "You can change this later". (76, 171)

### Typography and space
25. One big confident number per view, a small unit beside it, a grey label above. Two-column stat grids. (261, 262, 620)
26. White cards, about 20 px corners, 12–16 px gaps, generous empty space. (112)

---

## 3. Components to build

| Component | What it is | Seen in |
|---|---|---|
| Metric page | Icon and name, big value and unit, date, status word plus normal range on the right; chart; stat tiles with freshness; AI card; explainer | 378, 381, 648, 670 |
| Chart kit | Y labels on the right only; solid actual, dotted projection; shaded personal-normal band; dotted average with an "Avg" pill; faint daily bars behind a smooth line; glowing newest point; this period bright vs last period grey | 472, 512, 603, 641, 648, 670 |
| Range control | `< 1M 3M 6M 1Y [calendar] >`, plus chips that switch the metric inside one chart | 472, 603, 648, 670 |
| Trend table | Rows for 3, 7, 14, 30, 90 days: change %, arrow, sparkline; method footnote | 338, 367, 473, 649 |
| Rings | Three daily rings with "–" when empty; tap opens the metric page | 23, 158, 297, 667 |
| Gauges | Half-arc for goals; semicircle with normal range and a segment from reference to actual; small vertical pill for where a vital sits in range; battery for energy | 386, 429, 517, 620, 714 |
| Trend card | Label and arrow, big number, status word, sparkline ending in a glowing dot; same shell when empty | 471, 499, 501, 617 |
| Day strip | 7 tall capsule cells; today highlighted; a circle per day that fills; optional band underneath for phase | 496, 497, 538 |
| Timeline | The day's items as rows: icon tile with badge, title, time, chevron | 302, 303, 505 |
| AI insight card | Emoji, headline written for the page, 3–4 lines that quote the numbers on screen, expand icon, gradient border marking it as AI. Collapses to a floating pill on scroll | 296, 297, 378, 462–477, 667, 708 |
| Proposal card | What the assistant made, as a tappable card with Apply / Edit / Remove; risky changes flagged orange | 29, 78–80, 111–117 |
| Review bar | Pinned "Review changes (3)" above the composer, opens the review sheet | 80 |
| Choice cards | Icon, title, one-line description; selected gets a navy outline and check | 128, 165, 171, 675 |
| Custom keypad | Number pad with −/+ stepper, "same as last", optional plate calculator | 266, 267, 273, 274 |
| Effort dial | 1–10 arc from Columbia Blue to orange, glowing number, live word and description | 258, 259, 289 |
| Live session bar | Floating bar while a run or lift is in progress: timer, current exercise, heart rate | 263, 275 |
| Contribution rows | Slider-style bar and a signed score ("Long run +10", "Missed lift −2") | 448 |
| Settings rows | Pastel icon tiles, grey subtitles; maintenance and destructive actions as separate full-width pills | 658, 660, 673 |

---

## 4. The assistant

The reference treats its coach as the center of the app. Logbook's assistant already proposes changes the user applies; these patterns fit that model.

- Present in context everywhere: the ask bar on every tab, an insight card on Today and on every detail page, a pill on sheets that re-opens it. (296, 329, 350, 381, 496)
- The AI prepares, the user commits: proposals collect in a review sheet with Apply, never applied silently. (29, 80, 448, 449)
- Answers cite the user's own data and end with one next step. (81, 708) Insight text must quote the exact numbers shown beside it: the reference shows a stress score of 11 in text next to a dial reading 36 (378). Logbook must never do that.
- Shows its work: a collapsible "Thought for 14 s" with named steps, where steps can be results ("Moved Thu tempo to Fri"). (74, 78–80, 95, 96)
- Suggested replies as full-width rows written in the user's voice, changing each turn. (69, 75, 89, 92)
- Screen context: the question can carry the screen it came from ("Plan, week of Nov 9"). (92, 93)
- Composer: "+" for photos, files, check-in, screen context; a mode pill; mic with record, transcribe, edit before sending; send turns into stop. (86, 90, 98–100)
- Errors stay in the chat with Retry. (77)
- History: a drawer with auto-titled chats, relative times, unread dots, a tag on chats the assistant started. (101, 102)
- Check-ins: scheduled nudges as cards with a toggle, "in 1 hour", "Every Sunday at 7 PM". (102, 128)
- It rewrites its insight right after a log or a status change, with a spinner while it works. (311, 509)
- Personality shown by example (sample sentence and three trait chips), as an optional setting. (67, 68)

---

## 5. Logging

- Presets over typing: a one-tap preset beside "Add custom"; steppers; time defaults to now. (561, 575)
- Tap an entry to reopen its sheet in edit mode. (549)
- Day total on the section header, "x/y" with a small ring when there is a target. (575)
- Live lift logging: set rows, finished sets tinted with a check, warm-up flag, automatic rest timer chip, superset link, "+ Add set", "Previous" half sheet with last session's numbers. (263–266, 273–277)
- After a session: effort dial, then a summary with stats and set tables, then "Update plan" to save changes back to the week. (258–262)
- Manual activity: recents first, A–Z scrubber, then a short form with an effort slider. (288, 289)
- Backfill: a wheel picker or calendar to fill past days, with "I don't remember" to skip. (62, 63, 488, 489)
- Status with an end date: Training / Sick / Injured / Rest, "until" a date, and the whole app respects it. (305–314)

---

## 6. Logbook, tab by tab

### Today
Order, top to bottom:
1. Title is the date with a calendar dropdown; chips for status (Training, Taper, Sick, Injured, Rest, with an end date) and weather. (23, 296, 305–314, 520)
2. Habit buttons stay first, as the owner asked. Habits that Apple Health or Strava can fill turn on automatically, showing the live value with a small ring and an "auto" mark; "Copy from yesterday". (538, 539) A 7-day strip whose circles fill as habits get done. (538)
3. Three rings once Health data arrives: Readiness, Sleep, Training load, at "–" until then. Tap opens the metric page. (23, 297, 667)
4. The assistant's daily read under the rings: one card that quotes today's numbers against your usual and gives one instruction, with Apply for any change it proposes. (297, 667, 708)
5. The day's plan and to-dos (existing).
6. A timeline at the bottom: runs, lifts, entries, habits, with times. (302)
Also: a live session bar during a workout (263, 275); a sync pill when data arrives (315); an edit mode for Today's sections (516–519).

### Goals
- One big progress number per period with "vs last period", tinted orange when behind and navy when on track. (620, 621)
- Tiles that say "12 mi left" or "1 over" with a small ring instead of a bare percentage. (386)
- Tapping a goal opens a sheet with a half-arc gauge and what counted toward it (runs, lifts, to-dos), each marked auto or manual, plus "Add manual". (429)
- Creating a goal: "Set it myself" or "Suggest from my last 90 days" as two choice cards, then a loader that says what it is reading. (675–677) Or a one-question-per-screen wizard. (165, 171)
- A nudge card for goals that went stale, naming them. (104)
- A short celebration when a week or goal completes. (261)
- A "receipt" showing how a target was calculated. (358)

### Learned
- The entry sheet: one line, a hint above the field on what a good entry looks like, Save grey until there are words. (15, 248)
- The month archive (built) as rounded rows; days with nothing keep their slot with a dash so a month reads as a grid. (622, 712)
- A carousel of highlighted past learnings. (513, 641)
- Backfill a missed day with a date picker. (62, 63)

### Plan
- The morning card as a timeline with a sleep block and the workout marked, or shaped like a check-in card ("Starts in 40 min", a toggle). (128, 713)
- The week as capsule day cells with a band underneath for the training phase: base, build, taper, race week. (497)
- Workout cards: "8 mi easy · Z2", chevron. (79)
- Weekly mileage bars with a dotted target line and a mark on weeks that hit it. (386, 714)
- A readiness dial with a word under it ("Easy day"), and training-load contribution rows. (378, 448)
- Live lift logging, keypad, plate calculator, "Previous", templates, "Update plan" after a session. (Section 5)
- A wind-down / target-bedtime card beside the morning card. (359)

### Progress
- Every metric uses the metric page template and the chart kit. (Section 3)
- Run detail sheet: 2×2 stats, the assistant's write-up, effort gauge, heart-rate chart with zones, load before and after. (328, 329)
- Cumulative mileage: this month in orange against last month in grey, both totals on top. (603)
- The 3/7/14/30/90-day trend table for mileage, pace, resting HR and HRV. (338, 649)
- A vitals grid for resting HR, HRV, sleep, each against your personal normal. (348, 517)
- Filter chips (All, Runs, Lifts, Races) and source chips on each activity (Strava, Apple Health). (104, 603)
- "In 8 weeks your half could be 1:42" as a sentence with tappable values. (641)
- An explainer on every metric, and orange only for data problems (bad GPS, a likely wrong import). (113, 338–346)

### Journal
- "Remember when" as an insight-style card with a soft header image, shareable as a card (save, copy, share). (315, 378, 528, 529, 576)
- Daily tags (alcohol, late screens, reading) marked yes or no; once there are 5 of each, show their effect on sleep and HRV, with counts filling in until then. (576)
- The post-workout effort check-in saved into that day's entry. (258, 259)
- An end-of-day reminder, offered as an explained notification toggle. (672)
- Entry rows in the timeline style. (302, 505)

### Settings
- One tall sheet; sub-pages push inside it; pickers as small stacked sheets with Done. (658–672, 688, 689)
- Data sources per metric: drag to set priority, an eye toggle to hide a source, the conflict rule in a footnote, "N hidden". (698–705)
- Connection pages: a stepped sheet with numbered instructions, a failure sheet with a checklist, a manage screen with Disconnect and a delay footnote. (458–461, 706, 707)
- Sync status: last sync, "Connected", how to fix it, "Tap to sync". (617)
- Appearance from preview tiles; notifications with a master toggle and an explanation per toggle; report a problem with an optional screenshot; version at the bottom. (248, 249, 658, 663, 672)

### Onboarding
- Splash: the mark on the page color, nothing else. (1.1)
- A 5-page pager, one navy pill button in a fixed place, pages built from real Logbook cards. (1, 1.2, 1.3)
- A privacy page before any account. This is also where the "Let the assistant read my health data" consent lives (Apple rule 5.1.2(i)). (1.4)
- Sign in with Apple first, email second; one question per screen; email sign-in by magic link with a resend countdown. (661, 710, 711, 1.4, 1.5)
- Setup as a short assistant conversation (race goal, weekly mileage, lift days) with suggested answers and a progress pill, ending with "you can change this later". (69–75, 92–100, 171)
- Features introduce themselves the first time they are used: one sheet with a visual, two lines and how often it updates. (305, 479, 619)
- A first-import reveal ("1,240 miles this year"). (635)

---

## 7. Not for Logbook
- Paywall and "welcome to Pro" screens (318–323), nutrition and food logging (15–64, 385–449), glucose sensors (458–461), cycle tracking (479–514), biological age (619–641), lab records (103–117). Their patterns are reused above; the features are not.

---

## 8. Build plan

6 phases. Phases 3 to 6 can run in any order once 1 and 2 are done.

1. Foundation (no new features)
   - Light palette tokens and the metric color map; type scale; card, chip and pill styles.
   - Sheet system: stacking, pushes inside sheets, pinned primary button, disabled-until-valid, delete pattern.
   - Status pill and toasts; empty-state and freshness conventions.
   - Floating tab capsule with the ask bar above it, both shrinking on scroll; quick-add grid.
   - Chart kit, range control, trend table, rings, gauges, trend card, day strip, timeline.
2. Today and the assistant
   - Date title with calendar, status chip with end date (stored, read by Plan and the assistant).
   - Habits first with the 7-day strip; rings at "–" until Health data; the daily read card; timeline.
   - Assistant: review sheet and review bar, proposal cards, thinking steps, suggested replies, screen context, the working→ready sheet on the existing background jobs.
3. Plan and logging
   - Week cells with phase band, workout cards, mileage bars with target line, the morning card as timeline.
   - Live lift logging, keypad, "Previous", effort dial, summary, "Update plan".
4. Progress
   - Metric pages on the chart kit; run detail; trend table; vitals grid; filters and source chips.
   - Health data pages come alive when Apple Health reading ships (see the wearables plan).
5. Goals, Learned, Journal
   - Goal tiles and sheets, set-or-suggest, stale nudge; Learned entry hint and month grid; Journal tags and effect view, Remember-when card, effort check-in.
6. Onboarding and Settings
   - Pager, privacy and consent page, Apple sign-in and magic link, assistant setup chat, feature intro sheets.
   - Settings as one sheet; data sources priority; connection and sync pages.

Depends on the Apple Developer enrollment: Apple Health data, Sign in with Apple, background sync.

## 8a. Progress

| Step | Status | Commit |
|---|---|---|
| 1a Palette: Columbia, white, orange; halo relit; native shell | Done | eab3abb |
| 1b Dock: floating tab capsule, ask bar on every tab, folds on scroll | Done | 574589d |
| 2a Today: status chip with an end date (Today, the assistant) | Done | this commit |
| 2b Today: the day's timeline ("Today so far") | Done | this commit |
| 2c Plan reads the status (sessions held while sick, injured or resting) | Next | |
| 2d Assistant: proposal cards, review bar, suggested replies | Next | |
| 1c Chart kit, rings, trend table | Later, with Progress | |

## 9. Open questions
1. 473 of the 715 numbered screenshots are not in the Drive folder. Upload the rest, or work from the 242?
2. Light only, or light plus dark?
3. Six tabs in a floating capsule is tight at 320 px wide. Keep labels, go icon-only when narrow, or keep the current fixed tab bar?
4. Weather chip on Today: worth a free weather API (for example Open-Meteo), or skip?
5. Assistant personality setting: yes or no?
