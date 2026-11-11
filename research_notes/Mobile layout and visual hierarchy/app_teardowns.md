# How the best health, fitness and habit apps lay out a screen

Researched 2026-11-11 for Orby's layout and hierarchy pass on every tab. This note takes apart 14 apps: Apple Fitness, Apple Health, Apple Journal, Things 3, Streaks, Bevel, Oura, WHOOP, Strava, Runna, Structured, Gentler Streak, Finch and Day One. For each one it records the focal point, the number of hierarchy levels, the spacing rhythm, cards versus lists, title and number sizes against body text, what is left out, how charts are labelled and how a dense screen stays calm. It then pulls out the patterns that recur in the best of them and says what Orby should borrow, screen by screen. It sits next to `apple_hig.md` (Apple's guidance) in this folder; this note is the "what shipping apps actually do" layer.

---

## 0. Method, confidence and source labels

**Where the screens came from.** The current US App Store screenshots of each app, pulled through Apple's public lookup API (`https://itunes.apple.com/lookup?id=<id>&country=us`, read 2026-11-11; every listing had been updated between September and November 2026). 125 screenshots in total, viewed as contact sheets, plus 24 downloaded at full resolution (1242 to 1320 px wide) for measuring. Mobbin and similar galleries returned 403 without a login, so they were not used. Vendor blogs, Apple's design awards page, Apple support pages, design interviews and reviews fill in the reasons behind the layouts.

**How things were measured.** Pixel runs and glyph bounding boxes were computed with a small Python script on the full-resolution files.

- **Exact (full-bleed, @3x):** Apple Journal and Streaks ship screenshots that are the bare screen at 1290 or 1320 px, so 3 px = 1 pt.
- **Calibrated (device mockups):** for screenshots that show a phone in a frame, I took the screen's pixel width and the Dynamic Island's width (126 pt on every island iPhone). Their ratio tells the device: 0.28 to 0.29 means a 430 to 440 pt Pro Max, 0.31 to 0.32 a 393 to 402 pt Pro. Screen pixels divided by the device width gives px per pt. I cross-checked against the status-bar clock (its digits are about 14 pt tall on Journal, Health and Oura) and against body text where a list's body is almost certainly 17 pt (Things). Where the two checks disagree (Bevel, Fitness) I give the spread.
- **Type sizes** are cap height (or digit height) divided by 0.705, SF Pro's cap height. For the brand fonts in Oura, WHOOP and Streaks this is within about 10 percent.
- **Confidence:** full-bleed measurements to about 1 pt. Calibrated mockups to about 5 percent, Bevel and Fitness to about 8 percent. Marketing screenshots are staged: some have tiles enlarged past the phone edge (Bevel), tilted phones (Structured) or hands. I measured only content that sits flat inside the screen.
- **Orby's own numbers** come from the running app at c6cc577 (390 x 844, DOM measurement and screenshots).

**Source labels used on every claim.**

- **[Apple]** Apple's own pages: App Store listings, support articles, the Apple Design Awards page. First-party.
- **[Vendor]** The app maker's own blog, release notes or App Store listing. First-party, but marketing: it says what they intended, not whether it worked.
- **[Practitioner]** Design write-ups, interviews in design-tool blogs, reviews and critiques. Opinion or observation.
- **[Press]** News coverage summarizing a release. Secondary.
- **[Measured]** My measurement from the App Store screenshots, with the method above.
- **[Repo]** Read from `/home/user/LogBook` or the running app.

No peer-reviewed evidence is used in this note. Teardowns show what successful products converged on, which is useful evidence of convention, not proof of what works. The evidence layer belongs in the sibling notes.

---

## 1. The short version

Ten patterns recur in the best of these apps. Each line gives how many of the 14 do it.

1. **One focal element per screen, high on the screen.** Its top edge sits 11 to 32 percent of the way down (median about 22 percent) [Measured: WHOOP 12, Gentler 11, Fitness 14, Health 22, Journal Insights 22, Bevel 22, Oura 32]. Orby's Today hero card starts at about 363 pt of 844, 43 percent down, which is half of the 724 pt above the dock [Repo]. (12 of 14 have a clear single focal element; Apple Health Summary and Things are deliberate exceptions: calm lists with no hero.)
2. **Two-tier type contrast on dashboards.** The hero number is 3 to 6 times body size (Journal streak 95 pt, WHOOP 76, Gentler 66, Oura 56 against 15 to 17 pt body), and everything else drops sharply to within 1.3x body. Few mid sizes. Where there is a hero, the screen title is small or gone: Oura and WHOOP have no large title on their main screen, Journal's 34 pt title is 0.36x its 95 pt hero. Orby Today's 38 pt title and 40 pt hero are within 5 percent of each other, so they compete. (9 of 14)
3. **A numbers-then-words reading order.** The hero number has a short caps label under it ("READINESS", "RECOVERY"), then one plain sentence saying what it means ("Go get 'em!", "Your HRV is elevated while..."), then a link to go deeper. Oura, WHOOP, Bevel, Gentler and Apple Health's highlights all do this; Gentler's designers call it translating "stats into words" [Practitioner: Sketch]. (8 of 14)
4. **Units are smaller and quieter than numbers.** About 0.55 to 0.65 of the number's size, regular weight, secondary color: "1,367 steps" (28 pt bold, 17 pt gray) in Health, "31.3 ms" in Bevel, "5.5mi" in Gentler, "6.58MI" in Fitness [Measured]. (11 of 14)
5. **One repeated card template on a dashboard.** Apple Health's every card: colored icon and category name top left, timestamp and chevron top right, value bottom left, mini chart bottom right. Fitness, Bevel and Gentler tiles are the same idea. A reader learns the template once and then only reads values. (8 of 14)
6. **Color only for meaning.** A neutral base with each metric's color used on its label, icon and chart, never on the whole card. Things' interface is described as about 95 percent neutral, color "reserved for information" [Practitioner: Crosley]. The loud exceptions (Streaks' full-color screens, Finch, Structured's pink) are habit and planner apps aimed at play, and their critiques mention clutter [Practitioner: Pratt on Finch]. (10 of 14)
7. **Lists inside cards, cards inside sections, nothing deeper.** Three levels of containment at most: section, card, row. Rows separated by hairlines or space, never by nested cards. (13 of 14)
8. **Spacing ratios, not just values.** Card and tile gaps 8 to 12 pt; side margins 16 to 20 pt; section breaks about 3 times the card gap (26 to 40 pt), with the section header tucked close to the card it labels (8 to 12 pt) [Measured]. Orby's brand tokens already match this (12, 32, 12) [Repo: brand guide 5.1].
9. **Charts are labelled sparsely and summarized in words.** Endpoint labels only (Streaks: "JUN 29, 2026 · 101 DAYS · TODAY"), a right-hand axis with two or three values, a headline number and comparison above the chart ("384.6 mi ▲12%" against "292.1 mi" for the prior period in Strava), and a sentence under it. A comparison series in gray behind the current one. (10 of 14)
10. **The time of day decides what leads.** Oura's Today highlight, WHOOP's recommendations and Gentler's "For You" all change between morning and evening [Vendor: Oura; Practitioner: the5krunner; Press: BGR]. Orby already does this with the Morning / Afternoon / No time choice; the pattern says the hero should change too. (4 of 14, all of them the health dashboards)

