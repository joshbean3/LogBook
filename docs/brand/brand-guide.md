# Orby brand guide

**Direction:** Sunrise optimism. **Version:** 1.4, November 13, 2026 (the Orb family and the dome: change C35; Orbs, the earned reward: change C34; layout and hierarchy, every change listed at the top of `docs/brand/layout-and-hierarchy.md`). **Status:** the source of truth for every visible part of Orby.

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

**One assistant Orb per screen. The Orb is the assistant's glossy Sky sphere, and the mark. Earned Orbs are a family: the logo's own form (the gloss, the light at the top, the warm underlight, the thin edge) in the family's other hues and styles, never Sky. They live only in the reward layer, the dome, the legend and today's lines.** 2.1 specifies the sphere, and "The family" at the end of 2.1 specifies the earned Orbs.

### 2.1 The Orb, the mark

A glossy sky-blue sphere lit by a sunrise from below. It reads blue first. The top highlight stays cool white. A soft Apricot underlight sits on the lower hemisphere, as if the sun is just under the horizon. Subtle: it is light on a blue sphere, never a two-tone ball. The one warmer drawing is the splash's sunrise state (below), where the Orb is the sun: still blue first, its warm light in the lower third.

Sheet: `assets/orb-states.png` (idle, thinking and still; the sunrise state is `assets/logo-mark-sunrise-1024.png`). Files: `assets/logo-mark.svg` (and `-1024.png`), `logo-mark-glow.svg`, `logo-mark-thinking.svg`, `logo-mark-sunrise.svg`, `logo-mark-flat.svg`, `logo-mark-mono-ink.svg`. Generator: `tools/orb.mjs`.

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
| Idle | Breath: scale 1 to 1.015 and back, 4 s loop. 48 px and up only. | Assistant empty state. On the splash the sunrise state breathes the same way at rest. |
| Thinking | The underlight warms (the values above), the glow widens, a 1.8-unit `--orb-arc` `#FF9F5A` arc (about 14% of the circle) orbits a faint Sky ring at 116% diameter, one turn per 1.2 s, on a 4-unit Paper keyline. The arc and ring are decorative (2.0:1 and 1.3:1 on Paper): the status line ("Reading your week") is the accessible signal, and it is required. The arc is Orb light, not a Sunrise mark: it does not count toward the orange budget. | While the assistant works. |
| Still | One frame. | Every Orb under 48 px (the ask bar, the plan builder's pill, the fold button), Reduce Motion, static art. |
| Sunrise | The sun is up behind it: warm light fills its lower third and wraps its lower edge. The body, the cool white specular and the upper edge are the idle Orb's. Recipe below. | The splash only (9.2, 12.1), where the Orb is the sun. Never in the app, the icon or a lockup. |

**The sunrise state** (the splash only; `tools/orb.mjs` exports the numbers as `ORB.sunrise`). It replaces the underlight and the inner glow with four layers, all clipped to the sphere, drawn in this order over the body and the sky bounce:

| Layer | Spec |
|---|---|
| Pale light | Radial at (50, 104), radius 66, stretched 1.5 x wide: `#FFF1E4` 0.9 (offset 0), `#FFF1E4` 0.85 (0.6), `#F4F9FD` 0.45 (0.8), `#D6F1FE` 0 (1). It sits under the warm light and stays nearly opaque where the warm light fades, so the blue passes through pale to warm and never through grey. |
| Warm light | Radial at (50, 106), radius 50, stretched 1.6 x wide: `#FFA868` 0.95 (0), `#FFB680` 0.8 (0.4), `#FFC9A2` 0.45 (0.7), `#FFE3CB` 0 (1). A dome of light in the lower third, no edge. |
| Limb glow | The sphere less a circle of radius 42.7 at (50, 41.5), filled with a vertical fade from y 56 to y 98 (`#FFE3CB` 0, `#FFC9A2` 0.5 at 0.3, `#FFA868` 0.85 at 0.62, `#FF9F5A` 1), blurred 3.6 units: thick at the bottom, gone above the middle of the sphere. The sun is behind and below the sphere, so its light wraps the lower edge. |
| Core | Radial at (50, 100), radius 24, stretched 1.9 x wide: `#FFF1E4` 0.75, `#FFE3CB` 0.4 (0.5), 0 (1). The brightest point, at the very bottom. |
| Edge | As idle on top (`#0A5E92` 35%, 24% at 45% down), turning to Ember `#B4430C` at 20% (75% down) and 30% (bottom), so the silhouette holds on the warm sky. |
| Glow | Apricot ellipse under the sphere at (50, 76), 68 x 42 radii, `#FFB680` 72% to 0. |

It is still light on a blue sphere: the upper two thirds stay Sky, the highlight stays cool white, and nothing in it is a flat band or a grey seam (a mid-tone grey, CIELAB chroma under 10, covers about 1.5 percent of the disc on the splash sky, less than the idle Orb's 4). On the splash it is never switched on: its pale light alone (`apps/web/src/ui/orb/logo-mark-sunrise-pale.svg`, `orbSVG(96, { state: 'sunrise', pale: true })`: the pale layer, the sky bounce, the specular and the idle edge) fades in over the blue Orb first, then the whole state over that, as the Orb climbs (9.2). Blue goes to pale, then pale to warm: no frame mixes blue with orange, which reads grey.

**Size tiers** (the assistant's Orb; checkable by measuring the rendered diameter; tokens `--orb-full-min`, `--orb-gloss-min`, `--orb-flat-max`):

| Diameter | Render |
|---|---|
| 48 px and up | Full Orb with the Apricot glow. May breathe. |
| 28 to 47 px | Gloss, no glow, still. The thinking arc is fixed at 6 px out with a 1.5 px Paper keyline. The ask bar (28 px), the plan builder's pill (28 px, 6.16) and the Orb inside the 48 px fold button (28 px, `--orb-fold`) are this tier. |
| Under 28 px (27 and under) | Flat Sky `#38B6F2` disc. No gloss, no glow. |

These tiers are the assistant's. An earned Orb has art of its own, drawn to hold from 12 pt up (the family, below).

**On dark grounds** (Twilight, Night Ink) the sphere is unchanged and the glow drops to 22% with a screen blend (at 50% Apricot turns grey-brown on navy). **In one color** (print, embossing, a single-ink job) the mark is a flat disc in Sky, Night Ink or Paper.

| Do | Don't |
|---|---|
| One assistant Orb per screen. | Two of the assistant's Orb on one screen, or the assistant's Orb as a habit coin, a bullet, a reward or a decoration. |
| An earned Orb from the family (below), only where the family lives: the reward layer, the dome, the legend, today's lines. | An earned Orb in Sky; a hue or a style the family's table does not hold; an earned Orb as a bullet, a tab badge or a decoration. |
| Blue first, warm light at the bottom only, soft (the splash's sunrise state reaches the lower third and no higher). | Orange in the body, a half-orange ball, a hard peach band. |
| Use the 28 px gloss in the ask bar. | The assistant's gloss at 22 px (its art turns to mush). |
| Flat disc under 28 px for the assistant's Orb. | Shrinking the assistant's gloss art below 28 px. Under 28 px the only gloss is an earned Orb's. |

**The family** (the earned Orbs; `apps/web/src/features/orbs/gems`: `gemFor`, `gemSvg`, `gemName` and the one component `OrbGem`; never a variant of the assistant's `Orb`). People earn Orbs for what they finish. An earned Orb is the logo's sibling: the same sphere under the same light, in another hue, with the mark of its kind. What was finished decides which.

| What earned it | Hue (token) | Style | Worth |
|---|---|---|---|
| A to-do | Lagoon (`--t-easy`) | plain | 1 |
| A habit | Apricot (`--apricot`) | plain | 1 |
| A run | Deep Sky (`--deep-sky`) | plain | 3, or 2 at its floor |
| A lift | Indigo (`--t-lift`) | plain | 3 or 2 |
| Cross-training | Ochre (`--t-cross`) | plain | 3 or 2 |
| Today's goal | Gold (Marigold, `--warn`) | one ring | 3 |
| A week goal | Gold | one ring | 9 |
| A month goal | Gold | two rings | 30 |
| A year goal | Gold | three rings | 90 |
| A full day | Pearl (`--paper` to `--haze`, an opal: Rose on one limb, Lagoon on the other) | plain, with a soft Apricot halo | 5 |
| A week that counts | Dusk (a `--twilight` body; the hue's name here, not the text color) | banded: three Apricot bands | 5 to 20 |
| A challenge | Plum (`--t-hard`) | half-lit: a terminator, like a moon | 5 to 20 |
| A return | Rose (`--t-fast`) | plain | 3 |
| An earlier week, fused (the dome, 9.2) | Night (`--twilight` to `--night-ink`) | starred: up to 7 star points, one per day that counted | the week's total |
| An earlier chapter, fused | Night | starred, with one Apricot ring | its total |
| An earlier year, fused | Night | starred, with two Apricot rings | its total |

| Part | Spec |
|---|---|
| Form | The logo's recipe in the logo's box (100 units, sphere radius 48): the body's radial gradient lit from the top, the pale bounce and the warm underlight from below, the blurred glow along the lower limb, the soft specular at (50, 22), the 0.8-unit edge. The same centers, radii, blurs and opacities as the recipe above. That shared light is what makes them a family. |
| Color | One function (`sphereOf` in `gems/svg.ts`) derives every stop from the hue's token, in OKLab: three tints toward the light that keep their hue (a mix with white goes milky), the body's color at 60 percent, two deeper stops, the edge. A deep text token is lifted 3 to 10 percent toward white so it reads as glass. No stop is typed as a hex in a component: the token values are written once in `gems/table.ts`, and a test holds them to `tokens.css`. |
| Underlight | Apricot, as on the logo. On a warm body (Apricot, Gold, Ochre, Pearl, Rose) it moves toward Paper, so it still shows. |
| Never Sky | No earned Orb has the logo's Sky body: that sphere is the assistant and the mark. A run's Deep Sky is visibly darker than Sky. |
| Its own shift | An Orb may carry a small shift from its own seed (kind, date, index): one of five steps, at most 7 degrees of hue and 3 percent of lightness, so a pile of forty habits is not one disc forty times. Small enough that a habit never reads as a goal. |
| Marks | Rings are tilted 18 degrees, behind the sphere at the top and across it at the bottom, and reach outside it. Bands, the terminator and the star points lie on the sphere, under the gloss. Pearl's halo reaches 1.46 times the sphere's diameter. |
| Hue is never alone | A style, a size, a caption on tap, the legend on How Orbs work and VoiceOver's words always say the kind too (3.3, 11). The plain kinds differ by hue, and always stand with words or with their size in the dome. |
| Sizes | The size is the sphere's diameter; rings and the halo are drawn outside it and take no room. 20 pt at birth, 12 pt as it lands; three at once are 18 pt each (9.2). 22 pt in the legend and today's lines (a session's three kinds 14 pt). 16 pt on the "Full day +5" chip. In the dome, by worth. |
| Where | The reward layer (at the control that earned it, on its way to the counter, on the "Full day +5" chip, which carries the Pearl, and beside the paid line of a big moment: 9.2); the dome on the Orbs page (8.5, 9.2); the legend on How Orbs work; today's lines. Nowhere else: never a bullet, a badge on a tab, a list marker or a decoration. |
| Rendering | One SVG document per Orb, under 4 KB, with no script, no font and nothing fetched. It is drawn as an image, or rasterized once per size as a sprite for the dome's canvas (9.1). Never repainted per frame. |
| Color rule | The family's hues are not Sunrise and do not count toward its budget (3.5). This is the one place a data tone is a surface (3.1). Marigold here is a goal's gold, not a warning: a warning is always a glyph and words (3.3). |
| VoiceOver | Hidden where words beside it name the kind. Named where it stands alone: "A habit", "Today's goal" (10.2). |

**The keepsake's light** (`apps/web/src/ui/OrbLight.tsx`). The Apricot light the first Orbs were drawn as keeps one job: the glow behind the newest keepsake (8.5). An `--apricot` core lit from its own center, a soft halo 1.8 times the core (26 percent at the core's edge, fading to nothing), a 1 px Ember edge at 30 percent, 48 pt. It is light behind a disc: never an earned Orb, never a mark of its own.

Rewards are in the brand's own light: no confetti, no mascots, no chance imagery, no loss framing. Nothing about Orbs shows a zero, a "best", days in a row, anything that ended, or a worth on a goal. No bonus and no challenge is shown as nearly earned (never "1 away", never "almost a full day"); the distance to the next level is plain progress and is shown. A habit's own sheet may still count its days in a row: that is the habit's fact, and it is never set beside a higher number it once reached.

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

Use the horizontal lockup in headers (sign in, the site). The welcome pager shows the ask bar with its Orb under the posters, so its header is the wordmark alone (the next rule). Where the art already has its own Orb (a hero render, a screen with the ask bar), use the wordmark alone, so one frame never shows two Orbs side by side. Use the stacked lockup on store art and anything taller than wide.

### 2.4 Clear space and minimum sizes

- **Clear space:** C (the cap height) on every side of any lockup or the wordmark. Nothing enters it: no text, no edge, no other mark.
- **Minimum sizes on screen (width):** horizontal 96 pt, stacked 56 pt, wordmark 64 pt, gloss Orb 28 pt, flat Orb 16 pt.
- **Minimum in print:** horizontal 25 mm, stacked 15 mm, wordmark 17 mm. Below these, use the flat Orb alone.
- **In the app header** (sign in; the welcome pager uses the wordmark alone in the same 34 pt box, 75 wide): the horizontal lockup at 24 pt cap height: wordmark box 34 pt tall, the Orb 15.4 pt (x-height; under 28 px, so use `lockup-horizontal-flat-ink.svg`, where the Orb is the flat Sky disc), gap 8.4 pt (0.35 C). No separate header variant: any lockup whose Orb renders under 28 px uses the flat file.

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
| What is earned is "Orbs": plural, or with a number. "The Orb" is the assistant's mark. | "9 Orbs", "1 Orb", "How Orbs work" | "the Orb" for a reward, points, coins, XP |

**What does not change.** Internal identifiers keep the old name: the repository (`LogBook`), package names (`@logbook/*`), the bundle id `com.joshbean.logbook`, storage keys, database names, code names, the `Info.plist` key `LogbookAPIHost`, and file names such as `LogbookViewController.swift`. Never rename these as part of a brand change; renaming them breaks installs and sync. Everything a person can see says Orby: the Home Screen label, `index.html` title and `apple-mobile-web-app-title`, `capacitor.config.ts` `appName`, the web manifest `name` and `short_name`, permission prompts in `Info.plist` (for example the Apple Health usage string), the splash, onboarding, Settings, the assistant's disclaimers, emails and share cards.

### 2.7 What never to do

Sheet: `assets/logo-donts.png`. Never: stretch or squash; retype the name in another face; swap the O for the Orb; set the name in caps; recolor the Orb; make a two-tone ball (the splash's sunrise state, 2.1, is the one warmer drawing, and it stays blue first); show two of the assistant's Orb on one screen; use the assistant's Orb as a reward; draw an earned Orb in Sky, or in a hue or a style the family does not hold (2.1); put the logo on a busy or clashing ground; give the Orb a face; add drop shadows or bevels; grey or tint the wordmark; change the spacing; rotate or tilt; say "the Orby" or "Orby app"; box the logo or add rules around it.

---

## 3. Color

Sheet: `assets/palette.png`. All ratios are WCAG 2.x relative luminance contrast. Body text needs 4.5:1; large text (24 px regular or 18.66 px bold and up) and non-text graphics need 3:1.

### 3.1 The palette

| Name | Hex | Token | Role |
|---|---|---|---|
| Sky | `#38B6F2` | `--sky`, `--accent`, `--primary` | The signature fill: the Orb, selected day, active tab disc, primary button, selected segment, lit habit coin. A fill and a mark, never text on light grounds. |
| Deep Sky | `#0A6CA6` | `--deep-sky`, `--accent-text` | Blue words and links, the band and the done marks of Today's hero, done dots, the far hill. |
| Haze | `#CBE8F8` | `--haze`, `--surface-3` | Tracks, icon tiles, the top of the dawn wash, chart tints. |
| Cloud | `#EAF5FC` | `--cloud`, `--bg` | The app ground, segmented tracks. |
| Paper | `#FFFDF8` | `--paper`, `--surface` | Cards, sheets, the ask bar, the tab capsule. A barely warm white. |
| Linen | `#F6F0E5` | `--linen` | Brand paper only (splash variant, store art, share cards, decks). Never app chrome. |
| Night Ink | `#0E2236` | `--night-ink`, `--ink` | All primary text, the wordmark. |
| Dusk | `#46596D` | `--dusk`, `--ink-2/3/4` | Muted text, captions, metadata. The lightest neutral text color (Deep Sky and Ember are lighter, and allowed as colored text). |
| Twilight | `#1B4870` | `--twilight` | Dark brand ground (night splash, dark icon, deck section slides). |
| Sunrise | `#F2600C` | `--sunrise`, `--now` | The accent and the now-mark. Kept from today's brand; it moves from lead to accent. |
| Apricot | `#FFB680` | `--apricot`, `--sun` | Light, not ink: the Orb's underlight, the hero glow, the horizon, a habit's Orb and the keepsake's light (2.1). |
| Ember | `#B4430C` | `--ember`, `--now-text` | Orange words, rare: a Today tag, the "Next" tag on a path. Also the 1 px edge of the keepsake's light, at 30 percent (2.1). |

Support colors (refinements, each added for a contrast or role need):

| Name | Hex | Why it exists |
|---|---|---|
| Graphite | `#33475B` | Dusk under Increase Contrast (9.42 on Paper). |
| Deep Sky IC | `#085A8C` | Deep Sky under Increase Contrast (7.24 on Paper) and for body text on Haze (5.76), where Deep Sky is 4.43. |
| Pencil | `#7A8794` | Non-text marks (ticks, faint dots): 3.61 on Paper, 2.87 on Haze (never a meaningful mark on Haze). Never text. IC step `#5F6D7B` (5.22 on Paper, 4.15 on Haze): use it for the rest glyph in a Haze session tile. |
| Marigold / Warn text | `#E0A21B` / `#7A5A00` | Warning mark and its words (6.28 on Paper). The Marigold mark is 2.21 on Paper, so a warning always pairs it with a glyph and words. Marigold is also the gold of a goal's Orb (2.1), which is never a warning. |
| Signal | `#B42340` | Errors and destructive words (6.35 on Paper). |
| Data tones | Lagoon `#117A74`, Deep Sky `#0A6CA6`, Plum `#7E3F8F`, Rose `#B23A5B`, Indigo `#4A4FB0`, Ochre `#7D6210`, Pencil `#7A8794` | Session kinds (easy, long, hard, fast, lift, cross, rest). Glyphs, lines and 3 px markers only; never a surface or a tinted card (the one exception: the body of an earned Orb, 2.1). Each is 5.0:1 or better on Paper except Pencil (marks only). Hard moved off orange so orange keeps one meaning. |
| Brand art | Poster sky `#8DD0F5`, `#AEDDF8`, `#CFEBFA`; horizon `#F4E6D2`, `#FFD2AE`; hills `#8FCDEE`, `#4FA9DB`, `#0A6CA6` | Posters, heroes, the icon. Not app chrome. |
| App washes | `--wash-bar` `#D0EAF8`, `--wash-strip` `#DAEEFA`, `--wash-strip-end` `#E2F2FB`, `--welcome-warm` `#FFF1E4`, `--entry-2` `#7FCBF3`, `--orb-arc` `#FF9F5A` | Sticky bars and strip, the splash ground (the welcome screens stand on the dawn wash, as the tabs do), journal two-entry disc, the thinking arc. Tokens only. |
| Splash lights | `--splash-day`, `--splash-glow`, `--splash-halo`, `--splash-bloom`, `--splash-ring` | The sunrise splash (9.2). `--splash-day` is the day's colors as one layer: poster sky `#8DD0F5` to `#AEDDF8` over the top 28 percent, and the horizon band `#F4E6D2` to `#FFD2AE` from 48 to 88 percent, with nothing between them. The other three are its soft lights: Apricot `#FFB680` radial falloffs (the bloom starts from `#FFF1E4`). `--splash-ring` is the soft Apricot band just inside each sun ring's white line (8.3). Each is drawn once and only faded or scaled. Brand art, not app chrome. |

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
| Deep Sky | Cloud | 5.11 | Body; also Try again on the splash sky above its warm band (measured 4.86 to 5.11; the column rises to stay there, 9.2) |
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

**Decorative marks** (under 3:1 by design; the meaning is carried elsewhere, so each must stay decorative): the way's dots and the sun's place on Today's hero `--tick-major` (the band carries the value), the dusk scene's stars and rim, the dot for an empty day ahead on the Progress chart (`--tick`, 1.57; the headline says "Nothing planned" when it is read), the off habit coin ring `--coin-ring` (1.80; the name and the check carry the state), the off filter chip edge `--line-strong` (1.44; the label carries the state), the thinking arc and its ring (the status line carries it), an earned Orb's hue and the keepsake's light (Apricot on Paper is about 1.7:1 and Pearl is less; the Orb's style, the words or the numeral beside it, its caption in the dome, or the keepsake's own numeral or glyph carries the meaning). **Meaningful marks under 3:1 are not allowed:** the rest glyph in a Haze tile uses `#5F6D7B` (4.15), not Pencil (2.87); journal entry discs carry the count as a numeral inside the disc (1, 2, 3+), not by lightness alone; a warning pairs the Marigold mark with a glyph and words.

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
2. **The week's sun:** a 30 px disc on Today's hero, at the count the card shows (runs done of runs on the week, or workouts), 3.5 px Paper keyline (on the Progress chart, in Fitness, the equivalent is the chart's now dot).
3. **The badge dot:** 8 px, 2 px Paper keyline, top right of a tab icon or the ask bar.
4. **The milestone stamp:** one round stamp per screen at most (section 8.4).
5. **The live node** on a timeline (the current step), 12 px with a Paper keyline.
6. **Now on a chart:** the now dot (8 px): on the latest point of a line, on the bucket holding today in the Progress bars.

**Budget:** at most 3 Sunrise elements visible on one screen. Ember carries orange words (a Today tag, the "Next" tag) and does not count. Apricot is light (glows, the Orb's underlight, a habit's Orb and the keepsake's light of 2.1) and does not count, and no hue of the Orb family is Sunrise; nor does the thinking arc `#FF9F5A`, which is Orb light. Orange never fills a button, a card, a selected state, a done state, a session kind or a chart series.

**Priority when more than 3 would show** (highest first; what is past the third yields):

1. Today's dot in the week strip.
2. The week's sun, then the Progress chart's now dot (Fitness shows both: the card's sun first).
3. The live node on a timeline.
4. The milestone stamp.
5. Badge dots.

A yielding mark keeps its shape and turns Night Ink with its Paper keyline: a badge dot becomes an 8 px Night Ink dot; the morning line's live node becomes a Night Ink node while the week's sun is on screen. One exception: the week's sun yields to Apricot, keyline kept; a Night Ink sun reads as an eclipse, and Apricot is light, not a Sunrise mark. Today on Today: today's dot, the week's sun and one badge; every other badge is Night Ink.

**Dusk:** on a day with no run and no workout Today's hero is a dusk scene. Its setting sun is an Apricot disc with no keyline. It is light, not a now-mark: it does not count toward the budget and nothing yields to it. That day the morning line's live node, when it shows, is Sunrise.

**Keylines:** every Sunrise mark has a Paper keyline of at least 2 px (`--now-keyline`). The named exceptions are larger: the week's sun 3.5 px, the stamp `max(2px, 3.3%)` of its diameter.

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
| **Inter Tight** (variable) | Captions (600, caps). Nothing else. | Self-hosted today in `apps/web/public/fonts/`; also in `docs/brand/fonts/` | SIL OFL 1.1. `fonts/InterTight-OFL.txt` |

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
| Hero (held in reserve: no screen sets it now; onboarding's largest line is the page title, `--fs-title`) | Fraunces | 3.5 / 3.5 rem (56/56) | 700 | -0.02 em | Night Ink | `--fs-hero` |
| Screen title (Today, Goals...) | Fraunces | 2.375 / 2.625 rem (38/42) | 650 | -0.015 em | Night Ink | `--fs-title` |
| Session name in Today's hero | Fraunces | 2.5 / 2.625 rem (40/42), left aligned; 1.875 / 2.125 rem when it does not fit one line | 650 | -0.015 em | Night Ink | `--fs-stamp` |
| Poster title (the card a redesigned screen leads with) | Fraunces | 2 / 2.25 rem (32/36), two lines allowed; 1.875 / 2.125 rem when it is the person's own goal | 650 | -0.015 em | Night Ink; Paper at dusk | `--fs-poster`, `--fs-poster-goal` |
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

Inter Tight 600, 11 px floor, uppercase, tracking +0.14 em (the only caps tracking in the system), Night Ink or Dusk. At most one caption per card, at most 4 words, no period. Use it for eyebrows ("TODAY'S LIFT"), the date line over a tab title ("TUE, NOV 10"), the label on Today's hero band ("RUNS THIS WEEK") and brand-art captions.

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
| The title-line sunrise (tab roots) | The one brand signature in app chrome: on each tab root's large title line, a 1 px `--tick` horizon hairline from 58% of the width to the right edge, 9 px above the title's bottom, with a 28 x 14 px Apricot half-sun (`radial-gradient(circle at 50% 100%, #FFE3CB, #FFB680 72%)`) sitting on it, 52 px from the right edge. Tab roots only; hidden when the title collapses. It is light, not a Sunrise mark. On Today, on today's own page only, today's Orbs stand beside it as a numeral (6.13, "Orbs counter"). |
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
| Tab capsule | 56 tall, pill, Paper, `--shadow-float`. Four tabs in this order: Today, Goals, Fitness, Journal. Fitness is what is next and how it is going: Progress is its lower half (a titled section), not a tab. Journal is the one place to write: What I learned is part of it (the day's line), not a tab. With Fitness switched off (Settings) the Fitness tab is not drawn, and the three that remain share the capsule in equal columns. |
| Tab | Icon 22 px, 1.75 stroke, inside a 32 px circle; label Inter `--fs-caps` 550 Dusk. Fitness uses the set's run glyph, never a pulse. Where Progress is drawn as a glyph (a section, a row), it is the set's Progress glyph (a rising line ending in a circle), never a pulse. |
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
| Segmented control | Cloud track, pill; thumb Sky, pill, no shadow; labels Inter 15, Dusk 550 off, Night Ink 650 on. 44 tall in a card, 36 tall in a header bar (44 hit). Thumb slides on the settle spring (300 ms). At most 5 segments, equal widths (the view pill's segments hug their words), text only. The one exception is the Progress range control (1W, 1M, 3M, 6M, YTD, 12M, All): seven segments in one row under the hero chart, 12 px in from the card's edges. |
| View pill (Today's hero) | The segmented control in a small quiet form, on the hero's band. 28 tall (44 hit). Track: Night Ink at 22 percent on Deep Sky, pill. Thumb: Haze, pill, 2 px inset, no shadow. Labels Inter 13: White 550 off, Night Ink 650 on. Two segments, each as wide as its word plus 8 each side, never under 44. It slides on the settle spring. Shown only when both views have something to count. |
| "+ Set", "+ Add" | A quiet link, not a pill: Deep Sky Inter 600 with an 18 px plus (5.57 on Paper, 5.11 on Cloud), 44 hit. "+ Set" on Goals; "+ Add" at the end of the week's line on Plan (a run or a lift for that week). A screen keeps its one Sky primary. |

### 6.4 Cards and the hero card

- **Card:** Paper, r 24, padding 16, `--shadow-1`, no border. One caption at most. One primary action at most. A card holds one unit people read or act on; three or more items of the same kind are one card with hairline rows (an inset group), never a card each (the habit grid is the exception). A screen uses at most three card templates.
- **Hero card:** one per screen. Padding 20. The sunrise glow under its bottom edge (5.3). Holds the screen's main thing: Today's week horizon (its light is on its horizon, not under its edge, and its scene is full-bleed), Goals' today card, Fitness's training card (its Progress chart card, under it, carries no glow). Journal's hero is its dusk poster (6.5a), which carries no glow of its own; its Remember when card is one quiet Paper card under it, with no wash and its quote at `--fs-sentence-sm` 17 (the poster holds the page's one tinted header and its large Fraunces sizes).
- **Icon tile in a row:** 32 px, r 12, Haze, Deep Sky glyph. Session tiles (48 px, r 12): Haze, glyph in the session's data tone. Never a tinted card or a per-feature hue.
- **Inset group (Settings):** Paper card, rows 56 tall (64 with a subtitle), hairlines inset past the icon tile, chevron 18 px Dusk.

### 6.5 The week horizon (Today's hero)

Replaces the U-arc gauge. Built in `features/day/HeroHorizon.tsx` (the drawing) from `heroWeek.ts` (the data, tested); the pick of view is `heroView.ts`.

| Part | Spec |
|---|---|
| The idea | The week is a sunrise. The session name is the headline; under it a sun climbs from the left horizon to its place at the upper right, one step for each run done. The far hill carries the count in words. |
| Scene | Full-bleed in the card. Sky wash Haze to Cloud to Paper. Three hills (`--hill-1`, `--hill-2`, Deep Sky) with a 2 px Paper rim on the near crest. A 358 x 88 drawing that scales with the card. Words and controls keep the 20 px inset. No glow under the card's edge: the horizon is the screen's warm light. |
| Name and line | The session name in Fraunces 650 40/42, left aligned, 30/34 when it does not fit one line (by measure), then two lines. The detail in Inter 15 500 Dusk under it. A face's own words ("Nothing planned") are always 30/34. |
| Sun | The now-mark (3.5 job 2): a flat 30 px Sunrise disc, 3.5 px Paper keyline, on the path `M 38 63 Q 179 22 320 22` at `done / planned` of the view. It yields to Apricot (keyline kept) on another day's page or when the budget is spent. Never the Orb. |
| Marks | One per run (or workout) on the week, evenly spread on the horizon: a Deep Sky ring on a Paper keyline; a Deep Sky disc when done. The first `done` are filled. None past 10. |
| The way | Dots (`--tick-major`) from the sun to its place, and a dotted circle at the place. Decorative. Two Paper rings round the sun when the count is complete. |
| Band (required) | The hero prints what it counts: on the far hill, White on Deep Sky (5.66), the caption "RUNS THIS WEEK" with a chevron, over the count in Inter 650 17 ("2 of 4") and the miles in Inter 400 15 ("9.5 of 15.5 mi"). The miles are the same in both views. It opens the week. |
| View pill | 6.3. Runs, Workouts, at the band's trailing edge, only when both have something to count. The card opens on the view of the day's session; a tap holds for that day page until the next day. Tap only: the day pager is the one horizontal gesture. |
| Dusk | A day with no run and no workout: the same hills after sunset. Sky Night Ink to Twilight to Deep Sky, the last light in Apricot along the horizon (an HTML layer), an Apricot sun setting on the right (not a now-mark), five Paper star dots, hills Twilight and Night Ink, an Apricot rim. Title Paper (Haze on another day), one line under it in Haze: the face's own line, else the next session, else "Add a run or lift" (the Add sheet). The band: "THIS WEEK" and up to three totals in Haze on Night Ink; with none, the bare hill. No marks, no pill, no When control; a rest morning keeps its four-stop line under the hill. No Paper edge round the card (back under Increase Contrast). |
| Motion | 9.1, 9.2. First view of the day: the sun travels from rest on `springs.number`, then the way comes in (6 ms apart, 240 ms cap) and the rings bloom. A switch: the label and count cross-fade, the marks fade out and in, the sun travels. A logged run: the sun steps, the mark fills with the one overshoot. Dusk: the sun sinks 14 px over 900 ms once a day; the light breathes 1 to 0.86 over 8 s while the page is seen and still. Under Reduce Motion nothing travels and nothing breathes. |

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
| Layout | Seven cells, Monday first, sticky under the title bar with the wash color behind it. Seven equal columns across the full width of the screen (each a seventh of it), and everything in a cell is centered on its column. Every cell has the same three rows whatever the day holds: the letter, the numeral, the kind pill's slot. |
| Letter | Caption style, Dusk; today's letter Night Ink. |
| Numeral | Inter 600 1.0625 rem, Night Ink, tnum. |
| Shown day | A 34 px Sky disc behind the numeral (Night Ink on Sky 7.03). It slides on the settle spring. |
| Today | Always keeps its 6 px Sunrise dot above the letter, with a 2 px Paper keyline, whether or not it is the shown day. Today and the shown day are never the same signal. |
| Kind pill | What the day trains. One pill of one size on every day and in every state: 34 wide (the disc's width, so the shown day reads as one column) and 22 tall, centered on the column, 8 px under the numeral's box, which leaves 5 px between the pill and the disc. Glyphs are 13 px: one in the middle, or two side by side in the same pill on a day with two kinds of session (run first). A day with no session, a rest day or a day whose sessions were skipped has no pill and keeps the empty slot, so the row's height never changes. |
| Kind pill fills | One system, and the fill says how much of the day is done. Nothing yet (a day ahead, and today until something on it is done): Paper with a 1 px `rgba(14,34,54,.10)` edge and Dusk glyphs. Part of it (a floor, or one session of two): Haze with Night Ink glyphs. All of it (every session, or a run or lift that was not planned): Sky with Night Ink glyphs. A day that passed with nothing done: the same pill, hollow, a 1 px `--edge` and Dusk glyphs. Today's pill has no style of its own: today is the Sunrise dot, and the shown day is the disc. |
| Hit | Each cell 44 pt wide or more, 83 tall. |

### 6.8 Charts

| Part | Spec |
|---|---|
| The Progress chart (Fitness) | Bars, in every range: one bar per bucket, standing on a 1 px `--tick` horizon baseline. A bucket is a day in 1W, a week in 1M, 3M and 6M, a month in 12M; YTD and All read by week up to 26 weeks and by month after that, and by day while they are under three weeks old. No range draws more than 26 bars, with one exception: an All longer than 26 months keeps reading by month, 12 bars a year (thin and solid Deep Sky once they are under 6 px). Running draws miles run; Strength draws lift sessions done. Both use the same chart, the same ranges and one saved range. Until there is a week before this one with anything in it, the chart is this week by day and the range control waits. |
| Bars | Done: a Sky dome (straight sides under a half ellipse as wide as the bar, the rising disc of 8.5) with a 1.5 px Deep Sky arc over its top, the edge that says the value, so the bar passes 3:1; no border round the bar. A bar under 6 px wide is solid Deep Sky. A bar fills 68 percent of its slot and is never wider than 24 px. Nothing done: a Pencil dot of radius 2 px just over the baseline (`--tick`, decorative, for a day still ahead with nothing planned; none under the now dot). A bucket that has not loaded: a short Pencil dash. 1W draws every day of the week. In a longer range the bars start where the log began, when the app knows where that is (else at the first bucket with anything in it): a week of rest since then is a week, drawn as its dot, and the weeks before the log began are not drawn. |
| Plan | The plan is drawn only for what is still ahead: the days after today (1W), and the rest of the bucket holding today. It is the same dome as a 1.5 px Deep Sky outline, dashed 3 / 3, standing on the shoulders of what is done (its sides start where the done bar's dome does, so no dash runs down the side of a done bar; on the baseline with nothing done), with "Plan" in caption style over the first one: right on the outline, or, where a taller neighbor stands under the label's width, in the band over the bars with a 1 px Dusk hairline down to the outline. History is what was done, and is never two marks. |
| Actual (line) | Metric pages and sheets: 2.5 px Deep Sky line, round joins; area under it Sky at 16 percent. |
| The now dot | 8 px Sunrise (radius 4) with a 2 px Paper keyline drawn on its edge: on the latest point of a line; on top of what is done in the bucket holding today (on the baseline while that bucket is empty). |
| Axes | Caption style, Dusk, tnum. Gridlines 1 px `rgba(14,34,54,.08)`. No chart borders. |
| Series colors | Session kinds use the data tones (3.1). Never orange for a series. Never more than 4 series. |
| Values | Every chart prints its headline number as text above it, in Inter 650 with `tabular-nums` (never Fraunces). |
| Range control | The Progress chart: seven segments (1W, 1M, 3M, 6M, YTD, 12M, All) in one row 12 px below the plot, 12 px in from the card's edges, the segmented control's look (6.3), 44 tall. Default 3M. The headline and takeaway follow the range. The card has the same parts in every range and in both modes, so the control does not move when the range changes. It is absent only in a first week, before there is a range to choose. |
| Labels | Direct labels in caption style, no legend for 4 series or fewer: "Plan" over the first dashed bar. Y labels short, on the trailing side, units in the headline. The hero chart draws 1 to 3 horizontal gridlines on round steps (1, 2, 5, 10, 20, 50 and so on), fitted so its tallest bar stands in the top fifth of the plot: a tallest bar of 1 (a day with one lift session) ends the scale, with the one line at its top. With nothing to draw the lines are 5 and 10 miles, or 1 and 2 sessions. Other charts draw 3 to 5. X labels, always the set that fits without two touching: weekday letters in 1W (today's in Night Ink); weeks by the month they start ("Sep", or initials when every month fits that way), by date in 1M ("Oct 12"); months by name or initial, by year at each January in an All longer than two years; days by date in a YTD or All under three weeks old; and "Now" in Ember under the bucket holding today. |
| Size | A detail plot spans the card's inner width, 160 px tall at 320 pt and 180 px at 390 pt and up. A sparkline in a tile is 32 px tall with no axes, labels or gridlines. |
| Takeaway | One sentence, Inter `--fs-sub` Dusk, 4 px under the headline, says what the chart shows. The hero's says the usual bucket ("18.1 mi a week on average"): the mean of the whole weeks or months that are over, so the week or month the log began in partway, and a first week the range cuts short, do not count (with none to count it says the runs instead: "5 runs"); in 1W it says this week against its plan: "4 mi behind plan this week", "On plan, 14 mi to go", "This week's plan is done". "To go" is what the plan still asks for, the miles the dashed bars draw. A mile or more run that the plan did not ask for is said, so "to go" is never read as the headline's difference: "9.3 of 12.5 mi" over "9.3 mi ahead of plan, 12.5 mi to go". History is not graded against a plan. |
| Reading a bucket | Drag across the plot (a mouse hovers). A 1.5 px Night Ink marker comes down to the bucket under the finger (from under "Plan" where the word stands over that bar, and only when it is 8 px or longer) and ends in a 10 px Paper dot with a 2 px Night Ink ring; that bar turns Deep Sky and the others step back to 70 percent (their Deep Sky arcs keep 3:1); the headline shows the bucket's number, its dates and its runs (or sets), and the bucket holding today reads as "Today", "This week" or "This month" with what its plan still asks for ("This week · 2 runs · 14 mi to go"); one `select` tick per bucket (9.5). Letting go returns to the headline. The headline block keeps its height while a bucket is read, so the plot never moves under the finger. The chart takes a touch only after 6 px of mostly sideways travel or a 180 ms press: a swipe up or down that starts on the plot scrolls the page. The whole plot is one target (a slider, the plot's full height): its bars are not targets of their own, since a slot can be 8 px wide, so the drag is the way to pick a bucket exactly. A tap opens the sheet of the running day or week under the finger; where nothing opens it shows the bucket for 1.6 s. Until the chart has been read once, one line 8 px under the plot (Inter `--fs-sub` Dusk) says how ("Drag across to see each week"); its words fade the moment the chart is read, and its room is given back when the page is next shown. Metric pages and sheets read the same way. |

### 6.9 Sheets

Paper, top corners 24, grabber 36 x 5 pill `rgba(14,34,54,.18)` 8 px from the top. Title Fraunces 600 26/32 (or the card-title size in a compact sheet). Close and secondary actions are 40 px round Paper buttons in the top corners. Scrim `rgba(14,34,54,.32)`. A CSS open runs 500 ms on `--ease-sheet`; a drag release and detent snaps run on `springs.sheet` (0.50 s, bounce 0). One primary button pinned at the bottom, above the safe area. In the New plan sheet the assistant's composer changes this while it is in use (6.16).

### 6.5a The poster kit

The cards the redesigned Today, Goals, Journal and Fitness lead with are built from one kit, `apps/web/src/ui/poster` (shown at `/dev/ui`, "Poster kit"). It reuses the week horizon's landscape (`ui/poster/horizon.ts` holds the geometry for both).

- **Poster.** The training card's anatomy: a Fraunces title (`--fs-poster`, two lines allowed) and a meta line on the sky, a picture, one band of words (White on Deep Sky; on Night Ink at dusk), then the controls on Paper. `full` carries the sun scene; `slim` (under another poster on the same page) carries a strip of the hills and no sun. The dusk ground is the Journal poster's own.
- **The day scene.** The sun stands at done over total along the horizon's way, a mark per item, the dotted way to its place, two rings when all are done. Apricot at rest until the day has its goal, then Sunrise (one now mark).
- **The path.** One line of stops under the band: solid Deep Sky behind the next stop, dotted (`--tick-major`) ahead. A done stop is a filled check with struck words; the next stop is the lit ring (a Sunrise dot with its keyline in an Apricot halo, one now mark), tagged "Next" in Ember on a Cloud row; a stop ahead is an open ring; the line ends at a dashed plus. The line never carries meaning alone: the tag, the check and the struck words do. When the next stop changes, the light moves to it on `springs.settle` (a `--dur-reduce` fade under Reduce Motion).
- **The far hills.** Goals' "Further out": Deep Sky, Middle hill and Near hill blocks toward a pale Apricot sun (not a now mark). White words on the far hill, Night Ink on the other two. Each hill grows with its words.
- **On Goals.** Today's goal is the full poster, in the state Today shows. Nothing set: the question, "Today · 14 h left", one idea in the band with where it came from ("An idea · from yesterday", "from your to-dos", "from Fitness", "from your habits"; never from Fitness with Fitness off), then "Set this goal" (one tap, a toast offers Undo) and a quiet "Something else" (the goal editor). Set: the goal is the title and a tap on it opens the goal's sheet (four lines at most on the card); the sun climbs with the day's to-dos; the band reads "Today · 2 of 3 to-dos done" over "Next: ..." and opens Today; under it one row, "Not done yet" and the 48 pt check, which marks the goal done (Deep Sky when done). On the hills a set goal shows its caption with the time left ("2026 · 50 days left", or its answer) and its steps done ("2 of 5"); only the nearest hill with no goal carries the plus and the invitation ("Set this week's goal", "Set a goal for November"); the other open hills show their name alone. No hill ever says "Not set". The caption "Further out" is a button with a 12 px chevron, as a band's caption is: it opens "Coming up" (tomorrow's goal and next week's). The goal's words arrive once when it is set (the title, or the hill's words: 12 px up and a fade over `--dur`; a `--dur-reduce` fade under Reduce Motion).
- **On the Orbs page.** The page no longer leads with a poster: the dome is its hero (8.5, 9.2, 12.1; layout standard 2.13), and the total and the level live on the dome's console. What the poster carried under its band stays, on Paper under the dome: this week as seven 12 pt marks over their letters, Monday first (a Deep Sky disc with a White check for a day that counts, an open Pencil ring for any other; today's ring and letter are Night Ink until it counts), then one Dusk line of fact ("5 days this week · 128 in all · 6 weeks in a row").
- **The week's lights.** On the dusk poster: a day with a line is an Apricot light, a missed one a small Haze ring, tonight a dotted Paper ring that lights with two rings on save (one scale to 1.12 over `--dur-complete`).
- **Plan your day (Today).** The day's poster. Nothing set: the title asks "What would make today count?", the meta line reads "Today · 14 h left", the band holds one idea and where it came from ("An idea · from Fitness"; the order is yesterday's unfinished goal, the top open to-do, today's session while Fitness is on, the habits: `features/goals/goalIdea.ts`), and the line starts at the lit stop with the screen's one Sky button, "Set this goal" (one tap, with Undo), and a quiet "Something else" (the goal editor). Goal set: the goal is the title (`--fs-poster-goal`; a tap opens its sheet), the meta line reads "Today's goal · 9 h left", the band counts ("To-dos today", "1 of 3 done", "All 3 done") and the to-dos are the stops: at most two done stops (more fold into one "3 done" stop), the first three open ones with the first lit and tagged "Next" beside its check, then "Add a to-do" with "All to-dos" at its end. With a goal and no to-do the band invites the first one and the light waits on "Add a to-do". With everything done no stop is lit: the full poster's sun stands in its place with its two rings. Under the training card the poster is `slim`; with Fitness off it leads Today, `full`, and the idea never comes from training. The moments: setting the goal (the words rise into the title over `--dur`, the light moves to the first to-do) and ticking the next stop (the check fills for a beat, the light moves on, the band counts), each with one light haptic; under Reduce Motion both are a `--dur-reduce` fade. Now marks: the strip dot, the training card's sun (or the poster's own with Fitness off) and the lit stop are the screen's three, so the Goals badge yields.
- **Fitness.** The page leads with Today's training card, whole and unchanged (6.5): the session's name and line, or the dusk scene on a day with nothing on; the week horizon; the band with its Runs and Workouts pill; the log line and its ring. It stays the training card all day (Today swaps it for the Close card in the evening; Fitness does not). On any other week the same card is that week's summary: the week's name in Dusk ("Next week", "Week of Nov 23"), its dates, the same horizon and band counted for that week in the quiet colors, and one quiet Deep Sky link back ("This week"). No log line. Under the card, in a card of its own, the days ahead are stops on the path with the small Deep Sky ring (`node="dot"`): a caps caption ("Tomorrow · Fri 13", "Sat 14"), the session's name (Inter 600 17), its line in Dusk, a chevron. Two sessions on a day are two stops, the second with no day. A stop that counts is a filled ring and the line behind it solid; a missed or skipped one keeps its name with a line through it, and the caption says which ("Mon 9 · Done", "Wed 11 · Skipped"). The line ends at "Add a session"; on a week with nothing on, that stop is the lit one under "Nothing on this week yet". On this week the days before today are one quiet row at the card's foot (three small rings, "Earlier this week", the count, a chevron that turns) that opens them in place. Under the week, outside the pager, the page says how it is going: a section titled "Progress" (the chart card of 6.8, with its ranges and its drag; with no history, one quiet row, "Your weeks draw here after your first run"), then "Trends" (the tiles, and the body's numbers when Apple Health is connected). Runs / Workouts on the card's band and on the chart are one choice. The plan is one quiet row, last: a dashed plus, "Build a plan", "It takes a minute"; or the plan's name and where it stands. Week and month controls are off the surface: weeks move by a sideways swipe on the card or the week (never from the chart, which reads a sideways drag), the caps date (with its calendar glyph) opens the month and returns from it, and one Dusk hint line says so once. Layout in `layout-and-hierarchy.md` 2.6.
- **Journal, on the dusk poster.** What I learned and Journal are one tab: a day has one line (what I learned, one sentence) and may have entries (longer). The page leads with the poster at any hour. Before tonight's line: the title "What did you learn today?", "One line is enough.", the seven lights (six days back to tonight) with tonight's ring waiting, and the band, "This week · 2 days written" over "Tonight's line lights the third" (first to seventh; with none written, "Your first line lights tonight"). A light is a day with a line or an entry. Attached under the poster, the composer: one field (Cloud, the field edge, two lines tall, Inter 17) already started from the day by `features/learned/starter.ts`: today's done session when Fitness is on ("On the bike today I learned"), else a habit done today, else today's goal, else "Today I learned". A still Deep Sky caret waits after the starter; where the words came from is a caption beside the one Sky button, "Finish the line" (48 tall), and a small quiet link under the field, "Write a longer entry", is for a day that starts with an entry. The starter is not the person's line: the button saves only once they have written more, and they may clear it. While the field has focus the question is printed over it in caption style, so the label stays in view above the keyboard. A paste over the line's 1,000 characters offers "Save as an entry" in place of a cut. After the save: the line itself is the title, in Fraunces, the band reads "This week" over "3 days written" (the number ticks on `--dur-number`), and the composer's place is one quiet row, "Write more about today", which opens the entry writer in place. One Sky button at most at any time. The save fires one success haptic as tonight's light comes in; under Reduce Motion nothing scales. The count is always days written: never days in a row, no streak word in print or in a VoiceOver label, and a missed day is only an unlit light. The lights read as one label ("2 days written this week, Monday and Wednesday. Tonight's line is not written yet."). Under the composer: today's entries as quiet rows, the Remember when card (one memory, a line or an entry), then the months that hold a written day as 56 pt rows of one inset group (a Haze book tile, the month in Inter 17 600, "9 days written", a chevron); a month with nothing written has no row, and an earlier year is a section under its name. A month opens its page (`/journal/2026-11`): the month calendar, then the days, each with its line as the headline and its entries under it. Layout in `layout-and-hierarchy.md` 2.5.

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
| Hero faces | A day with no run and no workout (rest, nothing planned) is the dusk scene (6.5). A face with no session name sets "Nothing planned" in the name slot at 30/34. |
| The morning line (four stops: wake, run, back, leave) | 1.5 px line in the session's data tone; stops are 10 px Paper dots with a 1.5 px Night Ink ring; the current stop is the live node (12 px Sunrise, 2 px Paper keyline), which yields to Night Ink while the week's sun is on screen (3.5). Stop labels in caption style, times in Inter 600 tnum. |
| Close the day | Three numbers in Inter 650 `--fs-value` with `tabular-nums` (they change), labels in Inter `--fs-sub` Dusk (one big number and one caption per card). |
| Week card (miles and runs tiles) | Two Paper tiles r 18, numbers Inter 650 tnum, labels caption style; the ring is the hold ring's track and fill at 4 px. |
| Plan-end card | A card with a Fraunces card title, one Inter 15 Dusk line and one secondary button. |
| Strava primer | Section 6.15 (third-party marks). |
| Calendar and word sheets | Sheets (6.9); calendar day cells 44 pt, the shown day a Sky disc with a Night Ink numeral, today a Night Ink ring. |
| The Fitness switch | Settings, the Fitness group's first row (a switch, section 6.14): "Fitness", "Training plan, runs and lifts". On by default; first run asks it once ("Do you want Orby to track training?", two choices). Off, nothing in Orby names training: no Fitness tab, no hero, kind pills, status row or second-session card on Today, no Progress chart and no trend tiles (they are part of Fitness; the habits' trend is in History, beside the habits, and the body's numbers are in Settings, under Apple Health), no training rows in Settings, no run or plan in the assistant's starters, examples and empty states. Nothing is deleted: on again, everything is as it was. One place decides it (`lib/prefs.ts`); screens ask it and never read storage themselves. |
| Today shows | A list of Today's sections, a switch each and nothing to reorder: Habits, Plan your day, Journal ("One line is enough"; its stored key is still `learned`). It is an inset group in Settings and the same rows in a standard sheet opened by "Edit Today", a quiet link (6.3) at the very bottom of Today. Fitness is not in the list: the training card follows the Fitness switch. With Fitness off Today leads with Plan your day, then Habits, then the Journal row; with every section off it shows one Dusk line and a quiet link to the list. Layout in `layout-and-hierarchy.md` 2.3. |
| Status row and status sheet | One row of glass status pills (6.14) under the week strip: on the ground, from the left gutter, 12 px apart, 16 px under the strip and 12 px above what follows. **The plan pill** is always there: the plan's name and where the day is in it ("Half marathon · Week 3 of 12"), a right chevron, a tap opens Plan. With no plan now or ahead it reads "Make a plan" and opens the builder. **The status pill** comes first and shows only while a status is on (Taper, Rest, Sick, Injured, Travel): a 6 px state dot (Taper Deep Sky, the others Pencil), the kind and its end ("Sick · until Fri"), a down chevron, a tap opens the status sheet. Ordinary training has no status pill: the row never says "On the plan" or "Day by day". So the row holds one pill on most days and two while a status is on; with nothing to show it is not drawn, and the hero starts 16 px under the strip. Fit: the row never wraps and never cuts a word. When it would, the plan pill drops the plan's name and keeps the phase, then the status pill drops its end; at very large text the pills stack, 12 px apart. The status sheet is a standard sheet. It opens from the status pill, and in ordinary training from Today's title menu (hold the title or the date: "Change training status…"). |
| Orbs counter (Today's title line) | Today's Orbs as a numeral beside the title-line's Apricot half-sun (5.3): Inter 600 15 with `tabular-nums`, Night Ink. The sun and the numeral are one 44 pt target that opens the Orbs page, labeled "Orbs. 12 today. Level 5." On today's own page only; no numeral before the day's first Orb (never "0"); none while Orbs are off. An earned Orb that lands here makes the sun pulse once (9.1). |
| The challenge row (Plan your day) | When a challenge is on offer or running: one 64 pt row (a row with a second line, 6.4) in the Plan your day card's foot, where "Review" and "Set tomorrow's goal" sit. The challenge's title in Inter 17 600, under it "Today's challenge · 5 Orbs" (or "This week's challenge") in Inter 15 Dusk. A tap opens a small sheet: "Add to today" (or "Add to this week"), "Skip", "Easier" where the challenge has a size, "Ask the assistant to pick" where the phone may ask (the training switch is on and the server offers it), and "Drop it" once one was added. While it asks, the sheet shows the assistant's Orb thinking at 18 pt: under 28 pt it is the flat Sky disc (2.4), pulsing. That is the assistant at work, never an earned Orb. A pick the assistant made says so ("Picked by the assistant") above its one-line reason. Offered, never assigned: nothing is said when one is skipped or lapses. Nothing else about Orbs is added to Today. |
| The Orbs switches | Settings, the Orbs group, and the same rows as the last group of the Orbs page: "Orbs" (a switch: off hides everything about Orbs everywhere and pauses the count; the word then appears only in Settings; nothing is asked and nothing is lost), "Show Orbs when you earn them" (a switch: off, nothing pops and the count still grows), "Your week" (5, 4 or 3 days, each with its rule line: "One thing a day. Two days off a week."), "Challenges" (Off, One a week, Two a week; and their size: Gentle, Steady, Bold), "How Orbs work". With Orbs off the group is the switch and "How Orbs work". |
| Avatar to Today pill | The 40 px avatar disc (6.14) becomes a 36 px Paper "Today" pill, Inter 600 Night Ink, `--shadow-float`, on the settle spring. |
| Day timeline rows | 56 px rows, a 32 px Haze icon tile with the glyph in the data tone, title Inter 17 600, time Inter 15 Dusk tnum, hairline inset past the tile. |
| Held-session row | As a timeline row with a 1.5 px Deep Sky dashed edge and "Held" in Inter 15 Dusk. |
| Hero faces (rest, evening, done, first run) | The same hero card and glow; the session name slot holds the face's words in Fraunces 650 ("Rest day", "Done", "Your first run"); done shows the lit Sky check coin; no extra orange. |
| The first day | On the day setup is finished the plan starts the next day, so while no session and no run is on that day the day poster (6.5a) leads Today, whole, under the plan pill; the training card's slot keeps only the evening's Close card. Its lit stop ("Set this goal", from the idea in the band) is the one first move, with the app's own reward: the haptic, the toast with Undo, the title rising. No tutorial overlay. From the first session or run on, and on every later day, the training card leads. |
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

### 6.16 The plan builder's assistant

In the New plan sheet (Today's "Make a plan", and wherever the plan builder opens), under the plan preview and above the first control. It shows only when the assistant is set up. The person says what they want in their own words and the builder's own controls change in place. Layout values: `docs/brand/layout-and-hierarchy.md` 2.12 and 6.11.

| Part | Spec |
|---|---|
| Container | One Paper card, r 24, `--shadow-1`. It holds the pill or the composer and, under a `--line` hairline, the line. Never a second card for the line. |
| Pill | The dock's ask bar in place (6.1): 48 tall, the Orb at 28 px (gloss, still) 12 px from the left, then "Describe your plan" in Inter 17 Dusk. Pressed: Cloud. After a request that did not go through, the pill shows the person's own words on one line in Night Ink, and a tap opens them to change. |
| Composer | The same card opened in place, with the composer's 1 px `--edge` (6.12): the field in Inter 17 Night Ink (never under 16 px), placeholder "4 runs a week, long run Sunday, race on March 14" in Dusk, 2 lines growing to 5; the 28 px Orb at the bottom left; Send at the bottom right exactly as 6.12 (a 40 px circle, Haze with a Dusk arrow when empty, Sky with a Night Ink arrow when ready). The provider line (6.12, Disclosure) sits 8 px under the card while the composer is open. An empty composer that loses the keyboard folds back into the pill. |
| One Sky button | While the composer holds words, Send is the sheet's Sky button and the sheet's own verb ("Use this plan") turns secondary. While the composer has the keyboard, the sheet's pinned foot steps out so nothing covers the composer. |
| Veil (the working state) | Over the builder, under the sheet's title bar: Cloud at 62 percent on a 6 px backdrop blur, so the form shows through, softened, and cannot be read or touched. In the middle: the Orb at 56 px in its thinking state (2.1); 16 px under it the status line "Shaping your plan" in Inter 15 500 Dusk with `role="status"`, on a pool of solid Cloud so the pairing is Dusk on Cloud (3.2); 12 px under that Stop, a secondary button 44 tall and at least 96 wide. The veil shows 150 ms after Send and then stays at least 600 ms, so a fast answer never flashes it. After 8 s the line reads "Still shaping your plan". Stop, or closing the sheet, cancels the request. Increase Contrast: no blur, Cloud at 94 percent. |
| The line | One row under the hairline, 16 px in, 12 px above and below, Inter 15. What changed leads in 600 Night Ink and starts with "Set" ("Set 4 run days, long run Sunday, peak up to 35 mi."). What the builder has no setting for, or why a value was limited, follows in 500 Dusk, three sentences at most. "Undo" is a quiet link (6.2) at the trailing edge, and under the words on a sheet narrower than 22 rem. A change by hand retires the line. A request that did not go through shows an 18 px Signal alert glyph, one sentence in Night Ink, and "Try again" as the quiet link where trying again can work. The line fades in over 120 ms and has `role="status"` (`role="alert"` for a failure). |
| Changed controls | Each control an update changed shows a 2 px Sky ring inside its edge (Deep Sky under Increase Contrast) for 1.2 s (9.1), top to bottom, 100 ms apart. It is decorative: the line says what changed. Changed numbers roll to their new value on `springs.number`. |
| Peak tile | "Peak miles a week": a third number tile across both columns, shown only once a peak is set, with "Let the plan pick" as a quiet link at its trailing edge (under the label at Larger Text sizes). |
| Permission | An account that has not answered the permission step sees it in place of the builder's controls (the consent order in layout standard 2.10) before anything is sent. |
| Copy | The app writes what changed from the difference in the settings, never from the model's words. One sentence from the assistant may follow it, only as a safety reply or when the request is not about a running plan. Numbers and dates in the line are Inter with `tabular-nums`. |

---

## 7. Iconography

Sheet: `assets/icon-sheet.png`. Source: `tools/icons.mjs`.

| Rule | Value |
|---|---|
| Grid | 24 px, 2 px live-area inset. |
| Stroke | 1.75 px, round caps, round joins, `currentColor`. |
| Corners | Rectangles r 4. |
| Construction | Circles and arcs first. Today is a sun (a 4.2 px disc, eight rays); Goals concentric rings; Progress a rising line ending in a small circle (r 2, stroked), the same glyph in the set, the dock and everywhere else; Plan (a plan, in rows and sheets) a calendar with 4 px corners; Fitness, the tab, the set's run glyph; Journal an open book; Learned a bulb (no longer a tab's glyph: the glyph stays in the set). |
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

Key light from above (the cool white specular at the top), warm fill from below (the Apricot sunrise underlight). Never lit from the side, never a hard drop shadow, never a reflection of a room. The splash's sunrise state (2.1) adds one more, from behind and below: the limb glow, the sun's light wrapping the lower edge as it comes up.

### 8.3 The poster

For brand surfaces (heroes, store art, share cards, the deck): flat bands of sky (`#8DD0F5` to `#AEDDF8` to `#CFEBFA`) meeting a warm horizon (`#F4E6D2` to `#FFD2AE`); rolling hills in three flat blues (`#8FCDEE`, `#4FA9DB`, `#0A6CA6`); concentric sun rings around the Orb in 1.5 px white at 70 percent stepping down 10 percent per ring; paper grain on top. Headlines in Fraunces 700, Night Ink (9.59 on poster sky). See `assets/hero-poster.png` and `assets/hero-landscape.png`.

**Staging the Orb (one rule for every image):** the Orb's bottom clears the horizon (the crest of the first hill under it) by 0.1 D, where D is its diameter. The horizon glow, an Apricot ellipse centered on the horizon, carries the warmth (on the splash the Orb's sunrise state carries it too, 2.1). Nothing covers the Orb's lower hemisphere: no hill, no phone, no text, no stamp. Rings center on the Orb and never cross text; mask or drop a ring rather than run it through words. Applies to the cover, the app icon (2.5), the poster, the landscape hero and the splash (12.1).

**The rings on the splash** are the poster's five (radii 0.66, 0.86, 1.06, 1.24 and 1.4 D; 70 percent stepping down 10 a ring). Each carries a soft Apricot band 12 px wide just inside its white line, so a ring leaving the Orb reads on the pale sky before the horizon has warmed. A ring that would come within 16 px of the words (a short screen, a large text size) is not drawn.

### 8.4 The milestone stamp

A round Sunrise stamp for days in a row or a finished block (brand art and share cards only: no screen of the app draws one today), rotated -10 degrees, Night Ink on Sunrise (4.96, bold), with a Paper keyline of `max(2px, 3.3%)` of its diameter. One per screen; it counts toward the orange budget.

- **If a screen ever draws one (44 px):** the numeral only, Inter 700 tnum Night Ink, with `aria-label="12 days in a row"`. No words: they cannot fit at the 11 px floor. Never for Orbs (2.1).
- **On brand art (92 to 118 px):** the numeral in Fraunces 700 (static art), with "DAYS" and "IN A ROW" in caption style (Inter Tight 600, caps, +0.14 em) at 10 percent of the diameter.

### 8.5 The circle vocabulary

Discs, rings, domes, half-suns on a horizon, orbits. A done run is a half-sun on the week's horizon (brand art: radius 7 + 2.6 x miles px); a planned run is its dashed outline. In the app the same picture is the Progress chart (6.8): a dome rising from the horizon for what was done, its dashed outline for what is still planned. A keepsake (the Orbs page) is in the same vocabulary: a 48 pt Haze disc with a 2 px Deep Sky ring and a Night Ink numeral ("4" for weeks in a row, "100" for days in all) or a glyph (from the set: the sun for the first Orb, the check for the first full day; Lucide's Flag at 1.75 for the first challenge, which the set has no glyph for; from the set again: the rings for a goal, the open book over its number for a chapter), its date under it. Only the newest glows: the keepsake's Apricot light behind its disc (2.1). What comes next is one dashed Pencil ring with nothing filled and nothing counted down. Its line may name the day it arrives ("Next: chapter 2, on Dec 14"): a date is a fact, never a count of what is left. Never people, faces, photographs, clip art or the reference's own shapes.

The earned Orbs speak the same vocabulary: spheres, a planet's rings, bands, a moon's terminator, star points (2.1, the family).

**The dome** (the Orbs page's hero) is the vocabulary as one object: a glass bubble dome on a console base, mid-century space age, a collection built the way 1962 imagined today. Every Orb the person earned sits inside it as a glass sphere with weight (9.2). The glass has a thin Deep Sky edge and one clean highlight streak. Inside it, a pale sky over a warm horizon, in the poster kit's colors. The console is Twilight or Night Ink with an Apricot rim light; it carries three round glass keys with caption labels (4.3), the level as an instrument dial and the total. At most two small atomic starbursts or orbit lines stand behind the glass, in Haze, never animated. Never chrome gradients from a stock kit, neon, rivets, faux wood, mascots or people. Never chance imagery: the dome holds what was earned and pays nothing out.

---

## 9. Motion and haptics

### 9.1 Durations and easings

Springs come from `apps/web/src/lib/motion.ts` (`springs.page`, `settle`, `sheet`, `number`, `complete` and the rest); CSS uses the `--dur-*` and `--ease-*` tokens (`--ease-out`, `--ease-sheet`, and `--ease-in-out` for light that comes up and settles). One named exception: the sunrise splash's length and the easing of its climb are numbers in `apps/web/src/app/splashTimeline.ts` (`SPLASH_MS`, `RISE_EASE`), because its haptics and its beat are computed from the same figures; its styles read them from there as custom properties.

| Move | Duration | Easing or spring |
|---|---|---|
| Press | 160 ms to scale 0.97 | `--ease-out` |
| Color, halo | 200 ms | `--ease-out` (animates `color` or `background-color`) |
| Fade in / out | 120 / 100 ms | `--ease-out` |
| Page push and pop | 350 ms | `springs.page` (0.35 s, bounce 0) |
| Sheet, CSS open | 500 ms | `--ease-sheet` `cubic-bezier(0.32, 0.72, 0, 1)` |
| Sheet, drag release and detents | 500 ms | `springs.sheet` (0.50 s, bounce 0) |
| Segmented thumb, reflow | 300 ms | `springs.settle` (0.30 s, bounce 0.10) |
| Numbers, the week's sun | 480 ms | `springs.number` (0.48 s, bounce 0); the sun moves by transform |
| The view pill's thumb | 300 ms | `springs.settle` |
| A mark filling | 300 ms to 1.12, once | `springs.complete`, no haptic |
| The dusk breath | 8 s loop | `calc(2 * var(--orb-breath))`, `--ease-in-out`, the light layer's opacity 1 to 0.86 |
| Completion | 300 ms to 1.12, once | `springs.complete` (0.30 s, bounce 0.30), `orb` haptic on the peak |
| Hold ring | 600 ms | `--dur-ring`, linear, `stroke-dashoffset` |
| The way's dots | 6 ms stagger, 240 ms cap | `--dur-in` fades |
| Chart bars rising (a new range or mode) | 480 ms each, 12 ms apart (`--bar-stagger`), 240 ms from the first to the last at most (more bars than 21 share the 240 ms evenly) | `--dur-number`, `--ease-out`; a `transform` on each bar's own box, from its foot. The plan outline, its label and the now dot fade in (`--dur-in`, 120 ms) half way through the last bar's rise, when it is all but up. |
| Sunrise splash | 2.8 s, first frame to the app | `SPLASH_MS` in `apps/web/src/app/splashTimeline.ts`, the one constant its whole schedule is derived from; the climb runs 2.0 s on `cubic-bezier(0.32, 0.42, 0.22, 1)` (`RISE_EASE` there); its light (the sky's colors, the glows, the Orb's two overlays) comes up, and the splash dissolves, on `--ease-in-out` `cubic-bezier(0.45, 0, 0.55, 1)`; the veil, the rings and the words on `--ease-out` (9.2) |
| Quiet opening, Reduce Motion's splash crossfade | 300 ms | `--dur-launch`, `--ease-out` (linear under Reduce Motion) |
| An earned Orb, born and rising (9.2; its kind's own Orb, 2.1) | Gone by 620 ms: 0 to 120 ms `opacity` 0 to 1 and scale 0.3 to 1.2; 120 to 260 ms scale to 1; 0 to 420 ms it rises 48 pt and drifts 10 pt to the trailing side; 300 to 480 ms it fades and shrinks to 0.7 | CSS keyframes, `transform` and `opacity` only, and one keyframe rule may carry both (the one-property rule was written for the splash's layers); the rise on `--ease-out` `cubic-bezier(0.22, 1, 0.36, 1)`. No haptic of its own (9.5). |
| An earned Orb, to the counter | clamp(280, 220 + 0.5 x distance, 460) ms, from 300 ms after birth, shrinking from 20 to 12 pt | x eased out on an outer node, y `--ease-in-out` on an inner one, so the path bows. Only while the counter is on screen. |
| The counter's sun, on landing | 300 ms, scale 1 to 1.18 to 1, once; the numeral cross-fades | `--dur-complete`, `--ease-out` |
| Three earned Orbs (a session, today's goal) | Three 18 pt Orbs of the one kind, 60 ms apart, fanned at -16, 0 and +16 degrees, rising 40, 60 and 44 pt | As one earned Orb. Never more than three: a larger number is type in a big moment. |
| The "Full day +5" chip | 2,400 ms in all: 120 ms in, held, 100 ms out | The fade values on `--ease-out`, as shares of one keyframe; `opacity` and a 4 pt rise. Reduce Motion: no rise. |
| Today's Orbs into the dome (9.2) | One every 90 ms from the top, once everything earned before today is at rest | The dome's simulation (the canvas exception below), not a timed move |
| A caption in the dome (9.2) | Up for 2.4 s | The fade values in and out, `--ease-out`, `opacity` only |
| A big moment (9.2) | The page fades in over `crossfadeSlow`; its shape lands once on `springs.complete`, 50 ms later; its words follow at 450 ms | `lib/motion.ts` names only. No rotation, no loop, no auto-close. Reduce Motion: one `--dur-reduce` fade for all of it. |
| Changed-control ring (6.16) | 1.2 s, once | `--ease-out`, `opacity` only: full by 12 percent of the time, held to 55 percent, gone at the end; each control starts 100 ms after the one above it |
| The plan builder's veil (6.16) | 120 ms in, 100 ms out | The fade values; the Orb's flight is a page move, 350 ms on `springs.page` |

**What may animate:** `transform` and `opacity`, plus these named cases only: `color` and `background-color` (the 200 ms color and halo change), `stroke-dashoffset` (the hold ring), and the `height` of Fitness's week pager while a swipe is under the finger (the week coming in may be taller or shorter than the one leaving, and Progress under it follows the finger instead of jumping at the end; it is written from the swipe's own position, never by a timed transition). A gradient never transitions: the dawn wash and the Orb's warming underlight fade in as an overlay layer's `opacity`. A moment that plays by itself (the splash) is CSS keyframes with both ends named and one property each, eased with `cubic-bezier` (never `linear()` with points or `steps()`: WebKit keeps those on the main thread), so the compositor carries it while the app starts up.

**The dome's canvas is a named exception.** The dome (8.5, 9.2) draws its spheres on one `<canvas>`, from a simulation with a fixed time step: gravity, collisions, rolling and rest. A sphere's place comes from the simulation and the hand, not from a transition, so the rule of `transform` and `opacity` and the duration tokens do not apply inside the glass. These limits stand in their place. Each Orb is rasterized once per size from the family's SVG and drawn as a sprite: no gradient is built per frame, and the art is never repainted (2.1). No DOM node per sphere. The loop stops when everything is at rest (no frames, no battery) and wakes on a touch, a key, or a tilt past its threshold. It pauses while the page is hidden, under a pushed page and under a sheet, and everything is torn down when the page goes. Outside the glass (the keys, the caption, the dial) the rules above hold as written.

### 9.2 Brand moments

- **Sunrise splash** (every cold open, once per session): the Orb is the sun. 2.8 s from the first frame to the app, all of it derived from `SPLASH_MS` (times below are for 2.8 s).
  - **0 to 450 ms.** The first frame is the launch image's plain Cloud. A Cloud veil lifts off the picture: the hills, with the sky pale above them (the app's own dawn wash).
  - **100 to 2100 ms, the climb.** The Orb rises 1.35 D on one long ease, `cubic-bezier(0.32, 0.42, 0.22, 1)`: from hidden behind the near hill (its top 0.25 D under the crest) to its resting place, its bottom 0.1 D above the crest (8.3). Its top shows at about 330 ms; it comes over the hill at its fastest and slows all the way to rest.
  - **Its light warms as it climbs.** Three drawings of the one sphere, each fading in over the last: the blue Orb with no underlight, the sunrise state's pale light alone (350 to 950 ms), the sunrise state (800 to 1500 ms; 2.1). Blue fades to pale, then pale to warm, so no frame mixes blue with orange, which reads grey. The sky's colors come with it as one layer (300 to 1800 ms): poster sky blue from the top, the warm horizon band below, Cloud left between them for the words. The horizon glow grows from half its size (200 to 1700 ms), and the Orb's own halo with the sunrise state.
  - **The rings.** The five sun rings leave the Orb one by one, outermost first, each from the Orb's own edge to its radius, bright as it leaves and fading to its resting opacity. They are born 1000, 710, 470, 280 and 130 ms before the beat, so the gaps shorten.
  - **The beat, at 1395 ms.** The frame the whole disc has left the hill line (its lowest point 0.025 D above the crest's center). A bloom of light swells and fades over 900 ms; the wordmark arrives over 520 ms and the line 120 ms behind it (over 480 ms), each fading in and rising 10 px, so the words rest for about 450 ms before the exit.
  - **Rest, then the app.** At 2450 ms the splash dissolves over the app in 350 ms, the words first. It leaves on time when the first screen has painted; a cap at 3.5 s stands in for a screen that never says so. If the app is waiting on the server with nothing saved, the sun rests and breathes (2.1 idle breath) until it arrives; after 4 s "Still loading. Check your connection." and Try again join the words, the column rises clear of the Orb and above the warm horizon band as far as it can (64 pt from the top at most), so Try again reads on the Cloud, and the rings step back.
  - **A tap or a key** runs what is left 8 times faster and lets the app through.
  - **Once per session.** The same session opening the page again (a reload after sign out, a web view the system brought back) gets the final frame: a 300 ms fade in, then a 300 ms fade out as soon as the first screen is ready. No haptics.
  - Haptics: 9.5. Reduce Motion: 9.4.
- **Dawn wash** (first open after 4 a.m. local): a wash layer over the Cloud ground fades its `opacity` from 0 to 1 over 600 ms. Once a day.
- **The Orb:** idle breath 4 s loop; thinking orbit 1.2 s per turn; one shared 24 fps loop that stops when no Orb is visible or the app is in the background.
- **An earned Orb** (every completion that earns): the control's own check lands and its own haptic fires, exactly as before. On that same frame its kind's Orb (2.1: a habit's, a to-do's, a run's) is born at the control's center, rises and is gone by 620 ms (9.1). While the counter is on screen (the top of today's own page, 6.13; no other screen has one) it arcs there instead of fading, the counter's sun pulses once and the numeral cross-fades. A session and today's goal send three of their kind. A full day adds one chip by the counter, the Pearl and "Full day +5". One fixed layer over the page holds at most six Orbs, takes no touches and is hidden from VoiceOver. Each control pops at itself; one subject pops at most once in 10 s; an untick is silent and the count cross-fades down. Two warm things never start together: an earned Orb waits for the week's sun to land (480 ms), and the lit stop's light on Plan your day starts 320 ms after the Orb is born, once the Orb has left the control (its flight to the counter may still be in the air). Never over a sheet that is opening. With "Show Orbs when you earn them" off nothing shows and the count still grows.
- **The dome** (the Orbs page, 8.5): play, in Orby's own light.
  - **Opening the page.** Everything earned before today is already at rest: the simulation is settled before the first paint. Today's Orbs then drop in from the top, one every 90 ms, each landing with a haptic (9.5). This is the payoff that ties earning to the collection.
  - **The hand.** A finger grabs the nearest sphere and drags it; letting go flings it. Spheres collide, roll and settle. The glass alone takes the touch: the bar above it and the console below scroll the page as usual.
  - **A tap** on a sphere, with no drag, shows a small caption beside it for 2.4 s: "A habit · Fri, Nov 13", "Today's goal · today", "Week of Nov 9 · 42 Orbs · 6 days". It says a kind and a date, never a name.
  - **Three keys** on the console, round, with caption labels. **Tilt** asks for motion access once, on that tap only and never on page load; then gravity follows the phone. Refused or missing, one toast says "Tilt is off for Orby", the key stays off, and everything else works. **Stir** is one upward swirl and needs no sensor. **Float** turns gravity off: the spheres drift and bump softly, and a second tap lets them fall. The keys are not Sky buttons.
  - **What it holds.** A sphere is an award, not a single Orb: a session is one sphere worth 3, and the worths always add up to the total. This week is one sphere per award. An earlier week is one fused sphere ("Week of Nov 9 · 42 Orbs"); past the last four weeks they fuse into chapters, chapters older than a year into a year, and further whenever the spheres would fill more than about 60 percent of the glass. Nothing is ever lost or taken out.
  - **With nothing earned** the dome is empty glass over one line: "Finish one thing and it lands here."
  - With Orbs off the page does not exist. With "Show Orbs when you earn them" off the dome still plays: it is a page the person opened.
- **Big moments** (full screen, an explicit "Keep going", no auto-close): a week, month or year goal; 4, 12, 26 and 52 weeks in a row; 100, 365 and 1,000 days in all; a chapter. Never from a routine tap: after the Close card's save, or on the next open at rest. **At most two in any seven days**; the rest wait as "New" on the Orbs page. Everything else is one toast and a "New" on the Orbs page. Today's goal is not a big moment: it gets the three Orbs. A big moment's paid line carries its own Orb (a month goal's gold with two rings).
- **Rewards in the brand's own light:** no confetti, no mascots, no chance imagery, no loss framing. Nothing is random, nothing is bought, nothing is taken away, and no notification threatens a loss.
- **The Orb lifts** (the plan builder, 6.16): 150 ms after Send the Orb leaves its place beside the words and flies to the middle of the veil, growing from 28 to 56 px, 350 ms on `springs.page`, and turns to its thinking state. When the answer lands it flies back to the pill, and the pill's own Orb takes over. One Orb the whole time.

### 9.3 What never moves

Text blocks, cards on scroll, the palette, backgrounds after load (the dusk light's breath on Today's hero is the one named exception), the hero's sky, hills and words, the logo (except the splash rise). On the splash the wordmark and the line rise 10 px as they arrive, and the words move up once, only as far as they must, to make room for "Still loading" and keep Try again above the warm band (9.2); nothing else there is text in motion.

### 9.4 Reduce Motion

Every move becomes a 150 ms linear fade (`--dur-reduce`); the one longer fade is the splash's 300 ms crossfade in, below. The Orb holds its still frame. The week's sun and the view pill's thumb jump. No breath at dusk. The splash shows its final frame: it crossfades in from the launch Cloud over 300 ms with the one `dawn` haptic, rests half a second and fades out in 150 ms; nothing in it moves. No parallax, no breath, no orbit. An earned Orb (9.2) fades in above the control over 150 ms, holds 400 ms and fades out: no travel, no scale, no pulse on the counter. The dome (9.2) runs no simulation: its spheres are drawn at rest, in the settled layout; a tap still shows the caption; Tilt, Stir and Float are not drawn.

One named exception, the plan builder's veil (6.16): the Orb appears in place and holds its still frame, and its `opacity` goes from 1 to 0.6 and back every 1.2 s (the loading pulse of 6.14), so a covered form still shows that work is going on. The changed-control ring stays as a fade, on every changed control at once, and changed numbers jump.

### 9.5 Haptics

From `lib/haptics.ts`: named events, at most one per action, fired on the visual peak frame (the three exceptions are below: the sunrise splash's phrase, the full-day beat, and the dome). `tick` (words landing, selection, at most 1 per 100 ms), `select`, `toggle`, `orb` (a habit lit), `lift`, `drop`, `threshold`, `success`, `celebrate` (a milestone stamp), `delete`, `warning`, `error`. Never for a tap that only navigates. The Settings switch turns them all off.

**The sunrise splash** is the one phrase (9.2): `rise`, a light tap on the first frame of each sun ring (five at most, the gaps shortening from 290 to 150 ms), and `dawn`, one fuller beat on the frame the Orb clears the hill. Each is tied to something on screen: a ring that is not drawn is not felt. They are timed from the frame the animation really started; a tap that comes up more than 120 ms late (the main thread was busy starting the app) is dropped, never played out of time, and the beat may land up to 400 ms behind. None while the page is hidden, after a tap that skipped, or on the quiet opening.

**An earned Orb adds no haptic.** The completing control's own haptic is the award's: a to-do `toggle`, a habit `orb`, a session `success`, a goal `success`, each on its own peak as before. Nothing fires on the Orb's birth, flight or landing. **The full-day beat is the one exception** to one haptic per action: when a completion makes the day a full day, one `success` follows it with the "Full day +5" chip. Once a day at most, and only when the completing control's own haptic was an impact (`toggle`, `orb`), so two `success` notifications never play back to back.

**The dome is the third exception.** It is an object under the hand, and it answers like one, with named events only and no new pattern. A sphere landing, or two colliding above a speed threshold: `tick`, never more than 1 per 100 ms overall, and none once the pile is at rest. A hard hit on the glass may be `select`. Grabbing a sphere: `lift`. Stir: `threshold`. Float on and off: `toggle`. Today's Orbs landing as the page opens: one `orb` each for the first six, then `tick`. Tilt alone, with nothing colliding, fires nothing. The Settings switch silences all of it.

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
| entry | post, log | A longer piece in Journal, as many a day as wanted. "Write a longer entry." |
| line | learning, note, log | The day's one sentence in Journal (what I learned). "Finish the line." |
| Favorite | star, like, heart | Capitalized as the feature: "Add to Favorites". |
| plan | program, schedule (as the training plan) | "Your plan", "this week's plan". A plan lives inside Fitness. |
| Fitness | Plan, Training (as the tab or the page) | The tab and its page: "Open this week in Fitness". Capitalized as the place and as the switch in Settings. |
| Today shows | Customize, Widgets, Layout | The list of Today's sections, each with a switch. "Edit Today" opens it. |
| Wake time | alarm, wake-up | Capitalized as the setting; "Wake at 6:30" in a sentence. |
| session | workout (in UI labels) | "Today's lift", "Easy 5". One exception: the Runs / Workouts choice (6.5) and the counts it leads to on the card's band and the Progress chart say "workouts" ("13 workouts in 3 months"), so the word under the pill is the pill's own. A single planned or logged thing is still a session. |
| habit | streak item, task | |
| Orbs (plural, or with a number: "9 Orbs", "1 Orb") | "the Orb" for a reward, points, coins, XP | "The Orb" is the assistant's mark (2.6). |
| Orbs; "the dome" only where the page's hero needs a name (the page is "Orbs") | jar, marbles, coins, a name for the page | The collection on the Orbs page (8.5). |
| A to-do, A habit, A run, A lift, Cross-training, Today's goal, A week goal, A month goal, A year goal, A full day, A week that counts, A challenge, Good to see you, An earlier week, An earlier chapter, An earlier year | a hue as a label ("the gold one", "a Lagoon Orb"), gem, jewel | An Orb is named for what earned it (`gemName`), never for its color. |
| Tilt, Stir, Float | Shake, Gravity, Zero-G | The dome's three keys. "Tilt is off for Orby" when motion access is refused or missing. |
| × ("month goal × 10") | x, * | The multiplication sign. |
| days off | rest days | A rest day is a training state here. |
| "5 days this week", "128 days in all" | kept (as a noun), streak | The count of days. A day counts; it is never "kept". |
| weeks in a row | run, best | A run is a session. "Best" beside a lower number is a loss notice. |
| Today's challenge, This week's challenge | sprint, quest | A sprint is a run. |
| Add to today, Add to this week, Skip, Easier | Take it, Not today | A challenge is offered, never a dare. |
| Ask the assistant to pick | Make it mine, AI | It says what happens. |
| Level 5 | named levels | Numbers do not run out, and do not fight the brand's sunrise. |
| Pause | freeze | The app's statuses (Sick, Injured, Travel, Rest) already exist. |

**The rule of the count, in eight words:** "One thing a day. Two days off a week." (three or four days off where the person set their week to four or three days). Monday says "New week. Two days off in hand." The fact line reads "5 days this week · 128 in all · 6 weeks in a row", with weeks in a row from two. These lines come from the rules themselves (`ruleLine`, `mondayLine`, `countLine` in `packages/shared/src/rewards.ts`): screens print them and never rewrite them. Copy about Orbs never shows a zero, a "best", days in a row or anything that ended, and never a bonus or a challenge as nearly earned (2.1); the distance to the next level is shown.

### 10.3 Twelve lines, done right and wrong

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
| 5 days this week · 128 in all | 12-day streak! Don't break it! |
| Your first Orb is one thing away | You have 0 Orbs. |

---

## 11. Accessibility

| Area | Rule and check |
|---|---|
| Contrast | Body text 4.5:1, large text 3:1, meaningful graphics 3:1. Only the pairings in 3.2. `apps/web/scripts/check-contrast.mjs` reads its table from `docs/brand/tokens.json` `contrast.allowedText` (every row, including text on Haze `--surface-3`, `--now-text`, `--primary-ink` on `--primary` and `--sun-ink` on `--sun`) and stays in `pnpm test`. |
| Color alone | Never the only signal: the shown day is a disc plus a numeral, done is a filled coin plus a check, a day that counts is a Deep Sky disc plus a check, an earned Orb's hue always stands with its style, its size, the words beside it or its caption on tap (and the legend on How Orbs work names every kind), today is a dot plus Night Ink letter, Today's hero prints and reads its count ("Runs this week, 0 of 4. 0 of 15.5 miles"). |
| Dynamic Type | Every size in rem with px floors (11, 12, 13). Check every screen at 200 percent: nothing clips, nothing overlaps, cards grow, two-column grids may become one column. Fixed chrome keeps a px ceiling so it cannot push the bar apart: the Orbs counter's numeral, the "Full day +5" chip and a keepsake's numeral grow with the text and stop at their ceilings (their full words are in their labels). Above 150 percent, tab labels hide and icons grow to 26 px. |
| Targets | 44 x 44 pt minimum for anything tappable, including week cells, chips and dots that act. |
| Reduce Motion | Section 9.4, the dome included (drawn at rest, no keys). Test with the iOS setting on. |
| Increase Contrast | `prefers-contrast: more` remaps both the semantic aliases and the palette names, so a component gets the step whichever it uses: `--ink-2/3/4` and `--dusk` to Graphite `#33475B`; `--accent-text`, `--ok`, `--deep-sky`, `--t-long`, `--star`, `--prio-3` and `--tag-blue` to `#085A8C`; `--ink-faint`, `--pencil` and `--t-rest` to `#5F6D7B`; `--line` .30, `--line-strong` .55, `--edge` .30, `--tick` .45, `--coin-ring` .55, `--dot-ahead` .22; card edge `1px solid rgba(14,34,54,.16)`, field edge .7 (5.98); glass opaque Paper. In `tokens.css`. The dome's glass outline and its console take the stronger tokens. |
| VoiceOver | The Orb's label is "Assistant" when it opens the assistant, "Orby" as the logo; decorative Orbs are hidden. Today's hero reads its count from the band ("Runs this week, 0 of 4. 0 of 15.5 miles. Open the week"); the drawing is hidden. Stamps read as "12 days in a row". An earned Orb in the reward layer is hidden: one polite `role="status"` region says what was earned 1,200 ms after the last award ("5 Orbs. 12 today."), never assertive, never moving focus. In the legend and in today's lines an Orb is hidden too: the row's words name it. The dome's canvas is hidden: one visually hidden summary and a list say what the glass holds ("128 Orbs. This week: 6 habits, 3 to-dos, 1 run, today's goal. 11 earlier weeks."), and its three keys are real buttons, with `aria-pressed` where they toggle. Today's counter is a button, "Orbs. 12 today. Level 5." On the Orbs page the week's marks are one image that names the days that count, and each keepsake is a button with its words and its date. The Progress chart is one slider: its value is the focused bucket in words ("Last week: 23.8 miles, 4 runs"), a swipe up or down (or an arrow key) moves it, and a double tap (or Enter) opens a running week. |
| Captions | Caption style is never the only label on a control. |
| Working states | Any animated indicator (the thinking arc, a skeleton) has a text status with `role="status"`. |

---

## 12. Applying it to the app

### 12.1 Screen by screen

| Screen | What changes | Mockup |
|---|---|---|
| Today | Dawn wash ground; Fraunces 650 title and italic quote in Dusk; the title-line sunrise (5.3); week strip with the 34 px Sky shown-day disc, today's Sunrise dot and one kind pill a day (6.7); the status row of glass pills (6.13); the hero card in Paper with the sunrise glow; the week horizon per 6.5 (the sky wash, the three hills, the Sunrise sun, the band with its label and view pill; dusk on a day with no run and no workout); Sky segmented thumb; habit tiles per 6.6 (Inter initials, sentence-case names, lit coins Sky); the 28 px Orb in the ask bar; the Sky active-tab disc. | `mockups/today.png`, `today-habits.png`, `today-before-after.png` |
| Goals | Paper chips with Haze icon discs (no per-feature hues); "+ Set" as quiet Deep Sky links; the Today card's sun in Apricot (no extra glow); "TODAY" eyebrow in Ember; one Sky primary ("Set today's goal"); "Review it" a secondary; Fraunces italic prompt. | `mockups/goals.png` |
| Fitness (the Plan tab) | Today's training card leads, whole (6.5); the days ahead are stops on a dotted line ending in "Add a session" (6.5a), with "Earlier this week" folded; no Week / Month switch and no week header on the surface (a swipe changes the week, a tap on the date opens the month); the plan row is the page's last row, not a hero. Progress is the lower half of the page, not a tab: the chart's headline in Inter 650 tnum (it changes); the bars per 6.8 (what was done, the dashed plan ahead, the Sunrise now dot and the Ember NOW label); one Runs / Workouts choice, shared with the training card; the trend tiles; empty state per 6.11. | `mockups/plan.png`, `mockups/progress.png` (both from before the two were one tab) |
| Journal | One tab for the day's line and its entries (What I learned is part of it). The dusk poster with the week's lights (6.5a); the line's field in Inter 17, started from the day (never Fraunces in the field); Sky "Finish the line", then the quiet row "Write more about today"; the Remember when card, plain Paper with its quote in Fraunces italic `--fs-sentence-sm`, one quiet card under them; the months as one inset group; on a month's page, the calendar with the shown day ringed in Sky and entry marks as flat discs carrying their count as a numeral (Haze ringed with "1", `--entry-2` `#7FCBF3` with "2", Sky with "3+", Deep Sky for a Favorite), so the count is never lightness alone; no glossy Orbs. No Week / Month switch and no Entries / Library switch. | `mockups/journal.png`, `mockups/learned.png` (both from before the two were one tab) |
| Orbs (pushed over Today) | The page of what was earned (layout standard 2.13): the bar (Back, "Orbs"); the dome as the hero (8.5, 9.2): a glass dome holding every earned Orb as a sphere of the family (2.1), on a console with its three keys (Tilt, Stir, Float), the level as an instrument dial with "Level 5" and "216 to level 6" beside it, and the total in the stat numeral (Inter 650 tnum); the week's seven marks and one line of fact on Paper under it; one inset group only while it has rows (today's Orbs, anything new, the challenge rows); the keepsakes, 48 pt Haze discs four across with their dates and one dashed ring for what comes next, only the newest glowing Apricot (8.5); then "How Orbs work" and the switches (6.13). No Sky button (the keys are not Sky buttons), no Sunrise mark, and no assistant's Orb in the glass. With nothing earned, empty glass over one line: "Finish one thing and it lands here." With Orbs off the page does not exist. | No mockup yet |
| How Orbs work (pushed over Orbs) | One list page: the rule in Fraunces italic `--fs-sentence`, one Dusk line, then groups of plain rows (a title in Inter 17 600, one Dusk line that wraps, what it pays in Inter 650 tnum at the row's end), each number read from the rules. The page is the family's legend: a row that earns an Orb shows it at the row's leading edge, 22 pt (a session shows its three kinds, small), and the rows of a group keep that place so their titles line up. No table markup. A quiet "For the curious" disclosure at the foot holds counts worked out on the phone. | No mockup yet |
| The assistant | Per 6.12. | `mockups/assistant.png` |
| New plan (the plan builder sheet) | The assistant's pill, composer, veil, line, changed-control ring and peak tile per 6.16. The rest of the sheet is as it was. | No mockup yet |
| Settings | Dawn wash on the pushed page header; Fraunces group titles at the card-title size (22/28); inset groups with Haze icon tiles; Deep Sky values where they are links. | `mockups/settings.png` |
| Onboarding and welcome | The door looks like the house: the dawn wash ground on every screen, and every picture drawn by the poster kit (6.5a) and the app's real components, never a look-alike. The welcome pager is three pages (Today, Fitness, Journal): one real poster with sample content, a Fraunces headline at the page-title size, one Dusk line, the dots, Sky "Get started" with Ink words on every page (the dots are one adjustable control and the pages swipe), Deep Sky "I have an account"; the ask bar with its Orb sits under the poster, so the header is the wordmark alone (2.3). Privacy and the account keep every word and control, with the title at the question size. A question is one frame: Back and the progress marks; the question in Fraunces 600 at `--fs-section`; one Inter 15 Dusk line; a poster that the answer changes as it is given (the assistant's greeting with its Orb and the name in the sentence italic; the week horizon and the day's dotted line as the two Fitness answers, over the tab capsule; the far hills with race day the far hill; the training card's week horizon; the card's timeline row; the habit tiles; the notification); the controls on Paper at 44 pt and more; a quiet Deep Sky link only where skipping is real; one Sky button in the same place on every question. At most one Sunrise mark on a question (the week's sun, or the lit choice). The reveal is Today as a poster stack made of the answers under "Your first day." at the page-title size, with Sky "Open Today" and the quiet "See how Orby works"; one success haptic as it arrives. The tour is not in the path: it opens from the reveal and from Settings. After setup, the first visit to each tab raises one tip, once: the app's own sheet at its content's height, the caption "How it works" over the tab's name as the title, one Paper card of section rows (6.11) saying how the place works and, under the card's one caption "How it's tracked", what counts and when a change is saved, then Sky "Got it" and the quiet "See it in the tour". No tip names training with Fitness off. Settings can show them again. Layout in `layout-and-hierarchy.md` 2.11. | No mockup yet |
| Splash | The sunrise (9.2). At rest: the poster's sky (poster sky blue from the top, Cloud behind the words, the warm horizon band and the Apricot horizon glow) over the poster's three hills; the outlined wordmark 150 pt wide and "One good day at a time." in Fraunces italic Dusk (6.52 on the splash sky) in the sky, their column starting 29.6 percent down (20 percent on a screen 640 pt tall or shorter); the Orb in its sunrise state (2.1) risen over the hills, staged per 8.3, `--orb-splash` across (96 pt on a short phone, 13 percent of the height between, 120 pt at most), with its five sun rings (8.3); a caption on the far hill in White (5.66 on Deep Sky) that follows the time of day: "GOOD MORNING" before 12:00, "GOOD AFTERNOON" from 12:00 to 17:00, "GOOD EVENING" after 17:00. Native launch image: plain Cloud `#EAF5FC`, which is the splash's first frame, so the hand-off cannot jump; `capacitor.config.ts` `backgroundColor`, `theme-color` in `index.html` and the manifest are `#EAF5FC`. | `mockups/splash.png`, `splash-evening.png` |
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
7. **Today's hero.** The week horizon per 6.5 (built), habit tiles per 6.6, the rest of Today per 6.13.
8. **Screens.** Goals, Journal, Fitness (charts per 6.8), the assistant, Settings, onboarding, in that order. Compare each to its mockup.
9. **Drift.** Remove raw hex, literal navy and orange rgba, ad hoc radii, off-step spacing and extra caps trackings (see 13) until `node apps/web/scripts/check-brand.mjs` reports 0, then add it to `pnpm test`. `mockups/override.css` lists the class-level changes that tokens alone do not reach; implement them in the component sheets, never by copying its `!important` rules.

---

## 13. Checklist before finishing any UI change

Run all of it. A change is not done until every line is true. Lines marked (runtime) need the app running: `node docs/brand/tools/audit.mjs <url>` checks them; a rule you could not run is reported as unverified, never as passed.

- [ ] Every color, radius, spacing, duration and font comes from a token in `tokens.css` (the one named exception: the sunrise splash's length and climb easing, 9.1). `node apps/web/scripts/check-brand.mjs <changed files>` adds no findings.
- [ ] Every text and ground pairing is in 3.2. `pnpm test` passes (contrast and px-font checks). (runtime: the audit checks each text element against its effective ground)
- [ ] No Sky text on light grounds, no white on Sky, no Sunrise text.
- [ ] At most 3 Sunrise elements on the screen (3.5 priority), each with a Paper keyline of at least 2 px (the week's sun 3.5); no orange button, fill, selected state, series or session kind. (runtime)
- [ ] One assistant Orb at most (or the splash); its size follows the tiers (48+ full, 28 to 47 gloss, under 28 flat). (runtime) An earned Orb is one of the family (`features/orbs/gems`, 2.1): the logo's form in the table's hue and style, never Sky, every stop derived from its token by the one function, and only in the reward layer, the dome, the legend and today's lines. Its hue never says the kind alone.
- [ ] Rewards are in the brand's own light: no confetti, no mascots, no chance imagery (the dome holds what was earned and pays nothing out), no loss framing. In Orbs copy: no zero, no "best", no days in a row, nothing that ended, no bonus or challenge shown as nearly earned, no worth on a goal. The words are the glossary's (10.2).
- [ ] One hero card and one sunrise glow at most. (runtime)
- [ ] Fraunces only in titles, card titles, sentences and one static hero stat; never in buttons, tabs, chips, inputs, coins or live numbers. Weights 600 to 700 roman, 420 italic. No `font-variation-settings` outside the `html` rule. At most 4 Fraunces and 5 Inter sizes. (runtime)
- [ ] Live numbers are Inter with `tabular-nums` ("1111" and "0000" match widths). Today's hero prints its count on the band. (runtime)
- [ ] Radii are 24, 18, 14, 12, pill or circle. Spacing is on the steps or a named exception (5.1). Gutter 16.
- [ ] Captions: Inter Tight 600, caps, +0.14 em, one per card, 4 words at most.
- [ ] Icons: 1.75 stroke, round caps, from the set or rule-abiding Lucide; no emoji; the Progress glyph is the set's.
- [ ] Copy: Orby (capital O, no "the", no "app"), "the assistant", American spelling, no em dashes, no model names outside required disclosures, at most one exclamation mark, sentence case.
- [ ] Tested at 200 percent text, with Reduce Motion and Increase Contrast on; targets 44 pt. (runtime)
- [ ] Only transform and opacity animate, plus the named cases in 9.1 (the dome's canvas is one: sprites drawn from a simulation, and a loop that stops at rest); durations match section 9; haptics fire on the peak frame, at most one per action (the three exceptions, 9.5: the splash's timed phrase, the one full-day beat, and the dome under the hand).
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
