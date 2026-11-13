# Orby layout and hierarchy standard

**Version:** 1.0, November 11, 2026. **Status:** the layout rules for every Orby screen. **Sits under:** `docs/brand/brand-guide.md`. Color, type families, the Orb, icons, motion and voice come from the brand guide and do not change here. This standard decides where things go, how far apart they sit, how big they are relative to each other, what gets a container and what waits behind a tap.

**Research behind it:** `reports/Mobile layout and visual hierarchy.md` (the synthesis, with every source and its URL) and the three notes in `research_notes/Mobile layout and visual hierarchy/` (`apple_hig.md`, `hierarchy_evidence.md`, `app_teardowns.md`). Tags in brackets name the evidence: **[HIG]** Apple Human Interface Guidelines, **[WWDC]** Apple design sessions, **[WCAG]** W3C, **[PR]** peer-reviewed research, **[NN/g]** Nielsen Norman Group studies, **[Peers]** the 14-app teardown, **[Orby]** measured in the running app.

**How to use it.** Find your screen in section 2. Build it with sections 3 to 7. Run section 8 before you call the screen done, together with the brand checklist (guide 13) and the brand-guardian agent.

**What the measurements showed** (the app at c6cc577, 390 x 844, Sam's seeded account). The spacing tokens are right and are applied: every section title has 32 px above it and 12 px below, and cards sit 12 px apart on every tab. The screens look busy for other reasons:

1. Too much sits above the focal point. Today's hero card starts at 358 pt of 844, under six rows. None of the 14 peer apps puts more than three rows above its focal element.
2. Facts are said twice. Plan shows today's sessions in a "Today" section and again in the week. Journal offers "Write today's entry" twice.
3. One screen uses many card shapes. Goals has six: two chips, the tinted today card, the review card, three dashed "Further out" cards and a four-column history card.
4. Empty placeholders are as loud as content. Progress shows a 22 px italic empty state in Trends, and Learned and Goals show bare "–" stats.
5. Boxes sit inside cards. Journal's "Write today's entry" box has its own edge inside the calendar card.
6. There are too many sizes. Today renders 5 Fraunces sizes and 6 Inter sizes, against the guide's limit of 4 and 5.

So most of this standard is about structure and emphasis. It changes few values.

---

## Changes to the brand guide

Each change below is written into `docs/brand/brand-guide.md` in the same words. Color, type families, the Orb and voice are untouched.

| # | Guide section | Change (same words in the guide) |
|---|---|---|
| C1 | 4.2 Scale | New role: **Stat in a tile or card (changes)**: Inter 650, `tabular-nums`, 1.625 / 2 rem (26/32), the section-title size, so no new size enters the scale; tracking `--tr-title`; Night Ink; unit Inter 500 `--fs-sub` Dusk, 4 px after. Token `--fs-value`, `--lh-value`. |
| C2 | 5.1 Grid and spacing | New named uses: screen title block to first content 16 px; caption eyebrow to the title under it 4 px; a title to its own subtitle, a label to its value, a number to its unit 4 px; card title to the card's content 8 px; groups inside a card 16 px, or a `--line` hairline with 16 px on each side where the kind of content changes; icon tile to its text 12 px; inline glyph to its label 8 px; neighboring bezeled controls 12 px; stacked buttons 12 px, a quiet link 8 px under the button above it; on list pages a group title sits 24 px below the group above it and 8 px above its own group; the last content of a scroll ends at least 24 px above the top of the dock. |
| C3 | 5.1 Grid and spacing | New rule, **Proximity:** the space above any heading is at least twice the space below it. Inside a card, no gap is larger than the card's padding unless a hairline marks it. |
| C4 | 5.1 Hit target | Adds one named exception: the Progress range control's seven segments may narrow to 36 pt wide (still 44 pt tall, contiguous, no gaps) on screens under 375 pt wide. |
| C5 | 5.4 Dividers | Adds: inside a card, never a bordered or shadowed box: use a hairline row, a Haze icon tile or space. A dashed edge marks an empty add slot only, one per group. |
| C6 | 6 Components (intro) | Adds a pointer: spacing uses, the order of emphasis on each screen, containers and the values for section headers, list rows, stat tiles and chart cards are in `docs/brand/layout-and-hierarchy.md`. |
| C7 | 6.3 Segmented control | Adds: at most 5 segments, equal widths, text only. The one exception is the Progress range control (1W, 1M, 3M, 6M, YTD, 12M, All): seven segments in one row under the hero chart, 12 px in from the card's edges. |
| C8 | 6.4 Cards | Adds to Card: a card holds one unit people read or act on; three or more items of the same kind are one card with hairline rows (an inset group), never a card each (the habit grid is the exception). A screen uses at most three card templates. Adds to Hero card: Learned's prompt card is Learned's hero. Journal has no glow: its Remember when card, with the quote inside a Haze wash header, is Journal's hero when it shows. |
| C9 | 6.8 Charts | New rows: range control, labels, size and takeaway (values in section 6.4 below). |
| C10 | 6.11 Empty states | Splits empty states into two forms: a screen empty state (the brand's sentence form) and a section empty state (one 64 px row). |
| C11 | 6.13 Close the day | Its three numbers use `--fs-value`, not `--fs-stat-live`, and its labels are Inter `--fs-sub` Dusk (one big number and one caption per card). |
| C12 | 12.1 Settings | "Fraunces section titles" becomes "Fraunces group titles at the card-title size (22/28)". |
| C12b | 12.1 Journal | "Switch row carrying the wash; Sky segmented" becomes "No Entries / Library switch (owner request); the Remember when card with its quote inside the Haze wash header; Sky segmented (Week / Month) in the calendar card". |
| C13 | 13 Checklist | Adds a line: the checks in section 8 of this standard pass. |
| C14 | 6.8 Charts | The Progress hero chart is bars in every range (owner request: the run chart "much easier to track and view", "drag across the graph and see it", the plan "only for future"). Rewritten rows: Hero chart, Bars, Plan, The now dot, Range control, Labels, Takeaway. New row: Reading a bucket. Removed rows: Plan (line), Progress ruler, Week horizon. Values in sections 2.7 and 6.4 below. |
| C15 | 3.3, 3.5, 8.5 | 3.3 lists one more decorative mark: the `--tick` dot for an empty day ahead on the Progress chart. 3.5: jobs 2 and 6 and priority 2 name the chart's now dot (the ruler's NOW tick is gone). 8.5: in the app the half-sun on the week's horizon is the chart's dome, and a planned run is its dashed outline. |
| C16 | 9.1 Durations and easings | New row: chart bars rising (480 ms each, `--bar-stagger` 12 ms apart, 240 ms from the first to the last at most). New token `--bar-stagger`. |
| C17 | 11 Accessibility | VoiceOver: the Progress chart is one slider; its value is the focused bucket in words. |
| C18 | 6.4, 12.1, 12.3 | The hero card on Progress is its chart card (Running or Strength). 12.1 and 12.3 step 8 name the bars in place of the ruler, the week horizon and the line chart. |
| C19 | 6.3 Chips and segmented controls; 12.1 Plan | The quiet "+ Set" link gains its sibling "+ Add" (Plan's week: a run or a lift, section 2.6 and 6.12 below). The Plan row of 12.1 names the week's line with "+ Add" at its end, the Add sheet and the open day's quiet plus. |
| C20 | 6.16 (new) | The plan builder's assistant, part by part: the container, the pill, the composer, the one Sky button, the veil, the line, the changed controls, the peak tile, the permission step and the copy rule. Its layout is in 2.12 and 6.11 below. |
| C21 | 9.1 Durations | Two new rows: the changed-control ring (1.2 s, once, `opacity` only, each control 100 ms after the one above it) and the plan builder's veil (120 ms in, 100 ms out; the Orb's flight is a page move, 350 ms on `springs.page`). |
| C22 | 9.2 Brand moments | Adds **The Orb lifts**: 150 ms after Send the Orb leaves its place beside the words and flies to the middle of the veil, growing from 28 to 56 px, 350 ms on `springs.page`, and turns to its thinking state. When the answer lands it flies back to the pill, and the pill's own Orb takes over. One Orb the whole time. |
| C23 | 9.4 Reduce Motion | One named exception, the plan builder's veil: the Orb appears in place and holds its still frame, and its `opacity` goes from 1 to 0.6 and back every 1.2 s. The changed-control ring stays as a fade, on every changed control at once, and changed numbers jump. |
| C24 | 2.1, 6.9, 12.1 | Pointers: the plan builder's pill is a 28 px gloss Orb, still; in the New plan sheet the assistant's composer changes the pinned primary button while it is in use; a New plan row in the screen table. |
| C25 | 6.7 The week strip | The kind pill is one size on every day and in every state (34 x 22, centered on its column, 8 px under the numeral), with two glyphs inside the same pill on a two-session day, and one fill system: Paper for nothing done yet, Haze for part, Sky for all, hollow for a day that passed with nothing done. Today's pill loses its Deep Sky ring: today is the Sunrise dot. A day with no session keeps the empty slot. The cell is 83 tall (was 81). Owner request: the pills were uneven. |
| C26 | 6.13 Status row and status sheet; 12.1 Today | The row is the plan pill, with the status pill before it only while a status is on. "On the plan" and "Day by day" are gone (owner request). The plan pill shows the plan's name with its phase and a right chevron. The status sheet opens from the status pill, and in ordinary training from Today's title menu. |
| C27 | 6.1 The floating dock and tab capsule; 6.13 (new rows); 7; 10.2; 12.1 | The Plan tab is named **Fitness** (the page is Fitness, a plan lives inside it; routes and file names keep `plan`), with the set's run glyph. **Fitness is a switch** in Settings, on by default: off, the tab is not drawn and the five tabs that remain share the capsule evenly, and no screen names training. **Today's sections are switches** too ("Today shows": Habits, Plan your day, What I learned), reached from Settings and from "Edit Today" at the bottom of Today. Layout in 2.3, 2.6, 2.7, 2.9 and 2.11 below. |
| C28 | 6.1 The floating dock and tab capsule; 6.4; 6.5a; 6.13; 10.2; 12.1 | **What I learned and Journal are one tab, Journal** (owner request: "combine the journal and what i learned", by the logic every screen now follows: one poster that says where things stand and what the next move is, quiet rows below). The capsule is Today, Goals, Fitness, Progress, Journal: five tabs, four with Fitness off, the open book last. A day has one **line** (what I learned, one sentence, the least a day needs) and may have **entries** (longer, as many as wanted); copy says "line" and "entry". Journal's hero is the dusk poster with the week's lights; a light is lit on a day with a line or an entry. The one field under it starts from the day, never blank, with "Finish the line" as the one Sky button; once the line is kept the same spot offers "Write more about today". Remember when is one quiet card under them, no longer the hero, and draws from lines and entries. Months are one list, and a month is a pushed page (`/journal/2026-11`): the month calendar, then the days, each with its line as the headline and its entries under it. `/learned` and `/learned/:month` lead to `/journal` and `/journal/:month`. Today's row and its switch read **Journal · One line is enough** (the stored key stays `learned`). The tour and the welcome pager have one Journal page. Layout in 2.3, 2.5, 2.9, 6.8, 6.9 and 7 below. |
| C29 | 6.1 The floating dock and tab capsule; 6.4; 6.5a; 6.8; 12.1 | **Progress is part of Fitness** (owner request: "fitness and progress can be combined in the same manner"). Fitness says what is next, then how it is going: today's training card, this week, then a section headed **Progress** (the chart with its ranges and its drag), **Trends** (the tiles, and the body's numbers when Apple Health is connected) and the plan row. The capsule is Today, Goals, Fitness, Journal: four tabs, three with Fitness off. The Progress tab and "Progress" as the name of a place are gone; `/progress` leads to `/plan`, and a metric's page keeps its address (`/progress/metric/:id`) and is pushed over Fitness. Runs / Workouts on the training card and on the chart are one choice, in one pair of words. With no history the chart's place is one quiet row, never an empty frame. Two things on Progress were not training and moved: the habits' consistency chart to Today's Habits, History; and, with Fitness off, sleep, HRV and resting heart rate to Settings, Apple Health. With Fitness off every `/progress` address leads to Today. The tour has one Fitness page. Layout in 2.6, 2.7, 2.9, 2.11, 6.4 and 7 below. |
| C30 | 4.3; 6.4; 6.8; 6.9; 9.1; 10.2; 12.1 | **After the brand check of the two merges.** Remember when on Journal is plain Paper with its quote at `--fs-sentence-sm`, and its caption is two words. A light on the Journal poster is a button at 375 pt and wider only. The Close card's "Finish the line" is the secondary until the person has written (Today keeps one Sky button at rest). The week pager's height is a named motion case. "Workouts" is the word under the Runs / Workouts choice. The Fitness row of 12.1 describes the page as built. | The guide said one thing and the merged screens another in each of these; the screens were right in six and the guide in four, which are fixed in code. |
| C31 | 12.1 Onboarding and welcome; 6.13 | **Onboarding looks like the app it leads into** (owner request: "redesign on boarding to align with styling and the pages that exist"). Every onboarding screen stands on the dawn wash and is built from the poster kit and the app's real components. The welcome pager is three pages (Today, Fitness, Journal), each a real poster with sample content, the dock and its Orb under it. Each question is one frame: the bar (Back and the progress marks), the question in Fraunces at the section size, one Dusk line, a poster that the answer changes live, the controls on Paper, a quiet link only where skipping is real, and one Sky button in the same place on every question. The tour is out of the path: the last question leads to the plan being written and the reveal (Today as a poster stack made of the answers, "Open Today", and the quiet "See how Orby works"). On the day setup is finished Today leads with the day poster, whole, and its lit stop is the first move. Layout in sections 2.3 and 2.11 below. |
| C32 | 2.3; 2.4; 4.2; 9.1; 12.1; layout 2.11 | **After the brand check of the new onboarding.** The welcome pager's header is the wordmark alone (the ask bar under the posters has the Orb). `--fs-hero` has no user: onboarding's largest line is `--fs-title`. The welcome ground is the dawn wash. "Get started" is on every pager page. A tour demo's pictured Sky verb is named as the one exception to the Sky count; selections on the questions are not buttons. Motion in the flow uses the named transitions. | The guide still described the old welcome in five places, and the check found two Orbs on the pager and literal durations in three transitions. |
| C33 | 12.1 Onboarding and welcome; layout 2.11 | **First-visit tips** (owner request: "Include like a popup type onboarding explaining how it works, how it's tracked"). After setup, the first visit to each tab raises one tip, once: the app's own sheet at its content's height, the caption "How it works" over the tab's name as the title, one Paper card of section rows (6.11) saying how the place works and, under the card's one caption "How it's tracked", what counts and when a change is saved, then Sky "Got it" and the quiet "See it in the tour". No tip names training with Fitness off. Settings can show them again. Layout, when one shows and the words' rule in section 2.11 below. |
| C34 | 2 (intro), 2.1, 2.6, 2.7; 3.1, 3.3, 3.5; 5.3; 6.5a; 6.13 (three new rows); 8.5; 9.1, 9.2, 9.4, 9.5; 10.2, 10.3; 11; 12.1; 13 | **Orbs: the earned reward** (owner request: "I want to include Orbs that are rewarded. They should pop up in the screen, be haptic, fun, fluid, dynamic, motion", "Base it in Neuropsychology and behavioral science"). The rule of the two Orbs: the Orb is the assistant's glossy blue sphere, one per screen; an earned Orb is an orb of light: Apricot, glowing, never glossy, never blue, never Sunrise, no Paper keyline, and it appears only as a reward and on the Orbs page. The Don't about an Orb as a habit coin, a bullet or a decoration now names the assistant's Orb, and the earned light has its own Do and Don't. Rewards are in the brand's own light: no confetti, no mascots, no chance imagery, no loss framing; never a zero, a "best", days in a row, anything that ended or anything nearly earned. The earned Orb's drawing, its moment (born at the control on the control's own peak, gone by 620 ms, an arc to the counter while it is on screen, three for a session or today's goal), its Reduce Motion form, and the one full-day haptic exception. The words: Orbs, days off, days this week, in all, weeks in a row, Today's challenge, Add to today, Skip, Easier, Ask the assistant to pick, Level N, Pause, and the rule "One thing a day. Two days off a week." Today's counter beside the title-line sun, the challenge row in the Plan your day card's foot, the Orbs switches, the keepsake disc, the Orbs page and How Orbs work. Big moments open full screen at most twice in any seven days. Layout in 2.3, 2.9 and 2.13 below. | The guide allowed one Orb and no reward of any kind. The research (`reports/Streaks rewards and challenges.md`) supports small, immediate, informational rewards and a weekly count with days off, and warns against loss framing, chance and all-or-nothing bonuses; the earned Orb is drawn as light so the assistant's Orb stays the only one of its kind. |

