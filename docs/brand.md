# Logbook brand package, v2: Night

The one source for why Logbook looks the way it does. `docs/design-spec.md` stays in force for the 4pt grid, gutters, tap targets, grouped lists and the anti-patterns; this document decides colour, type, voice, shape, mark and motion, and every value here lands in `apps/web/src/styles/tokens.css`. When a screen and this document disagree, this document wins. Section 11 is the review checklist.

## Part 1. Reference study

v1 of this document studied WHOOP, Oura, Strava, Apple Fitness, Calm, Things, Flighty, Linear and Bear and landed on warm paper. The owner rejected it: the result read as generic. The reference that replaced it is **Share Aura: Track & Create** (Aura Movement Technology), seen in its App Store screenshots:

- **Ground.** True black, edge to edge. Not charcoal, not a dark grey card on a slightly darker grey: black.
- **Light.** One electric blue, used as a halo rising from the bottom of a screen or card, like a stage light under the content. It is never a fill behind text and never a button colour in the shots; the blue is atmosphere and the one dot of state (a blue check beside "6.0 miles").
- **Type.** Two voices. An italic editorial serif for the big words ("Share", "Copy", "Track", "Create", "Post") and a heavy, tight sans for numbers stamped onto photos ("6.04 MI", "8'06''", "49:02"). Labels above numbers are tiny caps with wide tracking ("DISTANCE", "PACE", "TIME", "ELEVATION").
- **The photo and the line.** A run is a photo of the run with the route drawn over it as a white line, and the stats stamped in the corner. Where there is no photo, the route line alone on black carries it.
- **Templates.** A grid of stat cards: highlighter-marker text, a chat bubble, a bold stamp, a map line. All share the black ground; the variety is in the type, never in the colour.
- **Voice.** Verbs. One word. Then a plain clause.

Secondary references still in force: Strava for the route line as signature; Apple Fitness for completion as the only celebration; Linear for greyscale-on-black with faint translucent-white borders; Things for one accent used with discipline.

## Part 2. The Logbook brand

### 1. Positioning

Logbook is one athlete's private night screen: the run drawn as a line, the morning as a timeline, the habits as lights, the two sentences at the end of the day. It borrows Aura's black-and-light stagecraft and Strava's route line, and keeps the paper logbook's honesty: what happened, in numbers, with nothing trying to win your attention.

**Promise:** Your day, lit.

### 2. Personality

**Is:** cinematic, exact, confident, warm underneath, honest.

**Never:** grey, cluttered, cute, corporate, gamified with coins or badges.

### 3. Colour system

Every colour has one job.

| Token | Value | Job |
| --- | --- | --- |
| `--bg` | `#000000` | The canvas. Always black. There is no light mode. |
| `--surface` | `#111111` | A card on the canvas. The lift is 7%, enough to read as an object. |
| `--surface-2` | `#1b1b1b` | A control resting on a card (segmented track, input, orb ring). |
| `--surface-3` | `#262626` | The selected segment, a meter track. |
| `--ink` / `-2` / `-3` / `-4` | white at 100 / 72 / 50 / 28% | Text and icons. Four steps, no fifth. |
| `--line` / `--line-strong` | white at 8 / 16% | Hairlines and outlines. Never a solid grey border. |
| `--accent` | `#2f3bff` | The electric blue. The one primary button, the active tab, the done state of a habit orb, the meter fill, links. |
| `--accent-bright` | `#5b66ff` | The glow edge: box-shadows, the orb ring when lit. |
| `--accent-text` | `#7a84ff` | The blue as a word: links, ghost and soft verbs, the done chip, text on the tint. Never a fill. Lighter than `--accent` so it reads at 4.5:1 on black and on a card. |
| `--halo` | radial blue, bottom-anchored | The stage light. Under the hero card on every tab, under a selected day, under a finished session in its sheet. It sits behind content, never behind body text. |
| `--ok` | `#2f3bff` | Done. A blue, not a green: on this canvas green reads as a traffic light. |
| `--warn` | `#ffb020` | Floor met, not the goal. Amber. Streaks are never a threat. |
| `--bad` | `#ff3b5c` | Missed, delete, sign out. Red only for loss. |
| `--t-easy` `#35d07f`, `--t-long` `#3b82ff`, `--t-hard` `#ff8a1f`, `--t-fast` `#ff3d8a`, `--t-lift` `#a26bff`, `--t-cross` `#d1a15c`, `--t-rest` `#7a7a7a` | Session families | A 6px dot, a 3px bar at a row's edge, the tint of a day's glow in Morning. Never text, never a fill larger than a bar. |

Rules: 90% of any screen is black, surface and ink. Blue is one thing per screen plus the halo. Status colours never decorate. Gradients exist only as the halo and the orb glow; no gradient ever sits behind text.

