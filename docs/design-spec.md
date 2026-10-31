# Logbook mobile design spec

> See `docs/system.md` (v5) first: it carries the current tokens, primitives and the forbidden list. This document remains for the 4pt grid and the anti-patterns.

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

Three faces, each with one job, bundled in `public/fonts` (see `docs/brand.md` §4). Inter for body and labels; Inter Tight 800 for every stamped number (`.stamp`, `.stat-val`); Instrument Serif italic for the big words (`.display`, `.ph-title`) and for reading (quotes, journal text, the coach's read). Numbers are never serif; titles are never sans.

| Role | Size/leading | Face / weight | Class |
|---|---|---|---|
| Hero stamp | 44/44 | Inter Tight 800, uppercase | `.aura-title.stamp` |
| Page title | 44/46 | Instrument Serif italic | `.ph-title`, `.display` |
| Stat number | 28/32 | Inter Tight 800 | `.stat-val` |
| Stamped stat | 22/24 | Inter Tight 800 | `.aura-num` |
| Title | 22/28 | Inter 600 | `.t-title`, `.sheet-title` |
| Headline | 17/22 | Inter 600 | `.t-head`, `.lrow-title` |
| Body | 17/22 | Inter 400 | `.t-body` |
| Subhead | 15/20 | Inter 400 | `.t-sub`, `.lrow-sub` |
| Caption | 12/16 | Inter 400 | `.t-cap` |
| Caps label | 11/14, +0.12em, uppercase | Inter 600 | `.caps`, `.t-label` |
| Tab label | 10/12 | Inter 500 (600 active) | `.tab-label` |

Scale: 10, 11, 12, 15, 17, 22, 28, 44. Nothing else. Pair a number with its label at a 2x size ratio or more. Tabular numerals are on by default.

## 3. Layout recipes

- **Dashboard (Today):** large title with the date under it; one hero (`.hero`: 96px ring + 28px title + one-line verdict + chips); a 3-up unframed `StatStrip`; then grouped lists under `SectionHead` eyebrows. One hero per screen; everything below is list weight.
- **Detail (session sheet, journal day):** summary stat strip on top, then sections 32px apart. Splits/sets are a bar list: label left, bar proportional, number right.
- **Timeline (Morning):** 7-day strip on top (44px cells, today filled), a 48px left time axis with hour labels in Caption, blocks whose height is duration × 1px per minute (minimum 32px), 4px gap between blocks, free time left empty, a 2px accent "now" line with an 8px dot in the axis, past blocks sitting back (bar, border and halo faded, words at `--ink-3`, never text under 4.5:1).
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

One theme: black canvas `--bg`, `--surface` at a 7% lift, hairlines as translucent white. The electric blue `--accent` is for the one primary action, the active tab, the done state and links; `--halo` is the stage light behind a hero. Status: `--ok` blue, `--warn` amber, `--bad` red. Session tones `--t-easy/long/hard/fast/lift/cross/rest` via `.t-*` classes setting `--tone`, used only as dots and bars. Full reasoning and values in `docs/brand.md` §3.

## 6. Motion

Orb or mark: fill 160ms, then the check draws 160ms, the glow blooms 320ms, one haptic. The route line draws once over 1.1s on first appearance. Taps compress to 0.985 on a spring. Page change: CSS fade only. Nothing else moves without a tap. Respect `prefers-reduced-motion`.

## 7. Anti-patterns to never reintroduce

Four identical KPI boxes; a card inside a card; serif numerals; a permanent row of action buttons under a list item; 18px gutters stacked on 16px card padding; a grey sentence as an empty state; odd font sizes; a glow block behind the active tab icon.
