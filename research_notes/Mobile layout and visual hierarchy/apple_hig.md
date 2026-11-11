# Apple's guidance on readable, well-ordered iPhone screens

Researched 2026-11-11 for Orby's layout and hierarchy pass on every tab. Scope: what Apple's Human Interface Guidelines (HIG), Apple developer docs and Apple's WWDC design sessions say about spacing, grouping, type, emphasis, lists, charts, buttons, bars, sheets, materials, accessibility and writing. Each rule is turned into something checkable with a number where Apple gives one, then held against Orby's brand guide (`docs/brand/brand-guide.md`) so the screen pass knows where to follow Apple's defaults and where a custom brand should depart from them.

## How this was read, and source labels

- HIG pages and Apple docs are rendered by JavaScript, so I read their JSON source (`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json` and `.../documentation/<path>.json`) and quote from it. The URLs below are the human-readable pages. Pages were read on 2026-11-11. The Layout page shows a change-log entry of September 9, 2026 ("Updated guidance to reflect current best practices"), Typography December 16, 2025.
- WWDC transcripts were read from the session pages on developer.apple.com.
- The HIG's `navigation-bars` and `images-and-icons` JSON files no longer exist. Navigation bar guidance now lives on the Toolbars page ("In iOS, a navigation-specific toolbar is sometimes called a navigation bar").
- Units: one CSS px in Orby's WKWebView at default zoom equals one iOS point (pt), so Apple's point values apply directly to Orby's px values.

Labels used on every item:
- **[HIG]** Apple Human Interface Guidelines. First-party guidance.
- **[Apple doc]** Apple developer documentation (UIKit, SwiftUI, technology overviews). First-party.
- **[WWDC]** Apple's own design session, quoted from the transcript. First-party guidance, sometimes less formal than the HIG.
- **[ADA]** Apple Design Awards page. First-party, judges' commentary.
- **[Practitioner]** Forums, blogs, third-party design systems. Opinion or observation, lower confidence.
- **[Repo]** Read from `/home/user/LogBook`.

No peer-reviewed evidence is used in this note. Apple's guidance is expert guidance, not research; the evidence-based layer belongs in the sibling notes.

---

## 1. The short version: twelve rules that matter most for Orby

1. **The most important thing on the screen is the most obvious thing.** Apple: "Clarity is built with hierarchy, using order, spacing, and contrast to guide people to what's most important. When your hierarchy is strong, the most important item on the screen is always the most obvious one." [WWDC26 250] Check: on each screen, name the one thing; it is the largest or highest-contrast element, near the top and leading edge.
2. **Order by importance, top to bottom and leading to trailing.** [HIG Layout] Check: the first card under the title is the screen's main job.
3. **Group with space, containers or separators; show subordination with indentation; align to make scanning easy.** [HIG Layout] Check: every element sits on one of a few shared leading edges; related items share a container or sit closer to each other than to unrelated items.
4. **Express hierarchy through layout and grouping, not decoration.** "Instead of relying on decoration, hierarchy should be expressed through layout and grouping." [WWDC25 356] Check: no extra borders, tints, shadows or backgrounds added only to make something feel important.
5. **Progressive disclosure.** Show the essential, put the rest one tap away (disclosure, menus, nested views, medium-detent sheets). [HIG Layout, Disclosure controls, Sheets; WWDC17 802] Check: secondary material is folded, linked or in a sheet; it is never removed if people expect it.
6. **Body text 17 pt by default, never below 11 pt; avoid light weights.** [HIG Typography, Accessibility] Check: no text under 11 pt; no weights under Regular (400) for UI text.
7. **Few typefaces, few sizes, few colors.** "Minimize the number of typefaces you use, even in a highly customized interface." [HIG Typography] "Text in your app should have a limited number of font faces and sizes and colors." [WWDC17 802]
8. **One or two prominent buttons per view, distinguished by style, not size.** [HIG Buttons] Check: count filled (Sky) buttons per screen; at most one in Orby (the brand is stricter than Apple).
9. **Targets 44 x 44 pt, with about 12 pt around bezeled controls and about 24 pt around unbezeled ones.** [HIG Accessibility, Buttons] Check: measure hit boxes and the gap between neighboring targets.
10. **Contrast 4.5:1 for text up to 17 pt, 3:1 at 18 pt and up or bold; aim for 7:1 for small custom-colored text.** [HIG Accessibility, Dark Mode]
11. **Text scales to at least 200 percent without clipping; layouts stack and drop columns at large sizes; primary elements stay at the top.** [HIG Accessibility, Typography]
12. **Charts: the data is the most prominent thing; a text summary states the takeaway; size matches function.** [HIG Charts, Charting data; WWDC22 110340, 110342]

---

## 2. Apple's principles of hierarchy

### 2.1 The current principles (HIG "Design principles", 2026)