### 4. Type

Three faces, each with one job, all bundled in `public/fonts` so the app owns them offline.

| Face | Class | Job |
| --- | --- | --- |
| Instrument Serif, italic | `.display`, `.ph-title`, `.aura-title.display` | The big words: page titles (44/46), the name of a finished run, the day's word, a quote. Never below 22px, never for numbers. |
| Inter Tight 800 | `.stamp`, `.stat-val`, `.aura-num` | Stamped numerals: 44/44 in the hero, 28/32 in a strip, 22/24 in a stat row. Uppercase letters allowed only in a stamp ("EASY 6"). Tracking -0.03em. Units in a 12px `small` at 70% white. |
| Inter | body | Everything else. 17/22 body, 15/20 sub, 12/16 caption. |
| Caps labels | `.caps`, `.t-label` | 11/14 or 10/14, weight 600, tracking 0.12em, uppercase, `--ink-3`. Above every stamped number and on section heads. |

Scale: 10, 11, 12, 15, 17, 22, 28, 44. Nothing else.

### 5. Shape and depth

Cards: `--r-lg` 20px on black with a 6% white border, no shadow (the canvas is the shadow). Controls: 12px. Chips, orbs, pills: round. Sheets rise from the bottom with a 20px top radius and a black backdrop at 78%. Depth comes from the halo and from the 7% lift, never from drop shadows on the canvas.

### 6. The mark

The ring that is open at the top-right, with the check inside: the day, the record, and what is still open. White on black, with the blue halo rising behind it on the icon. The same mark lights up in the app as the habit orb.

### 7. Layout

- One hero per tab, always a black card with the halo: Today's session or route, Morning's timeline head, Plan's selected day, Trends' mileage chart, Journal's quote.
- Stat rows under a hero: four caps labels over four stamps, separated by a 12% white hairline above.
- Grouped lists as in the spec: hairlines inside one surface, 44px rows, 60px session rows.
- Habits are orbs in a row, not a list: 56px ring, initial in italic serif, lit blue when done, a thin meter beneath.
- The route line is white, 2.5px, with a soft white drop shadow, drawn in over 1.1s the first time it appears, then still.
- The tab bar is black with a 16% hairline; the active tab is blue with a 600 label.

### 8. Voice

Verbs, one word, on buttons: Add, Save, Done, Floor, Skip, Move, Edit, Delete, Undo, Shuffle, Connect, Open. Titles in the serif are a single word or a name ("Today", "Afternoon Run"). The verdict under a hero is one short sentence in plain words ("Out at 7:35, back by 8:30." "Floor held."). Never a vendor name, never a server, never an env var, never an exclamation mark.

### 9. Motion

1. Nothing moves on load except the page fade (200ms) and, once, the route line drawing itself.
2. Completion is the celebration: an orb fills (160ms) and its check draws (160ms, after the fill), the glow blooms (320ms ease-out), one haptic. Nothing else celebrates.
3. Taps compress to 0.985 with a spring (stiffness 400, damping 30). Sheets spring up (stiffness 300, damping 30). Numbers tick to their value (AnimatedNumber).
4. Nothing longer than 600ms except the one route draw (1.1s). No stagger lists. No ambient motion.
5. A held thing lifts: scale 1.03, surface-2, a line-strong hairline, no shadow. It follows the finger and springs back (stiffness 400, damping 30), within rules 1 and 4: nothing lifts on load, nothing lifts for long, and under reduced motion only the surface changes.

### 10. Tokens

All of the above is `apps/web/src/styles/tokens.css`. There is one theme. The appearance setting and `data-theme` are gone.

### 11. Review checklist

1. Black canvas, not grey. Surfaces at 7% lift. No drop shadows on the canvas.
2. One blue primary element per screen plus the halo. Nothing else is accent.
3. The halo sits behind a hero, never behind body text.
4. Session tones only as a 6px dot or a 3px bar. Never text, never a chip fill.
5. Status colours only for status: blue done, amber floor, red missed/delete.
6. Titles in the italic serif at 44. Numbers in the stamp with caps labels above. Body in Inter. Sizes only from the scale.
7. Every number has a unit or a label; units in small at 70%.
8. 44px tap targets; 16px gutters; 4pt grid; grouped lists with hairlines; no card-in-card.
9. Colour is never the only signal: a word or a check accompanies it.
10. Completion animates as in 9.2; nothing else moves without a tap; no stagger; no spinner, ever.
11. Empty states name the state and offer one verb.
12. Buttons are one verb. No vendor, server or env-var copy anywhere.
13. Every tab has one hero card with the halo and one thing to look at first.
14. Dark system chrome: status bar light-on-black, keyboard dark, safe areas respected.
15. It works at 320 and 390 with no horizontal overflow and no mid-word breaks.