What the best leave out: decorative borders and inner shadows, a second accent color in the same card, more than one primary button per screen, axis titles, legends where a label on the line will do, and anything that only matters weekly on a daily screen (Oura moved trends to My Health: "these metrics don't change every day" [Vendor: Oura]).

---

## 2. Measurements at a glance

| App, screen | Scale method | Side margin | Card gap | Section rhythm | Screen title | Hero | Body / label | Hero : body | Focal top |
|---|---|---|---|---|---|---|---|---|---|
| Apple Health, Summary | Island ratio, 440 pt, 2.13 px/pt | 18 to 20 pt | 10 pt | Section header 22 pt bold right above first card | 34 pt (Large Title) | None. Card values 28 pt bold | Card label 15 pt semibold in category color; unit 17 pt gray | 1.6 (no hero) | First card 22% |
| Apple Fitness, Summary | Clock, about 2.17 px/pt (±8%) | not measurable (black on black) | 11 pt | Tiles only, no section headers above the fold | about 26 pt | Rings graphic; tile values about 34 pt rounded | Tile title 20 pt semibold; "Today" 15 pt | 2.3 | Rings card 14% |
| Apple Journal, Insights | Full-bleed @3x, exact | 20 pt | 8 to 9 pt | 26 pt above a section header, 8 pt below it | 34 pt | "16" streak, 95 pt | Section header 20 pt gray; stat labels about 19 pt | 5.6 | Hero tile 22% |
| Apple Journal, All Entries | Full-bleed @3x | 20 pt | n/a | 37 pt above "March", 11 pt below | 34 pt plus 15 pt gray count | None | Card padding about 17 pt | n/a | First card 23% |
| Oura, Today | Screen width and clock, 440 pt | Content centered | n/a | One centered column | None (logo in the bar) | "88", about 56 pt | Caps label about 15 pt; serif headline about 44 to 50 pt; body 17 pt centered | 3.3 | Gauge arc 32%, number 45% |
| WHOOP, Recovery | Screen width, 440 pt, 2.39 px/pt | about 20 pt | n/a | Dial, then a 4-row metric list, then a text card | None ("TODAY" caps, 13 pt) | "85%", about 76 pt | Row labels 11 pt tracked caps; row values about 18 pt bold; body 15 to 16 pt | 5.0 | Dial 12% |
| Bevel, Recovery | Island and clock, 2.3 to 2.55 px/pt | about 16 pt | about 8 pt | Ring, two stat tiles, insight card, link row | about 25 pt semibold, centered, with date under | "41%", about 38 pt | Body about 16 pt | 2.4 | Ring 22% |
| Things 3, Today | Body = 17 pt, 2.85 px/pt (matches island, 393 pt) | 16 pt | n/a (one inset gray block) | About 40 pt before "This Evening", hairline under the header | about 26 pt bold with a star | None | Row title 17 pt; subtitle about 14 pt gray; section header 18 pt bold | n/a | n/a |
| Streaks, Stats | Full-bleed @3x | 10 pt to the chart edges | n/a | Pink hairlines between bands | None (a pill "ALL TIME") | Three stats about 35 pt condensed | Caps labels about 15 pt condensed | 2.3 | Stats band 40% (icons above) |
| Gentler Streak, Steps | Label = 15 pt, 2.64 px/pt | about 16 pt | n/a | Hero orb, 2 x 2 stat grid, hairline, "Progress" chart | 17 pt bar title | "11,175", about 66 pt | Stat values about 30 pt; labels 15 pt gray | 4.4 | Hero 11% |
| **Orby, Today (now)** | DOM at 390 x 844 | 16 pt | 12 pt | 32 pt and 12 pt (tokens) | 38 pt Fraunces | "Easy 6.5", 40 pt Fraunces | Body 16 pt; quote 17 pt italic | 2.5 | Hero card 43% |

Card radii, for comparison: Apple Health's cards measure about 26 pt (iOS 26's larger, concentric corners); Journal's entry cards about 13 to 16 pt; Things' inset block about 11 pt. Orby uses 24 pt for cards and 18 pt for tiles [Repo], in line with Health.

Row pitch, for comparison: Things' two-line to-do rows are exactly 44 pt; WHOOP's metric rows 59 pt; Runna's day rows about 46 pt [Measured]. Orby's brand guide asks for 56 pt rows (64 with a subtitle) in inset groups [Repo], which is on the generous side, closer to WHOOP than Things.

---

## 3. App by app

Each entry: the screen studied, then focal point, hierarchy levels, spacing, cards versus lists, type and number scale, what they leave out, charts, how they stay calm, and what Orby should borrow (with the Orby screen it fits).

### 3.1 Apple Health: Summary

