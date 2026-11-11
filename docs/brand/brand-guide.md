# Orby brand guide

**Direction:** Sunrise optimism. **Version:** 1.2, November 11, 2026 (layout and hierarchy, changes listed at the top of `docs/brand/layout-and-hierarchy.md`). **Status:** the source of truth for every visible part of Orby.

This guide is for builders, people and AI agents, who change the app. Every rule is meant to be checked: a hex value, a size, a radius, a duration, or a do and don't pair. When this guide and the code disagree, the guide wins and the code gets fixed. When this guide is silent, ask before inventing.

**Files next to this guide**

| What | Where |
|---|---|
| Layout and hierarchy: spacing uses, emphasis order per screen, containers, layout components, per-screen checks | `docs/brand/layout-and-hierarchy.md` |
| Tokens, machine readable | `docs/brand/tokens.json` |
| Tokens as CSS, named to merge into `apps/web/src/styles/tokens.css` | `docs/brand/tokens.css` |
| Mark, wordmark, lockups, app icon (SVG and PNG) | `docs/brand/assets/` |
| Sheets: palette, type, icons, Orb states, logo construction, misuse, Home Screen icon | `docs/brand/assets/*.png` |
| Marketing heroes | `docs/brand/assets/hero-poster.png` (645 x 1398 pt), `hero-landscape.png` (1600 x 900 pt) |
| Fonts and their licenses | `docs/brand/fonts/` |
| Generators: the Orb recipe, the icon set, the wordmark outliner; the runtime audit | `docs/brand/tools/orb.mjs`, `icons.mjs`, `wordmark.mjs`; `docs/brand/tools/audit.mjs` |
| The deck (PowerPoint) and its reference rendering | `docs/brand/Orby Brand Guide.pptx`, `Orby Brand Guide.pdf` (the PDF is the reference: the deck names Inter and Inter Tight, which may not be installed) |
| The brand agent | `.claude/agents/brand-guardian.md` (section 13.1) |
| Applied mockups (live app, new tokens injected) and the override sheet that maps old classes to new values | `docs/brand/mockups/*.png`, `docs/brand/mockups/override.css` |

**What this guide replaces.** `docs/brand.md` (v2 Night), `docs/inspiration.md` (v3 Columbia) and the "Bevel craft" depth layer in `docs/shape-system.md` section 8 and `styles/craft.css`. The motion contracts in `docs/feel.md` and the haptics table stay, with the additions in section 9. Shape-system spacing rules stay unless section 5 says otherwise.

**The reference.** The feel was inspired by AREA's brand exploration at https://www.area.tech/openai. Orby borrows a mood (sky-blue optimism, the circle, mid-century poise), nothing else. Never use another company's name, mark, wordmark, monogram or artwork in Orby's system, app or marketing.

---

## 1. The idea

### 1.1 One good day at a time

Every day in Orby starts like a sunrise on a mid-century travel poster: a clear sky-blue morning, warm light coming up from the horizon, and one bright sphere rising. The Orb is that sun. The sky is the app. Sunrise orange is the small warm spot of light that says "this is now".

### 1.2 Why mid-century futurist

The 1950s and 1960s believed the future would be good, and drew it that way: Eames plywood and primary dots, Expo 67 and Expo 70 posters, airline travel posters printed flat on uncoated stock, observatory domes, the Space Age circle. That optimism is the right voice for an app about getting a little better every day. It is warm and human, not chrome and engineered; friendly paper, not a control room.

### 1.3 The governing image

A sphere rising over a horizon, lit warm from below. Everything follows from it:

- **The sky** is the ground: Cloud and Haze, a dawn wash at the top of every tab.
- **The sphere** is the Orb, the mark and the assistant's face: glossy, sky blue, with a sunrise underlight.
- **The sun's light** is Sunrise orange and Apricot: a now-mark, a glow, never a wall of color.
- **The horizon** is the poster: flat hills in three blues, concentric rings, paper grain, for brand surfaces only.

### 1.4 Three brand words

| Word | Means | In practice |
|---|---|---|
| **Optimistic** | It assumes today can go well. | Sky leads, light comes from below, copy is warm and short. |
| **Clear** | One thing at a time, plainly. | Paper cards on Cloud, one hero per screen, one orange job per mark. |
| **Crafted** | Made with care, like a good poster. | A soft serif with real construction, exact tokens, nothing ad hoc. |

---

## 2. Logo

The logo has two parts: the **Orb** (the mark) and the **wordmark** "Orby". The name and the mark are one idea: Orby is the orb.

### 2.1 The Orb, the mark

A glossy sky-blue sphere lit by a sunrise from below. It reads blue first. The top highlight stays cool white. A soft Apricot underlight sits on the lower hemisphere, as if the sun is just under the horizon. Subtle: it is light on a blue sphere, never a two-tone ball.

Sheet: `assets/orb-states.png`. Files: `assets/logo-mark.svg` (and `-1024.png`), `logo-mark-glow.svg`, `logo-mark-thinking.svg`, `logo-mark-flat.svg`, `logo-mark-mono-ink.svg`. Generator: `tools/orb.mjs`.

**Recipe** (100-unit box, sphere radius 48 at 50, 50). Every value below is final: apply it as written. `tools/orb.mjs` exports the same numbers as `ORB`.

| Layer | Spec |
|---|---|
| Body | Radial gradient, center 50% / 36%, focus 50% / 26%, radius 64%: `#FFFFFF` 0, `#E4F6FE` 12%, `#97D8F9` 34%, `#38B6F2` 60%, `#1590D2` 84%, `#0A68A0` 100%. |
| Sky bounce | Radial, center 50% / 104%, radius 58%: `#D6F1FE` at 95% alpha (offset 0), `#9ADBFA` at 45% (offset 50%), `#7FD0F7` at 0 (offset 100%). Keeps the lower half light blue, never grey. |
| Sunrise underlight | Radial at (50, 99), radius 32 (36 thinking), stretched 1.9 x wide about its center. Stops: `#FFE3CB` at opacity 0.78 (offset 0), `#FFC9A2` 0.61 (offset 0.34), `#DDF3FE` 0.43 (offset 0.68), `#9EDCFA` 0 (offset 1). Thinking: 0.85, 0.66, 0.46. These are the final opacities. |
| Sunrise glow (inner) | The warm light along the bottom: the sphere (clipped to radius 47.2, inside the edge) masked by a copy moved up 5.5 units (7.5 thinking), filled with a radial at (50, 98), radius 44 (48 thinking): `#FFD9B8` to `#FFB680` at 85% (thinking `#FFC596` to `#FFA868`), blurred 2.5 units, opacity 0.6 (0.72 thinking). It reads as a glow, never as a crescent or a band. |
| Specular | Ellipse at (50, 22), 27 x 15 radii, a radial from white at 70% (center) through 42% (45%) to 0, blurred 2.5 units. Soft, never a hard-edged highlight. |
| Edge | 0.8-unit stroke at radius 47.6 all the way round, `#0A5E92` at 35% on top, 30% at 75% down, 25% at the bottom. It holds the silhouette on Paper and Cloud. |
| Glow | 48 px and up only. Apricot ellipse under the sphere at (50, 77), 56 x 32 radii, `#FFB680` 50% to 0. Thinking: 64 x 38, 62%. On dark grounds: 22% (25% thinking), `mix-blend-mode: screen`. |

**Rendering in the app.** Do not repaint the recipe on a canvas: iOS WebKit does not reliably support `CanvasRenderingContext2D.filter`, and the blurs matter. Render `assets/logo-mark.svg` (idle) and `logo-mark-thinking.svg` (gradients, masks and `feGaussianBlur` work in WebKit) as inline SVG or an `<img>`, and animate the breath (scale) and the orbit (rotate the arc group) with CSS transforms. `ui/orbPaint.ts` keeps only the shared loop and the state switch.

**States**

| State | What changes | Where |
|---|---|---|
| Idle | Breath: scale 1 to 1.015 and back, 4 s loop. 48 px and up only. | Assistant empty state, splash after the rise. |
| Thinking | The underlight warms (the values above), the glow widens, a 1.8-unit `--orb-arc` `#FF9F5A` arc (about 14% of the circle) orbits a faint Sky ring at 116% diameter, one turn per 1.2 s, on a 4-unit Paper keyline. The arc and ring are decorative (2.0:1 and 1.3:1 on Paper): the status line ("Reading your week") is the accessible signal, and it is required. The arc is Orb light, not a Sunrise mark: it does not count toward the orange budget. | While the assistant works. |
| Still | One frame. | Every Orb under 48 px (the ask bar, the fold button), Reduce Motion, static art. |

**Size tiers** (checkable by measuring the rendered diameter; tokens `--orb-full-min`, `--orb-gloss-min`, `--orb-flat-max`):

| Diameter | Render |
|---|---|
| 48 px and up | Full Orb with the Apricot glow. May breathe. |
| 28 to 47 px | Gloss, no glow, still. The thinking arc is fixed at 6 px out with a 1.5 px Paper keyline. The ask bar (28 px) and the Orb inside the 48 px fold button (28 px, `--orb-fold`) are this tier. |
| Under 28 px (27 and under) | Flat Sky `#38B6F2` disc. No gloss, no glow. |

**On dark grounds** (Twilight, Night Ink) the sphere is unchanged and the glow drops to 22% with a screen blend (at 50% Apricot turns grey-brown on navy). **In one color** (print, embossing, a single-ink job) the mark is a flat disc in Sky, Night Ink or Paper.

| Do | Don't |
|---|---|
| One Orb per screen, the assistant's. | Two Orbs on one screen, or an Orb as a habit coin, a bullet or a decoration. |
| Blue first, warm light at the bottom only, soft. | Orange in the body, a half-orange ball, a hard peach band. |
| Use the 28 px gloss in the ask bar. | A glossy Orb at 22 px (it turns to mush). |
| Flat disc under 28 px. | Shrinking the gloss art below 28 px. |

### 2.2 The wordmark

"Orby" set in **Fraunces 700**, axes **SOFT 100, WONK 0, opsz 144**, then converted to outlines. Files: `assets/wordmark-ink.svg` (Night Ink, for light grounds) and `wordmark-paper.svg` (Paper, for dark grounds), each with a PNG. Sheet: `assets/logo-construction.png`. Generator: `tools/wordmark.mjs` (opentype.js, from `fonts/Fraunces-Wordmark-700-S100-o144.ttf`, a static instance of the OFL Fraunces variable font).

**Construction** (font units, UPM 2000; C = cap height = 1400):

