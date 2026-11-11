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
| C20 | 6.7 The week strip | The kind pill is one size on every day and in every state (34 x 22, centered on its column, 8 px under the numeral), with two glyphs inside the same pill on a two-session day, and one fill system: Paper for nothing done yet, Haze for part, Sky for all, hollow for a day that passed with nothing done. Today's pill loses its Deep Sky ring: today is the Sunrise dot. A day with no session keeps the empty slot. The cell is 83 tall (was 81). Owner request: the pills were uneven. |
| C21 | 6.13 Status row and status sheet; 12.1 Today | The row is the plan pill, with the status pill before it only while a status is on. "On the plan" and "Day by day" are gone (owner request). The plan pill shows the plan's name with its phase and a right chevron. The status sheet opens from the status pill, and in ordinary training from Today's title menu. |

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
| Focal point | The hero card (the U-arc gauge). |
| Sky button | "Set the goal" in Plan your day, only while today's goal is unset. Otherwise none. The habit coins are the screen's most used control. |
| Read in passing, above the hero | The title block (date caption, "Today", the quote), the week strip, one row of status pills (the plan pill; the status pill before it only while a status is on). Nothing else sits above the hero. |
| Order of emphasis | 1. Hero: the session name ("Easy 6.5"), then the readout pill ("0 of 23 mi · 0 of 4 runs"), then the detail line ("Out the door in 4 h 40 min"). Below a hairline in the same card: the Morning / Afternoon / No time control, then the morning line. 2. Habits: the two-column tile grid. 3. Plan your day: today's goal, the carry-over row, the top three. 4. The fold ("3 more") and "All to-dos". |

Build:

