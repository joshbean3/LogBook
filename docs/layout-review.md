# Layout review

A page-by-page audit of Logbook's layout against Apple's Human Interface Guidelines and the shape system
(`docs/shape-system.md`), done after the craft pass (depth, glass, serif headers). Screens were shot at 390x844 and
320x640 on a fresh account (half marathon plan, two habits, four to-dos, a day goal), then checked by a script for
touch targets, type sizes, text contrast, horizontal overflow and dock clearance.

What was already right, and stays: one `.page` shell with a 16 pt gutter and a bottom pad that clears the dock on every
root and pushed page; the NavBar (date eyebrow, serif italic large title, collapsing to a centred 17 pt title); the
pushed bar (round back button, centred title); sheets (grabber, centred serif title, close left, pinned primary at the
bottom); inset groups with separators that start at the words; 56 and 64 pt rows. Nothing sat under the dock or the
status bar on any page.

## 1. What breaks, across the app

1. **Six section headers for one idea.** Today (`.day-sec-head`), Plan (`.pl-head`), Progress (`.pg-head`), the morning
   (`.m-head`), Settings (`.s-head`) and Goals, Learned, Journal and Reads (`KSection`, `.k-head`) each hand-roll the
   same title, meta and action. They drifted: Today, Plan, Progress and Settings speak the approved serif (craft.css
   overrides each one by name), but Goals, Learned, Journal, Library and Reads still show the old sans 20/600. Gaps
   differ (12 pt vs 8 pt), and Settings uses 28 pt serif headers over single-row groups, which shouts on a list page.
   Breaks: one type role per job (HIG Typography; shape system §2).
