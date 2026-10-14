# Logbook consumer research: what "premium" means, and what to change

Head of Consumer UX Research, October 2026. Input to the redesign. Brand values in `docs/brand.md` stay; on structure and behaviour this supersedes the layout recipes in `docs/design-spec.md`.

**Method.** Desk research on the benchmark apps (vendor pages, App Store listings, award citations, reviews, forums), published research (NN/g, Apple HIG, Material 3 Expressive), and a screen-by-screen read of the current build at 390pt. Vendor pages are reliable on what ships; retention and opt-in figures are mostly vendor-sourced and directional.

**What the current build gets wrong, in one paragraph.** Every tab uses the same template: serif title, prev/next arrows, a segmented control, a hero card with three or four stamped numbers, then a list. Same template, different jobs: that is what reads as "thrown together". The hero then duplicates the list under it: "SPEED 5" appears twice on Today and twice on Plan, and the Morning hero repeats the first four timeline blocks. Numbers render as zeros most of the week ("0.0 of 26 mi", "0 days", "0 open", "0%"), which reads as a failing grade. Habits, the most frequent daily action, sit below the fold. On Journal, the composer (the page's main job) is third, behind a quote and a throwback. Objects mostly respond only to taps on chips ("Shuffle", "Hide", "Open", "Edit", "Add").

---

## 1. Ten principles that separate premium from bare-bones

**P1. One screen, one job, one hero. Nothing is shown twice.**
- Oura's 2025 redesign cut five tabs (Home, Readiness, Sleep, Activity, Resilience) to three (Today, Vitals, My Health). Today leads with "One Big Thing" for the day, and its design lead compares the tab to a news app's "Top Stories" ([Oura](https://ouraring.com/blog/new-oura-app-experience/), [9to5Google](https://9to5google.com/2025/10/20/oura-app-redesign/)).
- WHOOP Home puts three dials (Sleep, Recovery, Strain) at the top, and each opens its own deep dive. The dial is a summary, never a duplicate of the detail ([WHOOP](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/)).
- *Logbook:* the hero *is* the session. Delete the Training row that repeats it, and delete the Morning hero that repeats the timeline.

**P2. The screen knows what time it is.**
- Oura's Today shows a daily highlight that changes with the time of day ([Oura](https://ouraring.com/blog/new-oura-app-experience/)).
- Flighty (Apple Design Award 2023, Interaction) cycles through about 15 trip states, so each phase of a trip shows only what matters then ([design analysis](https://blakecrosley.com/guides/design/flighty)).
- Stoic splits the day into Morning and Evening cards ([MobileSyrup](https://mobilesyrup.com/2019/06/09/stoic-self-reflection-journaling-app-review/)).
- *Logbook:* Today has pre-run, post-run and evening states (§2.2). This absorbs the Morning tab.

**P3. The thing is the control.**
- Streaks: each habit is one big button, and you tap and hold it to complete ([Apple, Apps We Love](https://apps.apple.com/be/story/id1272004658)).
- Things 3: you drag the Magic Plus button to the exact spot where the new item belongs. Drop it on a day in Upcoming and that sets the date ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/), [9to5Mac](https://9to5mac.com/2017/05/19/friday-5-things-3-video-top-features/)).
- Structured: you drag tasks along the timeline, or from the inbox into a free slot ([Structured help](https://help.structured.app/en/articles/380546)).
- *Logbook:* drag the wake marker, the run block's edge, a session onto another day. Chip buttons ("Edit", "Shuffle", "Hide") go.

**P4. Every touch gets a physical answer, and the strength matches the event.**
- Apple's HIG: match haptic intensity to the animation, be consistent, avoid overuse; "the best haptic experience is one that people may not be conscious of, but miss when it's turned off" ([HIG: Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)).
- Copilot Money reviewers cite "haptic feedback on every transaction tap" ([review](https://freenance.io/products/copilot-money-review-2026-budgeting-app-iphone-best-design/)); an Amie user: "I feel I am holding a small calendar in my hand" ([Amie](https://amie.so/reviews)).
- (Not Boring) Habits won an Apple Design Award in 2022. Its checkbox fires 3D animation, custom sound and haptics together ([Apple, Behind the Design](https://cur.at/wicwETc?m=web)).
- *Logbook:* a named haptic vocabulary with eight events (§4). Today the app has three (`tick`, `success`, `warn`).

**P5. Motion is physics, interruptible, and rare.**
- SwiftUI made springs the default animation and reduced them to two parameters, duration and bounce ([WWDC23 "Animate with springs"](https://developer.apple.com/videos/play/wwdc2023/10158/)).
- Material 3 Expressive (46 studies, 18,000+ participants) shipped physics-based springs; key elements were found up to 4x faster ([Fast Company](https://www.fastcompany.com/91333562/google-maximalist-new-material-design-kit), [Android Authority](https://www.androidauthority.com/google-material-3-expressive-features-changes-availability-supported-devices-3556392/)).
- The frequency rule from Emil Kowalski's animations.dev material: actions done 100 or more times a day get little or no animation, and UI motion stays under about 300ms ([summary](https://www.ui-skills.com/skills/emilkowalski/emil-design-eng)). Strava users complained in 2025 that a new kudos animation was "excessive" when given several times in a row ([r/Strava](https://www.reddit.com/r/Strava/comments/1jpjwps/why/)).
- *Logbook:* springs everywhere, gestures that carry their velocity, and celebration reserved for one or two moments a day.

**P6. Progress, not grades.**
- Gentler Streak won the 2024 Apple Design Award for Social Impact. Rest and active recovery keep its streak alive, and its monthly summary compares you with your own past, not with a target ([Apple ADA 2024](https://developer.apple.com/design/awards/2024/)).
- Runna's "Not Feeling 100%" lets you pause or soften the plan for 3 to 14 days and then eases you back "without losing your place" ([Runna support](https://support.runna.com/en/articles/12809806-feeling-unwell-how-to-adapt-your-training-plan)).
- On the other side, users describe a broken streak as "worse than never starting" and say the reset "gave me permission to give up" ([Indie Hackers](https://www.indiehackers.com/post/im-removing-the-streak-counter-from-my-habit-app-here-s-why-7d2a6179dd), [r/Habits](https://www.reddit.com/r/Habits/comments/1gdc5lw/a_habit_tracker_that_wont_make_you_feel_bad)).
- *Logbook:* no zeros on display. Streaks are counted in weeks and survive rest days and days where the floor was met.

**P7. Summary on the surface, depth behind a tap, never behind a menu.**
- NN/g defines progressive disclosure as showing primary options by default and deferring the rest to a secondary screen ([NN/g](https://www.nngroup.com/videos/progressive-disclosure/)).
- Apple Fitness locks the rings to the top of Summary and lets you edit the cards below them ([MacStories](https://www.macstories.net/stories/watchos-11-the-macstories-review/4/)).
- Oura colours each readiness contributor (Optimal, Good, Fair, Pay attention), and a tap explains why ([Oura support](https://support.ouraring.com/hc/en-us/articles/360057791533)).
- *Logbook:* a hero shows at most one number plus one sentence. The stat grids move into the detail sheet.

**P8. Instant paint, optimistic writes, and no spinners for content.**
- NN/g: show skeletons for full-page loads, spinners only for 2 to 10 second waits, and a percent-done indicator beyond that ([NN/g video](https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/)). A Viget study found skeletons can feel *slower* when they don't match the final layout, so a skeleton must be the real layout, greyed out.
- *Logbook:* the query snapshot already persists. Paint from it, and when Strava data arrives, animate the numbers to their new values instead of reloading.

**P9. Value before asks.**
- Apple's HIG: onboarding should be "fast, fun, and optional", and requests for information should be deferred "until the situation requires it" ([HIG: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)).
- In an NN/g test with 70 users, people who read deck-of-cards tutorials rated tasks *harder* than people who skipped them, and did no better on success or time ([NN/g](https://www.nngroup.com/articles/mobile-tutorials/)).
- Opal's onboarding is a short quiz that produces a personal "Focus Report" before anything is asked of you ([ScreensDesign](https://screensdesign.com/showcase/opal-screen-time-control)).
- *Logbook:* three questions produce a real morning timeline and a week, and only after that do we ask for Strava and an account.

**P10. Make the output worth sharing.**
- Strava's stats sticker overlays the route and numbers on any photo in Instagram Stories, and "Copy to clipboard" yields a transparent PNG ([Tom's Guide](https://www.tomsguide.com/wellness/fitness/stop-screenshotting-your-runs-this-hidden-strava-feature-looks-much-cleaner-on-instagram)).
- Spotify Wrapped is built as 9:16 slides, one stat per slide, shareable in one tap. Spotify reports about 500M shares in the first day of the 2025 edition ([NoGood](https://nogood.io/2025/01/20/spotify-wrapped-marketing-strategy/)).
- Share Aura (`brand.md` Part 1) is this principle as a product.
- *Logbook:* every finished run, closed day and closed week is one tap away from a 9:16 card in the Night style.

---

## 2. Page architecture

### 2.1 Patterns from the best apps

**Daily home.** Answer "how am I, and what do I do now" in about 2 seconds, then get out of the way.
- **Oura:** score shortcuts at the top, then one highlight that changes with the time of day, then a timeline of the day.
- **WHOOP:** three dials, each with its own deep dive, then the week's plan. Members can also *hide* scores; WHOOP suggests this for game days.
- **Bevel:** circles for strain, recovery and sleep, with editable cards below ([Bevel listing](https://apps.apple.com/us/app/bevel-all-in-one-health-app/id6456176249)).
- The common shape: **adaptive hero, a row of things you touch, a short list, "more" behind a tap**. Above the fold: one verdict, one primary action, the most frequent tappables. Behind a tap: breakdowns, history, settings, anything weekly.

**Timeline / planner.** Structured draws the day as one column of blocks, each with a start and a duration, and keeps an inbox for unscheduled items that you drag into a free slot. Its week view opens by dragging a grey handle above the day ([Structured 4.0](https://structured.app/blog/4-0)). The timeline is the whole screen; "now" is a line; free time is visibly empty.

**Calendar / plan.**
- **Runna:** each week lists the coach's runs. You can move days, and opening a run shows its pace and timing targets ([TechRadar](https://www.techradar.com/health-fitness/fitness-apps/runna-review)).
- **Things:** Upcoming is a scrolling agenda of days. A drop on a day is a date.
- **Amie:** to-dos sit in a column, and you drag them onto the week ([TechCrunch](https://techcrunch.com/2024/01/24/amie-brings-your-email-inbox-to-its-calendar-app/)).
- The common shape is a **vertical agenda of day rows for the week**, with a month or season view reached by zooming out, not by a tab.

**Trends.** Per Apple's HIG on charts, an effective chart "highlights a few key pieces of information" ([HIG: Charts](https://developer.apple.com/design/human-interface-guidelines/charts)).
- **Gentler Streak:** compares you only with your own history.
- **Robinhood:** you scrub the line, and the headline number becomes the value under your finger ([Spark library](https://github.com/robinhood/spark)).
- The common shape is a **one-sentence verdict, then one chart you can scrub, then drill-downs**.

**Journal.**
- **Day One:** a Daily Prompt, On This Day, and a streak, each one tap from a new entry ([Day One widgets](https://dayoneapp.com/blog/introducing-widgets/)).
- **Apple Journal:** suggests moments to write about from on-device data, *workouts included* ([Apple Newsroom](https://www.apple.com/newsroom/2023/12/apple-launches-journal-app-a-new-app-for-reflecting-on-everyday-moments/)).
- **Stoic:** pairs a morning intention with an evening reflection.
- The common shape is **writing first, with a prompt built from your own day; memory second**.

### 2.2 Logbook, tab by tab

**Recommended tab bar: Today · Plan · Trends · Journal.** Morning becomes Today's pre-run state plus a full-screen timeline one tap away; two "today" tabs split one job. Settings becomes a profile sheet.

**Today**
- **Jobs, in order:**
  1. Know today's training, do it, and see it land.
  2. Clear the small daily things (habits, then to-dos).
  3. Close the day (two sentences).
- **First screen** (390×844, no scroll):
  - A small date line; the hero's serif word replaces the 44pt "Today".
  - The **adaptive hero**:
    - *Before the run:* "Out the door in 22 min", with the session's serif word, a thin mini-timeline (wake → door → back → leave) and the now dot on it.
    - *After a Strava sync:* the route line drawn on black with the stamped DISTANCE / PACE / TIME.
    - *Rest day:* "Rest" plus one line of recovery copy.
    - *Evening:* "Close the day".
  - The **habit orb row**, one line of 5 to 7 orbs.
  - **Top 3 to-dos for Today**, with a "+2 more" row.
- **Behind a tap:**
  - Hero → session sheet (shared element); pull down on the hero → full Morning timeline; week ring → week sheet.
  - Later/Someday in a sheet; Today's read only in the evening state.
- **Remove or merge:**
  - The duplicate Training section (a second session becomes a swipeable page of the hero).
  - The 3-up stat strip (Week / Streak / To-dos).
  - The daytime journal composer, which moves to the evening state and to Journal.
  - The prev/next arrows. Swipe the date line, or tap it for a date picker.

**Morning** (now a full-screen timeline reached from the Today hero)
- **Jobs:**
  1. When must I leave?
  2. Bend the morning (wake later, run shorter) and see the knock-on effects.
  3. Check it fits work.
- **First screen:** the timeline only, with a 48pt time axis, a blue now line, blocks sized to their duration, and free time left empty and labelled ("18 min free"). The leave-for-work block is pinned as the endpoint.
- **Direct manipulation:** drag the wake marker (tick per 5 min); drag the run block's bottom edge (tick per 0.5 mi, pace drives minutes); long-press a block to edit or skip; "Make this a rest day" lives in the run block's menu.
- **Remove:** the Plan/Settings segmented control (routine defaults → long-press any block → "Edit routine"), the repeating hero, the week strip (swipe to change days).

**Plan**
- **Jobs:**
  1. See this week and reshape it around life (move, swap, skip).
  2. See the block's arc: build weeks, down weeks, race day.
  3. Make or regenerate a block.
- **First screen:**
  - A week header showing the total ("26 mi planned · 5 runs") with a thin progress bar.
  - Seven **day rows**: weekday, a session tone bar, the session name in its stamp, distance, and a done mark. Today is lit with the halo.
  - Rest days are their own quiet rows.
- **Direct manipulation:**
  - Drag a session onto another row; dropping it onto an occupied day swaps the two.
  - Swipe a row right to mark it done, or left to skip or move.
  - Pinch in, or pull the header down, to zoom to the month and block grid with a 7-column heat of planned vs run. Tap a week there to zoom back.
- **Behind a tap:** session editor (sheet); plan builder as a full-height sheet ("New block…") whose AI draft lands as ghosted rows, accepted in one tap.
- **Remove:** the selected-day hero, the Week/Month/Plans segmented control, the "Open" row.

**Trends**
- **Jobs:**
  1. Am I on track this week and this block?
  2. Am I getting fitter (pace at effort, lift e1RM)?
  3. Am I consistent?
- **First screen:**
  - A verdict sentence in serif ("Three weeks building. This one is light so far.").
  - The weekly mileage chart, 220pt tall: run bars, ghost plan bars, an average line, and the current week in blue.
  - A scrub that rewrites the headline numbers live.
  - Tap a bar to open that week's sessions.
- **Behind a tap:** the lift detail with an e1RM line; the habit grid as a full sheet with per-habit rows.
- **Remove:**
  - The legend row. Label the series directly on the chart.
  - The "−12.2 mi vs avg" line early in the week. Compare to the same weekday last week instead.
  - The 1M/3M/6M segmented control (pinch, or small chips over the chart).

**Journal**
- **Jobs:**
  1. Write today's two sentences.
  2. Remember (on this day, past weeks).
  3. Collect fuel: quotes and reads.
- **First screen:**
  - The composer, open and focused on tap, with the placeholder built from the day: "Speed 5 done, 5.02 mi. How did it feel?" The quote of the day sits *inside* the composer as an optional prompt line, not as a hero card.
  - A **ribbon of the last 14 days** (a dot per entry), then "On this day".
- **Behind a tap:** tap a quote to open the library and favourites. Reads is a sub-page reached from a row.
- **Remove:** the Shuffle / Hide / Open chips. Swipe the quote card to shuffle, and long-press it to favourite or hide.

**Settings.** A sheet from an avatar in the Today date line. Strava status appears in-line only when broken ("Strava disconnected. Reconnect").

---

## 3. Direct-manipulation catalogue

| Gesture | Exemplar | Right when | Wrong when | Logbook use |
|---|---|---|---|---|
| **Tap the content** | Streaks button, WHOOP dial → deep dive | The object has one obvious next step | The tap does something irreversible | Hero → session sheet; orb → lit; bar → week |
| **Tap-and-hold to complete** | Streaks | Completion must be deliberate and celebrated | Frequent, low-stakes items (it's slow) | Marking a *session* done by hand (400ms hold with a filling ring). Not to-dos. |
| **Long-press context menu with preview** | iOS system menus. HIG: preview the target and put destructive items last ([HIG: Context menus](https://developer.apple.com/design/human-interface-guidelines/context-menus)) | Secondary actions on any object | It is the *only* path to an action | Every object: session (Move, Swap, Skip, Not feeling 100%, Share), to-do (Today/Later/Someday, Priority, Delete), orb (Edit, Reorder), quote, read |
| **Drag to reorder** | HIG: "people appreciate being able to reorder a list" ([HIG: Lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)) | Order carries meaning | Order is computed (the timeline) | To-dos and orbs. Lift on a 350ms hold with a 1.03 scale, siblings spring aside. |
| **Drag across days or slots** | Things Upcoming, Amie, Structured | The date is the property being changed | The targets are off-screen without auto-scroll | Plan day rows, and onto the Today hero ("do it today") |
| **Drag a handle or edge** | Structured timeline | A continuous value with a visual length | Values need exact entry | Wake marker, run length, block duration |
| **Swipe actions with thresholds** | Todoist (configurable left/right: Complete, Schedule, Delete) ([Todoist](https://todoist.com/help/articles/how-to-change-your-swipe-actions-D5DQOQz6)), Linear inbox | Fast triage of many rows | Rows that also scroll horizontally, or a single object | To-do: right = done, left = Later. Session: right = done, left = Move. Commit at 40% of row width, haptic at threshold, full swipe only with Undo. |
| **Swipe a card horizontally** | Pager cards | Peers of equal rank | Content with horizontal scroll inside | Two-a-day sessions on the hero; shuffling the quote |
| **Edge-swipe or swipe the date line** | Calendar apps | Moving between adjacent days | It fights iOS back-swipe | Swipe on the date line or the hero only, never a full-screen edge. Tap the date to return to today. |
| **Scrub a chart** | Robinhood scrub; wagmi-charts fire a selection haptic on every value change ([docs](https://github.com/coinjar/react-native-wagmi-charts)) | Time series where exact values matter | Charts under 4 points | Mileage chart (tick per week), lift e1RM, pace |
| **Pinch to zoom** | Arc Search pinch-to-summarize, praised as "the new pull-to-refresh" ([Spyglass](https://spyglass.org/pinch-to-summarize/)) | Changing level of detail (week ↔ month, 3M ↔ 6M) | It is the only path. Add a visible affordance once. | Plan week ↔ month; Trends range |
| **Pull to refresh** | Mail | The user believes data is stale (Strava) | Data is live-synced anyway | Today and Trends: pull = "check Strava now". Haptic at threshold; Success haptic only if a run arrived. |
| **Pull down on a hero / drag a grabber** | Structured's handle to week view | Expanding a summary into its full view | The page also scrolls the same way at that point | Today hero → full Morning timeline |

Rules:
- Every gesture has a visible fallback (context menu or sheet button); gestures have no visible affordance ([NN/g](https://www.nngroup.com/articles/ipad-usability-year-one/)).
- Teach a gesture once, in context: the first time a to-do appears, the row nudges 24px left and back.
- Gestures follow the finger 1:1 and keep their release velocity.

---

## 4. Motion and haptics system

### 4.1 Spring presets (motion/react)

Damping ratio ζ = damping / (2√(stiffness·mass)). Keep layout motion at ζ ≥ 0.85 (no visible bounce). Allow bounce only on completion.

```ts
// lib/motion.ts (replace current spring/springSoft)
export const springs = {
  press:    { type: 'spring', stiffness: 600, damping: 35, mass: 0.6 }, // ζ≈0.92, ~150ms. Scale 0.97 on down, 1 on up
  lift:     { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }, // ζ≈0.75. Drag pick-up to scale 1.03, shadow-free halo
  settle:   { type: 'spring', stiffness: 450, damping: 34, mass: 1 },   // ζ≈0.80. Drop into slot, siblings reflow
  sheet:    { type: 'spring', stiffness: 380, damping: 38, mass: 1 },   // ζ≈0.97, ~320ms. Sheets and detents, inherit drag velocity
  page:     { type: 'spring', stiffness: 300, damping: 32, mass: 1 },   // ζ≈0.92, ~360ms. Shared-element card→detail
  number:   { type: 'spring', stiffness: 170, damping: 26, mass: 1 },   // ζ≈1.0, ~480ms. Numeric tickers (useSpring)
  complete: { type: 'spring', stiffness: 500, damping: 18, mass: 0.8 }, // ζ≈0.45. One overshoot to 1.12, check/orb pop only
} as const;
// Equivalent shorthand, if preferred: press {visualDuration:.15,bounce:0}, sheet {.32,0.05}, page {.36,0.1}, complete {.3,0.35}
```

Tweens, only for things that do not move:
- Opacity: 120ms in, 100ms out.
- Colour and halo intensity: 200ms on the existing `ease` (0.22, 1, 0.36, 1).
- Never use ease-in on UI.
- Total UI motion stays ≤ 400ms, except the route draw (1.1s, once) and the ring close (≤ 900ms, once).

### 4.2 What animates on load, on change, never

- **First appearance per day, once:**
  - Hero numbers tick from their previous value. Never from 0 on a revisit.
  - The route line draws over 1.1s.
  - The week ring fills.
  - Store a "seen today" flag so tab returns are still.
- **On data change:** numbers spring to their new value (`number`). Rows enter at height 0 → auto plus opacity (`settle`), and leave by collapsing after their completion animation.
- **On tab switch:** an instant cut, or a 120ms crossfade at most. No slide, no stagger. Remove the current `pageVariants` y-offset and the list stagger on revisit.
- **Never:**
  - Animate while the user scrolls.
  - Loop ambient motion. The halo is static; the only exception is a 2s, 4%-amplitude pulse on the "now" dot.
  - Stagger more than 6 items, or more than 30ms apart.
  - Animate text colour on frequent toggles.
- **Reduced motion:** springs become 150ms opacity fades. Ring and route appear complete. Haptics stay unless the user disables them.

### 4.3 Shared-element transitions

The session row or hero opens into the session sheet: tone bar, serif title, stamp and route line all carry the same `layoutId` inside a `LayoutGroup`.
- Use `layout="position"` on text so it never stretches.
- The sheet background enters on `sheet`; the shared elements travel on `page`.
- Closing reverses the path, and an interrupted drag-dismiss sends elements back from wherever they are.
- Apply the same pattern to: habit orb → habit history sheet, mileage bar → week sheet, journal ribbon dot → entry, quote → library.

### 4.4 Haptic map

Capacitor Haptics exposes Light/Medium/Heavy impacts, Success/Warning/Error, and `selectionStart/Changed/End`. **Rigid and Soft need a ~30-line native plugin** around `UIImpactFeedbackGenerator(style:)`; worth it. iOS Safari (PWA) has no vibration API, so visuals must carry meaning alone.

| Event | Haptic | Notes |
|---|---|---|
| Tap to navigate or open a sheet | none | Visual press only. Frequency rule. |
| To-do checked | Light impact | At the moment the check draws |
| Habit orb lit | Soft impact (fallback Light) | Matches the round, glowing object |
| Last habit of the day lit | Success | Paired with the all-lit moment (§5) |
| Session marked done / Strava run lands on hero | Success | Once per session |
| Long-press lifts an object | Medium impact | On lift, not on menu open (iOS plays its own) |
| Dragged item crosses a day / slot / 5-min step / 0.5 mi | Selection changed | Throttle to ≥ 40ms between ticks |
| Drop into slot | Rigid impact (fallback Light) | "Snaps into place" (HIG) |
| Swipe crosses commit threshold, either direction | Rigid (fallback Light) | One per crossing |
| Chart scrub: each bar or point | Selection changed | Light impact at the max or a PR |
| Pull-to-refresh threshold | Light impact | |
| Delete committed (with Undo) | Medium impact | Never Warning; nothing went wrong |
| Week closed / plan block completed / ring closes | Heavy, then Success 120ms later | At most once a week |
| Sync failed, action blocked | Error | |
| Plan conflict on drop (two hard days back-to-back) | Warning | And an inline explanation |

**Subtlety rules:** at most one haptic per action; none for anything the user didn't cause (except a Strava arrival while open); fire on the visual peak's frame; a "Haptics" toggle, on by default (HIG: "make haptics optional").

### 4.5 Sound

Off by default. Offer one optional, very quiet pair (a soft click for the check, a two-note chime for the ring close), in the spirit of (Not Boring)'s "a dozen slightly different versions of the same click" ([Launched podcast](https://podcast.app/launched-by-revenuecat-p925850)). Always respect the silent switch.

---

## 5. Delight moments

- **Ring close (daily).** The week ring sits on the hero. When the day's session lands, the ring segment fills on `number`, the halo brightens 20% for 600ms, and one Success haptic plays. Closing is the only celebration, as with Apple's rings ([Apple Newsroom](https://www.apple.com/uk/newsroom/2025/04/get-active-with-apple-watch/)).
- **Checkmark.**
  - A to-do: the square fills in 120ms, the check stroke draws in 160ms, the text dims to ink-3 with a strike, and the row waits 700ms (still undoable with a tap) before collapsing on `settle`.
  - A habit: the orb gets the `complete` pop to 1.12 and its glow blooms.
  - No confetti.
- **All habits lit.** The orbs pulse once in sequence, left to right, 40ms apart, and the row's caption changes to "All lit." The deliberate, held completion follows Streaks; the reward is light, not particles.
- **Streak protection.**
  - The streak counts *weeks* that hit the floor (e.g. 3 runs or 80% of planned miles). Rest days and amber "floor met" days count.
  - A miss shows "7 of the last 8 weeks", never "0".
  - A "Not feeling 100%" action on any session softens the next 3 to 14 days and freezes the streak (after Runna). Duolingo protected 2M+ streaks with automatic freezes during outages ([Duolingo](https://blog.duolingo.com/protecting-streaks-from-site-issues/)). Apply the same rule for Strava sync gaps.
- **End-of-day summary (evening hero).**
  - Shows "Day, closed." with a stamped row (MI · HABITS · TO-DOS) and the two-sentence composer.
  - Once both sentences are written, the card collapses into a shareable 9:16 (route, stamps, the two sentences in serif).
- **Weekly recap, Sunday 7pm.**
  - Up to 5 story-format cards: miles vs plan, best run (route on black), lift progress, habits grid, your best sentence of the week.
  - Tap to advance, one Share button. This is Wrapped's format at weekly scale.
- **Strava arrival.** Mid-morning, the hero changes from "Out the door" to the result: the route draws, the numbers tick, Success plays, and a "Share" pill appears for 10s.

Guardrails: one celebration per action, nothing celebrates twice a day, no coins/badges/confetti, copy states the fact, not a cheer.

---

## 6. Onboarding and first run

**Evidence.**
- Day-30 retention for fitness apps is roughly 3% to 8% (vendor benchmarks) ([Sahha](https://sahha.ai/blog/health-app-churn-retention/), [Apptopia](https://apptopia.com/blog/we-know-you-didnt-keep-your-new-years-resolutions/)); onboarding friction and generic experiences are blamed. Tutorials don't help (NN/g); ask for permissions only when needed (HIG).
- About 63% of top apps show a priming screen before the iOS notification prompt ([Lazyweb](https://www.lazyweb.com/research/percent-apps-priming-screen-before-ios-notification-prompt)). onX reported a 10.6% opt-in lift from priming plus a win-back ([Phiture](https://phiture.com/success-stories/onx-inapp/)).
- Finch's critics flag front-loaded customization ([Pratt IxD](https://ixd.prattsi.org/2026/02/design-critique-finch-self-care-pet-ios-app/)).

**Logbook's first run** (about 60 seconds, no account until step 5):
1. **Promise.** Black screen, the mark, the halo rising, then "Your day, lit." and one button, "Start".
2. **Three questions**, one per screen, answered by direct manipulation:
   - "What are you training for?": race chips plus a date wheel, or "Just running".
   - "Which days can you run?": tap the weekday letters.
   - "When do you wake, and when do you leave for work?": drag two markers on a timeline. Selection ticks fire here, so the haptics are taught by use.
3. **The payoff.** A shared-element transition into a real Today. The hero reads "Tomorrow: Easy 4. Out the door 6:50." The week is generated, and tapping the hero shows the full timeline. This screen is the product.
4. **Strava, primed.** "See your runs land here." A sample route card animates in Night style, then "Connect Strava", then OAuth. Skipping is visible and guilt-free ("Later. You can log runs by hand.").
5. **Save.** "Keep your plan": Sign in with Apple, one tap. Ask only after value has been shown.
6. **Notifications, deferred.**
   - Ask at the end of the first evening, from the "Close the day" card: "A nudge at 9:30 to close the day?", then [Yes] [Not now], then the system prompt.
   - Ask about morning alerts after the first run lands.
7. **Empty states as teaching.** Every empty section shows one sentence and one action, with the halo at 40%. For example: "No habits yet. Add the first light." A gesture hint plays once per object type.

---

## 7. Copy and tone

The voice: verbs, the fact, then a plain clause (brand §Voice). Talk like a coach who respects you: specific numbers, no exclamation marks, no guilt.

| Where | Bare-bones (now or typical) | Logbook |
|---|---|---|
| Week strip, Monday | "0.0 of 26 mi" | "26 mi planned. First run today." |
| Streak after a miss | "0 days" | "7 of the last 8 weeks." |
| Hero, pre-run | "TODAY'S TRAINING · TO DO" | "Out the door in 22 min." |
| Hero, after Strava | "Completed" | "5.02 mi at 8:14. Logged." |
| Rest day | "No training scheduled" | "Rest. It counts." |
| Floor met, not goal | "Partial" | "Floor met. 20 min is a day kept." |
| To-dos empty | "All clear for today." (keep) | "All clear for today." |
| Journal placeholder | "What's on your mind today?" | "Speed 5 done. How did it feel?" |
| Evening | "Journal" | "Two sentences, then sleep." |
| Delete | "Item deleted" | "Deleted. Undo" |
| Sync error | "Error 502" | "Couldn't reach Strava. Trying again when you're online." |
| Drop conflict | "Invalid" | "Two hard days in a row. Keep it?" |
| Plan builder | "Generate plan" | "Write my next block" |
| Not feeling well | "Skip" | "Not feeling 100%. Ease the next few days." |

Rules: numbers before adjectives; sentence case (caps only for small labels); never "Oops" or "Great job!".
- WHOOP's AI Daily Outlook drew complaints that it read as a "hardcoded summary" ([WHOOP community](https://www.community.whoop.com/t/ai-coach-lacks-customizability-after-coming-out-of-beta/15909)), so any AI line in Logbook must reference something specific from the user's own data, or not show at all.

---

## 8. The 25 highest-impact changes, ranked

1. **Today becomes time-aware: pre-run, post-run, rest, evening (Today).** It is the single biggest fix for "sections stacked with no thought".
2. **Fold Morning into Today's hero plus a full-screen timeline; tab bar to Today · Plan · Trends · Journal (nav).** Today's job currently lives in two places.
3. **One hero, no duplicates (Today, Plan, Morning).** Remove the repeated Training row, the selected-day hero and the Morning hero that repeat their lists.
4. **Kill zeros (Today, Plan, Trends).** Replace "0.0 / 0 days / 0 open / 0%" with forward-looking sentences and a week ring.
5. **Habit orbs move above the fold, directly under the hero (Today).** They are the highest-frequency action, currently below the fold.
6. **Haptic vocabulary: 8 named events plus a Rigid/Soft native plugin (global).** Touch is where "satisfying" is felt; today there are 3 undifferentiated events.
7. **Spring presets and the shared-element card → sheet transition (global).** This gives one physical motion language and replaces the fades.
8. **Strava arrival moment (Today).** Route draw, number tick, Success haptic, Share pill. It is the emotional peak of the day and currently invisible.
9. **Plan as 7 draggable day rows; pinch to month (Plan).** Rescheduling becomes one gesture, and the 3-way segmented control goes.
10. **Morning timeline: direct manipulation of the wake marker and the run length, with selection ticks (Morning).** The core interaction of the brief: "the things themselves" move.
11. **Swipe actions with a threshold, a haptic and Undo on to-dos and sessions (Today, Plan).** Triage in one motion instead of opening a sheet.
12. **Journal composer first, with the prompt built from today's run (Journal).** Writing is the page's job; the quote becomes the prompt.
13. **Evening "Close the day" card with a 9:16 share (Today).** Gives the day an ending and Logbook a ritual.
14. **Long-press context menus with preview on every object (global).** One consistent secondary-action layer and a fallback for every gesture.
15. **Streaks counted in weeks; rest and the floor count; "Not feeling 100%" freezes (Today, Trends).** This removes the main churn trigger in habit apps.
16. **Scrubbable mileage chart with selection ticks and a verdict sentence (Trends).** The page answers "am I on track", and the chart becomes a toy.
17. **Value-first onboarding: 3 questions → real plan → Strava primer → Sign in with Apple (first run).** Consumers must see the product before any ask.
18. **Paint from the snapshot, optimistic writes, layout-true skeletons, no content spinners (global).** "Professional" is mostly perceived speed.
19. **Universal "+" that can be dragged onto a day, section or hero, with natural-language quick entry (global).** Things' Magic Plus pattern: one add, placed where you drop it.
20. **Remove the segmented controls on Morning (Plan/Settings) and Plan (Week/Month/Plans) (Morning, Plan).** They split pages that should be one surface.
21. **Weekly recap story, Sunday 7pm (Today, Share).** A reason to return weekly, and organic distribution.
22. **Rest day as a designed state (Today, Morning).** Copy, a dim halo and a streak-safe line instead of an empty card.
23. **Date navigation by swiping the date line; tap to return to today; drop the arrow buttons (Today, Plan).** Fewer chrome buttons, more direct.
24. **Rewrite every empty state and error per §7 (global).** Tone is half of "premium" and costs nothing.
25. **Settings becomes a profile sheet; Strava shows only when broken; add Haptics and Sounds toggles (Settings).** Removes the header gear; meets the HIG "make haptics optional" rule.