| Item | Value |
|---|---|
| Face | Fraunces 700, SOFT 100 (rounded, poster-like wedge serifs), WONK 0 (no leaning n, m, h), opsz 144. |
| Tracking | -20 units (-0.01 em). |
| Pair kerning | O/r -24 (-12 per 1000), r/b +60 (+30), b/y +14 (+7). The r's ball terminal clears the b's stem by 140 units (2.2 pt at the 64 pt minimum). |
| The O | Its outer contour is redrawn as a **true circle 1441 units across** (cap height plus 21 units of overshoot top and bottom), so the letter's silhouette is the Orb's silhouette. The counter is a **lightly tilted ellipse**, 390 x 548 units (semi-axes), its long axis 10 degrees off vertical, centered in the circle: the O's thickest stroke is 331 units (1.05 x the b stem, 314) and its thinnest 172, so the O is no darker than the rest of the word and keeps Fraunces' stress angle. Side bearings 16 and 44. |
| Metrics | Cap 1400, x-height 890, b ascender 1497, y descender 491. |
| Ink box | 4393 x 1988 units. |
| Color | Night Ink `#0E2236` on light grounds, Paper `#FFFDF8` on dark. Nothing else. |

Why this O: with four letters, the O carries the name. It echoes the Orb in shape, never replaces it with a picture. The letter stays a letter.

| Do | Don't |
|---|---|
| Use the outlined SVG. | Type "Orby" in live text as the logo. |
| Night Ink or Paper only. | Sky, orange, Dusk or a gradient wordmark. |
| The true-circle O as drawn. | Swapping the O for the Orb or any picture. |

### 2.3 Lockups

| Lockup | Construction | File |
|---|---|---|
| Mark alone | The Orb. Use when the name is already present (the ask bar, the assistant, a favicon). | `logo-mark.svg` |
| Horizontal | The Orb at x-height: 900 units across (890 plus 10 overshoot), sitting on the baseline, a small sun beside the name rather than a second O. Gap from the Orb to the O: 0.35 C (490). | `lockup-horizontal-ink.svg`, `-paper.svg` (PNG each); one-color: `lockup-horizontal-flat-ink.svg`, `-mono-ink.svg`, `-mono-paper.svg` |
| Stacked | Orb 2 C across (2800), centered on the wordmark's ink width, its bottom 0.5 C above the b ascender. | `lockup-stacked-ink.svg`, `-paper.svg` (PNG each) |

Use the horizontal lockup in headers (the welcome screen, the site). Where the art already has its own Orb (a hero render, a screen with the ask bar), use the wordmark alone, so one frame never shows two Orbs side by side. Use the stacked lockup on store art and anything taller than wide.

### 2.4 Clear space and minimum sizes

- **Clear space:** C (the cap height) on every side of any lockup or the wordmark. Nothing enters it: no text, no edge, no other mark.
- **Minimum sizes on screen (width):** horizontal 96 pt, stacked 56 pt, wordmark 64 pt, gloss Orb 28 pt, flat Orb 16 pt.
- **Minimum in print:** horizontal 25 mm, stacked 15 mm, wordmark 17 mm. Below these, use the flat Orb alone.
- **In the app header** (welcome screen): the horizontal lockup at 24 pt cap height: wordmark box 34 pt tall, the Orb 15.4 pt (x-height; under 28 px, so use `lockup-horizontal-flat-ink.svg`, where the Orb is the flat Sky disc), gap 8.4 pt (0.35 C). No separate header variant: any lockup whose Orb renders under 28 px uses the flat file.

### 2.5 The app icon

Files: `assets/app-icon-1024.png` (light), `app-icon-dark-1024.png`, `app-icon-tinted-1024.png`, each with its `-source.svg`. Sheet: `assets/app-icon-homescreen.png`.

| Rule | Value |
|---|---|
| Canvas | 1024 x 1024 px, square, opaque, no rounded corners (iOS applies the mask), no text. |
| Sky | Linear top to bottom: `#CFEBFA` 0, `#E2F3FC` 42%, `#F6E7D3` 60%, `#FFC79C` 72%. Pale, so the Sky Orb separates. |
| Glow | Apricot ellipse at (512, 700), 600 x 300, 85% to 0: the horizon carries the warmth. |
| Rings | Two circles around the Orb at radii 310 and 370, 8 px white at 85% and 65%. They still read at 58 px. |
| Orb | The Orb, 500 px across (49% of the canvas), centered at (512, 420). Its bottom (670) clears the near hill's crest (724 at the center) by 54 px, 0.1 D (8.3), so the sunrise light on its lower half always shows. |
| Hills | Near hill `#4FA9DB` from y 760, far hill `#0A6CA6` from y 862, gentle curves. |
| Grain | Fractal noise (baseFrequency 0.85, 2 octaves), warm brown, multiply at 22%. |
| Dark variant | Sky `#0E2236` 0, `#163A5C` 45%, `#2A4E70` 70% to the bottom; an Apricot glow ellipse at the horizon, 32% with a screen blend; hills Twilight and Night Ink; rings Haze at 22% and 16%. |
| Tinted variant | Greyscale source, no rings, no grain; iOS tints it. |
| Display name | **Orby** (`CFBundleDisplayName`). |
| Check | Render at 120, 87, 58 and 40 px: at 58 px the Orb, its warm lower half and both rings must read. |

### 2.6 The name

The product is **Orby**. The Orb is the mark, so the name and the mark are one idea.

| Rule | Right | Wrong |
|---|---|---|
| Always a capital O, the rest lowercase. | Orby | orby, ORBY in running text |
| Caps only inside the letterspaced caption style. | ORBY FOR IPHONE (caption) | "Welcome to ORBY" |
| No article, no "app". | "Orby plans your week." | "the Orby", "Orby app", "the Orby app" |
| Possessive with 's. | Orby's plan view | Orbys', Orby' |
| The assistant is "the assistant" in copy. | "Ask the assistant." | "Ask Orby", "Orby says" |

**What does not change.** Internal identifiers keep the old name: the repository (`LogBook`), package names (`@logbook/*`), the bundle id `com.joshbean.logbook`, storage keys, database names, code names, the `Info.plist` key `LogbookAPIHost`, and file names such as `LogbookViewController.swift`. Never rename these as part of a brand change; renaming them breaks installs and sync. Everything a person can see says Orby: the Home Screen label, `index.html` title and `apple-mobile-web-app-title`, `capacitor.config.ts` `appName`, the web manifest `name` and `short_name`, permission prompts in `Info.plist` (for example the Apple Health usage string), the splash, onboarding, Settings, the assistant's disclaimers, emails and share cards.

### 2.7 What never to do

Sheet: `assets/logo-donts.png`. Never: stretch or squash; retype the name in another face; swap the O for the Orb; set the name in caps; recolor the Orb; make a two-tone ball; show two Orbs on one screen; put the logo on a busy or clashing ground; give the Orb a face; add drop shadows or bevels; grey or tint the wordmark; change the spacing; rotate or tilt; say "the Orby" or "Orby app"; box the logo or add rules around it.

---

## 3. Color

Sheet: `assets/palette.png`. All ratios are WCAG 2.x relative luminance contrast. Body text needs 4.5:1; large text (24 px regular or 18.66 px bold and up) and non-text graphics need 3:1.

### 3.1 The palette

| Name | Hex | Token | Role |
|---|---|---|---|
| Sky | `#38B6F2` | `--sky`, `--accent`, `--primary` | The signature fill: the Orb, selected day, active tab disc, primary button, selected segment, lit habit coin. A fill and a mark, never text on light grounds. |
| Deep Sky | `#0A6CA6` | `--deep-sky`, `--accent-text` | Blue words and links, the gauge fill, done dots, the far hill. |
| Haze | `#CBE8F8` | `--haze`, `--surface-3` | Tracks, icon tiles, the top of the dawn wash, chart tints. |
| Cloud | `#EAF5FC` | `--cloud`, `--bg` | The app ground, segmented tracks. |
| Paper | `#FFFDF8` | `--paper`, `--surface` | Cards, sheets, the ask bar, the tab capsule. A barely warm white. |
| Linen | `#F6F0E5` | `--linen` | Brand paper only (splash variant, store art, share cards, decks). Never app chrome. |
| Night Ink | `#0E2236` | `--night-ink`, `--ink` | All primary text, the wordmark. |
| Dusk | `#46596D` | `--dusk`, `--ink-2/3/4` | Muted text, captions, metadata. The lightest neutral text color (Deep Sky and Ember are lighter, and allowed as colored text). |
| Twilight | `#1B4870` | `--twilight` | Dark brand ground (night splash, dark icon, deck section slides). |
| Sunrise | `#F2600C` | `--sunrise`, `--now` | The accent and the now-mark. Kept from today's brand; it moves from lead to accent. |
| Apricot | `#FFB680` | `--apricot`, `--sun` | Light, not ink: the Orb's underlight, the hero glow, the horizon. |
| Ember | `#B4430C` | `--ember`, `--now-text` | Orange words, rare: a Today tag, a streak label. |

Support colors (refinements, each added for a contrast or role need):

| Name | Hex | Why it exists |
|---|---|---|
| Graphite | `#33475B` | Dusk under Increase Contrast (9.42 on Paper). |
| Deep Sky IC | `#085A8C` | Deep Sky under Increase Contrast (7.24 on Paper) and for body text on Haze (5.76), where Deep Sky is 4.43. |
| Pencil | `#7A8794` | Non-text marks (ticks, faint dots): 3.61 on Paper, 2.87 on Haze (never a meaningful mark on Haze). Never text. IC step `#5F6D7B` (5.22 on Paper, 4.15 on Haze): use it for the rest glyph in a Haze session tile. |
| Marigold / Warn text | `#E0A21B` / `#7A5A00` | Warning mark and its words (6.28 on Paper). The Marigold mark is 2.21 on Paper, so a warning always pairs it with a glyph and words. |
| Signal | `#B42340` | Errors and destructive words (6.35 on Paper). |
| Data tones | Lagoon `#117A74`, Deep Sky `#0A6CA6`, Plum `#7E3F8F`, Rose `#B23A5B`, Indigo `#4A4FB0`, Ochre `#7D6210`, Pencil `#7A8794` | Session kinds (easy, long, hard, fast, lift, cross, rest). Glyphs, lines and 3 px markers only; never a surface or a tinted card. Each is 5.0:1 or better on Paper except Pencil (marks only). Hard moved off orange so orange keeps one meaning. |
| Brand art | Poster sky `#8DD0F5`, `#AEDDF8`, `#CFEBFA`; horizon `#F4E6D2`, `#FFD2AE`; hills `#8FCDEE`, `#4FA9DB`, `#0A6CA6` | Posters, heroes, the icon. Not app chrome. |
| App washes | `--wash-bar` `#D0EAF8`, `--wash-strip` `#DAEEFA`, `--wash-strip-end` `#E2F2FB`, `--welcome-warm` `#FFF1E4`, `--entry-2` `#7FCBF3`, `--orb-arc` `#FF9F5A` | Sticky bars and strip, the welcome and splash grounds, journal two-entry disc, the thinking arc. Tokens only. |

### 3.2 Allowed text pairings

Only these. A pairing not in this table is not allowed.

