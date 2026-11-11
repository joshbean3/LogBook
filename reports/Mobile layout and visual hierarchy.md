# One focal point, tight groups, fewer boxes: how to make Orby's screens read at a glance

Orby's screens do not need new colors, new fonts or new spacing values. They need clearer structure. Apple's guidance, the research on how people look at screens, and 14 of the best health, fitness and habit apps agree on five things.

- The most important item on a screen should be the most obvious one, and it should sit near the top.
- Space should do most of the grouping: things that belong together sit closer than things that do not.
- Containers have to earn their place. A list of like items is one card with rows, not a stack of cards.
- Type works best in a few clear levels.
- Everything that is not needed today waits one labeled tap away.

Measuring Orby at commit c6cc577 (390 x 844, the seeded account) showed the spacing tokens already in place: 32 px above every section title, 12 px below it, and 12 px between cards on every tab. The screens look busy for other reasons:

- Today's main card starts 43 percent of the way down the screen, under six rows. None of the 14 peer apps puts more than three rows above its focal element.
- Plan shows today's sessions twice, and Journal offers "Write today's entry" twice.
- Goals uses six different card shapes on one screen.
- Empty placeholders are as loud as real content.
- Some cards contain bordered boxes.
- Today renders more type sizes than the brand allows.

The resulting standard, `docs/brand/layout-and-hierarchy.md`, keeps every feature the owner approved and their order. It changes emphasis, grouping and density, and it changes only a handful of brand values. The evidence is uneven. Apple's guidance is expert opinion, not research. The peer-reviewed work is strongest on first impressions, grouping and chart perception. The app teardowns show convention, not proof. Where a rule rests on practitioner advice or on a heuristic, this report says so.

How to read the source labels: **first-party** means Apple or W3C guidance; **peer-reviewed** means a published study; **research firm** means Nielsen Norman Group studies with a stated method; **practitioner** means a book, blog, review or design system; **measured** means a measurement from App Store screenshots or from the running app.

---

## People judge a screen in a fraction of a second, and simpler wins