**Considered and not changed.** The screen title stays at 38/42 (`--fs-title`). Apple's Large Title is 34 and the hero's session name (40) is within 5 percent of the title, but the brand raised the title from 34 to 38 on purpose. The hero card already wins on Today by area (about 360 pt tall against a 42 pt title line), by the glow and by position once the rows above it are compacted (section 2.3). Body text stays 16/24: Apple's own advice is loose leading for long passages, and 16/24 measures 49 characters a line in a card at 390. The 16 px gutter stays at every width. It is inside Apple's 16 to 20 pt system margin, and one gutter keeps every edge aligned.

---

## 1. Principles

1. **One screen, one job: the most important thing is the largest, highest-contrast thing near the top.** [WWDC26 250, HIG Layout, NN/g fold studies, PR Lagun 2014]
2. **Space is the structure: inside a group is always tighter than between groups, by at least 2x.** [HIG Layout, NN/g proximity, PR Palmer 1992]
3. **Use the lightest container that works: space, then a hairline, then a card; like items are rows in one card.** [NN/g common region and cards, HIG Lists]
4. **Few levels, clear steps: four type levels per screen, each a visible step from the next.** [HIG Typography, NN/g visual hierarchy]
5. **Say each thing once; show today and fold the rest one labeled tap away.** [HIG Layout and Disclosure controls, NN/g progressive disclosure, Peers: Oura]

---

## 2. The screen

### 2.1 Rules for every screen

| Rule | Value | Check |
|---|---|---|
| One focal point | Exactly one element is both the largest block and the highest-contrast block. It is the hero card where the screen has one. | Section 8, squint test. |
| One primary action | At most one Sky button visible at any scroll position (brand 6.2). A screen may have none. | Count Sky fills on buttons. |
| Focal point high | The focal element's top is at most 300 pt from the top at 390 x 844 in Playwright (which reports a 0 safe area). Its key value (the readout, the number, the prompt, the first row) is fully above the dock. | `getBoundingClientRect()`. |
| Wayfinding stays quiet | The date caption, the screen title, the week strip and status pills are read once in passing. They never sit inside the hero or compete with it, and nothing between them and the focal point adds a row. | Look at the first screen. |
| No false floor | At the first-screen fold, something crosses the dock line (a card edge, the next section title). No empty band or flat block ends at the fold. | Screenshot at each width. |
| Today's essentials in two screens | Everything a person needs today is reached within 1,260 pt of scroll at 390 x 844. History and "further out" may come later. | Scroll offset of the last "today" element. |

### 2.2 Order of emphasis per screen

Each table names the screen's job, its focal point, its one Sky button, what is read in passing, and the order the eye should take. "Build" lists the changes the screen pass makes, each with its reason. The approved features and their order stay as they are. Only spacing, size, grouping, density and emphasis change.

### 2.3 Today