| Text | On | Ratio | Use |
|---|---|---|---|
| Night Ink | Paper | 15.88 | Body |
| Night Ink | Cloud | 14.58 | Body |
| Night Ink | Linen | 14.23 | Body |
| Night Ink | Haze | 12.64 | Body |
| Night Ink | Apricot | 9.42 | Body |
| Night Ink | Sky | 7.03 | Body: primary button label, selected day numeral, selected segment, active tab glyph |
| Night Ink | Sunrise | 4.96 | Body, bold 13 px and up only: the stamp |
| Dusk | Paper | 7.10 | Body |
| Dusk | Cloud | 6.52 | Body; also the splash line on the splash sky (measured 6.52) |
| Dusk | Linen | 6.36 | Body |
| Dusk | Haze | 5.65 | Body (disabled button label) |
| Deep Sky | Paper | 5.57 | Body: links |
| Deep Sky | Cloud | 5.11 | Body |
| Deep Sky | Linen | 4.99 | Body |
| Deep Sky | Haze | 4.43 | Large text only; for body on Haze use `#085A8C` (5.76) |
| Ember | Paper | 5.51 | Body |
| Ember | Cloud | 5.06 | Body |
| Ember | Linen | 4.94 | Body |
| Twilight | Paper | 9.36 | Body (journal pen ink) |
| Warn text `#7A5A00` | Paper / Warn soft `#FBF0D6` | 6.28 / 5.63 | Body |
| Signal `#B42340` | Paper / Signal soft `#F9E3E7` | 6.35 / 5.27 | Body |
| White | Night Ink | 16.14 | Body (toasts, dark slides) |
| White | Signal `#B42340` | 6.45 | Body (a destructive swipe action or confirm fill) |
| White | Twilight | 9.51 | Body |
| White | Dusk | 7.22 | Body |
| White | Deep Sky | 5.66 | Body (caption on the hills in brand art) |
| White | Ember | 5.60 | Body |
| Paper | Twilight / Night Ink | 9.36 / 15.88 | Wordmark and text on dark |
| Haze | Twilight / Night Ink | 7.45 / 12.64 | Secondary text on dark |
| Apricot | Twilight / Night Ink | 5.55 / 9.42 | Warm accent text on dark |
| Sky | Twilight | 4.14 | Large text and graphics only |
| Night Ink | Poster sky `#8DD0F5` | 9.59 | Hero headline on brand art |

### 3.3 Banned pairings

| Pair | Ratio | Why |
|---|---|---|
| Sky as text on Paper or Cloud | 2.26 / 2.07 | Fails. Sky is a fill. |
| White on Sky | 2.30 | Fails. Use Night Ink on Sky. |
| White on Sunrise | 3.25 | Under 4.5. |
| Sunrise as text on Paper or Cloud | 3.20 / 2.94 | Graphics only. Words in orange are Ember. |
| Dusk on Sky, Apricot or Sunrise | 3.14 / 4.21 / 2.22 | Fails body. |
| Ember on Haze | 4.38 | Fails body. Put the Today tag on Paper. |
| Night Ink on Twilight | 1.70 | Invisible. |
| Sunrise touching Sky | 1.42 | Vibrates and fails for color-blind users. Always a 2 px Paper keyline between them. |

**Non-text checks:** Sky on Paper is 2.26, so a Sky shape that carries meaning on its own (a done state, a selected tab) must also change shape or carry a Night Ink glyph or label. Deep Sky on Haze 4.43 and on Paper 5.57, Sunrise on Paper 3.20 and Pencil on Paper 3.61 all pass 3:1. Sunrise on Haze is 2.55: a Sunrise mark on Haze needs its Paper keyline.

**Decorative marks** (under 3:1 by design; the meaning is carried elsewhere, so each must stay decorative): minor gauge ticks `--tick` (1.57; the readout carries the value), the off habit coin ring `--coin-ring` (1.80; the name and the check carry the state), the off filter chip edge `--line-strong` (1.44; the label carries the state), the thinking arc and its ring (the status line carries it). **Meaningful marks under 3:1 are not allowed:** the rest glyph in a Haze tile uses `#5F6D7B` (4.15), not Pencil (2.87); journal entry discs carry the count as a numeral inside the disc (1, 2, 3+), not by lightness alone; a warning pairs the Marigold mark with a glyph and words.

### 3.4 Proportions

Measured as the share of pixels on any app screen at 390 x 844:

| Share | Colors |
|---|---|
| 65 percent or more | Grounds: Cloud, Paper, Haze (the dawn wash counts). |
| 15 to 25 percent | Sky family: Sky, Deep Sky, the Orb. |
| About 10 percent | Night Ink and Dusk (text). |
| 5 percent or less | Warm: Apricot glow and Sunrise. Sunrise itself under 2 percent. |

Linen and Twilight never appear in app chrome. If a screen reads beige, Paper or Linen has crept in where Cloud belongs.

### 3.5 Orange's exact jobs

Sunrise means **now**. It has these jobs and no others:

1. **Today's dot** in the week strip: 6 px, above today's letter, 2 px Paper keyline.
2. **The gauge pointer:** a 12 px dot at the week's progress, 3.5 px Paper keyline (on Progress the equivalent is the ruler's NOW tick).
3. **The badge dot:** 8 px, 2 px Paper keyline, top right of a tab icon or the ask bar.
4. **The milestone stamp:** one round stamp per screen at most (section 8.4).
5. **The live node** on a timeline (the current step), 12 px with a Paper keyline.
6. **Now on a chart:** the now dot (8 px) and the NOW tick on the Progress ruler.

