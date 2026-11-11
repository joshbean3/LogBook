# Visual hierarchy, scanning and readability on phones: the evidence, turned into rules for Orby

Notes compiled 11 Nov 2026 for the layout and hierarchy pass on every Orby screen. Each finding is tagged with its source type:

- **[1P]** first-party platform guidance (Apple Human Interface Guidelines and WWDC, Google Material Design, W3C WCAG)
- **[PR]** peer-reviewed research
- **[RES]** research firm with a stated method (Nielsen Norman Group eye-tracking and usability studies, Baymard)
- **[PRAC]** practitioner opinion or a book of craft advice (Refactoring UI, Butterick's Practical Typography, Laws of UX, spec.fm). Useful, but not tested evidence.
- **(bib)** cited from the bibliographic record or abstract. I did not re-read the full paper in this session.

Apple HIG text was read from Apple's own JSON feed of the HIG pages (`developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`), so the quotes are current as of this session. Material's type scale was read from Google's own token file in the `material-components/material-web` repository, because m3.material.io renders client-side and could not be fetched.

How to use this file: each section ends with numbered rules (H1, H2, ...). Every rule says how to check it. Section 13 collects them into one checklist, and section 14 lists the places where the evidence pulls against the brand guide or an owner decision. The brand guide still wins where it speaks (CLAUDE.md). Where this file suggests changing a brand value, it says so and leaves the decision to the owner.

---

## 0. The short version (the ten rules that matter most)

1. **One focal point per screen.** The hero card is the biggest, highest-contrast thing on screen, and nothing else competes with it. Blur a screenshot: the hero should still be the first thing you see. (H23, H24)
2. **Spacing is the structure.** Space inside a group is clearly smaller than the space between groups: 4 to 8 inside, 12 between items, 32 between sections. The outer gap is at least 2x the inner one. (H6, H7)
3. **A container has to earn its place.** Use space first and a card second. A list of like items is one card with hairline rows, not a stack of cards. Never put a card inside a card. (H9, H31 to H34)
4. **At most three text sizes per card.** Levels that sit next to each other differ by about 1.2x in size or more, or else by weight and color together. (H12, H13)
5. **The screen's most important content and its one primary action sit in the top part of the first screen,** and something always crosses the fold so the screen never looks finished. (H1, H3)
6. **Front-load words.** Titles, labels and rows start with the word that carries the meaning. Reading only the section titles should tell you what the screen is about. (H2)
7. **One Sky primary per screen.** Everything else is secondary or quiet. (H25)
8. **Fold the rest, one level deep.** "More" shows a count and says what is inside. Never nest disclosure more than two levels. (H28 to H30)
9. **Charts state their takeaway in words and numbers above the plot.** Label lines directly, keep 3 to 5 faint gridlines, no borders, no legend for one or two series. (H36 to H43)
10. **Numbers are numerals with context.** "0 of 23 mi · 0 of 4 runs", tabular figures when they change, units smaller and in Dusk. (H44 to H50)

---

## 1. How people scan a phone screen

### Takeaway
People do not read app screens, they scan them. They look at the top first and spend most of their attention near it. They fixate on the start of lines and on headings, and they skip things on the right and lower down unless something gives them a reason to look. Headings that stand out produce the most efficient scan (the "layer-cake" pattern). With no strong cues, people fall back to the F-pattern, which misses content. Viewers also judge how appealing a screen is within a twentieth of a second, and simpler, more familiar layouts win that judgment.

### Findings
- **[RES]** The F-pattern (first found in 2006) still showed up in 2017 eye-tracking on both desktop and **mobile**. It is "the default pattern when there are no strong cues to attract the eyes towards meaningful information". Remedies: put the most important points first, use headings that stand out and "start them with the most informative words", group related content visually, bold key words, use lists, cut content. Pernice, NN/g, 12 Nov 2017. https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
- **[RES]** Four scanning patterns, from worst to best: F, spotted, layer-cake and commitment. Layer-cake (the eye moves heading to heading and drops into the body under the heading it wants) is "by far the most effective way in which users can scan pages". It depends on meaningful subheadings. Pernice, NN/g, 25 Aug 2019. https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/
- **[RES]** Attention falls off at the fold. Across 57,453 fixations, the 100 px just above the fold were "viewed 102% more" than the 100 px just below it. Small screens force more scrolling, but "users scroll when there is reason to". Pages with little at the top create "false floors" that make people think they have reached the end. "Designs shouldn't need an arrow to tell users to scroll." Schade, NN/g, 1 Feb 2015. https://www.nngroup.com/articles/page-fold-manifesto/
- **[RES]** In a 2018 re-run on desktop (130,000+ fixations), 57% of viewing time went above the fold, 74% to the first two screenfuls and 81% to the first three. Advice: "Reserve the top of the page for high-priority content". This study did not cover mobile. Fessenden, NN/g, 15 Apr 2018. https://www.nngroup.com/articles/scrolling-and-attention/
- **[PR]** On phones, "the average user attention is focused on the top half of the phone" in a lab eye-tracking study of mobile search. Lagun, Hsieh, Webster and Navalpakkam, SIGIR 2014, doi:10.1145/2600428.2609631 (bib). https://research.google/pubs/towards-better-measurement-of-attention-and-satisfaction-in-mobile-search/
  - A widely repeated figure (68% of attention in the top half and center of a phone screen, 86% in the top two-thirds) traces to a vendor study (Briggsby) that I could not verify. Do not cite it.
- **[RES]** Comprehension on phones is about the same as on desktop, but hard text is read about 30 ms per word slower on a phone. "The need for brevity and prioritization is still critical." Moran, NN/g, 11 Dec 2016. https://www.nngroup.com/articles/mobile-content/
- **[1P]** Apple: "People often start by viewing content in reading order, from top to bottom and from the leading to trailing side, so place the most important items near the top and leading side." Also: "Align elements to make them easier to scan, and use indentation to convey hierarchy … they perceive indented items as subordinate to the item they follow." HIG, Layout, Visual hierarchy. https://developer.apple.com/design/human-interface-guidelines/layout
- **[PR]** People judge visual appeal within 50 ms, and those judgments match ratings made after longer viewing. Lindgaard, Fernandes, Dudek and Brown, *Behaviour & IT* 25:115–126, 2006, doi:10.1080/01449290500330448 (bib). https://www.nature.com/news/2006/060109/full/news060109-13.html
- **[PR]** Visual complexity and prototypicality (how much a design looks like what people expect of its kind) both shape aesthetic judgments within 17 to 50 ms. Designs with **low visual complexity and high prototypicality** were rated most appealing. Complexity is processed first. Tuch et al., *IJHCS* 70(11):794–811, 2012 (bib). https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/
- **[PR]** Across 450 websites rated by 548 people, models of perceived visual complexity and colorfulness explained about half the variance in appeal ratings after 500 ms. Complexity mattered much more than colorfulness. Reinecke et al., CHI 2013 (bib). https://kgajos.seas.harvard.edu/papers/reinecke13aesthetics.pdf
- **[RES]** The aesthetic-usability effect: people rate attractive products as easier to use, which can mask real usability problems in testing. It forgives minor problems, not major ones. Moran, NN/g, 3 Feb 2024 (origin: Kurosu and Kashimura, 1995). https://www.nngroup.com/articles/aesthetic-usability-effect/

### Inferences for Orby
- The owner's complaint ("not appealing to the consumer eye") is largely a complexity complaint. The fastest win in the evidence is fewer competing elements and fewer distinct visual treatments, not more decoration.
- Prototypicality argues for familiar iOS shapes: the large title, inset grouped lists, segmented controls, one hero. Orby's brand already uses these. The rework should lean on them rather than invent new containers.
- On a 390 x 844 iPhone, Orby's floating dock takes about 154 pt at the bottom (tab capsule 56, ask bar 48, gap 8, 8 above a 34 pt safe area) and the status bar about 47 to 59 pt at the top. That leaves roughly **630 pt of visible content on the first screen**, title included. That is the real fold for the rules below. (My estimate from the tokens; measure it in Playwright.)

### Rules
- **H1. Top-loaded focus.** On first load at 390 x 844, the screen's focal element (the hero card) and its one primary action are fully visible above the dock. At 320 x 844 at least the focal element is. *Check:* Playwright, `getBoundingClientRect().bottom` of the hero is less than `innerHeight` minus the dock height.
- **H2. Front-loaded words and a layer-cake skim.** Every section title, card title and row title starts with the word that carries the meaning ("Habits", "Long run Saturday", not "Your list of habits for today"). *Check:* read only the screen title, the hero's text and the section titles, top to bottom. They should tell you what the screen is for and what to do next.
- **H3. No false floor.** At the first-screen fold, some content crosses the fold line: a card edge, the next section title, or the top of a grid. No full-width block of empty space or flat color ends right at the fold. *Check:* screenshot at each width and look at the 80 pt band above the dock.
- **H4. Leading edge first.** If a value is the reason a row exists (miles, a streak count, a time), it belongs in the row's title or directly after it, not only as a trailing detail. Trailing values are fine for settings-style rows where the label is what people scan for. *Check:* for each row type, ask "what is the user looking for here?" and confirm it is on the leading side.
- **H5. Familiar before novel.** Use a standard iOS pattern unless a custom one carries information the standard one cannot (the U-arc gauge and the week strip are approved exceptions). *Check:* list every distinct component on the screen. Each custom one needs a stated reason.

---

## 2. Grouping: proximity first, then similarity, then containers

### Takeaway
Space alone can express almost all of a screen's structure. Items close together read as one group, items farther apart read as separate. Proximity can overpower similarity of color or shape. A shared container (common region) is the strongest grouping cue, but it adds visual clutter, so use it only when space cannot do the job.

### Findings
- **[RES]** "Items close together are likely to be perceived as part of the same group." Proximity "can overpower competing visual cues such as similarity of color or shape". Text should sit closer to its own heading than to the section before it. "Distant elements get overlooked": a Skip link placed far from the main actions made users think sign-in was required. Recheck groupings at each screen size, because stacking on mobile pulled related links apart. Harley, NN/g, 2 Aug 2020. https://www.nngroup.com/articles/gestalt-proximity/
- **[RES]** Common region: "items within a boundary are perceived as a group and assumed to share some common characteristic or functionality." Use whitespace first when it is enough, and borders or backgrounds when it is not (for example, several different kinds of element that must read as one unit). Overuse warnings: decorative containers add clutter, and full-width colored bands can create false floors. Ask before adding a container: is it needed, would whitespace work, were users confused without it? Harley, NN/g, 12 Jul 2020. https://www.nngroup.com/articles/common-region/
- **[PR]** Common region was established as its own grouping principle, distinct from proximity and closure, by Palmer, "Common region: A new principle of perceptual grouping", *Cognitive Psychology* 24(3):436–447, 1992, doi:10.1016/0010-0285(92)90014-S (bib). https://pubmed.ncbi.nlm.nih.gov/1516361/
- **[RES]** Similarity: "Items which share a visual characteristic are perceived as more related than items that are dissimilar." "Same size means the same visual prominence." Reserve the link color for things that are tappable. Make distinct things look distinct. Harley, NN/g, 6 Sep 2020. https://www.nngroup.com/articles/gestalt-similarity/
- **[1P]** Apple: "Group related items to clearly express related information or functions. For example, you might use negative space, container shapes, or separator lines." HIG, Layout. https://developer.apple.com/design/human-interface-guidelines/layout
- **[PRAC]** Refactoring UI (Wathan and Schoger), as summarized in a review: "When groups of elements are not separated by a border or through background color, things can get confusing". Fix it with spacing: keep labels close to their inputs and leave more space between groups. Also: "Use fewer borders". Use shadows, background color or extra space instead. https://dev.to/updivision/book-review-refactoring-ui-by-adam-wathan-steve-schoger-2f7m
- **[PRAC]** Laws of UX restates proximity: "Objects that are near, or proximate to each other, tend to be grouped together." https://lawsofux.com/law-of-proximity/

### Inferences for Orby
- Orby's spacing tokens already encode a proximity ladder: 4 and 8 (inside a group), 12 (`--gap`, `--sec-gap`, `--gap-tile`), 32 (`--section`), 48 (`--sp-12`). The ladder only works if each step is used for its level. The most common way it breaks is a value from one level used at another, for example 12 between a card title and its own subtitle (too far) or 16 between two sections (too close).
- Section header to first card is 12 and between sections is 32, a ratio of 2.7:1. That is a clear proximity signal. Keep it.
- Inside a card, padding is 16 and the gap between cards is 12. The card edge (common region) carries the grouping there, so this is fine. When a card is removed and its content sits on the ground, space alone must carry the grouping, and the outer gap has to grow to the section step.

### Rules
- **H6. The proximity ladder.** Use 4 to 8 between parts of one item (title and subtitle, number and unit, label and value), 12 between items in a group (rows, tiles, cards), 12 from a section title to its content, and 32 between sections. Use 48 only between major zones (for example, after the hero on a tab root, if a zone break is wanted). *Check:* `check-brand.mjs` for off-step values, then read the computed margins on each screen and map each to its level.
- **H7. Outer is at least 2x inner.** At every grouping level, the space around a group is at least twice the largest space inside it. A title sits at least 2x closer to its own content than to the content above it. *Check:* in DevTools or Playwright, compare the gap above each section title with the gap below it. Above should be at least 2x below.
- **H8. One grouping cue at a time.** Do not stack cues that say the same thing (a card and a hairline at its top edge and a tinted header and extra space). Pick the weakest cue that works: space, then a hairline, then a container. *Check:* for each group, count the cues. More than one is a smell that needs a reason.
- **H9. Containers only when space fails.** Add a card or tint only if (a) the group mixes different kinds of element that must read as one unit, (b) the group is one tappable target, or (c) testing or a screenshot review shows people misgroup without it. *Check:* for each card, name which of (a), (b) or (c) applies.
- **H10. Like is styled alike, unlike is styled unlike.** Same function means the same size, weight, color and shape across all screens (every quiet link is Deep Sky 600, every caption eyebrow is caption style). Nothing decorative wears the link color or the primary fill. *Check:* list text styles and colors in use on a screen and match each to one role in brand section 4.2.
- **H11. Align to one leading edge.** Within a card, all text shares one leading edge (16 in from the card edge, or aligned after an icon tile). Indent only to show subordination. Charts align their leading edge with the text above them. *Check:* overlay a vertical guide at x = gutter + card padding in a screenshot.

---

## 3. The type scale and contrast that make levels readable

### Takeaway
Hierarchy comes from three dials: size, weight and color (contrast). Platforms step their type sizes by roughly 1.1x to 1.4x, and where two adjacent levels are close in size they separate them by weight. Apple's Headline and Body are both 17 pt and differ only by weight. Using too many sizes muddies the hierarchy. NN/g suggests no more than three per design. Low-contrast gray text is a common way to "de-emphasize" that fails legibility, and thin weights hurt small text.

### Findings
- **[1P]** Apple: "Adjust font weight, size, and color as needed to emphasize important information and help people visualize hierarchy. Be sure to maintain the relative hierarchy and visual distinction of text elements when people adjust text sizes." "Minimize the number of typefaces you use." "In general, avoid light font weights … prefer Regular, Medium, Semibold, or Bold." iOS default text size is **17 pt, minimum 11 pt**. HIG, Typography. https://developer.apple.com/design/human-interface-guidelines/typography
- **[1P]** Apple iOS text styles at the default (Large) size, in points, size / leading / weight: Large Title 34/41 Regular, Title 1 28/34, Title 2 22/28, Title 3 20/25, **Headline 17/22 Semibold, Body 17/22 Regular**, Callout 16/21, Subhead 15/20, Footnote 13/18, Caption 1 12/16, Caption 2 11/13. Adjacent steps run 1.06x to 1.27x. Same source, Specifications.
- **[1P]** Apple on leading: loose leading helps in wide columns and long passages, tight leading helps in height-limited rows, but "if you need to display three or more lines of text, avoid tight leading even in areas where height is limited." Same source.
- **[1P]** Material 3 baseline type scale (rem at a 16 px root, from Google's token file): Display 3.5625/2.8125/2.25, Headline 2/1.75/1.5, Title 1.375/1/0.875, Body 1/0.875/0.75 (line 1.5/1.25/1 rem), Label 0.875/0.75/0.6875. Body Large is 16 px on 24 px leading. Steps run 1.09x to 1.375x. https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss
- **[RES]** NN/g: create hierarchy with color and contrast, scale and grouping. Make the most important element the biggest and "limit large elements to two". Use **no more than three type sizes**. Squint at, or blur, the design to check where emphasis lands (they blurred at 5, 10 and 20 px). Gordon, NN/g, 17 Jan 2021. https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- **[RES]** "Low-contrast text may be trendy, but it is also illegible, undiscoverable, and inaccessible." Light gray text reads as disabled. Instead of lowering contrast, reduce density, change size, reposition or add padding. Sherwin, NN/g, 7 Jun 2015. https://www.nngroup.com/articles/low-contrast/
- **[1P]** WCAG 2.2: text contrast at least 4.5:1 (3:1 for large text, 24 px regular or 18.66 px bold and up), SC 1.4.3. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html. Non-text UI parts and meaningful graphics at least 3:1, SC 1.4.11. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html. Apple's own table matches: text up to 17 pt needs 4.5:1. HIG, Accessibility. https://developer.apple.com/design/human-interface-guidelines/accessibility
- **[PRAC]** Refactoring UI: emphasize by de-emphasizing (soften the competitors instead of shouting louder), use weight and color before size, and remember that "most pages only have one true primary action". https://dev.to/updivision/book-review-refactoring-ui-by-adam-wathan-steve-schoger-2f7m

### Orby's scale against this evidence
Orby's brand scale (guide 4.2) in px at a 16 px root: title 38, stamp 40, section 26, card title 22, sentence 22 italic, row 17/600, body 16/400, sub 15/500 Dusk, foot 13 Dusk, tile 15/600, caps 11.

| Pair that often sits together | Size ratio | Other dials | Verdict |
|---|---|---|---|
| Screen title 38 / section 26 | 1.46 | same family | Clear. |
| Section 26 / card title 22 | 1.18 | both Fraunces 600 | **Weak.** Close in size, same face and weight. Keep them apart in space, or use only one of them in a given area. |
| Card title 22 / row 17 | 1.29 | serif vs sans | Clear. |
| Row 17/600 / body 16/400 | 1.06 | weight 600 vs 400 | Fine. This is Apple's Headline vs Body move. |
| Body 16 Ink / sub 15 Dusk | 1.07 | weight 400 vs 500, Ink vs Dusk | Fine. Color carries it. |
| Tile name 15/600 / sub 15/500 Dusk | 1.0 | weight and color | Fine if both differ. Never two 15 px lines in the same color and weight. |

### Rules
- **H12. Three sizes per card, four per screen plus the title.** A card uses at most three text sizes. A screen uses at most four besides the screen title and hero numbers. *Check:* collect the computed `font-size` of every visible text node inside each card (Playwright) and count the distinct values.
- **H13. Adjacent levels differ clearly.** Two text levels that sit next to each other differ by a size ratio of about 1.2 or more, **or** by weight (150 or more units apart) **and** color (Ink vs Dusk). *Check:* for each heading-plus-text pair, compute size ratio, weight difference and color.
- **H14. Section title and card title do not stack.** Do not put a 26 px section title directly above a card whose first line is a 22 px card title. Either the section title names the group and the card has no title, or the card title stands alone without a section title. *Check:* look for section-title-then-card-title sequences.
- **H15. De-emphasize with Dusk and weight, not with faint gray or tiny type.** Secondary text uses the Dusk token at a brand-approved pairing, at or above 4.5:1. No opacity tricks below that. No text under 11 px. No weights under 400 for text under 20 px. *Check:* the brand audit tool's contrast pass, plus `check-brand.mjs`.
- **H16. Hierarchy survives Larger Text.** At iOS Larger Text sizes (test at 200% root size), the order of emphasis is unchanged, nothing truncates to meaninglessness, and multi-column grids may drop to one column at accessibility sizes (Apple: "Reduce the number of columns when the font size increases"). *Check:* Playwright with `html { font-size: 200% }`, screenshot every tab root.

---

## 4. Body text on a phone: line length, leading and size

### Takeaway
The classic comfortable measure is about 45 to 90 characters (Butterick) or 50 to 75 (NN/g), with an on-screen sweet spot near 55 (Dyson and Haselgrove). Leading of 120% to 145% of the size suits most text, and 150% is the WCAG reference for readable paragraphs. On phones the problem is the opposite of the desktop: lines run short, so do not shorten them further with extra insets. Bigger type helps reading up to about 18 px for text-heavy pages.

### Findings
- **[PRAC]** "Aim for an average line length of 45–90 characters, including spaces." https://practicaltypography.com/line-length.html. "For most text, the optimal line spacing is between 120% and 145% of the point size." https://practicaltypography.com/line-spacing.html. Body text on screens: 15 to 25 px. https://practicaltypography.com/point-size.html (Butterick)
- **[RES]** Chunk text with short paragraphs, lines of about 50 to 75 characters, clear headings, highlighted keywords and lists. Moran, NN/g, 20 Mar 2016. https://www.nngroup.com/articles/chunking/
- **[PR]** On screen, comprehension was best at about 55 characters per line, and 55 and 100 cpl were read faster than 25 cpl at fast reading speeds. Dyson and Haselgrove, *IJHCS* 54(4):585–612, 2001 (bib, figures via secondary summaries). https://www.humanfactors.com/newsletters/optimal_line_length.asp
- **[PR]** Across font sizes from 10 to 26 pt, readability and comprehension rose with size up to about 18 pt. 10 and 12 pt did worst. Line spacing mattered much less, and only the extremes hurt comprehension. The authors recommend 18 pt or larger for text-heavy pages. Rello, Pielot and Marcos, CHI 2016, doi:10.1145/2858036.2858204 (bib). https://researchr.org/publication/RelloPM16
- **[1P]** iOS body text defaults to 17 pt on 22 pt leading (about 129%). HIG, Typography. https://developer.apple.com/design/human-interface-guidelines/typography
- **[1P]** WCAG 2.2 SC 1.4.12 (text spacing) requires layouts to survive line height raised to 1.5x, and SC 1.4.8 (AAA) recommends at least 1.5 line spacing in paragraphs. https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html

### Measured: characters per line in Orby
I measured Inter (the app's own `Inter-latin.woff2`) on a representative English paragraph in Chromium at each width, with Orby's 16 px gutter and 16 px card padding (hero 20). Average characters per line, spaces included:

| Width | Page column, body 16 | In a card, body 16 | In a card, 17 | Hero, body 16 | In a card, sub 15 |
|---|---|---|---|---|---|
| 320 | 42 | **37** | 36 | 36 | 39 |
| 390 | 55 | 49 | 47 | 49 | 51 |
| 440 | 63 | 55 | 52 | 55 | 61 |

At 390 and 440, body text in a card lands in the comfortable 45 to 65 band. At 320 it falls to about 37, below every recommended minimum. On iPad or web, a body block at the full `--maxw` 720 would run to about 100 characters, above the band.

Orby's body is 16/24 (150%). That is at the top of Butterick's range and on the WCAG reference, which suits short phone lines and long assistant replies.

### Rules
- **H17. Do not shorten lines further.** Reading text (assistant replies, journal entries, learned notes, the plan summary) uses the full card width. No nested card or extra side inset around paragraphs, and never two text columns side by side. *Check:* at 320 x 844, a paragraph in a card should run about 36 or more characters per line. If it runs fewer, an extra inset is stealing width.
- **H18. Cap the measure on wide screens.** A paragraph block never runs wider than about 70 characters (`max-inline-size: 36rem` is about 65 to 70 Inter characters at 16 px), even inside the 720 px column on iPad or web. *Check:* Playwright at 1024 wide, measure the paragraph width.
- **H19. Leading by job.** Paragraphs use 1.5. Headings that wrap to two lines use their token's line height (about 1.1 to 1.3). Never tight leading on three or more lines (Apple). Tile names wrap to two lines, never truncate. *Check:* computed `line-height` against brand 4.2.

---

## 5. Density versus breathing room

### Takeaway
White space helps when it separates groups, frames the one focal element and lowers visual complexity, which drives first impressions. It hurts when it spreads related content across screens, pushes the important thing below the fold, or ends a screen in an empty band that looks like the bottom. For a daily-use personal tool, the right density is "everything for today visible in a scroll or two, grouped tightly, with clear gaps between groups". Blanket airiness is not the goal.

### Findings
- **[PRAC]** Refactoring UI: start with more white space than seems necessary, then tighten. "To make something look great, you will often need more whitespace than you initially thought." https://dev.to/updivision/book-review-refactoring-ui-by-adam-wathan-steve-schoger-2f7m
- **[RES]** Content dispersion: low-density, image-heavy, mobile-first layouts spread content across many viewports. That raises scrolling, raises cognitive load (people must remember one viewport while viewing the next) and creates an illusion of completeness. "Keep critical, related content grouped together in the same viewport." Flaherty, Neusesser and Chitale, NN/g, 13 Oct 2023. https://www.nngroup.com/articles/content-dispersion/
- **[RES]** False floors: large blocks of empty space or flat color make people stop scrolling. Schade, NN/g, 2015 (above). https://www.nngroup.com/articles/page-fold-manifesto/
- **[RES]** Reading difficult content on mobile took more time, likely because earlier content was no longer visible to glance back at. Budiu, NN/g, 29 Apr 2018. https://www.nngroup.com/articles/working-memory-external-memory/
- **[PR]** Low visual complexity predicts appeal (Tuch 2012, Reinecke 2013, above). Complexity is not the same as white space. It comes from the number of distinct elements, colors, edges and alignments. A dense but orderly screen can be low in complexity.
- **[RES]** Baymard (e-commerce lists, paywalled detail) describes the same tension on mobile: users need enough information per item to avoid needless taps, but the small screen makes items hard to compare. https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/product-list

### Rules
- **H20. White space goes between groups, not inside them.** If a screen feels cramped, first widen the gaps between sections (to 32) and tighten the space inside groups. Only then remove content. If a screen feels empty, look for gaps that are too wide inside groups. *Check:* run H6 and H7 on the screen.
- **H21. Today's essentials fit in about two screens.** On each tab root at 390 x 844, everything a person needs today (not history, not "further out") fits in the first two screenfuls, about 1,260 pt of scroll. *Check:* Playwright, `document.scrollingElement.scrollHeight` up to the last "today" element.
- **H22. Remove before you shrink.** When a screen is too long, cut or fold redundant items (repeated counts, duplicate titles, stats that restate the hero) before reducing sizes or gaps. This matches the pending Learned tile removal and the Journal Library removal. *Check:* for each element, ask "does anything else on this screen already say this?"

---

## 6. One focal point and one primary action per screen

### Takeaway
Attention goes to the element with the most visual weight: size, contrast, saturation and isolation. A single odd element pops out pre-attentively, while several emphasized elements cancel each other out. Every screen needs exactly one element that wins and exactly one primary action.

### Findings
- **[RES]** "Limit large elements to two." Make the most important element the biggest. Use bright, warm color sparingly. NN/g, Gordon 2021 (above). https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- **[PR]** Pre-attentive features (color, size, orientation, motion) let a single target "pop out" of a field of distractors quickly. The effect weakens as more items share the feature. Healey and Enns, "Attention and Visual Memory in Visualization and Computer Graphics", *IEEE TVCG* 18(7):1170–1188, 2012, doi:10.1109/TVCG.2011.127 (bib). https://www.csc2.ncsu.edu/faculty/healey/download/tvcg.12a.pdf
- **[RES]** Shared color signals equal importance, so the primary call to action needs a color of its own. NN/g, similarity (above). https://www.nngroup.com/articles/gestalt-similarity/
- **[PRAC]** "Most pages only have one true primary action". Refactoring UI, via review (above).
- **[1P]** Orby brand: one Sky primary button per screen, one hero card per screen, one sunrise glow per screen, orange only for now-marks. Brand guide 5.3, 6.2 and 6.4.

### Rules
- **H23. The blur test.** Blur a 390 x 844 screenshot (CSS `filter: blur(8px)` on the root at 2x, roughly NN/g's 10 px). The first thing you notice must be the hero card, and the second must be the next thing the person should do. *Check:* Playwright screenshot with the filter, then look at it.
- **H24. One winner.** Exactly one element per screen is both the largest block and the highest contrast block: the hero card. No other card gets a glow, a tint, a larger radius or a larger title. Any second-largest element is clearly smaller. *Check:* list the elements with the largest area and the strongest contrast. They should be the same element.
- **H25. One Sky primary.** At most one Sky-filled button is visible at any scroll position (the brand says one per screen). Other actions are secondary (Paper with an edge) or quiet (Deep Sky text). *Check:* count `background: var(--sky)` buttons per screen in Playwright.
- **H26. One warm accent.** Sunrise and Ember appear only as now-marks (today's dot, the pointer, the NOW tick, the Today tag). Several orange marks on one screen cancel each other out. *Check:* count orange marks in a screenshot. Each must be a now-mark.
- **H27. Tap spacing.** Adjacent tappable things have room around them. Apple: "about 12 points of padding around elements that include a bezel … about 24 points … around [elements without a bezel]", and 44 x 44 pt targets. HIG, Accessibility. *Check:* measure the gaps between neighboring quiet links and between pills.

---

## 7. Progressive disclosure

### Takeaway
Show what most people need most of the time and put the rest one tap away, behind a label that says what is there. More than two levels of disclosure gets people lost.

### Findings
- **[RES]** Progressive disclosure "defers advanced or rarely used features to a secondary screen". It improves learnability, efficiency and error rate. Put everything frequently needed up front. Make the path to the rest obvious and labeled. Designs that go beyond two disclosure levels typically have low usability, because people get lost moving between levels (paraphrased). Nielsen, NN/g, 3 Dec 2006. https://www.nngroup.com/articles/progressive-disclosure/
- **[1P]** Apple: "Use progressive disclosure to make layouts cleaner and easier to interact with. An interface with too much content and too many choices makes it harder to find information quickly." HIG, Layout. https://developer.apple.com/design/human-interface-guidelines/layout
- **[1P]** Apple on charts: "Keep a chart simple, letting people choose when they want additional details." HIG, Charting data. https://developer.apple.com/design/human-interface-guidelines/charting-data
- **[RES]** Accordions help on mobile but fragment content that must be read in sequence. NN/g, content dispersion and low-contrast articles (above).

### Rules
- **H28. Frequent up front, rare behind one tap.** Each screen's primary content is what the person uses daily. History, settings, edit modes and details sit behind one tap. *Check:* for each visible element, ask "is this used most days?" If not, it is a candidate to fold or move.
- **H29. Folds say what is inside.** A fold or "More" control shows a count or a preview ("3 more", "History >"). It never collapses something the person must act on today. *Check:* every disclosure control has a count or a noun.
- **H30. Two levels at most.** Screen, then sheet or pushed page, then stop. No accordion inside a sheet inside a pushed page. *Check:* trace the deepest path on each tab.

---

## 8. Cards and "card soup"

### Takeaway
Cards suit a few mixed, browsable items that each lead somewhere. They are worse than lists for scanning, comparing and ranking. When every item gets its own card with a shadow, the screen fills with edges and shadows that compete, the ranking flattens, and fewer items fit. That is card soup, and it raises visual complexity, the strongest predictor of a poor first impression.

### Findings
- **[RES]** "Cards work best for collections of heterogeneous items." "Card layouts are less scannable than lists." Cards are "a poor choice when users need to compare between multiple options", "typically deemphasize the ranking of content", and fit fewer items per screen. For homogeneous items, use a list (or a grid for images). Laubheimer, NN/g, 6 Nov 2016. https://www.nngroup.com/articles/cards-component/
- **[RES]** Decorative containers add clutter. Use whitespace first. NN/g, common region (above).
- **[1P]** Apple: "Prefer displaying text in a list or table … the row-based format is especially well suited to making text easy to scan and read." "Keep item text succinct." HIG, Lists and tables. https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- **[PRAC]** Refactoring UI: remove backgrounds from secondary content. "Simply place the secondary content directly on the page background." Use fewer borders. Via review (above).

### Rules
- **H31. A card is one unit.** A card holds one thing the person reads or acts on as a unit (the hero, the Today goal, one plan session that opens). *Check:* can you name the card in two or three words? If you need "and", it may be two cards or a list.
- **H32. Like items are one card with rows.** Three or more homogeneous items (entries, sessions in a week, history items, settings) are one Paper card with hairline rows (the inset group, brand 6.4), not one card each. The habit tile grid is the approved exception, because each tile is a tap target with its own state. *Check:* look for runs of three or more sibling cards with the same structure.
- **H33. No card in a card.** Nothing inside a card has its own shadow or Paper fill on Paper. Use hairlines, Haze icon tiles or space. *Check:* Playwright, any element with `box-shadow` whose ancestor also has one.
- **H34. Secondary content sits on the ground.** Captions, footnotes, history links, "further out" lists and empty-state hints sit on the wash without a card unless H9 applies. *Check:* for each card, ask "would this be lost without its card?"
- **H35. Shadow budget.** Count the shadowed surfaces in the first screenful. Each one should map to a tappable unit or the hero. If the count rises above about 8, look for H32 merges. This number is my heuristic, not a measured threshold. *Check:* count `box-shadow` elements in the first viewport.

---

## 9. Charts people can read at a glance

### Takeaway
A phone chart should make one point. It should say that point in words and a number above the plot, use position or length rather than angle or area, label its lines directly, use a few faint gridlines at familiar intervals, and leave out borders and legends it does not need.

### Findings
- **[1P]** Apple, "Design an effective chart" (WWDC22): "An effective chart focuses on a few key pieces of information." Use a title that states the meaning and the main takeaway ("Total Sales: 1,234 Pancakes") instead of a small axis label. Label the start and end of the range. Too few gridlines hinder estimating and too many distract. Use intuitive intervals ("steps of seven days"). Omit gridlines and labels on "sneak-peek" charts. Stretch touch targets to the full chart height. Use color as an addition, never the only cue. "Remove color to draw attention." https://developer.apple.com/videos/play/wwdc2022/110340/
- **[1P]** Apple HIG, Charts: "Too many grid lines can be visually overwhelming … too few grid lines can make it difficult to estimate a mark's value." Prefer familiar tick sequences (0, 5, 10). Bars start at zero. Lines may use a dynamic range. "Summarize the main message of your chart." In compact widths, "maximize the width of the plot area", keep vertical axis labels short and put units in the title. Align the chart's leading edge with surrounding views, for example by moving the Y axis to the trailing side. https://developer.apple.com/design/human-interface-guidelines/charts
- **[1P]** Apple HIG, Charting data: "Not every collection of data needs to be displayed in a chart … consider … a list or table." Prefer common chart types. https://developer.apple.com/design/human-interface-guidelines/charting-data
- **[RES]** Length and 2D position are best for quantities. Area and angle are hard to compare, so pies, donuts and **gauges** are weaker (gauges take a lot of space and rely on angle, per the article). Color "should not be used to communicate information about quantitative values or magnitude". Laubheimer, NN/g, 18 Jun 2017. https://www.nngroup.com/articles/dashboards-preattentive/
- **[PR]** Accuracy ranking for judging quantities: position on a common scale, then position on non-aligned scales, then length, then angle and slope, then area. Cleveland and McGill, *JASA* 79(387), 1984 (bib). Replicated with crowdsourcing by Heer and Bostock, CHI 2010. https://homes.cs.washington.edu/~jheer/files/jheer-crowdflower.pdf
- **[PR]** Gridlines should "whisper": there is a predictable range of grid transparency that is visible but unobtrusive, and grids outside it are clearly bad. Bartram and Stone, *IEEE TVCG* 17(10):1444–1458, 2011, doi:10.1109/TVCG.2010.237. https://tableau.com/sites/default/files/2023-01/2011-WhisperGrids.pdf
- **[PR]** Legends placed in a way that does not match the data layout cost time and extra eye movements between legend and data once a graph gets complex. Direct labels avoid the lookup but can clutter dense graphs. Huestegge and Philipp, *Attention, Perception & Psychophysics*, 2011. https://link.springer.com/article/10.3758/s13414-011-0155-1

### Rules
- **H36. Headline first.** Every chart has a text headline above it with the number and the takeaway ("31.4 mi this month · 4 mi ahead of plan"), in Inter 650 tnum (brand 6.8). *Check:* hide the plot. The headline alone should answer "how am I doing?"
- **H37. Direct labels, no legend for two series.** Plan versus actual labels each line at its end ("Plan", "You") in caption style, in the line's color or with its dash pattern. Use a legend only when there are more than 4 series (the brand caps series at 4 anyway). *Check:* no legend element on any chart with 4 or fewer series.
- **H38. Three to five faint gridlines.** Horizontal gridlines only, at familiar intervals (0, 5, 10 mi, or multiples of 10). Brand `rgba(14,34,54,.08)`. No vertical gridlines on time charts unless they mark weeks. No chart border or plot background. *Check:* count gridlines per chart.
- **H39. Full-width plot.** The plot runs the full content width. Y labels are short (units in the headline) and sit on the trailing side or inside the plot, so the chart's leading edge lines up with the text above it. *Check:* compare the plot's left x with the headline's left x.
- **H40. Honest baselines.** Bars start at 0. Lines (pace, heart rate, weekly miles over a year) may use a dynamic range that puts the max near the top. *Check:* inspect the axis domain.
- **H41. Range control.** The pending running-chart range views (1W, 1M, 3M, 6M, YTD, 12M, All) are a familiar sequence, so seven options is fine for recognition (see section 11). Each segment needs a 44 pt tall hit area. At 320 wide the content column is 288 pt, so seven segments get about 41 pt each. That passes WCAG 2.2 SC 2.5.8 (24 x 24 minimum, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and Apple's 28 x 28 floor, but is under Apple's recommended 44. Options for the owner: accept 41 pt wide by 44 pt tall segments at 320 only, or drop one option (for example, YTD) below about 350 pt wide. Default to the range people check most (1M is likely). *Check:* measure segment widths at 320, 390 and 440.
- **H42. No new angle charts.** The U-arc gauge stays (owner-approved), with its required text readout (brand 6.5). Do not add new gauges, rings or donuts to compare quantities. Use bars or lines. *Check:* any new circular chart needs a stated reason and a text readout.
- **H43. Sneak-peek charts drop the scaffolding.** Small preview charts (health tiles, trend sparklines) have no gridlines and no axis labels, only the headline number and the shape. *Check:* sparklines contain no tick text.

---

## 10. Numbers and data displays

### Takeaway
Numbers attract fixations because they are facts. Show them as numerals, give them context (of what, compared with what), keep units quiet, and use tabular figures where numbers change or line up.

### Findings
- **[RES]** Numerals "often stop the wandering eye" and draw fixations even in text users otherwise skip. Write numbers as digits. NN/g. https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/
- **[1P]** Apple, on chart values: "it's rarely enough to merely report a data value unless you also include context that helps people understand it." HIG, Charts. Also the WWDC22 talk's "June 1, 36 pancakes" form: context first, no abbreviations in spoken labels.
- **[PRAC]** Refactoring UI: labels are a last resort. When a format explains itself (a phone number, a pace), emphasize the value and drop the label. Via review (above).
- **[1P]** Orby brand: changing numbers use Inter 650 with `tabular-nums`, static hero numbers may use Fraunces, units are Inter 500 at 15 px in Dusk (4.2, 4.4). The hero readout reads "4.2 of 23 mi · 1 of 4 runs" (6.5).

### Rules
- **H44. Numerals, always.** "3 runs", never "three runs", in UI copy. *Check:* search copy for spelled-out numbers.
- **H45. Value, then context.** Every headline number carries its comparison: "of" a target, "vs" last week, or a date range. "0 of 23 mi · 0 of 4 runs", not "0 mi". The pending fix to restore the runs count in Today's hero readout follows this rule. *Check:* any lone number in a hero or tile needs a context string next to it.
- **H46. One big number per card.** A card has one number at stat size. Supporting numbers are row or sub size. *Check:* count `--fs-stat` and `--fs-stat-live` uses per card.
- **H47. Quiet units.** Units and labels are smaller and Dusk. The number is Night Ink. *Check:* computed styles on number and unit spans.
- **H48. Tabular where it changes or stacks.** Numbers that animate, update live or line up in columns use `font-variant-numeric: tabular-nums`. *Check:* `check-brand.mjs` and computed style.
- **H49. Meaningful precision.** Miles to one decimal, pace as m:ss, percentages as whole numbers, counts as integers. No "23.00 mi". (Practitioner convention, not tested evidence.) *Check:* scan the formatters in `packages/shared`.
- **H50. Zero is a value.** Show "0 of 4 runs" or an empty state with a next step. Never blank space where a number belongs. *Check:* load the seeded account on a fresh week.

---

## 11. Cognitive load: Hick, Miller, Cowan and chunking

### Takeaway
More choices take longer (Hick). Working memory holds about four chunks (Cowan), not seven, and Miller's seven is not a menu limit, because recognizing items in a visible list is easier than recalling them. The practical rules: chunk related items into small groups, recommend or preselect the likely choice, and do not make people remember things across screens.

### Findings
- **[PRAC]** Hick's law: "The time it takes to make a decision increases with the number and complexity of choices." Highlight recommended options. Do not oversimplify to abstraction. Laws of UX (origin Hick 1952, Hyman 1953). https://lawsofux.com/hicks-law/
- **[PRAC]** Miller's law: about 7 ± 2 items in working memory. The page warns against using the number "to justify unnecessary design limitations". Laws of UX. https://lawsofux.com/millers-law/
- **[PR]** Cowan's review puts the central capacity limit at **about four chunks**. Miller's seven was "more a rough estimate and a rhetorical device". Cowan, *Behavioral and Brain Sciences* 24(1):87–114, 2001, doi:10.1017/S0140525X01003922 (bib). https://pubmed.ncbi.nlm.nih.gov/11515286/
- **[RES]** The magical number seven is "often misunderstood to mean that humans can only process seven chunks at any given time". Menus rely on recognition, so they can work with more options if they are well structured. Moran, NN/g, 2016. https://www.nngroup.com/articles/chunking/
- **[RES]** Minimize extraneous load: "redundant links, irrelevant images, and meaningless typography flourishes slow users down." Build on familiar patterns, and offload work with defaults and by showing information again. "Every task you eliminate leaves more mental resources for the decisions that truly are essential." Whitenton, NN/g, 22 Dec 2013. https://www.nngroup.com/articles/minimize-cognitive-load/
- **[RES]** Give people external memory (show the thing again rather than asking them to remember it). Budiu, NN/g, 2018 (above).

### Rules
- **H51. Groups of about four.** Where people must hold or compare items (status chips, top tasks, stat tiles in a row, hero readout parts), keep a group to about four. Orby's top three to-dos and the 2-column tile grid fit. *Check:* count items per group.
- **H52. Preselect the likely choice.** Every choice control opens with the most likely option selected (today's tab, the default range, the time of day the person usually trains). *Check:* each segmented control and picker has a non-empty default.
- **H53. Familiar sequences may run longer.** Days of the week, date ranges and month calendars can show 7 or more options because people recognize them. Unfamiliar choices should show about 5 or fewer at once and fold the rest. *Check:* count the options in each control and decide which kind it is.
- **H54. Say it once.** No fact appears twice on one screen in two styles (the same count in a tile and in a sentence, the same title in a section header and a card header). *Check:* list the numbers and titles on a screen and look for repeats.
- **H55. Keep context in view.** When a sheet opens to edit something (the plan summary with the assistant, a goal), the thing being changed stays visible or is restated at the top of the sheet, so nobody has to remember it. *Check:* open each edit sheet and confirm the subject is named in it.

---

## 12. The spacing system: 4 and 8 point steps

### Takeaway
A fixed spacing scale built on 4 and 8 is a consistency and speed tool, not a law of perception. Its value is that every gap means one thing. Material uses an 8 dp grid with 4 dp for small elements and type. iOS does not publish a grid, so a "soft" grid (measure the space between elements, not a fixed lattice) fits iOS best.

### Findings
- **[PRAC]** "Use multiples of 8 to define dimensions, padding, and margin of both block and inline elements." Pair it with a 4 pt baseline grid. A soft grid suits iOS, "where system elements aren't on an even grid". spec.fm. https://spec.fm/specifics/8-pt-grid
- **[1P]** Material: components align to an 8 dp grid, while icons, type and some elements inside components align to 4 dp. Compact-window margins are 16 dp. (Read through Material 2 and secondary pages, because the M3 page renders client-side. The values are consistent across versions.) https://m1.material.io/layout/metrics-keylines.html
- **[PRAC]** Refactoring UI: define a spacing scale from a base value and pick from it. "Size is relative rather than absolute": a few pixels matter in small elements and not in large ones. Via review (above).
- **[1P]** Orby already has the scale: 4, 8, 12, 16, 20, 24, 32, 48, plus three named exceptions (brand 5.1). `check-brand.mjs` flags off-step spacing.

### Rules
- **H56. On-step only.** Padding, margin and gap use `--sp-*` or the named layout tokens. Nothing off-step except the three named exceptions. *Check:* `node apps/web/scripts/check-brand.mjs <folder>` adds no findings.
- **H57. Each step means one level.** Use the ladder in H6 consistently on every screen, so the same relationship always gets the same gap. *Check:* compare the same relationship (section title to content, row to row) across all six tabs. The values must match.
- **H58. Optical over arithmetic for small things.** Icons, discs and text can shift by 1 to 2 px for optical alignment (for example, centering a glyph in its tile). That is a component size, not spacing, and belongs in the component spec. *Check:* any sub-4 px value must be in a component spec or be a named exception.

---

## 13. Checklist for builders

Run this on every screen at 390 x 844, 320 x 844 and 440 x 956, on the seeded account, before calling the screen done. Most checks are a Playwright measurement or a screenshot you look at.

| # | Rule | How to check |
|---|---|---|
| H1 | Hero and primary visible on first screen | Hero bottom is above the dock at 390 |
| H2 | Front-loaded titles, layer-cake skim | Read only the titles and the hero |
| H3 | No false floor | Something crosses the fold |
| H4 | Key value on the leading side | Per row type |
| H5 | Familiar patterns, custom ones justified | List components |
| H6 to H8 | Proximity ladder, outer at least 2x inner, one cue | Measure the gaps above and below every section title |
| H9 | Each container justified | (a) mixed unit, (b) tap target, (c) misgrouped without it |
| H10 | Same role, same style | Map styles to brand 4.2 |
| H11 | One leading edge | Vertical guide overlay |
| H12 to H14 | At most 3 sizes per card, clear steps, no 26-over-22 stack | Computed font sizes |
| H15 | Dusk, not faint gray, 4.5:1 | Audit tool contrast |
| H16 | Hierarchy at 200% text | Screenshot at 200% root size |
| H17 to H19 | Measure at least 36 cpl at 320, no more than about 70 on wide screens, leading by job | Measure |
| H20 to H22 | Space between groups, today in about 2 screens, remove before shrink | Scroll height |
| H23 to H26 | Blur test, one winner, one Sky, orange only for now-marks | Blurred screenshot, counts |
| H27 | Tap spacing 12 or 24, 44 pt targets | Measure |
| H28 to H30 | Frequent up front, labeled folds, at most 2 levels | Trace |
| H31 to H35 | Card is one unit, like items as rows, no nesting, ground for secondary, shadow budget | Count shadows |
| H36 to H43 | Chart headline, direct labels, 3 to 5 gridlines, full width, honest baseline, ranges, no new gauges, bare sparklines | Inspect each chart |
| H44 to H50 | Numerals, context, one big number, quiet units, tnum, precision, zero | Inspect |
| H51 to H55 | About 4 per group, defaults, familiar sequences, say it once, context in sheets | Count |
| H56 to H58 | On-step spacing, consistent ladder, optical tweaks in specs | `check-brand.mjs` |

---

## 14. Where the evidence and the current brand or owner decisions pull apart

These need the owner's call. None of them is a reason to break the brand guide without asking.

1. **Body size 16 vs 17.** Apple's iOS default body is 17 pt. Rello et al. found reading improves up to about 18 px on text-heavy pages. Orby's body is 16 (brand 4.2), and the measured line length at 390 is a comfortable 49 characters. The case for 17 is strongest for long reading text: assistant replies, journal entries, the plan summary. At 17, a card line at 320 drops from 37 to 36 characters, which is a small cost. **Recommendation:** propose `--fs-body` at 1.0625 rem for reading surfaces only, and leave the UI rows alone. Owner decision, since the brand scale governs type.
2. **The U-arc gauge.** NN/g rates gauges as weak for reading quantities, because angle is less accurate than length. The owner approved the gauge, and the brand mitigates it with a mandatory text readout. Keep it, and keep the readout complete ("0 of 23 mi · 0 of 4 runs").
3. **Two columns at every width (brand 5.1) vs Apple's advice to drop columns at accessibility text sizes.** Keep two columns up to the largest standard size, and let the habit grid fall to one column at accessibility sizes. Owner and brand decision.
4. **Seven range options at 320 wide** (H41). Seven segments fit only at about 41 pt each. Owner choice between narrower segments at 320 and dropping one option at narrow widths.
5. **`--maxw` 720 on iPad and web** gives body lines of about 100 characters. Cap paragraph blocks at about 36 rem (H18). This does not affect the phone.
6. **Section title 26 directly over card title 22** is a weak step (1.18x, same face and weight). The rule (H14) avoids stacking them. It needs no token change.

## 15. Gaps

- I found no peer-reviewed study that sets a numeric spacing ratio between grouping levels. The "outer at least 2x inner" rule (H7) is a practitioner convention consistent with proximity research, not a measured threshold. The shadow budget (H35) and the "four sizes per screen" cap (H12) are my adaptations.
- NN/g's mobile-specific eye-tracking work on where people look on app screens (as opposed to web pages) was not retrievable. The "top half" finding rests on one peer-reviewed mobile search study (Lagun 2014) plus desktop fold data.
- Material 3's own spacing page could not be fetched (it renders client-side). Material numbers come from Google's token file and older Material pages.
- Refactoring UI is a paid book. Its principles here come through a third-party review, and the quotes are as that review gives them.
- Baymard's mobile layout guidelines are paywalled. Only its public summary is cited.