| | |
|---|---|
| Job | See today's session and get through the day. |
| Focal point | The hero card (the week horizon). |
| Sky button | "Set this goal" on the lit first stop of Plan your day, only while today's goal is unset. Otherwise none. The habit coins are the screen's most used control. |
| Read in passing, above the hero | The title block (date caption, "Today", the quote), the week strip, one row of status pills (the plan pill; the status pill before it only while a status is on). On today's own page, today's Orbs as a numeral beside the title-line's sun (below). Nothing else sits above the hero. |
| Order of emphasis | 1. Hero: the session name, the detail line under it, then the band on the far hill: the label ("Runs this week") with its count, the miles, and the view pill at the band's trailing edge. Under the hill's edge, in the same card: the Morning / Afternoon / No time control, then the morning line or the log line. On a day with no run and no workout: the title, one line for what comes next, the dusk scene, the week's totals. 2. Plan your day, directly under the hero: the slim poster (guide 6.5a). The title (the question, or today's goal), the band (one idea and its source, or the to-dos' count), then the line of stops: the lit stop first ("Set this goal", or the next to-do with its check), the top three to-dos, "Add a to-do" and "All to-dos". 3. Habits: the two-column tile grid. 4. Under the line, only while there is some: a review owed, "Close yesterday", and after 5 pm "Set tomorrow's goal". |

**The first day.** On the day setup is finished the plan has not started (it starts the next day), so the training card would only say "Nothing planned". On that day, while no session and no run is on it, the day poster leads, whole, right under the plan pill: its lit stop ("Set this goal", from the idea in the band) is the one first move, in place, above the dock. The training card's slot keeps only the evening's Close card. From the first session or run on, and on every later day, the order is the one above. Why: one clear next action on first open, with the app's own control and its own reward (the haptic, the toast with Undo, the title rising), and no tutorial overlay.

**What Today shows, and Fitness off.** Today's sections can be switched (`lib/prefs.ts`; the list is "Today shows", in Settings and behind "Edit Today"). Fitness on, the order is the one above, with one row added last: 4. the Journal row, one list row at the foot of the day. Before tonight's line: "Tonight's line" over "One line is enough", and a tap opens Journal with the field ready. After: the line itself in the row, with "Write more" trailing. The day's entries stay in the timeline below. Fitness off, the hero, the kind pills, the status row and the second-session card are not drawn and nothing names training: the week strip is the letter and the numeral only (54 tall), and the day's own sections lead, 16 px under the strip: 1. Plan your day, as the full poster with the sun and no section header (the poster's title is the head), 2. Habits, 3. the Journal row. Today has one order in both modes: Fitness off only removes the top card. In the evening the Close card still takes the first place, without a session row or a miles stamp. A section switched off leaves no gap: what follows moves up. With every section off the page is one Dusk line ("Nothing is set to show on Today.") and one quiet Deep Sky link that opens the list. **"Edit Today"** is the last thing on the page on every day: one quiet link (6.6), centered, a 44 pt target, a section's gap (32) above it, opening the "Today shows" sheet. A choice of what a screen shows is made on that screen [HIG: Health's Edit beside Pinned, Fitness's Edit Summary]; the Fitness switch is general and lives in Settings only.

**Orbs on Today** (brand 2.1, 6.13, 9.2). Three things, and nothing else is added to Today:

- **The counter sits beside the title-line sun, not as a new mark.** Today's title line already carries the Apricot half-sun (brand 5.3). Today's Orbs stand beside it as a numeral: Inter 600 15, even figures, Night Ink. The sun and the numeral are one 44 pt target that opens the Orbs page ("Orbs. 12 today. Level 5."). On today's own page only: no numeral on another day's page, none before the day's first Orb (never "0"), none while Orbs are off. It keeps a fixed width for its figures, so the title never shifts when the number changes. Why: a second warm dot by the account button would be a new thing to read; the sun is already there and already light.
- **A challenge is one row in the Plan your day card's foot**, where "Review" and "Set tomorrow's goal" sit: 56 tall, the challenge's title over "Today's challenge · 5 Orbs". A tap opens a small sheet ("Add to today", "Skip", and "Easier" where it has a size). Only while one is on offer or running. Why: a challenge is part of planning the day, and the card's foot is where the day's optional rows already live.
- **Big moments are rare.** A full-screen moment (a week, month or year goal; 4, 12, 26 or 52 weeks in a row; 100, 365 or 1,000 days in all; a chapter) opens at most twice in any seven days, never from a routine tap (after the Close card's save, or on the next open at rest), with an explicit "Keep going" and no auto-close. The rest wait as "New" on the Orbs page. Today's goal no longer opens a full screen: it gets three earned Orbs at its check. Why: the more often a moment plays, the smaller it must be [NN/g]; the everyday Orb is an acknowledgment at the finger, and the celebrations are the few large ones.

Build:

- **Status chips become the brand's status pills.** One row of 32 pt `--glass` pills, each with a 44 pt hit, 12 px apart, from the left gutter: 16 px under the week strip and 12 px above the hero. This is the spec in brand 6.13. They used to render as two-line context chips 56 pt tall. Why: it removes 24 pt above the hero, and these are status, not content.
- **One pill on most days.** The plan pill is always there: the plan's name and the phase ("Half marathon · Warm-up week"), or "Make a plan" with no plan now or ahead. The status pill sits before it only while a status is on ("Sick · until Fri"). Ordinary training has no status pill: "On the plan" and "Day by day" said what the plan pill and the hero already say (owner request, and principle 5: say each thing once). The status sheet opens from the status pill, and in ordinary training from Today's title menu ("Change training status…"), so it stays one labeled step away. When two pills do not fit, the plan pill drops the plan's name first, then the status pill drops its end. With nothing to show there is no row, and the hero starts 16 px under the strip.
- **The week strip's kind pills are one size** (brand 6.7): 34 x 22 on every day, centered under the numeral, the same 8 px gap on every day, and a day with no session keeps the empty slot. Why: pills of two widths and five fills under seven equal columns read as a mistake, not as a state. One shape lets the fill carry the state (Paper, Haze, Sky, hollow).
- **"Close yesterday" moves into the carry-over row of Plan your day.** Why: it is yesterday's business, and the carry-over row is where yesterday lives. Today it is a seventh row above the hero.
- **The quote wraps to 2 lines at most** (line clamp 2, the full quote on tap). Why: an unbounded quote pushes the hero down by a different amount each day.
- **Target: hero card top at 300 pt or less** (now 358) in Playwright at 390 x 844, and the band above the dock on a device (Playwright top + 59 pt Dynamic Island inset + 215 pt to the band's bottom ≤ 690: 232 + 59 + 215 = 506). Why: the 14 peer apps put their focal element 11 to 32 percent down, median 22 [Peers], and attention falls off toward the fold [NN/g].
- **The band reads what the picture counts, then the miles:** "RUNS THIS WEEK" over "0 of 4 · 0 of 15.5 mi" (brand 6.5, 11). Why: a value with context is simpler to act on [WWDC26 250], and the band is the drawing's text equivalent.
- **The hero card has two zones.** The scene zone (full-bleed), then the control zone on Paper (time of day, morning line). The far hill's straight edge is the divider, with 16 under it: no hairline. The view pill changes what the scene counts, so it sits in the scene zone, on the band, never in the control zone; it is the card's quiet control, 28 tall against the When control's 44. Why: a control inside the picture's group reads as part of the data [Peers: Oura, WHOOP keep controls out of the dial].
- **Plan your day is the day's poster, above Habits (A2).** One card from the poster kit: title, meta line, band, the line of stops. Why: planning is the day's first decision and habits are repeat taps that do not need the top; below Habits it sat a full screen down. What moved one tap away: the goal's why, steps and done or not (a tap on the title opens its sheet); to-dos past the first three and the done ones past two ("All to-dos"); a to-do's flag, list, note, day and place in the order (a tap on the stop opens its editor; the flag still shows after its words); Done on a later stop, Make it next, Tomorrow, Someday, Make it a step and Delete (a hold on the stop); the carry-over row (yesterday's unfinished goal is the first idea in the band). Removed: the help paragraph and the tip, the numbered box, the fold row, the drag docks. This supersedes the row list in the next bullet.
- **Plan your day is one card.** Rows in order: today's goal, the carry-over row (with "Close yesterday"), the top three, "3 more", then "All to-dos ›" as the last row (a quiet link row). This replaces the separate carry-over card and the full-width "All to-dos" pill card. Why: like items in one container [HIG Lists]. Today there are three containers for one list.
- **The goal prompt on Today is 17 px Fraunces italic Dusk** (`--fs-sentence-sm`), not 22. Why: 22 italic is a hero size, and here the prompt is a row inside a section. This also brings Today to 4 Fraunces sizes (38, 40, 26, 17).
- Inter sizes on Today: 11, 13, 15, 17 and one more at most.

### 2.4 Goals

| | |
|---|---|
| Job | Set and keep today's goal; see what is next. |
| Focal point | Today's goal as the poster (brand guide 6.5a): the question or the goal in Fraunces, the day scene, one band. |
| Sky button | "Set this goal" while unset (with no idea to offer, "Set today's goal"). None once the goal is set: the check is the next move. |
| Read in passing | The title block; the hills' captions. |
| Order of emphasis | 1. The poster: the question or the goal, the band, the button or the check. 2. The quiet card under it, only while it has a row: a review owed, and from 5 pm tomorrow's goal. 3. Further out: three hills (the year far, the month, this week near). 4. History. |

Build:

- **Today's goal is the poster**, the same card and state as Today's. Its controls sit on Paper under the band: "Set this goal" and "Something else", or "Not done yet" with the check. Carrying yesterday's goal over is the first idea the band offers ("An idea · from yesterday").
- **The quiet card under the poster** uses the one row template (icon tile, title 17/600, subtitle 15 Dusk): the review owed ("Still open from Mon, Nov 9", trailing quiet "Review") and, from 5 pm, "Set tomorrow's goal" with its date and a chevron. No card when it has no row.
- **Further out is one card of three hills** (the kit's FarHills), 12 under the poster or the quiet card: no section title above it, its caption is on its own sky. Each hill is one target of 48 pt or more that opens its goal, or the way to set one. One plus only, on the nearest hill with no goal; nothing reads "Not set". The caption opens "Coming up": tomorrow's goal and next week's, one row each. The Tomorrow and Next week chips are gone from the page.
- **History drops the inner "Goals kept" label**, and the section meta says it instead ("History · Goals kept"). Four columns: label 15/500 Dusk, value `--fs-value`, context 13 Dusk. No colored tick before each label. A period with no data shows "None yet", never "–". Why: a section title stacked on a card label is two headers for one thing (section 4.4), and zero or no data is a value [Orby rule H50].
- Card templates on Goals: the poster, the hills, the inset group (the quiet card, History).

### 2.5 Journal

What I learned and Journal are one tab (C28). Every day has one **line** (what I learned, one sentence) and may have **entries** (longer, as many as the person likes); the line is the day's headline and the entries sit under it. Copy says "line" and "entry", never "learning", "note" or "log". The data keeps its two kinds and their names (`learnings`, `journal`); the page reads both and lays them out by day. `/journal` is the tab; a month is `/journal/2026-11`, pushed; `/learned` and `/learned/:month` lead here.

| | |
|---|---|
| Job | Write one line about today; say more when there is more; look back. |
| Focal point | The dusk poster (brand 6.5a): the question, the week's seven lights, the band. |
| Sky button | "Finish the line". With only the starter in the field it puts the caret there; with words of the person's own it saves. None once the line is kept: "Write more about today" is a quiet row. |
| Read in passing | The title block; the band's count ("This week · 3 days written"). |
| Order of emphasis | 1. The poster: "What did you learn today?" (after the line is kept, the line itself as the title, in Fraunces), "One line is enough.", the lights with "Tonight" as the lit next one, the band. 2. The composer, attached under the poster: one field, started from the day, and "Finish the line"; after the line is kept, the same spot is one quiet row, "Write more about today", which opens the entry writer in place. 3. Today's entries, when there are any: quiet rows, newest first. 4. Remember when: one memory from the past, a line or an entry. 5. The archive: the months, newest first ("November · 9 days written"). 6. Search: the magnifier in the nav bar, shown once anything is written. |

Build:

- **One poster says the question, shows the week and takes the line.** Why: the owner chose one poster card per screen (design A2), and two tabs that both meant "write something about your day" left a new person unable to tell which to open. The best reflection apps have one place, never open on a blank field, make the smallest entry enough and reward the save (`reports/Clear next action in lifestyle apps.md`).
- **A light is a day written.** A day's light is lit when that day has a line or an entry; today both count. The band is gain-framed ("3 days written this week", "Your first line lights tonight"): no streak word, nothing that shows a broken run, on the page or in its VoiceOver labels. A missed day is an unlit light, not a broken chain. The week view and its arrows are gone: the poster's lights are the week, and a tap on a past light opens that day in its month.
- **The field is never blank.** It opens with the starter ("Today I learned", or the one from the day's run, lift or habits) and its question stays in view while typing: the poster's title at rest, a caption over the field while it has focus. The field and its button stay above the keyboard together. Saving plays the reward: tonight's light fills, with the haptic.
- **One primary button at any time.** Before the line: "Finish the line", with a small quiet link under the field, "Write a longer entry", for a day that starts with an entry. After: no Sky button, and "Write more about today" opens the entry writer (its draft, the day's quote as a prompt, the 5,000 limit). A paste over the line's 1,000 limit offers "Save as an entry" in place of a cut.
- **Today's entries are quiet rows** under the composer (6.2): the time, the first lines, the favorite star. A tap opens the entry sheet: edit, share, favorite, delete with Undo.
- **Remember when is one card, and it is not the hero** (6.9). One memory at a time, a line or an entry, with its consent switch and its "Written by AI" label as they are. The line echoes that were "From your archive" (a year ago, a month ago) show in this card, so there is one object from the past.
- **Months are one inset group** under Remember when, with no year heading for this year; a month appears once a day in it is written. An earlier year is a section under its name and count. There is no "No months yet" row: the poster is the empty state.
- **A month is a pushed page** (`/journal/2026-11`): the month calendar on top (a disc on each written day; a tap on a day jumps to it), then the days, newest first. Each day: its date, its line as the headline (a tap opens the line's sheet: edit, delete with Undo), its entries under it (a tap opens the entry sheet). A day with entries and no line shows "Add the line" as a quiet link, never an empty row. An empty past day reached from the calendar opens the composer for that day.
- **Search is one field** (the magnifier at the end of the nav bar): results from lines and entries together, grouped by day, the match marked. Either kind may fail to load on its own; the other still shows, with one Try again.
- Card templates on Journal: the poster (with its composer), the inset group (today's entries, the months), the Remember when card.

### 2.6 Fitness (the Plan tab)

The tab and the page are named **Fitness**: a plan lives inside it ("Your plan", "Make a plan" keep their words). Routes, files and ids keep `plan`; `/fitness` leads to `/plan`. Progress is its lower half, not a tab (C29): `/progress` and `/trends` lead to `/plan`, and a metric's page keeps its address (`/progress/metric/sleep`) and is pushed over Fitness. With Fitness switched off (Settings) the tab is not drawn or mounted, and its routes (`/plan…`, `/fitness`, `/settings/training`, `/settings/plans`, and every address under `/progress`, the metric pages included) lead to Today.

| | |
|---|---|
| Job | See what is next and change it; then see how it is going. |
| Focal point | The training card from Today (the hero). On another week, that week's summary card. |
| Sky button | None on the root. In the summary sheet: "Apply" on a proposal. In the Add sheet: "Add". |
| Read in passing | The title block (the caps date is the way to the month); the one-time hint line; the section titles "Progress" and "Trends". |
| Order of emphasis | 1. Today's training card: the session, the week horizon, the band with the week's count and its Runs / Workouts pill, the log line. It is the page's one lead object. 2. This week: the days ahead as stops on the dotted line, "Add a session" as the last stop, "Earlier this week" folded. 3. Progress, a titled section: one card with the headline number, the bars, the range row, read by a drag across it. 4. Trends: the tiles (Weekly mileage, Run pace, Lift volume) and, when Apple Health is connected, the body's numbers (Sleep, HRV, Resting HR) as one group under them. 5. The plan row, last. |

Build (the A2 design, guide 6.5a "Fitness"):

- **The training card leads, the same card as Today's.** One card, one behavior on both pages: tap to open the session, hold the ring to mark it done, the band opens the week. On Fitness it does not give way to the Close card in the evening. A second session today is the compact card under it, as on Today. Why: the next thing to do is the page's point, said once in one form.
- **Another week is the same card as a summary.** Its name and dates, the week's horizon and band, a quiet "This week" link under the hill. No log line: nothing there can be logged from the card.
- **The days ahead are stops on one line**, in one card 12 under the hero: gutter 16, the rail 64 wide, each stop at least 48 tall (72 with its caption and line), the whole row one target that opens the session sheet. Every session action (mark done, floor, skip, move, edit, delete) is in that sheet. Days with nothing on are not drawn: the line shows what is on, and "Add a session" ends it (the Add sheet, where the day is chosen). An empty week is one lit stop: "Nothing on this week yet", "Add a session".
- **Earlier this week folds.** One 56 row at the card's foot, a hairline over it; it opens the days before today in place, as stops with what happened. A week behind shows all its days this way with no fold.
- **The plan is a quiet row**, last on the page, under Trends: a 32 px tile (a dashed plus with no plan), the name in Inter 600 17, one Dusk line, a chevron. It opens the plan summary sheet with the assistant inside (6.10), or the builder when there is no plan; a hold offers Open the plan, New plan and All plans. The weeks-done row is in the summary, not here.
- **No week header, no totals line, no Week / Month switch, no week arrows.** The band counts the week; a sideways swipe on the card or the week moves a week (the chart under them reads a sideways drag as a reading, never as a page); the caps date with its calendar glyph opens the month, and from the month goes back ("Week", a quiet link over the month's header, does the same). The title returns to this week. One Dusk line under the title says this once on a device ("Swipe for other weeks. Tap the date for the month."), a 44 pt target that dismisses it; it also goes on the first swipe or the first tap on the date.
- **The Add sheet** (6.12): the day, Run or Lift, the essentials, Add. It opens from the line's last stop, on the day `defaultDay` picks. The session lands on the line at once with a toast and Undo, and the card's band counts it.
- **The week pages; Progress does not.** The pager (a sideways swipe for other weeks, the date for the month) wraps the training card and This week only. Progress, Trends and the plan row sit under it, outside it: they are about ranges, not about the open week, so they do not slide away or redraw when the week changes, and the Month view replaces the card and the week only. A drag that starts on the chart reads the chart and never pages the week; a swipe anywhere else pages the week [HIG Gestures].
- **Opening the tab starts at the top** (today's card). Coming back from a metric's page returns to where the person was. The week hint stays one line, shown once.
- **Progress is one card under its title** (6.4): the headline number with its context ("227 mi in 3 months"; "9.3 of 23 mi · 2 of 4 runs" for 1W), one takeaway line, the bars, the range row (1W, 1M, 3M, 6M, YTD, 12M, All; default 3M; each viewer's last choice is remembered). The card has these parts in every range. Why: Apple's own apps offer period choices on detail charts [HIG Charts]; the row sits under the plot so the number stays at the top of the card, and changing the range keeps one chart style [HIG continuity].
- **The chart is bars, one per bucket, never more than 26 of them** (brand 6.8): days in 1W, weeks in 1M, 3M and 6M, months in 12M, and in YTD and All once they hold more than 26 weeks. An All longer than 26 months keeps reading by month (12 thin bars a year). Owner request ("much easier to track and view"). Why: a bucket is a total, and totals compare best as lengths from a common baseline [PR Cleveland and McGill 1984; HIG Charts]. A week with nothing is a gap, not a plunge to zero.
- **History shows what was done; the plan shows only for what is ahead.** Owner request. The days to come in 1W and the rest of the bucket holding today draw the plan as a dashed outline, labeled "Plan". The takeaway says the usual week or month and never grades the past against a plan. In 1W "to go" is what the plan still asks for; a mile or more that the plan did not ask for is said ("9.3 mi ahead of plan, 12.5 mi to go").
- **Drag across the chart to read a bucket** (brand 6.8, "Reading a bucket"). Owner request. The readout is the headline, above the plot and never under the finger [HIG Charts]. The chart claims a touch only once it is clearly sideways, so the page still scrolls from anywhere. One line under the plot says how until it has been done once.
- **One switch, one pair of words: Runs / Workouts.** The pill on the training card's band and the choice on the chart are the same stored choice: changing either changes both. "Running / Strength" is gone as a second control. Workouts has the same chart (lift sessions per bucket, sets and pounds in the readout, the same ranges and drag), with its workouts as date rows in a card of their own, 12 under the chart card.
- **No empty frame.** With no history yet the chart's place is one quiet row ("Your weeks draw here", then "After your first run or workout."), the section form (6.5). Nothing on the page is an empty box.
- **Trends is one tile template** (6.3), two columns: a value and its unit on one baseline, a context line under it. Each tile opens its metric's page, pushed over Fitness. The body's numbers are one group under the training tiles, shown when Apple Health is connected; "Connect Apple Health" is one row otherwise.
- Card templates on Fitness: the training card (the poster), the stops card, the chart card; tiles count once (2.1, check 13).

### 2.7 Progress (now part of 2.6)

Progress is the lower half of Fitness, not a tab (C29). Its chart, its ranges, the drag and the Trends tiles are in 2.6 and 6.4.

**What was on Progress and is not training.** Two things moved, and nothing is lost:

- **Habits consistency** (the Habits tile and its chart with ranges): to Today's Habits, History, at the top of the sheet, above the per-habit rows. With Fitness off this is where habit progress lives.
- **Sleep, HRV and resting heart rate with Fitness off**: Settings, Apple Health shows the three numbers, in the same tiles. With Fitness on they are in Trends (2.6) and Settings shows what it showed.

### 2.8 Journal (now 2.5)

Journal and What I learned are one tab. Its order of emphasis and its build are in 2.5.

### 2.9 Settings (and its pushed pages)

| | |
|---|---|
| Job | Change how Orby is set up. |
| Focal point | The You row (name and plan). |
| Sky button | None. |
| Read in passing | The back button and the centered title. |
| Order of emphasis | You, Today shows, Fitness, Habits, Morning routine, Data sources, Privacy, Orbs, App, Data, About, Account (sign out, delete) last. |

Build:

- **Today shows** is three switch rows (Habits, Plan your day, Journal), each with a Haze tile and one line (Journal's is "One line is enough"); switches only, nothing to reorder. A footnote says the training card follows Fitness, only while Fitness is on. The same rows are the "Today shows" sheet on Today (2.3): one list, two ways in.
- **Fitness** is the old Training group under its new name. Its first row is the switch: the run glyph in a Haze tile, "Fitness", one line ("Training plan, runs and lifts"), the switch trailing. On, the training rows follow it (miles, run days, long run, easy pace, Plans). Off, the group is that one row, the You row's subtitle is the account's address, the Strava rows are gone, and nothing else on Settings or its pages names training. Off, Apple Health (Data sources) also shows the three numbers it reads (sleep, HRV, resting heart rate), since there is no Fitness tab to show them.
- **Orbs** is one group before App (brand 6.13, "The Orbs switches"): the switch "Orbs" with one line ("Small lights for what you finish"), the switch "Show Orbs when you earn them" ("Off, the count still grows"), "Your week" with the rule line under it and "5 days" as its value, "Challenges" with its size under it and "One a week" as its value, and "How Orbs work". The two value rows open a small sheet of choices, one chosen, marked with a check. "How Orbs work" opens in a sheet here, so Settings stays under it (on the Orbs page the same row pushes the page). With Orbs off the group is the switch and "How Orbs work", as Fitness off leaves its one row. The same rows are the last group of the Orbs page: one list, two ways in.
- **Group titles drop to Fraunces 600 `--fs-head` (22/28), 24 px above and 8 px below** (C2, C12). Today there are ten 26 px titles down one list, each larger than the rows it labels. Why: on a list page the rows are the content, and grouped lists use quieter headers [HIG Lists, iOS 26 inset grouped lists].
- **Row subtitles are one line.** "7 habits" gets the subtitle "Meditate, Read and 5 more", not three wrapped lines. Why: rows are for scanning; detail is one tap away [HIG Lists].
- **Delete account sits alone at the end** as a destructive button (brand 6.2), with the version footnote centered under it.

### 2.10 The assistant sheet

| | |
|---|---|
| Job | Ask or change anything. |
| Focal point | Empty: the Orb (56) with the greeting. In a chat: the latest answer. |
| Sky button | Send, once there is text. While a proposal card waits, its "Apply" is the Sky button. If the person starts typing instead, "Apply" turns secondary so only Send is Sky. |
| Order of emphasis | Empty: 1. Orb and greeting (`--fs-sentence`), 2. the composer, 3. suggestions, 4. the provider disclosure, exactly as written. Chat: 1. the latest answer, 2. a proposal card if any, 3. the composer, 4. the disclosure. Consent: 1. "Before you ask", 2. the options card, 3. Allow (Sky, 54), 4. Only what I type (secondary), 5. Not now (quiet), 6. the footnote. |

Build: answers run the full sheet width less the 16 px gutter, capped at `max-inline-size: 36rem` on wide screens (section 4.5). The Orb sits 16 px above the greeting, the greeting 8 px above its line, and the composer 12 px above the disclosure. Stacked consent buttons are 12 px apart, with the quiet link 8 px below.

### 2.11 Onboarding

The door looks like the house. Every onboarding screen is built from the app's own poster kit and its real components, so each screen is a true picture of something the person will see inside, and each answer changes that picture as it is given.

| | |
|---|---|
| Job | One idea or one question per screen. |
| Focal point | The poster: a real piece of the app that this screen is about. On a question it changes, live, with the answer. |
| Sky button | One, 54 tall, full width, pinned 16 px above the safe area, in the same place on every question. |
| Ground | The dawn wash, as on every tab. |

**The order.** The welcome pager (three pages), privacy (the assistant choice), the account, the questions, the plan being written, the reveal, then Today with one first move. The tour is not in the path: the reveal's quiet link opens it, it lives in Settings, and it ends where it was opened.

**A pictured button is not a second button.** A tour demo is an inert picture of a page playing by itself. While it plays, the pictured page's own Sky verb ("Set this goal", "Finish the line") may show as it does on the real page, for the seconds the finger is on it, so the person recognises it when they get there. The screen's one Sky control is still "Next". At rest and under Reduce Motion no pictured Sky verb shows. This is the one place check 12 counts a Sky fill that is not a control. On the questions, a selected chip, pill or day disc is a selection (brand guide 3.1 and 6.3), not a second primary button.

**Order of emphasis, screen by screen.**

| Screen | The poster | Order of emphasis |
|---|---|---|
| Welcome pager, three pages | Today's day poster or training card; Fitness's training card over a sliver of Progress; the Journal's dusk poster. Sample content, drawn by the real components. The dock with its Orb sits under the poster on every page. | 1. The poster. 2. The headline (Fraunces, the page-title size). 3. One line (Inter, Dusk). 4. The dots. 5. The Sky button. 6. "I have an account" (quiet). |
| Privacy and the account | None. Every word, control and rule is as it was. | 1. The title, at the question size and place. 2. What is and is not sent. 3. The two equal buttons, nothing preselected. 4. The provider disclosure, exactly as written. |
| Every question (the frame) | See each row below. | 1. The question (Fraunces `--fs-section`, left aligned). 2. One line (Inter `--fs-sub`, Dusk). 3. The poster. 4. The controls, on Paper, 44 pt and more. 5. A quiet link, only where skipping is real, directly over the button. 6. The Sky button. Above them all, the bar: Back and the progress marks, nothing else. |
| Name | The assistant's greeting on a poster's sky: the Orb (the screen's one Orb) over "Good morning, Sam." in the sentence italic. The name is written into it as it is typed; with no name it is the greeting alone, never a sample name. | 1. The question. 2. The greeting. 3. The field. 4. "Skip for now" and "Sign out" (quiet). 5. Next, which waits for a name. |
| Fitness | Two posters, stacked, are the two answers: the week horizon ("Yes, track training") and the day's dotted line ("No, just my day"). The chosen one is lit (its sun, or its Next stop, takes the now color; it carries the check and a Deep Sky edge) and the other's picture dims. Under them the tab capsule shows four tabs or three. | 1. The question. 2. The two posters. 3. The capsule. 4. Next, which waits for an answer. |
| Goal | The far hills: race day the far hill (its date, the distance, the weeks), the peak week (its miles, the longest run, the taper), week one. Read off the real plan; before a goal is picked the hills carry their names only. | 1. The question. 2. The hills. 3. The five goals as pills, a radio group. 4. The race-day wheel, for a race. 5. "No running plan for now" (quiet). 6. Next. |
| Days and miles | The training card: the first run's name, when it is and where the long run sits, the week horizon with one mark a run, and the band "RUNS IN WEEK ONE", "0 of 4 · 0 of 21.5 mi". | 1. The question. 2. The card. 3. The seven days, then "Change long run". 4. The miles. 5. Next. |
| Morning | The training card's own timeline row under the session's name: Wake, Door, Back, Leave (after work: Off work, Run, Back, Dinner). | 1. The question. 2. The card. 3. Before or after work. 4. The two markers. 5. Before you leave. 6. Next. |
| Habits | Today's habit tiles, two columns. Each chip picked becomes a tile; none picked is one quiet line, never an empty box. | 1. The question. 2. The tiles. 3. The chips. 4. Next. |
| Nudge (the phone only) | The notification as it will arrive, at the time it will arrive. | 1. The question. 2. The notification. 3. The two answers. 4. The Sky button, named for the answer. |
| The plan being written | None: the steps the plan really takes, one a beat, as long as the save really takes. | 1. The headline. 2. The steps. |
| The reveal | Today as a poster stack made of the answers: the training card with the first session and the morning's times (with no plan or Fitness off, the day poster with the goal Today will suggest), the habit tiles, tonight's Journal row. | 1. "Your first day." (the page-title size). 2. One line. 3. The stack. 4. "Open Today" (Sky). 5. "See how Orby works" (quiet, under it). |
| Today, the first day | The day poster leads, whole, on the day setup is finished (section 2.3). | 1. The lit stop: "Set this goal", from the idea in the band. 2. The habit tiles. |
| The tour | One page per place, each demo drawn with the real components. | 1. The demo. 2. The headline. 3. One line. 4. The numbered steps. 5. The dots. 6. Next; "Skip tour" in the bar. |

Build:

- **A poster is the app's own component, fed the answers.** The training card is the card's own classes with the week horizon (`HeroHorizon`) and the timeline row (`MiniTimeline`); the hills are `FarHills`; the tiles are the habit tile's face; the capsule is the dock's; the greeting is the assistant's rule. What each is handed for a set of answers is one pure file with tests (`features/onboarding/posterModel.ts`). Why: a look-alike drifts from the app; the real thing cannot. A poster is never scaled down with `zoom` or a transform: it uses the kit's slim size, fewer rows or a shorter scene.
- **The frame's spacing.** The bar is 54 tall under the safe area. The question starts 16 px under it, its line 8 px under the question, the poster 12 px under the line, the controls 12 px under the poster and 12 px apart. The foot is pinned: 24 px of fade, then the button, 16 px from the edges and above the safe area. A quiet link is 44 tall and stands 4 px over the button, so the button never moves between questions; on the reveal it is under the button.
- **Every screen fits 390 x 844 with its safe areas, without scrolling.** At 320 x 568 and at 200 percent text the step scrolls under the pinned foot and nothing is cut.
- **Nothing moves under the finger.** The habit tiles grow up from the chips into room held for three rows, so a starter chip tapped never moves the chips.
- **A poster is a picture.** VoiceOver gets it as one sentence ("Easy 5. Tomorrow, long run Sunday. Week one: 4 runs, 21.5 miles."), read again when an answer changes it; nothing inside it takes a tap or the focus. Focus moves to each new screen's heading. Every drag has a stepper or arrow-key equivalent: the markers are sliders, the miles are a spin button with plus and minus, the long-run hold has "Change long run".
- **Motion and haptics.** A step slides in from the side it is ahead of (`springs.page`); a choice ticks once (select); the reveal's stack rises part by part (transform and opacity, 90 ms apart) with one success haptic as it arrives. Under Reduce Motion every one of these is a fade.
- **Now marks.** At most one Sunrise mark on a question: the week's sun on the training card, or the lit choice on the Fitness question.
- **Rules that did not change.** Which questions are asked (Fitness off skips every training question; no running plan skips the days and the morning; the nudge only where one can be sent; a replay from Settings saves nothing), the race warning and its one-tap way out, and the long run moving to the last run day when its day is switched off.
**First-visit tips.** The first time a person opens each tab after setup, one small sheet rises over it and says how the place works and how it is tracked. One per place, once per phone; the tour stays the longer version. The onboarding research asks for this in place of a tour deck (`reports/Mobile app onboarding best practices.md`, P1: "first-encounter tips") [NN/g].

- **Anatomy, top to bottom.** The app's own sheet at its content's height: it fits 390 x 844 and 320 x 568 without scrolling and scrolls at 200 percent text. The caption "How it works" over the title, which is the place's name as its tab writes it. One Paper card, padding 16, with two groups 16 apart and a hairline between: how it works (two rows at most; the caption over the title is its heading, so the words are printed once) and "How it's tracked" (two rows at most, under the card's one caption). A row is the section row (6.5): a 32 px Haze tile with one glyph of the brand's set, a line in Inter 600 `--fs-row`, a second line in Inter `--fs-sub` Dusk that may wrap; rows 12 apart, nothing to tap. Then the sheet's one Sky button, "Got it", 54 tall, and one quiet link 8 under it, "See it in the tour" (Inter 600 `--fs-sub`, as first run's "See how Orby works"), which opens the tour on that place's page and comes back to the tab. No picture.
- **When it shows.** The tab is on screen at its root (not a pushed page, another day or week, first run, the tour or a replay of setup), its tip has not been seen, and the tab has been painted, clear and untouched for 600 ms: no splash, no hand-off from first run, no skeleton, no sheet, assistant or menu, no field in use, no finger down and no scroll. A tab change before it rises cancels it, and two never rise without a tab change between them. Dismissing it any way (Got it, the link, Close, a flick down, Escape, Back, the scrim) is the tip seen, kept on the phone only. Settings has "Show the tips again" beside "How Orby works".
- **What it never does.** With Fitness off there is no Fitness tip and no tip names training. A line about a section of Today that is switched off is left out, and with nothing true left to say there is no tip. On the first day Today's tip names the first move ("One goal for the day"), and the lit stop is on screen when it closes. VoiceOver starts on the title; when the tip closes, focus is back on the tab's own button.
- **The words' rule.** Every line under "How it's tracked" says exactly what this build does: what counts, what a light or a count means, when a change is saved. The words live in one file (`features/tips/tips.ts`), which names the code that makes each line true and is checked by its tests. A line that is not true for every account is changed or left out, never bent, and a line never names a source the build does not have.

### 2.12 The New plan sheet (the plan builder)

| | |
|---|---|
| Job | Set up a running plan in a minute, by tapping or by saying it. |
| Focal point | The plan preview in the sheet's header: the plan's name, its dates and its weeks drawn as rows. It follows every change. |
| Sky button | The sheet's verb, 54 tall, full width, pinned: "Use this plan", or "Replace 12 sessions" when it clears planned ones. While the assistant's composer holds words, Send is the Sky button and the verb turns secondary (the rule of 2.10). |
| Order of emphasis | 1. The preview. 2. The assistant's pill, "Describe your plan". 3. Training for. 4. Run days. 5. Weeks and miles, and the peak once one is set. 6. Start and race day. 7. Week by week. 8. The foot: the start line, then the verb. While the assistant works: 1. the Orb, 2. the status line, 3. Stop. After an update: the line under the pill, then the controls it changed. |

Build:

- **The assistant sits second, under the preview and above the first control** (parts in brand 6.16, values in 6.11). Why: saying the plan is the fastest way to fill the sheet, so it comes before the controls, and the preview above it shows the result of either way.
- **The composer opens in place.** No second sheet and no jump to the assistant sheet [HIG Sheets]. The answer is the builder's own controls changing, with one line that says what changed and an Undo.
- **The veil covers the preview and the controls, never the title bar.** Close stays in reach, and closing cancels the request.
- **While the composer has the keyboard the pinned foot steps out**, and on a screen under 700 pt tall the preview steps out too. Why: the composer, Send and the provider line stay above the keyboard at 320 x 568.
- **The permission step shows in place of the controls** (the consent order in 2.10) when the account has not answered. "Not now" returns to the builder with nothing sent.
- **At 320, and at Larger Text sizes**, "Undo" and "Try again" sit under their words and "Let the plan pick" sits under the peak tile's label.

### 2.13 Orbs (pushed over Today)

| | |
|---|---|
| Job | See what has been earned, and understand the rules in one screen. |
| Focal point | The poster: the total, and under it the level. |
| Sky button | None. Nothing on this page asks for an action. |
| Read in passing | The back button and the centered title, "Orbs". |
| Order of emphasis | 1. The poster (brand 6.5a): the total in Inter 650 at `--fs-stat-live` with its unit "Orbs", the kit's Apricot sun standing at the progress to the next level on the dotted way, then the band, "LEVEL 5" over "216 to level 6". 2. The week, on Paper under the band, in the same card: seven 12 pt marks over their letters, Monday first, from the poster's left edge, then one Dusk line ("5 days this week · 128 in all · 6 weeks in a row"; on a Monday the line "New week. Two days off in hand." stands over it). 3. One inset group, 12 under the poster, only while it has rows: "Today" with "9 Orbs" as its value (a tap opens the day's lines), a week goal that is new, the challenge rows. 4. Keepsakes: a section title, then one Paper card with 48 pt discs four across, a date under each, one dashed ring first for what comes next, and one footnote that says it ("Next: 4 weeks in a row"). 5. Last: one inset group with "How Orbs work" and the switches (2.9). |

The two-second read is three facts: how many, which level, this week. Everything else is below the fold or one tap away.

Build:

- **One number per card, one caption per card.** The total is the page's one big number (`--fs-stat-live`, held between 44 and 64 px so a very large text size cannot push the picture off the first screen). The band's caption ("LEVEL 5") is the poster's one caption: the week's letters are Inter 600 `--fs-foot` Dusk, not caption style (the page keeps to five Inter sizes: 11, 13, 15, 17 and the total).
- **The week reads without color.** A day that counts is a Deep Sky disc with a White check; any other day is an open ring. A day off, a missed day and a paused day look the same on purpose: nothing marks a miss. Today's ring and letter are Night Ink until today counts. VoiceOver hears one image that names the days that count.
- **The inset group exists only while it has rows.** No "Today · 0", no empty group, no placeholder.
- **Keepsakes are earned ones only.** Newest first; only the newest glows (an earned Orb's Apricot light behind its disc, brand 2.1, 8.5); one that has not been opened says "New" where its date would be, until it is opened or the page has been left (a moment with a full screen of its own stays "New" until it is opened or that screen has shown). A tap opens a small sheet: the keepsake's words, and its facts (a chapter: days, sessions, goals met and its one line; a goal: the goal's own words). The dashed ring says what is next and never how near it is. At a very large text size (`html[data-text-xl]`) the grid is two across.
- **Before the first Orb** the page is the poster at rest ("Your first Orb is one thing away", the sun at the start of its way, the rule in the band) and the last group. No grid, no section title, no zero. Before the day Orbs begin it says when ("Orbs start Monday").
- **The switch on this page leaves the page.** Turning "Orbs" off here slides the page away to Today with its numbers still on it, then hides everything; one toast says where it went and offers Undo. Nothing is asked and nothing is lost. With Orbs off, `/orbs` and `/orbs/how` lead to Today.
- **With Fitness off nothing names training:** a chapter shows no sessions, the day's lines fold a session's Orbs into "Earlier today", and How Orbs work leaves out the session row and Pause.

**How Orbs work** (`/orbs/how`, pushed over Orbs; from Settings the same body in a sheet). A list page a person can hold in their head: the rule in Fraunces italic `--fs-sentence` with one Dusk line under it, then seven groups under list-page titles (2.9): What earns Orbs, Goals multiply by reach, Weeks in a row, The count, Challenges, What Orbs are for, What Orbs never do. Each row is plain: a title in Inter 17 600, one Dusk line that wraps, and what it pays in Inter 650 with even figures at the row's end (a goal's reach, "× 3", sits before its number in Dusk). No table markup: at 200 percent text the words take the row and the value keeps its place. Every number is read from the rules (`RULES`), so the page cannot say one thing while the rules do another. At the foot, a quiet "For the curious" disclosure (Inter 600 `--fs-sub` Dusk, a 44 pt target) opens a few counts worked out on the phone; they are not sent anywhere.

---

## 3. Spacing

### 3.1 The scale

The 8-point scale with the 4 half-step, exactly the brand's (5.1): **4, 8, 12, 16, 20, 24, 32, 48** (`--sp-1` to `--sp-12`), plus the three named exceptions (`--gap-dot` 3, `--dot-offset` -7, `--fade-h` 52). Heights and diameters are component sizes, not spacing (rows 56 and 64, the dock, discs). Optical nudges of 1 or 2 px belong in a component spec, never in a margin.

### 3.2 Named uses

| Use | Value | Token |
|---|---|---|
| Page gutter, every phone width | 16 | `--gutter` |
| Screen title block to first content | 16 | `--sp-4` |
| Between sections on a tab root | 32 | `--section` |
| Section title to its content | 12 | `--sec-gap` |
| Section meta after its title | 8, baseline aligned | `--sp-2` |
| Between groups on a list page (Settings) | 24 above a group title, 8 below it | `--sp-6`, `--sp-2` |
| Between cards in a group | 12 | `--gap` |
| Between tiles | 12 | `--gap-tile` |
| Card inner padding | 16; the hero card 20; a tile 12 | `--pad-card`, `--pad-hero`, `--sp-3` |
| Groups inside a card | 16; where the kind of content changes, a full-bleed `--line` hairline with 16 on each side | `--sp-4` |
| Card title to the card's content | 8 | `--sp-2` |
| Caption eyebrow to the title under it | 4 | `--sp-1` |
| Title to its own subtitle; label to value; number to unit | 4 (or the line boxes touching) | `--sp-1` |
| Between rows | No gap. Rows are 56 tall (64 with a subtitle) with a `--line` hairline between, inset to the text | |
| Icon tile to its text | 12; the hairline starts at the text | `--sp-3` |
| Inline glyph to its label (buttons, chips, links) | 8 | `--sp-2` |
| Neighboring bezeled controls (pills, chips, buttons) | 12 | `--sp-3` |
| Unbezeled targets (text links, bare icons) | Their 44 pt hit boxes never overlap | `--hit` |
| Stacked buttons | 12 between primary and secondary; a quiet link 8 below the button above it | `--sp-3`, `--sp-2` |
| A button block from the content above it in a card | 16 | `--sp-4` |
| Paragraph to paragraph | 12 | `--sp-3` |
| End of a scroll | The last content ends at least 24 above the dock's top | `--sp-6` |

### 3.3 Proximity

1. **The ladder.** 4 (parts of one item) < 8 (a title and its content inside a card) < 12 (items in a group: cards, tiles, a section title to its content) < 16 (card padding, groups inside a card) < 32 (sections). Each relationship always gets the same step on every screen [HIG Layout, NN/g proximity].
2. **Outer at least 2x inner.** The space above any heading is at least twice the space below it: sections 32 over 12 (2.7x), list-page groups 24 over 8 (3x), a card title 16 (the padding) over 8 (2x). [NN/g proximity; Peers: Apple Journal "far above, close below", 26 over 8 pt]
3. **No gap inside a card is larger than its padding** (16) unless a hairline marks it. A larger gap breaks the card into two groups that the card edge then contradicts.
4. **Cards may sit closer (12) than their padding (16)**, because the card edge does the grouping [NN/g common region]. Content without a card has no edge, so when you remove a card, the gap to the next group grows to 32.
5. **One grouping cue at a time.** Space, then a hairline, then a card. Never stack a card, a hairline at its top, a tint and extra space to say one thing.
6. **Align to one leading edge.** Inside a card, all text starts 16 in from the card edge or 12 after an icon tile. Indent only to show that something belongs to the row above it. Charts start where the text above them starts [HIG Layout, HIG Charts].

---

## 4. Type hierarchy

### 4.1 Levels per screen

Four levels, plus the screen title as wayfinding. Every token below is from the brand scale (guide 4.2). Only `--fs-value` is new, and it reuses the section-title size.

| Level | Job | Tokens | Rule |
|---|---|---|---|
| Wayfinding | Where am I | `--fs-title` 38/42 Fraunces 650; the date caption | Read once. Never inside or beside the hero. |
| 1 Focal | The one thing | `--fs-stamp` 40 (the session name), `--fs-stat-live` 44 (a live hero stat), `--fs-stat` 44 to 58 (static), `--fs-hero` 56 (held in reserve: no screen sets it now) | One per screen. On Goals and Journal the hero is focal by area, position and glow, with its sentence at `--fs-sentence`. |
| 2 Section | Names a group | `--fs-section` 26/32 (tab roots), `--fs-head` 22/28 (card titles, sheet titles, list-page groups), `--fs-sentence` 22/28 italic (prompts in a hero or a screen empty state) | Never a 26 directly above a 22 (4.4). |
| 3 Content | What people read and tap | `--fs-row` 17/22 (600 for a headline or a two-line row, 400 for a single-line row), `--fs-body` 16/24 (reading), `--fs-tile` 15/18 600, `--fs-value` 26/32 Inter 650 tnum (stats in tiles) | The bulk of every screen. |
| 4 Support | Context | `--fs-sub` 15/20 500 Dusk, `--fs-foot` 13/18 Dusk, `--fs-tag` 13, `--fs-caps` 11 caption | Never the only label on a control. |

### 4.2 Steps between levels

Adjacent text levels must differ by **(a)** a size ratio of 1.2 or more, **(b)** a weight step of 200 or more in the same color, or **(c)** Night Ink against Dusk plus a size or weight change [HIG Typography, NN/g visual hierarchy].

| Pair that sits together | Ratio | Passes by |
|---|---|---|
| Title 38 / section 26 | 1.46 | size |
| Section 26 / row 17 | 1.53 | size |
| Card title 22 / row 17 | 1.29 | size and family |
| Row 17/600 / body 16/400 | 1.06 | weight 200 (Apple's Headline and Body) |
| Row 17 Ink / sub 15/500 Dusk | 1.13 | color plus size and weight |
| Hero stat 44 / value 26 | 1.69 | size |
| Value 26 / unit 15 Dusk | 1.73 | size and color |
| Section 26 / card title 22 | 1.18 | **fails: never adjacent** |
| Session name 40 / title 38 | 1.05 | **fails: never adjacent.** The hero wins by area and position (2.3). |

### 4.3 Weight, size or color

- **Size changes the level.** Use only scale sizes, and only to move between levels.
- **Weight emphasizes within a level.** A row title over its subtitle (600 over 500), or a word inside a sentence (Inter 600). Weights in use: Inter 400, 500, 600, 650 (numbers, active tab), and 550 for tab labels only; Fraunces 600, 650, 700 and italic 420. No others.
- **Color demotes.** Dusk for secondary text, metadata and units. Never lighter than Dusk, never opacity on text, never a faint gray [NN/g low contrast].
- **Deep Sky means tappable or data** (links, the hero's band and done marks). It never emphasizes plain text [HIG Color].

### 4.4 Counts

- At most 4 Fraunces and 5 Inter sizes per screen, with 11 counted once (brand 4.5). At most **3 sizes inside one card**. One named exception: Today's hero holds five (the name 40, the count 17, 15, 13 and one 11 caption), as the gauge card did.
- At most **one caption per card** (brand 4.3) and one big number per card (`--fs-stat-live` or `--fs-stat`); other numbers in that card use `--fs-value` or `--fs-row`.
- **No stacked headers.** A section title is never directly above a card whose first line is a card title. Either the section names the group and its card has no title, or the card title stands alone.
- **No caps section headers.** Caps are an eyebrow above a title, never the label of a section people scan for (iOS 26 dropped all-caps section headers for legibility).

### 4.5 Body text

- Reading text (assistant answers, journal entries and lines, the plan summary) is `--fs-body` 16/24 at the full card or sheet width. Never put paragraphs in a nested box or two columns. Measured in a card: 37 characters a line at 320, 49 at 390, 55 at 440. At 320 the line must not drop below 36 characters.
- On wide screens a paragraph block is capped at `max-inline-size: 36rem`, about 65 to 70 characters [NN/g chunking; PR Dyson and Haselgrove 2001].
- Three or more lines never use leading under 1.3 times the size [HIG Typography]. Tile names wrap to 2 lines and never truncate (brand 6.6).
- Paragraphs are 12 apart. Short paragraphs, one idea each (brand 10.1).

### 4.6 Numbers

- Numerals always ("3 runs").
- A value is followed by its context: "of" a target, "vs" a period, or a date range ("0 of 23 mi · 0 of 4 runs"), never a lone number in a hero or tile.
- Units are smaller and Dusk: `--fs-sub` after `--fs-value` (0.58x), `--fs-sub` after `--fs-stat-live` (brand 4.2).
- Live numbers are Inter `tabular-nums` (brand 4.4). Value columns in a row are right-aligned and tabular.
- Precision: miles to one decimal, pace m:ss, percentages and counts whole.
- Zero is "0" with its context. No data is a short word ("None yet") in Dusk. A bare "–" is never shown.

---

## 5. Containers

### 5.1 Which container

Choose the first one in this list that works.

| Container | Use when | Examples |
|---|---|---|
| **None** (on the ground) | Wayfinding, section titles and their meta, footnotes, "See all" links, status pills, the week strip, a range of chips. | Today's title block and week strip; a footnote under a card (8 below, 16 in). |
| **Hairline rows inside an existing card** | The items belong to a unit that already has a card. | The top three in Plan your day; the write row in the calendar card. |
| **Inset group** (one Paper card with rows) | Three or more items of the same kind. | Settings groups; Goals' quiet card under the poster; the week's days; entries in a month; trend rows. |
| **Card** | One unit people read or act on as one: (a) mixed kinds of content that must read as one, (b) one tap target, or (c) people misgroup without it. | The hero; the Remember when card; the calendar card. |
| **Tile grid** | Same-template items that each have their own state or tap. | Habit tiles; trend and health tiles. |

A card you can only name with "and" is two units or a list. A card without (a), (b) or (c) goes back to the ground.

### 5.2 Card soup limits

- **At most three card templates per screen**: the hero, the standard card or inset group, and one tile template.
- **No run of three or more sibling cards with the same structure.** Merge them into an inset group. The habit grid is the only exception.
- **At most 6 separate shadowed surfaces in the first screenful** at 390 x 844, with a tile grid counted as one and chrome not counted. This number is a heuristic from the evidence (complexity drives first impressions [PR Tuch 2012, Reinecke 2013]), not a measured threshold. Revisit it if a screen needs more.
- **No card in a card** (C5). Inside a card, use hairline rows, Haze icon tiles or space. 

### 5.3 Borders, shadows and tints (only as the brand allows)

| Surface | Spec | Never |
|---|---|---|
| Card, tile | Paper, `--shadow-1`, no border (brand 5.3) | A border; the float shadow |
| Chrome (dock, round buttons, avatar) | `--shadow-float` | On a content card |
| Sheet | Paper or the Cloud sheet ground, `--shadow-sheet` | A second sheet on top |
| Hero emphasis | One per screen: the sunrise glow (Today, Goals, Fitness) or Journal's dusk poster | Two devices on one screen; a tint, glow or larger radius on a secondary card |
| Inside a card | `--line` hairlines, inset to the text | A divider between cards (the gap is the divider) |
| Add slot | A dashed `--line-strong` edge, one per group | Dashed edges as decoration |
| Secondary button, composer, fields | 1 px `--edge` or `--field-edge` | Any other edge |

---

## 6. Components

### 6.1 Section header

| Part | Value |
|---|---|
| Title | Fraunces 600 `--fs-section` 26/32, Night Ink, sentence case, a noun that front-loads the meaning ("Habits", "Plan your day"). |
| Meta (optional) | Inter 500 `--fs-sub` Dusk, 8 after the title on its baseline. Only a count or a range ("0 of 3 done", "Nov 9 to 15"). |
| Action (optional, one) | Quiet: Inter 600 `--fs-row` Deep Sky with an 18 px chevron, trailing edge, 44 hit ("History ›", "See all ›"). |
| Spacing | 32 above (`--section`), 12 below (`--sec-gap`). On list pages: `--fs-head` 22/28, 24 above, 8 below. |
| Build with | `SectionHeader` and `PageSection` in `apps/web/src/ui/layout.tsx`. |

### 6.2 List rows

| Part | Value |
|---|---|
| Height | 56 for one line, 64 with a subtitle. Two-line titles (to-dos) grow; padding stays 12 top and bottom at least. |
| Leading | A 32 px Haze icon tile, r 12, with an 18 px glyph (Deep Sky, or the session's data tone), 16 from the card edge, 12 to the text. |
| Title | One line: Inter 400 `--fs-row` Night Ink. With a subtitle: Inter 600 `--fs-row`. |
| Subtitle | Inter 500 `--fs-sub` Dusk, one line, ellipsis. |
| Trailing | At most one element besides the chevron: a value (Inter 400 `--fs-row` Dusk, tnum, never truncated), a tag (brand 6.3) or a quiet link. Chevron 18 px Dusk, 8 after the value. |
| Hairline | `--line`, from the text's leading edge to the card's trailing edge. |
| Target | The whole row. |
| Date-gutter row (Plan week, Journal entries) | A 40 px gutter: the day numeral Inter 600 `--fs-row` tnum Night Ink, the weekday Inter 500 `--fs-foot` Dusk 4 below. Today's numeral sits in a 32 px circle with a 1.5 px Night Ink ring. Content starts 12 after the gutter. Today's row may carry the Cloud tint across the card (as Plan does now). In Plan's week a day with nothing on it keeps its row and takes a tap (it adds on that day): from today on it shows an 18 px Pencil plus in the icon tile's place, with no edge; a past day shows nothing. A row just added is lit in the Sky tint (`--accent-tint`) for about a second, then lets go on the 200 ms color change. |

### 6.3 Stat tiles

| Part | Value |
|---|---|
| Grid | Two columns, 12 apart; one column above 150 percent text. |
| Tile | Paper, r 18, `--shadow-1`, padding 12. The whole tile is the target and opens its detail. |
| Label row | 18 px glyph (Deep Sky) 8 before the label, Inter 500 `--fs-sub` Dusk; optional chevron 18 Dusk at the trailing edge. |
| Value | Inter 650 `--fs-value` 26/32 tnum Night Ink, 8 below the label row; unit Inter 500 `--fs-sub` Dusk, 4 after, same baseline ("7%", "52 bpm"). |
| Context | Inter 500 `--fs-foot` Dusk, 4 below the value ("30 days", "vs your normal"). A direction triangle glyph (up or down, never color alone) may precede it. |
| Sparkline (optional) | 32 px tall, full tile width, 8 below the context. Actual in a 2 px Deep Sky line; no axes, labels or gridlines. |
| One template | Trends and Health use this same tile. |

### 6.4 Charts

| Part | Value |
|---|---|
| Card order | Caption (optional), headline value with its context, one takeaway line, the plot, then controls. |
| Headline | Inter 650 tnum: `--fs-stat-live` in a hero, `--fs-value` elsewhere. Unit and context in `--fs-sub` Dusk (brand 6.8). |
| Takeaway | One sentence, Inter `--fs-sub` Dusk, 4 under the headline ("18.1 mi a week on average"; in 1W "On plan, 14 mi to go"). |
| Plot | The card's full inner width; 160 tall at 320 pt, 180 at 390 and up. Y labels short, on the trailing side; units in the headline. 1 to 5 horizontal gridlines at round steps (0, 5, 10 mi), `--grid`: the Progress chart (Fitness) draws 1 to 3, fitted so its tallest bar stands in the top fifth of the plot (one line only when the tallest bar is 1: a day with one lift session then stands the plot's whole height). No chart border or plot background. Bars from zero; lines may use a dynamic range. The plot sits 8 under the takeaway (it keeps a caption's height of its own over the tallest bar). |
| Labels | Direct labels in caption style ("Plan" over the first dashed bar); no legend for 4 series or fewer. X labels in caption style, the set that fits without two touching: endpoints on a line chart; on the Progress chart weekday letters, months (names or initials), dates in 1M, years in a long All, and "Now" under the bucket holding today (brand 6.8 lists them). |
| Interaction | Drag across the whole plot area to read a point; the readout is the headline above the plot. A swipe up or down that starts on the plot still scrolls the page: the chart takes a touch only after 6 px of mostly sideways travel or a 180 ms press. Nothing critical needs a tap to show. Until the chart has been read once, one line 8 under the plot (Inter `--fs-sub` Dusk) says how. Its words fade the moment the chart is read; its room is given back when the page is next shown, never under the finger. |
| Range control (Fitness, the Progress chart) | Seven segments, 1W, 1M, 3M, 6M, YTD, 12M, All, in one row 12 below the plot, 12 in from the card's edges (wider than the 20 px hero padding allows). Track Cloud, pill; thumb Sky; labels Inter 15, Dusk 550 off, Night Ink 650 on; 44 tall. Segment widths: 47.7 at 390, 45.6 at 375, 52.6 at 440; 37.7 at 320, where the named exception (C4) applies. Default 3M. |
| Sparkline | 6.3. |

### 6.5 Empty states

| Form | When | Value |
|---|---|---|
| Screen empty state | The whole screen or its hero has nothing yet. | Brand 6.11: a Fraunces italic sentence (`--fs-sentence`, Night Ink), one Inter 15 Dusk line, one secondary or quiet button. |
| Section empty state | One section of a screen that has other content. | One 64 px row in the section's card: a 32 px Haze icon tile, a title in Inter 17 600 ("No trends yet"), one Inter 15 Dusk line ("Your first week shows here after your first run."), an optional trailing quiet link. Never a second button for an action the screen already offers. |

### 6.6 Buttons by prominence

| Level | Spec (brand 6.2) | Placement |
|---|---|---|
| Primary | Sky, Night Ink label, 54 full width or 44 inline | One per screen. In a card: inline, at the text's leading edge, 16 below the content above it. In a sheet or onboarding: full width, pinned above the safe area. |
| Secondary | Paper with a 1 px `--edge` | Same height as the primary beside it; stacked 12 below it. |
| Quiet | Deep Sky text, Inter 600, 44 hit | Links and "History ›". 8 below a stacked button. |
| Destructive | Paper, Signal label, 1 px edge | Alone, at the end of a page or in a confirm sheet. |

Alternatives differ by style, never by size [HIG Buttons]. Labels start with a verb.

### 6.7 Chips, pills and segmented controls

| Part | Value |
|---|---|
| Status pill (Today) | `--glass`, 32 tall, 44 hit, Inter 15 500 Night Ink, a 16 px chevron (right: it goes somewhere; down: it opens a sheet), and on the status pill a 6 px state dot (brand 6.13, 6.14). One row from the left gutter, 12 apart: the plan pill, with the status pill before it only while a status is on. |
| Context chip | Brand 6.3. Two side by side, 12 apart. Lighter than the hero below it: no glow, no tint. (Goals no longer uses it: tomorrow and next week are rows in "Coming up".) |
| Filter chip | Brand 6.3, 32 tall, 44 hit, 12 apart. |
| View pill (Today's hero) | Brand 6.3. Two controls in one card: the second is quiet. On Today's hero that is the view pill, 28 tall on the band, against the When control's 44 under the hill. |
| Tag | Brand 6.3, 28 tall, not tappable. One per row at most. |
| Segmented control | Brand 6.3. At most 5 segments, equal widths, text only, noun labels, one preselected. Exception: the range control (6.4). |

### 6.8 The Journal week (the lights)

The lightbulb streak tracker is retired. The week is drawn by the poster kit's lights (brand 6.5a, `ui/poster` `WeekLights`) inside the Journal poster.

| Part | Value |
|---|---|
| Container | The dusk poster's scene, between the title and the band. On the Journal poster a past day's light opens that day in its month (2.5) where the screen is 375 pt or wider, so each light's target is 44 pt across; narrower, and everywhere else the lights are used, they are display only. |
| Days | Seven on a rising dotted line: six days back, oldest left, each with its day letter in caption style; tonight last, labeled "Tonight". |
| States | Written (a line or an entry that day): an Apricot light with a soft halo. Missed: a small open Haze ring (shape, not color alone). Tonight, waiting: a dotted Paper ring. Tonight, kept: the largest light, with two rings. No orange mark. |
| Band | Before: "This week · 2 days written" over "Tonight's line lights the third". After: "This week" over "3 days written". With none yet: "Your first line lights tonight". Days written, never days in a row. |
| VoiceOver | One label: "2 days written this week, Monday and Wednesday. Tonight's line is not written yet." |

### 6.9 The Remember when card (pending build)

| Part | Value |
|---|---|
| Container | Paper card, r 24, `--shadow-1`, clipped. One card under the composer and today's entries; the dusk poster is Journal's hero, so this card carries no glow. It shows a line or an entry from the past, one at a time. |
| Header | Plain Paper on Journal (no wash: the dusk poster is the page's one tinted header, check 11). It holds the caption "REMEMBER WHEN" (Dusk; the caption is those two words alone, the when is in the quote) with the share button trailing (a 44 px round Paper button, 18 px glyph); then 8 below, the quote in Fraunces italic 420 `--fs-sentence-sm` 17/24 Night Ink (22 here would be the page's fifth Fraunces size): "On Oct 11 you wrote: “…”", at most 4 lines, then an ellipsis; tapping the quote opens the entry. Padding 16 sides, 12 top, 16 bottom. |
| Below the header | Optional quiet verbs on Paper, one row, 12 apart, 44 hit. Links on Paper only: Deep Sky on Haze is large text only. |

### 6.10 The plan summary sheet with the assistant (pending build)

| Part | Value |
|---|---|
| Presentation | One sheet, large detent (a detailed back-and-forth needs the height). The assistant appears inside it; it never opens a second sheet [HIG Sheets]. |
| Top | Grabber, close (40 round), title: the plan name, Fraunces 600 `--fs-section`. The subject stays visible at the top while the conversation scrolls. |
| Body | 1. "What the assistant knows": one inset group of rows (race, race date, run days, long run, easy pace, starting miles). 2. The plan outline: week rows (week, phase, miles). 3. The conversation, below the outline, as answers grow. |
| Composer | Pinned at the bottom (brand 6.12), placeholder "Describe what to change", the provider disclosure under it exactly as written. |
| Proposal | A card in the conversation listing the changes as rows, "Apply" (Sky, 44 inline, the sheet's one primary) and "Not now" (quiet). On apply: the outline rows and the Plan page update in place, and a toast offers Undo. |

### 6.11 The plan builder's assistant

Brand 6.16 has the parts. The layout:

| Part | Value |
|---|---|
| Place | First in the sheet's body, under the preview header, 12 px (the card gap) above "Training for". Full width less the 16 px gutter. |
| Pill | 48 tall. The Orb 28, 12 from the card's edge; the words 12 after the Orb, on one line at 320 ("Describe your plan" is three words for that reason) and two lines at Larger Text sizes. The whole row is the target. |
| Composer | 8 px padding, so the field's text starts 16 px from the card's edge. Under the field one row: the Orb at the leading edge, Send at the trailing edge (40 px, 44 pt hit). The provider line 8 px under the card, centered. |
| The line | Under a `--line` hairline inset 16 px on both sides, with 12 px above and below the words. The quiet verb sits at the trailing edge on the first line, 12 px after the words, with a 44 pt hit that does not grow the row. Under 22 rem of sheet width the verb sits under the words, at their leading edge. A failure adds an 18 px glyph at the leading edge, 12 px before the words. |
| Veil | From the bottom of the title bar to the bottom of the sheet. The Orb, the status line and Stop are one centered group that sits above the middle (12 percent of the screen height is left under it): Orb to line 16 px, line to Stop 12 px. |
| Peak tile | After the two number tiles, across both columns. Its label at the leading edge and "Let the plan pick" at the trailing edge on one row. At Larger Text sizes the link wraps under the label. |

### 6.12 The Add sheet (Plan)

| Part | Value |
|---|---|
| Presentation | One sheet at its content's height (about 520 pt at 390 x 844), opened by "+ Add" in the week's line or by a tap on an open day. Eyebrow: the week ("This week", "Next week", "Week of Nov 23"). Title: "Add a session", Fraunces 600 `--fs-head`. |
| The day | The open week's seven days as one full-bleed strip (cells of a seventh of the width, so 45 pt at 320), in the day picker's look: the letter in caption style, the numeral Inter 600 `--fs-row`, the picked day a Sky pill with Night Ink, today a 1.5 px Night Ink ring, a past day's numeral Dusk, and a 3 px bar in the data tone of what already sits on a day. Opens on the tapped day; from "+ Add" on today in this week, on the first open day of a later week, on the last open day of a past week. |
| What it is | One Paper card (the sheet's ground is Cloud, where a Cloud track cannot be seen), padding 16, its two groups 16 apart. 1. Run or Lift: a two-segment control, Sky thumb, 44 tall. 2. That kind's own parts, 12 apart. A run: four chips in one row of equal parts (Easy, Long, Tempo, Speed, each with a 6 px marker in its data tone; two by two under 360), then a stepper (48 tall, the number alone) with the unit beside it as a quiet two-segment control ("mi", "min", 48 tall). A lift: a chip per lift the owner already has in their weeks (newest first, four at most), then the plain kinds (Strength, Upper, Lower, Full body, Mobility) to six in all, wrapping; then a field, "Or name it". Chips are filter chips (brand 6.3), 12 apart. |
| The line | Above the button, Inter `--fs-sub`, one line: the session's name in Night Ink 600 (it gives way to an ellipsis first), then in Dusk the minutes of a run without miles, the day ("Today", "Fri, Nov 13") and, for a day already past, "Added as done". |
| Buttons | "Add" (Sky, 54, full width, pinned; "Add as done" for a day already past), then "More options" (quiet, 8 below), which opens the full editor with what was picked (cross training, rest, notes, the other run types). |
| Defaults | Miles: the last run of that kind in the owner's weeks, else their recent runs (the usual distance; the longest for the long run), else the training answers, else 4, 8, 5 and 5. Minutes: those miles at the easy pace, on the five. A day already past is added as done: planned in the past it would read Missed. |
| Result | The sheet falls away first; the row is written as the sheet leaves the screen (the write renders every tab, and must not take the sheet's frames). The row lands lit, the rows under it slide on `settle`, the week scrolls only as far as it takes to show it, one `drop` haptic, and a toast says "Easy 4 added to Friday" with Undo. A refusal by the server takes the row back and says "Couldn't add Easy 4." with "Try again", which sends the same session again. |

---

## 7. Density and disclosure

1. **Frequent things up front, rare things one tap away.** Ask of each element: is it used most days? If not, fold it or move it [NN/g progressive disclosure; HIG Layout].
2. **Folds say what they hide**: a count or a noun ("3 more", "History ›", "See all ›"). A fold never hides something to act on today.
3. **Two levels at most**: screen, then sheet or pushed page, then stop. No accordion inside a sheet inside a pushed page.
4. **One disclosure control per view** [HIG Disclosure controls].
5. **Remove before you shrink.** When a screen runs long, cut repeats and fold history before you reduce sizes or gaps.
6. **Every action in a toast is also reachable without it** [HIG Accessibility, time-boxed UI].

| Screen | Up front | One tap away |
|---|---|---|
| Today | Hero, habits, today's goal, carry-over, top three | Week detail (the band), the other count (the view pill), habit history, the rest of the to-dos, the status sheet (the status pill while a status is on; in ordinary training, the title menu: hold the title or the date), the session |
| Goals | Today's goal, the review owed, tomorrow's goal in the evening, further out | Goal history ("See all"), the review sheet, each period's goal, "Coming up" (tomorrow and next week) |
| Fitness | Today's training card, this week's days, "Add a session", the Progress chart at the chosen range, the trend tiles (and the body's numbers when Apple Health is connected), the plan row | A session, the Add sheet (and the full editor behind its "More options"), earlier this week (the fold), other weeks (a swipe), the month view (the date), the morning schedule, a week's sheet (a bar), a lift's sheet, a metric's page (a tile), the plan summary with the assistant |
| Journal | The poster (the week's lights, the field or tonight's line), "Write more about today", today's entries, Remember when, the months | The entry writer (it opens in place), a line's sheet (edit, delete with Undo, a second line for the day), an entry's sheet (edit, share, favorite, delete with Undo), search (the nav bar), a month's page (its calendar, its days, writing on a past day), a past day from a light |
| Settings | Group rows with their current values | Each setting's page; delete account confirms in a sheet |
| New plan sheet | The preview, the assistant's pill, the goal, run days, weeks and miles | The composer (it opens in place), start and race day, week by week (below the fold) |

---

## 8. Checks

Run all of these on every screen you change, at **390 x 844, 320 x 844 and 440 x 956** (Playwright, `isMobile`, `hasTouch`, `deviceScaleFactor: 2`, the seeded account), then run the brand checklist (guide 13) and the brand-guardian agent. Look at every screenshot.

1. **Squint test.** Screenshot at 390 x 844 with `document.documentElement.style.filter = 'blur(8px)'`. The first thing you notice is the focal point named in section 2, and the second is the next thing to do.
2. **3-second test.** Look at the unblurred screenshot for 3 seconds, look away, and say what the screen is for and what you would do next. Both answers must match the screen's job and order in section 2.
3. **Layer-cake skim.** Read only the title, the hero's text and the section titles, top to bottom. They tell you what the screen is for.
4. **Focal point high.** The focal element's top is at most 300 pt at 390 x 844, and its key value is above the dock. On Today: hero top + 59 + 215 ≤ 690.
5. **Nothing extra above the focal point.** Only the elements section 2 lists sit above it.
6. **No false floor.** Something crosses the dock line on the first screen at each width.
7. **Gutter.** Every card edge, section title and chart starts 16 from the screen edge.
8. **Proximity.** For every heading, the gap above is at least 2x the gap below. Inside a card, no gap exceeds the card padding without a hairline. All values are on the scale (`node apps/web/scripts/check-brand.mjs <files>` adds no findings).
9. **Same relationship, same gap.** A section title to its content, or one row to the next, measures the same on every tab.
10. **Type counts.** At most 4 Fraunces and 5 Inter sizes on the screen, at most 3 sizes in any card, no 26 directly over a 22, at most one caption and one big number per card.
11. **One winner.** The largest block and the highest-contrast block are the same element. At most one glow or Haze wash header.
12. **One Sky button** at any scroll position.
13. **Containers.** At most three card templates. No run of 3 or more like sibling cards. No shadowed or bordered box inside a card. At most 6 shadowed surfaces in the first screenful (a tile grid counts once).
14. **Say it once.** List the numbers and titles on the screen. None appears twice.
15. **Empty and zero.** No bare "–". Section empty states are one row. No action is offered twice.
16. **Targets.** Every tappable thing has a 44 x 44 pt hit box. Bezeled controls sit 12 apart, and unbezeled hit boxes do not overlap. The one exception is range segments at 320 (37.7 wide, 44 tall).
17. **Line length.** A paragraph in a card runs 36 or more characters per line at 320, and is capped at 36rem on wide screens.
18. **Larger Text.** At 200 percent (`html { font-size: 200% }`), nothing clips or overlaps, two-column grids are one column, side-by-side chips stack, and the order of emphasis is unchanged.
19. **End of scroll.** The last content ends 24 or more above the dock.
20. **Today's essentials** are reached within 1,260 pt of scroll at 390 x 844.

Measurement helpers, for `page.evaluate` or the console. Tabs stay mounted, so scope every query to the visible scroller.

```js
// the visible page's scroller
const sc = (() => { let s = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  while (s && !(s.scrollHeight > s.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
  return s || document.scrollingElement; })();
const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= 0 && r.left < innerWidth; };

// 10. sizes in use on this screen, by family
[...new Set([...sc.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
  .map((e) => { const s = getComputedStyle(e); return s.fontFamily.split(',')[0].replace(/["']/g, '') + ' ' + s.fontSize; }))].sort();

// 8. gap above and below each section header
[...sc.querySelectorAll('.lb-head')].filter(vis).map((h) => { const r = h.getBoundingClientRect();
  const prev = h.closest('.lb-sec')?.previousElementSibling, next = h.nextElementSibling;
  return { title: h.textContent.trim().slice(0, 24), above: prev ? Math.round(r.top - prev.getBoundingClientRect().bottom) : null,
    below: next ? Math.round(next.getBoundingClientRect().top - r.bottom) : null }; });

// 13. shadowed surfaces in the first screenful, and shadows nested inside shadows
const sh = [...sc.querySelectorAll('*')].filter((e) => vis(e) && getComputedStyle(e).boxShadow !== 'none' && e.getBoundingClientRect().top < innerHeight);
({ firstScreen: sh.filter((e) => !sh.some((d) => d !== e && d.contains(e))).length, nested: sh.filter((e) => sh.some((d) => d !== e && d.contains(e))).map((e) => e.className) });

// 12. Sky buttons visible now
[...document.querySelectorAll('button, [role=button], a')].filter((e) => vis(e) && e.getBoundingClientRect().top < innerHeight && getComputedStyle(e).backgroundColor === 'rgb(56, 182, 242)').length;
```

The runtime brand audit covers contrast, the orange budget, the Orb tiers, one hero and Fraunces use: `node docs/brand/tools/audit.mjs <url> /today,/goals,/plan,/journal`.

---

## Sources

Full citations, with URLs and source types, are in `reports/Mobile layout and visual hierarchy.md`. The main ones:

- Apple HIG: Layout, Typography, Lists and tables, Charts, Charting data, Buttons, Segmented controls, Sheets, Disclosure controls, Accessibility, Color. https://developer.apple.com/design/human-interface-guidelines/ (first-party guidance)
- WWDC26 250 "Principles of great design", WWDC25 356 "Get to know the new design system", WWDC22 110340 and 110342 on charts, WWDC17 802 "Essential Design Principles". https://developer.apple.com/videos/ (first-party guidance)
- NN/g: F-pattern and scanning patterns, the fold, proximity, common region, cards, visual hierarchy, low contrast, progressive disclosure. https://www.nngroup.com/ (research firm with stated methods)
- Lindgaard et al. 2006, Tuch et al. 2012, Reinecke et al. 2013 (first impressions and visual complexity); Palmer 1992 (common region); Lagun et al. 2014 (attention on phones); Dyson and Haselgrove 2001 (line length); Cleveland and McGill 1984 (chart perception). (peer-reviewed)
- WCAG 2.2 SC 1.4.3, 1.4.11, 1.4.12, 2.5.8. https://www.w3.org/WAI/WCAG22/Understanding/ (first-party standard)
- The 14-app teardown: Apple Health, Fitness and Journal, Things 3, Streaks, Bevel, Oura, WHOOP, Strava, Runna, Structured, Gentler Streak, Finch, Day One. App Store screenshots, measured. (convention, not proof)