**Budget:** at most 3 Sunrise elements visible on one screen. Ember carries orange words (a Today tag, a streak label) and does not count. Apricot is light (glows, the Orb's underlight) and does not count; nor does the thinking arc `#FF9F5A`, which is Orb light. Orange never fills a button, a card, a selected state, a done state, a session kind or a chart series.

**Priority when more than 3 would show** (highest first; what is past the third yields):

1. Today's dot in the week strip.
2. The gauge pointer, or on Progress the NOW tick and the now dot (they count as one job, two marks).
3. The live node on a timeline.
4. The milestone stamp.
5. Badge dots.

A yielding mark keeps its shape and turns Night Ink with its Paper keyline: a badge dot becomes an 8 px Night Ink dot; the morning line's live node becomes a Night Ink node while the gauge pointer is on screen. Today on Today: today's dot, the gauge pointer and one badge; every other badge is Night Ink.

**Keylines:** every Sunrise mark has a Paper keyline of at least 2 px (`--now-keyline`). The named exceptions are larger: the gauge pointer 3.5 px, the stamp `max(2px, 3.3%)` of its diameter.

### 3.6 Dark mode

Not in v1. The app ships light (`color-scheme: light`), as it does today. Dark grounds (Twilight, Night Ink) are for brand surfaces: the night splash variant, the dark app icon, deck section slides, share cards. The pairings for dark grounds are in 3.2. A future dark mode starts from Night Ink grounds, Twilight cards, Paper text and the unchanged Orb, and gets its own section here before anyone builds it.

---

## 4. Type

Sheet: `assets/type-specimen.png`.

### 4.1 Families and licenses

| Face | Job | Source | License |
|---|---|---|---|
| **Fraunces** (variable: wght, opsz, SOFT, WONK; roman and italic) | Display: titles, section and card titles, static hero stats, the session name; italic 420 is the sentence voice. The wordmark. | Self-hosted from `docs/brand/fonts/` (the source is the `@fontsource-variable/fraunces` **full** and **full-italic** files: the default import has only the wght axis, and SOFT and WONK need the full files) | SIL OFL 1.1, no Reserved Font Name. `fonts/Fraunces-OFL.txt` |
| **Inter** (variable) | Everything a person reads or taps below display sizes, and every number that changes. | Self-hosted today in `apps/web/public/fonts/` (`fonts.css`); the same files are in `docs/brand/fonts/` | SIL OFL 1.1. `fonts/Inter-OFL.txt` |
| **Inter Tight** (variable) | Captions (600, caps) and gauge end labels. Nothing else. | Self-hosted today in `apps/web/public/fonts/`; also in `docs/brand/fonts/` | SIL OFL 1.1. `fonts/InterTight-OFL.txt` |

`apps/web/package.json` has no `@fontsource` packages; the app self-hosts its faces in `apps/web/public/fonts/fonts.css`, and Fraunces joins them the same way.

Files in `docs/brand/fonts/`: `fraunces-latin-full-normal.woff2` (121 KB), `fraunces-latin-full-italic.woff2` (150 KB), their `-latin-ext-` siblings, Inter and Inter Tight variable woff2, the three OFL texts, and `Fraunces-Wordmark-700-S100-o144.ttf` (a static instance used only to outline the wordmark; it is a Modified Version under the OFL and ships, if ever, with the OFL text). Ship the woff2 files unmodified with their OFL texts in `apps/web/public/fonts/` and add the roman to the preload list in `vite.config.ts`. Fraunces replaces Instrument Serif, which is removed.

**The `@font-face` rules** (`apps/web/public/fonts/fonts.css`):

- Fraunces roman and italic: `font-weight: 100 900` on both faces.
- Inter Tight: change `font-weight: 700 900` to `font-weight: 100 900` on both faces (the file is a full 100 to 900 variable font; with 700 900 a 600 caption matches the 700 face).
- `Fraunces Fallback`, metric-matched to Georgia with the formula already in `fonts.css` (size-adjust = the average lowercase width ratio, overrides = the web font's metrics divided by it). Fraunces [2000]: ascent 1956, descent -510, line gap 0, average width 0.5211 em; Georgia 0.4458 em. So: `src: local('Georgia'); size-adjust: 116.88%; ascent-override: 83.67%; descent-override: 21.82%; line-gap-override: 0%;`

**Axes.** The Fraunces woff2 defaults to WONK 1 and SOFT 0. Set `html { font-variation-settings: 'SOFT' 100, 'WONK' 0; font-optical-sizing: auto; font-synthesis: none; }` once (in `tokens.css`; Inter and Inter Tight ignore axes they do not have) and never set `font-variation-settings` anywhere else: `check-brand.mjs` flags any other use. Never fake bold or italic.

### 4.2 The scale (iPhone, rem at a 16 px root, so iOS Larger Text scales it)

| Role | Face | Size / line | Weight | Tracking | Color | Token |
|---|---|---|---|---|---|---|
| Hero (splash, onboarding, empty states) | Fraunces | 3.5 / 3.5 rem (56/56) | 700 | -0.02 em | Night Ink | `--fs-hero` |
| Screen title (Today, Goals...) | Fraunces | 2.375 / 2.625 rem (38/42) | 650 | -0.015 em | Night Ink | `--fs-title` |
| Session name in the gauge | Fraunces | 2.5 / 2.625 rem (40/42); 1.875 / 2.125 rem past 12 characters | 650 | -0.015 em | Night Ink | `--fs-stamp` |
| Hero stat that changes (Progress, a count) | Inter | 2.75 rem, line 1 | 650, `tabular-nums` | -0.02 em | Night Ink; unit Inter 500 0.9375 rem Dusk | `--fs-stat-live` |
| Stat in a tile or card (changes) | Inter | 1.625 / 2 rem (26/32), the section-title size, so no new size enters the scale | 650, `tabular-nums` | `--tr-title` | Night Ink; unit Inter 500 `--fs-sub` Dusk, 4 px after | `--fs-value`, `--lh-value` |
| Hero stat, static (never changes after first paint) | Fraunces | 2.75 to 3.625 rem, line 1 | 650 (proportional figures: Fraunces has no tnum) | -0.02 em | Night Ink | `--fs-stat` |
| Section title (Habits, Plan your day) | Fraunces | 1.625 / 2 rem (26/32) | 600 | 0 | Night Ink | `--fs-section` |
| Card title, sheet title | Fraunces | 1.375 / 1.75 rem (22/28) | 600 | 0 | Night Ink | `--fs-head` |
| Sentence: prompt or greeting | Fraunces italic | 1.375 / 1.75 rem (22/28) | 420 | 0 | Night Ink | `--fs-sentence` |
| Sentence: subline, quote | Fraunces italic | 1.0625 / 1.375 rem (17/22) | 420 | 0 | Dusk | `--fs-sentence-sm` |
| Headline below the serif floor | Inter | 1.0625 / 1.375 rem (17/22) | 600 | 0 | Night Ink | `--fs-row` |
| Body, assistant replies | Inter | 1 / 1.5 rem (16/24) | 400 | 0 | Night Ink | `--fs-body` |
| Secondary, row subtitle | Inter | 0.9375 / 1.25 rem (15/20) | 500 | 0 | Dusk | `--fs-sub` |
| Footnote | Inter | max(13px, 0.8125rem) / max(18px, 1.125rem) | 500 | 0 | Dusk | `--fs-foot` |
| Habit tile name | Inter | 0.9375 / 1.125 rem (15/18), up to 2 lines | 600 | 0 | Night Ink | `--fs-tile` |
| Tag (Today, Planned) | Inter | max(13px, 0.8125rem) | 600 | 0 | Ember or Dusk | `--fs-tag` |
| Small tile label | Inter | max(12px, 0.75rem) / max(16px, 1rem) | 600 | 0 | Night Ink | `--fs-orb` |
| Tab label | Inter | max(11px, 0.6875rem) / 0.875 rem | 550; 650 active | 0 | Dusk; Night Ink active | `--fs-caps` |
| Caption | Inter Tight | max(11px, 0.6875rem) / 0.875 rem | 600, caps | +0.14 em | Night Ink or Dusk | `--fs-caps`, `--tr-caps` |

### 4.3 Caption style

Inter Tight 600, 11 px floor, uppercase, tracking +0.14 em (the only caps tracking in the system), Night Ink or Dusk. At most one caption per card, at most 4 words, no period. Use it for eyebrows ("TODAY'S LIFT"), the date line over a tab title ("TUE, NOV 10"), gauge end labels and brand-art captions.

### 4.4 Numerals

- Every **live** number (pace, timers, splits, the week strip, chart labels, hero stats that change, counts) is set in **Inter** with `font-variant-numeric: tabular-nums`. Check: "1111" and "0000" render at the same width in Inter.
- **Fraunces has no tabular figures** (the shipped woff2 has only `liga` and `rvrn`; at 650 its "1" is 933 units wide and "0" 1353). So Fraunces sets only numbers that never change after first paint (a year heading, a static stat on a share card). `tabular-nums` on Fraunces does nothing; never rely on it.
- Times are "6:30", distances "4.2 mi", durations "45 min" and "2 h 4 min". No leading zeros on hours.

### 4.5 Rules

| Do | Don't |
|---|---|
| Fraunces for titles, card titles, sentences and one static hero stat. | Fraunces in buttons, tabs, chips, inputs, placeholders, body, habit coins or numbers that change. |
| Fraunces roman at 600 to 700. | Fraunces roman under 600 (the soft axis turns mushy). |
| Fraunces at 17 px and up (italic) or 20 px and up (roman). | Fraunces below those floors. |
| At most 4 Fraunces sizes and 5 Inter sizes on one screen (11 px counts once). | A new size not in the scale. |
| rem sizes with px floors for the small roles. | Raw px font sizes (`scripts/check-styles.mjs` fails them). |

---

## 5. Layout and shape

### 5.1 Grid and spacing

| Rule | Value |
|---|---|
| Side gutter | 16 px (`--gutter`) for text and cards, at every phone width. |
| Spacing steps | Padding, margin and gap use 4, 8, 12, 16, 20, 24, 32, 48 (`--sp-1` to `--sp-12`) and the named tokens in this table. The only off-step values are the named exceptions below. Component sizes (heights, diameters) are not spacing: they are listed in section 6 and in `tokens.json`. |
| Named exceptions | `--gap-dot` 3 px (habit week dots), `--dot-offset` -7 px (today's dot above its letter), `--fade-h` 52 px (the dock fade). No others. |
| Between cards | 12 px (`--gap`). |
| Between habit tiles | 12 px (`--gap-tile`); tile padding 12. |
| Between sections | 32 px (`--section`). |
| Section header to first card | 12 px (`--sec-gap`). |
| Card padding | 16 px; the hero card 20 px. |
| Named uses | Screen title block to first content 16 px; caption eyebrow to the title under it 4 px; a title to its own subtitle, a label to its value, a number to its unit 4 px; card title to the card's content 8 px; groups inside a card 16 px, or a `--line` hairline with 16 px on each side where the kind of content changes; icon tile to its text 12 px; inline glyph to its label 8 px; neighboring bezeled controls 12 px; stacked buttons 12 px, a quiet link 8 px under the button above it; on list pages a group title sits 24 px below the group above it and 8 px above its own group; the last content of a scroll ends at least 24 px above the top of the dock. |
| Proximity | The space above any heading is at least twice the space below it. Inside a card, no gap is larger than the card's padding unless a hairline marks it. |
| Hit target | 44 x 44 pt minimum (`--hit`). One named exception: the Progress range control's seven segments may narrow to 36 pt wide (still 44 pt tall, contiguous, no gaps) on screens under 375 pt wide. |
| Columns | Two-column grids at every phone width; a tile's content fits 150 px. |
| Chrome | Tab capsule 56, ask bar 48, gap 8, 8 above the safe area (`--chrome-h`); the dock column 12 in from each edge (`--dock-inset`). |
| Kept layout tokens | `--safe-t`, `--safe-b`, `--kb`, `--maxw` 720, `--sp-group` 12, `--sp-secondary` 24, `--dpager-gap` 16. They are live in the app; merge, never delete. |
| Brand art | 24 px module; one horizon line at 62 to 70 percent of the frame height. |

### 5.2 Radii

| Radius | Use | Token |
|---|---|---|
| 24 px | Cards, the hero card, sheet top corners | `--r-card` |
| 18 px | Tiles, habit tiles, inset groups, context chips | `--r-tile`, `--r-group`, `--r-chip` |
| 14 px | Inputs, inset controls, menus | `--r-control`, `--r-menu` |
| 12 px | Icon tiles 32 px and up | `--r-icon` |
| 999 px | Buttons, chips, segmented controls and thumbs, the ask bar, the tab capsule, pills | `--r-pill` |
| Circle | Icon tiles under 28 px, the 40 px context-chip disc, coins, dots, discs, round buttons | 50% |

No other radii: no 3, 6, 8, 9, 10, 16, 20 or 22. Glyphs are icons and follow section 7 (rectangles r 4), including the Stop square in the composer. The app icon follows the iOS mask.

### 5.3 Surfaces and depth

| Surface | Spec |
|---|---|
| Ground | Cloud `#EAF5FC`. Each tab root carries the dawn wash `linear-gradient(180deg, #CBE8F8 0, #EAF5FC 300px)`. The wash scrolls with the page (`background-attachment: scroll` on the scroller). Pushed pages and sheets are flat. Sticky bars carry the wash color they sit on: the title bar `linear-gradient(180deg, #CBE8F8, var(--wash-bar))`, the week strip `linear-gradient(180deg, var(--wash-strip), var(--wash-strip-end))`. |
| Card | Paper `#FFFDF8`, no border, `--shadow-1`: `0 1px 1px rgba(14,34,54,.04), 0 10px 28px -14px rgba(14,34,54,.20)`. |
| Floating chrome | Ask bar, tab capsule, round buttons, avatar: Paper, `--shadow-float`: `0 1px 1px rgba(14,34,54,.05), 0 12px 28px -12px rgba(14,34,54,.28)`. |
| Menu | `--shadow-2`: `0 18px 40px -16px rgba(14,34,54,.30)`. |
| Sheet | `--shadow-sheet`: `0 -8px 40px rgba(14,34,54,.14)`; scrim `rgba(14,34,54,.32)`. |
| The sunrise glow | One per screen, under the hero card: `radial-gradient(closest-side, rgba(255,182,128,.42), transparent)` placed left and right -12%, bottom -52%, height 78%, clipped by the card. |
| The title-line sunrise (tab roots) | The one brand signature in app chrome: on each tab root's large title line, a 1 px `--tick` horizon hairline from 58% of the width to the right edge, 9 px above the title's bottom, with a 28 x 14 px Apricot half-sun (`radial-gradient(circle at 50% 100%, #FFE3CB, #FFB680 72%)`) sitting on it, 52 px from the right edge. Tab roots only; hidden when the title collapses. It is light, not a Sunrise mark. |
| Paper grain | Brand surfaces only (Linen grounds, posters, the icon, share cards, decks): fractal noise, baseFrequency 0.85, 2 octaves, warm brown at 55% alpha, multiply at 35 to 50%. Never on app cards, text areas or chrome. |

Retired: inset bevels (`--bevel-hi`), pearl gradients, navy pills, pressed-in wells, the layered craft shadows.

### 5.4 Dividers

Hairlines inside cards are 1 px `rgba(14,34,54,.10)` (`--line`), inset 16 px from the leading edge (or aligned to the text after an icon tile). Light swatches, secondary buttons, the composer and Paper on Linen get a 1 px `--edge` `rgba(14,34,54,.12)`. `--line-strong` (.18) is only the off filter chip edge. Never a divider between cards; the gap is the divider. Inside a card, never a bordered or shadowed box: use a hairline row, a Haze icon tile or space. A dashed edge marks an empty add slot only, one per group.

---

## 6. Components

Every value below is a token or a number to check. Mockups showing each in place: `docs/brand/mockups/`. Spacing uses, the order of emphasis on each screen, containers and the values for section headers, list rows, stat tiles and chart cards are in `docs/brand/layout-and-hierarchy.md`.

### 6.1 The floating dock and tab capsule

| Part | Spec |
|---|---|
| Position | A column 12 px in from each edge (`--dock-inset`), 8 px above the safe area. A Cloud fade 52 px tall (`--fade-h`) sits under it (transparent to 86% at 30 px to solid at 52 px). |
| Ask bar | 48 tall, pill, Paper, `--shadow-float`. The Orb at 28 px (gloss tier, still), 12 px from the left; then "Ask or change anything" Inter 1.0625 rem Dusk. A pending item shows the 8 px Sunrise badge dot. |
| Tab capsule | 56 tall, pill, Paper, `--shadow-float`. Six tabs in this order: Today, Goals, Learned, Plan, Progress, Journal. |
| Tab | Icon 22 px, 1.75 stroke, inside a 32 px circle; label Inter `--fs-caps` 550 Dusk. Progress uses the set's Progress glyph (a rising line ending in a circle), never a pulse. |
| Active tab | The 32 px circle fills Sky; icon Night Ink (7.03); label Night Ink 650. |
| Badge | 8 px Sunrise dot, 2 px Paper keyline, at the icon's top right. |
| Fold | At the end of a page the ask bar sinks (opacity 0, translate 16 px, scale 0.98, 220 ms) and the Orb becomes a 48 px round Paper button beside the capsule, holding a 28 px gloss Orb (still, `--orb-fold`). |
| Larger Text | Above 150 percent, labels hide and icons grow to 26 px (the one extra icon size, section 7). |

### 6.2 Buttons

| Kind | Fill | Label | Size | Other |
|---|---|---|---|---|
| Primary | Sky `#38B6F2` | Night Ink, Inter 1.0625 rem 650 (7.03) | 54 tall full width, 44 inline, pill | `--primary-glow`. Pressed: scale 0.97 over 160 ms, fill `#5CC4F5`. Disabled: Haze fill, Dusk label (5.65), no glow. One per screen. |
| Secondary | Paper | Night Ink, Inter 600 | 54 / 44, pill | 1 px `rgba(14,34,54,.12)` edge, no shadow. |
| Quiet | None | Deep Sky, Inter 600 (5.57) | 44 hit | Links and "History >" style actions. |
| Destructive | Paper | Signal `#B42340` 600 | 54 / 44, pill | 1 px edge. Confirm in a sheet. |
| Round icon button | Paper | Night Ink 18 px icon | 40 px circle (44 hit) | `--shadow-float`. |

| Do | Don't |
|---|---|
| Night Ink words on Sky. | White words on Sky (2.30). |
| One primary per screen. | Two Sky buttons competing. |
| Orange only for now-marks. | An orange button. |

### 6.3 Chips and segmented controls

| Part | Spec |
|---|---|
| Context chip (two lines, Today) | Paper, r 18, `--shadow-1`, padding 12. A 40 px Haze circle (a circle at any size: 5.2) with a Deep Sky 18 px glyph; title Inter 17 600 Ink; subtitle Inter 15 500 Dusk. |
| Filter chip | Pill, 32 tall (44 hit with padding). Off: Paper, 1 px `--line-strong`, Dusk label. On: Sky fill, Night Ink 650 label. |
| Tag (Today, Planned) | Pill, 28 tall, Inter `--fs-tag` 600. Today: Ember on Paper with a 1 px `rgba(180,67,12,.4)` keyline (5.51). Planned: Dusk on Cloud. |
| Segmented control | Cloud track, pill; thumb Sky, pill, no shadow; labels Inter 15, Dusk 550 off, Night Ink 650 on. 44 tall in a card, 36 tall in a header bar (44 hit). Thumb slides on the settle spring (300 ms). At most 5 segments, equal widths, text only. The one exception is the Progress range control (1W, 1M, 3M, 6M, YTD, 12M, All): seven segments in one row under the hero chart, 12 px in from the card's edges. |
| "+ Set" | A quiet link, not a pill: Deep Sky Inter 600 "+ Set" (5.57), 44 hit. A screen keeps its one Sky primary. |

### 6.4 Cards and the hero card

- **Card:** Paper, r 24, padding 16, `--shadow-1`, no border. One caption at most. One primary action at most. A card holds one unit people read or act on; three or more items of the same kind are one card with hairline rows (an inset group), never a card each (the habit grid is the exception). A screen uses at most three card templates.
- **Hero card:** one per screen. Padding 20. The sunrise glow under its bottom edge (5.3). Holds the screen's main thing: Today's session gauge, Goals' today card, Plan's "Your plan", Progress's this-week card. Learned's prompt card is Learned's hero. Journal has no glow: its Remember when card, with the quote inside a Haze wash header, is Journal's hero when it shows.
- **Icon tile in a row:** 32 px, r 12, Haze, Deep Sky glyph. Session tiles (48 px, r 12): Haze, glyph in the session's data tone. Never a tinted card or a per-feature hue.
- **Inset group (Settings):** Paper card, rows 56 tall (64 with a subtitle), hairlines inset past the icon tile, chevron 18 px Dusk.

### 6.5 The U-arc training gauge (Today's hero)

Retires the hard-coded orange gradient and bevel in `features/day/HeroGauge.tsx`.

| Part | Spec |
|---|---|
| Geometry | A 220 degree arc, center (150, 62), radius 118, in a 300 x 200 viewBox. Angles are measured clockwise on screen from +x, in SVG's y-down coordinates: the arc starts at 200 degrees, (39.1, 21.6), passes through 90 degrees (the bottom, (150, 180)) and ends at -20 degrees, (260.9, 21.6). The session's words sit inside the bowl. |
| Track | 16 px, round caps, Haze `#CBE8F8`. No gradient, no shadow. |
| Fill | 9 px, round caps, Deep Sky `#0A6CA6` (4.43 on Haze, passes 3:1), from the start to the pointer. Never Sky (1.80 on Haze). The start cap dot is Deep Sky. |
| Ticks | Centered on the track's outer edge. Minor every 0.5 mi: 1 x 5 px, `--tick` (decorative). Major every 5 mi: 1.5 x 10 px, `--tick-major`. Above a 30 mi plan, minor every 1 mi. At most 60 ticks. |
| Pointer | The now-mark: 12 px Sunrise dot with a 3.5 px Paper keyline at the week's progress. |
| End labels | "0" and the plan ("23 MI") in caption style, Dusk, tnum, set horizontal (never rotated), centered under each end of the arc. |
| Inside the bowl | Caption eyebrow ("TODAY'S LIFT"), the session name in Fraunces 650 40/42 (title case: "Strength A", never "STRENGTH A"), the detail in Inter 15 500 Dusk ("Floor 20 min"). |
| Readout (required) | Every gauge prints its value as text, because color alone cannot carry it: a Paper pill, `--shadow-pill`, Inter 17 Night Ink, tnum: "4.2 of 23 mi · 1 of 4 runs", a Deep Sky chevron. It sits inside the bowl with at least 8 px between the pill and the track's inner edge, never over the track or its ticks. It opens the week. |
| Motion | The fill sweeps on `springs.number` (0.48 s, bounce 0, animating `stroke-dashoffset`); the pointer moves on `springs.settle` (0.30 s, bounce 0.10). Ticks draw in with a 6 ms stagger, capped at 240 ms. First view of the day only. Scales and labels never move. Under Reduce Motion the fill and pointer jump. |

### 6.6 Habit tiles

| Part | Spec |
|---|---|
| Grid | Two columns, gap 12 (`--gap-tile`), tiles Paper r 18, `--shadow-1`, min height 60, padding 12. |
| Coin (off) | 42 px circle, 1.5 px inset ring `--coin-ring` (decorative), the habit's initial in Inter 600 `--fs-row` Night Ink (or a numeral in Inter 600). Never Fraunces. |
| Coin (lit) | A flat Sky disc with a Night Ink check (7.03). Not a glossy Orb: the gloss is the assistant's. Lights with one overshoot to 1.12 on `springs.complete` and the `orb` haptic on the peak. |
| Name | Inter 600 `--fs-tile` (0.9375 / 1.125 rem), Night Ink, sentence case ("Read 15 min"), up to 2 lines, never truncated to an icon. |
| Week dots | Seven 6 px dots, gap `--gap-dot` 3: done Deep Sky; missed a 1.25 px Pencil ring (3.61); ahead `--dot-ahead`; the shown day a 1.5 px Night Ink outline offset 1.5 px. No orange. |
| Add tile | Paper tile, a 42 px circle with a 1.5 px `--line` ring and a + glyph, "Add" in Inter 600. |

### 6.7 The week strip

| Part | Spec |
|---|---|
| Layout | Seven cells, Monday first, sticky under the title bar with the wash color behind it. |
| Letter | Caption style, Dusk; today's letter Night Ink. |
| Numeral | Inter 600 1.0625 rem, Night Ink, tnum. |
| Shown day | A 34 px Sky disc behind the numeral (Night Ink on Sky 7.03). It slides on the settle spring. |
| Today | Always keeps its 6 px Sunrise dot above the letter, with a 2 px Paper keyline, whether or not it is the shown day. Today and the shown day are never the same signal. |
| Kind pill | Pill 22 tall: Paper with a 1 px `rgba(14,34,54,.10)` edge and Dusk glyphs. Done: Sky with Night Ink glyphs. Today's planned: 1.5 px Deep Sky ring, Deep Sky glyphs. Missed: transparent with a 1 px edge. |
| Hit | Each cell 44 pt wide or more, 81 tall. |

### 6.8 Charts

| Part | Spec |
|---|---|
| Actual (line) | 2.5 px Deep Sky line, round joins; area under it Sky at 16 percent. |
| Plan (line) | 1.5 px Dusk line, dashed 4 / 4. |
| Bars | Done: Sky fill with a 1.5 px Deep Sky top edge (so the bar passes 3:1). Planned: 1.5 px Deep Sky outline, dashed 3 / 3 in the future. Rest: a 2 px Pencil dot. |
| The now dot | 8 px Sunrise, 2 px Paper keyline, on the latest point. |
| Progress ruler | A linear ruler above the bars: Haze track 6 px, Deep Sky fill to today's miles, a Sunrise NOW tick (2 x 14 px) with "NOW" in caption style Ember, and a Night Ink 8 px triangle for "plan by today". |
| Axes | Caption style, Dusk, tnum. Gridlines 1 px `rgba(14,34,54,.08)`. No chart borders. |
| Series colors | Session kinds use the data tones (3.1). Never orange for a series. Never more than 4 series. |
| Values | Every chart prints its headline number as text above it, in Inter 650 with `tabular-nums` (never Fraunces). |
| Range control | Progress's hero chart: seven segments (1W, 1M, 3M, 6M, YTD, 12M, All) in one row 12 px below the plot, 12 px in from the card's edges, the segmented control's look (6.3), 44 tall. Default 3M. The headline and takeaway follow the range. |
| Labels | Direct labels at the line ends ("Plan", "You") in caption style; no legend for 4 series or fewer. Y labels short, on the trailing side, units in the headline; 3 to 5 horizontal gridlines at round steps (0, 5, 10 mi). |
| Size | A detail plot spans the card's inner width, 160 px tall at 320 pt and 180 px at 390 pt and up. A sparkline in a tile is 32 px tall with no axes, labels or gridlines. |
| Takeaway | One sentence, Inter `--fs-sub` Dusk, 4 px under the headline, says what the chart shows ("8 mi behind plan"). |
| Week horizon (Progress) | The week as a horizon (8.5): a 1 px `--tick` horizon line; each run day a half-sun sitting on it, radius `min(20, 6 + 1.5 x miles)` px; done is a Sky half-sun with a 1.5 px Deep Sky arc; planned is a 1.5 px Deep Sky dashed arc (3 / 3); a lift, rest or cross day is a 2 px Pencil dot; day letters in caption style under the line, today's letter Night Ink. The ruler sits above it. Mockup: `mockups/progress.png`. |

### 6.9 Sheets

Paper, top corners 24, grabber 36 x 5 pill `rgba(14,34,54,.18)` 8 px from the top. Title Fraunces 600 26/32 (or the card-title size in a compact sheet). Close and secondary actions are 40 px round Paper buttons in the top corners. Scrim `rgba(14,34,54,.32)`. A CSS open runs 500 ms on `--ease-sheet`; a drag release and detent snaps run on `springs.sheet` (0.50 s, bounce 0). One primary button pinned at the bottom, above the safe area.

### 6.10 Toasts

Night Ink pill, 48 tall, White text Inter 15 500 (16.14; White on Night Ink is an allowed pairing, 3.2), an action in Haze 600 (12.64). 12 px above the dock. Shows for 3.2 s (5 s with an action), fades in 120 ms and out 100 ms, never stacks. Undo lives here; errors that need a decision live in a sheet.

### 6.11 Empty states

Two forms.

- **Screen empty state** (the whole screen or its hero has nothing yet): a Fraunces italic sentence (1.375 rem, Night Ink), one Inter 15 Dusk line under it, and one secondary or quiet button. Optional art: flat circles in Haze and Sky (a rising disc, concentric rings). Never the glossy Orb (except the assistant's own empty state) and never a photo or clip art. Example: "Your first week shows here after your first run." with "Open this week's plan".
- **Section empty state** (one section of a screen that has other content): one 64 px row in the section's card: a 32 px Haze icon tile, a title in Inter 17 600 ("No trends yet"), one Inter 15 Dusk line, an optional trailing quiet link. Never a second button for an action the screen already offers.

### 6.12 The assistant: composer and working state

| Part | Spec |
|---|---|
| Sheet | Paper body, Cloud header band, title "New chat" Fraunces 600, history and new-chat buttons in a 40 px Paper capsule. |
| Empty state | The Orb at 56 px (full, glow, breathing), the greeting in Fraunces italic 420 `--fs-sentence` (1.375 / 1.75 rem) Night Ink ("Good afternoon, Sam."), one Inter 17 Dusk line, the disclaimer in Inter `--fs-foot` Dusk. |
| Suggestions | Paper cards r 18, `--shadow-1`, title Inter 17 600 Ink, second line Inter 15 Dusk, a horizontal row that scrolls. |
| Composer | Paper card r 24, 1 px `rgba(14,34,54,.12)` edge; placeholder "Ask anything" Inter 17 Dusk; a 40 px Cloud + button; context chips as Cloud pills with Dusk glyphs. |
| Send | 40 px circle. Empty: Haze with a Dusk arrow. Ready: Sky with a Night Ink arrow. Working: becomes Stop, a Night Ink 12 px square glyph with r 4 corners (an icon, section 7) on Paper. |
| Working state | The Orb switches to thinking (2.1): underlight warms, the Apricot arc orbits once per 1.2 s (decorative). A status line in Inter 15 Dusk ("Reading your week") is required: it is the accessible signal and has `role="status"`. Words land with a 120 ms fade; the `tick` haptic at most once per 100 ms. |
| Disclosure | The provider line under the composer ("AI assistant, powered by ...") stays exactly as compliance wrote it, in Inter `--fs-foot` Dusk. It is a required disclosure, not brand copy. |

### 6.13 Today's other parts

Every part on Today has a spec. Values not listed come from the nearest component above.

| Part | Spec |
|---|---|
| Hold-to-complete ring (`HoldRing.tsx`) | Haze track 3 px, Deep Sky fill animating `stroke-dashoffset` over `--dur-ring` (600 ms); the face Paper with a 1 px `--line` edge and a Night Ink check; done: Sky face with a Night Ink check. Never Sky on Haze. |
| Gauge start cap | A 9 px Deep Sky dot (the fill's round cap). |
| The morning line (four stops: wake, run, back, leave) | 1.5 px line in the session's data tone; stops are 10 px Paper dots with a 1.5 px Night Ink ring; the current stop is the live node (12 px Sunrise, 2 px Paper keyline), which yields to Night Ink while the gauge pointer is on screen (3.5). Stop labels in caption style, times in Inter 600 tnum. |
| Close the day | Three numbers in Inter 650 `--fs-value` with `tabular-nums` (they change), labels in Inter `--fs-sub` Dusk (one big number and one caption per card). |
| Week card (miles and runs tiles) | Two Paper tiles r 18, numbers Inter 650 tnum, labels caption style; the ring is the hold ring's track and fill at 4 px. |
| Plan-end card | A card with a Fraunces card title, one Inter 15 Dusk line and one secondary button. |
| Strava primer | Section 6.15 (third-party marks). |
| Calendar and word sheets | Sheets (6.9); calendar day cells 44 pt, the shown day a Sky disc with a Night Ink numeral, today a Night Ink ring. |
| Status chip and status sheet | The chip is a `--glass` pill (6.14) with a 6 px state dot: on plan Deep Sky, behind a Marigold dot plus the word, paused Pencil plus the word. The sheet is a standard sheet. |
| Avatar to Today pill | The 40 px avatar disc (6.14) becomes a 36 px Paper "Today" pill, Inter 600 Night Ink, `--shadow-float`, on the settle spring. |
| Day timeline rows | 56 px rows, a 32 px Haze icon tile with the glyph in the data tone, title Inter 17 600, time Inter 15 Dusk tnum, hairline inset past the tile. |
| Held-session row | As a timeline row with a 1.5 px Deep Sky dashed edge and "Held" in Inter 15 Dusk. |
| Hero faces (rest, evening, done, first run) | The same hero card and glow; the session name slot holds the face's words in Fraunces 650 ("Rest day", "Done", "Your first run"); done shows the lit Sky check coin; no extra orange. |
| Run landing route line | 2.5 px Deep Sky line on Cloud, start a Paper dot with a Night Ink ring, end the 8 px now dot only while live. |
| To-dos | The top-3 box is a Paper card with three rows; a checked row has a Sky coin with a Night Ink check and its words in Dusk with a line-through; the rest are faded to Dusk and fold under "More". User-picked to-do colors are marks only (a 10 px dot), from `--tag-*`; "orange" renders Ochre. |

### 6.14 Primitives

| Part | Spec |
|---|---|
| Field | 48 tall (multi-line grows), r 14, Paper, 1 px `--field-edge` (3.20), padding 12 / 16, text Inter 17 Night Ink, placeholder Dusk. Label above in Inter 15 600 Night Ink, 8 px gap. Error: a 1.5 px Signal edge and an inline error line under it (Signal 6.35, Inter 15, with a glyph). |
| Focus-visible | Every focusable control: a 1.5 px `--focus-edge` Deep Sky edge plus `--focus-ring` (`0 0 0 4px rgba(56,182,242,.28)`). Never remove focus outlines without this. |
| Switch | 51 x 31 track, pill. Off: `--line-strong` track with a Paper thumb and `--shadow-float`. On: Sky track, Paper thumb, a Night Ink check glyph inside the thumb so the state is not color alone. |
| Checkbox | 22 px circle. Off: 1.5 px `--field-edge` ring. Checked: Sky fill with a Night Ink check. |
| Menu items | 44 tall, Inter 17 Night Ink, glyph 18 px Dusk at the leading edge, hairlines `--line`; destructive items Signal. On the `--r-menu` card with `--shadow-2`. |
| Loading | Skeletons are Haze blocks at the component's radius, a 1.2 s opacity pulse from 1 to 0.6 (none under Reduce Motion). One `role="status"` label per group. |
| Swipe and destructive actions | The revealed action is Signal with White words (6.45) or a White trash glyph; other actions Deep Sky with White words (5.66). Destructive confirms happen in a sheet. |
| Count badge | A pill 18 tall, min 18 wide, Night Ink fill, White Inter 12 600 tnum. Not orange: only the 8 px badge dot is a Sunrise mark. |
| Nav bar | Large title (Fraunces `--fs-title`) collapses to a centered Inter 17 650 title in a 44 px bar on scroll; the back button is a 40 px round Paper button with an 18 px chevron (44 hit). |
| Avatar | 40 px Paper disc (44 hit), Inter 17 650 Night Ink initial, `--shadow-float`. |
| Glass status pill | `--glass` with `--glass-blur`, 32 tall, Inter 15 500 Night Ink; opaque Paper under Increase Contrast. |

### 6.15 Third-party marks

Strava, Apple Health and other partners' marks follow their owners' rules, not this guide: "Connect with Strava" is Strava's own orange button and "Powered by Strava" its own artwork, used exactly as supplied; Apple Health uses Apple's badge and naming. These are the only places another orange, another button style or another typeface may appear. Rules: use the partner's official asset unmodified, at its minimum size; keep it in its own row or sheet, never next to a Sunrise mark; it does not count toward the orange budget. In code, mark each line with `brand-ok: third-party <partner>` so `check-brand.mjs` and the brand agent skip it.

---

## 7. Iconography

Sheet: `assets/icon-sheet.png`. Source: `tools/icons.mjs`.

| Rule | Value |
|---|---|
| Grid | 24 px, 2 px live-area inset. |
| Stroke | 1.75 px, round caps, round joins, `currentColor`. |
| Corners | Rectangles r 4. |
| Construction | Circles and arcs first. Today is a sun (a 4.2 px disc, eight rays); Goals concentric rings; Progress a rising line ending in a small circle (r 2, stroked), the same glyph in the set, the dock and everywhere else; Plan a calendar with 4 px corners; Journal an open book; Learned a bulb. |
| Fill | None, except a single 1.3 px center dot. |
| Sizes | 22 px in tabs (26 px above 150 percent Larger Text), 18 px in buttons and chips, 15 px inside a 22 px tile, 28 px on sheets. |
| Color | Dusk inactive, Night Ink active or in body, Deep Sky as a link or in a Haze tile (4.43, a graphic), the session's data tone in a session tile (the rest glyph `#5F6D7B`, 4.15 on Haze). Never orange. |
| The set | Today, Goals, Learned, Plan, Progress, Journal, run, lift, habit, add, check, chevron, close, clock, wake, bell, settings, favorite, send, attach, trash, edit, history, search. |
| Lucide | Allowed where the set has no glyph, at stroke-width 1.75 with round caps, and only if it obeys every rule above. |

Never: emoji, stars or starbursts, rockets, atoms, filled glyph sets, two icon styles on one screen.

---

## 8. Illustration and renders

### 8.1 One render

The Orb is the only glossy, 3D object in the system. Everything else is flat color, with soft gradients only on the sky. A glossy render is allowed in exactly three places: the assistant, the splash, the app icon (and marketing art that shows them).

### 8.2 How it is lit

Key light from above (the cool white specular at the top), warm fill from below (the Apricot sunrise underlight). Never lit from the side, never a hard drop shadow, never a reflection of a room.

### 8.3 The poster

For brand surfaces (heroes, store art, share cards, the deck): flat bands of sky (`#8DD0F5` to `#AEDDF8` to `#CFEBFA`) meeting a warm horizon (`#F4E6D2` to `#FFD2AE`); rolling hills in three flat blues (`#8FCDEE`, `#4FA9DB`, `#0A6CA6`); concentric sun rings around the Orb in 1.5 px white at 70 percent stepping down 10 percent per ring; paper grain on top. Headlines in Fraunces 700, Night Ink (9.59 on poster sky). See `assets/hero-poster.png` and `assets/hero-landscape.png`.

**Staging the Orb (one rule for every image):** the Orb's bottom clears the horizon (the crest of the first hill under it) by 0.1 D, where D is its diameter. The horizon glow, an Apricot ellipse centered on the horizon, carries the warmth. Nothing covers the Orb's lower hemisphere: no hill, no phone, no text, no stamp. Rings center on the Orb and never cross text; mask or drop a ring rather than run it through words. Applies to the cover, the app icon (2.5), the poster, the landscape hero and the splash (12.1).

### 8.4 The milestone stamp

A round Sunrise stamp for a streak or a finished block, rotated -10 degrees, Night Ink on Sunrise (4.96, bold), with a Paper keyline of `max(2px, 3.3%)` of its diameter. One per screen; it counts toward the orange budget.

- **In the app (44 px):** the numeral only, Inter 700 tnum Night Ink, with `aria-label="Day 12 streak"`. No words: they cannot fit at the 11 px floor.
- **On brand art (92 to 118 px):** the numeral in Fraunces 700 (static art), with "DAY" and "STREAK" in caption style (Inter Tight 600, caps, +0.14 em) at 10 percent of the diameter.

### 8.5 The circle vocabulary

Discs, rings, domes, half-suns on a horizon, orbits. A done run is a half-sun on the week's horizon (brand art: radius 7 + 2.6 x miles px; in the app: `min(20, 6 + 1.5 x miles)` px, 6.8); a planned run is its dashed outline. Never people, faces, photographs, clip art or the reference's own shapes.

---

## 9. Motion and haptics

### 9.1 Durations and easings

Springs come from `apps/web/src/lib/motion.ts` (`springs.page`, `settle`, `sheet`, `number`, `complete` and the rest); CSS uses the `--dur-*` and `--ease-*` tokens.

| Move | Duration | Easing or spring |
|---|---|---|
| Press | 160 ms to scale 0.97 | `--ease-out` |
| Color, halo | 200 ms | `--ease-out` (animates `color` or `background-color`) |
| Fade in / out | 120 / 100 ms | `--ease-out` |
| Page push and pop | 350 ms | `springs.page` (0.35 s, bounce 0) |
| Sheet, CSS open | 500 ms | `--ease-sheet` `cubic-bezier(0.32, 0.72, 0, 1)` |
| Sheet, drag release and detents | 500 ms | `springs.sheet` (0.50 s, bounce 0) |
| Segmented thumb, reflow | 300 ms | `springs.settle` (0.30 s, bounce 0.10) |
| Numbers, gauge fill | 480 ms | `springs.number` (0.48 s, bounce 0); the fill animates `stroke-dashoffset` |
| Gauge pointer | 300 ms | `springs.settle` |
| Completion | 300 ms to 1.12, once | `springs.complete` (0.30 s, bounce 0.30), `orb` haptic on the peak |
| Hold ring | 600 ms | `--dur-ring`, linear, `stroke-dashoffset` |
| Gauge ticks | 6 ms stagger, 240 ms cap | linear |

**What may animate:** `transform` and `opacity`, plus these named cases only: `color` and `background-color` (the 200 ms color and halo change), `stroke-dashoffset` (the gauge fill and the hold ring). A gradient never transitions: the dawn wash and the Orb's warming underlight fade in as an overlay layer's `opacity`.

### 9.2 Brand moments

- **Sunrise splash** (first open of the day): the Orb rises 24 px to its resting place (bottom 0.1 D above the hills' crest) while its underlight layer's opacity goes from 0 to 1, 900 ms; then the wordmark fades in over 200 ms. Later launches: a 300 ms fade only. Hard cap 3.5 s.
- **Dawn wash** (first open after 4 a.m. local): a wash layer over the Cloud ground fades its `opacity` from 0 to 1 over 600 ms. Once a day.
- **The Orb:** idle breath 4 s loop; thinking orbit 1.2 s per turn; one shared 24 fps loop that stops when no Orb is visible or the app is in the background.

### 9.3 What never moves

Text blocks, cards on scroll, the palette, backgrounds after load, gauge scales and labels, the logo (except the splash rise).

### 9.4 Reduce Motion

Every move becomes a 150 ms linear fade. The Orb holds its still frame. Gauge pointers jump. The splash shows the final frame. No parallax, no breath, no orbit.

### 9.5 Haptics

Unchanged from `lib/haptics.ts`: named events, at most one per action, fired on the visual peak frame. `tick` (words landing, selection, at most 1 per 100 ms), `select`, `toggle`, `orb` (a habit lit), `lift`, `drop`, `threshold`, `success`, `celebrate` (a milestone stamp), `delete`, `warning`, `error`. Never for a tap that only navigates. The Settings switch turns them all off.

---

## 10. Voice and copy

### 10.1 Principles

1. **Plain.** Short words, short sentences. One idea per line.
2. **Warm, not cute.** Encouraging like a friend who runs, never a cheerleader.
3. **Specific.** Numbers and times, not adjectives: "Easy 5 at 6:30", not "a great run".
4. **Honest.** Say what happened, including misses, without guilt.
5. **American spelling** (color, favorite, center). No em dashes: use a period, a comma or a colon. No exclamation marks in a row, at most one per screen. No model names in brand copy (required provider disclosures stay where compliance puts them). Sentence case everywhere except the caption style.

### 10.2 Glossary

| Use | Not | Note |
|---|---|---|
| Orby | the Orby, Orby app, ORBY | Section 2.6. |
| the assistant | coach, AI, bot, Orby (as the assistant) | Lowercase in a sentence. |
| entry | post, log | A journal entry. "Write today's entry." |
| Favorite | star, like, heart | Capitalized as the feature: "Add to Favorites". |
| plan | program, schedule (as the training plan) | "Your plan", "this week's plan". |
| Wake time | alarm, wake-up | Capitalized as the setting; "Wake at 6:30" in a sentence. |
| session | workout (in UI labels) | "Today's lift", "Easy 5". |
| habit | streak item, task | |

### 10.3 Ten lines, done right and wrong

| Do | Don't |
|---|---|
| Good morning, Sam. Easy 5 today, then you're free. | Rise and grind, Sam!!! Time to crush it! |
| Three mornings in a row. Nice work. | AMAZING streak!! You're unstoppable! |
| Rest day. Your legs will thank you tomorrow. | No workout today :( Don't lose momentum! |
| What would make today count? | Enter your daily goal below. |
| Ask or change anything. | Chat with your AI coach. |
| Moved your run to Thursday. Undo | Your workout has been successfully rescheduled. |
| You missed Tuesday. Want to fit it in Saturday? | You failed to complete Tuesday's session. |
| Orby is for fitness and wellness. It is not medical advice. | The Orby app is not a medical device. Consult a physician. |
| 4.2 of 23 mi this week | 18% of weekly mileage goal achieved |
| Nothing written yet. A line or two is plenty. | No entries found. |

---

## 11. Accessibility

| Area | Rule and check |
|---|---|
| Contrast | Body text 4.5:1, large text 3:1, meaningful graphics 3:1. Only the pairings in 3.2. `apps/web/scripts/check-contrast.mjs` reads its table from `docs/brand/tokens.json` `contrast.allowedText` (every row, including text on Haze `--surface-3`, `--now-text`, `--primary-ink` on `--primary` and `--sun-ink` on `--sun`) and stays in `pnpm test`. |
| Color alone | Never the only signal: the shown day is a disc plus a numeral, done is a filled coin plus a check, today is a dot plus Night Ink letter, every gauge prints its number. |
| Dynamic Type | Every size in rem with px floors (11, 12, 13). Check every screen at 200 percent: nothing clips, nothing overlaps, cards grow, two-column grids may become one column. Above 150 percent, tab labels hide and icons grow to 26 px. |
| Targets | 44 x 44 pt minimum for anything tappable, including week cells, chips and dots that act. |
| Reduce Motion | Section 9.4. Test with the iOS setting on. |
| Increase Contrast | `prefers-contrast: more` remaps both the semantic aliases and the palette names, so a component gets the step whichever it uses: `--ink-2/3/4` and `--dusk` to Graphite `#33475B`; `--accent-text`, `--ok`, `--deep-sky`, `--t-long`, `--star`, `--prio-3` and `--tag-blue` to `#085A8C`; `--ink-faint`, `--pencil` and `--t-rest` to `#5F6D7B`; `--line` .30, `--line-strong` .55, `--edge` .30, `--tick` .45, `--coin-ring` .55, `--dot-ahead` .22; card edge `1px solid rgba(14,34,54,.16)`, field edge .7 (5.98); glass opaque Paper. In `tokens.css`. |
| VoiceOver | The Orb's label is "Assistant" when it opens the assistant, "Orby" as the logo; decorative Orbs are hidden. Gauges read their readout ("0 of 23 miles this week, 0 of 4 runs"). Stamps read as "Day 12 streak". |
| Captions | Caption style is never the only label on a control. |
| Working states | Any animated indicator (the thinking arc, a skeleton) has a text status with `role="status"`. |

---

## 12. Applying it to the app

### 12.1 Screen by screen

| Screen | What changes | Mockup |
|---|---|---|
| Today | Dawn wash ground; Fraunces 650 title and italic quote in Dusk; the title-line sunrise (5.3); week strip with the 34 px Sky shown-day disc and today's Sunrise dot; Paper context chips with Haze icon discs; the hero card in Paper with the sunrise glow; the gauge per 6.5 (Haze track, Deep Sky fill, Sunrise pointer, horizontal end labels, the readout inside the bowl, "Strength A" in Fraunces); Sky segmented thumb; habit tiles per 6.6 (Inter initials, sentence-case names, lit coins Sky); the 28 px Orb in the ask bar; the Sky active-tab disc. | `mockups/today.png`, `today-habits.png`, `today-before-after.png` |
| Goals | Paper chips with Haze icon discs (no per-feature hues); "+ Set" as quiet Deep Sky links; the Today card's sun in Apricot (no extra glow); "TODAY" eyebrow in Ember; one Sky primary ("Set today's goal"); "Review it" a secondary; Fraunces italic prompt. | `mockups/goals.png` |
| Learned | Fraunces italic prompt; the input in Inter 17 with a Dusk placeholder (never Fraunces); Sky Save (Haze and Dusk when empty); stat tiles in Paper. | `mockups/learned.png` |
| Plan | Week / Month segmented in Sky; "Your plan" hero card with the sunrise glow; the morning timeline in the easy tone (Lagoon) with Night Ink nodes and a Sunrise live node; session cards with Haze icon tiles and the tone on the glyph only; the Today tag in Ember on Paper. | `mockups/plan.png` |
| Progress | Sky segmented; the hero stat in Inter 650 tnum (it changes); the ruler, the week horizon of half-suns and the line chart per 6.8 with the Sunrise now dot and Ember NOW label; empty state per 6.11. | `mockups/progress.png` |
| Journal | No Entries / Library switch (owner request); the Remember when card with its quote inside the Haze wash header; Sky segmented (Week / Month) in the calendar card; calendar with the shown day ringed in Sky; entry marks as flat discs carrying their count as a numeral (Haze ringed with "1", `--entry-2` `#7FCBF3` with "2", Sky with "3+", Deep Sky for a Favorite), so the count is never lightness alone; no glossy Orbs. | `mockups/journal.png` |
| The assistant | Per 6.12. | `mockups/assistant.png` |
| Settings | Dawn wash on the pushed page header; Fraunces group titles at the card-title size (22/28); inset groups with Haze icon tiles; Deep Sky values where they are links. | `mockups/settings.png` |
| Onboarding and welcome | The horizontal lockup at the top (outlined wordmark, the flat-Orb file at this size, never live caps); Fraunces 700 hero at `--fs-hero`; the sample card's line in Fraunces italic Night Ink and its session name at `--fs-stamp`; sample card in Paper; Sunrise live node; Sky "Next" with Ink words; Deep Sky "I have an account"; Apricot sunrise glow at the bottom. | `mockups/welcome.png` |
| Splash | Dawn-to-sunrise ground with the poster's three hills as the horizon; the outlined wordmark 150 pt wide and "One good day at a time." in Fraunces italic Dusk (6.52 on the splash sky) in the sky; the 96 px Orb risen over the hills, staged per 8.3; a caption on the far hill in White (5.66 on Deep Sky) that follows the time of day: "GOOD MORNING" before 12:00, "GOOD AFTERNOON" from 12:00 to 17:00, "GOOD EVENING" after 17:00. Native splash: the still Orb centered on Cloud `#EAF5FC`; `capacitor.config.ts` `backgroundColor`, `theme-color` in `index.html` and the manifest become `#EAF5FC` (they are `#f3f8fb` today). | `mockups/splash.png`, `splash-evening.png` |
| App icon | Replace `AppIcon-512@2x.png` with `assets/app-icon-1024.png`; dark and tinted variants in the asset catalog; replace the stale `apps/web/assets/*.png` and `public/icons/icon.svg` (they still hold the v2 ring-and-check) so `@capacitor/assets` cannot ship the old mark. | `assets/app-icon-homescreen.png` |

### 12.2 Token migration map

Full list with old values in `tokens.css` comments. The headline moves:

| Old token (value) | New value | Note |
|---|---|---|
| `--bg` `#f3f8fb` | Cloud `#EAF5FC` | Plus `--dawn` on tab roots. |
| `--surface` `#ffffff` | Paper `#FFFDF8` | |
| `--ink` `#0f2a44` | Night Ink `#0E2236` | |
| `--ink-2` `#2f5d85` | Dusk `#46596D` | Secondary text stops being blue. |
| `--ink-3`, `--ink-4` `#57718a` | Dusk `#46596D` | |
| `--columbia`, `--columbia-wash` | Haze, Cloud | Rename uses to `--haze`, `--cloud`. |
| `--accent` `#f2600c` | Sky `#38B6F2` | Lit things are Sky. Orange moves to `--now`. Audit every `--accent` use: if it marks now, change it to `--now`. |
| `--accent-text` `#c2410c` | Deep Sky `#0A6CA6` | Orange words become `--now-text` (Ember). |
| `--primary` `#0f2a44` / `--primary-ink` `#fff` | Sky / Night Ink | The navy pill becomes a Sky pill with Ink words (7.03). |
| `--navy-pill`, `--navy-glow`, `--pearl`, `--bevel-hi` | Retired | Delete uses; the craft layer goes. |
| `--serif`, `--display` Instrument Serif | Fraunces | Instrument Serif italic titles become Fraunces 650 roman; italic sentences become Fraunces italic 420. |
| `--t-*` session tones | Data tones (3.1) | `--t-hard` leaves orange. |
| `--sun`, `--mint`, `--coral`, `--sky` (feel) | Apricot, Lagoon, Rose, Sky | |
| `--r-card` 22, `--r-control` 12, `--r-icon` 10, `--r-chip` 16, `--r-sm` 8 | 24, 14, 12, 18, 12 | |
| `--section` 28 | 32 | |
| Hard-coded `#f26522` (Orb heart, gauge, glows) | Gone | One orange: `#F2600C`. |

### 12.3 Migration order for builders

1. **Tokens.** Merge the `:root` block of `docs/brand/tokens.css` into `apps/web/src/styles/tokens.css`: change the values of names that exist, add the new names, and keep every live token the brand file lists as kept (`--safe-t`, `--safe-b`, `--kb`, `--maxw`, `--sp-group`, `--sp-secondary`, `--dpager-gap`, `--dur-ring`, `--j-ink-soft`, the `--tag-*` set read as `var(--tag-${c})` in `features/todos/colors.tsx`). Do not replace the block wholesale. Add the Increase Contrast block and the `html` axes rule. Delete the depth overrides in `styles/craft.css`. Run `pnpm test` (contrast and style checks).
2. **Fonts.** In `apps/web/public/fonts/fonts.css`: add the Fraunces roman and italic faces at `font-weight: 100 900`, change both Inter Tight faces from `700 900` to `100 900`, add `Fraunces Fallback` with the metrics in 4.1, add the Fraunces roman to the preload list in `vite.config.ts`, and remove Instrument Serif. Copy the OFL texts.
3. **The name.** `CFBundleDisplayName` "Orby", `Info.plist` usage strings, `index.html` title and `apple-mobile-web-app-title`, `capacitor.config.ts` `appName`, manifest `name` and `short_name`, `BrandSplash.tsx`, onboarding, the assistant disclaimer, Settings, and every other visible "Logbook" (54 files in `apps/web/src` today: `grep -rln "Logbook" apps/web/src`; also check `apps/api` for emails, push text and disclaimers, and `packages/shared`). Leave identifiers alone (2.6), including the `LogbookAPIHost` key.
4. **The Orb.** Render the Orb from `assets/logo-mark.svg` and `logo-mark-thinking.svg` (2.1, "Rendering in the app"), animate breath and orbit with CSS transforms, keep the shared loop in `ui/orbPaint.ts` and the idle, think and still states, add the size tiers. Ship the app icon, dark and tinted variants and the native splash; replace the stale source art.
5. **Chrome.** Dock and capsule (6.1), nav bar and week strip (6.7, 6.14), the dawn wash, the title-line sunrise and the sticky bars (5.3).
6. **Primitives.** Buttons, segmented controls, chips, cards, inset groups, sheets, toasts, fields, focus, switches, checkboxes, menus, skeletons (6.2 to 6.4, 6.9, 6.10, 6.14).
7. **Today's hero.** The gauge per 6.5 (retire the gradient in `HeroGauge.tsx`), habit tiles per 6.6, the rest of Today per 6.13.
8. **Screens.** Goals, Learned, Plan, Progress (charts and the week horizon per 6.8), Journal, the assistant, Settings, onboarding, in that order. Compare each to its mockup.
9. **Drift.** Remove raw hex, literal navy and orange rgba, ad hoc radii, off-step spacing and extra caps trackings (see 13) until `node apps/web/scripts/check-brand.mjs` reports 0, then add it to `pnpm test`. `mockups/override.css` lists the class-level changes that tokens alone do not reach; implement them in the component sheets, never by copying its `!important` rules.

---

## 13. Checklist before finishing any UI change

Run all of it. A change is not done until every line is true. Lines marked (runtime) need the app running: `node docs/brand/tools/audit.mjs <url>` checks them; a rule you could not run is reported as unverified, never as passed.

- [ ] Every color, radius, spacing, duration and font comes from a token in `tokens.css`. `node apps/web/scripts/check-brand.mjs <changed files>` adds no findings.
- [ ] Every text and ground pairing is in 3.2. `pnpm test` passes (contrast and px-font checks). (runtime: the audit checks each text element against its effective ground)
- [ ] No Sky text on light grounds, no white on Sky, no Sunrise text.
- [ ] At most 3 Sunrise elements on the screen (3.5 priority), each with a Paper keyline of at least 2 px (the gauge pointer 3.5); no orange button, fill, selected state, series or session kind. (runtime)
- [ ] One Orb at most, and it is the assistant's (or the splash); its size follows the tiers (48+ full, 28 to 47 gloss, under 28 flat). (runtime)
- [ ] One hero card and one sunrise glow at most. (runtime)
- [ ] Fraunces only in titles, card titles, sentences and one static hero stat; never in buttons, tabs, chips, inputs, coins or live numbers. Weights 600 to 700 roman, 420 italic. No `font-variation-settings` outside the `html` rule. At most 4 Fraunces and 5 Inter sizes. (runtime)
- [ ] Live numbers are Inter with `tabular-nums` ("1111" and "0000" match widths). Gauges print their readout. (runtime)
- [ ] Radii are 24, 18, 14, 12, pill or circle. Spacing is on the steps or a named exception (5.1). Gutter 16.
- [ ] Captions: Inter Tight 600, caps, +0.14 em, one per card, 4 words at most.
- [ ] Icons: 1.75 stroke, round caps, from the set or rule-abiding Lucide; no emoji; the Progress glyph is the set's.
- [ ] Copy: Orby (capital O, no "the", no "app"), "the assistant", American spelling, no em dashes, no model names outside required disclosures, at most one exclamation mark, sentence case.
- [ ] Tested at 200 percent text, with Reduce Motion and Increase Contrast on; targets 44 pt. (runtime)
- [ ] Only transform and opacity animate, plus the named cases in 9.1; durations match section 9; haptics fire on the peak frame, at most one per action.
- [ ] Third-party marks (6.15) are unmodified and marked `brand-ok: third-party`.
- [ ] The checks in section 8 of `docs/brand/layout-and-hierarchy.md` pass (squint test, 3-second test, focal point high, proximity, type counts, containers, say it once, targets).
- [ ] Internal identifiers unchanged (repo, `@logbook/*`, `com.joshbean.logbook`, storage keys, `LogbookAPIHost`).
- [ ] A screenshot at 390 x 844 sits next to its mockup in `docs/brand/mockups/` without a visible difference in palette, type or shape.

### 13.1 The brand agent

The checklist has a reviewer: the **brand-guardian** agent, `.claude/agents/brand-guardian.md`.

| What | Detail |
|---|---|
| What it reads | This guide, `docs/brand/tokens.css` and `tokens.json`, and the change: `git diff` over `apps/web`, `apps/api`, `packages/shared`, `index.html`, `capacitor.config.ts`, `Info.plist` and the web manifest, plus untracked files there. |
| What it runs | `apps/web/scripts/check-brand.mjs` and `check-styles.mjs` on the changed files, `check-contrast.mjs` when tokens change, the copy greps, and, when a dev server URL is given, `docs/brand/tools/audit.mjs` on the changed screens. |
| When to run it | Before calling any change to UI, styles, copy, icons or assets done (`CLAUDE.md` requires it), and to ask which tokens a new part should use before building it. |
| What it returns | PASS or FAIL with file, line, rule (with this guide's section) and fix for each violation; questions where this guide is silent; and a list of runtime rules it could not verify. It never edits files. |
