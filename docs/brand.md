# Logbook brand package

The one source for why Logbook looks the way it does. `docs/design-spec.md` stays in force for layout, type scale and components; this document decides colour, voice, shape, mark and motion, and every value here is meant to land in `apps/web/src/styles/tokens.css` (section 10). When a screen and this document disagree, this document wins.

## Part 1. Reference study

Method: web search plus fetch, October 2026. Most primary pages (Apple Newsroom, WHOOP's Locker, Instrument's Oura case study, MacStories, Blake Crosley's guides) did not resolve through our proxy, so these notes come from search summaries, WHOOP's brand PDF and third-party style references; secondhand values are flagged. This is evidence about patterns, not a hex audit.

- **Aura (sleep/wellness).** Not reachable beyond store listings and user reviews. What the listings show: a near-black ambient ground, soft gradient artwork per track, one line of large sans type and one action per screen. The lesson the owner is pointing at is the quiet: one thing to look at, the rest of the screen dark. Unverified beyond listings.
- **WHOOP.** The official guidelines give one teal (#00F19F) for actions and positive states, one blue (#0093E7) for Strain, and a green/yellow/red traffic light for Recovery; everything else is near-black and grey. The premium feel comes from a dark ground, white tabular numerals as the hero, and progressive disclosure (Bureau Oberhaeuser): complexity only when asked for.
- **Oura.** Instrument's redesign introduced one semantic colour system and a ring-and-bar visualization grammar; third-party style files disagree on the palette (black and gold vs cream and indigo), which says the app reads as restraint rather than as a colour. Readiness is the only thing on the home screen.
- **Strava.** One orange (#FC4C02 or #FC5200 depending on the source) on black-on-white; the orange is the route line, the button and nothing else. Lesson: a single signature colour owned so hard that competitors must avoid it.
- **Apple Fitness.** Three rings, three fixed colours (red Move, green Exercise, blue Stand) that never change meaning. Depth comes from the ring geometry, not from gradients. Completion is the whole brand moment.
- **Calm and Headspace.** Opposite answers to the same category: Calm owns deep blue and natural landscape; Headspace owns an orange (#F47D31 per a style study) plus rounded characters. Both prove a wellness brand can be a single hue plus a consistent tone of voice.
- **Things 3.** Cool off-white canvas, the system font untouched, one blue for interactive states and the icon's check, yellow only for Today, red only for deadlines. Reviewers can't agree on the blue's hex (#3A82F7 to #5c9cf5), which shows how much the discipline, not the value, carries the feeling.
- **Flighty.** Airport signage as the type model: big numerals, status by colour code, condensed into "15 smart states". Data density feels calm because every number has one job and one place.
- **Gentler Streak.** Apple's 2024 citation praises an "upbeat, encouraging tone" and progress "in relation to your history, not others." Later redesign cut tabs from four to three. Lesson: fewer destinations, kinder copy.
- **Streaks.** One card, six circles, seasonal themes that change hue but never layout. MacStories: ease of use is what won the ADA.
- **Bear and Craft.** Bear: custom sans, one coral-red accent for links and headings, Markdown hidden as you type. Craft: paper-like surfaces and generous radii. Both make writing feel like a material, which is what our journal needs.
- **Arc, Linear, Notion Calendar.** Linear: greyscale on dark, one indigo (#5e6ad2 / #7170ff) for interactive states, Inter at weight 510, borders as faint translucent white. Notion Calendar: white, faint 1px grid, soft event fills, a 5:1 jump between headline and body. Arc: chrome in a sidebar so content owns the screen.

**Common threads.** (1) One chromatic accent, used for interactive state and one signature element; two to three semantic colours (good/caution/bad) that never double as decoration. (2) Neutrals do the work: 80 to 90 percent of any screen is ground, surface and ink. (3) Dark mode is derived, not redesigned: same hues, lighter accent, surfaces lifted rather than outlined. (4) Numbers are the hero and are set in the UI sans with tabular figures; words are set smaller and quieter; serif, when it appears at all (Calm, Oura's editorial), is for reading, not for metrics. (5) Naming is plain nouns in sentence case: Today, Readiness, Strain, Inbox, Upcoming. (6) Completion is the only animation anyone remembers.

## Part 2. The Logbook brand

### 1. Positioning

Logbook is one athlete's private page for the day: the 5 a.m. run, the lift, the three habits and the evening's two sentences, in the order the day happens, with no feed, leaderboard or notification trying to win. It borrows the authority of a paper logbook (a record you keep because you respect the work) and the calm of the best consumer apps (one thing on the screen, in warm light). His day is loud, so the app is quiet.

**Promise:** One quiet page for the whole day.

### 2. Personality

**Is:** calm, exact, warm, disciplined, honest.

**Never:** loud, gamified, cute, corporate, clinical.

### 3. Colour system

**Base: warm paper.** The owner liked the dashboard's warmth and it is right for the product: a logbook is paper, not a dashboard. Light mode keeps the ground `#f5f3ee` and white surfaces. What changes is the ink: the current inks (`#15171a`, `#4e5259`) are blue-grey and fight the warm ground, so they move to warm near-blacks and greys and ink, paper and line become one material. Dark mode is the same paper at night, a warm near-black instead of a blue-black.

**Signature accent: trail green `#2d6a4f`.** One accent, chosen for three reasons. Product: green is the colour of "done" and "go" at the same time, and Logbook is about closing the day (done) and starting the next one (go); no other hue carries both. Context: the owner's category is owned by Strava orange, WHOOP teal and blue, Apple Fitness red; a deep forest green is empty territory and reads as outdoors at dawn, which is when he trains. Material: a deep, slightly grey green sits inside warm paper the way moss sits on stone; a bright mint would float on top of it. The current `#2f7a5a` is close but too bright to carry white text with authority; `#2d6a4f` gives 6.4:1 on white.

**Done is the accent.** `--ok` is set equal to `--accent`. A completed habit, a finished session and the active tab are one idea (this is done, this is where you are), so they are one colour. This removes the "two greens on one screen" problem the current palette has.

| Token | Light | Dark | Reason |
|---|---|---|---|
| `--bg` | `#f5f3ee` | `#111110` | Warm paper; night paper (not blue-black) |
| `--surface` | `#ffffff` | `#1a1a18` | A sheet laid on the paper; lifted one step in dark |
| `--surface-2` | `#ebe8e1` | `#242421` | Chips and inputs; second lift |
| `--ink` | `#1a1917` | `#efece6` | Primary text and numbers; warm, never pure black or white |
| `--ink-2` | `#56524b` | `#b5b1a9` | Secondary text, subheads |
| `--ink-3` | `#74706a` | `#87837b` | Captions, placeholders, eyebrows |
| `--line` | `rgba(26,25,23,.08)` | `rgba(239,236,230,.08)` | Hairline dividers derived from ink, so they warm with it |
| `--accent` | `#2d6a4f` | `#6cc29a` | Trail green; lighter at night so it glows rather than sinks |
| `--accent-soft` | `#dcebe2` | `#1d3a2d` | Accent tint for selected rows and "today" fills |
| `--ok` | `#2d6a4f` | `#6cc29a` | Same as accent: done and go are one colour |
| `--warn` | `#a37408` | `#e9a23b` | Floor met but not the goal; a dim amber, a lamp left on |
| `--bad` | `#d0304c` | `#e85a5a` | Missed; a crimson leaning cool so it separates from amber for colour-blind users |

**Session tones.** Seven categorical colours for the session type bar and calendar dot. They are a second class of colour, not accents: they never fill a button, never colour text, never appear larger than a 2px bar, 6px dot or 24px icon. Mnemonic: cool is distance, hot is effort, violet is iron.

| Tone | Light | Dark | Reason |
|---|---|---|---|
| easy | `#4f9a6b` | `#8fd0a6` | Breath and grass; a lighter cousin of the accent so an easy run looks like the default |
| long | `#3b7bd1` | `#6aa6ff` | Distance is depth and water |
| hard | `#d07a0a` | `#f0a93a` | Effort is heat |
| fast | `#c4306a` | `#f06a9a` | The red line of the track, pushed toward magenta so it is not mistaken for "missed" |
| lift | `#8a55cf` | `#b48cf5` | Iron: the one cool, heavy, indoor colour |
| cross | `#8d6b45` | `#c9a06e` | Terrain and leather: bike, swim, row, hike |
| rest | `#94908a` | `#6f6c66` | The absence of colour |

**Verification.** Checked with a script (WCAG 2.x relative luminance for contrast; Machado 2009 deuteranopia matrix at full severity, then CIE76 ΔE in Lab). Results: light mode ink on surface 17.6:1, ink-2 7.8:1, ink-3 4.9:1, accent 6.4:1, white on accent 6.4:1; dark mode ink 14.8:1, ink-2 8.2:1, ink-3 4.6:1, accent 8.2:1. All seven tones are at or above 3:1 on their surface in both modes (lowest: rest 3.2:1 light). Deuteranopia ΔE for the status trio: light ok/warn 51, ok/bad 26, warn/bad 26; dark 52, 27, 30 (ΔE above roughly 20 is a visible step). The trio also differs in lightness in each mode. Two tone pairs remain close under deuteranopia (long/lift, and easy/fast in light), which is inherent to seven hues, so a tone is never the only carrier: every session row shows its type in words and the calendar lists the day's sessions by name under the dots. One constraint on the inks: `--ink-3` on `--surface-2` is 4.0:1, so captions on chips use `--ink-2`.

**Accent rules.** The accent may appear as: the active tab icon and label; the one primary button on a screen; the "today" marker (filled pill in the calendar strip, the now-line in the timeline); a completed mark and its chip; the ring fill. It must not appear as decoration (no accent eyebrows, borders, gradients or backgrounds behind sections), never as body or caption text colour, never on two competing elements at once (if a primary button is on screen, nothing else is accent except state that is already there). Session tones are not accents and do not count against this, but an accent and a tone never sit on the same element.

### 4. Typography

One sans for every word of interface and every number: SF Pro on iOS through `-apple-system`, Inter elsewhere, tabular numerals on. Numbers are set heavier and larger than their labels (the spec's 2.3x rule) because the number is the fact and the label is its caption; a 56px distance, a 28px pace and a 12px uppercase eyebrow is the whole typographic brand.

Fraunces, the serif, is the voice of reflection. It appears in exactly three places: the daily quote, the journal body and the coach's read. Reason: data has one voice (the sans, exact, upright) and the athlete's own thinking has another (the serif, warm, with a slight irregularity that reads as handwriting without pretending to be). Never on a metric, never on a button, never in a title. Scale, weights and leading are exactly the spec's table; no new sizes.

### 5. Shape and surface

Radii: 12px for cards, groups and sheets; 8px for chips, tiles and inputs; pill for buttons, segmented controls and the today marker. Nothing else. Corners are the same at every size so a chip looks like a small group, not a different species.

Dividers are 1px `--line`, full width inside a group, never inset from the left. No card inside a card; inner structure is a hairline or 8px of air. Shadows exist only in light mode (`--shadow-1` for cards that lift, `--shadow-2` for sheets) and are warm-tinted from ink, never grey-blue. Dark mode is derived, never redesigned: same hues, surfaces lifted in two steps (`#111110` → `#1a1a18` → `#242421`), card borders transparent, shadows off except under sheets. If a dark screen needs a border to read, the surface step is wrong, not the border.

### 6. The mark

Current: a tilted page with a green check on a green radial. The tilt and the radial are the two things that make it look generated. The final mark keeps the meaning (the day, closed) and removes everything else.

**App icon (1024 grid, iOS masks the corners).** Background: flat trail green `#2d6a4f`, edge to edge, no gradient, no texture. Ring: a circle centred at (512,512), radius 300, stroke 88, round caps, colour paper `#f5f3ee`, drawn as an arc that starts at 12 o'clock and runs clockwise for 300 degrees, leaving a 60-degree gap at the top-right (between 12 and 2 o'clock). Check: a polyline from (380,520) to (482,622) to (662,420), stroke 88, round caps and joins, same paper colour. Meaning: the ring is the day; the check is the record; the gap is what is still open, which is why you open the app. Reads at 29px as a check in a ring, the most legible glyph in the category (Apple's rings, Things' check). Dark/tinted variant: background `#111110`, marks `#6cc29a`.

**In-app mark.** The same geometry at 24px with a 2px stroke (ring radius 9, check 7.5/10, 10/12.5, 15.5/7) in `--ink`, or `--accent` where it marks completion. It is also the empty-state glyph and the splash. No wordmark; "Logbook" is set in the sans at Title weight wherever the name appears.

### 7. Iconography

Lucide line icons only, 2px stroke, round caps and joins, 24px in the tab bar and 20px inline, coloured with `--ink-2` at rest. Active tab: the same icon filled (lucide's filled variants, or the outline with `fill: currentColor` at 100 percent) in `--accent`, label in `--accent` at 10px 600. No glow, no pill behind the icon. Icons never appear as decoration beside a title. No emoji anywhere: not in copy, not in habit names by default, not in toasts.

### 8. Voice and copy

Sentence case everywhere, including tab labels, eyebrows (uppercase is applied by CSS, written as sentence case) and buttons. Buttons are one short verb: Add, Done, Move, Skip, Save, Undo. Titles are plain nouns: Today, Plan, Morning, Journal, Trends.

The floor is spoken as a promise to yourself, not a penalty. "Floor: 20 min easy" names the minimum; when the floor is met but the goal is not, the chip says "Floor" in amber and the verdict says "Floor held", never "Only 20 minutes". When nothing is done the chip says "Missed", once, without comment.

Empty states name the state and offer one action: "No sessions this week. Add one." "Nothing written today. Write two lines." They keep the section's height and never apologise.

The coach's read is two to three sentences, present tense, in the serif, about this athlete's history ("Third week of rising long-run volume; sleep is flat"). It never compares him to anyone else.

Never: exclamation marks, "awesome", "crushed it", "oops", "something went wrong", "you've got this", streak counts as a threat, any sentence that begins "Don't forget".

### 9. Motion

1. Nothing moves without a cause the athlete made (a tap, a pull, a page change). No ambient animation, no attention loops.
2. Completion is the only celebration: mark fills 160ms, check draws 160ms, haptic once. Nothing confettis.
3. Durations: 160ms for state changes, 220ms for reveals and sheets, 600ms for a ring fill on appear. Nothing longer.
4. Springs for things you touch (press scale 0.98, sheet drag), ease-out (`--ease-out`) for things that reveal (fades, fills).
5. `prefers-reduced-motion` turns every animation into an instant state change, including the ring.

### 10. Tokens to change

Apply to `apps/web/src/styles/tokens.css`. Both dark blocks (`prefers-color-scheme` and `[data-theme='dark']`) take the same dark values. Unlisted tokens are unchanged.

| Token | Light old → new | Dark old → new |
|---|---|---|
| `--bg` | unchanged | `#0d0f11` → `#111110` |
| `--surface` | unchanged | `#17191c` → `#1a1a18` |
| `--surface-2` | unchanged | `#212428` → `#242421` |
| `--surface-3` | unchanged | `#2c3035` → `#2f2e2a` |
| `--ink` | `#15171a` → `#1a1917` | `#f0efea` → `#efece6` |
| `--ink-2` | `#4e5259` → `#56524b` | `#b3b6bb` → `#b5b1a9` |
| `--ink-3` | `#80858d` → `#74706a` | `#7f848b` → `#87837b` |
| `--ink-4` | `#b3b7bd` → `#b5b1a9` | `#4e535a` → `#55524c` |
| `--line` | `rgba(21,23,26,.07)` → `rgba(26,25,23,.08)` | `rgba(240,239,234,.07)` → `rgba(239,236,230,.08)` |
| `--line-strong` | `rgba(21,23,26,.14)` → `rgba(26,25,23,.14)` | `rgba(240,239,234,.14)` → `rgba(239,236,230,.14)` |
| `--accent` | `#2f7a5a` → `#2d6a4f` | `#5fcf96` → `#6cc29a` |
| `--accent-soft` | `#dcefe4` → `#dcebe2` | `#1d3b2c` → `#1d3a2d` |
| `--accent-tint` | `rgba(47,122,90,.1)` → `rgba(45,106,79,.1)` | `rgba(95,207,150,.12)` → `rgba(108,194,154,.12)` |
| `--ok` | `#2f9e6a` → `#2d6a4f` | `#4fc98a` → `#6cc29a` |
| `--ok-soft` | `#dff3e8` → `#dcebe2` | `#173327` → `#1d3a2d` |
| `--warn` | `#d4870d` → `#a37408` | `#f0a93a` → `#e9a23b` |
| `--warn-soft` | `#fbedd0` → `#f6e7c6` | `#3a2d14` → `#3a2e14` |
| `--bad` | `#d64b3a` → `#d0304c` | `#f0675a` → `#e85a5a` |
| `--bad-soft` | `#fbe1dc` → `#f8dde1` | `#3d1f1b` → `#3b1d1d` |
| `--star` | `#e3a71a` → `#a37408` | `#f0b63a` → `#e9a23b` |
| `--t-easy` | `#2f9e6a` → `#4f9a6b` | `#4fc98a` → `#8fd0a6` |
| `--t-long` | `#2d7be0` → `#3b7bd1` | unchanged |
| `--t-hard` | `#e08a16` → `#d07a0a` | unchanged |
| `--t-fast` | `#e0415f` → `#c4306a` | `#f26d86` → `#f06a9a` |
| `--t-lift` | `#8a4fd6` → `#8a55cf` | `#b28cf5` → `#b48cf5` |
| `--t-cross` | `#8f6a3f` → `#8d6b45` | unchanged |
| `--t-rest` | `#9a9ea6` → `#94908a` | `#6b7078` → `#6f6c66` |
| `--shadow-1` | rgba base `21,23,26` → `26,25,23` (same alphas) | unchanged (`none`) |
| `--shadow-2` | rgba base `21,23,26` → `26,25,23` | unchanged |
| `--shadow-sheet` | rgba base `21,23,26` → `26,25,23` | unchanged |
| `--card-border` | `rgba(21,23,26,.06)` → `rgba(26,25,23,.06)` | unchanged (transparent) |
| `--glass` | unchanged | `rgba(13,15,17,.86)` → `rgba(17,17,16,.86)` |
| `--dur-fast` | `120ms` → `160ms` | same |
| `--dur-ring` (new) | `600ms` | same |

`--star` collapses into the warn amber so the app has one amber. The `.t-*` classes and `--tone` mechanism are unchanged.

### 11. Review checklist

1. Is there exactly one accent-coloured element competing for attention (plus existing state such as the active tab)?
2. Is every number in the sans with tabular figures, and is its label at most 1/2.3 of its size?
3. Is Fraunces present only in the quote, the journal or the coach's read?
4. Is the eyebrow 12px, 600, uppercase, `--ink-3`?
5. Is any text set in accent, warn, bad or a tone colour other than a chip or a stat that is itself the status?
6. Does any card sit inside a card, or any bordered surface inside another?
7. Are all radii 12, 8 or pill?
8. In dark mode, are there borders where a surface step should be?
9. Does every status chip carry a word, so colour is never the only signal?
10. Is the session type written out wherever its tone dot or bar appears?
11. Does every empty state name the state and offer one verb?
12. Is every button label a single verb in sentence case?
13. Any exclamation marks, emoji, "awesome", "oops" or a comparison to other people?
14. Does anything animate without a tap, and does completion animate exactly once?
15. Caption text (`--ink-3`) on `--surface-2`? Swap to `--ink-2`.