- **Status chips become the brand's status pills.** One row of 32 pt `--glass` pills, each with a 44 pt hit, 12 px apart, from the left gutter: 16 px under the week strip and 12 px above the hero. This is the spec in brand 6.13. They used to render as two-line context chips 56 pt tall. Why: it removes 24 pt above the hero, and these are status, not content.
- **One pill on most days.** The plan pill is always there: the plan's name and the phase ("Half marathon · Warm-up week"), or "Make a plan" with no plan now or ahead. The status pill sits before it only while a status is on ("Sick · until Fri"). Ordinary training has no status pill: "On the plan" and "Day by day" said what the plan pill and the hero already say (owner request, and principle 5: say each thing once). The status sheet opens from the status pill, and in ordinary training from Today's title menu ("Change training status…"), so it stays one labeled step away. When two pills do not fit, the plan pill drops the plan's name first, then the status pill drops its end. With nothing to show there is no row, and the hero starts 16 px under the strip.
- **The week strip's kind pills are one size** (brand 6.7): 34 x 22 on every day, centered under the numeral, the same 8 px gap on every day, and a day with no session keeps the empty slot. Why: pills of two widths and five fills under seven equal columns read as a mistake, not as a state. One shape lets the fill carry the state (Paper, Haze, Sky, hollow).
- **"Close yesterday" moves into the carry-over row of Plan your day.** Why: it is yesterday's business, and the carry-over row is where yesterday lives. Today it is a seventh row above the hero.
- **The quote wraps to 2 lines at most** (line clamp 2, the full quote on tap). Why: an unbounded quote pushes the hero down by a different amount each day.
- **Target: hero card top at 300 pt or less** (now 358) in Playwright at 390 x 844, and the whole gauge with its readout above the dock on a device (Playwright top + 59 pt Dynamic Island inset + 222 pt to the arc's bottom ≤ 690). Why: the 14 peer apps put their focal element 11 to 32 percent down, median 22 [Peers], and attention falls off toward the fold [NN/g].
- **The readout pill reads "0 of 23 mi · 0 of 4 runs" again** (brand 6.5, 11). Why: a value with context is simpler to act on [WWDC26 250], and the pill is the gauge's text equivalent.
- **The hero card has two zones.** Gauge zone, then a full-bleed `--line` hairline with 16 px on each side, then the control zone (time of day, morning line). Why: a control inside the bowl's group reads as part of the data [Peers: Oura, WHOOP keep controls out of the dial].
- **Plan your day is one card.** Rows in order: today's goal, the carry-over row (with "Close yesterday"), the top three, "3 more", then "All to-dos ›" as the last row (a quiet link row). This replaces the separate carry-over card and the full-width "All to-dos" pill card. Why: like items in one container [HIG Lists]. Today there are three containers for one list.
- **The goal prompt on Today is 17 px Fraunces italic Dusk** (`--fs-sentence-sm`), not 22. Why: 22 italic is a hero size, and here the prompt is a row inside a section. This also brings Today to 4 Fraunces sizes (38, 40, 26, 17).
- Inter sizes on Today: 11, 13, 15, 17 and one more at most.

### 2.4 Goals

| | |
|---|---|
| Job | Set and keep today's goal; see what is next. |
| Focal point | The Today goal card (hero; its Apricot sun is the screen's glow). |
| Sky button | "Set today's goal" while unset. |
| Read in passing | The title block; the Tomorrow and Next week chips (above the hero, as now). |
| Order of emphasis | 1. Today card: the prompt or the goal, its time-left tag, the button. 2. The carry-over row (a past goal still open). 3. Tomorrow and Next week chips. 4. Further out (this week, this month, this year). 5. History. |

Build:

- **"To review" becomes a carry-over row**, using the same row template as Today's carry-over. Title = the goal text (17/600, one line), subtitle = "Still open from Mon, Nov 9" (15 Dusk), trailing quiet "Review" (44 hit). This replaces a card with four text levels and a secondary button. Why: front-load the words that matter [NN/g F-pattern], and one template across screens [HIG Familiarity].
- **Further out becomes one inset group with three rows**: title "This week" / "November" / "2026" (17/600), subtitle = the goal or "Not set" (15 Dusk), trailing "5 days left" (15 Dusk, tnum) and a chevron. No dashed circles. Why: three like items are rows in one card [NN/g cards, HIG Lists]. Dashed edges mark one add slot, not every row (C5).
- **History drops the inner "Goals kept" label**, and the section meta says it instead ("History · Goals kept"). Four columns: label 15/500 Dusk, value `--fs-value`, context 13 Dusk. No colored tick before each label. A period with no data shows "None yet", never "–". Why: a section title stacked on a card label is two headers for one thing (section 4.4), and zero or no data is a value [Orby rule H50].
- Card templates on Goals drop from six to three: hero, the standard card or inset group, the chip.

### 2.5 Learned

| | |
|---|---|
| Job | Write down one thing learned today; keep the streak. |
| Focal point | The prompt card (hero, padding 20, the glow; C8). |
| Sky button | "Save" (Haze with a Dusk label while empty). |
| Read in passing | The title block; the lightbulb streak tracker, compact, at the top. |
| Order of emphasis | 1. The prompt card: "What did you learn today?", one helper line, the field, Save. 2. The streak: "4 days in a row" and the last 7 days as bulbs. 3. This year: the year heading, its count, month rows. |

Build (includes the pending owner requests):

- **Remove the "Learned: N things on N days" tile.** Owner request. Why: it restates the year count below it (say it once).
- **"In a row" becomes the lightbulb streak tracker** at the top of the tab, between the title block and the prompt card (component in 6.8). Why: the streak is the number that changes daily [Peers: Apple Journal Insights, Streaks]. It is compact so it reads like Today's week strip and does not compete with the prompt.
- **The field starts at 3 lines (72 pt) and grows as you type.** It is about 160 pt of empty Paper now. Why: an empty block reads as a false floor and pushes the year list off the first screen [NN/g].
- **Month rows are one inset group** under the year heading. "No months yet" uses the section empty form (6.5).

### 2.6 Plan

| | |
|---|---|
| Job | See the plan and this week day by day, and change it. |
| Focal point | The YOUR PLAN card (hero). |
| Sky button | None on the root. In the summary sheet: "Apply" on a proposal. |
| Read in passing | The title block with Week / Month in the bar. |
| Order of emphasis | 1. YOUR PLAN: the plan name, the phase line, the weeks-done row. 2. Today's row in the week (Cloud tint, Today tag). 3. The rest of the week's rows. 4. The week pager. |

Build (includes the pending owner request):

- **Remove the separate "Today" section** (the morning card and the two session cards). Today's sessions already appear in the week, and the morning line is on Today's hero. Today's row in the week gains a second line ("Wake 6:30 · out 6:45") and opens the session, and "Schedule ›" moves into the session sheet. Why: say it once [NN/g cognitive load]. It also matches the owner's description of Plan: one plan card, then the week day by day.
- **YOUR PLAN on the Runna model.** Caption "YOUR PLAN", plan name (`--fs-head`), one phase line (15 Dusk), then a weeks-done row: one 6 px mark per plan week, done Deep Sky, ahead `--dot-ahead`, the current week a 1.5 px Night Ink ring. At most two stats, and a chevron. Why: plan progress shown as the plan's shape [Peers: Runna]. The thin progress bar today says nothing a reader can count.
- **Tapping YOUR PLAN opens the plan summary sheet with the assistant inside** (layout in 6.10). Owner request. The change lands through the existing proposal and apply flow, and the Plan page updates in place.
- **Week rows use the date-gutter row** (6.2). The session's data tone is the only color in a row.

### 2.7 Progress

| | |
|---|---|
| Job | See how training is going against the plan. |
| Focal point | The hero card's headline stat. |
| Sky button | None. |
| Read in passing | The title block. |
| Order of emphasis | 1. The hero card: Running / Strength (first row), the headline stat with its context ("0 of 23 mi · 0 of 4 runs" for 1W), one takeaway line, the chart, the range row. 2. Trends: one template, two-column tiles. 3. Health: the same tile template; "Connect Apple Health" as one row. |

Build (includes the pending owner request):

- **The running chart gets range views 1W, 1M, 3M, 6M, YTD, 12M, All** as one row of seven segments under the plot, inside the hero card (6.4, C4, C7). Default 3M, closest to today's week-by-week view. Each viewer's last choice is remembered (local storage, per viewer). The headline and takeaway follow the range ("112 mi in 3 months", "8 mi behind plan"). Why: Apple's own apps offer period choices on detail charts [HIG Charts]. The row sits under the plot so the focal number stays at the top of the card, and changing the range keeps one chart style [HIG continuity].
- **Running / Strength stays as the hero card's first row** (a 2-segment control, 44 tall). It switches only the hero, so it belongs to the hero.
- **Trends and Health share one tile template** (6.3). This fixes the broken "7 %, 7 days" readout to a value and unit on one baseline ("7%") with a context line ("7 days"). Why: one template per screen lets people read values, not structure [Peers: Apple Health, Fitness].
- **The Trends empty state uses the section form** (6.5), not a 22 px italic sentence. Why: an empty placeholder must not out-shout the hero.

### 2.8 Journal

| | |
|---|---|
| Job | Write today's entry; look back. |
| Focal point | The Remember when card when it shows (quote inside the Haze wash header). Otherwise, the calendar card. |
| Sky button | None. "Write today's entry" is a row (it opens the composer). |
| Read in passing | The title block. |
| Order of emphasis | 1. Remember when: the quote ("On Oct 11 you wrote: …") is the largest text in it. 2. The calendar card: the range title, the seven days with today ringed, the "Write today's entry" row. 3. Entries: month groups, newest first. |

Build (includes the pending owner requests):

- **Remove the Library part entirely**: the Entries / Library switch, the Library view and everything only it uses. Owner request. Why: a segmented control that switches between whole sections is a tab's job [HIG Segmented controls]. Removing it also removes a row above the focal point.
- **The quote moves inside the tinted Remember when header**, with the caption and the share button (6.9). Owner request.
- **"Write today's entry" becomes a hairline row at the foot of the calendar card**: a 32 px Haze icon tile with the pen glyph, title 17/600, subtitle "A line or two is plenty" 15 Dusk. Today it is a box with its own edge inside the card (C5).
- **The Entries empty state drops its second "Write today's entry" button** and uses the section form (6.5). Why: say it once.
- **Remove the legend row** ("Entries 1 2 3+ Favorite"). Why: the discs already carry their count as a numeral and the Favorite disc carries its heart (brand 3.3). Peers print no legend for self-labeled marks [Peers: Streaks, Journal].
- **Entries are date-gutter rows in one card per month** (6.2): weekday and day numeral in the gutter, the first line as title (17/600), two lines of body (15 Dusk), no card per entry. Why: a sequence of like items is a list [NN/g cards, Peers: Day One].

### 2.9 Settings (and its pushed pages)

| | |
|---|---|
| Job | Change how Orby is set up. |
| Focal point | The You row (name and plan). |
| Sky button | None. |
| Read in passing | The back button and the centered title. |
| Order of emphasis | You, Training, Habits, Morning routine, Data sources, Privacy, App, Data, About, Account (sign out, delete) last. |

Build:

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

| | |
|---|---|
| Job | One idea or one question per step. |
| Focal point | The step's sample (the preview card) with its headline: one unit. |
| Sky button | "Next", 54 tall, full width, pinned 8 px above the safe area. |
| Order of emphasis | Intro steps: 1. the sample card, 2. the headline (`--fs-hero`, at most 3 lines at 390), 3. one line (`--fs-body` Dusk), 4. Next, 5. "I have an account" (quiet, 8 px below Next). Question steps: 1. the question (Fraunces `--fs-section`, left aligned), 2. the options as an inset group or chips, 3. Next. |

Build: the progress dots sit 16 px above Next and are display only. Headline and sample are 24 px apart, and headline and its line 8 px apart. Every step's content clears Next by at least 24 px at 320 x 844.

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
| 1 Focal | The one thing | `--fs-stamp` 40 (the session name), `--fs-stat-live` 44 (a live hero stat), `--fs-stat` 44 to 58 (static), `--fs-hero` 56 (onboarding, the splash) | One per screen. On Goals and Learned the hero is focal by area, position and glow, with its sentence at `--fs-sentence`. |
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
- **Deep Sky means tappable or data** (links, the gauge fill). It never emphasizes plain text [HIG Color].

### 4.4 Counts

- At most 4 Fraunces and 5 Inter sizes per screen, with 11 counted once (brand 4.5). At most **3 sizes inside one card**.
- At most **one caption per card** (brand 4.3) and one big number per card (`--fs-stat-live` or `--fs-stat`); other numbers in that card use `--fs-value` or `--fs-row`.
- **No stacked headers.** A section title is never directly above a card whose first line is a card title. Either the section names the group and its card has no title, or the card title stands alone.
- **No caps section headers.** Caps are an eyebrow above a title, never the label of a section people scan for (iOS 26 dropped all-caps section headers for legibility).

### 4.5 Body text

- Reading text (assistant answers, journal entries, learned notes, the plan summary) is `--fs-body` 16/24 at the full card or sheet width. Never put paragraphs in a nested box or two columns. Measured in a card: 37 characters a line at 320, 49 at 390, 55 at 440. At 320 the line must not drop below 36 characters.
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
| **Inset group** (one Paper card with rows) | Three or more items of the same kind. | Settings groups; Goals' Further out; the week's days; entries in a month; trend rows. |
| **Card** | One unit people read or act on as one: (a) mixed kinds of content that must read as one, (b) one tap target, or (c) people misgroup without it. | The hero; the Remember when card; the calendar card. |
| **Tile grid** | Same-template items that each have their own state or tap. | Habit tiles; trend and health tiles. |

A card you can only name with "and" is two units or a list. A card without (a), (b) or (c) goes back to the ground.

### 5.2 Card soup limits

- **At most three card templates per screen**: the hero, the standard card or inset group, and one tile template.
- **No run of three or more sibling cards with the same structure.** Merge them into an inset group. The habit grid is the only exception.
- **At most 6 separate shadowed surfaces in the first screenful** at 390 x 844, with a tile grid counted as one and chrome not counted. This number is a heuristic from the evidence (complexity drives first impressions [PR Tuch 2012, Reinecke 2013]), not a measured threshold. Revisit it if a screen needs more.
- **No card in a card** (C5). Inside a card, use hairline rows, Haze icon tiles or space. The gauge's readout pill (brand 6.5) is the one named exception.

### 5.3 Borders, shadows and tints (only as the brand allows)

| Surface | Spec | Never |
|---|---|---|
| Card, tile | Paper, `--shadow-1`, no border (brand 5.3) | A border; the float shadow |
| Chrome (dock, round buttons, avatar) | `--shadow-float` | On a content card |
| Sheet | Paper or the Cloud sheet ground, `--shadow-sheet` | A second sheet on top |
| Hero emphasis | One per screen: the sunrise glow (Today, Goals, Learned, Plan, Progress) or Journal's Haze wash header | Two devices on one screen; a tint, glow or larger radius on a secondary card |
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
| Date-gutter row (Plan week, Journal entries) | A 40 px gutter: the day numeral Inter 600 `--fs-row` tnum Night Ink, the weekday Inter 500 `--fs-foot` Dusk 4 below. Today's numeral sits in a 32 px circle with a 1.5 px Night Ink ring. Content starts 12 after the gutter. Today's row may carry the Cloud tint across the card (as Plan does now). |

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
| Takeaway | One sentence, Inter `--fs-sub` Dusk, 4 under the headline ("8 mi behind plan", "On plan this month"). |
| Plot | The card's full inner width; 160 tall at 320 pt, 180 at 390 and up. Y labels short, on the trailing side; units in the headline. 3 to 5 horizontal gridlines at round steps (0, 5, 10 mi), `--grid`. No chart border or plot background. Bars from zero; lines may use a dynamic range. |
| Labels | Direct labels at the line ends ("Plan", "You") in caption style; no legend for 4 series or fewer. X labels: endpoints or month initials, caption style. |
| Interaction | Scrub the whole plot area. Nothing critical needs a tap to show. |
| Range control (Progress) | Seven segments, 1W, 1M, 3M, 6M, YTD, 12M, All, in one row 12 below the plot, 12 in from the card's edges (wider than the 20 px hero padding allows). Track Cloud, pill; thumb Sky; labels Inter 15, Dusk 550 off, Night Ink 650 on; 44 tall. Segment widths: 47.7 at 390, 45.6 at 375, 52.6 at 440; 37.7 at 320, where the named exception (C4) applies. Default 3M. |
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
| Context chip (Goals) | Brand 6.3. Two side by side, 12 apart. Lighter than the hero below it: no glow, no tint. |
| Filter chip | Brand 6.3, 32 tall, 44 hit, 12 apart. |
| Tag | Brand 6.3, 28 tall, not tappable. One per row at most. |
| Segmented control | Brand 6.3. At most 5 segments, equal widths, text only, noun labels, one preselected. Exception: the range control (6.4). |

### 6.8 The Learned streak tracker (pending build)

| Part | Value |
|---|---|
| Container | Paper card, r 18, `--shadow-1`, padding 12 top and bottom, 16 sides; about 104 pt tall. Display only: neither the card nor the bulbs are tappable. |
| Line 1 | The count, Inter 650 `--fs-value` tnum Night Ink, then "days in a row", Inter 500 `--fs-sub` Dusk, 4 after, on one baseline. Zero reads "0 days in a row". |
| Line 2 | 8 below: seven equal columns, oldest to today, each a 22 px bulb glyph from the icon set (1.75 stroke) with the day letter under it (caption style, 4 below; today's letter Night Ink). |
| States | Lit (a day with a learning): Sky fill inside the bulb, Night Ink stroke, and three short Night Ink rays, so the state is shape plus color (brand 3.3). Unlit past day: Pencil stroke, no fill. Today, not yet lit: Night Ink stroke. Future: `--dot-ahead` stroke (decorative). No orange. Never ring-like (HIG Activity rings). |
| VoiceOver | "4 days in a row. Learned on Monday, Tuesday, Wednesday and today." |

### 6.9 The Remember when card (pending build)

| Part | Value |
|---|---|
| Container | Paper card, r 24, `--shadow-1`, clipped. Journal's hero: no sunrise glow on Journal. |
| Header (the tinted part) | A Haze wash (`linear-gradient(180deg, var(--haze), var(--surface))`) holding: the caption "REMEMBER WHEN" (Dusk, 5.65 on Haze) with the share button trailing (a 44 px round Paper button, 18 px glyph); then 8 below, the quote in Fraunces italic 420 `--fs-sentence` 22/28 Night Ink: "On Oct 11 you wrote: “…”", at most 4 lines, then an ellipsis; tapping the quote opens the entry. Padding 16 sides, 12 top, 16 bottom. |
| Below the header | Optional quiet verbs on Paper, one row, 12 apart, 44 hit. Links on Paper only: Deep Sky on Haze is large text only. |

### 6.10 The plan summary sheet with the assistant (pending build)

| Part | Value |
|---|---|
| Presentation | One sheet, large detent (a detailed back-and-forth needs the height). The assistant appears inside it; it never opens a second sheet [HIG Sheets]. |
| Top | Grabber, close (40 round), title: the plan name, Fraunces 600 `--fs-section`. The subject stays visible at the top while the conversation scrolls. |
| Body | 1. "What the assistant knows": one inset group of rows (race, race date, run days, long run, easy pace, starting miles). 2. The plan outline: week rows (week, phase, miles). 3. The conversation, below the outline, as answers grow. |
| Composer | Pinned at the bottom (brand 6.12), placeholder "Describe what to change", the provider disclosure under it exactly as written. |
| Proposal | A card in the conversation listing the changes as rows, "Apply" (Sky, 44 inline, the sheet's one primary) and "Not now" (quiet). On apply: the outline rows and the Plan page update in place, and a toast offers Undo. |

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
| Today | Hero, habits, today's goal, carry-over, top three | Week detail (the readout), habit history, the rest of the to-dos, the status sheet (the status pill while a status is on; in ordinary training, the title menu: hold the title or the date), the session |
| Goals | Today's goal, carry-over, tomorrow and next week, further out | Goal history ("See all"), the review sheet, each period's goal |
| Learned | Streak, prompt, this year's months | A month's items, older years |
| Plan | Your plan, this week's days | The plan summary with the assistant, a session, the month view, other weeks, the morning schedule |
| Progress | This week or the chosen range, trend and health tiles | A metric's page, a week's sheet, a lift's sheet |
| Journal | Remember when, this week's calendar, recent entries | An entry in full, the month view, share |
| Settings | Group rows with their current values | Each setting's page; delete account confirms in a sheet |

---

## 8. Checks

Run all of these on every screen you change, at **390 x 844, 320 x 844 and 440 x 956** (Playwright, `isMobile`, `hasTouch`, `deviceScaleFactor: 2`, the seeded account), then run the brand checklist (guide 13) and the brand-guardian agent. Look at every screenshot.

1. **Squint test.** Screenshot at 390 x 844 with `document.documentElement.style.filter = 'blur(8px)'`. The first thing you notice is the focal point named in section 2, and the second is the next thing to do.
2. **3-second test.** Look at the unblurred screenshot for 3 seconds, look away, and say what the screen is for and what you would do next. Both answers must match the screen's job and order in section 2.
3. **Layer-cake skim.** Read only the title, the hero's text and the section titles, top to bottom. They tell you what the screen is for.
4. **Focal point high.** The focal element's top is at most 300 pt at 390 x 844, and its key value is above the dock. On Today: hero top + 59 + 222 ≤ 690.
5. **Nothing extra above the focal point.** Only the elements section 2 lists sit above it.
6. **No false floor.** Something crosses the dock line on the first screen at each width.
7. **Gutter.** Every card edge, section title and chart starts 16 from the screen edge.
8. **Proximity.** For every heading, the gap above is at least 2x the gap below. Inside a card, no gap exceeds the card padding without a hairline. All values are on the scale (`node apps/web/scripts/check-brand.mjs <files>` adds no findings).
9. **Same relationship, same gap.** A section title to its content, or one row to the next, measures the same on every tab.
10. **Type counts.** At most 4 Fraunces and 5 Inter sizes on the screen, at most 3 sizes in any card, no 26 directly over a 22, at most one caption and one big number per card.
11. **One winner.** The largest block and the highest-contrast block are the same element. At most one glow or Haze wash header.
12. **One Sky button** at any scroll position.
13. **Containers.** At most three card templates. No run of 3 or more like sibling cards. No shadowed or bordered box inside a card (except the readout pill). At most 6 shadowed surfaces in the first screenful (a tile grid counts once).
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

The runtime brand audit covers contrast, the orange budget, the Orb tiers, one hero and Fraunces use: `node docs/brand/tools/audit.mjs <url> /today,/goals,/learned,/plan,/progress,/journal`.

---

## Sources

Full citations, with URLs and source types, are in `reports/Mobile layout and visual hierarchy.md`. The main ones:

- Apple HIG: Layout, Typography, Lists and tables, Charts, Charting data, Buttons, Segmented controls, Sheets, Disclosure controls, Accessibility, Color. https://developer.apple.com/design/human-interface-guidelines/ (first-party guidance)
- WWDC26 250 "Principles of great design", WWDC25 356 "Get to know the new design system", WWDC22 110340 and 110342 on charts, WWDC17 802 "Essential Design Principles". https://developer.apple.com/videos/ (first-party guidance)
- NN/g: F-pattern and scanning patterns, the fold, proximity, common region, cards, visual hierarchy, low contrast, progressive disclosure. https://www.nngroup.com/ (research firm with stated methods)
- Lindgaard et al. 2006, Tuch et al. 2012, Reinecke et al. 2013 (first impressions and visual complexity); Palmer 1992 (common region); Lagun et al. 2014 (attention on phones); Dyson and Haselgrove 2001 (line length); Cleveland and McGill 1984 (chart perception). (peer-reviewed)
- WCAG 2.2 SC 1.4.3, 1.4.11, 1.4.12, 2.5.8. https://www.w3.org/WAI/WCAG22/Understanding/ (first-party standard)
- The 14-app teardown: Apple Health, Fitness and Journal, Things 3, Streaks, Bevel, Oura, WHOOP, Strava, Runna, Structured, Gentler Streak, Finch, Day One. App Store screenshots, measured. (convention, not proof)
