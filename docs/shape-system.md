# Shape system v2

How Logbook is built on the screen: shapes, structure, placement, borders, margins and containers. Measured from the
reference screens (docs/research/inspiration/, the Bevel shots) and kept to Logbook's own voice and identity
(docs/inspiration.md §0). Colour is in `docs/inspiration.md` §1; this file is everything else.

The one idea: every piece of content lives in a white, borderless, softly lifted card on a pale page. Cards line up on one
16 pt gutter with 12 pt between them. Sections are named by a plain sans header. Numbers are big and stamped; words are small
and grey. Nothing floats loose on the page except the page title, section headers and the dock.

What stays Logbook's: the serif italic page title and hero sentences, stamped numbers (Inter Tight), the halo of light from
under what matters, habits as lit orbs, small caps eyebrows (used sparingly, inside cards only), the voice.

---

## 1. Tokens

| Token | Value | Use |
|---|---|---|
| `--gutter` | 16px | Page side margin. Every card edge sits on it. |
| `--gap` | 12px | Between cards in a stack or grid. |
| `--section` | 28px | Above a section header. |
| `--sec-gap` | 12px | Section header to its first card. |
| `--pad-card` | 16px | Inside a card. 14px inside a tile. |
| `--r-card` | 22px | Cards, sheets' top corners (24px). |
| `--r-tile` | 18px | Tiles in a grid, inset groups. |
| `--r-chip` | 16px | Context chips (two-line pills). |
| `--r-control` | 12px | Inputs, segmented tracks, small tiles inside cards. |
| `--r-icon` | 10px | Icon tiles (32px). |
| `--r-pill` | 999px | Buttons, single-line chips, the dock. |
| `--shadow-1` | 0 1px 2px rgba(15,42,68,.04), 0 6px 20px rgba(15,42,68,.06) | Every card and tile. |
| `--shadow-float` | 0 2px 6px rgba(15,42,68,.06), 0 10px 28px rgba(15,42,68,.10) | Floating buttons, chips, the dock. |
| `--card-border` | 1px solid rgba(15,42,68,.04) | Barely there: the shadow defines the card, the hairline keeps it on white. |

No visible borders on cards, ever. A border is only for an input that has focus, a dashed "add" slot, or a selected choice.

## 2. Type roles

| Role | Style |
|---|---|
| Page title | Instrument Serif italic 34/40, ink. Logbook's signature; stays. |
| Section header | Instrument Serif 28/32, ink, sentence case ("Habits", "Plan your day", "This week"); 22/28 on list pages (Settings). Optional meta in sans 15/20 grey at the baseline, next to the title; an action ("History ›") at the right in `--accent-text` 15/20 600, 44 tall. Built once: `SectionHeader` and `PageSection` in `ui/layout.tsx` (see `docs/layout-review.md`). |
| Card title | Sans 600 17/22, ink. |
| Card label | Sans 500 15/20, `--ink-3`, often with a 16px icon before it ("♡ Resting HR"). |
| Big number | Inter Tight 700 28/32 (tiles) or 34/38 (hero), ink; the unit after it in sans 15 `--ink-3`. |
| Status word | Sans 600 15/20 with a 14px icon: navy "Normal", orange "Behind", grey "No data". |
| Body | Sans 400 15/20 or 17/22, `--ink-2`. |
| Footnote | Sans 400 13/18, `--ink-3` ("Updated 7:54 AM"). Under its card: 8 below, 16 in, where the card's words start (`Footnote`). |
| Eyebrow | Caps 600 11/13 tracking .06em, `--ink-3`, inside cards only, at most one per card. |
| Hero sentence | Instrument Serif italic 22/28. |

## 3. Containers

- Card (`.card`): white, `--r-card`, `--card-border`, `--shadow-1`, padding `--pad-card`. A card with an arrow (→) at its top
  right opens a detail. A card may hold sections split by a full-width hairline (`--line`), like a rings row over an insight.
- Tile (`.tile`, in `.tiles`): a 2-column grid, `--gap` between, each tile `--r-tile`, padding 14px: label row, big number with
  unit, status word; an optional slim vertical range pill at the right.
- Inset group (`.group`): white, `--r-tile`, `--shadow-1`, rows 56 tall (64 with a subtitle), 16px side padding, an icon tile
  (32px, `--r-icon`, Columbia wash or outlined) before the title, a chevron after. Separators start at the title, not the edge.