The HIG now opens with eight principles [HIG Design principles, https://developer.apple.com/design/human-interface-guidelines/design-principles]: **Purpose** ("Make something meaningful"), **Agency** ("Let people do things their own way"), **Responsibility**, **Familiarity** ("Build on what people know"), **Flexibility**, **Simplicity** ("Be clear and direct"), **Craft** ("Care about every detail"), **Delight** ("Make it human").

The parts that bear on layout and hierarchy:

- Simplicity: "A well-designed experience removes the unnecessary, with every element earning its place." "Simplicity isn't minimalism. Aim for a focused, useful experience that keeps the important things close by and lets the others fall away." "Establish hierarchy. When form and function are readily apparent, people know how to reach a desired outcome. Prioritize recognizable controls and a consistent structure that helps people understand where they are and what comes next."
- Familiarity: "Keep visuals and interactions consistent. Once you establish a behavior or appearance for an element, apply it throughout your design."
- Flexibility: "Preserve a person's context... Keep content and controls in consistent, predictable positions."
- Agency: "Stay out of the way... get them directly to the task or content at hand."
- Delight: "Don't mistake delight for decoration."
- Craft: lists the ingredients as "beautiful fonts", "thoughtful colors that adapt", "clear graphics and iconography", "responsive animations", and calls misaligned icons and jittery scrolling the signs of a rushed product [WWDC26 250].

From the companion session "Principles of great design" [WWDC26 250, https://developer.apple.com/videos/play/wwdc2026/250]:

- "Every feature you add to your product asks something of the person using it... their time, their attention, and their trust." "Choosing what to build is often a matter of deciding what not to include."
- "If you bury all your functionality inside a single place, that might make your interface look more minimal, but it doesn't make it simple."
- Clear interfaces "answer people's questions: What do I pay attention to? What can I interact with? And how do I interact?"
- "Is there complex data that might be better understood as a graphic? Are there opportunities to summarize information so people can focus on what they care about?"
- "Sometimes, simple means adding context and information, so people can make informed decisions." (The example: a play control that also shows elapsed and remaining time.) This supports restoring the runs count to Today's readout pill: "0 of 23 mi · 0 of 4 runs" is simpler to act on than "0 of 23 mi".

### 2.2 The Liquid Glass design system (iOS 26 and later)

From "Get to know the new design system" [WWDC25 356, https://developer.apple.com/videos/play/wwdc2025/356] and "Meet Liquid Glass" [WWDC25 219]:

- Two planes. Controls and navigation float in a functional layer above the content layer; the content layer holds the content. "Liquid Glass defines a new functional layer in the UI, floating above your content to bring structure and clarity, without ever stealing focus."
- Hierarchy from layout, not ornament: "We've all added extra backgrounds or borders to give buttons the right weight... with the new system appearance, we're all relearning where emphasis comes from, making customizations like these unnecessary."
- Concentricity. Three shape types: fixed (constant radius), capsule (radius = half the height), concentric (radius = parent radius minus padding). "Keep an eye out for corners that feel too pinched or flared... One place this often shows up in is nested containers, like artwork in a card." On phones, a capsule button near the screen edge gets "extra margin".
- Typography "has been refined to strengthen clarity and structure, now bolder and left-aligned to improve readability in key moments like alerts and onboarding."
- Bars: group items "by function and frequency"; do not group a symbol with a text button; a primary action like Done "stays separate and appears tinted... creating a clear focal point". If a bar is crowded, "remove anything unnecessary and move secondary actions into a more menu".
- Tab bar accessories are for persistent features (a media mini player). "Avoid placing screen-specific actions here... Mixing elements from different parts of the UI can blur hierarchy." Orby's ask bar is a persistent, app-wide feature, so it fits this pattern; screen-specific actions belong on the screen.
- Modality: pair a sheet that interrupts the flow with a dimming layer "to help center attention".
- Scroll edge effects "are not decorative" and are used only where floating UI overlaps scrolling content.

### 2.3 Historical: clarity, deference, depth

From iOS 7 until the 2022 HIG rewrite, the iOS HIG named three themes: clarity (legible text, precise icons, purposeful adornment), deference (the UI helps people understand content and never competes with it) and depth (layers and motion convey hierarchy). The current HIG no longer carries these words, but the ideas survive: deference is now "the functional layer... without ever stealing focus", depth is the two-plane model and modal dimming, clarity is the Simplicity principle. [Practitioner: Japanese translation of the original themes page, https://kde.hateblo.jp/entry/2020/05/11/001546 ; a mirror of Apple's iOS 7 era HIG PDF, https://www.evl.uic.edu/datsoupi/420_14/docs/MobileHIG.pdf. Both seen as search results only, not opened in this pass.]

### 2.4 The working principles behind the layouts ("Essential Design Principles")

From [WWDC17 802, https://developer.apple.com/videos/play/wwdc2017/802], still linked from the HIG Layout page:

- **Wayfinding**: the title and selected tab answer "where am I? where can I go?"
- **Feedback**: status, completion, warning and error feedback; every action gets confirmation.
- **Visibility**: "The usability of a design is greatly improved when controls and information are clearly visible", "surface key status information at higher levels whenever possible", weighed against density: "Densely packed interfaces can be overwhelming and they can slow decision-making."
- **Consistency**, including internal consistency: "Your app's glyphs should have a consistent visual style. Text in your app should have a limited number of font faces and sizes and colors."
- **Proximity**: "The closer a control is to that object, the more we assume there to be a connection between the two."
- **Grouping**: "Grouping helps people to understand the relationships between elements, and it is key for giving a design structure... many apps don't effectively use grouping."
- **Mapping**: the order of controls mirrors the order of the things they affect.
- **Progressive disclosure** and the 80/20 rule: "it is okay to make the most useful 20 percent of functions easier to find by hiding the other 80 percent."
- **Symmetry**: "Translational symmetry gives an interface a sense of structure, and order through the repetition of like elements" (the even cadence of rows in Clock and Weather).
- The caution: "Too much feedback is annoying. Too much visibility is distracting. Too much progressive disclosure can make work flows inefficient."

---

## 3. Layout

Source: [HIG Layout, https://developer.apple.com/design/human-interface-guidelines/layout]

### 3.1 Visual hierarchy (the four rules on the page)

1. "Order content by relative importance... place the most important items near the top and leading side."
2. "Align elements to make them easier to scan, and use indentation to convey hierarchy... People assume that aligned items are related to each other, and conversely, they perceive indented items as subordinate."
3. "Group related items... you might use negative space, container shapes, or separator lines."
4. "Use progressive disclosure to make layouts cleaner... Use disclosure triangles, menus, or nested views to reduce how much content to initially display; or use scrollable sections."
5. "Differentiate controls from content." Controls use the glass layer and a scroll edge effect "instead of applying a solid or semi-opaque background color beneath controls".

### 3.2 Margins, safe areas and readable width

| Rule | Value | Source |
|---|---|---|
| System layout margins on iPhone | **16 to 20 pt**. "This guide vends the system layout margins, which range from 16 to 20 points on iPhone and are larger on platforms like tvOS... Apply or read the guide instead of writing these values into your layout." | [Apple doc] https://developer.apple.com/documentation/swiftui/contentmarginguide/container |
| Which width gets which margin | Not documented by Apple. Observed: 16 on smaller iPhones (iPhone 8 class), 20 on larger ones; SAP's iOS design system maps compact width to 16 and regular width to 20. | [Practitioner] search summaries of https://martiancraft.com/blog/2019/02/notes-from-the-margins/ and https://www.sap.com/design-system/fiori-design-ios/v25-8/foundations/adaptive-layout/layout-basics (not opened) |
| Root view minimum margins | The system minimum wins over a smaller custom margin ("if the value for one system minimum margin is 20 points and you specify a value of 10... the view uses the value 20"). Apps can opt out. | [Apple doc] https://developer.apple.com/documentation/uikit/uiviewcontroller/systemminimumlayoutmargins |
| Safe area | Respect it so the Dynamic Island, status bar and bars never cover content or controls. | [HIG Layout] |
| Readable width | The readable content guide is "an area that can easily be read without forcing users to move their head to track the lines". Use it for single columns of text. No number is published. | [Apple doc] https://developer.apple.com/documentation/uikit/uiview/readablecontentguide |
| Widget margins (for comparison) | "16 points for most widgets... If you need to use tighter margins, for example to create content groupings for graphics, buttons, or background shapes, setting margins of 11 points can work well." Text at 11 pt or larger. | [HIG Widgets] https://developer.apple.com/design/human-interface-guidelines/widgets |

### 3.3 Adapting to size

- Design for text-size changes: "horizontally adjacent views may need to stack vertically... table rows or other containers may need to grow in height." [HIG Layout]
- "Preview your app on multiple devices... first testing versions of your experience that use the largest and the smallest layouts." [HIG Layout] Display Zoom is listed as a characteristic to handle. [HIG Layout]
- iPhone portrait widths Apple currently lists (points): 320 (iPhone SE class, and larger phones under Display Zoom), 360, 375, 390, 393, 402, 414, 428, 430, 440. [HIG Widgets dimension table, partial list read; 402/430/440 from the current iPhone 16/17 line] The task's test widths 320, 390 and 440 cover the extremes and the common case.

---

## 4. Typography

Source: [HIG Typography, https://developer.apple.com/design/human-interface-guidelines/typography]; [WWDC20 10175 "The details of UI typography", https://developer.apple.com/videos/play/wwdc2020/10175]; [WWDC24 10074 "Get started with Dynamic Type", https://developer.apple.com/videos/play/wwdc2024/10074]

### 4.1 Legibility

| Platform | Default size | Minimum size |
|---|---|---|
| iOS, iPadOS | 17 pt | 11 pt |

- "Follow the recommended default and minimum text sizes... for both custom and system fonts." "If you use a custom font with a thin weight, aim for larger than the recommended sizes."
- "In general, avoid light font weights... prefer Regular, Medium, Semibold, or Bold."

### 4.2 Hierarchy

- "Adjust font weight, size, and color as needed to emphasize important information... Be sure to maintain the relative hierarchy and visual distinction of text elements when people adjust text sizes."
- "Minimize the number of typefaces you use, even in a highly customized interface. Mixing too many different typefaces can obscure your information hierarchy and hinder readability."
- "Prioritize important content when responding to text-size changes... when people increase text size to read the content in a tabbed window, they don't expect the tab titles to increase in size."
- Emphasis comes from one extra weight per text style: "The emphasized weights can be medium, semibold, bold, or heavy." So the system offers two weights per style, not a free range. [HIG Typography, Specifications]

### 4.3 The default text styles (iOS, Large, the default setting)

| Style | Weight | Size (pt) | Leading (pt) | Emphasized weight |
|---|---|---|---|---|
| Large Title | Regular | 34 | 41 | Bold |
| Title 1 | Regular | 28 | 34 | Bold |
| Title 2 | Regular | 22 | 28 | Bold |
| Title 3 | Regular | 20 | 25 | Semibold |
| Headline | Semibold | 17 | 22 | Semibold |
| Body | Regular | 17 | 22 | Semibold |
| Callout | Regular | 16 | 21 | Semibold |
| Subhead | Regular | 15 | 20 | Semibold |
| Footnote | Regular | 13 | 18 | Semibold |
| Caption 1 | Regular | 12 | 16 | Semibold |
| Caption 2 | Regular | 11 | 13 | Semibold |

Range across the scale for Body: xSmall 14/19, Small 15/20, Medium 16/21, Large 17/22, xLarge 19/24, xxLarge 21/26, xxxLarge 23/29, then the accessibility sizes AX1 28/34, AX2 33/40, AX3 40/48, AX4 47/56, AX5 53/62. Caption 2 runs from 11 (xSmall to Large) to 40 at AX5. There are 7 standard sizes and 5 more accessibility sizes. [HIG Typography; WWDC24 10074]

What the table teaches about steps: adjacent styles differ by 1 to 2 pt at the small end (11, 12, 13, 15, 16, 17) and by 2 to 6 pt at the large end (17, 20, 22, 28, 34). Leading is about 1.2 to 1.3 times the size for one-line styles (17/22 = 1.29, 34/41 = 1.21). Headline and Body are the same size; Headline is separated by weight alone.

### 4.4 Leading and tracking

- "When you display text in wide columns or long passages, more space between lines (loose leading) can make it easier for people to keep their place... if you need to display multiple lines of text in an area where height is constrained, for example in a list row, decreasing the space between lines (tight leading) can help... If you need to display three or more lines of text, avoid tight leading even in areas where height is limited." [HIG Typography]
- SF Pro tracking (selected sizes, 1/1000 em): 11 pt +6, 12 pt 0, 13 pt -6, 15 pt -16, 17 pt -26, 20 pt -23, 22 pt -12, 24 pt +3, 28 pt +14, 34 pt +12. Small text is tracked out, body is tracked in, large display sizes are tracked slightly out again. [HIG Typography, Tracking values] These values are for SF Pro only; a custom font carries its own spacing.
- SF transitions from its Text to Display optical design between 17 and 28 pt. [WWDC20 10175] Fraunces has an optical size axis (`opsz`), so `font-optical-sizing: auto` gives Orby the same behavior.

### 4.5 Custom fonts

- "Make sure custom fonts are legible" and "be guided by the recommended minimum font sizes."
- "Implement accessibility features for custom fonts. System fonts automatically support Dynamic Type and respond when people turn on accessibility features, such as Bold Text. If you use a custom font, make sure it implements the same behaviors." [HIG Typography] In a web view this means rem sizes that follow the iOS text size, and a heavier weight step when Bold Text is on (not currently specified in the brand guide; see section 15).

### 4.6 Dynamic Type layout rules

- "Make sure your app's layout adapts to all font sizes." Test with Larger Accessibility Text Sizes on.
- "Increase the size of meaningful interface icons as font size increases."
- "Keep text truncation to a minimum... aim to display as much useful text at the largest accessibility font size as you do at the largest standard font size."
- "Consider using a stacked layout where text appears above secondary items... Reduce the number of columns when the font size increases."
- "Maintain a consistent information hierarchy regardless of the current font size... keep primary elements toward the top of a view." [HIG Typography]
- Contacts switches a horizontal row of options to a vertical stack at accessibility sizes; the switch happens only at accessibility sizes, so default layouts stay unchanged. [WWDC24 10074]

---

## 5. Color and Dark Mode, only where they touch hierarchy

Sources: [HIG Color, https://developer.apple.com/design/human-interface-guidelines/color]; [HIG Dark Mode, https://developer.apple.com/design/human-interface-guidelines/dark-mode]; [HIG Labels, https://developer.apple.com/design/human-interface-guidelines/labels]; [WWDC19 808 "What's New in iOS Design", https://developer.apple.com/videos/play/wwdc2019/808]

- **Levels of text emphasis: four.** Label (primary information), Secondary label (a subheading or supplemental text), Tertiary label (text that describes an unavailable item), Quaternary label (watermark text). "Label color has the most contrast with the background, so it's going to advance into the foreground and grab your attention." [HIG Labels; WWDC19 808] In practice content uses two (primary and secondary); tertiary is for unavailable and placeholder text.
- **Levels of background: three.** "Primary for the overall view, Secondary for grouping content or elements within the overall view, Tertiary for grouping content or elements within secondary elements." Grouped lists use a parallel grouped set. [HIG Color]
- "Avoid using the same color to mean different things... if you use your brand color to indicate that a borderless button is interactive, using the same or similar color to stylize noninteractive text is confusing." [HIG Color]
- "In apps with primarily monochromatic content or backgrounds, choosing your brand color as the app accent color can be an effective way to tailor your app experience." Color on controls is applied "sparingly... reserve it for elements that truly benefit from emphasis, such as status indicators or primary actions... Refrain from adding color to the background of multiple controls." [HIG Color, Liquid Glass color]
- Do not convey information with color alone; add shape, text or a glyph. [HIG Color, Accessibility]
- Dark Mode: dimmer backgrounds, brighter foregrounds; base and elevated background sets make a sheet advance over the screen behind it. "At a minimum, make sure the contrast ratio between colors is no lower than 4.5:1. For custom foreground and background colors, strive for a contrast ratio of 7:1, especially in small text." "Avoid offering an app-specific appearance setting." [HIG Dark Mode] Orby ships light only in v1 (brand guide 3.6), which the HIG allows only "in rare cases" for immersive media. This is a known deviation, outside the scope of this layout pass.

---

## 6. Lists and tables

Sources: [HIG Lists and tables, https://developer.apple.com/design/human-interface-guidelines/lists-and-tables]; [Apple doc, Adopting Liquid Glass, https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass]

- "Prefer displaying text in a list or table... the row-based format is especially well suited to making text easy to scan and read." Collections (grids) are "ideal for showing image-based content"; "Consider using a table instead of a collection for text." [HIG Lists, Collections]
- "Keep item text succinct so row content is comfortable to read... If each item consists of a large amount of text... list item titles only, letting people choose an item to reveal its content in a detail view."
- The grouped style "uses headers, footers, and additional space to separate groups of data."
- "When possible, limit the number of rows... help make a long list more manageable by listing the most relevant items and providing a way for people to view more."
- Use a disclosure indicator (chevron) to drill into a row; an info button only reveals more about a row.
- iOS 26 changes: "To give content room to breathe, organizational components like lists, tables, and forms have a larger row height and padding. Sections have an increased corner radius to match the curvature of controls." And: section headers "adopt title-style capitalization... section headers no longer render entirely in capital letters." [Apple doc, Adopting Liquid Glass]
- Row height numbers. The HIG publishes no row height. The floor is the 44 pt target. A developer measured the default UIKit list cell at 44 pt in iOS 18 and 52 pt in iOS 26. [Practitioner, Apple Developer Forums, https://developer.apple.com/forums/thread/797389, seen as a search summary] Orby's inset group rows are 56 (64 with a subtitle) (brand guide 6.4), at or above the iOS 26 default.

---

## 7. Charts

Sources: [HIG Charts, https://developer.apple.com/design/human-interface-guidelines/charts]; [HIG Charting data, https://developer.apple.com/design/human-interface-guidelines/charting-data]; [WWDC22 110340 "Design an effective chart", https://developer.apple.com/videos/play/wwdc2022/110340]; [WWDC22 110342 "Design app experiences with charts", https://developer.apple.com/videos/play/wwdc2022/110342]

- "Establish a consistent visual hierarchy... Typically, you want the data itself to be most prominent, while letting the descriptions and axes provide additional context without competing with the data."
- "Summarize the main message of your chart." A chart "should be accompanied by text that describes the chart contents. Now someone can quickly gather key information from the text, while the chart provides supporting details." [HIG Charts; WWDC22 110342]
- "Use a chart when you want to highlight important information... Charts are visually prominent, so they tend to draw people's attention." "Not every collection of data needs to be displayed in a chart." [HIG Charting data]
- Size follows function. Small charts are static and "don't require grid lines, labels, or interactivity, since they create the expectation that additional detail is just a tap away." "An interactive chart will typically be the width of your view, but not full-height." "Use a small static chart higher in the navigation hierarchy to offer a path to expanded versions," and keep values, context and state continuous between the two. [WWDC22 110342]
- Grid density: two lines are too few, seven "might be overwhelming"; "around four horizontal grid lines" suited the example. Use intuitive steps ("multiples of 20"; time "in steps of seven days, which gives us five grid lines for a 30-day period"). [WWDC22 110340] HIG: "Prefer familiar sequences of values in the tick and grid-line labels... 0, 5, 10."
- Bars start at zero; a fixed range is right when bounds are meaningful (battery 0 to 100 percent), a dynamic range when values vary (Health steps). [HIG Charts]
- "In a compact environment, maximize the width of the plot area"; keep vertical axis labels short and put units in the title. "Align the leading edge of a chart with the leading edge of other views... consider shifting the Y axis to the trailing side." [HIG Charts]
- "Let people interact with the data when it makes sense, but don't require interaction to reveal critical information." Stocks lets people choose a period ("one day, three months, or five years") and drag to read a value. Expand the touch target to the whole plot area. [HIG Charts]
- "Prefer consistency across multiple charts, deviating only when you need to highlight differences." "Maintain continuity among multiple charts that use the same data." [HIG Charting data]
- Accessibility: never rely on color alone; label marks with values and context ("June 6" over "6/6", "60 minutes" over "60m"); hide visible axis labels from VoiceOver when marks carry labels. [HIG Charts]

---

## 8. Buttons: levels of prominence

Source: [HIG Buttons, https://developer.apple.com/design/human-interface-guidelines/buttons]

- "A button needs a hit region of at least 44x44 pt." "Always include a press state for a custom button."
- "Use a button that has a prominent visual style for the most likely action in a view... Keep the number of prominent buttons to one or two per view. Presenting too many prominent buttons increases cognitive load."
- "Use style, not size, to visually distinguish the preferred choice among multiple options... placing two buttons of different sizes near each other can make the interface look confusing."
- Labels: "consider starting the label with a verb"; use familiar icons for familiar actions; use text when no symbol is clear. "When there's no clear shorthand, a text label is always the better choice." [WWDC25 356]
- Roles: normal, primary, cancel, destructive. "Don't assign the primary role to a button that performs a destructive action."
- The system's prominence ladder, from the APIs [Apple doc, UIButton.Configuration, https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct ; SwiftUI PrimitiveButtonStyle, https://developer.apple.com/documentation/swiftui/primitivebuttonstyle]: prominent (filled, `borderedProminent`, `glassProminent`) > tinted (`tinted`, `borderedTinted`) > neutral (`gray`, `bordered`, `glass`) > plain (`plain`, `borderless`). Four steps; a screen normally uses the top step once and the lower steps freely. Orby's ladder maps cleanly: Primary (Sky) > Secondary (Paper with edge) > Quiet (Deep Sky text) (brand guide 6.2), plus Destructive.

---

## 9. Tab bars, navigation bars and toolbars, large titles, segmented controls

Sources: [HIG Tab bars, https://developer.apple.com/design/human-interface-guidelines/tab-bars]; [HIG Toolbars, https://developer.apple.com/design/human-interface-guidelines/toolbars]; [HIG Segmented controls, https://developer.apple.com/design/human-interface-guidelines/segmented-controls]

Tab bars:
- "Use a tab bar to support navigation, not to provide actions."
- "Make sure the tab bar is visible when people navigate to different sections." Exception: a modal covering it.
- "Keep in mind that it's generally easier to navigate among fewer tabs." "Avoid overflow tabs": when space runs out "the trailing tab becomes a More tab in iOS." (UIKit shows at most five tabs on iPhone, the fifth becoming More when there are more; this count is from UIKit behavior, not stated as a number on the HIG page.)
- "Don't disable or hide tab bar buttons, even when their content is unavailable... If a section is empty, explain why."
- "Include tab labels... Use single words whenever possible." "Prefer filled symbols or icons."
- Badges only for critical information: "Reserve badges for critical information so you don't dilute their impact."
- iOS: the tab bar floats above content on Liquid Glass.

Toolbars and navigation bars:
- Title: "keep the title under 15 characters." "Don't title windows with your app name."
- "Use a large title to help people stay oriented as they navigate and scroll. By default, a large title transitions to a standard title as people begin scrolling the content, and transitions back to large when people scroll to the top."
- "Choose items deliberately to avoid overcrowding." "Minimize the number of groups... aim for a maximum of three."
- "Use the .prominent style for key actions such as Done or Submit... Only specify one primary action, and put it on the trailing side."
- "Use the standard Back and Close buttons... don't use a text label that says Back or Close."
- "Reduce the use of toolbar backgrounds and tinted controls." "Prefer system-provided symbols without borders."

Segmented controls:
- "Aim for no more than about five to seven segments in a wide interface and no more than about five segments on iPhone."
- "In general, keep segment size consistent." "Prefer using either text or images, not a mix of both." "Use nouns or noun phrases for segment labels... A segmented control that displays text labels doesn't need introductory text."
- "Consider a segmented control to switch between closely related subviews... For switching between completely separate sections of an app, use a tab bar instead."

---

## 10. Sheets

Sources: [HIG Sheets, https://developer.apple.com/design/human-interface-guidelines/sheets]; [Apple doc, Adopting Liquid Glass]

- A sheet is for "requesting specific information... or presenting a simple task." "For complex or prolonged user flows, consider alternatives to sheets."
- "Display only one sheet at a time from the main interface... If something people do within a sheet results in another sheet appearing, close the first sheet before displaying the new one."
- Detents: large (full height) and medium ("about half"). "In an iPhone app, consider supporting the medium detent to allow progressive disclosure of the sheet's content." Skip medium when the content is more useful at full height (compose sheets).
- "Include a grabber in a resizable sheet." "Support swiping to dismiss... If people have unsaved changes... use an action sheet to let them confirm."
- Single-view sheets: Cancel on the leading edge, Done on the trailing edge. Pair Done with Cancel or Back. Never all three.
- iOS 26: "Sheets feature an increased corner radius, and half sheets are inset from the edge of the display to allow content to peek through... When a half sheet expands to full height, it transitions to a more opaque appearance." "Check for content and controls that might appear too close to rounder sheet corners." [Apple doc]

---

## 11. Materials and depth

Source: [HIG Materials, https://developer.apple.com/design/human-interface-guidelines/materials]; [HIG Scroll views, https://developer.apple.com/design/human-interface-guidelines/scroll-views]

- "By allowing color to pass through from background to foreground, a material establishes visual hierarchy."
- "Don't use Liquid Glass in the content layer... including it in the content layer can result in unnecessary complexity and a confusing visual hierarchy." Exception: a slider or toggle while it is being touched.
- "Use Liquid Glass effects sparingly... Limit these effects to the most important functional elements."
- Clear glass over bright content: "consider adding a dark dimming layer of 35% opacity."
- Standard materials: ultra-thin, thin, regular, thick; label vibrancy has four levels and fills three. "Thicker materials... provide better contrast for text."
- Scroll edge effect: only where a scroll view sits behind floating UI, one per view. "Make it apparent when content is scrollable... displaying partial content at the edge of a view indicates that there's more." "Avoid putting a scroll view inside another scroll view with the same orientation." A horizontal scroller inside a vertical page is fine. [HIG Scroll views]

---

## 12. Accessibility

Source: [HIG Accessibility, https://developer.apple.com/design/human-interface-guidelines/accessibility]

| Rule | Number |
|---|---|
| Text enlargement | "Ideally, give people the option to enlarge text by at least 200 percent." |
| Default and minimum text (iOS) | 17 pt and 11 pt |
| Contrast (WCAG AA as used by Accessibility Inspector) | Up to 17 pt, all weights: 4.5:1. 18 pt and up: 3:1. Bold at any size: 3:1. |
| Control size (iOS) | Default 44 x 44 pt; minimum 28 x 28 pt |
| Spacing between controls | "About 12 points of padding around elements that include a bezel. For elements without a bezel, about 24 points of padding works well around the element's visible edges." |
| Time-boxed UI | "Minimize use of time-boxed interface elements... Prefer dismissing views with an explicit action." |
| Reduce Motion | Tighten springs, track gestures directly, avoid z-axis depth animation, replace x/y/z transitions with fades, avoid animating into and out of blurs. |
| Color | "Convey information with more than color alone." |
| Increase Contrast | If default contrast falls short, provide a higher-contrast scheme under Increase Contrast. |
| Assistive Access | Identify core functions, one interaction per screen, confirm hard-to-undo actions twice. |

Note: 28 x 28 is Apple's floor for a control's size, not its hit region; the button page still asks for a 44 x 44 hit region. Orby's 44 everywhere rule is correct and stricter.

---

## 13. Writing (as it affects hierarchy)

Sources: [HIG Writing, https://developer.apple.com/design/human-interface-guidelines/writing]; [WWDC25 404 "Make a big impact with small writing changes", https://developer.apple.com/videos/play/wwdc2025/404]

- "Consider each screen's purpose. Pay attention to the order of elements on a screen, and put the most important information first... If you're trying to convey more than one idea, consider breaking up the text."
- "Be action oriented... When labeling buttons and links, it's almost always best to use a verb." "Just saying 'Send' often works better than 'Let's do it!'"
- "Use possessive pronouns sparingly... 'Favorites' conveys the same message as 'Your Favorites'." "Avoid using we altogether." (Orby's "YOUR PLAN" caption is an owner-approved label; the HIG would shorten it to "Plan". Flag only, do not change without the owner.)
- "Choose a style for each UI element type and use it consistently," for example title case for alerts or sentence case for headlines.
- "Provide clear next steps on any blank screens... give them a button or link to do so if possible."
- Errors: near the problem, no blame, say how to fix it, no "oops".
- Remove filler: adverbs, adjectives, interjections, pleasantries, and repetition. "Your app doesn't have a minimum word count." [WWDC25 404]

---

## 14. Progressive disclosure and secondary actions

- Disclosure controls: "Place controls that people are most likely to use at the top of the disclosure hierarchy so they're always visible, with more advanced functionality hidden by default." "Use no more than one disclosure button in a single view." Label what is hidden. [HIG Disclosure controls, https://developer.apple.com/design/human-interface-guidelines/disclosure-controls]
- Menus collect secondary actions that "are often not important enough to be prominently displayed, but they still should have easy access. And they can really clean up your design a lot and help you focus on what really matters." Files in iOS 13 had "many actions scattered across the view, and that takes attention away from your content." Keep frequent, important actions visible (compose in Messages). [WWDC20 10205 "Design with iOS pickers, menus and actions", https://developer.apple.com/videos/play/wwdc2020/10205]
- iOS best practice: "Help people concentrate on primary tasks and content by limiting the number of onscreen controls while making secondary details and actions discoverable with minimal interaction." Controls in the middle or bottom of the display are easier to reach. [HIG Designing for iOS, https://developer.apple.com/design/human-interface-guidelines/designing-for-ios]

---

## 15. Guardrail: Activity rings

[HIG Activity rings, https://developer.apple.com/design/human-interface-guidelines/activity-rings]: "Never show Move, Exercise, and Stand progress in another ring-like element." "Differentiate other ring-like elements from Activity rings... use padding, lines, or labels to separate them." Rings are never decoration or branding. Orby's U-arc gauge (a 220 degree arc, one series, Deep Sky on Haze) and the Orb do not imitate the three-ring Move/Exercise/Stand element. Keep it that way: no concentric red, green and blue rings anywhere, including the Learned streak bulbs.

---

## 16. Apple Design Awards 2026: what the judges rewarded

[ADA, https://developer.apple.com/design/awards/] Categories: Delight and Fun, Inclusivity, Innovation, Interaction ("Intuitive interfaces and effortless controls perfectly tailored to their platform"), Social Impact, Visuals and Graphics ("Stunning imagery, skillfully drawn interfaces, and high-quality animations with a distinctive and cohesive theme").

Relevant winners:
- **Tide Guide** (Visuals and Graphics): "integrates the new design and Liquid Glass, adding extra polish to data presentation"; full-screen charts present data "in a crisp, clear manner that's easily understood." The closest analog to Orby's Progress tab: one clear chart, generous size, clean data.
- **Moonlitt** (Interaction): "best-in-class Liquid Glass integration" and easy onboarding.
- **Primary: News in Depth** (Social Impact): "with a properly minimal UI, Primary wisely gets out of the way... keeping the focus on the story."
- **grug** (Delight and Fun): a custom, hand-drawn look praised as "clever simplicity". A distinctive brand is rewarded when the structure stays simple.
- **Guitar Wiz** (Inclusivity): VoiceOver, Dynamic Type, Increased Contrast and Differentiate Without Color.

Reading across them: the judges reward a distinctive, cohesive visual theme on top of a calm, conventional structure. A custom brand does not need custom structure.

---

## 17. Where Apple's defaults and a custom-branded app part ways

Orby is a web app in a Capacitor shell with its own brand (Fraunces, Inter, Inter Tight, Paper cards on a Cloud wash, a Paper tab capsule). It cannot use SF, system colors or real Liquid Glass. The question for each default is whether Apple's reason still holds.

| Topic | Apple default | Orby today (brand guide) | Recommendation for the standard | Why |
|---|---|---|---|---|
| Side margin | 16 to 20 pt, system-chosen by width | 16 px at every width (`--gutter`) | Keep 16. Option to test: 20 at 428 pt and wider. Decide on screenshots at 440, not by rule. | 16 is inside Apple's range. Apple does not publish which width gets 20, and one gutter keeps every edge aligned. |
| Typefaces | "Minimize the number of typefaces" | Three: Fraunces, Inter, Inter Tight | Keep Fraunces and Inter. Inter Tight appears only in caps captions and gauge end labels; fine, but never add a fourth. | Two voices (serif display, sans UI) are a clear hierarchy; the third is a narrow, rule-bound role. |
| Body size | 17/22 | 16/24 for body and assistant replies; 17/22 `--fs-row` for headlines | Keep 16/24 for long reading (the looser leading is Apple's own advice for long passages). Use 17 (`--fs-row`) for primary row and tile text people scan. | Apple's 17 is the scanning default; its own Medium setting uses 16 for body. |
| Type scale match | 34, 28, 22, 20, 17, 16, 15, 13, 12, 11 | 38 title, 26 section, 22 card, 17 row, 16 body, 15 sub, 13 foot, 12 small, 11 caps | Close match at and below 22. The serif titles run larger than Apple's (38 vs 34, 26 vs 28); fine for a display serif, but keep the brand's limit of 4 Fraunces and 5 Inter sizes per screen. | Apple's small-end steps of 1 to 2 pt are intended for SF; Orby mirrors them. |
| Emphasis per style | One extra weight per style | Fixed weights per role | Do not add ad hoc weights. Emphasis inside a line uses 600 Inter or color (Night Ink vs Dusk), never a new size. | Keeps hierarchy legible at every text size. |
| Caps section headers | Removed in iOS 26 for legibility | Caps caption style, at most one per card, at most 4 words | Keep caps only as an eyebrow above a title. Never use caps as the only label of a section people scan for. Section titles stay Fraunces sentence case (they already are). | Apple dropped all-caps section headers because they read worse; a short eyebrow is a different job. |
| Navigation and tab bar | System bar on Liquid Glass, at most 5 tabs on iPhone | Paper tab capsule with 6 tabs plus an ask bar | Keep (owner approved). Check: each tab at least 44 pt wide at 320 (296 / 6 = 49 pt), single-word labels, never hidden on tab roots, labels hide above 150 percent text (already specified). | The HIG's concern is overflow and findability; six single-word tabs that all fit avoid both. |
| Controls versus content | Glass functional layer over content | Paper chrome with `--shadow-float`; cards with `--shadow-1` | Keep the two-plane idea: only chrome floats. Never give a content card the float shadow or a glass look. | This is Apple's main hierarchy device in iOS 26; Orby achieves it with shadow strength and a scroll fade instead of glass. |
| Decoration for emphasis | "Hierarchy... through layout and grouping" | Sunrise glow under one hero card per screen | Keep the single glow (it marks the one most important thing). Do not add tints, borders or extra glows to secondary cards. | One emphasis device per screen keeps it meaningful. |
| Corners | Concentric radii | 24 card, 18 tile and group, 14 control, pill | Inside a 24 px card with 16 px padding, a concentric inner radius is 8; Orby uses 14 or 18 for inset items. Accept for the brand, but avoid an inner element within 4 px of the card edge, where the mismatch shows. | Apple calls pinched or flared nested corners a craft flaw. |
| Prominent buttons | One or two per view | One Sky primary per screen | Keep one. | Stricter than Apple; consistent with the HIG's reasoning. |
| Toasts | Avoid time-boxed UI | 3.2 s toast, 5 s with an action (Undo) | Keep, but every action offered in a toast must also be reachable without it, and VoiceOver users need a longer timeout or a persistent route. | HIG Accessibility, time-boxed elements. |
| Dark Mode | Expected | Light only in v1 | Out of scope for layout; note as a known deviation. | HIG Dark Mode. |
| Bold Text setting | Custom fonts should respond | Not specified | Add to the standard: under Bold Text, step Inter weights up one notch (400 to 500, 500 to 600). Needs a native bridge to read the setting in a WKWebView. | HIG Typography, custom fonts. |
| Row heights | 52 in iOS 26 lists (measured) | 56 / 64 inset group rows | Keep. | At or above the iOS 26 default. |

---

## 18. Checkable rules for the layout standard

Each rule names its source. "Fail" means the screen pass must fix it or record a reason.

Hierarchy and order
1. Each screen has one named primary element, placed first under the title, and it is the largest or highest-contrast element on the screen. [WWDC26 250; HIG Layout]
2. At most one hero card and one sunrise glow per screen. [Repo brand 6.4; WWDC25 356]
3. Secondary material is folded, linked or in a sheet, and each fold names what it hides ("3 more", "History"). [HIG Layout, Disclosure controls]
4. No element is emphasized by decoration alone (an extra border, tint or shadow with no change in order, size or grouping). [WWDC25 356]

Grouping and spacing
5. Related items are closer to each other than to unrelated items. Inside a card, lines that belong together sit 4 to 8 apart and groups within the card 12 to 16 apart (never more than the 16 card padding). Between cards the gap is 12, which works only because each card's own edge does the grouping. Between sections the gap is 32, clearly larger than anything inside a section. [HIG Layout; WWDC17 802; Repo brand 5.1]
6. Every card edge, section title and chart's leading edge sits on the 16 px gutter. [HIG Layout, Charts]
7. Neighboring tap targets: about 12 pt clear around bezeled controls (chips, pills), about 24 pt around unbezeled ones (text links, bare icons), or their 44 pt hit boxes do not overlap. [HIG Accessibility]

Type
8. No text under 11 pt; UI text weight 400 or more. [HIG Typography]
9. Screen sizes in use per screen: at most 4 Fraunces and 5 Inter (11 counts once). [Repo brand 4.5; HIG Typography "minimize"]
10. Text of three or more lines never uses leading under 1.3 times the size. [HIG Typography]
11. At 200 percent text: nothing clips or overlaps, two-column grids become one column, horizontally adjacent text stacks, and the primary element is still first. [HIG Accessibility, Typography; Repo brand 11]

Color and contrast
12. Text 4.5:1 up to 17 pt, 3:1 at 18 pt and up or 600+ weight; small custom-colored text aims for 7:1. [HIG Accessibility, Dark Mode]
13. Two text emphasis levels for content (Night Ink, Dusk); a third only for unavailable or placeholder text. [HIG Labels]
14. One color, one meaning: Deep Sky means interactive or data; it is not used for decorative, non-interactive text. [HIG Color]

Controls
15. At most one prominent (Sky) button per screen; alternatives differ by style, not size. [HIG Buttons]
16. Every tappable thing has a 44 x 44 pt hit region and a press state. [HIG Buttons]
17. Segmented controls on iPhone have at most about 5 segments, equal widths, all text or all icons, noun labels. [HIG Segmented controls]
18. One sheet at a time; resizable sheets have a grabber and swipe to dismiss. [HIG Sheets]

Charts
19. Every chart has a text headline stating the takeaway with the number, above the chart. [HIG Charts; Repo brand 6.8]
20. Detail charts: about 4 horizontal gridlines, intuitive tick steps, bars from zero; glance charts: no gridlines or axis labels and a tap leads to the detail. [WWDC22 110340, 110342]
21. Critical values never require a tap or scrub to see. [HIG Charts]

Writing
22. Most important information first in every card; button labels start with a verb; no filler words. [HIG Writing; WWDC25 404]
23. Empty states say what will appear and give one action. [HIG Writing; Repo brand 6.11]

---

## 19. What this means for the pending owner requests

- **Progress range views (1W, 1M, 3M, 6M, YTD, 12M, All)**: seven options exceed the HIG's "no more than about five segments on iPhone". The 44 pt rule also fails at small widths: across a full 288 pt row (320 minus two 16 gutters) each of 7 segments gets 41 pt; inside a card (minus 32 more) 37 pt. At 390 it is 51 pt (full row) or 47 pt (in a card). Options for the screen pass: (a) a quiet text row of ranges outside the card padding, like Stocks, checked at 320 with Display Zoom; (b) five segments (1W, 1M, 3M, 6M, 12M) plus a "More" menu holding YTD and All; (c) let the row scroll horizontally with partial content visible at the edge. Option (b) is the only one that satisfies both HIG numbers. The owner asked for all seven, so whichever is chosen keeps all seven reachable. Put the chart's headline number and takeaway above the chart, and keep the same chart style across ranges (HIG continuity).
- **Learned lightbulb streak**: seven bulbs in a row. If the bulbs are display only, no target rule applies; if they are tappable, each needs 44 pt, which fails inside a card at 320 (256 / 7 = 37). Make them display only, with the whole tracker as one 44+ pt target. Print the streak as text ("4 days in a row"), since lit versus unlit must not be the only signal. [HIG Accessibility, color alone] Removing the "Learned: N things on N days" tile follows "every element earns its place". [HIG Design principles]
- **Journal**: removing the Entries / Library switch removes a segmented control that switched between two different sections (a tab-level job per the HIG). The Remember when header holds one caption eyebrow, the quote and a share button; the quote is the most important line and should be the largest text in that header. [HIG Layout; Repo brand 4.3]
- **Plan summary with the assistant inside**: the HIG says "display only one sheet at a time" and "for complex or prolonged user flows, consider alternatives to sheets." If the plan summary is a sheet, the assistant must appear inside it (an inline composer at the bottom of the summary, expanding the sheet to the large detent) rather than opening a second sheet on top. A full-height presentation suits a detailed back-and-forth better than a medium detent.
- **Today readout pill**: restore "0 of 23 mi · 0 of 4 runs". Apple: "simple means adding context and information, so people can make informed decisions." The pill is the gauge's text equivalent (brand guide 6.5 and 11), and VoiceOver should read both numbers.

---

## 20. Sources

| Source | URL | Type |
|---|---|---|
| HIG: Design principles | https://developer.apple.com/design/human-interface-guidelines/design-principles | First-party guidance |
| HIG: Designing for iOS | https://developer.apple.com/design/human-interface-guidelines/designing-for-ios | First-party guidance |
| HIG: Layout | https://developer.apple.com/design/human-interface-guidelines/layout | First-party guidance |
| HIG: Typography | https://developer.apple.com/design/human-interface-guidelines/typography | First-party guidance |
| HIG: Color | https://developer.apple.com/design/human-interface-guidelines/color | First-party guidance |
| HIG: Dark Mode | https://developer.apple.com/design/human-interface-guidelines/dark-mode | First-party guidance |
| HIG: Labels | https://developer.apple.com/design/human-interface-guidelines/labels | First-party guidance |
| HIG: Lists and tables | https://developer.apple.com/design/human-interface-guidelines/lists-and-tables | First-party guidance |
| HIG: Collections | https://developer.apple.com/design/human-interface-guidelines/collections | First-party guidance |
| HIG: Charts | https://developer.apple.com/design/human-interface-guidelines/charts | First-party guidance |
| HIG: Charting data | https://developer.apple.com/design/human-interface-guidelines/charting-data | First-party guidance |
| HIG: Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons | First-party guidance |
| HIG: Tab bars | https://developer.apple.com/design/human-interface-guidelines/tab-bars | First-party guidance |
| HIG: Toolbars (includes navigation bars) | https://developer.apple.com/design/human-interface-guidelines/toolbars | First-party guidance |
| HIG: Segmented controls | https://developer.apple.com/design/human-interface-guidelines/segmented-controls | First-party guidance |
| HIG: Sheets | https://developer.apple.com/design/human-interface-guidelines/sheets | First-party guidance |
| HIG: Materials | https://developer.apple.com/design/human-interface-guidelines/materials | First-party guidance |
| HIG: Scroll views | https://developer.apple.com/design/human-interface-guidelines/scroll-views | First-party guidance |
| HIG: Accessibility | https://developer.apple.com/design/human-interface-guidelines/accessibility | First-party guidance |
| HIG: Writing | https://developer.apple.com/design/human-interface-guidelines/writing | First-party guidance |
| HIG: Disclosure controls | https://developer.apple.com/design/human-interface-guidelines/disclosure-controls | First-party guidance |
| HIG: Progress indicators | https://developer.apple.com/design/human-interface-guidelines/progress-indicators | First-party guidance |
| HIG: Widgets | https://developer.apple.com/design/human-interface-guidelines/widgets | First-party guidance |
| HIG: Activity rings | https://developer.apple.com/design/human-interface-guidelines/activity-rings | First-party guidance |
| Apple doc: ContentMarginGuide.container (16 to 20 pt) | https://developer.apple.com/documentation/swiftui/contentmarginguide/container | First-party documentation |
| Apple doc: systemMinimumLayoutMargins | https://developer.apple.com/documentation/uikit/uiviewcontroller/systemminimumlayoutmargins | First-party documentation |
| Apple doc: readableContentGuide | https://developer.apple.com/documentation/uikit/uiview/readablecontentguide | First-party documentation |
| Apple doc: Adopting Liquid Glass | https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass | First-party documentation |
| Apple doc: UIButton.Configuration | https://developer.apple.com/documentation/uikit/uibutton/configuration-swift.struct | First-party documentation |
| Apple doc: SwiftUI PrimitiveButtonStyle | https://developer.apple.com/documentation/swiftui/primitivebuttonstyle | First-party documentation |
| WWDC26 250: Principles of great design | https://developer.apple.com/videos/play/wwdc2026/250 | First-party guidance |
| WWDC25 356: Get to know the new design system | https://developer.apple.com/videos/play/wwdc2025/356 | First-party guidance |
| WWDC25 219: Meet Liquid Glass | https://developer.apple.com/videos/play/wwdc2025/219 | First-party guidance |
| WWDC25 404: Make a big impact with small writing changes | https://developer.apple.com/videos/play/wwdc2025/404 | First-party guidance |
| WWDC24 10074: Get started with Dynamic Type | https://developer.apple.com/videos/play/wwdc2024/10074 | First-party guidance |
| WWDC22 110340: Design an effective chart | https://developer.apple.com/videos/play/wwdc2022/110340 | First-party guidance |
| WWDC22 110342: Design app experiences with charts | https://developer.apple.com/videos/play/wwdc2022/110342 | First-party guidance |
| WWDC20 10175: The details of UI typography | https://developer.apple.com/videos/play/wwdc2020/10175 | First-party guidance |
| WWDC20 10205: Design with iOS pickers, menus and actions | https://developer.apple.com/videos/play/wwdc2020/10205 | First-party guidance |
| WWDC20 10103: Design great widgets (16 pt margins) | https://developer.apple.com/videos/play/wwdc2020/10103 | First-party guidance |
| WWDC19 808: What's New in iOS Design (label and background levels) | https://developer.apple.com/videos/play/wwdc2019/808 | First-party guidance |
| WWDC17 802: Essential Design Principles | https://developer.apple.com/videos/play/wwdc2017/802 | First-party guidance |
| Apple Design Awards 2026 | https://developer.apple.com/design/awards/ | First-party, judges' commentary |
| Apple Developer Forums 797389 (44 pt in iOS 18, 52 pt in iOS 26 list cells) | https://developer.apple.com/forums/thread/797389 | Practitioner observation (search summary only) |
| MartianCraft, Notes from the margins (16 vs 20 pt observation) | https://martiancraft.com/blog/2019/02/notes-from-the-margins/ | Practitioner opinion (search summary only) |
| SAP Fiori for iOS, Layout basics (16 compact, 20 regular) | https://www.sap.com/design-system/fiori-design-ios/v25-8/foundations/adaptive-layout/layout-basics | Practitioner (third-party design system, search summary only) |
| kde.hateblo.jp translation of the old HIG Themes page | https://kde.hateblo.jp/entry/2020/05/11/001546 | Practitioner (translation, search summary only) |
| Mirror of Apple's iOS 7 era HIG PDF | https://www.evl.uic.edu/datsoupi/420_14/docs/MobileHIG.pdf | Historical Apple document on a third-party mirror (not opened) |
| Orby brand guide | `docs/brand/brand-guide.md` | Repo |

## 21. Gaps

- Apple no longer publishes iPhone row heights, section spacing in grouped lists, or the width at which margins change from 16 to 20 pt. The 52 pt row figure is one developer's measurement.
- Apple gives no maximum number of type sizes per screen; the "4 Fraunces, 5 Inter" limit is Orby's own.
- The exact iOS 26 inset grouped corner radius and sheet corner radius are not published ("increased" only).
- The tab count limit of five on iPhone comes from UIKit behavior and the HIG's "More" description, not a number on the HIG page.
- The HIG says nothing specific about web views; mapping Bold Text and Increase Contrast into WKWebView needs native work and is outside Apple's guidance.
- Health and Stocks range controls were not inspected on a device in this pass; the HIG text on Stocks is quoted, nothing more.