Visual appeal is judged within about 50 milliseconds, and those snap judgments match ratings made after longer viewing ([Lindgaard et al. 2006, *Behaviour & IT*](https://www.nature.com/news/2006/060109/full/news060109-13.html), peer-reviewed). Two properties drive that first judgment. Visual complexity (how many distinct elements, edges and alignments a screen has) and prototypicality (how much it looks like what people expect of its kind) both act within 17 to 50 ms. Designs that were low in complexity and high in prototypicality were rated most appealing ([Tuch et al. 2012, *IJHCS*](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/), peer-reviewed). Across 450 websites rated by 548 people, models of complexity and colorfulness explained about half the variance in appeal, and complexity mattered much more than color ([Reinecke et al. 2013, CHI](https://kgajos.seas.harvard.edu/papers/reinecke13aesthetics.pdf), peer-reviewed). Attractive products are also rated easier to use, which can hide minor usability problems but not major ones ([NN/g, aesthetic-usability effect](https://www.nngroup.com/articles/aesthetic-usability-effect/), research firm).

This reframes the owner's complaint that the screens are "not appealing to the consumer eye". It is mostly a complexity problem. The fastest fix in the evidence is fewer competing elements and fewer distinct treatments, not more decoration. Prototypicality also argues for familiar iOS shapes: a large title, inset grouped lists, segmented controls and one hero. Orby's brand already has all of them.

## Where the eye goes on a phone

People scan app screens; they do not read them. With no strong cues they fall into an F-shaped pattern, which still showed up on mobile in 2017 eye-tracking. The remedy is to put the most important point first, use headings that stand out and start them with the most informative words ([NN/g, F-pattern](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/), research firm). When headings stand out, people use the "layer-cake" pattern: they move from heading to heading and drop into the section they want. NN/g calls this "by far the most effective" way to scan ([NN/g, scanning patterns](https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/), research firm).

Attention falls off with position. Across 57,453 fixations, the 100 px just above the fold were viewed 102 percent more than the 100 px just below it, and a page with little at the top creates a "false floor" that makes people think they have reached the end ([NN/g, the fold](https://www.nngroup.com/articles/page-fold-manifesto/), research firm). On phones, a lab eye-tracking study found attention focused on the top half of the screen ([Lagun et al. 2014, SIGIR](https://research.google/pubs/towards-better-measurement-of-attention-and-satisfaction-in-mobile-search/), peer-reviewed). A widely repeated figure, that 68 percent of attention lands in the top half of a phone screen, traces to an unverifiable vendor study and is not used here.

Apple says the same thing as guidance: "place the most important items near the top and leading side", align elements to make them easy to scan, and use indentation to show that one thing belongs to another ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout), first-party). Apple's 2026 design principles session goes further: "When your hierarchy is strong, the most important item on the screen is always the most obvious one" ([WWDC26 250, Principles of great design](https://developer.apple.com/videos/play/wwdc2026/250), first-party).

On a 390 x 844 iPhone, Orby's floating dock (ask bar and tab capsule) takes about 154 pt at the bottom. That leaves roughly 630 pt of visible content on the first screen. The peer apps put their focal element 11 to 32 percent of the way down, with a median of about 22 percent (measured). Orby's Today hero starts at 358 pt in the browser, about 43 percent down, under the date, the title, a two-line quote, the week strip, two 56 pt status chips and a "Close yesterday" link.

## Space does most of the grouping

Items that sit close together are seen as one group, and proximity can overpower similar color or shape ([NN/g, proximity](https://www.nngroup.com/articles/gestalt-proximity/), research firm). A shared boundary, or "common region", is the strongest grouping cue. It was established as a principle of its own in [Palmer 1992, *Cognitive Psychology*](https://pubmed.ncbi.nlm.nih.gov/1516361/) (peer-reviewed). Containers add clutter, though, so NN/g advises using whitespace first and a border or background only when space cannot do the job ([NN/g, common region](https://www.nngroup.com/articles/common-region/), research firm). Apple lists the same three tools in order: negative space, container shapes, separator lines ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout), first-party). Its newest design system says "hierarchy should be expressed through layout and grouping", not decoration ([WWDC25 356](https://developer.apple.com/videos/play/wwdc2025/356), first-party).

No peer-reviewed study sets a numeric ratio between grouping levels. The common practitioner rule, that the space around a group is at least twice the largest space inside it, is consistent with the proximity research but not tested. The peer apps follow it. Apple Journal puts about 26 pt above a section header and 8 pt below it ("far above, close below"). Card gaps run 8 to 12 pt, side margins 16 to 20 pt, and section breaks about three times the card gap (measured). Orby's tokens already encode this ladder: 4 and 8 inside an item, 12 between items, 32 between sections. Section titles get 32 above and 12 below, a ratio of 2.7.

Apple gives iPhone system margins of 16 to 20 pt ([ContentMarginGuide](https://developer.apple.com/documentation/swiftui/contentmarginguide/container), first-party). It does not say which width gets 20. Orby's 16 px gutter is inside that range and keeps every edge aligned, so it stays. Material Design uses an 8 dp grid with 4 dp for small elements and 16 dp compact margins ([Material metrics](https://m1.material.io/layout/metrics-keylines.html), first-party for Android). The 8-point grid's value is consistency, not perception ([spec.fm](https://spec.fm/specifics/8-pt-grid), practitioner).

## Cards earn their place, or they become soup

Cards suit a few mixed items that each lead somewhere. NN/g found them less scannable than lists, poor for comparison, and prone to hiding the ranking of content ([NN/g, cards](https://www.nngroup.com/articles/cards-component/), research firm). Apple prefers rows for text: "the row-based format is especially well suited to making text easy to scan and read" ([HIG Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables), first-party). In iOS 26, lists got taller rows and more padding "to give content room to breathe", and section headers stopped rendering in all caps ([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass), first-party). The practitioner book *Refactoring UI* gives the same advice: use fewer borders, and put secondary content straight on the page background ([review of Refactoring UI](https://dev.to/updivision/book-review-refactoring-ui-by-adam-wathan-steve-schoger-2f7m), practitioner).

The teardowns show the pattern in practice. Thirteen of the 14 apps keep to three levels of containment: section, card, row. Apple Health uses one card template for every metric, so a reader learns it once and then reads only values. Finch gives each goal its own card, and a design critique calls the result cluttered ([Pratt IXD critique](https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/), practitioner). Orby's Goals screen has six card shapes, including three identical "Further out" cards with dashed circles. Journal puts a bordered box inside its calendar card.

## Type works in a few clear levels

Apple: "Adjust font weight, size, and color as needed to emphasize important information", "minimize the number of typefaces", avoid light weights, 17 pt default and 11 pt minimum on iOS ([HIG Typography](https://developer.apple.com/design/human-interface-guidelines/typography), first-party). Apple's own styles step by 1.06x to 1.27x. Where two levels are the same size, weight carries the difference: Headline and Body are both 17 pt, semibold against regular. NN/g suggests no more than three type sizes, at most two large elements, and a squint or blur test to see where emphasis lands ([NN/g, visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/), research firm). Low-contrast gray text reads as disabled and fails people ([NN/g, low contrast](https://www.nngroup.com/articles/low-contrast/), research firm). WCAG 2.2 sets 4.5:1 for text and 3:1 for large text and meaningful graphics ([SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), first-party).

The calmest peer screens use two clear tiers: a hero number three to six times body size, and everything else within about 1.3x of body. The apps that feel busy add mid sizes and caps labels (measured). Most of Orby's brand scale steps clearly. Two pairs do not. The section title (26) over a card title (22) is a 1.18x step in the same face and weight. The standard handles that pair with a rule instead of a token change: the two are never stacked. The session name in Today's gauge (40) is within 5 percent of the screen title (38). The brand raised the title from 34 to 38 on purpose, so the standard keeps it. It makes the hero win by area and position instead: the card is about 360 pt tall against a 42 pt title line, and it moves up the screen.

Today currently renders five Fraunces sizes and six Inter sizes, against the brand's limit of four and five. Learned and Progress render a 26 px Inter stat that has no role in the scale. The standard gives that size a role: `--fs-value`, for stats in tiles. It reuses the section-title size, so no new size enters the scale. It also brings the goal prompt on Today down to the 17 px sentence size, because 22 is a hero size.

## Lines on a phone run short, not long

The comfortable measure is about 45 to 90 characters ([Butterick, line length](https://practicaltypography.com/line-length.html), practitioner) or 50 to 75 ([NN/g, chunking](https://www.nngroup.com/articles/chunking/), research firm). On-screen comprehension was best near 55 characters ([Dyson and Haselgrove 2001](https://www.humanfactors.com/newsletters/optimal_line_length.asp), peer-reviewed, read through a summary). Reading improved with type size up to about 18 pt on text-heavy pages ([Rello, Pielot and Marcos 2016, CHI](https://researchr.org/publication/RelloPM16), peer-reviewed). Inter at Orby's 16 px body in a card measures 37 characters a line at 320 pt, 49 at 390 and 55 at 440. At 320 the line is already below every recommended minimum, so the standard forbids extra insets around reading text. On wide screens it caps paragraphs at about 70 characters. Orby's 16/24 body is on the WCAG 1.5 line-height reference ([SC 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html), first-party). Apple's guidance favors loose leading for long passages. So the standard keeps 16 and notes 17 for reading surfaces as an option for the owner.

## Density is not the enemy; scattered content is

White space helps when it separates groups and frames the focal element. It hurts when it spreads related content across viewports, which raises scrolling and memory load ([NN/g, content dispersion](https://www.nngroup.com/articles/content-dispersion/), research firm), or when an empty band looks like the bottom of the page. Working memory holds about four chunks ([Cowan 2001, *BBS*](https://pubmed.ncbi.nlm.nih.gov/11515286/), peer-reviewed). The practical rules are to group in fours, preselect the likely choice and never say the same thing twice ([NN/g, cognitive load](https://www.nngroup.com/articles/minimize-cognitive-load/), research firm). Progressive disclosure puts what people need often up front and the rest one labeled tap away. Designs that go beyond two levels of disclosure lose people ([NN/g, progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), research firm). Apple: "Use progressive disclosure to make layouts cleaner" and "use no more than one disclosure button in a single view" ([HIG Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [HIG Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls), first-party). Oura moved its trends out of the Today tab because "these metrics don't change every day and night" ([Oura, new app experience](https://ouraring.com/blog/new-oura-app-experience/), first-party marketing).

## One primary action, styled by role

Apple: "Keep the number of prominent buttons to one or two per view" and "use style, not size, to visually distinguish the preferred choice" ([HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), first-party). A single target stands out preattentively only when few other elements share its feature ([Healey and Enns 2012, *IEEE TVCG*](https://www.csc2.ncsu.edu/faculty/healey/download/tvcg.12a.pdf), peer-reviewed). Orby's brand is stricter than Apple: one Sky button per screen. Targets are 44 x 44 pt, with about 12 pt around bezeled controls and 24 pt around unbezeled ones ([HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), first-party). WCAG's minimum is 24 x 24 ([SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), first-party).

## Charts say one thing, in words, above the plot

Apple: the data should be most prominent; a chart should come with text that states its main message; small charts drop gridlines and labels; detail charts use about four gridlines at familiar steps; bars start at zero; nothing critical needs a tap to see ([HIG Charts](https://developer.apple.com/design/human-interface-guidelines/charts), [WWDC22 110340](https://developer.apple.com/videos/play/wwdc2022/110340/), [WWDC22 110342](https://developer.apple.com/videos/play/wwdc2022/110342/), first-party). Position and length are read more accurately than angle or area ([Cleveland and McGill 1984](https://homes.cs.washington.edu/~jheer/files/jheer-crowdflower.pdf), replicated by Heer and Bostock 2010, peer-reviewed). Gridlines should "whisper" ([Bartram and Stone 2011](https://tableau.com/sites/default/files/2023-01/2011-WhisperGrids.pdf), peer-reviewed). A legend that does not match the data layout costs eye movements ([Huestegge and Philipp 2011](https://link.springer.com/article/10.3758/s13414-011-0155-1), peer-reviewed). Strava, Gentler Streak and Apple Health all print the headline total and a comparison above the chart, and draw the prior period as a quiet gray series (measured).

The Progress range views the owner asked for (1W, 1M, 3M, 6M, YTD, 12M, All) are a familiar sequence, so seven options are easy to recognize. Apple suggests no more than about five segments on iPhone ([HIG Segmented controls](https://developer.apple.com/design/human-interface-guidelines/segmented-controls), first-party). Width is the real limit. In a row 12 px in from the card's edges, each segment is 47.7 pt wide at 390 and 45.6 at 375, but 37.7 at 320. The standard keeps all seven visible and takes one narrow exception at widths under 375: segments down to 36 pt wide, still 44 tall and contiguous. That passes WCAG's 24 pt minimum and Apple's 28 pt minimum control size. Mis-taps cost one more tap.

## What the best apps do

The teardown measured 14 apps from their current App Store screenshots: Apple Health, Fitness and Journal, Things 3, Streaks, Bevel, Oura, WHOOP, Strava, Runna, Structured, Gentler Streak, Finch and Day One. Full detail and every App Store URL are in `research_notes/Mobile layout and visual hierarchy/app_teardowns.md`. Ten patterns recur:

1. One focal element high on the screen (12 of 14).
2. Two-tier type, where the hero is 3 to 6 times body size (9 of 14).
3. Numbers first, then one plain sentence (8 of 14).
4. Units smaller and grayer than the number (11 of 14).
5. One repeated card template per screen (8 of 14).
6. Color used only for meaning (10 of 14).
7. At most three levels of containment (13 of 14).
8. Spacing ratios of about 3:1 between sections and cards.
9. Sparse chart labels with a summary in words (10 of 14).
10. A lead that changes with the time of day (4 of 14).

What they leave out matters as much: borders on cards, a second accent in one card, more than one primary button, axis titles, and legends that a label on the line would replace. Apple's Design Award judges in 2026 rewarded a distinctive visual theme on a calm, conventional structure ([Apple Design Awards](https://developer.apple.com/design/awards/), first-party). A custom brand like Orby's does not need a custom structure.

## Evidence grades for the rules that matter most

| Rule | Best evidence | Strength |
|---|---|---|
| Fewer elements and familiar shapes look better at first sight | Tuch 2012, Reinecke 2013, Lindgaard 2006 | Peer-reviewed, websites not apps |
| The focal point belongs near the top | NN/g fold data (57,453 fixations); Lagun 2014 on phones; HIG Layout | Research firm and one peer-reviewed phone study |
| Group by proximity first, containers second | NN/g proximity and common region; Palmer 1992; HIG Layout | Peer-reviewed principle, research-firm application |
| Outer gap at least 2x inner gap | Practitioner convention; peer apps measured near 3:1 | Untested threshold |
| Lists beat cards for like items | NN/g cards; HIG Lists | Research firm and first-party |
| Three type sizes per card, clear steps | NN/g visual hierarchy; Apple's text styles | Research firm and first-party |
| Lines of about 45 to 75 characters | Dyson and Haselgrove 2001; NN/g; Butterick | Peer-reviewed (via summary) and practitioner |
| One primary button | HIG Buttons; Healey and Enns 2012 | First-party and peer-reviewed |
| Charts: headline in words, few gridlines, direct labels | HIG Charts, WWDC22; Cleveland and McGill; Bartram and Stone; Huestegge and Philipp | First-party and peer-reviewed |
| Progressive disclosure, two levels at most | NN/g progressive disclosure; HIG | Research firm and first-party |
| At most 6 shadowed surfaces in the first screen | Heuristic derived from the complexity research | Not measured; revisit with use |

## What the standard does on each tab

All approved features stay, in their order. Each change below says why.

- **Today.** The status chips become the brand's one-line 32 pt status pills, and "Close yesterday" joins the carry-over row in Plan your day. Both are status or yesterday's business, and together they lift the hero from 358 pt to about 290. The readout pill reads "0 of 23 mi · 0 of 4 runs" again. A hairline separates the gauge from its time-of-day controls. Plan your day becomes one card instead of three containers.
- **Goals.** "To review" becomes a carry-over row with the goal text first. Further out becomes one list card with three rows instead of three dashed cards. History drops its duplicate label and its "–" placeholders.
- **Learned.** The "Learned: N things on N days" tile goes, as the owner asked. "In a row" becomes a compact lightbulb streak at the top: seven bulbs that change shape as well as color when lit. The prompt card is the hero, and its field starts at three lines instead of a large empty block.
- **Plan.** The separate "Today" section goes, because today's sessions are already in the week. YOUR PLAN shows the plan's shape as one mark per week. Tapping it opens one large sheet with "what the assistant knows", the outline and the composer, and changes land through the existing proposal and apply flow.
- **Progress.** The seven range views sit in one row under the hero chart, so the number stays on top. Trends and Health share one tile template, which fixes "7 %, 7 days". The Trends empty state becomes a single row.
- **Journal.** The Library and its switch go, as the owner asked. The "On Oct 11 you wrote" quote moves into the tinted Remember when header. "Write today's entry" becomes a row in the calendar card and is offered once. The legend row goes, because the discs carry their own numerals. Entries become rows with a date gutter.
- **Settings.** Group titles drop from 26 to 22 with 24 above and 8 below, and row subtitles are one line.

## The standard's key rules

1. One focal point per screen: the largest and highest-contrast element, its top at most 300 pt down at 390 x 844, with its key value above the dock. Only the screen's listed wayfinding sits above it.
2. At most one Sky button visible at a time.
3. Spacing ladder: 4 inside an item, 8 from a card title to its content, 12 between items and from a section title to its content, 16 card padding, 32 between sections. The space above a heading is at least twice the space below it, and no gap inside a card exceeds its padding without a hairline.
4. Use the lightest container that works: space, then a hairline, then a card. Three or more like items are one card with rows. No box inside a card. At most three card templates and about six shadowed surfaces in the first screen.
5. Four type levels plus the title, at most 3 sizes per card, and adjacent levels differ by 1.2x in size, 200 in weight, or color plus size or weight. A 26 never sits directly over a 22, and there is one big number per card.
6. Numbers carry their context ("0 of 23 mi · 0 of 4 runs"). Units are Dusk and smaller. Zero is "0", and no data is a word, never "–".
7. Say each thing once. Show today, and fold the rest behind a labeled tap, two levels deep at most.
8. Charts put the headline value and a one-line takeaway above the plot, use 3 to 5 faint gridlines and direct labels, and need no tap for critical values.
9. Empty states come in two forms: a sentence for an empty screen, one row for an empty section.
10. Check every screen with the squint test, the 3-second test and the measurements in section 8 of the standard, at 320, 390 and 440 wide and at 200 percent text.

---

## Sources

**First-party guidance (Apple, W3C, Google)**

- HIG: Design principles, https://developer.apple.com/design/human-interface-guidelines/design-principles
- HIG: Layout, https://developer.apple.com/design/human-interface-guidelines/layout
- HIG: Typography, https://developer.apple.com/design/human-interface-guidelines/typography
- HIG: Color, https://developer.apple.com/design/human-interface-guidelines/color
- HIG: Lists and tables, https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- HIG: Charts, https://developer.apple.com/design/human-interface-guidelines/charts
- HIG: Charting data, https://developer.apple.com/design/human-interface-guidelines/charting-data
- HIG: Buttons, https://developer.apple.com/design/human-interface-guidelines/buttons
- HIG: Segmented controls, https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- HIG: Sheets, https://developer.apple.com/design/human-interface-guidelines/sheets
- HIG: Disclosure controls, https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- HIG: Accessibility, https://developer.apple.com/design/human-interface-guidelines/accessibility
- HIG: Activity rings, https://developer.apple.com/design/human-interface-guidelines/activity-rings
- Apple doc: ContentMarginGuide.container, https://developer.apple.com/documentation/swiftui/contentmarginguide/container
- Apple doc: Adopting Liquid Glass, https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- WWDC26 250, Principles of great design, https://developer.apple.com/videos/play/wwdc2026/250
- WWDC25 356, Get to know the new design system, https://developer.apple.com/videos/play/wwdc2025/356
- WWDC22 110340, Design an effective chart, https://developer.apple.com/videos/play/wwdc2022/110340/
- WWDC22 110342, Design app experiences with charts, https://developer.apple.com/videos/play/wwdc2022/110342/
- WWDC17 802, Essential Design Principles, https://developer.apple.com/videos/play/wwdc2017/802
- Apple Design Awards, https://developer.apple.com/design/awards/
- WCAG 2.2 SC 1.4.3, https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 SC 1.4.11, https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WCAG 2.2 SC 1.4.12, https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html
- WCAG 2.2 SC 2.5.8, https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Material Design metrics and keylines, https://m1.material.io/layout/metrics-keylines.html
- Material 3 type scale tokens, https://github.com/material-components/material-web/blob/main/tokens/versions/v0_192/_md-sys-typescale.scss

**Peer-reviewed research**

- Lindgaard, Fernandes, Dudek and Brown 2006, first impressions in 50 ms, https://www.nature.com/news/2006/060109/full/news060109-13.html
- Tuch et al. 2012, visual complexity and prototypicality, https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/
- Reinecke et al. 2013, predicting appeal from complexity and colorfulness, https://kgajos.seas.harvard.edu/papers/reinecke13aesthetics.pdf
- Lagun, Hsieh, Webster and Navalpakkam 2014, attention on mobile, https://research.google/pubs/towards-better-measurement-of-attention-and-satisfaction-in-mobile-search/
- Palmer 1992, common region, https://pubmed.ncbi.nlm.nih.gov/1516361/
- Healey and Enns 2012, preattentive attention, https://www.csc2.ncsu.edu/faculty/healey/download/tvcg.12a.pdf
- Dyson and Haselgrove 2001, line length on screen (via summary), https://www.humanfactors.com/newsletters/optimal_line_length.asp
- Rello, Pielot and Marcos 2016, font size and readability, https://researchr.org/publication/RelloPM16
- Cowan 2001, working memory capacity, https://pubmed.ncbi.nlm.nih.gov/11515286/
- Cleveland and McGill 1984, replicated by Heer and Bostock 2010, https://homes.cs.washington.edu/~jheer/files/jheer-crowdflower.pdf
- Bartram and Stone 2011, whisper grids, https://tableau.com/sites/default/files/2023-01/2011-WhisperGrids.pdf
- Huestegge and Philipp 2011, legends and eye movements, https://link.springer.com/article/10.3758/s13414-011-0155-1

**Research firm (Nielsen Norman Group)**

- F-shaped pattern, https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/
- Text scanning patterns, https://www.nngroup.com/articles/text-scanning-patterns-eyetracking/
- The fold, https://www.nngroup.com/articles/page-fold-manifesto/
- Scrolling and attention, https://www.nngroup.com/articles/scrolling-and-attention/
- Proximity, https://www.nngroup.com/articles/gestalt-proximity/
- Common region, https://www.nngroup.com/articles/common-region/
- Similarity, https://www.nngroup.com/articles/gestalt-similarity/
- Cards, https://www.nngroup.com/articles/cards-component/
- Visual hierarchy, https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
- Low contrast, https://www.nngroup.com/articles/low-contrast/
- Chunking, https://www.nngroup.com/articles/chunking/
- Content dispersion, https://www.nngroup.com/articles/content-dispersion/
- Minimize cognitive load, https://www.nngroup.com/articles/minimize-cognitive-load/
- Progressive disclosure, https://www.nngroup.com/articles/progressive-disclosure/
- Aesthetic-usability effect, https://www.nngroup.com/articles/aesthetic-usability-effect/
- Dashboards and preattentive attributes, https://www.nngroup.com/articles/dashboards-preattentive/
- Numbers as numerals, https://www.nngroup.com/articles/web-writing-show-numbers-as-numerals/

**Practitioner opinion and observation**

- Refactoring UI, via a review, https://dev.to/updivision/book-review-refactoring-ui-by-adam-wathan-steve-schoger-2f7m
- Butterick, Practical Typography: line length, https://practicaltypography.com/line-length.html ; line spacing, https://practicaltypography.com/line-spacing.html
- spec.fm, the 8-point grid, https://spec.fm/specifics/8-pt-grid
- Laws of UX, proximity, https://lawsofux.com/law-of-proximity/ ; Hick's law, https://lawsofux.com/hicks-law/
- Sketch blog on Gentler Streak, https://www.sketch.com/blog/gentler-streak/
- Blake Crosley on Things 3, https://blakecrosley.com/guides/design/things
- the5krunner on the WHOOP home screen, https://the5krunner.com/2023/03/28/new-whoop-home-screen-looks-pretty-but-is-it-as-intuitive/
- MacStories, Streaks review, https://www.macstories.net/reviews/streaks-3-review/
- Pratt IXD, Finch critique, https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/

**Vendor writing (first-party marketing)**

- Oura, a new Oura app experience, https://ouraring.com/blog/new-oura-app-experience/
- Day One release notes, https://dayoneapp.com/releases/major-navigation-update-with-journals-more-tab/

**Measured**

- App Store screenshots of the 14 apps, via https://itunes.apple.com/lookup?id=<id>&country=us (listings and URLs in the teardown note).
- Orby at c6cc577, http://localhost:5220, the seeded account, 390 x 844: hero top 358 pt; 32 px above and 12 px below every section title; 12 px between cards; on Today, 5 Fraunces sizes (17, 22, 26, 38, 40) and 6 Inter sizes (11, 12, 13, 15, 16, 17).

**Gaps.** No peer-reviewed study sets a ratio between grouping levels, a shadow budget or a cap on type sizes per screen. These are practitioner rules or adaptations. Mobile-specific eye-tracking on app screens, as opposed to web pages, is thin. Apple publishes no iPhone row heights or section spacing. Teardown measurements from marketing screenshots are accurate to about 5 to 8 percent.