Sources: App Store screenshots [Apple: https://apps.apple.com/us/app/apple-health/id1242545199]; "Use the Health app on your iPhone or iPad" [Apple: https://support.apple.com/104997].

- **Focal point.** Deliberately none. Summary is a pinned list of equally weighted cards that the person chooses ("Tap Edit next to Pinned... tap a category to add or remove it" [Apple support]). The first card sits 22 percent down. Health is the calm-list end of the spectrum.
- **Levels.** Four: Large Title "Summary" (34 pt), section header "Pinned" (22 pt bold) with a trailing "Edit" link, card label (15 pt semibold in the category color with an icon), value (28 pt bold) with unit (17 pt gray). A timestamp and chevron in gray at the top right are a fifth, quiet level.
- **Spacing.** Side margins 18 to 20 pt (the system's larger-phone margin), 10 pt between cards, each card about 133 pt tall, about 26 pt corner radius. Card padding about 16 pt; the label's cap top is about 20 pt below the card's top edge [Measured].
- **Cards versus lists.** Cards for metrics on Summary; plain grouped lists for settings and categories (Browse).
- **Type and numbers.** Body 17 pt. Values only 1.6x body. Units at 0.6x the value, gray.
- **Left out.** Axes on the mini charts, legends, card titles beyond the category name, any explanatory text on the card itself. Highlights below the pinned list carry the words ("Last night, you went to bed 31 minutes earlier than your average bedtime").
- **Charts.** On cards: unlabelled micro bar charts, gray bars with today's bar in the category color. On detail screens (Sleep Score, Heart Rate Highlights): a sentence first, then two or three labelled values ("Average Bedtime 11:25 PM", "Last Night's Bedtime 10:54 PM"), then the chart with only start and end dates on the x axis and two values on a right-hand y axis.
- **Calm.** One template repeated; the category color appears only on the icon, the label and today's bar; the background is a soft wash at the top that fades to gray.
- **Borrow for Orby.** Progress health tiles: the Health card template exactly (label with icon top left, value and unit bottom left, micro chart bottom right, no axis). Progress trends: the "sentence, then two labelled numbers, then chart" order on detail sheets. The faded top wash behind the title is close to Orby's dawn wash already.

### 3.2 Apple Fitness: Summary

Sources: App Store screenshots [Apple: https://apps.apple.com/us/app/apple-fitness/id1208224953]; trends compare "your last 90 days of activity to the last 365" [Apple: https://support.apple.com/guide/watch/track-daily-activity-with-apple-watch-apd3bf6d85a6/]; the Activity Rings card cannot be moved or removed, every other card can [Press: https://www.iphoneincanada.ca/2025/01/02/customize-your-fitness-app-summary-tab/].

- **Focal point.** The Activity Rings card, full width, pinned first (14 percent down). The rings graphic is the focal element; the three numbers beside it are color-matched to their ring.
- **Levels.** Three below the title: tile title (20 pt semibold, white), small context word ("Today", 15 pt gray), value (about 34 pt, colored, with a small-caps unit).
- **Spacing.** Full-width hero card, then a strict two-column grid of square-ish tiles, 11 pt gaps everywhere, about 16 pt tile padding.
- **Cards versus lists.** All cards on Summary. Workouts tab uses large single-column cards with a play button.
- **Type and numbers.** Tile values 2.3x the 15 pt caption. Units in small caps at about 0.6x.
- **Left out.** Section headers above the fold (the tiles name themselves), chart axes beyond 4 time labels, any text explaining the rings.
- **Charts.** Micro bar charts inside tiles with only "12 AM, 6 AM, 12 PM, 6 PM" under them, faint vertical gridlines, colored bars.
- **Calm.** Same tile size and template in every cell; color only on values and bars; black ground so color reads as data.
- **Borrow for Orby.** Today's hero card plus the two-column habit tiles is already this layout. Borrow the fixed first position (the hero never moves; everything below it can) and the "tile names itself, no section header needed" idea for small groups. Keep Orby's light Paper cards: the black ground is Fitness's brand, not the reason it reads well.

### 3.3 Apple Journal: All Entries and Insights

Sources: App Store screenshots [Apple: https://apps.apple.com/us/app/journal/id6447391597]; iOS 26 added multiple journals and an Insights view with streaks [Press: https://9to5mac.com/2025/06/17/apples-journal-app-is-coming-to-ipad-and-mac-with-big-upgrades/].

- **Focal point.** All Entries: the newest entry card with its photo grid. Insights: the "Current Streak 16 Weeks" tile, a dark tile in a light screen, with a 95 pt numeral.
- **Levels.** Insights: Large Title (34 pt), gray section header (20 pt semibold: "Streaks", "Stats", "Calendar"), tile label, big number, unit word. All Entries: Large Title with a gray count under it ("77 Entries"), month header ("March", about 22 pt bold), card (title, body, footer with date and a more button).
- **Spacing.** 20 pt margins; 8 to 9 pt between tiles; about 26 pt from the end of one block to the next section header, then only 8 pt from that header to its tiles; 37 pt above a month header in the entry list and 11 pt below it. The pattern is "far from the previous thing, close to the thing it names" [Measured].
- **Cards versus lists.** Entries are cards (each entry is a self-contained object with media). The journals index is a plain list with icons, names and counts.
- **Type and numbers.** The streak numeral is 5.6x body; the secondary stats (23 weeks, 29 entries, 74 days, 4.9K words) are 43 to 48 pt, 2.5 to 2.8x. Units are words under the number ("Weeks", "Days") in the same color, smaller.
- **Left out.** Chart axes beyond month initials and three right-hand values; any decoration inside entry cards beyond the media.
- **Charts.** The "29 Entries This Year" tile holds a tiny bar chart with month initials and 0, 10, 20 on the right, faint gridlines.
- **Calm.** Few colors (indigo, coral, ink), mosaic tiles of equal height in each row, gray section headers that recede.
- **Borrow for Orby.** Journal: the month header rhythm (far above, close below) for the entry list, and the gray quiet section headers. Learned: the streak tile is the direct model for the pending lightbulb streak (a big count, a unit word, and on Orby, the last seven days as bulbs). The writing prompt card ("Who do you want to connect with today?" in a tinted card) is the model for "Remember when" as a tinted header.

### 3.4 Things 3: Today and Upcoming

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/things-3/id904237743]; design study [Practitioner: Blake Crosley, https://blakecrosley.com/guides/design/things]; Apple Design Award 2017 [Practitioner summary of an interview, via search, https://sspai.com/post/39724, not opened].

- **Focal point.** The title line, a yellow star and "Today". Things has no hero: the list is the content.
- **Levels.** Four: title (about 26 pt bold with its icon), the calendar block (an inset gray group with colored times), to-do rows (17 pt title, 14 pt gray project name under it), and evening section header (18 pt bold with a moon icon and a hairline under it).
- **Spacing.** 16 pt margins. Two-line rows on an exact 44 pt pitch. About 40 pt of white space before a section header; the hairline sits right under the header and the rows follow immediately. Row text starts about 44 pt from the screen edge, aligned past the checkbox, and nested detail indents to the same line [Practitioner: Crosley gives 44 px indent].
- **Cards versus lists.** Lists, no cards. The only container is the inset calendar block, which groups items that are not to-dos.
- **Type and numbers.** Upcoming uses a numeral as a section header: "10 Tomorrow", "11 Thursday", the day number about 1.5x the label. That is the one place size carries meaning.
- **Left out.** Cards, shadows, borders around rows, counts in headers, and, by design, features like dependencies or Gantt views: "Reserve color for information" and "constraints create clarity" [Practitioner: Crosley].
- **Charts.** None.
- **Calm.** About 95 percent neutral, color only for meaning: yellow Today, red deadline flag, indigo evening, blue tags [Practitioner: Crosley].
- **Borrow for Orby.** Goals: "Further out" (This week, November, 2026) and History read better as a Things-style list with the period as a bold header than as three near-identical cards with dashed circles. Today's "Plan your day" top three: keep rows on a 44 pt pitch with the second line in gray, and indent to the text. Upcoming's big day numeral is a good header for Plan's day-by-day week.

### 3.5 Streaks: tasks and stats

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/streaks/id963034692]; review [Practitioner: John Voorhees, MacStories, https://www.macstories.net/reviews/streaks-3-review/]: "One of the app's most opinionated design decisions from the start was to limit users to tracking just six goals"; the screen is "dominated by up to six circles with icons in the center"; Apple Design Award 2016 [Practitioner: MacStories, same page].

- **Focal point.** A 2 x 3 grid of large circular task buttons, each ring showing the day's progress, the task name in caps under it.
- **Levels.** Two on the home screen: the circle (icon plus small count) and the caps name. Stats: three big numbers with caps labels, then charts.
- **Spacing.** Very generous: six items fill the whole screen. Stats: bands separated by thin colored hairlines, no cards.
- **Cards versus lists.** Neither on the main screen (free-standing circles); grouped rows in settings.
- **Type and numbers.** Stat numerals about 35 pt condensed bold, labels about 15 pt condensed caps.
- **Left out.** Text on the home screen beyond names; chart y axes entirely; gridlines.
- **Charts.** The best-labelled minimal chart in the set: a line chart with only "JUN 29, 2026", "101 DAYS" and "TODAY" under it, ticks along the bottom, the endpoints marked. Weekday bars with single letters. A time-of-day line with only "06:00" and "18:00".
- **Calm.** A hard limit on count (originally six) does the calming. The full-color backgrounds are loud, but there is only one color per screen.
- **Borrow for Orby.** Progress charts: endpoint-only labels and a span label ("101 DAYS") instead of a full axis. Learned's bulb streak: the circle-with-ring idea at small size. The six-item limit supports Today's top three: a hard cap is a design tool.

### 3.6 Bevel: Today, Recovery, Sleep

Sources: App Store screenshots and listing; its screenshots carry Apple's "New and Noteworthy" and "Apple Watch Spotlight" laurels [Vendor: https://apps.apple.com/us/app/bevel-ai-health-coach/id6456176249].

- **Focal point.** On Recovery, a white ring gauge over a landscape photo, "41%" in the ring in the state color, "Recovered" under it. On Today, three small rings (Strain, Recovery, Sleep) in a row under the date.
- **Levels.** Title and date (centered, about 25 pt), ring number, two stat tiles, an insight card with a one-line headline and two to three sentences, a link row ("View insights"), then the next section.
- **Spacing.** About 8 pt between cards, 16 pt margins; insight text at about 16 pt with comfortable 1.4 line height.
- **Cards versus lists.** Cards for stats and insights; Sleep's stage breakdown is a 2 x 2 grid of tiles each with its own small ring.
- **Type and numbers.** Ring number about 2.4x body. Stat tiles set value and unit on one baseline, unit gray ("31.3 ms"), with a colored up or down triangle at the far right.
- **Left out.** Long labels: tiles say "Resting HRV", "Resting HR" and nothing else.
- **Charts.** Strain Score: a line with an average band shaded behind it and an "Avg. 66%" chip on the band, right-hand axis with three values, a "Normal range" note in green above. Sleep stages: a hypnogram with only start and end times.
- **Calm.** The image sits behind the hero only; everything below is white cards on a pale ground. One state color per screen.
- **Borrow for Orby.** Today's hero card already descends from this. Borrow the up or down triangle as the only color in a stat tile (Progress trends, health tiles), and the "average band plus one chip" chart labelling for Progress's plan versus actual chart. Do not borrow the photo background: Orby's guide reserves art for brand surfaces [Repo: brand guide 8].

### 3.7 Oura: Today, Vitals, My Health

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/oura/id1043837948]; "A new Oura app experience", October 3, 2024 [Vendor: https://ouraring.com/blog/new-oura-app-experience/].

- **Focal point.** Today: a semicircular gauge with "88" and the caps label "READINESS" centered beneath, then a serif headline ("Go get 'em!"), two lines of centered body, and a pill button "Learn more". Oura's stated aim: "We wanted to make the Today tab like the 'Top Stories' page of a news app" and "Depending on the time of day (or night) you open the Oura App, Oura will surface a health insight" [Vendor].
- **Levels.** Five, in a single centered column: a row of small score circles across the top (number about 24 pt, label 15 pt), the gauge number (about 56 pt), the caps label (about 15 pt, tracked), the serif headline (about 44 to 50 pt), body (17 pt).
- **Spacing.** Generous vertical space; the hero block occupies about 60 percent of the first screen. The secondary score row is compact (about 70 pt tall) and horizontally scrollable.
- **Cards versus lists.** Today's hero is not a card: it sits on the background image. Vitals uses a two-column grid of tiles in sections (Readiness, Sleep), each tile with a caps label, a status word in color ("Optimal", "Good") and a big value at the bottom.
- **Type and numbers.** A serif for one headline sentence, a sans for everything else. The serif headline is almost the same size as the number: here the number and the sentence are one unit.
- **Left out.** The large title (the bar shows the logo), any chart on Today, and trends, which moved to My Health because "these metrics don't change every day and night" [Vendor]. Five tabs became three [Vendor].
- **Charts.** Sleep: a stage chart with only bedtime and wake time pills on the x axis; under it, labelled bars with percentages. Heart Health: a stepped line with "Above / Aligned / Below" as the only y labels and a callout chip at the latest point ("8 years younger").
- **Calm.** One column, centered; dark ground; very few elements per screen; a sentence where another number could have gone.
- **Borrow for Orby.** Today's hero: the "number, caps label, one plain sentence, one link" order is exactly what the U-arc gauge wants. Orby's guide already gives the gauge a caption eyebrow, the session name in Fraunces and a detail line [Repo: brand guide 6.5]; Oura's lesson is to let that block be the biggest thing on the screen, and to keep only one sentence. Oura's compact top score row is the right weight for Orby's week strip: small, scannable, above the hero, not competing with it. Progress: Oura's "Above / Aligned / Below" labels are a good model for plan versus actual (ahead, on plan, behind) instead of a numeric y axis.

### 3.8 WHOOP: Home and Recovery

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/whoop/id933944389]; "the all new WHOOP home screen" [Vendor: https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/, returned 403 to my fetcher; quoted from the search summary: "Three new separate dials at the top of the Home screen reflect the primary metrics core to WHOOP"]; review [Practitioner: the5krunner, https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/]: "new users of WHOOP may find the amount of information on the screen daunting" and "navigating to more detailed insights is not always intuitive."

- **Focal point.** Recovery: a full ring dial, "85%" at about 76 pt, "RECOVERY" in tracked caps, directly under the nav bar (12 percent down). Home: three smaller dials in a row (Sleep, Recovery, Strain).
- **Levels.** Dial number, caps label, a four-row metric list (icon, caps label, value, trend arrow), a legend line ("Today vs. prior 30 days"), an outlined text card with a sentence and a caps link ("BREAK DOWN MY RECOVERY"), then the next section ("Today's Activities").
- **Spacing.** Metric rows on a 59 pt pitch with hairlines between them; the dial has about 40 pt of space below it before the list.
- **Cards versus lists.** One dark card holds the metric list; the explanation is an outlined card; sections below are lists.
- **Type and numbers.** Hero 5x body. Row labels are 11 pt tracked caps, values about 18 pt bold, so the eye reads values down the right edge.
- **Left out.** Units on most row values (HRV 124, RHR 49), axis labels on the small bars in Sleep.
- **Charts.** Stress Monitor: a line with three y values, four x times, event icons above the chart at the times they happened, and a text card under it ("Most of your time was spent in the low stress zone...").
- **Calm.** Fails for newcomers by the reviewer's account: too many caps labels and too many screens. Works for experts because every screen uses the same dial, list, sentence order.
- **Borrow for Orby.** The value column: right-aligned, bold, tabular figures, so a list of numbers reads as a column (Progress trends, Settings data). The sentence card under the hero with one caps link. **Do not borrow:** caps for row labels (Orby's guide allows one caption per card [Repo: brand guide 4.3]) and the dark, dense dashboard.

### 3.9 Strava: Home, Record, You, Progress

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/strava-run-bike-walk/id426826309]; the You tab gathers "progress, activities and the old profile" [Press: https://www.bikeradar.com/news/strava-beta-test-layout/].

- **Focal point.** Home: the activity card's map or photo. Progress: the headline numbers above the chart.
- **Levels.** Progress: filter chips (sport, metric, time), "Total Distance" label, two numbers side by side (this period "384.6 mi ▲12%", prior period "292.1 mi" with its dates in gray), the chart, a comparison chip ("Prior 3 months ×"), a text summary ("You've logged 12% more distance").
- **Spacing.** Dense; dark ground; 16 pt margins.
- **Cards versus lists.** The feed is full-width cards with a fixed template (athlete, title, three stats in a row with small labels, media, kudos row). Leaderboards are lists.
- **Type and numbers.** Feed stats are small (about 15 pt values with 11 pt labels): the media leads, not numbers.
- **Left out.** In the feed card: everything but distance, time and one more stat.
- **Charts.** Progress: current period as a filled area with point markers, prior period as a thin line, right-hand axis with three values, only month names on the x axis, the comparison named in a removable chip.
- **Calm.** Fixed templates; orange used for brand and the current series only.
- **Borrow for Orby.** Progress running chart with the pending range views: headline total and delta above the chart, the prior period as a quiet comparison series, a sentence under it. Strava's three-stat row (value over a tiny label, three across) suits Plan's session rows and Today's readout pill content ("0 of 23 mi · 0 of 4 runs"). Strava data never goes to the assistant and the release build stays Strava-free; this borrows layout only.

### 3.10 Runna: Plan Overview, Week, Performance

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/runna-running-plans-coach/id1594204443].

- **Focal point.** Plan Overview: the plan card ("Marathon Plan", race date, race name, a race badge on the right) with 26 dots showing weeks done, and two stats ("TOTAL WEEKS 5/26", "TOTAL DISTANCE 198/526 mi").
- **Levels.** Screen title (about 24 pt bold), plan card title (about 20 pt semibold), two gray detail lines, progress dots, caps stat labels with bold values. Week card: date range in caps ("17-23 NOV"), "Week 1" (about 24 pt bold), a segmented bar (one segment per workout), a summary line ("WORKOUTS: 5 · DISTANCE: 26KM"), then day rows: color square, day in gray, workout name.
- **Spacing.** Day rows about 46 pt; 16 pt margins; one card per week.
- **Cards versus lists.** One card per week, a list of days inside it.
- **Type and numbers.** Plan stats about 1.4x body: Runna puts the hierarchy in the dots and the color squares, not in big numbers.
- **Left out.** Per-day detail on the overview (tap a day for pace and structure).
- **Charts.** Performance: weekly bars with the current week in the accent color, three right-hand values, month names on the x axis, a "VIEW BY: WEEK" control, three summary stats above.
- **Calm.** Color squares are the only color in a week card; gray for day names; the week is one card.
- **Borrow for Orby.** Plan: the "YOUR PLAN" card should look like Runna's overview: plan name, race date, a weeks-done row (dots or ticks), two stats; tapping it opens the summary where the assistant now sits. The week below as day rows with the session's data tone as the only color, day name in Dusk. Plan's summary sheet: Runna's "Your plan is customized based on these details" bullet list is the right shape for "what the assistant knows" above the composer.

### 3.11 Structured: Timeline

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/structured-daily-planner-todo/id1499198946]; review [Practitioner: https://coolcuration.com/structured-app-review-uk] quoting Apple's design award citation ("Visually sharp and easy to scan, this SwiftUI-built daily planner prioritizes downtime as much as productivity"; the 2026 finalist status is the review's claim, not checked on Apple's site), praising "Gaps between tasks show as real space, so overcommitting becomes obvious," and warning "Stack a dozen fifteen-minute tasks together and the column compresses into an unreadable ribbon of colour."

- **Focal point.** The vertical timeline: colored capsules on a line, each capsule's height proportional to duration, the time range above each title.
- **Levels.** Week strip with colored dots under each day, all-day items as round icons, then timeline items (time range in small gray, title in 17 pt semibold, completion ring at the right).
- **Spacing.** Time is space: empty time is empty screen.
- **Cards versus lists.** Neither: a timeline.
- **Left out.** Clock gridlines; only times on items.
- **Calm.** One color per item category; white ground; the week view compresses a week into dots.
- **Borrow for Orby.** Today's wake-to-door timeline in the hero card and Plan's "Wake time in 5 h 9 min" block: label the four points with times only, keep proportional spacing so the gap to the door reads as time. Watch the crowded-day failure: if four points get close, drop labels to the ends rather than overlap.

### 3.12 Gentler Streak: Streak, Wellbeing, Steps, Activities

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/gentler-streak-workout-tracker/id1576857102]; Apple Design Award 2024, Social Impact: "relies on a subtle and consistently pleasing design language. Its health data is smartly organized, and its Monthly Summary view... is less about hard comparisons and more about progress" [Apple: https://developer.apple.com/design/awards/2024/]; interview, September 11, 2024 [Practitioner: Sketch, https://www.sketch.com/blog/gentler-streak/]: "our northern star is simplicity", "we also translate those stats into words", "design an app where you feel at home from the first time you open it"; the March 2025 redesign asked "if we were launching version 1.0 with what we have today, how would we design it?" and moved "everything that matters most right there on the Streak" [Press: https://bgr.com/tech/gentler-streak-gets-a-major-redesign-focused-on-your-wellbeing/].

- **Focal point.** Steps: a large warm glowing orb with "11,175" (about 66 pt) and "Above Typical Saturday" in it, 11 percent down. Streak: an illustration plus a status headline ("Great Effort Today").
- **Levels.** Hero (number and a comparison phrase), a 2 x 2 stat grid (15 pt gray label over a 30 pt value with a small unit), a hairline, a section ("Progress", 20 pt bold, with a gray subline "vs. typical Saturday · 6684 steps"), the chart.
- **Spacing.** About 16 pt margins; stat grid rows about 90 pt; a hairline before the chart section instead of a card edge.
- **Cards versus lists.** Mostly open layout on white with hairlines; small tiles for body metrics.
- **Type and numbers.** Hero 4.4x the label; secondary stats 2x. Units tiny and attached ("5.5mi", "1h 59m").
- **Left out.** Cards around stats; chart y axis except two labels at the right (10K, 5K) plus the comparison line's value (6.7K).
- **Charts.** Today's cumulative line in color over a gray "typical" line, dashed gridlines at two levels only, labels at the right edge. Activities: a Week / Month / Year / All Time segmented control over a cumulative line comparing "April 2025 vs. March 2025".
- **Calm.** Illustration and warmth at the top only, a quiet white body; status said in words.
- **Borrow for Orby.** This is the closest match to Orby's voice (warm, optimistic, never pushy). Progress: the segmented range control over a cumulative line with a gray comparison line is the model for the running chart's new ranges, and the headline "April vs. March" is the right subtitle. Today: the comparison phrase inside the hero ("Above Typical Saturday") is how the readout pill can carry meaning in words without adding a row.

### 3.13 Finch: Home, goals, streak

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/finch-self-care-pet/id1528595748]; critique [Practitioner, student critique: https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/] on clutter and cognitive load.

- **Focal point.** The pet in its scene, top half of the screen.
- **Levels.** Scene, an adventure progress bar, a goals header ("3 goals left today!"), a caps divider ("START THE DAY"), goal rows (icon, name, energy reward, a check button).
- **Spacing.** Rows about 52 pt as separate rounded white pills with 8 pt gaps.
- **Cards versus lists.** Each goal is its own card; that is part of why critiques call it cluttered.
- **Charts.** "My Self-Care Progress" rows with tiny dot-and-bar sparklines and no labels; the 30 day streak screen shows the week as seven circles with day letters, done days checked, future days dim.
- **Calm.** Not calm by design: playful color everywhere, many badges and currencies.
- **Borrow for Orby.** Only the week-of-circles streak row (Learned's lightbulb streak: seven bulbs with day letters, lit on days with a learning, today outlined, future dim). **Do not borrow:** one card per row, multiple currencies, caps dividers inside lists.

### 3.14 Day One: list, calendar, On This Day, prompts

Sources: App Store screenshots [Vendor: https://apps.apple.com/us/app/day-one-daily-journal-diary/id1044867788]; release notes, March 19, 2025 [Vendor: https://dayoneapp.com/releases/major-navigation-update-with-journals-more-tab/]: two new tabs "to simplify navigation", On This Day "completely reimagined" with "a larger focus on memory-keeping".

- **Focal point.** The journal's color band and title at the top of each journal; on the home screen, the "On This Day" row of photo cards.
- **Levels.** Home: section header (about 20 pt bold) with a trailing accent link ("See more"), then the content (a horizontal row of memory cards, a tinted prompt card in a serif, a photo row). List: month header, then entry rows (date as a weekday caps over a large day number at the left, title in bold, two lines of body, a gray metadata line, a thumbnail at the right).
- **Spacing.** Entry rows about 96 pt with a date gutter; prompt card full width with large padding.
- **Cards versus lists.** Entries as list rows with a date gutter; prompts and memories as cards.
- **Type and numbers.** The day number in the date gutter is the only large number; it makes the list scannable by date.
- **Left out.** Borders between list entries (space only), word counts on rows.
- **Charts.** None on these screens; a calendar view fills days with photo thumbnails.
- **Calm.** One color per journal; serif only for the prompt; strong date gutter.
- **Borrow for Orby.** Journal: "Remember when" as Day One's On This Day block (caps caption, the quote "On Oct 11 you wrote: ...", a share button) inside the tinted header, which is what the owner asked for. Entry rows with a date gutter (weekday caption over the day numeral) make the entry list scannable without cards; this also fills the space left by removing the Library view.

---

## 4. Patterns that recur, and why they work

### 4.1 Where the eye lands first

The health dashboards put one high-contrast element in the top third: a ring, a gauge or a big number. Apple's own guidance says the same thing: "the most important item on the screen is always the most obvious one" (see `apple_hig.md` section 1). The difference between the apps is only how much of the first screen it gets: WHOOP and Gentler about half, Oura about 60 percent, Apple Fitness about 25 percent with tiles below.

Orby now [Repo, 390 x 844]: above the hero sit the date caption, the 38 pt title, a two-line quote, the week strip (about 75 pt), two status chips (56 pt), and a "Close yesterday" link. That is six rows before the hero, and the hero card starts at 363 pt. None of the 14 apps put more than three rows above their focal element (Oura: bar, score row; WHOOP: bar; Bevel: bar, title and date; Gentler: bar).

### 4.2 Two tiers, not a staircase

The calmest screens use two clearly different tiers: one hero tier (3 to 6x body) and a body tier (body, with labels 0.65 to 0.9x and section headers 1.2 to 1.3x). The apps that feel busy (WHOOP, Finch, Strava's feed) add a third and fourth tier of mid sizes and caps labels. Orby Today shows sizes 11, 13, 15, 17, 22, 26, 38 and 40 in its first screen [Repo, DOM sample; some may be in hidden layers], with the title and the hero both near the top of the range.

### 4.3 Numbers then words

Every health dashboard pairs its main number with a sentence. The number gets attention; the sentence answers "so what?" (Oura's own phrase for My Health [Vendor]). Orby's hero already has a detail line ("Out the door in 5 h 24 min"); the pattern supports keeping exactly one such line and putting the readout pill's numbers in a single row.

### 4.4 Template repetition

Health, Fitness, Bevel, Gentler and Strava each use one card template per screen. When every card has the same anatomy, people stop reading the structure and read only values. Orby's Progress and Goals screens currently use several card shapes on one screen (Goals: chips, the tinted today card, a carry-over row, a "To review" card, three "Further out" cards with dashed circles, a history card).

### 4.5 Space as the divider

Gaps separate cards (8 to 12 pt); sections get about three times that; hairlines appear only inside a container (Things, WHOOP, Gentler). No app here puts a border on a card. Orby's guide already says "Never a divider between cards; the gap is the divider" [Repo: brand guide 5.4].

### 4.6 Charts that say one thing

Across Health, Streaks, Gentler, Strava, Oura, Runna and Journal: the headline value is printed above the chart, the comparison is a quieter second series (gray line, prior period), axes carry two or three values on the right and endpoint or month labels on the bottom, gridlines are faint or absent, and a sentence states the takeaway. Range controls are segmented controls (Gentler: Week / Month / Year / All Time in its screenshots; Apple Health's detail charts use D / W / M / 6M / Y, known from the app itself, not shown in these screenshots) or removable chips (Strava).

### 4.7 Lists where things are a sequence, cards where things are objects

Things (to-dos), Runna (days), WHOOP (metrics), Day One (entries) use rows for sequences of like items. Cards hold self-contained objects (a metric with a chart, a journal entry with media, a plan). Finch's one-card-per-goal is the counterexample critics call cluttered.

### 4.8 Quiet section headers with one trailing action

Journal's gray 20 pt headers, Health's "Pinned ... Edit", Day One's "On This Day ... See more": a section header is either a quiet label, or a label with one accent-colored text action at the trailing edge. Orby's "Habits ... History" already does this.

### 4.9 Progressive disclosure by tab, not by fold

Oura moved trends out of Today; Gentler moved stats out of the main streak; Day One moved On This Day and prompts into a More tab, then made a home screen that surfaces them [Vendor; Press]. The daily screen holds today; weekly and longer things live one tap away.

### 4.10 Time of day changes the lead

Oura, WHOOP and Gentler reorder or rewrite the top block between morning and evening [Vendor: Oura; Practitioner: the5krunner; Press: BGR]. Orby's hero already knows the training time (Morning, Afternoon, No time).

---

## 5. What Orby should borrow, screen by screen

Every suggestion keeps the owner-approved features and their order. Each says what changes (spacing, size, grouping, emphasis), why, and which app it comes from. The build team should still check each one against `docs/brand/brand-guide.md`, which wins on any conflict.

### 5.1 Today

1. **Move the hero up by tightening what sits above it, not by removing anything.** Target: hero card top at or above about 30 percent of the screen (about 250 pt at 844), against 363 pt now. Means: clamp the quote to one line with the italic subline style (it is 17 pt on two lines now); fold "Close yesterday ›" into the chip row or the week strip's yesterday cell instead of its own row; let the two status chips share one 44 pt row as slim pills (Oura's compact score row is the weight to aim for). Why: every peer puts at most three rows above its focal element (4.1). Source: Oura, WHOOP, Bevel, Gentler.
2. **Make the hero clearly the biggest thing.** The title (38 pt) and the session name (40 pt) are within 5 percent. Either the hero gets the size (the brand's `--fs-stat` range goes to 3.625 rem, 58 pt, for static hero stats; the session name rule is 40/42 [Repo: brand guide 4.2, 6.5]) or the title collapses into the bar sooner on Today. Ask the owner which: the guide fixes the session name at 40 pt, so a change needs a guide update. Why: two-tier contrast (4.2). Source: Journal Insights, Oura, WHOOP, Gentler.
3. **Inside the hero, keep the Oura order and one sentence.** Caption eyebrow, session name, one detail line, the readout pill. The pill should read "0 of 23 mi · 0 of 4 runs" (the pending fix; the guide already specifies this text [Repo: brand guide 6.5]). Move the Morning / Afternoon / No time pill and the wake-to-leave timeline below a hairline at the bottom of the hero, so the bowl holds only the readout. Why: numbers then words (4.3); WHOOP and Oura keep controls out of the dial.
4. **Habits grid stays as is.** It already matches Fitness's tile grid (12 pt gap, one template). Check that tile names never compete with the hero (they are 15 pt, good).
5. **Plan your day: Things-style rows.** Top three as rows on a 44 pt pitch, second line gray, text aligned past the number. The goal row and carry-over row as the same row template with a leading icon, not separate card shapes. Source: Things.

### 5.2 Goals

1. **One template for the period goals.** "Further out" (This week, November, 2026) as one list card with three rows, each row "period caption, goal or 'Set the week's goal', days left", instead of three cards with dashed circles. Why: template repetition and lists for sequences (4.4, 4.7). Source: Things Upcoming, Runna week rows.
2. **The Today goal card is the hero; the Tomorrow and Next week chips sit above it as they do, smaller in weight.** The large sun gradient in the corner of the Today card is the screen's one sunrise glow; keep it, and keep the card's single primary button.
3. **History as a quiet four-column stat row** (Day, Week, Month, Year) with values in tabular figures and labels in Dusk, like Strava's three-stat row. Source: Strava, Runna.

### 5.3 Learned

1. **Lightbulb streak tracker at the top** (pending request): a single card with the count large (Journal's streak tile) and the last seven days as bulbs under day letters, lit on days with a learning, today outlined, future dim (Finch's week row). Remove the "Learned: N things on N days" tile as asked. Why: the streak is the one number that changes daily, so it is the focal element; Journal and Streaks both lead with it. Source: Apple Journal Insights, Finch, Streaks.
2. **The prompt card under it** ("What did you learn today?") keeps its serif prompt; Day One's prompt card shows the serif is enough emphasis, so the card does not need a tint as well.
3. **Year list** ("2026 · 0 things", months) as Journal's month headers: far above, close below.

### 5.4 Plan

1. **YOUR PLAN card on the Runna model:** plan name (card title), race date and phase in a gray line, a weeks-done row (one tick or dot per week), two stats at most. Tapping it opens the summary. Source: Runna Plan Overview.
2. **The summary with the assistant** (pending request): Runna's "Your plan is customized based on these details" bullet list at the top of the sheet, then the composer, so the owner sees what the assistant knows before describing a change. The change lands through the existing proposal and apply flow.
3. **The week day by day as rows,** not stacked cards: day numeral and weekday at the left (Things Upcoming, Day One's date gutter), session name and detail, the session's data tone as the only color, a "Today" tag. Why: a week is a sequence (4.7).

### 5.5 Progress

1. **The running chart with range views** (pending request: 1W, 1M, 3M, 6M, YTD, 12M, All). Layout from Gentler and Strava: the Running / Strength swap first, then the range control, the headline total with the delta and the prior period in gray ("This month 41 mi, up 12% on October"), the chart with plan as the dashed quiet line and actual as the strong line, right-hand axis with two or three values, endpoint labels at the bottom, and one sentence under it. **Watch the width:** seven segments at 320 pt leave (320 - 32) / 7 = 41 pt each, under the 44 pt target; at 390 pt they are 51 pt. Options: a horizontally scrolling chip row (Strava uses chips), or keep the segmented control and test the 320 layout. Ask before shrinking below 44 pt.
2. **Trends as WHOOP-style rows inside one card:** label at left, value right-aligned in tabular figures, an up or down triangle as the only color (Bevel). Not separate cards.
3. **Health tiles on the Apple Health template** (3.1). The "Connect Apple Health" empty state stays a single row.
4. **Fix the habits tile readout** ("7 %, 7 days" reads as a broken unit) with the Health number-then-unit rule: the number bold, the unit small and gray on the same baseline.

### 5.6 Journal

1. **Remember when at the top, as the tinted header** (pending request): caption "REMEMBER WHEN", the quote "On Oct 11 you wrote: ..." in the italic sentence style, a share button at the trailing edge. Source: Day One On This Day, Apple Journal's prompt card.
2. **Remove the Entries / Library switch and the Library view** (pending request). The calendar card then sits directly under the header. Drop the legend line ("Entries 1 2 3+ Favorite") to a single short key or remove it if the dots are self-evident; Streaks and Journal print no legends.
3. **Entries as rows with a date gutter** (weekday caption over the day numeral), title and two lines of body, no card per entry, month headers in the Journal rhythm. Source: Day One list.

### 5.7 The dock, the tab capsule and the Orb

Keep as is. Every app here keeps a persistent bottom bar and one floating action (WHOOP's "+", Oura's sparkle button, Things' "+"), and Apple's guidance allows one persistent accessory above the tab bar (see `apple_hig.md` 2.2). The lesson for screens is to leave room for it: content must clear the 120 pt dock at the end of every scroll.

---

## 6. What not to borrow

- **Dark, dense dashboards** (WHOOP, Oura, Strava). Their density works for expert users and daunts new ones [Practitioner: the5krunner]. Orby's brand is light Paper on Cloud.
- **Caps for row labels** (WHOOP). Orby's guide allows one caption per card, at most four words [Repo: brand guide 4.3].
- **One card per list row** (Finch). Critics call it cluttered [Practitioner: Pratt].
- **Photo backgrounds behind data** (Bevel, Oura). Orby reserves art for brand surfaces [Repo: brand guide 8].
- **Proportional timelines with labels on every point** when points crowd (Structured's "unreadable ribbon" [Practitioner: coolcuration]).
- **Marketing exaggeration.** Several screenshots enlarge tiles past the phone edge (Bevel) or tilt the phone (Structured). Do not copy sizes from those parts.
- **A screen title as large as the hero** on a dashboard (none of the peers do this).

---

## 7. Sources

App Store listings and screenshots (first-party; the app maker's own marketing except where Apple is the maker). All read 2026-11-11 through `https://itunes.apple.com/lookup?id=<id>&country=us`.

- Apple Health: https://apps.apple.com/us/app/apple-health/id1242545199 [Apple]
- Apple Fitness: https://apps.apple.com/us/app/apple-fitness/id1208224953 [Apple]
- Apple Journal: https://apps.apple.com/us/app/journal/id6447391597 [Apple]
- Things 3: https://apps.apple.com/us/app/things-3/id904237743 [Vendor]
- Streaks: https://apps.apple.com/us/app/streaks/id963034692 [Vendor]
- Bevel: https://apps.apple.com/us/app/bevel-ai-health-coach/id6456176249 [Vendor]
- Oura: https://apps.apple.com/us/app/oura/id1043837948 [Vendor]
- WHOOP: https://apps.apple.com/us/app/whoop/id933944389 [Vendor]
- Strava: https://apps.apple.com/us/app/strava-run-bike-walk/id426826309 [Vendor]
- Runna: https://apps.apple.com/us/app/runna-running-plans-coach/id1594204443 [Vendor]
- Structured: https://apps.apple.com/us/app/structured-daily-planner-todo/id1499198946 [Vendor]
- Gentler Streak: https://apps.apple.com/us/app/gentler-streak-workout-tracker/id1576857102 [Vendor]
- Finch: https://apps.apple.com/us/app/finch-self-care-pet/id1528595748 [Vendor]
- Day One: https://apps.apple.com/us/app/day-one-daily-journal-diary/id1044867788 [Vendor]

Apple pages (first-party):

- Apple Design Awards 2024 (Gentler Streak, Social Impact winner, citation quoted): https://developer.apple.com/design/awards/2024/
- Use the Health app on your iPhone or iPad (Pinned, Highlights): https://support.apple.com/104997
- Track daily activity with Apple Watch (Fitness trends, 90 versus 365 days): https://support.apple.com/guide/watch/track-daily-activity-with-apple-watch-apd3bf6d85a6/
- Apple's layout, type and chart guidance is collected and cited in the sibling note `research_notes/Mobile layout and visual hierarchy/apple_hig.md` (HIG Layout, Typography, Charts; WWDC22 "Design an effective chart", https://developer.apple.com/videos/play/wwdc2022/110342/).

Vendor writing (first-party, marketing):

- Oura, "A new Oura app experience", October 3, 2024: https://ouraring.com/blog/new-oura-app-experience/
- WHOOP, "The all new WHOOP home screen": https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/ (403 to my fetcher; quoted from the search engine's summary of the page, lower confidence)
- Day One release notes, March 19, 2025: https://dayoneapp.com/releases/major-navigation-update-with-journals-more-tab/

Practitioner and press (opinion, observation or secondary):

- Ale Cubero, Sketch blog post on Gentler Streak, September 11, 2024 (interview with the Gentler Streak team): https://www.sketch.com/blog/gentler-streak/ [Practitioner]
- José Adorno, BGR, March 19, 2025, Gentler Streak redesign: https://bgr.com/tech/gentler-streak-gets-a-major-redesign-focused-on-your-wellbeing/ [Press]
- the5krunner, March 28, 2023, WHOOP home screen review: https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/ [Practitioner]
- John Voorhees, MacStories, Streaks 3 review: https://www.macstories.net/reviews/streaks-3-review/ [Practitioner]
- Blake Crosley, "Things 3: The Art of Focused Simplicity": https://blakecrosley.com/guides/design/things [Practitioner; his numbers are his own estimates and example code]
- Coolcuration, Structured review (quotes an Apple Design Award citation; finalist status not verified on Apple's site): https://coolcuration.com/structured-app-review-uk [Practitioner]
- Pratt Institute IXD, Finch design critique, February 2026: https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/ [Practitioner, student work]
- BikeRadar, Strava You tab: https://www.bikeradar.com/news/strava-beta-test-layout/ [Press]
- 9to5Mac, June 17, 2025, Apple Journal on iPad and Mac with Insights: https://9to5mac.com/2025/06/17/apples-journal-app-is-coming-to-ipad-and-mac-with-big-upgrades/ [Press]
- iPhone in Canada, January 2, 2025, customizing the Fitness Summary: https://www.iphoneincanada.ca/2025/01/02/customize-your-fitness-app-summary-tab/ [Press]

Repo:

- `docs/brand/brand-guide.md` sections 4.2, 4.3, 5.1, 5.4, 6.4 to 6.8, 8.
- The running app at c6cc577, http://localhost:5220, Sam's seeded account, screenshots and DOM measurements at 390 x 844, 320 x 844 and 440 x 956.

---

## 8. Gaps and limits

- App Store screenshots are staged marketing. Real accounts with more data are denser. I measured only flat in-screen content.
- Mockup calibration is about 5 to 8 percent; type sizes for non-SF fonts are about 10 percent.
- Mobbin, Screensdesign and similar galleries need logins, so no in-app flows beyond the App Store sets were seen. Runna, Strava and Finch have no first-party design write-ups that I could reach; their entries rest on screenshots.
- WHOOP's own page could not be fetched; its quote comes from a search summary.
- Structured's 2026 design award finalist status comes from a review, not Apple's site.
- No usage data or peer-reviewed study backs any single pattern here; convergence across 14 strong apps is the evidence. The sibling notes carry the research evidence.