- Context chip (`.ctx-chip`): a two-line pill card, `--r-chip`, `--shadow-float`, white: a round tinted icon (28px) then
  title 15/20 600 over a footnote 13/18 grey, and a chevron when it opens something. Sits in a row under the page title.
- Action pill (`.pill-row`): a full-width white pill with centered 17/22 text, `--shadow-1`, 52 tall (secondary actions in
  Settings, "Clear cache").
- Empty slot: a dashed `--line-strong` outline, `--r-tile`, centered grey text and a "+". Only for "add here".

## 4. Controls

- Primary button: navy pill, 54 tall when full width, 44 inline, white 17/22 600 text. One per screen.
- Secondary button: white pill with `--shadow-1` (no border), ink text. Soft: `--columbia-wash` fill, ink-2 text.
- Small button: 36 tall pill.
- Round icon button (`.icon-btn`): 40px white circle, `--shadow-float`, 18px icon. Back, close, info, share, settings.
  Several together sit in one white capsule (the top-right capsule on a tab: share + avatar).
- Segmented control: `--surface-2` track, `--r-control`, the selected segment white with `--shadow-1`.
- Chips (filters): 36 tall pills, white with `--shadow-1`; selected navy with white text.
- Stepper: round 44px −/+ buttons around a big number (sheet entry).
- Inputs: 52 tall, `--r-control`, `--surface-2` fill, no border until focus (2px `--ink-2`).

## 5. Placement

- Page: `--gutter` on both sides; the title block, then context chips (12 below), then sections. Sections start
  `--section` apart; header to first card `--sec-gap`; cards `--gap` apart.
- Pushed page: round back button at the left, centered sans 17/22 600 title (and a grey subtitle such as the date), round
  action buttons at the right. No bar background until scrolled.
- Sheet: grabber, then a centered sans 17/22 600 title in `--ink-2` (optional eyebrow above it), a round close or back button
  left and an action (a red-tinted trash circle, a gear) right. Content in cards on the `--bg` sheet. The primary pill pinned
  at the bottom, 16px from the edges.
- The dock floats over everything (ask bar over the tab capsule).
- Lists of things over time (timeline, entries) are rows inside one card, not loose rows on the page.
- Grids: two columns at every phone width; a tile's content must fit 150px.

## 6. Screen recipes

- A tab: title block, context chips, a hero card (the one thing now), then sections of cards and tiles, then a timeline card.
- A metric or detail page: back and actions, centered title and date, a hero (big gauge or number), two stat tiles, an
  insight card, the chart card, the explainer card.
- A settings page: inset groups under small section headers, then action pills, then the version, centered.
- An entry sheet: title, a big stepper or field, rows for time and options in an inset group, the primary pill.

## 7. Do not
- Put text straight on the page that belongs in a card (except titles and headers).
- Use borders to separate cards, or stack two cards with no gap.
- Use more than one eyebrow per card, or caps for section headers.
- Mix radii: 22 for cards, 18 for tiles and groups, 12 for controls, pill for buttons.

## 8. Craft (depth, glass, the serif)

The shape system says where things go; craft says how they feel in the hand. Bevel's lesson is in its name: things are
bevelled. Built in `styles/craft.css` (global) and `features/health/` (the health pieces).

- Light from above. Every raised thing has a bright top edge (`--bevel-hi`) and a shadow that falls in layers
  (`--shadow-1`, `--shadow-float`). No flat white boxes.
- The one verb is a navy pill with light on its upper lip and a glow beneath (`--navy-pill`, `--navy-glow`). Secondary
  buttons are pearls (`--pearl`): white falling to the faintest Columbia, a hairline, a soft lift. Quiet buttons are words.
- Round buttons, floating chips and toasts are frosted glass (`--glass`, `--glass-blur`).
- Fields, segmented tracks and range capsules are pressed into the surface (`--well`, `--well-shadow`); a focused field
  lifts to white with a Columbia ring.
- Section headers and sheet titles are Instrument Serif (regular, 28 and 24); page titles and hero sentences stay serif
  italic. Card titles, rows and numbers stay sans and stamped.
- Health is drawn as instruments: the bevelled dial (raised rim, gradient arc with a soft glow, recessed face), the range
  capsule (your normal as a band, today as a ringed mark, dotted while learning), status words with their icon, last
  night on a night-navy card with the hypnogram and stage tiles, glass tiles, and illustrated heroes for first-time
  sheets. Gradients stay in the palette: strain orange, recovery Columbia to blue, sleep pale Columbia to navy.
- Motion is slow and small: heroes float a few pixels; arcs draw in once. Reduced motion turns both off.