2. **Secondary text fails contrast on the page.** `--ink-3` (#5E7891) is 4.59:1 on white but 4.29:1 on the page
   (`--bg`) and 4.1:1 on wells, where every section meta, footnote, context-chip subtitle and inactive segment sits.
   `--ink-4` (#9AAEC1, 2.3:1) carries real words in places ("No goal set", the trend table's head and "Not enough yet",
   the empty dash in tiles). The red "Delete account" is 3.9:1. Breaks: 4.5:1 for body text, 3:1 for large text.
3. **Footnotes sit on three different insets.** `.k-foot` at 4 pt, `.s-foot` at 16 pt, `.mp-foot` centred, Goals' tip
   at 0. A footnote under a card should start where the card's words start (16 pt in). Breaks: one leading edge.
4. **Touch targets under 44 pt.** The Journal and Library segmented control (40 tall), the garden's day plants (34),
   Today's top-three names (30 tall inside a 52 row), Data sources' small Connect button (36 + 6), the metric range keys
   at 320 wide (39 wide). Breaks: 44x44 pt minimum.
5. **Spacing off the 4 pt grid and uneven under the title.** Context chips have 4 pt above and 18 below; Learned's title
   has a 24 pt gap where every other tab has 16; the first header on Settings and the segmented control on Goals
   History sit flush under the pushed bar (0 pt), while Reads and the metric page leave 12. Breaks: 4/8 pt rhythm,
   consistent rhythm between the bar and the first content.
6. **Tiles break at 320.** A tile's status word wraps under its icon ("Not today / yet" on Learned), and the label row
   can push the arrow out. Breaks: a tile's content must fit 150 pt (shape system §5).

## 2. Tab by tab

### Today
- Header: date eyebrow, serif title, avatar right, week strip. Right. Context chips: 4 pt above, 18 below (off grid).
- Habits: section header with meta and History action. Right, but hand-rolled; the History action is a separate class
  from every other header action.
- Close the day (evening) and the hero: right; 28 pt above.
- Tomorrow: a group of two rows, then a loose "Share the day" pill. Right per §3 (action pill), 12 apart.
- Plan your day: the goal card, then the top-three card. The to-do names are 30 pt tall buttons inside 52 pt rows
  (target too short; the row is the target the eye sees).
- This week: two tiles. Right. At 320, "Long run Saturday." wraps to two lines; fine.
- Dock clearance: the last tile ends 64 pt above the ask bar. Right.

### Goals
- Header and Day/Week/Month/Year control, 16 below the title. Right.
- Last 7 days, the rings card, Now (a horizontal carousel that bleeds to the screen edge, by design), Ahead, History.
- Section headers are sans 20/600 (Now, Ahead, History): not the approved serif.
- The tip under History sits on the page at 0 inset, full width, so it reads as page copy, not a footnote.
- History page: the segmented control is flush under the bar; "No goal set" is `--ink-4` (2.3:1).

### Learned
- Title gap 24 (others 16). The entry card, two tiles, then the year's months.
- At 320 the In a row tile's status wraps under its icon.
- "2026  0 things" header is sans 20/600.

### Plan
- Week/Month control in the bar's trailing slot (32 tall, 44 hit). Right.
- Morning card, This week (miles card, then the week's days card), Block. Headers serif. Right.
- Month view: out-of-month dates in `--ink-4` are decorative, fine; meta text fails on the page (token).

### Progress
- Context chips, the month card, Trends (four tiles), Vitals (tiles), Weeks, Activities (filter chips, then a card).
- Headers right (serif). Empty tiles show "–" in `--ink-4` at 28 pt (2.3:1; large text needs 3:1).
- Metric page: back, centred title and status, tiles, chart card, Trend table, About card. The table head and "Not
  enough yet" are `--ink-4` at 13 pt; the footnote is centred while every other footnote starts at the left.

### Journal
- Journal/Library control (40 tall), the garden card (day plants 34 pt), Day tags (group, footnote), Entries.
- Headers sans 20/600 (Day tags, Entries, Favourites, Your quotes, Themes).
- Footnote under Day tags at 4 pt inset.

### Settings
- Root: one 28 pt serif header over each single-row group (You, Habits, Morning routine, Data, Account) makes the page
  feel louder than the content. A settings page wants small headers (shape system §6).
- The first header ("You") is flush under the pushed bar.
- Sub-pages: footnotes right (16 inset). Data sources' small Connect button is 42 tall to the thumb.
- Account: "Delete account" red is 3.9:1.

### Sheets
- To-dos, the habit history, a goal, a session, Day tags. Grabber, centred serif title, close left, action right,
  primary pinned at the bottom. Right. Footnotes inside sheets use the 4 pt inset (Kit) where Settings uses 16.

## 3. Conventions to standardize

| Convention | Rule | Built as |
|---|---|---|
| Page shell | `.page`: 16 pt gutter (20 at 700+), bottom pad = 24 + dock + safe area | `.page` (exists) |
| Page header | Date eyebrow, serif italic 34/40 title, 16 pt gap to the first content on every tab | `NavBar gap={16}` |
| First content under a pushed bar | 12 pt below the bar | `.page > .pushed-bar + *` |
| Context chips | 0 above, 16 below; 52 tall, two lines | `.ctx-row` |
| Section | 28 pt above; header to first card 12 pt; cards 12 apart | `PageSection`, `Stack` |
| Section header | Serif 28/32 title; meta sans 15/20 `--ink-3` at the baseline; action sans 15/20 600 `--accent-text` with a chevron, right, 44 pt tall | `SectionHeader` |
| Small section header | Serif 22/28, for list pages (Settings) | `SectionHeader size="sm"` |
| Card | White, 22 radius, 16 padding, bevel shadow, no border | `.card` / `Card` (exists) |
| Tile grid | Two columns at every width, 12 gap, 18 radius, 14 padding; status wraps beside its icon, never under it | `TileGrid` + `.tile` |
| List group | 18 radius, rows 56/64, separators from the words | `Group` / `.group` (exists) |
| Empty state | One sentence and one verb inside the card it fills | `EmptyState` (exists) |
| Footnote | Sans 13/18 `--ink-3`, 8 pt under its card, 16 pt in from the card's edge (lines up with the card's words) | `Footnote` |
| Bottom clearance | The last content ends at least 24 pt above the ask bar | `.page` pad (exists) |
| Targets | 44x44 pt; a smaller visual extends its hit area with `::after` | per control |
| Contrast | `--ink-3` #57718A (4.75:1 on the page, 4.5:1 on wells); `--ink-4` #7C90A5 for glyphs and large numbers only (3:1); `--bad` #C8243F (5.2:1); words never in `--ink-4` | tokens |

## 4. Found and left alone

- The goal sheet for tomorrow asks "What is the one thing for today?" (`LEVEL.day.ask` is used for any day). Copy and
  logic, not layout.
- Metric range keys are 39 pt wide at 320; they touch each other across the whole track, so every point of the track is
  a target. Run days in Settings are 40 pt wide at 320 for the same reason: seven columns cannot reach 44 in 288 pt.
  (Since fixed: narrower than 374 pt the run days sit in two rows, four and three, 12 pt apart, and each is 64 pt wide
  at 320.)
- Out-of-month dates on Plan's month grid stay `--ink-4`: they are inactive.
- Today's top three is a tinted group inside a card. It is the one deliberate nested surface (it lifts the three to-dos
  that matter), so it stays.
- `JournalDaySection` and the primitive `Section` are unused by the tabs; `Section` stays for the UI gallery.
- Apple Health's settings card (`AppleHealth.tsx`, not edited) takes the small header through `SCard`.
