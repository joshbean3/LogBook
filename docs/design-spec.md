# Logbook mobile design spec

The rules every screen follows. Derived from Apple HIG values and from how WHOOP, Oura, Strava, Apple Fitness, Things 3, Todoist, Structured and RISE lay out a phone screen. When a rule here conflicts with instinct, the rule wins.

## 1. Spacing (4pt grid)

Tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48.

- Side gutter 16px (`--gutter`). Vertical space between sections 32px (`.section` / `SectionHead`). Section header to its first row: 8px.
- Row height 44px minimum for one-line rows (habit, to-do), 60px for two-line rows (session).
- Card internal padding 16px. Cards are used only for the hero and for objects that are themselves tappable. Everything else is a grouped list (`Group`) or an edge-to-edge section.
- No double framing: a surface with a border never contains another bordered surface. Inner grouping uses a 1px `--line` divider or 8px of whitespace.
- Radii: 12px for cards and groups (`--r-lg`), 8px for chips/tiles/inputs (`--r-md`), 999 for pills.
- Tab bar 50px plus the safe area, labels 10px, 24px icons.

## 2. Type

One sans for everything, numbers included: SF Pro on iOS via `-apple-system`, Inter elsewhere (`--sans`). Fraunces (`.serif`) only as an editorial accent: the daily quote, journal text, the coach's read. Never on a metric.

| Role | Size/leading | Weight | Class |
|---|---|---|---|
| Display number | 56/60 | 700 | `.t-display` |
| Stat number | 28/32 | 600 | `.t-stat`, `.stat-val` |
| Large title | 34/41 | 700 | `.ph-title` |
| Title | 22/28 | 600 | `.t-title`, `.sheet-title` |
| Headline | 17/22 | 600 | `.t-head`, `.lrow-title` |
| Body | 17/22 | 400 | `.t-body` |
| Subhead | 15/20 | 400 | `.t-sub`, `.lrow-sub` |
| Label | 12/16 | 600, +0.06em, uppercase | `.t-label` |
| Caption | 12/16 | 400 | `.t-cap` |

Never 11.5, 13.5 or 14.5px. Pair a number with its label at a 2.3x size ratio or more. Tabular numerals are on by default.

## 3. Layout recipes

- **Dashboard (Today):** large title with the date under it; one hero (`.hero`: 96px ring + 28px title + one-line verdict + chips); a 3-up unframed `StatStrip`; then grouped lists under `SectionHead` eyebrows. One hero per screen; everything below is list weight.
- **Detail (session sheet, journal day):** summary stat strip on top, then sections 32px apart. Splits/sets are a bar list: label left, bar proportional, number right.
- **Timeline (Morning):** 7-day strip on top (44px cells, today filled), a 48px left time axis with hour labels in Caption, blocks whose height is duration × 1px per minute (minimum 32px), 4px gap between blocks, free time left empty, a 2px accent "now" line with an 8px dot in the axis, past blocks at 60% opacity.
- **Calendar (Plan week/month):** 7 columns, 44px day cells, one 6px dot or 2px bar per session in its tone colour, selected day a filled pill, today outlined. The selected day's sessions list under the strip as `SessionRow`s.
- **Trends:** segmented range control (1M / 3M / 6M) at top, one chart per section 160–200px tall, a single headline number plus delta above each chart, dynamic axis for volume.

## 4. Components (all in `src/ui/primitives.tsx` and `src/styles/ui.css`)

- `PageHeader` title/sub/actions. No eyebrow.
- `SectionHead` eyebrow label, optional meta, optional right action. 32px above (unless `first`), 8px below.
- `Group` one surface, hairline dividers between children. `Row` / `.lrow` 44px rows; `.lrow-add` for an inline add field.
- `.hero` grid: ring left, text right.
- `StatStrip` + `Stat` unframed 3-up numbers with hairline dividers; never four boxes.
- `Mark` 44px hit target: circle for habits and sessions, `square` for to-dos. Fill then draw the check; haptic.
- `Ring` fills from zero on appear.
- `Segmented` 32px pill. `Chip` status chips (`done`, `floor`, `missed`, `open`, `upcoming`, `tone`).
- `EmptyState` keeps the section's height, one sentence plus one action. Never a lone grey paragraph.
- `Button` (36px pill; `primary`, `soft`, `ghost`, `danger`, `sm` 30px), `IconButton` 44px, `ChipButton` 32px.
- `useSheet()` bottom sheet, `useToast()`.
- Session: `SessionRow` (60px, left tone bar, title, meta, one stat, chevron) and the session sheet with every action. Rows never carry action buttons.

## 5. Colour

Light: warm off-white ground `--bg`, white `--surface`. Dark: near-black ground, `--surface` one step up, no borders (`--card-border` is transparent in dark). Accent green is for navigation state and primary actions only. Status: `--ok` green, `--warn` amber, `--bad` red. Session tones `--t-easy/long/hard/fast/lift/cross/rest` via `.t-*` classes setting `--tone`.

## 6. Motion

Ring fill 600ms ease-out on appear. Check: fill 160ms then mark draws. Haptic on every completion. Button press scales to 0.98. Page change: CSS fade only (no JS exit animations around lazy views). Respect `prefers-reduced-motion`.

## 7. Anti-patterns to never reintroduce

Four identical KPI boxes; a card inside a card; serif numerals; a permanent row of action buttons under a list item; 18px gutters stacked on 16px card padding; a grey sentence as an empty state; odd font sizes; a glow block behind the active tab icon.
